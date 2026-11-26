#!/usr/bin/env node
// Script Editor's Record hears the folder Finder shows, as real Finder tells a recording script: recorded in both languages,
// then Finder is sent elsewhere and Run takes it back. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/script-editor-record-finder-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("script-editor-record-finder");

await run(async (page) => {
  await openDesktop(page, base, step);
  const held = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(held.installed ?? []), "script-editor"])],
    rev: held.rev,
  });
  await reloadDesktop(page);
  /** The application's Dock tile, or Spotlight while it has none. */
  const launch = async (_, name) => {
    const tile = page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
    if (await tile.isVisible()) await tile.click();
    else {
      await page.keyboard.press("Control+Space");
      await page.keyboard.insertText(name);
      await page.waitForTimeout(400);
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(400);
  };
  await launch(page, "Script Editor");
  const scriptText = page.getByRole("textbox", { name: "Script", exact: true });
  await scriptText.waitFor({ timeout: 15_000 });
  const editor = page.locator('.mac-managed-window[data-window-id^="script-editor"]').first();
  const finderTitle = page
    .locator('.mac-managed-window[data-window-id^="finder"]')
    .first()
    .locator(".mac-title-bar");
  const goTo = async (name) => {
    await page.getByRole("menubar").getByRole("menuitem", { name: "Go", exact: true }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
    await page.waitForTimeout(600);
  };
  const until = async (check, ms = 15_000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await check()) return true;
      await page.waitForTimeout(150);
    }
    return false;
  };

  for (const [language, expected] of [
    ["AppleScript", /open folder "[^"]*\/Documents"/],
    ["JavaScript", /Application\("Finder"\)\.open\("[^"]*\/Documents"\);/],
  ]) {
    // Finder starts each round elsewhere, as going where it already is reports nothing.
    await launch(page, "Finder");
    await goTo("Downloads");
    await launch(page, "Script Editor");
    await editor.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: language }).click();
    await page.waitForTimeout(300);
    await scriptText.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await editor.getByRole("button", { name: "Record" }).first().click();

    await launch(page, "Finder");
    await goTo("Documents");
    await launch(page, "Script Editor");
    await page.waitForTimeout(500);
    await editor.getByRole("button", { name: "Stop" }).first().click();
    await page.waitForTimeout(500);
    const written = await scriptText.innerText();
    step(
      `Record wrote ${language}: the folder Finder showed`,
      expected.test(written),
      written.replace(/\s+/g, " ").slice(0, 240),
    );

    // Only the last folder is the journey's: Finder may have opened on another before it.
    await launch(page, "Finder");
    await goTo("Downloads");
    await until(async () => /Downloads/.test(await finderTitle.innerText()));
    await launch(page, "Script Editor");
    await editor.getByRole("button", { name: "Run" }).first().click();
    step(
      `running the recorded ${language} takes Finder back to Documents`,
      await until(async () => /Documents/.test(await finderTitle.innerText())),
      await finderTitle.innerText(),
    );
    await shot(page, path.join(out, `script-editor-record-finder-${language}.png`));
  }
});
