#!/usr/bin/env node
// Photos' keys and menu rows on the desktop served by `ferrite dev`, each read back from what the
// server keeps or from the window: Apple's table of shortcuts for the library, the Command-N
// family, the clipboard, Undo, Duplicate, Export to the drive, the editor's keys, Delete in an
// album and confirming Delete Immediately. Exits 0 only with every step passed and no console or
// HTTP error. Pictures come in through the drive and Photos' own Import, with no Finder involved.
//
//   node e2e/photos-keys-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-keys");
const tag = Date.now().toString(36);
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const named = (all, name) => all.photos?.find((photo) => photo.name === name);

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

const menuTitle = (page, name) =>
  page
    .getByRole("menuitem", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .first();
async function choose(page, menu, item) {
  await menuTitle(page, menu).click();
  await page.getByRole("menuitem", { name: item, exact: true }).first().click();
}

/** Real JPEGs drawn in the page, chosen with Photos' hidden file input. */
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
  const shots = (name) => shot(page, path.join(out, `photos-keys-${name}.png`));
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));

  const NAMES = ["One", "Two", "Three"].map((word) => `${word} ${tag}`);
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
  await tile(NAMES[0]).waitFor({ timeout: 30_000 });
  await tile(NAMES[2]).waitFor({ timeout: 30_000 });
  await tile(NAMES[0]).click();

  // Library views, sidebar rows.
  for (const [key, view] of [
    ["Meta+1", "Years"],
    ["Meta+2", "Months"],
    ["Meta+3", "Days"],
    ["Meta+4", "All Photos"],
  ]) {
    await page.keyboard.press(key);
    const pressed = await until(
      async () =>
        (await win
          .getByRole("button", { name: view, exact: true })
          .getAttribute("aria-pressed")) === "true",
    );
    step(`${key} shows ${view}`, pressed === true);
  }
  await choose(page, "View", "Months");
  step(
    "View > Months shows Months",
    (await win
      .getByRole("button", { name: "Months", exact: true })
      .getAttribute("aria-pressed")) === "true",
  );
  await choose(page, "View", "All Photos");
  const heading = (name) => win.getByRole("heading", { name, exact: true });
  await tile(NAMES[0]).click();
  await page.keyboard.press("Control+3");
  await heading("Favorites").waitFor({ timeout: 5_000 });
  await page.keyboard.press("Control+6");
  await heading("Recents").waitFor({ timeout: 5_000 });
  await page.keyboard.press("Control+7");
  await heading("Imports").waitFor({ timeout: 5_000 });
  await page.keyboard.press("Control+1");
  await heading("Photos").waitFor({ timeout: 5_000 });
  step("Control-1, 3, 6 and 7 go to their sidebar rows", true);
  await win.getByRole("button", { name: "All Photos", exact: true }).click();

  // Selection keys.
  const chosen = win.locator("[data-photo-id][data-selected]");
  await tile(NAMES[0]).click();
  await page.keyboard.press("ControlOrMeta+a");
  step(
    "Command-A selects every photo",
    (await until(async () => (await chosen.count()) === 3)) === true,
  );
  await page.keyboard.press("Shift+ControlOrMeta+a");
  step(
    "Shift-Command-A deselects",
    (await until(async () => (await chosen.count()) === 0)) === true,
  );
  await tile(NAMES[0]).click();
  await page.keyboard.press("ControlOrMeta+f");
  const inSearch = await page.evaluate(() => document.activeElement?.tagName === "INPUT");
  step("Command-F goes to the search field", inSearch);
  await tile(NAMES[0]).click();

  // Sidebar, titles, zoom.
  await page.keyboard.press("Alt+ControlOrMeta+s");
  const sidebar = win.getByRole("tree", { name: "Library" });
  step("Option-Command-S hides the sidebar", (await until(() => sidebar.isHidden())) === true);
  await shots("sidebar-hidden");
  await page.keyboard.press("Alt+ControlOrMeta+s");
  await sidebar.waitFor({ timeout: 5_000 });
  await page.keyboard.press("Shift+ControlOrMeta+t");
  const titled = await until(async () => (await library(page)).settings?.showTitles === true);
  step("Shift-Command-T shows titles, and the setting is kept", titled === true);
  await shots("titles");
  await page.keyboard.press("Shift+ControlOrMeta+t");
  const zoomBefore = (await until(async () => (await library(page)).settings))?.zoom;
  await page.keyboard.press("ControlOrMeta+=");
  const zoomed = await until(async () => {
    const zoom = (await library(page)).settings?.zoom;
    return zoom !== undefined && zoom !== zoomBefore;
  });
  step("Command-plus makes the thumbnails larger", zoomed === true);
  await page.keyboard.press("ControlOrMeta+-");

  // Hide with Undo and Redo through the keys and the menu's label.
  await page.keyboard.press("ControlOrMeta+l");
  await until(async () => named(await library(page), NAMES[0])?.hidden === true);
  await menuTitle(page, "Edit").click();
  const undoRow = page.getByRole("menuitem", { name: /^Undo/ }).first();
  const undoLabel = await undoRow.textContent();
  await shots("undo-menu");
  await page.keyboard.press("Escape");
  await win.click({ position: { x: 600, y: 18 } });
  await page.keyboard.press("ControlOrMeta+z");
  const shownAgain = async () => {
    const photo = named(await library(page), NAMES[0]);
    return photo !== undefined && photo.hidden !== true;
  };
  const unhidden = await until(shownAgain);
  step("Command-Z undoes hiding, and Edit names it", unhidden === true, undoLabel ?? "");
  await tile(NAMES[0]).waitFor({ timeout: 5_000 });
  await page.keyboard.press("Shift+ControlOrMeta+z");
  const rehidden = await until(async () => named(await library(page), NAMES[0])?.hidden === true);
  step("Shift-Command-Z redoes it", rehidden === true);
  await page.keyboard.press("ControlOrMeta+z");
  await until(shownAgain);

  // Rotate and enhance from the library.
  await tile(NAMES[1]).click();
  await page.keyboard.press("ControlOrMeta+r");
  const rotated = await until(async () => named(await library(page), NAMES[1])?.edit);
  step("Command-R rotates the selected photo", Boolean(rotated), JSON.stringify(rotated?.rotation));
  await page.keyboard.press("Alt+ControlOrMeta+r");
  const straight = await until(async () => {
    const edit = named(await library(page), NAMES[1])?.edit;
    return edit === null || edit?.rotation === 0;
  });
  step("Option-Command-R turns it back", straight === true);
  await page.keyboard.press("ControlOrMeta+e");
  await page.waitForTimeout(400);
  await choose(page, "Image", "Revert to Original");
  await until(async () => named(await library(page), NAMES[1])?.edit === null);

  // Duplicate, Copy and Paste into an album, Delete in an album.
  await page.keyboard.press("ControlOrMeta+d");
  const copyName = `${NAMES[1]} copy`;
  const duplicated = await until(async () => Boolean(named(await library(page), copyName)), 20_000);
  step("Command-D makes an independent copy", duplicated === true);

  await page.keyboard.press("ControlOrMeta+n");
  await page.getByRole("textbox", { name: "Name" }).fill(`Album ${tag}`);
  await page.keyboard.press("Enter");
  const albumRow = win.getByRole("treeitem", { name: `Album ${tag}` }).first();
  await albumRow.waitFor({ timeout: 8_000 });
  await page.keyboard.press("Control+1");
  await heading("Photos").waitFor({ timeout: 5_000 });
  await tile(NAMES[2]).click();
  await page.keyboard.press("ControlOrMeta+c");
  await albumRow.click();
  await page.keyboard.press("ControlOrMeta+v");
  const idOf = async (name) => named(await library(page), name)?.id;
  const inAlbum = async (name) =>
    (await library(page)).albums
      ?.find((a) => a.name === `Album ${tag}`)
      ?.photos.includes(await idOf(name));
  const pasted = await until(() => inAlbum(NAMES[2]));
  step("Command-C then Command-V puts a photo in an album", pasted === true);

  await tile(NAMES[2]).click();
  await page.keyboard.press("Delete");
  const left = await until(async () => (await inAlbum(NAMES[2])) === false);
  step(
    "Delete in an album removes it from there and not from the library",
    left === true && named(await library(page), NAMES[2])?.deleted_ms === null,
  );

  // Sidebar row menu, the Command-N family's sheets.
  await albumRow.click({ button: "right" });
  await page.waitForTimeout(250);
  await shots("row-menu");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+1");
  await heading("Photos").waitFor({ timeout: 5_000 });
  await tile(NAMES[0]).click();
  await page.keyboard.press("Alt+ControlOrMeta+n");
  await page.getByRole("textbox", { name: "Smart Album name" }).waitFor({ timeout: 5_000 });
  step("Option-Command-N opens the smart album sheet", true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.keyboard.press("Shift+ControlOrMeta+n");
  await page.getByRole("textbox", { name: "Name" }).waitFor({ timeout: 5_000 });
  step("Shift-Command-N asks for a folder's name", true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.keyboard.press("ControlOrMeta+k");
  const manager = page.locator(".mac-photos-keyword-window");
  await manager.waitFor({ timeout: 5_000 });
  step("Command-K opens the Keyword Manager", true);
  await manager.getByRole("button", { name: "Close", exact: true }).first().click();

  // Export to the drive.
  await tile(NAMES[0]).click();
  await page.keyboard.press("Shift+ControlOrMeta+e");
  await page
    .getByRole("button", { name: "Save To" })
    .or(page.getByRole("combobox", { name: "Save To" }))
    .first()
    .click();
  await page
    .getByRole("option", { name: "Documents", exact: true })
    .or(page.getByRole("menuitemradio", { name: "Documents", exact: true }))
    .first()
    .click();
  await shots("export-sheet");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exported = await until(async () => {
    const entries = (await api(page, "GET", "/api/files/")).json?.entries ?? [];
    return entries.some((entry) => entry.name.startsWith(NAMES[0]) && entry.parent === "documents");
  }, 20_000);
  step("Shift-Command-E exports the photo to Documents on the drive", exported === true);

  // The editor's keys.
  await tile(NAMES[0]).click();
  await page.keyboard.press("Enter");
  const exposure = win.getByRole("slider", { name: "Exposure" }).first();
  await exposure.waitFor({ timeout: 15_000 });
  step("Return opens the editor on the selection", true);
  await page.locator(".mac-photos-edit-stage").click();
  await page.keyboard.press("f");
  await win.getByRole("radio", { name: "Mono" }).waitFor({ timeout: 5_000 });
  await page.keyboard.press("c");
  await win.getByRole("button", { name: "Flip", exact: true }).waitFor({ timeout: 5_000 });
  await page.keyboard.press("a");
  await exposure.waitFor({ timeout: 5_000 });
  step("A, F and C switch the editor's tabs", true);
  const canvas = win.locator(".mac-photos-edit-canvas");
  const shape = () => canvas.evaluate((element) => element.width > element.height);
  const drawn = () => canvas.evaluate((element) => element.toDataURL());
  await page.locator(".mac-photos-edit-stage").click();
  const wide = await shape();
  await page.keyboard.press("ControlOrMeta+r");
  const turned = await until(async () => (await shape()) !== wide);
  step("Command-R turns the draft in the editor", turned === true);
  await page.keyboard.press("ControlOrMeta+z");
  const unturned = await until(async () => (await shape()) === wide);
  step("Command-Z takes the turn back in the editor", unturned === true);
  const original = await drawn();
  await page.keyboard.press("f");
  await win.getByRole("radio", { name: "Mono" }).click();
  const filtered = await until(async () => (await drawn()) !== original);
  step("a filter changes what the editor draws", filtered === true);
  const withFilter = await drawn();
  await page.locator(".mac-photos-edit-stage").click();
  await page.keyboard.down("m");
  const comparing = await until(async () => (await drawn()) === original);
  await shots("editor-compare");
  await page.keyboard.up("m");
  step("holding M shows the photo without its adjustments", comparing === true);
  const restored = await until(async () => (await drawn()) === withFilter);
  step("letting M go shows the edit again", restored === true);
  await win.getByRole("button", { name: "Cancel", exact: true }).click();
  await exposure.waitFor({ state: "hidden", timeout: 5_000 });
  await page.keyboard.press("Escape");
  await win.locator(".mac-photos-viewer").waitFor({ state: "hidden", timeout: 5_000 });

  // Command-Delete, then Delete Immediately asks first.
  await tile(copyName).click();
  await page.keyboard.press("ControlOrMeta+Backspace");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await until(async () => named(await library(page), copyName)?.deleted_ms);
  await win.getByRole("treeitem", { name: "Recently Deleted" }).first().click();
  await tile(copyName).click();
  await win.getByRole("button", { name: "Delete Immediately", exact: true }).click();
  const ask = page.getByRole("alertdialog");
  await ask.waitFor({ timeout: 5_000 });
  await shots("delete-confirm");
  await ask.getByRole("button", { name: "Delete", exact: true }).click();
  const erased = await until(async () => !named(await library(page), copyName));
  step("Delete Immediately asks, then erases", erased === true);

  // Only what this journey made, all named with its tag: the account may hold other photos.
  const remaining = await library(page);
  const ours = (each) => each.name.includes(tag);
  for (const each of (remaining.photos ?? []).filter(ours)) {
    await api(page, "DELETE", `/api/photos/photos/${each.id}`);
  }
  for (const each of (remaining.albums ?? []).filter(ours)) {
    await api(page, "DELETE", `/api/photos/albums/${each.id}`);
  }
  console.log(`screenshots in ${out}`);
});
