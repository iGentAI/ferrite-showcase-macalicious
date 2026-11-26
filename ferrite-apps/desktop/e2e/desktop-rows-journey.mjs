#!/usr/bin/env node
// The desktop's rows built long ago that nothing drove one by one: the Apple menu, the extras that open
// something, the Dock's tiles and how it keeps them, a window's own moves, and the Dock pane.
//
//   node e2e/desktop-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("desktop-rows");
const SETTINGS = /\/api\/system-preferences\/settings/;

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
  expectRefusal(409, SETTINGS);
  const picture = (name) => shot(page, path.join(out, `desktop-rows-${name}-${browserName}.png`));
  const bar = page.getByRole("menubar").first();
  const extras = page.getByRole("menubar", { name: "Status menus" });
  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const app = (id) => page.locator(`[data-window-id="${id}"]`);
  const menus = page.getByRole("menu");
  const apple = async (row) => {
    await bar.getByRole("menuitem", { name: "Apple" }).click();
    await menus.first().waitFor({ timeout: 4_000 });
    await menus.first().getByRole("menuitem", { name: row }).first().click();
  };
  const closeWindow = async (id) => {
    await app(id).getByRole("button", { name: "Close" }).first().click();
    await until(async () => (await app(id).count()) === 0, 4_000);
  };

  // The Apple menu.
  await apple("About This Mac");
  step("About This Mac opens its window", await until(() => app("about-this-mac").isVisible()));
  await picture("about");
  await closeWindow("about-this-mac");
  await apple("System Preferences…");
  step(
    "System Preferences… opens its window",
    await until(() => app("system-preferences").isVisible()),
  );
  await picture("preferences");
  await closeWindow("system-preferences");
  await apple("App Store…");
  step("App Store… opens its window", await until(() => app("app-store").isVisible()));
  await picture("app-store");
  await closeWindow("app-store");
  await apple("Force Quit…");
  const quitter = page.locator('[data-window-id="force-quit"]');
  step("Force Quit… opens its window", await until(() => quitter.isVisible()));
  await picture("force-quit");
  await closeWindow("force-quit");
  for (const [row, words] of [
    ["Restart…", /restart your computer now/],
    ["Shut Down…", /shut down your computer now/],
  ]) {
    await apple(row);
    const ask = page.getByRole("alertdialog").first();
    await ask.waitFor({ timeout: 5_000 });
    step(`${row} asks first`, words.test(await ask.innerText()));
    if (row === "Shut Down…") await picture("shut-down");
    await ask.getByRole("button", { name: "Cancel" }).click();
    await until(async () => (await ask.count()) === 0, 3_000);
  }
  await apple("Sleep");
  const dark = page.getByRole("img", { name: "Display asleep" });
  step("Sleep puts the display out", await until(() => dark.isVisible()));
  await picture("sleep");
  await page.waitForTimeout(200);
  await page.keyboard.press("Shift");
  step("and a key wakes it", await until(async () => (await dark.count()) === 0));
  const password = page.getByRole("textbox", { name: /password/i });
  if (await password.isVisible().catch(() => false)) {
    step("Waking asks for the password", true);
    await page.reload();
    await openDesktop(page, base, step);
  }

  // The extras that open something.
  await extras.getByRole("menuitem", { name: "Battery" }).first().click();
  step("The Battery extra opens its menu", await until(() => menus.last().isVisible()));
  await picture("battery");
  await page.keyboard.press("Escape");
  await extras.getByRole("menuitem", { name: /Guest/ }).first().click();
  const userMenu = menus.last();
  step(
    "The user extra lists Login Window…",
    await until(() => userMenu.getByRole("menuitem", { name: "Login Window…" }).isVisible()),
  );
  await picture("user");
  await page.keyboard.press("Escape");
  for (const [name, shown] of [
    ["Spotlight", page.getByRole("combobox", { name: "Spotlight Search" })],
    ["Siri", page.getByRole("textbox", { name: "Type to Siri" })],
    ["Notification Center", page.getByRole("tab", { name: "Today" })],
  ]) {
    await extras.getByRole("menuitem", { name, exact: true }).first().click();
    step(`The ${name} extra opens it`, await until(() => shown.isVisible()));
    await picture(`extra-${name.split(" ")[0].toLowerCase()}`);
    await page.keyboard.press("Escape");
    await until(async () => (await shown.count()) === 0, 4_000);
  }

  // The Dock's tiles.
  await tile("Finder").click();
  step("Finder's tile opens a window", await until(() => app("finder").isVisible()));
  await tile("Launchpad").click();
  const launchpad = page.getByRole("dialog", { name: "Launchpad" });
  step("Launchpad's tile opens it", await until(() => launchpad.isVisible()));
  await picture("launchpad");
  await page.keyboard.press("Escape");
  await until(async () => (await launchpad.count()) === 0, 4_000);
  const dotted = (name) =>
    tile(name).evaluate(
      (button) =>
        button.hasAttribute("data-running") || button.querySelector("[data-running]") !== null,
    );
  const dotBefore = await dotted("Calculator");
  await tile("Calculator").click();
  await app("calculator").waitFor({ timeout: 8_000 });
  step(
    "A tile shows a dot while its application runs",
    !dotBefore && (await until(() => dotted("Calculator"))),
  );
  await tile("Calculator").hover();
  await page.waitForTimeout(400);
  await picture("tile-label");
  await page.mouse.move(600, 400);

  // Stacking, moving, resizing, zooming, Full Screen.
  await app("finder")
    .locator(".mac-title-bar")
    .first()
    .click({ position: { x: 200, y: 10 } });
  const front = (id) => app(id).evaluate((one) => Number(getComputedStyle(one).zIndex));
  step(
    "A press brings a window to the front",
    (await front("finder")) > (await front("calculator")),
  );
  const barBox = await app("finder").locator(".mac-title-bar").first().boundingBox();
  await page.mouse.move(barBox.x + 200, barBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(barBox.x + 260, barBox.y + 50, { steps: 6 });
  await page.mouse.up();
  const moved = await app("finder").boundingBox();
  step("A window moves by its title bar", moved.x === barBox.x + 60, `${moved.x}, ${moved.y}`);
  for (const [edge, dx, dy, grew] of [
    ["s", 0, -20, (a, b) => b.height === a.height - 20 && b.width === a.width],
    ["sw", 20, -10, (a, b) => b.width === a.width - 20 && b.height === a.height - 10],
    ["w", 20, 0, (a, b) => b.width === a.width - 20 && b.height === a.height],
    ["n", 0, 10, (a, b) => b.height === a.height - 10 && b.width === a.width],
    ["ne", -20, 10, (a, b) => b.width === a.width - 20 && b.height === a.height - 10],
    ["e", 20, 0, (a, b) => b.width === a.width + 20 && b.height === a.height],
    ["nw", -20, -10, (a, b) => b.width === a.width + 20 && b.height === a.height + 10],
    ["se", 30, 30, (a, b) => b.width === a.width + 30 && b.height === a.height + 30],
  ]) {
    const before = await app("finder").boundingBox();
    const handle = await app("finder").locator(`[data-edge="${edge}"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + dx, handle.y + handle.height / 2 + dy, {
      steps: 5,
    });
    await page.mouse.up();
    step(`The ${edge} edge resizes`, grew(before, await app("finder").boundingBox()));
  }
  await app("finder").getByRole("button", { name: "Minimize" }).first().click();
  const minimized = dock.getByRole("button", { name: /minimized window/ });
  step(
    "Minimized, a window has a tile of its own",
    await until(() => minimized.first().isVisible()),
  );
  await picture("minimized");
  await minimized.first().click();
  step(
    "and the tile brings it back",
    await until(() => app("finder").evaluate((element) => !element.hasAttribute("data-minimized"))),
  );
  await tile("Calculator").click();
  await page.keyboard.press("Control+KeyQ");
  step(
    "⌘Q quits the front application, and its dot goes",
    await until(
      async () => (await app("calculator").count()) === 0 && !(await dotted("Calculator")),
    ),
  );

  // What the Dock keeps.
  await tile("Chess").click({ button: "right" });
  await menus.last().getByRole("menuitem", { name: "Options" }).click();
  await page.getByRole("menuitem", { name: "Remove from Dock", exact: true }).click();
  step(
    "Remove from Dock takes the tile away",
    await until(async () => (await tile("Chess").count()) === 0),
  );
  const order = () =>
    dock.getByRole("button").evaluateAll((all) => all.map((one) => one.getAttribute("aria-label")));
  const safari = await tile("Safari").boundingBox();
  const maps = await tile("Maps").boundingBox();
  const orderBefore = await order();
  await page.mouse.move(safari.x + safari.width / 2, safari.y + safari.height / 2);
  await page.mouse.down();
  await page.mouse.move(safari.x + safari.width / 2 + 8, safari.y + safari.height / 2 - 4, {
    steps: 3,
  });
  await page.mouse.move(maps.x + maps.width + 2, maps.y + maps.height / 2, { steps: 10 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  const reordered = await until(async () => {
    const now = await order();
    return now.indexOf("Safari") > orderBefore.indexOf("Safari");
  });
  step("A tile drags along the Dock", reordered);
  const contacts = await tile("Contacts").boundingBox();
  await page.mouse.move(contacts.x + contacts.width / 2, contacts.y + contacts.height / 2);
  await page.mouse.down();
  await page.mouse.move(contacts.x + contacts.width / 2, contacts.y - 20, { steps: 4 });
  await page.mouse.move(contacts.x + contacts.width / 2, contacts.y - 240, { steps: 10 });
  await page.waitForTimeout(1_200);
  await page.mouse.up();
  step(
    "Dragged out, a tile leaves the Dock",
    await until(async () => (await tile("Contacts").count()) === 0),
  );
  await picture("dock-changed");
  await page.waitForTimeout(1_500);
  const kept = await order();
  await page.reload();
  await tile("Finder").waitFor({ timeout: 30_000 });
  step(
    "All of it is there after a reload",
    (await tile("Chess").count()) === 0 &&
      (await tile("Contacts").count()) === 0 &&
      (await order()).indexOf("Safari") === kept.indexOf("Safari"),
  );

  // The Dock pane.
  await dock.getByRole("separator").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /Dock Preferences/ }).click();
  const pane = app("system-preferences");
  await pane.waitFor({ timeout: 10_000 });
  await pane.getByRole("radio", { name: "Left" }).click();
  step(
    "The Dock pane moves the Dock",
    await until(async () => {
      const box = await dock.boundingBox();
      return box.x < 50 && box.height > box.width;
    }),
  );
  await picture("dock-left");
  await pane.getByRole("radio", { name: "Bottom" }).click();
});
