#!/usr/bin/env node
// Books: View > Grid and List, the menu of words selected on a page, and Books > Preferences.
// Exits 0 only when every step passed with no console error, page error or failed request.
//
// Stand-in: this sandbox cannot reach Project Gutenberg, so the book's text answers from this script
// (`/api/books/text/<book>`, with the shape src/apps/books/text.rs documents). The library, the place
// and the highlights go to the real server.
//
//   node e2e/books-views-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("books-views", { ignoreOtherOrigins: true });
const tag = Date.now();
const ID = `pg-${900000 + (tag % 90000)}`;
const OTHER = `pg-${800000 + (tag % 90000)}`;
const TITLE = `Quince ${tag}`;
const OTHER_TITLE = `Medlar ${tag}`;
const LIBRARY = "/api/books/library";
const TEXT = `The serene orchard stood at the end of the lane, and the serene gardener came to it every morning. ${"Words follow words in this long paragraph of the book. ".repeat(30)}`;

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await page.route(/\/api\/books\/pictures\/pg-/, (route) =>
    route.fulfill({ json: { pictures: [], complete: true } }),
  );
  await page.route(/\/api\/books\/text\/pg-/, (route) => {
    const part = /\/text\/pg-\d+\/(\d+)/.exec(route.request().url());
    const common = { parts: [TEXT.length], complete: true, truncated: false };
    route.fulfill({
      json: part
        ? { part: 0, text: TEXT, ...common }
        : {
            id: ID,
            source: "gutenberg",
            credit: "",
            licence: "",
            link: "",
            start: 0,
            toc: [],
            ...common,
          },
    });
  });
  await openDesktop(page, base, step);
  const installed = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(installed.installed ?? []), "books"])],
    rev: installed.rev,
  });
  const current = (await api(page, "GET", LIBRARY)).json;
  await api(page, "PUT", LIBRARY, {
    library: {
      collections: [],
      pages: {},
      marks: {},
      sort: "title",
      ...current.library,
      books: [
        ...(current.library?.books ?? []),
        { id: ID, title: TITLE, author: "An Author", source: "gutenberg", added: tag },
        { id: OTHER, title: OTHER_TITLE, author: "Another", source: "gutenberg", added: tag - 1 },
      ],
    },
    rev: current.rev ?? 0,
  });
  await reloadDesktop(page);
  await launch(page, "Books");
  const window = page.locator(".mac-books").first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await window.locator(`[data-book="${ID}"]`).first().waitFor({ timeout: 10_000 });
  const bar = page.getByRole("menubar");
  const open = async (menu) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.waitForTimeout(200);
  };
  const anyRow = (name) => page.locator('[role^="menuitem"]').filter({ hasText: name }).last();

  await open("View");
  await shot(page, path.join(out, "books-view-menu.png"));
  await anyRow(/^List/).click();
  await page.waitForTimeout(400);
  const list = window.getByRole("grid").or(window.locator(".mac-table-view")).first();
  await list.waitFor();
  const row = list.locator(`[data-book="${ID}"]`);
  await row.waitFor();
  step("View > List shows the books in columns", (await row.innerText()).includes("An Author"));
  await shot(page, path.join(out, "books-list.png"));

  await row.click();
  await list.locator(`[data-book="${OTHER}"]`).click({ modifiers: ["ControlOrMeta"] });
  await page.waitForTimeout(200);
  step(
    "rows select as covers do: File > Remove acts on both",
    (await list.locator(`[data-book][aria-selected="true"]`).count()) === 2,
  );
  await row.click();
  await row.click({ button: "right" });
  await page.waitForTimeout(300);
  await page.getByRole("menuitem", { name: "Get Info" }).click();
  const info = page.getByRole("dialog");
  await info.getByText(TITLE).first().waitFor();
  step("a row has the cover's menu", true);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await launch(page, "Books");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await list.locator(`[data-book="${ID}"]`).waitFor({ timeout: 10_000 });
  step("the list is still shown after a reload", true);

  await list.locator(`[data-book="${ID}"]`).dblclick();
  const reader = page.getByRole("region", { name: TITLE, exact: true }).first();
  const text = reader.getByRole("document", { name: /^Page \d+/ }).first();
  await text.waitFor({ timeout: 10_000 });
  step("a double click on a row opens the book", true);

  // As a person does: a double click selects the word and opens the highlight colours, and a secondary
  // click on it asks for the page's menu.
  const pick = async (word) => {
    const box = await text.evaluate((root, wanted) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.data.indexOf(wanted);
        if (at >= 0) {
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + wanted.length);
          const { x, y, width, height } = range.getBoundingClientRect();
          return { x: x + width / 2, y: y + height / 2 };
        }
      }
      return null;
    }, word);
    await page.mouse.dblclick(box.x, box.y);
    await page.waitForTimeout(300);
    await page.mouse.click(box.x, box.y, { button: "right" });
    await page.waitForTimeout(300);
  };
  await pick("orchard");
  const menu = page.getByRole("menu", { name: "Page" });
  await menu.waitFor();
  await shot(page, path.join(out, "books-page-menu.png"));
  step(
    "the words on a page have their menu, with no highlight colours over it",
    (await menu.getByRole("menuitem", { name: "Add Highlight" }).getAttribute("aria-disabled")) !==
      "true",
  );
  await menu.getByRole("menuitem", { name: "Add Highlight" }).click();
  let highlights = [];
  for (let tries = 0; tries < 12 && highlights.length === 0; tries += 1) {
    await page.waitForTimeout(400);
    const kept = (await api(page, "GET", `/api/books/reading/${ID}`)).json;
    highlights = kept.reading?.highlights ?? kept.highlights ?? [];
  }
  step(
    "Add Highlight from it is stored",
    highlights.some((each) => each.text === "orchard"),
    JSON.stringify(highlights.map((each) => each.text)),
  );

  await pick("serene");
  await menu.getByRole("menuitem", { name: "Search", exact: true }).click();
  const results = page.getByRole("list", { name: "Results" });
  await results.waitFor();
  step(
    "Search finds every place of the words in the book",
    (await results.getByRole("listitem").count()) === 2,
    String(await results.getByRole("listitem").count()),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await open("Books");
  await page.getByRole("menuitem", { name: /^Preferences/ }).click();
  const preferences = page
    .getByRole("region", { name: /Books Preferences/ })
    .or(page.locator(".mac-preferences-window"))
    .first();
  await preferences.waitFor();
  await preferences.getByRole("checkbox", { name: "Justify text" }).click();
  await preferences.getByRole("checkbox", { name: "Auto-Night Theme" }).click();
  await shot(page, path.join(out, "books-preferences.png"));
  await page.waitForTimeout(900);
  const look = () =>
    text.evaluate((element) => ({
      align: getComputedStyle(element).textAlign,
      theme: element.closest("[data-books-face]")?.getAttribute("data-books-theme"),
    }));
  let now = await look();
  step("Justify text sets the page's lines to both margins", now.align === "justify", now.align);
  step(
    "with Auto-Night off a page with no theme stays white",
    now.theme === "white",
    String(now.theme),
  );

  await reloadDesktop(page);
  await launch(page, "Books");
  await text.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  now = await look();
  step(
    "both are kept after a reload",
    now.align === "justify" && now.theme === "white",
    JSON.stringify(now),
  );

  await open("Books");
  await page.getByRole("menuitem", { name: /^Preferences/ }).click();
  await preferences.waitFor();
  await preferences.getByRole("checkbox", { name: "Justify text" }).click();
  await preferences.getByRole("checkbox", { name: "Auto-Night Theme" }).click();
  await page.waitForTimeout(900);

  await open("View");
  await anyRow(/^Grid/).click();
  await page.waitForTimeout(400);
  step(
    "View > Grid goes back to the covers",
    (await window.locator(`button[data-book="${ID}"]`).count()) === 1 &&
      (await window.locator(".mac-books-list").count()) === 0,
  );
  await page.waitForTimeout(900);
});
