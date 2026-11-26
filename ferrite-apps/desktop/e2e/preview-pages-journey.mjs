#!/usr/bin/env node
// Preview's page editing on the desktop served by `ferrite dev`, with a real five-page PDF: drag a thumbnail
// to move a page, its marks going with it; Command-click and Delete; Undo; Edit > Insert > Blank Page; the
// thumbnails' contextual menu; the order kept across a reload; Export writing the pages as shown, read back
// from the drive. Exits 0 only with every step passed and no console or HTTP error. It deletes only what it
// made.
//
//   node e2e/preview-pages-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("preview-pages");
const RUN = Date.now().toString(36);
const NAME = `Pages ${RUN}.pdf`;
const EXPORTED = `Pages out ${RUN}.pdf`;
const LIBRARY = "/api/app-store/library";

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

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const uploadPdf = (name, text) =>
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
  const made = await uploadPdf(NAME, makePdf(["One", "Two", "Three", "Four", "Five"]));
  const otherName = `Other ${RUN}.pdf`;
  const other = await uploadPdf(otherName, makePdf(["Alpha", "Beta", "Gamma"]));
  const library = (await api(page, "GET", LIBRARY)).json;
  if (!(library.installed ?? []).includes("preview")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(library.installed ?? []), "preview"],
      rev: library.rev,
    });
  }
  await reloadDesktop(page);

  const launch = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("Preview");
    await field.press("Enter");
    await preview.waitFor({ state: "visible", timeout: 15_000 });
  };
  const preview = page.locator(".mac-preview-app").first();
  await launch();
  const dialog = page.getByRole("dialog", { name: "Open" });
  if (!(await dialog.isVisible().catch(() => false))) {
    await preview.getByRole("button", { name: "Open…" }).first().click();
  }
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await dialog.getByRole("option", { name: NAME }).dblclick({ timeout: 10_000 });
  await page.locator('[data-page="5"]').first().waitFor({ state: "attached", timeout: 20_000 });
  const settled = () =>
    page.waitForFunction(
      () => document.querySelector(".mac-preview-app")?.getAttribute("aria-busy") !== "true",
      undefined,
      { timeout: 20_000 },
    );
  await settled();

  const thumbnails = preview.getByRole("listbox", { name: "Thumbnails" });
  const thumb = (number) => thumbnails.locator(`[data-index="${number - 1}"]`);
  const reveal = async (number) => {
    await thumbnails.evaluate((list, number) => {
      list.scrollTop = (number - 1) * 132;
    }, number);
    await thumb(number).waitFor({ timeout: 5_000 });
  };
  const count = () =>
    page.evaluate(() => document.querySelectorAll(".mac-preview-app-pages [data-page]").length);
  // The text of a page as the window reads it from the PDF: from its text layer, scrolled to.
  const textOf = async (number) => {
    await page.evaluate((number) => {
      document
        .querySelector(`.mac-preview-app-pages [data-page="${number}"]`)
        ?.scrollIntoView({ block: "start" });
    }, number);
    // A page is laid out once it comes near the view.
    await page.waitForTimeout(600);
    return until(
      async () =>
        (await page.evaluate((number) => {
          return document
            .querySelector(`[data-page="${number}"] .mac-preview-app-page-text`)
            ?.textContent?.trim();
        }, number)) || false,
      5_000,
    );
  };
  const texts = async () => {
    const all = [];
    for (let number = 1; number <= (await count()); number += 1) {
      all.push((await textOf(number)) || "");
    }
    return all;
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const stored = async () => (await api(page, "GET", `/api/preview/markup/${made}`)).json.markup;
  const choose = async (menu, item) => {
    await page.getByRole("menuitem", { name: menu, exact: true }).first().click();
    await page.getByRole("menuitem", { name: item, exact: true }).first().click();
  };
  const order = (wanted) => until(async () => same((await stored())?.order ?? null, wanted), 8_000);

  step(
    "the PDF opens in its own order",
    same(await texts(), ["One", "Two", "Three", "Four", "Five"]),
  );

  // A mark on page 2, to see that it goes with its page.
  await reveal(2);
  await thumb(2).click();
  await page.waitForTimeout(300);
  await preview.getByRole("button", { name: "Show Markup Toolbar" }).click();
  await page
    .getByRole("toolbar", { name: "Markup" })
    .getByRole("button", { name: "Shapes" })
    .click();
  await page.getByRole("menuitem", { name: "Rectangle", exact: true }).click();
  const target = await page
    .locator('[data-page="2"] .mac-preview-app-page-marks')
    .first()
    .boundingBox();
  await page.mouse.move(target.x + target.width * 0.2, target.y + target.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width * 0.5, target.y + target.height * 0.4, {
    steps: 6,
  });
  await page.mouse.up();
  await until(async () => (await stored())?.pages?.[0]?.page === 2, 8_000);
  await page.keyboard.press("Escape");
  await preview.getByRole("button", { name: "Show Markup Toolbar" }).click();

  // Dragged to the top of the sidebar, page 3 comes first; the others follow.
  await reveal(1);
  const three = await thumb(3).boundingBox();
  const one = await thumb(1).boundingBox();
  await page.mouse.move(three.x + three.width / 2, three.y + three.height / 2);
  await page.mouse.down();
  await page.mouse.move(three.x + three.width / 2, three.y + three.height / 2 - 30, { steps: 4 });
  await page.mouse.move(one.x + one.width / 2, one.y + 6, { steps: 8 });
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "preview-pages-drag.png"));
  step(
    "a drag shows where the pages will go",
    (await preview.locator(".mac-preview-app-thumbnails-line").count()) === 1,
  );
  await page.mouse.up();
  step("the order is kept with the markup", (await order([3, 1, 2, 4, 5])) === true);
  await page.waitForTimeout(400);
  step(
    "dragging a thumbnail moves its page",
    same(await texts(), ["Three", "One", "Two", "Four", "Five"]),
    JSON.stringify(await texts()),
  );
  const marks = await stored();
  step(
    "a page's marks go with it",
    marks?.pages?.[0]?.page === 3,
    JSON.stringify(marks?.pages?.map((each) => each.page)),
  );

  // Two chosen with Command, then Delete.
  await reveal(1);
  await thumb(2).click();
  await thumb(3).click({ modifiers: ["Meta"] });
  // A third chosen and taken back again, the page shown then being one of the other two.
  await thumb(4).click({ modifiers: ["Meta"] });
  await thumb(4).click({ modifiers: ["Meta"] });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "preview-pages-chosen.png"));
  step(
    "Command-click chooses a second page",
    (await thumbnails.locator('[aria-selected="true"]').count()) === 2,
  );
  await thumbnails.focus();
  await page.keyboard.press("Delete");
  step("Delete takes the chosen pages out", (await order([3, 4, 5])) === true);
  await page.waitForTimeout(400);
  step(
    "the window has three pages left",
    same(await texts(), ["Three", "Four", "Five"]),
    JSON.stringify(await texts()),
  );
  await choose("Edit", "Undo");
  step("Undo brings them back", (await order([3, 1, 2, 4, 5])) === true);
  await page.waitForTimeout(400);
  step("with their pages", same(await texts(), ["Three", "One", "Two", "Four", "Five"]));

  // A blank page after the first.
  await reveal(1);
  await thumb(1).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Insert", exact: true }).click();
  await page.getByRole("menuitem", { name: "Blank Page", exact: true }).click();
  step(
    "Insert > Blank Page adds a page after the chosen one",
    (await order([3, 0, 1, 2, 4, 5])) === true,
  );
  await page.waitForTimeout(600);

  // The contextual menu deletes the page under the pointer.
  await reveal(1);
  await thumb(3).click({ button: "right" });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "preview-pages-menu.png"));
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  step(
    "Delete in the thumbnails' menu takes that page out",
    (await order([3, 0, 2, 4, 5])) === true,
  );
  await page.waitForTimeout(400);

  await reloadDesktop(page);
  await launch();
  await page.locator('[data-page="5"]').first().waitFor({ state: "attached", timeout: 20_000 });
  await settled();
  await page.waitForTimeout(400);
  const afterReload = await page.evaluate(
    () => document.querySelectorAll(".mac-preview-app-pages [data-page]").length,
  );
  step(
    "after a reload the pages are as they were left",
    afterReload === 5 && (await textOf(1)) === "Three" && (await textOf(3)) === "Two",
  );

  // Export writes the pages as shown, the blank one among them: each page of the file is compared with
  // the page the window shows, so the file's own order cannot pass.
  await preview.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Export…", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Export the document" });
  await sheet.waitFor({ timeout: 10_000 });
  await sheet.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "PDF", exact: true }).click();
  const field = sheet.getByRole("textbox", { name: "Save As:" });
  await page.waitForTimeout(400);
  for (let tries = 0; tries < 5 && (await field.inputValue()) !== EXPORTED; tries += 1) {
    await field.fill(EXPORTED);
    await page.waitForTimeout(150);
  }
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  const exported = await until(async () =>
    ((await api(page, "GET", "/api/files/")).json.entries ?? []).find(
      (each) => each.name === EXPORTED && each.trashed_ms === undefined,
    ),
  );
  const pagesOut = exported
    ? await page.evaluate(async (id) => {
        const response = await fetch(`/api/files/content/${id}?piece=0&count=8`, {
          credentials: "same-origin",
        });
        const text = new TextDecoder("latin1").decode(await response.arrayBuffer());
        return text.match(/\/Count (\d+)/)?.[1];
      }, exported.id)
    : null;
  step(
    "Export writes a PDF of the five pages shown, read back from the drive",
    pagesOut === "5",
    String(pagesOut),
  );
  const compared = exported
    ? await page.evaluate(async (id) => {
        const response = await fetch(`/api/files/content/${id}?piece=0&count=8`, {
          credentials: "same-origin",
        });
        const raw = new Uint8Array(await response.arrayBuffer());
        const text = Array.from(raw, (byte) => String.fromCharCode(byte)).join("");
        const WIDE = 306;
        const HIGH = 396;
        const inkOf = (draw) => {
          const canvas = document.createElement("canvas");
          canvas.width = WIDE;
          canvas.height = HIGH;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.fillStyle = "#fff";
          context.fillRect(0, 0, WIDE, HIGH);
          draw(context);
          const { data } = context.getImageData(0, 0, WIDE, HIGH);
          const ink = new Set();
          for (let at = 0; at < data.length; at += 4) {
            if (data[at] < 180 || data[at + 1] < 180 || data[at + 2] < 180) ink.add(at);
          }
          return ink;
        };
        const answer = [];
        const pictures = text.match(/\xff\xd8\xff[\s\S]*?\xff\xd9/g) ?? [];
        for (const [index, picture] of pictures.entries()) {
          const bytes = Uint8Array.from(picture, (each) => each.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
          const leaf = document.querySelector(`.mac-preview-app-pages [data-page="${index + 1}"]`);
          leaf?.scrollIntoView({ block: "start" });
          await new Promise((done) => setTimeout(done, 800));
          const written = inkOf((context) => context.drawImage(bitmap, 0, 0, WIDE, HIGH));
          const shown = inkOf((context) => {
            for (const canvas of leaf?.querySelectorAll("canvas") ?? []) {
              context.drawImage(canvas, 0, 0, WIDE, HIGH);
            }
          });
          const both = [...written].filter((at) => shown.has(at)).length;
          answer.push({
            written: written.size,
            shown: shown.size,
            overlap: both / Math.max(1, written.size + shown.size - both),
          });
        }
        return answer;
      }, exported.id)
    : [];
  step(
    "each page of the exported file is the page shown, the second blank",
    compared.length === 5 &&
      compared[1].written === 0 &&
      compared.every((each, index) => index === 1 || each.overlap > 0.5),
    JSON.stringify(compared),
  );

  // Another document starts with none of this one's pages chosen: Delete takes only its current page.
  await reveal(1);
  await thumb(1).click();
  await thumb(2).click({ modifiers: ["Meta"] });
  await preview.getByRole("button", { name: "Open…" }).first().click();
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await dialog.getByRole("option", { name: otherName }).dblclick({ timeout: 10_000 });
  await until(async () => (await count()) === 3, 20_000);
  await settled();
  step(
    "another document opens with only its current page chosen",
    (await thumbnails.locator('[aria-selected="true"]').count()) === 1,
  );
  await reveal(1);
  await thumbnails.focus();
  await page.keyboard.press("Delete");
  const otherOrder = await until(async () => {
    const held = (await api(page, "GET", `/api/preview/markup/${other}`)).json.markup?.order;
    return same(held ?? null, [2, 3]);
  }, 8_000);
  step("Delete there takes out only that page", otherOrder === true);

  await api(page, "POST", "/api/files/ops", {
    ops: [
      { op: "trash", id: made },
      { op: "trash", id: other },
      ...(exported ? [{ op: "trash", id: exported.id }] : []),
    ],
  });
});
