#!/usr/bin/env node
// Today's rows open what they name: a Calendar event opens Calendar and a reminder opens Reminders,
// each asked for that item, and Notification Center closes.
//
//   node scripts/dev-front-end.mjs --port 3020    # beside the shared desktop on 8787
//   node e2e/notification-open-journey.mjs [--url http://127.0.0.1:3020] [--out dir] [--browser chromium]

import path from "node:path";
import { journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("notification-open");
const tag = Date.now().toString(36);
const EVENT = `Standup ${tag}`;
const REMINDER = `Water plants ${tag}`;

await run(async (page) => {
  await openDesktop(page, base, step);
  const saved = await page.evaluate(
    async ({ event, reminder }) => {
      const now = Date.now();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const put = (url, body) =>
        fetch(url, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }).then((reply) => reply.status);
      const day = new Date(now);
      const two = (n) => String(n).padStart(2, "0");
      const today = `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`;
      const nine = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9).getTime();
      return [
        await put("/api/calendar/events", {
          events: [
            {
              id: "n1",
              title: event,
              start: now - 60_000,
              end: Math.min(now + 30 * 60_000, midnight.getTime() - 1),
              calendar: "work",
            },
          ],
          rev: 0,
        }),
        await put("/api/reminders/data", {
          base: 0,
          data: {
            lists: [{ id: "l1", name: "Reminders", color: "blue" }],
            reminders: [{ id: "r1", listId: "l1", title: reminder, due: today }],
          },
          alerts: { r1: nine },
        }),
      ];
    },
    { event: EVENT, reminder: REMINDER },
  );
  step(
    "An event and a reminder for today",
    saved.every((status) => status === 200),
  );
  await page.reload();
  await openDesktop(page, base, step);

  const bar = page.getByRole("menubar").first();
  const center = page.locator('aside[aria-label="Notification Center"]');
  const openCenter = () =>
    page.getByRole("menuitem", { name: "Notification Center", exact: true }).first().click();
  const front = () => bar.getByRole("menuitem").nth(1).textContent();

  await openCenter();
  const event = center.getByRole("button", { name: new RegExp(EVENT) });
  await event.waitFor({ timeout: 10_000 });
  await shot(page, path.join(out, `notification-today-rows-${browserName}.png`));
  await event.click();
  await page.locator('[data-window-id="calendar"]').waitFor({ timeout: 10_000 });
  step("An event's row opens Calendar", (await front())?.trim() === "Calendar", await front());
  step("and Notification Center closes", (await center.count()) === 0);

  await openCenter();
  const reminder = center.getByRole("button", { name: new RegExp(REMINDER) });
  await reminder.waitFor({ timeout: 10_000 });
  await reminder.click();
  await page.locator('[data-window-id="reminders"]').waitFor({ timeout: 10_000 });
  step("A reminder's row opens Reminders", (await front())?.trim() === "Reminders", await front());
});
