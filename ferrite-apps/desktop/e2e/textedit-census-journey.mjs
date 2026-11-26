#!/usr/bin/env node

// TextEdit census journey (R4): one `ok`/`FAIL` line per census id of TextEdit, with real input, in chromium, chrome,
// firefox or webkit: the shared editing rows (Edit, Format > Font, Format > Text, the Fonts and Colors panels), the
// format bar and ruler, Make Plain Text, every File command (New, Open, Open Recent, Save, Duplicate, Rename, Save
// As, Export as PDF, Print, Close Window), documents across a reload and a real server restart, and isolation.
//
//   node e2e/textedit-census-journey.mjs --browser chromium|chrome|firefox|webkit [--phase write|restart-check]

import { appRows, choosePopup, otherAccount, popupOptions } from "./r4-app-rows.mjs";
import {
  api,
  census,
  chooseMenu,
  dontSave,
  doubleClickWord,
  menuState,
  openFromDock,
  reload,
  styleOf,
  until,
} from "./r4-census-kit.mjs";
import { editorRows, line, press, rgbOf, slug, tidy, uniq } from "./r4-editor-rows.mjs";

const { row, run, keep, kept } = census("textedit");
const S = "TextEdit document window";
const m = (role, name, how, expect, covers = [], extra = {}) => ({
  meta: { state: S, role, name, how, expect, persists: "none", covers, ...extra },
});
const SELECTOR = '[data-window-id^="textedit"]';
const windows = (page) => page.locator(SELECTOR);
// A window sent to the Dock stays laid out (data-minimized, inert), which `:visible` counts as shown.
const SHOWN = `${SELECTOR}:not([data-minimized]):not([inert])`;
const win = (page) => page.locator(`${SHOWN}:visible`).last();
const doc = (page) => win(page).getByRole("textbox", { name: "Document" });
const bar = (page) => win(page).getByRole("toolbar", { name: "Format" });
const files = async (page) => (await api(page, "GET", "/api/files/")).json?.entries ?? [];
const fileNamed = async (page, name) =>
  (await files(page)).find((entry) => entry.name === name && !entry.trashed_ms);

/** Closes every TextEdit window but the one in front: a row that opens a file leaves one behind. */
async function closeOtherWindows(page) {
  const windows = page.locator(`${SHOWN}:visible`);
  for (let left = (await windows.count()) - 1; left > 0; left -= 1) {
    await page.keyboard.press("Control+KeyW");
    await page
      .getByRole("button", { name: /Don.t Save/ })
      .click({ timeout: 1_500 })
      .catch(() => {});
  }
}

async function textedit(page) {
  if (
    await win(page)
      .isVisible()
      .catch(() => false)
  )
    return win(page);
  await openFromDock(page, "TextEdit", { selector: SELECTOR });
  await until(
    () => page.evaluate(() => !document.querySelector(".mac-textedit-body")?.hasAttribute("inert")),
    6_000,
  );
  return win(page);
}

/** Save the front document as `name` through the Save sheet (opened with File > Save… or Control+S). */
/** The matches of `locator` a real press reaches (a point 20 px into each, or its middle, hit-tests into it). */
async function reachableOf(locator) {
  const out = [];
  for (let index = (await locator.count()) - 1; index >= 0; index -= 1) {
    const each = locator.nth(index);
    const ok = await each
      .evaluate((element) => {
        const b = element.getBoundingClientRect();
        if (!b.width || !b.height) return false;
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + Math.min(b.height / 2, 20));
        return Boolean(hit && element.contains(hit));
      })
      .catch(() => false);
    if (ok) out.push(each);
  }
  return out;
}

/** The match of `locator` a real press reaches, waited for up to `ms`; null when none comes. */
async function reachable(locator, ms = 4_000) {
  let found = null;
  await until(async () => {
    found = (await reachableOf(locator))[0] ?? null;
    return Boolean(found);
  }, ms);
  return found;
}

async function saveAs(page, name, via = "menu") {
  if (via === "menu") await chooseMenu(page, "File", "Save…");
  else await press(page, "Control+S");
  const sheet = await reachable(page.getByRole("dialog", { name: "Save" }), 6_000);
  if (!sheet) throw new Error("no Save panel a press reaches");
  const field = sheet.getByRole("textbox", { name: "Save As:" });
  await field.click({ clickCount: 3 });
  await page.keyboard.type(name);
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await until(async () => !(await sheet.isVisible()), 6_000);
}

editorRows(row, {
  P: "textedit",
  state: S,
  editor: async (page) => {
    await textedit(page);
    return doc(page);
  },
  font: ["Format", "Font"],
  text: ["Format", "Text"],
  strike: false,
  aligns: [
    ["Align Left", "left", "Control+{"],
    ["Center", "center", "Control+|"],
    ["Justify", "justify", null],
    ["Align Right", "right", "Control+}"],
  ],
  keys: {
    bold: "Control+B",
    italic: "Control+I",
    underline: "Control+U",
    bigger: "Control+Plus",
    smaller: "Control+-",
    fonts: "Control+T",
    colors: "Shift+Control+C",
  },
});

// ---- Format bar and ruler -----------------------------------------------------------------------------------------
async function selected(page) {
  await textedit(page);
  const word = await line(page, doc(page), "Fb");
  await doubleClickWord(page, doc(page), word);
  return word;
}
for (const [label, check] of [
  ["Bold", (s) => s.bold],
  ["Italic", (s) => s.italic],
  ["Underline", (s) => s.underline],
]) {
  row(
    `textedit.format-bar.${slug(label)}`,
    async ({ page }) => {
      const word = await selected(page);
      await bar(page)
        .getByRole("group", { name: "Text style" })
        .getByRole("button", { name: label, exact: true })
        .click();
      const ok = await until(async () => check(await styleOf(doc(page), word)), 3_000);
      return { ok, detail: `${label} applied=${ok}` };
    },
    m(
      "button",
      label,
      `click ${label} in the format bar`,
      `the selected word becomes ${label.toLowerCase()}`,
      [["button", label, /group:Text style/]],
    ),
  );
}
for (const [label, css] of [
  ["Align left", /^(left|start)$/],
  ["Center", /^center$/],
  ["Align right", /^right$/],
  ["Justify", /^justify$/],
]) {
  row(
    `textedit.format-bar.${slug(label)}`,
    async ({ page }) => {
      const word = await selected(page);
      const group = bar(page).getByRole("group", { name: "Alignment" });
      await group
        .getByRole("button", { name: label === "Center" ? "Align right" : "Center", exact: true })
        .click();
      await doubleClickWord(page, doc(page), word);
      await group.getByRole("button", { name: label, exact: true }).click();
      const ok = await until(async () => css.test((await styleOf(doc(page), word)).align), 3_000);
      return { ok, detail: `align=${(await styleOf(doc(page), word)).align}` };
    },
    m("button", label, `click ${label} in the format bar`, "the line takes the alignment", [
      ["button", label, /group:Alignment/],
    ]),
  );
}
for (const [label, prefer, check] of [
  ["Font family", /Courier|Times|Arial|Helvetica/, (s, pick) => s.family.includes(pick)],
  ["Typeface", /Bold/, (s) => s.bold],
  ["Line spacing", /2\.0|Double|1\.5/, null],
]) {
  row(
    `textedit.format-bar.${slug(label)}`,
    async ({ page }) => {
      const word = await selected(page);
      const control = bar(page).getByRole("combobox", { name: label });
      const names = await popupOptions(page, control);
      const pick = names.find((name) => prefer.test(name)) ?? names[1];
      if (!pick) return { ok: false, detail: "no choices" };
      await doubleClickWord(page, doc(page), word);
      const lineBefore = await doc(page).evaluate((root, wanted) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode())
          if (node.nodeValue.includes(wanted))
            return getComputedStyle(node.parentElement).lineHeight;
        return "";
      }, word);
      await choosePopup(page, control, pick);
      let ok;
      if (check) ok = await until(async () => check(await styleOf(doc(page), word), pick), 3_000);
      else {
        ok = await until(async () => {
          const after = await doc(page).evaluate((root, wanted) => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode())
              if (node.nodeValue.includes(wanted))
                return getComputedStyle(node.parentElement).lineHeight;
            return "";
          }, word);
          return after !== lineBefore;
        }, 3_000);
      }
      return { ok, detail: `chose ${pick} of ${names.length}` };
    },
    m(
      "combobox",
      label,
      `choose in the format bar's ${label} pop-up`,
      `the selection takes the ${label.toLowerCase()}`,
      [["combobox", label, /toolbar:Format/]],
    ),
  );
}
row(
  "textedit.format-bar.font-size",
  async ({ page }) => {
    const word = await selected(page);
    const field = bar(page).getByRole("combobox", { name: "Font size" });
    await field.click({ clickCount: 3 });
    await page.keyboard.type("27");
    await page.keyboard.press("Enter");
    const typed = await until(
      async () => Math.round((await styleOf(doc(page), word)).size) === 27,
      3_000,
    );
    await doubleClickWord(page, doc(page), word);
    await bar(page).getByRole("button", { name: "Show choices" }).click();
    const list = page.getByRole("listbox").last();
    await list.getByRole("option", { name: "18", exact: true }).click();
    const chosen = await until(
      async () => Math.round((await styleOf(doc(page), word)).size) === 18,
      3_000,
    );
    return {
      ok: typed && chosen,
      detail: `typed 27=${typed}; chose 18 from the choices=${chosen}`,
    };
  },
  m(
    "combobox",
    "Font size",
    "type 27 and Return; then Show choices and 18",
    "the selected word takes each size",
    [
      ["combobox", "Font size", /toolbar:Format/],
      ["button", "Show choices", /toolbar:Format/],
    ],
  ),
);
row(
  "textedit.format-bar.text-color",
  async ({ page }) => {
    const word = await selected(page);
    await bar(page).getByLabel("Text color").fill("#aa2200");
    const ok = await until(
      async () => (await styleOf(doc(page), word)).color === rgbOf("#aa2200"),
      3_000,
    );
    return { ok, detail: `colour ${(await styleOf(doc(page), word)).color}` };
  },
  m(
    "textbox",
    "Text color",
    "enter a colour in the format bar's well (the browser's colour input)",
    "the selected word takes the colour",
    [["textbox", "Text color", /toolbar:Format/]],
  ),
);
for (const color of ["Yellow", "Green", "Blue", "Pink", "Purple", "No Color"]) {
  row(
    `textedit.format-bar.highlight.${slug(color)}`,
    async ({ page }) => {
      const word = await selected(page);
      const button = bar(page).getByRole("button", { name: "Highlight color" });
      await button.click();
      await page
        .getByRole("menuitemradio", {
          name: color === "No Color" ? "Yellow" : "No Color",
          exact: true,
        })
        .last()
        .click();
      await doubleClickWord(page, doc(page), word);
      const before = (await styleOf(doc(page), word)).background;
      await button.click();
      await page.getByRole("menuitemradio", { name: color, exact: true }).last().click();
      const ok = await until(async () => {
        const after = (await styleOf(doc(page), word)).background;
        return color === "No Color"
          ? /rgba\(0, 0, 0, 0\)|transparent/.test(after)
          : after !== before && !/rgba\(0, 0, 0, 0\)/.test(after);
      }, 3_000);
      return { ok, detail: `${before} -> ${(await styleOf(doc(page), word)).background}` };
    },
    m(
      "menuitemradio",
      color,
      `Highlight color pop-up, ${color}`,
      color === "No Color" ? "the highlight is removed" : "the selected word is highlighted",
      [
        ["menuitemradio", color, /menu:Highlight color/],
        ["button", "Highlight color", /toolbar:Format/],
      ],
    ),
  );
}
for (const style of ["Default", "Bold", "Italic", "Underlined"]) {
  row(
    `textedit.format-bar.paragraph.${slug(style)}`,
    async ({ page }) => {
      const word = await selected(page);
      await bar(page).getByRole("button", { name: "Paragraph styles" }).click();
      await page.getByRole("menuitem", { name: style, exact: true }).last().click();
      const check = {
        Default: (s) => !s.bold && !s.italic && !s.underline,
        Bold: (s) => s.bold,
        Italic: (s) => s.italic,
        Underlined: (s) => s.underline,
      }[style];
      const ok = await until(async () => check(await styleOf(doc(page), word)), 3_000);
      return {
        ok,
        detail: JSON.stringify(
          await styleOf(doc(page), word).then((s) => ({
            bold: s.bold,
            italic: s.italic,
            underline: s.underline,
          })),
        ),
      };
    },
    m(
      "menuitem",
      style,
      `Paragraph styles pop-up, ${style}`,
      `the paragraph takes the ${style} style`,
      [
        ["menuitem", style, /menu:Paragraph styles/],
        ["button", "Paragraph styles", /toolbar:Format/],
      ],
    ),
  );
}
row(
  "textedit.format-bar.list",
  async ({ page }) => {
    const word = await selected(page);
    await bar(page).getByRole("button", { name: "List bullets and numbering" }).click();
    const items = page
      .getByRole("menu")
      .last()
      .getByRole("menuitem")
      .or(page.getByRole("menu").last().getByRole("menuitemradio"));
    await items.first().waitFor({ timeout: 3_000 });
    const names = (await items.allInnerTexts()).map((each) => each.trim()).filter(Boolean);
    const pick = names.find((name) => /•|bullet|1\./i.test(name)) ?? names[1] ?? names[0];
    await page.getByRole("menu").last().getByText(pick, { exact: true }).first().click();
    const ok = await until(async () => {
      if (
        (await styleOf(doc(page), word))?.tags.some(
          (tag) => tag === "li" || tag === "ul" || tag === "ol",
        )
      )
        return true;
      // TextEdit marks a list item with `data-list` (disc, hyphen, decimal or alpha) on the paragraph; its stylesheet
      // draws the marker (textedit.css), so no marker text is in the paragraph.
      return doc(page).evaluate(
        (root, wanted) =>
          [...root.querySelectorAll("[data-list]")].some(
            (each) =>
              (each.textContent ?? "").includes(wanted) && each.getAttribute("data-list") !== "",
          ),
        word,
      );
    }, 3_000);
    return { ok, detail: `chose ${pick} of ${names.join(" | ").slice(0, 80)}; in a list=${ok}` };
  },
  m(
    "button",
    "List bullets and numbering",
    "choose a list style from the format bar",
    "the line becomes a list item",
    [["button", "List bullets and numbering", /toolbar:Format/]],
  ),
);
for (const label of ["first line indent", "head indent", "left tab stop", "tail indent"]) {
  row(
    `textedit.ruler.${slug(label)}`,
    async ({ page }) => {
      await selected(page);
      const slider = win(page)
        .getByRole("group", { name: "Ruler" })
        .first()
        .getByRole("slider", { name: label })
        .first();
      const before = await slider.getAttribute("aria-valuenow");
      await slider.focus();
      for (let index = 0; index < 4; index += 1)
        await page.keyboard.press(label === "tail indent" ? "ArrowLeft" : "ArrowRight");
      const ok = await until(
        async () => (await slider.getAttribute("aria-valuenow")) !== before,
        3_000,
      );
      return { ok, detail: `${label} ${before} -> ${await slider.getAttribute("aria-valuenow")}` };
    },
    m("slider", label, `focus the ruler's ${label} and press the arrow keys`, "the marker moves", [
      ["slider", label, /group:Ruler/],
    ]),
  );
}

// ---- Make Plain Text ------------------------------------------------------------------------------------------------
for (const via of ["menu", "key"]) {
  row(
    `textedit.format.make-plain-text.${via}`,
    async ({ page }) => {
      await textedit(page);
      await chooseMenu(page, "File", "New");
      await dontSave(page);
      await textedit(page);
      await doc(page).click();
      await page.keyboard.type(`plain ${uniq("Pt")}`);
      if (via === "menu") await chooseMenu(page, "Format", "Make Plain Text");
      else await press(page, "Shift+Control+T");
      const confirm = page
        .getByRole("dialog")
        .or(page.getByRole("alertdialog"))
        .filter({ hasText: /plain text/i })
        .last();
      if (await confirm.isVisible().catch(() => false))
        await confirm
          .getByRole("button", { name: /OK|Convert/ })
          .first()
          .click();
      const plain = await until(
        async () =>
          !(await bar(page)
            .isVisible()
            .catch(() => false)),
        4_000,
      );
      const state = await menuState(page, "Format", "Make Rich Text");
      if (state && !state.disabled) await chooseMenu(page, "Format", "Make Rich Text");
      const rich = await until(() => bar(page).isVisible(), 4_000);
      return {
        ok: plain && Boolean(state) && rich,
        detail: `plain (format bar gone)=${plain}; Make Rich Text offered=${Boolean(state)}; rich again=${rich}`,
      };
    },
    m(
      via === "menu" ? "menuitem" : "shortcut",
      "Format > Make Plain Text",
      via === "menu" ? "menu bar Format > Make Plain Text" : "keyboard Shift+Control+T",
      "the document becomes plain text, then rich again with Make Rich Text",
      via === "menu" ? [["menuitem", "Make Plain Text", /Format$/]] : [],
    ),
  );
}

// ---- File commands --------------------------------------------------------------------------------------------------
for (const via of ["menu", "key"]) {
  row(
    `textedit.file.new.${via}`,
    async ({ page }) => {
      await textedit(page);
      // TextEdit here keeps one document window: New asks to save the edited document, then shows a new one.
      await closeOtherWindows(page);
      const first = page.locator(
        `[data-window-id="${await win(page).getAttribute("data-window-id")}"]`,
      );
      const text = first.getByRole("textbox", { name: "Document" }).first();
      await text.click();
      await page.keyboard.press("Control+End");
      const marker = `Nw${Date.now().toString(36)}`;
      await page.keyboard.type(` ${marker}`);
      const windows = page.locator('[data-window-id^="textedit"]');
      const before = await windows.count();
      if (via === "menu") await chooseMenu(page, "File", "New");
      else await press(page, "Control+N");
      const opened = await until(async () => (await windows.count()) === before + 1, 4_000);
      const another = win(page);
      const fresh = opened && /Untitled/.test(await another.innerText());
      const kept = (await text.innerText()).includes(marker);
      if (opened) await another.getByRole("button", { name: "Close" }).first().click();
      await until(async () => (await windows.count()) === before, 4_000);
      return {
        ok: opened && fresh && kept,
        detail: `a window of its own=${opened}; untitled=${fresh}; the first keeps its text=${kept}`,
      };
    },
    m(
      via === "menu" ? "menuitem" : "shortcut",
      "File > New",
      via === "menu" ? "menu bar File > New" : "keyboard Control+N",
      "the edited document asks to be saved; Don’t Save shows a new untitled document",
      via === "menu" ? [["menuitem", "New", /File$/]] : [],
    ),
  );
  row(
    `textedit.file.open.${via}`,
    async ({ page }) => {
      await textedit(page);
      if (via === "menu") await chooseMenu(page, "File", "Open…");
      else await press(page, "Control+O");
      const panels = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("button", { name: "Open", exact: true }) });
      const dialog = await reachable(panels);
      const shown = Boolean(dialog);
      if (shown) await dialog.getByRole("button", { name: "Cancel" }).click();
      const closed =
        shown && (await until(async () => (await reachableOf(panels)).length === 0, 3_000));
      return {
        ok: shown && closed,
        detail: `open panel shown=${shown}; Cancel closed it=${closed}`,
      };
    },
    m(
      via === "menu" ? "menuitem" : "shortcut",
      "File > Open…",
      via === "menu" ? "menu bar File > Open…" : "keyboard Control+O",
      "the Open panel shows; Cancel closes it",
      via === "menu" ? [["menuitem", "Open…", /File$/]] : [],
    ),
  );
}
row(
  "textedit.file.save-rename-recent",
  async ({ page, ctx }) => {
    await textedit(page);
    await chooseMenu(page, "File", "New");
    await dontSave(page);
    await textedit(page);
    const word = uniq("Doc");
    await doc(page).click();
    await page.keyboard.type(`Census ${word}`);
    const renameBefore = await menuState(page, "File", "Rename…");
    const name = uniq("Te");
    await saveAs(page, name, "key");
    const saved = await until(
      async () => Boolean(await fileNamed(page, `${name}.rtf`)),
      6_000,
      300,
    );
    const renamed = `${name}r`;
    await chooseMenu(page, "File", "Rename…");
    const dialog = page.getByRole("dialog", { name: /Rename/ }).last();
    await dialog.waitFor({ timeout: 4_000 });
    await dialog.getByRole("textbox", { name: "Name:" }).click({ clickCount: 3 });
    await page.keyboard.type(renamed);
    await dialog.getByRole("button", { name: "Rename", exact: true }).click();
    const moved = await until(
      async () => Boolean(await fileNamed(page, `${renamed}.rtf`)),
      6_000,
      300,
    );
    await chooseMenu(page, "File", "Close Window");
    await chooseMenu(page, "File", "Open Recent", `${renamed}.rtf`).catch(async () => {
      await textedit(page);
      await chooseMenu(page, "File", "Open Recent", `${renamed}.rtf`);
    });
    const reopened = await until(async () => (await doc(page).innerText()).includes(word), 6_000);
    keep({ account: ctx.account, name: `${renamed}.rtf`, word });
    return {
      ok: renameBefore?.disabled === true && saved && moved && reopened,
      detail: `Rename dimmed before saving=${renameBefore?.disabled}; saved=${saved}; renamed=${moved}; reopened from Open Recent=${reopened}`,
    };
  },
  {
    timeout: 60_000,
    ...m(
      "menuitem",
      "File > Save…",
      "type, Control+S, name it, Save; File > Rename…; close; File > Open Recent",
      "the document is saved as RTF, renamed, and opens again from Open Recent",
      [
        ["menuitem", "Save…", /File$/],
        ["menuitem", "Rename…", /File$/],
        ["menuitem", "Open Recent", /File$/],
        ["textbox", "Save As:", /dialog:Save/],
        ["button", "Save", /dialog:Save/],
      ],
      { persists: "reload+restart" },
    ),
  },
);
/** A new document holding `word`, saved on the drive under a name of its own, which is answered. */
async function savedDocument(page, word) {
  await textedit(page);
  await chooseMenu(page, "File", "New");
  await dontSave(page);
  await textedit(page);
  await doc(page).click();
  await page.keyboard.type(word);
  const name = uniq("Tb");
  await saveAs(page, name, "menu");
  await until(async () => Boolean(await fileNamed(page, `${name}.rtf`)), 6_000, 300);
  return `${name}.rtf`;
}

row(
  "textedit.file.move-to",
  async ({ page }) => {
    const name = await savedDocument(page, uniq("Mv"));
    await chooseMenu(page, "File", "Move To…");
    const sheet = page.getByRole("dialog", { name: "Move the document" }).last();
    await sheet.getByRole("combobox", { name: "Where:" }).click();
    await page.getByRole("option", { name: "Desktop", exact: true }).click();
    await sheet.getByRole("button", { name: "Move", exact: true }).click();
    const moved = await until(
      async () => (await fileNamed(page, name))?.parent === "desktop",
      6_000,
      300,
    );
    return { ok: moved, detail: `${name} in Desktop=${moved}` };
  },
  {
    timeout: 40_000,
    ...m("menuitem", "Move To…", "File > Move To…, Desktop, Move", "the file's parent is Desktop"),
  },
);
row(
  "textedit.file.revert-last-saved",
  async ({ page }) => {
    const word = uniq("Rv");
    await savedDocument(page, word);
    await doc(page).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" gone");
    // Autosave writes the change; Last Saved is still what File > Save saved.
    await page.waitForTimeout(2_500);
    await chooseMenu(page, "File", "Revert To", "Last Saved");
    const sheet = page.getByRole("dialog", { name: /go back to the version/ }).last();
    await sheet.getByRole("button", { name: "Revert", exact: true }).click();
    const back = await until(async () => (await doc(page).innerText()).trim() === word, 6_000);
    return { ok: back, detail: `text back to "${word}"=${back}` };
  },
  {
    timeout: 40_000,
    ...m(
      "menuitem",
      "Last Saved",
      "save, type, wait for autosave, File > Revert To > Last Saved, Revert",
      "the text saved last",
    ),
  },
);
row(
  "textedit.file.page-setup",
  async ({ page }) => {
    await textedit(page);
    await chooseMenu(page, "File", "Page Setup…");
    const sheet = page.getByRole("dialog", { name: "Page Setup" }).last();
    await sheet.getByRole("radio", { name: "Landscape" }).click();
    await sheet.getByRole("button", { name: "OK", exact: true }).click();
    // The frame goes once its print ends, which a headless browser reaches at once, but for
    // Firefox's print preview, which holds the page: there print() in a frame is a stand-in, from
    // before the frame's own load prints.
    if (page.context().browser().browserType().name() === "firefox") {
      await page.addInitScript(() => {
        if (window !== window.top) {
          window.print = () => window.dispatchEvent(new Event("afterprint"));
        }
      });
    }
    await page.evaluate(() => {
      window.__teFrames = [];
      new MutationObserver((changes) => {
        for (const change of changes) {
          for (const node of change.addedNodes) {
            if (node.matches?.("iframe[data-textedit-print]")) window.__teFrames.push(node.srcdoc);
          }
        }
      }).observe(document.body, { childList: true });
    });
    await chooseMenu(page, "File", "Print…");
    const printing = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("button", { name: "Print", exact: true }) })
      .last();
    await printing.getByRole("button", { name: "Print", exact: true }).click();
    const shown = await until(
      () =>
        page.evaluate(() =>
          window.__teFrames.some((srcdoc) => srcdoc.includes("size:Letter landscape")),
        ),
      4_000,
    );
    await chooseMenu(page, "File", "Page Setup…");
    const again = page.getByRole("dialog", { name: "Page Setup" }).last();
    await again.getByRole("radio", { name: "Portrait" }).click();
    await again.getByRole("button", { name: "OK", exact: true }).click();
    return { ok: shown, detail: `@page landscape in the print frame=${shown}` };
  },
  {
    timeout: 30_000,
    ...m(
      "menuitem",
      "Page Setup…",
      "File > Page Setup…, Landscape, OK; File > Export as PDF…",
      "the print frame's @page is landscape",
    ),
  },
);
row(
  "textedit.title.popover",
  async ({ page }) => {
    const name = await savedDocument(page, uniq("Tp"));
    await win(page).locator(".mac-textedit-title").click();
    const popover = page.getByRole("dialog", { name: "Document" });
    await popover.waitFor({ timeout: 4_000 });
    const renamed = `${name.replace(/\.rtf$/, "")}x`;
    await popover.getByRole("textbox", { name: "Name:" }).fill(renamed);
    await page.keyboard.press("Enter");
    const done = await until(
      async () => Boolean(await fileNamed(page, `${renamed}.rtf`)),
      6_000,
      300,
    );
    await page.keyboard.press("Escape");
    return { ok: done, detail: `renamed to ${renamed}.rtf=${done}` };
  },
  {
    timeout: 40_000,
    ...m("button", "title", "click the title; Name, Return", "the file has the new name"),
  },
);
row(
  "textedit.format.spacing",
  async ({ page }) => {
    await textedit(page);
    await chooseMenu(page, "File", "New");
    await dontSave(page);
    await textedit(page);
    await doc(page).click();
    await page.keyboard.type(uniq("Sp"));
    await chooseMenu(page, "Format", "Text", "Spacing…");
    const sheet = page.getByRole("dialog", { name: "Spacing" }).last();
    await sheet.getByRole("textbox", { name: "Paragraph spacing before:" }).fill("18");
    await sheet.getByRole("button", { name: "OK", exact: true }).click();
    const set = await until(
      () =>
        doc(page)
          .locator("> *")
          .first()
          .evaluate((paragraph) => getComputedStyle(paragraph).marginTop === "18px"),
      4_000,
    );
    return { ok: set, detail: `margin-top 18px=${set}` };
  },
  {
    timeout: 30_000,
    ...m(
      "menuitem",
      "Spacing…",
      "Format > Text > Spacing…, before 18, OK",
      "the paragraph has 18 pt before it",
    ),
  },
);
row(
  "textedit.format.styles",
  async ({ page }) => {
    await textedit(page);
    await chooseMenu(page, "File", "New");
    await dontSave(page);
    await textedit(page);
    await doc(page).click();
    await press(page, "Control+B");
    const word = uniq("St");
    await page.keyboard.type(`${word}\n`);
    await press(page, "Control+B");
    await page.keyboard.type("plain");
    await press(page, "Control+A");
    await chooseMenu(page, "Format", "Font", "Styles…");
    const sheet = page.getByRole("dialog", { name: "Styles" }).last();
    await sheet.getByRole("radio", { name: /Bold/ }).first().click();
    await sheet.getByRole("button", { name: "Apply", exact: true }).click();
    const applied = await until(
      () =>
        doc(page).evaluate((node) => {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          for (let at = walker.nextNode(); at; at = walker.nextNode()) {
            if (at.nodeValue?.includes("plain")) {
              return Number(getComputedStyle(at.parentElement).fontWeight) >= 600;
            }
          }
          return false;
        }),
      4_000,
    );
    return { ok: applied, detail: `the style reached the selection=${applied}` };
  },
  {
    timeout: 30_000,
    ...m(
      "menuitem",
      "Styles…",
      "Format > Font > Styles…, a bold style, Apply",
      "the selected text is bold",
    ),
  },
);
row(
  "textedit.edit.complete",
  async ({ page }) => {
    await textedit(page);
    await chooseMenu(page, "File", "New");
    await dontSave(page);
    await textedit(page);
    await doc(page).click();
    await page.keyboard.type("hippopotamu");
    await page.keyboard.press("Alt+Escape");
    const list = page.getByRole("listbox", { name: "Completions" });
    await list.waitFor({ timeout: 8_000 });
    await list.getByRole("option", { name: "hippopotamus", exact: true }).click();
    const done = await until(
      async () => (await doc(page).innerText()).trim() === "hippopotamus",
      4_000,
    );
    return { ok: done, detail: `completed=${done}` };
  },
  {
    timeout: 30_000,
    ...m(
      "menuitem",
      "Complete",
      "type part of a word, Option-Escape, choose",
      "the word is finished",
    ),
  },
);
row(
  "textedit.file.save.menu",
  async ({ page }) => {
    await textedit(page);
    await chooseMenu(page, "File", "New");
    await dontSave(page);
    await textedit(page);
    await doc(page).click();
    await page.keyboard.type(uniq("Sm"));
    const name = uniq("Tm");
    await saveAs(page, name, "menu");
    const saved = await until(
      async () => Boolean(await fileNamed(page, `${name}.rtf`)),
      6_000,
      300,
    );
    return { ok: saved, detail: `saved ${name}.rtf=${saved}` };
  },
  m(
    "menuitem",
    "File > Save… (menu)",
    "menu bar File > Save…, name it, Save",
    "the document is saved",
  ),
);
row(
  "textedit.file.duplicate",
  async ({ page }) => {
    const { name } = kept();
    await textedit(page);
    const before = await windows(page).count();
    await chooseMenu(page, "File", "Duplicate");
    const more = await until(async () => (await windows(page).count()) > before, 4_000);
    const titled = await until(
      async () =>
        /copy/i.test((await win(page).getAttribute("aria-label")) ?? (await win(page).innerText())),
      3_000,
    );
    return {
      ok: titled && (await windows(page).count()) >= before,
      detail: `windows ${before} -> ${await windows(page).count()} (a new window=${more}); copy titled=${titled} (of ${name})`,
    };
  },
  m(
    "menuitem",
    "File > Duplicate",
    "menu bar File > Duplicate",
    "a copy of the document is shown, titled as a copy (TextEdit here keeps one document window)",
    [["menuitem", "Duplicate", /File$/]],
  ),
);
row(
  "textedit.file.save-as",
  async ({ page }) => {
    await textedit(page);
    await doc(page).click();
    await page.keyboard.type(` ${uniq("Sa")}`);
    const name = uniq("As");
    await press(page, "Alt+Shift+Control+S");
    const sheet = page.getByRole("dialog", { name: "Save" }).last();
    await sheet.waitFor({ timeout: 6_000 });
    await sheet.getByRole("textbox", { name: "Save As:" }).click({ clickCount: 3 });
    await page.keyboard.type(name);
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    const saved = await until(
      async () => Boolean(await fileNamed(page, `${name}.rtf`)),
      6_000,
      300,
    );
    return { ok: saved, detail: `saved as ${name}.rtf=${saved}` };
  },
  m(
    "menuitem",
    "File > Save As…",
    "keyboard Alt+Shift+Control+S, a new name, Save",
    "the document is saved under the new name",
    [["menuitem", "Save As…", /File$/]],
  ),
);
row(
  "textedit.file.export-pdf",
  async ({ page }) => {
    await textedit(page);
    const word = uniq("Px");
    await doc(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(` ${word}`);
    const before = new Set((await files(page)).map((entry) => entry.id));
    await chooseMenu(page, "File", "Export as PDF…");
    const sheet = page.getByRole("dialog", { name: "Export as PDF" });
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await sheet.waitFor({ state: "hidden", timeout: 10_000 });
    let made;
    const printed = await until(async () => {
      made = (await files(page)).find(
        (entry) => !before.has(entry.id) && /\.pdf$/i.test(entry.name ?? ""),
      );
      return Boolean(made);
    }, 8_000);
    return {
      ok: printed,
      detail: `a PDF on the drive=${made?.name ?? "none"}`,
    };
  },
  m(
    "menuitem",
    "File > Export as PDF…",
    "menu bar File > Export as PDF… (the browser's print dialog, Save as PDF there)",
    "a PDF of the document is saved",
    [["menuitem", "Export as PDF…", /File$/]],
  ),
);
for (const via of ["menu", "key"]) {
  row(
    `textedit.file.print.${via}`,
    async ({ page }) => {
      await textedit(page);
      if (via === "menu") await chooseMenu(page, "File", "Print…");
      else await press(page, "Control+P");
      const panels = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("button", { name: "Print", exact: true }) });
      const sheet = await reachable(panels);
      const shown = Boolean(sheet);
      if (shown) await sheet.getByRole("button", { name: "Cancel" }).click();
      const closed =
        shown && (await until(async () => (await reachableOf(panels)).length === 0, 3_000));
      return {
        ok: shown && closed,
        detail: `print panel shown=${shown}; Cancel closed it=${closed}`,
      };
    },
    m(
      via === "menu" ? "menuitem" : "shortcut",
      "File > Print…",
      via === "menu" ? "menu bar File > Print…" : "keyboard Control+P",
      "the Print panel shows; Cancel closes it",
      via === "menu" ? [["menuitem", "Print…", /File$/]] : [],
    ),
  );
}

// ---- Persistence and isolation ---------------------------------------------------------------------------------------
row(
  "textedit.persist.reload",
  async ({ page }) => {
    const { name, word } = kept();
    await reload(page);
    await textedit(page);
    await chooseMenu(page, "File", "Open Recent", name);
    const shown = await until(async () => {
      for (const box of await page.locator(`${SHOWN} [aria-label="Document"]`).all()) {
        if ((await box.innerText().catch(() => "")).includes(word)) return true;
      }
      return false;
    }, 6_000);
    return { ok: shown, detail: `${name} reopened after reload with its text=${shown}` };
  },
  m(
    "menuitem",
    "Open Recent (after reload)",
    "reload, File > Open Recent > the document",
    "the document opens with its text",
    [],
    { persists: "reload" },
  ),
);
row(
  "textedit.persist.restart",
  async ({ page }) => {
    const { name, word } = kept();
    const file = await fileNamed(page, name);
    await textedit(page);
    await chooseMenu(page, "File", "Open Recent", name);
    const shown = await until(async () => (await doc(page).innerText()).includes(word), 8_000);
    return {
      ok: Boolean(file) && shown,
      detail: `after a real server restart: file listed=${Boolean(file)}; opens with its text=${shown}`,
    };
  },
  {
    phases: ["restart-check"],
    ...m(
      "menuitem",
      "Open Recent (after restart)",
      "sign in again after the server restarted, File > Open Recent",
      "the saved document opens with its text",
      [],
      { persists: "restart" },
    ),
  },
);
row(
  "textedit.isolation.second-account",
  async ({ ctx }) => {
    const { name } = kept();
    const other = await otherAccount(ctx, "teiso");
    try {
      const leaked = Boolean(await fileNamed(other.page, name));
      return { ok: !leaked, detail: `the second account sees ${name}=${leaked}` };
    } finally {
      await other.close();
    }
  },
  m(
    "menuitem",
    "Documents (another account)",
    "a second account signs up",
    "it does not see the first account's documents",
  ),
);

// Before the app menu and window rows, which quit, hide and close the window: the draft row needs the document.
row(
  "textedit.draft.too-large",
  async ({ page }) => {
    await textedit(page);
    await closeOtherWindows(page);
    const field = doc(page);
    await field.click();
    await page.keyboard.type("Before big");
    const stored = async () =>
      JSON.stringify((await api(page, "GET", "/api/textedit/draft")).json?.draft ?? null);
    await until(async () => (await stored()).includes("Before big"), 10_000);
    const before = await stored();
    // Every draft request while the document is too large: none may be refused or carry the big text.
    const BIG = "0123456789 abcdefghij klmnopqrst uvwxyz ABCDEFGHI ";
    const sent = [];
    const listen = (response) => {
      const request = response.request();
      if (request.method() === "PUT" && request.url().includes("/api/textedit/draft"))
        sent.push({ status: response.status(), big: (request.postData() ?? "").includes(BIG) });
    };
    page.on("response", listen);
    await page.keyboard.press("Control+A");
    // 300,000 characters, typed in one input event (the size of a large text file opened from Finder).
    await page.keyboard.insertText(BIG.repeat(6_000));
    const banner = win(page).locator(".mac-textedit-too-large");
    const shown = await until(() => banner.isVisible(), 10_000);
    const said = shown ? (await banner.innerText()).trim() : "";
    // More changes while it is too large, then time for autosave to have run.
    await page.keyboard.type(" more");
    await page.waitForTimeout(3_000);
    page.off("response", listen);
    const refused = sent.filter((each) => each.status >= 400 || each.big).length;
    const unchanged = (await stored()) === before;
    // Small again: the notice goes and the draft is kept again.
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Small again");
    const gone = await until(async () => !(await banner.isVisible()), 10_000);
    const kept = await until(
      async () =>
        JSON.stringify((await api(page, "GET", "/api/textedit/draft")).json ?? {}).includes(
          "Small again",
        ),
      10_000,
    );
    return {
      ok: shown && refused === 0 && unchanged && gone && kept,
      detail: `notice shown=${shown} (${said.slice(0, 70)}); draft requests while too large ${sent.length}, refused or carrying the big text ${refused}; stored draft unchanged=${unchanged}; gone when small=${gone}; draft kept again=${kept}`,
    };
  },
  {
    timeout: 120_000,
    meta: m(
      "textbox",
      "Document",
      "type 300,000 characters into the document, then replace them with two words",
      "TextEdit says the document is too large to be kept across a reload and sends no draft the server refuses; when it is small again the notice goes and the draft is kept",
    ),
  },
);

appRows(row, {
  P: "textedit",
  app: "TextEdit",
  state: S,
  open: textedit,
  gone: async (page) => (await page.locator(`${SHOWN}:visible`).count()) === 0,
  windowItem: null,
  fullScreen: true,
  windowMenu: true,
  help: true,
  closeTitle: "Untitled",
});

await run({
  beforeEach: async ({ page }) => {
    await tidy(page);
  },
});
