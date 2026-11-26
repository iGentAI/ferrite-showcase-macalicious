#!/usr/bin/env node

// Stickies census journey (R4): one `ok`/`FAIL` line per census id of Stickies, with real input, in chromium, chrome,
// firefox or webkit. Shared editing rows (Edit, Font, Font > Text, the Fonts and Colors panels) from r4-editor-rows.mjs,
// app menu rows from r4-app-rows.mjs; here the note's own controls, the Color menu, persistence across a reload and a
// real server restart (`--phase restart-check`), per-account isolation, live update and the conflict notice.
//
//   node e2e/stickies-census-journey.mjs --browser chromium|chrome|firefox|webkit [--phase write|restart-check]

import { appRows, menuReason, otherAccount, samePage } from "./r4-app-rows.mjs";
import {
  api,
  census,
  chooseMenu,
  clickAfter,
  drag,
  frameOf,
  menuState,
  openFromDock,
  reload,
  sleep,
  until,
} from "./r4-census-kit.mjs";
import { editorRows, tidy, uniq } from "./r4-editor-rows.mjs";

const { row, run, keep, kept } = census("stickies");
const S = "Stickies note";
const m = (role, name, how, expect, covers = [], extra = {}) => ({
  meta: { state: S, role, name, how, expect, persists: "none", covers, ...extra },
});

const noteOf = (page) => page.locator(".mac-stickies-note").first();
const textOf = (page) => noteOf(page).getByRole("textbox", { name: "Note" });
const data = async (page) =>
  (await api(page, "GET", "/api/stickies/data")).json?.data ?? { notes: [] };
const savedHolds = async (page, word) =>
  (await data(page)).notes.some((note) => `${note.text ?? ""}${note.html ?? ""}`.includes(word));

/** The first sticky note, Stickies opened from the Dock when no note shows. */
async function stickies(page) {
  const note = noteOf(page);
  if (await note.isVisible().catch(() => false)) return note;
  return openFromDock(page, "Stickies", { selector: ".mac-stickies-note" });
}

/**
 * The note's Fonts and Colors panels open fixed at the page's top right (about 800 px wide together), over a note that
 * stands there: the note is dragged by its title bar (a real press on its middle) to the page's left when its right edge
 * reaches where they open.
 */
async function clearOfPanels(page, note) {
  const frame = await frameOf(note);
  const { width } = page.viewportSize();
  if (frame.x + frame.width <= width - 840 || frame.x <= 40) return;
  const y = frame.y + 6;
  await drag(page, frame.x + frame.width / 2, y, 24 + frame.width / 2, y);
  await sleep(250);
}

/** Type ` word` at the end of the first note; resolves with the word. */
async function append(page, stem) {
  await stickies(page);
  const word = uniq(stem);
  await textOf(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(` ${word}`);
  return word;
}

/**
 * Zoom fits a note to its text, so a note whose text already fits does not change size: types lines into the note, unless
 * earlier rows have already, until the text needs at least 40 px more than the note shows.
 */
async function overflowing(page, note) {
  const spare = () =>
    note
      .locator(".mac-stickies-note-text")
      .evaluate((field) => field.scrollHeight - field.clientHeight);
  for (let line = 0; line < 60 && (await spare()) < 40; line += 1) {
    if (line === 0) {
      await textOf(page).click();
      await page.keyboard.press("Control+End");
    }
    await page.keyboard.press("Enter");
    await page.keyboard.type("line");
  }
}

editorRows(row, {
  P: "stickies",
  state: S,
  editor: async (page) => {
    await clearOfPanels(page, await stickies(page));
    return textOf(page);
  },
  font: ["Font"],
  text: ["Font", "Text"],
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

// ---- Color menu ---------------------------------------------------------------------------------------------------
const COLORS = ["Yellow", "Blue", "Green", "Pink", "Purple", "Gray"];
for (const color of COLORS) {
  row(
    `stickies.color.${color.toLowerCase()}`,
    async ({ page }) => {
      const note = await stickies(page);
      // From another colour first, so the command visibly changes the note.
      await chooseMenu(page, "Color", color === "Blue" ? "Green" : "Blue");
      const before = await note.evaluate((element) => getComputedStyle(element).backgroundColor);
      await chooseMenu(page, "Color", color);
      let after = before;
      const changed = await until(async () => {
        after = await note.evaluate((element) => getComputedStyle(element).backgroundColor);
        return after !== before;
      }, 3_000);
      const state = await menuState(page, "Color", color);
      return {
        ok: changed && state?.checked === "true",
        detail: `${before} -> ${after}; ${color} checked=${state?.checked}`,
      };
    },
    m(
      "menuitemradio",
      color,
      `menu bar Color > ${color}`,
      `the note turns ${color.toLowerCase()} and the item is checked`,
      [
        ["menuitemradio", color, /Color$/],
        ["menuitem", color, /Color$/],
      ],
    ),
  );
}
row(
  "stickies.color.persists",
  async ({ page }) => {
    const note = await stickies(page);
    await chooseMenu(page, "Color", "Purple");
    const want = await note.evaluate((element) => getComputedStyle(element).backgroundColor);
    await sleep(1_500);
    await reload(page);
    const again = await stickies(page);
    const after = await again.evaluate((element) => getComputedStyle(element).backgroundColor);
    return { ok: after === want, detail: `${want} before the reload, ${after} after` };
  },
  m(
    "menuitemradio",
    "Color (kept)",
    "menu bar Color > Purple, then reload the page",
    "the note is still purple",
    [],
    { persists: "reload" },
  ),
);

// ---- The note's own controls ---------------------------------------------------------------------------------------
row(
  "stickies.note.collapse",
  async ({ page }) => {
    const note = await stickies(page);
    // The note itself folds; the window frame around it may keep its size.
    const before = await note.boundingBox();
    await note.getByRole("button", { name: "Collapse" }).click();
    let after = before;
    const collapsed = await until(async () => {
      after = await note.boundingBox();
      return after.height < before.height - 20;
    }, 3_000);
    await note
      .getByRole("button", { name: /Collapse|Expand/ })
      .first()
      .click();
    const back = await until(
      async () => Math.abs((await note.boundingBox()).height - before.height) <= 4,
      3_000,
    );
    return { ok: collapsed && back, detail: `${before.height} -> ${after.height} -> back=${back}` };
  },
  m(
    "button",
    "Collapse",
    "click the note's collapse box, twice",
    "the note folds to its title bar, then opens again",
    [["button", "Collapse", /group:/]],
  ),
);
row(
  "stickies.note.zoom",
  async ({ page }) => {
    const note = await stickies(page);
    await overflowing(page, note);
    const before = await frameOf(note);
    await note.getByRole("button", { name: "Zoom" }).click();
    let after = before;
    const grew = await until(async () => {
      after = await frameOf(note);
      return after.width > before.width + 20 || after.height > before.height + 20;
    }, 3_000);
    await note.getByRole("button", { name: "Zoom" }).click();
    const back = await until(
      async () => Math.abs((await frameOf(note)).height - before.height) <= 4,
      3_000,
    );
    return {
      ok: grew && back,
      detail: `${before.width}x${before.height} -> ${after.width}x${after.height} -> back=${back}`,
    };
  },
  m(
    "button",
    "Zoom",
    "click the note's zoom box, twice",
    "the note grows to fit its text, then returns",
    [["button", "Zoom", /group:/]],
  ),
);
row(
  "stickies.note.move",
  async ({ page }) => {
    const note = await stickies(page);
    const before = await frameOf(note);
    const x = before.x + before.width / 2;
    const y = before.y + 6;
    await drag(page, x, y, x - 50, y + 40);
    const after = await frameOf(note);
    await drag(page, x - 50, y + 40, x, y);
    return {
      ok: Math.abs(after.x - (before.x - 50)) <= 6 && Math.abs(after.y - (before.y + 40)) <= 6,
      detail: `${before.x},${before.y} -> ${after.x},${after.y}`,
    };
  },
  m("drag", "Note title bar", "drag the note by its title bar", "the note moves with the pointer"),
);
row(
  "stickies.note.resize",
  async ({ page }) => {
    const note = await stickies(page);
    const before = await frameOf(note);
    await drag(
      page,
      before.x + before.width - 3,
      before.y + before.height - 3,
      before.x + before.width + 47,
      before.y + before.height + 37,
    );
    const after = await frameOf(note);
    return {
      ok: after.width > before.width + 30 && after.height > before.height + 20,
      detail: `${before.width}x${before.height} -> ${after.width}x${after.height}`,
    };
  },
  m("drag", "Note resize corner", "drag the note's bottom-right corner", "the note grows"),
);

// ---- Persistence, isolation, live update, conflict -----------------------------------------------------------------
row(
  "stickies.persist.reload",
  async ({ page, ctx }) => {
    const word = await append(page, "Pr");
    const saved = await until(() => savedHolds(page, word), 8_000, 300);
    await reload(page);
    await stickies(page);
    const shown = await until(async () => (await textOf(page).innerText()).includes(word), 5_000);
    keep({ account: ctx.account, word });
    return { ok: saved && shown, detail: `saved=${saved} shown after reload=${shown}` };
  },
  m(
    "textbox",
    "Note",
    "type in the note, reload the page",
    "the text is saved (GET /api/stickies/data) and shown again",
    [["textbox", "Note", /group:/]],
    { persists: "reload+restart" },
  ),
);
row(
  "stickies.persist.restart",
  async ({ page }) => {
    const { word } = kept();
    await stickies(page);
    const shown = await until(async () => (await textOf(page).innerText()).includes(word), 8_000);
    const saved = await savedHolds(page, word);
    return {
      ok: shown && saved,
      detail: `after a real server restart: shown=${shown} saved=${saved} (${word})`,
    };
  },
  {
    phases: ["restart-check"],
    ...m(
      "textbox",
      "Note (after restart)",
      "sign in again after the server restarted",
      "the note's text is still there",
      [],
      { persists: "restart" },
    ),
  },
);
row(
  "stickies.isolation.second-account",
  async ({ page, ctx }) => {
    const mine = await append(page, "Is");
    await until(() => savedHolds(page, mine), 8_000, 300);
    const other = await otherAccount(ctx, "stiso");
    try {
      await stickies(other.page);
      const leaked = await savedHolds(other.page, mine);
      const shown = (await textOf(other.page).innerText()).includes(mine);
      const theirs = await append(other.page, "Ot");
      const saved = await until(() => savedHolds(other.page, theirs), 8_000, 300);
      if (!saved)
        return {
          ok: false,
          detail: "the second account's note was never saved, so the reverse check proves nothing",
        };
      const back = await savedHolds(page, theirs);
      return {
        ok: !leaked && !shown && !back,
        detail: `second sees first's: api=${leaked} screen=${shown}; second's saved=${saved}; first sees second's=${back}`,
      };
    } finally {
      await other.close();
    }
  },
  m(
    "textbox",
    "Note (another account)",
    "a second account signs up in another browser context",
    "neither account sees the other's notes",
  ),
);
row(
  "stickies.live.second-window",
  async ({ page, ctx }) => {
    const two = await samePage(ctx);
    try {
      await stickies(two);
      const word = await append(page, "Lv");
      const seen = await until(
        async () => (await textOf(two).innerText()).includes(word),
        12_000,
        300,
      );
      return {
        ok: seen,
        detail: seen ? "the other window shows the change" : "the other window did not update",
      };
    } finally {
      await two.close();
    }
  },
  m(
    "textbox",
    "Note (another window)",
    "type in one window with the same note open in another",
    "the other window shows the text without a reload",
  ),
);
row(
  "stickies.conflict.keep-mine",
  async ({ page, ctx }) => {
    ctx.watch.allow(/409/);
    const two = await samePage(ctx);
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    // Only this window's next save is held, matched by its path, as editors-conflict-journey does (a glob does not
    // match a save whose URL carries a query string).
    const stickiesData = (url) => url.pathname === "/api/stickies/data";
    let holding = true;
    const hold = async (route) => {
      if (holding && route.request().method() === "PUT") {
        holding = false;
        await held;
      }
      await route.continue().catch(() => {});
    };
    try {
      // A line both windows will change at once, saved and shown in the second window first.
      const phrase = uniq("Clash");
      await stickies(page);
      await textOf(page).click();
      await page.keyboard.press("Control+End");
      await page.keyboard.press("Enter");
      await page.keyboard.type(phrase);
      await until(() => savedHolds(page, phrase), 8_000, 300);
      await stickies(two);
      const theirsNote = two.locator(".mac-stickies-note").filter({ hasText: phrase }).first();
      if (!(await until(() => theirsNote.isVisible(), 8_000))) {
        await reload(two);
        await stickies(two);
      }
      await page.route(stickiesData, hold);
      const myNote = page.locator(".mac-stickies-note").filter({ hasText: phrase }).first();
      await clickAfter(page, myNote.getByRole("textbox", { name: "Note" }), phrase);
      const mine = uniq("Cm");
      await page.keyboard.type(` ${mine}`);
      await sleep(1_000);
      // Its last line, which a long note may have scrolled out of sight.
      await theirsNote.getByRole("textbox", { name: "Note" }).click();
      await two.keyboard.press("Control+End");
      const theirs = uniq("Ct");
      await two.keyboard.type(` ${theirs}`);
      await until(() => savedHolds(two, theirs), 8_000, 300);
      release();
      const notice = page
        .getByRole("note")
        .filter({ hasText: "Changed in another window." })
        .first();
      const shown = await until(() => notice.isVisible(), 10_000);
      if (!shown) return { ok: false, detail: "no conflict notice" };
      await notice.getByRole("button", { name: "Keep Mine" }).click();
      const kept = await until(() => savedHolds(page, mine), 8_000, 300);
      return { ok: kept, detail: `notice shown; Keep Mine saved my text=${kept}` };
    } finally {
      release();
      await page.unroute(stickiesData, hold).catch(() => {});
      await two.close();
    }
  },
  m(
    "button",
    "Keep Mine",
    "edit the same note in two windows at once",
    "the window whose save was refused shows the notice; Keep Mine saves its text",
    [["button", "Keep Mine", /note/]],
  ),
);

appRows(row, {
  P: "stickies",
  app: "Stickies",
  state: S,
  open: stickies,
  gone: async (page) =>
    !(await noteOf(page)
      .isVisible()
      .catch(() => false)),
  windowItem: null,
  fullScreen: false,
  windowMenu: true,
  help: true,
  chrome: false,
  skip: [
    "stickies.menu.window-zoom",
    "stickies.menu.close-window.key",
    "stickies.menu.window-minimize.key",
  ],
});
row(
  "stickies.menu.close-window.key",
  async ({ page }) => {
    const note = await stickies(page);
    await textOf(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(uniq("Cw"));
    await page.keyboard.press("Control+W");
    const alert = page.getByRole("alertdialog");
    const asked = await until(() => alert.isVisible(), 3_000);
    if (asked) await alert.getByRole("button", { name: "Cancel" }).click();
    const kept = await until(() => note.isVisible(), 3_000);
    return { ok: asked && kept, detail: `asked=${asked}; Cancel keeps the note=${kept}` };
  },
  m(
    "shortcut",
    "File > Close",
    "keyboard Control+W on a note with text, then Cancel",
    "Stickies asks before it removes the note; Cancel keeps it",
    [],
  ),
);
row(
  "stickies.menu.window-minimize.key",
  async ({ page }) => {
    const note = await stickies(page);
    await textOf(page).click();
    const before = await note.boundingBox();
    await page.keyboard.press("Control+M");
    const collapsed = await until(
      async () => (await note.boundingBox()).height < before.height - 20,
      3_000,
    );
    await page.keyboard.press("Control+M");
    const back = await until(
      async () => (await note.boundingBox()).height >= before.height - 2,
      3_000,
    );
    return { ok: collapsed && back, detail: `collapsed=${collapsed} expanded again=${back}` };
  },
  m(
    "shortcut",
    "Window > Collapse",
    "keyboard Control+M, twice",
    "Stickies keeps this key for Collapse: the note folds, and the key unfolds it",
    [],
  ),
);
row(
  "stickies.menu.window-zoom",
  async ({ page }) => {
    const note = await stickies(page);
    await overflowing(page, note);
    const zoomItem = await menuReason(page, "Window", "Zoom");
    if (zoomItem?.disabled)
      return zoomItem.reason
        ? { unavailable: zoomItem.reason }
        : { ok: false, detail: "Window > Zoom is dimmed without a reason" };
    const before = await frameOf(note);
    await chooseMenu(page, "Window", "Zoom");
    let after = before;
    const grew = await until(async () => {
      after = await frameOf(note);
      return after.width !== before.width || after.height !== before.height;
    }, 3_000);
    await chooseMenu(page, "Window", "Zoom");
    return {
      ok: grew,
      detail: `${before.width}x${before.height} -> ${after.width}x${after.height}`,
    };
  },
  m("menuitem", "Window > Zoom", "menu bar Window > Zoom", "the note zooms", [
    ["menuitem", "Zoom", /Window$/],
  ]),
);
row(
  "stickies.note.close",
  async ({ page }) => {
    const note = await stickies(page);
    const count = await page.locator(".mac-stickies-note").count();
    await note.getByRole("button", { name: "Close" }).click();
    const alert = page.getByRole("alertdialog");
    await until(() => alert.isVisible(), 1_000);
    if (await alert.isVisible()) await alert.getByRole("button", { name: "Remove Note" }).click();
    const fewer = await until(
      async () => (await page.locator(".mac-stickies-note").count()) < count,
      4_000,
    );
    return {
      ok: fewer,
      detail: `${count} notes -> ${await page.locator(".mac-stickies-note").count()}`,
    };
  },
  m("button", "Close", "click the note's close box", "the note closes", [
    ["button", "Close", /group:/],
  ]),
);

await run({
  beforeEach: async ({ page }) => {
    await tidy(page);
  },
});
