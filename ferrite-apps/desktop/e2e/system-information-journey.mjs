#!/usr/bin/env node
// System Information on Ferrite: the outline holds the browser's own facts
// and the macalicious-desktop application's, from
// GET /api/system-information/report. The window opens on the application's
// overview, which names its deployment ("Not deployed" under `ferrite dev`,
// the generation once deployed); App Modules lists every module
// the application registers with the requests it counted, and the count for
// Calculator grows after a request to it. Hardware says what a page cannot read.
// Exits 0 only when every step passed and the page logged no console error,
// page error, failed request or HTTP error.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/system-information-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, openDesktop, options } from "./app-journey.mjs";
import { engineFamily } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("system-information");

/**
 * A token of the user agent each engine reports for itself: Playwright's Chromium and Google Chrome
 * say Chrome (or HeadlessChrome), its Firefox Firefox and its WebKit AppleWebKit. The Browser pane
 * shows the page's own `navigator.userAgent`, so the token is that of the engine running this journey.
 */
const AGENT_TOKEN = {
  chromium: /HeadlessChrome|Chrome/,
  firefox: /Firefox/,
  webkit: /AppleWebKit/,
}[engineFamily(browserName)];

async function openWithSpotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const report = await api(page, "GET", "/api/system-information/report");
  const modules = report.json.modules ?? [];
  step(
    "the module answers the application's report",
    report.status === 200 && modules.length > 10,
    `${modules.length} modules`,
  );
  // A request to Calculator, so that its count is above zero.
  await api(page, "GET", "/api/calculator/tape");

  await openWithSpotlight(page, "System Information");
  const window = page.getByRole("region", { name: "Macalicious Desktop" }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const generation = Number(report.json.facts?.generation ?? 0);
  const deployment = generation
    ? `Generation ${generation.toLocaleString("en-US")}`
    : "Not deployed (local ferrite dev)";
  await window.getByText(deployment).first().waitFor({ timeout: 10_000 });
  const overview = await window.innerText();
  step("it opens on the application's overview", /macalicious-desktop/.test(overview));
  step(
    "the site build is the one the application serves",
    overview.includes(report.json.facts.build),
  );
  const outline = window.getByRole("treegrid", { name: "Categories" });
  const categories = (await outline.getByRole("row").allInnerTexts()).map((t) => t.trim());
  step(
    "the outline holds the browser's and the application's reports",
    categories.includes("Browser") && categories.includes("Ferrite Application"),
    JSON.stringify(categories),
  );
  await page.screenshot({ path: path.join(out, "system-information.png") });

  await outline.getByText("App Modules", { exact: true }).click();
  const table = window.getByRole("grid", { name: "App Modules" });
  await table.waitFor({ timeout: 10_000 });
  const calculator = table.getByRole("row").filter({ hasText: "/api/calculator/" }).first();
  const cells = await calculator.getByRole("gridcell").allInnerTexts();
  step(
    "App Modules lists Calculator with the requests it answered",
    cells[0] === "Calculator" && Number(cells[2]?.replace(/,/g, "")) > 0,
    JSON.stringify(cells),
  );

  await outline.getByText("Browser", { exact: true }).click();
  const browser = await window.innerText();
  const agent = await page.evaluate(() => navigator.userAgent);
  step(
    "Browser is what the browser reports about itself",
    /User Agent/.test(browser) && browser.includes(agent) && AGENT_TOKEN.test(browser),
    `${browserName}: ${agent}`,
  );
  await page.screenshot({ path: path.join(out, "system-information-browser.png") });
});
