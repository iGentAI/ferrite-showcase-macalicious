// R5 census kit (round 3: Safari, URLs and internet apps). Shared by the R5 census suites
// (`<app>-census-journey.mjs`) and the crawler (`r5-crawl.mjs`):
//
// - options: `--url` (default http://127.0.0.1:8080), `--out`, `--browser chromium|chrome|firefox|webkit`
//   (`chrome` is Google Chrome stable through Playwright's `chrome` channel), `--phase all|write|restart-check`,
//   `--headed`, `--seed`, `--minutes` (the exploratory pass), `--only <id prefix,...>`;
// - a census log: `row(id, ok, detail)` prints one `ok`/`FAIL` line per census id, `check(id, fn)` runs a step
//   and turns a throw into that id's FAIL, `unavailable(id, locator, reason)` passes only when the control is
//   dimmed or refused with the reason on screen;
// - a strict first-party watch: a console error, page error or unhandled rejection of the desktop page, a
//   failed request or an HTTP error of its own origin fails the run (`allow(pattern)` admits a refusal a step
//   provokes on purpose); other origins' resources are noted, never counted;
// - real accounts made at the login window's Create Account form, and signing in again through Other...;
// - opening an app from the Dock, or with Spotlight when it is not docked; getting one from the App Store with
//   its own Get and Install buttons;
// - the accessibility crawl (`ariaSnapshot`, the same in every engine) of a window and of each menu of the
//   menu bar, with submenus;
// - the seeded exploratory pass of random real input (mouse, keyboard, wheel) in one window.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_NAMES, ENGINES } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export { ENGINE_NAMES };

/** The command line. */
export function options() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
  };
  const browserName = option("--browser", "chromium");
  if (!ENGINE_NAMES.includes(browserName)) {
    console.error(`--browser must be one of ${ENGINE_NAMES.join(", ")}`);
    process.exit(2);
  }
  const phase = option("--phase", "all");
  if (!["all", "write", "restart-check"].includes(phase)) {
    console.error("--phase must be all, write or restart-check");
    process.exit(2);
  }
  const out = path.resolve(option("--out", path.join(here, "output", "r5")));
  mkdirSync(out, { recursive: true });
  return {
    base: option("--url", "http://127.0.0.1:8080").replace(/\/$/, ""),
    out,
    browserName,
    phase,
    headed: args.includes("--headed"),
    seed: Number(option("--seed", "5")),
    minutes: Number(option("--minutes", "3")),
    only: option("--only", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/** Launch the engine `name` names (journey-kit's ENGINES; `chrome` is Google Chrome stable, Playwright's `chrome` channel). */
export async function launchBrowser(name, { headed = false, ...extra } = {}) {
  return ENGINES[name].launch({ headless: !headed, ...extra });
}

const short = (error) => {
  const message = String(error instanceof Error ? error.message : error);
  const waited = message.match(/waiting for (.+)/)?.[1] ?? "";
  // The last line of Playwright's call log that says why an action could not happen.
  const why =
    [
      ...message.matchAll(
        /^\s*-\s*(.*(intercepts pointer events|not stable|not visible|not enabled|detached|outside of the viewport).*)$/gm,
      ),
    ].at(-1)?.[1] ?? "";
  return `${message.split("\n")[0]}${waited ? ` [${waited.slice(0, 160)}]` : ""}${why ? ` {${why.slice(0, 200)}}` : ""}`.slice(
    0,
    600,
  );
};

// A wait a step left behind when it failed early (a response it never reached) must not end the whole run: such a
// Playwright wait timing out is noted. Any other unhandled rejection is a harness failure and fails the run.
const strayRejections = [];
process.on("unhandledRejection", (reason) => {
  const text = short(reason);
  const abandonedWait =
    (reason?.name === "TimeoutError" || /Timeout \d+ms exceeded/.test(text)) &&
    /waitFor(Response|Request|Event)|waiting for event/.test(String(reason?.message ?? reason));
  if (abandonedWait) console.log(`note (not counted) a wait left by a failed step: ${text}`);
  else strayRejections.push(text);
});

/** A run id that is short, lowercase and unique enough for account names. */
export const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
  .toString(36)
  .padStart(2, "0")}`;

/**
 * The census log of one app in one engine. `row` prints `ok   <id>` or `FAIL <id> (detail)`; `finish`
 * adds `<app>.run.first-party-clean` (no first-party console error, page error, unhandled rejection, failed
 * request or HTTP error), writes `<out>/<app>-<engine>-<phase>.json` and exits 0 only when every row passed.
 */
export function census(app, opts) {
  const { base, out, browserName, phase, only } = opts;
  const origin = new URL(base).origin;
  const results = [];
  const problems = [];
  const notes = [];
  const allowed = [];
  const crawled = [];
  const wanted = (id) => only.length === 0 || only.some((prefix) => id.startsWith(prefix));
  /** `meta`: { state, role, name, how, expect, persists } — the census row this id is. */
  const row = (id, ok, detail = "", meta = {}) => {
    results.push({ id, ok: Boolean(ok), detail: String(detail ?? ""), meta });
    console.log(
      `${ok ? "ok  " : "FAIL"} ${id}${detail ? ` (${String(detail).slice(0, 400)})` : ""}`,
    );
    return Boolean(ok);
  };
  /** Run one step; its answer is `true`/`false` or `{ ok, detail }`; a throw is that id's FAIL. */
  const check = async (id, fn, meta = {}) => {
    if (!wanted(id)) return true;
    try {
      const answer = await fn();
      if (answer && typeof answer === "object") return row(id, answer.ok, answer.detail, meta);
      return row(id, answer, "", meta);
    } catch (error) {
      return row(id, false, short(error), meta);
    }
  };
  /**
   * A row the environment cannot exercise: on Apple platforms `onApple` runs as an ordinary check; elsewhere the
   * row is recorded as `n/a:<reason>` and printed `n/a  <id>`, never as a pass.
   */
  const na = async (id, reason, meta = {}, onApple = null) => {
    if (!wanted(id)) return true;
    if (process.platform === "darwin" && onApple) return check(id, onApple, meta);
    results.push({
      id,
      ok: true,
      na: reason,
      detail: `n/a: ${reason}`,
      meta: { ...meta, na: reason },
    });
    console.log(`n/a  ${id} (${reason})`);
    return true;
  };
  /** Record the controls of one state in this engine (the suite's own crawl). */
  const crawl = async (state, locator) => {
    try {
      for (const control of await crawlScope(locator)) crawled.push({ state, ...control });
    } catch (error) {
      crawled.push({ state, role: "error", name: short(error), disabled: false, flags: "" });
    }
  };
  /**
   * `unavailable:` passes only when the control is visibly dimmed (disabled or aria-disabled) or refused,
   * with its reason on screen: in its title (tooltip), its accessible description, or `reasonLocator`.
   */
  const unavailable = async (id, control, reason, reasonLocator = null, meta = {}) =>
    check(
      id,
      async () => {
        await control.first().waitFor({ timeout: 10_000 });
        const state = await control.first().evaluate((element) => ({
          disabled:
            element.matches(":disabled") ||
            element.getAttribute("aria-disabled") === "true" ||
            Boolean(element.closest('[aria-disabled="true"]')),
          title: element.getAttribute("title") ?? "",
          described: (element.getAttribute("aria-describedby") ?? "")
            .split(/\s+/)
            .map((ref) => document.getElementById(ref)?.textContent ?? "")
            .join(" "),
          text: element.textContent ?? "",
        }));
        const shown = reasonLocator
          ? ((await reasonLocator
              .first()
              .textContent({ timeout: 5_000 })
              .catch(() => "")) ?? "")
          : "";
        const all = `${state.title} ${state.described} ${state.text} ${shown}`;
        const ok = state.disabled && reason.test(all);
        return {
          ok,
          detail: `disabled ${state.disabled}; ${all.replace(/\s+/g, " ").trim().slice(0, 200)}`,
        };
      },
      { ...meta, unavailable: true },
    );
  const allow = (pattern) => allowed.push(pattern);
  const admitted = (text) => allowed.some((pattern) => pattern.test(text));
  const own = (url) => {
    try {
      return !url || new URL(url).origin === origin || url.startsWith("data:");
    } catch {
      return true;
    }
  };
  /** Watch a page: first-party problems count, other origins' are noted. */
  const watch = (page, label = "page") => {
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const where = message.location()?.url ?? "";
      const text = `${label} console: ${message.text()}`;
      if (own(where) && !admitted(text)) problems.push(text);
      else notes.push(text);
    });
    page.on("pageerror", (error) => {
      const text = `${label} page error: ${short(error)}`;
      if (!admitted(text)) problems.push(text);
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "";
      const url = request.url();
      const text = `${label} request failed: ${url} ${failure}`;
      // Streams and loads the page itself cancels (a reload, a closed live stream, Stop).
      if (/ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(failure)) return;
      if (own(url) && request.frame() === page.mainFrame() && !admitted(text)) problems.push(text);
      else notes.push(text);
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      const text = `${label} HTTP ${response.status()}: ${response.request().method()} ${response.url()}`;
      if (own(response.url()) && response.request().frame() === page.mainFrame() && !admitted(text))
        problems.push(text);
      else notes.push(text);
    });
  };
  const finish = () => {
    if (strayRejections.length > 0)
      row(
        `${app}.run.harness-clean`,
        false,
        `unhandled rejection: ${strayRejections.slice(0, 3).join(" | ")}`,
      );
    if (phase !== "restart-check" || problems.length > 0)
      row(`${app}.run.first-party-clean`, problems.length === 0, problems.slice(0, 5).join(" | "));
    const file = path.join(out, `${app}-${browserName}-${phase}.json`);
    writeFileSync(
      file,
      `${JSON.stringify({ app, engine: browserName, phase, results, problems, notes }, null, 1)}\n`,
    );
    if (crawled.length > 0)
      writeFileSync(
        path.join(out, `crawl-${app}-${browserName}-${phase}.tsv`),
        `state\trole\tname\tdisabled\tflags\n${crawled
          .map((x) => [x.state, x.role, x.name, x.disabled ? "disabled" : "", x.flags].join("\t"))
          .join("\n")}\n`,
      );
    const failed = results.filter((r) => !r.ok);
    const skipped = results.filter((r) => r.na);
    for (const note of notes.slice(0, 20)) console.log(`note (not counted) ${note.slice(0, 300)}`);
    console.log(
      `\n${app} ${phase} in ${browserName}: ${results.length - failed.length - skipped.length}/${results.length - skipped.length} rows ok, ${skipped.length} n/a${failed.length ? `; FAIL: ${failed.map((r) => r.id).join(", ")}` : ""}`,
    );
    process.exitCode = failed.length === 0 ? 0 : 1;
  };
  return {
    row,
    check,
    na,
    unavailable,
    allow,
    watch,
    finish,
    crawl,
    results,
    problems,
    notes,
    wanted,
    crawled,
  };
}

/** The state a write phase leaves for its restart-check phase. */
export function saveState(out, app, browserName, state) {
  writeFileSync(
    path.join(out, `${app}-${browserName}-state.json`),
    `${JSON.stringify(state, null, 1)}\n`,
  );
}
export function loadState(out, app, browserName) {
  return JSON.parse(readFileSync(path.join(out, `${app}-${browserName}-state.json`), "utf8"));
}

/** A new person: an account of their own made at the login window, in a context of their own. */
export function accountFor(app, label) {
  const name = `r5${app.replace(/[^a-z]/g, "").slice(0, 6)}${label}${RUN}`.slice(0, 30);
  return { name, fullName: `R5 ${label} ${RUN}`, password: `r5-${RUN}-${label}-tide` };
}

export const finderButton = (page) => page.getByRole("button", { name: /^Finder$/ }).first();
const usersGroup = (page) => page.getByRole("group", { name: "Users" });

/** Make the account at the login window's Create Account form; resolves on its desktop. */
export async function createAccount(page, { name, fullName, password }) {
  const users = usersGroup(page);
  await users.waitFor({ timeout: 30_000 });
  await users.getByRole("button", { name: "Create Account…", exact: true }).click();
  const form = page.getByRole("form", { name: "Create Account" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Full Name:").fill(fullName);
  await form.getByLabel("Account Name:").fill(name);
  await form.getByLabel("Password:").fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByRole("button", { name: "Create Account" }).click();
  await finderButton(page).waitFor({ timeout: 30_000 });
}

/** Sign in to an existing account at the login window, through Other... (a fresh browser lists no one). */
export async function signIn(page, { name, password }) {
  const users = usersGroup(page);
  await users.waitFor({ timeout: 30_000 });
  await users.getByRole("button", { name: "Other…", exact: true }).click();
  const form = page.getByRole("form", { name: "Log In" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Account Name:").fill(name);
  await form.getByLabel("Password:").fill(password);
  await form.getByRole("button", { name: "Log In" }).click();
  await finderButton(page).waitFor({ timeout: 30_000 });
}

/**
 * A person's page in a new context of `browser`, watched by `c`: `account` is made (`create`) or signed in to.
 * `contextOptions` go to the browser context (geolocation, permissions).
 */
export async function person(
  browser,
  c,
  base,
  account,
  { create = true, label = "page", contextOptions = {} } = {},
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...contextOptions,
  });
  await context.addInitScript(() => {
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      console.error(`unhandled rejection: ${reason}`);
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  c.watch(page, label);
  await page.goto(`${base}/`, { waitUntil: "load" });
  if (create) await createAccount(page, account);
  else await signIn(page, account);
  return page;
}

/** Reload the desktop and wait for its Dock. */
export async function reloadDesktop(page) {
  await page.reload({ waitUntil: "load" });
  await finderButton(page).waitFor({ timeout: 30_000 });
}

/** `fetch` from inside the page with its own cookie: reading and asserting only, never acting. */
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
        json = null;
      }
      return { status: response.status, json, text: text.slice(0, 2000) };
    },
    { method, url, body },
  );
}

/** The window of the app `name` names (a region with that name). */
export const appWindow = (page, name) => page.getByRole("region", { name, exact: true }).first();

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The app's Dock tile, if it is docked. */
export const dockTile = (page, name) =>
  page.locator(".mac-dock").getByRole("button", { name: new RegExp(`^${escapeRe(name)}$`) });

/** Wait until a window's box has settled (a restore or minimise animation is over): at least 200x120 and the
 * same on two reads 200 ms apart. */
export async function settleWindow(page, window, timeout = 5_000) {
  const end = Date.now() + timeout;
  let last = null;
  while (Date.now() < end) {
    const b = await window.boundingBox().catch(() => null);
    if (
      b &&
      b.width >= 200 &&
      b.height >= 120 &&
      last &&
      Math.abs(b.x - last.x) < 1 &&
      Math.abs(b.y - last.y) < 1 &&
      Math.abs(b.width - last.width) < 1 &&
      Math.abs(b.height - last.height) < 1
    )
      return b;
    last = b;
    await page.waitForTimeout(200);
  }
  return last;
}

/** Open an app: its Dock tile, or Spotlight when it is not docked. Resolves with its window. */
export async function openApp(page, name, windowName = name) {
  const tile = dockTile(page, name);
  if ((await tile.count()) > 0) await tile.first().click();
  else {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill(name);
    await page.waitForTimeout(400);
    await field.press("Enter");
  }
  const window = appWindow(page, windowName);
  await window.waitFor({ state: "visible", timeout: 20_000 });
  await settleWindow(page, window);
  return window;
}

/** Get an app from the App Store with its own Get and Install buttons; resolves when it can be opened. */
export async function getFromAppStore(page, name) {
  if ((await dockTile(page, name).count()) > 0) return;
  const store = await openApp(page, "App Store");
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 15_000 });
  const open = store.getByRole("button", { name: `Open, ${name}` });
  if ((await open.count()) === 0) {
    await store.getByRole("button", { name: `Get, ${name}` }).click();
    await store.getByRole("button", { name: `Install, ${name}` }).click();
    await open.waitFor({ timeout: 20_000 });
  }
  await dockTile(page, name).first().waitFor({ timeout: 15_000 });
  await closeWindow(page, store);
}

/** Close a window with its close button (real click). */
export async function closeWindow(_page, window) {
  await window.getByRole("button", { name: "Close" }).first().click();
  await window.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
}

/** The menu bar and its open menu. */
export const menuBar = (page) => page.getByRole("menubar").first();
export const openMenu = (page) => page.getByRole("menu").first();

/** Open the menu `title` of the menu bar (real click); resolves with it. */
export async function openMenuTitle(page, title) {
  await menuBar(page).getByRole("menuitem", { name: title, exact: true }).first().click();
  await openMenu(page).waitFor({ timeout: 5_000 });
  return openMenu(page);
}

/** Choose `item` (a name, matched from its start, or a RegExp) in the menu bar's menu `title`. */
export async function chooseMenu(page, title, item) {
  const menu = await openMenuTitle(page, title);
  const name = item instanceof RegExp ? item : new RegExp(`^${escapeRe(item)}`);
  await menu.getByRole("menuitem", { name }).first().click();
}

/** Close the front window of the app `name`, discarding what a confirmation offers to keep; resolves once the
 * window is gone (throws when it stays). */
export async function closeAppWindow(page, name) {
  const window = page.getByRole("region", { name, exact: true }).first();
  if (!(await window.isVisible().catch(() => false))) return;
  await window.getByRole("button", { name: "Close" }).first().click();
  const ask = page.getByRole("alertdialog").first();
  const asked = await ask.waitFor({ state: "visible", timeout: 1_500 }).then(
    () => true,
    () => false,
  );
  if (asked)
    await ask
      .getByRole("button", { name: /Don’t Save|Don't Save|Delete|Discard/ })
      .first()
      .click();
  await window.waitFor({ state: "hidden", timeout: 10_000 });
}

/**
 * Whether a link shared from the Share menu landed in the app `key` names (mail, messages, notes, reminders):
 * Mail opens a New Message named by its subject (the title) with the link in its body; Reminders shows a new
 * reminder named by the title and keeps the address on the server; Messages and Notes show the address.
 * Polls for 10 s. Answers `{ ok, detail, window }` with the name of the window to close.
 */
export async function shareLanded(page, key, { title, url }) {
  let ok = false;
  let detail = "";
  for (let i = 0; i < 40 && !ok; i += 1) {
    await page.waitForTimeout(250);
    if (key === "mail") {
      const compose = page.getByRole("region", { name: title, exact: true });
      ok = (await compose.count()) > 0 && (await compose.first().innerText()).includes(url);
      detail = "a New Message with the title as its subject and the link in its body";
    } else if (key === "reminders") {
      const shown =
        (await appWindow(page, "Reminders").getByText(title, { exact: true }).count()) > 0;
      const server = shown ? (await api(page, "GET", "/api/reminders/data")).text : "";
      ok = shown && server.includes(url);
      detail = `a reminder "${title}" shown; its address on the server ${server.includes(url)}`;
    } else {
      const name = key === "notes" ? "Notes" : "Messages";
      ok = await page.evaluate(
        ({ name, url }) =>
          [...document.querySelectorAll("[aria-label]")]
            .filter((e) => e.getAttribute("aria-label") === name)
            .some(
              (e) =>
                (e.textContent ?? "").includes(url) ||
                [...e.querySelectorAll("input, textarea")].some((f) => f.value.includes(url)),
            ),
        { name, url },
      );
      detail = `${name} shows the address`;
    }
  }
  const window =
    key === "mail" ? title : { messages: "Messages", notes: "Notes", reminders: "Reminders" }[key];
  return { ok, detail: `${detail}: ${ok}`, window };
}

/** Close any open menu with Escape. */
export async function closeMenus(page) {
  for (let i = 0; i < 3 && (await page.getByRole("menu").count()) > 0; i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}

// ── The accessibility crawl ──

/** The roles the census counts (brief section 5). */
export const CONTROL_ROLES = new Set([
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

/** The controls of an `ariaSnapshot` (YAML): role, name and flags, in order. */
export function parseAria(yaml) {
  const found = [];
  for (const line of yaml.split("\n")) {
    const m = line.match(/^\s*- '?(\w+)(?: "((?:[^"\\]|\\.)*)"| (\/(?:[^/\\]|\\.)*\/))?(.*)$/);
    if (!m) continue;
    const [, role, quoted, pattern, rest] = m;
    if (!CONTROL_ROLES.has(role)) continue;
    const name = (quoted ?? pattern ?? "").replace(/\\"/g, '"');
    found.push({
      role,
      name,
      disabled: /\[disabled\]/.test(rest),
      flags: (rest.match(/\[[^\]]+\]/g) ?? []).join(""),
    });
  }
  return found;
}

/** Crawl one locator's subtree. */
export async function crawlScope(locator) {
  const yaml = await locator.ariaSnapshot({ timeout: 15_000 });
  return parseAria(yaml);
}

/**
 * Crawl each menu of the front app in the menu bar (every title after the Apple menu up to Help), with each
 * submenu opened by hovering its item. Answers rows `{ state: "menu:<title>[>submenu]", role, name, ... }`.
 */
export async function crawlMenus(page) {
  const rows = [];
  const titles = (await menuBar(page).getByRole("menuitem").allInnerTexts()).map((t) => t.trim());
  const helpAt = titles.indexOf("Help");
  const appTitles = titles.slice(1, helpAt >= 0 ? helpAt + 1 : titles.length).filter(Boolean);
  for (const title of appTitles) {
    await closeMenus(page);
    let menu;
    try {
      menu = await openMenuTitle(page, title);
    } catch {
      rows.push({
        state: `menu:${title}`,
        role: "menuitem",
        name: title,
        disabled: false,
        flags: "[no menu opened]",
      });
      continue;
    }
    for (const control of await crawlScope(menu)) rows.push({ state: `menu:${title}`, ...control });
    const subs = menu.locator('[role^="menuitem"][aria-haspopup]');
    const count = await subs.count();
    for (let i = 0; i < count; i += 1) {
      const sub = subs.nth(i);
      const subName = ((await sub.innerText().catch(() => "")) || "").split(/[\n\t]/)[0].trim();
      await sub.hover().catch(() => {});
      await page.waitForTimeout(350);
      const menus = page.getByRole("menu");
      if ((await menus.count()) > 1) {
        for (const control of await crawlScope(menus.last()))
          rows.push({ state: `menu:${title}>${subName}`, ...control });
      }
    }
    await closeMenus(page);
  }
  return { titles: appTitles, rows };
}

// ── The seeded exploratory pass ──

/** A small seeded PRNG (mulberry32). */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  "apple",
  "münchen.de",
  "1.5",
  "192.168.0.1:8080",
  "news",
  "AAPL",
  "Paris",
  "hello world",
  "x",
  "",
];
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
  "Home",
  "End",
];

/**
 * Random real input in `windowLocator` for `ms`: clicks at random visible controls of the window (never a
 * control whose name matches `avoid`), text typed into its fields, keys, wheel scrolls. Every action is
 * logged. After each action the page must answer within 5 s; when the window is gone, `reopen()` opens it
 * again. Answers `{ actions, log, stalls }`; the census watch counts page errors and HTTP errors meanwhile.
 */
export async function explore(page, windowLocator, { seed, ms, reopen, avoid = /^$/ }) {
  const random = prng(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const log = [];
  let stalls = 0;
  let actions = 0;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    actions += 1;
    let window = windowLocator();
    if (!(await window.isVisible().catch(() => false))) {
      log.push("reopen");
      window = await reopen();
    }
    const roll = random();
    try {
      if (roll < 0.55) {
        const handles = await window
          .locator(
            'button:not([disabled]), [role="button"], [role="tab"], [role="radio"], [role="option"], [role="treeitem"], [role="checkbox"], [role="switch"], a[href], input, select, [role="link"]',
          )
          .elementHandles();
        const visible = [];
        for (const handle of handles) {
          const box = await handle.boundingBox();
          if (!box || box.width < 2 || box.height < 2) continue;
          const name = await handle.evaluate(
            (element) =>
              element.getAttribute("aria-label") ||
              element.textContent?.trim().slice(0, 60) ||
              element.tagName,
          );
          if (avoid.test(name)) continue;
          visible.push({ box, name });
        }
        if (visible.length > 0) {
          const target = pick(visible);
          const x = target.box.x + target.box.width / 2;
          const y = target.box.y + target.box.height / 2;
          log.push(`click ${JSON.stringify(target.name)} at ${Math.round(x)},${Math.round(y)}`);
          await page.mouse.click(x, y);
        }
      } else if (roll < 0.7) {
        const word = pick(WORDS);
        log.push(`type ${JSON.stringify(word)}`);
        await page.keyboard.type(word, { delay: 10 });
      } else if (roll < 0.9) {
        const key = pick(KEYS);
        log.push(`press ${key}`);
        await page.keyboard.press(key);
      } else {
        const box = await window.boundingBox();
        if (box) {
          const x = box.x + random() * box.width;
          const y = box.y + 40 + random() * Math.max(1, box.height - 40);
          const dy = Math.round((random() - 0.5) * 800);
          log.push(`wheel ${dy} at ${Math.round(x)},${Math.round(y)}`);
          await page.mouse.move(x, y);
          await page.mouse.wheel(0, dy);
        }
      }
    } catch (error) {
      log.push(`  (action not done: ${short(error).slice(0, 120)})`);
    }
    // Extra pages a click opened (a real browser tab) are closed again.
    for (const other of page.context().pages())
      if (other !== page) await other.close().catch(() => {});
    const answered = await Promise.race([
      page
        .evaluate(() => document.readyState)
        .then(
          () => true,
          () => false,
        ),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!answered) {
      stalls += 1;
      log.push("  STALL: the page did not answer within 5 s");
    }
    await page.waitForTimeout(60 + Math.floor(random() * 200));
  }
  return { actions, log, stalls };
}

/** Save an evidence screenshot; a timeout (WebKit font waits) is only a note. */
export async function shot(page, out, name) {
  await page.screenshot({ path: path.join(out, `${name}.png`), timeout: 8_000 }).catch(() => {});
}
