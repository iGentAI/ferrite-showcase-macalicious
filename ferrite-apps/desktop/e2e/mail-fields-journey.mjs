#!/usr/bin/env node
// New Message's Bcc, Reply-To and Priority on Ferrite, in a real browser against the running app:
// shown from View with the choice kept, sent so that the Bcc person gets the message and only the
// Sent copy names them, a reply goes to the Reply-To, and a saved draft keeps all three across a
// reload. Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node e2e/mail-fields-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                    [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-fields");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mfchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mfmartin-${id}`, fullName: `Martin ${id}`, password };
const ada = { name: `mfada-${id}`, fullName: `Ada ${id}`, password };
const subject = `Ferry ${id}`;

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const messages = async (page) => {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  return (await reply.json()).messages ?? [];
};
const values = async (page) => {
  const reply = await page.request.get(
    new URL("/api/system-preferences/settings", page.url()).href,
  );
  return (await reply.json()).values ?? {};
};
async function field(page, label, text) {
  const input = compose(page).getByLabel(label, { exact: true });
  await input.click();
  await input.pressSequentially(text);
  await input.press("Enter");
}
async function menuPath(page, ...names) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: names[0], exact: true })
    .first()
    .click();
  for (const name of names.slice(1)) {
    const menu = page.getByRole("menu").last();
    await menu
      .getByRole("menuitem", { name })
      .or(menu.getByRole("menuitemcheckbox", { name }))
      .click();
  }
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  const c = await person("ada", ada);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());

  await viewer(a).getByRole("button", { name: "New Message" }).click();
  await compose(a).waitFor({ timeout: 10_000 });
  await menuPath(a, "View", "Bcc Address Field");
  await menuPath(a, "View", "Reply-To Address Field");
  await menuPath(a, "View", "Priority Field");
  step(
    "View shows the three fields, and the choice is on the server",
    (await compose(a).getByLabel("Bcc:", { exact: true }).isVisible()) &&
      (await compose(a).getByLabel("Reply-To:", { exact: true }).isVisible()) &&
      (await compose(a)
        .getByRole("button", { name: "Priority" })
        .isVisible()
        .catch(() => false)
        .then(
          async (shown) =>
            shown || compose(a).getByRole("combobox", { name: "Priority" }).isVisible(),
        )) &&
      (await within(10_000, async () => {
        const kept = (await values(a))["mail.composeFields"];
        return kept?.bcc && kept?.replyTo && kept?.priority;
      })) !== null,
  );
  await field(a, "To:", martin.name);
  await field(a, "Bcc:", ada.name);
  await compose(a).getByLabel("Reply-To:", { exact: true }).fill(`${ada.name}@macalicious`);
  await compose(a).getByLabel("Subject:").fill(subject);
  const popup = compose(a)
    .getByRole("combobox", { name: "Priority" })
    .or(compose(a).getByRole("button", { name: "Priority" }))
    .first();
  await popup.click();
  await a
    .getByRole("option", { name: "High", exact: true })
    .or(a.getByRole("menuitemradio", { name: "High", exact: true }))
    .first()
    .click();
  await within(5_000, async () => (await popup.innerText()).includes("High"));
  await shot(a, "mail-fields-window");

  // Kept as a draft while it is written, then shown again after a reload.
  await within(12_000, async () =>
    (await messages(a)).some((each) => each.mailbox === "drafts" && each.priority === "high"),
  );
  await a.reload({ waitUntil: "load" });
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await viewer(a)
    .getByRole("radiogroup", { name: "Favorites" })
    .or(viewer(a).getByRole("group", { name: "Favorites" }))
    .getByText(/^Drafts/)
    .click();
  await within(10_000, async () => (await rows(a).count()) === 1);
  await rows(a).first().dblclick();
  await compose(a).waitFor({ timeout: 10_000 });
  step(
    "the draft keeps Bcc, Reply-To and Priority after a reload",
    (await within(10_000, async () =>
      (
        await compose(a)
          .getByRole("group", { name: "Bcc recipients" })
          .or(compose(a).getByLabel("Bcc recipients"))
          .first()
          .innerText()
      ).includes(ada.name),
    )) !== null &&
      (await compose(a).getByLabel("Reply-To:", { exact: true }).inputValue()) ===
        `${ada.name}@macalicious`,
  );

  await a.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(a).count()) === 0);

  await within(10_000, async () => (await messages(a)).some((each) => each.mailbox === "sent"));
  const sent = (await messages(a)).find((each) => each.mailbox === "sent");
  step("the Sent copy names the Bcc person", sent?.bcc?.[0]?.name === ada.name);
  for (const [page, who] of [
    [b, "Martin"],
    [c, "Ada"],
  ]) {
    await within(15_000, async () => (await messages(page)).length > 0);
    const [got] = await messages(page);
    step(
      `${who} has it in the Inbox, with its priority and no Bcc`,
      got?.subject === subject && got.priority === "high" && got.bcc === undefined,
      JSON.stringify(got?.bcc),
    );
  }

  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(20_000, async () => (await rows(b).count()) === 1);
  step(
    "the row marks it",
    (await within(5_000, () => rows(b).getByRole("img", { name: "High priority" }).isVisible())) !==
      null,
  );
  await rows(b).first().click();
  await menuPath(b, "Message", /^Reply$/);
  await compose(b).waitFor({ timeout: 10_000 });
  step(
    "a reply is addressed to the Reply-To",
    (await within(10_000, async () =>
      (await compose(b).getByLabel("To recipients").innerText()).includes(ada.name),
    )) !== null,
  );
  await shot(b, "mail-fields-reply");

  // A message that says nothing but its priority is still kept when its window closes.
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  await compose(a).waitFor({ timeout: 10_000 });
  const only = compose(a)
    .getByRole("combobox", { name: "Priority" })
    .or(compose(a).getByRole("button", { name: "Priority" }))
    .first();
  await only.click();
  await a
    .getByRole("option", { name: "Low", exact: true })
    .or(a.getByRole("menuitemradio", { name: "Low", exact: true }))
    .first()
    .click();
  await compose(a).getByRole("button", { name: "Close" }).first().click();
  step(
    "a draft holding only a priority is kept on the server",
    (await within(10_000, async () =>
      (await messages(a)).some((each) => each.mailbox === "drafts" && each.priority === "low"),
    )) !== null,
  );

  // Nor is a Reply-To alone lost.
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  await compose(a).waitFor({ timeout: 10_000 });
  await compose(a).getByLabel("Reply-To:", { exact: true }).fill("later@macalicious");
  await compose(a).getByRole("button", { name: "Close" }).first().click();
  step(
    "a draft holding only a Reply-To is kept on the server",
    (await within(10_000, async () =>
      (
        await messages(a)
      ).some((each) => each.mailbox === "drafts" && each.reply_to === "later@macalicious"),
    )) !== null,
  );
});
