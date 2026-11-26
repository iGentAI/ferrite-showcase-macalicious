#!/usr/bin/env node
// Finder's tabs and windows, and what is left of its menus, on the signed-in person's drive: a tab
// drags to a new place, moves out to a window of its own and comes back with Merge All Windows; the
// next and previous tab, all tabs at once; a tab's menu; the Inspector following the selection and Info
// for several items; hidden files; Go's Select Startup Disk and Library; Close All with Option.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/finder-tabs-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("finder-tabs");
const tag = Date.now().toString(36);
const ONE = `Tab one ${tag}.txt`;
const TWO = `Tab two ${tag}.txt`;
const HIDDEN = `.tab-hidden-${tag}`;

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const ids = {};
  for (const name of [ONE, TWO, HIDDEN]) {
    ids[name] = await uploadFile(page, {
      parent: "documents",
      name,
      type: "text/plain",
      text: name,
    });
  }
  await page.reload();
  await openDesktop(page, base, step);
  const bar = page.getByRole("menubar").first();
  const closed = () => until(async () => (await page.getByRole("menu").count()) === 0, 3_000);
  const choose = async (title, row) => {
    await bar.getByRole("menuitem", { name: title, exact: true }).click();
    await page.getByRole("menu").getByRole("menuitem", { name: row, exact: true }).click();
    await closed();
  };
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const windows = page.locator(".mac-window.mac-finder");
  await windows.first().waitFor({ timeout: 10_000 });
  const win = windows.first();
  const tabs = win.getByRole("tab");
  const titles = async () => (await tabs.allInnerTexts()).map((each) => each.trim());

  await choose("Go", "Documents");
  await choose("File", "New Tab");
  await tabs.nth(1).waitFor({ timeout: 5_000 });
  await choose("Go", "Downloads");
  await choose("File", "New Tab");
  await tabs.nth(2).waitFor({ timeout: 5_000 });
  await choose("Go", "Desktop");
  await until(async () => (await titles())[2] === "Desktop");
  step(
    "Three tabs, each on its folder",
    (await titles()).join() === "Documents,Downloads,Desktop",
    (await titles()).join(),
  );

  // Dragged along the bar.
  const first = await tabs.nth(0).boundingBox();
  const last = await tabs.nth(2).boundingBox();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2 + 30, first.y + first.height / 2, { steps: 3 });
  await page.mouse.move(last.x + last.width - 4, last.y + last.height / 2, { steps: 6 });
  await page.mouse.up();
  step(
    "A tab dragged along the bar takes its new place",
    await until(async () => (await titles()).join() === "Downloads,Desktop,Documents"),
    (await titles()).join(),
  );

  // Next, previous, all tabs.
  await tabs.nth(0).click();
  await choose("Window", "Show Next Tab");
  step(
    "Show Next Tab goes to the next",
    await until(async () => (await tabs.nth(1).getAttribute("aria-selected")) === "true"),
  );
  await choose("Window", "Show Previous Tab");
  step(
    "Show Previous Tab goes back",
    await until(async () => (await tabs.nth(0).getAttribute("aria-selected")) === "true"),
  );
  await choose("View", "Show All Tabs");
  const overview = win.locator(".mac-finder-all-tabs");
  await overview.waitFor({ timeout: 4_000 });
  await shot(page, path.join(out, `finder-all-tabs-${browserName}.png`));
  await overview.getByRole("button", { name: /Desktop/ }).click();
  step(
    "Show All Tabs shows them, and choosing one goes to it",
    await until(
      async () =>
        (await overview.count()) === 0 &&
        (await tabs.nth(1).getAttribute("aria-selected")) === "true",
    ),
  );

  // Out to a window, and back, with its history.
  await choose("Window", "Move Tab to New Window");
  step(
    "Move Tab to New Window makes a window of it",
    await until(async () => (await windows.count()) === 2),
  );
  await shot(page, path.join(out, `finder-tab-window-${browserName}.png`));
  const moved = await bar.getByRole("menuitem", { name: "Go", exact: true });
  await moved.click();
  const backRow = page.getByRole("menuitem", { name: "Back", exact: true });
  await backRow.waitFor({ timeout: 3_000 });
  step(
    "It keeps its way back",
    (await backRow.getAttribute("aria-disabled")) !== "true" &&
      !(await backRow.evaluate((row) => row.hasAttribute("data-disabled"))),
  );
  await page.keyboard.press("Escape");
  await closed();
  await choose("Window", "Merge All Windows");
  step(
    "Merge All Windows gathers them in one",
    await until(async () => (await windows.count()) === 1),
  );
  const merged = windows.first().getByRole("tab");
  step("with all three tabs", await until(async () => (await merged.count()) === 3));

  // Whether Merge All Windows is on follows the windows straight away.
  const mergeRow = page.getByRole("menu").getByRole("menuitem", { name: "Merge All Windows" });
  const windowMenu = async () => {
    await bar.getByRole("menuitem", { name: "Window", exact: true }).click();
    await mergeRow.waitFor({ timeout: 3_000 });
  };
  const mergeDimmed = () => mergeRow.evaluate((row) => row.hasAttribute("data-disabled"));
  await windowMenu();
  step("With one window Merge All Windows is dimmed", await mergeDimmed());
  await page.keyboard.press("Escape");
  await closed();
  await choose("File", "New Finder Window");
  await until(async () => (await windows.count()) === 2);
  await windowMenu();
  step("A second window turns it on at once", !(await mergeDimmed()));
  await mergeRow.click();
  await closed();
  step("and it merges the two", await until(async () => (await windows.count()) === 1));
  await windowMenu();
  step("after which it is dimmed again", await mergeDimmed());
  await page.keyboard.press("Escape");
  await closed();
  await choose("File", "Close Tab");
  await until(async () => (await merged.count()) === 3);

  // A tab's menu, and tearing one off.
  await merged.nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Close Tab", exact: true }).waitFor({ timeout: 4_000 });
  await shot(page, path.join(out, `finder-tab-menu-${browserName}.png`));
  await page.getByRole("menuitem", { name: "Close Tab", exact: true }).click();
  step("A tab's menu closes it", await until(async () => (await merged.count()) === 2));
  const torn = await merged.nth(1).boundingBox();
  await page.mouse.move(torn.x + torn.width / 2, torn.y + torn.height / 2);
  await page.mouse.down();
  await page.mouse.move(torn.x + torn.width / 2, torn.y + 60, { steps: 3 });
  await page.mouse.move(torn.x + torn.width / 2, torn.y + 200, { steps: 6 });
  await page.mouse.up();
  step(
    "A tab dragged away from the bar becomes a window",
    await until(async () => (await windows.count()) === 2),
  );

  // Close Window, which Option turns into Close All.
  const fileRow = (name) => page.getByRole("menuitem", { name, exact: true });
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await fileRow("Close Window").waitFor({ timeout: 3_000 });
  step("Without Option File shows Close Window only", (await fileRow("Close All").count()) === 0);
  await page.keyboard.down("Alt");
  await fileRow("Close All").waitFor({ timeout: 3_000 });
  step("With Option it shows Close All only", (await fileRow("Close Window").count()) === 0);
  await shot(page, path.join(out, `finder-close-all-${browserName}.png`));
  await fileRow("Close All").click();
  await page.keyboard.up("Alt");
  step(
    "Close All closes every Finder window",
    await until(async () => (await windows.count()) === 0),
  );

  // The Inspector and Info for several.
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  await windows.first().waitFor({ timeout: 8_000 });
  const again = windows.first();
  await choose("Go", "Documents");
  const item = (name) => again.getByRole("option", { name, exact: true });
  await item(ONE).waitFor({ timeout: 8_000 });
  await item(ONE).click();
  await choose("File", "Show Inspector");
  const inspector = page.locator(".mac-finder-info");
  await inspector.waitFor({ timeout: 4_000 });
  await item(TWO).click();
  step(
    "The Inspector follows the selection",
    await until(
      async () =>
        (await inspector.getByRole("textbox", { name: "Name & Extension" }).inputValue()) === TWO,
    ),
  );
  await item(ONE).click({ modifiers: ["Control"] });
  step(
    "With two selected it tells of both",
    await until(async () => (await page.getByText("2 items", { exact: true }).count()) > 0),
  );
  await shot(page, path.join(out, `finder-summary-info-${browserName}.png`));

  // Show Summary Info stays on what it was asked about, while the Inspector follows the selection.
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Show Summary Info", exact: true }).click();
  await closed();
  const summaries = () => page.getByText("2 items", { exact: true }).count();
  await until(async () => (await summaries()) >= 2);
  await item(ONE).click();
  step(
    "Show Summary Info stays when the selection changes",
    await until(async () => (await summaries()) >= 1),
  );
  await choose("File", "Hide Inspector");
  await page.waitForTimeout(300);
  step("and when the Inspector goes", (await summaries()) >= 1);
  await page
    .locator(".mac-finder-info", { hasText: "2 items" })
    .getByRole("button", { name: /close/i })
    .first()
    .click();
  await until(async () => (await summaries()) === 0);
  await choose("File", "Show Inspector");
  await item(TWO).click({ modifiers: ["Control"] });
  await until(async () => (await summaries()) >= 1);
  await page.locator(".mac-finder-info").getByRole("checkbox", { name: "Locked" }).click();
  const lockedBoth = async () => {
    const entries = (await api(page, "GET", "/api/files/")).json.entries;
    return [ONE, TWO].every((name) => entries.find((each) => each.id === ids[name])?.locked);
  };
  step("Locked there locks both, on the server", await until(lockedBoth));
  await page.locator(".mac-finder-info").getByRole("checkbox", { name: "Locked" }).click();
  await until(async () => !(await lockedBoth()));
  await choose("File", "Hide Inspector");

  // A summary keeps what is left of its items, and goes with the last.
  await item(ONE).click();
  await item(TWO).click({ modifiers: ["Control"] });
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Show Summary Info", exact: true }).click();
  await closed();
  await until(async () => (await summaries()) >= 1);
  await item(ONE).click();
  await choose("File", "Move to Trash");
  const left = page.locator(".mac-finder-info", { hasText: "1 item" });
  step(
    "With one of two trashed the summary shows the other",
    await until(async () => (await left.count()) >= 1),
  );
  await item(TWO).click();
  await choose("File", "Move to Trash");
  step("and it closes when the last goes", await until(async () => (await left.count()) === 0));

  // Hidden files.
  step("A hidden file is not listed", (await item(HIDDEN).count()) === 0);
  await again.click({ position: { x: 700, y: 400 } });
  await page.keyboard.press("Control+Shift+Period");
  step(
    "Command-Shift-Period lists it",
    await until(async () => (await item(HIDDEN).count()) === 1),
  );
  await shot(page, path.join(out, `finder-hidden-${browserName}.png`));
  await page.keyboard.press("Control+Shift+Period");
  step("and again hides it", await until(async () => (await item(HIDDEN).count()) === 0));

  // Go.
  await choose("Go", "Select Startup Disk");
  step(
    "Select Startup Disk shows the computer with its disk selected",
    await until(
      async () =>
        (await again.locator('[aria-selected="true"]', { hasText: "Macintosh" }).count()) > 0,
    ),
  );
  await page.keyboard.down("Alt");
  await bar.getByRole("menuitem", { name: "Go", exact: true }).click();
  const library = page.getByRole("menuitem", { name: "Library", exact: true });
  step(
    "With Option held Go shows Library, dimmed with its reason",
    await library.waitFor({ timeout: 3_000 }).then(
      async () => (await library.getAttribute("data-reason")) !== null,
      () => false,
    ),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.up("Alt");
});
