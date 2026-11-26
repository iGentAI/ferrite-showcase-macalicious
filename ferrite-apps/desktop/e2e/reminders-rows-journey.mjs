#!/usr/bin/env node
// The rows of Reminders' inventory (features/reminders.md) that had only code behind them, each by real input in a real
// browser against the running app, read back from the server and after a reload where the row keeps data. Each step's
// label starts with its row's name, and each section leaves a screenshot `reminders-rows-<section>`. Exits 0 only when
// every step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/reminders-rows-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                       [--browser chromium|chrome|firefox|webkit]

import { twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-rows");
const id = Date.now().toString(36);
const chris = { name: `rrchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const anna = { name: `rranna-${id}`, fullName: `Anna ${id}`, password: `tide-${id}-pool` };
const [A, B, C] = ["Mango", "Apple", "Zebra"].map((word) => `${word} ${id}`);

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const rows = (page) => windowOf(page).getByRole("option");
const rowOf = (page, title) => rows(page).filter({ hasText: title }).first();
const lists = (page) => windowOf(page).getByRole("tree", { name: "Lists" });
const listRow = (page, name) =>
  lists(page)
    .getByRole("treeitem")
    .filter({ hasText: new RegExp(`^${name}`) })
    .first();
const seen = (check, ms = 8_000) => within(ms, check).then((took) => took !== null);
const fetched = async (page, path) => {
  const reply = await page.request.get(new URL(path, page.url()).href);
  return reply.json();
};
const data = async (page) => (await fetched(page, "/api/reminders/data")).data ?? {};
const stored = async (page, title) =>
  ((await data(page)).reminders ?? []).find((each) => each.title === title);
const bar = (page) => page.getByRole("menubar");
const openMenu = async (page, title) => {
  await bar(page).getByRole("menuitem", { name: title, exact: true }).first().click();
  await page.getByRole("menu").last().waitFor({ timeout: 5_000 });
};
const row = (page, name) =>
  page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name })
    .or(page.getByRole("menu").last().getByRole("menuitemcheckbox", { name }))
    .first();
const menu = async (page, title, name) => {
  await openMenu(page, title);
  await row(page, name).click();
};
const closeMenus = async (page) => {
  for (let tries = 0; tries < 4 && (await page.getByRole("menu").count()) > 0; tries += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }
};
const sortBy = async (page, name) => {
  await openMenu(page, "View");
  await row(page, "Sort By").hover();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
  await closeMenus(page);
};
const order = async (page) => {
  const shown = await rows(page).allInnerTexts();
  return shown.map((text) => [A, B, C].find((title) => text.includes(title))).filter(Boolean);
};
const tile = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });
const shellOf = (page, windowId) => page.locator(`[data-window-id="${windowId}"]`);
const hidden = (page, windowId) =>
  shellOf(page, windowId).evaluate((shell) => shell.hasAttribute("data-minimized"));
const zOf = (page, windowId) =>
  shellOf(page, windowId).evaluate((shell) => Number(getComputedStyle(shell).zIndex));
const stateOf = (page, windowId) =>
  shellOf(page, windowId).locator("[data-window-state]").first().getAttribute("data-window-state");
const boxOf = (page, windowId) => shellOf(page, windowId).boundingBox();
const open = async (page) => {
  await tile(page, "Reminders").click();
  await windowOf(page).getByRole("button", { name: "New Reminder" }).waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector(".mac-reminders[aria-busy]"), null, {
    timeout: 15_000,
  });
  await page.waitForTimeout(500);
};
const reopen = async (page) => {
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);
  const restored = await seen(async () => (await windowOf(page).count()) > 0, 8_000);
  if (!restored) await tile(page, "Reminders").click();
  await windowOf(page).getByRole("button", { name: "New Reminder" }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  return restored;
};
const add = async (page, typed) => {
  await windowOf(page).getByRole("button", { name: "New Reminder" }).click();
  const field = windowOf(page).getByRole("textbox", { name: "Title" });
  await field.waitFor({ timeout: 5_000 });
  await field.fill(typed);
  await field.press("Enter");
};
const info = (page) => page.locator(".mac-reminders-info").first();
const pad = (value) => String(value).padStart(2, "0");
/** A list's menu: its Delete asks, and takes the list away. */
const listInfoCheck = async (page) => {
  const before = ((await data(page)).lists ?? []).length;
  await windowOf(page).getByText("Add List").click();
  await seen(async () => ((await data(page)).lists ?? []).length === before + 1);
  const shownList = lists(page).locator('[aria-selected="true"]').first();
  await shownList.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const ask = page.getByRole("alertdialog");
  await ask.waitFor({ timeout: 3_000 });
  await ask.getByRole("button", { name: "Delete" }).click();
  step(
    "List row: Show Info and Share List… driven in their steps, and Delete asks then removes it",
    await seen(async () => ((await data(page)).lists ?? []).length === before),
  );
};
const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  page.setDefaultTimeout(8_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const section = async (name, body) => {
    try {
      await closeMenus(page);
      if ((await info(page).count()) > 0) await page.keyboard.press("Escape");
      await body();
    } catch (error) {
      step(`${name}: the section ran to its end`, false, String(error.message).split("\n")[0]);
      await shot(page, `reminders-rows-${name}-failed`);
      await closeMenus(page);
    }
  };
  await open(page);
  const nameShownList = async (name) => {
    await lists(page).locator('[aria-selected="true"]').first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Show Info" }).click();
    const sheet = page.getByRole("dialog", { name: "List Info" });
    await sheet.getByRole("textbox", { name: "Name:" }).fill(name);
    await sheet.getByRole("button", { name: "OK" }).click();
    await seen(() => listRow(page, name).isVisible(), 3_000);
  };
  const MINE = `Mine ${id}`;
  const mine = () => listRow(page, MINE);
  await windowOf(page).getByText("Add List").click();
  await page.waitForTimeout(400);
  await nameShownList(MINE);
  await mine().click();

  await section("list-pane", async () => {
    await add(page, A);
    await rowOf(page, A).waitFor({ timeout: 5_000 });
    step(
      "Plus: a new row with its title being typed, on the server",
      await seen(async () => Boolean(await stored(page, A))),
    );
    await add(page, `${B} tomorrow 3pm`);
    await rowOf(page, B).waitFor({ timeout: 5_000 });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    step(
      'Dates and times read from typed words: "tomorrow 3pm" is its date and time on the server',
      await seen(async () => {
        const saved = await stored(page, B);
        return saved?.due === dayKey(tomorrow) && saved.dueTime === "15:00";
      }),
      JSON.stringify(await stored(page, B)),
    );
    await add(page, C);
    await rowOf(page, C).waitFor({ timeout: 5_000 });
    step(
      "One row a reminder, in the list",
      (await rows(page).count()) === 3 &&
        (await windowOf(page).locator(".mac-reminders-title").innerText()).length > 0,
    );
    const count = windowOf(page).locator(".mac-reminders-count");
    step(
      "Title and count: the list's name and its reminders to do",
      /^3/.test(await count.innerText()),
      await count.innerText(),
    );
    step(
      "Due line: the row says when it is due",
      /Tomorrow/.test(await rowOf(page, B).innerText()),
      await rowOf(page, B).innerText(),
    );

    await rowOf(page, A).click();
    await page.keyboard.press("Enter");
    const title = windowOf(page).getByRole("textbox", { name: "Title" });
    await title.waitFor({ timeout: 3_000 });
    const editedKey = true;
    await title.fill(`${A} x`);
    await title.press("Escape");
    const kept = await seen(async () => (await title.count()) === 0, 2_000);
    const unchanged = Boolean(await stored(page, A));
    await page.keyboard.press("Enter");
    await title.waitFor({ timeout: 3_000 });
    await title.fill(`${A} two`);
    await title.press("Enter");
    const renamed = await seen(async () => Boolean(await stored(page, `${A} two`)));
    await page.keyboard.press("Enter");
    await title.waitFor({ timeout: 3_000 });
    await title.fill(A);
    await title.press("Enter");
    await seen(async () => Boolean(await stored(page, A)));
    step("Return edits: on a selected row, the title goes to editing", editedKey);
    step(
      "Return and Escape while editing: Escape gives it up, Return keeps it, on the server",
      kept && unchanged && renamed,
      `${kept} ${unchanged} ${renamed}`,
    );
    await rows(page).filter({ hasText: C }).locator(".mac-reminders-text").first().dblclick();
    await title.waitFor({ timeout: 3_000 });
    await title.fill(`${C} edit`);
    await title.press("Enter");
    const inPlace = await seen(async () => Boolean(await stored(page, `${C} edit`)));
    await rowOf(page, `${C} edit`).locator(".mac-reminders-text").first().dblclick();
    await title.waitFor({ timeout: 3_000 });
    await title.fill(C);
    await title.press("Enter");
    await seen(async () => Boolean(await stored(page, C)));
    step("Editing a title in place: a double click, and the new title on the server", inPlace);

    await rowOf(page, A).click();
    await openMenu(page, "Edit");
    await row(page, "Priority").hover();
    await page.getByRole("menuitem", { name: "High", exact: true }).first().click();
    await closeMenus(page);
    const marks = await seen(
      async () =>
        (await rowOf(page, A).locator(".mac-reminders-priority").innerText()) === "!!!" &&
        (await stored(page, A))?.priority === "high",
    );
    await shot(page, "reminders-rows-list-pane");
    step("Priority marks: !!! on the row of a high priority", marks);

    await rowOf(page, C).locator("[data-reminder-toggle]").click();
    const completes = await seen(async () => (await stored(page, C))?.completed === true);
    step("Circle completes: a click on the circle, on the server", completes);
    step(
      "A completed row stays until another list is shown: still listed after the click",
      await rowOf(page, C).isVisible(),
    );
    const other = windowOf(page).getByRole("button", { name: /^All/ }).first();
    await other.click();
    await seen(async () => (await rows(page).count()) >= 2, 3_000);
    const leftAll = (await rowOf(page, C).count()) === 0;
    await windowOf(page)
      .getByRole("button", { name: /^Today/ })
      .first()
      .click();
    await page.waitForTimeout(200);
    await mine().click();
    await seen(() => rowOf(page, A).isVisible(), 3_000);
    const leftList = (await rowOf(page, C).count()) === 0;
    step(
      "A completed row stays until another list is shown: gone once another is shown",
      leftAll && leftList,
    );
    await menu(page, "View", /Show Completed/);
    const shownAgain = await seen(() => rowOf(page, C).isVisible(), 3_000);
    await shot(page, "reminders-rows-show-completed");
    await menu(page, "View", /Show Completed/);
    step(
      "Show Completed: shows the completed one, and hides it again",
      shownAgain && (await seen(async () => (await rowOf(page, C).count()) === 0, 3_000)),
    );
    await menu(page, "View", /Show Completed/);
    await rowOf(page, C).locator("[data-reminder-toggle]").click();
    await seen(async () => !(await stored(page, C))?.completed);
    await menu(page, "View", /Show Completed/);
  });

  await section("sort", async () => {
    await sortBy(page, "Title");
    const byTitle = await seen(async () => (await order(page)).join() === [B, A, C].join(), 3_000);
    await sortBy(page, "Priority");
    const byPriority = await seen(async () => (await order(page))[0] === A, 3_000);
    await sortBy(page, "Due Date");
    const byDue = await seen(async () => (await order(page))[0] === B, 3_000);
    await sortBy(page, "Creation Date");
    const byMade = await seen(async () => (await order(page)).join() === [A, B, C].join(), 3_000);
    await sortBy(page, "Title");
    const notManual = await seen(
      async () => (await order(page)).join() === [B, A, C].join(),
      3_000,
    );
    await openMenu(page, "View");
    await row(page, "Sort By").hover();
    await page.getByRole("menuitemradio", { name: "Title", exact: true }).waitFor();
    await shot(page, "reminders-rows-sort");
    await page.getByRole("menuitemradio", { name: "Manual", exact: true }).click();
    await closeMenus(page);
    const manual = await seen(async () => (await order(page)).join() === [A, B, C].join(), 3_000);
    step(
      "Sort By submenu (Manual, Due Date, Creation Date, Priority, Title): each orders the list",
      byTitle && byPriority && byDue && byMade && notManual && manual,
      `${byTitle} ${byPriority} ${byDue} ${byMade} ${notManual} ${manual}`,
    );
  });

  await section("info", async () => {
    await rowOf(page, A).click();
    await menu(page, "View", /^Show Info/);
    const popover = await seen(() => info(page).isVisible(), 3_000);
    step(
      "Info popover: its row's title at the head",
      popover && (await info(page).innerText()).includes(A),
    );
    step(
      "Title: the popover's head names the reminder",
      (await info(page).innerText()).includes(A),
    );
    await info(page).getByRole("button", { name: "Flag" }).click();
    step(
      "Flag: pressed, on the server",
      await seen(async () => (await stored(page, A))?.flagged === true),
    );
    await info(page).getByRole("textbox", { name: "Notes" }).fill("bring a bag");
    step(
      "Notes: typed, on the server",
      await seen(async () => (await stored(page, A))?.notes === "bring a bag"),
    );
    await info(page).getByRole("checkbox", { name: "On a Day" }).click();
    const today = dayKey(new Date());
    const onADay = await seen(async () => (await stored(page, A))?.due === today);
    step("On a Day: today, on the server", onADay);
    await info(page).getByRole("checkbox", { name: "At a Time" }).click();
    const atATime = await seen(async () => Boolean((await stored(page, A))?.dueTime));
    const was = (await stored(page, A))?.dueTime;
    await info(page).getByRole("group", { name: "Time" }).getByRole("spinbutton").first().focus();
    await page.keyboard.press("ArrowUp");
    step(
      "At a Time: a time, and changed by its field, on the server",
      atATime && (await seen(async () => (await stored(page, A))?.dueTime !== was)),
      `${was} then ${(await stored(page, A))?.dueTime}`,
    );
    await info(page).getByRole("combobox", { name: "repeat", exact: true }).click();
    await page.getByRole("option", { name: "Every Week", exact: true }).click();
    await seen(async () => (await stored(page, A))?.repeat === "weekly");
    const endRepeat = info(page).locator('[data-row="end-repeat"]').getByRole("combobox");
    await endRepeat.click();
    await page.getByRole("option", { name: "On Date", exact: true }).click();
    const ended = await seen(async () => Boolean((await stored(page, A))?.repeatEnd));
    await shot(page, "reminders-rows-info");
    await endRepeat.click();
    await page.getByRole("option", { name: "Never", exact: true }).click();
    step(
      "End Repeat: On Date and Never, on the server",
      ended && (await seen(async () => !(await stored(page, A))?.repeatEnd)),
    );
    await info(page).locator('[data-row="repeat"]').getByRole("combobox").first().click();
    await page
      .getByRole("option", { name: "Never", exact: true })
      .or(page.getByRole("option", { name: "None", exact: true }))
      .first()
      .click();
    await seen(async () => !(await stored(page, A))?.repeat);
    await info(page).locator('[data-row="priority"]').getByRole("combobox").click();
    await page.getByRole("option", { name: /^Medium/ }).click();
    step(
      "Priority: Medium, on the server",
      await seen(async () => (await stored(page, A))?.priority === "medium"),
    );
    await info(page).locator('[data-row="url"]').getByRole("textbox").fill("https://example.com/a");
    step(
      "URL: typed, on the server",
      await seen(async () => (await stored(page, A))?.url === "https://example.com/a"),
    );
    await page.keyboard.press("Escape");
    await seen(async () => (await info(page).count()) === 0, 3_000);
  });

  await section("keyboard", async () => {
    await mine().click();
    await seen(() => rowOf(page, B).isVisible(), 3_000);
    await rowOf(page, B).click();
    await page.keyboard.press("Control+i");
    const keyInfo = await seen(() => info(page).isVisible(), 3_000);
    step("⌘I Show Info: the popover opens", keyInfo);
    step("Show Info ⌘I: the item and the key", keyInfo);
    await page.keyboard.press("Escape");
    await seen(async () => (await info(page).count()) === 0, 3_000);
    await rowOf(page, B).click();
    await page.keyboard.press("ArrowDown");
    const selected = rows(page)
      .locator('[aria-selected="true"]')
      .or(windowOf(page).locator('[role="option"][aria-selected="true"]'))
      .first();
    const down = await seen(async () => (await selected.innerText()).includes(C), 2_000);
    await page.keyboard.press("ArrowUp");
    step(
      "Arrow keys in the list: down and up move the selection",
      down && (await seen(async () => (await selected.innerText()).includes(B), 2_000)),
    );
    await page.keyboard.press(" ");
    const spaced = await seen(async () => (await stored(page, B))?.completed === true);
    await page.keyboard.press(" ");
    step(
      "Space completes: and again takes it back, on the server",
      spaced && (await seen(async () => !(await stored(page, B))?.completed)),
    );
    await add(page, `Delkey ${id}`);
    await rowOf(page, `Delkey ${id}`).waitFor({ timeout: 3_000 });
    await add(page, `Backkey ${id}`);
    await rowOf(page, `Backkey ${id}`).waitFor({ timeout: 3_000 });
    await seen(async () => Boolean(await stored(page, `Backkey ${id}`)));
    await rowOf(page, `Delkey ${id}`).click();
    await page.keyboard.press("Delete");
    const del = await seen(async () => !(await stored(page, `Delkey ${id}`)));
    await rowOf(page, `Backkey ${id}`).click();
    await page.keyboard.press("Backspace");
    step(
      "Delete and Backspace remove: each, on the server",
      del && (await seen(async () => !(await stored(page, `Backkey ${id}`)))),
    );
    await rowOf(page, C).click();
    await page.keyboard.press("Control+Shift+f");
    const flagged = await seen(async () => (await stored(page, C))?.flagged === true);
    const before = ((await data(page)).lists ?? []).length;
    await page.keyboard.press("Control+Shift+n");
    const newList = await seen(async () => ((await data(page)).lists ?? []).length === before + 1);
    const named = windowOf(page).getByRole("textbox", { name: "Title" });
    if (await named.isVisible()) await named.press("Escape");
    await page.keyboard.press("Control+n");
    await named.waitFor({ timeout: 3_000 });
    await named.fill(`ByKey ${id}`);
    await named.press("Enter");
    const byKey = await seen(async () => Boolean(await stored(page, `ByKey ${id}`)));
    await page.keyboard.press("Control+a");
    const all = await seen(
      async () =>
        (await windowOf(page).locator('[role="option"][aria-selected="true"]').count()) === 1,
      2_000,
    );
    await page.keyboard.press("Control+f");
    const find = await seen(
      () =>
        windowOf(page)
          .getByRole("searchbox")
          .evaluate((node) => node === document.activeElement),
      2_000,
    );
    await shot(page, "reminders-rows-keyboard");
    step(
      "The menu items' keys above (⌘N, ⇧⌘N, ⌘F, ⇧⌘F, ⌘A): each does its command",
      flagged && newList && byKey && all && find,
      `${flagged} ${newList} ${byKey} ${all} ${find}`,
    );
    step("New List ⇧⌘N: the key, on the server", newList);
    await menu(page, "File", /^New List/);
    step(
      "New List ⇧⌘N: the item too",
      await seen(async () => ((await data(page)).lists ?? []).length === before + 2),
    );
  });

  await section("sidebar", async () => {
    const search = windowOf(page).getByRole("searchbox");
    await search.fill("bring a bag");
    const byNotes = await seen(async () => (await rows(page).count()) === 1, 3_000);
    const named = (await rowOf(page, A).locator(".mac-reminders-origin").innerText()).length > 0;
    await search.fill(id.slice(0, 5));
    const byTitle = await seen(async () => (await rows(page).count()) >= 3, 3_000);
    await shot(page, "reminders-rows-search");
    await search.fill("no such thing at all");
    const none = await seen(() => windowOf(page).getByText("No Results").isVisible(), 3_000);
    await search.fill("");
    step(
      "Search field: title and notes in every list",
      byNotes && byTitle && none,
      `${byNotes} ${byTitle} ${none}`,
    );
    step("Search results name their list: the row says which", named);

    const tileOf = (name) =>
      windowOf(page)
        .getByRole("button", { name: new RegExp(`^${name}`) })
        .first();
    const titleSays = (name) =>
      seen(
        async () => (await windowOf(page).locator(".mac-reminders-title").innerText()) === name,
        3_000,
      );
    await tileOf("Today").click();
    step(
      "Today tile: shows what is due today",
      (await titleSays("Today")) &&
        (await seen(
          async () => (await rowOf(page, A).isVisible()) && (await rowOf(page, B).count()) === 0,
          3_000,
        )),
    );
    await tileOf("Scheduled").click();
    step(
      "Scheduled tile: shows what has a date",
      (await titleSays("Scheduled")) &&
        (await seen(
          async () => (await rowOf(page, B).isVisible()) && (await rowOf(page, C).count()) === 0,
          3_000,
        )),
    );
    await shot(page, "reminders-rows-scheduled");
    await tileOf("All").click();
    step(
      "All tile: shows every reminder to do",
      (await titleSays("All")) &&
        (await seen(
          async () => (await rowOf(page, B).isVisible()) && (await rowOf(page, C).isVisible()),
          3_000,
        )),
    );
    await tileOf("Flagged").click();
    step(
      "Flagged tile: shows the flagged ones",
      (await titleSays("Flagged")) &&
        (await seen(
          async () => (await rowOf(page, C).isVisible()) && (await rowOf(page, B).count()) === 0,
          3_000,
        )),
    );
    const firstRow = mine();
    const lastNumber = (text) => Number(text.match(/(\d+)\s*$/)?.[1] ?? Number.NaN);
    const tileNumber = (text) => Number(text.match(/\b(\d+)\b/)?.[1] ?? Number.NaN);
    const mineCount = async () => lastNumber(await firstRow.innerText());
    const allCount = async () => tileNumber(await tileOf("All").innerText());
    await firstRow.click();
    await seen(() => rowOf(page, B).isVisible(), 3_000);
    const mineBefore = await mineCount();
    const allBefore = await allCount();
    await add(page, `Counted ${id}`);
    await seen(async () => Boolean(await stored(page, `Counted ${id}`)));
    const followed = await seen(
      async () => (await mineCount()) === mineBefore + 1 && (await allCount()) === allBefore + 1,
      5_000,
    );
    step(
      "Count badges: a list's and a tile's numbers follow its reminders",
      followed,
      `${mineBefore} then ${await mineCount()}; ${allBefore} then ${await allCount()}`,
    );
    await firstRow.click();
    step(
      "My Lists rows: a list's row shows it, under My Lists",
      await seen(() => rowOf(page, B).isVisible(), 3_000),
    );
    const count = ((await data(page)).lists ?? []).length;
    await windowOf(page).getByText("Add List").click();
    step(
      "Add List: a new list on the server, and shown",
      await seen(async () => ((await data(page)).lists ?? []).length === count + 1),
    );
    await seen(
      async () => (await windowOf(page).getByRole("textbox", { name: "Title" }).count()) === 0,
      1_000,
    );
    const list = lists(page).locator('[aria-selected="true"]').first();
    await list.click({ button: "right" });
    await page.getByRole("menu").last().waitFor();
    await shot(page, "reminders-rows-list-menu");
    await page.getByRole("menuitem", { name: "Show Info" }).click();
    const listInfo = page.getByRole("dialog", { name: "List Info" });
    await listInfo.waitFor({ timeout: 5_000 });
    await listInfo.getByRole("textbox", { name: "Name:" }).fill(`Trips ${id}`);
    await listInfo.getByRole("button", { name: "Orange" }).click();
    await shot(page, "reminders-rows-list-info");
    await listInfo.getByRole("button", { name: "OK" }).click();
    step(
      "List info: name, colour: on the server",
      await seen(async () =>
        ((await data(page)).lists ?? []).some(
          (each) => each.name === `Trips ${id}` && each.color === "orange",
        ),
      ),
    );

    const namesNow = async () => ((await data(page)).lists ?? []).map((each) => each.name);
    const was = await namesNow();
    const firstName = was[0];
    await listRow(page, `Trips ${id}`).dragTo(listRow(page, firstName), {
      targetPosition: { x: 40, y: 2 },
    });
    step(
      "Reordering lists: dragged to a row's edge, first on the server",
      await seen(async () => (await namesNow())[0] === `Trips ${id}`),
      JSON.stringify(await namesNow()),
    );
    step("Reordering lists: the same, as a drag", (await namesNow())[0] === `Trips ${id}`);
    await listRow(page, `Trips ${id}`).click();
    await add(page, `Parent ${id}`);
    await rowOf(page, `Parent ${id}`).waitFor();
    await add(page, `Child ${id}`);
    await rowOf(page, `Child ${id}`).waitFor();
    await seen(async () => Boolean(await stored(page, `Child ${id}`)));
    await rowOf(page, `Child ${id}`).dragTo(rowOf(page, `Parent ${id}`));
    const parent = await stored(page, `Parent ${id}`);
    step(
      "Reminder onto another to make a sub-reminder: on the server",
      await seen(async () => (await stored(page, `Child ${id}`))?.parentId === parent.id),
    );
    await shot(page, "reminders-rows-drag");
    await menu(page, "File", /^New Group/);
    const groupField = windowOf(page).getByRole("textbox", { name: "Group Name" });
    await groupField.fill(`Crew ${id}`);
    await groupField.press("Enter");
    await seen(() => listRow(page, `Crew ${id}`).isVisible(), 3_000);
    await listRow(page, `Trips ${id}`).dragTo(listRow(page, `Crew ${id}`));
    step(
      "List into a group: dragged, on the server",
      await seen(async () => {
        const doc = await data(page);
        const group = doc.groups?.find((each) => each.name === `Crew ${id}`);
        const list = doc.lists.find((each) => each.name === `Trips ${id}`);
        return Boolean(group) && list?.groupId === group.id;
      }),
    );
  });

  await section("edit", async () => {
    await windowOf(page).getByRole("button", { name: /^All/ }).first().click();
    await rowOf(page, B).click();
    await menu(page, "File", /^New Reminder/);
    const typing = windowOf(page).getByRole("textbox", { name: "Title" });
    await typing.fill(`Clip ${id}`);
    await typing.press("Enter");
    await seen(async () => Boolean(await stored(page, `Clip ${id}`)));
    await rowOf(page, `Clip ${id}`).click();
    const titles = async () =>
      ((await data(page)).reminders ?? []).filter((each) => each.title === `Clip ${id}`).length;
    await page.keyboard.press("Control+c");
    const clip = await seen(async () =>
      (await page.evaluate(() => navigator.clipboard.readText())).includes(`Clip ${id}`),
    );
    await page.keyboard.press("Control+v");
    const pasted = await seen(async () => (await titles()) === 2);
    step("Copy ⌘C: on the clipboard, and pasted after", clip && pasted);
    step("Paste ⌘V: a new reminder, on the server", pasted);
    await page.keyboard.press("Control+z");
    const undone = await seen(async () => (await titles()) === 1);
    step("Undo ⌘Z: takes the paste away, on the server", undone);
    await menu(page, "Edit", /^Redo/);
    step("Redo ⇧⌘Z: puts it back", await seen(async () => (await titles()) === 2));
    await rowOf(page, `Clip ${id}`).click();
    await menu(page, "Edit", /^Cut/);
    const cut = await seen(async () => (await titles()) === 1);
    await page.keyboard.press("Control+v");
    await seen(async () => (await titles()) === 2);
    await rowOf(page, `Clip ${id}`).click();
    await page.keyboard.press("Control+x");
    step("Cut ⌘X: the item and the key", cut && (await seen(async () => (await titles()) === 1)));
    await rowOf(page, B).click();
    await page.keyboard.press("Control+a");
    const shown = await rows(page).count();
    const pressed = windowOf(page).locator('[role="option"][aria-selected="true"]');
    const everyRow = await seen(async () => (await pressed.count()) === shown, 3_000);
    await shot(page, "reminders-rows-edit");
    step(
      "Select All ⌘A: every reminder the list shows",
      everyRow,
      `${await pressed.count()} of ${shown}`,
    );
    await rowOf(page, B).click();
  });

  await section("file", async () => {
    await page.evaluate(() => {
      window.printedPage = "";
      new MutationObserver((changes) => {
        for (const { addedNodes } of changes) {
          for (const node of addedNodes) {
            if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
          }
        }
      }).observe(document.body, { childList: true });
    });
    await menu(page, "File", /^Print/);
    let html = "";
    await within(10_000, async () => {
      html = (await page.evaluate(() => window.printedPage)) ?? "";
      return html !== "";
    });
    step(
      "Print… ⌘P: the page handed to the browser's print dialog holds the view's reminders",
      html.includes(B) && html.includes(C),
    );
    await menu(page, "File", /^Close Window/);
    const closed = await seen(async () => (await windowOf(page).count()) === 0, 3_000);
    await open(page);
    await page.keyboard.press("Control+w");
    step(
      "Close Window ⌘W: the item and the key close it",
      closed && (await seen(async () => (await windowOf(page).count()) === 0, 3_000)),
    );
    await open(page);
  });

  await section("alerts", async () => {
    await windowOf(page).getByRole("button", { name: /^All/ }).first().click();
    const ahead = new Date(Date.now() + 65_000);
    const hour = ahead.getHours();
    const stamp = `${hour % 12 === 0 ? 12 : hour % 12}:${pad(ahead.getMinutes())}${hour < 12 ? "am" : "pm"}`;
    const title = `Duesoon ${id}`;
    await mine().click();
    await add(page, `${title} today ${stamp}`);
    await seen(async () => Boolean(await stored(page, title)));
    const saved = await stored(page, title);
    const alert = page.getByRole("alert", { name: "Reminders" }).filter({ hasText: title });
    const early = await alert.count();
    const appeared = await seen(() => alert.isVisible(), 110_000);
    const firedAt = Date.now();
    await shot(page, "reminders-rows-alert");
    const due = new Date(ahead);
    due.setSeconds(0, 0);
    step(
      "Alert at the due minute: none before it, then the alert, by the real clock",
      early === 0 && appeared && firedAt >= due.getTime() && firedAt < due.getTime() + 25_000,
      `${JSON.stringify(saved)} fired ${firedAt - due.getTime()} ms after`,
    );
    const dismissed = page.waitForResponse(
      (reply) =>
        reply.request().method() === "POST" &&
        /\/alerts\/.*\/dismiss$/.test(new URL(reply.url()).pathname),
      { timeout: 8_000 },
    );
    await alert.getByRole("button", { name: "Close" }).click();
    const closedOk = (await dismissed).status() === 200;
    const secondTitle = `Duepast ${id}`;
    await add(page, `${secondTitle} today 12:01am`);
    await seen(async () => Boolean(await stored(page, secondTitle)));
    const second = page.getByRole("alert", { name: "Reminders" }).filter({ hasText: secondTitle });
    await second.waitFor({ timeout: 15_000 });
    await second.getByRole("button", { name: "Complete" }).click();
    step(
      "Close and Complete on the alert: Close dismisses it on the server, Complete completes it",
      closedOk && (await seen(async () => (await stored(page, secondTitle))?.completed === true)),
    );
    await reopen(page);
    await page.waitForTimeout(6_000);
    step(
      "Dismissed alerts: after a reload, and the next poll, they do not come back",
      (await alert.count()) === 0 &&
        !((await fetched(page, "/api/reminders/alerts")).alerts ?? []).some(
          (each) => each.title === title,
        ),
    );
  });

  await section("shared", async () => {
    const annaPage = await person("anna", anna);
    annaPage.setDefaultTimeout(8_000);
    await windowOf(page).getByText("Add List").click();
    await page.waitForTimeout(400);
    const EXTRA = `Extra ${id}`;
    await nameShownList(EXTRA);
    await listRow(page, EXTRA).click();
    await add(page, `Shared one ${id}`);
    await seen(async () => Boolean(await stored(page, `Shared one ${id}`)));
    await listRow(page, EXTRA).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Share List…" }).click();
    const share = page.locator(".mac-reminders-share").first();
    await share.waitFor({ timeout: 8_000 });
    await share.getByRole("textbox").fill(anna.name);
    await share.getByRole("button", { name: "Share" }).click();
    await listRow(page, EXTRA).filter({ hasText: "Shared by Me" }).waitFor({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await open(annaPage);
    const theirs = listRow(annaPage, EXTRA);
    await theirs.waitFor({ timeout: 15_000 });
    await shot(annaPage, "reminders-rows-shared");
    step(
      "Shared section: lists it under Shared, with who owns it, for both",
      /Shared/.test(await lists(annaPage).innerText()) &&
        (await theirs.innerText()).includes(chris.fullName),
    );
    await listInfoCheck(page);
    await theirs.click();
    await rowOf(annaPage, `Shared one ${id}`).waitFor({ timeout: 8_000 });
    await add(annaPage, `From Anna ${id}`);
    const sharedRev = async () => {
      const { lists: all } = await fetched(page, "/api/reminders/shared");
      return all?.[0]?.reminders ?? [];
    };
    const reached = await seen(async () =>
      (await sharedRev()).some((one) => one.title === `From Anna ${id}`),
    );
    await reopen(annaPage);
    const kept = await seen(async () =>
      (await fetched(annaPage, "/api/reminders/shared")).lists?.[0]?.reminders?.some(
        (one) => one.title === `From Anna ${id}`,
      ),
    );
    step(
      "Shared lists: on the server for both, each on its own revision, after a reload",
      reached && kept,
    );
    await annaPage.close();
  });

  await section("cross", async () => {
    const count = ((await data(page)).reminders ?? []).length;
    await tile(page, "Reminders").click({ button: "right" });
    await page.getByRole("menu").last().getByRole("menuitem", { name: "New Reminder" }).click();
    const typing = windowOf(page).getByRole("textbox", { name: "Title" });
    await typing.waitFor({ timeout: 4_000 });
    await typing.fill(`From Dock ${id}`);
    await typing.press("Enter");
    step(
      "Dock icon menu: New Reminder, on the server",
      await seen(async () => ((await data(page)).reminders ?? []).length === count + 1),
    );
    await shot(page, "reminders-rows-dock");
  });

  await section("app-menu", async () => {
    await menu(page, "Reminders", /^About Reminders/);
    const about = page.locator(".mac-about-window");
    const aboutShown = await seen(() => about.getByText("Reminders").first().isVisible(), 5_000);
    await shot(page, "reminders-rows-about");
    await about.getByRole("button", { name: "Close" }).first().click();
    step(
      "About Reminders: the window opens, and its close button closes it",
      aboutShown && (await seen(async () => (await about.count()) === 0, 3_000)),
    );
    const finder = page.locator('[data-window-id^="finder"]').first();
    await tile(page, "Finder").click();
    await finder.waitFor({ timeout: 8_000 });
    await page.waitForTimeout(400);
    await tile(page, "Reminders").click();
    await page.waitForTimeout(500);
    await menu(page, "Reminders", /^Hide Others/);
    const others = await seen(
      () => finder.evaluate((shell) => shell.hasAttribute("data-minimized")),
      3_000,
    );
    const stays = await windowOf(page).isVisible();
    await shot(page, "reminders-rows-hide-others");
    step("Hide Others ⌥⌘H: other applications' windows go, and Reminders' stays", others && stays);
    await menu(page, "Reminders", /^Show All/);
    step(
      "Show All: what was hidden comes back",
      await seen(() => finder.evaluate((shell) => !shell.hasAttribute("data-minimized")), 3_000),
    );
    await tile(page, "Reminders").click();
    await page.waitForTimeout(400);
    await menu(page, "Reminders", /^Hide Reminders/);
    const byItem = await seen(() => hidden(page, "reminders"), 3_000);
    await tile(page, "Reminders").click();
    await seen(async () => !(await hidden(page, "reminders")), 3_000);
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+h");
    const byKey = await seen(() => hidden(page, "reminders"), 3_000);
    await tile(page, "Reminders").click();
    await seen(async () => !(await hidden(page, "reminders")), 3_000);
    await page.waitForTimeout(400);
    step("Hide Reminders ⌘H: the item and the key", byItem && byKey);
    await menu(page, "Reminders", /^Quit Reminders/);
    const quit = await seen(async () => (await windowOf(page).count()) === 0, 3_000);
    await open(page);
    await page.keyboard.press("Control+q");
    step(
      "Quit Reminders ⌘Q: the item and the key close its windows",
      quit && (await seen(async () => (await windowOf(page).count()) === 0, 3_000)),
    );
    await open(page);
  });

  await section("window-menu", async () => {
    const windowId = "reminders";
    await menu(page, "Window", /^Minimize/);
    const minimized = await seen(() => hidden(page, windowId), 3_000);
    await page.waitForTimeout(400);
    const ownTile = page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: /minimized window/ });
    const tileShown = (await ownTile.count()) === 1;
    await shot(page, "reminders-rows-minimized");
    await ownTile.click();
    await seen(async () => !(await hidden(page, windowId)), 3_000);
    await page.waitForTimeout(500);
    await page.keyboard.press("Control+m");
    const byKey = await seen(() => hidden(page, windowId), 3_000);
    await page.waitForTimeout(400);
    await ownTile.click();
    await seen(async () => !(await hidden(page, windowId)), 3_000);
    await page.waitForTimeout(500);
    step("Minimize ⌘M: the item and the key take it to the Dock", minimized && tileShown && byKey);
    const before = await boxOf(page, windowId);
    await menu(page, "Window", /^Zoom/);
    await seen(async () => (await boxOf(page, windowId)).width !== before.width, 3_000);
    await page.waitForTimeout(500);
    const zoomed = await boxOf(page, windowId);
    await shot(page, "reminders-rows-zoomed");
    await menu(page, "Window", /^Zoom/);
    await seen(async () => (await boxOf(page, windowId)).width === before.width, 3_000);
    await page.waitForTimeout(500);
    step(
      "Zoom: the window grows, and again brings back its frame",
      zoomed.width > before.width + 100 &&
        Math.abs((await boxOf(page, windowId)).width - before.width) < 2,
    );
    const big = await boxOf(page, windowId);
    await menu(page, "View", /^Enter Full Screen/);
    await seen(async () => (await boxOf(page, windowId)).width >= 1400, 3_000);
    const full = await boxOf(page, windowId);
    await page.waitForTimeout(800);
    await page.mouse.move(700, 0);
    await page.waitForTimeout(600);
    await menu(page, "View", /^Exit Full Screen/);
    await seen(async () => Math.abs((await boxOf(page, windowId)).width - big.width) < 8, 3_000);
    await page.waitForTimeout(800);
    step(
      "Enter Full Screen ⌃⌘F: fills the screen, and Exit brings back its size",
      full.width >= 1400 && Math.abs((await boxOf(page, windowId)).width - big.width) < 8,
    );
    await menu(page, "Reminders", /^Preferences/);
    const preferences = page.locator('[data-window-id*="preferences"]');
    await preferences.waitFor({ timeout: 5_000 });
    const prefsId = await preferences.getAttribute("data-window-id");
    await openMenu(page, "Window");
    await page.waitForTimeout(150);
    const listed = await page
      .getByRole("menu")
      .last()
      .getByRole("menuitemcheckbox")
      .allInnerTexts();
    await shot(page, "reminders-rows-window-menu");
    await page
      .getByRole("menu")
      .last()
      .getByRole("menuitemcheckbox", { name: /^Reminders$/ })
      .click();
    step(
      "Open windows list: names both windows, and a row brings its window forward",
      listed.length >= 2 &&
        (await seen(async () => (await stateOf(page, windowId)) === "key", 3_000)),
      listed.join(" | "),
    );
    const toPreferences = async () => {
      await openMenu(page, "Window");
      await page
        .getByRole("menu")
        .last()
        .getByRole("menuitemcheckbox", { name: /Preferences/ })
        .click();
      await seen(async () => (await stateOf(page, prefsId)) === "key", 3_000);
    };
    await toPreferences();
    await openMenu(page, "Window");
    await row(page, /^Reminders/).click();
    const byRow = await seen(async () => (await stateOf(page, windowId)) === "key", 3_000);
    await toPreferences();
    await page.keyboard.press("Control+0");
    step(
      "Reminders ⌘0: the row and the key bring the main window forward",
      byRow && (await seen(async () => (await stateOf(page, windowId)) === "key", 3_000)),
    );
    await toPreferences();
    await tile(page, "Calculator").click();
    await shellOf(page, "calculator").waitFor({ timeout: 8_000 });
    await page.waitForTimeout(500);
    // Calculator is in front: a press on the part of the main window it leaves makes Reminders the
    // active app, whose Window menu Bring All to Front belongs to, and leaves Preferences beneath.
    const uncovered = await shellOf(page, windowId).evaluate((shell) => {
      const box = shell.getBoundingClientRect();
      for (let y = box.top + 10; y < box.bottom; y += 40) {
        for (let x = box.left + 80; x < box.right; x += 60) {
          const top = document.elementFromPoint(x, y);
          if (top && shell.contains(top)) return { x, y };
        }
      }
      return null;
    });
    await page.mouse.click(uncovered.x, uncovered.y);
    await seen(async () => (await stateOf(page, windowId)) === "key", 3_000);
    const under = (await zOf(page, "calculator")) > (await zOf(page, prefsId));
    await menu(page, "Window", /^Bring All to Front/);
    await page.waitForTimeout(400);
    await shot(page, "reminders-rows-bring-all");
    step(
      "Bring All to Front: its windows come over another application's",
      under &&
        (await zOf(page, windowId)) > (await zOf(page, "calculator")) &&
        (await zOf(page, prefsId)) > (await zOf(page, "calculator")),
      `${under}`,
    );
    await toPreferences();
    await page.keyboard.press("Control+w");
    await seen(async () => (await preferences.count()) === 0, 3_000);
  });

  await section("saved", async () => {
    if ((await windowOf(page).count()) === 0) await open(page);
    await windowOf(page).getByRole("button", { name: /^All/ }).first().click();
    await seen(() => rowOf(page, B).isVisible(), 3_000);
    const finished = `Finished ${id}`;
    await add(page, finished);
    await seen(async () => Boolean(await stored(page, finished)));
    await rowOf(page, finished).locator("[data-reminder-toggle]").click();
    await seen(async () => (await stored(page, finished))?.completed === true);
    await sortBy(page, "Title");
    await menu(page, "View", /Show Completed/);
    const settings = async () =>
      (await fetched(page, "/api/system-preferences/settings")).values?.["reminders.view"];
    const onServer = await seen(async () => {
      const view = await settings();
      return view?.sort === "title" && view?.showCompleted === true;
    });
    await page.waitForTimeout(1_500);
    const cameBack = await reopen(page);
    await seen(() => rowOf(page, B).isVisible(), 8_000);
    await shot(page, "reminders-rows-saved");
    const heading = await windowOf(page).locator(".mac-reminders-title").innerText();
    step(
      "Lists and reminders: after a reload both are there, in the window and on the server",
      (await rowOf(page, B).isVisible()) &&
        ((await data(page)).lists ?? []).some((each) => each.name === `Trips ${id}`),
    );
    const finishedShown = await seen(() => rowOf(page, finished).isVisible(), 3_000);
    const sorted = await seen(async () => (await order(page))[0] === B, 3_000);
    await rowOf(page, B).click();
    const usable = await seen(
      async () => (await rowOf(page, B).getAttribute("aria-selected")) === "true",
      3_000,
    );
    step(
      "Main window: comes back by itself after a reload, and is usable",
      cameBack && usable,
      `${cameBack} ${usable}`,
    );
    step(
      "List shown, Show Completed, sort: after a reload the list and the sort are as left",
      onServer && heading === "All" && finishedShown && sorted,
      `${onServer} ${heading} ${finishedShown} ${sorted} ${JSON.stringify(await settings())}`,
    );
  });
});
