#!/usr/bin/env node
// Console's everyday parts on a served desktop, each with a screenshot: the toolbar's Now, Activities, Clear, Reload and Info,
// the scope bar, the device in the sidebar, a column's sort, Now letting go on a scroll, arrow keys in the table, and the
// search and Now across a reload. Exits 0 only when every step passed with no console error, page error, failed request or
// HTTP error.
//
//   node e2e/console-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import path from "node:path";
import { journey, openDesktop, reloadDesktop } from "./journey-kit.mjs";

const RUN = Date.now().toString(36);

await journey("console-rows", async ({ page, base, out, step }) => {
  const shot = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `console-rows-${name}.png`) });
  };
  await openDesktop(page, base);
  const open = async () => {
    await page
      .getByRole("button", { name: /^Console$/ })
      .first()
      .click();
    const shown = page.locator('[data-window-id="console"]');
    await shown.waitFor({ timeout: 10_000 });
    return shown;
  };
  const window = await open();
  const grid = window.getByRole("grid", { name: "Messages" });
  const rows = () => grid.locator('[role="row"][aria-selected]');
  await page.waitForTimeout(500);
  // Two of this page's own errors, so that the log has rows of a kind the scope bar tells apart from the server's.
  await page.evaluate((run) => {
    globalThis.dispatchEvent(new ErrorEvent("error", { message: `rows first ${run}` }));
    globalThis.dispatchEvent(new ErrorEvent("error", { message: `rows second ${run}` }));
  }, RUN);
  await rows()
    .filter({ hasText: `rows second ${RUN}` })
    .first()
    .waitFor({ timeout: 8_000 });

  await window.getByText("macalicious-desktop", { exact: false }).first().click();
  await page.waitForTimeout(200);
  await shot("device");
  step("the device in the sidebar lists the log", (await rows().count()) >= 2);

  const scope = window
    .getByRole("group", { name: "Show" })
    .or(window.getByRole("radiogroup", { name: "Show" }));
  const all = await rows().count();
  await scope.getByText("Errors and Faults").click();
  await page.waitForTimeout(300);
  await shot("errors");
  const errors = await rows().count();
  step("Errors and Faults keeps the errors", errors >= 2 && errors <= all, `${errors} of ${all}`);
  await scope.getByText("All Messages").click();
  await page.waitForTimeout(300);
  step("All Messages lists everything again", (await rows().count()) >= all);

  const toolbar = window.getByRole("toolbar", { name: "Toolbar" });
  const item = (label) =>
    toolbar
      .locator(".mac-toolbar-labelled-item")
      .filter({ hasText: label })
      .getByRole("button")
      .first();
  const pressed = (locator) => locator.getAttribute("aria-pressed");

  // Now starts on for a new account: off, then on again, is the press that selects the newest.
  if ((await pressed(item("Now"))) === "true") await item("Now").click();
  await page.waitForTimeout(150);
  await item("Now").click();
  await page.waitForTimeout(200);
  await shot("now");
  const on = await pressed(item("Now"));
  const selectedText = () => grid.locator('[role="row"][aria-selected="true"]').first().innerText();
  step("Now selects the newest message", on === "true" && (await selectedText()).length > 0);
  await grid.evaluate((node) => {
    const scroller = node.closest("[data-scroll-view]") ?? node;
    scroller.scrollTop = 0;
    scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -200, bubbles: true }));
  });
  const box = await grid.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(400);
  await shot("now-off");
  step("a scroll lets go of Now", (await pressed(item("Now"))) === "false");

  await item("Activities").click();
  await page.waitForTimeout(300);
  await shot("activities");
  step(
    "Activities turns on, and says the log records none",
    (await window.getByText("This desktop’s log records no activities.").isVisible()) &&
      (await pressed(item("Activities"))) === "true",
  );
  await item("Activities").click();
  await page.waitForTimeout(200);

  await rows().first().click();
  const firstText = await selectedText();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  await shot("arrow");
  step("Arrow Down moves to the next message", (await selectedText()) !== firstText);

  const details = window.getByRole("region", { name: "Message details" });
  const hadDetails = (await details.count()) > 0;
  await item("Info").click();
  await page.waitForTimeout(300);
  await shot("info");
  step("Info shows or hides the details", (await details.count()) > 0 !== hadDetails);
  await item("Info").click();
  await page.waitForTimeout(200);

  const heading = grid.getByRole("columnheader").first();
  await heading.click();
  await page.waitForTimeout(300);
  const sort = await heading.getAttribute("aria-sort");
  await shot("sorted");
  step("a heading sorts the table", sort === "ascending" || sort === "descending", `${sort}`);

  await item("Clear").click();
  await page.waitForTimeout(300);
  await shot("cleared");
  const left = await rows().count();
  step("Clear hides what was shown", left < all, `${left} of ${all}`);
  await item("Reload").click();
  await page.waitForTimeout(1_000);
  await shot("reloaded");
  step("Reload brings it back", (await rows().count()) > left, `${await rows().count()} rows`);

  const field = window.getByRole("searchbox").or(window.locator("input")).first();
  await field.fill(`rows second ${RUN}`);
  await page.waitForTimeout(1000);
  await reloadDesktop(page);
  const again = await open();
  await again.waitFor();
  const kept = again.getByRole("searchbox").or(again.locator("input")).first();
  await kept.waitFor({ timeout: 8_000 });
  await page.waitForTimeout(600);
  await shot("search-kept");
  step("the search comes back after a reload", (await kept.inputValue()) === `rows second ${RUN}`);
  step(
    "and Now stays as it was left",
    (await pressed(
      again
        .getByRole("toolbar", { name: "Toolbar" })
        .locator(".mac-toolbar-labelled-item")
        .filter({ hasText: "Now" })
        .getByRole("button")
        .first(),
    )) === "false",
  );
});
