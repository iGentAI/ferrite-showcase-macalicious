// Census rows and real-input verifiers every R6 app shares (round 3): the application menu (About, Preferences,
// Services, Hide, Hide Others, Show All, Quit), File > Close Window, the Edit menu's placeholders, View > Enter Full
// Screen, the Window menu (Minimize, Zoom, Bring All to Front, the window's own item), the Help item, the shortcuts those
// menus name, and each window's chrome (close, minimise, full screen, move by the title bar, the eight resize edges).
//
// Rows follow R8's matching rule (campaign/round3/r8/census-matching.md): role + accessible name (plain text, or
// `/regex/`), `window_or_state` starting `menu:<title>` for menu items, resize edges as role `resize-handle` named by
// compass point. A row whose `cell` is `unavailable:<reason>` passes only when the step finds it dimmed and the page
// showing a reason; the reason found is printed in the step's detail.

import {
  appWindow,
  drag,
  menu,
  menuTitle,
  openApp,
  openMenuItem,
  pause,
  shortcut,
  windowControls,
  windowFrame,
  within,
} from "./r6-kit.mjs";

export const EDGES = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const EDGE_WORD = {
  n: "top",
  ne: "top-right corner",
  e: "right",
  se: "bottom-right corner",
  s: "bottom",
  sw: "bottom-left corner",
  w: "left",
  nw: "top-left corner",
};

/** Off Apple platforms Command is Control, so a Control-Command key equivalent cannot be typed (menu-key-commands.ts). */
export const CONTROL_COMMAND_NA =
  "n/a:Control-Command shortcuts need an Apple keyboard; off Apple the desktop maps Command to Control and leaves them out (src/lib/menu-key-commands.ts)";

/**
 * The shared rows of one app. `prefs` is "window" (Preferences… opens the app's Preferences window, verified by the
 * app's suite) or "dimmed". `windowItem` is the name of the app window's item in the Window menu.
 */
export function commonRows(
  app,
  appName,
  { prefs = "dimmed", windowItem = appName, fullScreenMenu = "View", noEdit = [] } = {},
) {
  const m = (menuTitleText) => `menu:${menuTitleText}`;
  const dim = (id, window, name, note = "") => ({
    id: `${app}.menu.${id}`,
    window,
    role: "menuitem",
    name,
    how: `menu bar ${window.slice(5)} > ${name} (mouse)`,
    expected: "dimmed, with the reason it is unavailable shown on hover",
    cell: "unavailable:dimmed",
    dimmed: true,
    notes: note,
  });
  const edit = (id, name, keys) => ({
    id: `${app}.menu.edit-${id}`,
    window: m("Edit"),
    role: "menuitem",
    name,
    how: `menu bar Edit > ${name}, read (mouse)`,
    expected: `listed with its key equivalent ${keys}; what it does is the app's journeys' to check`,
    editKeys: keys,
  });
  const rows = [
    {
      id: `${app}.menu.app-about`,
      window: m(appName),
      role: "menuitem",
      name: `About ${appName}`,
      how: `menu bar ${appName} > About ${appName} (mouse)`,
      expected: "an About window naming the app opens; its Close button closes it",
    },
    prefs === "window"
      ? {
          id: `${app}.menu.app-preferences`,
          window: m(appName),
          role: "menuitem",
          name: "Preferences…",
          how: `menu bar ${appName} > Preferences… (mouse)`,
          expected: "opens the app's Preferences window",
        }
      : dim("app-preferences", m(appName), "Preferences…"),
    {
      id: `${app}.menu.app-services`,
      window: m(appName),
      role: "menuitem",
      name: "Services",
      how: `menu bar ${appName} > Services (hover)`,
      expected: "opens the Services submenu",
    },
    {
      id: `${app}.menu.services-none`,
      window: `${m(appName)} > Services`,
      role: "menuitem",
      name: "No Services Apply",
      how: `menu bar ${appName} > Services > No Services Apply`,
      expected: "dimmed; its own text is the reason",
      cell: "unavailable:No Services Apply",
      dimmed: true,
      selfReason: true,
    },
    {
      id: `${app}.menu.app-hide`,
      window: m(appName),
      role: "menuitem",
      name: `Hide ${appName}`,
      how: `menu bar ${appName} > Hide ${appName} (mouse)`,
      expected: "the app's windows hide; its Dock tile shows them again",
    },
    dim("app-hide-others", m(appName), "Hide Others"),
    dim("app-show-all", m(appName), "Show All"),
    {
      id: `${app}.menu.app-quit`,
      window: m(appName),
      role: "menuitem",
      name: `Quit ${appName}`,
      how: `menu bar ${appName} > Quit ${appName} (mouse)`,
      expected: "the app's windows close; its Dock tile opens it again",
    },
    {
      id: `${app}.menu.file-close-window`,
      window: m("File"),
      role: "menuitem",
      name: "Close Window",
      how: "menu bar File > Close Window (mouse)",
      expected: "the key window closes",
    },
    ...[
      edit("undo", "Undo", "⌘Z"),
      edit("redo", "Redo", "⇧⌘Z"),
      edit("cut", "Cut", "⌘X"),
      edit("copy", "Copy", "⌘C"),
      edit("paste", "Paste", "⌘V"),
      edit("select-all", "Select All", "⌘A"),
    ].filter((row) => !noEdit.includes(row.name)),
    {
      id: `${app}.menu.view-full-screen`,
      window: m("View"),
      role: "menuitem",
      name: "Enter Full Screen",
      how: "menu bar View > Enter Full Screen (mouse)",
      expected: "the window fills the screen; the item becomes Exit Full Screen",
    },
    {
      id: `${app}.menu.view-exit-full-screen`,
      window: m("View"),
      role: "menuitem",
      name: "Exit Full Screen",
      how: "menu bar View > Exit Full Screen, in full screen (mouse)",
      expected: "the window returns to its frame",
    },
    {
      id: `${app}.menu.window-minimize`,
      window: m("Window"),
      role: "menuitem",
      name: "Minimize",
      how: "menu bar Window > Minimize (mouse)",
      expected: "the key window goes to the Dock; its Dock tile brings it back",
    },
    {
      id: `${app}.menu.window-zoom`,
      window: m("Window"),
      role: "menuitem",
      name: "Zoom",
      how: "menu bar Window > Zoom (mouse), twice",
      expected: "the window grows to fill the desktop, then returns to its frame",
    },
    {
      id: `${app}.menu.window-bring-all`,
      window: m("Window"),
      role: "menuitem",
      name: "Bring All to Front",
      how: "menu bar Window > Bring All to Front (mouse)",
      expected: "the app stays in front, with its window above every other",
    },
    {
      id: `${app}.menu.window-item`,
      window: m("Window"),
      role: "menuitemcheckbox",
      name: windowItem,
      how: `menu bar Window, with the ${windowItem} window key (mouse)`,
      expected:
        "lists the window, checked as the key window (a minimised app's only window comes back from its Dock tile: the menu bar then names the next app, by design)",
    },
    {
      id: `${app}.menu.help`,
      window: m("Help"),
      role: "menuitem",
      name: `${appName} Help`,
      how: `menu bar Help > ${appName} Help (mouse)`,
      expected: "Help Viewer opens; its Close button closes it",
    },
    {
      id: `${app}.shortcut.hide`,
      window: m(appName),
      role: "shortcut",
      name: "⌘H",
      how: "Control+H (Command off Apple)",
      expected: "hides the app like Hide",
    },
    {
      id: `${app}.shortcut.quit`,
      window: m(appName),
      role: "shortcut",
      name: "⌘Q",
      how: "Control+Q",
      expected: "quits the app like Quit",
    },
    {
      id: `${app}.shortcut.close-window`,
      window: m("File"),
      role: "shortcut",
      name: "⌘W",
      how: "Control+W",
      expected: "closes the key window",
    },
    {
      id: `${app}.shortcut.minimize`,
      window: m("Window"),
      role: "shortcut",
      name: "⌘M",
      how: "Control+M",
      expected: "minimises the key window",
    },
    {
      id: `${app}.shortcut.full-screen`,
      window: m("View"),
      role: "shortcut",
      name: "⌃⌘F",
      how: "Control+Command+F",
      expected: "toggles full screen on an Apple keyboard",
      cell: CONTROL_COMMAND_NA,
      na: true,
    },
    {
      id: `${app}.shortcut.hide-others`,
      window: m(appName),
      role: "shortcut",
      name: "⌥⌘H",
      how: "Alt+Control+H, with Finder's window shown",
      expected: "Finder's window hides and the app's stays; Show All brings it back",
    },
  ];
  if (prefs === "window")
    rows.push({
      id: `${app}.shortcut.preferences`,
      window: m(appName),
      role: "shortcut",
      name: "⌘,",
      how: "Control+,",
      expected: "opens the Preferences window",
    });
  else
    rows.push({
      id: `${app}.shortcut.preferences`,
      window: m(appName),
      role: "shortcut",
      name: "⌘,",
      how: "Control+,",
      expected: "nothing: Preferences… is dimmed",
      cell: "unavailable:dimmed",
      dimmedShortcut: "Preferences…",
    });
  // An app with no full-screen menu item (FaceTime: its window's green button is the only way) lists no View rows.
  return fullScreenMenu
    ? rows
    : rows.filter((r) => !/\.(menu\.view-(exit-)?full-screen|shortcut\.full-screen)$/.test(r.id));
}

/** The chrome rows of one window kind: close, minimise, full screen, move by the title bar, eight resize edges. */
export function chromeRows(
  app,
  slug,
  windowName,
  { resizable = true, fullScreen = true, minimize = true } = {},
) {
  const id = (s) => `${app}.${slug}.${s}`;
  const rows = [
    {
      id: id("close"),
      window: windowName,
      role: "button",
      name: "Close",
      how: "the window's red button (mouse)",
      expected: "the window closes",
    },
    {
      id: id("move"),
      window: windowName,
      role: "drag",
      name: "title bar",
      how: "drag the title bar 60 px right and 40 px down (mouse)",
      expected: "the window moves by the same distance",
    },
  ];
  if (minimize)
    rows.push({
      id: id("minimize"),
      window: windowName,
      role: "button",
      name: "Minimize",
      how: "the window's yellow button (mouse)",
      expected: "the window goes to the Dock; the Window menu brings it back",
    });
  if (fullScreen)
    rows.push({
      id: id("full-screen"),
      window: windowName,
      role: "button",
      name: "Enter Full Screen",
      how: "the window's green button (mouse)",
      expected: "the window fills the screen; Exit Full Screen returns it",
    });
  if (resizable) {
    for (const edge of EDGES) {
      rows.push({
        id: id(`resize-${edge}`),
        window: windowName,
        role: "resize-handle",
        name: edge,
        how: `drag the ${EDGE_WORD[edge]} out 24 px and back (mouse)`,
        expected: "the window grows, then shrinks, along that edge",
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------------------------
// Verifiers.

/** The reason the page gives for a dimmed control: title, aria-description, aria-describedby, or a tooltip on hover. */
export async function reasonOf(page, locator) {
  await locator.hover({ timeout: 3_000 }).catch(() => {});
  await pause(600);
  const own = await locator
    .evaluate((element) => {
      const described = (element.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
      const holder = element.closest("[title]");
      return (
        element.getAttribute("aria-description") ||
        described ||
        element.getAttribute("title") ||
        holder?.getAttribute("title") ||
        ""
      );
    })
    .catch(() => "");
  if (own.trim()) return own.trim();
  const tip = page.getByRole("tooltip").last();
  if (await tip.isVisible().catch(() => false)) return (await tip.innerText()).trim();
  return "";
}

const openMenus = (page) => page.locator('[role="menu"][data-open]');
async function closeMenus(page) {
  for (
    let i = 0;
    i < 4 && (await page.locator('[role="menu"]').filter({ visible: true }).count());
    i++
  )
    await page.keyboard.press("Escape");
  await pause(150);
}

/** Open `title`, walk `path` (hovering submenus), and read the last item's state and reason; closes the menus. */
export async function menuItemReason(page, title, ...pathNames) {
  await closeMenus(page);
  await menuTitle(page, title).click({ timeout: 8_000 });
  // In the shared sequence a first click on a title has opened no menu (not reproduced alone: debug/window-menu.mjs);
  // it is clicked once more so the rest of the row is read, and the result says so: a row counts only on the first
  // click, so the caller fails a retried one (orchestrator, 24 Oct 09:28 UTC; the rule since 23 Oct 12:28).
  let retried = false;
  const opened = await openMenus(page)
    .last()
    .waitFor({ timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    retried = true;
    await menuTitle(page, title).click({ timeout: 8_000 });
    await openMenus(page).last().waitFor({ timeout: 5_000 });
  }
  let result = { missing: true, disabled: false, reason: "", text: "", retried };
  for (const [index, name] of pathNames.entries()) {
    const item = openMenuItem(page, name);
    if (!(await item.count())) break;
    if (index < pathNames.length - 1) {
      const before = await openMenus(page).count();
      await item.hover();
      await within(3_000, async () => (await openMenus(page).count()) > before);
      continue;
    }
    const state = await item.evaluate((element) => ({
      disabled:
        element.hasAttribute("data-disabled") || element.getAttribute("aria-disabled") === "true",
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
      checked: element.getAttribute("aria-checked") === "true",
    }));
    result = { missing: false, ...state, reason: await reasonOf(page, item), retried };
  }
  await closeMenus(page);
  return result;
}

/** The application the menu bar names now: its first title after the Apple menu. Read only. */
export async function frontApp(page) {
  return page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem")
    .nth(1)
    .innerText({ timeout: 2_000 })
    .catch(() => "");
}

/** Whether the window region `name` is on screen and not minimised. */
export async function shown(page, name) {
  const region = appWindow(page, name);
  if (!(await region.isVisible().catch(() => false))) return false;
  return !(await windowFrame(page, name)
    .evaluate((f) => f.hasAttribute("data-minimized"))
    .catch(() => true));
}

/**
 * The Dock tile of the minimised window `name` (a title, or a pattern for one): the Dock names it "<title>, minimized
 * window", so another window's tile is never taken for it.
 */
export function dockTile(page, name) {
  const label =
    name instanceof RegExp
      ? new RegExp(`^(?:${name.source.replace(/^\^|\$$/g, "")}), minimized window$`, name.flags)
      : `${name}, minimized window`;
  return page.getByRole("button", { name: label, exact: typeof label === "string" });
}

/** The frame's box. */
const box = (page, name) => windowFrame(page, name).boundingBox();

/** Every window frame on the desktop and whether it shows (not minimised, not hidden): the inventory a no-op keeps. */
export async function windowInventory(page) {
  return page.locator("[data-window-id]").evaluateAll((frames) =>
    frames
      .map((f) => {
        const r = f.getBoundingClientRect();
        const style = getComputedStyle(f);
        const showing =
          !f.hasAttribute("data-minimized") &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          r.width > 0;
        return `${f.getAttribute("data-window-id")}:${showing ? "shown" : "hidden"}`;
      })
      .sort()
      .join(" "),
  );
}

/** Whether box `b` is the same frame as `a`, within `px`. */
const sameFrame = (a, b, px = 3) =>
  a &&
  b &&
  Math.abs(a.x - b.x) <= px &&
  Math.abs(a.y - b.y) <= px &&
  Math.abs(a.width - b.width) <= px &&
  Math.abs(a.height - b.height) <= px;

/** Whether box `b` fills the desktop below the menu bar (the viewport less the 24 px bar, with a little slack). */
const fillsScreen = (page, b) => {
  const view = page.viewportSize();
  return b && b.width >= view.width - 4 && b.height >= view.height - 40;
};

/** A point inside `locator` that no button, field or link covers (a title bar's empty drag region). Read only. */
export async function emptyPoint(locator) {
  return locator.evaluate((bar) => {
    const r = bar.getBoundingClientRect();
    const busy =
      'button, a, input, textarea, select, [role="button"], [role="searchbox"], [role="textbox"], [role="combobox"], [role="tab"], [role="radio"], [role="group"][aria-label="Window controls"], [contenteditable]';
    for (const fy of [0.5, 0.25, 0.75, 0.15]) {
      for (let fx = 0.3; fx < 0.98; fx += 0.04) {
        const x = r.left + r.width * fx;
        const y = r.top + Math.min(r.height * fy, 26);
        const hit = document.elementFromPoint(x, y);
        if (hit && bar.contains(hit) && !hit.closest(busy)) return { x, y };
      }
    }
    return null;
  });
}

/**
 * An empty point of the window `name`'s drag surface: its title bar, or, for a window without one (Messages draws the
 * strip over its list and the bar over its transcript as drag regions, `data-window-drag-region`), the first of those
 * that has a point no control covers. Read only.
 */
export async function dragPoint(page, name) {
  const bars = await windowFrame(page, name)
    .locator("[data-title-bar], [data-window-drag-region]")
    .all();
  for (const bar of bars) {
    const point = await emptyPoint(bar).catch(() => null);
    if (point) return point;
  }
  return null;
}

/** The Dock names a minimised window by its app or by its title (Mail's viewer is "Mail, minimized window"). */
const tileOf = (page, windowName, windowItem) =>
  windowItem
    ? dockTile(page, windowName).or(dockTile(page, windowItem)).first()
    : dockTile(page, windowName);

/** Move the window to the middle of the desktop, so that no edge lies under the menu bar's extras or the Dock. */
async function clearOfTheEdges(page, name) {
  // A floating panel an earlier probe left open (the Character Viewer) would take the pointer over a window's corner.
  await page
    .locator(".mac-window")
    .filter({ has: page.locator(".mac-desktop-characters-body") })
    .getByRole("button", { name: "Close" })
    .first()
    .click({ timeout: 1_000 })
    .catch(() => {});
  const view = page.viewportSize();
  const at = await box(page, name);
  const from = await dragPoint(page, name);
  if (!at || !from) return;
  const x = Math.round((view.width - at.width) / 2);
  const y = Math.max(60, Math.round((view.height - at.height) / 2) - 20);
  await drag(page, from, { x: from.x + x - at.x, y: from.y + y - at.y }, 10);
  await pause(200);
}

/**
 * Verify one window's chrome with real pointer input: move by the title bar, each resize edge out and back, the
 * green button into full screen and out, the yellow button to the Dock and back through the Window menu, and the red
 * button closing it. `reopen()` brings the window back after it closes.
 */
export async function verifyChrome(
  page,
  {
    app,
    slug,
    windowName,
    windowItem,
    check,
    reopen,
    resizable = true,
    fullScreen = true,
    minimize = true,
  },
) {
  const id = (s) => `${app}.${slug}.${s}`;
  const frame = () => windowFrame(page, windowName);
  // Move: drag an empty point of the title bar (or of a drag region, for a window without a title bar).
  {
    const before = await box(page, windowName);
    // A title bar's controls can still be settling just after the window comes forward.
    let from = null;
    await within(3_000, async () => {
      from = await dragPoint(page, windowName);
      return from !== null;
    });
    if (!from || !before)
      check(id("move"), false, "no empty point on the title bar or a drag region");
    else {
      // Room to move: toward the centre of the viewport.
      const view = page.viewportSize();
      const dx = before.x + before.width / 2 > view.width / 2 ? -60 : 60;
      const dy = before.y > view.height / 3 ? -40 : 40;
      await drag(page, from, { x: from.x + dx, y: from.y + dy }, 10);
      const after = await box(page, windowName);
      check(
        id("move"),
        after && Math.abs(after.x - before.x - dx) <= 3 && Math.abs(after.y - before.y - dy) <= 3,
        `moved ${Math.round(after?.x - before.x)},${Math.round(after?.y - before.y)} for ${dx},${dy}`,
      );
    }
  }
  if (resizable) {
    await clearOfTheEdges(page, windowName);
    for (const edge of EDGES) {
      const handle = frame().locator(`[data-edge="${edge}"]`).first();
      const hb = await handle.boundingBox();
      const before = await box(page, windowName);
      if (!hb || !before) {
        check(id(`resize-${edge}`), false, "no handle");
        continue;
      }
      const sx = edge.includes("e") ? 1 : edge.includes("w") ? -1 : 0;
      const sy = edge.includes("s") ? 1 : edge.includes("n") ? -1 : 0;
      const from = { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 };
      await drag(page, from, { x: from.x + 24 * sx, y: from.y + 24 * sy }, 8);
      await pause(250);
      const grown = await box(page, windowName);
      await drag(page, { x: from.x + 24 * sx, y: from.y + 24 * sy }, from, 8);
      await pause(250);
      const back = await box(page, windowName);
      const grew =
        (sx === 0 || grown.width - before.width >= 12) &&
        (sy === 0 || grown.height - before.height >= 12);
      const anchored =
        (sx >= 0 || Math.abs(grown.x + grown.width - before.x - before.width) <= 2) &&
        (sy >= 0 || Math.abs(grown.y + grown.height - before.y - before.height) <= 2);
      const shrank =
        Math.abs(back.width - before.width) <= 3 && Math.abs(back.height - before.height) <= 3;
      check(
        id(`resize-${edge}`),
        grew && anchored && shrank,
        `${Math.round(before.width)}x${Math.round(before.height)} -> ${Math.round(grown.width)}x${Math.round(grown.height)} -> ${Math.round(back.width)}x${Math.round(back.height)}`,
      );
    }
  }
  if (fullScreen) {
    const before = await box(page, windowName);
    await windowControls(page, windowName)
      .getByRole("button", { name: "Enter Full Screen" })
      .click();
    const full = await within(4_000, async () => fillsScreen(page, await box(page, windowName)));
    // Out again with the same green button, now Exit Full Screen (the menu bar is the shared rows' business).
    await windowControls(page, windowName)
      .getByRole("button", { name: "Exit Full Screen" })
      .click({ timeout: 5_000 })
      .catch(() => {});
    const restored = await within(4_000, async () =>
      sameFrame(before, await box(page, windowName)),
    );
    const after = await box(page, windowName);
    const r = (b) =>
      b
        ? `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`
        : "none";
    check(
      id("full-screen"),
      full !== null && restored !== null,
      `full ${full} ms, restored ${restored} ms; ${r(before)} -> ${r(after)}`,
    );
  }
  if (minimize) {
    await windowControls(page, windowName).getByRole("button", { name: "Minimize" }).click();
    const gone = await within(4_000, async () => !(await shown(page, windowName)));
    // Which application the menu bar names now (macOS keeps the app whose window was minimised).
    // Back from the Dock: a minimised window has a Dock tile of its own ("<title>, minimized window"), as on macOS.
    const front = await frontApp(page);
    const tile = tileOf(page, windowName, windowItem);
    const hasTile = await tile.isVisible().catch(() => false);
    if (hasTile) await tile.click().catch(() => {});
    const back = await within(4_000, () => shown(page, windowName));
    check(
      id("minimize"),
      gone !== null && hasTile && back !== null,
      `minimised ${gone} ms; its Dock tile brought it back in ${back} ms (the menu bar named ${JSON.stringify(front)})`,
    );
    if (back === null) await reopen();
  }
  await windowControls(page, windowName).getByRole("button", { name: "Close" }).click();
  const closed = await within(
    5_000,
    async () =>
      !(await appWindow(page, windowName)
        .isVisible()
        .catch(() => false)),
  );
  check(id("close"), closed !== null, `closed ${closed} ms`);
  await reopen();
}

/**
 * Verify the shared menu rows of `app` with its window `windowName` in front: dimmed items show a reason, Services
 * opens its submenu, Hide/Quit/Close Window/Minimize/Zoom/full screen work from the menu and from their shortcuts.
 * `reopen()` opens the app again (from the Dock). `prefsWindow` names the Preferences window when Preferences… opens one.
 */
export async function verifyCommon(
  page,
  { app, appName, windowName, windowItem = appName, check, reopen, rows, prefsWindow = null },
) {
  const id = (s) => `${app}.${s}`;
  // A check that throws fails its own rows; the checks after it still run.
  const guard = async (ids, body) => {
    // A block whose rows this app does not list (FaceTime's View rows) is not run.
    if (!ids.some((each) => rows.some((r) => r.id === id(each)))) return;
    try {
      await body();
    } catch (error) {
      for (const each of ids)
        check(id(each), false, `aborted: ${String(error.message).split("\n")[0].slice(0, 160)}`);
      await page.screenshot({ path: `e2e/output/r6/${app}-abort-${ids[0]}.png` }).catch(() => {});
      await closeMenus(page);
    }
  };
  const ensure = async () => {
    if (!(await shown(page, windowName))) await reopen();
    // Bring it forward by an empty point of its title bar or drag region (a corner would be its Close button).
    const point = await dragPoint(page, windowName).catch(() => null);
    if (point) await page.mouse.click(point.x, point.y);
    // Still another app's menu bar (no empty point, or another window took the click): its Dock tile brings it front.
    if ((await frontApp(page)) !== appName)
      await openApp(page, appName, windowName).catch(() => {});
  };
  await ensure();
  // Dimmed rows: dimmed, and a reason the person can see.
  for (const row of rows.filter((r) => r.dimmed && r.window.startsWith("menu:"))) {
    const [title, ...sub] = row.window.slice(5).split(" > ");
    const state = await menuItemReason(page, title, ...sub, row.name).catch((error) => ({
      missing: true,
      error: String(error.message).split("\n")[0],
    }));
    if (state.error) {
      check(row.id, false, state.error);
      await closeMenus(page);
      continue;
    }
    const reason = row.selfReason ? state.text : state.reason;
    // A row counts only on the first click on its menu title: a retried click fails it.
    check(
      row.id,
      !state.missing && state.disabled && Boolean(reason) && !state.retried,
      `${state.missing ? "missing" : `disabled=${state.disabled} reason=${JSON.stringify(reason)}`}${state.retried ? `; the first click on ${title} opened no menu, the second did` : ""}`,
    );
  }
  // About… opens the app's About window, which names it; its Close button closes it.
  await guard(["menu.app-about"], async () => {
    await ensure();
    await menu(page, appName, `About ${appName}`);
    const about = page.locator(`.mac-desktop-shell-about[data-app="${app}"]`);
    const opened = await within(5_000, () => about.isVisible());
    const text = opened === null ? "" : await about.innerText();
    if (opened !== null)
      await about.getByRole("button", { name: "Close", exact: true }).first().click();
    const closed = await within(3_000, async () => (await about.count()) === 0);
    check(
      id("menu.app-about"),
      opened !== null && text.includes(appName) && closed !== null,
      `opened in ${opened} ms, naming ${appName}=${text.includes(appName)}, closed in ${closed} ms`,
    );
  });
  // The Edit menu lists its commands with their key equivalents.
  for (const row of rows.filter((r) => r.editKeys)) {
    await guard([row.id.slice(app.length + 1)], async () => {
      // "Undo Add Card": an item names what it would undo.
      const state = await menuItemReason(page, "Edit", new RegExp(`^${row.name}`));
      check(
        row.id,
        !state.missing && state.text.includes(row.editKeys) && !state.retried,
        state.missing ? "missing" : `${JSON.stringify(state.text)} disabled=${state.disabled}`,
      );
    });
  }
  // Help opens Help Viewer.
  await guard(["menu.help"], async () => {
    await ensure();
    await menu(page, "Help", `${appName} Help`);
    const viewer = page.locator('[data-window-id^="help-viewer"]').first();
    const opened = await within(6_000, () => viewer.isVisible());
    if (opened !== null)
      await viewer
        .getByRole("group", { name: "Window controls" })
        .first()
        .getByRole("button", { name: "Close" })
        .click();
    const closed = await within(3_000, async () => (await viewer.count()) === 0);
    check(
      id("menu.help"),
      opened !== null && closed !== null,
      `opened ${opened} ms, closed ${closed} ms`,
    );
  });
  // Services opens its submenu (the dimmed item inside was read above).
  await guard(["menu.app-services"], async () => {
    await menuTitle(page, appName).click();
    const before = await openMenus(page).count();
    await openMenuItem(page, "Services").hover();
    const opened = await within(3_000, async () => (await openMenus(page).count()) > before);
    const listed = await within(3_000, () => openMenuItem(page, "No Services Apply").isVisible());
    check(
      id("menu.app-services"),
      opened !== null && listed !== null,
      `submenu opened in ${opened} ms; No Services Apply shown in ${listed} ms`,
    );
    await closeMenus(page);
  });
  // A dimmed item's shortcut does nothing (Preferences, when dimmed): no window opens, closes or hides.
  // A second app's window (Finder, opened from the Dock) is on screen for this and for Hide Others below.
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .click()
    .catch(() => {});
  await pause(800);
  for (const row of rows.filter((r) => r.dimmedShortcut)) {
    await guard([row.id.slice(app.length + 1)], async () => {
      await ensure();
      const before = await windowInventory(page);
      await page.keyboard.press("ControlOrMeta+,");
      await pause(700);
      const after = await windowInventory(page);
      check(
        row.id,
        before === after && before.includes("shown"),
        after === before
          ? `windows unchanged (${before.split(" ").length})`
          : `before ${before} after ${after}`,
      );
    });
  }
  // Hide Others hides Finder's window and leaves the app's; Show All brings it back.
  await guard(["shortcut.hide-others"], async () => {
    await ensure();
    const finderIs = (inventory, state) => new RegExp(`finder[^ ]*:${state}`).test(inventory);
    const before = await windowInventory(page);
    await page.keyboard.press("Alt+ControlOrMeta+h");
    const hid = await within(3_000, async () => finderIs(await windowInventory(page), "hidden"));
    const during = await windowInventory(page);
    await menu(page, appName, "Show All");
    const back = await within(3_000, async () => finderIs(await windowInventory(page), "shown"));
    check(
      id("shortcut.hide-others"),
      finderIs(before, "shown") && hid !== null && (await shown(page, windowName)) && back !== null,
      `before ${before}; during ${during}; Show All in ${back} ms`,
    );
  });
  // Bring All to Front leaves the app in front, its window above every other.
  await guard(["menu.window-bring-all"], async () => {
    await ensure();
    await menu(page, "Window", "Bring All to Front");
    await pause(300);
    const topmost = await page.locator("[data-window-id]").evaluateAll((frames) => {
      const zOf = (frame) =>
        Number(getComputedStyle(frame.closest(".mac-managed-window") ?? frame).zIndex) || 0;
      const shownFrames = frames.filter((frame) => !frame.hasAttribute("data-minimized"));
      return shownFrames
        .reduce((top, frame) => (zOf(frame) >= zOf(top) ? frame : top))
        .getAttribute("data-window-id");
    });
    check(
      id("menu.window-bring-all"),
      (await frontApp(page)) === appName && topmost.startsWith(app),
      `front app ${await frontApp(page)}; top window ${topmost}`,
    );
  });
  // Hide from the menu, back from the Dock; the same from the shortcut.
  for (const [rowId, act] of [
    ["menu.app-hide", () => menu(page, appName, `Hide ${appName}`)],
    ["shortcut.hide", () => shortcut(page, "Command+h")],
  ]) {
    await guard([rowId], async () => {
      await ensure();
      await act();
      const hidden = await within(4_000, async () => !(await shown(page, windowName)));
      await openApp(page, appName, windowName).catch(() => {});
      const back = await within(6_000, () => shown(page, windowName));
      check(
        id(rowId),
        hidden !== null && back !== null,
        `hidden ${hidden} ms, shown again from the Dock ${back} ms`,
      );
    });
  }
  // In this sequence (and only here: a fresh repro opens it, debug/window-menu.mjs) a first click on Window has opened
  // no menu; Minimize is tried once more so the row's steps run, and the row fails, its detail saying the second click
  // was needed (a row counts only on the first click).
  let retried = false;
  const minimizeFromMenu = async () => {
    retried = false;
    try {
      await menu(page, "Window", "Minimize");
    } catch {
      retried = true;
      await closeMenus(page);
      await menu(page, "Window", "Minimize");
    }
  };
  // Minimize from the menu and the shortcut; the Window menu's item brings it back and is checked when key.
  for (const [rowId, act] of [
    ["menu.window-minimize", () => minimizeFromMenu()],
    ["shortcut.minimize", () => shortcut(page, "Command+m")],
  ]) {
    const ids = rowId === "menu.window-minimize" ? [rowId, "menu.window-item"] : [rowId];
    await guard(ids, async () => {
      await ensure();
      await act();
      const gone = await within(4_000, async () => !(await shown(page, windowName)));
      const front = await frontApp(page);
      // The app's only window comes back from its own Dock tile: with none of the app's windows showing, the menu bar
      const tile = tileOf(page, windowName, windowItem);
      const hasTile = await tile.isVisible().catch(() => false);
      if (hasTile) await tile.click().catch(() => {});
      const back = await within(4_000, () => shown(page, windowName));
      if (back === null) await openApp(page, appName, windowName).catch(() => {});
      check(
        id(rowId),
        gone !== null && hasTile && back !== null && !(rowId === "menu.window-minimize" && retried),
        `minimised ${gone} ms; its Dock tile ${hasTile ? `brought it back in ${back} ms` : "was not there"} (the menu bar named ${JSON.stringify(front)})${rowId === "menu.window-minimize" && retried ? "; the first click on Window opened no menu, the second did" : ""}`,
      );
      if (rowId === "menu.window-minimize") {
        // The window's own row: an app may list a command of the same name above it (Reminders ⌘0).
        await closeMenus(page);
        await menuTitle(page, "Window").click();
        const item = openMenus(page)
          .last()
          .getByRole("menuitemcheckbox", { name: windowItem, exact: true });
        const listed = await within(3_000, () => item.isVisible());
        const checked = listed !== null && (await item.getAttribute("aria-checked")) === "true";
        await closeMenus(page);
        check(
          id("menu.window-item"),
          listed !== null && checked,
          `listed=${listed !== null}; checked for the key window=${checked}`,
        );
      }
    });
  }
  // Zoom twice: grows, then returns.
  await guard(["menu.window-zoom"], async () => {
    await ensure();
    const before = await box(page, windowName);
    await menu(page, "Window", "Zoom");
    const grown = await within(3_000, async () => {
      const b = await box(page, windowName);
      return b && b.width * b.height > before.width * before.height * 1.1;
    });
    await menu(page, "Window", "Zoom");
    const back = await within(3_000, async () => sameFrame(before, await box(page, windowName)));
    check(
      id("menu.window-zoom"),
      grown !== null && back !== null,
      `grew ${grown} ms, back to its frame ${back} ms`,
    );
  });
  // Full screen from the View menu and back to the frame it had.
  await guard(["menu.view-full-screen", "menu.view-exit-full-screen"], async () => {
    await ensure();
    const before = await box(page, windowName);
    await menu(page, "View", "Enter Full Screen");
    const full = await within(4_000, async () => fillsScreen(page, await box(page, windowName)));
    check(id("menu.view-full-screen"), full !== null, `full in ${full} ms`);
    // A full-screen window covers the menu bar: the pointer at the top edge brings it in, as on a Mac.
    await page.mouse.move(400, 0);
    await pause(400);
    const reachable = await menuTitle(page, "View")
      .click({ timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    let back = null;
    if (reachable) {
      const item = openMenuItem(page, "Exit Full Screen");
      if ((await within(2_000, () => item.isVisible())) !== null) {
        await item.click({ timeout: 3_000 }).catch(() => {});
        back = await within(4_000, async () => sameFrame(before, await box(page, windowName)));
      }
    }
    check(
      id("menu.view-exit-full-screen"),
      back !== null,
      reachable
        ? `back to its frame in ${back} ms`
        : "the pointer at the top edge did not bring the menu bar in: View cannot be clicked",
    );
    if (back === null) {
      await closeMenus(page);
      await windowControls(page, windowName)
        .getByRole("button", { name: "Exit Full Screen" })
        .click({ timeout: 5_000 })
        .catch(() => {});
      await within(4_000, async () => sameFrame(before, await box(page, windowName)));
    }
  });
  // Preferences… opens a window, from the menu and from the shortcut.
  if (prefsWindow) {
    for (const [rowId, act] of [
      ["menu.app-preferences", () => menu(page, appName, "Preferences…")],
      ["shortcut.preferences", () => shortcut(page, "Command+,")],
    ]) {
      await guard([rowId], async () => {
        await ensure();
        await act();
        const opened = await within(5_000, () => appWindow(page, prefsWindow).isVisible());
        check(id(rowId), opened !== null, `${prefsWindow} opened in ${opened} ms`);
        if (opened !== null)
          await windowControls(page, prefsWindow).getByRole("button", { name: "Close" }).click();
        await within(
          3_000,
          async () =>
            !(await appWindow(page, prefsWindow)
              .isVisible()
              .catch(() => false)),
        );
      });
    }
  }
  // Close Window from the menu and the shortcut; Quit from the menu and the shortcut.
  for (const [rowId, act] of [
    ["menu.file-close-window", () => menu(page, "File", "Close Window")],
    ["shortcut.close-window", () => shortcut(page, "Command+w")],
    ["menu.app-quit", () => menu(page, appName, `Quit ${appName}`)],
    ["shortcut.quit", () => shortcut(page, "Command+q")],
  ]) {
    await guard([rowId], async () => {
      await ensure();
      await act();
      const closed = await within(
        5_000,
        async () =>
          !(await appWindow(page, windowName)
            .isVisible()
            .catch(() => false)),
      );
      check(id(rowId), closed !== null, `closed in ${closed} ms`);
    });
    await reopen().catch(() => {});
  }
  // The Control-Command shortcut cannot be typed off Apple: the row is n/a and records that the platform is not Apple.
  const platform = await page.evaluate(() => navigator.platform);
  if (rows.some((r) => r.id === id("shortcut.full-screen")))
    check(id("shortcut.full-screen"), !/Mac|iPhone|iPad/.test(platform), `platform ${platform}`);
}
