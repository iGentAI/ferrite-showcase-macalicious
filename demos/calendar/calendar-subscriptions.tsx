"use client";

import { Label } from "macalicious/label";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { sessionFetch } from "../desktop/desktop-server";
import {
  CALENDAR_COLORS,
  type CalendarColor,
  type CalendarEntry,
  type OwnCalendar,
} from "./calendar-data";
import { importedId, MAX_EVENTS, MAX_FILE_BYTES } from "./calendar-files";
import { type IcsImport, parseIcs, unfold } from "./calendar-ics";

/**
 * Calendars read from a web address. The browser reads the feed: the application's own requests reach
 * only the addresses its manifest names, so it cannot fetch one a person types. A site has to allow
 * other pages to read it, and the window says so when one does not. The person's list of subscriptions
 * is kept with their settings; the events are read again whenever the window opens, and are never saved
 * with the person's own.
 */
export const CALENDAR_SUBSCRIPTIONS = "calendar.subscriptions";

/** How long Calendar leaves a feed before it reads it again. */
const REFRESH_MS = 60 * 60 * 1000;
/** How long a feed has to answer. */
const READ_MS = 30_000;
const MAX_SUBSCRIPTIONS = 20;

export interface CalendarSubscription extends OwnCalendar {
  url: string;
}

const NONE: readonly CalendarSubscription[] = [];

/** The list as stored, leaving out what this window did not write. */
export function readSubscriptions(stored: unknown): readonly CalendarSubscription[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.filter(
    (item): item is CalendarSubscription =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.url === "string" &&
      CALENDAR_COLORS.some((color) => color.id === item.color),
  );
}

/** The address to read for what a person typed: `webcal:` is the web; anything else is refused. */
export function feedAddress(typed: string): string | null {
  const text = typed.trim().replace(/^webcals?:\/\//i, "https://");
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** A feed that could not be read, with what to tell the person. */
export class FeedProblem extends Error {}

/** The events of the feed at `url`. Throws a `FeedProblem` that says why it could not be read. */
export async function readFeed(url: string, signal?: AbortSignal): Promise<IcsImport> {
  const { host } = new URL(url);
  let reply: Response;
  const given = signal ? [signal] : [];
  const bounded = AbortSignal.any([...given, AbortSignal.timeout(READ_MS)]);
  const stopped = (error: unknown) =>
    error instanceof DOMException && error.name === "AbortError" && signal?.aborted === true;
  try {
    reply = await sessionFetch(url, { credentials: "omit", signal: bounded });
  } catch (error) {
    if (stopped(error)) throw error;
    throw new FeedProblem(
      `${host} could not be reached, or it does not let other pages read its calendars.`,
    );
  }
  if (!reply.ok) throw new FeedProblem(`${host} answered with status ${reply.status}.`);
  let text: string;
  try {
    text = await reply.text();
  } catch (error) {
    if (stopped(error)) throw error;
    throw new FeedProblem(`${host} stopped answering before the calendar was read.`);
  }
  if (text.length > MAX_FILE_BYTES) {
    throw new FeedProblem(`The calendar at ${host} is larger than Calendar reads: 5 MB.`);
  }
  const read = parseIcs(text);
  // A whole calendar, begun and ended, or it was cut short; one with no events at all has lost them,
  // but one whose events could not be read has not.
  const lines = unfold(text.trim());
  const open: string[] = [];
  let balanced = lines[0]?.trim().toUpperCase() === "BEGIN:VCALENDAR";
  lines.forEach((line, at) => {
    const part = /^(BEGIN|END):(.+)$/i.exec(line.trim());
    if (!part) return;
    const name = (part[2] as string).toUpperCase();
    if ((part[1] as string).toUpperCase() === "BEGIN") {
      if (name === "VCALENDAR" && open.length > 0) balanced = false;
      open.push(name);
    } else if (open.pop() !== name) balanced = false;
    if (open.length === 0 && at < lines.length - 1) balanced = false;
  });
  const whole = balanced && open.length === 0;
  if (!whole || (read.events.length === 0 && read.skipped > 0)) {
    throw new FeedProblem(`There is no whole calendar at ${host}: it is not an iCalendar feed.`);
  }
  return read;
}

/** The events of a feed as they show in `subscription`, up to as many as a calendar holds. */
export function feedEntries(
  subscription: CalendarSubscription,
  read: IcsImport,
): readonly CalendarEntry[] {
  return read.events.slice(0, MAX_EVENTS).map(({ uid, ...fields }) => ({
    ...fields,
    id: `${subscription.id}-${importedId(uid)}`,
    calendar: subscription.id,
  }));
}

const newId = () => `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** The person's subscriptions, their events, and what changes them. `onProblem` is told, once until it
 * can be read again, of a feed that cannot be read when the window reads it by itself. */
export function useSubscriptions(on: boolean, onProblem: (why: string) => void) {
  const subscriptions = useDesktopValue(CALENDAR_SUBSCRIPTIONS, readSubscriptions, NONE);
  const [feeds, setFeeds] = useState<ReadonlyMap<string, readonly CalendarEntry[]>>(
    () => new Map(),
  );
  const now = useRef(subscriptions);
  now.current = subscriptions;
  const told = useRef(new Set<string>());
  // Why each feed's latest read failed, by subscription: a feed that was read since is not here.
  const failed = useRef(new Map<string, string>());
  const problem = useRef(onProblem);
  problem.current = onProblem;
  const read = useCallback(async (subscription: CalendarSubscription, signal?: AbortSignal) => {
    try {
      const events = feedEntries(subscription, await readFeed(subscription.url, signal));
      failed.current.delete(subscription.id);
      told.current.delete(subscription.id);
      setFeeds((all) => new Map(all).set(subscription.id, events));
    } catch (error) {
      if (signal?.aborted) return;
      const why = error instanceof FeedProblem ? error.message : "It could not be read.";
      failed.current.set(subscription.id, `${subscription.name}: ${why}`);
    }
  }, []);
  const ids = subscriptions.map(({ id }) => id).join();
  // A feed that cannot be read now keeps what was last read of it, and the person is told why.
  useEffect(() => {
    if (!on || ids === "") return;
    const stop = new AbortController();
    const readAll = async () => {
      await Promise.all(now.current.map((each) => read(each, stop.signal)));
      if (stop.signal.aborted) return;
      const said = now.current.filter(({ id }) => failed.current.has(id) && !told.current.has(id));
      if (said.length === 0) return;
      for (const { id } of said) told.current.add(id);
      problem.current(said.map(({ id }) => failed.current.get(id)).join("\n"));
    };
    void readAll();
    const every = setInterval(() => void readAll(), REFRESH_MS);
    return () => {
      stop.abort();
      clearInterval(every);
    };
  }, [on, ids, read]);

  const entries = useMemo(
    () => subscriptions.flatMap(({ id }) => feeds.get(id) ?? []),
    [subscriptions, feeds],
  );
  const change = (next: readonly CalendarSubscription[]) => {
    now.current = next;
    changeDesktopValue(CALENDAR_SUBSCRIPTIONS, next);
  };
  return {
    subscriptions,
    entries,
    has: (id: string | null | undefined) => subscriptions.some((each) => each.id === id),
    /** Reads the feed, and keeps it only once it can be read. Answers why not, or `null`. */
    add: async (typed: string): Promise<string | null> => {
      const url = feedAddress(typed);
      if (!url) return "That is not the web address of a calendar.";
      const refused = () =>
        now.current.some((each) => each.url === url)
          ? "You are already subscribed to this calendar."
          : now.current.length >= MAX_SUBSCRIPTIONS
            ? `Calendar keeps at most ${MAX_SUBSCRIPTIONS} subscriptions.`
            : null;
      if (refused()) return refused();
      try {
        const feed = await readFeed(url);
        // Two sheets may have asked at once: what was added meanwhile counts.
        if (refused()) return refused();
        const used = new Set(now.current.map((each) => each.color));
        const color: CalendarColor =
          CALENDAR_COLORS.find((item) => !used.has(item.id))?.id ?? "blue";
        const subscription = {
          id: newId(),
          url,
          name: feed.name?.trim().slice(0, 64) || new URL(url).host,
          color,
        };
        setFeeds((all) => new Map(all).set(subscription.id, feedEntries(subscription, feed)));
        change([...now.current, subscription]);
        return null;
      } catch (error) {
        return error instanceof FeedProblem ? error.message : "The calendar could not be read.";
      }
    },
    remove: (id: string) => change(now.current.filter((each) => each.id !== id)),
    rename: (id: string, name: string) =>
      change(now.current.map((each) => (each.id === id ? { ...each, name } : each))),
    recolor: (id: string, color: CalendarColor) =>
      change(now.current.map((each) => (each.id === id ? { ...each, color } : each))),
    /** Reads every feed again. Answers why any could not be read, each by name, or `null`. */
    refresh: async (): Promise<string | null> => {
      await Promise.all(now.current.map((each) => read(each)));
      const said = now.current.flatMap(({ id }) => failed.current.get(id) ?? []);
      return said.length > 0 ? said.join("\n") : null;
    },
  };
}

/** A subscribed event's popover: its calendar's site holds it, so it is read here and not edited. */
export function SubscribedDetails({
  entry,
  note = "This calendar is a subscription: change it where it is published.",
}: {
  entry: CalendarEntry;
  /** Why it cannot be changed here. */
  note?: string;
}) {
  return (
    <>
      <div className="mac-calendar-popover-head">
        <div className="mac-calendar-popover-name">
          <Label textStyle="title-2">{entry.title}</Label>
        </div>
      </div>
      <div className="mac-calendar-popover-row">
        {entry.start.toLocaleString(undefined, {
          dateStyle: "long",
          ...(entry.allDay ? {} : { timeStyle: "short" }),
        })}
        {entry.location ? (
          <div className="mac-calendar-popover-detail">{entry.location}</div>
        ) : null}
        {entry.notes ? <div className="mac-calendar-popover-detail">{entry.notes}</div> : null}
        <div className="mac-calendar-popover-detail">{note}</div>
      </div>
    </>
  );
}
