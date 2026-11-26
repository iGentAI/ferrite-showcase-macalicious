#!/usr/bin/env node
// QuickTime Player's Movie Inspector and Open Recent's Clear Menu, on the desktop served by
// `ferrite dev`, with a movie uploaded from the computer: Window > Show Movie Inspector and Command-I
// show its source, length and size; Clear Menu empties Open Recent and a reload keeps it empty.
// Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/quicktime-inspector-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { base, out } = options();
const { step, run } = journey("quicktime-inspector");

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const LIBRARY = "/api/app-store/library";
  const held = (await api(page, "GET", LIBRARY)).json;
  if (!(held.installed ?? []).includes("quicktime-player")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), "quicktime-player"],
      rev: held.rev,
    });
  }
  await reloadDesktop(page);
  const open = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("QuickTime Player");
    await field.press("Enter");
    const window = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
    await window.waitFor({ state: "visible", timeout: 15_000 });
    return window;
  };
  const qt = await open();
  const chooser = page.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await chooser).setFiles(path.join(here, "fixtures", "test-pattern.webm"));
  await until(
    () =>
      qt
        .locator("video")
        .evaluate((video) => video.readyState >= 2)
        .catch(() => false),
    30_000,
  );
  const bar = page.getByRole("menubar").first();
  await bar.getByRole("menuitem", { name: "Window", exact: true }).click();
  await page.getByRole("menuitem", { name: "Show Movie Inspector", exact: true }).click();
  const inspector = qt.locator(".mac-quicktime-player-inspector");
  await inspector.waitFor({ timeout: 5_000 });
  const words = await until(async () => {
    const text = (await inspector.innerText()).replace(/\s+/g, " ");
    return /test-pattern/.test(text) && /\d+ × \d+/.test(text) && /\d:\d\d/.test(text) ? text : "";
  });
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "quicktime-inspector.png"));
  step("Show Movie Inspector shows the source, length and size", Boolean(words), words);

  await qt.click();
  await page.keyboard.press("Meta+i");
  await inspector.waitFor({ state: "detached", timeout: 5_000 });
  step("Command-I hides it", true);

  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Open Recent", exact: true }).click();
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "quicktime-open-recent.png"));
  const recentRow = page.getByRole("menuitem", { name: /test-pattern/ });
  const listed = await until(
    async () =>
      (await recentRow.count()) > 0 &&
      ((await api(page, "GET", "/api/quicktime-player/recents")).json.recents ?? []).some((each) =>
        each.name.includes("test-pattern"),
      ),
  );
  step("Open Recent lists the movie, also on the server", listed === true);
  await page.getByRole("menuitem", { name: "Clear Menu", exact: true }).click();
  const emptied = await until(
    async () =>
      ((await api(page, "GET", "/api/quicktime-player/recents")).json.recents ?? []).length === 0,
  );
  step("Clear Menu empties Open Recent on the server", emptied === true);
  await page.waitForTimeout(1_000);
  await reloadDesktop(page);
  await open();
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  const trigger = page.getByRole("menuitem", { name: "Open Recent", exact: true });
  step(
    "after a reload Open Recent is dimmed",
    (await trigger.getAttribute("aria-disabled")) === "true" ||
      (await trigger.getAttribute("data-disabled")) !== null,
  );
  await page.keyboard.press("Escape");
});
