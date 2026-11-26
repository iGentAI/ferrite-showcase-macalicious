// The R6 family's census crawl (round 3): in one engine, a fresh account opens each of Mail, Messages, FaceTime,
// Contacts, Reminders and Calendar from the Dock and enumerates, from the accessibility tree, every control of the
// app's windows and of every menu of the menu bar while it is the front application (submenus hovered open). With
// `--explore` it also clicks, one at a time with the mouse, every enabled control of the app's windows and every enabled
// menu command, and records each control that appears (a window, sheet, popover or menu) as a state of its own, then
// puts the app back (Escape, new windows closed with their own Close button, the app reopened from the Dock).
// Enumeration only: the census journeys verify; this lists.
//
// Usage: node e2e/r6-census-crawl.mjs --browser chromium|chrome|firefox|webkit [--apps mail,calendar] [--explore]
//          [--url http://127.0.0.1:8080] [--out <dir>]
// Writes <out>/<engine>/<app>.tsv (r6-kit's CRAWL_COLUMNS) and prints one CRAWLED line per app.

import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import {
  account,
  crawlMenus,
  enumerate,
  launchEngine,
  menu,
  openApp,
  options,
  pause,
  signUp,
  within,
  writeCrawl,
} from "./r6-kit.mjs";

/** The family's apps: Dock name, the window's region name, the menu titles after the Apple menu (each app.ts). */
export const APPS = {
  mail: {
    name: "Mail",
    window: /Mail|Inbox/,
    menus: ["Mail", "File", "Edit", "View", "Mailbox", "Message", "Format", "Window", "Help"],
  },
  messages: {
    name: "Messages",
    window: /Messages/,
    menus: ["Messages", "File", "Edit", "View", "Buddies", "Window", "Help"],
  },
  facetime: {
    name: "FaceTime",
    window: /FaceTime/,
    menus: ["FaceTime", "File", "Edit", "Video", "Window", "Help"],
  },
  contacts: {
    name: "Contacts",
    window: /Contacts/,
    menus: ["Contacts", "File", "Edit", "View", "Card", "Window", "Help"],
  },
  reminders: {
    name: "Reminders",
    window: /Reminders/,
    menus: ["Reminders", "File", "Edit", "View", "Window", "Help"],
  },
  calendar: {
    name: "Calendar",
    window: /Calendar/,
    menus: ["Calendar", "File", "Edit", "View", "Window", "Help"],
  },
};

/** Commands a probe never chooses: they end the app, hide it, or leave the session. */
const SKIP_COMMANDS =
  /^(Quit |Hide |Hide Others|Show All|Close Window|Minimize|Log Out|Lock Screen|Sleep|Restart|Shut Down)/;
/** Window controls are census rows of their own (close, minimise, zoom), probed by the journeys. */
const WINDOW_CONTROLS =
  /^(Close|Minimize|Zoom|Enter Full Screen|Exit Full Screen|close|minimize|zoom)$/;

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const o = options();
const wanted = arg("--apps", Object.keys(APPS).join(",")).split(",");
const explore = args.includes("--explore");
const outDir = path.join(o.out, o.browserName);
mkdirSync(outDir, { recursive: true });

const keyOf = (c) => `${c.where}|${c.place}|${c.window}|${c.role}|${c.name}`;

/** The app's controls on screen now: its windows, sheets and dialogs, and any open menu. */
async function scope(page, app) {
  return (await enumerate(page)).filter(
    (c) =>
      ((c.where === "window" || c.where === "sheet") &&
        (app.window.test(c.window) || c.window === "")) ||
      c.where === "dialog" ||
      c.where === "menu",
  );
}

/** Window ids on the desktop now. */
const windowIds = (page) =>
  page
    .locator("[data-window-id]")
    .evaluateAll((frames) => frames.map((f) => f.getAttribute("data-window-id")));

/**
 * What a probe brought up: the app's new controls in scope, plus every control of each window that opened during the
 * probe, whatever its title (a New Message window, a Preferences window), found by comparing window ids.
 */
async function revealed(page, app, known, idsBefore) {
  const all = await enumerate(page);
  const inScope = (c) =>
    ((c.where === "window" || c.where === "sheet") &&
      (app.window.test(c.window) || c.window === "")) ||
    c.where === "dialog" ||
    c.where === "menu";
  const opened = new Set((await windowIds(page)).filter((id) => !idsBefore.includes(id)));
  const openedNames = new Set(
    all.filter((c) => c.where === "window" && opened.has(c.windowId)).map((c) => c.window),
  );
  const fresh = all.filter(
    (c) =>
      !known.has(keyOf(c)) &&
      (inScope(c) ||
        (c.where === "window" && opened.has(c.windowId)) ||
        (c.where === "sheet" && openedNames.has(c.window))),
  );
  for (const c of fresh) known.add(keyOf(c));
  return fresh;
}

/** Put the app back after a probe: Escape, close new windows with their Close button, reopen the app if it went. */
async function reset(page, app, baseIds) {
  for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");
  await pause(150);
  for (const id of await windowIds(page)) {
    if (baseIds.includes(id)) continue;
    const close = page
      .locator(`[data-window-id="${id}"]`)
      .getByRole("group", { name: "Window controls" })
      .getByRole("button")
      .first();
    if (await close.count()) await close.click({ timeout: 2_000 }).catch(() => {});
    await pause(150);
    // A window that asks before closing (an unsaved message): choose the button that discards, else cancel.
    for (const label of [/^(Delete|Don.t Save|Discard)/, /^Cancel$/]) {
      const button = page.getByRole("button", { name: label }).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 2_000 }).catch(() => {});
        break;
      }
    }
  }
  const visible = await page
    .getByRole("region", { name: app.window })
    .first()
    .isVisible()
    .catch(() => false);
  if (!visible) await openApp(page, app.name, app.window).catch(() => {});
}

async function crawlApp(page, id) {
  const app = APPS[id];
  const file = path.join(outDir, `${id}.tsv`);
  rmSync(file, { force: true });
  const stamp = { engine: o.browserName, app: id };
  await openApp(page, app.name, app.window);
  await pause(800);
  const base = await scope(page, app);
  writeCrawl(
    file,
    base.map((c) => ({ ...stamp, state: "base", ...c })),
  );
  const menus = await crawlMenus(page, app.menus);
  writeCrawl(
    file,
    menus.map((c) => ({ ...stamp, state: "menus", ...c })),
  );
  let probes = 0;
  if (explore) {
    const baseIds = await windowIds(page);
    const known = new Set([...base, ...menus].map(keyOf));
    const targets = base.filter(
      (c) =>
        !c.disabled &&
        c.where === "window" &&
        c.role !== "resize-handle" &&
        c.role !== "resizer" &&
        c.role !== "textbox" &&
        c.role !== "searchbox" &&
        c.role !== "link" &&
        !WINDOW_CONTROLS.test(c.name),
    );
    for (const target of targets) {
      const label = `after ${target.role} "${target.name}"`;
      try {
        const now = (await scope(page, app)).find(
          (c) => c.role === target.role && c.name === target.name && c.where === target.where,
        );
        if (!now) continue;
        const idsBefore = await windowIds(page);
        await page.mouse.click(now.x, now.y);
        await pause(600);
        const after = await revealed(page, app, known, idsBefore);
        writeCrawl(
          file,
          after.map((c) => ({ ...stamp, state: label, ...c })),
        );
        probes++;
      } catch (error) {
        writeCrawl(file, [
          {
            ...stamp,
            state: label,
            where: "probe-failed",
            name: String(error.message).split("\n")[0],
          },
        ]);
      }
      await reset(page, app, baseIds);
    }
    // Every enabled command, a submenu's leaves included (walked through their recorded path "Title > Submenu").
    const commands = menus.filter(
      (c) =>
        !c.disabled &&
        c.where === "menu" &&
        !(c.haspopup && c.haspopup !== "false") &&
        !SKIP_COMMANDS.test(c.name),
    );
    for (const command of commands) {
      const label = `after menu ${command.place} > ${command.name}`;
      try {
        const idsBefore = await windowIds(page);
        await menu(page, ...command.place.split(" > "), command.name);
        await pause(700);
        const after = await revealed(page, app, known, idsBefore);
        writeCrawl(
          file,
          after.map((c) => ({ ...stamp, state: label, ...c })),
        );
        probes++;
      } catch (error) {
        writeCrawl(file, [
          {
            ...stamp,
            state: label,
            where: "probe-failed",
            name: String(error.message).split("\n")[0],
          },
        ]);
      }
      await reset(page, app, baseIds);
    }
  }
  // Quit the app before the next one, so its menus are not mixed with the next app's.
  await menu(page, app.name, `Quit ${app.name}`).catch(() => {});
  await within(
    5_000,
    async () => !(await page.getByRole("region", { name: app.window }).first().isVisible()),
  );
  console.log(
    `CRAWLED ${id} ${o.browserName} base=${base.length} menus=${menus.length} probes=${probes} -> ${file}`,
  );
}

const browser = await launchEngine(o.browserName, { media: true });
console.log(`crawl in ${o.browserName} ${browser.version()} against ${o.base}`);
let failed = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.log(`page error: ${error.message}`));
  await page.goto(`${o.base}/`, { waitUntil: "load" });
  await signUp(page, account("crawl", `${o.browserName.slice(0, 2)}${Date.now().toString(36)}`));
  for (const id of wanted) {
    try {
      await crawlApp(page, id);
    } catch (error) {
      failed++;
      console.log(`CRAWL_FAILED ${id} ${o.browserName}: ${String(error.message).split("\n")[0]}`);
      await page.goto(`${o.base}/`, { waitUntil: "load" }).catch(() => {});
    }
  }
  await context.close();
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
