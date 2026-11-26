#!/usr/bin/env node
// R4 census crawler: the mechanical enumeration half of the census (brief section 5). For one app in one engine it
// signs up a fresh account, opens the app, and records every interactive node of the accessibility tree:
//   - the app's windows (diffed against the bare desktop, so the Dock and the desktop's own controls are left out);
//   - every menu of the menu bar except the Apple menu (R2's), and every submenu, with each item's shortcut, role,
//     checked and disabled state, read from the open menus;
//   - every state a button of the window opens (a popover, menu, sheet or panel): each non-destructive button is
//     clicked and the controls that appear are recorded under `after:<button>`; menu items that open a panel or
//     dialog (titles ending in an ellipsis, or `Show ...`) the same way, under `after:<menu>/<item>`;
//   - each app's own extra states (`--app` table below), reached with real input.
// Output: `campaign/round3/r4/census/crawl/<app>-<engine>.tsv` (engine, app, state, path, role, name, attrs,
// shortcut). Reading (`ariaSnapshot`, `page.evaluate` that only reads) is how a crawler sees; every state change is
// real input.
//
//   node e2e/r4-crawl.mjs --app notes|textedit|stickies|script-editor|font-book|mail-compose
//                         [--browser chromium|chrome|firefox|webkit] [--url http://127.0.0.1:8080] [--tsv <file>]

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acceptUnload,
  createAccount,
  installApps,
  launchEngine,
  menuBar,
  newIdentity,
  openFromDock,
  options,
  parseSnapshot,
  readOpenMenus,
  reload,
  sleep,
  watchPage,
} from "./r4-census-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const opts = options();
const args = process.argv.slice(2);
const tsvAt = args.indexOf("--tsv");

/** Each app: how its window opens, the window regions that belong to it, and its own extra states. */
const APPS = {
  notes: { dock: "Notes", window: "Notes" },
  textedit: { dock: "TextEdit", window: { selector: '[data-window-id="textedit"]' } },
  stickies: { dock: "Stickies", window: { selector: ".mac-stickies-note" } },
  "script-editor": {
    dock: "Script Editor",
    window: { selector: '[data-window-id="script-editor"]' },
    install: "script-editor",
  },
  "font-book": { dock: "Font Book", window: /\(\d+ Fonts?\)$/ },
  "mail-compose": {
    dock: "Mail",
    window: { selector: '[data-window-id="mail"]' },
    // The New Message window: Mail's toolbar button opens it.
    after: async (page) => {
      const compose = page.getByRole("button", { name: "New Message" }).first();
      await compose.waitFor({ timeout: 15_000 });
      await compose.click();
      await page.getByRole("textbox", { name: "Message" }).first().waitFor({ timeout: 15_000 });
      await sleep(600);
    },
    focus: /New Message/,
  },
};

const app = opts.app;
if (!Object.hasOwn(APPS, app)) {
  console.error(`--app must be one of ${Object.keys(APPS).join(", ")}`);
  process.exit(2);
}
const spec = APPS[app];
/** Never clicked by the crawl: they end the state being crawled or destroy data (each is a census row by hand). */
const DENY =
  /^(Close|Minimize|Minimise|Enter Full Screen|Exit Full Screen|Zoom|Delete|Delete Note|Move to Trash|Quit|Log Out|Send|Remove|Discard|Don’t Save|Delete Folder|Revert)/i;

const lines = [];
const seen = new Set();
const record = (state, node) => {
  const key = `${state}\t${node.path}\t${node.role}\t${node.name}`;
  if (seen.has(key)) return;
  seen.add(key);
  lines.push(
    [
      opts.browserName,
      app,
      state,
      node.path,
      node.role,
      node.name,
      node.attrs ?? "",
      node.shortcut ?? "",
    ]
      .map((v) => String(v).replace(/[\t\n]/g, " "))
      .join("\t"),
  );
};

const browser = await launchEngine(opts.browserName);
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const watch = watchPage(page);
acceptUnload(page);

/** The body's snapshot as a multiset of node keys, to diff states. */
const snapshotNodes = async () =>
  parseSnapshot(await page.locator("body").ariaSnapshot({ timeout: 15_000 }));
const keyOf = (node) => `${node.path}|${node.role}|${node.name}`;

async function openApp() {
  // A failed launch propagates to CRAWL_ABORT: no census is written from a desktop without the app.
  await openFromDock(page, spec.dock, spec.window);
  if (spec.after) await spec.after(page);
  await sleep(800);
}

/** Crawl the menus of the menu bar (not Apple's), with every submenu. */
async function crawlMenus(state) {
  const titles = await menuBar(page)
    .getByRole("menuitem")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("aria-label") ?? item.textContent.trim()),
    );
  for (const title of titles) {
    if (!title || title === "Apple") continue;
    await page.keyboard.press("Escape");
    await menuBar(page).getByRole("menuitem", { name: title, exact: true }).click();
    await sleep(300);
    const visit = async (trail, depth) => {
      const menus = await readOpenMenus(page);
      const menu = menus.at(-1);
      if (!menu) return;
      for (const item of menu.items) {
        if (!item.name) continue;
        record(state, {
          path: `menubar > ${trail.join(" > ")}`,
          role: item.role,
          name: item.name,
          attrs: [
            item.disabled ? "[disabled]" : "",
            item.checked ? `[checked=${item.checked}]` : "",
            item.submenu ? "[submenu]" : "",
          ]
            .filter(Boolean)
            .join(" "),
          shortcut: item.shortcut,
        });
      }
      if (depth >= 3) return;
      for (const item of menu.items) {
        if (!item.submenu || item.disabled) continue;
        // Each submenu is reached from the menu bar again: the title clicked, the pointer down the trail.
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await sleep(120);
        await menuBar(page).getByRole("menuitem", { name: trail[0], exact: true }).click();
        await sleep(250);
        let reached = true;
        for (const step of [...trail.slice(1), item.name]) {
          const trigger = page
            .getByRole("menu")
            .last()
            .getByRole("menuitem", { name: step, exact: true })
            .first();
          if ((await trigger.count()) === 0) {
            reached = false;
            break;
          }
          await trigger.hover();
          await sleep(350);
        }
        if (reached && (await readOpenMenus(page)).length > trail.length)
          await visit([...trail, item.name], depth + 1);
      }
    };
    await visit([title], 1);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await sleep(150);
  }
}

/** Click `target` and record every control that appears; restore the app afterwards. */
async function crawlOpener(state, perform, baseline) {
  try {
    await perform();
  } catch (error) {
    console.log(`note: ${state} not reached: ${String(error.message).split("\n")[0]}`);
    return;
  }
  await sleep(700);
  const after = await snapshotNodes();
  const known = new Set(baseline.map(keyOf));
  const fresh = after.filter((node) => !known.has(keyOf(node)));
  for (const node of fresh) record(state, node);
  // Menus opened by the click (a pop-up button or a toolbar menu): their items too.
  const menus = await readOpenMenus(page);
  for (const menu of menus) {
    for (const item of menu.items) {
      if (item.name)
        record(state, {
          path: `menu:${menu.label}`,
          role: item.role,
          name: item.name,
          attrs: item.disabled ? "[disabled]" : "",
          shortcut: item.shortcut,
        });
    }
  }
  console.log(`state ${state}: ${fresh.length} new nodes`);
  for (let index = 0; index < 3; index += 1) await page.keyboard.press("Escape");
  await sleep(250);
  // Anything left changed (a panel or a sheet still open, a view switched): start over from a reload.
  const now = await snapshotNodes();
  const nowKeys = new Set(now.map(keyOf));
  const same = baseline.length === now.length && baseline.every((node) => nowKeys.has(keyOf(node)));
  if (!same) {
    await reload(page);
    await openApp();
  }
}

try {
  await page.goto(`${opts.base}/`, { waitUntil: "load" });
  await createAccount(
    page,
    newIdentity(`cr${app.replace(/[^a-z]/g, "").slice(0, 4)}`, opts.browserName),
  );
  if (spec.install) {
    // Setup, not a census action: the app is put in the account's library as the App Store's Get does (R5's row).
    const answer = await installApps(page, [spec.install]);
    if (answer.status !== 200) throw new Error(`installing ${spec.install}: HTTP ${answer.status}`);
    await reload(page);
  }
  const desktop = new Set((await snapshotNodes()).map(keyOf));
  await openApp();
  const baseline = await snapshotNodes();
  // The app's windows: every node the bare desktop did not have, apart from the menu bar (crawled as menus).
  const own = baseline.filter(
    (node) => !desktop.has(keyOf(node)) && !/^menubar|navigation:Dock|toolbar:Dock/.test(node.path),
  );
  for (const node of own) record("window", node);
  console.log(`window: ${own.length} nodes`);
  await crawlMenus("window");

  // Every non-destructive button of the app's windows, clicked once.
  const buttons = own.filter(
    (node) =>
      (node.role === "button" || node.role === "menuitem") &&
      node.name &&
      !DENY.test(node.name) &&
      !/disabled/.test(node.attrs),
  );
  for (const button of buttons) {
    const scope = button.path.split(" > ").find((part) => part.startsWith("region:"));
    const regionName = scope ? scope.slice("region:".length) : null;
    await crawlOpener(
      `after:${button.name}`,
      async () => {
        const root = regionName
          ? page.getByRole("region", { name: regionName, exact: true }).first()
          : page.locator("body");
        await root
          .getByRole(button.role, { name: button.name, exact: true })
          .first()
          .click({ timeout: 4_000 });
      },
      baseline,
    );
  }

  // Menu items that open a panel or a dialog.
  const openers = lines
    .map((line) => line.split("\t"))
    .filter(
      ([, , state, trail, role, name, attrs]) =>
        state === "window" &&
        trail.startsWith("menubar") &&
        role === "menuitem" &&
        !/disabled|submenu/.test(attrs) &&
        (/…$/.test(name) || /^Show /.test(name)) &&
        !DENY.test(name),
    )
    .map(([, , , trail, , name]) => ({
      trail: trail.replace(/^menubar > /, "").split(" > "),
      name,
    }));
  for (const opener of openers) {
    await crawlOpener(
      `after:${[...opener.trail, opener.name].join("/")}`,
      async () => {
        await menuBar(page).getByRole("menuitem", { name: opener.trail[0], exact: true }).click();
        for (const sub of opener.trail.slice(1)) {
          await page.getByRole("menuitem", { name: sub, exact: true }).last().hover();
          await sleep(300);
        }
        const scope = page.getByRole("menu").last();
        await scope
          .getByRole("menuitem", { name: opener.name, exact: true })
          .first()
          .click({ timeout: 4_000 });
      },
      baseline,
    );
  }
} catch (error) {
  console.log(`CRAWL_ABORT ${String(error.message).split("\n")[0]}`);
  await page
    .screenshot({ path: `/tmp/r4-crawl-${app}-${opts.browserName}-abort.png` })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

const file =
  tsvAt >= 0
    ? path.resolve(args[tsvAt + 1])
    : path.resolve(
        here,
        "../../../../campaign/round3/r4/census/crawl",
        `${app}-${opts.browserName}.tsv`,
      );
if (process.exitCode === 1) {
  console.log(`crawl ${app} ${opts.browserName}: aborted; ${file} not written`);
  process.exit(1);
}
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(
  file,
  `${["engine", "app", "state", "path", "role", "name", "attrs", "shortcut"].join("\t")}\n${lines.join("\n")}\n`,
);
console.log(`crawl ${app} ${opts.browserName}: ${lines.length} nodes -> ${file}`);
if (watch.problems.length > 0)
  console.log(`page problems during the crawl:\n  ${watch.problems.join("\n  ")}`);
