#!/usr/bin/env node
// Photo Booth's Edit > Undo, Redo, Cut, Copy and Paste and View > Enter Full Screen on the desktop served by
// `ferrite dev`, as a guest of its own. Undo and Redo are read back from the library and the camera's
// filter; Copy reads the browser's real clipboard; Paste reads the pixels of the picture it adds; full
// screen measures the window and the previews. The camera is a stand-in: a canvas stream given at
// getUserMedia, red on its left and blue on its right. Clipboard permissions are granted to the browser
// context, so no prompt was seen. In Firefox and WebKit a second stand-in replaces the clipboard's
// four methods, and the paste event of the Paste key, with memory in the page: a headless Firefox's
// clipboard holds only text, and WebKit refuses a script's read without a click on its own prompt.
// Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photo-booth-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("photo-booth-rows", {
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const LIBRARY = "/api/app-store/library";

async function until(check, ms = 45_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const library = async (page) =>
  ((await api(page, "GET", "/api/photos/library")).json.photos ?? []).filter(
    (photo) => photo.source === "photo-booth",
  );
const record = async (page, id) => (await library(page)).find((photo) => photo.id === id);
const kept = async (page) => (await library(page)).filter((photo) => photo.deleted_ms === null);
// Recently Deleted keeps the record: one that has gone altogether is no move there.
const inDeleted = async (page, id) => typeof (await record(page, id))?.deleted_ms === "number";

const isRed = ([r, g, b]) => r > 170 && g < 90 && b < 90;
const isBlue = ([r, g, b]) => b > 170 && r < 90 && g < 90;
const isGreen = ([r, g, b]) => g > 170 && r < 90 && b < 90;

/** What the browser's clipboard holds, read as another program would. */
const clipboardPicture = (page) =>
  page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const type = item?.types.find((each) => each.startsWith("image/"));
    return type ? window.pictureSides(await item.getType(type)) : null;
  });

await run(async (page) => {
  const driveReads = new Set();
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/files/") driveReads.add(request);
  });
  page.on("requestfinished", (request) => driveReads.delete(request));
  page.on("requestfailed", (request) => driveReads.delete(request));
  page.on("console", (message) => {
    if (/^(Photo Booth|The browser)/.test(message.text())) console.log(`note ${message.text()}`);
  });
  await page.addInitScript((clipboardInMemory) => {
    if (clipboardInMemory) {
      let items = [];
      let text = "";
      Clipboard.prototype.write = async (given) => {
        const copied = [];
        for (const item of given) {
          const types = {};
          for (const type of item.types) types[type] = await item.getType(type);
          copied.push(new ClipboardItem(types));
        }
        items = copied;
        text = "";
      };
      Clipboard.prototype.read = async () => items;
      Clipboard.prototype.writeText = async (given) => {
        items = [];
        text = given;
      };
      Clipboard.prototype.readText = async () => text;
      // The browser's paste event would bring the empty real clipboard: the key brings the memory's.
      addEventListener(
        "keydown",
        async (event) => {
          if (!event.ctrlKey || event.key !== "v") return;
          if (event.target.matches?.("input, textarea, select, [contenteditable]")) return;
          event.preventDefault();
          const data = new DataTransfer();
          for (const item of items) {
            for (const type of item.types) {
              data.items.add(new File([await item.getType(type)], "clipboard", { type }));
            }
          }
          if (text) data.setData("text/plain", text);
          const paste = new Event("paste", { bubbles: true, cancelable: true });
          Object.defineProperty(paste, "clipboardData", { value: data });
          event.target.dispatchEvent(paste);
        },
        true,
      );
    }
    // Under a shared dev server another worker's half-saved file raises Vite's overlay over this page,
    // which keeps running the modules it has.
    addEventListener("DOMContentLoaded", () => {
      const hidden = document.createElement("style");
      hidden.textContent = "vite-error-overlay { display: none; }";
      document.head.append(hidden);
    });
    // The colour a quarter in from each side of a picture.
    window.pictureSides = async (blob) => {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const at = (x) => [...context.getImageData(x, canvas.height >> 1, 1, 1).data].slice(0, 3);
      return {
        type: blob.type,
        width: bitmap.width,
        height: bitmap.height,
        left: at(canvas.width >> 2),
        right: at((canvas.width * 3) >> 2),
      };
    };
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
    const given = {
      value: async () => canvas.captureStream(15),
      configurable: true,
      writable: true,
    };
    // On the interface too: WebKit may hand out a fresh object for `navigator.mediaDevices`.
    Object.defineProperty(MediaDevices.prototype, "getUserMedia", given);
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", given);
  }, !["chromium", "chrome"].includes(browserName));
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
    const found = page.getByRole("region", { name: "Photo Booth", exact: true }).first();
    await found.waitFor({ state: "visible", timeout: 15_000 });
    await until(async () => !(await found.getAttribute("aria-busy")));
    return found;
  };
  const window = await open();
  const preview = (name) => window.getByRole("button", { name, exact: true }).first();
  await preview("Normal").click();
  let video = window.locator(".mac-photo-booth-frame video");
  await video.waitFor({ timeout: 10_000 });
  await until(() => video.evaluate((each) => each.videoWidth > 0));

  const bar = page.getByRole("menubar").first();
  const openMenu = (title) => bar.getByRole("menuitem", { name: title, exact: true }).click();
  const choose = async (title, item) => {
    await openMenu(title);
    await page.getByRole("menuitem", { name: item, exact: true }).first().click();
    await page.waitForTimeout(300);
  };
  /** The row of the Edit menu, read with the menu open, which then closes. */
  const rowState = async (title, item) => {
    await openMenu(title);
    const row = page.getByRole("menuitem", { name: item, exact: true }).first();
    await row.waitFor({ timeout: 5_000 });
    const dimmed = (await row.getAttribute("aria-disabled")) === "true";
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    return { dimmed };
  };
  const thumb = (id) => window.locator(`[data-picture-id="${id}"]`);
  const thumbs = () => window.locator(".mac-photo-booth-thumb-button");
  /** Takes a picture and answers its id. */
  const take = async () => {
    const before = new Set((await library(page)).map((photo) => photo.id));
    await window.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
    return until(async () => (await library(page)).find((photo) => !before.has(photo.id))?.id);
  };
  const show = async (id) => {
    await thumb(id).click();
    await until(async () => (await thumb(id).getAttribute("aria-pressed")) === "true");
    const large = window.locator("img.mac-photo-booth-viewed");
    await large.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    return large;
  };
  /** The picture shown large, read from its image: an edit replaces the image's address at any moment. */
  const shownSides = (large) =>
    large.evaluate(async (element) => {
      await element.decode();
      const canvas = document.createElement("canvas");
      canvas.width = element.naturalWidth;
      canvas.height = element.naturalHeight;
      canvas.getContext("2d").drawImage(element, 0, 0);
      return window.pictureSides(await new Promise((done) => canvas.toBlob(done, "image/png")));
    });
  const backToCamera = async () => {
    await window.getByRole("button", { name: "Back to Camera" }).click();
    await video.waitFor({ timeout: 10_000 });
  };

  step("Undo and Redo dim with nothing to take back", (await rowState("Edit", "Undo")).dimmed);
  const first = await take();
  await until(async () => (await thumbs().count()) === 1);
  const second = await take();
  await until(async () => (await thumbs().count()) === 2);
  step("two pictures are kept", first && second && (await kept(page)).length === 2);

  // The shutter.
  const spare = await take();
  await choose("Edit", "Undo Take Photo");
  step(
    "Undo Take Photo moves the picture to Recently Deleted",
    await until(() => inDeleted(page, spare)),
  );
  await choose("Edit", "Redo Take Photo");
  step(
    "Redo Take Photo brings it back",
    await until(async () => (await record(page, spare))?.deleted_ms === null),
  );
  await choose("Edit", "Undo Take Photo");
  await until(() => inDeleted(page, spare));
  const afterUndo = await take();
  step("a picture taken after Undo clears Redo", (await rowState("Edit", "Redo")).dimmed);
  await choose("Edit", "Undo Take Photo");
  await until(() => inDeleted(page, afterUndo));
  await until(async () => (await thumbs().count()) === 2);

  // Effect changes.
  await window.getByRole("button", { name: "Effects", exact: true }).click();
  await preview("Sepia").click();
  video = window.locator(".mac-photo-booth-frame video");
  const filter = () => video.evaluate((each) => getComputedStyle(each).filter);
  await until(async () => (await filter()) === "sepia(1)");
  step("choosing Sepia puts it on the camera", (await filter()) === "sepia(1)");
  await choose("Edit", "Undo Effect");
  step(
    "Undo Effect takes the camera back to Normal",
    await until(async () => (await filter()) === "none"),
  );
  await choose("Edit", "Redo Effect");
  step("Redo Effect brings Sepia back", await until(async () => (await filter()) === "sepia(1)"));
  await choose("Edit", "Undo Effect");
  await until(async () => (await filter()) === "none");

  // A delete.
  await show(first);
  await choose("Edit", "Delete");
  step(
    "Edit > Delete moves the picture to Recently Deleted",
    await until(() => inDeleted(page, first)),
  );
  await until(async () => (await thumbs().count()) === 1);
  await openMenu("Edit");
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "photo-booth-rows-undo.png"));
  await page.getByRole("menuitem", { name: "Undo Delete", exact: true }).click();
  step(
    "Undo Delete brings it back in the library",
    await until(async () => (await record(page, first))?.deleted_ms === null),
  );
  step(
    "and its thumbnail back in the strip",
    await until(
      async () =>
        (await thumb(first).locator("img").count()) === 1 && (await thumbs().count()) === 2,
    ),
  );
  await page.waitForTimeout(300);
  await openMenu("Edit");
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "photo-booth-rows-redo.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+Shift+z");
  step("the Redo key deletes it again", await until(() => inDeleted(page, first)));
  await page.keyboard.press("Control+z");
  step(
    "the Undo key brings it back",
    await until(async () => (await record(page, first))?.deleted_ms === null),
  );
  await until(async () => (await thumb(first).locator("img").count()) === 1);

  // A flip.
  let large = await show(first);
  const start = await shownSides(large);
  step("the picture is saved mirrored, red on the right", isRed(start.right) && isBlue(start.left));
  await choose("Edit", "Flip Photo");
  await until(async () => (await record(page, first))?.edit?.flip === true);
  step(
    "Flip Photo flips what is shown",
    await until(async () => isRed((await shownSides(large)).left)),
  );
  await choose("Edit", "Undo Flip Photo");
  step(
    "Undo Flip Photo takes the edit off in the library",
    await until(async () => !(await record(page, first))?.edit),
  );
  step("and in what is shown", await until(async () => isRed((await shownSides(large)).right)));

  // Several at once are one step.
  await backToCamera();
  await thumb(first).click({ modifiers: ["Control"] });
  await thumb(second).click({ modifiers: ["Control"] });
  await choose("Edit", "Delete");
  await until(async () => (await kept(page)).length === 0);
  step("two chosen pictures go together", (await kept(page)).length === 0);
  await choose("Edit", "Undo Delete");
  step("one Undo brings both back", await until(async () => (await kept(page)).length === 2));
  await until(async () => (await thumbs().locator("img").count()) === 2);

  // Copy.
  step("Copy dims with nothing chosen", (await rowState("Edit", "Copy")).dimmed);
  large = await show(first);
  await openMenu("Edit");
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "photo-booth-rows-copy.png"));
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  const original = await record(page, first);
  const onClipboard = await until(() => clipboardPicture(page).catch(() => null));
  step(
    "Copy puts the picture on the browser's real clipboard, as a PNG",
    onClipboard?.type === "image/png" &&
      onClipboard.width === original.width &&
      onClipboard.height === original.height,
    JSON.stringify(onClipboard),
  );
  step(
    "with the picture's own pixels",
    isRed(onClipboard?.right ?? [0, 0, 0]) && isBlue(onClipboard?.left ?? [0, 0, 0]),
  );

  // Paste.
  const known = new Set((await library(page)).map((photo) => photo.id));
  await choose("Edit", "Paste");
  const pastedId = await until(
    async () => (await kept(page)).find((photo) => !known.has(photo.id))?.id,
  );
  const pasted = await record(page, pastedId);
  step(
    "Paste adds a new picture with a file of its own",
    Boolean(pastedId) && pasted?.file !== original.file,
    (await window.locator(".mac-photo-booth-notice").allTextContents()).join(" "),
  );
  await until(async () => (await thumbs().count()) === 3);
  large = await show(pastedId);
  const shownPaste = await shownSides(large);
  step(
    "the pasted picture holds the copied pixels",
    isRed(shownPaste.right) && isBlue(shownPaste.left),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "photo-booth-rows-paste.png"));
  await choose("Edit", "Undo Paste");
  step("Undo Paste takes it away", await until(() => inDeleted(page, pastedId)));
  await choose("Edit", "Redo Paste");
  step(
    "Redo Paste brings it back",
    await until(async () => (await record(page, pastedId))?.deleted_ms === null),
  );
  await until(async () => (await thumbs().locator("img").count()) === 3);

  // Cut, then Paste.
  await show(second);
  const cutRecord = await record(page, second);
  // A sentinel on the clipboard first: Copy's earlier picture would satisfy the check by itself.
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(0,255,0)";
    context.fillRect(0, 0, 16, 16);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });
  await choose("Edit", "Cut");
  step("Cut moves the picture to Recently Deleted", await until(() => inDeleted(page, second)));
  const cutOnClipboard = await until(async () => {
    const held = await clipboardPicture(page).catch(() => null);
    return held && isRed(held.right) ? held : null;
  });
  step(
    "and leaves it on the clipboard, in place of what was there",
    cutOnClipboard?.type === "image/png" && isRed(cutOnClipboard.right),
  );
  await openMenu("Edit");
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "photo-booth-rows-cut.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const beforeCutPaste = new Set((await library(page)).map((photo) => photo.id));
  await page.keyboard.press("Control+v");
  const cutPasted = await until(
    async () => (await kept(page)).find((photo) => !beforeCutPaste.has(photo.id))?.id,
  );
  step(
    "the Paste key brings it back as a new picture",
    Boolean(cutPasted) && (await record(page, cutPasted)).file !== cutRecord.file,
  );
  await choose("Edit", "Undo Paste");
  await until(() => inDeleted(page, cutPasted));
  await choose("Edit", "Undo Cut");
  step(
    "Undo Cut restores the picture cut",
    await until(async () => (await record(page, second))?.deleted_ms === null),
  );

  // A picture from elsewhere, replacing what Copy and Cut put on the computer's clipboard. Another
  // program's copy tells the page nothing, so nothing here does either.
  const anotherProgramCopies = (colour = "#10c010") =>
    page.evaluate(async (fill) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const context = canvas.getContext("2d");
      context.fillStyle = fill;
      context.fillRect(0, 0, 320, 240);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    }, colour);
  await anotherProgramCopies();
  const pasteFrom = async (press) => {
    const before = new Set((await library(page)).map((photo) => photo.id));
    await press();
    return until(async () => (await kept(page)).find((photo) => !before.has(photo.id))?.id);
  };
  /** The Paste key and then Edit > Paste each add the other program's picture. */
  const bothPasteTheOtherPicture = async (after) => {
    for (const [route, press] of [
      ["the Paste key", () => page.keyboard.press("Control+v")],
      ["Edit > Paste", () => choose("Edit", "Paste")],
    ]) {
      const added = await pasteFrom(press);
      step(`after ${after}, ${route} takes a picture another program copied`, Boolean(added));
      if (!added) continue;
      await until(async () => (await thumb(added).count()) === 1);
      large = await show(added);
      step("holding its pixels", isGreen((await shownSides(large)).left));
    }
  };

  await bothPasteTheOtherPicture("Copy and Cut");
  await backToCamera();

  // WebKit on Linux has no MediaRecorder, and a clip of this canvas camera never ends in headless
  // Firefox: neither has a movie to copy, here or in Finder below.
  const recordsMovies = ["chromium", "chrome"].includes(browserName);
  let clip;
  if (recordsMovies) {
    // A copy that puts no picture on the computer's clipboard: a movie, then a still the browser refuses.
    await window.getByRole("button", { name: "Record a movie clip" }).click();
    const beforeClip = new Set((await library(page)).map((photo) => photo.id));
    await window.getByRole("button", { name: "Record Clip" }).click({ modifiers: ["Alt"] });
    const stopClip = window.getByRole("button", { name: "Stop", exact: true });
    await stopClip.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
    await stopClip.click();
    clip = await until(
      async () =>
        (await library(page)).find(
          (photo) => !beforeClip.has(photo.id) && photo.duration_ms !== null,
        )?.id,
    );
    step("a clip is recorded to copy", Boolean(clip));
    await window.getByRole("button", { name: "Take a still picture" }).click();
    await until(async () => (await thumb(clip).count()) === 1);
    await thumb(clip).click();
    await page.waitForTimeout(500);
    await choose("Edit", "Copy");
    step(
      "Copy of a movie takes the earlier picture off the computer's clipboard",
      await until(async () => (await clipboardPicture(page).catch(() => null)) === null),
    );
    const pastedClip = await pasteFrom(() => page.keyboard.press("Control+v"));
    step(
      "the Paste key brings the movie",
      (await record(page, pastedClip))?.duration_ms > 0,
      String(pastedClip),
    );
    await until(async () => (await thumb(pastedClip).count()) === 1);
    await anotherProgramCopies();
    await bothPasteTheOtherPicture("a copied movie");
    await backToCamera();
  }

  // A copy the browser refuses leaves an older picture there: that says nothing about the copy, so
  // Paste brings what was copied, until something else replaces the older picture.
  await anotherProgramCopies("#1010c0");
  large = await show(first);
  const copiedSides = await shownSides(large);
  await page.evaluate(() => {
    navigator.clipboard.write = () =>
      Promise.reject(new DOMException("refused here", "NotAllowedError"));
  });
  await choose("Edit", "Copy");
  await page.waitForTimeout(500);
  await page.evaluate(() => delete navigator.clipboard.write);
  const afterRefusal = await pasteFrom(() => page.keyboard.press("Control+v"));
  step("after a refused Copy, the Paste key adds a picture", Boolean(afterRefusal));
  await until(async () => (await thumb(afterRefusal).count()) === 1);
  large = await show(afterRefusal);
  const pastedSides = await shownSides(large);
  step(
    "the one copied, not the older one left on the clipboard",
    JSON.stringify(pastedSides) === JSON.stringify(copiedSides),
    JSON.stringify({ pastedSides, copiedSides }),
  );
  await anotherProgramCopies();
  await bothPasteTheOtherPicture("a copy the browser refused");
  await backToCamera();

  // A copy here, then another program's copy of words: nothing is left to paste, not the old picture.
  large = await show(first);
  await choose("Edit", "Copy");
  await until(async () =>
    isRed((await clipboardPicture(page).catch(() => null))?.right ?? [0, 0, 0]),
  );
  for (const [route, press] of [
    ["the Paste key", () => page.keyboard.press("Control+v")],
    ["Edit > Paste", () => choose("Edit", "Paste")],
  ]) {
    await page.evaluate(() => navigator.clipboard.writeText("words from elsewhere"));
    const before = (await library(page)).length;
    await press();
    step(
      `${route} says so when another program copied words over the picture`,
      await until(
        () => window.getByText("The clipboard holds no picture to paste.").isVisible(),
        10_000,
      ),
    );
    step("and adds nothing", (await library(page)).length === before);
    await choose("Edit", "Copy");
    await until(async () =>
      isRed((await clipboardPicture(page).catch(() => null))?.right ?? [0, 0, 0]),
    );
  }

  // A picture like the one Copy left, but for a small patch, is another picture.
  await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bitmap = await createImageBitmap(await item.getType("image/png"));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect((canvas.width >> 2) - 3, (canvas.height >> 1) - 3, 6, 6);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });
  const patched = await pasteFrom(() => page.keyboard.press("Control+v"));
  step(
    "the Paste key takes a picture differing from the copied one by a small patch",
    Boolean(patched),
  );
  await until(async () => (await thumb(patched).count()) === 1);
  large = await show(patched);
  const patchedSides = await shownSides(large);
  step(
    "holding the patch and the pixels around it",
    patchedSides.left.every((each) => each > 240) && isRed(patchedSides.right),
    JSON.stringify(patchedSides),
  );
  await backToCamera();

  // The shutter waits for a Paste being stored.
  const slowStorage = async (route) => {
    if (route.request().method() !== "GET") {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    await route.continue().catch(() => {});
  };
  await anotherProgramCopies();
  await page.route("**/api/photos/**", slowStorage);
  let pressed = () => {};
  const pressing = new Promise((resolve) => {
    pressed = resolve;
  });
  const slowPaste = pasteFrom(async () => {
    await page.keyboard.press("Control+v");
    pressed();
  });
  await pressing;
  step(
    "the shutter is dimmed while a Paste is being stored",
    await until(() => window.getByRole("button", { name: "Take Photo" }).isDisabled(), 1_900),
  );
  await slowPaste;
  await page.unroute("**/api/photos/**", slowStorage);
  await until(() => window.getByRole("button", { name: "Take Photo" }).isEnabled());

  // What a slow shot is overtaken by waits, so that Undo finds them in order.
  await page.route("**/api/photos/**", slowStorage);
  const beforeSlowShot = new Set((await library(page)).map((photo) => photo.id));
  await window.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
  await page.waitForTimeout(200);
  step("Undo is dimmed while a shot is being stored", (await rowState("Edit", /^Undo/)).dimmed);
  await thumb(first).click();
  await choose("Edit", "Delete");
  step(
    "a Delete during it says to wait",
    await until(
      () => window.getByText("Wait for the last change to finish first.").isVisible(),
      5_000,
    ),
  );
  await page.unroute("**/api/photos/**", slowStorage);
  const slowShot = await until(
    async () => (await kept(page)).find((photo) => !beforeSlowShot.has(photo.id))?.id,
  );
  step("the refused Delete changed nothing", (await record(page, first))?.deleted_ms === null);
  await backToCamera();
  await until(async () => !(await rowState("Edit", /^Undo/)).dimmed);
  await choose("Edit", "Undo Take Photo");
  step("Undo then takes back the shot", await until(() => inDeleted(page, slowShot)));

  // Paste before Copy's write has finished takes what was copied, not what that write replaces.
  for (const [route, press] of [
    ["the Paste key", () => page.keyboard.press("Control+v")],
    ["Edit > Paste", () => choose("Edit", "Paste")],
  ]) {
    await anotherProgramCopies();
    large = await show(first);
    await page.evaluate(() => {
      const real = navigator.clipboard.write.bind(navigator.clipboard);
      navigator.clipboard.write = async (items) => {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        delete navigator.clipboard.write;
        return real(items);
      };
    });
    await choose("Edit", "Copy");
    const added = await pasteFrom(press);
    step(`${route} during a slow Copy adds a picture`, Boolean(added));
    await until(async () => (await thumb(added).count()) === 1);
    large = await show(added);
    const sides = await shownSides(large);
    step(
      "holding what was copied, not what the clipboard had before",
      isRed(sides.right) && isBlue(sides.left),
      JSON.stringify(sides),
    );
    await backToCamera();
  }

  // A second Copy during a slow one is refused, so that the slow one cannot land over it.
  await anotherProgramCopies();
  large = await show(first);
  await page.evaluate(() => {
    const real = navigator.clipboard.write.bind(navigator.clipboard);
    navigator.clipboard.write = async (items) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      delete navigator.clipboard.write;
      return real(items);
    };
  });
  await choose("Edit", "Copy");
  await choose("Edit", "Copy");
  step(
    "a second Copy during a slow one says to wait",
    await until(
      () => window.getByText("Wait for the last copy to finish first.").isVisible(),
      5_000,
    ),
  );
  await until(async () =>
    isRed((await clipboardPicture(page).catch(() => null))?.right ?? [0, 0, 0]),
  );
  await backToCamera();

  if (recordsMovies) {
    // What Finder copied holds over the picture Photo Booth left on the computer's clipboard, until
    // another program copies a picture of its own.
    large = await show(first);
    await choose("Edit", "Copy");
    await until(async () =>
      isRed((await clipboardPicture(page).catch(() => null))?.right ?? [0, 0, 0]),
    );
    await backToCamera();
    await thumb(clip).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Reveal in Finder", exact: true }).click();
    await bar.getByRole("menuitem", { name: "Go", exact: true }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(800);
    await openMenu("Edit");
    await page
      .getByRole("menuitem", { name: /^Copy\b/ })
      .first()
      .click();
    await page
      .locator('[data-window-id="finder"]')
      .getByRole("button", { name: "Close" })
      .first()
      .click();
    await page.waitForTimeout(500);
    const fromFinder = await pasteFrom(() => page.keyboard.press("Control+v"));
    step(
      "the Paste key brings what Finder copied",
      (await record(page, fromFinder))?.duration_ms > 0,
      String(fromFinder),
    );
    await until(async () => (await thumb(fromFinder).count()) === 1);
    await anotherProgramCopies();
    await bothPasteTheOtherPicture("a copy in Finder");
    await backToCamera();
  }
  const box = async (locator) =>
    locator.evaluate((each) => {
      const { width, height } = each.getBoundingClientRect();
      return { width: Math.round(width), height: Math.round(height) };
    });
  const size = await box(window);
  step(
    "the window opens at 720 by 562",
    size.width === 720 && size.height === 562,
    JSON.stringify(size),
  );
  await window.getByRole("button", { name: "Effects", exact: true }).click();
  const firstPreview = window.locator(".mac-photo-booth-preview").first();
  const small = await box(firstPreview);
  step(
    "its previews are the captured 236 by 156",
    small.width === 236 && small.height === 156,
    JSON.stringify(small),
  );
  await window.getByRole("button", { name: "Effects", exact: true }).click();
  await video.waitFor({ timeout: 10_000 });
  await choose("View", "Enter Full Screen");
  const viewport = page.viewportSize();
  const filled = await until(async () => {
    const now = await box(window);
    return now.width === viewport.width && now.height === viewport.height;
  });
  step("Enter Full Screen fills the page", filled, JSON.stringify(await box(window)));
  await page.waitForTimeout(800);
  const stage = await box(window.locator(".mac-photo-booth-stage"));
  const camera = await box(window.locator(".mac-photo-booth-frame video"));
  step(
    "the camera fills the stage",
    camera.width === stage.width &&
      camera.height === stage.height &&
      camera.width === viewport.width,
    JSON.stringify({ camera, stage }),
  );
  await shot(page, path.join(out, "photo-booth-rows-full-screen.png"));
  const wide = await take();
  const wideRecord = await record(page, wide);
  step(
    "a picture taken there has the stage's shape",
    Math.abs(wideRecord.width / wideRecord.height - stage.width / stage.height) < 0.02,
    `${wideRecord.width} by ${wideRecord.height}`,
  );
  await window.getByRole("button", { name: "Effects", exact: true }).click();
  const big = await box(firstPreview);
  step(
    "the previews share the full stage",
    Math.abs(big.width - (stage.width - 12) / 3) <= 1 &&
      Math.abs(big.height - (stage.height - 12) / 3) <= 1,
    JSON.stringify(big),
  );
  await window.getByRole("button", { name: "Effects", exact: true }).click();
  await page.keyboard.press("Control+Alt+f");
  step(
    "leaving full screen puts the window back at its size",
    await until(async () => {
      const now = await box(window);
      return now.width === 720 && now.height === 562;
    }),
    JSON.stringify(await box(window)),
  );
  step(
    "the View row reads Enter Full Screen again, undimmed",
    (await rowState("View", "Enter Full Screen")).dimmed === false,
  );

  const left = await library(page);
  step(
    "the restored pictures are still in the library",
    [first, second].every((id) => left.find((photo) => photo.id === id)?.deleted_ms === null),
  );
  // A read of the drive still on its way would be cut off by the end of the journey and counted as a
  // failed request.
  await page.waitForTimeout(1_500);
  await until(() => driveReads.size === 0);
});
