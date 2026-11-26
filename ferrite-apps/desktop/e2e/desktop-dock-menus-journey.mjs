#!/usr/bin/env node
// The Dock's menus and what comes back with the desktop, on the signed-in person's desktop: a tile's
// windows, Options, Hide and Quit, Option's Force Quit, Finder's tile, Recent Folders; the windows
// return after a reload where they were, hidden ones still hidden; an app set to open at login
// opens in a new tab and not on a reload.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/desktop-dock-menus-journey.mjs [--url http://127.0.0.1:3020] [--out dir]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("desktop-dock-menus");

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const row = (name) => page.getByRole("menuitem", { name, exact: true });
  const menuOf = async (name) => {
    await until(async () => (await page.getByRole("menu").count()) === 0, 3_000);
    await tile(name).click({ button: "right" });
    await row("Options").or(row("New Finder Window")).first().waitFor({ timeout: 5_000 });
  };
  const frontName = async () =>
    (await page.getByRole("menubar").first().getByRole("menuitem").nth(1).innerText()).trim();

  await launch(page, "Chess");
  await until(async () => (await frontName()) === "Chess");
  await launch(page, "TextEdit");
  await until(async () => (await frontName()) === "TextEdit");

  await menuOf("Chess");
  const rows = await page.getByRole("menu").getByRole("menuitem").allInnerTexts();
  step(
    "A running app's tile lists its window, Options, Hide and Quit",
    ["Chess", "Options", "Hide", "Quit"].every((name) => rows.includes(name)),
    rows.join(", "),
  );
  await shot(page, path.join(out, `dock-menu-tile-${browserName}.png`));
  await row("Chess").click();
  step(
    "Its window row brings the window forward",
    await until(async () => (await frontName()) === "Chess"),
  );

  await menuOf("TextEdit");
  await page.keyboard.down("Alt");
  await row("Force Quit").waitFor({ timeout: 3_000 });
  await shot(page, path.join(out, `dock-menu-force-quit-${browserName}.png`));
  await page.keyboard.up("Alt");
  await row("Quit").click();
  step(
    "Quit closes the app, whose dot goes",
    await until(async () => (await tile("TextEdit").getAttribute("data-running")) === null),
  );

  await menuOf("Chess");
  await row("Options").click();
  await page.getByRole("menuitemcheckbox", { name: "Open at Login", exact: true }).click();
  await until(async () => (await page.getByRole("menu").count()) === 0, 3_000);

  await menuOf("Chess");
  await row("Hide").click();
  const chess = page.locator('[data-window-id="chess"]');
  const chessHidden = () =>
    chess.evaluate(
      (shell) =>
        shell.hasAttribute("data-minimized") &&
        getComputedStyle(shell.firstElementChild).visibility === "hidden",
    );
  const ownTiles = () => dock.getByRole("button", { name: /minimized window/ }).count();
  step(
    "Hide puts its window away, with no tile of its own in the Dock",
    await until(async () => (await chessHidden()) && (await ownTiles()) === 0),
  );

  // Finder's tile.
  await menuOf("Finder");
  await shot(page, path.join(out, `dock-menu-finder-${browserName}.png`));
  await row("New Finder Window").click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 8_000 });
  step(
    "Finder's tile opens a new window",
    (await page.locator(".mac-window.mac-finder").count()) === 1,
  );
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await finder.getByRole("treeitem", { name: "Downloads", exact: true }).click();
  await menuOf("Finder");
  await row("Recent Folders").click();
  const recent = row("Documents");
  await recent.waitFor({ timeout: 4_000 });
  await shot(page, path.join(out, `dock-menu-recent-${browserName}.png`));
  await recent.click();
  step(
    "Recent Folders in its menu goes back to a folder",
    await until(
      async () =>
        (await finder
          .getByRole("treeitem", { name: "Documents", exact: true })
          .getAttribute("aria-selected")) === "true",
    ),
  );
  await menuOf("Finder");
  await row("Go to Folder…").click();
  step(
    "Go to Folder in its menu opens the sheet",
    await page
      .getByRole("combobox")
      .or(page.getByPlaceholder(/./))
      .first()
      .waitFor({ timeout: 4_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await page.keyboard.press("Escape");

  // Windows come back.
  const box = await finder.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + 50, { steps: 6 });
  await page.mouse.up();
  const moved = await finder.boundingBox();
  await page.reload();
  await openDesktop(page, base, step);
  const back = page.locator(".mac-window.mac-finder").first();
  await back.waitFor({ timeout: 10_000 });
  const after = await back.boundingBox();
  step(
    "Finder's window is back where it was after a reload",
    Math.abs(after.x - moved.x) < 2 && Math.abs(after.y - moved.y) < 2,
    JSON.stringify({ moved, after }),
  );
  step(
    "The hidden window stays hidden after a reload, with no tile",
    await until(
      async () => (await chess.count()) === 1 && (await chessHidden()) && (await ownTiles()) === 0,
      15_000,
    ),
  );
  await shot(page, path.join(out, `dock-menu-restored-${browserName}.png`));

  // Close it all: on a reload nothing opens, in a new tab the login item does.
  await menuOf("Chess");
  await row("Show").click();
  await until(async () => (await frontName()) === "Chess");
  await menuOf("Chess");
  await row("Quit").click();
  await until(async () => (await tile("Chess").getAttribute("data-running")) === null);
  await page.reload();
  await openDesktop(page, base, step);
  await back.waitFor({ timeout: 10_000 });
  step(
    "A reload does not count as a login: Chess stays closed",
    (await tile("Chess").getAttribute("data-running")) === null,
  );
  const second = await page.context().newPage();
  await openDesktop(second, base, step);
  const secondDock = second.getByRole("toolbar", { name: "Dock" });
  step(
    "A new session opens the login item",
    await until(
      async () =>
        (await secondDock
          .getByRole("button", { name: "Chess", exact: true })
          .getAttribute("data-running")) !== null,
    ),
  );
  await second.close();
});
