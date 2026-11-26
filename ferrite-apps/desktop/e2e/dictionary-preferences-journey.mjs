#!/usr/bin/env node
// Dictionary's Preferences, New Window and Clear Recents on the served desktop. Exits 0 only when
// every step passed with no console error, page error or failed request.
//
//   node e2e/dictionary-preferences-journey.mjs --url http://127.0.0.1:3020 --out e2e/output

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("dictionary-preferences", { ignoreOtherOrigins: true });
const WORD = "serendipity";

const choose = async (page, title, name) => {
  await page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name }).first().click();
  await page.waitForTimeout(300);
};

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "dictionary"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  const open = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const spotlight = page.getByRole("combobox", { name: "Spotlight Search" });
    await spotlight.fill("Dictionary");
    await spotlight.press("Enter");
  };
  await open();
  const windows = page.locator('.mac-managed-window[data-window-id^="dictionary"]');
  const window = windows.first();
  const field = window.getByRole("searchbox", { name: "Search" });
  await field.waitFor({ state: "visible", timeout: 10_000 });
  await field.click();
  await page.keyboard.type(WORD);
  const sense = window.locator(".mac-dictionary-sense").first();
  await sense.waitFor({ state: "visible", timeout: 30_000 });
  const scale = () =>
    window
      .locator(".mac-dictionary-entry")
      .evaluate((node) => node.style.getPropertyValue("--mac-dictionary-text-scale"));

  await choose(page, "Dictionary", /^Preferences/);
  const preferences = page
    .getByRole("region", { name: "Dictionary Preferences" })
    .or(page.locator(".mac-preferences-window"))
    .first();
  await preferences.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "dictionary-preferences.png"));

  await preferences.getByRole("checkbox", { name: "Apple" }).click();
  await page.waitForTimeout(200);
  step(
    "turning a source off takes it out of the scope bar",
    (await window.getByRole("radio", { name: "Apple" }).count()) === 0,
  );
  await preferences.getByRole("button", { name: "Move Wikipedia up" }).click();
  await preferences.getByRole("button", { name: "Move Wikipedia up" }).click();
  await page.waitForTimeout(200);
  const scopes = () =>
    window.getByRole("radio").evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
  step(
    "moving a source moves it in the scope bar",
    (await scopes()).join() === "All,Dictionary,Wikipedia,Thesaurus",
    (await scopes()).join(),
  );
  await preferences
    .locator("li", { hasText: "Thesaurus" })
    .dragTo(preferences.locator("li", { hasText: "Dictionary" }));
  await page.waitForTimeout(200);
  step(
    "dragging a source does the same",
    (await scopes()).join() === "All,Thesaurus,Dictionary,Wikipedia",
    (await scopes()).join(),
  );
  await preferences.getByRole("combobox", { name: "Font size" }).click();
  await page.getByRole("option", { name: "Largest" }).click();
  await page.waitForTimeout(200);
  step("the font size changes the open window", (await scale()) === "1.5", await scale());
  await window.getByRole("button", { name: "Decrease text size" }).click();
  await page.waitForTimeout(200);
  step("and the window's buttons change the setting", (await scale()) === "1.3", await scale());
  await window.getByRole("radio", { name: "All" }).click();
  const titles = () =>
    window
      .locator(".mac-dictionary-source")
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.source));
  await window
    .locator('.mac-dictionary-source[data-source="thesaurus"]')
    .waitFor({ timeout: 30_000 });
  const shown = await titles();
  step(
    "an entry shows the sources in that order, without the one turned off",
    !shown.includes("apple") && shown[0] === "thesaurus" && shown[1] === "dictionary",
    shown.join(),
  );

  await reloadDesktop(page);
  if ((await windows.count()) === 0) await open();
  await field.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(500);
  step(
    "the sources and the size survive a reload",
    (await scopes()).join() === "All,Thesaurus,Dictionary,Wikipedia" && (await scale()) === "1.3",
    `${(await scopes()).join()} ${await scale()}`,
  );

  // A second window has a search of its own.
  await window.click({ position: { x: 300, y: 20 } });
  await choose(page, "File", /^New Window/);
  await page.waitForTimeout(500);
  step("File > New Window opens a second window", (await windows.count()) === 2);
  const second = windows.nth(1).getByRole("searchbox", { name: "Search" });
  await second.fill("luck");
  await page.waitForTimeout(300);
  step(
    "each window keeps its own search",
    (await second.inputValue()) === "luck" && (await field.inputValue()) === WORD,
  );
  await shot(page, path.join(out, "dictionary-two-windows.png"));
  await windows.nth(1).locator(".mac-window-controls button").first().click();
  await page.waitForTimeout(400);

  // Clear Recents.
  await field.fill("");
  const rows = window.getByRole("listbox", { name: "Words" }).getByRole("option");
  await rows.first().waitFor({ timeout: 10_000 });
  await rows.first().click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Word list commands" });
  await menu.getByRole("menuitem", { name: "Clear Recents" }).click();
  await rows
    .first()
    .waitFor({ state: "detached", timeout: 15_000 })
    .catch(() => {});
  step(
    "Clear Recents empties the list",
    (await rows.count()) === 0,
    await rows.allTextContents().then((all) => all.join()),
  );
  const history = (await api(page, "GET", "/api/dictionary/history")).json.history;
  step(
    "and the person's history on the server",
    (history ?? []).length === 0,
    JSON.stringify(history),
  );
});
