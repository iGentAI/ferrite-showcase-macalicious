#!/usr/bin/env node
// Calendar's batch of rows, in a real browser against the running app.
//   node e2e/calendar-batch-journey.mjs --browser chromium --url http://127.0.0.1:8837 --out <dir>
import { readFileSync } from "node:fs";
import {
  blocks,
  named,
  openCalendar,
  putEvents,
  reopen,
  seen,
  stored,
  timed,
  weekDay,
  windowOf,
} from "./calendar-kit.mjs";
import { twoPeople } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-batch");
const id = Date.now().toString(36);
const chris = { name: `cxchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const bar = (page, name) =>
  page.getByRole("menubar").getByRole("menuitem", { name, exact: true }).first();
const lastMenu = (page) => page.getByRole("menu").last();
const calendarsOf = (page) =>
  page.evaluate(async () => (await (await fetch("/api/calendar/events")).json()).calendars);
const block = (page, title) => blocks(page).filter({ hasText: title }).first();

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  await openCalendar(page);

  await bar(page, "Calendar").click();
  step(
    "Calendar menu holds Accounts…",
    await seen(() => lastMenu(page).getByRole("menuitem", { name: "Accounts…" }).isVisible()),
  );
  await shot(page, "calendar-menu");
  step(
    "Services opens with what applies",
    await lastMenu(page).getByRole("menuitem", { name: "Services" }).isVisible(),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  await bar(page, "Help").click();
  step(
    "Help has its search field and Calendar Help",
    await seen(
      async () =>
        (await page
          .getByRole("searchbox")
          .or(page.getByRole("textbox", { name: /search/i }))
          .count()) > 0 &&
        (await page.getByRole("menuitem", { name: "Calendar Help" }).isVisible()),
    ),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  await bar(page, "Window").click();
  const availability = lastMenu(page).getByRole("menuitem", { name: "Availability Panel" });
  step(
    "Availability Panel is dimmed and says why",
    (await availability.getAttribute("aria-disabled")) === "true" &&
      /free and busy/.test((await availability.getAttribute("title")) ?? ""),
  );
  await shot(page, "window-menu");
  await page.getByRole("menuitem", { name: "Address Panel" }).click();
  step(
    "Address Panel opens",
    await seen(() => page.getByRole("region", { name: "Address Panel" }).isVisible()),
  );
  await shot(page, "address-panel");
  await bar(page, "Window").click();
  await lastMenu(page).getByRole("menuitem", { name: "Hide Address Panel" }).click();

  await bar(page, "View").click();
  await lastMenu(page).getByRole("menuitem", { name: "Show Alternate Calendar" }).click();
  await page.getByRole("menuitemradio", { name: "Hebrew" }).click();
  const heading = windowOf(page).locator(".mac-calendar-week-grid-day").first();
  step(
    "Hebrew dates show on the week's headings",
    await seen(async () => /\D/.test((await heading.getAttribute("data-alternate")) ?? "")),
  );
  const after = await heading.evaluate((el) => getComputedStyle(el, "::after").content);
  step("and are drawn", after.length > 2 && after !== "none");
  const shade = await windowOf(page)
    .locator(".mac-calendar-week-grid-column")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  step("the hours outside the day are shaded", shade.includes("linear-gradient"));
  await shot(page, "alternate-and-off-hours");
  await reopen(page);
  step(
    "the alternate calendar is there after a reload",
    await seen(async () =>
      Boolean(
        await windowOf(page)
          .locator(".mac-calendar-week-grid-day")
          .first()
          .getAttribute("data-alternate"),
      ),
    ),
  );

  await putEvents(page, [
    timed("a", "Lunch", weekDay(2, 12), 60, { location: "Cafe Luna", alert: 15, showAs: "free" }),
  ]);
  await reopen(page);

  await block(page, "Lunch").dblclick();
  const popover = page.locator(".mac-calendar-popover");
  await popover.waitFor();
  step(
    "the popover offers the location in Maps",
    await popover.getByRole("button", { name: "Show in Maps" }).isVisible(),
  );
  await popover.getByRole("button", { name: /Add Notes/ }).click();
  const notes = popover.getByRole("textbox", { name: /Notes/ });
  await notes.click();
  await page.keyboard.type('say "hi', { delay: 20 });
  step("a typed quote turns curly in the notes", (await notes.inputValue()) === "say “hi");
  await bar(page, "Edit").click();
  const spelling = lastMenu(page).getByRole("menuitem", { name: "Spelling and Grammar" });
  step(
    "Spelling and Substitutions act on the notes",
    (await spelling.getAttribute("aria-disabled")) !== "true",
  );
  await shot(page, "edit-menu");
  await spelling.click();
  await page.getByRole("menuitem", { name: "Show Spelling and Grammar" }).click();
  step(
    "Show Spelling and Grammar opens its panel",
    await seen(() => page.getByRole("dialog", { name: "Spelling and Grammar" }).isVisible()),
  );
  await shot(page, "spelling-panel");
  await page
    .getByRole("dialog", { name: "Spelling and Grammar" })
    .getByRole("button", { name: /close/i })
    .click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  await block(page, "Lunch").click({ button: "right" });
  await shot(page, "event-menu");
  const menu = lastMenu(page);
  step(
    "the event's menu dims Mail Event with its reason",
    (await menu.getByRole("menuitem", { name: "Mail Event" }).getAttribute("title")) ===
      "Nobody is invited to this event.",
  );
  await menu.getByRole("menuitem", { name: "Show in Maps" }).click();
  step(
    "Show in Maps opens Maps",
    await seen(() => page.getByRole("region", { name: "Maps" }).first().isVisible(), 15_000),
  );
  await shot(page, "maps");
  await page
    .getByRole("button", { name: /^Calendar$/ })
    .first()
    .click();
  await windowOf(page).waitFor();

  const day = windowOf(page)
    .locator(".mac-calendar-sidebar [data-date]:not([data-outside])")
    .nth(14);
  await day.click({ button: "right" });
  await shot(page, "mini-month-menu");
  await lastMenu(page).getByRole("menuitem", { name: "Show Day" }).click();
  step(
    "a mini month's Show Day opens that day",
    await seen(
      async () => (await windowOf(page).locator(".mac-calendar-week-grid-day").count()) === 1,
    ),
  );
  await bar(page, "View").click();
  await lastMenu(page).locator('[role^="menuitem"]', { hasText: "By Week" }).click();

  const before = (await calendarsOf(page)).map((each) => each.name);
  await windowOf(page)
    .locator(`[data-calendar="${(await calendarsOf(page))[1].id}"]`)
    .dragTo(windowOf(page).locator(`[data-calendar="${(await calendarsOf(page))[0].id}"]`));
  step(
    "a calendar dragged up the list goes before the other, on the server",
    await seen(
      async () =>
        (await calendarsOf(page)).map((each) => each.name).join() === [before[1], before[0]].join(),
    ),
  );
  await shot(page, "reordered");
  await windowOf(page).getByRole("button", { name: "Today" }).click();
  await block(page, "Lunch").waitFor();

  const name = await block(page, "Lunch").evaluate(async (el) => {
    const data = new DataTransfer();
    data.items.add(new File(["hello"], "plan.txt", { type: "text/plain" }));
    for (const type of ["dragover", "drop"]) {
      el.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
      );
    }
    return data.files[0]?.name;
  });
  step(
    `a file (${name}) dropped on the event's block goes on the event, on the server`,
    await seen(
      async () => named(await stored(page), "Lunch")?.attachments?.[0]?.name === "plan.txt",
      15_000,
    ),
  );

  const download = page.waitForEvent("download");
  await bar(page, "File").click();
  await lastMenu(page).getByRole("menuitem", { name: "Export", exact: true }).click();
  await page.getByRole("menuitem", { name: "Calendar Archive…" }).click();
  const file = await download;
  const path = await file.path();
  step("the archive downloads as .icbu", file.suggestedFilename().endsWith(".icbu"));
  step(
    "it holds the alert and the invitable fields",
    /TRIGGER:-PT15M/.test(readFileSync(path, "utf8")) &&
      /TRANSP:TRANSPARENT/.test(readFileSync(path, "utf8")),
  );
  await putEvents(page, []);
  await reopen(page);
  await windowOf(page)
    .locator('input[aria-label="iCalendar file"]')
    .or(page.locator('input[aria-label="iCalendar file"]'))
    .first()
    .setInputFiles({
      name: file.suggestedFilename(),
      mimeType: "application/json",
      buffer: readFileSync(path),
    });
  step(
    "Import brings its events back, on the server",
    await seen(async () => named(await stored(page), "Lunch")?.alert === 15, 15_000),
  );
  await shot(page, "imported");
  await page.getByRole("button", { name: "OK" }).click();

  const search = windowOf(page)
    .getByRole("searchbox")
    .or(windowOf(page).getByRole("textbox"))
    .first();
  await search.fill("Thanksgiving");
  step(
    "a holiday worked out for this year is found",
    await seen(() => windowOf(page).getByText("Thanksgiving").first().isVisible()),
  );
  await shot(page, "holiday");
  await search.fill("");

  await bar(page, "Calendar").click();
  await lastMenu(page).getByRole("menuitem", { name: "Accounts…" }).click();
  step(
    "Accounts… opens System Preferences on Internet Accounts",
    await seen(
      () =>
        page
          .getByRole("region", { name: /Internet Accounts/ })
          .first()
          .isVisible(),
      15_000,
    ),
  );
  await shot(page, "accounts");
});
