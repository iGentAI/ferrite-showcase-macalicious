#!/usr/bin/env node
// R4 census combiner: writes `campaign/round3/r4/census/<app>.tsv` in the brief's section 5 format from
//   - the suite's rows (`node e2e/<app>-census-journey.mjs --emit`: id, state, role, name, how, expect, persists, covers),
//   - each engine's results (`<runs>/<app>-census-<engine>-<phase>.json` written by the suites),
// and reports every control R4's own crawl (`census/crawl/<app>-<engine>.tsv`) found that no census row covers.
//
//   node e2e/r4-census-combine.mjs --runs <dir> [--apps notes,textedit,...]
//
// Naming for R8's matcher (campaign/round3/r8/census-matching.md): `role` and `name` are the control's accessible role
// and name (a `/regex/` for a kind of repeated control); `window_or_state` is `menu:<Menu > Submenu>` for menu-bar
// items, otherwise the window and state.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const campaign = path.resolve(option("--campaign", "/workspace/campaign/round3/r4"));
const runs = path.resolve(option("--runs", path.join(here, "output", "r4")));
const apps = option("--apps", "notes,textedit,stickies,script-editor,font-book,mail-compose").split(
  ",",
);
const ENGINES = ["chromium", "chrome", "firefox", "webkit"];
const clean = (value) =>
  String(value ?? "")
    .replace(/[\t\n\r]+/g, " ")
    .trim();

/** The menu trail and item of a row reached from the menu bar ("menu bar Format > Font > Bold"). */
function menuOf(how) {
  const match = /^menu bar (.+)$/.exec(how ?? "");
  if (!match) return null;
  const trail = match[1].split(" > ").map((each) => each.split(",")[0].trim());
  return { menu: trail.slice(0, -1).join(" > "), item: trail.at(-1) };
}

function loadCrawl(app) {
  const nodes = [];
  for (const engine of ENGINES) {
    const file = path.join(campaign, "census", "crawl", `${app}-${engine}.tsv`);
    if (!existsSync(file)) continue;
    const [, ...lines] = readFileSync(file, "utf8").trim().split("\n");
    for (const line of lines) {
      const [, , state, trail, role, name, attrs] = line.split("\t");
      nodes.push({ engine, state, trail, role, name: clean(name), attrs });
    }
  }
  return nodes;
}

const asPattern = (name) => {
  const match = /^\/(.*)\/([a-z]*)$/.exec(name);
  return match ? new RegExp(`^(?:${match[1]})$`, match[2]) : null;
};
const nameMatches = (pattern, name) => {
  const regex = asPattern(pattern);
  return regex ? regex.test(name) : clean(pattern) === clean(name);
};

const summary = [];
for (const app of apps) {
  const suite = path.join(here, `${app}-census-journey.mjs`);
  if (!existsSync(suite)) {
    summary.push(`${app}: no suite`);
    continue;
  }
  const rows = execFileSync(process.execPath, [suite, "--emit"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const results = {};
  for (const engine of ENGINES) {
    for (const phase of ["write", "restart-check"]) {
      const file = path.join(runs, `${app}-census-${engine}-${phase}.json`);
      if (!existsSync(file)) continue;
      const run = JSON.parse(readFileSync(file, "utf8"));
      for (const result of run.results) results[`${engine}|${phase}|${result.id}`] = result;
    }
  }
  const crawl = loadCrawl(app);
  const covered = new Set();
  const out = [
    [
      "id",
      "app",
      "window_or_state",
      "role",
      "name",
      "how_reached",
      "expected_outcome",
      "verified_by",
      "persists",
      ...ENGINES,
      "notes",
    ].join("\t"),
  ];
  const counts = Object.fromEntries(ENGINES.map((engine) => [engine, { pass: 0, total: 0 }]));
  for (const row of rows) {
    const menu = menuOf(row.how);
    // The control's own role and name: the first cover the crawl confirms, else the first cover, else the metadata.
    const covers = (row.covers ?? []).map(([role, name, trail]) => ({
      role,
      name,
      trail: trail ? new RegExp(trail) : null,
    }));
    const confirmed = covers.find((cover) =>
      crawl.some(
        (node) =>
          node.role === cover.role &&
          nameMatches(cover.name, node.name) &&
          (!cover.trail || cover.trail.test(node.trail)),
      ),
    );
    const chosen = confirmed ?? covers[0];
    for (const cover of covers) {
      for (const node of crawl) {
        if (
          node.role === cover.role &&
          nameMatches(cover.name, node.name) &&
          (!cover.trail || cover.trail.test(node.trail))
        )
          covered.add(`${node.role}|${node.name}|${node.trail}`);
      }
    }
    const role = chosen?.role ?? row.role ?? "";
    const name = chosen?.name ?? row.name ?? "";
    const where = menu ? `menu:${menu.menu}` : (row.state ?? "");
    const phase =
      row.phases?.includes("restart-check") && !row.phases.includes("write")
        ? "restart-check"
        : "write";
    const cells = ENGINES.map((engine) => {
      const result = results[`${engine}|${phase}|${row.id}`];
      counts[engine].total += 1;
      if (!result) return "";
      if (result.ok) counts[engine].pass += 1;
      if (result.unavailable) return `unavailable:${clean(result.unavailable)}`;
      if (result.na) return `n/a:${clean(result.na)}`;
      return result.ok ? "pass" : "fail";
    });
    const failures = ENGINES.map((engine) => [engine, results[`${engine}|${phase}|${row.id}`]])
      .filter(([, result]) => result && !result.ok)
      .map(([engine, result]) => `${engine}: ${clean(result.detail).slice(0, 160)}`);
    out.push(
      [
        row.id,
        app,
        where,
        role,
        name,
        row.how ?? "",
        row.expect ?? "",
        `ferrite-apps/desktop/e2e/${app}-census-journey.mjs ${row.id}${phase === "restart-check" ? " (--phase restart-check)" : ""}`,
        row.persists ?? "none",
        ...cells,
        [row.notes ?? "", ...failures].filter(Boolean).join("; "),
      ]
        .map(clean)
        .join("\t"),
    );
  }
  mkdirSync(path.join(campaign, "census"), { recursive: true });
  writeFileSync(path.join(campaign, "census", `${app}.tsv`), `${out.join("\n")}\n`);
  // Crawled controls no census row covers (window controls of the desktop's own clock and status menus excluded).
  const gaps = new Map();
  for (const node of crawl) {
    if (/Status menus|^menubar$/.test(node.trail) || node.name === "") continue;
    const key = `${node.role}|${node.name}|${node.trail}`;
    if (covered.has(key)) continue;
    const short = `${node.state}\t${node.trail}\t${node.role}\t${node.name}`;
    gaps.set(short, [...(gaps.get(short) ?? []), node.engine]);
  }
  mkdirSync(path.join(campaign, "census", "crawl"), { recursive: true });
  writeFileSync(
    path.join(campaign, "census", "crawl", `${app}-uncovered.tsv`),
    `state\tpath\trole\tname\tengines\n${[...gaps].map(([key, engines]) => `${key}\t${[...new Set(engines)].join(",")}`).join("\n")}\n`,
  );
  summary.push(
    `${app}: ${rows.length} rows; ${ENGINES.map((engine) => `${engine} ${counts[engine].pass}/${counts[engine].total}`).join(", ")}; ${gaps.size} crawled controls uncovered`,
  );
}
console.log(summary.join("\n"));
