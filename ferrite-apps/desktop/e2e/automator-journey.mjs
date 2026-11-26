#!/usr/bin/env node
// Automator on Ferrite: under `ferrite dev`, sign in as a Guest User, get
// Automator from the App Store's library, build a workflow from the server's
// real actions (Get Specified Text, then New Reminders Item), run it on the
// server and read its log, and save it. Print plugins and Image Capture plugins,
// which a web page cannot join, are not available: the journey checks they are
// listed as such and that the server refuses to store one. The Runs view lists
// the run.
//
//   ferrite dev                       # in ferrite-apps/desktop
//   node e2e/automator-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output] [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { out, base, browserName } = options();
const { step, run } = journey("automator");
const tag = `${browserName}-${Date.now().toString(36)}`;

async function getApps(page, ids) {
  const library = await api(page, "GET", "/api/app-store/library");
  const installed = [...new Set([...(library.json.installed ?? []), ...ids])];
  return api(page, "PUT", "/api/app-store/library", { installed, rev: library.json.rev });
}

/** Add the library's action `title` to the workflow, by a double click in the Actions list. */
async function addAction(window, title) {
  const actions = window
    .getByRole("grid", { name: "Actions" })
    .or(window.getByRole("listbox", { name: "Actions" }))
    .first();
  await actions.getByText(title, { exact: true }).first().dblclick();
  const group = window.getByRole("group", { name: title, exact: true }).last();
  await group.waitFor({ timeout: 10_000 });
  return group;
}

/** Save the workflow, answering with the PUT's response. */
async function save(page, window) {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === "/api/automator/workflows",
    { timeout: 15_000 },
  );
  await window.getByRole("button", { name: "Save Workflow", exact: true }).click();
  return saved;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const got = await getApps(page, ["automator"]);
  step("Automator is got from the App Store", got.status === 200, `HTTP ${got.status}`);
  await reloadDesktop(page);
  await launch(page, "Automator");
  const window = page.locator('[data-window-id="automator"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await window
    .getByText("New Reminders Item", { exact: true })
    .first()
    .waitFor({ timeout: 15_000 });
  step("Automator opens with the server's actions in its library", true);

  // A workflow of real steps, run by hand.
  await window.getByRole("textbox", { name: "Workflow name", exact: true }).fill(`Shopping ${tag}`);
  const text = await addAction(window, "Get Specified Text");
  await text.getByRole("textbox", { name: "text", exact: true }).fill(`Milk ${tag}`);
  await addAction(window, "New Reminders Item");
  const ran = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/automator/run",
    { timeout: 30_000 },
  );
  await window.getByRole("button", { name: "Run", exact: true }).click();
  const runResponse = await ran;
  const log = await runResponse.json();
  step(
    "Run runs the workflow on the server, every step completed",
    runResponse.status() === 200 &&
      log.ok === true &&
      log.steps?.every((s) => s.status === "completed"),
    JSON.stringify(log.steps?.map((s) => `${s.title}: ${s.status}`)),
  );
  const grid = window.getByRole("grid", { name: "Log", exact: true });
  await grid
    .getByText("New Reminders Item")
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {});
  step("the log shows the run's steps", (await grid.getByText("New Reminders Item").count()) > 0);
  const reminders = await api(page, "GET", "/api/reminders/data");
  step(
    "the workflow's reminder is in the person's Reminders",
    (reminders.json.data?.reminders ?? []).some((r) => r.title === `Milk ${tag}`),
  );
  const firstSave = await save(page, window);
  step("Save stores the workflow", firstSave.status() === 200, `HTTP ${firstSave.status()}`);
  await shot(page, path.join(out, `automator-${browserName}.png`));

  // Print plugins and Image Capture plugins are listed as not available yet.
  await window.getByRole("combobox", { name: "Workflow type", exact: true }).click();
  const alarmOption = page.getByRole("option", { name: "Print Plugin (not available yet)" });
  const folderOption = page.getByRole("option", {
    name: "Image Capture Plugin (not available yet)",
  });
  await alarmOption.waitFor({ timeout: 5_000 }).catch(() => {});
  step(
    "Print Plugin and Image Capture Plugin are listed as not available yet",
    (await alarmOption.getAttribute("aria-disabled")) === "true" &&
      (await folderOption.getAttribute("aria-disabled")) === "true",
  );
  await page.keyboard.press("Escape");
  // Sent by the browser context's own request client (same cookies, so the same person), not
  // from the page: the refusal is the point, and is not one of the page's errors.
  const rev = (await api(page, "GET", "/api/automator/workflows")).json.rev;
  const refusedResponse = await page.request.put(
    new URL("/api/automator/workflows", page.url()).href,
    {
      data: {
        library: {
          tz: 0,
          workflows: [
            { id: `plugin-${tag}`, name: "Plugin", kind: "print-plugin", enabled: true, steps: [] },
          ],
        },
        rev,
      },
    },
  );
  const refused = {
    status: refusedResponse.status(),
    json: await refusedResponse.json().catch(() => ({})),
  };
  step(
    "the server refuses a print plugin rather than store a type it cannot run",
    refused.status === 400 && /not one this desktop keeps/.test(refused.json.error ?? ""),
    `HTTP ${refused.status}`,
  );

  // The Runs view lists the run.
  await window.getByRole("button", { name: "Runs", exact: true }).click();
  const runsGrid = window.getByRole("grid", { name: "Runs", exact: true });
  await runsGrid
    .getByText(`Shopping ${tag}`)
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
  step("the Runs view shows the run", (await runsGrid.getByText(`Shopping ${tag}`).count()) > 0);
  await shot(page, path.join(out, `automator-runs-${browserName}.png`));

  // Leave the person's workflows as they were.
  const library = await api(page, "GET", "/api/automator/workflows");
  await api(page, "PUT", "/api/automator/workflows", {
    library: { workflows: [], tz: 0 },
    rev: library.json.rev,
  });
});
