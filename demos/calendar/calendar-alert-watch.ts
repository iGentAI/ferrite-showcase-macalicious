"use client";

import { useEffect, useState } from "react";
import { CONTACTS_CARDS_URL, cardsFromServer } from "../contacts/contacts-server";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { desktopValues } from "../desktop/desktop-personal";
import { sessionFetch } from "../desktop/desktop-server";
import {
  alertingEntries,
  alertsOnlyThePageRaises,
  BIRTHDAY_ALERTS,
  type BirthdayAlerts,
  dueAlerts,
  mergedAlertStates,
  NO_BIRTHDAY_ALERTS,
  nextAlertChange,
  readBirthdayAlerts,
  type ShownAlert,
} from "./calendar-alerts";
import { birthdayEntries } from "./calendar-birthdays";
import type { CalendarEntry, CalendarSettings } from "./calendar-data";
import { INBOX_URL, inboxFromServer } from "./calendar-invitations";
import { documentFromServer, settingsFromServer } from "./calendar-server";

/*
 * Alerts of a person who is signed in with Calendar closed. The server raises a single event's by
 * itself (`alerts.rs`), but only the page has a time-zone database to lay out a repeating or floating
 * event, and the birthdays and invitations are not in the person's document. So the shell lays them
 * out as the window does, and names what is due to `POST /api/calendar/alerts/raise`, which keeps the
 * one notification per occurrence: nothing is raised twice by another browser, the server's own pass
 * or the window, which tells the server what it shows (`alertsToTell`).
 */

/** How long what the module holds is trusted before it is read again. */
const READ_EVERY = 60_000;
/** The most one `raise` names, as the module takes them. */
const AT_ONCE = 20;

const readJson = async (url: string): Promise<unknown> => {
  const response = await sessionFetch(url, { credentials: "same-origin" }).catch(() => null);
  return response?.ok ? response.json().catch(() => null) : null;
};

/** What the module holds of the alerts of birthdays and invitations; nothing when it cannot say. */
export async function readAlertAnswers(): Promise<BirthdayAlerts> {
  const reply = (await readJson("/api/calendar/alerts/others")) as { alerts?: unknown } | null;
  return readBirthdayAlerts(reply?.alerts) ?? NO_BIRTHDAY_ALERTS;
}

async function raise(alerts: readonly ShownAlert[]): Promise<void> {
  await sessionFetch("/api/calendar/alerts/raise", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ alerts: alerts.slice(0, AT_ONCE) }),
  }).catch(() => undefined);
}

/** Lays out and raises the person's alerts while `wanted`: signed in, with no Calendar window open. */
export function useCalendarAlertWatch(wanted: boolean): void {
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let birthdays: readonly CalendarEntry[] = [];
    let invitations: readonly { status: string; event: CalendarEntry }[] = [];
    // Set when the birthdays and invitations are to be read again.
    let stale = true;
    const told = new Set<string>();
    const look = async () => {
      clearTimeout(timer);
      const [reply, answers] = await Promise.all([
        readJson("/api/calendar/events"),
        readAlertAnswers(),
      ]);
      if (!live) return;
      const doc = documentFromServer(reply);
      const settings: Partial<CalendarSettings> = settingsFromServer(reply) ?? {};
      let wait = READ_EVERY;
      if (doc) {
        if (stale) {
          stale = false;
          const [cards, inbox] = await Promise.all([
            settings.showBirthdays && settings.defaultBirthdayAlert !== undefined
              ? readJson(CONTACTS_CARDS_URL)
              : null,
            readJson(INBOX_URL),
          ]);
          if (!live) return;
          birthdays = birthdayEntries(cardsFromServer(cards) ?? []);
          invitations = inboxFromServer(inbox)?.invitations ?? invitations;
        }
        const events = alertingEntries(
          doc.events ?? [],
          birthdays,
          invitations,
          settings,
          mergedAlertStates(
            readBirthdayAlerts(desktopValues()[BIRTHDAY_ALERTS]) ?? NO_BIRTHDAY_ALERTS,
            answers,
          ),
        );
        const now = Date.now();
        const fresh = alertsOnlyThePageRaises(dueAlerts(events, now), events, now).filter(
          (alert) => !told.has(`${alert.event}@${alert.start}@${alert.until}`),
        );
        for (const alert of fresh) told.add(`${alert.event}@${alert.start}@${alert.until}`);
        if (fresh.length > 0) await raise(fresh);
        if (!live) return;
        const next = nextAlertChange(events, Date.now());
        if (next !== null) wait = Math.min(wait, Math.max(0, next - Date.now()) + 20);
      }
      timer = setTimeout(look, wait);
    };
    const changed = (event: Event) => {
      const app = (event as CustomEvent<{ app?: string } | null>).detail?.app;
      if (app !== "calendar" && app !== "contacts") return;
      stale = true;
      void look();
    };
    void look();
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
    };
  }, [wanted]);
}

/** The same answers for the open window: what a notification's Close or Snooze did. */
export function useAlertAnswers(served: boolean): BirthdayAlerts {
  const [answers, setAnswers] = useState(NO_BIRTHDAY_ALERTS);
  useEffect(() => {
    if (!served) return;
    let live = true;
    const read = () => {
      void readAlertAnswers().then((read) => {
        if (live) setAnswers(read);
      });
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ app?: string } | null>).detail?.app === "calendar") read();
    };
    read();
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    return () => {
      live = false;
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
    };
  }, [served]);
  return answers;
}
