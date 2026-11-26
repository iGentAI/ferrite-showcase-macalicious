#!/usr/bin/env node
// Safari's smaller menu rows on Ferrite: File > Share, Help, the rows dimmed with their reasons, Emoji &
// Symbols, and the menu on a start page tile, read back from the clipboard and the server.
//
//   node e2e/safari-menu-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("safari-menu-rows", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });

  // ---- The start page's tiles ---------------------------------------------------------------------
  const tile = window.locator('[data-link-list="favorites"][data-link-title="NPR"]').last();
  await tile.waitFor({ timeout: 10_000 });
  await tile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-tile-menu.png"));
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  const name = page.getByRole("textbox", { name: "Bookmark name" });
  await name.fill("Public Radio");
  const saved = page.waitForResponse(
    (reply) =>
      reply.request().method() === "PUT" &&
      new URL(reply.url()).pathname === "/api/safari/bookmarks",
    { timeout: 10_000 },
  );
  await name.press("Enter");
  await saved;
  const stored = (await api(page, "GET", "/api/safari/bookmarks")).json;
  step(
    "a tile's menu renames the Favorite",
    stored.favorites.some((one) => one.title === "Public Radio"),
  );

  // ---- Rows that cannot run say why -----------------------------------------------------------------
  for (const [menu, row, words] of [
    ["Safari", "Safari Extensions…", "no extensions"],
    ["Edit", "Paste and Match Style", "plain text"],
    ["Edit", "Delete", "nothing selected"],
    ["Edit", "AutoFill Form", "keeps no contact"],
    ["Edit", "Spelling and Grammar", "text menu"],
    ["Edit", "Substitutions", "text menu"],
    ["Edit", "Transformations", "text menu"],
    ["Edit", "Speech", "text menu"],
    ["Edit", "Start Dictation…", "text field"],
    ["Help", "Installed Plug-ins", "no plug-ins"],
  ]) {
    const state = await menuItemState(page, menu, row);
    step(
      `${menu} > ${row} is dimmed, saying why`,
      state.disabled === true && (state.title ?? "").includes(words),
      state.title ?? "",
    );
  }

  // ---- The dimmed rows, as they look with their menus open -------------------------------------------
  for (const [menu, row, file] of [
    ["Safari", "Safari Extensions…", "safari-menu-safari.png"],
    ["Edit", "Speech", "safari-menu-edit.png"],
    ["Help", "Installed Plug-ins", "safari-menu-help.png"],
  ]) {
    await page.getByRole("menubar").first().getByRole("menuitem", { name: menu }).first().click();
    await page.getByRole("menuitem", { name: row, exact: true }).waitFor({ timeout: 5_000 });
    await page.waitForTimeout(450);
    await shot(page, path.join(out, file));
    await closeMenus(page);
  }

  // ---- File > Share --------------------------------------------------------------------------------
  const field = window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  await field.click();
  await field.fill("news.ycombinator.com");
  await field.press("Enter");
  await window.locator("iframe[srcdoc]").waitFor({ timeout: 30_000 });
  await page.getByRole("menubar").first().getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Share", exact: true }).hover();
  const copy = page.getByRole("menuitem", { name: "Copy Link" });
  await copy.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "safari-file-share.png"));
  await copy.click();
  await closeMenus(page);
  await page.waitForTimeout(300);
  step(
    "File > Share > Copy Link copies the page's address",
    (await page.evaluate(() => navigator.clipboard.readText())).includes("news.ycombinator.com"),
  );

  // ---- Emoji & Symbols, and Help --------------------------------------------------------------------
  await chooseMenu(page, "Edit", "Emoji & Symbols");
  const viewer = page.getByRole("dialog", { name: /Character|Emoji/ });
  await viewer.first().waitFor({ timeout: 5_000 });
  step("Edit > Emoji & Symbols opens the Character Viewer", true);
  await page.keyboard.press("Escape");

  await chooseMenu(page, "Help", "Safari Help");
  await page.locator('[data-window-id="help-viewer"]').first().waitFor({ timeout: 8_000 });
  await page.waitForTimeout(700);
  await shot(page, path.join(out, "safari-help.png"));
  step("Help > Safari Help opens Help Viewer", true);
});

process.exit(0);
