#!/usr/bin/env node
// Calendar groups, in a real browser against the running app: File > New Calendar Group and its key, a
// calendar moved in by the list's menu and by dragging, the group's checkbox over its calendars, a group
// closed, renamed and deleted with its calendars left, all of it after a reload. Exits 0 only when every
// step passed and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node e2e/calendar-groups-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                        [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-groups");
const id = Date.now().toString(36);
const chris = { name: `cgchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };

const windowOf = (page) => page.getByRole("region", { name: "Calendar" }).first();
const row = (page, name) =>
  windowOf(page)
    .getByRole("treeitem")
    .filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });
const seen = (check) => within(8_000, check).then((took) => took !== null);
const menu = async (page, title, item) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: item }).click();
};
const named = async (page, name) => {
  const field = page.getByRole("textbox", { name: "Calendar name" });
  await field.waitFor({ timeout: 5_000 });
  await field.fill(name);
  await page.keyboard.press("Enter");
};
const levelOf = (page, name) => row(page, name).getAttribute("aria-level");
const open = async (page) => {
  await openFromDock(page, "Calendar").catch(() => {});
  await within(15_000, () => windowOf(page).isVisible());
  await page.waitForTimeout(800);
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await open(page);

  await menu(page, "File", "New Calendar Group");
  await named(page, "Family");
  step(
    "File > New Calendar Group lists the group",
    await seen(() => row(page, "Family").isVisible()),
  );
  await within(
    5_000,
    async () => (await page.getByRole("textbox", { name: "Calendar name" }).count()) === 0,
  );
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+Shift+N");
  await named(page, "Job");
  step("its key makes another", await seen(() => row(page, "Job").isVisible()));

  await row(page, "Home").click({ button: "right" });
  const commands = page.getByRole("menu", { name: "Calendar commands" });
  await commands.getByRole("menuitem", { name: "Move to Group" }).click();
  await page.getByRole("menu").last().getByRole("menuitemradio", { name: "Family" }).click();
  step(
    "the list's menu moves a calendar into a group, a level in",
    await seen(async () => (await levelOf(page, "Home")) === "2"),
  );

  await row(page, "Work").dragTo(row(page, "Family"));
  step(
    "dragging a calendar onto a group moves it in",
    await seen(async () => (await levelOf(page, "Work")) === "2"),
  );
  await shot(page, "calendar-groups");

  const family = windowOf(page).getByRole("checkbox", { name: "Show Family" });
  const home = windowOf(page).getByRole("checkbox", { name: "Show Home" });
  await family.click();
  step(
    "the group's checkbox hides its calendars together",
    await seen(async () => !(await home.isChecked()) && !(await family.isChecked())),
  );
  await home.click();
  step(
    "one calendar shown leaves the group's checkbox mixed",
    await seen(async () => (await family.getAttribute("aria-checked")) === "mixed"),
  );
  await family.click();

  await row(page, "Family").locator(".mac-sidebar-triangle").click();
  step(
    "a closed group hides its calendars",
    await seen(async () => (await row(page, "Home").count()) === 0),
  );

  await page.waitForTimeout(800);
  await page.reload({ waitUntil: "load" });
  await open(page);
  step(
    "after a reload the groups are there, the closed one closed",
    await seen(
      async () =>
        (await row(page, "Job").isVisible()) &&
        (await row(page, "Family").getAttribute("aria-expanded")) === "false",
    ),
  );
  await row(page, "Family").locator(".mac-sidebar-triangle").click();
  step(
    "opened again it holds its calendars",
    await seen(async () => (await levelOf(page, "Work")) === "2"),
  );

  await row(page, "Family").click({ button: "right" });
  await commands.getByRole("menuitem", { name: "Rename" }).click();
  await named(page, "Household");
  step("Rename names it anew", await seen(() => row(page, "Household").isVisible()));

  await row(page, "Household").click({ button: "right" });
  await commands.getByRole("menuitem", { name: "Delete Group" }).click();
  step(
    "Delete Group leaves its calendars, back in the list",
    await seen(
      async () =>
        (await row(page, "Household").count()) === 0 && (await levelOf(page, "Home")) === "1",
    ),
  );
});
