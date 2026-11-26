// The media family's census harness (round 3, R7: Photos, Photo Booth, Music, TV, Podcasts, Voice
// Memos, QuickTime Player). Each `<app>-census-journey.mjs` lists its census rows (id, window or
// state, role, name, how reached, expected outcome, persistence) with a real-input check for each,
// and this kit runs them: one `ok`/`FAIL`/`n/a`/`unavailable` line per census id, in the engine
// `--browser` names (chromium, chrome = Google Chrome stable, firefox, webkit), against a served
// `ferrite dev`, signed in as an account of its own.
//
//   node e2e/<app>-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--out <dir>] [--phase write|restart-check|all] [--explore-minutes 3] [--seed 7]
//        [--headed] [--list] [--crawl]
//
// --phase write runs every row and leaves the persistent rows' data, writing the account and what
// it left to <out>/<app>-<engine>-state.json; --phase restart-check (after a same-root restart of
// `ferrite dev`, campaign/round3/r7/restart.sh, which records the old and new PIDs) signs in again
// and checks every row marked `persists: restart`. --list prints the census rows as TSV (the
// census file's columns, without results). --crawl also walks the accessibility tree of every
// window state and menu the suite reaches and prints each actionable control the rows do not
// name (`UNLISTED`), so an unlisted control fails the run. --explore-minutes runs the seeded,
// recorded exploratory pass of random real input in the app window after the rows.
//
// Real input only: Playwright mouse, keyboard, file chooser and drags with real pointer events.
// `page.evaluate` is used to read state (the media element's currentTime, paused, readyState; the
// server's data through the app's API), never to perform the action under test.

import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_NAMES, ENGINES, engineFamily } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The engines `--browser` names, from journey-kit (Chromium, Google Chrome stable, Firefox, WebKit). */
export { ENGINE_NAMES };
export const CENSUS_COLUMNS = [
  "id",
  "app",
  "window_or_state",
  "role",
  "name",
  "how_reached",
  "expected_outcome",
  "verified_by",
  "persists",
  "chromium",
  "chrome",
  "firefox",
  "webkit",
  "notes",
];
/** Roles the census counts as controls (brief section 5). */
export const ACTIONABLE = new Set([
  "button",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "checkbox",
  "radio",
  "switch",
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "option",
  "slider",
  "spinbutton",
  "tab",
  "link",
  "treeitem",
  "gridcell",
  "row",
]);

export function options() {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
  };
  const flag = (name) => args.includes(name);
  const browserName = option("--browser", "chromium");
  if (!Object.hasOwn(ENGINES, browserName)) {
    console.error(`--browser must be one of ${ENGINE_NAMES.join(", ")}, not ${browserName}`);
    process.exit(2);
  }
  const out = path.resolve(option("--out", path.join(here, "output", "census")));
  mkdirSync(out, { recursive: true });
  return {
    base: option("--url", "http://127.0.0.1:8080").replace(/\/$/, ""),
    out,
    browserName,
    phase: option("--phase", "all"),
    exploreMinutes: Number(option("--explore-minutes", "0")),
    seed: Number(option("--seed", "7")),
    headed: flag("--headed"),
    list: flag("--list"),
    crawl: flag("--crawl"),
    only: option("--only", ""),
  };
}

/**
 * Launch options per engine. `media`: "fake" (Chromium's and Chrome's fake devices answering
 * without a prompt, Firefox's fake streams, WebKit's mock devices with the permissions granted),
 * "deny" (the browser itself refuses the camera and microphone) or "none". Options are keyed by
 * the engine's family (`engineFamily`), so Google Chrome gets Chromium's; the browser type is
 * journey-kit's `ENGINES[name]`, which launches Chrome on Playwright's `chrome` channel.
 */
export function engineSetup(name, { media = "none", headed = false } = {}) {
  const launch = { headless: !headed };
  const context = { viewport: { width: 1440, height: 900 } };
  const family = engineFamily(name);
  if (family === "chromium") {
    launch.args = ["--autoplay-policy=no-user-gesture-required"];
    if (media === "fake")
      launch.args.push("--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream");
    if (media === "deny") {
      launch.args.push("--use-fake-device-for-media-stream", "--deny-permission-prompts");
      // Playwright's headless Chromium shell has no permission prompt to refuse: getUserMedia
      // throws NotSupportedError. The same build in new headless mode refuses with
      // NotAllowedError, as a person's browser does when the camera is denied. Google Chrome
      // already runs in that mode.
      if (name !== "chrome") launch.channel = "chromium";
    }
  }
  if (family === "firefox") {
    launch.firefoxUserPrefs = { "media.autoplay.default": 0 };
    if (media === "fake")
      Object.assign(launch.firefoxUserPrefs, {
        "media.navigator.streams.fake": true,
        "media.navigator.permission.disabled": true,
      });
    if (media === "deny")
      Object.assign(launch.firefoxUserPrefs, {
        "media.navigator.streams.fake": true,
        "media.navigator.permission.disabled": false,
        "permissions.default.microphone": 2,
        "permissions.default.camera": 2,
      });
  }
  if (family === "webkit" && media === "fake") context.permissions = ["camera", "microphone"];
  return { launch, context, type: ENGINES[name] };
}

export async function launchBrowser(name, opts = {}) {
  const setup = engineSetup(name, opts);
  const browser = await setup.type.launch(setup.launch);
  return { browser, contextOptions: setup.context };
}

/** Wait until `check` answers true (polled every 200 ms), answering whether it did. */
/**
 * Whether Messages, which a Share has just opened, is writing a message that holds `words`: read
 * from the Message field alone, so this fails if Messages opens and ignores what it was handed.
 * The field is emptied after, so that the next Share has to fill it again.
 */
export async function messagesComposerHolds(page, words, timeout = 15_000) {
  const message = page
    .getByRole("region", { name: "Messages", exact: true })
    .first()
    .getByRole("textbox", { name: "Message" });
  const held = await until(async () => (await message.inputValue()).includes(words), timeout);
  if (held) await message.fill("");
  return held;
}

export async function until(check, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `fetch` from inside the page (its cookie applies); reads only. */
export function api(page, method, url, body) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: response.status, json, text };
    },
    { method, url, body },
  );
}

const userTile = (page, name) =>
  page.getByRole("group", { name: "Users" }).getByRole("button", { name, exact: true });
export const finder = (page) => page.getByRole("button", { name: /^Finder$/ }).first();

/** The login window's Create Account… form, filled in by keyboard and sent. */
export async function createAccount(page, base, person) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await userTile(page, "Create Account…").waitFor({ timeout: 30_000 });
  await userTile(page, "Create Account…").click();
  const form = page.getByRole("form", { name: "Create Account" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Full Name:").fill(person.fullName);
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(person.password);
  await form.getByLabel("Verify:").fill(person.password);
  await form.getByRole("button", { name: "Create Account" }).click();
  await finder(page).waitFor({ timeout: 30_000 });
}

/** Sign in from the login window (Other… when the browser never signed in to the account). */
export async function signIn(page, base, person) {
  if (!page.url().startsWith(base)) await page.goto(`${base}/`, { waitUntil: "load" });
  await finder(page).or(userTile(page, "Other…")).first().waitFor({ timeout: 30_000 });
  if (await finder(page).isVisible()) return;
  await userTile(page, "Other…").click();
  const form = page.getByRole("form", { name: "Log In" });
  await form.waitFor({ timeout: 10_000 });
  await form.getByLabel("Account Name:").fill(person.name);
  await form.getByLabel("Password:").fill(person.password);
  await form.getByRole("button", { name: "Log In" }).click();
  await finder(page).waitFor({ timeout: 30_000 });
}

export function person(prefix, run) {
  return {
    name: `${prefix}-${run}`,
    fullName: `${prefix} ${run}`,
    password: `pw-${run}-${prefix}`,
  };
}

/** The menu bar (role menubar). */
export const menubar = (page) => page.getByRole("menubar").first();
/** The app whose menus the menu bar shows: the bold application-menu title after the Apple menu. */
export async function activeApp(page) {
  const titles = menubar(page).getByRole("menuitem");
  return (
    (await titles
      .nth(1)
      .textContent({ timeout: 3_000 })
      .catch(() => "")) ?? ""
  ).trim();
}
const activeIs = async (page, name) => (await activeApp(page)) === name;

/**
 * Apps the server's catalogue does not preinstall (`ferrite-apps/desktop/src/apps/catalogue.rs`):
 * a new account gets them from the App Store before Spotlight, Launchpad or the Dock list them.
 */
export const NOT_PREINSTALLED = new Set(["Photo Booth", "Voice Memos", "QuickTime Player"]);

/**
 * Get an app from the App Store as a person does: the Dock's App Store, Get, Install, and the
 * store's Open once the download saved it to the account's library. The store window is closed
 * after. Answers whether the store offered Open for it.
 */
export async function installFromAppStore(page, appName) {
  await page
    .getByRole("button", { name: /^App Store$/ })
    .first()
    .click();
  const store = page
    .locator(".mac-window")
    .filter({ has: page.getByRole("heading", { name: "Get More Apps" }) })
    .first();
  await store.waitFor({ state: "visible", timeout: 20_000 });
  const open = store.getByRole("button", { name: `Open, ${appName}` });
  if (!(await open.isVisible().catch(() => false))) {
    await store.getByRole("button", { name: `Get, ${appName}` }).click();
    await store.getByRole("button", { name: `Install, ${appName}` }).click();
    await open.waitFor({ timeout: 30_000 });
  }
  const ok = await open.isVisible();
  await store.getByRole("button", { name: "Close", exact: true }).first().click();
  await store.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  return ok;
}

/**
 * Open an app from Spotlight (real clicks and typing) and answer its window. An app the catalogue
 * does not preinstall is got from the App Store first, when Spotlight does not list it yet.
 */
export async function openApp(page, appName, windowSelector, { installed = false } = {}) {
  const before = await page.locator(".mac-window").count();
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(appName);
  const hit = page.getByRole("option", { name: appName, exact: true }).first();
  const listed = await hit.waitFor({ timeout: installed ? 10_000 : 3_000 }).then(
    () => true,
    () => false,
  );
  if (!listed && NOT_PREINSTALLED.has(appName) && !installed) {
    for (let n = 0; n < 2 && (await field.isVisible().catch(() => false)); n += 1)
      await page.keyboard.press("Escape");
    if (!(await installFromAppStore(page, appName)))
      throw new Error(`the App Store did not offer Open for ${appName} after Install`);
    return openApp(page, appName, windowSelector, { installed: true });
  }
  if (!listed) {
    await hit.waitFor({ timeout: 7_000 }).catch(() => {
      throw new Error(
        `Spotlight does not list ${appName}${installed ? " even after it was installed from the App Store" : ""}`,
      );
    });
  }
  await field.press("Enter");
  const window = windowSelector ? page.locator(windowSelector).first() : null;
  if (window) await window.waitFor({ state: "visible", timeout: 20_000 });
  else await until(async () => (await page.locator(".mac-window").count()) > before, 20_000);
  await until(() => activeIs(page, appName), 10_000);
  return window ?? topWindow(page);
}

/** The frontmost `.mac-window` (highest z-index), as a locator. */
export async function topWindow(page) {
  const index = await page.locator(".mac-window").evaluateAll((windows) => {
    let best = -1;
    let bestZ = -Infinity;
    windows.forEach((element, at) => {
      const style = getComputedStyle(element.closest("[style*='z-index']") ?? element);
      const z = Number(style.zIndex) || 0;
      if (element.getClientRects().length > 0 && z >= bestZ) {
        bestZ = z;
        best = at;
      }
    });
    return best;
  });
  return page.locator(".mac-window").nth(Math.max(0, index));
}

/**
 * Click a menu-bar menu and one of its items (by real clicks), descending through submenus. A
 * dimmed item is not clicked: the menu is closed and the call throws saying so.
 */
export async function chooseMenu(page, title, ...items) {
  try {
    return await chooseMenuOnce(page, title, ...items);
  } catch (error) {
    // A dimmed or missing item is the answer; anything else (a menu re-rendered under the click, or
    // closed before its item could be chosen) gets one more try from a closed menu, and is said.
    if (/is dimmed|not in the menu/.test(String(error))) throw error;
    console.log(`note menu retried: ${String(error).split("\n")[0]}`);
    await closeMenus(page);
    await sleep(500);
    return chooseMenuOnce(page, title, ...items);
  }
}

async function chooseMenuOnce(page, title, ...items) {
  await menubar(page)
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click({ timeout: 5_000 });
  for (let at = 0; at < items.length; at += 1) {
    const name = items[at];
    // A submenu is rendered after the menu that opened it, so the last item of the name is the
    // deepest one shown.
    const menus = page.getByRole("menu");
    const item = menus
      .getByRole("menuitem", { name, exact: true })
      .or(menus.getByRole("menuitemradio", { name, exact: true }))
      .or(menus.getByRole("menuitemcheckbox", { name, exact: true }))
      .last();
    const found = await item.waitFor({ timeout: 4_000 }).then(
      () => true,
      () => false,
    );
    // An item may be dimmed for a moment while the window it acts on settles (a restore).
    const enabled =
      found &&
      (await until(async () => (await item.getAttribute("aria-disabled")) !== "true", 3_000));
    const dimmed = found && !enabled;
    if (!found && (await page.getByRole("menu").count()) === 0) {
      // The menu did not stay open (focus going back to a window under it, say): not an answer about
      // its items, so `chooseMenu` tries once more.
      throw new Error(`the ${title} menu closed before ${name} could be chosen`);
    }
    if (!found || dimmed) {
      await closeMenus(page);
      throw new Error(
        `${[title, ...items.slice(0, at + 1)].join(" > ")} is ${found ? "dimmed" : "not in the menu"}`,
      );
    }
    if (at < items.length - 1) await item.hover({ timeout: 5_000 });
    else await item.click({ timeout: 5_000 });
  }
}

/** Close every open menu (Escape until none shows). */
export async function closeMenus(page) {
  for (let n = 0; n < 4 && (await page.getByRole("menu").count()) > 0; n += 1) {
    await page.keyboard.press("Escape");
    await sleep(100);
  }
}

/**
 * Undo to Select All through the menu bar on `input`, a text field with the keyboard, each read back
 * from the field. The rows wait for the menu to let go of the keyboard, so each step is awaited. The
 * clipboard is the browser's: where it refuses the menu's Paste, Paste must say so in `refusal`.
 */
export async function editRowsOnField(page, input, refusal) {
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  const value = () => input.inputValue();
  const steps = [];
  const step = async (name, ok) => {
    await chooseMenu(page, "Edit", name);
    const held = await until(ok, 4_000);
    steps.push(`${name} ${held ? "ok" : "FAILED"} ${JSON.stringify(await value())}`);
    await sleep(350);
    return held;
  };
  await input.fill("");
  await input.click();
  await input.pressSequentially("census");
  const all = async () =>
    input.evaluate((e) => e.selectionStart === 0 && e.selectionEnd === e.value.length);
  const results = [
    await step("Select All", all),
    await step("Cut", async () => (await value()) === ""),
  ];
  let refused = false;
  const pasted = await step("Paste", async () => {
    refused = await refusal.isVisible().catch(() => false);
    return refused || (await value()) === "census";
  });
  results.push(pasted);
  if (refused) {
    await input.fill("");
    return {
      ok: results.every(Boolean),
      detail: `${steps.join("; ")}; Paste refused, and said so`,
    };
  }
  await input.click();
  results.push(await step("Select All", all));
  results.push(await step("Copy", async () => true));
  await input.press("End");
  results.push(await step("Paste", async () => (await value()) === "censuscensus"));
  results.push(await step("Undo", async () => (await value()) === "census"));
  results.push(await step("Redo", async () => (await value()) === "censuscensus"));
  await input.fill("");
  return { ok: results.every(Boolean), detail: steps.join("; ") };
}

/**
 * The state of a menu item without choosing it, through submenus when `names` holds a path:
 * { disabled, checked, title } (menu closed after).
 */
export async function menuItemState(page, title, ...names) {
  await menubar(page).getByRole("menuitem", { name: title, exact: true }).first().click();
  const menus = page.getByRole("menu");
  const rowOf = (name) =>
    menus
      .getByRole("menuitem", { name, exact: true })
      .or(menus.getByRole("menuitemradio", { name, exact: true }))
      .or(menus.getByRole("menuitemcheckbox", { name, exact: true }))
      .last();
  for (const name of names.slice(0, -1)) await rowOf(name).hover({ timeout: 5_000 });
  const item = rowOf(names.at(-1));
  await item.waitFor({ timeout: 5_000 });
  const state = {
    disabled: (await item.getAttribute("aria-disabled")) === "true",
    checked: await item.getAttribute("aria-checked"),
    title: await item.getAttribute("title"),
  };
  await closeMenus(page);
  return state;
}

/**
 * A point in a server-fetched page with nothing under it that a click would act on, for
 * `frame.locator("html")`. A fixed point can land on whatever link a live page has there today.
 */
export const plainSpot = (frame) =>
  frame.locator("html").evaluate(() => {
    for (let y = innerHeight - 20; y > 0; y -= 20) {
      for (let x = innerWidth - 20; x > 0; x -= 40) {
        const under = document.elementFromPoint(x, y);
        if (under && !under.closest("a, button, input, select, textarea, summary, label")) {
          return { x: x + scrollX, y: y + scrollY };
        }
      }
    }
    throw new Error("no point in the page is free of links and controls");
  });

/** A row's verdict on a dimmed item: dimmed, and saying why on hover. */
const dimmedWithReason = (state) => ({
  ok: state.disabled && Boolean(state.title),
  detail: JSON.stringify(state),
});

/**
 * Keep a reference to every media element when its play() is called, so a detached `new Audio()`
 * (Music's player) can be read as well as one in the page. Read-only: play() itself is called
 * unchanged, and nothing is performed through the reference.
 */
export async function trackMedia(context) {
  await context.addInitScript(() => {
    window.__r7Media = [];
    const seen = window.__r7Media;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      // Last-play order: A, B, then A again leaves A last.
      const at = seen.indexOf(this);
      if (at >= 0) seen.splice(at, 1);
      seen.push(this);
      return play.apply(this, args);
    };
  });
}

/**
 * The state of the media element that played last (registered by trackMedia), or else the first
 * <audio>/<video> of the page: currentTime, paused, readyState, ended, duration, volume, muted,
 * src, error, playbackRate.
 */
export function playingMedia(page) {
  return page
    .evaluate(() => {
      const list = window.__r7Media ?? [];
      const media = list[list.length - 1] ?? document.querySelector("audio, video");
      if (!media) return null;
      return {
        currentTime: media.currentTime,
        paused: media.paused,
        readyState: media.readyState,
        ended: media.ended,
        duration: media.duration,
        volume: media.volume,
        muted: media.muted,
        src: media.currentSrc || media.src,
        error: media.error ? media.error.code : null,
        playbackRate: media.playbackRate,
        count: list.length,
      };
    })
    .catch(() => null);
}

/** The first <audio>/<video> in `scope` (or the page): currentTime, paused, readyState, src, ended, error. */
export function mediaState(scope, selector = "audio, video") {
  return scope
    .locator(selector)
    .first()
    .evaluate((media) => ({
      currentTime: media.currentTime,
      paused: media.paused,
      readyState: media.readyState,
      ended: media.ended,
      duration: media.duration,
      volume: media.volume,
      muted: media.muted,
      src: media.currentSrc || media.src,
      error: media.error ? media.error.code : null,
      playbackRate: media.playbackRate,
    }))
    .catch(() => null);
}

/** Parse an aria snapshot into [{ role, name, depth, attrs }]. */
export function parseSnapshot(yaml) {
  const rows = [];
  for (const raw of yaml.split("\n")) {
    let line = raw;
    const depth = line.search(/\S/);
    line = line.trim();
    if (!line.startsWith("- ")) continue;
    line = line.slice(2);
    if (line.startsWith("'") && line.endsWith("'")) line = line.slice(1, -1).replace(/''/g, "'");
    else if (line.startsWith("'"))
      line = line
        .slice(1)
        .replace(/'(:.*)?$/, "")
        .replace(/''/g, "'");
    const match = /^([a-z]+)(?: "((?:[^"\\]|\\.)*)")?(.*)$/.exec(line);
    if (!match) continue;
    const [, role, name = "", rest] = match;
    rows.push({ role, name: name.replace(/\\"/g, '"'), depth, attrs: rest.trim() });
  }
  return rows;
}

/**
 * The actionable controls under `locator`. A snapshot that cannot be taken throws: an
 * uninspectable window or menu is a crawl error, never "no controls".
 */
export async function controlsIn(locator) {
  const yaml = await locator.ariaSnapshot({ timeout: 10_000 });
  return parseSnapshot(yaml).filter((row) => ACTIONABLE.has(row.role));
}

/**
 * The mechanical crawl of one state: the actionable controls of `window` and, when `menus`, of
 * every menu-bar menu and each submenu at every depth (opened by real clicks and hovers), each as
 * { state, role, name, attrs }, where a menu's state is its path, `menu:File > Library > Export`.
 */
export async function crawlState(page, window, state, { menus = false } = {}) {
  const found = [];
  for (const row of await controlsIn(window)) found.push({ state, ...row });
  if (!menus) return found;
  const titles = (await controlsIn(menubar(page)))
    .filter((row) => row.role === "menuitem")
    .map((row) => row.name);
  for (const title of titles) {
    found.push({ state: "menu bar", role: "menuitem", name: title, attrs: "" });
    try {
      await menubar(page)
        .getByRole("menuitem", { name: title, exact: true })
        .first()
        .click({ timeout: 5_000 });
      await openMenus(page).first().waitFor({ timeout: 3_000 });
      await crawlMenu(page, 0, `menu:${title}`, found);
    } catch (error) {
      found.push({
        state: `menu:${title}`,
        role: "error",
        name: String(error).slice(0, 120),
        attrs: "",
      });
    }
    await closeMenus(page);
    await sleep(150);
  }
  return found;
}

/** The menus open now, the menu bar's first and each submenu after the one that opened it. */
const openMenus = (page) => page.locator('[role="menu"][data-open]');

/** The controls of the open menu at `level`, and of every submenu it opens, under their paths. */
async function crawlMenu(page, level, menuPath, found) {
  const menu = openMenus(page).nth(level);
  for (const row of await controlsIn(menu)) found.push({ state: menuPath, ...row });
  const triggers = menu.locator('[role="menuitem"][aria-haspopup]:not([aria-disabled="true"])');
  const count = await triggers.count();
  for (let at = 0; at < count; at += 1) {
    const trigger = triggers.nth(at);
    const name = (await trigger.innerText()).trim().split("\n")[0];
    const subPath = `${menuPath} > ${name}`;
    await trigger.hover({ timeout: 3_000 });
    const opened = await until(
      async () =>
        (await trigger.getAttribute("aria-expanded")) === "true" &&
        (await openMenus(page).count()) > level + 1,
      2_000,
    );
    if (opened) {
      await crawlMenu(page, level + 1, subPath, found);
      // A submenu left open can cover the next row of its parent: it is closed as a person would.
      await page.keyboard.press("ArrowLeft");
      await until(async () => (await openMenus(page).count()) === level + 1, 1_000);
    } else found.push({ state: subPath, role: "error", name: "did not open", attrs: "" });
  }
}

/** The app's main managed window (`data-window-id` is the app's demo folder). */
export const mainWindow = (page, app) =>
  page.locator(`.mac-managed-window[data-window-id="${app.slug}"]`).first();
const windowCount = (page) => page.locator(".mac-managed-window:not([data-minimized])").count();
const isTop = async (page, app) => {
  const top = await page
    .locator(".mac-managed-window:not([data-minimized])")
    .evaluateAll((windows) => {
      let best = null;
      let bestZ = -Infinity;
      for (const w of windows) {
        const z = Number(w.style.zIndex) || 0;
        if (w.getClientRects().length && z >= bestZ) [best, bestZ] = [w.dataset.windowId, z];
      }
      return best;
    });
  return top === app.slug;
};
export const box = (locator) => locator.boundingBox({ timeout: 5_000 });
/** The topmost window other than the app's, by z-index (an About, Help or Preferences window). */
export async function newestWindow(page, except) {
  const id = await page
    .locator(".mac-managed-window:not([data-minimized])")
    .evaluateAll((windows, skip) => {
      let best = null;
      let bestZ = -Infinity;
      for (const w of windows) {
        const z = Number(w.style.zIndex) || 0;
        if (w.dataset.windowId !== skip && w.getClientRects().length && z >= bestZ)
          [best, bestZ] = [w.dataset.windowId, z];
      }
      return best;
    }, except);
  return id ? page.locator(`.mac-managed-window[data-window-id="${id}"]`).first() : null;
}
async function closeWindowLocator(window) {
  await window.getByRole("button", { name: "Close", exact: true }).first().click();
  await window.waitFor({ state: "hidden", timeout: 10_000 });
}
/** Click the app's window by its title bar area (raises it without pressing a control). */
/**
 * Make the app frontmost as a person does when another window covers it: click its Dock item
 * (which also brings back a minimised window).
 */
export async function raise(page, app) {
  await (await dockItem(page, app.name)).click();
  if (await until(() => activeIs(page, app.name), 3_000)) {
    await until(() => isTop(page, app), 3_000);
    return;
  }
  // Else click a point of the app's window that no other window covers (found by reading the
  // page, then clicked with the mouse).
  const point = await mainWindow(page, app).evaluate((element) => {
    const r = element.getBoundingClientRect();
    for (let fy = 0.02; fy < 1; fy += 0.08)
      for (let fx = 0.05; fx < 1; fx += 0.1) {
        const x = r.left + r.width * fx;
        const y = r.top + Math.min(r.height * fy, r.height - 4);
        const hit = document.elementFromPoint(x, y);
        if (
          hit &&
          element.contains(hit) &&
          !hit.closest("button, input, [role=button], [role=treeitem], [role=option], a")
        )
          return { x, y };
      }
    return null;
  });
  if (point) await page.mouse.click(point.x, point.y);
  await until(() => activeIs(page, app.name), 5_000);
  await until(() => isTop(page, app), 3_000);
}

/**
 * Leave full screen as a person does: point at the top of the screen so the hidden menu bar
 * shows, View > Exit Full Screen; else the window's own green button; else Control-Command-F.
 */
export async function exitFullScreen(page, w) {
  const full = async () => (await w.getAttribute("data-full-screen")) !== null;
  if (!(await full())) return true;
  await page.mouse.move(720, 1);
  await sleep(400);
  await chooseMenu(page, "View", "Exit Full Screen").catch(() => {});
  if (await until(async () => !(await full()), 2_000)) return true;
  await page.mouse.move(40, 10);
  await sleep(300);
  await w
    .getByRole("button", { name: /Exit Full Screen/ })
    .first()
    .click({ timeout: 2_000 })
    .catch(() => {});
  if (await until(async () => !(await full()), 2_000)) return true;
  await page.keyboard.press("Control+Meta+f");
  return until(async () => !(await full()), 3_000);
}
async function dockItem(page, name) {
  // The Dock's own item: a Finder window or an app may have a button of the same name.
  const dock = page.locator(".mac-dock");
  const named = new RegExp(`^${name}$`);
  return dock
    .getByRole("button", { name: named })
    .or(dock.getByRole("link", { name: named }))
    .first();
}
/** Open the app again if its main window is gone (after Quit, Close or a failed row). */
export async function ensureOpen(ctx) {
  const { page, app } = ctx;
  await closeMenus(page);
  const w = mainWindow(page, app);
  await exitFullScreen(page, w).catch(() => {});
  if (
    await w.getAttribute("data-minimized").then(
      (v) => v !== null,
      () => false,
    )
  )
    await (await dockItem(page, app.name)).click();
  if (!(await w.isVisible().catch(() => false))) {
    await openApp(page, app.name);
    await w.waitFor({ state: "visible", timeout: 20_000 });
    if (app.afterOpen) await app.afterOpen(ctx);
  }
  if (!(await isTop(page, app))) await raise(page, app);
  return w;
}

/**
 * The rows every media app shares: each menu-bar title, the app menu, Edit, File > Close Window,
 * View > Enter Full Screen, the Window menu, Help, the placeholder menus a demo has no commands
 * for (unavailable with the reason the menu shows), and the window chrome (Close, Minimize, Enter
 * Full Screen or Zoom, move by the title bar, resize by each edge and corner). `app` names
 * `menus` (the menu-bar titles after the Apple menu), `placeholders` (titles whose only item is
 * "This demo has no <title> commands"), `textField(ctx)` (a field the Edit rows type into, or
 * none), `preferences` ({ text } the Preferences window shows, or { unavailable }), `zoomButton`
 * (the green button is Zoom, not Enter Full Screen), `resizable` (false: no resize handles) and
 * `fixedSize` (why a fixed-size window cannot be resized, zoomed or made full screen: those rows
 * then expect the control dimmed).
 */
export function shellRows(app) {
  const id = (slug) => `${app.slug}.shell.${slug}`;
  const rows = [];
  const row = (slug, state, role, name, how, expected, check, extra = {}) =>
    rows.push({ id: id(slug), state, role, name, how, expected, check, ...extra });
  for (const title of app.menus) {
    row(
      `menubar.${title.toLowerCase().replace(/\W+/g, "-")}`,
      "menu bar",
      "menuitem",
      title,
      `click "${title}" in the menu bar`,
      "its menu opens, listing its items",
      async (ctx) => {
        const { page } = ctx;
        await ensureOpen(ctx);
        await menubar(page).getByRole("menuitem", { name: title, exact: true }).first().click();
        const menu = page.getByRole("menu").first();
        const shown = await menu.waitFor({ timeout: 5_000 }).then(
          () => true,
          () => false,
        );
        const items = shown ? (await controlsIn(menu)).length : 0;
        await page.keyboard.press("Escape");
        return { ok: shown && items > 0, detail: `${items} items` };
      },
    );
  }
  for (const title of app.placeholders ?? []) {
    const reason = `This demo has no ${title} commands`;
    row(
      `menu.${title.toLowerCase()}.placeholder`,
      `menu:${title}`,
      "menuitem",
      reason,
      `${title} menu`,
      "a dimmed item saying the menu has no commands",
      async (ctx) => {
        await ensureOpen(ctx);
        const state = await menuItemState(ctx.page, title, reason);
        return { ok: state.disabled, detail: JSON.stringify(state) };
      },
      { unavailable: reason },
    );
  }
  const A = app.name;
  row(
    "menu.app.about",
    `menu:${A}`,
    "menuitem",
    `About ${A}`,
    `${A} > About ${A}`,
    app.about?.unavailable
      ? `dimmed: ${app.about.unavailable}`
      : `an About window naming ${A} opens; its Close closes it`,
    async (ctx) => {
      const { page } = ctx;
      await ensureOpen(ctx);
      if (app.about?.unavailable) {
        const state = await menuItemState(page, A, `About ${A}`);
        return dimmedWithReason(state);
      }
      const about = page.locator(`.mac-desktop-shell-about[data-app="${app.slug}"]`);
      await chooseMenu(page, A, `About ${A}`);
      const opened = await about.waitFor({ timeout: 8_000 }).then(
        () => true,
        () => false,
      );
      const text = opened ? await about.innerText() : "";
      if (opened) {
        await about.getByRole("button", { name: "Close", exact: true }).first().click();
        await about.waitFor({ state: "detached", timeout: 5_000 });
      }
      return { ok: opened && text.includes(A), detail: text.replace(/\s+/g, " ").slice(0, 120) };
    },
    app.about?.unavailable ? { unavailable: app.about.unavailable } : {},
  );
  row(
    "menu.app.preferences",
    `menu:${A}`,
    "menuitem",
    "Preferences…",
    `${A} > Preferences…`,
    app.preferences?.unavailable
      ? `dimmed: ${app.preferences.unavailable}`
      : `the Preferences window opens (${app.preferences?.text})`,
    async (ctx) => {
      const { page } = ctx;
      await ensureOpen(ctx);
      if (app.preferences?.unavailable) {
        const state = await menuItemState(page, A, "Preferences…");
        return dimmedWithReason(state);
      }
      const before = await windowCount(page);
      await chooseMenu(page, A, "Preferences…");
      if (app.preferences?.locate) {
        // Preferences shown inside the app's own window (a sheet or dialog of it).
        const prefs = app.preferences.locate(ctx);
        const opened = await prefs.waitFor({ timeout: 8_000 }).then(
          () => true,
          () => false,
        );
        const text = opened ? await prefs.innerText() : "";
        if (opened) await app.preferences.close(ctx);
        return {
          ok: opened && text.includes(app.preferences.text ?? ""),
          detail: text.replace(/\s+/g, " ").slice(0, 120),
        };
      }
      const opened = await until(async () => (await windowCount(page)) > before, 8_000);
      const prefs = await newestWindow(page, app.slug);
      const text = prefs ? await prefs.innerText() : "";
      if (prefs) await closeWindowLocator(prefs);
      return {
        ok: opened && text.includes(app.preferences?.text ?? ""),
        detail: text.replace(/\s+/g, " ").slice(0, 120),
      };
    },
    app.preferences?.unavailable ? { unavailable: app.preferences.unavailable } : {},
  );
  row(
    "menu.app.services",
    `menu:${A}`,
    "menuitem",
    "Services",
    `${A} > Services`,
    "shows that no services apply (dimmed)",
    async (ctx) => {
      const { page } = ctx;
      await ensureOpen(ctx);
      await menubar(page).getByRole("menuitem", { name: A, exact: true }).first().click();
      const item = page
        .getByRole("menu")
        .getByRole("menuitem", { name: "Services", exact: true })
        .first();
      await item.hover();
      await sleep(400);
      const disabled = (await item.getAttribute("aria-disabled")) === "true";
      const menus = page.getByRole("menu");
      const sub = (await menus.count()) > 1 ? await menus.last().innerText() : "";
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      return {
        ok: disabled || /No Services Apply/.test(sub),
        detail: disabled ? "dimmed" : sub.slice(0, 80),
      };
    },
    { unavailable: "No Services Apply" },
  );
  row(
    "menu.app.hide",
    `menu:${A}`,
    "menuitem",
    `Hide ${A}`,
    `${A} > Hide ${A}; then its Dock item`,
    "its windows leave the screen (the shell minimises them) and the Finder's menus show; the Dock item shows them again",
    async (ctx) => {
      const { page } = ctx;
      const w = await ensureOpen(ctx);
      await chooseMenu(page, A, `Hide ${A}`);
      const hidden = await until(
        async () => (await w.getAttribute("data-minimized")) !== null || !(await w.isVisible()),
        5_000,
      );
      const finderMenus = await until(() => activeIs(page, "Finder"), 5_000);
      await (await dockItem(page, A)).click();
      const back = await until(
        async () => (await w.getAttribute("data-minimized")) === null && (await w.isVisible()),
        8_000,
      );
      return {
        ok: hidden && finderMenus && back,
        detail: `hidden ${hidden}, finder menus ${finderMenus}, back ${back}`,
      };
    },
  );
  // Hide Others and Show All act on other apps' windows (Finder windows do not count): Calculator
  // is opened beside the app for them.
  const otherApp = (page) =>
    page.locator('.mac-managed-window[data-window-id="calculator"]').first();
  const otherHidden = async (page) =>
    (await otherApp(page)
      .getAttribute("data-minimized")
      .catch(() => null)) !== null ||
    !(await otherApp(page)
      .isVisible()
      .catch(() => false));
  row(
    "menu.app.hide-others",
    `menu:${A}`,
    "menuitem",
    "Hide Others",
    `open Calculator from Spotlight, back to ${A} (its Dock item), ${A} > Hide Others`,
    "Calculator's window leaves the screen, the app's stays",
    async (ctx) => {
      const { page } = ctx;
      const w = await ensureOpen(ctx);
      await openApp(page, "Calculator");
      await otherApp(page).waitFor({ state: "visible", timeout: 10_000 });
      await raise(page, app);
      await chooseMenu(page, A, "Hide Others");
      const ok = await until(() => otherHidden(page), 5_000);
      return { ok: ok && (await w.isVisible()), detail: `calculator hidden ${ok}` };
    },
  );
  row(
    "menu.app.show-all",
    `menu:${A}`,
    "menuitem",
    "Show All",
    `after Hide Others, ${A} > Show All`,
    "the hidden Calculator window shows again",
    async (ctx) => {
      const { page } = ctx;
      await ensureOpen(ctx);
      await chooseMenu(page, A, "Show All");
      const ok = await until(async () => !(await otherHidden(page)), 5_000);
      if (ok) await closeWindowLocator(otherApp(page)).catch(() => {});
      await ensureOpen(ctx);
      return { ok, detail: `calculator shown ${ok}` };
    },
  );
  row(
    "menu.app.quit",
    `menu:${A}`,
    "menuitem",
    `Quit ${A}`,
    `${A} > Quit ${A}; open it again from Spotlight`,
    "every window of the app closes and the menus return to the Finder; it opens again",
    async (ctx) => {
      const { page } = ctx;
      const w = await ensureOpen(ctx);
      await chooseMenu(page, A, `Quit ${A}`);
      const gone = await until(async () => !(await w.isVisible()), 8_000);
      // Another app (or the Finder) takes the menu bar.
      const finderMenus = await until(async () => (await activeApp(page)) !== A, 5_000);
      await ensureOpen(ctx);
      return {
        ok: gone && finderMenus && (await w.isVisible()),
        detail: `gone ${gone}, finder menus ${finderMenus}`,
      };
    },
  );
  // Edit: through the app's text field, every step read back from the field itself. An app whose
  // Edit menu holds other items lists them itself (`editItems` names the standard ones it has).
  const field = app.textField;
  const editItems = new Set(
    app.editItems ?? ["Select All", "Cut", "Paste", "Copy", "Undo", "Redo"],
  );
  const editRow = (slug, name, expected, body) => {
    if (!editItems.has(name)) return;
    row(
      `menu.edit.${slug}`,
      "menu:Edit",
      "menuitem",
      name,
      field ? `type in ${app.textFieldName}, then Edit > ${name}` : `Edit > ${name}`,
      field ? expected : `listed: ${app.editUnavailable}`,
      async (ctx) => {
        const { page } = ctx;
        await ensureOpen(ctx);
        if (!field) {
          // Listed with its state: what a dimmed Edit command would act on is plain to a person, and
          // what an enabled one does is the app's own rows' to check.
          const state = await menuItemState(page, "Edit", name);
          return { ok: true, detail: JSON.stringify(state) };
        }
        return body(ctx, field(ctx));
      },
      {},
    );
  };
  const fieldValue = (input) => input.inputValue();
  editRow("select-all", "Select All", "the field's whole text is selected", async (ctx, input) => {
    await input.click();
    await input.press("ControlOrMeta+a");
    await input.press("Backspace");
    await input.pressSequentially("census");
    await chooseMenu(ctx.page, "Edit", "Select All");
    const sel = await input.evaluate((e) => [e.selectionStart, e.selectionEnd, e.value.length]);
    return { ok: sel[0] === 0 && sel[1] === sel[2] && sel[2] === 6, detail: JSON.stringify(sel) };
  });
  editRow("cut", "Cut", "the selected text leaves the field", async (ctx, input) => {
    await chooseMenu(ctx.page, "Edit", "Cut");
    const v = await fieldValue(input);
    return { ok: v === "", detail: JSON.stringify(v) };
  });
  editRow("paste", "Paste", "the cut text comes back into the field", async (ctx, input) => {
    await input.click();
    await chooseMenu(ctx.page, "Edit", "Paste");
    const ok = await until(async () => (await fieldValue(input)) === "census", 3_000);
    return { ok, detail: JSON.stringify(await fieldValue(input)) };
  });
  editRow(
    "copy",
    "Copy",
    "the selection is copied: pasted at the end it doubles the text",
    async (ctx, input) => {
      await input.click();
      await chooseMenu(ctx.page, "Edit", "Select All");
      await chooseMenu(ctx.page, "Edit", "Copy");
      await input.press("End");
      await chooseMenu(ctx.page, "Edit", "Paste");
      const ok = await until(async () => (await fieldValue(input)) === "censuscensus", 3_000);
      return { ok, detail: JSON.stringify(await fieldValue(input)) };
    },
  );
  editRow("undo", "Undo", "the last paste is undone", async (ctx, input) => {
    await chooseMenu(ctx.page, "Edit", "Undo");
    const ok = await until(async () => (await fieldValue(input)) === "census", 3_000);
    return { ok, detail: JSON.stringify(await fieldValue(input)) };
  });
  editRow("redo", "Redo", "the undone paste is done again", async (ctx, input) => {
    await chooseMenu(ctx.page, "Edit", "Redo");
    const ok = await until(async () => (await fieldValue(input)) === "censuscensus", 3_000);
    await input.click();
    await input.press("ControlOrMeta+a");
    await input.press("Backspace");
    await input.press("Escape");
    return { ok, detail: JSON.stringify(await fieldValue(input).catch(() => "")) };
  });
  row(
    "menu.file.close-window",
    "menu:File",
    "menuitem",
    "Close Window",
    "File > Close Window",
    "the app's window closes",
    async (ctx) => {
      const w = await ensureOpen(ctx);
      await chooseMenu(ctx.page, "File", "Close Window");
      const ok = await until(async () => !(await w.isVisible()), 5_000);
      await ensureOpen(ctx);
      return ok;
    },
  );
  const fullScreenRow = (slug, how, enter) =>
    row(
      slug,
      how.state,
      how.role,
      how.name,
      how.how,
      "the window fills the screen; Exit Full Screen (View menu) brings it back to its frame",
      async (ctx) => {
        const { page } = ctx;
        const w = await ensureOpen(ctx);
        const before = await box(w);
        await enter(ctx, w);
        const full = await until(
          async () => (await w.getAttribute("data-full-screen")) !== null,
          5_000,
        );
        const fullBox = await box(w);
        const back = await exitFullScreen(page, w);
        const after = await box(w);
        return {
          ok:
            full &&
            back &&
            fullBox.width > before.width &&
            Math.abs(after.width - before.width) < 2,
          detail: `${before.width}x${before.height} -> ${fullBox.width}x${fullBox.height} -> ${after.width}x${after.height}`,
        };
      },
    );
  // A fixed-size window (app.fixedSize says why) keeps View > Enter Full Screen and Window > Zoom dimmed.
  const dimmedItem = (slug, title, item) =>
    row(
      slug,
      `menu:${title}`,
      "menuitem",
      item,
      `${title} > ${item}`,
      `dimmed: ${app.fixedSize}`,
      async (ctx) => {
        await ensureOpen(ctx);
        const state = await menuItemState(ctx.page, title, item);
        return dimmedWithReason(state);
      },
      { unavailable: app.fixedSize },
    );
  if (app.fixedSize) dimmedItem("menu.view.enter-full-screen", "View", "Enter Full Screen");
  else
    fullScreenRow(
      "menu.view.enter-full-screen",
      {
        state: "menu:View",
        role: "menuitem",
        name: "Enter Full Screen",
        how: "View > Enter Full Screen",
      },
      (ctx) => chooseMenu(ctx.page, "View", "Enter Full Screen"),
    );
  row(
    "menu.window.minimize",
    "menu:Window",
    "menuitem",
    "Minimize",
    "Window > Minimize; then the Dock item",
    "the window goes to the Dock; the Dock item brings it back",
    async (ctx) => {
      const { page } = ctx;
      const w = await ensureOpen(ctx);
      await chooseMenu(page, "Window", "Minimize");
      const min = await until(async () => (await w.getAttribute("data-minimized")) !== null, 5_000);
      await (await dockItem(page, A)).click();
      const back = await until(
        async () => (await w.getAttribute("data-minimized")) === null && (await w.isVisible()),
        8_000,
      );
      return { ok: min && back, detail: `minimized ${min}, back ${back}` };
    },
  );
  if (app.fixedSize) dimmedItem("menu.window.zoom", "Window", "Zoom");
  else
    row(
      "menu.window.zoom",
      "menu:Window",
      "menuitem",
      "Zoom",
      "Window > Zoom, twice",
      "the window fills the desktop, and the second Zoom returns it to its frame",
      async (ctx) => {
        const { page } = ctx;
        const w = await ensureOpen(ctx);
        const before = await box(w);
        await chooseMenu(page, "Window", "Zoom");
        const zoomed = await until(
          async () => (await w.getAttribute("data-zoomed")) !== null,
          5_000,
        );
        const big = await box(w);
        await chooseMenu(page, "Window", "Zoom");
        const back = await until(async () => (await w.getAttribute("data-zoomed")) === null, 5_000);
        const after = await box(w);
        return {
          ok:
            zoomed && back && big.width >= before.width && Math.abs(after.width - before.width) < 2,
          detail: `${before.width} -> ${big.width} -> ${after.width}`,
        };
      },
    );
  row(
    "menu.window.bring-all-to-front",
    "menu:Window",
    "menuitem",
    "Bring All to Front",
    "open a second window of the app, then a Finder window over both, click the second so the app's main window stays behind Finder's, Window > Bring All to Front",
    "the app's main and second windows stand in front of Finder's; an app with one window cannot show it, and says so",
    async (ctx) => {
      const { page } = ctx;
      await ensureOpen(ctx);
      await raise(page, app);
      const before = await windowCount(page);
      if (app.secondWindow) await app.secondWindow(ctx);
      else if (!app.preferences?.unavailable) await chooseMenu(page, A, "Preferences…");
      const grew =
        (app.secondWindow || !app.preferences?.unavailable) &&
        (await until(async () => (await windowCount(page)) > before, 4_000));
      if (!grew) {
        if (!app.secondWindow) await app.preferences?.close?.(ctx).catch(() => {});
        return {
          ok: true,
          unavailable:
            "one window of the desktop's: every way of covering it leaves the other app active, so no stacking change can show",
        };
      }
      const second = await newestWindow(page, app.slug);
      await finder(page).click();
      const finderWindow = page.locator('.mac-managed-window[data-window-id^="finder"]').first();
      await finderWindow.waitFor({ state: "visible", timeout: 10_000 });
      // The second window has to show past Finder's to be clicked: Finder's is moved off it.
      const uncovered = () =>
        second.evaluate((element) => {
          const r = element.getBoundingClientRect();
          for (let fy = 0.02; fy < 1; fy += 0.08)
            for (let fx = 0.05; fx < 1; fx += 0.1) {
              const x = r.left + r.width * fx;
              const y = r.top + Math.min(r.height * fy, r.height - 4);
              const hit = document.elementFromPoint(x, y);
              if (hit && element.contains(hit) && !hit.closest("button, input, select, a, [role]"))
                return { x, y };
            }
          return null;
        });
      if (!(await uncovered())) {
        const frame = await finderWindow.boundingBox();
        await page.mouse.move(frame.x + frame.width / 2, frame.y + 12);
        await page.mouse.down();
        await page.mouse.move(frame.x + frame.width / 2 + 400, frame.y + 412, { steps: 8 });
        await page.mouse.up();
      }
      const point = await uncovered();
      if (!point) return { ok: false, detail: "no part of the second window could be clicked" };
      await page.mouse.click(point.x, point.y);
      if (!(await until(() => activeIs(page, A), 5_000)))
        return { ok: false, detail: "a click on the second window did not make the app active" };
      const stacking = () =>
        Promise.all(
          [mainWindow(page, app), second, finderWindow].map((one) =>
            one.evaluate((element) => Number(element.style.zIndex) || 0),
          ),
        );
      const [mainBefore, secondBefore, finderBefore] = await stacking();
      if (!(mainBefore < finderBefore && finderBefore < secondBefore)) {
        return {
          ok: false,
          detail: `the main window had not stayed behind Finder's: ${mainBefore}, ${finderBefore}, ${secondBefore}`,
        };
      }
      await chooseMenu(page, "Window", "Bring All to Front");
      const ok = await until(async () => {
        const [main, other, behind] = await stacking();
        return main > behind && other > behind;
      }, 5_000);
      const detail = (await stacking()).join(" ");
      await closeWindowLocator(second).catch(() => {});
      await closeWindowLocator(finderWindow).catch(() => {});
      return { ok, detail: `main, second, Finder: ${detail}` };
    },
  );
  row(
    "menu.window.app-window",
    "menu:Window",
    "menuitemcheckbox",
    A,
    `Window > ${A}`,
    "the app's window is listed, checked as the key window, and choosing it keeps it in front",
    async (ctx) => {
      const { page } = ctx;
      await ensureOpen(ctx);
      const state = await menuItemState(page, "Window", A);
      await chooseMenu(page, "Window", A);
      return {
        ok: state.checked === "true" && (await isTop(page, app)),
        detail: JSON.stringify(state),
      };
    },
  );
  row(
    "menu.help.app-help",
    "menu:Help",
    "menuitem",
    `${A} Help`,
    `Help > ${A} Help`,
    `Help Viewer opens on ${A}'s help`,
    async (ctx) => {
      const { page } = ctx;
      await ensureOpen(ctx);
      const before = await windowCount(page);
      const helpState = await menuItemState(page, "Help", `${A} Help`);
      if (helpState.disabled)
        return {
          ok: true,
          unavailable: `dimmed in the Help menu: Help Viewer offers no ${A} help`,
          detail: JSON.stringify(helpState),
        };
      await chooseMenu(page, "Help", `${A} Help`);
      const opened = await until(async () => (await windowCount(page)) > before, 8_000);
      const help = await newestWindow(page, app.slug);
      // The window opens on its welcome page and shows the results of its search a moment later.
      await until(async () => (help ? (await help.innerText()).includes(A) : false), 8_000);
      const text = help ? await help.innerText() : "";
      if (help) await closeWindowLocator(help);
      return { ok: opened && text.includes(A), detail: text.replace(/\s+/g, " ").slice(0, 120) };
    },
  );
  // Window chrome.
  row(
    "chrome.close",
    "window",
    "button",
    "Close",
    "the red button",
    "the window closes",
    async (ctx) => {
      const w = await ensureOpen(ctx);
      await w.getByRole("button", { name: "Close", exact: true }).first().click();
      const ok = await until(async () => !(await w.isVisible()), 5_000);
      await ensureOpen(ctx);
      return ok;
    },
  );
  row(
    "chrome.minimize",
    "window",
    "button",
    "Minimize",
    "the yellow button; then the Dock item",
    "the window goes to the Dock and comes back from it",
    async (ctx) => {
      const { page } = ctx;
      const w = await ensureOpen(ctx);
      await w.getByRole("button", { name: "Minimize", exact: true }).first().click();
      const min = await until(async () => (await w.getAttribute("data-minimized")) !== null, 5_000);
      await (await dockItem(page, A)).click();
      const back = await until(
        async () => (await w.getAttribute("data-minimized")) === null && (await w.isVisible()),
        8_000,
      );
      return { ok: min && back, detail: `minimized ${min}, back ${back}` };
    },
  );
  if (app.zoomButton && app.fixedSize) {
    row(
      "chrome.zoom",
      "window",
      "button",
      "Zoom",
      "the green button",
      `dimmed: ${app.fixedSize}`,
      async (ctx) => {
        const w = await ensureOpen(ctx);
        const zoom = w.getByRole("button", { name: "Zoom", exact: true }).first();
        const dimmed =
          (await zoom.getAttribute("aria-disabled")) === "true" || (await zoom.isDisabled());
        return { ok: dimmed, detail: `dimmed ${dimmed}` };
      },
      { unavailable: app.fixedSize },
    );
  } else if (app.zoomButton) {
    row(
      "chrome.zoom",
      "window",
      "button",
      "Zoom",
      "the green button, twice",
      "the window zooms to fill the desktop and back",
      async (ctx) => {
        const w = await ensureOpen(ctx);
        const before = await box(w);
        await w.getByRole("button", { name: "Zoom", exact: true }).first().click();
        const zoomed = await until(
          async () => (await w.getAttribute("data-zoomed")) !== null,
          5_000,
        );
        await w.getByRole("button", { name: "Zoom", exact: true }).first().click();
        const back = await until(async () => (await w.getAttribute("data-zoomed")) === null, 5_000);
        const after = await box(w);
        return {
          ok: zoomed && back && Math.abs(after.width - before.width) < 2,
          detail: `zoomed ${zoomed}, back ${back}`,
        };
      },
    );
  } else {
    fullScreenRow(
      "chrome.enter-full-screen",
      { state: "window", role: "button", name: "Enter Full Screen", how: "the green button" },
      (_ctx, w) =>
        w.getByRole("button", { name: "Enter Full Screen", exact: true }).first().click(),
    );
  }
  row(
    "chrome.move",
    "window",
    "title bar",
    "title bar",
    "drag the title bar by (-100, 20), then back",
    "the window moves by the drag and back",
    async (ctx) => {
      const { page } = ctx;
      const w = await ensureOpen(ctx);
      const before = await box(w);
      // The drag region: the title text when the window shows one, else the title bar's empty
      // stretch, else the window's top edge strip beside its controls.
      const grips = [
        w.locator(".mac-title-bar-title-text").first(),
        w.locator(".mac-title-bar").first(),
      ];
      let start = null;
      let grip = "top strip";
      for (const [at, locator] of grips.entries()) {
        const b = await locator.boundingBox({ timeout: 1_000 }).catch(() => null);
        if (b && b.width > 4) {
          start =
            at === 0
              ? { x: b.x + b.width / 2, y: b.y + b.height / 2 }
              : { x: b.x + Math.min(b.width - 10, 110), y: b.y + 6 };
          grip = at === 0 ? "title text" : "title bar";
          break;
        }
      }
      start ??= { x: before.x + 110, y: before.y + 6 };
      const { x, y } = start;
      await page.mouse.move(x, y);
      await until(
        () =>
          page.evaluate(
            ([px, py]) => document.elementFromPoint(px, py)?.closest(".mac-title-bar") !== null,
            [x, y],
          ),
        2_000,
      );
      await page.mouse.down();
      await page.mouse.move(x - 50, y + 10, { steps: 5 });
      await page.mouse.move(x - 100, y + 20, { steps: 5 });
      await page.mouse.up();
      const after = await box(w);
      const ok = Math.abs(after.x - before.x + 100) < 3 && Math.abs(after.y - before.y - 20) < 3;
      // Put it back where it was: from the grip where it now is, after the double-click interval (the
      // window manager reads a second press on the title bar within it as a double-click, not a drag).
      await sleep(800);
      const gx = x + (after.x - before.x);
      const gy = y + (after.y - before.y);
      await page.mouse.move(gx, gy);
      await page.mouse.down();
      await page.mouse.move(gx + (before.x - after.x) / 2, gy + (before.y - after.y) / 2, {
        steps: 5,
      });
      await page.mouse.move(gx + before.x - after.x, gy + before.y - after.y, { steps: 5 });
      await page.mouse.up();
      const back = await box(w);
      return {
        ok: ok && Math.abs(back.x - before.x) < 3,
        detail: `grip ${grip}: (${before.x},${before.y}) -> (${after.x},${after.y}) -> (${back.x},${back.y})`,
      };
    },
  );
  // Inward and back: the window manager refuses a resize that would take a window out of the
  // desktop's bounds, and an app may open filling them.
  const EDGE_DELTA = {
    n: [0, 30],
    s: [0, -30],
    e: [-30, 0],
    w: [30, 0],
    ne: [-30, 30],
    se: [-30, -30],
    sw: [30, -30],
    nw: [30, 30],
  };
  for (const [edge, [dx, dy]] of Object.entries(EDGE_DELTA)) {
    if (app.resizable === false || app.fixedSize) {
      row(
        `chrome.resize.${edge}`,
        "window",
        "resize-handle",
        edge,
        `point at the ${edge} edge of the window`,
        "no resize handle: the window keeps its fixed size",
        async (ctx) => {
          const w = await ensureOpen(ctx);
          const handles = await w
            .locator(`.mac-managed-window-resize[data-edge="${edge}"]`)
            .count();
          return { ok: handles === 0, detail: `${handles} handle(s) on the ${edge} edge` };
        },
        { unavailable: app.fixedSize ?? "the window has a fixed size" },
      );
      continue;
    }
    row(
      `chrome.resize.${edge}`,
      "window",
      "resize-handle",
      edge,
      `drag the ${edge} resize handle inward by (${dx}, ${dy}), then back; if the window is at its smallest, outward and back`,
      "the window's frame changes on that side by the drag (shrinks inward, or grows outward at its smallest size), and returns",
      async (ctx) => {
        const { page } = ctx;
        const w = await ensureOpen(ctx);
        const handle = w.locator(`.mac-managed-window-resize[data-edge="${edge}"]`);
        const original = await box(w);
        /**
         * Drag the handle by (sx, sy), then back by the displacement the window actually applied
         * (none when it refused), answering whether the frame followed the drag and how it moved.
         */
        const attempt = async (sx, sy, grow) => {
          const before = await box(w);
          const h = await box(handle);
          const x = h.x + h.width / 2;
          const y = h.y + h.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + sx / 2, y + sy / 2, { steps: 4 });
          await page.mouse.move(x + sx, y + sy, { steps: 4 });
          await page.mouse.up();
          const after = await box(w);
          const sign = grow ? 1 : -1;
          const okW =
            sx === 0
              ? Math.abs(after.width - before.width) < 2
              : Math.abs(after.width - before.width - sign * Math.abs(sx)) < 3;
          const okH =
            sy === 0
              ? Math.abs(after.height - before.height) < 2
              : Math.abs(after.height - before.height - sign * Math.abs(sy)) < 3;
          const moved =
            Math.abs(after.width - before.width) >= 2 ||
            Math.abs(after.height - before.height) >= 2;
          const h2 = await box(handle);
          const mx = h2.x - h.x;
          const my = h2.y - h.y;
          if (Math.abs(mx) >= 1 || Math.abs(my) >= 1) {
            await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
            await page.mouse.down();
            await page.mouse.move(h2.x + h2.width / 2 - mx, h2.y + h2.height / 2 - my, {
              steps: 6,
            });
            await page.mouse.up();
          }
          const back = await box(w);
          const ok =
            okW &&
            okH &&
            Math.abs(back.width - before.width) < 3 &&
            Math.abs(back.height - before.height) < 3;
          return {
            ok,
            moved,
            detail: `${before.width}x${before.height} -> ${after.width}x${after.height} -> ${back.width}x${back.height}`,
          };
        };
        const restored = async () => {
          const now = await box(w);
          return (
            Math.abs(now.width - original.width) < 3 &&
            Math.abs(now.height - original.height) < 3 &&
            Math.abs(now.x - original.x) < 3 &&
            Math.abs(now.y - original.y) < 3
          );
        };
        // A bottom edge that lies in the Dock's band at the foot of the screen could not be grabbed in
        // round 3 runs (TV, Podcasts, Music); it fails here, honestly, rather than being worked round.
        let result;
        const inward = await attempt(dx, dy, false);
        if (inward.ok) result = { ok: true, detail: `inward ${inward.detail}` };
        // Only a window that did not move at all is at its smallest size; it must grow outward instead.
        else if (inward.moved)
          result = {
            ok: false,
            detail: `inward ${inward.detail}: the frame moved but not by the drag`,
          };
        else {
          const outward = await attempt(-dx, -dy, true);
          result = {
            ok: outward.ok,
            detail: `inward refused ${inward.detail}; outward ${outward.detail}`,
          };
        }
        const back = await restored();
        return { ok: result.ok && back, detail: `${result.detail}; restored ${back}` };
      },
    );
  }
  return rows;
}

/** After each row: no menu or dialog is left open over the next one. */
async function defaultRecover(ctx) {
  await closeMenus(ctx.page);
  for (let n = 0; n < 2 && (await ctx.page.getByRole("dialog").count()) > 0; n += 1)
    await ctx.page.keyboard.press("Escape");
}

/** Process ids of `ferrite dev` serving `port`. */
export function ferritePids(port = 8080) {
  try {
    return execSync(`pgrep -f "ferrite dev --port ${port}( |$)"`)
      .toString()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * The census run of one app. `rows` are the app's census rows:
 *   { id, state, role, name, how, expected, persists = "none", check?, restartCheck?, unavailable?, na? }
 * `check(ctx)` performs the row with real input and answers true, false, or { ok, detail };
 * `na(engine)` answers a reason when the engine cannot do it (the honest message is then what
 * `check` verifies); `restartCheck(ctx)` re-checks a persistent row after a restart.
 * `setup(ctx)` signs in and opens the app; `states` lists the extra states the crawl visits.
 */
export async function censusRun(app) {
  const opts = options();
  const { base, out, browserName, phase } = opts;
  const file = path.basename(process.argv[1]);
  if (opts.list) {
    console.log(CENSUS_COLUMNS.join("\t"));
    for (const row of app.rows) console.log(censusLine(app, row, file, {}).join("\t"));
    return;
  }
  const statePath = path.join(out, `${app.slug}-${browserName}-state.json`);
  const resultsPath = path.join(out, `${app.slug}-${browserName}-${phase}.tsv`);
  writeFileSync(resultsPath, "id\tresult\tdetail\n");
  const run = Date.now().toString(36);
  const problems = [];
  const results = new Map();
  const record = (id, result, detail = "") => {
    results.set(id, result);
    const label = result === "pass" ? "ok  " : result === "fail" ? "FAIL" : result.split(":")[0];
    console.log(
      `${label} ${id}${detail ? ` (${String(detail).replace(/\s+/g, " ").slice(0, 300)})` : ""}`,
    );
    appendFileSync(
      resultsPath,
      `${id}\t${result}\t${String(detail).replace(/\s+/g, " ").slice(0, 500)}\n`,
    );
  };
  const { browser, contextOptions } = await launchBrowser(browserName, {
    media: app.media ?? "none",
    headed: opts.headed,
  });
  const firstParty = (url) => {
    try {
      return !url || new URL(url, base).origin === new URL(base).origin;
    } catch {
      return true;
    }
  };
  const allowed = app.allowedErrors ?? [];
  /** A browser context and page of the run, every page error, console error and 5xx recorded. */
  const newPage = async () => {
    const context = await browser.newContext(contextOptions);
    context.setDefaultTimeout(10_000);
    await trackMedia(context);
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (!firstParty(message.location()?.url)) return;
      if (allowed.some((pattern) => pattern.test(text))) return;
      problems.push(`console: ${text.slice(0, 300)}`);
    });
    page.on("pageerror", (error) => problems.push(`page error: ${error.message.slice(0, 300)}`));
    page.on("response", (response) => {
      if (response.status() >= 500 && firstParty(response.url()))
        problems.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    return { context, page };
  };
  const { context, page } = await newPage();
  // A check's stray promise (a response it no longer awaits) must not end the run, and fails it.
  process.on("unhandledRejection", (reason) => {
    problems.push(`unhandled rejection: ${String(reason).split("\n")[0].slice(0, 200)}`);
  });
  const ctx = {
    page,
    context,
    browser,
    base,
    out,
    engine: browserName,
    run,
    app,
    opts,
    record,
    problems,
    data: {},
    newPage,
  };
  const TIMED_OUT = Symbol("timed out");
  // How long a timed-out check may take to stop once its context is closed.
  const SETTLE_MS = 30_000;
  let saved = null;
  try {
    if (phase === "restart-check") {
      saved = JSON.parse(readFileSync(statePath, "utf8"));
      ctx.account = saved.account;
      ctx.data = saved.data ?? {};
      await signIn(ctx.page, base, ctx.account);
      console.log(
        `note restart-check of ${saved.account.name}; ferrite dev pids now ${ferritePids().join(",") || "none"}`,
      );
    } else {
      ctx.account = person(app.slug.replace(/[^a-z]/g, ""), run);
      await createAccount(ctx.page, base, ctx.account);
    }
    ctx.window = await app.open(ctx);
    const selected = opts.only
      ? app.rows.filter(
          (row) => row.setup || opts.only.split(",").some((part) => row.id.includes(part)),
        )
      : app.rows;
    let abandoned = false;
    for (const row of selected) {
      if (phase === "restart-check" && row.persists !== "restart") continue;
      const na = row.na?.(browserName);
      const fn = phase === "restart-check" ? row.restartCheck : row.check;
      if (row.unavailable && !fn) {
        record(row.id, `unavailable:${row.unavailable}`);
        continue;
      }
      if (!fn) {
        record(row.id, "fail", "no check written for this row");
        continue;
      }
      try {
        // A check that outlives its time is cut off: its context is closed (so whatever it still
        // awaits rejects), it is awaited until it settles, and the run goes on in a fresh context
        // signed in to the same account, so no timed-out check runs alongside a later one. One that
        // does not settle would run alongside them: it ends the run instead.
        const pending = Promise.resolve().then(() => fn(ctx, row));
        let timer;
        const answer = await Promise.race([
          pending,
          new Promise((resolve) => {
            timer = setTimeout(() => resolve(TIMED_OUT), row.timeout ?? 60_000);
          }),
        ]);
        clearTimeout(timer);
        if (answer === TIMED_OUT) {
          record(
            row.id,
            "fail",
            `timed out after ${(row.timeout ?? 60_000) / 1000} s; context closed and replaced`,
          );
          const stopped = await Promise.race([
            Promise.all([ctx.context.close().catch(() => {}), pending.catch(() => {})]).then(
              () => true,
            ),
            sleep(SETTLE_MS).then(() => false),
          ]);
          if (!stopped) {
            const untried = selected.slice(selected.indexOf(row) + 1);
            for (const rest of untried)
              record(rest.id, "fail", `not run: ${row.id} would not stop`);
            problems.push(
              `${row.id} had not stopped ${SETTLE_MS / 1000} s after its context closed`,
            );
            abandoned = true;
            break;
          }
          Object.assign(ctx, await newPage());
          await signIn(ctx.page, base, ctx.account);
          ctx.window = await app.open(ctx);
          continue;
        }
        const ok = typeof answer === "object" && answer !== null ? answer.ok : answer;
        const detail = typeof answer === "object" && answer !== null ? (answer.detail ?? "") : "";
        // A check may find the control dimmed with its reason shown: unavailable, not a pass.
        const shownUnavailable =
          typeof answer === "object" && answer !== null ? answer.unavailable : undefined;
        // A check may find nothing to check today in outside data (n/a, with the reason).
        const shownNa = typeof answer === "object" && answer !== null ? answer.na : undefined;
        if (ok && (na || shownNa)) record(row.id, `n/a:${na ?? shownNa}`, detail);
        else if (ok && shownUnavailable) record(row.id, `unavailable:${shownUnavailable}`, detail);
        else if (ok && row.unavailable) record(row.id, `unavailable:${row.unavailable}`, detail);
        else record(row.id, ok ? "pass" : "fail", detail);
      } catch (error) {
        const lines = error instanceof Error ? error.message.split("\n") : [String(error)];
        const waiting = lines.find((line) => /waiting for|resolved to/.test(line));
        record(row.id, "fail", `${lines[0]}${waiting ? ` | ${waiting.trim().slice(0, 200)}` : ""}`);
      }
      // What the page showed when a row failed, before recovery changes it.
      if (results.get(row.id) === "fail")
        await ctx.page
          .screenshot({ path: path.join(out, `${app.slug}-${browserName}-fail-${row.id}.png`) })
          .catch(() => {});
      await (app.recover ?? defaultRecover)(ctx, row, {
        failed: results.get(row.id) === "fail",
      }).catch(() => {});
    }
    if (phase === "write" || phase === "all") {
      writeFileSync(
        statePath,
        JSON.stringify(
          { account: ctx.account, data: ctx.data, at: new Date().toISOString() },
          null,
          2,
        ),
      );
    }
    if (opts.crawl && phase !== "restart-check" && !abandoned) await crawlCheck(ctx, selected);
    if (opts.exploreMinutes > 0 && phase !== "restart-check" && !abandoned) await explore(ctx);
  } catch (error) {
    problems.push(`run aborted: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  } finally {
    await ctx.page
      .screenshot({ path: path.join(out, `${app.slug}-${browserName}-${phase}.png`) })
      .catch(() => {});
    await browser.close().catch(() => {});
  }
  const failed = [...results.values()].filter((value) => value === "fail").length;
  console.log(
    `\n${app.slug} ${browserName} ${phase}: ${results.size} rows, ${failed} failed, ${problems.length} page problem(s)`,
  );
  for (const problem of problems) console.log(`  problem: ${problem}`);
  process.exit(failed > 0 || problems.length > 0 ? 1 : 0);
}

function censusLine(app, row, file, cells) {
  return [
    row.id,
    app.slug,
    row.state,
    row.role,
    row.name,
    row.how,
    row.expected,
    `${file} ${row.id}`,
    row.persists ?? "none",
    cells.chromium ?? "",
    cells.chrome ?? "",
    cells.firefox ?? "",
    cells.webkit ?? "",
    row.notes ?? "",
  ].map((value) => String(value).replace(/[\t\n]/g, " "));
}

/**
 * R8's matching rule (campaign/round3/r8/census-matching.md): a crawled control is listed when a
 * row has its role and a name equal to it (whitespace collapsed) or matching the row's anchored
 * `/regex/`; a row whose state starts `menu:<Title>` matches only items of that top-level menu.
 */
export function rowMatches(row, crawled) {
  if (row.role !== crawled.role) return false;
  const collapse = (text) => String(text).trim().replace(/\s+/g, " ");
  const regex = /^\/(.*)\/(i?)$/.exec(row.name);
  const named = regex
    ? new RegExp(`^(?:${regex[1]})$`, regex[2]).test(collapse(crawled.name))
    : collapse(row.name) === collapse(crawled.name);
  if (!named) return false;
  const menu = /^menu:([^>]+)/.exec(row.state ?? "");
  if (!menu) return true;
  const crawledMenu = /^menu:([^>]+)/.exec(crawled.state ?? "");
  return !!crawledMenu && crawledMenu[1].trim() === menu[1].trim();
}

/** Crawl the app's states and menus and fail on every actionable control no row names. */
async function crawlCheck(ctx, rows) {
  const { page, app, out, engine, record } = ctx;
  const seen = [];
  for (const state of app.states ?? [{ name: "main", enter: async () => {} }]) {
    try {
      ctx.window = (await state.enter(ctx)) ?? ctx.window ?? (await topWindow(page));
      const window = state.window ? await state.window(ctx) : ctx.window;
      seen.push(
        ...(await crawlState(page, window, state.name, {
          menus: state.menus ?? state.name === "main",
        })),
      );
      await state.leave?.(ctx);
    } catch (error) {
      seen.push({ state: state.name, role: "error", name: String(error).slice(0, 160), attrs: "" });
    }
  }
  writeFileSync(
    path.join(out, `${app.slug}-${engine}-crawl.tsv`),
    `state\trole\tname\tattrs\n${seen.map((row) => [row.state, row.role, row.name, row.attrs].join("\t")).join("\n")}\n`,
  );
  const unlisted = seen.filter(
    (row) =>
      row.role !== "error" &&
      !rows.some((each) => rowMatches(each, row)) &&
      !/^menu:Apple( >|$)/.test(row.state) &&
      !(app.crawlIgnore ?? []).some((pattern) =>
        pattern.test(`${row.state}|${row.role}|${row.name}`),
      ),
  );
  const unique = [...new Map(unlisted.map((row) => [`${row.role}|${row.name}`, row])).values()];
  for (const row of unique) console.log(`UNLISTED ${row.state} | ${row.role} | ${row.name}`);
  const errors = seen.filter((row) => row.role === "error");
  for (const row of errors) console.log(`CRAWL-ERROR ${row.state} | ${row.name}`);
  record(
    `${app.slug}.crawl.no-unlisted-control`,
    unique.length === 0 && errors.length === 0 ? "pass" : "fail",
    `${seen.length} controls crawled, ${unique.length} unlisted, ${errors.length} errors`,
  );
}

/** A seeded generator (mulberry32). */
export function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The exploratory pass: seeded random real input (clicks, double clicks, right clicks, drags,
 * wheel, keys) inside the app's window for `--explore-minutes`, every action recorded to
 * <out>/<app>-<engine>-explore.log. It fails on any first-party page error, console error, 5xx
 * (the run's own watchers), a UI that stops answering (after every 25 actions the Dock's Finder is
 * clicked and must take the menu bar within 10 s, then the app is opened again), a window that
 * cannot be opened after `REOPEN_TRIES` tries in a row, or no action at all. A closed window is
 * opened again; menus left open are closed.
 */
async function explore(ctx) {
  const { page, app, out, engine, opts, record, problems } = ctx;
  const REOPEN_TRIES = 5;
  const random = rng(opts.seed);
  const logPath = path.join(out, `${app.slug}-${engine}-explore.log`);
  writeFileSync(logPath, `seed ${opts.seed} minutes ${opts.exploreMinutes} engine ${engine}\n`);
  const before = problems.length;
  const end = Date.now() + opts.exploreMinutes * 60_000;
  const keys = app.exploreKeys ?? [
    "Space",
    "Enter",
    "Escape",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Tab",
    "a",
    "x",
    "1",
    "ControlOrMeta+a",
    "ControlOrMeta+i",
    "Delete",
    "Backspace",
  ];
  let actions = 0;
  let stuck = false;
  let reopens = 0;
  while (Date.now() < end && !stuck) {
    const window = await topWindow(page);
    const box = await window.boundingBox().catch(() => null);
    const ownWindow = box && (await activeIs(page, app.name));
    if (!box || !ownWindow) {
      reopens += 1;
      if (reopens > REOPEN_TRIES) {
        stuck = true;
        problems.push(`explore: ${app.name} would not open after ${REOPEN_TRIES} tries`);
        break;
      }
      appendFileSync(logPath, `${actions} reopen ${app.name}\n`);
      for (let n = 0; n < 3; n += 1) await page.keyboard.press("Escape");
      ctx.window = await app.open(ctx).catch(() => null);
      continue;
    }
    reopens = 0;
    const x = box.x + 8 + random() * Math.max(1, box.width - 16);
    const y = box.y + 30 + random() * Math.max(1, box.height - 38);
    const roll = random();
    let action;
    try {
      if (roll < 0.45) {
        action = `click ${x.toFixed(0)},${y.toFixed(0)}`;
        await page.mouse.click(x, y);
      } else if (roll < 0.55) {
        action = `dblclick ${x.toFixed(0)},${y.toFixed(0)}`;
        await page.mouse.dblclick(x, y);
      } else if (roll < 0.62) {
        action = `rightclick ${x.toFixed(0)},${y.toFixed(0)}`;
        await page.mouse.click(x, y, { button: "right" });
      } else if (roll < 0.7) {
        const dx = (random() - 0.5) * 200;
        const dy = (random() - 0.5) * 200;
        action = `drag ${x.toFixed(0)},${y.toFixed(0)} by ${dx.toFixed(0)},${dy.toFixed(0)}`;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
        await page.mouse.move(x + dx, y + dy, { steps: 4 });
        await page.mouse.up();
      } else if (roll < 0.76) {
        action = `wheel ${x.toFixed(0)},${y.toFixed(0)}`;
        await page.mouse.move(x, y);
        await page.mouse.wheel(0, (random() - 0.5) * 600);
      } else {
        const key = keys[Math.floor(random() * keys.length)];
        action = `key ${key}`;
        await page.keyboard.press(key);
      }
    } catch (error) {
      action = `${action} (threw: ${String(error).split("\n")[0].slice(0, 120)})`;
    }
    actions += 1;
    appendFileSync(logPath, `${actions} ${action}\n`);
    await sleep(60);
    if (actions % 25 === 0) {
      await closeMenus(page);
      for (let n = 0; n < 2 && (await page.getByRole("dialog").count()) > 0; n += 1)
        await page.keyboard.press("Escape");
      const answered = await finder(page)
        .click({ timeout: 10_000 })
        .then(() => until(() => activeIs(page, "Finder"), 10_000))
        .catch(() => false);
      appendFileSync(logPath, `${actions} Finder from the Dock: ${answered}\n`);
      if (!answered) {
        stuck = true;
        problems.push(`explore: the UI stopped answering after action ${actions}`);
      }
    }
    if (problems.length > before) {
      appendFileSync(
        logPath,
        `problem after action ${actions}: ${problems.slice(before).join(" | ")}\n`,
      );
      break;
    }
  }
  const clean = problems.length === before && !stuck && actions > 0;
  record(
    `${app.slug}.explore.${engine}`,
    clean ? "pass" : "fail",
    `${actions} actions, seed ${opts.seed}${clean ? "" : `: ${problems.slice(before).join(" | ")}`}`,
  );
}
