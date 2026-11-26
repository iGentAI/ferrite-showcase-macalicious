#!/usr/bin/env node
// Docs-demo census (R3; orchestrator ruling 06:51 UTC) of five apps' documentation pages: Disk Utility, AirPort Utility and
// Boot Camp Assistant, which the Ferrite build does not deploy (ferrite-apps/desktop/not-deployed.json), and the docs pages of
// Network Utility and Home, which it now does. These pages
// ship in the docs site (`npm run docs:dev` or docs:build + preview), with no Ferrite server, so nothing persists.
//   --crawl     the accessibility tree of the page's example window is walked and every control of the census roles is
//               written as a census row (campaign/round3/r3/census/<app>.tsv), notes "surface: docs demo (not deployed)";
//   (default)   every row of that census is driven with real input: a click (buttons, tabs, items, menus), typed text
//               (fields), an arrow key (sliders, steppers), and must change what the window shows, or be dimmed with its
//               reason shown; plus the page's own statement that nothing is changed outside the window.
//   node e2e/docs-demos-census-journey.mjs --app disk-utility --url http://127.0.0.1:5174 [--crawl --census-out <tsv>]
//        [--census <tsv>] --browser chromium|chrome|firefox|webkit [--explore <s>] [--seed <n>]

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CENSUS_COLUMNS, census, explore, sleep, until } from "./r3-census-kit.mjs";

const args = process.argv.slice(2);
const arg = (n, f = "") => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : f;
};
const APP = arg("--app");
const NAMES = {
  "disk-utility": "Disk Utility",
  "airport-utility": "AirPort Utility",
  "network-utility": "Network Utility",
  "boot-camp-assistant": "Boot Camp Assistant",
  home: "Home",
};
if (!NAMES[APP]) {
  console.error(`--app must be one of ${Object.keys(NAMES).join(", ")}`);
  process.exit(2);
}
const CRAWL = args.includes("--crawl");
const ROLES = new Set(
  "button menuitem menuitemcheckbox menuitemradio checkbox radio switch textbox searchbox combobox listbox option slider spinbutton tab link treeitem gridcell row".split(
    " ",
  ),
);
const NOTE = "surface: docs demo (not deployed)";
const slug = (t) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "unnamed";

/** Controls of the window, in tree order: { role, name, nth, disabled }; nth counts earlier controls of the same role and name. */
async function controls(win) {
  return win.evaluate(
    (root, roles) => {
      const implicit = (e) => {
        const t = e.tagName.toLowerCase();
        if (t === "button") return "button";
        if (t === "a" && e.hasAttribute("href")) return "link";
        if (t === "select") return "combobox";
        if (t === "textarea") return "textbox";
        if (t === "input") {
          const ty = (e.getAttribute("type") ?? "text").toLowerCase();
          return (
            {
              checkbox: "checkbox",
              radio: "radio",
              range: "slider",
              search: "searchbox",
              number: "spinbutton",
              button: "button",
              submit: "button",
            }[ty] ?? "textbox"
          );
        }
        return null;
      };
      const nameOf = (e) => {
        const by = e.getAttribute("aria-labelledby");
        if (by)
          return by
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        const l = e.getAttribute("aria-label");
        if (l) return l.trim();
        if (e.id) {
          const lab = document.querySelector(`label[for="${e.id}"]`);
          if (lab) return lab.textContent.replace(/\s+/g, " ").trim();
        }
        return (e.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
      };
      const seen = new Map();
      const out = [];
      for (const e of root.querySelectorAll("*")) {
        const role = e.getAttribute("role") ?? implicit(e);
        if (!role || !roles.includes(role)) continue;
        const r = e.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const name = nameOf(e);
        const key = `${role}|${name}`;
        const nth = seen.get(key) ?? 0;
        seen.set(key, nth + 1);
        out.push({
          role,
          name,
          nth,
          disabled: e.getAttribute("aria-disabled") === "true" || e.hasAttribute("disabled"),
        });
      }
      return out;
    },
    [...ROLES],
  );
}

const S = census(NAMES[APP], { id: APP });

await S.run(async ({ person, check, opts, note, problem, guard }) => {
  const page = await person("docs", {});
  await page.goto(`${opts.base}/demos/${APP}`, { waitUntil: "load" });
  const win = page.locator("main .mac-window, .mac-window").first();
  await win.waitFor({ timeout: 30_000 });
  await sleep(800);

  if (CRAWL) {
    const found = await controls(win);
    const rows = found.map((c) => ({
      id: `${APP}.docs.${c.role}.${slug(c.name)}${c.nth ? `-${c.nth + 1}` : ""}`,
      app: APP,
      window_or_state: "docs demo: basic example",
      role: c.role,
      name: c.name,
      how_reached: `${c.disabled ? "look" : ({ textbox: "type", searchbox: "type", combobox: "open", slider: "arrow key", spinbutton: "arrow key" }[c.role] ?? "click")}${c.nth ? ` (occurrence ${c.nth + 1})` : ""}`,
      expected_outcome: c.disabled
        ? "dimmed with its reason shown"
        : "the window shows the change, and claims no change outside it",
      verified_by: `ferrite-apps/desktop/e2e/docs-demos-census-journey.mjs --app ${APP}: ${c.role} ${c.name}`,
      persists: "none",
      chromium: "",
      chrome: "",
      firefox: "",
      webkit: "",
      notes: NOTE,
    }));
    rows.push({
      id: `${APP}.docs.page.honest`,
      app: APP,
      window_or_state: "docs demo page",
      role: "page",
      name: NAMES[APP],
      how_reached: "read the page",
      expected_outcome: "the page says the window changes nothing outside itself",
      verified_by: `ferrite-apps/desktop/e2e/docs-demos-census-journey.mjs --app ${APP}: honest`,
      persists: "none",
      chromium: "",
      chrome: "",
      firefox: "",
      webkit: "",
      notes: NOTE,
    });
    const ids = new Set();
    for (const r of rows) {
      let id = r.id;
      for (let k = 2; ids.has(id); k += 1) id = `${r.id}-${k}`;
      r.id = id;
      ids.add(id);
    }
    const out = arg("--census-out");
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(
      out,
      `${[CENSUS_COLUMNS.join("\t"), ...rows.map((r) => CENSUS_COLUMNS.map((c) => String(r[c] ?? "").replace(/[\t\n]+/g, " ")).join("\t"))].join("\n")}\n`,
    );
    console.log(`${rows.length} census rows of the ${NAMES[APP]} docs demo written to ${out}`);
    for (const r of rows) check(r.id, true, "listed");
    return;
  }

  // Verify: every row with real input, from a fresh page each time a control leaves the page changed.
  const { readFileSync } = await import("node:fs");
  const [head, ...lines] = readFileSync(opts.censusFile, "utf8").split("\n").filter(Boolean);
  const cols = head.split("\t");
  const rows = lines.map((l) => Object.fromEntries(l.split("\t").map((v, i) => [cols[i], v])));
  const state = async () =>
    win.evaluate(
      (e) =>
        `${e.innerHTML.length}|${[...e.querySelectorAll("[aria-selected=true],[aria-checked=true],[aria-pressed=true],[aria-expanded=true],[data-selected],[data-state]")].map((x) => x.outerHTML.slice(0, 80)).join("")}|${e.innerText}`,
    );
  const popups = () =>
    page
      .locator(
        '[role="menu"]:visible, [role="listbox"]:visible, [role="dialog"]:visible, [role="alertdialog"]:visible, [role="tooltip"]:visible',
      )
      .count();
  const fresh = async () => {
    await page.goto(`${opts.base}/demos/${APP}`, { waitUntil: "load" });
    await win.waitFor({ timeout: 30_000 });
    await sleep(500);
  };
  const prose = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const honest =
    prose.match(
      /[^.]*(nothing is read|no command changes|changes nothing|imaginary|are data|stand-in|not (real|connected)|nothing (real|leaves))[^.]*\./i,
    )?.[0] ?? "";
  for (const r of rows) {
    if (r.role === "page") {
      check(
        r.id,
        honest.length > 0,
        honest
          ? `the page says: ${honest.trim().slice(0, 160)}`
          : "no statement that the window changes nothing outside itself",
      );
      continue;
    }
    // The illustration window's own controls document the component: unavailable, citing the page's statement
    // (orchestrator's ruling 15:11), only where that statement is visible on the page.
    if (
      r.role === "button" &&
      /^(Close|Minimize|Zoom|Enter Full Screen|Exit Full Screen)$/.test(r.name) &&
      honest
    ) {
      check(
        r.id,
        true,
        `unavailable: the example window's control; the page says: ${honest.trim().slice(0, 120)}`,
      );
      continue;
    }
    await guard(r.id, page, async () => {
      const nth = Number(/occurrence (\d+)/.exec(r.how_reached)?.[1] ?? "1") - 1;
      // An unnamed control has no text (its name falls back to its text): found among those with none.
      const loc = r.name
        ? win.getByRole(r.role, { name: r.name, exact: true }).nth(nth)
        : win.getByRole(r.role).filter({ hasNotText: /\S/ }).nth(nth);
      if ((await loc.count()) === 0) return check(r.id, false, `not found: ${r.role} "${r.name}"`);
      const disabled =
        (await loc.getAttribute("aria-disabled")) === "true" ||
        (await loc.isDisabled().catch(() => false));
      if (disabled) {
        const why = (
          (await loc.getAttribute("title")) ??
          (await loc.getAttribute("aria-description")) ??
          ""
        ).trim();
        return check(r.id, why.length > 0, why ? `dimmed: ${why}` : "dimmed, no reason shown");
      }
      const s0 = await state();
      const p0 = await popups();
      if (["textbox", "searchbox"].includes(r.role)) {
        const v0 = await loc.inputValue().catch(() => "");
        await loc.click();
        await page.keyboard.type(" R3");
        const v1 = await loc.inputValue().catch(() => "");
        check(r.id, v1 !== v0, `typed: "${v0}" -> "${v1.slice(0, 40)}"`);
      } else if (["slider", "spinbutton"].includes(r.role)) {
        const v0 =
          (await loc.getAttribute("aria-valuenow")) ?? (await loc.inputValue().catch(() => ""));
        await loc.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowUp");
        const v1 =
          (await loc.getAttribute("aria-valuenow")) ?? (await loc.inputValue().catch(() => ""));
        check(r.id, v1 !== v0, `${v0} -> ${v1}`);
      } else {
        const selected0 =
          (await loc.getAttribute("aria-selected")) === "true" ||
          (await loc.getAttribute("aria-current")) !== null;
        await loc.click({ timeout: 4_000 });
        const changed = await until(
          async () => (await state()) !== s0 || (await popups()) > p0,
          2_000,
        );
        const after = (await win.innerText()).replace(/\s+/g, " ");
        const staysSelected =
          !changed &&
          selected0 &&
          ((await loc.getAttribute("aria-selected")) === "true" ||
            (await loc.getAttribute("aria-current")) !== null);
        if (staysSelected) return check(r.id, true, "already selected: it stays selected");
        // A control that changes nothing must say why (ruling 15:11, item 4): its tooltip.
        const says = !changed
          ? ((await loc.getAttribute("title").catch(() => null)) ?? "").trim()
          : "";
        if (says) return check(r.id, true, `changes nothing, and says why: ${says}`);
        check(
          r.id,
          !!changed,
          changed
            ? `the window answered${(await popups()) > p0 ? " (a menu, list or dialog opened)" : ""}`
            : `clicked; nothing in the window changed (${after.slice(0, 60)})`,
        );
      }
      for (let i = 0; i < 3 && (await popups()) > 0; i += 1) await page.keyboard.press("Escape");
      if ((await state()) !== s0) await fresh();
    });
  }
  if (opts.explore > 0) {
    await fresh();
    const r = await explore(page, {
      app: `${APP}-docs`,
      windows: page.locator(".mac-window"),
      seconds: opts.explore,
      seed: opts.seed,
      out: opts.out,
      browserName: opts.browserName,
      reopen: fresh,
      menus: [],
    });
    note(`exploratory pass: ${r.actions} actions, ${r.unresponsive} unresponsive, log ${r.log}`);
    console.log(
      `${r.unresponsive ? "FAIL" : "ok  "} explore (${r.actions} actions, seed ${opts.seed}, ${r.log})`,
    );
    if (r.unresponsive) problem(`exploratory pass: the UI stopped answering (${r.log})`);
  }
});
