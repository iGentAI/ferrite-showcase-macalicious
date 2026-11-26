#!/usr/bin/env node
// Safari's sidebar on Ferrite: several Reading List rows chosen together, the rows' menus in both
// lists, each read back from the server. The list is seeded through the app's own route, in the new
// session the journey's browser starts, and the journey stops before any write if it holds anything.
//
//   node e2e/safari-reading-list-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const ROUTE = "/api/safari/reading-list";
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";
const NAMES = ["One", "Two", "Three", "Four", "Five"];
const { base, out } = options();
const { step, run } = journey("safari-reading-list", { ignoreOtherOrigins: true });
const items = async (page) => (await api(page, "GET", ROUTE)).json.items ?? [];
const saved = (page) =>
  page.waitForResponse(
    (reply) => reply.request().method() === "PUT" && new URL(reply.url()).pathname === ROUTE,
    { timeout: 10_000 },
  );

await run(async (page) => {
  await openDesktop(page, base, step);
  const start = (await api(page, "GET", ROUTE)).json;
  if ((start.items ?? []).length > 0) {
    throw new Error("this session's Reading List is not empty: nothing was changed");
  }
  const seeded = await api(page, "PUT", ROUTE, {
    items: NAMES.map((title, at) => ({
      title,
      url: `https://${title.toLowerCase()}.org/`,
      added: at + 1,
      read: false,
    })),
    rev: start.rev,
  });
  step("the list is seeded", seeded.status === 200, `HTTP ${seeded.status}`);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });

  // ---- A bookmark row's menu, in the sidebar --------------------------------------------------
  await chooseMenu(page, "Bookmarks", "Show Bookmarks");
  await window.getByRole("treeitem", { name: "NPR", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Bookmarks" }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-sidebar-bookmark-menu.png"));
  step("a Favorite's row in the sidebar has its menu", true);
  await page.keyboard.press("Escape");

  // ---- Several Reading List rows --------------------------------------------------------------
  await chooseMenu(page, "Bookmarks", "Show Reading List");
  const row = (name) => window.getByRole("treeitem", { name, exact: true });
  await row("One").waitFor({ timeout: 10_000 });
  await row("One").click({ modifiers: [COMMAND] });
  await row("Three").click({ modifiers: ["Shift"] });
  const chosen = window.locator("[data-chosen]");
  step("Command-click, then Shift-click, chooses the rows between", (await chosen.count()) === 3);
  await row("Five").click({ modifiers: [COMMAND] });
  step("Command-click adds another", (await chosen.count()) === 4);
  await row("Five").click({ modifiers: [COMMAND] });
  step("and takes it away again", (await chosen.count()) === 3);

  await row("Two").click({ button: "right" });
  const markAll = page.getByRole("menuitem", { name: "Mark 3 as Read" });
  await markAll.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-reading-list-several.png"));
  const marked = saved(page);
  await markAll.click();
  await marked;
  step(
    "the menu marks the three as read, and only them",
    (await items(page))
      .filter((one) => one.read)
      .map((one) => one.title)
      .join() === "One,Two,Three",
  );

  await row("Two").click({ button: "right" });
  const removedByMenu = saved(page);
  await page.getByRole("menuitem", { name: "Remove 3 Items" }).click();
  await removedByMenu;
  step(
    "the menu removes the three",
    (await items(page)).map((one) => one.title).join() === "Four,Five",
  );

  // ---- One row's menu, and the Delete key -----------------------------------------------------
  await row("Four").click({ button: "right" });
  const toggled = saved(page);
  await page.getByRole("menuitem", { name: "Mark as Read", exact: true }).click();
  await toggled;
  step(
    "a row outside the choice has its own menu",
    (await items(page)).find((one) => one.title === "Four")?.read === true,
  );
  const opened = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/safari/page") opened.push(request.url());
  });
  await window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first()
    .click();
  await row("Four").click({ modifiers: [COMMAND] });
  await row("Five").click({ modifiers: [COMMAND] });
  const keyed = saved(page);
  await page.keyboard.press("Backspace");
  await keyed;
  step(
    "from the address field, Command-click and Delete remove the rows, opening neither",
    (await items(page)).length === 0 && opened.length === 0,
    `${opened.length} pages opened`,
  );
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-reading-list-empty.png"));
});

process.exit(0);
