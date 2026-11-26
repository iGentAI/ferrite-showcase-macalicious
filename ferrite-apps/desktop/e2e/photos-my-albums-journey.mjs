#!/usr/bin/env node
// Photos' My Albums pane on the desktop served by `ferrite dev`: its heading in the sidebar shows a tile per album and
// smart album, with the key photo's picture, and a tile opens that album; the pane survives a reload. Exits 0 only with
// every step passed and no console or HTTP error.
//
//   node e2e/photos-my-albums-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-my-albums");
const tag = Date.now().toString(36);
const NAME = `Tile ${tag}`;
const ALBUM = `Holiday ${tag}`;
const EMPTY = `Empty ${tag}`;
const SMART = `Starred ${tag}`;

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  const library = async () => (await api(page, "GET", "/api/photos/library")).json;
  const photosWindow = () => page.locator(".mac-window:has(.mac-photos-body)").first();
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  await photosWindow().waitFor({ timeout: 30_000 });
  const transfer = await page.evaluateHandle(async (name) => {
    const list = new DataTransfer();
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 360;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(90,130,190)";
    context.fillRect(0, 0, 480, 360);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
    list.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    return list;
  }, NAME);
  await photosWindow()
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const id = await until(
    async () => (await library()).photos?.find((each) => each.name === NAME)?.id,
    30_000,
  );
  await api(page, "POST", "/api/photos/albums", { id: `a-${tag}`, name: ALBUM });
  await api(page, "POST", `/api/photos/albums/a-${tag}`, { add: [id], key_photo: id });
  await api(page, "POST", "/api/photos/albums", { id: `e-${tag}`, name: EMPTY });
  await api(page, "PUT", `/api/photos/smart-albums/s-${tag}`, {
    name: SMART,
    rules: [{ field: "favorite", op: "is", value: "true" }],
  });
  await reloadDesktop(page);
  const win = photosWindow();
  await win.waitFor({ timeout: 30_000 });

  await win.getByRole("button", { name: "My Albums", exact: true }).click();
  const tile = (name) => win.locator(".mac-photos-memory", { hasText: name }).first();
  await tile(ALBUM).waitFor({ timeout: 15_000 });
  const counted = /1 Photo/.test((await tile(ALBUM).getAttribute("aria-label")) ?? "");
  const pictured = await until(async () => (await tile(ALBUM).locator("img").count()) > 0);
  step("My Albums shows a tile for an album with its picture", counted && pictured === true);
  step(
    "it lists the empty album and the smart album too",
    (await tile(EMPTY).isVisible()) && (await tile(SMART).isVisible()),
  );
  const title = await win.locator(".mac-photos-title").innerText();
  step("the pane is headed My Albums", title === "My Albums", title);
  await tile(ALBUM)
    .locator("img")
    .evaluate((image) => image.decode());
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-my-albums.png"));

  await reloadDesktop(page);
  await photosWindow().waitFor({ timeout: 30_000 });
  await tile(ALBUM).waitFor({ timeout: 20_000 });
  step("the pane comes back after a reload", await tile(ALBUM).isVisible());

  await tile(ALBUM).click();
  const opened = await until(
    async () => (await win.locator(".mac-photos-title").innerText()) === ALBUM,
  );
  step("a tile opens its album", opened === true);

  for (const each of (await library()).photos ?? []) {
    if (each.name === NAME) await api(page, "DELETE", `/api/photos/photos/${each.id}`);
  }
  await api(page, "DELETE", `/api/photos/albums/a-${tag}`);
  await api(page, "DELETE", `/api/photos/albums/e-${tag}`);
  await api(page, "DELETE", `/api/photos/smart-albums/s-${tag}`);
});
