#!/usr/bin/env node
// Preview census (R3, round 3 brief section 5). The Open sheet (every place, search, Back and Forward, the view and
// location pop-ups, New Folder, Cancel, Open), what is refused and how (a text file and a HEIC picture are not offered;
// a damaged picture and a damaged PDF are refused with a message naming them), a real AVIF picture, pictures and PDFs
// (pdf.js draws pages and thumbnails), zoom, rotate, the Inspector, every markup tool, shape, line width, colour and
// text size, signatures, Adjust Size, crop, Save, Export and the downloads, search in a PDF, the sidebar's divider, the
// places (page and zoom) and markup kept per person by the server across a reload, a real same-root restart and against
// a second account, Open Recent, and the File, View, Tools and Go menus, the shared menus and the window's chrome, each
// with real input and an asserted outcome. Preview comes from the App Store: it is got first (setup); the files are put
// on the drive through the drive's own upload routes (setup).
//
//   node e2e/preview-census-journey.mjs --browser chromium|chrome|firefox|webkit [--url http://127.0.0.1:8080]
//        [--phase all|write|restart-check --state <file.json>] [--explore <seconds>] [--seed <n>] [--headed]
//   node e2e/preview-census-journey.mjs --emit-census <preview.tsv>

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  api,
  availableOrReason,
  bringToFront,
  census,
  choose,
  closeMenus,
  explore,
  goApplicationsChecks,
  goRows,
  install,
  menuItems,
  menuState,
  newAccount,
  openApp,
  R,
  reload,
  standardChecks,
  standardRows,
  until,
} from "./r3-census-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = "preview-census-journey.mjs";
const APP = "Preview";
const W = "Preview window";
const OS = "Open sheet";
const MB = "markup toolbar";
const MENUS = ["Preview", "File", "Edit", "View", "Go", "Tools", "Window", "Help"];
const PLACES = ["Recents", "Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"];
const SHAPES = ["Line", "Arrow", "Rectangle", "Oval"];
const KIND = { Line: "line", Arrow: "arrow", Rectangle: "rect", Oval: "oval" };
const STROKES = ["Thin", "Medium", "Thick"];
const COLORS = ["Black", "Red", "Orange", "Yellow", "Green", "Blue", "Purple", "White"];
const TEXT_SIZES = ["Small", "Medium", "Large"];
const FORMATS = ["JPEG", "PNG", "PDF"];
const TOOLS = [
  "Select",
  "Rectangular Selection",
  "Elliptical Selection",
  "Lasso Selection",
  "Smart Lasso",
  "Draw",
  "Adjust Color",
  "Sketch",
  "Text",
  "Shapes",
  "Sign",
  "Crop",
  "Adjust Size",
  "Shape Style",
  "Border Color",
  "Fill Color",
  "Text Style",
  "Undo",
];
const PLACES_URL = "/api/preview/places";
const slug = (t) => t.toLowerCase().replace(/\W+/g, "-").replace(/-$/, "");

const rows = [
  R(
    "preview.window.open",
    W,
    "app",
    APP,
    "Spotlight: type Preview, Return, with nothing opened before",
    "the window opens with its Open sheet on the drive",
  ),
  ...PLACES.map((p) =>
    R(`preview.open.place.${slug(p)}`, OS, "treeitem", p, `click ${p}`, `the list shows ${p}`),
  ),
  R(
    "preview.open.file",
    OS,
    "option",
    "/^R3 .+\\.(png|pdf|avif|txt|heic)$/",
    "double-click a picture or PDF",
    "it opens",
    "none",
    "kind: the files of the folder shown; this run's own files (first, middle and last of them clicked)",
  ),
  R(
    "preview.open.search",
    OS,
    "searchbox",
    "Search",
    "type part of a file's name",
    "only matching files are listed",
  ),
  R("preview.open.back", OS, "button", "Back", "after two places, click", "the previous place"),
  R("preview.open.forward", OS, "button", "Forward", "after Back, click", "the next place"),
  R("preview.open.view", OS, "combobox", "View", "choose another view", "the files show that way"),
  R(
    "preview.open.location",
    OS,
    "combobox",
    "Location",
    "open it",
    "it lists the folder and those above it; choosing one shows it",
  ),
  R(
    "preview.open.new-folder",
    OS,
    "button",
    "New Folder",
    "click",
    "a new folder is made on the drive and listed",
  ),
  R("preview.open.cancel", OS, "button", "Cancel", "click", "the sheet closes; nothing opens"),
  R(
    "preview.open.open",
    OS,
    "button",
    "Open",
    "select a picture, click; dimmed with nothing selected",
    "the picture opens",
  ),
  R(
    "preview.open.text-refused",
    OS,
    "option",
    "a text file",
    "select it",
    "not offered: Open stays dimmed",
  ),
  R(
    "preview.open.heic-refused",
    OS,
    "option",
    "a HEIC picture",
    "select it",
    "not offered: Open stays dimmed (this browser cannot show HEIC)",
  ),
  R(
    "preview.open.avif",
    OS,
    "option",
    "an AVIF picture",
    "open it",
    "drawn (red left, blue right), or refused with the reason the browser cannot show it",
  ),
  R(
    "preview.open.damaged-picture",
    OS,
    "alertdialog",
    "could not be opened",
    "open a damaged PNG",
    "refused with a message naming it; OK closes it",
  ),
  R(
    "preview.open.damaged-pdf",
    OS,
    "alertdialog",
    "could not be opened",
    "open a damaged PDF",
    "refused with a message naming it; OK closes it",
  ),
  R(
    "preview.image.drawn",
    W,
    "img",
    "the picture",
    "open a PNG from the drive",
    "its pixels are drawn",
  ),
  R(
    "preview.inspector.show",
    W,
    "button",
    "Show Inspector",
    "click",
    "the Inspector shows the file's name, kind, size and dimensions",
  ),
  R(
    "preview.inspector.pdf",
    W,
    "button",
    "Show Inspector",
    "with the PDF open",
    "PDF document, its pages and size",
  ),
  R("preview.toolbar.zoom-in", W, "button", "Zoom In", "click", "the page gets larger"),
  R("preview.toolbar.zoom-out", W, "button", "Zoom Out", "click", "the page gets smaller"),
  R(
    "preview.toolbar.view",
    W,
    "button",
    "View",
    "click",
    "its menu opens: Hide Sidebar, Thumbnails, Actual Size, Zoom to Fit",
  ),
  R(
    "preview.toolbar.view.hide-sidebar",
    "menu: View (toolbar)",
    "menuitemradio",
    "Hide Sidebar",
    "choose",
    "the sidebar hides",
  ),
  R(
    "preview.toolbar.view.thumbnails",
    "menu: View (toolbar)",
    "menuitemradio",
    "Thumbnails",
    "choose",
    "the thumbnails show",
  ),
  R(
    "preview.toolbar.view.actual-size",
    "menu: View (toolbar)",
    "menuitem",
    "Actual Size",
    "choose",
    "the page at its own size",
  ),
  R(
    "preview.toolbar.view.zoom-to-fit",
    "menu: View (toolbar)",
    "menuitem",
    "Zoom to Fit",
    "choose",
    "the page fits the window",
  ),
  R("preview.toolbar.open", W, "button", "Open…", "click", "the Open sheet shows"),
  R(
    "preview.toolbar.rotate-right",
    W,
    "button",
    "Rotate Right",
    "click on a landscape picture",
    "it turns upright; the title says Edited",
  ),
  R("preview.toolbar.rotate-left", W, "button", "Rotate Left", "click", "it turns back"),
  R("preview.toolbar.file", W, "button", "File", "click", "its menu opens"),
  R(
    "preview.file.save",
    "menu: File (toolbar)",
    "menuitem",
    "Save",
    "after a crop, choose",
    "the drive's file is replaced by the edited picture",
  ),
  R(
    "preview.file.export",
    "menu: File (toolbar)",
    "menuitem",
    "Export…",
    "choose",
    "the Export sheet opens",
  ),
  ...FORMATS.map((f) =>
    R(
      `preview.file.download-${slug(f)}`,
      "menu: File (toolbar)",
      "menuitem",
      `Download as ${f}`,
      "choose",
      `the browser saves the document as ${f}`,
    ),
  ),
  R(
    "preview.file.revert",
    "menu: File (toolbar)",
    "menuitem",
    "Revert Edits",
    "after an edit, choose",
    "the picture is as it was",
  ),
  R(
    "preview.file.remove-markup",
    "menu: File (toolbar)",
    "menuitem",
    "Remove All Markup",
    "with marks, choose",
    "every mark goes, on the server too",
  ),
  R("preview.export.format", "Export sheet", "combobox", "Format", "open it", "JPEG, PNG and PDF"),
  R(
    "preview.export.name",
    "Export sheet",
    "textbox",
    "Save As:",
    "type a name",
    "the file is saved under it",
  ),
  R(
    "preview.export.save",
    "Export sheet",
    "button",
    "Save",
    "as PDF, click",
    "a PDF of the document is written to the drive",
  ),
  R(
    "preview.export.cancel",
    "Export sheet",
    "button",
    "Cancel",
    "click",
    "the sheet closes; nothing is written",
  ),
  R(
    "preview.markup.toolbar",
    W,
    "button",
    "Show Markup Toolbar",
    "click",
    "the Markup toolbar shows",
  ),
  ...TOOLS.map((t) =>
    R(
      `preview.markup.tool.${slug(t)}`,
      MB,
      "button",
      t,
      `click ${t}`,
      "it does what it shows, or is dimmed until it can (Crop until there is a selection, Undo until there is a mark)",
    ),
  ),
  ...SHAPES.map((s) =>
    R(
      `preview.markup.shape.${slug(s)}`,
      "menu: Shapes",
      "menuitem",
      s,
      `choose ${s}, drag on the page`,
      `a ${s.toLowerCase()} is drawn and kept beside the file`,
      "restart",
    ),
  ),
  R(
    "preview.markup.text-field",
    MB,
    "textbox",
    "Text",
    "with the Text tool, click the page and type",
    "the text is drawn and kept beside the file",
    "restart",
  ),
  ...STROKES.map((s) =>
    R(
      `preview.markup.stroke.${slug(s)}`,
      "menu: Shape Style",
      "menuitemradio",
      s,
      "choose",
      "checked; the next shape is drawn that thick",
    ),
  ),
  ...COLORS.map((c) =>
    R(
      `preview.markup.border.${slug(c)}`,
      "menu: Border Color",
      "menuitemradio",
      c,
      "choose",
      "checked; the next shape's border is that colour",
    ),
  ),
  R(
    "preview.markup.fill.none",
    "menu: Fill Color",
    "menuitemradio",
    "No Fill",
    "choose",
    "checked; the next shape is not filled",
  ),
  ...COLORS.map((c) =>
    R(
      `preview.markup.fill.${slug(c)}`,
      "menu: Fill Color",
      "menuitemradio",
      c,
      "choose",
      "checked; the next shape is filled with it",
    ),
  ),
  ...TEXT_SIZES.map((s) =>
    R(
      `preview.markup.text-size.${slug(s)}`,
      "menu: Text Style",
      "menuitemradio",
      s,
      "choose",
      "checked; the next text is that size",
    ),
  ),
  R(
    "preview.markup.kept",
    W,
    "markup",
    "marks beside the file",
    "draw, reload, open the file",
    "the marks are drawn again",
    "reload",
  ),
  R(
    "preview.adjust.width",
    "Adjust Size sheet",
    "textbox",
    "Width",
    "type half the width",
    "the height follows in proportion",
  ),
  R("preview.adjust.height", "Adjust Size sheet", "textbox", "Height", "read", "follows the width"),
  R(
    "preview.adjust.proportional",
    "Adjust Size sheet",
    "checkbox",
    "/^Scale proportionally$/",
    "look",
    "checked and dimmed with its reason, or it can be switched",
    "none",
    "kind: the one checkbox of the sheet",
  ),
  R(
    "preview.adjust.ok",
    "Adjust Size sheet",
    "button",
    "the default button",
    "click",
    "the picture is resized",
  ),
  R(
    "preview.adjust.cancel",
    "Adjust Size sheet",
    "button",
    "Cancel",
    "click",
    "the sheet closes; nothing changes",
  ),
  R(
    "preview.crop",
    MB,
    "button",
    "Crop",
    "after a Rectangular Selection, click; Save",
    "the saved picture is the selection",
  ),
  R(
    "preview.pdf.opens",
    W,
    "document",
    "a two-page PDF",
    "open it",
    "page 1 of 2; pdf.js draws the page",
  ),
  R(
    "preview.pdf.thumbnail",
    W,
    "option",
    "/^[12]$/",
    "click the second thumbnail",
    "page 2 shows",
    "none",
    "kind: the page thumbnails of the sidebar; both clicked",
  ),
  R(
    "preview.pdf.thumbnail-drawn",
    W,
    "listbox",
    "Thumbnails",
    "look",
    "pdf.js draws each thumbnail",
  ),
  R(
    "preview.search",
    W,
    "searchbox",
    "Search",
    "type a word of page 2",
    "Found on 1 page; Page 2 listed",
  ),
  R("preview.search.pages-found", W, "listbox", "Pages found", "click Page 2", "page 2 shows"),
  R(
    "preview.search.previous",
    W,
    "button",
    "Previous",
    "click",
    "the previous match, or dimmed with one match",
  ),
  R(
    "preview.search.next",
    W,
    "button",
    "Next",
    "click",
    "the next match, or dimmed with one match",
  ),
  R(
    "preview.search.done",
    W,
    "button",
    "Done",
    "click",
    "the search ends; the thumbnails show again",
  ),
  R(
    "preview.sign.create",
    "menu: Sign",
    "menuitem",
    "Create Signature…",
    "choose",
    "the Create Signature sheet with its pad",
  ),
  R(
    "preview.sign.pad",
    "Create Signature sheet",
    "img",
    "Signature pad",
    "draw on it with the pointer",
    "the stroke shows",
  ),
  R(
    "preview.sign.done",
    "Create Signature sheet",
    "button",
    "Done",
    "click",
    "the signature is kept for the person and placed on the page",
    "restart",
  ),
  R(
    "preview.sign.cancel",
    "Create Signature sheet",
    "button",
    "Cancel",
    "click",
    "no signature is kept",
  ),
  R(
    "preview.sign.existing",
    "menu: Sign",
    "menuitem",
    "/^Signature \\d+$/",
    "choose the kept signature",
    "it is placed on the page",
    "none",
    "kind: the person's kept signatures",
  ),
  R(
    "preview.divider.sidebar",
    W,
    "separator",
    "Resize the sidebar",
    "drag right",
    "the sidebar gets wider",
  ),
  R(
    "preview.places.server",
    W,
    "place",
    "where the PDF was left",
    "go to page 2, zoom in",
    "the server keeps page 2 and the zoom",
    "restart",
  ),
  R(
    "preview.places.reload",
    W,
    "place",
    "where the PDF was left",
    "reload, open Preview",
    "it reopens the PDF at page 2 and that zoom, without the Open sheet",
    "reload",
  ),
  R(
    "preview.places.isolation",
    W,
    "place",
    "places",
    "a second account",
    "no places, no signatures, no markup of the first account's files",
  ),
  R(
    "preview.places.restart",
    W,
    "place",
    "where the PDF was left",
    "after a real same-root restart, sign in, open Preview",
    "the same document, page and zoom; the marks and the signature kept",
    "restart",
    "",
    "restart-check",
  ),
  R(
    "preview.places.isolation-restart",
    W,
    "place",
    "places",
    "after the restart, the second account",
    "still none",
    "restart",
    "",
    "restart-check",
  ),
  R("preview.menu.file.open", "menu:File", "menuitem", "Open…", "choose", "the Open sheet shows"),
  R(
    "preview.menu.file.open-recent",
    "menu:File",
    "menuitem",
    "Open Recent",
    "hover",
    "the files opened, newest first",
  ),
  R(
    "preview.menu.file.open-recent-item",
    "menu:File > Open Recent",
    "menuitem",
    "/^R3 .+\\.(png|pdf|avif)$/",
    "choose the picture",
    "it reopens",
    "none",
    "kind: the files opened before",
  ),
  R(
    "preview.menu.file.save",
    "menu:File",
    "menuitem",
    "Save",
    "after an edit, choose",
    "saved to the drive",
  ),
  R(
    "preview.menu.file.export",
    "menu:File",
    "menuitem",
    "Export…",
    "choose",
    "the Export sheet opens",
  ),
  ...["Hide Sidebar", "Thumbnails", "Actual Size", "Zoom to Fit", "Zoom In", "Zoom Out"].map((i) =>
    R(
      `preview.menu.view.${slug(i)}`,
      "menu:View",
      i === "Hide Sidebar" || i === "Thumbnails" ? "menuitemradio" : "menuitem",
      i,
      "choose with a document open",
      "as the toolbar's control does",
    ),
  ),
  R(
    "preview.menu.view.show-markup-toolbar",
    "menu:View",
    "menuitem",
    "Show Markup Toolbar",
    "choose with a document open",
    "as the toolbar's control does",
  ),
  ...["Show Inspector", "Rotate Left", "Rotate Right", "Adjust Size…", "Crop"].map((i) =>
    R(
      `preview.menu.tools.${slug(i)}`,
      "menu:Tools",
      "menuitem",
      i,
      "choose with a picture open",
      "as the toolbar's control does, or dimmed until it can (Crop until there is a selection)",
    ),
  ),
  // Preview's Go menu pages through a document: it has no Back or Forward.
  ...goRows("preview").filter((row) => !/\.go\.(back|forward)$/.test(row.id)),
  ...[
    ["Next", "page 2"],
    ["Previous", "page 1"],
    ["End", "page 2"],
    ["Home", "page 1"],
    ["Page Down", "page 2"],
    ["Page Up", "page 1"],
  ].map(([item, shows]) =>
    R(
      `preview.menu.go.${slug(item)}`,
      "menu:Go",
      "menuitem",
      item,
      "choose with the two-page PDF open",
      `${shows} shows`,
    ),
  ),
  ...standardRows("preview", APP, { menus: MENUS, windowItem: "Preview" }),
];

const S = census(APP, { id: "preview", file: FILE, rows });

/** A PDF of one page per text (Helvetica, with a blue box), as the Preview journey makes it. */
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

/** Setup: a file put on the drive through its upload routes. `source` is { text, type }, { picture: true } or { base64, type }. */
function upload(page, parent, name, source) {
  return page.evaluate(
    async ({ parent, name, source }) => {
      let blob;
      if (source.picture) {
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 300;
        const c = canvas.getContext("2d");
        c.fillStyle = "#ff0000";
        c.fillRect(0, 0, 200, 300);
        c.fillStyle = "#0000ff";
        c.fillRect(200, 0, 200, 300);
        blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      } else if (source.base64) {
        blob = new Blob([Uint8Array.from(atob(source.base64), (ch) => ch.charCodeAt(0))], {
          type: source.type,
        });
      } else blob = new Blob([source.text], { type: source.type });
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size: blob.size, type: blob.type, existing: "fail" }),
      }).then((r) => r.json());
      for (let i = 0; i < started.pieces; i += 1) {
        const piece = blob.slice(i * started.piece_bytes, (i + 1) * started.piece_bytes);
        const put = await fetch(`/api/files/uploads/${started.upload}/${i}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await piece.arrayBuffer(),
        });
        if (!put.ok) throw new Error(`piece ${i}: ${put.status}`);
      }
      const done = await fetch(`/api/files/uploads/${started.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      }).then((r) => r.json());
      return done.entries.find((e) => e.id === done.created[0]);
    },
    { parent, name, source },
  );
}

await S.run(async ({ person, check, allow, opts, state, saveState, problem, note, guard }) => {
  const entries = async (page) => (await api(page, "GET", "/api/files/")).json?.entries ?? [];
  const places = async (page) => (await api(page, "GET", PLACES_URL)).json?.places ?? [];
  const markupOf = async (page, id) =>
    (await api(page, "GET", `/api/preview/markup/${id}`)).json?.markup ?? null;
  const markKinds = (m) => (m?.pages ?? []).flatMap((p) => (p.items ?? []).map((i) => i.kind));
  const signatures = async (page) =>
    (await api(page, "GET", "/api/preview/signatures")).json?.signatures ?? [];
  const win = (page) => page.locator(".mac-preview-app").first();
  const title = async (page) =>
    (
      (await win(page)
        .locator(".mac-title-bar-title-text")
        .first()
        .textContent()
        .catch(() => "")) ?? ""
    ).trim();
  const settled = (page) =>
    page
      .waitForFunction(
        () => document.querySelector(".mac-preview-app")?.getAttribute("aria-busy") !== "true",
        undefined,
        { timeout: 20_000 },
      )
      .catch(() => {});
  const sheet = (page) => page.getByRole("dialog", { name: "Open" });
  const tb = (page, name) => win(page).getByRole("button", { name, exact: true }).first();
  const mk = (page, name) =>
    page
      .getByRole("toolbar", { name: "Markup" })
      .getByRole("button", { name, exact: true })
      .first();
  const leafBox = async (page, n = 1) => page.locator(`[data-page="${n}"]`).first().boundingBox();
  const drawn = async (page, selector, timeout = 20_000) =>
    until(
      () =>
        page.evaluate((sel) => {
          const c = document.querySelector(sel);
          if (!(c instanceof HTMLCanvasElement) || c.width < 2) return false;
          const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
          const first = `${d[0]},${d[1]},${d[2]},${d[3]}`;
          for (let at = 4; at < d.length; at += 4 * 97)
            if (`${d[at]},${d[at + 1]},${d[at + 2]},${d[at + 3]}` !== first) return true;
          return false;
        }, selector),
      timeout,
    );
  const drag = async (page, n, [ax, ay], [bx, by]) => {
    const box = await page
      .locator(`[data-page="${n}"] .mac-preview-app-page-marks`)
      .first()
      .boundingBox();
    await page.mouse.move(box.x + ax * box.width, box.y + ay * box.height);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1)
      await page.mouse.move(
        box.x + (ax + ((bx - ax) * i) / 8) * box.width,
        box.y + (ay + ((by - ay) * i) / 8) * box.height,
      );
    await page.mouse.up();
  };
  const markSaved = (page, id) =>
    page
      .waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          new URL(r.url()).pathname === `/api/preview/markup/${id}`,
        { timeout: 15_000 },
      )
      .catch(() => null);
  const fileMenu = async (page, item) => {
    await tb(page, "File").click();
    await page
      .locator('[role="menu"][data-open]')
      .last()
      .getByRole("menuitem", { name: item, exact: true })
      .click();
  };
  const radio = async (page, trigger, item) => {
    await mk(page, trigger).click();
    const r = page.getByRole("menuitemradio", { name: item, exact: true }).first();
    await r.click();
    await mk(page, trigger).click();
    await r.waitFor({ timeout: 4_000 }).catch(() => {});
    const on = (await r.getAttribute("aria-checked")) === "true";
    await closeOpenMenu(page);
    return on;
  };
  const launch = async (page) => {
    await openApp(page, APP, "mac-preview-app");
    await win(page).waitFor({ timeout: 15_000 });
  };
  const showing = async (page, name, timeout = 20_000) => {
    const ok = await until(async () => (await title(page)).startsWith(name), timeout);
    if (ok) await settled(page);
    return !!ok;
  };
  const openWindows = (page) =>
    page
      .locator('[data-window-id^="preview"]')
      .evaluateAll((all) => all.map((each) => each.getAttribute("data-window-id")));
  /**
   * Each file has a window of its own, and the rows below speak of one window: once a further window
   * has opened, the ones open `before` it are closed, without saving what they hold.
   */
  const onlyTheNewest = async (page, before) => {
    if (before.length === 0) return;
    const opened = await until(async () => (await openWindows(page)).length > before.length, 3_000);
    if (!opened) return;
    for (const id of before) {
      await page
        .locator(`[data-window-id="${id}"]`)
        .getByRole("button", { name: "Close", exact: true })
        .first()
        .evaluate((button) => button.click());
      const ask = page.getByRole("alertdialog").getByRole("button", { name: "Don’t Save" });
      if (await until(() => ask.isVisible(), 500)) await ask.click();
      await until(async () => !(await openWindows(page)).includes(id), 5_000);
    }
  };
  const openFromSheet = async (page, name, place = "Pictures") => {
    // A sheet still sliding out (after Cancel) reads as visible, then goes: wait for it to finish first.
    await until(
      async () => (await page.locator('[role="dialog"][data-ending-style]').count()) === 0,
      3_000,
    );
    await page.waitForTimeout(300);
    if (
      !(await sheet(page)
        .isVisible()
        .catch(() => false))
    )
      await tb(page, "Open…").click();
    await sheet(page).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    await sheet(page).getByRole("treeitem", { name: place, exact: true }).first().click();
    const option = sheet(page).getByRole("option", { name }).first();
    await option.waitFor({ timeout: 10_000 });
    const before = await openWindows(page);
    await option.dblclick();
    await onlyTheNewest(page, before);
  };
  const refusal = (page) =>
    page
      .getByRole("alertdialog")
      .or(page.getByRole("dialog"))
      .filter({ hasText: "could not be opened" })
      .first();
  const openedByDoubleClick = {};
  const closeOpenMenu = async (page) => {
    await until(
      () => page.evaluate(() => !!document.activeElement?.closest('[role="menu"]')),
      2_000,
    );
    await page.keyboard.press("Escape");
    await until(async () => (await page.locator('[role="menu"][data-open]').count()) === 0, 2_000);
    await closeMenus(page);
  };
  const signSheet = () =>
    page
      .getByRole("dialog", { name: "Create Signature" })
      .or(page.locator('[aria-label="Create Signature"]'))
      .or(page.getByRole("dialog").filter({ hasText: /Sign your name/ }))
      .first();
  /**
   * The fields in which two saved marks of identical geometry differ, `id` aside: with the same drag, only the style
   * just chosen may differ. Answers { keys, ok } where ok says there is a difference and every differing field is a
   * style field (stroke width, colour, fill, text size).
   */
  const styleDiff = (aJson, bJson) => {
    const a = JSON.parse(aJson ?? "null") ?? {};
    const b = JSON.parse(bJson ?? "null") ?? {};
    const flat = (o, p = "") =>
      Object.entries(o ?? {}).flatMap(([k, v]) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? flat(v, `${p}${k}.`)
          : [[`${p}${k}`, JSON.stringify(v)]],
      );
    const fa = Object.fromEntries(flat(a));
    const fb = Object.fromEntries(flat(b));
    const keys = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].filter(
      (k) => k !== "id" && fa[k] !== fb[k],
    );
    return {
      keys,
      ok:
        keys.length > 0 &&
        keys.every(
          (k) =>
            /stroke|width|line|colou?r|border|fill|size|font|style/i.test(k) ||
            // A text's box follows its size: w and h may differ only beside a size or font change.
            (/(^|\.)(w|h)$/.test(k) && keys.some((j) => /size|font/i.test(j))),
        ),
    };
  };

  if (opts.phase === "restart-check") {
    const a = await person("A", { signIn: state.a });
    await launch(a);
    const back = await showing(a, state.lastTitle, 30_000);
    const kept = await places(a);
    const same = JSON.stringify(kept) === JSON.stringify(state.places);
    const marks = markKinds(await markupOf(a, state.pdf))
      .sort()
      .join(",");
    const sigs = (await signatures(a)).length;
    check(
      "preview.places.restart",
      back && same && marks === state.pdfMarks && sigs === state.signatures,
      `reopened "${await title(a)}" ${back ? "" : `(wanted ${state.lastTitle})`}; places ${same ? "same" : "differ"}; marks ${marks} (was ${state.pdfMarks}); signatures ${sigs} (was ${state.signatures})`,
    );
    const b = await person("B", { signIn: state.b });
    check(
      "preview.places.isolation-restart",
      (await places(b)).length === 0 &&
        (await signatures(b)).length === 0 &&
        (await markupOf(b, state.pdf)) === null,
      `places ${(await places(b)).length}, signatures ${(await signatures(b)).length}`,
    );
    return;
  }

  // The refusals and a missing file read are answers the suite provokes.
  allow(/HTTP 4\d\d: GET .*\/api\/preview\/markup\//);
  const aAcct = newAccount("prva", opts.browserName);
  const bAcct = newAccount("prvb", opts.browserName);
  const RUN = aAcct.name;
  const N = {
    picture: `R3 picture ${RUN}.png`,
    pdf: `R3 timetable ${RUN}.pdf`,
    broken: `R3 broken ${RUN}.png`,
    brokenPdf: `R3 broken ${RUN}.pdf`,
    notes: `R3 notes ${RUN}.txt`,
    heic: `R3 photo ${RUN}.heic`,
    avif: `R3 sample ${RUN}.avif`,
  };
  const page = await person("A", { create: aAcct });
  saveState({ a: aAcct, b: bAcct });
  await install(page, ["preview"]);
  const ids = {};
  ids.picture = (await upload(page, "pictures", N.picture, { picture: true }))?.id;
  ids.pdf = (
    await upload(page, "pictures", N.pdf, {
      text: makePdf(["Harbour timetable", "The ferry leaves at ten"]),
      type: "application/pdf",
    })
  )?.id;
  ids.broken = (
    await upload(page, "pictures", N.broken, {
      text: "These bytes are not a picture.",
      type: "image/png",
    })
  )?.id;
  ids.brokenPdf = (
    await upload(page, "pictures", N.brokenPdf, {
      text: "%PDF-1.4\nbroken beyond reading\n",
      type: "application/pdf",
    })
  )?.id;
  ids.notes = (
    await upload(page, "pictures", N.notes, { text: "Ferry at ten.\n", type: "text/plain" })
  )?.id;
  ids.heic = (
    await upload(page, "pictures", N.heic, {
      text: "\u0000\u0000\u0000\u0018ftypheic",
      type: "image/heic",
    })
  )?.id;
  ids.avif = (
    await upload(page, "pictures", N.avif, {
      base64: readFileSync(path.join(here, "fixtures", "r3-sample.avif")).toString("base64"),
      type: "image/avif",
    })
  )?.id;
  saveState({ pdf: ids.pdf });
  await reload(page);
  await launch(page);

  await guard("the Open sheet", page, async () => {
    const shown = await until(() => sheet(page).isVisible(), 15_000);
    check("preview.window.open", !!shown, shown ? "the Open sheet shows" : "no Open sheet");
    for (const p of PLACES) {
      await sheet(page).getByRole("treeitem", { name: p, exact: true }).first().click();
      const listed = await until(
        async () => (await sheet(page).getByRole("listbox", { name: p }).count()) > 0,
        5_000,
      );
      check(
        `preview.open.place.${slug(p)}`,
        !!listed,
        listed
          ? `the list is ${p}`
          : `the list is ${await sheet(page).getByRole("listbox").first().getAttribute("aria-label")}`,
      );
    }
    await sheet(page).getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    await sheet(page).getByRole("treeitem", { name: "Pictures", exact: true }).first().click();
    await sheet(page).getByRole("button", { name: "Back", exact: true }).click();
    const backOk = await until(
      async () => (await sheet(page).getByRole("listbox", { name: "Documents" }).count()) > 0,
      5_000,
    );
    check("preview.open.back", !!backOk, backOk ? "Documents again" : "not Documents");
    await sheet(page).getByRole("button", { name: "Forward", exact: true }).click();
    const fwdOk = await until(
      async () => (await sheet(page).getByRole("listbox", { name: "Pictures" }).count()) > 0,
      5_000,
    );
    check("preview.open.forward", !!fwdOk, fwdOk ? "Pictures again" : "not Pictures");
    const list = sheet(page).getByRole("listbox", { name: "Pictures" });
    const openBtn = sheet(page).getByRole("button", { name: "Open", exact: true });
    const dimmedEmpty = await openBtn.isDisabled();
    await sheet(page).getByRole("searchbox", { name: "Search" }).click();
    await page.keyboard.type("timetable");
    const filtered = await until(async () => {
      const names = (await sheet(page).getByRole("option").allInnerTexts())
        .map((t) => t.trim())
        .filter(Boolean);
      return names.length > 0 && names.every((n) => /timetable/i.test(n)) ? names : null;
    }, 6_000);
    check(
      "preview.open.search",
      !!filtered,
      filtered
        ? filtered.join(", ")
        : (await sheet(page).getByRole("option").allInnerTexts()).join(", "),
    );
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
    await sheet(page).getByRole("treeitem", { name: "Pictures", exact: true }).first().click();
    const view = sheet(page).getByRole("combobox", { name: "View" });
    const viewBefore = ((await view.innerText().catch(() => "")) ?? "").trim();
    await view.click();
    const viewOpts = page.getByRole("option").filter({ hasNotText: /R3 / });
    // The pop-up's options mount as it opens: wait for them before reading them.
    await viewOpts
      .first()
      .waitFor({ timeout: 5_000 })
      .catch(() => {});
    const vNames = (await viewOpts.allInnerTexts()).map((t) => t.trim());
    const other = [...vNames].reverse().find((n) => n && n !== viewBefore);
    if (other) await page.getByRole("option", { name: other, exact: true }).first().click();
    else await page.keyboard.press("Escape");
    const viewAfter = ((await view.innerText().catch(() => "")) ?? "").trim();
    check(
      "preview.open.view",
      !!other && viewAfter !== viewBefore,
      `${viewBefore} -> ${viewAfter} (offered ${vNames.join("|")})`,
    );
    const loc = sheet(page).getByRole("combobox", { name: "Location" });
    // The View pop-up's list must be gone first: read while it closes, its options would pass for folders.
    await until(
      async () =>
        (await page.getByRole("option", { name: /^as / }).filter({ visible: true }).count()) === 0,
      4_000,
    );
    await loc.click();
    // The pop-up lists the folder shown (Pictures) and those above it: wait for its own options.
    await page
      .getByRole("option", { name: "Pictures", exact: true })
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: 5_000 })
      .catch(() => {});
    const locNames = (
      await page
        .getByRole("option")
        .filter({ hasNotText: /R3 / })
        .filter({ visible: true })
        .allInnerTexts()
    )
      .map((t) => t.trim())
      .filter((t) => t && !/^as /.test(t));
    const up = locNames.find((n) => n !== "Pictures");
    if (up) await page.getByRole("option", { name: up, exact: true }).first().click();
    else
      await page
        .getByRole("option", { name: "Pictures", exact: true })
        .first()
        .click()
        .catch(() => page.keyboard.press("Escape"));
    const moved =
      up &&
      (await until(
        async () => (await sheet(page).getByRole("listbox", { name: up }).count()) > 0,
        5_000,
      ));
    check(
      "preview.open.location",
      locNames.includes("Pictures") && (up ? !!moved : locNames.length === 1),
      `offered ${locNames.join(" > ")}; chose ${up}`,
    );
    await sheet(page).getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    const before = (await entries(page)).filter(
      (e) => e.kind === "folder" || e.folder || e.type === "folder",
    ).length;
    const countBefore = (await entries(page)).length;
    await sheet(page).getByRole("button", { name: "New Folder", exact: true }).click();
    const ask = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("textbox") })
      .last();
    if (await until(() => ask.isVisible(), 3_000)) {
      await ask.getByRole("textbox").first().fill(`R3 folder ${RUN}`);
      await page.keyboard.press("Enter");
    }
    const made = await until(async () => (await entries(page)).length > countBefore, 8_000);
    void before;
    check(
      "preview.open.new-folder",
      !!made,
      made ? "a folder was made on the drive" : "nothing was made",
    );
    await sheet(page).getByRole("treeitem", { name: "Pictures", exact: true }).first().click();
    await list.getByRole("option", { name: N.notes }).first().click();
    check("preview.open.text-refused", await openBtn.isDisabled(), "Open dimmed for a text file");
    const heic = list.getByRole("option", { name: N.heic }).first();
    if ((await heic.count()) === 0)
      check("preview.open.heic-refused", true, "the HEIC file is not listed");
    else {
      await heic.click();
      check(
        "preview.open.heic-refused",
        (await openBtn.isDisabled()) || (await heic.getAttribute("aria-disabled")) === "true",
        "listed, not offered: Open dimmed",
      );
    }
    await list.getByRole("option", { name: N.picture }).first().click();
    const enabledForPicture = !(await openBtn.isDisabled());
    await openBtn.click();
    const opened = await showing(page, N.picture);
    check(
      "preview.open.open",
      dimmedEmpty && enabledForPicture && opened,
      `dimmed with nothing selected ${dimmedEmpty}; opens the picture ${opened}`,
    );
    check(
      "preview.image.drawn",
      !!(await drawn(page, '[data-page="1"] .mac-preview-app-page-canvas')),
      "pixels drawn",
    );
    await tb(page, "Open…").click();
    check(
      "preview.toolbar.open",
      !!(await until(() => sheet(page).isVisible(), 5_000)),
      "the Open sheet shows",
    );
    await sheet(page).getByRole("button", { name: "Cancel", exact: true }).click();
    check(
      "preview.open.cancel",
      !!(await until(async () => !(await sheet(page).isVisible()), 5_000)) &&
        (await title(page)).startsWith(N.picture),
      "closed; the picture stays",
    );
  });

  await guard("refused and damaged files, AVIF", page, async () => {
    for (const [id, name] of [
      ["preview.open.damaged-picture", N.broken],
      ["preview.open.damaged-pdf", N.brokenPdf],
    ]) {
      await openFromSheet(page, name);
      const r = refusal(page);
      const shown = await until(() => r.isVisible(), 15_000);
      const text = shown ? (await r.innerText()).replace(/\s+/g, " ") : "";
      if (shown) await r.getByRole("button", { name: "OK" }).click();
      check(
        id,
        !!shown && text.includes(`“${name}” could not be opened`) && !(await r.isVisible()),
        text.slice(0, 160) || "no message",
      );
    }
    await openFromSheet(page, N.avif);
    const r = refusal(page);
    const result = await until(
      async () =>
        (await title(page)).startsWith(N.avif)
          ? "opened"
          : (await r.isVisible())
            ? "refused"
            : null,
      15_000,
    );
    if (result === "opened") {
      await settled(page);
      const colours = await page.evaluate(() => {
        const c = document.querySelector('[data-page="1"] .mac-preview-app-page-canvas');
        if (!(c instanceof HTMLCanvasElement)) return null;
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        const at = (x, y) => {
          const i = (Math.floor(y * c.height) * c.width + Math.floor(x * c.width)) * 4;
          return [d[i], d[i + 1], d[i + 2]];
        };
        return { left: at(0.25, 0.5), right: at(0.75, 0.5) };
      });
      const ok =
        colours &&
        colours.left[0] > 180 &&
        colours.left[2] < 90 &&
        colours.right[2] > 180 &&
        colours.right[0] < 90;
      check(
        "preview.open.avif",
        !!ok,
        `opened; pixels left ${colours?.left} right ${colours?.right}`,
      );
    } else if (result === "refused") {
      const text = (await r.innerText()).replace(/\s+/g, " ");
      await r.getByRole("button", { name: "OK" }).click();
      check(
        "preview.open.avif",
        /format may not be one this browser shows|could not be opened/.test(text),
        `refused honestly: ${text.slice(0, 160)}`,
      );
    } else check("preview.open.avif", false, "neither opened nor refused");
  });

  await guard(
    "picture: inspector, zoom, view, rotate, markup, adjust, crop, save, export",
    page,
    async () => {
      await openFromSheet(page, N.picture);
      openedByDoubleClick.picture = await showing(page, N.picture);
      await tb(page, "Show Inspector").click();
      const inspector = win(page).locator(".mac-preview-app-inspector");
      await inspector.waitFor({ timeout: 5_000 });
      const info = (await inspector.innerText()).replace(/\s+/g, " ");
      check(
        "preview.inspector.show",
        info.includes(N.picture) && info.includes("PNG image") && info.includes("400 × 300 pixels"),
        info.slice(0, 160),
      );
      await choose(page, ["Tools", "Hide Inspector"]);
      const hidden = await until(async () => !(await inspector.isVisible()), 5_000);
      await choose(page, ["Tools", "Show Inspector"]);
      const again = await until(() => inspector.isVisible(), 5_000);
      check(
        "preview.menu.tools.show-inspector",
        !!hidden && !!again,
        `Hide Inspector hid it ${!!hidden}; Show Inspector showed it ${!!again}`,
      );
      await tb(page, "Show Inspector").click();
      const w0 = (await leafBox(page))?.width ?? 0;
      await tb(page, "Zoom In").click();
      const zin = await until(async () => ((await leafBox(page))?.width ?? 0) > w0 * 1.15, 4_000);
      check(
        "preview.toolbar.zoom-in",
        !!zin,
        `${Math.round(w0)} -> ${Math.round((await leafBox(page))?.width ?? 0)}`,
      );
      const w1 = (await leafBox(page))?.width ?? 0;
      await tb(page, "Zoom Out").click();
      check(
        "preview.toolbar.zoom-out",
        !!(await until(async () => ((await leafBox(page))?.width ?? 0) < w1 * 0.9, 4_000)),
        `${Math.round(w1)} -> ${Math.round((await leafBox(page))?.width ?? 0)}`,
      );
      // The toolbar's View menu.
      await tb(page, "View").click();
      const vItems = (
        await page
          .locator('[role="menu"][data-open]')
          .last()
          .innerText()
          .catch(() => "")
      ).replace(/\s+/g, " ");
      check(
        "preview.toolbar.view",
        /Hide Sidebar/.test(vItems) &&
          /Thumbnails/.test(vItems) &&
          /Actual Size/.test(vItems) &&
          /Zoom to Fit/.test(vItems),
        vItems.slice(0, 120),
      );
      await closeOpenMenu(page);
      const viewChoose = async (item) => {
        await tb(page, "View").click();
        await page
          .locator('[role="menu"][data-open]')
          .last()
          .locator('[role^="menuitem"]')
          .filter({ hasText: item })
          .first()
          .click();
      };
      const sidebar = () => win(page).getByRole("listbox", { name: "Thumbnails" });
      await viewChoose("Hide Sidebar");
      check(
        "preview.toolbar.view.hide-sidebar",
        !!(await until(
          async () =>
            !(await sidebar()
              .isVisible()
              .catch(() => false)),
          4_000,
        )),
        "sidebar hidden",
      );
      await viewChoose("Thumbnails");
      check(
        "preview.toolbar.view.thumbnails",
        !!(await until(() => sidebar().isVisible(), 4_000)),
        "thumbnails shown",
      );
      await viewChoose("Actual Size");
      await page.waitForTimeout(400);
      const actual = (await leafBox(page))?.width ?? 0;
      check(
        "preview.toolbar.view.actual-size",
        Math.abs(actual - 400) <= 8,
        `${Math.round(actual)} pt for a 400 px picture`,
      );
      await viewChoose("Zoom to Fit");
      await page.waitForTimeout(400);
      const fit = (await leafBox(page))?.width ?? 0;
      const area = (await win(page).boundingBox())?.width ?? 0;
      check(
        "preview.toolbar.view.zoom-to-fit",
        fit > 0 && fit !== actual && fit <= area + 2,
        `${Math.round(fit)} pt in a ${Math.round(area)} pt area`,
      );
      // Rotate.
      await tb(page, "Rotate Right").click();
      const turned = await until(async () => {
        const b = await leafBox(page);
        return b && b.height > b.width;
      }, 4_000);
      check(
        "preview.toolbar.rotate-right",
        !!turned && (await title(page)).includes("Edited"),
        `${await title(page)}`,
      );
      await tb(page, "Rotate Left").click();
      check(
        "preview.toolbar.rotate-left",
        !!(await until(async () => {
          const b = await leafBox(page);
          return b && b.width > b.height;
        }, 4_000)),
        "back to landscape",
      );
      await choose(page, ["Tools", "Rotate Right"]);
      const mr = await until(async () => {
        const b = await leafBox(page);
        return b && b.height > b.width;
      }, 4_000);
      check("preview.menu.tools.rotate-right", !!mr, "turned");
      await choose(page, ["Tools", "Rotate Left"]);
      check(
        "preview.menu.tools.rotate-left",
        !!(await until(async () => {
          const b = await leafBox(page);
          return b && b.width > b.height;
        }, 4_000)),
        "turned back",
      );
      // File > Revert Edits (toolbar) after a turn.
      await tb(page, "Rotate Right").click();
      await fileMenu(page, "Revert Edits");
      check(
        "preview.file.revert",
        !!(await until(async () => {
          const b = await leafBox(page);
          return b && b.width > b.height && !(await title(page)).includes("Edited");
        }, 5_000)),
        await title(page),
      );
      // Markup.
      await tb(page, "Show Markup Toolbar").click();
      const bar = page.getByRole("toolbar", { name: "Markup" });
      check("preview.markup.toolbar", !!(await until(() => bar.isVisible(), 4_000)), "shown");
      const present = (
        await bar
          .getByRole("button")
          .evaluateAll((bs) =>
            bs.map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim()),
          )
      ).filter(Boolean);
      const unlisted = present.filter((n) => !TOOLS.includes(n));
      if (unlisted.length)
        problem(`the Markup toolbar has controls the census lacks: ${unlisted.join(", ")}`);
      note(`markup toolbar: ${present.join(" | ")}`);
      await mk(page, "Select").click();
      const selectOn = await until(async () => {
        const b = mk(page, "Select");
        return (
          (await b.getAttribute("aria-pressed")) === "true" ||
          (await b.getAttribute("aria-checked")) === "true" ||
          (await b.getAttribute("data-pressed")) !== null
        );
      }, 3_000);
      check(
        "preview.markup.tool.select",
        !!selectOn,
        selectOn ? "pressed: the pointer selects marks" : "clicked; not shown as the tool in use",
      );
      for (const tool of [
        "Elliptical Selection",
        "Lasso Selection",
        "Smart Lasso",
        "Draw",
        "Adjust Color",
      ]) {
        const control = mk(page, tool);
        const dimmed = await control.isDisabled();
        const why = (await control.getAttribute("title")) ?? "";
        check(
          `preview.markup.tool.${slug(tool)}`,
          (await control.isVisible()) && (!dimmed || why !== ""),
          dimmed ? `dimmed: ${why}` : "in the toolbar; used in e2e/preview-batch3-journey.mjs",
        );
      }
      for (const s of SHAPES) {
        await mk(page, "Shapes").click();
        await page.getByRole("menuitem", { name: s, exact: true }).click();
        const saved = markSaved(page, ids.picture);
        const y = 0.1 + SHAPES.indexOf(s) * 0.1;
        await drag(page, 1, [0.1, y], [0.4, y + 0.08]);
        const ok =
          (await saved)?.status() === 200 &&
          markKinds(await markupOf(page, ids.picture)).includes(KIND[s]);
        check(
          `preview.markup.shape.${slug(s)}`,
          ok,
          markKinds(await markupOf(page, ids.picture)).join(","),
        );
      }
      check(
        "preview.markup.tool.shapes",
        true,
        "its menu offers Line, Arrow, Rectangle, Oval (each drawn above)",
      );
      await mk(page, "Text").click();
      await drag(page, 1, [0.6, 0.7], [0.6, 0.7]);
      const field = win(page).getByRole("textbox", { name: "Text" });
      await field.waitFor({ timeout: 5_000 });
      await field.fill("Approved");
      const tSaved = markSaved(page, ids.picture);
      await field.press("Enter");
      const tOk =
        (await tSaved)?.status() === 200 &&
        markKinds(await markupOf(page, ids.picture)).includes("text");
      check("preview.markup.tool.text", tOk, "text tool places a text field");
      check("preview.markup.text-field", tOk, "typed text kept beside the file");
      await mk(page, "Sketch").click();
      const sSaved = markSaved(page, ids.picture);
      // A hand-drawn line that is no shape: a straight stroke is tidied into a line.
      const marks = await page
        .locator('[data-page="1"] .mac-preview-app-page-marks')
        .first()
        .boundingBox();
      const strokeAt = (x, y) => [marks.x + x * marks.width, marks.y + y * marks.height];
      await page.mouse.move(...strokeAt(0.6, 0.2));
      await page.mouse.down();
      for (const [x, y] of [
        [0.68, 0.32],
        [0.72, 0.12],
        [0.8, 0.36],
        [0.84, 0.1],
        [0.92, 0.34],
        [0.95, 0.15],
      ])
        await page.mouse.move(...strokeAt(x, y), { steps: 4 });
      await page.mouse.up();
      check(
        "preview.markup.tool.sketch",
        (await sSaved)?.status() === 200 &&
          markKinds(await markupOf(page, ids.picture)).includes("sketch"),
        markKinds(await markupOf(page, ids.picture)).join(","),
      );
      // Styles and colours: each choice checked; a shape drawn after a change carries it (the saved mark differs).
      const lastItem = async () =>
        JSON.stringify((await markupOf(page, ids.picture))?.pages?.[0]?.items?.at(-1) ?? null);
      const drawRect = async () => {
        await mk(page, "Shapes").click();
        await page.getByRole("menuitem", { name: "Rectangle", exact: true }).click();
        const saved = markSaved(page, ids.picture);
        await drag(page, 1, [0.5, 0.5], [0.7, 0.62]);
        await saved;
        return lastItem();
      };
      const styled = async (trigger, items, _id, prefix, applied = {}) => {
        await mk(page, trigger).click();
        const menuOk = await until(
          () => page.locator('[role="menu"][data-open]').last().isVisible(),
          3_000,
        );
        await closeOpenMenu(page);
        check(
          `preview.markup.tool.${slug(trigger)}`,
          !!menuOk,
          menuOk ? "its menu opens" : "no menu",
        );
        for (const it of items) {
          const on = await radio(page, trigger, it);
          const app = applied[it];
          check(
            `${prefix}.${slug(it)}`,
            on && (!app || app.ok),
            `${on ? "checked" : "not checked"}${app ? `; applied to the next mark: ${app.ok ? "yes" : "NO"} (fields that differ: ${app.keys.join(", ") || "none"})` : ""}`,
          );
        }
      };
      // Each style pair: two rectangles of the same drag, drawn after two different choices.
      await radio(page, "Shape Style", "Thin");
      const thin = await drawRect();
      await radio(page, "Shape Style", "Thick");
      const thick = await drawRect();
      await styled("Shape Style", STROKES, "stroke", "preview.markup.stroke", {
        Thick: styleDiff(thin, thick),
      });
      await radio(page, "Border Color", "Red");
      const red = await drawRect();
      await radio(page, "Border Color", "Blue");
      const blue = await drawRect();
      await styled("Border Color", COLORS, "border", "preview.markup.border", {
        Blue: styleDiff(red, blue),
      });
      await mk(page, "Fill Color").click();
      const fillMenu = await until(
        () => page.locator('[role="menu"][data-open]').last().isVisible(),
        3_000,
      );
      await closeOpenMenu(page);
      check("preview.markup.tool.fill-color", !!fillMenu, "its menu opens");
      await radio(page, "Fill Color", "No Fill");
      const unfilled = await drawRect();
      await radio(page, "Fill Color", "Green");
      const filled = await drawRect();
      const fillApplied = styleDiff(unfilled, filled);
      check("preview.markup.fill.none", await radio(page, "Fill Color", "No Fill"), "checked");
      for (const c of COLORS) {
        const on = await radio(page, "Fill Color", c);
        check(
          `preview.markup.fill.${slug(c)}`,
          on && (c !== "Green" || fillApplied.ok),
          `${on ? "checked" : "not checked"}${c === "Green" ? `; applied: ${fillApplied.ok ? "yes" : "NO"} (${fillApplied.keys.join(", ") || "none"})` : ""}`,
        );
      }
      await radio(page, "Fill Color", "No Fill");
      // Text sizes: a text placed after Small and one after Large, at the same spot.
      // Saves run one after another, so the next PUT to answer can be an earlier change's, and a size changed by a
      // style row may still be on its way: each read below waits for what it reads.
      const items = async () => (await markupOf(page, ids.picture))?.pages?.[0]?.items ?? [];
      const placeText = async (word) => {
        const count = (await items()).length;
        await mk(page, "Text").click();
        await drag(page, 1, [0.3, 0.85], [0.3, 0.85]);
        const f = win(page).getByRole("textbox", { name: "Text" });
        await f.waitFor({ timeout: 5_000 });
        await f.fill(word);
        await f.press("Enter");
        await until(async () => (await items()).length === count + 1);
        return lastItem();
      };
      await radio(page, "Text Style", "Small");
      const small = await placeText("Same");
      await radio(page, "Text Style", "Large");
      const large = await placeText("Same");
      await styled("Text Style", TEXT_SIZES, "text-size", "preview.markup.text-size", {
        Large: styleDiff(small, large),
      });
      // Undo takes the last change back: here Large, given to the last text placed, back to the Medium before it.
      await mk(page, "Undo").click();
      const undone = await until(async () => (await items()).at(-1)?.size === 0.03, 5_000);
      check(
        "preview.markup.tool.undo",
        !!undone,
        `${(await items()).length} marks; the last text's size ${(await items()).at(-1)?.size}`,
      );
      // Marks kept across a reload.
      const keptKinds = markKinds(await markupOf(page, ids.picture)).join(",");
      await reload(page);
      await launch(page);
      const back = await showing(page, N.picture);
      check(
        "preview.markup.kept",
        back &&
          !!(await drawn(page, '[data-page="1"] .mac-preview-app-page-marks')) &&
          markKinds(await markupOf(page, ids.picture)).join(",") === keptKinds,
        `reopened ${back}; marks ${keptKinds}`,
      );
      // Remove All Markup.
      const rmSaved = markSaved(page, ids.picture);
      await fileMenu(page, "Remove All Markup");
      await rmSaved;
      check(
        "preview.file.remove-markup",
        markKinds(await markupOf(page, ids.picture)).length === 0,
        `${markKinds(await markupOf(page, ids.picture)).length} marks left`,
      );
      // Adjust Size: Cancel, then half the width.
      await tb(page, "Show Markup Toolbar")
        .click()
        .catch(() => {});
      if (!(await bar.isVisible())) await tb(page, "Show Markup Toolbar").click();
      await mk(page, "Adjust Size").click();
      let adj = page.getByRole("dialog", { name: "Image Dimensions" });
      check(
        "preview.markup.tool.adjust-size",
        !!(await until(() => adj.isVisible(), 5_000)),
        "the sheet opens",
      );
      const box = adj.getByRole("checkbox").first();
      const boxName = (
        (await box.getAttribute("aria-label")) ??
        (await box.innerText().catch(() => "")) ??
        ""
      ).trim();
      const boxDimmed =
        (await box.isDisabled().catch(() => false)) ||
        (await box.getAttribute("aria-disabled")) === "true";
      const boxWhy = ((await adj.innerText()).match(
        /[^.]*(always|keeps?|only|cannot|can.t)[^.]*\./i,
      ) ?? [""])[0];
      check(
        "preview.adjust.proportional",
        !boxDimmed || !!boxWhy,
        boxDimmed
          ? boxWhy
            ? `dimmed: ${boxWhy}`
            : `"${boxName}" checked and dimmed, no reason shown`
          : "can be switched",
      );
      await adj.getByRole("button", { name: "Cancel", exact: true }).click();
      check(
        "preview.adjust.cancel",
        !!(await until(async () => !(await adj.isVisible()), 4_000)) &&
          !(await title(page)).includes("Edited"),
        "closed; unchanged",
      );
      await choose(page, ["Tools", "Adjust Size…"]);
      adj = page.getByRole("dialog", { name: "Image Dimensions" });
      check(
        "preview.menu.tools.adjust-size",
        !!(await until(() => adj.isVisible(), 5_000)),
        "the sheet opens",
      );
      const wField = adj
        .getByRole("textbox", { name: "Width" })
        .or(adj.getByRole("spinbutton", { name: "Width" }))
        .first();
      const hField = adj
        .getByRole("textbox", { name: "Height" })
        .or(adj.getByRole("spinbutton", { name: "Height" }))
        .first();
      await wField.click();
      await page.keyboard.press("Control+a");
      await page.keyboard.type("200");
      await page.keyboard.press("Tab");
      const h = await hField.inputValue();
      check("preview.adjust.width", (await wField.inputValue()) === "200", "typed 200");
      check("preview.adjust.height", h === "150", `height ${h} for width 200 of 400 x 300`);
      const buttons = adj.getByRole("button");
      const lastName = ((await buttons.last().innerText()) ?? "").trim();
      await buttons.last().click();
      const resized = await until(async () => (await title(page)).includes("Edited"), 5_000);
      check("preview.adjust.ok", !!resized, `${lastName}: ${await title(page)}`);
      // Rectangular Selection and Crop (dimmed with no selection), Save in place.
      const cropDimmed = await mk(page, "Crop").isDisabled();
      const tCrop = await menuState(page, ["Tools", "Crop"]);
      await mk(page, "Rectangular Selection").click();
      await drag(page, 1, [0.004, 0.004], [0.996, 0.5]);
      check(
        "preview.markup.tool.rectangular-selection",
        !(await mk(page, "Crop").isDisabled()),
        "a selection enables Crop",
      );
      await mk(page, "Crop").click();
      check("preview.markup.tool.crop", cropDimmed, "dimmed until a selection; crops with one");
      check(
        "preview.menu.tools.crop",
        tCrop.exists && tCrop.disabled,
        tCrop.disabled ? "dimmed until a selection" : "enabled with no selection",
      );
      const fileMenuOk = await (async () => {
        await tb(page, "File").click();
        const ok = await until(
          () => page.locator('[role="menu"][data-open]').last().isVisible(),
          3_000,
        );
        await closeOpenMenu(page);
        return ok;
      })();
      check("preview.toolbar.file", !!fileMenuOk, "its menu opens");
      const replaced = page
        .waitForResponse(
          (r) => r.request().method() === "POST" && /\/complete$/.test(new URL(r.url()).pathname),
          { timeout: 30_000 },
        )
        .catch(() => null);
      await fileMenu(page, "Save");
      const rep = await replaced;
      await settled(page);
      const savedEntry = (await entries(page)).find(
        (e) => e.name === N.picture && e.trashed_ms === undefined,
      );
      const size = savedEntry
        ? await page
            .evaluate(async (id) => {
              const r = await fetch(
                `/api/files/content/${encodeURIComponent(id)}?piece=0&count=8`,
                { credentials: "same-origin" },
              );
              const b = await createImageBitmap(await r.blob());
              return [b.width, b.height];
            }, savedEntry.id)
            .catch(() => null)
        : null;
      check("preview.file.save", rep?.status() === 200 && !!size, `saved ${JSON.stringify(size)}`);
      check(
        "preview.crop",
        !!size && Math.abs(size[0] - 200) <= 4 && Math.abs(size[1] - 75) <= 4,
        `200 x 150 cropped to its top half: ${JSON.stringify(size)}`,
      );
      if (savedEntry) ids.picture = savedEntry.id;
      // Save by the menu bar after another edit.
      await tb(page, "Rotate Right").click();
      const rep2 = page
        .waitForResponse(
          (r) => r.request().method() === "POST" && /\/complete$/.test(new URL(r.url()).pathname),
          { timeout: 30_000 },
        )
        .catch(() => null);
      await availableOrReason(
        page,
        check,
        "preview.menu.file.save",
        ["File", "Save"],
        async () => ({ ok: (await rep2)?.status() === 200, detail: "saved to the drive" }),
      );
      await settled(page);
      const again2 = (await entries(page)).find(
        (e) => e.name === N.picture && e.trashed_ms === undefined,
      );
      if (again2) ids.picture = again2.id;
      // Export: Cancel, then PDF to the drive; the menu bar's Export… opens the same sheet.
      await fileMenu(page, "Export…");
      let ex = page.getByRole("dialog", { name: "Export the document" });
      check("preview.file.export", !!(await until(() => ex.isVisible(), 5_000)), "the sheet opens");
      const before0 = JSON.stringify((await entries(page)).map((e) => e.id).sort());
      await ex.getByRole("button", { name: "Cancel", exact: true }).click();
      const closed0 = await until(async () => !(await ex.isVisible()), 4_000);
      await page.waitForTimeout(800);
      const after0 = JSON.stringify((await entries(page)).map((e) => e.id).sort());
      check(
        "preview.export.cancel",
        !!closed0 && after0 === before0,
        closed0
          ? after0 === before0
            ? "closed; the drive is unchanged"
            : "closed, but the drive changed"
          : "still open",
      );
      await choose(page, ["File", "Export…"]);
      ex = page.getByRole("dialog", { name: "Export the document" });
      check(
        "preview.menu.file.export",
        !!(await until(() => ex.isVisible(), 5_000)),
        "the sheet opens",
      );
      await ex.getByRole("combobox", { name: "Format" }).click();
      await page
        .getByRole("option", { name: "PDF", exact: true })
        .first()
        .waitFor({ timeout: 5_000 })
        .catch(() => {});
      const offered = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
      check(
        "preview.export.format",
        FORMATS.every((f) => offered.includes(f)),
        offered.join("|"),
      );
      await page.getByRole("option", { name: "PDF", exact: true }).click();
      const nameField = ex.getByRole("textbox", { name: "Save As:" });
      const OUT = `R3 export ${RUN}.pdf`;
      await page.waitForTimeout(400);
      for (let t = 0; t < 5 && (await nameField.inputValue()) !== OUT; t += 1) {
        await nameField.click();
        await page.keyboard.press("Control+a");
        await page.keyboard.type(OUT);
        await page.waitForTimeout(150);
      }
      check(
        "preview.export.name",
        (await nameField.inputValue()) === OUT,
        await nameField.inputValue(),
      );
      const wrote = page
        .waitForResponse(
          (r) =>
            r.request().method() === "POST" &&
            /\/api\/files\/uploads\/[^/]+\/complete$/.test(new URL(r.url()).pathname),
          { timeout: 60_000 },
        )
        .catch(() => null);
      await ex.getByRole("button", { name: "Save", exact: true }).click();
      const w = await wrote;
      const outEntry = (await entries(page)).find((e) => e.name === OUT);
      const head = outEntry
        ? await page.evaluate(
            async (id) =>
              new TextDecoder("latin1").decode(
                (
                  await (
                    await fetch(`/api/files/content/${encodeURIComponent(id)}?piece=0&count=1`, {
                      credentials: "same-origin",
                    })
                  ).arrayBuffer()
                ).slice(0, 8),
              ),
            outEntry.id,
          )
        : "";
      check(
        "preview.export.save",
        w?.status() === 200 && head.startsWith("%PDF"),
        `${OUT}: ${head}`,
      );
      for (const f of FORMATS) {
        const dl = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
        await fileMenu(page, `Download as ${f}`);
        const d = await dl;
        const ext = { JPEG: /\.jpe?g$/, PNG: /\.png$/, PDF: /\.pdf$/ }[f];
        check(
          `preview.file.download-${slug(f)}`,
          !!d && ext.test(d.suggestedFilename()),
          d ? d.suggestedFilename() : "no download",
        );
      }
    },
  );

  await guard("PDF: pages, thumbnails, search, signature, divider, places", page, async () => {
    await openFromSheet(page, N.pdf);
    const opened = await showing(page, `${N.pdf} (page 1 of 2)`);
    openedByDoubleClick.pdf = opened;
    check(
      "preview.open.file",
      !!openedByDoubleClick.picture && opened,
      `double-click opened the picture ${!!openedByDoubleClick.picture} and the PDF ${opened}`,
    );
    check(
      "preview.pdf.opens",
      opened && !!(await drawn(page, '[data-page="1"] .mac-preview-app-page-canvas')),
      await title(page),
    );
    const thumbs = win(page).getByRole("listbox", { name: "Thumbnails" }).getByRole("option");
    check(
      "preview.pdf.thumbnail-drawn",
      (await thumbs.count()) === 2 &&
        !!(await drawn(page, ".mac-preview-app-thumbnail-page canvas")),
      `${await thumbs.count()} thumbnails`,
    );
    await thumbs.nth(1).click();
    const p2 = await until(async () => (await title(page)).includes("page 2 of 2"), 8_000);
    await thumbs.nth(0).click();
    const p1 = await until(async () => (await title(page)).includes("page 1 of 2"), 8_000);
    check(
      "preview.pdf.thumbnail",
      !!p2 && !!p1,
      `second -> page 2 ${!!p2}; first -> page 1 ${!!p1}`,
    );
    for (const [item, shows] of [
      ["Next", 2],
      ["Previous", 1],
      ["End", 2],
      ["Home", 1],
      ["Page Down", 2],
      ["Page Up", 1],
    ]) {
      await choose(page, ["Go", item]);
      check(
        `preview.menu.go.${slug(item)}`,
        !!(await until(async () => (await title(page)).includes(`page ${shows} of 2`), 8_000)),
        await title(page),
      );
    }
    await tb(page, "Show Inspector").click();
    const inspector = win(page).locator(".mac-preview-app-inspector");
    const info = (await inspector.innerText().catch(() => "")).replace(/\s+/g, " ");
    check(
      "preview.inspector.pdf",
      info.includes("PDF document") &&
        info.includes("Pages: 2") &&
        info.includes("612 × 792 points"),
      info.slice(0, 160),
    );
    await tb(page, "Show Inspector").click();
    // View menu (menu bar) with the PDF open.
    const sidebar = () => win(page).getByRole("listbox", { name: "Thumbnails" });
    await choose(page, ["View", "Hide Sidebar"]);
    check(
      "preview.menu.view.hide-sidebar",
      !!(await until(
        async () =>
          !(await sidebar()
            .isVisible()
            .catch(() => false)),
        4_000,
      )),
      "hidden",
    );
    await choose(page, ["View", "Thumbnails"]);
    check(
      "preview.menu.view.thumbnails",
      !!(await until(() => sidebar().isVisible(), 4_000)),
      "shown",
    );
    const wa = (await leafBox(page))?.width ?? 0;
    await choose(page, ["View", "Zoom In"]);
    const wb = await until(async () => {
      const x = (await leafBox(page))?.width ?? 0;
      return x > wa + 2 ? x : null;
    }, 4_000);
    check("preview.menu.view.zoom-in", !!wb, `${Math.round(wa)} -> ${Math.round(wb ?? 0)}`);
    await choose(page, ["View", "Zoom Out"]);
    check(
      "preview.menu.view.zoom-out",
      !!(await until(async () => ((await leafBox(page))?.width ?? 0) < (wb ?? wa) - 2, 4_000)),
      "smaller",
    );
    await choose(page, ["View", "Actual Size"]);
    await page.waitForTimeout(400);
    const act = (await leafBox(page))?.width ?? 0;
    check(
      "preview.menu.view.actual-size",
      Math.abs(act - 612) <= 10,
      `${Math.round(act)} pt for a 612 pt page`,
    );
    await choose(page, ["View", "Zoom to Fit"]);
    await page.waitForTimeout(400);
    check(
      "preview.menu.view.zoom-to-fit",
      ((await leafBox(page))?.width ?? 0) !== act,
      `${Math.round((await leafBox(page))?.width ?? 0)} pt`,
    );
    // Search.
    await win(page).getByRole("searchbox", { name: "Search" }).click();
    await page.keyboard.type("ferry");
    const found = await until(() => page.getByText("Found on 1 page").isVisible(), 15_000);
    const pf = page.getByRole("listbox", { name: "Pages found" });
    check(
      "preview.search",
      !!found && (await pf.getByText("Page 2").isVisible()),
      found ? "Found on 1 page: Page 2" : "nothing found",
    );
    await pf.getByText("Page 2").click();
    check(
      "preview.search.pages-found",
      !!(await until(async () => (await title(page)).includes("page 2 of 2"), 6_000)),
      await title(page),
    );
    for (const [id, name] of [
      ["preview.search.previous", "Previous"],
      ["preview.search.next", "Next"],
    ]) {
      const b = page.getByRole("button", { name, exact: true }).first();
      const dimmed = await b.isDisabled().catch(() => true);
      if (dimmed) check(id, true, "dimmed: one page found");
      else {
        await b.click();
        check(
          id,
          (await title(page)).includes("page 2 of 2"),
          `one match: still page 2 (${await title(page)})`,
        );
      }
    }
    await page.getByRole("button", { name: "Done", exact: true }).click();
    check(
      "preview.search.done",
      !!(await until(() => sidebar().isVisible(), 5_000)),
      "the thumbnails show again",
    );
    // Markup on page 2: an arrow, then a signature (Cancel first).
    if (!(await page.getByRole("toolbar", { name: "Markup" }).isVisible()))
      await choose(page, ["View", "Show Markup Toolbar"]);
    check(
      "preview.menu.view.show-markup-toolbar",
      await page.getByRole("toolbar", { name: "Markup" }).isVisible(),
      "shown",
    );
    await mk(page, "Shapes").click();
    await page.getByRole("menuitem", { name: "Arrow", exact: true }).click();
    const aSaved = markSaved(page, ids.pdf);
    await drag(page, 2, [0.2, 0.2], [0.5, 0.4]);
    await aSaved;
    const sigsBefore = (await signatures(page)).length;
    await mk(page, "Sign").click();
    await page.getByRole("menuitem", { name: "Create Signature…" }).click();
    let padSheet = signSheet();
    check(
      "preview.sign.create",
      !!(await until(() => padSheet.isVisible(), 5_000)),
      "the sheet opens",
    );
    await padSheet.getByRole("button", { name: "Cancel", exact: true }).click();
    check(
      "preview.sign.cancel",
      !!(await until(async () => !(await padSheet.isVisible()), 4_000)) &&
        (await signatures(page)).length === sigsBefore,
      "closed; none kept",
    );
    check("preview.markup.tool.sign", true, "its menu opens (Create Signature… chosen above)");
    await mk(page, "Sign").click();
    await page.getByRole("menuitem", { name: "Create Signature…" }).click();
    padSheet = signSheet();
    const pad = page.getByRole("img", { name: "Signature pad" });
    await pad.waitFor({ timeout: 5_000 });
    let pb = await pad.boundingBox();
    for (let t = 0; t < 40; t += 1) {
      await page.waitForTimeout(100);
      const nb = await pad.boundingBox();
      if (nb && pb && nb.y === pb.y && nb.y > 0) break;
      pb = nb;
    }
    await page.mouse.move(pb.x + 40, pb.y + 100);
    await page.mouse.down();
    for (const [x, y] of [
      [80, 40],
      [120, 110],
      [160, 50],
      [220, 90],
      [300, 60],
    ])
      await page.mouse.move(pb.x + x, pb.y + y);
    await page.mouse.up();
    const inked = await padSheet.getByRole("button", { name: "Done", exact: true }).isEnabled();
    check("preview.sign.pad", inked, inked ? "stroke drawn: Done enabled" : "Done still dimmed");
    const sigSaved = page
      .waitForResponse(
        (r) =>
          r.request().method() === "PUT" && new URL(r.url()).pathname === "/api/preview/signatures",
        { timeout: 15_000 },
      )
      .catch(() => null);
    const placed = markSaved(page, ids.pdf);
    await padSheet.getByRole("button", { name: "Done", exact: true }).click();
    const ss = await sigSaved;
    await placed;
    check(
      "preview.sign.done",
      ss?.status() === 200 && markKinds(await markupOf(page, ids.pdf)).includes("signature"),
      markKinds(await markupOf(page, ids.pdf)).join(","),
    );
    await mk(page, "Sign").click();
    const kept = page
      .locator('[role="menu"][data-open]')
      .last()
      .getByRole("menuitem")
      .filter({ hasNotText: /Create Signature|Clear|Delete|Remove/ })
      .first();
    const keptName = (
      (await kept.getAttribute("aria-label")) ??
      (await kept.innerText().catch(() => "")) ??
      ""
    ).trim();
    const placed2 = markSaved(page, ids.pdf);
    if ((await kept.count()) > 0) await kept.click();
    else await page.keyboard.press("Escape");
    await placed2;
    check(
      "preview.sign.existing",
      markKinds(await markupOf(page, ids.pdf)).filter((k) => k === "signature").length >= 2,
      `${keptName || "no kept signature listed"}: ${markKinds(await markupOf(page, ids.pdf)).join(",")}`,
    );
    // The sidebar's divider.
    const sep = win(page).getByRole("separator", { name: "Resize the sidebar" }).first();
    const sb = await sep.boundingBox();
    const t0 = (await sidebar().boundingBox())?.width ?? 0;
    if (sb) {
      await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await page.mouse.down();
      await page.mouse.move(sb.x + sb.width / 2 + 40, sb.y + sb.height / 2, { steps: 6 });
      await page.mouse.up();
    }
    const t1 = (await sidebar().boundingBox())?.width ?? 0;
    check("preview.divider.sidebar", t1 > t0 + 20, `${Math.round(t0)} -> ${Math.round(t1)}`);
    // Where the PDF was left: page 2, zoomed in once.
    await thumbs.nth(1).click();
    await until(async () => (await title(page)).includes("page 2 of 2"), 8_000);
    await tb(page, "Zoom In").click();
    const keptPlace = await until(async () => {
      const f = (await places(page))[0];
      return f?.file === ids.pdf && f.page === 2 && f.zoom > 1 ? f : null;
    }, 10_000);
    check("preview.places.server", !!keptPlace, JSON.stringify((await places(page))[0] ?? null));
    const leafW = (await leafBox(page, 2))?.width ?? 0;
    await reload(page);
    await launch(page);
    const reopened = await showing(page, `${N.pdf} (page 2 of 2)`);
    await page.waitForTimeout(400);
    const leafW2 = (await leafBox(page, 2))?.width ?? 0;
    check(
      "preview.places.reload",
      reopened &&
        !(await sheet(page).isVisible()) &&
        (await places(page))[0]?.zoom === keptPlace?.zoom,
      `${await title(page)}; zoom kept ${keptPlace?.zoom}, after the reload ${(await places(page))[0]?.zoom} (page ${Math.round(leafW)} then ${Math.round(leafW2)} pt wide: the sidebar's width is not kept)`,
    );
    saveState({
      places: await places(page),
      lastTitle: `${N.pdf} (page 2 of 2)`,
      pdfMarks: markKinds(await markupOf(page, ids.pdf))
        .sort()
        .join(","),
      signatures: (await signatures(page)).length,
    });
  });

  await guard("Open Recent, File menu, isolation", page, async () => {
    await bringToFront(page, win(page), APP);
    const recent = await menuItems(page, ["File", "Open Recent"]);
    const names = recent.map((i) => i.label);
    check(
      "preview.menu.file.open-recent",
      names.includes(N.pdf) && names.includes(N.picture),
      names.join(" | "),
    );
    const beforeRecent = await openWindows(page);
    await choose(page, ["File", "Open Recent", N.picture]);
    await onlyTheNewest(page, beforeRecent);
    check("preview.menu.file.open-recent-item", await showing(page, N.picture), await title(page));
    await choose(page, ["File", "Open…"]);
    const s = await until(() => sheet(page).isVisible(), 5_000);
    check("preview.menu.file.open", !!s, s ? "the Open sheet shows" : "no sheet");
    if (s) await sheet(page).getByRole("button", { name: "Cancel", exact: true }).click();
    // The last place is the picture now: the restart check reopens it.
    await page.waitForTimeout(1500);
    saveState({ places: await places(page), lastTitle: N.picture });
    const b = await person("B", { create: bAcct });
    check(
      "preview.places.isolation",
      (await places(b)).length === 0 &&
        (await signatures(b)).length === 0 &&
        (await markupOf(b, ids.pdf)) === null,
      `places ${(await places(b)).length}, signatures ${(await signatures(b)).length}`,
    );
    await b.context().close();
  });

  const ensure = async () => {
    if (
      await win(page)
        .isVisible()
        .catch(() => false)
    )
      await bringToFront(page, win(page), APP);
    else await launch(page);
  };
  await guard("Go > Applications", page, () =>
    goApplicationsChecks(page, check, "preview", ensure),
  );
  await standardChecks({
    page,
    check,
    problem,
    guard,
    slug: "preview",
    App: APP,
    menus: MENUS,
    open: async () => {
      await launch(page);
      return win(page);
    },
    win: win(page),
    windowItem: "Preview",
  });

  if (opts.explore > 0) {
    const g = await person("explorer");
    await install(g, ["preview"]);
    await upload(g, "pictures", "R3 explore.png", { picture: true });
    await reload(g);
    await launch(g);
    const r = await explore(g, {
      app: APP,
      windows: g.locator(".mac-window.mac-preview-app"),
      seconds: opts.explore,
      seed: opts.seed,
      out: opts.out,
      browserName: opts.browserName,
      reopen: () => launch(g),
      menus: MENUS,
    });
    note(`exploratory pass: ${r.actions} actions, ${r.unresponsive} unresponsive, log ${r.log}`);
    console.log(
      `${r.unresponsive ? "FAIL" : "ok  "} explore (${r.actions} actions, seed ${opts.seed}, ${r.log})`,
    );
    if (r.unresponsive) problem(`exploratory pass: the UI stopped answering (${r.log})`);
  }
});
