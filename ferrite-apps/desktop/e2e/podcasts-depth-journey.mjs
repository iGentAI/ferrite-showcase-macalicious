#!/usr/bin/env node
// Podcasts' depth on Ferrite: the contextual menus of a show and an episode and the menu bar's
// commands, each read back from the server, the audio element, the clipboard or the window, with
// real input and a real show found through Apple's directory.
//
//   node e2e/podcasts-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, until } from "./media-census-kit.mjs";

const SHOW = "Up First from NPR";
const SHOW_ID = "1222114325";
const { base, out } = options();
const { step, run } = journey("podcasts-depth", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

const item = (page, name) => page.getByRole("menuitem", { name, exact: true });
const stored = async (page) => {
  const { json } = await api(page, "GET", "/api/podcasts/library");
  return json.library ?? json;
};
const clipboard = (page) => page.evaluate(() => navigator.clipboard.readText());

await run(async (page) => {
  // Command is Meta on a Mac; elsewhere it is Control, and Control-arrows belong to Mission Control.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  await openDesktop(page, base, step);
  await launch(page, "Podcasts");
  const window = page.getByRole("region", { name: "Podcasts", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );

  // ---- A show's menu --------------------------------------------------------------------------
  await window.getByRole("searchbox").fill(SHOW);
  const card = window.getByRole("button", { name: new RegExp(SHOW) }).first();
  await card.waitFor({ timeout: 20_000 });
  await card.click({ button: "right" });
  await item(page, "Subscribe").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "podcasts-show-menu.png"));
  step(
    "a show's Settings is dimmed and says why",
    (await item(page, "Settings…").getAttribute("aria-disabled")) === "true" &&
      /every show/.test((await item(page, "Settings…").getAttribute("title")) ?? ""),
  );
  await item(page, "Copy Link").click();
  await until(async () => (await clipboard(page)).includes(SHOW_ID), 5_000);
  step("a show's Copy Link copies its page", (await clipboard(page)).includes(`id${SHOW_ID}`));

  await card.click({ button: "right" });
  await item(page, "Subscribe").click();
  await until(async () => (await stored(page)).shows?.some((show) => show.id === SHOW_ID), 10_000);
  step(
    "Subscribe in the menu follows the show on the server",
    (await stored(page)).shows?.some((show) => show.id === SHOW_ID),
  );

  await card.click({ button: "right" });
  const reread = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/podcasts/feed" &&
      /max_age=0(&|$)/.test(response.url()),
    { timeout: 15_000 },
  );
  await item(page, "Refresh Show").click();
  step("Refresh Show reads the feed again", (await reread).ok());

  await card.click({ button: "right" });
  await item(page, "Go to Show").click();
  await window
    .getByRole("button", { name: "Unsubscribe", exact: true })
    .waitFor({ timeout: 5_000 });
  step("Go to Show opens the show's page", true);

  // ---- An episode's menu ----------------------------------------------------------------------
  const firstPlay = window.getByRole("button", { name: /^Play / }).first();
  await firstPlay.waitFor({ timeout: 25_000 });
  const title = ((await firstPlay.getAttribute("aria-label")) ?? "").replace(/^Play /, "");
  const row = window
    .getByRole("button", { name: `Play ${title}`, exact: true })
    .locator("xpath=ancestor::*[@role='listitem'][1]");
  await row.click({ button: "right", position: { x: 120, y: 20 } });
  await item(page, "Mark as Played").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "podcasts-episode-menu.png"));
  await item(page, "Mark as Played").click();
  await until(async () => (await stored(page)).played?.length === 1, 10_000);
  step("Mark as Played keeps it on the server", (await stored(page)).played?.length === 1);
  step("a played episode says so in its row", /Played/.test(await row.innerText()));

  await row.click({ button: "right", position: { x: 120, y: 20 } });
  await item(page, "Mark as Unplayed").click();
  await until(async () => (await stored(page)).played?.length === 0, 10_000);
  step("Mark as Unplayed takes it back", (await stored(page)).played?.length === 0);

  await row.click({ button: "right", position: { x: 120, y: 20 } });
  await item(page, "Copy Link").click();
  await until(
    async () =>
      /^https?:/.test(await clipboard(page)) && !(await clipboard(page)).includes(`id${SHOW_ID}`),
    5_000,
  );
  const link = await clipboard(page);
  step("an episode's Copy Link copies its link", /^https?:/.test(link), link.slice(0, 90));

  await row.click({ button: "right", position: { x: 120, y: 20 } });
  await item(page, "Add to Up Next").click();
  await until(async () => (await stored(page)).queue?.length === 1, 10_000);
  step("Add to Up Next queues it on the server", (await stored(page)).queue?.[0]?.title === title);

  // From Listen Now's Up Next shelf, Go to Show comes back to the page.
  const places = window.getByRole("tree", { name: "Podcasts" });
  await places.getByRole("treeitem", { name: "Episodes" }).click();
  await places.getByRole("treeitem", { name: "Listen Now" }).click();
  const shelved = window.getByRole("button", { name: new RegExp(`, ${SHOW}$`) }).first();
  await shelved.waitFor({ timeout: 5_000 });
  await shelved.click({ button: "right" });
  await item(page, "Go to Show").click();
  await window
    .getByRole("button", { name: "Unsubscribe", exact: true })
    .waitFor({ timeout: 5_000 });
  step("Go to Show from Up Next opens the show's page", true);

  // Share hands the link to Notes, which makes a note of it.
  await row.click({ button: "right", position: { x: 120, y: 20 } });
  await item(page, "Share Episode").hover();
  await item(page, "Notes").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "podcasts-share-menu.png"));
  step(
    "AirDrop in Share is dimmed and says why",
    (await item(page, "AirDrop").getAttribute("aria-disabled")) === "true",
  );
  await item(page, "Notes").click();
  const notes = page.getByRole("region", { name: "Notes", exact: true }).first();
  await notes.waitFor({ state: "visible", timeout: 15_000 });
  step("Share > Notes opens Notes", true);
  await closeMenus(page);

  // ---- The menu bar's Controls and View ------------------------------------------------------
  await notes.getByRole("button", { name: "Close" }).first().click();
  await notes.waitFor({ state: "detached", timeout: 10_000 });
  const audio = (read) =>
    page.evaluate((property) => document.querySelector("audio")[property], read);
  const time = () => audio("currentTime");
  await firstPlay.click();
  await until(async () => (await time()) > 0, 25_000);
  step("the episode plays from its publisher", true);

  // Skip forward is 30 seconds: playing cannot go 20 in the second and a half this allows.
  const started = await time();
  await page.keyboard.press("Meta+ArrowRight");
  await until(async () => (await time()) >= started + 20, 1_500);
  step("⌘→ skips forward", (await time()) >= started + 20, `${started} to ${await time()}`);
  const before = await time();
  await page.keyboard.press("Meta+ArrowLeft");
  await until(async () => (await time()) < before, 5_000);
  step("⌘← skips back", (await time()) < before);

  const pressIn = async (control) => {
    await control.focus();
    await page.evaluate(() => {
      window.__arrowHeld = null;
      const heard = (event) => {
        if (event.key !== "ArrowRight") return;
        window.removeEventListener("keydown", heard);
        window.__arrowHeld = event.defaultPrevented;
      };
      window.addEventListener("keydown", heard);
    });
    const from = await time();
    await page.keyboard.press("Meta+ArrowRight");
    await page.waitForTimeout(500);
    return {
      moved: (await time()) >= from + 20,
      held: await page.evaluate(() => window.__arrowHeld),
    };
  };
  const inField = await pressIn(window.getByPlaceholder("Search"));
  step(
    "in the search field ⌘→ is the field's",
    !inField.moved && inField.held === false,
    JSON.stringify(inField),
  );
  const onSlider = await pressIn(window.getByRole("slider").last());
  step("on a slider ⌘→ does not skip", !onSlider.moved, JSON.stringify(onSlider));
  await window.getByRole("heading").first().click();

  const level = await audio("volume");
  await page.keyboard.press("Meta+ArrowDown");
  await until(async () => (await audio("volume")) < level, 3_000);
  step("⌘↓ lowers the volume", (await audio("volume")) < level);
  await chooseMenu(page, "Controls", "Increase Volume");
  await until(async () => Math.abs((await audio("volume")) - level) < 0.01, 3_000);
  step("Controls > Increase Volume raises it", Math.abs((await audio("volume")) - level) < 0.01);

  await page.getByRole("menubar").first().getByRole("menuitem", { name: "Controls" }).click();
  await item(page, "Playback Speed").hover();
  const faster = page.getByRole("menuitemradio", { name: "1.5×" });
  await faster.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "podcasts-controls-menu.png"));
  await faster.click();
  await until(async () => (await stored(page)).speed === 1.5, 10_000);
  step(
    "Playback Speed sets the speed and keeps it on the server",
    (await stored(page)).speed === 1.5 && (await audio("playbackRate")) === 1.5,
  );
  await closeMenus(page);

  await chooseMenu(page, "Controls", "Previous");
  await until(async () => (await time()) < 5, 5_000);
  step(
    "Previous goes to the episode's start and plays on",
    (await time()) < 5 && !(await audio("paused")),
  );

  await places.getByRole("treeitem", { name: "Episodes" }).click();
  await chooseMenu(page, "View", "Go to Current Episode");
  await window
    .getByRole("button", { name: "Unsubscribe", exact: true })
    .waitFor({ timeout: 10_000 });
  step("View > Go to Current Episode opens its show", true);

  const refreshed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/podcasts/feed" &&
      /max_age=0(&|$)/.test(response.url()),
    { timeout: 15_000 },
  );
  await chooseMenu(page, "View", "Refresh");
  step("View > Refresh reads the feeds again", (await refreshed).ok());

  await window.getByPlaceholder("Search").focus();
  await page.keyboard.press("Meta+.");
  await until(async () => (await audio("paused")) && (await time()) === 0, 5_000);
  step(
    "⌘. stops with the focus in the search field",
    (await audio("paused")) && (await time()) === 0,
  );
  await window.getByRole("heading").first().click();
  await page.evaluate(() => document.querySelector("audio").play());
  await until(async () => (await time()) > 0, 15_000);

  await chooseMenu(page, "Controls", "Stop");
  await until(async () => (await audio("paused")) && (await time()) === 0, 5_000);
  step("Controls > Stop stops at the start", (await audio("paused")) && (await time()) === 0);
  await page.getByRole("menubar").first().getByRole("menuitem", { name: "View" }).click();
  await item(page, "Refresh").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "podcasts-view-menu.png"));
  await closeMenus(page);

  // ---- Several episodes ---------------------------------------------------------------------------
  const rows = window.locator("[data-episode-id]");
  const id = (at) => rows.nth(at).getAttribute("data-episode-id");
  const chosen = [await id(1), await id(2), await id(3)];
  const titleOf = (at) => rows.nth(at).locator(".mac-card-grid-card-text");
  await titleOf(1).click();
  await titleOf(3).click({ modifiers: ["Shift"] });
  const marks = window.locator(".mac-podcasts-chosen");
  step("Shift-click chooses the episodes between", (await marks.count()) === 3);
  await titleOf(4).click({ modifiers: ["Meta"] });
  step("Command-click adds another", (await marks.count()) === 4);
  await titleOf(4).click({ modifiers: ["Meta"] });
  step("and takes it away again", (await marks.count()) === 3);
  await titleOf(2).click({ button: "right" });
  const addAll = page.getByRole("menuitem", { name: "Add 3 to Up Next" });
  await addAll.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "podcasts-several-menu.png"));
  await addAll.click();
  await until(async () => {
    const queue = (await stored(page)).queue.map((one) => one.id);
    return chosen.every((one) => queue.includes(one));
  }, 10_000);
  const added = (await stored(page)).queue.map((one) => one.id);
  step(
    "the menu adds the three to Up Next, kept on the server",
    chosen.every((one) => added.includes(one)),
  );
  await titleOf(2).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mark 3 as Played" }).click();
  await until(async () => {
    const library = await stored(page);
    return chosen.every((one) => library.played.includes(one));
  }, 10_000);
  const after = await stored(page);
  step(
    "the menu marks them played, which takes them out of Up Next",
    chosen.every((one) => after.played.includes(one) && !after.queue.some((q) => q.id === one)),
  );
});

process.exit(0);
