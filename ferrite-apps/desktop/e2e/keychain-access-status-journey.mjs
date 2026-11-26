#!/usr/bin/env node
// Keychain Access's Preferences and the keychain menu in the menu bar: the setting shows the menu and is kept across a reload,
// the padlock and the rows follow the window that holds the key, Lock Keychain locks that window, and the setting takes the
// menu away again. Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/keychain-access-status-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const PASSWORD = "journey horse battery";

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("keychain-access-status", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const openKeychain = () =>
    page
      .getByRole("button", { name: /^Keychain Access$/ })
      .first()
      .click();
  await openKeychain();
  const window = page.locator("[data-keychain-state]").first();
  await window.waitFor({ timeout: 10_000 });
  const dialog = page.getByRole("dialog", { name: "New Keychain Password" });
  await dialog.getByLabel("New Password:").fill(PASSWORD);
  await dialog.getByLabel("Verify:").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });

  const extra = (state) => page.getByRole("menuitem", { name: `Keychain, ${state}`, exact: true });
  step("the menu bar has no keychain menu to begin with", (await extra("unlocked").count()) === 0);

  await menu(page, "Keychain Access");
  await page.getByRole("menuitem", { name: /^Preferences/ }).click();
  const shown = page.getByRole("checkbox", { name: "Show keychain status in menu bar" });
  await shown.waitFor({ timeout: 5_000 });
  const reset = page.getByRole("button", { name: "Reset My Default Keychains" });
  step(
    "Reset My Default Keychains is dimmed and says why",
    (await reset.isDisabled()) && /Delete Keychain/.test((await reset.getAttribute("title")) ?? ""),
  );
  const saved = nextSave(page, "/api/system-preferences/settings");
  await shown.click();
  await extra("unlocked").waitFor({ timeout: 5_000 });
  step("Show keychain status in menu bar brings the menu, unlocked with the keychain", true);
  await page.waitForTimeout(400);
  const prefsBox = await shown.boundingBox();
  const windowBox = await page
    .getByRole("button", { name: "Reset My Default Keychains" })
    .boundingBox();
  step(
    "the window's controls are in view, one under the other",
    prefsBox !== null && windowBox !== null && prefsBox.y < windowBox.y && prefsBox.height > 0,
    JSON.stringify({ prefsBox, windowBox }),
  );
  await page.screenshot({ path: path.join(out, "keychain-preferences.png") });
  await page
    .getByRole("button", { name: /close/i })
    .last()
    .click()
    .catch(() => {});

  await extra("unlocked").click();
  await page.screenshot({ path: path.join(out, "keychain-status-menu.png") });
  await page.getByRole("menuitem", { name: "Lock Keychain “login”" }).click();
  await extra("locked").waitFor({ timeout: 5_000 });
  step(
    "the menu's Lock Keychain locks the window, and the padlock closes",
    (await window.getAttribute("data-keychain-state")) === "locked",
  );

  await saved;
  await reloadDesktop(page);
  await extra("locked").waitFor({ timeout: 10_000 });
  step("the menu is still there after a reload, and the keychain is locked", true);
  await extra("locked").click();
  step(
    "the locked menu says so, and has nothing to lock",
    await page.getByRole("menuitem", { name: "Keychain “login” is locked" }).isDisabled(),
  );
  await page.getByRole("menuitem", { name: "Open Keychain Access" }).click();
  await page.locator("[data-keychain-state]").first().waitFor({ timeout: 10_000 });
  step("Open Keychain Access opens the window", true);
  await page.screenshot({ path: path.join(out, "keychain-status-after-reload.png") });

  const unlock = page.getByRole("dialog");
  if (
    await unlock
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await page.keyboard.press("Escape");
    await unlock
      .first()
      .waitFor({ state: "hidden", timeout: 5_000 })
      .catch(() => {});
  }
  await page
    .locator("[data-keychain-state]")
    .first()
    .click({ position: { x: 300, y: 10 } });
  await menu(page, "Keychain Access");
  await page.getByRole("menuitem", { name: /^Preferences/ }).click();
  await shown.click();
  await extra("locked").waitFor({ state: "detached", timeout: 5_000 });
  step("turning the setting off takes the menu away", true);
});
