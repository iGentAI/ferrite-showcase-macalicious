#!/usr/bin/env node
// Books' library on the served desktop: reading lists and collections from a cover's menu, several
// covers selected and dragged to a collection, renaming and deleting a collection, Get Info, Remove,
// and what comes back after a reload. It signs in as a new Guest User, whose library it fills, and
// stops before changing a library that already holds books. Exits 0 only when every step passed with
// no console error, page error or failed request.
//
//   node e2e/books-library-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("books-library", { ignoreOtherOrigins: true });
const LIBRARY = "/api/books/library";
const book = (id, title, author, added) => ({ id, title, author, source: "gutenberg", added });
const BOOKS = [
  book("pg-11", "Alice", "Lewis Carroll", 3),
  book("pg-84", "Frankenstein", "Mary Shelley", 2),
  book("pg-1342", "Pride and Prejudice", "Jane Austen", 1),
];

const settled = async (page, test) => {
  let value;
  for (let i = 0; i < 40; i++) {
    value = (await api(page, "GET", LIBRARY)).json.library;
    if (test(value)) return value;
    await page.waitForTimeout(250);
  }
  return value;
};
const holds = (library, id) => library?.collections?.find((each) => each.id === id)?.books ?? [];

await run(async (page) => {
  await openDesktop(page, base, step);
  const installed = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(installed.installed ?? []), "books"])],
    rev: installed.rev,
  });
  const current = (await api(page, "GET", LIBRARY)).json;
  if ((current.library?.books ?? []).length > 0) {
    throw new Error("This journey needs a new guest: this library already holds books.");
  }
  await api(page, "PUT", LIBRARY, {
    library: { collections: [], pages: {}, marks: {}, sort: "recent", books: BOOKS },
    rev: current.rev ?? 0,
  });
  await reloadDesktop(page);
  await launch(page, "Books");
  const window = page.locator(".mac-books").first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const cover = (id) => window.locator(`[data-book="${id}"]`);
  await cover("pg-11").waitFor({ timeout: 10_000 });
  const row = (name) =>
    window.getByRole("treeitem", { name }).or(window.getByRole("option", { name })).first();
  const menuRow = (name) => page.getByRole("menuitem", { name }).first();

  // The reading lists.
  await cover("pg-11").click({ button: "right" });
  await menuRow("Mark as Finished").waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "books-cover-menu.png"));
  await menuRow("Mark as Finished").click();
  let library = await settled(page, (each) => holds(each, "finished").includes("pg-11"));
  step("Mark as Finished keeps the book as finished", holds(library, "finished").includes("pg-11"));
  await cover("pg-84").click({ button: "right" });
  await menuRow("Add to Want to Read").click();
  library = await settled(page, (each) => holds(each, "want-to-read").includes("pg-84"));
  step("Add to Want to Read keeps it", holds(library, "want-to-read").includes("pg-84"));
  await row("Finished").click();
  await page.waitForTimeout(200);
  step(
    "the Finished row lists the finished book alone",
    (await cover("pg-11").count()) === 1 && (await cover("pg-84").count()) === 0,
  );
  await shot(page, path.join(out, "books-finished.png"));
  await cover("pg-11").click({ button: "right" });
  await menuRow("Mark as Unfinished").click();
  library = await settled(page, (each) => !holds(each, "finished").includes("pg-11"));
  step("Mark as Unfinished takes it off the row", (await cover("pg-11").count()) === 0);
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  await page.waitForTimeout(200);
  step(
    "and out of the selection: File > Remove from Library is dimmed",
    (await menuRow(/^Remove from Library/).getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");

  // Several covers, dragged to a collection.
  await row("All Books").click();
  await window.getByRole("button", { name: "New Collection" }).last().click();
  await page.waitForTimeout(300);
  await row("All Books").click();
  await cover("pg-11").click();
  await cover("pg-1342").click({ modifiers: ["ControlOrMeta"] });
  step(
    "Command-click selects a second cover",
    (await cover("pg-11").getAttribute("aria-pressed")) === "true" &&
      (await cover("pg-1342").getAttribute("aria-pressed")) === "true",
  );
  await cover("pg-84").click({ modifiers: ["Shift"] });
  step(
    "Shift-click selects the range between",
    (await window.locator('[data-book][aria-pressed="true"]').count()) === 2,
    String(await window.locator('[data-book][aria-pressed="true"]').count()),
  );
  await shot(page, path.join(out, "books-several.png"));
  await row("Authors").click();
  await page.waitForTimeout(200);
  step(
    "going to another row leaves nothing selected",
    (await window.locator('[data-book][aria-pressed="true"]').count()) === 0,
  );
  await row("All Books").click();
  await cover("pg-11").click();
  await cover("pg-1342").click({ modifiers: ["ControlOrMeta"] });
  await cover("pg-1342").dragTo(row(/^Untitled Collection/));
  library = await settled(page, (each) => holds(each, "collection-1").length === 2);
  step(
    "dragging them to a collection puts both in it",
    holds(library, "collection-1").length === 2,
    holds(library, "collection-1").join(),
  );

  // Rename and delete.
  await row(/^Untitled Collection/).click({ button: "right" });
  await page.getByRole("menu", { name: "Collection commands" }).waitFor({ timeout: 5_000 });
  await menuRow("Rename").click();
  const name = window.getByRole("textbox", { name: "Collection name" });
  await name.waitFor({ timeout: 5_000 });
  await name.fill("Favourites");
  await name.press("Enter");
  library = await settled(page, (each) =>
    each?.collections?.some((item) => item.name === "Favourites"),
  );
  step("Rename names the collection", await row("Favourites").isVisible());

  // Get Info, and what comes back.
  await row("Favourites").click();
  await page.waitForTimeout(200);
  await cover("pg-11").click();
  await page.getByRole("menubar").getByRole("menuitem", { name: "File", exact: true }).click();
  await menuRow(/^Get Info/).click();
  const info = page.getByRole("dialog").filter({ hasText: "Alice" });
  await info.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(500);
  const sheetTop = (await info.boundingBox()).y;
  const windowTop = (await window.boundingBox()).y;
  step("Get Info is a sheet at the top of the window", sheetTop - windowTop < 80, `${sheetTop}`);
  await shot(page, path.join(out, "books-info.png"));
  step(
    "Get Info says who wrote it, where it came from and what holds it",
    /Lewis Carroll/.test(await info.textContent()) &&
      /Project Gutenberg/.test(await info.textContent()) &&
      /Favourites/.test(await info.textContent()),
  );
  await info.getByRole("button", { name: "Done" }).click();

  // Whether the source can be reached from here is not this journey's concern: the reader says so.
  expectRefusal(502, "/api/books/text/pg-11");
  expectRefusal(502, "/api/books/text/pg-11");
  await cover("pg-11").dblclick();
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await page.waitForTimeout(1500);
  if ((await window.count()) === 0) await launch(page, "Books");
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await cover("pg-11").waitFor({ timeout: 10_000 });
  step(
    "after a reload the row it was left on is still selected",
    (await window.locator('[aria-selected="true"]', { hasText: "Favourites" }).count()) === 1,
  );
  await page
    .locator(".mac-books-text-body, .mac-books-reader")
    .first()
    .waitFor({ timeout: 20_000 });
  step("and the book it was left open on opens again", true);
  await page.locator(".mac-books-reader-bar").getByRole("button", { name: "Library" }).click();
  await page.waitForTimeout(500);

  await row("Favourites").click({ button: "right" });
  await menuRow("Delete").click();
  const alert = page.getByRole("alertdialog").filter({ hasText: "Favourites" });
  await alert.getByRole("button", { name: "Delete" }).click();
  library = await settled(
    page,
    (each) => !each?.collections?.some((item) => item.name === "Favourites"),
  );
  step(
    "Delete takes the collection and leaves its books in the library",
    !library.collections.some((item) => item.name === "Favourites") && library.books.length === 3,
  );

  // Remove several.
  await row("All Books").click();
  await cover("pg-11").click();
  await cover("pg-1342").click({ modifiers: ["ControlOrMeta"] });
  await cover("pg-1342").click({ button: "right" });
  await menuRow(/^Remove 2 Books/).click();
  library = await settled(page, (each) => each?.books?.length === 1);
  step("Remove takes every selected book", library.books.length === 1, library.books[0]?.id);
});
