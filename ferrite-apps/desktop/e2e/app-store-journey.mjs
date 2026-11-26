#!/usr/bin/env node
// App Store on Ferrite: the store sells the Macalicious apps of the server's
// catalogue; Get, Install and the download put Books in the person's library
// (PUT /api/app-store/library), the Dock and Launchpad; after a reload Books is
// still in the Dock and the store offers Open, which opens it. Once Books is
// quit (an open app stays in the Dock, as on macOS), Uninstall on the account
// page takes it out of the library, the Dock and Launchpad, and the store
// offers Get again. Got once more, Books is deleted from Launchpad: with Option
// held it shows its delete badge, and Delete in the question takes it out of the
// library while Launchpad stays open. Exits 0 only when every step passed and
// the page logged no console error, page error, failed request or HTTP error.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/app-store-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                  [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const LIBRARY = "/api/app-store/library";
const { base, out } = options();
const { step, run } = journey("app-store");

const dockItem = (page, name) =>
  page.locator(".mac-dock").getByRole("button", { name: new RegExp(`^${name}$`) });

async function openStore(page) {
  await launch(page, "App Store");
  const store = page.getByRole("region", { name: "App Store" }).first();
  await store.waitFor({ state: "visible", timeout: 10_000 });
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 10_000 });
  return store;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await api(page, "DELETE", LIBRARY);
  await reloadDesktop(page);
  await dockItem(page, "Calculator").waitFor({ timeout: 10_000 });
  step("Books is not in the Dock before it is got", (await dockItem(page, "Books").count()) === 0);

  let store = await openStore(page);
  step(
    "the store lists the Macalicious apps",
    (await store.getByRole("heading", { name: "Get More Apps" }).count()) === 1 &&
      (await store.getByRole("button", { name: "Open, Calculator" }).count()) === 1,
  );
  await store.getByRole("button", { name: "Get, Books" }).click();
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === LIBRARY &&
      JSON.parse(response.request().postData() ?? "null")?.installed?.includes("books"),
    { timeout: 15_000 },
  );
  await store.getByRole("button", { name: "Install, Books" }).click();
  step(
    "Install downloads Books and saves it through PUT /api/app-store/library",
    (await saved).status() === 200,
  );
  await store.getByRole("button", { name: "Open, Books" }).waitFor({ timeout: 10_000 });
  await dockItem(page, "Books").waitFor({ timeout: 10_000 });
  step("Books joins the Dock", (await dockItem(page, "Books").count()) === 1);
  const stored = await api(page, "GET", LIBRARY);
  step(
    "the server holds it",
    stored.json.installed?.includes("books"),
    JSON.stringify(stored.json.installed),
  );
  await shot(page, path.join(out, "app-store.png"));

  await reloadDesktop(page);
  await dockItem(page, "Books").waitFor({ timeout: 10_000 });
  step("after a reload Books is still in the Dock", (await dockItem(page, "Books").count()) === 1);
  await page
    .getByRole("button", { name: /^Launchpad$/ })
    .first()
    .click();
  const overlay = page.getByRole("dialog", { name: "Launchpad" });
  await overlay.waitFor({ state: "visible", timeout: 10_000 });
  await overlay.getByRole("searchbox", { name: "Search" }).fill("Books");
  step(
    "and in Launchpad",
    (await overlay.locator('.mac-launchpad-item[data-app="books"]').count()) === 1,
  );
  await page.keyboard.press("Escape");

  store = await openStore(page);
  await store.getByRole("button", { name: "Open, Books" }).click();
  const books = page.locator('[data-window-id="books"]');
  await books.waitFor({ state: "visible", timeout: 10_000 });
  step("the store offers Open, which opens Books", await books.isVisible());
  await books.getByRole("button", { name: "Close" }).first().click();
  await books.waitFor({ state: "detached", timeout: 10_000 });

  // Uninstall from the account page.
  store = await openStore(page);
  await store
    .getByRole("button", { name: /Sign In|Journey|Account/ })
    .last()
    .click();
  const removed = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === LIBRARY &&
      !JSON.parse(response.request().postData() ?? "null")?.installed?.includes("books"),
    { timeout: 15_000 },
  );
  await store.getByRole("button", { name: "Uninstall Books" }).click();
  step("Uninstall saves the library without Books", (await removed).status() === 200);
  await dockItem(page, "Books").waitFor({ state: "detached", timeout: 10_000 });
  step("Books leaves the Dock", (await dockItem(page, "Books").count()) === 0);
  await store
    .getByRole("treeitem", { name: /Discover/ })
    .first()
    .click();
  await store.getByRole("button", { name: "Get, Books" }).waitFor({ timeout: 10_000 });
  step("and the store offers Get again", true);
  const after = await api(page, "GET", LIBRARY);
  step(
    "the library read succeeds",
    after.status === 200 && Array.isArray(after.json?.installed),
    `HTTP ${after.status}`,
  );
  step("the server no longer holds it", !after.json?.installed?.includes("books"));

  // Get it again, then delete it from Launchpad.
  await store.getByRole("button", { name: "Get, Books" }).click();
  await store.getByRole("button", { name: "Install, Books" }).click();
  await store.getByRole("button", { name: "Open, Books" }).waitFor({ timeout: 15_000 });
  await dockItem(page, "Books").waitFor({ timeout: 10_000 });
  await page
    .getByRole("button", { name: /^Launchpad$/ })
    .first()
    .click();
  const pad = page.getByRole("dialog", { name: "Launchpad" });
  await pad.waitFor({ state: "visible", timeout: 10_000 });
  await page.keyboard.down("Alt");
  const badge = pad.getByRole("button", { name: "Delete Books" });
  await badge.waitFor({ timeout: 10_000 });
  step(
    "with Option held, Books shows its delete badge and Calculator does not",
    (await pad.getByRole("button", { name: "Delete Calculator" }).count()) === 0,
  );
  // The badge's app jiggles, so it is never still for Playwright's stability wait.
  await badge.click({ force: true });
  await page.keyboard.up("Alt");
  const question = page.getByRole("alertdialog", { name: /Delete “Books”/ });
  await question.waitFor({ timeout: 10_000 });
  // The question is modal: Launchpad behind it is hidden from the accessibility tree, not closed.
  step(
    "Launchpad asks before it deletes, and stays open",
    await page.locator(".mac-launchpad").first().isVisible(),
  );
  const deleted = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === LIBRARY &&
      !JSON.parse(response.request().postData() ?? "null")?.installed?.includes("books"),
    { timeout: 15_000 },
  );
  await question.getByRole("button", { name: "Delete" }).click();
  step("Delete saves the library without Books", (await deleted).status() === 200);
  await pad.locator('.mac-launchpad-item[data-app="books"]').waitFor({
    state: "detached",
    timeout: 10_000,
  });
  step(
    "and Books leaves Launchpad, which stays open",
    await page.locator(".mac-launchpad").first().isVisible(),
  );
  await page.keyboard.press("Escape");
  await dockItem(page, "Books").waitFor({ state: "detached", timeout: 10_000 });
  step("and the Dock", (await dockItem(page, "Books").count()) === 0);

  await api(page, "DELETE", LIBRARY);
});
