#!/usr/bin/env node
// Photos' Levels and Curves on the desktop served by `ferrite dev`: one colour's Curve changes that colour alone
// and is kept with the edit; the histogram follows the colour chosen; a tick on Levels and on Curves takes them
// off and puts them back. Each result is read from the editor's canvas or the library. Exits 0 only with every
// step passed and no console or HTTP error.
//
//   node e2e/photos-tones-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-tones");
const NAME = `Tones ${Date.now().toString(36)}`;
const MAX_SPOTS = 32;

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
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));

  // A plain gray picture: any colour moved away from the others shows at once.
  const transfer = await page.evaluateHandle(async (name) => {
    const list = new DataTransfer();
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 360;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(128,128,128)";
    context.fillRect(0, 0, 480, 360);
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

  const middle = () =>
    win
      .locator(".mac-photos-edit-canvas")
      .evaluate((canvas) =>
        [
          ...canvas.getContext("2d").getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data,
        ].slice(0, 3),
      );
  const before = await middle();
  const pick = async (label, option) => {
    await win.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };

  // Red's Levels: a lower White lifts red alone.
  await pick("Levels channel", "Red");
  const histogram = win.getByRole("img", { name: "Histogram of Red" });
  await histogram.waitFor({ timeout: 5_000 });
  const peak = await histogram.locator("polygon").getAttribute("points");
  step(
    "the histogram shows the picture's gray",
    /\b12[0-9],0\b/.test(peak ?? ""),
    (peak ?? "").slice(0, 40),
  );
  const white = win.getByRole("slider", { name: "Levels White" });
  await white.focus();
  for (let at = 0; at < 20; at += 1) await page.keyboard.press("ArrowLeft");
  const lifted = await until(async () => {
    const now = await middle();
    return now[0] > before[0] + 15 &&
      Math.abs(now[1] - before[1]) < 4 &&
      Math.abs(now[2] - before[2]) < 4
      ? now
      : null;
  });
  step("Red's Levels change red alone", Boolean(lifted), JSON.stringify({ before, lifted }));
  await win.getByRole("slider", { name: "Exposure" }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await win.locator('section[aria-label="Levels"]').scrollIntoViewIfNeeded();
  await shot(page, path.join(out, "photos-levels-red.png"));

  // The tick takes Levels off and puts them back.
  const levelsTick = win
    .locator('section[aria-label="Levels"]')
    .getByRole("checkbox", { name: "Levels" });
  await levelsTick.click();
  const offed = await until(async () => {
    const now = await middle();
    return Math.abs(now[0] - before[0]) < 4 ? now : null;
  });
  step("the tick takes Levels off", Boolean(offed), JSON.stringify(offed));
  await levelsTick.click();
  const onAgain = await until(async () => (await middle())[0] > before[0] + 15);
  step("the tick puts them back", onAgain === true);

  // Blue's Curve: a point below the line lowers blue alone.
  await pick("Curves channel", "Blue");
  const graph = win.locator(".mac-photos-curve-area");
  await graph.scrollIntoViewIfNeeded();
  const box = await graph.boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8);
  const dropped = await until(async () => {
    const now = await middle();
    return now[2] < before[2] - 15 && now[0] > before[0] + 15 ? now : null;
  });
  step("Blue's Curve changes blue alone", Boolean(dropped), JSON.stringify(dropped));
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-curve-blue.png"));

  // Retouch's tick takes its spots off and puts them back.
  await win.getByRole("button", { name: "Retouch", exact: true }).click();
  const stage = await win.locator(".mac-photos-edit-canvas").boundingBox();
  await page.mouse.click(stage.x + stage.width * 0.3, stage.y + stage.height * 0.3);
  const reset = win.getByRole("button", { name: "Reset Retouch", exact: true });
  const one = await until(async () => /\(1\)/.test(await reset.innerText()));
  await win.getByRole("button", { name: "Stop Retouch", exact: true }).click();
  const retouchTick = win
    .locator('section[aria-label="Retouch"]')
    .getByRole("checkbox", { name: "Retouch" });
  await retouchTick.click();
  const none = await until(async () => /\(0\)/.test(await reset.innerText()));
  await retouchTick.click();
  const back = await until(async () => /\(1\)/.test(await reset.innerText()));
  step("Retouch's tick takes its spot off and puts it back", one && none && back);

  await win.getByRole("button", { name: "Done", exact: true }).click();
  const kept = await until(async () => {
    const photos = (await api(page, "GET", "/api/photos/library")).json.photos ?? [];
    const edit = photos.find((photo) => photo.name === NAME)?.edit;
    return edit?.channels?.red?.levels && edit?.channels?.blue?.curve?.length
      ? edit.channels
      : null;
  });
  step("Done keeps each colour's own", Boolean(kept), JSON.stringify(kept));

  // Reset Adjustments forgets what the ticks hold, so nothing it erased can come back.
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await win.getByRole("slider", { name: "Exposure" }).first().waitFor({ timeout: 15_000 });
  const levelsAgain = win
    .locator('section[aria-label="Levels"]')
    .getByRole("checkbox", { name: "Levels" });
  const curvesAgain = win
    .locator('section[aria-label="Curves"]')
    .getByRole("checkbox", { name: "Curves" });
  const retouchAgain = win
    .locator('section[aria-label="Retouch"]')
    .getByRole("checkbox", { name: "Retouch" });
  await levelsAgain.click();
  await curvesAgain.click();
  await retouchAgain.click();
  const resetAll = win.getByRole("button", { name: "Reset Adjustments", exact: true });
  const stillOffered = await until(() => resetAll.isEnabled());
  await resetAll.click();
  const forgotten = await until(
    async () =>
      (await levelsAgain.isDisabled()) &&
      (await curvesAgain.isDisabled()) &&
      (await retouchAgain.isDisabled()),
  );
  step(
    "Reset Adjustments stays offered and leaves no tick to put values back",
    stillOffered === true && forgotten === true,
  );

  // Parked spots that would no longer fit stay parked: the tick is dimmed.
  await win.getByRole("button", { name: "Retouch", exact: true }).click();
  const spot = await win.locator(".mac-photos-edit-canvas").boundingBox();
  await page.mouse.click(spot.x + spot.width * 0.3, spot.y + spot.height * 0.3);
  await until(async () => /\(1\)/.test(await reset.innerText()));
  await win.getByRole("button", { name: "Stop Retouch", exact: true }).click();
  await retouchAgain.click();
  await win.getByRole("button", { name: "Red-eye", exact: true }).click();
  const resetRed = win.getByRole("button", { name: "Reset Red-eye", exact: true });
  for (let at = 0; at < MAX_SPOTS; at += 1) {
    await page.mouse.click(
      spot.x + spot.width * (0.05 + (at % 7) * 0.13),
      spot.y + spot.height * (0.1 + Math.floor(at / 7) * 0.13),
    );
    await until(async () => (await resetRed.innerText()).includes(`(${at + 1})`), 3_000);
  }
  await win.getByRole("button", { name: "Stop Red-eye", exact: true }).click();
  const dimmed = await until(() => retouchAgain.isDisabled());
  const spotted = await resetRed.innerText();
  step("a parked spot with no room cannot come back", dimmed === true, spotted);
  await win.getByRole("button", { name: "Done", exact: true }).click();
  const saved = await until(async () => {
    const photos = (await api(page, "GET", "/api/photos/library")).json.photos ?? [];
    return photos.find((photo) => photo.name === NAME)?.edit?.spots?.length === MAX_SPOTS;
  });
  step("a full set of spots saves", saved === true);

  // Overlapping spots draw in order, so a tick puts its own back where they were.
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await win.getByRole("slider", { name: "Exposure" }).first().waitFor({ timeout: 15_000 });
  await win.getByRole("button", { name: "Reset Adjustments", exact: true }).click();
  await win.getByRole("button", { name: "Retouch", exact: true }).click();
  await page.mouse.click(spot.x + spot.width * 0.5, spot.y + spot.height * 0.5);
  await until(async () => /\(1\)/.test(await reset.innerText()));
  await win.getByRole("button", { name: "Red-eye", exact: true }).click();
  await page.mouse.click(spot.x + spot.width * 0.5, spot.y + spot.height * 0.5);
  await until(async () => /\(1\)/.test(await resetRed.innerText()));
  await win.getByRole("button", { name: "Stop Red-eye", exact: true }).click();
  const redAgain = win
    .locator('section[aria-label="Red-eye"]')
    .getByRole("checkbox", { name: "Red-eye" });
  // Both off, then both back in each order.
  for (const [first, second] of [
    [retouchAgain, redAgain],
    [redAgain, retouchAgain],
  ]) {
    await retouchAgain.click();
    await until(async () => /\(0\)/.test(await reset.innerText()));
    await redAgain.click();
    await until(async () => /\(0\)/.test(await resetRed.innerText()));
    await first.click();
    await second.click();
    await until(
      async () => /\(1\)/.test(await reset.innerText()) && /\(1\)/.test(await resetRed.innerText()),
    );
  }
  await win.getByRole("button", { name: "Done", exact: true }).click();
  const order = await until(async () => {
    const photos = (await api(page, "GET", "/api/photos/library")).json.photos ?? [];
    const spots = photos.find((photo) => photo.name === NAME)?.edit?.spots ?? [];
    return spots.length === 2 ? spots.map((each) => each.kind).join() : null;
  });
  step("a tick keeps the spots' order", order === "retouch,red-eye", String(order));
});
