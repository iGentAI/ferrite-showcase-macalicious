#!/usr/bin/env node
// Safari's bookmarks on Ferrite: the Add Bookmark sheet, its choice of place and name, folders in the
// sidebar, and a folder's bookmark renamed and deleted, each read back from the server, then a reload.
//
//   node e2e/safari-bookmarks-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState } from "./media-census-kit.mjs";

const PAGE = "news.ycombinator.com";
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";
const { base, out } = options();
const { step, run } = journey("safari-bookmarks", { ignoreOtherOrigins: true });
const library = async (page) => (await api(page, "GET", "/api/safari/bookmarks")).json;
const saved = (page) =>
  page.waitForResponse(
    (reply) =>
      reply.request().method() === "PUT" &&
      new URL(reply.url()).pathname === "/api/safari/bookmarks",
    { timeout: 10_000 },
  );

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const field = window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  await field.click();
  await field.fill(PAGE);
  await field.press("Enter");
  await window.locator("iframe[srcdoc]").waitFor({ timeout: 30_000 });

  // ---- A folder ---------------------------------------------------------------------------------
  await chooseMenu(page, "Bookmarks", "Add Bookmark Folder…");
  const named = page.getByRole("textbox", { name: "Folder name" });
  await named.fill("Reading");
  const folderSaved = saved(page);
  await named.press("Enter");
  await folderSaved;
  step(
    "Add Bookmark Folder keeps an empty folder",
    (await library(page)).folders?.some((one) => one.title === "Reading" && one.links.length === 0),
  );

  // ---- The sheet --------------------------------------------------------------------------------
  await page.keyboard.press(`${COMMAND}+d`);
  const sheet = page.getByRole("dialog", { name: "Add this page to:" });
  await sheet.waitFor({ timeout: 5_000 });
  const name = sheet.getByRole("textbox", { name: "Bookmark name" });
  step("Command-D offers the page's title as the name", (await name.inputValue()).length > 0);
  await sheet.getByRole("combobox", { name: "Add this page to" }).click();
  await page.getByRole("option", { name: "Reading", exact: true }).click();
  await name.fill("The Orange Site");
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-add-bookmark.png"));
  const added = saved(page);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await added;
  const inFolder = (await library(page)).folders?.find((one) => one.title === "Reading")?.links;
  step(
    "the page joins the folder chosen, under the name given",
    inFolder?.length === 1 && inFolder[0].title === "The Orange Site",
    JSON.stringify(inFolder),
  );

  await page.keyboard.press(`${COMMAND}+d`);
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Cancel adds nothing",
    (await library(page)).folders?.find((one) => one.title === "Reading")?.links.length === 1,
  );

  // The same page under another name is a second bookmark.
  await page.keyboard.press(`${COMMAND}+d`);
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("combobox", { name: "Add this page to" }).click();
  await page.getByRole("option", { name: "Reading", exact: true }).click();
  await name.fill("Second Name");
  const twice = saved(page);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await twice;
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  const both = (await library(page)).folders?.find((one) => one.title === "Reading")?.links;
  step(
    "the same page under another name is kept beside it",
    both?.map((one) => one.title).join() === "The Orange Site,Second Name",
    JSON.stringify(both),
  );

  // ---- Share > Add Bookmark, to the Favorites, its first choice ----------------------------------
  await window.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add Bookmark", exact: true }).click();
  await name.fill("Shared Page");
  const shared = saved(page);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  step("Share > Add Bookmark saves through the sheet", (await shared).status() === 200);
  await sheet.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "and the page is on the Favorites bar",
    await window
      .getByRole("navigation", { name: "Favorites bar" })
      .getByText("Shared Page")
      .isVisible(),
  );

  // ---- The sidebar and a reload -----------------------------------------------------------------
  await reloadDesktop(page);
  await launch(page, "Safari");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  // The kept tab reopens on its page; showing the list while that is loading would cancel the read.
  await window.locator("iframe[srcdoc]").waitFor({ timeout: 30_000 });
  await chooseMenu(page, "Bookmarks", "Show Bookmarks");
  const folderRow = window.getByRole("treeitem", { name: "Reading", exact: true });
  await folderRow.waitFor({ timeout: 10_000 });
  await folderRow.click();
  await page.keyboard.press("ArrowRight");
  const row = window.getByRole("treeitem", { name: "The Orange Site", exact: true });
  await row.waitFor({ timeout: 5_000 });
  step("after a reload the sidebar lists the folder and its bookmark", true);
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-bookmark-folder.png"));

  // ---- A folder's bookmark ----------------------------------------------------------------------
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  const rename = page.getByRole("textbox", { name: "Bookmark name" });
  await rename.fill("Hacker News");
  const renamed = saved(page);
  await rename.press("Enter");
  await renamed;
  await rename.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Rename changes the folder's bookmark",
    (await library(page)).folders?.find((one) => one.title === "Reading")?.links[0]?.title ===
      "Hacker News",
  );
  await window.locator('[data-link-folder="Reading"]').first().click({
    button: "right",
  });
  const deleted = saved(page);
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await deleted;
  const after = await library(page);
  step(
    "Delete takes it out of the folder, which stays",
    after.folders
      ?.find((one) => one.title === "Reading")
      ?.links.map((one) => one.title)
      .join() === "Second Name",
  );

  // ---- Edit Bookmarks ----------------------------------------------------------------------------
  await page.keyboard.press(`${COMMAND}+Alt+b`);
  await window.getByRole("heading", { level: 1, name: "Bookmarks" }).waitFor({ timeout: 5_000 });
  const rowIn = (place, name) =>
    window
      .getByRole("region", { name: place, exact: true })
      .locator("[data-bookmark-row]")
      .filter({ hasText: name });
  const places = async () => {
    const now = await library(page);
    const titles = (links) => links.map((one) => one.title).join();
    return {
      favorites: titles(now.favorites),
      bookmarks: titles(now.bookmarks),
      reading: titles(now.folders.find((one) => one.title === "Reading")?.links ?? []),
    };
  };
  await rowIn("Favorites", "Apple").click();
  await rowIn("Favorites", "NPR").click({ modifiers: [COMMAND] });
  await rowIn("Favorites", "BBC").click({ modifiers: [COMMAND] });
  step(
    "Command-click selects several rows",
    (await window.locator("[data-bookmark-row][data-selected]").count()) === 3,
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "safari-edit-bookmarks.png"));
  const dragSaved = saved(page);
  await rowIn("Favorites", "NPR").dragTo(
    window.getByRole("heading", { name: "Reading", level: 2 }),
  );
  await dragSaved;
  const dragged = await places();
  step(
    "dragging one of them moves them all to the folder",
    dragged.reading === "Second Name,Apple,NPR,BBC" && !/Apple|NPR|BBC/.test(dragged.favorites),
    dragged.reading,
  );

  // A drag given up, then a link from elsewhere dropped on a section: neither moves a row.
  const before = JSON.stringify(await places());
  await window.evaluate((root) => {
    const row = root.querySelector("[data-bookmark-row]");
    const section = root.querySelector('section[aria-label="Bookmarks"]');
    const fire = (target, type, data) =>
      target.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
      );
    const given = new DataTransfer();
    fire(row, "dragstart", given);
    fire(row, "dragend", given);
    const outside = new DataTransfer();
    outside.setData("text/uri-list", "https://example.org/");
    fire(section, "dragover", outside);
    fire(section, "drop", outside);
  });
  await page.waitForTimeout(1_000);
  step(
    "a drag given up and a link from elsewhere change nothing",
    JSON.stringify(await places()) === before,
  );

  await rowIn("Reading", "Apple").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move To" }).hover();
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-bookmark-move-menu.png"));
  const moveSaved = saved(page);
  await page.getByRole("menuitem", { name: "Bookmarks", exact: true }).click();
  await moveSaved;
  const moved = await places();
  step("Move To puts a row in Bookmarks", moved.bookmarks === "Apple", moved.bookmarks);

  await rowIn("Reading", "NPR").click();
  await rowIn("Reading", "BBC").click({ modifiers: ["Shift"] });
  const keySaved = saved(page);
  await page.keyboard.press("Backspace");
  await keySaved;
  step("Shift-click and Delete remove the rows", (await places()).reading === "Second Name");

  await window.getByRole("searchbox", { name: "Search Bookmarks" }).fill("second");
  await window.getByText("Second Name").waitFor({ timeout: 3_000 });
  step(
    "Search keeps only what matches",
    (await window.locator("[data-bookmark-row]").count()) === 1,
  );
  await window.getByRole("searchbox", { name: "Search Bookmarks" }).fill("");

  await window.getByRole("heading", { name: "Reading", level: 2 }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  const folderName = page.getByRole("textbox", { name: "Folder name" });
  await folderName.fill("Later");
  const nameSaved = saved(page);
  await folderName.press("Enter");
  await nameSaved;
  await folderName.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "a folder renames, keeping its bookmarks",
    (await library(page)).folders.find((one) => one.title === "Later")?.links.length === 1,
  );
  await window.getByRole("heading", { name: "Later", level: 2 }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete Folder…" }).click();
  const asked = page.getByRole("dialog", { name: /Delete “Later” and the bookmark in it/ });
  await asked.waitFor({ timeout: 5_000 });
  const folderGone = saved(page);
  await asked.getByRole("button", { name: "Delete", exact: true }).click();
  await folderGone;
  await asked.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "a folder deletes after asking",
    (await library(page)).folders.every((one) => one.title !== "Later"),
  );

  // ---- Add Bookmarks for These Tabs --------------------------------------------------------------
  await rowIn("Favorites", "Hacker News").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open in New Tab", exact: true }).click();
  await window.locator("iframe[srcdoc]").waitFor({ timeout: 30_000 });
  await chooseMenu(page, "Bookmarks", "Add Bookmarks for These Tabs…");
  const tabsName = page.getByRole("textbox", { name: "Folder name" });
  await tabsName.fill("From Tabs");
  const tabsSaved = saved(page);
  await tabsName.press("Enter");
  await tabsSaved;
  const fromTabs = (await library(page)).folders.find((one) => one.title === "From Tabs");
  step(
    "Add Bookmarks for These Tabs makes a folder of the web pages open",
    fromTabs?.links.some((one) => one.url.includes("ycombinator")),
    JSON.stringify(fromTabs?.links),
  );
  await tabsName.waitFor({ state: "detached", timeout: 5_000 });
  await chooseMenu(page, "Bookmarks", "Show Bookmarks");
  const tabsFolder = window.getByRole("treeitem", { name: "From Tabs", exact: true });
  await tabsFolder.waitFor({ timeout: 5_000 });
  await tabsFolder.click();
  await page.keyboard.press("ArrowRight");
  await window.locator('[data-link-folder="From Tabs"]').first().waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-tabs-folder.png"));

  // ---- The limit: a hundred folders leave the row dimmed, saying why ----------------------------
  const full = await library(page);
  const hundred = await api(page, "PUT", "/api/safari/bookmarks", {
    favorites: full.favorites,
    bookmarks: full.bookmarks,
    folders: Array.from({ length: 100 }, (_, at) => ({ title: `Folder ${at}`, links: [] })),
    rev: full.rev,
  });
  step("a hundred folders are accepted", hundred.status === 200, `HTTP ${hundred.status}`);
  await reloadDesktop(page);
  await launch(page, "Safari");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  // The folders arrive from the server after the window shows; the row is enabled until then.
  let limit = await menuItemState(page, "Bookmarks", "Add Bookmark Folder…");
  for (let tries = 0; tries < 20 && !limit.disabled; tries += 1) {
    await page.waitForTimeout(250);
    limit = await menuItemState(page, "Bookmarks", "Add Bookmark Folder…");
  }
  step(
    "at the limit Add Bookmark Folder is dimmed with its reason",
    limit.disabled === true && /at most 100/.test(limit.title ?? ""),
    JSON.stringify(limit),
  );

  // Leaves the account as it found it: this journey's session is its own.
  const end = await library(page);
  await api(page, "PUT", "/api/safari/bookmarks", {
    favorites: end.favorites,
    bookmarks: end.bookmarks,
    folders: [],
    rev: end.rev,
  });
});

process.exit(0);
