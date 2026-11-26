#!/usr/bin/env node
// Round 3, R7 bundle 04: QuickTime Player controls that did nothing. The Open panel's search now
// narrows the list of movies; the controller's Share services (which had no action) are dimmed,
// each with its reason as its title; and AirPlay, where the browser's own picker finds no screen,
// dims saying so instead of doing nothing. Real input against a served `ferrite dev`, signed up as
// an account of its own; QuickTime Player is got from the App Store first. One ok/FAIL line per
// step, exit 1 on any failure.
//
//   node e2e/quicktime-controls-journey.mjs --url http://127.0.0.1:8080 \
//        --browser chromium|chrome|firefox|webkit [--out <dir>]

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_NAMES, ENGINES } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
};
const base = option("--url", "http://127.0.0.1:8080").replace(/\/$/, "");
const browserName = option("--browser", "chromium");
if (!ENGINE_NAMES.includes(browserName)) {
  console.error(`--browser must be one of ${ENGINE_NAMES.join(", ")}, not ${browserName}`);
  process.exit(2);
}
const out = path.resolve(option("--out", path.join("e2e", "output", "quicktime-controls")));
mkdirSync(out, { recursive: true });

let failures = 0;
const step = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
};
const until = async (check, timeout = 5_000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
};

const browser = await ENGINES[browserName].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
context.setDefaultTimeout(15_000);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const finder = page.getByRole("button", { name: /^Finder$/ }).first();
const qt = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
const dimmed = async (control) =>
  (await control.getAttribute("aria-disabled")) === "true" || (await control.isDisabled());

/** The login window's Create Account… form, filled in by keyboard. */
async function signUp() {
  const run = Date.now().toString(36);
  const tile = (name) =>
    page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
  await page.goto(`${base}/`, { waitUntil: "load" });
  await tile("Create Account…").click({ timeout: 30_000 });
  const form = page.getByRole("form", { name: "Create Account" });
  await form.getByLabel("Full Name:").fill(`Controls ${run}`);
  await form.getByLabel("Account Name:").fill(`controls-${run}`);
  await form.getByLabel("Password:").fill(`pw-${run}-controls`);
  await form.getByLabel("Verify:").fill(`pw-${run}-controls`);
  const answer = page.waitForResponse((each) => new URL(each.url()).pathname.endsWith("/sign-up"));
  await form.getByRole("button", { name: "Create Account" }).click();
  const signedUp = await answer;
  if (!signedUp.ok()) {
    throw new Error(
      `this site refused the new account: sign-up answered HTTP ${signedUp.status()}`,
    );
  }
  await finder.waitFor({ timeout: 30_000 });
}

/** QuickTime Player from the App Store: Get, Install, then the store's Open. */
async function getQuickTime() {
  await page
    .getByRole("button", { name: /^App Store$/ })
    .first()
    .click();
  const store = page
    .locator(".mac-window")
    .filter({ has: page.getByRole("heading", { name: "Get More Apps" }) })
    .first();
  await store.waitFor({ timeout: 20_000 });
  await store.getByRole("button", { name: "Get, QuickTime Player" }).click();
  await store.getByRole("button", { name: "Install, QuickTime Player" }).click();
  await store.getByRole("button", { name: "Open, QuickTime Player" }).click({ timeout: 30_000 });
  await qt.waitFor({ state: "visible", timeout: 20_000 });
}

/** Wake the movie's controller with a real move over the picture. */
async function wake() {
  const b = await qt.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.move(b.x + b.width / 2 + 20, b.y + b.height / 2 + 10, { steps: 3 });
}

try {
  await signUp();
  await getQuickTime();
  // A movie from the computer (it is kept in Movies on the drive), then back to the Open panel.
  const chooser = page.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await chooser).setFiles(path.join(here, "fixtures", "test-pattern.webm"));
  await until(
    async () =>
      (await qt
        .locator("video")
        .evaluate((v) => v.readyState)
        .catch(() => 0)) >= 2,
    30_000,
  );
  // Back to the Open panel: File > Open File… in the menu bar.
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "File", exact: true })
    .click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Open File…", exact: true }).click();
  const search = qt.getByRole("searchbox", { name: "Search" }).first();
  await search.waitFor();
  const movie = qt.getByRole("option", { name: /test-pattern/ });
  await until(async () => (await movie.count()) > 0, 10_000);
  await search.fill("pattern");
  const kept = await until(async () => (await movie.count()) > 0);
  await search.fill("nothing-by-this-name");
  const narrowed = await until(async () => (await movie.count()) === 0);
  const said = narrowed && /No movie matches/.test(await qt.innerText());
  step(
    "the Open panel's search narrows the list: a matching word keeps the movie, another leaves none and says so",
    kept && narrowed && said,
    `kept ${kept}, narrowed ${narrowed}, said ${said}`,
  );
  await search.fill("");
  await until(async () => (await movie.count()) > 0);
  await movie.first().dblclick();
  await until(
    async () =>
      (await qt
        .locator("video")
        .evaluate((v) => v.readyState)
        .catch(() => 0)) >= 2,
    30_000,
  );

  // Share: every service is dimmed, its reason as its title.
  await wake();
  await qt.getByRole("button", { name: "Share" }).first().click();
  const menu = page.getByRole("menu").last();
  await menu.waitFor();
  const services = [];
  for (const service of ["Mail", "Messages", "AirDrop", "Notes"]) {
    const item = menu.getByRole("menuitem", { name: service }).first();
    const reason = ((await item.getAttribute("title")) ?? "").trim();
    services.push({
      service,
      dimmed: (await item.getAttribute("aria-disabled")) === "true",
      reason,
    });
  }
  await page.keyboard.press("Escape");
  step(
    "Share's Mail, Messages, AirDrop and Notes are dimmed, each saying why",
    services.every((s) => s.dimmed && s.reason.length > 0),
    services.map((s) => `${s.service}: ${s.dimmed ? s.reason : "enabled"}`).join("; "),
  );

  // AirPlay: dimmed with the reason where the browser has no picker; where it has one, a picker
  // that finds no screen leaves the button dimmed, saying so (it did nothing before).
  await wake();
  const airplay = qt.getByRole("button", { name: "AirPlay" }).first();
  let how = "dimmed from the start";
  if (!(await dimmed(airplay))) {
    how = "dimmed after the picker";
    await airplay.click();
    await until(() => dimmed(airplay), 5_000);
  }
  const reason = ((await airplay.getAttribute("title")) ?? "").trim();
  step(
    "AirPlay is dimmed, saying why the movie cannot go to another screen",
    (await dimmed(airplay)) && reason.length > 0,
    `${how}: "${reason}"`,
  );
  step("no page error", errors.length === 0, errors.join(" | ").slice(0, 300));
} catch (error) {
  step("journey ran to the end", false, String(error).split("\n")[0]);
} finally {
  await page
    .screenshot({ path: path.join(out, `quicktime-controls-${browserName}.png`) })
    .catch(() => {});
  await browser.close();
}
console.log(`\nquicktime-controls ${browserName}: ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
