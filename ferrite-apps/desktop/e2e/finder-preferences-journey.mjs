#!/usr/bin/env node
// Finder's Preferences, on the signed-in person's desktop: each pane changes what Finder does, and
// what it keeps is read back from the person's settings on the server.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-preferences-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("finder-preferences");
const tag = Date.now().toString(36);
const NOTE = `Aa note ${tag}.txt`;
const FOLDER = `Zz folder ${tag}`;
const BIN = `Old ${tag}.txt`;
const AGED = `Aged ${tag}.txt`;

const bar = (page) => page.getByRole("menubar").first();
const settings = async (page) =>
  (await api(page, "GET", "/api/system-preferences/settings")).json?.values ?? {};
const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const entry = async (page, id) => (await drive(page)).entries.find((each) => each.id === id);

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

async function choose(page, title, item) {
  await bar(page).getByRole("menuitem", { name: title, exact: true }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: item, exact: true }).click();
  await menusClosed(page);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "documents", name: NOTE, type: "text/plain", text: "note" });
  const madeFolder = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "documents", name: FOLDER }],
  });
  const binId = await uploadFile(page, {
    parent: "documents",
    name: BIN,
    type: "text/plain",
    text: "old",
  });
  const agedId = await uploadFile(page, {
    parent: "documents",
    name: AGED,
    type: "text/plain",
    text: "aged",
  });
  await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "trash", id: binId }],
  });
  step("The folder is on the server", Boolean(madeFolder.json.created?.[0]));
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const windows = page.locator(".mac-window.mac-finder");
  const win = windows.first();
  await win.waitFor({ timeout: 10_000 });
  const place = (name) => win.getByRole("treeitem", { name, exact: true });

  await choose(page, "Finder", "Preferences…");
  const prefs = page.locator(".mac-preferences-window").first();
  await prefs.waitFor({ timeout: 5_000 });
  const pane = (name) => prefs.getByRole("tab", { name, exact: true }).click();
  step("Finder > Preferences… opens the window", await prefs.isVisible());
  await shot(page, path.join(out, `finder-preferences-general-${browserName}.png`));

  // General.
  const disk = () => page.getByText("Macintosh SSD", { exact: true }).first();
  await prefs.getByRole("checkbox", { name: "Hard disks", exact: true }).click();
  step(
    "Hard disks off takes the disk off the desktop",
    await until(
      async () =>
        (await page.locator(".mac-desktop-icon", { hasText: "Macintosh SSD" }).count()) === 0,
    ),
  );
  await prefs.getByRole("checkbox", { name: "Hard disks", exact: true }).click();
  step("and on brings it back", await until(async () => (await disk().count()) > 0));
  await prefs.getByRole("combobox", { name: "New Finder windows show" }).click();
  await page
    .locator("[data-base-ui-portal]")
    .getByRole("option", { name: "Documents", exact: true })
    .click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  step(
    "The window already open stays where it was",
    (await win
      .locator('[role="listbox"], [role="treegrid"]')
      .first()
      .getAttribute("aria-label")) === "shackett",
  );
  step(
    "New Finder windows show is kept on the server",
    await until(async () =>
      String((await settings(page))["finder.newWindow"] ?? "").endsWith("/Documents"),
    ),
  );

  // Tags and Sidebar.
  await pane("Tags");
  await prefs.getByRole("checkbox", { name: "Red", exact: true }).click();
  step(
    "Tags: a tag left out goes from the sidebar",
    await until(async () => (await place("Red").count()) === 0),
  );
  await shot(page, path.join(out, `finder-preferences-tags-${browserName}.png`));
  await pane("Sidebar");
  await prefs.getByRole("checkbox", { name: "Recents", exact: true }).click();
  step(
    "Sidebar: a place left out goes from the sidebar",
    await until(async () => (await place("Recents").count()) === 0),
  );
  await prefs.getByRole("checkbox", { name: "Recents", exact: true }).click();

  // Advanced: folders on top.
  await pane("Advanced");
  await shot(page, path.join(out, `finder-preferences-advanced-${browserName}.png`));
  await place("Documents").click({ force: true });
  const firstItem = async () =>
    ((await win.getByRole("option").first().innerText()) ?? "").replace(/\s+/g, " ").trim();
  await until(async () => (await firstItem()).startsWith("Aa"));
  await choose(page, "Finder", "Preferences…");
  await prefs
    .getByRole("checkbox", { name: "In windows when sorting by name", exact: true })
    .click();
  step(
    "Keep folders on top puts a folder before an earlier name",
    await until(async () => (await firstItem()).startsWith("Zz")),
    await firstItem(),
  );

  // Advanced: the search scope.
  await prefs.getByRole("radio", { name: "Search This Mac", exact: true }).click();
  await until(async () => (await settings(page))["finder.searchScope"] === "mac");
  const search = win.locator(".mac-finder-search input");
  await search.fill("note");
  step(
    "Search This Mac: a search begins on This Mac",
    await until(
      async () =>
        (await win
          .getByRole("radio", { name: "This Mac", exact: true })
          .getAttribute("aria-checked")) === "true" ||
        (await win
          .getByRole("button", { name: "This Mac", exact: true })
          .getAttribute("aria-pressed")) === "true",
    ),
  );
  await search.fill("");

  // Advanced: an extension's warning.
  const item = (name) => win.getByRole("option", { name, exact: true }).first();
  await item(NOTE).click();
  await page.keyboard.press("Enter");
  await win.locator("input.mac-finder-rename, .mac-finder-rename input").first().waitFor();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(`Aa note ${tag}.md`);
  await page.keyboard.press("Enter");
  const asked = page.getByRole("alertdialog");
  step(
    "Changing an extension asks first",
    await asked.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    ),
  );
  await shot(page, path.join(out, `finder-preferences-extension-${browserName}.png`));
  await asked.getByRole("button", { name: `Use .md`, exact: true }).click();
  step(
    "Use .md changes it, on the server",
    await until(async () =>
      (await drive(page)).entries.some((each) => each.name === `Aa note ${tag}.md`),
    ),
  );

  // Advanced: Empty Trash without its alert.
  await choose(page, "Finder", "Preferences…");
  await prefs
    .getByRole("checkbox", { name: "Show warning before emptying the Trash", exact: true })
    .click();
  await until(async () => (await settings(page))["finder.warnEmpty"] === false);
  await choose(page, "Finder", "Empty Trash…");
  step(
    "Warning off: Empty Trash empties it at once, on the server, with no alert",
    (await until(async () => (await entry(page, binId)) === undefined)) &&
      (await page.getByRole("alertdialog").count()) === 0,
  );

  // Remove from the Trash after 30 days: Aged goes to the Trash, and the browser's clock moves on.
  await item(AGED).click({ force: true });
  await choose(page, "File", "Move to Trash");
  await until(async () => (await entry(page, agedId))?.trashed_ms !== undefined);
  await choose(page, "Finder", "Preferences…");
  await page.clock.setFixedTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
  // The first request to erase it is refused: the item stays, and turning the setting off and on asks
  // again.
  let refusals = 1;
  const ops = "**/api/files/ops*";
  await page.route(ops, async (route) => {
    if (refusals > 0 && route.request().postData()?.includes('"delete"')) {
      refusals -= 1;
      await route.fulfill({ status: 409, json: { error: "not now" } });
    } else await route.continue();
  });
  expectRefusal(409, "/api/files/ops");
  const after30 = prefs.getByRole("checkbox", {
    name: "Remove items from the Trash after 30 days",
    exact: true,
  });
  await after30.click();
  const refusalAlert = page.getByRole("alertdialog");
  await refusalAlert.waitFor({ timeout: 5_000 });
  step("A refused erase says so, and the item stays", (await entry(page, agedId)) !== undefined);
  await refusalAlert.getByRole("button").first().click();
  await page.unroute(ops);
  // A new window loads the drive again, with nothing changed on it.
  await choose(page, "File", "New Finder Window");
  step(
    "Items over 30 days old leave the Trash, on the server, at the next load",
    await until(async () => (await entry(page, agedId)) === undefined),
  );
  await until(async () => (await windows.count()) === 2);
  await choose(page, "File", "Close Window");
  await until(async () => (await windows.count()) === 1);

  // New Finder windows show.
  await choose(page, "File", "New Finder Window");
  await until(async () => (await windows.count()) === 2);
  step(
    "A new window shows the folder Preferences asks for",
    await until(async () => {
      const labels = await page
        .locator('.mac-finder [role="listbox"], .mac-finder [role="treegrid"]')
        .evaluateAll((views) => views.map((view) => view.getAttribute("aria-label")));
      return labels.filter((label) => label === "Documents").length === 2;
    }),
  );
});
