#!/usr/bin/env node
// The desktop's icons stand where they are put, with real mouse drags on the signed-in person's drive:
// a moved icon stays there across a reload, Snap to Grid and Clean Up put icons on the grid, Clean Up By
// lays them out in order, a sort by name takes icons out of the person's hands, and a file dragged in
// from Finder lands where it was dropped.
//
//   node e2e/desktop-icons-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("desktop-icons");
const tag = Date.now().toString(36);
const A = `Aa ${tag}.txt`;
const B = `Bb ${tag}.txt`;
const C = `Cc ${tag}.txt`;
const D = `Dropped ${tag}.txt`;

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
  await uploadFile(page, { parent: "desktop", name: A, type: "text/plain", text: "a" });
  await uploadFile(page, { parent: "desktop", name: B, type: "text/plain", text: "bb" });
  await uploadFile(page, { parent: "desktop", name: C, type: "text/plain", text: "ccc" });
  await uploadFile(page, { parent: "documents", name: D, type: "text/plain", text: "d" });
  await reloadDesktop(page);

  const desk = page.getByRole("group", { name: "Desktop", exact: true });
  const icon = (name) => desk.locator(".mac-desktop-icon", { hasText: name }).first();
  const box = (name) => icon(name).boundingBox();
  await icon(C).waitFor({ timeout: 10_000 });

  const dragBy = async (name, dx, dy) => {
    const from = await box(name);
    const x = from.x + from.width / 2;
    const y = from.y + 30;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 10, y + 10, { steps: 3 });
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const near = (a, b) => Math.abs(a - b) < 2;

  // Starts in a column, down from the top right.
  const aFirst = await box(A);
  const bFirst = await box(B);
  step(
    "New icons fill down from the top right",
    near(aFirst.x, bFirst.x) && bFirst.y > aFirst.y,
    `${aFirst.x},${aFirst.y} then ${bFirst.x},${bFirst.y}`,
  );

  await dragBy(A, -317, 131);
  const moved = await until(async () => {
    const now = await box(A);
    return near(now.x, aFirst.x - 317) && near(now.y, aFirst.y + 131) ? now : null;
  });
  step("A dragged icon stays where it was let go", Boolean(moved), JSON.stringify(moved));
  step("and the others stay", near((await box(B)).x, bFirst.x) && near((await box(B)).y, bFirst.y));
  await shot(page, path.join(out, `desktop-icons-moved-${browserName}.png`));

  step(
    "The place is kept on the server",
    await until(async () => {
      const { json } = await api(page, "GET", "/api/system-preferences/settings");
      return Object.keys(json.values?.["desktop.iconPlaces"] ?? {}).length >= 3;
    }),
  );
  await reloadDesktop(page);
  await icon(A).waitFor({ timeout: 10_000 });
  const after = await until(async () => {
    const now = await box(A);
    return now && near(now.x, moved.x) && near(now.y, moved.y) ? now : null;
  });
  step("It is still there after a reload", Boolean(after), JSON.stringify(after));

  // In a window too small for where it stands, it shows at the edge and a drag starts from there.
  await dragBy(A, -850, 330);
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1000, height: 640 });
  await page.waitForTimeout(300);
  const clamped = await box(A);
  step(
    "A window too small for its place shows the icon inside it",
    clamped.x >= 0 && clamped.y + clamped.height <= 640,
    JSON.stringify(clamped),
  );
  await dragBy(A, 200, -120);
  const inward = await until(async () => {
    const now = await box(A);
    return near(now.x, clamped.x + 200) && near(now.y, clamped.y - 120) ? now : null;
  });
  step("A drag from there lands where it was let go", Boolean(inward), JSON.stringify(inward));
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  await icon(A).waitFor({ timeout: 10_000 });
  const kept = await until(async () => {
    const now = await box(A);
    return near(now.x, inward.x) && near(now.y, inward.y) ? now : null;
  });
  step("and stays there after a reload", Boolean(kept), JSON.stringify(kept));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  const menu = async () => {
    const point = await page.evaluate(() => {
      const root = document.querySelector(".mac-desktop-shell-desktop");
      const { width, height } = root.getBoundingClientRect();
      return { x: width / 2 - 200, y: height / 2 - 250 };
    });
    await page.mouse.click(point.x, point.y, { button: "right" });
    return page.getByRole("menu").first();
  };
  const sortBy = async (label) => {
    await menu();
    await page.getByRole("menuitem", { name: "Sort By", exact: true }).hover();
    await page.getByRole("menuitemradio", { name: label, exact: true }).click();
  };
  const cells = (place) => {
    const column = (place.right - 7.5) / 116;
    const row = (place.top - 29.5) / 112;
    return Math.abs(column - Math.round(column)) < 0.02 && Math.abs(row - Math.round(row)) < 0.02;
  };
  const placeOf = async (name) =>
    page.evaluate(
      ({ name }) => {
        const root = document.querySelector(".mac-desktop-shell-desktop");
        const whole = root.getBoundingClientRect();
        const item = [...root.querySelectorAll(".mac-desktop-icon")].find((each) =>
          each.textContent.includes(name),
        );
        const rect = item.getBoundingClientRect();
        return { right: whole.right - rect.right, top: rect.top - whole.top };
      },
      { name },
    );

  // Clean Up: back to the grid.
  await menu();
  await page.getByRole("menuitem", { name: "Clean Up", exact: true }).click();
  step(
    "Clean Up puts the icon on the grid",
    await until(async () => cells(await placeOf(A))),
    JSON.stringify(await placeOf(A)),
  );

  // Snap to Grid: a drag lands in a cell.
  await sortBy("Snap to Grid");
  await dragBy(B, -250, 90);
  const snapped = await until(async () => {
    const now = await box(B);
    return now.x < bFirst.x - 100 ? now : null;
  });
  step("With Snap to Grid a dragged icon moves", Boolean(snapped), JSON.stringify(snapped));
  step("and lands in a cell", cells(await placeOf(B)), JSON.stringify(await placeOf(B)));
  await shot(page, path.join(out, `desktop-icons-grid-${browserName}.png`));

  // Clean Up By Name: in order, from the top right.
  await menu();
  await page.getByRole("menuitem", { name: "Clean Up By", exact: true }).hover();
  await page.getByRole("menuitem", { name: "Name", exact: true }).click();
  step(
    "Clean Up By Name lays them out in order, in one column",
    await until(async () => {
      const [a, b, c] = await Promise.all([placeOf(A), placeOf(B), placeOf(C)]);
      return near(a.right, b.right) && near(b.right, c.right) && a.top < b.top && b.top < c.top;
    }),
  );

  // A window too small for them: each still shows, at a place of its own, and can be pressed.
  await page.waitForTimeout(400);
  const canPress = (names) =>
    page.evaluate((names) => {
      const root = document.querySelector(".mac-desktop-shell-desktop");
      return names.every((name) => {
        const icon = [...root.querySelectorAll(".mac-desktop-icon")].find((each) =>
          each.textContent.includes(name),
        );
        const box = icon.getBoundingClientRect();
        for (let x = box.left + 2; x < box.right; x += 3) {
          if (icon.contains(document.elementFromPoint(x, box.top + 20))) return true;
        }
        return false;
      });
    }, names);
  const apartAndInside = async (height) => {
    const boxes = await Promise.all([A, B, C].map((name) => box(name)));
    const apart =
      new Set(boxes.map((each) => `${Math.round(each.x)},${Math.round(each.y)}`)).size === 3;
    const inside = boxes.every((each) => each.x >= 0 && each.y >= 0 && each.y < height);
    return { ok: apart && inside && (await canPress([A, B, C])), boxes };
  };
  await page.setViewportSize({ width: 900, height: 200 });
  await page.waitForTimeout(400);
  const short = await apartAndInside(200);
  step(
    "In a window too short for them, each icon shows at a place of its own, and can be pressed",
    short.ok,
    JSON.stringify(short.boxes.map((each) => [each.x, each.y])),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);

  // Lower rows of a far column: past both edges once the window shrinks.
  for (const [index, name] of [A, B, C].entries()) {
    await dragBy(name, -1100, 240 + index * 20);
    await page.waitForTimeout(250);
  }
  await page.setViewportSize({ width: 900, height: 200 });
  await page.waitForTimeout(400);
  const far = await apartAndInside(200);
  step(
    "Lower rows of a far column stay apart too, and can be pressed",
    far.ok,
    JSON.stringify(far.boxes.map((each) => [each.x, each.y])),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // Two icons a point apart, not on the grid: past the window each still shows and is chosen alone.
  await sortBy("None");
  const dragTo = async (name, x, y) => {
    const from = await box(name);
    await dragBy(name, x - from.x, y - from.y);
    await until(async () => near((await box(name)).x, x));
  };
  await dragTo(A, 200, 420);
  await dragTo(B, 201, 420);
  const stored = await until(async () => {
    const { json } = await api(page, "GET", "/api/system-preferences/settings");
    const kept = Object.values(json.values?.["desktop.iconPlaces"] ?? {});
    const lefts = kept.map((each) => each.right).sort((a, b) => b - a);
    return lefts[0] - lefts[1] === 1;
  });
  step("Two icons stand a point apart, on the server", stored);
  await page.setViewportSize({ width: 900, height: 200 });
  await page.waitForTimeout(400);
  const [nearA, nearB] = await Promise.all([box(A), box(B)]);
  step(
    "Past the window they show at places of their own",
    !(near(nearA.x, nearB.x) && near(nearA.y, nearB.y)),
    JSON.stringify([nearA.x, nearA.y, nearB.x, nearB.y]),
  );
  const pressedOf = (name) => icon(name).getAttribute("aria-pressed");
  await icon(A).click();
  const firstAlone = (await pressedOf(A)) === "true" && (await pressedOf(B)) === "false";
  await icon(B).click();
  step(
    "and each can be chosen alone",
    firstAlone && (await pressedOf(B)) === "true" && (await pressedOf(A)) === "false",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  step(
    "A larger window shows them where they were put",
    near((await box(A)).x, 200) && near((await box(B)).x, 201),
  );
  await sortBy("Size");
  const before = await box(C);
  await dragBy(C, -300, 100);
  await page.waitForTimeout(400);
  const still = await box(C);
  step(
    "Sorted by Size, a drag does not move an icon",
    near(still.x, before.x) && near(still.y, before.y),
  );
  await menu();
  await page.getByRole("menuitem", { name: "Clean Up", exact: true }).waitFor({ timeout: 5_000 });
  step(
    "and Clean Up is dimmed",
    (await page
      .getByRole("menuitem", { name: "Clean Up", exact: true })
      .getAttribute("aria-disabled")) === "true" ||
      (await page
        .getByRole("menuitem", { name: "Clean Up", exact: true })
        .getAttribute("data-disabled")) !== null,
  );
  await page.keyboard.press("Escape");
  await sortBy("None");

  // A folder and a file dragged together, let go over the folder itself: they only move, and both
  // stay selected.
  const BOX = `Box ${tag}`;
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "desktop", name: BOX }],
  });
  await reloadDesktop(page);
  await icon(BOX).waitFor({ timeout: 10_000 });
  await icon(C).waitFor({ timeout: 10_000 });
  await icon(BOX).click();
  await icon(C).click({ modifiers: ["Control"] });
  const boxBefore = await box(BOX);
  const fileBefore = await box(C);
  await dragBy(BOX, -20, 20);
  const stayed = await until(
    async () =>
      near((await box(BOX)).x, boxBefore.x - 20) && near((await box(C)).x, fileBefore.x - 20),
  );
  const { json: afterDrag } = await api(page, "GET", "/api/files/");
  step(
    "Let go over a folder among the dragged items, the file stays on the desktop and all move",
    stayed && afterDrag.entries.find((each) => each.name === C)?.parent === "desktop",
    afterDrag.entries.find((each) => each.name === C)?.parent,
  );
  step(
    "and both stay selected",
    (await icon(BOX).getAttribute("aria-pressed")) === "true" &&
      (await icon(C).getAttribute("aria-pressed")) === "true",
  );
  await icon(BOX).focus();
  await page.keyboard.press("Space");
  step(
    "and Space after the drag still takes the folder out of the selection",
    await until(
      async () =>
        (await icon(BOX).getAttribute("aria-pressed")) === "false" &&
        (await icon(C).getAttribute("aria-pressed")) === "true",
    ),
  );

  // From Finder onto the desktop: where it was dropped.
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  const row = win.getByRole("option", { name: D, exact: true }).first();
  await row.waitFor({ timeout: 10_000 });
  const start = await row.boundingBox();
  const winBox = await win.boundingBox();
  const end = { x: winBox.x + winBox.width + 120, y: winBox.y + 140 };
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2 + 10, {
    steps: 3,
  });
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
  await icon(D).waitFor({ timeout: 10_000 });
  const landed = await until(async () => {
    const now = await box(D);
    return Math.abs(now.x + now.width / 2 - end.x) < 10 &&
      Math.abs(now.y + now.height / 2 - end.y) < 10
      ? now
      : null;
  });
  step("A file from Finder lands where it was dropped", Boolean(landed), JSON.stringify(landed));
  await shot(page, path.join(out, `desktop-icons-dropped-${browserName}.png`));

  // A full desktop: more icons than cells, and a real press chooses each one alone.
  const MANY = Array.from({ length: 16 }, (_, index) => `Many ${index} ${tag}.txt`);
  for (const name of MANY) {
    await uploadFile(page, { parent: "desktop", name, type: "text/plain", text: name });
  }
  await reloadDesktop(page);
  await icon(MANY[15]).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  // The Finder window comes back after the reload: out of the way of the desktop.
  const finderBack = page.locator(".mac-window.mac-finder").first();
  await finderBack.getByRole("button", { name: "Close" }).first().click();
  await finderBack.waitFor({ state: "detached", timeout: 5_000 });
  await page.setViewportSize({ width: 900, height: 400 });
  await page.waitForTimeout(500);
  const everyName = [A, B, C, D, ...MANY];
  const covered = [];
  for (const name of everyName) {
    const place = await box(name);
    await page.mouse.click(place.x + place.width - 3, place.y + 30);
    const alone =
      (await icon(name).getAttribute("aria-pressed")) === "true" &&
      (await desk.locator('.mac-desktop-icon[aria-pressed="true"]').count()) === 1;
    if (!alone) covered.push(name);
  }
  step(
    "On a full desktop each of 20 icons is chosen alone by a press",
    covered.length === 0,
    covered.join(", "),
  );
  const diskTakesPress = await page.evaluate(() => {
    const disk = [...document.querySelectorAll(".mac-desktop-icon")].find((each) =>
      each.textContent.includes("Macintosh SSD"),
    );
    const box = disk.getBoundingClientRect();
    return disk.contains(document.elementFromPoint(box.x + box.width / 2, box.y + 30));
  });
  step("and nothing lies over the disk", diskTakesPress);
  await shot(page, path.join(out, `desktop-icons-full-${browserName}.png`));
  await page.setViewportSize({ width: 1440, height: 900 });
});
