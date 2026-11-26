#!/usr/bin/env node
// Launchpad on Ferrite: Launchpad lists the apps of the server's catalogue the
// session has (GET /api/apps), over more than one page once the session has got
// the App Store's apps, an app dragged onto another takes its place and
// turning the page is saved through /api/launchpad/layout, and after a reload
// Launchpad opens on the same page with the same order. Exits 0 only when every
// step passed and the page logged no console error, page error, failed request
// or HTTP error.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/launchpad-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const LAYOUT = "/api/launchpad/layout";
const LIBRARY = "/api/app-store/library";
/** Apps of the App Store the journey leaves out, to check Launchpad lists only what was got. */
const NOT_GOT = ["automator", "voice-memos"];
/** Launchpad's page: 7 columns by 5 rows (`demos/launchpad/launchpad-data.ts`). */
const PER_PAGE = 35;
const { base, out } = options();
const { step, run } = journey("launchpad");

/** The next PUT of the layout whose body passes `accept`. */
const nextSave = (page, accept) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === LAYOUT &&
      accept(JSON.parse(response.request().postData() ?? "null")),
    { timeout: 10_000 },
  );

async function openLaunchpad(page) {
  await page
    .getByRole("button", { name: /^Launchpad$/ })
    .first()
    .click();
  const overlay = page.getByRole("dialog", { name: "Launchpad" });
  await overlay.waitFor({ state: "visible", timeout: 10_000 });
  await overlay.locator(".mac-launchpad-item").first().waitFor({ timeout: 10_000 });
  return overlay;
}

/** The ids of the apps on the page Launchpad shows. */
const shownIds = (overlay) =>
  overlay
    .locator(".mac-launchpad-item")
    .evaluateAll((items) => items.map((item) => item.dataset.app));

await run(async (page) => {
  await openDesktop(page, base, step);
  await api(page, "DELETE", LAYOUT);
  // Get every App Store app but NOT_GOT, so that Launchpad fills more than one page: the
  // preinstalled apps alone fit on one.
  const registry = await api(page, "GET", "/api/apps");
  const catalogue = registry.json.catalogue ?? [];
  const got = catalogue
    .filter((app) => !app.preinstalled && !NOT_GOT.includes(app.id))
    .map((app) => app.id);
  const library = await api(page, "GET", LIBRARY);
  await api(page, "PUT", LIBRARY, { installed: got, rev: library.json.rev });
  await reloadDesktop(page);

  const expected = catalogue
    .filter((app) => app.preinstalled || got.includes(app.id))
    .map((app) => app.id);
  const pages = Math.ceil(expected.length / PER_PAGE);
  step(
    "the server's registry answers the catalogue, enough for more than one page",
    catalogue.length > 0 && pages >= 2,
    `${catalogue.length} apps, ${expected.length} for this session on ${pages} pages`,
  );
  const pageButton = (n) => `Page ${n} of ${pages}`;

  let overlay = await openLaunchpad(page);
  const listed = [];
  const firstPage = await shownIds(overlay);
  listed.push(...firstPage);
  for (let n = 2; n <= pages; n++) {
    await overlay.getByRole("button", { name: pageButton(n) }).click();
    listed.push(...(await shownIds(overlay)));
  }
  step(
    `Launchpad lists the session's apps of the catalogue on ${pages} pages`,
    listed.length === expected.length && expected.every((id) => listed.includes(id)),
    `${listed.length} of ${expected.length}, ${firstPage.length} on page 1`,
  );
  step(
    "and no app the session has not got",
    NOT_GOT.every((id) => !listed.includes(id)),
  );

  // Back to page 1: drag Calculator onto the first app.
  const pageSaved = nextSave(page, (body) => body?.page === 0);
  await overlay.getByRole("button", { name: pageButton(1) }).click();
  await pageSaved;
  const first = firstPage[0];
  const moved = nextSave(page, (body) => body?.order?.[0] === "calculator");
  await overlay
    .locator('.mac-launchpad-item[data-app="calculator"]')
    // On the side of the tile: its middle would make a folder.
    .dragTo(overlay.locator(`.mac-launchpad-item[data-app="${first}"]`), {
      targetPosition: { x: 6, y: 30 },
    });
  const movedReply = await moved;
  step(
    "dragging Calculator to the front is saved through PUT /api/launchpad/layout",
    movedReply.status() === 200,
  );
  step("and Calculator is first on the page", (await shownIds(overlay))[0] === "calculator");

  const turned = nextSave(page, (body) => body?.page === 1);
  await overlay.getByRole("button", { name: pageButton(2) }).click();
  step("turning to page 2 is saved", (await turned).status() === 200);
  const stored = await api(page, "GET", LAYOUT);
  step(
    "the server holds the order and the page",
    stored.json.page === 1 && stored.json.order?.[0] === "calculator",
    JSON.stringify({ page: stored.json.page, first: stored.json.order?.[0] }),
  );
  await page.keyboard.press("Escape");

  await reloadDesktop(page);
  overlay = await openLaunchpad(page);
  const current = overlay.getByRole("button", { name: pageButton(2) });
  step(
    "after a reload Launchpad opens on page 2",
    (await current.getAttribute("aria-current")) === "page",
  );
  await shot(page, path.join(out, "launchpad.png"));
  // Turning back saves the page too: wait for that save, so the clean-up below does not race it.
  const backSaved = nextSave(page, (body) => body?.page === 0);
  await overlay.getByRole("button", { name: pageButton(1) }).click();
  step("and Calculator is still first", (await shownIds(overlay))[0] === "calculator");
  step("turning back to page 1 is saved", (await backSaved).status() === 200);
  await page.keyboard.press("Escape");

  await api(page, "DELETE", LAYOUT);
  await api(page, "DELETE", LIBRARY);
});
