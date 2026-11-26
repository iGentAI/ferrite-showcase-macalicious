"use client";

import { Label } from "macalicious/label";
import { useEffect, useState } from "react";
import { type Contact, displayName } from "../contacts/contacts-data";
import { CONTACTS_CARDS_URL, cardsFromServer, cardsReadable } from "../contacts/contacts-server";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { sessionFetch } from "../desktop/desktop-server";
import { BIRTHDAYS, type CalendarEntry } from "./calendar-data";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const monthNamed = (word: string) =>
  word.length < 3 ? -1 : MONTHS.findIndex((month) => month.startsWith(word.toLowerCase()));

/**
 * A leap year far enough back that every living person's birthday shows in every year a person can
 * go to, and February 29 has a first occurrence.
 */
const FIRST_YEAR = 1904;

/**
 * The month (0 to 11) and day of a birthday as a person typed it on a card: "March 14", "Mar 14,
 * 1980", "14 March", "3/14", "3/14/1980" or "1980-03-14". `null` for anything else, or a day the
 * month does not have.
 */
export function parseBirthday(typed: string): { month: number; day: number } | null {
  const text = typed.trim();
  const iso = /^\d{4}-(\d{1,2})-(\d{1,2})$/.exec(text);
  const slashed = /^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/.exec(text);
  const monthFirst = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+\d{4})?$/i.exec(text);
  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:,?\s+\d{4})?$/i.exec(text);
  const found = iso ?? slashed;
  let month = -1;
  let day = 0;
  if (found) {
    month = Number(found[1]) - 1;
    day = Number(found[2]);
  } else if (monthFirst) {
    month = monthNamed(monthFirst[1] as string);
    day = Number(monthFirst[2]);
  } else if (dayFirst) {
    month = monthNamed(dayFirst[2] as string);
    day = Number(dayFirst[1]);
  }
  if (month < 0 || month > 11 || day < 1) return null;
  if (new Date(FIRST_YEAR, month + 1, 0).getDate() < day) return null;
  return { month, day };
}

/** An all-day yearly event for each card whose birthday can be read. */
export function birthdayEntries(cards: readonly Contact[]): CalendarEntry[] {
  return cards.flatMap((card) => {
    const date = card.birthday ? parseBirthday(card.birthday) : null;
    if (!date) return [];
    return [
      {
        id: `birthday-${card.id}`,
        title: `${displayName(card)}\u2019s Birthday`,
        start: new Date(FIRST_YEAR, date.month, date.day),
        end: new Date(FIRST_YEAR, date.month, date.day + 1),
        allDay: true,
        calendar: BIRTHDAYS,
        repeat: { freq: "yearly" as const },
      },
    ];
  });
}

/**
 * The Birthdays calendar's events, from the person's Contacts on the served desktop, read again
 * when those change. What was read stays while a later read fails.
 */
export function useBirthdays(on: boolean): readonly CalendarEntry[] {
  const [entries, setEntries] = useState<readonly CalendarEntry[]>([]);
  useEffect(() => {
    if (!on) {
      setEntries([]);
      return;
    }
    let latest = 0;
    const load = async () => {
      latest += 1;
      const asked = latest;
      const response = await sessionFetch(CONTACTS_CARDS_URL, {
        credentials: "same-origin",
      }).catch(() => null);
      const reply: unknown = response?.ok ? await response.json().catch(() => null) : null;
      if (asked !== latest || !cardsReadable(reply)) return;
      setEntries(birthdayEntries(cardsFromServer(reply) ?? []));
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ app?: string }>).detail?.app === "contacts") void load();
    };
    void load();
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    return () => {
      latest = -1;
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
    };
  }, [on]);
  return entries;
}

/** A birthday's popover: Contacts holds it, so it is read here and not edited. */
export function BirthdayDetails({ entry }: { entry: CalendarEntry }) {
  return (
    <>
      <div className="mac-calendar-popover-head">
        <div className="mac-calendar-popover-name">
          <Label textStyle="title-2">{entry.title}</Label>
        </div>
      </div>
      <div className="mac-calendar-popover-row">
        {entry.start.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
        <div className="mac-calendar-popover-detail">Change it on the card in Contacts.</div>
      </div>
    </>
  );
}
