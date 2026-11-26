#!/usr/bin/env node
// App Store's page history and Store menu on Ferrite, each read back from the window or the server.
//
//   node e2e/app-store-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState } from "./media-census-kit.mjs";

const LIBRARY = "/api/app-store/library";
const { base, out } = options();
const { step, run, expectRefusal, expectConsole } = journey("app-store-depth", {
  ignoreOtherOrigins: true,
});
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

/** Adds or takes out Books on the server, as another browser would, leaving every other app alone. */
async function setBooks(page, wanted) {
  const { status, json } = await api(page, "GET", LIBRARY);
  if (status !== 200 || !(json.installed === null || Array.isArray(json.installed))) {
    throw new Error(`the library could not be read: HTTP ${status}`);
  }
  const others = (json.installed ?? []).filter((id) => id !== "books");
  return api(page, "PUT", LIBRARY, {
    installed: wanted ? [...others, "books"] : others,
    rev: json.rev,
  });
}

async function walk(page) {
  await launch(page, "App Store");
  const store = page.getByRole("region", { name: "App Store" }).first();
  await store.waitFor({ state: "visible", timeout: 15_000 });
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 15_000 });
  const title = () => store.locator("h1").first().innerText();
  const showing = (name) =>
    store.getByRole("heading", { level: 1, name, exact: true }).waitFor({ timeout: 5_000 });
  const section = (name) => store.getByRole("treeitem", { name: new RegExp(name) }).first();
  const field = store.getByRole("searchbox", { name: "Search" });
  const key = async (keys) => {
    await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);
    await page.keyboard.press(keys);
  };

  // ---- Back and Forward -------------------------------------------------------------------------
  const back = await menuItemState(page, "Store", "Back");
  step("on the first page Back is dimmed", back.disabled === true, JSON.stringify(back));
  await section("Work").click();
  await showing("Work");
  await section("Play").click();
  await showing("Play");
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Store", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /^Back/ }).first().waitFor();
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "app-store-store-menu.png"));
  await closeMenus(page);
  await chooseMenu(page, "Store", "Back");
  await showing("Work");
  step("Store > Back shows the page before", (await title()) === "Work");
  await chooseMenu(page, "Store", "Forward");
  await showing("Play");
  step("Store > Forward shows the page after", (await title()) === "Play");
  await key(`${COMMAND}+[`);
  await showing("Work");
  step("Command-[ goes back", (await title()) === "Work");
  await key(`${COMMAND}+]`);
  await showing("Play");
  step("Command-] goes forward", (await title()) === "Play");
  await store.locator(".mac-app-store-title").click();
  await key(`${COMMAND}+[`);
  await showing("Work");
  step("the keys work after a click on the page itself", (await title()) === "Work");

  // ---- Search -----------------------------------------------------------------------------------
  await key(`${COMMAND}+f`);
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Search");
  step("Command-F puts the keyboard in the search field", true);
  await page.keyboard.type("Books");
  await showing("Results for “Books”");
  step(
    "what is typed there searches",
    (await store.getByRole("button", { name: "Get, Books" }).count()) === 1,
  );
  await key(`${COMMAND}+[`);
  await showing("Work");
  step("a typed search is one page: Back leaves it at once", (await field.inputValue()) === "");
  await key(`${COMMAND}+]`);
  await showing("Results for “Books”");
  step("Forward brings the search back", (await field.inputValue()) === "Books");
  await section("Discover").click();
  await showing("Discover");
  await chooseMenu(page, "Edit", "Find");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Search");
  step("Edit > Find puts the keyboard in the field", true);
  await section("Work").click();
  await showing("Work");
  await chooseMenu(page, "Store", "Search");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Search");
  step("Store > Search does too", true);

  // ---- A page comes back where it was left ------------------------------------------------------
  await section("Categories").click();
  await showing("Categories");
  await store.getByRole("button", { name: /^Productivity/ }).click();
  await showing("Results for “Productivity”");
  await section("Discover").click();
  await showing("Discover");
  const scrolled = () =>
    store.locator(".mac-app-store-page").evaluate((element) => {
      let node = element.parentElement;
      while (node && node.scrollHeight <= node.clientHeight) node = node.parentElement;
      return node ? node.scrollTop : 0;
    });
  const box = await store.locator(".mac-app-store-page").boundingBox();
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.wheel(0, 200);
  await page.waitForFunction(() => document.querySelector(".mac-app-store-page") !== null);
  await page.waitForTimeout(300);
  const left = await scrolled();
  step("Discover scrolls", left > 0, String(left));
  await field.fill("Books");
  await showing("Results for “Books”");
  await field.fill("");
  await showing("Discover");
  step("clearing a search returns to the page as it was scrolled", (await scrolled()) === left);
  await section("Work").click();
  await showing("Work");
  step("a new page starts at the top", (await scrolled()) === 0);
  await key(`${COMMAND}+[`);
  await showing("Discover");
  step("Back returns to the page as it was scrolled", (await scrolled()) === left);
  await chooseMenu(page, "Store", "Sign In");
  await showing("Account");
  await chooseMenu(page, "Store", "Sign Out");
  await showing("Discover");
  step("signing out returns to the page as it was scrolled", (await scrolled()) === left);
  await field.fill("Books");
  await showing("Results for “Books”");
  await chooseMenu(page, "Store", "Sign In");
  await showing("Account");
  await chooseMenu(page, "Store", "Sign Out");
  await page.waitForFunction(() => document.querySelector('[role="menu"]') === null);
  await showing("Results for “Books”");
  step(
    "signing out from over a search returns to its results",
    (await field.inputValue()) === "Books",
  );
  const ahead = await menuItemState(page, "Store", "Forward");
  step("and adds no page to the history", ahead.disabled === true, JSON.stringify(ahead));
  await section("Discover").click();
  await showing("Discover");

  // ---- Reload Page ------------------------------------------------------------------------------
  await store.getByRole("button", { name: "Get, Books" }).waitFor({ timeout: 5_000 });
  const put = await setBooks(page, true);
  step("another browser's Get reaches the server", put.status === 200, `HTTP ${put.status}`);
  const read = page.waitForRequest(
    (request) => request.method() === "GET" && new URL(request.url()).pathname === LIBRARY,
    { timeout: 5_000 },
  );
  await key(`${COMMAND}+r`);
  await read;
  await store.getByRole("button", { name: "Open, Books" }).waitFor({ timeout: 5_000 });
  step(
    "Command-R reads the library again and the page follows, without leaving the desktop",
    await store.isVisible(),
  );
  const removed = await setBooks(page, false);
  step("Books is taken out again", removed.status < 300, `HTTP ${removed.status}`);
  await chooseMenu(page, "Store", "Reload Page");
  await store.getByRole("button", { name: "Get, Books" }).waitFor({ timeout: 5_000 });
  step("Store > Reload Page does the same", true);

  // ---- Check for Updates -----------------------------------------------------------------------
  const asked = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/apps", {
    timeout: 5_000,
  });
  await chooseMenu(page, "Store", "Check for Updates");
  await asked;
  await showing("Updates");
  await store.getByText(/Every app is up to date\. Last checked at /).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "app-store-updates-checked.png"));
  step("Check for Updates asks the server, shows Updates and says when it looked", true);
  const again = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/apps", {
    timeout: 5_000,
  });
  await key(`${COMMAND}+r`);
  await again;
  step("on Updates, Command-R checks for updates", true);

  // ---- Sign Out and the dimmed rows ------------------------------------------------------------
  const signedOut = await menuItemState(page, "Store", "Sign Out");
  step(
    "before signing in Sign Out is dimmed, saying why",
    signedOut.disabled === true && /not signed in/.test(signedOut.title ?? ""),
    JSON.stringify(signedOut),
  );
  await chooseMenu(page, "Store", "Sign In");
  await showing("Account");
  await chooseMenu(page, "Store", "Sign Out");
  await store
    .getByRole("heading", { level: 1, name: "Account" })
    .waitFor({ state: "detached", timeout: 5_000 });
  await store.getByText("Sign In", { exact: true }).waitFor({ timeout: 5_000 });
  step("Store > Sign Out leaves the account page and signs out", true);
  await key(`${COMMAND}+[`);
  await page.waitForTimeout(200);
  step(
    "and Back does not lead to the account page",
    (await store.getByRole("heading", { level: 1, name: "Account" }).count()) === 0,
  );
  await chooseMenu(page, "Store", "Purchased");
  await showing("Account");
  step("Store > Purchased opens the account's Purchased page", true);
  const hidden = store.getByRole("button", { name: "Hidden Purchases" });
  const gift = store.getByRole("button", { name: "Send Gift" });
  step(
    "Hidden Purchases and Send Gift are dimmed, saying why",
    (await hidden.isDisabled()) &&
      (await gift.isDisabled()) &&
      /hidden purchases/.test((await hidden.getAttribute("title")) ?? "") &&
      /to give/.test((await gift.getAttribute("title")) ?? ""),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "app-store-dimmed.png"));
  const arcade = section("Arcade");
  step(
    "Arcade is dimmed, saying why",
    (await arcade.getAttribute("aria-disabled")) === "true" &&
      /subscription/.test((await arcade.getAttribute("title")) ?? ""),
  );
  const redeem = await menuItemState(page, "Store", "Redeem…");
  step(
    "Redeem is dimmed, saying why",
    redeem.disabled === true && /redeem/.test(redeem.title ?? ""),
    JSON.stringify(redeem),
  );
  for (const name of ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"]) {
    const row = await menuItemState(page, "Edit", name);
    step(
      `Edit > ${name} is dimmed, saying why`,
      row.disabled === true && /search field/.test(row.title ?? ""),
      JSON.stringify(row),
    );
  }
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Edit", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /^Find/ }).first().waitFor();
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "app-store-edit-menu.png"));
  await closeMenus(page);
  await chooseMenu(page, "Help", "App Store Help");
  await page.locator('[data-window-id="help-viewer"]').first().waitFor({ timeout: 5_000 });
  step("Help > App Store Help opens Help Viewer", true);
}

/**
 * A save refused here, then another browser of the same session installing the app: this window's
 * Retry follows the library by itself. Only the first save is refused; Retry is never pressed.
 */
async function installedElsewhere(page) {
  const store = page.getByRole("region", { name: "App Store" }).first();
  await store
    .getByRole("treeitem", { name: /Discover/ })
    .first()
    .click();
  // The save tries more than once before it gives up.
  for (let refusal = 0; refusal < 6; refusal += 1) expectRefusal(503, LIBRARY);
  await page.route(`**${LIBRARY}*`, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" })
      : route.fallback(),
  );
  expectConsole("could not save");
  await store.getByRole("button", { name: "Get, Books" }).click();
  await store.getByRole("button", { name: "Install, Books" }).click();
  const retry = store.getByRole("button", { name: "Retry installing Books" });
  await retry.waitFor({ timeout: 20_000 });
  step("a refused save shows Retry", true);
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "app-store-retry.png"));

  const context = await page
    .context()
    .browser()
    .newContext({ storageState: await page.context().storageState() });
  const other = await context.newPage();
  await other.goto(base);
  const saved = await setBooks(other, true);
  step("another browser installs Books", saved.status === 200, `HTTP ${saved.status}`);
  await context.close();

  await page.unroute(`**${LIBRARY}*`);
  await store.getByRole("button", { name: "Open, Books" }).waitFor({ timeout: 30_000 });
  step("this window's Retry becomes Open, unpressed", (await retry.count()) === 0);
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "app-store-follows-library.png"));
  const left = await setBooks(page, false);
  step("Books is taken out again", left.status === 200, `HTTP ${left.status}`);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const start = await api(page, "GET", LIBRARY);
  const held = start.json?.installed;
  // The journey's browser context starts a new session; a session holding Books is someone's.
  if (start.status !== 200 || !(held === null || Array.isArray(held)) || held?.includes("books")) {
    throw new Error(`refusing a session whose library is not free of Books: HTTP ${start.status}`);
  }
  await walk(page);
  await installedElsewhere(page);
});

process.exit(0);
