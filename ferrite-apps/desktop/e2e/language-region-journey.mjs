#!/usr/bin/env node
// Language & Region on a served desktop: the list is the browser's languages, and Calendar's week begins
// on the First day of week chosen, in a person who has saved no Calendar preferences of their own.
// Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/language-region-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

const dock = (page, name) =>
  page
    .getByRole("button", { name: new RegExp(`^${name}$`) })
    .first()
    .click();

await journey("language-region", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  await dock(page, "Calendar");
  const calendar = page.locator('[data-window-id="calendar"]');
  await calendar.waitFor({ timeout: 10_000 });
  const first = calendar.locator(".mac-calendar-week-grid-day").first();
  await first.waitFor({ timeout: 10_000 });
  step("Calendar's week begins on Sunday at first", (await first.innerText()).startsWith("Sun"));

  await dock(page, "System Preferences");
  const window = page.locator('[data-window-id="system-preferences"]');
  await window.waitFor({ timeout: 10_000 });
  const list = window.getByRole("listbox", { name: "Preferred languages:" });
  const pane = window.getByRole("button", { name: /^Language & Region/ }).first();
  await list.or(pane).first().waitFor({ timeout: 10_000 });
  if ((await list.count()) === 0) await pane.click();
  await list.waitFor();
  const rows = await list.getByRole("option").allInnerTexts();
  const wanted = await page.evaluate(() => navigator.languages.length);
  step(
    "the list is the browser's languages, its first the primary one",
    rows.length === wanted && rows[0].includes("Primary"),
    rows.join(" | ").replace(/\s+/g, " "),
  );
  await window.getByRole("combobox", { name: "First day of week:" }).click();
  await page.getByRole("option", { name: "Monday", exact: true }).click();
  await page.screenshot({ path: path.join(out, "language-region.png") });
  await page.waitForTimeout(400);
  step("Calendar's open window follows at once", (await first.innerText()).startsWith("Mon"));
  await page.screenshot({ path: path.join(out, "language-region-calendar.png") });

  await window.getByRole("combobox", { name: "First day of week:" }).click();
  await page.getByRole("option", { name: "Sunday", exact: true }).click();
  await page.waitForTimeout(700);
  step("and back", (await first.innerText()).startsWith("Sun"));
});
