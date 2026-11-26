// The census harness of round 3's R6 family (Mail, Messages, FaceTime, Contacts, Reminders and Calendar), served by
// `ferrite dev`: the four engines (`chromium`, Google Chrome stable as `chrome`, `firefox`, `webkit`), a reporter that
// prints one `ok`/`FAIL` line per census id and, given the census file, fails every id no step of the run verified,
// real-input helpers (accounts made and signed in by typing at the login window, menu-bar commands chosen with the
// mouse, shortcuts pressed on the keyboard), the accessibility crawl the census is enumerated from, the state a `write`
// phase leaves for its `restart-check` phase, and the seeded exploratory pass of random real input.
//
// Real input only: every action under test is Playwright mouse, keyboard or file chooser. `page.evaluate` here only
// reads (the crawl, the server read-backs through `api`), never performs the action a step checks.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The engines `--browser` names; `chrome` is Google Chrome stable through Playwright's `chrome` channel. */
export const ENGINE_NAMES = ["chromium", "chrome", "firefox", "webkit"];

/** The password of every account the R6 suites make (a test account on a local `ferrite dev`, not a secret). */
export const PASSWORD = "r6-census-Pass-2026";

/**
 * The command line: `--url` (default http://127.0.0.1:8080), `--clock-url` (a `ferrite dev --clock-ms` server, for the
 * journeys that drive the clock), `--out` (default e2e/output/r6), `--browser`
 * (chromium, chrome, firefox or webkit), `--phase` (`all` by default; `write` then `restart-check` around a real restart),
 * `--state` (the JSON the write phase leaves for the restart check), `--census` (the census TSV to fail closed against),
 * `--headed` (a visible browser on `$DISPLAY`), `--seed` and `--minutes` (the exploratory pass), `--tag` (account names).
 */
export function options() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
  };
  const flag = (name) => args.includes(name);
  const browserName = option("--browser", "chromium");
  if (!ENGINE_NAMES.includes(browserName)) {
    console.error(`--browser must be one of ${ENGINE_NAMES.join(", ")}, not ${browserName}`);
    process.exit(2);
  }
  const phase = option("--phase", "all");
  if (!["all", "write", "restart-check"].includes(phase)) {
    console.error(`--phase must be all, write or restart-check, not ${phase}`);
    process.exit(2);
  }
  const out = path.resolve(option("--out", path.join(here, "output", "r6")));
  mkdirSync(out, { recursive: true });
  return {
    base: option("--url", "http://127.0.0.1:8080").replace(/\/$/, ""),
    clockUrl: option("--clock-url", "").replace(/\/$/, ""),
    out,
    browserName,
    phase,
    state: option("--state", ""),
    census: option("--census", ""),
    headed: flag("--headed"),
    seed: Number(option("--seed", "6")),
    minutes: Number(option("--minutes", "3")),
    tag: option("--tag", ""),
  };
}

/**
 * Launch `browserName`. `media` gives Chromium and Chrome fake camera and microphone devices and Firefox fake streams,
 * so FaceTime's calls run without hardware; WebKit has no such switch (its received picture is a ruled engine limit).
 */
export async function launchEngine(browserName, { headed = false, media = false } = {}) {
  const headless = !headed;
  const chromeArgs = media
    ? [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ]
    : [];
  switch (browserName) {
    case "chromium":
      return ENGINES.chromium.launch({ headless, args: chromeArgs });
    case "chrome":
      return ENGINES.chrome.launch({ headless, args: chromeArgs });
    case "firefox":
      return ENGINES.firefox.launch({
        headless,
        firefoxUserPrefs: media
          ? {
              "media.navigator.streams.fake": true,
              "media.navigator.permission.disabled": true,
              "media.autoplay.default": 0,
            }
          : {},
      });
    case "webkit":
      return ENGINES.webkit.launch({ headless });
    default:
      throw new Error(`unknown engine ${browserName}`);
  }
}

/** The contexts' permissions an engine supports for a media page (WebKit and Firefox refuse unknown names). */
export function mediaPermissions(browserName) {
  return browserName === "chromium" || browserName === "chrome" ? ["camera", "microphone"] : [];
}

/** A fresh account's fields; `tag` keeps runs, engines and people apart on one server. */
export function account(label, tag) {
  const name = `${label}${tag}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 28);
  const fullName = `${label[0].toUpperCase()}${label.slice(1)} ${tag}`.replace(
    /[^A-Za-z0-9 ]/g,
    "",
  );
  return { name, fullName, password: PASSWORD };
}

/** Wait until `check` holds, up to `ms`: how long it took, or `null`. */
export async function within(ms, check) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      if (await check()) return Date.now() - start;
    } catch {
      // Not there yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return null;
}

/** Pause `ms` (for a debounce the app documents, never instead of waiting for an outcome). */
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Click into `locator`, select what it holds and type `text` key by key (real keyboard input). */
export async function typeInto(locator, text, { clear = true, delay = 0 } = {}) {
  await locator.click();
  if (clear) {
    await locator.press("ControlOrMeta+a");
    await locator.press("Backspace");
  }
  if (text) await locator.pressSequentially(text, { delay });
}

/** Make the account at the login window's Create Account… form by typing; resolves on its desktop. */
export async function signUp(page, { name, fullName, password }) {
  const users = page.getByRole("group", { name: "Users" });
  await users.waitFor({ timeout: 30_000 });
  await users.getByRole("button", { name: "Create Account…", exact: true }).click();
  const form = page.getByRole("form", { name: "Create Account" });
  await form.waitFor({ timeout: 10_000 });
  await typeInto(form.getByLabel("Full Name:"), fullName);
  await typeInto(form.getByLabel("Account Name:"), name);
  await typeInto(form.getByLabel("Password:"), password);
  await typeInto(form.getByLabel("Verify:"), password);
  await form.getByRole("button", { name: "Create Account" }).click();
  await finder(page).waitFor({ timeout: 40_000 });
}

/** Sign in to an existing account through the login window's Other… tile, by typing; resolves on its desktop. */
export async function signIn(page, { name, password }) {
  const users = page.getByRole("group", { name: "Users" });
  await users.or(finder(page)).first().waitFor({ timeout: 30_000 });
  if (!(await users.isVisible())) return;
  await users.getByRole("button", { name: "Other…", exact: true }).click();
  const form = page.getByRole("form", { name: "Log In" });
  await form.waitFor({ timeout: 10_000 });
  await typeInto(form.getByLabel("Account Name:"), name);
  await typeInto(form.getByLabel("Password:"), password);
  await form.getByRole("button", { name: "Log In" }).click();
  await finder(page).waitFor({ timeout: 40_000 });
}

/** The Dock's Finder tile: the desktop answers once it shows. */
export const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

/** Reload the page and wait for the desktop (signed in by its cookie). */
export async function reload(page) {
  await page.reload({ waitUntil: "load" });
  await finder(page).waitFor({ timeout: 40_000 });
}

/** The window frame (`[data-window-id]`) whose region is named `name`. */
export function windowFrame(page, name) {
  const region =
    typeof name === "string"
      ? page.getByRole("region", { name, exact: true })
      : page.getByRole("region", { name });
  return page.locator("[data-window-id]").filter({ has: region }).first();
}

/** The region of the window named `name` (the app's content and title bar). */
export function appWindow(page, name) {
  return typeof name === "string"
    ? page.getByRole("region", { name, exact: true }).first()
    : page.getByRole("region", { name }).first();
}

/**
 * The Window controls (Close, Minimize, Enter Full Screen) of the window named `name`: those of its own title bar. A
 * child window can render inside its parent's frame (Mail's Preferences inside Mail's), so the frame may hold two sets.
 */
export function windowControls(page, name) {
  // The region holds its own title bar first (a Preferences window has no [data-title-bar]); a child window is a
  // sibling of its parent region, never inside it.
  return appWindow(page, name).getByRole("group", { name: "Window controls" }).first();
}

/** Click the app's Dock tile and wait for its window, a region named `windowName`. */
export async function openApp(page, appName, windowName = appName) {
  await page
    .getByRole("button", { name: new RegExp(`^${appName}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${appName}$`) }))
    .first()
    .click();
  const window = appWindow(page, windowName);
  await window.waitFor({ state: "visible", timeout: 20_000 });
  return window;
}

/** A menu bar title by name (Base UI's menubar triggers are menuitems; the extras are buttons). */
export function menuTitle(page, title) {
  const bar = page.getByRole("menubar").first();
  return bar
    .getByRole("menuitem", { name: title, exact: true })
    .or(bar.getByRole("button", { name: title, exact: true }))
    .first();
}

const ITEM_ROLES = ["menuitem", "menuitemcheckbox", "menuitemradio"];

/** An item of the open menu (the last one opened), by name, as any of the three menu item roles. */
export function openMenuItem(page, name) {
  const menu = page.locator('[role="menu"][data-open]').last();
  const exact = typeof name === "string";
  let item = menu.getByRole(ITEM_ROLES[0], { name, exact });
  for (const role of ITEM_ROLES.slice(1)) item = item.or(menu.getByRole(role, { name, exact }));
  return item.first();
}

/**
 * Open the menu `title` with the mouse and walk `path` through it: every name but the last is a submenu, opened by
 * hovering its trigger; the last is clicked. Resolves to the clicked item's state as it was (disabled, checked).
 */
export async function menu(page, title, ...pathNames) {
  await menuTitle(page, title).click();
  await page.locator('[role="menu"][data-open]').last().waitFor({ timeout: 5_000 });
  for (const [index, name] of pathNames.entries()) {
    const item = openMenuItem(page, name);
    await item.waitFor({ timeout: 5_000 });
    if (index < pathNames.length - 1) {
      const open = await page.locator('[role="menu"][data-open]').count();
      await item.hover();
      await within(
        3_000,
        async () => (await page.locator('[role="menu"][data-open]').count()) > open,
      );
    } else {
      const state = await itemState(item);
      if (state.disabled) {
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        return state;
      }
      await item.click();
      return state;
    }
  }
  return {};
}

/** Open the menu `title`, read the state of the item at `path` without choosing it, and close the menu. */
export async function peekMenu(page, title, ...pathNames) {
  await menuTitle(page, title).click();
  await page.locator('[role="menu"][data-open]').last().waitFor({ timeout: 5_000 });
  let state = { missing: true };
  for (const [index, name] of pathNames.entries()) {
    const item = openMenuItem(page, name);
    if (!(await item.count())) break;
    if (index < pathNames.length - 1) {
      const open = await page.locator('[role="menu"][data-open]').count();
      await item.hover();
      await within(
        3_000,
        async () => (await page.locator('[role="menu"][data-open]').count()) > open,
      );
    } else state = await itemState(item);
  }
  for (let i = 0; i < 3 && (await page.locator('[role="menu"][data-open]').count()); i++)
    await page.keyboard.press("Escape");
  return state;
}

async function itemState(item) {
  return item.evaluate((element) => ({
    disabled:
      element.hasAttribute("data-disabled") || element.getAttribute("aria-disabled") === "true",
    checked: element.getAttribute("aria-checked") === "true",
    shortcut: element.querySelector("kbd, [data-key-equivalent]")?.textContent?.trim() ?? "",
    text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
  }));
}

/** Press a shortcut a menu names; `Command` is Control off Apple platforms (src/lib/menu-key-commands.ts). */
export async function shortcut(page, keys) {
  await page.keyboard.press(keys.replace(/\bCommand\b/g, "ControlOrMeta"));
}

/** `fetch` from inside the page (read-backs of what a step did), so the browser's own cookie applies. */
export function api(page, method, url, body, headers = {}) {
  return page.evaluate(
    async ({ method, url, body, headers }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
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
    { method, url, body, headers },
  );
}

/** Drag with real pointer events from `from` to `to` ({x, y}) in `steps` moves. */
export async function drag(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

/** The centre of a locator's box. */
export async function centre(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

/** The state a write phase leaves for its restart check. */
export function stateFile(o, app) {
  return o.state || path.join(o.out, `${app}-${o.browserName}-restart-state.json`);
}
export function saveState(o, app, data) {
  writeFileSync(stateFile(o, app), `${JSON.stringify(data, null, 2)}\n`);
}
export function loadState(o, app) {
  const file = stateFile(o, app);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

/** The census rows of `app` in a census TSV (header row first, tab-separated). */
export function censusRows(file, app) {
  const [header, ...lines] = readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim());
  const keys = header.split("\t");
  return lines
    .map((line) => Object.fromEntries(line.split("\t").map((value, i) => [keys[i], value])))
    .filter((row) => row.app === app);
}

/**
 * A census run of `app`: `check(id, ok, detail)` prints one line per census id, `allow(pattern)` lets a refusal a step
 * provokes on purpose pass the page watch, and `run(body)` launches the engine, hands `body` a `person(label)` that opens
 * a desktop in a context of its own (signed up, or signed in with `{ existing }`), and exits 0 only when every id passed,
 * no page logged a console error, page error, failed request or HTTP error, and every row of the phase was checked: the
 * rows of `--census` when it is given, otherwise the suite's own `rows`.
 */
export function census(app, { media = false, contextOptions = {}, rows = [] } = {}) {
  const o = options();
  const results = new Map();
  const problems = [];
  const allowed = [];
  const pages = [];
  const started = Date.now();
  const check = (id, ok, detail = "") => {
    const passed = Boolean(ok);
    console.log(`${passed ? "ok  " : "FAIL"} ${id}${detail ? ` (${detail})` : ""}`);
    const previous = results.get(id);
    results.set(id, { ok: passed && (previous?.ok ?? true), detail });
    if (!passed) problems.push(id);
    return passed;
  };
  const allow = (pattern) => allowed.push(pattern);
  const problem = (text) => {
    if (!allowed.some((pattern) => pattern.test(text))) problems.push(text);
  };
  const watch = (page, label) => {
    page.on("console", (message) => {
      if (message.type() === "error") problem(`${label} console: ${message.text()}`);
    });
    page.on("pageerror", (error) => problem(`${label} page error: ${error.message}`));
    page.on("requestfailed", (request) => {
      const text = request.failure()?.errorText ?? "";
      // Streams and media reads the page itself closes (reload stream, live feeds, blob reads).
      if (/ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(text)) return;
      problem(`${label} request failed: ${request.url()} ${text}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        problem(`${label} HTTP ${response.status()}: ${response.url()}`);
    });
  };
  const shot = async (page, file) => {
    try {
      await page.screenshot({
        path: path.join(o.out, `${app}-${file}-${o.browserName}.png`),
        timeout: o.browserName === "webkit" ? 4_000 : 15_000,
      });
    } catch (error) {
      console.log(`warn screenshot ${file} not saved: ${String(error.message).split("\n")[0]}`);
    }
  };
  const run = async (body) => {
    console.log(`${app} census in ${o.browserName} (phase ${o.phase}) against ${o.base}`);
    const browser = await launchEngine(o.browserName, { headed: o.headed, media });
    console.log(
      `engine: ${o.browserName} ${browser.version()}${o.headed ? ` headed on DISPLAY=${process.env.DISPLAY}` : ""}`,
    );
    const contexts = [];
    const person = async (label, fields = {}) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        timezoneId: fields.timezoneId ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(contextOptions[o.browserName] ?? {}),
      });
      contexts.push(context);
      const page = await context.newPage();
      watch(page, label);
      pages.push(page);
      await page.goto(`${o.base}/`, { waitUntil: "load" });
      if (fields.existing) {
        await signIn(page, fields.existing);
        page.account = fields.existing;
      } else {
        const made =
          fields.account ??
          account(label, o.tag || `${o.browserName.slice(0, 2)}${Date.now().toString(36)}`);
        await signUp(page, made);
        page.account = made;
      }
      return page;
    };
    try {
      await body({ person, browser, check, allow, shot, o, watch, contexts });
    } catch (error) {
      problems.push(
        `run aborted: ${error instanceof Error ? (error.stack ?? error.message) : error}`,
      );
      console.log(
        `FAIL run aborted: ${error instanceof Error ? error.message.split("\n")[0] : error}`,
      );
    } finally {
      for (const context of contexts) await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
    const listed = o.census ? censusRows(o.census, app) : rows;
    if (listed.length > 0) {
      const expected = listed.filter(
        (row) => o.phase !== "restart-check" || row.persists === "restart",
      );
      const unverified = expected.filter((row) => !results.has(row.id));
      for (const row of unverified) check(row.id, false, "no step of this run verified it");
      const passing = expected.filter((row) => results.get(row.id)?.ok).length;
      console.log(
        `census ${app} ${o.browserName} ${o.phase}: ${passing}/${expected.length} rows pass`,
      );
    }
    const tsv = [...results].map(
      ([id, r]) => `${id}\t${r.ok ? "pass" : "fail"}\t${r.detail.replace(/\s+/g, " ")}`,
    );
    writeFileSync(
      path.join(o.out, `${app}-census-${o.browserName}-${o.phase}.tsv`),
      `${tsv.join("\n")}\n`,
    );
    console.log(`elapsed ${Math.round((Date.now() - started) / 1000)} s; evidence in ${o.out}`);
    if (problems.length > 0) {
      console.error(
        `\n${app} census: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
      );
      process.exit(1);
    }
    console.log(`\n${app} census: all ${results.size} ids passed with no console errors`);
  };
  return { o, check, allow, run, shot, watch };
}

// ---------------------------------------------------------------------------------------------------------------
// The crawl: every control of the given scope, as an accessibility tree computes roles and names.

/** The roles the census enumerates (brief section 5). */
export const CENSUS_ROLES = [
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
];

/**
 * Every visible control on the page with a census role, read from the DOM as the accessibility tree derives it
 * (explicit role, else the element's implicit role), with its accessible name, state, title, and where it is: the
 * window (its region's name), the open menu (its title), or the dialog. Resize handles (`[data-edge]`) come as role
 * `resizer`. Read only.
 */
export async function enumerate(page) {
  return page.evaluate((roles) => {
    const wanted = new Set(roles);
    // Text as an accessible name reads it: aria-hidden descendants (a menu item's shortcut glyphs) left out.
    const text = (element) => {
      if (!element) return "";
      let out = "";
      const walk = (node) => {
        for (const child of node.childNodes) {
          if (child.nodeType === 3) out += child.nodeValue;
          else if (child.nodeType === 1 && child.getAttribute("aria-hidden") !== "true")
            walk(child);
        }
      };
      walk(element);
      return out.replace(/\s+/g, " ").trim();
    };
    const implicit = (element) => {
      const tag = element.tagName.toLowerCase();
      if (tag === "button" || tag === "summary") return "button";
      if (tag === "a" && element.hasAttribute("href")) return "link";
      if (tag === "select") return element.multiple || element.size > 1 ? "listbox" : "combobox";
      if (tag === "textarea") return "textbox";
      if (tag === "option") return "option";
      if (tag === "input") {
        const type = (element.getAttribute("type") ?? "text").toLowerCase();
        const map = {
          checkbox: "checkbox",
          radio: "radio",
          range: "slider",
          number: "spinbutton",
          search: "searchbox",
          button: "button",
          submit: "button",
          reset: "button",
          image: "button",
          file: "button",
          color: "button",
        };
        if (type === "hidden") return null;
        return map[type] ?? "textbox";
      }
      if (
        element.getAttribute("contenteditable") === "true" ||
        element.getAttribute("contenteditable") === ""
      )
        return "textbox";
      return null;
    };
    const nameOf = (element) => {
      const labelledby = element.getAttribute("aria-labelledby");
      if (labelledby) {
        const joined = labelledby
          .split(/\s+/)
          .map((id) => text(document.getElementById(id)))
          .filter(Boolean)
          .join(" ");
        if (joined) return joined;
      }
      const label = element.getAttribute("aria-label");
      if (label) return label.trim();
      if (element.labels?.length) {
        const joined = [...element.labels].map(text).filter(Boolean).join(" ");
        if (joined) return joined;
      }
      const own = element.getAttribute("alt") ?? "";
      if (own) return own;
      const tag = element.tagName.toLowerCase();
      if (tag !== "input" && tag !== "textarea" && tag !== "select") {
        const t = text(element);
        if (t) return t.slice(0, 90);
      }
      return (element.getAttribute("title") ?? element.getAttribute("placeholder") ?? "").trim();
    };
    const visible = (element, resizer = false) => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      if (
        element.checkVisibility &&
        !element.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })
      )
        return false;
      // The resize handles are aria-hidden pointer targets (managed-window.tsx): they count, the rest of a hidden tree does not.
      if (element.closest("[inert]")) return false;
      if (!resizer && element.closest("[aria-hidden='true']")) return false;
      return true;
    };
    const where = (element) => {
      const menu = element.closest('[role="menu"]');
      if (menu) {
        const id = menu.getAttribute("aria-labelledby");
        const title =
          (id && text(document.getElementById(id))) || menu.getAttribute("aria-label") || "";
        return { kind: "menu", name: title };
      }
      const dialog = element.closest('[role="dialog"], [role="alertdialog"]');
      const frame = element.closest("[data-window-id]");
      const region = frame?.querySelector('[role="region"]');
      const windowName = (region && nameOf(region)) || frame?.getAttribute("aria-label") || "";
      if (element.hasAttribute("data-edge") && frame)
        return { kind: "window", name: windowName, windowId: frame.getAttribute("data-window-id") };
      if (dialog && (!frame?.contains(dialog) || dialog.contains(frame) === false)) {
        const dname =
          dialog.getAttribute("aria-label") ||
          text(document.getElementById(dialog.getAttribute("aria-labelledby") ?? ""));
        if (!frame || frame.contains(dialog))
          return { kind: frame ? "sheet" : "dialog", name: dname, window: windowName };
      }
      if (frame)
        return { kind: "window", name: windowName, windowId: frame.getAttribute("data-window-id") };
      if (element.closest('[role="menubar"]')) return { kind: "menubar", name: "" };
      return { kind: "desktop", name: "" };
    };
    const out = [];
    for (const element of document.querySelectorAll("*")) {
      let role = (element.getAttribute("role") ?? "").split(/\s+/)[0] || implicit(element);
      if (element.hasAttribute("data-edge") && element.closest("[data-window-id]"))
        role = "resize-handle";
      // A focusable separator is a splitter (a widget); a plain one is decoration.
      if (role === "separator" && element.hasAttribute("tabindex")) role = "splitter";
      if (!role || (!wanted.has(role) && role !== "resize-handle" && role !== "splitter")) continue;
      if (!visible(element, role === "resize-handle")) continue;
      const at = where(element);
      const rect = element.getBoundingClientRect();
      out.push({
        role,
        name: role === "resize-handle" ? element.getAttribute("data-edge") : nameOf(element),
        disabled: Boolean(
          element.disabled ||
            element.getAttribute("aria-disabled") === "true" ||
            element.hasAttribute("data-disabled"),
        ),
        checked: element.getAttribute("aria-checked") ?? (element.checked === true ? "true" : ""),
        selected: element.getAttribute("aria-selected") ?? "",
        expanded: element.getAttribute("aria-expanded") ?? "",
        haspopup: element.getAttribute("aria-haspopup") ?? "",
        keys: element.getAttribute("aria-keyshortcuts") ?? "",
        title: element.getAttribute("title") ?? "",
        tabindex: element.getAttribute("tabindex") ?? "",
        where: at.kind,
        place: at.name ?? "",
        window: at.window ?? (at.kind === "window" ? at.name : ""),
        windowId: at.windowId ?? "",
        x: Math.round(rect.x + rect.width / 2),
        y: Math.round(rect.y + rect.height / 2),
      });
    }
    return out;
  }, CENSUS_ROLES);
}

/**
 * Open each menu bar title in `titles` with the mouse and enumerate its items, hovering every submenu trigger to
 * enumerate the submenu too. Returns the controls with `place` set to the menu path ("View" or "View > Sort By").
 */
export async function crawlMenus(page, titles) {
  const found = [];
  for (const title of titles) {
    const trigger = menuTitle(page, title);
    if (!(await trigger.count())) {
      found.push({
        role: "menuitem",
        name: title,
        where: "menubar",
        place: "(missing)",
        disabled: true,
      });
      continue;
    }
    await trigger.click();
    const open = page.locator('[role="menu"][data-open]').last();
    await open.waitFor({ timeout: 5_000 }).catch(() => {});
    await pause(150);
    const items = (await enumerate(page)).filter((c) => c.where === "menu");
    for (const item of items) found.push({ ...item, place: title });
    for (const item of items.filter((c) => c.haspopup && c.haspopup !== "false" && !c.disabled)) {
      const before = await page.locator('[role="menu"][data-open]').count();
      await page.mouse.move(item.x, item.y);
      await within(
        2_000,
        async () => (await page.locator('[role="menu"][data-open]').count()) > before,
      );
      await pause(150);
      const sub = (await enumerate(page)).filter(
        (c) =>
          c.where === "menu" && !items.some((i) => i.name === c.name && i.x === c.x && i.y === c.y),
      );
      for (const s of sub) found.push({ ...s, place: `${title} > ${item.name}` });
    }
    for (let i = 0; i < 3 && (await page.locator('[role="menu"][data-open]').count()); i++)
      await page.keyboard.press("Escape");
    await pause(100);
  }
  return found;
}

/** The crawl's TSV columns. */
export const CRAWL_COLUMNS = [
  "engine",
  "app",
  "state",
  "where",
  "place",
  "window",
  "role",
  "name",
  "disabled",
  "checked",
  "selected",
  "expanded",
  "haspopup",
  "keys",
  "title",
];

/** Append crawl records as TSV rows to `file` (header written once). */
export function writeCrawl(file, records) {
  if (!existsSync(file)) writeFileSync(file, `${CRAWL_COLUMNS.join("\t")}\n`);
  const clean = (value) => String(value ?? "").replace(/[\t\n\r]+/g, " ");
  appendFileSync(
    file,
    records.map((r) => CRAWL_COLUMNS.map((c) => clean(r[c])).join("\t")).join("\n") +
      (records.length ? "\n" : ""),
  );
}

/**
 * Record every control on screen now (and of the open menu) as state `state` of `app` in
 * `<out>/<app>-snapshot-<engine>.tsv`, so the census check sees the states a suite reaches with data (message rows,
 * events, sheets) that a fresh crawl cannot. Read only.
 */
export async function snapshot(page, o, app, state) {
  // The app's own windows (their frames' ids start with the app id: mail, mail:compose-1) and any open menu.
  const controls = (await enumerate(page).catch(() => [])).filter(
    (c) => c.where === "menu" || String(c.windowId ?? "").split(":")[0] === app,
  );
  writeCrawl(
    path.join(o.out, `${app}-snapshot-${o.browserName}.tsv`),
    controls.map((c) => ({ engine: o.browserName, app, state, ...c })),
  );
  return controls;
}

// ---------------------------------------------------------------------------------------------------------------
// The exploratory pass: seeded random real input inside the app's windows and its menus.

/** A small seeded generator (mulberry32), so a pass can be replayed from its seed. */
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYS = [
  "Tab",
  "Shift+Tab",
  "Enter",
  "Escape",
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "Backspace",
  "Delete",
  "Home",
  "End",
  "PageDown",
];
const WORDS = [
  "hello",
  "r6 ",
  "Lunch at 12",
  "éè ü",
  "x",
  "https://example.org",
  "42",
  "  ",
  "<b>",
  "—",
];

/**
 * Drive `ms` of seeded random real input on `page`: clicks on enabled controls of the windows named by `windows`
 * (regexes over the window's name) and of the menus `menus` titles; typing into focused fields; keys; window title-bar
 * drags and edge resizes. Never the Apple menu, the Dock or another app's window. Records every action to `log`
 * (JSONL) and fails when the page stops answering for 8 s. `reopen()` opens the app again if its window closed.
 * Commands that would end the session (Log Out, Restart, Shut Down) are outside the scope and never clicked.
 */
export async function explore(page, { seed, ms, windows, menus, log, reopen, avoid = /^$/ }) {
  const next = random(seed);
  const pick = (list) => list[Math.floor(next() * list.length)];
  const end = Date.now() + ms;
  // The desktop's origin: a click that leaves it (an outside link) is undone with goBack.
  const home = new URL(page.url()).origin;
  let actions = 0;
  let hung = null;
  const record = (entry) =>
    appendFileSync(log, `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`);
  record({ start: true, seed, ms });
  while (Date.now() < end) {
    const alive = await Promise.race([
      page.evaluate(() => 1).then(() => true),
      pause(8_000).then(() => false),
    ]);
    if (!alive) {
      hung = `the page stopped answering after action ${actions}`;
      record({ hung });
      break;
    }
    const all = await enumerate(page).catch(() => []);
    const mine = all.filter(
      (c) =>
        !c.disabled &&
        !avoid.test(c.name) &&
        (((c.where === "window" || c.where === "sheet") && windows.some((w) => w.test(c.window))) ||
          c.where === "dialog" ||
          c.where === "menu"),
    );
    if (!all.some((c) => c.where === "window" && windows.some((w) => w.test(c.window)))) {
      record({ action: "reopen" });
      await reopen().catch((error) =>
        record({ reopenFailed: String(error.message).split("\n")[0] }),
      );
      actions++;
      continue;
    }
    const roll = next();
    try {
      if (roll < 0.55 && mine.length) {
        const target = pick(mine);
        record({
          action: "click",
          role: target.role,
          name: target.name,
          where: target.where,
          x: target.x,
          y: target.y,
        });
        await page.mouse.click(target.x, target.y);
      } else if (roll < 0.65 && menus.length) {
        const title = pick(menus);
        record({ action: "menu", title });
        await menuTitle(page, title).click({ timeout: 2_000 });
      } else if (roll < 0.8) {
        const word = pick(WORDS);
        record({ action: "type", text: word });
        await page.keyboard.type(word);
      } else if (roll < 0.93) {
        const key = pick(KEYS);
        record({ action: "key", key });
        await page.keyboard.press(key);
      } else {
        const own = all.filter(
          (c) => c.role === "resize-handle" && windows.some((w) => w.test(c.window)),
        );
        if (own.length && next() < 0.5) {
          const edge = pick(own);
          const dx = Math.round((next() - 0.5) * 120);
          const dy = Math.round((next() - 0.5) * 120);
          record({ action: "resize", edge: edge.name, dx, dy });
          await drag(page, edge, { x: edge.x + dx, y: edge.y + dy }, 6);
        } else {
          // Only a window of this app: its frame's region name matches `windows`.
          const titles = all.filter(
            (c) => c.where === "window" && windows.some((w) => w.test(c.window)),
          );
          const name = titles.length ? pick(titles).window : null;
          const box = name
            ? await windowFrame(page, name).locator("[data-title-bar]").first().boundingBox()
            : null;
          if (box) {
            const from = { x: box.x + box.width / 2, y: box.y + 8 };
            const dx = Math.round((next() - 0.5) * 160);
            const dy = Math.round((next() - 0.5) * 100);
            record({ action: "move", window: name, dx, dy });
            await drag(page, from, { x: from.x + dx, y: Math.max(30, from.y + dy) }, 6);
          }
        }
      }
    } catch (error) {
      record({ actionFailed: String(error.message).split("\n")[0] });
    }
    actions++;
    await pause(120 + Math.floor(next() * 200));
    if (new URL(page.url()).origin !== home) {
      record({ action: "back", from: page.url() });
      await page.goBack().catch(() => {});
    }
  }
  // Leave no menu or sheet open for the steps after the pass.
  for (let i = 0; i < 3; i++) await page.keyboard.press("Escape").catch(() => {});
  record({ end: true, actions, hung });
  return { actions, hung };
}
