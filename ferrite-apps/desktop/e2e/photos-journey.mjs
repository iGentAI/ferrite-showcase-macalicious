#!/usr/bin/env node
// Photos on Ferrite, end to end, as a person with an account of their own.
//
// It creates an account, opens Photos from Spotlight and imports real pictures: a noisy JPEG
// larger than the gateway's 256 KiB request limit by the file picker (uploaded to the drive's
// Pictures folder in pieces), and by a real drop (a DataTransfer of files) a JPEG with EXIF data
// (camera, date taken), a PNG and a text file. A corrupt JPEG, a HEIC picture and a 70 MB file
// are refused, each by name and with why, and nothing of them is uploaded. Then Info, the Shift
// and Command selections and Select All, search, viewing full size, editing and Revert to
// Original, favourites, albums (New Album with the selection and from the File menu, Move to,
// Add to, a photo dragged onto an album's sidebar row, sort by title from the View menu, Rename,
// Remove from Album, Delete Album), Recently
// Deleted (Delete, Recover, Delete Immediately with the original removed from the drive).
// A second browser signed in to the same account sees the first's changes and the first sees the
// second's, live. `ferrite dev` is stopped and started again on the same data root (with
// --restart-command) and everything is still there. Another account sees none of it and cannot
// change it. Every step is checked against what the server keeps (/api/photos/library). Exits 0
// only when every step passed and the pages logged no console error, page error, failed request
// or HTTP error. It removes what it made at the end, and only that (the two accounts stay).
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/photos-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                               [--browser chromium|chrome|firefox|webkit]
//                               [--restart-command "<shell command>"]
//
// --restart-command stops `ferrite dev` and starts it again on the same data root, returning once
// it serves again (campaign scripts: restart-ferrite.sh). Without it the restart steps are
// reported as skipped, never as passed.

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { api, journey, options, reloadDesktop, shot } from "./app-journey.mjs";

const LIBRARY = "/api/photos/library";
const run = Date.now().toString(36);
const NAME = `Journey ${run}`;
const LIGHTHOUSE = `Lighthouse ${run}`;
const HARBOUR = `Harbour ${run}`;
const TRIP = `Trip ${run}`;
const SECOND = `Second ${run}`;
const BEST = `Best ${run}`;
const ELSEWHERE = `Elsewhere ${run}`;
const password = `lens-${run}-frame`;
const owner = { name: `photos-${run}`, fullName: `Photos ${run}` };
const stranger = { name: `stranger-${run}`, fullName: `Stranger ${run}` };
const { base, out, browserName } = options();
const restartAt = process.argv.indexOf("--restart-command");
const restartCommand = restartAt >= 0 ? process.argv[restartAt + 1] : undefined;
const { step, run: drive } = journey("photos");

/** A note in the log that is neither a pass nor a failure: what was not exercised. */
const skip = (label) => console.log(`skip ${label}`);

/** The Photos window, whatever its title says. */
const photosWindow = (page) => page.locator(".mac-window:has(.mac-photos-body)").first();
const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();
const userTile = (page, name) =>
  page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
/** A menu of the menu bar (rendered before any window, so the first of its name). */
const menuTitle = (page, name) =>
  page
    .getByRole("menuitem", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .first();
const menuItem = (page, name) => page.getByRole("menuitem", { name, exact: true }).first();

/** Wait until `check` answers true (polled), answering whether it did. */
async function until(check, timeout = 20_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

/** The page's requests to the application's API that have not finished yet, by page. */
const pending = new WeakMap();
/** Count the page's API requests in flight from now on (see `leaveDesktop`). */
function trackRequests(page) {
  const open = new Set();
  pending.set(page, open);
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) open.add(request);
  });
  const done = (request) => open.delete(request);
  // Chromium sends no `requestfinished` for some large uploads to the drive. Their replies are
  // short acknowledgements the journey has already waited for, so for those alone a response is
  // their end; every other request stays pending until it finishes or fails.
  page.on("response", (response) => {
    if (uploadPath.test(new URL(response.url()).pathname)) done(response.request());
  });
  page.on("requestfinished", done);
  page.on("requestfailed", done);
}

/**
 * Leave the desktop for `to` without cutting a request off, which the run would count as a
 * failed request: close Photos first (an open window reads the library again on each change)
 * and see it gone, then wait for the API requests in flight to finish, then go. Either failing
 * fails the step, unless `force` (the cleanup after a step already failed), which goes anyway.
 */
async function leaveDesktop(page, to, { force = false } = {}) {
  if (page.url() === to) return;
  const window = photosWindow(page);
  if (await window.isVisible().catch(() => false)) {
    try {
      await window.getByRole("button", { name: "Close", exact: true }).first().click({
        timeout: 5_000,
      });
      await window.waitFor({ state: "hidden", timeout: 5_000 });
    } catch (error) {
      if (!force) throw new Error(`Photos did not close before leaving the desktop: ${error}`);
    }
  }
  const open = pending.get(page) ?? new Set();
  const drained = await until(async () => open.size === 0, 15_000);
  if (!drained && !force) {
    const paths = [...open].map((request) => new URL(request.url()).pathname).join(", ");
    throw new Error(`API requests still in flight after 15 s, not cut off: ${paths}`);
  }
  await page.goto(to, { waitUntil: "load" });
}

/** The login window's Create Account… form, filled in and sent; answers when the desktop shows. */
async function createAccount(page, person) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await userTile(page, "Create Account…").waitFor({ timeout: 20_000 });
  await userTile(page, "Create Account…").click();
  const form = page.getByRole("form", { name: "Create Account" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Full Name:").fill(person.fullName);
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByRole("button", { name: "Create Account" }).click();
  await finder(page).waitFor({ timeout: 20_000 });
}

/**
 * Sign in from the login window's Other… form (a browser that never signed in to the account does
 * not list it); answers when the desktop shows.
 */
async function signIn(page, person) {
  await userTile(page, "Other…").click();
  const form = page.getByRole("form", { name: "Log In" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(password);
  await form.getByRole("button", { name: "Log In" }).click();
  await finder(page).waitFor({ timeout: 20_000 });
}

async function openPhotos(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const window = photosWindow(page);
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    (frame) => frame && !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  return window;
}

/** The server's library, and its photo named `name`. */
async function stored(page, name = NAME) {
  const library = (await api(page, "GET", LIBRARY)).json;
  return { library, photo: library.photos?.find((p) => p.name === name) };
}
const albumNamed = (library, name) => library.albums?.find((each) => each.name === name);

/** The SHA-256 of a drive file's bytes as the drive serves them, or why it could not be read. */
const driveSha = (page, id) =>
  page.evaluate(async (id) => {
    const listing = await (await fetch("/api/files/", { credentials: "same-origin" })).json();
    const entry = listing.entries?.find((each) => each.id === id);
    if (!entry) return "no such file";
    const pieces = Math.max(1, Math.ceil(entry.size / listing.piece_bytes));
    const parts = [];
    for (let first = 0; first < pieces; first += 8) {
      const response = await fetch(
        `/api/files/content/${encodeURIComponent(id)}?piece=${first}&count=8&version=${entry.version ?? 0}`,
        { credentials: "same-origin" },
      );
      if (!response.ok) return `HTTP ${response.status}`;
      parts.push(new Uint8Array(await response.arrayBuffer()));
    }
    const all = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of parts) {
      all.set(part, at);
      at += part.length;
    }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", all));
    return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }, id);
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

/**
 * Remove what the journey made, and nothing else: its photos (deleted for good, their originals
 * removed from the drive and the removal confirmed) and its albums. Each is attempted on its own.
 */
async function removeOwn(page, photos, albumIds, { force = false } = {}) {
  // Off the desktop first: an open Photos window reads the library again on each change and
  // removes the originals it lists for purge itself, so one of two deletions of the same drive
  // file would find it gone (404). The site marker is same-origin, so the session still works.
  await leaveDesktop(page, `${base}/ferrite-site.json`, { force });
  const failures = [];
  for (const id of albumIds) {
    await api(page, "DELETE", `/api/photos/albums/${id}`).catch((error) => failures.push(error));
  }
  for (const photo of photos) {
    try {
      const gone = await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
      // Only the original the server hands back (null while another kept photo names it).
      const file = gone.json.file;
      if (file) {
        await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: file }] });
        await api(page, "POST", "/api/photos/purged", { files: [file] });
      }
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw new Error(failures.join("; "));
}

/** A picture drawn in the page and encoded there: base64 of `type` (noisy when `noise`). */
const drawn = (page, { width, height, type, noise, quality = 0.95 }) =>
  page.evaluate(
    async ({ width, height, type, noise, quality }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      const image = context.createImageData(width, height);
      let seed = 7;
      for (let at = 0; at < image.data.length; at += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const x = (at / 4) % width;
        const y = Math.floor(at / 4 / width);
        image.data[at] = (x / width) * 255;
        image.data[at + 1] = noise ? seed & 0xff : (y / height) * 255;
        image.data[at + 2] = noise ? (seed >> 8) & 0xff : 160;
        image.data[at + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";
      for (let at = 0; at < bytes.length; at += 0x8000) {
        text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
      }
      return btoa(text);
    },
    { width, height, type, noise, quality },
  );

/**
 * A JPEG with an EXIF block as a camera writes one, right after its start: Make, Model and the
 * Exif IFD's DateTimeOriginal (little-endian TIFF).
 */
function withExif(jpeg, { make, model, taken }) {
  const strings = [make, model, taken].map((text) => Buffer.from(`${text}\0`, "latin1"));
  const ifd0 = 8;
  const exifIfd = ifd0 + 2 + 3 * 12 + 4;
  const data = exifIfd + 2 + 12 + 4;
  const tiff = Buffer.alloc(data + strings.reduce((sum, each) => sum + each.length, 0));
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(ifd0, 4);
  let at = data;
  const offsets = strings.map((each) => {
    const offset = at;
    each.copy(tiff, at);
    at += each.length;
    return offset;
  });
  const entry = (offset, tag, type, count, value) => {
    tiff.writeUInt16LE(tag, offset);
    tiff.writeUInt16LE(type, offset + 2);
    tiff.writeUInt32LE(count, offset + 4);
    tiff.writeUInt32LE(value, offset + 8);
  };
  tiff.writeUInt16LE(3, ifd0);
  entry(ifd0 + 2, 0x010f, 2, strings[0].length, offsets[0]);
  entry(ifd0 + 14, 0x0110, 2, strings[1].length, offsets[1]);
  entry(ifd0 + 26, 0x8769, 4, 1, exifIfd);
  tiff.writeUInt32LE(0, ifd0 + 38);
  tiff.writeUInt16LE(1, exifIfd);
  entry(exifIfd + 2, 0x9003, 2, strings[2].length, offsets[2]);
  tiff.writeUInt32LE(0, exifIfd + 14);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const marker = Buffer.alloc(4);
  marker.writeUInt16BE(0xffe1, 0);
  marker.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), marker, payload, jpeg.subarray(2)]);
}

/** `length` deterministic noise bytes. */
function noise(length, seed = 11) {
  const bytes = Buffer.alloc(length);
  let state = seed;
  for (let at = 0; at < length; at += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    bytes[at] = (state >> 16) & 0xff;
  }
  return bytes;
}

/**
 * Drop files on `target` as a person dragging them from the Finder does: a DataTransfer holding
 * the files, with dragenter, dragover and drop. Answers whether the pane showed it would take
 * them during the drag (`data-dropping`).
 */
async function dropFiles(page, target, files) {
  const transfer = await page.evaluateHandle(
    (list) => {
      const data = new DataTransfer();
      for (const { name, type, base64 } of list) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at);
        data.items.add(new File([bytes], name, { type, lastModified: Date.now() }));
      }
      return data;
    },
    files.map((file) => ({
      name: file.name,
      type: file.mimeType,
      base64: file.buffer.toString("base64"),
    })),
  );
  await target.dispatchEvent("dragenter", { dataTransfer: transfer });
  await target.dispatchEvent("dragover", { dataTransfer: transfer });
  const accepting = (await target.getAttribute("data-dropping")) !== null;
  await target.dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  return accepting;
}

/**
 * Drag `source` (a photo) onto `target` (an album's sidebar row) with the mouse, as a person does:
 * the desktop's drag follows the pointer. Answers whether the row showed it would take them.
 */
async function dragPhoto(page, source, target) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 });
  const showing = await until(
    async () => (await target.getAttribute("data-desktop-drop")) === "accept",
    3_000,
  );
  await page.mouse.up();
  return showing;
}

/**
 * The natural size of the picture the viewer shows once its full-size image is in, waiting for
 * `expected`. The wait is long: after a reload or a restart the original is read back from the
 * drive and drawn full size with its edit.
 */
async function shownSize(page, window, expected) {
  const image = window.locator("img.mac-photos-picture[data-full]");
  await image.waitFor({ state: "attached", timeout: 45_000 });
  await page
    .waitForFunction(
      ([element, want]) =>
        element.isConnected &&
        element.complete &&
        element.naturalWidth === want.width &&
        element.naturalHeight === want.height,
      [await image.elementHandle(), expected],
      { timeout: 45_000 },
    )
    .catch(() => {});
  return image.evaluate((element) => ({
    width: element.naturalWidth,
    height: element.naturalHeight,
  }));
}

const WIDE = { width: 2400, height: 1600 };
const TALL = { width: 1600, height: 2400 };

const isPost = (url) => (response) =>
  response.request().method() === "POST" && new URL(response.url()).pathname === url;
const uploadPath = /\/api\/files\/uploads(\/|$)/;

/** A tile of the Days view, or an option of a grid, named `name`. */
const tile = (window, name) => window.getByRole("button", { name, exact: true });
const option = (window, name) => window.getByRole("option", { name, exact: true });
const selectedTiles = (window) => window.locator('.mac-photos-cell[aria-pressed="true"]');
const notice = (window) => window.locator(".mac-photos-notice");

/**
 * Errors of a page other than the journey's main one (the second browser, the other account):
 * console errors, page errors, failed requests and HTTP errors, less the refusals a step provokes
 * on purpose (`expected`: paths whose 4xx is the point, and the browser's own console line for it).
 */
function watchOther(page, label, expected = []) {
  const problems = [];
  const provoked = (url) => {
    try {
      return expected.some((each) => each.test(new URL(url, base).pathname));
    } catch {
      return false;
    }
  };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/^Failed to load resource/.test(message.text()) && provoked(message.location()?.url ?? ""))
      return;
    problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400 && !provoked(response.url()))
      problems.push(`${label} HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const aborted = /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(
      request.failure()?.errorText ?? "",
    );
    if (aborted && (url.includes("/__forge/reload") || new URL(url).pathname.startsWith("/live/")))
      return;
    problems.push(`${label} request failed: ${url} ${request.failure()?.errorText}`);
  });
  return problems;
}

/** The journey's steps; `made` records what it created, for the cleanup in `finally`. */
async function walk(page, made) {
  const browser = page.context().browser();
  const contextOptions = {
    viewport: { width: 1440, height: 900 },
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  await createAccount(page, owner);
  step("a new account signs in to its own desktop", await finder(page).isVisible(), owner.name);
  const marker = await api(page, "GET", "/ferrite-site.json");
  step("the desktop is served from the site blob the app published", marker.status === 200);
  let window = await openPhotos(page);
  step(
    "Photos opens on an empty library of its own",
    (await stored(page)).library.photos?.length === 0,
  );

  // Every upload to the drive, by path (the query names the session).
  const uploads = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (uploadPath.test(pathname))
      uploads.push({
        method: request.method(),
        pathname,
        size: request.postDataBuffer()?.length ?? 0,
      });
  });

  // Import by the file picker: a picture larger than one request may be.
  const jpeg = Buffer.from(
    await drawn(page, { width: 2400, height: 1600, type: "image/jpeg", noise: true }),
    "base64",
  );
  step(
    "the picture is larger than one request may be",
    jpeg.length > 262_144,
    `${jpeg.length} bytes`,
  );
  const added = page.waitForResponse(isPost("/api/photos/photos"), { timeout: 30_000 });
  await window
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: `${NAME}.jpg`, mimeType: "image/jpeg", buffer: jpeg });
  const addedReply = await added;
  step("the file picker's picture is added to the library", addedReply.status() === 201);
  const pieces = uploads.filter((each) => each.method === "PUT" && /\/\d+$/.test(each.pathname));
  step(
    "the original went to the drive in pieces under the request limit",
    pieces.length >= 2 && pieces.every((each) => each.size <= 262_144),
    `${pieces.length} pieces`,
  );
  let { photo } = await stored(page);
  if (photo) made.photos.set(photo.id, photo);
  step(
    "the server keeps the photo with its size and its drive file",
    photo?.width === 2400 &&
      photo?.height === 1600 &&
      photo?.bytes === jpeg.length &&
      !!photo?.file,
  );
  const files = await api(page, "GET", "/api/files/");
  const original = files.json.entries?.find((entry) => entry.id === photo?.file);
  step(
    "Finder's Pictures folder holds the original",
    original?.parent === "pictures",
    original?.name,
  );
  await tile(window, NAME).waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    (element) => {
      const image = element.querySelector("img");
      return image?.complete && image.naturalWidth > 0;
    },
    await tile(window, NAME).elementHandle(),
    { timeout: 15_000 },
  );
  step("its thumbnail shows in the Days view", true);

  // Import by a real drop: a JPEG with EXIF data, a PNG, and a text file that is no picture.
  const exifJpeg = withExif(
    Buffer.from(await drawn(page, { width: 640, height: 480, type: "image/jpeg" }), "base64"),
    { make: "Canon", model: "Canon EOS R", taken: "2019:10:07 14:03:00" },
  );
  const png = Buffer.from(
    await drawn(page, { width: 300, height: 200, type: "image/png" }),
    "base64",
  );
  const pane = window.locator(".mac-photos-pane");
  const accepting = await dropFiles(page, pane, [
    { name: `${LIGHTHOUSE}.jpg`, mimeType: "image/jpeg", buffer: exifJpeg },
    { name: `${HARBOUR}.png`, mimeType: "image/png", buffer: png },
    {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Film, batteries, a lens cloth.\n"),
    },
  ]);
  step("dragging files over the pane shows it will take them", accepting);
  const dropped = await until(async () => {
    const { library } = await stored(page);
    return [LIGHTHOUSE, HARBOUR].every((name) => library.photos.some((p) => p.name === name));
  }, 45_000);
  step("the dropped JPEG and PNG are added to the library", dropped);
  let library = (await stored(page)).library;
  const lighthouse = library.photos.find((p) => p.name === LIGHTHOUSE);
  const harbour = library.photos.find((p) => p.name === HARBOUR);
  for (const each of [lighthouse, harbour]) if (each) made.photos.set(each.id, each);
  const takenMs = await page.evaluate(() => new Date(2019, 9, 7, 14, 3, 0).getTime());
  step(
    "the server keeps the JPEG's camera and the day it was taken, from its EXIF data",
    lighthouse?.camera === "Canon EOS R" &&
      lighthouse?.taken_ms === takenMs &&
      lighthouse?.width === 640,
    `${lighthouse?.camera}, ${lighthouse?.taken_ms}`,
  );
  step(
    "the server keeps the PNG as a PNG",
    harbour?.mime === "image/png" && harbour?.width === 300 && harbour?.height === 200,
  );
  step(
    "the text file is not imported, and the window names it and says why",
    !library.photos.some((p) => p.name === "notes") &&
      (await until(async () =>
        /1 of 3 files were not imported: “notes\.txt” is not a picture/.test(
          await notice(window).innerText(),
        ),
      )),
    await notice(window)
      .innerText()
      .catch(() => ""),
  );
  const pictures = (await api(page, "GET", "/api/files/")).json.entries ?? [];
  step(
    "only the two pictures reached the drive's Pictures folder",
    [`${LIGHTHOUSE}.jpg`, `${HARBOUR}.png`].every((name) =>
      pictures.some((entry) => entry.parent === "pictures" && entry.name === name),
    ) && !pictures.some((entry) => entry.name === "notes.txt"),
  );

  // The PNG: its thumbnail shows, and it opens full size from its original.
  await page.waitForFunction(
    (element) => {
      const image = element?.querySelector("img");
      return image?.complete && image.naturalWidth > 0;
    },
    await tile(window, HARBOUR).elementHandle(),
    { timeout: 15_000 },
  );
  await tile(window, HARBOUR).dblclick();
  const pngSize = await shownSize(page, window, { width: 300, height: 200 });
  step(
    "the PNG's thumbnail shows, and it opens full size",
    pngSize.width === 300 && pngSize.height === 200,
    `${pngSize.width} x ${pngSize.height}`,
  );
  await window.getByRole("button", { name: "Back" }).click();

  // Bad pictures: a corrupt JPEG and a HEIC picture, dropped; nothing of them is uploaded.
  const corrupt = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0]),
    noise(4000),
  ]);
  const heic = Buffer.concat([
    Buffer.from([0, 0, 0, 0x18]),
    Buffer.from("ftypheic\0\0\0\0mif1heic", "latin1"),
    noise(2000, 5),
  ]);
  const count = library.photos.length;
  const quiet = uploads.length;
  await dropFiles(page, pane, [
    { name: "broken.jpg", mimeType: "image/jpeg", buffer: corrupt },
    { name: "IMG_4512.HEIC", mimeType: "image/heic", buffer: heic },
  ]);
  const refusedBad = await until(async () => {
    const text = await notice(window).innerText();
    return (
      text.startsWith("2 of 2 files were not imported") &&
      text.includes("“IMG_4512.HEIC” is a HEIC (HEIF) picture") &&
      text.includes(
        "“broken.jpg” could not be read as a picture: the file is damaged or incomplete",
      )
    );
  });
  step(
    "a corrupt JPEG and a HEIC picture are refused by name, saying why",
    refusedBad,
    await notice(window)
      .innerText()
      .catch(() => ""),
  );
  library = (await stored(page)).library;
  step(
    "nothing of the refused files reached the drive or the library",
    uploads.length === quiet && library.photos.length === count,
  );

  // A file larger than the library keeps, by the file picker: refused before any upload.
  const folder = mkdtempSync(path.join(os.tmpdir(), "photos-journey-"));
  try {
    const huge = path.join(folder, "huge.jpg");
    const big = Buffer.alloc(70_000_000);
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(big);
    writeFileSync(huge, big);
    const still = uploads.length;
    await window.locator('input[type="file"]').first().setInputFiles(huge);
    const refusedHuge = await until(async () =>
      (await notice(window).innerText()).includes(
        "“huge.jpg” is 70.0 MB, larger than the 67.1 MB Photos keeps for one picture",
      ),
    );
    step(
      "a 70 MB file is refused by name before anything is uploaded",
      refusedHuge && uploads.length === still,
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }

  // Info, from the keyboard (Command-I) and the menu bar's Image menu.
  await tile(window, LIGHTHOUSE).click();
  await page.keyboard.press("ControlOrMeta+i");
  const info = page.locator(".mac-photos-info-window");
  await info.waitFor({ timeout: 10_000 });
  const infoText = await info.innerText();
  step(
    "Info shows the photo's date, pixel size, file size and camera",
    infoText.includes(LIGHTHOUSE) &&
      infoText.includes("October 7, 2019 at 2:03 PM") &&
      infoText.includes("640 × 480") &&
      infoText.includes("Canon EOS R") &&
      / KB/.test(infoText),
    infoText.replace(/\s+/g, " "),
  );
  await page.keyboard.press("ControlOrMeta+i");
  await info.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  await menuTitle(page, "Image").click();
  await menuItem(page, "Get Info").click();
  step("Image > Get Info opens Info too", await info.isVisible());
  await info.getByRole("button", { name: "Close", exact: true }).click();

  // Selection in the Days view: a Shift range, Command adds, Escape clears, Command-A takes all.
  const shownOrder = await window
    .locator(".mac-photos-cell")
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute("aria-label")));
  await tile(window, shownOrder[0]).click();
  await tile(window, shownOrder[2]).click({ modifiers: ["Shift"] });
  step(
    "Shift-click selects the range of photos between",
    (await selectedTiles(window).count()) === 3,
  );
  await tile(window, shownOrder[1]).click({ modifiers: ["ControlOrMeta"] });
  step(
    "Command-click takes one photo out of the selection",
    (await selectedTiles(window).count()) === 2,
  );
  await page.keyboard.press("Escape");
  step("Escape clears the selection", (await selectedTiles(window).count()) === 0);
  await tile(window, shownOrder[0]).click();
  await page.keyboard.press("ControlOrMeta+a");
  step("Command-A selects every photo shown", (await selectedTiles(window).count()) === 3);
  await page.keyboard.press("Escape");
  await menuTitle(page, "Edit").click();
  await menuItem(page, "Select All").click();
  step("Edit > Select All selects every photo shown", (await selectedTiles(window).count()) === 3);
  await page.keyboard.press("Escape");

  // Favourite with the keyboard: the . key, as in Photos, and again to take it away.
  await tile(window, LIGHTHOUSE).click();
  const starred = page.waitForResponse(isPost(`/api/photos/photos/${lighthouse?.id}`), {
    timeout: 10_000,
  });
  await page.keyboard.press(".");
  await starred;
  step(
    "the . key favourites the selected photo on the server",
    (await stored(page, LIGHTHOUSE)).photo?.favorite === true,
  );
  const unstarred = page.waitForResponse(isPost(`/api/photos/photos/${lighthouse?.id}`), {
    timeout: 10_000,
  });
  await page.keyboard.press(".");
  await unstarred;
  step(
    "pressing . again takes the favourite away",
    (await stored(page, LIGHTHOUSE)).photo?.favorite === false,
  );
  await page.keyboard.press("Escape");

  // Search.
  const search = window
    .getByRole("searchbox")
    .or(window.getByRole("textbox", { name: /search/i }))
    .first();
  await search.fill("canon");
  const found = await until(
    async () =>
      (await option(window, LIGHTHOUSE).isVisible()) && !(await option(window, NAME).isVisible()),
  );
  step("searching for the camera finds only the photo taken with it", found);
  await search.fill(`nothing-${run}`);
  step(
    "a search that finds nothing says No Results",
    await until(() =>
      window.getByRole("status").filter({ hasText: "No Results" }).first().isVisible(),
    ),
  );
  await search.fill("");
  await tile(window, NAME).waitFor({ timeout: 10_000 });

  // View full size, edit, favourite.
  await tile(window, NAME).dblclick();
  const size = await shownSize(page, window, WIDE);
  step(
    "the viewer shows the original full size",
    size.width === 2400 && size.height === 1600,
    `${size.width} x ${size.height}`,
  );
  await window.getByRole("button", { name: "Edit", exact: true }).click();
  await window.locator("canvas.mac-photos-edit-canvas").waitFor({ timeout: 20_000 });
  const exposure = window.getByRole("slider", { name: "Exposure" });
  await exposure.focus();
  for (let n = 0; n < 20; n += 1) await page.keyboard.press("ArrowRight");
  await window.getByRole("button", { name: "Filters" }).click();
  await window.getByRole("radio", { name: "Mono" }).click();
  await window.getByRole("button", { name: "Crop" }).click();
  await window.getByRole("button", { name: "Rotate", exact: true }).click();
  const saved = page.waitForResponse(isPost(`/api/photos/photos/${photo?.id}`), {
    timeout: 20_000,
  });
  await window.getByRole("button", { name: "Done" }).click();
  step("Done saves the edit", (await saved).status() === 200);
  ({ photo } = await stored(page));
  step(
    "the original's bytes on the drive are unchanged by the edit",
    (await driveSha(page, photo?.file)) === sha(jpeg),
  );
  step(
    "the server keeps the edit as a recipe beside the untouched original",
    photo?.edit?.filter === "mono" &&
      photo?.edit?.rotate === 1 &&
      Math.abs((photo?.edit?.adjust?.exposure ?? 0) - 0.2) < 0.001 &&
      photo?.bytes === jpeg.length,
    JSON.stringify(photo?.edit),
  );
  const edited = await shownSize(page, window, TALL);
  step(
    "the viewer shows the edited photo, turned",
    edited.width === 1600 && edited.height === 2400,
  );
  const favored = page.waitForResponse(isPost(`/api/photos/photos/${photo?.id}`), {
    timeout: 10_000,
  });
  await window.getByRole("button", { name: "Favorite" }).click();
  await favored;
  ({ photo } = await stored(page));
  step("Favorite is kept on the server", photo?.favorite === true);
  await shot(page, path.join(out, `photos-edited-${browserName}.png`));

  // After a reload: in Favorites, still edited; Revert to Original.
  await reloadDesktop(page);
  window = await openPhotos(page);
  await window.getByRole("treeitem", { name: "Favorites" }).click();
  await option(window, NAME).waitFor({ timeout: 10_000 });
  step("after a reload, the photo is in Favorites", true);
  await option(window, NAME).dblclick();
  const again = await shownSize(page, window, TALL);
  step("after a reload, it opens edited", again.width === 1600 && again.height === 2400);
  await window.getByRole("button", { name: "Edit", exact: true }).click();
  const reverted = page.waitForResponse(isPost(`/api/photos/photos/${photo?.id}`), {
    timeout: 20_000,
  });
  await window.getByRole("button", { name: "Revert to Original" }).click();
  await reverted;
  ({ photo } = await stored(page));
  step("Revert to Original forgets the edit", photo?.edit === null);
  const afterRevert = await driveSha(page, photo?.file);
  step(
    "after Revert the original's bytes are still the imported ones",
    afterRevert === sha(jpeg),
    `${afterRevert} ${sha(jpeg)} ${photo?.file}`,
  );
  const plain = await shownSize(page, window, WIDE);
  step("the viewer shows the original again", plain.width === 2400 && plain.height === 1600);
  await window.getByRole("button", { name: "Back" }).click();
  await window.getByRole("treeitem", { name: "Photos", exact: true }).click();

  // Albums. New Album with the selection (the sidebar), and an empty one (the File menu).
  await tile(window, LIGHTHOUSE).click();
  await tile(window, NAME).click({ modifiers: ["ControlOrMeta"] });
  await window.getByRole("button", { name: "New Album" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill(TRIP);
  const tripMade = page.waitForResponse(isPost("/api/photos/albums"), { timeout: 10_000 });
  await page.getByRole("button", { name: "Create" }).click();
  await tripMade;
  const tripGrid = window.getByRole("listbox", { name: TRIP });
  await option(tripGrid, NAME).waitFor({ timeout: 10_000 });
  library = (await stored(page)).library;
  const trip = albumNamed(library, TRIP);
  if (trip) made.albums.add(trip.id);
  step(
    "New Album with the selection keeps both photos in it on the server",
    trip?.photos?.length === 2 &&
      trip.photos.includes(photo?.id) &&
      trip.photos.includes(lighthouse?.id),
  );
  await menuTitle(page, "File").click();
  await menuItem(page, "New Album").click();
  await page.getByRole("textbox", { name: "Name" }).fill(SECOND);
  const secondMade = page.waitForResponse(isPost("/api/photos/albums"), { timeout: 10_000 });
  await page.getByRole("button", { name: "Create" }).click();
  await secondMade;
  library = (await stored(page)).library;
  const second = albumNamed(library, SECOND);
  if (second) made.albums.add(second.id);
  step("File > New Album makes an empty album on the server", second?.photos?.length === 0);
  await window.getByRole("treeitem", { name: SECOND }).waitFor({ timeout: 10_000 });

  // Move to: Lighthouse leaves Trip as it joins Second, in one change.
  await window.getByRole("treeitem", { name: TRIP }).click();
  await option(tripGrid, LIGHTHOUSE).click({ button: "right" });
  const moved = page.waitForResponse(isPost(`/api/photos/albums/${second?.id}`), {
    timeout: 10_000,
  });
  await menuItem(page, "Move to").click();
  await menuItem(page, SECOND).click();
  await moved;
  library = (await stored(page)).library;
  step(
    "Move to takes the photo out of one album and into the other on the server",
    JSON.stringify(albumNamed(library, TRIP)?.photos) === JSON.stringify([photo?.id]) &&
      JSON.stringify(albumNamed(library, SECOND)?.photos) === JSON.stringify([lighthouse?.id]),
  );
  await option(tripGrid, NAME).click({ button: "right" });
  const addedTo = page.waitForResponse(isPost(`/api/photos/albums/${second?.id}`), {
    timeout: 10_000,
  });
  await menuItem(page, "Add to").click();
  await menuItem(page, SECOND).click();
  await addedTo;
  library = (await stored(page)).library;
  step(
    "Add to puts the photo in a second album and keeps it in the first",
    albumNamed(library, SECOND)?.photos?.length === 2 &&
      albumNamed(library, TRIP)?.photos?.length === 1,
  );

  // Drag a photo from the library onto Trip's row in the sidebar.
  await window.getByRole("treeitem", { name: "Photos", exact: true }).click();
  await tile(window, LIGHTHOUSE).waitFor({ timeout: 10_000 });
  const draggedIn = page.waitForResponse(isPost(`/api/photos/albums/${trip?.id}`), {
    timeout: 10_000,
  });
  const showedTarget = await dragPhoto(
    page,
    tile(window, LIGHTHOUSE),
    window.getByRole("treeitem", { name: TRIP }),
  );
  await draggedIn;
  library = (await stored(page)).library;
  step(
    "dragging a photo onto an album's row in the sidebar adds it to that album on the server",
    showedTarget &&
      JSON.stringify(albumNamed(library, TRIP)?.photos) ===
        JSON.stringify([photo?.id, lighthouse?.id]),
    `${showedTarget} ${JSON.stringify(albumNamed(library, TRIP)?.photos)}`,
  );

  // Sort Second by title from the View menu: the order is kept on the server and shown.
  await window.getByRole("treeitem", { name: SECOND }).click();
  const secondGrid = window.getByRole("listbox", { name: SECOND });
  await option(secondGrid, NAME).waitFor({ timeout: 10_000 });
  const orderOf = () =>
    secondGrid
      .getByRole("option")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("aria-label") ?? item.textContent),
      );
  step(
    "an album lists its photos in the order they were added",
    JSON.stringify(await orderOf()) === JSON.stringify([LIGHTHOUSE, NAME]),
    JSON.stringify(await orderOf()),
  );
  const sortedReply = page.waitForResponse(isPost(`/api/photos/albums/${second?.id}`), {
    timeout: 10_000,
  });
  await menuTitle(page, "View").click();
  await menuItem(page, "Sort").hover();
  await page.getByRole("menuitemradio", { name: "Keep Sorted By Title" }).click();
  await sortedReply;
  library = (await stored(page)).library;
  const titled = await until(
    async () => JSON.stringify(await orderOf()) === JSON.stringify([NAME, LIGHTHOUSE]),
  );
  step(
    "View > Sort > Keep Sorted By Title is kept on the server and orders the album",
    albumNamed(library, SECOND)?.sort === "title" && titled,
  );

  // Rename it.
  await window.getByRole("button", { name: "Rename…" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill(BEST);
  const renamed = page.waitForResponse(isPost(`/api/photos/albums/${second?.id}`), {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await renamed;
  library = (await stored(page)).library;
  step(
    "Rename keeps the album's new name on the server",
    albumNamed(library, BEST)?.id === second?.id,
  );
  await window.getByRole("treeitem", { name: BEST }).waitFor({ timeout: 10_000 });

  // Remove from Album, then delete Trip (its photos stay in the library).
  const bestGrid = window.getByRole("listbox", { name: BEST });
  await option(bestGrid, LIGHTHOUSE).click({ button: "right" });
  const removed = page.waitForResponse(isPost(`/api/photos/albums/${second?.id}`), {
    timeout: 10_000,
  });
  await menuItem(page, "Remove from Album").click();
  await removed;
  library = (await stored(page)).library;
  step(
    "Remove from Album takes it out of the album, not the library",
    JSON.stringify(albumNamed(library, BEST)?.photos) === JSON.stringify([photo?.id]) &&
      library.photos.some((p) => p.id === lighthouse?.id && p.deleted_ms === null),
  );
  await window.getByRole("treeitem", { name: TRIP }).click();
  const tripGone = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === `/api/photos/albums/${trip?.id}`,
    { timeout: 10_000 },
  );
  await window.getByRole("button", { name: "Delete Album" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await tripGone;
  library = (await stored(page)).library;
  if (trip) made.albums.delete(trip.id);
  step(
    "Delete Album deletes the album and keeps its photos",
    !albumNamed(library, TRIP) && library.photos.filter((p) => p.deleted_ms === null).length === 3,
  );

  // Recently Deleted: the Delete key and Recover; Edit > Delete Photo and Delete Immediately.
  await window.getByRole("treeitem", { name: "Photos", exact: true }).click();
  await tile(window, NAME).click();
  const deleted = page.waitForResponse(isPost(`/api/photos/photos/${photo?.id}`), {
    timeout: 10_000,
  });
  await page.keyboard.press("Delete");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await deleted;
  ({ photo } = await stored(page));
  step("Delete moves the photo to Recently Deleted", typeof photo?.deleted_ms === "number");

  // After a reload: the albums as they were left, and the photo still in Recently Deleted.
  await reloadDesktop(page);
  window = await openPhotos(page);
  await window.getByRole("treeitem", { name: BEST }).waitFor({ timeout: 15_000 });
  const tripAfterReload = await window.getByRole("treeitem", { name: TRIP }).count();
  await window.getByRole("treeitem", { name: BEST }).click();
  const bestAfterReload = await window
    .getByRole("listbox", { name: BEST })
    .getByRole("option")
    .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));
  await window.getByRole("treeitem", { name: "Recently Deleted" }).click();
  await option(window, NAME).waitFor({ timeout: 10_000 });
  step(
    "after a reload: the renamed album, without the deleted one, and the photo in Recently Deleted",
    tripAfterReload === 0 &&
      bestAfterReload.length === 0 &&
      (await option(window, NAME).innerText()).includes("30 days"),
    `${tripAfterReload} ${JSON.stringify(bestAfterReload)}`,
  );
  await option(window, NAME).click();
  const recovered = page.waitForResponse(isPost(`/api/photos/photos/${photo?.id}`), {
    timeout: 10_000,
  });
  await window.getByRole("button", { name: "Recover" }).click();
  await recovered;
  ({ photo } = await stored(page));
  step("Recover brings it back", photo?.deleted_ms === null);
  await window.getByRole("treeitem", { name: "Photos", exact: true }).click();
  await tile(window, HARBOUR).click();
  const binned = page.waitForResponse(isPost(`/api/photos/photos/${harbour?.id}`), {
    timeout: 10_000,
  });
  await menuTitle(page, "Edit").click();
  await menuItem(page, "Delete Photo").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await binned;
  await window.getByRole("treeitem", { name: "Recently Deleted" }).click();
  await option(window, HARBOUR).click();
  const usageBefore = (await api(page, "GET", "/api/files/")).json.usage;
  const purged = page.waitForResponse(isPost("/api/photos/purged"), { timeout: 15_000 });
  await window.getByRole("button", { name: "Delete Immediately" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await purged;
  library = (await stored(page)).library;
  const drive = await api(page, "GET", "/api/files/");
  step(
    "Delete Immediately deletes the photo for good and its original from the drive",
    !library.photos.some((p) => p.id === harbour?.id) &&
      !library.purge.includes(harbour?.file) &&
      !drive.json.entries?.some((entry) => entry.id === harbour?.file),
  );
  const harbourThumbs = await api(page, "GET", `/api/photos/thumbs?ids=${harbour?.id}`);
  step(
    "deleting for good reclaims its storage: the drive's usage falls by the original's size, and no thumbnail is left",
    usageBefore - drive.json.usage === harbour?.bytes &&
      Object.keys(harbourThumbs.json.thumbs ?? {}).length === 0,
    `${usageBefore} - ${drive.json.usage} = ${usageBefore - drive.json.usage}, original ${harbour?.bytes}`,
  );
  if (harbour) made.photos.delete(harbour.id);
  await window.getByRole("treeitem", { name: "Photos", exact: true }).click();
  await shot(page, path.join(out, `photos-${browserName}.png`));

  // Spotlight lists the photo, as it lists Photos' photos and albums.
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(LIGHTHOUSE);
  const listed = await until(
    async () => (await page.getByRole("option", { name: new RegExp(LIGHTHOUSE) }).count()) > 0,
    15_000,
  );
  step("Spotlight finds the photo by name", listed);
  // Escape clears Spotlight's text first and closes it the next time: closed before going on.
  for (let n = 0; n < 3 && (await field.isVisible().catch(() => false)); n += 1) {
    await page.keyboard.press("Escape");
    await field.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
  }
  step("Spotlight closes with Escape", !(await field.isVisible().catch(() => false)));

  // A second browser of the same account: each sees the other's changes, live.
  const otherContext = await browser.newContext(contextOptions);
  const otherPage = await otherContext.newPage();
  const otherProblems = watchOther(otherPage, "second browser");
  await otherPage.goto(`${base}/`, { waitUntil: "load" });
  await signIn(otherPage, owner);
  const otherWindow = await openPhotos(otherPage);
  await tile(otherWindow, LIGHTHOUSE).waitFor({ timeout: 15_000 });
  step(
    "the account's second browser shows the same library",
    await otherWindow.getByRole("treeitem", { name: BEST }).isVisible(),
  );
  await otherWindow.getByRole("treeitem", { name: "Favorites" }).click();
  await tile(window, LIGHTHOUSE).click();
  await window.getByRole("button", { name: "Favorite" }).click();
  step(
    "a favourite made in the first browser shows in the second without reopening Photos",
    await until(() => option(otherWindow, LIGHTHOUSE).isVisible(), 30_000),
  );
  await otherWindow.getByRole("button", { name: "New Album" }).click();
  await otherPage.getByRole("textbox", { name: "Name" }).fill(ELSEWHERE);
  await otherPage.getByRole("button", { name: "Create" }).click();
  step(
    "an album made in the second browser shows in the first",
    await until(() => window.getByRole("treeitem", { name: ELSEWHERE }).isVisible(), 30_000),
  );
  const elsewhere = albumNamed((await stored(page)).library, ELSEWHERE);
  if (elsewhere) made.albums.add(elsewhere.id);
  await otherWindow.getByRole("button", { name: "Delete Album" }).click();
  await otherPage.getByRole("button", { name: "Delete", exact: true }).click();
  step(
    "deleting it in the second browser removes it from the first",
    await until(
      async () => (await window.getByRole("treeitem", { name: ELSEWHERE }).count()) === 0,
      30_000,
    ),
  );
  if (elsewhere) made.albums.delete(elsewhere.id);
  step("the second browser logged no errors", otherProblems.length === 0, otherProblems.join("; "));
  await otherContext.close();

  // Left for the restart: Lighthouse turned (an edit) and in Recently Deleted.
  await tile(window, LIGHTHOUSE).click();
  const turned = page.waitForResponse(isPost(`/api/photos/photos/${lighthouse?.id}`), {
    timeout: 15_000,
  });
  await window.getByRole("button", { name: "Rotate" }).click();
  await turned;
  const binnedLighthouse = page.waitForResponse(isPost(`/api/photos/photos/${lighthouse?.id}`), {
    timeout: 10_000,
  });
  await page.keyboard.press("Delete");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await binnedLighthouse;
  const beforeRestart = (await stored(page, LIGHTHOUSE)).photo;
  step(
    "Rotate keeps a turn as an edit, and Delete moves the photo to Recently Deleted",
    beforeRestart?.edit?.rotate === 1 && typeof beforeRestart?.deleted_ms === "number",
  );

  // Stop `ferrite dev` and start it again on the same data root.
  if (restartCommand) {
    // Off the desktop first, so its live streams end as a page closing them, not as failures.
    await leaveDesktop(page, "about:blank");
    let restarted = true;
    try {
      execSync(restartCommand, { stdio: "inherit", timeout: 420_000 });
    } catch (error) {
      restarted = false;
      console.log(`restart command failed: ${error}`);
    }
    step("ferrite dev stops and starts again on the same data root", restarted);
    await page.goto(`${base}/`, { waitUntil: "load" });
    await finder(page).or(userTile(page, "Other…")).first().waitFor({ timeout: 30_000 });
    const kept = await finder(page).isVisible();
    console.log(`note the session ${kept ? "survived" : "did not survive"} the restart`);
    if (!kept) await signIn(page, owner);
    window = await openPhotos(page);
    library = (await stored(page)).library;
    const after = (name) => library.photos.find((p) => p.name === name);
    step(
      "after the restart the library is all there: photos, favourite, camera, edits, Recently Deleted, albums and their order",
      after(NAME)?.deleted_ms === null &&
        after(NAME)?.edit === null &&
        after(LIGHTHOUSE)?.favorite === true &&
        after(LIGHTHOUSE)?.camera === "Canon EOS R" &&
        after(LIGHTHOUSE)?.edit?.rotate === 1 &&
        typeof after(LIGHTHOUSE)?.deleted_ms === "number" &&
        !after(HARBOUR) &&
        !albumNamed(library, TRIP) &&
        albumNamed(library, BEST)?.sort === "title" &&
        JSON.stringify(albumNamed(library, BEST)?.photos) === JSON.stringify([photo?.id]),
    );
    await tile(window, NAME).dblclick();
    const back = await shownSize(page, window, WIDE);
    step(
      "after the restart the original opens full size from the drive",
      back.width === 2400 && back.height === 1600,
    );
    step(
      "after the restart the original's bytes are the imported ones",
      (await driveSha(page, photo?.file)) === sha(jpeg),
    );
    await window.getByRole("button", { name: "Back" }).click();
    // Recover after the restart: it comes back turned, and opens turned.
    await window.getByRole("treeitem", { name: "Recently Deleted" }).click();
    await option(window, LIGHTHOUSE).click();
    const restored = page.waitForResponse(isPost(`/api/photos/photos/${lighthouse?.id}`), {
      timeout: 10_000,
    });
    await window.getByRole("button", { name: "Recover" }).click();
    await restored;
    await window.getByRole("treeitem", { name: "Photos", exact: true }).click();
    await tile(window, LIGHTHOUSE).dblclick();
    const turnedBack = await shownSize(page, window, { width: 480, height: 640 });
    step(
      "after the restart Recover brings the photo back, and it opens turned",
      (await stored(page, LIGHTHOUSE)).photo?.deleted_ms === null &&
        turnedBack.width === 480 &&
        turnedBack.height === 640,
      `${turnedBack.width} x ${turnedBack.height}`,
    );
    await window.getByRole("button", { name: "Back" }).click();
  } else {
    skip("ferrite dev restart (no --restart-command given): not exercised");
  }

  // Another account: sees none of it, and cannot change it.
  const strangerContext = await browser.newContext(contextOptions);
  const strangerPage = await strangerContext.newPage();
  const strangerProblems = watchOther(strangerPage, "other account", [/^\/api\/photos\/photos\//]);
  await createAccount(strangerPage, stranger);
  const strangerWindow = await openPhotos(strangerPage);
  const theirs = (await stored(strangerPage)).library;
  const thumbs = await api(
    strangerPage,
    "GET",
    `/api/photos/thumbs?ids=${[...made.photos.keys()].join(",")}`,
  );
  const meddle = await api(strangerPage, "POST", `/api/photos/photos/${photo?.id}`, {
    favorite: false,
  });
  const theirFiles = await api(strangerPage, "GET", "/api/files/");
  step(
    "another account sees no photo, album, thumbnail or original of the first",
    theirs.photos.length === 0 &&
      theirs.albums.length === 0 &&
      Object.keys(thumbs.json.thumbs ?? {}).length === 0 &&
      ![...made.photos.values()].some((each) =>
        theirFiles.json.entries?.some((entry) => entry.id === each.file),
      ) &&
      (await strangerWindow.getByRole("status").innerText()).includes("No Photos"),
  );
  step("another account cannot change the first's photos", meddle.status === 404);
  step(
    "the other account's browser logged no errors",
    strangerProblems.length === 0,
    strangerProblems.join("; "),
  );
  await strangerContext.close();
  ({ photo } = await stored(page));
  step("the first account's photo is unchanged by the other", photo?.favorite === true);

  await removeOwn(page, [...made.photos.values()], [...made.albums]);
  made.cleaned = true;
  const after = (await stored(page)).library;
  step(
    "the journey leaves nothing of its own behind",
    after.photos.length === 0 && after.albums.length === 0,
  );
}

await drive(async (page) => {
  const made = { photos: new Map(), albums: new Set() };
  trackRequests(page);
  try {
    await walk(page, made);
  } finally {
    // A step that failed or timed out still leaves nothing of the journey's behind.
    if (!made.cleaned) {
      // What the page showed when it stopped, for the evidence.
      await shot(page, path.join(out, `photos-aborted-${browserName}.png`)).catch(() => {});
      const shown = await page
        .locator('[role="menuitem"]:visible, [role="alert"]:visible')
        .evaluateAll((items) =>
          items.map(
            (item) =>
              `${item.getAttribute("role")}: ${item.textContent?.trim()}${item.getAttribute("aria-disabled") === "true" || item.hasAttribute("data-disabled") ? " (disabled)" : ""}`,
          ),
        )
        .catch(() => []);
      console.log(`note shown when it stopped: ${shown.join(" | ")}`);
      const library = await api(page, "GET", LIBRARY)
        .then((reply) => reply.json)
        .catch(() => null);
      const ours = library?.photos ?? [...made.photos.values()];
      const albums = library?.albums?.map((each) => each.id) ?? [...made.albums];
      await removeOwn(page, ours, albums, { force: true }).catch((error) =>
        console.log(`warn cleanup after a failed step did not finish: ${error}`),
      );
    }
  }
});
