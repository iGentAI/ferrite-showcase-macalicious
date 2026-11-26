#!/usr/bin/env node
// Finder census (R3, round 3 brief section 5): the person's drive in Finder. The sidebar (every place and tag), the path
// bar, the four views and the icon size, Group, sorting in the list view, search, every command of the Action menu (New
// Folder, Upload Files…, New Tab, Get Info, Quick Look, Download, Rename…, Duplicate, Move to Trash, Put Back, Copy, Paste,
// Move Item Here, Go to Folder…, Connect to Server…, Empty Trash…, the path and status bars), the keyboard equivalents,
// Get Info (its dimmed Stationery, Locked and Hide extension flags and their reasons, Comments, Open with, Sharing &
// Permissions), opening a file in the right app, Quick Look, drag and drop into a folder, onto the sidebar, between two
// windows and onto the Dock's Trash, the Share and Edit Tags menus, everything read back from the server (/api/files/),
// kept across a reload and a real same-root restart and invisible to a second account, and the menus and the window's
// chrome, each with real input and an asserted outcome.
//
//   node e2e/finder-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url http://127.0.0.1:8080]
//        [--phase all|write|restart-check --state <file.json>] [--explore <seconds>] [--seed <n>] [--headed]
//   node e2e/finder-census-journey.mjs --emit-census <finder.tsv>

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sameDownloadName } from "./journey-kit.mjs";
import {
  api,
  availableOrReason,
  bringToFront,
  census,
  choose,
  closeMenus,
  closeWindow,
  explore,
  goApplicationsChecks,
  goRows,
  install,
  menuState,
  newAccount,
  openApp,
  R,
  reload,
  standardChecks,
  standardRows,
  titleBarSpot,
  until,
} from "./r3-census-kit.mjs";

const FILE = "finder-census-journey.mjs";
const APP = "Finder";
const W = "Finder window";
const AM = "menu: Action";
const GI = "Get Info window";
const MENUS = ["Finder", "File", "Edit", "View", "Go", "Window", "Help"];
const PLACES = ["Recents", "Applications", "Desktop", "Documents", "Downloads"];
const HOME = ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"];
const TAGS = ["Red", "Orange", "Green", "Blue", "Gray", "Work", "Home"];
const VIEWS = ["Icons", "List", "Columns", "Gallery"];
const KEYS = [
  ["space", "Space", "Quick Look of the selected file"],
  ["get-info", "⌘I", "Get Info of the selected file"],
  ["quick-look", "⌘Y", "Quick Look of the selected file"],
  ["find", "⌘F", "the search field takes the keyboard"],
  ["back", "⌘[", "the previous folder"],
  ["forward", "⌘]", "the next folder"],
  ["enclosing", "⌘↑", "the folder that holds this one"],
  ["trash", "⌘⌫", "the selected file goes to the Trash"],
  ["copy-paste", "⌘C ⌘V", "a copy of the file in the folder shown"],
  ["move-here", "⌥⌘V", "the copied file moves into the folder shown"],
];
const DRIVE = "/api/files/";
const slug = (t) => t.toLowerCase().replace(/\W+/g, "-");

const rows = [
  R(
    "finder.window.open",
    W,
    "app",
    APP,
    "Spotlight: type Finder, Return",
    "a Finder window on the person's home folder: its six folders, read from the server",
  ),
  R(
    "finder.sidebar.airdrop",
    W,
    "treeitem",
    "AirDrop",
    "click",
    "AirDrop's view, which says honestly that a web page cannot reach nearby devices",
  ),
  ...PLACES.map((p) =>
    R(`finder.sidebar.${slug(p)}`, W, "treeitem", p, `click ${p}`, `the window shows ${p}`),
  ),
  R(
    "finder.sidebar.computer",
    W,
    "treeitem",
    "/^(?!AirDrop$|Recents$|Applications$|Desktop$|Documents$|Downloads$|Red$|Orange$|Green$|Blue$|Gray$|Work$|Home$|All Tags…$).+/",
    "click the computer under Locations",
    "the computer's disks",
    "none",
    "kind: the sidebar's Locations entry (the computer's name)",
  ),
  ...TAGS.map((t) =>
    R(
      `finder.sidebar.tag.${slug(t)}`,
      W,
      "treeitem",
      t,
      `click the ${t} tag`,
      `the files tagged ${t}`,
    ),
  ),
  R(
    "finder.sidebar.all-tags",
    W,
    "treeitem",
    "All Tags…",
    "click",
    "every tag is shown, or it does what it says",
  ),
  R(
    "finder.sidebar.divider",
    W,
    "separator",
    "Resize sidebar",
    "drag right",
    "the sidebar gets wider",
  ),
  R(
    "finder.item.option",
    W,
    "option",
    "/^R3 .+/",
    "click, double-click",
    "selected; a folder opens, a file opens in its app",
    "none",
    "kind: this run's own files and folders in the list (first, middle and last clicked)",
  ),
  R(
    "finder.item.home-folder",
    W,
    "option",
    "/^(Desktop|Documents|Downloads|Movies|Music|Pictures)$/",
    "double-click",
    "the folder opens",
    "none",
    "kind: the six home folders",
  ),
  R("finder.path.disk", W, "button", "Macintosh SSD", "click in the path bar", "the disk's folder"),
  R("finder.path.users", W, "button", "Users", "click in the path bar", "the Users folder"),
  R(
    "finder.path.home",
    W,
    "button",
    "/^[a-z0-9]+$/",
    "click in the path bar",
    "the home folder",
    "none",
    "kind: the home folder's button (the account's name)",
  ),
  R("finder.toolbar.back", W, "button", "Back", "after two folders, click", "the previous folder"),
  R("finder.toolbar.forward", W, "button", "Forward", "after Back, click", "the next folder"),
  ...VIEWS.map((v) =>
    R(
      `finder.view.${slug(v)}`,
      W,
      "button",
      v,
      `click ${v}`,
      `pressed; the folder shows as ${v.toLowerCase()}`,
      "reload",
    ),
  ),
  R(
    "finder.view.icon-size",
    W,
    "slider",
    "Icon size",
    "press the right arrow on it",
    "the icons get larger",
  ),
  R(
    "finder.view.sort",
    W,
    "columnheader",
    "/^(Name|Date Modified|Size|Kind)$/",
    "click a column of the list view",
    "the files sort by it",
    "none",
    "kind: the list view's column headers; Name and Size checked",
  ),
  R(
    "finder.toolbar.group",
    W,
    "button",
    "Group",
    "choose Name, then Kind",
    "Kind is checked and the items move to the sections of their kinds",
  ),
  R(
    "finder.search",
    W,
    "searchbox",
    "Search",
    "type part of a file's name",
    "the files whose names match",
  ),
  R("finder.toolbar.action", W, "button", "Action", "click", "its menu opens"),
  R(
    "finder.toolbar.action.escape",
    AM,
    "shortcut",
    "Escape",
    "with the Action menu open, press Escape",
    "the menu closes",
  ),
  R(
    "finder.action.new-folder",
    AM,
    "menuitem",
    "New Folder",
    "choose",
    "an untitled folder on the server, listed",
    "restart",
  ),
  R(
    "finder.action.upload",
    AM,
    "menuitem",
    "Upload Files…",
    "choose, pick a 600 KB file in the file chooser",
    "uploaded in pieces under 256 KiB, the bytes on the server",
    "restart",
  ),
  R("finder.action.new-tab", AM, "menuitem", "New Tab", "choose", "a second tab"),
  R(
    "finder.action.get-info",
    AM,
    "menuitem",
    "Get Info",
    "choose with a file selected",
    "its Info window",
  ),
  R(
    "finder.action.quick-look",
    AM,
    "menuitem",
    "/^Quick Look.*/",
    "choose with a text file selected",
    "Quick Look shows its text, read from the drive",
    "none",
    "kind: Quick Look “<the selected file>”",
  ),
  R(
    "finder.action.download",
    AM,
    "menuitem",
    "Download",
    "choose with a file selected",
    "the browser saves the same bytes",
  ),
  R(
    "finder.action.rename",
    AM,
    "menuitem",
    "Rename",
    "choose, type a name, Return",
    "renamed on the server",
    "restart",
  ),
  R(
    "finder.action.duplicate",
    AM,
    "menuitem",
    "Duplicate",
    "choose",
    "a copy beside it, taking no more space",
  ),
  R(
    "finder.action.copy",
    AM,
    "menuitem",
    "/^Copy .+/",
    "choose",
    "the file is on Finder's clipboard: Paste and Move Item Here are offered",
    "none",
    "kind: Copy “<the selected file>”",
  ),
  R(
    "finder.action.paste",
    AM,
    "menuitem",
    "/^Paste.*/",
    "in another folder, choose",
    "a copy there; the original stays",
    "none",
    "kind: Paste Item / Paste n Items",
  ),
  R(
    "finder.action.move-here",
    AM,
    "menuitem",
    "/^Move (Item|\\d+ Items) Here$/",
    "in another folder, choose",
    "the file moves there, on the server",
    "none",
    "kind: Move Item Here / Move n Items Here",
  ),
  R(
    "finder.action.trash",
    AM,
    "menuitem",
    "Move to Trash",
    "choose",
    "the file is in the Trash on the server",
  ),
  R(
    "finder.action.go-to-folder",
    AM,
    "menuitem",
    "Go to Folder…",
    "choose, type ~/.Trash, Go",
    "the Trash is shown",
  ),
  R(
    "finder.action.put-back",
    AM,
    "menuitem",
    "Put Back",
    "in the Trash, choose",
    "the file returns to where it was",
  ),
  R(
    "finder.action.connect",
    AM,
    "menuitem",
    "Connect to Server…",
    "choose",
    "its dialog, which says honestly what a web page can connect to, or works",
  ),
  R(
    "finder.action.empty-trash",
    AM,
    "menuitem",
    "Empty Trash…",
    "choose; Cancel, then Empty Trash",
    "Cancel keeps the Trash; Empty Trash deletes what is in it on the server (space shared with other copies stays in use)",
  ),
  R(
    "finder.action.path-bar",
    AM,
    "menuitem",
    "/^(Show|Hide) Path Bar$/",
    "choose twice",
    "the path bar hides and shows",
    "none",
    "kind: the path bar's toggle",
  ),
  R(
    "finder.action.status-bar",
    AM,
    "menuitem",
    "/^(Show|Hide) Status Bar$/",
    "choose twice",
    "the status bar hides and shows",
    "none",
    "kind: the status bar's toggle",
  ),
  R("finder.dialog.rename", "the item's name", "textbox", "Name", "type", "used by Rename"),
  R(
    "finder.dialog.empty-trash.cancel",
    "Empty Trash alert",
    "button",
    "Cancel",
    "click",
    "the Trash is kept",
  ),
  R(
    "finder.dialog.empty-trash.empty",
    "Empty Trash alert",
    "button",
    "Empty Trash",
    "click",
    "the Trash is emptied on the server",
  ),
  R(
    "finder.dialog.go",
    "Go to Folder dialog",
    "combobox",
    "the folder",
    "type ~/.Trash",
    "Go shows it",
  ),
  ...KEYS.map(([id, key, what]) => R(`finder.kb.${id}`, W, "shortcut", key, `press ${key}`, what)),
  R(
    "finder.info.window",
    GI,
    "window",
    "<file> Info",
    "Get Info on a file",
    "its name, kind, size, where it is and when it was modified",
  ),
  R(
    "finder.info.tags",
    GI,
    "textbox",
    "Tags",
    "type a tag, Return",
    "the file is tagged, on the server",
    "restart",
  ),
  R(
    "finder.info.stationery",
    GI,
    "checkbox",
    "/^Stationery [Pp]ad$/",
    "look",
    "dimmed with its reason shown, or it can be switched",
    "none",
    "kind: the General flag Stationery pad",
  ),
  R(
    "finder.info.locked",
    GI,
    "checkbox",
    "Locked",
    "look",
    "dimmed with its reason shown, or it can be switched",
  ),
  R(
    "finder.info.name",
    GI,
    "textbox",
    "Name & Extension",
    "look; type a new name, Return",
    "the item's name: renamed on Return, or read-only with its reason shown (Rename… renames)",
  ),
  R(
    "finder.info.hide-extension",
    GI,
    "checkbox",
    "/^Hide extension$/",
    "look",
    "dimmed with its reason shown, or it can be switched",
    "none",
    "kind: the Name & Extension flag",
  ),
  R(
    "finder.info.comments",
    GI,
    "textbox",
    "Comments",
    "type",
    "kept with the file, or says it is not kept",
  ),
  R(
    "finder.info.open-with",
    GI,
    "combobox",
    "Open with",
    "open the Open with section; choose another app",
    "names the app that opens the file; another is kept, or it is dimmed with its reason shown",
  ),
  R(
    "finder.info.sharing",
    GI,
    "grid",
    "Sharing & Permissions",
    "look",
    "who can read and write, honestly the person alone",
  ),
  R(
    "finder.info.add-group",
    GI,
    "button",
    "Add a group",
    "look",
    "dimmed with its reason, or adds one",
  ),
  R(
    "finder.info.remove-group",
    GI,
    "button",
    "Remove the selected user or group",
    "look",
    "dimmed with its reason, or removes one",
  ),
  R("finder.info.close", GI, "button", "Close", "click", "the Info window closes"),
  R("finder.open.text", W, "option", "a text file", "double-click", "TextEdit opens it"),
  R("finder.open.picture", W, "option", "a PNG picture", "double-click", "Preview opens it"),
  R(
    "finder.quicklook.open",
    "Quick Look window",
    "button",
    "/^Open with .+/",
    "Space on a picture, click its Open button",
    "Preview opens the picture (dimmed when no application opens the file)",
    "none",
    "kind: Quick Look's Open with <the application> button",
  ),
  R(
    "finder.quicklook.window",
    "Quick Look window",
    "window",
    "Quick Look",
    "Space on a text file",
    "its text; Close closes it",
  ),
  R(
    "finder.drag.refused",
    W,
    "option",
    "a folder onto itself; a picture onto a file",
    "drag with the pointer",
    "refused: nothing moves, and the window says why",
  ),
  R(
    "finder.drag.folder",
    W,
    "option",
    "a file onto a folder",
    "drag with the pointer",
    "the file is in that folder, on the server",
  ),
  R(
    "finder.drag.sidebar",
    W,
    "treeitem",
    "a file onto Documents in the sidebar",
    "drag with the pointer",
    "the file is in Documents, on the server",
  ),
  R(
    "finder.drag.windows",
    W,
    "option",
    "a file into a second Finder window",
    "drag with the pointer",
    "the file is in that window's folder, on the server",
  ),
  R(
    "finder.drag.dock-trash",
    "Dock",
    "button",
    "Trash",
    "drag a file onto it",
    "the file is in the Trash, on the server",
  ),
  R(
    "finder.drag.from-computer",
    W,
    "drop target",
    "files from the computer",
    "drag files from the computer's own file manager",
    "n/a: Playwright cannot drag from the operating system; Upload Files… through the file chooser is verified instead",
  ),
  R(
    "finder.toolbar.share",
    W,
    "button",
    "Share",
    "with a file selected",
    "its menu of destinations, each working or dimmed with its reason; or, where the desktop gives Finder no share destination, dimmed with its reason shown",
  ),
  R(
    "finder.toolbar.edit-tags",
    W,
    "button",
    "Edit Tags",
    "with a file selected, choose Red",
    "the file is tagged Red, on the server; the Red tag lists it",
    "restart",
  ),
  R(
    "finder.context-menu",
    W,
    "menu",
    "contextual menu",
    "right-click a file",
    "the menu of the file's commands",
  ),
  R(
    "finder.persist.reload",
    W,
    "drive",
    "this run's files",
    "reload, open Finder",
    "the same files in the same folders",
    "reload",
  ),
  R(
    "finder.isolation",
    W,
    "drive",
    "this run's files",
    "a second account",
    "none of them, on the server too",
  ),
  R(
    "finder.persist.restart",
    W,
    "drive",
    "this run's files",
    "after a real same-root restart, sign in, open Finder",
    "the same files, names, folders and tags",
    "restart",
    "",
    "restart-check",
  ),
  R(
    "finder.isolation-restart",
    W,
    "drive",
    "this run's files",
    "after the restart, the second account",
    "still none",
    "restart",
    "",
    "restart-check",
  ),
  R(
    "finder.menu.app.empty-trash",
    "menu:Finder",
    "menuitem",
    "Empty Trash…",
    "with something in the Trash, choose",
    "empties the Trash, or dimmed with its reason",
  ),
  ...goRows("finder").map((r) =>
    r.id === "finder.menu.go.applications"
      ? {
          ...r,
          how: "with a Finder window, choose; with none, hover",
          expect:
            "with a window, the Applications folder; with none, Finder's menu bar has the launcher submenu",
        }
      : r.id.startsWith("finder.menu.go.app.")
        ? { ...r, how: `with no Finder window, ${r.how}` }
        : r,
  ),
  ...standardRows("finder", APP, {
    menus: MENUS,
    windowItem: "Finder",
  }).map((r) =>
    r.id === "finder.menu.app.quit"
      ? {
          ...r,
          how: "open the Finder menu",
          expect: "no Quit row, as on a Mac: Finder always runs, and its window stays",
        }
      : r,
  ),
];

const S = census(APP, { id: "finder", file: FILE, rows });

/** A 1 x 1 red PNG, a real picture. */
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const sha = (b) => createHash("sha256").update(b).digest("hex");

await S.run(async ({ person, check, opts, state, saveState, problem, note, guard }) => {
  const drive = async (page) => (await api(page, "GET", DRIVE)).json ?? { entries: [] };
  const live = async (page) =>
    (await drive(page)).entries?.filter((e) => e.trashed_ms === undefined) ?? [];
  const named = async (page, name) => (await live(page)).find((e) => e.name === name);
  const trashed = async (page, id) =>
    (await drive(page)).entries?.find((e) => e.id === id && e.trashed_ms !== undefined);
  const _fw = (page, n = 0) => page.locator(".mac-window.mac-finder").nth(n);
  const item = (win, name) => win.getByRole("option", { name, exact: true }).first();
  const side = (win, name) => win.getByRole("treeitem", { name, exact: true }).first();
  const listName = async (win) =>
    (
      (await win
        .getByRole("listbox")
        .first()
        .getAttribute("aria-label")
        .catch(() => "")) ?? ""
    ).trim();
  const shows = (win, name, ms = 6_000) => until(async () => (await listName(win)) === name, ms);
  const settled = (page) =>
    page
      .waitForFunction(
        () =>
          [...document.querySelectorAll(".mac-finder")].every(
            (e) => e.getAttribute("aria-busy") !== "true",
          ),
        undefined,
        { timeout: 15_000 },
      )
      .catch(() => {});
  /** Chooses `label` (string or RegExp) in the Action menu; answers false when it is dimmed (the menu is closed). */
  const action = async (page, win, label) => {
    await win.getByRole("button", { name: "Action", exact: true }).click();
    const it = page
      .getByRole(
        "menuitem",
        typeof label === "string" ? { name: label, exact: true } : { name: label },
      )
      .first();
    if (
      !(await it.waitFor({ timeout: 5_000 }).then(
        () => true,
        () => false,
      ))
    ) {
      await page.keyboard.press("Escape");
      return null;
    }
    if ((await it.getAttribute("aria-disabled")) === "true") {
      await page.keyboard.press("Escape");
      return false;
    }
    await it.click();
    return true;
  };
  let escapeLeftOpen = false;
  const actionLabels = async (page, win) => {
    await win.getByRole("button", { name: "Action", exact: true }).click();
    const menu = page.getByRole("menu").last();
    await menu.waitFor({ timeout: 5_000 });
    const labels = await menu.locator('[role^="menuitem"]').evaluateAll((es) =>
      es.map((e) => ({
        text: (e.querySelector(".mac-menu-item-title")?.textContent ?? e.textContent ?? "").trim(),
        disabled: e.getAttribute("aria-disabled") === "true",
      })),
    );
    // Escape once the menu has opened and taken the keyboard, as a person presses it (pressed while
    // the menu is still opening, before focus moves into it, Escape finds nothing to close).
    const newFolder = page.getByRole("menuitem", { name: "New Folder", exact: true });
    await newFolder.waitFor({ timeout: 5_000 }).catch(() => {});
    await until(
      () => page.evaluate(() => !!document.activeElement?.closest('[role="menu"]')),
      3_000,
    );
    await page.keyboard.press("Escape");
    if (!(await until(async () => !(await newFolder.isVisible().catch(() => false)), 2_000))) {
      escapeLeftOpen = true;
      await win
        .getByRole("button", { name: "Action", exact: true })
        .click()
        .catch(() => {});
      await closeMenus(page);
    }
    return labels;
  };
  const open = async (page) => {
    const w = await openApp(page, APP, "mac-finder");
    await settled(page);
    return w;
  };
  const goTo = async (win, place) => {
    await side(win, place).click();
    await shows(win, place);
  };
  const select = async (win, name) => {
    const o = item(win, name);
    await o.waitFor({ timeout: 10_000 });
    await o.click();
    return o;
  };

  /**
   * Drags `from` onto `to` with the pointer in small steps, resting over the target, so that HTML
   * drag and drop sees dragenter and dragover there before the drop.
   */
  const pointerDrag = async (page, from, to) => {
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    if (!a || !b) throw new Error("drag: the source or the target is not shown");
    // A window may hang past the screen's edge: the drop lands on the part of the target that shows.
    const toX = Math.min(b.x + b.width / 2, page.viewportSize().width - 20);
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 4 });
    await page.mouse.move(toX, b.y + b.height / 2, { steps: 12 });
    await page.waitForTimeout(300);
    await page.mouse.move(toX + 2, b.y + b.height / 2 + 2, { steps: 2 });
    await page.mouse.up();
  };

  if (opts.phase === "restart-check") {
    const a = await person("A", { signIn: state.a });
    const win = await open(a);
    const now = await live(a);
    const want = state.kept ?? [];
    const missing = want.filter(
      (k) =>
        !now.some(
          (e) =>
            e.id === k.id &&
            e.name === k.name &&
            e.parent === k.parent &&
            JSON.stringify(e.tags ?? []) === JSON.stringify(k.tags ?? []),
        ),
    );
    await goTo(win, "Desktop");
    const shown = await until(async () => (await item(win, state.desktopFile).count()) > 0, 8_000);
    check(
      "finder.persist.restart",
      missing.length === 0 && !!shown,
      missing.length
        ? `missing or changed: ${missing.map((m) => m.name).join(", ")}`
        : `${want.length} entries as they were; ${state.desktopFile} listed on the Desktop`,
    );
    const b = await person("B", { signIn: state.b });
    const theirs = await live(b);
    check(
      "finder.isolation-restart",
      !theirs.some((e) => want.some((k) => k.id === e.id || k.name === e.name)),
      `${theirs.length} entries for the second account, none of the first's`,
    );
    return;
  }

  const aAcct = newAccount("fnda", opts.browserName);
  const bAcct = newAccount("fndb", opts.browserName);
  const RUN = aAcct.name;
  const N = {
    big: `R3 notes ${RUN}.txt`,
    renamed: `R3 field notes ${RUN}.txt`,
    copy: `R3 field notes ${RUN} copy.txt`,
    picture: `R3 picture ${RUN}.png`,
    folder: `R3 folder ${RUN}`,
  };
  const marker = `Macalicious R3 Finder census ${RUN}`;
  const lines = [marker];
  for (let n = 1; lines.join("\n").length < 600_000; n += 1)
    lines.push(`Line ${n}: the quick brown fox jumps over the lazy dog, ${RUN}.`);
  const BIG = Buffer.from(`${lines.join("\n")}\n`);
  const page = await person("A", { create: aAcct });
  saveState({ a: aAcct, b: bAcct });
  // Preview opens pictures (it comes from the App Store; setup).
  await install(page, ["preview"]);
  let win = await open(page);
  const ensure = async () => {
    if ((await win.count()) > 0 && (await win.isVisible().catch(() => false)))
      await bringToFront(page, win, APP);
    else win = await open(page);
  };

  await guard("window, sidebar, path bar", page, async () => {
    const homeOpts = (await win.getByRole("option").allInnerTexts()).map((t) => t.trim());
    const fresh = await live(page);
    check(
      "finder.window.open",
      HOME.every((h) => homeOpts.includes(h)) && fresh.filter((e) => !e.parent).length === 6,
      `${homeOpts.join(", ")}; ${fresh.length} entries on the server`,
    );
    for (const p of PLACES) {
      await side(win, p).click();
      const ok = await shows(win, p);
      check(
        `finder.sidebar.${slug(p)}`,
        !!ok,
        ok ? `shows ${p}` : `the list is ${await listName(win)}`,
      );
    }
    await side(win, "AirDrop").click();
    await page.waitForTimeout(600);
    const air = (await win.innerText()).replace(/\s+/g, " ");
    check(
      "finder.sidebar.airdrop",
      /AirDrop/.test(air) && /(can.t|cannot|not available|web page|nearby)/i.test(air),
      air.slice(0, 160),
    );
    const trees = (await win.getByRole("treeitem").allInnerTexts()).map((t) => t.trim());
    const computer = trees.find(
      (t) => !["AirDrop", ...PLACES, ...TAGS, "All Tags…", "iCloud Drive"].includes(t),
    );
    if (computer) {
      await side(win, computer).click();
      await page.waitForTimeout(600);
    }
    check(
      "finder.sidebar.computer",
      !!computer &&
        ((await listName(win)) === computer || (await win.innerText()).includes("Macintosh SSD")),
      `${computer}: the list is ${await listName(win)}`,
    );
    for (const t of TAGS) {
      await side(win, t).click();
      const ok = await shows(win, t, 4_000);
      check(
        `finder.sidebar.tag.${slug(t)}`,
        !!ok,
        ok ? `the files tagged ${t}` : `the list is ${await listName(win)}`,
      );
    }
    await side(win, "All Tags…").click();
    await page.waitForTimeout(600);
    const allTags = (await win.innerText()).replace(/\s+/g, " ");
    check(
      "finder.sidebar.all-tags",
      (await listName(win)) !== TAGS.at(-1) || /Tags/.test(allTags),
      `the list is ${await listName(win)}`,
    );
    await page.keyboard.press("Escape");
    // Path bar: from Documents, Users, then the disk, then home.
    await goTo(win, "Documents");
    const path = win.getByRole("group", { name: "Path" }).or(win.locator(".mac-path-bar")).first();
    const crumbs = (await path.getByRole("button").allInnerTexts()).map((t) => t.trim());
    const home = crumbs.find((c) => !["Macintosh SSD", "Users", "Documents"].includes(c)) ?? "";
    await path.getByRole("button", { name: "Users", exact: true }).dblclick();
    check("finder.path.users", !!(await shows(win, "Users")), `the list is ${await listName(win)}`);
    await goTo(win, "Documents");
    await path.getByRole("button", { name: "Macintosh SSD", exact: true }).dblclick();
    check(
      "finder.path.disk",
      !!(await shows(win, "Macintosh SSD")),
      `the list is ${await listName(win)}`,
    );
    await goTo(win, "Documents");
    await path.getByRole("button", { name: home, exact: true }).dblclick();
    const atHome = await shows(win, home);
    check(
      "finder.path.home",
      !!home && !!atHome,
      `${home}: the list is ${await listName(win)} (crumbs ${crumbs.join(" > ")})`,
    );
    // Back and Forward.
    await goTo(win, "Desktop");
    await goTo(win, "Downloads");
    await win.getByRole("button", { name: "Back", exact: true }).click();
    check(
      "finder.toolbar.back",
      !!(await shows(win, "Desktop")),
      `the list is ${await listName(win)}`,
    );
    await win.getByRole("button", { name: "Forward", exact: true }).click();
    check(
      "finder.toolbar.forward",
      !!(await shows(win, "Downloads")),
      `the list is ${await listName(win)}`,
    );
    // The sidebar's divider.
    const sep = win.getByRole("separator", { name: "Resize sidebar" }).first();
    const sb = await sep.boundingBox();
    const w0 = (await win.getByRole("tree").first().boundingBox())?.width ?? 0;
    if (sb) {
      await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await page.mouse.down();
      await page.mouse.move(sb.x + sb.width / 2 + 40, sb.y + sb.height / 2, { steps: 6 });
      await page.mouse.up();
    }
    const w1 = (await win.getByRole("tree").first().boundingBox())?.width ?? 0;
    check("finder.sidebar.divider", w1 > w0 + 20, `${Math.round(w0)} -> ${Math.round(w1)}`);
  });

  await guard("upload, new folder, files", page, async () => {
    await goTo(win, "Documents");
    const pieces = [];
    const onReq = (r) => {
      if (r.method() === "PUT" && r.url().includes("/api/files/uploads/"))
        pieces.push(r.postDataBuffer()?.length ?? 0);
    };
    page.on("request", onReq);
    const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
    await action(page, win, "Upload Files…");
    await (await chooser).setFiles([
      { name: N.big, mimeType: "text/plain", buffer: BIG },
      { name: N.picture, mimeType: "image/png", buffer: Buffer.from(PNG, "base64") },
    ]);
    await item(win, N.big).waitFor({ timeout: 30_000 });
    await item(win, N.picture).waitFor({ timeout: 30_000 });
    page.off("request", onReq);
    const up = await named(page, N.big);
    check(
      "finder.action.upload",
      up?.parent === "documents" &&
        up?.size === BIG.length &&
        pieces.length >= 4 &&
        pieces.every((s) => s <= 262_144),
      `${up?.size} of ${BIG.length} bytes in ${pieces.length} pieces, largest ${Math.max(0, ...pieces)}`,
    );
    const count0 = (await live(page)).length;
    await action(page, win, "New Folder");
    const made = await until(async () => (await live(page)).length > count0, 8_000);
    const folder = (await live(page)).find(
      (e) => e.parent === "documents" && /untitled folder/i.test(e.name),
    );
    check(
      "finder.action.new-folder",
      !!made && !!folder,
      folder ? `${folder.name} on the server` : "no folder",
    );
    // Rename the new folder in place.
    if (folder) {
      await select(win, folder.name);
      await action(page, win, "Rename");
      const d = win.getByRole("textbox", { name: "Name", exact: true });
      await d.waitFor({ timeout: 5_000 });
      await page.keyboard.press("Control+a");
      await page.keyboard.type(N.folder);
      check("finder.dialog.rename", (await d.inputValue()) === N.folder, "typed");
      await page.keyboard.press("Enter");
      await item(win, N.folder).waitFor({ timeout: 10_000 });
    }
    // Rename the text file.
    await select(win, N.big);
    await action(page, win, "Rename");
    const d2 = win.getByRole("textbox", { name: "Name", exact: true });
    await d2.waitFor({ timeout: 5_000 });
    await d2.fill(N.renamed);
    await d2.press("Enter");
    await item(win, N.renamed).waitFor({ timeout: 10_000 });
    const renamed = await named(page, N.renamed);
    check("finder.action.rename", renamed?.id === up?.id, `${renamed?.name} keeps its id`);
    // Duplicate.
    const usage0 = (await drive(page)).usage;
    await select(win, N.renamed);
    await action(page, win, "Duplicate");
    await item(win, N.copy).waitFor({ timeout: 15_000 });
    check(
      "finder.action.duplicate",
      (await named(page, N.copy))?.parent === "documents" && (await drive(page)).usage === usage0,
      `${N.copy}; ${(await drive(page)).usage} bytes used (was ${usage0})`,
    );
    saveState({
      ids: { big: up?.id, picture: (await named(page, N.picture))?.id, folder: folder?.id },
    });
  });

  await guard("views, icon size, group, sort, search", page, async () => {
    await goTo(win, "Documents");
    for (const v of VIEWS) {
      const b = win.getByRole("button", { name: v, exact: true }).first();
      await b.click();
      const pressed = await until(
        async () => (await b.getAttribute("aria-pressed")) === "true",
        4_000,
      );
      const shape = {
        Icons: async () => (await win.getByRole("slider", { name: "Icon size" }).count()) > 0,
        List: async () => (await win.getByRole("columnheader", { name: "Name" }).count()) > 0,
        Columns: async () =>
          (await win.getByRole("listbox").count()) >= 2 ||
          (await win.locator(".mac-column-view, [data-view=columns]").count()) > 0,
        Gallery: async () =>
          (await win.locator(".mac-gallery-view, [data-view=gallery]").count()) > 0 ||
          (await win.getByRole("img").count()) > 0,
      }[v];
      const looks = await until(shape, 4_000);
      check(
        `finder.view.${slug(v)}`,
        !!pressed && !!looks,
        `pressed ${!!pressed}; ${v.toLowerCase()} shown ${!!looks}`,
      );
      if (v === "List") {
        const nameHeader = win.getByRole("columnheader", { name: "Name" }).first();
        const order = async () =>
          (await win.getByRole("row").allInnerTexts())
            .map((t) => t.split("\n")[0].trim())
            .filter((t) => /^R3 /.test(t));
        const o0 = await order();
        await nameHeader.click();
        const s1 = await nameHeader.getAttribute("aria-sort");
        const o1 = await order();
        const sizeHeader = win.getByRole("columnheader", { name: "Size" }).first();
        await sizeHeader.click();
        const s2 = await sizeHeader.getAttribute("aria-sort");
        const o2 = await order();
        const sortedByName =
          JSON.stringify(o1) === JSON.stringify([...o1].sort((a, b) => a.localeCompare(b))) ||
          JSON.stringify(o1) === JSON.stringify([...o1].sort((a, b) => b.localeCompare(a)));
        check(
          "finder.view.sort",
          !!s1 &&
            s1 !== "none" &&
            sortedByName &&
            !!s2 &&
            s2 !== "none" &&
            JSON.stringify(o2) !== JSON.stringify(o1),
          `Name ${s1}: ${o1.join(" | ")}; Size ${s2}: ${o2.join(" | ")} (before ${o0.join(" | ")})`,
        );
      }
    }
    await win.getByRole("button", { name: "Icons", exact: true }).click();
    const slider = win.getByRole("slider", { name: "Icon size" });
    const v0 = Number((await slider.getAttribute("aria-valuenow")) ?? "0");
    const box0 = (await item(win, N.renamed).boundingBox())?.width ?? 0;
    await slider.focus();
    for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowRight");
    const v1 = Number((await slider.getAttribute("aria-valuenow")) ?? "0");
    const box1 = (await item(win, N.renamed).boundingBox())?.width ?? 0;
    check(
      "finder.view.icon-size",
      v1 > v0 && box1 > box0,
      `value ${v0} -> ${v1}; item ${Math.round(box0)} -> ${Math.round(box1)} pt`,
    );
    // Group: the sections of the key chosen. Name, then Kind: Kind is checked and the items move to the
    // sections of their kinds; None afterwards, for the steps that follow.
    const r3Order = async () =>
      (await win.getByRole("option").allInnerTexts())
        .map((t) => t.trim())
        .filter((t) => /^R3 /.test(t));
    const group = win.getByRole("button", { name: "Group", exact: true }).first();
    const pick = async (label) => {
      await group.click();
      const it = page
        .locator('[role="menu"][data-open]')
        .getByRole("menuitemradio", { name: label, exact: true })
        .first();
      const there = await it.waitFor({ timeout: 4_000 }).then(
        () => true,
        () => false,
      );
      if (there) await it.click();
      else await page.keyboard.press("Escape");
      return there;
    };
    await pick("Name");
    await page.waitForTimeout(400);
    const g0 = await r3Order();
    const offered = await pick("Kind");
    const g1 = await until(async () => {
      const o = await r3Order();
      return JSON.stringify(o) !== JSON.stringify(g0) ? o : null;
    }, 4_000);
    await group.click();
    const kindChecked =
      (await page
        .locator('[role="menu"][data-open]')
        .getByRole("menuitemradio", { name: "Kind", exact: true })
        .first()
        .getAttribute("aria-checked")
        .catch(() => null)) === "true";
    await closeMenus(page);
    await pick("None");
    check(
      "finder.toolbar.group",
      offered && !!g1 && kindChecked,
      `Kind checked ${kindChecked}; by name ${g0.join(" | ")} -> by kind ${(g1 ?? []).join(" | ")}`,
    );
    // Search.
    await win.getByRole("searchbox", { name: "Search" }).click();
    await page.keyboard.type("field notes");
    const found = await until(async () => {
      const names = (await win.getByRole("option").allInnerTexts())
        .map((t) => t.trim())
        .filter(Boolean);
      return names.length > 0 && names.every((n) => /field notes/i.test(n)) ? names : null;
    }, 10_000);
    check(
      "finder.search",
      !!found && found.includes(N.renamed),
      found ? found.join(" | ") : (await win.getByRole("option").allInnerTexts()).join(" | "),
    );
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Escape");
    await goTo(win, "Documents");
  });

  // Get Info: the window, its flags and their reasons, name, tags, comments, Open with, sharing.
  await guard("Get Info", page, async () => {
    await goTo(win, "Documents");
    await select(win, N.copy);
    await action(page, win, "Get Info");
    const info = page.locator(".mac-window").filter({ hasText: "Sharing & Permissions:" }).last();
    const shown = await until(() => info.isVisible(), 6_000);
    const text = shown ? (await info.innerText()).replace(/\s+/g, " ") : "";
    check("finder.action.get-info", !!shown, shown ? "its Info window opens" : "no Info window");
    check(
      "finder.info.window",
      !!shown &&
        text.includes(N.copy) &&
        /Kind:/.test(text) &&
        /Size:/.test(text) &&
        /Where:/.test(text) &&
        /Modified:/.test(text),
      text.slice(0, 200),
    );
    const flag = async (id, name) => {
      const box = info.getByRole("checkbox", { name }).first();
      if ((await box.count()) === 0) return check(id, false, `no ${name} checkbox`);
      const dimmed =
        (await box.isDisabled().catch(() => false)) ||
        (await box.getAttribute("aria-disabled")) === "true";
      const why = (
        (await box.getAttribute("title")) ??
        (await box
          .locator("xpath=ancestor-or-self::*[@title][1]")
          .getAttribute("title")
          .catch(() => null)) ??
        (await box.getAttribute("aria-description")) ??
        ""
      ).trim();
      if (!dimmed) {
        const before = await box.isChecked();
        await box.click();
        // The server keeps the setting, and the box follows what it answers.
        const switched = await until(async () => (await box.isChecked()) !== before, 5_000);
        if (switched) {
          await box.click();
          await until(async () => (await box.isChecked()) === before, 5_000);
        }
        return check(id, !!switched, `switchable: ${before} -> ${!before}=${!!switched}`);
      }
      return check(id, why.length > 0, why ? `dimmed: ${why}` : "dimmed, no reason shown");
    };
    await flag("finder.info.stationery", /^Stationery [Pp]ad$/);
    await flag("finder.info.locked", /^Locked$/);
    await flag("finder.info.hide-extension", /^Hide extension$/);
    // Tags: a tag typed in the Info window.
    const tags = info
      .getByRole("textbox", { name: "Tags" })
      .or(info.getByRole("combobox", { name: "Tags" }))
      .first();
    await tags.click();
    await page.keyboard.type("Blue");
    await page.keyboard.press("Enter");
    const tagged = await until(
      async () => JSON.stringify((await named(page, N.copy)) ?? {}).includes("Blue"),
      6_000,
    );
    check(
      "finder.info.tags",
      !!tagged,
      tagged
        ? "tagged Blue on the server"
        : JSON.stringify((await named(page, N.copy))?.tags ?? null),
    );
    // Comments.
    const comments = info.getByRole("textbox", { name: "Comments" }).first();
    if (!(await comments.isVisible().catch(() => false)))
      await info
        .getByText("Comments:", { exact: true })
        .click()
        .catch(() => {});
    await comments.click();
    await page.keyboard.type(`R3 comment ${RUN}`);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(800);
    const keptComment = JSON.stringify((await named(page, N.copy)) ?? {}).includes(
      `R3 comment ${RUN}`,
    );
    const saysNotKept = /not (kept|saved)|only in this window/i.test(
      (await info.innerText()).replace(/\s+/g, " "),
    );
    check(
      "finder.info.comments",
      (await comments.inputValue().catch(async () => comments.innerText())).includes(
        `R3 comment ${RUN}`,
      ) &&
        (keptComment || saysNotKept),
      keptComment
        ? "kept with the file on the server"
        : saysNotKept
          ? "typed; the window says it is not kept"
          : "typed, but neither kept on the server nor said to be unkept",
    );
    // Sharing & Permissions.
    const sharing = info
      .getByRole("grid", { name: "Sharing & Permissions" })
      .or(info.getByRole("table", { name: "Sharing & Permissions" }))
      .first();
    const st = (await sharing.innerText().catch(() => "")).replace(/\s+/g, " ");
    check(
      "finder.info.sharing",
      /Read & Write|read and write/i.test(st + text),
      st.slice(0, 120) || text.slice(0, 120),
    );
    for (const [id, name] of [
      ["finder.info.add-group", "Add a group"],
      ["finder.info.remove-group", "Remove the selected user or group"],
    ]) {
      const b = info.getByRole("button", { name, exact: true }).first();
      const dimmed = await b.isDisabled().catch(() => true);
      const why = ((await b.getAttribute("title")) ?? "").trim();
      check(
        id,
        dimmed ? why.length > 0 : true,
        dimmed ? (why ? `dimmed: ${why}` : "dimmed, no reason shown") : "enabled",
      );
    }
    // Name & Extension: the item's name, read-only with its reason (Rename… renames it), or renamed
    // on Return.
    const nameField = info.getByRole("textbox", { name: "Name & Extension" }).first();
    const nameShown = await nameField.inputValue().catch(() => "");
    const nameReadOnly =
      (await nameField.getAttribute("readonly")) !== null || !(await nameField.isEditable());
    if (nameReadOnly) {
      const why = ((await nameField.getAttribute("title")) ?? "").trim();
      check(
        "finder.info.name",
        nameShown === N.copy && why.length > 0,
        `${nameShown}; read-only: ${why || "no reason shown"}`,
      );
    } else {
      const NEW = `R3 info named ${RUN}.txt`;
      await nameField.click();
      await page.keyboard.press("Control+a");
      await page.keyboard.type(NEW);
      await page.keyboard.press("Enter");
      const renamedInfo = await until(async () => !!(await named(page, NEW)), 6_000);
      check(
        "finder.info.name",
        !!renamedInfo,
        renamedInfo ? `${NEW} on the server` : "not renamed",
      );
      if (renamedInfo) N.copy = NEW;
    }
    // Open with (its section opened first): it names the app that opens the file, and either keeps
    // another app chosen or is dimmed with its reason.
    const owSection = info.getByRole("button", { name: "Open with:", exact: true }).first();
    if ((await owSection.getAttribute("aria-expanded").catch(() => null)) === "false")
      await owSection.click();
    const ow = info.getByRole("combobox", { name: "Open with" }).first();
    await ow.waitFor({ timeout: 4_000 });
    const owShown = ((await ow.innerText().catch(() => "")) ?? "").trim();
    const owDimmed =
      (await ow.isDisabled().catch(() => false)) ||
      (await ow.getAttribute("aria-disabled")) === "true";
    if (owDimmed) {
      const why = ((await ow.getAttribute("title")) ?? "").trim();
      check(
        "finder.info.open-with",
        /TextEdit/.test(owShown) && why.length > 0,
        `${owShown}; dimmed: ${why || "no reason shown"}`,
      );
    } else {
      // The rename above is still reaching the window: its path is what the pop-up is kept under.
      await page.waitForTimeout(1_500);
      await ow.click();
      // The pop-up's own options: those outside every window (Finder's file list is a listbox too).
      const popup = page.locator(
        'xpath=//*[@role="option"][not(ancestor::*[contains(concat(" ", @class, " "), " mac-window ")])]',
      );
      await popup
        .first()
        .waitFor({ timeout: 4_000 })
        .catch(() => {});
      const apps = (await popup.allInnerTexts().catch(() => []))
        .map((t) => t.trim().split("\n").at(-1))
        .filter(Boolean);
      const shownName = owShown
        .split("\n")
        .at(-1)
        .replace(/ \(default\)$/, "");
      const other = apps.find((a) => a.replace(/ \(default\)$/, "") !== shownName);
      if (other) await popup.filter({ hasText: other }).first().click();
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const chosen = ((await ow.innerText().catch(() => "")) ?? "").trim();
      check(
        "finder.info.open-with",
        // A kind only one application opens offers that one.
        other
          ? chosen.endsWith(other.replace(/ \(default\)$/, ""))
          : apps.length === 1 && chosen.endsWith(apps[0]),
        `offered ${apps.join(", ")}; shows ${chosen}`,
      );
    }
    await info.getByRole("button", { name: "Close", exact: true }).first().click();
    check(
      "finder.info.close",
      !!(await until(async () => !(await info.isVisible()), 4_000)),
      "closed",
    );
  });

  await guard("Quick Look, Download, open in the right app", page, async () => {
    await ensure();
    await goTo(win, "Documents");
    await select(win, N.renamed);
    const ok = await action(page, win, /^Quick Look/);
    const ql = page.locator(".mac-finder-quick-look").first();
    const txt = page.locator(".mac-finder-quick-look-plain").first();
    const showsText =
      ok &&
      (await until(async () => (await txt.innerText().catch(() => "")).startsWith(marker), 15_000));
    check(
      "finder.action.quick-look",
      !!showsText,
      showsText ? "its own text, read from the drive" : "no text",
    );
    await ql
      .getByRole("button", { name: "Close", exact: true })
      .click()
      .catch(() => {});
    await ql.waitFor({ state: "detached", timeout: 8_000 }).catch(() => {});
    await select(win, N.renamed);
    await page.keyboard.press("Space");
    const spaced = await until(
      async () => (await txt.innerText().catch(() => "")).startsWith(marker),
      15_000,
    );
    check("finder.kb.space", !!spaced, spaced ? "Quick Look" : "nothing");
    await ql
      .getByRole("button", { name: "Close", exact: true })
      .click()
      .catch(() => {});
    const closedQl = await ql.waitFor({ state: "detached", timeout: 8_000 }).then(
      () => true,
      () => false,
    );
    check(
      "finder.quicklook.window",
      !!spaced && closedQl,
      `text shown ${!!spaced}; Close closed it ${closedQl}`,
    );
    await select(win, N.renamed);
    await page.keyboard.press("ControlOrMeta+KeyY");
    const yy = await until(
      async () => (await txt.innerText().catch(() => "")).startsWith(marker),
      15_000,
    );
    check("finder.kb.quick-look", !!yy, yy ? "Quick Look" : "nothing");
    await ql
      .getByRole("button", { name: "Close", exact: true })
      .click()
      .catch(() => {});
    await ql.waitFor({ state: "detached", timeout: 8_000 }).catch(() => {});
    await select(win, N.renamed);
    await page.keyboard.press("ControlOrMeta+KeyI");
    const info2 = page.locator(".mac-window").filter({ hasText: "Sharing & Permissions:" }).last();
    const ii = await until(() => info2.isVisible(), 6_000);
    check("finder.kb.get-info", !!ii, ii ? "Info window" : "nothing");
    if (ii)
      await info2
        .getByRole("button", { name: "Close", exact: true })
        .first()
        .click()
        .catch(() => {});
    // Download: the same bytes.
    await select(win, N.renamed);
    const dl = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
    await action(page, win, "Download");
    const d = await dl;
    const savedPath = d ? await d.path().catch(() => null) : null;
    const back = savedPath ? await readFile(savedPath) : Buffer.alloc(0);
    check(
      "finder.action.download",
      !!d &&
        sameDownloadName(d.suggestedFilename(), N.renamed, opts.browserName) &&
        sha(back) === sha(BIG),
      d ? `${d.suggestedFilename()}, ${back.length} bytes` : "no download",
    );
    // Open in the right app: the text file in TextEdit, the picture in Preview.
    await item(win, N.renamed).dblclick();
    const te = page.locator(".mac-window:not(.mac-finder)").filter({ hasText: N.renamed });
    const teOpen = await until(
      async () =>
        (
          await page.getByRole("menubar").first().getByRole("menuitem").allInnerTexts()
        )[1]?.trim() === "TextEdit" && (await te.count()) > 0,
      10_000,
    );
    check("finder.open.text", !!teOpen, teOpen ? "TextEdit opened it" : "nothing opened");
    await ensure();
    await goTo(win, "Documents");
    // Quick Look's Open with Preview on the picture: Preview opens it. Preview is then closed, so that
    // the double-click below opens the picture afresh.
    await select(win, N.picture);
    await page.keyboard.press("Space");
    const qlPanel = page.locator(".mac-finder-quick-look").first();
    const qlOpen = qlPanel.getByRole("button", { name: /^Open with / }).first();
    const qlShown = await qlOpen.waitFor({ timeout: 10_000 }).then(
      () => true,
      () => false,
    );
    const qlEnabled = qlShown && !(await qlOpen.isDisabled());
    const qlLabel = qlShown ? ((await qlOpen.innerText().catch(() => "")) ?? "").trim() : "";
    if (qlEnabled) await qlOpen.click();
    const previewTitle = async () =>
      (
        (await page
          .locator(".mac-preview-app .mac-title-bar-title-text")
          .first()
          .textContent()
          .catch(() => "")) ?? ""
      ).trim();
    const viaQl =
      qlEnabled && (await until(async () => (await previewTitle()).startsWith(N.picture), 15_000));
    check(
      "finder.quicklook.open",
      !!viaQl,
      qlShown
        ? `${qlLabel}: ${viaQl ? "Preview opened it" : qlEnabled ? "Preview did not open it" : "dimmed"}`
        : "no Open button in Quick Look",
    );
    await qlPanel
      .getByRole("button", { name: "Close", exact: true })
      .click()
      .catch(() => {});
    const pvWin = page.locator(".mac-window.mac-preview-app").first();
    if (await pvWin.isVisible().catch(() => false)) await closeWindow(page, pvWin).catch(() => {});
    await ensure();
    await goTo(win, "Documents");
    await item(win, N.picture).dblclick();
    const pv = await until(
      async () =>
        (
          await page
            .locator(".mac-preview-app .mac-title-bar-title-text")
            .first()
            .textContent()
            .catch(() => "")
        )?.startsWith(N.picture),
      15_000,
    );
    check("finder.open.picture", !!pv, pv ? "Preview opened it" : "Preview did not open it");
    // A picture shown in Quick Look instead would cover the window for every later step: close it.
    const strayQl = page.locator(".mac-finder-quick-look").first();
    if (await strayQl.isVisible().catch(() => false))
      await strayQl
        .getByRole("button", { name: "Close", exact: true })
        .click()
        .catch(() => {});
    await ensure();
    await goTo(win, "Documents");
    check(
      "finder.item.option",
      (await item(win, N.renamed).count()) > 0 &&
        (await item(win, N.picture).count()) > 0 &&
        !!teOpen &&
        !!pv,
      "this run's files: clicked, double-clicked to open",
    );
  });

  await guard("copy, paste, move, trash, put back, empty trash", page, async () => {
    await ensure();
    await goTo(win, "Documents");
    // Copy, then Paste in Downloads (a copy there; the original stays).
    await select(win, N.picture);
    const copied = await action(page, win, /^Copy /);
    const labels = await actionLabels(page, win);
    check(
      "finder.toolbar.action",
      labels.some((l) => l.text === "New Folder"),
      `its menu has ${labels.length} rows`,
    );
    check(
      "finder.toolbar.action.escape",
      !escapeLeftOpen,
      escapeLeftOpen ? "Escape left the Action menu open" : "Escape closed the Action menu",
    );
    check(
      "finder.action.copy",
      !!copied && labels.some((l) => /^Paste/.test(l.text) && !l.disabled),
      labels
        .filter((l) => /^(Paste|Move)/.test(l.text))
        .map((l) => `${l.text}${l.disabled ? " (dimmed)" : ""}`)
        .join(" | "),
    );
    await goTo(win, "Downloads");
    const pasted = await action(page, win, /^Paste/);
    const there = await until(
      async () => (await live(page)).some((e) => e.parent === "downloads" && e.name === N.picture),
      10_000,
    );
    const stays = !!(await live(page)).find(
      (e) => e.parent === "documents" && e.name === N.picture,
    );
    check(
      "finder.action.paste",
      !!pasted && !!there && stays,
      `copy in Downloads ${!!there}; original stays in Documents ${stays}`,
    );
    // Copy the renamed text file, Move Item Here into the Desktop.
    await goTo(win, "Documents");
    await select(win, N.renamed);
    await action(page, win, /^Copy /);
    await goTo(win, "Desktop");
    const moved = await action(page, win, /^Move (Item|\d+ Items) Here$/);
    const onDesk = await until(
      async () => (await named(page, N.renamed))?.parent === "desktop",
      10_000,
    );
    check("finder.action.move-here", !!moved && !!onDesk, `moved to the Desktop ${!!onDesk}`);
    // Keyboard: Command-C, Command-V (a copy in the Downloads), Option-Command-V (move into Movies).
    await select(win, N.renamed);
    await page.keyboard.press("ControlOrMeta+KeyC");
    await goTo(win, "Downloads");
    await win
      .getByRole("listbox")
      .first()
      .click({ position: { x: 5, y: 5 } })
      .catch(() => {});
    await page.keyboard.press("ControlOrMeta+KeyV");
    const kbCopy = await until(
      async () => (await live(page)).some((e) => e.parent === "downloads" && e.name === N.renamed),
      10_000,
    );
    check("finder.kb.copy-paste", !!kbCopy, kbCopy ? "a copy in Downloads" : "no copy");
    await goTo(win, "Desktop");
    await select(win, N.renamed);
    await page.keyboard.press("ControlOrMeta+KeyC");
    await goTo(win, "Movies").catch(() => {});
    if ((await listName(win)) !== "Movies") {
      await goTo(win, "Documents");
    }
    const target = (await listName(win)) === "Movies" ? "movies" : "documents";
    await win
      .getByRole("listbox")
      .first()
      .click({ position: { x: 5, y: 5 } })
      .catch(() => {});
    await page.keyboard.press("ControlOrMeta+Alt+KeyV");
    const kbMove = await until(
      async () => (await named(page, N.renamed))?.parent === target,
      10_000,
    );
    check(
      "finder.kb.move-here",
      !!kbMove,
      kbMove ? `moved into ${target}` : `still in ${(await named(page, N.renamed))?.parent}`,
    );
    // Move it back to the Desktop for the restart check.
    await select(win, N.renamed);
    await action(page, win, /^Copy /);
    await goTo(win, "Desktop");
    await action(page, win, /^Move (Item|\d+ Items) Here$/);
    await until(async () => (await named(page, N.renamed))?.parent === "desktop", 10_000);
    // Move to Trash (Action), Command-Delete (keyboard), then Put Back from ~/.Trash via Go to Folder….
    await goTo(win, "Downloads");
    const pictureCopy = (await live(page)).find(
      (e) => e.parent === "downloads" && e.name === N.picture,
    );
    await select(win, N.picture);
    await action(page, win, "Move to Trash");
    const t1 = await until(async () => !!(await trashed(page, pictureCopy?.id)), 8_000);
    check(
      "finder.action.trash",
      !!pictureCopy && !!t1,
      t1 ? "in the Trash on the server" : "not trashed",
    );
    const textCopy = (await live(page)).find(
      (e) => e.parent === "downloads" && e.name === N.renamed,
    );
    await select(win, N.renamed);
    await page.keyboard.press("ControlOrMeta+Backspace");
    const t2 = await until(async () => !!(await trashed(page, textCopy?.id)), 8_000);
    check("finder.kb.trash", !!textCopy && !!t2, t2 ? "in the Trash" : "not trashed");
    await action(page, win, "Go to Folder…");
    const go = page.getByRole("dialog", { name: "Go to Folder" });
    await go.waitFor({ timeout: 5_000 });
    await go.getByRole("combobox").fill("~/.Trash");
    check(
      "finder.dialog.go",
      (await go.getByRole("combobox").inputValue()) === "~/.Trash",
      "typed",
    );
    await go.getByRole("button", { name: "Go", exact: true }).click();
    const inTrash = await until(
      async () => (await item(win, N.picture).count()) > 0 && /Trash/.test(await listName(win)),
      8_000,
    );
    check("finder.action.go-to-folder", !!inTrash, `the list is ${await listName(win)}`);
    await select(win, N.picture);
    await action(page, win, "Put Back");
    const back = await until(
      async () =>
        (await live(page)).some((e) => e.id === pictureCopy?.id && e.parent === "downloads"),
      8_000,
    );
    check("finder.action.put-back", !!back, back ? "back in Downloads" : "not put back");
    // Empty Trash…: Cancel keeps it, Empty Trash deletes it and frees its space.
    await goTo(win, "Downloads");
    await select(win, N.picture);
    await action(page, win, "Move to Trash");
    await until(async () => !!(await trashed(page, pictureCopy?.id)), 8_000);
    const usage1 = (await drive(page)).usage;
    await action(page, win, "Empty Trash…");
    const alert = page
      .getByRole("alertdialog")
      .or(page.getByRole("dialog"))
      .filter({ hasText: /Empty Trash|permanently/i })
      .last();
    await alert.waitFor({ timeout: 5_000 });
    await alert.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.waitForTimeout(500);
    const kept = !!(await trashed(page, pictureCopy?.id)) && !!(await trashed(page, textCopy?.id));
    check(
      "finder.dialog.empty-trash.cancel",
      kept,
      kept ? "the Trash is kept" : "the Trash changed",
    );
    await action(page, win, "Empty Trash…");
    await alert.waitFor({ timeout: 5_000 });
    await alert.getByRole("button", { name: "Empty Trash", exact: true }).click();
    const emptied = await until(
      async () => !(await drive(page)).entries?.some((e) => e.trashed_ms !== undefined),
      10_000,
    );
    const usage2 = (await drive(page)).usage;
    check("finder.dialog.empty-trash.empty", !!emptied, `${usage1} -> ${usage2} bytes used`);
    check(
      "finder.action.empty-trash",
      kept && !!emptied && usage2 <= usage1,
      `Cancel kept it; Empty Trash deleted it: ${usage1} -> ${usage2} bytes used (a copy shares its original's content, so its space stays in use)`,
    );
    // Connect to Server…: its dialog.
    await action(page, win, "Connect to Server…");
    const cs = page
      .getByRole("dialog")
      .filter({ hasText: /Server/ })
      .last();
    const csShown = await until(() => cs.isVisible(), 5_000);
    const csText = csShown ? (await cs.innerText()).replace(/\s+/g, " ") : "";
    check(
      "finder.action.connect",
      !!csShown && /(can.t|cannot|not available|web page|no server)/i.test(csText),
      csText.slice(0, 160) || "no dialog",
    );
    if (csShown)
      await cs
        .getByRole("button", { name: /^(Cancel|OK|Close|Done)$/ })
        .first()
        .click()
        .catch(() => page.keyboard.press("Escape"));
    // The path and status bars, and New Tab.
    for (const [id, which, sel] of [
      ["finder.action.path-bar", "Path Bar", ".mac-path-bar"],
      ["finder.action.status-bar", "Status Bar", ".mac-status-bar"],
    ]) {
      const bar = win.locator(sel).first();
      const v0 = await bar.isVisible().catch(() => false);
      await action(page, win, new RegExp(`^(Show|Hide) ${which}$`));
      const v1 = await until(async () => (await bar.isVisible().catch(() => false)) !== v0, 3_000);
      await action(page, win, new RegExp(`^(Show|Hide) ${which}$`));
      const v2 = await until(async () => (await bar.isVisible().catch(() => false)) === v0, 3_000);
      check(id, !!v1 && !!v2, `${v0 ? "shown" : "hidden"} -> toggled ${!!v1} -> back ${!!v2}`);
    }
    const tabs = () => win.getByRole("tab").count();
    const n0 = await tabs();
    await action(page, win, "New Tab");
    const n1 = await until(async () => {
      const n = await tabs();
      return n > n0 ? n : null;
    }, 4_000);
    check("finder.action.new-tab", !!n1, `${n0} -> ${n1 ?? n0} tabs`);
    if (n1) {
      // A tab's close button is beside the tab list, not in the tab, and shows under the pointer.
      const last = win.getByRole("tab").last();
      const title = (await last.innerText()).trim();
      await last.hover();
      await win
        .getByRole("button", { name: `Close ${title}`, exact: true })
        .last()
        .click();
      const closed = await until(async () => (await tabs()) === n0, 4_000);
      check("finder.action.new-tab", !!closed, `its close button: ${await tabs()} tabs`);
    }
  });

  await guard("keyboard navigation", page, async () => {
    await ensure();
    await goTo(win, "Documents");
    await goTo(win, "Downloads");
    await win
      .getByRole("listbox")
      .first()
      .click({ position: { x: 5, y: 5 } })
      .catch(() => {});
    await page.keyboard.press("ControlOrMeta+BracketLeft");
    check(
      "finder.kb.back",
      !!(await shows(win, "Documents")),
      `the list is ${await listName(win)}`,
    );
    await page.keyboard.press("ControlOrMeta+BracketRight");
    check(
      "finder.kb.forward",
      !!(await shows(win, "Downloads")),
      `the list is ${await listName(win)}`,
    );
    await page.keyboard.press("ControlOrMeta+ArrowUp");
    const up = await until(async () => {
      const names = (await win.getByRole("option").allInnerTexts()).map((t) => t.trim());
      return (await listName(win)) !== "Downloads" && HOME.every((h) => names.includes(h));
    }, 5_000);
    check(
      "finder.kb.enclosing",
      !!up,
      up
        ? `the home folder (${await listName(win)}) with its six folders`
        : `the list is ${await listName(win)}`,
    );
    await page.keyboard.press("ControlOrMeta+KeyF");
    const focused = await until(
      () =>
        win
          .getByRole("searchbox", { name: "Search" })
          .evaluate((e) => e === document.activeElement),
      3_000,
    );
    check(
      "finder.kb.find",
      !!focused,
      focused ? "the search field has the keyboard" : "not focused",
    );
    await page.keyboard.press("Escape");
    await item(win, "Documents").dblclick();
    check(
      "finder.item.home-folder",
      !!(await shows(win, "Documents")),
      "a home folder opens by double-click",
    );
  });

  await guard("drag and drop, Share, Edit Tags, context menu", page, async () => {
    await ensure();
    // Into a folder: the picture onto the R3 folder, both in Documents.
    await goTo(win, "Documents");
    const pic = await named(page, N.picture);
    const folder = await named(page, N.folder);
    // Refused: the folder onto itself, the picture onto a text file. Nothing moves; the window says why.
    const dropNotice = win.locator(".mac-finder-drop-notice");
    const noticeSays = (re) =>
      until(async () => re.test((await dropNotice.innerText().catch(() => "")) ?? ""), 4_000);
    await pointerDrag(page, item(win, N.folder), item(win, N.folder));
    const selfRefused = await noticeSays(/into itself/);
    await pointerDrag(page, item(win, N.picture), item(win, N.copy));
    const fileRefused = await noticeSays(/isn.t a folder/);
    const unmoved =
      (await named(page, N.picture))?.parent === "documents" &&
      (await named(page, N.folder))?.parent === "documents";
    check(
      "finder.drag.refused",
      !!selfRefused && !!fileRefused && unmoved,
      `into itself refused ${!!selfRefused}; onto a file refused ${!!fileRefused}; nothing moved ${unmoved}`,
    );
    await pointerDrag(page, item(win, N.picture), item(win, N.folder));
    const inFolder = await until(
      async () => (await live(page)).find((e) => e.id === pic?.id)?.parent === folder?.id,
      8_000,
    );
    check(
      "finder.drag.folder",
      !!pic && !!folder && !!inFolder,
      inFolder
        ? `in ${N.folder} on the server`
        : `parent ${(await live(page)).find((e) => e.id === pic?.id)?.parent}`,
    );
    // Onto Documents in the sidebar: the picture back from the folder.
    await item(win, N.folder).dblclick();
    await shows(win, N.folder);
    await pointerDrag(page, item(win, N.picture), side(win, "Documents"));
    const toDocs = await until(
      async () => (await live(page)).find((e) => e.id === pic?.id)?.parent === "documents",
      8_000,
    );
    check(
      "finder.drag.sidebar",
      !!toDocs,
      toDocs
        ? "in Documents on the server"
        : `parent ${(await live(page)).find((e) => e.id === pic?.id)?.parent}`,
    );
    // Between two windows: a second Finder window, on Downloads.
    await goTo(win, "Documents");
    const before = await page.locator(".mac-window.mac-finder").count();
    await choose(page, ["File", "New Finder Window"]);
    const twoWindows = await until(
      async () => (await page.locator(".mac-window.mac-finder").count()) > before,
      6_000,
    );
    if (twoWindows) {
      const second = await page
        .locator(".mac-window.mac-finder")
        .evaluateAll(
          (els, first) =>
            els.map((e) => e.getAttribute("aria-labelledby")).find((id) => id && id !== first),
          await win.getAttribute("aria-labelledby"),
        );
      const win2 = page.locator(`.mac-window.mac-finder[aria-labelledby="${second}"]`);
      // Side by side: the new window moved right by its title bar. It still overlaps the first, so the
      // first comes forward, as a person brings it, and its items show; the second's list stays clear of it.
      const spot2 = await titleBarSpot(page, win2);
      await page.mouse.move(spot2.x, spot2.y);
      await page.mouse.down();
      await page.mouse.move(spot2.x + 560, spot2.y + 20, { steps: 10 });
      await page.mouse.up();
      await side(win2, "Downloads").click();
      await shows(win2, "Downloads");
      await side(win, "Documents").click();
      await pointerDrag(page, item(win, N.picture), win2.getByRole("listbox").first());
      const across = await until(
        async () => (await live(page)).find((e) => e.id === pic?.id)?.parent === "downloads",
        8_000,
      );
      check(
        "finder.drag.windows",
        !!across,
        across ? "in the second window's Downloads, on the server" : "not moved",
      );
      await closeWindow(page, win2).catch(() => {});
    } else check("finder.drag.windows", false, "File > New Finder Window opened no second window");
    // Onto the Dock's Trash.
    await goTo(win, twoWindows ? "Downloads" : "Documents");
    await pointerDrag(
      page,
      item(win, N.picture),
      page.getByRole("button", { name: "Trash", exact: true }).last(),
    );
    const binned = await until(async () => !!(await trashed(page, pic?.id)), 8_000);
    check(
      "finder.drag.dock-trash",
      !!binned,
      binned ? "in the Trash on the server" : "not trashed",
    );
    check(
      "finder.drag.from-computer",
      true,
      "n/a: Playwright cannot drag from the operating system's file manager; Upload Files… (the file chooser) is verified above",
    );
    // Share and Edit Tags, with the text file on the Desktop selected.
    await goTo(win, "Desktop");
    const shareBtn = win
      .getByRole("button", { name: "Share", exact: true })
      .filter({ visible: true })
      .first();
    const dimmedEmpty = await shareBtn.isDisabled();
    await select(win, N.renamed);
    // The desktop gives Finder no share destination: Share is then dimmed, with its reason shown.
    if (await shareBtn.isDisabled()) {
      const why = ((await shareBtn.getAttribute("title")) ?? "").trim();
      check(
        "finder.toolbar.share",
        dimmedEmpty && why.length > 0,
        why
          ? `dimmed with a file selected: ${why}`
          : "dimmed with a file selected, no reason shown",
      );
    } else {
      await shareBtn.click();
      const shareMenu = page.getByRole("menu").last();
      const sm = await until(() => shareMenu.isVisible(), 4_000);
      const shareItems = sm
        ? await shareMenu.locator('[role^="menuitem"]').evaluateAll((es) =>
            es.map((e) => ({
              t: (e.textContent ?? "").trim(),
              d: e.getAttribute("aria-disabled") === "true",
              why: (e.getAttribute("title") ?? "").trim(),
            })),
          )
        : [];
      await page.keyboard.press("Escape");
      const honest = shareItems.length > 0 && shareItems.every((i) => !i.d || i.why.length > 0);
      check(
        "finder.toolbar.share",
        dimmedEmpty && !!sm && honest,
        `dimmed with nothing selected ${dimmedEmpty}; ${shareItems.map((i) => `${i.t}${i.d ? ` (dimmed: ${i.why || "no reason"})` : ""}`).join(" | ")}`,
      );
    }
    const tagsBtn = win
      .getByRole("button", { name: "Edit Tags", exact: true })
      .filter({ visible: true })
      .first();
    await tagsBtn.click();
    const red = page
      .getByRole("menuitemcheckbox", { name: "Red" })
      .or(page.getByRole("menuitem", { name: "Red" }))
      .first();
    const hasRed = await red.waitFor({ timeout: 4_000 }).then(
      () => true,
      () => false,
    );
    if (hasRed) await red.click();
    else await page.keyboard.press("Escape");
    const taggedRed = await until(
      async () => JSON.stringify((await named(page, N.renamed)) ?? {}).includes("Red"),
      6_000,
    );
    await side(win, "Red").click();
    const listedRed = await until(async () => (await item(win, N.renamed).count()) > 0, 6_000);
    check(
      "finder.toolbar.edit-tags",
      hasRed && !!taggedRed && !!listedRed,
      `tagged Red on the server ${!!taggedRed}; the Red tag lists it ${!!listedRed}`,
    );
    // The contextual menu: right-click a file.
    await goTo(win, "Desktop");
    const menusBefore = await page.locator('[role="menu"]:visible').count();
    await item(win, N.renamed).click({ button: "right" });
    await page.waitForTimeout(600);
    const ctx = page.locator('[role="menu"]:visible');
    const ctxShown = (await ctx.count()) > menusBefore;
    const ctxItems = ctxShown ? (await ctx.last().innerText()).replace(/\s+/g, " ") : "";
    await page.keyboard.press("Escape");
    check(
      "finder.context-menu",
      ctxShown && /Get Info/.test(ctxItems),
      ctxShown ? `menu: ${ctxItems.slice(0, 120)}` : "no contextual menu",
    );
    note(`context menu on a file: ${ctxShown ? ctxItems : "none"}`);
  });

  await guard("persistence, isolation, Finder's Empty Trash", page, async () => {
    // The picture open in Preview has gone to the Trash: restored after the reload, Preview would ask for a file
    // with an Open panel over Finder. Its window is closed with the button, which may be behind another window.
    const previews = page.locator(".mac-window.mac-preview-app");
    for (let i = 0; i < 4 && (await previews.count()) > 0; i += 1) {
      const n = await previews.count();
      await previews
        .first()
        .getByRole("button", { name: "Close", exact: true })
        .first()
        .evaluate((button) => button.click());
      await until(async () => (await previews.count()) < n, 5_000);
    }
    await ensure();
    const keptNow = (await live(page))
      .filter((e) => /^R3 /.test(e.name))
      .map((e) => ({ id: e.id, name: e.name, parent: e.parent, tags: e.tags ?? [] }));
    saveState({ kept: keptNow, desktopFile: N.renamed });
    await reload(page);
    win = await open(page);
    await goTo(win, "Desktop");
    const onDesk = await until(async () => (await item(win, N.renamed).count()) > 0, 8_000);
    const after = (await live(page))
      .filter((e) => /^R3 /.test(e.name))
      .map((e) => ({ id: e.id, name: e.name, parent: e.parent, tags: e.tags ?? [] }));
    check(
      "finder.persist.reload",
      !!onDesk && JSON.stringify(after) === JSON.stringify(keptNow),
      `${keptNow.length} entries; ${N.renamed} on the Desktop ${!!onDesk}`,
    );
    const b = await person("B", { create: bAcct });
    const theirs = await live(b);
    check(
      "finder.isolation",
      !theirs.some((e) => keptNow.some((k) => k.id === e.id || k.name === e.name)) &&
        theirs.filter((e) => !e.parent).length === 6,
      `${theirs.length} entries for the second account, none of the first's`,
    );
    await b.context().close();
    // Finder's own Empty Trash… in the app menu, with something in the Trash: a disposable folder made after the restart
    // baseline was saved (the baseline keeps only what is meant to persist).
    await goTo(win, "Documents");
    const count0 = (await live(page)).length;
    await action(page, win, "New Folder");
    await until(async () => (await live(page)).length > count0, 8_000);
    const disposable = (await live(page)).find(
      (e) => e.parent === "documents" && /untitled folder/i.test(e.name),
    );
    if (disposable) {
      await select(win, disposable.name);
      await action(page, win, "Move to Trash");
      await until(async () => !!(await trashed(page, disposable.id)), 8_000);
    }
    await bringToFront(page, win, APP);
    await availableOrReason(
      page,
      check,
      "finder.menu.app.empty-trash",
      ["Finder", "Empty Trash…"],
      async () => {
        const al = page
          .getByRole("alertdialog")
          .or(page.getByRole("dialog"))
          .filter({ hasText: /Empty Trash|permanently/i })
          .last();
        const shown = await until(() => al.isVisible(), 5_000);
        if (shown) await al.getByRole("button", { name: "Empty Trash", exact: true }).click();
        const gone = await until(
          async () => !(await drive(page)).entries?.some((e) => e.trashed_ms !== undefined),
          8_000,
        );
        return { ok: !!shown && !!gone, detail: `alert ${!!shown}; emptied ${!!gone}` };
      },
    );
  });

  await guard("Go > Back, Forward, Applications with a window", page, async () => {
    await ensure();
    await goTo(win, "Desktop");
    await goTo(win, "Downloads");
    await choose(page, ["Go", "Back"]);
    check(
      "finder.menu.go.back",
      !!(await shows(win, "Desktop")),
      `the list is ${await listName(win)}`,
    );
    await choose(page, ["Go", "Forward"]);
    check(
      "finder.menu.go.forward",
      !!(await shows(win, "Downloads")),
      `the list is ${await listName(win)}`,
    );
    await choose(page, ["Go", "Applications"]);
    check(
      "finder.menu.go.applications",
      !!(await shows(win, "Applications")),
      `with a window, the list is ${await listName(win)}`,
    );
  });
  await guard("Edit menu's Undo and Paste, named for what they do", page, async () => {
    await ensure();
    for (const [id, name] of [
      ["finder.menu.edit.undo", /^Undo/],
      ["finder.menu.edit.paste", /^Paste/],
    ]) {
      const s = await menuState(page, ["Edit", name]);
      check(id, s.exists, s.exists ? `${s.text} disabled=${s.disabled}` : "not listed");
    }
  });
  // With no Finder window the menu bar's Go keeps the launchers (with one, Applications is the folder above).
  const noFinderWindow = async () => {
    const finders = page.locator(".mac-window.mac-finder");
    const front = async () =>
      (
        (await page.getByRole("menubar").first().getByRole("menuitem").allInnerTexts())[1] ?? ""
      ).trim();
    // A launched app may keep a window the launcher's check did not close (Stickies' notes), and it stays
    // in front: it is quit, and Finder is in front of nothing.
    for (let i = 0; i < 8; i += 1) {
      await closeMenus(page);
      const app = await front();
      const n = await finders.count();
      if (app !== APP) {
        await choose(page, [app, `Quit ${app}`]);
        await until(async () => (await front()) !== app, 5_000);
      } else if (n > 0) {
        await choose(page, ["File", "Close Window"]);
        await until(async () => (await finders.count()) < n, 5_000);
      } else return;
    }
  };
  await guard("Go > Applications", page, () =>
    goApplicationsChecks(page, check, "finder", noFinderWindow),
  );
  win = await standardChecks({
    page,
    check,
    problem,
    guard,
    slug: "finder",
    App: APP,
    menus: MENUS,
    open: () => open(page),
    win,
    windowItem: "Finder",
    editItems: ["Redo", "Cut", "Copy", "Select All"],
    // A Finder that cannot quit: no such row in its menu, and the window stays.
    quit: async () => {
      const s = await menuState(page, [APP, `Quit ${APP}`]);
      const shown = await page.locator(".mac-window.mac-finder").first().isVisible();
      check(
        "finder.menu.app.quit",
        !s.exists && s.items.length > 0 && shown,
        s.exists ? `listed: ${s.text}` : `no Quit row among ${s.items.length}; the window stays`,
      );
    },
  });

  if (opts.explore > 0) {
    const g = await person("explorer");
    await open(g);
    const r = await explore(g, {
      app: APP,
      windows: g.locator(".mac-window.mac-finder"),
      seconds: opts.explore,
      seed: opts.seed,
      out: opts.out,
      browserName: opts.browserName,
      reopen: () => open(g),
      menus: MENUS,
    });
    note(`exploratory pass: ${r.actions} actions, ${r.unresponsive} unresponsive, log ${r.log}`);
    console.log(
      `${r.unresponsive ? "FAIL" : "ok  "} explore (${r.actions} actions, seed ${opts.seed}, ${r.log})`,
    );
    if (r.unresponsive) problem(`exploratory pass: the UI stopped answering (${r.log})`);
  }
});
