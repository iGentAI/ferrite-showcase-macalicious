#!/usr/bin/env node
// Notification Center's Today: Edit adds, takes away and reorders widgets, all kept across a reload; World Clock and
// Calculator work; Tomorrow's line, the Night Shift switch and the gear.
//
//   node e2e/today-widgets-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("today-widgets");
const tag = Date.now().toString(36);
const TOMORROW = `Dentist ${tag}`;

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
  const panel = page.getByRole("complementary", { name: "Notification Center" });
  const titles = panel.locator(".mac-today-widget-title");
  const open = async () => {
    await page.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
    await panel.waitFor({ timeout: 8_000 });
    await page.getByRole("tab", { name: "Today" }).click();
    await titles.first().waitFor({ timeout: 8_000 });
  };
  const close = async () => {
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached", timeout: 4_000 });
  };
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values ?? {};
  const shownNames = async () =>
    (await titles.allInnerTexts()).map((name) => name.toUpperCase()).join();
  const button = (name) => page.getByRole("button", { name, exact: true });
  const warm = page.locator(".mac-system-preferences-page-warm");

  const saved = await page.evaluate(async (title) => {
    const start = new Date();
    start.setHours(33, 0, 0, 0);
    const reply = await fetch("/api/calendar/events", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            id: "t1",
            title,
            start: start.getTime(),
            end: start.getTime() + 3_600_000,
            calendar: "work",
          },
        ],
        rev: 0,
      }),
    });
    return reply.status;
  }, TOMORROW);
  step("An event of tomorrow is on the calendar", saved < 300, String(saved));

  await open();
  const first = await until(async () => {
    const names = await shownNames();
    return names.includes("STOCKS") ? names : "";
  });
  step(
    "Today starts with five widgets and the Calculator off",
    first === "CALENDAR,REMINDERS,STOCKS,WEATHER,WORLD CLOCK",
    first,
  );
  await until(async () => (await panel.getByText(TOMORROW).count()) > 1);
  step(
    "Tomorrow's line names the first event",
    /You have 1 event tomorrow\. The first is .*at 9:00 AM/.test(await panel.innerText()),
  );
  const zones = await panel.locator(".mac-desktop-shell-today-clocks > li").allInnerTexts();
  step(
    "World Clock has a face for each of four cities, with how far they stand",
    zones.length === 4 &&
      /Tokyo/.test(zones[3]) &&
      zones.every((zone) => /(Today|Tomorrow|Yesterday)/.test(zone)),
    zones.join(" | "),
  );

  await button("Edit").click();
  const available = page.getByRole("region", { name: "Widgets to add" });
  await available.waitFor({ timeout: 4_000 });
  step("Edit offers what is off", await button("Add Calculator").isVisible());
  await button("Add Calculator").click();
  await page.waitForTimeout(150);
  step("Adding one puts it last", (await shownNames()).endsWith("CALCULATOR"), await shownNames());

  await button("Remove Reminders").click();
  await page.waitForTimeout(150);
  step(
    "Removing one offers it to add again",
    (await button("Add Reminders").isVisible()) && !(await shownNames()).includes("REMINDERS"),
  );

  const row = (name) => panel.locator(`.mac-desktop-shell-today-edit-row[aria-label="${name}"]`);
  const from = await row("Calculator").boundingBox();
  const to = await row("Stocks").boundingBox();
  await page.mouse.move(from.x + 60, from.y + 12);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, to.y - 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const dragged = await shownNames();
  step(
    "Dragging a widget moves it",
    dragged === "CALENDAR,CALCULATOR,STOCKS,WEATHER,WORLD CLOCK",
    dragged,
  );
  await shot(page, path.join(out, `today-edit-${browserName}.png`));

  await button("Remove Calculator").focus();
  await page.keyboard.press("Alt+ArrowUp");
  await page.waitForTimeout(150);
  const keyed = await shownNames();
  step(
    "Option-Up moves one too",
    keyed === "CALCULATOR,CALENDAR,STOCKS,WEATHER,WORLD CLOCK",
    keyed,
  );

  step(
    "A widget's contents take no press while editing",
    (await panel.locator(".mac-desktop-shell-today-edit-row [inert]").count()) === 5,
  );
  await button("Done").click();
  step("Done leaves Edit", (await available.count()) === 0 && (await button("Edit").count()) === 1);

  for (const name of ["7", "Multiply", "6", "Equals"]) {
    await panel.getByRole("button", { name, exact: true }).click();
  }
  step(
    "The Calculator widget works a sum out",
    (await panel.locator(".mac-desktop-shell-today-calculator-display").innerText()) === "42",
  );
  await shot(page, path.join(out, `today-widgets-${browserName}.png`));

  await panel.getByRole("switch", { name: /Night Shift/i }).click();
  step("Night Shift warms this page", await until(async () => (await warm.count()) === 1));
  await button("Edit").click();
  await page.getByRole("tab", { name: "Notifications" }).click();
  step("Going to Notifications leaves Edit", (await available.count()) === 0);
  await page.getByRole("tab", { name: "Today" }).click();
  await close();

  step(
    "The choice is kept on the server",
    await until(async () => {
      const values = await stored();
      return (
        values["extensions.todayOrder"]?.slice(0, 2).join() === "calculator,calendar" &&
        values["extensions.todayOff"]?.join() === "reminders"
      );
    }),
    JSON.stringify(await stored()),
  );
  await reloadDesktop(page);
  await open();
  const reloaded = await until(async () => {
    const names = await shownNames();
    return names.includes("STOCKS") ? names : "";
  });
  step(
    "After a reload Today is the same",
    reloaded === "CALCULATOR,CALENDAR,STOCKS,WEATHER,WORLD CLOCK",
    reloaded,
  );
  step("and Night Shift still warms the page", await until(async () => (await warm.count()) === 1));
  await panel.getByRole("switch", { name: /Night Shift/i }).click();
  step("Its switch takes the warmth off", await until(async () => (await warm.count()) === 0));

  await panel.getByRole("button", { name: "Notification Center Preferences" }).click();
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 10_000 });
  step(
    "The gear opens the Notifications pane",
    await until(async () => /Notification Center|Do Not Disturb/.test(await prefs.innerText())),
  );
  step("and the panel closes", await until(async () => (await panel.count()) === 0));
});
