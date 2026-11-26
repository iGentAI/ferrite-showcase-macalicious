#!/usr/bin/env node
// Automator's File rows, a step's context menu and Speech on the served desktop: Open Recent, Print,
// the question before Delete, and the rows of the Action menu on a secondary click. It signs in as a
// new guest. Exits 0 only when every step passed with no console error, page error or failed request.
//
// Stand-ins: spies on the print frame's `print` and on `speechSynthesis.speak` stand for the dialog
// and the voice.
//
//   node e2e/automator-rows-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("automator-rows");
const stamp = Date.now();
const FIRST = `First ${stamp}`;
const SECOND = `Second ${stamp}`;

const bar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
const row = (page, name) => page.getByRole("menuitem", { name }).first();
async function choose(page, title, name) {
  await bar(page, title).click();
  await page.waitForTimeout(250);
  await row(page, name).click();
  await page.waitForTimeout(300);
}
async function chooseIn(page, title, submenu, name) {
  await bar(page, title).click();
  await page.waitForTimeout(250);
  await row(page, submenu).hover();
  await page.waitForTimeout(300);
  await row(page, name).click();
  await page.waitForTimeout(300);
}

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
  const nameField = page.getByRole("textbox", { name: "Workflow name" });
  const steps = page.locator('section[aria-label="Workflow"] [role="group"]');

  // Two saved workflows make Open Recent.
  await nameField.fill(FIRST);
  await actions.getByText("Get Notes", { exact: true }).dblclick();
  await page.keyboard.press("ControlOrMeta+S");
  await page.getByText(`Saved “${FIRST}”`).waitFor({ timeout: 10_000 });
  await choose(page, "File", /^New/);
  await page
    .getByRole("dialog", { name: /Choose a type/ })
    .getByRole("button", { name: "Choose" })
    .click();
  await page.getByRole("dialog", { name: /Choose a type/ }).waitFor({ state: "detached" });
  await nameField.fill(SECOND);
  await actions.getByText("Get Notes", { exact: true }).dblclick();
  await page.keyboard.press("ControlOrMeta+S");
  await page.getByText(`Saved “${SECOND}”`).waitFor({ timeout: 10_000 });
  await bar(page, "File").click();
  await page.waitForTimeout(250);
  await row(page, "Open Recent").hover();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "automator-open-recent.png"));
  await row(page, FIRST).click();
  await page.waitForTimeout(400);
  step("File > Open Recent opens the workflow", (await nameField.inputValue()) === FIRST);

  // A step's context menu.
  await steps.first().locator(".mac-automator-step-name").click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Step commands" });
  await menu.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "automator-step-menu.png"));
  await menu.getByRole("menuitem", { name: "Disable" }).click();
  await page.waitForTimeout(300);
  step(
    "a step's menu disables it",
    (await page.locator(".mac-automator-step").first().getAttribute("data-enabled")) === "false",
  );

  // Print, with a spy for the dialog.
  await page.evaluate(() => {
    window.__printed = [];
    new MutationObserver(() => {
      const frame = document.querySelector("iframe[data-textedit-print]");
      if (!frame || frame.__spied) return;
      frame.__spied = true;
      frame.addEventListener(
        "load",
        () => {
          frame.contentWindow.print = () => {
            window.__printed.push(frame.contentDocument.body.textContent);
          };
        },
        { capture: true },
      );
    }).observe(document.body, { childList: true });
  });
  await choose(page, "File", /^Print/);
  await page.waitForTimeout(400);
  const printed = (await page.evaluate(() => window.__printed.at(-1))) ?? "";
  step(
    "File > Print calls print on the workflow's name and steps",
    printed.includes(FIRST) && printed.includes("Get Notes") && printed.includes("(disabled)"),
    printed.slice(0, 80),
  );

  // Speech, with a spy for the voice.
  await page.evaluate(() => {
    window.__spoken = [];
    window.speechSynthesis.speak = (utterance) => window.__spoken.push(utterance.text);
  });
  await chooseIn(page, "Edit", "Speech", /^Start Speaking/);
  step(
    "Edit > Speech reads the workflow's steps",
    ((await page.evaluate(() => window.__spoken.at(-1))) ?? "").includes("Get Notes"),
  );

  // The question before Delete.
  await page.keyboard.press("ControlOrMeta+S");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Delete Workflow" }).click();
  const question = page.getByRole("dialog").filter({ hasText: "Delete the workflow" });
  await question.waitFor({ timeout: 5_000 });
  await shot(page, path.join(out, "automator-delete-question.png"));
  await question.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);
  step("Delete asks first, and Cancel keeps it", (await nameField.inputValue()) === FIRST);
  await page.getByRole("button", { name: "Delete Workflow" }).click();
  await question.getByRole("button", { name: "Delete" }).click();
  await page.getByText(`Deleted “${FIRST}”`).waitFor({ timeout: 10_000 });
  await bar(page, "File").click();
  await page.waitForTimeout(250);
  await row(page, "Open Recent").hover();
  await page.waitForTimeout(300);
  step(
    "a deleted workflow leaves Open Recent",
    (await page.getByRole("menuitem", { name: FIRST }).count()) === 0 &&
      (await page.getByRole("menuitem", { name: SECOND }).count()) === 1,
  );
  await row(page, "Clear Menu").click();
  await page.waitForTimeout(300);
  await reloadDesktop(page);
  await page.waitForTimeout(1500);
  await launch(page, "Automator");
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 15_000 });
  await bar(page, "File").click();
  await page.waitForTimeout(250);
  step(
    "Clear Menu stays clear after a reload",
    (await row(page, "Open Recent").getAttribute("aria-disabled")) === "true",
  );
});
