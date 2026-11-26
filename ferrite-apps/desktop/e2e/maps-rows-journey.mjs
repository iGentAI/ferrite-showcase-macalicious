#!/usr/bin/env node
// Maps' rows of the inventory no journey had a picture of: the tiles, search on Return, the card, the
// person's Favorites, Recents and Guides over a reload, the scale, the current location, the map's
// keys and its drag, Delete in the sidebar, Share to Messages, and Siri's directions. Searches, the
// card's facts and the route are real replies from Nominatim and the routers through the server; the
// browser's location is fixed by the context.
//
//   node e2e/maps-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { closeMenus, menuItemState, messagesComposerHolds, until } from "./media-census-kit.mjs";

const { base, out } = options();
const HERE = { latitude: 37.8106, longitude: -122.4769, accuracy: 25 };
const { step, run, expectRefusal } = journey("maps-rows", {
  ignoreOtherOrigins: true,
  contextOptions: {
    chromium: {
      permissions: ["geolocation", "clipboard-read", "clipboard-write"],
      geolocation: HERE,
    },
  },
});
const PLACES = "/api/maps/places";

const settled = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};
const stored = async (page) => (await api(page, "GET", PLACES)).json;
const names = (list) => (list ?? []).map(({ name }) => name);
const middle = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const SEARCH = "/api/maps/search";

/** Until the desktop's own requests have ended, so that a reload aborts none of them. */
function watchRequests(page) {
  const open = new Set();
  const own = (request) => {
    const url = new URL(request.url());
    return url.origin === new URL(page.url()).origin && !/^\/(live|__forge)/.test(url.pathname);
  };
  page.on("request", (request) => {
    if (own(request)) open.add(request);
  });
  page.on("requestfinished", (request) => open.delete(request));
  page.on("requestfailed", (request) => open.delete(request));
  return () => until(async () => open.size === 0, 20_000);
}

async function openMaps(page) {
  await launch(page, "Maps");
  const window = page.getByRole("region", { name: "Maps", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await window.getByRole("application").waitFor({ timeout: 10_000 });
  return window;
}

await run(async (page) => {
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) console.log(`note the desktop page loaded: ${Date.now()}`);
  });
  await openDesktop(page, base, step);
  const quiet = watchRequests(page);
  let window = await openMaps(page);
  let map = window.getByRole("application");
  const field = () => window.getByRole("searchbox", { name: "Search for a place or address" });

  // ---- The tiles ---------------------------------------------------------------------------------
  const tiles = map.locator("img[data-tile]");
  step(
    "the map draws OpenStreetMap's tiles, and they arrive",
    await until(
      () =>
        tiles.evaluateAll(
          (all) => all.length > 4 && all.filter((tile) => tile.naturalWidth === 256).length > 4,
        ),
      25_000,
    ),
    `${await tiles.count()} tiles, first from ${new URL(await tiles.first().getAttribute("src"), base).host}`,
  );
  step(
    "the credit to OpenStreetMap is on the map",
    await map.getByRole("link", { name: "© OpenStreetMap contributors" }).isVisible(),
  );
  await settled(page, "maps-rows-tiles.png");

  // ---- Maps > Preferences… -----------------------------------------------------------------------
  const preferences = await menuItemState(page, "Maps", "Preferences…");
  step(
    "Maps > Preferences… is dimmed with its reason",
    preferences.disabled && /no preferences/.test(preferences.title ?? ""),
    preferences.title ?? "",
  );
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Maps", exact: true })
    .first()
    .click();
  await settled(page, "maps-rows-app-menu.png");
  await closeMenus(page);

  // ---- The scale ---------------------------------------------------------------------------------
  const scale = window.locator(".mac-maps-scale");
  step("no scale shows at first", (await scale.count()) === 0);
  await window.getByRole("button", { name: "Show", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "Scale", exact: true }).click();
  await closeMenus(page);
  await scale.waitFor({ timeout: 5_000 });
  const scaleAt = await scale.innerText();
  await window.getByRole("button", { name: "Zoom Out" }).click();
  step(
    "the Show menu's Scale shows a legend, which follows the zoom",
    /\d/.test(scaleAt) && (await until(async () => (await scale.innerText()) !== scaleAt, 3_000)),
    `${scaleAt}, then ${await scale.innerText()}`,
  );
  await window.getByRole("button", { name: "Zoom In" }).click();
  await settled(page, "maps-rows-scale.png");

  // ---- The current location ----------------------------------------------------------------------
  await window.getByRole("button", { name: "Show Your Current Location" }).click();
  const dot = window.locator(".mac-maps-tiles-dot");
  await dot.waitFor({ timeout: 10_000 });
  await window.getByText("Current Location").waitFor({ timeout: 5_000 });
  const box = await map.boundingBox();
  await page.waitForTimeout(300);
  const centred = middle(await dot.boundingBox());
  step(
    "the toolbar's button shows the browser's location in the middle of the map",
    Math.abs(centred.x - (box.x + box.width / 2)) < 3 &&
      Math.abs(centred.y - (box.y + box.height / 2)) < 3,
  );
  await settled(page, "maps-rows-location.png");

  // ---- The map's keys and its drag: the dot moves with the map ------------------------------------
  const dotAt = async () => middle(await dot.boundingBox());
  await map.click({ position: { x: 200, y: 200 } });
  const pressed = async (key, moved) => {
    const before = await dotAt();
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
    const after = await dotAt();
    const went = { x: after.x - before.x, y: after.y - before.y };
    step(`the arrow key ${key} pans the map`, moved(went), `${went.x}, ${went.y}`);
  };
  await pressed("ArrowLeft", ({ x, y }) => x > 20 && y === 0);
  await pressed("ArrowRight", ({ x, y }) => x < -20 && y === 0);
  await pressed("ArrowUp", ({ x, y }) => y > 20 && x === 0);
  await pressed("ArrowDown", ({ x, y }) => y < -20 && x === 0);

  const zoomOf = async () => Number(await map.getAttribute("data-zoom"));
  const zoomed = await zoomOf();
  await page.keyboard.press("+");
  step(
    "+ zooms in",
    await until(async () => (await zoomOf()) === zoomed + 1, 3_000),
    String(await zoomOf()),
  );
  await page.keyboard.press("-");
  step(
    "- zooms out",
    await until(async () => (await zoomOf()) === zoomed, 3_000),
    String(await zoomOf()),
  );

  const dragFrom = await dotAt();
  await page.mouse.move(box.x + 500, box.y + 400);
  await page.mouse.down();
  await page.mouse.move(box.x + 420, box.y + 340, { steps: 8 });
  await page.mouse.move(box.x + 340, box.y + 280, { steps: 8 });
  await settled(page, "maps-rows-dragging.png");
  await page.mouse.up();
  const dragTo = await dotAt();
  step(
    "a drag moves the map with the pointer",
    Math.abs(dragTo.x - dragFrom.x + 160) < 3 && Math.abs(dragTo.y - dragFrom.y + 120) < 3,
    `${dragTo.x - dragFrom.x}, ${dragTo.y - dragFrom.y}`,
  );

  // ---- Search on Return, and the card -------------------------------------------------------------
  const searches = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/maps/search")) searches.push(request.url());
  });
  const QUERY = "Hotel Adlon, Berlin";
  await field().click();
  await field().pressSequentially(QUERY);
  await page.waitForTimeout(300);
  step("typing asks no server", searches.length === 0, `${searches.length} searches`);
  // The platform's deadline can end a slow reply from Nominatim on a busy box: Return is pressed again.
  let answer = null;
  for (let tries = 0; tries < 4 && answer?.status() !== 200; tries += 1) {
    expectRefusal(504, SEARCH);
    const asked = page.waitForResponse((reply) => reply.url().includes(SEARCH), {
      timeout: 30_000,
    });
    await field().press("Enter");
    answer = await asked;
    if (answer.status() !== 200) await page.waitForTimeout(2_000);
  }
  step(
    "Return searches, through the server, for what the field holds",
    answer.status() === 200 && /Adlon/.test(searches[0]),
    `${searches.length} asked`,
  );
  const results = page.getByRole("listbox", { name: "Search Results" });
  const card = page.getByRole("dialog");
  await results.waitFor({ timeout: 20_000 });
  await results.getByRole("option", { name: /Adlon Kempinski/ }).click();
  await card.waitFor({ timeout: 10_000 });
  const cardText = await card.innerText();
  console.log(`note card: ${cardText.replace(/\s*\n\s*/g, " | ")}`);
  const placeName = (await card.getByRole("heading").first().innerText()).trim();
  step(
    "the card names the place and gives its address and coordinates",
    /Adlon/.test(placeName) && /Address/.test(cardText) && /Coordinates/.test(cardText),
    placeName,
  );
  const siteLink = card.getByRole("link", { name: /kempinski/i });
  step(
    "the card links the site OpenStreetMap has for it",
    (await siteLink.count()) === 1 && /kempinski\.com/.test(await siteLink.getAttribute("href")),
    (await siteLink.count()) === 1 ? await siteLink.getAttribute("href") : "no site",
  );
  const phoneShown = await card
    .getByRole("heading", { name: "Phone" })
    .isVisible()
    .catch(() => false);
  const call = card.getByRole("link", { name: "Call" });
  step(
    "the card's phone number has a Call link",
    phoneShown && /^tel:\+?\d+$/.test(await call.getAttribute("href")),
    phoneShown ? await call.getAttribute("href") : "no phone",
  );
  step(
    "the card links OpenStreetMap, and the map's label names the place",
    /openstreetmap\.org/.test(
      await card.getByRole("link", { name: "Open Map" }).getAttribute("href"),
    ),
  );
  await settled(page, "maps-rows-card.png");

  // ---- Favorites, Recents, Guides ------------------------------------------------------------------
  await card.getByRole("button", { name: "Favorite" }).click();
  step(
    "the card's heart adds the place to Favorites, on the server, and is filled",
    await until(async () => names((await stored(page)).favorites).includes(placeName), 20_000),
    (await card.getByRole("button", { name: "Favorite" }).getAttribute("aria-pressed")) ?? "",
  );
  step(
    "the place shown is in Recents, on the server",
    names((await stored(page)).recents)[0] === placeName,
  );

  await page.keyboard.press("Escape");
  await window.getByRole("button", { name: "Places", exact: true }).click();
  const sidebar = window.locator(".mac-maps-sidebar");
  const row = (value) => sidebar.locator(`[role='treeitem'][data-value^='${value}']`);
  const named = (kind, name) => row(kind).filter({ hasText: name }).first();
  await named("favorite:", placeName).waitFor({ timeout: 10_000 });
  await named("recent:", placeName).waitFor({ timeout: 5_000 });
  await sidebar.getByRole("button", { name: "New Guide" }).click();
  const guideName = sidebar.getByRole("textbox", { name: "New guide name" });
  await guideName.fill("Weekend");
  await guideName.press("Enter");
  await named("guide:", "Weekend").waitFor({ timeout: 5_000 });
  step(
    "New Guide makes a guide, on the server",
    await until(async () => names((await stored(page)).guides).includes("Weekend"), 20_000),
  );

  await named("recent:", placeName).click();
  await card.waitFor({ timeout: 5_000 });
  await card.getByRole("button", { name: "Add to Guide" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Weekend", exact: true }).waitFor();
  await settled(page, "maps-rows-add-to-guide.png");
  await page.getByRole("menuitemcheckbox", { name: "Weekend", exact: true }).click();
  step(
    "the card's Add to Guide puts the place in the guide, on the server",
    await until(
      async () => names((await stored(page)).guides?.[0]?.places).includes(placeName),
      20_000,
    ),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  if (await card.isVisible().catch(() => false)) await page.keyboard.press("Escape");
  await row("guide:").filter({ hasText: placeName }).first().waitFor({ timeout: 5_000 });
  await settled(page, "maps-rows-places.png");

  // ---- Saved across a reload -----------------------------------------------------------------------
  await page.waitForTimeout(1_000);
  await quiet();
  await reloadDesktop(page);
  window = await openMaps(page);
  map = window.getByRole("application");
  await named("favorite:", placeName).waitFor({ timeout: 15_000 });
  step(
    "Favorites, Recents and Guides are as they were over a reload",
    (await named("recent:", placeName).isVisible()) &&
      (await named("guide:", "Weekend").isVisible()) &&
      (await row("guide:").filter({ hasText: placeName }).first().isVisible()),
  );
  await settled(page, "maps-rows-after-reload.png");

  // ---- Several rows dragged together, in the order chosen -------------------------------------------
  const kept = (await api(page, "GET", PLACES)).json;
  const seeded = (id) => ({ id, name: id, category: "pier", lat: 37.8, lon: -122.4, address: [] });
  await api(page, "PUT", PLACES, {
    favorites: [...kept.favorites, seeded("Quay-A"), seeded("Quay-B")],
    recents: kept.recents,
    guides: [...kept.guides, { id: "later", name: "Later", places: [] }],
    rev: kept.rev,
    session: kept.session,
  });
  await quiet();
  await reloadDesktop(page);
  window = await openMaps(page);
  map = window.getByRole("application");
  await row("favorite:Quay-A").waitFor({ timeout: 15_000 });
  await row("favorite:Quay-A").click({ modifiers: ["ControlOrMeta"] });
  await row("favorite:Quay-B").click({ modifiers: ["ControlOrMeta"] });
  await row("favorite:Quay-A").dragTo(row("guide:later"));
  const later = async () =>
    names((await stored(page)).guides.find((guide) => guide.id === "later")?.places);
  step(
    "two rows dragged together onto a guide's row land in it, in the order chosen, on the server",
    await until(async () => (await later()).join() === "Quay-A,Quay-B", 15_000),
    (await later()).join(),
  );

  // ---- Two rows dragged onto a guide with room for one ---------------------------------------------
  const before = await stored(page);
  const fillers = Array.from({ length: 199 }, (_, index) => seeded(`Filler-${index}`));
  await api(page, "PUT", PLACES, {
    favorites: before.favorites,
    recents: before.recents,
    guides: [
      ...before.guides.filter((guide) => guide.id !== "later"),
      { id: "almost", name: "Almost", places: fillers },
    ],
    rev: before.rev,
    session: before.session,
  });
  await quiet();
  await reloadDesktop(page);
  window = await openMaps(page);
  map = window.getByRole("application");
  await row("favorite:Quay-A").waitFor({ timeout: 15_000 });
  await row("favorite:Quay-A").click({ modifiers: ["ControlOrMeta"] });
  await row("favorite:Quay-B").click({ modifiers: ["ControlOrMeta"] });
  await row("favorite:Quay-A").dragTo(
    sidebar.locator("[role='treeitem'][data-value='guide:almost']"),
  );
  await window
    .getByText("“Almost” holds 200 places, the most a guide keeps.")
    .waitFor({ timeout: 5_000 });
  await quiet();
  const almost = await stored(page);
  const almostHolds = almost.guides.find((guide) => guide.id === "almost")?.places ?? [];
  step(
    "two rows dragged onto a guide with room for one are refused with the reason, and neither moves",
    almostHolds.length === 199 &&
      !almostHolds.some((place) => place.id.startsWith("Quay-")) &&
      almost.favorites.some((place) => place.id === "Quay-A") &&
      almost.favorites.some((place) => place.id === "Quay-B"),
    `${almostHolds.length} in the guide`,
  );
  await settled(page, "maps-rows-guide-full.png");
  const noQuays = await stored(page);
  await api(page, "PUT", PLACES, {
    favorites: noQuays.favorites.filter((place) => !place.id.startsWith("Quay-")),
    recents: noQuays.recents,
    guides: noQuays.guides.filter((guide) => guide.id !== "almost"),
    rev: noQuays.rev,
    session: noQuays.session,
  });
  await quiet();
  await reloadDesktop(page);
  window = await openMaps(page);
  map = window.getByRole("application");
  await named("favorite:", placeName).waitFor({ timeout: 15_000 });

  // ---- Delete in the sidebar, Clear Recents --------------------------------------------------------
  await named("favorite:", placeName).click();
  await card.waitFor({ timeout: 5_000 });
  await page.keyboard.press("Delete");
  step(
    "Delete, straight after a row's click, removes the row",
    await until(async () => names((await stored(page)).favorites).length === 0, 20_000),
    names((await stored(page)).favorites).join(),
  );
  await page.keyboard.press("Escape");
  await sidebar.getByText("No Favorites").waitFor({ timeout: 5_000 });

  await sidebar.getByRole("button", { name: "Clear Recents" }).click();
  await sidebar.getByText("No Recents").waitFor({ timeout: 5_000 });
  step(
    "Clear Recents empties them, on the server, and leaves the guide",
    await until(async () => {
      const now = await stored(page);
      return now.recents.length === 0 && names(now.guides[0]?.places).includes(placeName);
    }, 20_000),
  );
  await settled(page, "maps-rows-cleared.png");

  // ---- Share to Messages, from the card -------------------------------------------------------------
  await row("guide:").filter({ hasText: placeName }).first().click();
  await card.waitFor({ timeout: 5_000 });
  await card.getByRole("button", { name: "Share" }).click();
  await page.getByRole("menuitem", { name: "Messages" }).waitFor({ timeout: 5_000 });
  await settled(page, "maps-rows-share-menu.png");
  await page.getByRole("menuitem", { name: "Messages" }).click();
  step(
    "the card's Share > Messages starts a message with the place's link",
    await until(async () => {
      const box = page
        .getByRole("region", { name: "Messages", exact: true })
        .first()
        .getByRole("textbox", { name: "Message" });
      return /openstreetmap\.org\/\?mlat=/.test(await box.inputValue());
    }, 20_000),
  );
  await settled(page, "maps-rows-to-messages.png");
  step("the card goes with the Share, and does not sit over Messages", (await card.count()) === 0);
  await messagesComposerHolds(page, "openstreetmap", 3_000);

  // ---- Siri's directions ----------------------------------------------------------------------------
  const routeAsks = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/maps/route")) routeAsks.push(request.url());
  });
  const siriField = page.getByRole("textbox", { name: "Type to Siri" });
  await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
  await siriField.waitFor({ timeout: 5_000 });
  const said = page.locator(".mac-siri-demo-reply[data-answer]");
  // On a slow reply from Nominatim Siri hands Maps the words instead: it is asked again.
  let words = "";
  for (let tries = 0; tries < 4 && !/directions to/i.test(words); tries += 1) {
    expectRefusal(504, SEARCH);
    expectRefusal(504, SEARCH);
    await siriField.fill("directions to Exploratorium, San Francisco");
    await siriField.press("Enter");
    await said.waitFor({ timeout: 40_000 });
    await page.waitForTimeout(500);
    words = await said.innerText();
    if (!/directions to/i.test(words)) {
      console.log(`note Siri said: ${words}`);
      await page.waitForTimeout(3_000);
      if (!(await siriField.isVisible().catch(() => false))) {
        await page.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
        await siriField.waitFor({ timeout: 5_000 });
      }
    }
  }
  step("Siri answers with the directions it asked Maps for", /directions to/i.test(words), words);
  const panel = window.getByRole("complementary", { name: "Directions" });
  await panel.waitFor({ timeout: 10_000 });
  await until(async () => routeAsks.length > 0, 30_000);
  step(
    "Maps opens Directions on the place, and asks the server for the route to it",
    /exploratorium/i.test(await panel.getByRole("textbox", { name: "End" }).inputValue()) &&
      routeAsks.some((url) => /to=37\.80/.test(url)),
    await panel.getByRole("textbox", { name: "End" }).inputValue(),
  );
  const summary = panel.locator(".mac-maps-journey-summary");
  // The routers can be slow from here: the panel says so, and Return in its End field asks again.
  for (let tries = 0; tries < 3; tries += 1) {
    expectRefusal(504, "/api/maps/route");
    await summary
      .or(panel.getByText(/^No route:/))
      .first()
      .waitFor({ timeout: 60_000 });
    if (await summary.isVisible()) break;
    console.log(`note ${await panel.getByRole("status").innerText()}`);
    await page.waitForTimeout(3_000);
    await panel.getByRole("textbox", { name: "End" }).press("Enter");
    await panel
      .getByText("Finding a route")
      .waitFor({ timeout: 5_000 })
      .catch(() => {});
  }
  await page.waitForTimeout(1_000);
  await settled(page, "maps-rows-siri.png");
  // A route that never comes fails the step, whether the routers or Maps are to blame.
  step(
    "the route answers, and is drawn on the map",
    (await summary.isVisible()) &&
      (await panel.locator(".mac-maps-journey-step").count()) > 0 &&
      (await window.locator(".mac-maps-route polyline").count()) === 1,
    await panel.innerText(),
  );
});

// The census kit's import keeps the process alive once the run has passed.
process.exit(0);
