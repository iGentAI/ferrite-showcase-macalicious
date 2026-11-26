#!/usr/bin/env node
// Maps on Ferrite: the window shows OpenStreetMap's real tiles with their
// attribution; a search on Return asks the maps module, which asks
// Nominatim through the application's egress, and the place's pin and card
// show real coordinates; the card offers Directions;
// the card's heart keeps the place as a favorite, which
// the Places sidebar still lists after a reload. The browser's location is
// fixed by the context (Fort Point, beside the bridge). Needs
// `ferrite dev --egress allow`. Exits 0 only when every step passed and the
// page logged no console error, page error, failed request or HTTP error
// (the tiles included). It runs in a fresh browser signed in as Guest User (journey-kit's
// openDesktop), so the places it saves and forgets are that new guest's own, never a person's.
//
//   ferrite dev --egress allow                     # in ferrite-apps/desktop
//   node e2e/maps-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                             [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const PLACES = "/api/maps/places";
const SEARCH = "/api/maps/search";
const QUERY = "Golden Gate Bridge";
/** Fort Point, at the south end of the bridge: where the browser says it is. */
const HERE = { latitude: 37.8106, longitude: -122.4769, accuracy: 25 };
const located = { permissions: ["geolocation"], geolocation: HERE };

const { base, out, browserName } = options();
const { step, run } = journey("maps", {
  contextOptions: { chromium: located, firefox: located, webkit: located },
});

async function openMaps(page) {
  await launch(page, "Maps");
  const window = page.getByRole("region", { name: "Maps", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  return window;
}

/** Resolves with the next answer to a GET of `pathname` whose query passes `accept`. Marked as
 * handled at once, so that a step failing before it is awaited is reported as that failure. */
function nextGet(page, pathname, accept = () => true) {
  const answer = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname === pathname &&
        accept(url.searchParams)
      );
    },
    { timeout: 20_000 },
  );
  answer.catch(() => {});
  return answer;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const fresh = await api(page, "GET", PLACES);
  step(
    "the journey's guest desktop starts with no saved places",
    fresh.status === 200 && fresh.json.favorites === null,
  );
  let window = await openMaps(page);

  // The real map: tiles of tile.openstreetmap.org, loaded, and the credit.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("img.mac-maps-tiles-tile")].some(
        (tile) => tile.complete && tile.naturalWidth === 256,
      ),
    undefined,
    { timeout: 20_000 },
  );
  const tiles = await window
    .locator("img.mac-maps-tiles-tile")
    .evaluateAll((all) => all.map((tile) => tile.getAttribute("src")));
  step(
    "the map shows OpenStreetMap's tiles, only those in view",
    tiles.length > 0 &&
      tiles.length <= 40 &&
      tiles.every((src) => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(src)),
    `${tiles.length} tiles`,
  );
  step(
    "the map credits OpenStreetMap's contributors",
    (await window
      .getByRole("link", { name: "© OpenStreetMap contributors" })
      .getAttribute("href")) === "https://www.openstreetmap.org/copyright",
  );

  // Search on Return.
  const field = window.getByRole("searchbox", { name: "Search for a place or address" });
  await field.fill(QUERY);
  const searched = nextGet(page, SEARCH, (params) => params.get("q") === QUERY);
  await field.press("Enter");
  const answer = await searched;
  const found = await answer.json();
  const bridge = found.places?.[0];
  step(
    "the maps module answers the search with Nominatim's coordinates",
    answer.status() === 200 &&
      bridge &&
      Math.abs(bridge.lat - 37.82) < 0.05 &&
      Math.abs(bridge.lon + 122.478) < 0.05,
    bridge
      ? `${bridge.name} at ${bridge.lat}, ${bridge.lon} (${bridge.id})`
      : JSON.stringify(found),
  );
  // Several answers open a list under the field and select nothing until a row is chosen, as in
  // Maps; a single answer goes straight to its place.
  if ((found.places?.length ?? 0) > 1) {
    const results = page.getByRole("listbox", { name: "Search Results" });
    await results.waitFor({ timeout: 10_000 });
    await results.getByRole("option").first().click();
  }
  const pin = window.locator(".mac-maps-pin[data-selected]");
  await pin.waitFor({ state: "visible", timeout: 10_000 });
  const card = page.getByRole("dialog", { name: bridge?.name ?? QUERY });
  await card.waitFor({ state: "visible", timeout: 10_000 });
  // The card shows the coordinates the geocoder answered, as the window writes them
  // (coordinateText in demos/maps/maps-server.ts: five decimals, N/S and E/W).
  const written = bridge
    ? `${Math.abs(bridge.lat).toFixed(5)}° ${bridge.lat >= 0 ? "N" : "S"}, ${Math.abs(bridge.lon).toFixed(5)}° ${bridge.lon >= 0 ? "E" : "W"}`
    : "?";
  step(
    "the place's pin stands on the map and its card shows the geocoder's coordinates",
    (await pin.getAttribute("aria-label")) === bridge?.name &&
      (await card.getByText(written, { exact: false }).count()) === 1,
    written,
  );
  await shot(page, path.join(out, `maps-search-${browserName}.png`));

  // Keep it as a favorite.
  const favorite = card.getByRole("button", { name: "Favorite" });
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === PLACES &&
      JSON.parse(response.request().postData() ?? "{}").favorites?.some(
        (place) => place.id === bridge?.id,
      ),
    { timeout: 10_000 },
  );
  await favorite.click();
  step("the favorite is saved on the server", (await saved).status() === 200);
  step(
    "the card offers Directions, which the module's routes serve",
    (await card.getByRole("button", { name: "Directions" }).isEnabled()) === true,
  );

  // The favorite outlives a reload: the server's places hold it among the favorites, and the
  // sidebar lists it under Favorites (searching also made it a recent, which does not count).
  // A window open before the reload comes back by itself and reads the places during it, so the
  // wait starts first.
  const loaded = nextGet(page, PLACES);
  await reloadDesktop(page);
  window = await openMaps(page);
  const reread = await loaded;
  const kept = reread.status() === 200 ? await reread.json() : null;
  step(
    "the reopened window reads the person's places, the bridge among the favorites",
    reread.status() === 200 &&
      Array.isArray(kept?.favorites) &&
      kept.favorites.some((place) => place.id === bridge?.id),
    `${kept?.favorites?.length ?? 0} favorites`,
  );
  await window.getByRole("button", { name: "Places" }).click();
  const sidebar = window.getByRole("tree", { name: "Places" });
  await sidebar.waitFor({ timeout: 10_000 });
  const favorites = sidebar.getByRole("group", { name: "Favorites" });
  const listed = favorites.getByRole("treeitem", { name: bridge?.name ?? QUERY });
  await listed.first().waitFor({ timeout: 10_000 });
  step(
    "after a reload the sidebar lists the place under Favorites",
    (await listed.count()) === 1,
    `${await listed.count()} rows under Favorites`,
  );
  await shot(page, path.join(out, `maps-favorites-${browserName}.png`));

  const forgot = await api(page, "DELETE", PLACES);
  const after = await api(page, "GET", PLACES);
  step(
    "the journey's guest forgets its places",
    forgot.status === 200 && after.json.favorites === null,
  );
});
