// R5 common census rows: what every app window of the desktop has, verified with real input in one app.
// Window chrome (close, minimise, full screen, move by the title bar, resize by each edge and corner) and the
// desktop-filled menu rows (the app menu, File > Close Window, Edit, View > Enter Full Screen, Window, Help) with
// the key equivalents they name. On Linux a menu's Command key is Control (src/lib/menu-key-commands.ts); a key
// equivalent naming Control and Command matches only on Apple platforms, so those keys are n/a here.

import {
  appWindow,
  chooseMenu,
  closeMenus,
  dockTile,
  menuBar,
  openApp,
  openMenuTitle,
  settleWindow,
} from "./r5-census-kit.mjs";

const EDGES = {
  n: [0, -30],
  ne: [30, -30],
  e: [30, 0],
  se: [30, 30],
  s: [0, 30],
  sw: [-30, 30],
  w: [-30, 0],
  nw: [-30, -30],
};
const MENU_FADE_MS = 400;
/** A reason a dimmed row may show: a phrase that says why, not just its label. */
export const REASON = /\S+\s+\S+\s+\S+/;

const near = (a, b, tolerance = 4) => Math.abs(a - b) <= tolerance;

/**
 * The common rows of the app `{ id, name }` (its Dock and window name). `preferences(page)` answers whether
 * the app's Preferences opened (or is undefined when the app has none: the row is then an `unavailable` one).
 * Leaves the app's window open and in front.
 */
export async function commonRows(
  c,
  page,
  { id, name, preferences, hasFileClose = true, fullScreen = true, viewMenu = true },
) {
  const win = () => appWindow(page, name);
  // Edit > Paste reads the browser's clipboard, which it answers only with this permission.
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  const reopen = async () => {
    if (
      !(await win()
        .isVisible()
        .catch(() => false))
    )
      await openApp(page, name);
    await settleWindow(page, win());
    return win();
  };
  const box = async () => (await win().boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const meta = (state, role, label, how, expect, persists = "none") => ({
    state,
    role,
    name: label,
    how,
    expect,
    persists,
  });
  const every = `window (every state)`;
  const hidden = async () => {
    await page.waitForTimeout(400);
    return !(await win()
      .isVisible()
      .catch(() => false));
  };
  const restoreFromDock = async () => {
    await dockTile(page, name).first().click();
    await win().waitFor({ state: "visible", timeout: 10_000 });
    await settleWindow(page, win());
  };
  const finderWindow = () => page.locator(".mac-finder").first();
  const openFinder = async () => {
    await dockTile(page, "Finder").first().click();
    await finderWindow().waitFor({ state: "visible", timeout: 10_000 });
    await settleWindow(page, finderWindow());
  };
  const titleBarPoint = async () => {
    const b = await box();
    // An empty spot of the title bar or toolbar: never a control, which takes the press itself.
    const spot = await page.evaluate(
      ({ x, y, w, label }) => {
        const control =
          'button, input, textarea, select, a, [role="button"], [role="tab"], [role="textbox"], [role="searchbox"], [role="combobox"], [role="radio"], [role="slider"], [role="group"], [role="tablist"], .mac-managed-window-resize';
        const candidates = [];
        for (const dy of [10, 18, 26, 34]) {
          for (let dx = 90; dx < w - 20; dx += 10) {
            const element = document.elementFromPoint(x + dx, y + dy);
            if (!element?.closest(`[aria-label="${label}"]`) || element.closest(control)) continue;
            const spaced = /space|title-bar|titlebar|toolbar/i.test(String(element.className));
            candidates.push({ x: x + dx, y: y + dy, spaced });
          }
        }
        return candidates.find((c) => c.spaced) ?? candidates[0] ?? null;
      },
      { x: b.x, y: b.y, w: b.width, label: name },
    );
    return spot ?? { x: b.x + b.width / 2 + 40, y: b.y + 10 };
  };
  /** The app the menu bar is for (its first title after the Apple menu). */
  const activeApp = async () =>
    (
      (await menuBar(page)
        .getByRole("menuitem")
        .nth(1)
        .innerText()
        .catch(() => "")) || ""
    ).trim();
  /** Make the app active with its window in front (its Dock tile when another app is active), then give the
   * window the keyboard with a press on an empty spot of its title bar. */
  const focusWin = async () => {
    if (
      (await activeApp()) !== name ||
      !(await win()
        .isVisible()
        .catch(() => false))
    ) {
      await dockTile(page, name).first().click();
      await win().waitFor({ state: "visible", timeout: 10_000 });
      await settleWindow(page, win());
    }
    const p = await titleBarPoint();
    await page.mouse.click(p.x, p.y);
  };
  await reopen();

  await c.check(
    `${id}.window.close`,
    async () => {
      await win().getByRole("button", { name: "Close" }).first().click();
      const gone = await hidden();
      await reopen();
      return {
        ok: gone && (await win().isVisible()),
        detail: `closed ${gone}, reopened from the Dock`,
      };
    },
    meta(
      every,
      "button",
      "Close",
      "click the close button",
      "the window closes; the Dock opens it again",
    ),
  );
  await c.check(
    `${id}.window.minimize`,
    async () => {
      await win().getByRole("button", { name: "Minimize" }).first().click();
      const gone = await hidden();
      await restoreFromDock();
      return { ok: gone, detail: `minimised ${gone}, restored from the Dock` };
    },
    meta(
      every,
      "button",
      "Minimize",
      "click the minimise button",
      "the window goes to the Dock; its tile brings it back",
    ),
  );
  const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
  const exitFullScreen = async () => {
    const exit = win().getByRole("button", { name: /Exit Full Screen/ });
    if ((await exit.count()) > 0 && (await exit.first().isVisible())) await exit.first().click();
    else await chooseMenu(page, "View", "Exit Full Screen");
    await page.waitForTimeout(500);
  };
  if (fullScreen) {
    await c.check(
      `${id}.window.full-screen`,
      async () => {
        const before = await box();
        await win().getByRole("button", { name: "Enter Full Screen" }).first().click();
        await page.waitForTimeout(600);
        const full = await box();
        await exitFullScreen();
        const after = await box();
        const filled = full.width >= viewport.width - 4 && full.height >= viewport.height - 60;
        return {
          ok: filled && near(after.width, before.width, 6) && near(after.height, before.height, 6),
          detail: `${Math.round(before.width)}x${Math.round(before.height)} at ${Math.round(before.x)},${Math.round(before.y)} -> ${Math.round(full.width)}x${Math.round(full.height)} in full screen -> back to ${Math.round(after.width)}x${Math.round(after.height)} at ${Math.round(after.x)},${Math.round(after.y)}`,
        };
      },
      meta(
        every,
        "button",
        "Enter Full Screen",
        "click the green button, then Exit Full Screen",
        "the window fills the screen and comes back to its size",
      ),
    );
  }
  await c.check(
    `${id}.window.move-title-bar`,
    async () => {
      const before = await box();
      const from = await titleBarPoint();
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 40, from.y + 50, { steps: 8 });
      await page.mouse.up();
      const after = await box();
      return {
        ok: near(after.x - before.x, 40, 6) && near(after.y - before.y, 50, 6),
        detail: `moved by ${Math.round(after.x - before.x)},${Math.round(after.y - before.y)}`,
      };
    },
    meta("window", "drag", "title bar", "drag the title bar by 40,50", "the window moves by 40,50"),
  );
  // Every edge in reach: the window made small enough to sit above the Dock with room around it (from its top and
  // left edges, which are on screen), then moved near the top left, so that each edge can be dragged 30 px outward.
  const handleOf = (edge) =>
    page
      .locator(".mac-managed-window")
      .filter({ has: win() })
      .locator(`.mac-managed-window-resize[data-edge="${edge}"]`)
      .first();
  const dragBy = async (locator, dx, dy) => {
    const h = await locator.boundingBox();
    if (!h) return;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + dx, h.y + h.height / 2 + dy, { steps: 8 });
    await page.mouse.up();
  };
  const moveTo = async (x, y) => {
    const b = await box();
    const from = await titleBarPoint();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + (x - b.x), from.y + (y - b.y), { steps: 8 });
    await page.mouse.up();
  };
  const fitWindow = async () => {
    const dockTop =
      (await page.locator(".mac-dock").first().boundingBox())?.y ?? viewport.height - 80;
    let b = await box();
    const roomH = dockTop - 60 - 70;
    const roomW = viewport.width - 60 - 90;
    if (b.height > roomH) await dragBy(handleOf("n"), 0, b.height - roomH);
    b = await box();
    if (b.width > roomW) await dragBy(handleOf("w"), b.width - roomW, 0);
    await moveTo(90, 70);
    return box();
  };
  const fitted = await fitWindow();
  await c.check(
    `${id}.window.fit-above-dock`,
    async () => {
      const dockTop = (await page.locator(".mac-dock").first().boundingBox())?.y ?? viewport.height;
      return {
        ok: fitted.y + fitted.height + 30 <= dockTop,
        detail: `${Math.round(fitted.x)},${Math.round(fitted.y)} ${Math.round(fitted.width)}x${Math.round(fitted.height)}; Dock at y ${Math.round(dockTop)}`,
      };
    },
    meta(
      "window",
      "resize-handle",
      "n",
      "drag the top edge down and the left edge right, then the title bar",
      "the window shrinks from those edges and moves; its bottom edge is clear of the Dock",
    ),
  );
  for (const [edge, [dx, dy]] of Object.entries(EDGES)) {
    await c.check(
      `${id}.window.resize-${edge}`,
      async () => {
        const handle = page
          .locator(".mac-managed-window")
          .filter({ has: win() })
          .locator(`.mac-managed-window-resize[data-edge="${edge}"]`)
          .first();
        const before = await box();
        const hb = await handle.boundingBox();
        if (!hb) return { ok: false, detail: `no ${edge} handle` };
        const sx = hb.x + hb.width / 2;
        const sy = hb.y + hb.height / 2;
        await page.mouse.move(sx, sy);
        await page.mouse.down();
        await page.mouse.move(sx + dx, sy + dy, { steps: 6 });
        await page.mouse.up();
        const after = await box();
        const grewW = dx === 0 ? near(after.width, before.width) : after.width - before.width >= 20;
        const grewH =
          dy === 0 ? near(after.height, before.height) : after.height - before.height >= 20;
        const leftOk = dx < 0 ? before.x - after.x >= 20 : near(after.x, before.x);
        const topOk = dy < 0 ? before.y - after.y >= 20 : near(after.y, before.y);
        // Put it back with the opposite drag, so the next edge starts from the same window.
        const hb2 = await handle.boundingBox();
        if (hb2) {
          await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2);
          await page.mouse.down();
          await page.mouse.move(hb2.x + hb2.width / 2 - dx, hb2.y + hb2.height / 2 - dy, {
            steps: 6,
          });
          await page.mouse.up();
        }
        return {
          ok: grewW && grewH && leftOk && topOk,
          detail: `${Math.round(before.x)},${Math.round(before.y)} ${Math.round(before.width)}x${Math.round(before.height)} -> ${Math.round(after.x)},${Math.round(after.y)} ${Math.round(after.width)}x${Math.round(after.height)}`,
        };
      },
      meta(
        "window",
        "resize-handle",
        edge,
        `drag the ${edge} edge outward by 30 px`,
        "the window grows on that side only",
      ),
    );
  }

  // ── The app menu ──
  const menuRow = (title, item) =>
    openMenuTitle(page, title).then((menu) =>
      menu.getByRole("menuitem", { name: item, exact: true }).first(),
    );
  /** Open the menu `title` and read its row `item`: dimmed (with the reason it shows) or chosen. */
  const choose = async (title, item) => {
    const row = await menuRow(title, item);
    await row.waitFor({ timeout: 5_000 });
    const state = await row.evaluate((e) => ({
      disabled: e.getAttribute("aria-disabled") === "true" || e.matches(":disabled"),
      title: e.getAttribute("title") ?? "",
    }));
    if (state.disabled) {
      await closeMenus(page);
      return { dimmed: true, reason: state.title };
    }
    await row.click();
    return { dimmed: false };
  };
  /** The verdict of a row found dimmed: it passes only with a reason shown. */
  const dimmedVerdict = (reason) =>
    REASON.test(reason)
      ? { ok: true, detail: `dimmed; reason "${reason}"` }
      : { ok: false, detail: `dimmed with no reason shown (desktop-menus.tsx)` };
  await c.check(
    `${id}.menu-app.about`,
    async () => {
      await focusWin();
      const row = await menuRow(name, `About ${name}`);
      const state = await row.evaluate((e) => ({
        disabled: e.getAttribute("aria-disabled") === "true" || e.matches(":disabled"),
        title: e.getAttribute("title") ?? "",
      }));
      if (!state.disabled) {
        await row.click();
        const about = page
          .getByRole("dialog")
          .or(page.getByRole("region", { name: new RegExp(`About ${name}`) }))
          .first();
        const shown = await about.waitFor({ timeout: 5_000 }).then(
          () => true,
          () => false,
        );
        if (shown) await about.getByRole("button", { name: "Close" }).first().click();
        return { ok: shown, detail: `enabled; about panel shown ${shown}` };
      }
      await closeMenus(page);
      return { ok: REASON.test(state.title), detail: `dimmed; reason shown: "${state.title}"` };
    },
    meta(
      `menu:${name}`,
      "menuitem",
      `About ${name}`,
      `${name} menu > About ${name}`,
      "an About panel, or dimmed with its reason",
    ),
  );
  await c.check(
    `${id}.menu-app.preferences`,
    async () => {
      await focusWin();
      const windowsBefore = await page.locator(".mac-window").count();
      const row = await menuRow(name, "Preferences…");
      const state = await row.evaluate((e) => ({
        disabled: e.getAttribute("aria-disabled") === "true" || e.matches(":disabled"),
        title: e.getAttribute("title") ?? "",
      }));
      if (state.disabled) {
        await closeMenus(page);
        return { ok: REASON.test(state.title), detail: `dimmed; reason shown: "${state.title}"` };
      }
      await row.click();
      if (preferences) {
        const ok = await preferences(page);
        return { ok, detail: "enabled; the app's preferences opened" };
      }
      // An app with preferences of its own opens a window for them.
      const windows = page.locator(".mac-window");
      let opened = false;
      for (let waited = 0; !opened && waited < 5_000; waited += 200) {
        opened = (await windows.count()) > windowsBefore;
        if (!opened) await page.waitForTimeout(200);
      }
      if (opened)
        await windows.last().getByRole("button", { name: "Close", exact: true }).first().click();
      return {
        ok: opened,
        detail: opened ? "the Preferences window opened and closed" : "no window opened",
      };
    },
    meta(
      `menu:${name}`,
      "menuitem",
      "Preferences…",
      `${name} menu > Preferences…`,
      "the app's preferences open, or dimmed with its reason",
    ),
  );
  await c.check(
    `${id}.menu-app.services`,
    async () => {
      const menu = await openMenuTitle(page, name);
      await menu.getByRole("menuitem", { name: "Services", exact: true }).first().hover();
      await page.waitForTimeout(400);
      const sub = page
        .getByRole("menu")
        .last()
        .getByRole("menuitem", { name: "No Services Apply" });
      const dimmed = await sub.first().getAttribute("aria-disabled");
      await closeMenus(page);
      return { ok: dimmed === "true", detail: `Services > "No Services Apply" dimmed ${dimmed}` };
    },
    meta(
      `menu:${name}`,
      "menuitem",
      "Services",
      `${name} menu > Services`,
      "its submenu says No Services Apply, dimmed",
    ),
  );
  await c.check(
    `${id}.menu-app.services-none`,
    async () => {
      const menu = await openMenuTitle(page, name);
      await menu.getByRole("menuitem", { name: "Services", exact: true }).first().hover();
      await page.waitForTimeout(400);
      const sub = page
        .getByRole("menu")
        .last()
        .getByRole("menuitem", { name: "No Services Apply" });
      const text = await sub.first().innerText();
      const dimmed = await sub.first().getAttribute("aria-disabled");
      await closeMenus(page);
      return {
        ok: dimmed === "true" && /No Services Apply/.test(text),
        detail: `dimmed ${dimmed}; its text is the reason`,
      };
    },
    meta(
      `menu:${name}>Services`,
      "menuitem",
      "No Services Apply",
      "hover Services",
      "dimmed; the row itself says why",
      "none",
    ),
  );
  await c.check(
    `${id}.menu-app.hide`,
    async () => {
      await focusWin();
      await chooseMenu(page, name, `Hide ${name}`);
      const gone = await hidden();
      await restoreFromDock();
      return { ok: gone, detail: `hidden ${gone}, shown again from the Dock` };
    },
    meta(
      `menu:${name}`,
      "menuitem",
      `Hide ${name}`,
      `${name} menu > Hide ${name}`,
      "the app's windows hide; the Dock shows them again",
    ),
  );
  await c.check(
    `${id}.key.hide`,
    async () => {
      await focusWin();
      await page.keyboard.press("Control+KeyH");
      const gone = await hidden();
      if (gone) await restoreFromDock();
      return { ok: gone, detail: `Control+H hid it: ${gone}` };
    },
    meta("keyboard", "shortcut", "⌘H", "Control+H (Command on Linux)", "the app hides"),
  );
  // Hide Others and Show All, with Finder's window open beside the app.
  await c.check(
    `${id}.menu-app.hide-others`,
    async () => {
      await openFinder();
      await focusWin();
      const chosen = await choose(name, "Hide Others");
      if (chosen.dimmed) return dimmedVerdict(chosen.reason);
      await page.waitForTimeout(500);
      const finderHidden = !(await finderWindow().isVisible());
      const stillShown = await win().isVisible();
      return {
        ok: finderHidden && stillShown,
        detail: `Finder hidden ${finderHidden}, ${name} shown ${stillShown}`,
      };
    },
    meta(
      `menu:${name}`,
      "menuitem",
      "Hide Others",
      `open Finder, then ${name} menu > Hide Others`,
      "other apps' windows hide, this one stays",
    ),
  );
  await c.check(
    `${id}.menu-app.show-all`,
    async () => {
      await focusWin();
      const chosen = await choose(name, "Show All");
      if (chosen.dimmed) {
        if (
          await finderWindow()
            .isVisible()
            .catch(() => false)
        ) {
          await finderWindow()
            .getByRole("button", { name: "Close" })
            .first()
            .click()
            .catch(() => {});
          await finderWindow()
            .waitFor({ state: "hidden", timeout: 10_000 })
            .catch(() => {});
        }
        return dimmedVerdict(chosen.reason);
      }
      const shown = await finderWindow()
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(
          () => true,
          () => false,
        );
      if (shown) {
        // Show All leaves it behind this window, so its button is pressed from script.
        await finderWindow()
          .getByRole("button", { name: "Close" })
          .first()
          .evaluate((button) => button.click());
        await finderWindow()
          .waitFor({ state: "hidden", timeout: 10_000 })
          .catch(() => {});
      }
      await reopen();
      await focusWin();
      return { ok: shown, detail: `Finder shown again: ${shown}` };
    },
    meta(
      `menu:${name}`,
      "menuitem",
      "Show All",
      `${name} menu > Show All`,
      "the hidden windows show again",
    ),
  );
  await c.check(
    `${id}.menu-app.quit`,
    async () => {
      await focusWin();
      const chosen = await choose(name, `Quit ${name}`);
      if (chosen.dimmed) return dimmedVerdict(chosen.reason);
      const gone = await hidden();
      await reopen();
      return { ok: gone, detail: `quit ${gone}, opened again` };
    },
    meta(
      `menu:${name}`,
      "menuitem",
      `Quit ${name}`,
      `${name} menu > Quit ${name}`,
      "the app's windows close",
    ),
  );
  await c.check(
    `${id}.key.quit`,
    async () => {
      await focusWin();
      await page.keyboard.press("Control+KeyQ");
      const gone = await hidden();
      await reopen();
      return { ok: gone, detail: `Control+Q quit it: ${gone}` };
    },
    meta("keyboard", "shortcut", "⌘Q", "Control+Q (Command on Linux)", "the app quits"),
  );
  if (hasFileClose) {
    await c.check(
      `${id}.menu-file.close-window`,
      async () => {
        await focusWin();
        const chosen = await choose("File", "Close Window");
        if (chosen.dimmed) return dimmedVerdict(chosen.reason);
        const gone = await hidden();
        await reopen();
        return { ok: gone, detail: `closed ${gone}` };
      },
      meta("menu:File", "menuitem", "Close Window", "File > Close Window", "the window closes"),
    );
  }
  // ── Edit: the desktop fills these rows dimmed (desktop-menus.tsx); dimmed passes only with a reason shown, and
  // an enabled row is chosen against the window's own text field and its effect read back ──
  const field = win()
    .locator('input[type="text"], input[type="search"], input:not([type]), textarea')
    .first();
  // The shared Edit rows wait for the menu to fade before they act (`desktop-edit-rows.tsx`).
  const settledOn = async (read, wanted) => {
    for (let waited = 0; waited < 2_000; waited += 100) {
      if (wanted(await read())) break;
      await page.waitForTimeout(100);
    }
    return read();
  };
  const editEffect = async (item) => {
    if ((await field.count()) === 0)
      return { ok: false, detail: "enabled, but the window has no text field to try it on" };
    await field.click();
    await field.fill("census edit");
    const value = () => field.inputValue();
    const selected = () =>
      field.evaluate((e) => [e.selectionStart, e.selectionEnd, e.value.length]);
    if (item === "Select All") {
      await chooseMenu(page, "Edit", item);
      const [s, e, n] = await settledOn(
        selected,
        ([from, to, length]) => from === 0 && to === length,
      );
      return { ok: s === 0 && e === n && n > 0, detail: `selection ${s}-${e} of ${n}` };
    }
    if (item === "Copy" || item === "Cut" || item === "Paste") {
      await field.press("Control+KeyA");
      await chooseMenu(page, "Edit", item === "Paste" ? "Copy" : item);
      const afterFirst = await settledOn(value, (text) => item !== "Cut" || text === "");
      // The copy runs once the menu has faded; the field is emptied only after that.
      await page.waitForTimeout(MENU_FADE_MS);
      await field.fill("");
      await chooseMenu(page, "Edit", "Paste");
      // WebKit refuses a page `navigator.clipboard.readText`. The app's sheet then says so and holds the
      // window, which takes the field out of the accessibility tree, until it is closed.
      const refusal = page
        .locator('[role="dialog"], [role="alertdialog"]')
        .filter({ hasText: "did not let the menu paste" });
      const pasted = await settledOn(
        async () =>
          (await refusal.isVisible()) ? null : field.inputValue({ timeout: 500 }).catch(() => ""),
        (text) => text === null || text === "census edit",
      );
      if (pasted === null) {
        const said = (await refusal.innerText()).replace(/\s+/g, " ");
        await refusal.getByRole("button", { name: "OK" }).click();
        await refusal.waitFor({ state: "hidden" });
        const webkit = page.context().browser()?.browserType().name() === "webkit";
        return {
          ok: webkit && (item !== "Cut" || afterFirst === ""),
          detail: `after ${item}: "${afterFirst}"; the browser refused the paste, the app said "${said}"`,
        };
      }
      const ok =
        item === "Cut" ? afterFirst === "" && pasted === "census edit" : pasted === "census edit";
      return { ok, detail: `after ${item}: "${afterFirst}", pasted "${pasted}"` };
    }
    await field.press("End");
    await page.keyboard.type("!");
    await chooseMenu(page, "Edit", "Undo");
    const undone = await settledOn(value, (text) => text === "census edit");
    if (item === "Undo") return { ok: undone === "census edit", detail: `after Undo: "${undone}"` };
    await chooseMenu(page, "Edit", "Redo");
    const redone = await settledOn(value, (text) => text === "census edit!");
    return { ok: redone === "census edit!", detail: `after Redo: "${redone}"` };
  };
  for (const item of ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"]) {
    await c.check(
      `${id}.menu-edit.${item.toLowerCase().replace(/\s+/g, "-")}`,
      async () => {
        await focusWin();
        if ((await field.count()) > 0) {
          await field.click();
          // Cut and Copy offer themselves only with text selected, as a person would have it.
          if (item === "Cut" || item === "Copy") {
            await field.fill("census edit");
            await field.press("Control+KeyA");
          }
        }
        const row = await menuRow("Edit", item);
        const state = await row.evaluate((e) => ({
          disabled: e.getAttribute("aria-disabled") === "true",
          title: e.getAttribute("title") ?? "",
        }));
        await closeMenus(page);
        if (!state.disabled) return editEffect(item);
        const reasoned = REASON.test(state.title);
        return {
          ok: reasoned,
          detail: reasoned
            ? `dimmed; reason "${state.title}"`
            : `dimmed with no reason shown (desktop-menus.tsx); title "${state.title}"`,
        };
      },
      meta(
        "menu:Edit",
        "menuitem",
        item,
        `Edit > ${item} with the window's text field focused`,
        "works on the focused text, or is dimmed with its reason",
      ),
    );
  }
  if (fullScreen && viewMenu) {
    await c.check(
      `${id}.menu-view.full-screen`,
      async () => {
        await focusWin();
        await chooseMenu(page, "View", "Enter Full Screen");
        await page.waitForTimeout(600);
        const full = await box();
        await exitFullScreen();
        return {
          ok: full.width >= viewport.width - 4,
          detail: `${Math.round(full.width)}x${Math.round(full.height)}`,
        };
      },
      meta(
        "menu:View",
        "menuitem",
        "Enter Full Screen",
        "View > Enter Full Screen",
        "the window fills the screen",
      ),
    );
    await c.na(
      `${id}.key.full-screen`,
      "⌃⌘F names Control and Command, which match only on Apple platforms (menu-key-commands.ts); View > Enter Full Screen is verified",
      meta(
        "keyboard",
        "shortcut",
        "⌃⌘F",
        "Control+Command+F",
        "the window fills the screen (Apple platforms only)",
      ),
      async () => {
        await focusWin();
        await page.keyboard.press("Control+Meta+KeyF");
        await page.waitForTimeout(600);
        const full = await box();
        await exitFullScreen();
        return {
          ok: full.width >= viewport.width - 4,
          detail: `${Math.round(full.width)}x${Math.round(full.height)}`,
        };
      },
    );
  }
  // ── Window ──
  await c.check(
    `${id}.menu-window.minimize`,
    async () => {
      await focusWin();
      const chosen = await choose("Window", "Minimize");
      if (chosen.dimmed) return dimmedVerdict(chosen.reason);
      const gone = await hidden();
      await restoreFromDock();
      return { ok: gone, detail: `minimised ${gone}` };
    },
    meta("menu:Window", "menuitem", "Minimize", "Window > Minimize", "the window goes to the Dock"),
  );
  await c.check(
    `${id}.key.minimize`,
    async () => {
      await focusWin();
      await page.keyboard.press("Control+KeyM");
      const gone = await hidden();
      if (gone) await restoreFromDock();
      return { ok: gone, detail: `Control+M minimised it: ${gone}` };
    },
    meta("keyboard", "shortcut", "⌘M", "Control+M (Command on Linux)", "the window minimises"),
  );
  await c.check(
    `${id}.menu-window.zoom`,
    async () => {
      await focusWin();
      const before = await box();
      const first = await choose("Window", "Zoom");
      if (first.dimmed) return dimmedVerdict(first.reason);
      await page.waitForTimeout(500);
      const zoomed = await box();
      await focusWin();
      const second = await choose("Window", "Zoom");
      if (second.dimmed)
        return { ok: false, detail: `Zoom dimmed after zooming: "${second.reason}"` };
      await page.waitForTimeout(500);
      const back = await box();
      return {
        ok:
          zoomed.width * zoomed.height > before.width * before.height &&
          near(back.width, before.width, 6),
        detail: `${Math.round(before.width)}x${Math.round(before.height)} -> ${Math.round(zoomed.width)}x${Math.round(zoomed.height)} -> ${Math.round(back.width)}x${Math.round(back.height)}`,
      };
    },
    meta(
      "menu:Window",
      "menuitem",
      "Zoom",
      "Window > Zoom, twice",
      "the window fills the space, then returns",
    ),
  );
  await c.check(
    `${id}.menu-window.bring-all-to-front`,
    async () => {
      // Finder's window over this one, with this app still the active one (its name is the menu bar's app menu).
      await openFinder();
      const finder = finderWindow();
      let lastUnder = "";
      const centre = async () => {
        const b = await box();
        const { inside, under } = await win().evaluate(
          (element, { x, y }) => {
            const at = document.elementFromPoint(x, y);
            return {
              inside: element.contains(at),
              under: `${at?.tagName}.${at?.className}`.slice(0, 80),
            };
          },
          { x: b.x + b.width / 2, y: b.y + b.height / 2 },
        );
        lastUnder = under;
        return inside;
      };
      const activeAppNow = activeApp;
      let result;
      const coveredBefore = !(await centre());
      const active = await activeAppNow();
      // A one-window app has no state in which it is active and its only window is covered: every route that
      // covers it (Finder, another app) makes that app active, and making this one active raises its window.
      // Then the row's effect is read as: chosen, the app's window is in front and the app stays active.
      if (active !== name) await focusWin();
      const row = await menuRow("Window", "Bring All to Front");
      const state = await row.evaluate((e) => ({
        disabled: e.getAttribute("aria-disabled") === "true",
        title: e.getAttribute("title") ?? "",
      }));
      if (state.disabled) {
        await closeMenus(page);
        const reasoned = REASON.test(state.title);
        result = {
          ok: reasoned,
          detail: reasoned
            ? `dimmed; reason "${state.title}"`
            : "dimmed with no reason shown (desktop-menus.tsx)",
        };
      } else {
        await row.click();
        await page.waitForTimeout(400);
        const front = await centre();
        const stillActive = (await activeAppNow()) === name;
        result = {
          ok: front && stillActive,
          detail: `covered before ${coveredBefore} (active app then ${active}); after: in front ${front} (at the centre: ${lastUnder}), ${name} active ${stillActive}${coveredBefore && active === name ? "" : "; a one-window app cannot be active and covered, so no stacking change can show"}`,
        };
      }
      await finder
        .getByRole("button", { name: "Close" })
        .first()
        .click()
        .catch(() => {});
      await finder.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
      await reopen();
      await focusWin().catch(() => {});
      return result;
    },
    meta(
      "menu:Window",
      "menuitem",
      "Bring All to Front",
      "open Finder over the window, then Window > Bring All to Front",
      "brings the app's windows forward, or dimmed with its reason",
    ),
  );
  await c.check(
    `${id}.menu-window.window-item`,
    async () => {
      await focusWin();
      const menu = await openMenuTitle(page, "Window");
      const item = menu.getByRole("menuitemcheckbox", { name }).first();
      const checked = await item.getAttribute("aria-checked");
      await item.click();
      await page.waitForTimeout(300);
      return { ok: checked === "true" && (await win().isVisible()), detail: `checked ${checked}` };
    },
    meta(
      "menu:Window",
      "menuitemcheckbox",
      name,
      `Window > ${name}`,
      "the window is checked and comes to the front",
    ),
  );
  await c.check(
    `${id}.menu-help.help`,
    async () => {
      await focusWin();
      const row = await menuRow("Help", `${name} Help`);
      const state = await row.evaluate((e) => ({
        disabled: e.getAttribute("aria-disabled") === "true",
        title: e.getAttribute("title") ?? "",
      }));
      if (!state.disabled) {
        await row.click();
        const help = appWindow(page, "Help Viewer")
          .or(page.getByRole("region", { name: /Help/ }))
          .first();
        const shown = await help.waitFor({ timeout: 8_000 }).then(
          () => true,
          () => false,
        );
        return { ok: shown, detail: "enabled; Help Viewer opened" };
      }
      await closeMenus(page);
      const reasoned = REASON.test(state.title);
      return {
        ok: reasoned,
        detail: reasoned
          ? `dimmed; reason "${state.title}"`
          : "dimmed with no reason shown (desktop-menus.tsx)",
      };
    },
    meta(
      "menu:Help",
      "menuitem",
      `${name} Help`,
      `Help > ${name} Help`,
      "opens the app's help, or dimmed with its reason",
    ),
  );
  await closeMenus(page);
  await reopen();
}
