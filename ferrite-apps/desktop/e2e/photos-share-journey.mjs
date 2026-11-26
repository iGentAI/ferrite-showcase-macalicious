#!/usr/bin/env node
// Finder's Share menu hands pictures to Photos on the desktop served by `ferrite dev`: Add to Photos
// with Photos closed opens it and imports once its library has loaded, and again with Photos open.
// Exits 0 only with every step passed and no console or HTTP error. Pictures are JPEGs drawn in the
// page and uploaded to the drive's Documents folder. It deletes only what it made.
//
//   node e2e/photos-share-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-share");
const tag = Date.now().toString(36);
const CLOSED = `Closed ${tag}`;
const OPEN = `Open ${tag}`;
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

const uploadPicture = (page, name) =>
  page.evaluate(async (name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d");
    context.fillStyle = "#3a7";
    context.fillRect(0, 0, 320, 240);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
    const json = { "content-type": "application/json" };
    const uploading = await fetch("/api/files/uploads", {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: JSON.stringify({
        parent: "documents",
        name,
        size: blob.size,
        type: blob.type,
        existing: "fail",
      }),
    }).then((response) => response.json());
    for (let index = 0; index < uploading.pieces; index += 1) {
      const piece = blob.slice(index * uploading.piece_bytes, (index + 1) * uploading.piece_bytes);
      const put = await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: await piece.arrayBuffer(),
      });
      if (!put.ok) throw new Error(`piece ${index}: ${put.status}`);
    }
    const done = await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: "{}",
    }).then((response) => response.json());
    return done.created[0];
  }, name);

await run(async (page) => {
  await openDesktop(page, base, step);
  const made = [
    await uploadPicture(page, `${CLOSED}.jpg`),
    await uploadPicture(page, `${OPEN}.jpg`),
  ];
  const dock = (name) => page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name });
  await dock("Finder").click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();

  const share = async (name) => {
    const file = finder.getByRole("option", { name: `${name}.jpg`, exact: true }).first();
    await file.waitFor({ timeout: 10_000 });
    await file.click();
    await finder.getByRole("button", { name: "Share" }).click();
    await page.getByRole("menuitem", { name: "Add to Photos" }).click();
  };
  const imported = (name) =>
    until(async () => (await library(page)).photos?.find((photo) => photo.name === name));

  await share(CLOSED);
  const first = await imported(CLOSED);
  step("Add to Photos with Photos closed opens it and imports", Boolean(first), first?.name);
  const photos = page.locator(".mac-window:has(.mac-photos-body)").first();
  await photos.waitFor({ timeout: 10_000 });

  await dock("Finder").click();
  await page.waitForTimeout(200);
  await share(OPEN);
  const second = await imported(OPEN);
  step("Add to Photos with Photos open imports", Boolean(second), second?.name);
  await photos
    .getByRole("button", { name: OPEN, exact: true })
    .or(photos.getByRole("option", { name: OPEN, exact: true }))
    .first()
    .waitFor({ timeout: 10_000 });
  step("the shared picture shows in the window", true);
  await page.waitForTimeout(600);
  await shot(page, path.join(out, "photos-share-done.png"));

  for (const photo of [first, second]) {
    if (photo) await api(page, "DELETE", `/api/photos/photos/${photo.id}`);
  }
  const ours = made.filter(Boolean);
  if (ours.length > 0) {
    await api(page, "POST", "/api/files/ops", { ops: ours.map((id) => ({ op: "delete", id })) });
  }
});
