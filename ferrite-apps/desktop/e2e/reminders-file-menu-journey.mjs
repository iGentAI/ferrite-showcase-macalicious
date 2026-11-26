#!/usr/bin/env node
// Reminders' File menu, Preferences and sidebar, in a real browser against the running app. Export gives an
// .ics, Import reads it back into another list; Default List says where a reminder from a smart list goes;
// Hide Sidebar stays hidden after a reload. Exits 0 only when every step passed and no page logged a console
// error, a page error, a failed request or an HTTP error.
//
//   node e2e/reminders-file-menu-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { readFile } from "node:fs/promises";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-file-menu");
const id = Date.now().toString(36);
const chris = { name: `rfchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const TITLE = `Oats ${id}`;
const LATER = `Later ${id}`;

const stored = async (page) => {
  const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
  return (await reply.json()).data;
};
const seen = (check) => within(10_000, check).then((took) => took !== null);
const windowOf = (page) => page.getByRole("region", { name: "Reminders" });
const sidebarRow = (page, name) =>
  windowOf(page).locator(".mac-reminders-sidebar-pane").getByText(name, { exact: true }).first();
const menu = async (page, title, item) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .locator('[role^="menuitem"]', { hasText: item })
    .first()
    .click();
};
const newReminder = async (page, title) => {
  await windowOf(page).getByRole("button", { name: "New Reminder" }).click();
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  await windowOf(page)
    .getByRole("option")
    .filter({ hasText: title })
    .first()
    .waitFor({ timeout: 5_000 });
};

await run({}, {}, async ({ person: open }) => {
  const page = await open("chris", chris);
  await openFromDock(page, "Reminders");
  await sidebarRow(page, "Work").click();
  await newReminder(page, TITLE);
  await page.waitForTimeout(600);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    menu(page, "File", /^Export/),
  ]);
  const text = await readFile(await download.path(), "utf8");
  step(
    "Export gives an .ics of the list",
    /\.ics$/.test(download.suggestedFilename()) && text.includes(`SUMMARY:${TITLE}`),
  );

  await sidebarRow(page, "Reminders").click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    menu(page, "File", "Import"),
  ]);
  await chooser.setFiles({
    name: "work.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(text),
  });
  step(
    "Import reads it back into the list shown",
    await seen(async () => {
      const data = await stored(page);
      return data?.reminders.some((each) => each.title === TITLE && each.listId === "reminders");
    }),
  );

  await menu(page, "Reminders", /^Preferences/);
  const preferences = page.locator(".mac-reminders-preferences");
  await preferences.waitFor({ timeout: 10_000 });
  await preferences.getByRole("combobox", { name: "Default List" }).click();
  await page.locator("[data-base-ui-portal]").getByRole("option", { name: "Work" }).click();
  await page.waitForTimeout(300);
  await shot(page, "reminders-preferences");
  await preferences.getByRole("button", { name: /close/i }).first().click();

  await windowOf(page).getByText("All", { exact: true }).first().click();
  await newReminder(page, LATER);
  step(
    "a reminder from a smart list goes to the Default List",
    await seen(async () => {
      const data = await stored(page);
      return data?.reminders.some((each) => each.title === LATER && each.listId === "work");
    }),
  );

  await menu(page, "View", "Hide Sidebar");
  step(
    "Hide Sidebar hides the lists",
    await seen(
      async () => !(await windowOf(page).locator(".mac-reminders-sidebar-pane").isVisible()),
    ),
  );
  await page.waitForTimeout(600);
  await shot(page, "reminders-sidebar-hidden");
  await page.reload({ waitUntil: "load" });
  await openFromDock(page, "Reminders").catch(() => {});
  step(
    "and stays hidden after a reload",
    await seen(async () => {
      const pane = windowOf(page).locator(".mac-reminders-sidebar-pane");
      return (await pane.count()) === 1 && !(await pane.isVisible());
    }),
  );
  await menu(page, "View", "Show Sidebar");
  step(
    "Show Sidebar brings them back",
    await seen(() => windowOf(page).locator(".mac-reminders-sidebar-pane").isVisible()),
  );
});
