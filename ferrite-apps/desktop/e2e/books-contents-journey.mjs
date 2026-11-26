#!/usr/bin/env node
// Books' contents list on the real sources: Alice's Adventures in Wonderland, whose headings run
// over two lines, and The Adventures of Sherlock Holmes, whose headings are a numeral and a title in
// capitals. As a Guest User with data of its own; it deletes nothing. Exits 0 only when every step
// passed with no console error, page error or failed request.
//
//   node e2e/books-contents-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("books-contents", { ignoreOtherOrigins: true });
const SLOW = 60_000;

const BOOKS = [
  {
    id: "pg-11",
    search: "alice wonderland carroll",
    first: "CHAPTER I. Down the Rabbit-Hole",
    last: "CHAPTER XII. Alice’s Evidence",
    second: "CHAPTER II. The Pool of Tears",
    shot: "books-contents-alice.png",
  },
  {
    id: "pg-1661",
    search: "adventures sherlock holmes doyle",
    first: "I. A SCANDAL IN BOHEMIA",
    last: "XII. THE ADVENTURE OF THE COPPER BEECHES",
    second: "II. THE RED-HEADED LEAGUE",
    shot: "books-contents-holmes.png",
  },
];

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
async function choose(page, title, item) {
  await menuBar(page, title).click();
  await page.waitForTimeout(200);
  await page.getByRole("menuitem", { name: item }).first().click();
  await page.waitForTimeout(300);
}

await run(async (page) => {
  page.setDefaultTimeout(12_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  await openDesktop(page, base, step);
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

  for (const book of BOOKS) {
    await window.getByRole("button", { name: "Book Store", exact: true }).click();
    await window.getByRole("searchbox").fill(book.search);
    const found = window
      .getByRole("region", { name: "Project Gutenberg", exact: true })
      .locator(`.mac-books-store-item[data-book="${book.id}"]`)
      .first();
    await found.waitFor({ timeout: SLOW });
    const title = ((await found.locator(".mac-books-store-title").textContent()) ?? "").trim();
    await found.getByRole("button", { name: /^Get / }).click();
    await found.getByRole("button", { name: /^Read / }).click();

    const reader = page.getByRole("region", { name: title, exact: true }).first();
    const text = reader.getByRole("document", { name: /^Page \d+/ }).first();
    await text.waitFor({ timeout: SLOW });

    const index = (await api(page, "GET", `/api/books/text/${book.id}`)).json;
    const titles = (index.toc ?? []).map((heading) => heading.title);
    step(
      `${book.id}: the module lists its twelve chapters, first to last`,
      titles.length === 12 && titles[0] === book.first && titles[11] === book.last,
      `${titles.length} headings`,
    );

    await choose(page, "Controls", "Table of Contents");
    const row = page.getByRole("menuitem", { name: book.second });
    await row.waitFor({ state: "visible", timeout: 5_000 });
    step(`${book.id}: the contents menu lists its chapters`, await row.isVisible());
    await shot(page, path.join(out, book.shot));
    await row.click();
    await page.waitForTimeout(400);
    const heading = book.second.split(" ").slice(-2).join(" ");
    step(
      `${book.id}: choosing a chapter opens the page it starts on`,
      ((await text.textContent()) ?? "").includes(heading),
      heading,
    );
    await choose(page, "Controls", "Previous Chapter");
    await page.waitForTimeout(300);
    step(
      `${book.id}: Previous Chapter goes back to the first chapter`,
      ((await text.textContent()) ?? "").includes(book.first.split(" ").slice(-2).join(" ")),
    );
    await choose(page, "Controls", "Next Chapter");
    await page.waitForTimeout(300);
    step(
      `${book.id}: Next Chapter opens the second chapter`,
      ((await text.textContent()) ?? "").includes(heading),
      heading,
    );
    await choose(page, "Controls", "Show Library");
    await page.waitForTimeout(300);
  }
});
