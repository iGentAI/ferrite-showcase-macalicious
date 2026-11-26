#!/usr/bin/env node
// Spotlight's window and hand-offs that nothing drove: the extra, Escape, a press beside it, the arrows, Top Hit,
// Fonts, Developer, Stocks and Maps rows, a sum, a conversion, a definition, a pane, each kind of file to its app,
// and Search Results' choices. The stock's price comes from a stub of /api/stocks/quotes, since the journey must
// not depend on a market feed; everything else is the running desktop.
//
//   node e2e/spotlight-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("spotlight-more");
const tag = Date.now().toString(36);
const WORD = `Quillon${tag}`;
const CODE = `${WORD} tool.py`;
const TEXT = `${WORD} words.txt`;
const PICTURE = `${WORD} picture.svg`;
const PDF = `${WORD} paper.pdf`;
const OTHER = `${WORD} data.bin`;
const SETTINGS = "/api/system-preferences/settings";
const EXCLUDED = "spotlight.excluded";

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await page.route("**/api/stocks/quotes**", (route) =>
    route.fulfill({
      json: { quotes: [{ symbol: "AAPL", price: 231.5, change: 1.25 }] },
    }),
  );
  await openDesktop(page, base, step);
  const made = [];
  const upload = async (name, type, text) => {
    made.push(await uploadFile(page, { parent: "documents", name, type, text }));
  };
  await upload(CODE, "text/x-python", "print('hello')");
  await upload(TEXT, "text/plain", "words");
  await upload(
    PICTURE,
    "image/svg+xml",
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="teal"/></svg>',
  );
  await upload(PDF, "application/pdf", "%PDF-1.4\n%%EOF");
  await upload(OTHER, "application/octet-stream", "bits");

  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  const results = page.getByRole("listbox", { name: "Results" });
  const inGroup = (group, name) =>
    page
      .getByRole("group", { name: group, exact: true })
      .getByRole("option", { name, exact: false })
      .first();
  const open = async () => {
    if (await field.isVisible().catch(() => false)) return;
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    await field.waitFor({ timeout: 5_000 });
  };
  const type = async (text) => {
    await open();
    await field.fill("");
    await field.fill(text);
  };
  const gone = () => until(async () => !(await field.isVisible().catch(() => false)));
  const windowNamed = (text) => page.locator(".mac-window").filter({ hasText: text }).first();
  const closeWindows = async () => {
    for (const close of await page
      .locator(".mac-window")
      .getByRole("button", { name: "Close", exact: true })
      .all()) {
      await close.click({ timeout: 2_000 }).catch(() => undefined);
    }
    await page.waitForTimeout(300);
  };

  const settingsThen = (await api(page, "GET", SETTINGS)).json.values ?? {};
  try {
    // The window.
    await open();
    step("The menu bar's extra opens Spotlight", await field.isVisible());
    await field.fill("Calc");
    await inGroup("Top Hit", "Calculator").waitFor({ timeout: 8_000 });
    await page.keyboard.press("Escape");
    step(
      "Escape clears what was typed first",
      (await field.inputValue()) === "" && (await field.isVisible()),
    );
    await shot(page, path.join(out, `spotlight-escape-${browserName}.png`));
    await page.keyboard.press("Escape");
    step("and closes it the second time", await gone());
    await open();
    await page.mouse.click(30, 500);
    step("A press beside it closes it", await gone());
    await shot(page, path.join(out, `spotlight-beside-${browserName}.png`));

    // Top Hit.
    await type("Calculator");
    const first = results.getByRole("option").first();
    await inGroup("Top Hit", "Calculator").waitFor({ timeout: 8_000 });
    step(
      "An exact name is the Top Hit, first and selected",
      (await first.innerText()).includes("Calculator") &&
        (await first.getAttribute("aria-selected")) === "true",
    );
    await shot(page, path.join(out, `spotlight-top-hit-${browserName}.png`));
    await page.keyboard.press("Enter");
    await gone();
    step(
      "Return opens it",
      await until(() => page.locator('[data-window-id="calculator"]').isVisible()),
    );
    await closeWindows();

    // Files by kind, with a group for code.
    await type(WORD);
    const developer = inGroup("Developer", CODE).or(inGroup("Top Hit", CODE));
    await developer.first().waitFor({ timeout: 20_000 });
    await shot(page, path.join(out, `spotlight-file-kinds-${browserName}.png`));
    step(
      "A program is under Developer, a picture under Images and a paper under PDF Documents",
      (await inGroup("Images", PICTURE).count()) === 1 &&
        (await inGroup("PDF Documents", PDF).count()) === 1,
    );

    // The arrows.
    const selected = () => results.locator('[role="option"][aria-selected="true"]').innerText();
    const started = await selected();
    await page.keyboard.press("ArrowDown");
    const below = await selected();
    step("Down selects the next result", below !== started, below);
    await shot(page, path.join(out, `spotlight-arrows-${browserName}.png`));
    await page.keyboard.press("ArrowUp");
    step("and Up the one before", (await selected()) === started);
    const groupOfSelected = () =>
      results
        .locator('[role="option"][aria-selected="true"]')
        .evaluate(
          (element) =>
            document.getElementById(element.parentElement?.getAttribute("aria-labelledby"))
              ?.textContent,
        );
    const groupBefore = await groupOfSelected();
    await page.keyboard.press("Control+ArrowDown");
    step(
      "Command-Down goes to the next group",
      (await groupOfSelected()) !== groupBefore,
      await groupOfSelected(),
    );
    await page.keyboard.press("Control+ArrowUp");
    step("and Command-Up back", (await groupOfSelected()) === groupBefore);

    // Each kind of file to its application.
    const openFile = async (name) => {
      await type(WORD);
      const option = results.getByRole("option", { name });
      await option.waitFor({ timeout: 15_000 });
      await option.click();
      await page.keyboard.press("Enter");
      await gone();
    };
    await openFile(TEXT);
    step("A text file opens in TextEdit", await until(() => windowNamed(TEXT).isVisible()));
    await shot(page, path.join(out, `spotlight-to-textedit-${browserName}.png`));
    await closeWindows();
    await openFile(PICTURE);
    const preview = page.locator('[data-window-id^="preview"]');
    step("A picture opens in Preview", await until(() => preview.first().isVisible()));
    await shot(page, path.join(out, `spotlight-to-preview-${browserName}.png`));
    await closeWindows();
    await openFile(PDF);
    step("A PDF opens in Preview", await until(() => preview.first().isVisible()));
    await closeWindows();
    await openFile(OTHER);
    const finder = page.locator(".mac-window.mac-finder").first();
    step(
      "Any other file shows in Finder, selected",
      await until(() =>
        finder.locator('[aria-selected="true"]', { hasText: OTHER }).first().isVisible(),
      ),
    );
    await shot(page, path.join(out, `spotlight-to-finder-${browserName}.png`));
    await closeWindows();

    // A double click.
    await type(WORD);
    await results.getByRole("option", { name: TEXT }).dblclick();
    await gone();
    step("A double click opens the result", await until(() => windowNamed(TEXT).isVisible()));
    await closeWindows();

    // Fonts.
    await type("Avenir Next");
    await inGroup("Top Hit", "Avenir Next").waitFor({ timeout: 8_000 });
    await shot(page, path.join(out, `spotlight-font-${browserName}.png`));
    step(
      "A font's name is listed, with the rest under Fonts",
      (await inGroup("Fonts", "Avenir Next Condensed").count()) === 1,
    );
    await page.keyboard.press("Enter");
    await gone();
    const fontBook = page.locator('[data-window-id="font-book"]');
    await fontBook.waitFor({ timeout: 10_000 });
    step(
      "Return shows it selected in Font Book",
      await until(() =>
        fontBook.locator('[aria-selected="true"]', { hasText: "Avenir Next" }).first().isVisible(),
      ),
    );
    const fontRow = fontBook.locator('[role="treegrid"] [aria-selected="true"]', {
      hasText: "Avenir Next",
    });
    const rowInView = () =>
      fontRow
        .first()
        .evaluate((row) => {
          const list = row.closest('[role="rowgroup"]').getBoundingClientRect();
          const { top, bottom } = row.getBoundingClientRect();
          return top >= list.top && bottom <= list.bottom;
        })
        .catch(() => false);
    step("and in view", await until(rowInView));
    await fontBook
      .locator('[role="rowgroup"]')
      .first()
      .evaluate((list) => {
        list.scrollTop = list.scrollHeight;
      });
    await page.waitForTimeout(200);
    await type("Avenir Next");
    await inGroup("Top Hit", "Avenir Next").waitFor({ timeout: 8_000 });
    await page.keyboard.press("Enter");
    await gone();
    step("Asked for again after a scroll away, it comes back into view", await until(rowInView));
    await closeWindows();

    // A sum, a conversion, a definition, a pane.
    await type("12*12");
    await inGroup("Calculator", "= 144").waitFor({ timeout: 8_000 });
    step("A sum is answered", true);
    await shot(page, path.join(out, `spotlight-sum-${browserName}.png`));
    await page.keyboard.press("Enter");
    await gone();
    step(
      "and Return opens Calculator",
      await until(() => page.locator('[data-window-id="calculator"]').isVisible()),
    );
    await closeWindows();
    await type("12 inches in cm");
    step("A conversion is answered", await until(() => inGroup("Conversion", "30.48").isVisible()));
    await shot(page, path.join(out, `spotlight-conversion-${browserName}.png`));
    await type("Dock");
    const pane = inGroup("System Preferences", "Dock").or(inGroup("Top Hit", "Dock"));
    await pane.first().waitFor({ timeout: 8_000 });
    await pane.first().click();
    await page.keyboard.press("Enter");
    await gone();
    step(
      "A pane opens in System Preferences",
      await until(() => windowNamed("Minimize windows using").isVisible()),
    );
    await shot(page, path.join(out, `spotlight-to-pane-${browserName}.png`));
    await closeWindows();
    await type("serendipity");
    const definition = page.getByRole("group", { name: "Definition", exact: true });
    await definition.waitFor({ timeout: 8_000 });
    await definition.getByRole("option").click();
    await page.keyboard.press("Enter");
    await gone();
    const dictionary = page.locator('[data-window-id="dictionary"]');
    step(
      "A definition opens Dictionary on that word",
      await until(async () =>
        (await dictionary.innerText().catch(() => "")).includes("serendipity"),
      ),
    );
    await shot(page, path.join(out, `spotlight-to-dictionary-${browserName}.png`));
    await closeWindows();

    // Suggestions.
    await type("AAPL");
    const quote = inGroup("Stocks", "AAPL 231.50");
    step("Capitals ask for a stock's quote", await until(() => quote.isVisible()));
    await quote.click();
    await shot(page, path.join(out, `spotlight-stock-${browserName}.png`));
    await type(`Zanzibar ${tag}`);
    const maps = inGroup("Maps", "Search Maps");
    await maps.waitFor({ timeout: 8_000 });
    await maps.click();
    await page.keyboard.press("Enter");
    await gone();
    step(
      "Search Maps hands the words to Maps",
      await until(async () =>
        (
          await page
            .locator('[data-window-id="maps"]')
            .getByRole("searchbox")
            .or(page.locator('[data-window-id="maps"] input'))
            .first()
            .inputValue()
            .catch(() => "")
        ).includes(`Zanzibar ${tag}`),
      ),
    );
    await closeWindows();

    // Search Results, switched off in its own pane.
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "System Preferences", exact: true })
      .click();
    const prefs = page.locator('[data-window-id="system-preferences"]');
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+l");
    await prefs.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 5_000 });
    await prefs.getByRole("button", { name: "Spotlight", exact: true }).first().click();
    const box = (name) =>
      prefs.getByRole("grid", { name: "Categories" }).getByRole("checkbox", { name, exact: true });
    await box("Applications").click();
    await box("Fonts").click();
    await shot(page, path.join(out, `spotlight-results-pane-${browserName}.png`));
    step(
      "Search Results' boxes are kept on the server",
      await until(async () => {
        const stored = (await api(page, "GET", SETTINGS)).json.values?.[EXCLUDED];
        return stored?.includes("Applications") && stored?.includes("Fonts");
      }),
    );
    await closeWindows();
    await page.waitForTimeout(1_500);
    await page.reload();
    await openDesktop(page, base, step);
    await type("Calculator");
    await page.waitForTimeout(800);
    step(
      "Search Results leaves out what is switched off",
      (await results.getByRole("option", { name: "Calculator", exact: true }).count()) === 0,
    );
    await shot(page, path.join(out, `spotlight-excluded-${browserName}.png`));
    await type("Avenir Next");
    await page.waitForTimeout(500);
    step(
      "Fonts too",
      (await results.getByRole("option", { name: "Avenir Next", exact: true }).count()) === 0,
    );
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await gone();
  } finally {
    await page.waitForTimeout(1_500);
    const { json } = await api(page, "GET", SETTINGS);
    const values = { ...(json.values ?? {}) };
    if (EXCLUDED in settingsThen) values[EXCLUDED] = settingsThen[EXCLUDED];
    else delete values[EXCLUDED];
    await api(page, "PUT", SETTINGS, { values, rev: json.rev });
    if (made.length > 0) {
      await api(page, "POST", "/api/files/ops", {
        ops: made.map((id) => ({ op: "trash", id })),
      });
    }
  }
});
