#!/usr/bin/env node

// Appearance on Ferrite: a person's own desktop. Signed in as Guest User under
// `ferrite dev` (or on the hosted app with --url), open System Preferences from
// the Dock and, in Desktop & Screen Saver, choose a built-in picture; upload a
// picture of your own from the computer into Pictures and make it the desktop
// picture; in General switch to Dark and back to Light and choose the Purple
// accent; in Dock move the Dock to the left edge and back; drag Notes to the
// front of the Dock. Every change is read back from the server
// (/api/system-preferences/settings). Then reload the page and find all of it
// kept: the uploaded picture on the desktop, Light with the Purple accent, and
// Notes first in the Dock. Exits 0 only when every step passed and the page
// logged no console error, page error, failed request or HTTP error.
//
//   ferrite dev                                           # in ferrite-apps/desktop
//   node e2e/appearance-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                   [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { deflateSync } from "node:zlib";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const URL = "/api/system-preferences/settings";
const { base, out, browserName } = options();
const { step, run } = journey("appearance");

/** A small PNG of one colour, made here so the journey needs no fixture file. */
function png(width, height, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const attribute = (page, name) =>
  page.evaluate((n) => document.documentElement.getAttribute(n), name);
const pictureSource = (page) =>
  page.locator(".mac-desktop-shell-picture img").first().getAttribute("src");
const dockApps = (page) =>
  page
    .locator(".mac-dock [data-dock-app]")
    .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute("data-dock-app")));
const stored = async (page) => (await api(page, "GET", URL)).json;

/** Wait until the server holds what `accept` looks for in the settings. */
async function serverHolds(page, accept, timeout = 10_000) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    last = await stored(page);
    if (accept(last)) return true;
    await page.waitForTimeout(250);
  }
  console.log(`  server holds ${JSON.stringify(last)}`);
  return false;
}

const prefsWindow = (page) => page.locator(".mac-system-preferences").first();

/** Open System Preferences (from the Dock, or the open window) on the pane `name`. */
async function showPane(page, name) {
  if (
    !(await prefsWindow(page)
      .isVisible()
      .catch(() => false))
  ) {
    await launch(page, "System Preferences");
    await prefsWindow(page).waitFor({ state: "visible", timeout: 10_000 });
  }
  const window = prefsWindow(page);
  await window.locator(".mac-system-preferences-body:not([inert])").waitFor({ timeout: 10_000 });
  await window.getByRole("button", { name: "Show All" }).click();
  await window
    .getByRole("group", { name: "All preferences" })
    .getByRole("button", { name, exact: true })
    .click();
  await window.getByRole("group", { name }).waitFor({ state: "visible", timeout: 10_000 });
  return window;
}

/** Drag the Dock tile `id` in front of the Dock's first app, with the pointer, in small steps. */
async function dragToFront(page, id) {
  const tile = page.locator(`.mac-dock [data-dock-app="${id}"]`);
  const first = page.locator(".mac-dock [data-dock-app]").first();
  const from = await tile.boundingBox();
  const to = await first.boundingBox();
  if (!from || !to) throw new Error("the Dock tiles have no place on the page");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const target = { x: to.x + 4, y: to.y + to.height / 2 };
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(
      from.x + from.width / 2 + ((target.x - from.x - from.width / 2) * i) / 12,
      from.y + from.height / 2 + ((target.y - from.y - from.height / 2) * i) / 12,
    );
  }
  await page.mouse.up();
}

await run(async (page) => {
  await openDesktop(page, base, step);
  // A fresh start for this person: the default desktop.
  await api(page, "DELETE", URL);
  await reloadDesktop(page);
  step(
    "the desktop starts in its default appearance",
    (await attribute(page, "data-appearance")) === null,
  );

  // Desktop & Screen Saver: a built-in picture, applied at once and kept.
  let prefs = await showPane(page, "Desktop & Screen Saver");
  await prefs.getByRole("button", { name: "Mountains", exact: true }).click();
  await page.waitForFunction(
    () => /mountains/.test(document.querySelector(".mac-desktop-shell-picture img")?.src ?? ""),
    undefined,
    { timeout: 10_000 },
  );
  step("choosing Mountains changes the desktop picture at once", true);
  step(
    "the server keeps Mountains as the person's picture",
    await serverHolds(page, (s) => s.values?.["desktop-and-screen-saver.picture"] === "mountains"),
  );

  // An uploaded picture: into the drive's Pictures folder, then the desktop picture.
  const name = `Journey wallpaper ${Date.now()}.png`;
  await prefs.getByLabel("Pictures to add").setInputFiles({
    name,
    mimeType: "image/png",
    buffer: png(64, 40, [40, 120, 200]),
  });
  await page.waitForFunction(
    () => (document.querySelector(".mac-desktop-shell-picture img")?.src ?? "").startsWith("blob:"),
    undefined,
    { timeout: 20_000 },
  );
  step("an uploaded picture becomes the desktop picture", true);
  step(
    "the uploaded picture is listed in Pictures",
    await prefs.getByRole("button", { name, exact: true }).isVisible(),
  );
  step(
    "the server keeps the uploaded picture as the person's choice",
    await serverHolds(page, (s) =>
      /^drive:/.test(s.values?.["desktop-and-screen-saver.picture"] ?? ""),
    ),
  );

  // General: Dark, then back to Light, and the Purple accent.
  prefs = await showPane(page, "General");
  await prefs.getByRole("radio", { name: "Dark" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.appearance === "dark");
  step("Dark turns the whole desktop Dark Aqua at once", true);
  step("the server keeps Dark", await serverHolds(page, (s) => s.theme?.appearance === "dark"));
  await shot(page, path.join(out, `appearance-dark-${browserName}.png`));
  await prefs.getByRole("radio", { name: "Light" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.appearance === "light");
  await prefs.getByRole("radio", { name: "Purple" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.accent === "purple");
  step("back to Light, with the Purple accent, at once", true);
  step(
    "the server keeps Light and Purple",
    await serverHolds(page, (s) => s.theme?.appearance === "light" && s.theme?.accent === "purple"),
  );

  // Dock: to the left edge and back, live.
  prefs = await showPane(page, "Dock");
  await prefs.getByRole("radio", { name: "Left" }).click();
  await page.locator('.mac-dock[data-position="left"]').waitFor({ timeout: 5_000 });
  step("Position on screen: Left moves the Dock to the left edge at once", true);
  await prefs.getByRole("radio", { name: "Bottom" }).click();
  await page.locator('.mac-dock[data-position="bottom"]').waitFor({ timeout: 5_000 });
  await prefs.getByRole("button", { name: "Close" }).first().click();

  // Reorder the Dock: Notes to the front.
  const before = await dockApps(page);
  step(
    "the Dock lists the person's apps",
    before.length > 3 && before.includes("notes"),
    before.join(","),
  );
  await dragToFront(page, "notes");
  await page.waitForFunction(
    () =>
      document.querySelector(".mac-dock [data-dock-app]")?.getAttribute("data-dock-app") ===
      "notes",
    undefined,
    { timeout: 5_000 },
  );
  step("dragging Notes to the front reorders the Dock", true);
  step(
    "the server keeps the Dock's new order",
    await serverHolds(page, (s) => s.values?.["dock.order"]?.[0] === "notes"),
  );

  // Everything is the person's, and comes back after a reload.
  await reloadDesktop(page);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.appearance === "light" &&
      document.documentElement.dataset.accent === "purple",
    undefined,
    { timeout: 10_000 },
  );
  step("after a reload the desktop is Light with the Purple accent", true);
  await page.waitForFunction(
    () => (document.querySelector(".mac-desktop-shell-picture img")?.src ?? "").startsWith("blob:"),
    undefined,
    { timeout: 20_000 },
  );
  step("after a reload the uploaded picture is the desktop picture again", true);
  const after = await dockApps(page);
  step("after a reload Notes is still first in the Dock", after[0] === "notes", after.join(","));
  step(
    "after a reload the Dock holds the same apps",
    [...after].sort().join(",") === [...before].sort().join(","),
  );
  await shot(page, path.join(out, `appearance-light-${browserName}.png`));
  console.log(`picture after reload: ${(await pictureSource(page))?.slice(0, 24)}`);
});
