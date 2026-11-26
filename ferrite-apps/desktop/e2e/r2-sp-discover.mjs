#!/usr/bin/env node
// Discovery for System Preferences' census (R2): a fresh account opens System Preferences from the Dock and, in every pane
// of the grid and the account header, in each of its tabs, presses every control once with real input (a click; a pop-up's
// other option; a slider's track at another point; typing in a field), then reads back what happened: the account's
// settings on the server (GET /api/system-preferences/settings: which keys changed), the desktop around the window (the
// page's theme attributes, the Dock, the desktop picture), a "Not part of this demo" popover, another pane, a dialog, or
// the control's own state. Writes <out>/sp-discovery-<browser>.json, the rows the census suite
// (system-preferences-census-journey.mjs) verifies. Diagnosis and enumeration: it asserts nothing.
//
//   node e2e/r2-sp-discover.mjs --url http://127.0.0.1:8080 --browser chromium --out <dir> [--panes general,dock]

import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  api,
  CENSUS_ROLES,
  censusOptions,
  createAccount,
  dockButton,
  ENGINES,
  parseAria,
  person,
} from "./r2-census-kit.mjs";

/** The panes, in the catalogue's order: the account header's two, then the grid's thirty-one. */
export const SP_PANES = [
  ["apple-id", "Apple ID"],
  ["family-sharing", "Family Sharing"],
  ["general", "General"],
  ["desktop-and-screen-saver", "Desktop & Screen Saver"],
  ["dock", "Dock"],
  ["mission-control", "Mission Control"],
  ["siri", "Siri"],
  ["spotlight", "Spotlight"],
  ["language-and-region", "Language & Region"],
  ["notifications", "Notifications"],
  ["internet-accounts", "Internet Accounts"],
  ["wallet-and-apple-pay", "Wallet & Apple Pay"],
  ["touch-id", "Touch ID"],
  ["users-and-groups", "Users & Groups"],
  ["accessibility", "Accessibility"],
  ["screen-time", "Screen Time"],
  ["extensions", "Extensions"],
  ["security-and-privacy", "Security & Privacy"],
  ["software-update", "Software Update"],
  ["network", "Network"],
  ["bluetooth", "Bluetooth"],
  ["sound", "Sound"],
  ["printers-and-scanners", "Printers & Scanners"],
  ["keyboard", "Keyboard"],
  ["trackpad", "Trackpad"],
  ["mouse", "Mouse"],
  ["displays", "Displays"],
  ["sidecar", "Sidecar"],
  ["energy-saver", "Energy Saver"],
  ["date-and-time", "Date & Time"],
  ["sharing", "Sharing"],
  ["time-machine", "Time Machine"],
  ["startup-disk", "Startup Disk"],
];
const HEADER = new Set(["apple-id", "family-sharing"]);
const SETTINGS = "/api/system-preferences/settings";

const frameOf = (page) => page.locator('.mac-managed-window[data-window-id="system-preferences"]');
const paneRoot = (page, id) =>
  frameOf(page).locator(`.mac-system-preferences-pane[data-pane="${id}"]`);

/**
 * How many pop-ups, menus and dialogs are open over the window (read only): a pop-up's list is portalled outside the
 * window, a list inside a pane (a pane's own list box) is not counted.
 */
const overlays = (page) =>
  page.evaluate(
    () =>
      [
        ...document.querySelectorAll(
          '[role="listbox"], [role="menu"][data-open], [role="dialog"], [role="alertdialog"]',
        ),
      ].filter(
        (e) =>
          e.getBoundingClientRect().width > 0 &&
          !(e.getAttribute("role") === "listbox" && e.closest(".mac-managed-window")),
      ).length,
  );

/** Closes what a press left open over the window (a pop-up's list, a menu, a popover, a sheet) with Escape, and the Help Viewer a pane's Help button opened. */
export async function closeOverlays(page) {
  const help = page.locator('.mac-managed-window[data-window-id="help-viewer"]');
  if ((await help.count()) > 0) {
    await help.getByRole("button", { name: /close/i }).first().click();
    await help.waitFor({ state: "detached", timeout: 5_000 });
  }
  for (let i = 0; i < 4; i += 1) {
    if ((await overlays(page)) === 0) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
}

/** Shows the pane `id` (named `name`): from the grid, through Show All when another pane is open; `fresh` always goes
 * through Show All, so the pane is drawn again in its first state (a sidebar item's detail is left). */
export async function openPane(page, id, name, fresh = false) {
  const frame = frameOf(page);
  await closeOverlays(page);
  if (!fresh && (await paneRoot(page, id).count()) > 0) return paneRoot(page, id);
  if ((await frame.getByRole("group", { name: "All preferences" }).count()) === 0) {
    await frame.getByRole("button", { name: "Show All" }).first().click();
    await frame.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 8_000 });
  }
  const scope = HEADER.has(id) ? frame : frame.getByRole("group", { name: "All preferences" });
  await scope.getByRole("button", { name, exact: true }).first().click();
  await paneRoot(page, id).waitFor({ timeout: 8_000 });
  await page.waitForTimeout(300);
  return paneRoot(page, id);
}

/** The controls of a pane (or of its open tab) in document order: role, name, and which of that role and name it is. */
export async function controlsOf(root) {
  const seen = new Map();
  const out = [];
  for (const node of parseAria(await root.ariaSnapshot({ timeout: 15_000 }))) {
    if (!CENSUS_ROLES.has(node.role) || node.role === "tab" || node.role === "listbox") continue;
    const name = node.name || "";
    const k = `${node.role}|${name}`;
    const index = seen.get(k) ?? 0;
    seen.set(k, index + 1);
    out.push({ role: node.role, name, index, disabled: /\[disabled\]/.test(node.attrs) });
  }
  return out;
}

/**
 * The control as `controlsOf` counted it: the `index`-th of its role with exactly its accessible name. An unnamed control is
 * counted, and found, among the unnamed controls of its role only (an exact empty name), never among named ones.
 */
export const locate = (root, control) =>
  root.getByRole(control.role, { name: control.name, exact: true }).nth(control.index);

/** The reason a dimmed control gives under the pointer: the title on it or on what holds it (read only). */
const whyDimmed = (root, control) =>
  locate(root, control)
    .evaluate((e) => e.closest("[title]")?.getAttribute("title") ?? "")
    .catch(() => "");

/** A control's own state, as its role reports it (read only). */
export function stateOf(locator) {
  return locator.evaluate((e) => {
    const role = e.getAttribute("role") || e.tagName.toLowerCase();
    if (e.matches("input[type=checkbox], input[type=radio]")) return String(e.checked);
    if (e.matches("input[type=range]")) return e.value;
    if (e.matches("input, textarea")) return e.value;
    return [
      e.getAttribute("aria-checked"),
      e.getAttribute("aria-selected"),
      e.getAttribute("aria-pressed"),
      e.getAttribute("aria-valuenow"),
      role === "combobox" || role === "button" ? e.textContent.trim().slice(0, 60) : null,
      e.getAttribute("data-checked") !== null ? "checked" : null,
    ]
      .map((v) => v ?? "")
      .join("|");
  });
}

/** The desktop around System Preferences: what a setting that takes effect changes (read only). */
export function shellOf(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const dock = document.querySelector(".mac-desktop-shell-dock");
    const attrs = (e) =>
      e
        ? [...e.attributes]
            .filter((a) => a.name.startsWith("data-") || a.name === "style")
            .map((a) => `${a.name}=${a.value}`)
            .sort()
            .join(" ")
        : null;
    return {
      html: attrs(html),
      dock: attrs(dock),
      picture: [...document.querySelectorAll(".mac-desktop-shell-picture img")]
        .map((img) => img.getAttribute("src"))
        .join(" "),
    };
  });
}

/**
 * What the desktop writes for its own reasons while a control is pressed: where the windows are, the pane shown, the
 * recent applications and Screen Time's count. A press is not answerable for them.
 */
export const AMBIENT_KEYS = new Set([
  "desktop.windows",
  "desktop.recentApps",
  "window.pane",
  "screen-time.usage",
  "screen-time.notifications",
  "desktop.spaces",
]);

/** Tabs are not pressed as controls, and a pane remembers the one it shows for its own reasons. */
export const isAmbientKey = (key) => AMBIENT_KEYS.has(key) || key.endsWith(".tab");

export async function settingsOf(page) {
  const reply = await api(page, "GET", SETTINGS);
  const values = Object.fromEntries(
    Object.entries(reply.json?.values ?? {}).filter(([key]) => !isAmbientKey(key)),
  );
  return { values, theme: reply.json?.theme ?? null };
}

const changedKeys = (a, b) =>
  [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].filter(
    (k) => JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]),
  );

/** Presses `control` once with real input; answers what was done. */
export async function press(page, root, control) {
  const target = locate(root, control);
  await target.scrollIntoViewIfNeeded().catch(() => {});
  switch (control.role) {
    case "combobox": {
      await target.click({ timeout: 4_000 });
      // The pop-up's own list, portalled outside the window: a pane's own list box (Language & Region's preferred languages)
      // may be on the page beside it, and the button does not name its list until the list is there.
      const list = page
        .locator(
          'xpath=//*[(@role="listbox" or (@role="menu" and @data-open)) and not(ancestor::*[contains(@class,"mac-managed-window")])]',
        )
        .locator("visible=true")
        .last();
      await list.waitFor({ timeout: 3_000 });
      const options = list.locator('[role="option"], [role="menuitemradio"], [role="menuitem"]');
      // The list fills a moment after it opens: until then only the chosen item may be in it.
      let count = -1;
      for (let i = 0; i < 15; i += 1) {
        const now = await options.count();
        if (now > 0 && now === count) break;
        count = now;
        await page.waitForTimeout(100);
      }
      for (let i = count - 1; i >= 0; i -= 1) {
        const option = options.nth(i);
        const selected =
          (await option.getAttribute("aria-selected")) === "true" ||
          (await option.getAttribute("aria-checked")) === "true";
        const disabled =
          (await option.getAttribute("aria-disabled")) === "true" ||
          (await option.getAttribute("data-disabled")) !== null;
        if (!selected && !disabled) {
          const label = ((await option.textContent()) ?? "").trim();
          await option.click({ timeout: 3_000 });
          return `chose ${label}`;
        }
      }
      await page.keyboard.press("Escape");
      return "no other option";
    }
    case "slider": {
      const box = await target.boundingBox();
      const thumb = await target.evaluate((e) =>
        Number(e.getAttribute("aria-valuenow") ?? e.value),
      );
      const min = await target.evaluate((e) =>
        Number(e.getAttribute("aria-valuemin") ?? e.min ?? 0),
      );
      const max = await target.evaluate((e) =>
        Number(e.getAttribute("aria-valuemax") ?? e.max ?? 100),
      );
      const low = (thumb - min) / (max - min || 1) < 0.5;
      const track = await target.evaluate((e) => {
        const t = e.closest(".mac-slider")?.getBoundingClientRect() ?? e.getBoundingClientRect();
        return { x: t.x, y: t.y, width: t.width, height: t.height };
      });
      const b = track.width > 4 ? track : box;
      await page.mouse.click(b.x + b.width * (low ? 0.8 : 0.2), b.y + b.height / 2);
      return `track at ${low ? "80" : "20"}%`;
    }
    case "spinbutton": {
      // Stepped as a person steps it: an AM/PM field takes no digits.
      await target.click({ timeout: 4_000 });
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("Tab");
      return "stepped up";
    }
    case "textbox":
    case "searchbox": {
      await target.click({ timeout: 4_000 });
      await page.keyboard.press("Control+a");
      await page.keyboard.type("R2 census");
      await page.keyboard.press("Tab");
      return "typed";
    }
    default:
      await target.click({ timeout: 4_000 });
      return "clicked";
  }
}

/** What a press did, read back. */
export async function observe(page, id, root, control, before) {
  await page.waitForTimeout(700);
  const popover = page.getByRole("dialog").filter({ hasText: "Not part of this demo" }).last();
  const refused =
    (await popover.count()) > 0 && (await popover.isVisible().catch(() => false))
      ? ((await popover.textContent()) ?? "").replace(/\s+/g, " ").trim()
      : null;
  const otherDialog =
    !refused &&
    (await page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').count()) > 0;
  const shownPane = await frameOf(page)
    .locator(".mac-system-preferences-pane")
    .first()
    .getAttribute("data-pane")
    .catch(() => null);
  let after = { settings: await settingsOf(page), shell: await shellOf(page) };
  const stillThere = shownPane === id && (await locate(root, control).count()) > 0;
  const state = stillThere ? await stateOf(locate(root, control)).catch(() => null) : null;
  const wrote = () =>
    changedKeys(before.settings.values, after.settings.values).length > 0 ||
    JSON.stringify(before.settings.theme) !== JSON.stringify(after.settings.theme);
  // A control that shows a new state usually saves it, and on a busy machine the save can land
  // later than the first read. One that shows nothing new can save late as well, so it gets a shorter wait.
  const reads = state !== before.state ? 5 : 2;
  for (let i = 0; i < reads && !refused && shownPane === id && !wrote(); i += 1) {
    await page.waitForTimeout(500);
    after = { settings: await settingsOf(page), shell: await shellOf(page) };
  }
  const keys = changedKeys(before.settings.values, after.settings.values);
  const theme = JSON.stringify(before.settings.theme) !== JSON.stringify(after.settings.theme);
  const shell = Object.keys(after.shell).filter((k) => after.shell[k] !== before.shell[k]);
  let kind = "none";
  if (refused) kind = "unavailable";
  else if (shownPane !== id) kind = "navigates";
  else if (keys.length > 0 || theme) kind = shell.length > 0 ? "takes-effect" : "saves";
  else if (otherDialog) kind = "dialog";
  else if (state !== before.state) kind = "ui-only";
  return {
    kind,
    keys,
    theme,
    shell,
    refused,
    navigates: shownPane !== id ? shownPane : null,
    state,
    before: before.state,
    after,
  };
}

/** Puts the window back on the pane and tab after a press that left it; `fresh` draws the pane again first. */
async function settle(page, id, name, tab, fresh = false) {
  await closeOverlays(page);
  const root = await openPane(page, id, name, fresh);
  if (tab) {
    const t = root.getByRole("tab", { name: tab, exact: true }).first();
    await t.waitFor({ timeout: 4_000 });
    if ((await t.getAttribute("aria-selected")) !== "true") await t.click();
    await page.waitForTimeout(250);
  }
  return root;
}

/**
 * The view a row is found in: the pane's tab, and the controls pressed in turn to reveal it (a sidebar item's detail, and
 * an item of that). A view is entered from the pane drawn afresh, its whole path replayed; `fresh` is false only to stay
 * in the view the last press left as it was.
 */
async function enter(page, id, name, view, fresh) {
  let root = await settle(page, id, name, view.tab, fresh || view.path.length > 0);
  for (const via of view.path) {
    const target = locate(root, via);
    await target.waitFor({ timeout: 4_000 });
    await target.click();
    await page.waitForTimeout(400);
    root = paneRoot(page, id);
  }
  return root;
}

const baseKey = (control) => `${control.role}|${control.name}|${control.index}`;
const pathKey = (view) => view.path.map(baseKey).join(" > ");
const keyOf = (view, control) => `${view.tab ?? ""}|${pathKey(view)}|${baseKey(control)}`;

/**
 * The account's settings once what replaying a view's path wrote has landed (Extensions' category, on pressing its sidebar
 * item): two reads in a row the same, up to 3 s. Read sooner, those writes would count as the press's.
 */
async function settledSettingsOf(page) {
  let last = await settingsOf(page);
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(500);
    const now = await settingsOf(page);
    if (JSON.stringify(now) === JSON.stringify(last)) return now;
    last = now;
  }
  return last;
}

/** Presses `control` in `view` and reads back what followed. */
async function pressIn(page, id, name, view, control, dirty) {
  const root = await enter(page, id, name, view, dirty);
  const target = locate(root, control);
  await target.waitFor({ timeout: 2_000 }).catch(() => {});
  if ((await target.count()) === 0) return { kind: "gone" };
  if (
    (await target.isDisabled().catch(() => false)) ||
    (await target.getAttribute("aria-disabled")) === "true"
  )
    return { kind: "disabled-now" };
  const before = {
    settings: view.path.length > 0 ? await settledSettingsOf(page) : await settingsOf(page),
    shell: await shellOf(page),
    state: await stateOf(target),
  };
  const did = await press(page, root, control);
  const { after, ...result } = await observe(page, id, root, control, before);
  return { did, ...result };
}

/**
 * Every control of the pane `id` (named `name`), in each of its tabs and the views its presses reveal, pressed once with
 * real input in the window System Preferences shows on `page` (signed in, the window open), and what each press did.
 * `fresh()`, when given, signs a fresh account in and opens System Preferences on the page it answers: a control an
 * earlier press of this pane took away or disabled is then pressed again there, in its view, on settings as they first
 * are. Answers `{ note, rows }`: the pane's effects note and one row per control, its view (`tab`, `path`) as data.
 */
export async function discoverPane(page, id, name, { fresh } = {}) {
  const rows = [];
  let note = "";
  const queue = [];
  // The pane's settings when discovery reaches it: a control found disabled is put down to the keys changed since.
  let paneStart = { values: {} };
  try {
    const root = await openPane(page, id, name);
    paneStart = await settingsOf(page);
    note = (
      (await frameOf(page)
        .locator(".mac-system-preferences-effects")
        .textContent()
        .catch(() => "")) ?? ""
    ).trim();
    const tabNames = (await root.getByRole("tab").allTextContents()).map((t) => t.trim());
    for (const tab of tabNames.length > 0 ? tabNames : [null])
      queue.push({ tab, path: [], depth: 0, parent: null });
  } catch (error) {
    rows.push({
      pane: id,
      paneName: name,
      kind: "pane-error",
      error: String(error.message).split("\n")[0],
    });
    return { note, rows };
  }
  const done = new Set();
  while (queue.length > 0) {
    const view = queue.shift();
    let controls;
    // A view starts from the pane drawn afresh; within it, a press that left the view as it was needs no redraw.
    let dirty = true;
    try {
      const root = await enter(page, id, name, view, true);
      dirty = false;
      // A control can come a moment after its view, as Change Password… waits for the account.
      await page.waitForTimeout(600);
      controls = await controlsOf(root);
    } catch (error) {
      rows.push({
        pane: id,
        paneName: name,
        note,
        tab: view.tab,
        via: pathKey(view),
        path: view.path,
        kind: "view-error",
        error: String(error.message).split("\n")[0],
      });
      continue;
    }
    const shown = new Set(controls.map(baseKey));
    const pending = [];
    for (const control of controls) {
      // A control the parent view shows too (the sidebar list itself) was pressed there.
      if (view.parent?.has(baseKey(control))) continue;
      const k = keyOf(view, control);
      if (done.has(k)) continue;
      done.add(k);
      const row = {
        pane: id,
        paneName: name,
        note,
        tab: view.tab,
        via: pathKey(view) || null,
        path: view.path,
        ...control,
      };
      if (control.disabled) {
        rows.push({ ...row, kind: "disabled", why: await whyDimmed(paneRoot(page, id), control) });
        continue;
      }
      try {
        const result = await pressIn(page, id, name, view, control, dirty);
        dirty = false;
        if (result.kind === "gone" || result.kind === "disabled-now") {
          const now = await settingsOf(page);
          rows.push({
            ...row,
            kind: result.kind,
            after: changedKeys(paneStart.values, now.values),
          });
          dirty = true;
          continue;
        }
        // What the press revealed: controls that were not there (a sidebar item's detail). That view is enumerated in turn,
        // entered by replaying this view's path and then this control. A pop-up's choice is no such view: a replay only
        // opens its list, and what the choice changed (the app a sort order puts first) is the same controls again.
        if (
          control.role !== "combobox" &&
          !["navigates", "unavailable", "dialog"].includes(result.kind)
        ) {
          // Add Login Item… lists the desktop's applications, and sp-served-rows-journey.mjs drives it through a real login.
          const revealed = (await controlsOf(paneRoot(page, id)).catch(() => [])).filter(
            (c) =>
              !shown.has(baseKey(c)) &&
              !(control.name === "Add Login Item…" && c.role === "menuitem"),
          );
          if (revealed.length > 0 && view.depth < 2) {
            if (result.kind === "none" || result.kind === "ui-only") result.kind = "shows";
            result.reveals = revealed.length;
            queue.push({
              tab: view.tab,
              path: [...view.path, control],
              depth: view.depth + 1,
              parent: shown,
            });
          }
        }
        if (result.kind !== "saves" && result.kind !== "unavailable") dirty = true;
        // A radio already chosen changes nothing when pressed: it is pressed again after the others of its view.
        if (result.kind === "none" && control.role === "radio") pending.push(row);
        else rows.push({ ...row, ...result });
      } catch (error) {
        rows.push({ ...row, kind: "error", error: String(error.message).split("\n")[0] });
        dirty = true;
      }
    }
    for (const row of pending) {
      try {
        const result = await pressIn(page, id, name, view, row, dirty);
        dirty = false;
        rows.push({ ...row, ...result, did: `${result.did ?? ""} (after the others)` });
      } catch (error) {
        rows.push({ ...row, kind: "error", error: String(error.message).split("\n")[0] });
        dirty = true;
      }
    }
  }
  // A control an earlier press of the pane took away or disabled: pressed again, in its view, on a fresh account.
  if (fresh) {
    for (const [at, row] of rows.entries()) {
      if (row.kind !== "gone" && row.kind !== "disabled-now" && row.kind !== "error") continue;
      try {
        const other = await fresh();
        await openPane(other, id, name, true);
        const result = await pressIn(other, id, name, { tab: row.tab, path: row.path }, row, true);
        rows[at] = { ...row, ...result, retried: row.kind, after: undefined, error: undefined };
      } catch (error) {
        rows[at] = {
          ...row,
          retried: row.kind,
          kind: "error",
          error: String(error.message).split("\n")[0],
        };
      }
    }
  }
  return { note, rows };
}

/** Presses one row again in its view, on a page of a fresh account; `row` with what followed, or with the error. */
export async function pressRowAgain(page, id, name, row) {
  try {
    await openPane(page, id, name, true);
    const result = await pressIn(page, id, name, { tab: row.tab, path: row.path }, row, true);
    return { ...row, ...result, retried: row.retried ?? row.kind, error: null };
  } catch (error) {
    return { ...row, kind: "error", error: String(error.message).split("\n")[0] };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { base, out, browserName, run } = censusOptions();
  const at = process.argv.indexOf("--panes");
  const only = at > 0 ? new Set(process.argv[at + 1].split(",")) : null;
  const browser = await ENGINES[browserName](false);
  const problems = [];
  let accounts = 0;
  let context = null;
  /** A fresh browser context signed in as a fresh account, System Preferences open: its page. */
  const fresh = async () => {
    await context?.close().catch(() => {});
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
    accounts += 1;
    await createAccount(page, base, person(run, `spd${accounts}`, "Discover"));
    await dockButton(page, "System Preferences").click();
    await frameOf(page)
      .getByRole("group", { name: "All preferences" })
      .waitFor({ timeout: 10_000 });
    return page;
  };
  const rows = [];
  const file = path.join(out, `sp-discovery-${browserName}.json`);
  const save = () => writeFileSync(file, JSON.stringify({ problems, rows }, null, 1));
  for (const [id, name] of SP_PANES) {
    if (only && !only.has(id)) continue;
    // Each pane on an account of its own: a setting saved in one pane never shapes what another shows.
    const result = await discoverPane(await fresh(), id, name, { fresh }).catch((error) => ({
      rows: [
        {
          pane: id,
          paneName: name,
          kind: "pane-error",
          error: String(error.message).split("\n")[0],
        },
      ],
    }));
    rows.push(...result.rows);
    const counts = {};
    for (const r of result.rows) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    console.log(`SP_PANE ${id}: ${JSON.stringify(counts)}`);
    save();
  }
  save();
  console.log(
    `SP_DISCOVERY_DONE ${rows.length} controls, ${problems.length} page problems, ${accounts} accounts`,
  );
  await browser.close();
}
