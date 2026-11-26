#!/usr/bin/env node
// Preview's page layouts on the desktop served by `ferrite dev`: View's Single Page, Two Pages and
// Contact Sheet with a real five-page PDF; Next steps by what is shown; a page chosen on the contact
// sheet opens in the layout left; the layout survives a reload. Exits 0 only with every step passed
// and no console or HTTP error. It deletes only what it made.
//
//   node e2e/preview-display-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("preview-display");
const RUN = Date.now().toString(36);
const LIBRARY = "/api/app-store/library";
const PLACES = "/api/preview/places";
const NAME = `Pages ${RUN}.pdf`;

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
  await page
    .getByRole("menuitemradio", { name: item, exact: true })
    .or(page.getByRole("menuitem", { name: item, exact: true }))
    .first()
    .click();
  await page.waitForTimeout(500);
};
const shownPages = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".mac-preview-app-pages [data-page]")].map((leaf) =>
      Number(leaf.dataset.page),
    ),
  );
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

async function launch(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Preview");
  await field.press("Enter");
  await previewWindow(page).waitFor({ state: "visible", timeout: 15_000 });
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const made = await upload(page, NAME, makePdf(["One", "Two", "Three", "Four", "Five"]));
  const library = await api(page, "GET", LIBRARY);
  const installed = library.json.installed ?? [];
  if (!installed.includes("preview")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...installed, "preview"],
      rev: library.json.rev,
    });
  }
  await reloadDesktop(page);
  // The list of places answers late, after a document has been chosen: the Open sheet stays shut.
  let slowPlaces = true;
  await page.route(`**${PLACES}*`, async (route) => {
    if (slowPlaces && route.request().method() === "GET") {
      slowPlaces = false;
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    await route.continue();
  });
  await launch(page);
  const dialog = page.getByRole("dialog", { name: "Open" });
  if (!(await dialog.isVisible().catch(() => false))) {
    await previewWindow(page).getByRole("button", { name: "Open…" }).first().click();
  }
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await dialog.getByRole("option", { name: NAME }).dblclick({ timeout: 10_000 });
  await page.locator('[data-page="5"]').first().waitFor({ state: "attached", timeout: 20_000 });
  step("a PDF opens as a continuous scroll", same(await shownPages(page), [1, 2, 3, 4, 5]));
  await page.waitForTimeout(3_500);
  step(
    "the list of places answering late leaves the Open sheet shut",
    !(await dialog.isVisible().catch(() => false)),
  );

  // Print… lays every page out on a hidden page for the browser's print dialog.
  await page.getByRole("menuitem", { name: "File", exact: true }).first().click();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "preview-print-row.png"));
  await page.getByRole("menuitem", { name: "Print…", exact: true }).click();
  const printed = await until(() =>
    page.evaluate(() => {
      const frame = document.querySelector('iframe[aria-hidden="true"]');
      const images = [...(frame?.contentDocument?.images ?? [])];
      return images.length === 5 && images.every((image) => image.naturalWidth > 0);
    }),
  );
  step("Print… lays out every page, drawn, for the print dialog", printed === true);
  await page.waitForTimeout(1_200);

  await menu(page, "View", "Single Page");
  step("Single Page shows the one page", same(await shownPages(page), [1]));
  await menu(page, "Go", "Next");
  step("Next goes to page 2 alone", same(await shownPages(page), [2]));
  const leaf = await page.locator('[data-page="2"]').first().boundingBox();
  const area = await page.locator(".mac-preview-app-canvas").first().boundingBox();
  step(
    "the single page fits the window whole",
    leaf.height <= area.height && leaf.y >= area.y,
    `${Math.round(leaf.height)} in ${Math.round(area.height)}`,
  );

  await menu(page, "View", "Two Pages");
  step("Two Pages shows the pair holding the page", same(await shownPages(page), [1, 2]));
  await page
    .locator('[data-page="2"] .mac-preview-app-page-canvas')
    .first()
    .evaluate((canvas) => canvas.width > 0);
  await page.waitForTimeout(600);
  const left = await page.locator('[data-page="1"]').first().boundingBox();
  const right = await page.locator('[data-page="2"]').first().boundingBox();
  step("the pair stands side by side", left.x + left.width <= right.x && left.y === right.y);
  await shot(page, path.join(out, "preview-two-pages.png"));
  await menu(page, "Go", "Next");
  step("Next goes by a pair", same(await shownPages(page), [3, 4]));
  await menu(page, "Go", "Next");
  step("the last odd page stands alone", same(await shownPages(page), [5]));

  await menu(page, "View", "Contact Sheet");
  const tiles = page.locator(".mac-preview-app-contact");
  step("Contact Sheet has a tile per page", (await tiles.count()) === 5);
  const sheet = await tiles.first().locator(".mac-preview-app-thumbnail-page").boundingBox();
  step(
    "a tile keeps the page's shape",
    Math.abs(sheet.width / sheet.height - 612 / 792) < 0.02,
    `${Math.round(sheet.width)} x ${Math.round(sheet.height)}`,
  );
  await page.waitForTimeout(800);
  await shot(page, path.join(out, "preview-contact.png"));
  await tiles.nth(2).click();
  await page.waitForTimeout(500);
  step("choosing a tile shows it in the layout left", same(await shownPages(page), [3, 4]));

  const kept = await until(
    async () =>
      (await api(page, "GET", PLACES)).json.places?.find((each) => each.name === NAME)?.display ===
      "two",
  );
  step("the server keeps the layout with the file's place", kept === true);
  await reloadDesktop(page);
  await launch(page);
  await page.locator('[data-page="3"]').first().waitFor({ state: "attached", timeout: 20_000 });
  step("the layout and page survive a reload", same(await shownPages(page), [3, 4]));

  await menu(page, "View", "Continuous Scroll");
  step("Continuous Scroll shows them all again", same(await shownPages(page), [1, 2, 3, 4, 5]));

  // Going through the pages of a continuous scroll, by the title's page number.
  const titled = async (number) =>
    until(async () =>
      (
        (await previewWindow(page).locator(".mac-title-bar-title-text").first().textContent()) ?? ""
      ).includes(`page ${number} of 5`),
    );
  const row = async (title, item) => {
    await page.getByRole("menuitem", { name: title, exact: true }).first().click();
    const entry = page.getByRole("menuitem", { name: item, exact: true }).first();
    const dimmed = (await entry.getAttribute("aria-disabled")) === "true";
    if (dimmed) await page.keyboard.press("Escape");
    else await entry.click();
    await page.waitForTimeout(400);
    return dimmed;
  };
  step(
    "from page 3 Go > Previous goes to page 2",
    !(await row("Go", "Previous")) && (await titled(2)),
  );
  step("Go > Page Down goes to page 3", !(await row("Go", "Page Down")) && (await titled(3)));
  step("Go > Next goes to page 4", !(await row("Go", "Next")) && (await titled(4)));
  step("Go > Page Up goes to page 3", !(await row("Go", "Page Up")) && (await titled(3)));
  await row("Go", "End");
  await titled(5);
  step("on the last page Next is dimmed", await row("Go", "Next"));
  await row("Go", "Home");
  await titled(1);
  step("on the first page Previous is dimmed", await row("Go", "Previous"));

  // Scrolling across a page boundary, each way: the current page follows, and nothing jumps.
  const scroller = page.locator('.mac-preview-app-canvas [role="document"]').first();
  const scrollBy = async (by) => {
    const before = await scroller.evaluate((element, by) => {
      element.scrollTop += by;
      return element.scrollTop;
    }, by);
    await page.waitForTimeout(400);
    return { before, after: await scroller.evaluate((element) => element.scrollTop) };
  };
  const second = await page.locator('[data-page="2"]').first().boundingBox();
  const area2 = await scroller.boundingBox();
  const down = await scrollBy(second.y - area2.y + 40);
  const followedDown = await titled(2);
  step(
    "scrolling down past a page's top follows it without moving",
    followedDown && down.before === down.after,
    JSON.stringify(down),
  );
  const up = await scrollBy(-80);
  const followedUp = await titled(1);
  step(
    "scrolling back up across it follows without jumping",
    followedUp && up.before === up.after,
    JSON.stringify(up),
  );

  // The window keeps its place a moment after the last move: its save is done before the clean-up
  // below writes the same document.
  await until(
    async () =>
      (await api(page, "GET", PLACES)).json.places?.find((each) => each.name === NAME)?.page === 1,
  );
  await page.waitForTimeout(1_000);

  if (made) {
    await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: made }] });
  }
  const places = await api(page, "GET", PLACES);
  const leftPlaces = (places.json.places ?? []).filter((each) => each.name !== NAME);
  await api(page, "PUT", PLACES, { places: leftPlaces, rev: places.json.rev });
  if (!installed.includes("preview")) {
    const after = await api(page, "GET", LIBRARY);
    await api(page, "PUT", LIBRARY, {
      installed: (after.json.installed ?? []).filter((id) => id !== "preview"),
      rev: after.json.rev,
    });
  }
});
