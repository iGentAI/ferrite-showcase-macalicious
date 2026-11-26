#!/usr/bin/env node
// Photos' Memories tools on the desktop served by `ferrite dev`: an album's Show as Memory makes a memory of it; a
// tile's menu puts it in Favorite Memories, which is kept across a reload; Delete Memory removes the memory and
// leaves its photos and album. Each result is read from the window and the marks the server holds. Exits 0 only
// with every step passed and no console or HTTP error.
//
//   node e2e/photos-memory-tools-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-memory-tools");
const tag = `Memo ${Date.now().toString(36)}`;
const NAMES = ["One", "Two", "Three"].map((word) => `${word} ${tag}`);
const ALBUM = tag.replaceAll(" ", "-").toLowerCase();
const MEMORY = `album-${ALBUM}`;

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

await run(async (page) => {
  const library = async () => (await api(page, "GET", "/api/photos/library")).json;
  const photosWindow = async () => {
    const shown = page.locator(".mac-window:has(.mac-photos-body)").first();
    await shown.waitFor({ timeout: 30_000 });
    await until(async () => !(await shown.getAttribute("aria-busy")));
    return shown;
  };
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  let win = await photosWindow();
  const before = (await library()).memories;
  let generated = null;

  try {
    const transfer = await page.evaluateHandle(async (names) => {
      const list = new DataTransfer();
      for (const [at, name] of names.entries()) {
        const canvas = document.createElement("canvas");
        canvas.width = 480;
        canvas.height = 360;
        const context = canvas.getContext("2d");
        context.fillStyle = `hsl(${at * 90} 70% 50%)`;
        context.fillRect(0, 0, 480, 360);
        const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
        list.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
      }
      return list;
    }, NAMES);
    await win
      .locator("input[type=file]")
      .first()
      .evaluate((input, data) => {
        input.files = data.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, transfer);
    await until(
      async () => (await library()).photos.filter((p) => NAMES.includes(p.name)).length === 3,
      30_000,
    );
    const ids = (await library()).photos.filter((p) => NAMES.includes(p.name)).map((p) => p.id);
    await api(page, "POST", "/api/photos/albums", { id: ALBUM, name: tag });
    await api(page, "POST", `/api/photos/albums/${ALBUM}`, { add: ids });
    await reloadDesktop(page);
    win = await photosWindow();

    // Show as Memory from the album's heading.
    await win.getByRole("treeitem", { name: tag }).first().click();
    await win.getByRole("button", { name: "Show as Memory", exact: true }).click();
    const titled = await until(async () =>
      win.getByRole("button", { name: "Add to Favorite Memories", exact: true }).isVisible(),
    );
    const heading = await win.locator(".mac-photos-title").innerText();
    step("Show as Memory opens a memory of the album", titled === true && heading === tag, heading);
    await shot(page, path.join(out, "photos-memory-of-album.png"));

    // The tile's menu adds it to Favorite Memories.
    await win.getByRole("button", { name: "Back", exact: true }).click();
    const tile = win.locator(`[data-memory="${MEMORY}"]`);
    await tile.waitFor({ timeout: 5_000 });
    await tile.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Favorite Memories", exact: true }).click();
    await win
      .getByRole("heading", { name: "Favorite Memories", exact: true })
      .waitFor({ timeout: 5_000 });
    const pictured = await until(async () => (await tile.locator("img").count()) > 0);
    step("the tile shows the memory's first photo", pictured === true);
    await tile.locator("img").evaluate((image) => image.decode());
    await page.waitForTimeout(200);
    await shot(page, path.join(out, "photos-favorite-memories.png"));
    const kept = await until(async () =>
      ((await library()).memories.favorites ?? []).includes(MEMORY),
    );
    step("the tile's menu keeps it in Favorite Memories", kept === true);

    // A reload keeps it.
    await reloadDesktop(page);
    win = await photosWindow();
    const after = await until(async () =>
      win.getByRole("heading", { name: "Favorite Memories", exact: true }).isVisible(),
    );
    step("Favorite Memories survives a reload", after === true);

    // The row chosen just before a reload comes back: leaving doesn't wait for the window's pause.
    await win.getByRole("treeitem", { name: "Recents", exact: true }).click();
    await reloadDesktop(page);
    win = await photosWindow();
    const recents = await until(
      async () => (await win.locator(".mac-photos-title").innerText()) === "Recents",
    );
    step("the row chosen just before a reload comes back", recents === true);
    await win.getByRole("treeitem", { name: "Memories", exact: true }).click();

    // Delete Memory asks, removes the tile, and leaves the album and its photos.
    const deletable = win.locator(`[data-memory="${MEMORY}"]`);
    await deletable.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete Memory", exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const gone = await until(async () => (await deletable.count()) === 0);
    const held = await until(async () => {
      const now = await library();
      return (
        now.memories.deleted.includes(MEMORY) &&
        !now.memories.favorites.includes(MEMORY) &&
        now.albums.find((each) => each.id === ALBUM)?.photos.length === 3
      );
    }, 30_000);
    step(
      "Delete Memory leaves the album and its photos",
      gone === true && held === true,
      JSON.stringify({ gone, held }),
    );

    // A generated memory, deleted from its own heading, stays gone after a reload.
    const others = win.locator("[data-memory]");
    await others.first().waitFor({ timeout: 10_000 });
    generated = await others.first().getAttribute("data-memory");
    await others.first().click();
    await win.getByRole("button", { name: "Delete Memory", exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const recorded = await until(async () =>
      (await library()).memories.deleted.includes(generated),
    );
    await reloadDesktop(page);
    win = await photosWindow();
    await win.getByRole("treeitem", { name: "Memories", exact: true }).click();
    const listing = await until(
      async () => (await win.locator(".mac-photos-title").innerText()) === "Memories",
    );
    await page.waitForTimeout(500);
    const stays = (await win.locator(`[data-memory="${generated}"]`).count()) === 0;
    step(
      "a deleted memory stays deleted after a reload",
      recorded === true && listing === true && stays,
      generated,
    );
  } finally {
    // Each change is one mark on the server, so only what this journey touched goes back.
    for (const id of [MEMORY, generated].filter(Boolean)) {
      await api(page, "POST", "/api/photos/memories", {
        id,
        favorite: before.favorites.includes(id),
        album: before.albums.includes(id),
        deleted: false,
      });
      if (before.deleted.includes(id)) {
        await api(page, "POST", "/api/photos/memories", { id, deleted: true });
      }
    }
    const left = await library();
    for (const each of (left.photos ?? []).filter((p) => NAMES.includes(p.name))) {
      await api(page, "DELETE", `/api/photos/photos/${each.id}`);
    }
    await api(page, "DELETE", `/api/photos/albums/${ALBUM}`);
  }
  console.log(`screenshots in ${out}`);
});
