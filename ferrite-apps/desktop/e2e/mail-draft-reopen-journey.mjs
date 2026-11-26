#!/usr/bin/env node
// A saved draft opened again straight after a save, before the list has been read again: a save stores the draft
// under a new id, and the Drafts row must already hold it. The list is held back so the row cannot be saved by
// timing. Exits 0 only when every step passed and no page logged a console error, a page error, a failed request
// or an HTTP error, such as the 404 the old id answers.
//
//   node e2e/mail-draft-reopen-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run } = twoPeople("mail-draft-reopen");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mdchris-${id}`, fullName: `Chris ${id}`, password };

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const text = (page) => compose(page).locator(".mac-mail-compose-message").first();
const row = (page, subject) =>
  viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option").filter({
    hasText: subject,
  });
const closeAndSave = async (page) => {
  await compose(page).getByRole("button", { name: "Close" }).first().click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^Save/ })
    .click({ timeout: 2_000 })
    .catch(() => {});
  await within(10_000, async () => (await compose(page).count()) === 0);
};

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());

  const subject = `Reopened ${id}`;
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  await compose(a).getByLabel("Subject:").fill(subject);
  await text(a).click();
  await a.keyboard.type("first");
  await closeAndSave(a);
  await viewer(a)
    .getByRole("tree", { name: "Mailboxes" })
    .getByRole("treeitem", { name: /^Drafts/ })
    .getByText("Drafts", { exact: true })
    .first()
    .click();
  await row(a, subject).first().waitFor({ timeout: 10_000 });

  await row(a, subject).first().dblclick();
  await compose(a).waitFor({ timeout: 10_000 });
  await text(a).click();
  await a.keyboard.type(" second");
  await a.route(/\/api\/mail\/messages(\?.*)?$/, async (route) => {
    await new Promise((done) => setTimeout(done, 3_000));
    await route.continue().catch(() => {});
  });
  await closeAndSave(a);
  await row(a, subject).first().dblclick();
  const opened = await compose(a)
    .waitFor({ timeout: 2_500 })
    .then(
      () => true,
      () => false,
    );
  step("a draft just saved opens again from its row before the list is read again", opened);
  step(
    "and holds what was saved",
    opened && (await text(a).innerText()).replace(/\s+/g, " ").includes("first second"),
  );
  await a.unroute(/\/api\/mail\/messages(\?.*)?$/);
  step(
    "the row is there once, after the list is read again",
    (await within(10_000, async () => (await row(a, subject).count()) === 1)) !== null,
  );
});
