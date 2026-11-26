#!/usr/bin/env node
// Preview's PDF text on the desktop served by `ferrite dev`: a real two-page PDF's text is laid over
// the drawn page and can be selected by dragging, Edit > Select All takes the page's text, Edit > Copy
// puts it on the clipboard, and the layer follows a turn of the page. Exits 0 only with every step
// passed and no console or HTTP error. It deletes only what it made.
//
//   node e2e/preview-pdf-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("preview-pdf", {
  contextOptions: { permissions: ["clipboard-read", "clipboard-write"] },
});
const RUN = Date.now().toString(36);
const LIBRARY = "/api/app-store/library";
const NAME = `Timetable ${RUN}.pdf`;
const FIRST = "Harbour timetable";
const SECOND = "The ferry leaves at ten";

function makePdf(texts) {
  const objects = [];
  const pageIds = texts.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${texts.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  texts.forEach((text, index) => {
    const id = pageIds[index];
    const stream = `BT /F1 28 Tf 72 700 Td (${text}) Tj ET`;
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

const upload = (page, name, text) =>
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
      for (let index = 0; index < uploading.pieces; index += 1) {
        const piece = blob.slice(
          index * uploading.piece_bytes,
          (index + 1) * uploading.piece_bytes,
        );
        await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await piece.arrayBuffer(),
        });
      }
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

const previewWindow = (page) => page.locator(".mac-preview-app").first();
const menu = async (page, title, item) => {
  await page.getByRole("menuitem", { name: title, exact: true }).first().click();
  await page.getByRole("menuitem", { name: item, exact: true }).first().click();
};
const selection = (page) => page.evaluate(() => document.getSelection()?.toString() ?? "");

await run(async (page) => {
  await openDesktop(page, base, step);
  const made = await upload(page, NAME, makePdf([FIRST, SECOND]));
  const library = await api(page, "GET", LIBRARY);
  const installed = library.json.installed ?? [];
  if (!installed.includes("preview")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...installed, "preview"],
      rev: library.json.rev,
    });
  }
  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Preview");
  await field.press("Enter");
  await previewWindow(page).waitFor({ state: "visible", timeout: 15_000 });
  const dialog = page.getByRole("dialog", { name: "Open" });
  if (!(await dialog.isVisible().catch(() => false))) {
    await previewWindow(page).getByRole("button", { name: "Open…" }).first().click();
  }
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await dialog.getByRole("option", { name: NAME }).dblclick({ timeout: 10_000 });

  const span = page.locator('[data-page="1"] .mac-preview-app-page-text span', {
    hasText: FIRST,
  });
  await span.waitFor({ state: "attached", timeout: 20_000 });
  step("the page's text is laid over the drawing", (await span.count()) === 1);
  const box = await span.boundingBox();
  step("the text stands near the top of the page, on one line", box.height < 60 && box.width > 100);

  // The window takes no press until the markup kept for this file has loaded.
  await page.locator('.mac-preview-app:not([aria-busy="true"])').waitFor({ timeout: 20_000 });

  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const dragged = await selection(page);
  step("dragging over the text selects it", dragged.includes("Harbour"), dragged);
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "preview-text.png"));

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await menu(page, "Edit", "Select All");
  step("Edit > Select All takes the page's text", (await selection(page)).includes(FIRST));
  await menu(page, "Edit", "Copy");
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => `${e}`);
  step("Edit > Copy puts it on the clipboard", copied.includes(FIRST), copied);

  await page.keyboard.press("Escape");
  await menu(page, "Tools", "Rotate Right");
  await page.waitForTimeout(1_200);
  const turned = await span.boundingBox();
  step(
    "the layer follows a turn of the page",
    turned && turned.height > turned.width,
    JSON.stringify(turned),
  );

  if (made) {
    await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: made }] });
  }
  if (!installed.includes("preview")) {
    const left = await api(page, "GET", LIBRARY);
    await api(page, "PUT", LIBRARY, {
      installed: (left.json.installed ?? []).filter((id) => id !== "preview"),
      rev: left.json.rev,
    });
  }
});
