#!/usr/bin/env node
// Diagnosis (asserts nothing): does one real mouse click on a menu bar title open its menu? R6 saw a first click on
// "Window" open nothing now and then, a second click opening it; R2's kit retried the same way. With Console's window
// key, each condition below prepares the desktop with real input, waits `delay` ms, then clicks the Window title once at
// its centre (page.mouse, no retry) and records whether a menu is open within 1.5 s. Delays from 0 ms (no person clicks
// that fast after the previous action) to 600 ms separate what only a harness can do from what a person meets.
//
//   node e2e/r2-menu-click-probe.mjs --url http://127.0.0.1:8080 --browser chromium --out <dir> [--repeat 5]

import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  censusOptions,
  closeMenus,
  createAccount,
  dockButton,
  ENGINES,
  managedOf,
  menuTitle,
  openFromDock,
  ownPoint,
  person,
} from "./r2-census-kit.mjs";

const { base, out, browserName, run } = censusOptions();
const at = process.argv.indexOf("--repeat");
const repeat = at > 0 ? Number(process.argv[at + 1]) : 5;
const browser = await ENGINES[browserName](false);
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
await createAccount(page, base, person(run, "menuprobe", "Menu Probe"));
const consoleWin = await openFromDock(page, "Console", "console");

const openMenu = () => page.locator('[role="menu"][data-open]').last();
const isOpen = () =>
  openMenu()
    .waitFor({ timeout: 1_500 })
    .then(
      () => true,
      () => false,
    );
/** The Window menu itself is open (its own Bring All to Front item), not another menu left open. */
const windowMenuOpen = () =>
  page
    .locator('[role="menu"][data-open]')
    .getByRole("menuitem", { name: "Bring All to Front", exact: true })
    .first()
    .waitFor({ timeout: 1_500 })
    .then(
      () => true,
      () => false,
    );
/** A preparation step that did not happen: the trial is recorded as unprepared and not measured. */
class Unprepared extends Error {}
const must = async (step, what) => {
  if (!(await step)) throw new Unprepared(what);
};
/** A real click at the centre of the menu bar title `name`. */
async function clickTitle(name) {
  const box = await menuTitle(page, name).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function openByClick(name) {
  await clickTitle(name);
  return isOpen();
}
const item = (name) => openMenu().getByRole("menuitem", { name, exact: true }).first();
async function clickItem(name) {
  const box = await item(name).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
/** Console key and in front, no menu open. */
async function reset() {
  await closeMenus(page);
  if ((await managedOf(page, "console").count()) === 0)
    await openFromDock(page, "Console", "console");
  const frame = managedOf(page, "console");
  if (await frame.evaluate((e) => e.hasAttribute("data-minimized")))
    await dockButton(page, "Console").click();
  const point = await ownPoint(frame);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(700);
}

const CONDITIONS = {
  fresh: async () => {},
  "after choosing an item": async () => {
    await must(openByClick("Window"), "Window did not open");
    await clickItem("Bring All to Front");
  },
  "after Escape": async () => {
    await must(openByClick("View"), "View did not open");
    await page.keyboard.press("Escape");
  },
  "after closing by its title": async () => {
    await must(openByClick("View"), "View did not open");
    await clickTitle("View");
  },
  "while another menu is open": async () => {
    await must(openByClick("View"), "View did not open");
  },
  "after clicking into the window": async () => {
    const point = await ownPoint(consoleWin);
    await page.mouse.click(point.x, point.y);
  },
  "after the Dock tile brings it back": async () => {
    await must(openByClick("Window"), "Window did not open");
    await clickItem("Minimize");
    await page.waitForTimeout(700);
    const tiles = page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: /minimized window$/ });
    await must(tiles.first().isVisible(), "no minimized window tile");
    const box = await tiles.first().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  },
};
const DELAYS = [0, 100, 300, 600];

const results = [];
for (const [condition, prepare] of Object.entries(CONDITIONS))
  for (const delay of DELAYS)
    for (let i = 0; i < repeat; i += 1) {
      await reset();
      let opened = false;
      let error = null;
      let unprepared = null;
      try {
        await prepare();
        await page.waitForTimeout(delay);
        await clickTitle("Window");
        opened = await windowMenuOpen();
      } catch (e) {
        if (e instanceof Unprepared) unprepared = e.message;
        else error = String(e.message).split("\n")[0];
      }
      // What was open instead, when the Window menu was not: diagnosis only.
      const title =
        !opened && !unprepared && (await isOpen())
          ? await openMenu()
              .getByRole("menuitem")
              .first()
              .textContent()
              .catch(() => null)
          : null;
      results.push({ condition, delay, opened, unprepared, instead: title, error });
    }

const summary = {};
for (const r of results) {
  const k = `${r.condition} @${r.delay}ms`;
  summary[k] ??= { tries: 0, opened: 0, unprepared: 0, errors: 0 };
  if (r.unprepared) {
    summary[k].unprepared += 1;
    continue;
  }
  summary[k].tries += 1;
  if (r.opened) summary[k].opened += 1;
  if (r.error) summary[k].errors += 1;
}
for (const [k, v] of Object.entries(summary))
  console.log(
    `PROBE ${k}: ${v.opened}/${v.tries} opened the Window menu${v.unprepared ? `, ${v.unprepared} not prepared (not counted)` : ""}${v.errors ? `, ${v.errors} error(s)` : ""}`,
  );
writeFileSync(
  path.join(out, `menu-click-${browserName}.json`),
  JSON.stringify({ problems, summary, results }, null, 1),
);
const measured = results.filter((r) => !r.unprepared);
console.log(
  `PROBE_DONE ${measured.length} measured clicks, ${measured.filter((r) => !r.opened).length} did not open the Window menu, ${results.length - measured.length} not prepared, ${problems.length} page problems`,
);
await browser.close();
