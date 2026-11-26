#!/usr/bin/env node
// Round 3, R7 bundle 03: QuickTime Player's Open panel goes Back and Forward through the places
// the person visited. Before the fix QuickTime never gave the shared Open panel a history of
// places, so Back and Forward stayed dimmed whatever the person did. Real input against a served
// `ferrite dev`, signed up as an account of its own; QuickTime Player is got from the App Store
// first (a new account does not have it). One ok/FAIL line per step, exit 1 on any failure.
//
//   node e2e/quicktime-open-history-journey.mjs --url http://127.0.0.1:8080 \
//        --browser chromium|chrome|firefox|webkit [--out <dir>]

import { mkdirSync } from "node:fs";
import path from "node:path";
import { ENGINE_NAMES, ENGINES } from "./journey-kit.mjs";

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
const out = path.resolve(option("--out", path.join("e2e", "output", "quicktime-open-history")));
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
const panel = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();

/** The login window's Create Account… form, filled in by keyboard. */
async function signUp() {
  const run = Date.now().toString(36);
  const tile = (name) =>
    page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
  await page.goto(`${base}/`, { waitUntil: "load" });
  await tile("Create Account…").click({ timeout: 30_000 });
  const form = page.getByRole("form", { name: "Create Account" });
  await form.getByLabel("Full Name:").fill(`History ${run}`);
  await form.getByLabel("Account Name:").fill(`history-${run}`);
  await form.getByLabel("Password:").fill(`pw-${run}-history`);
  await form.getByLabel("Verify:").fill(`pw-${run}-history`);
  await form.getByRole("button", { name: "Create Account" }).click();
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
  await panel.waitFor({ state: "visible", timeout: 20_000 });
}

const button = (name) => panel.getByRole("button", { name, exact: true }).first();
const enabled = async (name) => !(await button(name).isDisabled());
const location = async () =>
  ((await panel.getByRole("combobox", { name: "Location" }).first().textContent()) ?? "").trim();
const selected = async (name) =>
  (await panel
    .getByRole("treeitem", { name, exact: true })
    .first()
    .getAttribute("aria-selected")) === "true";

try {
  await signUp();
  await getQuickTime();
  const fresh = { back: await enabled("Back"), forward: await enabled("Forward") };
  step(
    "a fresh Open panel shows Movies with Back and Forward dimmed",
    (await location()).includes("Movies") && !fresh.back && !fresh.forward,
    JSON.stringify(fresh),
  );
  await panel.getByRole("treeitem", { name: "Recents", exact: true }).first().click();
  const toRecents = await until(async () => (await location()).includes("Recents"));
  const backOn = await until(() => enabled("Back"));
  step(
    "after choosing Recents in the sidebar, Back is enabled and Forward is still dimmed",
    toRecents && backOn && !(await enabled("Forward")),
    `location ${await location()}`,
  );
  await button("Back").click();
  const backToMovies = await until(
    async () => (await location()).includes("Movies") && (await selected("Movies")),
  );
  step(
    "Back returns to Movies (the Location pop-up and the sidebar say so) and Forward is enabled",
    backToMovies && (await enabled("Forward")) && !(await enabled("Back")),
    `location ${await location()}`,
  );
  await button("Forward").click();
  const forwardToRecents = await until(
    async () => (await location()).includes("Recents") && (await selected("Recents")),
  );
  step(
    "Forward returns to Recents; Back is enabled again and Forward is dimmed",
    forwardToRecents && (await enabled("Back")) && !(await enabled("Forward")),
    `location ${await location()}`,
  );
  step("no page error", errors.length === 0, errors.join(" | ").slice(0, 300));
} catch (error) {
  step("journey ran to the end", false, String(error).split("\n")[0]);
} finally {
  await page
    .screenshot({ path: path.join(out, `quicktime-open-history-${browserName}.png`) })
    .catch(() => {});
  await browser.close();
}
console.log(`\nquicktime-open-history ${browserName}: ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
