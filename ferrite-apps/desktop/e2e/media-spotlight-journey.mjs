#!/usr/bin/env node
// Spotlight finds what the media and web apps keep, and opens each in its app: a saved story, a video,
// a show, a place, a symbol, a device and a game. What the apps keep is written through their APIs
// with a first item and a second, and each app is left showing the first, so that a step fails if
// Spotlight's request does not move the window to the second. Runs in a new account of its own. The
// device is a second real browser signed in to that account, which reports through Find My's API, so
// the window's own browser, listed first, is not the one asked for.
//
//   node e2e/media-spotlight-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, options, reloadDesktop, shot } from "./app-journey.mjs";
import { createAccount, person, signIn, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("media-spotlight", {
  ignoreOtherOrigins: true,
  contextOptions: {
    chromium: {
      permissions: ["geolocation"],
      geolocation: { latitude: 37.8106, longitude: -122.4769, accuracy: 25 },
    },
  },
});
const stamp = Date.now().toString(36);

const region = (page, name) => page.getByRole("region", { name, exact: true }).first();

/** Types into Spotlight until `group` lists the option, then opens it with Return. */
async function openFound(page, typed, group, option) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  const found = page
    .getByRole("group", { name: new RegExp(`^(?:${group}|Top Hit)$`) })
    .getByRole("option", { name: option })
    .first();
  // A reply can take seconds under load, and typing again drops the question before it.
  let listed = false;
  for (let i = 0; i < 4 && !listed; i++) {
    await field.fill("");
    await field.fill(typed);
    listed = await found.waitFor({ timeout: 8_000 }).then(
      () => true,
      () => false,
    );
  }
  step(`Spotlight lists ${typed} under ${group}`, listed);
  if (!listed) throw new Error(`Spotlight did not list ${typed}`);
  await found.click();
  await field.press("Enter").catch(() => {});
  await page.waitForFunction(
    () => !document.querySelector('[role="combobox"][aria-label="Spotlight Search"]'),
    undefined,
    { timeout: 10_000 },
  );
}

const pair = (make) => [make(`first${stamp}`), make(`second${stamp}`)];

await run(async (page) => {
  page.setDefaultTimeout(15_000);
  const who = person("msp", stamp.slice(-6));
  await createAccount(page, base, who);
  step("a new account is signed in", true);

  // ---- What the apps keep, written through their APIs --------------------------------------------
  const put = async (url, change) => {
    const held = (await api(page, "GET", url)).json;
    const reply = await api(page, "PUT", url, { ...change(held), rev: held.rev });
    if (reply.status !== 200)
      throw new Error(`${url} refused the seed: ${reply.status} ${JSON.stringify(reply.json)}`);
  };
  const [storyA, storyB] = pair((word) => ({
    id: `story-${word}`,
    source: "bbc",
    publisher: "BBC News",
    title: `Harbour ${word}`,
    link: `https://www.bbc.co.uk/news/${word}`,
    published: Date.now() - 60_000,
  }));
  await put("/api/news/library", () => ({
    library: { following: [], blocked: [], saved: [storyA, storyB], history: [] },
  }));
  const video = { id: "aqz-KE-bpKQ", title: `Ferry ${stamp}`, channel: "Boats" };
  const other = { id: "eRsGyueVLvQ", title: `Other ${stamp}`, channel: "Boats" };
  await put("/api/tv/library", () => ({
    library: {
      videos: [other, video],
      history: [],
      upNext: [],
      watchLater: [other.id, video.id],
      positions: {},
    },
  }));
  const show = (word, id, feed) => ({
    id,
    title: `Tide ${word}`,
    author: "Harbour Radio",
    artwork: null,
    genre: null,
    feed,
    seen: 1,
  });
  const [showA, showB] = [
    show(`first${stamp}`, "1000001", "https://feeds.npr.org/510318/podcast.xml"),
    show(`second${stamp}`, "1000002", "https://feeds.npr.org/510289/podcast.xml"),
  ];
  await put("/api/podcasts/library", () => ({
    library: {
      subscribed: [showA.id, showB.id],
      played: [],
      positions: {},
      settings: {
        refresh: "Every Hour",
        download: "Only New",
        skipForward: 30,
        skipBack: 15,
        continuous: true,
        sync: true,
      },
      shows: [showA, showB],
    },
  }));
  const place = (word) => ({
    id: `place-${word}`,
    name: `Quay ${word}`,
    category: "pier",
    lat: 37.8,
    lon: -122.4,
    address: ["Pier 15", "San Francisco"],
  });
  const [placeA, placeB] = pair(place);
  await put("/api/maps/places", (held) => ({
    favorites: [placeA, placeB],
    recents: [],
    guides: [],
    session: held.session,
  }));
  await put("/api/stocks/watchlist", (held) => ({
    symbols: ["AAPL", "TSLA"],
    session: held.session,
  }));
  await reloadDesktop(page);

  // ---- A saved story ------------------------------------------------------------------------------
  await openFound(page, storyB.title, "Saved Stories", new RegExp(`^${storyB.title}`));
  const news = region(page, "News");
  await news.waitFor({ state: "visible" });
  const reader = news.locator('[data-view="reader"]');
  await reader.waitFor();
  step(
    "the story opens in News's reader",
    (await reader.getByRole("heading").first().innerText()).includes(storyB.title),
  );
  await shot(page, path.join(out, "media-spotlight-news.png"));

  // ---- A video ------------------------------------------------------------------------------------
  await openFound(page, video.title, "TV", new RegExp(`^${video.title}`));
  const tv = region(page, "TV");
  await tv.waitFor({ state: "visible" });
  await tv.getByRole("heading", { name: video.title }).first().waitFor();
  step("the video opens on its page in TV", true);
  await shot(page, path.join(out, "media-spotlight-tv.png"));

  // ---- A show -------------------------------------------------------------------------------------
  await openFound(page, showB.title, "Podcasts", new RegExp(`^${showB.title}`));
  const podcasts = region(page, "Podcasts");
  await podcasts.waitFor({ state: "visible" });
  await podcasts.getByRole("heading", { name: showB.title }).first().waitFor();
  step("the show opens on its page in Podcasts", true);
  await shot(page, path.join(out, "media-spotlight-podcasts.png"));

  // ---- A place ------------------------------------------------------------------------------------
  await openFound(page, placeB.name, "Places", new RegExp(`^${placeB.name}`));
  const maps = region(page, "Maps");
  await maps.waitFor({ state: "visible" });
  await page.getByRole("dialog").getByRole("heading", { name: placeB.name }).first().waitFor();
  step("the place opens on its card in Maps", true);
  await shot(page, path.join(out, "media-spotlight-maps.png"));

  // ---- A symbol -----------------------------------------------------------------------------------
  await openFound(page, "TSLA", "Watchlist", /^TSLA/);
  const stocks = region(page, "Stocks");
  await stocks.waitFor({ state: "visible" });
  step(
    "the symbol opens in Stocks",
    await until(
      async () =>
        /TSLA|Tesla/.test(await stocks.locator(".mac-stocks-pane h2").first().innerText()),
      15_000,
    ),
  );
  await shot(page, path.join(out, "media-spotlight-stocks.png"));

  // ---- A device: another browser of the same account ------------------------------------------------
  const label = `Quay browser ${stamp}`;
  const elsewhere = await page.context().browser().newContext();
  const secondBrowser = await elsewhere.newPage();
  await signIn(secondBrowser, base, who);
  const reported = await api(secondBrowser, "PUT", "/api/find-my/me", {
    lat: 37.8,
    lon: -122.4,
    accuracy_m: 20,
    label,
    reported_at: Date.now(),
  });
  await elsewhere.close();
  step("another browser's report is on the server", reported.status === 200);
  await openFound(page, label, "Devices", new RegExp(`^${label}`));
  const device = region(page, "Find My");
  await device.waitFor({ state: "visible" });
  const devices = device.getByRole("listbox", { name: "Devices" }).getByRole("option");
  await devices.filter({ hasText: label }).waitFor();
  step(
    "the device opens in Find My's Devices, chosen among them",
    (await devices.count()) >= 1 &&
      (await devices.filter({ hasText: label }).getAttribute("aria-selected")) === "true" &&
      (await device
        .getByRole("listbox", { name: "Devices" })
        .getByRole("option", { selected: true })
        .count()) === 1,
    `${await devices.count()} devices`,
  );
  await shot(page, path.join(out, "media-spotlight-find-my.png"));

  // ---- A game ------------------------------------------------------------------------------------
  const started = await api(page, "POST", "/api/chess/games", {
    computer: { side: "black", level: 1 },
  });
  step("a game is on the server", started.status < 300, JSON.stringify(started.json).slice(0, 80));
  await openFound(page, "chess game computer", "Chess Games", /^Chess game against the computer/);
  const board = page.getByRole("grid", { name: "Chessboard" }).first();
  await board.waitFor({ state: "visible" });
  step(
    "the game opens in Chess",
    await until(
      async () =>
        !/Choose New Game|Opening the game/.test(
          await page.locator(".mac-chess-status").innerText(),
        ),
      15_000,
    ),
  );
  await shot(page, path.join(out, "media-spotlight-chess.png"));
});
