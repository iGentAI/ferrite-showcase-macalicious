#!/usr/bin/env node

// Notes census journey (R4): one `ok`/`FAIL` line per census id of Notes, on the served desktop with real input, in
// chromium, chrome, firefox or webkit. The shared editing rows (Edit, Format > Font, Format > Text, the Fonts and
// Colors panels) come from r4-editor-rows.mjs and the app menu and window rows from r4-app-rows.mjs; this file adds
// Notes' own controls (toolbar, folders, list, splitters, Format and Table commands), persistence across a reload and
// a real server restart (`--phase restart-check`), per-account isolation, live update between windows and the
// conflict notice.
//
//   node e2e/notes-census-journey.mjs --browser chromium|chrome|firefox|webkit [--phase write|restart-check]
//                                     [--url http://127.0.0.1:8080] [--only <regex>] [--emit]

import { appRows } from "./r4-app-rows.mjs";
import {
  acceptUnload,
  api,
  chooseMenu,
  clickAfter,
  createAccount,
  doubleClickWord,
  drag,
  menuState,
  newIdentity,
  openFromDock,
  reload,
  sleep,
  styleOf,
  until,
} from "./r4-census-kit.mjs";
import { editorRows, keyFor, line, tidy, uniq } from "./r4-editor-rows.mjs";

const { row, run, opts } = census();

function census() {
  return censusFor("notes");
}

import { census as censusFor } from "./r4-census-kit.mjs";

const S = "Notes window";
const m = (role, name, how, expect, covers = [], extra = {}) => ({
  meta: { state: S, role, name, how, expect, persists: "none", covers, ...extra },
});

const win = (page) => page.getByRole("region", { name: "Notes", exact: true }).first();
const editorOf = (page) => page.locator('[role="textbox"][aria-label="Note"]:visible').first();
const listOf = (window) => window.getByRole("listbox", { name: "Notes" });
const toolbar = (window) => window.getByRole("toolbar", { name: "Notes toolbar" });
const notesData = async (page) =>
  (await api(page, "GET", "/api/notes/data")).json?.data ?? { notes: [], folders: [] };

/** The Notes window, opened (or brought back) from the Dock when it is not showing. */
async function notesWindow(page) {
  const window = win(page);
  if (await window.isVisible().catch(() => false)) return window;
  return openFromDock(page, "Notes", "Notes");
}

/** A new note titled `title`, made with the toolbar's New Note; resolves with its editor. */
async function newNote(page, title) {
  const window = await notesWindow(page);
  await toolbar(window).getByRole("button", { name: "New Note" }).click();
  const editor = editorOf(page);
  await editor.waitFor({ timeout: 10_000 });
  await editor.click();
  await page.keyboard.type(title);
  await sleep(250);
  return editor;
}

/** The server's note whose first line is `title` once `check` holds for it, or null after `ms`. */
async function savedNote(page, title, check = () => true, ms = 8_000) {
  let found = null;
  await until(
    async () => {
      found =
        (await notesData(page)).notes.find(
          (note) => (note.lines?.[0] ?? "").trim() === title && check(note),
        ) ?? null;
      return Boolean(found);
    },
    ms,
    300,
  );
  return found;
}

/** Show the note titled `title` by clicking it in the list. */
async function showNote(page, title) {
  const window = await notesWindow(page);
  const editor = editorOf(page);
  if ((await editor.innerText().catch(() => "")).includes(title)) return editor;
  await listOf(window).getByRole("option").filter({ hasText: title }).first().click();
  await until(async () => (await editor.innerText()).includes(title), 4_000);
  return editor;
}

/**
 * The census note the shared editing rows type into: made once, and made again when it is no longer listed (a row took
 * its text away: in Firefox, Edit > Undo takes all of the note's typing, title included), so that such a row fails alone
 * instead of every row after it.
 */
async function noteEditor(page, ctx) {
  if (ctx.data.censusNote) {
    const window = await notesWindow(page);
    const editor = editorOf(page);
    if ((await editor.innerText().catch(() => "")).includes(ctx.data.censusNote)) return editor;
    const listed = await listOf(window)
      .getByRole("option")
      .filter({ hasText: ctx.data.censusNote })
      .count();
    if (listed > 0) return showNote(page, ctx.data.censusNote);
  }
  ctx.data.censusNote = uniq("Census");
  return newNote(page, ctx.data.censusNote);
}

/** The grid of the last table in the editor: { rows, cols, caretRow, caretCol }. */
const gridOf = (editor) =>
  editor.evaluate((root) => {
    const tables = root.querySelectorAll("table");
    const table = tables[tables.length - 1];
    if (!table) return null;
    const selection = document.getSelection();
    const at = selection?.anchorNode
      ? selection.anchorNode.nodeType === 1
        ? selection.anchorNode
        : selection.anchorNode.parentElement
      : null;
    const cell = at?.closest?.("td, th");
    const rowElement = cell?.closest("tr");
    return {
      rows: table.rows.length,
      cols: table.rows[0]?.cells.length ?? 0,
      caretRow: rowElement && table.contains(rowElement) ? rowElement.rowIndex : -1,
      caretCol: cell && table.contains(cell) ? cell.cellIndex : -1,
    };
  });

/** A fresh table at the end of the census note with the insertion point in a cell holding a new word. */
async function inTable(page, ctx) {
  const editor = await noteEditor(page, ctx);
  await line(page, editor, "Tb");
  const window = await notesWindow(page);
  const tables = await editor.locator("table").count();
  await toolbar(window).getByRole("button", { name: "Add Table" }).click();
  await until(async () => (await editor.locator("table").count()) === tables + 1, 3_000);
  const marker = uniq("Cell");
  await page.keyboard.type(marker);
  await sleep(200);
  const grid = await gridOf(editor);
  return { editor, marker, grid };
}

// ---- Shared editing rows ----------------------------------------------------------------------------------------
editorRows(row, {
  P: "notes",
  state: "Notes window, a note open",
  editor: noteEditor,
  // After an Undo (the ruling of 24 Oct) the census note must still exist: listed, and on the server with its title.
  exists: async (page, ctx) => {
    const title = ctx.data.censusNote;
    await sleep(1_500);
    const listed =
      (await listOf(await notesWindow(page))
        .getByRole("option")
        .filter({ hasText: title })
        .count()) > 0;
    const saved = (await notesData(page)).notes.some(
      (note) => (note.lines?.[0] ?? "").trim() === title,
    );
    return {
      ok: listed && saved,
      detail: `still listed=${listed}, on the server with its title=${saved}`,
    };
  },
  // Notes' Fonts panel lists System Font first: 23 families.
  systemFont: true,
  font: ["Format", "Font"],
  text: ["Format", "Text"],
  strike: true,
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

// ---- Toolbar -----------------------------------------------------------------------------------------------------
row(
  "notes.toolbar.new-note",
  async ({ page }) => {
    const window = await notesWindow(page);
    const before = await listOf(window).getByRole("option").count();
    const title = uniq("New");
    await newNote(page, title);
    const listed = await until(
      async () => (await listOf(window).getByRole("option").count()) === before + 1,
      3_000,
    );
    const selected = (
      await listOf(window).locator('[role="option"][aria-selected="true"]').first().innerText()
    ).replace(/\s+/g, " ");
    const saved = await savedNote(page, title);
    return {
      ok: listed && selected.includes(title) && Boolean(saved),
      detail: `listed=${listed} selected="${selected.slice(0, 50)}" saved=${Boolean(saved)}`,
    };
  },
  m(
    "button",
    "New Note",
    "click New Note in the toolbar and type a title",
    "a new note is listed, selected and saved",
    [["button", "New Note", /toolbar:Notes toolbar/]],
    { persists: "server" },
  ),
);
row(
  "notes.toolbar.delete",
  async ({ page }) => {
    const window = await notesWindow(page);
    const title = uniq("Del");
    await newNote(page, title);
    if (!(await savedNote(page, title))) {
      return { ok: false, detail: "the note to delete never reached the server" };
    }
    await toolbar(window).getByRole("button", { name: "Delete" }).click();
    const unlisted = await until(
      async () =>
        (await listOf(window).getByRole("option").filter({ hasText: title }).count()) === 0,
      4_000,
    );
    let where = "";
    const removed = await until(
      async () => {
        const note = (await notesData(page)).notes.find(
          (each) => (each.lines?.[0] ?? "").trim() === title,
        );
        where = note ? `folder ${note.folder}, deleted ${note.deleted}` : "gone";
        return !note || note.deleted !== undefined;
      },
      6_000,
      300,
    );
    return { ok: unlisted && removed, detail: `unlisted=${unlisted} server: ${where}` };
  },
  m(
    "button",
    "Delete",
    "make a note, click Delete in the toolbar",
    "the note leaves the list, and the server has it as deleted or not at all",
    [["button", "Delete", /toolbar:Notes toolbar/]],
    { persists: "server" },
  ),
);
for (const [id, button, other] of [
  ["gallery-view", "Gallery View", "List View"],
  ["list-view", "List View", "Gallery View"],
]) {
  row(
    `notes.toolbar.${id}`,
    async ({ page }) => {
      const window = await notesWindow(page);
      await toolbar(window).getByRole("button", { name: other }).click();
      await sleep(250);
      await toolbar(window).getByRole("button", { name: button }).click();
      const pressed = await until(
        async () =>
          (await toolbar(window)
            .getByRole("button", { name: button })
            .getAttribute("aria-pressed")) === "true",
        2_000,
      );
      // Gallery lays the notes out side by side; the list stacks them.
      const options = listOf(window).getByRole("option");
      const [first, second] = [
        await options.nth(0).boundingBox(),
        await options.nth(1).boundingBox(),
      ];
      const sideBySide = Boolean(
        first && second && Math.abs(first.y - second.y) < 4 && second.x > first.x,
      );
      const laidOut = button === "Gallery View" ? sideBySide : !sideBySide;
      if (button === "Gallery View")
        await toolbar(window).getByRole("button", { name: "List View" }).click();
      return { ok: pressed && laidOut, detail: `pressed=${pressed} side by side=${sideBySide}` };
    },
    m(
      "button",
      button,
      `click ${button} in the toolbar`,
      button === "Gallery View"
        ? "the notes show as a gallery of cards"
        : "the notes show as a list",
      [["button", button, /group:View/]],
    ),
  );
}
row(
  "notes.toolbar.hide-show-folders",
  async ({ page }) => {
    const window = await notesWindow(page);
    const tree = window.getByRole("tree", { name: "Folders" });
    await toolbar(window).getByRole("button", { name: "Hide Folders" }).click();
    const hidden = await until(async () => !(await tree.isVisible()), 2_000);
    const show = toolbar(window).getByRole("button", { name: "Show Folders" });
    const renamed = await show.isVisible();
    await show.click();
    const shown = await until(() => tree.isVisible(), 2_000);
    return {
      ok: hidden && renamed && shown,
      detail: `hidden=${hidden} button became Show Folders=${renamed} shown again=${shown}`,
    };
  },
  m(
    "button",
    "Hide Folders / Show Folders",
    "click Hide Folders, then Show Folders",
    "the folder list hides, then shows",
    [
      ["button", "Hide Folders", /toolbar:Notes toolbar/],
      ["button", "Show Folders", /toolbar:Notes toolbar/],
    ],
  ),
);
row(
  "notes.toolbar.attachments-only",
  async ({ page }) => {
    const window = await notesWindow(page);
    await window
      .getByRole("tree", { name: "Folders" })
      .getByRole("treeitem")
      .filter({ hasText: /^Notes/ })
      .first()
      .click();
    const options = listOf(window).getByRole("option");
    const before = await options.count();
    const button = toolbar(window).getByRole("button", { name: "Attachments Browser" });
    await button.click();
    const browser = window.getByRole("group", { name: "Kind of attachment" });
    const opened = await browser.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    );
    await button.click();
    const back = await until(async () => (await options.count()) === before, 3_000);
    return {
      ok: opened && back,
      detail: `browser shown=${opened}; ${before} notes listed again=${back}`,
    };
  },
  m(
    "button",
    "Attachments Browser",
    "click Attachments Browser, then again",
    "the browser of attachments by kind shows, then the notes again",
    [["button", "Attachments Browser", /toolbar:Notes toolbar/]],
  ),
);
/**
 * Lock the note shown from the toolbar, under whichever sheet the account is at, and wait for the
 * server to hold its envelope and none of its text.
 */
const NOTES_PASSWORD = "census-notes-password";
async function lockShownNote(page, title) {
  const window = await notesWindow(page);
  const id = (await savedNote(page, title))?.id;
  await toolbar(window).getByRole("button", { name: "Lock", exact: true }).click();
  await page.getByRole("menuitem", { name: "Lock Note", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Create a Password" });
  const enter = page.getByRole("dialog", { name: "Enter the Notes Password" });
  await until(async () => (await create.isVisible()) || (await enter.isVisible()), 3_000);
  const form = (await create.isVisible()) ? create : (await enter.isVisible()) ? enter : null;
  if (form) {
    await form.getByLabel("Password:", { exact: true }).fill(NOTES_PASSWORD);
    if (form === create) await form.getByLabel("Verify:").fill(NOTES_PASSWORD);
    await form.getByRole("button", { name: "OK" }).click();
  }
  let raw = "";
  const locked = await until(async () => {
    const note = (await notesData(page)).notes.find((each) => each.id === id);
    raw = JSON.stringify(note ?? null);
    return Boolean(note?.sealed?.ciphertext) && (note.lines ?? []).length === 0;
  }, 15_000);
  return { id, locked, clear: raw.includes(title) };
}
/** Choose Remove Lock on the open note shown, and read its text back from the server. */
async function removeShownLock(page, id, title) {
  const window = await notesWindow(page);
  await until(() => editorOf(page).isVisible(), 8_000);
  await toolbar(window).getByRole("button", { name: "Lock", exact: true }).click();
  await page.getByRole("menuitem", { name: "Remove Lock", exact: true }).click();
  return until(async () => {
    const note = (await notesData(page)).notes.find((each) => each.id === id);
    return note?.sealed === undefined && note?.lines?.[0] === title;
  }, 15_000);
}
row(
  "notes.toolbar.lock.lock-note",
  async ({ page }) => {
    const title = uniq("Lock");
    await newNote(page, title);
    const { id, locked, clear } = await lockShownNote(page, title);
    await removeShownLock(page, id, title);
    return { ok: locked && !clear, detail: `sealed=${locked}; text on the server=${clear}` };
  },
  m(
    "menuitem",
    "Lock > Lock Note",
    "click Lock in the toolbar with a plain note shown, choose Lock Note and give a password",
    "the server keeps the note's envelope and none of its text",
    [
      ["button", "Lock", /toolbar:Notes toolbar/],
      ["menuitem", "Lock Note", /menu:Lock/],
    ],
  ),
);
row(
  "notes.toolbar.lock.remove-lock",
  async ({ page }) => {
    const title = uniq("Free");
    await newNote(page, title);
    const { id, locked } = await lockShownNote(page, title);
    const freed = await removeShownLock(page, id, title);
    return { ok: locked && freed, detail: `locked=${locked}; text back=${freed}` };
  },
  m(
    "menuitem",
    "Lock > Remove Lock",
    "choose Remove Lock on a locked note that is open",
    "the note is plain again, its text on the server",
    [
      ["button", "Lock", /toolbar:Notes toolbar/],
      ["menuitem", "Remove Lock", /menu:Lock/],
    ],
    { persists: "server" },
  ),
);
row(
  "notes.toolbar.add-table",
  async ({ page, ctx }) => {
    const { editor, marker, grid } = await inTable(page, ctx);
    const inCell = grid && grid.caretRow >= 0;
    const saved = await savedNote(
      page,
      ctx.data.censusNote,
      (note) => (note.html ?? "").includes(marker) && /<table/.test(note.html ?? ""),
    );
    return {
      ok: Boolean(grid) && inCell && Boolean(saved) && (await editor.innerText()).includes(marker),
      detail: `table ${grid?.rows}x${grid?.cols}, typed into cell ${grid?.caretRow},${grid?.caretCol}; saved=${Boolean(saved)}`,
    };
  },
  m(
    "button",
    "Add Table",
    "click Add Table and type",
    "a table is inserted, the typing goes into its cell and is saved",
    [["button", "Add Table", /toolbar:Notes toolbar/]],
    { persists: "server" },
  ),
);
row(
  "notes.toolbar.checklist",
  async ({ page, ctx }) => {
    const editor = await noteEditor(page, ctx);
    await line(page, editor, "Ck");
    const window = await notesWindow(page);
    const marks = () =>
      editor.evaluate((root) => root.querySelectorAll(".mac-notes-checklist > li").length);
    const before = await marks();
    await toolbar(window).getByRole("button", { name: "Make a Checklist" }).click();
    await sleep(300);
    const added = await until(async () => (await marks()) === before + 1, 3_000);
    const typed = uniq("Item");
    await page.keyboard.type(typed);
    const inItem = await until(
      () =>
        editor.evaluate(
          (root, wanted) =>
            [...root.querySelectorAll(".mac-notes-checklist > li")].some((each) =>
              (each.textContent ?? "").endsWith(`omega${wanted}`),
            ),
          typed,
        ),
      3_000,
    );
    return {
      ok: added && inItem,
      detail: `checklist items ${before} -> ${await marks()}; typing went on at the end of the item=${inItem}`,
    };
  },
  m(
    "button",
    "Make a Checklist",
    "click Make a Checklist on a line",
    "the line becomes a checklist item",
    [["button", "Make a Checklist", /toolbar:Notes toolbar/]],
  ),
);

// The toolbar's Aa (Format) menu: the paragraph styles and lists, and its Font, Text and Table submenus.
const PARAGRAPH = [
  ["Title", (s, body) => s.size > body],
  ["Heading", (s, body) => s.size > body],
  ["Body", (s, body) => s.size === body],
  ["Bulleted List", (s) => s.tags.includes("li") && s.tags.includes("ul")],
  ["Numbered List", (s) => s.tags.includes("li") && s.tags.includes("ol")],
];
for (const via of ["toolbar", "menu"]) {
  for (const [item, check] of PARAGRAPH) {
    row(
      `notes.${via === "toolbar" ? "toolbar.format" : "menu.format"}.${item.toLowerCase().replace(/ /g, "-")}`,
      async ({ page, ctx }) => {
        const editor = await noteEditor(page, ctx);
        const word = await line(page, editor, "Ps");
        const body = (await styleOf(editor, word)).size;
        // Title first for Body, so the command visibly changes the line.
        if (item === "Body") {
          await chooseMenu(page, "Format", "Title");
          await until(async () => (await styleOf(editor, word)).size > body, 2_000);
        }
        if (via === "toolbar") {
          await toolbar(await notesWindow(page))
            .getByRole("button", { name: "Format" })
            .click();
          await page
            .getByRole("menu")
            .last()
            .getByRole(/List/.test(item) ? "menuitemcheckbox" : "menuitemradio", {
              name: item,
              exact: true,
            })
            .click();
        } else await chooseMenu(page, "Format", item);
        let style = null;
        const ok = await until(async () => {
          style = await styleOf(editor, word);
          return check(style, body);
        }, 3_000);
        if (/List/.test(item)) await chooseMenu(page, "Format", item);
        return {
          ok,
          detail: `body ${body}px -> ${style?.size}px <${style?.lineTag}> ${style?.tags.join(">")}`,
        };
      },
      m(
        /List/.test(item) ? "menuitemcheckbox" : "menuitemradio",
        `${via === "toolbar" ? "Aa" : "Format"} > ${item}`,
        via === "toolbar" ? `toolbar Aa (Format) > ${item}` : `menu bar Format > ${item}`,
        `the line becomes ${item}`,
        [
          [
            /List/.test(item) ? "menuitemcheckbox" : "menuitemradio",
            item,
            via === "toolbar" ? /menu:(Aa|Format)$/ : /Format$/,
          ],
        ],
      ),
    );
  }
}
for (const [item, key, tag] of [
  ["Bulleted List", "Shift+Control+7", "ul"],
  ["Numbered List", "Shift+Control+9", "ol"],
]) {
  row(
    `notes.key.${item.toLowerCase().replace(/ /g, "-")}`,
    async ({ page, ctx }) => {
      const editor = await noteEditor(page, ctx);
      const word = await line(page, editor, "Lk");
      await page.keyboard.press(keyFor(key));
      let style = null;
      const ok = await until(async () => {
        style = await styleOf(editor, word);
        return style.tags.includes(tag);
      }, 3_000);
      await page.keyboard.press(keyFor(key));
      return { ok, detail: style?.tags.join(">") };
    },
    m(
      "shortcut",
      `Format > ${item}`,
      `keyboard ${key}`,
      `the line becomes a ${tag === "ul" ? "bulleted" : "numbered"} list item`,
    ),
  );
}
for (const [submenu, item, check, reset] of [
  // Baselines where the check is false: Bold chosen twice from the menu bar (on, then off); Align Right.
  [
    "Font",
    "Bold",
    async (editor, word) => (await styleOf(editor, word)).bold,
    [
      ["Format", "Font", "Bold"],
      ["Format", "Font", "Bold"],
    ],
  ],
  [
    "Text",
    "Center",
    async (editor, word) => (await styleOf(editor, word)).align === "center",
    [["Format", "Text", "Align Right"]],
  ],
]) {
  row(
    `notes.toolbar.format.${submenu.toLowerCase()}-submenu`,
    async ({ page, ctx }) => {
      const editor = await noteEditor(page, ctx);
      const word = await line(page, editor, "Sm");
      for (const trail of reset) {
        await doubleClickWord(page, editor, word);
        await chooseMenu(page, ...trail);
      }
      const baseline = await check(editor, word);
      if (baseline)
        return { ok: false, detail: `no baseline: ${item} already holds before the toolbar acts` };
      await doubleClickWord(page, editor, word);
      await toolbar(await notesWindow(page))
        .getByRole("button", { name: "Format" })
        .click();
      await page
        .getByRole("menu")
        .last()
        .getByRole("menuitem", { name: submenu, exact: true })
        .hover();
      await sleep(400);
      const listed = (
        await page.getByRole("menu").last().locator('[role^="menuitem"]').allInnerTexts()
      ).map((text) => text.split("\n")[0].trim());
      await page
        .getByRole("menu")
        .last()
        .locator('[role^="menuitem"]')
        .filter({ hasText: new RegExp(`^${item}`) })
        .first()
        .click();
      const acted = await until(() => check(editor, word), 3_000);
      return {
        ok: acted && listed.includes(item),
        detail: `toolbar ${submenu} submenu lists: ${listed.join(", ")}; ${item} acted=${acted}`,
      };
    },
    m(
      "menuitem",
      `Aa > ${submenu}`,
      `toolbar Aa (Format) > ${submenu} > ${item}`,
      `the ${submenu} submenu opens from the toolbar with the menu bar's items and ${item} acts`,
      [["menuitem", submenu, /menu:(Aa|Format)$/]],
    ),
  );
}
row(
  "notes.toolbar.format.table-submenu",
  async ({ page, ctx }) => {
    const { editor, grid } = await inTable(page, ctx);
    await toolbar(await notesWindow(page))
      .getByRole("button", { name: "Format" })
      .click();
    await page
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: "Table", exact: true })
      .hover();
    await sleep(400);
    await page.getByRole("menu").last().getByRole("menuitem", { name: "Add Row Below" }).click();
    const grew = await until(async () => (await gridOf(editor)).rows === grid.rows + 1, 3_000);
    return { ok: grew, detail: `rows ${grid.rows} -> ${(await gridOf(editor)).rows}` };
  },
  m(
    "menuitem",
    "Aa > Table",
    "toolbar Aa (Format) > Table > Add Row Below with the insertion point in a table",
    "a row is added below",
    [["menuitem", "Table", /menu:(Aa|Format)$/]],
  ),
);

row(
  "notes.toolbar.media-photos",
  async ({ page }) => {
    const window = await notesWindow(page);
    const title = uniq("Photo");
    await newNote(page, title);
    await savedNote(page, title);
    await toolbar(window).getByRole("button", { name: "Media" }).click();
    await page.getByRole("menuitem", { name: "Photos…", exact: true }).click();
    const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
    await page.getByRole("button", { name: "From This Computer…", exact: true }).click();
    const PNG = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
      "base64",
    );
    await (await chooser).setFiles({ name: "r4-photo.png", mimeType: "image/png", buffer: PNG });
    const saved = await savedNote(
      page,
      title,
      (note) => Boolean(note.picture) || note.attachment === "photo",
    );
    const shown = await until(async () => (await window.locator("img").count()) > 0, 3_000);
    return {
      ok: Boolean(saved) && shown,
      detail: `saved with a picture=${Boolean(saved)} shown=${shown}`,
    };
  },
  m(
    "menuitem",
    "Media > Photos…",
    "click Media, choose Photos…, press From This Computer…, pick a PNG in the file chooser",
    "the photo is attached to the note and saved",
    [
      ["button", "Media", /toolbar:Notes toolbar/],
      ["menuitem", "Photos…", /menu:Media/],
    ],
    { persists: "server" },
  ),
);
row(
  "notes.toolbar.add-people",
  async ({ page }) => {
    const window = await notesWindow(page);
    await toolbar(window).getByRole("button", { name: "Add People" }).click();
    const popover = page.getByRole("dialog", { name: "Add People" }).last();
    const shown = await until(() => popover.isVisible(), 2_000);
    const why = shown ? (await popover.innerText()).replace(/\s+/g, " ").trim() : "";
    await page.keyboard.press("Escape");
    return shown && /Name an account on this desktop/.test(why)
      ? { ok: true, detail: why }
      : { ok: false, detail: `popover shown=${shown}: ${why}` };
  },
  m("button", "Add People", "click Add People", "the popover offers to share with an account", [
    ["button", "Add People", /toolbar:Notes toolbar/],
  ]),
);
row(
  "notes.toolbar.share",
  async ({ page, ctx }) => {
    const window = await notesWindow(page);
    await noteEditor(page, ctx);
    await toolbar(window).getByRole("button", { name: "Share" }).click();
    const menu = page.getByRole("menu").last();
    await menu.getByRole("menuitem").first().waitFor({ timeout: 3_000 });
    const rows = await menu
      .getByRole("menuitem")
      .evaluateAll((items) => items.map((each) => each.textContent.trim()));
    await page.keyboard.press("Escape");
    return {
      ok: ["Mail", "Messages"].every((name) => rows.some((row) => row.startsWith(name))),
      detail: rows.join(", "),
    };
  },
  m("button", "Share", "click Share with a note shown", "its menu offers Mail and Messages", [
    ["button", "Share", /toolbar:Notes toolbar/],
  ]),
);
row(
  "notes.toolbar.search",
  async ({ page }) => {
    const window = await notesWindow(page);
    await window
      .getByRole("tree", { name: "Folders" })
      .getByRole("treeitem")
      .filter({ hasText: /^Notes/ })
      .first()
      .click();
    const options = listOf(window).getByRole("option");
    const before = await options.count();
    const search = toolbar(window).getByRole("searchbox", { name: "Search" });
    await search.click();
    await page.keyboard.type("Yosemite");
    const filtered = await until(
      async () =>
        (await options.count()) === 1 && /Yosemite/.test(await options.first().innerText()),
      3_000,
    );
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    const back = await until(async () => (await options.count()) === before, 3_000);
    return {
      ok: filtered && back,
      detail: `${before} notes; filtered to Yosemite only=${filtered}; cleared=${back}`,
    };
  },
  m(
    "searchbox",
    "Search",
    "type Yosemite in the search field, then clear it",
    "only the matching note is listed, then all again",
    [["searchbox", "Search", /toolbar:Notes toolbar/]],
  ),
);

// ---- Folders, list and splitters -----------------------------------------------------------------------------------
row(
  "notes.folders.new-folder",
  async ({ page, ctx }) => {
    const window = await notesWindow(page);
    const before = (await notesData(page)).folders?.length ?? 0;
    await window.getByRole("button", { name: "New Folder", exact: true }).click();
    // A new folder starts with its name being typed: Return keeps it.
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    const tree = window.getByRole("tree", { name: "Folders" });
    const item = tree
      .getByRole("treeitem")
      .filter({ hasText: /^New Folder/ })
      .last();
    const shown = await until(
      async () => (await item.getAttribute("aria-selected")) === "true",
      3_000,
    );
    let folders = [];
    const saved = await until(
      async () => {
        folders = (await notesData(page)).folders ?? [];
        return folders.length === before + 1;
      },
      6_000,
      300,
    );
    ctx.data.newFolder = folders.at(-1)?.id;
    // Back to the Notes folder for the rows that follow.
    await tree
      .getByRole("treeitem")
      .filter({ hasText: /^Notes/ })
      .first()
      .click();
    return {
      ok: shown && saved,
      detail: `selected=${shown} folders ${before} -> ${folders.length} (${folders.map((each) => each.name).join(", ")})`,
    };
  },
  m(
    "button",
    "New Folder",
    "click New Folder",
    "a folder is added, selected and saved",
    [["button", "New Folder", /region:Notes/]],
    { persists: "server" },
  ),
);
row(
  "notes.folders.select-folder",
  async ({ page }) => {
    const window = await notesWindow(page);
    const tree = window.getByRole("tree", { name: "Folders" });
    const options = listOf(window).getByRole("option");
    await tree
      .getByRole("treeitem")
      .filter({ hasText: /^Notes/ })
      .first()
      .click();
    const inNotes = await options.count();
    const other = tree
      .getByRole("treeitem")
      .filter({ hasText: /^New Folder/ })
      .last();
    if ((await other.count()) === 0)
      return {
        ok: false,
        detail: "no second folder to select (run notes.folders.new-folder first)",
      };
    await other.click();
    const selected = await until(
      async () => (await other.getAttribute("aria-selected")) === "true",
      2_000,
    );
    const inOther = await options.count();
    await tree
      .getByRole("treeitem")
      .filter({ hasText: /^Notes/ })
      .first()
      .click();
    return {
      ok: selected && inOther < inNotes,
      detail: `Notes lists ${inNotes}, the new folder ${inOther}`,
    };
  },
  m(
    "treeitem",
    "Folders: a folder",
    "click a folder in the folder list",
    "the folder is selected and its notes are listed",
    [["treeitem", /^(Notes|New Folder)/, /tree:Folders/]],
  ),
);
row(
  "notes.list.select-note",
  async ({ page }) => {
    const window = await notesWindow(page);
    await window
      .getByRole("tree", { name: "Folders" })
      .getByRole("treeitem")
      .filter({ hasText: /^Notes/ })
      .first()
      .click();
    const option = listOf(window)
      .getByRole("option")
      .filter({ hasText: "This is a note in Yosemite" })
      .first();
    await option.click();
    const shown = await until(
      async () => (await editorOf(page).innerText()).includes("kinda nice in here"),
      3_000,
    );
    const selected = (await option.getAttribute("aria-selected")) === "true";
    return { ok: shown && selected, detail: `selected=${selected} editor shows it=${shown}` };
  },
  m(
    "option",
    "Notes list: a note",
    "click a note in the list",
    "the note is selected and shown in the editor",
    [["option", /./, /listbox:Notes/]],
  ),
);
for (const [id, name, region] of [
  [
    "folder-list",
    "Resize the folder list",
    (window) => window.getByRole("tree", { name: "Folders" }),
  ],
  ["note-list", "Resize the note list", (window) => listOf(window)],
]) {
  row(
    `notes.splitter.${id}`,
    async ({ page }) => {
      const window = await notesWindow(page);
      const splitter = window.getByRole("separator", { name });
      const box = await splitter.boundingBox();
      const before = (await region(window).boundingBox()).width;
      await drag(
        page,
        box.x + box.width / 2,
        box.y + box.height / 2,
        box.x + box.width / 2 + 50,
        box.y + box.height / 2,
      );
      const after = (await region(window).boundingBox()).width;
      const back = await splitter.boundingBox();
      await drag(
        page,
        back.x + back.width / 2,
        back.y + back.height / 2,
        back.x + back.width / 2 - 50,
        back.y + back.height / 2,
      );
      return { ok: after > before + 30, detail: `${before} -> ${after}` };
    },
    m(
      "separator",
      name,
      "drag the splitter 50px to the right, then back",
      "the pane widens with the drag",
      [["separator", name, /region:Notes/]],
    ),
  );
}

// ---- Format > Table ------------------------------------------------------------------------------------------------
const TABLE = [
  // Notes puts the insertion point in the row or column it adds.
  ["Add Row Above", (g, b) => g.rows === b.rows + 1 && g.caretRow === b.caretRow],
  ["Add Row Below", (g, b) => g.rows === b.rows + 1 && g.caretRow === b.caretRow + 1],
  ["Add Column Before", (g, b) => g.cols === b.cols + 1 && g.caretCol === b.caretCol],
  ["Add Column After", (g, b) => g.cols === b.cols + 1 && g.caretCol === b.caretCol + 1],
  ["Delete Row", (g, b) => g.rows === b.rows - 1],
  ["Delete Column", (g, b) => g.cols === b.cols - 1],
];
for (const [item, check] of TABLE) {
  for (const via of ["menu", "key"]) {
    if (via === "key" && /Delete/.test(item)) continue;
    row(
      `notes.menu.table.${item.toLowerCase().replace(/ /g, "-")}.${via}`,
      async ({ page, ctx }) => {
        const { editor, grid } = await inTable(page, ctx);
        if (via === "menu") await chooseMenu(page, "Format", "Table", item);
        else {
          const state = await menuState(page, "Format", "Table", item);
          if (!state?.shortcut) return { ok: false, detail: `${item} shows no key equivalent` };
          // Reading the menu left the keyboard on the menu bar: a click puts the insertion point back in the cell.
          await editor.locator("table.mac-notes-table").last().locator("td").first().click();
          await sleep(150);
          await page.keyboard.press(keyFor(state.shortcut));
        }
        let after = null;
        const ok = await until(async () => {
          after = await gridOf(editor);
          return check(after, grid);
        }, 3_000);
        return { ok, detail: `${JSON.stringify(grid)} -> ${JSON.stringify(after)}` };
      },
      m(
        via === "menu" ? "menuitem" : "shortcut",
        `Format > Table > ${item}`,
        via === "menu"
          ? `menu bar Format > Table > ${item}`
          : "its key equivalent, read from the menu",
        `the table ${item.toLowerCase()}`,
        via === "menu" ? [["menuitem", item, /Table$/]] : [],
      ),
    );
  }
}
row(
  "notes.menu.table.dimmed-outside-table",
  async ({ page, ctx }) => {
    const editor = await noteEditor(page, ctx);
    await line(page, editor, "Ot");
    const states = [];
    for (const [item] of TABLE)
      states.push([item, (await menuState(page, "Format", "Table", item))?.disabled]);
    return {
      ok: states.every(([, disabled]) => disabled === true),
      detail: states.map(([item, disabled]) => `${item}=${disabled ? "dimmed" : "on"}`).join(" "),
    };
  },
  m(
    "menuitem",
    "Format > Table (outside a table)",
    "open Format > Table with the insertion point outside any table",
    "every table command is dimmed",
  ),
);

// ---- Links, writing direction and the note's context menus -----------------------------------------------------------
row(
  "notes.edit.add-link",
  async ({ page }) => {
    const title = uniq("Linked");
    const editor = await newNote(page, title);
    await page.keyboard.press("Enter");
    const word = uniq("Link");
    await page.keyboard.type(`see ${word} here`);
    await doubleClickWord(page, editor, word);
    await page.keyboard.press(keyFor("Control+K"));
    const field = page.getByLabel("Address:");
    await field.fill("https://example.com/notes");
    await page.getByRole("button", { name: "OK", exact: true }).click();
    const saved = await savedNote(page, title, (note) =>
      /<a href="https:\/\/example\.com\/notes"/.test(note.html ?? ""),
    );
    await reload(page);
    const shown = await showNote(page, title);
    const back = (await shown.locator('a[href="https://example.com/notes"]').count()) === 1;
    return {
      ok: Boolean(saved) && back,
      detail: `saved with the link=${Boolean(saved)}; link after a reload=${back}`,
    };
  },
  m(
    "menuitem",
    "Add Link…",
    "select a word, Command-K, type an address, OK, reload",
    "the word is a link, saved and back after the reload",
    [["menuitem", "Add Link…", /menu:Edit/]],
    { persists: "server; reload" },
  ),
);
row(
  "notes.format.writing-direction",
  async ({ page }) => {
    const title = uniq("Direction");
    await newNote(page, title);
    await chooseMenu(page, "Format", "Text", "Writing Direction", "Right to Left");
    const saved = await savedNote(page, title, (note) => /dir="rtl"/.test(note.html ?? ""));
    const drawn = await editorOf(page).evaluate(
      (root) => getComputedStyle(root.querySelector('[dir="rtl"]') ?? root).direction,
    );
    return {
      ok: Boolean(saved) && drawn === "rtl",
      detail: `saved=${Boolean(saved)} drawn=${drawn}`,
    };
  },
  m(
    "menuitemradio",
    "Writing Direction > Right to Left",
    "choose Format > Text > Writing Direction > Right to Left",
    "the line reads right to left, saved",
    [["menuitemradio", "Right to Left", /menu:Writing Direction/]],
    { persists: "server" },
  ),
);
row(
  "notes.edit.smart-quotes",
  async ({ page }) => {
    const title = uniq("Quoted");
    await newNote(page, title);
    await page.keyboard.press("Enter");
    await page.keyboard.type('"said" it--done');
    const saved = await savedNote(page, title, (note) =>
      (note.lines ?? []).includes("“said” it—done"),
    );
    return { ok: Boolean(saved), detail: `lines=${JSON.stringify(saved?.lines ?? null)}` };
  },
  m(
    "menuitemcheckbox",
    "Smart Quotes",
    'type "said" it--done',
    "the quotes turn curly and the hyphens a dash",
    [
      ["menuitemcheckbox", "Smart Quotes", /menu:Substitutions/],
      ["menuitemcheckbox", "Smart Dashes", /menu:Substitutions/],
    ],
    { persists: "server" },
  ),
);
row(
  "notes.context.table",
  async ({ page }) => {
    const window = await notesWindow(page);
    const title = uniq("Grid");
    const editor = await newNote(page, title);
    await toolbar(window).getByRole("button", { name: "Add Table" }).click();
    await editor.locator("td").last().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add Row", exact: true }).click();
    const rows = await until(async () => (await editor.locator("tr").count()) === 3, 3_000);
    return { ok: rows, detail: `three rows=${rows}` };
  },
  m(
    "menuitem",
    "Table context menu",
    "secondary click in a cell, Add Row",
    "the table has one row more",
    [["menuitem", "Add Row", /menu:Text commands/]],
  ),
);
row(
  "notes.context.attachment",
  async ({ page }) => {
    const window = await notesWindow(page);
    const title = uniq("Attached");
    const editor = await newNote(page, title);
    await savedNote(page, title);
    await toolbar(window).getByRole("button", { name: "Media" }).click();
    const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
    await page.getByRole("menuitem", { name: "Other…", exact: true }).click();
    await (await chooser).setFiles({
      name: "r4-attached.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
        "base64",
      ),
    });
    const picture = editor.locator("[data-attachment] img");
    await picture.waitFor({ timeout: 5_000 });
    await picture.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Quick Look", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "r4-attached.png" });
    const looked = await until(() => panel.isVisible(), 3_000);
    const close = panel.getByRole("button").first();
    if (looked) await close.click();
    await picture.click({ button: "right" });
    await page.getByRole("menuitem", { name: "View as Small", exact: true }).click();
    const small = await until(
      () => page.locator('[data-attachment-view="small"]').first().isVisible(),
      3_000,
    );
    await chooseMenu(page, "View", "Attachment View", "Large");
    return { ok: looked && small, detail: `Quick Look=${looked} small=${small}` };
  },
  m(
    "menuitem",
    "Attachment context menu",
    "attach a PNG with Media > Other…, secondary click it, Quick Look, then View as Small",
    "the panel shows the picture, and the attachments draw small",
    [
      ["menuitem", "Other…", /menu:Media/],
      ["menuitem", "Quick Look", /menu:Text commands/],
      ["menuitem", "View as Small", /menu:Text commands/],
    ],
  ),
);

// ---- Persistence, isolation, live update and conflict ---------------------------------------------------------------
row(
  "notes.persist.reload",
  async ({ page, ctx }) => {
    const window = await notesWindow(page);
    const folderName = uniq("Keep");
    await window.getByRole("button", { name: "New Folder", exact: true }).click();
    await sleep(500);
    // The new folder is selected and named "New Folder": the note goes into it.
    const title = uniq("Kept");
    const editor = await newNote(page, title);
    await page.keyboard.press("Enter");
    const word = uniq("Bold");
    await page.keyboard.type(`plain ${word} plain`);
    await doubleClickWord(page, editor, word);
    await page.keyboard.press(keyFor("Control+B"));
    const saved = await savedNote(page, title, (note) =>
      new RegExp(`(<(b|strong)[^>]*>|font-weight: ?(bold|[6-9]00)[^>]*>)${word}`).test(
        note.html ?? "",
      ),
    );
    ctx.keep({ account: ctx.account, title, word, folder: saved?.folder ?? "", folderName });
    await reload(page);
    const again = await notesWindow(page);
    await again
      .getByRole("tree", { name: "Folders" })
      .getByRole("treeitem")
      .filter({ hasText: /^New Folder/ })
      .last()
      .click();
    const listed = await until(
      async () =>
        (await listOf(again).getByRole("option").filter({ hasText: title }).count()) === 1,
      4_000,
    );
    const shown = await showNote(page, title);
    const bold = (await styleOf(shown, word))?.bold === true;
    return {
      ok: Boolean(saved) && listed && bold,
      detail: `saved bold=${Boolean(saved)}; after reload listed in its folder=${listed} bold=${bold}`,
    };
  },
  m(
    "textbox",
    "Note (persistence)",
    "make a folder and a note with a bold word, reload the page",
    "the folder, the note and the bold word are back after the reload",
    [],
    { persists: "server; reload; restart" },
  ),
);
row(
  "notes.persist.restart",
  async ({ page, ctx }) => {
    const kept = ctx.kept();
    const data = await notesData(page);
    const note = data.notes.find((each) => (each.lines?.[0] ?? "").trim() === kept.title);
    const window = await notesWindow(page);
    await window
      .getByRole("tree", { name: "Folders" })
      .getByRole("treeitem")
      .filter({ hasText: /^New Folder/ })
      .last()
      .click();
    const listed = await until(
      async () =>
        (await listOf(window).getByRole("option").filter({ hasText: kept.title }).count()) === 1,
      4_000,
    );
    const editor = await showNote(page, kept.title);
    const bold = (await styleOf(editor, kept.word))?.bold === true;
    return {
      ok: Boolean(note) && note.folder === kept.folder && listed && bold,
      detail: `after the restart: on the server=${Boolean(note)} folder kept=${note?.folder === kept.folder} listed=${listed} bold=${bold}`,
    };
  },
  {
    phases: ["restart-check"],
    meta: {
      state: S,
      role: "textbox",
      name: "Note (restart)",
      how: "sign in again after a real restart of the server",
      expect: "the folder, the note and its bold word are kept",
      persists: "restart",
      covers: [],
    },
  },
);
row(
  "notes.isolation.second-account",
  async ({ page, ctx }) => {
    const kept = ctx.kept();
    const other = await ctx.browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const two = await other.newPage();
      acceptUnload(two);
      await two.goto(`${opts.base}/`, { waitUntil: "load" });
      await createAccount(two, newIdentity("notesb", opts.browserName));
      const window = await openFromDock(two, "Notes", "Notes");
      const theirs = (await api(two, "GET", "/api/notes/data")).json?.data?.notes ?? [];
      const leaked = theirs.some((note) => (note.lines?.[0] ?? "").trim() === kept.title);
      const shown = (await window.getByText(kept.title).count()) > 0;
      // The second account's own note stays out of the first account's notes.
      const mine = uniq("Bnote");
      await window
        .getByRole("toolbar", { name: "Notes toolbar" })
        .getByRole("button", { name: "New Note" })
        .click();
      await two.locator('[role="textbox"][aria-label="Note"]:visible').first().click();
      await two.keyboard.type(mine);
      const saved = await until(
        async () =>
          ((await api(two, "GET", "/api/notes/data")).json?.data?.notes ?? []).some(
            (note) => (note.lines?.[0] ?? "").trim() === mine,
          ),
        8_000,
        300,
      );
      if (!saved)
        return {
          ok: false,
          detail: `the second account's note ${mine} was never saved, so the reverse check proves nothing`,
        };
      const back = (await notesData(page)).notes.some(
        (note) => (note.lines?.[0] ?? "").trim() === mine,
      );
      return {
        ok: !leaked && !shown && !back,
        detail: `second account sees the first's note: api=${leaked} screen=${shown}; its own note saved=${saved}; first sees the second's: ${back}`,
      };
    } finally {
      await other.close();
    }
  },
  m(
    "region",
    "Notes (another account)",
    "sign up a second account in another browser context and open Notes",
    "neither account sees the other's notes",
    [],
    { persists: "per account" },
  ),
);
row(
  "notes.live.second-window",
  async ({ page, ctx }) => {
    const kept = ctx.kept();
    const two = await ctx.context.newPage();
    acceptUnload(two);
    try {
      await two.goto(`${opts.base}/`, { waitUntil: "load" });
      await two
        .getByRole("button", { name: /^Finder$/ })
        .first()
        .waitFor({ timeout: 30_000 });
      const window = await openFromDock(two, "Notes", "Notes");
      await window
        .getByRole("tree", { name: "Folders" })
        .getByRole("treeitem")
        .filter({ hasText: /^New Folder/ })
        .last()
        .click();
      await window
        .getByRole("listbox", { name: "Notes" })
        .getByRole("option")
        .filter({ hasText: kept.title })
        .first()
        .click();
      const theirs = two.locator('[role="textbox"][aria-label="Note"]:visible').first();
      // Type in this window; the other shows it without a reload.
      const editor = await showNote(page, kept.title);
      const word = await line(page, editor, "Live");
      const arrived = await until(
        async () => (await theirs.innerText()).includes(word),
        12_000,
        300,
      );
      return {
        ok: arrived,
        detail: arrived ? "the other window showed the edit" : "the other window did not update",
      };
    } finally {
      await two.close();
    }
  },
  m(
    "textbox",
    "Note (between windows)",
    "type in one window with the same note open in a second",
    "the second window shows the edit live",
    [],
    { persists: "live" },
  ),
);
row(
  "notes.conflict.notice",
  async ({ page, ctx }) => {
    ctx.watch.allow(/HTTP 409: .*\/api\/notes\/data/);
    ctx.watch.allow(/status of 409/);
    const title = uniq("Clash");
    await newNote(page, title);
    // A line both windows will change at once, as two people would.
    const phrase = uniq("Line");
    await page.keyboard.press("Enter");
    await page.keyboard.type(phrase);
    await savedNote(page, title, (note) => (note.lines ?? []).join(" ").includes(phrase));
    const two = await ctx.context.newPage();
    acceptUnload(two);
    let release = () => {};
    try {
      await two.goto(`${opts.base}/`, { waitUntil: "load" });
      await two
        .getByRole("button", { name: /^Finder$/ })
        .first()
        .waitFor({ timeout: 30_000 });
      const window = await openFromDock(two, "Notes", "Notes");
      // The note may sit in another folder than the one this window shows: its search field finds it.
      await window.getByRole("searchbox", { name: "Search" }).click();
      await two.keyboard.type(title);
      await window
        .getByRole("listbox", { name: "Notes" })
        .getByRole("option")
        .filter({ hasText: title })
        .first()
        .click();
      const theirs = two.locator('[role="textbox"][aria-label="Note"]:visible').first();
      await until(async () => (await theirs.innerText()).includes(phrase), 4_000);
      // This window's next save is held while the other window saves first.
      const held = new Promise((resolve) => {
        release = resolve;
      });
      // Only this window's next save is held, matched by its path, as editors-conflict-journey does (a glob does not
      // match a save whose URL carries a query string).
      let holding = true;
      await page.route(
        (url) => url.pathname === "/api/notes/data",
        async (route) => {
          if (holding && route.request().method() === "PUT") {
            holding = false;
            await held;
          }
          await route.continue();
        },
      );
      const editor = await showNote(page, title);
      await clickAfter(page, editor, phrase);
      const mine = uniq("Mine");
      await page.keyboard.type(` ${mine}`);
      await sleep(800);
      await clickAfter(two, theirs, phrase);
      const theirsWord = uniq("Theirs");
      await two.keyboard.type(` ${theirsWord}`);
      await until(
        async () =>
          (
            (await notesData(page)).notes.find((note) => (note.lines?.[0] ?? "").trim() === title)
              ?.lines ?? []
          )
            .join(" ")
            .includes(theirsWord),
        6_000,
        300,
      );
      release();
      const notice = page
        .getByRole("note")
        .filter({ hasText: "was changed in another window" })
        .first();
      const shown = await until(() => notice.isVisible(), 10_000);
      const showMine = await notice
        .getByRole("button", { name: "Show My Version" })
        .isVisible()
        .catch(() => false);
      const keep = notice.getByRole("button", { name: "Keep My Version" });
      const keepShown = await keep.isVisible().catch(() => false);
      if (keepShown) await keep.click();
      const kept = await until(
        async () =>
          (
            (await notesData(page)).notes.find((note) => (note.lines?.[0] ?? "").trim() === title)
              ?.lines ?? []
          )
            .join(" ")
            .includes(mine),
        8_000,
        300,
      );
      const dismissed = await until(async () => !(await notice.isVisible()), 4_000);
      return {
        ok: shown && showMine && keepShown && kept && dismissed,
        detail: `notice=${shown} Show My Version=${showMine} Keep My Version=${keepShown} mine kept=${kept} notice dismissed=${dismissed}`,
      };
    } finally {
      release();
      await page.unroute("**/api/notes/data").catch(() => {});
      await two.close();
    }
  },
  m(
    "note",
    "Conflict notice",
    "edit the same note in two windows while one save is held, then Keep My Version",
    "the notice names the conflict and Keep My Version puts this window's text back",
    [
      ["button", "Show My Version", /note/],
      ["button", "Keep My Version", /note/],
    ],
    { persists: "server" },
  ),
);

// ---- App menu, window menu and window chrome ------------------------------------------------------------------------
appRows(row, {
  P: "notes",
  app: "Notes",
  state: S,
  open: notesWindow,
  gone: async (page) =>
    !(await win(page)
      .isVisible()
      .catch(() => false)),
  closeTitle: "Notes",
  windowItem: "Notes",
  fullScreen: true,
  windowMenu: true,
  help: true,
});

await run({
  beforeEach: async ({ page }) => {
    await tidy(page);
  },
});
