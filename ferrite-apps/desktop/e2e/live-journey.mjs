#!/usr/bin/env node
// Two browsers, one desktop, under `ferrite dev`: a message sent in Messages in
// one browser appears in the other without a reload, and a chess move made in
// one appears on the other's board. Exits 0 only when every step passed and
// neither page logged a console error, a page error, a failed request or an
// HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/live-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                             [--browser chromium|chrome|firefox|webkit]
//
// Each run uses its own room and game (`?room=` and `?game=` in the page's
// address), so runs never meet each other's messages or seats. Needs
// Playwright's browser for the engine chosen (Chromium unless --browser names
// another; `npx playwright install chromium firefox webkit`).

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINES, signInAsGuest } from "./journey-kit.mjs";

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
const engine = ENGINES[engineName];
if (!engine) {
  console.error(`--browser must be one of ${Object.keys(ENGINES).join(", ")}`);
  process.exit(2);
}

const run = Date.now().toString(36);
const address = `${base}/?room=run-${run}&game=run-${run}`;
/** How long a change may take to reach the other browser. */
const LIVE_MS = 5_000;

const problems = [];
const steps = [];
function step(name, ok, detail = "") {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(name);
}

/** Collect every console error, page error, failed request and HTTP error of a page. */
function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`${label} console: ${message.text()}`);
    // Warnings do not fail the run, but are listed so that a new one is seen.
    if (message.type() === "warning") console.log(`warn ${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    // A live feed the page closes itself (a reload, the end of the run) is not a failure:
    // Chromium reports it as net::ERR_ABORTED, Firefox as NS_BINDING_ABORTED, WebKit as
    // cancelled.
    if (
      request.url().includes("/live/") &&
      /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(request.failure()?.errorText ?? "")
    )
      return;
    problems.push(`${label} request failed: ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      problems.push(`${label} HTTP ${response.status()}: ${response.url()}`);
  });
}

/** Open the desktop in a new browser and launch `app` from the Dock. */
async function launch(browser, label, app) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watch(page, label);
  // Not "networkidle": `ferrite dev` keeps its live-reload stream open, so the network
  // never goes quiet. The Dock answering is the desktop being ready.
  await page.goto(address, { waitUntil: "load" });
  await signInAsGuest(page);
  await openApp(page, app);
  // From here on, a navigation of the page is a reload: the live checks below must pass
  // without one.
  const reloads = { count: 0 };
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) reloads.count += 1;
  });
  return { context, page, reloads };
}

async function openApp(page, app) {
  const dock = page
    .getByRole("button", { name: new RegExp(`^${app}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${app}$`) }))
    .first();
  await dock.click();
}

const transcript = (page) => page.locator('[aria-label="Messages"]').getByRole("log").first();
const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);

/** Send `text` from the Messages window of `page`. */
async function send(page, text) {
  const field = page.locator('[aria-label="Messages"]').getByRole("textbox", { name: "Message" });
  await field.first().click();
  await field.first().fill(text);
  await field.first().press("Enter");
}

/** Wait until `check` holds, up to `ms`; how long it took, or null. */
async function within(ms, check) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await check()) return Date.now() - start;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

/** Save a screenshot; one that fails is listed but does not fail the run. */
async function shoot(page, name) {
  try {
    await page.screenshot({ path: path.join(out, `${name}-${engineName}.png`), timeout: 10_000 });
  } catch (error) {
    // WebKit on Linux waits for ever on a font face that failed to load (see
    // visual/harness/main.tsx), so its screenshots can time out.
    console.log(`warn screenshot ${name} not taken: ${String(error).split("\n")[0]}`);
  }
}

const browser = await engine.launch();
console.log(`engine: ${engineName} ${browser.version()}`);
try {
  // ── Messages ──
  const a = await launch(browser, "A", "Messages");
  const b = await launch(browser, "B", "Messages");
  for (const [label, { page }] of [
    ["A", a],
    ["B", b],
  ]) {
    await transcript(page).waitFor({ state: "visible", timeout: 10_000 });
    const room = page.locator('[aria-label="Messages"]').getByText("Ferrite Room").first();
    step(`${label}: Messages opens on the shared Ferrite Room`, await room.isVisible());
  }
  // Let both feeds deliver their first state before anything is sent.
  await within(3_000, async () => false);

  const hello = `Hello from A (${run})`;
  await send(a.page, hello);
  const seenByB = await within(LIVE_MS, async () =>
    (await transcript(b.page).innerText()).includes(hello),
  );
  step("a message sent in A appears in B without a reload", seenByB !== null, `${seenByB} ms`);

  const reply = `Hi A, B here (${run})`;
  await send(b.page, reply);
  const seenByA = await within(LIVE_MS, async () =>
    (await transcript(a.page).innerText()).includes(reply),
  );
  step("B's reply appears in A without a reload", seenByA !== null, `${seenByA} ms`);

  // Each message once, on both sides; A's own bubble is a sent one, B's a received one.
  for (const [label, page] of [
    ["A", a.page],
    ["B", b.page],
  ]) {
    const text = await transcript(page).innerText();
    const count = (needle) => text.split(needle).length - 1;
    step(
      `${label} shows each message exactly once`,
      count(hello) === 1 && count(reply) === 1,
      `hello ${count(hello)}, reply ${count(reply)}`,
    );
  }
  const sentInA = a.page
    .locator('[aria-label="Messages"] [data-direction="sent"]')
    .filter({ hasText: hello });
  const receivedInB = b.page
    .locator('[aria-label="Messages"] [data-direction="received"]')
    .filter({ hasText: hello });
  step(
    "A's message is a sent bubble in A and a received one in B",
    (await sentInA.count()) === 1 && (await receivedInB.count()) === 1,
  );
  await shoot(a.page, "messages-a");
  await shoot(b.page, "messages-b");

  // ── Chess ──
  for (const { page } of [a, b]) {
    await openApp(page, "Chess");
    await board(page).waitFor({ state: "visible", timeout: 10_000 });
  }
  await within(3_000, async () => false);
  const label = async (page, name) => (await square(page, name).getAttribute("aria-label")) ?? "";

  await square(a.page, "e2").click();
  await square(a.page, "e4").click();
  const e4InB = await within(LIVE_MS, async () =>
    (await label(b.page, "e4")).includes("white pawn"),
  );
  step("White's e2-e4 in A appears on B's board", e4InB !== null, `${e4InB} ms`);
  step("B's e2 is empty after it", (await label(b.page, "e2")) === "e2");

  await square(b.page, "e7").click();
  await square(b.page, "e5").click();
  const e5InA = await within(LIVE_MS, async () =>
    (await label(a.page, "e5")).includes("black pawn"),
  );
  step("Black's e7-e5 in B appears on A's board", e5InA !== null, `${e5InA} ms`);

  // Each browser now holds a side: the titles say who plays which.
  const titleOf = async (page) =>
    (await page.locator(".mac-chess-title").first().innerText()).replace(/\s+/g, " ").trim();
  const titleA = await titleOf(a.page);
  const titleB = await titleOf(b.page);
  step(
    "A plays White and B plays Black",
    titleA.startsWith("You - Opponent") && titleB.startsWith("Opponent - You"),
    `A "${titleA}", B "${titleB}"`,
  );
  // B may not move White: the board refuses, and both boards stay as they were.
  await square(b.page, "g1").click();
  await square(b.page, "f3").click();
  await within(1_500, async () => false);
  step(
    "B cannot move White's knight",
    (await label(a.page, "g1")).includes("white knight") &&
      (await label(b.page, "g1")).includes("white knight"),
  );
  await shoot(a.page, "chess-a");
  await shoot(b.page, "chess-b");
  step(
    "neither page reloaded during the live checks",
    a.reloads.count === 0 && b.reloads.count === 0,
    `A ${a.reloads.count}, B ${b.reloads.count}`,
  );

  await a.context.close();
  await b.context.close();
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
