#!/usr/bin/env node
// Editors on Ferrite, two windows at once: two pages of one session (two windows of the person's
// desktop) change the same note in Notes, and the same sticky in Stickies, at the same time. The
// first window's save is held back while the second window's is stored, as a slow network would
// hold it; the held save then meets the newer revision and is refused (409) once. The window
// whose change arrived second must show the version saved first, say so, and keep its own: Notes
// as a conflicted copy beside the note (Show My Version, Keep My Version), Stickies with Keep
// Mine. Exits 0 only when every step passed, each app's held save was refused exactly once, and
// neither window logged any other console error, page error, failed request or HTTP error.
// Then Recent Items, the same way: window one's save of the desktop settings document is held
// while window two's is stored, so window one's is refused (409); it must be merged and saved
// again (200) with no "did not keep a change" notice, the stored Recent Items must hold the apps
// both windows opened, and both windows must list them after a reload. A 409 on the settings
// document is a problem unless a 200 save of it by the same window follows.
//
//   ferrite dev --fresh                           # in ferrite-apps/desktop
//   node e2e/editors-conflict-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                         [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const stamp = String(Date.now()).slice(-6);
const TITLE = `Conflict journey ${stamp}`;
const WORD = `Bramble${stamp}`;
const DATA = ["/api/notes/data", "/api/stickies/data"];
const SETTINGS = "/api/system-preferences/settings";

const problems = [];
const steps = [];
const step = (label, ok, detail = "") => {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};
/** The 409s the held saves met, by path: one each is the conflict the journey makes. */
const refused = new Map(DATA.map((each) => [each, 0]));
/** Each window's saves of the desktop settings document, in order: "409" or "200". */
const settingsSaves = new Map();
/** "did not keep a change" notices, in either window. */
let lostNotices = 0;

/** Every error a window logs, but the one refusal per app that the journey makes on purpose. */
function watch(page, name) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The browser logs the refused save as a failed resource; the response is counted below.
    if (/status of 409/.test(message.text())) return;
    if (/did not keep a change/.test(message.text())) lostNotices += 1;
    problems.push(`${name} console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${name} page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const url = request.url();
    const aborted = /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i.test(
      request.failure()?.errorText ?? "",
    );
    if (aborted && (url.includes("/__forge/reload") || new URL(url).pathname.startsWith("/live/")))
      return;
    problems.push(`${name} request failed: ${url} ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    const at = new URL(response.url()).pathname;
    if (at === SETTINGS && response.request().method() === "PUT") {
      const saves = settingsSaves.get(name) ?? [];
      settingsSaves.set(name, saves);
      if (response.status() === 409) {
        // Judged below: a problem unless a 200 save of the same document by this window follows.
        saves.push("409");
        return;
      }
      if (response.status() === 200) saves.push("200");
    }
    if (response.status() === 409 && refused.has(at)) {
      refused.set(at, (refused.get(at) ?? 0) + 1);
      return;
    }
    if (response.status() >= 400)
      problems.push(`${name} HTTP ${response.status()}: ${response.url()}`);
  });
}

/** Put the insertion point right after `text` in the editor, focused. */
const caretAfter = (editor, text) =>
  editor.evaluate((root, wanted) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.nodeValue.indexOf(wanted);
      if (at < 0) continue;
      root.focus();
      const range = root.ownerDocument.createRange();
      range.setStart(node, at + wanted.length);
      range.collapse(true);
      const selection = root.ownerDocument.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }
    return false;
  }, text);

/** Whether the editor's text holds `text`. */
const holds = (editor, text) =>
  editor.evaluate((root, wanted) => root.textContent.includes(wanted), text);

/**
 * Hold this page's next save to `url` (matched by path: the page's requests carry a query of their
 * own) until `release` is called, so that it meets the newer revision another window stores.
 */
async function holdNextSave(page, url) {
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let holding = true;
  const matches = (address) => address.pathname === url;
  const handler = async (route) => {
    if (holding && route.request().method() === "PUT") {
      holding = false;
      await held;
    }
    await route.continue();
  };
  await page.route(matches, handler);
  return { release: () => release(), stop: () => page.unroute(matches, handler) };
}

/** The next save to `url` that `page` sends and the server stores. */
const stored = (page, url) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === url &&
      response.status() === 200,
    { timeout: 10_000 },
  );

/** Close any open menu. */
const closeMenus = async (page) => {
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("Escape");
};

/** Open an app from Spotlight, as a person would: it goes to the front of Recent Items. */
async function openFromSpotlight(page, name) {
  await closeMenus(page);
  await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  await page.getByRole("combobox", { name: "Spotlight Search" }).fill(name);
  await page.getByRole("option", { name, exact: true }).first().click();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
}

/** The rows of the Apple menu's Recent Items. */
async function recentItems(page) {
  await closeMenus(page);
  await page.getByRole("menuitem", { name: "Apple" }).first().click();
  await page.getByRole("menuitem", { name: "Recent Items", exact: true }).hover();
  await page.getByRole("menuitem", { name: "Clear Menu", exact: true }).waitFor({ timeout: 3_000 });
  const menu = page.getByRole("menu", { name: "Recent Items", exact: true });
  for (const name of ["Calculator", "Font Book"]) {
    await menu.getByRole("menuitem", { name, exact: true }).waitFor({ timeout: 15_000 });
  }
  const rows = await menu.evaluate((menu) => {
    return [...(menu?.querySelectorAll('[role^="menuitem"]') ?? [])]
      .filter((each) => each.closest('[role="menu"]') === menu)
      .map((each) => (each.textContent ?? "").trim());
  });
  await closeMenus(page);
  return rows;
}

/** Reload and await this new document's settings, not an earlier page's pending response. */
async function reloadSettings(page) {
  let navigation;
  let committed = false;
  const requestStarted = (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      navigation = request;
      committed = false;
    }
  };
  const navigated = (frame) => {
    if (navigation && frame === page.mainFrame()) committed = true;
  };
  page.on("request", requestStarted);
  page.on("framenavigated", navigated);
  const loaded = page
    .waitForRequest(
      (request) =>
        committed &&
        request.frame() === page.mainFrame() &&
        request.method() === "GET" &&
        new URL(request.url()).pathname === SETTINGS,
      { timeout: 15_000 },
    )
    .then(async (request) => {
      const response = await request.response();
      if (response?.status() !== 200 || (await response.finished()) !== null) {
        throw new Error("The reloaded desktop did not read its settings");
      }
    });
  // A failed reload must not leave a later rejected waiter unhandled.
  loaded.catch(() => {});
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("The reloaded settings did not finish")), 15_000);
  });
  timeout.catch(() => {});
  try {
    await page.reload({ waitUntil: "load" });
    await Promise.race([loaded, timeout]);
  } finally {
    clearTimeout(timer);
    page.off("request", requestStarted);
    page.off("framenavigated", navigated);
  }
}

const browser = await ENGINES[browserName].launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const one = await context.newPage();
  watch(one, "window one");
  await openDesktop(one, base, step);
  const shownNote = (page) => page.locator('[role="textbox"][aria-label="Note"]:visible').first();

  // A note and a sticky to change, saved.
  await launch(one, "Notes");
  const notesWindow = one.getByRole("region", { name: "Notes" }).first();
  await notesWindow.waitFor({ timeout: 15_000 });
  await notesWindow.getByRole("button", { name: "New Note" }).click();
  await shownNote(one).waitFor({ timeout: 10_000 });
  await shownNote(one).click();
  await one.keyboard.type(TITLE);
  await one.keyboard.press("Enter");
  await one.keyboard.type("The line stays plain");
  await launch(one, "Stickies");
  const sticky = one.locator(".mac-stickies-note").first();
  await sticky.waitFor({ state: "visible", timeout: 15_000 });
  await sticky.getByRole("textbox").first().click();
  await one.keyboard.press("ControlOrMeta+A");
  await one.keyboard.press("Delete");
  await one.keyboard.type("Shopping");
  await one.keyboard.press("Enter");
  await one.keyboard.type(`${WORD} jam`);
  await one.waitForTimeout(2500);

  // The second window, ready before the first types.
  const two = await context.newPage();
  watch(two, "window two");
  await openDesktop(two, base, step);
  await launch(two, "Notes");
  await two.getByRole("region", { name: "Notes" }).first().waitFor({ timeout: 15_000 });
  await two.waitForFunction(
    (wanted) =>
      [...document.querySelectorAll('[role="textbox"][aria-label="Note"]')].some((each) =>
        each.textContent.includes(wanted),
      ),
    TITLE,
    { timeout: 10_000 },
  );

  // Notes: both windows change the note's line at once; window one's save arrives second.
  await launch(one, "Notes");
  const notesHold = await holdNextSave(one, "/api/notes/data");
  step("Notes: window one's caret is in the line", await caretAfter(shownNote(one), "stays plain"));
  await one.keyboard.type(" from window one");
  await one.waitForTimeout(500);
  const twoNotes = stored(two, "/api/notes/data");
  step("Notes: window two's caret is in the line", await caretAfter(shownNote(two), "stays plain"));
  await two.keyboard.type(" from window two");
  await twoNotes;
  notesHold.release();
  const notesNotice = one.getByRole("note").filter({ hasText: "was changed in another window" });
  await notesNotice.first().waitFor({ timeout: 15_000 });
  step(
    "Notes: window one says the note was changed in another window, and shows the version saved first",
    (await holds(shownNote(one), "from window two")) &&
      !(await holds(shownNote(one), "from window one")),
  );
  await one.waitForTimeout(2500);
  const notesOf = async () => (await api(one, "GET", "/api/notes/data")).json.data?.notes ?? [];
  const copyOf = (notes) => notes.find((each) => each.lines?.[0] === `${TITLE} (conflicted copy)`);
  const originalOf = (notes) => notes.find((each) => each.lines?.[0] === TITLE);
  const afterConflict = await notesOf();
  step(
    "Notes: window one's version is saved as a conflicted copy beside the note",
    copyOf(afterConflict)?.lines.join("\n").includes("from window one") === true &&
      originalOf(afterConflict)?.lines.join("\n").includes("from window two") === true,
    JSON.stringify(afterConflict.slice(0, 2).map((each) => each.lines)),
  );
  await shot(one, path.join(out, `conflict-${browserName}-notes.png`));
  await notesNotice.first().getByRole("button", { name: "Show My Version" }).click();
  await one.waitForTimeout(500);
  step("Notes: Show My Version opens the copy", await holds(shownNote(one), "from window one"));
  await notesNotice.first().getByRole("button", { name: "Keep My Version" }).click();
  await one.waitForTimeout(2500);
  const afterKeep = await notesOf();
  step(
    "Notes: Keep My Version puts window one's version in the note and keeps the other as the copy",
    originalOf(afterKeep)?.lines.join("\n").includes("from window one") === true &&
      copyOf(afterKeep)?.lines.join("\n").includes("from window two") === true &&
      (await notesNotice.count()) === 0,
  );
  await notesHold.stop();

  // Stickies, the same way.
  await launch(two, "Stickies");
  const theirs = two.locator(".mac-stickies-note").filter({ hasText: WORD }).first();
  await theirs.waitFor({ state: "visible", timeout: 15_000 });
  await launch(one, "Stickies");
  const mine = one.locator(".mac-stickies-note").filter({ hasText: WORD }).first();
  const stickiesHold = await holdNextSave(one, "/api/stickies/data");
  step(
    "Stickies: window one's caret is after the word",
    await caretAfter(mine.getByRole("textbox").first(), `${WORD} jam`),
  );
  await one.keyboard.type(" and one");
  await one.waitForTimeout(500);
  const twoStickies = stored(two, "/api/stickies/data");
  step(
    "Stickies: window two's caret is after the word",
    await caretAfter(theirs.getByRole("textbox").first(), `${WORD} jam`),
  );
  await two.keyboard.type(" and two");
  await twoStickies;
  stickiesHold.release();
  const stickyNotice = one.getByRole("note").filter({ hasText: "Changed in another window." });
  await stickyNotice.first().waitFor({ timeout: 15_000 });
  const mineText = () =>
    one
      .locator(".mac-stickies-note")
      .filter({ hasText: WORD })
      .first()
      .getByRole("textbox")
      .first();
  step(
    "Stickies: window one's note says so, and shows the version saved first",
    (await holds(mineText(), "and two")) && !(await holds(mineText(), "and one")),
  );
  await shot(one, path.join(out, `conflict-${browserName}-stickies.png`));
  await stickyNotice.first().getByRole("button", { name: "Keep Mine" }).click();
  await one.waitForTimeout(2500);
  const kept = JSON.stringify((await api(one, "GET", "/api/stickies/data")).json.data?.notes ?? []);
  step(
    "Stickies: Keep Mine saves window one's text over it, and the note shows it",
    kept.includes(`${WORD} jam and one`) && (await holds(mineText(), "and one")),
  );
  await stickiesHold.stop();

  // Recent Items, two windows at once: window one's save of the desktop settings document is held
  // while window two's is stored, so it meets the newer revision and is refused (409) once.
  const settingsHold = await holdNextSave(one, SETTINGS);
  await openFromSpotlight(one, "Calculator");
  const twoSettings = stored(two, SETTINGS);
  await openFromSpotlight(two, "Font Book");
  await twoSettings;
  settingsHold.release();
  await one.waitForTimeout(3000);
  await settingsHold.stop();
  const recentNow = (await api(one, "GET", SETTINGS)).json?.values?.["desktop.recentApps"] ?? [];
  step(
    "Recent Items: the stored settings hold the apps both windows opened at once",
    recentNow.includes("calculator") && recentNow.includes("font-book"),
    recentNow.join(","),
  );
  await reloadSettings(one);
  await reloadSettings(two);
  for (const [page, label] of [
    [one, "one"],
    [two, "two"],
  ]) {
    await page.getByRole("menuitem", { name: "Apple" }).first().waitFor({ timeout: 30_000 });
    const rows = await recentItems(page);
    step(
      `Recent Items: after a reload, window ${label}'s Apple menu lists Calculator and Font Book`,
      rows.includes("Calculator") && rows.includes("Font Book"),
      rows.join(" | "),
    );
  }
  step(
    "Recent Items: neither window said a change was not kept",
    lostNotices === 0,
    String(lostNotices),
  );
  const unresolved = [...settingsSaves].filter(([, saves]) =>
    saves.some((each, at) => each === "409" && !saves.slice(at + 1).includes("200")),
  );
  step(
    "Recent Items: window one's refused save was merged and saved again (200), as was every refused save",
    unresolved.length === 0 && (settingsSaves.get("window one") ?? []).includes("409"),
    JSON.stringify(Object.fromEntries(settingsSaves)),
  );

  step(
    "each app's held save was refused exactly once (the conflict)",
    refused.get("/api/notes/data") === 1 && refused.get("/api/stickies/data") === 1,
    JSON.stringify(Object.fromEntries(refused)),
  );
  await context.close();
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(
    `\neditors-conflict: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\neditors-conflict: all ${steps.length} steps passed with no other errors`);
