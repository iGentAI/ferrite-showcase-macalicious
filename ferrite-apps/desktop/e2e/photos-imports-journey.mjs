#!/usr/bin/env node
// Photos' Imports row on the desktop served by `ferrite dev`: photos imported together show under one heading naming
// when, and a click on the heading selects the batch. Pauses between batches are in photos-served-data.test.ts, since
// a journey cannot wait them out. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photos-imports-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-imports");
const tag = Date.now().toString(36);
const NAMES = ["First", "Second"].map((word) => `${word} ${tag}`);

await run(async (page) => {
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 30_000 });
  try {
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
    await win.getByRole("treeitem", { name: "Imports", exact: true }).click();
    const heading = win.locator(".mac-photos-group").first();
    await heading.locator(".mac-photos-group-title").waitFor({ timeout: 30_000 });
    await win
      .locator(".mac-photos-group")
      .first()
      .getByText("2 Photos", { exact: true })
      .waitFor({ timeout: 30_000 });
    const title = await heading.locator(".mac-photos-group-title").innerText();
    step("photos imported together show under when they came", / at \d/.test(title), title);
    await page.waitForTimeout(600);
    await heading.locator(".mac-photos-group-title button").click();
    await win.getByText("2 Photos Selected", { exact: true }).waitFor({ timeout: 5_000 });
    step("a click on the heading selects the batch", true);
    await shot(page, path.join(out, "photos-imports-batch.png"));
  } finally {
    const left = (await api(page, "GET", "/api/photos/library")).json;
    for (const each of (left.photos ?? []).filter((p) => NAMES.includes(p.name))) {
      await api(page, "DELETE", `/api/photos/photos/${each.id}`);
    }
  }
});
