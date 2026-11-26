#!/usr/bin/env node
// TextEdit's rows beyond the format bar on the desktop: Font's Outline, Kern, Ligatures, Baseline and
// copied style; Edit's Insert and Add Link. Each is chosen from the menu bar, read back from the page,
// and the whole survives a reload.
//
//   node e2e/textedit-rich-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("textedit-rich");
const stamp = Date.now().toString(36);

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await openDesktop(page, base, step);
  await launch(page, "TextEdit");
  // File > Open and File > New make a window of their own: the journey follows the newest.
  const window = page.locator('[data-window-id^="textedit"]').last();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  const bar = page.getByRole("menubar");
  /** Waits until the window's document, read back from the draft, holds `words`. */
  const holds = (words) =>
    page.waitForFunction(
      (wanted) =>
        [...document.querySelectorAll('[data-window-id^="textedit"] [aria-label="Document"]')]
          .at(-1)
          ?.textContent.includes(wanted),
      words,
      { timeout: 15_000 },
    );
  /** Chooses `path` from the menu bar: a menu, its submenus, the row. */
  const choose = async (...names) => {
    await bar.getByRole("menuitem", { name: names[0], exact: true }).click();
    await page.waitForTimeout(200);
    for (const name of names.slice(1)) {
      await page
        .getByRole("menuitem", { name: new RegExp(`^${name}`) })
        .last()
        .click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(250);
  };
  const typeFresh = async (words) => {
    await text.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(words);
    await page.keyboard.press("ControlOrMeta+A");
    await page.waitForTimeout(150);
  };
  /** A computed style of the character at the selection's start. */
  const styleHere = (name) =>
    text.evaluate((node, property) => {
      const range = document.getSelection().getRangeAt(0);
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let at = walker.nextNode();
      while (at && !range.intersectsNode(at)) at = walker.nextNode();
      return getComputedStyle(at?.parentElement ?? node).getPropertyValue(property);
    }, name);

  await typeFresh(`Plain ${stamp}`);
  const first = Number.parseFloat(await styleHere("letter-spacing")) || 0;
  await choose("Format", "Font", "Kern", "Loosen");
  const loosened = Number.parseFloat(await styleHere("letter-spacing"));
  step("Kern > Loosen spaces the letters", loosened === first + 0.5, String(loosened));
  const selected = await page.evaluate(() => document.getSelection().toString());
  step("the text stays selected", selected.includes(stamp), selected);
  await choose("Format", "Font", "Kern", "Tighten");
  step(
    "Kern > Tighten takes it back",
    (Number.parseFloat(await styleHere("letter-spacing")) || 0) === first,
    await styleHere("letter-spacing"),
  );
  await choose("Format", "Font", "Kern", "Use None");
  step("Kern > Use None", (await styleHere("font-kerning")) === "none");
  await choose("Format", "Font", "Kern", "Use Default");
  step("Kern > Use Default", (await styleHere("letter-spacing")) === "normal");

  await choose("Format", "Font", "Ligatures", "Use None");
  step("Ligatures > Use None", (await styleHere("font-variant-ligatures")) === "none");
  await choose("Format", "Font", "Ligatures", "Use All");
  step(
    "Ligatures > Use All",
    (await styleHere("font-variant-ligatures")).includes("discretionary-ligatures"),
  );

  await choose("Format", "Font", "Baseline", "Superscript");
  step("Baseline > Superscript", (await styleHere("vertical-align")) === "super");
  await choose("Format", "Font", "Baseline", "Subscript");
  step("Baseline > Subscript", (await styleHere("vertical-align")) === "sub");
  await choose("Format", "Font", "Baseline", "Use Default");
  await choose("Format", "Font", "Baseline", "Raise");
  step("Baseline > Raise", (await styleHere("vertical-align")) === "1px");
  await choose("Format", "Font", "Baseline", "Lower");
  step("Baseline > Lower", (await styleHere("vertical-align")) === "0px");

  await choose("Format", "Font", "Outline");
  step("Outline draws the letters' edge", (await styleHere("-webkit-text-stroke-width")) !== "0px");
  await text.focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await page.waitForTimeout(200);
  step("Undo takes Outline away", (await styleHere("-webkit-text-stroke-width")) === "0px");

  // Copy Style from loosened text, Paste Style on other text.
  await typeFresh("First");
  await choose("Format", "Font", "Kern", "Loosen");
  await choose("Format", "Font", "Copy Style");
  await typeFresh("Second");
  await choose("Format", "Font", "Kern", "Use Default");
  step(
    "the target of Paste Style starts without the style",
    (await styleHere("letter-spacing")) === "normal",
  );
  await choose("Format", "Font", "Paste Style");
  step("Paste Style gives the copied style", (await styleHere("letter-spacing")) === "0.5px");

  /** Selects the characters `from` to `to` of the document's text. */
  const selectChars = (from, to) =>
    text.evaluate(
      (node, [start, end]) => {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let at = 0;
        let placed = false;
        for (let each = walker.nextNode(); each; each = walker.nextNode()) {
          const length = each.nodeValue.length;
          if (!placed && start < at + length) {
            range.setStart(each, start - at);
            placed = true;
          }
          if (end <= at + length) {
            range.setEnd(each, end - at);
            break;
          }
          at += length;
        }
        node.focus();
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      },
      [from, to],
    );
  /** Whether the character at `index` is shifted or decorated by any element holding it. */
  const charStyle = (index) =>
    text.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let at = 0;
      for (let each = walker.nextNode(); each; each = walker.nextNode()) {
        if (wanted < at + each.nodeValue.length) {
          const aligned = [];
          const lines = [];
          for (let up = each.parentElement; up && up !== node; up = up.parentElement) {
            const style = getComputedStyle(up);
            if (style.verticalAlign !== "baseline") aligned.push(style.verticalAlign);
            if (style.textDecorationLine !== "none") lines.push(style.textDecorationLine);
          }
          return { aligned, lines };
        }
        at += each.nodeValue.length;
      }
      return null;
    }, index);

  // A character in the middle of a superscript word goes back to the line, its neighbours stay.
  /** How far above the last character of the text a character stands, in unzoomed pixels. */
  const raisedBy = (index) =>
    text.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const chars = [];
      for (let each = walker.nextNode(); each; each = walker.nextNode()) {
        for (let at = 0; at < each.nodeValue.length; at += 1) chars.push([each, at]);
      }
      const box = ([holder, at]) => {
        const range = document.createRange();
        range.setStart(holder, at);
        range.setEnd(holder, at + 1);
        return range.getBoundingClientRect().bottom;
      };
      const zoom = Number(getComputedStyle(node).zoom) || 1;
      return (box(chars.at(-1)) - box(chars[wanted])) / zoom;
    }, index);
  await typeFresh("Moved");
  await choose("Format", "Font", "Baseline", "Use Default");
  for (const [row, then, sign] of [
    ["Superscript", "Raise", 1],
    ["Subscript", "Lower", -1],
  ]) {
    await selectChars(0, 2);
    await choose("Format", "Font", "Baseline", row);
    const before = await raisedBy(0);
    await selectChars(0, 2);
    await choose("Format", "Font", "Baseline", then);
    const after = await raisedBy(0);
    const moved = (after - before) * sign;
    step(
      `Baseline > ${then} moves ${row} text one pixel, not back to the line`,
      moved > 0.4 && moved < 1.6 && Math.abs(after) > 1.5,
      `${before} to ${after}`,
    );
  }

  // A document as the draft holds it, read back through a reload: the states no menu row makes.
  const loadDraft = async (html, lines) => {
    await page.waitForTimeout(1500);
    const { json } = await api(page, "GET", "/api/textedit/draft");
    const saved = await api(page, "PUT", "/api/textedit/draft", {
      draft: { name: "Untitled", format: "rich", lines, html, edited: true },
      rev: json.rev,
    });
    step(`the draft takes ${lines.at(-1)}`, saved.status === 200, String(saved.status));
    await page.reload();
    await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
    await launch(page, "TextEdit");
    await text.waitFor({ timeout: 10_000 });
    await holds(lines.at(-1));
  };

  // Red superscript: the middle character goes back to the line and stays red.
  await loadDraft('<div><sup style="color: rgb(255, 0, 0)">Word</sup></div>', ["Word"]);
  await selectChars(1, 2);
  await choose("Format", "Font", "Baseline", "Use Default");
  const redOf = (index) =>
    text.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let at = 0;
      for (let each = walker.nextNode(); each; each = walker.nextNode()) {
        if (wanted < at + each.nodeValue.length) return getComputedStyle(each.parentElement).color;
        at += each.nodeValue.length;
      }
      return null;
    }, index);
  const reds = [await redOf(0), await redOf(1), await redOf(2)];
  const redShift = [await charStyle(0), await charStyle(1), await charStyle(2)];
  step(
    "Use Default on red superscript keeps the colour",
    reds.every((each) => each === "rgb(255, 0, 0)") &&
      redShift[1].aligned.every((each) => each !== "super") &&
      (await text.evaluate((node) => node.querySelectorAll("sup").length)) === 2,
    JSON.stringify({ reds, redShift }),
  );

  // A paragraph's own underline: Paste Style takes it off the selection alone.
  const setDocument = (html) =>
    text.evaluate((node, markup) => {
      node.innerHTML = markup;
      node.dispatchEvent(new InputEvent("input", { bubbles: true }));
      const range = document.createRange();
      range.selectNodeContents(node);
      node.focus();
      const selection = document.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }, html);
  await loadDraft(
    '<div>Clean</div><div style="text-decoration-line: underline line-through">Stored</div>',
    ["Clean", "Stored"],
  );
  await selectChars(0, 5);
  await choose("Format", "Font", "Copy Style");
  await selectChars(6, 8);
  await choose("Format", "Font", "Paste Style");
  const onBlock = [await charStyle(5), await charStyle(6), await charStyle(9)];
  step(
    "Paste Style takes a paragraph's decoration off the selection alone",
    onBlock[0].lines.join().includes("underline") &&
      onBlock[1].lines.join() === "" &&
      onBlock[2].lines.join().includes("line-through"),
    JSON.stringify(onBlock),
  );
  await typeFresh("Word");
  await choose("Format", "Font", "Baseline", "Use Default");
  await choose("Format", "Font", "Baseline", "Superscript");
  await selectChars(1, 2);
  await choose("Format", "Font", "Baseline", "Use Default");
  const baselines = [await charStyle(0), await charStyle(1), await charStyle(2)];
  step(
    "Use Default on the middle of a superscript word",
    baselines[0].aligned.includes("super") &&
      baselines[1].aligned.every((each) => each !== "super") &&
      baselines[2].aligned.includes("super"),
    JSON.stringify(baselines),
  );

  // SUP and SUB as a file opens them: from the RTF reader, through File > Open. A new baseline on
  // part of each leaves the characters' size and the neighbours.
  const rtfName = `Scripts ${stamp}.rtf`;
  await page.evaluate(
    async ({ name, rtf }) => {
      const json = { "content-type": "application/json" };
      const blob = new Blob([rtf], { type: "text/rtf" });
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent: "documents", name, size: blob.size, type: "text/rtf" }),
      });
      const { upload } = await started.json();
      await fetch(`/api/files/uploads/${upload}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: blob,
      });
      await fetch(`/api/files/uploads/${upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
    },
    { name: rtfName, rtf: "{\\rtf1\\ansi\\deff0 {\\super Upper} {\\sub Lower}}" },
  );
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await choose("File", "Open…");
  const openPanel = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("button", { name: "Open", exact: true }) })
    .last();
  await openPanel.waitFor();
  await openPanel.getByText("Documents", { exact: true }).first().click();
  await openPanel
    .getByText(rtfName.replace(/\.rtf$/, ""))
    .first()
    .click();
  await openPanel.getByRole("button", { name: "Open", exact: true }).click();
  const keep = page.getByRole("button", { name: /Don.t Save/ });
  await keep.click({ timeout: 2_000 }).catch(() => {});
  await holds("Lower");
  step(
    "the file opens with SUP and SUB",
    await text.evaluate(
      (node) => node.querySelector("sup") !== null && node.querySelector("sub") !== null,
    ),
    await text.evaluate((node) => node.innerHTML),
  );
  const sizeOf = (index) =>
    text.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let at = 0;
      for (let each = walker.nextNode(); each; each = walker.nextNode()) {
        if (wanted < at + each.nodeValue.length)
          return getComputedStyle(each.parentElement).fontSize;
        at += each.nodeValue.length;
      }
      return null;
    }, index);
  for (const [row, from, label] of [
    ["Use Default", 1, "SUP"],
    ["Raise", 7, "SUB"],
    ["Use Default", 8, "SUB"],
    ["Raise", 2, "SUP"],
  ]) {
    const size = await sizeOf(from);
    const beside = await sizeOf(from + 1);
    await selectChars(from, from + 1);
    await choose("Format", "Font", "Baseline", row);
    step(
      `${row} on part of ${label} keeps the size, and the next character's`,
      (await sizeOf(from)) === size && (await sizeOf(from + 1)) === beside,
      `${size} to ${await sizeOf(from)}`,
    );
  }
  const shifted = (await charStyle(1)).aligned;
  await text.focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await page.waitForTimeout(200);
  step("Undo takes the last of them back", (await charStyle(2)).aligned.includes("super"));
  await page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith("/complete") && response.ok(),
    { timeout: 15_000 },
  );
  await page.waitForTimeout(500);
  // A write answered after the reload comes back refused, and the document sees it holds that text.
  expectRefusal(412, "/api/files/uploads");
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await holds("Lower");
  step(
    "what was changed survives a reload",
    (await charStyle(1)).aligned.join() === shifted.join(),
    JSON.stringify(shifted),
  );

  // The rest are in a document with no file: a draft keeps what an RTF file does not.
  const count = await page.locator('[data-window-id^="textedit"]').count();
  await choose("File", "New");
  await page.waitForFunction(
    (before) => document.querySelectorAll('[data-window-id^="textedit"]').length > before,
    count,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(500);

  // A selection that starts at the end of the run before it reads the run it holds.
  await setDocument(
    '<div><span style="letter-spacing: 2px">Aa</span><span style="letter-spacing: 4px">Bb</span></div>',
  );
  await text.evaluate((node) => {
    const [one, two] = node.querySelectorAll("span");
    const range = document.createRange();
    range.setStart(one.firstChild, 2);
    range.setEnd(two.firstChild, 2);
    node.focus();
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await choose("Format", "Font", "Kern", "Loosen");
  const loosenedRun = await text.evaluate((node) => {
    const at = node.querySelectorAll("span");
    return getComputedStyle(at[at.length - 1]).letterSpacing;
  });
  step(
    "Loosen starts from the run selected, not the one before it",
    loosenedRun === "4.5px",
    loosenedRun,
  );

  // Rich text: what is typed after a Page Break prints on the next page, also after a reload.
  const capturePrint = () =>
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
                view.print = () => {
                  const rows = [...this.contentDocument.body.children].map((each) => [
                    each.textContent,
                    view.getComputedStyle(each).breakAfter,
                    view.getComputedStyle(each).breakBefore,
                  ]);
                  resolve(rows);
                };
              }
              return view;
            },
          });
        }),
    );
  const printRows = async () => {
    const printing = capturePrint();
    await choose("File", "Print");
    const printSheet = page.getByRole("dialog", { name: /print/i });
    await printSheet.waitFor();
    await printSheet.getByRole("button", { name: "Print", exact: true }).click();
    return printing;
  };
  const broken = (rows) => {
    const before = rows.findIndex((each) => each[0].includes("Before"));
    const after = rows.findIndex((each) => each[0].includes("After"));
    const mark = rows.findIndex((each) => each[1] === "page");
    return before >= 0 && before < mark && mark < after;
  };
  await setDocument("<div><br></div>");
  await text.click();
  await page.keyboard.type("Before");
  await choose("Edit", "Insert", "Page Break");
  await page.keyboard.type("After");
  let rows = await printRows();
  step("text typed after a Page Break prints on the next page", broken(rows), JSON.stringify(rows));
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await holds("After");
  // The windows come back, in no fixed order: the Window menu brings the document's forward.
  const onTop = () =>
    page.evaluate(() => {
      const all = [...document.querySelectorAll('[data-window-id^="textedit"]')];
      const depth = (each) => Number(getComputedStyle(each).zIndex);
      return all.every((each) => depth(each) <= depth(all.at(-1)));
    });
  for (let tries = 0; tries < 6 && !(await onTop()); tries += 1) {
    await bar.getByRole("menuitem", { name: "Window", exact: true }).click();
    const listed = page.getByRole("menuitemcheckbox");
    await listed.first().waitFor();
    await listed.nth(tries % (await listed.count())).click();
    await page.waitForTimeout(500);
  }
  rows = await printRows();
  step("and after a reload", broken(rows), JSON.stringify(rows));

  // Superscript bold text: its style pastes with both, and they are in the draft.
  await setDocument("<div><sup><b>Word</b></sup></div>");
  await selectChars(0, 4);
  await choose("Format", "Font", "Copy Style");
  await setDocument("<div>Ordinary</div>");
  await selectChars(0, 8);
  await choose("Format", "Font", "Paste Style");
  const heldStyle = async () => ({
    shift: (await charStyle(0)).aligned,
    weight: await text.evaluate((node) => {
      const at = document.createTreeWalker(node, NodeFilter.SHOW_TEXT).nextNode();
      return getComputedStyle(at.parentElement).fontWeight;
    }),
  });
  const pasted = await heldStyle();
  step(
    "Paste Style carries a superscript of an outer element, and bold",
    pasted.shift.includes("super") && pasted.weight === "700",
    JSON.stringify(pasted),
  );
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await holds("Ordinary");
  const reloadedStyle = await heldStyle();
  step(
    "they survive a reload",
    reloadedStyle.shift.includes("super") && reloadedStyle.weight === "700",
    JSON.stringify(reloadedStyle),
  );

  // Nested paragraphs, the inner one with an underline of its own: both lines reach its text, and
  // Undo gives the look back.
  await loadDraft(
    '<div>Clean</div><div style="text-decoration-line: underline line-through"><div style="text-decoration-line: underline">Nested</div></div>',
    ["Clean", "Nested"],
  );
  await selectChars(0, 5);
  await choose("Format", "Font", "Copy Style");
  await selectChars(6, 8);
  await choose("Format", "Font", "Paste Style");
  const nested = [await charStyle(5), await charStyle(6), await charStyle(9)];
  step(
    "Paste Style on nested paragraphs takes both lines off the selection alone",
    nested[0].lines.join().includes("underline line-through") &&
      nested[1].lines.join() === "" &&
      nested[2].lines.join().includes("underline line-through"),
    JSON.stringify(nested),
  );
  await text.focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await page.waitForTimeout(200);
  const restored = await charStyle(6);
  step(
    "Undo gives the selection its lines back",
    restored.lines.join().includes("underline line-through"),
    JSON.stringify(restored),
  );

  // Paste Style from undecorated text takes an underline off part of underlined text only.
  await setDocument("<div>Clean</div>");
  await choose("Format", "Font", "Copy Style");
  await setDocument("<div>Lined</div>");
  await page.keyboard.press("ControlOrMeta+U");
  await page.waitForTimeout(150);
  await selectChars(1, 3);
  await choose("Format", "Font", "Paste Style");
  const decorated = [await charStyle(0), await charStyle(1), await charStyle(3)];
  step(
    "Paste Style takes the underline off the selection and leaves the rest",
    decorated[0].lines.join().includes("underline") &&
      !decorated[1].lines.join().includes("underline") &&
      decorated[2].lines.join().includes("underline"),
    JSON.stringify(decorated),
  );

  // Pasted ordinary text still follows a later colour (the format bar's colour well runs foreColor).
  await typeFresh("Tinted");
  await choose("Format", "Font", "Paste Style");
  await window.getByLabel("Text color").fill("#ff0000");
  await page.waitForTimeout(150);
  step(
    "pasted text takes a later colour",
    (await styleHere("-webkit-text-fill-color")) === "rgb(255, 0, 0)",
    await styleHere("-webkit-text-fill-color"),
  );

  // Insert.
  const lines = () => text.evaluate((node) => node.innerText);
  await typeFresh("Before");
  await page.keyboard.press("ControlOrMeta+End");
  await choose("Edit", "Insert", "Line Break");
  await page.keyboard.type("after line");
  step("Insert > Line Break", (await lines()).includes("Before\nafter line"), await lines());
  await choose("Edit", "Insert", "Paragraph Break");
  await page.keyboard.type("next paragraph");
  step(
    "Insert > Paragraph Break makes a paragraph",
    await text.evaluate((node) =>
      [...node.children].some((each) => each.textContent === "next paragraph"),
    ),
    await text.evaluate((node) => node.innerHTML),
  );
  await choose("Edit", "Insert", "Page Break");
  step(
    "Insert > Page Break",
    await text.evaluate((node) => node.querySelector("[data-page-break]") !== null),
  );

  // Add Link.
  await typeFresh(`Linked ${stamp}`);
  await choose("Edit", "Add Link");
  const sheet = page.getByRole("dialog", { name: "Add a link" });
  const address = sheet.getByRole("textbox");
  await address.fill("javascript:alert(1)");
  step(
    "Add Link refuses what is not a web address",
    await sheet.getByRole("button", { name: "OK" }).isDisabled(),
  );
  await address.fill("https://example.com/link");
  await sheet.getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(400);
  const anchor = text.locator("a");
  step(
    "Add Link makes the selected text a link",
    (await anchor.getAttribute("href")) === "https://example.com/link" &&
      (await anchor.innerText()).includes(stamp),
  );
  await shot(page, path.join(out, "textedit-rich-link.png"));

  // Paste Style from undecorated text on the middle of the link: only those characters lose the
  // underline, every piece stays a link, and Undo gives the underline back.
  await typeFresh(`Linked ${stamp} plain`);
  await selectChars(0, 12);
  await choose("Edit", "Add Link");
  await address.fill("https://example.com/link");
  await sheet.getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(400);
  const underlined = (index) =>
    text.evaluate((node, wanted) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let at = 0;
      for (let each = walker.nextNode(); each; each = walker.nextNode()) {
        if (wanted < at + each.nodeValue.length) {
          for (let up = each.parentElement; up && up !== node; up = up.parentElement) {
            if (getComputedStyle(up).textDecorationLine.includes("underline")) return true;
          }
          return false;
        }
        at += each.nodeValue.length;
      }
      return null;
    }, index);
  await selectChars(14, 16);
  await choose("Format", "Font", "Copy Style");
  await selectChars(2, 4);
  await choose("Format", "Font", "Paste Style");
  const links = await text
    .locator("a")
    .evaluateAll((all) => all.map((each) => each.getAttribute("href")));
  step(
    "Paste Style takes the underline off the middle of a link only",
    (await underlined(0)) === true &&
      (await underlined(2)) === false &&
      (await underlined(5)) === true,
  );
  step(
    "the link stays a link in every piece",
    links.length >= 3 && links.every((each) => each === "https://example.com/link"),
    JSON.stringify(links),
  );
  await text.focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await page.waitForTimeout(200);
  step("Undo gives the link's underline back", (await underlined(2)) === true);

  // A reload reads the link and a style back through the draft.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await holds("Linked");
  step(
    "the link survives a reload",
    (await text.locator("a").first().getAttribute("href")) === "https://example.com/link",
  );

  await typeFresh("Kept style");
  await choose("Format", "Font", "Kern", "Loosen");
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  await holds("Kept style");
  step(
    "a Font row survives a reload",
    await text.evaluate(
      (node) => node.querySelector('[style*="letter-spacing"]')?.textContent === "Kept style",
    ),
    await text.evaluate((node) => node.innerHTML),
  );

  // Plain text: Insert > Page Break, printed, starts the words after it on a new page.
  await choose("Format", "Make Plain Text");
  await page.getByRole("alertdialog").getByRole("button", { name: "OK" }).click();
  await page.waitForTimeout(400);
  await text.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("One");
  await choose("Edit", "Insert", "Page Break");
  await page.keyboard.type("Two");
  await page.waitForTimeout(200);
  const printed = page.evaluate(
    () =>
      new Promise((resolve) => {
        const real = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
        Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
          configurable: true,
          get() {
            const view = real.get.call(this);
            if (view && this.hasAttribute("data-textedit-print")) {
              view.print = () => {
                const pages = [...this.contentDocument.querySelectorAll("pre")];
                resolve(
                  pages.map((each) => [each.textContent, view.getComputedStyle(each).breakBefore]),
                );
              };
            }
            return view;
          },
        });
      }),
  );
  await choose("File", "Print");
  const sheet2 = page.getByRole("dialog", { name: /print/i });
  await sheet2.waitFor();
  await sheet2.getByRole("button", { name: "Print", exact: true }).click();
  const pages = await printed;
  step(
    "Insert > Page Break in plain text starts a new printed page",
    pages.length === 2 && pages[1][0].includes("Two") && pages[1][1] === "page",
    JSON.stringify(pages),
  );
  await choose("Format", "Make Rich Text");
});
