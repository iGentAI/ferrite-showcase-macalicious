#!/usr/bin/env node
// Batch 14 on the desktop served by `ferrite dev`: Photos hides empty Media Types; Preview opens a
// window per file, drags pages between two PDFs' sidebars, closes each alone and brings both back
// across a reload; Books gets an audiobook from the real LibriVox, plays it from the real Internet
// Archive through one audio element, keeps its place on the server and goes by chapters. Everything
// kept is read back from the server. Exits 0 only with every step passed.
//
// Firefox refuses to play sound with no audio output (`error` "Failed to decode media" just after
// `playing`, for any format), so where the machine has no sound server the journey starts PulseAudio
// with a null sink for Firefox: the real MP3 is decoded and goes nowhere audible. Needs `pulseaudio`.
//
//   node e2e/preview-books-batch14-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("preview-books-batch14", { ignoreOtherOrigins: true });
const RUN = Date.now().toString(36);
const ONE = `One ${RUN}.pdf`;
const TWO = `Two ${RUN}.pdf`;
const LIBRARY = "/api/app-store/library";
const BOOK = "lv-200";

async function startNullAudioOutput() {
  if (spawnSync("pactl", ["info"]).status === 0) return;
  const folder = mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), "pulse-"));
  const socket = path.join(folder, "native");
  const server = spawn(
    "pulseaudio",
    [
      "-n",
      "--daemonize=no",
      "--exit-idle-time=-1",
      "--load=module-null-sink",
      `--load=module-native-protocol-unix auth-anonymous=1 socket=${socket}`,
    ],
    { stdio: "ignore" },
  );
  server.unref();
  server.on("error", (error) => {
    throw new Error(`Firefox needs an audio output for this journey: ${error.message}`);
  });
  process.on("exit", () => {
    server.kill();
    rmSync(folder, { recursive: true, force: true });
  });
  await until(async () => existsSync(socket), 5_000);
  process.env.PULSE_SERVER = `unix:${socket}`;
}
if (browserName === "firefox") await startNullAudioOutput();

function makePdf(texts) {
  const objects = [];
  const pageIds = texts.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${texts.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  texts.forEach((text, index) => {
    const id = pageIds[index];
    const stream = `BT /F1 40 Tf 72 400 Td (${text}) Tj ET`;
    objects[id] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`;
    objects[id + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let body = "%PDF-1.4\n";
  const offsets = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1)
    body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return body;
}

const uploadPdf = (page, name, text) =>
  page.evaluate(
    async ({ name, text }) => {
      const blob = new Blob([text], { type: "application/pdf" });
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
    },
    { name, text },
  );

const launchByName = async (page, name, shown) => {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
  await shown.waitFor({ state: "visible", timeout: 20_000 });
};

const inWindow = (page, id) => page.locator(`[data-window-id="${id}"]`);
const thumbnails = (page, id) => inWindow(page, id).getByRole("listbox", { name: "Thumbnails" });
const pagesIn = (page, id) =>
  inWindow(page, id).locator(".mac-preview-app-pages [data-page]").count();
const settled = (page, id) =>
  until(
    async () =>
      (await inWindow(page, id).locator(".mac-preview-app").getAttribute("aria-busy")) !== "true",
    20_000,
  );

async function photos(page) {
  await launchByName(page, "Photos", page.getByRole("tree", { name: "Library" }));
  const tree = page.getByRole("tree", { name: "Library" });
  await tree.getByRole("treeitem", { name: "Activity" }).waitFor({ timeout: 15_000 });
  const shown = await tree.innerText();
  step(
    "Photos: with no movie or other kind, Media Types and its rows are not in the sidebar",
    !/Media Types|Live Photos|Portrait|Time-lapse|Slo-mo|Bursts/.test(shown),
    shown.replace(/\s+/g, " ").slice(0, 160),
  );
  step(
    "Photos: Shared stays, dimmed",
    (await tree.getByRole("treeitem", { name: "Shared Albums" }).getAttribute("aria-disabled")) ===
      "true",
  );
  await shot(page, path.join(out, "batch14-photos-sidebar.png"));
  await chooseMenu(page, "Photos", "Quit Photos");
}

async function preview(page) {
  await launchByName(page, "Preview", page.locator(".mac-preview-app").first());
  const dialog = page.getByRole("dialog", { name: "Open" });
  if (!(await until(() => dialog.isVisible(), 5_000))) {
    await page.getByRole("button", { name: "Open…" }).first().click();
  }
  await dialog.getByRole("option", { name: ONE }).dblclick({ timeout: 15_000 });
  await thumbnails(page, "preview").waitFor({ timeout: 20_000 });
  await settled(page, "preview");

  const newFromClipboard = await menuItemState(page, "File", "New from Clipboard");
  step("Preview: New from Clipboard stays in File", !newFromClipboard.disabled);

  await chooseMenu(page, "File", "Open…");
  await dialog.getByRole("option", { name: TWO }).dblclick({ timeout: 15_000 });
  const second = "preview:2";
  step(
    "Preview: File > Open with a document open makes a second window",
    await until(() => thumbnails(page, second).isVisible(), 20_000),
  );
  await settled(page, second);
  step(
    "Preview: each window holds its own PDF",
    (await until(async () => (await pagesIn(page, "preview")) === 3)) &&
      (await until(async () => (await pagesIn(page, second)) === 2)),
    `${await pagesIn(page, "preview")} and ${await pagesIn(page, second)} pages`,
  );

  await chooseMenu(page, "File", "Open…");
  await dialog.getByRole("option", { name: ONE }).dblclick({ timeout: 15_000 });
  await page.waitForTimeout(800);
  step(
    "Preview: opening a file that has a window opens no third",
    (await page.locator('[data-window-id^="preview"]').count()) === 2,
  );

  const rows = await menuItemState(page, "Window", TWO);
  step("Preview: the Window menu names the file", rows !== undefined && !rows.disabled);
  await page.keyboard.press("Escape");

  // A press on the first window's edge brought it to the front, over the second: its bar carries it clear.
  const firstBar = await inWindow(page, "preview").boundingBox();
  await page.mouse.move(firstBar.x + firstBar.width - 1, firstBar.y + firstBar.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBar.x + 620, firstBar.y + firstBar.height / 2, { steps: 8 });
  await page.mouse.up();
  const shrunk = await inWindow(page, "preview").boundingBox();
  const secondBar = await inWindow(page, second).boundingBox();
  await page.mouse.move(shrunk.x + shrunk.width / 2, shrunk.y + 11);
  await page.mouse.down();
  await page.mouse.move(secondBar.x + 585 + shrunk.width / 2, shrunk.y + 11, {
    steps: 10,
  });
  await page.mouse.up();
  await shot(page, path.join(out, "batch14-preview-two-windows.png"));

  const from = await thumbnails(page, "preview").locator('[data-index="1"]').boundingBox();
  const to = await thumbnails(page, second).locator('[data-index="0"]').boundingBox();
  step(
    "Preview: the two sidebars stand clear of each other",
    from !== null && to !== null && from.x >= to.x + to.width,
    JSON.stringify({ from, to }),
  );
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 30, from.y + from.height / 2, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 8, { steps: 10 });
  // A browser says dragover only from the second move over the same element.
  await page.mouse.move(to.x + to.width / 2 + 2, to.y + to.height - 8);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 8);
  await page.waitForTimeout(250);
  step(
    "Preview: the other window marks where the page will land",
    (await inWindow(page, second).locator(".mac-preview-app-thumbnails-line").count()) === 1,
  );
  await shot(page, path.join(out, "batch14-preview-drag.png"));
  await page.mouse.up();
  step(
    "Preview: the second PDF has the page, the first keeps its own",
    (await until(async () => (await pagesIn(page, second)) === 3, 20_000)) &&
      (await pagesIn(page, "preview")) === 3,
    `${await pagesIn(page, "preview")} and ${await pagesIn(page, second)} pages`,
  );
  await until(() => settled(page, second));
  const landed = await until(async () => {
    await inWindow(page, second)
      .locator('.mac-preview-app-pages [data-page="2"]')
      .scrollIntoViewIfNeeded();
    const text = await inWindow(page, second)
      .locator('.mac-preview-app-pages [data-page="2"]')
      .innerText();
    return /Two/.test(text);
  }, 15_000);
  step("Preview: the page landed after the row, with its own text", landed);

  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  step(
    "Preview: both windows come back across a reload, each with its file",
    (await until(async () => (await pagesIn(page, "preview")) === 3, 25_000)) &&
      (await until(async () => (await pagesIn(page, second)) === 3, 25_000)),
  );
  const titled = async (id, name) =>
    (await inWindow(page, id).getByText(name, { exact: false }).count()) > 0;
  step(
    "Preview: the windows name the same files after the reload",
    (await until(() => titled("preview", ONE))) && (await until(() => titled(second, TWO))),
  );
  await shot(page, path.join(out, "batch14-preview-restored.png"));

  await inWindow(page, second).getByRole("button", { name: "Close" }).click();
  step(
    "Preview: closing one window leaves the other",
    (await until(async () => (await inWindow(page, second).count()) === 0)) &&
      (await pagesIn(page, "preview")) === 3,
  );
  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  step(
    "Preview: the closed window stays closed across a reload",
    (await until(async () => (await pagesIn(page, "preview")) === 3, 25_000)) &&
      (await inWindow(page, second).count()) === 0,
  );
  await inWindow(page, "preview").getByRole("button", { name: "Close" }).click();
  await until(async () => (await inWindow(page, "preview").count()) === 0);
}

async function books(page) {
  const window = page.getByRole("region", { name: "Books", exact: true }).first();
  await launchByName(page, "Books", window);
  const store = await api(page, "GET", "/api/books/store?shelf=librivox");
  step(
    "Books: the server answers LibriVox's shelf",
    store.status === 200 && store.json.books.length === 24 && store.json.source === "librivox",
    `${store.status}: ${store.json.books?.[0]?.id} ${store.json.books?.[0]?.title}`,
  );
  await page.getByRole("button", { name: "Audiobook Store", exact: true }).click();
  await window
    .getByRole("heading", { name: "At LibriVox" })
    .or(window.getByText("At LibriVox"))
    .first()
    .waitFor({
      timeout: 20_000,
    });
  step(
    "Books: the Audiobook Store says its source",
    await window.getByText(/Audiobooks from LibriVox/).isVisible(),
  );
  const search = window.getByRole("searchbox").first();
  await search.fill("alice");
  const show = window.getByRole("button", {
    name: "Show Alice's Adventures in Wonderland",
    exact: true,
  });
  step("Books: the search finds a title", await until(() => show.first().isVisible(), 20_000));
  await shot(page, path.join(out, "batch14-books-store.png"));
  await search.fill("");
  await search.fill("carroll");
  // The field waits for a pause in the typing: until then the words before it are still listed.
  const snark = window.getByRole("button", { name: "Show Hunting of the Snark", exact: true });
  step(
    "Books: the search finds an author's last name",
    (await until(() => snark.first().isVisible(), 20_000)) &&
      (await until(() => show.first().isVisible(), 20_000)),
  );
  await show.first().click();
  const chapters = window.getByRole("region", { name: "Chapters" });
  await chapters.waitFor({ timeout: 20_000 }).catch(() => {});
  await shot(page, path.join(out, "batch14-books-detail.png"));
  step(
    "Books: a book's page lists its chapters",
    await until(async () => /12 chapters/.test(await chapters.innerText()), 20_000),
    (await chapters.innerText().catch((error) => String(error))).slice(0, 300),
  );
  await window
    .getByRole("button", { name: "Get Alice's Adventures in Wonderland", exact: true })
    .first()
    .click();
  const owned = () => api(page, "GET", "/api/books/library");
  step(
    "Books: Get keeps the audiobook in the library on the server",
    await until(async () =>
      (await owned()).json.library?.books?.some(
        (each) => each.id === BOOK && each.source === "librivox",
      ),
    ),
  );
  await search.fill("");
  await page.getByRole("button", { name: "Library", exact: true }).first().click();
  await window
    .getByRole("treeitem", { name: "Audiobooks" })
    .or(window.getByRole("option", { name: "Audiobooks" }))
    .first()
    .click();
  step(
    "Books: the Audiobooks row lists it",
    await until(() =>
      window
        .getByRole("button", {
          name: "Alice's Adventures in Wonderland, Lewis Carroll",
          exact: true,
        })
        .first()
        .isVisible(),
    ),
  );
  await shot(page, path.join(out, "batch14-books-audiobooks-row.png"));

  await page.getByRole("button", { name: "Audiobook Store", exact: true }).click();
  await search.fill("carroll");
  await window
    .getByRole("button", { name: "Listen Alice's Adventures in Wonderland", exact: true })
    .first()
    .click();
  const player = page.locator(".mac-books-audiobook");
  await player.waitFor({ timeout: 20_000 });
  const list = player.getByRole("listbox", { name: "Chapters" });
  await list.waitFor({ timeout: 20_000 });
  const audio = (read) => player.locator("audio").evaluate(read);
  step(
    "Books: the player has one audio element, at the Internet Archive",
    (await page.locator(".mac-books-audiobook audio").count()) === 1 &&
      (await until(async () =>
        (await audio((el) => el.src)).startsWith("https://archive.org/download/"),
      )),
    await audio((el) => el.src),
  );
  const play = await menuItemState(page, "Controls", "Play");
  await page.keyboard.press("Escape");
  step("Books: Controls > Play is not dimmed for an audiobook", !play.disabled);
  await chooseMenu(page, "Controls", "Play");
  const played = await until(async () => (await audio((el) => el.currentTime)) > 1, 40_000);
  const state = await audio((el) => ({
    paused: el.paused,
    time: el.currentTime,
    duration: el.duration,
    ready: el.readyState,
    error: el.error?.message ?? null,
  }));
  step("Books: the sound plays", played, JSON.stringify(state));
  await shot(page, path.join(out, "batch14-books-player.png"));

  await list.getByRole("option", { name: "Chapter 3" }).click();
  step(
    "Books: a chapter of the list plays from its own file",
    (await until(async () => /ch_03/.test(await audio((el) => el.src)), 10_000)) &&
      (await until(async () => (await audio((el) => el.currentTime)) > 1, 40_000)),
    await audio((el) => `${el.src} at ${el.currentTime}`),
  );
  await chooseMenu(page, "Controls", "Pause");
  await until(() => audio((el) => el.paused));
  await player.getByRole("button", { name: "Forward 30" }).click();
  await until(async () => (await audio((el) => el.currentTime)) > 30, 15_000);
  const at = await audio((el) => el.currentTime);
  const reading = () => api(page, "GET", `/api/books/reading/${BOOK}`);
  const before = 640 + 735;
  step(
    "Books: the place is kept on the server, in seconds across the recording",
    await until(async () => {
      const place = (await reading()).json.reading?.place ?? 0;
      return Math.abs(place - (before + at)) < 3;
    }),
    `${(await reading()).json.reading?.place} near ${before + at}`,
  );

  await page.waitForTimeout(800);
  await reloadDesktop(page);
  const again = page.locator(".mac-books-audiobook audio");
  await again.waitFor({ state: "attached", timeout: 25_000 });
  const back = async () =>
    again.evaluate((el) => ({ src: el.src, time: el.currentTime, paused: el.paused }));
  step(
    "Books: across a reload the player comes back at the same chapter and place, not playing",
    await until(async () => {
      const { src, time, paused } = await back();
      return /ch_03/.test(src) && Math.abs(time - at) < 3 && paused;
    }, 30_000),
    JSON.stringify(await back()),
  );
  const next = await menuItemState(page, "Controls", "Next Chapter");
  await page.keyboard.press("Escape");
  step("Books: Controls has Next Chapter", !next.disabled);
  await chooseMenu(page, "Controls", "Next Chapter");
  step(
    "Books: Next Chapter goes to the next file",
    await until(async () => /ch_04/.test((await back()).src), 10_000),
  );

  // Bytes no decoder takes stand in for a chapter that fails; the words are the app's own.
  await page.route(/wonderland_ch_05/, (route) =>
    route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(40_000, 7) }),
  );
  await chooseMenu(page, "Controls", "Next Chapter");
  const said = player.getByText("The Internet Archive did not give this chapter");
  step(
    "Books: a chapter whose sound fails is said in the window",
    await until(async () => said.isVisible(), 15_000),
  );
  step(
    "Books: and the menu offers Play again, not Pause",
    !(await menuItemState(page, "Controls", "Play")).disabled,
  );
  await page.keyboard.press("Escape");
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadPdf(page, ONE, makePdf(["One", "Two", "Three"]));
  await uploadPdf(page, TWO, makePdf(["Alpha", "Beta"]));
  const library = (await api(page, "GET", LIBRARY)).json;
  const wanted = ["preview", "books"];
  const missing = wanted.filter((each) => !(library.installed ?? []).includes(each));
  if (missing.length > 0) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(library.installed ?? []), ...missing],
      rev: library.rev,
    });
  }
  await reloadDesktop(page);
  await photos(page);
  await preview(page);
  await books(page);
});
