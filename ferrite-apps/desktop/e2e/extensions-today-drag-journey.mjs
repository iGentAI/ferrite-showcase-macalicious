#!/usr/bin/env node
// A drag in System Preferences > Extensions > Today carried past several rows and let go outside the list: the row lands last,
// nothing stays dragged, and the order is the same after a reload. Exits 0 only when every step passed with no console error,
// page error, failed request or HTTP error.
//
//   node e2e/extensions-today-drag-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

await journey("extensions-today-drag", async ({ page, base, step }) => {
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const rows = prefs.locator(".mac-system-preferences-extensions-today > li");
  const openList = async () => {
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
  const names = async () => (await rows.allInnerTexts()).map((text) => text.trim());

  await openList();
  const before = await names();
  const first = before[0];
  const box = await rows.first().boundingBox();
  const saved = nextSave(page, "/api/system-preferences/settings");
  await page.mouse.move(box.x + 200, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 400, { steps: 20 });
  await page.mouse.up();
  await saved;
  const after = await names();
  step(
    "the first row, carried past the others and let go outside the list, lands last",
    after.at(-1) === first && after.length === before.length,
    after.join(),
  );
  step(
    "no row stays dragged",
    (await prefs
      .locator(".mac-system-preferences-extensions-today > li[data-dragging]")
      .count()) === 0,
  );

  await reloadDesktop(page);
  await openList();
  step("the order is the same after a reload", (await names()).join() === after.join());
});
