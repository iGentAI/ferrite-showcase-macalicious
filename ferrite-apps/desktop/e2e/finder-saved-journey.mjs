#!/usr/bin/env node
// Finder's saved state, on the signed-in person's drive: tabs, a folder's view and sort, the bars and a
// saved search are all there after a reload, and were read back from the person's settings on the
// server. A folder gone meanwhile leaves its tab on the home folder.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-saved-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-saved");
const tag = Date.now().toString(36);
const GONE = `Gone ${tag}`;

const bar = (page) => page.getByRole("menubar").first();
const settings = async (page) =>
  (await api(page, "GET", "/api/system-preferences/settings")).json?.values ?? {};

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const menusClosed = (page) =>
  until(async () => (await page.getByRole("menu").count()) === 0, 3_000);

async function choose(page, title, item, role = "menuitem") {
  await bar(page).getByRole("menuitem", { name: title, exact: true }).click();
  await page.getByRole("menu").getByRole(role, { name: item, exact: true }).click();
  await menusClosed(page);
}

const openFinder = async (page) => {
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  return win;
};

await run(async (page) => {
  await openDesktop(page, base, step);
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "movies", name: GONE }],
  });
  let win = await openFinder(page);
  const title = async () =>
    (await win
      .locator('[role="listbox"], [role="treegrid"], [role="grid"]')
      .first()
      .getAttribute("aria-label")) ?? "";

  // Downloads in a list sorted by Kind, then Documents in a new tab.
  await choose(page, "Go", "Downloads");
  await until(async () => (await title()) === "Downloads");
  await choose(page, "View", "as List", "menuitemradio");
  await win.getByRole("treegrid").waitFor({ timeout: 5_000 });
  await bar(page).getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sort By", exact: true }).hover();
  await page.getByRole("menuitemradio", { name: "Kind", exact: true }).click();
  await menusClosed(page);
  await choose(page, "File", "New Tab");
  await win.getByRole("tab").nth(1).waitFor({ timeout: 5_000 });
  await choose(page, "Go", "Documents");
  await until(async () => (await title()) === "Documents");
  await choose(page, "View", "as Icons", "menuitemradio");
  step(
    "Each folder keeps its own view: Downloads stays a list, on the server",
    await until(async () => {
      const folders = (await settings(page))["finder.folders"] ?? {};
      return folders.downloads?.view === "list" && folders.downloads?.sort?.column === "kind";
    }),
  );
  await choose(page, "View", "Status Bar", "menuitemcheckbox");
  await choose(page, "View", "Path Bar", "menuitemcheckbox");

  // A saved search, from the search field's scope bar.
  const saveSearch = async (name) => {
    await win.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("textbox", { name: "Save As:" }).fill(name);
    await page.getByRole("button", { name: "Save", exact: true }).last().click();
  };
  const SAVED = `Saved ${tag}`;
  const search = win.locator(".mac-finder-search input").first();
  await search.fill(`query${tag}`);
  // The suggestions drop down over the scope bar until Escape puts them away.
  await search.press("Escape");
  await saveSearch(SAVED);
  const row = win.getByRole("treeitem", { name: SAVED, exact: true });
  await row.waitFor({ timeout: 5_000 });
  await search.fill("x".repeat(4_000));
  await saveSearch(`Long ${tag}`);
  const refusal = page.getByRole("alertdialog");
  const refused = await refusal.waitFor({ timeout: 5_000 }).then(
    () => true,
    () => false,
  );
  step(
    "A search that would not fit is refused in words",
    refused && (await refusal.getByText("Finder can’t keep this search").count()) === 1,
  );
  await refusal.getByRole("button").first().click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  step("and the saved one stays", (await row.count()) === 1);
  await search.fill("");
  await until(async () => (await title()) === "Documents");

  step(
    "The window's tabs are kept on the server",
    await until(async () => {
      const kept = (await settings(page))["finder.window"];
      return kept?.tabs?.length === 2 && kept.active === 1;
    }),
  );
  step(
    "So are the bars and the search",
    await until(async () => {
      const values = await settings(page);
      return (
        values["finder.statusBar"] === false &&
        values["finder.pathBar"] === false &&
        values["finder.savedSearches"]?.[0]?.query === `query${tag}`
      );
    }),
  );

  // Reload: the Finder window that opens is the same one.
  await page.reload();
  await openDesktop(page, base, step);
  win = await openFinder(page);
  await win.getByRole("tab").nth(1).waitFor({ timeout: 10_000 });
  step("After a reload the two tabs are back", (await win.getByRole("tab").count()) === 2);
  step("on the tab that was shown", await until(async () => (await title()) === "Documents"));
  step(
    "The bars stay hidden",
    (await win.locator(".mac-path-bar").count()) === 0 &&
      (await win.locator(".mac-status-bar").count()) === 0,
  );
  const savedRow = win.getByRole("treeitem", { name: SAVED, exact: true });
  step("The saved search is in the sidebar", (await savedRow.count()) === 1);
  await shot(page, path.join(out, `finder-saved-reload-${browserName}.png`));

  // Another window, untouched, leaves the saved tabs alone, also when its folder's kept view shows by
  // itself; a view changed there reaches this one.
  await choose(page, "Go", "Home");
  await until(async () => (await title()) === "shackett");
  await choose(page, "View", "as Gallery", "menuitemradio");
  await until(
    async () => (await settings(page))["finder.folders"]?.["/Users/shackett"]?.view === "gallery",
  );
  await choose(page, "Go", "Back");
  await until(async () => (await title()) === "Documents");
  await until(async () => (await settings(page))["finder.window"]?.tabs?.[1]?.view === "icons");
  const keptBefore = JSON.stringify((await settings(page))["finder.window"]);
  await choose(page, "File", "New Finder Window");
  const windows = page.locator(".mac-window.mac-finder");
  await until(async () => (await windows.count()) === 2);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  step(
    "A new window left untouched writes nothing over the saved tabs",
    JSON.stringify((await settings(page))["finder.window"]) === keptBefore,
  );
  await choose(page, "View", "as List", "menuitemradio");
  await choose(page, "Go", "Documents");
  await choose(page, "View", "as List", "menuitemradio");
  step(
    "A folder's view changed in one window reaches the other showing it",
    await until(async () => (await page.locator('.mac-finder [role="treegrid"]').count()) === 2),
  );
  await choose(page, "View", "as Icons", "menuitemradio");
  await until(async () => (await page.locator('.mac-finder [role="treegrid"]').count()) === 0);

  // The same while the other window is searching: the view waits until the search ends. The second
  // window moves aside so that both can be clicked.
  const tabbed = windows.filter({ has: page.getByRole("tab") });
  const plain = windows.filter({ hasNot: page.getByRole("tab") });
  const plainBox = await plain.boundingBox();
  await page.mouse.move(plainBox.x + 500, plainBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(plainBox.x + 800, plainBox.y + 212, { steps: 6 });
  await page.mouse.up();
  const tabbedSearch = tabbed.locator(".mac-finder-search input");
  await tabbedSearch.click();
  await tabbedSearch.fill(`waiting${tag}`);
  await plain.click({ position: { x: 900, y: 12 } });
  await choose(page, "View", "as List", "menuitemradio");
  await tabbedSearch.click();
  await tabbedSearch.fill("");
  step(
    "A view changed while a window searches reaches it when the search ends",
    await until(async () => (await page.locator('.mac-finder [role="treegrid"]').count()) === 2),
  );
  await choose(page, "View", "as Icons", "menuitemradio");
  await until(async () => (await page.locator('.mac-finder [role="treegrid"]').count()) === 0);
  await plain.click({ position: { x: 900, y: 12 } });
  await choose(page, "File", "Close Window");
  await until(async () => (await windows.count()) === 1);
  await win.getByRole("tab").nth(0).click();
  step(
    "The other tab is Downloads, in its list",
    await until(async () => (await win.getByRole("treegrid").count()) === 1),
  );
  await savedRow.click();
  step(
    "The saved search runs again",
    await until(
      async () => (await win.locator(".mac-finder-search input").inputValue()) === `query${tag}`,
    ),
  );

  // A window that opens before the settings have come takes them when they do, and overwrites nothing.
  await choose(page, "Go", "Downloads");
  await until(async () => (await title()) === "Downloads");
  await choose(page, "File", "New Tab");
  // That tab: Movies, a list that no setting of the folder asks for. Its window opens on the home
  // folder, which keeps a gallery: the gallery must not reach the tab that comes back.
  await choose(page, "Go", "Home");
  await until(async () => (await title()) === "shackett");
  await win
    .getByRole("row", { name: /Movies/ })
    .first()
    .dblclick();
  await until(async () => (await title()) === "Movies");
  await win.getByRole("tab").nth(1).click();
  await choose(page, "Go", "Home");
  await choose(page, "View", "as Gallery", "menuitemradio");
  await until(
    async () => (await settings(page))["finder.folders"]?.["/Users/shackett"]?.view === "gallery",
  );
  await win.getByRole("tab").nth(2).click();
  await until(async () => {
    const kept = (await settings(page))["finder.window"];
    return kept?.active === 2 && kept.tabs[2]?.location.endsWith("/Movies");
  });
  const slow = "**/api/system-preferences/settings*";
  await page.route(slow, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.continue().catch(() => {});
  });
  const tabsThen = await win.getByRole("tab").count();
  await page.reload();
  await openDesktop(page, base, step);
  win = await openFinder(page);
  step(
    "A window opened before the settings arrive takes the saved tabs when they do",
    await until(async () => (await win.getByRole("tab").count()) === tabsThen),
    `${await win.getByRole("tab").count()} of ${tabsThen}`,
  );
  step(
    "and the tab shown keeps its view, not the view of the folder the window opened on",
    await until(
      async () => (await title()) === "Movies" && (await win.getByRole("treegrid").count()) === 1,
    ),
    await title(),
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.unroute(slow);
  step(
    "and so does what is kept of it",
    (await settings(page))["finder.window"]?.tabs?.[2]?.view === "list",
  );
  step(
    "and a folder there shows the view it keeps",
    await until(async () => {
      await win.getByRole("tab").nth(0).click();
      return (await win.getByRole("treegrid").count()) === 1;
    }),
  );

  // A kept folder that has gone before the window comes back.
  await choose(page, "Go", "Home");
  await until(async () => (await title()) === "shackett");
  await choose(page, "View", "as Icons", "menuitemradio");
  await win.getByRole("option", { name: "Movies", exact: true }).first().dblclick();
  await until(async () => (await title()) === "Movies");
  await win.getByRole("option", { name: GONE, exact: true }).first().dblclick();
  await until(async () => (await title()) === GONE);
  await until(async () =>
    (await settings(page))["finder.window"]?.tabs?.some((each) => each.location.endsWith(GONE)),
  );
  const goneId = (await api(page, "GET", "/api/files/")).json.entries.find(
    (e) => e.name === GONE,
  )?.id;
  await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: goneId }] });
  await page.reload();
  await openDesktop(page, base, step);
  win = await openFinder(page);
  step(
    "A kept folder that has gone opens the home folder instead",
    await until(async () => (await title()) === "shackett"),
    await title(),
  );
});
