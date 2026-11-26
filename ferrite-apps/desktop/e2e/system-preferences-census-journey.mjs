#!/usr/bin/env node
// System Preferences' census (app `system-preferences`), on a served desktop with real input, accounts made at the login
// window.
//
// Part 1: the buttons whose sheet or dialog no reference screenshot shows say so in a popover ("Not part of this demo")
// instead of taking the click and doing nothing (seven answered nothing: R2 bundle 05).
//
// Part 2: every control of every pane, in each tab and in the views its presses reveal, as R2's per-pane discovery found
// it (system-preferences-census-rows.json). Each pane is gone through
// on an account of its own, every control pressed once with the mouse or the keyboard (r2-sp-discover.mjs's discoverPane:
// a pop-up's other choice, a slider's track, typing in a field), and what each press did is compared with the row's
// expected outcome: the setting keys saved on the server, the desktop changed, the "Not part of this demo" popover,
// another pane, a revealed view, the control's own state, nothing (an item that only informs), or the control dimmed.
// Per pane: the settings its controls saved read back the same after a reload and, in `--phase restart-check`, after a
// real restart of `ferrite dev`, signed in again as the same account; a second account sees none of them; and the pane's
// effects note ("kept for your account, but change nothing on this desktop", or the settings that take effect) is true to
// what the presses did.
//
//   node e2e/system-preferences-census-journey.mjs --url http://127.0.0.1:8080 --browser chromium|chrome|firefox|webkit
//        [--phase write|restart-check|all] [--run <id>] [--panes general,dock] [--out dir]
//
// system-preferences-census-regenerate.mjs rebuilds the rows from what the panes do now.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  api,
  census,
  createAccount,
  dockButton,
  person,
  signInOther,
  slug,
} from "./r2-census-kit.mjs";
import {
  closeOverlays,
  discoverPane,
  SP_PANES as EVERY_PANE,
  isAmbientKey,
  openPane,
} from "./r2-sp-discover.mjs";

const V = "system-preferences-census-journey.mjs";
/** `--panes a,b`: only these panes' rows, as a whole run takes longer than one sitting. Part 1 is left out, and a run says so. */
const panesAt = process.argv.indexOf("--panes");
const ONLY = panesAt > 0 ? new Set(process.argv[panesAt + 1].split(",")) : null;
if (ONLY !== null) {
  if (process.argv.includes("--part1")) {
    console.error("--part1 and --panes do not go together: --panes leaves Part 1 out");
    process.exit(2);
  }
  console.log("--panes: Part 1 (the buttons with no captured sheet) is left out of this run");
}
/** Panes whose served page (demos/system-preferences/served-pages.tsx) replaces the controls the rows were discovered from. */
const SERVED_PAGES = new Set([
  "apple-id",
  "bluetooth",
  "date-and-time",
  "displays",
  "energy-saver",
  "family-sharing",
  "internet-accounts",
  "network",
  "printers-and-scanners",
  "screen-time",
  "sharing",
  "software-update",
  "startup-disk",
  "time-machine",
  "touch-id",
  "users-and-groups",
  "wallet-and-apple-pay",
]);
const SP_PANES = EVERY_PANE.filter(
  ([pane]) => !SERVED_PAGES.has(pane) && (ONLY === null || ONLY.has(pane)),
);
const SETTINGS = "/api/system-preferences/settings";

// Part 1. [pane id, pane name, tab or null, the button's accessible name, the reason it gives when it is not the missing
// screenshot].
const UNCAPTURED = [];
const uncapturedId = (pane, button) => `system-preferences.${pane}.${slug(button)}.uncaptured`;
const part1 = [
  ...UNCAPTURED.map(([pane, paneName, tab, button, reason]) => ({
    id: uncapturedId(pane, button),
    app: "system-preferences",
    window_or_state: `pane:${paneName}${tab ? ` > tab:${tab}` : ""}`,
    role: "button",
    name: button,
    how_reached: `System Preferences > ${paneName}${tab ? ` > ${tab}` : ""}, the button clicked with the mouse`,
    expected_outcome: `unavailable:Not part of this demo (a popover on the button: ${reason ?? `No reference screenshot shows what “${button}” opens`})`,
    verified_by: `${V} ${uncapturedId(pane, button)}`,
    persists: "none",
    notes: "",
  })),
];

// Part 2.
const DATA = JSON.parse(
  readFileSync(new URL("./system-preferences-census-rows.json", import.meta.url), "utf8"),
);
DATA.rows = DATA.rows.filter(
  (r) => !SERVED_PAGES.has(r.pane) && (ONLY === null || ONLY.has(r.pane)),
);
const LIST_ITEMS = new Set(["row", "gridcell", "option", "treeitem"]);
/** The lock of a locked pane ("Click the lock to make changes."): what a person reads as the reason its settings are dimmed. */
const lockOf = (pane) =>
  DATA.rows.find((r) => r.pane === pane && /^Click the lock to make changes/.test(r.name))?.name;
const reasonOf = (r) =>
  r.why || lockOf(r.pane) || "dimmed in the pane, as in the reference screenshots";

function expectedOf(r) {
  switch (r.kind) {
    case "saves":
      return `saves ${r.keys.join(", ") || "the theme"} for the account; nothing on the desktop changes (as the pane's note says)`;
    case "takes-effect":
      return `saves ${r.keys.join(", ") || "the theme"} for the account and the desktop changes (${r.shell.join(", ")})`;
    case "unavailable":
      return "unavailable:Not part of this demo";
    case "navigates":
      return `System Preferences shows the ${r.navigates} pane`;
    case "shows":
      return `shows its detail: ${r.reveals} more control(s), verified in their own rows`;
    case "ui-only":
      return "changes its own state; no setting is saved";
    case "dialog":
      return "opens a dialog";
    case "none":
      return LIST_ITEMS.has(r.role)
        ? "an item that only informs: a press changes nothing and opens nothing"
        : r.role === "combobox"
          ? "its menu offers no other choice"
          : "a press changes nothing";
    case "disabled":
      return `unavailable:${reasonOf(r)}`;
    default:
      return `not determined: discovery could not press it (${r.kind}${r.error ? `: ${r.error}` : ""})`;
  }
}

const place = (r) =>
  `pane:${r.paneName}${r.tab ? ` > tab:${r.tab}` : ""}${r.path.length ? ` > ${r.path.map((p) => p.name || p.role).join(" > ")}` : ""}`;
const part2 = DATA.rows.map((r) => ({
  id: r.id,
  app: "system-preferences",
  window_or_state: place(r),
  role: r.role,
  name: r.name,
  how_reached: `System Preferences > ${place(r)
    .replace(/^pane:/, "")
    .replace(
      / > tab:/,
      " > ",
    )}, on an account of its own; pressed once (a pop-up: another choice; a slider: its track; a field: typed)`,
  expected_outcome: expectedOf(r),
  verified_by: `${V} ${r.id}`,
  persists: r.kind === "saves" || r.kind === "takes-effect" ? "restart" : "none",
  notes: r.retried
    ? `pressed on a fresh account: an earlier press of the pane had left it ${r.retried}`
    : "",
}));

/** The settings a note says take effect on this desktop, by pane: a key that takes effect must be one of them. */
const NOTE_EFFECTS = {
  general:
    /appearance|accent|highlight|recent|hideMenuBar|scrollBars|fontSmoothing|sidebarIconSize/i,
  "desktop-and-screen-saver":
    /^desktop-and-screen-saver\.(picture|mode|changePicture|interval|randomOrder|saverAfter|saverClock)$|^desktop\.spacePictures$/,
  accessibility:
    /^accessibility\.(invert|grayscale|increaseContrast|reduceMotion|reduceTransparency|flashScreen|speakSelection|voice|speakingRate|zoomKeys|zoomScroll|zoomLevel|captionStyle|showStatusInMenuBar)$/,
  dock: /size|magnif|position|hide|minimizeEffect|indicators|autohide/i,
  siri: /siri\.(askSiri|showInMenuBar)/,
};
const saving = new Set(
  DATA.rows.filter((r) => r.kind === "saves" || r.kind === "takes-effect").map((r) => r.pane),
);
const paneRows = [];
for (const [pane, paneName] of SP_PANES) {
  const base = { app: "system-preferences", window_or_state: `pane:${paneName}`, notes: "" };
  if (saving.has(pane)) {
    paneRows.push({
      ...base,
      id: `system-preferences.${pane}.settings-kept`,
      role: "settings",
      name: `${paneName}'s settings`,
      how_reached: "every setting the pane's controls saved, read back from the server",
      expected_outcome:
        "the same after a reload, and after a real restart of ferrite dev signed in again as the same account",
      verified_by: `${V} ${pane}.settings-kept`,
      persists: "restart",
      phase: "both",
    });
    paneRows.push({
      ...base,
      id: `system-preferences.${pane}.settings-isolated`,
      role: "settings",
      name: `${paneName}'s settings`,
      how_reached: "a second account made at the login window reads its settings",
      expected_outcome: "none of the first account's changed settings shows for the second account",
      verified_by: `${V} ${pane}.settings-isolated`,
      persists: "none",
    });
  }
  const note = DATA.notes[pane];
  if (note)
    paneRows.push({
      ...base,
      id: `system-preferences.${pane}.note`,
      role: "note",
      name: note,
      how_reached: "the pane's effects note, under its controls",
      expected_outcome: NOTE_EFFECTS[pane]
        ? "true: the settings that change the desktop are the ones it names, and they do"
        : "true: no control of the pane changes the desktop",
      verified_by: `${V} ${pane}.note`,
      persists: "none",
    });
}

const rows = process.argv.includes("--part1")
  ? part1
  : [...(ONLY === null ? part1 : []), ...part2, ...paneRows];

const sameSet = (a, b) =>
  JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
const viewKey = (r) =>
  `${r.tab ?? ""}|${(r.path ?? []).map((p) => `${p.role}|${p.name}|${p.index}`).join(" > ")}|${r.role}|${r.name}|${r.index}`;
/** The account's settings on the server: its values, and the theme under one more key. */
async function settingsOf(page) {
  const reply = await api(page, "GET", SETTINGS);
  const values = Object.fromEntries(
    Object.entries(reply.json?.values ?? {}).filter(([key]) => !isAmbientKey(key)),
  );
  return { ...values, "(theme)": reply.json?.theme ?? null };
}
const changed = (before, after) =>
  Object.fromEntries(
    [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => [k, after[k] ?? null]),
  );
/**
 * An account's settings once the desktop has written what opening System Preferences writes for every account (the
 * theme): two reads in a row the same, up to 5 s. Read before that, those writes would count as the pane's, and a second
 * account, which has the same, as seeing them.
 */
async function settledSettingsOf(page) {
  let last = await settingsOf(page);
  for (let i = 0; i < 10; i += 1) {
    await page.waitForTimeout(500);
    const now = await settingsOf(page);
    if (JSON.stringify(now) === JSON.stringify(last)) return now;
    last = now;
  }
  return last;
}

await census("system-preferences", rows, async (kit) => {
  const { base, run, phase, newPage, check, skip, out, browserName } = kit;
  const keptFile = path.join(out, `system-preferences-kept-${browserName}-${run}.json`);
  const openPrefs = async (page) => {
    await dockButton(page, "System Preferences").click();
    const prefs = page.locator('.mac-managed-window[data-window-id="system-preferences"]');
    // The window opens on the pane last shown: Show All is the way to the grid from anywhere.
    await prefs.locator(".mac-system-preferences-body:not([inert])").waitFor({ timeout: 10_000 });
    await prefs.getByRole("button", { name: "Show All" }).click();
    await prefs.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 10_000 });
  };
  let accounts = 0;
  /**
   * A browser of its own, signed in as a fresh account made at the login window (named after the run and `role`; its
   * password is derived from them, never written down), System Preferences open.
   */
  const freshAccount = async (label, role = null) => {
    accounts += 1;
    const named = role ?? `sp${accounts}`;
    const page = await newPage(label);
    await createAccount(page, base, person(run, named, "Prefs Census"));
    await openPrefs(page);
    return { page, role: named };
  };
  const paneRole = (pane) => `sp-${pane.slice(0, 18)}`;

  if (phase !== "restart-check") {
    // Part 1.
    if (ONLY === null) {
      const { page } = await freshAccount("system-preferences");
      for (const [pane, paneName, tab, button, reason] of UNCAPTURED) {
        const id = uncapturedId(pane, button);
        let shown = "";
        try {
          await closeOverlays(page);
          const root = await openPane(page, pane, paneName, true);
          if (tab) {
            await root.getByRole("tab", { name: tab, exact: true }).click();
            await page.waitForTimeout(250);
          }
          await root.getByRole("button", { name: button, exact: true }).first().click();
          const popover = page
            .getByRole("dialog")
            .filter({ hasText: "Not part of this demo" })
            .last();
          await popover.waitFor({ timeout: 4_000 });
          shown = ((await popover.textContent()) ?? "").replace(/\s+/g, " ").trim();
        } catch (error) {
          shown = `no popover (${String(error.message).split("\n")[0]})`;
        }
        skip(
          id,
          "unavailable:Not part of this demo",
          shown.includes("Not part of this demo") &&
            shown.includes(reason ?? `what “${button}” opens`),
        );
        if (!shown.includes("Not part of this demo")) console.log(`  ${id}: ${shown}`);
      }
      await closeOverlays(page);
      await page.context().close();
    }

    // Part 2, pane by pane, each on an account of its own (not with --part1).
    const kept = {};
    for (const [pane, paneName] of process.argv.includes("--part1") ? [] : SP_PANES) {
      const expected = DATA.rows.filter((r) => r.pane === pane);
      if (expected.length === 0) continue;
      // The accounts the pane's controls are pressed on: its own, then one more for each control an earlier press took away
      // or disabled. Each is finished as soon as discovery is done with it (what it saved read back, the page reloaded and
      // read again) and its browser context closed: a second press's account when the next one opens, the pane's own at
      // the end. At most two are open at once; holding every one to the pane's end held a desktop page per account.
      const savedBy = [];
      let allSame = true;
      let own = null;
      let retry = null;
      /** Finishes one account: what its controls saved, the same after a reload; then its browser is closed. */
      const finish = async (account) => {
        if (!account) return;
        try {
          if (!saving.has(pane)) return;
          const saved = changed(account.before, await settingsOf(account.page));
          if (Object.keys(saved).length === 0) return;
          await account.page.reload({ waitUntil: "load" });
          await account.page
            .getByRole("button", { name: /^Finder$/ })
            .first()
            .waitFor({ timeout: 20_000 });
          const reloaded = await settingsOf(account.page);
          allSame &&= Object.keys(saved).every(
            (k) => JSON.stringify(reloaded[k] ?? null) === JSON.stringify(saved[k]),
          );
          savedBy.push({ role: account.role, saved });
        } finally {
          await account.page
            .context()
            .close()
            .catch(() => {});
        }
      };
      try {
        const first = await freshAccount(`sp-${pane}`, paneRole(pane));
        own = { ...first, before: await settledSettingsOf(first.page) };
        const page = first.page;
        const { note: shownNote, rows: seen } = await discoverPane(page, pane, paneName, {
          fresh: async () => {
            const done = retry;
            retry = null;
            await finish(done);
            const other = await freshAccount(`sp-${pane}-again`);
            retry = { ...other, before: await settledSettingsOf(other.page) };
            return other.page;
          },
        });
        const byView = new Map(seen.filter((s) => s.role).map((s) => [viewKey(s), s]));
        for (const r of expected) {
          const s = byView.get(viewKey(r));
          if (!s) {
            check(r.id, false, "not found in its view");
            continue;
          }
          const did = `${s.kind}${s.keys?.length ? ` ${s.keys.join(",")}` : ""}${s.error ? ` (${s.error})` : ""}`;
          switch (r.kind) {
            case "unavailable":
              skip(r.id, "unavailable:Not part of this demo", s.kind === "unavailable");
              break;
            case "disabled":
              skip(
                r.id,
                `unavailable:${reasonOf(r)}`,
                s.kind === "disabled" && (r.why == null || (s.why ?? "") === r.why),
              );
              break;
            case "saves":
            case "takes-effect":
              check(r.id, s.kind === r.kind && sameSet(s.keys, r.keys), did);
              break;
            case "navigates":
              check(
                r.id,
                s.kind === "navigates" && s.navigates === r.navigates,
                `${did} ${s.navigates ?? ""}`,
              );
              break;
            case "shows":
              check(r.id, (s.reveals ?? 0) > 0, `${did}, ${s.reveals ?? 0} revealed`);
              break;
            case "none":
            case "ui-only":
            case "dialog":
              check(r.id, s.kind === r.kind, did);
              break;
            default:
              check(r.id, false, `not determined in discovery (${r.kind}); this run: ${did}`);
          }
        }
        // What the pane saved, on each account it was pressed on: the same after a reload, read back from the server.
        {
          const done = [retry, own];
          retry = null;
          own = null;
          // Each is finished, and so closed, even when an earlier one's reload check throws; the first failure then stops the
          // pane as before.
          let failure = null;
          for (const account of done)
            await finish(account).catch((error) => {
              failure ??= error;
            });
          if (failure) throw failure;
        }
        if (saving.has(pane)) {
          const count = savedBy.reduce((sum, { saved }) => sum + Object.keys(saved).length, 0);
          check(
            `system-preferences.${pane}.settings-kept`,
            count > 0 && allSame,
            `${count} setting(s) on ${savedBy.length} account(s) after a reload`,
          );
          kept[pane] = savedBy;
        }
        // The note the pane renders: as expected, and true to what the presses did.
        if (DATA.notes[pane]) {
          const effects = seen.filter((s) => s.kind === "takes-effect");
          const named = NOTE_EFFECTS[pane];
          const keys = effects.flatMap((s) => (s.keys?.length ? s.keys : ["(theme)"]));
          const shown = shownNote === DATA.notes[pane];
          check(
            `system-preferences.${pane}.note`,
            shown &&
              (named
                ? effects.length > 0 && keys.every((k) => named.test(k) || k === "(theme)")
                : effects.length === 0),
            `${shown ? "the note as expected" : `the pane shows "${shownNote}"`}; ${effects.length} control(s) changed the desktop${keys.length ? `: ${[...new Set(keys)].join(", ")}` : ""}`,
          );
        }
      } catch (error) {
        kit.problems.push(
          `pane ${pane} stopped: ${String(error?.message ?? error).split("\n")[0]}`,
        );
      } finally {
        // A pane that stopped part way: its accounts' browsers are closed all the same.
        for (const account of [retry, own])
          await account?.page
            .context()
            .close()
            .catch(() => {});
      }
    }
    // A second account sees none of it, the theme included.
    if (Object.keys(kept).length > 0) {
      const { page: other } = await freshAccount("sp-second-account");
      const theirs = await settledSettingsOf(other);
      for (const [pane, savedBy] of Object.entries(kept)) {
        const seenThere = savedBy.flatMap(({ saved }) =>
          Object.keys(saved).filter(
            (k) =>
              saved[k] !== null && JSON.stringify(theirs[k] ?? null) === JSON.stringify(saved[k]),
          ),
        );
        const total = savedBy.reduce((sum, { saved }) => sum + Object.keys(saved).length, 0);
        check(
          `system-preferences.${pane}.settings-isolated`,
          seenThere.length === 0,
          seenThere.length
            ? `the second account has ${seenThere.join(", ")}`
            : `${total} setting(s) not seen`,
        );
      }
      await other.context().close();
    }
    writeFileSync(keptFile, JSON.stringify(kept, null, 1));
  }

  // After a real restart of ferrite dev: every account a pane saved settings on signs in again and finds them.
  if (phase === "restart-check") {
    const kept = JSON.parse(readFileSync(keptFile, "utf8"));
    for (const [pane, savedBy] of Object.entries(kept)) {
      const differ = [];
      let count = 0;
      try {
        for (const { role, saved } of savedBy) {
          const page = await newPage(`sp-${pane}-after-restart`);
          try {
            await signInOther(page, base, person(run, role, "Prefs Census"));
            const now = await settingsOf(page);
            differ.push(
              ...Object.keys(saved).filter(
                (k) => JSON.stringify(now[k] ?? null) !== JSON.stringify(saved[k]),
              ),
            );
            count += Object.keys(saved).length;
          } finally {
            await page
              .context()
              .close()
              .catch(() => {});
          }
        }
        check(
          `system-preferences.${pane}.settings-kept`,
          count > 0 && differ.length === 0,
          differ.length
            ? `differ: ${differ.join(", ")}`
            : `${count} setting(s) on ${savedBy.length} account(s) after the restart`,
        );
      } catch (error) {
        check(
          `system-preferences.${pane}.settings-kept`,
          false,
          String(error.message).split("\n")[0],
        );
      }
    }
  }
});
