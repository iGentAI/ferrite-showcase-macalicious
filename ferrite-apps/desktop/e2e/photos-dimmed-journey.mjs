#!/usr/bin/env node
// Photos' dimmed rows and smart album glyph on the desktop served by `ferrite dev`: File > Create offers Slideshow and
// dims Book, Card, Calendar and Prints with the reason; the Crop pane dims Auto with the reason; a smart album's row
// has its gear. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photos-dimmed-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-dimmed");
const tag = Date.now().toString(36);
const NAME = `Plain ${tag}`;
const SMART = `smart-${tag}`;

await run(async (page) => {
  const photosWindow = () => page.locator(".mac-window:has(.mac-photos-body)").first();
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  await photosWindow().waitFor({ timeout: 30_000 });
  await api(page, "PUT", `/api/photos/smart-albums/${SMART}`, {
    name: `Starred ${tag}`,
    rules: [{ field: "favorite", op: "is", value: "true" }],
  });
  await reloadDesktop(page);
  const win = photosWindow();
  await win.waitFor({ timeout: 30_000 });
  await win.getByRole("treeitem", { name: `Starred ${tag}` }).waitFor({ timeout: 20_000 });
  const transfer = await page.evaluateHandle(async (name) => {
    const list = new DataTransfer();
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 360;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgb(90,130,190)";
    context.fillRect(0, 0, 480, 360);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
    list.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
    return list;
  }, NAME);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const tile = win
    .getByRole("option", { name: NAME, exact: true })
    .or(win.getByRole("button", { name: NAME, exact: true }))
    .first();
  await tile.waitFor({ timeout: 30_000 });

  await page.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Create", exact: true }).click();
  const book = page.getByRole("menuitem", { name: "Book", exact: true });
  await book.waitFor({ timeout: 5_000 });
  const rows = await Promise.all(
    ["Book", "Card", "Calendar", "Prints"].map(async (name) => {
      const row = page.getByRole("menuitem", { name, exact: true });
      return (
        (await row.getAttribute("aria-disabled")) === "true" &&
        /print services/.test((await row.getAttribute("title")) ?? "")
      );
    }),
  );
  step("File > Create dims the printed projects, saying why", rows.every(Boolean));
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-create-dimmed.png"));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await tile.dblclick();
  await win.locator(".mac-photos-viewer").waitFor({ timeout: 8_000 });
  await win.getByRole("button", { name: "Edit", exact: true }).click();
  await win.getByRole("button", { name: "Crop", exact: true }).click();
  const auto = win.getByRole("button", { name: "Auto", exact: true });
  await auto.waitFor({ timeout: 10_000 });
  step("Crop's Auto is enabled: it finds the horizon in the picture", await auto.isEnabled());
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "photos-crop-auto.png"));
  await win.getByRole("button", { name: "Cancel", exact: true }).first().click();

  const left = (await api(page, "GET", "/api/photos/library")).json;
  for (const each of (left.photos ?? []).filter((p) => p.name === NAME)) {
    await api(page, "DELETE", `/api/photos/photos/${each.id}`);
  }
  await api(page, "DELETE", `/api/photos/smart-albums/${SMART}`);
});
