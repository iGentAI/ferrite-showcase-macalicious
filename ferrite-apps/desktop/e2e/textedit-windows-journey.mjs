#!/usr/bin/env node
// TextEdit batch 2, ad hoc: several windows across a reload, attachments, the new file formats,
// Export as PDF and the path menu.
import { writeFileSync } from "node:fs";
import { journey, launch, openDesktop, options } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-batch2");
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==";
const SELECTOR = '[data-window-id^="textedit"]';

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  const windows = () => page.locator(`${SELECTOR}:not([data-minimized])`);
  const front = () => windows().last();
  const doc = (window = front()) => window.getByRole("textbox", { name: "Document" });
  const menu = async (...path) => {
    const bar = page.getByRole("menubar").first();
    await bar.getByRole("menuitem", { name: path[0], exact: true }).click();
    for (const name of path.slice(1, -1)) {
      await page.getByRole("menuitem", { name, exact: true }).first().hover();
    }
    await page
      .getByRole("menuitem", { name: path.at(-1), exact: true })
      .first()
      .click();
  };
  const put = (name, type, base64) =>
    page.evaluate(
      async ([fileName, fileType, data]) => {
        const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
        const drive = await (await fetch("/api/files/")).json();
        const parent = drive.entries.find((entry) => entry.name === "Documents").id;
        const headers = { "content-type": "application/json" };
        const started = await (
          await fetch("/api/files/uploads", {
            method: "POST",
            headers,
            body: JSON.stringify({
              parent,
              name: fileName,
              size: bytes.length,
              type: fileType,
              existing: "fail",
            }),
          })
        ).json();
        await fetch(`/api/files/uploads/${started.upload}/0`, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: bytes,
        });
        const done = await fetch(`/api/files/uploads/${started.upload}/complete`, {
          method: "POST",
          headers,
          body: "{}",
        });
        return done.status;
      },
      [name, type, base64],
    );
  const fileBytes = (name) =>
    page.evaluate(async (fileName) => {
      const drive = await (await fetch("/api/files/")).json();
      const entry = drive.entries.find((each) => each.name === fileName && !each.trashed_ms);
      if (!entry) return null;
      const blob = await (await fetch(`/api/files/content/${entry.id}`)).arrayBuffer();
      let binary = "";
      for (const byte of new Uint8Array(blob)) binary += String.fromCharCode(byte);
      return { type: entry.type, base64: btoa(binary), size: entry.size };
    }, name);
  const saveAs = async (name, format) => {
    await menu("File", "Save As…");
    const sheet = page.getByRole("dialog", { name: "Save" });
    await sheet.getByRole("combobox", { name: "File Format:" }).click();
    await page.getByRole("option", { name: format }).click();
    const field = sheet.getByRole("textbox", { name: "Save As:" });
    await field.click({ clickCount: 3 });
    await page.keyboard.type(name);
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await sheet.waitFor({ state: "hidden" });
    await page.waitForTimeout(400);
  };

  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  await doc().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  await doc().click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("First window text");

  await menu("File", "New");
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, SELECTOR);
  step("File > New makes a second window", (await windows().count()) === 2);
  await page.waitForTimeout(400);
  await doc().click();
  await page.keyboard.type("Second window text");
  const texts = await page.locator(`${SELECTOR} [aria-label="Document"]`).allTextContents();
  step(
    "each window holds its own text",
    texts.join("|") === "First window text|Second window text",
    texts.join("|"),
  );
  await page.screenshot({ path: `${out}/textedit-windows.png` });

  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Window", exact: true })
    .click();
  await page.waitForTimeout(400);
  const rows = await page.getByRole("menuitemcheckbox", { name: /Edited/ }).allTextContents();
  step("the Window menu lists both documents", rows.length === 2, rows.join("|"));
  await page.screenshot({ path: `${out}/textedit-window-menu.png` });
  await page.keyboard.press("Escape");

  await put("pic.png", "image/png", PNG);
  await put("report.pdf", "application/pdf", btoa("%PDF-1.4"));
  await page.waitForTimeout(2_000);
  const settings = await page.evaluate(async () =>
    (await (await fetch("/api/system-preferences/settings")).text()).slice(0, 1500),
  );
  console.log("settings before reload", settings);
  await page.reload();
  await page.waitForTimeout(1_500);
  console.log("after reload windows", await page.locator(SELECTOR).count());
  if ((await page.locator(SELECTOR).count()) === 0) await launch(page, "TextEdit");
  await page.waitForTimeout(3000);
  console.log(
    "after launch windows",
    await page.locator(SELECTOR).count(),
    await page.evaluate(async () =>
      (await (await fetch("/api/system-preferences/settings")).text()).slice(0, 800),
    ),
  );
  await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, SELECTOR, {
    timeout: 15_000,
  });
  await page.waitForTimeout(800);
  const back = (await page.locator(`${SELECTOR} [aria-label="Document"]`).allTextContents()).sort();
  step(
    "both windows and their text come back after a reload",
    back.join("|") === "First window text|Second window text",
    back.join("|"),
  );

  await page.waitForTimeout(600);
  await doc().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Control+Shift+A");
  const panel = page.locator(".mac-textedit-panel-layer");
  await panel.waitFor();
  await panel.getByText("pic.png", { exact: true }).first().click();
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  await doc().locator("img").waitFor();
  step(
    "Attach Files puts a picture in the text",
    (await doc().locator("img").getAttribute("width")) === "1",
  );
  await page.keyboard.press("Control+Shift+A");
  await panel.waitFor();
  await panel.getByText("report.pdf", { exact: true }).first().click();
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  await doc().locator('a[href^="drive:"]').waitFor();
  step(
    "Attach Files attaches another file",
    (await doc().locator('a[href^="drive:"]').textContent()) === "report.pdf",
  );
  await page.screenshot({ path: `${out}/textedit-attachments.png` });

  await saveAs("Batch", "Rich Text Document");
  const rtf = await fileBytes("Batch.rtf");
  const rtfText = Buffer.from(rtf?.base64 ?? "", "base64").toString();
  step(
    "the RTF file holds the picture and the attachment",
    rtfText.includes("\\pngblip") && rtfText.includes('HYPERLINK "drive:'),
  );

  await front()
    .locator(".mac-title-bar-title")
    .click({ modifiers: ["Control"] });
  const path = page.getByRole("menu", { name: "Path" });
  await path.waitFor();
  const pathRows = (await path.getByRole("menuitem").allTextContents()).join("|");
  step("Command-click on the title shows the path", pathRows === "Batch.rtf|Documents", pathRows);
  await page.screenshot({ path: `${out}/textedit-path-menu.png` });
  await page.keyboard.press("Escape");

  await menu("File", "Export as PDF…");
  const exporting = page.getByRole("dialog", { name: "Export as PDF" });
  await exporting.getByRole("button", { name: "Save", exact: true }).click();
  await exporting.waitFor({ state: "hidden" });
  await page.waitForTimeout(1_500);
  const pdf = await fileBytes("Batch.pdf");
  step(
    "Export as PDF writes a PDF on the drive",
    Buffer.from(pdf?.base64 ?? "", "base64")
      .subarray(0, 5)
      .toString() === "%PDF-",
    String(pdf?.size),
  );
  if (pdf) writeFileSync(`${out}/Batch.pdf`, Buffer.from(pdf.base64, "base64"));

  for (const [name, format, file] of [
    ["Word", "Word 2007 Format (.docx)", "Word.docx"],
    ["Open", "OpenDocument Text (.odt)", "Open.odt"],
    ["Archive", "Web Archive Document (.webarchive)", "Archive.webarchive"],
  ]) {
    await saveAs(name, format);
    const saved = await fileBytes(file);
    step(`Save As writes ${file}`, Boolean(saved?.size), `${saved?.type} ${saved?.size}`);
    if (saved) writeFileSync(`${out}/${file}`, Buffer.from(saved.base64, "base64"));
  }
  await page.screenshot({ path: `${out}/textedit-formats.png` });

  // Word's bytes open again, in a window of their own.
  await menu("File", "Open…");
  const open = page.locator(".mac-textedit-panel-layer");
  await open.waitFor();
  await open.getByText("Word.docx", { exact: true }).first().click();
  await open.getByRole("button", { name: "Open", exact: true }).click();
  await page.waitForTimeout(1_500);
  const opened = await page
    .locator(`${SELECTOR} [aria-label="Document"]`)
    .evaluateAll((views) =>
      views.map((view) => [view.textContent, view.querySelectorAll("img").length]),
    );
  step(
    "the Word file opens with its text and picture",
    opened.some(([text, pictures]) => text.includes("Second window text") && pictures === 1),
    JSON.stringify(opened),
  );
});
