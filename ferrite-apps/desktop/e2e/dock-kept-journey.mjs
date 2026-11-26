#!/usr/bin/env node
// Keeping folders and files in the Dock, on the signed-in person's desktop: Finder's Add to Dock and
// a drop on the divider, a file's tile opening it, a folder's stack, both surviving a reload, Remove
// from Dock, and the divider's menu with the Dock's hiding, position and preferences. It runs as a
// Guest User in a browser of its own (`openDesktop`), whose settings and files end with it.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/dock-kept-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { driveOps, uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("dock-kept");
const tag = Date.now().toString(36);
const NOTE = `Kept note ${tag}.txt`;
const OTHER = `Kept other ${tag}.txt`;
const FOLDER = `Kept folder ${tag}`;
const SECOND = `Second folder ${tag}`;
const INSIDE = `Inside ${tag}.txt`;

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
  const note = await uploadFile(page, {
    parent: "documents",
    name: NOTE,
    type: "text/plain",
    text: "words",
  });
  await uploadFile(page, {
    parent: "documents",
    name: OTHER,
    type: "text/plain",
    text: "words",
  });
  const made = await driveOps(page, [
    { op: "mkdir", parent: "documents", name: FOLDER },
    { op: "mkdir", parent: "documents", name: SECOND },
  ]);
  const entries = (await api(page, "GET", "/api/files/")).json.entries;
  const folder = entries.find((each) => each.name === FOLDER)?.id;
  const second = entries.find((each) => each.name === SECOND)?.id;
  await uploadFile(page, { parent: folder, name: INSIDE, type: "text/plain", text: "inside" });
  step("A file and a folder on the drive", made === 200 && Boolean(folder));
  await page.reload();
  await openDesktop(page, base, step);

  const dock = page.getByRole("toolbar", { name: "Dock" });
  const tile = (name) => dock.getByRole("button", { name, exact: true });
  const bar = page.getByRole("menubar").first();
  const closed = () => until(async () => (await page.getByRole("menu").count()) === 0, 3_000);
  const choose = async (title, row) => {
    await bar.getByRole("menuitem", { name: title, exact: true }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: row, exact: true }).click();
    await closed();
  };
  await tile("Finder").click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  await choose("Go", "Documents");
  const item = (name) => win.getByRole("option", { name, exact: true });
  await item(NOTE).waitFor({ timeout: 8_000 });

  await item(NOTE).click();
  await item(FOLDER).click({ modifiers: ["Control"] });
  await item(SECOND).click({ modifiers: ["Control"] });
  await choose("File", "Add to Dock");
  step(
    "File > Add to Dock puts the file and the folder in the Dock",
    await until(async () => (await tile(NOTE).count()) === 1 && (await tile(FOLDER).count()) === 1),
  );
  await shot(page, path.join(out, `dock-kept-tiles-${browserName}.png`));

  const box = await item(OTHER).boundingBox();
  const divider = await dock.getByRole("separator").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 12, { steps: 4 });
  await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  step(
    "A file dropped on the divider joins them",
    await until(async () => (await tile(OTHER).count()) === 1),
  );

  // Kept for the person.
  await until(async () => {
    const { json } = await api(page, "GET", "/api/system-preferences/settings");
    return json?.values?.["dock.kept"]?.length === 4;
  });
  await page.reload();
  await openDesktop(page, base, step);
  await tile(NOTE).waitFor({ timeout: 10_000 });
  step("They are in the Dock after a reload", (await tile(FOLDER).count()) === 1);

  await tile(NOTE).click();
  const editor = page.locator('[data-window-id="textedit"]');
  step(
    "A file's tile opens that file",
    await editor
      .getByText(NOTE, { exact: false })
      .first()
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await shot(page, path.join(out, `dock-kept-opened-${browserName}.png`));

  await tile(FOLDER).click();
  const inside = page.getByText(INSIDE, { exact: true }).first();
  const shownInStack = await inside.waitFor({ timeout: 8_000 }).then(
    () => true,
    () => false,
  );
  const box2 = shownInStack ? await inside.boundingBox() : null;
  step(
    "A folder's tile fans out what it holds",
    shownInStack && box2 !== null && box2.y > 0 && box2.y < page.viewportSize().height,
  );
  // The fan's opening animation, for the picture.
  await page.waitForTimeout(600);
  await shot(page, path.join(out, `dock-kept-stack-${browserName}.png`));
  await page.keyboard.press("Escape");

  // Each folder keeps how it shows on its own.
  await tile(FOLDER).click({ button: "right" });
  await page.getByRole("menuitem", { name: "View content as", exact: true }).hover();
  await page.getByRole("menuitemradio", { name: "Grid", exact: true }).click();
  await closed();
  await tile(SECOND).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Sort by", exact: true }).hover();
  await page.getByRole("menuitemradio", { name: "Name", exact: true }).click();
  await closed();
  const kept = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json?.values ?? {};
  const eachItsOwn = async () => {
    const values = await kept();
    return (
      values[`dock.kept.${folder}.view`] === "grid" &&
      values[`dock.kept.${folder}.sort`] === undefined &&
      values[`dock.kept.${second}.sort`] === "name" &&
      values[`dock.kept.${second}.view`] === undefined
    );
  };
  step("Each kept folder keeps its own view and sort", await until(eachItsOwn));
  await page.reload();
  await openDesktop(page, base, step);
  await tile(FOLDER).click();
  step(
    "and shows them after a reload",
    await page
      .locator('[data-view="grid"]')
      .first()
      .waitFor({ state: "attached", timeout: 8_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await page.keyboard.press("Escape");

  await tile(NOTE).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove from Dock", exact: true }).click();
  await closed();
  step(
    "Remove from Dock takes the tile away",
    await until(async () => (await tile(NOTE).count()) === 0),
  );
  const left = (await api(page, "GET", "/api/files/")).json.entries.find(
    (each) => each.id === note,
  );
  step("and leaves the file where it is", Boolean(left) && left.trashed_ms === undefined);

  // The divider's menu.
  const setting = async (key) =>
    (await api(page, "GET", "/api/system-preferences/settings")).json?.values?.[key];
  await dock.getByRole("separator").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Position on Screen", exact: true }).hover();
  await shot(page, path.join(out, `dock-kept-divider-${browserName}.png`));
  await page.getByRole("menuitemradio", { name: "Left", exact: true }).click();
  await closed();
  step(
    "The divider's menu moves the Dock, on the server",
    await until(async () => (await setting("dock.position")) === "left"),
  );
  await dock.getByRole("separator").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Turn Hiding On", exact: true }).click();
  await closed();
  step(
    "and turns its hiding on",
    await until(async () => (await setting("dock.autohide")) === true),
  );
});
