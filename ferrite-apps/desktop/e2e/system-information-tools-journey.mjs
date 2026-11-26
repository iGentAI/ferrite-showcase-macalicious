#!/usr/bin/env node
// System Information's rows and report commands on a served desktop: several rows chosen with Command and Shift, Copy of
// those rows, Select All, the report's context menu, the dimmed Send to Apple statement, Edit's Cut and Paste in the find
// field, and Window > About This Mac. Exits 0 only when every step passed with no console error, page error, failed
// request or HTTP error.
//
//   node e2e/system-information-tools-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("system-information-tools", async ({ page, base, out, step }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  await openDesktop(page, base);
  await page
    .getByRole("button", { name: /^System Information$/ })
    .first()
    .click();
  const window = page.locator('[data-window-id="system-information"]');
  await window.waitFor({ timeout: 10_000 });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const outline = window.getByRole("treegrid", { name: "Categories" });
  await outline.getByText("Applications", { exact: true }).click();
  const table = window.getByRole("grid", { name: "Applications", includeHidden: true });
  await table.waitFor();
  const rows = table.locator('[role="row"][aria-selected]');
  const chosen = () => table.locator('[role="row"][aria-selected="true"]').count();
  const nameOf = async (row) => (await row.getByRole("gridcell").first().innerText()).trim();
  const [first, second, third] = [rows.nth(0), rows.nth(1), rows.nth(2)];
  const firstName = await nameOf(first);
  const thirdName = await nameOf(third);

  await first.click();
  await third.click({ modifiers: ["Meta"] });
  step("Command-click adds a row", (await chosen()) === 2, String(await chosen()));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(150);
  const two = (await clipboard()).split("\n");
  step(
    "Edit > Copy copies the chosen rows under the column titles",
    two.length === 3 && two[1].startsWith(firstName) && two[2].startsWith(thirdName),
    two.join(" | "),
  );
  await page.screenshot({ path: path.join(out, "system-information-rows.png") });

  await first.click();
  await second.click({ modifiers: ["Shift"] });
  step("Shift-click extends to a range", (await chosen()) === 2);

  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(500);
  const all = await chosen();
  step("Edit > Select All chooses every shown row", all === (await rows.count()), String(all));

  await first.click();
  await third.click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: "Copy", exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, "system-information-context.png") });
  const after = await chosen();
  step("a secondary click outside the selection chooses that row", after === 1, String(after));
  await page.getByRole("menu").getByRole("menuitem", { name: "Copy", exact: true }).click();
  await page.waitForTimeout(150);
  const one = (await clipboard()).split("\n");
  step(
    "the context menu's Copy copies that row",
    one.length === 2 && one[1].startsWith(thirdName),
    one.join(" | "),
  );

  await outline.getByText("Network", { exact: true }).click();
  const online = window.getByText("Online:");
  await online.waitFor();
  await online.click({ button: "right" });
  await page.getByRole("menu").getByRole("menuitem", { name: "Select All", exact: true }).click();
  await page.waitForTimeout(500);
  const selection = await page.evaluate(() => document.getSelection().toString());
  step(
    "Select All in a report selects its text",
    selection.includes("Online:"),
    selection.slice(0, 60),
  );

  await menu(page, "File");
  const send = page.getByRole("menuitem", { name: /^Send to Apple/ });
  await send.waitFor();
  const why = page.getByRole("menuitem", { name: "A web page cannot send a report to Apple." });
  await why.waitFor();
  step(
    "File > Send to Apple is dimmed and says why",
    (await send.getAttribute("aria-disabled")) === "true",
  );
  await page.screenshot({ path: path.join(out, "system-information-send.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await window.locator("[role='treegrid']").click({ position: { x: 40, y: 8 } });
  await menu(page, "Edit");
  const cut = page.getByRole("menuitem", { name: /^Cut/ });
  await cut.waitFor();
  step(
    "Cut and Paste are dimmed outside a text field",
    (await cut.getAttribute("aria-disabled")) === "true" &&
      (await page.getByRole("menuitem", { name: /^Paste/ }).getAttribute("aria-disabled")) ===
        "true",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.keyboard.press("Control+f");
  const field = window.getByRole("textbox", { name: "Find in the report" });
  await field.waitFor();
  await field.fill("Online");
  await field.selectText();
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Cut/ }).click();
  await page.waitForTimeout(600);
  step(
    "Edit > Cut cuts the find field's text",
    (await field.inputValue()) === "" && (await clipboard()) === "Online",
    await field.inputValue(),
  );
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Paste/ }).click();
  await page.waitForTimeout(600);
  step("Edit > Paste pastes into it", (await field.inputValue()) === "Online");

  await page.evaluate(() => {
    window.__write = navigator.clipboard.writeText;
    navigator.clipboard.writeText = () => Promise.reject(new Error("refused"));
    window.__exec = document.execCommand;
    document.execCommand = (name, ...rest) =>
      name === "copy" ? false : window.__exec.call(document, name, ...rest);
  });
  await field.selectText();
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Cut/ }).click();
  await page.waitForTimeout(600);
  step("a refused Cut leaves the field's text", (await field.inputValue()) === "Online");
  await page.evaluate(() => {
    navigator.clipboard.writeText = window.__write;
    document.execCommand = window.__exec;
  });

  await menu(page, "Window");
  await page.getByRole("menuitem", { name: "About This Mac", exact: true }).click();
  await page.locator('[data-window-id="about-this-mac"]').waitFor({ timeout: 5_000 });
  step("Window > About This Mac opens it", true);
});
