#!/usr/bin/env node
// Preview's Flip Horizontal and Flip Vertical on the desktop served by `ferrite dev`: a four-colour picture
// flips as the window shows it, turned or not, with marks going along; Undo takes a flip back; a text typed
// on a flipped picture reads rightly; Save writes all of it into the file, read back from the drive. Exits 0
// only with every step passed and no console or HTTP error.
//
//   node e2e/preview-flip-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("preview-flip");
const NAME = `Flip ${Date.now().toString(36)}.png`;
const LIBRARY = "/api/app-store/library";

// The picture, 200 by 100: red, green over blue, yellow.
const R = "red";
const G = "green";
const B = "blue";
const Y = "yellow";
const upright = [R, G, B, Y];

/** The colour at each quarter of a canvas or a bitmap, top left, top right, bottom left, bottom right. */
const quarters = (page, selector) =>
  page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    if (!canvas || canvas.width < 2) return [];
    const context = canvas.getContext("2d");
    return [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ].map(([x, y]) => {
      const [r, g, b] = context.getImageData(
        Math.floor(x * canvas.width),
        Math.floor(y * canvas.height),
        1,
        1,
      ).data;
      if (r > 200 && g > 200 && b < 80) return "yellow";
      if (r > 200) return "red";
      if (g > 200) return "green";
      if (b > 200) return "blue";
      return `${r},${g},${b}`;
    });
  }, selector);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const PAGE = '[data-page="1"] .mac-preview-app-page-canvas';
const MARKS = '[data-page="1"] .mac-preview-app-page-marks';

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** The box of a canvas's ink, as fractions of its size, and how much ink its columns hold at each end. */
const inkOf = (page, selector) =>
  page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    const { width, height } = canvas;
    const { data } = canvas.getContext("2d").getImageData(0, 0, width, height);
    const columns = new Array(width).fill(0);
    let top = height;
    let bottom = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y * width + x) * 4;
        // Black ink, leaving out the blue of a selection's dashes.
        if (data[at + 3] < 128 || data[at + 2] > 128) continue;
        columns[x] += 1;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    const left = columns.findIndex((count) => count > 0);
    const right = columns.findLastIndex((count) => count > 0);
    return {
      left: left / width,
      right: right / width,
      top: top / height,
      bottom: bottom / height,
      leftColumn: Math.max(...columns.slice(left, left + 2)),
      rightColumn: Math.max(...columns.slice(right - 1, right + 1)),
    };
  }, selector);

await run(async (page) => {
  await openDesktop(page, base, step);
  const picture = await page.evaluate(async (name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const draw = canvas.getContext("2d");
    for (const [x, y, colour] of [
      [0, 0, "#ff0000"],
      [100, 0, "#00ff00"],
      [0, 50, "#0000ff"],
      [100, 50, "#ffff00"],
    ]) {
      draw.fillStyle = colour;
      draw.fillRect(x, y, 100, 50);
    }
    const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
    const json = { "content-type": "application/json" };
    const uploading = await fetch("/api/files/uploads", {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: JSON.stringify({
        parent: "pictures",
        name,
        size: blob.size,
        type: blob.type,
        existing: "fail",
      }),
    }).then((response) => response.json());
    await fetch(`/api/files/uploads/${uploading.upload}/0`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/octet-stream" },
      body: await blob.arrayBuffer(),
    });
    const done = await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: "{}",
    }).then((response) => response.json());
    return done.created[0];
  }, NAME);

  const library = (await api(page, "GET", LIBRARY)).json;
  if (!(library.installed ?? []).includes("preview")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(library.installed ?? []), "preview"],
      rev: library.rev,
    });
  }
  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Preview");
  await field.press("Enter");
  const preview = page.locator(".mac-preview-app").first();
  await preview.waitFor({ state: "visible", timeout: 15_000 });
  const dialog = page.getByRole("dialog", { name: "Open" });
  if (!(await dialog.isVisible().catch(() => false))) {
    await preview.getByRole("button", { name: "Open…" }).first().click();
  }
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await dialog.getByRole("option", { name: NAME }).dblclick({ timeout: 10_000 });

  const shows = (wanted) => until(async () => same(await quarters(page, PAGE), wanted));
  step("the picture opens as drawn", await shows(upright), JSON.stringify(upright));
  await page.waitForFunction(
    () => document.querySelector(".mac-preview-app")?.getAttribute("aria-busy") !== "true",
    undefined,
    { timeout: 20_000 },
  );

  const choose = async (menu, item) => {
    await page.getByRole("menuitem", { name: menu, exact: true }).first().click();
    await page.getByRole("menuitem", { name: item, exact: true }).first().click();
  };
  const title = () => preview.locator(".mac-title-bar-title-text").first().textContent();

  await choose("Tools", "Flip Horizontal");
  step(
    "Flip Horizontal swaps left and right",
    await shows([G, R, Y, B]),
    JSON.stringify(await quarters(page, PAGE)),
  );
  step("the title says the picture is edited", (await title()).includes("Edited"));
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "preview-flipped.png"));

  await choose("Tools", "Flip Vertical");
  step("Flip Vertical then swaps top and bottom", await shows([Y, B, G, R]));
  await choose("Edit", "Undo");
  step("Undo takes one flip back", await shows([G, R, Y, B]));
  await choose("Edit", "Undo");
  step("Undo takes the other back, and the title drops Edited", await shows(upright));
  step("the picture is no longer edited", !(await title()).includes("Edited"));

  // Turned a quarter, the same row flips what the window shows: the picture's top and bottom.
  await choose("Tools", "Rotate Right");
  const turned = await until(async () => {
    const now = await quarters(page, PAGE);
    return same(now, [B, R, Y, G]) ? now : false;
  });
  step("Rotate Right turns it", Boolean(turned), JSON.stringify(turned));
  await choose("Tools", "Flip Horizontal");
  step(
    "Flip Horizontal on a turned picture swaps left and right as shown",
    await shows([R, B, G, Y]),
  );
  await choose("Edit", "Undo");
  await shows([B, R, Y, G]);
  await choose("Edit", "Undo");
  await shows(upright);

  await preview.getByRole("button", { name: "Show Markup Toolbar" }).click();
  const toolbar = page.getByRole("toolbar", { name: "Markup" });
  const onPage = async ([x, y], [toX, toY]) => {
    const box = await page.locator(MARKS).first().boundingBox();
    await page.mouse.move(box.x + x * box.width, box.y + y * box.height);
    await page.mouse.down();
    for (let at = 1; at <= 6; at += 1) {
      await page.mouse.move(
        box.x + (x + ((toX - x) * at) / 6) * box.width,
        box.y + (y + ((toY - y) * at) / 6) * box.height,
      );
    }
    await page.mouse.up();
  };

  // A shape on the left goes to the right with its picture.
  await toolbar.getByRole("button", { name: "Shapes" }).click();
  await page.getByRole("menuitem", { name: "Rectangle", exact: true }).click();
  await onPage([0.1, 0.2], [0.3, 0.4]);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const shapeBefore = await inkOf(page, MARKS);
  await choose("Tools", "Flip Horizontal");
  await shows([G, R, Y, B]);
  await page.waitForTimeout(400);
  const shapeAfter = await inkOf(page, MARKS);
  step(
    "a mark goes with the picture",
    shapeBefore.right < 0.5 && shapeAfter.left > 0.5,
    JSON.stringify({ shapeBefore, shapeAfter }),
  );
  await choose("Edit", "Undo");
  await shows(upright);
  await choose("Edit", "Undo");
  await page.waitForTimeout(400);

  // Typed on a flipped picture, an F has its stem on the left, where it was typed.
  await choose("Tools", "Flip Horizontal");
  await shows([G, R, Y, B]);
  await toolbar.getByRole("button", { name: "Text", exact: true }).click();
  await onPage([0.2, 0.2], [0.2, 0.2]);
  const typing = preview.getByRole("textbox", { name: "Text" });
  await typing.waitFor({ timeout: 5_000 });
  await typing.fill("F");
  const kept = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === `/api/preview/markup/${picture}`,
    { timeout: 15_000 },
  );
  await typing.press("Enter");
  const saved = await kept;
  step("the server keeps a text typed on a mirrored view", saved.status() === 200);
  const stored = (await api(page, "GET", `/api/preview/markup/${picture}`)).json.markup;
  step(
    "the stored text says it was typed mirrored",
    stored?.pages?.[0]?.items?.[0]?.mirrored === true,
    JSON.stringify(stored?.pages?.[0]?.items?.[0]),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const ink = await inkOf(page, MARKS);
  step(
    "a text typed on a flipped picture reads rightly, from where it was typed",
    Math.abs(ink.left - 0.2) < 0.03 &&
      Math.abs(ink.top - 0.2) < 0.06 &&
      ink.leftColumn > ink.rightColumn * 2,
    JSON.stringify(ink),
  );
  await shot(page, path.join(out, "preview-flipped-text.png"));

  // Save draws all of it into the file.
  await choose("File", "Save");
  await page.getByText(`Saved “${NAME}”.`).waitFor({ timeout: 15_000 });
  const entries = (await api(page, "GET", "/api/files/")).json.entries ?? [];
  const file = entries.find(
    (entry) => entry.name === NAME && entry.parent === "pictures" && entry.trashed_ms === undefined,
  );
  const back = await page.evaluate(async (id) => {
    const response = await fetch(`/api/files/content/${encodeURIComponent(id)}?piece=0&count=8`, {
      credentials: "same-origin",
    });
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.id = "flip-read-back";
    canvas.style.display = "none";
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    document.body.append(canvas);
    return { width: bitmap.width, height: bitmap.height };
  }, file?.id);
  const fileColours = await quarters(page, "#flip-read-back");
  await page.evaluate(() => document.querySelector("#flip-read-back").remove());
  step(
    "Save writes the flip into the file, read back from the drive",
    back.width === 200 && back.height === 100 && same(fileColours, [G, R, Y, B]),
    JSON.stringify({ back, fileColours }),
  );
});
