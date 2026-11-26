#!/usr/bin/env node
// The Help menu's search field in each system app that has a Help menu row of its own: the field is there, and Return
// opens Help Viewer on the words. Exits 0 only when every step passed with no console error, page error, failed request
// or HTTP error.
//
//   node e2e/system-apps-help-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";
import { openWithSpotlight } from "./system-kit.mjs";

const APPS = [
  ["System Preferences", "system-preferences"],
  ["Activity Monitor", "activity-monitor"],
  ["Console", "console"],
  ["Keychain Access", "keychain-access"],
  ["System Information", "system-information"],
  ["Storage Management", "storage-management"],
];

await journey("system-apps-help", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  for (const [name, id] of APPS) {
    await openWithSpotlight(page, name);
    await page.locator(`[data-window-id="${id}"]`).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
    if (id === "keychain-access") {
      const first = page.getByRole("dialog", { name: "New Keychain Password" });
      await first.getByLabel("New Password:").fill("help journey words");
      await first.getByLabel("Verify:").fill("help journey words");
      await first.getByRole("button", { name: "Create" }).click();
      await first.waitFor({ state: "hidden", timeout: 20_000 });
    }
    const words = `${id} words`;
    const help = page.getByRole("menubar").getByRole("menuitem", { name: "Help", exact: true });
    await help.click();
    const search = page.getByRole("menu").getByRole("searchbox", { name: "Search" });
    await search.waitFor({ timeout: 5_000 });
    if (id === "system-preferences")
      await page.screenshot({ path: path.join(out, "system-apps-help-menu.png") });
    await search.click();
    await page.keyboard.type(words);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (value) =>
        document.querySelector('.mac-managed-window[data-window-id="help-viewer"] input')?.value ===
        value,
      words,
      { timeout: 8_000 },
    );
    step(`${name}: Help's search field opens Help Viewer on the words`, true);
    await page
      .locator('[data-window-id="help-viewer"]')
      .getByRole("button", { name: /close/i })
      .first()
      .click();
  }
});
