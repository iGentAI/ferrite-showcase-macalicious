#!/usr/bin/env node
// Safari on Ferrite: a page whose stylesheet uses a utility framework's escaped class names is styled.
// Reads the real Ars Technica through the app's module; the site may change, so what it checks is the
// site's own rule reaching the page's frame.
//
//   node e2e/safari-styles-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("safari-styles", { ignoreOtherOrigins: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const field = window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  await field.click();
  await field.fill("arstechnica.com");
  await field.press("Enter");
  const frame = window.locator("iframe[srcdoc]");
  await frame.waitFor({ timeout: 30_000 });
  const html = await frame.getAttribute("srcdoc");
  step(
    "the site's main stylesheet, with its escaped class names, reaches the page",
    /\.[a-z-]*\\:[a-z-]/.test(html ?? ""),
  );
  await page.waitForTimeout(1_500);
  await shot(page, path.join(out, "safari-ars-styled.png"));
});

process.exit(0);
