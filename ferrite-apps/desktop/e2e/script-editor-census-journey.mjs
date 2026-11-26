#!/usr/bin/env node

// Script Editor census journey (R4): one `ok`/`FAIL` line per census id of Script Editor, with real input, in
// chromium, chrome, firefox or webkit: the editor (shared editing rows from r4-editor-rows.mjs, the top-level Font
// menu too), Run, Compile, Record and Stop, the pop-ups, the accessory and bundle views, Open and Save Script, the
// bounded JavaScript (network refused, runaway loop stopped, the Notes and Desktop bindings, console.log), saved
// scripts across a reload and a real server restart, and per-account isolation.
//
//   node e2e/script-editor-census-journey.mjs --browser chromium|chrome|firefox|webkit [--phase write|restart-check]

import { appRows, choosePopup, fieldValue, otherAccount, popupOptions } from "./r4-app-rows.mjs";
import {
  api,
  census,
  chooseMenu,
  dontSave,
  doubleClickWord,
  drag,
  installApps,
  menuState,
  openFromDock,
  openMenu,
  reload,
  styleOf,
  until,
} from "./r4-census-kit.mjs";
import { editorRows, line, panelOf, slug, tidy, uniq } from "./r4-editor-rows.mjs";
import { uploadFile } from "./system-kit.mjs";

const { row, run, keep, kept } = census("script-editor");
const S = "Script Editor window";
const m = (role, name, how, expect, covers = [], extra = {}) => ({
  meta: { state: S, role, name, how, expect, persists: "none", covers, ...extra },
});
const SELECTOR = '[data-window-id="script-editor"]';
// A window sent to the Dock stays laid out (data-minimized, inert), which `isVisible` counts as shown.
const win = (page) => page.locator(`${SELECTOR}:not([data-minimized]):not([inert])`).first();
const scriptBox = (page) => win(page).getByRole("textbox", { name: "Script", exact: true });
const resultBox = (page) => win(page).getByRole("textbox", { name: "Result" });

async function editorWindow(page) {
  if (
    await win(page)
      .isVisible()
      .catch(() => false)
  )
    return win(page);
  return openFromDock(page, "Script Editor", { selector: SELECTOR });
}

/** Replace the script with `code` (typed), press Run; resolves with the Result pane's text once it changes. */
/** The Language pop-up set to JavaScript (a row before may have chosen another language). */
/** Chooses the first language in the Language pop-up whose name matches `wanted`, unless it is chosen already. */
async function ensureLanguage(page, wanted) {
  const language = win(page).getByRole("combobox", { name: "Language" });
  if (wanted.test(await language.innerText().catch(() => ""))) return;
  const names = await popupOptions(page, language);
  const pick = names.find((name) => wanted.test(name));
  if (pick) await choosePopup(page, language, pick);
}

async function ensureJavaScript(page) {
  const language = win(page).getByRole("combobox", { name: "Language" });
  if (/JavaScript/.test(await language.innerText().catch(() => ""))) return;
  const names = await popupOptions(page, language);
  const js = names.find((name) => /JavaScript/.test(name));
  if (js) await choosePopup(page, language, js);
}

async function runScript(page, code, ms = 15_000) {
  await editorWindow(page);
  await ensureJavaScript(page);
  const box = scriptBox(page);
  await box.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type(code);
  await win(page)
    .getByRole("button", { name: "Result", exact: true })
    .click()
    .catch(() => {});
  const before = await fieldValue(resultBox(page)).catch(() => "");
  const answered = page
    .waitForResponse((response) => new URL(response.url()).pathname === "/api/script-editor/run", {
      timeout: ms,
    })
    .catch(() => null);
  await win(page).getByRole("button", { name: "Run", exact: true }).click();
  const response = await answered;
  let text = before;
  await until(async () => {
    text = await fieldValue(resultBox(page)).catch(() => "");
    return text !== before;
  }, 4_000);
  return {
    text,
    status: response?.status(),
    body: response ? await response.json().catch(() => null) : null,
  };
}

editorRows(row, {
  P: "script-editor",
  state: S,
  editor: async (page) => {
    await editorWindow(page);
    return scriptBox(page);
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

// The top-level Font menu: the same commands as Format > Font.
for (const [item, check] of [
  ["Bold", (s) => s.bold],
  ["Italic", (s) => s.italic],
  ["Underline", (s) => s.underline],
]) {
  row(
    `script-editor.font-menu.${slug(item)}`,
    async ({ page }) => {
      await editorWindow(page);
      const word = await line(page, scriptBox(page), "Tf");
      await doubleClickWord(page, scriptBox(page), word);
      await chooseMenu(page, "Font", item);
      const ok = await until(async () => check(await styleOf(scriptBox(page), word)), 3_000);
      return { ok, detail: ok ? `${item} applied` : `${item} not applied` };
    },
    m(
      "menuitemcheckbox",
      `Font > ${item}`,
      `menu bar Font > ${item}`,
      `the selected word becomes ${item.toLowerCase()}`,
      [
        ["menuitemcheckbox", item, /> Font$/],
        ["menuitem", item, /> Font$/],
      ],
    ),
  );
}
for (const [item, grows] of [
  ["Bigger", true],
  ["Smaller", false],
]) {
  row(
    `script-editor.font-menu.${slug(item)}`,
    async ({ page }) => {
      await editorWindow(page);
      const word = await line(page, scriptBox(page), "Tz");
      await doubleClickWord(page, scriptBox(page), word);
      const before = (await styleOf(scriptBox(page), word)).size;
      await chooseMenu(page, "Font", item);
      const ok = await until(async () => {
        const after = (await styleOf(scriptBox(page), word)).size;
        return grows ? after > before : after < before;
      }, 3_000);
      return { ok, detail: `${before}px -> ${(await styleOf(scriptBox(page), word)).size}px` };
    },
    m(
      "menuitem",
      `Font > ${item}`,
      `menu bar Font > ${item}`,
      `the selected word gets ${grows ? "bigger" : "smaller"}`,
      [["menuitem", item, /> Font$/]],
    ),
  );
}
for (const [item, name] of [
  ["Show Fonts", "Fonts"],
  ["Show Colors", "Colors"],
]) {
  row(
    `script-editor.font-menu.${slug(item)}`,
    async ({ page }) => {
      await editorWindow(page);
      await scriptBox(page).click();
      const panel = panelOf(page, name);
      await chooseMenu(page, "Font", item);
      const shown = await until(() => panel.isVisible(), 3_000);
      if (shown)
        await panel
          .getByRole("group", { name: "Window controls" })
          .getByRole("button", { name: "Close" })
          .click();
      return { ok: shown, detail: `${name} panel shown=${shown}` };
    },
    m("menuitem", `Font > ${item}`, `menu bar Font > ${item}`, `the ${name} panel opens`, [
      ["menuitem", item, /> Font$/],
    ]),
  );
}

// ---- Run, Compile, Record, Stop ---------------------------------------------------------------------------------
row(
  "script-editor.run",
  async ({ page }) => {
    const { text, body } = await runScript(page, "return 6 * 7");
    return {
      ok: /42/.test(text) && body?.outcome === "completed",
      detail: `result ${text.slice(0, 60)}; outcome ${body?.outcome}`,
    };
  },
  m("button", "Run", "type return 6 * 7, click Run", "the Result pane shows 42", [
    ["button", "Run", /toolbar/],
  ]),
);
row(
  "script-editor.compile",
  async ({ page }) => {
    await editorWindow(page);
    // Compile checks AppleScript (blocks, strings); a JavaScript script is compiled unchecked and its errors show when
    // it runs, so the row compiles an AppleScript with an unterminated string.
    await ensureLanguage(page, /AppleScript/);
    await scriptBox(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type('display dialog "unterminated');
    const before = await win(page).innerText();
    await win(page).getByRole("button", { name: "Compile", exact: true }).click();
    let after = before;
    const told = await until(async () => {
      after = `${await win(page).innerText()} ${await fieldValue(resultBox(page)).catch(() => "")} ${await fieldValue(win(page).getByRole("textbox", { name: "Log" })).catch(() => "")} ${await page
        .getByRole("alertdialog")
        .or(page.getByRole("dialog"))
        .allInnerTexts()
        .then((all) => all.join(" "))}`;
      return /error|unexpected|expected/i.test(after) && after !== before;
    }, 5_000);
    for (let index = 0; index < 2; index += 1) await page.keyboard.press("Escape");
    const dialog = page.getByRole("alertdialog").first();
    if (await dialog.isVisible().catch(() => false))
      await dialog.getByRole("button").first().click();
    await ensureJavaScript(page);
    return {
      ok: told,
      detail: told ? "a syntax error is reported" : `no error shown: ${after.slice(0, 120)}`,
    };
  },
  m(
    "button",
    "Compile",
    "type a script with a syntax error, click Compile",
    "the syntax error is reported",
    [["button", "Compile", /toolbar/]],
  ),
);
row(
  "script-editor.record-stop",
  async ({ page }) => {
    const window = await editorWindow(page);
    const stop = window.getByRole("button", { name: "Stop", exact: true });
    const idle = await stop.isDisabled();
    await window.getByRole("button", { name: "Record", exact: true }).click();
    const recording = await until(() => stop.isEnabled(), 3_000);
    if (recording) await stop.click();
    const stopped = await until(() => stop.isDisabled(), 3_000);
    return {
      ok: idle && recording && stopped,
      detail: `Stop dimmed at rest=${idle}, enabled while recording=${recording}, dimmed after Stop=${stopped}`,
    };
  },
  m(
    "button",
    "Record",
    "click Record, then Stop",
    "recording starts (Stop is enabled) and Stop ends it",
    [
      ["button", "Record", /toolbar/],
      ["button", "Stop", /toolbar/],
    ],
  ),
);

// ---- Pop-ups, panes and views ------------------------------------------------------------------------------------
for (const label of ["Language", "Element"]) {
  row(
    `script-editor.${slug(label)}`,
    async ({ page }) => {
      const window = await editorWindow(page);
      if (label === "Element") {
        // The pop-up lists the script's handlers: with none it holds only the dimmed No elements.
        await ensureJavaScript(page);
        await scriptBox(page).click();
        await page.keyboard.press("Control+A");
        await page.keyboard.press("Delete");
        await page.keyboard.type("function censusOne() {}\nfunction censusTwo() {}");
      }
      const control = window.getByRole("combobox", { name: label });
      const original = ((await fieldValue(control)) || (await control.innerText())).trim();
      const names = await popupOptions(page, control);
      if (names.length === 0) return { ok: false, detail: "no choices" };
      const results = [];
      for (const name of names) {
        await choosePopup(page, control, name);
        const shown = (await fieldValue(control)) || (await control.innerText());
        results.push(`${name}:${shown.trim() === name ? "ok" : shown.trim()}`);
      }
      await choosePopup(page, control, names.includes(original) ? original : names[0]);
      return { ok: results.every((each) => each.endsWith(":ok")), detail: results.join(" ") };
    },
    m(
      "combobox",
      label,
      `choose each item of the ${label} pop-up`,
      "the pop-up shows the item chosen",
      [["combobox", label, /region:/]],
    ),
  );
}
for (const view of ["Description", "Result", "Log", "Library"]) {
  row(
    `script-editor.view.${slug(view)}`,
    async ({ page }) => {
      const window = await editorWindow(page);
      const others = ["Description", "Result", "Log", "Library"].filter((each) => each !== view);
      await window
        .getByRole("group", { name: "Accessory views" })
        .getByRole("button", { name: others[0], exact: true })
        .click();
      await window
        .getByRole("group", { name: "Accessory views" })
        .getByRole("button", { name: view, exact: true })
        .click();
      const pane = window.getByRole("textbox", { name: view, exact: true });
      const shown = await until(() => pane.isVisible(), 3_000);
      return { ok: shown, detail: `${view} pane shown=${shown}` };
    },
    m("button", view, `click ${view} under the script`, `the ${view} pane is shown`, [
      ["button", view, /group:Accessory views/],
      ["textbox", view, /region:/],
    ]),
  );
}
row(
  "script-editor.pane.accessory-view",
  async ({ page }) => {
    const window = await editorWindow(page);
    const toggle = window
      .getByRole("group", { name: "Panes" })
      .getByRole("button", { name: "Accessory view" });
    // The accessory view folds to its bar of view buttons, and the script takes the room.
    const script = window.getByRole("textbox", { name: "Script" });
    const height = async () => (await script.boundingBox())?.height ?? 0;
    const before = await height();
    await toggle.click();
    let grown = before;
    const flipped = await until(async () => {
      grown = await height();
      return grown > before + 50;
    }, 3_000);
    await toggle.click();
    const back = await until(async () => Math.abs((await height()) - before) <= 4, 3_000);
    return { ok: flipped && back, detail: `script ${before}px -> ${grown}px -> back=${back}` };
  },
  m(
    "button",
    "Accessory view",
    "click the Accessory view toggle, twice",
    "the accessory view hides, then shows",
    [["button", "Accessory view", /group:Panes/]],
  ),
);
row(
  "script-editor.pane.bundle-contents",
  async ({ page }) => {
    const window = await editorWindow(page);
    const toggle = window
      .getByRole("group", { name: "Panes" })
      .getByRole("button", { name: "Bundle contents" });
    await toggle.click();
    const field = window.getByRole("textbox", { name: "Name:" });
    const shown = await until(() => field.isVisible(), 3_000);
    const results = [];
    for (const label of ["Name:", "Identifier:", "Version:", "Copyright:"]) {
      const box = window.getByRole("textbox", { name: label });
      const value = uniq("Bv");
      await box.click({ clickCount: 3 });
      await page.keyboard.type(value);
      results.push(`${label}${(await fieldValue(box)).includes(value) ? "ok" : "lost"}`);
    }
    const splitter = window.getByRole("separator", { name: "Resize the bundle contents" });
    const box = await splitter.boundingBox();
    const width = (await field.boundingBox()).width;
    await drag(
      page,
      box.x + box.width / 2,
      box.y + box.height / 2,
      box.x + box.width / 2 - 40,
      box.y + box.height / 2,
    );
    const resized = Math.abs((await field.boundingBox()).width - width) > 10;
    await toggle.click();
    const hidden = await until(async () => !(await field.isVisible()), 3_000);
    return {
      ok: shown && hidden && resized && results.every((each) => each.endsWith("ok")),
      detail: `shown=${shown} ${results.join(" ")} resized=${resized} hidden=${hidden}`,
    };
  },
  m(
    "button",
    "Bundle contents",
    "open the bundle contents, type in each field, drag its divider, close it",
    "the fields take the text, the divider resizes the pane, the toggle hides it",
    [
      ["button", "Bundle contents", /group:Panes/],
      ["textbox", "Name:", /region:/],
      ["textbox", "Identifier:", /region:/],
      ["textbox", "Version:", /region:/],
      ["textbox", "Copyright:", /region:/],
      ["separator", "Resize the bundle contents", /region:/],
    ],
  ),
);
row(
  "script-editor.splitter.accessory",
  async ({ page }) => {
    const window = await editorWindow(page);
    const splitter = window.getByRole("separator", { name: "Resize the accessory view" });
    const box = await splitter.boundingBox();
    const before = (await scriptBox(page).boundingBox()).height;
    await drag(
      page,
      box.x + box.width / 2,
      box.y + box.height / 2,
      box.x + box.width / 2,
      box.y + box.height / 2 - 60,
    );
    const after = (await scriptBox(page).boundingBox()).height;
    return { ok: after < before - 30, detail: `script pane ${before}px -> ${after}px` };
  },
  m(
    "separator",
    "Resize the accessory view",
    "drag the divider up",
    "the script pane gets shorter",
    [["separator", "Resize the accessory view", /region:/]],
  ),
);
row(
  "script-editor.menu.script",
  async ({ page }) => {
    await editorWindow(page);
    await openMenu(page, "Script");
    const items = await page
      .getByRole("menu", { name: "Script", exact: true })
      .getByRole("menuitem")
      .allInnerTexts();
    await page.keyboard.press("Escape");
    return { ok: items.length > 0, detail: items.join(", ").slice(0, 120) };
  },
  m("menuitem", "/.+/", "menu bar Script", "the menu lists the script commands", [
    ["menuitem", "Compile", /Script$/],
  ]),
);

// ---- Bounded JavaScript -----------------------------------------------------------------------------------------
row(
  "script-editor.js.network-refused",
  async ({ page }) => {
    const { text, body } = await runScript(page, 'return await fetch("https://example.com/")');
    return {
      ok: body?.outcome === "threw" && /network/i.test(`${body?.error} ${text}`),
      detail: `${body?.outcome}: ${String(body?.error ?? text).slice(0, 100)}`,
    };
  },
  m(
    "button",
    "Run (network)",
    "run a script that fetches a URL",
    "the run is refused with a network error shown in Result",
  ),
);
row(
  "script-editor.js.runaway-stopped",
  async ({ page }) => {
    const started = Date.now();
    const { text, body } = await runScript(page, "while (true) {}", 40_000);
    const ms = Date.now() - started;
    return {
      ok:
        ["threw", "time_exhausted"].includes(body?.outcome) &&
        /stopped|longer than/i.test(`${body?.error ?? ""} ${text}`) &&
        ms < 35_000,
      detail: `${body?.outcome} after ${ms} ms: ${String(body?.error ?? text).slice(0, 100)}`,
    };
  },
  {
    timeout: 60_000,
    ...m(
      "button",
      "Run (runaway loop)",
      "run while (true) {}",
      "the run is stopped by its bound and the error is shown",
    ),
  },
);
row(
  "script-editor.js.notes-make",
  async ({ page }) => {
    const title = uniq("Sn");
    const { body } = await runScript(
      page,
      `Notes.make({ title: "${title}", text: "from Script Editor" }); return "made"`,
    );
    const notes = (await api(page, "GET", "/api/notes/data")).json?.data?.notes ?? [];
    const made = notes.some((note) => (note.lines?.[0] ?? "").trim() === title);
    return {
      ok: body?.outcome === "completed" && made,
      detail: `${body?.outcome}; note saved=${made}`,
    };
  },
  m(
    "button",
    "Run (Notes.make)",
    "run Notes.make({ title, text })",
    "the note is made in the account's Notes",
  ),
);
row(
  "script-editor.js.desktop-open",
  async ({ page }) => {
    const { body } = await runScript(page, 'Desktop.open("Notes"); return "ok"');
    const notes = page.getByRole("region", { name: "Notes", exact: true }).first();
    const shown = await until(() => notes.isVisible(), 6_000);
    if (shown)
      await notes
        .getByRole("group", { name: "Window controls" })
        .getByRole("button", { name: "Close" })
        .click()
        .catch(() => {});
    return {
      ok: body?.outcome === "completed" && shown,
      detail: `${body?.outcome}; Notes opened=${shown}`,
    };
  },
  m("button", "Run (Desktop.open)", 'run Desktop.open("Notes")', "the Notes window opens"),
);
row(
  "script-editor.js.console-log",
  async ({ page }) => {
    const word = uniq("Lg");
    await runScript(page, `console.log("${word}"); return 1`);
    await win(page)
      .getByRole("group", { name: "Accessory views" })
      .getByRole("button", { name: "Log", exact: true })
      .click();
    const logged = await until(
      async () =>
        (await fieldValue(win(page).getByRole("textbox", { name: "Log" }))).includes(word),
      4_000,
    );
    return { ok: logged, detail: logged ? "the Log shows the message" : "not in the Log" };
  },
  m("textbox", "Log", "run console.log(word), open Log", "the Log pane shows the word"),
);

// ---- Save Script, Open Script, persistence, isolation ------------------------------------------------------------
const files = async (page) => (await api(page, "GET", "/api/files/")).json?.entries ?? [];
row(
  "script-editor.compile.javascript",
  async ({ page }) => {
    await editorWindow(page);
    await ensureJavaScript(page);
    await scriptBox(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type("return (1 +");
    await win(page).getByRole("button", { name: "Compile", exact: true }).click();
    let said = "";
    const told = await until(async () => {
      said = await fieldValue(resultBox(page)).catch(() => "");
      return /Syntax Error/i.test(said);
    }, 4_000);
    return { ok: told, detail: `result: ${said.slice(0, 120) || "(empty)"}` };
  },
  m(
    "button",
    "Compile",
    "JavaScript chosen, a script with a syntax error, then Compile",
    "the result names the syntax error",
  ),
);

row(
  "script-editor.save-open",
  async ({ page, ctx }) => {
    const name = uniq("Sc");
    const word = uniq("Body");
    await editorWindow(page);
    await scriptBox(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type(`return "${word}"`);
    await win(page).getByRole("button", { name: "Save Script" }).click();
    const sheet = page.getByRole("dialog", { name: "Save Script" });
    await sheet.waitFor({ timeout: 5_000 });
    await sheet.getByRole("textbox", { name: "Save As:" }).fill("");
    await sheet.getByRole("textbox", { name: "Save As:" }).click();
    await page.keyboard.type(name);
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    const saved = await until(
      async () => (await files(page)).some((entry) => entry.name === `${name}.js`),
      6_000,
      300,
    );
    // Another script in the editor, then Open Script brings the saved one back.
    await scriptBox(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("return 0");
    await win(page).getByRole("button", { name: "Open Script" }).click();
    await page
      .getByRole("menuitem", { name: new RegExp(name) })
      .first()
      .click();
    // The script was edited: Script Editor asks to keep the changes first.
    await dontSave(page);
    const opened = await until(
      async () => (await scriptBox(page).innerText()).includes(word),
      4_000,
    );
    keep({ account: ctx.account, name, word });
    return {
      ok: saved && opened,
      detail: `saved as Documents/Scripts/${name}.js=${saved}; opened back=${opened}`,
    };
  },
  m(
    "button",
    "Save Script",
    "Save Script, type a name, Save; then Open Script and choose it",
    "the script is saved as a file and opens again",
    [
      ["button", "Save Script", /region:/],
      ["textbox", "Save As:", /dialog:Save Script/],
      ["button", "Save", /dialog:Save Script/],
      ["button", "Open Script", /region:/],
    ],
    { persists: "reload+restart" },
  ),
);
row(
  "script-editor.save-cancel",
  async ({ page }) => {
    await editorWindow(page);
    await win(page).getByRole("button", { name: "Save Script" }).click();
    const sheet = page.getByRole("dialog", { name: "Save Script" });
    await sheet.waitFor({ timeout: 5_000 });
    await sheet.getByRole("button", { name: "Cancel" }).click();
    const gone = await until(async () => !(await sheet.isVisible()), 3_000);
    return { ok: gone, detail: gone ? "the sheet closed" : "the sheet stayed" };
  },
  m("button", "Cancel", "Save Script, then Cancel", "the sheet closes without saving", [
    ["button", "Cancel", /dialog:Save Script/],
  ]),
);
row(
  "script-editor.open-script.empty",
  async ({ ctx }) => {
    // A fresh account has no saved scripts: Open Script lists the dimmed reason.
    const other = await otherAccount(ctx, "seemp");
    try {
      await installApps(other.page, ["script-editor"]);
      await reload(other.page);
      await editorWindow(other.page);
      await win(other.page).getByRole("button", { name: "Open Script" }).click();
      const item = other.page.getByRole("menuitem", { name: "No Saved Scripts" }).first();
      const shown = await until(() => item.isVisible(), 3_000);
      const dimmed = shown && (await item.getAttribute("aria-disabled")) === "true";
      return dimmed
        ? { unavailable: "No Saved Scripts" }
        : { ok: false, detail: `item shown=${shown} dimmed=${dimmed}` };
    } finally {
      await other.close();
    }
  },
  m(
    "menuitem",
    "No Saved Scripts",
    "Open Script in an account with no scripts",
    "the menu says there are none, dimmed",
    [["menuitem", "No Saved Scripts", /menu:Open/]],
  ),
);
row(
  "script-editor.persist.reload",
  async ({ page }) => {
    const { name, word } = kept();
    await reload(page);
    await editorWindow(page);
    await win(page).getByRole("button", { name: "Open Script" }).click();
    await page
      .getByRole("menuitem", { name: new RegExp(name) })
      .first()
      .click();
    const opened = await until(
      async () => (await scriptBox(page).innerText()).includes(word),
      4_000,
    );
    return { ok: opened, detail: `${name} opened after reload=${opened}` };
  },
  m(
    "button",
    "Open Script (after reload)",
    "reload, Open Script, choose the saved script",
    "it opens with its text",
    [],
    { persists: "reload" },
  ),
);
row(
  "script-editor.persist.restart",
  async ({ page }) => {
    const { name, word } = kept();
    await editorWindow(page);
    await win(page).getByRole("button", { name: "Open Script" }).click();
    await page
      .getByRole("menuitem", { name: new RegExp(name) })
      .first()
      .click();
    const opened = await until(
      async () => (await scriptBox(page).innerText()).includes(word),
      6_000,
    );
    return { ok: opened, detail: `after a real server restart ${name} opened=${opened}` };
  },
  {
    phases: ["restart-check"],
    ...m(
      "button",
      "Open Script (after restart)",
      "sign in again after the server restarted, Open Script",
      "the saved script opens",
      [],
      { persists: "restart" },
    ),
  },
);
row(
  "script-editor.isolation.second-account",
  async ({ ctx }) => {
    const { name } = kept();
    const other = await otherAccount(ctx, "seiso");
    try {
      const leaked = (await files(other.page)).some((entry) => entry.name === `${name}.js`);
      return { ok: !leaked, detail: `the second account sees ${name}.js=${leaked}` };
    } finally {
      await other.close();
    }
  },
  m(
    "button",
    "Saved scripts (another account)",
    "a second account signs up",
    "it does not see the first account's scripts",
  ),
);

// ---- Edit's text tools, Font's and Format's rows on the selection, the Log's menu, File > Share, Help, drops ------
const description = (page) => win(page).getByRole("textbox", { name: "Description" });
/** The Script Editor window in front: a row before may have opened another app over it. */
const frontWindow = (page) => openFromDock(page, "Script Editor", { selector: SELECTOR });
const showView = (page, name) =>
  win(page)
    .getByRole("group", { name: "Accessory views" })
    .getByRole("button", { name, exact: true })
    .click();
/** The computed `property` of the text `word` of the script. */
const computedOf = (page, word, property) =>
  scriptBox(page).evaluate(
    (root, [text, name]) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.data.includes(text)) return getComputedStyle(node.parentElement)[name];
      }
      return null;
    },
    [word, property],
  );
/**
 * Make Plain Text on the script, since a row before may leave its last line bold and a line typed
 * after it takes that bold, which Font > Bold then turns off. Says whether its last words were bold.
 */
async function plainScript(page) {
  const box = scriptBox(page);
  const bold = await box.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue.trim() !== "") last = node;
    }
    return last !== null && Number(getComputedStyle(last.parentElement).fontWeight) >= 600;
  });
  await box.click();
  await chooseMenu(page, "Format", "Make Plain Text");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await until(
    () => box.evaluate((root) => root.querySelector("b, strong, [style*='bold']") === null),
    3_000,
  );
  return bold;
}

/** Drags the desktop icon `name` to the middle of `target`, or `offset` inside it. */
async function dragIcon(page, name, target, offset) {
  const icon = page
    .getByRole("group", { name: "Desktop", exact: true })
    .locator(".mac-desktop-icon", { hasText: name })
    .first();
  await icon.waitFor({ timeout: 15_000 });
  const from = await icon.boundingBox();
  const box = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 12, from.y + from.height / 2 + 12, { steps: 4 });
  await page.mouse.move(
    box.x + (offset?.x ?? box.width / 2),
    box.y + (offset?.y ?? box.height / 2),
    { steps: 12 },
  );
  await page.mouse.up();
}

row(
  "script-editor.edit.dictation-emoji",
  async ({ page }) => {
    await editorWindow(page);
    await scriptBox(page).click();
    const recognizer = await page.evaluate(
      () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    );
    const dictation = await menuState(page, "Edit", "Start Dictation…");
    const emoji = await menuState(page, "Edit", "Emoji & Symbols");
    return {
      ok: dictation?.disabled === !recognizer && emoji?.disabled === false,
      detail: `recognizer ${recognizer}, dictation ${JSON.stringify(dictation)} emoji ${JSON.stringify(emoji)}`,
    };
  },
  m(
    "menuitem",
    "Start Dictation…",
    "click the script, open Edit",
    "Dictation is dimmed only without a recognizer, Emoji & Symbols is not",
  ),
);
row(
  "script-editor.edit.spelling",
  async ({ page }) => {
    await editorWindow(page);
    await scriptBox(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type("return zzqxv;");
    await chooseMenu(page, "Edit", "Spelling and Grammar", "Show Spelling and Grammar");
    const panel = panelOf(page, "Spelling and Grammar");
    const found = await until(
      async () => /zzqxv/.test(await panel.innerText().catch(() => "")),
      6_000,
    );
    if (found) await panel.getByRole("button", { name: "Close" }).click();
    await chooseMenu(page, "Edit", "Spelling and Grammar", "Check Spelling While Typing");
    const on = await scriptBox(page).getAttribute("spellcheck");
    await chooseMenu(page, "Edit", "Spelling and Grammar", "Check Spelling While Typing");
    const off = await scriptBox(page).getAttribute("spellcheck");
    return {
      ok: found && on === "true" && off === "false",
      detail: `panel found the word=${found}; spellcheck ${on} then ${off}`,
    };
  },
  m(
    "menuitem",
    "Show Spelling and Grammar",
    "type an unknown word, Edit > Spelling and Grammar",
    "the panel names the word; Check Spelling While Typing turns the underlines on and off",
  ),
);
row(
  "script-editor.edit.substitutions",
  async ({ page }) => {
    await editorWindow(page);
    await showView(page, "Description");
    await description(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type('say "hi" a--b');
    const said = await description(page).innerText();
    await scriptBox(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type('return "a--b";');
    const code = await scriptBox(page).innerText();
    return {
      ok: said.includes("say “hi” a—b") && code.includes('return "a--b";'),
      detail: `description ${said} / script ${code}`,
    };
  },
  m(
    "textbox",
    "Description",
    "type quotes and two hyphens in the Description and in the script",
    "the Description's turn curly and long, the script's stay as typed",
  ),
);
row(
  "script-editor.font.kern",
  async ({ page }) => {
    await editorWindow(page);
    const word = await line(page, scriptBox(page), "Kn");
    await doubleClickWord(page, scriptBox(page), word);
    const before = await computedOf(page, word, "letterSpacing");
    await chooseMenu(page, "Font", "Kern", "Loosen");
    let after = before;
    const ok = await until(async () => {
      after = await computedOf(page, word, "letterSpacing");
      return after !== before;
    }, 3_000);
    return { ok, detail: `letter-spacing ${before} -> ${after}` };
  },
  m("menuitem", "Loosen", "select a word, Font > Kern > Loosen", "its letters spread"),
);
row(
  "script-editor.font.copy-paste-style",
  async ({ page }) => {
    await editorWindow(page);
    const leftover = await plainScript(page);
    const first = await line(page, scriptBox(page), "Cs");
    const second = await line(page, scriptBox(page), "Ps");
    await doubleClickWord(page, scriptBox(page), first);
    await chooseMenu(page, "Font", "Bold");
    await doubleClickWord(page, scriptBox(page), first);
    await chooseMenu(page, "Font", "Copy Style");
    await doubleClickWord(page, scriptBox(page), second);
    await chooseMenu(page, "Font", "Paste Style");
    const ok = await until(async () => (await styleOf(scriptBox(page), second)).bold, 3_000);
    return { ok, detail: `the second word bold=${ok}; leftover bold=${leftover}` };
  },
  m("menuitem", "Paste Style", "Copy Style on a bold word, Paste Style on another", "it is bold"),
);
row(
  "script-editor.format.writing-direction",
  async ({ page }) => {
    await editorWindow(page);
    await showView(page, "Description");
    await description(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type("written");
    await chooseMenu(page, "Format", "Text", "Writing Direction", "Right to Left");
    const dir = () =>
      description(page).evaluate((root) => root.querySelector("[dir]")?.getAttribute("dir"));
    const set = await until(async () => (await dir()) === "rtl", 3_000);
    await showView(page, "Result");
    await showView(page, "Description");
    const kept = await dir();
    await description(page).click();
    await chooseMenu(page, "Format", "Text", "Writing Direction", "Natural");
    const back = await until(async () => (await dir()) === undefined, 3_000);
    return { ok: set && kept === "rtl" && back, detail: `set=${set} kept=${kept} back=${back}` };
  },
  m(
    "menuitemradio",
    "Right to Left",
    "Format > Text > Writing Direction > Right to Left, then another view and back, then Natural",
    "the line reads right to left, keeps it, and goes back",
  ),
);
row(
  "script-editor.context.font",
  async ({ page }) => {
    await editorWindow(page);
    const leftover = await plainScript(page);
    const word = await line(page, scriptBox(page), "Cx");
    await doubleClickWord(page, scriptBox(page), word);
    const point = await page.evaluate(() => {
      const box = getSelection().getRangeAt(0).getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    await page.mouse.click(point.x, point.y, { button: "right" });
    const menu = page.getByRole("menu", { name: "Script commands" });
    await menu.waitFor({ timeout: 5_000 });
    await menu.getByRole("menuitem", { name: "Font", exact: true }).hover();
    const font = page.getByRole("menu", { name: "Font", exact: true }).last();
    await font.waitFor({ timeout: 5_000 });
    await font.getByRole("menuitemcheckbox", { name: /^Bold/ }).click();
    const ok = await until(async () => (await styleOf(scriptBox(page), word)).bold, 3_000);
    return { ok, detail: `the word bold=${ok}; leftover bold=${leftover}` };
  },
  m("menuitemcheckbox", "Bold", "secondary-click a selected word, Font > Bold", "it is bold"),
);
row(
  "script-editor.log.copy",
  async ({ page }) => {
    const word = uniq("Lc");
    await runScript(page, `console.log("${word}"); return 1`);
    await showView(page, "Log");
    await page.evaluate(() => {
      window.copiedForCensus = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (text) => window.copiedForCensus.push(text) },
      });
    });
    await win(page).getByRole("textbox", { name: "Log" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
    const copied = await page.evaluate(() => window.copiedForCensus.join("\n"));
    return { ok: copied.includes(word), detail: `copied ${copied.slice(0, 100)}` };
  },
  m("menuitem", "Copy", "secondary-click the Log, Copy", "the clipboard takes the Log"),
);
row(
  "script-editor.file.dimmed",
  async ({ page }) => {
    await editorWindow(page);
    const setup = await menuState(page, "File", "Page Setup…");
    const airdrop = await menuState(page, "File", "Share", "AirDrop");
    return {
      ok: setup?.disabled === true && airdrop?.disabled === true,
      detail: `page setup ${JSON.stringify(setup)} airdrop ${JSON.stringify(airdrop)}`,
    };
  },
  m("menuitem", "Page Setup…", "open File and File > Share", "both rows are dimmed"),
);
row(
  "script-editor.file.share-mail",
  async ({ page }) => {
    await frontWindow(page);
    await chooseMenu(page, "File", "Share", "Mail");
    const name = page.locator('[data-window-id^="mail"]').getByText(/\.js/).first();
    const shown = await until(() => name.isVisible(), 8_000);
    return { ok: shown, detail: `the message holds the script=${shown}` };
  },
  m("menuitem", "Mail", "File > Share > Mail", "a new message holds the script as an attachment"),
);
row(
  "script-editor.help.applescript",
  async ({ page }) => {
    await frontWindow(page);
    await chooseMenu(page, "Help", "AppleScript Help");
    const viewer = page.locator(".mac-window.mac-help-viewer").first();
    const shown = await until(() => viewer.isVisible(), 8_000);
    return { ok: shown, detail: `Help Viewer shown=${shown}` };
  },
  m("menuitem", "AppleScript Help", "Help > AppleScript Help", "Help Viewer opens"),
);
row(
  "script-editor.drop.script-and-path",
  async ({ page }) => {
    const script = `${uniq("Dp")}.js`;
    const note = `${uniq("Dn")}.txt`;
    const body = uniq("Dropped");
    await uploadFile(page, {
      parent: "desktop",
      name: script,
      type: "text/javascript",
      text: `return "${body}";`,
    });
    await uploadFile(page, { parent: "desktop", name: note, type: "text/plain", text: "x" });
    await reload(page);
    await frontWindow(page);
    // Rows before leave Mail's composer and Help Viewer open, which can cover the icon. With nothing
    // else open the row is dimmed.
    const others = await menuState(page, "Script Editor", "Hide Others");
    if (others && !others.disabled) await chooseMenu(page, "Script Editor", "Hide Others");
    await dragIcon(page, script, win(page).getByRole("toolbar", { name: "Toolbar" }));
    await dontSave(page);
    const opened = await until(
      async () => (await scriptBox(page).innerText()).includes(body),
      6_000,
    );
    await dragIcon(page, note, scriptBox(page));
    const inserted = await until(
      async () => (await scriptBox(page).innerText()).includes(`Desktop/${note}`),
      4_000,
    );
    return {
      ok: opened && inserted,
      detail: `script opened=${opened}; path in the script=${inserted}: ${(await scriptBox(page).innerText()).slice(0, 120)}`,
    };
  },
  m(
    "textbox",
    "Script",
    "drag a .js icon to the toolbar, a text file's icon to the script",
    "the script opens; the path goes in the text",
  ),
);
row(
  "script-editor.drop.dock",
  async ({ page }) => {
    const script = `${uniq("Dk")}.js`;
    const body = uniq("Docked");
    await uploadFile(page, {
      parent: "desktop",
      name: script,
      type: "text/javascript",
      text: `return "${body}";`,
    });
    await reload(page);
    await editorWindow(page);
    const tile = page.getByRole("button", { name: /^Script Editor/ }).first();
    await dragIcon(page, script, tile);
    await dontSave(page);
    const opened = await until(
      async () => (await scriptBox(page).innerText()).includes(body),
      6_000,
    );
    return { ok: opened, detail: `opened from the Dock tile=${opened}` };
  },
  m("button", "Script Editor", "drag a .js icon to the Dock tile", "the script opens"),
);

appRows(row, {
  P: "script-editor",
  app: "Script Editor",
  state: S,
  open: editorWindow,
  gone: async (page) =>
    !(await win(page)
      .isVisible()
      .catch(() => false)),
  windowItem: null,
  fullScreen: true,
  windowMenu: true,
  help: true,
  closeTitle: "Untitled",
});

await run({
  prepare: async ({ page }) => {
    const answer = await installApps(page, ["script-editor"]);
    if (answer.status !== 200) throw new Error(`installing Script Editor: HTTP ${answer.status}`);
    await reload(page);
  },
  beforeEach: async ({ page }) => {
    await tidy(page);
  },
});
