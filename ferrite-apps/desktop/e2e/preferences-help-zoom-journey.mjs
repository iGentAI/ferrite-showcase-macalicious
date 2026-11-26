#!/usr/bin/env node
// Round 3, R7 bundle 02: Preferences controls that did nothing. TV's and Music's Preferences Help
// button is dimmed with the reason the person sees (this desktop has no help book for them: Help
// Viewer offers no TV or Music help, and their Help menu items are dimmed saying so), and Podcasts'
// Preferences Zoom button is dimmed (a Preferences window has a fixed size). Before the fix all
// three were enabled and a click did nothing. Real input against a served `ferrite dev`, signed up
// as an account of its own; one ok/FAIL line per step, exit 1 on any failure.
//
//   node e2e/preferences-help-zoom-journey.mjs --url http://127.0.0.1:8080 \
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
const out = path.resolve(option("--out", path.join("e2e", "output", "preferences-help-zoom")));
mkdirSync(out, { recursive: true });

const TV_REASON = "TV Help is not available: this desktop has no help book for TV";
const MUSIC_REASON = "Music Help is not available: this desktop has no help book for Music";
let failures = 0;
const step = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
};
const dimmed = async (button) =>
  (await button.getAttribute("aria-disabled")) === "true" || (await button.isDisabled());

const browser = await ENGINES[browserName].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
context.setDefaultTimeout(15_000);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const finder = page.getByRole("button", { name: /^Finder$/ }).first();
const windowOf = (slug) => page.locator(`.mac-managed-window[data-window-id="${slug}"]`).first();

/** The login window's Create Account… form, filled in by keyboard. */
async function signUp() {
  const run = Date.now().toString(36);
  const tile = (name) =>
    page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
  await page.goto(`${base}/`, { waitUntil: "load" });
  await tile("Create Account…").click({ timeout: 30_000 });
  const form = page.getByRole("form", { name: "Create Account" });
  await form.getByLabel("Full Name:").fill(`Prefs ${run}`);
  await form.getByLabel("Account Name:").fill(`prefs-${run}`);
  await form.getByLabel("Password:").fill(`pw-${run}-prefs`);
  await form.getByLabel("Verify:").fill(`pw-${run}-prefs`);
  await form.getByRole("button", { name: "Create Account" }).click();
  await finder.waitFor({ timeout: 30_000 });
}

/** Open an app from Spotlight, typing its name and pressing Return. */
async function openApp(name, slug) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await page.getByRole("option", { name, exact: true }).first().waitFor();
  await field.press("Enter");
  await windowOf(slug).waitFor({ state: "visible", timeout: 20_000 });
  return windowOf(slug);
}

/** <App> > Preferences… from the menu bar, answering the Preferences dialog. */
async function preferences(app, toolbarName) {
  await page.getByRole("menubar").first().getByRole("menuitem", { name: app, exact: true }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Preferences…", exact: true }).click();
  const named = page
    .getByRole("tablist", { name: toolbarName })
    .or(page.getByRole("toolbar", { name: toolbarName }));
  const dialog = page.getByRole("dialog").filter({ has: named }).first();
  await dialog.waitFor();
  return dialog;
}

try {
  await signUp();
  for (const [app, slug, toolbar, reason] of [
    ["TV", "tv", "TV preferences", TV_REASON],
    ["Music", "music", "Music preferences", MUSIC_REASON],
  ]) {
    await openApp(app, slug);
    const dialog = await preferences(app, toolbar);
    const help = dialog.getByRole("button", { name: "Help", exact: true }).first();
    const isDimmed = await dimmed(help);
    const title = (await help.getAttribute("title")) ?? "";
    step(
      `${app} > Preferences…: its Help button is dimmed, saying why`,
      isDimmed && title === reason,
      `dimmed ${isDimmed}; "${title}"`,
    );
    // The Help menu opens Help Viewer on a search for the app.
    await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
    await dialog.waitFor({ state: "hidden" });
    await page
      .getByRole("menubar")
      .first()
      .getByRole("menuitem", { name: "Help", exact: true })
      .click();
    const item = page
      .getByRole("menu")
      .getByRole("menuitem", { name: new RegExp(`^${app} Help\\b`) })
      .first();
    await item.waitFor({ timeout: 5_000 });
    await item.click();
    const viewer = page.locator(".mac-window.mac-help-viewer").first();
    const opened = await viewer.waitFor({ timeout: 8_000 }).then(
      () => true,
      () => false,
    );
    step(`Help > ${app} Help opens Help Viewer`, opened);
    if (opened) await viewer.getByRole("button", { name: "Close", exact: true }).first().click();
    await windowOf(slug).getByRole("button", { name: "Close", exact: true }).first().click();
  }

  const podcasts = await openApp("Podcasts", "podcasts");
  // A click into the window makes Podcasts the app that takes Control-Comma.
  await podcasts.getByRole("searchbox").first().click();
  await page.keyboard.press("Control+Comma");
  const prefs = page.locator(".mac-podcasts-preferences").first();
  await prefs.waitFor();
  const zoom = prefs.getByRole("button", { name: "Zoom", exact: true }).first();
  const zoomDimmed = await dimmed(zoom);
  step(
    "Podcasts' Preferences: its Zoom button is dimmed (a Preferences window has a fixed size)",
    zoomDimmed,
    `dimmed ${zoomDimmed}`,
  );
  await prefs.getByRole("button", { name: "Close", exact: true }).first().click();
  await prefs.waitFor({ state: "hidden" });
  step("Podcasts' Preferences still closes with its Close button", true);
  step("no page error", errors.length === 0, errors.join(" | ").slice(0, 300));
} catch (error) {
  step("journey ran to the end", false, String(error).split("\n")[0]);
} finally {
  await page
    .screenshot({ path: path.join(out, `preferences-help-zoom-${browserName}.png`) })
    .catch(() => {});
  await browser.close();
}
console.log(`\npreferences-help-zoom ${browserName}: ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
