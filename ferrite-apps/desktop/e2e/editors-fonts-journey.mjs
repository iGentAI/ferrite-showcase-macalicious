#!/usr/bin/env node
// Editors on Ferrite: every family the Fonts panel offers renders as itself, or is dimmed with the
// reason. In Notes a word is selected and the Fonts panel opened (Command-T). For each family the
// panel lists, the page measures, by layout and apart from the panel's own check, whether text
// set in it renders otherwise than in each generic fallback. A family must be dimmed exactly when
// it does not render, and the panel must say why when any is. A family that renders, chosen in the
// panel, becomes the selected word's computed font and is kept by the server; a dimmed one changes
// nothing. TextEdit's and Stickies' panels dim the same families. Writes what was measured to
// <out>/fonts-<browser>.json. Exits 0 only when every step passed and the page logged no console
// error, page error, failed request or HTTP error.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/editors-fonts-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]

import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("editors-fonts");
const stamp = String(Date.now()).slice(-6);
const WORD = `Typeset${stamp}`;

/** The family list of the Fonts panel shown last: each row's name and whether it is dimmed. */
const familyRows = (panel) =>
  panel.getByRole("listbox", { name: "Family" }).evaluate((list) =>
    [...list.querySelectorAll('[role="option"]')].map((row) => ({
      name: row.textContent.trim(),
      dimmed: row.getAttribute("aria-disabled") === "true",
    })),
  );

/**
 * Whether each family renders as itself, measured by layout: a span of text set in the family
 * measures otherwise than the same span in a generic fallback. The panel's "System Font" is the
 * system's own family, which always renders.
 */
const rendersByLayout = (page, names) =>
  page.evaluate((list) => {
    const box = document.createElement("div");
    box.style.cssText = "position:absolute;left:-9999px;top:0;white-space:nowrap;font-size:48px";
    document.body.append(box);
    const width = (family) => {
      const span = document.createElement("span");
      span.textContent = "mmmmmmmmmmlli1WQ@#&";
      span.style.fontFamily = family;
      box.append(span);
      const measured = span.getBoundingClientRect().width;
      span.remove();
      return measured;
    };
    const result = {};
    for (const name of list) {
      if (name === "System Font") {
        result[name] = true;
        continue;
      }
      result[name] = ["monospace", "serif", "sans-serif"].some(
        (fallback) => width(`"${name}", ${fallback}`) !== width(fallback),
      );
    }
    box.remove();
    return result;
  }, names);

/** Select `word` in the editor, focused. */
const selectWord = (editor, word) =>
  editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      root.focus();
      const range = root.ownerDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + wanted.length);
      root.ownerDocument.getSelection().removeAllRanges();
      root.ownerDocument.getSelection().addRange(range);
      return true;
    }
    return false;
  }, word);

/** The computed font-family of the text that holds `word`. */
const fontOf = (editor, word) =>
  editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue.includes(wanted)) return getComputedStyle(node.parentElement).fontFamily;
    }
    return null;
  }, word);

const dimmedOf = (rows) =>
  rows
    .filter((row) => row.dimmed)
    .map((row) => row.name)
    .sort();

await run(async (page) => {
  await openDesktop(page, base, step);

  // Notes: a word selected, the Fonts panel opened.
  await launch(page, "Notes");
  const notesWindow = page.getByRole("region", { name: "Notes" }).first();
  await notesWindow.waitFor({ timeout: 15_000 });
  await notesWindow.getByRole("button", { name: "New Note" }).click();
  const note = page.locator('[role="textbox"][aria-label="Note"]:visible').first();
  await note.waitFor({ timeout: 10_000 });
  await note.click();
  await page.keyboard.type(`Fonts journey ${stamp}`);
  await page.keyboard.press("Enter");
  await page.keyboard.type(`${WORD} words`);
  await selectWord(note, WORD);
  await page.keyboard.press("ControlOrMeta+t");
  const panel = page.getByRole("dialog", { name: "Fonts" }).first();
  await panel.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);

  const rows = await familyRows(panel);
  const renders = await rendersByLayout(
    page,
    rows.map((row) => row.name),
  );
  const disagree = rows.filter((row) => row.dimmed === renders[row.name]);
  writeFileSync(
    path.join(out, `fonts-${browserName}.json`),
    JSON.stringify(
      rows.map((row) => ({ ...row, rendersByLayout: renders[row.name] })),
      null,
      1,
    ),
  );
  const dimmed = dimmedOf(rows);
  step(
    "every family the panel offers renders as itself, and every one that does not is dimmed",
    rows.length > 0 && disagree.length === 0,
    `${rows.length - dimmed.length} render, ${dimmed.length} dimmed${disagree.length ? `; disagree: ${disagree.map((row) => row.name).join(", ")}` : ""}`,
  );
  const note_ = panel.getByRole("note");
  step(
    "the panel says why families are dimmed when any is",
    dimmed.length === 0
      ? (await note_.count()) === 0
      : (await note_.innerText()).includes("not installed on this computer"),
  );
  await shot(page, path.join(out, `fonts-${browserName}-panel.png`));

  // A family that renders, chosen in the panel, is the word's computed font, and is kept.
  const chosen = rows.find((row) => !row.dimmed && row.name !== "System Font")?.name;
  if (chosen) {
    await panel
      .getByRole("listbox", { name: "Family" })
      .getByRole("option", { name: chosen, exact: true })
      .click();
    await page.waitForTimeout(400);
    const computed = (await fontOf(note, WORD)) ?? "";
    step(
      `a family that renders (${chosen}), chosen in the panel, is the selected word's computed font`,
      computed.replace(/["']/g, "").startsWith(chosen),
      computed,
    );
    await page.waitForTimeout(2500);
    const stored = JSON.stringify((await api(page, "GET", "/api/notes/data")).json ?? {});
    step(
      "the server keeps the word in that family",
      stored.includes(WORD) && stored.includes(chosen),
    );
  }
  // A dimmed family cannot be chosen: the word keeps its font.
  const missing = dimmed[0];
  if (missing) {
    const before = await fontOf(note, WORD);
    await panel
      .getByRole("listbox", { name: "Family" })
      .getByRole("option", { name: missing, exact: true })
      .click({ force: true });
    await page.waitForTimeout(400);
    step(`a dimmed family (${missing}) changes nothing`, (await fontOf(note, WORD)) === before);
  }
  await page.keyboard.press("Escape");

  // TextEdit's and Stickies' panels dim the same families.
  await launch(page, "TextEdit");
  await page.waitForFunction(
    () => {
      const body = document.querySelector(".mac-textedit-body");
      return body && !body.hasAttribute("inert");
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.locator(".mac-textedit").getByRole("textbox", { name: "Document" }).first().click();
  await page.keyboard.press("ControlOrMeta+t");
  const textPanel = page.locator(".mac-textedit .mac-font-panel, .mac-font-panel").last();
  await textPanel.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  const textDimmed = dimmedOf(await familyRows(textPanel));
  step(
    "TextEdit's Fonts panel dims the same families",
    JSON.stringify(textDimmed) === JSON.stringify(dimmed.filter((name) => name !== "System Font")),
    `${textDimmed.length} dimmed`,
  );

  await launch(page, "Stickies");
  const sticky = page.locator(".mac-stickies-note").first();
  await sticky.waitFor({ state: "visible", timeout: 15_000 });
  await sticky.getByRole("textbox").first().click();
  await page.keyboard.press("ControlOrMeta+t");
  await page.waitForTimeout(800);
  const stickyPanel = page.locator(".mac-font-panel").last();
  await stickyPanel.waitFor({ timeout: 10_000 });
  const stickyDimmed = dimmedOf(await familyRows(stickyPanel));
  step(
    "Stickies' Fonts panel dims the same families",
    JSON.stringify(stickyDimmed) ===
      JSON.stringify(dimmed.filter((name) => name !== "System Font")),
    `${stickyDimmed.length} dimmed`,
  );
});
