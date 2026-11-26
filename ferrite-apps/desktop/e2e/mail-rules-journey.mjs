#!/usr/bin/env node
// Rules on Ferrite, in a real browser against the running app. Preferences > Rules adds a rule that
// moves and flags; new Inbox mail runs it, on the server; moving a message back and reloading repeats
// nothing; Message > Apply Rules runs it on the selection; applying to the mailbox under a search
// touches only that mailbox; a rule that is off does nothing. Exits 0 only when every step passed and
// no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/mail-rules-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                   [--browser chromium|chrome|firefox|webkit]

import {
  arrive,
  choose,
  closePreferences,
  mailboxRow,
  menuPath,
  onServer,
  openPane,
  preferences,
  row,
  rows,
  send as sendTo,
  settled,
  values,
  viewer,
} from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("mail-rules");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `ruchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `rumartin-${id}`, fullName: `Martin ${id}`, password };
const send = (page, subject) => sendTo(page, martin.name, subject);

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  const before = `Before ${id} ferry`;
  await send(a, before);

  await openFromDock(b, "Mail", undefined).catch(() => {});
  await arrive(b, async () => (await rows(b).count()) === 1);
  step(
    "mail that met no rule is no longer new, on the server",
    (await within(10_000, async () => (await onServer(b, before))?.rules_pending !== true)) !==
      null,
  );

  await openPane(b, "Rules");
  await preferences(b).getByRole("button", { name: "Add Rule" }).click();
  const sheet = b.getByRole("dialog").filter({ hasText: "Add Rule" });
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("textbox", { name: "Description" }).fill("Boats");
  step(
    "OK waits for the condition's words",
    await sheet.getByRole("button", { name: "OK" }).isDisabled(),
  );
  await choose(b, sheet, "Field", "Subject");
  await sheet.getByRole("textbox", { name: "Value" }).fill("ferry");
  await sheet.getByRole("button", { name: "Add Action" }).click();
  await choose(
    b,
    sheet.getByRole("list", { name: "Actions" }).getByRole("listitem").nth(1),
    "Action",
    "Mark as Flagged",
  );
  await shot(b, "mail-rules-sheet");
  await sheet.getByRole("button", { name: "OK" }).click();
  const asking = b.getByRole("alertdialog");
  await asking.waitFor({ timeout: 5_000 });
  await asking.getByRole("button", { name: /Don.t Apply/ }).click();
  step(
    "the rule is listed and kept on the server",
    (await preferences(b).getByRole("option", { name: /Boats/ }).isVisible()) &&
      (await within(10_000, async () => {
        const rules = (await values(b))["mail.rules"] ?? [];
        return rules[0]?.description === "Boats" && rules[0].actions.length === 2;
      })) !== null,
  );
  await shot(b, "mail-rules-pane");
  step("Don't Apply leaves what the Inbox held", (await onServer(b, before)).mailbox === "inbox");
  await closePreferences(b);

  const ferry = `Ferry ${id}`;
  const dinner = `Dinner ${id}`;
  await send(a, ferry);
  await send(a, dinner);
  step(
    "new Inbox mail runs the rule: moved and flagged on the server",
    (await arrive(b, async () => {
      const moved = await onServer(b, ferry);
      return moved?.mailbox === "archive" && moved.flag === "red";
    })) !== null,
  );
  step(
    "mail the rule does not pick stays in the Inbox",
    (await arrive(b, async () => (await onServer(b, dinner))?.mailbox === "inbox")) !== null,
  );

  await mailboxRow(b, "Archive").click();
  await row(b, ferry).click();
  await menuPath(b, "Message", "Move to", "Inbox");
  await within(10_000, async () => (await onServer(b, ferry))?.mailbox === "inbox");

  await b.reload({ waitUntil: "load" });
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(b).isVisible());
  await mailboxRow(b, "Inbox").click();
  await within(10_000, () => row(b, ferry).isVisible());
  await settled(b);
  step(
    "after a reload nothing is run again: the message moved back stays in the Inbox",
    (await onServer(b, ferry)).mailbox === "inbox",
  );

  await row(b, ferry).click();
  await b.keyboard.press("Control+Alt+L");
  step(
    "Apply Rules runs the rule on the selection, by its key",
    (await within(10_000, async () => (await onServer(b, ferry))?.mailbox === "archive")) !== null,
  );
  await b.keyboard.press("Control+Z");
  step(
    "Undo takes it back",
    (await within(10_000, async () => (await onServer(b, ferry))?.mailbox === "inbox")) !== null,
  );

  await row(b, before).click();
  await menuPath(b, "Message", "Apply Rules");
  step(
    "Apply Rules from the menu acts on old mail too",
    (await within(10_000, async () => (await onServer(b, before))?.mailbox === "archive")) !== null,
  );
  await b.keyboard.press("Control+Z");
  await within(10_000, async () => (await onServer(b, before))?.mailbox === "inbox");

  // Under a search across every mailbox, "this mailbox" is still the one in the sidebar.
  await row(b, before).click();
  await menuPath(b, "Message", "Move to", "Trash");
  await within(10_000, async () => (await onServer(b, before))?.mailbox === "trash");
  await viewer(b).getByRole("searchbox").fill("ferry");
  await within(5_000, async () => (await row(b, before).count()) === 1);
  await openPane(b, "Rules");
  await preferences(b).getByRole("option", { name: /Boats/ }).click();
  await preferences(b).getByRole("button", { name: "Edit" }).click();
  const editing = b.getByRole("dialog").filter({ hasText: "Edit Rule" });
  await editing.waitFor({ timeout: 5_000 });
  await editing.getByRole("button", { name: "OK" }).click();
  await asking.waitFor({ timeout: 5_000 });
  await shot(b, "mail-rules-apply");
  await asking.getByRole("button", { name: "Apply", exact: true }).click();
  step(
    "applying to the mailbox under a search takes what the Inbox holds",
    (await within(10_000, async () => (await onServer(b, ferry))?.mailbox === "archive")) !== null,
  );
  await settled(b);
  step(
    "and leaves a message the search listed from another mailbox",
    (await onServer(b, before)).mailbox === "trash",
  );
  await viewer(b).getByRole("searchbox").fill("");

  await openPane(b, "Rules");
  await preferences(b).getByRole("checkbox", { name: "Active: Boats" }).click();
  step(
    "the rule's checkbox turns it off, on the server",
    (await within(10_000, async () => (await values(b))["mail.rules"]?.[0]?.enabled === false)) !==
      null,
  );
  const late = `Late ferry ${id}`;
  await send(a, late);
  await arrive(b, async () => (await onServer(b, late))?.mailbox === "inbox");
  await settled(b);
  step("a rule that is off does nothing", (await onServer(b, late)).mailbox === "inbox");

  await preferences(b).getByRole("option", { name: /Boats/ }).click();
  await preferences(b).getByRole("button", { name: "Remove" }).click();
  step(
    "Remove takes it off the list, on the server",
    (await within(10_000, async () => ((await values(b))["mail.rules"] ?? []).length === 0)) !==
      null,
  );
});
