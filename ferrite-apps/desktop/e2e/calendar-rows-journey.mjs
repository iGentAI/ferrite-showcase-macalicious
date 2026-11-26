#!/usr/bin/env node
// The rows of Calendar's inventory (features/calendar.md) that had only code behind them, each by real input in a real
// browser against the running app, read back from the server and after a reload where the row keeps data. Each step's
// label starts with its row's name, and each section leaves a screenshot `calendar-rows-<section>`. Two accounts: Chris,
// and Anna, whom he invites. Exits 0 only when every step passed and no page logged a console error, a page error, a
// failed request or an HTTP error.
//
//   node e2e/calendar-rows-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                      [--browser chromium|chrome|firefox|webkit]

import { readFile } from "node:fs/promises";
import {
  blocks,
  named,
  openCalendar,
  putEvents,
  reopen,
  seen,
  stored,
  storedSettings,
  timed,
  weekDay,
  windowOf,
} from "./calendar-kit.mjs";
import { twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("calendar-rows");
const id = Date.now().toString(36);
const chris = { name: `crchris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const anna = { name: `cranna-${id}`, fullName: `Anna ${id}`, password: `tide-${id}-pool` };
const DAY = 864e5;
const HOUR = 36e5;

const bar = (page) => page.getByRole("menubar");
const row = (page, name) =>
  page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name })
    .or(page.getByRole("menu").last().getByRole("menuitemcheckbox", { name }))
    .first();
const openMenu = async (page, title) => {
  await bar(page).getByRole("menuitem", { name: title, exact: true }).first().click();
  await page.getByRole("menu").last().waitFor({ timeout: 5_000 });
};
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
const block = (page, title) => blocks(page).filter({ hasText: title }).first();
const popover = (page) => page.locator(".mac-calendar-popover").first();
const heading = (page) =>
  page.locator(".mac-calendar-heading-title, .mac-calendar-week-grid-title").first();
const viewPressed = (page, name) =>
  windowOf(page)
    .getByRole("group", { name: "View" })
    .getByRole("button", { name, exact: true })
    .getAttribute("aria-pressed")
    .then((value) => value === "true");
const tree = (page) => windowOf(page).getByRole("tree", { name: "Calendars" });
const calendarsOf = async (page) => {
  const reply = await page.request.get(new URL("/api/calendar/events", page.url()).href);
  return (await reply.json()).calendars ?? [];
};
const driveFile = async (page, name) => {
  let found = null;
  await within(15_000, async () => {
    const reply = await page.request.get(new URL("/api/files/", page.url()).href);
    const { entries } = await reply.json();
    found = entries?.find((entry) => entry.name === name && !entry.trashed_ms) ?? null;
    return found !== null;
  });
  return found;
};
const driveText = async (page, file) => {
  const url = new URL(`/api/files/content/${file.id}?piece=0&count=8`, page.url()).href;
  return (await page.request.get(url)).text();
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
const day = (at) => {
  const date = new Date(at);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
};
const ics = (lines) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//rows//EN", ...lines, "END:VCALENDAR", ""].join(
    "\r\n",
  );
/** The report an import ends with, after File > Import… with `text` and the sheet's Import. */
const importFile = async (page, name, text, open = () => menu(page, "File", /^Import…/)) => {
  const choosing = page.waitForEvent("filechooser", { timeout: 10_000 });
  await open();
  await (await choosing).setFiles({ name, mimeType: "text/calendar", buffer: Buffer.from(text) });
  const sheet = page.getByRole("dialog", { name: "Import Events" });
  await sheet.waitFor({ timeout: 10_000 });
  await sheet.getByRole("button", { name: "Import" }).click();
  return report(page);
};
const report = async (page) => {
  const alert = page.getByRole("alertdialog");
  await alert.waitFor({ timeout: 10_000 });
  const text = (await alert.innerText()).replace(/\s+/g, " ");
  await alert.getByRole("button", { name: "OK" }).click();
  return text;
};
const downloaded = async (page, open) => {
  const waiting = page.waitForEvent("download", { timeout: 10_000 });
  await open();
  const download = await waiting;
  return {
    name: download.suggestedFilename(),
    text: await readFile(await download.path(), "utf8"),
  };
};
const printed = async (page, open) => {
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
  await open();
  let html = "";
  await within(10_000, async () => {
    html = (await page.evaluate(() => window.printedPage)) ?? "";
    return html !== "";
  });
  return html;
};
const drag = async (page, locator, where, dx, dy) => {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y =
    where === "bottom"
      ? box.y + box.height - 2
      : where === "top"
        ? box.y + 2
        : box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 6 });
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
};
const sizes = (page) =>
  page.evaluate(() => {
    const grid = document.querySelector(".mac-calendar-body .mac-calendar-week-grid");
    const column = grid?.querySelector(".mac-calendar-week-grid-column");
    const height = grid
      ? Number.parseFloat(getComputedStyle(grid).getPropertyValue("--_height"))
      : 0;
    return { hour: height / 24, column: column?.getBoundingClientRect().width ?? 0 };
  });

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  page.setDefaultTimeout(8_000);
  const section = async (name, body) => {
    try {
      await closeMenus(page);
      for (let tries = 0; tries < 3 && (await popover(page).isVisible()); tries += 1) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
      }
      if ((await windowOf(page).count()) > 0 && (await windowOf(page).isVisible())) {
        await page.keyboard.press("Control+2");
        await windowOf(page).getByRole("button", { name: "Today" }).click();
        await page.waitForTimeout(150);
      }
      await body();
    } catch (error) {
      step(`${name}: the section ran to its end`, false, String(error.message).split("\n")[0]);
      await shot(page, `calendar-rows-${name}-failed`);
      await closeMenus(page);
    }
  };

  const a = weekDay(2, 10);
  const allDayStart = weekDay(3);
  const search = windowOf(page).getByRole("searchbox");
  await putEvents(page, [
    timed("a", "Alpha", a, 60, { calendar: "work", location: "Roofdeck", notes: "bring keys" }),
    timed("b", "Beta", weekDay(4, 13)),
    {
      id: "c",
      title: "Whole day",
      start: allDayStart,
      end: allDayStart + DAY,
      allDay: true,
      calendar: "home",
    },
  ]);
  await openCalendar(page);
  await page.keyboard.press("Control+2");

  await section("views", async () => {
    await seen(() => viewPressed(page, "Week"));
    const week = windowOf(page).locator(".mac-calendar-week-grid-day");
    await block(page, "Alpha").waitFor({ timeout: 10_000 });
    step(
      "Week: seven days, with an event in its day",
      (await week.count()) === 7 &&
        /^Alpha, Tuesday,/.test((await block(page, "Alpha").getAttribute("aria-label")) ?? ""),
      await block(page, "Alpha").getAttribute("aria-label"),
    );
    const line = windowOf(page).locator(".mac-calendar-week-grid-now").first();
    const placed = await line.evaluate((node) => {
      const grid = node.closest(".mac-calendar-week-grid");
      return {
        top: Number.parseFloat(node.style.top),
        height: Number.parseFloat(getComputedStyle(grid).getPropertyValue("--_height")),
        text: node.textContent,
      };
    });
    const now = new Date();
    const wanted = ((now.getHours() + now.getMinutes() / 60) / 24) * placed.height;
    step(
      "Current-time line: at the real clock's minute in today's column",
      Math.abs(placed.top - wanted) < 3 &&
        (await windowOf(page)
          .locator(".mac-calendar-week-grid-day[aria-current='date']")
          .count()) === 1,
      `at ${placed.top}, the clock says ${wanted}; reads ${placed.text}`,
    );
    const allDay = windowOf(page).locator(".mac-calendar-week-grid-all-day");
    step(
      "All-day row: an all-day event lies in it, and no timed one",
      (await allDay.getByText("Whole day").count()) === 1 &&
        (await allDay.getByText("Alpha").count()) === 0,
    );
    await shot(page, "calendar-rows-views");
    const mini = windowOf(page).locator(".mac-calendar-mini-month").first();
    const miniTitle = await mini.locator(".mac-calendar-mini-month-title").innerText();
    const today = await mini.locator("[aria-current='date']").getAttribute("data-date");
    await mini.getByRole("button", { name: "Next month" }).click();
    const moved = await seen(
      async () => (await mini.locator(".mac-calendar-mini-month-title").innerText()) !== miniTitle,
      3_000,
    );
    await mini.locator(".mac-calendar-mini-month-day:not([data-outside])").nth(14).click();
    const after = await heading(page).innerText();
    const wantedTitle = await mini.locator(".mac-calendar-mini-month-title").innerText();
    step(
      "Mini month: its arrow changes month, and a day chosen shows in the view",
      moved && today !== null && wantedTitle.startsWith(after.split(" ")[0]),
      `${miniTitle} to ${wantedTitle}, heading ${after}`,
    );
    await windowOf(page).getByRole("button", { name: "Today" }).click();
  });

  await section("toolbar", async () => {
    const list = windowOf(page).getByRole("button", { name: "Calendars", exact: true });
    await list.click();
    const gone = await seen(async () => !(await tree(page).isVisible()), 3_000);
    await shot(page, "calendar-rows-toolbar-list-hidden");
    await list.click();
    step(
      "Calendars: the toolbar's button hides and shows the list",
      gone && (await seen(() => tree(page).isVisible(), 3_000)),
    );
    const before = (await stored(page)).length;
    await windowOf(page).getByRole("button", { name: "New Event" }).click();
    const madeOnServer = await seen(async () => (await stored(page)).length === before + 1);
    step(
      "Plus, New Event: a new event, on the server, with its popover open",
      madeOnServer && (await popover(page).isVisible()),
    );
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await popover(page).waitFor({ state: "hidden", timeout: 3_000 });
    await putEvents(
      page,
      (await stored(page)).filter((event) => event.title !== "New Event"),
    );
    await menu(page, "View", /^Refresh Calendars/);
    await seen(async () => (await blocks(page).filter({ hasText: "New Event" }).count()) === 0);
    const group = windowOf(page).getByRole("group", { name: "View" });
    const wanted = {
      Day: async () => (await windowOf(page).locator(".mac-calendar-week-grid-day").count()) === 1,
      Month: async () => /[a-z] \d{4}$/.test(await heading(page).innerText()),
      Year: async () => /^\d{4}$/.test(await heading(page).innerText()),
      Week: async () => (await windowOf(page).locator(".mac-calendar-week-grid-day").count()) === 7,
    };
    let all = true;
    for (const [name, check] of Object.entries(wanted)) {
      await group.getByRole("button", { name, exact: true }).click();
      const ok = await seen(
        async () =>
          (await group.getByRole("button", { name, exact: true }).getAttribute("aria-pressed")) ===
            "true" && (await check()),
        4_000,
      );
      all &&= ok;
      console.log(`     ${name}: ${ok}`);
    }
    step("Day, Week, Month, Year switcher: each press shows that view", all);
    const monday = () => windowOf(page).locator(".mac-calendar-week-grid-day").first().innerText();
    const shown = await monday();
    await windowOf(page).getByRole("button", { name: "Next week" }).click();
    const next = await seen(async () => (await monday()) !== shown, 3_000);
    await windowOf(page).getByRole("button", { name: "Previous week" }).click();
    const back = await seen(async () => (await monday()) === shown, 3_000);
    await windowOf(page).getByRole("button", { name: "Next week" }).click();
    await windowOf(page).getByRole("button", { name: "Next week" }).click();
    await seen(async () => (await monday()) !== shown, 3_000);
    await windowOf(page).getByRole("button", { name: "Today" }).click();
    step(
      "Previous, Today, Next: each moves the week shown",
      next && back && (await seen(async () => (await monday()) === shown, 3_000)),
    );
    const results = windowOf(page).getByRole("listbox", { name: "Search results" });
    const finds = async (word) => {
      await search.fill(word);
      return seen(() => results.getByText("Alpha").first().isVisible(), 4_000);
    };
    const byTitle = await finds("alph");
    const byPlace = await finds("roofdeck");
    const byNotes = await finds("keys");
    await shot(page, "calendar-rows-toolbar-search");
    await search.fill("nothing-called-this");
    const none = await seen(async () => (await results.count()) === 0, 3_000);
    step(
      "Search field and results list: title, location and notes find it, and other words do not",
      byTitle && byPlace && byNotes && none,
      `${byTitle} ${byPlace} ${byNotes} ${none}`,
    );
    await search.fill("");
  });

  await section("sidebar", async () => {
    const text = await tree(page).innerText();
    step(
      "iCloud and Other sections: Home and Work under iCloud, the others under Other",
      /iCloud[\s\S]*Home[\s\S]*Work[\s\S]*Other/.test(text),
      text.replace(/\s+/g, " "),
    );
    await tree(page).getByRole("checkbox", { name: "Show Work" }).click();
    const off = await seen(async () => (await block(page, "Alpha").count()) === 0, 3_000);
    await shot(page, "calendar-rows-sidebar-unticked");
    await tree(page).getByRole("checkbox", { name: "Show Work" }).click();
    step(
      "Checkboxes that hide a calendar: Work's events go and come back, Home's stay",
      off && (await seen(() => block(page, "Alpha").isVisible(), 3_000)),
    );
  });

  await section("keyboard", async () => {
    await menu(page, "Calendar", /^Preferences/);
    const preferences = page.getByRole("region", { name: "General" });
    const byItem = await seen(() => preferences.isVisible(), 5_000);
    await page.keyboard.press("Control+w");
    await seen(async () => (await preferences.count()) === 0, 3_000);
    await windowOf(page).click({ position: { x: 300, y: 10 } });
    await page.keyboard.press("Control+,");
    const byKey = await seen(() => preferences.isVisible(), 5_000);
    step("Preferences… ⌘,: the item opens the second window", byItem);
    step("⌘, Preferences: the key opens it too", byKey);
    await shot(page, "calendar-rows-preferences");
    await page.keyboard.press("Control+w");
    await seen(async () => (await preferences.count()) === 0, 3_000);

    await block(page, "Beta").click();
    await page.keyboard.press("Enter");
    step("Return opens the popover", await seen(() => popover(page).isVisible(), 3_000));
    await page.keyboard.press("Escape");
    step(
      "Escape closes the popover",
      await seen(async () => !(await popover(page).isVisible()), 3_000),
    );

    const mini = windowOf(page).locator(".mac-calendar-mini-month").first();
    const focused = () =>
      page.evaluate(() => {
        const [year, month, date] = (document.activeElement?.dataset.date ?? "0-0-0")
          .split("-")
          .map(Number);
        return new Date(year, month - (month > 12 ? 1 : 1), date).getTime();
      });
    const todayKey = await mini.locator("[aria-current='date']").getAttribute("data-date");
    const [y, m, d] = todayKey.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    const moved = (days) => new Date(y, m - 1, d + days).getTime();
    await mini.locator("[aria-current='date']").focus();
    await page.keyboard.press("ArrowRight");
    const right = (await focused()) === moved(1);
    await page.keyboard.press("ArrowLeft");
    const left = (await focused()) === moved(0);
    await page.keyboard.press("ArrowDown");
    const down = (await focused()) === moved(7);
    await page.keyboard.press("ArrowUp");
    const up = (await focused()) === moved(0);
    await page.keyboard.press("Home");
    const home = (await focused()) === moved(-start.getDay());
    await page.keyboard.press("End");
    const end = (await focused()) === moved(6 - start.getDay());
    await page.keyboard.press("ArrowLeft");
    const held = await focused();
    await page.keyboard.press("PageDown");
    const later = new Date(await focused());
    const heldDate = new Date(held);
    const pageDown =
      later.getFullYear() * 12 +
        later.getMonth() -
        (heldDate.getFullYear() * 12 + heldDate.getMonth()) ===
      1;
    await page.keyboard.press("PageUp");
    const pageUp = (await focused()) === held;
    step(
      "Mini month's arrows, Home, End, Page Up, Page Down: each moves the keyboard to its day",
      right && left && down && up && home && end && pageDown && pageUp,
      `${right} ${left} ${down} ${up} ${home} ${end} ${pageDown} ${pageUp}`,
    );
    await shot(page, "calendar-rows-keyboard-mini-month");
    await windowOf(page).getByRole("button", { name: "Today" }).click();

    await putEvents(page, [
      ...(await stored(page)),
      timed("k1", "Keydel", weekDay(1, 9)),
      timed("k2", "Backdel", weekDay(1, 11)),
      timed("k3", "Mover", weekDay(2, 14)),
    ]);
    await menu(page, "View", /^Refresh Calendars/);
    await block(page, "Mover").waitFor({ timeout: 8_000 });
    await block(page, "Keydel").click();
    await page.keyboard.press("Delete");
    const del = await seen(async () => !named(await stored(page), "Keydel"));
    await block(page, "Backdel").click();
    await page.keyboard.press("Backspace");
    step(
      "Delete and Backspace: each deletes the selected event, on the server",
      del && (await seen(async () => !named(await stored(page), "Backdel"))),
    );
    await block(page, "Mover").click();
    const from = named(await stored(page), "Mover").start;
    await page.keyboard.press("ArrowDown");
    const quarter = await seen(
      async () => named(await stored(page), "Mover").start === from + 15 * 60_000,
    );
    await page.keyboard.press("ArrowRight");
    const aDay = await seen(
      async () => named(await stored(page), "Mover").start === from + 15 * 60_000 + DAY,
    );
    step(
      "Arrow keys that move a selected event: a quarter of an hour down and a day to the side",
      quarter && aDay,
    );
    const pressed = windowOf(page).locator('[data-event-id][aria-pressed="true"]');
    await block(page, "Mover").click();
    await page.keyboard.press("Tab");
    const nextOne = await seen(
      async () => (await pressed.count()) === 1 && (await pressed.innerText()).includes("Beta"),
      3_000,
    );
    const tabbedTo = await pressed.innerText();
    await page.keyboard.press("Shift+Tab");
    const back = await seen(async () => (await pressed.innerText()).includes("Mover"), 3_000);
    step(
      "Tab between events: Tab selects the next in time, Shift-Tab the one before",
      nextOne && back,
      tabbedTo.replace(/\s+/g, " "),
    );
    await shot(page, "calendar-rows-keyboard");
  });

  await section("popover", async () => {
    await windowOf(page).getByRole("button", { name: "New Event" }).click();
    await popover(page).waitFor({ timeout: 5_000 });
    const title = page.getByRole("textbox", { name: "Title" });
    await title.fill("Planning");
    await title.press("Enter");
    step(
      "Title: typed in the popover, on the server",
      await seen(async () => Boolean(named(await stored(page), "Planning"))),
    );
    const event = () => stored(page).then((all) => named(all, "Planning"));
    await popover(page).getByRole("button", { name: "Add Location" }).click();
    await popover(page).getByRole("textbox", { name: "Location" }).fill("Harbor");
    await page.keyboard.press("Enter");
    step(
      "Location: typed, shown and on the server",
      (await seen(async () => (await event()).location === "Harbor")) &&
        (await popover(page).getByText("Harbor").isVisible()),
    );
    await popover(page)
      .getByRole("button", { name: /^Calendar: / })
      .click();
    await page.getByRole("menuitemradio", { name: "Work", exact: true }).click();
    step(
      "Calendar menu: moves the event to the calendar chosen, on the server",
      await seen(async () => (await event()).calendar === "work"),
    );
    await popover(page)
      .getByRole("button", { name: /^Date: / })
      .click();
    const starts = popover(page).getByRole("group", { name: "Starts" });
    const ends = popover(page).getByRole("group", { name: "Ends" });
    const hourOf = (group) => group.getByRole("spinbutton", { name: /^hour/i }).first();
    const was = await event();
    await hourOf(starts).focus();
    await page.keyboard.press("ArrowUp");
    const startMoved = await seen(async () => {
      const now = await event();
      return now.start === was.start + HOUR && now.end === was.end + HOUR;
    });
    await hourOf(ends).focus();
    await page.keyboard.press("ArrowUp");
    step(
      "Starts and Ends: Starts moves the event whole, Ends makes it longer",
      startMoved &&
        (await seen(async () => {
          const now = await event();
          return now.start === was.start + HOUR && now.end === was.end + 2 * HOUR;
        })),
    );
    await popover(page).getByRole("checkbox", { name: "All-day" }).click();
    const whole = await seen(async () => (await event()).allDay === true);
    await shot(page, "calendar-rows-popover-all-day");
    await popover(page).getByRole("checkbox", { name: "All-day" }).click();
    step(
      "All-day: ticked on the server, and off again",
      whole && (await seen(async () => !(await event()).allDay)),
    );
    const choose = async (name, option) => {
      await popover(page).getByRole("combobox", { name, exact: true }).click();
      await page.getByRole("option", { name: option, exact: true }).click();
    };
    await choose("Repeat", "Every Week");
    await seen(async () => (await event()).repeat?.freq === "weekly");
    await choose("End repeat", "After");
    const after = await seen(async () => (await event()).repeat?.count === 10);
    const count = popover(page).getByRole("textbox", { name: "Occurrences" });
    await count.fill("3");
    await count.press("Enter");
    const three = await seen(async () => (await event()).repeat?.count === 3);
    await shot(page, "calendar-rows-popover-end-repeat");
    await choose("End repeat", "On Date");
    const onDate = await seen(async () => {
      const { repeat } = await event();
      return repeat?.until !== undefined && repeat?.count === undefined;
    });
    await choose("End repeat", "Never");
    const never = await seen(async () => {
      const { repeat } = await event();
      return repeat?.until === undefined && repeat?.count === undefined;
    });
    step(
      "End repeat: never, after a number, on a date, each on the server",
      after && three && onDate && never,
      `${after} ${three} ${onDate} ${never}`,
    );
    await choose("Repeat", "None");
    await seen(async () => !(await event()).repeat);
    await popover(page).getByRole("button", { name: "Done" }).click();
    await popover(page)
      .getByRole("button", { name: /^Add Notes/ })
      .click();
    await popover(page).getByRole("textbox", { name: "Notes" }).fill("Agenda first");
    await popover(page).getByRole("textbox", { name: "URL" }).fill("https://example.com/plan");
    await popover(page).getByRole("button", { name: "Done" }).click();
    step(
      "Notes and URL: both on the server, and the URL is a link in the popover",
      (await seen(async () => {
        const now = await event();
        return now.notes === "Agenda first" && now.url === "https://example.com/plan";
      })) &&
        (await popover(page).getByRole("link", { name: "https://example.com/plan" }).isVisible()),
    );
    await shot(page, "calendar-rows-popover");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await popover(page).waitFor({ state: "hidden", timeout: 3_000 });

    const series = weekDay(1, 15);
    await putEvents(page, [
      ...(await stored(page)),
      timed("rep", "Standing", series, 60, { repeat: { freq: "weekly" } }),
    ]);
    await menu(page, "View", /^Refresh Calendars/);
    await block(page, "Standing").waitFor({ timeout: 8_000 });
    await windowOf(page).getByRole("button", { name: "Next week" }).click();
    await block(page, "Standing").waitFor({ timeout: 5_000 });
    await block(page, "Standing").click();
    await page.keyboard.press("Delete");
    const ask = page.getByRole("alertdialog");
    await ask.waitFor({ timeout: 5_000 });
    await shot(page, "calendar-rows-popover-delete-alert");
    const alertBox = await ask.boundingBox();
    const onlyBox = await ask.getByRole("button", { name: "Delete Only This Event" }).boundingBox();
    const fits = onlyBox.x + onlyBox.width <= alertBox.x + alertBox.width;
    await ask.getByRole("button", { name: "Delete Only This Event" }).click();
    const only = await seen(async () => {
      const now = named(await stored(page), "Standing");
      return now.exdates?.length === 1 && now.exdates[0] === series + 7 * DAY && !now.repeat.until;
    });
    await windowOf(page).getByRole("button", { name: "Next week" }).click();
    await block(page, "Standing").waitFor({ timeout: 5_000 });
    await block(page, "Standing").click();
    await page.keyboard.press("Delete");
    await ask.waitFor({ timeout: 5_000 });
    await ask.getByRole("button", { name: "Delete All Future Events" }).click();
    const future = await seen(async () => {
      const now = named(await stored(page), "Standing");
      return now.repeat?.until !== undefined && now.repeat.until < series + 14 * DAY;
    });
    step(
      "Delete one or all future occurrences: the alert, one removed, then the series ended there",
      only && future && fits,
      `${only} ${future} ${fits}`,
    );
    await windowOf(page).getByRole("button", { name: "Today" }).click();
    await block(page, "Standing").waitFor({ timeout: 5_000 });

    const { hour, column } = await sizes(page);
    await drag(page, block(page, "Standing"), "middle", column, 0);
    await ask.waitFor({ timeout: 5_000 });
    await shot(page, "calendar-rows-popover-move-alert");
    const moveBox = await ask.boundingBox();
    const thisBox = await ask.getByRole("button", { name: "Only This Event" }).boundingBox();
    const moveFits = thisBox.x + thisBox.width <= moveBox.x + moveBox.width;
    await ask.getByRole("button", { name: "Only This Event" }).click();
    const single = await seen(async () => {
      const all = (await stored(page)).filter((each) => each.title === "Standing");
      const copy = all.find((each) => each.id !== "rep");
      return (
        all.length === 2 &&
        copy?.start === series + DAY &&
        !copy?.repeat &&
        all.find((each) => each.id === "rep").exdates?.includes(series)
      );
    });
    const allNow = await stored(page);
    await putEvents(page, [
      ...allNow.filter((each) => each.title !== "Standing"),
      timed("rep2", "Standing2", series, 60, { repeat: { freq: "weekly" } }),
    ]);
    await menu(page, "View", /^Refresh Calendars/);
    await block(page, "Standing2").waitFor({ timeout: 8_000 });
    await drag(page, block(page, "Standing2"), "middle", 0, -hour);
    await ask.waitFor({ timeout: 5_000 });
    await ask.getByRole("button", { name: "All Events" }).click();
    const whole2 = await seen(async () => {
      const now = named(await stored(page), "Standing2");
      return now.start === series - HOUR && now.repeat?.freq === "weekly" && !now.exdates?.length;
    });
    step(
      "Move one or all occurrences: the alert, Only This Event and All Events, on the server",
      single && whole2 && moveFits,
      `${single} ${whole2} ${moveFits}`,
    );
  });

  await section("drag", async () => {
    await block(page, "Beta").waitFor({ timeout: 5_000 });
    const { hour, column } = await sizes(page);
    const was = named(await stored(page), "Beta");
    await drag(page, block(page, "Beta"), "middle", -column, hour);
    const moved = await seen(async () => {
      const now = named(await stored(page), "Beta");
      return now.start === was.start - DAY + HOUR && now.end === was.end - DAY + HOUR;
    });
    await page.waitForTimeout(400);
    await drag(page, block(page, "Beta"), "bottom", 0, hour / 2);
    const resized = await seen(async () => {
      const now = named(await stored(page), "Beta");
      return now.start === was.start - DAY + HOUR && now.end === was.end - DAY + 1.5 * HOUR;
    });
    await shot(page, "calendar-rows-drag");
    await block(page, "Beta").dblclick();
    await popover(page).waitFor({ timeout: 3_000 });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await windowOf(page)
      .getByRole("group", { name: "View" })
      .getByRole("button", { name: "Day", exact: true })
      .click();
    await page.keyboard.press("Control+t");
    await menu(page, "View", /^Go to Date/);
    const sheet = page.getByRole("dialog", { name: "Go to Date" });
    await sheet.waitFor({ timeout: 3_000 });
    const target = new Date(was.start - DAY);
    const shown = await sheet.getByRole("spinbutton", { name: /day/i }).first();
    await shown.focus();
    const nowDay = new Date();
    const diff = target.getDate() - nowDay.getDate();
    const fromMonth = target.getMonth() - nowDay.getMonth();
    if (fromMonth === 0) {
      for (let i = 0; i < Math.abs(diff); i += 1)
        await page.keyboard.press(diff > 0 ? "ArrowUp" : "ArrowDown");
      await sheet.getByRole("button", { name: "Show" }).click();
    } else {
      await sheet.getByRole("button", { name: "Cancel" }).click();
      for (let i = 0; i < 7; i += 1) {
        if (await block(page, "Beta").isVisible()) break;
        await windowOf(page)
          .getByRole("button", { name: /^(Next|Previous) day$/ })
          .first()
          .click();
      }
    }
    await block(page, "Beta").waitFor({ timeout: 5_000 });
    const inDay = await sizes(page);
    await drag(page, block(page, "Beta"), "middle", 0, inDay.hour);
    const dayMoved = await seen(
      async () => named(await stored(page), "Beta").start === was.start - DAY + 2 * HOUR,
    );
    await page.waitForTimeout(400);
    await drag(page, block(page, "Beta"), "bottom", 0, inDay.hour / 2);
    const dayResized = await seen(async () => {
      const now = named(await stored(page), "Beta");
      return now.start === was.start - DAY + 2 * HOUR && now.end === was.end - DAY + 3 * HOUR;
    });
    step(
      "Move and resize in week and day: on the server, by 15-minute steps",
      moved && resized && dayMoved && dayResized,
      `${moved} ${resized} ${dayMoved} ${dayResized}`,
    );
    await page.keyboard.press("Control+2");
    await windowOf(page).getByRole("button", { name: "Today" }).click();
    const whole = blocks(page).filter({ hasText: "Whole day" }).first();
    await whole.waitFor({ timeout: 5_000 });
    await drag(page, whole, "middle", column, 0);
    step(
      "All-day event by whole days: dragged a column, a day later on the server",
      await seen(async () => {
        const now = named(await stored(page), "Whole day");
        return now.start === allDayStart + DAY && now.end === allDayStart + 2 * DAY;
      }),
    );
    await shot(page, "calendar-rows-drag-all-day");
  });

  await section("list-menu", async () => {
    const context = (name) =>
      tree(page).getByRole("treeitem", { name }).first().click({ button: "right" });
    await context(/Home/);
    await page.getByRole("menuitem", { name: "New Calendar", exact: true }).click();
    const naming = page.getByRole("textbox", { name: "Calendar name" });
    await naming.fill("Running");
    await naming.press("Enter");
    const made = await seen(async () =>
      (await calendarsOf(page)).some((each) => each.name === "Running"),
    );
    await context(/Running/);
    await page.getByRole("menuitem", { name: "Rename…" }).click();
    await naming.fill("Jogging");
    await naming.press("Enter");
    const renamed = await seen(async () =>
      (await calendarsOf(page)).some((each) => each.name === "Jogging"),
    );
    const colorOf = async () =>
      (await calendarsOf(page)).find((each) => each.name === "Jogging")?.color;
    const colorBefore = await colorOf();
    await context(/Jogging/);
    await page.getByRole("menuitem", { name: "Color" }).click();
    await page
      .getByRole("menuitemradio", { name: colorBefore === "purple" ? "Green" : "Purple" })
      .click();
    await closeMenus(page);
    const recolored = await seen(async () => (await colorOf()) !== colorBefore);
    await shot(page, "calendar-rows-list-menu");
    const exported = await downloaded(page, async () => {
      await context(/Work/);
      await page.getByRole("menuitem", { name: "Export “Work”…" }).click();
    });
    const fromMenu = exported.name === "Work.ics" && exported.text.includes("SUMMARY:Alpha");
    const importedText = await importFile(
      page,
      "list-menu.ics",
      ics([
        "BEGIN:VEVENT",
        "UID:list-menu@rows",
        `DTSTART;VALUE=DATE:${day(weekDay(5))}`,
        "SUMMARY:From the list",
        "END:VEVENT",
      ]),
      async () => {
        await context(/Jogging/);
        await page.getByRole("menuitem", { name: "Import…", exact: true }).click();
      },
    );
    const jogging = (await calendarsOf(page)).find((each) => each.name === "Jogging")?.id;
    const importedInto = await seen(
      async () => named(await stored(page), "From the list")?.calendar === jogging,
    );
    await context(/Jogging/);
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const ask = page.getByRole("alertdialog");
    await ask.waitFor({ timeout: 3_000 });
    await ask.getByRole("button", { name: /Delete/ }).click();
    const removed = await seen(async () =>
      (await calendarsOf(page)).every((each) => each.name !== "Jogging"),
    );
    step(
      "Calendar list: New Calendar, Rename…, Color, Delete, Import, Export, each read back",
      made && renamed && recolored && fromMenu && importedInto && removed,
      `${made} ${renamed} ${recolored} ${fromMenu} ${importedInto} ${removed}; ${importedText}`,
    );
  });

  await section("file", async () => {
    await menu(page, "File", /^New Calendar$/);
    const naming = page.getByRole("textbox", { name: "Calendar name" });
    await naming.waitFor({ timeout: 3_000 });
    await shot(page, "calendar-rows-file-new-calendar");
    await naming.fill("Filed");
    await naming.press("Enter");
    step(
      "New Calendar: asks the name in a sheet, and it is on the server",
      await seen(async () => (await calendarsOf(page)).some((each) => each.name === "Filed")),
    );
    await tree(page).getByRole("treeitem", { name: /Filed/ }).first().click();
    const imported = await importFile(
      page,
      "filed.ics",
      ics([
        "BEGIN:VEVENT",
        "UID:filed@rows",
        `DTSTART:${day(weekDay(5))}T090000`,
        `DTEND:${day(weekDay(5))}T100000`,
        "SUMMARY:Imported one",
        "END:VEVENT",
      ]),
    );
    const filedId = (await calendarsOf(page)).find((each) => each.name === "Filed")?.id;
    step(
      "Import…: an .ics from the computer, on the server in the calendar shown",
      imported.includes("1 event was imported") &&
        (await seen(async () => named(await stored(page), "Imported one")?.calendar === filedId)),
      imported,
    );
    const dump = await downloaded(page, () => menu(page, "File", /^Export “Filed”/));
    step(
      "Export “name”…: downloads the calendar",
      dump.name === "Filed.ics" && dump.text.includes("SUMMARY:Imported one"),
      dump.name,
    );
    await menu(page, "File", /^Save “Filed” to Drive/);
    const save = page.getByRole("dialog", { name: "Save" });
    await save.waitFor({ timeout: 8_000 });
    await shot(page, "calendar-rows-file-save");
    await save.getByLabel("Save As:").fill(`filed-${id}.ics`);
    await save.getByRole("button", { name: "Save", exact: true }).click();
    await save.waitFor({ state: "hidden", timeout: 8_000 });
    const onDrive = await driveFile(page, `filed-${id}.ics`);
    step(
      "Save “name” to Drive…: the calendar's file is on the drive",
      onDrive !== null && (await driveText(page, onDrive)).includes("SUMMARY:Imported one"),
    );

    await windowOf(page)
      .locator(".mac-calendar-week-grid-column")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await openMenu(page, "File");
    const noEvent = await row(page, /^Export Event/).getAttribute("aria-disabled");
    const noEventReason = await row(page, /^Export Event/).getAttribute("title");
    await closeMenus(page);
    await block(page, "Imported one").click();
    const one = await downloaded(page, () => menu(page, "File", /^Export Event/));
    step(
      "Export Event…: dimmed with a reason until one is selected, then downloads it",
      noEvent === "true" && Boolean(noEventReason) && one.text.includes("SUMMARY:Imported one"),
      `${noEvent} "${noEventReason}" ${one.name}`,
    );
    await menu(page, "File", /^Save Event to Drive/);
    await save.waitFor({ timeout: 8_000 });
    await save.getByLabel("Save As:").fill(`one-${id}.ics`);
    await save.getByRole("button", { name: "Save", exact: true }).click();
    await save.waitFor({ state: "hidden", timeout: 8_000 });
    const oneOnDrive = await driveFile(page, `one-${id}.ics`);
    step(
      "Save Event to Drive…: the event's file is on the drive",
      oneOnDrive !== null && (await driveText(page, oneOnDrive)).includes("SUMMARY:Imported one"),
    );
    await block(page, "Imported one").click();
    await page.keyboard.press("Delete");
    await seen(async () => !named(await stored(page), "Imported one"));
    await menu(page, "File", /^Import from Drive/);
    await page.waitForTimeout(500);
    await shot(page, "calendar-rows-file-import-drive");
    await page.getByRole("option", { name: `one-${id}.ics` }).dblclick();
    const sheet = page.getByRole("dialog", { name: "Import Events" });
    await sheet.waitFor({ timeout: 10_000 });
    await sheet.getByRole("button", { name: "Import" }).click();
    const again = await report(page);
    step(
      "Import from Drive…: the file on the drive brings the deleted event back",
      again.includes("1 event was imported") &&
        (await seen(async () => Boolean(named(await stored(page), "Imported one")))),
      again,
    );
    step(
      "Drive import and save: both ways with the person's drive, as above",
      Boolean(onDrive) && Boolean(named(await stored(page), "Imported one")),
    );
    await page.keyboard.press("Control+2");
    const html = await printed(page, () => menu(page, "File", /^Export as PDF/));
    step(
      "Export as PDF…: the page handed to the browser's print dialog lists the events shown",
      html.includes("Imported one") && html.includes("Alpha"),
    );
    await shot(page, "calendar-rows-file");
    const main = windowOf(page);
    await menu(page, "File", /^Close Window/);
    const closedByItem = await seen(async () => (await main.count()) === 0, 3_000);
    await openCalendar(page);
    await page.keyboard.press("Control+w");
    step(
      "Close Window ⌘W: the item and the key close it",
      closedByItem && (await seen(async () => (await main.count()) === 0, 3_000)),
    );
    await openCalendar(page);
  });

  await section("ics", async () => {
    const mine = "Round trip";
    await tree(page).getByRole("treeitem", { name: /Home/ }).first().click();
    await importFile(
      page,
      "round.ics",
      ics([
        "BEGIN:VEVENT",
        "UID:round@rows",
        `DTSTART:${day(weekDay(5))}T140000`,
        `DTEND:${day(weekDay(5))}T150000`,
        `SUMMARY:${mine}`,
        "RRULE:FREQ=WEEKLY",
        "END:VEVENT",
      ]),
    );
    await seen(async () => Boolean(named(await stored(page), mine)));
    const out = await downloaded(page, () => menu(page, "File", /^Export “Home”/));
    const beforeCount = (await stored(page)).filter((each) => each.title === mine).length;
    const text = await importFile(page, "home-again.ics", out.text);
    step(
      "Import and export of `.ics`: what is exported holds the event and its repeat, and importing it adds nothing",
      out.text.includes(`SUMMARY:${mine}`) &&
        out.text.includes("RRULE:FREQ=WEEKLY") &&
        beforeCount === 1 &&
        text.includes("0 events were imported") &&
        (await stored(page)).filter((each) => each.title === mine).length === 1,
      text,
    );

    const wkst = await importFile(
      page,
      "wkst.ics",
      ics([
        "BEGIN:VEVENT",
        "UID:wkst@rows",
        `DTSTART:${day(weekDay(0))}T080000`,
        `DTEND:${day(weekDay(0))}T090000`,
        "SUMMARY:Fortnight",
        "RRULE:FREQ=WEEKLY;INTERVAL=2;WKST=MO;BYDAY=SU,MO",
        "END:VEVENT",
      ]),
    );
    step(
      "**Ledger:** WKST: the rule that cannot be kept comes in as a single event, and the import says so",
      /imported as a single event/.test(wkst) &&
        !(await stored(page)).find((each) => each.title === "Fortnight")?.repeat,
      wkst,
    );

    const sunday = day(weekDay(0));
    await importFile(
      page,
      "tzid.ics",
      ics([
        "BEGIN:VEVENT",
        "UID:tzid@rows",
        `DTSTART;TZID=America/New_York:${sunday}T210000`,
        `DTEND;TZID=America/New_York:${sunday}T220000`,
        "SUMMARY:Evening zone",
        "RRULE:FREQ=WEEKLY;BYDAY=SU",
        "END:VEVENT",
      ]),
    );
    await seen(async () => Boolean(named(await stored(page), "Evening zone")));
    const zoned = named(await stored(page), "Evening zone");
    await windowOf(page).getByRole("button", { name: "Next week" }).click();
    const zonedBlock = block(page, "Evening zone");
    await zonedBlock.waitFor({ timeout: 5_000 });
    const label = (await zonedBlock.getAttribute("aria-label")) ?? "";
    const utc = new Intl.DateTimeFormat().resolvedOptions().timeZone === "UTC";
    const expectedDay = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
      new Date(zoned.start + 7 * DAY),
    );
    step(
      "**Ledger:** TZID recurrences: kept in its own zone with its written day, shown on the browser's clock",
      zoned.timeZone === "America/New_York" &&
        zoned.repeat?.days?.join() === "0" &&
        label.includes(expectedDay) &&
        (!utc || expectedDay === "Monday"),
      `${JSON.stringify(zoned.repeat)} ${zoned.timeZone}; ${label}`,
    );
    await windowOf(page).getByRole("button", { name: "Today" }).click();

    const series = new Date(weekDay(2, 16));
    const next = new Date(series.getTime() + 7 * DAY);
    const two = new Date(series.getTime() + 14 * DAY);
    const stamp = (date) => `${day(date.getTime())}T160000`;
    await importFile(
      page,
      "exceptions.ics",
      ics([
        "BEGIN:VEVENT",
        "UID:series@rows",
        `DTSTART:${stamp(series)}`,
        `DTEND:${day(series.getTime())}T170000`,
        "SUMMARY:Weekly series",
        "RRULE:FREQ=WEEKLY",
        `EXDATE:${stamp(next)}`,
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:series@rows",
        `RECURRENCE-ID:${stamp(two)}`,
        `DTSTART:${day(two.getTime())}T180000`,
        `DTEND:${day(two.getTime())}T190000`,
        "SUMMARY:Moved occurrence",
        "END:VEVENT",
      ]),
    );
    await windowOf(page).getByRole("button", { name: "Next week" }).click();
    await seen(
      async () => (await windowOf(page).locator(".mac-calendar-week-grid-day").count()) === 7,
    );
    await page.waitForTimeout(300);
    const goneNext = (await block(page, "Weekly series").count()) === 0;
    await windowOf(page).getByRole("button", { name: "Next week" }).click();
    const moved = block(page, "Moved occurrence");
    await moved.waitFor({ timeout: 5_000 });
    const original = (await block(page, "Weekly series").count()) === 0;
    await shot(page, "calendar-rows-ics");
    step(
      "**Ledger:** UID and RECURRENCE-ID exceptions: EXDATE takes one away, and RECURRENCE-ID replaces another",
      goneNext && original && /6 PM/.test((await moved.getAttribute("aria-label")) ?? ""),
      `${goneNext} ${original} ${await moved.getAttribute("aria-label")}`,
    );
    await windowOf(page).getByRole("button", { name: "Today" }).click();
  });

  await section("view-menu", async () => {
    const windowId = "calendar";
    const before = await boxOf(page, windowId);
    await menu(page, "View", /^Enter Full Screen/);
    await seen(async () => (await boxOf(page, windowId)).width >= 1400, 3_000);
    const full = await boxOf(page, windowId);
    await shot(page, "calendar-rows-view-menu-full-screen");
    await page.waitForTimeout(800);
    await page.mouse.move(700, 0);
    await page.waitForTimeout(600);
    await menu(page, "View", /^Exit Full Screen/);
    await seen(async () => Math.abs((await boxOf(page, windowId)).width - before.width) < 8, 3_000);
    await page.waitForTimeout(800);
    const back = await boxOf(page, windowId);
    step(
      "Enter Full Screen ⌃⌘F: fills the screen, and Exit brings back its size",
      full.width >= 1400 && full.height >= 800 && Math.abs(back.width - before.width) < 8,
      `${before.width} ${full.width}x${full.height} ${back.width}`,
    );
    const told = `Told ${id}`;
    await putEvents(page, [...(await stored(page)), timed("told", told, weekDay(3, 14))]);
    step(
      "A change stored elsewhere: the desktop's live stream shows it in the open window by itself",
      await seen(() => block(page, told).isVisible(), 6_000),
    );

    // Without the stream only Refresh Calendars can show what comes next. A 204 ends an EventSource with no error.
    await page.route("**/live/me*", (route) => route.fulfill({ status: 204 }));
    await reopen(page);
    await windowOf(page).click({ position: { x: 300, y: 10 } });
    const later = `Elsewhere ${id}`;
    const others = await stored(page);
    await putEvents(page, [...others, timed("far", later, weekDay(3, 16))]);
    await page.waitForTimeout(1_500);
    const notYet = (await block(page, later).count()) === 0;
    const marker = await page.evaluate(() => {
      window.notReloaded = true;
      return true;
    });
    await menu(page, "View", /^Refresh Calendars/);
    const byItem = await seen(() => block(page, later).isVisible(), 6_000);
    await putEvents(page, [...(await stored(page)), timed("far2", `${later} key`, weekDay(3, 18))]);
    await windowOf(page).click({ position: { x: 300, y: 10 } });
    await page.keyboard.press("Control+r");
    const byKey = await seen(() => block(page, `${later} key`).isVisible(), 6_000);
    const sameKeyPage = (await page.evaluate(() => window.notReloaded === true)) && marker;
    await shot(page, "calendar-rows-view-menu");
    step(
      "Refresh Calendars ⌘R: the item and the key read a change stored elsewhere, without reloading the page",
      notYet && byItem && byKey && sameKeyPage,
      `${notYet} ${byItem} ${byKey} ${sameKeyPage}`,
    );
    await page.unroute("**/live/me*");
    await reopen(page);
  });

  const annaPage = await person("anna", anna);
  annaPage.setDefaultTimeout(8_000);
  const ownInvitation = (browserPage, title) =>
    blocks(browserPage).filter({ hasText: title }).first();
  const inviteAnna = async (title) => {
    await block(page, title).dblclick();
    await popover(page).waitFor({ timeout: 3_000 });
    await popover(page).getByRole("button", { name: "Add Invitees" }).click();
    const field = page.getByRole("textbox", { name: "Invitee" });
    await field.fill(anna.name);
    await field.press("Enter");
    const asked = await seen(async () =>
      named(await stored(page), title)?.invitees?.includes(anna.name),
    );
    console.log(
      `     ${title}: on the server ${asked}; ${(await popover(page).innerText()).replace(/\s+/g, " ")}`,
    );
    await page.waitForTimeout(300);
    await popover(page).getByRole("button", { name: "Done" }).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await popover(page).waitFor({ state: "hidden", timeout: 3_000 });
  };
  const answerOf = async (eventIdOf) => {
    const reply = await page.request.get(new URL("/api/calendar/sent", page.url()).href);
    return (await reply.json()).events?.[eventIdOf]?.[0]?.status;
  };

  await section("invitations", async () => {
    await putEvents(page, [
      ...(await stored(page)),
      timed("inv1", "Asked once", weekDay(5, 11)),
      timed("inv2", "Asked twice", weekDay(6, 11)),
      timed("inv3", "Asked thrice", weekDay(6, 15)),
    ]);
    await menu(page, "View", /^Refresh Calendars/);
    await block(page, "Asked once").waitFor({ timeout: 8_000 });
    // The document also comes back by the live stream a moment after a change stored elsewhere.
    await page.waitForTimeout(2_000);
    await inviteAnna("Asked once");
    await block(page, "Asked twice").waitFor({ timeout: 4_000 });
    await inviteAnna("Asked twice");
    await inviteAnna("Asked thrice");

    await openCalendar(annaPage);
    await shot(annaPage, "calendar-rows-invitations-anna-opened");
    const list = tree(annaPage);
    const listed = await seen(
      () => list.getByRole("treeitem", { name: /Invitations/ }).isVisible(),
      15_000,
    );
    await ownInvitation(annaPage, "Asked once").waitFor({ timeout: 10_000 });
    await shot(annaPage, "calendar-rows-invitations");
    step(
      "Invitations calendar: listed for the person invited, with the event in the view",
      listed && (await ownInvitation(annaPage, "Asked once").isVisible()),
    );
    await ownInvitation(annaPage, "Asked once").dblclick();
    await popover(annaPage).waitFor({ timeout: 3_000 });
    await popover(annaPage).getByRole("button", { name: "Accept" }).click();
    const accepted = await seen(async () => (await answerOf("inv1")) === "accepted");
    await annaPage.keyboard.press("Escape");
    await annaPage.keyboard.press("Escape");
    await menu(page, "View", /^Refresh Calendars/);
    await page.waitForTimeout(600);
    await block(page, "Asked once").dblclick();
    await popover(page).waitFor({ timeout: 3_000 });
    const invitees = popover(page).locator('[data-row="invitees"]');
    await seen(async () => /Accepted/i.test(await invitees.innerText()), 6_000);
    const summary = await invitees.innerText();
    await shot(page, "calendar-rows-invitees");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await ownInvitation(annaPage, "Asked twice").dblclick();
    await popover(annaPage).waitFor({ timeout: 3_000 });
    await popover(annaPage).getByRole("button", { name: "Decline" }).click();
    const declined = await seen(async () => (await answerOf("inv2")) === "declined");
    await annaPage.keyboard.press("Escape");
    await annaPage.keyboard.press("Escape");
    step(
      "Invitees: an account name is asked, and Accept and Decline reach the organizer",
      accepted && declined && summary.includes(anna.fullName) && /Accepted/i.test(summary),
      `${accepted} ${declined} ${summary.replace(/\s+/g, " ")}`,
    );
    const gone = await seen(
      async () => (await ownInvitation(annaPage, "Asked twice").count()) === 0,
      5_000,
    );
    await menu(annaPage, "View", /^Show Declined Invitations/);
    const back = await seen(() => ownInvitation(annaPage, "Asked twice").isVisible(), 5_000);
    await shot(annaPage, "calendar-rows-declined");
    await menu(annaPage, "View", /^Show Declined Invitations/);
    const goneAgain = await seen(
      async () => (await ownInvitation(annaPage, "Asked twice").count()) === 0,
      5_000,
    );
    await list.getByRole("treeitem", { name: /Invitations/ }).click({ button: "right" });
    await annaPage.getByRole("menuitemcheckbox", { name: "Show Declined Invitations" }).click();
    const fromList = await seen(() => ownInvitation(annaPage, "Asked twice").isVisible(), 5_000);
    await menu(annaPage, "View", /^Show Declined Invitations/);
    step(
      "Show Declined Invitations: in View and in the list's menu, a declined event goes and comes back",
      gone && back && goneAgain && fromList,
      `${gone} ${back} ${goneAgain} ${fromList}`,
    );
    await annaPage
      .getByRole("menuitem", { name: "Notification Center", exact: true })
      .first()
      .click();
    const center = annaPage.getByRole("complementary", { name: "Notification Center" });
    await center.waitFor({ timeout: 8_000 });
    await center.getByRole("tab", { name: "Notifications" }).click();
    const asked = center.getByText(/Asked thrice/).first();
    const shownThere = await seen(() => asked.isVisible(), 8_000);
    await shot(annaPage, "calendar-rows-notification-center");
    await center.getByRole("button", { name: "Accept" }).first().click();
    step(
      "Invitations in Notification Center: listed there, and Accept answers it",
      shownThere && (await seen(async () => (await answerOf("inv3")) === "accepted")),
    );
    await annaPage.keyboard.press("Escape");
  });

  await section("cross-app", async () => {
    const before = (await stored(page)).length;
    await tile(page, "Calendar").click({ button: "right" });
    await page.getByRole("menu").last().getByRole("menuitem", { name: "New Event" }).click();
    step(
      "Dock icon menu: New Event makes one, on the server",
      await seen(async () => (await stored(page)).length === before + 1),
    );
    await shot(page, "calendar-rows-dock");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await windowOf(page).getByRole("button", { name: "Today" }).click();
    const title = `Findable${id}`;
    await putEvents(page, [
      ...(await stored(page)).filter((each) => each.title !== "New Event"),
      timed("find", title, weekDay(new Date().getDay() === 6 ? 5 : 6, 9)),
    ]);
    await windowOf(page).getByRole("button", { name: "Close" }).first().click();
    await seen(async () => (await windowOf(page).count()) === 0, 3_000);
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill(title);
    const option = page
      .getByRole("option", { name: new RegExp(title) })
      .filter({ hasNotText: /Search|Web/ })
      .first();
    await option.waitFor({ timeout: 15_000 });
    await shot(page, "calendar-rows-spotlight");
    await option.click();
    await field.press("Enter");
    const selected = windowOf(page).locator('[data-event-id][aria-pressed="true"]');
    const opened = await seen(async () => (await selected.innerText()).includes(title), 15_000);
    await shot(page, "calendar-rows-spotlight-opened");
    step("Spotlight finds events: a result opens Calendar with the event selected", opened);
  });

  await section("app-menu", async () => {
    await openMenu(page, "Calendar");
    await row(page, /^About Calendar/).click();
    const about = page.locator(".mac-about-window");
    const aboutShown = await seen(() => about.getByText("Calendar").first().isVisible(), 5_000);
    await shot(page, "calendar-rows-about");
    await about.getByRole("button", { name: "Close" }).first().click();
    step(
      "About Calendar: the window opens, and its close button closes it",
      aboutShown && (await seen(async () => (await about.count()) === 0, 3_000)),
    );

    await tile(page, "Finder").click();
    const finderId = "finder";
    await page.waitForTimeout(600);
    const finderShown = page.locator(`[data-window-id^="${finderId}"]`).first();
    await finderShown.waitFor({ timeout: 8_000 });
    await tile(page, "Calendar").click();
    await page.waitForTimeout(500);
    await menu(page, "Calendar", /^Hide Others/);
    const othersGone = await seen(
      () => finderShown.evaluate((shell) => shell.hasAttribute("data-minimized")),
      3_000,
    );
    const stays = await windowOf(page).isVisible();
    await shot(page, "calendar-rows-hide-others");
    await menu(page, "Calendar", /^Show All/);
    const allBack = await seen(
      () => finderShown.evaluate((shell) => !shell.hasAttribute("data-minimized")),
      3_000,
    );
    step("Hide Others ⌥⌘H: Finder's window goes, and Calendar's stays", othersGone && stays);
    step("Show All: what was hidden comes back", allBack);
    await tile(page, "Calendar").click();
    await page.waitForTimeout(300);
    await page.keyboard.press("Control+Alt+h");
    const othersByKey = await seen(
      () => finderShown.evaluate((shell) => shell.hasAttribute("data-minimized")),
      3_000,
    );
    console.log(`     Hide Others by key: ${othersByKey}`);
    step("Hide Others ⌥⌘H: its key too", othersByKey);
    await menu(page, "Calendar", /^Show All/);
    await page.waitForTimeout(300);
    await tile(page, "Calendar").click();
    await page.waitForTimeout(300);

    await menu(page, "Calendar", /^Hide Calendar/);
    const hiddenByItem = await seen(() => hidden(page, "calendar"), 3_000);
    await shot(page, "calendar-rows-hide");
    await tile(page, "Calendar").click();
    await seen(async () => !(await hidden(page, "calendar")), 3_000);
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+h");
    const hiddenByKey = await seen(() => hidden(page, "calendar"), 3_000);
    await tile(page, "Calendar").click();
    await seen(async () => !(await hidden(page, "calendar")), 3_000);
    await page.waitForTimeout(400);
    step("Hide Calendar ⌘H: the item and the key hide its windows", hiddenByItem && hiddenByKey);

    await menu(page, "Calendar", /^Quit Calendar/);
    const quitByItem = await seen(async () => (await windowOf(page).count()) === 0, 3_000);
    await shot(page, "calendar-rows-quit");
    await openCalendar(page);
    await page.keyboard.press("Control+q");
    step(
      "Quit Calendar ⌘Q: the item and the key close its windows",
      quitByItem && (await seen(async () => (await windowOf(page).count()) === 0, 3_000)),
    );
    await openCalendar(page);
  });

  await section("window-menu", async () => {
    const windowId = "calendar";
    await menu(page, "Window", /^Minimize/);
    const minimized = await seen(() => hidden(page, windowId), 3_000);
    await page.waitForTimeout(400);
    const ownTile = page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: /minimized window/ });
    const tileShown = (await ownTile.count()) === 1;
    await shot(page, "calendar-rows-minimized");
    await ownTile.click();
    await seen(async () => !(await hidden(page, windowId)), 3_000);
    await page.waitForTimeout(500);
    await page.keyboard.press("Control+m");
    const byKey = await seen(() => hidden(page, windowId), 3_000);
    await page.waitForTimeout(400);
    await ownTile.click();
    await seen(async () => !(await hidden(page, windowId)), 3_000);
    await page.waitForTimeout(500);
    step(
      "Minimize ⌘M: the item and the key take it to the Dock",
      minimized && tileShown && byKey,
      `${minimized} ${tileShown} ${byKey}`,
    );

    const before = await boxOf(page, windowId);
    await menu(page, "Window", /^Zoom/);
    await seen(async () => (await boxOf(page, windowId)).width !== before.width, 3_000);
    await page.waitForTimeout(500);
    const zoomed = await boxOf(page, windowId);
    await shot(page, "calendar-rows-zoomed");
    await menu(page, "Window", /^Zoom/);
    await seen(async () => (await boxOf(page, windowId)).width === before.width, 3_000);
    await page.waitForTimeout(500);
    const unzoomed = await boxOf(page, windowId);
    step(
      "Zoom: the window grows, and again brings back its frame",
      zoomed.width > before.width + 100 && Math.abs(unzoomed.width - before.width) < 2,
      `${before.width} ${zoomed.width} ${unzoomed.width}`,
    );

    await menu(page, "Calendar", /^Preferences/);
    const prefs = page.getByRole("region", { name: "General" });
    await prefs.waitFor({ timeout: 5_000 });
    await openMenu(page, "Window");
    await page.waitForTimeout(150);
    const listedHere = await page
      .getByRole("menu")
      .last()
      .getByRole("menuitemcheckbox")
      .allInnerTexts();
    await shot(page, "calendar-rows-window-menu");
    const mainRow = page
      .getByRole("menu")
      .last()
      .getByRole("menuitemcheckbox", { name: /^Calendar$/ });
    const mainUnchecked = (await mainRow.getAttribute("aria-checked")) === "false";
    await mainRow.click();
    step(
      "Open windows list: names both windows, and a row brings its window forward",
      listedHere.length >= 2 &&
        mainUnchecked &&
        (await seen(async () => (await stateOf(page, windowId)) === "key", 3_000)),
      listedHere.join(" | "),
    );

    const prefsShell = page
      .locator("[data-window-id]")
      .filter({ has: page.getByRole("region", { name: "General" }) });
    const prefsId = await prefsShell.getAttribute("data-window-id");
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
    const row0 = async () => {
      await openMenu(page, "Window");
      await row(page, /^Calendar/).click();
    };
    await row0();
    const byRow = await seen(async () => (await stateOf(page, windowId)) === "key", 3_000);
    await toPreferences();
    await page.keyboard.press("Control+0");
    step(
      "Calendar: the row and ⌘0 bring the main window forward from Preferences",
      byRow && (await seen(async () => (await stateOf(page, windowId)) === "key", 3_000)),
    );

    await toPreferences();
    await tile(page, "Calculator").click();
    await shellOf(page, "calculator").waitFor({ timeout: 8_000 });
    await page.waitForTimeout(500);
    await prefsShell.click({ position: { x: 300, y: 10 } });
    await seen(async () => (await stateOf(page, prefsId)) === "key", 3_000);
    const above = (await zOf(page, "calculator")) > (await zOf(page, windowId));
    await menu(page, "Window", /^Bring All to Front/);
    await page.waitForTimeout(400);
    const topNow = (await zOf(page, windowId)) > (await zOf(page, "calculator"));
    await shot(page, "calendar-rows-bring-all");
    step(
      "Bring All to Front: both of Calendar's windows come over another application's",
      above && topNow && (await zOf(page, prefsId)) > (await zOf(page, "calculator")),
      `${above} ${topNow}`,
    );
    await page.keyboard.press("Control+w");
    await seen(async () => (await prefs.count()) === 0, 3_000);
  });

  await section("saved", async () => {
    if ((await windowOf(page).count()) === 0) await openCalendar(page);
    await menu(page, "Calendar", /^Preferences/);
    const prefs = page.getByRole("region", { name: "General" });
    await prefs.waitFor({ timeout: 5_000 });
    await page.getByRole("combobox", { name: "Days per week:" }).click();
    await page.getByRole("option", { name: "5", exact: true }).click();
    const week = windowOf(page).locator(".mac-calendar-week-grid-day");
    const five = await seen(async () => (await week.count()) === 5, 4_000);
    const onServer = await seen(async () => (await storedSettings(page))?.daysPerWeek === 5, 5_000);
    step(
      "Week: five days, per the preference",
      five && onServer,
      `${five} ${JSON.stringify(await storedSettings(page))}`,
    );
    await shot(page, "calendar-rows-saved-preferences");
    await page.waitForTimeout(500);
    await menu(page, "File", /^New Calendar$/);
    const naming = page.getByRole("textbox", { name: "Calendar name" });
    await naming.fill("Kept");
    await naming.press("Enter");
    await seen(async () => (await calendarsOf(page)).some((each) => each.name === "Kept"));
    await page.waitForTimeout(500);
    await reopen(page);
    await block(page, "Alpha").waitFor({ timeout: 10_000 });
    await shot(page, "calendar-rows-saved");
    step(
      "Events and the person's calendars: after a reload the events and a new calendar are there",
      (await tree(page).getByRole("treeitem", { name: /Kept/ }).count()) === 1 &&
        (await block(page, "Alpha").isVisible()),
    );
    step(
      "Preferences: after a reload the week is still five days",
      await seen(async () => (await week.count()) === 5, 5_000),
    );
  });
});
