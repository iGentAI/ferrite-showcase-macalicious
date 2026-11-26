// Shared steps of the app journeys under `ferrite dev` (calendar-journey.mjs,
// contacts-journey.mjs, system-preferences-journey.mjs): options, a step log,
// a watch for console errors and failed requests, same-origin fetches from
// the page, and opening an app from the Dock.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Google Chrome stable through Playwright's `chrome` channel (`npx playwright install chrome`): Chromium's
 * browser type launched with `channel: "chrome"`, so every launch option a runner gives Chromium applies to
 * Chrome too, and the channel always wins.
 */
const chrome = {
  /**
   * @param {import("playwright").LaunchOptions} [launchOptions]
   * @returns {Promise<import("playwright").Browser>}
   */
  launch: (launchOptions = {}) => chromium.launch({ ...launchOptions, channel: "chrome" }),
};

/**
 * The engines `--browser` names: Playwright's own Chromium build, Google Chrome stable, Firefox and WebKit.
 * Every runner takes its engine from here (`ENGINES[browserName].launch(...)`), so each one takes all four.
 */
export const ENGINES = Object.freeze({ chromium, chrome, firefox, webkit });

/** The names `--browser` takes, in the order the runners use them. */
export const ENGINE_NAMES = Object.freeze(Object.keys(ENGINES));

/**
 * The engine family of a `--browser` name: Chrome is a Chromium, so what a runner keys by engine for Chromium
 * (launch and context options, a permission only Chromium grants) applies to Chrome as well. Undefined for a
 * name `--browser` does not take.
 * @param {string} name
 * @returns {"chromium" | "firefox" | "webkit" | undefined}
 */
export function engineFamily(name) {
  if (!Object.hasOwn(ENGINES, name)) return undefined;
  return name === "chrome" ? "chromium" : name;
}

/**
 * Whether a download's suggested file name (`download.suggestedFilename()`) is the name the page gave the file, as
 * the engine `--browser` names reports it. Playwright 1.64.1's WebKit 27.2 (webkit-2370) reports every download
 * name with each space turned into an underscore, however the page names the file: the `download` attribute on a
 * blob, data or same-origin URL, or a `Content-Disposition` `filename` or `filename*`. WebKit 26.6 and every
 * Chromium, Chrome and Firefox build keep the spaces. So in WebKit that name with its spaces as underscores is the
 * same name; any other difference, in any engine, is not. test/download-names.browser.test.ts holds every engine
 * to this.
 * @param {string} actual the name the engine reports
 * @param {string} expected the name the page gave the file
 * @param {string} browserName the `--browser` name
 * @returns {boolean}
 */
export function sameDownloadName(actual, expected, browserName) {
  if (actual === expected) return true;
  return engineFamily(browserName) === "webkit" && actual === expected.replaceAll(" ", "_");
}

/** `--url`, `--out` and `--browser` (chromium, chrome, firefox or webkit; Chromium by default) from the command line. */
export function options() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
  };
  const out = path.resolve(option("--out", path.join(here, "output")));
  mkdirSync(out, { recursive: true });
  const browserName = option("--browser", "chromium");
  if (!Object.hasOwn(ENGINES, browserName)) {
    console.error(`--browser must be one of ${ENGINE_NAMES.join(", ")}, not ${browserName}`);
    process.exit(2);
  }
  return { base: option("--url", "http://127.0.0.1:8787").replace(/\/$/, ""), out, browserName };
}

/** The pages being reloaded or closed by the journey now. */
const reloading = new WeakSet();
const CANCELLED = /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i;
const refusedFetchLines = new WeakMap();
const cutOffReads = new WeakMap();
const heldFetchLines = new WeakMap();

/** The page is being reloaded or closed, which cuts off the read: a write still counts. */
export const cutOffByReload = (page, request) => {
  if (!reloading.has(page) || request.method() !== "GET") return false;
  if (!CANCELLED.test(request.failure()?.errorText ?? "")) return false;
  if (!cutOffReads.has(page)) cutOffReads.set(page, []);
  const { host, pathname, search } = new URL(request.url());
  cutOffReads.get(page).push(`${host}${pathname}${search}`);
  return true;
};

/** Marks the page as being closed by the journey, as `reloadDesktop` marks a reload. */
export const closingPage = (page) => reloading.add(page);

/**
 * A page error that may be only WebKit's log line for a fetch the reload cut off: "Fetch API cannot
 * load <url> due to access control checks." WebKit logs it as a JavaScript error, and Playwright
 * reports those as page errors, cut at the URL's colon. No exception was thrown. It is held until
 * `unprovenFetchLines`, because the line and the failed request come in either order.
 */
export const cancelledFetchLine = (page, error) => {
  if (!reloading.has(page) || !/due to access control checks/.test(error.message)) return false;
  if (!heldFetchLines.has(page)) heldFetchLines.set(page, []);
  heldFetchLines.get(page).push(error.message);
  return true;
};

/**
 * Ends one reload or close: its held lines are judged against its own cut-off reads only, and each
 * read excuses one line, so a new page's refusal of an address the reload also cut off still fails.
 */
function judgeFetchLines(page) {
  const reads = cutOffReads.get(page) ?? [];
  const unproven = (heldFetchLines.get(page) ?? []).filter((line) => {
    // The word before the phrase: the URL, whole or as Playwright cut it.
    const address = /(\S+) due to access control checks/.exec(line)?.[1] ?? "";
    const read = reads.indexOf(address.replace(/^(?:https?:\/\/|\/+)/, ""));
    if (read < 0) return true;
    reads.splice(read, 1);
    return false;
  });
  cutOffReads.delete(page);
  heldFetchLines.delete(page);
  refusedFetchLines.set(page, [...(refusedFetchLines.get(page) ?? []), ...unproven]);
}

/** The held lines naming no read their reload cut off: a real refusal, which fails the journey. */
export const unprovenFetchLines = (page) => {
  judgeFetchLines(page);
  return refusedFetchLines.get(page) ?? [];
};

/**
 * Runs `body(kit)` in a fresh browser of the engine `--browser` names (Chromium by default) and exits 0 only when every step passed and no page
 * logged a console error, a page error, a failed request or an HTTP error status.
 */
export async function journey(name, body) {
  const problems = [];
  const steps = [];
  const step = (title, ok, detail = "") => {
    steps.push(title);
    console.log(`${ok ? "ok  " : "FAIL"} ${title}${detail ? ` (${detail})` : ""}`);
    if (!ok) problems.push(title);
  };
  const watch = (page) => {
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => {
      if (!cancelledFetchLine(page, error)) problems.push(`page error: ${error.message}`);
    });
    page.on("requestfailed", (request) => {
      // `ferrite dev`'s live-reload stream and the desktop's own live streams (`/live/`: the
      // person's notifications, a Messages room), closed by the page on a reload or at the end of
      // the run, are not failures of the app (Firefox: NS_BINDING_ABORTED, WebKit: cancelled).
      const url = request.url();
      // Asked first: every read the reload cut off is evidence for WebKit's log line, whichever
      // rule below excuses it.
      const cutOff = cutOffByReload(page, request);
      if (
        (url.includes("/__forge/reload") ||
          new URL(url).pathname.startsWith("/live/") ||
          // A read the page had under way when the journey reloaded it; a write still counts.
          cutOff) &&
        CANCELLED.test(request.failure()?.errorText ?? "")
      )
        return;
      problems.push(`request failed: ${url} ${request.failure()?.errorText}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
    });
  };
  const { base, out, browserName } = options();
  const browser = await ENGINES[browserName].launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    watch(page);
    await body({ page, base, out, step });
    // Closing cuts off a read still on its way, as a reload does; a write still counts.
    closingPage(page);
    await context.close();
    for (const line of unprovenFetchLines(page)) problems.push(`page error: ${line}`);
  } catch (error) {
    problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
  } finally {
    await browser.close();
  }
  console.log(`screenshots in ${out}`);
  if (problems.length > 0) {
    console.error(
      `\n${name}: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log(`\n${name}: all ${steps.length} steps passed with no console errors`);
}

/** `fetch` from inside the page, so the browser's own cookie and headers apply. */
export function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, json: await response.json() };
    },
    { method, url, body },
  );
}

/**
 * Load the desktop and wait until its Dock answers. Not "networkidle": `ferrite dev` keeps its
 * live-reload stream (`/__forge/reload`) open on every page, so the network never goes quiet.
 * The desktop opens on its login window; the journey signs in as Guest User, so every journey,
 * and every browser in one, has a desktop and data of its own.
 */
export async function openDesktop(page, base) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await signInAsGuest(page);
  await desktopReady(page);
}

/**
 * Choose Guest User when the login window shows (a fresh browser); a browser already signed in
 * goes straight to its desktop. Resolves once one of the two was there.
 */
export async function signInAsGuest(page) {
  const finder = page.getByRole("button", { name: /^Finder$/ }).first();
  const guest = page.getByRole("button", { name: /^Guest User$/ }).first();
  await finder.or(guest).first().waitFor({ timeout: 40_000 });
  if (await guest.isVisible()) await guest.click();
}

/** Reload the desktop and wait until its Dock answers, as `openDesktop` does. */
export async function reloadDesktop(page) {
  reloading.add(page);
  await page.reload({ waitUntil: "load" });
  reloading.delete(page);
  judgeFetchLines(page);
  await desktopReady(page);
}

async function desktopReady(page) {
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 40_000 });
}

/** Click the app's Dock item and wait for its window, a region named `windowName`. */
export async function openFromDock(page, appName, windowName = appName) {
  const item = page
    .getByRole("button", { name: new RegExp(`^${appName}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${appName}$`) }))
    .first();
  await item.click();
  const window = page.getByRole("region", { name: windowName }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  return window;
}

/** Resolves with the next `PUT` to `url` that the page sends and the server answers. */
export function nextSave(page, url, accept = () => true) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === url &&
      accept(JSON.parse(response.request().postData() ?? "null")),
    { timeout: 10_000 },
  );
}
