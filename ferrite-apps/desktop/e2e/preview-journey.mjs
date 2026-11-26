#!/usr/bin/env node
// Preview on Ferrite: get Preview from the session's library, put a real picture and a real
// two-page PDF on the person's drive, and work with them in Preview the way a person does:
// open the picture from the drive, zoom and turn it, draw a rectangle and type a text on it
// (kept beside the file on the server, and found again after a reload), crop it and save it in
// place (the drive's file is replaced by the turned, cropped picture), export it as a PDF to the
// drive; then open the PDF, see a thumbnail per page drawn by pdf.js, go to page 2, find a word,
// draw an arrow and a new signature on it, export the marked-up PDF and download a page as PNG.
// Show Inspector reads the document's name, kind, size and dimensions. Preview keeps where each
// file was left (Open Recent): after a reload, and after `ferrite dev` is stopped and started
// again on the same data root (--restart-command), it reopens the last document at its page and
// zoom instead of the Open dialog. A damaged picture is refused with a message, a text file is
// not offered for opening, and another person sees none of these places.
// Exits 0 only when every step passed and the page logged no console error, page error, failed
// request or HTTP error. It removes what it made at the end, and only that.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/preview-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                [--browser chromium|chrome|firefox|webkit]
//                                [--restart-command "<shell command>"]

import { execSync } from "node:child_process";
import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { sameDownloadName } from "./journey-kit.mjs";

const LIBRARY = "/api/app-store/library";
const PLACES = "/api/preview/places";
// Names of this run's own: no file the session had, or another run makes, has them.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PICTURE = `Journey Picture ${RUN}.png`;
const TIMETABLE = `Journey Timetable ${RUN}.pdf`;
const MARKED = `Journey Timetable ${RUN} marked.pdf`;
const PICTURE_PDF = `Journey Picture ${RUN}.pdf`;
const BROKEN = `Journey Broken ${RUN}.png`;
const NOTES = `Journey Notes ${RUN}.txt`;
const { base, out, browserName } = options();
const restartAt = process.argv.indexOf("--restart-command");
const restartCommand = restartAt >= 0 ? process.argv[restartAt + 1] : undefined;
const { step, run } = journey("preview");

/** Wait until `check` answers true (polled), answering whether it did. */
async function until(check, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

/** Where the person left each file, as the server keeps it. */
const placesKept = async (page) => (await api(page, "GET", PLACES)).json.places ?? [];
/** A menu of the menu bar (rendered before any window, so the first of its name). */
const menuTitle = (page, name) =>
  page
    .getByRole("menuitem", { name, exact: true })
    .or(page.getByRole("button", { name, exact: true }))
    .first();
const openDialog = (page) => page.getByRole("dialog", { name: "Open" });
const finderDockButton = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

/** Waits until the window shows `name` (its title starts with it) and has settled. */
async function showing(page, name, timeout = 20_000) {
  const shown = await until(
    async () => (await title(page).textContent())?.startsWith(name) ?? false,
    timeout,
  );
  if (shown) await settled(page);
  return shown;
}

/** A PDF of one page per text, in Helvetica: the file a person would bring. */
function makePdf(texts) {
  const objects = [];
  const pageIds = texts.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${texts.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  texts.forEach((text, index) => {
    const id = pageIds[index];
    const stream = `BT /F1 28 Tf 72 700 Td (${text}) Tj ET 0 0 1 rg 72 400 200 120 re f`;
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

/**
 * Uploads a file onto the drive from inside the page, with the drive's own piece-wise protocol.
 * `source` is either `{ text, type }` or `{ picture: true }` for a 400 x 300 PNG drawn in the page:
 * red on its left half, blue on its right half.
 */
function upload(page, parent, name, source) {
  return page.evaluate(
    async ({ parent, name, source }) => {
      let blob;
      if (source.picture) {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 300;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ff0000";
        context.fillRect(0, 0, 200, 300);
        context.fillStyle = "#0000ff";
        context.fillRect(200, 0, 200, 300);
        blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      } else {
        blob = new Blob([source.text], { type: source.type });
      }
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size: blob.size, type: blob.type, existing: "fail" }),
      }).then((response) => response.json());
      for (let index = 0; index < started.pieces; index += 1) {
        const piece = blob.slice(index * started.piece_bytes, (index + 1) * started.piece_bytes);
        const put = await fetch(`/api/files/uploads/${started.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await piece.arrayBuffer(),
        });
        if (!put.ok) throw new Error(`piece ${index}: ${put.status}`);
      }
      const done = await fetch(`/api/files/uploads/${started.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      }).then((response) => response.json());
      return done.entries.find((entry) => entry.id === done.created[0]);
    },
    { parent, name, source },
  );
}

/** The drive's entries now. */
const entries = async (page) => (await api(page, "GET", "/api/files/")).json.entries ?? [];

/** The first bytes of a drive file, as text, and the picture's size when it is one. */
function readBack(page, id) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/files/content/${encodeURIComponent(id)}?piece=0&count=8`, {
      credentials: "same-origin",
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const head = new TextDecoder("latin1").decode(bytes.slice(0, 8));
    const all = new TextDecoder("latin1").decode(bytes);
    let size = null;
    let colours = null;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (png) {
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      size = { width: bitmap.width, height: bitmap.height };
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let red = 0;
      let blue = 0;
      for (let at = 0; at < data.length; at += 4) {
        if (data[at] > 200 && data[at + 2] < 60) red += 1;
        if (data[at + 2] > 200 && data[at] < 60) blue += 1;
      }
      colours = { red, blue };
    }
    return {
      head,
      length: bytes.length,
      size,
      colours,
      count: all.match(/\/Count (\d+)/)?.[1] ?? null,
    };
  }, id);
}

/**
 * Whether a canvas of the page comes to have pixels drawn that are not all one colour, within
 * `timeout`: a canvas keeps its blank default size until its page is drawn.
 */
async function drawn(page, selector, timeout = 20_000) {
  const check = () =>
    page.evaluate((selector) => {
      const canvas = document.querySelector(selector);
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 2) return false;
      const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      const first = `${data[0]},${data[1]},${data[2]},${data[3]}`;
      for (let at = 4; at < data.length; at += 4 * 97) {
        if (`${data[at]},${data[at + 1]},${data[at + 2]},${data[at + 3]}` !== first) return true;
      }
      return false;
    }, selector);
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check()) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

const previewWindow = (page) => page.locator(".mac-preview-app").first();
const title = (page) => previewWindow(page).locator(".mac-title-bar-title-text").first();

async function launchPreview(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Preview");
  await field.press("Enter");
  await previewWindow(page).waitFor({ state: "visible", timeout: 15_000 });
}

/** Opens `name` from the Open dialog's Pictures folder. */
async function openFromDialog(page, name) {
  const dialog = page.getByRole("dialog", { name: "Open" });
  if (!(await dialog.isVisible().catch(() => false))) {
    await previewWindow(page).getByRole("button", { name: "Open…" }).first().click();
  }
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  // The sheet slides in and its list refreshes from the drive: let both settle.
  await page.waitForTimeout(800);
  const option = dialog.getByRole("option", { name });
  await option.waitFor({ timeout: 10_000 });
  try {
    await option.dblclick({ timeout: 10_000 });
  } catch {
    await page.waitForTimeout(500);
    await option.dblclick({ timeout: 10_000 });
  }
  await page.waitForFunction(
    (name) =>
      document
        .querySelector(".mac-preview-app .mac-title-bar-title-text")
        ?.textContent?.startsWith(name),
    name,
    { timeout: 20_000 },
  );
  await settled(page);
}

/**
 * Waits while the window says it is busy (`aria-busy`): an operation under way, or the markup
 * and signatures kept for the file still loading, during which it takes no edit.
 */
async function settled(page) {
  await page.waitForFunction(
    () => document.querySelector(".mac-preview-app")?.getAttribute("aria-busy") !== "true",
    undefined,
    { timeout: 20_000 },
  );
}

/** Drags on the markup canvas of page `number`, from and to fractions of its box. */
async function drag(page, number, [ax, ay], [bx, by]) {
  const target = page.locator(`[data-page="${number}"] .mac-preview-app-page-marks`).first();
  const box = await target.boundingBox();
  await page.mouse.move(box.x + ax * box.width, box.y + ay * box.height);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(
      box.x + (ax + ((bx - ax) * i) / 8) * box.width,
      box.y + (ay + ((by - ay) * i) / 8) * box.height,
    );
  }
  await page.mouse.up();
}

const markupSave = (page, id) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === `/api/preview/markup/${id}`,
    { timeout: 15_000 },
  );

async function chooseTool(page, name) {
  await page
    .getByRole("toolbar", { name: "Markup" })
    .getByRole("button", { name, exact: true })
    .click();
}

async function chooseShape(page, name) {
  await page
    .getByRole("toolbar", { name: "Markup" })
    .getByRole("button", { name: "Shapes" })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

async function fileMenu(page, item) {
  await previewWindow(page).getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

/** Exports the open document through File > Export… as `format` under `name`. */
async function exportAs(page, format, name) {
  await fileMenu(page, "Export…");
  const sheet = page.getByRole("dialog", { name: "Export the document" });
  await sheet.waitFor({ timeout: 10_000 });
  await sheet.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: format, exact: true }).click();
  const field = sheet.getByRole("textbox", { name: "Save As:" });
  // The dialog is made again for the new format, with the name in its extension: type once it
  // has settled, and check what the field holds before saving.
  await page.waitForTimeout(400);
  for (let tries = 0; tries < 5 && (await field.inputValue()) !== name; tries += 1) {
    await field.fill(name);
    await page.waitForTimeout(150);
  }
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/files\/uploads\/[^/]+\/complete$/.test(new URL(response.url()).pathname),
    { timeout: 60_000 },
  );
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  return (await saved).status();
}

async function walk(page, made) {
  await openDesktop(page, base, step);
  const library = await api(page, "GET", LIBRARY);
  const installed = library.json.installed ?? [];
  const got = await api(page, "PUT", LIBRARY, {
    installed: [...installed.filter((id) => id !== "preview"), "preview"],
    rev: library.json.rev,
  });
  if (got.status === 200 && !installed.includes("preview")) made.installed = true;
  step("Preview is in the session's library", got.status === 200, `status ${got.status}`);
  // The signatures the person has already: the journey removes only the one it makes.
  const heldBefore = await api(page, "GET", "/api/preview/signatures");
  made.signaturesBefore = new Set((heldBefore.json.signatures ?? []).map((each) => each.id));

  const picture = await upload(page, "pictures", PICTURE, { picture: true });
  // Each file is recorded for the cleanup as soon as it exists.
  made.files.push(picture?.id);
  const pdf = await upload(page, "pictures", TIMETABLE, {
    text: makePdf(["Harbour timetable", "The ferry leaves at ten"]),
    type: "application/pdf",
  });
  made.files.push(pdf?.id);
  step(
    "a picture and a PDF are on the drive",
    Boolean(picture?.id && pdf?.id),
    `${picture?.size} and ${pdf?.size} bytes`,
  );
  await reloadDesktop(page);

  // The picture.
  await launchPreview(page);
  step(
    "with nothing opened before, Preview opens with its Open dialog on the drive",
    await openDialog(page)
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await openFromDialog(page, PICTURE);
  step(
    "the picture is read from the drive and drawn",
    await drawn(page, '[data-page="1"] .mac-preview-app-page-canvas'),
  );

  // Show Inspector: General Info of the picture; hidden again from the menu bar's Tools menu.
  await previewWindow(page).getByRole("button", { name: "Show Inspector" }).click();
  const inspector = previewWindow(page).locator(".mac-preview-app-inspector");
  await inspector.waitFor({ timeout: 5_000 });
  const info = (await inspector.innerText()).replace(/\s+/g, " ");
  step(
    "Show Inspector shows the picture's name, kind, size and dimensions",
    info.includes(PICTURE) &&
      info.includes("PNG image") &&
      info.includes("400 × 300 pixels") &&
      /\d+ (bytes|KB)/.test(info),
    info,
  );
  await menuTitle(page, "Tools").click();
  await page.getByRole("menuitem", { name: "Hide Inspector", exact: true }).click();
  step(
    "Tools > Hide Inspector in the menu bar hides it",
    await inspector.waitFor({ state: "hidden", timeout: 5_000 }).then(
      () => true,
      () => false,
    ),
  );

  const leaf = page.locator('[data-page="1"]').first();
  const before = await leaf.boundingBox();
  await previewWindow(page).getByRole("button", { name: "Zoom In" }).click();
  await page.waitForTimeout(300);
  const zoomed = await leaf.boundingBox();
  step(
    "Zoom In makes the picture larger",
    zoomed.width > before.width * 1.2,
    `${Math.round(before.width)} to ${Math.round(zoomed.width)}`,
  );
  await previewWindow(page).getByRole("button", { name: "Zoom Out" }).click();

  await previewWindow(page).getByRole("button", { name: "Rotate Right" }).click();
  await page.waitForTimeout(200);
  const turned = await leaf.boundingBox();
  step(
    "Rotate Right turns the picture upright",
    turned.height > turned.width,
    `${Math.round(turned.width)} x ${Math.round(turned.height)}`,
  );
  step(
    "the title says the picture is edited",
    (await title(page).textContent()).includes("Edited"),
  );

  // Markup: a rectangle and a text, kept beside the file.
  await previewWindow(page).getByRole("button", { name: "Show Markup Toolbar" }).click();
  await chooseShape(page, "Rectangle");
  let saved = markupSave(page, picture.id);
  await drag(page, 1, [0.2, 0.2], [0.6, 0.4]);
  step("a drawn rectangle is saved beside the file", (await saved).status() === 200);
  await chooseTool(page, "Text");
  await drag(page, 1, [0.2, 0.7], [0.2, 0.7]);
  const field = previewWindow(page).getByRole("textbox", { name: "Text" });
  await field.waitFor({ timeout: 5_000 });
  await field.fill("Approved");
  saved = markupSave(page, picture.id);
  await field.press("Enter");
  step("a typed text is saved beside the file", (await saved).status() === 200);
  // The picture is turned: the text is read where it was typed, upright, as the box showed it.
  const ink = await page.evaluate(() => {
    const canvas = document.querySelector('[data-page="1"] .mac-preview-app-page-marks');
    const { width, height } = canvas;
    const top = Math.floor(height * 0.6);
    const { data } = canvas.getContext("2d").getImageData(0, top, width, height - top);
    const box = { left: width, right: 0, top: height, bottom: 0 };
    const dashes = { left: width, top: height };
    for (let y = top; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y - top) * width * 4 + x * 4;
        if (data[at + 3] < 128) continue;
        // The blue of the selection's dashes, the box the text is picked up by.
        if (data[at + 2] > 128) {
          dashes.left = Math.min(dashes.left, x / width);
          dashes.top = Math.min(dashes.top, y / height);
          continue;
        }
        box.left = Math.min(box.left, x / width);
        box.right = Math.max(box.right, x / width);
        box.top = Math.min(box.top, y / height);
        box.bottom = Math.max(box.bottom, y / height);
      }
    }
    return {
      ...box,
      dashes,
      wide: (box.right - box.left) * width,
      high: (box.bottom - box.top) * height,
    };
  });
  step(
    "text typed on a turned picture reads upright, from where it was typed",
    ink.wide > ink.high * 2 &&
      Math.abs(ink.left - 0.2) < 0.03 &&
      Math.abs(ink.top - 0.7) < 0.03 &&
      Math.abs(ink.dashes.left - ink.left) < 0.03 &&
      Math.abs(ink.dashes.top - ink.top) < 0.03,
    JSON.stringify(ink),
  );
  await shot(page, path.join(out, "preview-text-on-turned-page.png"));

  // The Edit menu of the menu bar, on the text still selected.
  const editRow = async (name) => {
    await menuTitle(page, "Edit").click();
    const row = page.getByRole("menuitem", { name, exact: true });
    await row.waitFor({ timeout: 5_000 });
    return row;
  };
  const edit = async (name) => {
    saved = markupSave(page, picture.id);
    await (await editRow(name)).click();
    return (await saved).status() === 200;
  };
  const textsKept = async () =>
    (await api(page, "GET", `/api/preview/markup/${picture.id}`)).json.markup.pages[0].items.filter(
      (mark) => mark.kind === "text",
    ).length;
  await (await editRow("Copy")).click();
  step(
    "Edit > Paste adds a copy of the selected text",
    (await edit("Paste")) && (await textsKept()) === 2,
  );
  await editRow("Undo");
  await shot(page, path.join(out, "preview-edit-menu.png"));
  await page.keyboard.press("Escape");
  step("Edit > Delete removes it", (await edit("Delete")) && (await textsKept()) === 1);
  step("Edit > Undo puts it back", (await edit("Undo")) && (await textsKept()) === 2);
  step("Edit > Redo removes it again", (await edit("Redo")) && (await textsKept()) === 1);
  step(
    "Edit > Delete is dimmed with nothing selected",
    await (await editRow("Delete")).isDisabled(),
  );
  await page.keyboard.press("Escape");
  const stored = (await api(page, "GET", `/api/preview/markup/${picture.id}`)).json.markup;
  const kinds = stored?.pages?.[0]?.items?.map((mark) => mark.kind) ?? [];
  step(
    "the server keeps the rectangle and the text",
    kinds.join(",") === "rect,text",
    kinds.join(","),
  );

  await reloadDesktop(page);
  await launchPreview(page);
  const reopenedPicture = await showing(page, PICTURE);
  step(
    "after a reload, Preview reopens the picture by itself, without the Open dialog",
    reopenedPicture && !(await openDialog(page).isVisible()),
  );
  step(
    "after a reload, the markup is drawn again over the picture",
    await drawn(page, '[data-page="1"] .mac-preview-app-page-marks'),
  );

  // Turn, crop and save in place.
  await previewWindow(page).getByRole("button", { name: "Rotate Right" }).click();
  await previewWindow(page).getByRole("button", { name: "Show Markup Toolbar" }).click();
  await chooseTool(page, "Rectangular Selection");
  await drag(page, 1, [0.004, 0.004], [0.996, 0.5]);
  await page
    .getByRole("toolbar", { name: "Markup" })
    .getByRole("button", { name: "Crop", exact: true })
    .click();
  const replaced = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/complete$/.test(new URL(response.url()).pathname),
    { timeout: 30_000 },
  );
  await fileMenu(page, "Save");
  step("Save writes the picture back to the drive", (await replaced).status() === 200);
  await page.getByText(`Saved “${PICTURE}”.`).waitFor({ timeout: 15_000 });
  await settled(page);
  const now = await entries(page);
  const savedPicture = now.find(
    (entry) =>
      entry.name === PICTURE && entry.parent === "pictures" && entry.trashed_ms === undefined,
  );
  if (savedPicture) made.files.push(savedPicture.id);
  const back = savedPicture ? await readBack(page, savedPicture.id) : null;
  step(
    "the saved picture is turned and cropped: 300 x 200 from 400 x 300",
    back?.size && Math.abs(back.size.width - 300) <= 4 && Math.abs(back.size.height - 200) <= 4,
    JSON.stringify(back?.size),
  );
  step(
    "the crop kept the red half (the top after the turn is the left of the original)",
    back?.colours && back.colours.red > back.colours.blue * 5,
    JSON.stringify(back?.colours),
  );
  step(
    "the file it replaced went to the Trash",
    now.some((entry) => entry.id === picture.id && entry.trashed_ms !== undefined),
  );
  // The saved picture is a new file with no markup beside it (its marks are in its pixels),
  // while the original in the Trash keeps its own, to come back with it if it is put back.
  const newMarkup = savedPicture
    ? (await api(page, "GET", `/api/preview/markup/${savedPicture.id}`)).json.markup
    : undefined;
  const oldMarkup = (await api(page, "GET", `/api/preview/markup/${picture.id}`)).json.markup;
  step(
    "the markup is in the saved picture, and the original in the Trash keeps its own",
    newMarkup === null && (oldMarkup?.pages ?? []).length > 0,
  );

  const exported = await exportAs(page, "PDF", PICTURE_PDF);
  const afterExport = await entries(page);
  const pdfCopy = afterExport.find((entry) => entry.name === PICTURE_PDF);
  if (pdfCopy) made.files.push(pdfCopy.id);
  const pdfBack = pdfCopy ? await readBack(page, pdfCopy.id) : null;
  step(
    "Export as PDF writes a one-page PDF to the drive",
    exported === 200 && pdfBack?.head === "%PDF-1.4" && pdfBack.count === "1",
    JSON.stringify(
      pdfBack
        ? { head: pdfBack.head, count: pdfBack.count }
        : afterExport.filter((entry) => entry.parent === "pictures").map((entry) => entry.name),
    ),
  );

  // The PDF.
  await openFromDialog(page, TIMETABLE);
  step(
    "the PDF opens on page 1 of 2",
    (await title(page).textContent()).startsWith(`${TIMETABLE} (page 1 of 2)`),
  );
  const thumbnails = page.getByRole("listbox", { name: "Thumbnails" }).getByRole("option");
  step("the sidebar has a thumbnail for each page", (await thumbnails.count()) === 2);
  step("pdf.js draws the page", await drawn(page, '[data-page="1"] .mac-preview-app-page-canvas'));
  step("pdf.js draws the thumbnail", await drawn(page, ".mac-preview-app-thumbnail-page canvas"));
  await thumbnails.nth(1).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".mac-preview-app .mac-title-bar-title-text")
        ?.textContent?.includes("page 2 of 2"),
    null,
    { timeout: 10_000 },
  );
  step("choosing the second thumbnail goes to page 2", true);

  await previewWindow(page).getByRole("searchbox", { name: "Search" }).fill("ferry");
  await page.getByText("Found on 1 page").waitFor({ timeout: 15_000 });
  step(
    "a search finds the word on its page",
    await page.getByRole("listbox", { name: "Pages found" }).getByText("Page 2").isVisible(),
  );

  // Edit > Find, and its keys, on a letter both pages have.
  const searchBox = previewWindow(page).getByRole("searchbox", { name: "Search" });
  const onPage = (number) =>
    page.waitForFunction(
      (wanted) =>
        document
          .querySelector(".mac-preview-app .mac-title-bar-title-text")
          ?.textContent?.includes(`page ${wanted} of 2`),
      number,
      { timeout: 10_000 },
    );
  await searchBox.fill("a");
  await page.getByText("Found on 2 pages").waitFor({ timeout: 15_000 });
  await searchBox.press("Meta+Shift+g");
  await onPage(1);
  step("Shift-Command-G goes to the previous page found", true);
  await searchBox.press("Meta+g");
  await onPage(2);
  step("Command-G goes to the next page found", true);
  await menuTitle(page, "Edit").click();
  await page.getByRole("menuitem", { name: "Find", exact: true }).click();
  await page.getByRole("menuitem", { name: "Find Previous", exact: true }).click();
  await onPage(1);
  step("Edit > Find > Find Previous goes to the previous page found", true);
  await menuTitle(page, "Edit").click();
  await page.getByRole("menuitem", { name: "Find", exact: true }).click();
  await page.getByRole("menuitem", { name: "Find Next", exact: true }).click();
  await onPage(2);
  step("Edit > Find > Find Next goes to the next page found", true);
  await menuTitle(page, "Edit").click();
  await page.getByRole("menuitem", { name: "Find", exact: true }).click();
  await page.getByRole("menuitem", { name: "Find Next", exact: true }).waitFor();
  await shot(page, path.join(out, "preview-find-menu.png"));
  await page.getByRole("menuitem", { name: "Find…", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Search");
  step("Edit > Find > Find… puts the cursor in the search field", true);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await previewWindow(page).getByRole("listbox", { name: "Thumbnails" }).click();
  await page.keyboard.press("Meta+f");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Search");
  step("Command-F puts the cursor in the search field", true);
  await searchBox.fill("ferry");
  await page.getByText("Found on 1 page").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Done", exact: true }).click();

  // The Go menu and its keys.
  const go = async (name) => {
    await menuTitle(page, "Go").click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  };
  await go("Previous");
  await onPage(1);
  step("Go > Previous goes to page 1", true);
  await go("Next");
  await onPage(2);
  step("Go > Next goes to page 2", true);
  await menuTitle(page, "Go").click();
  await page.getByRole("menuitem", { name: "Back", exact: true }).waitFor();
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "preview-go-menu.png"));
  await page.getByRole("menuitem", { name: "Go to Page…", exact: true }).click();
  const pageField = page.getByRole("textbox", { name: "Page" });
  await pageField.fill("1");
  await page.waitForTimeout(600);
  await shot(page, path.join(out, "preview-go-to-page.png"));
  await pageField.press("Enter");
  await onPage(1);
  step("Go to Page… goes to the page typed", true);
  await go("Back");
  await onPage(2);
  step("Go > Back returns to the page before", true);
  await go("Forward");
  await onPage(1);
  step("Go > Forward undoes Back", true);
  const windowKey = async (key, number, name) => {
    await previewWindow(page).getByRole("button", { name: "Rotate Right" }).focus();
    await page.keyboard.press(key);
    await onPage(number);
    step(name, true);
  };
  await windowKey("PageDown", 2, "Page Down goes to the next page");
  await windowKey("PageUp", 1, "Page Up goes to the previous page");
  await windowKey("End", 2, "End goes to the last page");
  await windowKey("Home", 1, "Home goes to the first page");
  await windowKey("Meta+ArrowDown", 2, "Command-Down goes to the next page");
  await windowKey("Meta+ArrowUp", 1, "Command-Up goes to the previous page");
  await windowKey("Meta+[", 2, "Command-[ goes back");

  await chooseShape(page, "Arrow");
  saved = markupSave(page, pdf.id);
  await drag(page, 2, [0.2, 0.2], [0.5, 0.4]);
  step("an arrow on page 2 is saved beside the PDF", (await saved).status() === 200);
  await page.getByRole("toolbar", { name: "Markup" }).getByRole("button", { name: "Sign" }).click();
  await page.getByRole("menuitem", { name: "Create Signature…" }).click();
  const pad = page.getByRole("img", { name: "Signature pad" });
  await pad.waitFor({ timeout: 5_000 });
  // The sheet slides down from the title bar: draw once it has stopped.
  let padBox = await pad.boundingBox();
  for (let tries = 0; tries < 40; tries += 1) {
    await page.waitForTimeout(100);
    const next = await pad.boundingBox();
    if (next && padBox && next.y === padBox.y && next.y > 0) break;
    padBox = next;
  }
  await page.mouse.move(padBox.x + 40, padBox.y + 100);
  await page.mouse.down();
  for (const [x, y] of [
    [80, 40],
    [120, 110],
    [160, 50],
    [220, 90],
    [300, 60],
  ])
    await page.mouse.move(padBox.x + x, padBox.y + y);
  await page.mouse.up();
  const signatureSaved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === "/api/preview/signatures",
    { timeout: 15_000 },
  );
  saved = markupSave(page, pdf.id);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const signatureResponse = await signatureSaved;
  step("the new signature is kept for the person", signatureResponse.status() === 200);
  // The signature this run made, by the id its own save sent (the newest comes first), so
  // the cleanup removes that one and no other, whatever else the person or another run keeps.
  const sent = JSON.parse(signatureResponse.request().postData() ?? "{}");
  const ownSignature = sent.signatures?.[0]?.id;
  if (ownSignature && !made.signaturesBefore?.has(ownSignature)) made.signatures = [ownSignature];
  step("the signature is placed on the page and saved", (await saved).status() === 200);
  const pdfMarks = (await api(page, "GET", `/api/preview/markup/${pdf.id}`)).json.markup;
  const pdfKinds = (pdfMarks?.pages ?? [])
    .flatMap((entry) => entry.items.map((mark) => mark.kind))
    .sort();
  step(
    "the server keeps the arrow and the signature",
    pdfKinds.join(",") === "arrow,signature",
    pdfKinds.join(","),
  );

  const markedStatus = await exportAs(page, "PDF", MARKED);
  const marked = (await entries(page)).find((entry) => entry.name === MARKED);
  if (marked) made.files.push(marked.id);
  const markedBack = marked ? await readBack(page, marked.id) : null;
  step(
    "the marked-up PDF is exported with both pages",
    markedStatus === 200 && markedBack?.head === "%PDF-1.4" && markedBack.count === "2",
    JSON.stringify(markedBack && { count: markedBack.count, length: markedBack.length }),
  );

  const download = page.waitForEvent("download", { timeout: 30_000 });
  await fileMenu(page, "Download as PNG");
  const file = await download;
  step(
    "Download as PNG hands the page to the computer",
    sameDownloadName(file.suggestedFilename(), TIMETABLE.replace(/\.pdf$/, ".png"), browserName),
    file.suggestedFilename(),
  );
  await shot(page, path.join(out, `preview-${browserName}.png`));

  // Where the PDF was left: page 2, zoomed in once; kept on the server.
  await previewWindow(page).getByRole("button", { name: "Zoom In" }).click();
  const leafTwo = page.locator('[data-page="2"]').first();
  await page.waitForTimeout(300);
  const widthLeft = (await leafTwo.boundingBox())?.width ?? 0;
  const keptPdf = await until(async () => {
    const first = (await placesKept(page))[0];
    return first?.file === pdf.id && first.page === 2 && Math.abs(first.zoom - 1.25) < 0.001;
  });
  step(
    "the server keeps where the PDF was left: page 2, zoomed in",
    keptPdf,
    JSON.stringify((await placesKept(page))[0]),
  );
  await previewWindow(page).getByRole("button", { name: "Show Inspector" }).click();
  const pdfInfo = (await inspector.innerText()).replace(/\s+/g, " ");
  step(
    "the Inspector shows the PDF's kind and its two pages",
    pdfInfo.includes("PDF document") &&
      pdfInfo.includes("Pages: 2") &&
      pdfInfo.includes("612 × 792 points"),
    pdfInfo,
  );
  await previewWindow(page).getByRole("button", { name: "Show Inspector" }).click();

  await reloadDesktop(page);
  await launchPreview(page);
  const reopenedPdf = await showing(page, `${TIMETABLE} (page 2 of 2)`);
  await page.waitForTimeout(300);
  const widthAgain = (await leafTwo.boundingBox())?.width ?? 0;
  step(
    "after a reload, Preview reopens the PDF at page 2 and its zoom, without the Open dialog",
    reopenedPdf && !(await openDialog(page).isVisible()) && Math.abs(widthAgain - widthLeft) <= 2,
    `${await title(page).textContent()}; ${Math.round(widthLeft)} then ${Math.round(widthAgain)}`,
  );

  // Open Recent lists the files opened, newest first, and reopens the picture.
  await previewWindow(page).getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Open Recent", exact: true }).click();
  const recent = page.getByRole("menuitem", { name: PICTURE, exact: true });
  await recent.waitFor({ timeout: 5_000 });
  const listed = await page
    .getByRole("menuitem", { name: /^Journey (Timetable|Picture) / })
    .allTextContents();
  await recent.click();
  step(
    "File > Open Recent lists the PDF and the picture, and reopens the picture",
    listed.includes(TIMETABLE) && listed.includes(PICTURE) && (await showing(page, PICTURE)),
    JSON.stringify(listed),
  );

  // A damaged picture: refused with a message, and the picture stays open.
  const broken = await upload(page, "pictures", BROKEN, {
    text: "These bytes are not a picture.",
    type: "image/png",
  });
  made.files.push(broken?.id);
  const notes = await upload(page, "pictures", NOTES, {
    text: "Ferry at ten, harbour at noon.\n",
    type: "text/plain",
  });
  made.files.push(notes?.id);
  // Files put on the drive from outside show in the Open dialog once the desktop loads again
  // (Preview then reopens the picture, the last opened).
  await reloadDesktop(page);
  await launchPreview(page);
  await showing(page, PICTURE);
  await previewWindow(page).getByRole("button", { name: "Open…" }).first().click();
  const dialog = openDialog(page);
  await dialog.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await dialog.getByRole("option", { name: BROKEN }).dblclick();
  const refusal = page.getByRole("alertdialog").or(page.getByRole("dialog")).filter({
    hasText: "could not be opened",
  });
  await refusal.first().waitFor({ timeout: 15_000 });
  const refusalText = (await refusal.first().innerText()).replace(/\s+/g, " ");
  await refusal.first().getByRole("button", { name: "OK" }).click();
  step(
    "a damaged picture is refused with a message naming it, and the picture stays open",
    refusalText.includes(`“${BROKEN}” could not be opened`) &&
      (await title(page).textContent()).startsWith(PICTURE),
    refusalText,
  );

  // A text file is listed but not offered for opening: Open stays dimmed.
  await previewWindow(page).getByRole("button", { name: "Open…" }).first().click();
  await dialog.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await dialog.getByRole("option", { name: NOTES }).click();
  const openButton = dialog.getByRole("button", { name: "Open", exact: true });
  step("a text file is not offered for opening: Open stays dimmed", await openButton.isDisabled());
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

  // Stop `ferrite dev` and start it again on the same data root: Preview reopens the picture.
  if (restartCommand) {
    await until(async () => (await placesKept(page))[0]?.name === PICTURE);
    await page.waitForTimeout(1_500);
    await page.goto("about:blank");
    let restarted = true;
    try {
      execSync(restartCommand, { stdio: "inherit", timeout: 420_000 });
    } catch (error) {
      restarted = false;
      console.log(`restart command failed: ${error}`);
    }
    step("ferrite dev stops and starts again on the same data root", restarted);
    await page.goto(`${base}/`, { waitUntil: "load" });
    const back = await finderDockButton(page)
      .waitFor({ timeout: 30_000 })
      .then(
        () => true,
        () => false,
      );
    step("after the restart, the session's desktop is back", back);
    await launchPreview(page);
    step(
      "after the restart, Preview reopens the picture where it was left, without the Open dialog",
      (await showing(page, PICTURE, 30_000)) && !(await openDialog(page).isVisible()),
    );
    const afterRestart = await placesKept(page);
    step(
      "after the restart the server still keeps both places, the picture's first",
      afterRestart[0]?.name === PICTURE &&
        afterRestart.some((each) => each.file === pdf.id && each.page === 2),
      JSON.stringify(afterRestart.map((each) => [each.name, each.page])),
    );
  } else {
    console.log("skip ferrite dev restart (no --restart-command given): not exercised");
  }

  // A file dragged from Finder opens in the Preview window it lands on.
  const dropped = `Dropped ${RUN}.png`;
  const droppedFile = await upload(page, "documents", dropped, { picture: true });
  made.files.push(droppedFile?.id);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const row = finder.getByRole("option", { name: dropped, exact: true });
  await row.waitFor({ timeout: 15_000 });
  const from = await row.boundingBox();
  const target = await previewWindow(page).boundingBox();
  const finderBox = await finder.boundingBox();
  // Finder's window covers Preview but for the strip on its left.
  const spot = { x: (target.x + finderBox.x) / 2, y: target.y + target.height / 2 };
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 4 });
  await page.mouse.move(spot.x, spot.y, { steps: 10 });
  const accepting = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest(".mac-preview-app")
        ?.querySelector(".mac-preview-body")
        ?.closest("[data-desktop-drop]")
        ?.getAttribute("data-desktop-drop") ??
      document.elementFromPoint(x, y)?.closest("[data-desktop-drop]")?.className,
    spot,
  );
  await shot(page, path.join(out, "preview-drop-from-finder.png"));
  await page.mouse.up();
  step("a file dragged from Finder is offered to Preview", accepting === "accept", `${accepting}`);
  await page.waitForFunction(
    (name) =>
      document
        .querySelector(".mac-preview-app .mac-title-bar-title-text")
        ?.textContent?.includes(name),
    dropped,
    { timeout: 15_000 },
  );
  step("a file dropped from Finder opens in Preview", true, dropped);

  // Another person: none of these places.
  const otherContext = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const other = await otherContext.newPage();
    await openDesktop(other, base, step);
    const theirs = (await api(other, "GET", PLACES)).json.places ?? [];
    step("another person's Preview keeps none of these places", theirs.length === 0);
  } finally {
    await otherContext.close();
  }
}

async function cleanup(page, made) {
  // Only what this run made: the files it recorded by id, and the signature it added.
  const all = await entries(page);
  const ours = all.filter((entry) => made.files.includes(entry.id));
  if (ours.length > 0) {
    await api(page, "POST", "/api/files/ops", {
      ops: ours.map((entry) => ({ op: "delete", id: entry.id })),
    });
  }
  for (const id of new Set(made.files.filter(Boolean))) {
    // Forgets the markup at the revision just read, as the module asks.
    const kept = await api(page, "GET", `/api/preview/markup/${id}`);
    if (kept.json?.markup) {
      await api(page, "DELETE", `/api/preview/markup/${id}?rev=${kept.json.rev}`);
    }
  }
  if (made.signatures?.length) {
    const added = new Set(made.signatures);
    const current = await api(page, "GET", "/api/preview/signatures");
    await api(page, "PUT", "/api/preview/signatures", {
      signatures: (current.json.signatures ?? []).filter((each) => !added.has(each.id)),
      rev: current.json.rev,
    });
  }
  // The places of this run's files, and no other.
  const kept = await api(page, "GET", PLACES);
  const left = (kept.json.places ?? []).filter((each) => !made.files.includes(each.file));
  if ((kept.json.places ?? []).length !== left.length) {
    await api(page, "PUT", PLACES, { places: left, rev: kept.json.rev });
  }
  if (made.installed) {
    const left = await api(page, "GET", LIBRARY);
    await api(page, "PUT", LIBRARY, {
      installed: (left.json.installed ?? []).filter((id) => id !== "preview"),
      rev: left.json.rev,
    });
  }
}

await run(async (page) => {
  const made = { files: [] };
  try {
    await walk(page, made);
  } finally {
    await cleanup(page, made).catch((error) =>
      console.log(`warn cleanup did not finish: ${error}`),
    );
  }
});
