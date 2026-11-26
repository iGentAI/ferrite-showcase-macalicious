#!/usr/bin/env node
// Photos: a search from an album looks through the whole library and emptying it goes back; a crop's
// edge handle moves one side; White Balance's Neutral Gray takes out a colour cast; an adjustment
// section's tick takes its values off and puts them back. Each read back from what the server keeps
// or from the window. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photos-search-tools-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-search-tools");
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

/** JPEGs of one warm colour drawn in the page, for Photos' hidden file input. */
const pictures = (page, names) =>
  page.evaluateHandle(async (names) => {
    const transfer = new DataTransfer();
    for (const name of names) {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 360;
      const context = canvas.getContext("2d");
      context.fillStyle = "rgb(150, 128, 110)";
      context.fillRect(0, 0, 480, 360);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.95));
      transfer.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    }
    return transfer;
  }, names);

await run(async (page) => {
  const shots = (name) => shot(page, path.join(out, `photos-search-tools-${name}.png`));
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));

  const INSIDE = `Inside ${tag}`;
  const OUTSIDE = `Outside ${tag}`;
  const transfer = await pictures(page, [INSIDE, OUTSIDE]);
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
  await tile(OUTSIDE).waitFor({ timeout: 30_000 });

  // An album holding one of them, and a search from inside it that finds the other.
  await tile(INSIDE).click();
  await page.keyboard.press("Meta+n");
  const ALBUM = `Trip ${tag}`;
  await page.getByRole("textbox", { name: "Name" }).fill(ALBUM);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await win.getByRole("treeitem", { name: ALBUM }).click();
  await tile(INSIDE).waitFor({ timeout: 8_000 });
  step("the album shows only its own photo", (await tile(OUTSIDE).count()) === 0);
  const search = win.getByRole("searchbox").first();
  await search.fill(`Outside ${tag}`);
  await tile(OUTSIDE).waitFor({ timeout: 8_000 });
  await shots("search-from-album");
  step("a search begun in an album finds a photo outside it", true);
  await search.fill("");
  const back = await until(
    async () => (await tile(OUTSIDE).count()) === 0 && (await tile(INSIDE).count()) === 1,
  );
  step("emptying the search goes back to the album", back === true);

  // The editor on the warm photo.
  await tile(INSIDE).dblclick();
  await win.locator(".mac-photos-viewer").waitFor({ timeout: 8_000 });
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await win.getByRole("slider", { name: "Exposure" }).first().waitFor({ timeout: 15_000 });

  // Neutral Gray brings the average to gray.
  const middle = () =>
    win.locator(".mac-photos-edit-canvas").evaluate((canvas) => {
      const [r, g, b] = canvas
        .getContext("2d")
        .getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
      return { r, g, b };
    });
  await page.waitForTimeout(300);
  const warm = await middle();
  await win
    .getByRole("region", { name: "White Balance" })
    .getByRole("button", { name: "Auto", exact: true })
    .click();
  const neutral = await until(async () => {
    const now = await middle();
    return Math.abs(now.r - now.b) < 16 ? now : null;
  });
  await shots("neutral-gray");
  step(
    "Neutral Gray takes the colour cast out",
    Boolean(neutral) && warm.r - warm.b > 30,
    `${JSON.stringify(warm)} to ${JSON.stringify(neutral)}`,
  );

  // A section's tick takes its sliders off and puts them back.
  const light = win
    .getByRole("region", { name: "Light" })
    .or(win.locator('section[aria-label="Light"]'))
    .first();
  await light.getByRole("slider", { name: "Exposure" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const lit = await middle();
  await page.waitForTimeout(300);
  const raised = await middle();
  const tick = light.getByRole("checkbox", { name: "Light" });
  await tick.click();
  await page.waitForTimeout(400);
  const off = await middle();
  await shots("section-off");
  await tick.click();
  await page.waitForTimeout(400);
  const on = await middle();
  step(
    "a section's tick takes its adjustment off and puts it back",
    Math.abs(off.g - raised.g) > 0 && Math.abs(on.g - raised.g) <= 1,
    `${lit.g} ${raised.g} ${off.g} ${on.g}`,
  );

  // A crop's edge handle moves that side only.
  await page.keyboard.press("c");
  const crop = win.locator(".mac-photos-crop");
  await crop.waitFor({ timeout: 5_000 });
  await win.getByRole("button", { name: "Right edge of the crop" }).focus();
  await shots("crop-edges");
  await page.keyboard.press("Shift+ArrowLeft");
  const style = await until(async () => {
    const now = await crop.getAttribute("style");
    return /width: 90%/.test(now ?? "") ? now : null;
  });
  step(
    "the right edge handle moves only the crop's width",
    /left: 0%/.test(style ?? "") && /height: 100%/.test(style ?? ""),
    style ?? "",
  );
  await win.getByRole("button", { name: "Done", exact: true }).click();
  const edited = await until(async () => {
    const edit = named(await library(page), INSIDE)?.edit;
    return edit?.crop && edit.adjust.warmth < 0 ? edit : null;
  });
  const kept = edited?.crop;
  step(
    "Done keeps the crop and the balance",
    kept?.x === 0 && kept?.y === 0 && Math.abs(kept?.width - 0.9) < 0.001 && kept?.height === 1,
    JSON.stringify(kept),
  );

  // With a shape held the edges have no handle: one side alone would break the shape.
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await win.getByRole("slider", { name: "Exposure" }).first().waitFor({ timeout: 15_000 });
  await page.keyboard.press("c");
  await crop.waitFor({ timeout: 5_000 });
  const handles = win.locator(".mac-photos-crop-handle");
  const free = await handles.count();
  await win.getByRole("combobox", { name: "Aspect" }).click();
  await page.getByRole("option", { name: "Square", exact: true }).click();
  const held = await until(async () => (await handles.count()) === 4);
  step("with a shape held only the corners have handles", free === 8 && held === true, `${free}`);
  await win.getByRole("button", { name: "Cancel", exact: true }).click();

  // A search begun in Recently Deleted looks through the library too, and goes back.
  await win.getByRole("button", { name: "Back", exact: true }).click();
  await win.getByRole("treeitem", { name: "Recently Deleted" }).click();
  await search.fill(`Outside ${tag}`);
  await tile(OUTSIDE).waitFor({ timeout: 8_000 });
  await search.fill("");
  const deletedAgain = await until(
    async () =>
      (await tile(OUTSIDE).count()) === 0 &&
      (await win.getByRole("heading", { name: "Recently Deleted" }).count()) > 0,
  );
  step("a search from Recently Deleted finds a live photo and goes back", deletedAgain === true);

  const left = await library(page);
  for (const each of (left.photos ?? []).filter((photo) => photo.name.includes(tag))) {
    await api(page, "DELETE", `/api/photos/photos/${each.id}`);
  }
  for (const each of (left.albums ?? []).filter((album) => album.name.includes(tag))) {
    await api(page, "DELETE", `/api/photos/albums/${each.id}`);
  }
  console.log(`screenshots in ${out}`);
});
