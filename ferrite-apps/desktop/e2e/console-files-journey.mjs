#!/usr/bin/env node
// Console's log files on a served desktop: File > Open… lists one in the sidebar with its rows parsed, it stays across a
// reload, the row's menu and File reveal it in Finder, a crash report opens here from Finder by a double click, a file
// dragged from Finder onto the window opens, Remove from Sidebar leaves the file, and Move to Trash takes it off the
// sidebar and back to the device. Exits 0 only when every step passed with no console error, page error, failed request or
// HTTP error.
//
//   node e2e/console-files-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const RUN = Date.now().toString(36);
const LOG = `journey-${RUN}.log`;
const CRASH = `journey-${RUN}.crash`;
const DRAGGED = `dragged-${RUN}.log`;
const OPENED = `opened-${RUN}.log`;
const SYSLOG = [
  `Oct  3 10:11:12 mac installd[412]: first line ${RUN}`,
  `Oct  3 10:11:13 mac kernel: second line ${RUN}`,
  `plain third line ${RUN}`,
  "",
].join("\n");

const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("console-files", async ({ page, base, out, step }) => {
  await openDesktop(page, base);
  const text = "text/plain";
  await uploadFile(page, { parent: "documents", name: LOG, type: text, text: SYSLOG });
  await uploadFile(page, {
    parent: "documents",
    name: CRASH,
    type: "application/octet-stream",
    text: `crash ${RUN}\n`,
  });
  await uploadFile(page, { parent: "documents", name: DRAGGED, type: text, text: `drag ${RUN}\n` });
  await uploadFile(page, {
    parent: "documents",
    name: OPENED,
    type: text,
    text: `opened ${RUN}\n`,
  });
  await reloadDesktop(page);
  const dock = (name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
  await dock("Console").click();
  const window = page.locator('[data-window-id="console"]');
  await window.waitFor({ timeout: 10_000 });
  const rows = () =>
    window
      .getByRole("grid", { includeHidden: true })
      .first()
      .locator('[role="row"][aria-selected]');

  await menu(page, "File");
  await page.getByRole("menuitem", { name: /^Open/ }).click();
  const panel = page.getByRole("dialog", { name: "Open", exact: true });
  await panel.waitFor({ timeout: 5_000 });
  await panel.getByText(LOG, { exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, "console-open-panel.png") });
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  await panel.waitFor({ state: "hidden" });
  await rows()
    .filter({ hasText: `first line ${RUN}` })
    .waitFor({ timeout: 8_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, "console-log-file.png") });
  const cells = (await rows().first().innerText()).replace(/\s+/g, " ");
  step("File > Open… lists the file's lines", (await rows().count()) === 3, cells);
  step(
    "a system log line gives its time and process, and adds no year",
    /Oct 3 10:11:12/.test(cells) && /installd/.test(cells) && !/20\d\d/.test(cells),
    cells,
  );
  await page.waitForTimeout(1_000);

  await reloadDesktop(page);
  await dock("Console").click();
  await window.waitFor({ timeout: 10_000 });
  await rows()
    .filter({ hasText: `second line ${RUN}` })
    .waitFor({ timeout: 8_000 });
  step("the file and the choice of it stay across a reload", (await rows().count()) === 3);

  // Reload reads the file again. The drive gives a replaced file a new id, which leaves the sidebar, so a changed file
  // under the same id is stood in for: the read answers with one word changed, the same length.
  await page.route("**/api/files/content/**", async (route) => {
    const reply = await route.fetch();
    const body = (await reply.text()).replace("plain third line", "plain fifth line");
    await route.fulfill({ response: reply, body });
  });
  await window
    .locator(".mac-toolbar-labelled-item")
    .filter({ hasText: "Reload" })
    .getByRole("button")
    .click();
  await rows()
    .filter({ hasText: `plain fifth line ${RUN}` })
    .waitFor({ timeout: 8_000 });
  await page.unroute("**/api/files/content/**");
  step("the toolbar's Reload reads an open file again", true);

  await window.getByText(LOG, { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Reveal in Finder" }).click();
  const finder = page.locator('.mac-managed-window[data-window-id^="finder"]').first();
  await finder.getByText(LOG, { exact: true }).first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "console-reveal.png") });
  step("the row's Reveal in Finder shows it in Finder", true);

  await finder.getByText(CRASH, { exact: true }).first().dblclick();
  await rows()
    .filter({ hasText: `crash ${RUN}` })
    .waitFor({ timeout: 8_000 });
  await window.getByText(CRASH, { exact: true }).waitFor();
  step("a double click on a crash report in Finder opens it in Console", true);

  await finder
    .locator("[data-window-state]")
    .first()
    .click({ position: { x: 200, y: 8 } });
  await page.waitForTimeout(300);
  await finder.getByText(OPENED, { exact: true }).first().dblclick();
  await rows()
    .filter({ hasText: `opened ${RUN}` })
    .waitFor({ timeout: 8_000 });
  await window.getByText(OPENED, { exact: true }).waitFor();
  step("a double click on a .log in Finder opens it in Console", true);
  await finder
    .locator("[data-window-state]")
    .first()
    .click({ position: { x: 200, y: 8 } });
  await page.waitForTimeout(300);
  await finder.getByText(OPENED, { exact: true }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open With" }).click();
  const textEditRow = page.getByRole("menuitem", { name: /^TextEdit/ }).first();
  await textEditRow.waitFor({ timeout: 3_000 });
  step("and TextEdit is still under Open With", await textEditRow.isVisible());
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await finder
    .locator("[data-window-state]")
    .first()
    .click({ position: { x: 200, y: 8 } });
  await page.waitForTimeout(300);
  // Finder moves left, so that a part of Console's window shows beside it.
  const frame = await finder.boundingBox();
  await page.mouse.move(frame.x + 300, frame.y + 10);
  await page.mouse.down();
  await page.mouse.move(frame.x + 100, frame.y + 10, { steps: 6 });
  await page.mouse.move(8 + 300, frame.y + 10, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const item = finder.getByText(DRAGGED, { exact: true }).first();
  const from = await item.boundingBox();
  const box = await window.boundingBox();
  const moved = await finder.boundingBox();
  const to = { x: (moved.x + moved.width + box.x + box.width) / 2, y: box.y + box.height / 2 };
  const icon = { x: from.x + from.width / 2, y: from.y - 30 };
  await page.mouse.move(icon.x, icon.y);
  await page.mouse.down();
  await page.mouse.move(icon.x + 12, icon.y + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, "console-drop.png") });
  await page.mouse.up();
  await window.getByText(DRAGGED, { exact: true }).waitFor({ timeout: 8_000 });
  await rows()
    .filter({ hasText: `drag ${RUN}` })
    .waitFor({ timeout: 8_000 });
  step("a log file dragged from Finder onto the window opens", true);

  await dock("Console").click();
  await page.waitForTimeout(400);
  await window.getByText(DRAGGED, { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove from Sidebar" }).click();
  await window.getByText(DRAGGED, { exact: true }).waitFor({ state: "detached", timeout: 5_000 });
  const kept = await page.evaluate(async (wanted) => {
    const drive = await fetch("/api/files/").then((reply) => reply.json());
    const entry = drive.entries.find((each) => each.name === wanted);
    return entry !== undefined && entry.trashed_ms === undefined;
  }, DRAGGED);
  step("Remove from Sidebar leaves the file on the drive, read back from it", kept);

  await window.getByText(LOG, { exact: true }).click();
  await rows()
    .filter({ hasText: `first line ${RUN}` })
    .waitFor({ timeout: 8_000 });
  await menu(page, "File");
  await page.getByRole("menuitem", { name: "Move to Trash" }).click();
  await window.getByText(LOG, { exact: true }).waitFor({ state: "detached", timeout: 8_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, "console-trashed.png") });
  const trashedAt = await page.evaluate(async (wanted) => {
    const drive = await fetch("/api/files/").then((reply) => reply.json());
    return drive.entries.find((each) => each.name === wanted)?.trashed_ms;
  }, LOG);
  step("Move to Trash puts it in the Trash and leaves the sidebar", typeof trashedAt === "number");
  step("the device's log is listed again", (await rows().count()) > 0);
});
