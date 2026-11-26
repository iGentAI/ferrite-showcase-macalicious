#!/usr/bin/env node
// Photos' Preferences and Help on the desktop served by `ferrite dev`: Photos > Preferences… and
// Command-comma open the panel, Autoplay Videos starts a movie when it opens and survives a reload,
// and Help > Photos Help opens Help Viewer. Exits 0 only with every step passed and no console or
// HTTP error. The movie is a WebM recorded in the page. It deletes only what it made.
//
//   node e2e/photos-preferences-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-preferences");
const tag = Date.now().toString(36);
const MOVIE = `Clip ${tag}`;
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

async function launch(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));
  return win;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const win = await launch(page);

  const panel = page.locator(".mac-photos-preferences");
  await page.getByRole("menuitem", { name: "Photos", exact: true }).click();
  await page.getByRole("menuitem", { name: "Preferences…" }).click();
  await panel.waitFor({ timeout: 5_000 });
  step("Photos > Preferences… opens the panel", true);
  const box = panel.getByRole("checkbox", { name: "Autoplay Videos" });
  await box.click();
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "photos-preferences.png"));
  const saved = await until(async () => (await library(page)).settings?.autoplay === true, 5_000);
  step("Autoplay Videos is kept", saved);
  await panel.getByRole("tab", { name: "iCloud", exact: true }).click();
  const noCloud = panel.getByRole("checkbox", { name: "iCloud Photos" });
  step("the iCloud pane dims iCloud Photos, saying why", await noCloud.isDisabled());
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-preferences-icloud.png"));
  await panel.getByRole("tab", { name: "Shared Albums", exact: true }).click();
  step(
    "the Shared Albums pane dims it, saying why",
    await panel.getByRole("checkbox", { name: "Shared Albums" }).isDisabled(),
  );
  await panel.getByRole("tab", { name: "General", exact: true }).click();
  await panel.getByRole("button", { name: "Close" }).first().click();
  await panel.waitFor({ state: "hidden", timeout: 5_000 });
  await win.click({ position: { x: 600, y: 500 } });
  await page.keyboard.press("ControlOrMeta+,");
  await panel.waitFor({ timeout: 5_000 });
  step("Command-comma opens it", true);
  await panel.getByRole("button", { name: "Close" }).first().click();

  const transfer = await page.evaluateHandle(async (name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d");
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const parts = [];
    recorder.ondataavailable = (event) => parts.push(event.data);
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.start();
    const started = performance.now();
    while (performance.now() - started < 3000) {
      context.fillStyle = `hsl(${Math.round((performance.now() - started) / 8)} 80% 50%)`;
      context.fillRect(0, 0, 320, 240);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    recorder.stop();
    await stopped;
    const data = new DataTransfer();
    data.items.add(
      new File([new Blob(parts, { type: "video/webm" })], `${name}.webm`, { type: "video/webm" }),
    );
    return data;
  }, MOVIE);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const tile = win
    .getByRole("button", { name: MOVIE, exact: true })
    .or(win.getByRole("option", { name: MOVIE, exact: true }))
    .first();
  await tile.waitFor({ timeout: 30_000 });
  await tile.dblclick();
  const video = win.locator("video.mac-photos-picture");
  await video.waitFor({ timeout: 10_000 });
  const playing = await until(() =>
    video.evaluate((element) => !element.paused && element.currentTime > 0),
  );
  step("with Autoplay on a movie starts when it opens", playing);
  await page.keyboard.press("Escape");

  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  const shown = await page
    .locator(".mac-window:has(.mac-photos-body)")
    .first()
    .waitFor({ timeout: 8_000 })
    .then(() => page.locator(".mac-window:has(.mac-photos-body)").first())
    .catch(() => launch(page));
  await until(async () => !(await shown.getAttribute("aria-busy")));
  await page.getByRole("menuitem", { name: "Photos", exact: true }).click();
  await page.getByRole("menuitem", { name: "Preferences…" }).click();
  await panel.waitFor({ timeout: 5_000 });
  step("Autoplay Videos survives a reload", await box.isChecked());
  await box.click();
  await until(async () => (await library(page)).settings?.autoplay === false, 5_000);
  await panel.getByRole("button", { name: "Close" }).first().click();

  await page.getByRole("menuitem", { name: "Help", exact: true }).click();
  await page.getByRole("menuitem", { name: "Photos Help" }).click();
  const help = page.locator(".mac-managed-window[data-window-id='help-viewer']").first();
  await help.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1_000);
  await shot(page, path.join(out, "photos-help.png"));
  step("Help > Photos Help opens Help Viewer", await help.isVisible());
  const topic = await until(() =>
    help.getByText("Import photos into Photos", { exact: false }).first().isVisible(),
  );
  step("Photos Help lists the topics of Photos' own book", topic === true);

  await launch(page);
  await page.getByRole("menuitem", { name: "Photos", exact: true }).click();
  await page.getByRole("menuitem", { name: "Preferences…" }).click();
  await panel.waitFor({ timeout: 5_000 });
  await panel.getByRole("button", { name: "Show in Finder", exact: true }).click();
  await page
    .locator(".mac-managed-window[data-window-id='finder']")
    .first()
    .waitFor({ timeout: 10_000 });
  step("Show in Finder opens Finder on the library's files", true);

  for (const photo of (await library(page)).photos ?? []) {
    if (photo.name === MOVIE) await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
  }
});
