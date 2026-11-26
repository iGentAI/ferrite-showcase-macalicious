#!/usr/bin/env node
// Folders dragged to the sidebar: on the Favorites heading or between its rows they are added, on a row
// they go into that place; those added are dragged along each other and kept across a reload.
//
//   node e2e/finder-sidebar-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { api, journey, launch, openDesktop, options, reloadDesktop } from "./app-journey.mjs";

const { base } = options();
const { step, run } = journey("finder-sidebar");
const tag = Date.now().toString(36);
const [ONE, TWO, THREE] = ["One", "Two", "Three"].map((name) => `${name} ${tag}`);

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
  const { json: made } = await api(page, "POST", "/api/files/ops", {
    ops: [ONE, TWO, THREE].map((name) => ({ op: "mkdir", parent: "documents", name })),
  });
  const [oneId, twoId] = made.created;
  await reloadDesktop(page);
  await launch(page, "Finder");
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 8_000 });
  const sidebar = finder.locator("[data-finder-favorites]");
  await sidebar.getByRole("treeitem", { name: "Documents" }).click();
  const item = (name) => finder.getByRole("option", { name: new RegExp(name) }).first();
  await item(ONE).waitFor({ timeout: 8_000 });
  const favorites = async () =>
    (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[
      "finder.favorites"
    ] ?? [];
  const dragTo = async (from, x, y) => {
    const box = await from.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2, { steps: 3 });
    await page.mouse.move(x, y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  };

  const section = await sidebar.boundingBox();
  await dragTo(item(ONE), section.x + 40, section.y + 4);
  step(
    "A folder let go on the Favorites heading is added to the sidebar",
    await until(async () => (await favorites()).includes(oneId)),
    JSON.stringify(await favorites()),
  );
  step(
    "and stays where it was",
    (await until(async () => (await sidebar.getByRole("treeitem", { name: ONE }).count()) === 1)) &&
      (await item(ONE).isVisible()),
  );

  const recents = await sidebar.getByRole("treeitem", { name: "Recents" }).boundingBox();
  await dragTo(item(TWO), recents.x + 40, recents.y + recents.height - 1);
  step(
    "A folder let go between two rows is added too",
    await until(async () => (await favorites()).includes(twoId)),
    JSON.stringify(await favorites()),
  );

  const downloads = await sidebar.getByRole("treeitem", { name: "Downloads" }).boundingBox();
  await dragTo(item(THREE), downloads.x + 40, downloads.y + downloads.height / 2);
  const inDownloads = async () =>
    ((await api(page, "GET", "/api/files/")).json.entries ?? []).find(
      (entry) => entry.name === THREE,
    )?.parent === "downloads";
  step("A folder let go on a row goes into that place", await until(inDownloads));

  const first = await sidebar.getByRole("treeitem", { name: ONE }).boundingBox();
  const second = await sidebar.getByRole("treeitem", { name: TWO }).boundingBox();
  await page.mouse.move(first.x + 40, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + 40, second.y + second.height / 2, { steps: 6 });
  await page.mouse.up();
  step(
    "Dragging one the person added moves it along the others",
    await until(async () => {
      const now = await favorites();
      return now.indexOf(twoId) >= 0 && now.indexOf(twoId) < now.indexOf(oneId);
    }),
    JSON.stringify(await favorites()),
  );

  await reloadDesktop(page);
  await finder.waitFor({ timeout: 10_000 });
  const names = await until(async () => {
    const all = await sidebar.getByRole("treeitem").allInnerTexts();
    return all.some((each) => each.includes(ONE)) ? all : null;
  });
  step(
    "The order holds after a reload",
    names &&
      names.findIndex((each) => each.includes(TWO)) < names.findIndex((each) => each.includes(ONE)),
    String(names),
  );
});
