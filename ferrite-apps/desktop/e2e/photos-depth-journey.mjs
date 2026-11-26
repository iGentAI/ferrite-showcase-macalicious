#!/usr/bin/env node
// Photos at the depth of the real app, on the desktop served by `ferrite dev`, with real mouse and
// keyboard input, each step read back from what the server keeps. A screenshot of each area goes
// to --out. It drags pictures in from Finder, gives one a title, caption, keywords and place in
// Info, hides one, makes an album, a folder and a smart album, moves two selected photos between
// albums by dragging, walks the library views, searches and filters, opens the full-screen viewer
// and a slideshow with the keys, edits and reverts, deletes and recovers, and reloads to find it
// all there. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photos-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-depth");
const tag = Date.now().toString(36);
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const named = (all, name) => all.photos?.find((photo) => photo.name === name);

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const photosWindow = (page) => page.locator(".mac-window:has(.mac-photos-body)").first();
const finderWindow = (page) => page.locator(".mac-window.mac-finder").first();
const menuTitle = (page, name) =>
  page
    .getByRole("menuitem", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .first();
const menuItem = (page, name) => page.getByRole("menuitem", { name, exact: true }).first();
const row = (win, name) => win.getByRole("treeitem", { name }).first();
const tile = (win, name) =>
  win
    .getByRole("button", { name, exact: true })
    .or(win.getByRole("option", { name, exact: true }))
    .first();

async function choose(page, menu, item) {
  await menuTitle(page, menu).click();
  await menuItem(page, item).click();
}

/** A real JPEG drawn in the page, put on the drive in `parent` in one piece. */
const putPicture = (page, parent, name, hue) =>
  page.evaluate(
    async ({ parent, name, hue }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d");
      const fill = context.createLinearGradient(0, 0, 640, 480);
      fill.addColorStop(0, `hsl(${hue} 80% 60%)`);
      fill.addColorStop(1, `hsl(${(hue + 80) % 360} 70% 30%)`);
      context.fillStyle = fill;
      context.fillRect(0, 0, 640, 480);
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
    { parent, name, hue },
  );

const centre = async (locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element to drag is not shown");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Press on `from`, move to `to`, let go: answers what the target was marked with on the way. */
async function dragWithMouse(page, from, to) {
  const a = await centre(from);
  const b = await centre(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 10, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 10 });
  const mark = await page.evaluate(
    () => document.querySelector("[data-desktop-drop]")?.getAttribute("data-desktop-drop") ?? null,
  );
  await page.mouse.up();
  return mark;
}

await run(async (page) => {
  const shots = (name) => shot(page, path.join(out, `photos-${name}.png`));
  await openDesktop(page, base, step);
  const NAMES = ["One", "Two", "Three", "Four"].map((word) => `${word} ${tag}`);
  for (const [at, name] of NAMES.entries()) {
    await putPicture(page, "documents", `${name}.jpg`, at * 70);
  }

  // Finder and Photos side by side: pictures dragged from Finder import into Photos.
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = finderWindow(page);
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  await finder
    .getByRole("option", { name: `${NAMES[0]}.jpg`, exact: true })
    .waitFor({ timeout: 15_000 });

  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = photosWindow(page);
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));

  // Move Finder clear of Photos' pane is unneeded: Photos' own frame takes the drop wherever shown.
  const frontFinder = page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Finder" });
  await frontFinder.click();
  const file = finder.getByRole("option", { name: `${NAMES[0]}.jpg`, exact: true });
  await file.click();
  for (const name of NAMES.slice(1)) {
    await finder
      .getByRole("option", { name: `${name}.jpg`, exact: true })
      .click({ modifiers: ["ControlOrMeta"] });
  }
  // Finder's window opens over Photos' left side; the right part of Photos stays uncovered.
  const box = await win.boundingBox();
  const fbox = await finder.boundingBox();
  const spot = { x: Math.min(box.x + box.width - 40, 1400), y: box.y + box.height / 2 };
  const a = await centre(file);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 10, { steps: 4 });
  await page.mouse.move(spot.x, spot.y, { steps: 10 });
  const accepted = await page.evaluate(({ x, y }) => {
    const under = document.elementFromPoint(x, y);
    return (
      under?.closest("[data-desktop-drop]")?.getAttribute("data-desktop-drop") ??
      `not marked: ${under?.className}`
    );
  }, spot);
  await shots("01-drag-from-finder");
  await page.mouse.up();
  step(
    "dragging four selected files from Finder over Photos shows it takes them",
    accepted === "accept",
    `${accepted}; Finder at ${Math.round(fbox?.x ?? 0)}`,
  );
  const imported = await until(async () => {
    const all = await library(page);
    return all.photos?.length === 4 ? all : null;
  }, 45_000);
  step(
    "Photos imported the four files, uploading them",
    Boolean(imported),
    `${imported?.photos?.length}`,
  );

  // Close Finder so that nothing covers Photos.
  await finder.getByRole("button", { name: "Close", exact: true }).first().click();
  await finder.waitFor({ state: "detached", timeout: 5_000 });
  await win.click({ position: { x: 400, y: 10 } });
  await tile(win, NAMES[0]).waitFor({ timeout: 15_000 });
  await shots("02-library-days");

  // Library views.
  for (const [view, key] of [
    ["Years", "1"],
    ["Months", "2"],
    ["Days", "3"],
    ["All Photos", "4"],
  ]) {
    await win.getByRole("button", { name: view, exact: true }).click();
    await page.waitForTimeout(150);
    if (view === "Years") await shots("03-years");
    step(`the library shows ${view}`, (await tile(win, NAMES[0]).count()) > 0, key);
  }

  // Info: title, caption, keywords, location on one photo, kept on the server.
  await tile(win, NAMES[0]).click();
  await page.keyboard.press("ControlOrMeta+i");
  const info = page.locator(".mac-photos-info-window");
  await info.waitFor({ timeout: 5_000 });
  await info.getByRole("textbox", { name: "Title" }).fill(`Sunset ${tag}`);
  await info.getByRole("textbox", { name: "Caption" }).fill("On the pier at dusk");
  await info.getByRole("textbox", { name: "Caption" }).press("Enter");
  await info.getByRole("combobox", { name: "Keywords" }).fill(`beach${tag}`);
  await info.getByRole("combobox", { name: "Keywords" }).press("Enter");
  await info.getByRole("textbox", { name: "Location" }).fill("52.1, 4.3 Scheveningen");
  await info.getByRole("textbox", { name: "Location" }).press("Enter");
  const noted = await until(async () => {
    const photo = named(await library(page), NAMES[0]);
    return photo?.title && photo?.caption && photo?.keywords?.length && photo?.location
      ? photo
      : null;
  });
  step(
    "Info keeps a title, caption, keyword and location",
    noted?.title === `Sunset ${tag}` && noted?.location?.name === "Scheveningen",
    JSON.stringify(noted?.keywords),
  );
  await shots("04-info");

  // Adjust Date and Time.
  await choose(page, "Image", "Adjust Date and Time…");
  await page.getByRole("textbox", { name: "Adjusted" }).fill("2015-06-01T10:30");
  await page.getByRole("button", { name: "Adjust", exact: true }).click();
  const dated = await until(async () => {
    const photo = named(await library(page), NAMES[0]);
    return photo && new Date(photo.taken_ms).getFullYear() === 2015 ? photo : null;
  });
  step("Adjust Date and Time moves the photo's date", Boolean(dated));
  await page.keyboard.press("ControlOrMeta+i");

  // Keyword Manager.
  await choose(page, "Window", "Keyword Manager");
  const manager = page.locator(".mac-photos-keyword-window");
  await manager.waitFor({ timeout: 5_000 });
  await manager.getByRole("textbox", { name: "New Keyword" }).fill(`family${tag}`);
  await manager.getByRole("button", { name: "Add", exact: true }).click();
  await tile(win, NAMES[1]).click();
  await manager.getByRole("button", { name: `family${tag}`, exact: true }).click();
  const tagged = await until(
    async () => named(await library(page), NAMES[1])?.keywords?.length === 1,
  );
  step("the Keyword Manager adds a keyword to the selection", tagged === true);
  await shots("05-keyword-manager");
  await manager.getByRole("button", { name: "Close", exact: true }).first().click();

  // Search and filter.
  const search = win.getByRole("searchbox").first();
  await search.fill(`beach${tag}`);
  await page.waitForTimeout(200);
  step(
    "search finds a photo by keyword",
    (await tile(win, NAMES[0]).count()) === 1 && (await tile(win, NAMES[1]).count()) === 0,
  );
  await search.fill("scheveningen");
  await page.waitForTimeout(200);
  step("search finds a photo by place", (await tile(win, NAMES[0]).count()) === 1);
  await shots("06-search");
  await search.fill("");

  // A smart album of what carries the keyword.
  await page.keyboard.press("Escape");
  await choose(page, "File", "New Smart Album…");
  await page.getByRole("textbox", { name: "Smart Album name" }).fill(`Smart ${tag}`);
  await page
    .getByRole("combobox", { name: "Rule 1 field" })
    .or(page.getByRole("button", { name: /Rule 1 field/ }))
    .first()
    .click();
  await page
    .getByRole("option", { name: "Keyword", exact: true })
    .or(page.getByRole("menuitemradio", { name: "Keyword", exact: true }))
    .first()
    .click();
  await shots("07-smart-album-sheet");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  const smart = await until(async () => (await library(page)).smart_albums?.[0]);
  step(
    "a smart album is kept with its rule",
    smart?.name === `Smart ${tag}`,
    JSON.stringify(smart?.rules),
  );
  await tile(win, NAMES[0]).or(tile(win, NAMES[1])).first().waitFor({ timeout: 8_000 });
  await shots("08-smart-album");

  // A folder, an album in My Albums, and two selected photos dragged into it, then between albums.
  await row(win, /^Photos$/).click();
  await win.getByRole("button", { name: "All Photos", exact: true }).click();
  await choose(page, "File", "New Folder");
  await page.getByRole("textbox", { name: "Name" }).fill(`Trips ${tag}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await row(win, `Trips ${tag}`).waitFor({ timeout: 8_000 });
  for (const name of [`First ${tag}`, `Second ${tag}`]) {
    await page.keyboard.press("Escape");
    await win.getByRole("button", { name: /New Album/ }).click();
    await page.getByRole("textbox", { name: "Name" }).fill(name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await row(win, name).waitFor({ timeout: 8_000 });
    await row(win, /^Photos$/).click();
  }
  await tile(win, NAMES[2]).click();
  await tile(win, NAMES[3]).click({ modifiers: ["ControlOrMeta"] });
  await shots("09a-two-selected");
  const pressed = win.locator("[data-photo-id][data-selected]");
  step(
    "Command-click selects a second photo",
    (await pressed.count()) === 2,
    `${await pressed.count()}`,
  );
  const added = await dragWithMouse(page, tile(win, NAMES[2]), row(win, `First ${tag}`));
  const inFirst = await until(
    async () =>
      (await library(page)).albums?.find((a) => a.name === `First ${tag}`)?.photos.length === 2,
  );
  step(
    "two selected photos dragged onto an album join it",
    added === "accept" && inFirst === true,
    `${added}`,
  );
  await shots("09b-after-drop");
  await row(win, `First ${tag}`).click();
  await tile(win, NAMES[2]).waitFor({ timeout: 8_000 });
  await page.keyboard.press("ControlOrMeta+a");
  await shots("09-album-selection");
  await dragWithMouse(page, tile(win, NAMES[2]), row(win, `Second ${tag}`));
  const moved = await until(async () => {
    const albums = (await library(page)).albums ?? [];
    return (
      albums.find((a) => a.name === `First ${tag}`)?.photos.length === 0 &&
      albums.find((a) => a.name === `Second ${tag}`)?.photos.length === 2
    );
  });
  step("dragging between albums moves both photos", moved === true);

  // The album row dragged into the folder.
  const albumRow = await centre(row(win, `Second ${tag}`));
  const folderRow = await centre(row(win, `Trips ${tag}`));
  await page.mouse.move(albumRow.x, albumRow.y);
  await page.mouse.down();
  await page.mouse.move(folderRow.x, folderRow.y, { steps: 8 });
  await page.mouse.up();
  const filed = await until(async () => {
    const all = await library(page);
    return all.albums?.find((a) => a.name === `Second ${tag}`)?.folder === all.folders?.[0]?.id;
  });
  step("an album dragged onto a folder goes inside it", filed === true);
  await shots("10-folders");

  // Hidden and favourite.
  await row(win, /^Photos$/).click();
  await tile(win, NAMES[1]).click();
  await page.keyboard.press(".");
  await page.keyboard.press("ControlOrMeta+l");
  const hidden = await until(async () => {
    const photo = named(await library(page), NAMES[1]);
    return photo?.hidden === true && photo?.favorite === true;
  });
  step("period favourites and Command-L hides a photo", hidden === true);
  await until(async () => (await tile(win, NAMES[1]).count()) === 0);
  await choose(page, "View", "Show Hidden Photo Album");
  await row(win, "Hidden").click();
  await tile(win, NAMES[1]).waitFor({ timeout: 8_000 });
  await shots("11-hidden");
  step("Hidden lists the hidden photo", true);
  await tile(win, NAMES[1]).click();
  await page.keyboard.press("ControlOrMeta+l");
  await until(async () => {
    const photo = named(await library(page), NAMES[1]);
    return photo !== undefined && photo.hidden !== true;
  });

  // Viewer with its keys, then the full-screen viewer and a slideshow.
  await row(win, /^Photos$/).click();
  await tile(win, NAMES[2]).click();
  await page.keyboard.press("Space");
  const viewer = win.locator(".mac-photos-viewer");
  await viewer.waitFor({ timeout: 8_000 });
  await page.keyboard.press("ArrowLeft");
  const stepped = await until(async () =>
    (await viewer.getAttribute("aria-label"))?.includes(", 2 of 4"),
  );
  step("ArrowLeft steps to the photo before", stepped === true);
  await page.keyboard.press("ArrowRight");
  const steppedBack = await until(async () =>
    (await viewer.getAttribute("aria-label"))?.includes(", 3 of 4"),
  );
  step("ArrowRight steps back", steppedBack === true);
  await page.keyboard.press("ArrowLeft");
  await until(async () => (await viewer.getAttribute("aria-label"))?.includes(", 2 of 4"));
  await page.keyboard.press("Alt+s");
  await win.locator(".mac-photos-strip").waitFor({ timeout: 5_000 });
  const picture = viewer.locator(".mac-photos-picture").first();
  const transform = () => picture.evaluate((element) => element.style.transform);
  step("the open photo is shown fitted", (await transform()) === "");
  await page.keyboard.press("z");
  const zoomed = await until(async () => (await transform()) !== "");
  await shots("12-viewer");
  step("Z shows the photo at actual size", zoomed === true);
  await page.keyboard.press("z");
  const fitted = await until(async () => (await transform()) === "");
  step("Z again fits it", fitted === true);
  await page.keyboard.press("f");
  const stage = page.locator(".mac-photos-stage");
  await stage.waitFor({ timeout: 5_000 });
  await stage.locator("img").waitFor({ timeout: 15_000 });
  const stagePlace = stage.locator(".mac-photos-stage-place");
  const atStart = await stagePlace.textContent();
  await page.keyboard.press("ArrowRight");
  const movedOn = await until(async () => (await stagePlace.textContent()) !== atStart);
  await page.waitForTimeout(300);
  await shots("13-full-screen");
  await page.keyboard.press("Escape");
  await stage.waitFor({ state: "hidden", timeout: 5_000 });
  step("the full-screen viewer steps with the arrows and leaves with Escape", movedOn === true);
  step(
    "the keyboard goes back to the open photo",
    await viewer.evaluate((element) => element === document.activeElement),
  );
  // Command-Up itself: Control-Up, which ControlOrMeta presses off a Mac, is Mission Control.
  await page.keyboard.press("Meta+ArrowUp");
  await viewer.waitFor({ state: "hidden", timeout: 5_000 });

  await choose(page, "View", "Play Slideshow");
  await stage.waitFor({ timeout: 5_000 });
  const place = stage.locator(".mac-photos-stage-place");
  const first = await place.textContent();
  const advanced = await until(async () => (await place.textContent()) !== first, 15_000);
  await page.mouse.move(600, 500);
  await shots("14-slideshow");
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  step("a slideshow moves on by itself and stops with Escape", advanced === true);

  // Edit: adjust and filter, crop, Done; then revert.
  await tile(win, NAMES[2]).click();
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await win.getByRole("slider", { name: "Exposure" }).first().waitFor({ timeout: 15_000 });
  await shots("15-edit-adjust");
  await win.getByRole("slider", { name: "Exposure" }).first().focus();
  await page.keyboard.press("ArrowRight");
  await page
    .locator("body")
    .click({ position: { x: 5, y: 5 } })
    .catch(() => {});
  await win.locator(".mac-photos-edit-stage").click();
  await page.keyboard.press("f");
  await win.getByRole("radio", { name: "Mono" }).click();
  await shots("16-edit-filter");
  await page.keyboard.press("c");
  await win.getByRole("button", { name: "Flip", exact: true }).click();
  await shots("17-edit-crop");
  await win.getByRole("button", { name: "Done", exact: true }).click();
  const edited = await until(async () => {
    const edit = named(await library(page), NAMES[2])?.edit;
    return edit?.filter === "mono" && edit?.flip === true && edit?.adjust?.exposure > 0;
  });
  step("an edit with an adjustment, a filter and a flip is kept", edited === true);
  await choose(page, "Image", "Revert to Original");
  const reverted = await until(async () => named(await library(page), NAMES[2])?.edit === null);
  step("Revert to Original forgets the edit", reverted === true);

  // The context menu, Share, Export. Escape closes the viewer only once the menu that chose Revert has
  // finished closing: pressed sooner, as a fast server's answer let this journey do, the menu takes it.
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await win.locator(".mac-photos-viewer").waitFor({ state: "hidden", timeout: 5_000 });
  await tile(win, NAMES[0]).click({ button: "right" });
  await shots("18-context-menu");
  await page.keyboard.press("Escape");
  await choose(page, "File", "Export…");
  await page.getByRole("button", { name: "Export", exact: true }).waitFor({ timeout: 5_000 });
  await shots("19-export-sheet");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  // Delete, Recently Deleted, recover.
  await tile(win, NAMES[3]).click();
  await page.keyboard.press("ControlOrMeta+Delete");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await until(async () => named(await library(page), NAMES[3])?.deleted_ms);
  await row(win, "Recently Deleted").click();
  await tile(win, NAMES[3]).click();
  await shots("20-recently-deleted");
  await win.getByRole("button", { name: "Recover", exact: true }).click();
  const back = await until(async () => named(await library(page), NAMES[3])?.deleted_ms === null);
  step("Recently Deleted recovers a photo", back === true);

  // Everything is still there after a reload, and the window comes back as it was left.
  await row(win, new RegExp(`^First ${tag}`)).click();
  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  const again = await library(page);
  step(
    "after a reload the library keeps the metadata, albums, folder and smart album",
    named(again, NAMES[0])?.title === `Sunset ${tag}` &&
      again.albums?.length === 2 &&
      again.folders?.length === 1 &&
      again.smart_albums?.length === 1 &&
      again.settings?.source?.startsWith("album:"),
    JSON.stringify(again.settings),
  );
  await shot(page, path.join(out, "photos-21-after-reload.png"));
  // Only what this journey made, all named with its tag: the account may hold other photos.
  const left = await library(page);
  const ours = (each) => each.name.includes(tag);
  for (const each of (left.photos ?? []).filter(ours)) {
    await api(page, "DELETE", `/api/photos/photos/${each.id}`);
  }
  for (const each of (left.albums ?? []).filter(ours)) {
    await api(page, "DELETE", `/api/photos/albums/${each.id}`);
  }
  for (const each of (left.smart_albums ?? []).filter(ours)) {
    await api(page, "DELETE", `/api/photos/smart-albums/${each.id}`);
  }
  for (const each of (left.folders ?? []).filter(ours)) {
    await api(page, "DELETE", `/api/photos/folders/${each.id}`);
  }
  await api(page, "PUT", "/api/photos/keywords", {
    keywords: (left.keywords ?? []).filter((each) => !ours(each)),
  });
  console.log(`screenshots in ${out}`);
});
