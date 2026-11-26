// Shared steps of Calendar's journeys: the window, the document on the server, and days of this week.
import { openFromDock, within } from "./people-kit.mjs";

export const windowOf = (page) => page.getByRole("region", { name: "Calendar", exact: true });
export const blocks = (page) =>
  windowOf(page).locator(
    "[data-event-id]:not([data-event-id^='travel-time-of-']):not([data-event-id^='holiday-'])",
  );
export const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);
const api = (page, method, path, body) =>
  page.evaluate(
    async ({ method, path, body }) => {
      const reply = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: reply.status, json: await reply.json().catch(() => null) };
    },
    { method, path, body },
  );
export const stored = async (page) =>
  (await api(page, "GET", "/api/calendar/events")).json?.events ?? [];
export const storedSettings = async (page) =>
  (await api(page, "GET", "/api/calendar/settings")).json?.settings;
/** Replace the person's events, as a window would save them. */
export async function putEvents(page, events) {
  const { json } = await api(page, "GET", "/api/calendar/events");
  const put = await api(page, "PUT", "/api/calendar/events", { rev: json.rev, events });
  if (put.status !== 200) throw new Error(`PUT events answered ${put.status}`);
}
export async function openCalendar(page) {
  await openFromDock(page, "Calendar", "Calendar");
  await windowOf(page).locator(".mac-calendar-body:not([inert])").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
}
export async function reopen(page) {
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if ((await windowOf(page).count()) === 0) await openCalendar(page);
  await windowOf(page).locator(".mac-calendar-body:not([inert])").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
}
export async function menuPath(page, ...names) {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: names[0], exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().getByRole("menuitem", { name: names[1] }).click();
}
/** Local midnight of a day of the week being shown, 0 for its Sunday. */
export function weekDay(index, hour = 0, minute = 0) {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - now.getDay() + index,
    hour,
    minute,
  ).getTime();
}
export const timed = (id, title, start, minutes = 60, extra = {}) => ({
  id,
  title,
  start,
  end: start + minutes * 60_000,
  calendar: "home",
  ...extra,
});
export const named = (events, title) => events.find((event) => event.title === title);
