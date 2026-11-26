#!/usr/bin/env node
// TextEdit's Format > Lists…: a style and a start for the selected paragraphs, seen in the page's own
// markers, and kept across a reload.
//
//   node e2e/textedit-lists-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-lists");

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await text.click();
  await page.keyboard.type("first\nsecond\nthird");
  await page.keyboard.press("Control+A");
  await page.getByRole("menubar").getByRole("menuitem", { name: "Format", exact: true }).click();
  await page.waitForTimeout(300);
  await page
    .getByRole("menuitem", { name: /^Lists/ })
    .last()
    .click();
  const sheet = page.getByRole("dialog", { name: "List" });
  await sheet.waitFor();
  const start = sheet.getByLabel("Start at:");
  step("Start at is dimmed for a list that does not count", await start.isDisabled());
  await sheet.getByLabel("Bullets & Numbering:").click();
  await page.getByRole("option", { name: "I. II. III.", exact: true }).click();
  await start.fill("4");
  await shot(page, path.join(out, "textedit-lists-sheet.png"));
  await sheet.getByRole("button", { name: "OK" }).click();
  await sheet.waitFor({ state: "detached" });
  const marks = () =>
    text.evaluate((node) =>
      [...node.children].map((each) => ({
        type: getComputedStyle(each).listStyleType,
        start: each.dataset.listStart ?? null,
      })),
    );
  const shown = await marks();
  step(
    "the paragraphs are upper-roman, from IV",
    shown.length === 3 &&
      shown.every((each) => each.type === "upper-roman") &&
      shown[0].start === "4",
  );
  await shot(page, path.join(out, "textedit-lists.png"));
  // Return after the first paragraph: the new one goes on counting, from V.
  await text.locator("> div").first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("added");
  const split = await marks();
  step(
    "Return makes a paragraph that goes on counting",
    split.length === 4 && split[0].start === "4" && split[1].start === null,
  );
  await page.waitForTimeout(1_800);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  const kept = await marks();
  step(
    "they are the same after a reload",
    kept[0]?.type === "upper-roman" && kept[0]?.start === "4" && kept[1]?.start === null,
  );
});
