#!/usr/bin/env node
// Photo Booth's modes and menus on the desktop served by `ferrite dev`, as a guest of its own: Take Four
// Quick Pictures keeps one two-by-two picture; Record a Movie Clip keeps a movie in the library that plays
// in the window; Command-click selects several and Edit > Select All and Delete act on them; the Camera
// menu chooses a camera and turns the flash off; the effect, the view and the flash survive a reload; View
// > Start Slideshow runs and Escape ends it. The camera and microphone are Chromium's fake devices. Exits 0
// only with every step passed and no console or HTTP error.
//
//   node e2e/photo-booth-modes-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photo-booth-modes", {
  launchOptions: {
    chromium: {
      args: ["--use-fake-device-for-media-stream=device-count=2", "--use-fake-ui-for-media-stream"],
    },
  },
});
const LIBRARY = "/api/app-store/library";

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const booth = async (page) =>
  ((await api(page, "GET", "/api/photos/library")).json.photos ?? []).filter(
    (photo) => photo.source === "photo-booth" && photo.deleted_ms === null,
  );

await run(async (page) => {
  await openDesktop(page, base, step);
  const held = (await api(page, "GET", LIBRARY)).json;
  if (!(held.installed ?? []).includes("photo-booth")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), "photo-booth"],
      rev: held.rev,
    });
  }
  await reloadDesktop(page);
  const open = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("Photo Booth");
    await field.press("Enter");
    const window = page.getByRole("region", { name: "Photo Booth", exact: true }).first();
    await window.waitFor({ state: "visible", timeout: 15_000 });
    await until(async () => !(await window.getAttribute("aria-busy")));
    return window;
  };
  let window = await open();
  const bar = page.getByRole("menubar").first();
  const choose = async (menu, item) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).first().click();
  };
  await window.getByRole("button", { name: "Sepia", exact: true }).first().click();
  const video = () => window.locator(".mac-photo-booth-frame video");
  await video().waitFor({ timeout: 10_000 });
  await until(() => video().evaluate((each) => each.videoWidth > 0));

  await window.getByRole("button", { name: "Take four quick pictures" }).click();
  await window.getByRole("button", { name: "Take Four Photos" }).click({ modifiers: ["Alt"] });
  await until(async () => (await booth(page)).length === 1, 20_000);
  const four = (await booth(page))[0];
  step(
    "Take Four Photos keeps one picture of four, with its effect",
    four?.width > 640 && four?.effect === "sepia",
    `${four?.width} by ${four?.height}, ${four?.effect}`,
  );
  await window.locator(`[data-picture-id="${four.id}"]`).click();
  await window.locator("img.mac-photo-booth-viewed").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "photo-booth-four.png"));
  await window.getByRole("button", { name: "Back to Camera" }).click();

  await window.getByRole("button", { name: "Record a movie clip" }).click();
  await window.getByRole("button", { name: "Record Clip" }).click({ modifiers: ["Alt"] });
  const stop = window.getByRole("button", { name: "Stop", exact: true });
  await stop.waitFor({ timeout: 10_000 });
  await window.locator(`[data-picture-id="${four.id}"]`).click();
  step("a click on the strip during a clip leaves the camera and Stop", await stop.isVisible());
  await bar.getByRole("menuitem", { name: "View", exact: true }).click();
  const hide = page.getByRole("menuitem", { name: /(Show|Hide) Effects/ }).first();
  step(
    "the View menu's rows dim during a clip",
    (await hide.getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");
  await bar.getByRole("menuitem", { name: "Camera", exact: true }).click();
  const cameraRow = page.getByRole("menuitemradio", { name: "fake_device_1", exact: true });
  step(
    "the Camera menu's rows dim during a clip",
    (await cameraRow.getAttribute("aria-disabled")) === "true" ||
      (await cameraRow.getAttribute("data-disabled")) !== null,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1_600);
  await shot(page, path.join(out, "photo-booth-recording.png"));
  await stop.click();
  await until(async () => (await booth(page)).length === 2, 30_000);
  const clip = (await booth(page)).find((photo) => photo.mime.startsWith("video/"));
  step(
    "Record Clip keeps a movie in the library",
    clip?.duration_ms > 1000 && clip?.mime.startsWith("video/"),
    `${clip?.mime}, ${clip?.duration_ms} ms`,
  );
  await window.locator(`[data-picture-id="${clip.id}"]`).click();
  const player = window.locator("video.mac-photo-booth-viewed");
  await player.waitFor({ timeout: 15_000 });
  await player.click();
  const plays = await until(() => player.evaluate((each) => each.currentTime > 0.2));
  await shot(page, path.join(out, "photo-booth-clip.png"));
  step("a clip plays in the window", plays === true);
  await choose("View", "Show Photo Preview");
  await window.getByRole("button", { name: "Record Clip" }).waitFor({ timeout: 5_000 });
  await video().waitFor({ timeout: 5_000 });
  step("Show Photo Preview brings the camera back from a clip shown large", true);

  const watchFlash = () =>
    page.evaluate(() => {
      window.__flashSeen = false;
      new MutationObserver(() => {
        if (document.querySelector(".mac-photo-booth-flash")) window.__flashSeen = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
  const flashSeen = () => page.evaluate(() => window.__flashSeen);

  await window.getByRole("button", { name: "Take a still picture" }).click();
  await watchFlash();
  await window.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
  await until(async () => (await booth(page)).length === 3, 20_000);
  step("with Enable Screen Flash on, a flash shows", (await flashSeen()) === true);
  const strip = window.getByRole("list", { name: "Photos" });
  await until(async () => (await strip.getByRole("button").count()) === 3);
  await strip
    .getByRole("button")
    .nth(0)
    .click({ modifiers: ["Meta"] });
  await strip
    .getByRole("button")
    .nth(2)
    .click({ modifiers: ["Meta"] });
  const twoChosen = await window.locator(".mac-photo-booth-thumb-button[data-selected]").count();
  step("Command-click selects two pictures", twoChosen === 2);
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photo-booth-selected.png"));
  await choose("Edit", "Delete");
  await until(async () => (await booth(page)).length === 1, 20_000);
  step("Edit > Delete sends both to Recently Deleted", (await booth(page)).length === 1);
  await choose("Edit", "Select All");
  step(
    "Edit > Select All selects the strip",
    (await window.locator(".mac-photo-booth-thumb-button[data-selected]").count()) === 1,
  );

  await bar.getByRole("menuitem", { name: "Camera", exact: true }).click();
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photo-booth-camera-menu.png"));
  const firstCamera = await video().evaluate((each) => each.srcObject?.getVideoTracks()[0]?.label);
  const other = firstCamera === "fake_device_1" ? "fake_device_0" : "fake_device_1";
  // The next camera answers late, so the time between the two can be seen.
  await page.evaluate(() => {
    const media = navigator.mediaDevices;
    const real = media.getUserMedia.bind(media);
    media.getUserMedia = async (asked) => {
      await new Promise((done) => setTimeout(done, 1_500));
      return real(asked);
    };
  });
  await page.getByRole("menuitemradio", { name: other, exact: true }).click();
  const shutter = window.getByRole("button", { name: "Take Photo" });
  step("the shutter is off while the next camera is pending", await shutter.isDisabled());
  const moved = await until(async () =>
    video().evaluate(
      (each, wanted) => each.srcObject?.getVideoTracks()[0]?.label === wanted,
      other,
    ),
  );
  step("the Camera menu chooses another camera", moved === true, `${firstCamera} to ${other}`);
  step(
    "the shutter comes back with the new camera",
    (await until(() => shutter.isEnabled())) === true,
  );

  await bar.getByRole("menuitem", { name: "Camera", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "Enable Screen Flash", exact: true }).click();
  const saved = await until(async () => {
    const held = JSON.stringify((await api(page, "GET", "/api/system-preferences/settings")).json);
    return held.includes("photo-booth.flash") && held.includes("photo-booth.camera");
  }, 20_000);
  step("the flash and the camera choice reach the server", saved === true);
  await reloadDesktop(page);
  window = await open();
  await video().waitFor({ timeout: 15_000 });
  const kept = await video().evaluate((each) => each.style.filter);
  step("the effect and the camera view survive a reload", /sepia/.test(kept), kept);
  await until(() => video().evaluate((each) => each.videoWidth > 0));
  const cameraAfter = await until(async () =>
    video().evaluate(
      (each, wanted) => each.srcObject?.getVideoTracks()[0]?.label === wanted,
      other,
    ),
  );
  step("the camera choice survives a reload", cameraAfter === true);
  await watchFlash();
  await window.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
  await until(async () => (await booth(page)).length === 2, 20_000);
  step(
    "with Enable Screen Flash off no flash shows, also after a reload",
    (await flashSeen()) === false,
  );

  await choose("View", "Start Slideshow");
  const slideshow = page.getByRole("dialog", { name: "Slideshow" });
  await slideshow.waitFor({ timeout: 10_000 });
  const slide = slideshow.locator(".mac-photo-booth-slide");
  await slide.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "photo-booth-slideshow.png"));
  const firstSlide = await slide.getAttribute("alt");
  await page.keyboard.press("ArrowRight");
  const turned = await until(async () => (await slide.getAttribute("alt")) !== firstSlide);
  step("Start Slideshow shows the pictures, and the arrow key turns them", turned === true);
  await page.keyboard.press("Escape");
  await slideshow.waitFor({ state: "detached", timeout: 5_000 });
  step("Escape ends it", true);
});
