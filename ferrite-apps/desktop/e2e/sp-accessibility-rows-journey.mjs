#!/usr/bin/env node
// Accessibility on a served desktop, row by row: Zoom scales the page around the pointer by its keys, its scroll
// gesture and its slider, keeps what is under the pointer, holds through a reload, and stops at off; Captions styles the
// subtitles of a real TV home video (a WebM recorded in the page, with a .vtt beside it), kept across a reload; Show
// Accessibility status in menu bar adds a menu whose toggles change the page; VoiceOver, Descriptions and the
// Motor and General groups say what a page can do. Exits 0 only when every step passed with no console error, page
// error, failed request or HTTP error.
//
//   node e2e/sp-accessibility-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import {
  api,
  journey,
  nextSave,
  openDesktop,
  openFromDock,
  reloadDesktop,
} from "./journey-kit.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const SETTINGS = "/api/system-preferences/settings";
const LIBRARY = "/api/tv/library";
const NAME = `Coast ${Date.now().toString(36)}`;
const SPOKEN = "Waves on the coast";

const upload = (page, name, type, make) =>
  page.evaluate(
    async ({ name, type, make }) => {
      // biome-ignore lint/security/noGlobalEval: the journey's own script, in its own browser
      const blob = await eval(make)();
      const json = { "content-type": "application/json" };
      const uploading = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent: "movies", name, size: blob.size, type, existing: "fail" }),
      }).then((reply) => reply.json());
      for (let index = 0; index < uploading.pieces; index += 1) {
        await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await blob
            .slice(index * uploading.piece_bytes, (index + 1) * uploading.piece_bytes)
            .arrayBuffer(),
        });
      }
      const done = await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      }).then((reply) => reply.json());
      return done.created[0];
    },
    { name, type, make },
  );

const MOVIE = `async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const context = canvas.getContext("2d");
  const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
  const parts = [];
  recorder.ondataavailable = (event) => parts.push(event.data);
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  const started = performance.now();
  while (performance.now() - started < 6000) {
    context.fillStyle = "hsl(" + Math.round((performance.now() - started) / 12) + " 60% 40%)";
    context.fillRect(0, 0, 320, 180);
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  recorder.stop();
  await stopped;
  return new Blob(parts, { type: "video/webm" });
}`;
const CUES = `async () => new Blob(["WEBVTT\\n\\n00:00.000 --> 01:00.000\\n${SPOKEN}\\n"], { type: "text/vtt" })`;

await journey("sp-accessibility-rows", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const window = page.locator('[data-window-id="system-preferences"]');
  const openPane = async () => {
    await page
      .getByRole("button", { name: /^System Preferences$/ })
      .first()
      .click();
    await window.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    if ((await window.getByRole("listbox", { name: "Accessibility features" }).count()) === 0) {
      await window.getByRole("button", { name: "Show All" }).click();
      await window
        .getByRole("button", { name: /^Accessibility/ })
        .first()
        .click();
    }
  };
  const category = (name) => window.getByRole("option", { name: new RegExp(`^${name}`) }).first();
  const saved = async (body) => {
    const save = nextSave(page, SETTINGS);
    await body();
    await save;
  };
  const scale = () =>
    page.evaluate(() => {
      const { transform } = getComputedStyle(document.documentElement);
      return transform === "none" ? 1 : Number(/matrix\(([\d.]+)/.exec(transform)?.[1]);
    });
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const barHeight = () =>
    page
      .locator(".mac-desktop-shell-menu-bar")
      .first()
      .evaluate((element) => element.getBoundingClientRect().height);

  await openPane();
  await category("Zoom").click();
  const before = await barHeight();
  const pointAt = { x: 900, y: 700 };
  await page.mouse.move(pointAt.x, pointAt.y);
  // The point of the window under the pointer, in the window's own unzoomed coordinates.
  const under = async () => {
    const corner = await window.evaluate((element) => {
      const { left, top } = element.getBoundingClientRect();
      return { left, top };
    });
    const zoom = await scale();
    return { x: (pointAt.x - corner.left) / zoom, y: (pointAt.y - corner.top) / zoom };
  };
  const wasUnder = await under();

  await page.keyboard.press("Meta+Alt+Equal");
  await page.waitForTimeout(200);
  step("before it is turned on, the key does nothing", near(await scale(), 1));

  await saved(() =>
    window.getByRole("checkbox", { name: "Use keyboard shortcuts to zoom" }).click(),
  );
  await saved(() => page.keyboard.press("Meta+Alt+Equal"));
  step("⌥⌘= zooms the page in", near(await scale(), 1.25), String(await scale()));
  step(
    "the menu bar grows with it",
    near(await barHeight(), before * 1.25),
    String(await barHeight()),
  );
  await saved(() => page.keyboard.press("Meta+Alt+Equal"));
  step("again, further", near(await scale(), 1.5625), String(await scale()));
  await saved(() => page.keyboard.press("Meta+Alt+Minus"));
  step("⌥⌘− zooms out", near(await scale(), 1.25), String(await scale()));
  const readout = await window.getByText(/^Zoom of this page: /).innerText();
  step("the pane shows the level the keys set", /125%/.test(readout), readout);
  await saved(() => page.keyboard.press("Meta+Alt+Digit8"));
  step("⌥⌘8 turns it off", near(await scale(), 1));
  await saved(() => page.keyboard.press("Meta+Alt+Digit8"));
  step("⌥⌘8 turns it back on at that level", near(await scale(), 1.25), String(await scale()));
  await saved(() => page.keyboard.press("Control+Alt+Equal"));
  step("Control stands for ⌘ off a Mac", near(await scale(), 1.5625), String(await scale()));

  await page.mouse.move(pointAt.x + 1, pointAt.y);
  await page.mouse.move(pointAt.x, pointAt.y);
  await page.waitForTimeout(100);
  const nowUnder = await under();
  step(
    "the pointer stays over the same point of the window",
    Math.abs(nowUnder.x - wasUnder.x) < 2 && Math.abs(nowUnder.y - wasUnder.y) < 2,
    JSON.stringify({ wasUnder, nowUnder }),
  );
  await page.screenshot({ path: path.join(out, "sp-accessibility-zoomed.png") });

  await reloadDesktop(page);
  step(
    "the level holds after a reload",
    await until(async () => near(await scale(), 1.5625), 8_000),
    String(await scale()),
  );
  await saved(() => page.keyboard.press("Meta+Alt+Digit8"));
  await openPane();
  await category("Zoom").click();

  await saved(() =>
    window.getByRole("checkbox", { name: "Scroll with the Control key held to zoom" }).click(),
  );
  await page.mouse.move(pointAt.x, pointAt.y);
  await page.mouse.wheel(0, -60);
  await page.waitForTimeout(200);
  step("a scroll without Control does not zoom", near(await scale(), 1));
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -60);
  await until(async () => (await scale()) > 1.1, 3_000);
  await page.keyboard.up("Control");
  await until(
    async () => (await api(page, "GET", SETTINGS)).json?.values?.["accessibility.zoomLevel"] > 1.1,
    5_000,
  );
  const wheeled = await scale();
  step("a scroll with Control zooms", wheeled > 1.1, String(wheeled));
  await saved(() => page.keyboard.press("Meta+Alt+Digit8"));
  const slider = window.getByRole("slider", { name: "Zoom of this page" });
  await slider.focus();
  await saved(() => page.keyboard.press("ArrowRight"));
  step("the slider zooms", near(await scale(), 1.25), String(await scale()));
  await saved(() => page.keyboard.press("ArrowLeft"));
  step("back to 100%, nothing is scaled", (await scale()) === 1);
  await page.screenshot({ path: path.join(out, "sp-accessibility-zoom-pane.png") });
  await saved(() =>
    window.getByRole("checkbox", { name: "Use keyboard shortcuts to zoom" }).click(),
  );
  await page.keyboard.press("Meta+Alt+Equal");
  await page.waitForTimeout(200);
  step("off, the key does nothing again", near(await scale(), 1));

  for (const [name, words] of [
    ["VoiceOver", /A web page cannot turn it on/],
    ["Descriptions", /Nothing on this desktop plays video with audio descriptions/],
    ["Voice Control", /A web page cannot turn it on/],
    ["Keyboard", /Sticky Keys and Slow Keys belong to your computer/],
    ["Pointer Control", /a web page cannot change it/],
    ["Switch Control", /A web page cannot turn it on/],
    ["Siri", /takes typed questions/],
    ["Shortcut", /a web page cannot choose what it does/],
  ]) {
    await category(name).scrollIntoViewIfNeeded();
    await category(name).click();
    step(`${name} says what a page can do`, await window.getByText(words).isVisible());
  }
  await page.screenshot({ path: path.join(out, "sp-accessibility-motor.png") });

  const box = window.getByRole("checkbox", { name: "Show Accessibility status in menu bar" });
  const extra = page
    .getByRole("menubar", { name: "Status menus" })
    .getByRole("button", { name: "Accessibility" })
    .or(
      page
        .getByRole("menubar", { name: "Status menus" })
        .getByRole("menuitem", { name: "Accessibility" }),
    );
  step("the extra is not in the menu bar until asked for", (await extra.count()) === 0);
  await saved(() => box.click());
  await extra.first().waitFor({ timeout: 5_000 });
  step("Show Accessibility status puts it in the menu bar", true);
  await reloadDesktop(page);
  await extra.first().waitFor({ timeout: 8_000 });
  step("it holds after a reload, with System Preferences unopened", true);
  await extra.first().click();
  await page.screenshot({ path: path.join(out, "sp-accessibility-extra.png") });
  await saved(() => page.getByRole("menuitemcheckbox", { name: "Use grayscale" }).click());
  const filter = () => page.evaluate(() => getComputedStyle(document.documentElement).filter);
  step("its Use grayscale changes the page", (await filter()) === "grayscale(1)", await filter());
  await extra.first().click();
  await saved(() => page.getByRole("menuitemcheckbox", { name: "Use grayscale" }).click());
  step("and back", (await filter()) === "none", await filter());
  await extra.first().click();
  await page.getByRole("menuitem", { name: "Open Accessibility Preferences…" }).click();
  await window.getByRole("listbox", { name: "Accessibility features" }).waitFor({ timeout: 8_000 });
  step("its Open Accessibility Preferences opens the pane", true);
  await saved(() => box.click());
  await until(async () => (await extra.count()) === 0, 3_000);
  step("unchecked, it leaves the menu bar", (await extra.count()) === 0);

  await category("Captions").click();
  const style = window.getByRole("combobox", { name: "Style for subtitles and captions" });
  await style.click();
  await saved(() => page.getByRole("option", { name: "Large Text", exact: true }).click());
  const captionStyle = () =>
    page.evaluate(() => document.documentElement.getAttribute("data-mac-caption-style"));
  step("Captions marks the page with the style", (await captionStyle()) === "large");
  await page.screenshot({ path: path.join(out, "sp-accessibility-captions.png") });

  const movie = await upload(page, `${NAME}.webm`, "video/webm", MOVIE);
  await upload(page, `${NAME}.en.vtt`, "text/vtt", CUES);
  const library = (await api(page, "GET", LIBRARY)).json;
  await api(page, "PUT", LIBRARY, {
    library: {
      ...(library.library ?? {
        videos: [],
        history: [],
        upNext: [],
        watchLater: [],
        positions: {},
      }),
      homeVideos: [...(library.library?.homeVideos ?? []), { id: movie, place: 0 }],
    },
    rev: library.rev,
  });

  await reloadDesktop(page);
  step(
    "the style holds after a reload",
    await until(async () => (await captionStyle()) === "large", 8_000),
  );
  const tv = await openFromDock(page, "TV");
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await tv.elementHandle(),
    {
      timeout: 15_000,
    },
  );
  await chooseMenu(page, "View", "Library");
  await tv.locator(".mac-card-grid-card", { hasText: NAME }).first().click();
  const video = tv.locator(".mac-tv-player-video video");
  await video.waitFor({ timeout: 8_000 });
  await until(() => video.evaluate((element) => element.readyState >= 1), 10_000);
  await chooseMenu(page, "Controls", "Subtitles", "en");
  step(
    "the subtitle's cue is showing",
    await until(
      () =>
        video.evaluate(
          (element, words) => element.textTracks[0]?.activeCues?.[0]?.text === words,
          SPOKEN,
        ),
      8_000,
    ),
  );
  // The player's own controls fade by themselves, so they are off for the comparison.
  await video.evaluate((element) => {
    element.pause();
    element.controls = false;
  });
  await page.waitForTimeout(500);
  const setStyle = async (style) => {
    await page.evaluate((name) => {
      if (name) document.documentElement.setAttribute("data-mac-caption-style", name);
      else document.documentElement.removeAttribute("data-mac-caption-style");
    }, style);
    await page.waitForTimeout(300);
  };
  const picture = await video.screenshot({ path: path.join(out, "sp-accessibility-large.png") });
  await setStyle(null);
  const plain = await video.screenshot({ path: path.join(out, "sp-accessibility-default.png") });
  await setStyle("large");
  const pictureAgain = await video.screenshot();
  step(
    "the same style over the still frame draws the same picture",
    picture.equals(pictureAgain),
    `${picture.length} and ${pictureAgain.length} bytes`,
  );
  step(
    "the subtitle over the home video is drawn differently",
    !picture.equals(plain),
    `${picture.length} and ${plain.length} bytes`,
  );
  await video.evaluate((element) => {
    element.textTracks[0].mode = "hidden";
  });
  await page.waitForTimeout(300);
  await setStyle(null);
  const noCue = await video.screenshot();
  step(
    "and the subtitle is what is drawn: without it the frame is neither picture",
    !noCue.equals(plain) && !noCue.equals(picture),
    `${noCue.length} bytes`,
  );
});
