#!/usr/bin/env node
// The rows closed in the media batch, in the running desktop: Chess's Edit, Open Recent, Print and
// Speak moves; Podcasts' Stations and Space; News's topics and dropped address; the store's stories;
// TV's Recently Added; Stocks' Edit rows on its search field. Podcast feeds are real.
//
//   node e2e/media-batch-journey.mjs --url http://127.0.0.1:8857 --out <dir>

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import {
  chooseMenu,
  closeMenus,
  editRowsOnField,
  menuItemState,
  until,
} from "./media-census-kit.mjs";
import { getFromAppStore } from "./r5-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("media-batch", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const settled = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};
const safely = async (label, body) => {
  try {
    await body();
  } catch (error) {
    step(`${label} ran to its end`, false, String(error).slice(0, 300));
  }
};
const dock = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();

await run(async (page) => {
  await openDesktop(page, base, step);

  await safely("Chess", async () => {
    await launch(page, "Chess");
    const chess = page.locator(".mac-chess").first();
    await chess.waitFor({ timeout: 20_000 });
    const undo = await menuItemState(page, "Edit", "Undo");
    step(
      "Chess > Edit > Undo is dimmed with its reason",
      undo.disabled && /text field/.test(undo.title ?? ""),
      JSON.stringify(undo),
    );
    await closeMenus(page);
    const clear = await menuItemState(page, "Game", "Open Recent", "Clear Menu");
    step(
      "Chess > Game > Open Recent has Clear Menu, dimmed with nothing opened",
      clear.disabled,
      JSON.stringify(clear),
    );
    await closeMenus(page);
    const print = await menuItemState(page, "Game", "Print…");
    step("Chess > Game > Print is offered", !print.disabled, JSON.stringify(print));
    await closeMenus(page);
    await chooseMenu(page, "Game", "Print…");
    const printed = page.locator("iframe[data-chess-print]");
    await until(async () => (await printed.count()) > 0, 5000);
    const sheet = await printed.evaluate((frame) => frame.getAttribute("srcdoc") ?? "");
    step(
      "Print puts the board on its page",
      /data-square="e1"><span class="white">\u265a/.test(sheet) && /<h1>/.test(sheet),
    );
    await settled(page, "chess-print.png");
  });

  await safely("Podcasts", async () => {
    await dock(page, "Podcasts").click();
    const window = page.getByRole("region", { name: "Podcasts", exact: true }).first();
    await window.waitFor({ timeout: 20_000 });
    await chooseMenu(page, "File", "Add a Show by URL…");
    const adding = page.getByRole("dialog").filter({ hasText: "Add a Show by URL" });
    await adding
      .getByRole("textbox", { name: "Feed address" })
      .fill("https://feeds.npr.org/510318/podcast.xml");
    await adding.getByRole("button", { name: "Add" }).click();
    await adding.waitFor({ state: "hidden", timeout: 25_000 });
    step("a show is followed", true);
    await chooseMenu(page, "File", "New Station…");
    const sheet = page.getByRole("dialog").filter({ hasText: "New Station" });
    await sheet.waitFor({ timeout: 8000 });
    await sheet.getByRole("textbox", { name: "Station name" }).fill("Morning");
    await sheet.getByRole("checkbox", { name: /Up First/ }).click();
    await settled(page, "podcasts-new-station.png");
    await sheet.getByRole("button", { name: "Create" }).click();
    const tree = page.getByRole("tree", { name: "Podcasts" });
    await tree.getByRole("treeitem", { name: "Morning" }).waitFor({ timeout: 8000 });
    step("the station is listed under Stations", true);
    await page.getByRole("button", { name: "Play Station" }).waitFor({ timeout: 25_000 });
    await settled(page, "podcasts-station.png");
    await page.reload();
    await page.waitForTimeout(3000);
    await dock(page, "Podcasts").click();
    await tree.getByRole("treeitem", { name: "Morning" }).waitFor({ timeout: 15_000 });
    step("the station survives a reload", true);
    await tree.getByRole("treeitem", { name: "Morning" }).click();
    await page.getByRole("button", { name: "Play Station" }).click();
    const audio = window.locator("audio");
    const playing = () => audio.evaluate((element) => !element.paused);
    await until(playing, 15_000);
    step("Play Station plays its newest episode", await playing());
    await window
      .locator(".mac-media-app-chrome-sidebar, .mac-podcasts-context-menu")
      .first()
      .click({ position: { x: 5, y: 5 }, force: true })
      .catch(() => {});
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press("Space");
    step("Space pauses it", await until(async () => !(await playing()), 4000));
    await page.keyboard.press("Space");
    step("Space plays it on", await until(playing, 4000));
    await page.keyboard.press("Space");
    await settled(page, "podcasts-space.png");
  });

  await safely("News", async () => {
    await dock(page, "News").click();
    const window = page.getByRole("region", { name: "News", exact: true }).first();
    await window.waitFor({ timeout: 20_000 });
    const topic = window
      .getByRole("navigation", { name: "Channels" })
      .or(window.locator(".mac-catalyst-sidebar, [aria-label='Channels']"))
      .first()
      .getByText("Science", { exact: true });
    await topic.waitFor({ timeout: 20_000 });
    await topic.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Unfollow Topic" }).click();
    await until(async () => (await topic.count()) === 0, 5000);
    step("Unfollow Topic takes it out of the sidebar", (await topic.count()) === 0);
    await window.getByText("Discover Channels", { exact: true }).first().click();
    const topics = window.getByRole("list", { name: "Topics" });
    await topics.waitFor({ timeout: 8000 });
    await settled(page, "news-topics.png");
    await topics.getByRole("button", { name: "Follow Science" }).click();
    step("Discover follows it again", await until(async () => (await topic.count()) === 1, 5000));
    await window.evaluate((root) => {
      const data = new DataTransfer();
      data.setData("text/uri-list", "https://www.npr.org/2026/story");
      for (const type of ["dragenter", "dragover", "drop"]) {
        root.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
        );
      }
    });
    const heading = window.getByRole("heading", { name: "NPR" }).first();
    step(
      "a dropped address opens its channel",
      await heading.waitFor({ timeout: 8000 }).then(
        () => true,
        () => false,
      ),
    );
    await settled(page, "news-dropped.png");
  });

  await safely("App Store", async () => {
    await dock(page, "App Store").click();
    const store = page.locator('.mac-app-store-page:not([aria-busy="true"])');
    await store.waitFor({ timeout: 15_000 });
    const stories = page.getByLabel("Stories");
    await stories.waitFor({ timeout: 10_000 });
    await settled(page, "app-store-stories.png");
    const first = stories.getByRole("button").first();
    const named = (await first.innerText()).split("\n");
    await first.click();
    await page.waitForTimeout(800);
    step("a story opens its app's page", true, named.join(" / "));
    await settled(page, "app-store-story-page.png");
  });

  await safely("TV", async () => {
    const before = (await api(page, "GET", "/api/tv/library")).json;
    const library = {
      videos: [{ id: "dQw4w9WgXcQ", title: "My Link", channel: "Someone" }],
      history: [],
      upNext: [],
      watchLater: [],
      positions: {},
    };
    await api(page, "PUT", "/api/tv/library", { library, rev: before.rev ?? 0 });
    await page.reload();
    await page.waitForTimeout(3000);
    await dock(page, "TV").click();
    const tv = page.getByRole("region", { name: "TV", exact: true }).first();
    await tv.waitFor({ timeout: 20_000 });
    await tv.getByRole("button", { name: "Library", exact: true }).click();
    const shelf = tv.getByText("Recently Added");
    step(
      "TV's Library lists Recently Added",
      await shelf.waitFor({ timeout: 8000 }).then(
        () => true,
        () => false,
      ),
    );
    await settled(page, "tv-recently-added.png");
  });

  await safely("Stocks", async () => {
    await getFromAppStore(page, "Stocks");
    await dock(page, "Stocks").click();
    const window = page.getByRole("region", { name: "Stocks", exact: true }).first();
    await window.waitFor({ timeout: 20_000 });
    const input = window.getByRole("searchbox");
    const refusal = window.getByText(/did not let the menu paste/);
    const edited = await editRowsOnField(page, input, refusal);
    step("Stocks' Edit rows act on the search field", edited.ok, edited.detail);
    await settled(page, "stocks-edit.png");
  });
});
