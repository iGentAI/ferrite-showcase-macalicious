#!/usr/bin/env node
// Keychain Access's menus on a served desktop: New Password Item and Get Info from the keyboard, Copy
// Password from the Edit menu and the row's menu, Find, Help, and deleting two items at once with the
// question first. The server's copy never holds a name or a password. Exits 0 only when every step
// passed with no console error, page error, failed request or HTTP error. It refuses a session that
// already has a keychain, and removes only the one it made.
//
//   node e2e/keychain-access-depth-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const URL = "/api/keychain-access/vault";
const PASSWORD = "journey horse battery";
const SECRETS = { alpha: "alpha-s3cret", beta: "beta-s3cret", gamma: "gamma-s3cret" };

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};
const plainIn = (text) =>
  [PASSWORD, ...Object.keys(SECRETS), ...Object.values(SECRETS)].filter((word) =>
    text.includes(word),
  );

await journey("keychain-access-depth", async ({ page, base, out, step }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  await openDesktop(page, base);
  const before = await page.evaluate((url) => fetch(url).then((reply) => reply.json()), URL);
  if (before.vault !== null)
    throw new Error("this session already has a keychain: run against a disposable desktop");
  await page
    .getByRole("button", { name: /^Keychain Access$/ })
    .first()
    .click();
  const window = page.locator("[data-keychain-state]").first();
  await window.waitFor({ timeout: 10_000 });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  let dialog = page.getByRole("dialog", { name: "New Keychain Password" });
  await dialog.getByLabel("New Password:").fill(PASSWORD);
  await dialog.getByLabel("Verify:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });

  for (const [name, secret] of Object.entries(SECRETS)) {
    await page.keyboard.press("Control+n");
    dialog = page.getByRole("dialog", { name: "New Password Item" });
    await dialog.waitFor({ timeout: 5_000 });
    await dialog.getByLabel("Keychain Item Name:").fill(name);
    await dialog.getByLabel("Password:").fill(secret);
    const saved = nextSave(page, URL);
    await dialog.getByRole("button", { name: "Add" }).click();
    await saved;
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  }
  const grid = window.getByRole("grid", { name: "Items" });
  const row = (name) => grid.getByRole("row").filter({ hasText: name }).first();
  await row("gamma").waitFor();
  step("Command-N asks for a new item, three times", true);

  const stored = await page.evaluate((url) => fetch(url).then((reply) => reply.text()), URL);
  step(
    "the server's copy holds no name and no password",
    plainIn(stored).length === 0,
    plainIn(stored).join(),
  );

  await row("alpha").click();
  await menu(page, "Edit");
  await page.screenshot({ path: path.join(out, "keychain-edit-menu.png") });
  await page.getByRole("menuitem", { name: /^Copy Password/ }).click();
  await page.waitForTimeout(100);
  step("Edit > Copy Password copies the item's password", (await clipboard()) === SECRETS.alpha);

  await row("beta").click();
  await page.keyboard.press("Control+Shift+c");
  await page.waitForTimeout(100);
  step("Shift-Command-C copies the selected item's password", (await clipboard()) === SECRETS.beta);

  await row("gamma").click({ button: "right" });
  await page.screenshot({ path: path.join(out, "keychain-row-menu.png") });
  await page.getByRole("menuitem", { name: /^Copy Password/ }).click();
  await page.waitForTimeout(100);
  step(
    "the row's menu selects the row and copies its password",
    (await clipboard()) === SECRETS.gamma,
  );

  await page.keyboard.press("Control+i");
  dialog = page.getByRole("dialog", { name: "gamma" });
  await dialog.waitFor({ timeout: 5_000 });
  step("Command-I opens the selected item's info", true);
  await dialog.getByRole("button", { name: "Done" }).click();
  await dialog.waitFor({ state: "hidden" });

  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Find/ }).click();
  await page.waitForTimeout(500);
  step(
    "Edit > Find takes the search field",
    await window.getByRole("searchbox").evaluate((element) => element === document.activeElement),
  );

  await row("alpha").click();
  await row("gamma").click({ modifiers: ["Control"] });
  await page.keyboard.press("Delete");
  dialog = page.getByRole("dialog", { name: /Delete from/ });
  await dialog.getByText("these 2 items").waitFor({ timeout: 5_000 });
  await page.screenshot({ path: path.join(out, "keychain-delete.png") });
  step(
    "the Delete key asks first, naming how many",
    (await window.locator("[data-keychain-item]").count()) === 3,
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await dialog.waitFor({ state: "hidden" });
  await row("alpha").click();
  await row("gamma").click({ modifiers: ["Control"] });
  await row("alpha").click({ button: "right", modifiers: [] });
  await page.getByRole("menuitem", { name: "Delete 2 Items" }).click();
  dialog = page.getByRole("dialog", { name: /Delete from/ });
  const saved = nextSave(page, URL);
  await dialog.getByRole("button", { name: "Delete" }).click();
  await saved;
  await row("alpha").waitFor({ state: "detached" });
  await row("gamma").waitFor({ state: "detached" });
  step("the row's menu deletes both, and beta stays", (await row("beta").count()) === 1);

  await reloadDesktop(page);
  await page
    .getByRole("button", { name: /^Keychain Access$/ })
    .first()
    .click();
  dialog = page.getByRole("dialog", { name: /Unlock/ });
  await dialog.getByLabel("Password:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  await row("beta").waitFor({ timeout: 5_000 });
  step("after a reload only beta is left", (await row("alpha").count()) === 0);

  await menu(page, "Help");
  await page.getByRole("menuitem", { name: "Keychain Access Help" }).click();
  await page.locator('[data-window-id="help-viewer"]').waitFor({ timeout: 5_000 });
  step("Keychain Access Help opens Help Viewer", true);

  // Edit an item: every attribute is sealed, a new password is what Copy Password then gives.
  await page
    .locator('[data-window-id="help-viewer"]')
    .getByRole("button", { name: /close/i })
    .first()
    .click();
  await row("beta").click();
  await page.keyboard.press("Control+i");
  dialog = page.getByRole("dialog", { name: "beta" });
  await dialog.waitFor({ timeout: 5_000 });
  const save = dialog.getByRole("button", { name: "Save Changes" });
  step("Save Changes waits for a change", await save.isDisabled());
  await dialog.getByLabel("Name:").fill("renamed");
  await dialog.getByLabel("Account:").fill("journey-account");
  await dialog.getByLabel("Where:").fill("https://where.example");
  await dialog.getByLabel("Comments:").fill("journey-comment");
  await dialog.getByRole("button", { name: "Show Password" }).click();
  await dialog.getByRole("textbox", { name: "Password" }).fill("edited-s3cret");
  await page.screenshot({ path: path.join(out, "keychain-edit-item.png") });
  let saving = nextSave(page, URL);
  await save.click();
  await saving;
  dialog = page.getByRole("dialog", { name: "renamed" });
  await dialog.getByRole("button", { name: "Done" }).click();
  await dialog.waitFor({ state: "hidden" });
  await row("renamed").click();
  await page.keyboard.press("Control+Shift+c");
  await page.waitForTimeout(100);
  step(
    "Save Changes renames the item and changes its password",
    (await clipboard()) === "edited-s3cret",
  );

  await page.keyboard.press("Control+Shift+n");
  dialog = page.getByRole("dialog", { name: "New Secure Note Item" });
  await dialog.getByLabel("Keychain Item Name:").fill("my-note");
  await dialog.getByLabel("Note:").fill("note-text-s3cret");
  saving = nextSave(page, URL);
  await dialog.getByRole("button", { name: "Add" }).click();
  await saving;
  await row("my-note").waitFor();
  await window.getByRole("grid", { name: "Category" }).getByText("Secure Notes").click();
  await row("my-note").waitFor();
  step(
    "Shift-Command-N adds a note, listed under Secure Notes",
    (await row("renamed").count()) === 0,
  );

  await reloadDesktop(page);
  await page
    .getByRole("button", { name: /^Keychain Access$/ })
    .first()
    .click();
  dialog = page.getByRole("dialog", { name: /Unlock/ });
  await dialog.getByLabel("Password:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  // The category is kept across the reload: Secure Notes, which does not list the password.
  await window.getByRole("grid", { name: "Category" }).getByText("All Items").click();
  await row("renamed").click();
  await page.keyboard.press("Control+i");
  dialog = page.getByRole("dialog", { name: "renamed" });
  await dialog.waitFor({ timeout: 5_000 });
  step(
    "after a reload the edits are there",
    (await dialog.getByLabel("Comments:").inputValue()) === "journey-comment" &&
      (await dialog.getByLabel("Account:").inputValue()) === "journey-account" &&
      (await dialog.getByLabel("Where:").inputValue()) === "https://where.example",
  );
  await dialog.getByRole("button", { name: "Done" }).click();
  const envelope = await page.evaluate((url) => fetch(url).then((reply) => reply.text()), URL);
  const leaked = [
    "renamed",
    "journey-account",
    "journey-comment",
    "edited-s3cret",
    "note-text-s3cret",
    "my-note",
  ].filter((word) => envelope.includes(word));
  step("the server's copy still holds none of it", leaked.length === 0, leaked.join());

  await page.keyboard.press("Control+l");
  await page.locator('[data-keychain-state="locked"]').waitFor({ timeout: 5_000 });
  await page.screenshot({ path: path.join(out, "keychain-locked.png") });
  step(
    "Command-L locks: the items are gone from the window",
    (await window.locator("[data-keychain-item]").count()) === 0,
  );
  await window.getByRole("button", { name: /Unlock the/ }).click();
  dialog = page.getByRole("dialog", { name: /Unlock/ });
  await dialog.getByLabel("Password:").fill("not the password");
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.getByText("The password you entered is not correct.").waitFor({ timeout: 20_000 });
  await dialog.getByLabel("Password:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  await row("renamed").waitFor({ timeout: 5_000 });
  step("the padlock unlocks only with the password", true);

  const NEW_PASSWORD = "another journey horse";
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Change Password/ }).click();
  dialog = page.getByRole("dialog", { name: /Change Password/ });
  await dialog.getByLabel("Current Password:").fill("not the password");
  await dialog.getByLabel("New Password:").fill(NEW_PASSWORD);
  await dialog.getByLabel("Verify:").fill(NEW_PASSWORD);
  await dialog.getByRole("button", { name: "OK" }).click();
  await dialog.getByText("The current password is not correct.").waitFor({ timeout: 20_000 });
  await dialog.getByLabel("Current Password:").fill(PASSWORD);
  saving = nextSave(page, URL);
  await dialog.getByRole("button", { name: "OK" }).click();
  await saving;
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  await reloadDesktop(page);
  await page
    .getByRole("button", { name: /^Keychain Access$/ })
    .first()
    .click();
  dialog = page.getByRole("dialog", { name: /Unlock/ });
  await dialog.getByLabel("Password:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.getByText("The password you entered is not correct.").waitFor({ timeout: 20_000 });
  await dialog.getByLabel("Password:").fill(NEW_PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  await row("renamed").waitFor({ timeout: 5_000 });
  step(
    "Change Password: after a reload the old password fails, the new one opens every item",
    (await row("my-note").count()) === 1,
  );

  await page.evaluate((url) => fetch(url, { method: "DELETE" }), URL);
});
