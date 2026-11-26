#!/usr/bin/env node
// Every System Preferences pane's settings across a reload, on one account in one browser, so it stays light where the census
// (system-preferences-census-journey.mjs) gives each pane accounts of its own: in each pane the first control that saves, a
// check box or else a pop-up button, is changed; after a reload every changed setting is the same on the server. A pane whose
// first control saves nothing, or that has none, must be the one this file names. Exits 0 only when every step passed with no
// console error, page error, failed request or HTTP error.
//
//   node e2e/system-preferences-kept-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";
import { SP_PANES } from "./r2-sp-discover.mjs";

const URL = "/api/system-preferences/settings";
/** The setting each pane's first control saves. */
/** What the press on each pane's first control must do: the setting saved, its value, and what the control then shows. */
const SAVES = {
  general: ["general.hideMenuBar", true, "true"],
  "desktop-and-screen-saver": ["desktop-and-screen-saver.mode", "light", "Light (Still)"],
  dock: ["dock.magnification", true, "true"],
  "mission-control": ["mission-control.groupByApplication", true, "true"],
  siri: ["siri.askSiri", false, "false"],
  spotlight: ["spotlight.excluded", ["Applications"], "false"],
  "language-and-region": ["language-and-region.twentyFourHourTime", true, "true"],
  notifications: ["notifications.scheduled", true, "true"],
  accessibility: ["accessibility.showStatusInMenuBar", true, "true"],
  extensions: ["extensions.shareMenu", ["notes", "photos", "reminders"], "false"],
  "security-and-privacy": ["security-and-privacy.requirePassword", false, "false"],
  sound: ["sound.interfaceSounds", false, "false"],
  keyboard: ["keyboard.showViewers", true, "true"],
  mouse: ["mouse.naturalScrolling", false, "false"],
  displays: ["displays.pageNightShift", true, "true"],
  sidecar: ["sidecar.showSidebar", false, "false"],
  "energy-saver": ["energy-saver.showBatteryStatus", false, "false"],
  network: ["network.showStatusInMenuBar", false, "false"],
  bluetooth: ["bluetooth.showInMenuBar", true, "true"],
  "time-machine": ["time-machine.showInMenuBar", false, "false"],
};
const NO_CONTROL = [
  "apple-id",
  "family-sharing",
  "internet-accounts",
  "wallet-and-apple-pay",
  "touch-id",
  "users-and-groups",
  "screen-time",
  "software-update",
  "printers-and-scanners",
  "trackpad",
  "date-and-time",
  "sharing",
  "startup-disk",
];

await journey("system-preferences-kept", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const openWindow = async () => {
    await page
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(300);
  };
  const settings = () =>
    page
      .evaluate((url) => fetch(url).then((reply) => reply.json()), URL)
      .then((reply) => reply.values ?? {});
  const openPane = async (name) => {
    await page.keyboard.press("Control+l");
    await prefs.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 5_000 });
    await prefs.getByRole("button", { name, exact: true }).first().click();
    await page.waitForTimeout(350);
  };
  /** The first enabled control of a kind whose press stays in the pane. */
  const firstEnabled = async (locator) => {
    for (const control of await locator.all()) {
      if ((await control.isVisible()) && (await control.isEnabled())) return control;
    }
    return null;
  };
  /** The control the journey changes: the pane's first enabled check box, or else its first pop-up. */
  const controlOf = async () =>
    (await firstEnabled(prefs.getByRole("checkbox"))) ??
    (await firstEnabled(prefs.getByRole("combobox")));
  const stateOf = async (control) =>
    (await control.getAttribute("role")) === "checkbox"
      ? control.getAttribute("aria-checked")
      : control.innerText();
  const settle = async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  };

  await openWindow();
  const changed = [];
  const noControl = [];
  const savedNothing = [];
  const failed = [];
  for (const [pane, name] of SP_PANES) {
    try {
      await openPane(name);
      const before = await settings();
      const control = await controlOf();
      if (control) {
        const was = await stateOf(control);
        if ((await control.getAttribute("role")) === "checkbox") await control.click();
        else {
          await control.click();
          const options = page.getByRole("option");
          await options.first().waitFor({ timeout: 3_000 });
          for (const option of await options.all()) {
            if ((await option.getAttribute("aria-selected")) !== "true") {
              await option.click();
              break;
            }
          }
        }
        // A save follows a change within moments. Other settings may change with it.
        const [key, value, shown] = SAVES[pane] ?? [];
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        let now = before;
        for (let tries = 0; tries < 16 && !same(now[key], value); tries += 1) {
          await page.waitForTimeout(250);
          now = await settings();
        }
        const state = await stateOf(control);
        if (key && same(now[key], value) && state === shown && was !== shown)
          changed.push({ pane, name, key, value, shown });
        else savedNothing.push(`${pane} (${key}: ${JSON.stringify(now[key])}; ${was} to ${state})`);
      } else noControl.push(pane);
      await settle();
    } catch (error) {
      failed.push(`${pane} (${String(error.message).split("\n")[0].slice(0, 60)})`);
      await settle().catch(() => {});
    }
  }
  await page.waitForTimeout(1_000);
  step("every pane opens and takes the press", failed.length === 0, failed.join(", "));
  step(
    "the panes with no control to change are the served pages that say why",
    noControl.join() === NO_CONTROL.join(),
    noControl.join(", "),
  );
  step(
    "every pane's first control saves the value it should, and shows it",
    savedNothing.length === 0 && changed.length === Object.keys(SAVES).length,
    `${changed.length} right; wrong: ${savedNothing.join(", ")}`,
  );

  await reloadDesktop(page);
  const after = await settings();
  await openWindow();
  for (const { pane, name, key, value, shown } of changed) {
    await openPane(name);
    const control = await controlOf();
    const state = control ? await stateOf(control) : null;
    step(
      `${name}: ${key} is the same on the server and in the pane after the reload`,
      JSON.stringify(after[key]) === JSON.stringify(value) && state === shown,
      `${pane}: ${JSON.stringify(value)}, shown ${state}`,
    );
  }
  await page.screenshot({ path: path.join(out, "sp-kept-after-reload.png") });
});
