#!/usr/bin/env node
// Activity Monitor's everyday parts on a served desktop, each with a screenshot: the Applications view read from the
// window manager, search by name, a column's sort, arrow keys, Select All and Copy, the footer's summary and graph, Clear
// History, Help, and Quit Process from the toolbar through the same route as Force Quit. Exits 0 only when every step
// passed with no console error, page error, failed request or HTTP error.
//
//   node e2e/activity-monitor-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop } from "./journey-kit.mjs";

const dock = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}$`) }).first();
const menu = async (page, title) => {
  const item = page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  await item.click();
  await page.waitForTimeout(150);
  if ((await item.getAttribute("aria-expanded")) !== "true") await item.click();
};

await journey("activity-monitor-rows", async ({ page, base, out, step }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `am-rows-${name}.png`) });
  };
  await openDesktop(page, base);
  for (const name of ["Calculator", "Chess"]) {
    await dock(page, name).click();
    await page.locator(`[data-window-id="${name.toLowerCase()}"]`).waitFor({ timeout: 10_000 });
  }
  await dock(page, "Activity Monitor").click();
  const monitor = page.locator('[data-window-id="activity-monitor"]');
  await monitor.waitFor({ timeout: 10_000 });
  const grid = monitor.getByRole("grid", { name: "Applications" });
  await grid.getByText("Calculator").first().waitFor({ timeout: 10_000 });
  const rows = () => grid.locator('[role="row"][aria-selected]');
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  await shot("applications");
  const calculatorRow = rows().filter({ hasText: "Calculator" }).first();
  step(
    "Applications lists the windows the window manager holds",
    (await calculatorRow.getByRole("gridcell").allInnerTexts())[1]?.trim() === "1",
    (await calculatorRow.getByRole("gridcell").allInnerTexts()).join("|"),
  );

  const search = monitor.getByRole("searchbox").or(monitor.locator("input")).first();
  await search.fill("Chess");
  await page.waitForTimeout(300);
  await shot("search");
  const found = await rows().allInnerTexts();
  step("the search field keeps what matches", found.length === 1 && found[0].includes("Chess"));
  await search.fill("");
  await page.waitForTimeout(300);

  const heading = grid.getByRole("columnheader").first();
  await heading.click();
  await page.waitForTimeout(200);
  const top = await rows().first().innerText();
  await heading.click();
  await page.waitForTimeout(200);
  await shot("sorted");
  step("a heading sorts, and a second press reverses", (await rows().first().innerText()) !== top);

  await rows().first().click();
  const chosen = () => grid.locator('[role="row"][aria-selected="true"]').first().innerText();
  const first = await chosen();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  await shot("arrow");
  step("Arrow Down moves to the next row", (await chosen()) !== first);

  await menu(page, "Edit");
  await page.getByRole("menuitem", { name: /^Select All/ }).click();
  await page.waitForTimeout(450);
  await menu(page, "Edit");
  await shot("select-all");
  const selected = await grid.locator('[role="row"][aria-selected="true"]').count();
  step("Edit > Select All selects every row", selected === (await rows().count()), `${selected}`);
  await page.getByRole("menuitem", { name: /^Copy/ }).click();
  await page.waitForTimeout(300);
  const copied = await clipboard();
  step(
    "Edit > Copy gives the titles, then each selected row",
    copied.split("\n").length > selected &&
      copied.includes("Calculator") &&
      copied.includes("Chess"),
  );

  const summary = monitor.locator(":has(> .mac-activity-monitor-graph)");
  await monitor.getByRole("button", { name: "Ferrite" }).click();
  await summary.first().waitFor({ timeout: 5_000 });
  await page.waitForTimeout(500);
  await shot("footer");
  const footer = await summary.first().innerText();
  step(
    "the footer shows the instance and SERVER TIME",
    /Instance:/.test(footer) && /SERVER TIME/i.test(footer),
    footer.slice(0, 80),
  );
  // A long value is cut with an ellipsis, inside its cell, and its title holds it whole.
  const values = await summary.first().evaluate((node) =>
    [...node.querySelectorAll("dd")].map((cell) => ({
      text: cell.textContent,
      inCell:
        cell.getBoundingClientRect().right <= cell.parentElement.getBoundingClientRect().right + 1,
      fits: cell.scrollWidth <= cell.clientWidth + 1,
      cut: getComputedStyle(cell).textOverflow === "ellipsis",
      whole: cell.title,
    })),
  );
  step(
    "its values stay in their cells, and one that is cut keeps its whole text in its title",
    values.length > 0 &&
      values.every(
        (value) => value.inCell && (value.fits || (value.cut && value.whole.length > 0)),
      ),
    JSON.stringify(values.filter((value) => !value.fits)),
  );
  // The graph's points, read from the longest line it draws: a sample every two seconds.
  const samples = () =>
    monitor
      .getByRole("img", { name: /server time/i })
      .evaluate((plot) =>
        Math.max(
          0,
          ...[...plot.querySelectorAll("path, polyline")].map(
            (line) =>
              (line.getAttribute("d") ?? line.getAttribute("points") ?? "").split(/[LHV]/).length,
          ),
        ),
      );
  const samplesReach = async (least) => {
    for (let tries = 0; tries < 80 && (await samples()) < least; tries += 1) {
      await page.waitForTimeout(250);
    }
    return samples();
  };
  const before = await samplesReach(4);
  await menu(page, "View");
  await shot("view-menu");
  await page.getByRole("menuitem", { name: "Clear History" }).click();
  await page.waitForTimeout(400);
  const cleared = await samples();
  await shot("cleared");
  step(
    "View > Clear History empties the graph",
    before >= 4 && cleared < before,
    `${before} to ${cleared}`,
  );
  const after = await samplesReach(cleared + 2);
  step("and it fills again as time goes on", after >= cleared + 2, `${cleared} to ${after}`);

  await menu(page, "Help");
  await page.getByRole("menuitem", { name: "Activity Monitor Help" }).click();
  await page.locator('[data-window-id="help-viewer"]').waitFor({ timeout: 8_000 });
  await shot("help");
  step("Help opens Help Viewer", true);
  await page
    .locator('[data-window-id="help-viewer"]')
    .getByRole("button", { name: /close/i })
    .first()
    .click();
  await page.waitForTimeout(300);

  await dock(page, "Activity Monitor").click();
  await page.waitForTimeout(300);
  await monitor.getByRole("button", { name: "Applications" }).click();
  await page.waitForTimeout(300);
  await rows().filter({ hasText: "Calculator" }).first().click();
  await monitor.getByRole("button", { name: "Quit Process" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.waitFor({ timeout: 5_000 });
  await shot("quit-sheet");
  await sheet.getByRole("button", { name: "Quit", exact: true }).click();
  await page
    .locator('[data-window-id="calculator"]')
    .waitFor({ state: "detached", timeout: 5_000 });
  await rows()
    .filter({ hasText: "Calculator" })
    .first()
    .waitFor({ state: "detached", timeout: 8_000 });
  await shot("quit-done");
  step("the toolbar's Quit Process ends the application, as Force Quit does", true);
});
