#!/usr/bin/env node
// Books census (R5, round 3): one `ok`/`FAIL` line per census id of Books, real input only, against `ferrite dev
// --fresh` serving the packed site, signed in as a real account made at the login window. Books is not
// preinstalled: the account gets it from the App Store. The Book Store reads Project Gutenberg (and Standard
// Ebooks) through the app's declared egress; when they cannot be reached, Books must say so, and a row that needs
// a book fails with what Books shows and the hosts curled in the same minute.
//
// Phases: `write` drives every control and leaves a state file; `restart-check` runs after a real same-root
// restart of `ferrite dev` and checks that the library, the reading place, the bookmark and the note are kept for
// the account, and that a second account has none of them.
//
//   node e2e/books-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase all|write|restart-check] [--out <dir>] [--headed] [--only <id prefix,...>]

import { execSync } from "node:child_process";
import {
  accountFor,
  api,
  appWindow,
  census,
  chooseMenu,
  closeMenus,
  crawlMenus,
  getFromAppStore,
  launchBrowser,
  loadState,
  openApp,
  openMenuTitle,
  options,
  person,
  reloadDesktop,
  saveState,
} from "./r5-census-kit.mjs";
import { commonRows } from "./r5-common-rows.mjs";

const opts = options();
const { base, out, browserName, phase } = opts;
const c = census("books", opts);
const LIBRARY = "/api/books/library";
const READING = "/api/books/reading";
let NOTE = `R5 census note ${Date.now().toString(36)}`;
const SIDEBAR = ["All Books", "Books", "Audiobooks", "PDFs", "Authors", "Categories"];
const SORTS = ["Title", "Author", "Manually", "Most Recent"];
const meta = (state, role, name, how, expect, persists = "none") => ({
  state,
  role,
  name,
  how,
  expect,
  persists,
});

const books = (page) => appWindow(page, "Books");
const view = (page, name) =>
  books(page)
    .getByRole("group", { name: "View" })
    .getByRole("button", { name, exact: true })
    .first();
const text = async (page) =>
  (
    await books(page)
      .innerText()
      .catch(() => "")
  ).replace(/\s+/g, " ");
/** The next PUT of the library, or of a book's reading document (`/api/books/reading/<book>`). */
const nextPut = (page, url) => {
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" &&
      (new URL(r.url()).pathname === url || new URL(r.url()).pathname.startsWith(`${url}/`)),
    { timeout: 20_000 },
  );
  saved.catch(() => {});
  return saved;
};
/** The reading document of the book got (Project Gutenberg's Alice, `pg-11`), read through the app's API. */
const readingOf = async (page) => {
  const library = (await api(page, "GET", LIBRARY)).json?.library;
  const book = (library?.books ?? []).find((b) => /Alice/.test(b.title ?? ""));
  return book
    ? (await api(page, "GET", `${READING}/${encodeURIComponent(book.id)}`)).json?.reading
    : null;
};
/** The store's first result for Alice: a list item holding its Get (once got, Read) button. */
const storeBook = (page) =>
  books(page)
    .getByRole("listitem")
    .filter({
      has: page.getByRole("button", { name: /^(Get|Read) Alice.s Adventures in Wonderland$/ }),
    })
    .first();
function hostsEvidence() {
  return ["www.gutenberg.org", "standardebooks.org"]
    .map((host) => {
      try {
        return `${host} ${execSync(`curl -sS -o /dev/null -w "%{http_code}" --max-time 10 https://${host}/`, { encoding: "utf8" })} at ${new Date().toISOString()}`;
      } catch (error) {
        return `${host} unreachable (${String(error.message).split("\n")[0].slice(0, 80)}) at ${new Date().toISOString()}`;
      }
    })
    .join("; ");
}

async function writePhase(browser, page) {
  const kept = { note: NOTE };
  await c.check(
    "books.app-store.get",
    async () => {
      await getFromAppStore(page, "Books");
      const library = await api(page, "GET", "/api/app-store/library");
      return {
        ok: library.json?.installed?.includes("books"),
        detail: JSON.stringify(library.json?.installed),
      };
    },
    meta(
      "App Store",
      "button",
      "Get, Books",
      "App Store: Get, then Install, on Books",
      "Books is in the account's library and the Dock",
      "restart",
    ),
  );
  await openApp(page, "Books");
  await page.waitForTimeout(1_500);
  await c.crawl("window", books(page));

  // ── The library before any book: Sort By, New Collection, Open the Book Store (its lists are checked once a
  // book is got) ──
  const sidebarRows = async () => {
    for (const name of SIDEBAR) {
      await c.check(
        `books.sidebar.${name.toLowerCase().replace(/\s+/g, "-")}`,
        async () => {
          await view(page, "Library").click();
          await books(page).getByRole("treeitem", { name, exact: true }).click();
          await page.waitForTimeout(400);
          const selected = await books(page)
            .getByRole("treeitem", { name, exact: true })
            .getAttribute("aria-selected");
          const shown = await books(page)
            .getByRole("button", { name: /^Alice.s Adventures/ })
            .count();
          const said = await text(page);
          // All Books and Books list the book; Audiobooks and PDFs do not; Authors and Categories group it.
          const expected = {
            "All Books": shown > 0,
            Books: shown > 0,
            Audiobooks: shown === 0,
            PDFs: shown === 0,
            Authors: /Lewis Carroll|Carroll/.test(said),
            Categories:
              shown > 0 || /Fiction|Children|Fantasy|Literature|Uncategorized/i.test(said),
          }[name];
          return {
            ok: selected === "true" && expected,
            detail: `selected ${selected}; the book shown ${shown}; "${said.slice(0, 80)}"`,
          };
        },
        meta(
          "Library",
          "treeitem",
          name,
          `in the Library, click ${name}`,
          "that list: the book where it belongs, nothing where it does not",
        ),
      );
    }
  };
  await c.check(
    "books.sort-by",
    async () => {
      await books(page).getByRole("treeitem", { name: "All Books", exact: true }).click();
      const seen = [];
      for (const sort of SORTS) {
        await books(page).getByRole("button", { name: "Sort By" }).click();
        const menu = page.getByRole("menu", { name: "Sort By" });
        await menu.getByRole("menuitemradio", { name: sort }).click();
        await books(page).getByRole("button", { name: "Sort By" }).click();
        const checked = await page
          .getByRole("menu", { name: "Sort By" })
          .getByRole("menuitemradio", { name: sort })
          .getAttribute("aria-checked");
        await closeMenus(page);
        seen.push(`${sort} ${checked}`);
      }
      return { ok: seen.every((s) => s.endsWith("true")), detail: seen.join(", ") };
    },
    meta(
      "Library",
      "menuitemradio",
      "/Most Recent|Title|Author|Manually/",
      "Sort By, choose each order in turn",
      "the order chosen is checked",
      "reload",
    ),
  );
  await c.check(
    "books.new-collection",
    async () => {
      const saved = nextPut(page, LIBRARY);
      const before = await books(page)
        .getByRole("treeitem", { name: /Untitled Collection/ })
        .count();
      await books(page).getByRole("button", { name: "New Collection" }).click();
      const status = (await saved.catch(() => null))?.status();
      const listed = await books(page)
        .getByRole("treeitem", { name: /Untitled Collection/ })
        .count();
      const selected = await books(page)
        .getByRole("treeitem", { name: /Untitled Collection/ })
        .last()
        .getAttribute("aria-selected");
      kept.collection = "Untitled Collection";
      return {
        ok: status === 200 && listed === before + 1 && selected === "true",
        detail: `PUT ${status}; Untitled Collection listed ${listed}, chosen ${selected}`,
      };
    },
    meta(
      "Library",
      "button",
      "New Collection",
      "click New Collection",
      "an Untitled Collection joins the sidebar, chosen, kept on the server",
      "restart",
    ),
  );
  await c.check(
    "books.open-the-book-store",
    async () => {
      await books(page).getByRole("treeitem", { name: "All Books", exact: true }).click();
      await books(page).getByRole("button", { name: "Open the Book Store" }).click();
      const pressed = await view(page, "Book Store").getAttribute("aria-pressed");
      return { ok: pressed === "true", detail: `Book Store pressed ${pressed}` };
    },
    meta(
      "Library",
      "button",
      "Open the Book Store",
      "in an empty library, click Open the Book Store",
      "the Book Store",
    ),
  );

  // ── The Book Store (Project Gutenberg), search, Get, Read ──
  const store = books(page)
    .getByRole("region", { name: "Project Gutenberg", exact: true })
    .or(books(page).getByRole("region", { name: "Popular at Project Gutenberg" }))
    .first();
  const reachable = await store.waitFor({ timeout: 30_000 }).then(
    () => true,
    () => false,
  );
  const evidence = reachable ? "" : hostsEvidence();
  await c.crawl("Book Store", books(page));
  await c.check(
    "books.store.popular",
    async () => {
      if (!reachable)
        return {
          ok: false,
          detail: `no store; Books says "${(await text(page)).slice(0, 160)}"; ${evidence}`,
        };
      const offered = await books(page)
        .getByRole("button", { name: /^(Get|Read) / })
        .first()
        .waitFor({ timeout: 30_000 })
        .then(
          async () =>
            books(page)
              .getByRole("button", { name: /^(Get|Read) / })
              .count(),
          () => 0,
        );
      return { ok: offered > 0, detail: `${offered} books offered` };
    },
    meta(
      "Book Store",
      "button",
      "/(Get|Read) .+/",
      "click Book Store",
      "Project Gutenberg's popular books, each with Get",
    ),
  );
  await c.check(
    "books.store.search",
    async () => {
      const search = books(page).getByRole("searchbox", { name: "Search" });
      await search.fill("alice wonderland");
      await search.press("Enter");
      const shown = await storeBook(page)
        .waitFor({ timeout: 30_000 })
        .then(
          () => true,
          () => false,
        );
      return {
        ok: shown,
        detail: shown
          ? "Alice's Adventures in Wonderland found"
          : `nothing; Books says "${(await text(page)).slice(0, 160)}"; ${hostsEvidence()}`,
      };
    },
    meta(
      "Book Store",
      "searchbox",
      "Search",
      'type "alice wonderland", press Return',
      "the store's results name the book",
    ),
  );
  await c.check(
    "books.store.get",
    async () => {
      const saved = nextPut(page, LIBRARY);
      await storeBook(page).getByRole("button", { name: /^Get/ }).first().click();
      const status = (await saved).status();
      await storeBook(page)
        .getByRole("button", { name: /^Read/ })
        .first()
        .waitFor({ timeout: 30_000 });
      const library = (await api(page, "GET", LIBRARY)).text;
      kept.bookId =
        ((await api(page, "GET", LIBRARY)).json?.library?.books ?? []).find((b) =>
          /Alice/.test(b.title ?? ""),
        )?.id ?? null;
      return { ok: status === 200 && /Alice/.test(library), detail: `PUT ${status}` };
    },
    meta(
      "Book Store",
      "button",
      "/Get .+/",
      "click Get on the book",
      "the book is in the library on the server; the store offers Read",
      "restart",
    ),
  );
  const reader = () => page.getByRole("region", { name: /^Alice.s Adventures/ }).first();
  const pageText = () =>
    reader()
      .getByRole("document", { name: /^Page \d+/ })
      .first();
  const start = async () => Number(await pageText().getAttribute("data-page-start"));
  await c.check(
    "books.store.read",
    async () => {
      await storeBook(page).getByRole("button", { name: /^Read/ }).first().click();
      await pageText().waitFor({ timeout: 30_000 });
      const words = (await pageText().innerText()).split(/\s+/).length;
      const cover = await pageText().locator("img[data-book-picture]").count();
      await c.crawl("reader", reader());
      return {
        ok:
          (words > 20 || cover > 0) &&
          /Project Gutenberg/.test((await reader().textContent()) ?? ""),
        detail: `${words} words and ${cover} picture(s) on the first page`,
      };
    },
    meta(
      "Book Store",
      "button",
      "/Read .+/",
      "click Read on the book",
      "the reader opens at the book's text, with its credit",
    ),
  );
  await c.check(
    "books.reader.next-page",
    async () => {
      const first = await start();
      await reader().getByRole("button", { name: "Next Page" }).click();
      await page.waitForFunction(
        ({ e, s }) => Number(e.getAttribute("data-page-start")) > s,
        { e: await pageText().elementHandle(), s: first },
        { timeout: 15_000 },
      );
      kept.place = await start();
      return { ok: kept.place > first, detail: `${first} -> ${kept.place}` };
    },
    meta(
      "reader",
      "button",
      "Next Page",
      "click Next Page",
      "the following text; the place is kept",
      "restart",
    ),
  );
  const chooseLayout = async (name) => {
    await openMenuTitle(page, "View");
    await page.getByRole("menuitemradio", { name: new RegExp(`^${name}`) }).click();
    await closeMenus(page);
    await page.waitForTimeout(400);
  };
  await c.check(
    "books.reader.two-pages",
    async () => {
      const single = await pageText().evaluate(
        (e) => Number(e.dataset.pageEnd) - Number(e.dataset.pageStart),
      );
      await chooseLayout("Two Pages");
      const columns = await pageText().evaluate((e) => getComputedStyle(e).columnCount);
      const settled = await pageText().evaluate((e) => {
        const box = e.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(e);
        const last = [...range.getClientRects()].at(-1);
        return {
          chars: Number(e.dataset.pageEnd) - Number(e.dataset.pageStart),
          over: e.scrollWidth - e.clientWidth,
          secondColumn: (last?.left ?? 0) > box.left + box.width / 2,
        };
      });
      await page.screenshot({ path: `${out}/books-two-pages.png` });
      return {
        ok: columns === "2" && settled.over <= 1 && settled.secondColumn && settled.chars > single,
        detail: `single ${single} chars; two columns ${settled.chars} chars, ${settled.over}px over, text in the second ${settled.secondColumn}`,
      };
    },
    meta(
      "reader",
      "menuitemradio",
      "Two Pages",
      "View > Two Pages",
      "two columns holding more than a page, the prose flowing into the second",
      "reload",
    ),
  );
  await c.check(
    "books.reader.scroll",
    async () => {
      await chooseLayout("Scroll");
      const before = await pageText().evaluate((e) => ({
        end: Number(e.dataset.pageEnd),
        start: Number(e.dataset.pageStart),
        scrolls: e.scrollHeight > e.clientHeight,
      }));
      const saved = nextPut(page, READING);
      await pageText().evaluate((e) => {
        e.scrollTop = e.scrollHeight - e.clientHeight;
      });
      const status = (await saved).status();
      await page.waitForTimeout(500);
      const after = await pageText().evaluate((e) => ({
        end: Number(e.dataset.pageEnd),
        start: Number(e.dataset.pageStart),
      }));
      await page.screenshot({ path: `${out}/books-scroll.png` });
      const place = (await readingOf(page))?.place ?? 0;
      await chooseLayout("Single Page");
      const paged = await start();
      kept.place = paged;
      return {
        ok:
          before.scrolls &&
          status === 200 &&
          after.start === before.start &&
          after.end > before.end &&
          place > before.start + 1000 &&
          paged === place,
        detail: `shown ${before.start}-${before.end}, reached ${after.end}; place ${place}; pages open at ${paged}`,
      };
    },
    meta(
      "reader",
      "menuitemradio",
      "Scroll",
      "View > Scroll, scroll to the end of what is shown, View > Single Page",
      "more text arrives; the place follows the view; the pages open there",
      "reload",
    ),
  );
  await c.check(
    "books.reader.add-bookmark",
    async () => {
      const saved = nextPut(page, READING);
      await reader().getByRole("button", { name: "Bookmarks" }).click();
      await page.getByRole("menuitem", { name: "Add Bookmark" }).click();
      const status = (await saved).status();
      const marked = await reader()
        .getByRole("button", { name: "Bookmarks" })
        .getAttribute("data-marked");
      return {
        ok: status === 200 && marked !== null,
        detail: `PUT ${status}; the page marked ${marked !== null}`,
      };
    },
    meta(
      "reader",
      "menuitem",
      "Add Bookmark",
      "Bookmarks > Add Bookmark",
      "the page is bookmarked, on the server",
      "restart",
    ),
  );
  await c.check(
    "books.reader.highlight-note",
    async () => {
      const b = await pageText().boundingBox();
      await page.mouse.move(b.x + 8, b.y + 14);
      await page.mouse.down();
      await page.mouse.move(b.x + Math.min(260, b.width - 10), b.y + 14, { steps: 12 });
      await page.mouse.up();
      await page.getByRole("button", { name: "Add Note" }).click();
      const saved = nextPut(page, READING);
      await page.getByRole("textbox", { name: "Note" }).fill(NOTE);
      await page.getByRole("button", { name: "Done" }).click();
      const status = (await saved).status();
      const marks = await pageText().locator("mark.mac-books-highlight").count();
      return {
        ok: status === 200 && marks > 0,
        detail: `PUT ${status}; ${marks} highlight(s) shown`,
      };
    },
    meta(
      "reader",
      "button",
      "Add Note",
      "drag across words with the mouse, Add Note, type, Done",
      "the highlight and its note are kept",
      "restart",
    ),
  );
  await c.check(
    "books.reader.notes",
    async () => {
      await reader().getByRole("button", { name: "Notes" }).click();
      const listed = await page
        .getByText(NOTE)
        .first()
        .waitFor({ timeout: 5_000 })
        .then(
          () => true,
          () => false,
        );
      await page.keyboard.press("Escape");
      return { ok: listed, detail: `the note listed ${listed}` };
    },
    meta("reader", "button", "Notes", "click Notes", "the highlight is listed with its note"),
  );
  await page.keyboard.press("Escape");
  await reader()
    .getByRole("button", { name: "Close" })
    .first()
    .click()
    .catch(() => {});
  // The search field is the window's: the store's "alice wonderland" would filter the library to nothing.
  await books(page).getByRole("searchbox", { name: "Search" }).fill("");
  await sidebarRows();

  // ── The toolbar: Library, Audiobook Store, the sidebar button, the library's search ──
  await c.check(
    "books.toolbar.audiobook-store",
    async () => {
      await view(page, "Audiobook Store").click();
      const pressed = await view(page, "Audiobook Store").getAttribute("aria-pressed");
      const said = (await text(page)).slice(0, 200);
      return {
        ok: pressed === "true" && /audiobook|librivox/i.test(said),
        detail: `pressed ${pressed}; says "${said.slice(0, 120)}"`,
      };
    },
    meta(
      "window",
      "button",
      "Audiobook Store",
      "click Audiobook Store",
      "the Audiobook Store, LibriVox's shelf",
    ),
  );
  await c.check(
    "books.toolbar.library",
    async () => {
      await view(page, "Library").click();
      const listed = await books(page)
        .getByRole("button", { name: /^Alice.s Adventures/ })
        .first()
        .waitFor({ timeout: 10_000 })
        .then(
          () => true,
          () => false,
        );
      return { ok: listed, detail: `the book in the library ${listed}` };
    },
    meta(
      "window",
      "button",
      "Library",
      "click Library",
      "the library lists the book got",
      "restart",
    ),
  );
  await c.check(
    "books.toolbar.sidebar",
    async () => {
      await books(page).getByRole("button", { name: "Hide Sidebar" }).click();
      const hidden = (await books(page).getByRole("treeitem", { name: "All Books" }).count()) === 0;
      await books(page).getByRole("button", { name: "Show Sidebar" }).click();
      const shown = await books(page).getByRole("treeitem", { name: "All Books" }).isVisible();
      return { ok: hidden && shown, detail: `hidden ${hidden}, shown ${shown}` };
    },
    meta(
      "window",
      "button",
      "/Hide Sidebar|Show Sidebar/",
      "click Hide Sidebar, then Show Sidebar",
      "the sidebar hides and shows",
    ),
  );
  await c.check(
    "books.library.search",
    async () => {
      const search = books(page).getByRole("searchbox", { name: "Search" });
      await search.fill("wonderland");
      await search.press("Enter");
      await page.waitForTimeout(800);
      const found = await books(page)
        .getByRole("button", { name: /^Alice.s Adventures/ })
        .count();
      await search.fill("zzqqnotabook");
      await search.press("Enter");
      await page.waitForTimeout(800);
      const none = await books(page)
        .getByRole("button", { name: /^Alice.s Adventures/ })
        .count();
      await search.fill("");
      return { ok: found > 0 && none === 0, detail: `"wonderland" ${found}; nonsense ${none}` };
    },
    meta(
      "Library",
      "searchbox",
      "Search",
      "type words of the title, then nonsense",
      "the book is found, then not",
    ),
  );
  await c.check(
    "books.library.cover-status",
    async () => {
      const status = await books(page)
        .getByRole("button", { name: /^Alice.s Adventures/ })
        .first()
        .locator(".mac-books-cover-status")
        .innerText();
      return { ok: /^\d+%$/.test(status), detail: `the cover says ${status}` };
    },
    meta(
      "Library",
      "button",
      "/Alice.+/",
      "the cover of a book that has been opened",
      "how far it is read, in percent",
      "restart",
    ),
  );
  await c.check(
    "books.library.cover-share",
    async () => {
      await page.evaluate(() => {
        window.__copied = [];
        navigator.clipboard.writeText = async (text) => {
          window.__copied.push(text);
        };
      });
      await books(page)
        .getByRole("button", { name: /^Alice.s Adventures/ })
        .first()
        .click({ button: "right" });
      await page.getByRole("menuitem", { name: "Share Book" }).click();
      await page.getByRole("menuitem", { name: "Copy Link" }).click();
      await closeMenus(page);
      const copied = await page.evaluate(() => window.__copied);
      return {
        ok: copied.length === 1 && /gutenberg\.org\/ebooks\/11$/.test(copied[0]),
        detail: `copied ${JSON.stringify(copied)}`,
      };
    },
    meta(
      "Library",
      "menuitem",
      "Share Book",
      "right-click a cover, Share Book > Copy Link",
      "the book's page at its source is on the clipboard",
    ),
  );

  // ── Menus of Books: Store and Controls ──
  for (const [row, pressedName] of [
    ["Book Store", "Book Store"],
    ["Audiobook Store", "Audiobook Store"],
    ["Library", "Library"],
  ]) {
    await c.check(
      `books.menu-store.${row.toLowerCase().replace(/\s+/g, "-")}`,
      async () => {
        await chooseMenu(page, "Store", row);
        const pressed = await view(page, pressedName).getAttribute("aria-pressed");
        return { ok: pressed === "true", detail: `${pressedName} pressed ${pressed}` };
      },
      meta("menu:Store", "menuitem", row, `Store > ${row}`, `the ${row}`),
    );
  }
  await c.unavailable(
    "books.menu-controls.none",
    (await openMenuTitle(page, "Controls")).getByRole("menuitem", {
      name: "This demo has no Controls commands",
    }),
    /no Controls commands/,
    null,
    meta(
      "menu:Controls",
      "menuitem",
      "This demo has no Controls commands",
      "open the Controls menu",
      "unavailable: the row is dimmed and says why",
    ),
  );
  await closeMenus(page);

  await commonRows(c, page, { id: "books", name: "Books" });
  for (const control of (await crawlMenus(page)).rows) c.crawled.push(control);

  await c.check(
    "books.persist.reload",
    async () => {
      await reloadDesktop(page);
      await openApp(page, "Books");
      return persisted(page, kept);
    },
    meta(
      "Library",
      "reload",
      "library and reading",
      "reload the desktop, open Books",
      "the book, the collection, the place, the bookmark and the note",
      "reload",
    ),
  );
  await isolation(browser, "books.isolation.write", kept);
  return kept;
}

async function persisted(page, kept) {
  await view(page, "Library").click();
  const book = await books(page)
    .getByRole("button", { name: /^Alice.s Adventures/ })
    .first()
    .waitFor({ timeout: 15_000 })
    .then(
      () => true,
      () => false,
    );
  const shelf = await books(page)
    .getByRole("treeitem", { name: /Untitled Collection/ })
    .count();
  const reading = await readingOf(page);
  const ok =
    book &&
    shelf > 0 &&
    reading?.place === kept.place &&
    reading?.bookmarks?.length > 0 &&
    reading?.highlights?.some((h) => h.note === NOTE);
  return {
    ok,
    detail: `book ${book}; collection ${shelf}; place ${reading?.place} (left at ${kept.place}); bookmarks ${reading?.bookmarks?.length}; note kept ${reading?.highlights?.some((h) => h.note === NOTE)}`,
  };
}

async function isolation(browser, id, kept) {
  await c.check(
    id,
    async () => {
      const other = await person(
        browser,
        c,
        base,
        accountFor("books", `b${phase === "restart-check" ? "r" : "w"}`),
        { label: "second account" },
      );
      try {
        const library = await api(other, "GET", LIBRARY);
        if (!kept?.bookId)
          return {
            ok: false,
            detail: "no book of the first account to probe (the store step failed)",
          };
        // The first account's own book, asked for with the second account's session: the server must answer a
        // valid empty reading (each account keeps its own) or deny it; an error or an unreadable reply fails.
        c.allow(
          /second account (HTTP 40[34]: GET .*\/api\/books\/reading\/|console: Failed to load resource: the server responded with a status of 40[34])/,
        );
        const reading = await api(other, "GET", `${READING}/${encodeURIComponent(kept.bookId)}`);
        const doc = reading.json;
        const r = doc && typeof doc === "object" && "reading" in doc ? doc.reading : undefined;
        // A valid reading is null (nothing kept) or an object whose bookmark and highlight lists are arrays.
        const wellFormed =
          r === null ||
          (r !== undefined &&
            typeof r === "object" &&
            !Array.isArray(r) &&
            Array.isArray(r.bookmarks) &&
            Array.isArray(r.highlights));
        const empty =
          reading.status === 200 &&
          wellFormed &&
          (r === null || (r.bookmarks.length === 0 && r.highlights.length === 0)) &&
          !reading.text.includes(NOTE);
        const denied = reading.status === 403 || reading.status === 404;
        return {
          ok:
            library.status === 200 &&
            !/Alice|Untitled Collection/.test(library.text) &&
            (empty || denied),
          detail: `their library ${library.text.slice(0, 100)}; ${READING}/${kept.bookId} as them: ${reading.status} ${reading.text.slice(0, 100)}`,
        };
      } finally {
        await other.context().close();
      }
    },
    meta(
      "second account",
      "isolation",
      "Books library",
      "sign up a second account, read its Books library and reading",
      "none of the first account's books, collection or notes",
      "restart",
    ),
  );
}

async function restartPhase(browser) {
  const state = loadState(out, "books", browserName);
  // The note the write phase wrote, not one made up now.
  NOTE = state.kept?.note ?? NOTE;
  const page = await person(browser, c, base, state.account, { create: false });
  await openApp(page, "Books");
  await c.check(
    "books.persist.restart",
    async () => persisted(page, state.kept),
    meta(
      "Library",
      "restart",
      "library and reading",
      "restart ferrite dev on the same root, sign in, open Books",
      "the book, the collection, the place, the bookmark and the note",
      "restart",
    ),
  );
  await isolation(browser, "books.isolation.restart", state.kept);
}

const browser = await launchBrowser(browserName, { headed: opts.headed });
try {
  if (phase === "restart-check") await restartPhase(browser);
  else {
    const account = accountFor("books", "a");
    const page = await person(browser, c, base, account);
    const kept = await writePhase(browser, page);
    saveState(out, "books", browserName, { account, kept });
  }
} catch (error) {
  c.row("books.run.completed", false, String(error?.message ?? error).split("\n")[0]);
} finally {
  await browser.close();
}
c.finish();
