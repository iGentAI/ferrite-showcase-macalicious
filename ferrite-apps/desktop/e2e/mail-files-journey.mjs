#!/usr/bin/env node
// Mail's files and commands on Ferrite, in a real browser against the running app: File > Save As and
// Export Mailbox download a message and a whole mailbox with their full text; Copy to leaves the message
// where it was and adds it to another mailbox, kept on the server; Forward as Attachment opens a New
// Message with the message as a file; the buttons over a message act on it; Space pages through a
// long message; the Dock's menu writes a new message. Exits 0 only when every step passed and no page
// logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-files-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                   [--browser chromium|chrome|firefox|webkit]

import { readFile } from "node:fs/promises";
import { sameDownloadName } from "./journey-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot, browserName, allow } = twoPeople("mail-files");
// WebKit reports a read the page's reload cancels as a failed access check, on the same origin.
let reloading = false;
allow({
  test: (text) => reloading && /\/api\/mail\/messages\S* due to access control checks/.test(text),
});
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mfchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mfmartin-${id}`, fullName: `Martin ${id}`, password };
const subject = `Files ${id}`;
const long = Array.from({ length: 200 }, (_, line) =>
  line === 3 ? "From the middle of the text" : `Line ${line} of the text`,
).join("\n");

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const mailboxRow = (page, name) =>
  viewer(page)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: new RegExp(`^${name}`) });
async function menuPath(page, ...names) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: names[0], exact: true })
    .first()
    .click();
  for (const name of names.slice(1)) {
    await page.getByRole("menu").last().getByRole("menuitem", { name }).first().click();
  }
}
const serverList = async (page) => {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  return (await reply.json()).messages ?? [];
};
const download = async (page, act) => {
  const [file] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), act()]);
  return { name: file.suggestedFilename(), text: await readFile(await file.path(), "utf8") };
};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  const sent = await b.request.post(new URL("/api/mail/send", b.url()).href, {
    headers: { "idempotency-key": `files-${id}`, "x-requested-with": "macalicious" },
    data: { to: [chris.name], subject, text: long },
  });
  if (!sent.ok()) throw new Error(`the message did not go: ${sent.status()}`);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(20_000, async () => (await rows(a).count()) === 1);
  await rows(a).first().click();
  await within(10_000, () => a.getByText("Line 7 of the text").first().isVisible());

  const eml = await download(a, () => menuPath(a, "File", /^Save As/));
  step(
    "Save As gives the message as an .eml, with all of its text",
    sameDownloadName(eml.name, `${subject}.eml`, browserName) &&
      eml.text.includes(`Subject: ${subject}`) &&
      eml.text.includes("\r\n\r\nLine 0 of the text") &&
      eml.text.includes("Line 199 of the text"),
  );
  const mbox = await download(a, () => menuPath(a, "Mailbox", /^Export Mailbox/));
  step(
    "Export Mailbox gives the Inbox as an mbox, quoting a line that reads as a separator",
    mbox.name === "Inbox.mbox" &&
      /^From \S+ \w{3} \w{3} [ \d]\d \d\d:\d\d:\d\d \d{4}\n/.test(mbox.text) &&
      mbox.text.includes("\n>From the middle of the text\n") &&
      mbox.text.includes("Line 199 of the text"),
  );

  await menuPath(a, "Message", /^Copy to/);
  await a
    .getByRole("menu")
    .filter({ has: a.getByRole("menuitem", { name: "Inbox", exact: true }) })
    .getByRole("menuitem", { name: "Archive", exact: true })
    .click();
  const copied = await within(10_000, async () => {
    const all = await serverList(a);
    return (
      all.length === 2 &&
      all.some((each) => each.mailbox === "inbox") &&
      all.some((each) => each.mailbox === "archive")
    );
  });
  step(
    "Copy to keeps the message where it was and adds it to Archive, on the server",
    copied !== null,
  );
  reloading = true;
  await a.reload();
  reloading = false;
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await mailboxRow(a, "Archive").getByText("Archive", { exact: true }).first().click();
  step(
    "and the copy is listed there after a reload",
    (await within(10_000, async () => (await rows(a).count()) === 1)) !== null,
  );
  await rows(a).first().click();
  await within(10_000, () => a.getByText("Line 7 of the text").first().isVisible());

  const pane = viewer(a).locator(".mac-mail-find-text .mac-scroll-view-viewport").first();
  await rows(a).first().focus();
  await a.keyboard.press("Space");
  step(
    "Space pages down through the message",
    (await within(5_000, async () => (await pane.evaluate((el) => el.scrollTop)) > 0)) !== null,
  );
  await a.keyboard.press("Shift+Space");
  step(
    "Shift-Space pages back",
    (await within(5_000, async () => (await pane.evaluate((el) => el.scrollTop)) === 0)) !== null,
  );

  const content = viewer(a).locator(".mac-mail-message-content").first();
  const bar = content.locator(".mac-mail-hover-bar");
  await a.mouse.move(5, 5);
  const hidden = await bar.evaluate((el) => getComputedStyle(el).opacity === "0");
  await content.hover({ position: { x: 100, y: 100 } });
  const shown = await within(3_000, () =>
    bar.evaluate((el) => getComputedStyle(el).opacity === "1"),
  );
  step("The buttons show only while the pointer is over the message", hidden && shown !== null);
  await shot(a, "mail-hover-bar");
  await bar.locator('button[title="Reply"]').click();
  step(
    "and Reply there writes back",
    (await within(
      10_000,
      async () => (await compose(a).getByLabel("Subject:").inputValue()) === `Re: ${subject}`,
    )) !== null,
  );
  await compose(a).getByRole("button", { name: "Close" }).first().click();
  const discard = a
    .getByRole("alertdialog")
    .getByRole("button", { name: /^(Delete|Discard|Don.t Save)/ });
  await discard.click({ timeout: 3_000 }).catch(() => {});
  await within(10_000, async () => (await compose(a).count()) === 0);

  await menuPath(a, "Message", /^Forward as Attachment/);
  const strip = compose(a).locator(".mac-mail-live-attachment");
  const attached = await within(15_000, async () => {
    const text = await strip.first().textContent();
    return text?.includes(`${subject}.eml`) && !text.includes("Uploading");
  });
  step(
    "Forward as Attachment opens a New Message with the message as a file",
    attached !== null &&
      (await compose(a).getByLabel("Subject:").inputValue()) === `Fwd: ${subject}`,
  );
  await shot(a, "mail-forward-attached");
  const to = compose(a).getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await a.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(a).count()) === 0);
  const delivered = await within(20_000, async () => {
    const all = await serverList(b);
    return all.find((each) => each.subject === `Fwd: ${subject}` && each.attachments?.length === 1);
  });
  step("and it reaches them with the file", delivered !== null);

  await a
    .getByRole("button", { name: /^Mail$/ })
    .first()
    .click({ button: "right" });
  await a.getByRole("menuitem", { name: "New Message" }).first().click();
  step(
    "The Dock's menu writes a new message",
    (await within(10_000, () => compose(a).isVisible())) !== null,
  );
});
