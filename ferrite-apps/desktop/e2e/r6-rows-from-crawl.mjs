#!/usr/bin/env node
// Generate an app's crawled census rows from R6's four-engine crawl (campaign/round3/r6/crawl/<engine>/<app>.tsv): one
// row per unique control (repeated numbered controls collapse into one /regex/ row), with a probe guessed from its role,
// skipping what r6-common's commonRows (shared menu items) and chromeRows (window controls, resize edges) list. The way
// the crawl reached a control (its `state`: `after button "New Contact"`, `after treeitem "Work 5"`, `after menu File >
// New List`) becomes the probe's `reach` steps; a control in a dialog or sheet is looked for in the whole page. A dimmed
// menu item that describes itself ("This demo has no Buddies commands") is its own reason.
// The module is printed for e2e/census/<app>.crawled.mjs; it is regenerated, never edited: e2e/census/<app>.rows.mjs
// tunes rows by id.
//
//   node e2e/r6-rows-from-crawl.mjs <app> <AppName> [--crawl campaign/round3/r6/crawl] > e2e/census/<app>.crawled.mjs

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const [app, appName] = process.argv.slice(2);
const at = process.argv.indexOf("--crawl");
const crawl = at > 0 ? process.argv[at + 1] : "/workspace/campaign/round3/r6/crawl";
const ENGINES = ["chromium", "chrome", "firefox", "webkit"];
const GLYPHS = /[⌃⌥⇧⌘]+\S*$/;
const SHARED = new RegExp(
  `^(About ${appName}|Preferences…|Services|No Services Apply|Hide ${appName}|Hide Others|Show All|Quit ${appName}|Close Window|Undo|Redo|Cut|Copy|Paste|Select All|Enter Full Screen|Exit Full Screen|Minimize|Zoom|Bring All to Front|${appName} Help)$`,
);
const CHROME = /^(Close|Minimize|Enter Full Screen|Exit Full Screen)$/;
/** A crawl account's full name or account name (r6-kit account("crawl", <engine prefix><base-36 time>)). */
const PERSON = /\b[Cc]rawl ?(?:ch|fi|we)mv[a-z0-9]+\b/g;
/** What a person's name is in a row: a run's own account, as its full name ("Owner chmvk1x") or account name. */
const PERSON_PATTERN = "(?:[A-Z][a-z]+ [a-z0-9]+|[a-z]+[0-9][a-z0-9]*)";
const MONTH_NAMES =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const WEEKDAY_NAMES = "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday";
const MONTHS = new RegExp(`\\b(?:${MONTH_NAMES})\\b`, "g");
const WEEKDAYS = new RegExp(`\\b(?:${WEEKDAY_NAMES})\\b`, "g");

const seen = new Map();
for (const engine of ENGINES) {
  const file = path.join(crawl, engine, `${app}.tsv`);
  if (!existsSync(file)) continue;
  const [header, ...lines] = readFileSync(file, "utf8").split("\n").filter(Boolean);
  const keys = header.split("\t");
  for (const line of lines) {
    const c = Object.fromEntries(line.split("\t").map((v, i) => [keys[i], v]));
    if (c.where === "probe-failed" || c.role === "resizer" || c.role === "resize-handle") continue;
    c.name = (c.name ?? "").replace(GLYPHS, "").trim();
    if (!c.name) continue;
    if (c.where === "menu" && SHARED.test(c.name)) continue;
    if (c.where === "menu" && c.place === "Window" && c.role === "menuitemcheckbox") continue;
    if (c.where === "window" && c.role === "button" && CHROME.test(c.name)) continue;
    if (c.where === "dialog" && /^(Finder|Desktop)$/.test(c.window)) continue;
    if (/^after menu View > (Enter|Exit) Full Screen/.test(c.state ?? "")) continue;
    // A menu with no title is a button's pop-up menu ("Contacts commands", Share): its items are probed in the page,
    // reached through the button.
    if (c.where === "menu" && !c.place) c.where = "popup";
    // The crawl's own accounts ("Crawl chmvknnxy", one per engine) are one kind: a person's name.
    c.name = c.name.replace(PERSON, "@person@");
    // Month and weekday names are one kind each (a calendar's day cells and headers: "Monday, 23 October 2026").
    const dated = c.name.replace(MONTHS, "@month@").replace(WEEKDAYS, "@weekday@");
    // Numbers collapse: "23 October 2026" and "24 October 2026" are one kind.
    const kind = dated.replace(/\d+/g, "#");
    const key = `${c.where}|${c.where === "menu" ? c.place : ""}|${c.role}|${kind}`;
    const entry = seen.get(key) ?? {
      ...c,
      kind,
      names: new Set(),
      engines: new Set(),
      dim: 0,
      total: 0,
    };
    entry.names.add(c.name);
    entry.engines.add(engine);
    entry.total++;
    if (c.disabled === "true") entry.dim++;
    seen.set(key, entry);
  }
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[#]/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const q = (s) => JSON.stringify(s);
/** A name with a number in it (a count that data moves: "All 18") as a pattern; others exactly. */
const nameOf = (name) => (/\d/.test(name) ? `/^${esc(name).replace(/\d+/g, "\\d+")}$/` : name);
/** The crawl's `state` as reach steps: `after <role> "<name>"`, or `after menu <Title> > <Item>`. */
function reachOf(state = "") {
  const control = /^after (\w+) "(.*)"$/.exec(state);
  if (control) return [{ role: control[1], name: nameOf(control[2].replace(GLYPHS, "").trim()) }];
  const command = /^after menu (.+)$/.exec(state);
  if (command)
    return [{ menu: command[1].split(" > ").map((part) => part.replace(GLYPHS, "").trim()) }];
  return [];
}
const ids = new Set();
const out = [];
for (const e of [...seen.values()].sort((a, b) =>
  (a.where + a.place + a.role + a.kind).localeCompare(b.where + b.place + b.role + b.kind),
)) {
  const pattern =
    e.names.size > 1 || e.kind.includes("#") || /@(person|month|weekday)@/.test(e.kind);
  const name = pattern
    ? `/${esc(e.kind)
        .replace(/#/g, "\\d+")
        .replace(/@person@/g, PERSON_PATTERN)
        .replace(/@month@/g, `(?:${MONTH_NAMES})`)
        .replace(/@weekday@/g, `(?:${WEEKDAY_NAMES})`)}/`
    : [...e.names][0];
  const dimmed = e.dim === e.total;
  let probe;
  let how;
  let expected;
  const where = e.where === "menu" ? "menu" : "window";
  if (where === "menu") {
    const trail = e.place.split(" > ");
    if (dimmed)
      [probe, how, expected] = [
        {
          where,
          menu: trail,
          kind: "dimmed",
          ...(/^This demo has no /.test(e.kind) ? { selfReason: true } : {}),
        },
        `menu bar ${e.place} > ${e.kind} (hover)`,
        "dimmed, with the reason shown",
      ];
    else if (e.role === "menuitemcheckbox" || e.role === "menuitemradio")
      [probe, how, expected] = [
        { where, menu: trail, kind: "toggle" },
        `menu bar ${e.place} > ${e.kind}, twice`,
        "its check mark flips, then flips back",
      ];
    else if (e.haspopup && e.haspopup !== "false")
      [probe, how, expected] = [
        null,
        `menu bar ${e.place} > ${e.kind} (hover)`,
        "opens its submenu",
      ];
    else
      [probe, how, expected] = [
        { where, menu: trail, kind: "effect" },
        `menu bar ${e.place} > ${e.kind} (mouse)`,
        "the command acts: the app changes or a window, sheet or popover opens",
      ];
  } else if (dimmed)
    [probe, how, expected] = [
      { kind: "dimmed" },
      `hover ${e.kind}`,
      "dimmed, with the reason shown",
    ];
  else if (["checkbox", "switch"].includes(e.role))
    [probe, how, expected] = [
      { kind: "toggle" },
      `click ${e.kind}, twice`,
      "checked flips, then flips back",
    ];
  else if (["listbox", "tree", "grid", "tablist", "radiogroup"].includes(e.role))
    [probe, how, expected] = [
      { kind: "items" },
      `click the first item of ${e.kind}`,
      "it lists its items, and the first becomes selected",
    ];
  else if (["tab", "radio", "option", "treeitem", "gridcell", "row"].includes(e.role))
    [probe, how, expected] = [
      { kind: "select" },
      `click ${pattern ? "the first, a middle and the last" : e.kind}`,
      "it becomes selected and its content shows",
    ];
  else if (["textbox", "searchbox"].includes(e.role))
    [probe, how, expected] = [
      { kind: "type" },
      `type into ${e.kind}`,
      "the typed text shows and takes effect",
    ];
  else if (e.role === "combobox")
    [probe, how, expected] = [
      { kind: "choose" },
      `${e.kind} pop-up > another option`,
      "the pop-up shows the option chosen",
    ];
  else if (e.role === "slider")
    [probe, how, expected] = [{ kind: "slider" }, `arrow key on ${e.kind}`, "its value changes"];
  else if (e.role === "splitter")
    [probe, how, expected] = [null, `drag ${e.kind}`, "the panes resize"];
  else if (e.role === "link")
    [probe, how, expected] = [null, `click ${e.kind}`, "opens its target"];
  else
    [probe, how, expected] = [
      { kind: e.haspopup && e.haspopup !== "false" ? "opens" : "effect" },
      `click ${e.kind} (mouse)`,
      e.haspopup && e.haspopup !== "false" ? "its menu or popover opens" : "the app acts on it",
    ];
  let id = `${where === "menu" ? `menu.${slug(e.place)}.` : e.where === "popup" ? "popup." : ""}${slug(e.kind.replace(/@(person|month|weekday)@/g, "$1"))}`;
  while (ids.has(id)) id += "-2";
  ids.add(id);
  const window =
    where === "menu"
      ? `menu:${e.place}`
      : `${e.where}${e.window ? ` ${e.window}` : ""} (${e.state.slice(0, 40)})`;
  const extra = [];
  if (probe) {
    const reach = where === "menu" ? [] : reachOf(e.state);
    if (reach.length) probe.reach = reach;
    if (e.where === "dialog" || e.where === "sheet" || e.where === "popup") probe.scope = "page";
    extra.push(`probe: ${JSON.stringify(probe)}`);
  }
  if (pattern) extra.push(`notes: ${q(`${e.kind} (${[...e.names].slice(0, 3).join(", ")}…)`)}`);
  if (e.engines.size < 4) extra.push(`seenIn: ${q([...e.engines].join(","))}`);
  out.push(
    `  row(${q(id)}, ${q(window)}, ${q(e.role)}, ${q(name)}, ${q(how)}, ${q(expected)}${extra.length ? `, { ${extra.join(", ")} }` : ""}),`,
  );
}
console.log(
  [
    `// Generated by e2e/r6-rows-from-crawl.mjs from the four-engine crawl (campaign/round3/r6/crawl/<engine>/${app}.tsv):`,
    `// ${seen.size} kinds of control. Regenerate, do not edit; e2e/census/${app}.rows.mjs tunes rows by id.`,
    "",
    'import { row as rowOf } from "../r6-app-census.mjs";',
    "",
    `const row = rowOf(${q(app)});`,
    "",
    "export const CRAWLED = [",
    ...out,
    "];",
  ].join("\n"),
);
