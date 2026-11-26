#!/usr/bin/env node
// Activity Monitor on Ferrite: with Calculator open, Activity Monitor lists
// the desktop's running applications with their windows, and Quit Process
// quits Calculator through the desktop. Its Ferrite view shows, per app, the
// requests per second, median and 95th-percentile server time, store calls and failed requests
// the macalicious-desktop application measured of itself over the last five
// minutes (GET /api/activity-monitor/ferrite), with the deployment generation
// and instance; Calculator's requests grow after requests to it, in the
// answer and in the window without a reload. Its Network
// view shows the round trips the browser timed to the application. The Ferrite
// view holds no processor, memory or energy column: Ferrite gives an application
// none. The CPU and Memory views show what the browser reports of this page and
// say that it is shown nothing of the computer's (activity-monitor-views-journey.mjs).
// Exits 0 only when every step passed and the page logged no console error,
// page error, failed request or HTTP error.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/activity-monitor-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                         [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { openWithSpotlight } from "./system-kit.mjs";

const FERRITE = "/api/activity-monitor/ferrite";
const { base, out } = options();
const { step, run } = journey("activity-monitor");

const windowOf = (page, id) => page.locator(`[data-window-id="${id}"]`);

/** The cells of `row` once `check` holds of them, polled up to `ms`; the last cells read. */
async function cellsWhen(row, check, ms = 12_000) {
  const until = Date.now() + ms;
  let cells = [];
  while (Date.now() < until) {
    cells = await row.getByRole("gridcell").allInnerTexts();
    if (check(cells)) return cells;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return cells;
}

const count = (text) => Number.parseInt(String(text ?? "").replace(/[^\d]/g, "") || "-1", 10);

const calculator = async (page) =>
  (await api(page, "GET", FERRITE)).json.apps?.find((app) => app.name === "calculator");

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Calculator");
  await windowOf(page, "calculator").waitFor({ state: "visible", timeout: 10_000 });

  await openWithSpotlight(page, "Activity Monitor");
  const window = page.getByRole("region", { name: "Activity Monitor (This Desktop)" }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const applications = window.getByRole("grid", { name: "Applications" });
  const calculatorRow = applications.getByRole("row").filter({ hasText: "Calculator" }).first();
  await calculatorRow.waitFor({ timeout: 10_000 });
  const cells = await calculatorRow.getByRole("gridcell").allInnerTexts();
  step(
    "Applications lists Calculator with its windows",
    cells[0]?.trim() === "Calculator" && Number(cells[1]) >= 1 && cells[3] === "Quits",
    JSON.stringify(cells),
  );

  const before = (await calculator(page))?.requests ?? 0;
  for (let i = 0; i < 3; i += 1) await api(page, "GET", "/api/calculator/tape");
  const measured = await calculator(page);
  step(
    "the Ferrite view measures Calculator's requests, server time and store calls",
    measured?.requests >= before + 3 &&
      typeof measured?.p50_ms === "number" &&
      measured.p95_ms >= measured.p50_ms &&
      measured.store_ops >= 3,
    JSON.stringify(measured),
  );

  await window.getByRole("button", { name: "Ferrite" }).click();
  const ferrite = window.getByRole("grid", { name: "Ferrite" });
  const row = ferrite.getByRole("row").filter({ hasText: "Calculator" }).first();
  await row.waitFor({ timeout: 10_000 });
  const figures = await row.getByRole("gridcell").allInnerTexts();
  step(
    "the window lists Calculator with its rate, median and 95th-percentile server time",
    /^\d+\.\d\d$/.test(figures[1] ?? "") &&
      /ms|s$/.test(figures[3] ?? "") &&
      /ms|s$/.test(figures[4] ?? ""),
    JSON.stringify(figures),
  );
  // The window reads the figures again every two seconds: new requests reach it, no reload.
  const shown = count(figures[2]);
  for (let i = 0; i < 3; i += 1) await api(page, "GET", "/api/calculator/tape");
  const grown = await cellsWhen(row, (cells) => count(cells[2]) >= shown + 3);
  step(
    "Calculator's requests in the window grow with the requests made since",
    shown >= 0 && count(grown[2]) >= shown + 3,
    JSON.stringify({ before: figures[2], after: grown[2] }),
  );
  const text = await window.innerText();
  step(
    "with the deployment generation and instance that answered",
    /Generation:\s*\d/.test(text) && /Instance:/.test(text),
  );
  const columns = await ferrite.getByRole("columnheader").allInnerTexts();
  step(
    "the Ferrite view has no processor, memory or energy column, and no percentage of a processor",
    columns.length > 0 &&
      !columns.some((title) => /CPU|Memory|Energy/.test(title)) &&
      !/% CPU|Energy Impact/.test(text),
    columns.join(" | "),
  );
  await shot(page, path.join(out, "activity-monitor-ferrite.png"));

  await window.getByRole("button", { name: "Network" }).click();
  const segment = await window.getByRole("button", { name: "Network" }).boundingBox();
  const search = await window
    .getByRole("searchbox")
    .or(window.locator("input"))
    .first()
    .boundingBox();
  step(
    "the Network view's title stops before the search field",
    segment.x + segment.width <= search.x,
    `${segment.x + segment.width} and ${search.x}`,
  );
  const network = window.getByRole("grid", { name: "Network" });
  const health = network.getByRole("row").filter({ hasText: "/health" }).first();
  await health.waitFor({ timeout: 10_000 });
  const trips = await cellsWhen(
    health,
    (cells) =>
      /\d+(\.\d+)? ms|\d\.\d s/.test(cells[1] ?? "") && Number.parseInt(cells[5] ?? "0", 10) >= 1,
  );
  step(
    "the Network view shows the round trips the browser timed to the application",
    /\d+(\.\d+)? ms|\d\.\d s/.test(trips[1] ?? "") && Number.parseInt(trips[5] ?? "0", 10) >= 1,
    JSON.stringify(trips),
  );
  await shot(page, path.join(out, "activity-monitor-network.png"));

  await window.getByRole("button", { name: "Applications" }).click();
  await applications.getByText("Calculator", { exact: true }).click();

  // Rows open their inspectors: Return for the selected one, a double click for another.
  const inspector = (id) => page.locator(`[data-window-id="activity-monitor:inspect-${id}"]`);
  await page.keyboard.press("Enter");
  await inspector("calculator").waitFor({ timeout: 5_000 });
  step("Return opens the selected row's inspector", true);
  await inspector("calculator").getByRole("button", { name: /close/i }).first().click();
  await applications.getByText("Activity Monitor", { exact: true }).dblclick();
  await inspector("activity-monitor").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  const facts = await inspector("activity-monitor").innerText();
  await shot(page, path.join(out, "activity-monitor-inspector.png"));
  step(
    "a double click opens one, and a hyphenated app has its requests",
    /Requests, 5 minutes:\s*[\d,]+/.test(facts),
    facts.replace(/\s+/g, " ").slice(0, 120),
  );
  await inspector("activity-monitor").getByRole("button", { name: /close/i }).first().click();

  await applications.getByText("Calculator", { exact: true }).click();
  await window.getByRole("button", { name: "Quit Process" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.waitFor({ timeout: 5_000 });
  await page.keyboard.press("Control+i");
  await page.waitForTimeout(400);
  step(
    "with the Quit sheet up, the window's Inspect key does nothing",
    (await inspector("calculator").count()) === 0,
  );
  // The sheet has Cancel, Force Quit and Quit, as a Mac's does.
  await sheet.getByRole("button", { name: "Quit", exact: true }).click();
  await windowOf(page, "calculator").waitFor({ state: "detached", timeout: 10_000 });
  step(
    "Quit Process closes the Calculator window",
    (await windowOf(page, "calculator").count()) === 0,
  );
  // The window reads the desktop's windows every second: still gone at the next reading.
  await page.waitForTimeout(1_500);
  step(
    "and Calculator is no longer running in Activity Monitor",
    (await applications.getByText("Calculator", { exact: true }).count()) === 0,
  );
});
