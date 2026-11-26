// R4 app-level census rows shared by every R4 app: the app menu (About, Preferences, Services, Hide, Hide Others,
// Show All, Quit), File > Close Window, View > Enter Full Screen, the Window menu (Minimize, Zoom, Bring All to Front,
// the window's own item), Help, and the window's own controls (move, every resize edge and corner, minimise, full
// screen, close). The menu bar and the window manager are R2's code; these rows check them as they show in R4's
// apps. A dimmed item passes only as unavailable with a reason the person can see.

import {
  acceptUnload,
  chooseMenu,
  createAccount,
  dontSave,
  frameOf,
  newIdentity,
  openMenu,
  reload,
  sleep,
  until,
  windowChromeRows,
} from "./r4-census-kit.mjs";
import { press, slug } from "./r4-editor-rows.mjs";

/** A second page in the same browser context (the same account's session): the desktop, signed in. */
export async function samePage(ctx) {
  const page = await ctx.context.newPage();
  acceptUnload(page);
  await page.goto(`${ctx.opts.base}/`, { waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await sleep(600);
  return page;
}

/** A second account, made at the login window in a new browser context: { page, close }. */
export async function otherAccount(ctx, prefix) {
  const context = await ctx.browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  acceptUnload(page);
  await page.goto(`${ctx.opts.base}/`, { waitUntil: "load" });
  await createAccount(page, newIdentity(prefix, ctx.opts.browserName));
  return { page, close: () => context.close().catch(() => {}) };
}

/** Choose `value` in a pop-up control: a native <select> by its own selection, else a click on it and on the option. */
export async function choosePopup(page, control, value) {
  const tag = await control.evaluate((element) => element.tagName);
  if (tag === "SELECT") {
    await control.selectOption({ label: value });
    await sleep(250);
    return;
  }
  await control.click();
  const pick = page
    .getByRole("option", { name: value, exact: true })
    .or(page.getByRole("menuitemradio", { name: value, exact: true }))
    .or(page.getByRole("menuitem", { name: value, exact: true }))
    .last();
  await pick.waitFor({ timeout: 4_000 });
  await pick.click();
  await sleep(250);
}

/** The names a pop-up control offers: its <option>s, or the options of the list a click opens (closed with Escape). */
export async function popupOptions(page, control) {
  const tag = await control.evaluate((element) => element.tagName);
  if (tag === "SELECT")
    return control.evaluate((element) => [...element.options].map((option) => option.label.trim()));
  await control.click();
  await sleep(300);
  const list = page.getByRole("listbox").or(page.getByRole("menu")).last();
  const names = await list
    .getByRole("option")
    .or(list.getByRole("menuitemradio"))
    .or(list.getByRole("menuitem"))
    .allInnerTexts();
  await page.keyboard.press("Escape");
  await sleep(200);
  return names.map((each) => each.trim()).filter(Boolean);
}

/** The value a text field or text area shows (its `value`, else its text). */
export const fieldValue = (locator) =>
  locator.evaluate((element) => ("value" in element ? element.value : element.textContent) ?? "");

/** Calculator's window: the other app for Hide Others, Show All and Bring All to Front. */
const calculator = (page) => page.locator('.mac-managed-window[data-window-id="calculator"]');
const dockItem = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });

async function openCalculator(page) {
  await dockItem(page, "Calculator").click();
  await calculator(page).waitFor({ state: "visible", timeout: 10_000 });
  await sleep(300);
}

/** Closes Calculator's windows with their close buttons (one sent to the Dock comes back from it first). */
async function closeCalculator(page) {
  if ((await calculator(page).count()) > 0 && (await stateOf(calculator(page))).minimized) {
    await dockItem(page, "Calculator")
      .click()
      .catch(() => {});
    await sleep(400);
  }
  for (const id of ["calculator:tape", "calculator"]) {
    const frame = page.locator(`.mac-managed-window[data-window-id="${id}"]`);
    if ((await frame.count()) > 0)
      await frame
        .getByRole("button", { name: "Close" })
        .first()
        .click({ timeout: 3_000 })
        .catch(() => {});
  }
  await sleep(250);
}

/** The window manager's state of the managed window holding `locator`: stacking order, minimised, key or not. */
function stateOf(locator) {
  return locator.first().evaluate((element) => {
    const frame = element.closest(".mac-managed-window") ?? element;
    return {
      z: Number(frame.style.zIndex || 0),
      minimized: frame.hasAttribute("data-minimized"),
      state: frame.querySelector("[data-window-state]")?.getAttribute("data-window-state") ?? null,
    };
  });
}

/** The stacking order of every shown window of the app `win` belongs to (window ids `<app>` or `<app>:<n>`). */
function siblingsOf(win) {
  return win.first().evaluate((element) => {
    const frame = element.closest(".mac-managed-window") ?? element;
    const base = String(frame.getAttribute("data-window-id") ?? "").split(":")[0];
    return [...document.querySelectorAll(".mac-managed-window:not([data-minimized])")]
      .filter((each) => String(each.getAttribute("data-window-id") ?? "").split(":")[0] === base)
      .map((each) => ({
        id: each.getAttribute("data-window-id"),
        z: Number(each.style.zIndex || 0),
      }));
  });
}

/** Makes the window key with a real press on a point of its own top strip that is not a control (read first). */
async function keyOwn(page, win) {
  const at = await win.first().evaluate((element) => {
    const root = element.closest(".mac-managed-window") ?? element;
    const control =
      "button, a, input, select, textarea, [role='button'], [role='combobox'], [role='searchbox'], [role='tab'], [contenteditable='true']";
    const b = root.getBoundingClientRect();
    for (const dy of [12, 18, 6, 30])
      for (let fx = 0.5; fx < 0.98; fx += 0.04)
        for (const x of [b.x + b.width * fx, b.x + b.width * (1 - fx)]) {
          const y = b.y + dy;
          if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit && root.contains(hit) && !hit.closest(control) && !hit.closest("[data-edge]"))
            return { x, y };
        }
    return null;
  });
  if (!at) throw new Error("no point of the window's own top strip a press reaches");
  await page.mouse.click(at.x, at.y);
  await sleep(250);
}

/**
 * Read a menu item without choosing it, after a real hover on it: whether it is dimmed, and the reason it shows (its
 * tooltip `title`, an `aria-description`, the text it is described by, a dimmed reason item right after it, or a
 * tooltip the menu shows on hover).
 */
export async function menuReason(page, ...trail) {
  const [title, ...rest] = trail;
  await openMenu(page, title);
  for (const sub of rest.slice(0, -1)) {
    await page
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: sub, exact: true })
      .first()
      .hover();
    await sleep(300);
  }
  const item = page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: rest.at(-1), exact: true })
    .first();
  if ((await item.count()) === 0) {
    for (let index = 0; index < 3; index += 1) await page.keyboard.press("Escape");
    return null;
  }
  await item.hover({ force: true }).catch(() => {});
  await sleep(300);
  const found = await item.evaluate((element) => {
    const described = (element.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .map((id) => (id ? (document.getElementById(id)?.textContent ?? "") : ""))
      .join(" ")
      .trim();
    const next = element.nextElementSibling;
    const reasonItem = next && /reason/.test(String(next.className)) ? next.textContent.trim() : "";
    // The dimmed statements the same menu shows ("Notes has no preferences" under Preferences…).
    const menu = element.closest('[role="menu"]');
    const dimmedTexts = menu
      ? [...menu.querySelectorAll('[role="menuitem"][aria-disabled="true"]')].map((each) =>
          (each.textContent ?? "").trim(),
        )
      : [];
    return {
      disabled: element.getAttribute("aria-disabled") === "true",
      dimmedTexts,
      reason:
        element.getAttribute("title") ||
        element.getAttribute("aria-description") ||
        described ||
        reasonItem ||
        "",
    };
  });
  if (!found.reason) {
    const tip = page.getByRole("tooltip").last();
    if (await tip.isVisible().catch(() => false)) found.reason = (await tip.innerText()).trim();
  }
  for (let index = 0; index < 3; index += 1) await page.keyboard.press("Escape");
  await sleep(150);
  return found;
}

/**
 * Generate the app-level rows for one app. `spec`:
 *   { P, app: "Notes", state, open(page) -> visible window Locator, gone(page) -> Promise<boolean> (no window shown),
 *     closeTitle: region name for the chrome close check, windowItem: the Window menu's item for the window | null,
 *     fullScreen: bool (View > Enter Full Screen exists), windowMenu: bool, help: bool, skip: [ids] }
 */
export function appRows(row, spec) {
  const { P, app } = spec;
  const skip = new Set(spec.skip ?? []);
  const meta = (role, name, how, expect, covers = []) => ({
    meta: { state: spec.state, role, name, how, expect, persists: "none", covers },
  });
  const add = (id, body, info) => {
    if (!skip.has(id)) row(id, body, info);
  };

  // Dimmed with a statement the menu shows (R2's menu bar): the item dimmed with the statement under it, or the item
  // that is the statement itself.
  const statements = [
    { trail: [app, "Preferences…"], says: `${app} has no preferences` },
    { trail: [app, "Services", "No Services Apply"], says: "No Services Apply" },
  ];
  if (spec.help) {
    const trail = ["Help", `${app} Help`];
    add(
      `${P}.menu.${slug(trail.join(" "))}`,
      async ({ page }) => {
        await spec.open(page);
        await chooseMenu(page, ...trail);
        const viewer = page.locator(".mac-window.mac-help-viewer").first();
        const shown = await viewer.waitFor({ timeout: 8_000 }).then(
          () => true,
          () => false,
        );
        // Left open it stays in front, with its own menus in the menu bar, for every row after this.
        if (shown) await viewer.getByRole("button", { name: "Close", exact: true }).first().click();
        return { ok: shown, detail: shown ? "Help Viewer opened" : "no Help Viewer" };
      },
      meta("menuitem", trail.join(" > "), "choose", "Help Viewer opens on a search for the app", [
        ["menuitem", trail.at(-1), /Help$/],
      ]),
    );
  }
  for (const { trail, says } of statements) {
    const id = `${P}.menu.${slug(trail.join(" "))}`;
    add(
      id,
      async ({ page }) => {
        await spec.open(page);
        let found = await menuReason(page, ...trail);
        let itself = trail.at(-1) === says;
        if (!found) {
          found = await menuReason(page, ...trail.slice(0, -1), says);
          itself = Boolean(found);
        }
        if (!found) return { ok: false, detail: `${trail.join(" > ")} is not in the menu` };
        if (!found.disabled && trail.at(-1) === "Preferences…") {
          // An app with preferences of its own opens a window for them.
          const windows = page.locator(".mac-window");
          const before = await windows.count();
          await chooseMenu(page, ...trail);
          const opened = await until(async () => (await windows.count()) > before, 5_000);
          if (opened) {
            await windows
              .last()
              .getByRole("button", { name: "Close", exact: true })
              .first()
              .click();
          }
          return {
            ok: Boolean(opened),
            detail: opened ? "the Preferences window opened and closed" : "no window opened",
          };
        }
        if (!found.disabled)
          return { ok: false, detail: `${trail.join(" > ")} is enabled but has no census action` };
        if (itself) return { unavailable: says };
        if (found.dimmedTexts.some((text) => text.startsWith(says))) return { unavailable: says };
        return found.reason
          ? { unavailable: found.reason }
          : {
              ok: false,
              detail: `${trail.join(" > ")} is dimmed without a reason (R2's menu bar)`,
            };
      },
      meta("menuitem", trail.join(" > "), "open the menu and hover the item", `dimmed: ${says}`, [
        ["menuitem", trail.at(-1), new RegExp(`${trail.at(-2)}$`)],
      ]),
    );
  }

  // About <App>: an About window names the app and its version; its close button closes it.
  add(
    `${P}.menu.${slug(`${app} About ${app}`)}`,
    async ({ page }) => {
      await spec.open(page);
      const found = await menuReason(page, app, `About ${app}`);
      if (!found) return { ok: false, detail: `About ${app} is not in the menu` };
      if (found.disabled)
        return found.reason
          ? { unavailable: found.reason }
          : { ok: false, detail: `About ${app} is dimmed without a reason (R2's menu bar)` };
      await chooseMenu(page, app, `About ${app}`);
      const about = page
        .locator(".mac-desktop-shell-about, .mac-desktop-shell-about-finder")
        .last();
      const shown = await about.waitFor({ timeout: 4_000 }).then(
        () => true,
        () => false,
      );
      const text = shown ? (await about.innerText()).replace(/\s+/g, " ").trim() : "";
      if (shown) await about.getByRole("button", { name: "Close" }).first().click();
      const gone = shown && (await until(async () => (await about.count()) === 0, 3_000));
      return {
        ok: shown && text.includes(app) && text.includes("Version") && gone,
        detail: shown ? `"${text.slice(0, 70)}" closed=${gone}` : "no About window",
      };
    },
    meta(
      "menuitem",
      `${app} > About ${app}`,
      `menu bar ${app} > About ${app}`,
      "an About window names the app and its version; its close button closes it",
      [["menuitem", `About ${app}`, new RegExp(`${app}$`)]],
    ),
  );

  // Hide Others, Show All and Bring All to Front act on other apps' windows: Calculator is the other app (as in R2's kit).
  add(
    `${P}.menu.${slug(`${app} Hide Others`)}`,
    async ({ page }) => {
      const win = await spec.open(page);
      const alone = (await page.locator(".mac-managed-window:not([data-minimized])").count()) === 1;
      const dimmedAlone = alone
        ? Boolean((await menuReason(page, app, "Hide Others"))?.disabled)
        : true;
      try {
        await openCalculator(page);
        await keyOwn(page, win);
        const item = await menuReason(page, app, "Hide Others");
        if (!item || item.disabled)
          return {
            ok: false,
            detail: `Hide Others is ${item ? "dimmed" : "missing"} with Calculator shown`,
          };
        await chooseMenu(page, app, "Hide Others");
        const hidden = await until(async () => (await stateOf(calculator(page))).minimized, 3_000);
        const mine = !(await stateOf(win)).minimized;
        return {
          ok: dimmedAlone && hidden && mine,
          detail: `dimmed alone=${dimmedAlone}; Calculator to the Dock=${hidden}; ${app} still shown=${mine}`,
        };
      } finally {
        await closeCalculator(page);
      }
    },
    meta(
      "menuitem",
      `${app} > Hide Others`,
      `Calculator open, then menu bar ${app} > Hide Others`,
      "other apps' shown windows go to the Dock (dimmed while there are none)",
      [["menuitem", "Hide Others", new RegExp(`${app}$`)]],
    ),
  );
  add(
    `${P}.menu.${slug(`${app} Show All`)}`,
    async ({ page }) => {
      const win = await spec.open(page);
      try {
        await openCalculator(page);
        await keyOwn(page, win);
        await chooseMenu(page, app, "Hide Others");
        const hidden = await until(async () => (await stateOf(calculator(page))).minimized, 3_000);
        const item = await menuReason(page, app, "Show All");
        if (!item || item.disabled)
          return {
            ok: false,
            detail: `Show All is ${item ? "dimmed" : "missing"} with Calculator hidden=${hidden}`,
          };
        await chooseMenu(page, app, "Show All");
        const back = await until(async () => !(await stateOf(calculator(page))).minimized, 3_000);
        return {
          ok: hidden && back,
          detail: `Calculator hidden=${hidden}, back after Show All=${back}`,
        };
      } finally {
        await closeCalculator(page);
      }
    },
    meta(
      "menuitem",
      `${app} > Show All`,
      `after Hide Others, menu bar ${app} > Show All`,
      "hidden windows come back (dimmed while none is hidden)",
      [["menuitem", "Show All", new RegExp(`${app}$`)]],
    ),
  );
  if (spec.windowMenu) {
    add(
      `${P}.menu.window-bring-all-to-front`,
      async ({ page }) => {
        const win = await spec.open(page);
        try {
          await openCalculator(page);
          await keyOwn(page, win);
          const item = await menuReason(page, "Window", "Bring All to Front");
          if (!item || item.disabled)
            return item?.reason
              ? { unavailable: item.reason }
              : {
                  ok: false,
                  detail: `Bring All to Front is ${item ? "dimmed without a reason" : "missing"}`,
                };
          // Calculator opened last lies over the app's other windows; the press made only `win` key and frontmost.
          const calcZ = (await stateOf(calculator(page))).z;
          const behind = (await siblingsOf(win))
            .filter((each) => each.z < calcZ)
            .map((each) => each.id);
          await chooseMenu(page, "Window", "Bring All to Front");
          await sleep(300);
          const mine = await stateOf(win);
          const other = await stateOf(calculator(page));
          const after = await siblingsOf(win);
          const still = after
            .filter((each) => behind.includes(each.id) && each.z < other.z)
            .map((each) => each.id);
          // With one window there is nothing behind to bring forward: it stays frontmost and key (as R2's kit checks;
          // R2's desktop-census-journey checks several windows with Calculator's Paper Tape).
          return {
            ok: mine.z > other.z && mine.state === "key" && still.length === 0,
            detail: `${behind.length} of ${after.length} windows behind Calculator before, ${still.length} after${still.length ? ` (${still.join(", ")})` : ""}; z ${mine.z} over Calculator's ${other.z}, ${app}'s window ${mine.state}`,
          };
        } finally {
          await closeCalculator(page);
        }
      },
      meta(
        "menuitem",
        "Window > Bring All to Front",
        "Calculator open, then menu bar Window > Bring All to Front",
        "the app's windows come in front, its key window frontmost and key",
        [["menuitem", "Bring All to Front", /Window$/]],
      ),
    );
  }

  // Hide <App>: every window of the app leaves the screen; the Dock brings it back.
  for (const via of ["menu", "key"]) {
    add(
      `${P}.menu.hide.${via}`,
      async ({ page }) => {
        await spec.open(page);
        if (via === "menu") await chooseMenu(page, app, `Hide ${app}`);
        else await press(page, "Control+H");
        const hidden = await until(() => spec.gone(page), 4_000);
        const back = Boolean(await spec.open(page));
        // Once the app is back, the menu bar must still open its menu.
        let menu = true;
        if (hidden) {
          menu = await (async () => {
            await page
              .getByRole("menubar")
              .first()
              .getByRole("menuitem", { name: app, exact: true })
              .click({ timeout: 4_000 });
            await page
              .getByRole("menu", { name: app, exact: true })
              .first()
              .waitFor({ timeout: 3_000 });
            return true;
          })().catch(() => false);
          for (let index = 0; index < 2; index += 1) await page.keyboard.press("Escape");
          if (!menu) {
            // Recovery for the rows after this one (the verdict above stands).
            await reload(page);
            await spec.open(page);
          }
        }
        return {
          ok: hidden && back && menu,
          detail: `hidden=${hidden} shown again from the Dock=${back}; the ${app} menu opens again=${menu}`,
        };
      },
      meta(
        via === "menu" ? "menuitem" : "shortcut",
        `${app} > Hide ${app}`,
        via === "menu" ? `menu bar ${app} > Hide ${app}` : "keyboard Control+H",
        "the app's windows leave the screen",
        via === "menu" ? [["menuitem", `Hide ${app}`, new RegExp(`${app}$`)]] : [],
      ),
    );
    add(
      `${P}.menu.quit.${via}`,
      async ({ page }) => {
        await spec.open(page);
        if (via === "menu") await chooseMenu(page, app, `Quit ${app}`);
        else await press(page, "Control+Q");
        const sheet = await dontSave(page);
        const closed = await until(() => spec.gone(page), 4_000);
        const back = Boolean(await spec.open(page));
        return {
          ok: closed && back,
          detail: `quit=${closed}${sheet ? " (after Don’t Save)" : ""} opened again=${back}`,
        };
      },
      meta(
        via === "menu" ? "menuitem" : "shortcut",
        `${app} > Quit ${app}`,
        via === "menu" ? `menu bar ${app} > Quit ${app}` : "keyboard Control+Q",
        "the app's windows close",
        via === "menu" ? [["menuitem", `Quit ${app}`, new RegExp(`${app}$`)]] : [],
      ),
    );
    add(
      `${P}.menu.close-window.${via}`,
      async ({ page }) => {
        await spec.open(page);
        if (via === "menu") await chooseMenu(page, "File", "Close Window");
        else await press(page, "Control+W");
        const sheet = await dontSave(page);
        const closed = await until(() => spec.gone(page), 4_000);
        const back = Boolean(await spec.open(page));
        return {
          ok: closed && back,
          detail: `closed=${closed}${sheet ? " (after Don’t Save)" : ""} opened again=${back}`,
        };
      },
      meta(
        via === "menu" ? "menuitem" : "shortcut",
        "File > Close Window",
        via === "menu" ? "menu bar File > Close Window" : "keyboard Control+W",
        "the window closes",
        via === "menu" ? [["menuitem", "Close Window", /File$/]] : [],
      ),
    );
  }

  if (spec.fullScreen) {
    add(
      `${P}.menu.view-full-screen`,
      async ({ page }) => {
        const window = await spec.open(page);
        const before = await frameOf(window);
        await chooseMenu(page, "View", "Enter Full Screen");
        const viewport = page.viewportSize();
        let after = before;
        const filled = await until(async () => {
          after = await frameOf(window);
          return after.width >= viewport.width - 8;
        }, 3_000);
        // In full screen the window covers the menu bar: its own Exit Full Screen control brings it back.
        const exit = window
          .getByRole("group", { name: "Window controls" })
          .getByRole("button", { name: /Exit Full Screen/ })
          .first();
        if (await exit.isVisible().catch(() => false)) await exit.click();
        else await page.keyboard.press("Escape");
        const back = await until(
          async () => Math.abs((await frameOf(window)).width - before.width) <= 4,
          3_000,
        );
        return { ok: filled && back, detail: `${before.width} -> ${after.width} -> back=${back}` };
      },
      meta(
        "menuitem",
        "View > Enter Full Screen",
        "menu bar View > Enter Full Screen, then View > Exit Full Screen",
        "the window fills the screen, then returns to its size",
        [["menuitem", "Enter Full Screen", /View$/]],
      ),
    );
  }

  if (spec.windowMenu) {
    for (const via of ["menu", "key"]) {
      add(
        `${P}.menu.window-minimize.${via}`,
        async ({ page }) => {
          await spec.open(page);
          if (via === "menu") await chooseMenu(page, "Window", "Minimize");
          else await press(page, "Control+M");
          const gone = await until(() => spec.gone(page), 4_000);
          let back = false;
          if (spec.windowItem) {
            // The Window menu's item for the window brings it back, or else its Dock tile.
            const named = await chooseMenu(page, "Window", spec.windowItem).then(
              () => true,
              () => false,
            );
            if (!named) {
              await page.keyboard.press("Escape");
              await page.getByRole("button", { name: app, exact: true }).last().click();
            }
            back = await until(async () => !(await spec.gone(page)), 4_000);
          } else back = Boolean(await spec.open(page));
          return {
            ok: gone && back,
            detail: `minimised=${gone} back from ${spec.windowItem ? `Window > ${spec.windowItem}` : "the Dock"}=${back}`,
          };
        },
        meta(
          via === "menu" ? "menuitem" : "shortcut",
          "Window > Minimize",
          via === "menu" ? "menu bar Window > Minimize" : "keyboard Control+M",
          "the window leaves the screen; its Window menu item brings it back",
          via === "menu"
            ? [
                ["menuitem", "Minimize", /Window$/],
                ...(spec.windowItem ? [["menuitemcheckbox", spec.windowItem, /Window$/]] : []),
              ]
            : [],
        ),
      );
    }
    add(
      `${P}.menu.window-zoom`,
      async ({ page }) => {
        const window = await spec.open(page);
        const zoomItem = await menuReason(page, "Window", "Zoom");
        if (zoomItem?.disabled)
          return zoomItem.reason
            ? { unavailable: zoomItem.reason }
            : { ok: false, detail: "Window > Zoom is dimmed without a reason" };
        const before = await frameOf(window);
        await chooseMenu(page, "Window", "Zoom");
        let after = before;
        const grew = await until(async () => {
          after = await frameOf(window);
          return after.width > before.width + 20 || after.height > before.height + 20;
        }, 3_000);
        await chooseMenu(page, "Window", "Zoom");
        const back = await until(
          async () => Math.abs((await frameOf(window)).width - before.width) <= 4,
          3_000,
        );
        return {
          ok: grew && back,
          detail: `${before.width}x${before.height} -> ${after.width}x${after.height}; zoomed back=${back}`,
        };
      },
      meta(
        "menuitem",
        "Window > Zoom",
        "menu bar Window > Zoom, twice",
        "the window grows to fill the screen, then returns to its size",
        [["menuitem", "Zoom", /Window$/]],
      ),
    );
  }

  if (spec.chrome !== false) {
    const EDGES = {
      "resize-right": "e",
      "resize-left": "w",
      "resize-bottom": "s",
      "resize-top": "n",
      "resize-bottom-right": "se",
      "resize-bottom-left": "sw",
      "resize-top-right": "ne",
      "resize-top-left": "nw",
    };
    const CONTROLS = { minimize: "Minimize", zoom: "Enter Full Screen", close: "Close" };
    windowChromeRows(
      (id, body) => {
        const part = id.split(".").at(-1);
        const edge = EDGES[part];
        const role = edge ? "resize-handle" : part === "move-title-bar" ? "drag" : "button";
        const name = edge ?? (part === "move-title-bar" ? "Title bar" : (CONTROLS[part] ?? part));
        const covers = role === "button" ? [["button", name, /group:Window controls/]] : [];
        add(
          id,
          body,
          meta(
            role,
            name,
            edge
              ? `drag the window's ${edge} edge`
              : "real pointer on the window's title bar or its control",
            "the window moves, resizes, minimises, fills the screen or closes",
            covers,
          ),
        );
      },
      P,
      {
        open: (page) => spec.open(page),
        title: spec.closeTitle,
      },
    );
  }
}
