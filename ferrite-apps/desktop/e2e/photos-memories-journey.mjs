#!/usr/bin/env node
// Photos' Memories on the desktop served by `ferrite dev`: three pictures taken together make a
// memory, Control-2 and the sidebar row show its tile, the tile lists the memory's photos, and Back
// returns. Exits 0 only with every step passed and no console or HTTP error. Pictures are JPEGs
// drawn in the page; only those it imported are removed at the end, even after a failed step.
//
//   node e2e/photos-memories-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-memories");
const tag = Date.now().toString(36);
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const NAMES = ["Pier", "Dune", "Shell"].map((word) => `${word} ${tag}`);

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
  const shots = (name) => shot(page, path.join(out, `photos-memories-${name}.png`));
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const shown = page.locator(".mac-window:has(.mac-photos-body)").first();
  await shown.waitFor({ timeout: 10_000 });
  await until(async () => !(await shown.getAttribute("aria-busy")));

  await shown.getByRole("treeitem", { name: "Memories", exact: true }).click();
  if (((await library(page)).photos ?? []).length === 0) {
    await shown.getByText("No Memories Yet").waitFor({ timeout: 5_000 });
    step("an empty library has no memories, and says so", true);
  }

  try {
    await walk(page, shown, shots);
  } finally {
    for (const photo of (await library(page)).photos ?? []) {
      if (NAMES.includes(photo.name)) await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
    }
  }
});

async function walk(page, shown, shots) {
  const transfer = await page.evaluateHandle(async (names) => {
    const data = new DataTransfer();
    for (const [at, name] of names.entries()) {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 320;
      const context = canvas.getContext("2d");
      context.fillStyle = `hsl(${180 + at * 40} 60% 50%)`;
      context.fillRect(0, 0, 480, 320);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
      data.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    }
    return data;
  }, NAMES);
  await shown
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);

  // Today's run, whatever else the library holds; a year's Best of also holds these photos.
  const memory = shown.locator(".mac-photos-memory", { hasNotText: "Best of" }).first();
  await memory.waitFor({ timeout: 20_000 });
  await until(async () => (await memory.locator("img").count()) > 0);
  step(
    "three pictures taken together make a memory",
    /\d+ Photos/.test((await memory.getAttribute("aria-label")) ?? ""),
    await memory.getAttribute("aria-label"),
  );
  await shots("tiles");

  await memory.click();
  await shown.getByRole("option", { name: NAMES[0], exact: true }).waitFor({ timeout: 5_000 });
  step(
    "a tile lists the memory's photos",
    (await shown.getByRole("option", { name: NAMES[2], exact: true }).count()) === 1,
  );
  step(
    "the memory's page offers its Slideshow",
    (await shown.getByRole("button", { name: "Slideshow" }).count()) > 0,
  );

  await shown.getByRole("button", { name: "Back", exact: true }).click();
  await memory.waitFor({ timeout: 5_000 });
  step("Back returns to the tiles", await memory.isVisible());

  await shown.getByRole("treeitem", { name: "Photos", exact: true }).click();
  await memory.waitFor({ state: "hidden", timeout: 5_000 });
  await page.keyboard.press("Control+2");
  await memory.waitFor({ timeout: 5_000 });
  step("Control-2 shows Memories", await memory.isVisible());
}
