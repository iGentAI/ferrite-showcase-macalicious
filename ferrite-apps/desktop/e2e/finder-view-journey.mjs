#!/usr/bin/env node
// Finder's View menu and View Options, on the signed-in person's drive: Sort By puts the items in the
// asked order; the toolbar, tab bar and preview hide and show; View Options changes the folder shown,
// its columns and its look, and Use as Defaults reaches a folder with nothing of its own. What is kept
// is read back from the person's settings on the server.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-view-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-view");
const tag = Date.now().toString(36);
const BIG = `Zed big ${tag}.txt`;
const SMALL = `Aa small ${tag}.txt`;

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

async function sortBy(page, label) {
  await bar(page).getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sort By", exact: true }).hover();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
  await menusClosed(page);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await uploadFile(page, { parent: "documents", name: SMALL, type: "text/plain", text: "a" });
  await uploadFile(page, {
    parent: "documents",
    name: BIG,
    type: "text/plain",
    text: "b".repeat(5000),
  });
  const madeHolder = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "downloads", name: `Holds ${tag}` }],
  });
  await uploadFile(page, {
    parent: madeHolder.json.created?.[0],
    name: `Inner ${tag}.txt`,
    type: "text/plain",
    text: "b".repeat(5000),
  });
  await uploadFile(page, {
    parent: "downloads",
    name: `One ${tag}.txt`,
    type: "text/plain",
    text: "a",
  });
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await win.getByRole("option", { name: BIG, exact: true }).waitFor({ timeout: 10_000 });
  const order = async () =>
    (await win.getByRole("option").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim());

  await bar(page).getByRole("menuitem", { name: "View", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sort By", exact: true }).hover();
  await page.getByRole("menuitemradio", { name: "Date Last Opened", exact: true }).waitFor();
  const sorts = await page.getByRole("menuitemradio").allInnerTexts();
  step(
    "Sort By lists every order",
    ["Date Last Opened", "Date Created", "Tags"].every((label) =>
      sorts.some((text) => text.includes(label)),
    ),
  );
  await shot(page, path.join(out, `finder-view-sort-${browserName}.png`));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await menusClosed(page);

  await sortBy(page, "Size");
  step(
    "Sort By Size puts the largest first",
    await until(async () => (await order())[0]?.startsWith("Zed")),
  );
  await sortBy(page, "Name");
  step("Sort By Name puts it back", await until(async () => (await order())[0]?.startsWith("Aa")));

  // The bars.
  await choose(page, "View", "Toolbar", "menuitemcheckbox");
  step(
    "View > Toolbar hides the toolbar",
    await until(
      async () => (await win.getByRole("toolbar", { name: "Finder toolbar" }).count()) === 0,
    ),
  );
  await shot(page, path.join(out, `finder-view-no-toolbar-${browserName}.png`));
  await win.click({ position: { x: 500, y: 10 } });
  await page.keyboard.press("Control+Alt+t");
  step(
    "Option-Command-T shows it again",
    await until(
      async () => (await win.getByRole("toolbar", { name: "Finder toolbar" }).count()) === 1,
    ),
  );
  await choose(page, "View", "Tab Bar", "menuitemcheckbox");
  step(
    "View > Tab Bar shows the tab bar with one tab",
    await until(async () => (await win.getByRole("tab").count()) === 1),
  );
  await choose(page, "View", "Tab Bar", "menuitemcheckbox");
  await until(async () => (await win.getByRole("tab").count()) === 0);

  // View Options.
  await choose(page, "View", "Show View Options");
  const panel = page.locator(".mac-finder-options");
  await panel.waitFor({ timeout: 5_000 });
  step("Show View Options opens the window on the folder", await panel.isVisible());
  await shot(page, path.join(out, `finder-view-options-icons-${browserName}.png`));
  await panel.getByRole("radio", { name: "Color", exact: true }).click();
  step(
    "Background: Color colours the view, kept on the server",
    await until(async () => {
      const documents = (await settings(page))["finder.folders"]?.documents;
      return documents?.background === "#d6e6f5";
    }),
  );
  await shot(page, path.join(out, `finder-view-color-${browserName}.png`));
  await panel.getByRole("radio", { name: "White", exact: true }).click();

  await choose(page, "View", "as List", "menuitemradio");
  await win.getByRole("treegrid").waitFor({ timeout: 5_000 });
  await panel.getByRole("checkbox", { name: "Date Created", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Tags", exact: true }).click();
  const headers = () => win.getByRole("columnheader").allInnerTexts();
  step(
    "Show Columns adds Date Created and Tags to the list",
    await until(async () => {
      const shown = await headers();
      return shown.includes("Date Created") && shown.includes("Tags");
    }),
  );
  await panel.getByRole("checkbox", { name: "Use relative dates", exact: true }).click();
  step(
    "Use relative dates shows Today in the list",
    await until(async () => (await win.getByText(/^Today, /).count()) > 0),
  );
  await shot(page, path.join(out, `finder-view-options-list-${browserName}.png`));
  await panel.getByRole("button", { name: "Use as Defaults", exact: true }).click();
  step(
    "Use as Defaults is kept on the server",
    await until(async () => (await settings(page))["finder.defaults"]?.view === "list"),
  );
  await choose(page, "Go", "Downloads");
  step(
    "A folder with nothing of its own shows the defaults",
    await until(async () => {
      const label = await win.getByRole("treegrid").first().getAttribute("aria-label");
      return label === "Downloads" && (await headers()).includes("Date Created");
    }),
  );
  await choose(page, "View", "Hide View Options");
  step("Hide View Options closes it", await until(async () => (await panel.count()) === 0));

  // All sizes counts in the order too: a folder of 5000 bytes above a file of one.
  const rows = async () =>
    (await win.getByRole("row").allInnerTexts()).map((text) => text.trim().split(/\s+/)[0]);
  await choose(page, "View", "Show View Options");
  await panel.waitFor({ timeout: 5_000 });
  await panel.getByRole("checkbox", { name: "Calculate all sizes", exact: true }).click();
  await sortBy(page, "Size");
  step(
    "With all sizes, Sort By Size puts a large folder above a small file",
    await until(async () => {
      const names = await rows();
      return names.indexOf("Holds") >= 0 && names.indexOf("Holds") < names.indexOf("One");
    }),
    (await rows()).join(" "),
  );

  // Recents, which is no folder, keeps what it is given.
  await choose(page, "Go", "Recents");
  await until(
    async () => (await win.getByRole("treegrid").first().getAttribute("aria-label")) === "Recents",
  );
  await panel.getByRole("checkbox", { name: "Date Last Opened", exact: true }).click();
  step(
    "View Options changes what Recents shows",
    await until(async () => (await headers()).includes("Date Last Opened")),
  );

  // White in a folder stays white where the defaults have a colour.
  await choose(page, "View", "as Icons", "menuitemradio");
  await panel.getByRole("radio", { name: "Color", exact: true }).click();
  await panel.getByRole("button", { name: "Use as Defaults", exact: true }).click();
  await until(async () => (await settings(page))["finder.defaults"]?.background === "#d6e6f5");
  await panel.getByRole("radio", { name: "White", exact: true }).click();
  const background = () =>
    win
      .locator(".mac-finder-view")
      .first()
      .evaluate((view) => getComputedStyle(view).backgroundColor);
  const colored = "rgb(214, 230, 245)";
  step(
    "White overrides a default colour in the folder that chose it",
    await until(async () => (await background()) !== colored),
  );
  await choose(page, "Go", "Desktop");
  await choose(page, "View", "as Icons", "menuitemradio");
  step(
    "and a folder with nothing of its own keeps the colour",
    await until(async () => (await background()) === colored),
  );
  await page.reload();
  await openDesktop(page, base, step);
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  await page.locator(".mac-window.mac-finder").first().waitFor({ timeout: 10_000 });
  await choose(page, "Go", "Recents");
  const again = page.locator(".mac-window.mac-finder").first();
  await again.locator(".mac-finder-view").first().waitFor({ timeout: 8_000 });
  step(
    "and after a reload the white folder is still white",
    await until(
      async () =>
        (await again
          .locator(".mac-finder-view")
          .first()
          .evaluate((view) => getComputedStyle(view).backgroundColor)) !== colored,
    ),
  );
});
