#!/usr/bin/env node
// TextEdit's Preferences window and the context menu of its text, as a fresh Guest User with a
// desktop of its own: every preference the window makes work, read back from the account after a
// reload, then each command of the context menu on the text, the clipboard read back. It deletes
// nothing. `speechSynthesis.speak` is watched, not replaced: the utterance's text is asserted, the
// sound is not. Exits 0 only when every step passed with no console error, page error or failed
// request of the desktop's own.
//
//   node e2e/textedit-preferences-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("textedit-preferences", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const SETTINGS = "/api/system-preferences/settings";
const stamp = Date.now().toString(36);

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
async function choose(page, title, ...items) {
  await menuBar(page, title).click();
  await page.waitForTimeout(200);
  for (const [index, item] of items.entries()) {
    const entry = page.getByRole("menuitem", { name: item }).first();
    if (index < items.length - 1) {
      await entry.hover();
      await page.waitForTimeout(250);
    } else await entry.click();
  }
  await page.waitForTimeout(250);
}
async function settled(read, test) {
  let value;
  for (let i = 0; i < 40; i++) {
    value = await read();
    if (test(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return value;
}
const json = (page, url) =>
  page.evaluate(async (at) => (await fetch(at, { credentials: "same-origin" })).json(), url);
const values = async (page) => (await json(page, SETTINGS)).values ?? {};
const driveFile = async (page, name) =>
  ((await json(page, "/api/files/")).entries ?? []).find(
    (entry) => entry.name === name && !entry.trashed_ms,
  );
const fileText = (page, id) =>
  page.evaluate(
    async (at) =>
      (
        await fetch(`/api/files/content/${encodeURIComponent(at)}?piece=0&count=8`, {
          credentials: "same-origin",
        })
      ).text(),
    id,
  );
/** Put a file on the guest's drive, as Finder's upload does. */
const upload = (page, name, text) =>
  page.evaluate(
    async ({ name, text }) => {
      const { entries } = await (await fetch("/api/files/", { credentials: "same-origin" })).json();
      const parent = entries.find((entry) => entry.name === "Documents")?.id;
      const blob = new Blob([text], { type: "text/html" });
      const headers = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ parent, name, size: blob.size, type: blob.type }),
      });
      const { upload: id } = await started.json();
      await fetch(`/api/files/uploads/${id}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: blob,
      });
      await fetch(`/api/files/uploads/${id}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: "{}",
      });
    },
    { name, text },
  );

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await page.addInitScript(() => {
    window.__spoken = [];
    window.__stopped = 0;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const speak = synth.speak.bind(synth);
    const cancel = synth.cancel.bind(synth);
    synth.speak = (utterance) => {
      window.__spoken.push(utterance.text);
      speak(utterance);
    };
    synth.cancel = () => {
      window.__stopped += 1;
      cancel();
    };
  });
  await openDesktop(page, base, step);
  const htmlName = `Page ${stamp}.html`;
  await upload(page, htmlName, "<p>Formatted <b>page</b></p>");
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  const window = page.locator('.mac-managed-window[data-window-id="textedit"]');
  const doc = window.getByRole("textbox", { name: "Document" });
  await doc.waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  const panel = page.locator(
    '.mac-managed-window[data-window-id^="textedit"][data-window-id$="preferences"]',
  );
  const isPlain = () => doc.evaluate((node) => node.tagName === "TEXTAREA");
  const text = () =>
    doc.evaluate((node) => (node.tagName === "TEXTAREA" ? node.value : node.innerText));

  const openPreferences = async (tab) => {
    await choose(page, "TextEdit", /^Preferences/);
    await panel.waitFor({ state: "visible" });
    if (tab) await panel.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(150);
  };
  const closePreferences = async () => {
    await panel.getByRole("button", { name: /close/i }).first().click();
    await panel.waitFor({ state: "hidden" });
  };
  const pick = async (label, option) => {
    await panel
      .getByRole("button", { name: label, exact: true })
      .or(panel.getByRole("combobox", { name: label, exact: true }))
      .first()
      .click();
    await page.getByRole("option", { name: option, exact: true }).click();
    await page.waitForTimeout(100);
  };
  const newDocument = async () => {
    await choose(page, "File", /^New/);
    await page.waitForTimeout(300);
  };
  const saveAs = async (expectedName, name) => {
    await choose(page, "File", /^Save/);
    const sheet = page.getByRole("dialog", { name: "Save" }).last();
    await sheet.waitFor({ state: "visible" });
    const field = sheet.getByLabel("Save As:");
    const shown = await field.inputValue();
    await field.fill(name);
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await sheet.waitFor({ state: "hidden" });
    return shown === expectedName ? null : shown;
  };

  // ── Preferences: both tabs, each change kept for the account ──
  await openPreferences();
  step(
    "TextEdit > Preferences opens New Document and Open and Save tabs",
    (await panel.getByRole("tab").allInnerTexts()).join("|") === "New Document|Open and Save",
  );
  await panel.getByRole("radio", { name: "Plain text" }).click();
  await pick("Plain text font size", "18");
  await pick("Rich text font", "Georgia");
  await pick("Rich text font size", "24");
  await panel.getByRole("checkbox", { name: "Show ruler" }).click();
  await panel.getByRole("checkbox", { name: "Check spelling as you type" }).click();
  step(
    "what is not built is dimmed, and says why",
    (await panel.getByRole("checkbox", { name: "Smart quotes" }).getAttribute("aria-disabled")) ===
      "true" && (await panel.locator('[title*="does not make this change"]').count()) > 0,
  );
  await shot(page, path.join(out, "textedit-preferences-new-document.png"));
  await panel.getByRole("tab", { name: "Open and Save" }).click();
  await panel.getByRole("checkbox", { name: /RTF code/ }).click();
  await panel.getByRole("checkbox", { name: /HTML code/ }).click();
  await panel.getByRole("checkbox", { name: /\.txt/ }).click();
  await shot(page, path.join(out, "textedit-preferences-open-save.png"));
  let saved = await settled(
    () => values(page),
    (each) => each["textedit.addTxtExtension"] === false,
  );
  step(
    "the account holds what was chosen",
    saved["textedit.newFormat"] === "plain" &&
      saved["textedit.plainFontSize"] === 18 &&
      saved["textedit.richFontFamily"] === "Georgia" &&
      saved["textedit.richFontSize"] === 24 &&
      saved["textedit.showRuler"] === false &&
      saved["textedit.checkSpelling"] === false &&
      saved["textedit.rtfAsCode"] === true &&
      saved["textedit.htmlAsCode"] === true,
    JSON.stringify(saved),
  );
  await closePreferences();

  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await doc.waitFor({ state: "visible" });
  await page.waitForTimeout(800);
  await openPreferences();
  step(
    "after a reload the window shows them again",
    (await panel.getByRole("radio", { name: "Plain text" }).getAttribute("aria-checked")) ===
      "true" &&
      (await panel.getByRole("checkbox", { name: "Show ruler" }).getAttribute("aria-checked")) ===
        "false",
  );
  await shot(page, path.join(out, "textedit-preferences-after-reload.png"));
  await closePreferences();

  const other = await page.context().browser().newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(`${base}/`, { waitUntil: "load" });
  await otherPage
    .getByRole("button", { name: /^Guest User$/ })
    .first()
    .click({ timeout: 40_000 });
  await otherPage
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 20_000 });
  const others = await values(otherPage);
  step(
    "another Guest User has none of them",
    !Object.keys(others).some((key) => key.startsWith("textedit.")),
    JSON.stringify(others),
  );
  await other.close();

  // ── New Document: the plain text format and font, the ruler, spelling ──
  await newDocument();
  step("File > New makes a plain text document", await isPlain());
  step(
    "plain text shows in the font chosen",
    (await doc.evaluate((node) => getComputedStyle(node).fontSize)) === "18px",
  );
  step("spell checking is off in the document", (await doc.getAttribute("spellcheck")) === "false");
  await doc.click();
  await page.keyboard.type(`Plain ${stamp}`);
  await shot(page, path.join(out, "textedit-new-plain-document.png"));

  // ── When saving: no .txt added ──
  const bare = `Bare ${stamp}`;
  const shownBare = await saveAs("Untitled", bare);
  step(
    "with the .txt preference off the Save sheet adds none",
    shownBare === null,
    shownBare ?? "",
  );
  const bareFile = await settled(
    () => driveFile(page, bare),
    (entry) => entry !== undefined,
  );
  step(
    "the file is on the drive under that very name, holding the text",
    bareFile !== undefined && (await fileText(page, bareFile.id)) === `Plain ${stamp}`,
  );

  // ── New Document: the rich text font; the ruler stays hidden ──
  await openPreferences();
  await panel.getByRole("radio", { name: "Rich text" }).click();
  await closePreferences();
  await newDocument();
  step("File > New now makes rich text", !(await isPlain()));
  step("Show ruler off hides the ruler", (await page.getByLabel("Ruler").count()) === 0);
  await doc.click();
  await page.keyboard.type("Georgia text");
  await page.keyboard.press("Enter");
  await page.keyboard.type("second line");
  await page.waitForTimeout(200);
  const typed = (word) =>
    doc.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let at = walker.nextNode(); at; at = walker.nextNode()) {
        if (at.nodeValue.includes(wanted)) {
          const style = getComputedStyle(at.parentElement);
          return `${style.fontFamily.split(",")[0]} ${style.fontSize}`;
        }
      }
      return "";
    }, word);
  step(
    "the new document types in the rich text font, on every line",
    /Georgia/.test(await typed("Georgia text")) &&
      (await typed("Georgia text")).endsWith("24px") &&
      (await typed("second line")).endsWith("24px"),
    `${await typed("Georgia text")} / ${await typed("second line")}`,
  );
  await shot(page, path.join(out, "textedit-new-rich-font.png"));
  const fontName = `Font ${stamp}`;
  const shownRtf = await saveAs("Untitled.rtf", fontName);
  step("a rich text document's Save sheet still names .rtf", shownRtf === null, shownRtf ?? "");
  const fontFile = await settled(
    () => driveFile(page, `${fontName}.rtf`),
    (entry) => entry !== undefined,
  );
  const rtf = fontFile ? await fileText(page, fontFile.id) : "";
  step(
    "the RTF file keeps the font: Georgia at 48 half-points",
    rtf.includes("Georgia") && rtf.includes("\\fs48"),
    rtf.slice(0, 160),
  );

  // ── When opening: code instead of formatted text ──
  await newDocument();
  await choose(page, "File", "Open Recent", `${fontName}.rtf`);
  await settled(
    () => text(),
    (each) => each.startsWith("{\\rtf"),
  );
  step(
    "an RTF file opens as its code",
    (await isPlain()) &&
      (await text()).startsWith("{\\rtf") &&
      (await text()).includes("Georgia text"),
  );
  await shot(page, path.join(out, "textedit-rtf-as-code.png"));
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await doc.waitFor({ state: "visible" });
  await settled(
    () => text(),
    (each) => each.startsWith("{\\rtf"),
  );
  step("it is still its code after a reload", (await text()).startsWith("{\\rtf"));
  await choose(page, "File", "Open Recent", htmlName);
  await settled(
    () => text(),
    (each) => each.startsWith("<p>"),
  );
  step(
    "an HTML file opens as its code",
    (await isPlain()) && (await text()) === "<p>Formatted <b>page</b></p>",
    await text(),
  );

  // ── Restore All Defaults, then the file opens formatted ──
  await openPreferences("Open and Save");
  await panel.getByRole("button", { name: "Restore All Defaults" }).click();
  await panel.getByRole("tab", { name: "New Document" }).click();
  await panel.getByRole("button", { name: "Restore All Defaults" }).click();
  saved = await settled(
    () => values(page),
    (each) => each["textedit.showRuler"] === true && each["textedit.rtfAsCode"] === false,
  );
  step(
    "Restore All Defaults puts each tab's values back",
    saved["textedit.newFormat"] === "rich" &&
      saved["textedit.plainFontSize"] === 11 &&
      saved["textedit.richFontFamily"] === "Helvetica" &&
      saved["textedit.addTxtExtension"] === true,
    JSON.stringify(saved),
  );
  await closePreferences();
  await choose(page, "File", "Open Recent", `${fontName}.rtf`);
  await settled(
    () => isPlain(),
    (each) => !each,
  );
  step("with the defaults an RTF file opens formatted again", !(await isPlain()));

  // ── The context menu ──
  await newDocument();
  await doc.click();
  await page.keyboard.type("Hello Catalina world");
  await page.waitForTimeout(200);
  /** Selects `word` in the document, and returns the middle of it. */
  const select = (word) =>
    doc.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let at = walker.nextNode(); at; at = walker.nextNode()) {
        const start = at.nodeValue.indexOf(wanted);
        if (start < 0) continue;
        const range = document.createRange();
        range.setStart(at, start);
        range.setEnd(at, start + wanted.length);
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const box = range.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      }
      return null;
    }, word);
  const menuOn = async (word) => {
    const at = await select(word);
    await page.waitForTimeout(100);
    await page.mouse.click(at.x, at.y, { button: "right" });
    await page.getByRole("menu", { name: "Text commands" }).waitFor({ state: "visible" });
    await page.waitForTimeout(100);
  };
  const item = (name) => page.getByRole("menuitem", { name });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  await menuOn("Catalina");
  step(
    "the text's context menu names the selection in Look Up",
    await item("Look Up “Catalina”").isVisible(),
  );
  await shot(page, path.join(out, "textedit-context-menu.png"));
  await item("Copy").click();
  await page.waitForTimeout(250);
  step("Copy puts the selection on the clipboard", (await clipboard()) === "Catalina");

  await menuOn("world");
  await item("Cut").click();
  await page.waitForTimeout(250);
  step(
    "Cut moves the selection to the clipboard",
    (await clipboard()) === "world" && (await text()).trim() === "Hello Catalina",
    await text(),
  );

  await menuOn("Hello");
  await item("Paste").click();
  await settled(
    () => text(),
    (each) => each.startsWith("world"),
  );
  step(
    "Paste puts the clipboard in place of the selection",
    (await text()).trim() === "world Catalina",
    await text(),
  );
  await shot(page, path.join(out, "textedit-context-paste.png"));

  const styleOf = (word) =>
    doc.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let at = walker.nextNode(); at; at = walker.nextNode()) {
        if (!at.nodeValue.includes(wanted)) continue;
        const style = getComputedStyle(at.parentElement);
        let underline = false;
        for (let up = at.parentElement; up && up !== node; up = up.parentElement) {
          underline ||= getComputedStyle(up).textDecorationLine.includes("underline");
        }
        return { weight: Number(style.fontWeight), italic: style.fontStyle, underline };
      }
      return null;
    }, word);
  const fontCommand = async (word, command) => {
    await menuOn(word);
    await item("Font").hover();
    await item(command).waitFor({ state: "visible" });
    await page.waitForTimeout(150);
    if (command === "Italic") await shot(page, path.join(out, "textedit-context-font.png"));
    await item(command).click();
    await page.waitForTimeout(300);
  };
  await fontCommand("Catalina", "Bold");
  step("Font > Bold makes the selection bold", (await styleOf("Catalina")).weight >= 700);
  await fontCommand("Catalina", "Italic");
  step("Font > Italic makes it italic", (await styleOf("Catalina")).italic === "italic");
  await fontCommand("Catalina", "Underline");
  step("Font > Underline underlines it", (await styleOf("Catalina")).underline === true);
  await fontCommand("Catalina", "Show Fonts");
  const fonts = page.locator(".mac-font-panel").first();
  step("Font > Show Fonts opens the Fonts panel", await fonts.isVisible());
  await shot(page, path.join(out, "textedit-context-show-fonts.png"));
  await fontCommand("Catalina", "Show Fonts");
  await page.waitForTimeout(200);

  await menuOn("Catalina");
  await item("Speech").hover();
  await item("Start Speaking").waitFor({ state: "visible" });
  await page.waitForTimeout(150);
  await shot(page, path.join(out, "textedit-context-speech.png"));
  await item("Start Speaking").click();
  await page.waitForTimeout(200);
  step(
    "Speech > Start Speaking speaks the selection",
    (await page.evaluate(() => window.__spoken.at(-1))) === "Catalina",
  );
  const stoppedBefore = await page.evaluate(() => window.__stopped);
  await menuOn("Catalina");
  await item("Speech").hover();
  await item("Stop Speaking").waitFor({ state: "visible" });
  await page.waitForTimeout(150);
  await item("Stop Speaking").click();
  await page.waitForTimeout(150);
  step(
    "Speech > Stop Speaking stops it",
    (await page.evaluate(() => window.__stopped)) > stoppedBefore,
  );

  await menuOn("Catalina");
  await item(/^Look Up/).click();
  const dictionary = page.locator('.mac-managed-window[data-window-id="dictionary"]');
  await dictionary.waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  const dictionaryField = await dictionary.locator("input").first().inputValue();
  step(
    "Look Up opens Dictionary on the selection",
    dictionaryField === "Catalina",
    dictionaryField,
  );
  await shot(page, path.join(out, "textedit-context-look-up.png"));

  await launch(page, "TextEdit");
  await page.waitForTimeout(300);
  await menuOn("Catalina");
  await item("Search with Google").click();
  const safari = page.locator('.mac-managed-window[data-window-id="safari"]');
  await safari.waitFor({ state: "visible" });
  const tabs = await settled(
    () => json(page, "/api/safari/tabs").then((each) => JSON.stringify(each)),
    (each) => each.includes("google.com/search?q=Catalina"),
  );
  step(
    "Search with Google opens a tab of Safari on Google's results",
    tabs.includes("google.com/search?q=Catalina"),
    tabs.slice(0, 200),
  );
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "textedit-context-google.png"));

  // What the menu did is the document's, across a reload.
  await page.waitForTimeout(1000);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await doc.waitFor({ state: "visible" });
  const kept = await settled(
    () => text(),
    (each) => each.includes("Catalina"),
  );
  step("the pasted text and the formats survive a reload", kept.trim() === "world Catalina", kept);
  step(
    "Catalina is still bold, italic and underlined",
    (await styleOf("Catalina")).weight >= 700 &&
      (await styleOf("Catalina")).italic === "italic" &&
      (await styleOf("Catalina")).underline === true,
  );
});
