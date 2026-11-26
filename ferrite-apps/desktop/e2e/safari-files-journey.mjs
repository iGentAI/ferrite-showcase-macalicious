#!/usr/bin/env node
// Safari's File commands on Ferrite: Save As, Export Bookmarks and a saved link from Finder, each read
// back from the drive; Import Bookmarks, read back from the server; Print, seen reaching the frame.
//
//   node e2e/safari-files-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { chooseMenu } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("safari-files", { ignoreOtherOrigins: true });
const fieldOf = (window) =>
  window
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(window.getByRole("textbox", { name: "Search or enter website name" }))
    .first();

await run(async (page) => {
  await page.addInitScript(() => {
    window.print = () => window.parent.postMessage({ printed: true }, "*");
    if (window === window.parent) {
      window.__printed = 0;
      window.addEventListener("message", (event) => {
        if (event.data?.printed) window.__printed += 1;
      });
    }
  });
  await openDesktop(page, base, step);
  await launch(page, "Safari");
  const window = page.getByRole("region", { name: "Safari", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await fieldOf(window).fill("news.ycombinator.com");
  await page.keyboard.press("Enter");
  await window.locator("iframe[srcdoc]").waitFor({ timeout: 25_000 });
  await page.waitForTimeout(500);

  await chooseMenu(page, "File", "Save As…");
  await page.getByRole("dialog").last().getByRole("button", { name: "Save" }).click();
  const list = page.locator(".mac-safari-downloads");
  await list.getByText("Hacker News.html").waitFor({ timeout: 15_000 });
  step("Save As puts the page in the Downloads folder, and on the list", true);

  await chooseMenu(page, "File", "Export Bookmarks…").catch(async () => {
    await page.keyboard.press("Escape");
    await chooseMenu(page, "File", "Export Bookmarks…");
  });
  await list.getByText("Safari Bookmarks.html").waitFor({ timeout: 15_000 });
  step("Export Bookmarks writes the file", true);
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "safari-saved-files.png"));
  await page.keyboard.press("Escape");

  await window.locator('input[aria-label="Import Bookmarks"]').setInputFiles({
    name: "bookmarks.html",
    mimeType: "text/html",
    buffer: Buffer.from(
      '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://example.org/imported">Imported</A><DT><A HREF="javascript:alert(1)">No</A></DL>',
    ),
  });
  await page.waitForTimeout(2_000);
  const kept = (await api(page, "GET", "/api/safari/bookmarks")).json;
  step(
    "Import Bookmarks keeps the http(s) links on the server",
    JSON.stringify(kept).includes("example.org/imported") &&
      !JSON.stringify(kept).includes("javascript"),
    JSON.stringify(kept).slice(0, 160),
  );

  await chooseMenu(page, "File", "Print…");
  await page.waitForFunction(() => window.__printed === 1, null, { timeout: 5_000 });
  step("Print reaches the page's frame", true);

  await window.locator('input[aria-label="Open File"]').setInputFiles({
    name: "Saved.webloc",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(
      "<plist><dict><key>URL</key><string>https://news.ycombinator.com/newest</string></dict></plist>",
    ),
  });
  await window.getByRole("tab").nth(1).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  step(
    "Open File opens a saved link in a new tab",
    (await fieldOf(window).evaluate((input) => input.value)).includes("newest"),
  );
});

process.exit(0);
