// R4 shared editor census rows: the Edit menu, the Font menu (or submenu), Format > Text, the Fonts panel and the
// Colors panel, with every key equivalent the menus name, generated for one editor. Each row is real input on the
// served desktop and asserts its outcome on screen (computed style, text, selection, panel state); the app's own
// suite adds persistence. The editor is described by `ed`:
//   { P, state, editor(page, ctx) -> Locator (the editable, created once), font: [...trail to Font items],
//     text: [...trail to alignment items] | null, strike: bool, aligns: [[item, css, shortcut?]...],
//     keys: { bold, italic, underline, bigger, smaller, fonts, colors } (aria-keyshortcuts strings), file }

import {
  chooseMenu,
  clickAfter,
  doubleClickWord,
  holds,
  menuBar,
  menuState,
  openMenu,
  readOpenMenus,
  selectedText,
  sleep,
  styleOf,
  until,
} from "./r4-census-kit.mjs";

/** An `aria-keyshortcuts` value ("Shift+Control+7", "Control+Plus", "Control+{") as a Playwright key press. */
export function keyFor(shortcut) {
  const parts = shortcut.split("+");
  // "Control++" style: a trailing empty part means the plus key itself.
  let key = parts.pop();
  if (key === "" && parts.at(-1) === "") {
    parts.pop();
    key = "Plus";
  }
  const mods = new Set(
    parts.map((each) => (each === "Option" ? "Alt" : each === "Command" ? "Control" : each)),
  );
  const shifted = {
    Plus: "Equal",
    "{": "BracketLeft",
    "}": "BracketRight",
    "|": "Backslash",
    "?": "Slash",
    ":": "Semicolon",
    "<": "Comma",
    ">": "Period",
  };
  const named = {
    "-": "Minus",
    "=": "Equal",
    ",": "Comma",
    ".": "Period",
    "/": "Slash",
    "[": "BracketLeft",
    "]": "BracketRight",
    ";": "Semicolon",
    Up: "ArrowUp",
    Down: "ArrowDown",
    Left: "ArrowLeft",
    Right: "ArrowRight",
  };
  if (Object.hasOwn(shifted, key)) {
    mods.add("Shift");
    key = shifted[key];
  } else if (Object.hasOwn(named, key)) key = named[key];
  else if (/^[A-Z]$/.test(key)) key = key.toLowerCase();
  const order = ["Control", "Alt", "Shift", "Meta"].filter((each) => mods.has(each));
  return [...order, key].join("+");
}

/** Press a menu's key equivalent with the real keyboard. */
export async function press(page, shortcut) {
  await page.keyboard.press(keyFor(shortcut));
  await sleep(300);
}

let sequence = 0;
/** A word no other text holds (letters and digits only, so a double click selects all of it). */
export const uniq = (stem) =>
  `${stem}${(Date.now() % 1e7).toString(36)}${(sequence++).toString(36)}`.replace(
    /[^A-Za-z0-9]/g,
    "",
  );

export const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The words of the editor's text, as shown. */
const wordsOf = (editor) =>
  editor.evaluate((root) =>
    (root.innerText ?? root.textContent ?? "").split(/\s+/).filter(Boolean),
  );

/** The words of `before` that `after` no longer holds (each occurrence counted). */
function lostWords(before, after) {
  const left = new Map();
  for (const each of after) left.set(each, (left.get(each) ?? 0) + 1);
  const lost = [];
  for (const each of before) {
    const n = left.get(each) ?? 0;
    if (n > 0) left.set(each, n - 1);
    else lost.push(each);
  }
  return lost;
}

/** Count the occurrences of `word` in the editor's text. */
const count = (editor, word) =>
  editor.evaluate((root, wanted) => root.textContent.split(wanted).length - 1, word);

/**
 * A new line at the end of the editor with `alpha <W> omega`, typed; resolves with the word. The editor is scrolled to
 * its end with the mouse wheel, then clicked at a point of it that is on screen and not covered by a panel (the end of
 * its last text when that is uncovered), and the insertion point goes to the end with Control+End. Throws when the
 * typed word did not reach the editor.
 */
export async function line(page, editor, stem = "Wd") {
  const word = uniq(stem);
  const box = await editor.boundingBox();
  if (!box) throw new Error("the editor is not on screen");
  const viewport = page.viewportSize();
  await page.mouse.move(box.x + box.width / 2, Math.min(box.y + 40, viewport.height - 20));
  await page.mouse.wheel(0, 50_000);
  await sleep(150);
  const point = await visiblePoint(editor);
  if (!point) throw new Error("no point of the editor is on screen and uncovered");
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(`alpha ${word} omega`);
  await sleep(150);
  if (!(await holds(editor, word))) {
    const focus = await page.evaluate(
      () =>
        `${document.activeElement?.tagName} ${document.activeElement?.getAttribute("aria-label") ?? ""}`,
    );
    throw new Error(
      `typed ${word} did not reach the editor (focus: ${focus}, clicked at ${Math.round(point.x)},${Math.round(point.y)})`,
    );
  }
  return word;
}

/** A point of `editor` on screen whose topmost element is inside it: the end of its last text, else a scan. */
export function visiblePoint(editor) {
  return editor.evaluate((root) => {
    const inside = (x, y) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit && root.contains(hit));
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode())
      if (node.nodeValue.trim()) last = node;
    if (last) {
      const range = document.createRange();
      range.setStart(last, Math.max(0, last.nodeValue.length - 1));
      range.setEnd(last, last.nodeValue.length);
      const rect = range.getBoundingClientRect();
      const x = rect.right - 1;
      const y = rect.top + rect.height / 2;
      if (rect.width + rect.height > 0 && inside(x, y)) return { x, y };
    }
    const box = root.getBoundingClientRect();
    const top = Math.max(box.top, 0);
    const bottom = Math.min(box.bottom, innerHeight);
    for (let y = bottom - 8; y > top + 4; y -= 12) {
      for (const fx of [0.15, 0.5, 0.85]) {
        const x = box.left + box.width * fx;
        if (inside(x, y)) return { x, y };
      }
    }
    return null;
  });
}

/** A panel by name: Notes shows it as a dialog, the other editors as a region. */
export const panelOf = (page, name) =>
  page
    .getByRole("dialog", { name, exact: true })
    .or(page.getByRole("region", { name, exact: true }))
    .last();

/** The Fonts panel, opened from the editor's Font menu when it is not showing. */
export async function fontsPanel(page, ed) {
  const panel = panelOf(page, "Fonts");
  if (!(await panel.isVisible().catch(() => false))) {
    await chooseMenu(page, ...ed.font, "Show Fonts");
    await panel.waitFor({ state: "visible", timeout: 5_000 });
  }
  return panel;
}

/** The Colors panel, opened from the editor's Font menu when it is not showing. */
export async function colorsPanel(page, ed) {
  const panel = panelOf(page, "Colors");
  if (!(await panel.isVisible().catch(() => false))) {
    await chooseMenu(page, ...ed.font, "Show Colors");
    await panel.waitFor({ state: "visible", timeout: 5_000 });
  }
  return panel;
}

/** Close a panel with its window's Close button (real click). */
export async function closePanel(panel) {
  if (await panel.isVisible().catch(() => false)) {
    await panel
      .getByRole("group", { name: "Window controls" })
      .getByRole("button", { name: "Close" })
      .click();
    await sleep(200);
  }
}

/**
 * Whether the browser draws the family `name` itself, measured independently of the panel's canvas check: DOM layout
 * of a sample in the family against each generic fallback (a missing family lays out exactly as its fallback).
 */
export function measureFamily(page, name) {
  return page.evaluate((family) => {
    const sample = "WwMmQq@%&il1|0Oxyzgj";
    const lay = (css) => {
      const span = document.createElement("span");
      span.textContent = sample;
      span.style.cssText = `position:absolute;left:-10000px;top:0;font-size:96px;white-space:nowrap;font-family:${css}`;
      document.body.append(span);
      const rect = span.getBoundingClientRect();
      span.remove();
      return `${rect.width}x${rect.height}`;
    };
    const quoted = `"${family.replace(/["\\]/g, "\\$&")}"`;
    return ["monospace", "serif", "sans-serif", "cursive"].some(
      (fallback) => lay(fallback) !== lay(`${quoted}, ${fallback}`),
    );
  }, name);
}

/** The first family of a computed `font-family`, unquoted. */
const firstFamily = (css) =>
  (css ?? "")
    .split(",")[0]
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");

/** `rgb(r, g, b)` from `#rrggbb`. */
export function rgbOf(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((at) => Number.parseInt(value.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The hex the Colors panel shows as its current colour. */
export async function currentColor(panel) {
  const label = await panel.getByRole("img", { name: /^Current color/ }).getAttribute("aria-label");
  return label.match(/#[0-9a-f]{6}/i)?.[0]?.toLowerCase() ?? "";
}

/** The colour of `word` as `rgb(...)`. */
const colorOf = async (editor, word) => (await styleOf(editor, word))?.color ?? "";

export const FAMILIES = [
  "System Font",
  "American Typewriter",
  "Arial",
  "Avenir Next",
  "Baskerville",
  "Chalkboard",
  "Courier",
  "Futura",
  "Georgia",
  "Gill Sans",
  "Helvetica",
  "Helvetica Neue",
  "Lucida Grande",
  "Marker Felt",
  "Menlo",
  "Monaco",
  "Noteworthy",
  "Optima",
  "Palatino",
  "Times",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
];
export const COLLECTIONS = ["All Fonts", "Fixed Width", "Fun", "Modern", "Traditional", "Web"];
export const TYPEFACES = ["Regular", "Italic", "Bold", "Bold Italic"];
export const SIZES = [9, 10, 11, 12, 13, 14, 18, 24, 36, 48, 64, 72, 96, 144, 288];
export const PALETTE = [
  "Black",
  "Blue",
  "Brown",
  "Cyan",
  "Green",
  "Magenta",
  "Orange",
  "Purple",
  "Red",
  "Yellow",
  "White",
];
export const PENCILS = [
  "Licorice",
  "Lead",
  "Tungsten",
  "Iron",
  "Steel",
  "Tin",
  "Nickel",
  "Aluminum",
  "Magnesium",
  "Silver",
  "Mercury",
  "Snow",
  "Cayenne",
  "Mocha",
  "Asparagus",
  "Fern",
  "Clover",
  "Moss",
  "Teal",
  "Ocean",
  "Midnight",
  "Eggplant",
  "Plum",
  "Maroon",
  "Maraschino",
  "Tangerine",
  "Lemon",
  "Lime",
  "Spring",
  "Sea Foam",
  "Turquoise",
  "Aqua",
  "Blueberry",
  "Grape",
  "Magenta",
  "Strawberry",
  "Salmon",
  "Cantaloupe",
  "Banana",
  "Honeydew",
  "Flora",
  "Spindrift",
  "Ice",
  "Sky",
  "Orchid",
  "Lavender",
  "Bubblegum",
  "Carnation",
];
export const TABS = ["Color Wheel", "Color Sliders", "Color Palettes", "Image Palettes", "Pencils"];

/**
 * Generate every shared editing row for the editor `ed` with `row` (from `census()`).
 */
export function editorRows(row, ed) {
  const { P } = ed;
  // The families the editor's Fonts panel lists: System Font first only where the editor adds it (Notes).
  const panelFamilies = ed.systemFont
    ? FAMILIES
    : FAMILIES.filter((name) => name !== "System Font");
  ed.familyCount ??= panelFamilies.length;
  const meta = (role, name, how, expect, extra = {}) => ({
    state: ed.state,
    role,
    name,
    how,
    expect,
    persists: "none",
    ...extra,
  });
  const editor = (page, ctx) => ed.editor(page, ctx);
  const menuPath = (...trail) => trail.join(" > ");

  // ---- Edit menu ----------------------------------------------------------------------------------------------------
  const EDIT = [
    ["undo", "Undo", "Control+Z"],
    ["redo", "Redo", "Shift+Control+Z"],
    ["cut", "Cut", "Control+X"],
    ["copy", "Copy", "Control+C"],
    ["paste", "Paste", "Control+V"],
    ["select-all", "Select All", "Control+A"],
  ];
  for (const [id, item, key] of EDIT) {
    for (const via of ["menu", "key"]) {
      const act = async (page) =>
        via === "menu" ? chooseMenu(page, "Edit", item) : press(page, key);
      const how = via === "menu" ? `menu bar Edit > ${item}` : `keyboard ${key}`;
      const covers = via === "menu" ? [["menuitem", item, /Edit$/]] : [];
      row(
        `${P}.edit.${id}.${via}`,
        async ({ page, ctx }) => {
          const text = await editor(page, ctx);
          const word = await line(page, text, "Ed");
          if (id === "undo" || id === "redo") {
            // The ruling (24 Oct): each engine groups typing into undo steps its own way (macOS undoes "Typing" as one
            // step). After Undo the last continuous typing run is gone and nothing typed before it is lost, the document
            // still exists, and Redo brings the text back. The run starts with a real click after the line's word.
            await clickAfter(page, text, word);
            const before = await wordsOf(text);
            const extra = uniq("Un");
            await page.keyboard.type(` ${extra}`);
            await sleep(250);
            if (id === "undo") await act(page);
            else await press(page, "Control+Z");
            const gone = await until(async () => !(await holds(text, extra)), 3_000);
            const lost = lostWords(before, await wordsOf(text));
            const exists = ed.exists
              ? await ed.exists(page, ctx)
              : { ok: await text.isVisible(), detail: `on screen=${await text.isVisible()}` };
            if (id === "undo") await press(page, "Shift+Control+Z");
            else await act(page);
            const back = await until(() => holds(text, extra), 3_000);
            const earlier = lost.length
              ? ` and earlier text (${lost.length} words: ${lost.slice(0, 8).join(" ")}${lost.length > 8 ? " …" : ""})`
              : "";
            return {
              ok: gone && lost.length === 0 && exists.ok && back,
              detail: `Undo removed ${gone ? `the last typing run (${extra})` : "nothing"}${earlier}; the document ${exists.detail}; Redo brought it back=${back}`,
            };
          }
          if (id === "select-all") {
            await doubleClickWord(page, text, word);
            await page.keyboard.press("End");
            await act(page);
            const all = (await text.evaluate((root) => root.innerText)).replace(/\s+/g, " ").trim();
            const ok = await until(
              async () => (await selectedText(page)).replace(/\s+/g, " ").trim() === all,
              3_000,
            );
            return {
              ok,
              detail: ok
                ? "the whole text is selected"
                : `selected: ${(await selectedText(page)).slice(0, 60)}`,
            };
          }
          await doubleClickWord(page, text, word);
          if (id === "cut") {
            await act(page);
            const gone = await until(async () => !(await holds(text, word)), 3_000);
            await page.keyboard.press("End");
            await press(page, "Control+V");
            const pasted = await until(() => holds(text, word), 3_000);
            return { ok: gone && pasted, detail: `removed=${gone} on the clipboard=${pasted}` };
          }
          if (id === "copy") {
            await act(page);
            await page.keyboard.press("End");
            await press(page, "Control+V");
            const twice = await until(async () => (await count(text, word)) === 2, 3_000);
            return { ok: twice, detail: `occurrences=${await count(text, word)}` };
          }
          // Paste: the word is copied with the keyboard, then pasted by the command under test.
          await press(page, "Control+C");
          await page.keyboard.press("End");
          if (via === "menu") {
            await chooseMenu(page, "Edit", "Paste");
            const twice = await until(async () => (await count(text, word)) === 2, 4_000);
            if (twice) {
              for (let index = 0; index < 2; index += 1) await page.keyboard.press("Escape");
              return { ok: true, detail: "pasted from the menu" };
            }
            // Refused by the browser: Paste is dimmed in the open menu with the reason under it.
            const reason = page.getByRole("menu").last().locator(".mac-editor-paste-reason");
            const shown = await reason.isVisible().catch(() => false);
            const dimmed =
              (await page
                .getByRole("menu")
                .last()
                .getByRole("menuitem", { name: "Paste", exact: true })
                .getAttribute("aria-disabled")
                .catch(() => null)) === "true";
            const why = shown ? (await reason.innerText()).trim() : "";
            for (let index = 0; index < 2; index += 1) await page.keyboard.press("Escape");
            if (shown && dimmed) return { unavailable: why };
            return { ok: false, detail: `not pasted; dimmed=${dimmed} reason shown=${shown}` };
          }
          await act(page);
          const twice = await until(async () => (await count(text, word)) === 2, 3_000);
          return { ok: twice, detail: `occurrences=${await count(text, word)}` };
        },
        {
          meta: meta("menuitem", menuPath("Edit", item), how, `${item} acts on the editor's text`, {
            covers,
          }),
        },
      );
    }
  }
  row(
    `${P}.edit.cut-copy-dimmed-without-selection`,
    async ({ page, ctx }) => {
      const text = await editor(page, ctx);
      await line(page, text, "Dm");
      const cut = await menuState(page, "Edit", "Cut");
      const copy = await menuState(page, "Edit", "Copy");
      return {
        ok: cut?.disabled === true && copy?.disabled === true,
        detail: `cut=${JSON.stringify(cut)} copy=${JSON.stringify(copy)}`,
      };
    },
    {
      meta: meta(
        "menuitem",
        "Edit > Cut, Copy (no selection)",
        "menu bar Edit with an insertion point",
        "Cut and Copy are dimmed",
      ),
    },
  );

  // ---- Font menu: styles, sizes, panels -----------------------------------------------------------------------------
  const STYLES = [
    ["bold", "Bold", ed.keys.bold, (s) => s.bold],
    ["italic", "Italic", ed.keys.italic, (s) => s.italic],
    ["underline", "Underline", ed.keys.underline, (s) => s.underline],
    ...(ed.strike
      ? [["strikethrough", "Strikethrough", ed.keys.strikethrough, (s) => s.strike]]
      : []),
  ];
  for (const [id, item, key, check] of STYLES) {
    for (const via of key ? ["menu", "key"] : ["menu"]) {
      row(
        `${P}.font.${id}.${via}`,
        async ({ page, ctx }) => {
          const text = await editor(page, ctx);
          const word = await line(page, text, "Fs");
          await doubleClickWord(page, text, word);
          if (via === "menu") await chooseMenu(page, ...ed.font, item);
          else await press(page, key);
          const styled = await until(async () => check(await styleOf(text, word)), 3_000);
          // The item shows its state for the selection, and the selection is still the word.
          const state = via === "menu" ? await menuState(page, ...ed.font, item) : null;
          // A checkbox item shows its state; a plain item (TextEdit's) has none to show.
          const checked =
            via === "menu"
              ? state?.checked === "true" || (state !== null && state?.checked === null)
              : true;
          const kept = (await selectedText(page)).trim() === word;
          return {
            ok: styled && checked && kept,
            detail: `styled=${styled} checked=${state?.checked ?? "-"} selection kept=${kept}`,
          };
        },
        {
          meta: meta(
            via === "menu" ? "menuitemcheckbox" : "shortcut",
            menuPath(...ed.font, item),
            via === "menu" ? `menu bar ${menuPath(...ed.font, item)}` : `keyboard ${key}`,
            `the selected word becomes ${id}`,
            {
              covers:
                via === "menu"
                  ? [
                      ["menuitemcheckbox", item, new RegExp(`${ed.font.at(-1)}$`)],
                      ["menuitem", item, new RegExp(`${ed.font.at(-1)}$`)],
                    ]
                  : [],
            },
          ),
        },
      );
    }
  }
  for (const [id, item, key, grows] of [
    ["bigger", "Bigger", ed.keys.bigger, true],
    ["smaller", "Smaller", ed.keys.smaller, false],
  ]) {
    for (const via of key ? ["menu", "key"] : ["menu"]) {
      row(
        `${P}.font.${id}.${via}`,
        async ({ page, ctx }) => {
          const text = await editor(page, ctx);
          const word = await line(page, text, "Fz");
          await doubleClickWord(page, text, word);
          const before = (await styleOf(text, word)).size;
          if (via === "menu") await chooseMenu(page, ...ed.font, item);
          else await press(page, key);
          const changed = await until(async () => {
            const after = (await styleOf(text, word)).size;
            return grows ? after > before : after < before;
          }, 3_000);
          return { ok: changed, detail: `${before}px -> ${(await styleOf(text, word)).size}px` };
        },
        {
          meta: meta(
            via === "menu" ? "menuitem" : "shortcut",
            menuPath(...ed.font, item),
            via === "menu" ? `menu bar ${menuPath(...ed.font, item)}` : `keyboard ${key}`,
            `the selected word gets ${grows ? "bigger" : "smaller"}`,
            {
              covers: via === "menu" ? [["menuitem", item, new RegExp(`${ed.font.at(-1)}$`)]] : [],
            },
          ),
        },
      );
    }
  }
  for (const [id, item, key, name] of [
    ["show-fonts", "Show Fonts", ed.keys.fonts, "Fonts"],
    ["show-colors", "Show Colors", ed.keys.colors, "Colors"],
  ]) {
    for (const via of key ? ["menu", "key"] : ["menu"]) {
      row(
        `${P}.font.${id}.${via}`,
        async ({ page, ctx }) => {
          const text = await editor(page, ctx);
          const word = await line(page, text, "Fp");
          await doubleClickWord(page, text, word);
          const panel = panelOf(page, name);
          await closePanel(panel);
          if (via === "menu") await chooseMenu(page, ...ed.font, item);
          else await press(page, key);
          const shown = await until(() => panel.isVisible(), 3_000);
          await closePanel(panel);
          return { ok: shown, detail: shown ? `${name} panel shown` : `${name} panel not shown` };
        },
        {
          meta: meta(
            via === "menu" ? "menuitem" : "shortcut",
            menuPath(...ed.font, item),
            via === "menu" ? `menu bar ${menuPath(...ed.font, item)}` : `keyboard ${key}`,
            `the ${name} panel opens`,
            {
              covers: via === "menu" ? [["menuitem", item, new RegExp(`${ed.font.at(-1)}$`)]] : [],
            },
          ),
        },
      );
    }
  }

  // ---- Text alignment -----------------------------------------------------------------------------------------------
  for (const [item, css, key] of ed.aligns ?? []) {
    for (const via of key ? ["menu", "key"] : ["menu"]) {
      row(
        `${P}.text.${slug(item)}.${via}`,
        async ({ page, ctx }) => {
          const text = await editor(page, ctx);
          const word = await line(page, text, "Ta");
          // Another alignment first, so that the command under test visibly changes the line.
          const other =
            css === "center"
              ? ed.aligns.find(([, value]) => value === "right")
              : ed.aligns.find(([, value]) => value === "center");
          await doubleClickWord(page, text, word);
          await chooseMenu(page, ...ed.text, other[0]);
          await doubleClickWord(page, text, word);
          if (via === "menu") await chooseMenu(page, ...ed.text, item);
          else await press(page, key);
          const want = css === "left" ? /^(left|start)$/ : new RegExp(`^${css}$`);
          const aligned = await until(
            async () => want.test((await styleOf(text, word)).align),
            3_000,
          );
          return { ok: aligned, detail: `align=${(await styleOf(text, word)).align}` };
        },
        {
          meta: meta(
            via === "menu" ? "menuitem" : "shortcut",
            menuPath(...ed.text, item),
            via === "menu" ? `menu bar ${menuPath(...ed.text, item)}` : `keyboard ${key}`,
            `the line is aligned ${css}`,
            {
              covers:
                via === "menu"
                  ? [
                      ["menuitem", item, new RegExp(`${ed.text.at(-1)}$`)],
                      ["menuitemradio", item, new RegExp(`${ed.text.at(-1)}$`)],
                    ]
                  : [],
            },
          ),
        },
      );
    }
  }

  // ---- Fonts panel --------------------------------------------------------------------------------------------------
  /** A word of a fresh line, selected, with the Fonts panel showing. */
  const withFonts = async (page, ctx) => {
    const text = await editor(page, ctx);
    const word = await line(page, text, "Fn");
    await doubleClickWord(page, text, word);
    const panel = await fontsPanel(page, ed);
    return { text, word, panel };
  };
  const fontsState = `${ed.state}, Fonts panel`;
  const fmeta = (role, name, how, expect, covers) => ({
    state: fontsState,
    role,
    name,
    how,
    expect,
    persists: "none",
    covers,
  });
  for (const family of panelFamilies) {
    row(
      `${P}.fonts.family.${slug(family)}`,
      async ({ page, ctx }) => {
        const { text, word, panel } = await withFonts(page, ctx);
        const list = panel.getByRole("listbox", { name: "Family" });
        const option = list.getByRole("option", { name: family, exact: true });
        await option.scrollIntoViewIfNeeded();
        const dimmed = (await option.getAttribute("aria-disabled")) === "true";
        const draws = family === "System Font" ? true : await measureFamily(page, family);
        const before = (await styleOf(text, word)).family;
        if (dimmed) {
          // A dimmed option is pressed with the real pointer at its box (Playwright's click would wait for it to be
          // enabled): the press must leave the word's family alone, the reason must be on screen, and an independent
          // layout measurement must agree that the browser cannot draw the family.
          const box = await option.boundingBox();
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await sleep(250);
          const after = (await styleOf(text, word)).family;
          const reason = panel.getByText(/Dimmed families are not installed/);
          const shown = await reason.isVisible();
          const why = shown ? (await reason.innerText()).trim() : "";
          if (shown && !draws && after === before) return { unavailable: why };
          return {
            ok: false,
            detail: `dimmed; reason shown=${shown}; independent layout says the browser draws it=${draws}; family ${before} -> ${after}`,
          };
        }
        await option.click();
        await sleep(250);
        const after = (await styleOf(text, word)).family;
        const applied =
          family === "System Font"
            ? /system|apple|Blink/i.test(after) || after !== before
            : firstFamily(after) === family;
        return {
          ok: draws && applied,
          detail: `drawn by the browser=${draws}; family ${before} -> ${after}`,
        };
      },
      {
        meta: fmeta(
          "option",
          `Family: ${family}`,
          "click the family in the Fonts panel",
          "the selected word is set in the family, or the family is dimmed with the reason when the browser has no such font (checked by an independent DOM layout measurement)",
          [["option", family, /listbox:Family/]],
        ),
      },
    );
  }
  for (const collection of COLLECTIONS) {
    row(
      `${P}.fonts.collection.${slug(collection)}`,
      async ({ page, ctx }) => {
        const { panel } = await withFonts(page, ctx);
        const collections = panel.getByRole("listbox", { name: "Collection" });
        const families = panel.getByRole("listbox", { name: "Family" }).getByRole("option");
        // From another collection, so the list visibly changes.
        await collections
          .getByRole("option", {
            name: collection === "All Fonts" ? "Fixed Width" : "All Fonts",
            exact: true,
          })
          .click();
        await sleep(150);
        const before = await families.allInnerTexts();
        await collections.getByRole("option", { name: collection, exact: true }).click();
        await sleep(200);
        const after = await families.allInnerTexts();
        const selected =
          (await collections
            .getByRole("option", { name: collection, exact: true })
            .getAttribute("aria-selected")) === "true";
        const known = after.every((name) => panelFamilies.includes(name.trim()));
        const right =
          collection === "All Fonts"
            ? after.length === panelFamilies.length
            : after.length > 0 && after.length < panelFamilies.length;
        await collections.getByRole("option", { name: "All Fonts", exact: true }).click();
        const unknown = after.filter((each) => !panelFamilies.includes(each.trim()));
        return {
          ok: selected && known && right && before.join() !== after.join(),
          detail: `${before.length} -> ${after.length} families (selected=${selected} known=${known} right=${right}${unknown.length ? ` not listed: ${unknown.join(", ")}` : ""}): ${after.join(", ").slice(0, 80)}`,
        };
      },
      {
        meta: fmeta(
          "option",
          `Collection: ${collection}`,
          "click the collection in the Fonts panel",
          "the Family list shows that collection's families",
          [["option", collection, /listbox:Collection/]],
        ),
      },
    );
  }
  for (const face of TYPEFACES) {
    row(
      `${P}.fonts.typeface.${slug(face)}`,
      async ({ page, ctx }) => {
        const { text, word, panel } = await withFonts(page, ctx);
        const faces = panel.getByRole("listbox", { name: "Typeface" });
        // The typefaces follow the family: when this family lacks the face, the first family offering it is chosen.
        if ((await faces.getByRole("option", { name: face, exact: true }).count()) === 0) {
          const options = panel.getByRole("listbox", { name: "Family" }).getByRole("option");
          for (let index = 0; index < (await options.count()); index += 1) {
            const option = options.nth(index);
            if ((await option.getAttribute("aria-disabled")) === "true") continue;
            await option.scrollIntoViewIfNeeded();
            await option.click();
            await sleep(150);
            if ((await faces.getByRole("option", { name: face, exact: true }).count()) > 0) break;
          }
          await doubleClickWord(page, text, word);
        }
        await faces.getByRole("option", { name: face, exact: true }).click();
        const want = { bold: /Bold/.test(face), italic: /Italic/.test(face) };
        const ok = await until(async () => {
          const style = await styleOf(text, word);
          return style.bold === want.bold && style.italic === want.italic;
        }, 3_000);
        return {
          ok,
          detail: JSON.stringify(
            await styleOf(text, word).then((s) => ({ bold: s.bold, italic: s.italic })),
          ),
        };
      },
      {
        meta: fmeta(
          "option",
          `Typeface: ${face}`,
          "click the typeface in the Fonts panel",
          "the selected word takes the typeface",
          [["option", face, /listbox:Typeface/]],
        ),
      },
    );
  }
  for (const size of SIZES) {
    row(
      `${P}.fonts.size.${size}`,
      async ({ page, ctx }) => {
        const { text, word, panel } = await withFonts(page, ctx);
        const option = panel
          .getByRole("listbox", { name: "Size" })
          .getByRole("option", { name: String(size), exact: true });
        await option.scrollIntoViewIfNeeded();
        await option.click();
        const ok = await until(
          async () => Math.round((await styleOf(text, word)).size) === size,
          3_000,
        );
        return { ok, detail: `size=${(await styleOf(text, word)).size}px` };
      },
      {
        meta: fmeta(
          "option",
          `Size: ${size}`,
          "click the size in the Fonts panel",
          `the selected word is ${size} points`,
          [["option", String(size), /listbox:Size/]],
        ),
      },
    );
  }
  // Each submenu of the Font and Text commands opens when the pointer rests on its item, without a click. The
  // menus open after a short delay of their own (about 0.3 s in every engine): the row waits up to 3 s and says how
  // long it took.
  for (const trail of [ed.font, ed.text]) {
    if (!trail || trail.length < 2) continue;
    const sub = trail.at(-1);
    row(
      `${P}.menu.${slug(trail.join(" "))}.hover`,
      async ({ page, ctx }) => {
        await editor(page, ctx);
        await openMenu(page, trail[0]);
        let waited = 0;
        for (const name of trail.slice(1)) {
          const trigger = page.getByRole("menuitem", { name, exact: true }).last();
          await trigger.waitFor({ timeout: 5_000 });
          const box = await trigger.boundingBox();
          const started = Date.now();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
          const opened = await until(
            () => page.getByRole("menu", { name, exact: true }).last().isVisible(),
            3_000,
          );
          waited = Date.now() - started;
          if (!opened) {
            await page.keyboard.press("Escape");
            return {
              ok: false,
              detail: `${name} did not open within 3 s of the pointer resting on it`,
            };
          }
        }
        const items =
          (await readOpenMenus(page)).find((menu) => menu.label === sub)?.items.length ?? 0;
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        return {
          ok: items > 0,
          detail: `${sub} opened on hover after ${waited} ms, ${items} items`,
        };
      },
      {
        meta: {
          state: ed.state,
          role: "menuitem",
          name: sub,
          how: `rest the pointer on ${menuPath(...trail)} without clicking`,
          expect: `the ${sub} submenu opens within 3 s`,
          persists: "none",
          covers: [["menuitem", sub, new RegExp(`${trail.at(-2)}$`)]],
        },
      },
    );
  }
  row(
    `${P}.fonts.close.keyboard-back`,
    async ({ page, ctx }) => {
      const { text, word, panel } = await withFonts(page, ctx);
      await panel
        .getByRole("listbox", { name: "Typeface" })
        .getByRole("option", { name: "Bold", exact: true })
        .click();
      const bold = await until(async () => (await styleOf(text, word)).bold, 3_000);
      await panel
        .getByRole("group", { name: "Window controls" })
        .getByRole("button", { name: "Close" })
        .click();
      await until(async () => !(await panel.isVisible()), 3_000);
      // The keyboard is back in the document, on the word: a key typed now replaces it.
      await page.keyboard.type("Q");
      const replaced = await until(
        () =>
          text.evaluate(
            (root, gone) =>
              !root.textContent.includes(gone) && root.textContent.includes("alpha Q omega"),
            word,
          ),
        3_000,
      );
      const focus = await page.evaluate(
        () =>
          `${document.activeElement?.tagName} ${document.activeElement?.getAttribute("aria-label") ?? ""}`,
      );
      return {
        ok: bold && replaced,
        detail: `bold=${bold} typed into the word=${replaced} (keyboard: ${focus})`,
      };
    },
    {
      meta: fmeta(
        "button",
        "Fonts panel: Close",
        "choose Bold in Typeface, close the panel with its close button, type Q",
        "the panel closes and Q replaces the selected word: the document has the keyboard back",
        [["button", "Fonts panel: Close", /dialog:Fonts|region:Fonts/]],
      ),
    },
  );
  row(
    `${P}.fonts.size-field`,
    async ({ page, ctx }) => {
      const { text, word, panel } = await withFonts(page, ctx);
      const field = panel.getByRole("textbox", { name: "Font size" });
      await field.click({ clickCount: 3 });
      await page.keyboard.type("31");
      await page.keyboard.press("Enter");
      const ok = await until(
        async () => Math.round((await styleOf(text, word)).size) === 31,
        3_000,
      );
      return { ok, detail: `size=${(await styleOf(text, word)).size}px` };
    },
    {
      meta: fmeta(
        "textbox",
        "Font size",
        "type 31 and Return in the size field",
        "the selected word is 31 points",
        [["textbox", "Font size", /dialog:Fonts/]],
      ),
    },
  );
  for (const [id, label, check] of [
    ["underline", "Text underline", (s) => s.underline],
    ["strikethrough", "Text strikethrough", (s) => s.strike],
  ]) {
    row(
      `${P}.fonts.${id}`,
      async ({ page, ctx }) => {
        const { text, word, panel } = await withFonts(page, ctx);
        const popup = panel.getByRole("combobox", { name: label });
        const choose = async (value) => {
          await popup.click();
          await page
            .getByRole("option", { name: value, exact: true })
            .or(page.getByRole("menuitemradio", { name: value, exact: true }))
            .or(page.getByRole("menuitem", { name: value, exact: true }))
            .last()
            .click();
          await sleep(250);
        };
        await choose("Single");
        const on = await until(async () => check(await styleOf(text, word)), 3_000);
        await doubleClickWord(page, text, word);
        await choose("None");
        const off = await until(async () => !check(await styleOf(text, word)), 3_000);
        return { ok: on && off, detail: `single=${on} none=${off}` };
      },
      {
        meta: fmeta(
          "combobox",
          label,
          `the ${label} pop-up: Single, then None`,
          `the selected word is ${id === "underline" ? "underlined" : "struck through"}, then plain again`,
          [["combobox", label, /dialog:Fonts/]],
        ),
      },
    );
  }
  row(
    `${P}.fonts.text-color`,
    async ({ page, ctx }) => {
      const { text, word, panel } = await withFonts(page, ctx);
      // The well is the browser's own colour input (<input type="color">): its picker is outside the page, so the
      // colour is entered with Playwright's fill on that input, which types the value as the picker would return it.
      const well = panel.getByLabel("Text color");
      const before = await colorOf(text, word);
      const target = before === "rgb(204, 0, 0)" ? "#0055cc" : "#cc0000";
      await well.fill(target);
      const ok = await until(async () => (await colorOf(text, word)) === rgbOf(target), 3_000);
      return { ok, detail: `${before} -> ${await colorOf(text, word)} (well ${target})` };
    },
    {
      meta: fmeta(
        "textbox",
        "Text color",
        "enter a colour in the Text color well (the browser's colour input)",
        "the selected word takes the colour",
        [
          ["textbox", "Text color", /dialog:Fonts/],
          ["button", "Text color", /dialog:Fonts/],
        ],
      ),
    },
  );
  row(
    `${P}.fonts.search`,
    async ({ page, ctx }) => {
      const { panel } = await withFonts(page, ctx);
      const search = panel.getByRole("searchbox", { name: "Search fonts" });
      await search.click();
      await page.keyboard.type("Cour");
      const families = panel.getByRole("listbox", { name: "Family" }).getByRole("option");
      const ok = await until(
        async () =>
          (await families.allInnerTexts()).map((each) => each.trim()).join() === "Courier",
        3_000,
      );
      const shown = await families.allInnerTexts();
      await search.click({ clickCount: 3 });
      await page.keyboard.press("Backspace");
      const back = await until(async () => (await families.count()) === ed.familyCount, 3_000);
      return {
        ok: ok && back,
        detail: `matches: ${shown.join(", ")}; cleared back to all=${back} (${await families.count()} of ${ed.familyCount})`,
      };
    },
    {
      meta: fmeta(
        "searchbox",
        "Search fonts",
        "type Cour in the panel's search field, then clear it",
        "only Courier is listed, then every family again",
        [["searchbox", "Search fonts", /dialog:Fonts/]],
      ),
    },
  );
  panelChromeRows(
    row,
    `${P}.fonts`,
    fontsState,
    (page) => fontsPanel(page, ed),
    "Fonts",
    /dialog:Fonts/,
  );

  // ---- Colors panel -------------------------------------------------------------------------------------------------
  const colorsState = `${ed.state}, Colors panel`;
  const cmeta = (role, name, how, expect, covers) => ({
    state: colorsState,
    role,
    name,
    how,
    expect,
    persists: "none",
    covers,
  });
  const withColors = async (page, ctx, tab) => {
    const text = await editor(page, ctx);
    const word = await line(page, text, "Cl");
    await doubleClickWord(page, text, word);
    const panel = await colorsPanel(page, ed);
    if (tab) await panel.getByRole("tab", { name: tab, exact: true }).click();
    return { text, word, panel };
  };
  /** After picking: the word takes the panel's current colour, which differs from what it was. */
  const applied = async (text, word, panel, before) => {
    let hex = "";
    const ok = await until(async () => {
      hex = await currentColor(panel);
      return (await colorOf(text, word)) === rgbOf(hex) && rgbOf(hex) !== before;
    }, 3_000);
    return { ok, detail: `${before} -> ${await colorOf(text, word)} (panel ${hex})` };
  };
  for (const tab of TABS) {
    row(
      `${P}.colors.tab.${slug(tab)}`,
      async ({ page, ctx }) => {
        const { panel } = await withColors(page, ctx);
        await panel.getByRole("tab", { name: tab, exact: true }).click();
        const ok = await until(
          async () =>
            (await panel
              .getByRole("tab", { name: tab, exact: true })
              .getAttribute("aria-selected")) === "true" &&
            (await panel.getByRole("tabpanel", { name: tab }).isVisible()),
          3_000,
        );
        return { ok, detail: ok ? `${tab} shown` : `${tab} not shown` };
      },
      {
        meta: cmeta("tab", tab, "click the picker's tab", "the picker is shown", [
          ["tab", tab, /dialog:Colors/],
        ]),
      },
    );
  }
  for (const color of PALETTE) {
    row(
      `${P}.colors.palette.${slug(color)}`,
      async ({ page, ctx }) => {
        const { text, word, panel } = await withColors(page, ctx, "Color Palettes");
        // From another colour first, so a pick of the panel's current colour still changes the word.
        await panel
          .getByRole("radio", { name: color === "Purple" ? "Orange" : "Purple", exact: true })
          .click();
        await doubleClickWord(page, text, word);
        const before = await colorOf(text, word);
        await panel.getByRole("radio", { name: color, exact: true }).click();
        return applied(text, word, panel, before);
      },
      {
        meta: cmeta(
          "radio",
          `Palette: ${color}`,
          "click the swatch in Color Palettes",
          "the selected word takes the colour",
          [["radio", color, /radiogroup:Apple/]],
        ),
      },
    );
  }
  PENCILS.forEach((pencil, index) => {
    row(
      `${P}.colors.pencil.${slug(pencil)}${PENCILS.indexOf(pencil) !== index ? "-2" : ""}`,
      async ({ page, ctx }) => {
        const { text, word, panel } = await withColors(page, ctx, "Pencils");
        const pencils = panel.getByRole("radiogroup", { name: "Pencils" }).getByRole("radio");
        await pencils.nth(index === 0 ? 1 : 0).click();
        await doubleClickWord(page, text, word);
        const before = await colorOf(text, word);
        await pencils.nth(index).click();
        return applied(text, word, panel, before);
      },
      {
        meta: cmeta(
          "radio",
          `Pencil: ${pencil}`,
          "click the pencil",
          "the selected word takes the colour",
          [["radio", pencil, /radiogroup:Pencils/]],
        ),
      },
    );
  });
  /**
   * Press `locator` at a fraction (fx, fy) of its visible box with the real pointer. A slider's accessible element is
   * Base UI's visually hidden range input, so its visible track (the first ancestor of the thumb at least 60 px wide
   * and inside the viewport) is pressed instead; a wheel is pressed on its own box.
   */
  const clickAt = async (page, locator, fx, fy) => {
    const box = await locator.evaluate((element) => {
      const sane = (rect) =>
        rect.width >= 60 && rect.width < innerWidth - 20 && rect.x >= 0 && rect.y >= 0;
      let at = element.tagName === "INPUT" ? element.parentElement : element;
      while (at && !sane(at.getBoundingClientRect())) at = at.parentElement;
      const rect = (at ?? element).getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await sleep(200);
  };
  /** A grey baseline (#808080) typed in the Color Sliders' hex field, so a wheel or slider press visibly changes it. */
  const greyBaseline = async (page, panel) => {
    await panel.getByRole("tab", { name: "Color Sliders", exact: true }).click();
    const hex = panel
      .getByRole("tabpanel", { name: "Color Sliders" })
      .getByRole("textbox", { name: /Hex Color/ });
    await hex.click({ clickCount: 3 });
    await page.keyboard.type("808080");
    await page.keyboard.press("Enter");
    await sleep(200);
  };
  for (const [id, tab, label, fx, fy] of [
    ["wheel.hue-saturation", "Color Wheel", "Hue and saturation", 0.85, 0.5],
    ["wheel.brightness", "Color Wheel", "Brightness", 0.95, 0.5],
    ["image.hue-saturation", "Image Palettes", "Hue and saturation", 0.3, 0.4],
  ]) {
    row(
      `${P}.colors.${id}`,
      async ({ page, ctx }) => {
        const { text, word, panel } = await withColors(page, ctx);
        await greyBaseline(page, panel);
        await panel.getByRole("tab", { name: tab, exact: true }).click();
        const tabpanel = panel.getByRole("tabpanel", { name: tab });
        const before = await colorOf(text, word);
        await clickAt(page, tabpanel.getByRole("slider", { name: label }), fx, fy);
        return applied(text, word, panel, before);
      },
      {
        meta: cmeta(
          "slider",
          `${tab}: ${label}`,
          `press on the ${label} control`,
          "the colour changes and the selected word takes it",
          [["slider", label, new RegExp(`tabpanel:${tab}`)]],
        ),
      },
    );
  }
  for (const channel of ["Red", "Green", "Blue"]) {
    row(
      `${P}.colors.sliders.${slug(channel)}-slider`,
      async ({ page, ctx }) => {
        const { text, word, panel } = await withColors(page, ctx);
        await greyBaseline(page, panel);
        const tabpanel = panel.getByRole("tabpanel", { name: "Color Sliders" });
        const before = await colorOf(text, word);
        await clickAt(page, tabpanel.getByRole("slider", { name: channel, exact: true }), 0.9, 0.5);
        return applied(text, word, panel, before);
      },
      {
        meta: cmeta(
          "slider",
          `Color Sliders: ${channel}`,
          "press on the channel's slider track",
          "the channel changes and the selected word takes the colour",
          [["slider", channel, /tabpanel:Color Sliders/]],
        ),
      },
    );
    row(
      `${P}.colors.sliders.${slug(channel)}-value`,
      async ({ page, ctx }) => {
        const { text, word, panel } = await withColors(page, ctx, "Color Sliders");
        const field = panel
          .getByRole("tabpanel", { name: "Color Sliders" })
          .getByRole("textbox", { name: `${channel} value` });
        const value = String(37 + ["Red", "Green", "Blue"].indexOf(channel) * 70);
        await field.click({ clickCount: 3 });
        await page.keyboard.type(value);
        await page.keyboard.press("Enter");
        await sleep(200);
        const hex = await currentColor(panel);
        const channelValue = Number.parseInt(
          hex.slice(
            1 + ["Red", "Green", "Blue"].indexOf(channel) * 2,
            3 + ["Red", "Green", "Blue"].indexOf(channel) * 2,
          ),
          16,
        );
        const ok =
          channelValue === Number(value) &&
          (await until(async () => (await colorOf(text, word)) === rgbOf(hex), 3_000));
        return { ok, detail: `panel ${hex}, word ${await colorOf(text, word)}` };
      },
      {
        meta: cmeta(
          "textbox",
          `Color Sliders: ${channel} value`,
          "type a value and Return",
          "the channel takes the value and the selected word the colour",
          [["textbox", `${channel} value`, /tabpanel:Color Sliders/]],
        ),
      },
    );
  }
  row(
    `${P}.colors.sliders.hex`,
    async ({ page, ctx }) => {
      const { text, word, panel } = await withColors(page, ctx, "Color Sliders");
      const field = panel
        .getByRole("tabpanel", { name: "Color Sliders" })
        .getByRole("textbox", { name: /Hex Color/ });
      await field.click({ clickCount: 3 });
      await page.keyboard.type("336699");
      await page.keyboard.press("Enter");
      const ok = await until(
        async () =>
          (await currentColor(panel)) === "#336699" &&
          (await colorOf(text, word)) === "rgb(51, 102, 153)",
        3_000,
      );
      return {
        ok,
        detail: `panel ${await currentColor(panel)}, word ${await colorOf(text, word)}`,
      };
    },
    {
      meta: cmeta(
        "textbox",
        "Color Sliders: Hex Color #",
        "type 336699 and Return",
        "the colour is #336699 and the selected word takes it",
        [["textbox", "Hex Color #", /tabpanel:Color Sliders/]],
      ),
    },
  );
  row(
    `${P}.colors.sliders.model`,
    async ({ page, ctx }) => {
      const { panel } = await withColors(page, ctx, "Color Sliders");
      const tabpanel = panel.getByRole("tabpanel", { name: "Color Sliders" });
      const model = tabpanel.getByRole("combobox", { name: "Color model" });
      // The pop-up's own list (the note list is a listbox of options too).
      const popup = page
        .getByRole("listbox")
        .filter({ has: page.getByRole("option", { name: "RGB Sliders", exact: true }) })
        .last();
      await model.click();
      await popup.waitFor({ timeout: 3_000 });
      const names = (await popup.getByRole("option").allInnerTexts())
        .map((each) => each.trim())
        .filter(Boolean);
      await page.keyboard.press("Escape");
      const results = [];
      for (const name of names) {
        await model.click();
        await popup.getByRole("option", { name, exact: true }).click();
        await sleep(250);
        const shown = (await model.innerText()).trim();
        const sliders = await tabpanel.getByRole("slider").count();
        results.push(
          `${name}:${shown === name && sliders > 0 ? "ok" : `shown=${shown},sliders=${sliders}`}`,
        );
      }
      await model.click();
      await popup.getByRole("option", { name: "RGB Sliders", exact: true }).click();
      return {
        ok: names.length > 1 && results.every((each) => each.endsWith(":ok")),
        detail: results.join(" "),
      };
    },
    {
      meta: cmeta(
        "combobox",
        "Color Sliders: Color model",
        "choose each model in the pop-up",
        "each model shows its sliders",
        [["combobox", "Color model", /tabpanel:Color Sliders/]],
      ),
    },
  );
  row(
    `${P}.colors.eyedropper`,
    async ({ page, ctx }) => {
      const { text, word, panel } = await withColors(page, ctx);
      const button = panel.getByRole("button", { name: "Pick a color from the screen" });
      const supported = await page.evaluate(() => "EyeDropper" in window);
      if (!supported) {
        // No EyeDropper in this browser: the control must be dimmed with the reason on screen.
        const disabled = await button.isDisabled();
        const reason = panel.locator(".mac-color-panel-eyedropper-reason");
        const shown = await reason.isVisible().catch(() => false);
        if (disabled && shown) return { unavailable: (await reason.innerText()).trim() };
        return {
          ok: false,
          detail: `no EyeDropper in this browser; dimmed=${disabled}; reason shown=${shown}`,
        };
      }
      // The kit's pass-through spy counts the page's calls of the browser's EyeDropper.open(): the observable sign
      // that the click asked the browser for its screen picker. The picker itself is outside the page, where
      // Playwright cannot sample a colour; leaving it with Escape must leave the word's colour as it was.
      const opens = () => page.evaluate(() => window.__r4EyeDropperOpens ?? -1);
      const before = await opens();
      const color = await colorOf(text, word);
      await button.click();
      const asked = await until(async () => (await opens()) === before + 1, 3_000);
      await page.keyboard.press("Escape");
      await sleep(400);
      const kept = (await colorOf(text, word)) === color;
      return {
        ok: before >= 0 && asked && kept,
        detail: `EyeDropper.open() calls ${before} -> ${await opens()}; colour kept after Escape=${kept} (sampling the screen is outside the page)`,
      };
    },
    {
      meta: cmeta(
        "button",
        "Pick a color from the screen",
        "click the eyedropper",
        "the browser's screen colour picker opens, or the control is dimmed with the reason where the browser has none",
        [["button", "Pick a color from the screen", /dialog:Colors/]],
      ),
    },
  );
  panelChromeRows(
    row,
    `${P}.colors`,
    colorsState,
    (page) => colorsPanel(page, ed),
    "Colors",
    /dialog:Colors/,
  );
}

/**
 * A dimmed window control passes as unavailable only with a reason the person sees: its tooltip (`title`, shown on
 * hover) or the controls group's, read after a real hover.
 */
async function dimmedReason(button, name) {
  await button.hover({ force: true }).catch(() => {});
  const reason = await button.evaluate(
    (element) =>
      element.getAttribute("title") || element.closest("[title]")?.getAttribute("title") || "",
  );
  return reason
    ? { unavailable: reason }
    : { ok: false, detail: `${name} is dimmed without a reason` };
}

/** Close, minimise and full screen of a panel (Fonts or Colors). */
export function panelChromeRows(row, prefix, state, open, name, trail) {
  const controls = (panel) => panel.getByRole("group", { name: "Window controls" });
  row(
    `${prefix}.chrome.close`,
    async ({ page }) => {
      const panel = await open(page);
      await controls(panel).getByRole("button", { name: "Close" }).click();
      const gone = await until(async () => !(await panel.isVisible()), 3_000);
      return { ok: gone, detail: gone ? "closed" : "still shown" };
    },
    {
      meta: {
        state,
        role: "button",
        name: `${name} panel: Close`,
        how: "click the panel's close button",
        expect: "the panel closes",
        persists: "none",
        covers: [["button", "Close", trail]],
      },
    },
  );
  row(
    `${prefix}.chrome.minimize`,
    async ({ page }) => {
      const panel = await open(page);
      const button = controls(panel).getByRole("button", { name: "Minimize" });
      if (await button.isDisabled()) return dimmedReason(button, "Minimize");
      await button.click();
      const gone = await until(async () => !(await panel.isVisible()), 3_000);
      return { ok: gone, detail: gone ? "minimised" : "still shown" };
    },
    {
      meta: {
        state,
        role: "button",
        name: `${name} panel: Minimize`,
        how: "click the panel's minimise button",
        expect: "the panel leaves the screen",
        persists: "none",
        covers: [["button", "Minimize", trail]],
      },
    },
  );
  row(
    `${prefix}.chrome.full-screen`,
    async ({ page }) => {
      const panel = await open(page);
      const button = controls(panel)
        .getByRole("button", { name: /Full Screen|Zoom/ })
        .first();
      if (await button.isDisabled()) return dimmedReason(button, "Enter Full Screen");
      const before = await panel.boundingBox();
      await button.click();
      await sleep(500);
      const after = await panel.boundingBox();
      const grew =
        after && before && (after.width > before.width + 40 || after.height > before.height + 40);
      await page.keyboard.press("Escape");
      const exit = controls(panel).getByRole("button", { name: /Exit Full Screen/ });
      if (await exit.isVisible().catch(() => false)) await exit.click();
      return {
        ok: Boolean(grew),
        detail: `${before?.width}x${before?.height} -> ${after?.width}x${after?.height}`,
      };
    },
    {
      meta: {
        state,
        role: "button",
        name: `${name} panel: Enter Full Screen`,
        how: "click the panel's full screen button",
        expect: "the panel fills the screen, or the control is dimmed with a reason",
        persists: "none",
        covers: [["button", "Enter Full Screen", trail]],
      },
    },
  );
}

/**
 * Before every row: close any open menu, then the Fonts and Colors panels with their own close buttons (a panel left
 * open floats over the top right of the page, over the windows' toolbars).
 */
export async function tidy(page) {
  for (let index = 0; index < 2; index += 1) await page.keyboard.press("Escape").catch(() => {});
  for (const name of ["Fonts", "Colors"]) {
    const panel = page
      .getByRole("dialog", { name, exact: true })
      .or(page.getByRole("region", { name, exact: true }));
    for (let index = await panel.count(); index > 0; index -= 1) {
      const each = panel.nth(index - 1);
      if (await each.isVisible().catch(() => false)) await closePanel(each).catch(() => {});
    }
  }
}

/** Re-exported for suites. */
export { menuBar };
