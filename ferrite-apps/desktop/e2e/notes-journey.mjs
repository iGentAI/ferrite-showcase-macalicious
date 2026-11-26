#!/usr/bin/env node
// Notes on Ferrite: open Notes from the Dock, write a new note, make a word of
// it bold with Command-B (Control off Apple platforms), reload the page, open
// Notes again and find the note in the list and in the editor with the word
// still bold, saved in the session through /api/notes/data (its lines, and its
// formats as `html`). Exits 0 only when every step passed and the page logged
// no console error, page error or failed request.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/notes-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import {
  api,
  journey,
  launch,
  nextResponse,
  openDesktop,
  options,
  reloadDesktop,
} from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("notes");
const title = `Notes on Ferrite ${Date.now()}`;
/** The second line, and the word of it made bold: a word the title (bold already) lacks. */
const BODY = "Kept by the Ferrite app in Quillwort";
const WORD = "Quillwort";

/**
 * Select `word` in the note's editor, as a double click would, with the editor focused. The
 * word is found in the note's second line or after it, never in the title.
 */
const selectWord = (editor, word) =>
  editor.evaluate((element, wanted) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.nodeValue?.includes(wanted)) node = walker.nextNode();
    if (!node) throw new Error(`no ${wanted} in the note`);
    const first = [...element.childNodes].find((child) => (child.textContent ?? "") !== "");
    if (first?.contains(node)) throw new Error(`${wanted} is in the note's title`);
    const at = (node.nodeValue ?? "").indexOf(wanted);
    const range = element.ownerDocument.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + wanted.length);
    element.focus();
    const selection = element.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, word);

/** The computed weight of the text that holds `word` in the editor. */
const weightOf = (editor, word) =>
  editor.evaluate((element, wanted) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.nodeValue?.includes(wanted)) node = walker.nextNode();
    return node?.parentElement ? Number(getComputedStyle(node.parentElement).fontWeight) : 0;
  }, word);

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Notes");
  const window = page.getByRole("region", { name: "Notes" });
  const list = window.getByRole("listbox", { name: "Notes" });
  await list.waitFor({ state: "visible", timeout: 10_000 });
  step("Notes opens from the Dock with its note list", await list.isVisible());

  // A new note takes the insertion point.
  await window.getByRole("button", { name: "New Note" }).click();
  const saved = nextResponse(page, "PUT", "/api/notes/data");
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  await page.keyboard.type(BODY);
  const put = await saved;
  await page.waitForTimeout(1500);
  step(
    "the note is saved through PUT /api/notes/data",
    put.status() === 200,
    `HTTP ${put.status()}`,
  );
  const stored = await api(page, "GET", "/api/notes/data");
  const note = stored.json.data?.notes?.find((each) => each.lines[0] === title);
  step(
    "the session's stored notes hold the new note, both lines",
    note?.lines?.[1] === BODY,
    JSON.stringify(note?.lines),
  );

  // Command-B makes a word of the second line bold (the title is bold already, and holds no
  // such word); the note is saved with its formats.
  const apple = await page.evaluate(() => /Mac|iP(hone|ad|od)/.test(navigator.platform));
  const writing = window.getByRole("textbox", { name: "Note" });
  const before = await weightOf(writing, WORD);
  step("the word is not bold before Command-B", before < 600, `font-weight ${before}`);
  await selectWord(writing, WORD);
  const formatted = nextResponse(page, "PUT", "/api/notes/data");
  await page.keyboard.press(`${apple ? "Meta" : "Control"}+b`);
  const boldPut = await formatted;
  await page.waitForTimeout(1500);
  step(
    "Command-B makes the selected word bold in the editor",
    (await weightOf(writing, WORD)) >= 600,
  );
  const styled = (await api(page, "GET", "/api/notes/data")).json.data?.notes?.find(
    (each) => each.lines[0] === title,
  );
  step(
    "the note is saved with its formats as html, and the same lines",
    boldPut.status() === 200 &&
      /font-weight:\s*(bold|[6-9]00)|<(b|strong)>/.test(styled?.html ?? "") &&
      (styled?.html ?? "").includes(WORD) &&
      styled?.lines?.[1] === BODY,
    `HTTP ${boldPut.status()} ${JSON.stringify(styled?.html)}`,
  );
  await page.screenshot({ path: path.join(out, "notes-before-reload.png") });

  await reloadDesktop(page);
  await launch(page, "Notes");
  const row = page
    .getByRole("region", { name: "Notes" })
    .getByRole("listbox", { name: "Notes" })
    .getByRole("option")
    .filter({ hasText: title });
  await row.first().waitFor({ timeout: 10_000 });
  step("after a reload, the note is in the list", (await row.count()) === 1);
  await row.first().click();
  const editor = page.getByRole("textbox", { name: "Note" }).filter({ hasText: title });
  await editor.first().waitFor({ timeout: 5_000 });
  step("and opens with both lines", (await editor.first().innerText()).includes(BODY));
  const weight = await weightOf(editor.first(), WORD);
  step("and the bold word is still bold", weight >= 600, `font-weight ${weight}`);
  await page.screenshot({ path: path.join(out, "notes.png") });
});
