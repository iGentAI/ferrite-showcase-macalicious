#!/usr/bin/env node
// Photos' Selective Color on the desktop served by `ferrite dev`: taking the saturation out of Red grays a red part of
// the picture and leaves a blue part alone, read from the editor's canvas; the tick takes it off and puts it back; Done
// keeps it on the server, and Reset Adjustments clears it. Exits 0 only with every step passed and no console or HTTP
// error.
//
//   node e2e/photos-selective-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-selective");
const NAME = `Bands ${Date.now().toString(36)}`;

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 30_000 });
  const transfer = await page.evaluateHandle(async (name) => {
    const list = new DataTransfer();
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 360;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(210,40,40)";
    context.fillRect(0, 0, 240, 360);
    context.fillStyle = "rgb(40,60,210)";
    context.fillRect(240, 0, 240, 360);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.95));
    list.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    return list;
  }, NAME);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const tile = win
    .getByRole("option", { name: NAME, exact: true })
    .or(win.getByRole("button", { name: NAME, exact: true }))
    .first();
  await tile.waitFor({ timeout: 30_000 });
  await tile.dblclick();
  await win.locator(".mac-photos-viewer").waitFor({ timeout: 8_000 });
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await win.getByRole("slider", { name: "Exposure" }).first().waitFor({ timeout: 15_000 });

  const at = (fraction) =>
    win
      .locator(".mac-photos-edit-canvas")
      .evaluate(
        (canvas, where) =>
          [
            ...canvas
              .getContext("2d")
              .getImageData(Math.round(canvas.width * where), canvas.height >> 1, 1, 1).data,
          ].slice(0, 3),
        fraction,
      );
  const spread = (pixel) => Math.max(...pixel) - Math.min(...pixel);
  const before = { red: await at(0.25), blue: await at(0.75) };
  step(
    "the picture starts red and blue",
    spread(before.red) > 100 && spread(before.blue) > 100,
    JSON.stringify(before),
  );

  const section = win.locator('section[aria-label="Selective Color"]');
  await section.scrollIntoViewIfNeeded();
  await section.getByRole("radio", { name: "Red", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  const moved = await section.getByRole("radio", { name: "Yellow", exact: true }).isChecked();
  await page.keyboard.press("Tab");
  const leftGroup = await section
    .getByRole("button", { name: "Selective Color eyedropper", exact: true })
    .evaluate((button) => button === document.activeElement);
  step("the swatches are one tab stop, followed by the eyedropper", moved && leftGroup);
  await page.keyboard.press("Tab");
  const reachedHue = await section
    .getByRole("slider", { name: "Selective Color Hue" })
    .evaluate((slider) => slider === document.activeElement);
  step("Tab from the eyedropper reaches Hue", reachedHue);
  await section.getByRole("radio", { name: "Red", exact: true }).click();
  const saturation = section.getByRole("slider", { name: "Selective Color Saturation" });
  await saturation.focus();
  await page.keyboard.press("Home");
  const grayed = await until(async () => spread(await at(0.25)) < 12);
  const left = await at(0.25);
  const right = await at(0.75);
  step(
    "Red's saturation grays the red part alone",
    grayed === true && Math.abs(right[2] - before.blue[2]) < 6,
    JSON.stringify({ left, right }),
  );
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-selective.png"));

  const tick = section.getByRole("checkbox", { name: "Selective Color" });
  await tick.click();
  const off = await until(async () => spread(await at(0.25)) > 100);
  await tick.click();
  const on = await until(async () => spread(await at(0.25)) < 12);
  step("the tick takes it off and puts it back", off === true && on === true);

  await win.getByRole("button", { name: "Done", exact: true }).click();
  const kept = await until(async () => {
    const photos = (await api(page, "GET", "/api/photos/library")).json.photos ?? [];
    return photos.find((each) => each.name === NAME)?.edit?.selective?.red;
  });
  step("Done keeps it on the server", kept?.saturation === -1, JSON.stringify(kept));

  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await win.getByRole("slider", { name: "Exposure" }).first().waitFor({ timeout: 15_000 });
  const again = await until(async () => spread(await at(0.25)) < 12);
  step("it comes back when the photo is edited again", again === true);
  await win.getByRole("button", { name: "Reset Adjustments", exact: true }).click();
  const cleared = await until(async () => spread(await at(0.25)) > 100);
  step("Reset Adjustments clears it", cleared === true);
  await win.getByRole("button", { name: "Cancel", exact: true }).first().click();

  const left2 = (await api(page, "GET", "/api/photos/library")).json;
  for (const each of (left2.photos ?? []).filter((photo) => photo.name === NAME)) {
    await api(page, "DELETE", `/api/photos/photos/${each.id}`);
  }
});
