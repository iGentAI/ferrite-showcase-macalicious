#!/usr/bin/env node
// A file opening in the right application: a `.vcf` and a saved link double-clicked in Finder, and
// Mail's attachments opened from the message, with real mouse input. What opened is read back: the
// card on Contacts' server, the tab on Safari's, the window of the application that took the file.
// Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/open-in-apps-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                     [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { step, run, shot } = twoPeople("open-in-apps");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `oiachris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `oiamartin-${id}`, fullName: `Martin ${id}`, password };
const CARD_FILE = `card-${id}.vcf`;
const CARD_NAME = `Zed${id}`;
const LINK_FILE = `link-${id}.webloc`;
const LINK_PATH = `opened-${id}`;
const TEXT_FILE = `words-${id}.txt`;
const OTHER_FILE = `thing-${id}.bin`;
const subject = `Files ${id}`;

const VCARD = `BEGIN:VCARD\r\nVERSION:3.0\r\nN:Journey;${CARD_NAME};;;\r\nFN:${CARD_NAME} Journey\r\nEND:VCARD\r\n`;
const WEBLOC = `<plist><dict><key>URL</key><string>https://example.org/${LINK_PATH}</string></dict></plist>`;

const getJson = (page, route) =>
  page.evaluate(async (url) => {
    const reply = await fetch(url, { credentials: "same-origin" });
    return reply.ok ? await reply.json() : { status: reply.status };
  }, route);

await run({}, {}, async ({ person }) => {
  const other = await person("martin", martin);
  const page = await person("chris", chris);
  await uploadFile(page, { parent: "documents", name: CARD_FILE, type: "", text: VCARD });
  await uploadFile(page, { parent: "documents", name: LINK_FILE, type: "", text: WEBLOC });
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });

  const dock = (name) =>
    page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  const inDocuments = async (name) => {
    await dock("Finder");
    await finder.waitFor({ timeout: 10_000 });
    await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    const file = finder.getByRole("option", { name, exact: true }).first();
    await file.waitFor({ timeout: 10_000 });
    return file;
  };

  await (await inDocuments(CARD_FILE)).dblclick();
  step(
    "A .vcf double-clicked in Finder opens Contacts",
    (await within(15_000, () =>
      page.locator('[data-window-id^="contacts"]').first().isVisible(),
    )) !== null,
  );
  const cards = async () => JSON.stringify(await getJson(page, "/api/contacts/cards"));
  step(
    "and the card is added, on the server",
    (await within(15_000, async () => (await cards()).includes(CARD_NAME))) !== null,
    (await cards()).slice(0, 120),
  );
  await page.waitForTimeout(300);
  await shot(page, "open-vcf-in-contacts");
  await page.getByRole("alertdialog").getByRole("button", { name: "OK" }).click();

  await (await inDocuments(LINK_FILE)).dblclick();
  step(
    "A saved link double-clicked in Finder opens Safari",
    (await within(15_000, () => page.locator('[data-window-id="safari"]').first().isVisible())) !==
      null,
  );
  const tabs = async () => JSON.stringify(await getJson(page, "/api/safari/tabs"));
  step(
    "and its address is a tab there, on the server",
    (await within(15_000, async () => (await tabs()).includes(LINK_PATH))) !== null,
  );
  await shot(page, "open-webloc-in-safari");

  // Martin sends Chris three kinds of file, which Chris opens from the message.
  await openFromDock(other, "Mail", undefined).catch(() => {});
  const theirs = other.locator(".mac-mail").first();
  await within(15_000, () => theirs.isVisible());
  await theirs.getByRole("button", { name: "New Message" }).click();
  const compose = other.locator(".mac-mail-compose").first();
  const to = compose.getByLabel("To:");
  await to.click();
  await to.pressSequentially(chris.name);
  await to.press("Enter");
  await compose.getByLabel("Subject:").fill(subject);
  await compose.getByLabel("Files from this computer").setInputFiles([
    { name: TEXT_FILE, mimeType: "text/plain", buffer: Buffer.from(`the words ${id}`) },
    { name: OTHER_FILE, mimeType: "application/octet-stream", buffer: Buffer.from([1, 2, 3]) },
  ]);
  const strip = compose.getByRole("list", { name: "Attachments" });
  await within(
    15_000,
    async () => (await strip.getByRole("listitem").filter({ hasText: "byte" }).count()) === 2,
  );
  await compose.getByRole("button", { name: "Send" }).click();

  await dock("Mail");
  const viewer = page.locator(".mac-mail").first();
  await within(15_000, () => viewer.isVisible());
  const message = viewer
    .getByRole("listbox", { name: "Messages" })
    .getByRole("option")
    .filter({ hasText: subject })
    .first();
  await message.waitFor({ timeout: 30_000 });
  await message.click();
  const attachment = (name) =>
    viewer
      .getByRole("list", { name: "Attachments" })
      .getByRole("listitem")
      .filter({ hasText: name });
  await attachment(TEXT_FILE).waitFor({ timeout: 10_000 });
  await attachment(TEXT_FILE).getByRole("button", { name: "Open", exact: true }).click();
  const textedit = page.locator(".mac-window", { hasText: TEXT_FILE }).locator("textarea").first();
  step(
    "A text attachment opened from the message shows its words in TextEdit",
    (await within(15_000, async () =>
      (await textedit.inputValue()).includes(`the words ${id}`),
    )) !== null,
  );
  await shot(page, "open-attachment-in-textedit");

  await dock("Mail");
  await attachment(OTHER_FILE).getByRole("button", { name: "Open", exact: true }).click();
  step(
    "One that no application opens shows in Quick Look",
    (await within(15_000, () =>
      page.locator(".mac-finder-quick-look-icon, .mac-finder-quick-look-file").first().isVisible(),
    )) !== null,
  );
  await shot(page, "open-attachment-in-quick-look");
  await page.keyboard.press("Escape");

  const names = ((await getJson(page, "/api/files/"))?.entries ?? [])
    .filter((each) => each.parent === "downloads")
    .map((each) => each.name);
  step(
    "Both are on the drive, in Downloads",
    names.includes(TEXT_FILE) && names.includes(OTHER_FILE),
  );
});
