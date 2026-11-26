#!/usr/bin/env node
// System Preferences on Ferrite: under `ferrite dev`, open System Preferences
// from the Dock, choose the Dark appearance and "Always" show scroll bars in
// General, reload the page and check that the desktop comes back in Dark Aqua
// before System Preferences is opened, change the accent with System
// Preferences closed and check that it holds after another reload, then that
// General still shows both choices, loaded from the session's storage through
// /api/system-preferences/settings. Exits 0 only when every step passed with
// no console error, page error or failed request.
//
//   ferrite dev                       # in ferrite-apps/desktop
//   node e2e/system-preferences-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const URL = "/api/system-preferences/settings";
const appearance = (page) =>
  page.evaluate(() => document.documentElement.getAttribute("data-appearance"));

async function openGeneral(page) {
  await page
    .getByRole("button", { name: /^System Preferences$/ })
    .first()
    .click();
  // The window opens on the pane last shown: Show All is the way to the grid from anywhere.
  const window = page.locator('[data-window-id="system-preferences"]');
  await window.locator(".mac-system-preferences-body:not([inert])").waitFor({ timeout: 10_000 });
  await window.getByRole("button", { name: "Show All" }).click();
  await window
    .getByRole("group", { name: "All preferences" })
    .getByRole("button", { name: "General" })
    .click();
  // The window is titled after the pane it shows.
  const general = page.getByRole("region", { name: "General" }).first();
  await general.getByRole("group", { name: "General" }).waitFor({ state: "visible" });
  return general;
}

await journey("system-preferences", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  await api(page, "DELETE", URL);
  await reloadDesktop(page);
  step("the desktop starts in its default appearance", (await appearance(page)) === null);

  let prefs = await openGeneral(page);
  step("System Preferences opens from the Dock on General", await prefs.isVisible());

  let saved = nextSave(page, URL, (body) => body?.theme?.appearance === "dark");
  await prefs.getByRole("radio", { name: "Dark" }).click();
  let response = await saved;
  step(
    "choosing Dark is saved through the API",
    response.status() === 200,
    `HTTP ${response.status()}`,
  );
  step("the desktop turns Dark Aqua", (await appearance(page)) === "dark");

  saved = nextSave(page, URL, (body) => body?.values?.["general.scrollBars"] === "always");
  await prefs.getByRole("radio", { name: "Always" }).click();
  response = await saved;
  step("a pane setting is saved through the API", response.status() === 200);

  const stored = await api(page, "GET", URL);
  step(
    "the server holds the theme and the setting",
    stored.json.theme?.appearance === "dark" &&
      stored.json.values?.["general.scrollBars"] === "always",
  );

  // A reload starts the desktop with no window open: the appearance comes back from the
  // session's storage before System Preferences is opened.
  await reloadDesktop(page);
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-appearance") === "dark",
    undefined,
    { timeout: 10_000 },
  );
  step("after a reload the desktop is Dark Aqua again", (await appearance(page)) === "dark");
  await page.screenshot({ path: path.join(out, "system-preferences-dark-desktop.png") });

  // With System Preferences closed, the desktop's theme changes (as another demo or a
  // shortcut would change it): the change is saved too, and holds after a reload.
  saved = nextSave(page, URL, (body) => body?.theme?.accent === "green");
  await page.evaluate(() => document.documentElement.setAttribute("data-accent", "green"));
  response = await saved;
  step(
    "an accent changed with System Preferences closed is saved",
    response.status() === 200,
    `HTTP ${response.status()}`,
  );
  await reloadDesktop(page);
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-accent") === "green",
    undefined,
    { timeout: 10_000 },
  );
  step(
    "after a reload the desktop keeps that accent and Dark Aqua",
    (await appearance(page)) === "dark" &&
      (await page.evaluate(() => document.documentElement.getAttribute("data-accent"))) === "green",
  );

  prefs = await openGeneral(page);
  const dark = prefs.getByRole("radio", { name: "Dark" });
  const always = prefs.getByRole("radio", { name: "Always" });
  step("General shows Dark chosen", (await dark.getAttribute("aria-checked")) === "true");
  step("General shows scroll bars Always", (await always.getAttribute("aria-checked")) === "true");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, "system-preferences-on-ferrite.png") });

  // Leave the session as it was found.
  await api(page, "DELETE", URL);
});
