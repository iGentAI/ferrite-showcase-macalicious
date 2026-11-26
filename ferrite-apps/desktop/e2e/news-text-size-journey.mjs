#!/usr/bin/env node
// News on Ferrite: a story's text size from the View menu and its keys, kept across a reload, with
// the rows dimmed at each end; Print, Suggest More and Less and Report a Concern dimmed, saying why.
// It runs in a fresh browser signed in as a new Guest User, on the real feeds.
//
//   node e2e/news-text-size-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menubar, menuItemState } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("news-text-size", { ignoreOtherOrigins: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "News");
  const window = page.getByRole("region", { name: "News", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const links = window.locator(".mac-news-story-link");
  const reader = window.locator('[data-view="reader"]');
  const openStory = async () => {
    await links.first().waitFor({ state: "visible", timeout: 40_000 });
    await links.first().click();
    await reader.waitFor({ timeout: 10_000 });
  };
  const scale = () => reader.evaluate((article) => article.style.zoom);
  const headlineHeight = () =>
    reader.locator(".mac-news-title").evaluate((title) => title.getBoundingClientRect().height);

  await links.first().waitFor({ state: "visible", timeout: 40_000 });
  const none = await menuItemState(page, "View", "Make Text Bigger");
  step(
    "with no story open the text rows are dimmed, saying why",
    none.disabled === true,
    none.title,
  );

  await openStory();
  const before = await headlineHeight();
  await chooseMenu(page, "View", "Make Text Bigger");
  await page.waitForTimeout(200);
  step(
    "View > Make Text Bigger draws the story larger",
    (await scale()) === "1.15" && (await headlineHeight()) > before,
    await scale(),
  );
  await page.keyboard.press("ControlOrMeta+=");
  await page.waitForTimeout(200);
  step("its key makes it larger again", (await scale()) === "1.3", await scale());
  await page.keyboard.press("ControlOrMeta+-");
  await page.waitForTimeout(200);
  step("Make Text Smaller's key takes it back", (await scale()) === "1.15", await scale());
  await shot(page, path.join(out, "news-text-size.png"));
  await page.waitForTimeout(800);

  await reloadDesktop(page);
  await launch(page, "News");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await openStory();
  step("the size is kept across a reload", (await scale()) === "1.15", await scale());

  await chooseMenu(page, "View", "Actual Size");
  await page.waitForTimeout(200);
  step("View > Actual Size restores it", (await scale()) === "1", await scale());
  const actual = await menuItemState(page, "View", "Actual Size");
  step("and is dimmed at that size, saying why", actual.disabled === true, actual.title);
  await chooseMenu(page, "View", "Make Text Smaller");
  await page.waitForTimeout(200);
  const smallest = await menuItemState(page, "View", "Make Text Smaller");
  step("Make Text Smaller is dimmed at the smallest", smallest.disabled === true, smallest.title);
  await chooseMenu(page, "View", "Actual Size");

  for (const [title, row, words] of [
    ["File", "Print…", "open the story in Safari"],
    ["Story", "Suggest More Like This", "newest first"],
    ["Story", "Suggest Less Like This", "newest first"],
    ["Story", "Report a Concern…", "public feeds"],
  ]) {
    const state = await menuItemState(page, title, row);
    step(
      `${title} > ${row} is dimmed, saying why`,
      state.disabled === true && (state.title ?? "").includes(words),
      state.title ?? "",
    );
  }
  await menubar(page).getByRole("menuitem", { name: "Story", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Report a Concern…" }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "news-story-menu.png"));
  await page.keyboard.press("Escape");
});

process.exit(0);
