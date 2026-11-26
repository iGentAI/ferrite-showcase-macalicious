#!/usr/bin/env node
// Maps' depth on Ferrite: the menu bar's commands and their keys, each read back from the window,
// the clipboard or the server, and the dimmed rows with their reasons. Searches and lookups go to
// the module, which asks OpenStreetMap's Nominatim through the application's egress. The browser's
// location is fixed by the context.
//
//   node e2e/maps-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import {
  chooseMenu,
  closeMenus,
  menuItemState,
  messagesComposerHolds,
} from "./media-census-kit.mjs";

const { base, out } = options();
const HERE = { latitude: 37.8106, longitude: -122.4769, accuracy: 25 };
const chromium = {
  permissions: ["geolocation", "clipboard-read", "clipboard-write"],
  geolocation: HERE,
};
const { step, run } = journey("maps-depth", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium },
});
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

const zoomOf = async (map) => Number(await map.getAttribute("data-zoom"));

const creditClearOn = (page) =>
  page.evaluate(() => {
    const credit = document.querySelector(".mac-maps-tiles-attribution").getBoundingClientRect();
    const list = document.querySelector(".mac-maps-search-list").getBoundingClientRect();
    const frame = document.querySelector(".mac-maps-tiles").getBoundingClientRect();
    const within = (rect) =>
      rect.left >= frame.left &&
      rect.right <= frame.right &&
      rect.top >= frame.top &&
      rect.bottom <= frame.bottom;
    return within(credit) && within(list) && credit.top >= list.bottom;
  });

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Maps");
  const window = page.getByRole("region", { name: "Maps", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const map = window.getByRole("application");
  const field = window.getByRole("searchbox", { name: "Search for a place or address" });
  await map.waitFor({ timeout: 10_000 });
  const creditClear = () => creditClearOn(page);

  // ---- Keys straight after launch: the window has the keyboard ---------------------------------
  const opened = await zoomOf(map);
  await page.keyboard.press(`${COMMAND}+=`);
  await page.waitForFunction(
    (zoom) => document.querySelector(".mac-maps-tiles")?.getAttribute("data-zoom") === `${zoom}`,
    opened + 1,
    { timeout: 5_000 },
  );
  step("⌘+ zooms in, the window having the keyboard when it opens", true, `${opened + 1}`);
  await page.keyboard.press(`${COMMAND}+-`);
  await page.waitForTimeout(150);
  step("⌘- zooms out", (await zoomOf(map)) === opened);
  await page.keyboard.press(`${COMMAND}+Shift+=`);
  await page.waitForTimeout(150);
  step("⌘+ with Shift zooms in too", (await zoomOf(map)) === opened + 1);
  await page.keyboard.press(`${COMMAND}+-`);
  await page.waitForTimeout(150);

  // ---- File > Share with no place --------------------------------------------------------------
  const share = await menuItemState(page, "File", "Share");
  step(
    "File > Share is dimmed with its reason while no place is chosen",
    share.disabled && /place/.test(share.title ?? ""),
    share.title ?? "",
  );

  // ---- Edit: Find, Drop Pin, Remove Pin --------------------------------------------------------
  await chooseMenu(page, "Edit", "Find");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("type") === "search",
    null,
    {
      timeout: 5_000,
    },
  );
  step("Edit > Find puts the keyboard in the search field", true);
  await map.click({ position: { x: 300, y: 300 } });
  await page.keyboard.press(`${COMMAND}+f`);
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("type") === "search",
    null,
    {
      timeout: 5_000,
    },
  );
  step("⌘F does too, from the map", true);
  await field.fill("a place");
  await page.keyboard.press(`${COMMAND}+a`);
  await page.keyboard.press(`${COMMAND}+c`);
  await page.waitForTimeout(150);
  step(
    "the dimmed Edit rows leave the search field its own keys",
    (await page.evaluate(() => navigator.clipboard.readText())) === "a place",
  );
  await field.fill("");
  await field.blur();

  const before = (await menuItemState(page, "Edit", "Remove Pin")).disabled;
  step("Edit > Remove Pin is dimmed while there is no dropped pin", before);
  await chooseMenu(page, "Edit", "Drop Pin");
  const pin = window.locator(".mac-maps-pin[data-selected]");
  await pin.waitFor({ timeout: 20_000 });
  const box = await map.boundingBox();
  const pinBox = await pin.boundingBox();
  step(
    "Edit > Drop Pin drops a pin in the middle of the map and opens its card",
    Math.abs(pinBox.x + pinBox.width / 2 - (box.x + box.width / 2)) < 30 &&
      (await page.getByRole("dialog").count()) === 1,
  );
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "maps-dropped-pin.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1_200);
  await chooseMenu(page, "Edit", "Remove Pin");
  await pin.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Edit > Remove Pin takes it away",
    (await window.locator(".mac-maps-pin").count()) === 0 &&
      (await menuItemState(page, "Edit", "Remove Pin")).disabled,
  );
  await map.click({ position: { x: 300, y: 300 } });
  await page.waitForTimeout(1_200);
  await page.keyboard.press(`${COMMAND}+Shift+d`);
  await pin.waitFor({ timeout: 20_000 });
  step("⇧⌘D drops a pin", true);

  // ---- File > Share, on the pin ----------------------------------------------------------------
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  await chooseMenu(page, "File", "Share", "Copy Link");
  await window.getByText("Link Copied").waitFor({ timeout: 5_000 });
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  step(
    "File > Share > Copy Link puts the place's link on the clipboard",
    /^https:\/\/www\.openstreetmap\.org\/\?mlat=/.test(copied),
    copied,
  );
  await chooseMenu(page, "File", "Share", "Messages");
  step(
    "File > Share > Messages starts a message with the place's link",
    await messagesComposerHolds(page, copied),
  );
  await launch(page, "Maps");

  // ---- Remove Pin while another pin's lookup is on its way -------------------------------------
  const hold = { release: () => {} };
  const held = new Promise((resolve) => {
    hold.release = resolve;
  });
  await page.route("**/api/maps/reverse**", async (route) => {
    await held;
    await route.continue();
  });
  await page.waitForTimeout(1_200);
  await chooseMenu(page, "Edit", "Drop Pin");
  await window.getByText("Looking up the dropped pin").waitFor({ timeout: 5_000 });
  await chooseMenu(page, "Edit", "Remove Pin");
  const lookedUp = page.waitForResponse((response) => response.url().includes("/api/maps/reverse"));
  hold.release();
  await lookedUp;
  await page.waitForTimeout(400);
  await page.unroute("**/api/maps/reverse**");
  step(
    "a lookup still on its way when the pin is removed brings no pin back",
    (await window.locator(".mac-maps-pin").count()) === 0 &&
      (await page.getByRole("dialog").count()) === 0 &&
      (await menuItemState(page, "Edit", "Remove Pin")).disabled,
  );

  // ---- View: map types, Scale, zoom, Location --------------------------------------------------
  await map.click({ position: { x: 300, y: 300 } });
  await page.keyboard.press(`${COMMAND}+1`);
  await page.keyboard.press(`${COMMAND}+2`);
  await page.keyboard.press(`${COMMAND}+3`);
  await page.waitForTimeout(150);
  const mapRow = await menuItemState(page, "View", "Map");
  step("View > Map is the checked type and ⌘1 to ⌘3 leave it so", mapRow.checked === "true");
  for (const [name, why] of [
    ["Transit", /transit/],
    ["Satellite", /satellite/],
    ["Show Traffic", /traffic/],
    ["Show 3D Map", /flat/],
    ["Look Around", /photographs/],
  ]) {
    const row = await menuItemState(page, "View", name);
    step(
      `View > ${name} is dimmed with its reason`,
      row.disabled && why.test(row.title ?? ""),
      row.title ?? "",
    );
  }
  for (const name of ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"]) {
    const row = await menuItemState(page, "Edit", name);
    step(
      `Edit > ${name} is dimmed with its reason`,
      row.disabled && Boolean(row.title),
      row.title ?? "",
    );
  }

  await chooseMenu(page, "View", "Show Scale");
  await window.locator(".mac-maps-scale").waitFor({ timeout: 5_000 });
  step("View > Show Scale shows the scale", true);

  const z = await zoomOf(map);
  await chooseMenu(page, "View", "Zoom In");
  await page.waitForTimeout(150);
  step("View > Zoom In zooms in", (await zoomOf(map)) === z + 1);
  await chooseMenu(page, "View", "Zoom Out");
  await page.waitForTimeout(150);
  step("View > Zoom Out zooms out", (await zoomOf(map)) === z);

  await chooseMenu(page, "View", "Go to Current Location");
  await window.locator(".mac-maps-tiles-dot").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  const middleOf = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  const dot = middleOf(await window.locator(".mac-maps-tiles-dot").boundingBox());
  step(
    "View > Go to Current Location moves the map to the browser's location",
    Math.abs(dot.x - (box.x + box.width / 2)) < 3 && Math.abs(dot.y - (box.y + box.height / 2)) < 3,
  );
  await map.dragTo(map, { sourcePosition: { x: 400, y: 300 }, targetPosition: { x: 100, y: 100 } });
  const dragged = middleOf(await window.locator(".mac-maps-tiles-dot").boundingBox());
  step("the drag moved the map away", Math.abs(dragged.x - (box.x + box.width / 2)) > 100);
  await page.keyboard.press(`${COMMAND}+l`);
  await page.waitForTimeout(600);
  const back = middleOf(await window.locator(".mac-maps-tiles-dot").boundingBox());
  step(
    "⌘L does too, after a drag",
    Math.abs(back.x - (box.x + box.width / 2)) < 3 &&
      Math.abs(back.y - (box.y + box.height / 2)) < 3,
  );

  // ---- ⌘R is Directions' key, and not the browser's reload ---------------------------------------
  await page.evaluate(() => {
    window.mapsJourneyNotReloaded = true;
  });
  await page.keyboard.press(`${COMMAND}+r`);
  await window.getByRole("complementary", { name: "Directions" }).waitFor({ timeout: 5_000 });
  await page.keyboard.press(`${COMMAND}+r`);
  await page.waitForTimeout(300);
  step(
    "⌘R opens and closes Directions and leaves the desktop as it is",
    await page.evaluate(() => window.mapsJourneyNotReloaded === true),
  );

  // ---- The menus, for the eye ------------------------------------------------------------------
  const menubar = page.getByRole("menubar").first();
  await menubar.getByRole("menuitem", { name: "View", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Hide Scale", exact: true }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "maps-view-menu.png"));
  await closeMenus(page);
  await menubar.getByRole("menuitem", { name: "Edit", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Drop Pin", exact: true }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "maps-edit-menu.png"));
  await closeMenus(page);
  await window.getByRole("button", { name: "Show Your Current Location" }).waitFor();
  await page.waitForTimeout(1_200);
  await chooseMenu(page, "Edit", "Drop Pin");
  await pin.waitFor({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  await menubar.getByRole("menuitem", { name: "File", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Share", exact: true }).hover();
  await page.getByRole("menuitem", { name: "Copy Link", exact: true }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "maps-file-menu.png"));
  await closeMenus(page);

  // ---- Results list ----------------------------------------------------------------------------
  await page.waitForTimeout(450);
  await chooseMenu(page, "Edit", "Remove Pin");
  await page.waitForTimeout(1_200);
  await field.fill("Paris");
  await field.press("Enter");
  const results = page.getByRole("listbox", { name: "Search Results" });
  await results.waitFor({ timeout: 20_000 });
  const rows = results.getByRole("option");
  const rowCount = await rows.count();
  const pins = window.locator(".mac-maps-pin");
  step(
    "a search with several answers lists them, each with a pin, and opens no card",
    rowCount > 1 &&
      (await pins.count()) === rowCount &&
      (await page.getByRole("dialog").count()) === 0,
    `${rowCount} rows`,
  );
  const inView = await pins.evaluateAll((all) => {
    const frame = document.querySelector(".mac-maps-tiles").getBoundingClientRect();
    const list = document.querySelector(".mac-maps-search-list").getBoundingClientRect();
    return all.every((pin) => {
      const { x, y } = pin.getBoundingClientRect();
      return x >= frame.left && x <= list.left && y >= frame.top && y <= frame.bottom;
    });
  });
  step("the map frames the pins beside the list", inView);
  step("the list leaves the tiles' credit in view", await creditClear());
  await page.waitForTimeout(800);
  await shot(page, path.join(out, "maps-results.png"));

  const second = rows.nth(1);
  const secondName = await second.locator(".mac-maps-search-row-name").innerText();
  await second.click();
  const secondCard = page.getByRole("dialog", { name: secondName });
  await secondCard.waitFor({ timeout: 5_000 });
  step(
    "a row opens its place's card and pin, and the list stays",
    (await window.locator(".mac-maps-pin[data-selected]").getAttribute("aria-label")) ===
      secondName && (await results.isVisible()),
    secondName,
  );
  await secondCard.getByRole("button", { name: "Favorite" }).click();
  const savedPlaces = async () => {
    for (let tries = 0; tries < 20; tries += 1) {
      const places = (await api(page, "GET", "/api/maps/places")).json;
      if (places.favorites?.length > 0) return places;
      await page.waitForTimeout(500);
    }
    return {};
  };
  const kept = await savedPlaces();
  step(
    "the row chosen goes in Recents, and its card's heart in Favorites, on the server",
    kept.recents?.[0]?.name === secondName &&
      kept.favorites?.some((one) => one.name === secondName),
  );
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "maps-result-card.png"));
  await page.keyboard.press("Escape");
  await map.click({ position: { x: 300, y: 500 } });
  await results.waitFor({ state: "detached", timeout: 5_000 });
  step("a press on the map closes the list", true);

  // ---- Real replies with no tags: Nominatim answers "extratags": null for such a place ----------
  await page.waitForTimeout(1_200);
  await field.fill("Springfield");
  const springfield = page.waitForResponse((reply) => reply.url().includes("/api/maps/search"));
  await field.press("Enter");
  step("a common search answers", (await springfield).status() === 200);
  await results.waitFor({ timeout: 20_000 });
  step(
    "and lists its places",
    (await results.getByRole("option").count()) > 1,
    `${await results.getByRole("option").count()} rows`,
  );
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "maps-common-search.png"));
  await map.click({ position: { x: 300, y: 500 } });
  await results.waitFor({ state: "detached", timeout: 5_000 });
  await page.waitForTimeout(1_200);
  const untagged = await api(page, "GET", "/api/maps/reverse?lat=48.85889&lon=2.320041");
  step(
    "a house whose reply has no tags reads as a place",
    untagged.status === 200 && JSON.stringify(untagged.json).includes("Casimir"),
    `HTTP ${untagged.status}`,
  );
  await page.waitForTimeout(1_200);
  const pinLookup = page.waitForResponse((reply) => reply.url().includes("/api/maps/reverse"));
  await chooseMenu(page, "Edit", "Drop Pin");
  step("a pin dropped after them is looked up", (await pinLookup).status() === 200);
  await page.getByRole("dialog").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "maps-dropped-pin.png"));
  await page.keyboard.press("Escape");
  await chooseMenu(page, "Edit", "Remove Pin");

  // ---- Suggestions -----------------------------------------------------------------------------
  await chooseMenu(page, "View", "Go to Current Location");
  await page.waitForTimeout(1_200);
  const lookedUpAgain = page.waitForResponse((response) =>
    response.url().includes("/api/maps/reverse"),
  );
  await chooseMenu(page, "Edit", "Drop Pin");
  await lookedUpAgain;
  await page.waitForTimeout(300);
  const droppedName = await window
    .locator(".mac-maps-pin[data-selected]")
    .getAttribute("aria-label");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  const searches = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/maps/search")) searches.push(request.url());
  });
  await field.click();
  await field.fill("");
  await field.pressSequentially(secondName.slice(0, 5).toLowerCase());
  const suggestions = page.getByRole("listbox", { name: "Suggestions" });
  await suggestions.waitFor({ timeout: 5_000 });
  const suggested = suggestions.getByRole("option", { name: new RegExp(secondName) }).first();
  step(
    "typing suggests the person's own places, saying where each comes from, and asks no server",
    (await suggested.innerText()).includes("Favorites") && searches.length === 0,
    `${searches.length} searches`,
  );
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "maps-suggestions.png"));
  await page.keyboard.press("Escape");
  await suggestions.waitFor({ state: "detached", timeout: 5_000 });
  step("Escape closes the suggestions and keeps the text", (await field.inputValue()) !== "");
  await field.pressSequentially("z");
  await page.waitForTimeout(200);
  step("text no place holds suggests nothing", (await suggestions.count()) === 0);
  await page.keyboard.press("Backspace");
  await suggestions.waitFor({ timeout: 5_000 });
  await page.keyboard.press("ArrowDown");
  const active = await field.getAttribute("aria-activedescendant");
  await page.keyboard.press("Enter");
  const suggestedCard = page.getByRole("dialog");
  await suggestedCard.waitFor({ timeout: 5_000 });
  step(
    "the arrow key and Return open the suggestion's card, with its name in the field",
    active !== null &&
      (await suggestions.count()) === 0 &&
      (await field.inputValue()) === (await suggestedCard.getByRole("heading").first().innerText()),
    await field.inputValue(),
  );
  step(
    "the dropped pin stays on the map beside the place chosen",
    (await window.getByRole("button", { name: droppedName, exact: true }).count()) === 1 &&
      droppedName !== (await field.inputValue()),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  await chooseMenu(page, "Edit", "Remove Pin");
  await page.waitForTimeout(300);
  step(
    "Remove Pin takes that pin and leaves the place chosen",
    (await window.getByRole("button", { name: droppedName, exact: true }).count()) === 0 &&
      (await window.locator(".mac-maps-pin[data-selected]").count()) === 1,
  );

  // ---- A search overtaken by typing ------------------------------------------------------------
  await page.waitForTimeout(1_200);
  const release = { go: () => {} };
  const released = new Promise((resolve) => {
    release.go = resolve;
  });
  await page.route("**/api/maps/search**", async (route) => {
    await released;
    await route.continue();
  });
  const viewBefore = await map.getAttribute("aria-label");
  await field.fill("Paris");
  await field.press("Enter");
  await window.getByText("Searching for").waitFor({ timeout: 5_000 });
  await field.pressSequentially(" x");
  const answered = page.waitForResponse((response) => response.url().includes("/api/maps/search"));
  release.go();
  await answered;
  await page.waitForTimeout(400);
  await page.unroute("**/api/maps/search**");
  step(
    "a search whose text was changed meanwhile moves no map and opens no list of results",
    (await page.getByRole("listbox", { name: "Search Results" }).count()) === 0 &&
      (await map.getAttribute("aria-label")) === viewBefore,
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // ---- The window's smallest size --------------------------------------------------------------
  const frameOf = async () => window.boundingBox();
  const big = await frameOf();
  await page.mouse.move(big.x + big.width - 1, big.y + big.height - 1);
  await page.mouse.down();
  await page.mouse.move(big.x + 100, big.y + 100, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const small = await frameOf();
  step(
    "the window shrinks to its smallest size",
    small.width === 640 && small.height === 320,
    `${small.width} x ${small.height}`,
  );
  await page.waitForTimeout(1_200);
  const narrowed = { go: () => {} };
  const heldForNarrowing = new Promise((resolve) => {
    narrowed.go = resolve;
  });
  await page.route("**/api/maps/search**", async (route) => {
    await heldForNarrowing;
    await route.continue();
  });
  await field.fill("Paris");
  await field.press("Enter");
  await window.getByText("Searching for").waitFor({ timeout: 5_000 });
  await window.getByRole("button", { name: "Places" }).click();
  await page.waitForTimeout(300);
  narrowed.go();
  await results.waitFor({ timeout: 20_000 });
  await page.unroute("**/api/maps/search**");
  await page.waitForTimeout(300);
  const listLeft = (await results.boundingBox()).x;
  const mapLeft = (await map.boundingBox()).x;
  const pinXs = await window
    .locator(".mac-maps-pin")
    .evaluateAll((all) => all.map((pin) => pin.getBoundingClientRect().x));
  step(
    "results that answer after Places narrowed the map are framed for the narrower map",
    pinXs.length > 0 && pinXs.some((x) => x >= mapLeft && x < listLeft),
    `pins at ${pinXs.join(", ")}, map ${mapLeft} to list ${listLeft}`,
  );
  step(
    "at that size, with Places open, the list and the credit are both whole",
    await creditClear(),
  );
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "maps-results-small.png"));

  await page.waitForTimeout(1_200);
  await field.fill("Main Street");
  await field.press("Enter");
  await results.getByRole("option").nth(5).waitFor({ timeout: 20_000 });
  const longList = await results.getByRole("option").count();
  for (let n = 0; n < longList; n += 1) await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  const lastInView = await results
    .getByRole("option")
    .last()
    .evaluate((row) => {
      const shown = row.closest('[role="listbox"]').getBoundingClientRect();
      const { top, bottom } = row.getBoundingClientRect();
      return row.hasAttribute("data-chosen") && top >= shown.top && bottom <= shown.bottom;
    });
  const overflowed = await results.evaluate((view) => view.scrollHeight > view.clientHeight);
  step(
    "the arrow keys bring the chosen row into view in a list that overflows",
    overflowed && lastInView,
    `${longList} rows`,
  );
  await results.getByRole("option").last().click();
  await page.getByRole("dialog").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  const chosenPin = await window.locator(".mac-maps-pin[data-selected]").boundingBox();
  const listNow = await results.boundingBox();
  const mapNow = await map.boundingBox();
  step(
    "at that size a row opens its card with its pin on the map, not under the list",
    chosenPin.x + chosenPin.width <= listNow.x && chosenPin.x >= mapNow.x,
    `pin at ${chosenPin.x}, list from ${listNow.x}`,
  );
  await page.keyboard.press("Escape");

  // ---- A suggestion chosen while a search is on its way ----------------------------------------
  await page.waitForTimeout(1_200);
  const letGo = { go: () => {} };
  const heldSearch = new Promise((resolve) => {
    letGo.go = resolve;
  });
  await page.route("**/api/maps/search**", async (route) => {
    await heldSearch;
    await route.continue();
  });
  await field.fill("Paris");
  await field.press("Enter");
  await window.getByText("Searching for").waitFor({ timeout: 5_000 });
  await field.click();
  await suggestions.getByRole("option").first().click();
  const pickedCard = page.getByRole("dialog");
  await pickedCard.waitFor({ timeout: 5_000 });
  const mapPicked = await map.getAttribute("aria-label");
  const answeredLate = page.waitForResponse((response) =>
    response.url().includes("/api/maps/search"),
  );
  letGo.go();
  await answeredLate;
  await page.waitForTimeout(400);
  await page.unroute("**/api/maps/search**");
  step(
    "a search still on its way when a suggestion is chosen changes neither the card nor the map",
    (await pickedCard.count()) === 1 &&
      (await results.count()) === 0 &&
      (await map.getAttribute("aria-label")) === mapPicked,
  );
});

// The census kit's import keeps the process alive once the run has passed.
process.exit(0);
