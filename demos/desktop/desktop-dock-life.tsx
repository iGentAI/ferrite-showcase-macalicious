"use client";

import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isOffline, onOutboxChange, readSnapshot } from "../mail/mail-outbox";
import { notificationRule } from "../system-preferences/setting-effects";
import { liveAllowed, liveState, SERVER_CHANGE_EVENT, subscribeLive } from "./desktop-live";
import { readBoolean, useDesktopValue } from "./desktop-personal";
import { servedByDesktopApp, sessionFetch, withDeadline } from "./desktop-server";

/** How often the Dock looks again for reminders that have become overdue. */
const OVERDUE_EVERY_MS = 60_000;

/** How many of the person's reminders are not completed and due before `now`'s day. */
export function overdueRemindersIn(reply: unknown, now: number): number {
  const reminders = (reply as { data?: { reminders?: unknown } | null } | null)?.data?.reminders;
  if (!Array.isArray(reminders)) return 0;
  const at = new Date(now);
  const today = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  return reminders.filter((reminder) => {
    const due = (reminder as { due?: unknown; completed?: unknown } | null)?.due;
    return (
      (reminder as { completed?: unknown } | null)?.completed !== true &&
      typeof due === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(due) &&
      due < today
    );
  }).length;
}

const startOfDay = (at: number) => new Date(at).setHours(0, 0, 0, 0);

/** Mailboxes whose unread messages All Mailboxes does not count, as Mail's does not. */
const NOT_COUNTED = new Set(["sent", "drafts", "junk", "trash"]);

/** The count Mail's General pane asks for in "Dock unread count", in messages Mail's list reads. */
export function unreadMailIn(
  messages: readonly MailHeaderRead[],
  choice: string,
  now: number,
): number {
  return messages.filter(({ unread, mailbox, at_ms }) => {
    if (unread !== true) return false;
    if (choice === "All Mailboxes") return !NOT_COUNTED.has(mailbox ?? "");
    if (mailbox !== "inbox") return false;
    return choice !== "Today" || (at_ms ?? 0) >= startOfDay(now);
  }).length;
}

/** The fields of a message's header the Dock reads. */
interface MailHeaderRead {
  mailbox?: string;
  unread?: boolean;
  at_ms?: number;
}

const getOk = (url: string) =>
  withDeadline(async (signal) => {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    return response.ok ? ((await response.json()) as unknown) : null;
  });

/** How many pages of Mail's list the count reads: 2,000 messages, the newest. */
const MAIL_PAGES = 4;

/**
 * The headers of Mail's list, the newest first; `null` when a page cannot be read. While the person
 * has taken Mail offline they are those Mail keeps in this browser: nothing is read from the server.
 */
async function mailHeaders(): Promise<readonly MailHeaderRead[] | null> {
  const me = (await getOk("/api/mail/me")) as { name?: unknown } | null;
  if (typeof me?.name !== "string") return null;
  if (isOffline(me.name)) {
    const kept = await readSnapshot<MailHeaderRead, unknown, unknown>(me.name);
    return kept?.headers ?? null;
  }
  const headers: MailHeaderRead[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAIL_PAGES; page += 1) {
    const reply = (await getOk(
      `/api/mail/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`,
    )) as { messages?: MailHeaderRead[]; next?: string | null } | null;
    if (!Array.isArray(reply?.messages)) return null;
    headers.push(...reply.messages);
    after = reply.next ?? null;
    if (!after) break;
  }
  return headers;
}

/**
 * What `read` makes of `app`'s data, read when the desktop opens, each minute, when that data
 * changes and when `changes` says; `null` until it has been read.
 */
function useServedCount<T>(
  app: string,
  read: () => Promise<T | null>,
  changes?: (listener: () => void) => () => void,
): T | null {
  const [value, setValue] = useState<T | null>(null);
  const reader = useRef(read);
  reader.current = read;
  useEffect(() => {
    if (!servedByDesktopApp()) return;
    let live = true;
    const again = (change?: Event) => {
      const changed = (change as CustomEvent<{ app?: string }> | undefined)?.detail?.app;
      if (changed && changed !== app) return;
      // A locked screen answers no module; the read comes back with the desktop.
      if (!liveAllowed()) return;
      reader.current().then(
        (next) => {
          if (live && next !== null) setValue(next);
        },
        () => {},
      );
    };
    again();
    const timer = setInterval(again, OVERDUE_EVERY_MS);
    window.addEventListener(SERVER_CHANGE_EVENT, again);
    const stop = changes?.(() => again());
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener(SERVER_CHANGE_EVENT, again);
      stop?.();
    };
  }, [app, changes]);
  return value;
}

const readOverdue = async () => {
  const reply = await getOk("/api/reminders/data");
  return reply ? overdueRemindersIn(reply, Date.now()) : null;
};

/** Mail's General pane, which Mail keeps with the person's settings. */
const MAIL_SETTINGS = "mail.settings";
const readDockCount = (stored: unknown): string | undefined => {
  const choice = (stored as { dock?: unknown } | null)?.dock;
  return typeof choice === "string" ? choice : undefined;
};

/** Dock's settings in System Preferences that act here, with the same keys and defaults. */
const ANIMATE = "dock.animate";
export const DOCK_RECENTS = "dock.recents";
export const DOCK_MINIMIZE_INTO_ICON = "dock.minimizeIntoIcon";

/** How long a tile bounces: about three bounces. */
const BOUNCE_MS = 1500;

/** How many recent applications the Dock's section shows. */
export const RECENT_TILES = 3;

/**
 * The tiles that bounce: an application that opens while Animate opening applications is on, and one
 * that a notification arrives for while it is not in front. `opened` starts the first.
 */
export function useDockBounce(front: string): {
  bouncing: ReadonlySet<string>;
  opened: (app: string) => void;
} {
  const animate = useDesktopValue(ANIMATE, readBoolean, true);
  const [bouncing, setBouncing] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const bounce = useRef((app: string) => {
    clearTimeout(timers.current.get(app));
    setBouncing((now) => new Set(now).add(app));
    timers.current.set(
      app,
      setTimeout(() => {
        timers.current.delete(app);
        setBouncing((now) => {
          const next = new Set(now);
          next.delete(app);
          return next;
        });
      }, BOUNCE_MS),
    );
  });
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  // The newest notification the page has seen: only later ones ask for attention.
  const { ready, items } = useSyncExternalStore(subscribeLive, liveState, liveState);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    const before = seen.current;
    seen.current = Math.max(before ?? 0, items[0]?.seq ?? 0);
    if (before === null) return;
    for (const item of items) {
      if (item.seq <= before) break;
      if (item.app !== front && notificationRule(item.app).allow) bounce.current(item.app);
    }
  }, [ready, items, front]);

  return {
    bouncing,
    opened: (app) => {
      if (animate) bounce.current(app);
    },
  };
}

/**
 * The red count on a tile: an application's notifications not yet cleared; for Reminders its overdue
 * reminders when there are more of them, and for Mail its unread messages, as its Preferences' "Dock
 * unread count" says.
 */
export function useDockBadges(): ReadonlyMap<string, number> {
  const { items } = useSyncExternalStore(subscribeLive, liveState, liveState);
  const overdue = useServedCount("reminders", readOverdue) ?? 0;
  const mail = useServedCount("mail", mailHeaders, onOutboxChange);
  const mailChoice = useDesktopValue(MAIL_SETTINGS, readDockCount, "Inbox Only");
  const counts = new Map<string, number>();
  for (const { app } of items) {
    if (notificationRule(app).allow) counts.set(app, (counts.get(app) ?? 0) + 1);
  }
  // A reminder's own alert is one of the notifications counted above: the larger number holds both.
  if (overdue > (counts.get("reminders") ?? 0) && notificationRule("reminders").allow)
    counts.set("reminders", overdue);
  if (mail) {
    const unread = unreadMailIn(mail, mailChoice, Date.now());
    if (unread > 0 && notificationRule("mail").allow) counts.set("mail", unread);
    else counts.delete("mail");
  }
  return counts;
}

const MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ");

/** What Calendar's tile says on the day of `at`. */
export function calendarTileDate(at: number): { month: string; day: string } {
  const date = new Date(at);
  return { month: MONTHS[date.getMonth()] ?? "", day: String(date.getDate()) };
}

/** Calendar's tile, with the date it is: drawn again a moment past each midnight. */
function CalendarDockIcon() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 1, 0);
    const timer = setTimeout(() => setNow(Date.now()), nextDay.getTime() - now);
    return () => clearTimeout(timer);
  }, [now]);
  const { month, day } = calendarTileDate(now);
  return (
    <svg
      viewBox="0 0 64 64"
      style={{ display: "block", width: "100%", height: "100%" }}
      aria-hidden="true"
      data-dock-date={day}
    >
      <rect x="5" y="5" width="54" height="54" rx="12" fill="#fff" stroke="#0002" />
      <path d="M5 21V17A12 12 0 0 1 17 5H47A12 12 0 0 1 59 17V21Z" fill="#f2453d" />
      <text
        x="32"
        y="17"
        textAnchor="middle"
        fontFamily="-apple-system, Helvetica, Arial, sans-serif"
        fontSize="11"
        fontWeight="600"
        fill="#fff"
      >
        {month}
      </text>
      <text
        x="32"
        y="49"
        textAnchor="middle"
        fontFamily="-apple-system, Helvetica, Arial, sans-serif"
        fontSize="30"
        fill="#2b2b2b"
      >
        {day}
      </text>
    </svg>
  );
}

/**
 * The tiles an application draws itself, by its id: a live date, say. A tile not listed shows the
 * application's artwork.
 */
const OWN_TILES: Readonly<Record<string, () => ReactNode>> = {
  calendar: () => <CalendarDockIcon />,
};

/** The tile the application `id` draws for itself, if it does. */
export const ownDockTile = (id: string): ReactNode => OWN_TILES[id]?.();

/** A tile's count, drawn over its icon. */
export function DockBadge({ count }: { count: number | undefined }) {
  return count ? (
    <span className="mac-desktop-shell-dock-badge" data-dock-badge="">
      {count > 99 ? "99+" : count}
    </span>
  ) : null;
}
