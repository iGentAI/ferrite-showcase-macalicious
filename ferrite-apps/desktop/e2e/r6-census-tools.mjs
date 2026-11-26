// R6 census tools (round 3). Row definitions live in e2e/census/<app>.rows.mjs (one entry per census id, with a
// matcher over crawled controls); the census suite e2e/<app>-census-journey.mjs verifies them and writes
// <out>/<app>-census-<engine>-<phase>.tsv.
//
//   node e2e/r6-census-tools.mjs summary <app> [--crawl campaign/round3/r6/crawl]
//       unique crawled controls of <app> across engines and states (where|place|role|name  engines  first state)
//   node e2e/r6-census-tools.mjs check <app> [--crawl ...]
//       every crawled control no census row's matcher claims (an unlisted control); exits 1 when any
//   node e2e/r6-census-tools.mjs build <app> [--results e2e/output/r6] [--census campaign/round3/r6/census]
//       writes <census>/<app>.tsv: the brief's columns, the engine cells from the newest results of each engine
//       (a restart-check result joins its write result; `unavailable:`/`n/a:` rows keep their reason)

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");
const args = process.argv.slice(2);
const [command, app] = args;
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const ENGINES = ["chromium", "chrome", "firefox", "webkit"];
const workspaceCampaign = existsSync("/workspace/campaign")
  ? "/workspace/campaign"
  : path.join(root, "..", "campaign");
const crawlDir = option("--crawl", path.join(workspaceCampaign, "round3", "r6", "crawl"));

function readTsv(file) {
  if (!existsSync(file)) return [];
  const [header, ...lines] = readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim());
  const keys = header.split("\t");
  return lines.map((line) => Object.fromEntries(line.split("\t").map((v, i) => [keys[i], v])));
}

/** Crawled controls of `app` in every engine, menus and probes included (older crawls' `resizer` read as R8's role). */
function crawled(app) {
  const out = [];
  for (const engine of ENGINES) {
    for (const row of readTsv(path.join(crawlDir, engine, `${app}.tsv`))) {
      if (row.where === "probe-failed") continue;
      if (row.role === "resizer")
        Object.assign(row, { role: "resize-handle", name: row.name.replace(/^resize /, "") });
      out.push({ ...row, engine });
    }
  }
  // The suites' own snapshots of the states they reach (r6-kit snapshot()).
  const suiteDir = option(
    "--snapshots",
    path.join(root, "ferrite-apps", "desktop", "e2e", "output", "r6"),
  );
  if (existsSync(suiteDir)) {
    for (const file of readdirSync(suiteDir).filter(
      (f) => f.startsWith(`${app}-snapshot-`) && f.endsWith(".tsv"),
    )) {
      for (const row of readTsv(path.join(suiteDir, file)))
        out.push({ ...row, engine: row.engine || file.split("-").at(-1).replace(".tsv", "") });
    }
  }
  return out;
}

const keyOf = (c) => `${c.where}|${c.where === "menu" ? c.place : c.window}|${c.role}|${c.name}`;

async function rows(app) {
  const file = path.join(here, "census", `${app}.rows.mjs`);
  const module = await import(pathToFileURL(file).href);
  return module.ROWS;
}

/**
 * R8's census matching rule (campaign/round3/r8/census-matching.md): a crawled control is listed when a row of the
 * same app has the same role and a name that matches, plain text exactly (whitespace collapsed) or `/regex/flags`
 * anchored to the whole name; a row whose window starts `menu:<title>` matches only items of the menu with that
 * top-level title. Rows of other roles (shortcuts, drag targets, routes) take no part.
 */
function claims(row, c) {
  if (row.role !== c.role) return false;
  const name = String(c.name ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const pattern = /^\/(.*)\/([a-z]*)$/.exec(row.name);
  const nameOk = pattern
    ? new RegExp(`^(?:${pattern[1]})$`, pattern[2]).test(name)
    : row.name.replace(/\s+/g, " ").trim() === name;
  if (!nameOk) return false;
  const menu = /^menu:([^>]+)/.exec(row.window ?? "");
  if (menu && (c.where !== "menu" || c.place.split(" > ")[0].trim() !== menu[1].trim()))
    return false;
  return true;
}

if (command === "summary") {
  const seen = new Map();
  for (const c of crawled(app)) {
    const k = keyOf(c);
    const entry = seen.get(k) ?? {
      engines: new Set(),
      state: c.state,
      disabled: c.disabled,
      keys: c.keys ?? "",
      title: c.title,
    };
    entry.engines.add(c.engine);
    seen.set(k, entry);
  }
  for (const [k, e] of [...seen].sort()) {
    const engines = ENGINES.map((x) => (e.engines.has(x) ? x.slice(0, 2) : "--")).join("");
    console.log(
      `${k}\t${engines}\t${e.disabled === "true" ? "dim" : ""}\t${e.keys}\t${e.title}\t${e.state.slice(0, 40)}`,
    );
  }
  console.log(`${seen.size} unique controls`);
} else if (command === "check") {
  const defined = await rows(app);
  const unlisted = new Map();
  for (const c of crawled(app)) {
    if (!defined.some((row) => claims(row, c))) {
      const k = keyOf(c);
      const entry = unlisted.get(k) ?? { engines: new Set(), state: c.state };
      entry.engines.add(c.engine);
      unlisted.set(k, entry);
    }
  }
  for (const [k, e] of [...unlisted].sort())
    console.log(`UNLISTED ${k}\t${[...e.engines].join(",")}\t${e.state}`);
  const ids = new Set();
  for (const row of defined) {
    if (ids.has(row.id)) console.log(`DUPLICATE ${row.id}`);
    ids.add(row.id);
  }
  console.log(`${app}: ${defined.length} census rows, ${unlisted.size} unlisted crawled controls`);
  process.exit(unlisted.size ? 1 : 0);
} else if (command === "build") {
  const defined = await rows(app);
  const resultsDir = option(
    "--results",
    path.join(root, "ferrite-apps", "desktop", "e2e", "output", "r6"),
  );
  const censusDir = option("--census", path.join(workspaceCampaign, "round3", "r6", "census"));
  mkdirSync(censusDir, { recursive: true });
  const results = {};
  const mtime = (file) => (existsSync(file) ? statSync(file).mtimeMs : 0);
  for (const engine of ENGINES) {
    results[engine] = new Map();
    const file = (phase) => path.join(resultsDir, `${app}-census-${engine}-${phase}.tsv`);
    // The newest run of the engine wins: a whole run (`all`), or a write run with the restart check made after it.
    // Older files are history and never mixed in.
    const all = mtime(file("all"));
    const write = mtime(file("write"));
    const restart = mtime(file("restart-check"));
    const phases =
      all >= write
        ? all
          ? ["all"]
          : []
        : restart >= write
          ? ["write", "restart-check"]
          : ["write"];
    for (const phase of phases) {
      for (const line of readFileSync(file(phase), "utf8").split("\n").filter(Boolean)) {
        const [id, verdict, detail] = line.split("\t");
        const previous = results[engine].get(id);
        // Within the selected run, a row passes only when every phase that checked it passed.
        results[engine].set(
          id,
          previous && previous.verdict === "fail" ? previous : { verdict, detail },
        );
      }
    }
    if (phases.includes("write") && !phases.includes("restart-check")) {
      for (const row of defined.filter((r) => r.persists === "restart")) {
        results[engine].set(row.id, {
          verdict: "fail",
          detail: "no restart check after the newest write run",
        });
      }
    }
  }
  const header = [
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
  ];
  const clean = (v) => String(v ?? "").replace(/[\t\n\r]+/g, " ");
  const lines = defined.map((row) => {
    const cells = ENGINES.map((engine) => {
      const special = row.engines?.[engine];
      const r = results[engine].get(row.id);
      if (!r) return "fail";
      if (r.verdict !== "pass") return "fail";
      // A row the suite verified as visibly unavailable (or n/a in this engine) keeps that reason in its cell.
      return special ?? row.cell ?? "pass";
    });
    return [
      row.id,
      app,
      row.window,
      row.role,
      row.name,
      row.how,
      row.expected,
      `e2e/${app}-census-journey.mjs: ${row.step ?? row.id}`,
      row.persists ?? "none",
      ...cells,
      row.notes ?? "",
    ]
      .map(clean)
      .join("\t");
  });
  const file = path.join(censusDir, `${app}.tsv`);
  writeFileSync(file, `${header.join("\t")}\n${lines.join("\n")}\n`);
  const passing = lines.filter((l) =>
    l
      .split("\t")
      .slice(9, 13)
      .every((c) => c !== "fail"),
  ).length;
  console.log(
    `${file}: ${defined.length} rows, ${passing} pass (or are unavailable with their reason) in all four engines`,
  );
} else {
  console.error("usage: r6-census-tools.mjs summary|check|build <app> [options]");
  process.exit(2);
}
