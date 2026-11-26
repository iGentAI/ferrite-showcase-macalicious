#!/usr/bin/env node
// Font Book on Ferrite: open Font Book from the Dock, make a collection with
// the plus under the sidebar and turn off Verdana, each saved through
// /api/font-book/library, reload the page, open Font Book again and find the
// collection and Verdana still off. Exits 0 only when every step passed and
// the page logged no console error, page error, failed request or HTTP error.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/font-book-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop } from "./app-journey.mjs";

const URL = "/api/font-book/library";
const { base, out } = options();
const { step, run } = journey("font-book");

/** The next PUT of the library whose body passes `accept`. */
const nextSave = (page, accept) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new globalThis.URL(response.url()).pathname === URL &&
      accept(JSON.parse(response.request().postData() ?? "null")),
    { timeout: 10_000 },
  );

async function open(page) {
  await launch(page, "Font Book");
  const window = page.getByRole("region", { name: /\(\d+ Fonts?\)$/ }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    () => !document.querySelector(".mac-font-book-body")?.hasAttribute("inert"),
    undefined,
    { timeout: 10_000 },
  );
  return window;
}

/** The row of a family in the font list. */
const fontRow = (window, name) =>
  window
    .getByRole("treegrid", { name: "Fonts" })
    .getByRole("row")
    .filter({ hasText: new RegExp(`${name}$`) })
    .first();

await run(async (page) => {
  await openDesktop(page, base, step);
  await api(page, "DELETE", URL);
  await reloadDesktop(page);

  let window = await open(page);
  step("Font Book opens from the Dock", await window.isVisible());

  const collected = nextSave(page, (body) =>
    body?.collections?.some((collection) => collection.name === "New Collection"),
  );
  await window.getByRole("button", { name: "Add Collection" }).click();
  const first = await collected;
  step("a new collection is saved through PUT /api/font-book/library", first.status() === 200);

  await window.getByRole("treeitem", { name: "Web" }).click();
  await fontRow(window, "Verdana").click();
  const turnedOff = nextSave(page, (body) => body?.disabled?.includes("verdana"));
  await window.getByRole("button", { name: "Disable “Verdana”" }).click();
  const second = await turnedOff;
  step("turning Verdana off is saved", second.status() === 200);

  const stored = await api(page, "GET", URL);
  step(
    "the server holds the collection and Verdana off",
    stored.json.collections?.some((c) => c.name === "New Collection") &&
      stored.json.disabled?.includes("verdana"),
    JSON.stringify({ collections: stored.json.collections, disabled: stored.json.disabled }),
  );

  await reloadDesktop(page);
  window = await open(page);
  const kept = window.getByRole("treeitem", { name: "New Collection" });
  step("after a reload, the collection is in the sidebar", (await kept.count()) === 1);
  await window.getByRole("treeitem", { name: "Web" }).click();
  const verdana = fontRow(window, "Verdana");
  await verdana.click();
  step(
    "and Verdana is still off",
    (await verdana.innerText()).includes("Off"),
    await verdana.innerText(),
  );
  const enable = window.getByRole("button", { name: "Enable “Verdana”" });
  step("with Enable offered for it", (await enable.count()) === 1);
  await page.screenshot({ path: path.join(out, "font-book.png") });

  await api(page, "DELETE", URL);
});
