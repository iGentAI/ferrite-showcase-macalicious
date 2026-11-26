#!/usr/bin/env node
// Safari's drags in on Ferrite, with a real mouse: a start page tile onto the tab bar, the address
// field and the Favorites bar, and text from a field onto the address field. It seeds a Reading List
// item in the new session its browser starts, and stops before any write if the list holds anything.
//
//   node e2e/safari-drag-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("safari-drag", { ignoreOtherOrigins: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const tile = (name) =>
    window.locator(`[data-link-list="favorites"][data-link-title="${name}"]`).last();
  await tile("NPR").waitFor({ timeout: 10_000 });

  // ---- Onto the Favorites bar, from the Frequently Visited or Favorites tiles -------------------
  const reading = await api(page, "GET", "/api/safari/reading-list");
  if ((reading.json.items ?? []).length > 0) {
    throw new Error("this session's Reading List is not empty: nothing was changed");
  }
  const seeded = await api(page, "PUT", "/api/safari/reading-list", {
    items: [{ title: "Rust", url: "https://www.rust-lang.org/", added: 1, read: false }],
    rev: reading.json.rev,
  });
  step("a Reading List item is seeded", seeded.status === 200, `HTTP ${seeded.status}`);
  await page.reload();
  await launch(page, "Safari");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  const unread = window.locator('[data-link-list="reading-list"][data-link-title="Rust"]').last();
  await unread.waitFor({ timeout: 15_000 });
  const bar = window.locator(".mac-safari-favorites-bar");
  const saved = page.waitForResponse(
    (reply) =>
      reply.request().method() === "PUT" &&
      new URL(reply.url()).pathname === "/api/safari/bookmarks",
    { timeout: 10_000 },
  );
  await unread.dragTo(bar);
  await saved;
  const favorites = (await api(page, "GET", "/api/safari/bookmarks")).json.favorites;
  step(
    "a link dragged to the Favorites bar joins it",
    favorites.some((each) => each.url === "https://www.rust-lang.org/" && each.title === "Rust"),
    JSON.stringify(favorites.map((each) => each.title)),
  );
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "safari-drag-favorites.png"));

  // ---- Onto the tab bar -------------------------------------------------------------------------
  await chooseMenu(page, "File", "New Tab");
  const tabs = window.getByRole("tablist", { name: "Tabs" });
  await tabs.waitFor({ timeout: 5_000 });
  await unread.waitFor({ timeout: 10_000 });
  const asked = page.waitForResponse(
    (reply) => new URL(reply.url()).pathname === "/api/safari/page",
    { timeout: 25_000 },
  );
  await tile("Ars Technica").dragTo(tabs);
  await asked;
  step(
    "a link dragged to the tab bar opens a new tab",
    (await tabs.getByRole("tab").count()) === 3,
  );
  await page.waitForTimeout(800);
  await shot(page, path.join(out, "safari-drag-tab.png"));

  // ---- Onto the address field -------------------------------------------------------------------
  await tabs.getByRole("tab").nth(1).click();
  await tile("NPR").waitFor({ timeout: 10_000 });
  const field = window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  const opened = page.waitForResponse(
    (reply) => new URL(reply.url()).pathname === "/api/safari/page",
    { timeout: 25_000 },
  );
  await tile("NPR").dragTo(field);
  await opened;
  await page.waitForTimeout(400);
  step(
    "a link dragged to the address field goes there, in this tab",
    (await field.inputValue()).includes("npr.org") && (await tabs.getByRole("tab").count()) === 3,
    await field.inputValue(),
  );
  await api(page, "PUT", "/api/safari/reading-list", {
    items: [],
    rev: (await api(page, "GET", "/api/safari/reading-list")).json.rev,
  });
});

process.exit(0);
