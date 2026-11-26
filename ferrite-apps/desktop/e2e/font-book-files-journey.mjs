#!/usr/bin/env node
// Font Book's commands on font files: File > Validate Font and Validate File, Reveal in Finder, File >
// Export Fonts, Edit > Look for Enabled Duplicates and Resolve Duplicates, read back from the drive.
// Exits 0 only when every step passed with no console error, page error or failed request.
//
//   node e2e/font-book-files-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out } = options();
const { step, run } = journey("font-book-files");
const tag = Date.now().toString(36);
const FONT = `Zinnia ${tag}`;
const COPY = `${FONT} 2`;
const FOLDER = `Exported ${tag}`;
const BYTES = readFileSync(
  fileURLToPath(
    new URL(
      "../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
      import.meta.url,
    ),
  ),
);
const woff2 = (name) => ({ name: `${name}.woff2`, mimeType: "font/woff2", buffer: BYTES });

await run(async (page) => {
  page.setDefaultTimeout(12_000);
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
  const add = async (file) => {
    const chooser = page.waitForEvent("filechooser", { timeout: 5000 });
    await choose("File", /^Add Fonts/);
    await (await chooser).setFiles(file);
    await window
      .locator(".mac-font-book-title", { hasText: file.name.replace(/\.woff2$/, "") })
      .waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
  };
  const entries = async () => (await api(page, "GET", "/api/files/")).json.entries ?? [];
  const sheet = page.getByRole("dialog");

  await add(woff2(FONT));
  await choose("File", /^Validate Font/);
  const results = sheet.getByRole("list", { name: "Validation results" });
  await results.waitFor();
  step(
    "Validate Font passes a real font file",
    (await results.innerText()).includes(`${FONT}: Passed`),
    await results.innerText(),
  );
  await shot(page, path.join(out, "font-book-validate.png"));
  await sheet.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(300);

  const chooser = page.waitForEvent("filechooser", { timeout: 5000 });
  await choose("File", /^Validate File/);
  await (await chooser).setFiles({
    name: "Broken.ttf",
    mimeType: "font/ttf",
    buffer: Buffer.from("not a font at all"),
  });
  await results.waitFor();
  const broken = await results.innerText();
  step(
    "Validate File fails a file that is no font, and says why",
    broken.includes("Broken.ttf: Failed") && broken.includes("does not start as a font does"),
    broken,
  );
  await sheet.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(300);
  const inFonts = async () =>
    await window
      .getByRole("treegrid", { name: "Fonts" })
      .or(window.getByRole("tree", { name: "Fonts" }))
      .innerText();
  step("validating a file adds nothing", !(await inFonts()).includes("Broken"));

  await choose("File", /^Export Fonts/);
  await sheet.getByRole("textbox", { name: /Save As/i }).fill(FOLDER);
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  let exported = false;
  for (let tries = 0; tries < 12 && !exported; tries += 1) {
    await page.waitForTimeout(400);
    const all = await entries();
    const folder = all.find((each) => each.name === FOLDER);
    exported = all.some(
      (each) =>
        each.parent === folder?.id && each.name === `${FONT}.woff2` && each.size === BYTES.length,
    );
  }
  step("Export Fonts puts the font's file in a new folder on the drive", exported);

  await add(woff2(COPY));
  await page.keyboard.press("Escape");
  // Turned off, the copy is not an enabled duplicate, and its file stays.
  await choose("Edit", /^Disable/);
  await choose("Edit", /^Look for Enabled Duplicates/);
  const toldOff = page.getByRole("alertdialog");
  await toldOff.getByText("No enabled duplicates were found.").waitFor();
  step("a family turned off is not an enabled duplicate", true);
  await toldOff.getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(300);
  await choose("Edit", /^Enable/);
  await choose("Edit", /^Look for Enabled Duplicates/);
  const duplicates = sheet.getByRole("list", { name: "Duplicate fonts" });
  await duplicates.waitFor();
  step(
    "Look for Enabled Duplicates finds the second file of the font",
    (await duplicates.innerText()).includes(`also ${COPY}.woff2`),
    await duplicates.innerText(),
  );
  await shot(page, path.join(out, "font-book-duplicates.png"));
  await sheet.getByRole("button", { name: "Resolve" }).click();
  const told = page.getByRole("alertdialog");
  await told.getByText("1 duplicate file went to the Trash.").waitFor();
  await told.getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(300);
  const trash = (await entries()).find((each) => each.name === `${COPY}.woff2`);
  step(
    "Resolve moves the second file to the Trash, and its family goes",
    trash?.trashed_ms !== undefined && !(await inFonts()).includes(COPY),
    JSON.stringify(trash ?? null),
  );

  await choose("Edit", /^Look for Enabled Duplicates/);
  await told.getByText("No enabled duplicates were found.").waitFor();
  step("then there are none", true);
  await told.getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(300);

  // A second format of the same family: resolving trashes the file, and the family stays.
  const fontsFolder = (await entries()).find(
    (each) => each.name === `${FONT}.woff2` && !each.trashed_ms,
  )?.parent;
  await uploadFile(page, {
    parent: fontsFolder,
    name: `${FONT}.woff`,
    type: "font/woff",
    text: "a second format",
  });
  await choose("Edit", /^Resolve Duplicates/);
  await told.getByText("1 duplicate file went to the Trash.").waitFor();
  await told.getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(300);
  const other = (await entries()).find((each) => each.name === `${FONT}.woff`);
  const original = (await entries()).find(
    (each) => each.name === `${FONT}.woff2` && each.parent === fontsFolder,
  );
  step(
    "Resolve Duplicates trashes the other format and keeps the family's file",
    other?.trashed_ms !== undefined && original?.trashed_ms === undefined,
    JSON.stringify([other?.trashed_ms ?? null, original?.trashed_ms ?? null]),
  );

  const row = window.locator(`[data-font-id="${FONT.toLowerCase().replace(/\s+/g, "-")}"]`).first();
  await row.click({ button: "right" });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "font-book-context-files.png"));
  await page.getByRole("menuitem", { name: "Reveal in Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder
    .locator('[aria-selected="true"]', { hasText: `${FONT}.woff2` })
    .first()
    .waitFor({ timeout: 8_000 });
  await shot(page, path.join(out, "font-book-reveal.png"));
  step("Reveal in Finder selects the font's file there", true);

  await reloadDesktop(page);
  await launch(page, "Font Book");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(1200);
  // The list opens at its end and draws only what shows: the search brings the font into it.
  await window.getByRole("searchbox", { name: "Search" }).fill(FONT);
  await page.waitForTimeout(400);
  const listed = await inFonts();
  step(
    "after a reload the font is there and its resolved copy is not",
    listed.includes(FONT) && !listed.includes(COPY),
    listed,
  );
});
