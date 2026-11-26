#!/usr/bin/env node
// TV: several cards. Command-click and Shift-click choose cards in Watch Later, a plain click still
// opens one, the menu of a chosen card acts on them all, Select All and the Delete key work, and each
// change is read back from the server and over a reload.
//
//   node e2e/tv-several-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("tv-several", { ignoreOtherOrigins: true });
const LIBRARY = "/api/tv/library";
const MOVIES = ["eRsGyueVLvQ", "R6MlUcmOul8", "WhWc3b3KhnY", "Y-rmzh0PI3c"];
const TITLES = ["Sintel", "Tears of Steel", "Spring", "Cosmos Laundromat"];
const modifier = process.platform === "darwin" ? "Meta" : "Control";

async function openLibrary(page) {
  await launch(page, "TV");
  const window = page.getByRole("region", { name: "TV", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  await chooseMenu(page, "View", "Library");
  return window;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const held = (await api(page, "GET", LIBRARY)).json;
  await api(page, "PUT", LIBRARY, {
    library: {
      videos: MOVIES.map((id, at) => ({ id, title: TITLES[at], channel: "Blender" })),
      history: [],
      upNext: [],
      watchLater: [...MOVIES],
      positions: {},
    },
    rev: held.rev,
  });
  try {
    await reloadDesktop(page);
    let window = await openLibrary(page);
    const stored = async () => (await api(page, "GET", LIBRARY)).json?.library;
    const later = window.getByRole("region", { name: "Watch Later" });
    const card = (title) => later.locator(".mac-card-grid-card", { hasText: title }).first();
    const chosen = async () =>
      later
        .locator('.mac-card-grid-card[aria-pressed="true"] .mac-card-grid-card-title')
        .allInnerTexts();
    await card(TITLES[0]).waitFor({ timeout: 8_000 });

    // ---- Choose --------------------------------------------------------------------------------
    await card(TITLES[2]).click({ modifiers: [modifier] });
    await card(TITLES[0]).click({ modifiers: [modifier] });
    step(
      "Command-click chooses cards and opens none",
      (await chosen()).join() === `${TITLES[0]},${TITLES[2]}` && (await later.isVisible()),
      (await chosen()).join(),
    );
    await shot(page, path.join(out, "tv-several-chosen.png"));

    await card(TITLES[0]).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Up Next" }).click();
    step(
      "Cards chosen last-first go to Up Next in the order shown",
      await until(
        async () => (await stored()).upNext.join() === `${MOVIES[0]},${MOVIES[2]}`,
        5_000,
      ),
      JSON.stringify((await stored()).upNext),
    );

    await card(TITLES[2]).click({ modifiers: ["Shift"] });
    step(
      "Shift-click chooses the cards between",
      (await chosen()).join() === TITLES.slice(0, 3).join(),
      (await chosen()).join(),
    );

    await chooseMenu(page, "Edit", "Select All");
    step(
      "Edit > Select All chooses the whole list",
      (await chosen()).length === 4,
      (await chosen()).join(),
    );

    // ---- A menu for them all -------------------------------------------------------------------
    await card(TITLES[1]).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Up Next" }).click();
    step(
      "A chosen card's menu queues them all, in order",
      await until(async () => (await stored()).upNext.join() === MOVIES.join(), 5_000),
      JSON.stringify((await stored()).upNext),
    );

    await card(TITLES[1]).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Playlist" }).hover();
    await page.getByRole("menuitem", { name: "New Playlist…" }).click();
    const sheet = page.getByRole("dialog", { name: "New Playlist" });
    await sheet.getByRole("textbox", { name: "Playlist name" }).fill("Together");
    await sheet.getByRole("button", { name: "Create" }).click();
    step(
      "New Playlist from a chosen card's menu holds them all",
      await until(async () => (await stored()).playlists?.[0]?.videos.length === 4, 5_000),
      JSON.stringify((await stored()).playlists),
    );

    // ---- The same video in another list has its own menu ---------------------------------------
    const together = window.getByRole("region", { name: "Together" });
    const inPlaylist = (title) =>
      together.locator(".mac-card-grid-card", { hasText: title }).first();
    await inPlaylist(TITLES[0]).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Remove from Playlist" }).waitFor({ timeout: 3_000 });
    step(
      "A card chosen in Watch Later has its usual menu in a playlist",
      (await page.getByRole("menuitem", { name: /from Watch Later$/ }).count()) === 1 &&
        (await page.getByRole("menuitem", { name: /^Remove 4/ }).count()) === 0,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("menuitem", { name: "Remove from Playlist" }).waitFor({
      state: "detached",
      timeout: 3_000,
    });

    // ---- Remove --------------------------------------------------------------------------------
    await page.keyboard.press("Escape");
    await until(async () => (await chosen()).length === 0, 3_000);
    step("Escape lets go of them", (await chosen()).length === 0, (await chosen()).join());
    await card(TITLES[0]).click({ modifiers: [modifier] });
    await card(TITLES[1]).click({ modifiers: [modifier] });
    await card(TITLES[1]).click({ button: "right" });
    await shot(page, path.join(out, "tv-several-menu.png"));
    await page.getByRole("menuitem", { name: "Remove 2 from Watch Later" }).click();
    step(
      "Remove takes both from Watch Later and from no other list",
      (await until(
        async () => (await stored()).watchLater.join() === MOVIES.slice(2).join(),
        5_000,
      )) &&
        (await stored()).upNext.length === 4 &&
        (await stored()).playlists[0].videos.length === 4,
      JSON.stringify((await stored()).watchLater),
    );

    // ---- Select All takes the list as it is now ------------------------------------------------
    await card(TITLES[2]).click({ modifiers: [modifier] });
    await inPlaylist(TITLES[0]).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Watch Later" }).click();
    await card(TITLES[0]).waitFor({ timeout: 3_000 });
    await chooseMenu(page, "Edit", "Select All");
    step(
      "Select All chooses a card added to the list since",
      (await chosen()).length === 3,
      (await chosen()).join(),
    );
    await page.keyboard.press("Escape");
    await card(TITLES[0]).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Remove from Watch Later" }).click();

    await card(TITLES[2]).click({ modifiers: [modifier] });
    await page.keyboard.press("Delete");
    step(
      "The Delete key removes what is chosen",
      await until(async () => (await stored()).watchLater.join() === MOVIES[3], 5_000),
      JSON.stringify((await stored()).watchLater),
    );

    await reloadDesktop(page);
    window = await openLibrary(page);
    const again = window.getByRole("region", { name: "Watch Later" });
    await again.waitFor({ timeout: 8_000 });
    step(
      "Over a reload the list is as it was left",
      (await again.locator(".mac-card-grid-card-title").allInnerTexts()).join() === TITLES[3] &&
        (await window.getByRole("region", { name: "Together" }).count()) === 1,
      (await again.locator(".mac-card-grid-card-title").allInnerTexts()).join(),
    );

    await again.locator(".mac-card-grid-card").first().click();
    await window.getByRole("button", { name: "Back" }).waitFor({ timeout: 5_000 });
    step("A plain click still opens the card", true);
  } finally {
    await api(page, "PUT", LIBRARY, {
      library: held.library ?? {
        videos: [],
        history: [],
        upNext: [],
        watchLater: [],
        positions: {},
      },
      rev: (await api(page, "GET", LIBRARY)).json.rev,
    }).catch(() => {});
  }
});
