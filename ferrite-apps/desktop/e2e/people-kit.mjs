// Shared steps of the two-person journeys (facetime-journey.mjs, chess-journey.mjs): options,
// a step log, a watch on every console error, page error, failed request and HTTP error of each
// person's page, a fresh account per person made at the login window, and opening an app from
// the Dock. Each person has a browser context of their own in one engine.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, engineFamily } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** `--url` (default http://127.0.0.1:8787), `--out` (default e2e/output), `--browser`. */
export function options() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
  };
  const base = option("--url", "http://127.0.0.1:8787").replace(/\/$/, "");
  const out = path.resolve(option("--out", path.join(here, "output")));
  mkdirSync(out, { recursive: true });
  const browserName = option("--browser", "chromium");
  if (!Object.hasOwn(ENGINES, browserName)) {
    console.error(`--browser must be one of ${Object.keys(ENGINES).join(", ")}`);
    process.exit(2);
  }
  return { base, out, browserName, engine: ENGINES[browserName] };
}

/**
 * A journey of two people: `step` records a check; `run(launchOptions, contextOptions, body)`
 * launches the engine, hands `body` a `person(label)` that opens a signed-up desktop, and exits 0
 * only when every step passed and no page logged a problem. `allow(pattern)` lets a failed
 * request or HTTP error whose text matches pass (a refusal a step provokes on purpose).
 */
export function twoPeople(name) {
  const { base, out, browserName, engine } = options();
  const problems = [];
  const steps = [];
  const allowed = [];
  const step = (label, ok, detail = "") => {
    steps.push(label);
    console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
    if (!ok) problems.push(label);
    return ok;
  };
  const allow = (pattern) => allowed.push(pattern);
  // A second writer of the person's settings got in first (`document.rs`): the shared save client takes the 409 and merges
  // onto the newer copy.
  allow(/HTTP 409: \S*\/api\/system-preferences\/settings/);
  allow(/console: Failed to load resource: the server responded with a status of 409/);
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
      // Live feeds and the dev server's reload stream closed by the page itself (Firefox names
      // an EventSource the page closes NS_ERROR_ABORT).
      if (/ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(text)) return;
      problem(`${label} request failed: ${request.url()} ${text}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        problem(`${label} HTTP ${response.status()}: ${response.url()}`);
    });
  };
  const run = async (launchOptions, contextOptions, body) => {
    console.log(`${name} in ${browserName}`);
    const browser = await engine.launch(launchOptions[engineFamily(browserName)] ?? {});
    console.log(`engine: ${browserName} ${browser.version()}`);
    const contexts = [];
    const person = async (label, account) => {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        ...(contextOptions[engineFamily(browserName)] ?? {}),
      });
      contexts.push(context);
      const page = await context.newPage();
      watch(page, label);
      await page.goto(`${base}/`, { waitUntil: "load" });
      await createAccount(page, account);
      return page;
    };
    try {
      await body({ person, base });
    } catch (error) {
      problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
    } finally {
      for (const context of contexts) await context.close().catch(() => {});
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
  };
  /** Save a screenshot as evidence; a WebKit font wait that times out is only a warning. */
  const shot = async (page, file) => {
    try {
      await page.screenshot({
        path: path.join(out, `${file}-${browserName}.png`),
        // WebKit here waits for ever on a font face (see app-journey.mjs): do not stall the run.
        timeout: browserName === "webkit" ? 3_000 : 15_000,
      });
    } catch (error) {
      console.log(`warn screenshot ${file} not saved: ${String(error.message).split("\n")[0]}`);
    }
  };
  return { step, allow, run, shot, browserName };
}

/** Make the account at the login window's Create Account… form; resolves on its desktop. */
export async function createAccount(page, { name, fullName, password }) {
  const users = page.getByRole("group", { name: "Users" });
  await users.waitFor({ timeout: 20_000 });
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

/** Click an app's Dock tile and wait for its window, a region named `windowName`. */
export async function openFromDock(page, appName, windowName = appName) {
  await page
    .getByRole("button", { name: new RegExp(`^${appName}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${appName}$`) }))
    .first()
    .click();
  const window = page.getByRole("region", { name: windowName }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  return window;
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}
