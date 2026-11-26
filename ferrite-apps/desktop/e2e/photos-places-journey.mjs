#!/usr/bin/env node
// Photos' Places on the desktop served by `ferrite dev`: photos given locations appear as pins on
// the map, pins merge at a wide zoom, a pin of several lists them, a pin of one opens it, and the
// Map or Grid choice survives a reload. Exits 0 only with every step passed and no console or HTTP
// error. Pictures are JPEGs drawn in the page; locations are set through the server's photo route.
//
//   node e2e/photos-places-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-places");
const tag = Date.now().toString(36);
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

const tile = (win, name) =>
  win
    .getByRole("option", { name, exact: true })
    .or(win.getByRole("button", { name, exact: true }))
    .first();

const PLACES = [
  [`Dam ${tag}`, 52.373, 4.893, "Amsterdam"],
  [`Canal ${tag}`, 52.368, 4.888, "Amsterdam"],
  [`Shibuya ${tag}`, 35.659, 139.7, "Tokyo"],
];

async function launch(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));
  return win;
}

await run(async (page) => {
  const shots = (name) => shot(page, path.join(out, `photos-places-${name}.png`));
  await openDesktop(page, base, step);
  const win = await launch(page);

  const transfer = await page.evaluateHandle(
    async (names) => {
      const data = new DataTransfer();
      for (const [at, name] of names.entries()) {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        const context = canvas.getContext("2d");
        context.fillStyle = `hsl(${at * 110} 70% 50%)`;
        context.fillRect(0, 0, 320, 240);
        const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
        data.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
      }
      return data;
    },
    PLACES.map(([name]) => name),
  );
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const imported = await until(async () => {
    const all = await library(page);
    const ours = PLACES.map(([name]) => all.photos?.find((photo) => photo.name === name));
    return ours.every(Boolean) ? ours : null;
  }, 20_000);
  step("three pictures are imported", Boolean(imported));

  // Locations through the Info window, as a person sets them.
  for (const [name, lat, lon, place] of PLACES) {
    await tile(win, name).click();
    const info = page.locator(".mac-photos-info-window");
    if (!(await info.isVisible())) await page.keyboard.press("ControlOrMeta+i");
    await info.waitFor({ timeout: 5_000 });
    const field = info.getByRole("textbox", { name: "Location" });
    await field.fill(`${lat}, ${lon} ${place}`);
    await field.press("Enter");
    await until(async () => {
      const photo = (await library(page)).photos?.find((each) => each.name === name);
      return photo?.location;
    });
  }
  step(
    "each photo keeps its location",
    (await library(page)).photos
      .filter((photo) => PLACES.some(([n]) => n === photo.name))
      .every((photo) => photo.location),
  );

  // The Info window's map places a photo with a Control-click.
  const infoWindow = page.locator(".mac-photos-info-window");
  const infoMap = infoWindow.getByRole("application", { name: "Location map" });
  await infoMap.waitFor({ timeout: 5_000 });
  await infoWindow.locator(".mac-photos-info-pin").waitFor({ timeout: 5_000 });
  await infoMap.click({ button: "right", position: { x: 40, y: 30 } });
  const moved = await until(async () => {
    const photo = (await library(page)).photos?.find((each) => each.name === PLACES[2][0]);
    return photo?.location && Math.abs(photo.location.lat - PLACES[2][1]) > 0.01 ? photo : null;
  });
  step("Control-click on the Info map moves the photo", Boolean(moved), moved?.location?.lat);
  await page.waitForTimeout(1_500);
  await shots("info-map");
  const located = infoWindow.getByRole("textbox", { name: "Location" });
  await located.fill(`${PLACES[2][1]}, ${PLACES[2][2]} ${PLACES[2][3]}`);
  await located.press("Enter");
  await until(async () => {
    const photo = (await library(page)).photos?.find((each) => each.name === PLACES[2][0]);
    return photo?.location?.name === PLACES[2][3];
  });

  await page
    .locator(".mac-photos-info-window")
    .getByRole("button", { name: "Close" })
    .click()
    .catch(() => {});
  await win.getByRole("treeitem", { name: "Places", exact: true }).click();
  const map = win.getByRole("application", { name: "Map of photos" });
  await map.waitFor({ timeout: 5_000 });
  const pin = (name) => map.getByRole("button", { name, exact: false });
  await until(async () => (await pin("Tokyo").count()) > 0);
  await until(async () => (await map.locator(".mac-maps-tiles-tile").count()) > 0);
  await page.waitForTimeout(2_500);
  await shots("map");
  step("Tokyo has a pin of one photo", (await pin("Tokyo, 1 Photo").count()) === 1);
  step(
    "two near photos are one pin",
    (await pin("Amsterdam").first().getAttribute("aria-label"))?.includes("Photos"),
  );
  step("the map asks for tiles", (await map.locator(".mac-maps-tiles-tile").count()) > 0);

  await pin("Amsterdam").first().click();
  const canal = win.getByRole("option", { name: PLACES[1][0], exact: true }).first();
  await canal.waitFor({ timeout: 5_000 });
  step(
    "a pin of several lists only its photos",
    (await win.getByRole("option", { name: PLACES[2][0], exact: true }).count()) === 0,
  );
  await shots("pin-grid");

  await win.getByRole("button", { name: "Map", exact: true }).click();
  await map.waitFor({ timeout: 5_000 });
  await pin("Tokyo").first().click();
  const opened = await until(async () => (await win.locator(".mac-photos-viewer img").count()) > 0);
  step("a pin of one opens the photo", Boolean(opened));
  await page.keyboard.press("Escape");
  await map.waitFor({ timeout: 5_000 });
  step("leaving the photo returns to the map", await map.isVisible());

  await win.getByRole("button", { name: "Grid", exact: true }).click();
  await win
    .getByRole("option", { name: PLACES[2][0], exact: true })
    .first()
    .waitFor({ timeout: 5_000 });
  step("Grid lists every located photo", (await win.getByRole("option").count()) >= 3);
  await until(async () => (await library(page)).settings?.placesLayout === "grid", 5_000);

  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  const again = page.locator(".mac-window:has(.mac-photos-body)").first();
  const back = (await again
    .waitFor({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false))
    ? again
    : await launch(page);
  await until(async () => (await back.getByRole("option").count()) >= 3, 15_000);
  step(
    "Places and Grid survive a reload",
    (await back.getByRole("option").count()) >= 3 &&
      (await back.getByRole("application", { name: "Map of photos" }).count()) === 0,
    JSON.stringify((await library(page)).settings),
  );
  await shots("reloaded");

  // Leave the shared account as it was.
  const all = await library(page);
  for (const photo of all.photos.filter((each) => PLACES.some(([n]) => n === each.name))) {
    await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
  }
});
