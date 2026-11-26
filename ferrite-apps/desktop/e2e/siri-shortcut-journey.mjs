#!/usr/bin/env node
// System Preferences > Siri > Keyboard Shortcut on the desktop served by `ferrite dev`: the choice is kept on the server, the
// chosen keys held open Siri, and another choice's keys do not. A held key is sent as Playwright's repeated key down.
//
//   node e2e/siri-shortcut-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("siri-shortcut");

await run(async (page) => {
  await openDesktop(page, base, step);
  await page.getByRole("button", { name: "System Preferences" }).first().click();
  const prefs = page.locator('[data-window-id="system-preferences"]');
  await prefs.waitFor({ timeout: 15_000 });
  await prefs.getByRole("button", { name: "Siri", exact: true }).click();
  const shortcut = prefs.getByRole("combobox", { name: "Keyboard Shortcut:" });
  const choose = async (name) => {
    await shortcut.click();
    await page.getByRole("option", { name, exact: true }).click();
    await page.waitForTimeout(600);
    // Focus stays on the pop-up, which a held Space would open.
    await page.evaluate(() => document.activeElement?.blur());
  };
  const kept = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json?.values?.[
      "siri.keyboardShortcut"
    ];
  const siri = page.getByRole("textbox", { name: "Type to Siri" });
  const shown = () =>
    siri
      .waitFor({ timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
  const absent = () =>
    siri
      .waitFor({ timeout: 2_000 })
      .then(() => false)
      .catch(() => true);
  await page.evaluate(() => {
    window.keysSeen = [];
    window.addEventListener(
      "keydown",
      (event) => {
        window.keysSeen.push(
          `${event.code}${event.repeat ? "+" : ""}${event.altKey ? " alt" : ""}${event.metaKey ? " meta" : ""}`,
        );
      },
      true,
    );
  });
  const keys = () => page.evaluate(() => window.keysSeen.splice(0).join(", "));
  const hold = async (modifier) => {
    await page.keyboard.down(modifier);
    await page.keyboard.down("Space");
    await page.keyboard.down("Space");
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await page.keyboard.up(modifier);
  };
  const closeSiri = async () => {
    await page.keyboard.press("Escape");
    await siri.waitFor({ state: "hidden", timeout: 5_000 });
  };

  await shortcut.click();
  const offered = await page.getByRole("option").allTextContents();
  step("Fn is not offered", !offered.some((name) => name.includes("Fn")), offered.join(", "));
  await page.keyboard.press("Escape");

  await choose("Hold Option Space");
  step("the choice is kept on the server", (await kept()) === "Hold Option Space", await kept());
  await hold("Meta");
  step(
    "Command-Space held does not open Siri under Hold Option Space",
    await absent(),
    await keys(),
  );
  await hold("Alt");
  step("Option-Space held opens Siri", await shown(), await keys());
  await shot(page, path.join(out, "siri-shortcut.png"));
  await closeSiri();

  await choose("Press Left Command Key Twice");
  await hold("Alt");
  step("Option-Space held no longer opens it", await absent(), await keys());
  await page.keyboard.press("Meta");
  await page.keyboard.press("Meta");
  step("Left Command pressed twice opens Siri", await shown(), await keys());
  await closeSiri();

  await choose("Hold Command Space");
  await hold("Meta");
  step("Command-Space held opens Siri", await shown(), await keys());
  await closeSiri();
});
