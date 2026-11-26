#!/usr/bin/env node
// Photos' Share rows hand over the edit on the desktop served by `ferrite dev`: a picture rotated in
// Photos reaches Notes and Add to Photos as a rendered copy with the turned shape, and an unedited
// photo goes as its original. Exits 0 only with every step passed and no console or HTTP error.
// Pictures are JPEGs drawn in the page. It deletes the photos it made; the rendered copy stays in
// Pictures/Shared from Photos.
//
//   node e2e/photos-share-edit-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-share-edit");
const tag = Date.now().toString(36);
const TURNED = `Turned ${tag}`;
const PLAIN = `Plain ${tag}`;
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const named = async (page, name) =>
  ((await library(page)).photos ?? []).filter((photo) => photo.name === name);

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
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));

  const transfer = await page.evaluateHandle(
    async (names) => {
      const data = new DataTransfer();
      for (const name of names) {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        const context = canvas.getContext("2d");
        context.fillStyle = "#27a";
        context.fillRect(0, 0, 320, 240);
        const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
        data.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
      }
      return data;
    },
    [TURNED, PLAIN],
  );
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
  await tile(PLAIN).waitFor({ timeout: 20_000 });

  await tile(TURNED).click();
  await page.keyboard.press("ControlOrMeta+r");
  await until(async () => (await named(page, TURNED))[0]?.edit);

  const share = async (row) => {
    await win.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("menuitem", { name: row, exact: true }).click();
  };

  await share("Add to Photos");
  const copy = await until(async () => {
    const all = await named(page, TURNED);
    return all.length === 2 ? all.find((photo) => !photo.edit) : null;
  });
  step(
    "Add to Photos takes the edit: the rotated shape",
    copy?.width === 240 && copy?.height === 320,
    `${copy?.width} x ${copy?.height}`,
  );

  await page.waitForTimeout(300);
  await tile(PLAIN).click();
  await share("Add to Photos");
  const plainCopy = await until(async () => {
    const all = await named(page, PLAIN);
    return all.length === 2 ? all : null;
  });
  step(
    "an unedited photo goes as its original",
    plainCopy?.length === 2 && plainCopy[0].bytes > 0 && plainCopy[0].bytes === plainCopy[1].bytes,
    `${plainCopy?.[0]?.bytes} and ${plainCopy?.[1]?.bytes} bytes`,
  );

  // Notes shows the edited picture too.
  const turned = (await named(page, TURNED)).find((photo) => photo.edit);
  await win.locator(`[data-photo-id="${turned.id}"]`).first().click();
  await share("Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  const picture = notes.locator(`[aria-label="Note"]:visible img[alt="${TURNED}.jpg"]`);
  await picture.waitFor({ timeout: 15_000 });
  await until(() => picture.evaluate((image) => image.complete && image.naturalWidth > 0));
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "photos-share-edit.png"));
  const shape = await picture.evaluate((image) => [image.naturalWidth, image.naturalHeight]);
  step("Notes shows the edited picture", shape[0] === 240 && shape[1] === 320, shape.join(" x "));

  for (const name of [TURNED, PLAIN]) {
    for (const photo of await named(page, name)) {
      await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
    }
  }
});
