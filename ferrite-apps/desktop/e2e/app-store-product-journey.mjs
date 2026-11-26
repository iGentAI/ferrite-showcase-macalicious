#!/usr/bin/env node
// App Store: an app's page with the person's own rating, the menu of an app in a list, links to a
// page, dragging an app out, and the last section, each read back from the window or the server.
//
//   node e2e/app-store-product-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { closeMenus, messagesComposerHolds, until } from "./media-census-kit.mjs";

const LIBRARY = "/api/app-store/library";
const SETTINGS = "/api/system-preferences/settings";
const { base, out } = options();
const { step, run } = journey("app-store-product", { ignoreOtherOrigins: true });

async function openStore(page) {
  await launch(page, "App Store");
  const store = page.getByRole("region", { name: "App Store" }).first();
  await store.waitFor({ state: "visible", timeout: 15_000 });
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 15_000 });
  return store;
}

const heading = (store, name) => store.getByRole("heading", { level: 1, name, exact: true });
const rowOf = (store, name) =>
  store.locator(".mac-card-grid-card").filter({
    has: store.page().locator(".mac-card-grid-card-title", { hasText: new RegExp(`^${name}$`) }),
  });

async function rowMenu(page, store, name) {
  await rowOf(store, name).first().locator(".mac-card-grid-card-subtitle").click({
    button: "right",
  });
  const menu = page.getByRole("menu", { name });
  await menu.waitFor({ timeout: 5_000 });
  return menu;
}

await run(async (page) => {
  const url = new URL(base);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: url.origin,
  });
  const linkOf = (id) =>
    page.evaluate((name) => `${location.origin}${location.pathname}#app-store/${name}`, id);
  await openDesktop(page, base, step);
  let store = await openStore(page);
  const section = (name) => store.getByRole("treeitem", { name: new RegExp(name) }).first();

  // ---- The menu of an app in a list -------------------------------------------------------------
  let menu = await rowMenu(page, store, "Calculator");
  step(
    "an app that comes with the desktop offers Open and no Uninstall",
    (await menu.getByRole("menuitem", { name: "Open", exact: true }).count()) === 1 &&
      (await menu.getByRole("menuitem", { name: "Uninstall" }).count()) === 0,
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "app-store-row-menu.png"));
  await closeMenus(page);

  menu = await rowMenu(page, store, "Books");
  await menu.getByRole("menuitem", { name: "Copy Link" }).click();
  const booksLink = await linkOf("books");
  step(
    "Copy Link puts the page's link on the clipboard",
    await until(
      async () => (await page.evaluate(() => navigator.clipboard.readText())) === booksLink,
      5_000,
    ),
    booksLink,
  );

  menu = await rowMenu(page, store, "Books");
  await menu.getByRole("menuitem", { name: "Get", exact: true }).click();
  await store.getByRole("button", { name: "Open, Books" }).first().waitFor({ timeout: 15_000 });
  const got = await api(page, "GET", LIBRARY);
  step(
    "Get in the menu installs the app on the server",
    got.json.installed?.includes("books"),
    JSON.stringify(got.json.installed),
  );

  // ---- Its page ---------------------------------------------------------------------------------
  await rowOf(store, "Books").first().locator(".mac-card-grid-card-title").click();
  await heading(store, "Books").waitFor({ timeout: 5_000 });
  step(
    "pressing an app's name opens its page, saying what is known of it",
    /Entertainment/.test(await store.locator(".mac-app-store-product-facts").innerText()) &&
      /Installed/.test(await store.locator(".mac-app-store-product-facts").innerText()),
  );
  await page.keyboard.press("ControlOrMeta+[");
  await until(async () => (await heading(store, "Books").count()) === 0, 3_000);
  step("Back leaves the page", (await heading(store, "Books").count()) === 0);
  await page.keyboard.press("ControlOrMeta+]");
  await heading(store, "Books").waitFor({ timeout: 3_000 });
  step("Forward returns to it", true);

  const field = store.getByRole("searchbox", { name: "Search" });
  await field.fill("calc");
  await store.getByRole("heading", { level: 1, name: /Results for/ }).waitFor({ timeout: 3_000 });
  await field.fill("");
  await heading(store, "Books").waitFor({ timeout: 3_000 });
  step("clearing a search typed over the page returns to it", true);

  // ---- The person's own rating ------------------------------------------------------------------
  const note = store.locator(".mac-app-store-product-note");
  step("a new person has not rated it", /not rated/.test(await note.innerText()));
  const save = store.getByRole("button", { name: "Save Review" });
  step("a review waits for a rating", await save.isDisabled());
  const stars = store.getByRole("slider", { name: "Your rating" });
  await stars.focus();
  for (let at = 0; at < 4; at += 1) await page.keyboard.press("ArrowRight");
  step(
    "the stars set the rating",
    await until(async () => /rated this app 4 of 5/.test(await note.innerText()), 3_000),
    await note.innerText(),
  );
  await store.getByRole("textbox", { name: "Your review" }).fill("Reads well at night");
  await save.click();
  const kept = () => api(page, "GET", SETTINGS);
  step(
    "the server keeps the rating and the review",
    await until(async () => {
      const { json } = await kept();
      const rating = (json.values ?? json.settings ?? json)["app-store.ratings"]?.books;
      return rating?.stars === 4 && rating?.review === "Reads well at night";
    }, 5_000),
    JSON.stringify((await kept()).json).slice(0, 200),
  );
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "app-store-product.png"));

  // ---- Share, through the real Messages ---------------------------------------------------------
  await store.getByRole("button", { name: "Share" }).click();
  await page.getByRole("menuitem", { name: /^Messages/ }).click();
  step(
    "Share > Messages puts the link in a new message",
    await messagesComposerHolds(page, booksLink),
  );
  await launch(page, "App Store");

  // ---- Dragging an app out ----------------------------------------------------------------------
  await section("Discover").click();
  await field.waitFor();
  await rowOf(store, "Calculator").first().locator(".mac-card-grid-card-subtitle").dragTo(field);
  step(
    "an app dragged into a text field drops its link",
    await until(async () => (await field.inputValue()).includes("#app-store/calculator"), 3_000),
    await field.inputValue(),
  );
  await field.fill("");

  // ---- The last section survives a reload, and so does the rating -------------------------------
  await section("Work").click();
  await heading(store, "Work").waitFor({ timeout: 3_000 });
  await page.waitForTimeout(1_000);
  await reloadDesktop(page);
  store = await openStore(page);
  step(
    "the store opens on the last section after a reload",
    await until(async () => (await heading(store, "Work").count()) === 1, 5_000),
  );

  // ---- A link opens the page --------------------------------------------------------------------
  await launch(page, "Calculator");
  step(
    "another app's window comes in front of the store",
    await until(async () => (await store.getAttribute("data-window-state")) !== "key", 5_000),
  );
  await page.evaluate(() => {
    location.hash = "#app-store/books";
  });
  await heading(store, "Books").waitFor({ timeout: 5_000 });
  step(
    "a link followed while the store is behind another window shows the page and leaves the address",
    await until(async () => (await page.evaluate(() => location.hash)) === "", 3_000),
  );
  step(
    "the link brings the store to the front",
    await until(async () => (await store.getAttribute("data-window-state")) === "key", 3_000),
    await store.getAttribute("data-window-state"),
  );
  step(
    "the rating and review were kept",
    /rated this app 4 of 5/.test(await store.locator(".mac-app-store-product-note").innerText()) &&
      (await store.getByRole("textbox", { name: "Your review" }).inputValue()) ===
        "Reads well at night",
  );
  await page.evaluate(() => {
    history.replaceState(history.state, "", `${location.pathname}#app-store/calculator`);
  });
  await reloadDesktop(page);
  store = page.getByRole("region", { name: "App Store" }).first();
  await heading(store, "Calculator").waitFor({ timeout: 15_000 });
  step("a link opens the store on the page when the desktop opens", true);

  // ---- Clear, and Uninstall from the menu -------------------------------------------------------
  await store
    .getByRole("treeitem", { name: /Discover/ })
    .first()
    .click();
  await heading(store, "Discover").waitFor({ timeout: 3_000 });
  menu = await rowMenu(page, store, "Books");
  await menu.getByRole("menuitem", { name: "Uninstall" }).click();
  await store.getByRole("button", { name: "Get, Books" }).first().waitFor({ timeout: 10_000 });
  const left = await api(page, "GET", LIBRARY);
  step(
    "Uninstall in the menu takes it out of the server's library",
    !(left.json.installed ?? []).includes("books"),
    JSON.stringify(left.json.installed),
  );
});

process.exit(0);
