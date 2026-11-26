#!/usr/bin/env node
// Preview's marks on a PDF's text, on the desktop served by `ferrite dev`, with a real three-page PDF:
// Tools > Annotate > Highlight Text over a selection and by dragging with Highlight on, Underline and
// Strikethrough, a Note placed, written and read again, the Highlights and Notes sidebar, what a search
// finds coloured on the page, all of it kept across a reload and drawn into an exported PDF. Exits 0 only
// with every step passed and no console or HTTP error. It deletes only what it made.
//
//   node e2e/preview-annotate-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("preview-annotate");
const RUN = Date.now().toString(36);
const LIBRARY = "/api/app-store/library";
const NAME = `Timetable ${RUN}.pdf`;
const EXPORTED = `Timetable out ${RUN}.pdf`;
const YELLOW = [0xfb, 0xe0, 0x4d];
const PINK = [0xf7, 0xa6, 0xc8];
const GREEN = [0xb1, 0xd8, 0x32];
const PAGES = [
  [
    "Harbour timetable",
    "The ferry leaves at ten",
    "The ferry returns at noon",
    "Tickets at the pier",
  ],
  ["Winter service", "No ferry on Sundays"],
  ["Fares", "Children ride the ferry free"],
];

function makePdf(pages) {
  const objects = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((lines, index) => {
    const id = pageIds[index];
    const stream = lines
      .map((line, at) => `BT /F1 28 Tf 72 ${700 - at * 60} Td (${line}) Tj ET`)
      .join("\n");
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

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value || Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const close = (color, want, tolerance = 40) =>
  color && want.every((value, index) => Math.abs(color[index] - value) <= tolerance);

await run(async (page) => {
  await openDesktop(page, base, step);
  const made = await upload(page, NAME, makePdf(PAGES));
  const library = (await api(page, "GET", LIBRARY)).json;
  const installed = library.installed ?? [];
  if (!installed.includes("preview")) {
    await api(page, "PUT", LIBRARY, { installed: [...installed, "preview"], rev: library.rev });
  }
  await reloadDesktop(page);

  const preview = page.locator(".mac-preview-app").first();
  const launch = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("Preview");
    await field.press("Enter");
    await preview.waitFor({ state: "visible", timeout: 15_000 });
  };
  await launch();
  const dialog = page.getByRole("dialog", { name: "Open" });
  if (!(await dialog.isVisible().catch(() => false))) {
    await preview.getByRole("button", { name: "Open…" }).first().click();
  }
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await dialog.getByRole("option", { name: NAME }).dblclick({ timeout: 10_000 });
  const settled = () =>
    page.locator('.mac-preview-app:not([aria-busy="true"])').waitFor({ timeout: 20_000 });

  const spanOf = (number, text) =>
    page
      .locator(`[data-page="${number}"] .mac-preview-app-page-text span`, { hasText: text })
      .first();
  await spanOf(1, "leaves at ten").waitFor({ state: "attached", timeout: 20_000 });
  await settled();

  const stored = async () => (await api(page, "GET", `/api/preview/markup/${made}`)).json.markup;
  const storedMarks = async (number) =>
    (await stored())?.pages?.find((each) => each.page === number)?.items ?? [];
  const storedKinds = async () =>
    ((await stored())?.pages ?? []).flatMap((each) => each.items.map((mark) => mark.kind)).sort();
  const menu = async (...names) => {
    for (const name of names) {
      await page.getByRole("menuitem", { name, exact: true }).first().click();
    }
  };
  const scrollTo = (number) =>
    preview.locator(".mac-preview-app-pages").evaluate((pages, number) => {
      pages.querySelector(`[data-page="${number}"]`).scrollIntoView({ block: "start" });
    }, number);
  const drag = async (box, from = 0.02, to = 0.98) => {
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * from, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * to, y, { steps: 8 });
    await page.mouse.up();
  };
  // The colour the screen shows at a point: the screenshot's pixel, as the blend makes it.
  const pixels = async (points) => {
    const shot = (await page.screenshot({ type: "png" })).toString("base64");
    return page.evaluate(
      async ({ shot, points }) => {
        const bytes = Uint8Array.from(atob(shot), (each) => each.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const ratio = image.width / window.innerWidth;
        return points.map(([x, y]) => [
          ...context.getImageData(Math.round(x * ratio), Math.round(y * ratio), 1, 1).data,
        ]);
      },
      { shot, points },
    );
  };
  // The colours along the middle of a span of text: its lightest shows the paper's tint, its darkest
  // the glyphs' ink under that tint.
  const across = async (box, fraction = 0.5) => {
    const points = Array.from({ length: 60 }, (_, index) => [
      box.x + box.width * (0.02 + (0.96 * index) / 59),
      box.y + box.height * fraction,
    ]);
    const colors = await pixels(points);
    const light = (color) => color[0] + color[1] + color[2];
    const sorted = colors.sort((a, b) => light(b) - light(a));
    return { lightest: sorted[0], darkest: sorted.at(-1) };
  };

  // Highlight Text over a selection: Tools > Annotate.
  const leaves = spanOf(1, "leaves at ten");
  const leavesBox = await leaves.boundingBox();
  const before = await across(leavesBox);
  step(
    "before any mark the text is ink on white paper",
    close(before.lightest, [255, 255, 255], 5) && before.darkest[0] < 90,
    JSON.stringify(before),
  );
  await drag(leavesBox);
  step(
    "the words are selected",
    (await page.evaluate(() => document.getSelection()?.toString() ?? "")).includes(
      "leaves at ten",
    ),
  );
  await menu("Tools", "Annotate", "Highlight Text");
  const highlights = await until(async () => {
    const items = await storedMarks(1);
    return items.length === 1 ? items : false;
  });
  step(
    "Highlight Text over a selection keeps a highlight of those words on the server",
    highlights?.[0]?.kind === "highlight" &&
      highlights[0].text.includes("leaves at ten") &&
      highlights[0].rects?.length === 1,
    JSON.stringify(highlights),
  );
  await page.waitForTimeout(300);
  const tinted = await across(leavesBox);
  step(
    "the page shows the words on yellow, their ink still dark",
    close(tinted.lightest, YELLOW) && tinted.darkest[0] < 110 && tinted.darkest[1] < 110,
    JSON.stringify(tinted),
  );
  step(
    "the selection is gone once it is marked",
    (await page.evaluate(() => document.getSelection()?.isCollapsed)) === true,
  );
  await shot(page, path.join(out, "preview-annotate-highlight.png"));

  // Highlight on, from the toolbar, in the colour its menu chose: a drag marks as it is let go.
  await preview.getByRole("button", { name: "Highlight Style" }).click();
  await page.getByRole("menuitemradio", { name: "Pink", exact: true }).click();
  await page.waitForTimeout(200);
  const button = preview.getByRole("button", { name: "Stop Highlighting" });
  step("choosing a colour with nothing selected turns Highlight on", await button.isVisible());
  const returns = spanOf(1, "returns at noon");
  const returnsBox = await returns.boundingBox();
  await drag(returnsBox);
  const pink = await until(async () => {
    const items = await storedMarks(1);
    return items.length === 2 ? items[1] : false;
  });
  step(
    "with Highlight on a drag over the words marks them",
    pink?.color === "#f7a6c8" && pink.text.includes("returns at noon"),
    JSON.stringify(pink),
  );
  await page.waitForTimeout(300);
  const pinkShown = await across(returnsBox);
  step("in the colour chosen", close(pinkShown.lightest, PINK), JSON.stringify(pinkShown));
  await button.click();
  await preview.getByRole("button", { name: "Highlight", exact: true }).waitFor({ timeout: 3_000 });

  // Underline and Strikethrough: lines through the words, not a tint behind them.
  const pier = spanOf(1, "Tickets at the pier");
  const pierBox = await pier.boundingBox();
  await drag(pierBox);
  await menu("Tools", "Annotate", "Underline Text");
  const underline = await until(async () => {
    const items = await storedMarks(1);
    return items.find((each) => each.kind === "underline") ?? false;
  });
  step(
    "Underline Text keeps an underline of the words",
    underline?.text?.includes("Tickets") && underline.rects?.length === 1,
    JSON.stringify(underline),
  );
  const marksInk = (box, fraction) =>
    page.evaluate(
      ({ box, fraction }) => {
        const canvas = document.querySelector('[data-page="1"] .mac-preview-app-page-marks');
        const frame = canvas.getBoundingClientRect();
        const scale = canvas.width / frame.width;
        const x = Math.round((box.x + box.width / 2 - frame.x) * scale);
        const top = Math.round((box.y + box.height * fraction - frame.y) * scale);
        const data = canvas.getContext("2d").getImageData(x, top - 3, 1, 7).data;
        for (let at = 0; at < data.length; at += 4) {
          if (data[at + 3] > 128) return [data[at], data[at + 1], data[at + 2]];
        }
        return null;
      },
      { box, fraction },
    );
  await page.waitForTimeout(300);
  const low = await marksInk(pierBox, 0.94);
  step("a red line runs along the foot of the words", close(low, [0xff, 0x3b, 0x30]), `${low}`);
  step("and none across their middle", (await marksInk(pierBox, 0.5)) === null);

  await menu("Tools", "Annotate", "Strikethrough Text");
  const winterName = "Harbour timetable";
  const titleBox = await spanOf(1, winterName).boundingBox();
  await drag(titleBox);
  const strike = await until(async () => {
    const items = await storedMarks(1);
    return items.find((each) => each.kind === "strikethrough") ?? false;
  });
  step(
    "Strikethrough Text with nothing selected marks what is dragged over next",
    strike?.text?.includes(winterName),
    JSON.stringify(strike),
  );
  await page.waitForTimeout(300);
  const middle = await marksInk(titleBox, 0.55);
  step("a red line runs through the words", close(middle, [0xff, 0x3b, 0x30]), `${middle}`);
  await preview.getByRole("button", { name: "Stop Highlighting" }).click();
  await page.mouse.move(10, 10);
  await shot(page, path.join(out, "preview-annotate-lines.png"));

  // A note: Control-Command-N, placed with a click, written, closed, read again.
  await page.locator('[data-page="1"] .mac-preview-app-page-text').click({
    position: { x: 8, y: 8 },
  });
  await page.keyboard.press("Control+Meta+N");
  await page.getByRole("toolbar", { name: "Markup" }).waitFor({ timeout: 5_000 });
  const leaf = await page.locator('[data-page="1"]').first().boundingBox();
  const noteAt = { x: leaf.x + leaf.width * 0.8, y: leaf.y + leaf.height * 0.35 };
  await page.mouse.click(noteAt.x, noteAt.y);
  const editor = page.getByRole("textbox", { name: "Note" });
  await editor.waitFor({ timeout: 5_000 });
  await editor.fill("Ask about\nthe noon boat");
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "preview-annotate-note-open.png"));
  await page.keyboard.press("Tab");
  const note = await until(async () => {
    const items = await storedMarks(1);
    return items.find((each) => each.kind === "note") ?? false;
  });
  step(
    "a note is placed where it was clicked and keeps what was written",
    note?.text === "Ask about\nthe noon boat" &&
      Math.abs(note.x + note.w / 2 - 0.8) < 0.01 &&
      Math.abs(note.y + note.h / 2 - 0.35) < 0.01,
    JSON.stringify(note),
  );
  await page.waitForTimeout(300);
  await page.mouse.click(noteAt.x, noteAt.y);
  await editor.waitFor({ timeout: 5_000 });
  step(
    "with the markup toolbar shown, one press on the note opens what it says",
    (await editor.inputValue()) === "Ask about\nthe noon boat",
  );
  await editor.press("Escape");
  await editor.waitFor({ state: "hidden", timeout: 5_000 });
  const icon = await page.evaluate((at) => {
    const canvas = document.querySelector('[data-page="1"] .mac-preview-app-page-marks');
    const frame = canvas.getBoundingClientRect();
    const scale = canvas.width / frame.width;
    const { data } = canvas
      .getContext("2d")
      .getImageData(
        Math.round((at.x - frame.x) * scale),
        Math.round((at.y - frame.y) * scale),
        1,
        1,
      );
    return [...data];
  }, noteAt);
  step("its icon is drawn there in yellow", close(icon, YELLOW, 10), `${icon}`);

  await preview.getByRole("button", { name: "Show Markup Toolbar" }).click();
  await page.getByRole("button", { name: "Note: Ask about" }).click();
  step(
    "pressing the note opens what it says",
    (await editor.inputValue()) === "Ask about\nthe noon boat",
  );
  await editor.fill("Ask about the noon boat");
  await page.keyboard.press("Tab");
  const edited = await until(async () => {
    const items = await storedMarks(1);
    const found = items.find((each) => each.kind === "note");
    return found?.text === "Ask about the noon boat" ? found : false;
  });
  step("what is written there replaces it, the same note", edited?.id === note?.id);

  // The sidebar lists them by page, from the top of it.
  await page.getByRole("menuitem", { name: "View", exact: true }).first().click();
  await page.getByRole("menuitemradio", { name: "Highlights and Notes", exact: true }).click();
  const list = preview.getByRole("listbox", { name: "Highlights and Notes" });
  await list.waitFor({ timeout: 5_000 });
  const rows = async () =>
    list
      .locator("[data-index]")
      .evaluateAll((each) =>
        each
          .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
          .map((row) => row.textContent),
      );
  const listed = await rows();
  step(
    "the sidebar lists all five, from the top of the page down, each with its words",
    listed.length === 5 &&
      listed[0].startsWith("Strikethrough") &&
      listed[0].includes(winterName) &&
      listed[1].startsWith("Highlight") &&
      listed[1].includes("leaves at ten") &&
      listed[2].startsWith("Highlight") &&
      listed[3].startsWith("Underline") &&
      listed[4].startsWith("Note") &&
      listed[4].includes("noon boat") &&
      listed.every((row) => row.includes("Page 1")),
    JSON.stringify(listed),
  );

  // A highlight on the second page: its row goes to it, and Delete takes it off.
  await scrollTo(2);
  await page.waitForTimeout(600);
  const sundays = spanOf(2, "No ferry on Sundays");
  await sundays.waitFor({ state: "attached", timeout: 10_000 });
  const sundaysBox = await sundays.boundingBox();
  await drag(sundaysBox);
  await page.keyboard.press("Control+Meta+H");
  const second = await until(async () => {
    const items = await storedMarks(2);
    return items.length === 1 ? items[0] : false;
  });
  step(
    "Control-Command-H highlights what is selected, in the colour last chosen",
    second?.kind === "highlight" && second.color === "#f7a6c8" && second.text.includes("Sundays"),
    JSON.stringify(second),
  );
  await page.waitForTimeout(300);
  await scrollTo(1);
  await page.waitForTimeout(300);
  const titleBar = () => preview.locator(".mac-title-bar, [class*=title-bar]").first();
  await list.locator('[data-index="5"]').click();
  await page.waitForTimeout(400);
  step(
    "choosing its row goes to its page",
    (await titleBar().textContent()).includes("page 2 of 3"),
    await titleBar().textContent(),
  );
  await shot(page, path.join(out, "preview-annotate-sidebar.png"));
  await list.focus();
  await page.keyboard.press("Delete");
  const gone = await until(async () => (await storedMarks(2)).length === 0);
  step("Delete takes the chosen mark off", gone === true && (await rows()).length === 5);
  await page.getByRole("menuitem", { name: "Edit", exact: true }).first().click();
  await page.getByRole("menuitem", { name: "Undo", exact: true }).first().click();
  const back = await until(async () => (await storedMarks(2)).length === 1);
  step("Undo brings it back", back === true && (await rows()).length === 6);

  // Search: every place found on the page is coloured, on a page without highlights its plain colour.
  await preview.getByRole("searchbox", { name: "Search" }).fill("ferry");
  const foundMarks = page.locator(".mac-preview-app-page-found");
  const foundOn = (number) => page.locator(`[data-page="${number}"] .mac-preview-app-page-found`);
  await until(async () => (await foundOn(1).count()) === 2, 10_000);
  step(
    "a search colours each place it is found on the page",
    (await foundOn(1).count()) === 2,
    `${await foundOn(1).count()}`,
  );
  await scrollTo(3);
  await until(async () => (await foundOn(3).count()) === 1, 10_000);
  await page.waitForTimeout(400);
  const word = foundOn(3).first();
  const wordBox = await word.boundingBox();
  const lineBox = await spanOf(3, "Children ride the ferry free").boundingBox();
  const relation = {
    left: (wordBox.x - lineBox.x) / lineBox.width,
    width: wordBox.width / lineBox.width,
    top: Math.abs(wordBox.y - lineBox.y),
  };
  step(
    "the colour stands on the word, not its whole line",
    relation.top < 4 && relation.width > 0.1 && relation.width < 0.3 && relation.left > 0.4,
    JSON.stringify(relation),
  );
  const foundColor = await across(wordBox);
  step(
    "the colour is the found text's, its ink still dark",
    close(foundColor.lightest, GREEN) && foundColor.darkest[0] < 110,
    JSON.stringify(foundColor),
  );
  await page.mouse.move(10, 10);
  await shot(page, path.join(out, "preview-annotate-found.png"));
  await preview.getByRole("searchbox", { name: "Search" }).fill("");
  await until(async () => (await foundMarks.count()) === 0);
  step("clearing the search takes the colour off", (await foundMarks.count()) === 0);

  // Across a reload all of it is drawn again, from the server.
  await reloadDesktop(page);
  await launch();
  // It reopens where it was left, the last page: the first is drawn once it comes near the view.
  await page.locator('[data-page="3"]').first().waitFor({ state: "attached", timeout: 20_000 });
  await settled();
  await scrollTo(1);
  await spanOf(1, "leaves at ten").waitFor({ state: "attached", timeout: 20_000 });
  await page.waitForTimeout(800);
  step(
    "after a reload the server still has all six",
    JSON.stringify(await storedKinds()) ===
      JSON.stringify(["highlight", "highlight", "highlight", "note", "strikethrough", "underline"]),
    JSON.stringify(await storedKinds()),
  );
  await page.waitForTimeout(600);
  const reloaded = await across(await spanOf(1, "leaves at ten").boundingBox());
  step(
    "and the page shows the highlight again",
    close(reloaded.lightest, YELLOW) && reloaded.darkest[0] < 110,
    JSON.stringify(reloaded),
  );
  await page.getByRole("menuitem", { name: "View", exact: true }).first().click();
  await page.getByRole("menuitemradio", { name: "Highlights and Notes", exact: true }).click();
  step(
    "and the sidebar lists them",
    (await until(async () => (await rows()).length === 6)) === true,
  );

  // Export draws them into the copy's pages, as JPEG pictures: the words of a note do not go with it.
  await preview.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Export…", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Export the document" });
  await sheet.waitFor({ timeout: 10_000 });
  const saveAs = sheet.getByRole("textbox", { name: "Save As:" });
  await page.waitForTimeout(400);
  for (let tries = 0; tries < 5 && (await saveAs.inputValue()) !== EXPORTED; tries += 1) {
    await saveAs.fill(EXPORTED);
    await page.waitForTimeout(150);
  }
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  const copy = await until(
    async () =>
      ((await api(page, "GET", "/api/files/")).json.entries ?? []).find(
        (each) => each.name === EXPORTED && each.trashed_ms === undefined,
      ),
    15_000,
  );
  const [mark] = (await storedMarks(1)).filter((each) => each.kind === "highlight");
  const written = copy
    ? await page.evaluate(
        async ({ id, mark }) => {
          const response = await fetch(`/api/files/content/${id}?piece=0&count=8`, {
            credentials: "same-origin",
          });
          const raw = new Uint8Array(await response.arrayBuffer());
          const text = Array.from(raw, (byte) => String.fromCharCode(byte)).join("");
          const first = text.match(/\xff\xd8\xff[\s\S]*?\xff\xd9/)?.[0];
          const bytes = Uint8Array.from(first, (each) => each.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(bitmap, 0, 0);
          const [x, y, w, h] = mark.rects[0];
          // JPEG smears colour around each glyph: the tint is read over the words, the ink through them.
          const along = (fraction) => {
            const row = Math.round((y + h * fraction) * bitmap.height);
            const seen = [];
            for (let column = 0; column < 60; column += 1) {
              const at = Math.round((x + w * (0.02 + (0.96 * column) / 59)) * bitmap.width);
              seen.push([...context.getImageData(at, row, 1, 1).data]);
            }
            const light = (color) => color[0] + color[1] + color[2];
            return seen.sort((a, b) => light(b) - light(a));
          };
          return { lightest: along(0.06)[0], darkest: along(0.5).at(-1) };
        },
        { id: copy.id, mark },
      )
    : null;
  step(
    "an exported PDF has the highlight drawn into its page, the words dark on yellow",
    close(written?.lightest, YELLOW) && written.darkest[0] < 110,
    JSON.stringify(written),
  );

  // A full file refuses a new note: what is being written stays open, also when another note is pressed.
  const saved = (await api(page, "GET", `/api/preview/markup/${made}`)).json;
  const held = saved.markup.pages.flatMap((each) => each.items).length;
  const pad = Array.from({ length: 500 - held }, (_, index) => ({
    id: `pad${index}`,
    kind: "rect",
    color: "#000000",
    stroke: 0.002,
    x: 0.01,
    y: 0.9,
    w: 0.001,
    h: 0.001,
  }));
  await api(page, "PUT", `/api/preview/markup/${made}`, {
    rev: saved.rev,
    markup: {
      ...saved.markup,
      pages: saved.markup.pages.some((each) => each.page === 2)
        ? saved.markup.pages.map((each) =>
            each.page === 2 ? { ...each, items: [...each.items, ...pad] } : each,
          )
        : [...saved.markup.pages, { page: 2, items: pad }],
    },
  });
  await reloadDesktop(page);
  // The sidebar's thumbnail of the page has the same data-page: this is the page itself.
  const fullPage = page.locator('[data-page="1"]:has(.mac-preview-app-page-text)');
  await fullPage.waitFor({ timeout: 30_000 });
  await fullPage.evaluate((sheet) => sheet.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(400);
  await page.locator('[data-page="1"] .mac-preview-app-page-text').click({
    position: { x: 8, y: 8 },
  });
  await page.keyboard.press("Control+Meta+N");
  const bar = page.getByRole("toolbar", { name: "Markup" });
  await bar.waitFor({ timeout: 5_000 });
  const sheetOf = await fullPage.boundingBox();
  const onWord = await fullPage
    .locator(".mac-preview-app-page-text span", { hasText: "leaves" })
    .first()
    .boundingBox();
  await page.mouse.click(onWord.x + onWord.width / 2, onWord.y + onWord.height / 2);
  await editor.waitFor({ timeout: 5_000 });
  step("the Note tool places a note on a word of the page's text", true);
  await editor.fill("Draft at the limit");
  await page.keyboard.press("Tab");
  const refusal = page.getByRole("alertdialog");
  await refusal.waitFor({ timeout: 5_000 });
  await refusal.getByRole("button").first().click();
  await refusal.waitFor({ state: "hidden", timeout: 5_000 });
  await page.mouse.click(sheetOf.x + sheetOf.width * 0.8, sheetOf.y + sheetOf.height * 0.35);
  await page.waitForTimeout(300);
  if (await refusal.count()) {
    await refusal.getByRole("button").first().click();
    await refusal.waitFor({ state: "hidden", timeout: 5_000 });
  }
  step(
    "a note the full file refuses stays open with what it says when another note is pressed",
    (await editor.inputValue()) === "Draft at the limit",
    await editor.inputValue(),
  );
  await editor.press("Escape");

  const ids = [made, copy?.id].filter(Boolean);
  await api(page, "POST", "/api/files/ops", {
    ops: ids.map((id) => ({ op: "delete", id })),
  });
  if (!installed.includes("preview")) {
    const left = (await api(page, "GET", LIBRARY)).json;
    await api(page, "PUT", LIBRARY, {
      installed: (left.installed ?? []).filter((id) => id !== "preview"),
      rev: left.rev,
    });
  }
});
