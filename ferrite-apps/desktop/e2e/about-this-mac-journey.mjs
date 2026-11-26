#!/usr/bin/env node
// About This Mac on Ferrite: opened from the Apple menu, the window shows what
// the macalicious-desktop application knows about itself, from
// GET /api/about-this-mac/facts: its site build, its deployment (generation 0,
// "Not deployed", under `ferrite dev`), its modules and what this session keeps
// on the server, together
// with the browser and its screen. It shows no hardware facts (no processor
// model, memory, graphics or serial number). Exits 0 only when every step
// passed and the page logged no console error, page error, failed request or
// HTTP error.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/about-this-mac-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { engineFamily } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("about-this-mac");

/**
 * The name the window gives the browser running the page (`browserName` in
 * demos/about-this-mac/about-this-mac-desktop.tsx reads it from the user agent): Playwright's
 * Chromium and Google Chrome are "Chrome", its Firefox "Firefox" and its WebKit "Safari".
 */
const BROWSER_SHOWN = { chromium: "Chrome", firefox: "Firefox", webkit: "Safari" }[
  engineFamily(browserName)
];

await run(async (page) => {
  await openDesktop(page, base, step);
  const facts = await api(page, "GET", "/api/about-this-mac/facts");
  step(
    "the module answers the application's facts",
    facts.status === 200 && facts.json.application === "macalicious-desktop",
    JSON.stringify({ generation: facts.json.generation, modules: facts.json.modules }),
  );

  await page
    .getByRole("menuitem", { name: "Apple" })
    .or(page.getByRole("button", { name: "Apple" }))
    .first()
    .click();
  await page.getByRole("menuitem", { name: "About This Mac" }).click();
  const window = page.getByRole("region", { name: "About This Mac" }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const generation = Number(facts.json.generation ?? 0);
  const deployment = generation
    ? `Generation ${generation.toLocaleString("en-US")}`
    : "Not deployed (local ferrite dev)";
  const pane = window.getByRole("tabpanel", { name: "Overview" });
  await pane.getByText(deployment).first().waitFor({ timeout: 10_000 });
  const details = (await pane.getByRole("listitem").allInnerTexts()).map((t) =>
    t.replace(/\s+/g, " ").trim(),
  );
  step("the title names the application, not macOS", /Macalicious/.test(await pane.innerText()));
  const build = String(facts.json.build ?? "")
    .replace(/^sha256:/, "")
    .slice(0, 12);
  step(
    "the version line is the site build the application serves",
    build.length === 12 && (await pane.innerText()).includes(`build ${build}`),
    build,
  );
  step(
    "the details are the deployment, instance, modules, session data and browser",
    details.some((d) => d === `Deployment ${deployment}`) &&
      details.some((d) => d === `App Modules ${facts.json.modules}`) &&
      details.some((d) => d.startsWith("Session Data ")) &&
      details.some((d) => d.startsWith(`Browser ${BROWSER_SHOWN} `)),
    JSON.stringify(details),
  );
  step(
    "and no hardware facts",
    !details.some((d) => /^(Processor|Memory|Startup Disk|Graphics|Serial Number) /.test(d)),
  );
  await shot(page, path.join(out, "about-this-mac.png"));

  await window.getByRole("tab", { name: "Storage" }).click();
  const storagePane = window.getByRole("tabpanel", { name: "Storage" });
  await storagePane
    .getByText(/Ferrite Drive/)
    .first()
    .waitFor({ timeout: 5_000 });
  const storage = await storagePane.innerText();
  step(
    "Storage shows the person's Ferrite drive against its quota, and the apps' data beside it",
    /Ferrite Drive/.test(storage) &&
      /available of 134\.2 MB/.test(storage) &&
      /the apps keep .* more for you/.test(storage),
    storage.replace(/\s+/g, " ").slice(0, 200),
  );
  await window.getByRole("tab", { name: "Displays" }).click();
  const displays = window.getByRole("tabpanel", { name: "Displays" });
  await displays
    .getByText(/This Browser's Screen/)
    .first()
    .waitFor({ timeout: 5_000 });
  step(
    "Displays is the browser's screen",
    /This Browser's Screen/.test(await displays.innerText()),
  );
  await shot(page, path.join(out, "about-this-mac-displays.png"));
});
