#!/usr/bin/env node
// Kept versions in Script Editor and QuickTime Player on the served desktop. Script Editor saves a
// script three times; across a reload, File > Revert To > Browse All Versions… shows the versions
// beside the script, Restore makes one the file's bytes and keeps what it replaced, and Previous
// Save goes back the same way. QuickTime Player's File > Save writes an edit into the movie's own
// file, so there is no second file and the original is a kept version; across a reload the sheet
// plays it, Previous Save brings it back, and Save As… writes a new file and leaves the first alone.
// All of it is read back from the drive's routes. Exits 0 only when every step passed with no
// console error, page error, failed request or HTTP error.
//
//   node e2e/versions-rest-batch10-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { base, out, browserName } = options();
const { step, run } = journey("versions-rest-batch10");
const stamp = Date.now();
const SCRIPT = `Versions ${stamp}`;
const SCRIPT_FILE = `${SCRIPT}.js`;
const [one, two, three] = ["one", "two", "three"].map((word) => `// ${word} ${stamp}`);
const MOVIE = "test-pattern.webm";
const COPY = `Copy ${stamp}`;

async function until(check, ms = 60_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value || Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const driveOf = async (page) => (await api(page, "GET", "/api/files/")).json;
const fileNamed = async (page, name) =>
  (await driveOf(page)).entries.find(
    (entry) => entry.name === name && entry.trashed_ms === undefined,
  );
const textAt = (page, url) =>
  page.evaluate(async (at) => {
    const response = await fetch(at, { credentials: "same-origin" });
    return response.ok ? response.text() : `HTTP ${response.status}`;
  }, url);
const word = (text) => [one, two, three].find((each) => text.includes(each)) ?? text.slice(0, 60);
const versionsOf = async (page, id) =>
  (await api(page, "GET", `/api/files/versions/${id}`)).json.versions;
const keptTexts = async (page, id) => {
  const list = [];
  for (const { version } of await versionsOf(page, id)) {
    list.push(word(await textAt(page, `/api/files/versions/${id}/${version}?piece=0&count=8`)));
  }
  return list;
};
const current = async (page, id) =>
  word(await textAt(page, `/api/files/content/${id}?piece=0&count=8`));

const menuBar = (page) => page.getByRole("menubar").first();
/** Chooses `trail` in the File menu of the menu bar, once its last row is not dimmed. */
async function fileMenu(page, ...trail) {
  await menuBar(page).getByRole("menuitem", { name: "File", exact: true }).click();
  for (const name of trail.slice(0, -1)) {
    const trigger = page.getByRole("menuitem", { name, exact: true });
    await trigger.waitFor({ timeout: 5_000 });
    await trigger.hover();
  }
  const last = trail.at(-1);
  const entry = page.getByRole("menuitem", { name: last, exact: true });
  await entry.waitFor({ timeout: 5_000 });
  await page.waitForFunction(
    (name) =>
      [...document.querySelectorAll('[role="menuitem"]')].some(
        (row) => row.textContent?.includes(name) && row.getAttribute("aria-disabled") !== "true",
      ),
    last,
    { timeout: 15_000 },
  );
  await entry.click();
}

async function scriptEditor(page) {
  const window = page.locator('[data-window-id="script-editor"]').first();
  await launch(page, "Script Editor");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const editor = window.getByRole("textbox", { name: "Script", exact: true });
  await editor.waitFor({ timeout: 10_000 });
  return editor;
}
async function retype(page, editor, text) {
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type(text);
}
const scriptShows = (editor, text) =>
  until(async () => (await editor.innerText()).includes(text), 15_000);

async function scriptJourney(page) {
  let editor = await scriptEditor(page);
  await retype(page, editor, one);
  await page.keyboard.press("ControlOrMeta+S");
  const sheetName = page.getByRole("textbox", { name: /Save As|Name/ }).last();
  await sheetName.waitFor({ timeout: 5_000 });
  await sheetName.fill(SCRIPT);
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  const file = await until(() => fileNamed(page, SCRIPT_FILE), 15_000);
  const id = file?.id;
  step("a saved script is one file with no earlier versions", Boolean(id));
  await page.waitForTimeout(800);

  for (const text of [two, three]) {
    const marked = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/files/versions/${id}/keep`,
      { timeout: 15_000 },
    );
    await retype(page, editor, text);
    await page.keyboard.press("ControlOrMeta+S");
    step(`File > Save marks "${text}" as a saved version`, (await marked).status() === 204);
    await page.waitForTimeout(300);
  }
  step(
    "the drive keeps what each save replaced, and the file holds the last",
    same(await keptTexts(page, id), [two, one]) && (await current(page, id)) === three,
    JSON.stringify(await keptTexts(page, id)),
  );

  await reloadDesktop(page);
  step("the versions are still there after a reload", same(await keptTexts(page, id), [two, one]));
  editor = await scriptEditor(page);
  await fileMenu(page, "Open Recent", SCRIPT_FILE);
  step("Open Recent brings the script back", await scriptShows(editor, three));

  await fileMenu(page, "Revert To", "Browse All Versions…");
  const sheet = page.getByRole("dialog", { name: `Versions of “${SCRIPT_FILE}”` });
  await sheet.waitFor({ timeout: 10_000 });
  const pages = sheet.getByRole("document");
  await sheet.getByText(two).waitFor({ timeout: 10_000 });
  step(
    "Browse All Versions lists them by date, the newest chosen beside the script",
    (await sheet.getByRole("row").count()) === 2 &&
      (await pages.nth(0).textContent()).includes(three) &&
      (await pages.nth(1).textContent()).includes(two),
  );
  await sheet.getByRole("row").nth(1).click();
  await sheet.getByText(one).waitFor({ timeout: 10_000 });
  await shot(page, path.join(out, `versions-rest-script-sheet-${browserName}.png`));
  await sheet.getByRole("button", { name: "Restore" }).click();
  step("Restore puts that version in the window", await scriptShows(editor, one));
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  const restored = await until(async () => same(await keptTexts(page, id), [three, two]), 15_000);
  step(
    "the file holds it now, and what it replaced is kept",
    restored && (await current(page, id)) === one,
    JSON.stringify(await keptTexts(page, id)),
  );

  await reloadDesktop(page);
  editor = await scriptEditor(page);
  await fileMenu(page, "Open Recent", SCRIPT_FILE);
  step("after a reload the script is the restored one", await scriptShows(editor, one));
  await fileMenu(page, "Revert To", "Previous Save");
  step("Previous Save goes back to the save before", await scriptShows(editor, three));
  step(
    "the file holds that, keeping what it replaced",
    await until(
      async () =>
        (await current(page, id)) === three && same(await keptTexts(page, id), [two, one]),
      15_000,
    ),
    JSON.stringify(await keptTexts(page, id)),
  );
}

async function movieJourney(page) {
  const LIBRARY = "/api/app-store/library";
  const held = (await api(page, "GET", LIBRARY)).json;
  await api(page, "PUT", LIBRARY, {
    installed: [...new Set([...(held.installed ?? []), "quicktime-player"])],
    rev: held.rev,
  });
  await reloadDesktop(page);
  const qt = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
  const openPlayer = async () => {
    if (await qt.isVisible()) return;
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("QuickTime Player");
    await field.press("Enter");
    await qt.waitFor({ state: "visible", timeout: 15_000 });
  };
  await openPlayer();
  const chooser = page.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await chooser).setFiles(path.join(here, "fixtures", MOVIE));

  const video = qt.locator("video.mac-quicktime-player-video");
  const measure = () =>
    video.evaluate((each) => ({ width: each.videoWidth, height: each.videoHeight }));
  const shaped = (test) =>
    until(async () => {
      const now = await measure();
      return now.width > 0 && test(now) ? now : false;
    });
  const original = await shaped(() => true);
  step("the movie opens", Boolean(original), JSON.stringify(original));
  const first = await until(() => fileNamed(page, MOVIE), 15_000);
  const id = first?.id;
  const idle = () =>
    qt.locator(".mac-quicktime-player-work").getByRole("progressbar").waitFor({
      state: "detached",
      timeout: 60_000,
    });
  const notEdited = () => until(async () => !(await qt.innerText()).includes("Edited"), 30_000);
  const rotate = async () => {
    await menuBar(page).getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.getByRole("menuitem", { name: "Rotate Right", exact: true }).first().click();
    const now = await shaped((each) => each.width === original.height);
    await idle();
    return now;
  };

  await rotate();
  await fileMenu(page, "Save");
  await notEdited();
  await idle();
  let entry = await fileNamed(page, MOVIE);
  const movies = (await driveOf(page)).entries.filter((each) => each.parent === "movies");
  step(
    "Save writes into the movie's own file: the same id, a new version, no second file",
    entry?.id === id && entry.version === first.version + 1 && movies.length === 1,
    JSON.stringify(movies.map((each) => [each.name, each.version])),
  );
  let kept = await versionsOf(page, id);
  step(
    "the bytes it replaced are kept as a version",
    kept.length === 1 && kept[0].version === first.version && kept[0].size === first.size,
    JSON.stringify(kept),
  );

  await reloadDesktop(page);
  await openPlayer();
  await fileMenu(page, "Open Recent", MOVIE);
  step(
    "after a reload the file plays as saved",
    Boolean(await shaped((now) => now.width === original.height)),
  );
  await idle();

  await fileMenu(page, "Revert To", "Browse All Versions…");
  const sheet = page.getByRole("dialog", { name: `Versions of “${MOVIE}”` });
  await sheet.waitFor({ timeout: 10_000 });
  const versionMovie = sheet.locator("video").nth(1);
  const versionShape = await until(async () => {
    const now = await versionMovie.evaluate((each) => [each.videoWidth, each.videoHeight]);
    return now[0] > 0 ? now : false;
  }, 20_000);
  step(
    "Browse All Versions plays the kept version beside the movie",
    same(versionShape, [original.width, original.height]),
    JSON.stringify(versionShape),
  );
  await shot(page, path.join(out, `versions-rest-movie-sheet-${browserName}.png`));
  await sheet.getByRole("button", { name: "Done" }).click();
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  step("Done changes nothing", (await fileNamed(page, MOVIE)).version === entry.version);

  await fileMenu(page, "Revert To", "Previous Save");
  step(
    "Previous Save brings the movie back, its picture as it was",
    Boolean(await shaped((now) => now.width === original.width)),
  );
  await idle();
  entry = await fileNamed(page, MOVIE);
  kept = await versionsOf(page, id);
  step(
    "the file holds the first bytes, at a new version, keeping what it replaced",
    entry.id === id &&
      entry.size === first.size &&
      entry.version === first.version + 2 &&
      kept.some((each) => each.version === first.version + 1 && each.saved),
    JSON.stringify({ version: entry.version, size: entry.size, kept }),
  );

  await reloadDesktop(page);
  await openPlayer();
  await fileMenu(page, "Open Recent", MOVIE);
  step(
    "after a reload it is still the restored movie",
    Boolean(await shaped((now) => now.width === original.width)),
  );
  await idle();

  await rotate();
  await fileMenu(page, "Save As…");
  const name = page.getByRole("textbox", { name: "Name of the new movie" });
  await name.waitFor({ timeout: 5_000 });
  await name.fill(COPY);
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  const copy = await until(() => fileNamed(page, `${COPY}.webm`), 20_000);
  await notEdited();
  await idle();
  const after = await fileNamed(page, MOVIE);
  step(
    "Save As… writes a new file under the name typed, and leaves the first as it was",
    Boolean(copy) && after.version === entry.version && after.size === entry.size,
    JSON.stringify([copy?.name, after.version]),
  );
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = await api(page, "GET", "/api/app-store/library");
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json?.installed ?? []), "script-editor"])],
    rev: library.json?.rev ?? 0,
  });
  await reloadDesktop(page);
  await scriptJourney(page);
  await movieJourney(page);
});
