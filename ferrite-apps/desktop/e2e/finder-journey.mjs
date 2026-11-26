#!/usr/bin/env node
// Finder on Ferrite: the person's drive. Open Finder from the Dock, upload a
// file larger than the gateway's 256 KiB request limit into Documents (it goes
// up in pieces), rename it, duplicate it, move it to the Desktop, preview it in
// Quick Look, download it and compare the bytes, reload the page and find it
// still there, move it to the Trash, put it back, and finally trash it and
// empty the Trash. Every step is read back from the server (/api/files/) as
// well as from the window. Exits 0 only when every step passed and the page
// logged no console error, page error, failed request or HTTP error.
//
//   ferrite dev                                       # in ferrite-apps/desktop
//   node e2e/finder-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                               [--browser chromium|chrome|firefox|webkit]

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { sameDownloadName } from "./journey-kit.mjs";

const DRIVE = "/api/files/";
const { base, out, browserName } = options();
const { step, run } = journey("finder");
const stamp = Date.now();
const uploaded = `Journey ${stamp}.txt`;
const renamed = `Field notes ${stamp}.txt`;
const copied = `Field notes ${stamp} copy.txt`;
const marker = `Macalicious drive journey ${stamp}`;

// About 600 KB of text: four pieces of 192 KiB, so the upload has to go in pieces.
const lines = [marker];
for (let n = 1; lines.join("\n").length < 600_000; n += 1) {
  lines.push(`Line ${n}: the quick brown fox jumps over the lazy dog, ${stamp}.`);
}
const bytes = Buffer.from(`${lines.join("\n")}\n`);
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

/** The drive as the server keeps it, and the entry named `name` that is not in the Trash. */
async function stored(page, name) {
  const drive = (await api(page, "GET", DRIVE)).json;
  const entry = drive.entries?.find((e) => e.name === name && e.trashed_ms === undefined);
  return { drive, entry };
}

const finderWindow = (page) => page.locator(".mac-finder").first();

async function action(page, item) {
  await finderWindow(page).getByRole("button", { name: "Action" }).click();
  const entry = page.getByRole("menuitem", { name: item });
  await entry.waitFor({ timeout: 5_000 });
  await entry.click();
}

async function showFolder(page, name) {
  // A place of the sidebar (a tree).
  await finderWindow(page).getByRole("treeitem", { name, exact: true }).first().click();
}

async function item(page, name) {
  const option = finderWindow(page).getByRole("option", { name, exact: true });
  await option.waitFor({ timeout: 15_000 });
  return option;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Finder");
  await finderWindow(page).waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    () => document.querySelector(".mac-finder")?.getAttribute("aria-busy") !== "true",
    undefined,
    { timeout: 15_000 },
  );
  const fresh = (await api(page, "GET", DRIVE)).json;
  const empty = fresh.entries?.length === 6 && fresh.usage === 0;
  step(
    "Finder opens on the person's drive, with the six home folders",
    fresh.entries?.filter((e) => !e.parent).length === 6,
    `${fresh.entries?.length} entries, ${fresh.usage} bytes used`,
  );
  // The journey empties the Trash at its end: it runs only on a drive with nothing else in it
  // (a fresh Guest User), so that it can never delete someone's files.
  if (!empty) throw new Error("the drive is not empty; run the journey as a fresh Guest User");

  // Upload into Documents through Upload Files…, in pieces.
  await showFolder(page, "Documents");
  const pieces = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("/api/files/uploads/")) {
      pieces.push(request.postDataBuffer()?.length ?? 0);
    }
  });
  const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
  await action(page, "Upload Files…");
  await (await chooser).setFiles({ name: uploaded, mimeType: "text/plain", buffer: bytes });
  await item(page, uploaded);
  let { entry } = await stored(page, uploaded);
  step(
    "Upload Files… puts the file in Documents on the server",
    entry?.parent === "documents" && entry?.size === bytes.length,
    `${entry?.size} of ${bytes.length} bytes`,
  );
  step(
    "the upload went in pieces under the 256 KiB request limit",
    pieces.length >= 4 && pieces.every((size) => size <= 262_144),
    `${pieces.length} pieces, largest ${Math.max(0, ...pieces)} bytes`,
  );
  const id = entry?.id;

  // Rename.
  await (await item(page, uploaded)).click();
  await action(page, "Rename");
  const field = page.getByRole("textbox", { name: "Name", exact: true });
  await field.waitFor({ timeout: 5_000 });
  await field.fill(renamed);
  await field.press("Enter");
  await item(page, renamed);
  ({ entry } = await stored(page, renamed));
  step("Rename renames it in place, on the server", entry?.id === id, entry?.name);

  // Duplicate: a copy beside it, sharing its bytes.
  const before = (await api(page, "GET", DRIVE)).json.usage;
  await (await item(page, renamed)).click();
  await action(page, "Duplicate");
  await item(page, copied);
  const duplicate = await stored(page, copied);
  step(
    "Duplicate makes a copy beside it that takes no more space",
    duplicate.entry?.parent === "documents" && duplicate.drive.usage === before,
    `${duplicate.entry?.name}, ${duplicate.drive.usage} bytes used`,
  );

  // Move to the Desktop: Copy, then Move Item Here.
  await (await item(page, renamed)).click();
  await action(page, `Copy “${renamed}”`);
  await showFolder(page, "Desktop");
  await action(page, "Move Item Here");
  await item(page, renamed);
  ({ entry } = await stored(page, renamed));
  step("Move Item Here moves it to the Desktop on the server", entry?.parent === "desktop");

  // Quick Look shows the file's own text.
  await (await item(page, renamed)).click();
  await page.keyboard.press("Space");
  const text = page.locator(".mac-finder-quick-look-plain").first();
  await text.waitFor({ timeout: 15_000 });
  step(
    "Quick Look shows the file's own text, read back from the drive",
    (await text.innerText()).startsWith(marker),
    (await text.innerText()).slice(0, 60),
  );
  await shot(page, path.join(out, `finder-quick-look-${browserName}.png`));
  // Quick Look is the key window now; its close button closes it.
  await page
    .locator(".mac-finder-quick-look")
    .first()
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .locator(".mac-finder-quick-look")
    .first()
    .waitFor({ state: "detached", timeout: 10_000 });

  // Download: the browser saves the same bytes.
  await (await item(page, renamed)).click();
  const downloading = page.waitForEvent("download", { timeout: 30_000 });
  await action(page, "Download");
  const download = await downloading;
  const saved = await download.path();
  const back = saved ? await readFile(saved) : Buffer.alloc(0);
  step(
    "Download saves the file to the computer byte for byte",
    sameDownloadName(download.suggestedFilename(), renamed, browserName) &&
      sha(back) === sha(bytes),
    `${download.suggestedFilename()}, ${back.length} bytes`,
  );
  ({ entry } = await stored(page, renamed));
  step("opening it counts for Recents", typeof entry?.opened_ms === "number");

  // It persists: reload the page, open Finder again, and find it on the Desktop.
  await reloadDesktop(page);
  await launch(page, "Finder");
  await finderWindow(page).waitFor({ state: "visible", timeout: 10_000 });
  await showFolder(page, "Desktop");
  step(
    "after a reload the file is still on the Desktop",
    await (await item(page, renamed)).isVisible(),
  );
  await shot(page, path.join(out, `finder-${browserName}.png`));

  // Move to Trash, then Put Back from the Trash.
  await (await item(page, renamed)).click();
  await action(page, "Move to Trash");
  await finderWindow(page).getByRole("option", { name: renamed, exact: true }).waitFor({
    state: "detached",
    timeout: 10_000,
  });
  let drive = (await api(page, "GET", DRIVE)).json;
  let trashed = drive.entries.find((e) => e.id === id);
  step(
    "Move to Trash sends it to the Trash on the server",
    typeof trashed?.trashed_ms === "number",
  );
  await action(page, "Go to Folder…");
  const go = page.getByRole("dialog", { name: "Go to Folder" });
  await go.getByRole("combobox").fill("~/.Trash");
  await go.getByRole("button", { name: "Go", exact: true }).click();
  await (await item(page, renamed)).click();
  await action(page, "Put Back");
  await finderWindow(page).getByRole("option", { name: renamed, exact: true }).waitFor({
    state: "detached",
    timeout: 10_000,
  });
  ({ entry } = await stored(page, renamed));
  step("Put Back returns it to the Desktop", entry?.id === id && entry?.parent === "desktop");

  // Leave the drive as it was found: both files to the Trash, and empty it.
  await showFolder(page, "Desktop");
  await (await item(page, renamed)).click();
  await action(page, "Move to Trash");
  await showFolder(page, "Documents");
  await (await item(page, copied)).click();
  await action(page, "Move to Trash");
  await action(page, "Empty Trash…");
  await page.getByRole("button", { name: "Empty Trash" }).click();
  for (let tries = 0; tries < 40; tries += 1) {
    await page.waitForTimeout(200);
    drive = (await api(page, "GET", DRIVE)).json;
    if (drive.usage === fresh.usage) break;
  }
  trashed = drive.entries.filter((e) => e.name === renamed || e.name === copied);
  step(
    "Empty Trash deletes them and frees their space on the server",
    trashed.length === 0 && drive.usage === fresh.usage,
    `${drive.usage} bytes used; left ${JSON.stringify(trashed)}`,
  );
});
