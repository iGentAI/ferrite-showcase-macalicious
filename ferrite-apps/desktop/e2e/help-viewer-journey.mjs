#!/usr/bin/env node
// Help Viewer on Ferrite: open Help Viewer from the Dock, find the server's
// help book in the table of contents, search for "font book" and see the
// server's result (GET /api/help-viewer/search) listed first, open it, reload
// the page and find Help Viewer open again on that page, kept in the session
// through /api/help-viewer/place. Exits 0 only when every step passed and the
// page logged no console error, page error, failed request or HTTP error.
//
//   ferrite dev                                          # in ferrite-apps/desktop
//   node e2e/help-viewer-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop } from "./app-journey.mjs";

const PLACE = "/api/help-viewer/place";
const TOPIC = "Collections and disabled fonts in Font Book";
const { base, out } = options();
const { step, run } = journey("help-viewer");

async function open(page) {
  await launch(page, "Help Viewer");
  const window = page.locator('.mac-managed-window[data-window-id="help-viewer"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    () => !document.querySelector(".mac-help-viewer-body")?.hasAttribute("inert"),
    undefined,
    { timeout: 10_000 },
  );
  return window;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await api(page, "DELETE", PLACE);
  await reloadDesktop(page);

  const booksLoaded = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/help-viewer/books",
    { timeout: 10_000 },
  );
  let window = await open(page);
  step("Help Viewer opens from the Dock", await window.isVisible());
  step("its help books are served by the app", (await booksLoaded).status() === 200);
  const book = window
    .getByRole("treegrid", { name: "Table of Contents" })
    .getByText("Macalicious Desktop Help");
  await book.waitFor({ timeout: 10_000 });
  step("the server's book is in the table of contents", await book.isVisible());

  const searched = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/help-viewer/search" &&
      new URL(response.url()).searchParams.get("q") === "font book",
    { timeout: 10_000 },
  );
  await window.getByRole("searchbox").fill("font book");
  const answer = await searched;
  const body = await answer.json();
  step(
    "the search queries the server's index",
    answer.status() === 200 && body.results?.[0]?.title === TOPIC,
    `${body.results?.length} result(s)`,
  );
  const result = window.getByRole("link", { name: new RegExp(TOPIC) });
  await result.waitFor({ timeout: 10_000 });
  const firstLink = window.locator(".mac-help-viewer-result").first();
  step(
    "the server's result is listed first",
    (await firstLink.innerText()).includes(TOPIC),
    (await firstLink.innerText()).split("\n")[0],
  );
  await page.screenshot({ path: path.join(out, "help-viewer-search.png") });

  const kept = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" && new URL(response.url()).pathname === PLACE,
    { timeout: 10_000 },
  );
  await result.click();
  const heading = window.getByRole("heading", { level: 1, name: TOPIC });
  await heading.waitFor({ timeout: 5_000 });
  step("the server's topic opens", await heading.isVisible());
  step("the page read is kept through PUT /api/help-viewer/place", (await kept).status() === 200);

  await reloadDesktop(page);
  window = await open(page);
  const again = window.getByRole("heading", { level: 1, name: TOPIC });
  await again.waitFor({ timeout: 10_000 });
  step("after a reload, Help Viewer opens on that page", await again.isVisible());
  await page.screenshot({ path: path.join(out, "help-viewer.png") });

  await api(page, "DELETE", PLACE);
});
