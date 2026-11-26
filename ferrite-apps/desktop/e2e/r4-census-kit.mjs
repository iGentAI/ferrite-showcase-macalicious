// R4 (editors, text and fonts) census kit: the shared steps of the census journeys and the crawler of Notes, TextEdit,
// Stickies, Script Editor, Font Book and Mail's New Message window. Four engines (`chromium`, Google Chrome stable as
// `chrome`, `firefox`, `webkit`), a fresh account made at the login window or an existing one signed in again, the
// desktop's menu bar driven with real clicks and hovers, the accessibility tree read back, and a census runner that
// prints one `ok`/`FAIL` line per census id. Everything a row does is real Playwright input (mouse, keyboard, file
// chooser); `page.evaluate` only reads.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The four engines, from journey-kit: every e2e runner takes its engine from there (test/journey-engines.test.ts). */
export { ENGINES };

/** Command-line options shared by every R4 script. */
export function options() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
  };
  const flag = (name) => args.includes(name);
  const base = option("--url", "http://127.0.0.1:8080").replace(/\/$/, "");
  const out = path.resolve(option("--out", path.join(here, "output", "r4")));
  mkdirSync(out, { recursive: true });
  const browserName = option("--browser", "chromium");
  if (!Object.hasOwn(ENGINES, browserName)) {
    console.error(`--browser must be one of ${Object.keys(ENGINES).join(", ")}`);
    process.exit(2);
  }
  return {
    base,
    out,
    browserName,
    phase: option("--phase", "write"),
    only: option("--only", ""),
    seed: Number(option("--seed", "1")),
    minutes: Number(option("--minutes", "3")),
    app: option("--app", ""),
    headed: flag("--headed"),
    emit: flag("--emit"),
  };
}

/**
 * Accept the page's `beforeunload` prompt (an editor with unsaved changes asks before a reload; Playwright would
 * otherwise dismiss it and the reload would never finish) and record every dialog in `dialogs`.
 */
export function acceptUnload(page, dialogs = []) {
  page.on("dialog", async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message(), at: Date.now() });
    if (dialog.type() === "beforeunload") await dialog.accept().catch(() => {});
    else await dialog.dismiss().catch(() => {});
  });
  return dialogs;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Launch an engine; headed when asked (the Xvfb run). */
export async function launchEngine(browserName, { headed = false } = {}) {
  return ENGINES[browserName].launch({ headless: !headed });
}

/**
 * Watch a page for every first-party console error, page error, failed request and HTTP error (>= 400). Returns the
 * list it fills; `allow(pattern)` lets a refusal a step provokes on purpose pass.
 */
export function watchPage(page, label = "") {
  const problems = [];
  const allowed = [];
  const tag = label ? `${label} ` : "";
  const firstParty = (url) => {
    try {
      return !url || new URL(url).origin === new URL(page.url()).origin;
    } catch {
      return true;
    }
  };
  const add = (text) => {
    if (!allowed.some((pattern) => pattern.test(text))) problems.push(text);
  };
  page.on("console", (message) => {
    if (message.type() === "error" && firstParty(message.location()?.url))
      add(`${tag}console: ${message.text()} @ ${message.location()?.url ?? ""}`);
  });
  page.on("pageerror", (error) => add(`${tag}page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    const url = request.url();
    // The page's own live streams and the dev server's reload stream, closed by the page on a reload or at the end
    // of the run; a `blob:` read let go of; an aborted fetch the page abandoned on purpose.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(text)) {
      if (url.startsWith("blob:") || url.includes("/__forge/reload") || /\/live\//.test(url))
        return;
    }
    if (!firstParty(url)) return;
    add(`${tag}request failed: ${url} ${text}`);
  });
  page.on("response", (response) => {
    // A second browser of one person wrote the settings first: the save client merges onto its copy.
    if (response.status() === 409 && response.url().includes("/api/system-preferences/settings"))
      return;
    if (response.status() >= 400 && firstParty(response.url()))
      add(`${tag}HTTP ${response.status()}: ${response.url()}`);
  });
  return { problems, allow: (pattern) => allowed.push(pattern) };
}

/** `fetch` from inside the page (a read of the app's API with the browser's own cookie). */
export function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        // Not JSON.
      }
      return { status: response.status, json, text };
    },
    { method, url, body },
  );
}

/**
 * A pass-through spy on the browser's EyeDropper (where it has one): every `open()` the page makes is counted in
 * `window.__r4EyeDropperOpens` and handed on to the real picker unchanged. Read-only observation for the eyedropper
 * row; it neither performs nor fakes the action.
 */
export const EYEDROPPER_SPY = `(() => {
  if (!("EyeDropper" in window)) return;
  const Real = window.EyeDropper;
  window.__r4EyeDropperOpens = 0;
  window.EyeDropper = class extends Real {
    open(...args) {
      window.__r4EyeDropperOpens += 1;
      return super.open(...args);
    }
  };
})();`;

/**
 * Pass-through spies on the Web Share API and the async clipboard's writeText: each call's text is recorded in
 * `window.__r4Shared` and handed on unchanged (read-only observation for Share rows).
 */
export const SHARE_SPY = `(() => {
  window.__r4Shared = [];
  if (navigator.share) {
    const share = navigator.share.bind(navigator);
    navigator.share = (data) => { window.__r4Shared.push({ via: "share", text: String(data?.text ?? ""), title: String(data?.title ?? "") }); return share(data); };
  }
  if (navigator.clipboard?.writeText) {
    const write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (text) => { window.__r4Shared.push({ via: "clipboard", text: String(text) }); return write(text); };
  }
})();`;

const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

/**
 * Put apps in the signed-in account's App Store library (setup for Script Editor and Font Book, which a new account
 * gets from the App Store first; the App Store's Get button itself is R5's census row).
 */
export async function installApps(page, ids) {
  const library = await api(page, "GET", "/api/app-store/library");
  const installed = [...new Set([...(library.json?.installed ?? []), ...ids])];
  return api(page, "PUT", "/api/app-store/library", { installed, rev: library.json?.rev });
}

/** Make an account at the login window's Create Account… form; resolves on its desktop. */
export async function createAccount(page, { name, fullName, password }) {
  const users = page.getByRole("group", { name: "Users" });
  await users.waitFor({ timeout: 30_000 });
  await users.getByRole("button", { name: "Create Account…", exact: true }).click();
  const form = page.getByRole("form", { name: "Create Account" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Full Name:").fill(fullName);
  await form.getByLabel("Account Name:").fill(name);
  await form.getByLabel("Password:").fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByRole("button", { name: "Create Account" }).click();
  await finder(page).waitFor({ timeout: 30_000 });
  await settle(page);
}

/** Sign in by account name. A fresh browser does not list another browser's accounts. */
export async function signIn(page, { name, password }) {
  const users = page.getByRole("group", { name: "Users" });
  await users.getByRole("button", { name: "Other…", exact: true }).click();
  const form = page.getByRole("form", { name: "Log In" });
  await form.getByLabel("Account Name:").fill(name);
  await form.getByLabel("Password:").fill(password);
  await form.getByRole("button", { name: "Log In" }).click();
  await finder(page).waitFor({ timeout: 30_000 });
  await settle(page);
}

/** Let the desktop finish its first paint and data loads. */
export async function settle(page, ms = 600) {
  await page.waitForLoadState("load").catch(() => {});
  await sleep(ms);
}

/** Reload the desktop page and wait for its Finder (a signed-in session survives a reload). */
export async function reload(page) {
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 30_000 });
  await settle(page);
}

/** A fresh account's identity, unique per run and engine. */
export function newIdentity(prefix, browserName) {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const short = browserName.slice(0, 2);
  return {
    name: `${prefix}${short}${stamp}`.toLowerCase().slice(0, 30),
    fullName: `R4 ${prefix} ${short} ${stamp}`,
    password: `r4-${stamp}-pw!`,
  };
}

/**
 * Click an app's Dock tile; resolves with its window. `windowName` is the region's name (string or RegExp), or
 * `{ selector }` for an app whose windows are not named regions (Stickies' notes). Throws when the window never shows.
 */
export async function openFromDock(page, appName, windowName = appName) {
  await page
    .getByRole("button", { name: new RegExp(`^${appName}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${appName}$`) }))
    .first()
    .click();
  const window =
    windowName && typeof windowName === "object" && "selector" in windowName
      ? page.locator(windowName.selector).first()
      : page.getByRole("region", { name: windowName }).first();
  await window.waitFor({ state: "visible", timeout: 20_000 });
  await sleep(500);
  return window;
}

/** The desktop's menu bar. */
export const menuBar = (page) => page.getByRole("menubar").first();

/** The menu item (any of the three menu item roles) named `name` in the last open menu. */
export function menuEntry(page, name) {
  const exact = typeof name === "string";
  const scope = page.getByRole("menu").last();
  return scope
    .getByRole("menuitem", { name, exact })
    .or(scope.getByRole("menuitemcheckbox", { name, exact }))
    .or(scope.getByRole("menuitemradio", { name, exact }))
    .first();
}

/** Open the menu bar menu `title` with a click; resolves with the open menu. */
export async function openMenu(page, title) {
  await page.keyboard.press("Escape").catch(() => {});
  await menuBar(page).getByRole("menuitem", { name: title, exact: true }).click();
  const menu = page.getByRole("menu", { name: title, exact: true }).first();
  await menu.waitFor({ timeout: 5_000 });
  return menu;
}

/**
 * Choose a command of the desktop's menu bar as a person does: a click on the menu's title, the pointer over each
 * submenu's item, a click on the command. `trail` is [menu, (submenu...), item].
 */
export async function chooseMenu(page, ...trail) {
  const [title, ...rest] = trail;
  await openMenu(page, title);
  for (let index = 0; index < rest.length - 1; index += 1) {
    const trigger = page.getByRole("menuitem", { name: rest[index], exact: true }).last();
    await trigger.waitFor({ timeout: 5_000 });
    await trigger.hover();
    await page
      .getByRole("menu", { name: rest[index], exact: true })
      .last()
      .waitFor({ timeout: 5_000 });
  }
  const entry = menuEntry(page, rest.at(-1));
  await entry.waitFor({ timeout: 5_000 });
  await entry.click();
  await sleep(350);
}

/** Read the state of a menu entry without choosing it: { disabled, checked, shortcut } or null. */
export async function menuState(page, ...trail) {
  const [title, ...rest] = trail;
  await openMenu(page, title);
  for (let index = 0; index < rest.length - 1; index += 1) {
    const trigger = page.getByRole("menuitem", { name: rest[index], exact: true }).last();
    await trigger.hover();
    await page
      .getByRole("menu", { name: rest[index], exact: true })
      .last()
      .waitFor({ timeout: 5_000 });
  }
  const entry = menuEntry(page, rest.at(-1));
  const found = (await entry.count()) > 0;
  const state = found
    ? {
        disabled: (await entry.getAttribute("aria-disabled")) === "true",
        checked: await entry.getAttribute("aria-checked"),
        shortcut: await entry.getAttribute("aria-keyshortcuts"),
      }
    : null;
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await sleep(150);
  return state;
}

/** Select the text `word` inside `editor` with a real double click on it (the word must be a single word). */
export async function doubleClickWord(page, editor, word) {
  // The word is brought into its editor's visible part and its box read once two frames agree, so that the press lands
  // on it while a wheel scroll or the caret's own scroll is still moving the view. The selection is then checked: a
  // press that missed fails here, at setup, rather than in the row that needed the word.
  const box = await editor.evaluate(async (root, wanted) => {
    const find = () => {
      const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.nodeValue.indexOf(wanted);
        if (at < 0) continue;
        const range = root.ownerDocument.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + wanted.length);
        return range;
      }
      return null;
    };
    if (!find()) return null;
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const settled = async () => {
      let before = "";
      for (let tries = 0; tries < 60; tries += 1) {
        await frame();
        const rect = find().getBoundingClientRect();
        const now = `${rect.x},${rect.y},${rect.width},${rect.height}`;
        if (now === before) return rect;
        before = now;
      }
      return find().getBoundingClientRect();
    };
    let rect = await settled();
    // A point of the word on screen and not under anything else (a floating panel): pressed as the word lies, with no
    // scrolling, when there is one.
    const uncovered = (r) => {
      for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        const px = r.x + r.width * fx;
        const py = r.y + r.height / 2;
        if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) continue;
        const at = root.ownerDocument.elementFromPoint(px, py);
        if (at && root.contains(at)) return { px, py };
      }
      return null;
    };
    const ready = uncovered(rect);
    // The band of the editor on screen: its box, cut by every ancestor that clips (the window among them).
    let top = Math.max(0, root.getBoundingClientRect().top);
    let bottom = Math.min(innerHeight, root.getBoundingClientRect().bottom);
    for (let el = root.parentElement; el; el = el.parentElement) {
      if (getComputedStyle(el).overflowY === "visible") continue;
      const clip = el.getBoundingClientRect();
      top = Math.max(top, clip.top);
      bottom = Math.min(bottom, clip.bottom);
    }
    let scroller = root;
    while (scroller) {
      const overflow = getComputedStyle(scroller).overflowY;
      if (scroller.scrollHeight > scroller.clientHeight + 1 && overflow !== "visible") break;
      scroller = scroller.parentElement;
    }
    if (!ready && scroller && bottom > top && (rect.top < top + 4 || rect.bottom > bottom - 4)) {
      scroller.scrollTop += rect.top + rect.height / 2 - (top + bottom) / 2;
      rect = await settled();
    }
    // The same across: a word wider than the view (a 288 pt line) has the view scrolled sideways.
    let left = Math.max(0, root.getBoundingClientRect().left);
    let right = Math.min(innerWidth, root.getBoundingClientRect().right);
    for (let el = root.parentElement; el; el = el.parentElement) {
      if (getComputedStyle(el).overflowX === "visible") continue;
      const clip = el.getBoundingClientRect();
      left = Math.max(left, clip.left);
      right = Math.min(right, clip.right);
    }
    let across = root;
    while (across) {
      const overflow = getComputedStyle(across).overflowX;
      if (across.scrollWidth > across.clientWidth + 1 && overflow !== "visible") break;
      across = across.parentElement;
    }
    if (!ready && across && right > left && (rect.left < left + 4 || rect.right > right - 4)) {
      across.scrollLeft += rect.left + rect.width / 2 - (left + right) / 2;
      rect = await settled();
    }
    // Still covered where it now lies (a panel over the band's middle): the band's top, then its bottom.
    let point = ready ?? uncovered(rect);
    if (!point && scroller && bottom > top) {
      for (const at of [top + rect.height, bottom - 2 * rect.height]) {
        scroller.scrollTop += rect.top - at;
        rect = await settled();
        point = uncovered(rect);
        if (point) break;
      }
    }
    const x = point ? point.px : rect.x + rect.width / 2;
    const y = point ? point.py : rect.y + rect.height / 2;
    const hit = root.ownerDocument.elementFromPoint(x, y);
    const covered =
      hit && !root.contains(hit) ? `${hit.tagName} ${hit.className}`.slice(0, 60) : null;
    const view = [left, right, top, bottom].map(Math.round).join(",");
    return { x, y, covered, view };
  }, word);
  if (!box) throw new Error(`no ${word} in the editor`);
  await page.mouse.dblclick(box.x, box.y);
  await sleep(150);
  const selected = await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
      return active.value.slice(active.selectionStart ?? 0, active.selectionEnd ?? 0);
    return document.getSelection()?.toString() ?? "";
  });
  if (selected.trim() !== word) {
    const where = box.covered
      ? ` (the point ${Math.round(box.x)},${Math.round(box.y)} was covered by ${box.covered}; on screen ${box.view})`
      : "";
    throw new Error(
      `double-clicking ${word} selected ${JSON.stringify(selected.slice(0, 40))}${where}`,
    );
  }
}

/** Select `text` (any span of text) inside `editor` by a real press-drag-release of the mouse across it. */
export async function dragSelect(page, editor, text) {
  const ends = await editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      const range = root.ownerDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + 1);
      const first = range.getBoundingClientRect();
      range.setStart(node, at + wanted.length - 1);
      range.setEnd(node, at + wanted.length);
      const last = range.getBoundingClientRect();
      return {
        x0: first.left + 0.5,
        y0: first.top + first.height / 2,
        x1: last.right - 0.5,
        y1: last.top + last.height / 2,
      };
    }
    return null;
  }, text);
  if (!ends) throw new Error(`no ${text} in the editor`);
  await page.mouse.move(ends.x0, ends.y0);
  await page.mouse.down();
  await page.mouse.move((ends.x0 + ends.x1) / 2, ends.y1, { steps: 4 });
  await page.mouse.move(ends.x1, ends.y1, { steps: 4 });
  await page.mouse.up();
  await sleep(150);
}

/** Click at the end of the text `text` in `editor` (a real click puts the insertion point right after it). */
export async function clickAfter(page, editor, text) {
  const point = await editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      const range = root.ownerDocument.createRange();
      range.setStart(node, at + wanted.length - 1);
      range.setEnd(node, at + wanted.length);
      const rect = range.getBoundingClientRect();
      return { x: rect.right - 0.5, y: rect.top + rect.height / 2 };
    }
    return null;
  }, text);
  if (!point) throw new Error(`no ${text} in the editor`);
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press("End");
  await sleep(100);
}

/** The computed style of the text holding `word` (bold, italic, underline, strike, size, family, colour, line align). */
export function styleOf(editor, word) {
  return editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.includes(wanted)) continue;
      const element = node.parentElement;
      const style = getComputedStyle(element);
      let underline = false;
      let strike = false;
      let line = element;
      const tags = [];
      for (let at = element; at && at !== root; at = at.parentElement) {
        const decoration = getComputedStyle(at).textDecorationLine;
        if (/underline/.test(decoration)) underline = true;
        if (/line-through/.test(decoration)) strike = true;
        tags.push(at.tagName.toLowerCase());
        if (at.parentElement === root) line = at;
      }
      return {
        bold: Number(style.fontWeight) >= 600 || style.fontWeight === "bold",
        italic: /italic|oblique/.test(style.fontStyle),
        underline,
        strike,
        size: parseFloat(style.fontSize),
        family: style.fontFamily,
        color: style.color,
        background: style.backgroundColor,
        align: getComputedStyle(line).textAlign,
        verticalAlign: style.verticalAlign,
        tags,
        lineTag: line.tagName.toLowerCase(),
      };
    }
    return null;
  }, word);
}

/** Whether `editor`'s text holds `text`. */
export const holds = (editor, text) =>
  editor.evaluate((root, wanted) => root.textContent.includes(wanted), text);

/** The text the page's selection holds. */
export const selectedText = (page) => page.evaluate(() => String(document.getSelection()));

/** Wait until `check` holds, up to `ms`; resolves true/false. */
export async function until(check, ms = 5_000, every = 100) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      if (await check()) return true;
    } catch {
      // Not yet.
    }
    await sleep(every);
  }
  return false;
}

/** Drag with the mouse from (x0,y0) to (x1,y1) in steps (real pointer events). */
export async function drag(page, x0, y0, x1, y1, steps = 12) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, { steps: Math.ceil(steps / 2) });
  await page.mouse.move(x1, y1, { steps });
  await page.mouse.up();
  await sleep(200);
}

/** The bounding box of a locator, waited for. */
export async function boxOf(locator) {
  await locator.waitFor({ state: "visible", timeout: 10_000 });
  return locator.boundingBox();
}

/**
 * The window frame (`.mac-managed-window` around the region) of a window region: { x, y, width, height }. Uses the
 * closest positioned window frame, falling back to the region's own box.
 */
export async function frameOf(region) {
  return region.evaluate((element) => {
    const frame =
      element.closest("[data-window-id], .mac-managed-window, .mac-window-manager-window") ??
      element;
    const rect = frame.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

/** Answer a document's save sheet with Don’t Save when one shows within `ms`; resolves whether it showed. */
export async function dontSave(page, ms = 1_200) {
  const button = page.getByRole("button", { name: /^Don.t Save$/ }).first();
  if (!(await until(() => button.isVisible(), ms))) return false;
  await button.click();
  await sleep(300);
  return true;
}

/**
 * A point of the window's title bar that a press would move the window by: on screen, inside the window, and not a
 * control (button, field, menu item). Scans the first title bar of the window, 8 px below its top.
 */
export function titleGrip(window) {
  return window.evaluate((element) => {
    const host = element.closest(".mac-managed-window") ?? element;
    const bar = host.querySelector(".mac-title-bar") ?? host;
    const rect = bar.getBoundingClientRect();
    const y = rect.top + Math.min(8, rect.height / 3);
    for (let x = rect.left + 70; x < rect.right - 10; x += 8) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !host.contains(hit)) continue;
      if (
        hit.closest(
          'button, input, select, textarea, [role="button"], [role="searchbox"], [role="combobox"], [role="menuitem"], [contenteditable="true"]',
        )
      )
        continue;
      return { x, y };
    }
    return null;
  });
}

/** The centre of the window manager's resize handle for `edge` (n, ne, e, se, s, sw, w, nw), or null. */
export function handleOf(window, edge) {
  return window.evaluate((element, which) => {
    const host = element.closest(".mac-managed-window") ?? element;
    const handle = host.querySelector(`.mac-managed-window-resize[data-edge="${which}"]`);
    if (!handle) return null;
    const rect = handle.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, edge);
}

const EDGE = {
  right: "e",
  left: "w",
  bottom: "s",
  top: "n",
  "bottom-right": "se",
  "bottom-left": "sw",
  "top-right": "ne",
  "top-left": "nw",
};

/**
 * Window chrome rows shared by every app window: move by the title bar, resize by each edge and corner, minimise,
 * zoom (full screen) and close. `open` re-opens the window and resolves with its region.
 */
export function windowChromeRows(row, prefix, { open, title }) {
  const near = (a, b, slack = 3) => Math.abs(a - b) <= slack;
  row(`${prefix}.chrome.move-title-bar`, async ({ page }) => {
    const window = await open(page);
    const before = await frameOf(window);
    const grip = await titleGrip(window);
    if (!grip) return { ok: false, detail: "no free point of the title bar to press" };
    await drag(page, grip.x, grip.y, grip.x - 60, grip.y + 45);
    const after = await frameOf(window);
    return {
      ok: near(after.x, before.x - 60, 6) && near(after.y, before.y + 45, 6),
      detail: `${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
    };
  });
  const edges = {
    right: (f) => [f.x + f.width - 2, f.y + f.height / 2, 40, 0],
    left: (f) => [f.x + 1, f.y + f.height / 2, -40, 0],
    bottom: (f) => [f.x + f.width / 2, f.y + f.height - 2, 0, 40],
    top: (f) => [f.x + f.width / 2 + 60, f.y + 1, 0, -30],
    "bottom-right": (f) => [f.x + f.width - 2, f.y + f.height - 2, 40, 30],
    "bottom-left": (f) => [f.x + 2, f.y + f.height - 2, -40, 30],
    "top-right": (f) => [f.x + f.width - 2, f.y + 2, 40, -30],
    "top-left": (f) => [f.x + 2, f.y + 2, -40, -30],
  };
  for (const [edge, grip] of Object.entries(edges)) {
    row(`${prefix}.chrome.resize-${edge}`, async ({ page }) => {
      const window = await open(page);
      const before = await frameOf(window);
      // The window manager's own handle for the edge, pressed at its centre (it straddles the frame's edge).
      const [, , dx, dy] = grip(before);
      let handle = await handleOf(window, EDGE[edge]);
      if (!handle) return { ok: false, detail: `no ${EDGE[edge]} resize handle` };
      // A window whose bottom edge ends in the Dock band has that edge's handle under the Dock: the press would land on
      // the Dock. The window is first moved up by its title bar, just clear of the Dock, and the row then drags its edge.
      let moved = 0;
      const reach = (point) =>
        window.evaluate((el, { x, y }) => {
          const hit = document.elementFromPoint(x, y);
          return Boolean(hit) && (el.closest(".mac-managed-window") ?? el).contains(hit);
        }, point);
      if (dy > 0 && !(await reach(handle))) {
        const dock = await page.getByRole("toolbar", { name: "Dock" }).first().boundingBox();
        const title = await titleGrip(window);
        if (dock && title) {
          moved = Math.ceil(handle.y + dy + 12 - dock.y);
          await drag(page, title.x, title.y, title.x, title.y - moved);
          handle = await handleOf(window, EDGE[edge]);
        }
        if (!handle || !(await reach(handle)))
          return {
            ok: false,
            detail: `the ${EDGE[edge]} handle is under the Dock and the window could not be moved clear`,
          };
      }
      const start = moved ? await frameOf(window) : before;
      await drag(page, handle.x, handle.y, handle.x + dx, handle.y + dy);
      const after = await frameOf(window);
      // A window moved up for this row goes back down by as much, so the rows after it start where they would have.
      if (moved) {
        const back = await titleGrip(window);
        if (back) await drag(page, back.x, back.y, back.x, back.y + moved);
      }
      const widthOk =
        dx === 0
          ? near(after.width, start.width, 2)
          : near(after.width, start.width + Math.abs(dx), 8);
      const heightOk =
        dy === 0
          ? near(after.height, start.height, 2)
          : near(after.height, start.height + Math.abs(dy), 8);
      return {
        ok: widthOk && heightOk,
        detail: `${start.width}x${start.height} -> ${after.width}x${after.height}${moved ? ` (moved up ${moved} px first: the Dock covered the ${EDGE[edge]} handle)` : ""}`,
      };
    });
  }
  row(`${prefix}.chrome.minimize`, async ({ page }) => {
    const window = await open(page);
    await window
      .getByRole("group", { name: "Window controls" })
      .getByRole("button", { name: "Minimize" })
      .click();
    const hidden = await until(async () => !(await window.isVisible()), 4_000);
    return { ok: hidden, detail: hidden ? "window left the screen" : "window still shown" };
  });
  row(`${prefix}.chrome.zoom`, async ({ page }) => {
    const window = await open(page);
    const before = await frameOf(window);
    const zoom = window
      .getByRole("group", { name: "Window controls" })
      .getByRole("button", { name: /Full Screen|Zoom/ })
      .first();
    await zoom.click();
    await sleep(600);
    const after = await frameOf(window);
    const grew = after.width > before.width + 50 || after.height > before.height + 50;
    // Back to its size: the same control (Exit Full Screen) or Escape.
    const exit = window
      .getByRole("group", { name: "Window controls" })
      .getByRole("button", { name: /Exit Full Screen|Zoom/ })
      .first();
    if (await exit.isVisible().catch(() => false)) await exit.click();
    else await page.keyboard.press("Escape");
    await sleep(600);
    const back = await frameOf(window);
    return {
      ok: grew && near(back.width, before.width, 4),
      detail: `${before.width} -> ${after.width} -> ${back.width}`,
    };
  });
  row(`${prefix}.chrome.close`, async ({ page }) => {
    const window = await open(page);
    await window
      .getByRole("group", { name: "Window controls" })
      .getByRole("button", { name: "Close" })
      .click();
    const sheet = await dontSave(page);
    const gone = await until(
      async () =>
        (await page.getByRole("region", { name: title, exact: true }).count()) === 0 ||
        !(await window.isVisible()),
      4_000,
    );
    return {
      ok: gone,
      detail: `${gone ? "window closed" : "window still open"}${sheet ? " (after Don’t Save in its save sheet)" : ""}`,
    };
  });
}

/**
 * A census journey: `row(id, body)` registers a census row; `run(setup)` launches the engine, signs up (or, in
 * `--phase restart-check`, signs in as the account kept by the write phase), hands each row `{ page, ctx }`, prints
 * one `ok`/`FAIL` line per id, writes `<out>/<app>-census-<engine>.json`, and exits 0 only when every row passed and
 * the page logged no problem. A row returns `{ ok, detail }`, a boolean, or `{ unavailable: reason }` when the control
 * is visibly unavailable with that reason (checked on screen by the row).
 */
export function census(app) {
  const opts = options();
  const rows = [];
  /**
   * Register a census row. `meta` describes it for the census TSV: { state, role, name, how, expect, persists,
   * covers } where `covers` lists [role, name-or-RegExp, path-RegExp?] of crawled nodes the row accounts for.
   */
  const row = (id, body, { phases = ["write"], timeout = 45_000, meta = {} } = {}) => {
    if (rows.some((each) => each.id === id)) throw new Error(`duplicate census id ${id}`);
    rows.push({ id, body, phases, timeout, meta });
  };
  const stateFile = path.join(opts.out, `${app}-census-${opts.browserName}-state.json`);
  const keep = (state) => writeFileSync(stateFile, JSON.stringify(state, null, 2));
  const kept = () => (existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : null);

  const run = async ({ prepare, beforeEach } = {}) => {
    if (opts.emit) {
      // The census rows as JSON lines, for r4-census-combine.mjs; nothing is launched.
      for (const each of rows) {
        const covers = (each.meta.covers ?? []).map(([role, name, trail]) => [
          role,
          name instanceof RegExp ? `/${name.source}/` : name,
          trail instanceof RegExp ? trail.source : (trail ?? ""),
        ]);
        console.log(JSON.stringify({ id: each.id, phases: each.phases, ...each.meta, covers }));
      }
      return;
    }
    console.log(`${app}-census in ${opts.browserName} (phase ${opts.phase}) against ${opts.base}`);
    if (opts.phase === "restart-check" && !kept()) {
      console.error(`no ${stateFile}: run --phase write first`);
      process.exit(2);
    }
    const browser = await launchEngine(opts.browserName, { headed: opts.headed });
    console.log(
      `engine: ${opts.browserName} ${browser.version()}${opts.headed ? " (headed)" : ""}`,
    );
    const results = [];
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
      acceptDownloads: true,
    });
    if (opts.browserName !== "firefox" && opts.browserName !== "webkit") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    }
    await context.addInitScript(EYEDROPPER_SPY);
    await context.addInitScript(SHARE_SPY);
    const page = await context.newPage();
    const watch = watchPage(page);
    const dialogs = acceptUnload(page);
    const ctx = { opts, keep, kept, app, browser, context, watch, dialogs, data: {} };
    let aborted = null;
    // Problems a row did not own (sign-up, prepare, teardown) fail the run as well.
    let attributed = 0;
    try {
      await page.goto(`${opts.base}/`, { waitUntil: "load" });
      if (opts.phase === "restart-check") {
        ctx.account = kept().account;
        await signIn(page, ctx.account);
      } else {
        ctx.account = newIdentity(app.replace(/[^a-z]/g, "").slice(0, 6), opts.browserName);
        await createAccount(page, ctx.account);
      }
      if (prepare) await prepare({ page, ctx });
      const selected = rows.filter(
        (each) =>
          each.phases.includes(opts.phase) && (!opts.only || new RegExp(opts.only).test(each.id)),
      );
      for (const each of selected) {
        if (aborted) {
          results.push({ id: each.id, ok: false, detail: `not run: ${aborted}`, ms: 0 });
          console.log(`FAIL ${each.id} (not run: ${aborted})`);
          continue;
        }
        const started = Date.now();
        const before = watch.problems.length;
        let outcome;
        let timer;
        let timedOut = false;
        try {
          if (beforeEach) await beforeEach({ page, ctx, id: each.id });
          const result = await Promise.race([
            each.body({ page, ctx }),
            new Promise((resolve) => {
              timer = setTimeout(() => {
                timedOut = true;
                resolve({ ok: false, detail: `timed out after ${each.timeout} ms` });
              }, each.timeout);
            }),
          ]);
          outcome =
            typeof result === "boolean"
              ? { ok: result, detail: "" }
              : result?.unavailable
                ? {
                    ok: true,
                    detail: `unavailable: ${result.unavailable}`,
                    unavailable: result.unavailable,
                  }
                : { ok: Boolean(result?.ok), detail: result?.detail ?? "" };
        } catch (error) {
          outcome = { ok: false, detail: String(error?.message ?? error).split("\n")[0] };
        } finally {
          clearTimeout(timer);
        }
        const fresh = watch.problems.slice(before);
        attributed += fresh.length;
        if (fresh.length > 0)
          outcome = {
            ok: false,
            detail: `${outcome.detail} | page problems: ${fresh.join(" ; ")}`,
          };
        const ms = Date.now() - started;
        results.push({ id: each.id, ...outcome, ms });
        console.log(
          `${outcome.ok ? "ok  " : "FAIL"} ${each.id}${outcome.detail ? ` (${outcome.detail})` : ""} [${ms} ms]`,
        );
        if (!outcome.ok) {
          await page
            .screenshot({
              path: path.join(opts.out, `${app}-${opts.browserName}-FAIL-${each.id}.png`),
              timeout: 5_000,
            })
            .catch(() => {});
          // Leave no menu or sheet open for the next row.
          for (let index = 0; index < 3; index += 1)
            await page.keyboard.press("Escape").catch(() => {});
        }
        // A timed-out body is still running and would send stray input into later rows: the journey stops here and
        // the remaining rows are reported as not run (the context is closed in `finally`, which ends the body).
        if (timedOut)
          aborted = `row ${each.id} timed out; the journey stopped so its body cannot touch later rows`;
      }
    } catch (error) {
      aborted = String(error?.message ?? error).split("\n")[0];
      console.log(`FAIL ${app}.journey (aborted: ${aborted})`);
      await page
        .screenshot({
          path: path.join(opts.out, `${app}-${opts.browserName}-ABORT.png`),
          timeout: 5_000,
        })
        .catch(() => {});
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
    const failed = results.filter((each) => !each.ok);
    const unowned = watch.problems.slice(0).length - attributed;
    writeFileSync(
      path.join(opts.out, `${app}-census-${opts.browserName}-${opts.phase}.json`),
      JSON.stringify(
        {
          app,
          engine: opts.browserName,
          phase: opts.phase,
          base: opts.base,
          at: new Date().toISOString(),
          aborted,
          results,
          problems: watch.problems,
        },
        null,
        2,
      ),
    );
    if (unowned > 0)
      console.log(
        `FAIL ${app}.page-problems (${unowned} outside any row: ${watch.problems.join(" ; ")})`,
      );
    const summary = `${app}-census ${opts.browserName} ${opts.phase}: ${results.length - failed.length}/${results.length} rows passed${aborted ? `, aborted: ${aborted}` : ""}${unowned > 0 ? `, ${unowned} page problem(s) outside rows` : ""}`;
    console.log(`\n${summary}`);
    if (failed.length > 0 || aborted || unowned > 0) process.exit(1);
  };
  return { row, run, opts, keep, kept };
}

// ---------------------------------------------------------------------------------------------------------------------
// The crawler's reading of the accessibility tree.

export const INTERACTIVE = new Set([
  "button",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "checkbox",
  "radio",
  "switch",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "option",
  "slider",
  "spinbutton",
  "tab",
  "link",
  "treeitem",
  "gridcell",
  "row",
]);

/**
 * Parse a Playwright aria snapshot into nodes { role, name, attrs, path } where `path` is the chain of named
 * ancestors. Only interactive roles and named separators (splitters) are returned.
 */
export function parseSnapshot(text) {
  const nodes = [];
  const stack = [];
  for (const raw of text.split("\n")) {
    const match = raw.match(/^(\s*)- ([a-z]+)(?: "((?:[^"\\]|\\.)*)")?((?: \[[^\]]*\])*)(:.*)?$/);
    if (!match) continue;
    const depth = match[1].length / 2;
    const role = match[2];
    const name = (match[3] ?? "").replace(/\\"/g, '"');
    const attrs = (match[4] ?? "").trim();
    while (stack.length > 0 && stack.at(-1).depth >= depth) stack.pop();
    const trail = stack.filter((each) => each.name).map((each) => `${each.role}:${each.name}`);
    stack.push({ depth, role, name });
    if (INTERACTIVE.has(role) || (role === "separator" && name))
      nodes.push({ role, name, attrs, path: trail.join(" > ") });
  }
  return nodes;
}

/** Read every item of the open menus (titles, roles, shortcuts, disabled, submenu) with their nesting. */
export function readOpenMenus(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="menu"]')].map((menu) => ({
      label:
        menu.getAttribute("aria-label") ??
        document.getElementById(menu.getAttribute("aria-labelledby") ?? "")?.textContent?.trim() ??
        "",
      items: [
        ...menu.querySelectorAll(
          '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]',
        ),
      ]
        .filter((item) => item.closest('[role="menu"]') === menu)
        .map((item) => ({
          role: item.getAttribute("role"),
          name: (
            item.querySelector(".mac-menu-item-title")?.textContent ??
            item.getAttribute("aria-label") ??
            item.textContent ??
            ""
          ).trim(),
          shortcut: item.getAttribute("aria-keyshortcuts") ?? "",
          disabled: item.getAttribute("aria-disabled") === "true",
          checked: item.getAttribute("aria-checked") ?? "",
          submenu:
            item.getAttribute("aria-haspopup") === "menu" || item.hasAttribute("aria-expanded"),
        })),
    })),
  );
}
