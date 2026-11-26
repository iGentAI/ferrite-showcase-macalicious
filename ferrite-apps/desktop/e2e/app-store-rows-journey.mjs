#!/usr/bin/env node
// App Store's rows of the inventory that had no picture of their own: the Store menu's Sign In and
// Show Updates, the sidebar's pages, Categories, search, the account page and Purchased, the
// library on the server, Dock and Launchpad following it, Launchpad's delete badge, Open, and the
// Apple menu's App Store….
//
//   node e2e/app-store-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState, until } from "./media-census-kit.mjs";

const LIBRARY = "/api/app-store/library";
const { base, out } = options();
const { step, run } = journey("app-store-rows", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

const settled = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};
const dockItem = (page, name) =>
  page.locator(".mac-dock").getByRole("button", { name: new RegExp(`^${name}$`) });
const installed = async (page) => (await api(page, "GET", LIBRARY)).json.installed ?? [];
const storeOf = (page) => page.getByRole("region", { name: "App Store" }).first();
const pageReady = (store) =>
  store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 30_000 });
const showing = (store, name) =>
  store.getByRole("heading", { level: 1, name, exact: true }).waitFor({ timeout: 15_000 });
const section = (store, name) => store.getByRole("treeitem", { name: new RegExp(name) }).first();

await run(async (page) => {
  await openDesktop(page, base, step);

  // ---- Apple menu > App Store… -----------------------------------------------------------------
  await chooseMenu(page, "Apple", "App Store…");
  const store = storeOf(page);
  await store.waitFor({ state: "visible", timeout: 15_000 });
  await pageReady(store);
  step("Apple menu > App Store… opens the store", await store.isVisible());

  // ---- Discover and the catalogue's sections ----------------------------------------------------
  await section(store, "Discover").click();
  await showing(store, "Discover");
  step(
    "Discover lists apps to get and apps already there",
    (await store.getByRole("button", { name: "Open, Calculator" }).count()) === 1 &&
      (await store.getByRole("button", { name: "Get, Books" }).count()) === 1,
  );
  await settled(page, "app-store-rows-discover.png");
  const counts = {};
  for (const name of ["Create", "Work", "Play", "Develop"]) {
    await section(store, name).click();
    await showing(store, name);
    counts[name] = await store.getByRole("button", { name: /, app page$/ }).count();
    if (name === "Work") await settled(page, "app-store-rows-section.png");
  }
  step(
    "Create, Work, Play and Develop each list their apps",
    Object.values(counts).every((count) => count > 0),
    JSON.stringify(counts),
  );

  // ---- Categories -------------------------------------------------------------------------------
  await section(store, "Categories").click();
  await showing(store, "Categories");
  await settled(page, "app-store-rows-categories.png");
  await store.getByRole("button", { name: /^Productivity/ }).click();
  await showing(store, "Results for “Productivity”");
  step(
    "a category lists its own apps",
    (await store.getByRole("button", { name: /, app page$/ }).count()) > 0,
  );

  // ---- Search in the sidebar --------------------------------------------------------------------
  const field = store.getByRole("searchbox", { name: "Search" });
  await field.fill("Books");
  await showing(store, "Results for “Books”");
  step(
    "the sidebar's search field finds an app by name",
    (await store.getByRole("button", { name: "Get, Books" }).count()) === 1,
  );
  await settled(page, "app-store-rows-search.png");
  await field.fill("zzqqxx");
  await showing(store, "Results for “zzqqxx”");
  step(
    "a search that finds nothing says so",
    await store
      .getByRole("status")
      .filter({ hasText: /No Results/i })
      .first()
      .isVisible(),
  );
  // ---- Edit's rows on the search field, through the menu; a command runs as its menu lets go -----
  const edit = async (row) => {
    await chooseMenu(page, "Edit", row);
    await page.waitForTimeout(450);
  };
  await field.click();
  await edit("Select All");
  await edit("Cut");
  step(
    "Edit > Cut takes the search field's selected text out",
    (await field.inputValue()) === "",
    await field.inputValue(),
  );
  await edit("Paste");
  step(
    "Edit > Paste puts it back",
    (await field.inputValue()) === "zzqqxx",
    await field.inputValue(),
  );
  await store.getByRole("heading", { level: 1 }).first().click();
  const noField = await menuItemState(page, "Edit", "Paste");
  step("with no field in hand Paste is dimmed, saying why", noField.disabled, noField.title);
  await field.fill("");

  // ---- Show Updates -----------------------------------------------------------------------------
  await chooseMenu(page, "Store", "Show Updates");
  await showing(store, "Updates");
  step(
    "Store > Show Updates opens Updates, which says nothing waits",
    /up to date/i.test(await store.locator(".mac-app-store-page").innerText()),
  );
  step(
    "the served store offers no Update All, as nothing is behind",
    (await store.getByRole("button", { name: /Update All/ }).count()) === 0,
  );
  await settled(page, "app-store-rows-updates.png");

  // ---- Get: the library on the server, the Dock and Launchpad follow ----------------------------
  await section(store, "Discover").click();
  await showing(store, "Discover");
  step("Books is not in the Dock before it is got", (await dockItem(page, "Books").count()) === 0);
  await store.getByRole("button", { name: "Get, Books" }).first().click();
  await store.getByRole("button", { name: "Install, Books" }).first().click();
  await store.getByRole("button", { name: "Open, Books" }).first().waitFor({ timeout: 30_000 });
  step(
    "Install keeps the app in the library on the server",
    await until(async () => (await installed(page)).includes("books"), 15_000),
  );
  await dockItem(page, "Books").waitFor({ timeout: 15_000 });
  step("the got app joins the Dock without a reload", true);
  await settled(page, "app-store-rows-got.png");

  // ---- Sign In, the account page, Purchased -----------------------------------------------------
  const signIn = await menuItemState(page, "Store", "Sign In");
  step("Store > Sign In is offered while signed out", !signIn.disabled, JSON.stringify(signIn));
  await chooseMenu(page, "Store", "Sign In");
  await showing(store, "Account");
  step(
    "the account page names the account and lists what it holds",
    (await store.getByText(/^Signed in as /).count()) === 1 &&
      (await store.getByRole("button", { name: "Uninstall Books" }).count()) === 1,
  );
  await settled(page, "app-store-rows-account.png");
  await menuItemState(page, "Store", "View My Account").then((state) =>
    step("once signed in the row says View My Account", !state.disabled, JSON.stringify(state)),
  );
  await section(store, "Work").click();
  await showing(store, "Work");
  await chooseMenu(page, "Store", "View My Account");
  await showing(store, "Account");
  step("Store > View My Account opens the account page", true);
  await section(store, "Work").click();
  await showing(store, "Work");
  await chooseMenu(page, "Store", "Purchased");
  await showing(store, "Account");
  step("Store > Purchased opens the same list", true);
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Store", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Sign Out", exact: true }).waitFor({ timeout: 5_000 });
  await settled(page, "app-store-rows-store-menu.png");
  await closeMenus(page);

  // ---- Over a reload ----------------------------------------------------------------------------
  await reloadDesktop(page);
  await dockItem(page, "Books").waitFor({ timeout: 20_000 });
  step(
    "after a reload the server still holds it, and it is in the Dock",
    (await installed(page)).includes("books"),
  );

  // ---- Launchpad lists it; Open from the store opens it -----------------------------------------
  await page
    .getByRole("button", { name: /^Launchpad$/ })
    .first()
    .click();
  const pad = page.getByRole("dialog", { name: "Launchpad" });
  await pad.waitFor({ state: "visible", timeout: 15_000 });
  await pad.locator('.mac-launchpad-item[data-app="books"]').waitFor({ timeout: 10_000 });
  step("the got app is in Launchpad", true);
  await settled(page, "app-store-rows-launchpad.png");
  await page.keyboard.press("Escape");
  await pad.waitFor({ state: "detached", timeout: 10_000 });

  await launch(page, "App Store");
  await store.waitFor({ state: "visible", timeout: 15_000 });
  await pageReady(store);
  await section(store, "Discover").click();
  await showing(store, "Discover");
  await store.getByRole("button", { name: "Open, Books" }).first().click();
  const books = page.locator('[data-window-id="books"]');
  await books.waitFor({ state: "visible", timeout: 15_000 });
  step("the store's Open opens the installed app", await books.isVisible());
  await settled(page, "app-store-rows-open.png");
  await books.getByRole("button", { name: "Close" }).first().click();
  await books.waitFor({ state: "detached", timeout: 10_000 });

  // ---- Launchpad's delete badge -----------------------------------------------------------------
  await page
    .getByRole("button", { name: /^Launchpad$/ })
    .first()
    .click();
  await pad.waitFor({ state: "visible", timeout: 15_000 });
  await page.keyboard.down("Alt");
  const badge = pad.getByRole("button", { name: "Delete Books" });
  await badge.waitFor({ timeout: 10_000 });
  step(
    "with Option held the got app shows its delete badge, one that came with the desktop none",
    (await pad.getByRole("button", { name: "Delete Calculator" }).count()) === 0,
  );
  await settled(page, "app-store-rows-delete-badge.png");
  // The badge's app jiggles, so it is never still for Playwright's stability wait.
  await badge.click({ force: true });
  await page.keyboard.up("Alt");
  const question = page.getByRole("alertdialog", { name: /Delete “Books”/ });
  await question.waitFor({ timeout: 10_000 });
  await question.getByRole("button", { name: "Delete" }).click();
  step(
    "Delete takes it out of the library on the server",
    await until(async () => !(await installed(page)).includes("books"), 15_000),
  );
  await page.keyboard.press("Escape");
  await dockItem(page, "Books").waitFor({ state: "detached", timeout: 15_000 });
  step("and it leaves the Dock", true);
});

process.exit(0);
