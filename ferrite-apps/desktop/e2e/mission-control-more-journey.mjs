#!/usr/bin/env node
// Mission Control's settings and Space: Group windows by application, the Space bar's look at a window,
// and the Hot Corners that open an overview.
//
//   node e2e/mission-control-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("mission-control-more");

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
  const front = async () =>
    (await page.getByRole("menubar").first().getByRole("menuitem").nth(1).innerText()).trim();
  const overview = page.getByRole("dialog", { name: "Mission Control" });
  const shell = (id) => page.locator(`[data-window-id="${id}"]`);
  const thumb = (id) => overview.locator(`[data-mission-window="${id}"]`);
  const scaleOf = (id) =>
    shell(id).evaluate((element) => {
      const { scale } = getComputedStyle(element);
      return scale === "none" ? 1 : Number(scale);
    });
  // The settings, through System Preferences as a person changes them.
  const stored = async (key) =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[key];
  const pane = async () => {
    await launch(page, "System Preferences");
    const prefs = page.locator(".mac-system-preferences").first();
    await prefs.waitFor({ timeout: 10_000 });
    const all = prefs.getByRole("button", { name: "Show All" });
    if (await all.isEnabled()) await all.click();
    await prefs.getByRole("button", { name: "Mission Control", exact: true }).first().click();
    await prefs.getByRole("checkbox", { name: "Group windows by application" }).waitFor();
    return prefs;
  };
  const leave = async (prefs) => {
    await prefs.getByRole("button", { name: "Close" }).first().click();
    await prefs.waitFor({ state: "detached", timeout: 5_000 });
    await page.waitForTimeout(300);
  };
  const groupWindows = async (checked) => {
    const prefs = await pane();
    await prefs.getByRole("checkbox", { name: "Group windows by application" }).setChecked(checked);
    const saved = await until(
      async () => (await stored("mission-control.groupByApplication")) === checked,
    );
    await leave(prefs);
    return saved;
  };
  const setCorners = async (actions) => {
    const prefs = await pane();
    await prefs.getByRole("button", { name: "Hot Corners…" }).click();
    const sheet = prefs.getByRole("dialog", { name: "Active Screen Corners" });
    for (const [corner, action] of Object.entries(actions)) {
      const choice = sheet.getByRole("combobox", { name: corner });
      await choice.click();
      await page.waitForTimeout(300);
      await page
        .getByRole("listbox")
        .filter({ visible: true })
        .last()
        .getByRole("option", { name: action, exact: true })
        .click({ force: true });
      await until(async () => (await choice.innerText()).includes(action));
      await page.waitForTimeout(200);
    }
    await sheet.getByRole("button", { name: "OK" }).click();
    const key = (corner) =>
      `mission-control.hotCorner.${corner.replace(/ (.)/, (_, letter) => letter.toUpperCase()).replace(/^./, (letter) => letter.toLowerCase())}`;
    const saved = await until(async () => {
      const { values } = (await api(page, "GET", "/api/system-preferences/settings")).json;
      return Object.entries(actions).every(([corner, action]) => values?.[key(corner)] === action);
    });
    await leave(prefs);
    return saved;
  };
  const close = async () => {
    await page.keyboard.press("Escape");
    await overview.waitFor({ state: "detached", timeout: 4_000 });
    await page.waitForTimeout(400);
  };

  await launch(page, "Finder");
  await page.locator(".mac-window.mac-finder").first().waitFor({ timeout: 8_000 });
  await launch(page, "Chess");
  await until(async () => (await front()) === "Chess");
  await launch(page, "Finder");
  await until(async () => (await front()) === "Finder");
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "File", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "New Finder Window" }).click();
  await until(async () => (await page.locator(".mac-window.mac-finder").count()) === 2);
  await launch(page, "Chess");
  await until(async () => (await front()) === "Chess");

  // Space shows the window under the pointer.
  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(500);
  const small = await scaleOf("chess");
  await thumb("chess").hover();
  await page.keyboard.press("Space");
  step(
    "Space shows the window under the pointer larger",
    await until(async () => (await scaleOf("chess")) > small + 0.05),
    `${small} to ${await scaleOf("chess")}`,
  );
  await page.waitForTimeout(350);
  const whole = await shell("chess").boundingBox();
  const under = await overview.locator(".mac-mission-control-area").boundingBox();
  step(
    "whole, under the Spaces bar",
    whole.y >= under.y - 1 &&
      whole.y + whole.height <= under.y + under.height + 1 &&
      whole.x >= under.x - 1 &&
      whole.x + whole.width <= under.x + under.width + 1,
    JSON.stringify({ whole, under }),
  );
  await shot(page, path.join(out, `mission-control-peek-${browserName}.png`));
  step("and Mission Control stays", await overview.isVisible());
  await page.keyboard.press("Space");
  step(
    "Space again puts it back",
    await until(async () => Math.abs((await scaleOf("chess")) - small) < 0.01),
  );
  step("without choosing it", await overview.isVisible());

  // Held down, Space does it once.
  await thumb("chess").hover();
  await page.keyboard.down("Space");
  const opened = await until(async () => (await scaleOf("chess")) > small + 0.05);
  const whileHeld = [];
  for (let repeat = 0; repeat < 3; repeat += 1) {
    await page.keyboard.down("Space");
    // Longer than the window takes to go back, were this repeat to put it back.
    await page.waitForTimeout(350);
    whileHeld.push(await scaleOf("chess"));
  }
  await page.keyboard.up("Space");
  step(
    "Space held down shows the window once, and it stays through every repeat",
    opened && whileHeld.every((scale) => scale > small + 0.05),
    whileHeld.join(", "),
  );
  await page.keyboard.press("Space");
  await until(async () => Math.abs((await scaleOf("chess")) - small) < 0.01);

  // Space on a button of the bar is the button's.
  const bar = overview.getByRole("group", { name: "Spaces" });
  await bar.getByRole("button", { name: "Add Desktop" }).focus();
  await page.keyboard.press("Space");
  await bar.getByRole("button", { name: "Desktop 2", exact: true }).waitFor({ timeout: 4_000 });
  step("Space on Add Desktop adds a Desktop", true);
  await bar.getByRole("button", { name: "Desktop 2", exact: true }).hover();
  await bar.getByRole("button", { name: "Remove Desktop 2" }).click();
  await bar.getByRole("button", { name: "Desktop 2", exact: true }).waitFor({
    state: "detached",
    timeout: 4_000,
  });
  await close();

  // Grouped by application.
  const ids = await page
    .locator("[data-window-id]:not([data-minimized])")
    .evaluateAll((all) => all.map((each) => each.dataset.windowId));
  step("Group windows by application in System Preferences is saved", await groupWindows(true));
  await reloadDesktop(page);
  await page.waitForTimeout(800);
  await page.keyboard.press("F3");
  await overview.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(500);
  const order = await overview.locator("[data-mission-window]").evaluateAll((all) =>
    all
      .map((each) => ({
        id: each.dataset.missionWindow,
        x: each.getBoundingClientRect().x,
        y: each.getBoundingClientRect().y,
      }))
      .sort((a, b) => Math.round(a.y / 40) - Math.round(b.y / 40) || a.x - b.x)
      .map(({ id }) => id),
  );
  const finders = order.flatMap((id, at) => (id.startsWith("finder") ? [at] : []));
  step(
    "Group windows by application puts one application's windows side by side",
    order.length === ids.length && finders.length === 2 && finders[1] - finders[0] === 1,
    JSON.stringify(order),
  );
  const named = await overview
    .locator("[data-group-name]")
    .evaluateAll((all) => all.map((each) => getComputedStyle(each, "::after").content));
  step(
    "with each application's name, not a window's",
    JSON.stringify(named) === JSON.stringify(['"Finder"', '"Chess"']) ||
      JSON.stringify(named) === JSON.stringify(['"Chess"', '"Finder"']),
    named.join(", "),
  );
  await shot(page, path.join(out, `mission-control-grouped-${browserName}.png`));
  await close();

  // Hot Corners.
  step("Turning it off in System Preferences is saved", await groupWindows(false));

  // The shortcuts.
  {
    const prefs = await pane();
    const rearrange = prefs.getByRole("checkbox", {
      name: "Automatically rearrange Spaces based on most recent use",
    });
    step(
      "Rearranging Spaces, which the desktop does not do, is dimmed and off, and says why",
      (await rearrange.isDisabled()) &&
        !(await rearrange.isChecked()) &&
        (await rearrange.getAttribute("title")) !== null,
    );
    const switching = prefs.getByRole("checkbox", {
      name: "When switching to an application, switch to a Space with open windows for the application",
    });
    step(
      "Going to the application's Space, which it always does, is dimmed and on",
      (await switching.isDisabled()) && (await switching.isChecked()),
    );
    await prefs.getByRole("combobox", { name: "Application windows:", exact: true }).click();
    await page.waitForTimeout(300);
    const f3 = page
      .getByRole("listbox")
      .filter({ visible: true })
      .last()
      .getByRole("option", { name: "F3", exact: true });
    step(
      "F3, which always opens Mission Control, cannot be chosen for another",
      (await f3.getAttribute("aria-disabled")) === "true" ||
        (await f3.getAttribute("data-disabled")) !== null,
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const menu = prefs.getByRole("combobox", { name: "Mission Control:", exact: true });
    await menu.click();
    await page.waitForTimeout(300);
    await page
      .getByRole("listbox")
      .filter({ visible: true })
      .last()
      .getByRole("option", { name: "F6", exact: true })
      .click({ force: true });
    await until(async () => (await stored("mission-control.missionControl")) === "F6");
    await page.waitForTimeout(300);
    await leave(prefs);
    await page.keyboard.press("Control+ArrowUp");
    await page.waitForTimeout(400);
    step("The shortcut replaced does nothing", (await overview.count()) === 0);
    await page.keyboard.press("F6");
    await overview.waitFor({ timeout: 4_000 });
    step("The shortcut chosen opens Mission Control", await overview.isVisible());
    await close();
    await reloadDesktop(page);
    await page.waitForTimeout(800);
    await page.keyboard.press("F6");
    await overview.waitFor({ timeout: 4_000 });
    step("and still does after a reload", await overview.isVisible());
    await close();
  }
  step(
    "Active Screen Corners in System Preferences saves each corner's choice",
    await setCorners({
      "Bottom left": "Mission Control",
      "Bottom right": "Application Windows",
      "Top right": "Desktop",
    }),
  );
  await reloadDesktop(page);
  await page.waitForTimeout(800);
  const { innerWidth: width, innerHeight: height } = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
  await page.mouse.move(400, 400);
  await page.mouse.move(0, height - 1);
  await overview.waitFor({ timeout: 4_000 });
  step("A Hot Corner opens Mission Control", await overview.isVisible());
  await page.mouse.move(400, 400);
  await close();

  const frontName = (await front()).toLowerCase();
  await page.mouse.move(width - 1, height - 1);
  await overview.waitFor({ timeout: 4_000 });
  await page.waitForTimeout(400);
  const exposed = await overview
    .locator("[data-mission-window]")
    .evaluateAll((all) => all.map((each) => each.dataset.missionWindow));
  const expected = ids.filter((id) => id.split(":")[0] === frontName);
  step(
    "A Hot Corner opens the front application's windows, and no others",
    expected.length > 0 &&
      expected.length < ids.length &&
      JSON.stringify([...exposed].sort()) === JSON.stringify([...expected].sort()),
    `${frontName}: ${exposed.join(", ")}`,
  );
  await page.mouse.move(400, 400);
  await close();

  await page.mouse.move(width - 1, 0);
  step(
    "A Hot Corner shows the desktop",
    await until(async () => (await shell("chess").getAttribute("data-mission-control")) === "away"),
  );
  await page.mouse.move(400, 400);
  await page.mouse.move(width - 1, 0);
  step(
    "and brings the windows back",
    await until(async () => (await shell("chess").getAttribute("data-mission-control")) === null),
  );
  await page.mouse.move(400, 400);
  await page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Launchpad", exact: true })
    .click();
  await page.locator(".mac-launchpad-item").first().waitFor({ timeout: 4_000 });
  await page.mouse.move(width - 1, 0);
  step(
    "The Desktop corner closes Launchpad and shows the desktop",
    await until(
      async () =>
        (await page.locator(".mac-launchpad-item").count()) === 0 &&
        (await shell("chess").getAttribute("data-mission-control")) === "away",
    ),
  );
  await page.mouse.move(400, 400);
  await page.mouse.move(width - 1, 0);
  await until(async () => (await shell("chess").getAttribute("data-mission-control")) === null);
  await page.mouse.move(400, 400);
  step(
    "A corner set back to nothing is saved",
    await setCorners({ "Bottom left": "–", "Bottom right": "–", "Top right": "–" }),
  );
  await page.mouse.move(400, 400);
  await page.mouse.move(0, height - 1);
  await page.waitForTimeout(500);
  step("and does nothing", (await overview.count()) === 0);
});
