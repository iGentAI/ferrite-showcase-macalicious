#!/usr/bin/env node
// Safari's windows on Ferrite: a second window, a private one that leaves no history, tabs moved
// between windows and a closed window reopened, against a real page the server fetches.
//
//   node e2e/safari-windows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]
//
// Writes screenshots to --out. Exits 0 only when every step passed and the page logged no console
// error, page error, failed request or HTTP error.

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const PAGE = "news.ycombinator.com";
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";
const { base, out } = options();
const { step, run } = journey("safari-windows", { ignoreOtherOrigins: true });

const safariWindows = (page) => page.getByRole("region", { name: "Safari", exact: true });
const fieldOf = (window) =>
  window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
const history = async (page) => (await api(page, "GET", "/api/safari/history")).json.history ?? [];

// A window may lie behind the others, so its button is pressed from script.
const closeAt = (page, at) =>
  safariWindows(page)
    .nth(at)
    .getByRole("button", { name: "Close", exact: true })
    .evaluate((button) => button.click());
const closeFirst = (page) => closeAt(page, 0);

async function go(page, window, address) {
  await fieldOf(window).fill(address);
  await page.keyboard.press("Enter");
  await window
    .locator("iframe[srcdoc]")
    .waitFor({ timeout: 25_000 })
    .catch(async (error) => {
      const shown = await window.locator(".mac-safari-content").innerText();
      throw new Error(`no page frame; the window shows: ${shown.slice(0, 300)}\n${error}`);
    });
  await page.waitForTimeout(400);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const first = safariWindows(page).first();
  await first.waitFor({ state: "visible", timeout: 15_000 });
  await go(page, first, PAGE);

  // ---- A second window ------------------------------------------------------------------------
  await chooseMenu(page, "File", "New Window");
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 2,
  );
  const second = safariWindows(page).nth(1);
  step(
    "File > New Window opens a second window, on the start page",
    (await second.locator("iframe[srcdoc]").count()) === 0,
  );
  step("the first window keeps its page", (await first.locator("iframe[srcdoc]").count()) === 1);
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "safari-two-windows.png"));
  await page.waitForTimeout(1_500);
  const kept = await api(page, "GET", "/api/safari/tabs");
  step(
    "the kept tabs stay the first window's",
    JSON.stringify(kept.json).includes("ycombinator"),
    JSON.stringify(kept.json).slice(0, 200),
  );

  // ---- A private window -----------------------------------------------------------------------
  await page.evaluate(() => {
    const ask = (detail) =>
      window.dispatchEvent(new CustomEvent("macalicious:desktop-effects", { detail }));
    ask([{ newWindow: "safari" }]);
    ask([{ newWindow: "safari", opening: { isPrivate: true, seeds: [] } }]);
  });
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 4,
  );
  step(
    "a plain and a private window asked for at once are two windows, each what it was asked to be",
    (await page.locator(".mac-safari[data-private]").count()) === 1 &&
      (await safariWindows(page).nth(2).getAttribute("data-private")) === null,
  );
  for (const at of [3, 2]) {
    await closeAt(page, at);
  }
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 2,
  );
  await chooseMenu(page, "File", "New Private Window");
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 3,
  );
  const secret = page.locator(".mac-safari[data-private]");
  await secret.waitFor({ timeout: 5_000 });
  step(
    "File > New Private Window says it is private",
    await secret.getByText(/Private Browsing is on/).isVisible(),
  );
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "safari-private-window.png"));
  const before = await history(page);
  await fieldOf(secret).fill(PAGE);
  await page.keyboard.press("Enter");
  await secret.locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  await page.waitForTimeout(800);
  const after = await history(page);
  step(
    "a page opened in it is not added to the history",
    before.length > 0 && JSON.stringify(after) === JSON.stringify(before),
    JSON.stringify(after[0]),
  );
  await secret.getByRole("button", { name: "close", exact: false }).first().click();
  await secret.waitFor({ state: "detached", timeout: 5_000 });

  // ---- Tabs between windows -------------------------------------------------------------------
  await second.click({ position: { x: 300, y: 12 } });
  await chooseMenu(page, "File", "New Tab");
  await page.waitForTimeout(300);
  await go(page, second, PAGE);
  await chooseMenu(page, "Window", "Move Tab to New Window");
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 3,
  );
  const third = safariWindows(page).nth(2);
  await third.locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  step("Move Tab to New Window opens that page in a window of its own", true);
  step(
    "and the window it left has one tab fewer",
    (await second.locator("iframe[srcdoc]").count()) === 0,
  );
  await chooseMenu(page, "Window", "Merge All Windows");
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 1,
  );
  const left = safariWindows(page).first();
  await page.waitForTimeout(500);
  step(
    "Merge All Windows leaves one window with every tab",
    (await left.getByRole("tab").count()) === 3,
    String(await left.getByRole("tab").count()),
  );
  await shot(page, path.join(out, "safari-merged.png"));

  // ---- Reopen Last Closed Window --------------------------------------------------------------
  await chooseMenu(page, "File", "New Window");
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 2,
  );
  const last = safariWindows(page).nth(1);
  await go(page, last, PAGE);
  await fieldOf(last).focus();
  await page.keyboard.press(`${COMMAND}+Shift+w`);
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 1,
  );
  step("Shift-Command-W closes the window", true);
  await chooseMenu(page, "History", "Reopen Last Closed Window");
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 2,
  );
  await safariWindows(page).nth(1).locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  step("History > Reopen Last Closed Window brings its page back", true);

  // ---- Two windows at once, with none open ----------------------------------------------------
  for (let open = await safariWindows(page).count(); open > 0; open -= 1) {
    await closeFirst(page);
    await page.waitForFunction(
      (left) => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === left,
      open - 1,
    );
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const ask = () =>
      window.dispatchEvent(
        new CustomEvent("macalicious:desktop-effects", { detail: [{ newWindow: "safari" }] }),
      );
    ask();
    ask();
  });
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 2,
  );
  await safariWindows(page).first().locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  step(
    "of two windows opened together, only the first takes the kept tabs",
    (await safariWindows(page).nth(1).locator("iframe[srcdoc]").count()) === 0,
  );
  await closeFirst(page);
  await page.waitForFunction(
    () => document.querySelectorAll('[role="region"][aria-label="Safari"]').length === 1,
  );
  await go(page, safariWindows(page).first(), PAGE);
  await page.waitForTimeout(2_000);
  const taken = (await api(page, "GET", "/api/safari/tabs")).json;
  step(
    "when it closes the other takes over, and what is kept is its one tab",
    JSON.stringify(taken).includes("ycombinator") &&
      (taken.tabs?.tabs ?? taken.document?.tabs ?? taken.tabs)?.length === 1,
    JSON.stringify(taken).slice(0, 200),
  );
});

process.exit(0);
