#!/usr/bin/env node
// Stickies on Ferrite: in a fresh browser session, which has no saved note,
// open Stickies from the Dock and write a note; check that the session now
// keeps exactly that new note (by its id) through /api/stickies/data; bold a
// word of it from the keyboard and check that the note's saved formats hold
// it; reload the page, open Stickies again and find the same note as it was
// written, the word still bold. Exits 0 only when every step passed and the
// page logged no console error, page error or failed request.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/stickies-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

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
const { step, run } = journey("stickies");
const words = `Stickies on Ferrite ${Date.now()}`;
/** The word of the second line that the journey sets in bold. */
const BOLD = "Saved";

/** Whether `word` is set in bold in a note's saved formatted text. */
function boldInHtml(page, html, word) {
  return page.evaluate(
    ({ html, word }) => {
      const template = document.createElement("template");
      template.innerHTML = html ?? "";
      const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.nodeValue.includes(word)) continue;
        for (let at = node.parentElement; at; at = at.parentElement) {
          if (/^(B|STRONG)$/.test(at.tagName) || /bold|[6-9]00/.test(at.style.fontWeight)) {
            return true;
          }
        }
      }
      return false;
    },
    { html, word },
  );
}

/** The computed weight of the text that holds `word` in a note's text box. */
function weightOf(text, word) {
  return text.evaluate((element, wanted) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue.includes(wanted)) {
        return Number(getComputedStyle(node.parentElement).fontWeight);
      }
    }
    return 0;
  }, word);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const empty = await api(page, "GET", "/api/stickies/data");
  step(
    "the fresh session has no saved note",
    empty.status === 200 && (empty.json.data?.notes?.length ?? 0) === 0,
    JSON.stringify(empty.json.data),
  );
  await launch(page, "Stickies");
  const note = page.locator(".mac-stickies-note").first();
  await note.waitFor({ state: "visible", timeout: 10_000 });
  step("Stickies opens a note from the Dock", await note.isVisible());

  // Write the new note: a first line and a second line.
  const text = note.getByRole("textbox");
  await text.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  const saved = nextResponse(page, "PUT", "/api/stickies/data");
  await page.keyboard.type(words);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Saved by the Ferrite app");
  const put = await saved;
  // Typing goes on after the first save; wait for the last one to settle.
  await page.waitForTimeout(1500);
  step(
    "the note is saved through PUT /api/stickies/data",
    put.status() === 200,
    `HTTP ${put.status()}`,
  );
  const stored = await api(page, "GET", "/api/stickies/data");
  const notes = stored.json.data?.notes ?? [];
  const created = notes.find((each) => each.text?.startsWith(words));
  step(
    "the session now keeps one note, the new one, with both lines",
    notes.length === 1 && created?.text === `${words}\nSaved by the Ferrite app`,
    JSON.stringify(notes),
  );

  // Bold the first word of the second line from the keyboard (Command-B on a Mac, Control-B
  // elsewhere): the note saves its text with its formats.
  const selected = await text.evaluate((element, word) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(word);
      if (at < 0) continue;
      const range = element.ownerDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + word.length);
      element.ownerDocument.getSelection().removeAllRanges();
      element.ownerDocument.getSelection().addRange(range);
      return true;
    }
    return false;
  }, BOLD);
  step(`the word "${BOLD}" is selected in the note`, selected);
  const formatted = nextResponse(page, "PUT", "/api/stickies/data");
  await page.keyboard.press("ControlOrMeta+B");
  const formattedPut = await formatted;
  await page.waitForTimeout(1500);
  step(
    "the bold word is saved through PUT /api/stickies/data",
    formattedPut.status() === 200,
    `HTTP ${formattedPut.status()}`,
  );
  step("the word is bold in the note", (await weightOf(text, BOLD)) >= 600);
  const styled = await api(page, "GET", "/api/stickies/data");
  const kept = (styled.json.data?.notes ?? []).find((each) => each.id === created?.id);
  step(
    "the session keeps the note's text as it was and its formats with the word in bold",
    kept?.text === created?.text && (await boldInHtml(page, kept?.html, BOLD)),
    JSON.stringify(kept),
  );
  await page.screenshot({ path: path.join(out, "stickies-before-reload.png") });

  await reloadDesktop(page);
  const after = await api(page, "GET", "/api/stickies/data");
  const same = (after.json.data?.notes ?? []).find((each) => each.id === created?.id);
  step(
    "after a reload, the session still keeps that note under its id, with its formats",
    same?.text === created?.text && same?.html === kept?.html,
    `${created?.id}: ${JSON.stringify(same)}`,
  );
  await launch(page, "Stickies");
  const again = page.locator(".mac-stickies-note").first();
  await again.getByRole("textbox").getByText(words).waitFor({ timeout: 10_000 });
  const shown = await again.getByRole("textbox").innerText();
  step(
    "after a reload, Stickies opens the note as it was written",
    shown.includes(words) && shown.includes("Saved by the Ferrite app"),
    JSON.stringify(shown),
  );
  step(
    `after a reload, the word "${BOLD}" is still bold`,
    (await weightOf(again.getByRole("textbox"), BOLD)) >= 600,
  );
  step(
    "the note is named after its first line",
    (await again.getAttribute("aria-label")) === words,
  );
  await page.screenshot({ path: path.join(out, "stickies.png") });
});
