#!/usr/bin/env node
// TextEdit on Ferrite with real files: open TextEdit from the Dock, write a
// letter, make a word bold, another italic and underlined, centre a line, and
// save it with the Save sheet as an .rtf file in Documents on the person's drive
// (/api/files/); read the file's bytes back and find the formats in its RTF.
// Close the window, reload the page, forget the open document, open the file
// from Finder with a double click and find every format intact. Then type more
// and see autosave write into the same file (same id), save it again,
// rename it from File > Rename…, find it in File > Open Recent, and duplicate it.
// Every step is read back from the server as well as from the window. Exits 0
// only when every step passed and the page logged no console error, page error,
// failed request or HTTP error.
//
//   ferrite dev                                       # in ferrite-apps/desktop
//   node e2e/textedit-files-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const DRIVE = "/api/files/";
const DRAFT = "/api/textedit/draft";
const { base, out, browserName } = options();
const { step, run } = journey("textedit-files");
const stamp = Date.now();
const title = `Ferrite Letter ${stamp}`;
const fileName = `${title}.rtf`;
const renamed = `Signed Letter ${stamp}`;
const more = `Autosaved line ${stamp}`;
const signed = `Saved line ${stamp}`;

const textEdit = (page) =>
  page
    .locator(".mac-textedit")
    .filter({ has: page.getByRole("textbox", { name: "Document" }) })
    .first();

/** Waits until TextEdit's window has loaded the person's document (it is inert until then). */
async function ready(page) {
  await page.waitForFunction(
    () => {
      const body = document.querySelector(".mac-textedit-body");
      return body && !body.hasAttribute("inert");
    },
    undefined,
    { timeout: 15_000 },
  );
}

/** Selects `word` in the document, as a double click would. */
function select(editor, word) {
  return editor.evaluate((element, wanted) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      element.focus();
      const range = element.ownerDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      const selection = element.ownerDocument.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }
    return false;
  }, word);
}

/** The computed style of the text holding `word`, and the alignment of its paragraph. */
function styleOf(editor, word) {
  return editor.evaluate((element, wanted) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.includes(wanted)) continue;
      const style = getComputedStyle(node.parentElement);
      let paragraph = node.parentElement;
      while (paragraph.parentElement && paragraph.parentElement !== element) {
        paragraph = paragraph.parentElement;
      }
      const decoration = [];
      for (let at = node.parentElement; at && at !== element; at = at.parentElement) {
        decoration.push(getComputedStyle(at).textDecorationLine);
      }
      return {
        weight: Number(style.fontWeight) || (style.fontWeight === "bold" ? 700 : 400),
        italic: style.fontStyle === "italic" || style.fontStyle.startsWith("oblique"),
        underline: decoration.some((line) => line.includes("underline")),
        align: getComputedStyle(paragraph).textAlign,
      };
    }
    return null;
  }, word);
}

/** The drive file named `name` outside the Trash, and its text as the server holds it. */
async function stored(page, name) {
  const drive = (await api(page, "GET", DRIVE)).json;
  const entry = drive.entries?.find((e) => e.name === name && e.trashed_ms === undefined);
  if (!entry) return { entry };
  const text = await page.evaluate(async (id) => {
    const response = await fetch(`/api/files/content/${id}?piece=0&count=8`, {
      credentials: "same-origin",
    });
    return response.ok ? response.text() : `HTTP ${response.status}`;
  }, entry.id);
  return { entry, text };
}

/** Chooses `item` in the desktop menu bar's File menu, through `submenu` when given. */
async function fileMenu(page, item, submenu) {
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "File", exact: true })
    .click();
  if (submenu) {
    const trigger = page.getByRole("menuitem", { name: submenu, exact: true });
    await trigger.waitFor({ timeout: 5_000 });
    await trigger.hover();
  }
  const entry = page.getByRole("menuitem", { name: item, exact: true });
  await entry.waitFor({ timeout: 5_000 });
  await entry.click();
}

await run(async (page) => {
  await openDesktop(page, base, step);
  // TextEdit starts from an untitled document: a draft left by an earlier run, bound to a file of
  // the person's drive, is forgotten first, so nothing below edits or autosaves into that file.
  await api(page, "DELETE", DRAFT);
  await launch(page, "TextEdit");
  let window = textEdit(page);
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await ready(page);
  step("TextEdit opens from the Dock", await window.isVisible());
  let editor = window.getByRole("textbox", { name: "Document" });

  // A styled letter: "Ada" bold, "regards" italic and underlined, the second line centred.
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type("Dear Ada,");
  await page.keyboard.press("Enter");
  await page.keyboard.type(`Kind regards from Ferrite ${stamp}`);
  await select(editor, "Ada");
  await page.keyboard.press("ControlOrMeta+B");
  await select(editor, "regards");
  await page.keyboard.press("ControlOrMeta+I");
  await page.keyboard.press("ControlOrMeta+U");
  await select(editor, "Kind");
  await page.keyboard.press("ControlOrMeta+Shift+Backslash");
  const ada = await styleOf(editor, "Ada");
  const regards = await styleOf(editor, "regards");
  step(
    "the format commands style the letter in the window",
    ada?.weight >= 600 && regards?.italic && regards?.underline && regards?.align === "center",
    JSON.stringify({ ada, regards }),
  );

  // Save: the Save sheet on the drive, into Documents, as Rich Text.
  await page.keyboard.press("ControlOrMeta+S");
  const sheet = page.getByRole("dialog", { name: "Save" });
  await sheet.waitFor({ timeout: 5_000 });
  const field = sheet.getByRole("textbox", { name: "Save As:" });
  step(
    "the Save sheet names the document with its .rtf extension",
    /\.rtf$/.test(await field.inputValue()),
    await field.inputValue(),
  );
  await field.fill(title);
  const completed = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/files\/uploads\/[^/]+\/complete$/.test(new URL(response.url()).pathname),
    { timeout: 15_000 },
  );
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  step("Save uploads the file to the drive", (await completed).status() === 200);
  let { entry, text } = await stored(page, fileName);
  step(
    "the drive holds the letter as an .rtf file in Documents",
    entry?.parent === "documents" && entry?.type?.startsWith("text/rtf"),
    JSON.stringify(entry),
  );
  step(
    "its bytes are RTF with the bold, italic, underline and centring",
    typeof text === "string" &&
      text.startsWith("{\\rtf1") &&
      /\\b\\i0\\ulnone[^ ]* Ada/.test(text) &&
      /\\b0\\i\\ul\\strike0[^ ]* regards/.test(text) &&
      /\\qc/.test(text),
    String(text).slice(0, 240),
  );
  const fileId = entry?.id;
  await page.getByRole("region", { name: title, exact: true }).waitFor({ timeout: 10_000 });
  step("the window takes the file's name, no longer edited", true);
  await shot(page, path.join(out, `textedit-files-saved-${browserName}.png`));

  // Close the window, reload, forget the open document: only the file is left.
  await window.getByRole("button", { name: "Close" }).first().click();
  await window.waitFor({ state: "detached", timeout: 10_000 });
  await reloadDesktop(page);
  await api(page, "DELETE", DRAFT);

  // Open it from Finder with a double click.
  await launch(page, "Finder");
  const finder = page.locator(".mac-finder").first();
  await finder.waitFor({ state: "visible", timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const icon = finder.getByRole("option", { name: fileName, exact: true });
  await icon.waitFor({ timeout: 15_000 });
  await icon.dblclick();
  window = page.getByRole("region", { name: title, exact: true });
  await window.waitFor({ state: "visible", timeout: 15_000 });
  editor = window.getByRole("textbox", { name: "Document" });
  await editor.getByText("Kind regards").waitFor({ timeout: 15_000 });
  step("a double click in Finder opens the file in TextEdit", true);
  const ada2 = await styleOf(editor, "Ada");
  const regards2 = await styleOf(editor, "regards");
  step(
    "the reopened letter keeps its bold, italic, underline and centring",
    ada2?.weight >= 600 &&
      regards2?.italic &&
      regards2?.underline &&
      regards2?.align === "center" &&
      (await styleOf(editor, "Dear"))?.weight < 600,
    JSON.stringify({ ada2, regards2 }),
  );
  await shot(page, path.join(out, `textedit-files-reopened-${browserName}.png`));

  // Autosave writes into the same file: same id, new bytes, no new file.
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  const overwritten = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/files/uploads" &&
      (response.request().postData() ?? "").includes('"overwrite"'),
    { timeout: 15_000 },
  );
  await page.keyboard.type(more);
  await overwritten;
  await page.waitForTimeout(2500);
  ({ entry, text } = await stored(page, fileName));
  // This run's letter is still one file: autosave made no other (the drive may hold other files).
  const files = (await api(page, "GET", DRIVE)).json.entries.filter(
    (e) => e.kind === "file" && e.name.startsWith(title),
  );
  step(
    "autosave writes the new line into the same file, keeping its id",
    entry?.id === fileId && String(text).includes(more) && files.length === 1,
    `${entry?.id} ${files.length} files named ${title}`,
  );
  step(
    "the title says it is edited until it is saved",
    await page.getByRole("region", { name: `${title} — Edited` }).isVisible(),
  );
  // File > Save writes what was typed since into the same file, read back from the drive.
  await page.keyboard.press("Enter");
  await page.keyboard.type(signed);
  await page.keyboard.press("ControlOrMeta+S");
  await page.getByRole("region", { name: title, exact: true }).waitFor({ timeout: 10_000 });
  ({ entry, text } = await stored(page, fileName));
  step(
    "Save writes the file and the title is no longer edited",
    entry?.id === fileId && String(text).includes(signed) && String(text).includes(more),
    `${entry?.id} version ${entry?.version}`,
  );

  // File > Rename… in the menu bar renames the file on the drive.
  await fileMenu(page, "Rename…");
  const rename = page.getByRole("dialog", { name: /Rename/ });
  await rename.waitFor({ timeout: 5_000 });
  await rename.getByRole("textbox", { name: "Name:" }).fill(renamed);
  await rename.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByRole("region", { name: renamed, exact: true }).waitFor({ timeout: 10_000 });
  ({ entry } = await stored(page, `${renamed}.rtf`));
  step("File > Rename… renames the file, keeping its id", entry?.id === fileId, entry?.name);

  // File > Open Recent lists it; File > Duplicate makes an untitled copy.
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "File", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Open Recent", exact: true }).hover();
  const recent = page.getByRole("menuitem", { name: `${renamed}.rtf`, exact: true });
  await recent.waitFor({ timeout: 5_000 });
  step("File > Open Recent lists the document", await recent.isVisible());
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await fileMenu(page, "Duplicate");
  await page.getByRole("region", { name: `${renamed} copy — Edited` }).waitFor({ timeout: 10_000 });
  const copy = page
    .getByRole("region", { name: `${renamed} copy — Edited` })
    .getByRole("textbox", { name: "Document" });
  step(
    "File > Duplicate opens an untitled copy with the formats",
    (await styleOf(copy, "Ada"))?.weight >= 600,
  );
  await shot(page, path.join(out, `textedit-files-${browserName}.png`));
});
