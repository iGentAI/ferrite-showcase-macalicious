#!/usr/bin/env node
// What the desktop gives each media and web app in its menus, on a served desktop: About, Hide, Hide
// Others and Show All, Minimize and the Dock bringing it back, Zoom, Enter Full Screen, Bring All to
// Front, the Window menu's list, Close Window, Quit, and Command-M, Command-H, Command-W and Command-Q.
// One screenshot of each app's own menu with its About window, and one of its Window menu.
//
//   node e2e/media-shell-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--only music,tv]

import path from "node:path";
import { journey, openDesktop, options } from "./app-journey.mjs";
import { openWithSpotlight } from "./system-kit.mjs";

const LIBRARY = "/api/app-store/library";
const APPS = [
  { id: "music", name: "Music" },
  { id: "safari", name: "Safari" },
  { id: "podcasts", name: "Podcasts" },
  { id: "tv", name: "TV" },
  { id: "news", name: "News" },
  { id: "maps", name: "Maps" },
  { id: "stocks", name: "Stocks" },
  { id: "find-my", name: "Find My" },
  { id: "app-store", name: "App Store", fileMenu: null, viewMenu: false },
  { id: "chess", name: "Chess", fileMenu: "Game" },
];
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt >= 0 ? process.argv[onlyAt + 1]?.split(",") : null;

const { base, out } = options();
const { step, run, expectRefusal } = journey("media-shell", { ignoreOtherOrigins: true });

// Stocks reads CNBC through the server, which answers 502 when CNBC does not: not what this checks.
for (let answer = 0; answer < 40; answer += 1) {
  for (const route of ["quotes", "chart", "news"]) expectRefusal(502, `/api/stocks/${route}`);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const installed = await page.evaluate(async (url) => {
    const held = await (await fetch(url, { credentials: "same-origin" })).json();
    const response = await fetch(url, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        installed: [...new Set([...(held.installed ?? []), "find-my", "stocks"])],
        rev: held.rev,
      }),
    });
    return response.status;
  }, LIBRARY);
  step("every app of this lane is installed", installed < 300, String(installed));
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 20_000 });

  const bar = page.getByRole("menubar").first();
  const openMenu = async (title) => {
    const item = bar.getByRole("menuitem", { name: title, exact: true });
    await item.click();
    await page.waitForTimeout(150);
    if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
  };
  const choose = async (title, row) => {
    await openMenu(title);
    await page.getByRole("menu").getByRole("menuitem", { name: row }).first().click();
    await page.waitForTimeout(450);
  };
  const state = (locator) => locator.locator("[data-window-state]").first();

  await page
    .getByRole("button", { name: /^Calculator$/ })
    .first()
    .click();
  const calculator = page.locator('[data-window-id="calculator"]');
  await calculator.waitFor({ timeout: 10_000 });

  for (const { id, name, fileMenu = "File", viewMenu = true } of APPS) {
    if (only && !only.includes(id)) continue;
    const window = page.locator(`[data-window-id="${id}"], [data-window-id^="${id}-"]`).first();
    const open = async () => {
      await openWithSpotlight(page, name);
      await window.waitFor({ timeout: 15_000 });
      await page.waitForTimeout(500);
    };
    await open();
    const shown = () => state(window).isVisible();
    const shot = (what) => page.screenshot({ path: path.join(out, `shell-${id}-${what}.png`) });

    await choose(name, new RegExp(`^About ${name}$`));
    const about = page.locator(`.mac-desktop-shell-about[data-app="${id}"]`);
    await about.waitFor({ timeout: 3_000 });
    step(`${name}: About shows its window`, (await about.innerText()).includes(name));
    await openMenu(name);
    await page.waitForTimeout(350);
    await shot("app-menu");
    const appRows = await page.getByRole("menu").getByRole("menuitem").allInnerTexts();
    step(
      `${name}: its menu lists Hide, Hide Others, Show All and Quit`,
      [`Hide ${name}`, "Hide Others", "Show All", `Quit ${name}`].every((row) =>
        appRows.some((text) => text.includes(row)),
      ),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    await about.getByRole("button", { name: /close/i }).first().click();
    await about.waitFor({ state: "detached" });

    if (!(await state(calculator).isVisible())) await choose(name, "Show All");
    await choose(name, new RegExp(`^Hide ${name}`));
    step(`${name}: Hide takes its window away`, !(await shown()));
    const frontMenu = await bar.getByRole("menuitem").nth(1).innerText();
    await choose(frontMenu, "Show All");
    step(`${name}: Show All brings it back`, await shown(), `from ${frontMenu}'s menu`);

    await open();
    await choose(name, "Hide Others");
    step(`${name}: Hide Others takes the other app away`, !(await state(calculator).isVisible()));
    await choose(name, "Show All");
    step(`${name}: Show All brings the other app back`, await state(calculator).isVisible());

    await open();
    await openMenu("Window");
    await page.waitForTimeout(350);
    const bringAll = await page
      .getByRole("menu")
      .getByRole("menuitem", { name: "Bring All to Front" })
      .count();
    const windowRows = await page.getByRole("menu").getByRole("menuitemcheckbox").allInnerTexts();
    await shot("window-menu");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    step(`${name}: Window lists Bring All to Front`, bringAll === 1);
    step(
      `${name}: Window lists its window`,
      windowRows.length > 0 && !windowRows.some((text) => text.includes("Calculator")),
      windowRows.join(" | ").slice(0, 80),
    );
    await choose("Window", "Bring All to Front");
    step(
      `${name}: Bring All to Front leaves it key`,
      (await state(window).getAttribute("data-window-state")) === "key",
    );

    await choose("Window", "Minimize");
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
    step(
      `${name}: Zoom changes its frame`,
      zoomed.width !== before.width || zoomed.height !== before.height,
      `${before.width}x${before.height} to ${zoomed.width}x${zoomed.height}`,
    );
    await choose("Window", "Zoom");

    if (viewMenu) {
      await choose("View", "Enter Full Screen");
      await page.waitForTimeout(700);
      const full = await window.boundingBox();
      step(`${name}: Enter Full Screen fills the screen`, full.width === 1440, `${full.width}`);
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

    if (fileMenu) {
      await choose(fileMenu, "Close Window");
      await window.waitFor({ state: "detached", timeout: 5_000 });
      step(`${name}: ${fileMenu} > Close Window closes it`, true);
    }
    await open();
    await page.keyboard.press("Control+w");
    await window.waitFor({ state: "detached", timeout: 5_000 });
    step(`${name}: Command-W closes it`, true);
    await open();
    await choose(name, new RegExp(`^Quit ${name}`));
    await window.waitFor({ state: "detached", timeout: 5_000 });
    step(`${name}: Quit ends it`, true);
    await open();
    await page.keyboard.press("Control+q");
    await window.waitFor({ state: "detached", timeout: 5_000 });
    await page.waitForTimeout(300);
    step(`${name}: Command-Q ends it`, true);
  }
});
