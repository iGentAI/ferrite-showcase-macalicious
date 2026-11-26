#!/usr/bin/env node
// Font Book census journey (R4): one `ok`/`FAIL` line per census id of Font Book, with real input, in chromium,
// chrome, firefox or webkit: every family row of the font list (each its own row), the collections, Add Collection,
// the preview modes and controls, search, Add Fonts, Disable/Enable, the divider, the app menu and window, the
// library across a reload and a real server restart, and per-account isolation.
//
//   node e2e/font-book-census-journey.mjs --browser chromium|chrome|firefox|webkit [--phase write|restart-check]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appRows, choosePopup, otherAccount, popupOptions } from "./r4-app-rows.mjs";
import {
  api,
  census,
  chooseMenu,
  createAccount,
  drag,
  menuState,
  newIdentity,
  openFromDock,
  reload,
  sleep,
  until,
} from "./r4-census-kit.mjs";
import { slug, tidy, uniq } from "./r4-editor-rows.mjs";
import { uploadFile } from "./system-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { row, run, keep, kept } = census("font-book");
const S = "Font Book window";
const m = (role, name, how, expect, covers = [], extra = {}) => ({
  meta: { state: S, role, name, how, expect, persists: "none", covers, ...extra },
});
const TITLE = /\(\d+ Fonts?\)$/;
const win = (page) => page.getByRole("region", { name: TITLE }).first();
const grid = (page) => win(page).getByRole("treegrid", { name: "Fonts" });
const library = async (page) => (await api(page, "GET", "/api/font-book/library")).json ?? {};

/**
 * The families of the font list, by name: the `families` list of this revision's demos/font-book/font-book-data.ts
 * (each `fontFamily("Name", ...)`), which the font list shows in that order. Each family is its own census row.
 */
const FAMILIES = (() => {
  const file = path.resolve(here, "../../../demos/font-book/font-book-data.ts");
  if (!existsSync(file)) return [];
  const source = readFileSync(file, "utf8");
  const start = source.indexOf("export const families");
  if (start < 0) return [];
  const list = source.slice(start, source.indexOf("\n];", start));
  return [...new Set([...list.matchAll(/fontFamily\(\s*"([^"]+)"/g)].map((match) => match[1]))];
})();

/** A real TrueType file, whose tables the rows read back: what Info says of it is what its bytes say. */
const REAL_TTF = (() => {
  const file = path.resolve(
    here,
    "../../../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf",
  );
  return existsSync(file) ? readFileSync(file) : Buffer.alloc(0);
})();
const ttf = (name, buffer = REAL_TTF) => ({ name: `${name}.ttf`, mimeType: "font/ttf", buffer });
/** The real file with one table's stored checksum spoiled, as `validateFontBytes` warns of. */
function wrongChecksum(name) {
  const buffer = Buffer.from(REAL_TTF);
  const count = buffer.readUInt16BE(4);
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    if (buffer.toString("latin1", at, at + 4) === "name") {
      buffer.writeUInt32BE((buffer.readUInt32BE(at + 4) + 1) >>> 0, at + 4);
    }
  }
  return ttf(name, buffer);
}
const treeItem = (page, name) => win(page).getByRole("treeitem", { name, exact: true });
const viewButton = (page, name) =>
  win(page).getByRole("group", { name: "Preview" }).getByRole("button", { name, exact: true });
const driveEntries = async (page) => (await api(page, "GET", "/api/files/")).json?.entries ?? [];
/** Whether the preview comes to name the font `name`. */
const titled = (page, name) =>
  until(
    async () =>
      (await win(page).locator(".mac-font-book-title").innerText()).startsWith(`${name} `),
    10_000,
  );
async function addFonts(page, file) {
  const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
  await chooseMenu(page, "File", "Add Fonts…");
  await (await chooser).setFiles(file);
  if (!(await titled(page, file.name.replace(/\.ttf$/, ""))))
    throw new Error(`${file.name} did not show in Font Book`);
}
/** A Finder window on `folder`, in front. */
async function finderOn(page, folder) {
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: folder, exact: true }).first().click();
  await sleep(500);
  return finder;
}

async function fontBook(page) {
  if (
    await win(page)
      .isVisible()
      .catch(() => false)
  )
    return win(page);
  const window = await openFromDock(page, "Font Book", TITLE);
  await until(
    () =>
      page.evaluate(() => !document.querySelector(".mac-font-book-body")?.hasAttribute("inert")),
    5_000,
  );
  return window;
}

/** The font row named `name`, scrolled into view with the mouse wheel when the list has not drawn it yet. */
async function fontRow(page, name) {
  const target = grid(page)
    .getByRole("row", {
      name: new RegExp(`^(Off )?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    })
    .first();
  // The list draws only the rows in view: from its top, a step at a time down until the row is drawn.
  if ((await target.count()) === 0) {
    const box = await grid(page).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -100_000);
    await sleep(150);
    for (let tries = 0; tries < 60 && (await target.count()) === 0; tries += 1) {
      await page.mouse.wheel(0, 240);
      await sleep(100);
    }
  }
  if ((await target.count()) === 0)
    throw new Error(`no font row ${name} in the list, scrolled top to bottom`);
  await target.scrollIntoViewIfNeeded({ timeout: 5_000 });
  return target;
}

if (FAMILIES.length === 0)
  row(
    "font-book.font.list",
    async () => ({ ok: false, detail: "no families read from demos/font-book/font-book-data.ts" }),
    m("row", "Font list", "", ""),
  );
for (const family of FAMILIES) {
  row(
    `font-book.font.${slug(family)}`,
    async ({ page }) => {
      await fontBook(page);
      await win(page).getByRole("treeitem", { name: "All Fonts" }).click();
      const target = await fontRow(page, family);
      await target.click();
      const selected = await until(
        async () => (await target.getAttribute("aria-selected")) === "true",
        3_000,
      );
      // The toolbar's Disable button and the preview follow the selection.
      const named = await until(
        async () =>
          (await win(page)
            .getByRole("button", {
              name: new RegExp(
                `^(Disable|Enable) “${family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}”$`,
              ),
            })
            .count()) > 0,
        3_000,
      );
      return {
        ok: selected && named,
        detail: `selected=${selected}; Disable/Enable names it=${named}`,
      };
    },
    m(
      "row",
      family,
      "click the family in the font list",
      "the family is selected and the preview and Disable button follow it",
      [
        ["row", family, /treegrid:Fonts/],
        ["gridcell", family, /row:/],
      ],
    ),
  );
}

const COLLECTIONS = [
  "All Fonts",
  "English",
  "Fixed Width",
  "Fun",
  "Modern",
  "PDF",
  "Traditional",
  "Web",
];
for (const collection of COLLECTIONS) {
  row(
    `font-book.collection.${slug(collection)}`,
    async ({ page }) => {
      await fontBook(page);
      await win(page)
        .getByRole("treeitem", { name: collection === "Web" ? "Fun" : "Web", exact: true })
        .click();
      await win(page).getByRole("treeitem", { name: collection, exact: true }).click();
      const named = page.getByRole("region", {
        name: new RegExp(`^${collection} \\(\\d+ Fonts?\\)$`),
      });
      const titled = await until(async () => (await named.count()) > 0, 3_000);
      return {
        ok: titled,
        detail: titled
          ? `window named ${collection} (n Fonts)`
          : `no window named ${collection} (n Fonts)`,
      };
    },
    m(
      "treeitem",
      collection,
      "click the collection in the sidebar",
      "the window shows that collection and its font count",
      [["treeitem", collection, /tree:Collections/]],
    ),
  );
}
for (const mode of ["Sample", "Repertoire", "Custom", "Info"]) {
  row(
    `font-book.preview.${slug(mode)}`,
    async ({ page }) => {
      await fontBook(page);
      const group = win(page).getByRole("group", { name: "Preview" });
      await group
        .getByRole("button", { name: mode === "Sample" ? "Info" : "Sample", exact: true })
        .click();
      const before = await win(page).innerText();
      await group.getByRole("button", { name: mode, exact: true }).click();
      const pressed = await until(
        async () =>
          /true/.test(
            `${await group.getByRole("button", { name: mode, exact: true }).getAttribute("aria-pressed")}${await group.getByRole("button", { name: mode, exact: true }).getAttribute("aria-checked")}`,
          ),
        3_000,
      );
      const changed = (await win(page).innerText()) !== before;
      let typed = true;
      if (mode === "Custom") {
        const box = win(page).getByRole("textbox").last();
        const word = uniq("Pv");
        await box.click();
        await page.keyboard.type(word);
        typed = await until(
          async () =>
            (await win(page).innerText()).includes(word) ||
            (await box.inputValue().catch(() => "")).includes(word),
          3_000,
        );
      }
      return {
        ok: pressed && changed && typed,
        detail: `pressed=${pressed} preview changed=${changed}${mode === "Custom" ? ` custom text shown=${typed}` : ""}`,
      };
    },
    m(
      "button",
      mode,
      `click ${mode} in the preview's mode buttons`,
      `the preview shows the ${mode.toLowerCase()} view`,
      [["button", mode, /group:Preview/]],
    ),
  );
}
row(
  "font-book.show-choices",
  async ({ page }) => {
    await fontBook(page);
    const button = win(page).getByRole("button", { name: "Show choices" }).first();
    if (!(await button.isVisible().catch(() => false)))
      await win(page)
        .getByRole("group", { name: "Preview" })
        .getByRole("button", { name: "Sample", exact: true })
        .click();
    await button.click();
    const list = page.getByRole("listbox").last();
    const shown = await until(() => list.isVisible(), 3_000);
    const options = await list.getByRole("option").allInnerTexts();
    const pick = options[Math.min(2, options.length - 1)]?.trim();
    if (pick) await list.getByRole("option", { name: pick, exact: true }).click();
    const field = win(page).getByRole("combobox").first();
    const took = pick
      ? await until(
          async () => (await field.inputValue().catch(() => field.innerText())).includes(pick),
          3_000,
        )
      : false;
    return {
      ok: shown && took,
      detail: `choices ${options.join(",").slice(0, 80)}; chose ${pick}; field took it=${took}`,
    };
  },
  m(
    "button",
    "Show choices",
    "open the size choices of the preview, choose one",
    "the preview size field takes the choice",
    [["button", "Show choices", /region:/]],
  ),
);
row(
  "font-book.search",
  async ({ page }) => {
    await fontBook(page);
    await win(page).getByRole("treeitem", { name: "All Fonts" }).click();
    const search = win(page).getByRole("searchbox", { name: "Search" });
    await search.click();
    await page.keyboard.type("Times");
    const rows = grid(page).getByRole("row");
    const filtered = await until(async () => {
      const names = await rows.allInnerTexts();
      return names.length > 0 && names.every((name) => /Times/i.test(name));
    }, 4_000);
    const shown = await rows.allInnerTexts();
    await search.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    const back = await until(async () => (await rows.count()) > shown.length, 4_000);
    return {
      ok: filtered && back,
      detail: `matches ${shown
        .map((each) => each.trim())
        .join(", ")
        .slice(0, 80)}; cleared back=${back}`,
    };
  },
  m(
    "searchbox",
    "Search",
    "type Times in the search field, then clear it",
    "only Times families are listed, then all again",
    [["searchbox", "Search", /toolbar/]],
  ),
);
row(
  "font-book.search-in",
  async ({ page }) => {
    await fontBook(page);
    const control = win(page).getByRole("button", { name: "Search in" });
    const names = await popupOptions(page, control);
    const results = [];
    for (const name of names) {
      await choosePopup(page, control, name);
      const state = await (async () => {
        await control.click();
        const item = page
          .getByRole("menuitemradio", { name, exact: true })
          .or(page.getByRole("option", { name, exact: true }))
          .last();
        const checked = `${await item.getAttribute("aria-checked")}${await item.getAttribute("aria-selected")}`;
        await page.keyboard.press("Escape");
        return /true/.test(checked);
      })();
      results.push(`${name}:${state ? "ok" : "not checked"}`);
    }
    return {
      ok: names.length > 0 && results.every((each) => each.endsWith(":ok")),
      detail: results.join(" ") || "no choices",
    };
  },
  m(
    "button",
    "Search in",
    "choose each scope of the search field's menu",
    "the scope chosen is checked",
    [["button", "Search in", /toolbar/]],
  ),
);
row(
  "font-book.splitter.collections",
  async ({ page }) => {
    await fontBook(page);
    const splitter = win(page).getByRole("separator", { name: "Resize the collections" });
    const tree = win(page).getByRole("tree", { name: "Collections" });
    const before = (await tree.boundingBox()).width;
    const box = await splitter.boundingBox();
    await drag(
      page,
      box.x + box.width / 2,
      box.y + box.height / 2,
      box.x + box.width / 2 + 50,
      box.y + box.height / 2,
    );
    const after = (await tree.boundingBox()).width;
    return { ok: after > before + 30, detail: `${before}px -> ${after}px` };
  },
  m(
    "separator",
    "Resize the collections",
    "drag the divider right",
    "the collections list gets wider",
    [["separator", "Resize the collections", /region:/]],
  ),
);
row(
  "font-book.add-fonts",
  async ({ page }) => {
    await fontBook(page);
    const chooser = page.waitForEvent("filechooser", { timeout: 5_000 }).catch(() => null);
    await win(page).getByRole("button", { name: "Add Fonts" }).click();
    const picker = await chooser;
    if (picker) {
      await picker.setFiles([]);
      return { ok: true, detail: "the browser's file chooser opened (closed without a file)" };
    }
    const dialog = page.getByRole("dialog").or(page.getByRole("alertdialog")).last();
    const shown = await until(() => dialog.isVisible(), 3_000);
    const text = shown ? (await dialog.innerText()).replace(/\s+/g, " ").slice(0, 120) : "";
    if (shown)
      await dialog
        .getByRole("button")
        .first()
        .click()
        .catch(() => page.keyboard.press("Escape"));
    return { ok: shown, detail: shown ? `dialog: ${text}` : "nothing opened" };
  },
  m("button", "Add Fonts", "click Add Fonts", "a file chooser or the add-fonts dialog opens", [
    ["button", "Add Fonts", /toolbar/],
  ]),
);
row(
  "font-book.tables.info",
  async ({ page, ctx }) => {
    await fontBook(page);
    const name = uniq("Quince");
    ctx.data.font = name;
    await addFonts(page, ttf(name));
    await viewButton(page, "Info").click();
    const info = await win(page).locator(".mac-font-book-info").innerText();
    const said = (term) => info.split(`${term}\n`)[1]?.split("\n")[0] ?? "";
    const onDrive = await until(
      async () =>
        (await driveEntries(page)).some((each) => each.name === `${name}.ttf` && !each.trashed_ms),
      6_000,
      300,
    );
    const ok =
      said("PostScript name") === "LiberationSans" &&
      said("Family") === "Liberation Sans" &&
      /Version/.test(said("Version")) &&
      /Liberation|Ascender|Google/i.test(said("Copyright")) &&
      said("Location") === `Documents/Fonts/${name}.ttf` &&
      said("Fixed width") === "No" &&
      onDrive;
    return {
      ok,
      detail: `ps=${said("PostScript name")} family=${said("Family")} version=${said("Version").slice(0, 24)} location=${said("Location")} onDrive=${onDrive}`,
    };
  },
  m(
    "button",
    "Info (an added font)",
    "add a real TrueType file, click Info",
    "Info says what the file's name table says and where the file is",
  ),
);
row(
  "font-book.tables.repertoire",
  async ({ page }) => {
    await fontBook(page);
    await viewButton(page, "Repertoire").click();
    const grid = win(page).getByRole("group", { name: "Repertoire", exact: true });
    await grid.waitFor({ timeout: 4_000 });
    const count = await grid.locator("span").count();
    const text = await grid.innerText();
    await viewButton(page, "Sample").click();
    return {
      ok: count > 100 && text.includes("A") && !text.includes("\u4e00"),
      detail: `${count} characters from the file's cmap, starting ${text.replace(/\s/g, "").slice(0, 12)}`,
    };
  },
  m(
    "group",
    "Repertoire (an added font)",
    "click Repertoire with a real file's font selected",
    "the characters are those of the file's cmap",
  ),
);
row(
  "font-book.libraries.rows",
  async ({ page, ctx }) => {
    await fontBook(page);
    await treeItem(page, "User").click();
    const user = await until(
      () => page.getByRole("region", { name: "User (1 Font)", exact: true }).isVisible(),
      3_000,
    );
    const listed = (await grid(page).innerText()).includes(ctx.data.font);
    await treeItem(page, "Computer").click();
    const computer = await until(
      () => page.getByRole("region", { name: "Computer (281 Fonts)", exact: true }).isVisible(),
      3_000,
    );
    return {
      ok: user && listed && computer,
      detail: `user=${user} listed=${listed} computer=${computer}`,
    };
  },
  m(
    "treeitem",
    "User and Computer",
    "click User, then Computer, with a font added",
    "User holds the added font, Computer the 281 of the desktop",
  ),
);
row(
  "font-book.libraries.new",
  async ({ page }) => {
    await fontBook(page);
    const name = uniq("Display");
    await chooseMenu(page, "File", "New Library");
    const field = win(page).getByRole("textbox", { name: "Collection name" });
    await field.waitFor({ timeout: 4_000 });
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(name);
    await page.keyboard.press("Enter");
    await treeItem(page, name).waitFor({ timeout: 4_000 });
    await addFonts(page, ttf(uniq("Olive")));
    const joined = await until(
      () => page.getByRole("region", { name: `${name} (1 Font)`, exact: true }).isVisible(),
      5_000,
    );
    await treeItem(page, "All Fonts").click();
    await sleep(700);
    await reload(page);
    await fontBook(page);
    const kept = await until(() => treeItem(page, name).isVisible(), 6_000);
    const beforeSmart = await page.evaluate((library) => {
      const rows = [...document.querySelectorAll(".mac-font-book-sidebar [role=treeitem]")];
      const header = [...document.querySelectorAll(".mac-font-book-sidebar *")].find(
        (each) => each.children.length === 0 && each.textContent === "Smart Collection",
      );
      const row = rows.find((each) => each.textContent === library);
      return Boolean(
        row && header && row.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }, name);
    return {
      ok: joined && kept && beforeSmart,
      detail: `the added font joined=${joined}; kept across a reload=${kept}; among the libraries=${beforeSmart}`,
    };
  },
  m(
    "menuitem",
    "New Library",
    "choose File > New Library, name it, add a file, reload",
    "the library holds the font added while it was selected and survives a reload",
    [],
    { persists: "reload" },
  ),
);
row(
  "font-book.several",
  async ({ page }) => {
    await fontBook(page);
    await treeItem(page, "Fixed Width").click();
    await (await fontRow(page, "Courier")).click();
    await (await fontRow(page, "Menlo")).click({ modifiers: ["ControlOrMeta"] });
    const heading = await until(
      async () => (await win(page).locator(".mac-font-book-title").innerText()) === "2 Fonts",
      3_000,
    );
    await viewButton(page, "Repertoire").click();
    const repertoires =
      (await win(page)
        .getByRole("group", { name: /^Repertoire of (Courier|Menlo) Regular$/ })
        .count()) === 2;
    await viewButton(page, "Info").click();
    const infos = (await win(page).locator(".mac-font-book-info").count()) === 2;
    await viewButton(page, "Custom").click();
    const word = uniq("Hamburg");
    await win(page).getByRole("textbox", { name: "Custom text" }).fill(word);
    const samples = await win(page).locator(".mac-font-book-several-sample").allInnerTexts();
    await viewButton(page, "Sample").click();
    await treeItem(page, "All Fonts").click();
    return {
      ok: heading && repertoires && infos && samples.join() === `${word},${word}`,
      detail: `heading=${heading} repertoires=${repertoires} infos=${infos} custom=${samples.length}`,
    };
  },
  m(
    "group",
    "Several fonts",
    "Command-click two fonts, then Repertoire, Info and Custom",
    "each view shows both fonts",
  ),
);
row(
  "font-book.language-collection",
  async ({ ctx }) => {
    const context = await ctx.browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "ja-JP",
    });
    try {
      const page = await context.newPage();
      await page.goto(`${ctx.opts.base}/`, { waitUntil: "load" });
      await createAccount(page, newIdentity("fbja", ctx.opts.browserName));
      await fontBook(page);
      const absent = (await treeItem(page, "Arabic").count()) === 0;
      await treeItem(page, "Japanese").click();
      const titled = await until(
        () => page.getByRole("region", { name: /^Japanese \(\d+ Fonts\)$/ }).isVisible(),
        3_000,
      );
      const listed = (await fontRow(page, "YuGothic")) !== null;
      return { ok: absent && titled && listed, detail: `Arabic absent=${absent} titled=${titled}` };
    } finally {
      await context.close().catch(() => {});
    }
  },
  m(
    "treeitem",
    "Japanese",
    "sign up in a browser whose language is Japanese, click Japanese",
    "the collection follows the browser's languages and lists the Japanese fonts",
  ),
);
row(
  "font-book.download-dimmed",
  async ({ page }) => {
    await fontBook(page);
    await treeItem(page, "All Fonts").click();
    await (await fontRow(page, "YuGothic")).click({ button: "right" });
    const item = page.getByRole("menuitem", { name: "Download “YuGothic”" });
    await item.waitFor({ timeout: 4_000 });
    const dimmed = (await item.getAttribute("aria-disabled")) === "true";
    const reason = await page
      .getByRole("menuitem", { name: "This desktop has no font server to download it from." })
      .isVisible();
    await page.keyboard.press("Escape");
    return { ok: dimmed && reason, detail: `dimmed=${dimmed} reason shown=${reason}` };
  },
  m(
    "menuitem",
    "Download “YuGothic”",
    "right-click a font not downloaded",
    "Download shows dimmed and the menu says why",
  ),
);
row(
  "font-book.validate.before-install",
  async ({ page }) => {
    await fontBook(page);
    const broken = `${uniq("Broken")}.ttf`;
    const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
    await chooseMenu(page, "File", "Add Fonts…");
    await (await chooser).setFiles({
      name: broken,
      mimeType: "font/ttf",
      buffer: Buffer.from("not a font at all"),
    });
    const sheet = page.getByRole("dialog");
    await sheet.waitFor({ timeout: 5_000 });
    const box = sheet.getByRole("checkbox", { name: new RegExp(broken) });
    const said = (await sheet.innerText()).includes(`${broken}: Failed`);
    const refused = (await box.getAttribute("aria-disabled")) === "true";
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await sheet.waitFor({ state: "hidden", timeout: 3_000 });

    const name = uniq("Warned");
    const chooser2 = page.waitForEvent("filechooser", { timeout: 5_000 });
    await chooseMenu(page, "File", "Add Fonts…");
    await (await chooser2).setFiles(wrongChecksum(name));
    await sheet.waitFor({ timeout: 5_000 });
    const warned = (await sheet.innerText()).includes("Table checksums");
    await sheet.getByRole("button", { name: "Install Checked" }).click();
    const installed = await titled(page, name);
    return {
      ok: said && refused && warned && installed,
      detail: `failed said=${said} cannot be checked=${refused}; warning said=${warned}; installed=${installed}`,
    };
  },
  {
    timeout: 60_000,
    ...m(
      "checkbox",
      "A font to install",
      "add a file that is no font, cancel; add one with a wrong table checksum, install it",
      "the sheet says what was found, keeps out what the browser refuses and installs what is checked",
    ),
  },
);
row(
  "font-book.preferences",
  async ({ page }) => {
    await fontBook(page);
    const prefs = () => page.getByRole("region", { name: "Font Book Preferences" });
    const open = async () => {
      await chooseMenu(page, "Font Book", "Preferences…");
      await prefs().waitFor({ timeout: 5_000 });
    };
    const close = () => prefs().getByRole("button", { name: "Close", exact: true }).first().click();
    await open();
    const fits = await prefs().evaluate((window) => {
      const frame = window.getBoundingClientRect();
      return [...window.querySelectorAll("[role=checkbox], p")].every((part) => {
        const box = part.getBoundingClientRect();
        return box.left >= frame.left && box.right <= frame.right && box.bottom <= frame.bottom;
      });
    });
    const validate = prefs().getByRole("checkbox", { name: "Validate fonts before installing" });
    const onAtFirst = (await validate.getAttribute("aria-checked")) === "true";
    const reason = await prefs().getByText("applications here do not ask").first().isVisible();
    const dimmed = await prefs()
      .getByRole("checkbox", { name: "Automatic font activation" })
      .getAttribute("aria-disabled");
    await validate.click();
    await close();

    const name = uniq("Unchecked");
    await addFonts(page, wrongChecksum(name));
    const noSheet = !(await page.getByRole("dialog").isVisible());

    await sleep(700);
    await reload(page);
    await fontBook(page);
    await open();
    const again = prefs().getByRole("checkbox", { name: "Validate fonts before installing" });
    const keptOff = (await again.getAttribute("aria-checked")) === "false";
    await again.click();
    await close();
    return {
      ok: fits && onAtFirst && reason && dimmed === "true" && noSheet && keptOff,
      detail: `fits its window=${fits} on at first=${onAtFirst} reason=${reason} activation dimmed=${dimmed} installed without a sheet=${noSheet} kept off after a reload=${keptOff}`,
    };
  },
  {
    timeout: 60_000,
    ...m(
      "checkbox",
      "Validate fonts before installing",
      "open Preferences, turn validation off, add a file with a warning, reload",
      "the file installs without asking, the choice is kept and what a page cannot do is dimmed with its reason",
      [],
      { persists: "reload" },
    ),
  },
);
row(
  "font-book.customize-toolbar",
  async ({ page }) => {
    await fontBook(page);
    const toolbar = () => win(page).getByRole("toolbar", { name: "Font Book toolbar" });
    await chooseMenu(page, "View", "Customize Toolbar…");
    const sheet = page.getByRole("dialog");
    await sheet.waitFor({ timeout: 4_000 });
    await sheet.getByRole("button", { name: "Remove Add Fonts" }).click();
    await sheet.getByRole("button", { name: "Print", exact: true }).click();
    const followed =
      (await toolbar().getByRole("button", { name: "Add Fonts" }).count()) === 0 &&
      (await toolbar().getByRole("button", { name: "Print" }).count()) === 1;
    await sheet.getByRole("button", { name: "Done" }).click();
    await sleep(700);
    await reload(page);
    await fontBook(page);
    const kept = await until(
      async () => (await toolbar().getByRole("button", { name: "Print" }).count()) === 1,
      5_000,
    );
    await chooseMenu(page, "View", "Customize Toolbar…");
    await sheet.getByRole("button", { name: "Use Default Set" }).click();
    const back =
      (await toolbar().getByRole("button", { name: "Add Fonts" }).count()) === 1 &&
      (await toolbar().getByRole("button", { name: "Print" }).count()) === 0;
    await sheet.getByRole("button", { name: "Done" }).click();
    await sleep(500);
    return {
      ok: followed && kept && back,
      detail: `followed=${followed} kept=${kept} default set=${back}`,
    };
  },
  {
    timeout: 60_000,
    ...m(
      "menuitem",
      "Customize Toolbar…",
      "take Add Fonts out, put Print in, reload, then Use Default Set",
      "the toolbar follows at once, survives a reload and goes back",
      [],
      { persists: "reload" },
    ),
  },
);
row(
  "font-book.finder.open",
  async ({ page }) => {
    await fontBook(page);
    const name = uniq("Plum");
    await uploadFile(page, {
      parent: "documents",
      name: `${name}.ttf`,
      type: "font/ttf",
      bytes: REAL_TTF,
    });
    const finder = await finderOn(page, "Documents");
    await finder
      .getByRole("option", { name: `${name}.ttf`, exact: true })
      .first()
      .dblclick();
    const sheet = page.getByRole("dialog");
    await sheet.waitFor({ timeout: 8_000 });
    const text = (await sheet.innerText()).replace(/\s+/g, " ");
    const notInstalled = text.includes("Liberation Sans") && text.includes("Not Installed");
    const stack = await sheet
      .getByRole("img", { name: "Sample of the font" })
      .evaluate((sample) => sample.style.fontFamily);
    const ownFace = await page.evaluate(
      (family) =>
        [...document.fonts].some((face) => family.includes(face.family.replace(/"/g, ""))),
      stack,
    );
    await sheet.getByRole("button", { name: "Install Font" }).click();
    const installed = await titled(page, name);
    const fonts = await until(
      async () => {
        const entries = await driveEntries(page);
        const folder = entries.find((each) => each.name === "Fonts" && each.parent === "documents");
        return entries.some((each) => each.parent === folder?.id && each.name === `${name}.ttf`);
      },
      6_000,
      300,
    );
    await finder.getByRole("button", { name: "Close", exact: true }).first().click();
    return {
      ok: notInstalled && ownFace && installed && fonts,
      detail: `sheet: ${text.slice(0, 60)}; own face=${ownFace}; installed=${installed}; in Documents/Fonts=${fonts}`,
    };
  },
  {
    timeout: 60_000,
    ...m(
      "button",
      "Install Font",
      "double-click a font file in Finder, click Install Font",
      "Font Book offers it in its own face and installs it",
    ),
  },
);
row(
  "font-book.finder.drop",
  async ({ page }) => {
    await fontBook(page);
    const name = uniq("Damson");
    const text = `${uniq("Letter")}.txt`;
    await uploadFile(page, {
      parent: "downloads",
      name: `${name}.ttf`,
      type: "font/ttf",
      bytes: REAL_TTF,
    });
    await uploadFile(page, {
      parent: "downloads",
      name: text,
      type: "text/plain",
      text: "a letter",
    });
    const finder = await finderOn(page, "Downloads");
    const grip = await finder.boundingBox();
    await drag(page, grip.x + 300, grip.y + 10, 1000 + 300, grip.y + 10);
    const body = await win(page).locator(".mac-font-book-body").boundingBox();
    const spot = { x: Math.min(body.x + 400, 900), y: body.y + 200 };
    const dragFile = async (file) => {
      const box = await finder
        .getByRole("option", { name: file, exact: true })
        .first()
        .boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 4 });
      await page.mouse.move(spot.x, spot.y, { steps: 12 });
      await page.mouse.up();
    };
    const raiseFinder = async () => {
      await page
        .getByRole("toolbar", { name: "Dock" })
        .getByRole("button", { name: "Finder" })
        .click();
      await sleep(250);
    };
    await raiseFinder();
    await dragFile(text);
    const alert = page.getByRole("alertdialog");
    const refused = await until(
      async () => /Font Book takes font files/.test(await alert.innerText().catch(() => "")),
      4_000,
    );
    if (refused) await alert.getByRole("button").first().click();
    await raiseFinder();
    await dragFile(`${name}.ttf`);
    const installed = await titled(page, name);
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "Finder" })
      .click();
    await finder.getByRole("button", { name: "Close", exact: true }).first().click();
    return {
      ok: refused && installed,
      detail: `text file refused with the reason=${refused}; font installed=${installed}`,
    };
  },
  {
    timeout: 60_000,
    ...m(
      "region",
      "A font file dropped from Finder",
      "drag a text file, then a font file, from Finder onto Font Book",
      "the text file is refused with the reason and the font installs",
    ),
  },
);
row(
  "font-book.drag-out",
  async ({ page, ctx }) => {
    await fontBook(page);
    await treeItem(page, "User").click();
    const target = await fontRow(page, ctx.data.font);
    const box = await target.boundingBox();
    const frame = await win(page).boundingBox();
    await drag(
      page,
      box.x + 40,
      box.y + box.height / 2,
      Math.min(frame.x + frame.width + 60, 1420),
      Math.min(frame.y + frame.height / 2, 500),
    );
    const onDesktop = await until(
      async () =>
        (await driveEntries(page)).some(
          (each) => each.parent === "desktop" && each.name === `${ctx.data.font}.ttf`,
        ),
      8_000,
      300,
    );
    const stillAdded = (await grid(page).innerText()).includes(ctx.data.font);
    await treeItem(page, "All Fonts").click();
    return {
      ok: onDesktop && stillAdded,
      detail: `copy on the desktop=${onDesktop}; the font stays=${stillAdded}`,
    };
  },
  m(
    "row",
    "An added font dragged out",
    "drag an added font's row to the desktop",
    "a copy of its file lands on the desktop and the font stays installed",
  ),
);
row(
  "font-book.edit-footer",
  async ({ page }) => {
    await fontBook(page);
    const dictation = await menuState(page, "Edit", "Start Dictation…");
    const emoji = await menuState(page, "Edit", "Emoji & Symbols");
    return {
      ok: dictation?.disabled === true && emoji?.disabled === false,
      detail: `dictation=${JSON.stringify(dictation)} emoji=${JSON.stringify(emoji)}`,
    };
  },
  m(
    "menuitem",
    "Start Dictation…",
    "open Edit",
    "Start Dictation shows dimmed and Emoji & Symbols is available",
  ),
);
row(
  "font-book.restore",
  async ({ page }) => {
    await fontBook(page);
    await treeItem(page, "All Fonts").click();
    await (await fontRow(page, "PT Mono")).click();
    await win(page).getByRole("button", { name: "Disable “PT Mono”" }).click();
    await chooseMenu(page, "File", "Restore Standard Fonts…");
    const alert = page.getByRole("alertdialog");
    await alert.waitFor({ timeout: 4_000 });
    const asks = (await alert.innerText()).includes("Fonts (Removed)");
    await alert.getByRole("button", { name: "Proceed" }).click();
    const answered = await until(
      async () => /moved to “Fonts \(Removed\)”/.test(await alert.innerText().catch(() => "")),
      8_000,
    );
    if (answered) await alert.getByRole("button", { name: "OK" }).click();
    const entries = await driveEntries(page);
    const inFolder = (name) => {
      const folder = entries.find((each) => each.name === name && each.parent === "documents");
      return entries.filter((each) => each.parent === folder?.id && !each.trashed_ms).length;
    };
    const moved = inFolder("Fonts (Removed)");
    const left = inFolder("Fonts");
    const on = await until(
      () => win(page).getByRole("button", { name: "Disable “PT Mono”" }).isVisible(),
      3_000,
    );
    await treeItem(page, "User").click();
    const empty = await until(
      () => page.getByRole("region", { name: /^User \(0 Fonts\)$/ }).isVisible(),
      3_000,
    );
    await treeItem(page, "All Fonts").click();
    return {
      ok: asks && answered && moved > 0 && left === 0 && on && empty,
      detail: `asks=${asks} answered=${answered} moved=${moved} left in Fonts=${left} PT Mono on=${on} User empty=${empty}`,
    };
  },
  m(
    "menuitem",
    "Restore Standard Fonts…",
    "disable a font, choose File > Restore Standard Fonts…, Proceed",
    "the added fonts' files move to Fonts (Removed) on the drive and every font turns on",
  ),
);
row(
  "font-book.disable-enable",
  async ({ page, ctx }) => {
    await fontBook(page);
    await win(page).getByRole("treeitem", { name: "All Fonts" }).click();
    const target = await fontRow(page, "Verdana");
    await target.click();
    const disable = win(page).getByRole("button", { name: "Disable “Verdana”" });
    await disable.click();
    const confirm = page
      .getByRole("alertdialog")
      .or(page.getByRole("dialog"))
      .filter({ hasText: /Disable/ })
      .last();
    if (await confirm.isVisible().catch(() => false))
      await confirm.getByRole("button", { name: /^Disable$/ }).click();
    const disabled = await until(
      async () => ((await library(page)).disabled ?? []).includes("verdana"),
      6_000,
      300,
    );
    const enable = win(page).getByRole("button", { name: "Enable “Verdana”" });
    const flipped = await until(() => enable.isVisible(), 3_000);
    keep({ ...(kept() ?? {}), account: ctx.account, disabled: "verdana" });
    return {
      ok: disabled && flipped,
      detail: `saved disabled=${disabled}; button reads Enable=${flipped}`,
    };
  },
  m(
    "button",
    "/(Disable|Enable) “.+”/",
    "select Verdana, click Disable “Verdana”",
    "Verdana is disabled and saved; the button turns to Enable",
    [["button", "/(Disable|Enable) “.+”/", /toolbar/]],
    { persists: "reload+restart", notes: "one button whose name follows the selected family" },
  ),
);
row(
  "font-book.add-collection",
  async ({ page, ctx }) => {
    await fontBook(page);
    await win(page).getByRole("button", { name: "Add Collection" }).click();
    const item = win(page)
      .getByRole("treeitem", { name: /^New Collection/ })
      .first();
    const shown = await until(() => item.isVisible(), 3_000);
    const saved = await until(
      async () =>
        ((await library(page)).collections ?? []).some((each) => /^New Collection/.test(each.name)),
      6_000,
      300,
    );
    keep({ ...(kept() ?? {}), account: ctx.account, collection: true });
    return { ok: shown && saved, detail: `shown=${shown} saved=${saved}` };
  },
  m(
    "button",
    "Add Collection",
    "click Add Collection",
    "a New Collection appears and is saved",
    [["button", "Add Collection", /region:/]],
    { persists: "reload+restart" },
  ),
);
row(
  "font-book.persist.reload",
  async ({ page }) => {
    await reload(page);
    await fontBook(page);
    const collection = await until(
      () =>
        win(page)
          .getByRole("treeitem", { name: /^New Collection/ })
          .first()
          .isVisible(),
      5_000,
    );
    await win(page).getByRole("treeitem", { name: "All Fonts" }).click();
    await (await fontRow(page, "Verdana")).click();
    const enable = await until(
      () => win(page).getByRole("button", { name: "Enable “Verdana”" }).isVisible(),
      3_000,
    );
    return {
      ok: collection && enable,
      detail: `collection kept=${collection}; Verdana still disabled=${enable}`,
    };
  },
  m(
    "treeitem",
    "New Collection (after reload)",
    "reload the page",
    "the collection and the disabled font are kept",
    [],
    { persists: "reload" },
  ),
);
row(
  "font-book.persist.restart",
  async ({ page }) => {
    const lib = await library(page);
    await fontBook(page);
    const collection = await until(
      () =>
        win(page)
          .getByRole("treeitem", { name: /^New Collection/ })
          .first()
          .isVisible(),
      6_000,
    );
    return {
      ok: collection && (lib.disabled ?? []).includes("verdana"),
      detail: `after a real server restart: collection=${collection} disabled=${JSON.stringify(lib.disabled)}`,
    };
  },
  {
    phases: ["restart-check"],
    ...m(
      "treeitem",
      "New Collection (after restart)",
      "sign in again after the server restarted",
      "the collection and the disabled font are kept",
      [],
      { persists: "restart" },
    ),
  },
);
row(
  "font-book.enable",
  async ({ page }) => {
    await fontBook(page);
    await win(page).getByRole("treeitem", { name: "All Fonts" }).click();
    await (await fontRow(page, "Verdana")).click();
    await win(page).getByRole("button", { name: "Enable “Verdana”" }).click();
    const enabled = await until(
      async () => !((await library(page)).disabled ?? []).includes("verdana"),
      6_000,
      300,
    );
    // The restart check needs Verdana disabled: disable it again and wait for that save.
    await win(page).getByRole("button", { name: "Disable “Verdana”" }).click();
    const confirm = page
      .getByRole("alertdialog")
      .or(page.getByRole("dialog"))
      .filter({ hasText: /Disable/ })
      .last();
    if (await confirm.isVisible().catch(() => false))
      await confirm.getByRole("button", { name: /^Disable$/ }).click();
    const restored = await until(
      async () => ((await library(page)).disabled ?? []).includes("verdana"),
      6_000,
      300,
    );
    return {
      ok: enabled && restored,
      detail: `enabled and saved=${enabled}; disabled again for the restart check=${restored}`,
    };
  },
  m("button", "Enable “Verdana”", "click Enable “Verdana”", "Verdana is enabled again and saved"),
);
row(
  "font-book.isolation.second-account",
  async ({ ctx }) => {
    const other = await otherAccount(ctx, "fbiso");
    try {
      const lib = await library(other.page);
      const leaked = (lib.collections ?? []).some((each) => /^New Collection/.test(each.name));
      return {
        ok: !leaked,
        detail: `the second account sees the first's New Collection=${leaked}`,
      };
    } finally {
      await other.close();
    }
  },
  m(
    "treeitem",
    "Collections (another account)",
    "a second account signs up",
    "it does not see the first account's collection",
  ),
);

appRows(row, {
  P: "font-book",
  app: "Font Book",
  state: S,
  open: fontBook,
  gone: async (page) =>
    !(await win(page)
      .isVisible()
      .catch(() => false)),
  windowItem: null,
  fullScreen: true,
  windowMenu: true,
  help: true,
});

await run({
  beforeEach: async ({ page }) => {
    await tidy(page);
  },
});
