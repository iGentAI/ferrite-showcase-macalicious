#!/usr/bin/env node
// A Reminders list in a window of its own, and Sort By > Creation Date, in a real browser against the running
// app: File > Open List in New Window and a double click on the row; a reminder added, completed and renamed
// there shows in the main window and on the server, and after a reload; closing it leaves the main window;
// a list deleted takes its window. Exits 0 only when every step passed and no page logged a console error, a
// page error, a failed request or an HTTP error.
//
//   node e2e/reminders-window-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                         [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-window");
const id = Date.now().toString(36);
const chris = { name: `rwchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const TITLES = [`Mango ${id}`, `Apple ${id}`];
const ADDED = `Zebra ${id}`;
const RENAMED = `Yak ${id}`;
const MAX_TITLE = 1000;

const main = (page) => page.locator('.mac-reminders[aria-label="Reminders"]').first();
const own = (page) => page.locator(".mac-reminders-list-window");
const row = (page, title) => main(page).getByRole("option").filter({ hasText: title }).first();
const seen = (check) => within(8_000, check).then((took) => took !== null);
const stored = async (page) => {
  const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
  return JSON.stringify(await reply.json());
};
const order = async (page) => {
  const rows = await main(page).getByRole("option").allInnerTexts();
  return rows
    .map((text) => [...TITLES, RENAMED].find((title) => text.includes(title)))
    .filter(Boolean)
    .join();
};
const menu = async (page, title, item) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: item }).click();
};
const open = async (page) => {
  await openFromDock(page, "Reminders").catch(() => {});
  await within(15_000, () => main(page).isVisible());
  await page.waitForTimeout(600);
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await open(page);
  for (const title of TITLES) {
    await page.keyboard.press("Control+N");
    await page.keyboard.type(title);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await within(4_000, () => row(page, title).isVisible());
  }

  await menu(page, "File", "Open List in New Window");
  step(
    "File > Open List in New Window shows the list in a window",
    await seen(() => own(page).isVisible()),
  );
  step(
    "it lists the list's reminders",
    await seen(async () => {
      const shown = (
        await own(page)
          .locator("input")
          .evaluateAll((all) => all.map((each) => each.value))
      ).join();
      return TITLES.every((title) => shown.includes(title));
    }),
  );

  await own(page).getByRole("textbox", { name: "New Reminder" }).fill(ADDED);
  await page.keyboard.press("Enter");
  step(
    "a reminder added there is in the main window and on the server",
    await seen(
      async () => (await row(page, ADDED).isVisible()) && (await stored(page)).includes(ADDED),
    ),
  );
  await shot(page, "reminders-list-window");

  const added = own(page).getByRole("listitem").last();
  await added.getByRole("textbox", { name: "Title" }).fill(RENAMED);
  await page.keyboard.press("Enter");
  step(
    "a title changed there is changed everywhere",
    await seen(
      async () => (await row(page, RENAMED).isVisible()) && (await stored(page)).includes(RENAMED),
    ),
  );

  await own(page)
    .getByRole("button", { name: `Completed: ${TITLES[0]}` })
    .click();
  step(
    "completing one there stays shown there, and is saved",
    await seen(
      async () =>
        (await own(page)
          .getByRole("button", { name: `Not completed: ${TITLES[0]}` })
          .isVisible()) && /"completed":true/.test(await stored(page)),
    ),
  );
  await own(page)
    .getByRole("button", { name: `Not completed: ${TITLES[0]}` })
    .click();
  await seen(async () => !/"completed":true/.test(await stored(page)));

  // Longer than a reminder keeps (MAX_TITLE in demos/reminders/reminders.tsx): saved cut to it, not refused.
  await own(page)
    .getByRole("textbox", { name: "New Reminder" })
    .fill("L".repeat(MAX_TITLE + 20));
  await page.keyboard.press("Enter");
  step(
    "a title too long to keep is cut to what is kept, added there",
    await seen(async () => (await stored(page)).includes(`"${"L".repeat(MAX_TITLE)}"`)),
  );
  await own(page)
    .getByRole("listitem")
    .last()
    .getByRole("textbox", { name: "Title" })
    .fill("M".repeat(MAX_TITLE + 20));
  await page.keyboard.press("Enter");
  step(
    "and renamed there",
    await seen(async () => (await stored(page)).includes(`"${"M".repeat(MAX_TITLE)}"`)),
  );

  await own(page).getByRole("button", { name: "Close" }).first().click();
  step(
    "its close button closes it and leaves the main window",
    await seen(async () => (await own(page).count()) === 0 && (await main(page).isVisible())),
  );

  await main(page).locator('[data-reminders-list][aria-selected="true"]').dblclick();
  step("a double click on the list's row opens it", await seen(() => own(page).isVisible()));
  await own(page).getByRole("button", { name: "Close" }).first().click();

  // Manual order apart from the order they were made in, or Creation Date would prove nothing.
  await row(page, RENAMED).dragTo(row(page, TITLES[0]), { targetPosition: { x: 40, y: 2 } });
  step(
    "dragged, Manual stands them apart from the order they were made",
    await seen(async () => (await order(page)) === [RENAMED, ...TITLES].join()),
    await order(page),
  );
  step(
    "the server keeps when each was made",
    await seen(async () => (await stored(page)).includes('"createdAt":')),
  );

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Sort By" }).first().hover();
  await page.getByRole("menuitemradio", { name: "Title", exact: true }).click();
  await seen(async () => (await order(page)) === [TITLES[1], TITLES[0], RENAMED].join());
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Sort By" }).first().hover();
  await page.getByRole("menuitemradio", { name: "Creation Date", exact: true }).click();
  const made = [...TITLES, RENAMED].join();
  step(
    "Sort By > Creation Date stands them in the order they were made",
    await seen(async () => (await order(page)) === made),
    await order(page),
  );

  await page.waitForTimeout(800);
  await page.reload({ waitUntil: "load" });
  await open(page);
  step(
    "after a reload the sort and the change made in the window are kept",
    await seen(async () => (await order(page)) === made),
    await order(page),
  );
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "View", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Sort By" }).first().hover();
  step(
    "and Sort By still has Creation Date checked",
    (await page
      .getByRole("menuitemradio", { name: "Creation Date", exact: true })
      .getAttribute("aria-checked")) === "true",
  );
});
