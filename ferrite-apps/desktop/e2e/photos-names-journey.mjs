#!/usr/bin/env node
// Photos' album names and search list on the desktop served by `ferrite dev`: a pause on the selected
// album's name, or the row's Rename, changes it in place, with Escape leaving it alone and a reload
// showing the new one; View > Sort orders the album and stays on it; typing in the search field lists
// what the library holds by kind, with counts the results then match. Exits 0 only with every step
// passed and no console or HTTP error.
//
//   node e2e/photos-names-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-names");
const tag = Date.now().toString(36);
const ALBUM = `Trip ${tag}`;
const BEST = `Best ${tag}`;
const SMART = `Starred ${tag}`;
const WORD = `zebra${tag}`;
const PLACED = `Placed ${tag}`;

/** A JPEG with an EXIF block saying it was taken at 48°51'N 2°21'E. */
function withPlace(jpeg) {
  const tiff = Buffer.alloc(128);
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8825, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt16LE(4, 26);
  const entry = (at, tag, type, count) => {
    const start = 28 + at * 12;
    tiff.writeUInt16LE(tag, start);
    tiff.writeUInt16LE(type, start + 2);
    tiff.writeUInt32LE(count, start + 4);
    return start + 8;
  };
  tiff.write("N\0", entry(0, 1, 2, 2), "latin1");
  tiff.writeUInt32LE(80, entry(1, 2, 5, 3));
  tiff.write("E\0", entry(2, 3, 2, 2), "latin1");
  tiff.writeUInt32LE(104, entry(3, 4, 5, 3));
  [48, 51, 0, 2, 21, 0].forEach((value, at) => {
    tiff.writeUInt32LE(value, 80 + at * 8);
    tiff.writeUInt32LE(1, 84 + at * 8);
  });
  const block = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(block.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), head, block, jpeg.subarray(2)]);
}

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
  const transfer = await page.evaluateHandle(async (tagged) => {
    const list = new DataTransfer();
    for (const name of [`Apple ${tagged}`, `Pear ${tagged}`]) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext("2d");
      context.fillStyle = name.startsWith("Apple") ? "rgb(190,70,60)" : "rgb(90,170,80)";
      context.fillRect(0, 0, 320, 240);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
      list.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    }
    return list;
  }, tag);
  await photosWindow()
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const held = await until(async () => {
    const photos = (await library()).photos ?? [];
    return photos.length >= 2 ? photos : null;
  }, 90_000);
  const apple = held.find((each) => each.name.startsWith("Apple"));
  const pear = held.find((each) => each.name.startsWith("Pear"));
  const id = `a-${tag}`;
  await api(page, "POST", "/api/photos/albums", { id, name: ALBUM });
  await api(page, "POST", `/api/photos/albums/${id}`, { add: [pear.id, apple.id] });
  await api(page, "PUT", `/api/photos/smart-albums/s-${tag}`, {
    name: SMART,
    rules: [{ field: "favorite", op: "is", value: "true" }],
  });
  await api(page, "POST", `/api/photos/photos/${apple.id}`, { keywords: [WORD] });
  await reloadDesktop(page);
  const win = photosWindow();
  await win.waitFor({ timeout: 30_000 });

  const row = win.getByRole("treeitem", { name: new RegExp(`^${ALBUM}`) });
  await row.waitFor({ timeout: 15_000 });
  await row.locator(".mac-sidebar-label").click();
  const name = win.getByRole("textbox", { name: "Name" });
  await page.waitForTimeout(800);
  step("the first press on a row only selects it", (await name.count()) === 0);

  await row.locator(".mac-sidebar-label").dblclick();
  await page.waitForTimeout(800);
  step("a double press does not begin changing the name", (await name.count()) === 0);

  await row.locator(".mac-sidebar-label").click();
  await name.waitFor({ timeout: 3_000 });
  await shot(page, path.join(out, "photos-rename-inline.png"));
  await name.fill("Nope");
  await name.press("Escape");
  await until(async () => (await name.count()) === 0, 3_000);
  step(
    "a press on the selected album's name opens a field; Escape leaves the name",
    (await library()).albums.find((each) => each.id === id)?.name === ALBUM,
  );

  await row.locator(".mac-sidebar-label").click();
  await name.waitFor({ timeout: 3_000 });
  await name.fill(BEST);
  await name.press("Enter");
  step(
    "Return keeps the new name on the server",
    await until(async () => (await library()).albums.find((each) => each.id === id)?.name === BEST),
  );

  const smart = win.getByRole("treeitem", { name: SMART });
  await smart.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await name.waitFor({ timeout: 3_000 });
  step(
    "the row's Rename opens the field with the keyboard in it",
    await name.evaluate((input) => document.activeElement === input),
  );
  await name.fill(`${SMART} two`);
  await win.locator(".mac-photos-header").first().click();
  step(
    "leaving the field keeps the new name, here on a smart album",
    await until(
      async () =>
        (await library()).smart_albums?.find((each) => each.id === `s-${tag}`)?.name ===
        `${SMART} two`,
    ),
  );

  await page.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sort", exact: true }).hover();
  const title = page.getByRole("menuitemradio", { name: "Keep Sorted By Title" });
  await title.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-sort-submenu.png"));
  await title.click();
  const stored = () =>
    until(
      async () => (await library()).albums.find((each) => each.id === id)?.sort === "title",
      5_000,
    );
  step("View > Sort > Keep Sorted By Title is kept on the server", await stored());
  const order = () =>
    win
      .getByRole("listbox", { name: BEST })
      .getByRole("option")
      .evaluateAll((options) =>
        options.map((each) => each.getAttribute("aria-label") ?? each.textContent),
      );
  step(
    "the album lists Apple before Pear, though Pear was added first",
    await until(async () => (await order())[0]?.includes("Apple"), 5_000),
  );

  await reloadDesktop(page);
  await photosWindow().waitFor({ timeout: 30_000 });
  await page.getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sort", exact: true }).hover();
  await title.waitFor({ timeout: 5_000 });
  step(
    "after a reload the album is still sorted that way and the row is checked",
    (await title.getAttribute("aria-checked")) === "true",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  const chooseSort = async (name, sort) => {
    await page.getByRole("menuitem", { name: "View", exact: true }).click();
    await page.getByRole("menuitem", { name: "Sort", exact: true }).hover();
    await page.getByRole("menuitemradio", { name, exact: true }).click();
    return until(
      async () => (await library()).albums.find((each) => each.id === id)?.sort === sort,
      5_000,
    );
  };
  await photosWindow()
    .getByRole("treeitem", { name: new RegExp(`^${BEST}`) })
    .click();
  const leadBy = async (newest) => {
    const photos = (await library()).photos;
    const taken = (photo) => photos.find((each) => each.id === photo.id)?.taken_ms;
    if (taken(apple) === taken(pear)) return null;
    return taken(apple) > taken(pear) === newest ? "Apple" : "Pear";
  };
  for (const [name, sort, newest] of [
    ["Keep Sorted By Newest First", "newest", true],
    ["Keep Sorted By Oldest First", "oldest", false],
  ]) {
    const kept = await chooseSort(name, sort);
    const lead = await leadBy(newest);
    const leads =
      lead === null || (await until(async () => (await order())[0]?.includes(lead), 5_000));
    step(
      `View > Sort > ${name} is kept, and the album leads with that photo`,
      kept && leads,
      lead ?? "both taken at one moment",
    );
  }
  step(
    "View > Sort > Order Added puts Pear back first, as it was added",
    (await chooseSort("Order Added", "custom")) &&
      (await until(async () => (await order())[0]?.includes("Pear"), 5_000)),
  );
  await chooseSort("Keep Sorted By Title", "title");
  const again = photosWindow();
  const search = again.locator(".mac-photos-search input");
  await search.click();
  await search.pressSequentially(WORD.slice(0, 7), { delay: 30 });
  const list = page.getByRole("listbox", { name: "Search Suggestions" });
  await list.waitFor({ timeout: 5_000 });
  const text = await list.innerText();
  step(
    "typing lists the keyword under its kind, with its count",
    /Keywords/.test(text) && text.includes(WORD) && /\b1\b/.test(text),
  );
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-search-suggestions.png"));
  await search.press("ArrowDown");
  step(
    "the down arrow moves through the list",
    (await list.getByRole("option", { selected: true }).count()) === 1,
  );
  await search.press("Enter");
  await list.waitFor({ state: "hidden", timeout: 3_000 });
  const shown = () => again.locator("[data-photo-id]").count();
  step(
    "choosing it searches for it and the results match the count",
    (await search.inputValue()) === WORD && (await until(async () => (await shown()) === 1, 5_000)),
  );
  await search.fill("");
  await search.press("Escape");

  const shotJpeg = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      canvas.getContext("2d").fillRect(0, 0, 320, 240);
      return canvas.toDataURL("image/jpeg").split(",")[1];
    }),
    "base64",
  );
  await again
    .locator('input[aria-label="Import pictures"]')
    .setInputFiles({ name: `${PLACED}.jpg`, mimeType: "image/jpeg", buffer: withPlace(shotJpeg) });
  const placed = await until(async () =>
    (await library()).photos?.find((each) => each.name === PLACED),
  );
  step(
    "a photo's own file gives it a place",
    Math.abs((placed?.location?.lat ?? 0) - 48.85) < 0.01,
  );
  await api(page, "POST", `/api/photos/albums/${id}`, { add: [placed.id] });
  await reloadDesktop(page);
  await photosWindow().waitFor({ timeout: 30_000 });
  await photosWindow()
    .getByRole("treeitem", { name: new RegExp(`^${BEST}`) })
    .click();
  step(
    "a photo joining the album takes its place in the order it keeps",
    await until(async () => {
      const now = await order();
      return now.length === 3 && now[2]?.includes("Placed");
    }, 8_000),
  );
  await again.getByRole("treeitem", { name: "Photos", exact: true }).first().click();
  await again.locator(`[data-photo-id="${placed.id}"]`).click();
  const image = async (row) => {
    await page.getByRole("menuitem", { name: "Image", exact: true }).click();
    await page.getByRole("menuitem", { name: "Location", exact: true }).hover();
    await page.getByRole("menuitem", { name: row, exact: true }).click();
  };
  const locationNow = async () =>
    (await library()).photos.find((each) => each.id === placed.id)?.location;
  await image("Remove Location");
  step("Remove Location takes it off", await until(async () => !(await locationNow()), 5_000));
  await image("Revert to Original Location");
  step(
    "Revert to Original Location puts back where the file says it was taken",
    await until(async () => Math.abs(((await locationNow())?.lat ?? 0) - 48.85) < 0.01, 5_000),
  );
});
