#!/usr/bin/env node
// Batch 6 of the desktop's open rows, on the desktop served by `ferrite dev`: an EPUB's pictures in
// Books' reader, Finder's Open With for Preview, and a Photo Booth picture as a contact's picture.
// Real server, real drive, Chromium's fake camera. The EPUB is written here, byte for byte, with the
// exact text the reader must show, so every offset is checked against that text. Everything kept is
// read back from the server.
//
//   node e2e/books-pictures-batch6-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("books-pictures-batch6", {
  launchOptions: {
    chromium: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  contextOptions: { chromium: { permissions: ["camera", "microphone"] } },
});

const RUN = Date.now().toString(36);
const BOOK = `Harbour ${RUN}.epub`;
const TITLE = `The Harbour ${RUN}`;
const PNG_NAME = `Quay ${RUN}.png`;
const PDF_NAME = `Tides ${RUN}.pdf`;
const LIBRARY = "/api/app-store/library";
const CARD = "batch6-ada";

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, check]);
}

/** A PNG of one colour. */
function png(width, height, [red, green, blue]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) row.set([red, green, blue], 1 + x * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A ZIP of `files`, stored, as the reader's own tests make. */
function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const raw = Buffer.from(data);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(raw.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc32(raw), 16);
    entry.writeUInt32LE(raw.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    parts.push(local, nameBytes, raw);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + raw.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

const words = (from, count) =>
  Array.from({ length: count }, (_, index) => `word${from + index}`).join(" ");
const filler = (from) =>
  Array.from({ length: 30 }, (_, index) => `<p>${words(from + index * 40, 40)}</p>`).join("");
const fillerLines = (from) =>
  Array.from({ length: 30 }, (_, index) => words(from + index * 40, 40));

const CHAPTER_ONE = `<html xmlns="http://www.w3.org/1999/xhtml"><body>
<h1>Chapter One</h1>
<p><img src="../art/cover.png" alt="The cover art"/></p>
${filler(1000)}
</body></html>`;
const CHAPTER_TWO = `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink"><body>
<h1>Chapter Two</h1>
<p>Before the mark <img src="../art/ornament.png" alt=""/> and after the mark.</p>
${filler(3000)}
<p><img src="../art/plate.png" alt="A plate of the harbour"/></p>
<p><img src="https://example.invalid/outside.png" alt="Far away"/></p>
<div><svg xmlns="http://www.w3.org/2000/svg"><image xlink:href="../art/plan.png"/></svg></div>
${filler(5000)}
</body></html>`;
const TEXT = [
  "Chapter One",
  "The cover art",
  ...fillerLines(1000),
  "Chapter Two",
  "Before the mark and after the mark.",
  ...fillerLines(3000),
  "A plate of the harbour",
  "Far away",
  ...fillerLines(5000),
].join("\n\n");

const EPUB = zip({
  mimetype: "application/epub+zip",
  "META-INF/container.xml": `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  "OEBPS/content.opf": `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${TITLE}</dc:title><dc:creator>Ada Writer</dc:creator><dc:identifier id="id">${RUN}</dc:identifier></metadata><manifest><item id="a" href="Text/a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="Text/b.xhtml" media-type="application/xhtml+xml"/><item id="c" href="art/cover.png" media-type="image/png"/><item id="d" href="art/plate.png" media-type="image/png"/><item id="e" href="art/ornament.png" media-type="image/png"/><item id="f" href="art/plan.png" media-type="image/png"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`,
  "OEBPS/Text/a.xhtml": CHAPTER_ONE,
  "OEBPS/Text/b.xhtml": CHAPTER_TWO,
  "OEBPS/art/cover.png": png(300, 400, [200, 60, 40]),
  "OEBPS/art/plate.png": png(500, 300, [40, 90, 200]),
  "OEBPS/art/ornament.png": png(24, 16, [20, 140, 60]),
  "OEBPS/art/plan.png": png(200, 200, [230, 180, 30]),
});
const COVER = "OEBPS/art/cover.png";
const PLATE = "OEBPS/art/plate.png";
const ORNAMENT = "OEBPS/art/ornament.png";
const PLAN = "OEBPS/art/plan.png";

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
  page.setDefaultTimeout(20_000);
  const outside = [];
  page.on("request", (request) => {
    if (request.url().includes("example.invalid")) outside.push(request.url());
  });
  await openDesktop(page, base, step);

  const upload = (name, bytes, type) =>
    page.evaluate(
      async ({ name, data, type }) => {
        const blob = new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type });
        const json = { "content-type": "application/json" };
        const uploading = await fetch("/api/files/uploads", {
          method: "POST",
          credentials: "same-origin",
          headers: json,
          body: JSON.stringify({
            parent: "documents",
            name,
            size: blob.size,
            type,
            existing: "fail",
          }),
        }).then((response) => response.json());
        await fetch(`/api/files/uploads/${uploading.upload}/0`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await blob.arrayBuffer(),
        });
        await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
          method: "POST",
          credentials: "same-origin",
          headers: json,
          body: "{}",
        });
      },
      { name, data: Buffer.from(bytes).toString("base64"), type },
    );
  await upload(BOOK, EPUB, "application/epub+zip");
  await upload(PNG_NAME, png(120, 90, [90, 90, 200]), "image/png");
  await upload(
    PDF_NAME,
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
    "application/pdf",
  );
  const held = (await api(page, "GET", LIBRARY)).json;
  const wanted = ["books", "preview", "photo-booth"].filter(
    (each) => !(held.installed ?? []).includes(each),
  );
  if (wanted.length > 0) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), ...wanted],
      rev: held.rev,
    });
  }
  const stored = (await api(page, "GET", "/api/contacts/cards")).json;
  await api(page, "PUT", "/api/contacts/cards", {
    cards: [...(stored.cards ?? []), { id: CARD, account: "mac", first: "Ada", last: "Lovelace" }],
    rev: stored.rev,
  });
  await reloadDesktop(page);

  const bar = page.getByRole("menubar").first();
  const menus = page.getByRole("menu");
  const choose = async (title, name, role = "menuitem") => {
    await bar.getByRole("menuitem", { name: title, exact: true }).click();
    await menus.first().getByRole(role, { name, exact: true }).first().click();
  };
  const launch = async (name) => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill(name);
    await page.waitForTimeout(400);
    await field.press("Enter");
  };
  const finder = page.locator(".mac-window.mac-finder").first();
  const inFinder = (name) => finder.getByRole("option", { name, exact: true }).first();
  const toDocuments = async () => {
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "Finder" })
      .click();
    await finder.waitFor({ timeout: 10_000 });
    await choose("Go", "Documents");
    await inFinder(BOOK).waitFor({ timeout: 15_000 });
  };

  // Preview under Finder's Open With.
  await toDocuments();
  const openWithRows = async (name) => {
    await inFinder(name).click();
    await bar.getByRole("menuitem", { name: "File", exact: true }).click();
    await menus.first().getByRole("menuitem", { name: "Open With" }).hover();
    await until(async () => (await menus.count()) > 1);
    return (await menus.last().getByRole("menuitem").allInnerTexts()).map((each) => each.trim());
  };
  const forPdf = await openWithRows(PDF_NAME);
  step(
    "Open With for a PDF lists Preview first, and Books",
    forPdf[0]?.startsWith("Preview") && forPdf.includes("Books"),
    forPdf.join(", "),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await until(async () => (await menus.count()) === 0, 3_000);
  const forPicture = await openWithRows(PNG_NAME);
  step(
    "Open With for a picture lists Preview",
    forPicture.some((row) => row.startsWith("Preview")),
    forPicture.join(", "),
  );
  await menus
    .last()
    .getByRole("menuitem", { name: /^Preview/ })
    .first()
    .click();
  const preview = page.locator('[data-window-id^="preview"]').filter({ hasText: PNG_NAME });
  step(
    "and opens the picture in Preview",
    await preview
      .first()
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await preview.first().getByRole("button", { name: "Close" }).first().click();

  // The book, opened from Finder.
  await toDocuments();
  const openBook = async () => {
    await inFinder(BOOK).dblclick();
    await sheet().waitFor({ timeout: 20_000 });
    await until(async () => (await pageState()).end !== null);
  };
  const sheet = () => page.locator(".mac-books-text:not(.mac-books-text-measure)").first();
  const pageState = () =>
    sheet().evaluate((element) => {
      const texts = element.textContent;
      const start = Number(element.dataset.pageStart);
      return {
        start,
        end: element.dataset.pageEnd === undefined ? null : Number(element.dataset.pageEnd),
        text: texts,
        over: element.scrollHeight - element.clientHeight,
        pictures: [...element.querySelectorAll("img[data-book-picture]")].map((image) => {
          const before = document.createRange();
          before.selectNodeContents(element);
          before.setEndBefore(image);
          const box = image.getBoundingClientRect();
          return {
            path: image.dataset.bookPicture,
            at: start + before.toString().length,
            drawn: image.naturalWidth > 0 && image.complete,
            width: box.width,
            height: box.height,
          };
        }),
      };
    });
  await openBook();
  const first = await pageState();
  step(
    "the first page holds the cover, drawn from the EPUB, at the offset of its alt text",
    first.start === 0 &&
      first.pictures.some(
        (picture) =>
          picture.path === COVER &&
          picture.drawn &&
          picture.at === TEXT.indexOf("The cover art") &&
          picture.height > 100,
      ),
    JSON.stringify(first.pictures),
  );
  step(
    "the page's words are exactly the book's text from its offset",
    first.text === TEXT.slice(first.start, first.end),
    `${first.start}-${first.end}`,
  );
  await shot(page, path.join(out, "books-pictures-cover.png"));

  // Every page, turned forward: no picture lost, none repeated, nothing clipped, no offset moved.
  const seen = [];
  const pages = [];
  for (let index = 0; index < 200; index += 1) {
    const now = await pageState();
    pages.push(now);
    seen.push(...now.pictures);
    if (now.end >= TEXT.length) break;
    await page.getByRole("button", { name: "Next Page" }).first().click();
    const turned = await until(async () => {
      const after = await pageState();
      return after.start > now.start && after.end !== null;
    });
    if (!turned) break;
  }
  const expected = {
    [COVER]: TEXT.indexOf("The cover art"),
    [ORNAMENT]: TEXT.indexOf("and after the mark."),
    [PLATE]: TEXT.indexOf("A plate of the harbour"),
    [PLAN]: TEXT.indexOf("word5000"),
  };
  step(
    "turning every page shows each of the four pictures once, at its offset, and only those in the archive",
    seen.length === 4 && seen.every((each) => each.drawn && expected[each.path] === each.at),
    JSON.stringify(seen),
  );
  step(
    "no page overflows, and every page's words are the book's own text",
    pages.every((each) => each.over <= 1 && each.text === TEXT.slice(each.start, each.end)),
    `${pages.length} pages`,
  );
  step(
    "the picture at an outside address was never asked for",
    outside.length === 0,
    outside.join(" "),
  );
  const ornament = seen.find((each) => each.path === ORNAMENT);
  step(
    "a small picture sits in its line at its own size",
    ornament?.width === 24 && ornament?.height === 16,
    JSON.stringify(ornament),
  );

  const books = (await api(page, "GET", "/api/books/library")).json.library.books;
  const book = books.find((each) => each.title === TITLE);
  const READING = `/api/books/reading/${encodeURIComponent(book.id)}`;
  const reading = async () => (await api(page, "GET", READING)).json.reading;

  // The plate's page again, by Search: the result, the place kept and the words at it agree.
  const searchFor = async (word) => {
    await page.getByRole("button", { name: "Search", exact: true }).last().click();
    const field = page.getByRole("searchbox", { name: "Search in the book" });
    await field.fill(word);
    await field.press("Enter");
    await page.getByRole("list", { name: "Results" }).getByRole("button").first().click();
  };
  await searchFor("A plate of the harbour");
  const atPlate = TEXT.indexOf("A plate of the harbour");
  step(
    "Search opens the plate's page at its text's offset, and the server keeps that place",
    await until(
      async () => (await reading())?.place === atPlate && (await pageState()).start === atPlate,
    ),
    `${(await reading())?.place} and ${atPlate}`,
  );
  const plateShown = await pageState();
  step(
    "the plate is on that page, above its alt text, with words after it",
    plateShown.pictures[0]?.path === PLATE &&
      plateShown.pictures[0]?.at === atPlate &&
      plateShown.end > atPlate + "A plate of the harbour".length,
    JSON.stringify(plateShown.pictures),
  );
  await shot(page, path.join(out, "books-pictures-plate.png"));

  // A highlight across a picture: its offsets name the same words.
  await sheet().evaluate((element) => {
    const image = element.querySelector("img[data-book-picture]");
    const after = image.nextSibling.firstChild;
    const words = "A plate of the harbour".length;
    const range = document.createRange();
    range.setStart(after, 0);
    range.setEnd(after, words);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const spot = await sheet().evaluate((element) => {
    const rect = document.getSelection().getRangeAt(0).getBoundingClientRect();
    return { x: rect.left + 20, y: rect.top + rect.height / 2, ok: element.isConnected };
  });
  await page.mouse.click(spot.x, spot.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Add Highlight" }).click();
  step(
    "a highlight beside a picture is kept at the text's own offsets",
    await until(async () => {
      const made = (await reading())?.highlights?.[0];
      return (
        made?.start === atPlate &&
        made?.end === atPlate + 22 &&
        made?.text === "A plate of the harbour"
      );
    }),
    JSON.stringify((await reading())?.highlights),
  );

  // The other two layouts.
  const layout = async (name) => {
    await bar.getByRole("menuitem", { name: "View", exact: true }).click();
    await menus
      .first()
      .getByRole("menuitemradio", { name: new RegExp(`^${name}`) })
      .click();
    await until(async () => (await pageState()).end !== null);
  };
  await layout("Two Pages");
  const twoPages = await pageState();
  const roomOf = await sheet().evaluate((element) => element.clientWidth);
  step(
    "Two Pages shows the plate within one column, and nothing overflows across",
    twoPages.pictures[0]?.path === PLATE &&
      twoPages.pictures[0]?.drawn &&
      twoPages.pictures[0]?.width <= roomOf / 2 &&
      (await sheet().evaluate((element) => element.scrollWidth - element.clientWidth)) <= 1,
    JSON.stringify(twoPages.pictures),
  );
  await shot(page, path.join(out, "books-pictures-two-pages.png"));
  await layout("Scroll");
  const scrolled = await pageState();
  step(
    "Scroll shows the plate, drawn, at the same offset",
    scrolled.pictures.some((each) => each.path === PLATE && each.drawn && each.at === atPlate) &&
      scrolled.text === TEXT.slice(scrolled.start, scrolled.end),
    JSON.stringify(scrolled.pictures),
  );
  await shot(page, path.join(out, "books-pictures-scroll.png"));
  await layout("Single Page");
  await until(async () => (await pageState()).pictures.length > 0);

  // A reload: the same place, the same picture, read from the drive again.
  await until(async () => (await reading())?.place === atPlate);
  await reloadDesktop(page);
  await toDocuments();
  await openBook();
  const again = await pageState();
  step(
    "across a reload the book opens at that place with the plate and its highlight",
    again.start === atPlate &&
      again.pictures[0]?.path === PLATE &&
      again.pictures[0]?.drawn &&
      (await sheet().locator("mark").first().innerText()) === "A plate of the harbour",
    `${again.start}; ${JSON.stringify(again.pictures)}`,
  );

  // Photo Booth: a picture as a contact's picture, with Contacts open.
  await launch("Contacts");
  const contacts = page.locator('.mac-contacts[aria-label="Contacts"]').first();
  const adaRow = contacts.getByRole("listbox").getByRole("option", { name: /Ada Lovelace/ });
  await adaRow.first().click({ timeout: 20_000 });
  await launch("Photo Booth");
  const booth = page.locator('[data-window-id^="photo-booth"]').first();
  const take = booth.getByRole("button", { name: "Take Photo" });
  await booth.getByRole("button", { name: "Normal", exact: true }).click();
  await take.waitFor({ timeout: 15_000 });
  await until(() => take.isEnabled());
  await take.click({ modifiers: ["Alt"] });
  const thumb = booth.getByRole("list", { name: "Photos" }).getByRole("button").last();
  await thumb.waitFor({ timeout: 30_000 });
  await thumb.click();
  await booth.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("menuitem", { name: "Set Contact Picture…" }).click();
  const alert = page.getByRole("alertdialog").filter({ hasText: "Set Contact Picture" });
  await alert.waitFor({ timeout: 10_000 });
  await shot(page, path.join(out, "photo-booth-contact-alert.png"));
  await alert
    .getByRole("combobox", { name: "Contact" })
    .or(alert.getByRole("button", { name: "Contact" }))
    .first()
    .click();
  await page
    .getByRole("option", { name: "Ada Lovelace" })
    .or(page.getByRole("menuitemradio", { name: "Ada Lovelace" }))
    .first()
    .click();
  await alert.getByRole("button", { name: "Set Picture" }).click();
  const cardOnServer = async () =>
    (await api(page, "GET", "/api/contacts/cards")).json.cards.find((each) => each.id === CARD);
  step(
    "the card names a picture on the server",
    await until(async () => Boolean((await cardOnServer())?.image)),
  );
  const pictureKept = async () =>
    (await api(page, "GET", `/api/contacts/pictures?ids=${CARD}`)).json;
  const storedPicture = await pictureKept();
  const raw = JSON.stringify(storedPicture);
  step(
    "and the server keeps it as a JPEG under that version",
    raw.includes("data:image/jpeg;base64,") &&
      raw.includes((await cardOnServer())?.image ?? "missing"),
    raw.slice(0, 120),
  );
  const pictureShown = () =>
    until(async () => (await contacts.locator(".mac-contacts-picture-image").count()) > 0);
  step("the open Contacts window shows it", await pictureShown());
  await shot(page, path.join(out, "contacts-photo-booth-picture.png"));
  await reloadDesktop(page);
  step("across a reload the card still names it", Boolean((await cardOnServer())?.image));
  await launch("Contacts");
  await adaRow.first().click({ timeout: 20_000 });
  step("and Contacts shows it", await pictureShown());
});
