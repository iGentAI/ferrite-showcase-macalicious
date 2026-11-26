#!/usr/bin/env node
// Safari's address field and Back button on Ferrite: suggestions from the person's own pages, Search
// Results SnapBack, and Back held down for its list, against real pages the server fetches.
//
//   node e2e/safari-search-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("safari-search", { ignoreOtherOrigins: true });

const fieldOf = (window) =>
  window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const go = async (address, opensBefore = false) => {
    const answered = opensBefore
      ? null
      : page.waitForResponse(/\/api\/safari\/page\?/, { timeout: 30_000 });
    await fieldOf(window).fill(address);
    await page.keyboard.press("Enter");
    await (await answered)?.finished();
    await page.waitForTimeout(500);
  };
  const shown = () => fieldOf(window).evaluate((input) => input.value);

  await go("news.ycombinator.com");
  await window.locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  await go("https://news.ycombinator.com/newest");
  await window.locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });

  // ---- Suggestions ----------------------------------------------------------------------------
  await fieldOf(window).click();
  await page.keyboard.type("news.yc");
  const list = window.getByRole("listbox", { name: "Suggestions" });
  await list.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "safari-suggestions.png"));
  step(
    "typing lists the pages Safari knows, the best as Top Hit, and the search",
    (await list.getByRole("option").first().innerText()).includes("Top Hit") &&
      (await list.getByRole("option").last().innerText()).includes("Search for"),
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await list.waitFor({ state: "detached", timeout: 5_000 });
  await page.waitForTimeout(1_000);
  step(
    "Down and Return open the row chosen",
    (await shown()).includes("ycombinator"),
    await shown(),
  );

  // ---- Back held ------------------------------------------------------------------------------
  const back = window.getByRole("button", { name: "Back", exact: true });
  const box = await back.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const row = page.getByRole("menuitem", { name: "Hacker News" }).first();
  await row.waitFor({ timeout: 4_000 });
  await page.mouse.up();
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-back-held.png"));
  const rows = await page.getByRole("menu", { name: "Back" }).getByRole("menuitem").count();
  step("holding Back lists the pages behind", rows >= 1, String(rows));
  await page.getByRole("menu", { name: "Back" }).getByRole("menuitem").last().click();
  await page.waitForTimeout(800);
  step(
    "a row of the list goes to that page",
    await window.getByRole("button", { name: "Forward", exact: true }).isEnabled(),
  );

  // ---- SnapBack -------------------------------------------------------------------------------
  await go("catalina");
  await go("news.ycombinator.com", true);
  await chooseMenu(page, "History", "Search Results SnapBack");
  await page.waitForTimeout(800);
  await fieldOf(window).click();
  step(
    "Search Results SnapBack returns to the search",
    (await shown()).includes("search=catalina"),
    await shown(),
  );
});

process.exit(0);
