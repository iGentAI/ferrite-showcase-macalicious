#!/usr/bin/env node
// Photos' editor tools that read the picture on the desktop served by `ferrite dev`: White Balance's Neutral Gray and
// Skin Tone eyedroppers, the black, gray and white eyedroppers of Curves, the Selective Color eyedropper, and Crop's
// Vertical and Horizontal perspective. Each is proved on the pixels of the saved edit: Done, a reload, the photo opened
// in the editor again and its canvas read, with the recipe read back from the server. Revert to Original clears each.
// Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photos-edit-tools-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("photos-edit-tools");
const NAME = `Tools ${Date.now().toString(36)}`;
const WIDTH = 480;
const HEIGHT = 360;
const CELL = 120;

// A picture of plain cells, 120 pixels each, by [column, row]: a warm gray, a cool skin, plain colours, the three tones.
const CELLS = {
  warmGray: [0, 0, [150, 128, 105]],
  coolSkin: [1, 0, [190, 170, 165]],
  blue: [2, 0, [40, 60, 210]],
  green: [3, 0, [40, 180, 60]],
  dark: [0, 1, [30, 24, 20]],
  middle: [1, 1, [130, 120, 100]],
  light: [2, 1, [235, 228, 215]],
  red: [3, 1, [210, 40, 40]],
  gray: [0, 2, [128, 128, 128]],
  charcoal: [1, 2, [70, 70, 70]],
  cream: [2, 2, [240, 230, 190]],
  teal: [3, 2, [20, 150, 150]],
};
const centre = (name) => {
  const [column, row] = CELLS[name];
  return [(column + 0.5) / 4, (row + 0.5) / 3];
};

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

const near = (pixel, want, by = 8) =>
  pixel.length === 3 && want.every((value, at) => Math.abs(pixel[at] - value) <= by);
const spread = (pixel) => Math.max(...pixel) - Math.min(...pixel);
// Blue's saturation at -1 leaves a little colour: the cell's hue, 233 degrees, is not the range's centre.
const BLUE_GRAYED = 30;

await run(async (page) => {
  await openDesktop(page, base, step);

  // A reload cuts off whatever the app is still reading, which the journey would count as a failure.
  let reading = 0;
  const isRead = (request) =>
    new URL(request.url()).pathname.startsWith("/api/") && !request.url().includes("/live/");
  page.on("request", (request) => {
    if (isRead(request)) reading += 1;
  });
  for (const done of ["requestfinished", "requestfailed"]) {
    page.on(done, (request) => {
      if (isRead(request)) reading -= 1;
    });
  }
  const settled = async () => {
    await until(() => reading <= 0);
    await page.waitForTimeout(400);
    await until(() => reading <= 0);
  };

  const openPhotos = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("Photos");
    await field.press("Enter");
    const win = page.locator(".mac-window:has(.mac-photos-body)").first();
    await win.waitFor({ timeout: 30_000 });
    return win;
  };
  let win = await openPhotos();

  const transfer = await page.evaluateHandle(
    async ({ name, cells, cell, width, height }) => {
      const list = new DataTransfer();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      for (const [column, row, [r, g, b]] of Object.values(cells)) {
        context.fillStyle = `rgb(${r},${g},${b})`;
        context.fillRect(column * cell, row * cell, cell, cell);
      }
      const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
      list.items.add(new File([blob], `${name}.png`, { type: "image/png" }));
      return list;
    },
    { name: NAME, cells: CELLS, cell: CELL, width: WIDTH, height: HEIGHT },
  );
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
  const tile = () =>
    win
      .getByRole("option", { name: NAME, exact: true })
      .or(win.getByRole("button", { name: NAME, exact: true }))
      .first();
  await tile().waitFor({ timeout: 30_000 });

  const saved = async () =>
    ((await api(page, "GET", "/api/photos/library")).json.photos ?? []).find(
      (each) => each.name === NAME,
    );
  const inEditor = async () => win.getByRole("slider", { name: "Exposure" }).first().isVisible();
  const showAdjust = async () => {
    await win.getByRole("slider", { name: "Exposure" }).first().waitFor({ timeout: 15_000 });
  };
  /** The photo opened from the grid or as it was left, in the Edit view. */
  const edit = async () => {
    if (await inEditor()) return;
    if (!(await win.locator(".mac-photos-viewer").isVisible())) {
      await tile().dblclick();
      await win.locator(".mac-photos-viewer").waitFor({ timeout: 10_000 });
    }
    await win.getByRole("button", { name: "Edit", exact: true }).click();
    await showAdjust();
    await win.locator(".mac-photos-edit-canvas").waitFor({ timeout: 8_000 });
  };
  /** The canvas's own pixel at a fraction of it, read from the 3 by 3 around it. */
  const at = ([x, y]) =>
    win.locator(".mac-photos-edit-canvas").evaluate(
      (canvas, where) => {
        const px = Math.round(canvas.width * where[0]);
        const py = Math.round(canvas.height * where[1]);
        return [...canvas.getContext("2d").getImageData(px, py, 1, 1).data].slice(0, 3);
      },
      [x, y],
    );
  const cell = (name) => at(centre(name));
  /** The eyedropper's click, at a fraction of the picture. */
  const clickPicture = async ([x, y]) => {
    const layer = win.locator(".mac-photos-spot-layer");
    await layer.waitFor({ timeout: 5_000 });
    const box = await layer.boundingBox();
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  };
  const dropper = async (section, label, where) => {
    const button = section.getByRole("button", { name: label, exact: true });
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const pressed = await button.getAttribute("aria-pressed");
    await clickPicture(where);
    return pressed;
  };
  /** Done, a reload, and the photo in the editor again: what is drawn now comes from what was saved. */
  const saveAndReopen = async () => {
    await win.getByRole("button", { name: "Done", exact: true }).click();
    await until(async () => !(await inEditor()));
    await until(async () => (await saved())?.edit);
    await settled();
    await reloadDesktop(page);
    win = await openPhotos();
    await tile()
      .waitFor({ timeout: 30_000 })
      .catch(() => {});
    await edit();
  };
  /** Revert to Original, then the editor again: the picture and the server's edit are as imported. */
  const revertAndCheck = async (label, checks) => {
    await win.getByRole("button", { name: "Revert to Original", exact: true }).first().click();
    const cleared = await until(
      async () => (await saved())?.edit === null || !(await saved())?.edit,
    );
    await until(async () => !(await inEditor()));
    await edit();
    const pixels = {};
    for (const name of checks) pixels[name] = await cell(name);
    const same = checks.every((name) => near(pixels[name], CELLS[name][2], 6));
    step(
      `${label}: Revert to Original clears it`,
      cleared === true && same,
      JSON.stringify(pixels),
    );
  };

  await edit();
  for (const name of Object.keys(CELLS)) {
    const pixel = await cell(name);
    if (!near(pixel, CELLS[name][2], 6)) {
      step(`the picture shows ${name} as drawn`, false, JSON.stringify(pixel));
    }
  }
  step(
    "the picture opens in the editor as drawn",
    near(await cell("warmGray"), [150, 128, 105], 6),
  );

  // Row 1: White Balance.
  let balance = win.locator('section[aria-label="White Balance"]');
  const pressed = await dropper(balance, "Neutral Gray eyedropper", centre("warmGray"));
  step("the eyedropper shows as held while it is", pressed === "true");
  await until(async () => spread(await cell("warmGray")) < 8);
  const neutral = await cell("warmGray");
  step(
    "the Neutral Gray eyedropper grays the pixel clicked",
    spread(neutral) < 8,
    JSON.stringify(neutral),
  );
  const putDown = await win.locator(".mac-photos-spot-layer").count();
  step("the eyedropper is put down by its click", putDown === 0);
  const coolBefore = await cell("coolSkin");
  await saveAndReopen();
  const neutralRecipe = (await saved())?.edit?.adjust;
  const kept = await until(
    async () => spread(await cell("warmGray")) < 8 && (await cell("warmGray")),
  );
  step(
    "Neutral Gray's Warmth and Tint survive Done and a reload, on the pixels",
    Boolean(kept) && neutralRecipe?.warmth < -0.7 && neutralRecipe?.warmth > -1,
    JSON.stringify({ kept, warmth: neutralRecipe?.warmth, tint: neutralRecipe?.tint }),
  );

  balance = win.locator('section[aria-label="White Balance"]');
  await balance.getByRole("combobox", { name: "White Balance mode" }).click();
  await page.getByRole("option", { name: "Skin Tone" }).click();
  await dropper(balance, "Skin Tone eyedropper", centre("coolSkin"));
  const skinCheck = (pixel) => {
    const mean = (pixel[0] + pixel[1] + pixel[2]) / 3;
    return Math.abs((pixel[0] - pixel[2]) / mean - 0.405) < 0.06;
  };
  await until(async () => skinCheck(await cell("coolSkin")));
  const skinned = await cell("coolSkin");
  step(
    "the Skin Tone eyedropper brings the pixel clicked to the colour of skin",
    skinCheck(skinned) && skinned[0] - skinned[2] > coolBefore[0] - coolBefore[2] + 20,
    JSON.stringify({ coolBefore, skinned }),
  );
  await balance.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "photos-white-balance-eyedropper.png"));
  await saveAndReopen();
  const skinRecipe = (await saved())?.edit?.adjust;
  const skinKept = await until(async () => skinCheck(await cell("coolSkin")));
  step(
    "Skin Tone's Warmth and Tint survive Done and a reload, on the pixels",
    skinKept === true && skinRecipe?.warmth > 0.7,
    JSON.stringify({
      warmth: skinRecipe?.warmth,
      tint: skinRecipe?.tint,
      at: await cell("coolSkin"),
    }),
  );
  await revertAndCheck("White Balance", ["warmGray", "coolSkin"]);

  balance = win.locator('section[aria-label="White Balance"]');
  await balance.getByRole("combobox", { name: "White Balance mode" }).click();
  await page.getByRole("option", { name: "Skin Tone" }).click();
  await balance.getByRole("button", { name: "Auto", exact: true }).click();
  const wholeSkin = await until(async () => !near(await cell("gray"), CELLS.gray[2], 4));
  step("the Skin Tone button goes by the skin colours of the whole picture", wholeSkin === true);
  await win.getByRole("button", { name: "Reset Adjustments", exact: true }).click();
  await until(async () => near(await cell("gray"), CELLS.gray[2], 3));

  // Row 2: Curves.
  let curves = win.locator('section[aria-label="Curves"]');
  await dropper(curves, "Curves black eyedropper", centre("dark"));
  await until(async () => spread(await cell("dark")) < 6 && (await cell("dark"))[0] < 6);
  const black = await cell("dark");
  step(
    "the black eyedropper takes the pixel clicked to black",
    near(black, [0, 0, 0], 5),
    JSON.stringify(black),
  );
  await dropper(curves, "Curves white eyedropper", centre("light"));
  await until(async () => (await cell("light"))[2] > 249);
  const white = await cell("light");
  step(
    "the white eyedropper takes the pixel clicked to white",
    near(white, [255, 255, 255], 5),
    JSON.stringify(white),
  );
  await dropper(curves, "Curves gray eyedropper", centre("middle"));
  await until(async () => spread(await cell("middle")) < 6);
  const grayed = await cell("middle");
  step(
    "the gray eyedropper takes the pixel clicked to gray",
    spread(grayed) < 6,
    JSON.stringify(grayed),
  );
  const stillBlack = await cell("dark");
  step(
    "the black point holds after the others",
    near(stillBlack, [0, 0, 0], 5),
    JSON.stringify(stillBlack),
  );
  await curves.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "photos-curves-eyedroppers.png"));
  await saveAndReopen();
  const toneRecipe = (await saved())?.edit?.channels;
  const each = ["red", "green", "blue"].map((colour) => toneRecipe?.[colour]?.curve ?? []);
  step(
    "each colour keeps its own three points, by the pixel's own values",
    each.every((points) => points.length === 3) &&
      Math.abs(each[0][1][0] - 130 / 255) < 0.02 &&
      Math.abs(each[1][1][0] - 120 / 255) < 0.02 &&
      Math.abs(each[2][1][0] - 100 / 255) < 0.02 &&
      Math.abs(each[0][1][1] - each[2][1][1]) < 0.01,
    JSON.stringify(each),
  );
  const curvesKept = await until(
    async () => spread(await cell("middle")) < 6 && near(await cell("dark"), [0, 0, 0], 5),
  );
  step(
    "the curves survive Done and a reload, on the pixels",
    curvesKept === true,
    JSON.stringify(await cell("middle")),
  );
  await revertAndCheck("Curves", ["dark", "middle", "light"]);

  curves = win.locator('section[aria-label="Curves"]');
  await curves.getByRole("combobox", { name: "Curves channel" }).click();
  await page.getByRole("option", { name: "Red", exact: true }).click();
  await dropper(curves, "Curves white eyedropper", centre("middle"));
  await until(async () => (await cell("middle"))[0] > 245);
  const redOnly = await cell("middle");
  step(
    "with Red chosen an eyedropper moves red alone",
    redOnly[0] > 245 && Math.abs(redOnly[1] - 120) < 6 && Math.abs(redOnly[2] - 100) < 6,
    JSON.stringify(redOnly),
  );
  await curves.getByRole("button", { name: "Reset Curve", exact: true }).click();
  await until(async () => near(await cell("middle"), CELLS.middle[2], 4));
  await curves.getByRole("combobox", { name: "Curves channel" }).click();
  await page.getByRole("option", { name: "RGB", exact: true }).click();

  // Row 3: Selective Color.
  let selective = win.locator('section[aria-label="Selective Color"]');
  await selective.getByRole("radio", { name: "Red", exact: true }).click();
  await dropper(selective, "Selective Color eyedropper", centre("green"));
  const greenChosen = await until(async () =>
    selective.getByRole("radio", { name: "Green", exact: true }).isChecked(),
  );
  step("the eyedropper picks the swatch of the pixel's hue", greenChosen === true);
  await dropper(selective, "Selective Color eyedropper", centre("gray"));
  const noted = await until(async () => selective.getByRole("status").isVisible());
  const stayed = await selective.getByRole("radio", { name: "Green", exact: true }).isChecked();
  step("on a gray pixel it says so and keeps the swatch", noted === true && stayed === true);
  await dropper(selective, "Selective Color eyedropper", centre("blue"));
  await until(async () => selective.getByRole("radio", { name: "Blue", exact: true }).isChecked());
  const stillGreen = await selective.getByRole("radio", { name: "Green", exact: true }).isChecked();
  const sat = selective.getByRole("slider", { name: "Selective Color Saturation" });
  await sat.focus();
  await page.keyboard.press("Home");
  await until(async () => spread(await cell("blue")) < BLUE_GRAYED);
  const blueGray = await cell("blue");
  const greenLeft = await cell("green");
  step(
    "the slider then works on the range picked: blue grays, green stays",
    !stillGreen && spread(blueGray) < BLUE_GRAYED && near(greenLeft, CELLS.green[2], 6),
    JSON.stringify({ blueGray, greenLeft }),
  );
  await selective.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "photos-selective-eyedropper.png"));
  await saveAndReopen();
  const selectiveRecipe = (await saved())?.edit?.selective;
  const selectiveKept = await until(async () => spread(await cell("blue")) < BLUE_GRAYED);
  step(
    "the range's shift survives Done and a reload, on the pixels",
    selectiveKept === true && selectiveRecipe?.blue?.saturation === -1,
    JSON.stringify(selectiveRecipe),
  );
  await revertAndCheck("Selective Color", ["blue", "green"]);
  selective = null;

  // Row 4: Perspective, read off where the cells' lines lie.
  const tab = (name) =>
    win
      .getByRole("radio", { name, exact: true })
      .or(win.getByRole("button", { name, exact: true }))
      .first();
  await tab("Crop").click();
  const vertical = win.getByRole("slider", { name: "Vertical", exact: true });
  const horizontal = win.getByRole("slider", { name: "Horizontal", exact: true });
  await vertical.waitFor({ timeout: 8_000 });
  /** Where a line lies: the first change of colour along a row (`across`) or a column, as a fraction. */
  const lineAt = (across, fraction) =>
    win.locator(".mac-photos-edit-canvas").evaluate(
      (canvas, { along, where }) => {
        const { width, height } = canvas;
        const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
        const size = along ? width : height;
        const pixel = (step) => {
          const px = along ? step : Math.round((width - 1) * where);
          const py = along ? Math.round((height - 1) * where) : step;
          const offset = (py * width + px) * 4;
          return [data[offset], data[offset + 1], data[offset + 2]];
        };
        const first = pixel(2);
        for (let step = 3; step < size; step += 1) {
          const now = pixel(step);
          if (
            Math.abs(now[0] - first[0]) +
              Math.abs(now[1] - first[1]) +
              Math.abs(now[2] - first[2]) >
            30
          ) {
            return step / size;
          }
        }
        return 1;
      },
      { along: across, where: fraction },
    );
  const flat = {
    top: await lineAt(true, 0.02),
    bottom: await lineAt(true, 0.98),
    left: await lineAt(false, 0.02),
    right: await lineAt(false, 0.98),
  };
  step(
    "the picture's lines start square",
    Math.abs(flat.top - flat.bottom) < 0.01 && Math.abs(flat.left - flat.right) < 0.01,
    JSON.stringify(flat),
  );
  await vertical.focus();
  for (let press = 0; press < 30; press += 1) await page.keyboard.press("ArrowRight");
  const leaned = () => lineAt(true, 0.98);
  await until(async () => (await leaned()) < flat.bottom - 0.03);
  const tall = { top: await lineAt(true, 0.02), bottom: await leaned() };
  step(
    "Vertical leans the upright lines: narrower at the top",
    tall.top - tall.bottom > 0.04,
    JSON.stringify(tall),
  );
  await horizontal.focus();
  for (let press = 0; press < 30; press += 1) await page.keyboard.press("ArrowLeft");
  await until(
    async () => Math.abs((await lineAt(false, 0.02)) - (await lineAt(false, 0.98))) > 0.025,
  );
  const wide = { left: await lineAt(false, 0.02), right: await lineAt(false, 0.98) };
  step(
    "Horizontal leans the level lines",
    Math.abs(wide.left - wide.right) > 0.025,
    JSON.stringify(wide),
  );
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "photos-perspective.png"));
  const seen = {
    top: await lineAt(true, 0.02),
    bottom: await lineAt(true, 0.98),
    left: await lineAt(false, 0.02),
    right: await lineAt(false, 0.98),
  };
  await saveAndReopen();
  const tilted = (await saved())?.edit;
  await tab("Crop").click();
  await vertical.waitFor({ timeout: 8_000 }).catch(() => {});
  step(
    "the server keeps Vertical and Horizontal",
    Math.abs(tilted?.vertical - 0.3) < 0.006 && Math.abs(tilted?.horizontal + 0.3) < 0.006,
    JSON.stringify({ vertical: tilted?.vertical, horizontal: tilted?.horizontal }),
  );
  await until(async () => Math.abs((await lineAt(false, 0.02)) - seen.left) < 0.02);
  const again = {
    top: await lineAt(true, 0.02),
    bottom: await lineAt(true, 0.98),
    left: await lineAt(false, 0.02),
    right: await lineAt(false, 0.98),
  };
  step(
    "perspective survives Done and a reload, on the pixels",
    Object.keys(seen).every((key) => Math.abs(seen[key] - again[key]) < 0.02),
    JSON.stringify({ seen, again }),
  );
  const sliderBack = await win
    .getByRole("slider", { name: "Vertical", exact: true })
    .evaluate((slider) => slider.getAttribute("aria-valuenow") ?? slider.value);
  step(
    "the Vertical slider reads what was saved",
    Math.abs(Number(sliderBack) - 0.3) < 0.006,
    String(sliderBack),
  );
  await win.getByRole("button", { name: "Revert to Original", exact: true }).first().click();
  const clearedTilt = await until(async () => !(await saved())?.edit);
  await until(async () => !(await inEditor()));
  await edit();
  await tab("Crop").click();
  await win.getByRole("slider", { name: "Vertical", exact: true }).waitFor({ timeout: 8_000 });
  const square = {
    top: await lineAt(true, 0.02),
    bottom: await lineAt(true, 0.98),
  };
  step(
    "Perspective: Revert to Original clears it",
    clearedTilt === true && Math.abs(square.top - square.bottom) < 0.01,
    JSON.stringify(square),
  );
  await win.getByRole("button", { name: "Cancel", exact: true }).first().click();

  const left = (await saved())?.id;
  if (left) await api(page, "DELETE", `/api/photos/photos/${left}`);
});
