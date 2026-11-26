#!/usr/bin/env node
// Photos' export on the desktop served by `ferrite dev`: File > Export of several photos through the Save dialog makes
// a folder holding one file each, and of one photo saves under the typed name with the kind's extension; each file is
// read back from the drive and its picture decoded. Share > Notes hands an edited picture over as its rendered copy,
// whose pixels are compared with the original's. Mail isn't walked: a guest gets 403 from its attachments. Exits 0 only
// with every step passed and no console or HTTP error.
//
//   node e2e/photos-export-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-export");
const tag = Date.now().toString(36);
const NAMES = ["First", "Second"].map((word) => `${word} ${tag}`);
const FOLDER = `Exported ${tag}`;
const SINGLE = `Alone ${tag}`;

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
  const drive = async () => {
    const reply = (await api(page, "GET", "/api/files/")).json;
    return reply.entries ?? reply.files ?? [];
  };
  const named = (all, name) => all.find((each) => each.name === name);
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 30_000 });
  const transfer = await page.evaluateHandle(async (names) => {
    const list = new DataTransfer();
    for (const [at, name] of names.entries()) {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 360;
      const context = canvas.getContext("2d");
      context.fillStyle = `hsl(${at * 120} 70% 50%)`;
      context.fillRect(0, 0, 480, 360);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
      list.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    }
    return list;
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
      .getByRole("option", { name, exact: true })
      .or(win.getByRole("button", { name, exact: true }))
      .first();
  await tile(NAMES[1]).waitFor({ timeout: 30_000 });

  const exportThrough = async (name) => {
    await page.getByRole("menuitem", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Export…", exact: true }).click();
    await page.getByRole("combobox", { name: "Save To" }).click();
    await page.getByRole("option", { name: "Other…", exact: true }).click();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const panel = page.locator(".mac-save-panel").first();
    await panel.waitFor({ timeout: 10_000 });
    await panel.getByRole("textbox").first().fill(name);
    await page.waitForTimeout(200);
    await shot(page, path.join(out, "photos-export-save.png"));
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await panel.waitFor({ state: "hidden", timeout: 10_000 });
  };

  const pictureOf = (id) =>
    page.evaluate(async (file) => {
      const reply = await fetch(`/api/files/content/${file}?piece=0&count=8`, {
        credentials: "same-origin",
      });
      if (!reply.ok) return null;
      const blob = await reply.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      return {
        width: bitmap.width,
        pixel: [...context.getImageData(bitmap.width >> 1, bitmap.height >> 1, 1, 1).data].slice(
          0,
          3,
        ),
      };
    }, id);
  // The first picture is red and the second green (hsl 0 and 120), so a file says which it holds.
  const isRed = (shot) => shot?.width === 480 && shot.pixel[0] > shot.pixel[1] + 60;
  const isGreen = (shot) => shot?.width === 480 && shot.pixel[1] > shot.pixel[0] + 60;

  // Several: a folder of that name holding one file each.
  await tile(NAMES[0]).click();
  await page.keyboard.press("ControlOrMeta+a");
  await exportThrough(FOLDER);
  const folder = await until(async () => {
    const all = await drive();
    const made = named(all, FOLDER);
    return made && all.filter((each) => each.parent === made.id).length === 2 ? made : null;
  });
  const inside = folder ? (await drive()).filter((each) => each.parent === folder.id) : [];
  const first = named(inside, `${NAMES[0]}.jpg`);
  const second = named(inside, `${NAMES[1]}.jpg`);
  step(
    "Export of several makes a folder holding each picture",
    Boolean(first && second) &&
      isRed(await pictureOf(first?.id)) &&
      isGreen(await pictureOf(second?.id)),
  );

  // One: the typed name, with the kind's extension.
  await page.keyboard.press("Escape");
  await tile(NAMES[0]).click();
  await exportThrough(SINGLE);
  const single = await until(async () => named(await drive(), `${SINGLE}.jpg`));
  step(
    "Export of one saves that picture under the typed name",
    Boolean(single) && isRed(await pictureOf(single?.id)),
    single?.name,
  );

  // Share hands an edited picture over as its rendered copy.
  await tile(NAMES[1]).dblclick();
  await win.locator(".mac-photos-viewer").waitFor({ timeout: 8_000 });
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  const exposure = win.getByRole("slider", { name: "Exposure" }).first();
  await exposure.waitFor({ timeout: 15_000 });
  await exposure.focus();
  for (let at = 0; at < 30; at += 1) await page.keyboard.press("ArrowRight");
  await win.getByRole("button", { name: "Done", exact: true }).click();
  const edited = await until(async () => {
    const photos = (await api(page, "GET", "/api/photos/library")).json.photos ?? [];
    return photos.find((each) => each.name === NAMES[1])?.edit;
  });
  step("the edit is kept", Boolean(edited));
  await page.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Share", exact: true }).click();
  await page.getByRole("menuitem", { name: "Notes", exact: true }).click();
  const rendered = await until(async () => {
    const all = await drive();
    const place = named(all, "Shared from Photos");
    return place
      ? all.find((each) => each.parent === place.id && each.name === `${NAMES[1]}.jpg`)
      : null;
  }, 20_000);
  const original = (await api(page, "GET", "/api/photos/library")).json.photos?.find(
    (each) => each.name === NAMES[1],
  );
  const copy = rendered ? await pictureOf(rendered.id) : null;
  const plain = original ? await pictureOf(original.file) : null;
  step(
    "Share renders the edit, leaving the original as it was",
    Boolean(copy && plain) && isGreen(plain) && copy.pixel[1] > plain.pixel[1] + 10,
    JSON.stringify({ copy: copy?.pixel, plain: plain?.pixel }),
  );
  const notes = page.locator(".mac-managed-window[data-window-id='notes']").first();
  await notes.waitFor({ timeout: 20_000 });
  const attached = await until(() =>
    notes.locator("img").evaluateAll(async (images, expected) => {
      for (const image of images) {
        await image.decode().catch(() => {});
        if (!image.naturalWidth) continue;
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const shown = context.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
        if (expected.every((value, at) => Math.abs(value - shown[at]) < 12)) return true;
      }
      return false;
    }, copy?.pixel ?? []),
  );
  step("Share > Notes puts the rendered picture in a note", attached === true);
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "photos-share-notes.png"));

  const left = (await api(page, "GET", "/api/photos/library")).json;
  for (const each of (left.photos ?? []).filter((p) => NAMES.includes(p.name))) {
    await api(page, "DELETE", `/api/photos/photos/${each.id}`);
  }
  console.log(`screenshots in ${out}`);
});
