#!/usr/bin/env node
// Automator's step parts on the served desktop: Results after a real run, and Ignore Input through
// the server: a second step counts what it was given, then with the option on is given nothing, and
// the option comes back with the saved workflow. It signs in as a new guest.
//
//   node e2e/automator-parts-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("automator-parts");
const NAME = `Parts ${Date.now()}`;

const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  await launch(page, "Automator");
  const actions = page.getByRole("grid", { name: "Actions" });
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 15_000 });
  const search = page.getByRole("searchbox", { name: "Search" });
  await search.fill("Run JavaScript");
  const js = actions.getByText("Run JavaScript", { exact: true });
  await js.waitFor({ timeout: 5000 });
  await js.dblclick();
  await js.dblclick();

  const steps = page.locator(".mac-automator-step");
  const first = steps.nth(0);
  const second = steps.nth(1);
  await first.getByRole("textbox").first().fill('return ["one", "two"];');
  await second.getByRole("textbox").first().fill('return "given " + input.length;');
  await second.locator(".mac-automator-step-name").click();

  // The Action menu's Results row opens the part on the selected step.
  await bar(page, "Action").click();
  await page.waitForTimeout(250);
  await page.getByRole("menuitemcheckbox", { name: "Results" }).click();
  const results = second.getByRole("group", { name: "Results of Run JavaScript" });
  step(
    "Results says to run the workflow",
    (await results.textContent()).includes("Run the workflow"),
  );
  await first.getByRole("button", { name: "Results" }).click();

  const runIt = page.getByRole("button", { name: "Run", exact: true });
  await runIt.click();
  await results.getByText("given 2").waitFor({ timeout: 15_000 });
  step("the second step's Results shows what it gave for two items", true);
  const firstText = await first
    .getByRole("group", { name: "Results of Run JavaScript" })
    .textContent();
  step(
    "the first step's Results shows its count and its items",
    firstText.includes("2 items") && firstText.includes("one") && firstText.includes("two"),
    firstText,
  );

  // Options, on the step's own button: the server hands the step nothing.
  await second.getByRole("button", { name: "Options" }).click();
  await second.getByRole("checkbox", { name: "Ignore this action's input" }).click();
  await runIt.click();
  await results.getByText("given 0").waitFor({ timeout: 15_000 });
  step("with Ignore Input on, the server gives the step no items", true);
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "automator-step-parts.png"));

  await bar(page, "Action").click();
  await page.waitForTimeout(250);
  step(
    "the Action menu's Ignore Input row is checked for the step",
    (await page
      .getByRole("menuitemcheckbox", { name: "Ignore Input" })
      .getAttribute("aria-checked")) === "true",
  );
  await page.keyboard.press("Escape");

  // Saved with the workflow, and read back from the server.
  await page.getByRole("textbox", { name: "Workflow name" }).fill(NAME);
  await page.getByRole("button", { name: "Save Workflow" }).click();
  await page.getByText(`Saved “${NAME}”`).waitFor({ timeout: 10_000 });
  const stored = (await api(page, "GET", "/api/automator/workflows")).json.library.workflows.find(
    (workflow) => workflow.name === NAME,
  );
  step(
    "the server keeps the option on that step alone",
    stored.steps[0].ignore_input === undefined && stored.steps[1].ignore_input === true,
    JSON.stringify(stored.steps.map((each) => each.ignore_input ?? null)),
  );
  await reloadDesktop(page);
  await launch(page, "Automator");
  await steps.nth(1).waitFor({ timeout: 15_000 });
  await steps.nth(1).getByRole("button", { name: "Options" }).click();
  step(
    "after a reload the option is still on",
    await steps.nth(1).getByRole("checkbox", { name: "Ignore this action's input" }).isChecked(),
  );
});
