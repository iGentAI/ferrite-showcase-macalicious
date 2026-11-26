#!/usr/bin/env node
// System Information's menus on a served desktop: the Hardware and Network statements, Copy of the
// report, Refresh Information counting a new request, Save to the drive read back, Print's frame, the
// Applications list, Fonts and Logs, and the category kept across a reload. Exits 0 only when every step passed with
// no console error, page error, failed request or HTTP error.
//
//   node e2e/system-information-depth-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};
const open = async (page) => {
  await page
    .getByRole("button", { name: /^System Information$/ })
    .first()
    .click();
  const window = page.locator('[data-window-id="system-information"]');
  await window.waitFor({ timeout: 10_000 });
  return window;
};

await journey("system-information-depth", async ({ page, base, out, step }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  await openDesktop(page, base);
  let window = await open(page);
  const outline = window.getByRole("treegrid", { name: "Categories" });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  await outline.getByText("Hardware", { exact: true }).click();
  await window.getByText(/Not available to a web page/).waitFor();
  await page.screenshot({ path: path.join(out, "system-information-hardware.png") });
  step("Hardware says what a web page cannot read", true);

  await outline.getByText("Network", { exact: true }).click();
  await window.getByText("Online:").waitFor();
  step("Network reports the connection", true);

  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(100);
  step("Edit > Copy copies the report", (await clipboard()).startsWith("Network\n"));

  await window.getByText("Online:").dblclick();
  const chosen = await page.evaluate(() => document.getSelection().toString());
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(100);
  step(
    "Edit > Copy copies selected report text alone",
    chosen !== "" && (await clipboard()) === chosen,
    chosen,
  );

  await outline.getByText("Ferrite Application", { exact: true }).click();
  await window.getByText("Server Clock:").waitFor();
  const clock = async () => (await window.innerText()).match(/Server Clock:\s*(.+)/)?.[1] ?? "";
  const before = await clock();
  await page.waitForTimeout(1100);
  await menu(page, "File");
  await page.screenshot({ path: path.join(out, "system-information-file-menu.png") });
  const asked = page.waitForResponse((response) =>
    response.url().includes("/api/system-information/report"),
  );
  await page.getByRole("menuitem", { name: "Refresh Information" }).click();
  await asked;
  await page.waitForTimeout(300);
  const after = await clock();
  step(
    "Refresh Information reads the report again",
    after !== "" && after !== before,
    `${before} to ${after}`,
  );

  await outline.getByText("App Modules", { exact: true }).click();
  await window.getByRole("grid", { name: "App Modules" }).waitFor();

  await page.keyboard.press("Control+s");
  const sheet = page.getByRole("dialog", { name: "Save" });
  await sheet.waitFor({ timeout: 5_000 });
  const named = `journey-report-${Date.now()}.txt`;
  const field = sheet.getByRole("textbox", { name: /Save As/ });
  await field.fill(named);
  await field.selectText();
  await page.keyboard.press("Control+c");
  await page.waitForTimeout(100);
  step("in the Save As field Command-C copies the selected name", (await clipboard()) === named);
  await page.evaluate(() => navigator.clipboard.writeText("nothing"));
  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(100);
  step("Edit > Copy copies the selected name too", (await clipboard()) === named);
  const put = page.waitForResponse(
    (response) =>
      /\/api\/files\/uploads/.test(response.url()) && response.request().method() === "POST",
  );
  await sheet.getByRole("button", { name: "Save" }).click();
  await put;
  await sheet.waitFor({ state: "hidden" });
  await page.waitForTimeout(800);
  const contents = await page.evaluate(async (name) => {
    const find = (value) => {
      if (Array.isArray(value)) return value.map(find).find(Boolean);
      if (value && typeof value === "object")
        return value.name === name ? value : Object.values(value).map(find).find(Boolean);
      return undefined;
    };
    const drive = await fetch("/api/files/").then((reply) => reply.json());
    const entry = find(drive);
    if (!entry) return "";
    const reply = await fetch(`/api/files/content/${encodeURIComponent(entry.id)}?piece=0&count=8`);
    return reply.text();
  }, named);
  step(
    "Command-S saves the shown report on the drive, read back from it",
    contents.startsWith("App Modules\n\nModule\tRoute\tRequests\n"),
    contents.slice(0, 40),
  );

  await page.evaluate(() => {
    globalThis.__printed = "";
    const append = Element.prototype.append;
    Element.prototype.append = function (...nodes) {
      for (const node of nodes) {
        if (node?.dataset && "texteditPrint" in node.dataset) globalThis.__printed = node.srcdoc;
      }
      return append.apply(this, nodes);
    };
  });
  await page.keyboard.press("Control+p");
  await page.waitForTimeout(200);
  const printed = await page.evaluate(() => globalThis.__printed);
  step("Command-P prints the report alone", printed.includes("Module\tRoute\tRequests"));
  await page.evaluate(() => {
    for (const frame of document.querySelectorAll("iframe[data-textedit-print]")) frame.remove();
  });

  await outline.getByText("Applications", { exact: true }).click();
  const apps = window.getByRole("grid", { name: "Applications" });
  await apps.getByRole("row").nth(1).waitFor({ timeout: 10_000 });
  const listed = Number(await apps.getAttribute("aria-rowcount"));
  step("Applications lists the desktop's applications", listed > 30, `${listed} rows`);

  await outline.getByText("Fonts", { exact: true }).click();
  await page.waitForTimeout(300);
  step(
    "Fonts lists what the page loaded, and says it cannot list the computer's",
    /cannot list your computer's fonts|Font loaded by this page/.test(await window.innerText()),
  );
  await page.screenshot({ path: path.join(out, "system-information-fonts.png") });
  await outline.getByText("Logs", { exact: true }).click();
  const logs = window.getByRole("grid", { name: "Logs" });
  await logs.getByRole("row").nth(1).waitFor({ timeout: 10_000 });
  step(
    "Logs lists the server's log",
    Number(await logs.getAttribute("aria-rowcount")) > 1,
    `${await logs.getAttribute("aria-rowcount")} rows`,
  );
  await page.screenshot({ path: path.join(out, "system-information-logs.png") });
  await outline.getByText("Applications", { exact: true }).click();
  await apps.getByRole("row").nth(1).waitFor({ timeout: 10_000 });

  await page.waitForTimeout(800);
  await reloadDesktop(page);
  window = await open(page);
  await window.getByRole("grid", { name: "Applications" }).waitFor({ timeout: 10_000 });
  step("the category comes back after a reload", true);

  await menu(page, "Help");
  await page.getByRole("menuitem", { name: "System Information Help" }).click();
  await page.locator('[data-window-id="help-viewer"]').waitFor({ timeout: 5_000 });
  step("System Information Help opens Help Viewer", true);
  await page
    .locator('[data-window-id="help-viewer"]')
    .getByRole("button", { name: "close", exact: false })
    .first()
    .click()
    .catch(() => {});
  await window.click({ position: { x: 300, y: 10 } });

  await page.keyboard.press("Control+f");
  const findField = window.getByRole("textbox", { name: "Find in the report" });
  await findField.waitFor();
  await page.waitForTimeout(400);
  step(
    "Command-F takes the find field",
    await findField.evaluate((el) => el === document.activeElement),
  );
  await findField.fill("session storage");
  await findField.press("Enter");
  const findsIt = await window
    .getByRole("group", { name: "Path" })
    .getByText(/Session Storage/)
    .waitFor({ timeout: 3_000 })
    .then(
      () => true,
      () => false,
    );
  step("Find goes to the category that holds the words", findsIt);
  await page.screenshot({ path: path.join(out, "si-find.png") });
  await findField.fill("no such words here");
  await findField.press("Enter");
  step("Find says when nothing holds them", await window.getByText("Not found").isVisible());
  await findField.press("Escape");
  await findField.waitFor({ state: "detached" });

  const outlineNow = window
    .getByRole("treegrid", { name: "Categories" })
    .or(window.getByRole("tree", { name: "Categories" }))
    .first();
  const software = outlineNow
    .getByRole("row", { name: /Software/ })
    .or(outlineNow.getByRole("treeitem", { name: /Software/ }))
    .first();
  const applications = outlineNow.getByText("Applications", { exact: true });
  await software.click();
  await page.keyboard.press("ArrowLeft");
  await applications.waitFor({ state: "detached" });
  const divider = window.getByRole("separator", { name: "Resize the category list" });
  const box = await divider.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const moved = (await divider.boundingBox()).x;
  step("the divider moves the outline's edge", moved > box.x + 30, `${box.x} to ${moved}`);
  await page.waitForTimeout(800);

  await reloadDesktop(page);
  window = await open(page);
  const again = window.getByRole("separator", { name: "Resize the category list" });
  await again.waitFor();
  step(
    "after a reload the collapsed row and the divider are as they were",
    Math.abs((await again.boundingBox()).x - moved) < 40 &&
      (await window.getByText("Applications", { exact: true }).count()) === 0,
    `${(await again.boundingBox()).x} against ${moved}`,
  );
});
