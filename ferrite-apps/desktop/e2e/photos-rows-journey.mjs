#!/usr/bin/env node
// Photos' rows on a photo and an album on the desktop served by `ferrite dev`, each read back from
// what the server keeps or from the window: Add to with New Album, Move to, Adjust Date and Time,
// Assign a Location, Edit With Preview, Duplicate Album, and the open photo coming back after a
// reload. Exits 0 only with every step passed and no console or HTTP error. It deletes what it made.
//
//   node e2e/photos-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-rows");
const tag = Date.now().toString(36);
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const named = (all, name) => all.photos?.find((photo) => photo.name === name);
const albumNamed = (all, name) => all.albums?.find((album) => album.name === name);

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

/** Real JPEGs drawn in the page, for Photos' hidden file input. */
const pictures = (page, names) =>
  page.evaluateHandle(async (names) => {
    const transfer = new DataTransfer();
    for (const [at, name] of names.entries()) {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 360;
      const context = canvas.getContext("2d");
      context.fillStyle = `hsl(${at * 80} 70% 50%)`;
      context.fillRect(0, 0, 480, 360);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
      transfer.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    }
    return transfer;
  }, names);

await run(async (page) => {
  const shots = (name) => shot(page, path.join(out, `photos-rows-${name}.png`));
  const openPhotos = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("Photos");
    await field.press("Enter");
    const opened = page.locator(".mac-window:has(.mac-photos-body)").first();
    await opened.waitFor({ timeout: 10_000 });
    await until(async () => !(await opened.getAttribute("aria-busy")));
    return opened;
  };
  const row = (name) => page.getByRole("menuitem", { name, exact: true }).first();

  await openDesktop(page, base, step);
  let win = await openPhotos();
  const NAMES = ["One", "Two"].map((word) => `${word} ${tag}`);
  const transfer = await pictures(page, NAMES);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const tile = (name) =>
    win
      .getByRole("option", { name, exact: true })
      .or(win.getByRole("button", { name, exact: true }))
      .first();
  await tile(NAMES[1]).waitFor({ timeout: 30_000 });
  const ALBUM = `Album ${tag}`;
  const OTHER = `Other ${tag}`;

  // Add to > New Album makes the album with the photo that was right-clicked in it.
  await tile(NAMES[0]).click({ button: "right" });
  await row("Add to").click();
  await page.waitForTimeout(200);
  await shots("add-to");
  await row("New Album").click();
  await page.getByRole("textbox", { name: "Name" }).fill(ALBUM);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const first = await until(
    async () => albumNamed(await library(page), ALBUM)?.photos.length === 1,
  );
  step("Add to > New Album makes an album holding the photo", first === true);

  // Add to an album by name, in the submenu.
  await win.getByRole("treeitem", { name: /^Photos$/ }).click();
  await win.getByRole("button", { name: "All Photos", exact: true }).click();
  await tile(NAMES[1]).click({ button: "right" });
  await row("Add to").click();
  await row(ALBUM).click();
  const both = await until(async () => albumNamed(await library(page), ALBUM)?.photos.length === 2);
  step("Add to, then an album's name, adds the photo", both === true);

  // Duplicate Album: the same photos in a new album.
  await win.getByRole("treeitem", { name: ALBUM }).first().click({ button: "right" });
  await shots("album-menu");
  await row("Duplicate Album").click();
  const copy = await until(async () => {
    const each = albumNamed(await library(page), `${ALBUM} copy`);
    return each?.photos.length === 2 ? each : null;
  });
  const held = await library(page);
  step(
    "Duplicate Album makes a copy with the same photos",
    JSON.stringify(copy?.photos) === JSON.stringify(albumNamed(held, ALBUM)?.photos),
    JSON.stringify(copy?.photos?.length),
  );

  // Move to, in its submenu, between albums.
  await win.getByRole("treeitem", { name: `${ALBUM} copy` }).waitFor({ timeout: 8_000 });
  await win.getByRole("button", { name: /New Album/ }).click();
  await page.getByRole("textbox", { name: "Name" }).fill(OTHER);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await win.getByRole("treeitem", { name: OTHER }).waitFor({ timeout: 8_000 });
  await win.getByRole("treeitem", { name: ALBUM }).filter({ hasNotText: "copy" }).click();
  await tile(NAMES[1]).click({ button: "right" });
  await row("Move to").click();
  await row(OTHER).click();
  const moved = await until(async () => {
    const all = await library(page);
    return (
      albumNamed(all, ALBUM)?.photos.length === 1 && albumNamed(all, OTHER)?.photos.length === 1
    );
  });
  step("Move to, then an album's name, moves the photo", moved === true);

  // Adjust Date and Time and Assign a Location, from the photo's menu.
  await win.getByRole("treeitem", { name: /^Photos$/ }).click();
  await tile(NAMES[0]).click({ button: "right" });
  await row("Adjust Date and Time…").click();
  await page.getByRole("textbox", { name: "Adjusted" }).fill("2015-06-01T10:30");
  await page.getByRole("button", { name: "Adjust", exact: true }).click();
  const dated = await until(
    async () => new Date(named(await library(page), NAMES[0])?.taken_ms).getFullYear() === 2015,
  );
  step("Adjust Date and Time, in the photo's menu, moves its date", dated === true);
  await tile(NAMES[0]).click({ button: "right" });
  await row("Assign a Location…").click();
  const info = page.locator(".mac-photos-info-window");
  await info.waitFor({ timeout: 5_000 });
  await info.getByRole("textbox", { name: "Location" }).fill("52.1, 4.3 Scheveningen");
  await info.getByRole("textbox", { name: "Location" }).press("Enter");
  const placed = await until(
    async () => named(await library(page), NAMES[0])?.location?.name === "Scheveningen",
  );
  step("Assign a Location, in the photo's menu, keeps the place", placed === true);
  await info.getByRole("button", { name: "Close", exact: true }).first().click();

  // Edit With > Preview opens the original.
  await tile(NAMES[1]).click({ button: "right" });
  await row("Edit With").click();
  await page.waitForTimeout(200);
  await shots("edit-with");
  await row("Preview").click();
  const preview = page.locator('.mac-managed-window[data-window-id="preview"]').first();
  await preview.waitFor({ timeout: 15_000 });
  const shown = await until(async () => (await preview.innerText()).includes(NAMES[1]), 15_000);
  const drawn = await until(
    () =>
      preview
        .locator('[data-page="1"] .mac-preview-app-page-canvas')
        .first()
        .evaluate((canvas) => {
          if (canvas.width < 2) return false;
          const [red, green, , alpha] = canvas
            .getContext("2d")
            .getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
          return alpha === 255 && green > red;
        })
        .catch(() => false),
    15_000,
  );
  await page.waitForTimeout(300);
  await shots("preview");
  step("Edit With > Preview opens the photo's file in Preview", shown === true && drawn === true);
  await preview.getByRole("button", { name: "Close", exact: true }).first().click();

  // A + on My Albums, and Next, Previous and Z in the editor.
  await win.getByRole("button", { name: "Add", exact: true }).click();
  await shots("my-albums-add");
  await page.keyboard.press("Escape");
  await win.getByRole("button", { name: "Add", exact: true }).click();
  await row("Folder").click();
  await page.getByRole("textbox", { name: "Name" }).fill(`Folder ${tag}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const foldered = await until(async () =>
    (await library(page)).folders?.some((each) => each.name === `Folder ${tag}`),
  );
  step("the + on My Albums makes a folder", foldered === true);

  await win.getByRole("treeitem", { name: /^Photos$/ }).click();
  await win.getByRole("button", { name: "All Photos", exact: true }).click();
  const listed = await win.locator("[data-photo-id]").count();
  await tile(NAMES[1]).dblclick();
  await win.locator(".mac-photos-viewer").waitFor({ timeout: 8_000 });
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await win.getByRole("slider", { name: "Exposure" }).first().waitFor({ timeout: 15_000 });
  await win.locator(".mac-photos-edit-stage").click();
  await page.keyboard.press("z");
  const zoomed = await win
    .locator(".mac-photos-edit-stage[data-zoomed] .mac-photos-edit-frame")
    .evaluate((frame) => getComputedStyle(frame).transform);
  await shots("editor-zoomed");
  step("Z in the editor shows the picture larger", zoomed.startsWith("matrix(2,"), zoomed);
  await page.keyboard.press("z");
  step("Z again fits it", (await win.locator(".mac-photos-edit-stage[data-zoomed]").count()) === 0);
  await page.keyboard.press("c");
  await win.locator(".mac-photos-crop").waitFor({ timeout: 5_000 });
  await page.keyboard.press("z");
  const zoomedCrop = await win
    .locator(".mac-photos-edit-stage[data-zoomed] .mac-photos-edit-frame")
    .evaluate((frame) => getComputedStyle(frame).transform);
  step("Z in Crop shows the picture larger too", zoomedCrop.startsWith("matrix(2,"), zoomedCrop);
  await page.keyboard.press("z");
  const crop = win.locator(".mac-photos-crop");
  const cropBefore = await crop.getAttribute("style");
  await win.locator(".mac-photos-crop-handle").first().focus();
  await page.keyboard.press("ArrowRight");
  const nudged = await until(async () => (await crop.getAttribute("style")) !== cropBefore);
  step("and the crop's handles still work once it is fitted", nudged === true);
  await page.keyboard.press("f");
  await win.getByRole("radio", { name: "Mono" }).click();
  await win
    .getByRole("toolbar", { name: "Toolbar" })
    .getByRole("button", { name: "Previous" })
    .click();
  const kept = await until(
    async () => named(await library(page), NAMES[1])?.edit?.filter === "mono",
  );
  step("Previous in the editor keeps this photo's edit", kept === true, `${listed} listed`);
  // One is red and Two green, so the picture on the stage says which photo the editor has.
  const before = await until(
    () =>
      win
        .locator(".mac-photos-edit-canvas")
        .evaluate((canvas) => {
          if (canvas.width < 2) return false;
          const [red, green] = canvas
            .getContext("2d")
            .getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
          return red > green;
        })
        .catch(() => false),
    15_000,
  );
  await shots("editor-previous");
  step("and the photo before opens in the editor", before === true);
  await win.getByRole("button", { name: "Cancel", exact: true }).click();
  await win.getByRole("button", { name: "Back", exact: true }).click();
  await win.locator(".mac-photos-viewer").waitFor({ state: "hidden", timeout: 8_000 });

  // The open photo comes back after a reload.
  await tile(NAMES[1]).dblclick();
  const viewer = win.locator(".mac-photos-viewer");
  await viewer.waitFor({ timeout: 8_000 });
  const showing = await until(async () =>
    (await viewer.getAttribute("aria-label"))?.startsWith(NAMES[1]),
  );
  await page.waitForTimeout(1_500);
  const openedKept = (await library(page)).settings?.opened;
  step(
    "the photo opened is kept with how the window was left",
    showing === true && openedKept === named(await library(page), NAMES[1])?.id,
    `${await viewer.getAttribute("aria-label")} ${openedKept}`,
  );
  await reloadDesktop(page);
  win = await openPhotos();
  await win.locator(".mac-photos-viewer").waitFor({ timeout: 10_000 });
  const label = await win.locator(".mac-photos-viewer").getAttribute("aria-label");
  const back = await until(
    () =>
      win
        .locator(".mac-photos-viewer img")
        .first()
        .evaluate((image) => image.complete && image.naturalWidth > 0)
        .catch(() => false),
    15_000,
  );
  await page.waitForTimeout(300);
  await shots("open-after-reload");
  step(
    "a reload brings back the open photo",
    label?.startsWith(NAMES[1]) === true && back === true,
    label,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1_200);

  const left = await library(page);
  for (const each of (left.photos ?? []).filter((photo) => photo.name.includes(tag))) {
    await api(page, "DELETE", `/api/photos/photos/${each.id}`);
  }
  for (const each of (left.albums ?? []).filter((album) => album.name.includes(tag))) {
    await api(page, "DELETE", `/api/photos/albums/${each.id}`);
  }
  for (const each of (left.folders ?? []).filter((folder) => folder.name.includes(tag))) {
    await api(page, "DELETE", `/api/photos/folders/${each.id}`);
  }
  console.log(`screenshots in ${out}`);
});
