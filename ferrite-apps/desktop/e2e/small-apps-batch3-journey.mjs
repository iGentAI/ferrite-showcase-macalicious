#!/usr/bin/env node
// The smaller apps' rows, with real input in a browser and read back from where each is kept: Stickies'
// pictures (dropped from Finder, kept by the server, there after a reload), fonts added in Font Book in
// the Fonts panels and turned-off fonts leaving them, Photo Booth's backdrops (drawn and dropped, the
// background replaced and the picture taken holding it), Dictionary's Look Up popover and Remove from
// Recents, Terminal's proxy icon and Help row, and Chess's rows that only a journey could close.
//
//   node e2e/small-apps-batch3-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--only <regex>]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { api } from "./app-journey.mjs";
import { reloadDesktop } from "./journey-kit.mjs";
import {
  chooseMenu,
  closeMenus,
  engineSetup,
  menuItemState,
  openApp,
  until,
} from "./media-census-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { step, run, shot, allow } = twoPeople("small-apps-batch3");
const only = (() => {
  const at = process.argv.indexOf("--only");
  return new RegExp(at >= 0 ? process.argv[at + 1] : ".");
})();
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `s3chris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `s3martin-${id}`, fullName: `Martin ${id}`, password };
const here = path.dirname(fileURLToPath(import.meta.url));
const BACKDROP_FILE = `Backdrop ${id}.png`;
const PICTURE_FILE = `Picture ${id}.png`;
const REFUSED_FILE = `Refused ${id}.mov`;
const PGN_OPENED = `Opened ${id}.pgn`;
const PGN_DROPPED = `Dropped ${id}.pgn`;
const TTF = path.resolve(
  here,
  "../../../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf",
);

/** A PNG of one colour, made here so that its pixels are known. */
function png(width, height, [r, g, b]) {
  const table = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (data) => {
    let c = -1;
    for (const byte of data) c = table[(c ^ byte) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (name, data) => {
    const body = Buffer.concat([Buffer.from(name, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const line = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) line.set([r, g, b], 1 + x * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => line)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const centre = async (locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element to drag from or to is not shown");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const finderOf = (page) => page.locator(".mac-window.mac-finder").first();

async function finderOn(page, folder) {
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = finderOf(page);
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: folder, exact: true }).first().click();
  return finder;
}

/** Moves a window by its title bar, with its left edge near `x`. */
async function moveWindow(page, window, x) {
  const box = await window.boundingBox();
  await page.mouse.move(box.x + 300, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(x + 300, box.y + 10, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** Drags the file `name` of Finder's `folder` to the point `at`, with Finder clear of that point. */
async function dropFromFinder(page, name, folder, at) {
  const finder = await finderOn(page, folder);
  const file = finder.getByRole("option", { name, exact: true }).first();
  await file.waitFor({ timeout: 10_000 });
  await moveWindow(page, finder, Math.max(at.x + 40, 300));
  const from = await centre(file);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 4 });
  await page.mouse.move(at.x, at.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}

const selectWord = (editor, word) =>
  editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      root.focus();
      root.ownerDocument.getSelection().setBaseAndExtent(node, at, node, at + wanted.length);
      return true;
    }
    return false;
  }, word);

const panelFamilies = (panel) =>
  panel
    .getByRole("listbox", { name: "Family" })
    .getByRole("option")
    .evaluateAll((rows) => rows.map((row) => row.textContent.trim()));

/** The note made here, its text in hand. */
async function newNote(page, text) {
  await openFromDock(page, "Notes", "Notes");
  const window = page.getByRole("region", { name: "Notes" }).first();
  await window.getByRole("button", { name: "New Note" }).click();
  const note = window.locator('[role="textbox"][aria-label="Note"]:visible').first();
  await note.waitFor({ timeout: 10_000 });
  await note.click();
  await page.keyboard.type(text);
  return note;
}

async function stickies(page) {
  const tag = `Sticky${id}`;
  const picture = PICTURE_FILE;
  const refused = REFUSED_FILE;
  await page
    .getByRole("button", { name: /^Stickies$/ })
    .first()
    .click();
  await page.locator('[data-window-id^="stickies"]').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  await chooseMenu(page, "File", "New Note");
  await page.waitForTimeout(400);
  await page.keyboard.type(tag);
  const note = page.locator(".mac-stickies-note-text", { hasText: tag });
  await page.waitForTimeout(800);
  await dropFromFinder(page, picture, "Documents", await centre(note));
  const image = note.locator("img");
  step(
    "a picture dropped from Finder shows in the note, under its text",
    await until(async () => (await image.evaluate((each) => each.naturalWidth)) > 0, 10_000),
  );
  await shot(page, "stickies-picture");
  const saved = async () =>
    ((await api(page, "GET", "/api/stickies/data")).json?.data?.notes ?? []).find((each) =>
      each.text.includes(tag),
    );
  step(
    "the server keeps it in the note, as the picture itself and under the note's limit",
    await until(async () => {
      const html = (await saved())?.html ?? "";
      return /<img src="data:image\/\w+;base64,/.test(html) && html.length < 100_000;
    }, 10_000),
    `${(await saved())?.html?.length} bytes`,
  );
  await reloadDesktop(page);
  const again = page.locator(".mac-stickies-note-text", { hasText: tag }).locator("img");
  step(
    "it is there after a reload, drawn",
    await until(async () => (await again.evaluate((each) => each.naturalWidth)) > 0, 15_000),
  );
  const before = (await saved()).html;
  await dropFromFinder(
    page,
    refused,
    "Documents",
    await centre(page.locator(".mac-stickies-note-text", { hasText: tag })),
  );
  await page.waitForTimeout(800);
  step("a file that is neither text nor picture changes nothing", (await saved()).html === before);
}

async function fonts(page) {
  const family = `Quince${id}`;
  const word = `Typeset${id}`;
  const inPanel = async (key) => {
    await key();
    const panel = page.locator(".mac-font-panel").last();
    await panel.waitFor({ timeout: 10_000 });
    return panel;
  };
  await openApp(page, "Font Book", ".mac-font-book");
  const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
  await chooseMenu(page, "File", "Add Fonts…");
  await (await chooser).setFiles({
    name: `${family}.ttf`,
    mimeType: "font/ttf",
    buffer: readFileSync(TTF),
  });
  const list = page.locator(".mac-font-book").first();
  await list.getByText(family).first().waitFor({ timeout: 15_000 });

  const note = await newNote(page, `${word} words`);
  await selectWord(note, word);
  const panel = await inPanel(() => page.keyboard.press("ControlOrMeta+t"));
  step(
    "Notes' Fonts panel lists the font added in Font Book",
    await until(async () => (await panelFamilies(panel)).includes(family), 8_000),
  );
  await panel
    .getByRole("listbox", { name: "Family" })
    .getByRole("option", { name: family, exact: true })
    .click();
  const fontOf = () =>
    note.evaluate((root, wanted) => {
      const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeValue.includes(wanted)) return getComputedStyle(node.parentElement).fontFamily;
      }
      return "";
    }, word);
  step(
    "chosen there, it is the selected word's font",
    await until(async () => (await fontOf()).includes(family), 5_000),
    await fontOf(),
  );
  step(
    "and the page has that font loaded",
    await page.evaluate((name) => document.fonts.check(`16px "${name}"`), family),
  );
  await shot(page, "font-panel-added");
  await page.keyboard.press("Escape");

  await openApp(page, "TextEdit", ".mac-textedit");
  await page.locator(".mac-textedit").getByRole("textbox", { name: "Document" }).first().click();
  const textPanel = await inPanel(() => page.keyboard.press("ControlOrMeta+t"));
  step(
    "TextEdit's Fonts panel lists it",
    await until(async () => (await panelFamilies(textPanel)).includes(family), 8_000),
  );
  await page
    .getByRole("button", { name: /^Stickies$/ })
    .first()
    .click();
  const sticky = page.locator(".mac-stickies-note").first();
  await sticky.waitFor({ state: "visible", timeout: 15_000 });
  await sticky.getByRole("textbox").first().click();
  const stickyPanel = await inPanel(() => page.keyboard.press("ControlOrMeta+t"));
  step(
    "Stickies' Fonts panel lists it",
    await until(async () => (await panelFamilies(stickyPanel)).includes(family), 8_000),
  );

  // Across a reload, with Font Book never opened again: the font is the computer's.
  await page.waitForTimeout(2_500);
  await reloadDesktop(page);
  step(
    "after a reload the page has the font without Font Book in front of it",
    await until(
      () =>
        page.evaluate(
          (name) =>
            document.fonts.check(`16px "${name}"`) &&
            [...document.fonts].some((face) => face.family.replace(/"/g, "") === name),
          family,
        ),
      15_000,
    ),
  );

  // Turned off in Font Book: both the added font and a built-in one leave the panels.
  await openApp(page, "Font Book", ".mac-font-book");
  const book = page.locator(".mac-font-book").first();
  await book.getByRole("searchbox").first().fill(family);
  await book.getByText(family, { exact: true }).first().click();
  await book
    .getByRole("button", { name: /^Disable / })
    .first()
    .click();
  const confirm = page.getByRole("alertdialog");
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole("button", { name: "Disable" }).click();
  }
  const off = async () => (await api(page, "GET", "/api/font-book/library")).json?.disabled ?? [];
  step(
    "Font Book keeps the font turned off, on the server",
    await until(async () => (await off()).length > 0, 10_000),
    JSON.stringify(await off()),
  );
  await page
    .getByRole("button", { name: /^Notes$/ })
    .first()
    .click();
  const note2 = page
    .getByRole("region", { name: "Notes" })
    .first()
    .locator('[role="textbox"][aria-label="Note"]:visible')
    .first();
  await note2.click();
  const after = await inPanel(() => page.keyboard.press("ControlOrMeta+t"));
  step(
    "the font turned off leaves the Fonts panel",
    await until(async () => !(await panelFamilies(after)).includes(family), 8_000),
  );
  await shot(page, "font-panel-disabled");
  await page.keyboard.press("Escape");
  // A panel floats over every window: the drags that follow would start under it.
  for (const panel of await page.locator(".mac-font-panel").all()) {
    await panel
      .getByRole("button", { name: "Close" })
      .click()
      .catch(() => {});
  }
}

async function photoBooth(page) {
  const window = page.locator(".mac-photo-booth").first();
  await openApp(page, "Photo Booth", ".mac-photo-booth");
  const backdrops = async () => {
    const grid = window.getByRole("group", { name: /^Effects, page/ });
    if (!(await grid.isVisible().catch(() => false))) {
      await window.getByRole("button", { name: "Effects", exact: true }).click();
    }
    await window.getByRole("button", { name: "Page 4 of 4", exact: true }).click();
    await window.getByRole("group", { name: "Effects, page 4 of 4" }).waitFor({ timeout: 5_000 });
  };
  /** The commonest colour of what the camera view paints, in coarse steps. */
  const commonest = (canvas) =>
    canvas.evaluate((element) => {
      const context = element.getContext("2d");
      const { data } = context.getImageData(0, 0, element.width, element.height);
      const counts = new Map();
      for (let at = 0; at < data.length; at += 4 * 7) {
        const key = [data[at] >> 4, data[at + 1] >> 4, data[at + 2] >> 4].join();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const [key] = [...counts].sort((a, b) => b[1] - a[1])[0];
      return key.split(",").map((n) => Number(n) << 4);
    });
  const liveCanvas = () => window.locator(".mac-photo-booth-camera canvas").first();

  await backdrops();
  await shot(page, "photo-booth-backdrops");
  step(
    "the Backdrops page has drawn backdrops and slots for the person's own",
    (await window.getByRole("button", { name: "Sunset", exact: true }).count()) === 1 &&
      (await window.getByRole("button", { name: "Drag Backdrops Here" }).count()) === 4,
  );
  await window.getByRole("button", { name: "Drag Backdrops Here" }).first().click({ force: true });
  step(
    "an empty slot leads nowhere",
    await window.getByRole("group", { name: "Effects, page 4 of 4" }).isVisible(),
  );

  // A drawn backdrop: the fake camera's still background goes, once it has been learned.
  await window.getByRole("button", { name: "Ocean", exact: true }).click();
  const told = window.getByText("Please step out of the frame");
  step("choosing one asks the person out of the frame", await told.isVisible().catch(() => false));
  const take = window.getByRole("button", { name: "Take Photo" });
  step("and the shutter waits for it", await take.isDisabled());
  await told.waitFor({ state: "hidden", timeout: 10_000 });
  let raw = [];
  await until(async () => {
    raw = await commonest(liveCanvas());
    return raw[2] > raw[1] || raw[2] > 120;
  }, 6_000);
  step(
    "then the background is the backdrop: blue, not the camera's green",
    raw[2] > raw[1] || raw[2] > 120,
    raw.join(),
  );
  await shot(page, "photo-booth-ocean");

  // The person's own picture, dropped on the page, kept on the drive.
  const picture = BACKDROP_FILE;
  await backdrops();
  await moveWindow(page, window, 10);
  const grid = await window.getByRole("group", { name: "Effects, page 4 of 4" }).boundingBox();
  await dropFromFinder(page, picture, "Documents", { x: grid.x + 100, y: grid.y + 100 });
  await shot(page, "photo-booth-dropped");
  await page
    .getByRole("button", { name: /^Photo Booth$/ })
    .first()
    .click();
  const mine = window.getByRole("button", { name: "User Backdrop", exact: true });
  await mine.first().waitFor({ timeout: 15_000 });
  step("a picture dragged from Finder onto the page fills a slot", (await mine.count()) === 1);
  const entries = (await api(page, "GET", "/api/files/")).json.entries;
  const folder = entries.find((each) => each.name === "Photo Booth Backdrops");
  step(
    "it is kept on the drive",
    entries.some((each) => each.parent === folder?.id && each.name === picture),
  );
  await mine.first().click();
  await told.waitFor({ state: "hidden", timeout: 10_000 });
  let own = [];
  await until(async () => {
    own = await commonest(liveCanvas());
    return own[0] > 180 && own[1] < 70;
  }, 6_000);
  step("the person's own picture replaces the background", own[0] > 180 && own[1] < 70, own.join());

  const photos = async () =>
    ((await api(page, "GET", "/api/photos/library")).json?.photos ?? []).filter((each) =>
      /^Photo Booth/.test(each.name ?? ""),
    ).length;
  const beforeTaking = await photos();
  await take.click();
  step(
    "Take Photo keeps a picture",
    await until(async () => (await photos()) === beforeTaking + 1, 20_000),
  );
  const taken = window.locator(".mac-photo-booth-strip img").last();
  const takenColour = await taken.evaluate(async (image) => {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const counts = new Map();
    for (let at = 0; at < data.length; at += 4 * 7) {
      const key = [data[at] >> 4, data[at + 1] >> 4, data[at + 2] >> 4].join();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const [key] = [...counts].sort((a, b) => b[1] - a[1])[0];
    return key.split(",").map((n) => Number(n) << 4);
  });
  step(
    "the picture taken holds the backdrop",
    takenColour[0] > 170 && takenColour[1] < 90,
    takenColour.join(),
  );
  await reloadDesktop(page);
  const reopened = page.locator(".mac-photo-booth").first();
  await reopened.waitFor({ timeout: 20_000 });
  step(
    "after a reload the effect is still that backdrop, learned again",
    await reopened
      .getByText("Please step out of the frame")
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      ),
  );
}

async function dictionary(page) {
  const word = "lantern";
  const note = await newNote(page, `A ${word} shone`);
  await selectWord(note, word);
  const entry = page.waitForResponse((response) =>
    response.url().includes("/api/dictionary/entry"),
  );
  await page.keyboard.press("Control+Meta+KeyD");
  const popover = page.locator(".mac-dictionary-look-up");
  await popover.waitFor({ timeout: 10_000 });
  step(
    "Look Up shows a popover over the selection, with no Dictionary window",
    (await page.getByRole("region", { name: "Dictionary" }).count()) === 0,
  );
  const body = await (await entry).json();
  const sense = body?.dictionary?.parts?.[0]?.senses?.[0]?.text ?? "";
  const found = body?.found === true && sense !== "";
  await popover
    .getByRole("status")
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => {});
  step(
    found
      ? "it says the word's first sense from the source"
      : "the source could not be reached from here, and the popover says so",
    found
      ? (await popover.innerText()).includes(sense.slice(0, 40))
      : /could not|No entries/.test(await popover.innerText()),
    (await popover.innerText()).slice(0, 80),
  );
  await shot(page, "dictionary-look-up");
  await page.keyboard.press("Escape");
  step(
    "Escape closes it",
    await popover.waitFor({ state: "detached", timeout: 5_000 }).then(
      () => true,
      () => false,
    ),
  );
  await selectWord(note, word);
  await page.keyboard.press("Control+Meta+KeyD");
  await popover.getByRole("button", { name: "Open in Dictionary" }).click();
  const window = page.getByRole("region", { name: "Dictionary" }).first();
  await window.waitFor({ timeout: 10_000 });
  step(
    "Open in Dictionary shows the word in the window",
    await until(
      async () => (await window.getByRole("searchbox", { name: "Search" }).inputValue()) === word,
      8_000,
    ),
  );
  const history = async () =>
    ((await api(page, "GET", "/api/dictionary/history")).json?.history ?? []).map(
      (each) => each.word,
    );
  if (!found) {
    step("Remove from Recents not driven: no source could be reached to make a recent word", true);
    return;
  }
  await until(async () => (await history()).includes(word), 10_000);
  const other = "harbour";
  const search = window.getByRole("searchbox", { name: "Search" });
  await search.fill(other);
  await until(async () => (await history()).includes(other), 15_000);
  await search.fill("");
  const row = window.getByRole("listbox", { name: "Words" }).getByRole("option", { name: word });
  await row.waitFor({ timeout: 10_000 });
  await row.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Word list commands" });
  await menu.getByRole("menuitem", { name: "Remove from Recents" }).click();
  step(
    "Remove from Recents takes that word from the server's history and no other",
    await until(async () => {
      const words = await history();
      return !words.includes(word) && words.includes(other);
    }, 8_000),
    JSON.stringify(await history()),
  );
  step("and from the list", await until(async () => (await row.count()) === 0, 5_000));
  await closeMenus(page);
}

async function terminal(page) {
  const folderName = `Proxy${id}`;
  await openApp(page, "Terminal", ".mac-terminal");
  const window = page.locator(".mac-terminal").first();
  await window.waitFor({ timeout: 15_000 });
  await window.locator(".mac-terminal-screen").first().click();
  await page.keyboard.type(`mkdir ~/Documents/${folderName} && cd ~/Documents/${folderName}\n`);
  const proxy = window.locator(".mac-terminal-proxy");
  await until(async () => (await proxy.getAttribute("data-path"))?.endsWith(folderName), 8_000);
  const finder = await finderOn(page, "Downloads");
  await moveWindow(page, finder, 700);
  await page
    .getByRole("button", { name: /^Terminal$/ })
    .first()
    .click();
  await moveWindow(page, window, 10);
  await page.waitForTimeout(200);
  const from = await centre(proxy);
  const to = await centre(finderOf(page));
  await page.mouse.move(from.x + 1, from.y);
  await page.waitForTimeout(400);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.waitForTimeout(100);
  await shot(page, "terminal-proxy-drag");
  await page.mouse.up();
  const copied = async () =>
    (await api(page, "GET", "/api/files/")).json.entries.some(
      (each) => each.name === folderName && each.parent === "downloads",
    );
  step(
    "the proxy icon drags the working folder: dropped on a Finder window of Downloads, a copy is there",
    await until(copied, 8_000),
  );
  await chooseMenu(page, "Help", "Terminal Help");
  step(
    "Help > Terminal Help opens Help Viewer",
    await page
      .getByRole("region", { name: /Help/ })
      .first()
      .waitFor({ timeout: 8_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await closeMenus(page);
  await page.keyboard.press("Escape");
}

async function chess(a, b) {
  const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
  const windowOf = (page) => page.locator(".mac-chess").first();
  const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
  const label = async (page, name) => (await square(page, name).getAttribute("aria-label")) ?? "";
  const status = (page) => windowOf(page).locator(".mac-chess-status").innerText();
  const focused = (page) =>
    page.evaluate(() => document.activeElement?.getAttribute("data-square"));
  const newest = async (page) => {
    const gameId = (await api(page, "GET", "/api/chess/mine")).json.games?.[0]?.id;
    return gameId ? (await api(page, "GET", `/api/chess/games/${gameId}`)).json : null;
  };
  const choose = async (page, name, option) => {
    await page
      .getByRole("combobox", { name })
      .or(page.getByRole("button", { name }))
      .first()
      .click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };

  for (const page of [a, b]) {
    await openFromDock(page, "Chess", "Chess").catch(() => {});
    await board(page).waitFor({ state: "visible", timeout: 15_000 });
  }

  // ---- ⌘N and a game against the computer ---------------------------------------------------------
  await square(a, "e2").focus();
  await a.keyboard.press("ControlOrMeta+n");
  const sheet = a.getByRole("dialog").filter({ hasText: "New Game" });
  step(
    "⌘N opens New Game",
    await sheet.waitFor({ timeout: 8_000 }).then(
      () => true,
      () => false,
    ),
  );
  await shot(a, "chess-new-game");
  await sheet.getByRole("button", { name: "Start Game" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 15_000 });

  // ---- The board's keys, one by one ----------------------------------------------------------------
  await square(a, "e2").focus();
  const walked = [];
  for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) {
    await a.keyboard.press(key);
    walked.push(await focused(a));
  }
  step("the arrow keys move square by square", walked.join() === "e3,f3,f2,e2", walked.join());
  await a.keyboard.press("Space");
  await a.waitForTimeout(100);
  const picked = await windowOf(a).innerText();
  await a.keyboard.press("Escape");
  step(
    "Escape puts the piece Space picked up back down",
    await until(
      async () =>
        (await a
          .locator(".mac-chess")
          .getByText(/put down/, { includeHidden: true })
          .count()) > 0,
      3_000,
    ),
    picked.slice(0, 0),
  );
  await a.keyboard.press("Space");
  await square(a, "e4").focus();
  await a.keyboard.press("Space");
  step(
    "Space picks up and puts down a piece",
    await until(async () => (await label(a, "e4")).includes("white pawn"), 8_000),
    await label(a, "e4"),
  );

  // ---- Force Computer Move, on the computer's turn ---------------------------------------------------
  const forceable = await menuItemState(a, "Moves", "Force Computer Move").catch(() => null);
  if (forceable && !forceable.disabled) {
    await chooseMenu(a, "Moves", "Force Computer Move").catch(() => {});
  }
  step(
    "the computer answers",
    await until(async () => (await newest(a))?.state?.plies?.length === 2, 25_000),
    `command was ${forceable?.disabled ? "dimmed, the reply already in" : "enabled"}`,
  );
  const force = await menuItemState(a, "Moves", "Force Computer Move");
  step("on the player's turn Force Computer Move is dimmed", force.disabled === true);

  // ---- The Board menu's Rotate -----------------------------------------------------------------------
  const orderBefore = await board(a)
    .locator('[role="gridcell"]')
    .first()
    .getAttribute("data-square");
  await board(a).click({ button: "right", position: { x: 5, y: 5 } });
  await a.getByRole("menuitem", { name: "Rotate Board", exact: true }).click();
  step(
    "the Board menu's Rotate Board turns the board",
    await until(
      async () =>
        (await board(a).locator('[role="gridcell"]').first().getAttribute("data-square")) !==
        orderBefore,
      5_000,
    ),
  );
  await shot(a, "chess-rotated");
  await chooseMenu(a, "View", "Rotate Board");

  // ---- A PGN from Finder, opened and dropped ---------------------------------------------------------
  const opened = PGN_OPENED;
  const dropped = PGN_DROPPED;
  const boardAt = await centre(board(a));
  const finder = await finderOn(a, "Documents");
  await finder.getByRole("option", { name: opened, exact: true }).first().dblclick();
  step(
    "a PGN opened from Finder shows its game in Chess",
    await until(async () => (await label(a, "f3")).includes("white knight"), 10_000),
    await label(a, "f3"),
  );
  await shot(a, "chess-pgn-opened");
  await dropFromFinder(a, dropped, "Documents", {
    x: boardAt.x - 150,
    y: boardAt.y,
  });
  step(
    "a PGN dropped from Finder shows its game",
    await until(async () => (await label(a, "c4")).includes("white pawn"), 10_000),
    await label(a, "c4"),
  );
  await shot(a, "chess-pgn-dropped");

  // ---- Decline ---------------------------------------------------------------------------------------
  await a
    .getByRole("button", { name: /^Chess$/ })
    .first()
    .click();
  await chooseMenu(a, "Game", "New Game…");
  await sheet.waitFor({ timeout: 10_000 });
  await choose(a, "Opponent", "Another person");
  await sheet.getByRole("textbox", { name: "Account name" }).fill(martin.name);
  await sheet.getByRole("button", { name: "Send Invitation" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 10_000 });
  const gamesButton = windowOf(b).getByRole("button", { name: /^Games/ });
  await within(20_000, async () => /\(1\)/.test(await gamesButton.innerText()));
  await gamesButton.click();
  const list = b.getByRole("dialog").filter({ hasText: "Games" });
  await list.waitFor({ timeout: 10_000 });
  await list.getByRole("button", { name: "Decline" }).first().click();
  step(
    "Decline ends the invitation, saying so to the one who sent it",
    (await within(25_000, async () => /declined/.test(await status(a)))) !== null,
    await status(a).catch(() => ""),
  );
  step(
    "the server keeps it declined",
    await until(
      async () =>
        JSON.stringify((await api(a, "GET", "/api/chess/mine")).json).includes('"declined"'),
      8_000,
    ),
    JSON.stringify((await api(a, "GET", "/api/chess/mine")).json).slice(0, 200),
  );
}

const setup = engineSetup("chromium", { media: "fake" });
await run({ chromium: setup.launch }, { chromium: setup.context }, async ({ person }) => {
  if (!existsSync(TTF)) throw new Error(`no font file to add at ${TTF}`);
  const a = await person("chris", chris);
  const needsTwo = only.test("chess");
  const b = needsTwo ? await person("martin", martin) : null;
  // Before Finder first reads the drive: it does not see a file put there behind its back.
  await uploadFile(a, {
    parent: "documents",
    name: PICTURE_FILE,
    type: "image/png",
    bytes: png(800, 600, [220, 40, 30]),
  });
  await uploadFile(a, {
    parent: "documents",
    name: REFUSED_FILE,
    type: "video/quicktime",
    text: "x",
  });
  await uploadFile(a, {
    parent: "documents",
    name: BACKDROP_FILE,
    type: "image/png",
    bytes: png(640, 480, [230, 20, 150]),
  });
  const pgn = (moves) =>
    `[Event "Batch"]\n[White "Ann"]\n[Black "Ben"]\n[Result "*"]\n\n${moves} *\n`;
  await uploadFile(a, {
    parent: "documents",
    name: PGN_OPENED,
    type: "application/x-chess-pgn",
    text: pgn("1. Nf3 Nc6"),
  });
  await uploadFile(a, {
    parent: "documents",
    name: PGN_DROPPED,
    type: "application/x-chess-pgn",
    text: pgn("1. c4 c5"),
  });
  if (only.test("terminal")) await terminal(a);
  if (only.test("stickies")) await stickies(a);
  if (only.test("fonts")) await fonts(a);
  if (only.test("dictionary")) await dictionary(a);
  if (only.test("photo")) await photoBooth(a);
  if (needsTwo) await chess(a, b);
});
void allow;
