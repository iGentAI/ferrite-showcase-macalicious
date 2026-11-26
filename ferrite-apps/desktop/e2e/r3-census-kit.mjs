// R3's census kit (round 3 brief sections 4-5), for the <app>-census-journey.mjs suites of Finder, Preview, Keychain
// Access, Automator, Dictionary, Help Viewer, Calculator and Chess, and the docs demo pages of the apps the Ferrite build
// does not deploy. Real input only: Playwright mouse, keyboard and file chooser; `page.evaluate` reads and asserts (and
// sets up data that is not the action under test), it never performs the action a census row verifies.
//
// Options every suite takes:
//   --browser chromium|chrome|firefox|webkit   (chrome = Google Chrome stable, Playwright channel "chrome")
//   --url http://127.0.0.1:8080                 the served `ferrite dev`
//   --phase all|write|restart-check            write keeps what restart-check reads in --state
//   --state <file.json>                        account and markers carried across a real same-root restart
//   --census <file.tsv>                        the app's census: every id of the phase must be checked
//   --explore <seconds>                        the seeded exploratory pass after the census (0: none)
//   --seed <n>  --headed  --out <dir>
// Prints one `ok   <id>` or `FAIL <id>` line per census id, then a summary; exits 0 only when every id of the phase
// passed, none was left unexercised, and no page logged a console error, page error, unhandled rejection, 5xx, failed
// request or an HTTP error that the suite did not provoke on purpose (`allow`).

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_NAMES, ENGINES } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The four engines `--browser` takes, journey-kit's own (`ENGINES[name].launch(options)`; Chrome on its channel). */
export { ENGINE_NAMES, ENGINES };

export function options() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
  };
  const browserName = option("--browser", "chromium");
  if (!Object.hasOwn(ENGINES, browserName)) {
    console.error(`--browser must be one of ${ENGINE_NAMES.join(", ")}, not ${browserName}`);
    process.exit(2);
  }
  const phase = option("--phase", "all");
  if (!["all", "write", "restart-check"].includes(phase)) {
    console.error("--phase must be all, write or restart-check");
    process.exit(2);
  }
  const out = path.resolve(option("--out", path.join(here, "output", "r3")));
  mkdirSync(out, { recursive: true });
  return {
    browserName,
    phase,
    base: option("--url", "http://127.0.0.1:8080").replace(/\/$/, ""),
    out,
    stateFile: option("--state", ""),
    censusFile: option("--census", ""),
    emitCensus: option("--emit-census", ""),
    explore: Number(option("--explore", "0")),
    seed: Number(option("--seed", String(Date.now() % 100000))),
    headed: args.includes("--headed"),
  };
}

/**
 * The census rows of `app` (TSV with the brief's header), or [] when no --census was given. An explicit file that is
 * missing, has another header, or has no row for `app` is an error: coverage must never be switched off by a typo.
 */
export function readCensus(file, app) {
  if (!file) return [];
  if (!existsSync(file)) throw new Error(`--census ${file}: no such file`);
  const all = readFileSync(file, "utf8").split("\n");
  const numbered = all.map((text, i) => ({ text, line: i + 1 })).filter((l) => l.text.trim());
  if (numbered.length === 0) throw new Error(`--census ${file}: empty file`);
  const [head, ...lines] = numbered;
  const cols = head.text.split("\t");
  for (const c of CENSUS_COLUMNS)
    if (!cols.includes(c)) throw new Error(`--census ${file}: header lacks "${c}"`);
  const seen = new Set();
  const rows = lines.map(({ text, line }) => {
    const values = text.split("\t");
    if (values.length !== cols.length)
      throw new Error(
        `--census ${file}:${line}: ${values.length} fields, the header has ${cols.length}`,
      );
    const row = Object.fromEntries(values.map((v, i) => [cols[i], v]));
    if (!row.id.trim()) throw new Error(`--census ${file}:${line}: empty id`);
    if (seen.has(row.id)) throw new Error(`--census ${file}:${line}: duplicate id ${row.id}`);
    seen.add(row.id);
    return row;
  });
  const mine = rows.filter((r) => !app || r.app === app);
  if (mine.length === 0) throw new Error(`--census ${file}: no rows for app "${app}"`);
  return mine;
}

/** The census header (round 3 brief section 5). */
export const CENSUS_COLUMNS = [
  "id",
  "app",
  "window_or_state",
  "role",
  "name",
  "how_reached",
  "expected_outcome",
  "verified_by",
  "persists",
  "chromium",
  "chrome",
  "firefox",
  "webkit",
  "notes",
];

/** Whether a census row is checked in `phase`: restart rows in restart-check, every other row in write and all. */
function inPhase(row, phase) {
  const restartRow = /--phase restart-check/.test(row.verified_by ?? "");
  return phase === "restart-check" ? restartRow : !restartRow;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Polls `fn` until it answers truthy, up to `ms`; answers the last value. */
export async function until(fn, ms = 10_000, every = 150) {
  const end = Date.now() + ms;
  let value;
  for (;;) {
    try {
      value = await fn();
      if (value) return value;
    } catch {
      value = undefined;
    }
    if (Date.now() > end) return value;
    await sleep(every);
  }
}

/**
 * A census row as a suite declares it: R(id, window_or_state, role, name, how_reached, expected_outcome, persists,
 * notes, phase). `phase` is "write" (default) or "restart-check".
 */
export const R = (
  id,
  win,
  role,
  name,
  how,
  expect,
  persists = "none",
  notes = "",
  phase = "write",
) => ({ id, win, role, name, how, expect, persists, notes, phase });

/** Census rows of a window's chrome, as windowChrome checks them (R8's matching: role resize-handle, names n..nw). */
export function chromeRows(prefix, win, { resizable = true, zoomName = "Zoom" } = {}) {
  const edges = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  return [
    R(
      `${prefix}.move`,
      win,
      "window chrome",
      "title bar",
      "drag the title bar",
      "the window follows the pointer",
    ),
    ...edges.map((e) =>
      R(
        `${prefix}.resize-${e}`,
        win,
        "resize-handle",
        e,
        resizable ? `drag the ${e} edge out and back` : `press at the ${e} edge`,
        resizable ? "the window resizes from that edge" : "no handle: the window has one size",
      ),
    ),
    R(
      `${prefix}.zoom`,
      win,
      "button",
      zoomName,
      "click, then back",
      resizable ? "zooms (or full screen) and returns" : "dimmed: the window has one size",
    ),
    R(
      `${prefix}.minimize`,
      win,
      "button",
      "Minimize",
      "click, then the Dock tile",
      "goes into the Dock and comes back",
    ),
    R(`${prefix}.close`, win, "button", "Close", "click", "the window closes"),
  ];
}

/** Census rows of the menu-bar titles of an app: each opens its menu. */
export const menuTitleRows = (slug, titles) =>
  titles.map((t) =>
    R(
      `${slug}.menubar.${t.toLowerCase().replace(/\W+/g, "-")}`,
      "menu bar",
      "menuitem",
      t,
      `click ${t} in the menu bar`,
      "its menu opens",
    ),
  );

/** Census rows of the shell's application menu of `App` (desktop-menus.tsx, R2's file). */
export function appMenuRows(slug, App) {
  const m = `menu:${App}`;
  return [
    R(
      `${slug}.menu.app.about`,
      m,
      "menuitem",
      `About ${App}`,
      "choose",
      `an About panel naming ${App}, or dimmed with its reason`,
    ),
    R(
      `${slug}.menu.app.preferences`,
      m,
      "menuitem",
      "Preferences…",
      "choose",
      "works, or dimmed with its reason",
    ),
    R(`${slug}.menu.app.services`, m, "menuitem", "Services", "hover", "its submenu opens"),
    R(
      `${slug}.menu.app.services-none`,
      `${m} > Services`,
      "menuitem",
      "No Services Apply",
      "hover Services",
      "dimmed; it is itself the reason",
    ),
    R(
      `${slug}.menu.app.hide`,
      m,
      "menuitem",
      `Hide ${App}`,
      "choose, then Spotlight",
      "the app's windows hide, and come back",
    ),
    R(
      `${slug}.menu.app.hide-others`,
      m,
      "menuitem",
      "Hide Others",
      "with a Finder window open, choose",
      "the Finder window hides",
    ),
    R(
      `${slug}.menu.app.show-all`,
      m,
      "menuitem",
      "Show All",
      "after Hide Others, choose",
      "the Finder window shows again",
    ),
    R(`${slug}.menu.app.quit`, m, "menuitem", `Quit ${App}`, "choose", "the app's windows close"),
  ];
}

/**
 * A census suite of `app` (the census TSV's `app` column). `spec.rows` are the rows the suite declares (built with `R`)
 * and `spec.file` its file name; with `--emit-census <tsv>` the suite writes them as the census (engine cells empty, for
 * the combiner) and exits. Without declared rows, `--census` names the TSV to enforce. `run(body)` launches the engine
 * and calls body({ person, check, allow, opts, state, saveState, shot, note, browser }). `check(id, ok, detail)` records
 * one census id; a second check of the same id must pass too.
 */
export function census(app, spec = {}) {
  const opts = options();
  const declared = (spec.rows ?? []).map((r) => ({
    id: r.id,
    app: spec.id ?? app,
    window_or_state: r.win,
    role: r.role,
    name: r.name,
    how_reached: r.how,
    expected_outcome: r.expect,
    verified_by: `ferrite-apps/desktop/e2e/${spec.file} --phase ${r.phase}: ${r.id}`,
    persists: r.persists,
    chromium: "",
    chrome: "",
    firefox: "",
    webkit: "",
    notes: r.notes,
  }));
  const dup = declared.map((r) => r.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (dup.length) throw new Error(`${app}: duplicate census ids ${dup.join(", ")}`);
  if (opts.emitCensus) {
    const clean = (v) => String(v ?? "").replace(/[\t\n]+/g, " ");
    mkdirSync(path.dirname(path.resolve(opts.emitCensus)), { recursive: true });
    writeFileSync(
      opts.emitCensus,
      `${[CENSUS_COLUMNS.join("\t"), ...declared.map((r) => CENSUS_COLUMNS.map((c) => clean(r[c])).join("\t"))].join("\n")}\n`,
    );
    console.log(`${declared.length} census rows of ${app} written to ${opts.emitCensus}`);
    process.exit(0);
  }
  const rows = declared.length ? declared : readCensus(opts.censusFile, spec.id ?? app);
  const expected = rows.filter((r) => inPhase(r, opts.phase)).map((r) => r.id);
  const results = new Map();
  const problems = [];
  const allowed = [];
  const contexts = [];
  const logFile = path.join(
    opts.out,
    `${app.replace(/\W+/g, "-").toLowerCase()}-${opts.browserName}-${opts.phase}.events.log`,
  );
  const note = (text) => {
    console.log(`note ${text}`);
    appendFileSync(logFile, `${new Date().toISOString()} ${text}\n`);
  };
  const check = (id, ok, detail = "") => {
    const prior = results.get(id);
    results.set(id, { ok: (prior?.ok ?? true) && !!ok, detail });
    console.log(
      `${ok ? "ok  " : "FAIL"} ${id}${detail ? ` (${String(detail).slice(0, 300)})` : ""}`,
    );
    return !!ok;
  };
  const allow = (pattern) => allowed.push(pattern);
  const problem = (text) => {
    if (allowed.some((p) => p.test(text))) return note(`allowed: ${text}`);
    problems.push(text);
    note(`PROBLEM ${text}`);
  };
  const watch = (page, label) => {
    page.on("console", (m) => {
      if (m.type() === "error")
        problem(
          `${label} console: ${m.text()}${m.location()?.url ? ` (${m.location().url})` : ""}`,
        );
    });
    page.on("pageerror", (e) => problem(`${label} page error: ${e.message}`));
    page.on("requestfailed", (r) => {
      const text = r.failure()?.errorText ?? "";
      const url = r.url();
      // The dev server's reload stream, the desktop's live streams, its background read of Messages' rooms, and blob
      // reads closed by the page itself, and downloads the browser takes over, are not failures of the app.
      if (
        /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled|Load request cancelled/i.test(
          text,
        ) &&
        (url.includes("/__forge/reload") ||
          url.startsWith("blob:") ||
          url.includes("/live/") ||
          url.includes("/api/messages/rooms/desktop") ||
          r.isNavigationRequest() ||
          /download/i.test(url))
      )
        return;
      problem(`${label} request failed: ${url} ${text}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400)
        problem(`${label} HTTP ${r.status()}: ${r.request().method()} ${r.url()}`);
    });
  };
  let state = {};
  if (opts.stateFile && existsSync(opts.stateFile))
    state = JSON.parse(readFileSync(opts.stateFile, "utf8"));
  const saveState = (patch) => {
    state = { ...state, ...patch };
    if (opts.stateFile) writeFileSync(opts.stateFile, JSON.stringify(state, null, 2));
  };
  const shot = async (page, name) => {
    try {
      await page.screenshot({
        path: path.join(opts.out, `${name}-${opts.browserName}.png`),
        timeout: opts.browserName === "webkit" ? 4_000 : 15_000,
      });
    } catch (error) {
      console.log(`warn screenshot ${name} not saved: ${String(error.message).split("\n")[0]}`);
    }
  };

  /**
   * Runs one section of a suite: an error is recorded (a FAIL line, a page problem and a screenshot of `page`) and the
   * suite goes on, so that one broken step cannot leave the rest of the census unexercised. Any open menu is closed.
   */
  const guard = async (label, page, fn) => {
    try {
      return await fn();
    } catch (error) {
      // The first line, and from Playwright's call log the locator it waited for and what covered it.
      const lines = error instanceof Error ? error.message.split("\n") : [String(error)];
      const waited = lines.find((l) => /waiting for /.test(l))?.trim() ?? "";
      const covered = lines.findLast((l) => /intercepts pointer events/.test(l))?.trim() ?? "";
      const text = `${lines[0]}${waited ? ` [${waited.slice(0, 160)}]` : ""}${covered ? ` [${covered.slice(0, 160)}]` : ""}`;
      console.log(`FAIL section "${label}" aborted: ${text}`);
      problems.push(`section "${label}" aborted: ${text}`);
      if (page && !page.isClosed()) {
        await shot(page, `abort-${label.replace(/\W+/g, "-")}`);
        await closeMenus(page).catch(() => {});
        // A sheet or dialog left open would take every later click: close it.
        for (let i = 0; i < 3; i += 1) {
          if (
            (await page
              .locator('[role="dialog"]:visible, [role="alertdialog"]:visible')
              .count()
              .catch(() => 0)) === 0
          )
            break;
          await page.keyboard.press("Escape").catch(() => {});
          await sleep(250);
        }
      }
      return undefined;
    }
  };

  const run = async (body) => {
    console.log(
      `${app} census in ${opts.browserName}, phase ${opts.phase}, seed ${opts.seed}${opts.headed ? ", headed" : ""}`,
    );
    const browser = await ENGINES[opts.browserName].launch({ headless: !opts.headed });
    console.log(`engine: ${opts.browserName} ${browser.version()}`);
    /** A person's page: `guest` (Guest User), `{ create }` (a new account) or `{ signIn }` (an existing one). */
    const person = async (label, how = "guest", contextOptions = {}) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        acceptDownloads: true,
        ...contextOptions,
      });
      contexts.push(context);
      const page = await context.newPage();
      watch(page, label);
      await page.goto(`${opts.base}/`, { waitUntil: "load" });
      if (how === "guest") await signInAsGuest(page);
      else if (how.create) await createAccount(page, how.create);
      else if (how.signIn) await signIn(page, how.signIn);
      return page;
    };
    let aborted = "";
    try {
      await body({
        person,
        check,
        allow,
        opts,
        state,
        saveState,
        shot,
        note,
        browser,
        problem,
        guard,
      });
    } catch (error) {
      aborted = error instanceof Error ? error.message.split("\n")[0] : String(error);
      problems.push(`suite aborted: ${aborted}`);
      console.log(`FAIL suite aborted: ${aborted}`);
    } finally {
      for (const c of contexts) await c.close().catch(() => {});
      await browser.close().catch(() => {});
    }
    const unexercised = expected.filter((id) => !results.has(id));
    for (const id of unexercised)
      console.log(`FAIL ${id} (not exercised${aborted ? ": suite aborted" : ""})`);
    const unlisted = [...results.keys()].filter(
      (id) => rows.length > 0 && !rows.some((r) => r.id === id),
    );
    for (const id of unlisted) console.log(`note ${id} is checked but not in the census`);
    const failed = [...results].filter(([, r]) => !r.ok).map(([id]) => id);
    console.log(
      `\n${app} ${opts.browserName} ${opts.phase}: ${results.size} ids checked, ${results.size - failed.length} ok, ${failed.length} failed, ${unexercised.length} unexercised of ${expected.length} census ids; ${problems.length} page problem(s)`,
    );
    for (const p of problems) console.log(`  problem: ${p}`);
    process.exit(failed.length === 0 && unexercised.length === 0 && problems.length === 0 ? 0 : 1);
  };
  return { run, check, allow, opts, note };
}

// ---------------------------------------------------------------------------------------------------------------
// Sign-in.

export async function signInAsGuest(page) {
  const finder = page.getByRole("button", { name: /^Finder$/ }).first();
  const guest = page.getByRole("button", { name: /^Guest User$/ }).first();
  await finder.or(guest).first().waitFor({ timeout: 30_000 });
  if (await guest.isVisible()) await guest.click();
  await finder.waitFor({ timeout: 30_000 });
}

/** The login window's Create Account… form, filled in with the keyboard and sent. */
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
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
}

/**
 * Sign in to an existing account at the login window through Other…: its Log In form takes the account name and the
 * password (a login window with many accounts need not show every user tile).
 */
export async function signIn(page, { name, password }) {
  const users = page.getByRole("group", { name: "Users" });
  await users.waitFor({ timeout: 30_000 });
  await users.getByRole("button", { name: "Other…", exact: true }).click();
  const form = page.getByRole("form", { name: "Log In" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Account Name:").fill(name);
  await form.getByLabel("Password:").fill(password);
  await form.getByRole("button", { name: "Log In" }).click();
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
}

/** A fresh account's details, unique per run and engine. */
export function newAccount(prefix, browserName) {
  const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  return {
    name: `${prefix}${browserName.slice(0, 2)}${tag}`.toLowerCase(),
    fullName: `${prefix} ${browserName} ${tag}`,
    password: `pw-${tag}-R3-census`,
  };
}

/** Reload the desktop and wait for its Dock. */
export async function reload(page) {
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------------------------------------------
// Apps, windows and menus.

/** `fetch` from inside the page: reads, and setup that is not the action under test. */
export function api(page, method, url, body, headers = {}) {
  return page.evaluate(
    async ({ method, url, body, headers }) => {
      const r = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body !== undefined ? { "content-type": "application/json", ...headers } : headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return { status: r.status, json, text };
    },
    { method, url, body, headers },
  );
}

/** Gets App Store apps for the signed-in person through the library (setup; the App Store itself is R5's), then reloads. */
export async function install(page, ids) {
  const got = await api(page, "GET", "/api/app-store/library");
  const installed = [...new Set([...(got.json?.installed ?? []), ...ids])];
  const put = await api(page, "PUT", "/api/app-store/library", { installed, rev: got.json?.rev });
  if (put.status !== 200) throw new Error(`library PUT answered ${put.status}`);
  await reload(page);
}

/** Opens an app by typing its name into Spotlight and pressing Return (real keyboard). */
export async function spotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.waitFor({ timeout: 10_000 });
  await field.fill(name);
  await field.press("Enter");
}

/**
 * Opens `app` with Spotlight and answers its window: the window that becomes key and was not open before (windows are
 * named after their content, Finder's after its folder), as a locator on its stable label (aria-labelledby id or
 * aria-label), so that it keeps finding the window when its title changes or a modal sheet hides it from the
 * accessibility tree. `windowClass` (for example "mac-finder") narrows it to the app's own window.
 */
export async function openApp(page, app, windowClass = "") {
  const sel = `.mac-window[role="region"]${windowClass ? `.${windowClass}` : ""}`;
  const before = await page
    .locator(sel)
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-labelledby") ?? e.getAttribute("aria-label")),
    );
  await spotlight(page, app);
  let key = await until(
    () =>
      page.locator(sel).evaluateAll((els, before) => {
        const fresh = els.filter(
          (e) =>
            !before.includes(e.getAttribute("aria-labelledby") ?? e.getAttribute("aria-label")),
        );
        const k =
          fresh.find((e) => e.getAttribute("data-window-state") === "key") ??
          fresh[fresh.length - 1];
        return k
          ? { lb: k.getAttribute("aria-labelledby"), label: k.getAttribute("aria-label") }
          : null;
      }, before),
    20_000,
  );
  // An app whose window was already open (Finder's, say) is brought forward rather than opened
  // again: its key window is the answer, told by a window class or by the app's name in the menu bar.
  const named = windowClass
    ? 1
    : await page
        .getByRole("menubar")
        .first()
        .getByRole("menuitem", { name: app, exact: true })
        .count();
  if (!key && named > 0)
    key = await page.locator(sel).evaluateAll((els) => {
      const k = els.find((e) => e.getAttribute("data-window-state") === "key");
      return k
        ? { lb: k.getAttribute("aria-labelledby"), label: k.getAttribute("aria-label") }
        : null;
    });
  if (!key) throw new Error(`${app}: no new window opened`);
  return key.lb
    ? page.locator(`${sel}[aria-labelledby="${key.lb}"]`).first()
    : page.locator(`${sel}[aria-label="${key.label}"]`).first();
}

/** A window's title as the person sees it (its aria-labelledby text, or aria-label). */
export async function windowTitle(win) {
  return win.evaluate((el) => {
    const id = el.getAttribute("aria-labelledby");
    return (
      (id && document.getElementById(id)?.textContent) ||
      el.getAttribute("aria-label") ||
      ""
    ).trim();
  });
}

/** Presses Escape until no menu is open (at most 6 times). */
export async function closeMenus(page) {
  for (let i = 0; i < 6; i += 1) {
    if (
      (await page.locator('[role="menu"][data-open], [role="listbox"][data-open]').count()) === 0
    ) {
      return;
    }
    await page.keyboard.press("Escape");
    await sleep(120);
  }
}

/**
 * Makes `win` (a window of `app`) the key window without clicking it (another window may cover it): Spotlight opens the
 * app, which brings its window forward. Answers whether it became key.
 */
export async function bringToFront(page, win, app) {
  if ((await frame(win).catch(() => null))?.state === "key") return true;
  await closeMenus(page);
  await spotlight(page, app);
  return !!(await until(async () => (await frame(win)).state === "key", 5_000));
}

const menubar = (page) => page.getByRole("menubar").first();

/** Opens the menu-bar menu `top` and answers the open menu. */
export async function openMenu(page, top) {
  await menubar(page)
    .getByRole("menuitem", { name: top, exact: true })
    .first()
    .click({ timeout: 8_000 });
  const opened = page.locator('[role="menu"][data-open]').last();
  await opened.waitFor({ state: "visible", timeout: 5_000 });
  // Held by its id: a lazy "last open menu" would turn into a submenu as soon as one opens.
  const id = await opened.getAttribute("id");
  return id ? page.locator(`[id="${id}"]`) : page.getByRole("menu").first();
}

/** The item `name` (string: exact, or RegExp) of an open menu, any of the menu item roles. */
export function menuItem(scope, name) {
  const o = typeof name === "string" ? { name, exact: true } : { name };
  return scope
    .getByRole("menuitem", o)
    .or(scope.getByRole("menuitemcheckbox", o))
    .or(scope.getByRole("menuitemradio", o))
    .first();
}

/**
 * Chooses `path` from the menu bar: [top, item] or [top, submenu, ..., item], hovering each submenu (real pointer).
 * Answers false when an item is dimmed (aria-disabled) and leaves the menu closed.
 */
export async function choose(page, path) {
  const [top, ...items] = path;
  let menu = await openMenu(page, top);
  for (let i = 0; i < items.length; i += 1) {
    const item = menuItem(menu, items[i]);
    await item.waitFor({ timeout: 5_000 });
    if ((await item.getAttribute("aria-disabled")) === "true") {
      await closeMenus(page);
      return false;
    }
    if (i < items.length - 1) {
      await item.hover();
      if (
        !(await until(async () => (await item.getAttribute("aria-expanded")) === "true", 2_000))
      ) {
        await item.focus().catch(() => {});
        await page.keyboard.press("ArrowRight");
        await until(async () => (await item.getAttribute("aria-expanded")) === "true", 2_000);
      }
      const controls = await item.getAttribute("aria-controls");
      menu = controls
        ? page.locator(`[id="${controls}"]`)
        : page.locator('[role="menu"][data-open]').last();
      await menu.waitFor({ state: "visible", timeout: 3_000 });
    } else {
      await item.click();
    }
  }
  return true;
}

/** The state of a menu item: { exists, disabled, checked, text }; the menu is opened and closed again. */
export async function menuState(page, path) {
  const items = await menuItems(page, path.slice(0, -1).length ? path.slice(0, -1) : [path[0]]);
  const want = path.at(-1);
  const match = (t) => (typeof want === "string" ? t.label === want : want.test(t.text));
  const at = path.length === 1 ? -1 : items.findIndex(match);
  const item = items[at];
  return item
    ? {
        exists: true,
        disabled: item.disabled,
        checked: item.checked,
        text: item.text,
        next: items[at + 1] ?? null,
        prev: items[at - 1] ?? null,
        items,
      }
    : { exists: false, disabled: false, checked: false, text: "", next: null, prev: null, items };
}

/**
 * The items of the menu at `path` ([top] or [top, submenu, ...]) as the person sees them: { label, text, disabled,
 * checked, role } each, `label` being the item's name without its shortcut. The menu is opened and closed again.
 */
export async function menuItems(page, path) {
  const [top, ...subs] = path;
  let menu = await openMenu(page, top);
  for (const s of subs) {
    const item = menuItem(menu, s);
    if ((await item.count()) === 0) {
      // The submenu asked for is not there: no items, never the parent's.
      await closeMenus(page);
      return [];
    }
    await item.hover();
    if (!(await until(async () => (await item.getAttribute("aria-expanded")) === "true", 2_000))) {
      // Some engines do not open a submenu on hover (Firefox, Go > Applications): ArrowRight on the trigger does.
      await item.focus().catch(() => {});
      await page.keyboard.press("ArrowRight");
      await until(async () => (await item.getAttribute("aria-expanded")) === "true", 2_000);
    }
    const controls = await item.getAttribute("aria-controls");
    menu = controls
      ? page.locator(`[id="${controls}"]`)
      : page.locator('[role="menu"][data-open]').last();
    await menu.waitFor({ state: "visible", timeout: 3_000 });
  }
  const items = await menu.evaluate((m) =>
    [...m.querySelectorAll('[role^="menuitem"]')]
      .filter((e) => e.closest('[role="menu"]') === m)
      .map((e) => {
        const text = (e.textContent ?? "").replace(/\s+/g, " ").trim();
        const title = e
          .querySelector(".mac-menu-item-title")
          ?.textContent?.replace(/\s+/g, " ")
          .trim();
        const label = (e.getAttribute("aria-label") ?? title ?? text).trim();
        return {
          label,
          text,
          disabled: e.getAttribute("aria-disabled") === "true" || e.hasAttribute("data-disabled"),
          checked: e.getAttribute("aria-checked") === "true",
          role: e.getAttribute("role"),
        };
      }),
  );
  await closeMenus(page);
  return items;
}

/** A dimmed item's reason as the menu shows it: a dimmed row right after it saying why ("… has no …", "cannot"). */
export const REASON =
  /\b(has no|have no|no |not |cannot|can't|only|unavailable|needs?|requires?)\b/i;

/**
 * Census check of a menu item that must either work or be visibly unavailable with its reason (brief section 5).
 * Enabled: chosen with the pointer, then `works()` must answer { ok, detail }. Dimmed: passes only when the item
 * itself or the dimmed row after it states a reason (REASON); a bare dimmed item fails.
 */
export async function availableOrReason(page, check, id, path, works) {
  const s = await menuState(page, path);
  if (!s.exists) return check(id, false, `no item ${path.join(" > ")}`);
  if (s.disabled) {
    const own = REASON.test(s.text) && s.text !== String(path.at(-1));
    const why = (r) => (r?.disabled && REASON.test(r.text) ? r.text : "");
    const row = why(s.next) || why(s.prev);
    const reason = own ? s.text : row;
    return check(
      id,
      !!reason,
      reason ? `unavailable: ${reason}` : `dimmed, no reason shown ("${s.text}")`,
    );
  }
  if (!works) return check(id, false, `enabled, but no outcome is defined for "${s.text}"`);
  if (!(await choose(page, path))) return check(id, false, "dimmed when chosen");
  const r = await works();
  return check(id, !!r?.ok, r?.detail ?? "");
}

/** The window frame state of a window region: its box and the managed window's flags. */
export async function frame(win) {
  return win.evaluate((el) => {
    let m = el;
    while (
      m &&
      !m.querySelector(":scope > .mac-managed-window-resize") &&
      !m.hasAttribute("data-minimized") &&
      m.parentElement
    ) {
      if (m.parentElement.querySelector(":scope > .mac-managed-window-resize")) {
        m = m.parentElement;
        break;
      }
      m = m.parentElement;
    }
    const host = m ?? el;
    const b = el.getBoundingClientRect();
    const handles = {};
    for (const h of host.querySelectorAll(":scope > .mac-managed-window-resize")) {
      const r = h.getBoundingClientRect();
      handles[h.getAttribute("data-edge")] = {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        w: r.width,
        h: r.height,
      };
    }
    return {
      x: Math.round(b.x),
      y: Math.round(b.y),
      w: Math.round(b.width),
      h: Math.round(b.height),
      minimized: el.closest("[data-minimized]") !== null || el.closest("[inert]") !== null,
      zoomed: el.closest("[data-zoomed]") !== null,
      fullScreen: el.closest("[data-full-screen]") !== null,
      state:
        el.closest("[data-window-state]")?.getAttribute("data-window-state") ??
        el.getAttribute("data-window-state"),
      handles,
    };
  });
}

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

/** Where to press to move a window: an empty spot of its title bar (top strip, right of the window controls). */
export async function titleBarSpot(_page, win) {
  const f = await frame(win);
  return win.evaluate((el, f) => {
    for (let dx = 0.5; dx < 0.95; dx += 0.07) {
      for (const dy of [6, 10, 14]) {
        const x = f.x + f.w * dx;
        const y = f.y + dy;
        const hit = document.elementFromPoint(x, y);
        if (
          hit &&
          el.contains(hit) &&
          !hit.closest(
            "button, input, [role=button], [role=searchbox], [role=textbox], [role=tab], [role=combobox], a",
          )
        )
          return { x, y };
      }
    }
    return { x: f.x + f.w * 0.5, y: f.y + 8 };
  }, f);
}

/**
 * Leaves full screen with real input: Control-Option-F (the window manager's command for the key window), else the
 * green button of the title bar, which shows when the pointer is at the top edge. Answers whether it left.
 */
export async function exitFullScreen(page, win) {
  if (!(await frame(win)).fullScreen) return true;
  await page.keyboard.press("Control+Alt+KeyF");
  if (await until(async () => !(await frame(win)).fullScreen, 3_000)) return true;
  const f = await frame(win);
  await page.mouse.move(f.x + f.w / 2, 2);
  await sleep(700);
  const exit = win
    .getByRole("button", { name: /^(Exit Full Screen|Zoom|Enter Full Screen)$/ })
    .first();
  if (await exit.isVisible().catch(() => false))
    await exit.click({ timeout: 4_000 }).catch(() => {});
  return !!(await until(async () => !(await frame(win)).fullScreen, 3_000));
}

const EDGES = {
  n: [0, -36],
  ne: [36, -36],
  e: [36, 0],
  se: [36, 36],
  s: [0, 36],
  sw: [-36, 36],
  w: [-36, 0],
  nw: [-36, -36],
};

/**
 * Window chrome of `win` (brief section 5), checked as census ids `${prefix}.<control>`: move by the title bar, resize by
 * each edge and corner (or, for a window that cannot be resized, no handles and a dimmed zoom), zoom and back,
 * minimize and back out of the Dock. Close is the suite's own last step. `windowName` re-finds the window.
 */
export async function windowChrome(
  page,
  win,
  prefix,
  check,
  { resizable = true, windowItem = "" } = {},
) {
  // Move: the title bar follows the pointer. A window coming back from the Dock animates for a moment first.
  let before = await frame(win);
  for (let waited = 0; waited < 3_000; waited += 100) {
    await sleep(100);
    const now = await frame(win);
    const still = now.x === before.x && now.y === before.y && now.w === before.w;
    before = now;
    if (still) break;
  }
  const spot = await titleBarSpot(page, win);
  await drag(page, spot, { x: spot.x - 40, y: spot.y + 30 });
  const moved = await frame(win);
  check(
    `${prefix}.move`,
    Math.abs(moved.x - (before.x - 40)) <= 2 && Math.abs(moved.y - (before.y + 30)) <= 2,
    `from ${before.x},${before.y} to ${moved.x},${moved.y}`,
  );
  // Resize from each edge and corner, outward then back inward.
  for (const [edge, [dx, dy]] of Object.entries(EDGES)) {
    const f = await frame(win);
    const h = f.handles[edge];
    if (!resizable) {
      check(
        `${prefix}.resize-${edge}`,
        !h,
        h ? "a handle on a fixed-size window" : "fixed size: no handle",
      );
      continue;
    }
    if (!h) {
      check(`${prefix}.resize-${edge}`, false, "no resize handle");
      continue;
    }
    // Outward first; an edge with no room outward (the menu bar above, the Dock below a tall
    // window) is tried inward instead. Each attempt is undone from the same handle.
    const attempt = async (sign, why = "the window was at its smallest") => {
      const f0 = await frame(win);
      const h0 = f0.handles[edge];
      if (!h0) return { ok: false, blocked: false, text: "no resize handle" };
      // The handle must be what the pointer reaches there (the Dock can lie over a tall window's edge).
      const hit = await page.evaluate(({ x, y }) => {
        const e = document.elementFromPoint(x, y);
        return e ? `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`.slice(0, 80) : "";
      }, h0);
      if (!hit.includes("mac-managed-window-resize"))
        return {
          ok: false,
          blocked: false,
          text: `${f0.w}x${f0.h}@${f0.x},${f0.y}: the ${edge} handle at ${Math.round(h0.x)},${Math.round(h0.y)} is covered by ${hit || "nothing"}`,
        };
      const mx = dx * sign;
      const my = dy * sign;
      // Inward, the handle ends inside the window's own frame. When something else lies there (a panel an earlier row
      // left open over the window), the drag back would start on it and move it instead, so the edge is tried outward.
      if (sign < 0) {
        const there = await win.evaluate(
          (el, { x, y }) => {
            const e = document.elementFromPoint(x, y);
            const mine = el.closest(".mac-managed-window") ?? el;
            return !e || mine.contains(e)
              ? ""
              : `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`.slice(0, 80);
          },
          { x: h0.x + mx, y: h0.y + my },
        );
        if (there)
          return {
            ok: false,
            blocked: true,
            why: `its inward position is covered by ${there}`,
            text: `${f0.w}x${f0.h}@${f0.x},${f0.y}: the ${edge} edge's inward position is covered by ${there}`,
          };
      }
      await drag(page, h0, { x: h0.x + mx, y: h0.y + my });
      const g = await frame(win);
      const wantW = f0.w + Math.abs(dx) * sign;
      const wantH = f0.h + Math.abs(dy) * sign;
      const okSize =
        (dx === 0 || Math.abs(g.w - wantW) <= 3) && (dy === 0 || Math.abs(g.h - wantH) <= 3);
      const okPos =
        (dx >= 0 || Math.abs(g.x - (f0.x + mx)) <= 3) &&
        (dy >= 0 || Math.abs(g.y - (f0.y + my)) <= 3);
      // How far the dragged edge really moved (a right or bottom edge by the size's change, a left
      // or top edge by the position's), undone from the same handle and checked restored.
      const ax = dx === 0 ? 0 : dx > 0 ? g.w - f0.w : g.x - f0.x;
      const ay = dy === 0 ? 0 : dy > 0 ? g.h - f0.h : g.y - f0.y;
      const h2 = g.handles[edge];
      // What the pointer reaches at the moved handle, said when the drag back does not restore the frame.
      const hit2 = h2
        ? await page.evaluate(({ x, y }) => {
            const e = document.elementFromPoint(x, y);
            const owner = e?.closest("[data-window-id]")?.getAttribute("data-window-id");
            return e
              ? `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`.slice(0, 80) +
                  (owner ? ` of window ${owner}` : "")
              : "";
          }, h2)
        : "no handle";
      if (h2 && (ax !== 0 || ay !== 0)) await drag(page, h2, { x: h2.x - ax, y: h2.y - ay });
      const back = await frame(win);
      const restored =
        Math.abs(back.w - f0.w) <= 3 &&
        Math.abs(back.h - f0.h) <= 3 &&
        Math.abs(back.x - f0.x) <= 3 &&
        Math.abs(back.y - f0.y) <= 3;
      // Blocked: the edge moved less than the drag asked (a boundary held it), not some other fault.
      const blocked =
        !okSize && (Math.abs(ax) < Math.abs(mx) - 3 || Math.abs(ay) < Math.abs(my) - 3);
      return {
        ok: okSize && okPos && restored,
        blocked,
        text: `${f0.w}x${f0.h}@${f0.x},${f0.y} -> ${g.w}x${g.h}@${g.x},${g.y} -> ${restored ? "restored" : `not restored (${back.w}x${back.h}@${back.x},${back.y}; the moved handle at ${Math.round(h2?.x ?? 0)},${Math.round(h2?.y ?? 0)} reached ${hit2 || "nothing"})`}${sign > 0 ? ` (outward: ${why})` : ""}`,
      };
    };
    // Inward first: the drag back then ends where the handle was found reachable. Outward only when
    // the window was at its smallest (the edge could not move inward) or something else covers the
    // edge's inward position; any other failure stands.
    let tried = await attempt(-1);
    if (!tried.ok && tried.blocked) tried = await attempt(1, tried.why);
    check(`${prefix}.resize-${edge}`, tried.ok, tried.text);
  }
  // Zoom (or full screen) and back.
  const zoom = win.getByRole("button", { name: /^(Zoom|Enter Full Screen)$/ }).first();
  if (!resizable) {
    check(
      `${prefix}.zoom`,
      (await zoom.count()) === 0 || (await zoom.isDisabled()),
      "fixed size: zoom dimmed",
    );
  } else {
    const z0 = await frame(win);
    await zoom.click();
    const z1 = await until(async () => {
      const f = await frame(win);
      return f.zoomed || f.fullScreen || f.w !== z0.w || f.h !== z0.h ? f : null;
    }, 5_000);
    // Back: Control-Option-F, else the green button (in full screen the title bar shows at the top edge).
    if (z1?.fullScreen) {
      await exitFullScreen(page, win);
    } else if (z1) {
      await zoom.click();
    }
    const z2 = await until(async () => {
      const f = await frame(win);
      return !f.zoomed && !f.fullScreen && Math.abs(f.w - z0.w) <= 2 && Math.abs(f.h - z0.h) <= 2
        ? f
        : null;
    }, 5_000);
    check(
      `${prefix}.zoom`,
      !!z1 && !!z2,
      z1
        ? `${z0.w}x${z0.h} -> ${z1.w}x${z1.h}${z1.fullScreen ? " (full screen)" : ""} -> ${z2 ? "restored" : "not restored"}`
        : "nothing changed",
    );
  }
  // Minimize into the Dock, then back with the window's Dock tile.
  const title = await windowTitle(win);
  await win.getByRole("button", { name: "Minimize", exact: true }).first().click();
  const mini = await until(async () => (await frame(win)).minimized, 5_000);
  // The Dock names a window's tile after its title or its application.
  const tile = mini
    ? ((await dockTile(page, title)) ?? (windowItem ? await dockTile(page, windowItem) : null))
    : null;
  let back = false;
  if (tile) {
    await tile.click();
    back = await until(async () => !(await frame(win)).minimized, 5_000);
  }
  // Else from the window's own item of the Window menu, as a Mac restores a minimised window.
  let via = "the Dock tile";
  if (mini && !back && windowItem) {
    await choose(page, ["Window", windowItem]).catch(() => {});
    back = await until(async () => !(await frame(win)).minimized, 5_000);
    via = `Window > ${windowItem}`;
  }
  check(
    `${prefix}.minimize`,
    !!mini && !!back,
    `${mini ? "minimized" : "not minimized"}, ${back ? `restored from ${via}` : "not restored"}`,
  );
}

/**
 * The Dock tile of the window titled `title`: a button so named outside every window (a window's
 * own buttons, such as Finder's path bar, can bear the same name), or null.
 */
async function dockTile(page, title) {
  const name = new RegExp(
    `^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}`,
  );
  const all = page.getByRole("button", { name });
  const at = await all.evaluateAll((els) => els.findLastIndex((e) => !e.closest(".mac-window")));
  return at >= 0 ? all.nth(at) : null;
}

/** Close the window with its close button; answers whether it went. */
export async function closeWindow(_page, win) {
  await win.getByRole("button", { name: "Close", exact: true }).first().click();
  return until(async () => (await win.count()) === 0 || !(await win.isVisible()), 5_000);
}

// ---------------------------------------------------------------------------------------------------------------
// The menus and chrome every app shares.

const EDIT_ITEMS = ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"];
const slugOf = (t) => t.toLowerCase().replace(/\W+/g, "-");

/**
 * Census rows of what every app shares: menu titles, the app menu, File > Close Window, Edit, View > Enter Full Screen,
 * the Window menu (Minimize, Zoom, Bring All to Front, the window's own item), Help > `<App> Help`, and the main
 * window's chrome. `windowItem` is the Window menu item's name (exact, or `/regex/` with `windowItemKind`).
 */
export function standardRows(
  slug,
  App,
  {
    menus,
    win = `${App} window`,
    windowItem = App,
    editItems = EDIT_ITEMS,
    windowItemKind = "",
    resizable = true,
    zoomName = "Enter Full Screen",
    fullScreen = true,
    edit = true,
    closeWindowItem = true,
  } = {},
) {
  return [
    ...menuTitleRows(slug, menus),
    ...appMenuRows(slug, App),
    ...(closeWindowItem
      ? [
          R(
            `${slug}.menu.file.close-window`,
            "menu:File",
            "menuitem",
            "Close Window",
            "choose",
            "the window closes",
          ),
        ]
      : []),
    ...(edit
      ? editItems.map((i) =>
          R(
            `${slug}.menu.edit.${slugOf(i)}`,
            "menu:Edit",
            "menuitem",
            i,
            "open Edit",
            "listed with its state, or works where the suite defines what it does",
          ),
        )
      : []),
    ...(fullScreen
      ? [
          R(
            `${slug}.menu.view.full-screen`,
            "menu:View",
            "menuitem",
            "Enter Full Screen",
            "choose, then Control-Option-F",
            "full screen and back, or dimmed with its reason",
          ),
        ]
      : []),
    R(
      `${slug}.menu.window.minimize`,
      "menu:Window",
      "menuitem",
      "Minimize",
      "choose, then the Dock tile",
      "the window goes into the Dock and comes back",
    ),
    R(
      `${slug}.menu.window.zoom`,
      "menu:Window",
      "menuitem",
      "Zoom",
      "choose twice",
      "zooms and returns, or dimmed with its reason",
    ),
    R(
      `${slug}.menu.window.bring-all`,
      "menu:Window",
      "menuitem",
      "Bring All to Front",
      "choose",
      "the app's windows come forward, or dimmed with its reason",
    ),
    R(
      `${slug}.menu.window.item`,
      "menu:Window",
      "menuitemcheckbox",
      windowItem,
      "choose",
      "the window becomes key",
      "none",
      windowItemKind ? `kind: ${windowItemKind}` : "",
    ),
    R(
      `${slug}.menu.help.app-help`,
      "menu:Help",
      "menuitem",
      `${App} Help`,
      "choose",
      "opens help, or dimmed with its reason",
    ),
    ...chromeRows(`${slug}.window`, win, { resizable, zoomName }),
  ];
}

/**
 * Checks the rows of `standardRows` with real input. `ctx`: { page, check, problem, guard, slug, App, menus, open()
 * (opens the app and answers its window), win (the open window), resizable, fullScreen, edit, closeWindowItem,
 * preferences, editWorks }. Ends with the app quit. Answers the last window locator.
 */
export async function standardChecks(ctx) {
  const { page, check, problem, slug, App, menus, open, guard } = ctx;
  let win = ctx.win;
  const front = () => bringToFront(page, win, App);
  const ensure = async () => {
    if ((await win.count()) > 0 && (await win.isVisible().catch(() => false))) await front();
    else win = await open();
  };
  const g = guard ?? (async (_l, _p, fn) => fn());
  await g(`${App} shared menus`, page, async () => {
    await ensure();
    await availableOrReason(
      page,
      check,
      `${slug}.menu.app.about`,
      [App, `About ${App}`],
      async () => {
        const shown = await until(
          async () =>
            page
              .getByText(new RegExp(`About ${App}|${App}\\s+Version`, "i"))
              .first()
              .isVisible(),
          5_000,
        );
        await page.keyboard.press("Escape");
        return { ok: !!shown, detail: shown ? `an About panel names ${App}` : "no About panel" };
      },
    );
    await ensure();
    const openWindows = page.locator(".mac-window");
    const windowsBefore = await openWindows.count();
    await availableOrReason(
      page,
      check,
      `${slug}.menu.app.preferences`,
      [App, "Preferences…"],
      ctx.preferences ??
        (async () => {
          // An app with preferences of its own opens a window for them.
          const opened = await until(
            async () => (await openWindows.count()) > windowsBefore,
            5_000,
          );
          if (opened)
            await openWindows
              .last()
              .getByRole("button", { name: "Close", exact: true })
              .first()
              .click();
          return {
            ok: !!opened,
            detail: opened ? "the Preferences window opened and closed" : "no window opened",
          };
        }),
    );
    await ensure();
    const services = await menuState(page, [App, "Services", "No Services Apply"]);
    check(
      `${slug}.menu.app.services`,
      services.exists,
      services.exists ? "the Services submenu opens" : "no submenu",
    );
    check(
      `${slug}.menu.app.services-none`,
      services.exists && services.disabled,
      services.text || "no submenu",
    );
    for (const t of menus)
      check(`${slug}.menubar.${slugOf(t)}`, (await menuItems(page, [t])).length > 0, t);
    if (ctx.edit !== false)
      for (const item of ctx.editItems ?? EDIT_ITEMS) {
        const id = `${slug}.menu.edit.${slugOf(item)}`;
        if (ctx.editWorks?.[item]) {
          await availableOrReason(page, check, id, ["Edit", item], ctx.editWorks[item]);
          continue;
        }
        // Listed with its state, as the R6 suites read Edit: what it does is the app's rows' to check.
        const state = await menuState(page, ["Edit", item]);
        check(
          id,
          state.exists,
          state.exists ? `${state.text} disabled=${state.disabled}` : "not listed",
        );
      }
    await availableOrReason(
      page,
      check,
      `${slug}.menu.help.app-help`,
      ["Help", `${App} Help`],
      async () => {
        const help = page.locator(".mac-window.mac-help-viewer").first();
        const shown = await until(async () => help.isVisible(), 8_000);
        if (shown && App !== "Help Viewer") await closeWindow(page, help).catch(() => {});
        return { ok: !!shown, detail: shown ? "Help Viewer opened" : "no help shown" };
      },
    );
  });
  await g(`${App} Window and View menus`, page, async () => {
    await ensure();
    const items = await menuItems(page, ["Window"]);
    const title = await windowTitle(win);
    const own =
      items.find(
        (i) => i.role === "menuitemcheckbox" && ctx.windowItem && i.label === ctx.windowItem,
      ) ??
      items.find((i) => i.role === "menuitemcheckbox" && i.label === title) ??
      items.find((i) => i.role === "menuitemcheckbox" && title.startsWith(i.label));
    if (own) await choose(page, ["Window", own.label]);
    check(
      `${slug}.menu.window.item`,
      !!own && !!(await until(async () => (await frame(win)).state === "key", 5_000)),
      own ? own.label : `items ${items.map((i) => i.text).join("|")}`,
    );
    await availableOrReason(
      page,
      check,
      `${slug}.menu.window.bring-all`,
      ["Window", "Bring All to Front"],
      async () => {
        const ok = await until(async () => (await frame(win)).state === "key", 5_000);
        return { ok: !!ok, detail: ok ? `${App} in front` : "not in front" };
      },
    );
    await ensure();
    const z0 = await frame(win);
    await availableOrReason(
      page,
      check,
      `${slug}.menu.window.zoom`,
      ["Window", "Zoom"],
      async () => {
        const z = await until(async () => {
          const f = await frame(win);
          return f.zoomed || f.w !== z0.w || f.h !== z0.h;
        }, 5_000);
        await choose(page, ["Window", "Zoom"]);
        const back = await until(async () => {
          const f = await frame(win);
          return !f.zoomed && Math.abs(f.w - z0.w) <= 2;
        }, 5_000);
        return { ok: !!z && !!back, detail: `zoomed ${!!z}, back ${!!back}` };
      },
    );
    await ensure();
    await choose(page, ["Window", "Minimize"]);
    const mini = await until(async () => (await frame(win)).minimized, 5_000);
    if (mini) {
      const tile = (await dockTile(page, title)) ?? (await dockTile(page, App));
      await tile?.click({ timeout: 8_000 }).catch(() => {});
    }
    let restored = mini && (await until(async () => !(await frame(win)).minimized, 5_000));
    if (mini && !restored && (ctx.windowItem || own)) {
      await choose(page, ["Window", ctx.windowItem || own.label]).catch(() => {});
      restored = await until(async () => !(await frame(win)).minimized, 5_000);
    }
    if (mini && !restored) await spotlight(page, App);
    check(
      `${slug}.menu.window.minimize`,
      !!mini && !!restored,
      `minimized ${!!mini}, back ${!!restored}`,
    );
    if (ctx.fullScreen !== false) {
      await ensure();
      await availableOrReason(
        page,
        check,
        `${slug}.menu.view.full-screen`,
        ["View", "Enter Full Screen"],
        async () => {
          const fs = await until(async () => (await frame(win)).fullScreen, 5_000);
          const out = await exitFullScreen(page, win);
          return { ok: !!fs && !!out, detail: `full screen ${!!fs}, back ${!!out}` };
        },
      );
    }
  });
  await g(`${App} chrome`, page, async () => {
    await ensure();
    await windowChrome(page, win, `${slug}.window`, check, {
      resizable: ctx.resizable !== false,
      windowItem: ctx.windowItem ?? App,
    });
    check(`${slug}.window.close`, await closeWindow(page, win), "closed");
  });
  if (ctx.closeWindowItem !== false) {
    await g(`${App} File > Close Window`, page, async () => {
      await ensure();
      await choose(page, ["File", "Close Window"]);
      check(
        `${slug}.menu.file.close-window`,
        !!(await until(async () => (await win.count()) === 0 || !(await win.isVisible()), 5_000)),
        "closed",
      );
    });
  }
  await g(`${App} Hide, Hide Others, Show All, Quit`, page, async () => {
    await ensure();
    // The other app whose window Hide Others hides: Finder, or Calculator when the app under test is Finder.
    const other = App === "Finder" ? "Calculator" : "Finder";
    const finder = page
      .locator(other === "Finder" ? ".mac-window.mac-finder" : ".mac-window.mac-calculator")
      .first();
    if (other === "Finder")
      await page
        .getByRole("button", { name: /^Finder$/ })
        .first()
        .click();
    else await spotlight(page, other);
    try {
      await finder.waitFor({ timeout: 10_000 });
      await front();
      await availableOrReason(
        page,
        check,
        `${slug}.menu.app.hide-others`,
        [App, "Hide Others"],
        async () => {
          const hidden = await until(async () => !(await finder.isVisible()), 5_000);
          return {
            ok: !!hidden && (await win.isVisible()),
            detail: hidden ? `${other} hidden, ${App} shown` : `${other} still shown`,
          };
        },
      );
      await front();
      await availableOrReason(
        page,
        check,
        `${slug}.menu.app.show-all`,
        [App, "Show All"],
        async () => {
          const shown = await until(async () => finder.isVisible(), 5_000);
          return { ok: !!shown, detail: shown ? `${other} shown again` : `${other} still hidden` };
        },
      );
    } finally {
      if ((await finder.count()) > 0) {
        if (!(await finder.isVisible())) await choose(page, [App, "Show All"]).catch(() => {});
        if (!(await finder.isVisible())) await spotlight(page, other).catch(() => {});
        if (await finder.isVisible()) {
          // Show All leaves it behind the app's window, so its button is pressed from script.
          await finder
            .getByRole("button", { name: "Close", exact: true })
            .first()
            .evaluate((button) => button.click())
            .catch(() => {});
          await until(async () => !(await finder.isVisible()), 5_000);
        }
        if (await finder.isVisible())
          problem(`cleanup: the ${other} window opened for Hide Others did not close`);
      }
    }
    await front();
    await choose(page, [App, `Hide ${App}`]);
    const hid = await until(async () => !(await win.isVisible()), 5_000);
    await spotlight(page, App);
    const back = await until(async () => win.isVisible(), 5_000);
    check(`${slug}.menu.app.hide`, !!hid && !!back, `hidden ${!!hid}, back ${!!back}`);
    await front();
    if (ctx.quit) await ctx.quit();
    else {
      await choose(page, [App, `Quit ${App}`]);
      check(
        `${slug}.menu.app.quit`,
        !!(await until(async () => (await win.count()) === 0 || !(await win.isVisible()), 5_000)),
        "closed",
      );
    }
  });
  return win;
}

// ---------------------------------------------------------------------------------------------------------------
// Go > Applications: the shell's launcher submenu in apps with a Go menu (Finder, Dictionary, Help Viewer, Preview).

/** The launchers of Go > Applications as the crawl found them at 44c17c4 (every engine alike). */
export const GO_APPS = [
  "About This Mac",
  "Activity Monitor",
  "App Store",
  "Automator",
  "Books",
  "Calculator",
  "Calendar",
  "Chess",
  "Console",
  "Contacts",
  "Dictionary",
  "FaceTime",
  "Find My",
  "Finder",
  "Font Book",
  "Force Quit Applications",
  "Help Viewer",
  "Keychain Access",
  "Mail",
  "Maps",
  "Messages",
  "Music",
  "News",
  "Notes",
  "Photo Booth",
  "Photos",
  "Podcasts",
  "Preview",
  "QuickTime Player",
  "Reminders",
  "Safari",
  "Script Editor",
  "Stickies",
  "Stocks",
  "Storage Management",
  "System Information",
  "System Preferences",
  "TV",
  "TextEdit",
  "Voice Memos",
];

/** Census rows of the Go menu: Back, Forward, Applications and each launcher. */
export function goRows(slug) {
  return [
    R(
      `${slug}.menu.go.back`,
      "menu:Go",
      "menuitem",
      "Back",
      "choose after two places",
      "the previous place, or dimmed with nowhere to go back to",
    ),
    R(
      `${slug}.menu.go.forward`,
      "menu:Go",
      "menuitem",
      "Forward",
      "choose after Back",
      "the next place, or dimmed with nowhere to go forward to",
    ),
    R(
      `${slug}.menu.go.applications`,
      "menu:Go",
      "menuitem",
      "Applications",
      "hover",
      "the launcher submenu opens",
    ),
    ...GO_APPS.map((n) =>
      R(
        `${slug}.menu.go.app.${slugOf(n)}`,
        "menu:Go > Applications",
        "menuitem",
        n,
        `choose ${n}`,
        `${n} answers: a window of it opens or comes forward`,
      ),
    ),
  ];
}

/**
 * Chooses every launcher of Go > Applications with the pointer and checks that the app named answers: the menu bar's
 * application menu names it (About This Mac and Force Quit Applications open windows of those names; an app the person
 * has not got yet opens its App Store page, naming it). The windows it opened are closed with Control-Option-W (the
 * window manager's command) and the app under test brought back with `ensure()`.
 */
export async function goApplicationsChecks(
  page,
  check,
  slug,
  ensure,
  note = (t) => console.log(`note ${t}`),
) {
  await ensure();
  const sub = await menuItems(page, ["Go", "Applications"]);
  check(`${slug}.menu.go.applications`, sub.length >= GO_APPS.length, `${sub.length} launchers`);
  const appMenu = async () =>
    (
      (
        await page
          .getByRole("menubar")
          .first()
          .getByRole("menuitem")
          .allInnerTexts()
          .catch(() => [])
      )[1] ?? ""
    ).trim();
  const windowNamed = (name) =>
    page.locator('.mac-window[role="region"]').evaluateAll(
      (els, n) =>
        els.some((e) => {
          const id = e.getAttribute("aria-labelledby");
          const t = (
            (id && document.getElementById(id)?.textContent) ||
            e.getAttribute("aria-label") ||
            ""
          ).trim();
          return t === n;
        }),
      name,
    );
  for (const name of GO_APPS) {
    await ensure();
    const id =
      name === "Force Quit Applications" ? "force-quit" : name.toLowerCase().replace(/\s+/g, "-");
    const before = await page
      .locator('.mac-window[role="region"]')
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute("aria-labelledby") ?? e.getAttribute("aria-label")),
      );
    const chosen = await choose(page, ["Go", "Applications", name]).catch(() => false);
    let how = "";
    /** Records how the launcher answered, and answers it (truthy). */
    const answer = (text) => {
      how = text;
      return text;
    };
    const answered =
      chosen &&
      (await until(async () => {
        if (name === "About This Mac" || name === "Force Quit Applications") {
          if (await windowNamed(name)) return answer(`the ${name} window opened`);
        }
        const app = await appMenu();
        // The app's own window: the managed window's data-window-id is the app's id.
        const own = await page
          .locator(`[data-window-id="${id}"]`)
          .evaluateAll((els) =>
            els.map(
              (e) =>
                e.querySelector("[data-window-state]")?.getAttribute("data-window-state") ??
                e.getAttribute("data-window-state") ??
                "",
            ),
          );
        if (own.length > 0)
          return answer(
            `${name}'s window opened${own.includes("key") || app === name ? "" : ` inactive (the menu bar still names ${app})`}`,
          );
        if (app === name) return answer(`the menu bar names ${name}`);
        if (app === "App Store") {
          const key = page.locator('.mac-window[role="region"][data-window-state="key"]').first();
          const titled = await key
            .getByRole("heading", { name, exact: true })
            .count()
            .catch(() => 0);
          if (titled > 0)
            return answer(`${name} is not got yet: its App Store page opened (heading ${name})`);
        }
        return false;
      }, 8_000));
    check(
      `${slug}.menu.go.app.${slugOf(name)}`,
      !!answered,
      answered ? how : chosen ? `the menu bar names ${await appMenu()}` : "not chosen",
    );
    // A launched app may open a dialog (Keychain Access asks for a keychain password): dismiss it first.
    for (let i = 0; i < 3; i += 1) {
      if (
        (await page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').count()) === 0
      )
        break;
      await page.keyboard.press("Escape");
      await sleep(250);
    }
    await closeNew(page, before);
  }
  // After forty launches the menu bar must still answer; if it does not, that is reported and the desktop reloaded, so
  // that the sections after this one start from a clean desktop.
  await closeMenus(page);
  const top = (
    (
      await page
        .getByRole("menubar")
        .first()
        .getByRole("menuitem")
        .allInnerTexts()
        .catch(() => [])
    )[1] ?? "File"
  ).trim();
  const answers = await openMenu(page, top).then(
    () => true,
    () => false,
  );
  await closeMenus(page);
  if (!answers) {
    note(
      `PROBLEM after the Go > Applications launchers the menu bar's "${top}" menu no longer opens; the desktop is reloaded`,
    );
    await reload(page);
  }
}

/** Closes, with each window's own Close button, the windows that were not open in `before` (labels). */
async function closeNew(page, before) {
  for (let i = 0; i < 6; i += 1) {
    const labels = await page
      .locator('.mac-window[role="region"]')
      .evaluateAll(
        (els, b) =>
          els
            .map((e) => e.getAttribute("aria-labelledby") ?? e.getAttribute("aria-label"))
            .filter((l) => !b.includes(l)),
        before,
      );
    if (labels.length === 0) return;
    const l = labels[0];
    const w = page
      .locator(
        `.mac-window[role="region"][aria-labelledby="${l}"], .mac-window[role="region"][aria-label="${l}"]`,
      )
      .first();
    await w
      .getByRole("button", { name: "Close", exact: true })
      .first()
      .click({ timeout: 4_000 })
      .catch(() => {});
    await sleep(300);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The exploratory pass (brief section 5: seeded, recorded, at least 3 minutes per app per engine).

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLICKABLE =
  'button:not([disabled]), [role="button"]:not([aria-disabled="true"]), [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="treeitem"], [role="gridcell"], [role="row"], [role="slider"], [role^="menuitem"]:not([aria-disabled="true"]), a[href], input:not([disabled]), textarea, select, [contenteditable="true"]';
const NEVER = /^(Log Out|Shut Down|Restart|Sleep|Lock Screen|Force Quit|Delete Account|Erase)/i;

/**
 * Random real input for `seconds` inside `windows` (a locator of the app's windows) and the menus and dialogs they
 * open: clicks, typing, keys, drags, wheel, and the app's menu-bar menus. Every action and its seed are logged to
 * `${out}/explore-<app>-<engine>.log`. Each action runs under a 15 s watchdog and the page must then answer within 5 s;
 * a hang stops the pass (no action is left running beside another) and counts as unresponsive. `reopen()` brings the
 * app back when the pass closed or quit it. Answers { actions, unresponsive, log }.
 */
export async function explore(
  page,
  { app, windows, seconds, seed, out, browserName, reopen, menus = [], files = [] },
) {
  const rand = prng(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const log = path.join(
    out,
    `explore-${app.replace(/\W+/g, "-").toLowerCase()}-${browserName}.log`,
  );
  writeFileSync(log, `# ${app} exploratory pass in ${browserName}, seed ${seed}, ${seconds}s\n`);
  const say = (t) => appendFileSync(log, `${new Date().toISOString()} ${t}\n`);
  page.on("filechooser", async (chooser) => {
    const f = files.length ? pick(files) : null;
    say(`file chooser: ${f ? f.name : "cancelled"}`);
    await chooser.setFiles(f ? [f] : []).catch(() => {});
  });
  page.on("download", (d) => say(`download: ${d.suggestedFilename()}`));
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  const origin = new URL(page.url()).origin;
  const end = Date.now() + seconds * 1000;
  let actions = 0;
  let unresponsive = 0;
  // Every Playwright call of an action gives up after 4 s, so an action that takes longer than the 15 s watchdog is a
  // real hang of the page, not a click waiting for a covered element.
  page.setDefaultTimeout(4_000);
  const bounded = (promise, ms) =>
    Promise.race([
      promise.then(
        () => "done",
        (e) =>
          `error: ${String(e?.message ?? e)
            .split("\n")[0]
            .slice(0, 120)}`,
      ),
      sleep(ms).then(() => "timeout"),
    ]);
  while (Date.now() < end) {
    actions += 1;
    const r = rand();
    const outcome = await bounded(act(r), 15_000);
    if (outcome.startsWith("error")) say(`  action ${outcome}`);
    const alive =
      outcome !== "timeout" &&
      (await bounded(
        page.evaluate(() => 1),
        5_000,
      )) === "done";
    if (!alive) {
      unresponsive += 1;
      say(
        `UNRESPONSIVE: ${outcome === "timeout" ? "an action did not finish within 15 s" : "the page did not answer within 5 s"}; the pass stops`,
      );
      // A timed-out action cannot be cancelled, only isolated: close the page's context so that it can never send
      // further input. The exploratory pass is each suite's last step, so nothing reuses this page.
      say("closing the page's browser context");
      await bounded(page.context().close(), 10_000);
      return { actions, unresponsive, log, closed: true };
    }
    await sleep(60);
  }
  await bounded(page.keyboard.press("Escape"), 5_000);
  page.setDefaultTimeout(30_000);
  say(`done: ${actions} actions, ${unresponsive} unresponsive`);
  return { actions, unresponsive, log };

  async function act(r) {
    if (!page.url().startsWith(origin)) {
      say(`left the origin (${page.url()}): back`);
      await page.goBack({ waitUntil: "load" }).catch(() => page.goto(origin));
    }
    if ((await windows.count()) === 0) {
      say("no window of the app: reopen");
      await page.keyboard.press("Escape");
      await reopen();
      return;
    }
    if (r < 0.5) {
      const targets = page
        .locator(`[role="menu"]:visible, [role="dialog"]:visible, [role="alertdialog"]:visible`)
        .locator(CLICKABLE);
      const inWindows = windows.locator(CLICKABLE);
      const list = (await targets.count()) > 0 && rand() < 0.6 ? targets : inWindows;
      const n = await list.count();
      if (n > 0) {
        const el = list.nth(Math.floor(rand() * n));
        const label = (
          (await el.getAttribute("aria-label").catch(() => null)) ??
          (await el.innerText({ timeout: 1000 }).catch(() => ""))
        )
          .slice(0, 40)
          .replace(/\s+/g, " ");
        if (NEVER.test(label)) {
          say(`skip ${label}`);
          return;
        }
        say(
          `click ${await el.evaluate((e) => e.getAttribute("role") ?? e.tagName.toLowerCase()).catch(() => "?")} "${label}"`,
        );
        await el
          .click({ timeout: 2_000 })
          .catch((e) => say(`  not clickable: ${String(e.message).split("\n")[0].slice(0, 80)}`));
      }
    } else if (r < 0.62) {
      const text = pick([
        "hello",
        "42",
        "Ferrite",
        "a b c",
        "Ω",
        "x".repeat(30),
        "1+2",
        "..",
        "New",
      ]);
      say(`type ${JSON.stringify(text)}`);
      await page.keyboard.type(text, { delay: 10 });
    } else if (r < 0.77) {
      const key = pick([
        "Tab",
        "Enter",
        "Escape",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Backspace",
        "Space",
        "Delete",
        "Home",
        "End",
        "PageDown",
        "Meta+a",
        "Control+a",
        "Meta+z",
        "Meta+c",
        "Meta+v",
        "Meta+n",
        "Meta+i",
        "Meta+f",
      ]);
      say(`key ${key}`);
      await page.keyboard.press(key);
    } else if (r < 0.87 && menus.length) {
      const top = pick(menus);
      say(`menu ${top}`);
      const menu = await openMenu(page, top).catch(() => null);
      if (menu) {
        const items = menu.locator(
          '[role^="menuitem"]:not([aria-disabled="true"]):not([aria-haspopup])',
        );
        const n = await items.count();
        if (n > 0) {
          const el = items.nth(Math.floor(rand() * n));
          const label = (await el.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
          if (NEVER.test(label)) {
            say(`  skip ${label}`);
            await page.keyboard.press("Escape");
          } else {
            say(`  choose ${label}`);
            await el.click({ timeout: 2_000 }).catch(() => page.keyboard.press("Escape"));
          }
        } else await page.keyboard.press("Escape");
      }
    } else if (r < 0.95) {
      const box = await windows.first().boundingBox();
      if (box) {
        const a = { x: box.x + rand() * box.width, y: box.y + 30 + rand() * (box.height - 30) };
        const b = { x: box.x + rand() * box.width, y: box.y + 30 + rand() * (box.height - 30) };
        say(`drag ${Math.round(a.x)},${Math.round(a.y)} -> ${Math.round(b.x)},${Math.round(b.y)}`);
        await drag(page, a, b);
      }
    } else {
      const box = await windows.first().boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        const dy = Math.round((rand() - 0.5) * 600);
        say(`wheel ${dy}`);
        await page.mouse.wheel(0, dy);
      }
    }
  }
}
