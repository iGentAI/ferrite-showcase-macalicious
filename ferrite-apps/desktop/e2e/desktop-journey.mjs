#!/usr/bin/env node
// The desktop journey under `ferrite dev`: open the desktop, launch Calculator
// from the Dock, compute 12 + 3, record the result on the session's paper tape
// through /api/calculator/tape, and show that two browser contexts hold two
// separate sessions. Exits 0 only when every step passed and the page logged
// no console error, page error or failed request.
//
//   ferrite dev                                   # in ferrite-apps/desktop
//   node e2e/desktop-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                [--browser chromium|chrome|firefox|webkit]
//
// Needs Playwright's browser for the engine chosen (Chromium unless --browser
// names another; `npx playwright install chromium firefox webkit` in the
// repository root, or PLAYWRIGHT_BROWSERS_PATH pointing at installed ones).

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const base = option("--url", "http://127.0.0.1:8787").replace(/\/$/, "");
const out = path.resolve(option("--out", path.join(here, "output")));
mkdirSync(out, { recursive: true });
const engineName = option("--browser", "chromium");
const engine = Object.hasOwn(ENGINES, engineName) ? ENGINES[engineName] : undefined;
if (!engine) {
  console.error(`--browser must be one of ${Object.keys(ENGINES).join(", ")}`);
  process.exit(2);
}

const problems = [];
const steps = [];
function step(name, ok, detail = "") {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(name);
}

/** Collect every console error, page error and failed request of a page. */
function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    // `ferrite dev`'s live-reload stream and the desktop's own live streams (`/live/`: the
    // person's notifications), closed by the page itself on a reload or at the end of the run,
    // are not failures, as `journey-kit.mjs` has it: Firefox reports them as NS_BINDING_ABORTED
    // (or NS_ERROR_ABORT for a stream the page closes), WebKit as "Load request cancelled".
    const url = request.url();
    if (
      (url.includes("/__forge/reload") || new URL(url).pathname.startsWith("/live/")) &&
      /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(
        request.failure()?.errorText ?? "",
      )
    )
      return;
    problems.push(`${label} request failed: ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      problems.push(`${label} HTTP ${response.status()}: ${response.url()}`);
  });
}

/** `fetch` from inside the page, so the browser's own cookies and headers apply. */
function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const headers = body ? { "content-type": "application/json" } : {};
      // Writes carry the browser's own random key, so a resend is recognised.
      if (method === "POST") headers["idempotency-key"] = crypto.randomUUID();
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, json: await response.json() };
    },
    { method, url, body },
  );
}

/**
 * Save a screenshot as evidence. It is not a check: WebKit can leave `document.fonts` loading for
 * good (the library's "Mac System Fallback" face fails there), and Playwright's screenshot waits
 * for fonts, so a timeout is reported as a warning rather than aborting the journey.
 */
async function shot(page, name) {
  try {
    await page.screenshot({ path: path.join(out, name), timeout: 15_000 });
  } catch (error) {
    console.log(`warn screenshot ${name} not saved: ${String(error.message).split("\n")[0]}`);
  }
}

const browser = await engine.launch();
try {
  const viewport = { width: 1440, height: 900 };
  const contextA = await browser.newContext({ viewport });
  const page = await contextA.newPage();
  watch(page, "A");

  await openDesktop(page, base);
  const marker = await api(page, "GET", "/ferrite-site.json");
  step(
    "the desktop is served from the site blob the app published",
    marker.status === 200 && marker.json.files > 1,
    `${marker.json.files} files, build ${String(marker.json.build_id).slice(0, 19)}`,
  );
  // Google Chrome asks for /favicon.ico when a page declares no icon, which the site does not serve: a
  // 404 and a console error on every desktop page in Chrome. The page declares its icon, inline.
  const icon = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="icon"]');
    if (!(link instanceof HTMLLinkElement)) return { href: null, status: 0, type: "" };
    const response = await fetch(link.href, { credentials: "same-origin" });
    return {
      href: link.href.slice(0, 32),
      status: response.status,
      type: response.headers.get("content-type") ?? "",
    };
  });
  step(
    "the page declares its icon, and the icon loads",
    icon.status === 200 && icon.type.startsWith("image/"),
    `${icon.href ?? "no icon link"}…: HTTP ${icon.status} ${icon.type}`,
  );
  // Any other document the site serves (a JSON reply, a file opened in a tab) declares no icon, and Chrome asks the
  // site for /favicon.ico: the site answers it with the same icon the page declares.
  const favicon = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="icon"]');
    const response = await fetch("/favicon.ico", { credentials: "same-origin" });
    const served = new Uint8Array(await response.arrayBuffer());
    const declared =
      link instanceof HTMLLinkElement
        ? new Uint8Array(await (await fetch(link.href)).arrayBuffer())
        : new Uint8Array();
    return {
      status: response.status,
      type: response.headers.get("content-type") ?? "",
      size: served.length,
      same:
        served.length > 0 &&
        served.length === declared.length &&
        served.every((b, i) => b === declared[i]),
    };
  });
  step(
    "the site answers /favicon.ico with the page's own icon",
    favicon.status === 200 && favicon.type === "image/png" && favicon.same,
    `HTTP ${favicon.status} ${favicon.type}, ${favicon.size} bytes${favicon.same ? ", the page's icon" : ""}`,
  );
  await page.waitForTimeout(1000);
  await shot(page, "desktop.png");

  const dockItem = page
    .getByRole("button", { name: /^Calculator$/ })
    .or(page.getByRole("link", { name: /^Calculator$/ }))
    .first();
  step("the Dock has a Calculator item", (await dockItem.count()) > 0);
  await dockItem.click();
  const calculator = page
    .locator('[aria-label="Calculator"]')
    .filter({ has: page.locator('[aria-label="Result"]') });
  await calculator.first().waitFor({ state: "visible", timeout: 10_000 });
  step("Calculator opens from the Dock", await calculator.first().isVisible());

  const display = calculator.first().locator('[aria-label="Result"]');
  await display.click();
  for (const key of ["Escape", "1", "2", "+", "3", "="]) await page.keyboard.press(key);
  await page.waitForTimeout(300);
  const shown = (await display.innerText()).trim();
  step("12 + 3 = shows 15", shown === "15", `display reads "${shown}"`);
  await shot(page, "calculator.png");

  // The Calculator module: this session's paper tape.
  const session = await api(page, "GET", "/api/session");
  step(
    "browser A has a session",
    session.status === 200 && /^[0-9a-f]{64}$/.test(session.json.session),
  );
  const added = await api(page, "POST", "/api/calculator/tape", {
    expression: "12+3",
    result: shown,
  });
  step("the result is recorded on A's tape", added.status === 201, `HTTP ${added.status}`);
  const tapeA = await api(page, "GET", "/api/calculator/tape");
  const lastA = tapeA.json.entries?.at(-1);
  step("A's tape ends with 12+3 = 15", lastA?.expression === "12+3" && lastA?.result === "15");

  // A reload keeps the session (the cookie persists).
  await reloadDesktop(page);
  const again = await api(page, "GET", "/api/session");
  step(
    "a reload keeps A's session",
    again.json.session === session.json.session && again.json.new === false,
  );

  // A second browser context is a second browser: a separate session and tape.
  const contextB = await browser.newContext({ viewport });
  const pageB = await contextB.newPage();
  watch(pageB, "B");
  await openDesktop(pageB, base);
  const sessionB = await api(pageB, "GET", "/api/session");
  step(
    "browser B gets a different session",
    sessionB.status === 200 && sessionB.json.session !== session.json.session,
    `A ${session.json.session.slice(0, 12)}…, B ${String(sessionB.json.session).slice(0, 12)}…`,
  );
  const tapeB = await api(pageB, "GET", "/api/calculator/tape");
  step(
    "B's tape holds none of A's entries",
    Array.isArray(tapeB.json.entries) && tapeB.json.entries.length === 0,
  );
  // All of the context's cookies: `cookies(url)` leaves out Secure cookies for
  // an http:// URL, although the browser stores and sends them on localhost.
  const cookies = await contextA.cookies();
  const cookie = cookies.find((c) => c.name === "mac_session");
  step(
    "the session cookie is HttpOnly and SameSite=Lax",
    cookie?.httpOnly === true && cookie?.sameSite === "Lax",
  );

  // Leave A's tape as it was found, so reruns start clean.
  await api(page, "DELETE", "/api/calculator/tape");
  await contextB.close();
  await contextA.close();
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  await browser.close();
}

console.log(`screenshots in ${out}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`\nall ${steps.length} steps passed with no console errors`);
