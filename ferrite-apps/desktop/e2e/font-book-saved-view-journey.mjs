#!/usr/bin/env node
// Font Book as the window was left: its view, custom text, size and collection come back after a reload.
//
//   node e2e/font-book-saved-view-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("font-book-saved-view");
const WORDS = `Kept words ${Date.now()}`;

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Font Book");
  const window = page.locator('[data-window-id="font-book"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await page.getByRole("menubar").getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /^Custom/ }).click();
  await page.waitForTimeout(300);
  const custom = window.locator("textarea").first();
  await custom.fill(WORDS);
  await window.getByText("Fixed Width", { exact: true }).click();
  const size = window.getByRole("combobox", { name: /size/i }).first();
  await size.fill("48");
  await size.press("Enter");
  // No wait: a reload straight after a change keeps it.
  await reloadDesktop(page);
  await launch(page, "Font Book");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await custom.waitFor({ state: "visible", timeout: 10_000 });
  step("the Custom view comes back with its text", (await custom.inputValue()) === WORDS);
  step("at the size it had", (await size.inputValue()).startsWith("48"), await size.inputValue());
  step(
    "in the collection it had",
    (await window
      .getByRole("treeitem", { name: /Fixed Width/ })
      .first()
      .getAttribute("aria-selected")) === "true",
  );
  await shot(page, path.join(out, "font-book-saved-view.png"));

  const long = `${"café long text ".repeat(600)}end`;
  await custom.fill(long);
  await reloadDesktop(page);
  await launch(page, "Font Book");
  await custom.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    (wanted) => document.querySelector('[data-window-id="font-book"] textarea')?.value === wanted,
    long,
    { timeout: 10_000 },
  );
  step("a custom text over one setting's size comes back whole", true, `${long.length} characters`);
});
