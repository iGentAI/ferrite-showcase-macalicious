#!/usr/bin/env node
// Photo Booth's mirror on the desktop served by `ferrite dev`: the camera view is mirrored, a picture
// is saved as the mirror showed it, Edit > Flip Photo flips one and a reload keeps that, Auto Flip New
// Items off saves the next as the camera saw it and is kept, and Edit > Delete removes the picture
// shown. Exits 0 only with every step passed and no console or HTTP error. The camera is a stand-in: a
// canvas stream given at getUserMedia, red on its left and blue on its right, so a flip can be read
// from the pixels. It touches only the pictures it took, and leaves Auto Flip New Items as it found
// it; --auto-flip-starts-off runs it from a person who had turned that off.
//
//   node e2e/photo-booth-flip-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]
//        [--auto-flip-starts-off]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photo-booth-flip");
const LIBRARY = "/api/app-store/library";

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const booth = async (page) =>
  ((await api(page, "GET", "/api/photos/library")).json.photos ?? []).filter(
    (photo) => photo.source === "photo-booth" && photo.deleted_ms === null,
  );

async function open(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photo Booth");
  await field.press("Enter");
  const window = page.getByRole("region", { name: "Photo Booth", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await until(async () => !(await window.getAttribute("aria-busy")));
  return window;
}

/** Which side the red is on in the picture shown large: "left" or "right". */
const redSide = (image) =>
  image.evaluate(async (element) => {
    await element.decode();
    const canvas = document.createElement("canvas");
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(element, 0, 0);
    const [r] = context.getImageData(Math.floor(canvas.width / 4), canvas.height >> 1, 1, 1).data;
    return r > 128 ? "left" : "right";
  });

await run(async (page) => {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    const draw = () => {
      context.fillStyle = "#e01010";
      context.fillRect(0, 0, 320, 480);
      context.fillStyle = "#1010e0";
      context.fillRect(320, 0, 320, 480);
    };
    setInterval(draw, 100);
    draw();
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(15);
  });
  // Only what this page itself registered is the journey's, by the id the page sent: a picture another
  // window takes meanwhile is neither selected, edited nor deleted.
  const made = new Set();
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/photos/photos") {
      made.add(request.postDataJSON().id);
    }
  });
  await openDesktop(page, base, step);
  const held = (await api(page, "GET", LIBRARY)).json;
  const added = !(held.installed ?? []).includes("photo-booth");
  if (added) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), "photo-booth"],
      rev: held.rev,
    });
  }
  let autoFlipFound = null;
  /** Auto Flip New Items, read from the menu and set to `wanted` when given; answers what it found. */
  const autoFlip = async (wanted) => {
    await page.getByRole("menuitem", { name: "Edit", exact: true }).first().click();
    const item = page.getByRole("menuitemcheckbox", { name: "Auto Flip New Items", exact: true });
    const found = (await item.first().getAttribute("aria-checked")) === "true";
    if (wanted === undefined || wanted === found) await page.keyboard.press("Escape");
    else {
      await item.first().click();
      await page.waitForTimeout(1_200);
    }
    await page.waitForTimeout(200);
    return found;
  };
  try {
    const mine = async () => (await booth(page)).filter((photo) => made.has(photo.id));
    await reloadDesktop(page);
    let window = await open(page);
    await window.getByRole("button", { name: "Normal", exact: true }).first().click();
    autoFlipFound = await autoFlip();
    if (process.argv.includes("--auto-flip-starts-off")) await autoFlip(false);
    await autoFlip(true);
    const video = window.locator(".mac-photo-booth-frame video");
    await video.waitFor({ timeout: 10_000 });
    await until(() => video.evaluate((each) => each.videoWidth > 0));
    step(
      "the camera view is mirrored",
      (await video.evaluate((each) => getComputedStyle(each).transform)).startsWith("matrix(-1,"),
    );
    await page.waitForTimeout(300);
    await shot(page, path.join(out, "photo-booth-mirror.png"));

    /** Takes a picture and answers its id, the one the page registered just now. */
    const take = async () => {
      const known = new Set(made);
      await window.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
      const id = await until(() => [...made].find((each) => !known.has(each)));
      await until(async () => (await mine()).some((photo) => photo.id === id));
      return id;
    };
    const thumb = (id) => window.locator(`[data-picture-id="${id}"]`);
    const record = async (id) => (await mine()).find((photo) => photo.id === id);
    const show = async (id) => {
      await thumb(id).click();
      await until(async () => (await thumb(id).getAttribute("aria-pressed")) === "true");
      const large = window.locator("img.mac-photo-booth-viewed");
      await large.waitFor({ timeout: 10_000 });
      await page.waitForTimeout(500);
      return large;
    };
    const row = async (name) => {
      await page.getByRole("menuitem", { name: "Edit", exact: true }).first().click();
      await page
        .getByRole("menuitem", { name, exact: true })
        .or(page.getByRole("menuitemcheckbox", { name, exact: true }))
        .first()
        .click();
      await page.waitForTimeout(300);
    };

    const firstId = await take();
    let large = await show(firstId);
    step(
      "a picture is saved as the mirror showed it: red on the right",
      (await redSide(large)) === "right",
    );

    await row("Flip Photo");
    const flipped = await until(async () => (await record(firstId))?.edit?.flip === true);
    step("Flip Photo keeps the flip in the library", flipped === true);
    const turned = await until(async () => (await redSide(large)) === "left");
    step("the picture shown flips", turned === true);
    await shot(page, path.join(out, "photo-booth-flipped.png"));

    // Each flip starts from the one before: a second takes it back, and a third flips it again.
    await row("Flip Photo");
    const back = await until(async () => !(await record(firstId))?.edit);
    step("a second Flip Photo takes the edit off", back === true);
    await until(async () => (await redSide(large)) === "right");
    await row("Flip Photo");
    await until(async () => (await record(firstId))?.edit?.flip === true);
    await until(async () => (await redSide(large)) === "left");

    await thumb(firstId).focus();
    await page.keyboard.press("Escape");
    await autoFlip(false);
    await video.waitFor({ timeout: 5_000 });
    const secondId = await take();
    large = await show(secondId);
    step(
      "with Auto Flip off the next is saved as the camera saw it: red on the left",
      (await redSide(large)) === "left",
    );

    await reloadDesktop(page);
    window = await open(page);
    await window.getByRole("button", { name: "Normal", exact: true }).first().click();
    large = await show(firstId);
    step("a reload keeps the flip", (await redSide(large)) === "left");
    step("a reload keeps Auto Flip off", (await autoFlip()) === false);

    await row("Delete");
    const left = await until(
      async () => (await record(firstId)) === undefined && (await record(secondId)) !== undefined,
    );
    step("Edit > Delete removes the picture shown, and only that", left === true);
  } finally {
    // The setting as it was found, whatever failed above.
    if (autoFlipFound !== null) {
      await autoFlip(autoFlipFound).catch((error) =>
        step("Auto Flip is put back as it was found", false, String(error)),
      );
    }
    for (const id of made) {
      const gone = await api(page, "DELETE", `/api/photos/photos/${id}`);
      if (gone.json?.file) {
        await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: gone.json.file }] });
        await api(page, "POST", "/api/photos/purged", { files: [gone.json.file] });
      }
    }
    if (added) {
      const now = (await api(page, "GET", LIBRARY)).json;
      await api(page, "PUT", LIBRARY, {
        installed: (now.installed ?? []).filter((id) => id !== "photo-booth"),
        rev: now.rev,
      });
    }
  }
});
