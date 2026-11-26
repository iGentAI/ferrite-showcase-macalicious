#!/usr/bin/env node
// Photos' People on the desktop served by `ferrite dev`: names typed in Info make the People row's
// tiles, Control-4 shows them, a tile lists that person's photos, search finds them, and they
// survive a reload. Exits 0 only with every step passed and no console or HTTP error. Pictures are
// JPEGs drawn in the page. It deletes only what it made.
//
//   node e2e/photos-people-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-people");
const tag = Date.now().toString(36);
const NAMES = ["First", "Second"].map((word) => `${word} ${tag}`);
const ANN = `Ann${tag}`;
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const ours = async (page) =>
  ((await library(page)).photos ?? []).filter((photo) => NAMES.includes(photo.name));

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

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
  const shots = (name) => shot(page, path.join(out, `photos-people-${name}.png`));
  await openDesktop(page, base, step);
  const win = await launch(page);

  const transfer = await page.evaluateHandle(async (names) => {
    const data = new DataTransfer();
    for (const [at, name] of names.entries()) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const context = canvas.getContext("2d");
      context.fillStyle = `hsl(${30 + at * 160} 60% 55%)`;
      context.fillRect(0, 0, 320, 320);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
      data.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    }
    return data;
  }, NAMES);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const tile = (name) =>
    win
      .getByRole("button", { name, exact: true })
      .or(win.getByRole("option", { name, exact: true }))
      .first();
  await tile(NAMES[1]).waitFor({ timeout: 20_000 });

  await tile(NAMES[0]).click();
  const info = page.locator(".mac-photos-info-window");
  if (!(await info.isVisible())) await page.keyboard.press("ControlOrMeta+i");
  await info.waitFor({ timeout: 5_000 });
  const names = info.getByRole("textbox", { name: "People" });
  await names.fill(ANN);
  await names.press("Enter");
  const named = await until(async () =>
    (await ours(page)).find((photo) => photo.people?.includes(ANN)),
  );
  step("Info keeps a person's name on the photo", named?.name === NAMES[0]);
  await info.getByRole("button", { name: "Close" }).first().click();

  await win.click({ position: { x: 700, y: 650 } });
  await page.keyboard.press("Control+4");
  const person = win.getByRole("button", { name: `${ANN}, 1 Photo`, exact: true });
  await person.waitFor({ timeout: 5_000 });
  await until(async () => (await person.locator("img").count()) > 0);
  await page.waitForTimeout(300);
  await shots("tiles");
  step("Control-4 shows a tile for the person", true);

  await person.click();
  await tile(NAMES[0]).waitFor({ timeout: 5_000 });
  step("a tile lists only that person's photos", (await tile(NAMES[1]).count()) === 0);
  await win.getByRole("button", { name: "Back", exact: true }).click();
  await person.waitFor({ timeout: 5_000 });

  await win.getByRole("treeitem", { name: "Photos", exact: true }).click();
  const search = win.getByRole("searchbox").first();
  await search.fill(ANN);
  await page.waitForTimeout(400);
  step(
    "search finds a photo by the person's name",
    (await tile(NAMES[0]).count()) === 1 && (await tile(NAMES[1]).count()) === 0,
  );
  await search.fill("");

  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  const shown = await page
    .locator(".mac-window:has(.mac-photos-body)")
    .first()
    .waitFor({ timeout: 8_000 })
    .then(() => page.locator(".mac-window:has(.mac-photos-body)").first())
    .catch(() => launch(page));
  await until(async () => !(await shown.getAttribute("aria-busy")));
  await shown.getByRole("treeitem", { name: "People", exact: true }).click();
  await shown
    .getByRole("button", { name: `${ANN}, 1 Photo`, exact: true })
    .waitFor({ timeout: 8_000 });
  step("the person survives a reload", true);

  for (const photo of await ours(page)) {
    await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
  }
});
