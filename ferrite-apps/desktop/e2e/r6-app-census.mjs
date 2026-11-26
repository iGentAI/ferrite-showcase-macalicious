// R6's census runner for an app (round 3). An app's suite (e2e/<app>-census-journey.mjs) calls appCensus() with its
// rows (e2e/census/<app>.rows.mjs) and prints one ok/FAIL line per census id:
//
//   - rows with `journey: [[file, /step title/], ...]` pass when those steps of the app's existing journeys printed `ok`
//     (the journeys run first, as child processes, in the same engine against the same server);
//   - the shared menu rows (r6-common commonRows) and each window's chrome rows (chromeRows) are verified by
//     verifyCommon and verifyChrome;
//   - rows with `probe` are driven here with real mouse and keyboard input, each with an asserted outcome:
//       toggle  the control's checked/pressed state flips, and flips back on a second click
//       select  the control becomes selected (aria-selected/checked/current); one selected before the click fails,
//               unless the row says `alreadySelected` (the app's opening state selects it)
//       opens   a menu, popover, dialog, sheet, list or window appears; Escape or its Close button puts it away (for a
//               menu command, the command's own menu staying open is not something appearing)
//       effect  the app visibly changes: an element is added or removed, a text or an aria state changes, or a window
//               opens or closes (a MutationObserver records it; hover and focus styling does not count), more often
//               than in the same time before the action, so a clock or a live feed in the window is not an effect
//       type    typed text shows in the field, and is cleared again
//       choose  a pop-up's list opens and choosing another option changes what the pop-up shows
//       slider  an arrow key on the focused slider changes its value
//       dimmed  the control is disabled and the page shows a reason (title, description or tooltip, or its own text
//               with `selfReason`)
//     A probe may first `reach` a state (clicks or a menu path) and `select` an item, and every probe ends by putting
//     the app back (Escape, new windows closed with their own Close button, the app reopened from the Dock);
//   - rows with `step` are checked by the suite's own `extra` function.
// `--phase write` / `--phase restart-check` run the suite's `persist.write` and `persist.check` around a real restart.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { menuItemReason, reasonOf, shown, verifyChrome, verifyCommon } from "./r6-common.mjs";
import {
  appWindow,
  census,
  loadState,
  menu,
  menuTitle,
  openApp,
  openMenuItem,
  pause,
  peekMenu,
  saveState,
  snapshot,
  within,
} from "./r6-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
/** An error's first line and where it was raised in the e2e files (`at r6-common:667 < r6-app-census:410`). */
const failure = (error) => {
  const sites = [...String(error?.stack ?? "").matchAll(/e2e\/(?:census\/)?([\w.-]+)\.mjs:(\d+)/g)]
    .map((m) => `${m[1]}:${m[2]}`)
    .slice(0, 5);
  return `${String(error?.message ?? error)
    .split("\n")[0]
    .slice(0, 200)}${sites.length ? ` at ${sites.join(" < ")}` : ""}`;
};
const toName = (name) => {
  const pattern = /^\/(.*)\/([a-z]*)$/.exec(name ?? "");
  return pattern ? new RegExp(`^(?:${pattern[1]})$`, pattern[2]) : name;
};

/** Run one existing journey in `engine` against `base`; its ok/FAIL step lines, keyed by title. */
export function runJourney(file, engine, base, timeoutMs = 900_000) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(here, file), "--browser", engine, "--url", base],
      { cwd: path.dirname(here), env: process.env },
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      const steps = [];
      for (const line of out.split("\n")) {
        const m = /^(ok {2}|FAIL) (.*?)(?: \((.*)\))?$/.exec(line);
        if (m) steps.push({ ok: m[1] === "ok  ", title: m[2], detail: m[3] ?? "" });
      }
      resolve({ file, code, steps, tail: out.split("\n").slice(-6).join(" | ") });
    });
  });
}

/**
 * A signature of what floats over the desktop: open menus, dialogs, popovers, lists, and window ids. Tooltips do not
 * count (hovering shows them). Read only.
 */
export const overlays = (page, { menus = true } = {}) =>
  page.evaluate((menus) => {
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
    };
    const floats = [
      ...document.querySelectorAll(
        `${menus ? '[role="menu"],' : ""}[role="dialog"],[role="alertdialog"],[role="listbox"],[data-popover],[role="region"]`,
      ),
    ].filter(visible).length;
    const windows = [...document.querySelectorAll("[data-window-id]")]
      .filter((f) => !f.hasAttribute("data-minimized") && visible(f))
      .map((f) => f.getAttribute("data-window-id"));
    return { floats, windows };
  }, menus);

/**
 * Start counting visible changes to the application's surface: inside window frames ([data-window-id]), or a window
 * frame added or removed. Changes in menus, the menu bar and tooltips (which open and close around any command) do not
 * count, nor do hover and focus styling (class and style are not watched), nor `target`'s own attributes.
 * `stop()` answers how many.
 */
export async function watchChanges(page, target) {
  const handle = await page.evaluateHandle(
    (t) => {
      const state = { n: 0 };
      const watched = new Set([
        "aria-selected",
        "aria-checked",
        "aria-pressed",
        "aria-expanded",
        "aria-label",
        "aria-disabled",
        "aria-current",
        "value",
        "disabled",
        "data-state",
        "data-selected",
        "data-minimized",
        "hidden",
      ]);
      const transient = '[role="menu"],[role="menubar"],[role="menuitem"],[role="tooltip"]';
      const elementOf = (node) => (node.nodeType === 1 ? node : node.parentElement);
      const inApp = (node) => {
        const e = elementOf(node);
        // A window frame, or a dialog or popover the app opened (sheets, panels and inspectors render outside the frame).
        return (
          Boolean(
            e?.closest('[data-window-id],[role="dialog"],[role="alertdialog"],[data-popover]'),
          ) && !e.closest(transient)
        );
      };
      const isFrame = (node) =>
        node.nodeType === 1 &&
        (node.hasAttribute("data-window-id") || Boolean(node.querySelector?.("[data-window-id]")));
      state.observer = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === "childList") {
            const nodes = [...r.addedNodes, ...r.removedNodes];
            if (nodes.some(isFrame)) state.n++;
            else if (
              inApp(r.target) &&
              nodes.some((n) => !(n.nodeType === 1 && n.closest?.(transient)))
            )
              state.n++;
          } else if (r.type === "characterData") {
            if (inApp(r.target)) state.n++;
          } else if (
            r.type === "attributes" &&
            watched.has(r.attributeName) &&
            r.target !== t &&
            inApp(r.target)
          )
            state.n++;
        }
      });
      state.observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
      return state;
    },
    target ? await target.elementHandle().catch(() => null) : null,
  );
  return async () => {
    const n = await handle.evaluate((s) => {
      s.observer.disconnect();
      return s.n;
    });
    await handle.dispose();
    return n;
  };
}

/**
 * Run `act` and count the application's changes, with `noise`: how many it made in the same time just before, with
 * nothing done. `effect` is whether the action changed more than the application changes by itself.
 */
export async function observeEffect(page, target, act, wait = 900, settle = 500) {
  // What the step before the probe set going (a reopened window's reads) ends first, so it is not counted either way.
  await pause(settle);
  const quiet = await watchChanges(page, target);
  await pause(wait);
  const noise = await quiet();
  const stop = await watchChanges(page, target);
  await act();
  await pause(wait);
  const changes = await stop();
  return { changes, noise, effect: changes > noise };
}

/**
 * The verdict on a row mapped to journey steps. `wanted` is `[[file, title], ...]` and `ran` the journeys' results: every
 * title must have printed `ok` in a journey that then exited 0, since one that failed later, was killed or logged a page
 * error did not prove its steps.
 */
export function journeyVerdict(wanted, ran) {
  const found = wanted.map(([file, title]) => {
    const journey = ran.find((r) => r.file === file);
    const hits = (journey?.steps ?? []).filter((s) =>
      title instanceof RegExp ? title.test(s.title) : s.title === title,
    );
    return { file, title: String(title), hits, code: journey?.code };
  });
  return {
    ok: found.every((f) => f.code === 0 && f.hits.length > 0 && f.hits.every((h) => h.ok)),
    detail: found
      .map(
        (f) =>
          `${f.file}: exit ${f.code}; ${f.hits.length ? f.hits.map((h) => `${h.ok ? "ok" : "FAIL"} "${h.title}"`).join(", ") : `no step ${f.title}`}`,
      )
      .join("; ")
      .slice(0, 400),
  };
}

/** Open the menu bar's `trail` down to its last item (hovering submenus); answers that item, its menu left open. */
export async function openTo(page, trail) {
  await menuTitle(page, trail[0]).click({ timeout: 8_000 });
  await page.locator('[role="menu"][data-open]').last().waitFor({ timeout: 5_000 });
  for (const name of trail.slice(1, -1)) {
    const open = await page.locator('[role="menu"][data-open]').count();
    await openMenuItem(page, name).hover();
    await within(
      3_000,
      async () => (await page.locator('[role="menu"][data-open]').count()) > open,
    );
  }
  const item = openMenuItem(page, trail.at(-1));
  await item.waitFor({ timeout: 5_000 });
  return item;
}

const stateOf = (locator) =>
  locator.evaluate((e) => ({
    checked:
      e.getAttribute("aria-checked") ??
      e.getAttribute("aria-pressed") ??
      ("checked" in e ? String(e.checked) : null),
    selected:
      e.getAttribute("aria-selected") === "true" ||
      e.getAttribute("aria-checked") === "true" ||
      e.hasAttribute("data-selected") ||
      ["true", "page", "step", "location", "date"].includes(e.getAttribute("aria-current") ?? ""),
    disabled:
      e.hasAttribute("disabled") ||
      e.getAttribute("aria-disabled") === "true" ||
      e.hasAttribute("data-disabled"),
    // A field's value; a button (a pop-up button among them) shows its value as text, its own .value being empty.
    value:
      "value" in e && typeof e.value === "string" && e.tagName !== "BUTTON"
        ? e.value
        : (e.textContent ?? "").trim(),
    now: e.getAttribute("aria-valuenow"),
  }));

/**
 * Run one app's census. `config`: app, appName, windowName (regex), rows, journeys ([{file, timeout}]), chrome
 * ([{slug, windowName, windowItem, open(page)}]; the main window's chrome is `slug: "main"`), seed(page, ctx),
 * extra(ctx) for `step` rows, persist {write(ctx), check(ctx, state)}, isolation(ctx), prefsWindow, windowItem.
 */
export async function appCensus(config) {
  const { app, appName, windowName, rows } = config;
  const { o, check, allow, run, shot } = census(app, { media: config.media ?? false, rows });
  for (const pattern of config.allow ?? []) allow(pattern);

  // 1. The existing journeys, first, as children (write and all phases only).
  if (o.phase !== "restart-check") {
    const ran = [];
    // R6_SKIP_JOURNEYS=1 skips them while probes are debugged: each skipped journey's row then FAILs, so such a run is
    // never complete evidence.
    const skipJourneys = process.env.R6_SKIP_JOURNEYS === "1";
    if (skipJourneys)
      for (const j of config.journeys ?? []) {
        const own = `${app}.journey.${j.file.replace(/(-journey)?\.mjs$/, "")}`;
        check(own, false, "skipped (R6_SKIP_JOURNEYS=1): not evidence");
      }
    for (const j of skipJourneys ? [] : (config.journeys ?? [])) {
      const result = await runJourney(
        j.file,
        o.browserName,
        j.clock && o.clockUrl ? o.clockUrl : o.base,
        j.timeout,
      );
      ran.push(result);
      console.log(
        `info journey ${j.file}: exit ${result.code}, ${result.steps.filter((s) => s.ok).length} ok, ${result.steps.filter((s) => !s.ok).length} FAIL`,
      );
      const own = rows.find(
        (r) => r.id === `${app}.journey.${j.file.replace(/(-journey)?\.mjs$/, "")}`,
      );
      if (own)
        check(
          own.id,
          result.code === 0,
          result.code === 0
            ? `${result.steps.length} steps passed, no console errors`
            : result.tail.slice(0, 300),
        );
    }
    for (const row of rows.filter((r) => r.journey)) {
      const wanted = Array.isArray(row.journey[0]) ? row.journey : [row.journey];
      const verdict = journeyVerdict(wanted, ran);
      check(row.id, verdict.ok, verdict.detail);
    }
  }

  await run(async (ctx) => {
    const { person } = ctx;
    const open = async (page) => {
      await openApp(page, appName, windowName);
      await appWindow(page, windowName).waitFor({ timeout: 15_000 });
    };
    if (o.phase === "restart-check") {
      const state = loadState(o, app);
      if (!state) return check(`${app}.restart.state`, false, "no state file from a write phase");
      const page = await person("owner", { existing: state.account });
      await open(page);
      await config.persist.check({ ...ctx, page, open, o }, state);
      return;
    }
    const page = await person("owner");
    const helpers = { ...ctx, page, open, o, rows };
    if (config.seed) await config.seed(helpers);
    await open(page);
    await snapshot(page, o, app, "main window");
    const baseIds = (await overlays(page)).windows;

    /** Whether what the probe opened, against `before`, goes away with Escape or the new window's own Close button. */
    const putsAway = async (before) => {
      const gone = async () => {
        const now = await overlays(page);
        return now.floats <= before.floats && now.windows.every((w) => before.windows.includes(w));
      };
      await page.keyboard.press("Escape");
      if ((await within(1_500, gone)) !== null) return "Escape";
      for (const id of (await overlays(page)).windows) {
        if (before.windows.includes(id)) continue;
        await page
          .locator(`[data-window-id="${id}"]`)
          .getByRole("group", { name: "Window controls" })
          .first()
          .getByRole("button", { name: "Close" })
          .click({ timeout: 3_000 })
          .catch(() => {});
      }
      if ((await within(1_500, gone)) !== null) return "Close";
      const close = page
        .locator('[role="dialog"],[role="alertdialog"],[data-popover]')
        .filter({ visible: true })
        .getByRole("button", { name: /^(Close|Cancel|Done|OK)$/ })
        .first();
      if (await close.isVisible().catch(() => false)) {
        await close.click({ timeout: 3_000 }).catch(() => {});
        if ((await within(1_500, gone)) !== null) return "its button";
      }
      return null;
    };

    // A pop-up button's list renders outside the window and does not always close on Escape; left open, it takes every
    // later click. It is closed by choosing the option it shows already (nothing changes), or its first.
    const closeFloating = async () => {
      for (const list of await page.locator('[role="listbox"]').filter({ visible: true }).all()) {
        const floating = await list
          .evaluate((e) => !e.closest("[data-window-id]"))
          .catch(() => false);
        if (!floating) continue;
        const chosen = list.locator('[role="option"][aria-selected="true"]').first();
        const target = (await chosen.count()) ? chosen : list.locator('[role="option"]').first();
        await target.click({ timeout: 2_000 }).catch(() => {});
        await pause(200);
      }
    };

    const reset = async () => {
      for (let i = 0; i < 3; i++) await page.keyboard.press("Escape").catch(() => {});
      await pause(150);
      await closeFloating();
      for (const id of (await overlays(page)).windows) {
        if (baseIds.includes(id)) continue;
        const close = page
          .locator(`[data-window-id="${id}"]`)
          .getByRole("group", { name: "Window controls" })
          .first()
          .getByRole("button", { name: "Close" });
        await close.click({ timeout: 3_000 }).catch(() => {});
        await pause(200);
        for (const label of [/^(Delete|Don.t Save|Discard)/, /^Cancel$/]) {
          const b = page.getByRole("button", { name: label }).first();
          if (await b.isVisible().catch(() => false)) {
            await b.click({ timeout: 2_000 }).catch(() => {});
            break;
          }
        }
      }
      // Each probe starts from the app's opening state: the app is quit from its own menu and opened again from the
      // Dock (what is stored on the server stays; a selection, a draft or an open sheet does not).
      if (config.quitBetweenProbes !== false && (await shown(page, windowName))) {
        await menu(page, appName, `Quit ${appName}`).catch(() => {});
        await within(5_000, async () => !(await shown(page, windowName)));
      }
      if (!(await shown(page, windowName))) {
        await open(page).catch(() => {});
        // A reopened window reads what it keeps (Calendar's view) and applies it: a click before that is undone.
        await pause(800);
      }
    };

    const locate = (row, p) => {
      const name = toName(p.label ?? row.name);
      const scope =
        p.scope === "page" ? page : appWindow(page, p.window ? toName(p.window) : windowName);
      return scope
        .getByRole(p.role ?? row.role, typeof name === "string" ? { name, exact: true } : { name })
        .nth(p.nth ?? 0);
    };

    const doReach = async (steps = []) => {
      for (const s of steps) {
        if (s.menu) {
          // An item dimmed while the app loads what it acts on (a window just reopened) is given a moment.
          let state = await menu(page, ...s.menu);
          for (let tries = 0; state.disabled && tries < 5; tries += 1) {
            await pause(800);
            state = await menu(page, ...s.menu);
          }
          if (state.disabled)
            throw new Error(`cannot reach the state: ${s.menu.join(" > ")} is dimmed`);
        } else if (s.key) await page.keyboard.press(s.key);
        else if (s.ifEnabled)
          await locate({ name: s.name, role: s.role }, { ...s })
            .click({ timeout: 1_500 })
            .catch(() => {});
        else await locate({ name: s.name, role: s.role }, { ...s }).click({ timeout: 8_000 });
        await pause(s.wait ?? 400);
      }
    };

    // 2. Generic probes, in row order.
    for (const row of rows.filter((r) => r.probe)) {
      const p = row.probe;
      try {
        await doReach(p.reach);
        if (p.select) await doReach([p.select]);
        if (p.where === "menu") {
          const trail = [...p.menu, p.label ?? row.name];
          if (p.kind === "dimmed") {
            const state = await menuItemReason(page, ...trail);
            const reason = p.selfReason ? state.text : state.reason;
            // A row counts only on the first click on its menu title: a retried click fails it.
            check(
              row.id,
              !state.missing && state.disabled && Boolean(reason) && !state.retried,
              `${
                state.missing
                  ? "missing"
                  : `disabled=${state.disabled} reason=${JSON.stringify(reason)}`
              }${state.retried ? `; the first click on ${trail[0]} opened no menu, the second did` : ""}`,
            );
          } else if (p.kind === "toggle") {
            const before = await peekMenu(page, ...trail);
            await menu(page, ...trail);
            await pause(400);
            const after = await peekMenu(page, ...trail);
            await menu(page, ...trail);
            await pause(300);
            const back = await peekMenu(page, ...trail);
            check(
              row.id,
              before.checked !== after.checked && back.checked === before.checked,
              `checked ${before.checked} -> ${after.checked} -> ${back.checked}`,
            );
          } else {
            // The menu is opened down to the item first; only then does observation start, so opening and closing
            // the menu itself never counts as the command's effect.
            const before = await overlays(page, { menus: false });
            let item = await openTo(page, trail);
            const dimmedNow = () =>
              item.evaluate(
                (e) =>
                  e.hasAttribute("data-disabled") || e.getAttribute("aria-disabled") === "true",
              );
            let disabled = await dimmedNow();
            // A command dimmed while the app loads what it acts on (a window just reopened) is given a moment.
            for (let tries = 0; disabled && tries < 5; tries += 1) {
              for (let level = 0; level < trail.length; level += 1)
                await page.keyboard.press("Escape");
              await pause(800);
              item = await openTo(page, trail);
              disabled = await dimmedNow();
            }
            let seen = { changes: 0, noise: 0, effect: false };
            if (disabled) await page.keyboard.press("Escape");
            else seen = await observeEffect(page, null, () => item.click(), p.wait ?? 900);
            const after = await overlays(page, { menus: false });
            const opened =
              after.floats > before.floats ||
              after.windows.length !== before.windows.length ||
              after.windows.some((w) => !before.windows.includes(w));
            const away = p.kind === "opens" && opened ? await putsAway(before) : null;
            const ok =
              !disabled && (p.kind === "opens" ? opened && away !== null : opened || seen.effect);
            check(
              row.id,
              ok,
              `disabled=${disabled} opened=${opened} changes=${seen.changes} noise=${seen.noise}${p.kind === "opens" ? ` put away by ${away}` : ""}`,
            );
          }
        } else {
          const control = locate(row, p);
          await control.waitFor({ state: "visible", timeout: 8_000 });
          if (p.kind === "shows") {
            // Something a person reads rather than operates (a header row): it shows, named as listed.
            check(row.id, true, "shown, named as listed");
          } else if (p.kind === "dimmed") {
            // A card or list can render once more after it shows (Contacts' buttons under the name): wait for the dimmed
            // state before reading it, then read the reason.
            await within(3_000, async () => (await stateOf(control)).disabled);
            const s = await stateOf(control);
            const reason = p.selfReason ? s.value : await reasonOf(page, control);
            check(
              row.id,
              s.disabled && Boolean(reason),
              `disabled=${s.disabled} reason=${JSON.stringify(reason)}`,
            );
          } else if (p.kind === "toggle") {
            const before = (await stateOf(control)).checked;
            await control.click();
            const flipped = await within(
              3_000,
              async () => (await stateOf(control)).checked !== before,
            );
            await control.click();
            const back = await within(
              3_000,
              async () => (await stateOf(control)).checked === before,
            );
            check(
              row.id,
              flipped !== null && back !== null,
              `${before} -> flipped ${flipped} ms -> back ${back} ms`,
            );
          } else if (p.kind === "select") {
            const was = (await stateOf(control)).selected;
            await control.click();
            const sel = await within(3_000, async () => (await stateOf(control)).selected);
            check(
              row.id,
              sel !== null && (!was || p.alreadySelected),
              was ? `selected before the click, in ${sel} ms after` : `selected in ${sel} ms`,
            );
          } else if (p.kind === "type") {
            const text = p.text ?? "r6 census";
            await control.click();
            await page.keyboard.press("ControlOrMeta+a");
            await page.keyboard.type(text, { delay: 15 });
            const shows = await within(3_000, async () =>
              (await stateOf(control)).value.includes(text),
            );
            if (!p.keep) {
              await page.keyboard.press("ControlOrMeta+a");
              await page.keyboard.press("Backspace");
            }
            check(row.id, shows !== null, `typed "${text}" shows in ${shows} ms`);
          } else if (p.kind === "choose") {
            const before = (await stateOf(control)).value;
            const lists = page.locator('[role="listbox"]').filter({ visible: true });
            const listsBefore = await lists.count();
            await control.click();
            await within(4_000, async () => (await lists.count()) > listsBefore);
            // Only the list the pop-up opened (the last one): a window's own list (Contacts' names) has options too.
            const options = lists.last().getByRole("option").filter({ visible: true });
            await options.first().waitFor({ timeout: 4_000 });
            const texts = await options.allInnerTexts();
            const pick = texts.findIndex((t) => t.trim() && t.trim() !== before);
            if (pick >= 0) await options.nth(pick).click();
            else await closeFloating();
            const changed = await within(
              3_000,
              async () => (await stateOf(control)).value !== before,
            );
            check(
              row.id,
              pick >= 0 && changed !== null,
              `${JSON.stringify(before)} -> ${JSON.stringify((await stateOf(control)).value)} of ${texts.length} options`,
            );
          } else if (p.kind === "slider") {
            const before = (await stateOf(control)).now;
            await control.click();
            await page.keyboard.press(p.key ?? "ArrowRight");
            const moved = await within(3_000, async () => (await stateOf(control)).now !== before);
            check(row.id, moved !== null, `value ${before} -> ${(await stateOf(control)).now}`);
          } else if (p.kind === "items") {
            // A container (list, tree, grid, tab list): it shows items, and a click on the first unselected one selects
            // it (one item, selected already, proves nothing unless the row says `alreadySelected`).
            const items = control
              .locator(
                '[role="option"],[role="treeitem"],[role="row"],[role="gridcell"],[role="tab"],[role="radio"]',
              )
              .filter({ visible: true });
            const count = await items.count();
            let at = 0;
            while (at < count && (await stateOf(items.nth(at))).selected) at += 1;
            const fresh = at < count;
            const first = items.nth(fresh ? at : 0);
            if (count) await first.click();
            const selected = count
              ? await within(3_000, async () => (await stateOf(first)).selected)
              : null;
            check(
              row.id,
              count > 0 && selected !== null && (fresh || p.alreadySelected),
              `${count} items; item ${at + 1}${fresh ? "" : ", selected before the click,"} selected in ${selected} ms`,
            );
          } else {
            const before = await overlays(page);
            const seen = await observeEffect(
              page,
              control,
              () => (p.double ? control.dblclick() : control.click()),
              p.wait ?? 900,
              p.settle,
            );
            const after = await overlays(page);
            const opened =
              after.floats > before.floats ||
              after.windows.some((w) => !before.windows.includes(w));
            const away = p.kind === "opens" && opened ? await putsAway(before) : null;
            const ok =
              p.kind === "opens"
                ? opened && away !== null
                : opened || seen.effect || after.windows.length !== before.windows.length;
            check(
              row.id,
              ok,
              `opened=${opened} changes=${seen.changes} noise=${seen.noise}${p.kind === "opens" ? ` put away by ${away}` : ""}`,
            );
          }
        }
      } catch (error) {
        check(row.id, false, failure(error));
        await shot(page, `probe-${row.id}`);
      }
      // A probe whose command leaves a lasting state (a hidden sidebar the app keeps) undoes it with `after` steps.
      if (p.after) await doReach(p.after).catch(() => {});
      if (!p.keepState) await reset();
    }

    // 3. The suite's own steps.
    if (config.extra) {
      try {
        await config.extra(helpers);
      } catch (error) {
        check(`${app}.section.extra`, false, failure(error));
        await shot(page, "section-extra");
      }
      await reset();
    }

    // 4. The shared menus and shortcuts, then each window's chrome.
    try {
      await verifyCommon(page, {
        app,
        appName,
        windowName,
        windowItem: config.windowItem ?? appName,
        check,
        rows,
        prefsWindow: config.prefsWindow ?? null,
        reopen: () => open(page),
      });
    } catch (error) {
      check(`${app}.section.common`, false, failure(error));
      await reset();
    }
    for (const w of config.chrome ?? [{ slug: "main", windowName }]) {
      try {
        await reset();
        if (w.open) await w.open(helpers);
        await verifyChrome(page, {
          app,
          slug: w.slug,
          windowName: w.windowName,
          windowItem: w.windowItem ?? appName,
          check,
          reopen: async () => (w.open ? w.open(helpers) : open(page)),
          resizable: w.resizable ?? true,
          fullScreen: w.fullScreen ?? true,
          minimize: w.minimize ?? true,
        });
      } catch (error) {
        check(`${app}.section.chrome-${w.slug}`, false, failure(error));
      }
    }

    // 5. Isolation and the restart write.
    if (config.isolation) {
      try {
        await config.isolation(helpers);
      } catch (error) {
        check(`${app}.section.isolation`, false, failure(error));
      }
    }
    if (config.persist && o.phase === "write") {
      const state = await config.persist.write(helpers);
      saveState(o, app, { account: page.account, ...state });
    }
  });
}

/** Helpers for rows modules. */
export const row =
  (app) =>
  (id, window, role, name, how, expected, extra = {}) => ({
    id: `${app}.${id}`,
    window,
    role,
    name,
    how,
    expected,
    ...extra,
  });
