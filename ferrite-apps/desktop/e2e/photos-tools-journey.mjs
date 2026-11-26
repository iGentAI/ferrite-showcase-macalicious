#!/usr/bin/env node
// Photos' Retouch, Red-eye, Levels and Curves on the desktop served by `ferrite dev`: a click with
// Retouch removes a dark blemish, a click with Red-eye takes out a red circle, Levels and a curve
// change the picture, all kept in the edit across a reload, and Revert to Original takes them off.
// Exits 0 only with every step passed and no console or HTTP error. The picture is drawn in the
// page. It deletes only what it made.
//
//   node e2e/photos-tools-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-tools");
const tag = Date.now().toString(36);
const NAME = `Tools ${tag}`;
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const record = async (page) => (await library(page)).photos?.find((photo) => photo.name === NAME);

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** The canvas's colour at a fraction of it. */
const colour = (canvas, x, y) =>
  canvas.evaluate(
    (element, at) => {
      const context = element.getContext("2d");
      return [
        ...context.getImageData(
          Math.floor(at.x * element.width),
          Math.floor(at.y * element.height),
          1,
          1,
        ).data,
      ].slice(0, 3);
    },
    { x, y },
  );

await run(async (page) => {
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));

  // Grey, with a dark blemish at a quarter across and a red circle at three quarters.
  const transfer = await page.evaluateHandle(async (name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    context.fillStyle = "#a0a0a0";
    context.fillRect(0, 0, 800, 600);
    context.fillStyle = "#101010";
    context.beginPath();
    context.arc(200, 300, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e01010";
    context.beginPath();
    context.arc(600, 300, 8, 0, Math.PI * 2);
    context.fill();
    const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
    const data = new DataTransfer();
    data.items.add(new File([blob], `${name}.png`, { type: "image/png" }));
    return data;
  }, NAME);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const tile = win
    .getByRole("button", { name: NAME, exact: true })
    .or(win.getByRole("option", { name: NAME, exact: true }))
    .first();
  await tile.waitFor({ timeout: 20_000 });
  await tile.dblclick();
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  const canvas = win.locator(".mac-photos-edit-canvas");
  await canvas.waitFor({ timeout: 15_000 });
  await until(() => canvas.evaluate((element) => element.width > 1));
  await page.waitForTimeout(400);

  const clickOn = async (x, y) => {
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    await page.waitForTimeout(300);
  };
  const panel = win.locator(".mac-photos-edit-panel");
  await panel
    .getByRole("region", { name: "Retouch" })
    .getByRole("button", { name: "Retouch", exact: true })
    .click();
  step("the blemish is there before Retouch", (await colour(canvas, 0.25, 0.5))[0] < 60);
  await clickOn(0.25, 0.5);
  const healed = await colour(canvas, 0.25, 0.5);
  step(
    "a click with Retouch fills the blemish from around it",
    Math.abs(healed[0] - 160) < 12,
    healed.join(),
  );

  const redEye = panel.getByRole("region", { name: "Red-eye" });
  await redEye.getByRole("button", { name: "Red-eye", exact: true }).click();
  await clickOn(0.75, 0.5);
  const fixed = await colour(canvas, 0.75, 0.5);
  step("a click with Red-eye takes the red out", fixed[0] < 60, fixed.join());
  await redEye.getByRole("button", { name: "Stop Red-eye" }).click();

  const midBefore = await colour(canvas, 0.5, 0.2);
  const levels = panel.getByRole("region", { name: "Levels" });
  const white = levels.getByRole("slider", { name: "Levels White" });
  await white.focus();
  for (let i = 0; i < 20; i += 1) await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(400);
  const brightened = await colour(canvas, 0.5, 0.2);
  step(
    "Levels' White brightens the picture",
    brightened[0] > midBefore[0] + 20,
    `${midBefore[0]} to ${brightened[0]}`,
  );

  const graph = panel.locator(".mac-photos-curve");
  await graph.scrollIntoViewIfNeeded();

  // From the keyboard alone: add a point on the line, move it, remove it.
  const dots = graph.locator(".mac-photos-curve-point");
  await graph.getByRole("button", { name: "Add a curve point" }).focus();
  await page.keyboard.press("Enter");
  await dots.first().waitFor({ timeout: 3_000 });
  await page.keyboard.press("Tab");
  for (let i = 0; i < 20; i += 1) await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400);
  const moved = await colour(canvas, 0.5, 0.2);
  step(
    "from the keyboard a point is added and moved",
    (await dots.count()) === 1 && moved[0] < brightened[0] - 10,
    `${brightened[0]} to ${moved[0]}`,
  );
  await page.keyboard.press("Delete");
  await page.waitForTimeout(400);
  const removed = await colour(canvas, 0.5, 0.2);
  step(
    "from the keyboard a point is removed",
    (await dots.count()) === 0 && Math.abs(removed[0] - brightened[0]) < 3,
    `${removed[0]}`,
  );

  const box = await graph.boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8);
  await page.waitForTimeout(400);
  const curved = await colour(canvas, 0.5, 0.2);
  step(
    "a point on the curve changes the picture",
    curved[0] < brightened[0] - 20,
    `${brightened[0]} to ${curved[0]}`,
  );
  await shot(page, path.join(out, "photos-tools.png"));

  await win.getByRole("button", { name: "Done", exact: true }).click();
  const kept = await until(async () => {
    const photo = await record(page);
    return photo?.edit?.spots?.length === 2 ? photo : null;
  });
  step(
    "the spots, Levels and the curve are kept in the edit",
    kept?.edit?.spots?.length === 2 &&
      kept?.edit?.levels?.white < 1 &&
      kept?.edit?.curve?.length === 1,
    JSON.stringify({ levels: kept?.edit?.levels, curve: kept?.edit?.curve }),
  );

  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await canvas.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);
  const again = await colour(canvas, 0.25, 0.5);
  step("opening the editor again shows them", again[0] > 60, again.join());
  await win.getByRole("button", { name: "Revert to Original" }).click();
  const reverted = await until(
    async () => (await record(page))?.edit === undefined || (await record(page))?.edit === null,
  );
  step("Revert to Original takes them off", reverted === true);

  const photo = await record(page);
  if (photo) await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
});
