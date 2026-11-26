#!/usr/bin/env node
// Search on Ferrite, in a real browser against the running app: the scope bar narrows to the mailbox,
// From: and Subject: tokens come from typing and from the suggestions, Backspace takes one off, and
// Save makes a Smart Mailbox of the search, kept on the server and shown after a reload. Exits 0 only
// when every step passed and no page logged a console error, a page error, a failed request or an HTTP
// error.
//
//   node e2e/mail-search-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { arrive, mailboxRow, row, rows, send, values, viewer } from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-search");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `sechris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `semartin-${id}`, fullName: `Martin ${id}`, password };
const count = (page, wanted) => within(8_000, async () => (await rows(page).count()) === wanted);
const title = (page) => viewer(page).locator(".mac-title-bar").first().innerText();

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await send(a, martin.name, `Ferry ${id}`, "Word kelp here");
  await send(a, martin.name, `Train ${id}`, "Word kelp there");

  await openFromDock(b, "Mail", undefined).catch(() => {});
  await arrive(b, async () => (await rows(b).count()) === 2);
  await send(b, chris.name, `Outgoing ${id}`, "Word kelp sent");

  const search = viewer(b).getByRole("searchbox");
  await search.click();
  await search.pressSequentially("kelp");
  step("All looks in every mailbox: Sent too", (await count(b, 3)) !== null);
  step(
    "the title says where it looks",
    (await title(b)).includes("All Mailboxes") && (await title(b)).includes("Found 3"),
  );
  step(
    "the field offers From: and Subject: for the words",
    (await viewer(b).getByRole("option", { name: "From: kelp" }).isVisible()) &&
      (await viewer(b).getByRole("option", { name: "Subject: kelp" }).isVisible()),
  );
  const scope = viewer(b).getByRole("radiogroup", { name: "Search In" });
  await scope.getByRole("radio", { name: "Inbox" }).click();
  step(
    "the mailbox's scope leaves out what is elsewhere",
    (await count(b, 2)) !== null && (await title(b)).includes("“Inbox”"),
  );
  await scope.getByRole("radio", { name: "All" }).click();
  await search.fill("");

  await search.pressSequentially(`from:${chris.name} `);
  step(
    "from: and a space make a token",
    (await viewer(b).locator(".mac-toolbar-search-field-token").innerText()).includes(chris.name) &&
      (await search.inputValue()) === "",
  );
  step("the token asks for that sender", (await count(b, 2)) !== null);
  await search.pressSequentially("Ferry");
  await viewer(b).getByRole("option", { name: "Subject: Ferry" }).click();
  step(
    "a suggestion makes a Subject token, and both must hold",
    (await viewer(b).locator(".mac-toolbar-search-field-token").count()) === 2 &&
      (await count(b, 1)) !== null &&
      (await row(b, `Ferry ${id}`).isVisible()),
  );
  await shot(b, "mail-search");
  await search.click();
  await b.keyboard.press("Backspace");
  step(
    "Backspace takes the last token off",
    (await viewer(b).locator(".mac-toolbar-search-field-token").count()) === 1 &&
      (await count(b, 2)) !== null,
  );
  await search.pressSequentially("subject:Ferry");
  await search.press("Enter");
  await count(b, 1);

  await viewer(b).getByRole("button", { name: "Save" }).click();
  const sheet = b.getByRole("dialog").filter({ hasText: "New Smart Mailbox" });
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("textbox", { name: "Smart Mailbox Name" }).fill(`Saved ${id}`);
  await b.waitForTimeout(400);
  await shot(b, "mail-search-save");
  await sheet.getByRole("button", { name: "OK" }).click();
  step(
    "Save makes a Smart Mailbox with the search's conditions, on the server",
    (await within(10_000, async () => {
      const box = (await values(b))["mail.smart"]?.[0];
      return (
        box?.name === `Saved ${id}` &&
        box.matchAll === true &&
        box.rules.some((rule) => rule.field === "from" && rule.value === chris.name) &&
        box.rules.some((rule) => rule.field === "subject" && rule.value === "Ferry")
      );
    })) !== null,
  );
  step(
    "it is shown, the search over, holding the one message",
    (await viewer(b).locator(".mac-toolbar-search-field-token").count()) === 0 &&
      (await count(b, 1)) !== null,
  );

  await b.reload({ waitUntil: "load" });
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  step(
    "after a reload it is listed and holds it",
    (await within(15_000, () => mailboxRow(b, `Saved ${id}`).isVisible())) !== null &&
      (await count(b, 1)) !== null,
  );
});
