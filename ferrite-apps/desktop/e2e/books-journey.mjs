#!/usr/bin/env node
// Books on Ferrite: real public-domain books, kept per person.
//
// In one browser a new account gets Books from the App Store (its Get and
// Install buttons), searches the real Book Store (Project Gutenberg), Gets
// Alice's Adventures in Wonderland, opens it from the library and turns its
// real pages, adds a bookmark and a highlight with a note, reloads, and finds
// the place, the bookmark and the highlight where it left them. A second
// browser as a Guest User (another person) gets Books too and sees none of it
// in its own Books window. A third browser signed in to the same account opens
// the book at the same words, with the same bookmark and note. Exits 0 only
// when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error, apart from the allowances below. It removes
// what it wrote at the end.
//
// The `books` egress handle must reach https://www.gutenberg.org/ and
// https://standardebooks.org/:
//
//   node scripts/pack-site.mjs && ferrite dev --egress allow   # in ferrite-apps/desktop
//   node e2e/books-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                              [--browser chromium|chrome|firefox|webkit]
//
// Allowed, and logged, and nothing else:
// - a cover picture the source does not have: HTTP 404 from the source, and the
//   browser's console line for it (the window shows the placeholder);
// - Project Gutenberg not answering once (its connections time out now and
//   then): a 502 from /api/books/store or /api/books/text for a Gutenberg
//   shelf, search or book, whose error says the source could not be reached or
//   did not answer in time, which the window asks again, and which the same
//   page then answers with a 2xx for the same address (the steps that follow
//   check that its window shows what it asked for). A second 502 for it, a 502
//   that is never followed by a 2xx on that page, any 504, another source's 502
//   or a 502 with another reason is a failure.

import path from "node:path";
import { launch, options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const run = Date.now().toString(36);
const password = `pages-${run}-turn`;
const person = { name: `reader-${run}`, fullName: "Reader" };
const BOOK = "pg-11";
/** The book's title as the store lists it (read from the store before it is used). */
let title = "Alice's Adventures in Wonderland";
const NOTE = `Keep this line ${run}`;
const LIBRARY = "/api/books/library";
const READING = `/api/books/reading/${BOOK}`;
const APP_STORE = "/api/app-store/library";
/** The first fetch of a book from its source can take a few seconds. */
const SLOW = 45_000;

const problems = [];
const steps = [];
const notes = [];
const step = (label, ok, detail = "") => {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};
const note = (text) => {
  notes.push(text);
  console.log(`note ${text}`);
};

const sameOrigin = (url) => {
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
};
const isCover = (url) =>
  /^https:\/\/(www\.gutenberg\.org|standardebooks\.org)\/.*\.(jpe?g|png)$/i.test(url);

/** Whether a request of the page asks Books for something from Project Gutenberg. */
function asksGutenberg(url) {
  if (!sameOrigin(url)) return false;
  const { pathname, searchParams } = new URL(url);
  if (pathname.startsWith("/api/books/text/pg-")) return true;
  if (pathname !== "/api/books/store") return false;
  return searchParams.has("q")
    ? searchParams.get("source") === "gutenberg"
    : (searchParams.get("shelf") ?? "popular") === "popular";
}
/** The errors of a source that did not answer (`fetch_failure` in the Books module). */
const NO_ANSWER = /^the source (could not be reached|did not answer in time)/;

/**
 * Every reply of every page, in the order they arrived; a page's last 2xx for an address, by
 * that order, keyed by the page's label and the address.
 */
let sequence = 0;
const lastSuccess = new Map();
/** The requests answered 502, by page and address: when, and whether the 502 is allowed. */
const retried = new Map();
/** The browser's console lines for a 502, checked against `retried` at the end. */
const badGatewayLines = [];
/** Checks that read a reply's body, settled before a browser closes and at the end. */
const checks = [];
const interrupted = new WeakSet();
const inFlight = new Map();

function interrupt(page) {
  for (const request of inFlight.get(page) ?? []) interrupted.add(request);
}

async function closeContext(context) {
  for (const page of context.pages()) interrupt(page);
  await context.close();
}

const settle = () => Promise.allSettled(checks.splice(0));

/** Whether a 502 (`entry`) is the one allowed: a Gutenberg request that did not answer. */
async function badGateway(entry, response) {
  const url = response.url();
  const error = await response
    .json()
    .then((body) => (typeof body?.error === "string" ? body.error : ""))
    .catch(() => "");
  if (!asksGutenberg(url) || !NO_ANSWER.test(error)) {
    problems.push(`${entry.label} HTTP 502 ${entry.pathname}: ${error || "no reason given"}`);
    return;
  }
  entry.allowed = true;
  note(`${entry.label}: ${entry.pathname} answered 502 once (${error}); the window asks again`);
}

function watch(page, label) {
  const active = new Set();
  inFlight.set(page, active);
  page.on("request", (request) => active.add(request));
  page.on("requestfinished", (request) => active.delete(request));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const where = message.location()?.url ?? "";
    // The browser's line for a cover the source does not have: the window shows the placeholder.
    if (isCover(where) && /status of 404/.test(message.text())) {
      return note(`${label}: no cover at ${where}`);
    }
    // The browser's line for a 502: allowed only if that reply was (checked at the end).
    if (/status of 502/.test(message.text()) && sameOrigin(where)) {
      badGatewayLines.push({ label, where, text: message.text() });
      return;
    }
    problems.push(`${label} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const text = request.failure()?.errorText ?? "";
    active.delete(request);
    if (interrupted.has(request) && /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(text)) return;
    problems.push(`${label} request failed: ${request.url()} ${text}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    const key = `${label} ${url}`;
    sequence += 1;
    if (status >= 200 && status < 300) {
      lastSuccess.set(key, sequence);
      return;
    }
    if (status < 400) return;
    if (status === 404 && !sameOrigin(url) && isCover(url)) {
      return note(`${label}: cover ${status} ${url}`);
    }
    const pathname = new URL(url).pathname;
    if (status === 502) {
      if (retried.has(key)) {
        problems.push(`${label} HTTP 502 ${pathname} again`);
        return;
      }
      const entry = { label, pathname, seq: sequence, allowed: false };
      retried.set(key, entry);
      checks.push(badGateway(entry, response));
      return;
    }
    problems.push(`${label} HTTP ${status} ${pathname}`);
  });
}

/** The allowances that can only be judged once every reply has arrived. */
function judgeRetries() {
  for (const [key, { label, pathname, seq, allowed }] of retried) {
    if (allowed && !((lastSuccess.get(key) ?? 0) > seq)) {
      problems.push(`${label} HTTP 502 ${pathname} was not answered with a 2xx on the retry`);
    }
  }
  // A 502 not allowed is a problem already; a line for no 502 the page saw is one now.
  for (const { label, where, text } of badGatewayLines) {
    if (!retried.has(`${label} ${where}`)) problems.push(`${label} console: ${text} (${where})`);
  }
}

/** `fetch` from inside the page, with the browser's own cookie. */
function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, json: await response.json().catch(() => null) };
    },
    { method, url, body },
  );
}

/** The next PUT to `url` (a path) whose body passes `accept`, and its answer. */
const nextSave = (page, url, accept) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === url &&
      accept(JSON.parse(response.request().postData() ?? "null")),
    { timeout: 15_000 },
  );

const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();
const userTile = (page, name) =>
  page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });

async function desktopShown(page) {
  await finder(page).waitFor({ timeout: 20_000 });
  return finder(page).isVisible();
}

async function createAccount(page) {
  await userTile(page, "Create Account…").click();
  const form = page.getByRole("form", { name: "Create Account" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Full Name:").fill(person.fullName);
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(password);
  await form.getByLabel("Verify:").fill(password);
  await form.getByRole("button", { name: "Create Account" }).click();
}

async function signIn(page) {
  await userTile(page, "Other…").click();
  const form = page.getByRole("form", { name: "Log In" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(password);
  await form.getByRole("button", { name: "Log In" }).click();
}

async function reload(page) {
  interrupt(page);
  await page.reload({ waitUntil: "load" });
  await desktopShown(page);
}

/**
 * Get Books with the App Store's own Get and Install buttons, as a person does, and answer
 * whether the install was saved and the server holds it.
 */
async function getBooksFromTheStore(page) {
  await launch(page, "App Store");
  const store = page.getByRole("region", { name: "App Store" }).first();
  await store.waitFor({ state: "visible", timeout: 10_000 });
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 10_000 });
  await store.getByRole("button", { name: "Get, Books" }).click();
  const saved = nextSave(page, APP_STORE, (body) => body?.installed?.includes("books"));
  await store.getByRole("button", { name: "Install, Books" }).click();
  const status = (await saved).status();
  await store.getByRole("button", { name: "Open, Books" }).waitFor({ timeout: 10_000 });
  const stored = await api(page, "GET", APP_STORE);
  return status === 200 && (stored.json?.installed ?? []).includes("books");
}

/** Open Books from Spotlight and wait until its library has loaded. */
async function openBooks(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Books");
  await field.press("Enter");
  const window = page.getByRole("region", { name: "Books", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    {
      timeout: 15_000,
    },
  );
  return window;
}

const readerOf = (page) => page.getByRole("region", { name: title, exact: true }).first();
const pageText = (reader) => reader.getByRole("document", { name: /^Page \d+/ }).first();

/** Double-click the book's cover in the library and wait for a page of its text. */
async function openBook(page, window) {
  // The toolbar's search field filters the library too: empty it, as a person would.
  const search = window.getByRole("searchbox");
  if ((await search.inputValue()) !== "") await search.fill("");
  await window.getByRole("button", { name: "Library", exact: true }).click();
  const name = new RegExp(`^${title.replace(/[^A-Za-z0-9 ]/g, ".")}, `);
  await window.getByRole("button", { name }).first().dblclick();
  const reader = readerOf(page);
  await reader.waitFor({ state: "visible", timeout: 15_000 });
  await pageText(reader).waitFor({ timeout: SLOW });
  return reader;
}

/** What the page shows: where it starts, its label and its first words. */
async function shown(reader) {
  const text = pageText(reader);
  return {
    start: Number(await text.getAttribute("data-page-start")),
    label: await text.getAttribute("aria-label"),
    words: ((await text.textContent()) ?? "").slice(0, 80),
  };
}

/** Select some words of the first line of the page, as a drag of the pointer does. */
async function selectWords(page, reader) {
  const text = pageText(reader);
  const box = await text.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 2, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(box.x + Math.min(240, box.width - 4), box.y + 12, { steps: 8 });
    await page.mouse.up();
  }
  const menu = page.getByRole("button", { name: "Add Note" });
  await menu.waitFor({ timeout: 5_000 });
  return "a pointer drag";
}

console.log(`books in ${browserName} against ${base}`);
const browser = await ENGINES[browserName].launch();
const contextOptions = { viewport: { width: 1440, height: 900 } };
let cleanup = null;
try {
  // The reader, in a browser of their own, with an account of their own.
  const contextA = await browser.newContext(contextOptions);
  const page = await contextA.newPage();
  watch(page, "reader");
  await page.goto(`${base}/`, { waitUntil: "load" });
  await userTile(page, "Create Account…").waitFor({ timeout: 20_000 });
  await createAccount(page);
  step("a new account opens its desktop", await desktopShown(page));
  cleanup = page;

  // Books does not come with the desktop: get it from the App Store.
  step(
    "Books is got with the App Store's Get and Install, and kept",
    await getBooksFromTheStore(page),
  );
  await reload(page);

  let window = await openBooks(page);
  step(
    "Books opens with an empty library",
    (await window.getByRole("status").first().textContent())?.includes("No Books") ?? false,
  );

  // The real Book Store: Project Gutenberg's most downloaded books, then a search.
  await window.getByRole("button", { name: "Book Store", exact: true }).click();
  const popular = window.getByRole("region", { name: "Popular at Project Gutenberg" });
  await popular.getByRole("button", { name: /^Get / }).first().waitFor({ timeout: SLOW });
  step(
    "the Book Store lists Project Gutenberg's popular books",
    (await popular.getByRole("button", { name: /^(Get|Read) / }).count()) >= 10,
  );
  await window.getByRole("searchbox").fill("alice wonderland carroll");
  // The search's own shelf (Alice is on the popular shelf too, which the search replaces).
  const results = window.getByRole("region", { name: "Project Gutenberg", exact: true });
  const found = results.locator(`.mac-books-store-item[data-book="${BOOK}"]`).first();
  await found.waitFor({ timeout: SLOW });
  step("searching the store finds Alice's Adventures in Wonderland", await found.isVisible());
  title = ((await found.locator(".mac-books-store-title").textContent()) ?? "").trim() || title;
  const kept = nextSave(page, LIBRARY, (body) => body?.library?.books?.some((b) => b.id === BOOK));
  await found.getByRole("button", { name: /^Get / }).click();
  step("Get keeps the book in the person's library", (await kept).status() === 200);
  await found.getByRole("button", { name: /^Read / }).waitFor({ timeout: 5_000 });

  // Open it from the library and turn its real pages.
  let reader = await openBook(page, window);
  const first = await shown(reader);
  // Alice's opening plate takes the first page, with the text's own "[Illustration]" under it.
  const plate = await reader
    .locator("img[data-book-picture]")
    .first()
    .waitFor({ state: "attached", timeout: SLOW })
    .then(
      () => true,
      () => false,
    );
  step(
    "the book opens at the start of its text, on its plate, with its credit and licence",
    plate &&
      first.words.trim() === "[Illustration]" &&
      /Project Gutenberg/.test((await reader.textContent()) ?? "") &&
      /Public domain/i.test((await reader.textContent()) ?? ""),
    `${first.label}: ${JSON.stringify(first.words)}`,
  );
  let turned = first;
  for (const _ of [1, 2]) {
    const before = turned;
    await reader.getByRole("button", { name: "Next Page" }).click();
    await page.waitForFunction(
      ({ element, start }) => Number(element.getAttribute("data-page-start")) > start,
      { element: await pageText(reader).elementHandle(), start: before.start },
      { timeout: SLOW },
    );
    turned = await shown(reader);
  }
  step(
    "Next Page turns to the following text, twice",
    turned.start > first.start && turned.words !== first.words,
    `${first.label} -> ${turned.label}`,
  );
  const placed = await api(page, "GET", READING);
  // The place is saved as the page is turned (the save may still be on its way).
  if (placed.json?.reading?.place !== turned.start) {
    await nextSave(page, READING, (body) => body?.reading?.place === turned.start).catch(
      () => null,
    );
  }

  // A bookmark on this page.
  const marked = nextSave(page, READING, (body) => body?.reading?.bookmarks?.length === 1);
  await reader.getByRole("button", { name: "Bookmarks" }).click();
  await page.getByRole("menuitem", { name: "Add Bookmark" }).click();
  step("Add Bookmark is saved", (await marked).status() === 200);

  // A highlight with a note, made from words selected on the page.
  const how = await selectWords(page, reader);
  note(`the words were selected by ${how}`);
  await page.getByRole("button", { name: "Add Note" }).click();
  const noted = nextSave(page, READING, (body) =>
    body?.reading?.highlights?.some((h) => h.note === NOTE),
  );
  await page.getByRole("textbox", { name: "Note" }).fill(NOTE);
  await page.getByRole("button", { name: "Done" }).click();
  step("the highlight and its note are saved", (await noted).status() === 200);
  step(
    "the highlight shows on the page",
    (await pageText(reader).locator("mark.mac-books-highlight").count()) > 0,
  );

  const stored = await api(page, "GET", READING);
  const reading = stored.json?.reading;
  step(
    "the server holds the place, the bookmark and the highlight",
    reading?.place === turned.start &&
      reading?.bookmarks?.[0]?.at === turned.start &&
      reading?.highlights?.[0]?.note === NOTE,
    `place ${reading?.place}, rev ${stored.json?.rev}`,
  );

  // After a reload, all of it is where it was left.
  await reload(page);
  window = await openBooks(page);
  reader = await openBook(page, window);
  const again = await shown(reader);
  step(
    "after a reload, the book opens at the page it was left at",
    again.start === turned.start && again.words === turned.words,
    `${again.label}: ${JSON.stringify(again.words)}`,
  );
  step(
    "after a reload, the page's bookmark and highlight are there",
    (await reader.getByRole("button", { name: "Bookmarks" }).getAttribute("data-marked")) !==
      null && (await pageText(reader).locator("mark.mac-books-highlight").count()) > 0,
  );
  await reader.getByRole("button", { name: "Notes" }).click();
  step("Notes lists the highlight with its note", await page.getByText(NOTE).first().isVisible());
  await page.keyboard.press("Escape");
  await shot(page, path.join(out, `books-${browserName}.png`));

  // Another person, in another browser: none of it.
  const contextB = await browser.newContext(contextOptions);
  const other = await contextB.newPage();
  watch(other, "guest");
  await other.goto(`${base}/`, { waitUntil: "load" });
  await userTile(other, "Guest User").click();
  step("a Guest User opens a desktop of its own", await desktopShown(other));
  // In its own Books window: an empty library, and no book open.
  step("the guest gets Books from the App Store too", await getBooksFromTheStore(other));
  await reload(other);
  const guestBooks = await openBooks(other);
  const guestCovers = guestBooks.getByRole("button", { name: /^Alice.s Adventures/ });
  step(
    "another person's Books window shows an empty library, without the book or a reader",
    ((await guestBooks.getByRole("status").first().textContent())?.includes("No Books") ?? false) &&
      (await guestCovers.count()) === 0 &&
      (await other.getByRole("region", { name: title, exact: true }).count()) === 0 &&
      (await other.getByText(NOTE).count()) === 0,
  );
  const theirs = await api(other, "GET", READING);
  const theirLibrary = await api(other, "GET", LIBRARY);
  step(
    "another person sees neither the book, nor the place, bookmark or note",
    theirs.status === 200 &&
      theirs.json?.reading === null &&
      !(theirLibrary.json?.library?.books ?? []).some((b) => b.id === BOOK),
  );
  const shared = await api(other, "GET", `/api/books/text/${BOOK}`);
  step(
    "the book's text, fetched once, is there for everyone",
    shared.status === 200 && shared.json?.parts?.length > 0,
    `${shared.json?.parts?.length} part(s)`,
  );
  await api(other, "DELETE", APP_STORE);
  await settle();
  await closeContext(contextB);

  // The same person, in a third browser: the same words, bookmark and note.
  const contextC = await browser.newContext(contextOptions);
  const elsewhere = await contextC.newPage();
  watch(elsewhere, "same reader elsewhere");
  await elsewhere.goto(`${base}/`, { waitUntil: "load" });
  await userTile(elsewhere, "Other…").waitFor({ timeout: 20_000 });
  await signIn(elsewhere);
  step("the same account signs in from another browser", await desktopShown(elsewhere));
  const windowC = await openBooks(elsewhere);
  const readerC = await openBook(elsewhere, windowC);
  const there = await shown(readerC);
  step(
    "in another browser, the book opens at the same words",
    there.start === turned.start && there.words === turned.words,
    `${there.label}: ${JSON.stringify(there.words)}`,
  );
  step(
    "in another browser, the bookmark and the highlight are there",
    (await readerC.getByRole("button", { name: "Bookmarks" }).getAttribute("data-marked")) !==
      null && (await pageText(readerC).locator("mark.mac-books-highlight").count()) > 0,
  );
  await readerC.getByRole("button", { name: "Notes" }).click();
  const noteThere = elsewhere.getByText(NOTE).first();
  await noteThere.waitFor({ timeout: 10_000 }).catch(() => undefined);
  step("in another browser, Notes lists the highlight with its note", await noteThere.isVisible());
  await elsewhere.keyboard.press("Escape");

  // Project Gutenberg underscores a word; the reader shows it in italics.
  const emphasis = pageText(readerC).locator("em").first();
  for (let turn = 0; turn < 12 && (await emphasis.count()) === 0; turn += 1) {
    const before = await shown(readerC);
    await readerC.getByRole("button", { name: "Next Page" }).click();
    await elsewhere.waitForFunction(
      ({ element, start }) => Number(element.getAttribute("data-page-start")) > start,
      { element: await pageText(readerC).elementHandle(), start: before.start },
      { timeout: SLOW },
    );
  }
  const seen = await emphasis.evaluate((element) => ({
    word: element.textContent,
    style: getComputedStyle(element).fontStyle,
    page: element.closest("[data-page-start]")?.innerText ?? "",
  }));
  step(
    "a word Project Gutenberg underscores reads in italics, with no underscore to see",
    seen.style === "italic" && seen.word.length > 0 && !seen.page.includes("_"),
    `${seen.word} in ${seen.style}`,
  );
  await shot(elsewhere, path.join(out, `books-italics-${browserName}.png`));
  await settle();
  await closeContext(contextC);
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  // What the journey wrote: the reading and the library, and Books in the App Store library.
  if (cleanup) {
    try {
      await api(cleanup, "DELETE", LIBRARY);
      const after = await api(cleanup, "GET", APP_STORE);
      await api(cleanup, "PUT", APP_STORE, {
        installed: (after.json?.installed ?? []).filter((id) => id !== "books"),
        rev: after.json?.rev ?? 0,
      });
    } catch (error) {
      console.log(`warn cleanup: ${error instanceof Error ? error.message : error}`);
    }
  }
  await settle();
  for (const context of browser.contexts()) await closeContext(context);
  await browser.close();
}
judgeRetries();

console.log(`screenshots in ${out}`);
if (notes.length > 0) console.log(`${notes.length} note(s) above, none a failure`);
if (problems.length > 0) {
  console.error(
    `\nbooks: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\nbooks: all ${steps.length} steps passed with no console errors`);
