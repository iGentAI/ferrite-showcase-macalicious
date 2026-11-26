#!/usr/bin/env node
// Groups of lists on Ferrite, in a real browser against the running app: File > New Group with its
// name typed, a list dragged into it, lists reordered by dragging, the sidebar blank's menu, a group
// shown as its lists' reminders and collapsed, Ungroup; read from the server and after a reload. Exits
// 0 only when every step passed and no page logged a console error, a page error, a failed request or
// an HTTP error.
//
//   node e2e/reminders-groups-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                         [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-groups");
const id = Date.now().toString(36);
const person = { name: `rgchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const GROUP = `Home ${id}`;
const EMPTY = `Empty ${id}`;

const windowOf = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const lists = (page) => windowOf(page).getByRole("tree", { name: "Lists" });
const side = (page, name) =>
  lists(page)
    .getByRole("treeitem", { name: new RegExp(`^${name}`) })
    .first();
const listRow = async (page, name) => {
  const found = (await data(page)).lists.find((each) => each.name === name);
  return lists(page).locator(`[data-reminders-list="${found.id}"]`);
};
const data = async (page) => {
  const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
  return (await reply.json()).data;
};
const seen = (check) => within(10_000, check).then((took) => took !== null);
const names = (doc) => doc.lists.map((each) => each.name);
async function fileItem(page, name) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "File", exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name }).click();
}

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", person);
  await openFromDock(page, "Reminders");
  await windowOf(page).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  for (let made = 1; made <= 3; made++) {
    await page.keyboard.press("Control+Shift+n");
    await within(10_000, async () => (await data(page)).lists.length === made);
  }
  const first = names(await data(page));

  await fileItem(page, "New Group");
  const field = lists(page).getByRole("textbox", { name: "Group Name" });
  await field.waitFor({ timeout: 5_000 });
  await field.fill(GROUP);
  await field.press("Enter");
  step(
    "File > New Group makes a named group, on the server",
    await seen(async () => (await data(page)).groups?.[0]?.name === GROUP),
  );

  await (await listRow(page, "New List 2")).dragTo(side(page, GROUP));
  step(
    "A list dragged onto the group goes into it, on the server",
    await seen(async () => {
      const doc = await data(page);
      return doc.lists.find((each) => each.name === "New List 2")?.groupId === doc.groups[0].id;
    }),
  );

  const before = names(await data(page));
  const others = before.filter((name) => name !== "New List 3");
  const wanted = others.flatMap((name) => (name === "New List" ? ["New List 3", name] : [name]));
  await (await listRow(page, "New List 3")).dragTo(await listRow(page, "New List"), {
    targetPosition: { x: 40, y: 2 },
  });
  step(
    "A list dragged above another goes there, and the others keep their order",
    JSON.stringify(before) !== JSON.stringify(wanted) &&
      (await seen(async () => JSON.stringify(names(await data(page))) === JSON.stringify(wanted))),
    JSON.stringify(names(await data(page))),
  );
  await page.waitForTimeout(300);
  await shot(page, "reminders-groups");

  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  step(
    "Group, membership and order are there after a reload",
    await seen(
      async () =>
        (await side(page, GROUP).isVisible()) &&
        (await (await listRow(page, "New List 2")).getAttribute("aria-level")) === "2",
    ),
  );

  await side(page, GROUP).locator(".mac-sidebar-triangle").click();
  step(
    "Its triangle hides its lists",
    await seen(async () => (await (await listRow(page, "New List 2")).count()) === 0),
  );
  await side(page, GROUP).locator(".mac-sidebar-triangle").click();
  const open2 = await listRow(page, "New List 2");
  await within(5_000, () => open2.isVisible());

  // The blank under the rows: a tile is not on a row either, and is always on screen.
  const box = await lists(page).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8, { button: "right" });
  const menu = page.getByRole("menu", { name: "List commands" });
  await menu.waitFor({ timeout: 5_000 });
  step(
    "The sidebar's blank offers New List and New Group, and no list's commands",
    (await menu.getByRole("menuitem", { name: "New Group" }).count()) === 1 &&
      (await menu.getByRole("menuitem", { name: "New List" }).count()) === 1 &&
      (await menu.getByRole("menuitem", { name: "Delete" }).count()) === 0,
  );
  await shot(page, "reminders-sidebar-blank-menu");
  await page.keyboard.press("Escape");

  await menu.waitFor({ state: "hidden", timeout: 5_000 });
  await fileItem(page, "New Group");
  const second = lists(page).getByRole("textbox", { name: "Group Name" });
  await second.waitFor({ timeout: 5_000 });
  await second.fill(EMPTY);
  await second.press("Enter");
  await within(5_000, () => side(page, EMPTY).isVisible());
  const order = async () =>
    (await lists(page).getByRole("treeitem").allInnerTexts()).map(
      (text) => text.trim().split("\n")[0],
    );
  const leading = (await data(page)).lists[0];
  await side(page, EMPTY).dragTo(await listRow(page, leading.name), {
    targetPosition: { x: 40, y: 2 },
  });
  const emptyFirst = async () => (await order(page))[0] === EMPTY;
  step(
    "A group with no list drags above the first list, on the server",
    await seen(
      async () =>
        (await data(page)).groups.find((each) => each.name === EMPTY)?.before === leading.id &&
        (await emptyFirst()),
    ),
    JSON.stringify(await order(page)),
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  step("It stands there after a reload", await seen(emptyFirst), JSON.stringify(await order(page)));

  const emptyBox = await side(page, EMPTY).boundingBox();
  await (await listRow(page, "New List")).dragTo(side(page, EMPTY), {
    targetPosition: { x: 40, y: emptyBox.height - 2 },
  });
  const behindEmpty = async () => {
    const now = await order(page);
    return now[0] === EMPTY && now[1] === "New List";
  };
  step(
    "A list dropped after a group with no list stands behind it",
    await seen(behindEmpty),
    JSON.stringify(await order(page)),
  );
  step(
    "That drop is on the server",
    await seen(async () => {
      const doc = await data(page);
      const moved = doc.lists.find((each) => each.name === "New List");
      return doc.groups.find((each) => each.name === EMPTY)?.before === moved.id;
    }),
    JSON.stringify(await data(page)),
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  await windowOf(page).waitFor({ timeout: 15_000 });
  step(
    "It stands behind it after a reload",
    await seen(behindEmpty),
    JSON.stringify(await order(page)),
  );

  const member = await listRow(page, "New List");
  const sibling = await listRow(page, "New List 2");
  await member.dragTo(side(page, GROUP));
  step(
    "A second list dragged onto the group goes into it",
    await seen(async () => {
      const doc = await data(page);
      const group = doc.groups.find((each) => each.name === GROUP);
      return doc.lists.find((each) => each.name === "New List")?.groupId === group.id;
    }),
  );
  await member.click({ button: "right" });
  await menu.waitFor({ timeout: 5_000 });
  step(
    "A list in a group offers its own commands and none of the group's",
    (await menu.getByRole("menuitem", { name: "Delete" }).count()) === 1 &&
      (await menu.getByRole("menuitem", { name: "Ungroup" }).count()) === 0 &&
      (await menu.getByRole("menuitem", { name: "Rename" }).count()) === 0,
  );
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden", timeout: 5_000 });
  const blank = await lists(page).boundingBox();
  await member.dragTo(lists(page), {
    targetPosition: { x: blank.width / 2, y: blank.height - 8 },
  });
  const leftAlone = async () => {
    const doc = await data(page);
    const group = doc.groups.find((each) => each.name === GROUP);
    return (
      group !== undefined &&
      doc.lists.find((each) => each.name === "New List")?.groupId === undefined &&
      doc.lists.find((each) => each.name === "New List 2")?.groupId === group.id &&
      (await sibling.getAttribute("aria-level")) === "2" &&
      (await member.getAttribute("aria-level")) === "1"
    );
  };
  step(
    "A list dragged out of a group leaves alone: the group and its other list stay",
    await seen(leftAlone),
    JSON.stringify((await data(page)).lists),
  );
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  await windowOf(page).waitFor({ timeout: 15_000 });
  step("It stays out after a reload", await seen(leftAlone));

  await side(page, GROUP).click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Ungroup" }).click();
  step(
    "Ungroup takes the group away and keeps its lists, on the server and in the sidebar",
    await seen(async () => {
      const doc = await data(page);
      return (
        !(doc.groups ?? []).some((each) => each.name === GROUP) &&
        doc.lists.every((each) => !each.groupId) &&
        doc.lists.length === first.length &&
        names(doc).includes("New List 2") &&
        (await side(page, GROUP).count()) === 0 &&
        (await sibling.getAttribute("aria-level")) === "1"
      );
    }),
  );
});
