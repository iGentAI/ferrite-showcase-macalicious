"use client";

import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import {
  NotificationAlert,
  NotificationAlertAction,
  NotificationAlertClose,
} from "macalicious/notification-alert";
import { NotificationBanner } from "macalicious/notification-banner";
import {
  NotificationCenter,
  NotificationCenterEmpty,
  NotificationCenterGroup,
  NotificationCenterView,
} from "macalicious/notification-center";
import { PushButton } from "macalicious/push-button";
import { Switch } from "macalicious/switch";
import { TextField } from "macalicious/text-field";
import {
  TodayWidget,
  TodayWidgetDate,
  TodayWidgetRow,
  TodayWidgetSummary,
} from "macalicious/today-widget";
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { NIGHT_SHIFT_KEY } from "../system-preferences/page-layers";
import { requestPane } from "../system-preferences/pane-request";
import { dayAndMonth } from "../system-preferences/panes/language-and-region/formats";
import { bannerFor, groupsFor } from "../system-preferences/panes/notifications/notification-rules";
import { playAlert } from "../system-preferences/panes/sound/alert-sounds";
import {
  alertSoundSettings,
  callRingsThrough,
  displaySleepQuiets,
  notificationRule,
  notificationSortOrder,
  onSettingEffects,
} from "../system-preferences/setting-effects";
import type { DesktopApp } from "./desktop-apps";
import { AppTile } from "./desktop-artwork";
import {
  clearItem,
  clearItems,
  holdLiveStream,
  type InboxAction,
  type InboxItem,
  type LiveState,
  liveAllowed,
  liveState,
  openedItem,
  replyConversation,
  replyToMessage,
  runAction,
  SERVER_CHANGE_EVENT,
  setDoNotDisturb,
  subscribeLive,
} from "./desktop-live";
import { TodayWeather } from "./desktop-notification-center";
import { openItem } from "./desktop-open-item";
import { readBoolean, useDesktopSetting, useDesktopValue } from "./desktop-personal";
import {
  replyOfPageSession,
  servedByDesktopApp,
  sessionFetch,
  withDeadline,
} from "./desktop-server";
import { followDrag } from "./desktop-spaces-bar";
import {
  TodayAvailable,
  TodayCalculator,
  TodayEditList,
  TodayPins,
  useTodayLayout,
  WorldClocks,
} from "./desktop-today-widgets";

/** The other modules' routes the Today widgets read. */
export const NOTIFICATION_URLS = {
  /** The modules the server has (`GET /api/apps`): a widget reads only a module that is there. */
  apps: "/api/apps",
  podcastsWatch: "/api/podcasts/watch",
  events: "/api/calendar/events",
  reminders: "/api/reminders/data",
  watchlist: "/api/stocks/watchlist",
  quotes: "/api/stocks/quotes",
} as const;

/** How long a banner stays before it slides away; an alert stays until it is acted on. */
export const BANNER_MS = 5_000;
/** How often the desktop asks the server to look for new episodes. */
export const EPISODE_WATCH_MS = 3_600_000;
/** How far a banner dragged to the right goes before it counts as sent away. */
const SWIPE_AWAY = 48;

/** A banner dragged to the right goes, as on a Mac; let go short of that it comes back. A press opens it. */
function swipeAway(down: ReactPointerEvent<HTMLElement>, dismiss: () => void, open: () => void) {
  const banner = down.currentTarget;
  // React brings presses up from a portal too: an alert's Options menu is not part of its body.
  if (
    down.button !== 0 ||
    !banner.contains(down.target as Node) ||
    (down.target as Element).closest("button, input, textarea, a")
  ) {
    return;
  }
  followDrag(
    down.nativeEvent,
    (move) => {
      banner.style.translate = `${Math.max(0, move.clientX - down.clientX)}px 0`;
    },
    (up, started) => {
      if (!started) {
        if (up) open();
        return;
      }
      if (up && up.clientX - down.clientX >= SWIPE_AWAY) dismiss();
      else banner.style.translate = "";
    },
  );
}
/** The most banners and alerts on screen at once; older ones stay in Notification Center. */
export const MAX_BANNERS = 3;

/** An event of the Calendar widget's Up Next list. */
export interface UpNextEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
}

/** A reminder of the Reminders widget: due today, or overdue. */
export interface DueReminder {
  id: string;
  title: string;
  due: string;
  overdue: boolean;
}

/** A line of the Stocks widget: a watchlist symbol, with its quote when one could be read. */
export interface WidgetQuote {
  symbol: string;
  price?: number;
  change?: number;
}

/** `now`'s day in the browser's time zone, as `YYYY-MM-DD` (a reminder's `due`). */
export function localDay(now: number): string {
  const day = new Date(now);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`;
}

/** The events of a Calendar reply that a widget can show. */
function eventsFromServer(reply: unknown): UpNextEvent[] {
  const events = (reply as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) return [];
  const out: UpNextEvent[] = [];
  for (const event of events) {
    const value = event as Record<string, unknown> | null;
    if (typeof value !== "object" || value === null) continue;
    const { id, title, start, end } = value;
    if (typeof id !== "string" || typeof title !== "string") continue;
    if (typeof start !== "number" || typeof end !== "number") continue;
    out.push({ id, title, start, end, allDay: value.allDay === true });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Up Next: the person's events that have not ended and start before tomorrow ends, in the
 * browser's time zone, earliest first, at most four. Empty when the reply holds none (a person who
 * never saved any events has none: the Calendar demo's starting events are not theirs).
 */
export function upNextFromServer(reply: unknown, now: number): UpNextEvent[] {
  const horizon = new Date(now);
  horizon.setHours(48, 0, 0, 0);
  return eventsFromServer(reply)
    .filter((event) => event.end > now && event.start < horizon.getTime())
    .slice(0, 4);
}

/** The events that start tomorrow, in the browser's time zone, earliest first. */
export function tomorrowFromServer(reply: unknown, now: number): UpNextEvent[] {
  const start = new Date(now);
  start.setHours(24, 0, 0, 0);
  const end = new Date(now);
  end.setHours(48, 0, 0, 0);
  return eventsFromServer(reply).filter(
    (event) => event.start >= start.getTime() && event.start < end.getTime(),
  );
}

/** The line at the end of Today about tomorrow. */
export function tomorrowText(events: readonly UpNextEvent[]): string {
  const first = events[0];
  if (!first) return "You have no events scheduled for tomorrow.";
  const when = first.allDay
    ? "all day"
    : `at ${new Date(first.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const count = events.length === 1 ? "1 event" : `${events.length} events`;
  return `You have ${count} tomorrow. The first is “${first.title}”, ${when}.`;
}

/** The person's reminders not completed and due today or before, oldest due first, at most five. */
export function dueRemindersFromServer(reply: unknown, now: number): DueReminder[] {
  const reminders = (reply as { data?: { reminders?: unknown } | null } | null)?.data?.reminders;
  if (!Array.isArray(reminders)) return [];
  const today = localDay(now);
  const out: DueReminder[] = [];
  for (const reminder of reminders) {
    const value = reminder as Record<string, unknown> | null;
    if (typeof value !== "object" || value === null || value.completed === true) continue;
    const { id, title, due } = value;
    if (typeof id !== "string" || typeof title !== "string" || typeof due !== "string") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due > today) continue;
    out.push({ id, title, due, overdue: due < today });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
}

/** The symbols of a Stocks watchlist reply; empty before the person saved one. */
export function watchlistFromServer(reply: unknown): string[] {
  const symbols = (reply as { symbols?: unknown } | null)?.symbols;
  return Array.isArray(symbols)
    ? symbols.filter((symbol): symbol is string => typeof symbol === "string").slice(0, 6)
    : [];
}

/** The quotes of a Stocks quotes reply. */
export function quotesFromServer(reply: unknown): Required<WidgetQuote>[] {
  const quotes = (reply as { quotes?: unknown } | null)?.quotes;
  if (!Array.isArray(quotes)) return [];
  return quotes.flatMap((quote): Required<WidgetQuote>[] => {
    const value = quote as Record<string, unknown> | null;
    const symbol = value?.symbol;
    const price = value?.price;
    const change = value?.change;
    return typeof symbol === "string" &&
      typeof price === "number" &&
      Number.isFinite(price) &&
      typeof change === "number" &&
      Number.isFinite(change)
      ? [{ symbol, price, change }]
      : [];
  });
}

/** "now", "5m ago", "3:51 PM" today, "Oct 3, 3:51 PM" before. */
export function deliveredText(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const when = new Date(at);
  const time = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (when.toDateString() === new Date(now).toDateString()) return time;
  return `${when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

/** "All-day", "2:00 – 3:00 PM", with "Tomorrow" before an event of tomorrow. */
export function eventTimeText(event: UpNextEvent, now: number): string {
  const time = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const span = event.allDay ? "All-day" : `${time(event.start)} – ${time(event.end)}`;
  const tomorrow = localDay(event.start) !== localDay(now) && event.start > now;
  return tomorrow ? `Tomorrow, ${span}` : span;
}

const getJson = (url: string) =>
  withDeadline(async (signal) => {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    const body = (await response.json().catch(() => null)) as unknown;
    // Another person's data never shows on this page: a reply for another session ends it.
    if (!replyOfPageSession(response.status, body)) throw new Error("the page's session ended");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return body;
  });

/**
 * The person's live notifications and Do Not Disturb (`desktop-live.ts`); the stream stays open
 * while a caller of this hook is mounted and the desktop is served.
 */
export function useLiveNotifications(served: boolean): LiveState {
  useEffect(() => (served ? holdLiveStream() : undefined), [served]);
  return useSyncExternalStore(subscribeLive, liveState, liveState);
}

/**
 * Asks the server to look for new episodes of the person's shows, once when asked and every hour after that, whether
 * or not Podcasts is open. `GET /api/podcasts/watch` delivers what it finds to the person's notifications, each episode
 * once, and they arrive here on the live stream.
 */
export function useEpisodeWatch(wanted: boolean): void {
  useEffect(() => {
    if (!wanted) return;
    const look = () => {
      getJson(NOTIFICATION_URLS.podcastsWatch).catch(() => undefined);
    };
    look();
    const every = setInterval(look, EPISODE_WATCH_MS);
    return () => clearInterval(every);
  }, [wanted]);
}

/** The names of the modules a `GET /api/apps` reply lists. */
export function modulesFromServer(reply: unknown): Set<string> {
  const apps = (reply as { apps?: unknown } | null)?.apps;
  if (!Array.isArray(apps)) return new Set();
  return new Set(
    apps.flatMap((app) => {
      const name = (app as { name?: unknown } | null)?.name;
      return typeof name === "string" ? [name] : [];
    }),
  );
}

/**
 * What the Today widgets show, each `null` while it is read and `undefined` when the server has
 * no module for it.
 */
interface TodayData {
  events: UpNextEvent[] | null | undefined;
  /** The events of tomorrow, once they are read. */
  tomorrow?: UpNextEvent[];
  due: DueReminder[] | null | undefined;
  /** The watchlist's symbols, each with its quote when one could be read; empty without one. */
  stocks: WidgetQuote[] | null | undefined;
}

/** The Today widgets' modules, and the part of `TodayData` each fills. */
const TODAY_PARTS = { calendar: "events", reminders: "due", stocks: "stocks" } as const;
type TodayApp = keyof typeof TODAY_PARTS;

/** Read one widget's data from its module. */
async function readToday(app: TodayApp, at: number): Promise<Partial<TodayData>> {
  switch (app) {
    case "calendar": {
      const reply = await getJson(NOTIFICATION_URLS.events);
      return { events: upNextFromServer(reply, at), tomorrow: tomorrowFromServer(reply, at) };
    }
    case "reminders":
      return { due: dueRemindersFromServer(await getJson(NOTIFICATION_URLS.reminders), at) };
    case "stocks": {
      const symbols = watchlistFromServer(await getJson(NOTIFICATION_URLS.watchlist));
      if (symbols.length === 0) return { stocks: [] };
      const query = symbols.map(encodeURIComponent).join(",");
      // The watchlist shows whether or not its quotes can be read.
      const quotes = await getJson(`${NOTIFICATION_URLS.quotes}?symbols=${query}`).then(
        quotesFromServer,
        () => [],
      );
      return {
        stocks: symbols.map(
          (symbol) => quotes.find((quote) => quote.symbol === symbol) ?? { symbol },
        ),
      };
    }
  }
}

/**
 * The Today widgets' data: read when the panel opens, and each widget again when the person changes
 * its app's data in another browser (`SERVER_CHANGE_EVENT`). A widget shows only the newest read
 * of it, so an older reply arriving late never replaces a newer one.
 */
function useToday(served: boolean, now: () => number): TodayData {
  const [data, setData] = useState<TodayData>({ events: null, due: null, stocks: null });
  useEffect(() => {
    if (!served) return;
    let live = true;
    let modules: Set<string> | null = null;
    const generations: Record<TodayApp, number> = { calendar: 0, reminders: 0, stocks: 0 };
    const read = (app: TodayApp) => {
      if (!modules) return;
      const part = TODAY_PARTS[app];
      if (!modules.has(app)) {
        setData((current) => ({ ...current, [part]: undefined }));
        return;
      }
      generations[app] += 1;
      const mine = generations[app];
      const take = (next: Partial<TodayData>) => {
        if (live && mine === generations[app]) setData((current) => ({ ...current, ...next }));
      };
      readToday(app, now()).then(take, () => take({ [part]: [] }));
    };
    getJson(NOTIFICATION_URLS.apps).then(
      (reply) => {
        if (!live) return;
        modules = modulesFromServer(reply);
        for (const app of Object.keys(TODAY_PARTS) as TodayApp[]) read(app);
      },
      () => {
        if (live) setData({ events: [], due: [], stocks: [] });
      },
    );
    const changed = (event: Event) => {
      const app = (event as CustomEvent<{ app?: unknown }>).detail?.app;
      if (typeof app === "string" && Object.hasOwn(TODAY_PARTS, app)) read(app as TodayApp);
    };
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    return () => {
      live = false;
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
    };
  }, [served, now]);
  return data;
}

/** A crescent, standing in for the Do Not Disturb glyph. */
const moon = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M11 2a6.5 6.5 0 1 0 3 9.5A6 6 0 0 1 11 2z" fill="currentColor" />
  </svg>
);

/** A sun, standing in for the Night Shift glyph. */
const sun = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <circle cx="8" cy="8" r="3" fill="currentColor" />
    <path
      d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15M3 3l1.8 1.8M11.2 11.2 13 13M3 13l1.8-1.8M11.2 4.8 13 3"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  </svg>
);

/** A clock, for the World Clock widget's header. */
const clockGlyph = (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 4v4l3 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export interface DesktopNotificationCenterProps {
  /** The desktop's applications, for their names and tiles. */
  apps: readonly DesktopApp[];
  /** Open an application, or bring it to the front. */
  launch: (id: string) => void;
  /** Hide the panel. */
  onClose: () => void;
  /** The time now, in epoch milliseconds (for tests). */
  now?: () => number;
}

const wallClock = () => Date.now();

/**
 * Notification Center over the desktop, under the menu bar at the trailing edge. Today shows
 * the browser's date. When the desktop is served by the `macalicious-desktop` Ferrite
 * application, Today also has the Do Not Disturb switch, a summary, and widgets with the person's
 * own Calendar events (Up Next), Reminders due today, Stocks watchlist, World Clock and Calculator,
 * chosen and ordered with the Edit button, each read again when
 * the person changes it in another browser; Notifications lists what every app delivered to the
 * person, live, grouped by app (`desktop-live.ts`). A notification opens its application; Clear
 * dismisses it in every browser of the person. Every other build has no notifications to show.
 * Escape, or a press beside the panel, hides it.
 */
export function DesktopNotificationCenter({
  apps,
  launch,
  onClose,
  now = wallClock,
}: DesktopNotificationCenterProps) {
  const served = servedByDesktopApp();
  const live = useLiveNotifications(served);
  const today = useToday(served, now);
  const layout = useTodayLayout();
  const [editing, setEditing] = useState(false);
  const [nightShift, setNightShift] = useDesktopSetting(NIGHT_SHIFT_KEY, readBoolean, false);
  const asStored = (stored: unknown) => stored;
  const region = useDesktopValue<unknown>("language-and-region.region", asStored, undefined);
  const calendar = useDesktopValue<unknown>("language-and-region.calendar", asStored, undefined);
  // An alert's actions here: the ones under way, and what the app could not do, to try again.
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const [failures, setFailures] = useState<ReadonlyMap<number, string>>(new Map());
  const act = (item: InboxItem, action: InboxAction) => {
    setPending((current) => new Set(current).add(item.seq));
    setFailures((current) => {
      const next = new Map(current);
      next.delete(item.seq);
      return next;
    });
    void runAction(item, action).then((done) => {
      setPending((current) => {
        const next = new Set(current);
        next.delete(item.seq);
        return next;
      });
      // Done: the alert leaves the inbox. Not done: it stays, saying so.
      if (!done) {
        setFailures((current) =>
          new Map(current).set(item.seq, `${action.label} did not work. Try again.`),
        );
      }
    });
  };
  const panel = useRef<HTMLElement>(null);
  useEffect(() => panel.current?.querySelector<HTMLElement>('[role="tab"]')?.focus(), []);
  // Escape hides the panel wherever focus is: a Clear button that was pressed is gone, and focus
  // with it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const appName = (id: string) => apps.find((app) => app.id === id)?.name ?? id;
  const tile = (id: string) => <AppTile id={id} name={appName(id)} />;
  const open = (id: string) => {
    if (apps.some((app) => app.id === id)) launch(id);
    onClose();
  };
  // One thing of an application's: the application opens and is asked to show it.
  const openThing = (app: string, id: string, title: string) => {
    openItem({ app, id, title });
    open(app);
  };
  const at = now();
  const date = new Date(at);
  // Its own settings in System Preferences > Notifications decide what shows here.
  const listed = live.items.filter((item) => {
    const rule = notificationRule(item.app);
    return rule.allow && rule.center;
  });
  const count = listed.length;
  const groups = groupsFor(listed, notificationSortOrder());
  const next = today.events?.[0];
  const cardOf = (widget: { id: string }): ReactNode => {
    switch (widget.id) {
      case "calendar":
        return today.events === undefined ? null : (
          <TodayWidget key={widget.id} title="Calendar" icon={tile("calendar")}>
            <WidgetList
              empty={today.events === null ? "Loading…" : "No events today or tomorrow"}
              rows={(today.events ?? []).map((event) => ({
                key: event.id,
                title: event.title,
                detail: eventTimeText(event, at),
                onOpen: () => openThing("calendar", event.id, event.title),
              }))}
            />
          </TodayWidget>
        );
      case "reminders":
        return today.due === undefined ? null : (
          <TodayWidget key={widget.id} title="Reminders" icon={tile("reminders")}>
            <WidgetList
              empty={today.due === null ? "Loading…" : "No reminders due today"}
              rows={(today.due ?? []).map((reminder) => ({
                key: reminder.id,
                title: reminder.title,
                detail: reminder.overdue ? "Overdue" : "Today",
                onOpen: () => openThing("reminders", reminder.id, reminder.title),
              }))}
            />
          </TodayWidget>
        );
      case "stocks":
        return today.stocks ? (
          <TodayWidget key={widget.id} title="Stocks" icon={tile("stocks")}>
            <WidgetList
              empty="No symbols in your watchlist"
              rows={today.stocks.map((quote) => ({
                key: quote.symbol,
                title: quote.symbol,
                detail: quote.price === undefined ? "No quote" : quote.price.toFixed(2),
                change: quote.change,
                onOpen: () => openThing("stocks", quote.symbol, quote.symbol),
              }))}
            />
          </TodayWidget>
        ) : null;
      case "world-clock":
        return (
          <TodayWidget key={widget.id} title="World Clock" icon={clockGlyph}>
            <WorldClocks now={now} />
          </TodayWidget>
        );
      case "weather":
        return (
          <TodayWidget key={widget.id} title="Weather" icon={sun}>
            <TodayWeather />
          </TodayWidget>
        );
      case "calculator":
        return (
          <TodayWidget key={widget.id} title="Calculator" icon={tile("calculator")}>
            <TodayCalculator />
          </TodayWidget>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="mac-desktop-shell-notification-center"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {editing ? <TodayAvailable widgets={layout.available} onAdd={layout.add} /> : null}
      <NotificationCenter
        ref={panel}
        editLabel={served ? (editing ? "Done" : "Edit") : undefined}
        onEdit={() => setEditing(!editing)}
        onValueChange={() => setEditing(false)}
        onSettings={
          served
            ? () => {
                requestPane("notifications");
                launch("system-preferences");
                onClose();
              }
            : undefined
        }
      >
        <NotificationCenterView value="today">
          {served ? (
            <TodayWidget aria-label="Quick settings">
              <TodayWidgetRow label="Night Shift" icon={sun}>
                <Switch checked={nightShift} onCheckedChange={setNightShift} />
              </TodayWidgetRow>
              <TodayWidgetRow label="Do Not Disturb" icon={moon}>
                <Switch
                  checked={live.dnd}
                  onCheckedChange={(on) => void setDoNotDisturb(on)}
                  disabled={!live.ready}
                />
              </TodayWidgetRow>
            </TodayWidget>
          ) : null}
          <TodayWidgetDate
            weekday={`${date.toLocaleDateString("en-US", { weekday: "long" })},`}
            date={
              served
                ? dayAndMonth(date, region, calendar)
                : date.toLocaleDateString("en-US", { month: "long", day: "numeric" })
            }
          />
          <TodayWidgetSummary>
            <p>
              {!served
                ? "Reminders and messages show here when the desktop is served by its Ferrite application."
                : !live.ready
                  ? "Notifications are on their way from the server."
                  : count === 0
                    ? "You have no notifications."
                    : `You have ${count} ${count === 1 ? "notification" : "notifications"}.`}
            </p>
            {served && next ? (
              <p>
                The next thing on your calendar is “{next.title}”, {eventTimeText(next, at)}.
              </p>
            ) : null}
          </TodayWidgetSummary>
          {!served ? null : editing ? (
            <TodayEditList
              widgets={layout.shown}
              cardOf={cardOf}
              onMove={layout.move}
              onRemove={layout.remove}
            />
          ) : (
            <>
              {layout.shown.map(cardOf)}
              <TodayPins />
              {today.tomorrow ? (
                <TodayWidgetSummary>
                  <p className="mac-desktop-shell-today-tomorrow">Tomorrow</p>
                  <p>{tomorrowText(today.tomorrow)}</p>
                </TodayWidgetSummary>
              ) : null}
            </>
          )}
        </NotificationCenterView>
        <NotificationCenterView value="notifications">
          {count === 0 ? <NotificationCenterEmpty>No Notifications</NotificationCenterEmpty> : null}
          {groups.map(([app, items]) => (
            <NotificationCenterGroup
              key={`${app} ${items[0]?.seq}`}
              heading={appName(app)}
              onClear={() => void clearItems(app)}
              clearLabel={`Clear ${appName(app)}`}
            >
              {items.map((item) => {
                const banner = (
                  <NotificationBanner
                    key={item.seq}
                    app={appName(app)}
                    icon={tile(app)}
                    time={deliveredText(item.at_ms, at)}
                    title={item.title}
                    subtitle={item.subtitle ?? item.body}
                    onOpen={() => {
                      void openedItem(item);
                      openThing(app, item.id, item.title);
                    }}
                    onClear={() => void clearItem(item)}
                  >
                    {item.subtitle ? item.body : undefined}
                  </NotificationBanner>
                );
                const actions = item.alert ? (item.actions ?? []).filter((each) => each.post) : [];
                if (actions.length === 0) return banner;
                // An alert keeps its actions here, where it collects: one that came under Do Not
                // Disturb, before the page opened or behind this panel was never on screen.
                const failed = failures.get(item.seq);
                return (
                  <div key={item.seq} className="mac-desktop-shell-center-alert">
                    {banner}
                    <div className="mac-desktop-shell-center-actions">
                      {failed ? (
                        <span className="mac-desktop-shell-center-failed" role="status">
                          {failed}
                        </span>
                      ) : null}
                      {actions.map((action) => (
                        <PushButton
                          key={action.label}
                          size="small"
                          disabled={pending.has(item.seq)}
                          onClick={() => act(item, action)}
                        >
                          {action.label}
                        </PushButton>
                      ))}
                    </div>
                  </div>
                );
              })}
            </NotificationCenterGroup>
          ))}
        </NotificationCenterView>
      </NotificationCenter>
    </div>
  );
}

/** The rows of a Today widget: a title and its detail, or one line saying there are none. */
function WidgetList({
  rows,
  empty,
}: {
  rows: readonly {
    key: string;
    title: string;
    detail: string;
    change?: number;
    onOpen: () => void;
  }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="mac-desktop-shell-today-empty">{empty}</p>;
  return (
    <ul className="mac-desktop-shell-today-list">
      {rows.map((row) => (
        <li key={row.key}>
          <button type="button" className="mac-desktop-shell-today-row" onClick={row.onOpen}>
            <span className="mac-desktop-shell-today-title">{row.title}</span>
            <span className="mac-desktop-shell-today-detail">{row.detail}</span>
            {row.change !== undefined ? (
              <span
                className="mac-desktop-shell-today-change"
                data-direction={row.change < 0 ? "down" : "up"}
              >
                {row.change < 0 ? "−" : "+"}
                {Math.abs(row.change).toFixed(2)}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface DesktopNotificationBannersProps {
  /**
   * The desktop's applications, for their names; a notification of another app is named by its
   * id.
   * @default []
   */
  apps?: readonly DesktopApp[];
  /** Open an application, or bring it to the front; an id the desktop does not host is ignored. */
  launch: (id: string) => void;
  /**
   * Whether Notification Center is showing: the banners on screen go away, as on a Mac, and
   * nothing comes in over the panel; everything is listed in it.
   * @default false
   */
  covered?: boolean;
}

/**
 * The banners and alerts that come in at the top trailing corner when an app delivers a
 * notification to the person (`desktop-live.ts`), in every browser the person has open. A banner
 * slides away after `BANNER_MS` and stays in Notification Center; an alert stays until Close or
 * its action (with two actions, chosen from its Options pull-down, as Reminders' are). With Do Not Disturb on, nothing comes in, and everything still collects in
 * Notification Center. Only notifications delivered after the page opened come in; one cleared
 * in another browser leaves the screen here too. Renders nothing unless the desktop is served;
 * when it is, the banners are rendered into the page's `<body>` (a portal, as the library's menus
 * are), at the top trailing corner of the window, which the served desktop fills.
 */
/** What stays waiting: everything that fits on screen, and every alert past it. */
function waiting(list: readonly InboxItem[]): readonly InboxItem[] {
  return list.filter((item, index) => index < MAX_BANNERS || item.alert);
}

/** Whether an open window of `app` sounds for its own arrivals: Mail plays the sound its Preferences chose. */
export const soundsItself = (app: string, root: ParentNode = document) =>
  app === "mail" && root.querySelector('[data-window-id="mail"]') !== null;

export function DesktopNotificationBanners({
  apps = [],
  launch,
  covered: coveredProp = false,
}: DesktopNotificationBannersProps) {
  const served = servedByDesktopApp();
  const live = useLiveNotifications(served);
  // The person answering a message on a banner: it stays until they send or leave it.
  const [replying, setReplying] = useState<{
    seq: number;
    text: string;
    key: string;
    failed: boolean;
    sending: boolean;
  } | null>(null);
  // The desktop is covered by the login window or the lock screen: nothing shows over it, and
  // nothing stays reachable by keyboard or assistive technology beneath it.
  const showing = useSyncExternalStore(subscribeLive, liveAllowed, () => true);
  const covered = coveredProp || !showing;
  // Everything waiting to be shown, newest first. Only the first MAX_BANNERS are on screen; an
  // alert past them waits for a place (it stays until acted on), while a banner that no longer
  // fits leaves the screen and stays in Notification Center.
  const [shown, setShown] = useState<readonly InboxItem[]>([]);
  const visible = shown.slice(0, MAX_BANNERS);
  // Read when a failed write's alert would come back, which can be long after this render.
  const coveredNow = useRef(covered);
  coveredNow.current = covered;
  // The newest notification already seen: what was delivered before the page opened, or while
  // Do Not Disturb was on or Notification Center was showing, does not come in.
  const newest = useRef<number | null>(null);
  useEffect(() => {
    // Not ready (opening, or cleared by a refused ticket): nothing shown before stays, and the
    // next state is the baseline again.
    if (!live.ready) {
      newest.current = null;
      setShown([]);
      return;
    }
    const top = live.items[0]?.seq ?? 0;
    const seen = newest.current;
    newest.current = Math.max(seen ?? 0, top);
    const present = new Set(live.items.map((item) => item.seq));
    const quiet = live.dnd || displaySleepQuiets();
    // Every call that arrives is heard, oldest first: a later one may be its caller's second.
    const ringing = new Set(
      seen === null
        ? []
        : live.items
            .filter((item) => item.seq > seen)
            .reverse()
            .filter((item) => callRingsThrough(item))
            .map((item) => item.seq),
    );
    const fresh =
      seen === null || covered
        ? []
        : live.items.filter((item) => item.seq > seen && (!quiet || ringing.has(item.seq)));
    // One sound for what came in together. Sound is its own setting: an app with no banners may
    // still sound, and an app that is off does not.
    const sounding = fresh.some((item) => {
      const rule = notificationRule(item.app);
      return rule.allow && rule.sound && !soundsItself(item.app);
    });
    const { name, volume, muted } = alertSoundSettings();
    if (sounding && !muted) playAlert(name, volume);
    const incoming = fresh.flatMap((item) => {
      const banner = bannerFor(item, notificationRule(item.app));
      return banner ? [banner] : [];
    });
    setShown((current) =>
      covered ? [] : waiting([...incoming, ...current.filter((item) => present.has(item.seq))]),
    );
  }, [live, covered]);

  // An application turned off, or set to no alerts, takes what it has on screen with it.
  useEffect(
    () =>
      onSettingEffects(() =>
        setShown((current) => {
          const kept = current.filter((item) => bannerFor(item, notificationRule(item.app)));
          return kept.length === current.length ? current : kept;
        }),
      ),
    [],
  );

  const hide = useCallback((seq: number) => {
    setShown((current) => current.filter((item) => item.seq !== seq));
  }, []);
  // Each banner on screen slides away after its time; an alert stays. A waiting alert's place
  // comes when one in front of it goes.
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const visibleKey = visible.map((item) => item.seq).join(",");
  const replyingSeq = replying?.seq;
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the banners on screen
  useEffect(() => {
    const showing = new Set(
      visible.filter((item) => item.seq !== replyingSeq).map((item) => item.seq),
    );
    for (const [seq, timer] of timers.current) {
      if (!showing.has(seq)) {
        clearTimeout(timer);
        timers.current.delete(seq);
      }
    }
    for (const item of visible) {
      if (item.alert || item.seq === replyingSeq || timers.current.has(item.seq)) continue;
      timers.current.set(
        item.seq,
        setTimeout(() => {
          timers.current.delete(item.seq);
          hide(item.seq);
        }, BANNER_MS),
      );
    }
  }, [visibleKey, replyingSeq, hide]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  // Covered (Notification Center, the login window or the lock screen): nothing is drawn, at once.
  if (!served || !live.ready || covered || visible.length === 0) return null;
  const appName = (id: string) => apps.find((app) => app.id === id)?.name ?? id;
  const open = (item: InboxItem) => {
    hide(item.seq);
    void openedItem(item);
    openItem({ app: item.app, id: item.id, title: item.title });
    launch(item.app);
  };
  const act = (item: InboxItem, action: InboxAction) => {
    if (!action.post) return open(item);
    hide(item.seq);
    // An action the app could not carry out leaves the alert in place, to try again.
    void runAction(item, action).then((done) => restoreUnless(done, item));
  };
  // An alert whose Close or action failed comes back, unless it has gone from the inbox since
  // (cleared in another browser) or Notification Center covers the corner now.
  function restoreUnless(done: boolean, item: InboxItem) {
    if (done) return;
    setShown((current) =>
      coveredNow.current ||
      current.some((shownItem) => shownItem.seq === item.seq) ||
      !liveState().items.some((each) => each.seq === item.seq)
        ? current
        : waiting([item, ...current]),
    );
  }
  const sendReply = (item: InboxItem) => {
    if (!replying || replying.sending || replying.text.trim() === "") return;
    const { text, key } = replying;
    const sent = { ...replying, sending: false, failed: false };
    // Until its answer comes (within the request's deadline), this reply cannot be left or replaced.
    setReplying({ ...sent, sending: true });
    void replyToMessage(item, text, key).then((done) => {
      setReplying(done ? null : { ...sent, sending: false, failed: true });
      if (done) hide(item.seq);
    });
  };
  return createPortal(
    <div className="mac-desktop-shell-banners">
      {visible.map((item) => {
        const actions = item.actions ?? [];
        const [action] = actions;
        const answering = replying?.seq === item.seq ? replying : null;
        const dismiss = () => {
          if (answering?.sending) return;
          hide(item.seq);
          if (answering) setReplying(null);
          // Closing an alert clears it; a banner sent away stays in Notification Center.
          if (item.alert) void clearItem(item).then((done) => restoreUnless(done, item));
        };
        return (
          <NotificationAlert
            key={item.seq}
            role={item.alert ? "alert" : "status"}
            data-app={item.app}
            data-style={item.alert ? "alert" : "banner"}
            title={item.title}
            subtitle={item.subtitle}
            icon={<AppTile id={item.app} name={appName(item.app)} />}
            onDismiss={dismiss}
            onPointerDown={
              answering ? undefined : (down) => swipeAway(down, dismiss, () => open(item))
            }
            actions={
              answering ? (
                <>
                  <NotificationAlertAction
                    disabled={answering.sending}
                    onClick={() => sendReply(item)}
                  >
                    Send
                  </NotificationAlertAction>
                  <NotificationAlertAction
                    disabled={answering.sending}
                    onClick={() => setReplying(null)}
                  >
                    Cancel
                  </NotificationAlertAction>
                </>
              ) : item.alert ? (
                <>
                  <NotificationAlertClose>Close</NotificationAlertClose>
                  {actions.length > 1 ? (
                    // Two actions: the Options pull-down of a Catalina alert.
                    <Menu>
                      <MenuTrigger render={<NotificationAlertAction />}>Options</MenuTrigger>
                      <MenuPopup side="bottom" align="end">
                        {actions.map((choice) => (
                          <MenuItem key={choice.label} onClick={() => act(item, choice)}>
                            {choice.label}
                          </MenuItem>
                        ))}
                      </MenuPopup>
                    </Menu>
                  ) : action ? (
                    <NotificationAlertAction onClick={() => act(item, action)}>
                      {action.label}
                    </NotificationAlertAction>
                  ) : null}
                </>
              ) : (
                <>
                  {replyConversation(item) !== undefined ? (
                    <NotificationAlertAction
                      disabled={replying?.sending === true}
                      onClick={() =>
                        setReplying({
                          seq: item.seq,
                          text: "",
                          key: crypto.randomUUID(),
                          failed: false,
                          sending: false,
                        })
                      }
                    >
                      Reply
                    </NotificationAlertAction>
                  ) : null}
                  <NotificationAlertAction onClick={() => open(item)}>Show</NotificationAlertAction>
                </>
              )
            }
          >
            {item.body}
            {answering ? (
              <div className="mac-desktop-shell-banner-reply">
                <TextField
                  aria-label={`Reply to ${item.title}`}
                  autoFocus
                  value={answering.text}
                  // Once sent, its key stands for these words: a try again sends them, or the person leaves it.
                  readOnly={answering.sending || answering.failed}
                  onValueChange={(text) => setReplying({ ...answering, text })}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === "Enter") {
                      event.preventDefault();
                      sendReply(item);
                    }
                    if (event.key === "Escape" && !answering.sending) setReplying(null);
                  }}
                />
                {answering.failed ? (
                  <span role="status">Not sent, or not heard back. Try again, or Cancel.</span>
                ) : null}
              </div>
            ) : null}
          </NotificationAlert>
        );
      })}
    </div>,
    document.body,
  );
}
