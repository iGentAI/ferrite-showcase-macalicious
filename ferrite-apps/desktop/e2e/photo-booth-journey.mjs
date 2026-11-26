#!/usr/bin/env node
// Photo Booth on Ferrite: get Photo Booth from the session's library, open it
// from Spotlight with the browser's camera (Playwright's fake camera in each
// engine), choose Sepia and take a picture, which is saved with the effect drawn
// in to the person's Photos library: its original uploaded to the drive's
// Pictures/Photo Booth folder, and a Photos record of source photo-booth. Reload
// the page, open Photo Booth again and find the picture in the strip, export it from its
// contextual menu (its original, as Photos keeps it, downloaded byte for byte), then delete it
// with the Delete key, which moves it to Photos' Recently Deleted. In two more browsers the
// browser's answer to the camera request is a refusal (NotAllowedError) and no camera
// (NotFoundError), injected at getUserMedia since no engine can be made to refuse from a
// headless prompt: Photo Booth says each in its own words and dims Take Photo.
// Exits 0 only when every step passed and the page logged no console error,
// page error, failed request or HTTP error. It removes what it made at the end,
// and only that: its picture, its original and Photo Booth's place in the
// session's library.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/photo-booth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                    [--browser chromium|chrome|firefox|webkit]

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { sameDownloadName } from "./journey-kit.mjs";

const PHOTOS = "/api/photos/library";
const LIBRARY = "/api/app-store/library";
const { base, out, browserName } = options();
// A camera for the page without a prompt: Chromium's and Firefox's fake devices, and WebKit's
// mock camera with the camera permission granted to the context.
const { step, run } = journey("photo-booth", {
  launchOptions: {
    chromium: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
    firefox: {
      firefoxUserPrefs: {
        "media.navigator.streams.fake": true,
        "media.navigator.permission.disabled": true,
      },
    },
  },
  contextOptions: { webkit: { permissions: ["camera"] } },
});

async function openWithSpotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
}

async function open(page) {
  await openWithSpotlight(page, "Photo Booth");
  const window = page.getByRole("region", { name: "Photo Booth", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    {
      timeout: 10_000,
    },
  );
  return window;
}

/**
 * Remove the journey's own picture, and nothing else: deleted for good, its original removed
 * from the drive and the removal confirmed.
 */
async function removeOwn(page, photo) {
  if (!photo) return;
  const gone = await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
  // Only the original the server hands back (null while another kept photo names it).
  const file = gone.json.file;
  if (file) {
    await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: file }] });
    await api(page, "POST", "/api/photos/purged", { files: [file] });
  }
}

/** Photo Booth's pictures in the Photos library. */
const boothPhotos = async (page) =>
  ((await api(page, "GET", PHOTOS)).json.photos ?? []).filter(
    (photo) => photo.source === "photo-booth",
  );

/** Put Photo Booth in the session's library, as the App Store would; answers whether it was not
 * there before (so the run takes it out again). */
async function install(page) {
  const library = await api(page, "GET", LIBRARY);
  const installed = library.json.installed ?? [];
  const got = await api(page, "PUT", LIBRARY, {
    installed: [...installed.filter((id) => id !== "photo-booth"), "photo-booth"],
    rev: library.json.rev,
  });
  return {
    ok: got.status === 200,
    added: got.status === 200 && !installed.includes("photo-booth"),
  };
}

const strip = (window) =>
  window
    .getByRole("list", { name: "Photos" })
    .getByRole("button")
    .evaluateAll((thumbs) => thumbs.map((thumb) => thumb.getAttribute("aria-label")));

/** The journey's steps; `made` records what it created, for the cleanup in `finally`. */
async function walk(page, made) {
  await openDesktop(page, base, step);
  // The journey's browser is a new one, with a session of its own; it touches nothing it did
  // not make, so it expects that session to have no Photo Booth pictures yet.
  const before = await boothPhotos(page);
  step(
    "the session has no Photo Booth pictures yet",
    before.filter((photo) => photo.deleted_ms === null).length === 0,
    `${before.length} found`,
  );
  // Photo Booth does not come with the desktop: get it, as the App Store would.
  const library = await api(page, "GET", LIBRARY);
  const installed = library.json.installed ?? [];
  const got = await api(page, "PUT", LIBRARY, {
    installed: [...installed.filter((id) => id !== "photo-booth"), "photo-booth"],
    rev: library.json.rev,
  });
  // Taken out again afterwards only when this run put it in.
  if (got.status === 200 && !installed.includes("photo-booth")) made.installed = true;
  step("Photo Booth is in the session's library", got.status === 200, `status ${got.status}`);
  await reloadDesktop(page);

  let window = await open(page);
  const take = window.getByRole("button", { name: "Take Photo" });
  await page.waitForFunction(
    (frame) => {
      const video = frame.querySelector("video");
      return video && video.videoWidth > 0 && video.readyState >= 2;
    },
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  step("the previews show the browser's camera", true);

  await window.getByRole("button", { name: "Sepia" }).click();
  await take.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    (frame) => {
      const button = [...frame.querySelectorAll("button")].find(
        (each) => each.textContent?.trim() === "Take Photo",
      );
      return button && !button.disabled && button.getAttribute("aria-disabled") !== "true";
    },
    await window.elementHandle(),
    { timeout: 10_000 },
  );
  step("Take Photo is enabled with a camera", await take.isEnabled());

  const uploaded = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new globalThis.URL(response.url()).pathname === "/api/photos/photos",
    { timeout: 20_000 },
  );
  await take.click();
  const upload = await uploaded;
  // The cleanup removes this photo, by the id its upload answered (`{"photo": {...}}`), and
  // never another.
  const created = (await upload.json().catch(() => null))?.photo;
  if (created?.id) made.photo = created;
  step(
    "the picture is added to the Photos library",
    upload.status() === 201 && typeof created?.id === "string",
    `status ${upload.status()}`,
  );

  const listed = await boothPhotos(page);
  const photo = listed.find((each) => each.id === created?.id);
  step(
    "Photos keeps one Photo Booth picture taken with Sepia",
    listed.length === 1 &&
      photo.effect === "sepia" &&
      photo.mime === "image/jpeg" &&
      photo.bytes > 0,
    `${photo?.bytes} bytes`,
  );
  const drive = await api(page, "GET", "/api/files/");
  const file = drive.json.entries?.find((entry) => entry.id === photo?.file);
  const folder = drive.json.entries?.find((entry) => entry.id === file?.parent);
  step(
    "its original is in Pictures/Photo Booth on the drive",
    folder?.name === "Photo Booth" && folder?.parent === "pictures" && file?.size === photo?.bytes,
    file?.name,
  );
  // The effect is drawn into the saved picture: a sepia frame has more red than blue.
  const tone = await page.evaluate(async (id) => {
    const response = await fetch(`/api/files/content/${encodeURIComponent(id)}?piece=0&count=8`, {
      credentials: "same-origin",
    });
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, 32, 24);
    const data = context.getImageData(0, 0, 32, 24).data;
    let red = 0;
    let blue = 0;
    for (let at = 0; at < data.length; at += 4) {
      red += data[at];
      blue += data[at + 2];
    }
    return { red, blue };
  }, photo?.file ?? "");
  step(
    "the saved picture has the Sepia effect drawn in",
    tone.red > tone.blue,
    JSON.stringify(tone),
  );

  await reloadDesktop(page);
  window = await open(page);
  // The strip is under the camera view, which choosing an effect opens.
  await window.getByRole("button", { name: "Sepia" }).click();
  await window.getByRole("list", { name: "Photos" }).waitFor({ timeout: 10_000 });
  step(
    "after a reload, the strip shows the picture",
    JSON.stringify(await strip(window)) === JSON.stringify(["Photo 1, Sepia"]),
  );
  await page.waitForFunction(
    (frame) => {
      const taken = frame.querySelector(".mac-photo-booth-taken");
      return taken instanceof HTMLImageElement && taken.complete && taken.naturalWidth > 0;
    },
    await window.elementHandle(),
    { timeout: 10_000 },
  );
  step("the strip's picture is the stored image", true);
  await shot(page, path.join(out, `photo-booth-${browserName}.png`));

  // A click on the picture shows it large, from its original; Back to Camera ends that.
  await window.getByRole("button", { name: "Photo 1, Sepia" }).click();
  const viewed = window.locator(".mac-photo-booth-viewed");
  await viewed.waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    (image) => image?.complete && image.naturalWidth >= 320,
    await viewed.elementHandle(),
    { timeout: 10_000 },
  );
  const large = await viewed.boundingBox();
  step(
    "a click on a picture shows it large, from its original",
    large.width > 300,
    `${large.width}`,
  );
  await shot(page, path.join(out, "photo-booth-picture-shown.png"));
  await window.getByRole("button", { name: "Back to Camera" }).click();
  await take.waitFor({ state: "visible", timeout: 5_000 });
  step("Back to Camera returns to the camera", (await window.locator("video").count()) > 0);

  // The shutter's keys: Option takes at once and flashes; Shift leaves the flash out.
  const flash = window.locator(".mac-photo-booth-flash");
  const count = async () => (await strip(window)).length;
  const before2 = await count();
  // Each picture the shutter's keys take, by the id the server answers its saving with.
  const took = [];
  const noteTaken = async (response) => {
    const request = response.request();
    if (request.method() !== "POST" || new URL(response.url()).pathname !== "/api/photos/photos") {
      return;
    }
    const answer = await response.json().catch(() => null);
    if (answer?.photo) took.push(answer.photo);
  };
  page.on("response", noteTaken);
  await take.click({ modifiers: ["Alt"] });
  await flash.waitFor({ state: "attached", timeout: 2_000 });
  await shot(page, path.join(out, "photo-booth-flash.png"));
  await page.waitForFunction(
    ([frame, wanted]) => frame.querySelectorAll(".mac-photo-booth-thumb-button").length === wanted,
    [await window.elementHandle(), before2 + 1],
    { timeout: 10_000 },
  );
  step("Option-click takes a picture at once, with a flash", true);
  await take.click({ modifiers: ["Alt", "Shift"] });
  await page.waitForFunction(
    ([frame, wanted]) => frame.querySelectorAll(".mac-photo-booth-thumb-button").length === wanted,
    [await window.elementHandle(), before2 + 2],
    { timeout: 10_000 },
  );
  step("Shift leaves the flash out", (await flash.count()) === 0);
  // A picture is in the strip before it is saved.
  for (let waited = 0; took.length < 2 && waited < 40; waited += 1) {
    await page.waitForTimeout(250);
  }
  page.off("response", noteTaken);
  step("the server named both pictures the shutter took", took.length === 2, `${took.length}`);
  await take.focus();
  await page.keyboard.press("Meta+t");
  const cancel = window.getByRole("button", { name: "Cancel" });
  await cancel.waitFor({ timeout: 2_000 });
  await cancel.click();
  step("Command-T starts the countdown", true);

  // Export… from the picture's contextual menu: its original, byte for byte, as a JPEG.
  const exported = page.waitForEvent("download", { timeout: 20_000 });
  await window.getByRole("button", { name: "Photo 1, Sepia" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Export…", exact: true }).click();
  const download = await exported;
  const bytes = readFileSync(await download.path());
  // The original as the drive keeps it, read whole and hashed in the page.
  const storedSha = await page.evaluate(async (id) => {
    const response = await fetch(`/api/files/content/${encodeURIComponent(id)}?piece=0&count=8`, {
      credentials: "same-origin",
    });
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", await response.arrayBuffer()),
    );
    return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }, photo?.file ?? "");
  const exportedSha = createHash("sha256").update(bytes).digest("hex");
  step(
    "Export… hands the picture's original to the computer, byte for byte, as a JPEG",
    sameDownloadName(download.suggestedFilename(), `${photo?.name}.jpg`, browserName) &&
      bytes.length === photo?.bytes &&
      exportedSha === storedSha &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8,
    `${download.suggestedFilename()}, ${bytes.length} bytes, sha256 ${exportedSha.slice(0, 12)} vs ${storedSha.slice(0, 12)}`,
  );
  await page.keyboard.press("Escape");

  const deleted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new globalThis.URL(response.url()).pathname === `/api/photos/photos/${photo?.id}`,
    { timeout: 10_000 },
  );
  await window.getByRole("button", { name: "Photo 1, Sepia" }).focus();
  await page.keyboard.press("Delete");
  step(
    "Delete on the picture moves it to Photos' Recently Deleted",
    (await deleted).status() === 200,
  );
  const after = await boothPhotos(page);
  step(
    "Photos keeps it in Recently Deleted",
    typeof after.find((each) => each.id === photo.id)?.deleted_ms === "number",
  );
  for (const each of took) await removeOwn(page, each);

  await removeOwn(page, photo);
  made.photo = null;

  // The browser refuses the camera, or has none: each said so, and no picture can be taken.
  for (const [error, words] of [
    ["NotAllowedError", "not allowed to use the camera"],
    ["NotFoundError", "No camera is connected"],
  ]) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 1440, height: 900 } });
    try {
      await context.addInitScript((name) => {
        const refuse = () =>
          Promise.reject(new DOMException("The browser did not give the camera.", name));
        // On the interface and on the object, so every engine's page meets it (WebKit keeps the
        // method on the prototype and may hand out a fresh object).
        const own = { value: refuse, configurable: true, writable: true };
        if (typeof MediaDevices !== "undefined") {
          Object.defineProperty(MediaDevices.prototype, "getUserMedia", own);
        }
        if (navigator.mediaDevices) {
          Object.defineProperty(navigator.mediaDevices, "getUserMedia", own);
        } else {
          Object.defineProperty(Navigator.prototype, "mediaDevices", {
            configurable: true,
            get: () => ({ getUserMedia: refuse }),
          });
        }
      }, error);
      const other = await context.newPage();
      await openDesktop(other, base, step);
      const placed = await install(other);
      await reloadDesktop(other);
      const refused = await open(other);
      await refused.getByRole("button", { name: "Sepia" }).click();
      const said = refused.locator(".mac-photo-booth-notice");
      await said.waitFor({ timeout: 10_000 });
      const text = await said.innerText();
      step(
        `a camera the browser does not give (${error}) is said so, and Take Photo is dimmed`,
        text.includes(words) &&
          (await refused.getByRole("button", { name: "Take Photo" }).isDisabled()),
        text,
      );
      if (placed.added) await uninstall(other);
    } finally {
      await context.close();
    }
  }

  if (made.installed) {
    await uninstall(page);
    made.installed = false;
  }
}

/** Take Photo Booth out of the session's library again. */
async function uninstall(page) {
  const left = await api(page, "GET", LIBRARY);
  await api(page, "PUT", LIBRARY, {
    installed: (left.json.installed ?? []).filter((id) => id !== "photo-booth"),
    rev: left.json.rev,
  });
}

await run(async (page) => {
  const made = {};
  try {
    await walk(page, made);
  } finally {
    // A step that failed or timed out still leaves nothing of the journey's behind: the photo and
    // the app-library entry are each cleaned up on their own, so one failing leaves the other.
    if (made.photo) {
      await removeOwn(page, made.photo).catch((error) =>
        console.log(`warn cleanup of the photo after a failed step did not finish: ${error}`),
      );
    }
    if (made.installed) {
      await uninstall(page).catch((error) =>
        console.log(`warn uninstall after a failed step did not finish: ${error}`),
      );
    }
  }
});
