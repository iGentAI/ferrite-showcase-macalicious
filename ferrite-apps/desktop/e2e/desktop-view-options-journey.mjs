#!/usr/bin/env node
// The desktop's View Options on the signed-in person's drive: the window opens from the context menu,
// the View menu and Command-J, its choices change every icon, are kept across a reload and on the
// server, and icons on the grid stay in cells of their own when the grid grows.
//
//   node e2e/desktop-view-options-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("desktop-view-options");
const tag = Date.now().toString(36);
const TEXT = `Words ${tag}.txt`;
const PICTURE = `Dot ${tag}.png`;
const FOLDER = `Holder ${tag}`;
const TWO_LINES = `Long name ${tag}.txt`;
const VERY_LONG = `A name long enough to wrap over very many lines ${tag}.txt`;
// One red pixel.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "desktop", name: TEXT, type: "text/plain", text: "words" });
  await uploadFile(page, { parent: "desktop", name: TWO_LINES, type: "text/plain", text: "more" });
  await uploadFile(page, { parent: "desktop", name: VERY_LONG, type: "text/plain", text: "long" });
  await uploadFile(page, {
    parent: "desktop",
    name: PICTURE,
    type: "image/png",
    bytes: Buffer.from(PNG, "base64"),
  });
  const { json: made } = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "desktop", name: FOLDER }],
  });
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: made.created[0], name: "inside" }],
  });
  await reloadDesktop(page);

  const desk = page.getByRole("group", { name: "Desktop", exact: true });
  const icon = (name) => desk.locator(".mac-desktop-icon", { hasText: name }).first();
  await icon(TEXT).waitFor({ timeout: 10_000 });
  const panel = page.locator(".mac-desktop-shell-view-options");
  const stored = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[
      "desktop.viewOptions"
    ];
  const tileSize = async (name) =>
    (await icon(name).locator(".mac-desktop-icon-image").boundingBox()).width;

  const noOverlap = async () => {
    const boxes = await desk
      .locator(":scope > .mac-desktop-icon")
      .evaluateAll((all) => all.map((each) => each.getBoundingClientRect().toJSON()));
    return boxes.every((one, at) =>
      boxes.every(
        (other, otherAt) =>
          at >= otherAt ||
          one.right <= other.left ||
          other.right <= one.left ||
          one.bottom <= other.top ||
          other.bottom <= one.top,
      ),
    );
  };
  // From the context menu.
  const openMenu = async () => {
    const point = await page.evaluate(() => {
      const { width, height } = document
        .querySelector(".mac-desktop-shell-desktop")
        .getBoundingClientRect();
      return { x: width / 2 - 200, y: height / 2 - 250 };
    });
    await page.mouse.click(point.x, point.y, { button: "right" });
  };
  await openMenu();
  await page.getByRole("menuitem", { name: "Show View Options" }).click();
  await panel.waitFor({ timeout: 5_000 });
  step(
    "Show View Options in the desktop's menu opens the window titled Desktop",
    (await panel.innerText()).includes("Desktop"),
  );

  // Its title moves it.
  const panelAt = await panel.boundingBox();
  await page.mouse.move(panelAt.x + panelAt.width / 2, panelAt.y + 10);
  await page.mouse.down();
  await page.mouse.move(panelAt.x + panelAt.width / 2 + 60, panelAt.y + 90, { steps: 5 });
  await page.mouse.up();
  const panelMoved = await panel.boundingBox();
  step(
    "Dragging its title moves the window",
    Math.abs(panelMoved.x - panelAt.x - 60) < 2 && Math.abs(panelMoved.y - panelAt.y - 80) < 2,
    JSON.stringify(panelMoved),
  );

  // Icon size.
  const defaultSize = await tileSize(TEXT);
  const iconSlider = panel.getByRole("slider", { name: "Icon size" });
  await iconSlider.focus();
  for (let press = 0; press < 4; press += 1) await page.keyboard.press("ArrowRight");
  const grown = await until(async () => (await tileSize(TEXT)) === 80);
  step(
    "Icon size changes every tile",
    grown && defaultSize === 64,
    `${defaultSize} to ${await tileSize(TEXT)}`,
  );
  step("and the window says the size", (await panel.innerText()).includes("Icon size: 80 × 80"));

  // Grid spacing moves the cells apart.
  const top = async (name) => (await icon(name).boundingBox()).y;
  const pitch = async () => Math.abs((await top(PICTURE)) - (await top(FOLDER)));
  const pitchBefore = await pitch();
  const gridSlider = panel.getByRole("slider", { name: "Grid spacing" });
  await gridSlider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const spread = await until(async () => (await pitch()) > pitchBefore);
  step("Grid spacing moves the icons apart", spread, `${pitchBefore} to ${await pitch()}`);

  // Text size.
  await panel.getByRole("combobox", { name: "Text size" }).click();
  await page.getByRole("option", { name: "16", exact: true }).filter({ visible: true }).click();
  step(
    "Text size changes the names",
    await until(
      async () => (await icon(TEXT).evaluate((each) => getComputedStyle(each).fontSize)) === "16px",
    ),
  );

  // Item info.
  await panel.getByRole("checkbox", { name: "Show item info" }).click();
  step(
    "Show item info gives a folder its count",
    await until(async () => (await icon(FOLDER).innerText()).includes("1 item")),
    await icon(FOLDER).innerText(),
  );
  step(
    "and a file its size",
    await until(async () => (await icon(TEXT).innerText()).includes("5 bytes")),
    await icon(TEXT).innerText(),
  );

  // A name of two lines and its info fit the cell at every text size, and no icon lies on another.
  const fitsCell = (name) =>
    icon(name).evaluate((each) => {
      const info = each.querySelector(".mac-desktop-shell-item-info");
      const bottom = (info ?? each.querySelector(".mac-desktop-icon-label")).getBoundingClientRect()
        .bottom;
      return bottom <= each.getBoundingClientRect().bottom;
    });
  const staysInCell = (name) =>
    icon(name).evaluate(
      (each) =>
        each.getBoundingClientRect().height <=
        Number.parseFloat(
          getComputedStyle(each.parentElement).getPropertyValue("--mac-desktop-shell-cell-height"),
        ),
    );
  const atEveryTextSize = async (holds) => {
    const sizes = {};
    for (const size of ["10", "11", "12", "13", "14", "15", "16"]) {
      await panel.getByRole("combobox", { name: "Text size" }).click();
      await page.getByRole("option", { name: size, exact: true }).filter({ visible: true }).click();
      await page.getByRole("option").filter({ visible: true }).first().waitFor({ state: "hidden" });
      await until(
        async () =>
          (await icon(TWO_LINES).evaluate((each) => getComputedStyle(each).fontSize)) ===
          `${size}px`,
      );
      sizes[size] = (await holds()) && (await until(noOverlap));
    }
    return sizes;
  };
  const withInfo = await atEveryTextSize(
    async () =>
      (await fitsCell(TWO_LINES)) &&
      (await fitsCell(VERY_LONG)) &&
      (await icon(VERY_LONG).innerText()).includes("4 bytes") &&
      (await staysInCell(VERY_LONG)),
  );
  step(
    "A long name and its info fit the cell at every text size, overlapping nothing",
    Object.values(withInfo).every(Boolean),
    JSON.stringify(withInfo),
  );
  await panel.getByRole("checkbox", { name: "Show item info" }).click();
  await until(async () => !(await icon(FOLDER).innerText()).includes("1 item"));
  const withoutInfo = await atEveryTextSize(() => staysInCell(VERY_LONG));
  step(
    "Without item info a very long name stays in its cell at every text size",
    Object.values(withoutInfo).every(Boolean),
    JSON.stringify(withoutInfo),
  );
  await panel.getByRole("checkbox", { name: "Show item info" }).click();
  await until(async () => (await icon(FOLDER).innerText()).includes("1 item"));

  // Icon preview.
  const previewImage = icon(PICTURE).locator("img");
  step(
    "A picture shows its own bytes as its icon",
    await until(async () => (await previewImage.count()) === 1),
  );
  step(
    "and they are the picture's",
    await until(async () => (await previewImage.evaluate((img) => img.naturalWidth)) === 1),
  );
  await panel.getByRole("checkbox", { name: "Show icon preview" }).click();
  step(
    "Show icon preview off draws the plain icon",
    await until(async () => (await previewImage.count()) === 0),
  );

  // Label position.
  await panel.getByRole("radio", { name: "Right" }).click();
  step(
    "Label position Right puts the name beside the tile",
    await until(async () => {
      const tile = await icon(TEXT).locator(".mac-desktop-icon-image").boundingBox();
      const name = await icon(TEXT).locator(".mac-desktop-icon-label").boundingBox();
      return name.x >= tile.x + tile.width && name.y < tile.y + tile.height;
    }),
  );
  step(
    "and it fits the cell, overlapping nothing",
    (await fitsCell(TWO_LINES)) && (await until(noOverlap)),
  );
  await shot(page, path.join(out, `desktop-view-options-right-${browserName}.png`));

  // On the server and after a reload.
  const wanted = { icon: 80, grid: 16, text: 16, label: "right", info: true, preview: false };
  const saved = await until(async () => {
    const now = await stored();
    return Object.entries(wanted).every(([key, value]) => now?.[key] === value);
  });
  step("The choices are kept on the server", saved, JSON.stringify(await stored()));
  await reloadDesktop(page);
  await icon(TEXT).waitFor({ timeout: 10_000 });
  step(
    "and hold after a reload",
    await until(
      async () =>
        (await tileSize(TEXT)) === 80 &&
        (await icon(FOLDER).innerText()).includes("1 item") &&
        (await icon(TEXT).evaluate((each) => getComputedStyle(each).fontSize)) === "16px",
    ),
  );

  // Stack By and Sort By share the desktop's own settings.
  await page.mouse.move(5, 300);
  if (!(await panel.isVisible())) await page.keyboard.press("Control+j");
  await panel.waitFor({ timeout: 5_000 });
  step("Command-J on the desktop opens the window", await panel.isVisible());
  const sortBy = async (name) => {
    await panel.getByRole("combobox", { name: "Sort By" }).click();
    await page.getByRole("option", { name, exact: true }).filter({ visible: true }).click();
    await page.getByRole("option").filter({ visible: true }).first().waitFor({ state: "hidden" });
  };
  // The grid under the choices above: Label position Right at a tile of 80, spacing 16 and text of 16
  // with item info, as `cellOfView` reckons it, from the desktop's first cell.
  const CELL = { width: 240, height: 112 };
  const onTheGrid = async () => {
    const { json } = await api(page, "GET", "/api/system-preferences/settings");
    const { json: drive } = await api(page, "GET", "/api/files/");
    const places = json.values?.["desktop.iconPlaces"] ?? {};
    const inset = await desk.evaluate((each) =>
      Number.parseFloat(getComputedStyle(each).getPropertyValue("--mac-desktop-inset-top")),
    );
    const onDesk = (drive.entries ?? []).filter((entry) => entry.parent === "desktop");
    const whole = (value) => Math.abs(value - Math.round(value)) < 0.001;
    return (
      onDesk.length > 0 &&
      onDesk.every(({ id }) => {
        const place = places[id];
        return (
          place &&
          whole((place.right - 7.5) / CELL.width) &&
          whole((place.top - inset - 7.5) / CELL.height)
        );
      })
    );
  };
  await sortBy("None");
  const held = await icon(TEXT).boundingBox();
  await page.mouse.move(held.x + held.width / 2, held.y + 20);
  await page.mouse.down();
  await page.mouse.move(held.x + held.width / 2 - 170, held.y + 20 + 73, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(1_000);
  step("With Sort By None an icon dragged stays off the grid", !(await onTheGrid()));
  await sortBy("Snap to Grid");
  step("Sort By Snap to Grid from the window puts it back on the grid", await until(onTheGrid));
  step("on a cell of its own", await until(noOverlap));
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await icon(TEXT).waitFor({ timeout: 10_000 });
  step("and it stays there after a reload", await until(onTheGrid));
  await page.mouse.move(5, 300);
  if (!(await panel.isVisible())) await page.keyboard.press("Control+j");
  await panel.waitFor({ timeout: 5_000 });
  const menuGone = () =>
    page.getByRole("option").filter({ visible: true }).first().waitFor({ state: "hidden" });
  await panel.getByRole("combobox", { name: "Stack By" }).click();
  await page.getByRole("option", { name: "Kind", exact: true }).filter({ visible: true }).click();
  step(
    "Stack By gathers the icons into stacks",
    await until(async () => (await desk.locator(".mac-desktop-stack").count()) > 0),
  );
  await panel.getByRole("combobox", { name: "Stack By" }).click();
  await page.getByRole("option", { name: "None", exact: true }).filter({ visible: true }).click();
  await menuGone();
  await page.keyboard.press("Control+j");

  // The key closes it from inside the window too, then the View menu's row opens it.
  await page.waitForTimeout(200);
  const closed = (await panel.count()) === 0;
  await page.getByRole("menubar").getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Show View Options" }).last().click();
  step("The View menu's row opens it", closed && (await until(() => panel.isVisible())));

  // Files from the computer, let go on an icon.
  const dropOn = (name, file) =>
    icon(name).evaluate((element, fileName) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File(["dropped"], fileName, { type: "text/plain" }));
      const drop = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer });
      element.dispatchEvent(drop);
      return drop.defaultPrevented;
    }, file);
  const parentOf = async (name) =>
    ((await api(page, "GET", "/api/files/")).json.entries ?? []).find(
      (entry) => entry.name === name,
    )?.parent;
  const inFolder = `In folder ${tag}.txt`;
  const taken = await dropOn(FOLDER, inFolder);
  step(
    "A file let go on a folder's icon goes in the folder, and the browser does not open it",
    taken && (await until(async () => (await parentOf(inFolder)) === made.created[0])),
    String(await parentOf(inFolder)),
  );
  const onDesk = `On desk ${tag}.txt`;
  const taken2 = await dropOn(TEXT, onDesk);
  step(
    "A file let go on another file's icon goes on the Desktop",
    taken2 && (await until(async () => (await parentOf(onDesk)) === "desktop")),
    String(await parentOf(onDesk)),
  );
});
