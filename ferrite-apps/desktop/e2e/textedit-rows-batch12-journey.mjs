#!/usr/bin/env node
// TextEdit batch 12: the Document Properties panel, Print's Pages and Two-Sided as far as a page
// carries them, Correct Spelling Automatically, Check Grammar, and the shared detector rows.
//
//   node e2e/textedit-rows-batch12-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-rows-batch12");
const stamp = Date.now().toString(36);
const KEY = "ControlOrMeta";

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  const docs = page.locator('[data-window-id^="textedit"]:not([data-window-id*="properties"])');
  const doc = docs.first();
  const text = doc.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const bar = page.getByRole("menubar");
  const menu = async (name) => {
    await bar.getByRole("menuitem", { name, exact: true }).click();
    await page.waitForTimeout(250);
  };
  const spelling = async () => {
    await menu("Edit");
    await page.getByRole("menuitem", { name: "Spelling and Grammar" }).last().hover();
    await page.getByRole("menuitem", { name: "Show Spelling and Grammar" }).waitFor();
    return page.getByRole("menu", { name: "Spelling and Grammar" }).last();
  };
  const inText = () => text.click({ position: { x: 12, y: 12 } });
  const typed = () => text.evaluate((node) => node.innerText.replace(/\u00a0/g, " "));
  const clearText = async () => {
    await inText();
    await page.keyboard.press(`${KEY}+A`);
    await page.keyboard.press("Backspace");
  };

  // Correct Spelling Automatically.
  let rows = await spelling();
  const correctRow = rows.getByRole("menuitemcheckbox", { name: "Correct Spelling Automatically" });
  step(
    "Correct Spelling Automatically is off at first",
    (await correctRow.getAttribute("aria-checked")) === "false",
  );
  const grammar = rows.getByRole("menuitemcheckbox", { name: "Check Grammar With Spelling" });
  step("Check Grammar is off at first", (await grammar.getAttribute("aria-checked")) === "false");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await clearText();
  await page.keyboard.type("Over the the hill ");
  const checkNow = async () => {
    rows = await spelling();
    await rows.getByRole("menuitem", { name: "Check Document Now" }).click();
    await page.waitForTimeout(800);
    return page.evaluate(() => window.getSelection().toString());
  };
  step(
    "while it is off, Check Document Now passes over a repeated word",
    (await checkNow()) !== "the the",
  );
  rows = await spelling();
  await grammar.click();
  await page.waitForTimeout(600);
  const grammarKept = (await api(page, "GET", "/api/system-preferences/settings")).json?.values?.[
    "text.checkGrammar"
  ];
  step("Check Grammar turned on is kept on the server", grammarKept === true, `${grammarKept}`);
  await inText();
  await text.evaluate((node) => {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.collapse(node, 0);
  });
  const selected = await checkNow();
  step(
    "with it on, Check Document Now selects the repeated word",
    selected === "the the",
    selected,
  );
  await menu("Edit");
  await page.getByRole("menuitem", { name: "Spelling and Grammar" }).last().hover();
  await page.getByRole("menuitem", { name: "Show Spelling and Grammar" }).click();
  const spellingPanel = page.getByRole("dialog", { name: "Spelling and Grammar" });
  await spellingPanel.waitFor({ timeout: 8_000 });
  await spellingPanel.getByText(/is repeated/).waitFor({ timeout: 8_000 });
  step(
    "the panel says why, and offers the word once",
    (await spellingPanel.getByRole("textbox", { name: "Change to" }).inputValue()) === "the",
  );
  await spellingPanel.getByRole("button", { name: "Change", exact: true }).click();
  await page.waitForTimeout(500);
  step("Change puts it right", /Over the hill/.test(await typed()), await typed());
  await shot(page, path.join(out, "textedit-grammar.png"));
  await spellingPanel.getByRole("button", { name: /close/i }).click();
  rows = await spelling();
  await grammar.click();
  await clearText();
  await page.keyboard.type("teh ");
  step("while it is off, a misspelling stays", (await typed()).trim() === "teh", await typed());

  rows = await spelling();
  await correctRow.click();
  await page.waitForTimeout(600);
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json?.values?.[
      "textedit.correctAutomatically"
    ];
  step("turning it on is kept on the server", (await stored()) === true, String(await stored()));

  await clearText();
  await page.keyboard.type("so teh recieve Lovelace zzyzx ");
  await page.waitForTimeout(150);
  step(
    "known misspellings are corrected as typed; a name and an unknown word stay",
    (await typed()).trim() === "so the receive Lovelace zzyzx",
    await typed(),
  );

  await clearText();
  await page.keyboard.type("Teh, ");
  await page.waitForTimeout(100);
  step(
    "a leading capital and the punctuation are kept",
    (await typed()).trim() === "The,",
    await typed(),
  );

  await clearText();
  await page.keyboard.type("teh ");
  await page.waitForTimeout(100);
  await page.keyboard.press(`${KEY}+Z`);
  await page.waitForTimeout(150);
  step("one Undo gives back what was typed", (await typed()).trim() === "teh", await typed());
  await page.keyboard.type("x");
  step(
    "and the caret is after it",
    (await typed()).replace(/\s+/g, " ").trim() === "teh x",
    await typed(),
  );

  await clearText();
  await page.keyboard.type("teh");
  await page.keyboard.press("Enter");
  await page.keyboard.type("next");
  await page.waitForTimeout(100);
  step(
    "Return ends a word too",
    (await typed()).split("\n").filter(Boolean).join("|") === "the|next",
    await typed(),
  );

  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await clearText();
  await page.keyboard.type("wich ");
  await page.waitForTimeout(100);
  step("it is still on after a reload", (await typed()).trim() === "which", await typed());

  rows = await spelling();
  await correctRow.click();
  await page.waitForTimeout(600);
  step("turning it off is kept too", (await stored()) === false, String(await stored()));

  // Show Properties.
  await clearText();
  await page.keyboard.type(`letter ${stamp}`);
  await menu("File");
  await page
    .getByRole("menuitem", { name: /^Show Properties/ })
    .last()
    .click();
  const panel = page.getByRole("dialog", { name: "Document Properties" });
  await panel.waitFor();
  const frame = page.locator("[data-window-id^='textedit:properties']");
  step("Show Properties opens a window of the desktop", (await frame.count()) === 1);
  const order = await page.evaluate(() => {
    const z = (selector) => Number(getComputedStyle(document.querySelector(selector)).zIndex);
    return {
      panel: z("[data-window-id^='textedit:properties']"),
      doc: z('[data-window-id^="textedit"]:not([data-window-id*="properties"])'),
    };
  });
  step("it floats over the document", order.panel > order.doc, JSON.stringify(order));
  step(
    "it has no OK or Cancel",
    (await panel.getByRole("button", { name: /OK|Cancel/ }).count()) === 0,
  );
  await panel.getByLabel("Author:").fill("Ada Lovelace");
  await panel.getByLabel("Keywords:").fill("engines, notes");
  await shot(page, path.join(out, "textedit-properties-panel.png"));

  const before = await frame.boundingBox();
  const titleBar = panel.locator(".mac-title-bar").first();
  const box = await titleBar.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  const moved = await frame.boundingBox();
  step(
    "it moves by its title bar",
    Math.round(before.x - moved.x) === 60 && Math.round(moved.y - before.y) === 40,
    JSON.stringify([before, moved]),
  );

  await inText();
  await page.keyboard.press(`${KEY}+End`);
  await page.keyboard.type(" more");
  step(
    "the document can be typed in with the panel up",
    (await typed()).includes("more"),
    await typed(),
  );
  step("the panel stays up", await panel.isVisible());

  await menu("File");
  const hide = page.getByRole("menuitem", { name: "Hide Properties" }).last();
  step("the File row now says Hide Properties", await hide.isVisible());
  await hide.click();
  await panel.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  await page.keyboard.type("!");
  step(
    "hiding it leaves the keyboard in the document",
    (await typed()).includes("more!"),
    await typed(),
  );

  await page.waitForTimeout(1_800);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await inText();
  await page.keyboard.press(`${KEY}+Alt+P`);
  await panel.waitFor();
  step(
    "the properties are there after a reload",
    (await panel.getByLabel("Author:").inputValue()) === "Ada Lovelace" &&
      (await panel.getByLabel("Keywords:").inputValue()) === "engines, notes",
  );
  await page.keyboard.press(`${KEY}+Alt+P`);
  await panel.waitFor({ state: "detached" });
  step("Option-Command-P from the panel hides it", true);

  // Two documents: the panel follows the front one.
  await inText();
  await page.keyboard.press(`${KEY}+Alt+P`);
  await panel.waitFor();
  const firstAt = await frame.boundingBox();
  await inText();
  await menu("File");
  await page.getByRole("menuitem", { name: "New", exact: true }).last().click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-window-id^="textedit"]:not([data-window-id*="properties"])')
        .length === 2,
  );
  await page.waitForTimeout(500);
  step("one panel only with two documents", (await frame.count()) === 1);
  step(
    "the panel goes over to the new document, whose fields are empty",
    (await panel.getByLabel("Author:").inputValue()) === "",
  );
  const at = await frame.boundingBox();
  step(
    "and it stands where it stood",
    at.x === firstAt.x && at.y === firstAt.y,
    JSON.stringify([firstAt, at]),
  );
  await page.keyboard.type("typed");
  await page.waitForTimeout(150);
  const front = docs.last().getByRole("textbox", { name: "Document" });
  step(
    "the new document has the keyboard",
    (await front.innerText()).includes("typed"),
    await front.innerText(),
  );
  await panel.getByRole("button", { name: /close/i }).click();
  await panel.waitFor({ state: "detached" });
  step("its close button hides it", (await frame.count()) === 0);
  await page.keyboard.press("Control+KeyW");
  await page
    .getByRole("button", { name: /Don.t Save|Delete/ })
    .click({ timeout: 2_000 })
    .catch(() => {});
  await page.waitForTimeout(400);

  // Print: the frame's page, printed for real to a PDF by Chromium in a page of its own.
  await inText();
  await page.keyboard.press(`${KEY}+A`);
  await page.evaluate(() => {
    const lines = Array.from({ length: 100 }, (_, at) => `Line${at + 1}x`);
    document.execCommand("insertHTML", false, lines.map((line) => `<div>${line}</div>`).join(""));
  });
  await page.waitForTimeout(300);
  const printFrame = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const real = Object.getOwnPropertyDescriptor(
            HTMLIFrameElement.prototype,
            "contentWindow",
          );
          Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
            configurable: true,
            get() {
              const view = real.get.call(this);
              if (view && this.hasAttribute("data-textedit-print")) {
                view.print = () => resolve(this.srcdoc);
              }
              return view;
            },
          });
        }),
    );
  const openSheet = async () => {
    await menu("File");
    await page
      .getByRole("menuitem", { name: /^Print/ })
      .last()
      .click();
    const sheet = page.getByRole("dialog", { name: /print/i });
    await sheet.waitFor();
    return sheet;
  };
  const pdfOf = async (html) => {
    const paper = await page.context().newPage();
    await paper.setContent(html);
    const bytes = await paper.pdf({ preferCSSPageSize: true });
    await paper.close();
    const source = bytes.toString("latin1");
    return (source.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  };

  let sheet = await openSheet();
  await sheet.getByRole("textbox", { name: "From:" }).fill("2");
  await sheet.getByRole("textbox", { name: "to:" }).fill("2");
  await sheet.getByRole("textbox", { name: "Copies:" }).focus();
  let printed = printFrame();
  await sheet.getByRole("button", { name: "Print", exact: true }).click();
  let html = await printed;
  step(
    "From 2 to 2 prints that page of the preview and no other",
    html.includes("Line47x") &&
      html.includes("Line92x") &&
      !html.includes("Line46x") &&
      !html.includes("Line93x"),
  );
  const rangePages = await pdfOf(html);
  step("on paper it is one page", rangePages === 1, `${rangePages} pages`);

  await page.waitForTimeout(300);
  await clearText();
  await page.keyboard.type("short");
  await page.waitForTimeout(200);
  sheet = await openSheet();
  await sheet.getByRole("textbox", { name: "Copies:" }).fill("2");
  await sheet.getByRole("textbox", { name: "From:" }).focus();
  printed = printFrame();
  await sheet.getByRole("button", { name: "Print", exact: true }).click();
  html = await printed;
  const oneSided = await pdfOf(html);
  step(
    "two one-sided copies of a one-page text take two pages",
    oneSided === 2,
    `${oneSided} pages`,
  );

  await page.waitForTimeout(300);
  sheet = await openSheet();
  await sheet.getByRole("textbox", { name: "Copies:" }).fill("2");
  await sheet.getByRole("checkbox", { name: "Two-Sided" }).click();
  step(
    "Two-Sided says the browser's dialog must be told as well",
    await sheet.getByText(/browser.s print dialog/).isVisible(),
  );
  printed = printFrame();
  await sheet.getByRole("button", { name: "Print", exact: true }).click();
  html = await printed;
  const twoSided = await pdfOf(html);
  step(
    "two two-sided copies start on separate sheets: a blank back between them",
    twoSided === 3,
    `${twoSided} pages`,
  );

  // The ruler's menu changes the document, so it goes while the document is held.
  await page.waitForTimeout(500);
  const tabsOf = () => page.locator(".mac-textedit-ruler [data-index]").count();
  const ruler = doc.getByLabel("Ruler");
  const rightOnRuler = async () => {
    const at = await ruler.boundingBox();
    await page.mouse.click(at.x + 200, at.y + at.height / 2, { button: "right" });
    await page.waitForTimeout(250);
  };
  const leftTab = page.getByRole("menuitem", { name: "Left Tab Stop" });
  await rightOnRuler();
  step("the ruler has its menu while the document can change", await leftTab.isVisible());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await menu("Format");
  await page
    .getByRole("menuitem", { name: /^Prevent Editing/ })
    .last()
    .click();
  await page.waitForTimeout(400);
  const tabsHeld = await tabsOf();
  await rightOnRuler();
  step("and none while it is held", (await leftTab.count()) === 0);
  step("nor does the held document change", (await tabsOf()) === tabsHeld);
  await page.keyboard.press("Escape");
  await menu("Format");
  await page
    .getByRole("menuitem", { name: /^Allow Editing/ })
    .last()
    .click();
  await page.waitForTimeout(400);

  // Detector rows, shared with Messages: TextEdit keeps its own Copy label.
  await page.waitForTimeout(300);
  await menu("Edit");
  await page.getByRole("menuitem", { name: "Substitutions" }).last().hover();
  await page.getByRole("menuitemcheckbox", { name: "Data Detectors" }).last().click();
  await page.waitForTimeout(500);
  await clearText();
  await page.keyboard.type("call 415-555-0134 now");
  const word = text.getByText("415-555-0134", { exact: false });
  const place = await word.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const held = walker.nextNode();
    const range = document.createRange();
    range.setStart(held, held.data.indexOf("415") + 2);
    range.setEnd(held, held.data.indexOf("415") + 3);
    const box = range.getBoundingClientRect();
    return { x: box.x + 1, y: box.y + box.height / 2 };
  });
  await page.mouse.click(place.x, place.y, { button: "right" });
  const copy = page.getByRole("menuitem", { name: "Copy “415-555-0134”" });
  await copy.waitFor();
  step("a detected phone number's rows keep TextEdit's Copy label", await copy.isVisible());
  const call = page.getByRole("menuitem", { name: "Call with FaceTime" }).last();
  step(
    "and the shared dimmed call row",
    (await call.getAttribute("title"))?.includes("FaceTime") === true,
  );
  await page.keyboard.press("Escape");
});
