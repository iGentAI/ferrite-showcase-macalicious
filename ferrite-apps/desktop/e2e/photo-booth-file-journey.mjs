#!/usr/bin/env node
// Photo Booth's File rows and Delete All on the desktop served by `ferrite dev`, as a guest of its
// own: File > Print lays out the picture shown, Reveal in Finder shows its file, and Edit > Delete All
// asks, then empties the strip into Photos' Recently Deleted. The camera is a stand-in, a canvas stream
// given at getUserMedia. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photo-booth-file-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photo-booth-file");
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
    (photo) => photo.source === "photo-booth",
  );

await run(async (page) => {
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    const draw = () => {
      context.fillStyle = "#308050";
      context.fillRect(0, 0, 640, 480);
    };
    setInterval(draw, 100);
    draw();
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(15);
  });
  await openDesktop(page, base, step);
  step("a guest of its own holds no pictures", (await booth(page)).length === 0);
  const held = (await api(page, "GET", LIBRARY)).json;
  if (!(held.installed ?? []).includes("photo-booth")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), "photo-booth"],
      rev: held.rev,
    });
  }
  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photo Booth");
  await field.press("Enter");
  const window = page.getByRole("region", { name: "Photo Booth", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await until(async () => !(await window.getAttribute("aria-busy")));
  await window.getByRole("button", { name: "Normal", exact: true }).first().click();
  const video = window.locator(".mac-photo-booth-frame video");
  await video.waitFor({ timeout: 10_000 });
  await until(() => video.evaluate((each) => each.videoWidth > 0));

  for (const count of [1, 2]) {
    await window.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
    await until(async () => (await booth(page)).length === count);
  }
  step("two pictures are kept", (await booth(page)).length === 2);
  const ids = (await booth(page)).map((photo) => photo.id);

  const bar = page.getByRole("menubar").first();
  const choose = async (menu, item) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).first().click();
  };
  await window.locator(`[data-picture-id="${ids[0]}"]`).click();
  await window.locator("img.mac-photo-booth-viewed").waitFor({ timeout: 10_000 });
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "photo-booth-file-menu.png"));
  await page.getByRole("menuitem", { name: "Print…", exact: true }).click();
  const printed = await until(() =>
    page.evaluate(() => {
      const frame = document.querySelector('iframe[aria-hidden="true"]');
      const images = [...(frame?.contentDocument?.images ?? [])];
      return images.length === 1 && images[0].naturalWidth > 0;
    }),
  );
  step("File > Print… lays out the picture shown", printed === true);
  await page.waitForTimeout(1_200);

  await choose("File", "Reveal in Finder");
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 15_000 });
  const chosen = (await booth(page)).find((photo) => photo.id === ids[0]);
  const entries = (await api(page, "GET", "/api/files/")).json.entries ?? [];
  const fileName = entries.find((each) => each.id === chosen?.file)?.name;
  const shownFile = await until(async () => {
    const selected = finder.getByRole("option", { selected: true });
    return (
      Boolean(fileName) &&
      (await selected.count()) === 1 &&
      (await finder.getByRole("option", { name: fileName, selected: true }).count()) === 1
    );
  });
  step("Reveal in Finder selects that picture's own file", shownFile === true, fileName);
  await finder.getByRole("button", { name: "Close", exact: true }).first().click();
  await window.click({ position: { x: 300, y: 10 } });

  await choose("Edit", "Delete All");
  const asked = page.getByRole("alertdialog");
  await asked.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "photo-booth-delete-all.png"));
  await asked.getByRole("button", { name: "Cancel", exact: true }).click();
  const kept = await booth(page);
  step(
    "Cancel keeps them",
    ids.every((id) => kept.find((each) => each.id === id)?.deleted_ms === null),
  );
  await choose("Edit", "Delete All");
  await asked.getByRole("button", { name: "Delete All", exact: true }).click();
  const emptied = await until(async () => {
    const photos = await booth(page);
    return ids.every((id) => {
      const photo = photos.find((each) => each.id === id);
      return photo !== undefined && photo.deleted_ms !== null;
    });
  });
  const strip = await until(
    async () => (await window.getByRole("button", { name: /^Photo \d+,/ }).count()) === 0,
  );
  step("Delete All empties the strip into Recently Deleted", emptied === true && strip === true);
});
