#!/usr/bin/env node
// Books at depth, as a Guest User with a desktop and data of its own: the reading appearance (font,
// size, four themes, kept in the person's settings across a reload) and the File, Edit, View and
// Controls menus with their keys, then the library's byte limit on a new collection. The browser
// says it is a Mac, so that Command is the Meta key and the keys that name Control as well can be
// typed. It deletes nothing: everything it changes belongs to the guest it signs in as. Exits 0
// only when every step passed with no console error, page error or failed request.
//
//   node e2e/books-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("books-depth", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const BOOK = "pg-84";
const LIBRARY = "/api/books/library";
const READING = `/api/books/reading/${BOOK}`;
const SETTINGS = "/api/system-preferences/settings";
const SLOW = 60_000;
const NOTE = `Depth note ${Date.now().toString(36)}`;

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
async function choose(page, title, ...items) {
  await menuBar(page, title).click();
  await page.waitForTimeout(200);
  for (const [index, item] of items.entries()) {
    const entry = page
      .getByRole("menuitem", { name: item })
      .or(page.getByRole("menuitemradio", { name: item }))
      .first();
    if (index < items.length - 1) {
      await entry.hover();
      await page.waitForTimeout(250);
    } else await entry.click();
  }
  await page.waitForTimeout(300);
}
/** Whether a menu row can be chosen, closing the menu again. */
async function rowDimmed(page, title, item) {
  await menuBar(page, title).click();
  await page.waitForTimeout(200);
  const dimmed = await page
    .getByRole("menuitem", { name: item })
    .first()
    .getAttribute("aria-disabled");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  return dimmed === "true";
}
async function settled(read, test) {
  let value;
  for (let i = 0; i < 40; i++) {
    value = await read();
    if (test(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return value;
}

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  await openDesktop(page, base, step);
  const library = async () => (await api(page, "GET", LIBRARY)).json;
  const reading = async () => (await api(page, "GET", READING)).json.reading;
  const settings = async () => (await api(page, "GET", SETTINGS)).json.values ?? {};

  // Books comes from the App Store, for this guest.
  await launch(page, "App Store");
  const appStore = page.getByRole("region", { name: "App Store" }).first();
  await appStore.waitFor({ state: "visible", timeout: 15_000 });
  await appStore.getByRole("button", { name: "Get, Books" }).click();
  await appStore.getByRole("button", { name: "Install, Books" }).click();
  await appStore.getByRole("button", { name: "Open, Books" }).waitFor({ timeout: 15_000 });
  await appStore.getByRole("button", { name: "Open, Books" }).click();
  const window = page.getByRole("region", { name: "Books", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".mac-books:not([aria-busy])").waitFor({ timeout: 15_000 });

  await window.getByRole("button", { name: "Book Store", exact: true }).click();
  await window.getByRole("searchbox").fill("frankenstein shelley");
  const found = window
    .getByRole("region", { name: "Project Gutenberg", exact: true })
    .locator(`.mac-books-store-item[data-book="${BOOK}"]`)
    .first();
  await found.waitFor({ timeout: SLOW });
  const title = ((await found.locator(".mac-books-store-title").textContent()) ?? "").trim();
  await found.getByRole("button", { name: /^Get / }).click();
  await found.getByRole("button", { name: /^Read / }).waitFor({ timeout: 5_000 });
  await window.getByRole("searchbox").fill("");
  await window.getByRole("button", { name: "Library", exact: true }).click();

  const cover = window.locator(`[data-book="${BOOK}"]`).first();
  await cover.waitFor({ timeout: 10_000 });
  step(
    "File > Open Book is dimmed until a cover is chosen",
    await rowDimmed(page, "File", "Open Book"),
  );
  await cover.click();
  await choose(page, "File", "Open Book");
  const reader = page.getByRole("region", { name: title, exact: true }).first();
  await reader.waitFor({ state: "visible", timeout: 10_000 });
  const text = reader.getByRole("document", { name: /^Page \d+/ }).first();
  await text.waitFor({ timeout: SLOW });
  step("File > Open Book opens the chosen cover", await text.isVisible());
  const body = reader.locator(".mac-books-text-body");
  const look = () =>
    body.evaluate((element) => {
      const page = element.querySelector('[role="document"]');
      const style = getComputedStyle(page);
      return {
        paper: getComputedStyle(element).backgroundColor,
        ink: style.color,
        size: style.fontSize,
        family: style.fontFamily,
        end: Number(page.getAttribute("data-page-end")),
        start: Number(page.getAttribute("data-page-start")),
      };
    });

  // The themes, the face and the size, from the Aa button.
  const usual = await look();
  await reader.getByRole("button", { name: "Appearance" }).click();
  for (const [name, paper, ink] of [
    ["White", "rgb(255, 255, 255)", "rgb(29, 29, 31)"],
    ["Gray", "rgb(74, 74, 76)", "rgb(227, 227, 227)"],
    ["Night", "rgb(0, 0, 0)", "rgb(180, 180, 180)"],
    ["Sepia", "rgb(248, 241, 227)", "rgb(91, 70, 54)"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(150);
    const now = await look();
    step(`the ${name} theme colours the page`, now.paper === paper && now.ink === ink, now.paper);
    await shot(page, path.join(out, `books-theme-${name.toLowerCase()}.png`));
  }
  await page.getByRole("button", { name: "Georgia", exact: true }).click();
  await page.waitForTimeout(200);
  const georgia = await look();
  step("a face sets the page's font", georgia.family.startsWith("Georgia"), georgia.family);
  await page.getByRole("button", { name: "Larger Text" }).click();
  await page.getByRole("button", { name: "Larger Text" }).click();
  await page.waitForTimeout(300);
  const larger = await look();
  step(
    "Larger Text enlarges the text, and the page holds less from the same start",
    larger.size === "21px" &&
      larger.start === usual.start &&
      larger.end - larger.start < usual.end - usual.start,
    `${usual.size} ${usual.end - usual.start} chars -> ${larger.size} ${larger.end - larger.start} chars`,
  );
  await shot(page, path.join(out, "books-appearance-popover.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Saved per person: read back from the server, then after a reload.
  const kept = await settled(
    settings,
    (values) => values["books.theme"] === "sepia" && values["books.textSize"] === 21,
  );
  step(
    "the settings store holds the theme, the face and the size",
    kept["books.theme"] === "sepia" &&
      kept["books.textFace"] === "georgia" &&
      kept["books.textSize"] === 21,
    JSON.stringify(kept),
  );
  await reloadDesktop(page);
  await launch(page, "Books");
  await page.locator(".mac-books:not([aria-busy])").waitFor({ timeout: 15_000 });
  await cover.dblclick();
  await text.waitFor({ timeout: SLOW });
  const after = await look();
  step(
    "after a reload the book opens in the same theme, face and size",
    after.paper === "rgb(248, 241, 227)" &&
      after.family.startsWith("Georgia") &&
      after.size === "21px",
    JSON.stringify(after),
  );
  await shot(page, path.join(out, "books-appearance-after-reload.png"));

  // The menus as they stand, each with its rows and keys.
  async function menuShot(title, name, submenu) {
    await menuBar(page, title).click();
    await page.waitForTimeout(250);
    if (submenu) {
      await page.getByRole("menuitem", { name: submenu }).first().hover();
      await page.waitForTimeout(350);
    }
    await shot(page, path.join(out, name));
    await page.keyboard.press("Escape");
    if (submenu) await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  // View's zoom, by menu and by key.
  await menuShot("View", "books-menu-view.png");
  await menuShot("Controls", "books-menu-controls.png");
  await choose(page, "View", "Zoom In");
  step("View > Zoom In enlarges the text", (await look()).size === "24px");
  await page.keyboard.press("Meta+Minus");
  await page.waitForTimeout(200);
  step("Command-Minus makes it smaller", (await look()).size === "21px");
  await page.keyboard.press("Meta+Equal");
  await page.waitForTimeout(200);
  step("Command-Equals makes it larger", (await look()).size === "24px");
  await choose(page, "View", "Zoom Out");
  step("View > Zoom Out makes it smaller", (await look()).size === "21px");
  await page.keyboard.press("Meta+0");
  await page.waitForTimeout(200);
  step("Command-0 gives the usual size", (await look()).size === "17px");
  await choose(page, "View", "Zoom In");
  await choose(page, "View", "Actual Size");
  step("View > Actual Size gives the usual size", (await look()).size === "17px");

  // Controls.
  const toc = (await api(page, "GET", `/api/books/text/${BOOK}`)).json.toc;
  const place = async () => (await look()).start;
  await choose(page, "Controls", "Next Chapter");
  const chapter = await place();
  step(
    "Controls > Next Chapter opens at the next heading",
    toc.some((heading) => heading.at === chapter) && chapter > usual.start,
    `${chapter}`,
  );
  await choose(page, "Controls", "Next Chapter");
  const second = await place();
  await choose(page, "Controls", "Previous Chapter");
  step(
    "Controls > Previous Chapter goes back a heading",
    second > chapter && (await place()) === chapter,
  );
  await page.keyboard.press("Meta+d");
  const marked = await settled(reading, (each) => each?.bookmarks?.length === 1);
  step("Command-D adds a bookmark", marked?.bookmarks?.[0]?.at === chapter);
  await shot(page, path.join(out, "books-controls-bookmark.png"));
  await choose(page, "Controls", "Next Page");
  await choose(page, "Controls", "Next Page");
  const on = await place();
  step("Controls > Next Page turns on", on > chapter);
  await choose(page, "Controls", "Previous Bookmark");
  step("Controls > Previous Bookmark goes to it", (await place()) === chapter);
  await choose(page, "Controls", "Previous Page");
  const before = await place();
  await choose(page, "Controls", "Next Bookmark");
  step(
    "Controls > Next Bookmark goes to it",
    before < chapter && (await place()) === chapter,
    `${before} -> ${chapter}`,
  );
  await choose(page, "Controls", "Remove Bookmark");
  const unmarked = await settled(reading, (each) => each?.bookmarks?.length === 0);
  step("Controls > Remove Bookmark removes it", unmarked?.bookmarks?.length === 0);
  await page.keyboard.press("Meta+d");
  await settled(reading, (each) => each?.bookmarks?.length === 1);
  await page.keyboard.press("Meta+d");
  const toggled = await settled(reading, (each) => each?.bookmarks?.length === 0);
  step("Command-D on a marked page removes the bookmark", toggled?.bookmarks?.length === 0);

  await choose(page, "Controls", "Table of Contents");
  const beginning = page.getByRole("menuitem", { name: "Beginning" });
  await beginning.waitFor({ state: "visible", timeout: 5_000 });
  step("Controls > Table of Contents opens the book's contents", await beginning.isVisible());
  await shot(page, path.join(out, "books-table-of-contents.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await choose(page, "Controls", "Go to Page");
  const pageNumber = page.getByRole("textbox", { name: "Page number" });
  await pageNumber.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "books-go-to-page.png"));
  await pageNumber.fill("5");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const label = (await text.getAttribute("aria-label")) ?? "";
  step("Controls > Go to Page opens that page", label.startsWith("Page 5 of"), label);

  // Edit, on the page.
  async function dragWords() {
    const box = await text.boundingBox();
    await page.mouse.move(box.x + 2, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 240, box.y + 60, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    return page.evaluate(() => document.getSelection()?.toString() ?? "");
  }
  await page.keyboard.press("Escape");
  // Undo is not among them: the bookmark set above can be undone.
  const dimmedRows = {
    Redo: await rowDimmed(page, "Edit", "Redo"),
    Cut: await rowDimmed(page, "Edit", "Cut"),
    Paste: await rowDimmed(page, "Edit", "Paste"),
  };
  step(
    "Edit > Redo, Cut and Paste are dimmed: the page cannot be changed",
    Object.values(dimmedRows).every(Boolean),
    JSON.stringify(dimmedRows),
  );
  step(
    "Edit > Add Highlight is dimmed with nothing selected",
    await rowDimmed(page, "Edit", "Add Highlight"),
  );
  const words = await dragWords();
  step("a drag selects words on the page", words.trim().length > 5, words);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await menuShot("Edit", "books-menu-edit.png");
  await choose(page, "Edit", "Copy");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  step("Edit > Copy copies the selected words", copied === words, JSON.stringify(copied));
  await page.keyboard.press("Meta+Control+h");
  const highlighted = await settled(reading, (each) => each?.highlights?.length === 1);
  step(
    "Control-Command-H highlights the selection",
    highlighted?.highlights?.[0]?.color === "yellow" &&
      (await text.locator("mark.mac-books-highlight").count()) === 1,
    JSON.stringify(highlighted?.highlights?.[0]?.text),
  );
  await shot(page, path.join(out, "books-highlight-by-key.png"));
  await choose(page, "Controls", "Next Page");
  await dragWords();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await choose(page, "Edit", "Add Highlight");
  const byMenu = await settled(reading, (each) => each?.highlights?.length === 2);
  step("Edit > Add Highlight highlights the selection", byMenu?.highlights?.length === 2);
  await choose(page, "Controls", "Next Page");
  await dragWords();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await choose(page, "Edit", "Add Note");
  const noteField = page.getByRole("textbox", { name: "Note" });
  await noteField.waitFor({ timeout: 5_000 });
  await noteField.fill(NOTE);
  await shot(page, path.join(out, "books-add-note-menu.png"));
  await page.getByRole("button", { name: "Done" }).click();
  const noted = await settled(reading, (each) => each?.highlights?.some((h) => h.note === NOTE));
  step(
    "Edit > Add Note makes a highlight with its note",
    noted?.highlights?.some((h) => h.note === NOTE) === true,
  );
  await choose(page, "Controls", "Next Page");
  await dragWords();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.keyboard.press("Meta+Control+n");
  await noteField.waitFor({ timeout: 5_000 });
  const unfinished = `${NOTE} left open`;
  await noteField.fill(unfinished);
  await menuBar(page, "Edit").click();
  await page.waitForTimeout(200);
  step("the note stays open under a menu, for Edit's rows to act on", await noteField.isVisible());
  await page.getByRole("menuitem", { name: "Select All", exact: true }).first().click();
  await page.waitForTimeout(250);
  step(
    "Edit > Select All selects the words of the note",
    await noteField.evaluate(
      (field) => field.selectionStart === 0 && field.selectionEnd === field.value.length,
    ),
  );
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await choose(page, "Edit", "Copy");
  await noteField.evaluate((field) =>
    field.setSelectionRange(field.value.length, field.value.length),
  );
  await choose(page, "Edit", "Paste");
  await page.waitForTimeout(250);
  step(
    "Edit > Copy and Paste put the note's words after themselves",
    (await noteField.inputValue()) === `${unfinished}${unfinished}`,
    await noteField.inputValue(),
  );
  await noteField.fill(unfinished);
  await text.click({ position: { x: 4, y: 4 } });
  const keptNote = await settled(reading, (each) =>
    each?.highlights?.some((h) => h.note === unfinished),
  );
  step(
    "a note left open is kept when a press elsewhere closes it",
    keptNote?.highlights?.some((h) => h.note === unfinished) === true,
  );
  const fourth = await settled(reading, (each) => each?.highlights?.length === 4);
  step(
    "Control-Command-N makes a highlight and asks for its note",
    fourth?.highlights?.length === 4,
  );

  await choose(page, "Edit", "Select All");
  const pageWords = await text.evaluate((element) => element.textContent);
  step(
    "Edit > Select All selects the page",
    (await page.evaluate(() => document.getSelection()?.toString())) === pageWords,
  );
  await page.evaluate(() => document.getSelection()?.removeAllRanges());
  await text.click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("Meta+a");
  await page.waitForTimeout(150);
  const byCommandA = await page.evaluate(() => document.getSelection()?.toString());
  step(
    "Command-A selects the page and no more",
    byCommandA === pageWords,
    `${byCommandA?.length} of ${pageWords?.length}, focus on ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))}`,
  );
  await page.evaluate(() => document.getSelection()?.removeAllRanges());

  await page.keyboard.press("Meta+f");
  const search = page.getByRole("searchbox", { name: "Search in the book" });
  await search.waitFor({ timeout: 5_000 });
  await search.fill("Geneva");
  await page.keyboard.press("Enter");
  const results = page.getByRole("list", { name: "Results" });
  await results.waitFor({ timeout: SLOW });
  step(
    "Command-F opens the search in the book, which finds words",
    (await results.getByRole("listitem").count()) > 2,
  );
  await shot(page, path.join(out, "books-find.png"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await choose(page, "Edit", "Find");
  await search.waitFor({ timeout: 5_000 });
  step("Edit > Find opens the search too", await search.isVisible());

  // A field of the reader stays under a menu: Edit acts on it.
  await search.fill("whale");
  await menuBar(page, "Edit").click();
  await page.waitForTimeout(200);
  step("the search in the book stays open under a menu", await search.isVisible());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await choose(page, "Edit", "Select All");
  await choose(page, "Edit", "Cut");
  await page.waitForTimeout(250);
  step("Edit > Cut takes the search's words", (await search.inputValue()) === "");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  // The library in front of an open book: the Edit menu is the library's.
  await window.getByText("Collections", { exact: true }).click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(200);
  await choose(page, "Edit", "Find");
  await page.waitForTimeout(250);
  step(
    "Edit > Find with the library in front of a book goes to the library's search field",
    (await reader.count()) === 1 &&
      (await window.getByRole("searchbox").evaluate((field) => document.activeElement === field)),
  );
  const sheet = await text.boundingBox();
  await page.mouse.click(sheet.x + sheet.width - 8, sheet.y + sheet.height - 8);
  await page.waitForTimeout(250);

  // Back to the library from the key, and into the book again.
  await page.keyboard.press("Meta+Shift+l");
  await page.waitForTimeout(300);
  step("Shift-Command-L goes back to the library", (await reader.count()) === 0);
  await cover.dblclick();
  await text.waitFor({ timeout: SLOW });

  // Speech: headless Chromium speaks to nobody, so the text handed to the browser is what is read.
  await page.evaluate(() => {
    window.__spoken = [];
    speechSynthesis.speak = (utterance) => window.__spoken.push(utterance.text);
  });
  await choose(page, "Edit", "Speech", "Start Speaking");
  const spoken = await page.evaluate(() => window.__spoken);
  step("Edit > Speech > Start Speaking hands the browser the page", spoken[0] === pageWords);
  await choose(page, "Edit", "Speech", "Stop Speaking");

  // Look Up one word: double-clicked, as a person does.
  const box = await text.boundingBox();
  await page.mouse.dblclick(box.x + 40, box.y + 60);
  await page.waitForTimeout(250);
  const oneWord = await page.evaluate(() => document.getSelection()?.toString().trim() ?? "");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await choose(page, "Edit", "Look Up");
  const dictionary = page.getByRole("region", { name: "Dictionary" }).first();
  await dictionary.waitFor({ state: "visible", timeout: 10_000 });
  step("Edit > Look Up opens the Dictionary", await dictionary.isVisible(), oneWord);
  await shot(page, path.join(out, "books-look-up.png"));
  await dictionary.getByRole("button", { name: "Close" }).first().click();
  await page.waitForTimeout(300);
  await choose(page, "Controls", "Show Library");
  step("Controls > Show Library goes back to the library", (await reader.count()) === 0);

  // The library's File and View menus.
  const collections = async () => (await library()).library?.collections ?? [];
  await choose(page, "File", "New Collection");
  const made = await settled(collections, (each) => each.length === 1);
  step("File > New Collection makes one, and saves it", made[0]?.name === "Untitled Collection");
  await page.keyboard.press("Meta+Shift+n");
  const two = await settled(collections, (each) => each.length === 2);
  step("Shift-Command-N makes another", two[1]?.name === "Untitled Collection 2");
  await menuShot("File", "books-menu-file.png");
  await window.getByRole("treeitem", { name: /^All Books/ }).click();
  const sidebar = window.getByRole("tree", { name: "Library" });
  await choose(page, "View", "Hide Sidebar");
  step("View > Hide Sidebar hides it", (await sidebar.count()) === 0);
  await shot(page, path.join(out, "books-hide-sidebar.png"));
  await page.keyboard.press("Meta+Control+s");
  await page.waitForTimeout(200);
  step("Control-Command-S shows it again", await sidebar.isVisible());
  await menuShot("View", "books-menu-view-sort.png", "Sort By");
  for (const [name, id] of [
    ["Title", "title"],
    ["Author", "author"],
    ["Manually", "manual"],
    ["Most Recent", "recent"],
  ]) {
    await choose(page, "View", "Sort By", name);
    const sorted = await settled(library, (each) => each.library?.sort === id);
    step(`View > Sort By > ${name} is saved`, sorted.library?.sort === id);
  }
  await page.keyboard.press("Meta+f");
  await page.waitForTimeout(150);
  step(
    "Command-F in the library goes to its search field",
    await window.getByRole("searchbox").evaluate((field) => document.activeElement === field),
  );
  await choose(page, "Edit", "Find");
  await page.waitForTimeout(250);
  step(
    "Edit > Find in the library goes to its search field",
    await window.getByRole("searchbox").evaluate((field) => document.activeElement === field),
  );

  // The byte limit on a collection: this guest's library, grown with made-up books to 40 bytes
  // short of what the module keeps, which refuses a larger library with a 400.
  const current = await library();
  const grown = { ...current.library, books: [...current.library.books] };
  const size = () => Buffer.byteLength(JSON.stringify(grown));
  const madeUp = (n, title, author) => ({
    id: `pg-${900_000 + n}`,
    title,
    author,
    source: "gutenberg",
    added: 1,
  });
  let count = 0;
  while (size() < 198_000) {
    grown.books.push(madeUp(count++, "t".repeat(300), "a".repeat(300)));
  }
  const LEAVE = 200_000 - 40;
  while (LEAVE - size() > 90) {
    const title = "t".repeat(Math.min(300, Math.max(1, LEAVE - size() - 90)));
    grown.books.push(madeUp(count++, title, ""));
  }
  grown.books.at(-1).author = "a".repeat(LEAVE - size());
  const seeded = await api(page, "PUT", LIBRARY, { library: grown, rev: current.rev });
  step("the module keeps a library just under its limit", seeded.status === 200, `${size()} bytes`);
  await reloadDesktop(page);
  await launch(page, "Books");
  await page.locator(".mac-books:not([aria-busy])").waitFor({ timeout: 15_000 });
  const saves = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === LIBRARY)
      saves.push(request.url());
  });
  await window.getByRole("button", { name: "New Collection" }).click();
  const alert = window.getByRole("alert");
  await alert.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(1_500);
  const afterAdd = await library();
  step(
    "a collection past the limit is refused in the window, with nothing sent",
    (await alert.textContent()) ===
      "Your library is full: remove a book or a collection to add another." &&
      saves.length === 0 &&
      afterAdd.library.collections.length === grown.collections.length,
    `${saves.length} saves, ${afterAdd.library.collections.length} collections`,
  );
  await shot(page, path.join(out, "books-library-full-collection.png"));
});
