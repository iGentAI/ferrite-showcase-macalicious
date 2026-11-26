#!/usr/bin/env node
// Rebuilds system-preferences-census-rows.json from what the panes do now: each pane is gone through by discoverPane on an
// account of its own, as the census itself does, and its rows and effects note replace the pane's old ones. A row keeps its
// id when its view, role, name and index are the same. This records present behaviour: read the diff of the rows before
// committing it, as the census then only guards against a change from them.
//
//   node e2e/system-preferences-census-regenerate.mjs --url http://127.0.0.1:8080 [--panes general,dock] [--out dir] [--rows file] [--errors]
//
// --rows reads and writes that copy of the rows file instead of the one beside this script. --errors presses only the rows
// a run could not finish, each on a fresh account, stops itself after nine minutes and keeps what it reached, so a long
// pane can be finished by running this again.
//
// A pane's discovery signs in many accounts, each a whole desktop in a browser, so run it one pane at a time. It logs the
// machine's available memory every 30 seconds and stops itself below 3 GB, leaving the rows file as the last whole pane
// wrote it.

import { readFileSync, writeFileSync } from "node:fs";
import { census, createAccount, dockButton, person, slug } from "./r2-census-kit.mjs";
import { discoverPane, pressRowAgain, SP_PANES } from "./r2-sp-discover.mjs";

const MEMORY_FLOOR_GB = 3;
const availableGb = () =>
  Number(/MemAvailable:\s+(\d+)/.exec(readFileSync("/proc/meminfo", "utf8"))?.[1] ?? 0) / 1024 ** 2;
setInterval(() => {
  const free = availableGb();
  console.log(`memory: ${free.toFixed(1)} GB available`);
  if (free < MEMORY_FLOOR_GB) {
    console.error(`stopping: under ${MEMORY_FLOOR_GB} GB available`);
    process.exit(3);
  }
}, 30_000).unref();

const rowsAt = process.argv.indexOf("--rows");
const FILE =
  rowsAt > 0
    ? process.argv[rowsAt + 1]
    : new URL("./system-preferences-census-rows.json", import.meta.url);
const argument = process.argv.indexOf("--panes");
const only = argument > 0 ? new Set(process.argv[argument + 1].split(",")) : null;
const viewKey = (r) =>
  `${r.tab ?? ""}|${(r.path ?? []).map((p) => `${p.role}|${p.name}|${p.index}`).join(" > ")}|${r.role}|${r.name}|${r.index}`;

await census("system-preferences-regenerate", [], async (kit) => {
  const { base, run, newPage } = kit;
  const data = JSON.parse(readFileSync(FILE, "utf8"));
  const panes = SP_PANES.filter(([pane]) =>
    only ? only.has(pane) : data.rows.some((r) => r.pane === pane),
  );
  let accounts = 0;
  const fresh = async (label) => {
    accounts += 1;
    const page = await newPage(label);
    await createAccount(page, base, person(run, `re${accounts}`, "Prefs Census"));
    await dockButton(page, "System Preferences").click();
    const prefs = page.locator('.mac-managed-window[data-window-id="system-preferences"]');
    await prefs.locator(".mac-system-preferences-body:not([inert])").waitFor({ timeout: 10_000 });
    await prefs.getByRole("button", { name: "Show All" }).click();
    await prefs.getByRole("group", { name: "All preferences" }).waitFor({ timeout: 10_000 });
    return page;
  };
  for (const [pane, paneName] of panes) {
    if (process.argv.includes("--errors")) {
      const end = Date.now() + 9 * 60_000;
      for (const [at, row] of data.rows.entries()) {
        if (row.pane !== pane || row.kind !== "error" || Date.now() > end) continue;
        const page = await fresh(`re-${pane}-error`);
        const {
          after: _after,
          state: _state,
          before: _before,
          refused: _refused,
          theme: _theme,
          ...again
        } = await pressRowAgain(page, pane, paneName, row);
        data.rows[at] = again;
        writeFileSync(FILE, `${JSON.stringify(data, null, 1)}\n`);
        await page
          .context()
          .close()
          .catch(() => {});
      }
      const left = data.rows.filter((row) => row.pane === pane && row.kind === "error");
      console.log(`${pane}: ${left.length} rows still in error`);
      continue;
    }
    const opened = [await fresh(`re-${pane}`)];
    try {
      const { note, rows: seen } = await discoverPane(opened[0], pane, paneName, {
        fresh: async () => {
          // A retry's account is done with once the next is asked for: a pane may retry dozens of rows.
          while (opened.length > 1) {
            await opened
              .pop()
              .context()
              .close()
              .catch(() => {});
          }
          const page = await fresh(`re-${pane}-again`);
          opened.push(page);
          return page;
        },
      });
      // A browser that went away mid-pane finds nothing: the rows the file holds stay.
      if (!opened[0].context().browser()?.isConnected()) throw new Error("the browser went away");
      const old = new Map(data.rows.filter((r) => r.pane === pane).map((r) => [viewKey(r), r]));
      const taken = new Set(data.rows.filter((r) => r.pane !== pane).map((r) => r.id));
      const rows = seen
        // Help leaves the pane for Help Viewer: what discovery then finds is no view of the pane.
        .filter((s) => s.role && !(s.path ?? []).some((step) => step.name === "Help"))
        .map((s) => {
          let id = old.get(viewKey(s))?.id;
          if (!id || taken.has(id)) {
            const stem = `system-preferences.${pane}.${s.tab ? slug(s.tab) : "pane"}.${s.role}-${slug(s.name) || "unnamed"}`;
            id = stem;
            for (let n = 2; taken.has(id); n += 1) id = `${stem}-${n}`;
          }
          taken.add(id);
          return {
            id,
            pane,
            paneName,
            tab: s.tab ?? null,
            path: s.path ?? [],
            role: s.role,
            name: s.name,
            index: s.index,
            kind: s.kind,
            keys: s.keys ?? [],
            shell: s.shell ?? [],
            navigates: s.navigates ?? null,
            reveals: s.reveals ?? 0,
            retried: s.retried ?? null,
            error: s.error ?? null,
            why: s.why ?? null,
          };
        });
      const others = data.rows.filter((r) => r.pane !== pane);
      const at = data.rows.findIndex((r) => r.pane === pane);
      data.rows = [
        ...others.slice(0, at < 0 ? others.length : at),
        ...rows,
        ...others.slice(at < 0 ? others.length : at),
      ];
      if (note) data.notes[pane] = note;
      else delete data.notes[pane];
      writeFileSync(FILE, `${JSON.stringify(data, null, 1)}\n`);
      const kinds = {};
      for (const r of rows) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
      console.log(`${pane}: ${rows.length} rows ${JSON.stringify(kinds)}`);
    } catch (error) {
      kit.problems.push(`pane ${pane} stopped: ${String(error?.message ?? error).split("\n")[0]}`);
    } finally {
      for (const page of opened)
        await page
          .context()
          .close()
          .catch(() => {});
    }
  }
});
