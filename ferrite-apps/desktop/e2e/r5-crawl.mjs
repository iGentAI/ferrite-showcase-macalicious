#!/usr/bin/env node
// R5 mechanical census crawl: for each R5 app, in one engine, the accessibility tree of its window in its
// first state, of each state one click on a tab, radio, sidebar item or segment reaches (one level), and of
// each menu of the menu bar with its submenus. Signs up a real account at the login window and gets the apps
// that are not preinstalled from the App Store with its own buttons. Writes
// <out>/crawl-<app>-<engine>.tsv: state, role, name, disabled, flags.
//
//   node e2e/r5-crawl.mjs --url http://127.0.0.1:8080 --browser chromium --out ../../../campaign/round3/r5/census/raw
//        [--apps safari,news,...]

import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  accountFor,
  appWindow,
  census,
  closeMenus,
  crawlMenus,
  crawlScope,
  getFromAppStore,
  launchBrowser,
  openApp,
  options,
  person,
} from "./r5-census-kit.mjs";

export const R5_APPS = [
  { id: "safari", name: "Safari", preinstalled: true },
  { id: "news", name: "News", preinstalled: true },
  { id: "stocks", name: "Stocks", preinstalled: false },
  { id: "maps", name: "Maps", preinstalled: true },
  { id: "find-my", name: "Find My", preinstalled: false },
  { id: "app-store", name: "App Store", preinstalled: true },
  { id: "books", name: "Books", preinstalled: false },
];

const opts = options();
const args = process.argv.slice(2);
const appsAt = args.indexOf("--apps");
const chosen = appsAt >= 0 ? args[appsAt + 1].split(",") : R5_APPS.map((a) => a.id);
const c = census("crawl", { ...opts, phase: "all" });
const HERE = { latitude: 37.8199, longitude: -122.4783, accuracy: 25 };
const browser = await launchBrowser(opts.browserName);
try {
  const page = await person(browser, c, opts.base, accountFor("crawl", "a"), {
    contextOptions: { permissions: ["geolocation"], geolocation: HERE },
  });
  for (const app of R5_APPS.filter((a) => chosen.includes(a.id))) {
    const lines = [];
    const failures = [];
    const add = (state, control) =>
      lines.push(
        [state, control.role, control.name, control.disabled ? "disabled" : "", control.flags].join(
          "\t",
        ),
      );
    try {
      if (!app.preinstalled) await getFromAppStore(page, app.name);
      const window = await openApp(page, app.name);
      await page.waitForTimeout(2_500);
      for (const control of await crawlScope(window)) add("window", control);
      // One level of states: each tab, radio, treeitem or sidebar option of the first state.
      const first = await crawlScope(window);
      const doors = first.filter(
        (x) => ["tab", "radio", "treeitem"].includes(x.role) && x.name && !x.disabled,
      );
      for (const door of doors.slice(0, 40)) {
        try {
          await appWindow(page, app.name)
            .getByRole(door.role, { name: door.name, exact: true })
            .first()
            .click({ timeout: 5_000 });
          await page.waitForTimeout(1_200);
          for (const control of await crawlScope(appWindow(page, app.name)))
            add(`${door.role}:${door.name}`, control);
        } catch (error) {
          failures.push(`${door.role}:${door.name}`);
          lines.push(
            [
              `${door.role}:${door.name}`,
              "error",
              String(error.message).split("\n")[0],
              "",
              "",
            ].join("\t"),
          );
        }
      }
      await closeMenus(page);
      await appWindow(page, app.name)
        .click({ position: { x: 200, y: 10 } })
        .catch(() => {});
      const menus = await crawlMenus(page);
      for (const control of menus.rows) add(control.state, control);
      for (const control of menus.rows)
        if (control.flags === "[no menu opened]") failures.push(control.state);
      c.row(
        `crawl.${app.id}`,
        lines.length > 0 && failures.length === 0,
        `${lines.length} controls; menus ${menus.titles.join(", ")}${failures.length ? `; not crawled: ${failures.join(", ")}` : ""}`,
      );
    } catch (error) {
      c.row(`crawl.${app.id}`, false, String(error.message).split("\n")[0]);
    }
    writeFileSync(
      path.join(opts.out, `crawl-${app.id}-${opts.browserName}.tsv`),
      `state\trole\tname\tdisabled\tflags\n${lines.join("\n")}\n`,
    );
    await closeMenus(page);
    const window = appWindow(page, app.name);
    if (await window.isVisible().catch(() => false))
      await window
        .getByRole("button", { name: "Close" })
        .first()
        .click()
        .catch(() => {});
  }
} finally {
  await browser.close();
}
c.finish();
