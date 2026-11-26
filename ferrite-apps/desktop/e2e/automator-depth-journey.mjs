#!/usr/bin/env node
// Automator at depth: actions dragged from the library to a place in the workflow, several at once,
// steps reordered by drag and taken out with Delete; the File, Edit, View, Workflow and Action menus
// and their keys, then that a saved workflow and the View choices survive a reload. Exits 0 only
// when every step passed with no console error, page error or failed request.
//
//   node e2e/automator-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("automator-depth", {
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});
const stamp = Date.now();
const NAME = `Depth ${stamp}`;

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
async function choose(page, title, ...items) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
  for (const [index, item] of items.entries()) {
    const entry = page.getByRole("menuitem", { name: item }).first();
    if (index < items.length - 1) {
      await entry.hover();
      await page.waitForTimeout(250);
    } else await entry.click();
  }
  await page.waitForTimeout(350);
}
async function menuRows(page, title) {
  await menuBar(page, title).click();
  await page.waitForTimeout(250);
  const rows = await page.getByRole("menu").getByRole("menuitem").allInnerTexts();
  return rows;
}
const closeMenu = async (page) => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
};
const workflows = async (page) =>
  (await api(page, "GET", "/api/automator/workflows")).json.library?.workflows ?? [];

await run(async (page) => {
  await openDesktop(page, base, step);
  const library = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.installed ?? []), "automator"])],
    rev: library.rev,
  });
  await reloadDesktop(page);
  await launch(page, "Automator");
  const window = page.locator('[data-window-id="automator"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  const actions = page.getByRole("grid", { name: "Actions" });
  await actions.waitFor({ state: "visible", timeout: 15_000 });
  await actions.getByText("Get Notes").waitFor({ state: "visible", timeout: 15_000 });
  const area = page.locator('section[aria-label="Workflow"]');
  const titles = async () =>
    area
      .locator('[role="group"]')
      .evaluateAll((groups) => groups.map((group) => group.getAttribute("aria-label")));
  const chosen = async () =>
    area
      .locator('[role="group"][aria-current="true"]')
      .evaluateAll((groups) => groups.map((group) => group.getAttribute("aria-label")));
  const stepOf = (title) => area.locator(`[role="group"][aria-label="${title}"]`);
  const head = (title) => stepOf(title).locator(".mac-automator-step-head");
  const row = (title) => actions.getByText(title, { exact: true });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const status = page.locator(".mac-automator-status");

  // Drag from the library into the empty workflow, then to the end and between.
  await row("Get Notes").dragTo(area);
  step(
    "an action dragged from the library lands in the empty workflow",
    same(await titles(), ["Get Notes"]),
    (await titles()).join(),
  );
  await row("Filter Items").dragTo(area, {
    targetPosition: { x: 200, y: (await area.boundingBox()).height - 5 },
  });
  step(
    "a second action dropped below goes last",
    same(await titles(), ["Get Notes", "Filter Items"]),
    (await titles()).join(),
  );
  await row("Combine Text").dragTo(head("Filter Items"), { targetPosition: { x: 80, y: 2 } });
  step(
    "an action dropped on the top half of a step goes before it",
    same(await titles(), ["Get Notes", "Combine Text", "Filter Items"]),
    (await titles()).join(),
  );
  await shot(page, path.join(out, "automator-drag-from-library.png"));

  // Several together, from a multiple selection.
  await row("Get Stickies").click();
  await row("Change Case of Text").click({ modifiers: ["ControlOrMeta"] });
  step(
    "Command-click selects several actions, and the description says how many",
    await window.getByText("2 Actions Selected").isVisible(),
  );
  await shot(page, path.join(out, "automator-library-several.png"));
  await row("Get Stickies").dragTo(head("Get Notes"), { targetPosition: { x: 80, y: 2 } });
  const afterSeveral = await titles();
  step(
    "several actions dragged together land together",
    same(afterSeveral.slice(0, 2).toSorted(), ["Change Case of Text", "Get Stickies"]) &&
      afterSeveral.length === 5,
    afterSeveral.join(),
  );

  // Reorder by the step's head: two steps moved up over Get Notes, which ends up last. The list is
  // taller than its pane, so the pane's bottom edge is not below the last step.
  await head("Combine Text").dragTo(head("Get Notes"), { targetPosition: { x: 80, y: 2 } });
  await head("Filter Items").dragTo(head("Get Notes"), { targetPosition: { x: 80, y: 2 } });
  const moved = await titles();
  step(
    "a step dragged by its head reorders",
    moved.at(-1) === "Get Notes" && moved.length === 5,
    moved.join(),
  );
  await shot(page, path.join(out, "automator-reorder.png"));
  // Taller without the log, so that the first step and the last are both in sight for the drag.
  await page.keyboard.press("Alt+ControlOrMeta+g");
  await head("Filter Items").click();
  await head("Get Notes").click({ modifiers: ["ControlOrMeta"] });
  step(
    "Command-click selects several steps",
    same(await chosen(), ["Filter Items", "Get Notes"]),
    (await chosen()).join(),
  );
  await shot(page, path.join(out, "automator-steps-several.png"));
  await head("Filter Items").dragTo(head(moved[0]), { targetPosition: { x: 80, y: 2 } });
  const together = await titles();
  step(
    "several steps dragged together move together",
    same(together.slice(0, 2), ["Filter Items", "Get Notes"]),
    together.join(),
  );

  // Delete key, then Undo and Redo by key and from the menu.
  await page.keyboard.press("Delete");
  step(
    "Delete takes the selected steps out",
    same(await titles(), together.slice(2)),
    (await titles()).join(),
  );
  await page.keyboard.press("ControlOrMeta+z");
  step("Command-Z brings them back", same(await titles(), together), (await titles()).join());
  await page.keyboard.press("ControlOrMeta+Shift+z");
  step(
    "Shift-Command-Z takes them out again",
    same(await titles(), together.slice(2)),
    (await titles()).join(),
  );
  await choose(page, "Edit", /^Undo/);
  step("Edit > Undo brings them back", same(await titles(), together), (await titles()).join());
  await choose(page, "Edit", /^Redo/);
  step(
    "Edit > Redo takes them out",
    same(await titles(), together.slice(2)),
    (await titles()).join(),
  );
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("Alt+ControlOrMeta+g");

  // Cut, Copy, Paste, by key and from the menu.
  await head("Filter Items").click();
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  step(
    "Command-C and Command-V paste a copy below the step",
    (await titles()).filter((title) => title === "Filter Items").length === 2 &&
      (await titles()).length === 6,
    (await titles()).join(),
  );
  await choose(page, "Edit", /^Cut/);
  step(
    "Edit > Cut takes the selected step out",
    (await titles()).filter((title) => title === "Filter Items").length === 1,
  );
  await head("Get Notes").click();
  await choose(page, "Edit", /^Paste/);
  const pasted = await titles();
  step(
    "Edit > Paste puts it below the selected step",
    pasted[pasted.indexOf("Get Notes") + 1] === "Filter Items" && pasted.length === 6,
    pasted.join(),
  );
  await shot(page, path.join(out, "automator-edit-paste.png"));
  await choose(page, "Edit", /^Copy/);
  step(
    "Edit > Copy says what it copied",
    (await status.innerText()) === "Copied 1 step.",
    await status.innerText(),
  );
  await choose(page, "Edit", /^Delete/);
  step("Edit > Delete takes the step out", (await titles()).length === 5);
  await choose(page, "Edit", /^Select All/);
  step("Edit > Select All selects every step", (await chosen()).length === 5);
  await page.keyboard.press("Escape");

  // In a text field the editing keys and the Edit menu are the text's.
  await head("Get Notes").click();
  const filter = stepOf("Filter Items").getByRole("textbox").first();
  await filter.fill("milk");
  await filter.press("Backspace");
  step(
    "Delete in a setting edits the text, not the steps",
    (await filter.inputValue()) === "mil" && (await titles()).length === 5,
  );
  await filter.selectText();
  await choose(page, "Edit", /^Copy/);
  step(
    "Edit > Copy in a setting copies the text",
    (await page.evaluate(() => navigator.clipboard.readText())) === "mil",
  );
  await filter.press("End");
  await choose(page, "Edit", /^Paste/);
  await page.waitForTimeout(300);
  step(
    "Edit > Paste in a setting pastes the text",
    (await filter.inputValue()) === "milmil",
    await filter.inputValue(),
  );
  await head("Get Notes").click();
  await page.keyboard.press("ControlOrMeta+z");
  step(
    "Undo on the steps takes back the paste, made after the keyboard left the setting",
    (await filter.inputValue()) === "mil",
    await filter.inputValue(),
  );
  await page.keyboard.press("ControlOrMeta+z");
  step(
    "a second Undo takes the typed setting back as one edit",
    (await filter.inputValue()) === "",
    await filter.inputValue(),
  );
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  step("Redo gives both back", (await filter.inputValue()) === "milmil", await filter.inputValue());
  await filter.pressSequentially("x");
  await head("Get Notes").click();
  await page.keyboard.press("ControlOrMeta+z");
  step(
    "typing after the keyboard left the setting is an Undo of its own",
    (await filter.inputValue()) === "milmil",
    await filter.inputValue(),
  );

  // The Action menu on the selected step.
  await head("Get Notes").click();
  const startAt = (await titles()).indexOf("Get Notes");
  await choose(page, "Action", /^Move Up/);
  step(
    "Action > Move Up moves the step up",
    (await titles()).indexOf("Get Notes") === startAt - 1,
    (await titles()).join(),
  );
  await choose(page, "Action", /^Move Down/);
  step("Action > Move Down moves it back", (await titles()).indexOf("Get Notes") === startAt);
  await choose(page, "Action", /^Disable/);
  step(
    "Action > Disable switches the step off",
    !(await stepOf("Get Notes").getByRole("checkbox", { name: "Enabled" }).isChecked()),
  );
  await choose(page, "Action", /^Enable/);
  step(
    "Action > Enable switches it on",
    await stepOf("Get Notes").getByRole("checkbox", { name: "Enabled" }).isChecked(),
  );
  await choose(page, "Action", /^Collapse/);
  step(
    "Action > Collapse hides the step's settings",
    (await stepOf("Get Notes").locator(".mac-automator-step-body").count()) === 0,
  );
  await shot(page, path.join(out, "automator-action-menu.png"));
  await choose(page, "Action", /^Expand/);
  step(
    "Action > Expand shows them",
    (await stepOf("Get Notes").locator(".mac-automator-step-body").count()) === 1,
  );
  await head("Change Case of Text").click();
  await choose(page, "Action", /^Delete/);
  step("Action > Delete takes the step out", !(await titles()).includes("Change Case of Text"));

  // Workflow: Run from Command-R on the server; the dimmed rows and their reason.
  await page.keyboard.press("ControlOrMeta+r");
  const log = page.getByRole("grid", { name: "Log" });
  await log
    .getByText(/Workflow (completed|failed|ended)|Workflow/)
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(500);
  const logged = await log.getByRole("row").allInnerTexts();
  step(
    "Command-R runs the workflow and logs its steps",
    logged.some((line) => line.includes("Get Notes")) && logged.length > 2,
    logged.join(" | ").slice(0, 200),
  );
  const workflowRows = await menuRows(page, "Workflow");
  step(
    "Workflow lists Run, Step, Stop and Record with the reason",
    ["Run", "Step", "Stop", "Record"].every((name) =>
      workflowRows.some((text) => text.startsWith(name)),
    ) && workflowRows.some((text) => text.includes("runs a workflow as a whole")),
    workflowRows.join(" | ").slice(0, 200),
  );
  await shot(page, path.join(out, "automator-workflow-menu.png"));
  await closeMenu(page);

  // File: save by key, New, Open..., Duplicate, Revert, Rename.
  await window.getByRole("textbox", { name: "Workflow name" }).fill(NAME);
  await head("Get Notes").click();
  await page.keyboard.press("ControlOrMeta+s");
  await status.getByText(`Saved “${NAME}”.`).waitFor({ state: "visible", timeout: 10_000 });
  let stored = await workflows(page);
  const steps = (await titles()).length;
  step(
    "Command-S saves the workflow on the server",
    stored.find((one) => one.name === NAME)?.steps.length === steps,
  );
  await row("Launch Application").dblclick();
  step("a further step is unsaved", (await titles()).length === steps + 1);
  await choose(page, "File", /^Revert To/, /^Last Saved/);
  step(
    "File > Revert To > Last Saved takes it away",
    (await titles()).length === steps,
    (await titles()).join(),
  );
  await choose(page, "File", /^Duplicate/);
  const nameField = window.getByRole("textbox", { name: "Workflow name" });
  step(
    "File > Duplicate makes a copy under a new name",
    (await nameField.inputValue()) === `${NAME} copy`,
  );
  await choose(page, "File", /^Save/);
  await status.getByText(`Saved “${NAME} copy”.`).waitFor({ state: "visible", timeout: 10_000 });
  stored = await workflows(page);
  step(
    "File > Save keeps the copy beside the original",
    stored.some((one) => one.name === NAME) && stored.some((one) => one.name === `${NAME} copy`),
  );
  await choose(page, "File", /^Rename/);
  await page.waitForTimeout(250);
  step(
    "File > Rename… gives the name field the keyboard",
    await nameField.evaluate((input) => document.activeElement === input),
  );
  await shot(page, path.join(out, "automator-file-rename.png"));
  await choose(page, "File", /^New/);
  await page
    .getByRole("dialog", { name: /Choose a type/ })
    .getByRole("button", { name: "Choose" })
    .click();
  await page.getByRole("dialog", { name: /Choose a type/ }).waitFor({ state: "detached" });
  step(
    "File > New starts an empty workflow",
    (await titles()).length === 0 && (await nameField.inputValue()) === "Untitled",
    await nameField.inputValue(),
  );
  await page.keyboard.press("ControlOrMeta+o");
  const sheet = page.getByRole("grid", { name: "Saved workflows" });
  await sheet.waitFor({ state: "visible", timeout: 5000 });
  await sheet.getByText(NAME, { exact: true }).click();
  await shot(page, path.join(out, "automator-file-open.png"));
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await status.getByText(`Opened “${NAME}”.`).waitFor({ state: "visible", timeout: 5000 });
  step(
    "Command-O opens a saved workflow from the sheet",
    (await titles()).length === steps && (await nameField.inputValue()) === NAME,
  );

  // View, by menu and by key, kept across a reload.
  await choose(page, "View", /^Hide Log/);
  step("View > Hide Log hides the lower pane", (await log.count()) === 0);
  await page.keyboard.press("Alt+ControlOrMeta+g");
  step("Option-Command-G shows it", (await log.count()) === 1);
  await page.keyboard.press("Alt+ControlOrMeta+g");
  await choose(page, "View", /^Hide Toolbar/);
  step(
    "View > Hide Toolbar hides the toolbar",
    (await window.getByRole("toolbar", { name: "Toolbar" }).count()) === 0,
  );
  const viewRows = await menuRows(page, "View");
  step(
    "View offers the Media Browser",
    viewRows.some((text) => text.includes("Media Browser")),
  );
  await shot(page, path.join(out, "automator-view-menu.png"));
  await closeMenu(page);
  await page.keyboard.press("Alt+ControlOrMeta+l");
  await page.waitForTimeout(300);
  step("Option-Command-L hides the library", !(await actions.isVisible()));
  await page.waitForTimeout(1200);
  await reloadDesktop(page);
  await launch(page, "Automator");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(1500);
  step(
    "the library, the log and the toolbar stay hidden across a reload",
    !(await actions.isVisible()) &&
      (await log.count()) === 0 &&
      (await window.getByRole("toolbar", { name: "Toolbar" }).count()) === 0,
  );
  await shot(page, path.join(out, "automator-view-after-reload.png"));
  await page.keyboard.press("Alt+ControlOrMeta+l");
  await page.waitForTimeout(300);
  await page.keyboard.press("Alt+ControlOrMeta+g");
  await choose(page, "View", /^Show Toolbar/);
  step(
    "the keys and the menu bring all three back",
    (await actions.isVisible()) &&
      (await log.count()) === 1 &&
      (await window.getByRole("toolbar", { name: "Toolbar" }).count()) === 1,
  );
  // Edit > Find > Search Library only: where Command reads as Control, as in this browser,
  // Control-Option-F is the window manager's full-screen chord, so the key is held by a unit test.
  const search = page.getByRole("searchbox", { name: "Search" });
  await area.click();
  await choose(page, "Edit", /^Find/, /^Search Library/);
  step(
    "Edit > Find > Search Library gives it the keyboard",
    await search.evaluate((input) => document.activeElement === input),
  );
  await shot(page, path.join(out, "automator-search-library.png"));
  stored = await workflows(page);
  step(
    "the saved workflows are still there after the reload",
    stored.some((one) => one.name === NAME) && stored.some((one) => one.name === `${NAME} copy`),
  );
});
