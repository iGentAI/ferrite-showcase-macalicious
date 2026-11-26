#!/usr/bin/env node
// Help menus and the guides they open, against the real desktop: each application's Help row opens
// its guide, read in Help Viewer as a person reads it, and every "<menu> > <row>" a page names is
// looked up in that application's own menu bar, with the key the page gives. Finder's other Help
// rows open their own pages, and the page last read is on the server and back after a reload.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/help-guides-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output] [--apps Mail,Maps | --finder-only]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("help-guides");
const at = process.argv.indexOf("--apps");

const NO_HELP_ROW = new Set();
const APPS = process.argv.includes("--finder-only")
  ? []
  : (at >= 0
      ? process.argv[at + 1]
      : "Notes,TextEdit,Terminal,Calculator,Finder,Safari,Stickies,Dictionary,Mail,Messages,Contacts,Calendar,Reminders,Photos,Music,Podcasts,News,Stocks,Maps,TV,Books,Preview,QuickTime Player,Photo Booth,Voice Memos,FaceTime,Find My,Chess,Automator,Script Editor,Font Book,App Store,Activity Monitor,Console,Keychain Access,System Information,System Preferences,Storage Management"
    ).split(",");

const GLYPHS = [
  ["Control-", "⌃"],
  ["Option-", "⌥"],
  ["Shift-", "⇧"],
  ["Command-", "⌘"],
  ["Left Arrow", "←"],
  ["Right Arrow", "→"],
  ["Up Arrow", "↑"],
  ["Down Arrow", "↓"],
  ["Left Bracket", "["],
  ["Right Bracket", "]"],
  ["Period", "."],
  ["Plus", "+"],
  ["Equals", "="],
];
const glyphs = (keys) => GLYPHS.reduce((text, [word, glyph]) => text.replace(word, glyph), keys);

const bar = (page) => page.getByRole("menubar").first();
const barTitle = (page, title) => bar(page).getByRole("menuitem", { name: title, exact: true });
const openMenus = (page) => page.locator('[role="menu"]:visible');
const closeMenus = async (page) => {
  for (let n = 0; n < 4 && (await openMenus(page).count()) > 0; n += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }
};
const rowsOf = (menu) =>
  menu
    .locator('[role^="menuitem"]')
    .evaluateAll((rows) => rows.map((row) => row.textContent.replace(/\s+/g, " ").trim()));

/**
 * Open a menu of the bar, and follow a path into submenus. Answers the rows at its end, or the name
 * of a submenu that is dimmed until the application has a document to act on.
 */
async function rowsAt(page, title, submenus) {
  await closeMenus(page);
  await barTitle(page, title).click();
  await openMenus(page).first().waitFor({ timeout: 4_000 });
  await page.waitForTimeout(150);
  for (const [depth, name] of submenus.entries()) {
    const row = openMenus(page)
      .nth(depth)
      .locator('[role^="menuitem"]')
      .filter({ hasText: new RegExp(`^\\s*${name}`) })
      .first();
    if ((await row.getAttribute("aria-disabled")) === "true") return { dimmed: name };
    await row.hover({ timeout: 2_000 });
    await page.waitForTimeout(350);
    if ((await openMenus(page).count()) <= depth + 1) await row.click({ timeout: 2_000 });
    await page.waitForFunction(
      (want) => document.querySelectorAll('[role="menu"]').length >= want,
      depth + 2,
      { timeout: 2_500 },
    );
  }
  return rowsOf(openMenus(page).last());
}

/** Every "<menu> > ... > <row>" of a line, with the key said straight after it. */
function claimsOf(line, titles) {
  const claims = [];
  for (const title of titles) {
    const pattern = new RegExp(
      `(?:^|[^A-Za-z])${title} > ([^.,]+?)(?= (?:or|and|then) [A-Z][A-Za-z ]* > |[.,]|$)((?:, or press [^,.]+)?)`,
      "g",
    );
    for (const match of line.matchAll(pattern)) {
      const parts = match[1].split(" > ");
      const key = /or press (.+)/.exec(match[2])?.[1];
      claims.push({ title, submenus: parts.slice(0, -1), text: parts.at(-1), key });
    }
  }
  return claims;
}

/** The row a claim's words start with, longest first, or else a row that starts with them; without its "…" and its key. */
const rowFor = (rows, text) =>
  rows
    .map((row) => ({
      row,
      label: row
        .replace(/….*$/, "")
        .replace(/[⌃⌥⇧⌘⌫].*$/, "")
        .trim(),
    }))
    .filter(({ label }) => label && (text.startsWith(label) || label.startsWith(text)))
    .sort(
      (a, b) =>
        Number(text.startsWith(b.label)) - Number(text.startsWith(a.label)) ||
        b.label.length - a.label.length,
    )[0]?.row;

async function spotlightOpen(page, name) {
  await closeMenus(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.waitFor({ timeout: 10_000 });
  await field.fill(name);
  await page.getByRole("option", { name, exact: true }).first().waitFor({ timeout: 10_000 });
  await field.press("Enter");
}

const viewer = (page) => page.locator('[data-window-id="help-viewer"]').last();
const heading = (page) => viewer(page).locator("article h1").first();
const untilHeading = async (page, want, timeout = 6_000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (
      (await heading(page)
        .innerText()
        .catch(() => "")) === want
    )
      return true;
    await page.waitForTimeout(100);
  }
  return false;
};

/** The pages of the guide shown, each opened and read, then back to the book. A server's own pages of a joined book are not this guide's. */
async function readBook(page) {
  const pages = [];
  const links = viewer(page).locator('article a[data-help-link^="guide:"]');
  const count = await links.count();
  const book = await heading(page).innerText();
  for (let n = 0; n < count; n += 1) {
    const link = links.nth(n);
    const title = await link.innerText();
    // By the link's own click: an application's Open panel may lie over Help Viewer.
    await link.dispatchEvent("click");
    await untilHeading(page, title.split("\n")[0], 3_000);
    pages.push(await viewer(page).locator("article").innerText());
    await viewer(page).getByRole("button", { name: "Back" }).dispatchEvent("click");
    await untilHeading(page, book, 3_000);
  }
  return pages;
}

async function chooseBook(page, title) {
  await viewer(page).getByRole("combobox", { name: "Book" }).click();
  await page.getByRole("option", { name: title, exact: true }).click();
  return untilHeading(page, title);
}

async function askGuide(page, name) {
  await spotlightOpen(page, name);
  await barTitle(page, name).waitFor({ timeout: 25_000 });
  await page.waitForTimeout(600);
  const title = `${name} Help`;
  const help = await rowsAt(page, "Help", []);
  if (!help.includes(title)) {
    step(`${name}: has no ${title} row, known`, NO_HELP_ROW.has(name), help.join(", "));
    await closeMenus(page);
    await spotlightOpen(page, "Help Viewer");
    return chooseBook(page, title);
  }
  await openMenus(page).last().getByRole("menuitem", { name: title, exact: true }).click();
  return untilHeading(page, title, 12_000);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const { catalogue } = (await api(page, "GET", "/api/apps")).json;
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  const put = await api(page, "PUT", "/api/app-store/library", {
    installed: catalogue.filter((app) => !app.preinstalled).map((app) => app.id),
    rev: library?.rev,
  });
  step("every application of the catalogue is got", put.status === 200, `HTTP ${put.status}`);
  await reloadDesktop(page);

  let topics = 0;
  let claims = 0;
  for (const name of APPS) {
    const opened = await askGuide(page, name);
    step(
      `${name}: Help opens ${name} Help`,
      opened,
      await heading(page)
        .innerText()
        .catch(() => ""),
    );
    if (!opened) continue;
    await shot(page, path.join(out, `help-guide-${name.replace(/ /g, "-")}.png`));
    const pages = await readBook(page);
    topics += pages.length;
    step(`${name}: the guide has pages to read`, pages.length >= 1, `${pages.length} pages`);

    await spotlightOpen(page, name);
    await barTitle(page, name).waitFor({ timeout: 25_000 });
    await page.waitForTimeout(400);
    const titles = await bar(page)
      .getByRole("menuitem")
      .evaluateAll((items) =>
        items
          .map((item) => item.textContent.trim())
          .filter((text) => /^[A-Z][A-Za-z ]+$/.test(text)),
      );
    const said = [
      ...new Map(
        pages
          .flatMap((text) => text.split("\n"))
          .flatMap((line) => claimsOf(line, titles))
          .map((claim) => [JSON.stringify(claim), claim]),
      ).values(),
    ];
    for (const claim of said) {
      claims += 1;
      const where = [claim.title, ...claim.submenus].join(" > ");
      const rows = await rowsAt(page, claim.title, claim.submenus).catch((error) => {
        step(`${name}: the menu ${where} opens`, false, String(error.message).split("\n")[0]);
        return null;
      });
      if (!rows) continue;
      if (rows.dimmed) {
        step(`${name}: ${where} is there, dimmed for now`, true);
        continue;
      }
      const row = rowFor(rows, claim.text);
      step(`${name}: ${where} has “${claim.text}”`, Boolean(row), row ?? rows.join(" | "));
      if (row && claim.key)
        step(`${name}: “${row}” shows ${claim.key}`, row.includes(glyphs(claim.key)), row);
    }
    await closeMenus(page);
  }
  step("the guides were read", topics >= APPS.length, `${topics} pages, ${claims} menu rows`);

  if (at >= 0) return;
  // Finder's Help rows.
  for (const [row, title, topic] of [
    ["macOS Help", "macOS Help", "Open an application"],
    ["See What’s New in macOS", "See What’s New in macOS", "Find My"],
    ["Tips for Your Mac", "Tips for Your Mac", "Search the menus"],
  ]) {
    await spotlightOpen(page, "Finder");
    await barTitle(page, "Finder").waitFor({ timeout: 15_000 });
    await rowsAt(page, "Help", []);
    await openMenus(page).last().getByRole("menuitem", { name: row, exact: true }).click();
    step(`Finder's ${row} opens its page`, await untilHeading(page, title, 10_000));
    const link = viewer(page).locator("article").getByRole("link", { name: topic, exact: true });
    await link.click();
    step(`${title} has the page “${topic}”`, await untilHeading(page, topic, 3_000));
    await shot(page, path.join(out, `help-page-${title.replace(/\W+/g, "-")}.png`));
  }
  await viewer(page)
    .getByRole("button", { name: "Open Find My" })
    .waitFor({ timeout: 3_000 })
    .catch(() => {});

  // A page of a guide of two words: the server keeps it, and it is shown again after a reload.
  await chooseBook(page, "QuickTime Player Help");
  const first = viewer(page).locator("article").getByRole("link", { name: "Record", exact: true });
  await first.click();
  await untilHeading(page, "Record");
  let kept = null;
  for (let n = 0; n < 40 && kept !== "guide:quicktime-player:1"; n += 1) {
    await page.waitForTimeout(150);
    kept = (await api(page, "GET", "/api/help-viewer/place")).json.page;
  }
  step("the server keeps the page of a two-word guide", kept === "guide:quicktime-player:1", kept);
  const opener = viewer(page).getByRole("button", { name: "Open QuickTime Player" });
  step("the page links to its application", await opener.isVisible());
  await opener.click();
  await barTitle(page, "QuickTime Player").waitFor({ timeout: 25_000 });
  step("the link opens the application", true);
  await reloadDesktop(page);
  await spotlightOpen(page, "Help Viewer");
  step("the page comes back after a reload", await untilHeading(page, "Record", 15_000));
});
