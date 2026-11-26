#!/usr/bin/env node
// Podcasts on Ferrite: File > Add a Show by URL reads a real feed and follows the show, which is kept
// across a reload; an address the app may not read is refused with the reason, and the sheet stays;
// Edit > Find gives the search field the keyboard; New Station and the text rows are dimmed.
// It runs in a fresh browser signed in as a new Guest User (journey-kit's openDesktop), so the library
// it forgets at the end is that guest's own, never a person's.
//
//   node e2e/podcasts-add-show-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("podcasts-add-show", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const LIBRARY = "/api/podcasts/library";
const FEED = "https://feeds.npr.org/510289/podcast.xml";
const REFUSED = "https://example.com/feed.xml";

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Podcasts");
  const window = page.getByRole("region", { name: "Podcasts", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });

  for (const [title, row, words] of [
    ["Edit", "Undo", "nothing here to undo"],
    ["Edit", "Paste", "search field"],
  ]) {
    const state = await menuItemState(page, title, row);
    step(
      `${title} > ${row} is dimmed, saying why`,
      state.disabled === true && (state.title ?? "").includes(words),
      state.title ?? "",
    );
  }

  await chooseMenu(page, "Edit", "Find");
  step(
    "Edit > Find gives the search field the keyboard",
    await window
      .locator('input[type="search"]')
      .evaluate((field) => document.activeElement === field),
  );

  await chooseMenu(page, "File", "Add a Show by URL…");
  const sheet = page.getByRole("dialog", { name: "Add a Show by URL" });
  await sheet.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  const hangs = await sheet.evaluate((popup) => {
    const bar = document.querySelector(
      ".mac-podcasts .mac-media-app-chrome-bar, .mac-media-app-chrome-bar",
    );
    return { top: popup.getBoundingClientRect().top, bar: bar?.getBoundingClientRect().bottom };
  });
  step(
    "the sheet hangs from the top of the window, under its toolbar",
    hangs.bar !== undefined && Math.abs(hangs.top - hangs.bar) <= 2,
    JSON.stringify(hangs),
  );
  const field = sheet.getByRole("textbox", { name: "Feed address" });
  await field.fill(REFUSED);
  expectRefusal(400, "/api/podcasts/feed");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await sheet.getByText(/example\.com/).waitFor({ timeout: 10_000 });
  step("an address the app may not read is refused, the sheet stays and says why", true);
  await shot(page, path.join(out, "podcasts-add-refused.png"));

  await field.fill(FEED);
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === LIBRARY &&
      (response.request().postData() ?? "").includes(FEED),
    { timeout: 20_000 },
  );
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await sheet.waitFor({ state: "detached", timeout: 30_000 });
  step("the show is saved in the person's library", (await saved).status() === 200);
  const stored = (await api(page, "GET", LIBRARY)).json.library;
  const show = stored?.shows?.find((each) => each.feed === FEED);
  step(
    "the library holds it with the title its feed gives",
    Boolean(show?.title) && /^feed-/.test(show?.id ?? ""),
    `${show?.id} ${show?.title}`,
  );
  await window
    .getByText(show?.title ?? "", { exact: false })
    .first()
    .waitFor({ timeout: 10_000 });
  await window.locator("[data-episode-id]").first().waitFor({ timeout: 20_000 });
  step("its page opens, with the feed's episodes", true);
  await shot(page, path.join(out, "podcasts-added-show.png"));

  await reloadDesktop(page);
  await launch(page, "Podcasts");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await window.getByRole("treeitem", { name: "Shows" }).click();
  await window
    .getByText(show?.title ?? "?", { exact: false })
    .first()
    .waitFor({ timeout: 15_000 });
  step("after a reload it is listed under Shows", true);
  await shot(page, path.join(out, "podcasts-added-shows.png"));

  await window
    .getByRole("button", { name: new RegExp(show?.title ?? "?") })
    .first()
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy Link", exact: true }).click();
  await page.waitForTimeout(500);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  step(
    "Copy Link on a show added by address copies its feed, not an Apple page",
    copied === FEED,
    copied,
  );

  // Up Next keeps an episode of the show after it is unfollowed, and the episode still reaches it.
  await window
    .getByRole("button", { name: new RegExp(show?.title ?? "?") })
    .first()
    .click();
  const firstEpisode = window.locator("[data-episode-id]").first();
  const queued = (await firstEpisode.locator(".mac-card-grid-card-text").first().innerText())
    .split("\n")[0]
    .trim();
  await firstEpisode.click({ button: "right", position: { x: 120, y: 20 } });
  await page.getByRole("menuitem", { name: "Add to Up Next", exact: true }).click();
  await window.getByRole("button", { name: /^Unsubscribe$/i }).click();
  await page.waitForTimeout(800);
  await window.getByRole("treeitem", { name: "Listen Now" }).click();
  await window.getByText(queued, { exact: false }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Go to Show", exact: true }).click();
  await window.getByRole("heading", { name: show?.title ?? "?" }).click({ button: "right" });
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.getByRole("menuitem", { name: "Copy Link", exact: true }).click();
  await page.waitForTimeout(500);
  const afterLeaving = await page.evaluate(() => navigator.clipboard.readText());
  step(
    "after unfollowing, reached from its episode, Copy Link still copies its feed",
    afterLeaving === FEED,
    afterLeaving,
  );

  await chooseMenu(page, "File", "Add a Show by URL…");
  await sheet.waitFor({ timeout: 5_000 });
  await field.fill(FEED.replace("https://feeds.npr.org", "HTTP://Feeds.NPR.org"));
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await sheet.waitFor({ state: "detached", timeout: 30_000 });
  await page.waitForTimeout(1_000);
  const again = (await api(page, "GET", LIBRARY)).json.library;
  step(
    "adding the same feed again does not follow it twice, and does not unfollow it",
    again.shows.filter((each) => each.feed === FEED).length === 1,
  );
});

process.exit(0);
