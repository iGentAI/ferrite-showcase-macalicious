#!/usr/bin/env node
// Preview's second batch of rows on the desktop served by `ferrite dev`, with real PDFs and a real picture: a PDF's
// links; bookmarks and the sidebar kept across a reload; Insert > Page from File written by pdf.js with its text kept and
// the old file in the Trash; an elliptical crop, Adjust Color and Adjust Size read back from the canvas and the Inspector;
// a star the server keeps; the title's pop-over; Preferences; a file dropped from the computer. Exits 0 only with every
// step passed and no console or HTTP error.
//
//   node e2e/preview-tools-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("preview-tools");
const RUN = Date.now().toString(36);
const NAME = `Tools ${RUN}.pdf`;
const OTHER = `Tools other ${RUN}.pdf`;
const PICTURE = `Tools ${RUN}.png`;
const LIBRARY = "/api/app-store/library";
const SETTINGS = "/api/system-preferences/settings";

function makePdf(texts, links = false) {
  const objects = [];
  const pageIds = texts.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${texts.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  texts.forEach((text, index) => {
    const id = pageIds[index];
    const stream = `BT /F1 40 Tf 72 400 Td (${text}) Tj ET`;
    const annotations =
      links && index === 0
        ? ` /Annots [<< /Type /Annot /Subtype /Link /Rect [72 390 300 440] /Border [0 0 0] /Dest [${pageIds[2]} 0 R /Fit] >> << /Type /Annot /Subtype /Link /Rect [72 200 300 260] /Border [0 0 0] /A << /S /URI /URI (https://example.com/) >> >>]`
        : "";
    objects[id] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R${annotations} >>`;
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
  const upload = (parent, name, text, type) =>
    page.evaluate(
      async ({ parent, name, text, type }) => {
        let blob = new Blob([text ?? ""], { type });
        if (text === null) {
          const canvas = document.createElement("canvas");
          canvas.width = 400;
          canvas.height = 300;
          const context = canvas.getContext("2d");
          context.fillStyle = "#804020";
          context.fillRect(0, 0, 400, 300);
          blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        }
        const json = { "content-type": "application/json" };
        const uploading = await fetch("/api/files/uploads", {
          method: "POST",
          credentials: "same-origin",
          headers: json,
          body: JSON.stringify({ parent, name, size: blob.size, type, existing: "fail" }),
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
      { parent, name, text, type },
    );
  await upload("pictures", NAME, makePdf(["One", "Two", "Three"], true), "application/pdf");
  await upload("documents", OTHER, makePdf(["Alpha", "Beta"]), "application/pdf");
  await upload("pictures", PICTURE, null, "image/png");
  const library = (await api(page, "GET", LIBRARY)).json;
  if (!(library.installed ?? []).includes("preview")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(library.installed ?? []), "preview"],
      rev: library.rev,
    });
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
  const settled = () =>
    page.waitForFunction(
      () => document.querySelector(".mac-preview-app")?.getAttribute("aria-busy") !== "true",
      undefined,
      { timeout: 20_000 },
    );
  const choose = async (menu, item, through) => {
    await page.getByRole("menuitem", { name: menu, exact: true }).first().click();
    if (through) await page.getByRole("menuitem", { name: through, exact: true }).first().click();
    await page
      .getByRole("menuitem", { name: item, exact: true })
      .or(page.getByRole("menuitemradio", { name: item, exact: true }))
      .first()
      .click();
  };
  const title = () => preview.locator(".mac-title-bar-title-text").first().innerText();
  const titled = (text) => until(async () => (await title()).includes(text));
  const openDialog = page.getByRole("dialog", { name: "Open" });
  const drive = async () => (await api(page, "GET", "/api/files/")).json.entries;
  const textOf = async (number) => {
    await page.evaluate((number) => {
      document
        .querySelector(`.mac-preview-app-pages [data-page="${number}"]`)
        ?.scrollIntoView({ block: "start" });
    }, number);
    await page.waitForTimeout(500);
    return until(
      async () =>
        (await page.evaluate(
          (number) =>
            document
              .querySelector(`[data-page="${number}"] .mac-preview-app-page-text`)
              ?.textContent?.trim(),
          number,
        )) || false,
      5_000,
    );
  };

  await launch();
  if (!(await openDialog.isVisible().catch(() => false))) {
    await preview.getByRole("button", { name: "Open…" }).first().click();
  }
  await openDialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await openDialog.getByRole("option", { name: NAME }).dblclick({ timeout: 10_000 });
  await page.locator('[data-page="3"]').first().waitFor({ state: "attached", timeout: 20_000 });
  await settled();

  // Links.
  const toPage = preview.getByRole("button", { name: "Link to page 3" });
  step("a PDF's link to a page stands over its words", await until(() => toPage.isVisible()));
  step(
    "a PDF's link to a web address is read from the file",
    await until(() =>
      preview.getByRole("button", { name: "Link to https://example.com/" }).isVisible(),
    ),
  );
  await toPage.click();
  step("following it goes to the page", await titled("page 3 of 3"), await title());

  // Bookmarks and the sidebar, kept across a reload.
  await preview.getByRole("document").focus();
  await page.keyboard.press("Control+d");
  await choose("View", "Bookmarks");
  const marks = preview.getByRole("listbox", { name: "Bookmarks" });
  step(
    "Add Bookmark lists the page",
    await until(() => marks.getByRole("option", { name: "Page 3" }).isVisible()),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "preview-tools-bookmarks.png"));
  const kept = await until(
    async () => (await api(page, "GET", SETTINGS)).json.values?.["preview.sidebar"] === "bookmarks",
    10_000,
  );
  step("the sidebar chosen is kept with the settings", kept === true);
  await reloadDesktop(page);
  await launch();
  await settled();
  step(
    "after a reload the PDF opens on its bookmarks",
    await until(() =>
      preview
        .getByRole("listbox", { name: "Bookmarks" })
        .getByRole("option", { name: "Page 3" })
        .isVisible(),
    ),
  );

  // Insert > Page from File, written by pdf.js.
  await page.locator('[data-page="3"]').first().waitFor({ state: "attached", timeout: 20_000 });
  await page.waitForTimeout(500);
  await choose("Edit", "Page from File…", "Insert");
  const insert = page.getByRole("dialog", { name: "Open" });
  await insert.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await insert.getByRole("option", { name: OTHER }).dblclick({ timeout: 10_000 });
  await page.locator('[data-page="5"]').first().waitFor({ state: "attached", timeout: 20_000 });
  await settled();
  await shot(page, path.join(out, "preview-tools-inserted.png"));
  const words = [];
  for (let number = 1; number <= 5; number += 1) words.push(await textOf(number));
  step(
    "the pages go in after the page shown, with their text",
    JSON.stringify(words) === JSON.stringify(["One", "Two", "Three", "Alpha", "Beta"]),
    JSON.stringify(words),
  );
  step(
    "the old file's link stays in the file written",
    await until(async () => {
      await textOf(1);
      return preview.getByRole("button", { name: "Link to https://example.com/" }).isVisible();
    }, 5_000),
  );
  const entries = await drive();
  const same = entries.filter((each) => each.name === NAME);
  step(
    "the PDF as it was is in the Trash, and the new one in its folder",
    same.filter((each) => each.trashed_ms !== undefined).length === 1 &&
      same.filter((each) => each.trashed_ms === undefined).length === 1,
    JSON.stringify(same.map((each) => each.trashed_ms !== undefined)),
  );

  // A picture: an elliptical crop.
  await choose("File", "Open…");
  await openDialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await openDialog.getByRole("option", { name: PICTURE }).dblclick({ timeout: 10_000 });
  await titled(PICTURE);
  await settled();
  await page.waitForTimeout(400);
  const pixel = (u, v) =>
    page.evaluate(
      ([u, v]) => {
        const canvas = document.querySelector(".mac-preview-app-page-canvas");
        const at = canvas
          .getContext("2d")
          .getImageData(Math.floor(canvas.width * u), Math.floor(canvas.height * v), 1, 1).data;
        return [...at];
      },
      [u, v],
    );
  const dragAcross = async (from, to, through = []) => {
    const box = await page.locator(".mac-preview-app-page-marks").first().boundingBox();
    const at = ([u, v]) => [box.x + box.width * u, box.y + box.height * v];
    await page.mouse.move(...at(from));
    await page.mouse.down();
    for (const point of [...through, to]) await page.mouse.move(...at(point), { steps: 6 });
    await page.mouse.up();
  };
  await choose("Tools", "Elliptical Selection");
  await dragAcross([0.25, 0.25], [0.75, 0.75]);
  await shot(page, path.join(out, "preview-tools-ellipse.png"));
  await choose("Tools", "Crop");
  step("an elliptical crop marks the picture edited", await titled("Edited"), await title());
  const inside = await until(async () =>
    (await pixel(0.5, 0.5))[3] === 255 ? pixel(0.5, 0.5) : false,
  );
  const corner = await until(async () =>
    (await pixel(0.02, 0.02))[3] === 0 ? pixel(0.02, 0.02) : false,
  );
  step(
    "an elliptical crop keeps the oval and clears its corners",
    Boolean(inside) && Boolean(corner),
    `${inside} ${corner}`,
  );
  await shot(page, path.join(out, "preview-tools-ellipse-cropped.png"));
  await preview.getByRole("document").focus();
  await page.keyboard.press("Control+z");
  await until(async () => !(await title()).includes("Edited"));

  // Adjust Color.
  await choose("Tools", "Adjust Color…");
  const before = await until(async () => {
    const now = await pixel(0.5, 0.5);
    return now[0] === 128 ? now : false;
  });
  const exposure = page.getByRole("slider", { name: "Exposure" });
  await exposure.focus();
  for (let press = 0; press < 25; press += 1) await page.keyboard.press("ArrowRight");
  const brighter = await until(async () => {
    const now = await pixel(0.5, 0.5);
    return now[0] > 150 ? now : false;
  });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "preview-tools-adjust-color.png"));
  step(
    "Adjust Color's Exposure changes the picture's pixels",
    Boolean(before) && Boolean(brighter),
    `${before} to ${brighter}`,
  );
  await page.getByRole("button", { name: "Reset All" }).click();
  step(
    "Reset All gives them back",
    await until(async () => (await pixel(0.5, 0.5))[0] === 128),
    String(await pixel(0.5, 0.5)),
  );
  await preview
    .getByRole("button", { name: "Close" })
    .last()
    .click()
    .catch(() => {});

  // Adjust Size, saved and read back.
  await choose("Tools", "Adjust Size…");
  const sheet = page.getByRole("dialog", { name: "Image Dimensions" });
  await sheet.getByRole("textbox", { name: "Width" }).fill("200");
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "preview-tools-adjust-size.png"));
  await sheet.getByRole("button", { name: "OK" }).click();
  await preview.getByRole("document").focus();
  await page.keyboard.press("Control+s");
  await until(async () =>
    (await preview.locator(".mac-preview-app-status").innerText()).includes("Saved"),
  );
  await page.keyboard.press("Control+i");
  step(
    "a picture saved at another size is that size",
    await until(() => page.getByText("200 × 150 pixels").first().isVisible()),
  );
  await page.keyboard.press("Control+i");

  // A star, as the server keeps it.
  const bar = page.getByRole("toolbar", { name: "Markup" });
  if (!(await bar.isVisible())) {
    await preview.getByRole("button", { name: "Show Markup Toolbar" }).click();
  }
  await bar.getByRole("button", { name: "Shapes" }).click();
  await page.getByRole("menuitem", { name: "Star", exact: true }).click();
  await dragAcross([0.2, 0.2], [0.8, 0.8]);
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "preview-tools-star.png"));
  const saved = (await drive()).find(
    (each) => each.name === PICTURE && each.trashed_ms === undefined,
  );
  const star = await until(async () => {
    const stored = (await api(page, "GET", `/api/preview/markup/${saved.id}`)).json.markup;
    return stored?.pages?.[0]?.items?.[0];
  }, 10_000);
  step(
    "the server keeps a star",
    star?.kind === "sketch" && star?.points?.length === 11,
    JSON.stringify(star?.kind),
  );
  await preview.getByRole("button", { name: "Show Markup Toolbar" }).click();

  // The title's pop-over.
  const renamed = `Renamed ${RUN}.png`;
  await preview.locator(".mac-title-bar").first().hover();
  await preview.getByRole("button", { name: "Title Menu" }).click();
  const field = page.getByRole("textbox", { name: "Name" });
  await field.waitFor({ state: "visible", timeout: 5_000 });
  await shot(page, path.join(out, "preview-tools-title.png"));
  await field.fill(renamed);
  await field.press("Enter");
  step("the title's pop-over renames the file", await titled(renamed), await title());
  step(
    "the drive has the new name",
    (await drive()).some((each) => each.name === renamed),
  );

  // A file from the computer.
  const dropped = `Dropped ${RUN}.png`;
  await page.evaluate(async (dropped) => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 30;
    canvas.getContext("2d").fillRect(0, 0, 40, 30);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const data = new DataTransfer();
    data.items.add(new File([blob], dropped, { type: "image/png" }));
    document
      .querySelector(".mac-preview-body")
      .dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }),
      );
  }, dropped);
  const discard = page.getByRole("button", { name: "Don’t Save" });
  if (await until(() => discard.isVisible(), 1_500)) await discard.click();
  step("a file dropped from the computer opens", await titled(dropped), await title());
  step(
    "and is on the drive, in Pictures",
    (await drive()).some((each) => each.name === dropped && each.parent === "pictures"),
  );

  // Preferences.
  await choose("Preview", "Preferences…");
  const preferences = page
    .getByRole("dialog", { name: "Preview Preferences" })
    .or(page.locator(".mac-window", { hasText: "Window background" }));
  step("Preferences… opens its window", await until(() => preferences.first().isVisible()));
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "preview-tools-preferences.png"));
});
