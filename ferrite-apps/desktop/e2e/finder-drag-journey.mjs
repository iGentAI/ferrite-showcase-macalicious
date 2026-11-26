#!/usr/bin/env node
// Finder's drag depth, with a real mouse: a rubber band selects the items it touches, and Escape
// puts the selection back; a drag resting on a folder opens it, so a file can go in further; a file
// dropped on the path bar goes to that folder, and on a tab to that tab's folder. Moves are read
// back from the server.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-drag-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-drag");
const tag = Date.now().toString(36);
const A = `Band A ${tag}.txt`;
const B = `Band B ${tag}.txt`;
const C = `Band C ${tag}.txt`;
const OUTER = `Outer ${tag}`;
const INNER = `Inner ${tag}`;

const drive = async (page) => (await api(page, "GET", "/api/files/")).json;
const parentOf = async (page, id) => (await drive(page)).entries.find((e) => e.id === id)?.parent;

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function centre(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element to drag from or to is not shown");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const made = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: "documents", name: OUTER }],
  });
  const outerId = made.json.created?.[0];
  const madeInner = await api(page, "POST", "/api/files/ops", {
    ops: [{ op: "mkdir", parent: outerId, name: INNER }],
  });
  const innerId = madeInner.json.created?.[0];
  const ids = {};
  for (const name of [A, B, C]) {
    ids[name] = await uploadFile(page, {
      parent: "documents",
      name,
      type: "text/plain",
      text: name,
    });
  }
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const win = page.locator(".mac-window.mac-finder").first();
  await win.waitFor({ timeout: 10_000 });
  const item = (name) => win.getByRole("option", { name, exact: true }).first();
  const shown = () => win.getByRole("listbox").first().getAttribute("aria-label");
  const selected = async (name) => (await item(name).getAttribute("aria-selected")) === "true";
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await item(A).waitFor({ timeout: 10_000 });

  // The rubber band, from the empty space below the items up over the first row, with C selected.
  await item(C).click();
  const view = await win.getByRole("listbox").first().boundingBox();
  const a = await item(A).boundingBox();
  const b = await item(B).boundingBox();
  await page.mouse.move(view.x + view.width - 30, view.y + view.height - 30);
  await page.mouse.down();
  await page.mouse.move(view.x + view.width - 60, view.y + view.height - 60, { steps: 3 });
  await page.mouse.move(Math.min(a.x, b.x) + 4, a.y + a.height / 2, { steps: 8 });
  step(
    "the band draws while the pointer moves, filled",
    (await win.locator(".mac-finder-marquee").count()) === 1 &&
      (await win
        .locator(".mac-finder-marquee")
        .evaluate((band) => getComputedStyle(band).backgroundColor)) !== "rgba(0, 0, 0, 0)",
  );
  step("it selects the items it touches", (await selected(A)) && (await selected(B)));
  await shot(page, path.join(out, `finder-marquee-${browserName}.png`));
  await page.keyboard.press("Escape");
  await page.mouse.up();
  step(
    "Escape stops it and selects what was selected before",
    !(await selected(A)) &&
      (await selected(C)) &&
      (await win.locator(".mac-finder-marquee").count()) === 0,
  );
  await page.mouse.move(view.x + view.width - 30, view.y + view.height - 30);
  await page.mouse.down();
  await page.mouse.move(view.x + view.width - 60, view.y + view.height - 60, { steps: 3 });
  await page.mouse.move(Math.min(a.x, b.x) + 4, a.y + a.height / 2, { steps: 8 });
  await page.mouse.up();
  step(
    "let go, the band goes and the selection stays",
    (await selected(A)) &&
      (await selected(B)) &&
      (await win.locator(".mac-finder-marquee").count()) === 0,
  );

  // A spring-loaded folder: rest on Outer, and it opens with the drag still going; drop on Inner.
  await item(C).click();
  const c = await centre(item(C));
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 10, c.y + 10, { steps: 3 });
  const outer = await centre(item(OUTER));
  await page.mouse.move(outer.x, outer.y, { steps: 8 });
  step(
    "a drag resting on a folder opens it",
    await until(async () => (await shown()) === OUTER, 3_000),
  );
  await item(INNER).waitFor({ timeout: 4_000 });
  await shot(page, path.join(out, `finder-spring-${browserName}.png`));
  const inner = await centre(item(INNER));
  await page.mouse.move(inner.x, inner.y, { steps: 6 });
  await page.mouse.up();
  step(
    "let go on the folder inside, the file moves there, on the server",
    await until(async () => (await parentOf(page, ids[C])) === innerId),
  );
  step("let go before it opens, the window stays", (await shown()) === OUTER);

  // The path bar.
  await item(INNER).dblclick();
  await item(C).waitFor({ timeout: 6_000 });
  await item(C).click();
  const crumb = win.locator('[data-finder-path$="/Documents"]').first();
  const from = await centre(item(C));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
  const to = await centre(crumb);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  step(
    "the path bar's folder is marked as the target",
    (await crumb.getAttribute("data-desktop-drop")) === "accept",
  );
  await page.mouse.up();
  step(
    "let go on the path bar, the file moves to that folder, on the server",
    await until(async () => (await parentOf(page, ids[C])) === "documents"),
  );

  // A tab.
  await win.getByRole("treeitem", { name: "Documents", exact: true }).click();
  await item(C).waitFor({ timeout: 6_000 });
  await win.getByRole("button", { name: "Action", exact: true }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "New Tab", exact: true }).click();
  await until(async () => (await win.getByRole("tab").count()) === 2);
  await win.getByRole("treeitem", { name: "Downloads", exact: true }).click();
  await until(async () => (await shown()) === "Downloads");
  await win.getByRole("tab").first().click();
  await until(async () => (await shown()) === "Documents");
  await item(C).waitFor({ timeout: 6_000 });
  const start = await centre(item(C));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y + 10, { steps: 3 });
  const tabAt = await centre(win.getByRole("tab").last());
  await page.mouse.move(tabAt.x, tabAt.y, { steps: 8 });
  await page.mouse.up();
  step(
    "let go on a tab, the file moves to that tab's folder, on the server",
    await until(async () => (await parentOf(page, ids[C])) === "downloads"),
  );
});
