#!/usr/bin/env node
// Reminders' early reminder, in a real browser against the running app: choosing one in the info popover
// moves the alert the server is told about by that much and leaves the due minute alone, and a reload keeps
// it. Exits 0 only when every step passed and no page logged a console error, a page error, a failed
// request or an HTTP error.
//
//   node e2e/reminders-early-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("reminders-early");
const id = Date.now().toString(36);
const chris = { name: `rechris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const TITLE = `Early ${id}`;

const seen = (check) => within(10_000, check).then((took) => took !== null);
const windowOf = (page) => page.getByRole("region", { name: "Reminders" });
const rowOf = (page) => windowOf(page).getByRole("option").filter({ hasText: TITLE });
const stored = async (page) => {
  const reply = await page.request.get(new URL("/api/reminders/data", page.url()).href);
  return (await reply.json()).data?.reminders?.find((each) => each.title === TITLE);
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  const saves = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/reminders/data") {
      saves.push(request.postDataJSON());
    }
  });
  await openFromDock(page, "Reminders", undefined).catch(() => {});
  await within(15_000, () => windowOf(page).isVisible());
  await windowOf(page).getByRole("button", { name: "New Reminder" }).click();
  await page.keyboard.type(TITLE);
  await page.keyboard.press("Enter");
  await within(5_000, () => rowOf(page).isVisible());
  await rowOf(page).hover();
  await rowOf(page).locator("[data-reminder-info]").click();
  await page.getByRole("checkbox", { name: "On a Day" }).click();
  await page.getByRole("checkbox", { name: "At a Time" }).click();
  await within(10_000, async () => (await stored(page))?.dueTime);
  const saved = await stored(page);
  const alertBefore = async () =>
    saves.findLast((each) => each.alerts?.[saved.id])?.alerts[saved.id];
  await within(10_000, alertBefore);
  const before = await alertBefore();
  await page.getByRole("combobox", { name: "Early Reminder" }).click();
  await page
    .locator("[data-base-ui-portal]")
    .getByRole("option", { name: "15 minutes before" })
    .click();
  await shot(page, "reminders-early");
  step(
    "Early Reminder is kept on the server, and the due minute stays",
    await seen(async () => {
      const now = await stored(page);
      return now?.earlyMinutes === 15 && now.dueTime === saved.dueTime;
    }),
  );
  step(
    "the alert the server is told about moves 15 minutes earlier",
    await seen(async () => before - (await alertBefore()) === 15 * 60_000),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.reload();
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if (!(await windowOf(page).isVisible()))
    await openFromDock(page, "Reminders", undefined).catch(() => {});
  await within(10_000, () => rowOf(page).isVisible());
  await rowOf(page).hover();
  await rowOf(page).locator("[data-reminder-info]").click();
  step(
    "a reload keeps the choice",
    await seen(async () =>
      (await page.getByRole("combobox", { name: "Early Reminder" }).innerText()).includes(
        "15 minutes",
      ),
    ),
  );
});
