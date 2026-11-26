#!/usr/bin/env node
// Customize Toolbar: items added, moved and taken out, each working in the toolbar, with the label
// modes, kept on the server and across a reload, and the default set back.
//
//   node e2e/finder-toolbar-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-toolbar");

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Finder");
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 8_000 });
  // A sheet leaves what is behind it out of the accessibility tree: looked for by name, not by role.
  const toolbar = finder.locator('[aria-label="Finder toolbar"]');
  const item = (name) => toolbar.locator(`[aria-label="${name}"]`);
  const sheet = page.getByRole("dialog", { name: "Customize Toolbar" });
  const stored = async (key) =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[key];
  const customize = async () => {
    await page
      .getByRole("menubar")
      .first()
      .getByRole("menuitem", { name: "View", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Customize Toolbar…" }).click();
    await sheet.waitFor({ timeout: 4_000 });
  };
  const done = async () => {
    await sheet.getByRole("button", { name: "Done" }).click();
    await sheet.waitFor({ state: "detached", timeout: 4_000 });
  };
  const order = (now) =>
    now.getByRole("listitem").evaluateAll((all) => all.map((each) => each.dataset.toolbarItem));
  const showAs = async (name) => {
    await sheet.getByRole("combobox", { name: "Show:" }).click();
    await page.waitForTimeout(300);
    await page
      .getByRole("listbox")
      .filter({ visible: true })
      .last()
      .getByRole("option", { name, exact: true })
      .click({ force: true });
    await page.waitForTimeout(300);
  };

  step(
    "The toolbar starts as a Mac's, with no optional item",
    (await item("Back").isVisible()) && (await item("Get Info").count()) === 0,
  );

  await customize();
  await sheet.getByRole("button", { name: "New Folder", exact: true }).click();
  await sheet.getByRole("button", { name: "Get Info", exact: true }).click();
  await sheet.getByRole("button", { name: "Connect", exact: true }).click();
  step(
    "Clicking an item puts it in the toolbar at once",
    (await item("New Folder").isVisible()) && (await item("Get Info").isVisible()),
  );
  step(
    "and it cannot be added twice",
    await sheet.getByRole("button", { name: "Get Info", exact: true }).isDisabled(),
  );

  const now = sheet.getByRole("list");
  const before = await order(now);
  await now
    .locator('[data-toolbar-item="connect"]')
    .dragTo(now.locator('[data-toolbar-item="views"]'));
  const after = await order(now);
  step(
    "Dragging moves an item along the toolbar",
    after.indexOf("connect") < before.indexOf("connect") &&
      after.indexOf("connect") === after.indexOf("views") - 1,
    after.join(", "),
  );
  await now.locator('[data-toolbar-item="connect"] button').first().focus();
  await page.keyboard.press("ArrowRight");
  const keyed = await order(now);
  step(
    "and so do the arrow keys",
    keyed.indexOf("connect") === after.indexOf("connect") + 1,
    keyed.join(", "),
  );
  await sheet.getByRole("button", { name: "Remove Group" }).click();
  step("An item taken out goes from the toolbar", (await item("Group").count()) === 0);
  await showAs("Icon and Text");
  const bar = await toolbar.boundingBox();
  step("at a toolbar's height, with the field its own", bar.height < 70, JSON.stringify(bar));
  step(
    "Icon and Text shows each item's label",
    await until(() => toolbar.getByText("New Folder", { exact: true }).isVisible()),
  );
  await shot(page, path.join(out, `finder-toolbar-${browserName}.png`));
  await done();

  await item("Connect").click();
  const connect = page.getByRole("dialog", { name: /Connect to Server/ });
  await connect.waitFor({ timeout: 4_000 });
  step("Connect opens Connect to Server", await connect.isVisible());
  await page.keyboard.press("Escape");
  await connect.waitFor({ state: "detached", timeout: 4_000 });
  const untitled = async () =>
    ((await api(page, "GET", "/api/files/")).json.entries ?? []).filter((entry) =>
      entry.name?.startsWith("untitled folder"),
    ).length;
  await finder.getByRole("treeitem", { name: "Documents" }).first().click();
  await page.waitForTimeout(500);
  const folders = await untitled();
  await item("New Folder").click();
  step("New Folder makes a folder", await until(async () => (await untitled()) > folders));
  await page.keyboard.press("Escape");

  const kept = await until(async () => {
    const items = await stored("finder.toolbarItems");
    return Array.isArray(items) && items.includes("get-info") && !items.includes("group");
  });
  step(
    "The choices are kept on the server",
    kept,
    JSON.stringify(await stored("finder.toolbarItems")),
  );
  await reloadDesktop(page);
  await finder.waitFor({ timeout: 10_000 });
  step(
    "and hold after a reload",
    await until(
      async () =>
        (await item("Get Info").isVisible()) &&
        (await toolbar.getByText("New Folder", { exact: true }).isVisible()) &&
        (await item("Group").count()) === 0,
    ),
  );

  await launch(page, "Finder");
  await page.waitForTimeout(300);

  // The toolbar's own context menu.
  await toolbar.click({ button: "right", position: { x: 400, y: 20 } });
  await page
    .getByRole("menuitemradio", { name: "Icon and Text", exact: true })
    .waitFor({ timeout: 4_000 });
  step(
    "The toolbar's context menu offers how its items show",
    (await page.getByRole("menuitemradio").count()) === 3 &&
      (await page.getByRole("menuitem", { name: "Customize Toolbar…" }).count()) === 1,
  );
  await shot(page, path.join(out, `finder-toolbar-menu-${browserName}.png`));
  await page.getByRole("menuitemradio", { name: "Icon Only", exact: true }).click();
  step(
    "Icon Only from it is kept as the mode",
    await until(async () => (await stored("finder.toolbarMode")) === "icon-only"),
  );
  await toolbar.click({ button: "right", position: { x: 400, y: 20 } });
  await page.getByRole("menuitem", { name: "Customize Toolbar…" }).click();
  await sheet.waitFor({ timeout: 4_000 });
  step("Customize Toolbar… from it opens the sheet", await sheet.isVisible());
  await sheet.getByRole("button", { name: "Use Default Set" }).click();
  await showAs("Text Only");
  await done();
  step(
    "Use Default Set puts the toolbar back",
    (await item("Get Info").count()) === 0 && (await item("Group").count()) === 1,
  );
  step(
    "Text Only is kept as the mode",
    await until(async () => (await stored("finder.toolbarMode")) === "label-only"),
  );
});
