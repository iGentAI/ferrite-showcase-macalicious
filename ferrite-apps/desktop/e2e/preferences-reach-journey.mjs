#!/usr/bin/env node
// System Preferences reached from outside it, and the Desktop pane's sources: Spotlight finds a pane and opens
// it, the Dock icon's menu names the panes, Colors colours the desktop and is still there after a reload, a
// folder dragged from Finder joins Folders and shows its pictures, and a picture dragged onto the well becomes
// the desktop picture. Exits 0 only when every step passed with no console error or failed request.
//
//   node e2e/preferences-reach-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";
import { openWithSpotlight } from "./system-kit.mjs";

/** A real picture on the drive: one small PNG drawn in the page and put through the upload routes. */
const uploadPicture = (page, parent, name) =>
  page.evaluate(
    async ({ parent, name }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 40;
      const context = canvas.getContext("2d");
      context.fillStyle = "#c23b22";
      context.fillRect(0, 0, 64, 40);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size: blob.size, type: "image/png" }),
      });
      const { upload } = await started.json();
      await fetch(`/api/files/uploads/${upload}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: blob,
      });
      await fetch(`/api/files/uploads/${upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
    },
    { parent, name },
  );

const drag = async (page, from, to) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
};
const middle = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

await journey("preferences-reach", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const win = page.locator('[data-window-id="system-preferences"]');

  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Trackpad");
  const result = page
    .getByRole("group", { name: /^(?:System Preferences|Top Hit)$/ })
    .getByText("Trackpad");
  await result.waitFor({ timeout: 5_000 });
  await page.screenshot({ path: path.join(out, "preferences-spotlight.png") });
  await field.press("Enter");
  await win.locator('[data-pane="trackpad"]').waitFor({ timeout: 10_000 });
  step("Spotlight lists Trackpad under System Preferences and Return opens the pane", true);

  const tile = page.getByRole("button", { name: "System Preferences" }).last();
  await tile.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "System Preferences" });
  await menu.waitFor({ timeout: 5_000 });
  await page.screenshot({ path: path.join(out, "preferences-dock-menu.png") });
  await menu.getByRole("menuitem", { name: "Sound", exact: true }).click();
  await win.locator('[data-pane="sound"]').waitFor({ timeout: 10_000 });
  step("the Dock icon's menu names the panes and goes to one", true);

  await win.getByRole("button", { name: "Show All" }).click();
  await win.getByRole("button", { name: "Desktop & Screen Saver" }).click();
  const sources = win.getByRole("treegrid", { name: "Picture sources" });
  await sources.getByText("Colors").click();
  await win.getByRole("button", { name: "Teal" }).click();
  await page.waitForTimeout(1_200);
  const shownPicture = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".mac-desktop-shell-picture img")]
        .map((image) => decodeURIComponent(image.src))
        .join(" "),
    );
  const coloured = await shownPicture();
  step("a colour becomes the desktop picture", coloured.includes("#1b7c86"), coloured.slice(0, 60));
  await page.screenshot({ path: path.join(out, "preferences-colors.png") });
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1_500);
  step("and stays after a reload", (await shownPicture()).includes("#1b7c86"));

  const folder = await page.evaluate(async () => {
    const reply = await fetch("/api/files/ops", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ops: [{ op: "mkdir", parent: "documents", name: "Walls" }] }),
    });
    return (await reply.json()).created?.[0];
  });
  await uploadPicture(page, folder, "wall.png");
  await uploadPicture(page, "documents", "well.png");
  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 20_000 });

  await openWithSpotlight(page, "Finder");
  const finder = page.locator('[data-window-id="finder"]').last();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents" }).first().click();
  const walls = finder.getByText("Walls", { exact: true }).first();
  await walls.waitFor({ timeout: 8_000 });
  const titleBar = await finder.locator(".mac-title-bar, [data-title-bar]").first().boundingBox();
  await page.mouse.move(titleBar.x + titleBar.width / 2, titleBar.y + 8);
  await page.mouse.down();
  await page.mouse.move(1080, 120, { steps: 10 });
  await page.mouse.up();

  await openWithSpotlight(page, "System Preferences");
  await win.locator('[data-pane="desktop-and-screen-saver"]').waitFor({ timeout: 10_000 });
  const frame = await win.boundingBox();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + 8);
  await page.mouse.down();
  await page.mouse.move(frame.width / 2 + 10, 40, { steps: 10 });
  await page.mouse.up();

  await drag(page, middle(await walls.boundingBox()), middle(await sources.boundingBox()));
  const added = sources.getByText("Walls", { exact: true });
  await added.waitFor({ timeout: 5_000 });
  step("a folder dragged from Finder joins Folders", true);
  const wall = win.getByRole("button", { name: "wall.png" });
  await wall.waitFor({ timeout: 5_000 });
  step("and shows its pictures", true);
  await page.screenshot({ path: path.join(out, "preferences-folder.png") });

  const well = finder.getByText("well.png", { exact: true }).first();
  const target = win.locator(".mac-image-well").first();
  await drag(page, middle(await well.boundingBox()), middle(await target.boundingBox()));
  await page.waitForTimeout(1_500);
  step(
    "a picture dragged onto the well becomes the desktop picture",
    (await shownPicture()).includes("blob:"),
  );
  await page.screenshot({ path: path.join(out, "preferences-well.png") });
});
