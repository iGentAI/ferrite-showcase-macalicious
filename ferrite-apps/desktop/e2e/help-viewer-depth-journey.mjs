#!/usr/bin/env node
// Help Viewer at depth: the Help menu's field in any application (Shift-Command-?, menu rows with the
// arrow, topics), each application's Help row, and the topic reopening after a reload. The session
// is the fresh one this browser context signs in with; nothing is created or deleted.
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/help-viewer-depth-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("help-viewer-depth");

const barTitle = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });
const menuRow = (page, name) => page.getByRole("menu").getByRole("menuitem", { name, exact: true });
const helpField = (page) => page.getByRole("menu").getByRole("searchbox", { name: "Search" });
const fieldHasKeyboard = (page) =>
  page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Search",
    undefined,
    { timeout: 3000 },
  );
const visible = (locator) =>
  locator.waitFor({ state: "visible", timeout: 6000 }).then(
    () => true,
    () => false,
  );

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Notes");
  await page.getByRole("region", { name: "Notes" }).waitFor({ state: "visible", timeout: 10_000 });
  const viewer = page.locator('[data-window-id="help-viewer"]');
  const arrow = page.locator(".mac-help-viewer-menu-arrow");
  const pageTitle = viewer.locator("article h1, section h1");
  const viewerField = viewer.getByRole("searchbox").first();

  // The field takes the keyboard when the menu opens, and finds what a menu of Notes holds.
  await barTitle(page, "Help").click();
  await fieldHasKeyboard(page);
  step("opening the Help menu gives its field the keyboard", true);
  await page.keyboard.type("new note");
  const found = menuRow(page, "File ▸ New Note");
  step("typing lists the File menu's New Note row", await visible(found));
  await shot(page, path.join(out, "help-viewer-menu-results.png"));

  // Choosing it opens File with the arrow beside New Note, and leaves the choice to the person.
  await found.click();
  step("the arrow appears", await visible(arrow));
  const newNote = menuRow(page, /^New Note/).first();
  step("the File menu is open on New Note", await visible(newNote));
  const [arrowBox, rowBox] = [await arrow.boundingBox(), await newNote.boundingBox()];
  step(
    "the arrow is beside the New Note row",
    Math.abs(arrowBox.x - (rowBox.x + rowBox.width)) < 2 &&
      Math.abs(arrowBox.y + arrowBox.height / 2 - (rowBox.y + rowBox.height / 2)) < 2,
    `arrow ${arrowBox.x},${arrowBox.y}; row ${rowBox.x},${rowBox.y} ${rowBox.width}x${rowBox.height}`,
  );
  step("the row is highlighted", (await newNote.getAttribute("data-highlighted")) !== null);
  await shot(page, path.join(out, "help-viewer-menu-arrow.png"));
  await page.keyboard.press("Escape");
  await arrow.waitFor({ state: "detached", timeout: 3000 });
  step("the arrow goes with the menu", true);

  // A row found and chosen does its command: About Notes opens its window.
  await barTitle(page, "Help").click();
  await fieldHasKeyboard(page);
  await page.keyboard.type("about");
  await menuRow(page, "Notes ▸ About Notes").click();
  await visible(arrow);
  await menuRow(page, "About Notes").click();
  const about = page.locator(".mac-desktop-shell-about").last();
  step("the row the arrow points at carries out its command", await visible(about));
  await about.getByRole("button", { name: /close/i }).first().click();
  await about.waitFor({ state: "detached", timeout: 3000 });
  await page.waitForTimeout(300);

  // Shift-Command-? from a window opens the field, and a server topic opens in Help Viewer.
  await page.keyboard.press("ControlOrMeta+Shift+/");
  await fieldHasKeyboard(page);
  step(
    "Shift-Command-? opens the Help menu with the field ready",
    await helpField(page).isVisible(),
  );
  await page.keyboard.type("keep documents");
  const topic = menuRow(page, "Keep documents in TextEdit");
  step("typing lists the server's help topic", await visible(topic));
  await topic.hover();
  await page.keyboard.type(" in");
  step(
    "typing with the pointer on a result stays in the field",
    (await helpField(page).inputValue()) === "keep documents in",
    await helpField(page).inputValue(),
  );
  await visible(topic);
  await shot(page, path.join(out, "help-viewer-menu-topics.png"));
  await topic.click();
  step("the topic opens Help Viewer", await visible(viewer));
  await pageTitle.filter({ hasText: "Keep documents in TextEdit" }).waitFor({ timeout: 8000 });
  step(
    "Help Viewer shows that topic's text",
    await viewer.getByText("The Open and Save panels list the documents").isVisible(),
  );
  await shot(page, path.join(out, "help-viewer-topic-from-menu.png"));

  // The front application's own rows are found too: Help Viewer's Go > Back does what it says.
  await page.keyboard.press("ControlOrMeta+Shift+/");
  await fieldHasKeyboard(page);
  await page.keyboard.type("back");
  await menuRow(page, "Go ▸ Back").click();
  await visible(arrow);
  await page.keyboard.press("Enter");
  await arrow.waitFor({ state: "detached", timeout: 3000 });
  await viewer.locator(".mac-help-viewer-welcome").waitFor({ timeout: 5000 });
  step("Return on the row chooses it: Go > Back returns to the welcome page", true);

  // Keys: Down Arrow leaves the field for the first result, Return in the field searches.
  await page.keyboard.press("ControlOrMeta+Shift+/");
  await fieldHasKeyboard(page);
  await page.keyboard.type("paper tape");
  await visible(menuRow(page, "Show All Help Topics"));
  await page.keyboard.press("ArrowDown");
  const firstResult = await page.evaluate(() => document.activeElement?.textContent);
  step("Down Arrow moves to the first result", /tape/i.test(firstResult ?? ""), firstResult);
  await page.keyboard.press("Escape");
  await barTitle(page, "Help").click();
  await fieldHasKeyboard(page);
  await page.keyboard.type("paper tape");
  await page.keyboard.press("Enter");
  await viewer.locator(".mac-help-viewer-results").waitFor({ timeout: 5000 });
  step(
    "Return in the field lists the words in Help Viewer",
    (await viewerField.inputValue()) === "paper tape",
  );
  step(
    "and finds the server's topic",
    await visible(
      viewer.locator(".mac-help-viewer-result", { hasText: "The Calculator's paper tape" }),
    ),
  );

  // Help Viewer's own Help row.
  await barTitle(page, "Help").click();
  await menuRow(page, "Help Viewer Help").click();
  await viewer
    .locator(".mac-help-viewer-result", { hasText: "Search this help on the server" })
    .waitFor({ timeout: 8000 });
  step(
    "Help Viewer Help lists help on Help Viewer",
    (await viewerField.inputValue()) === "Help Viewer",
  );
  await shot(page, path.join(out, "help-viewer-help-viewer-help.png"));

  // Another application's Help row.
  await launch(page, "Notes");
  await barTitle(page, "Notes").waitFor({ timeout: 5000 });
  await barTitle(page, "Help").click();
  await menuRow(page, "Notes Help").click();
  const notesGuide = pageTitle.filter({ hasText: "Notes Help" });
  await notesGuide.waitFor({ timeout: 8000 });
  step("Notes Help opens Help Viewer on Notes' guide", true);
  await shot(page, path.join(out, "help-viewer-app-help-notes.png"));
  await viewer.locator("article").getByRole("link", { name: "Write a note" }).click();
  await pageTitle.filter({ hasText: "Write a note" }).waitFor({ timeout: 5000 });
  step("a topic of the guide opens as a page", true);

  // The page last read is kept, and reopens with its book open.
  let kept;
  for (let i = 0; i < 40 && kept !== "guide:notes:1"; i++) {
    kept = (await api(page, "GET", "/api/help-viewer/place")).json.page;
    await page.waitForTimeout(250);
  }
  step("the server keeps the page last read", kept === "guide:notes:1", kept);
  await reloadDesktop(page);
  await launch(page, "Help Viewer");
  await pageTitle.filter({ hasText: "Write a note" }).waitFor({ timeout: 10_000 });
  step("the page last read reopens after a reload", true);
  step(
    "its book is open in the table of contents",
    await visible(viewer.locator(".mac-help-viewer-contents").getByText("Write a note")),
  );
  await shot(page, path.join(out, "help-viewer-after-reload.png"));
});
