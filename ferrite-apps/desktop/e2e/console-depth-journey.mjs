#!/usr/bin/env node
// Console's keys and menus on a served desktop: reports' statement, Command-K and Command-R, several
// messages selected and copied from the Edit menu, the keys and the row's menu, Get Info, Find, the
// View and Help menus. Exits 0 only when every step passed with no console error, page error, failed
// request or HTTP error.
//
//   node e2e/console-depth-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

const dock = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("console-depth", async ({ page, base, out, step }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  await openDesktop(page, base);
  await dock(page, "Console").click();
  const window = page.locator('[data-window-id="console"]');
  await window.waitFor();
  const grid = window.getByRole("grid", { name: "Messages" });
  await grid.locator("[data-console-message]").first().waitFor({ timeout: 15_000 });
  const rows = grid.locator("[role='row'][aria-selected]");
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  await window.getByRole("treeitem", { name: "Crash Reports" }).click();
  await window.getByText(/keeps no crash, spin or system logs/).waitFor();
  step("an empty report source says why it is empty", true);
  await window.getByRole("treeitem", { name: "macalicious-desktop" }).click();

  await rows.nth(0).click();
  await window.getByRole("button", { name: "Details" }).click();
  await window.getByText("This log records no process, thread or activity ID.").waitFor();
  step("Details says the log records no process ID instead of showing 0", true);

  await rows.nth(1).click({ modifiers: ["Control"] });
  await window.getByText("2 Messages Selected").waitFor();
  await menu(page, "Edit");
  await page.screenshot({ path: path.join(out, "console-edit-menu.png") });
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(100);
  let copied = await clipboard();
  step(
    "Edit > Copy copies both selected messages, a line each",
    copied.split("\n").length === 2 && copied.split("\n").every((line) => line.includes("\t")),
    copied,
  );

  await page.evaluate(() => navigator.clipboard.writeText("nothing"));
  await rows.nth(2).click();
  await page.keyboard.press("Control+c");
  await page.waitForTimeout(100);
  copied = await clipboard();
  step(
    "Command-C copies the selected message",
    copied.split("\n").length === 1 && copied !== "nothing",
  );

  await page.evaluate(() => navigator.clipboard.writeText("nothing"));
  await rows.nth(0).click({ button: "right" });
  await page.screenshot({ path: path.join(out, "console-row-menu.png") });
  await page.getByRole("menuitem", { name: "Copy" }).click();
  await page.waitForTimeout(100);
  step("the row's menu selects the row and copies it", (await clipboard()) !== "nothing");

  // Edit acts on the text that had the keyboard, not on the selected messages.
  const search = window.locator("input").first();
  await search.fill("words");
  await page.waitForTimeout(200);
  step("a search that matches nothing lists nothing", (await rows.count()) === 0);
  await search.selectText();
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(100);
  step(
    "with the search field in use, Edit > Copy copies its selected words",
    (await clipboard()) === "words",
    await clipboard(),
  );
  await search.evaluate((field) => field.setSelectionRange(0, 0));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(450);
  step(
    "and Edit > Select All selects them, not the messages",
    (await search.evaluate((field) => field.selectionEnd - field.selectionStart)) === 5 &&
      (await grid.locator("[role='row'][aria-selected='true']").count()) <= 1,
  );
  await search.fill("");
  await page.waitForTimeout(200);
  await rows.nth(0).click();
  const message = window.getByRole("textbox", { name: "Message" });
  await message.waitFor();
  const whole = await message.inputValue();
  await message.evaluate((field) => {
    field.focus();
    field.setSelectionRange(0, 3);
  });
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(100);
  step(
    "in the message's text, Edit > Copy copies the words chosen there",
    (await clipboard()) === whole.slice(0, 3),
    await clipboard(),
  );

  // The text goes with its pane: Edit is back on the messages, though no focus moved.
  await menu(page, "Action");
  await page.getByRole("menuitemcheckbox", { name: /^Get Info/ }).click();
  await window.getByRole("region", { name: "Message details" }).waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  await page.evaluate(() => navigator.clipboard.writeText("nothing"));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(100);
  step(
    "with the message's pane hidden, Edit > Copy copies the selected message",
    (await clipboard()).includes("\t"),
  );
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(300);
  const everyRow = await rows.count();
  step(
    "and Edit > Select All selects the listed messages",
    everyRow > 1 && (await grid.locator("[role='row'][aria-selected='true']").count()) === everyRow,
    `${everyRow} rows`,
  );
  await page.keyboard.press("Control+i");
  await window.getByRole("region", { name: "Message details" }).waitFor();

  // To a row and back to the search field: Edit follows the presses.
  await search.fill("");
  await search.click();
  await rows.nth(0).click();
  await search.fill("words");
  await search.click();
  await search.selectText();
  await page.evaluate(() => navigator.clipboard.writeText("nothing"));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(100);
  step(
    "back in the search field after a row, Edit > Copy copies its words",
    (await clipboard()) === "words",
    await clipboard(),
  );
  await search.evaluate((field) => field.setSelectionRange(0, 0));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(450);
  step(
    "and Edit > Select All its whole text",
    (await search.evaluate((field) => field.selectionEnd - field.selectionStart)) === 5,
  );
  await search.fill("");
  await page.waitForTimeout(200);

  await rows.nth(0).click();
  await page.evaluate(() => navigator.clipboard.writeText("nothing"));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(100);
  step("back on the messages, Edit > Copy copies the message", (await clipboard()).includes("\t"));

  const details = window.getByRole("region", { name: "Message details" });
  await page.keyboard.press("Control+i");
  await details.waitFor({ state: "detached" });
  await page.keyboard.press("Control+i");
  await details.waitFor();
  step("Command-I hides and shows the detail pane", true);

  await page.keyboard.press("Control+f");
  // The field takes the keyboard once a menu would have faded, 300 ms on.
  await page.waitForTimeout(450);
  const field = window.getByRole("searchbox");
  step(
    "Command-F takes the search field",
    await field.evaluate((element) => element === document.activeElement),
  );
  await field.fill("abc");
  await page.keyboard.press("Control+a");
  await page.waitForTimeout(100);
  step(
    "in the search field Command-A selects its text",
    await field.evaluate((element) => element.selectionEnd - element.selectionStart === 3),
  );
  await field.fill("");

  await rows.first().click();
  await page.keyboard.press("Control+a");
  await page.waitForTimeout(100);
  step(
    "Command-A selects every message",
    (await window.getByText(/^\d+ Messages Selected$/).count()) === 1,
  );

  await page.keyboard.press("Control+k");
  await window
    .getByText("Console (0 messages)")
    .first()
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
  const cleared = await rows.count();
  await page.keyboard.press("Control+r");
  await rows.first().waitFor({ timeout: 5_000 });
  step(
    "Command-K clears the list and Command-R brings it back",
    cleared <= 1,
    `after clear: ${cleared}`,
  );

  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Hide Sidebar" }).click();
  await window.getByRole("treeitem", { name: "Crash Reports" }).waitFor({ state: "hidden" });
  await menu(page, "View");
  await page.getByRole("menuitem", { name: "Show Sidebar" }).click();
  await window.getByRole("treeitem", { name: "Crash Reports" }).waitFor({ state: "visible" });
  step("View hides and shows the sidebar", true);

  await menu(page, "Help");
  await page.getByRole("menuitem", { name: "Console Help" }).click();
  await page.locator('[data-window-id="help-viewer"]').waitFor({ timeout: 5_000 });
  step("Console Help opens Help Viewer", true);
});
