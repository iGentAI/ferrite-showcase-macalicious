#!/usr/bin/env node
// Finder's picture and tag rows that were kept only in the window: Rotate Left saved over the file, read
// back in pixels after a reload; the Preview pane's Markup and More…; Favorite Tags in the menus.
//
//   node e2e/finder-picture-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-picture");
const tag = Date.now().toString(36);
const PICTURE = `Turn ${tag}.png`;
const SETTINGS = "/api/system-preferences/settings";

async function until(check, ms = 10_000) {
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
  const png = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 20;
    const context = canvas.getContext("2d");
    context.fillStyle = "#0000ff";
    context.fillRect(0, 0, 40, 20);
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 20, 20);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await uploadFile(page, {
    parent: "documents",
    name: PICTURE,
    type: "image/png",
    bytes: Buffer.from(png, "base64"),
  });
  /** What the drive holds: its size, and the colour of the bottom left corner. */
  const stored = () =>
    page.evaluate(async (picture) => {
      const drive = await (await fetch("/api/files/", { credentials: "same-origin" })).json();
      const entry = drive.entries.find((each) => each.name === picture && !each.trashed_ms);
      const reply = await fetch(
        `/api/files/content/${encodeURIComponent(entry.id)}?piece=0&count=8&version=${entry.version ?? 0}`,
        { credentials: "same-origin" },
      );
      const bitmap = await createImageBitmap(
        new Blob([await reply.arrayBuffer()], { type: "image/png" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const [r, , b] = context.getImageData(1, bitmap.height - 2, 1, 1).data;
      return { width: bitmap.width, height: bitmap.height, corner: r > b ? "red" : "blue" };
    }, PICTURE);

  const dock = page.getByRole("toolbar", { name: "Dock" });
  const win = page.locator(".mac-window.mac-finder").first();
  const openDocuments = async () => {
    await dock.getByRole("button", { name: "Finder" }).click();
    await win.waitFor({ timeout: 10_000 });
    await win.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  };
  const bar = page.getByRole("menubar").first();
  const menus = page.locator(".mac-menu");
  const menu = async (name) => {
    await bar.getByRole("menuitem", { name, exact: true }).click();
    await menus.first().waitFor({ timeout: 4_000 });
  };
  await openDocuments();
  await menu("View");
  await menus.first().getByRole("menuitemradio", { name: "as Gallery" }).click();
  await win.getByRole("option", { name: PICTURE, exact: true }).first().click();
  const pane = win.getByRole("region", { name: "Preview" });
  await pane.waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
  step("Before the turn the file is wide", (await stored()).width === 40);

  await pane.getByRole("button", { name: "Rotate Left" }).click();
  step(
    "Rotate Left in the Preview pane saves the turned picture over the file",
    await until(async () => {
      const now = await stored();
      return now.width === 20 && now.height === 40 && now.corner === "red";
    }),
    JSON.stringify(await stored()),
  );
  await shot(page, path.join(out, `finder-picture-turned-${browserName}.png`));
  await reloadDesktop(page);
  step("It is still turned after a reload", (await stored()).height === 40);

  // Quick Actions.
  await openDocuments();
  await win.getByRole("option", { name: PICTURE, exact: true }).first().click();
  await pane.getByRole("button", { name: "Markup" }).click();
  const look = page.locator(".mac-finder-quick-look").first();
  step("The pane's Markup opens Quick Look", await until(() => look.isVisible()));
  await page.keyboard.press("Escape");
  await until(async () => !(await look.isVisible()));
  await pane.getByRole("button", { name: "More…" }).click();
  const prefs = page.locator('[data-window-id="system-preferences"]');
  step("More… opens System Preferences", await until(() => prefs.isVisible()));
  await shot(page, path.join(out, `finder-picture-more-${browserName}.png`));
  await prefs.getByRole("button", { name: "Close", exact: true }).first().click();

  // Favorite Tags.
  await menu("Finder");
  await menus.first().getByRole("menuitem", { name: "Preferences…" }).click();
  const prefsWindow = page.locator('[data-window-id="finder:preferences"]');
  await prefsWindow.waitFor({ timeout: 5_000 });
  await prefsWindow.getByRole("tab", { name: "Tags" }).click();
  const redInMenus = prefsWindow.getByRole("checkbox", { name: "Red in menus" });
  await redInMenus.click();
  step(
    "A tag left out of Favorite Tags is kept on the server",
    await until(async () =>
      (await api(page, "GET", SETTINGS)).json.values?.["finder.hiddenMenuTags"]?.includes("Red"),
    ),
  );
  await shot(page, path.join(out, `finder-picture-favorites-${browserName}.png`));
  const redRow = () => menus.first().getByRole("menuitemcheckbox", { name: "Red", exact: true });
  const orangeRow = () =>
    menus.first().getByRole("menuitemcheckbox", { name: "Orange", exact: true });
  await menu("File");
  step(
    "File no longer lists it, and lists the others",
    (await redRow().count()) === 0 && (await orangeRow().count()) === 1,
  );
  await page.keyboard.press("Escape");
  await redInMenus.click();
  await until(
    async () =>
      !(await api(page, "GET", SETTINGS)).json.values?.["finder.hiddenMenuTags"]?.includes("Red"),
  );
  await menu("File");
  step("Put back, File lists it again", await until(async () => (await redRow().count()) === 1));
  await page.keyboard.press("Escape");
  await api(page, "POST", "/api/files/ops", {
    ops: (await api(page, "GET", "/api/files/")).json.entries
      .filter((each) => each.name === PICTURE && !each.trashed_ms)
      .map((each) => ({ op: "trash", id: each.id })),
  });
});
