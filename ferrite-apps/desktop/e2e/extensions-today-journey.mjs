#!/usr/bin/env node
// System Preferences > Extensions > Today and Notification Center's Today: dragging a row moves its widget, the checkbox takes
// one away, Option-Up moves one with the keyboard, and all of it holds across a reload. Exits 0 only when every step passed
// with no console error, page error, failed request or HTTP error.
//
//   node e2e/extensions-today-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const NAMES = ["Calendar", "Reminders", "Stocks", "Weather", "World Clock", "Calculator"];
const STARTING = NAMES.slice(0, 5);

await journey("extensions-today", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const rows = prefs.locator(".mac-system-preferences-extensions-today > li");
  const openPane = async () => {
    await page
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    if ((await prefs.getByRole("listbox", { name: "Extension categories" }).count()) === 0)
      await prefs.getByRole("button", { name: "Extensions", exact: true }).first().click();
    await prefs
      .getByRole("listbox", { name: "Extension categories" })
      .getByRole("option", { name: /^Today/ })
      .click();
    await rows.first().waitFor({ timeout: 8_000 });
  };
  const listed = async () => (await rows.allInnerTexts()).map((text) => text.trim());
  const panelOrder = async (expected) => {
    await page.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
    await page.getByRole("tab", { name: "Today" }).click();
    const panel = page.getByRole("complementary", { name: "Notification Center" });
    for (const name of expected)
      await panel.getByText(name, { exact: true }).first().waitFor({ timeout: 10_000 });
    const seen = [];
    for (const name of NAMES) {
      const title = panel.getByText(name, { exact: true }).first();
      if ((await title.count()) > 0) seen.push([(await title.boundingBox()).y, name]);
    }
    await page.screenshot({ path: path.join(out, `today-${seen.length}.png`) });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    return seen.sort((a, b) => a[0] - b[0]).map(([, name]) => name);
  };

  await openPane();
  step("the list holds Notification Center's widgets", (await listed()).join() === NAMES.join());
  step(
    "the first order leaves the Calculator off",
    (await panelOrder(STARTING)).join() === STARTING.join(),
  );

  await openPane();
  let saved = nextSave(page, SETTINGS);
  const box = await rows.nth(2).boundingBox();
  await page.mouse.move(box.x + 200, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y - 40, { steps: 8 });
  await page.mouse.up();
  await saved;
  step("dragging Stocks to the top moves it", (await listed())[0] === "Stocks");

  saved = nextSave(page, SETTINGS);
  await rows.nth(2).getByRole("checkbox").click();
  await saved;
  step("Reminders' checkbox turns it off", !(await rows.nth(2).getByRole("checkbox").isChecked()));

  saved = nextSave(page, SETTINGS);
  await rows.nth(1).getByRole("checkbox").focus();
  await page.keyboard.press("Alt+ArrowUp");
  await saved;
  step(
    "Option-Up moves a row",
    (await listed()).join() === "Calendar,Stocks,Reminders,Weather,World Clock,Calculator",
    (await listed()).join(),
  );
  await page.screenshot({ path: path.join(out, "extensions-today.png") });

  const shown = await panelOrder(["Calendar", "Stocks"]);
  step(
    "Notification Center follows, in that order, without the one turned off",
    shown.join() === "Calendar,Stocks,Weather,World Clock",
    shown.join(),
  );

  await reloadDesktop(page);
  await openPane();
  step(
    "the list is the same after a reload",
    (await listed()).join() === "Calendar,Stocks,Reminders,Weather,World Clock,Calculator",
  );
  step(
    "Reminders is still off, and the category says what is on",
    !(await rows.nth(2).getByRole("checkbox").isChecked()) &&
      /Calendar, Stocks/.test(await prefs.getByRole("option", { name: /^Today/ }).innerText()),
  );
  const after = await panelOrder(["Calendar", "Stocks"]);
  step(
    "Notification Center too",
    after.join() === "Calendar,Stocks,Weather,World Clock",
    after.join(),
  );
});
