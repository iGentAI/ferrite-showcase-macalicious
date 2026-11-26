#!/usr/bin/env node
// Displays on a served desktop, row by row: the window is titled for this screen, the facts are what the browser
// reports (the viewport's change is followed), and the page says what it cannot do for each row a browser cannot
// honour: Resolution, automatic brightness, True Tone, Color, AirPlay Display, mirroring, the display's name.
// None of the captured Mac's controls show. Exits 0 only when every step passed with no console error, page error,
// failed request or HTTP error.
//
//   node e2e/sp-displays-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

await journey("sp-displays-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 10_000 });
  await prefs.getByRole("button", { name: "Show All" }).click();
  await prefs
    .getByRole("button", { name: /^Displays/ })
    .first()
    .click();
  await prefs.getByRole("slider", { name: "Brightness of this page" }).waitFor({ timeout: 8_000 });

  const shown = await prefs.innerText();
  const fact = async (label) =>
    (
      await prefs
        .locator("dl > div", { hasText: `${label}:` })
        .locator("dd")
        .innerText()
    ).trim();
  const browser = await page.evaluate(() => ({
    size: `${screen.width} × ${screen.height} points`,
    avail: `${screen.availWidth} × ${screen.availHeight} points`,
    ratio: `${devicePixelRatio || 1}×`,
    depth: `${screen.colorDepth}-bit`,
    range: ["rec2020", "p3", "srgb"].find((gamut) => matchMedia(`(color-gamut: ${gamut})`).matches),
    hdr: matchMedia("(dynamic-range: high)").matches
      ? "Yes"
      : matchMedia("(dynamic-range: standard)").matches
        ? "No"
        : "Not reported by this browser",
    extended: screen.isExtended,
  }));
  step("Size is the browser's", (await fact("Size")) === browser.size, await fact("Size"));
  step(
    "Available to windows is the browser's",
    (await fact("Available to windows")) === browser.avail,
    await fact("Available to windows"),
  );
  step("Pixel ratio is the browser's", (await fact("Pixel ratio")) === browser.ratio);
  step("Color depth is the browser's", (await fact("Color depth")) === browser.depth);
  const range = { rec2020: "Rec. 2020", p3: "Display P3", srgb: "sRGB" }[browser.range];
  step(
    "Color range is what the media query says",
    (await fact("Color range")) === (range ?? "Not reported by this browser"),
    await fact("Color range"),
  );
  step(
    "High dynamic range is what the media query says",
    (await fact("High dynamic range")) === browser.hdr,
  );
  step(
    "Other screens is what the browser says",
    (await fact("Other screens")) ===
      (browser.extended === undefined
        ? "Not reported by this browser"
        : browser.extended
          ? "At least one is connected"
          : "None"),
    await fact("Other screens"),
  );

  await page.setViewportSize({ width: 1300, height: 860 });
  await page.waitForTimeout(300);
  step(
    "This browser window follows the viewport",
    (await fact("This browser window")) === "1300 × 860 points",
    await fact("This browser window"),
  );

  for (const [row, words] of [
    ["Resolution", /cannot change the resolution/],
    ["Brightness of the display", /cannot change the resolution, brightness/],
    ["Color tab", /colour profile/],
    ["Automatic brightness", /automatic brightness/],
    ["True Tone", /True Tone/],
    ["AirPlay Display", /AirPlay/],
    ["Mirroring in menu bar", /mirroring/],
    ["Display title and picture", /learn the display's name/],
  ])
    step(`the page says why it does not offer ${row}`, words.test(shown));
  step("the controls say they act on this page", /dim and warm this page only/.test(shown));

  const captured = await prefs
    .getByRole("radio", { name: /Default for display|Scaled/ })
    .or(prefs.getByRole("checkbox", { name: /True Tone|Automatically adjust|mirroring/ }))
    .or(prefs.getByRole("tab", { name: "Color" }))
    .count();
  step("none of the captured Mac's controls show", captured === 0, `${captured} found`);
  step("the window is titled for this screen, not a model", !/Retina/.test(shown));
  const title = await prefs.locator(".mac-title-bar").first().innerText();
  step("the title bar says This Screen", /This Screen/.test(title), title);
  await page.screenshot({ path: path.join(out, "sp-displays-rows.png") });
});
