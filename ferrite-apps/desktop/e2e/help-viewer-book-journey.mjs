#!/usr/bin/env node
// Help Viewer's books and what it keeps: the Book pop-up, results limited to one book, the contents
// row menu, and the history and open rows after a reload.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/help-viewer-book-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("help-viewer-book");

const visible = (locator) =>
  locator.waitFor({ state: "visible", timeout: 6000 }).then(
    () => true,
    () => false,
  );

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Help Viewer");
  const viewer = page.locator('[data-window-id="help-viewer"]');
  await viewer.waitFor({ state: "visible", timeout: 10_000 });
  await viewer.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 10_000 });
  const barTitle = (title) =>
    page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
  const heading = (name) => viewer.getByRole("heading", { level: 1, name, exact: true });
  const contents = viewer.getByRole("treegrid", { name: "Table of Contents" });
  const book = viewer.getByRole("combobox", { name: "Book" });
  const back = viewer.getByRole("button", { name: "Back" });

  // Whatever an earlier run on this account left: the guide's welcome page.
  await barTitle("Go").click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Home", exact: true }).click();
  step(
    "the Book pop-up names the guide on its welcome page",
    await visible(book.filter({ hasText: "macOS User Guide" })),
  );

  await book.click();
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "help-viewer-book-switcher.png"));
  await page.getByRole("option", { name: "Macalicious Desktop Help" }).click();
  step("choosing a book opens its page", await visible(heading("Macalicious Desktop Help")));
  step(
    "the pop-up now names that book",
    await visible(book.filter({ hasText: "Macalicious Desktop Help" })),
  );
  step(
    "the window's title names it too",
    await visible(viewer.locator(".mac-title-bar").getByText("Macalicious Desktop Help").first()),
  );
  const topicRow = contents.getByText("Notes, Reminders and Stickies that stay");
  step("its row is open in the contents", await visible(topicRow));

  await topicRow.click();
  const topic = heading("Notes, Reminders and Stickies that stay");
  step("a topic of the book opens", await visible(topic));

  // The contents' row menu.
  await contents.getByText("Basics", { exact: true }).click({ button: "right" });
  const rowMenu = page.getByRole("menu", { name: "Table of Contents commands" });
  await rowMenu.waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "help-viewer-contents-menu.png"));
  step(
    "a row with topics offers Expand",
    await visible(rowMenu.getByRole("menuitem", { name: "Expand", exact: true })),
  );
  await rowMenu.getByRole("menuitem", { name: "Expand", exact: true }).click();
  const rows = () => contents.getByRole("row").count();
  await page.waitForTimeout(200);
  const opened = await rows();
  await contents.getByText("Basics", { exact: true }).click({ button: "right" });
  step(
    "the same row then offers Collapse",
    await visible(rowMenu.getByRole("menuitem", { name: "Collapse", exact: true })),
  );
  await rowMenu.getByRole("menuitem", { name: "Collapse All", exact: true }).click();
  await page.waitForTimeout(200);
  const collapsed = await rows();
  step("Collapse All closes every row", collapsed < opened, `${opened} rows, then ${collapsed}`);
  await contents.getByText("Basics", { exact: true }).click({ button: "right" });
  await rowMenu.getByRole("menuitem", { name: "Expand", exact: true }).click();
  await page.waitForTimeout(200);
  const basicsRows = await rows();
  step(
    "Expand opens the row asked about",
    basicsRows > collapsed,
    `${collapsed} rows, then ${basicsRows}`,
  );
  await contents.getByText("Macalicious Desktop Help", { exact: true }).click({ button: "right" });
  await rowMenu.getByRole("menuitem", { name: "Expand", exact: true }).click();
  await contents.getByText("Macalicious Desktop Help", { exact: true }).waitFor();
  await topicRow.waitFor({ timeout: 5000 });

  // A search, limited to the book.
  const field = viewer.getByRole("searchbox").first();
  await field.fill("notes");
  const filter = viewer.getByRole("combobox", { name: "Show results from" });
  step("results from several books offer a filter", await visible(filter));
  const count = viewer.getByRole("status");
  await viewer
    .locator(".mac-help-viewer-result", { hasText: "Notes, Reminders and Stickies that stay" })
    .waitFor({ timeout: 8000 });
  const before = await count.textContent();
  await filter.click();
  await page.getByRole("option", { name: "Macalicious Desktop Help" }).click();
  await heading("Macalicious Desktop Help").waitFor({ timeout: 5000 });
  const after = await count.textContent();
  step(
    "the filter narrows the results and names the book",
    before !== after,
    `${before} then ${after}`,
  );
  const sources = await viewer.locator(".mac-help-viewer-result-title").allTextContents();
  step(
    "its results include the book's topic",
    sources.includes("Notes, Reminders and Stickies that stay"),
  );
  await page.waitForTimeout(400);
  await shot(page, path.join(out, "help-viewer-results-book.png"));
  await filter.click();
  await page.getByRole("option", { name: "All Help" }).click();
  step("All Help lists them all again", await visible(heading("All Help")));

  // A step after the search, so a reload has a history to walk: search, then the topic again.
  await viewer
    .locator(".mac-help-viewer-result", { hasText: "Notes, Reminders and Stickies that stay" })
    .click();
  await topic.waitFor({ timeout: 5000 });
  await page.waitForTimeout(1500);

  await reloadDesktop(page);
  await launch(page, "Help Viewer");
  await viewer.waitFor({ state: "visible", timeout: 10_000 });
  step("the page last read reopens after a reload", await visible(topic));
  await viewer.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 10_000 });
  step(
    "the open rows are still open",
    await visible(contents.getByText("Notes, Reminders and Stickies that stay")),
  );
  await shot(page, path.join(out, "help-viewer-history-after-reload.png"));
  await back.click();
  step(
    "Back walks the kept history to the search",
    (await field.inputValue()) === "notes",
    await field.inputValue(),
  );
  await back.click();
  step("Back again reaches the topic before the search", await visible(topic));
  await back.click();
  step("and the book's page before that", await visible(heading("Macalicious Desktop Help")));
  await viewer.getByRole("button", { name: "Forward" }).click();
  step("Forward goes on again", await visible(topic));
});
