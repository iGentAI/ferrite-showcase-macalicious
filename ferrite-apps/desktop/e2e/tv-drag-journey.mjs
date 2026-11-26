#!/usr/bin/env node
// TV: Up Next reordered and joined by dragging cards with the mouse, Watch Later joined the same way,
// and a YouTube link dropped on the window, each read back from the server or the window.
//
// The drop from outside is a dispatched `drop` event carrying a DataTransfer: a browser test cannot
// drag from another application. The card drags are real mouse drags.
//
//   node e2e/tv-drag-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("tv-drag", { ignoreOtherOrigins: true });
const LIBRARY = "/api/tv/library";
const SAMPLE = "https://www.youtube.com/watch?v=R6MlUcmOul8";

async function openTv(page) {
  await launch(page, "TV");
  const window = page.getByRole("region", { name: "TV", exact: true }).first();
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

const dropOn = (window, data) =>
  window.evaluate((frame, entries) => {
    const transfer = new DataTransfer();
    for (const [type, value] of Object.entries(entries)) transfer.setData(type, value);
    const target = frame.querySelector(".mac-tv-hint") ?? frame;
    for (const type of ["dragover", "drop"]) {
      target.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
    }
  }, data);

await run(async (page) => {
  await openDesktop(page, base, step);
  let window = await openTv(page);
  const library = async () => (await api(page, "GET", LIBRARY)).json?.library;
  const everyone = () => window.getByRole("region", { name: "For Everyone" });
  const upNext = () => window.getByRole("region", { name: "Up Next" });
  const cardIn = (shelf, at) => shelf.locator(".mac-card-grid-card").nth(at);

  await everyone().waitFor({ timeout: 10_000 });
  const titles = await everyone().locator(".mac-card-grid-card-title").allInnerTexts();
  for (const at of [0, 1, 2]) {
    await cardIn(everyone(), at).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Up Next" }).click();
  }
  await cardIn(upNext(), 2).waitFor({ timeout: 5_000 });
  const order = () => upNext().locator(".mac-card-grid-card-title").allInnerTexts();
  step(
    "three videos are queued in order",
    (await order()).slice(0, 3).join() === titles.slice(0, 3).join(),
  );
  const stored = (await library())?.upNext ?? [];
  await page.waitForTimeout(800);
  const saved = (await library())?.upNext ?? stored;

  // ---- Reorder ----------------------------------------------------------------------------------
  await cardIn(upNext(), 2).dragTo(cardIn(upNext(), 0));
  step(
    "dragging the third card onto the first moves it to the front",
    await until(async () => (await order())[0] === titles[2], 3_000),
    (await order()).join(" / "),
  );
  step(
    "the server holds the new order",
    await until(
      async () => (await library())?.upNext?.join() === [saved[2], saved[0], saved[1]].join(),
      5_000,
    ),
    JSON.stringify((await library())?.upNext),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "tv-up-next-reordered.png"));

  // ---- Another shelf's card joins Up Next where it is dropped -----------------------------------
  // The hero between the shelves keeps them from showing together. A person's drag scrolls at the
  // window's edge; here the mouse drag starts, the shelf is scrolled into view, and the mouse drops.
  const fourth = titles[3];
  const source = cardIn(everyone(), 3);
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 });
  const target = cardIn(upNext(), 1);
  await target.scrollIntoViewIfNeeded();
  const to = await target.boundingBox();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();
  step(
    "a card from another shelf joins Up Next where it is dropped",
    await until(async () => (await order())[1] === fourth, 3_000),
    (await order()).join(" / "),
  );

  // ---- Dropping on the window -------------------------------------------------------------------
  await dropOn(window, { "text/plain": "not a link at all" });
  await window.getByRole("alert").filter({ hasText: "is not one" }).waitFor({ timeout: 3_000 });
  step("text that is no link is refused, saying why", true);
  await dropOn(window, { "text/uri-list": SAMPLE, "text/plain": SAMPLE });
  await window.getByRole("region", { name: "YouTube Link" }).waitFor({ timeout: 5_000 });
  step(
    "a YouTube link dropped on the window opens as a pasted one does",
    (await window.locator('input[type="search"]').inputValue()) === SAMPLE,
  );
  await shot(page, path.join(out, "tv-dropped-link.png"));
  await window.locator('input[type="search"]').fill("");

  // ---- Watch Later ------------------------------------------------------------------------------
  await cardIn(everyone(), 0).click({ button: "right" });
  await page
    .getByRole("menuitem", { name: /^Add to Watch Later|^Remove from Watch Later/ })
    .click();
  await cardIn(everyone(), 1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Play", exact: true }).click();
  await chooseMenu(page, "View", "Library");
  const later = window.getByRole("region", { name: "Watch Later" });
  await later.waitFor({ timeout: 10_000 });
  const history = window.getByRole("region", { name: "History" });
  const before = (await library())?.watchLater ?? [];
  await cardIn(history, 0).dragTo(later.getByRole("heading", { name: "Watch Later" }));
  step(
    "a card dragged to Watch Later joins it on the server",
    await until(
      async () => ((await library())?.watchLater ?? []).length === before.length + 1,
      5_000,
    ),
    JSON.stringify((await library())?.watchLater),
  );

  // ---- All of it survives a reload --------------------------------------------------------------
  const kept = (await library())?.upNext?.join();
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  window = await openTv(page);
  await chooseMenu(page, "View", "Watch Now");
  await upNext().waitFor({ timeout: 10_000 });
  step(
    "Up Next's order is kept after a reload",
    (await library())?.upNext?.join() === kept && (await order())[0] === titles[2],
    (await order()).join(" / "),
  );
});

process.exit(0);
