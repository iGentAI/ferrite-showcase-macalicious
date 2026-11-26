#!/usr/bin/env node
// Books' pictures, TextEdit's nested and merged tables, Terminal's options and Automator's limit, on
// the desktop served by `ferrite dev`: real server, real drive. Each EPUB is written here byte for
// byte, so every offset is checked against its text. What is kept is read back from the server, and
// across a reload.
//
//   node e2e/books-text-batch8-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("books-text-batch8");

const RUN = Date.now().toString(36);
const ALBUM = `Album ${RUN}.epub`;
const ALBUM_TITLE = `Album ${RUN}`;
const PLATES = `Plates ${RUN}.epub`;
const PLATES_TITLE = `Plates ${RUN}`;
const LIBRARY = "/api/app-store/library";

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, check]);
}

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

const epub = (title, items, spine, files) =>
  zip({
    mimetype: "application/epub+zip",
    "META-INF/container.xml": `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    "OEBPS/content.opf": `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:identifier id="id">${title}</dc:identifier></metadata><manifest>${items}</manifest><spine>${spine}</spine></package>`,
    ...files,
  });

const ALBUM_EPUB = epub(
  ALBUM_TITLE,
  `<item id="a" href="art/a.png" media-type="image/png"/><item id="b" href="art/b.png" media-type="image/png"/><item id="c" href="art/c.png" media-type="image/png"/>`,
  `<itemref idref="a"/><itemref idref="b"/><itemref idref="c"/>`,
  {
    "OEBPS/art/a.png": png(500, 900, [200, 60, 40]),
    "OEBPS/art/b.png": png(500, 900, [40, 90, 200]),
    "OEBPS/art/c.png": png(500, 900, [20, 140, 60]),
  },
);
const ALBUM_TEXT = "Picture 1\n\nPicture 2\n\nPicture 3";
const ALBUM_PATHS = ["OEBPS/art/a.png", "OEBPS/art/b.png", "OEBPS/art/c.png"];

const words = (from, count) =>
  Array.from({ length: count }, (_, index) => `word${from + index}`).join(" ");
const LINES = ["Opening words of the book.", "The caption of the plate", words(100, 200)];
const PLATES_TEXT = LINES.join("\n\n");
const PLATES_EPUB = epub(
  PLATES_TITLE,
  `<item id="t" href="t.xhtml" media-type="application/xhtml+xml"/><item id="p" href="art/p.png" media-type="image/png"/>`,
  `<itemref idref="t"/>`,
  {
    "OEBPS/t.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>${LINES[0]}</p><p><img src="art/p.png" alt="${LINES[1]}"/></p><p>${LINES[2]}</p></body></html>`,
    "OEBPS/art/p.png": png(800, 3000, [90, 40, 160]),
  },
);

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
  await upload(ALBUM, ALBUM_EPUB, "application/epub+zip");
  await upload(PLATES, PLATES_EPUB, "application/epub+zip");
  const held = (await api(page, "GET", LIBRARY)).json;
  const wanted = ["books"].filter((each) => !(held.installed ?? []).includes(each));
  if (wanted.length > 0) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), ...wanted],
      rev: held.rev,
    });
  }
  await reloadDesktop(page);

  const bar = page.getByRole("menubar").first();
  const menus = page.getByRole("menu");
  const choose = async (title, name) => {
    await bar.getByRole("menuitem", { name: title, exact: true }).click();
    await menus.first().getByRole("menuitem", { name, exact: true }).first().click();
  };
  const finder = page.locator(".mac-window.mac-finder").first();
  const inFinder = (name) => finder.getByRole("option", { name, exact: true }).first();
  const toDocuments = async (name) => {
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "Finder" })
      .click();
    await finder.waitFor({ timeout: 10_000 });
    await choose("Go", "Documents");
    await inFinder(name).waitFor({ timeout: 15_000 });
  };
  const sheet = () => page.locator(".mac-books-text:not(.mac-books-text-measure)").first();
  const pageState = () =>
    sheet().evaluate((element) => {
      const start = Number(element.dataset.pageStart);
      return {
        start,
        end: element.dataset.pageEnd === undefined ? null : Number(element.dataset.pageEnd),
        text: element.textContent,
        room: element.clientHeight,
        over: element.scrollHeight - element.clientHeight,
        pictures: [...element.querySelectorAll("img[data-book-picture]")].map((image) => {
          const before = document.createRange();
          before.selectNodeContents(element);
          before.setEndBefore(image);
          return {
            path: image.dataset.bookPicture,
            at: start + before.toString().length,
            drawn: image.naturalWidth > 0 && image.complete,
            height: image.getBoundingClientRect().height,
          };
        }),
      };
    });
  const openBook = async (name, opensOn) => {
    await toDocuments(name);
    await inFinder(name).dblclick();
    await sheet().waitFor({ timeout: 20_000 });
    await until(async () => {
      const now = await pageState();
      return now.end !== null && now.text.startsWith(opensOn);
    });
  };
  const nextPage = async (from) => {
    await page.getByRole("button", { name: "Next Page" }).first().click();
    await until(async () => {
      const after = await pageState();
      return after.start > from && after.end !== null;
    });
    return pageState();
  };
  const library = async () => (await api(page, "GET", "/api/books/library")).json.library.books;
  const readingOf = async (title) => {
    const book = (await library()).find((each) => each.title === title);
    const route = `/api/books/reading/${encodeURIComponent(book.id)}`;
    return (await api(page, "GET", route)).json.reading;
  };

  // A book of pictures alone.
  await openBook(ALBUM, "Picture 1");
  const pages = [await pageState()];
  for (let index = 0; index < 5 && (pages.at(-1).end ?? 0) < ALBUM_TEXT.length; index += 1) {
    pages.push(await nextPage(pages.at(-1).start));
  }
  const shown = pages.flatMap((each) => each.pictures);
  step(
    "an EPUB of pictures alone opens, and each picture has a page and an offset of its own",
    pages.length === 3 &&
      JSON.stringify(shown.map((each) => each.path)) === JSON.stringify(ALBUM_PATHS) &&
      JSON.stringify(shown.map((each) => each.at)) === JSON.stringify([0, 11, 22]) &&
      shown.every((each) => each.drawn) &&
      pages.every((each) => each.over <= 1 && each.pictures.length === 1),
    JSON.stringify(pages.map(({ start, end, text, pictures }) => [start, end, text, pictures])),
  );
  await shot(page, path.join(out, "books-batch8-album.png"));
  step(
    "the server keeps that picture's place",
    await until(async () => (await readingOf(ALBUM_TITLE))?.place === 22),
    JSON.stringify(await readingOf(ALBUM_TITLE)),
  );
  await reloadDesktop(page);
  await openBook(ALBUM, "Picture 3");
  const backAtPlace = await pageState();
  step(
    "across a reload the book opens at the third picture",
    backAtPlace.start === 22 && backAtPlace.pictures[0]?.path === ALBUM_PATHS[2],
    JSON.stringify(backAtPlace),
  );

  // A plate that takes the page, offsets as they were.
  await openBook(PLATES, LINES[0]);
  const opening = await pageState();
  step(
    "the words before a full-page plate end their page at its offset",
    opening.start === 0 &&
      opening.end <= PLATES_TEXT.indexOf(LINES[1]) &&
      opening.pictures.length === 0,
    `${opening.start}-${opening.end}`,
  );
  const plate = await nextPage(opening.start);
  const share = plate.pictures[0]?.height / plate.room;
  step(
    "the plate starts its page at its offset and fills it past 70%, with no overflow",
    plate.start === PLATES_TEXT.indexOf(LINES[1]) &&
      plate.pictures[0]?.at === plate.start &&
      plate.pictures[0]?.drawn &&
      share > 0.75 &&
      plate.over <= 1,
    `share ${share}; ${JSON.stringify(plate.pictures)}`,
  );
  step(
    "its page's words are the book's own text from that offset",
    plate.text === PLATES_TEXT.slice(plate.start, plate.end) && plate.end > plate.start,
    `${plate.start}-${plate.end}`,
  );
  await shot(page, path.join(out, "books-batch8-plate.png"));

  // Print: the frame goes once its print ends, which a headless browser reaches at once, so what it
  // was given is read as it arrives, then drawn in a frame of the same sandbox and the page's own
  // Content Security Policy.
  await page.evaluate(() => {
    window.__printed = [];
    new MutationObserver((changes) => {
      for (const change of changes) {
        for (const node of change.addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.__printed.push(node.srcdoc);
        }
      }
    }).observe(document.body, { childList: true });
  });
  await choose("File", "Print…");
  const printed = await until(() =>
    page.evaluate(async () => {
      const srcdoc = window.__printed.at(-1);
      if (!srcdoc) return null;
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-same-origin");
      frame.srcdoc = srcdoc;
      const loaded = new Promise((resolve) => frame.addEventListener("load", resolve));
      document.body.append(frame);
      await loaded;
      const image = frame.contentDocument.querySelector("img");
      const found = {
        src: image?.getAttribute("src").slice(0, 22),
        natural: image?.naturalWidth,
        text: frame.contentDocument.body.textContent,
      };
      frame.remove();
      return found;
    }),
  );
  step(
    "File > Print takes the page's picture with its words",
    printed?.src === "data:image/png;base64," &&
      printed?.natural === 800 &&
      printed?.text === plate.text,
    JSON.stringify(printed),
  );

  // Terminal.
  await launch(page, "Terminal");
  const terminal = page.getByRole("log", { name: "Terminal output" }).first();
  await terminal.waitFor({ state: "visible", timeout: 15_000 });
  await page.getByRole("textbox", { name: "Terminal input" }).first().focus();
  await page.waitForTimeout(500);
  const screenText = () => terminal.innerText();
  const runLine = async (line, shows) => {
    await page.keyboard.type(line);
    await page.keyboard.press("Enter");
    return until(async () => (await screenText()).split(line).at(-1).includes(shows));
  };
  await runLine("cd ~/Documents", "%");
  const SCRIPT = `go${RUN}.sh`;
  await runLine(`echo hi > ${SCRIPT}; chmod 750 ${SCRIPT}; echo made-${RUN}`, `made-${RUN}\n`);
  step(
    "cp -p keeps the mode",
    await runLine(`cp -p ${SCRIPT} kept${SCRIPT}; ls -l kept${SCRIPT}`, "-rwxr-x---"),
  );
  await page.waitForTimeout(1_100);
  await runLine(`cp ${SCRIPT} fresh${SCRIPT}; echo copied-${RUN}`, `copied-${RUN}\n`);
  const dated = (name) =>
    api(page, "GET", "/api/files/").then(
      ({ json }) => json.entries.find((each) => each.name === name)?.modified_ms,
    );
  const [sourceDate, keptDate, freshDate] = await Promise.all(
    [SCRIPT, `kept${SCRIPT}`, `fresh${SCRIPT}`].map(dated),
  );
  step(
    "cp -p keeps the date, read from the server",
    keptDate === sourceDate,
    `${sourceDate} ${keptDate}`,
  );
  step("plain cp dates the copy now", freshDate > sourceDate, `${sourceDate} ${freshDate}`);
  step(
    "ls -l shows the copy's kept mode",
    await until(async () => (await screenText()).includes("-rwxr-x---")),
  );
  step("which says what runs", await runLine("which cd", "cd: shell built-in command"));
  step("which refuses what only refuses", await runLine("which vim", "vim not found"));
  step("/bin/name runs what which names", await runLine(`/bin/echo bin-${RUN}`, `bin-${RUN}`));
  step("ls -n writes numbers for who", await runLine(`ls -n ${SCRIPT}`, "501  20"));
  step("ls -s writes blocks", await runLine(`ls -s ${SCRIPT}`, `1 ${SCRIPT}`));
  step("ls -i is still refused", await runLine("ls -i", "ls: illegal option -- i"));
  await shot(page, path.join(out, "terminal-batch8.png"));
  const driveEntries = async () => (await api(page, "GET", "/api/files/")).json?.entries ?? [];
  step(
    "the copy is on the drive",
    await until(async () => (await driveEntries()).some((each) => each.name === `kept${SCRIPT}`)),
  );

  // Automator's limit, read back from the server.
  const WORKFLOWS = "/api/automator/workflows";
  const stored = (await api(page, "GET", WORKFLOWS)).json;
  const longFlow = (id, steps) => ({
    id,
    name: `Long ${RUN}`,
    kind: "workflow",
    enabled: true,
    steps: Array.from({ length: steps }, () => ({
      action: "calendar.events",
      params: {},
      enabled: true,
    })),
  });
  const others = stored.library?.workflows ?? [];
  const put = (flow, rev) =>
    api(page, "PUT", WORKFLOWS, { library: { workflows: [...others, flow], tz: 0 }, rev });
  expectRefusal(400, WORKFLOWS);
  const over = await put(longFlow(`long-${RUN}`, 33), stored.rev);
  step("the server refuses a workflow of 33 steps", over.status === 400, JSON.stringify(over.json));
  const atLimit = await put(longFlow(`long-${RUN}`, 32), stored.rev);
  const readBack = (await api(page, "GET", WORKFLOWS)).json.library?.workflows ?? [];
  step(
    "and keeps one of 32, read back",
    atLimit.status === 200 &&
      readBack.find((each) => each.id === `long-${RUN}`)?.steps.length === 32,
    `${atLimit.status} ${JSON.stringify(atLimit.json).slice(0, 200)}`,
  );

  // TextEdit: a table in a cell, a merge across rows, and both after a reload.
  await launch(page, "TextEdit");
  const window = page.locator('[data-window-id^="textedit"]').first();
  const text = window.getByRole("textbox", { name: "Document" });
  await text.waitFor({ timeout: 10_000 });
  await text.click();
  const openSheet = async () => {
    await bar.getByRole("menuitem", { name: "Format", exact: true }).click();
    await page.waitForTimeout(300);
    await page
      .getByRole("menuitem", { name: /^Table/ })
      .last()
      .click();
    const made = page.getByRole("dialog", { name: "Table" });
    await made.waitFor();
    return made;
  };
  const making = await openSheet();
  await making.getByLabel("Rows:").fill("3");
  await making.getByLabel("Columns:").fill("3");
  await making.getByRole("button", { name: "OK" }).click();
  await making.waitFor({ state: "detached" });
  for (const word of ["aa", "bb", "cc", "dd", "ee", "ff", "gg", "hh", "ii"]) {
    await page.keyboard.type(word);
    await page.keyboard.press("Tab");
  }
  const outer = text.locator("table").first();
  const grid = () =>
    outer.evaluate((table) =>
      [...table.rows].map((row) =>
        [...row.cells].map(
          (cell) => `${cell.innerText.trim().replace(/\s+/g, " ")}:${cell.colSpan}x${cell.rowSpan}`,
        ),
      ),
    );
  const lastRow = async () => (await grid()).length;
  if ((await lastRow()) > 3) {
    await outer.evaluate((table) => table.rows[table.rows.length - 1].remove());
  }
  const dragBetween = async (from, to) => {
    const start = await from.boundingBox();
    const end = await to.boundingBox();
    await page.mouse.move(start.x + 4, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + 8, end.y + end.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  };
  await dragBetween(
    outer.locator("td").filter({ hasText: "aa" }),
    outer.locator("td").filter({ hasText: "dd" }),
  );
  const merging = await openSheet();
  await merging.getByRole("button", { name: "Merge Cells" }).click();
  await merging.waitFor({ state: "detached" });
  const afterMerge = await grid();
  step(
    "Merge Cells makes two cells of a column one, across their rows",
    afterMerge[0][0] === "aa dd:1x2" && afterMerge[1].length === 2,
    JSON.stringify(afterMerge),
  );
  await shot(page, path.join(out, "textedit-batch8-merge.png"));

  await outer.locator("td").filter({ hasText: "ee" }).click();
  const nesting = await openSheet();
  await nesting.getByRole("button", { name: "Nest Table" }).click();
  await nesting.waitFor({ state: "detached" });
  await page.keyboard.type("deep");
  const inner = outer.locator("table");
  step(
    "Nest Table makes a table in the cell, and the caret goes into its first cell",
    (await inner.count()) === 1 &&
      (await inner.locator("td").first().innerText()).trim() === "deep" &&
      (await inner.locator("tr").count()) === 2,
    await outer.evaluate((table) => table.outerHTML.slice(0, 400)),
  );
  await page.keyboard.press("Tab");
  await page.keyboard.type("next");
  step(
    "Tab goes to the nested table's next cell",
    (await inner.locator("td").nth(1).innerText()).trim() === "next",
  );
  await shot(page, path.join(out, "textedit-batch8-nested.png"));

  const fileName = `Tables ${RUN}.rtf`;
  await page.waitForTimeout(1_800);
  await reloadDesktop(page);
  await launch(page, "TextEdit");
  await text.waitFor({ timeout: 10_000 });
  const kept = await text
    .locator("table")
    .first()
    .evaluate((table) => ({
      first: table.rows[0].cells[0].rowSpan,
      second: table.rows[1].cells.length,
      nested: table.querySelector("table")?.rows[0].cells[0].innerText.trim(),
      next: table.querySelector("table")?.rows[0].cells[1].innerText.trim(),
    }));
  step(
    "the draft keeps both across a reload, read back from the server",
    kept.first === 2 && kept.second === 2 && kept.nested === "deep" && kept.next === "next",
    JSON.stringify(kept),
  );

  // Saved as RTF to the drive: the bytes on the server hold what a Mac reads.
  await choose("File", "Save…");
  const panel = page.getByRole("dialog", { name: "Save" });
  await panel.waitFor();
  const field = panel.getByRole("textbox", { name: "Save As:" });
  await field.click({ clickCount: 3 });
  await page.keyboard.type(fileName);
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await until(async () => {
    const entry = (await driveEntries()).find((each) => each.name === fileName);
    if (!entry) return null;
    return page.evaluate(
      async ({ id, version }) =>
        (
          await fetch(`/api/files/content/${id}?piece=0&count=4&version=${version}`, {
            credentials: "same-origin",
          })
        ).text(),
      { id: entry.id, version: entry.version ?? 0 },
    );
  });
  step(
    "the saved RTF on the drive holds the merge and the nesting",
    typeof saved === "string" &&
      saved.includes("\\clvmgf") &&
      saved.includes("\\clvmrg") &&
      saved.includes("\\nestcell") &&
      saved.includes("deep"),
    typeof saved === "string" ? `${saved.length} bytes` : String(saved),
  );
});
