#!/usr/bin/env node
// Several selected events move and are cut, copied and pasted together: dragged, by the arrow keys and
// by the Edit menu, as one change that one Undo takes back. Tab goes from event to event. Read from the
// server and after a reload.

import {
  blocks,
  menuPath,
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

const { step, run, shot } = twoPeople("calendar-several");
const id = Date.now().toString(36);
const chris = { name: `csechris-${id}`, fullName: `Chris ${id}`, password: `tide-${id}-pool` };
const DAY = 864e5;
const block = (page, title) => blocks(page).filter({ hasText: title }).first();
const pressed = (page) => windowOf(page).locator('[data-event-id][aria-pressed="true"]');
const starts = async (page) => {
  const events = await stored(page);
  return [named(events, "Alpha")?.start, named(events, "Beta")?.start];
};

await run({}, {}, async ({ person }) => {
  const page = await person("chris", chris);
  const a = weekDay(2, 10);
  const b = weekDay(3, 13);
  await putEvents(page, [
    timed("a", "Alpha", a),
    timed("b", "Beta", b),
    timed("c", "Gamma", weekDay(4, 10)),
  ]);
  await openCalendar(page);

  await block(page, "Alpha").click();
  await block(page, "Beta").click({ modifiers: ["Control"] });
  await seen(async () => (await pressed(page).count()) === 2);

  // Dragging one of them by a column takes the other along.
  const box = await block(page, "Alpha").boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + box.width / 2, y, { steps: 3 });
  await page.mouse.move(x + box.width * 1.05, y, { steps: 3 });
  await shot(page, "calendar-several-dragging");
  await page.mouse.up();
  step(
    "Dragging one of two selected moves both a day, on the server",
    await seen(async () => {
      const [one, two] = await starts(page);
      return one === a + DAY && two === b + DAY;
    }),
  );
  step("Both stay selected", (await pressed(page).count()) === 2);
  step("The one not selected stays", named(await stored(page), "Gamma").start === weekDay(4, 10));

  await page.keyboard.press("Control+z");
  step(
    "One Undo takes both back",
    await seen(async () => {
      const [one, two] = await starts(page);
      return one === a && two === b;
    }),
  );

  await block(page, "Alpha").click();
  await block(page, "Beta").click({ modifiers: ["Control"] });
  await page.keyboard.press("ArrowDown");
  step(
    "An arrow key moves both a quarter of an hour",
    await seen(async () => {
      const [one, two] = await starts(page);
      return one === a + 15 * 60_000 && two === b + 15 * 60_000;
    }),
  );
  await page.keyboard.press("ArrowRight");
  step(
    "and a day to the side",
    await seen(async () => {
      const [one, two] = await starts(page);
      return one === a + 15 * 60_000 + DAY && two === b + 15 * 60_000 + DAY;
    }),
  );
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  await seen(async () => (await starts(page))[0] === a);

  await block(page, "Alpha").click();
  await block(page, "Beta").click({ modifiers: ["Control"] });
  await menuPath(page, "Edit", "Cut");
  step(
    "Cut takes both",
    await seen(async () => (await stored(page)).length === 1 && (await blocks(page).count()) === 1),
  );
  await menuPath(page, "Edit", "Paste");
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const firstAt = todayMidnight + 10 * 36e5;
  step(
    "Paste puts both back on the day shown, as far apart as they were",
    await seen(async () => {
      const [one, two] = await starts(page);
      return one === firstAt && two === firstAt + DAY + 3 * 36e5;
    }),
  );
  await page.keyboard.press("Control+z");
  await seen(async () => (await stored(page)).length === 1);
  await page.keyboard.press("Control+z");
  step(
    "Undo goes back through Paste and Cut",
    await seen(async () => (await starts(page))[0] === a && (await stored(page)).length === 3),
  );

  await block(page, "Alpha").click();
  await block(page, "Beta").click({ modifiers: ["Control"] });
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  step(
    "Copy and Paste make two more on the day shown, keeping the first two where they were",
    await seen(async () => {
      const all = await stored(page);
      const at = (title) =>
        all
          .filter((event) => event.title === title)
          .map((event) => event.start)
          .sort((x, y) => x - y);
      const copies = [firstAt, firstAt + DAY + 3 * 36e5];
      return (
        all.length === 5 &&
        JSON.stringify(at("Alpha")) === JSON.stringify([a, copies[0]].sort((x, y) => x - y)) &&
        JSON.stringify(at("Beta")) === JSON.stringify([b, copies[1]].sort((x, y) => x - y))
      );
    }),
  );
  // The second copy lands a day after the first: on a Saturday that is next week, out of sight.
  const copiesShown = today.getDay() === 6 ? 1 : 2;
  step(
    "The copies are selected",
    await seen(async () => (await pressed(page).count()) === copiesShown),
  );
  await shot(page, "calendar-several-pasted");

  await reopen(page);
  step(
    "After a reload all five are kept, and drawn",
    (await stored(page)).length === 5 &&
      (await seen(async () => (await blocks(page).filter({ hasText: "Alpha" }).count()) >= 1)),
  );

  // Tab goes through the events in time.
  await putEvents(page, [
    timed("a", "Alpha", a),
    timed("b", "Beta", b),
    timed("c", "Gamma", weekDay(4, 10)),
  ]);
  await reopen(page);
  await block(page, "Alpha").click();
  await page.keyboard.press("Tab");
  const selected = async () => (await pressed(page).first().textContent()) ?? "";
  step(
    "Tab selects the next event",
    await seen(
      async () => (await pressed(page).count()) === 1 && (await selected()).includes("Beta"),
    ),
  );
  await page.keyboard.press("Tab");
  step("and the next", await seen(async () => (await selected()).includes("Gamma")));
  await page.keyboard.press("Shift+Tab");
  step("Shift-Tab goes back", await seen(async () => (await selected()).includes("Beta")));
  await page.keyboard.press("ArrowUp");
  step(
    "An arrow key moves the one Tab reached",
    await seen(async () => named(await stored(page), "Beta").start === b - 15 * 60_000),
  );
  await page.waitForTimeout(800);
  await reopen(page);
  step(
    "and it stays there after a reload",
    named(await stored(page), "Beta").start === b - 15 * 60_000,
  );

  // Several moved with an occurrence of a repeating event: its snooze goes with it, and one Undo
  // brings both back.
  const alerts = () => page.locator(".mac-calendar-alerts");
  const alerting = (title) => alerts().filter({ hasText: title }).count();
  const weekly = weekDay(2, 10);
  await putEvents(page, [
    timed("weekly", "Weekly", weekly, 60, {
      alert: 15,
      repeat: { freq: "weekly" },
      alertSnooze: { start: weekly, until: Date.now() - 60_000 },
    }),
    timed("other", "Other", weekDay(3, 10)),
  ]);
  await reopen(page);
  step(
    "An expired snooze of a repeating event shows",
    await seen(async () => (await alerting("Weekly")) === 1),
  );
  await block(page, "Weekly").click();
  await block(page, "Other").click({ modifiers: ["Control"] });
  await page.keyboard.press("ArrowDown");
  step(
    "Moving that occurrence with another event removes it from the series and takes its snooze",
    await seen(async () => {
      const series = (await stored(page)).find((event) => event.id === "weekly");
      return series?.exdates?.includes(weekly) && series.alertSnooze === undefined;
    }),
  );
  // The arrow keys move both by the same step.
  const movedTogether = async () => {
    const all = await stored(page);
    const copy = all.find((event) => event.title === "Weekly" && event.id !== "weekly");
    const other = all.find((event) => event.id === "other");
    const step = (copy?.start ?? 0) - weekly;
    return (
      step > 0 &&
      copy.end - copy.start === 60 * 60_000 &&
      copy.repeat === undefined &&
      copy.alertSnooze === undefined &&
      copy.alert === 15 &&
      other?.start === weekDay(3, 10) + step
    );
  };
  step(
    "and the occurrence stands alone further on, as long as it was, with the other event beside it",
    await seen(movedTogether),
    JSON.stringify(await stored(page)),
  );
  step("and its alert goes", await seen(async () => (await alerting("Weekly")) === 0));
  await page.keyboard.press("Control+z");
  step(
    "One Undo brings the occurrence, its snooze and the other event back",
    await seen(async () => {
      const all = await stored(page);
      const series = all.find((event) => event.id === "weekly");
      return (
        all.length === 2 &&
        !series?.exdates?.includes(weekly) &&
        series?.alertSnooze?.start === weekly &&
        all.find((event) => event.id === "other")?.start === weekDay(3, 10)
      );
    }),
    JSON.stringify(await stored(page)),
  );
  await page.keyboard.press("Control+Shift+z");
  step(
    "and Redo moves them again",
    await seen(async () => {
      const series = (await stored(page)).find((event) => event.id === "weekly");
      return (
        series?.exdates?.includes(weekly) &&
        series.alertSnooze === undefined &&
        (await movedTogether())
      );
    }),
  );
  await page.waitForTimeout(800);
  await reopen(page);
  step("After a reload its alert stays away", (await alerting("Weekly")) === 0);

  // An alert closed or snoozed, its event deleted, and Undo: what was decided comes back with it.
  const soon = Date.now() + 5 * 60_000;
  const dueSoon = (title) => timed(title.replace(" ", "-"), title, soon, 60, { alert: 15 });
  for (const [title, decide, saved] of [
    [
      "Closed one",
      () => alerts().getByRole("button", { name: "Close" }).click(),
      (event) => event?.alertDismissed === soon,
    ],
    [
      "Snoozed one",
      async () => {
        await alerts().getByRole("button", { name: "Snooze" }).click();
        await page.getByRole("menuitem", { name: "1 hour", exact: true }).click();
      },
      (event) => event?.alertSnooze?.start === soon,
    ],
  ]) {
    await putEvents(page, [dueSoon(title)]);
    await reopen(page);
    step(`${title}: its alert shows`, await seen(async () => (await alerting(title)) === 1));
    await decide();
    step(`${title}: it is saved`, await seen(async () => saved(named(await stored(page), title))));
    await block(page, title).click();
    await page.keyboard.press("Delete");
    step(
      `${title}: Delete takes the event, on the server`,
      await seen(async () => (await stored(page)).length === 0),
    );
    await page.keyboard.press("Control+z");
    step(
      `${title}: Undo brings the event back with it, on the server`,
      await seen(async () => saved(named(await stored(page), title))),
    );
    step(`${title}: the alert does not show`, (await alerting(title)) === 0);
    if (title === "Closed one") await shot(page, "calendar-several-alert-kept");
    await page.waitForTimeout(800);
    await reopen(page);
    step(
      `${title}: after a reload too`,
      saved(named(await stored(page), title)) && (await alerting(title)) === 0,
    );
  }
});
