#!/usr/bin/env node
// Signatures on Ferrite, in a real browser against the running app: Preferences > Signatures makes,
// names and edits two, and chooses one, kept on the server; a New Message starts with it, the
// Signature pop-up swaps it and None takes it off, and the recipient gets the one left. A reply puts it
// above the quote or under it as the setting says. Exits 0 only when every step passed and no page
// logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-signatures-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import {
  arrive,
  choose,
  closePreferences,
  compose,
  onServer,
  openPane,
  preferences,
  row,
  rows,
  send,
  values,
  viewer,
} from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-signatures");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `sichris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `simartin-${id}`, fullName: `Martin ${id}`, password };
const message = (page) => compose(page).getByRole("textbox", { name: "Message" });
const body = (page) => message(page).innerText();

async function addSignature(page, name, text) {
  await preferences(page).getByRole("button", { name: "Add Signature" }).click();
  const field = preferences(page).getByRole("textbox", { name: "Signature Name" });
  await field.fill(name);
  await preferences(page).getByRole("textbox", { name: "Signature Text" }).fill(text);
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await send(b, chris.name, `Question ${id}`, "Are you coming?");

  await openPane(a, "Signatures");
  await addSignature(a, "Work", "Chris Vega\nThe Harbor Office");
  await addSignature(a, "Home", "Chris");
  await preferences(a).getByRole("option", { name: "Work" }).click();
  step(
    "the pane shows the signature picked, by name and text",
    (await preferences(a).getByRole("textbox", { name: "Signature Text" }).inputValue()) ===
      "Chris Vega\nThe Harbor Office",
  );
  await choose(a, preferences(a), "Choose Signature", "Work");
  step(
    "both are on the server, with the one chosen",
    (await within(10_000, async () => {
      const kept = (await values(a))["mail.signatures"];
      const work = kept?.list?.find((each) => each.name === "Work");
      return kept?.list?.length === 2 && kept.chosen === work?.id;
    })) !== null,
  );
  await shot(a, "mail-signatures-pane");
  await closePreferences(a);

  await viewer(a).getByRole("button", { name: "New Message" }).click();
  await within(5_000, () => compose(a).isVisible());
  step(
    "a New Message starts with the chosen signature, and the pop-up says which",
    (await body(a)).includes("The Harbor Office") &&
      (await compose(a).getByRole("combobox", { name: "Signature" }).innerText()).includes("Work"),
  );
  await choose(a, compose(a), "Signature", "Home");
  step(
    "the pop-up swaps it",
    !(await body(a)).includes("The Harbor Office") && (await body(a)).trim() === "Chris",
  );
  await shot(a, "mail-signatures-compose");
  await choose(a, compose(a), "Signature", "None");
  step("None takes it off", (await body(a)).trim() === "");
  await choose(a, compose(a), "Signature", "Home");

  const subject = `Signed ${id}`;
  const to = compose(a).getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await compose(a).getByLabel("Subject:").fill(subject);
  await message(a).click();
  await a.keyboard.press("Control+Home");
  await a.keyboard.insertText("Hello there");
  await a.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(a).count()) === 0);
  step(
    "the recipient gets the signature left in the message",
    (await arrive(b, async () => {
      const got = await onServer(b, subject);
      if (got?.mailbox !== "inbox") return false;
      const reply = await b.request.get(new URL(`/api/mail/messages/${got.id}`, b.url()).href);
      const { text } = await reply.json();
      return text.includes("Hello there") && text.includes("Chris") && !text.includes("Harbor");
    })) !== null,
  );

  await arrive(a, async () => (await rows(a).count()) > 0);
  await row(a, `Question ${id}`).click();
  await a.keyboard.press("Control+R");
  await within(5_000, () => compose(a).isVisible());
  const above = await body(a);
  step(
    "a reply has it above the quoted text",
    above.indexOf("The Harbor Office") >= 0 &&
      above.indexOf("The Harbor Office") < above.indexOf("wrote:"),
  );
  await compose(a).getByRole("button", { name: "Close" }).first().click();
  await within(10_000, async () => (await compose(a).count()) === 0);

  await openPane(a, "Signatures");
  await preferences(a).getByRole("checkbox", { name: "Place signature above quoted text" }).click();
  await closePreferences(a);
  await row(a, `Question ${id}`).click();
  await a.keyboard.press("Control+R");
  await within(5_000, () => compose(a).isVisible());
  const under = await body(a);
  step(
    "with that setting off, it is under the quoted text",
    under.indexOf("wrote:") >= 0 && under.indexOf("The Harbor Office") > under.indexOf("wrote:"),
  );
  await compose(a).getByRole("button", { name: "Close" }).first().click();
  await within(10_000, async () => (await compose(a).count()) === 0);

  await a.reload({ waitUntil: "load" });
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await openPane(a, "Signatures");
  step(
    "after a reload the pane lists them",
    (await within(10_000, () =>
      preferences(a).getByRole("option", { name: "Home" }).isVisible(),
    )) !== null,
  );
  await preferences(a).getByRole("option", { name: "Home" }).click();
  await preferences(a).getByRole("button", { name: "Remove Signature" }).click();
  step(
    "Remove takes one off, on the server",
    (await within(10_000, async () => (await values(a))["mail.signatures"]?.list?.length === 1)) !==
      null,
  );
});
