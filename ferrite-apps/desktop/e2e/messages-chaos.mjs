#!/usr/bin/env node
// Messages under chaos: two browsers send messages through the Messages window
// while `ferrite dev --chaos <seconds>` kills the app every few seconds, and
// the script checks that every message arrives exactly once, in the room on
// the server and in both windows.
//
//   node scripts/pack-site.mjs && ferrite dev --chaos 8   # in ferrite-apps/desktop
//   node e2e/messages-chaos.mjs [--url http://127.0.0.1:8787] [--count 15] [--out e2e/output]
//                               [--browser chromium|chrome|firefox|webkit]
//
// Each browser sends --count messages, one every 0.8 to 1.6 seconds, in its own
// room for the run (`?room=`). A kill drops requests in flight and silences the
// live feeds: the window resends each message with its idempotency key until
// the server answers, and reopens a feed that falls silent. While the app is
// down the browser logs the failed requests (502, 503, 504 or a dropped
// connection) as console errors; those are expected here, so they are counted
// and listed but do not fail the run. A page error, a lost message or a
// duplicated one does.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_NAMES, ENGINES, signInAsGuest } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const base = option("--url", "http://127.0.0.1:8787").replace(/\/$/, "");
const count = Number(option("--count", "15"));
const out = path.resolve(option("--out", path.join(here, "output")));
mkdirSync(out, { recursive: true });

const room = `chaos-${Date.now().toString(36)}`;
/** How long the windows get, after the last send, to show every message. */
const SETTLE_MS = 90_000;

const problems = [];
const expected = { console: 0, http: 0, failed: 0 };
const steps = [];
function step(name, ok, detail = "") {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(name);
}

function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The browser's own line for a request the dying app did not answer.
    if (/Failed to load resource|ERR_|EventSource/.test(message.text())) expected.console += 1;
    else problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", () => {
    expected.failed += 1;
  });
  page.on("response", (response) => {
    if (response.status() >= 500) expected.http += 1;
    else if (response.status() >= 400)
      problems.push(`${label} HTTP ${response.status()}: ${response.url()}`);
  });
}

const windowOf = (page) => page.locator('[aria-label="Messages"]').first();
const transcript = (page) => windowOf(page).getByRole("log").first();

async function open(browser, label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watch(page, label);
  // The page itself may be asked for while the app is down: try again.
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(`${base}/?room=${room}`, { waitUntil: "load", timeout: 20_000 });
      await signInAsGuest(page);
      break;
    } catch (error) {
      if (attempt >= 5) throw error;
    }
  }
  await page
    .getByRole("button", { name: /^Messages$/ })
    .or(page.getByRole("link", { name: /^Messages$/ }))
    .first()
    .click();
  await transcript(page).waitFor({ state: "visible", timeout: 15_000 });
  return { context, page };
}

async function sendAll(page, label) {
  const field = windowOf(page).getByRole("textbox", { name: "Message" });
  for (let i = 1; i <= count; i++) {
    await field.click();
    await field.fill(`${label}-${i} (${room})`);
    await field.press("Enter");
    await page.waitForTimeout(800 + Math.floor(Math.random() * 800));
  }
}

const wanted = ["A", "B"].flatMap((label) =>
  Array.from({ length: count }, (_, i) => `${label}-${i + 1} (${room})`),
);
/** How many times each wanted text appears in `text`. */
const tally = (text) => wanted.map((needle) => text.split(needle).length - 1);

const browserName = option("--browser", "chromium");
if (!Object.hasOwn(ENGINES, browserName)) {
  console.error(`--browser must be one of ${ENGINE_NAMES.join(", ")}, not ${browserName}`);
  process.exit(2);
}
const browser = await ENGINES[browserName].launch();
const started = Date.now();
try {
  const a = await open(browser, "A");
  const b = await open(browser, "B");
  await Promise.all([sendAll(a.page, "A"), sendAll(b.page, "B")]);
  const sent = Date.now();
  console.log(`sent ${wanted.length} messages in ${Math.round((sent - started) / 1000)} s`);

  // Both windows settle on every message exactly once.
  const counts = { A: [], B: [] };
  const settled = async () => {
    for (const [label, page] of [
      ["A", a.page],
      ["B", b.page],
    ]) {
      counts[label] = tally(await transcript(page).innerText());
    }
    return [...counts.A, ...counts.B].every((n) => n === 1);
  };
  while (!(await settled()) && Date.now() - sent < SETTLE_MS) await a.page.waitForTimeout(500);
  for (const label of ["A", "B"]) {
    const lost = wanted.filter((_, i) => counts[label][i] === 0);
    const doubled = wanted.filter((_, i) => counts[label][i] > 1);
    step(
      `window ${label} shows all ${wanted.length} messages exactly once`,
      lost.length === 0 && doubled.length === 0,
      `missing ${lost.length}${lost.length ? `: ${lost.join(", ")}` : ""}; doubled ${doubled.length}${doubled.length ? `: ${doubled.join(", ")}` : ""}; settled ${Math.round((Date.now() - sent) / 1000)} s after the last send`,
    );
  }

  // The room on the server holds each message once.
  let stored = null;
  for (let attempt = 0; attempt < 20 && !stored; attempt++) {
    stored = await a.page.evaluate(async (url) => {
      try {
        const response = await fetch(url, { credentials: "same-origin" });
        return response.ok ? (await response.json()).state.messages : null;
      } catch {
        return null;
      }
    }, `/api/messages/rooms/${room}`);
    if (!stored) await a.page.waitForTimeout(1_000);
  }
  const texts = (stored ?? []).map((m) => m.text);
  const seqs = (stored ?? []).map((m) => m.seq);
  step(
    `the server's room holds ${wanted.length} messages, each once`,
    texts.length === wanted.length &&
      wanted.every((w) => texts.filter((t) => t === w).length === 1),
    `${texts.length} stored`,
  );
  step(
    "their numbers run 1, 2, 3… with no gap",
    seqs.every((seq, i) => seq === i + 1),
    `last ${seqs.at(-1)}`,
  );
  // Each browser's messages are stored in the order it sent them.
  for (const label of ["A", "B"]) {
    const order = texts
      .filter((t) => t.startsWith(`${label}-`))
      .map((t) => Number(t.slice(2).split(" ")[0]));
    step(
      `${label}'s messages are stored in the order sent`,
      order.every((n, i) => n === i + 1),
    );
  }
  await a.page.screenshot({ path: path.join(out, "chaos-a.png") });
  await b.page.screenshot({ path: path.join(out, "chaos-b.png") });
  await a.context.close();
  await b.context.close();
} catch (error) {
  problems.push(`run aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  await browser.close();
}

console.log(
  `expected noise while the app was down: ${expected.console} console lines, ${expected.http} HTTP 5xx, ${expected.failed} failed requests`,
);
console.log(`room ${room}; screenshots in ${out}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`\nall ${steps.length} checks passed: nothing lost, nothing duplicated`);
