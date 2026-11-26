#!/usr/bin/env node
// Hide and Hide Others on a served desktop: windows go at once, with no animation and no tile of their own in the Dock,
// a window the person minimized stays apart, and the application's tile, Show All and a reload each behave as on a Mac.
// Nothing is simulated. Exits 0 only when every step passed with no console error, page error, failed request or HTTP
// error.
//
//   node e2e/desktop-hide-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

await journey("desktop-hide", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const bar = page.getByRole("menubar").first();
  const choose = async (menu, item) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).click();
  };
  const until = async (check, ms = 5_000) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = await check();
      if (value || Date.now() > end) return value;
      await page.waitForTimeout(80);
    }
  };
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const windowOf = (id) => page.locator(`[data-window-id="${id}"]`);
  const open = async (name, id) => {
    await tile(name).click();
    await windowOf(id).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
  };
  const gone = (id) =>
    windowOf(id).evaluate((shell) => {
      const frame = shell.firstElementChild;
      return (
        shell.hasAttribute("data-minimized") && getComputedStyle(frame).visibility === "hidden"
      );
    });
  const shown = (id) => windowOf(id).evaluate((shell) => !shell.hasAttribute("data-minimized"));
  const ownTiles = () => dock.getByRole("button", { name: /minimized window/ }).count();

  await open("Console", "console");
  await open("Maps", "maps");
  await choose("File", "New Window");
  await windowOf("maps:2").waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
  await choose("Maps", "Hide Maps");
  // A minimized window is still visible for 0.28 seconds of its animation.
  step("Hide: both windows go at once", (await gone("maps")) && (await gone("maps:2")));
  step("with no tile of their own in the Dock", (await ownTiles()) === 0);
  await page.screenshot({ path: path.join(out, "desktop-hidden.png") });
  step(
    "Console is in front",
    await until(
      async () => (await bar.getByRole("menuitem", { name: "Console", exact: true }).count()) === 1,
    ),
  );
  await page.waitForTimeout(600);

  await reloadDesktop(page);
  await windowOf("console").waitFor({ timeout: 15_000 });
  await until(async () => (await windowOf("maps").count()) === 1, 15_000);
  step(
    "a reload keeps them hidden, with no tile",
    await until(
      async () => (await gone("maps")) && (await gone("maps:2")) && (await ownTiles()) === 0,
    ),
  );

  await tile("Maps").click();
  step(
    "the application's tile brings both back",
    await until(async () => (await shown("maps")) && (await shown("maps:2"))),
  );
  await page.waitForTimeout(500);

  // Hide Others, against a window the person minimized.
  await tile("Console").click();
  await page.waitForTimeout(400);
  await windowOf("console").getByRole("button", { name: "Minimize" }).first().click();
  await until(async () => (await ownTiles()) === 1);
  step("a window the person minimizes has its tile", (await ownTiles()) === 1);
  await tile("Calculator").click();
  await windowOf("calculator").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await choose("Calculator", "Hide Others");
  step(
    "Hide Others: the others go, and the application in front stays",
    (await gone("maps")) && (await gone("maps:2")) && (await shown("calculator")),
  );
  step("the minimized window keeps its tile", (await ownTiles()) === 1);
  await page.screenshot({ path: path.join(out, "desktop-hide-others.png") });
  await choose("Calculator", "Show All");
  step(
    "Show All brings back what was hidden",
    await until(async () => (await shown("maps")) && (await shown("maps:2"))),
  );
  step(
    "and not what the person minimized",
    (await windowOf("console").evaluate((shell) => shell.hasAttribute("data-minimized"))) &&
      (await ownTiles()) === 1,
  );
});
