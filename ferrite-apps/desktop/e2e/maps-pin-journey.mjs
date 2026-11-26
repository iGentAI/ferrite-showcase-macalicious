#!/usr/bin/env node
// Maps: a dropped pin dragged to a new place, and words dropped on the map searched for. Places are
// the module's real answers (Nominatim).
//
//   node e2e/maps-pin-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("maps-pin", { ignoreOtherOrigins: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Maps");
  const window = page.getByRole("region", { name: "Maps", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(500);

  // ---- The pin -----------------------------------------------------------------------------------
  await window.locator(".mac-maps-map-menu").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Drop Pin" }).click();
  const pin = window.locator(".mac-maps-pin[data-place^='pin-']").first();
  await pin.waitFor({ timeout: 15_000 });
  await until(async () => !(await window.getByText(/Looking up/).count()), 15_000);
  const coordinates = async () => {
    const [lat, lon] = ((await pin.getAttribute("data-place")) ?? "").slice(4).split("_");
    return { lat: Number(lat), lon: Number(lon) };
  };
  const before = await coordinates();
  const box = await pin.boundingBox();

  // ---- A press taken away before it moved ---------------------------------------------------------
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await pin.evaluate((element) => {
    element.dispatchEvent(new PointerEvent("lostpointercapture", { bubbles: true }));
  });
  await page.mouse.up();
  await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 3, { steps: 2 });
  const stayed = await pin.boundingBox();
  step(
    "a press whose capture is lost does not start a drag on a later move",
    Math.abs(stayed.x - box.x) < 2 && (await coordinates()).lon === before.lon,
    JSON.stringify(stayed),
  );

  // ---- A drag taken away -------------------------------------------------------------------------
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 5 });
  const during = await pin.boundingBox();
  await pin.evaluate((element) => {
    element.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
    element.dispatchEvent(new PointerEvent("lostpointercapture", { bubbles: true }));
  });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const back = await pin.boundingBox();
  step(
    "a drag the browser cancels leaves the pin where it stood",
    Math.abs(during.x - (box.x + 50)) < 6 &&
      Math.abs(back.x - box.x) < 2 &&
      Math.abs(back.y - box.y) < 2 &&
      (await coordinates()).lon === before.lon,
    JSON.stringify({ during, back }),
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 5, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 6 });
  await shot(page, path.join(out, "maps-pin-drag.png"));
  await page.mouse.up();
  const moved = await until(async () => {
    const now = await coordinates();
    return now.lon > before.lon && now.lat < before.lat;
  }, 15_000);
  const after = await coordinates();
  step(
    "dragging the pin moves it east and south, as the pointer went",
    moved && (await window.locator(".mac-maps-pin[data-place^='pin-']").count()) === 1,
    JSON.stringify({ before, after }),
  );
  const pinBox = await pin.boundingBox();
  step(
    "the pin stands where it was let go",
    Math.abs(pinBox.x - (box.x + 120)) < 6 && Math.abs(pinBox.y - (box.y + 60)) < 6,
    JSON.stringify({ was: box, now: pinBox }),
  );
  await shot(page, path.join(out, "maps-pin-moved.png"));

  // ---- Words dropped on the map -------------------------------------------------------------------
  const field = window.getByRole("searchbox").first();
  // A dispatched drop: a text drag out of a field does not start under Playwright's mouse here.
  await window
    .locator(".mac-maps-map-menu")
    .first()
    .evaluate((map) => {
      const data = new DataTransfer();
      data.setData("text/plain", "Golden Gate Bridge\nSan Francisco");
      for (const type of ["dragover", "drop"]) {
        map.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
        );
      }
    });
  step(
    "words dropped on the map are searched for by their first line, and Maps shows the place",
    (await until(
      async () => (await window.locator('.mac-maps-pin[aria-label*="Golden Gate" i]').count()) > 0,
      15_000,
    )) && (await field.inputValue()) === "Golden Gate Bridge",
    await field.inputValue(),
  );
});
