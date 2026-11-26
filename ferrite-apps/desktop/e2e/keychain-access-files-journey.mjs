#!/usr/bin/env node
// Keychain Access's whole-keychain commands on a served desktop: an exported file comes back through Import Items and
// through a drop from Finder, under its own password and without the server seeing it; importing twice adds nothing;
// Select All and the dimmed rows of what a web page does not have; Change Settings locks after the wait and when the tab
// is hidden, across a reload; the keychain row's menu; Delete Keychain leaves no keychain, across a reload. Exits 0 only
// when every step passed with no console error, page error, failed request or HTTP error.
//
// `document.hidden` is overridden for the hidden-tab step, because a headless browser does not hide a tab: that step
// proves the window's answer to the event, not the browser's firing of it. The wait runs on Playwright's clock.
//
//   node e2e/keychain-access-files-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const VAULT = "/api/keychain-access/vault";
const PASSWORD = "journey horse battery";
const FILE_PASSWORD = "another staple sentence";
const ITEMS = { "files-alpha": "alpha-s3cret", "files-beta": "beta-s3cret" };
const RUN = Date.now().toString(36);
const DROPPED = `dropped-${RUN}.json`;
const NOT_OURS = `not-ours-${RUN}.json`;

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("keychain-access-files", async ({ page, base, out, step }) => {
  const sent = [];
  page.on("request", (request) => {
    const body = request.postData();
    if (body) sent.push(body);
  });
  await openDesktop(page, base);
  const before = await page.evaluate((url) => fetch(url).then((reply) => reply.json()), VAULT);
  if (before.vault !== null)
    throw new Error("this session already has a keychain: run against a disposable desktop");
  const openKeychain = () =>
    page
      .getByRole("button", { name: /^Keychain Access$/ })
      .first()
      .click();
  await openKeychain();
  const window = page.locator("[data-keychain-state]").first();
  await window.waitFor({ timeout: 10_000 });
  const state = () => window.getAttribute("data-keychain-state");
  const grid = window.getByRole("grid", { name: "Items" });
  const row = (name) => grid.getByRole("row").filter({ hasText: name }).first();
  const notice = page.getByRole("dialog", { name: "Keychain Access" });
  const closeNotice = async () => {
    await notice.getByRole("button", { name: "OK" }).click();
    await notice.waitFor({ state: "hidden" });
  };

  let dialog = page.getByRole("dialog", { name: "New Keychain Password" });
  await dialog.getByLabel("New Password:").fill(PASSWORD);
  await dialog.getByLabel("Verify:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  for (const [name, secret] of Object.entries(ITEMS)) {
    await page.keyboard.press("Control+n");
    dialog = page.getByRole("dialog", { name: "New Password Item" });
    await dialog.getByLabel("Keychain Item Name:").fill(name);
    await dialog.getByLabel("Password:", { exact: true }).fill(secret);
    const saved = nextSave(page, VAULT);
    await dialog.getByRole("button", { name: "Add" }).click();
    await saved;
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });
  }
  await row("files-beta").waitFor();

  await menu(page, "File");
  await page.screenshot({ path: path.join(out, "keychain-file-menu.png") });
  for (const name of [
    /^New Certificate Preference/,
    /^New Identity Preference/,
    /^Add Keychain/,
    /^Make Keychain/,
    /^Certificate Assistant/,
    /^Ticket Viewer/,
  ]) {
    const item = page.getByRole("menuitem", { name });
    const reason = await item.getAttribute("data-reason");
    step(
      `${name.source.slice(1)} is dimmed and says why`,
      (await item.getAttribute("aria-disabled")) === "true" &&
        reason?.includes("web page") === true,
    );
  }
  await page.keyboard.press("Escape");

  await row("files-alpha").click();
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(200);
  step(
    "Edit > Select All selects every listed item",
    (await grid.locator("[role='row'][aria-selected='true']").count()) === 2,
  );
  await row("files-alpha").click();
  await page.keyboard.press("Control+a");
  await page.waitForTimeout(100);
  step(
    "and so does Command-A",
    (await grid.locator("[role='row'][aria-selected='true']").count()) === 2,
  );

  await page.keyboard.press("Control+Shift+e");
  dialog = page.getByRole("dialog", { name: "Export Items" });
  await dialog.getByLabel("File Password:").fill(FILE_PASSWORD);
  await dialog.getByLabel("Verify:").fill(FILE_PASSWORD);
  const download = page.waitForEvent("download", { timeout: 30_000 });
  await dialog.getByRole("button", { name: "Export" }).click();
  const exported = await download;
  const text = readFileSync(await exported.path(), "utf8");
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  const file = path.join(out, `keychain-export-${RUN}.json`);
  writeFileSync(file, text);

  // The items go, so that what comes back can only be the file's.
  await page.keyboard.press("Delete");
  dialog = page.getByRole("dialog", { name: /Delete from/ });
  let saved = nextSave(page, VAULT);
  await dialog.getByRole("button", { name: "Delete" }).click();
  await saved;
  await dialog.waitFor({ state: "hidden" });
  await row("files-alpha").waitFor({ state: "detached" });

  await menu(page, "File");
  const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
  await page.getByRole("menuitem", { name: /^Import Items/ }).click();
  await (await chooser).setFiles(file);
  dialog = page.getByRole("dialog", { name: "Import Items" });
  await dialog.waitFor({ timeout: 5_000 });
  step("File > Import Items asks for the password of the chosen file", true);
  await dialog.getByLabel("File Password:").fill("not the password");
  await dialog.getByRole("button", { name: "Import" }).click();
  await dialog.getByText("The password you entered is not correct.").waitFor({ timeout: 20_000 });
  step("a wrong password imports nothing and says so", (await row("files-alpha").count()) === 0);
  await page.screenshot({ path: path.join(out, "keychain-import-dialog.png") });
  await dialog.getByLabel("File Password:").fill(FILE_PASSWORD);
  saved = nextSave(page, VAULT);
  await dialog.getByRole("button", { name: "Import" }).click();
  await saved;
  await notice.getByText("Imported 2 items.").waitFor({ timeout: 20_000 });
  await closeNotice();
  await row("files-beta").waitFor();
  step("its password brings the items back", (await row("files-alpha").count()) === 1);

  const byKey = page.waitForEvent("filechooser", { timeout: 5_000 });
  await page.keyboard.press("Control+Shift+i");
  await byKey;
  step("Command-Shift-I asks for a file too", true);
  await uploadFile(page, {
    parent: "documents",
    name: DROPPED,
    type: "application/json",
    text,
  });
  await uploadFile(page, {
    parent: "documents",
    name: NOT_OURS,
    type: "application/json",
    text: '{"nothing": true}\n',
  });

  // A drop from Finder: Finder moves left, so that a part of the window shows beside it.
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .click();
  const finder = page.locator("[data-window-id]").filter({ hasText: "Recents" }).first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByText("Documents", { exact: true }).first().click();
  const dragOnto = async (name) => {
    const frame = await finder.boundingBox();
    await page.mouse.move(frame.x + 300, frame.y + 10);
    await page.mouse.down();
    await page.mouse.move(frame.x + 100, frame.y + 10, { steps: 6 });
    await page.mouse.move(8 + 300, frame.y + 10, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const item = finder.getByText(name, { exact: true }).first();
    await item.waitFor({ timeout: 8_000 });
    const from = await item.boundingBox();
    const box = await window.boundingBox();
    const moved = await finder.boundingBox();
    const to = { x: (moved.x + moved.width + box.x + box.width) / 2, y: box.y + box.height / 2 };
    const icon = { x: from.x + from.width / 2, y: from.y - 30 };
    await page.mouse.move(icon.x, icon.y);
    await page.mouse.down();
    await page.mouse.move(icon.x + 12, icon.y + 12, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.waitForTimeout(200);
    await page.mouse.up();
  };
  await dragOnto(NOT_OURS);
  await notice.getByText(/is not a file Keychain Access exported/).waitFor({ timeout: 8_000 });
  await page.screenshot({ path: path.join(out, "keychain-import-refused.png") });
  step("a dropped file of another shape is refused, and the window says why", true);
  await closeNotice();
  await page.waitForTimeout(200);
  await dragOnto(DROPPED);
  dialog = page.getByRole("dialog", { name: "Import Items" });
  await dialog.getByText(new RegExp(DROPPED.replace(".", "\\."))).waitFor({ timeout: 8_000 });
  await page.screenshot({ path: path.join(out, "keychain-import-drop.png") });
  await dialog.getByLabel("File Password:").fill(FILE_PASSWORD);
  await dialog.getByRole("button", { name: "Import" }).click();
  await notice.getByText("Imported 0 items. 2 were already in the keychain.").waitFor({
    timeout: 20_000,
  });
  await closeNotice();
  step("importing the same file by a drop adds nothing", (await row("files-alpha").count()) === 1);

  step(
    "no password or name reached the server in the clear",
    !sent.some((body) =>
      [FILE_PASSWORD, PASSWORD, ...Object.keys(ITEMS), ...Object.values(ITEMS)].some((word) =>
        body.includes(word),
      ),
    ),
    `${sent.length} requests with bodies`,
  );

  // Settings. The window comes to the front first, as Finder is in front.
  await openKeychain();
  await page.waitForTimeout(400);
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Change Settings/ }).click();
  dialog = page.getByRole("dialog", { name: /Settings/ });
  await dialog.waitFor({ timeout: 5_000 });
  await dialog.getByRole("checkbox", { name: "Lock after" }).click();
  await dialog.getByLabel("Minutes of inactivity").fill("0");
  step(
    "Save waits for minutes it can use",
    await dialog.getByRole("button", { name: "Save" }).isDisabled(),
  );
  await dialog.getByLabel("Minutes of inactivity").fill("2");
  await dialog.getByRole("checkbox", { name: /Lock when this browser tab/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "keychain-settings.png") });
  const kept = nextSave(page, "/api/system-preferences/settings");
  await dialog.getByRole("button", { name: "Save" }).click();
  await kept;
  await dialog.waitFor({ state: "hidden" });
  await page.waitForTimeout(300);

  await reloadDesktop(page);
  await window.waitFor({ timeout: 15_000 });
  dialog = page.getByRole("dialog", { name: /Unlock/ });
  await dialog.waitFor({ timeout: 10_000 });
  await page.clock.install();
  await dialog.getByLabel("Password:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await page.clock.runFor(100);
  for (let tries = 0; tries < 200 && (await state()) !== "unlocked"; tries += 1) {
    await page.clock.runFor(50);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  step("the password unlocks it after the reload", (await state()) === "unlocked");
  await page.clock.fastForward(60_000);
  step("after one of two minutes it is still open", (await state()) === "unlocked");
  await page.clock.fastForward(61_000);
  await new Promise((resolve) => setTimeout(resolve, 200));
  step("the kept setting locks it after the two minutes", (await state()) === "locked");
  await page.screenshot({ path: path.join(out, "keychain-locked-after-wait.png") });

  await menu(page, "File");
  await page.getByRole("menuitem", { name: /^Unlock Keychain/ }).click();
  await page.clock.runFor(400);
  dialog = page.getByRole("dialog", { name: /Unlock/ });
  await dialog.getByLabel("Password:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  for (let tries = 0; tries < 200 && (await state()) !== "unlocked"; tries += 1) {
    await page.clock.runFor(50);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(100);
  await new Promise((resolve) => setTimeout(resolve, 200));
  step("a hidden tab locks it, with the setting on", (await state()) === "locked");
  await menu(page, "File");
  await page.getByRole("menuitem", { name: /^Unlock Keychain/ }).click();
  await page.clock.runFor(400);
  dialog = page.getByRole("dialog", { name: /Unlock/ });
  await dialog.getByLabel("Password:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Unlock" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  await page.clock.runFor(100);
  await new Promise((resolve) => setTimeout(resolve, 200));
  step("unlocking while the tab stays hidden leaves it locked", (await state()) === "locked");
  await page.evaluate(() => {
    delete document.hidden;
  });

  // The keychain row's menu, on a keychain of the Mac and on "login".
  const keychains = window.getByRole("grid", { name: "Keychains" });
  await keychains.getByText("System", { exact: true }).first().click({ button: "right" });
  await page.clock.runFor(300);
  const dimmed = page.getByRole("menuitem", { name: /^Delete Keychain “System”/ });
  step(
    "another keychain's row menu has nothing it can do",
    (await dimmed.getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");
  await page.clock.runFor(300);
  await keychains.getByText("login", { exact: true }).first().click({ button: "right" });
  await page.clock.runFor(300);
  await page.screenshot({ path: path.join(out, "keychain-row-menu.png") });
  step(
    "the row menu of login offers Unlock while it is locked",
    await page.getByRole("menuitem", { name: /^Unlock Keychain “login”/ }).isVisible(),
  );
  await page.getByRole("menuitem", { name: /^Delete Keychain “login”/ }).click();
  await page.clock.runFor(300);
  dialog = page.getByRole("dialog", { name: /Delete Keychain/ });
  await dialog.waitFor({ timeout: 5_000 });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await page.screenshot({ path: path.join(out, "keychain-delete-keychain.png") });
  const removed = page.waitForResponse(
    (reply) => new URL(reply.url()).pathname === VAULT && reply.request().method() === "DELETE",
  );
  await dialog.getByRole("button", { name: "Delete" }).click();
  await page.clock.runFor(100);
  await removed;
  for (let tries = 0; tries < 100 && (await state()) !== "none"; tries += 1) {
    await page.clock.runFor(100);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  step("Delete Keychain leaves the window with no keychain", (await state()) === "none");
  const after = await page.evaluate((url) => fetch(url).then((reply) => reply.json()), VAULT);
  step("and the server with none", after.vault === null);
});
