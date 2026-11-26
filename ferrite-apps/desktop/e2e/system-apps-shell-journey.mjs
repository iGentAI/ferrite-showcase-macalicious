#!/usr/bin/env node
// What the desktop gives each system app in its menus, on a served desktop: About, Hide, Hide Others and Show All, Minimize
// and the Dock bringing it back, Zoom, Enter Full Screen where View lists it, Bring All to Front, the Window menu's list,
// Close Window, Quit, and Command-M, Command-H, Command-W and Command-Q. Exits 0 only when every step passed with no console
// error, page error, failed request or HTTP error.
//
//   node e2e/system-apps-shell-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";
import { openWithSpotlight } from "./system-kit.mjs";

const KEYCHAIN_PASSWORD = "shell journey words";

/** Keychain Access asks for a new password on first use, and to unlock each time it opens after a close. */
async function answerKeychain(page) {
  const create = page.getByRole("dialog", { name: "New Keychain Password" });
  const unlock = page.getByRole("dialog", { name: /Unlock/ });
  if (await create.isVisible()) {
    await create.getByLabel("New Password:").fill(KEYCHAIN_PASSWORD);
    await create.getByLabel("Verify:").fill(KEYCHAIN_PASSWORD);
    await create.getByRole("button", { name: "Create" }).click();
    await create.waitFor({ state: "hidden", timeout: 20_000 });
  } else if (await unlock.isVisible()) {
    await unlock.getByLabel("Password:").fill(KEYCHAIN_PASSWORD);
    await unlock.getByRole("button", { name: "Unlock" }).click();
    await unlock.waitFor({ state: "hidden", timeout: 20_000 });
  }
}

const APPS = [
  { id: "activity-monitor", name: "Activity Monitor", fullScreen: true },
  { id: "console", name: "Console", fullScreen: true },
  { id: "keychain-access", name: "Keychain Access", fullScreen: true },
  { id: "storage-management", name: "Storage Management", fullScreen: false },
  { id: "system-information", name: "System Information", fullScreen: false },
];

await journey("system-apps-shell", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const bar = page.getByRole("menubar");
  const openMenu = async (title) => {
    const item = bar.getByRole("menuitem", { name: title, exact: true });
    await item.click();
    await page.waitForTimeout(150);
    if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
  };
  const choose = async (title, row) => {
    await openMenu(title);
    await page.getByRole("menuitem", { name: row }).first().click();
    await page.waitForTimeout(450);
  };
  const state = (locator) => locator.locator("[data-window-state]").first();

  await page
    .getByRole("button", { name: /^Calculator$/ })
    .first()
    .click();
  const calculator = page.locator('[data-window-id="calculator"]');
  await calculator.waitFor({ timeout: 10_000 });

  for (const { id, name, fullScreen } of APPS) {
    const open = async () => {
      await openWithSpotlight(page, name);
      await page.locator(`[data-window-id="${id}"]`).waitFor({ timeout: 10_000 });
      await page.waitForTimeout(400);
      if (id === "keychain-access") await answerKeychain(page);
    };
    await open();
    const window = page.locator(`[data-window-id="${id}"]`);
    const shown = () => state(window).isVisible();
    const shot = (what) => page.screenshot({ path: path.join(out, `shell-${id}-${what}.png`) });

    await choose(name, new RegExp(`^About ${name}$`));
    const about = page.locator(`.mac-desktop-shell-about[data-app="${id}"]`);
    await about.waitFor({ timeout: 3_000 });
    await shot("about");
    step(`${name}: About shows its window`, (await about.innerText()).includes(name));
    const title = about.locator(".mac-about-window-title").first();
    step(
      `${name}: About shows the whole name`,
      await title.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    );
    await about.getByRole("button", { name: /close/i }).first().click();
    await about.waitFor({ state: "detached" });

    await calculator.waitFor();
    if (!(await state(calculator).isVisible())) {
      await choose(name, "Show All");
    }
    await choose(name, new RegExp(`^Hide ${name}`));
    step(`${name}: Hide takes its window away`, !(await shown()));
    const frontMenu = await bar.getByRole("menuitem").nth(1).innerText();
    await choose(frontMenu, "Show All");
    step(`${name}: Show All brings it back`, await shown(), `from ${frontMenu}'s menu`);

    await open();
    await choose(name, "Hide Others");
    step(
      `${name}: Hide Others takes the other app's window away`,
      !(await state(calculator).isVisible()),
    );
    await choose(name, "Show All");
    step(`${name}: Show All brings the other app back`, await state(calculator).isVisible());

    await open();
    await openMenu("Window");
    const listed = await page
      .getByRole("menu")
      .getByRole("menuitem", { name: "Bring All to Front" })
      .count();
    const windowRow = await page.getByRole("menu").getByRole("menuitemcheckbox").allInnerTexts();
    await shot("window-menu");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    step(`${name}: Window lists Bring All to Front`, listed === 1);
    step(
      `${name}: Window lists its window`,
      windowRow.some((text) => text.includes(name)),
      windowRow.join(" | "),
    );

    await choose("Window", "Minimize");
    await shot("minimized");
    step(`${name}: Window > Minimize takes it to the Dock`, !(await shown()));
    await page
      .getByRole("button", { name: /, minimized window$/ })
      .first()
      .click();
    await page.waitForTimeout(500);
    step(`${name}: its Dock tile brings it back`, await shown());

    const before = await window.boundingBox();
    await choose("Window", "Zoom");
    const zoomed = await window.boundingBox();
    await shot("zoomed");
    step(
      `${name}: Zoom changes its frame`,
      zoomed.width !== before.width || zoomed.height !== before.height,
      `${before.width}x${before.height} to ${zoomed.width}x${zoomed.height}`,
    );
    await choose("Window", "Zoom");

    if (fullScreen) {
      await choose("View", "Enter Full Screen");
      await page.waitForTimeout(700);
      const full = await window.boundingBox();
      step(`${name}: Enter Full Screen fills the screen`, full.width === 1440, `${full.width}`);
      await shot("full-screen");
      await page.mouse.move(700, 0);
      await page.waitForTimeout(500);
      await choose("View", "Exit Full Screen");
      await page.waitForTimeout(700);
    }

    await page.keyboard.press("Control+m");
    await page.waitForTimeout(500);
    step(`${name}: Command-M minimizes it`, !(await shown()));
    await open();
    await page.keyboard.press("Control+h");
    await page.waitForTimeout(500);
    step(`${name}: Command-H hides it`, !(await shown()));
    await open();

    await openMenu("File");
    await shot("file-menu");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await choose("File", "Close Window");
    await window.waitFor({ state: "detached", timeout: 5_000 });
    step(`${name}: File > Close Window closes it`, true);
    await open();
    await page.keyboard.press("Control+w");
    await window.waitFor({ state: "detached", timeout: 5_000 });
    step(`${name}: Command-W closes it`, true);
    await open();
    await openMenu(name);
    await page.waitForTimeout(300);
    await shot("app-menu");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await choose(name, new RegExp(`^Quit ${name}`));
    await window.waitFor({ state: "detached", timeout: 5_000 });
    step(`${name}: Quit ends it`, true);
    await open();
    await page.keyboard.press("Control+q");
    await window.waitFor({ state: "detached", timeout: 5_000 });
    await page.waitForTimeout(300);
    await shot("after-command-q");
    step(`${name}: Command-Q ends it`, true);
  }

  // Two Finder windows with Calculator between them: what Bring All to Front and the window list do can be seen.
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .click();
  const editors = page.locator('.mac-managed-window[data-window-id^="finder"]');
  await editors.first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await choose("File", /^New Finder Window/);
  await page.waitForFunction(
    () => document.querySelectorAll('.mac-managed-window[data-window-id^="finder"]').length === 2,
    null,
    { timeout: 5_000 },
  );
  const zOf = (locator) =>
    locator.evaluate((node) => {
      for (let at = node; at; at = at.parentElement) {
        const z = getComputedStyle(at).zIndex;
        if (z !== "auto") return Number(z);
      }
      return 0;
    });
  const older = editors.last();
  const newer = editors.first();
  await page
    .getByRole("button", { name: /^Calculator$/ })
    .first()
    .click();
  await page.waitForTimeout(300);
  // The Dock brings Finder's first window forward, and leaves the other where it stood.
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .click();
  await page.waitForTimeout(300);
  step(
    "Finder has a window behind Calculator and one in front of it",
    (await zOf(older)) < (await zOf(calculator)) && (await zOf(calculator)) < (await zOf(newer)),
  );
  await page.screenshot({ path: path.join(out, "shell-bring-all-before.png") });
  await choose("Window", "Bring All to Front");
  await page.screenshot({ path: path.join(out, "shell-bring-all-after.png") });
  step(
    "Bring All to Front puts both in front of Calculator, the key one frontmost",
    (await zOf(calculator)) < (await zOf(older)) && (await zOf(older)) < (await zOf(newer)),
  );
  await openMenu("Window");
  const entries = page.getByRole("menu").getByRole("menuitemcheckbox");
  step("the Window menu lists both", (await entries.count()) === 2);
  await page.screenshot({ path: path.join(out, "shell-window-list.png") });
  const unchecked = page
    .getByRole("menu")
    .locator('[role="menuitemcheckbox"][aria-checked="false"]');
  await unchecked.click();
  await page.waitForTimeout(400);
  step(
    "choosing the other brings it to the front, key",
    (await zOf(older)) > (await zOf(newer)) &&
      (await older.locator("[data-window-state]").first().getAttribute("data-window-state")) ===
        "key",
  );
});
