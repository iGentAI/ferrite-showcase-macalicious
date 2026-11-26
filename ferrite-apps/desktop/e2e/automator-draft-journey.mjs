#!/usr/bin/env node
// Automator's workflow across a reload: unsaved steps and a name come back, as edited; a saved one
// comes back open.
//
//   node e2e/automator-draft-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("automator-draft");
const NAME = `Kept ${Date.now()}`;
const LONG = "café long words ".repeat(500);

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  const open = async () => {
    await launch(page, "Automator");
    const actions = page.getByRole("grid", { name: "Actions" });
    await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 15_000 });
    return actions;
  };
  const actions = await open();
  const steps = () =>
    page
      .locator('section[aria-label="Workflow"] [role="group"]')
      .evaluateAll((groups) => groups.map((group) => group.getAttribute("aria-label")));
  const nameField = page.getByRole("textbox", { name: "Workflow name" });
  await nameField.fill(NAME);
  await actions.getByText("Get Notes", { exact: true }).dblclick();
  // No wait: a reload straight after a change keeps it.
  await reloadDesktop(page);
  await open();
  await page.waitForFunction(
    () => document.querySelector('section[aria-label="Workflow"] [role="group"]') !== null,
    undefined,
    { timeout: 15_000 },
  );
  step("an unsaved step comes back after a reload", (await steps()).includes("Get Notes"));
  step("and the name typed", (await nameField.inputValue()) === NAME);
  await page
    .locator('section[aria-label="Workflow"] input:not([type="checkbox"])')
    .first()
    .fill(LONG);
  await reloadDesktop(page);
  await open();
  await page.waitForFunction(
    (wanted) =>
      document.querySelector('section[aria-label="Workflow"] input:not([type="checkbox"])')
        ?.value === wanted,
    LONG,
    { timeout: 15_000 },
  );
  step("a workflow larger than one setting comes back whole", true, `${LONG.length} characters`);
  await shot(page, path.join(out, "automator-draft.png"));

  await page.keyboard.press("ControlOrMeta+S");
  await page.getByText(`Saved “${NAME}”`).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await open();
  await page.waitForFunction(
    () => document.querySelector('section[aria-label="Workflow"] [role="group"]') !== null,
    undefined,
    { timeout: 15_000 },
  );
  step("a saved workflow comes back open", (await nameField.inputValue()) === NAME);

  const { json } = await api(page, "GET", "/api/automator/workflows");
  step(
    "and is the one on the server",
    json.library?.workflows?.some((each) => each.name === NAME) === true,
  );
});
