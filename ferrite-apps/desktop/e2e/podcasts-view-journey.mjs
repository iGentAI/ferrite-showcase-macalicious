#!/usr/bin/env node
// Podcasts: the last place and the Episodes list's order, kept over a reload. The show is a real
// feed, added through File > Add a Show by URL in a fresh guest's library.
//
//   node e2e/podcasts-view-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("podcasts-view", { ignoreOtherOrigins: true });
const FEED = "https://feeds.npr.org/510289/podcast.xml";
const SETTINGS = "/api/system-preferences/settings";

const episodesList = (window) =>
  window.getByRole("region", { name: /^\d+ Episodes?$/ }).getByRole("listitem");

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Podcasts");
  let window = page.getByRole("region", { name: "Podcasts", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });

  await chooseMenu(page, "File", "Add a Show by URL…");
  const sheet = page.getByRole("dialog", { name: "Add a Show by URL" });
  await sheet.getByRole("textbox", { name: "Feed address" }).fill(FEED);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await sheet.waitFor({ state: "hidden", timeout: 30_000 });

  await window.getByRole("treeitem", { name: /Episodes/ }).click();
  await episodesList(window).first().waitFor({ timeout: 30_000 });
  const newest = await episodesList(window).first().innerText();
  step("Episodes runs newest first", newest.length > 0, newest.slice(0, 60));

  await chooseMenu(page, "View", "Oldest First");
  step(
    "View > Oldest First turns the list round",
    await until(async () => (await episodesList(window).first().innerText()) !== newest, 5_000),
  );
  const oldest = await episodesList(window).first().innerText();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "podcasts-oldest-first.png"));

  step(
    "the server keeps the place and the order",
    await until(async () => {
      const { json } = await api(page, "GET", SETTINGS);
      const view = json.values?.["podcasts.view"];
      return view?.section === "episodes" && view?.episodes === "oldest";
    }, 5_000),
  );

  await reloadDesktop(page);
  await launch(page, "Podcasts");
  window = page.getByRole("region", { name: "Podcasts", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await episodesList(window).first().waitFor({ timeout: 30_000 });
  step(
    "after a reload the window opens on Episodes, oldest first",
    (await episodesList(window).first().innerText()) === oldest,
  );

  await chooseMenu(page, "View", "Newest First");
  step(
    "View > Newest First turns it back",
    await until(async () => (await episodesList(window).first().innerText()) === newest, 5_000),
  );
});

process.exit(0);
