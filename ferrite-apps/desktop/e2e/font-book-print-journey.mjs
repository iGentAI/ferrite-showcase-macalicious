#!/usr/bin/env node
// Font Book's File > Print and View > Show Toolbar on the desktop, and the custom text's context menu.
//
//   node e2e/font-book-print-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("font-book-print");

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Font Book");
  const window = page.locator('[data-window-id="font-book"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  const bar = page.getByRole("menubar");
  const choose = async (menu, row) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.waitForTimeout(200);
    await page.getByRole("menuitem", { name: row }).click();
    await page.waitForTimeout(300);
  };
  await page.evaluate(() => {
    new MutationObserver(() => {
      const frame = document.querySelector("iframe[data-textedit-print]");
      if (!frame) return;
      window.__printed = frame.srcdoc;
      frame.addEventListener(
        "load",
        () => {
          frame.contentWindow.print = () => {
            window.__printedFaces = [...frame.contentDocument.fonts].map(
              (face) => `${face.family.replace(/"/g, "")}:${face.status}`,
            );
          };
        },
        { capture: true, once: true },
      );
    }).observe(document.body, { childList: true });
  });

  await choose("File", /^Print/);
  const sheet = page.getByRole("dialog").filter({ hasText: "Print Fonts" });
  await sheet.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "font-book-print.png"));
  await sheet.getByRole("combobox", { name: "Report Type" }).click();
  await page.getByRole("option", { name: "Waterfall" }).click();
  await sheet.getByRole("button", { name: "Print", exact: true }).click();
  await page.waitForTimeout(400);
  const printed = await page.evaluate(() => window.__printed ?? "");
  step("File > Print prints the report chosen", printed.includes("48 pt"), printed.slice(0, 80));

  const fontName = `Quince ${Date.now()}`;
  const chooser = page.waitForEvent("filechooser", { timeout: 5000 });
  await choose("File", /^Add Fonts/);
  await (await chooser).setFiles({
    name: `${fontName}.woff2`,
    mimeType: "font/woff2",
    buffer: readFileSync(
      fileURLToPath(
        new URL(
          "../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
          import.meta.url,
        ),
      ),
    ),
  });
  await window
    .locator(".mac-font-book-title", { hasText: fontName })
    .waitFor({ state: "visible", timeout: 10_000 });
  await choose("File", /^Print/);
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("combobox", { name: "Report Type" }).click();
  await page.getByRole("option", { name: "Catalog" }).click();
  await sheet.getByRole("button", { name: "Print", exact: true }).click();
  await page.waitForFunction(
    (name) => window.__printedFaces?.some((face) => face.startsWith(name)),
    fontName,
    { timeout: 10_000 },
  );
  const faces = await page.evaluate(() => window.__printedFaces);
  step(
    "a font added from a file is loaded in the print frame before it prints",
    faces.includes(`${fontName}:loaded`),
    faces.join(", "),
  );

  await choose("View", /^Hide Toolbar/);
  step(
    "View > Hide Toolbar hides it",
    (await window.getByRole("toolbar", { name: "Font Book toolbar" }).count()) === 0,
  );
  await reloadDesktop(page);
  await launch(page, "Font Book");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  step(
    "and it stays hidden after a reload",
    (await window.getByRole("toolbar", { name: "Font Book toolbar" }).count()) === 0,
  );
  await choose("View", /^Show Toolbar/);
  await window.getByRole("toolbar", { name: "Font Book toolbar" }).waitFor({ timeout: 5_000 });
  step("View > Show Toolbar shows it", true);

  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /^Custom/ }).click();
  await page.waitForTimeout(300);
  const custom = window.getByRole("textbox", { name: "Custom text" });
  await custom.fill("quince and pear");
  await custom.selectText();
  await custom.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Custom text commands" });
  await menu.waitFor({ timeout: 5_000 });
  step(
    "the custom text's context menu has the Edit rows",
    (await menu.getByRole("menuitem", { name: /^Select All/ }).count()) === 1,
  );
  await menu.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(300);
  step(
    "and they act on it",
    (await custom.evaluate((node) => node.selectionEnd - node.selectionStart)) === 15,
  );
});
