#!/usr/bin/env node
// Activity Monitor's column order, its footer's instance name and Show in Console, on a served desktop. The instance name is
// the one thing here not from the server: the journey lengthens it in the reply, as a local server has none, to the name the
// hosted site gives. Exits 0 only when every step passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/activity-monitor-columns-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const RUN = Date.now().toString(36);
const LONG_INSTANCE = "demo/macalicious-desktop@g12@dw-a-m1:1971:1793352210263426737";
const SETTINGS = "/api/system-preferences/settings";

await journey("activity-monitor-columns", async ({ page, base, out, step }) => {
  const shot = async (name) => {
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `am-columns-${name}.png`) });
  };
  await page.route("**/api/activity-monitor/ferrite*", async (route) => {
    const reply = await route.fetch();
    const body = await reply.json();
    await route.fulfill({ response: reply, json: { ...body, instance: LONG_INSTANCE } });
  });
  await openDesktop(page, base);
  const dock = (name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
  const open = async () => {
    await dock("Activity Monitor").click();
    const shown = page.locator('[data-window-id="activity-monitor"]');
    await shown.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    return shown;
  };
  await dock("Calculator").click();
  await page.locator('[data-window-id="calculator"]').waitFor({ timeout: 10_000 });
  const monitor = await open();
  const headings = () => monitor.getByRole("columnheader").allInnerTexts();
  const heading = (name) => monitor.getByRole("columnheader", { name, exact: true });
  const calculator = monitor.getByRole("row").filter({ hasText: "Calculator" }).first();

  const start = await headings();
  step(
    "the columns start in their own order",
    start.join() === "Application Name,Windows,Minimized,On Quit",
    start.join(),
  );
  const from = await heading("On Quit").boundingBox();
  const to = await heading("Windows").boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 30, from.y + from.height / 2, { steps: 4 });
  await page.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 8 });
  await shot("dragging");
  step(
    "the heading follows the pointer",
    (await heading("On Quit").getAttribute("data-moving")) !== null,
  );
  await page.mouse.up();
  await page.waitForTimeout(400);
  await shot("moved");
  const moved = await headings();
  step(
    "dropped before Windows, it goes there",
    moved.join() === "Application Name,On Quit,Windows,Minimized",
    moved.join(),
  );
  const cells = await calculator.getByRole("gridcell").allInnerTexts();
  step(
    "the rows' cells follow their headings",
    cells[1] === "Quits" && Number(cells[2]) >= 1,
    JSON.stringify(cells),
  );
  step(
    "the drag does not sort by the column",
    (await heading("On Quit").getAttribute("aria-sort")) === "none",
  );

  await heading("Minimized").getByRole("button").focus();
  await page.keyboard.press("Alt+Shift+ArrowLeft");
  await page.waitForTimeout(300);
  const keyed = await headings();
  step(
    "Option-Shift-Left moves the focused heading",
    keyed.join() === "Application Name,On Quit,Minimized,Windows",
    keyed.join(),
  );
  await page.waitForTimeout(1_000);

  // A real touch, begun on the heading's button: its capture passes to the heading as it starts to move.
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const touchFrom = await heading("Windows").boundingBox();
  const touchTo = await heading("On Quit").boundingBox();
  const y = touchFrom.y + touchFrom.height / 2;
  const finger = (type, x) =>
    touch.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  await finger("touchStart", touchFrom.x + touchFrom.width / 2);
  await page.waitForTimeout(100);
  for (const x of [-20, -60, -120]) {
    await finger("touchMove", touchFrom.x + touchFrom.width / 2 + x);
    await page.waitForTimeout(50);
  }
  await finger("touchMove", touchTo.x + 5);
  await page.waitForTimeout(100);
  await finger("touchEnd");
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await page.waitForTimeout(400);
  const touched = await headings();
  step(
    "a finger drags a heading by its title too",
    touched.join() === "Application Name,Windows,On Quit,Minimized",
    touched.join(),
  );
  await heading("Windows").getByRole("button").focus();
  await page.keyboard.press("Alt+Shift+ArrowRight");
  await page.waitForTimeout(100);
  await page.keyboard.press("Alt+Shift+ArrowRight");
  await page.waitForTimeout(300);
  await page.waitForTimeout(1_000);
  await reloadDesktop(page);
  await open();
  const kept = await headings();
  step(
    "the order stays across a reload",
    kept.join() === "Application Name,On Quit,Minimized,Windows",
    kept.join(),
  );
  const stored = await page.evaluate(async (url) => {
    const reply = await fetch(url).then((each) => each.json());
    return reply.values?.["activity-monitor.column-order"]?.applications;
  }, SETTINGS);
  step(
    "and is what the server keeps for the account",
    stored?.join() === "name,kind,minimized,windows",
    stored?.join(),
  );

  await monitor.getByRole("button", { name: "Network" }).click();
  await monitor.getByTitle(LONG_INSTANCE).waitFor({ timeout: 10_000 });
  await shot("instance");
  const value = await monitor.getByTitle(LONG_INSTANCE).boundingBox();
  const label = await monitor.getByText("Instance:", { exact: true }).boundingBox();
  const graph = await monitor.locator(".mac-activity-monitor-graph").boundingBox();
  step(
    "a long instance name stays in its cell, beside its label, and shows what tells it from another",
    value.x + value.width <= graph.x &&
      label.x + label.width <= value.x &&
      label.width > 0 &&
      (await monitor.getByTitle(LONG_INSTANCE).innerText()) ===
        LONG_INSTANCE.slice(LONG_INSTANCE.lastIndexOf("@") + 1),
    `label ends ${label.x + label.width}, value ${value.x} to ${value.x + value.width}, graph at ${graph.x}`,
  );

  await monitor.getByRole("button", { name: "Applications" }).click();
  await page.waitForTimeout(300);
  // A request the server logs for each of two processes: this one's search must keep only Calculator's.
  const ownPath = `/api/calculator/journey-${RUN}`;
  const otherPath = `/api/notes/journey-${RUN}`;
  await page.request.get(new URL(ownPath, base).href);
  await page.request.get(new URL(otherPath, base).href);
  await calculator.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show in Console" }).click();
  const console = page.locator('[data-window-id="console"]');
  await console.waitFor({ timeout: 10_000 });
  const search = console.getByRole("searchbox").or(console.locator("input")).first();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-window-id="console"] input')].some(
        (field) => field.value === "process:calculator",
      ),
    undefined,
    { timeout: 8_000 },
  );
  const grid = console.getByRole("grid", { name: "Messages" });
  const rows = grid.locator('[role="row"][aria-selected]');
  await rows.filter({ hasText: ownPath }).first().waitFor({ timeout: 10_000 });
  await shot("console");
  step(
    "Show in Console opens Console on the process, with its message and not another's",
    (await search.inputValue()) === "process:calculator" &&
      (await rows.filter({ hasText: otherPath }).count()) === 0,
    await search.inputValue(),
  );

  await search.fill("process:finder error");
  await page.waitForTimeout(400);
  await dock("Activity Monitor").click();
  await page.waitForTimeout(400);
  const finder = monitor.getByRole("row").filter({ hasText: "Finder" }).first();
  await finder.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show in Console" }).click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-window-id="console"] input')].some(
        (field) => field.value === "process:finder",
      ),
    undefined,
    { timeout: 8_000 },
  );
  step(
    "with Console already open it takes the place of what was typed, a longer search included",
    (await search.inputValue()) === "process:finder",
    await search.inputValue(),
  );

  // A hyphenated app: the log names a process as the desktop names the app.
  const hyphenatedPath = `/api/activity-monitor/journey-${RUN}`;
  await page.request.get(new URL(hyphenatedPath, base).href);
  await dock("Activity Monitor").click();
  await page.waitForTimeout(400);
  await monitor
    .getByRole("row")
    .filter({ hasText: "Activity Monitor" })
    .first()
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show in Console" }).click();
  await rows.filter({ hasText: hyphenatedPath }).first().waitFor({ timeout: 10_000 });
  step(
    "a hyphenated app's messages are found too",
    (await search.inputValue()) === "process:activity-monitor",
    await search.inputValue(),
  );
});
