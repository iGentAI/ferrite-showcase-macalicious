// R2's census kit (shell, windows and system apps), on journey-kit.mjs: the four engines of round 3 (chromium,
// chrome = Google Chrome stable through Playwright's `chrome` channel, firefox, webkit), real accounts made at the login
// window, one `ok`/`FAIL` line per census id, a watch that fails the run on any first-party page error, console error,
// unhandled rejection, failed request or 5xx, and an accessibility-tree crawl (Playwright's ariaSnapshot, the same
// role and name computation `getByRole` uses) for the census's mechanical enumeration.
//
// Options every census suite takes:
//   --url <base>  --out <dir>  --browser chromium|chrome|firefox|webkit  --phase write|restart-check|all
//   --run <id>    a run id shared by the write and restart-check phases (accounts and markers are named after it)
//   --headed      a headed browser (the once-per-family Xvfb Chrome run sets DISPLAY)
// Results: <out>/<suite>-<browser>-<phase>.json, { id: "pass" | "fail" | "unavailable:<reason>" | "n/a:<reason>" }.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES as JOURNEY_ENGINES } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The four engines of round 3, as journey-kit.mjs has them (Playwright's Chromium, Google Chrome stable through the
 * `chrome` channel, Firefox and WebKit): each launches headless, or headed for the once-per-family Xvfb run.
 */
export const ENGINES = Object.fromEntries(
  Object.keys(JOURNEY_ENGINES).map((name) => [
    name,
    (headed) => JOURNEY_ENGINES[name].launch({ headless: !headed }),
  ]),
);

/** The command-line options every R2 census suite takes. */
export function censusOptions() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
  };
  const browserName = option("--browser", "chromium");
  if (!ENGINES[browserName]) {
    console.error(
      `--browser must be one of ${Object.keys(ENGINES).join(", ")}, not ${browserName}`,
    );
    process.exit(2);
  }
  const phase = option("--phase", "all");
  if (!["write", "restart-check", "all"].includes(phase)) {
    console.error(`--phase must be write, restart-check or all, not ${phase}`);
    process.exit(2);
  }
  const out = path.resolve(option("--out", path.join(here, "output")));
  mkdirSync(out, { recursive: true });
  return {
    base: option("--url", "http://127.0.0.1:8080").replace(/\/$/, ""),
    out,
    browserName,
    phase,
    run: option("--run", Date.now().toString(36)),
    headed: args.includes("--headed"),
    list: args.includes("--list"),
  };
}

/** Requests whose cut-short failure is the page's own doing: the live-reload stream and the desktop's live streams. */
function expectedAbort(url, text) {
  let pathname = "";
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  return (
    (url.includes("/__forge/reload") || pathname.startsWith("/live/")) &&
    /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(text)
  );
}

/**
 * Watches a page for the problems that fail a run: page errors (unhandled exceptions and rejections), console errors, failed
 * first-party requests and HTTP 5xx. HTTP 4xx answers are recorded and fail the run unless `allow(status, pathname)` was
 * called for them (a refusal the suite provokes on purpose). Problems are pushed onto `problems` with the page's label and,
 * when `step` is given (`{ last }`, kept by `census`), the census row checked last before the problem, which places it in
 * the journey.
 */
export function watchPage(page, label, problems, allowed, step) {
  const after = () => (step ? ` [after ${step.last}]` : "");
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    const provoked = /status of (\d{3})/.exec(text);
    if (provoked && allowed.consoleStatuses.has(Number(provoked[1]))) return;
    const where = message.location()?.url;
    problems.push(`${label} console: ${text}${where ? ` (${where})` : ""}${after()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}${after()}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    if (expectedAbort(request.url(), text)) return;
    // A request the page cut short itself on a reload or a sign-out (no response is lost to the person).
    if (allowed.aborts && /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(text)) return;
    problems.push(
      `${label} request failed: ${request.url()} ${text}${request.isNavigationRequest() ? " (navigation)" : ""}${after()}`,
    );
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;
    let pathname = response.url();
    try {
      pathname = new URL(response.url()).pathname;
    } catch {}
    const key = `${status} ${pathname}`;
    const left = allowed.responses.get(key) ?? 0;
    if (status < 500 && left > 0) {
      allowed.responses.set(key, left - 1);
      return;
    }
    problems.push(`${label} HTTP ${key}${after()}`);
  });
}

/**
 * Runs one census suite: `body(kit)` gets `{ browser, newPage, check, skip, allow, base, out, phase, run, browserName }`.
 * `rows` is the suite's census: `[{ id, ... }]`. Every id prints exactly one line, `ok <id>` or `FAIL <id> (detail)`; an id the
 * body never checked prints `FAIL <id> (not reached)`. The run exits 0 only when every row of the phase passed (or was
 * recorded unavailable or n/a with its reason) and no page had a problem.
 */
export async function census(suite, rows, body) {
  const opts = censusOptions();
  if (opts.list) {
    for (const row of rows) console.log(JSON.stringify(row));
    return;
  }
  const inPhase = (row) =>
    opts.phase === "all" || (row.phase ?? "write") === opts.phase || row.phase === "both";
  const wanted = rows.filter(inPhase);
  const known = new Set(rows.map((row) => row.id));
  const results = {};
  const problems = [];
  const allowed = { responses: new Map(), consoleStatuses: new Set(), aborts: false };
  // The census row checked last: a page problem names it, so the problem can be placed in the journey.
  const step = { last: "start" };
  const check = (id, ok, detail = "") => {
    step.last = id;
    if (!known.has(id)) problems.push(`check of an id not in the census: ${id}`);
    if (results[id] === "fail") return false;
    results[id] = ok ? "pass" : "fail";
    console.log(`${ok ? "ok  " : "FAIL"} ${id}${detail ? ` (${detail})` : ""}`);
    return ok;
  };
  /**
   * Records a row as unavailable (the reason the person sees, verified on screen by the caller) or n/a. A row already
   * recorded as failed stays failed, and a verdict that is not `unavailable:<reason>` or `n/a:<reason>` with a reason is a
   * failure of the row.
   */
  const skip = (id, verdict, ok = true) => {
    step.last = id;
    if (!known.has(id)) problems.push(`check of an id not in the census: ${id}`);
    if (results[id] === "fail") return false;
    const valid = typeof verdict === "string" && /^(unavailable|n\/a):\s*\S/.test(verdict);
    const passed = ok && valid;
    results[id] = passed ? verdict : "fail";
    console.log(
      `${passed ? "ok  " : "FAIL"} ${id} (${valid ? verdict : `invalid verdict: ${verdict}`})`,
    );
    return passed;
  };
  const allow = (status, pathname, times = 1) => {
    const key = `${status} ${pathname}`;
    allowed.responses.set(key, (allowed.responses.get(key) ?? 0) + times);
    allowed.consoleStatuses.add(status);
  };
  console.log(
    `${suite} census in ${opts.browserName} (${opts.headed ? "headed" : "headless"}) against ${opts.base}, phase ${opts.phase}, run ${opts.run}`,
  );
  const started = Date.now();
  const browser = await ENGINES[opts.browserName](opts.headed);
  const contexts = [];
  const newPage = async (label, contextOptions = {}) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ...contextOptions,
    });
    contexts.push(context);
    const page = await context.newPage();
    watchPage(page, label, problems, allowed, step);
    return page;
  };
  try {
    await body({ ...opts, browser, newPage, check, skip, allow, allowed, problems });
  } catch (error) {
    problems.push(
      `suite aborted: ${error instanceof Error ? error.stack?.split("\n").slice(0, 3).join(" | ") : error}`,
    );
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
  for (const row of wanted) {
    if (!(row.id in results)) {
      results[row.id] = "fail";
      console.log(`FAIL ${row.id} (not reached)`);
    }
  }
  const file = path.join(opts.out, `${suite}-${opts.browserName}-${opts.phase}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      { suite, browser: opts.browserName, phase: opts.phase, run: opts.run, problems, results },
      null,
      1,
    ),
  );
  const failed = Object.values(results).filter((v) => v === "fail").length;
  console.log(`results in ${file}; ${(Date.now() - started) / 1000}s`);
  if (failed > 0 || problems.length > 0) {
    console.error(
      `\n${suite}: ${failed} failed row(s), ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log(`\n${suite}: all ${wanted.length} census rows passed with no page problem`);
}

// ---------------------------------------------------------------------------------------------------------------------
// The login window.

export const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();
export const userTile = (page, name) =>
  page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
export const passwordField = (page) => page.getByRole("textbox", { name: "Enter Password" });

/** The longest account name the server takes (`ferrite-apps/desktop/src/accounts/mod.rs`, `MAX_NAME_CHARS`). */
const MAX_NAME_CHARS = 32;

/**
 * A person for a run: an account name unique to the run and the role, a full name and a password. The name is
 * `<role>-<run>`, or, when that is longer than the server takes, its first 24 characters and a 7-character hash of the
 * whole: the same for the same run and role, so the restart-check phase signs in again as the account the write phase
 * made.
 */
export function person(run, role, fullName) {
  const full = `${role}-${run}`.toLowerCase();
  let name = full;
  if (full.length > MAX_NAME_CHARS) {
    let hash = 2166136261;
    for (const char of full) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    name = `${full.slice(0, MAX_NAME_CHARS - 8)}-${hash.toString(36).padStart(7, "0").slice(-7)}`;
  }
  return { name, fullName, password: `r2-${run}-${role}-pw` };
}

export async function desktopShown(page, timeout = 20_000) {
  await finder(page).waitFor({ timeout });
  return finder(page).isVisible();
}

/** Opens the login window at `base` and creates `who`'s account through Create Account…, with real typing. */
export async function createAccount(page, base, who) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await userTile(page, "Create Account…").click({ timeout: 20_000 });
  const form = page.getByRole("form", { name: "Create Account" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Full Name:").fill(who.fullName);
  await form.getByLabel("Account Name:").fill(who.name);
  await form.getByLabel("Password:").fill(who.password);
  await form.getByLabel("Verify:").fill(who.password);
  await form.getByRole("button", { name: "Create Account" }).click();
  return desktopShown(page);
}

/** Signs `who` in through Other… on the login window (a browser that has not used the account yet). */
export async function signInOther(page, base, who) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await userTile(page, "Other…").click({ timeout: 20_000 });
  const form = page.getByRole("form", { name: "Log In" });
  await form.getByLabel("Account Name:").fill(who.name);
  await form.getByLabel("Password:").fill(who.password);
  await form.getByRole("button", { name: "Log In" }).click();
  return desktopShown(page);
}

/** `fetch` from inside the page with the browser's own cookie (reads and asserts; never the action under test). */
export function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, json: await response.json().catch(() => null) };
    },
    { method, url, body },
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The menu bar, the Dock and windows.

export const menuTitle = (page, name) =>
  page
    .getByRole("menubar")
    .getByRole("menuitem", { name, exact: true })
    .or(page.getByRole("menubar").getByRole("button", { name, exact: true }))
    .first();

/** The open menu (Base UI marks an open popup with data-open). */
export const openMenu = (page) => page.locator('[role="menu"][data-open]').last();

/** Clicks the menu bar title `title` and then the item `item` of its menu, with the mouse. */
export async function chooseMenu(page, title, item) {
  await menuTitle(page, title).click();
  const menu = openMenu(page);
  await menu.waitFor({ timeout: 5_000 });
  await menu
    .getByRole("menuitem", { name: item, exact: typeof item === "string" })
    .first()
    .click();
}

/** The window frame of the window titled `name` (its region), and its managed frame element. */
export function windowFrame(page, name) {
  const region = page.getByRole("region", { name, exact: true }).first();
  const managed = page.locator(".mac-managed-window").filter({ has: region }).first();
  return { region, managed };
}

/** The managed window's frame from the window manager's own placement: x, y (transform), width, height. */
export function frameOf(managed) {
  return managed.evaluate((element) => {
    const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(element.style.transform);
    const box = element.getBoundingClientRect();
    return {
      x: match ? Number(match[1]) : box.x,
      y: match ? Number(match[2]) : box.y,
      width: box.width,
      height: box.height,
      z: Number(element.style.zIndex || 0),
      state:
        element.querySelector("[data-window-state]")?.getAttribute("data-window-state") ?? null,
      minimized: element.hasAttribute("data-minimized"),
      zoomed: element.hasAttribute("data-zoomed"),
      fullScreen: element.hasAttribute("data-full-screen"),
    };
  });
}

/** Drags with the real mouse from (x, y) by (dx, dy) in `steps` moves. */
export async function drag(page, x, y, dx, dy, steps = 8) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1)
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
  await page.mouse.up();
}

// ---------------------------------------------------------------------------------------------------------------------
// The crawl: every interesting control of an accessibility subtree.

/** The roles a census enumerates (brief, section 5). */
export const CENSUS_ROLES = new Set([
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

const unquote = (text) => text.replace(/\\(.)/g, "$1");

/**
 * Parses Playwright's aria snapshot YAML into `{ role, name, attrs, depth, path }` for every node, keeping the chain of named
 * ancestors (groups, regions, menus, dialogs) as `path`, so a control can be placed in its window and group.
 */
export function parseAria(yaml) {
  const nodes = [];
  const stack = [];
  // Playwright single-quotes a line whose text YAML would misread, as with a name holding ": ".
  const lines = yaml.replace(
    /^(\s*- )'(.*)'(:.*)?$/gm,
    (_, lead, text, rest = "") => `${lead}${text.replaceAll("''", "'")}${rest}`,
  );
  for (const line of lines.split("\n")) {
    const match =
      /^(\s*)- (\w+)(?: ("(?:[^"\\]|\\.)*"|\/(?:[^/\\]|\\.)*\/))?((?: \[[^\]]*\])*)(?::\s*(.*))?$/.exec(
        line,
      );
    if (!match) continue;
    const depth = match[1].length / 2;
    const role = match[2];
    let name = match[3] ?? "";
    if (name.startsWith('"')) name = unquote(name.slice(1, -1));
    else if (name.startsWith("/")) name = name.slice(1, -1);
    const attrs = (match[4] ?? "").trim();
    let value = match[5] ?? "";
    if (value.startsWith('"') && value.endsWith('"')) value = unquote(value.slice(1, -1));
    while (stack.length > 0 && stack.at(-1).depth >= depth) stack.pop();
    const ancestry = stack.filter((n) => n.name).map((n) => `${n.role}:${n.name}`);
    // A node with no name of its own takes its text child as its name (a button whose label is a text node).
    const node = { role, name, attrs, value, depth, path: ancestry };
    nodes.push(node);
    stack.push(node);
  }
  return nodes;
}

/** The census controls under `locator`: the interesting roles, with the disabled and checked state. */
export async function crawl(locator) {
  const yaml = await locator.ariaSnapshot({ timeout: 15_000 });
  return parseAria(yaml)
    .filter((node) => CENSUS_ROLES.has(node.role))
    .map((node) => ({
      role: node.role,
      name: node.name || node.value,
      disabled: /\[disabled\]/.test(node.attrs),
      checked: /\[checked(=true)?\]/.test(node.attrs)
        ? true
        : /\[checked=mixed\]/.test(node.attrs)
          ? "mixed"
          : false,
      selected: /\[selected\]/.test(node.attrs),
      expanded: /\[expanded\]/.test(node.attrs),
      path: node.path.join(" > "),
    }));
}

/** A census id slug: lower case, words joined by hyphens. */
export const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[…]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "unnamed";

// ---------------------------------------------------------------------------------------------------------------------
// Windows of the desktop, by the window manager's ids.

export const dockButton = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });
export const managedOf = (page, id) => page.locator(`.mac-managed-window[data-window-id="${id}"]`);

/** Clicks the Dock item `name` and waits for the window `id`. */
export async function openFromDock(page, name, id) {
  await dockButton(page, name).click();
  await managedOf(page, id).waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(300);
  return managedOf(page, id);
}

/** A point in the window's title bar that is on screen and not a control, a resize edge or outside the frame (read only). */
export async function titleBarPoint(managed) {
  const point = await managed.evaluate((root) => {
    const control =
      "button, a, input, select, textarea, [role='tab'], [role='button'], [role='combobox'], [role='searchbox']";
    const bar = root.querySelector(".mac-title-bar") ?? root.querySelector("[class*='title-bar']");
    if (!bar) return null;
    const b = bar.getBoundingClientRect();
    for (const fy of [0.5, 0.3, 0.7])
      for (let fx = 0.02; fx < 0.99; fx += 0.02) {
        const x = b.x + b.width * fx;
        const y = b.y + Math.min(b.height, 52) * fy;
        if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
        const hit = document.elementFromPoint(x, y);
        if (hit && bar.contains(hit) && !hit.closest(control) && !hit.closest("[data-edge]"))
          return { x, y };
      }
    return null;
  });
  if (!point) throw new Error("no free, on-screen point in the window's title bar");
  return point;
}

/** Moves the window by its title bar, with the real mouse, so its frame's top-left corner is at (x, y). */
export async function moveTo(page, managed, x, y) {
  const at = await titleBarPoint(managed);
  const before = await frameOf(managed);
  await drag(page, at.x, at.y, x - before.x, y - before.y);
  await page.waitForTimeout(150);
  return frameOf(managed);
}

/**
 * A point of the window that a press reaches (the topmost element there is the window's own, not a window covering it) and
 * that is not a control, preferring its top strip (title bar), then its body (read only).
 */
export async function ownPoint(managed) {
  const point = await managed.evaluate((root) => {
    const control =
      "button, a, input, select, textarea, [role='tab'], [role='button'], [role='combobox'], [role='searchbox'], [role='option'], [role='row'], [role='gridcell'], [role='treeitem'], [role='checkbox'], [role='radio'], [role='slider']";
    const b = root.getBoundingClientRect();
    const ys = [
      6,
      12,
      18,
      ...Array.from({ length: 12 }, (_, i) => 30 + i * Math.max(10, (b.height - 40) / 12)),
    ];
    for (const dy of ys)
      for (let fx = 0.5; fx < 0.98; fx += 0.04) {
        for (const x of [b.x + b.width * fx, b.x + b.width * (1 - fx)]) {
          const y = b.y + dy;
          if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit && root.contains(hit) && !hit.closest(control) && !hit.closest("[data-edge]"))
            return { x, y };
        }
      }
    return null;
  });
  if (!point) throw new Error("no point of the window a press reaches");
  return point;
}

/** Clicks the window at a point of its own with the real mouse: it comes to the front and becomes key. */
export async function clickOwn(page, managed) {
  const at = await ownPoint(managed);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(200);
}

/** Closes every window of the desktop with its close button (a minimized one is brought back from the Dock first). */
export async function closeAll(page) {
  for (let i = 0; i < 16; i += 1) {
    const frames = page.locator(".mac-managed-window:not([data-minimized])");
    if ((await frames.count()) === 0) {
      const hidden = page.locator(".mac-managed-window[data-minimized]");
      if ((await hidden.count()) === 0) return;
      // Window > Show All of the front application is not reachable with no window shown: use the Dock's tiles.
      const tiles = page.getByRole("toolbar", { name: "Dock" }).getByRole("button");
      await tiles
        .nth((await tiles.count()) - 3)
        .click()
        .catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    await frames
      .last()
      .getByRole("button", { name: "Close" })
      .first()
      .click({ timeout: 3_000 })
      .catch(() => {});
    await page.waitForTimeout(250);
  }
}

/**
 * Opens the menu bar menu `title` with one click of the mouse and answers the open menu. No second click: a title that
 * needs two clicks is a defect of the menu bar (R2 bundle 02), and the wait fails the step.
 */
export async function menuOpen(page, title) {
  await closeMenus(page);
  await menuTitle(page, title).click();
  const menu = openMenu(page);
  await menu.waitFor({ timeout: 5_000 });
  return menu;
}

export async function closeMenus(page) {
  for (let i = 0; i < 4; i += 1) {
    if ((await page.locator('[role="menu"][data-open]').count()) === 0) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

/** The item `name` of an open menu (plain, checkbox or radio item). */
export const menuItem = (menu, name) =>
  menu
    .getByRole("menuitem", { name, exact: typeof name === "string" })
    .or(menu.getByRole("menuitemcheckbox", { name, exact: typeof name === "string" }))
    .or(menu.getByRole("menuitemradio", { name, exact: typeof name === "string" }))
    .first();

/** Whether the open menu shows `name` dimmed. */
export async function dimmedIn(menu, name) {
  const item = menuItem(menu, name);
  if ((await item.count()) === 0) return false;
  return (
    (await item.getAttribute("aria-disabled")) === "true" ||
    (await item.isDisabled().catch(() => false))
  );
}

/** The System Preferences window shows the pane `pane` (its catalogue id). */
export async function preferencesShow(page, pane, timeout = 8_000) {
  const shown = page.locator(
    `.mac-managed-window[data-window-id="system-preferences"] .mac-system-preferences-pane[data-pane="${pane}"]`,
  );
  return shown.waitFor({ state: "visible", timeout }).then(
    () => true,
    () => false,
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The shell's application menus: the rows every application's census shares (`desktop-menus.tsx`), and their checks.

/**
 * The census rows of the menus the desktop builds for the application `app` (its id) named `name`, from its menu titles
 * (`menus`, as its app.ts gives them: the first is the application menu). `opts`: `preferences` (the app has a
 * Preferences window), `resizable`, `own` (titles whose items the window registers itself: the desktop then shows none of
 * its own rows there), `suite` (the census journey's file name).
 */
export function appMenuRows(app, name, menus, opts = {}) {
  const {
    preferences = false,
    resizable = true,
    own = [],
    suite = `${app}-census-journey.mjs`,
  } = opts;
  const rows = [];
  const add = (title, item, role, expected, extra = {}) =>
    rows.push({
      id: `${app}.menu.${slug(title === name ? "app" : title)}.${slug(item)}`,
      app,
      window_or_state: `menu:${title}`,
      role,
      name: item,
      how_reached: `${title} menu in the menu bar, with ${name} in front`,
      expected_outcome: expected,
      verified_by: `${suite} app menus`,
      persists: "none",
      notes: "",
      ...extra,
    });
  add(
    name,
    `About ${name}`,
    "menuitem",
    `an About window names ${name} and its version; its close button closes it`,
  );
  if (preferences) add(name, "Preferences…", "menuitem", `${name}'s Preferences window opens`);
  else {
    add(name, "Preferences…", "menuitem", `unavailable:${name} has no preferences`, {
      dimmed: `${name} has no preferences`,
    });
    add(
      name,
      `${name} has no preferences`,
      "menuitem",
      `unavailable:the statement itself, dimmed under Preferences…`,
      { statement: true },
    );
  }
  add(name, "Services", "menuitem", "its submenu shows the dimmed statement No Services Apply");
  add(
    name,
    "No Services Apply",
    "menuitem",
    "unavailable:No Services Apply (the statement itself)",
    { window_or_state: `menu:${name} > Services`, statement: true },
  );
  add(name, `Hide ${name}`, "menuitem", `${name}'s windows go to the Dock`);
  add(
    name,
    "Hide Others",
    "menuitem",
    "other applications' shown windows go to the Dock (dimmed while there are none)",
  );
  add(name, "Show All", "menuitem", "hidden windows come back (dimmed while none is hidden)");
  add(name, `Quit ${name}`, "menuitem", `every window of ${name} closes`);
  if (menus.includes("File") && !own.includes("File"))
    add("File", "Close Window", "menuitem", "the key window closes");
  if (menus.includes("Edit") && !own.includes("Edit")) {
    add(
      "Edit",
      `${name} adds no Edit commands`,
      "menuitem",
      "unavailable:the statement itself, dimmed above the Edit rows",
      { statement: true },
    );
    for (const item of ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"])
      add("Edit", item, "menuitem", `unavailable:${name} adds no Edit commands`, {
        dimmed: `${name} adds no Edit commands`,
      });
  }
  if (menus.includes("View")) {
    if (resizable)
      add(
        "View",
        "Enter Full Screen",
        "menuitem",
        "the key window fills the screen; its green button (Exit Full Screen) brings it back",
      );
    else {
      add("View", "Enter Full Screen", "menuitem", "unavailable:This window has a fixed size", {
        dimmed: "This window has a fixed size",
      });
      add("View", "This window has a fixed size", "menuitem", "unavailable:the statement itself", {
        statement: true,
      });
    }
  }
  if (menus.includes("Go") && !own.includes("Go")) {
    for (const item of ["Back", "Forward"])
      add("Go", item, "menuitem", `unavailable:${name} has no Back or Forward`, {
        dimmed: `${name} has no Back or Forward`,
      });
    add("Go", `${name} has no Back or Forward`, "menuitem", "unavailable:the statement itself", {
      statement: true,
    });
  }
  if (menus.includes("Go")) {
    add("Go", "Applications", "menuitem", "its submenu lists every application of the desktop");
    add(
      "Go",
      "/(Safari|Mail|FaceTime|Messages|Maps|Photos|Contacts|Calendar|Reminders|Notes|Music|Podcasts|TV|News|App Store|System Preferences|About This Mac|Activity Monitor|Calculator|Chess|Console|Font Book|Force Quit Applications|Help Viewer|Keychain Access|Stickies|Storage Management|System Information|TextEdit|Finder|Preview|Photo Booth|QuickTime Player|Voice Memos|Books|Stocks|Home|Find My|Dictionary|Automator|Script Editor|Disk Utility|Network Utility|AirPort Utility|Boot Camp Assistant)/",
      "menuitem",
      "choosing an application opens it (first, middle and last checked)",
      {
        window_or_state: "menu:Go > Applications",
        notes: "kind: an application of Go > Applications",
      },
    );
  }
  if (menus.includes("Window")) {
    add("Window", "Minimize", "menuitem", "the key window goes to the Dock");
    if (resizable)
      add("Window", "Zoom", "menuitem", "the key window zooms, and back on the next Zoom");
    else {
      add("Window", "Zoom", "menuitem", "unavailable:This window has a fixed size", {
        dimmed: "This window has a fixed size",
      });
      add(
        "Window",
        "This window has a fixed size",
        "menuitem",
        "unavailable:the statement itself",
        { statement: true, id: `${app}.menu.window.this-window-has-a-fixed-size` },
      );
    }
    add(
      "Window",
      "Bring All to Front",
      "menuitem",
      `enabled while ${name} has a shown window; choosing it leaves ${name}'s key window frontmost and key (the effect on an app's several windows is verified in desktop-census-journey.mjs with Calculator's two)`,
    );
    add(
      "Window",
      `/.+ — ${name}|${name}.*/`,
      "menuitemcheckbox",
      "each of the app's windows is listed, the key one checked; choosing one brings it forward",
      {
        notes: `kind: a window of ${name} in the Window menu`,
        id: `${app}.menu.window.window-list`,
      },
    );
  }
  if (menus.includes("Help") && !own.includes("Help"))
    add("Help", `${name} Help`, "menuitem", "Help Viewer opens on a search for the application");
  for (const title of menus.slice(1)) {
    if (!["File", "Edit", "View", "Go", "Window", "Help"].includes(title) && !own.includes(title))
      add(
        title,
        `This demo has no ${title} commands`,
        "menuitem",
        "unavailable:the statement itself",
        { statement: true },
      );
  }
  return rows;
}

/**
 * Verifies the rows `appMenuRows` gave, with the real mouse, for the application whose window `managed` (id `windowId`) is
 * key. Opens Calculator as the other application for Hide Others and Show All, and quits the app last (it is reopened
 * from the Dock with `reopen`). Every row is checked or recorded unavailable with its reason seen in the menu.
 */
export async function verifyAppMenus(page, kit, rows, { app, name, windowId, reopen }) {
  const { check, skip } = kit;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const has = (id) => byId.has(id);
  const managed = () => managedOf(page, windowId);
  const key = async () => {
    await clickOwn(page, managed()).catch(() => {});
  };
  // Rows that are statements or dimmed with a reason: seen in the open menu, the reason in the same menu.
  const titles = [
    ...new Set(rows.map((row) => row.window_or_state.replace(/^menu:/, "").split(" > ")[0])),
  ];
  for (const title of titles) {
    const statements = rows.filter(
      (row) => row.window_or_state === `menu:${title}` && (row.statement || row.dimmed),
    );
    if (statements.length === 0) continue;
    await key();
    const menu = await menuOpen(page, title === name ? name : title);
    for (const row of statements) {
      const dimmed = await dimmedIn(menu, row.name);
      const reason = row.dimmed ? await dimmedIn(menu, row.dimmed) : true;
      skip(
        row.id,
        row.expected_outcome.replace(
          /^unavailable:the statement itself.*/,
          `unavailable:${row.name}`,
        ),
        dimmed && reason,
      );
    }
    await closeMenus(page);
  }
  const services = `${app}.menu.app.services`;
  if (has(services)) {
    await key();
    const menu = await menuOpen(page, name);
    await menuItem(menu, "Services").hover();
    await page.waitForTimeout(500);
    const sub = page.locator('[role="menu"][data-open]').last();
    const none = await dimmedIn(sub, "No Services Apply");
    check(services, none);
    skip(`${app}.menu.app.no-services-apply`, "unavailable:No Services Apply", none);
    await closeMenus(page);
  }
  const help = `${app}.menu.help.${slug(`${name} Help`)}`;
  if (has(help)) {
    await key();
    await menuItem(await menuOpen(page, "Help"), `${name} Help`).click();
    const viewer = managedOf(page, "help-viewer");
    const shown = await viewer.waitFor({ timeout: 8_000 }).then(
      () => true,
      () => false,
    );
    check(help, shown, shown ? "Help Viewer opened" : "no Help Viewer");
    if (shown) await viewer.getByRole("button", { name: "Close" }).first().click();
  }
  // About.
  {
    await key();
    const menu = await menuOpen(page, name);
    if (await dimmedIn(menu, `About ${name}`)) {
      await closeMenus(page);
      check(`${app}.menu.app.about-${slug(name)}`, false, "dimmed");
    } else {
      await menuItem(menu, `About ${name}`).click();
      const about = page
        .locator(".mac-desktop-shell-about, .mac-desktop-shell-about-finder")
        .last();
      const shown = await about.waitFor({ timeout: 4_000 }).then(
        () => true,
        () => false,
      );
      const text = shown ? await about.innerText() : "";
      if (shown) await about.getByRole("button", { name: "Close" }).first().click();
      const gone = shown && (await about.count()) === 0;
      check(
        `${app}.menu.app.about-${slug(name)}`,
        shown && text.includes(name) && text.includes("Version") && gone,
        shown ? text.replace(/\s+/g, " ").slice(0, 60) : "no About window",
      );
    }
  }
  // Preferences (an app with a Preferences window).
  if (has(`${app}.menu.app.preferences`) && !byId.get(`${app}.menu.app.preferences`).dimmed) {
    await key();
    const menu = await menuOpen(page, name);
    const before = await page.locator(".mac-managed-window").count();
    await menuItem(menu, "Preferences…").click();
    await page.waitForTimeout(800);
    check(
      `${app}.menu.app.preferences`,
      (await page.locator(".mac-managed-window").count()) > before,
    );
  }
  // View > Enter Full Screen (resizable); out again by the green button, the menu bar being covered meanwhile.
  if (
    has(`${app}.menu.view.enter-full-screen`) &&
    !byId.get(`${app}.menu.view.enter-full-screen`).dimmed
  ) {
    await key();
    const menu = await menuOpen(page, "View");
    await menuItem(menu, "Enter Full Screen").click();
    await page.waitForTimeout(500);
    const full = await frameOf(managed());
    await managed().getByRole("button", { name: "Exit Full Screen" }).click();
    await page.waitForTimeout(500);
    const back = await frameOf(managed());
    check(`${app}.menu.view.enter-full-screen`, full.fullScreen && !back.fullScreen);
  }
  // Window > Zoom (resizable), twice.
  if (has(`${app}.menu.window.zoom`) && !byId.get(`${app}.menu.window.zoom`).dimmed) {
    await key();
    await menuItem(await menuOpen(page, "Window"), "Zoom").click();
    await page.waitForTimeout(300);
    const zoomed = (await frameOf(managed())).zoomed;
    await key();
    await menuItem(await menuOpen(page, "Window"), "Zoom").click();
    await page.waitForTimeout(300);
    check(`${app}.menu.window.zoom`, zoomed && !(await frameOf(managed())).zoomed);
  }
  // The window list: the key window checked; choosing it keeps it key.
  if (has(`${app}.menu.window.window-list`)) {
    await key();
    const menu = await menuOpen(page, "Window");
    const entries = menu.getByRole("menuitemcheckbox");
    const count = await entries.count();
    const checked = count > 0 ? await entries.first().getAttribute("aria-checked") : null;
    if (count > 0) await entries.first().click();
    await page.waitForTimeout(300);
    check(
      `${app}.menu.window.window-list`,
      count > 0 && checked === "true" && (await frameOf(managed())).state === "key",
      `${count} listed`,
    );
  }
  // Window > Minimize, and Hide <name>: the app's window goes to the Dock. No window of the app is then shown, so the menu
  // bar names the next application: the window comes back from the Dock (the app's icon, or the minimized window's tile).
  const restore = async () => {
    await dockButton(page, name)
      .click()
      .catch(() => {});
    await page.waitForTimeout(500);
    if ((await frameOf(managed())).minimized) {
      const tiles = page.getByRole("toolbar", { name: "Dock" }).getByRole("button");
      const names = await tiles.evaluateAll((list) =>
        list.map((b) => b.getAttribute("aria-label") || b.textContent.trim()),
      );
      const at = names.findLastIndex((n) => n !== name && n.includes(name));
      if (at >= 0) await tiles.nth(at).click();
      await page.waitForTimeout(500);
    }
    return !(await frameOf(managed())).minimized;
  };
  {
    await key();
    await menuItem(await menuOpen(page, "Window"), "Minimize").click();
    await page.waitForTimeout(500);
    const mini = (await frameOf(managed())).minimized;
    const back = await restore();
    check(`${app}.menu.window.minimize`, mini && back, `minimized=${mini}, back=${back}`);
  }
  {
    await key();
    await menuItem(await menuOpen(page, name), `Hide ${name}`).click();
    await page.waitForTimeout(500);
    const hidden = (await frameOf(managed())).minimized;
    const back = await restore();
    check(`${app}.menu.app.hide-${slug(name)}`, hidden && back, `hidden=${hidden}, back=${back}`);
  }
  // Hide Others: Calculator is the other application; dimmed with no other window shown.
  {
    await key();
    let menu = await menuOpen(page, name);
    const dimmedAlone =
      (await page.locator(".mac-managed-window:not([data-minimized])").count()) === 1
        ? await dimmedIn(menu, "Hide Others")
        : true;
    await closeMenus(page);
    await openFromDock(page, "Calculator", "calculator");
    await key();
    menu = await menuOpen(page, name);
    await menuItem(menu, "Hide Others").click();
    await page.waitForTimeout(600);
    const other = await frameOf(managedOf(page, "calculator"));
    check(
      `${app}.menu.app.hide-others`,
      dimmedAlone && other.minimized && !(await frameOf(managed())).minimized,
      `dimmed alone=${dimmedAlone}, calculator minimized=${other.minimized}`,
    );
    // Show All, with this app in front and Calculator's windows hidden: they come back.
    menu = await menuOpen(page, name);
    const showAllEnabled = !(await dimmedIn(menu, "Show All"));
    await menuItem(menu, "Show All")
      .click()
      .catch(() => {});
    await page.waitForTimeout(500);
    const calcBack = !(await frameOf(managedOf(page, "calculator"))).minimized;
    check(
      `${app}.menu.app.show-all`,
      showAllEnabled && calcBack,
      `enabled=${showAllEnabled}, calculator back=${calcBack}`,
    );
    // Bring All to Front with this app's one window: enabled, and its window stays frontmost and key. (With one window
    // the command has nothing behind to bring forward: its effect on an app's several windows, with another app's window
    // between them, is verified in desktop-census-journey.mjs with Calculator's window and its Paper Tape.)
    await clickOwn(page, managed()).catch(() => {});
    menu = await menuOpen(page, "Window");
    const bringEnabled = !(await dimmedIn(menu, "Bring All to Front"));
    await menuItem(menu, "Bring All to Front")
      .click()
      .catch(() => {});
    await page.waitForTimeout(300);
    const mine = await frameOf(managed());
    const calc = await frameOf(managedOf(page, "calculator"));
    check(
      `${app}.menu.window.bring-all-to-front`,
      bringEnabled && mine.z > calc.z && mine.state === "key",
      `enabled=${bringEnabled}, z ${mine.z}/${calc.z}, ${mine.state}`,
    );
    for (const id of ["calculator:tape", "calculator"]) {
      const frame = managedOf(page, id);
      if ((await frame.count()) > 0)
        await frame
          .getByRole("button", { name: "Close" })
          .first()
          .click()
          .catch(() => {});
    }
  }
  // File > Close Window, then Quit <name> after reopening.
  if (has(`${app}.menu.file.close-window`)) {
    await key();
    await menuItem(await menuOpen(page, "File"), "Close Window").click();
    await page.waitForTimeout(500);
    check(`${app}.menu.file.close-window`, (await managed().count()) === 0);
    await reopen();
  }
  // Go > Applications: first, middle and last open their apps.
  if (has(`${app}.menu.go.applications`)) {
    await key();
    let menu = await menuOpen(page, "Go");
    await menuItem(menu, "Applications").hover();
    await page.waitForTimeout(500);
    let sub = page.locator('[role="menu"][data-open]').last();
    const names = await sub.getByRole("menuitem").allTextContents();
    check(`${app}.menu.go.applications`, names.length > 20, `${names.length} applications`);
    const picks = [names[0], names[Math.floor(names.length / 2)], names.at(-1)].map((n) =>
      n.trim(),
    );
    let opened = 0;
    for (const pick of picks) {
      await key();
      menu = await menuOpen(page, "Go");
      await menuItem(menu, "Applications").hover();
      await page.waitForTimeout(500);
      sub = page.locator('[role="menu"][data-open]').last();
      const before = await page.locator(".mac-managed-window").count();
      await menuItem(sub, pick).click();
      await page.waitForTimeout(1200);
      if ((await page.locator(".mac-managed-window").count()) > before) opened += 1;
      const keyFrame = page
        .locator(".mac-managed-window")
        .filter({ has: page.locator('[data-window-state="key"]') })
        .last();
      if ((await keyFrame.getAttribute("data-window-id")) !== windowId)
        await keyFrame
          .getByRole("button", { name: "Close" })
          .first()
          .click()
          .catch(() => {});
      await page.waitForTimeout(300);
    }
    const kind = rows.find((row) => row.window_or_state === "menu:Go > Applications");
    check(kind.id, opened === 3, `${opened}/3 of ${picks.join(", ")} opened`);
  }
  await key();
  await menuItem(await menuOpen(page, name), `Quit ${name}`).click();
  await page.waitForTimeout(600);
  check(
    `${app}.menu.app.quit-${slug(name)}`,
    (await page.locator(`.mac-managed-window[data-window-id^="${windowId}"]`).count()) === 0,
  );
  await reopen();
}
