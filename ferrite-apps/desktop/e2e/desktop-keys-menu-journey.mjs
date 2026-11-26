#!/usr/bin/env node
// The desktop's own keys and menu, with real input, on the signed-in person's drive: Select All,
// Copy and Paste, Duplicate and Get Info on icons, a Paste with no window open, and Use Stacks with
// Group Stacks By, which is kept for the account. Changes to the drive are read back from the server.
//
//   node e2e/desktop-keys-menu-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("desktop-keys-menu");
const tag = Date.now().toString(36);
const NOTE = `Key note ${tag}.txt`;
const OTHER = `Key other ${tag}.txt`;
const OLD = `Key older ${tag}.txt`;

const onDesktop = async (page) =>
  ((await api(page, "GET", "/api/files/")).json.entries ?? []).filter(
    (each) => each.parent === "desktop" && each.trashed_ms === undefined,
  );
const named = async (page, text) =>
  (await onDesktop(page)).filter((each) => each.name.includes(text)).length;

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const focusNowhere = (page) =>
  page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "desktop", name: NOTE, type: "text/plain", text: NOTE });
  await uploadFile(page, { parent: "desktop", name: OTHER, type: "text/plain", text: OTHER });
  await page.reload();
  await openDesktop(page, base, step);

  const desk = page.getByRole("group", { name: "Desktop", exact: true });
  const icon = (name) => desk.locator(".mac-desktop-icon", { hasText: name }).first();
  const pressed = async (name) => (await icon(name).getAttribute("aria-pressed")) === "true";
  await icon(NOTE).waitFor({ timeout: 10_000 });

  await focusNowhere(page);
  await page.keyboard.press("Control+A");
  step(
    "Command-A with no window selects every icon",
    await until(async () => (await pressed(NOTE)) && (await pressed(OTHER))),
  );

  await icon(NOTE).click();
  await page.keyboard.press("Control+D");
  step(
    "Command-D on an icon duplicates it, on the server",
    await until(async () => (await named(page, "Key note")) === 2),
  );

  await icon(OTHER).click();
  await page.keyboard.press("Control+C");
  await focusNowhere(page);
  await page.keyboard.press("Control+V");
  step(
    "Command-C then Command-V with no window pastes a copy on the desktop, on the server",
    await until(async () => (await named(page, "Key other")) === 2),
  );

  const picture = async () => {
    // A point nothing is drawn over: windows opened earlier stay open across a reload.
    const point = await page.evaluate(() => {
      const root = document.querySelector(".mac-desktop-shell-desktop");
      const { width, height } = root.getBoundingClientRect();
      for (let y = height - 100; y > 40; y -= 40) {
        for (let x = 24; x < width; x += 40) {
          if (document.elementFromPoint(x, y) === root) return { x, y };
        }
      }
      throw new Error("The windows cover the whole desktop");
    });
    await page.mouse.click(point.x, point.y, { button: "right" });
    const menu = page.getByRole("menu").last();
    await menu.waitFor({ timeout: 5_000 });
    return menu;
  };
  const menu = await picture();
  step(
    "The picture's menu has Paste Item, Get Info and a dimmed Group Stacks By",
    (await menu.getByRole("menuitem", { name: "Paste Item" }).count()) === 1 &&
      (await menu.getByRole("menuitem", { name: "Get Info" }).count()) === 1 &&
      (await menu
        .getByRole("menuitem", { name: "Group Stacks By" })
        .getAttribute("aria-disabled")) === "true",
  );
  await shot(page, path.join(out, `desktop-menu-${browserName}.png`));
  await menu.getByRole("menuitemcheckbox", { name: /Use Stacks/ }).click();
  const stack = (name) => desk.locator(".mac-desktop-stack", { hasText: name }).first();
  step("Use Stacks gathers the text files", await until(() => stack("Documents").isVisible()));

  await (await picture()).getByRole("menuitem", { name: "Group Stacks By" }).click();
  await page.getByRole("menuitemradio", { name: "Date Created" }).click();
  step(
    "Group Stacks By Date Created puts new files under Today",
    await until(() => stack("Today").isVisible()),
  );
  await shot(page, path.join(out, `desktop-stacks-by-date-${browserName}.png`));

  await page.reload();
  await openDesktop(page, base, step);
  step(
    "Both choices are there after a reload",
    await until(() => stack("Today").isVisible(), 10_000),
  );

  await focusNowhere(page);
  await page.keyboard.press("Control+Alt+0");
  await icon(OTHER).waitFor({ timeout: 8_000 });
  step("The key turns Use Stacks off", (await desk.locator(".mac-desktop-stack").count()) === 0);

  await icon(OTHER).click();
  await page.keyboard.press("Control+I");
  const info = page.locator(".mac-finder-info, [aria-label*='Info']").first();
  step("Command-I opens the icon's Info", await until(() => info.isVisible(), 10_000));
  await shot(page, path.join(out, `desktop-icon-info-${browserName}.png`));

  // An older file moved onto the desktop, seen from 40 days later: Date Created says Earlier, and
  // Date Added says it arrived today.
  const made = await uploadFile(page, {
    parent: "documents",
    name: OLD,
    type: "text/plain",
    text: OLD,
  });
  await page.clock.setFixedTime(Date.now() + 40 * 86_400_000);
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "move", id: made, parent: "desktop" }],
  });
  await page.reload();
  await openDesktop(page, base, step);
  await focusNowhere(page);
  await page.keyboard.press("Control+Alt+0");
  const stackHolding = async (name) => {
    await stack(name).click();
    return until(() => page.getByText(OLD, { exact: true }).first().isVisible(), 3_000);
  };
  const groupBy = async (label) => {
    await (await picture()).getByRole("menuitem", { name: "Group Stacks By" }).click();
    await page.getByRole("menuitemradio", { name: label }).click();
  };
  await stack("Earlier").waitFor({ timeout: 10_000 });
  step("Under Date Created the older file is under Earlier", await stackHolding("Earlier"));
  await stack("Earlier").click();
  await groupBy("Date Added");
  await stack("Today").waitFor({ timeout: 10_000 });
  step("Under Date Added it is under Today, when it arrived", await stackHolding("Today"));
  await shot(page, path.join(out, `desktop-stacks-by-added-${browserName}.png`));
});
