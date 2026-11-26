#!/usr/bin/env node
// Language & Region on a served desktop. The list is the browser's languages and says that a page cannot change or reorder
// them; Region and Calendar write the examples and the date in Notification Center's Today, kept across a reload; Temperature
// is kept; Advanced is dimmed with a reason; the Apps tab says what is true. Exits 0 only when every step passed with no console
// error, page error, failed request or HTTP error.
//
// Simulated: `navigator.languages` holds three languages, set by a script before the page loads, because a headless browser
// has one. The list's rows, the refusal to reorder and everything else are the real desktop's.
//
//   node e2e/sp-language-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { launch } from "./app-journey.mjs";
import { api, journey, nextSave, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";

await journey("sp-language-rows", async ({ page, base, out, step }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "de-DE", "fr-FR"] });
  });
  await openDesktop(page, base);
  const prefs = page.locator('[data-window-id="system-preferences"]');
  const list = prefs.getByRole("listbox", { name: "Preferred languages:" });
  const openPane = async () => {
    await launch(page, "System Preferences");
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    if ((await list.count()) === 0)
      await prefs.getByRole("button", { name: "Language & Region", exact: true }).first().click();
    await list.waitFor({ timeout: 8_000 });
  };
  const titleOf = (locator) =>
    locator.evaluate((element) => element.closest("[title]")?.getAttribute("title") ?? "");
  const stored = async (key) => (await api(page, "GET", SETTINGS)).json.values?.[key];
  const combo = (name) => prefs.getByRole("combobox", { name });
  const choose = async (name, option) => {
    const saved = nextSave(page, SETTINGS);
    await combo(name).click();
    await page.getByRole("option", { name: option, exact: true }).click();
    await saved;
  };
  const written = (locale, calendar, options) =>
    page.evaluate(
      ({ locale, calendar, options }) =>
        new Date().toLocaleDateString(locale, { ...options, calendar }),
      { locale, calendar, options },
    );
  const FULL = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const DAY = { month: "long", day: "numeric" };
  const examplesShow = async (text) => (await prefs.getByText(text, { exact: false }).count()) > 0;
  const today = async () => {
    await page.getByRole("menuitem", { name: "Notification Center" }).click();
    const shell = page.locator(".mac-desktop-shell-notification-center");
    await shell.waitFor({ timeout: 5_000 });
    await shell.getByRole("tab", { name: "Today" }).click();
    await page.waitForTimeout(300);
    const text = await shell.innerText();
    await page.keyboard.press("Escape");
    await shell.waitFor({ state: "detached", timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(300);
    return text;
  };

  await openPane();
  const order = () => list.getByRole("option").allInnerTexts();
  const before = await order();
  step(
    "The list is the browser's languages, in its order",
    before.length === 3 && /English/.test(before[0]) && /Deutsch/.test(before[1]),
    before.join(" | ").replace(/\s+/g, " "),
  );
  step(
    "It says so in small text",
    await prefs
      .getByText("From your browser, in its order. Change them in its settings.")
      .isVisible(),
  );
  const listTitle = await titleOf(list);
  step("and in its title", /cannot add, remove or reorder/.test(listTitle), listTitle);

  const second = await list.getByRole("option").nth(1).boundingBox();
  const first = await list.getByRole("option").nth(0).boundingBox();
  await page.mouse.move(second.x + 40, second.y + 15);
  await page.mouse.down();
  await page.mouse.move(first.x + 40, first.y + 5, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = (await order()).join();
  step("Dragging a language up does not reorder the list", after === before.join(), after);

  for (const name of ["Add a language", "Remove the selected language"]) {
    const button = prefs.getByRole("button", { name });
    const why = await titleOf(button);
    step(`${name} is dimmed and says why`, (await button.isDisabled()) && /browser/.test(why), why);
  }
  await page.screenshot({ path: path.join(out, "language-general.png") });

  await choose("Region:", "United Kingdom");
  step(
    "Region writes the examples",
    await examplesShow(await written("en-GB", "gregory", FULL)),
    await written("en-GB", "gregory", FULL),
  );
  step(
    "Region writes the date in Notification Center's Today",
    (await today()).includes(await written("en-GB", "gregory", DAY)),
    await written("en-GB", "gregory", DAY),
  );

  await choose("Calendar:", "Hebrew");
  const hebrew = await written("en-GB", "hebrew", FULL);
  step("Calendar writes the examples", await examplesShow(hebrew), hebrew);
  await page.screenshot({ path: path.join(out, "language-hebrew.png") });
  step(
    "Calendar writes the date in Notification Center's Today",
    (await today()).includes(await written("en-GB", "hebrew", DAY)),
    await written("en-GB", "hebrew", DAY),
  );

  await choose("Temperature:", "°C — Celsius");
  step(
    "Temperature is the person's to choose, and kept for the weather's views",
    (await stored("language-and-region.temperature")) === "celsius",
  );
  const advanced = prefs.getByRole("button", { name: "Advanced…" });
  const noAdvanced = await titleOf(advanced);
  step(
    "Advanced is dimmed and says why",
    (await advanced.isDisabled()) && /no custom formats/.test(noAdvanced),
    noAdvanced,
  );

  await prefs.getByRole("tab", { name: "Apps" }).click();
  const panel = await prefs.getByRole("tabpanel").innerText();
  step(
    "The Apps tab says no app has a language to choose",
    /no app has a language of its own/.test(panel) && /Siri/.test(panel),
    panel,
  );
  await page.screenshot({ path: path.join(out, "language-apps.png") });
  const tabSaved = nextSave(page, SETTINGS);
  await prefs.getByRole("tab", { name: "General" }).click();
  await tabSaved;

  await reloadDesktop(page);
  await openPane();
  step(
    "Region and Calendar hold across a reload, on the server and in the pane",
    (await stored("language-and-region.region")) === "united-kingdom" &&
      (await stored("language-and-region.calendar")) === "Hebrew" &&
      /United Kingdom/.test(await combo("Region:").innerText()) &&
      /Hebrew/.test(await combo("Calendar:").innerText()),
  );
  step("and the examples still follow them", await examplesShow(hebrew));
});
