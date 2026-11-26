#!/usr/bin/env node
// The shared shell: the Help menu's search field and <App> Help open Help Viewer on the search, and
// the Services submenu acts on the selected text: nothing with none selected, Look Up in Dictionary
// and Search the Web with some.
//
//   node scripts/pack-site.mjs && ferrite dev --port 8787    # in ferrite-apps/desktop
//   node e2e/shell-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("shell");

const bar = (page) => page.getByRole("menubar").first();
const title = (page, name) => bar(page).getByRole("menuitem", { name, exact: true });
const row = (page, name) => page.getByRole("menu").getByRole("menuitem", { name, exact: true });
const managed = (page, id) => page.locator(`.mac-managed-window[data-window-id="${id}"]`);
const shown = (locator) =>
  locator.waitFor({ timeout: 8_000 }).then(
    () => true,
    () => false,
  );

await run(async (page) => {
  await openDesktop(page, base, step);
  const dock = page.getByRole("toolbar", { name: "Dock" });
  await dock.getByRole("button", { name: "Finder" }).click();
  await managed(page, "finder").waitFor({ timeout: 10_000 });

  await title(page, "Help").click();
  const search = page.getByRole("menu").getByRole("searchbox", { name: "Search" });
  step("the Help menu has a search field", await shown(search));
  await shot(page, path.join(out, `shell-help-menu-${browserName}.png`));
  await search.click();
  await page.keyboard.type("backup");
  step("typing stays in the field", (await search.inputValue()) === "backup");
  await page.keyboard.press("Enter");
  const viewer = managed(page, "help-viewer");
  step("Return opens Help Viewer", await shown(viewer));
  const field = viewer.getByRole("searchbox").first();
  await field.waitFor({ timeout: 8_000 });
  await page.waitForFunction(
    () =>
      document.querySelector('.mac-managed-window[data-window-id="help-viewer"] input')?.value ===
      "backup",
    null,
    { timeout: 8_000 },
  );
  step("Help Viewer searches for the words", (await field.inputValue()) === "backup");
  step("the menu has closed", (await page.getByRole("menu").count()) === 0);
  await shot(page, path.join(out, `shell-help-search-${browserName}.png`));

  await title(page, "Help").click();
  await row(page, "Help Viewer Help").click();
  await page.waitForFunction(
    () =>
      document.querySelector('.mac-managed-window[data-window-id="help-viewer"] input')?.value ===
      "Help Viewer",
    null,
    { timeout: 8_000 },
  );
  step("<App> Help searches an open Help Viewer for the app", true);

  // Services: nothing with no selection.
  await title(page, "Help Viewer").click();
  await row(page, "Services").hover();
  step("with no text selected no service applies", await shown(row(page, "No Services Apply")));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // With a word selected in a field.
  await field.fill("harbour");
  await field.selectText();
  await title(page, "Help Viewer").click();
  await row(page, "Services").hover();
  const lookUp = row(page, "Look Up in Dictionary");
  step("with a word selected, Services offers Look Up", await shown(lookUp));
  step("and Search the Web", await shown(row(page, "Search the Web")));
  await shot(page, path.join(out, `shell-services-${browserName}.png`));
  await lookUp.click();
  const dictionary = managed(page, "dictionary");
  step("Look Up opens Dictionary", await shown(dictionary));
  const entry = dictionary.getByRole("searchbox").first();
  await page.waitForFunction(
    () =>
      document.querySelector('.mac-managed-window[data-window-id="dictionary"] input')?.value ===
      "harbour",
    null,
    { timeout: 8_000 },
  );
  step("Dictionary shows the word", (await entry.inputValue()) === "harbour");
  await shot(page, path.join(out, `shell-look-up-${browserName}.png`));
});
