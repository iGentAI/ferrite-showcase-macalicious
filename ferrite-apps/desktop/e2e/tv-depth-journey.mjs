#!/usr/bin/env node
// TV's depth on Ferrite: the player's commands, checked on YouTube's real <video> element inside
// its frame and on the server, with real input only.
//
//   node e2e/tv-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]
//
// The browser says it is a Mac, so that Command is the Meta key: elsewhere it is Control, and
// Control-Down belongs to the desktop's Mission Control.

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState } from "./media-census-kit.mjs";

const BUNNY = "aqz-KE-bpKQ";
const LLAMAS = "SkVqJ1SGeL0";
const SINTEL = "eRsGyueVLvQ";
const LIBRARY = "/api/tv/library";
const SETTINGS = "/api/system-preferences/settings";
const COMMAND = "Meta";
const { base, out } = options();
const { step, run } = journey("tv-depth", {
  ignoreOtherOrigins: true,
  launchOptions: { chromium: { args: ["--autoplay-policy=no-user-gesture-required"] } },
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

const settled = async (page, read, accept, timeout = 15_000) => {
  for (let waited = 0; waited <= timeout; waited += 250) {
    const value = await read();
    if (accept(value)) return value;
    await page.waitForTimeout(250);
  }
  return null;
};

await run(async (page) => {
  page.setDefaultTimeout(10_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  await openDesktop(page, base, step);
  const library = async () => (await api(page, "GET", LIBRARY)).json?.library;
  const settings = async () => (await api(page, "GET", SETTINGS)).json?.values ?? {};
  const stored = (accept) => settled(page, library, (held) => held && accept(held));

  await launch(page, "TV");
  const window = page.getByRole("region", { name: "TV", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  const player = window.locator("section.mac-tv-player");
  const section = (name) => window.getByRole("button", { name, exact: true });

  /** YouTube's <video> for `id`, read in its own frame. */
  const video = (id, read) => {
    const frame = page.frames().find((each) => each.url().includes(`/embed/${id}`));
    if (!frame) throw new Error(`no YouTube frame for ${id}`);
    return frame.evaluate(read);
  };
  const paused = (id) => video(id, () => document.querySelector("video").paused);
  const place = (id) => video(id, () => document.querySelector("video").currentTime);
  const level = (id) => video(id, () => document.querySelector("video").volume);
  const until = (test) => settled(page, test, Boolean, 10_000);
  const playing = async (id) => {
    await player.waitFor({ timeout: 15_000 });
    await until(async () => page.frames().some((each) => each.url().includes(`/embed/${id}`)));
    await until(async () => !(await paused(id).catch(() => true)));
    await until(async () => (await player.getAttribute("data-state")) === "playing");
    return !(await paused(id));
  };

  /** A menu's command, and the keyboard back in the window, as the menu's fade-out takes. */
  const choose = async (...items) => {
    await chooseMenu(page, "Controls", ...items);
    await page.waitForTimeout(300);
  };

  // ---- Dimmed while nothing plays -------------------------------------------------------------
  const before = await menuItemState(page, "Controls", "Stop");
  step("Stop is dimmed while nothing plays", before.disabled);

  // ---- Space and the arrows -------------------------------------------------------------------
  const field = window.getByRole("searchbox", { name: "Search" });
  await field.fill(`https://youtu.be/${BUNNY}`);
  await field.press("Enter");
  step("a pasted link plays in YouTube's real player", await playing(BUNNY));

  await page.keyboard.press("Space");
  step("Space pauses YouTube's video", await until(() => paused(BUNNY)));
  await page.keyboard.press("Space");
  step("Space plays it again", await until(async () => !(await paused(BUNNY))));

  let at = await place(BUNNY);
  await page.keyboard.press("ArrowRight");
  step(
    "the right arrow skips forward ten seconds",
    await until(async () => (await place(BUNNY)) >= at + 9),
    `from ${at}`,
  );
  at = await place(BUNNY);
  await page.keyboard.press("ArrowLeft");
  step(
    "the left arrow skips back ten seconds",
    await until(async () => (await place(BUNNY)) <= at - 8),
    `from ${at}`,
  );

  // The keyboard stays with the player after a click into YouTube's frame or on a control.
  await player.locator("iframe").click();
  // YouTube's own answer to the click (it pauses or plays) can take a moment to arrive.
  await page.waitForTimeout(2_500);
  const takenBack = await page.evaluate(
    () => document.activeElement?.classList.contains("mac-tv-player") ?? false,
  );
  const wasPaused = await paused(BUNNY);
  await until(
    async () => (await player.getAttribute("data-state")) === (wasPaused ? "paused" : "playing"),
  );
  await page.keyboard.press("Space");
  step(
    "Space still acts after a click in YouTube's frame",
    takenBack && (await until(async () => (await paused(BUNNY)) !== wasPaused)),
    `keyboard with the player: ${takenBack}; was paused: ${wasPaused}, now: ${await paused(BUNNY)}, state ${await player.getAttribute("data-state")}`,
  );
  await until(
    async () => (await player.getAttribute("data-state")) === (wasPaused ? "playing" : "paused"),
  );
  if (await paused(BUNNY)) await page.keyboard.press("Space");
  await until(async () => !(await paused(BUNNY)));
  await until(async () => (await player.getAttribute("data-state")) === "playing");

  const hud = player.getByRole("group", { name: "Playback controls" });
  const volume = player.locator(".mac-tv-player-volume input");
  const loud = await level(BUNNY);

  // ---- The menu's volume ----------------------------------------------------------------------
  await choose("Decrease Volume");
  step(
    "Controls > Decrease Volume turns YouTube's video down",
    await until(async () => (await level(BUNNY)) < loud),
    `${loud}`,
  );
  await page.keyboard.press(`${COMMAND}+ArrowDown`);
  await page.keyboard.press("ArrowDown");
  const kept = await settled(page, settings, (values) => values["tv.volume"] === 70);
  step(
    "Command-Down and Down turn it further, kept on the server",
    kept !== null && (await volume.inputValue().catch(() => "")) === "70",
    JSON.stringify(kept?.["tv.volume"]),
  );
  await page.keyboard.press("ArrowUp");
  await settled(page, settings, (values) => values["tv.volume"] === 80);
  step("Up turns it back up", (await volume.inputValue()) === "80");
  const quieter = await level(BUNNY);
  await choose("Mute");
  step(
    "Controls > Mute mutes YouTube's video",
    await until(() => video(BUNNY, () => document.querySelector("video").muted)),
  );
  await choose("Unmute");
  await until(async () => !(await video(BUNNY, () => document.querySelector("video").muted)));

  // A menu's command leaves the keyboard with the player, and so does a click on a control after
  // the volume slider had it.
  await volume.focus();
  await hud.getByRole("button", { name: "Pause", exact: true }).click();
  step(
    "a control's click gives the keyboard to the player, even after a slider had it",
    (await until(() => paused(BUNNY))) &&
      (await page.evaluate(
        () => document.activeElement?.classList.contains("mac-tv-player") ?? false,
      )),
  );
  await until(async () => (await player.getAttribute("data-state")) === "paused");
  await page.keyboard.press("Space");
  await until(async () => (await player.getAttribute("data-state")) === "playing");
  await choose("Skip Forward 10 Seconds");
  await page.keyboard.press("Space");
  step("Space still acts after a menu's command", await until(() => paused(BUNNY)));
  await page.keyboard.press("Space");
  await until(async () => !(await paused(BUNNY)));

  // ---- Full screen and Picture in Picture -----------------------------------------------------
  const pip = hud.getByRole("button", { name: "Picture in Picture" });
  step(
    "Picture in Picture is dimmed and says why",
    (await pip.getAttribute("aria-disabled")) === "true" &&
      /frame of its own/.test((await pip.getAttribute("title")) ?? ""),
  );
  await hud.getByRole("button", { name: "Enter Full Screen" }).click();
  step(
    "Enter Full Screen fills the screen with the player",
    await until(() =>
      page.evaluate(() => document.fullscreenElement?.classList.contains("mac-tv-player") ?? false),
    ),
  );
  await hud.getByRole("button", { name: "Exit Full Screen" }).click();
  await until(() => page.evaluate(() => document.fullscreenElement === null));

  const current = await menuItemState(page, "Controls", "Go to Current Video");
  step(
    "Go to Current Video is dimmed in the player, saying why",
    current.disabled && /already showing/.test(current.title ?? ""),
  );

  await choose("Stop");
  await page.waitForFunction(() => !document.querySelector("section.mac-tv-player"));
  const placed = await stored((held) => (held.positions[BUNNY] ?? 0) > 0);
  step(
    "Controls > Stop ends playback and keeps the place",
    placed !== null && (await window.getByRole("button", { name: /^Resume from / }).isVisible()),
    JSON.stringify(placed?.positions),
  );

  // ---- Go to Current --------------------------------------------------------------------------
  await section("Library").click();
  await choose("Go to Current Video");
  await window.getByRole("button", { name: /^Resume from / }).waitFor({ timeout: 5_000 });
  step("Controls > Go to Current Video goes back to the video's page", true);

  // ---- Next and Previous ----------------------------------------------------------------------
  await section("Kids").click();
  await window
    .getByRole("button", { name: /Caminandes 3/ })
    .first()
    .click();
  await window.getByRole("button", { name: "Add to Up Next" }).click();
  await stored((held) => held.upNext.includes(LLAMAS));
  await choose("Go to Current Video");
  await window.getByRole("button", { name: /^Resume from / }).click();
  step("Resume plays again", await playing(BUNNY));
  await until(async () => (await level(BUNNY)) === quieter);
  step("the kept volume applies to a new player", (await volume.inputValue()) === "80");

  const previous = await menuItemState(page, "Controls", "Previous");
  step("Previous is dimmed with nothing before it", previous.disabled);
  await page.waitForTimeout(450);
  await page.getByRole("menubar").getByRole("menuitem", { name: "Controls", exact: true }).click();
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "tv-controls-menu.png"));
  await closeMenus(page);

  await choose("Next");
  step("Controls > Next plays the first of Up Next", await playing(LLAMAS));
  const moved = await stored((held) => held.upNext.length === 0 && held.history[0]?.id === LLAMAS);
  step("Next takes it out of Up Next and puts it first in History", moved !== null);

  await page.keyboard.press(`${COMMAND}+ArrowLeft`);
  step("Command-Left goes back to the video before", await playing(BUNNY));
  await choose("Next");
  step("Next from there returns along History", await playing(LLAMAS));
  const last = await menuItemState(page, "Controls", "Next");
  step("Next is dimmed at the end", last.disabled);
  await choose("Previous");
  step("Controls > Previous goes back too", await playing(BUNNY));

  await page.keyboard.press(`${COMMAND}+.`);
  await page.waitForFunction(() => !document.querySelector("section.mac-tv-player"));
  step("Command-Period stops", true);
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  step("Space on a video's page plays it", await playing(BUNNY));

  // ---- The card's and the shelf's menus -------------------------------------------------------
  await page.waitForTimeout(1_500);
  await page.keyboard.press(`${COMMAND}+.`);
  await page.waitForFunction(() => !document.querySelector("section.mac-tv-player"));
  await stored((held) => (held.positions[BUNNY] ?? 0) > 0);
  const item = (name) => page.getByRole("menuitem", { name, exact: true });
  const card = (region, title) =>
    window
      .getByRole("region", { name: region, exact: true })
      .getByRole("button", { name: title })
      .first();
  const onCard = async (region, title, name) => {
    await card(region, title).click({ button: "right" });
    await item(name).click();
    await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);
  };

  await section("Library").click();
  await card("History", /Caminandes/).click({ button: "right" });
  await item("Add to Watch Later").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "tv-card-menu.png"));
  await item("Add to Watch Later").click();
  step(
    "the card's menu adds to Watch Later on the server",
    (await stored((held) => held.watchLater.includes(LLAMAS))) !== null,
  );
  await page.waitForTimeout(300);
  await onCard("History", /Caminandes/, "Remove from History");
  const left = await stored((held) => !held.history.some((entry) => entry.id === LLAMAS));
  step(
    "Remove from History takes that one entry, and leaves it in Watch Later",
    left?.watchLater.includes(LLAMAS) &&
      left.history.some((entry) => entry.id === BUNNY) &&
      (await card("History", /Caminandes/).count()) === 0,
  );
  await onCard("Watch Later", /Caminandes/, "Remove from Watch Later");
  step(
    "Remove from Watch Later takes it out",
    (await stored((held) => !held.watchLater.includes(LLAMAS))) !== null &&
      (await window.getByRole("region", { name: "Watch Later", exact: true }).count()) === 0,
  );

  await section("Watch Now").click();
  await onCard("Continue Watching", /Big Buck/, "Remove from Continue Watching");
  const forgotten = await stored((held) => held.positions[BUNNY] === undefined);
  step(
    "Remove from Continue Watching forgets the place, and keeps History",
    forgotten?.history.some((entry) => entry.id === BUNNY) &&
      (await window.getByRole("region", { name: "Continue Watching", exact: true }).count()) === 0,
  );

  const heading = (name) => window.getByRole("heading", { name, exact: true });
  await heading("For Everyone").click({ button: "right" });
  await item("Add All to Up Next").waitFor({ timeout: 5_000 });
  step("a shelf's menu is its own, not a card's", (await item("Go to Video").count()) === 0);
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "tv-shelf-menu.png"));
  await item("Add All to Up Next").click();
  step(
    "Add All to Up Next queues the shelf",
    (await stored((held) => held.upNext.length === 8)) !== null,
  );
  await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);
  await heading("Up Next").click({ button: "right" });
  await item("Clear Up Next").click();
  step(
    "Clear Up Next empties it",
    (await stored((held) => held.upNext.length === 0)) !== null &&
      (await window.getByRole("region", { name: "Up Next", exact: true }).count()) === 0,
  );

  await section("Movies").click();
  await onCard("Open Movies", /Sintel/, "Play Next");
  step(
    "Play Next on a card puts it first in Up Next",
    (await stored((held) => held.upNext[0] === SINTEL)) !== null,
  );
  await onCard("Open Movies", /Sintel/, "Play");
  step(
    "Play on a card opens the player",
    await player.waitFor({ timeout: 10_000 }).then(() => true),
  );

  // ---- Share and Copy Link --------------------------------------------------------------------
  await player.getByRole("button", { name: "Done" }).click();
  await window.getByRole("button", { name: "Share", exact: true }).click();
  await item("Copy Link").click();
  step(
    "Copy Link on a video's page copies YouTube's address",
    await until(
      async () =>
        (await page.evaluate(() => navigator.clipboard.readText())) ===
        `https://www.youtube.com/watch?v=${SINTEL}`,
    ),
  );
  await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);

  await section("Kids").click();
  await card("Kids", /Big Buck/).click({ button: "right" });
  await item("Share").hover();
  await item("Copy Link").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "tv-share-menu.png"));
  const airdrop = item("AirDrop");
  step(
    "AirDrop is dimmed and says why",
    (await airdrop.getAttribute("aria-disabled")) === "true" &&
      /nearby devices/.test((await airdrop.getAttribute("title")) ?? ""),
  );
  await item("Copy Link").click();
  step(
    "Share > Copy Link on a card copies that video's address",
    await until(
      async () =>
        (await page.evaluate(() => navigator.clipboard.readText())) ===
        `https://www.youtube.com/watch?v=${BUNNY}`,
    ),
  );
  await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);

  await card("Kids", /Caminandes/).click({ button: "right" });
  await item("Share").hover();
  await item("Notes").click();
  const note = await settled(
    page,
    async () => JSON.stringify((await api(page, "GET", "/api/notes/data")).json ?? {}),
    (text) => text.includes(`watch?v=${LLAMAS}`),
  );
  step("Share > Notes makes a note of the link, on the server", note !== null);
});

process.exit(0);
