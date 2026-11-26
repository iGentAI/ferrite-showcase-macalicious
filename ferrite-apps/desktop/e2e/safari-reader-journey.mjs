#!/usr/bin/env node
// Safari's Reader on Ferrite: size, background and typeface on a real article, kept across a reload.
//
//   node e2e/safari-reader-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { reloadDesktop } from "./journey-kit.mjs";

const { base, out } = options();
const { step, run } = journey("safari-reader", { ignoreOtherOrigins: true });
const ARTICLE = "https://en.wikipedia.org/wiki/MacOS_Catalina";
const fieldOf = (window) =>
  window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();

await run(async (page) => {
  await openDesktop(page, base, step);
  const open = async () => {
    await launch(page, "Safari");
    const window = page.getByRole("region", { name: "Safari", exact: true }).first();
    await window.waitFor({ state: "visible", timeout: 15_000 });
    return window;
  };
  let window = await open();
  await fieldOf(window).fill(ARTICLE);
  await page.keyboard.press("Enter");
  const reader = () => window.getByRole("button", { name: "Show Reader View" });
  await reader().waitFor({ timeout: 25_000 });
  await reader().click();
  const article = window.getByRole("article");
  await article.waitFor({ timeout: 5_000 });
  const before = await article.evaluate((el) => getComputedStyle(el).fontSize);
  await window.getByRole("button", { name: "Change Reader text size" }).click();
  const options_ = page.locator(".mac-safari-reader-options");
  await options_.waitFor({ timeout: 5_000 });
  await options_.getByRole("button", { name: "Larger" }).click();
  await page.waitForTimeout(200);
  step(
    "Larger makes the text larger",
    (await page
      .locator("article")
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize)) !== before,
  );
  await options_.getByRole("button", { name: "Sepia" }).click();
  await options_.getByRole("combobox", { name: "Typeface" }).click();
  await page.getByRole("option", { name: "Georgia", exact: true }).click();
  await page.waitForTimeout(400);
  const look = () =>
    page
      .locator('[role="article"], article')
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return `${style.backgroundColor} ${style.fontFamily}`;
      });
  const chosen = await look();
  step(
    "Sepia and Georgia change the article",
    /Georgia/.test(chosen) && chosen.includes("248, 241, 227"),
    chosen,
  );
  await shot(page, path.join(out, "safari-reader.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2_500);
  await reloadDesktop(page);
  window = await open();
  await reader().waitFor({ timeout: 25_000 });
  await reader().click();
  await article.waitFor({ timeout: 5_000 });
  const kept = await look();
  step("they are kept across a reload", kept === chosen, kept);
});

process.exit(0);
