#!/usr/bin/env node
// Photos as a place files are sent: a JPEG and a WebM movie dragged from Finder onto Photos' Dock tile are
// imported, and a double-click on the picture still opens it in Preview, not in Photos. Read back from
// what the server keeps.
// Exits 0 only with every step passed and no console or HTTP error. It deletes what it made.
//
//   node e2e/photos-dock-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { base, out } = options();
const { step, run } = journey("photos-dock");
const tag = Date.now().toString(36);
const NAME = `Tile ${tag}`;
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;

async function until(check, ms = 30_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const putPicture = (page, parent, name) =>
  page.evaluate(
    async ({ parent, name }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext("2d");
      context.fillStyle = "#30a0c0";
      context.fillRect(0, 0, 320, 240);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size: blob.size, type: "image/jpeg" }),
      });
      const { upload } = await started.json();
      await fetch(`/api/files/uploads/${upload}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: blob,
      });
      const done = await fetch(`/api/files/uploads/${upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
      return (await done.json()).created[0];
    },
    { parent, name },
  );

const movieName = `Tile movie ${tag}`;
const putMovie = (page, name) =>
  page.evaluate(
    async ({ name, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (each) => each.charCodeAt(0));
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent: "documents", name, size: bytes.length, type: "video/webm" }),
      });
      const { upload, piece_bytes: pieceBytes, pieces } = await started.json();
      for (let index = 0; index < pieces; index += 1) {
        await fetch(`/api/files/uploads/${upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: bytes.slice(index * pieceBytes, (index + 1) * pieceBytes),
        });
      }
      await fetch(`/api/files/uploads/${upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
    },
    {
      name,
      base64: readFileSync(path.join(here, "fixtures", "test-pattern.webm")).toString("base64"),
    },
  );

await run(async (page) => {
  await openDesktop(page, base, step);
  await putPicture(page, "documents", `${NAME}.jpg`);
  await putMovie(page, `${movieName}.webm`);
  const dock = page.getByRole("toolbar", { name: "Dock" });
  await dock.getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const file = finder.getByRole("option", { name: `${NAME}.jpg`, exact: true });
  await file.waitFor({ timeout: 15_000 });

  // A double-click leaves the picture to Preview: Photos is only ever asked by name.
  await file.dblclick();
  const preview = page.locator(".mac-preview-app").first();
  await preview.waitFor({ state: "visible", timeout: 15_000 });
  const held = await library(page);
  step(
    "a double-click opens the picture in Preview and imports nothing",
    !(held.photos ?? []).some((photo) => photo.name === NAME),
  );
  await preview.getByRole("button", { name: "Close", exact: true }).first().click();

  await dock.getByRole("button", { name: "Finder" }).click();
  await file.waitFor({ timeout: 10_000 });
  const from = await file.boundingBox();
  const tile = dock.getByRole("button", { name: "Photos", exact: true });
  const to = await tile.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.waitForTimeout(200);
  const mark = await tile.getAttribute("data-desktop-drop");
  await shot(page, path.join(out, "photos-dock-drag.png"));
  await page.mouse.up();
  step("Photos' Dock tile accepts a picture", mark === "accept", `${mark}`);
  const imported = await until(async () =>
    (await library(page)).photos?.find((photo) => photo.name === NAME),
  );
  step("the drop imports it into the library", Boolean(imported));
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 15_000 });
  await win
    .getByRole("option", { name: NAME, exact: true })
    .or(win.getByRole("button", { name: NAME, exact: true }))
    .first()
    .waitFor({ timeout: 15_000 });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "photos-dock-imported.png"));
  step("Photos opens and shows it", true);

  // A movie goes the same way, and Photos treats it as a movie.
  await dock.getByRole("button", { name: "Finder" }).click();
  const movieFile = finder.getByRole("option", { name: `${movieName}.webm`, exact: true });
  await movieFile.waitFor({ timeout: 15_000 });
  const movieFrom = await movieFile.boundingBox();
  await page.mouse.move(movieFrom.x + movieFrom.width / 2, movieFrom.y + movieFrom.height / 2);
  await page.mouse.down();
  await page.mouse.move(movieFrom.x + movieFrom.width / 2 + 10, movieFrom.y + 20, { steps: 4 });
  const tileNow = await tile.boundingBox();
  await page.mouse.move(tileNow.x + tileNow.width / 2, tileNow.y + tileNow.height / 2, {
    steps: 12,
  });
  await page.waitForTimeout(200);
  const movieMark = await tile.getAttribute("data-desktop-drop");
  await page.mouse.up();
  step("Photos' Dock tile accepts a movie", movieMark === "accept", `${movieMark}`);
  const movie = await until(async () =>
    (await library(page)).photos?.find((photo) => photo.name === movieName),
  );
  step(
    "the drop imports it as a movie with a length",
    Boolean(movie) && movie.duration_ms > 0 && movie.mime === "video/webm",
    movie ? `${movie.mime}, ${movie.duration_ms} ms` : "not in the library",
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "photos-dock-movie.png"));

  if (movie) await api(page, "DELETE", `/api/photos/photos/${movie.id}`);
  if (imported) await api(page, "DELETE", `/api/photos/photos/${imported.id}`);
});
