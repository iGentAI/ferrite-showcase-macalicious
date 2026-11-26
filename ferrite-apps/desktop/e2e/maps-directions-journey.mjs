#!/usr/bin/env node
// Maps' directions, Share, paper, saved view and second window on Ferrite. Routes come from the
// module, which asks the FOSSGIS routers through the application's egress; places come from
// Nominatim the same way. The browser's location is fixed by the context. The browser's print
// dialog is replaced by a counter.
//
//   node e2e/maps-directions-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { readFile } from "node:fs/promises";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import {
  chooseMenu,
  closeMenus,
  menuItemState,
  messagesComposerHolds,
  until,
} from "./media-census-kit.mjs";

const { base, out } = options();
const HERE = { latitude: 37.8106, longitude: -122.4769, accuracy: 25 };
const { step, run, expectRefusal } = journey("maps-directions", {
  ignoreOtherOrigins: true,
  contextOptions: {
    chromium: {
      permissions: ["geolocation", "clipboard-read", "clipboard-write"],
      geolocation: HERE,
      acceptDownloads: true,
    },
  },
});

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Maps");
  const window = page.getByRole("region", { name: "Maps", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const map = window.getByRole("application");
  await map.waitFor({ timeout: 10_000 });

  // ---- Directions from the toolbar: the current location to a place typed ----------------------
  await window.getByRole("button", { name: "Directions", exact: true }).click();
  const panel = window.getByRole("complementary", { name: "Directions" });
  await panel.waitFor({ timeout: 5_000 });
  const start = panel.getByRole("textbox", { name: "Start" });
  const end = panel.getByRole("textbox", { name: "End" });
  step(
    "the toolbar opens the panel, starting from the current location",
    (await start.inputValue()) === "Current Location",
  );
  await end.fill("Fisherman's Wharf, San Francisco");
  await end.press("Enter");
  const summary = panel.locator(".mac-maps-journey-summary");
  await summary.waitFor({ timeout: 20_000 });
  const drive = await summary.innerText();
  const steps = panel.locator(".mac-maps-journey-step");
  step(
    "a route is found, with its time, its length and its steps",
    /min|hr/.test(drive) && (await steps.count()) >= 3,
    `${drive}; ${await steps.count()} steps; "${await steps.first().innerText()}"`,
  );
  const line = await window.locator(".mac-maps-route polyline").getAttribute("points");
  step("the route's line is drawn over the map", (line ?? "").split(" ").length > 10);
  await page.waitForTimeout(1_500);
  await shot(page, path.join(out, "maps-directions-route.png"));

  // A step moves the map to it.
  const before = await map.getAttribute("aria-label");
  await steps.nth(1).click();
  step(
    "a step is chosen and the map goes to it",
    (await steps.nth(1).getAttribute("data-chosen")) !== null &&
      Number(await map.getAttribute("data-zoom")) >= 16,
    before,
  );

  // ---- Walking asks its own router -------------------------------------------------------------
  const walked = page.waitForResponse((response) => response.url().includes("mode=walking"));
  await panel.getByRole("button", { name: "Walk", exact: true }).click();
  step("Walk asks for a walking route", (await walked).status() === 200);
  step(
    "the time changes for walking",
    await until(async () => (await summary.innerText()) !== drive, 15_000),
    await summary.innerText(),
  );
  const transit = panel.getByRole("button", { name: "Transit", exact: true });
  step(
    "Transit is dimmed and says why",
    (await transit.isDisabled()) &&
      /public transport/.test((await transit.getAttribute("title")) ?? ""),
  );

  // ---- Swap ------------------------------------------------------------------------------------
  await panel.getByRole("button", { name: "Swap Start and End" }).click();
  step("Swap exchanges the two ends", (await end.inputValue()) === "Current Location");
  step("Swap finds the way back", await until(async () => (await steps.count()) > 0, 15_000));
  await page.waitForTimeout(1_100);

  // ---- A change made while a route is on its way: the older answer is never shown --------------
  let held = () => {};
  const hold = new Promise((resolve) => {
    held = resolve;
  });
  await page.route("**/api/maps/route**", async (route) => {
    await hold;
    await route.continue();
  });
  const sent = page.waitForRequest((request) => request.url().includes("/api/maps/route"));
  await panel.getByRole("button", { name: "Drive", exact: true }).click();
  await panel.getByText("Finding a route").waitFor({ timeout: 5_000 });
  await sent;
  const answered = page.waitForResponse((response) => response.url().includes("/api/maps/route"));
  await start.fill("");
  held();
  await (await answered).finished();
  await page.waitForTimeout(500);
  step(
    "an answer to a question since changed is not shown",
    (await steps.count()) === 0 && (await summary.count()) === 0,
  );
  await page.unroute("**/api/maps/route**");

  // ---- Directions hidden while a route is on its way: the answer moves nothing -----------------
  let heldAgain = () => {};
  const holdAgain = new Promise((resolve) => {
    heldAgain = resolve;
  });
  await page.route("**/api/maps/route**", async (route) => {
    await holdAgain;
    await route.continue();
  });
  const sentAgain = page.waitForRequest((request) => request.url().includes("/api/maps/route"));
  await start.fill("Current Location");
  await start.press("Enter");
  await sentAgain;
  await window.getByRole("button", { name: "Directions", exact: true }).click();
  await panel.waitFor({ state: "hidden", timeout: 5_000 });
  const shownBefore = await map.getAttribute("data-zoom");
  const tilesBefore = await map.locator("img").first().getAttribute("data-tile");
  const answeredAgain = page.waitForResponse((response) =>
    response.url().includes("/api/maps/route"),
  );
  heldAgain();
  await (await answeredAgain).finished();
  await page.waitForTimeout(500);
  step(
    "a route answered after Directions was hidden does not move the map",
    (await map.getAttribute("data-zoom")) === shownBefore &&
      (await map.locator("img").first().getAttribute("data-tile")) === tilesBefore &&
      (await window.locator(".mac-maps-route").count()) === 0,
  );
  await page.unroute("**/api/maps/route**");
  await window.getByRole("button", { name: "Directions", exact: true }).click();
  await panel.waitFor({ timeout: 5_000 });

  // ---- No road between two places: the router's own NoRoute, under HTTP 400 --------------------
  expectRefusal(404, "/api/maps/route");
  await start.fill("Honolulu, Hawaii");
  await end.fill("San Francisco, California");
  await end.press("Enter");
  await panel.getByText("No route: no road joins these places").waitFor({ timeout: 20_000 });
  step("no road between two places says so", (await steps.count()) === 0);

  // ---- Two names typed that nobody has asked for: they share the search's one turn a second ----
  const towns = [
    "Fresno",
    "Modesto",
    "Stockton",
    "Redding",
    "Chico",
    "Visalia",
    "Merced",
    "Salinas",
    "Eureka",
    "Ukiah",
  ];
  const pick = Date.now() % towns.length;
  await start.fill(`${towns[pick]}, California`);
  await end.fill(`${towns[(pick + 1) % towns.length]}, California`);
  await end.press("Enter");
  await summary.waitFor({ timeout: 30_000 });
  step(
    "two places typed get a route with no second Return",
    (await steps.count()) > 0,
    await summary.innerText(),
  );
  await start.fill("Current Location");
  await end.fill("Fisherman's Wharf, San Francisco");

  // ---- ⌘R closes it; the View row says so -------------------------------------------------------
  await map.click({ position: { x: 300, y: 300 } });
  await page.keyboard.press("ControlOrMeta+r");
  await panel.waitFor({ state: "hidden", timeout: 5_000 });
  step("⌘R hides the panel", (await window.locator(".mac-maps-route").count()) === 0);
  await page.keyboard.press("ControlOrMeta+r");
  await panel.waitFor({ timeout: 5_000 });
  await page.keyboard.press("ControlOrMeta+r");

  // ---- The map's context menu: Drop Pin, then the pin's own --------------------------------------
  await page.waitForTimeout(1_100);
  await map.click({ button: "right", position: { x: 400, y: 260 } });
  const mapMenu = page.getByRole("menu", { name: "Map" });
  await mapMenu.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "maps-map-menu.png"));
  const mapRows = await mapMenu.getByRole("menuitem").allInnerTexts();
  step("the map's menu has its rows", mapRows.length === 4, mapRows.join(", "));
  const pinsBefore = await window.locator(".mac-maps-pin").count();
  await mapMenu.getByRole("menuitem", { name: "Drop Pin" }).click();
  const pin = window.locator(".mac-maps-pin").last();
  step(
    "Drop Pin adds a pin",
    await until(async () => (await window.locator(".mac-maps-pin").count()) === pinsBefore + 1),
  );
  const pinAt = await pin.evaluate((element) => ({
    x: Number.parseFloat(element.style.left),
    y: Number.parseFloat(element.style.top),
  }));
  step(
    "the pin is where the menu was asked for, whatever place the lookup found",
    Math.abs(pinAt.x - 400) <= 2 && Math.abs(pinAt.y - 260) <= 2,
    JSON.stringify(pinAt),
  );
  const pinName = await pin.getAttribute("aria-label");
  await page.keyboard.press("Escape");
  await pin.click({ button: "right", force: true });
  await mapMenu.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "maps-pin-menu.png"));
  const pinRows = await mapMenu.getByRole("menuitem").allInnerTexts();
  step(
    "a pin has a menu of its own",
    pinRows.includes("Remove Pin") && pinRows.includes("Add to Favorites"),
    pinRows.join(", "),
  );
  await mapMenu.getByRole("menuitem", { name: "Directions To Here" }).click();
  await panel.waitFor({ timeout: 5_000 });
  step(
    "Directions To Here puts the pin at the end of the journey",
    (await end.inputValue()) === pinName,
    await end.inputValue(),
  );
  await page.waitForTimeout(1_100);
  await window.locator(".mac-maps-route").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(300);
  await pin.click({ button: "right", force: true });
  await mapMenu.getByRole("menuitem", { name: "Directions From Here" }).click();
  step(
    "Directions From Here puts the pin at the start",
    await until(async () => (await start.inputValue()) === pinName, 5_000),
  );
  await start.fill("Current Location");
  await end.fill("Somewhere else");
  await window.getByRole("button", { name: "Directions", exact: true }).click();

  // ---- A place's card: Directions -----------------------------------------------------------------
  await pin.click({ force: true });
  const cardDirections = page
    .getByRole("dialog")
    .getByRole("button", { name: "Directions", exact: true });
  await cardDirections.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "maps-card-directions.png"));
  await cardDirections.click();
  await panel.waitFor({ timeout: 5_000 });
  step(
    "the card's Directions puts the place at the end, in place of what was there",
    (await end.inputValue()) === pinName,
    await end.inputValue(),
  );
  await window.getByRole("button", { name: "Directions", exact: true }).click();

  // ---- Share, everywhere the shared rows go ------------------------------------------------------
  await pin.click({ force: true });
  for (const row of ["Copy Link"]) await chooseMenu(page, "File", "Share", row);
  await window.getByText("Link Copied").waitFor({ timeout: 5_000 });
  const link = await page.evaluate(() => navigator.clipboard.readText());
  step("File > Share > Copy Link", link.startsWith("https://www.openstreetmap.org/"), link);
  // This place's mark, unique to the link; the rest of the link may be escaped in the document.
  const mark = link.split("&")[0];
  const storedNotes = async () => JSON.stringify((await api(page, "GET", "/api/notes/data")).json);
  step("no note holds this link before Share", !(await storedNotes()).includes(mark));
  await chooseMenu(page, "File", "Share", "Notes");
  const notes = page.getByRole("region", { name: "Notes", exact: true }).first();
  await notes.waitFor({ timeout: 15_000 });
  step(
    "File > Share > Notes shows a note of the place's link",
    await until(async () => (await notes.innerText()).includes(mark), 15_000),
    mark,
  );
  await shot(page, path.join(out, "maps-share-notes.png"));
  step(
    "the note is on the server",
    await until(async () => (await storedNotes()).includes(mark), 15_000),
  );
  await chooseMenu(page, "Notes", "Hide Notes").catch(() => closeMenus(page));
  await launch(page, "Maps");
  await chooseMenu(page, "File", "Share", "Messages");
  step(
    "File > Share > Messages starts a message with the place's link",
    await messagesComposerHolds(page, mark),
  );
  await shot(page, path.join(out, "maps-share-messages.png"));
  await launch(page, "Maps");

  // ---- Export as PDF and Print -------------------------------------------------------------------
  const download = page.waitForEvent("download", { timeout: 30_000 });
  await chooseMenu(page, "File", "Export as PDF…");
  const file = await download;
  const saved = path.join(out, "maps-export.pdf");
  await file.saveAs(saved);
  const bytes = await readFile(saved);
  step(
    "Export as PDF writes a PDF of the map",
    file.suggestedFilename() === "Map.pdf" &&
      bytes.subarray(0, 5).toString() === "%PDF-" &&
      bytes.length > 5_000,
    `${bytes.length} bytes`,
  );
  await page.evaluate(() => {
    window.__printed = 0;
    const ask = HTMLIFrameElement.prototype.addEventListener;
    HTMLIFrameElement.prototype.addEventListener = function (type, listener, options) {
      return ask.call(
        this,
        type,
        (event) => {
          this.contentWindow.print = () => {
            window.__printed += 1;
          };
          listener(event);
        },
        options,
      );
    };
  });
  await chooseMenu(page, "File", "Print…");
  step(
    "Print… asks to print",
    await until(() => page.evaluate(() => window.__printed === 1), 30_000),
  );
  const picture = await page
    .frameLocator("iframe[data-maps-print]")
    .locator("img")
    .evaluate((image) => image.naturalWidth);
  step(
    "Print… prints a picture of the map from a frame of its own",
    picture > 300,
    `${picture} px wide`,
  );

  // ---- Rows that stay dimmed, saying why ---------------------------------------------------------
  for (const [menu, row, words] of [
    ["File", "New Tab", /own/],
    ["View", "Show Tab Bar", /own/],
    ["View", "Show Labels", /labels/],
    ["Maps", "Preferences…", /no preferences/],
  ]) {
    const state = await menuItemState(page, menu, row);
    step(
      `${menu} > ${row} is dimmed and says why`,
      state.disabled && words.test(state.title ?? ""),
      state.title,
    );
  }
  await closeMenus(page);

  // ---- Saved: the view, the panel and the scale survive a reload -----------------------------------
  await map.click({ position: { x: 300, y: 300 } });
  await page.keyboard.press("ControlOrMeta+-");
  await page.keyboard.press("ControlOrMeta+-");
  await chooseMenu(page, "View", "Show Scale");
  await window.getByRole("button", { name: "Places", exact: true }).click();
  await page.waitForTimeout(800);
  const zoomKept = await map.getAttribute("data-zoom");
  await reloadDesktop(page, base);
  await launch(page, "Maps");
  const again = page.getByRole("region", { name: "Maps", exact: true }).first();
  const mapAgain = again.getByRole("application");
  await mapAgain.waitFor({ timeout: 15_000 });
  step(
    "the last map view survives a reload",
    await until(async () => (await mapAgain.getAttribute("data-zoom")) === zoomKept, 10_000),
    `zoom ${zoomKept}`,
  );
  step(
    "the Places panel and the scale survive it",
    (await again.getByRole("tree", { name: "Places" }).count()) === 1 &&
      (await again.locator(".mac-maps-scale").count()) === 1,
  );

  // ---- The sidebar's row menu: a recent place, then renaming a guide -------------------------------
  const tree = again.getByRole("tree", { name: "Places" });
  const recent = tree.getByRole("treeitem").filter({ hasNotText: /^No / }).first();
  await recent.waitFor({ timeout: 10_000 });
  await recent.click({ button: "right" });
  const rowMenu = page.getByRole("menu", { name: "Place" });
  await rowMenu.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "maps-row-menu.png"));
  const placeRows = await rowMenu.getByRole("menuitem").allInnerTexts();
  step(
    "a place's row has its menu",
    placeRows.includes("Directions To Here") && placeRows.includes("Remove"),
    placeRows.join(", "),
  );
  await page.keyboard.press("Escape");
  await again.getByRole("button", { name: "New Guide" }).click();
  await again.getByRole("textbox", { name: "New guide name" }).fill("Weekend");
  await page.keyboard.press("Enter");
  await tree.getByRole("treeitem", { name: /Weekend/ }).click({ button: "right" });
  await rowMenu.getByRole("menuitem", { name: "Rename Guide" }).click();
  await again.getByRole("textbox", { name: "New guide name" }).fill("Long Weekend");
  await page.keyboard.press("Enter");
  await tree.getByRole("treeitem", { name: /Long Weekend/ }).waitFor({ timeout: 5_000 });
  step("Rename Guide renames it", true);

  // ---- A second window: its own map, the same places ---------------------------------------------
  await page.keyboard.press("ControlOrMeta+n");
  const windows = page.getByRole("region", { name: "Maps", exact: true });
  step("⌘N opens a second window", await until(async () => (await windows.count()) === 2, 10_000));
  await shot(page, path.join(out, "maps-two-windows.png"));
  const one = windows.nth(0);
  const two = windows.nth(1);
  await page.waitForTimeout(600);
  const oneZoom = await one.getByRole("application").getAttribute("data-zoom");
  await two.getByRole("application").click({ position: { x: 200, y: 200 } });
  await page.keyboard.press("ControlOrMeta+-");
  await page.waitForTimeout(900);
  step(
    "each window has its own map",
    (await one.getByRole("application").getAttribute("data-zoom")) === oneZoom &&
      (await two.getByRole("application").getAttribute("data-zoom")) !== oneZoom,
  );
  await two.getByRole("button", { name: "New Guide" }).click();
  await two.getByRole("textbox", { name: "New guide name" }).fill("Second");
  await page.keyboard.press("Enter");
  await one.getByRole("treeitem", { name: /Second/ }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(1_500);
  const guides = (await api(page, "GET", "/api/maps/places")).json.guides.map(
    (guide) => guide.name,
  );
  step(
    "a guide made in one window shows in the other, and the server holds both guides",
    guides.includes("Second") && guides.includes("Long Weekend"),
    guides.join(", "),
  );
});

process.exit(0);
