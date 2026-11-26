"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { CalendarMiniMonth } from "macalicious/calendar-mini-month";
import { CalendarWeekGrid, type CalendarWeekGridEvent } from "macalicious/calendar-week-grid";
import { Checkbox } from "macalicious/checkbox";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DatePicker } from "macalicious/date-picker";
import { DefaultButton } from "macalicious/default-button";
import { InspectorPanel } from "macalicious/inspector-panel";
import { Label } from "macalicious/label";
import { ListView, ListViewRowDetail, ListViewRowTitle } from "macalicious/list-view";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import {
  NotificationAlert,
  NotificationAlertAction,
  NotificationAlertClose,
} from "macalicious/notification-alert";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Popover, PopoverPopup, type PopoverPopupProps } from "macalicious/popover";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ADDRESS_DRAG_TYPE, accountOfDrag } from "../contacts/contacts-drag";
import { useContactPeople } from "../contacts/contacts-people";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import {
  type DesktopDragItem,
  filesOfDrag,
  landingAt,
  registerDropTarget,
  useDesktopDrop,
} from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { useMainWindowItem } from "../desktop/desktop-main-window";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";

/** How far View > Make Text Bigger and Smaller go, in the steps `calendar.tokens.css` holds. */
const LEAST_TEXT_STEP = -1;
const MOST_TEXT_STEP = 3;
const CALENDAR_TEXT_STEP = "calendar.textStep";
const readTextStep = (stored: unknown) =>
  typeof stored === "number" &&
  Number.isInteger(stored) &&
  stored >= LEAST_TEXT_STEP &&
  stored <= MOST_TEXT_STEP
    ? stored
    : undefined;

import {
  type AddressRequest,
  askToReach,
  onAddressRequest,
  takeAddressRequests,
} from "../desktop/desktop-reach";
import {
  CHANGED_ELSEWHERE,
  onSaveFailure,
  reloadServerDocuments,
  servedByDesktopApp,
  serverDocument,
  useServerState,
} from "../desktop/desktop-server";
import { copyText, FileShareItems, LinkShareItems } from "../desktop/desktop-share-link";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { onOpenFileRequest, takeOpenFileRequests } from "../finder/finder-open";
import { askMapsSearch } from "../maps/maps-open";
import { requestPane } from "../system-preferences/pane-request";
import { AddressPanel, NO_AVAILABILITY } from "./calendar-address-panel";
import { useAlertAnswers } from "./calendar-alert-watch";
import {
  alertingEntries,
  alertsToTell,
  alertWhen,
  BIRTHDAY_ALERTS,
  type DueAlert,
  mergedAlertStates,
  NO_BIRTHDAY_ALERTS,
  readBirthdayAlerts,
  restoredAlerts,
  SNOOZE_CHOICES,
  useEventAlerts,
  withoutRemovedSnooze,
} from "./calendar-alerts";
import { BirthdayDetails, useBirthdays } from "./calendar-birthdays";
import {
  BIRTHDAYS,
  calendars as builtInCalendars,
  CALENDAR_COLORS,
  CAPTURE_NOW,
  type CalendarColor,
  type CalendarEntry,
  type CalendarInfo,
  type CalendarSettings,
  type CalendarView,
  colorValue,
  dayAt,
  defaultEvents,
  defaultOwnCalendars,
  defaultSettings,
  HOLIDAYS,
  INVITATIONS,
  type OwnCalendar,
  sameDay,
  step,
  VIEWS,
  weekStart,
} from "./calendar-data";
import {
  draggedTimes,
  dragShift,
  movesWhole,
  SNAP_MINUTES,
  type Times,
  useGridCreate,
  useGridDrag,
} from "./calendar-drag";
import { EventDetails, type EventField } from "./calendar-editor";
import { uploadEventFile } from "./calendar-event-files";
import { densityLevel, eventsPerDay, TRAVEL_BLOCK, withTravelBlocks } from "./calendar-fields";
import { isIcsFile, MAX_EVENTS, useCalendarFiles } from "./calendar-files";
import {
  CALENDAR_GROUPS,
  type CalendarGroup,
  groupShown,
  moveCalendarBefore,
  moveCalendarToGroup,
  NO_CALENDAR_GROUPS,
  readCalendarGroups,
} from "./calendar-groups";
import { holidaysBeside, isWorkedOutHoliday } from "./calendar-holidays";
import { ColorChip, SubscriptionGlyph } from "./calendar-icons";
import { lookupInvitee, useCalendarInvitations } from "./calendar-invitations";
import { accountOfCard, InvitationDetails, MAX_INVITEES, notInvitable } from "./calendar-invitees";
import { CalendarMonthGrid, eventsOnDay, monthGridDays, useMonthDrag } from "./calendar-month-grid";
import { eventOfOpenItem } from "./calendar-open";
import {
  ALTERNATE_CALENDARS,
  type AlternateCalendar,
  alternateDate,
  useAlternateCalendar,
  useAlternateShown,
  useSeparateEvents,
  useWeekNumbers,
  useYearEvents,
  weekNumber,
} from "./calendar-options";
import type { PrintOptions } from "./calendar-print";
import { CalendarPrintSheet, printCalendar } from "./calendar-print-panel";
import { parseQuickEvent, quickEventFits } from "./calendar-quick-event";
import {
  localZone,
  movedSeries,
  nextOccurrence,
  occurrenceId,
  occurrences,
} from "./calendar-recurrence";
import {
  CALENDAR_EVENTS_URL,
  documentFromServer,
  documentToServer,
  settingsFromServer,
  tellAlertsShown,
} from "./calendar-server";
import { useStoredSettings, useSystemFirstDay } from "./calendar-settings";
import { SubscribedDetails, useSubscriptions } from "./calendar-subscriptions";
import { useCalendarTextTools } from "./calendar-text-tools";
import { useWeekWheel } from "./calendar-week-scroll";
import { readWindowState, writeWindowState } from "./calendar-window-state";
import {
  fromPopover,
  fromWindowClock,
  onWindowClock,
  toWindowClock,
  ZONES,
  zoneName,
} from "./calendar-window-zone";
import "./calendar.tokens.css";
import "./calendar.css";

/** Why File > Export Event… is dimmed while no event is selected. */
export const EXPORT_EVENT_UNAVAILABLE = "Select an event in the calendar to export it.";
/** Why File > Save Event to Drive… is dimmed while no event is selected. */
export const SAVE_EVENT_UNAVAILABLE = "Select an event in the calendar to save it to your Drive.";
/** Why the File menu's event commands are dimmed while the calendars load. */
export const CALENDAR_LOADING = "Calendar is still loading your calendars.";
/** Why Mail Event is dimmed on an event nobody is invited to. */
export const NOBODY_TO_MAIL = "Nobody is invited to this event.";
/** Why Show in Maps is dimmed on an event with no location. */
export const NO_LOCATION = "This event has no location.";
/** Why the commands that reach another application are dimmed off the desktop. */
export const NOT_ON_DESKTOP = "Other applications open only on the desktop.";
/** What a worked-out holiday's details say. */
export const HOLIDAY_NOTE =
  "This desktop works out the holidays from each one\u2019s rule, so they can\u2019t be changed.";

export interface CalendarProps extends Omit<WindowProps, "children"> {
  /**
   * The events the window opens with. New events are kept in the window; a later change of
   * the prop is not followed.
   * @default defaultEvents
   */
  events?: readonly CalendarEntry[];
  /**
   * The current time: today in the views, the current-time line and the start of new events.
   * Without it the window shows the moment of the reference capture, 3 October 2019, 3:38 PM,
   * and runs no clock; on a desktop served by the Ferrite application it follows the real
   * clock.
   */
  now?: Date;
  /** The view shown (controlled). */
  view?: CalendarView;
  /**
   * The view shown at first (uncontrolled).
   * @default "week"
   */
  defaultView?: CalendarView;
  /** Called with the view chosen in the toolbar. */
  onViewChange?: (view: CalendarView) => void;
  /**
   * The date the views open on.
   * @default now
   */
  defaultDate?: Date;
  /** The `id` of the event selected at first. */
  defaultSelectedEvent?: string;
  /**
   * Opens the popover of the event selected at first, as in the reference capture.
   * @default false
   */
  defaultPopoverOpen?: boolean;
  /**
   * Props for the event popover: its `container`, `side` or `collisionAvoidance`, for a host
   * that confines it.
   */
  popoverProps?: Partial<PopoverPopupProps>;
  /**
   * The `id` of the calendar selected in the sidebar at first; new events go to it.
   * @default "work"
   */
  defaultCalendar?: string;
  /**
   * What Calendar's preferences set: the days of a week, its first day, the hours shown and
   * the Birthdays and Holidays calendars. On a desktop served by the Ferrite application the
   * person's stored preferences (`/api/calendar/settings`, saved by the Preferences window) take
   * their place once they have saved any.
   * @default defaultSettings
   */
  settings?: CalendarSettings;
  /** Called on Command-comma, Calendar's Preferences command: a host opens the preferences. */
  onOpenPreferences?: () => void;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

const UNITS: Record<CalendarView, string> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

/** The chevrons beside Today are 5 by 9 pt of ink: the library's 7 by 12.5 pt at this scale. */
const CHEVRON_SCALE = 0.72;
/** View's four views, with their names in the menu and their keys. */
const VIEW_KEYS: readonly (readonly [CalendarView, string, string])[] = [
  ["day", "By Day", "command+1"],
  ["week", "By Week", "command+2"],
  ["month", "By Month", "command+3"],
  ["year", "By Year", "command+4"],
];
/** How often a window served by the Ferrite application reads the clock. */
const CLOCK_TICK = 30_000;
/** The most removed occurrences the server keeps of one event (`MAX_EXDATES` in the module). */
const MAX_EXDATES = 200;
/** Nobody selected beside the selected event. */
const NO_EXTRAS: { base: string | null; ids: readonly string[] } = { base: null, ids: [] };

const monthName = new Intl.DateTimeFormat("en-US", { month: "long" });
const dayName = new Intl.DateTimeFormat("en-US", { dateStyle: "full" });
const timeName = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** How long the plus is held before it offers Quick Event. */
const QUICK_EVENT_HOLD = 350;

interface EventHistory {
  undo: readonly (readonly CalendarEntry[])[];
  redo: readonly (readonly CalendarEntry[])[];
}
const NO_HISTORY: EventHistory = { undo: [], redo: [] };
const MAX_UNDO = 50;

/** What a calendar's row carries while it is dragged onto a group. */
const CALENDAR_DRAG = "application/x-macalicious-calendar";

/** An event as Copy takes it: one occurrence is an event of its own, with no one invited to it. */
function copyOf(entry: CalendarEntry & { color?: string }): CalendarEntry {
  const {
    repeat: _repeat,
    exdates: _exdates,
    series: _series,
    timeZone: _zone,
    alertDismissed: _closed,
    alertSnooze: _snoozed,
    invitees: _invitees,
    color: _color,
    ...fields
  } = entry;
  return fields;
}
const resultDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Whether an event's title, location or notes contain the search's words, whatever their case. */
const matches = (entry: CalendarEntry, words: string) =>
  !words ||
  entry.title.toLowerCase().includes(words) ||
  (entry.location ?? "").toLowerCase().includes(words) ||
  (entry.notes ?? "").toLowerCase().includes(words);

/** Whether the keyboard focus is in a field, where Delete edits text rather than events. */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest("input, textarea, [contenteditable='true']") !== null);

/** The day a written date names: `2019-10-03`, as the views and the mini month write them. */
function dayOfKey(written: string): Date {
  const [year, month, day] = written.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day);
}

/** The real clock, read every half minute while `enabled`. */
function useClock(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
}

/**
 * Why a save of the calendar failed, in words, when the server's reply did not say: it refuses a
 * change it cannot keep (400) and an invitation to someone whose inbox is full (422).
 */
function saveRefusal(reason: string): string {
  if (reason === "HTTP 422") return "Someone it invites has too many invitations to take another.";
  if (reason === "HTTP 400" || reason === "HTTP 403") {
    return "The desktop refused the change: an event may invite too many people, or someone who cannot be invited.";
  }
  if (/^HTTP 5\d\d$/.test(reason)) return `The desktop had a problem (${reason}).`;
  return "The desktop could not be reached.";
}

/**
 * The Calendar window of macOS 10.15: a toolbar with the Day, Week, Month and Year switcher
 * and a search field, the list of calendars over a mini month, and the selected view with the
 * previous, Today and next control. Events are edited in their popover (title, location,
 * dates, all-day, repeat, notes and URL), moved by dragging them in the week and day views (their
 * top or bottom edge changes when they start or end), deleted with the Delete key, and
 * found with the search field, which lists every match. The list of calendars has a contextual
 * menu: New Calendar, Rename, Color and Delete.
 *
 * Out of the box the events are invented and kept in the window. On a desktop served by the
 * `macalicious-desktop` Ferrite application they are the signed-in person's, saved there with
 * their calendars.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function Calendar({
  events: initialEvents = defaultEvents,
  now: nowProp,
  view: viewProp,
  defaultView = "week",
  onViewChange,
  defaultDate,
  defaultSelectedEvent,
  defaultPopoverOpen = false,
  popoverProps,
  defaultCalendar = "work",
  settings: settingsProp = defaultSettings,
  onOpenPreferences,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1102,
  height = 624,
  onKeyDown,
  ...windowProps
}: CalendarProps) {
  const served = servedByDesktopApp();
  // View > Make Text Bigger and Smaller: kept with the person's settings on a served desktop.
  const [ownTextStep, setOwnTextStep] = useState(0);
  const keptTextStep = useDesktopValue(CALENDAR_TEXT_STEP, readTextStep, 0);
  const textStep = served ? keptTextStep : ownTextStep;
  const stepText = (by: number) => {
    const next = Math.min(MOST_TEXT_STEP, Math.max(LEAST_TEXT_STEP, textStep + by));
    setOwnTextStep(next);
    if (served) changeDesktopValue(CALENDAR_TEXT_STEP, next);
  };
  const clock = useClock(served && nowProp === undefined);
  const now = nowProp ?? (served ? clock : CAPTURE_NOW);
  const body = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const created = useRef(0);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [events, setEvents] = useState(initialEvents);
  const [own, setOwn] = useState<readonly OwnCalendar[]>(defaultOwnCalendars);
  const [ownView, setOwnView] = useState(defaultView);
  const view = viewProp ?? ownView;
  const [date, setDate] = useState(() => dayAt(defaultDate ?? now));
  const [miniMonth, setMiniMonth] = useState(date);
  const [selected, setSelected] = useState<string | null>(defaultSelectedEvent ?? null);
  // More events selected beside `selected`; anything that selects another event ends them.
  const [extras, setExtras] = useState(NO_EXTRAS);
  const alsoSelected = extras.base === selected && selected !== null ? extras.ids : NO_EXTRAS.ids;
  useEffect(() => {
    if (extras !== NO_EXTRAS && extras.base !== selected) setExtras(NO_EXTRAS);
  }, [extras, selected]);
  // The element of the event whose popover is open, and the part of it being edited at first.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [firstField, setFirstField] = useState<EventField | null>(null);
  // A new event whose popover opens, with its title being edited, once its block is shown.
  const opening = useRef<string | null>(null);
  const [calendar, setCalendar] = useState<string | null>(defaultCalendar);
  const [listShown, setListShown] = useState(true);
  const [hidden, setHidden] = useState<readonly string[]>([]);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  // The date being chosen in View > Go to Date…, while its sheet is open.
  const [goingToDate, setGoingToDate] = useState<Date | null>(null);
  // Undo and Redo: the events as they were before each of the person's own changes.
  const [history, setHistory] = useState<EventHistory>(NO_HISTORY);
  const eventsNow = useRef(events);
  eventsNow.current = events;
  // The event Copy or Cut took: pasted as an event of its own.
  const [copied, setCopied] = useState<readonly CalendarEntry[]>([]);
  const [inspector, setInspector] = useState(false);
  const [keptZone, setKeptZone] = useState<string | null>(null);
  const [inspectorAt, setInspectorAt] = useState({ x: 0, y: 0 });
  // Quick Event: the plus it opens under, and the line being typed while it is open.
  const [plus, setPlus] = useState<HTMLElement | null>(null);
  const [quickLine, setQuickLine] = useState<string | null>(null);
  const holdingPlus = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldPlus = useRef(false);
  // After a key moved the selection or an event: the selected event's block takes the focus.
  const refocus = useRef(false);
  const [alertsLayer, setAlertsLayer] = useState<HTMLDivElement | null>(null);
  // Where the view's contextual menu was opened: a day and perhaps an hour, or `null` on an event.
  const [gridMenuAt, setGridMenuAt] = useState<{
    day: Date;
    hour: number | null;
    heading?: boolean;
  } | null>(null);
  // The calendar the sidebar's contextual menu was opened on, if any.
  const [menuTarget, setMenuTarget] = useState<string | null>(null);
  // The sheet naming a calendar: a new one (`id` null) or one renamed.
  const [naming, setNaming] = useState<{
    id: string | null;
    name: string;
    group?: boolean;
  } | null>(null);
  // File > New Calendar Group: kept with the person's settings. What a group names and no calendar
  // answers to any more is not shown.
  const keptGroups = useDesktopValue(CALENDAR_GROUPS, readCalendarGroups, NO_CALENDAR_GROUPS);
  const setGroups = (next: readonly CalendarGroup[]) => changeDesktopValue(CALENDAR_GROUPS, next);
  // The group a press of the secondary button in the sidebar was on.
  const [menuGroup, setMenuGroup] = useState<string | null>(null);
  // The mini month's day a press of the secondary button in the sidebar was on.
  const [menuDay, setMenuDay] = useState<Date | null>(null);
  const [removing, setRemoving] = useState<OwnCalendar | null>(null);
  const [deleting, setDeleting] = useState<CalendarEntry | null>(null);
  // An occurrence of a repeating event dragged to new times, while the window asks whether to
  // change it alone or all of them.
  const [pendingMove, setPendingMove] = useState<({ entry: CalendarEntry } & Times) | null>(null);
  const [report, setReport] = useState<{ message: string; detail: string } | null>(null);
  // What is typed in New Calendar Subscription's sheet, while it is open.
  const [subscribing, setSubscribing] = useState<string | null>(null);
  // The person's preferences as the events' read answered them, beside the events.
  const [readSettings, setReadSettings] = useState<CalendarSettings | null>(null);

  // Served by the desktop's Ferrite application: the person's saved events and calendars
  // replace the starting ones, and every change is saved. Until the first load settles the
  // window's content is inert, so no change is made that the load would replace, and hidden, so
  // that its first week is first drawn from the person's stored first day, which the same read
  // answers, not from the starting one.
  const document = useMemo(() => ({ events, own }), [events, own]);
  const loading = useServerState({
    url: CALENDAR_EVENTS_URL,
    enabled: served,
    value: document,
    onLoad: (stored) => {
      // Stored data the window cannot read in full is not taken in part: nothing is saved over it.
      const loaded = documentFromServer(stored);
      if (!loaded) return false;
      // Another window's change: what this one remembers no longer follows from it.
      if (loaded.events) setHistory(NO_HISTORY);
      if (loaded.events) setEvents(loaded.events);
      if (loaded.calendars) setOwn(loaded.calendars);
      // A read answers the preferences too; another window's body does not carry them.
      if (typeof stored === "object" && stored !== null && "settings" in stored) {
        const read = settingsFromServer(stored);
        if (read !== undefined) setReadSettings(read);
      }
    },
    toBody: (value) => documentToServer(value.events, value.own),
  });

  // The person's preferences: as the Preferences window last saved them (read once the events
  // have loaded, and told of every save), else as the events' read answered them, else the
  // host's. The events document stays the page's first read.
  const storedSettings = useStoredSettings(served && !loading);
  const systemFirstDay = useSystemFirstDay();
  const settings =
    (served ? (storedSettings ?? readSettings) : null) ??
    (served ? { ...settingsProp, weekStartsOn: systemFirstDay } : settingsProp);
  const windowZone = settings.timeZoneSupport ? keptZone : null;
  const clockNow = toWindowClock(now, windowZone);

  const [alternate, setAlternate] = useAlternateCalendar();
  const [alternateShown, setAlternateShown] = useAlternateShown(settings.showAlternateCalendar);
  const [weekNumbers] = useWeekNumbers();
  const [yearEvents] = useYearEvents();
  const [separateEvents] = useSeparateEvents();
  const [addressPanel, setAddressPanel] = useState(false);
  const textTools = useCalendarTextTools(() => blockOf(selected));
  const alternateOf = alternateShown ? (day: Date) => alternateDate(day, alternate) : undefined;
  const weekNumberOf = weekNumbers
    ? (day: Date) => weekNumber(day, settings.weekStartsOn)
    : undefined;

  // A save the server did not keep is said, with the server's reason, not passed over.
  useEffect(() => {
    if (!served) return;
    return onSaveFailure((failure) => {
      if (failure.url !== CALENDAR_EVENTS_URL) return;
      // A change another window or browser made first wins: the window shows that version.
      setReport(
        failure.reason === CHANGED_ELSEWHERE
          ? {
              message: "A change to your calendar was not kept.",
              detail:
                "It was changed in another window or browser first, and that version is kept.",
            }
          : {
              message: "Your calendar could not be saved.",
              detail: `${failure.detail ?? saveRefusal(failure.reason)} The next change sends the whole calendar again.`,
            },
      );
    });
  }, [served]);

  // Invitations from other accounts, on the Ferrite desktop, in the Invitations calendar, which
  // is listed only while there are any: those declined only while Show Declined Invitations is
  // on, so that a decline can be taken back. They are never saved in the person's own document.
  // Read once the person's own events have loaded, so the document's read is the page's first.
  const invites = useCalendarInvitations(served && !loading);
  const [showDeclined, setShowDeclined] = useState(false);
  const invited = useMemo(
    () => invites.invitations.filter((each) => showDeclined || each.status !== "declined"),
    [invites.invitations, showDeclined],
  );
  const birthdays = useBirthdays(served && !loading && settings.showBirthdays);
  const subscribed = useSubscriptions(served && !loading, (why) =>
    setReport({ message: "A subscribed calendar could not be read.", detail: why }),
  );
  const contactPeople = useContactPeople(served && !loading);
  const shownYear = date.getFullYear();
  const holidays = useMemo(
    () =>
      served && settings.showHolidays
        ? holidaysBeside(events, [shownYear - 1, shownYear, shownYear + 1])
        : [],
    [served, settings.showHolidays, events, shownYear],
  );
  const allEvents = useMemo(
    () =>
      invited.length || birthdays.length || subscribed.entries.length || holidays.length
        ? [
            ...events,
            ...invited.map((each) => each.event),
            ...birthdays,
            ...subscribed.entries,
            ...holidays,
          ]
        : events,
    [events, invited, birthdays, subscribed.entries, holidays],
  );

  // Alerts show under the menu bar while the window is open: on the clock it follows, or at the
  // moment it is given. None while the saved events load. Closing or snoozing one is saved with its
  // event; a birthday's, or an accepted invitation's (with the default alerts of Preferences), which
  // have no event of the document, with the person's settings.
  const birthdayAlerts = useDesktopValue(BIRTHDAY_ALERTS, readBirthdayAlerts, NO_BIRTHDAY_ALERTS);
  // Read once the person's own events have loaded, so the document's read is the page's first.
  const alertAnswers = useAlertAnswers(served && !loading);
  const { defaultBirthdayAlert, defaultAlert, defaultAllDayAlert } = settings;
  const alerting = useMemo(
    () =>
      alertingEntries(
        events,
        birthdays,
        invites.invitations,
        { defaultBirthdayAlert, defaultAlert, defaultAllDayAlert },
        mergedAlertStates(birthdayAlerts, alertAnswers),
      ),
    [
      events,
      birthdays,
      birthdayAlerts,
      alertAnswers,
      defaultBirthdayAlert,
      defaultAlert,
      defaultAllDayAlert,
      invites.invitations,
    ],
  );
  const dueEventAlerts = useEventAlerts(
    loading ? [] : alerting,
    served && nowProp === undefined ? undefined : now.getTime(),
  );
  // What the window shows it keeps out of Notification Center, once per occurrence.
  const toldShown = useRef(new Set<string>());
  const shownKeys = dueEventAlerts.map((alert) => `${alert.key}@${alert.at}`).join(" ");
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again when the alerts shown change.
  useEffect(() => {
    if (!served) return;
    const fresh = dueEventAlerts.filter(
      (alert) => !toldShown.current.has(`${alert.key}@${alert.at}`),
    );
    const alerts = alertsToTell(fresh, alerting);
    for (const alert of fresh) toldShown.current.add(`${alert.key}@${alert.at}`);
    if (alerts.length > 0) void tellAlertsShown(alerts);
  }, [served, shownKeys]);
  const closeAlert = (alert: DueAlert) => {
    const closedAt = (earlier: number | undefined) =>
      Math.max(earlier ?? Number.NEGATIVE_INFINITY, alert.start.getTime());
    // Closing one occurrence leaves another's snooze.
    const stillSnoozed = (snooze: { start: number; until: number } | undefined) =>
      snooze && snooze.start !== alert.start.getTime() ? { snooze } : {};
    if (alert.calendar === BIRTHDAYS || alert.calendar === INVITATIONS) {
      changeDesktopValue(BIRTHDAY_ALERTS, {
        ...birthdayAlerts,
        [alert.id]: {
          dismissed: closedAt(birthdayAlerts[alert.id]?.dismissed),
          ...stillSnoozed(birthdayAlerts[alert.id]?.snooze),
        },
      });
      return;
    }
    setEvents((list) =>
      list.map((entry) => {
        if (entry.id !== alert.id) return entry;
        const { alertSnooze, ...rest } = entry;
        const kept = stillSnoozed(alertSnooze).snooze;
        return {
          ...rest,
          alertDismissed: closedAt(entry.alertDismissed),
          ...(kept ? { alertSnooze: kept } : {}),
        };
      }),
    );
  };
  const snoozeAlert = (alert: DueAlert, minutes: number) => {
    const from = served && nowProp === undefined ? Date.now() : now.getTime();
    const snooze = { start: alert.start.getTime(), until: from + minutes * 60_000 };
    if (alert.calendar === BIRTHDAYS || alert.calendar === INVITATIONS) {
      changeDesktopValue(BIRTHDAY_ALERTS, {
        ...birthdayAlerts,
        [alert.id]: { ...birthdayAlerts[alert.id], snooze },
      });
      return;
    }
    setEvents((list) =>
      list.map((entry) => (entry.id === alert.id ? { ...entry, alertSnooze: snooze } : entry)),
    );
  };
  // After a change of who an event invites is saved, read the answers again.
  const inviteKey = JSON.stringify(
    events.filter((entry) => entry.invitees?.length).map((entry) => [entry.id, entry.invitees]),
  );
  const { refresh: refreshInvitations } = invites;
  // What the window shows, kept for the account: taken up once it is known, then written on every
  // change. A window whose view its owner holds leaves the view to the owner.
  const [windowStateFor, setWindowStateFor] = useState<string | null>(null);
  const account = served ? (invites.me ?? null) : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: taken up once, when the account is known.
  useEffect(() => {
    if (!account || windowStateFor === account) return;
    const previous = windowStateFor;
    setWindowStateFor(account);
    // Another account's window shows what this account last did, or starts as new.
    const kept = readWindowState(account);
    if (!kept && previous === null) return;
    const nextView = kept?.view ?? defaultView;
    if (viewProp === undefined) {
      setOwnView(nextView);
      onViewChange?.(nextView);
    }
    const shownDay = dayAt(kept ? new Date(kept.date) : (defaultDate ?? now));
    setDate(shownDay);
    setMiniMonth(shownDay);
    setHidden(kept?.hidden ?? []);
    setListShown(kept?.listShown ?? true);
    setInspector(kept?.inspector === true);
    setKeptZone(kept?.zone ?? null);
  }, [account]);
  useEffect(() => {
    if (account && windowStateFor === account) {
      writeWindowState(account, {
        view,
        date: date.getTime(),
        hidden,
        listShown,
        ...(inspector ? { inspector } : {}),
        ...(keptZone ? { zone: keptZone } : {}),
      });
    }
  }, [account, windowStateFor, view, date, hidden, listShown, inspector, keptZone]);
  // The invitations as the document had them when they were last read: the first read, as the
  // window opens, is the invitations hook's own.
  const readFor = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: inviteKey is what changes.
  useEffect(() => {
    if (!served || loading) return;
    if (readFor.current === null || readFor.current === inviteKey) {
      readFor.current = inviteKey;
      return;
    }
    readFor.current = inviteKey;
    // Once the save of that change is stored, which reconciles the invitations.
    let current = true;
    void serverDocument(CALENDAR_EVENTS_URL)
      .idle()
      .then(() => {
        if (current) refreshInvitations();
      });
    return () => {
      current = false;
    };
  }, [inviteKey, loading]);

  // The Holidays and Birthdays calendars exist only while the preferences show them.
  const available = (id: string) =>
    (id !== HOLIDAYS || settings.showHolidays) && (id !== BIRTHDAYS || settings.showBirthdays);
  const listed: CalendarInfo[] = [
    ...own.map(
      (item): CalendarInfo => ({
        id: item.id,
        name: item.name,
        group: "iCloud",
        color: colorValue(item.color),
        colorName: item.color,
      }),
    ),
    ...builtInCalendars.filter((item) => item.group === "Other" && available(item.id)),
    ...(invites.invitations.length
      ? [
          {
            id: INVITATIONS,
            name: "Invitations",
            group: "Other",
            color: colorValue("orange"),
            colorName: "orange",
          } satisfies CalendarInfo,
        ]
      : []),
    ...subscribed.subscriptions.map(
      (item): CalendarInfo => ({
        id: item.id,
        name: item.name,
        group: "Other",
        color: colorValue(item.color),
        colorName: item.color,
        subscribed: true,
      }),
    ),
  ];
  const colorOf = (id: string) => listed.find((item) => item.id === id)?.color;
  const ownIds = own.map((item) => item.id);
  const shownGroups = keptGroups.map((group) => ({
    ...group,
    calendars: group.calendars.filter((id) => ownIds.includes(id)),
  }));

  // The days the view shows, for expanding repeating events.
  const range = useMemo((): [Date, Date] => {
    if (view === "day") return [date, dayAt(date, 1)];
    if (view === "week") {
      const first = weekStart(date, settings);
      return [first, dayAt(first, 7)];
    }
    if (view === "month") {
      const days = monthGridDays(date, settings.weekStartsOn);
      return [days[0] as Date, dayAt(days[days.length - 1] as Date, 1)];
    }
    return [new Date(date.getFullYear(), 0, 1), new Date(date.getFullYear() + 1, 0, 1)];
  }, [view, date, settings]);

  const words = query.trim().toLowerCase();
  const visible = (entry: CalendarEntry) =>
    !hidden.includes(entry.calendar) && listed.some((item) => item.id === entry.calendar);

  // The occurrences of the events of the calendars that are listed and checked, in the days
  // shown, that the search matches.
  // biome-ignore lint/correctness/useExhaustiveDependencies: visible and colorOf read listed and hidden.
  const shown = useMemo(
    () =>
      allEvents
        .filter((entry) => visible(entry) && matches(entry, words))
        // Another zone's day can start or end up to a day from this browser's.
        .flatMap((entry) =>
          windowZone
            ? occurrences(entry, dayAt(range[0], -1), dayAt(range[1], 1))
            : occurrences(entry, range[0], range[1]),
        )
        .map((entry): CalendarWeekGridEvent & CalendarEntry => ({
          ...entry,
          color: colorOf(entry.calendar),
        })),
    [
      allEvents,
      hidden,
      words,
      range,
      own,
      settings.showHolidays,
      settings.showBirthdays,
      windowZone,
    ],
  );
  const shownOnClock = useMemo(
    () => shown.map((entry) => onWindowClock(entry, windowZone)),
    [shown, windowZone],
  );

  // Every event the search matches, at its next occurrence: the results list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: visible reads listed and hidden.
  const results = useMemo(() => {
    if (!words) return [];
    return allEvents
      .filter((entry) => visible(entry) && matches(entry, words))
      .map((entry) => ({ entry, at: nextOccurrence(entry, now.getTime()) }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [allEvents, words, hidden, own, now, settings.showHolidays, settings.showBirthdays]);

  // The popover of the event selected at first, once its block is in the document.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the window opens.
  useLayoutEffect(() => {
    if (!defaultPopoverOpen || !defaultSelectedEvent) return;
    for (const block of body.current?.querySelectorAll<HTMLElement>("[data-event-id]") ?? [])
      if (block.dataset.eventId === defaultSelectedEvent) setAnchor(block);
  }, []);

  // The block of the selected event, or null.
  const blockOf = (id: string | null) => {
    if (!id) return null;
    for (const block of body.current?.querySelectorAll<HTMLElement>("[data-event-id]") ?? [])
      if (block.dataset.eventId === id) return block;
    return null;
  };

  // A new event's popover opens with its title being edited; an open popover follows its event
  // to its new block (an edit moved it), and closes when the event leaves the view: it was moved
  // to a calendar that is not shown, its calendar was turned off, or the view was changed.
  useLayoutEffect(() => {
    if (opening.current) {
      const block = blockOf(opening.current);
      opening.current = null;
      if (block) {
        setFirstField("title");
        setAnchor(block);
      }
      return;
    }
    if (anchor && !anchor.isConnected) setAnchor(blockOf(selected));
    if (refocus.current && pendingMove === null) {
      refocus.current = false;
      blockOf(selected)?.focus();
    }
  });

  const goTo = (next: Date, nextView = view) => {
    setAnchor(null);
    setDate(dayAt(next));
    setMiniMonth(next);
    if (nextView !== view) {
      setOwnView(nextView);
      onViewChange?.(nextView);
    }
  };

  /** The calendar new events and imports go to: the one selected while it is one's own. */
  const targetCalendar = (preferred?: string | null) => {
    if (preferred && ownIds.includes(preferred)) return preferred;
    const wanted =
      settings.defaultCalendar === "selected" ? (calendar ?? "home") : settings.defaultCalendar;
    if (ownIds.includes(wanted) || listed.some((item) => item.id === wanted)) return wanted;
    return ownIds[0] ?? "home";
  };

  const remember = () =>
    setHistory(({ undo }) => ({
      undo: [...undo.slice(1 - MAX_UNDO), eventsNow.current],
      redo: [],
    }));
  const restored = (list: readonly CalendarEntry[]) =>
    list.map((entry) =>
      restoredAlerts(
        entry,
        events.find((each) => each.id === entry.id),
      ),
    );
  const undoLast = () => {
    const last = history.undo.at(-1);
    if (!last) return;
    setHistory({ undo: history.undo.slice(0, -1), redo: [...history.redo, events] });
    setEvents(restored(last));
    setSelected(null);
    setAnchor(null);
  };
  const redoLast = () => {
    const next = history.redo.at(-1);
    if (!next) return;
    setHistory({ undo: [...history.undo, events], redo: history.redo.slice(0, -1) });
    setEvents(restored(next));
    setSelected(null);
    setAnchor(null);
  };

  // Spotlight asks to see an event it found: the day it is on, with it selected, once it is read.
  const [askedEvent, setAskedEvent] = useState<string | null>(null);
  useOpenItemRequests("calendar", ({ id }) => setAskedEvent(eventOfOpenItem(id)));
  // An invitation is read after the person's own events, so a request for one waits for it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the request or the events arriving ask this again
  useEffect(() => {
    if (!askedEvent || loading) return;
    const found = [...events, ...invited.map((each) => each.event)].find(
      (entry) => entry.id === askedEvent,
    );
    if (!found && askedEvent.startsWith("invitation-")) return;
    setAskedEvent(null);
    if (!found) return;
    setHidden((list) => list.filter((item) => item !== found.calendar));
    goTo(toWindowClock(found.start, found.allDay || found.floating ? null : windowZone));
    setSelected(found.id);
  }, [askedEvent, loading, events, invited]);

  const newEventId = () => {
    let id: string;
    do id = `new-${++created.current}`;
    while (events.some((entry) => entry.id === id));
    return id;
  };
  const noRoom = (count = 1) => {
    if (events.length + count <= MAX_EVENTS) return false;
    setReport({
      message: "There is no room for another event.",
      detail: `Calendar keeps at most ${MAX_EVENTS} events. Delete some to make room.`,
    });
    return true;
  };

  /**
   * A new event, with its popover opening where the application serves it; `fields`, from a line
   * typed for Quick Event, say all there is to say, so that one opens no popover. It starts with the
   * default alert of Preferences > Alerts.
   */
  const createEvent = (
    start: Date,
    end: Date,
    allDay?: boolean,
    fields?: Partial<CalendarEntry>,
  ) => {
    if (noRoom()) return;
    const id = newEventId();
    const target = targetCalendar();
    const alert = allDay ? settings.defaultAllDayAlert : settings.defaultAlert;
    remember();
    setEvents([
      ...events,
      {
        id,
        title: "New Event",
        start: allDay ? start : fromWindowClock(start, windowZone),
        end: allDay ? end : fromWindowClock(end, windowZone),
        calendar: target,
        ...(allDay ? { allDay } : {}),
        ...(alert === undefined ? {} : { alert }),
        ...fields,
      },
    ]);
    setHidden(hidden.filter((item) => item !== target));
    setQuery("");
    setSelected(id);
    setAnchor(null);
    if (served && !fields) opening.current = id;
  };

  const openQuickEvent = () => setQuickLine("");
  const makeQuickEvent = () => {
    const made = parseQuickEvent(quickLine ?? "", now);
    setQuickLine(null);
    if (!made) return;
    if (!quickEventFits(made)) {
      setReport({
        message: "That event can\u2019t be made.",
        detail: "Its date or how long it lasts is further than Calendar can keep.",
      });
      return;
    }
    const { start, end, allDay, title, location } = made;
    goTo(start);
    createEvent(start, end, allDay, { title, ...(location ? { location } : {}) });
    refocus.current = true;
  };

  const addEvent = () => {
    // An hour from the next full hour of the day shown, or of now when it is today; after
    // 11 PM that is the day after.
    const hour = sameDay(date, clockNow) ? clockNow.getHours() + 1 : settings.dayStartsAt + 1;
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
    createEvent(start, new Date(start.getTime() + 36e5));
  };

  /** Apply a change made in the popover of `shownEntry` to its event. */
  const change = (shownEntry: CalendarEntry, fields: Partial<CalendarEntry>) => {
    const id = shownEntry.series ?? shownEntry.id;
    // A change of an occurrence's dates moves the whole series so that this occurrence falls
    // where it was put (`movedSeries`); a move that cannot keep it there is refused.
    const moving = Boolean(shownEntry.series && (fields.start || fields.end));
    const series = events.find((entry) => entry.id === id);
    const start = fields.start ?? shownEntry.start;
    const end = fields.end ?? shownEntry.end;
    if (
      moving &&
      series &&
      !movedSeries(series, { ...series, ...fields }, shownEntry.start, start, end)
    ) {
      setReport({
        message: "This occurrence can\u2019t move to that day.",
        detail:
          "No first date of this repeating event puts this occurrence there: its count, its end, a removed occurrence, or a day or time the calendar lacks prevents it. Change the first occurrence\u2019s date instead.",
      });
      return;
    }
    remember();
    setEvents((list) =>
      list.map((entry) => {
        if (entry.id !== id) return entry;
        let next: CalendarEntry = { ...entry, ...fields };
        // Its other occurrences keep their time of day; an all-day series (as the change
        // leaves it) keeps its number of days.
        if (moving) {
          const moved = movedSeries(entry, next, shownEntry.start, start, end);
          if (!moved) return entry;
          next = moved;
        }
        // A snooze belongs to the occurrence as it was: one that starts elsewhere has none, and a
        // change of repeat may have taken it.
        if (fields.start && fields.start.getTime() !== entry.start.getTime()) {
          delete next.alertSnooze;
        } else if ("repeat" in fields || "exdates" in fields) next = withoutRemovedSnooze(next);
        for (const key of Object.keys(next) as (keyof CalendarEntry)[])
          if (next[key] === undefined) delete next[key];
        return next;
      }),
    );
    if (fields.calendar) setHidden((list) => list.filter((item) => item !== fields.calendar));
    if (shownEntry.series && fields.start) setSelected(occurrenceId(id, fields.start));
    // An occurrence's id is its start: once the series stops repeating, the event's own id.
    if (shownEntry.series && "repeat" in fields && !fields.repeat) setSelected(id);
    if (!shownEntry.series && fields.repeat)
      setSelected(occurrenceId(id, fields.start ?? shownEntry.start));
  };

  /** Delete an event, or ask first about one occurrence of a repeating one. */
  const remove = (shownEntry: CalendarEntry) => {
    if (shownEntry.series) {
      setDeleting(shownEntry);
      return;
    }
    setAnchor(null);
    setSelected(null);
    remember();
    setEvents((list) => list.filter((entry) => entry.id !== shownEntry.id));
  };

  /** Delete several at once, as one change: of a repeating event, only the occurrence selected. */
  const removeSeveral = (entries: readonly CalendarEntry[]) => {
    if (entries.length === 0) return;
    const whole = new Set(entries.filter((entry) => !entry.series).map((entry) => entry.id));
    const removed = new Map<string, number[]>();
    for (const { series, start } of entries) {
      if (series) removed.set(series, [...(removed.get(series) ?? []), start.getTime()]);
    }
    const tooMany = events.some(
      (entry) => (entry.exdates?.length ?? 0) + (removed.get(entry.id)?.length ?? 0) > MAX_EXDATES,
    );
    if (tooMany) {
      setReport({
        message: "These events can\u2019t be deleted together.",
        detail: `A repeating event keeps at most ${MAX_EXDATES} removed occurrences. End its repeat earlier or delete the whole series.`,
      });
      return;
    }
    setAnchor(null);
    setSelected(null);
    remember();
    setEvents((list) =>
      list.flatMap((entry) => {
        if (whole.has(entry.id)) return [];
        const starts = removed.get(entry.id);
        if (!starts || !entry.repeat) return [entry];
        return [withoutRemovedSnooze({ ...entry, exdates: [...(entry.exdates ?? []), ...starts] })];
      }),
    );
  };

  const removeOccurrences = (occurrence: CalendarEntry, future: boolean) => {
    const id = occurrence.series ?? occurrence.id;
    const series = events.find((entry) => entry.id === id);
    if (!future && (series?.exdates?.length ?? 0) >= MAX_EXDATES) {
      setReport({
        message: "This event can’t lose more occurrences.",
        detail: `A repeating event keeps at most ${MAX_EXDATES} removed occurrences. End the repeat earlier or delete the whole series.`,
      });
      return;
    }
    setAnchor(null);
    setSelected(null);
    remember();
    setEvents((list) =>
      list.flatMap((entry) => {
        if (entry.id !== id || !entry.repeat) return [entry];
        if (!future)
          return [
            withoutRemovedSnooze({
              ...entry,
              exdates: [...(entry.exdates ?? []), occurrence.start.getTime()],
            }),
          ];
        if (occurrence.start.getTime() <= entry.start.getTime()) return [];
        const { count: _count, ...rule } = entry.repeat;
        return [
          withoutRemovedSnooze({
            ...entry,
            repeat: { ...rule, until: occurrence.start.getTime() - 1 },
          }),
        ];
      }),
    );
  };

  /**
   * One occurrence of a repeating event moved to `start` and `end` alone: the series no longer
   * has it (a removed occurrence), and it becomes an event of its own there, with the series'
   * title, calendar, location, notes, URL, invitees and alert.
   */
  const moveOccurrence = ({ entry, start, end }: { entry: CalendarEntry } & Times) => {
    const id = entry.series ?? entry.id;
    const series = events.find((each) => each.id === id);
    if (!series) return;
    if ((series.exdates?.length ?? 0) >= MAX_EXDATES) {
      setReport({
        message: "This occurrence can\u2019t move on its own.",
        detail: `A repeating event keeps at most ${MAX_EXDATES} removed occurrences. Move all of its occurrences, or end the repeat earlier.`,
      });
      return;
    }
    if (events.length >= MAX_EVENTS) {
      setReport({
        message: "There is no room for another event.",
        detail: `Calendar keeps at most ${MAX_EVENTS} events, and this occurrence would become one. Delete some to make room.`,
      });
      return;
    }
    const copyId = newEventId();
    const {
      repeat: _repeat,
      exdates: _exdates,
      series: _series,
      timeZone: _zone,
      alertDismissed: _closed,
      alertSnooze: _snoozed,
      ...fields
    } = series;
    remember();
    setEvents((list) => [
      ...list.map((each) =>
        each.id === id
          ? withoutRemovedSnooze({
              ...each,
              exdates: [...(each.exdates ?? []), entry.start.getTime()],
            })
          : each,
      ),
      { ...fields, id: copyId, start, end },
    ]);
    setSelected(copyId);
  };

  /**
   * Several events moved together by `days` and `minutes`, as one change: of a repeating event, the
   * occurrence selected alone, which becomes an event of its own, as Delete takes only it.
   */
  const moveSeveral = (entries: readonly CalendarEntry[], days: number, minutes: number) => {
    const moving = entries.filter(canDragEntry);
    if (moving.length === 0) return;
    const repeated = moving.filter((entry) => entry.series);
    if (noRoom(repeated.length)) return;
    const removed = new Map<string, number[]>();
    for (const { series, start } of repeated) {
      if (series) removed.set(series, [...(removed.get(series) ?? []), start.getTime()]);
    }
    if (
      events.some(
        (entry) =>
          (entry.exdates?.length ?? 0) + (removed.get(entry.id)?.length ?? 0) > MAX_EXDATES,
      )
    ) {
      setReport({
        message: "These events can\u2019t move together.",
        detail: `A repeating event keeps at most ${MAX_EXDATES} removed occurrences. End its repeat earlier, or move all of its occurrences.`,
      });
      return;
    }
    const times = new Map(
      moving.map((entry) => [entry.id, draggedTimes(entry, "move", days, minutes)] as const),
    );
    const copies = repeated.flatMap((entry): CalendarEntry[] => {
      const series = events.find((each) => each.id === entry.series);
      const placed = times.get(entry.id);
      if (!series || !placed) return [];
      const {
        repeat: _repeat,
        exdates: _exdates,
        series: _series,
        timeZone: _zone,
        alertDismissed: _closed,
        alertSnooze: _snoozed,
        ...fields
      } = series;
      return [{ ...fields, id: newEventId(), ...placed }];
    });
    remember();
    setEvents((list) => [
      ...list.map((entry) => {
        const placed = times.get(entry.id);
        if (placed) {
          const { alertSnooze: _snoozed, ...rest } = entry;
          return { ...rest, ...placed };
        }
        const starts = removed.get(entry.id);
        return starts
          ? withoutRemovedSnooze({ ...entry, exdates: [...(entry.exdates ?? []), ...starts] })
          : entry;
      }),
      ...copies,
    ]);
    selectIds([
      ...moving.filter((entry) => !entry.series).map(({ id }) => id),
      ...copies.map(({ id }) => id),
    ]);
  };

  /** A new id for one of the person's calendars. */
  const newCalendarId = () => {
    let id: string;
    do id = `cal-${Date.now().toString(36)}-${++created.current}`;
    while (own.some((item) => item.id === id));
    return id;
  };

  const saveCalendarName = () => {
    if (!naming) return;
    const name = naming.name.trim() || "Untitled";
    if (naming.group) {
      setGroups(
        naming.id
          ? keptGroups.map((group) => (group.id === naming.id ? { ...group, name } : group))
          : [...keptGroups, { id: `g${Date.now().toString(36)}`, name, calendars: [] }],
      );
      setNaming(null);
      return;
    }
    if (subscribed.has(naming.id)) {
      if (naming.id) subscribed.rename(naming.id, name);
      setNaming(null);
      return;
    }
    if (naming.id) setOwn(own.map((item) => (item.id === naming.id ? { ...item, name } : item)));
    else {
      const id = newCalendarId();
      const used = new Set(own.map((item) => item.color));
      const color = CALENDAR_COLORS.find((item) => !used.has(item.id))?.id ?? "blue";
      setOwn([...own, { id, name, color }]);
      setCalendar(id);
    }
    setNaming(null);
  };

  const recolor = (id: string, color: CalendarColor) =>
    setOwn(own.map((item) => (item.id === id ? { ...item, color } : item)));

  const subscribe = () => {
    const typed = subscribing ?? "";
    setSubscribing(null);
    void subscribed.add(typed).then((why) => {
      if (why) setReport({ message: "The calendar was not subscribed to.", detail: why });
    });
  };

  const removeCalendar = (target: OwnCalendar) => {
    setOwn(own.filter((item) => item.id !== target.id));
    setEvents(events.filter((entry) => entry.calendar !== target.id));
    setHistory(NO_HISTORY);
    if (calendar === target.id) setCalendar(own.find((item) => item.id !== target.id)?.id ?? null);
    setAnchor(null);
  };

  const opened = anchor ? shown.find((entry) => entry.id === selected) : undefined;
  const hourHeight = 472 / settings.hoursShown;

  // Dragging an event of the person's own calendars in the week or day grid moves it, and its
  // top or bottom edge changes when it starts or ends (`calendar-drag.ts`); the change is saved as
  // any other. A repeating event asks first: this occurrence alone, or all of them.
  const dropMoved = (entry: CalendarEntry, times: Times) => {
    setAnchor(null);
    if (several && selectedEntries.some(({ id }) => id === entry.id) && movesWhole(entry, times)) {
      const { days, minutes } = dragShift(entry, times);
      moveSeveral(selectedEntries, days, minutes);
      return;
    }
    if (entry.series) {
      setPendingMove({ entry, ...times });
      return;
    }
    change(entry, times);
    setSelected(entry.id);
  };
  const canDragEntry = (entry: CalendarEntry) => !loading && ownIds.includes(entry.calendar);
  // Onto another of the person's calendars; of a repeating event, every occurrence goes with it.
  const dropOnCalendar = (entry: CalendarEntry, calendar: string) => {
    if (!ownIds.includes(calendar)) return;
    if (several && selectedEntries.some(({ id }) => id === entry.id)) {
      const ids = new Set(
        selectedEntries.filter(canDragEntry).map((each) => each.series ?? each.id),
      );
      remember();
      setEvents((list) => list.map((each) => (ids.has(each.id) ? { ...each, calendar } : each)));
      setHidden((list) => list.filter((item) => item !== calendar));
      return;
    }
    if (calendar !== entry.calendar) change(entry, { calendar });
  };
  // An event let go outside the window is a file to what stands there: Finder, the desktop, Mail.
  const dropOutside = (entry: CalendarEntry, at: { clientX: number; clientY: number }) => {
    const hit = window.document.elementFromPoint(at.clientX, at.clientY);
    if (!hit || body.current?.closest("[data-window-state]")?.contains(hit)) return false;
    const landing = landingAt(hit, {
      from: "calendar",
      items: [files.eventFile(entry)],
      copy: true,
      at: { x: at.clientX, y: at.clientY },
    });
    if (!landing || landing.refusal) return false;
    landing.drop();
    return true;
  };
  const gridDrag = useGridDrag({
    hourHeight,
    entryOf: (id) => shown.find((entry) => entry.id === id),
    canDrag: canDragEntry,
    onDrop: dropMoved,
    onDropOnCalendar: dropOnCalendar,
    onDropOutside: dropOutside,
  });
  const gridCreate = useGridCreate({
    hourHeight,
    enabled: !loading,
    dayOf: (index) => dayAt(range[0], index),
    onCreate: ({ start, end }) => createEvent(start, end),
  });
  const monthDrag = useMonthDrag({
    entryOf: (id) => shown.find((entry) => entry.id === id),
    canDrag: canDragEntry,
    onDrop: dropMoved,
    onDropOnCalendar: dropOnCalendar,
    onDropOutside: dropOutside,
  });
  // The event being dragged, or waiting on that question, is drawn where it was put, and those
  // selected with it go with it.
  const newCalendar = gridCreate.creating ? targetCalendar() : null;
  const newColor = newCalendar ? colorOf(newCalendar) : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: canDragEntry reads what shown and loading follow.
  const drawn = useMemo(() => {
    const moving =
      gridDrag.drag ??
      monthDrag.drag ??
      (pendingMove
        ? { id: pendingMove.entry.id, start: pendingMove.start, end: pendingMove.end }
        : null);
    const dragged = moving ? shown.find((entry) => entry.id === moving.id) : undefined;
    const shift =
      moving &&
      dragged &&
      alsoSelected.length > 0 &&
      (moving.id === selected || alsoSelected.includes(moving.id)) &&
      movesWhole(dragged, moving)
        ? dragShift(dragged, moving)
        : null;
    const placed = (
      moving
        ? shown.map((entry) => {
            if (entry.id === moving.id) return { ...entry, start: moving.start, end: moving.end };
            if (!shift || !canDragEntry(entry)) return entry;
            if (entry.id !== selected && !alsoSelected.includes(entry.id)) return entry;
            return { ...entry, ...draggedTimes(entry, "move", shift.days, shift.minutes) };
          })
        : shown
    ).map((entry) => onWindowClock(entry, windowZone));
    if (!gridCreate.creating || !newCalendar) return placed;
    return [
      ...placed,
      {
        id: "new-event-being-dragged",
        title: "New Event",
        calendar: newCalendar,
        color: newColor,
        ...gridCreate.creating,
      },
    ];
  }, [
    shown,
    gridDrag.drag,
    monthDrag.drag,
    pendingMove,
    gridCreate.creating,
    newCalendar,
    newColor,
    selected,
    alsoSelected,
    windowZone,
  ]);

  // The library's blocks say nothing of how an event counts: a free one is marked for calendar.css,
  // and the block of a travel time is a drawing that takes no pointer or focus.
  useLayoutEffect(() => {
    const free = new Set(drawn.filter((entry) => entry.showAs === "free").map(({ id }) => id));
    for (const block of body.current?.querySelectorAll<HTMLElement>("[data-event-id]") ?? []) {
      const id = block.dataset.eventId ?? "";
      if (id.startsWith(TRAVEL_BLOCK)) {
        block.tabIndex = -1;
        block.setAttribute("aria-hidden", "true");
        block.toggleAttribute("data-travel", true);
      } else block.toggleAttribute("data-free", free.has(id));
    }
  });

  // The year view shades each day of the mini months, which draw only their numbers, by how many
  // events it has.
  const yearCounts = useMemo(() => {
    if (view !== "year") return null;
    return yearEvents ? eventsPerDay(shownOnClock) : new Map<string, number>();
  }, [view, shownOnClock, yearEvents]);
  useLayoutEffect(() => {
    if (!yearCounts) return;
    for (const day of body.current?.querySelectorAll<HTMLElement>(
      ".mac-calendar-year-month [data-date]",
    ) ?? []) {
      const count = day.hasAttribute("data-outside")
        ? 0
        : (yearCounts.get(day.dataset.date ?? "") ?? 0);
      if (count > 0) {
        day.dataset.density = String(densityLevel(count));
        day.title = `${count} ${count === 1 ? "event" : "events"}`;
      } else {
        delete day.dataset.density;
        day.removeAttribute("title");
      }
    }
  });
  // The week grid draws its own headings: the alternate calendar's day and the week's number are
  // marked on them for calendar.css.
  useLayoutEffect(() => {
    if (view !== "week" && view !== "day") return;
    const first = view === "week" ? weekStart(date, settings) : date;
    const days = body.current?.querySelectorAll<HTMLElement>(".mac-calendar-week-grid-day") ?? [];
    days.forEach((heading, at) => {
      const shownDay = dayAt(first, at);
      if (alternateShown) heading.dataset.alternate = alternateDate(shownDay, alternate);
      else delete heading.dataset.alternate;
    });
    const title = body.current?.querySelector<HTMLElement>(".mac-calendar-week-grid-title");
    if (title && weekNumbers) {
      title.dataset.weekNumber = `Week ${weekNumber(first, settings.weekStartsOn)}`;
    } else if (title) delete title.dataset.weekNumber;
  }, [view, date, settings, alternateShown, alternate, weekNumbers]);
  const targetOwn = menuTarget ? own.find((item) => item.id === menuTarget) : undefined;
  const targetSubscription = subscribed.subscriptions.find((item) => item.id === menuTarget);
  const targetGroup = shownGroups.find((group) => group.id === menuGroup);
  const selectIds = ([first, ...rest]: readonly string[]) => {
    setAnchor(null);
    setSelected(first ?? null);
    setExtras({ base: first ?? null, ids: rest });
  };
  // The calendar an Export names: the one the list's menu was opened on, else the one selected.
  const listedCalendar = (id: string | null) => listed.find((item) => item.id === id);
  const selectedEntry = shown.find((entry) => entry.id === selected);
  const several = alsoSelected.length > 0;
  const selectedEntries = several
    ? shown.filter((entry) => entry.id === selected || alsoSelected.includes(entry.id))
    : [];
  const toggleSelected = (id: string) => {
    const all = selected === null ? [] : [selected, ...alsoSelected];
    const next = all.includes(id) ? all.filter((each) => each !== id) : [...all, id];
    selectIds(next);
  };
  const selectAllShown = () => selectIds(shown.map((entry) => entry.id));

  // Import and Export of iCalendar files; an import goes to a calendar of the person's own.
  const files = useCalendarFiles({
    events,
    own,
    defaultTarget: () => targetCalendar(),
    nameOf: (id) => listed.find((item) => item.id === id)?.name,
    drive: served,
    anchor: titleBar,
    makeCalendarId: newCalendarId,
    onImport: (result) => {
      setOwn(result.own);
      setEvents(result.events);
      setHistory(NO_HISTORY);
      setCalendar(result.calendar);
      setHidden((list) => list.filter((item) => item !== result.calendar));
      setAnchor(null);
    },
    onReport: setReport,
  });
  // An `.ics` opened from Finder, or dragged onto the window, asks where it goes as an import does.
  const importEntry = useRef(files.importEntry);
  importEntry.current = files.importEntry;
  useEffect(() => {
    if (!served) return;
    for (const request of takeOpenFileRequests("calendar")) importEntry.current(request);
    return onOpenFileRequest("calendar", (request) => importEntry.current(request));
  }, [served]);
  // A date from another application (Messages' Create Event): Quick Event opens holding it, once
  // Calendar has read what it can add to.
  useEffect(() => {
    if (!served || loading) return;
    const take = ({ to }: AddressRequest) => setQuickLine(to);
    for (const request of takeAddressRequests("calendar")) take(request);
    return onAddressRequest("calendar", take);
  }, [served, loading]);
  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item) => item.kind === "file" && isIcsFile(item),
    onDrop: ([item]) => {
      if (item) importEntry.current(item);
    },
    enabled: served,
    sayRefusal: (sentence) => setReport({ message: sentence, detail: "" }),
    refusal: () => "Calendar imports .ics files.",
  });
  useEffect(() => dropRef(body.current), [dropRef]);
  // Files on an event's block in a view go on the event, as in its popover; an `.ics` is an import.
  const attachableAt = (target: Element | null) => {
    const id = target?.closest<HTMLElement>("[data-event-id]")?.dataset.eventId;
    const entry = shown.find((each) => each.id === id);
    return served && entry && ownIds.includes(entry.calendar) ? entry : undefined;
  };
  // A card dragged from Contacts onto an event's block: the accounts are invited to it.
  const inviteCard = async (entry: CalendarEntry, cards: readonly DesktopDragItem[]) => {
    const known: string[] = [];
    const refused: string[] = [];
    for (const card of cards) {
      const account = accountOfCard(card);
      if (accountOfDrag(card)) known.push(account);
      else if (!account) refused.push(card.name);
      else {
        // An address is no promise of an account, as a card's account name is.
        const found = await lookupInvitee(account).catch(() => null);
        if (found) known.push(found.name);
        else refused.push(card.name);
      }
    }
    const already = entry.invitees ?? [];
    const more = known.filter((name) => name !== invites.me && !already.includes(name));
    if (more.length > 0 && invites.canInvite) {
      change(entry, { invitees: [...already, ...more].slice(0, MAX_INVITEES) });
    }
    if (refused.length > 0) {
      setReport({ message: "Not everyone could be invited.", detail: notInvitable(refused) });
    }
  };
  const attachFiles = async (entry: CalendarEntry, list: readonly File[]) => {
    const id = entry.series ?? entry.id;
    for (const file of list) {
      try {
        const sent = await uploadEventFile(file);
        setEvents((all) =>
          all.map((each) =>
            each.id === id ? { ...each, attachments: [...(each.attachments ?? []), sent] } : each,
          ),
        );
      } catch (error) {
        setReport({
          message: `\u201c${file.name}\u201d could not be attached.`,
          detail: error instanceof Error ? error.message : "",
        });
      }
    }
  };
  const attaching = useRef({ attachableAt, attachFiles, inviteCard });
  attaching.current = { attachableAt, attachFiles, inviteCard };
  useEffect(() => {
    const element = body.current?.querySelector(".mac-calendar-main");
    if (!element) return;
    return registerDropTarget({
      element,
      landing: (hit, drag) => {
        const entry = attaching.current.attachableAt(hit);
        const block = hit.closest("[data-event-id]");
        if (!entry || !block) return undefined;
        const cards = drag.items.filter((item) => item.type === ADDRESS_DRAG_TYPE);
        if (cards.length > 0) {
          const inviting = cards.some((card) => accountOfCard(card) !== "");
          return {
            element: block,
            copies: true,
            refusal: inviting ? undefined : notInvitable(cards.map((card) => card.name)),
            drop: () => void attaching.current.inviteCard(entry, cards),
          };
        }
        // A card from Contacts invites its person, above; it is not a file to keep on the event.
        const files =
          drag.from === "contacts"
            ? []
            : drag.items.filter((item) => item.kind === "file" && !isIcsFile(item));
        if (files.length === 0) return undefined;
        return {
          element: block,
          copies: true,
          drop: () => {
            void filesOfDrag(files).then((list) => attaching.current.attachFiles(entry, list));
          },
        };
      },
    });
  }, []);
  const fileItems = (shown: CalendarInfo | undefined) => {
    // Invitations are other people's events, and a subscription's are its site's: they are neither
    // exported nor imported into.
    const exported = shown?.id === INVITATIONS || subscribed.has(shown?.id) ? undefined : shown;
    return (
      <>
        <MenuItem disabled={loading} onClick={() => files.importFile(exported?.id)}>
          Import…
        </MenuItem>
        {served ? (
          <MenuItem disabled={loading} onClick={() => files.importFromDrive(exported?.id)}>
            Import from Drive…
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem
          disabled={loading || !exported}
          onClick={() => exported && files.exportCalendar(exported.id)}
        >
          Export {exported ? `\u201c${exported.name}\u201d` : "Calendar"}…
        </MenuItem>
        {served ? (
          <MenuItem
            disabled={loading || !exported}
            onClick={() => exported && files.saveCalendar(exported.id)}
          >
            Save {exported ? `\u201c${exported.name}\u201d` : "Calendar"} to Drive…
          </MenuItem>
        ) : null}
      </>
    );
  };
  // On the desktop, the File menu of the menu bar: new events and calendars, Import and Export.
  const [printing, setPrinting] = useState(false);
  const printCalendars = listed.map(({ id, name, color }) => ({ id, name, color }));
  const occurrencesOf = (ids: readonly string[], from: Date, until: Date) =>
    allEvents
      .filter((entry) => ids.includes(entry.calendar))
      .flatMap((entry) => occurrences(entry, from, until));
  const printFirst = view === "month" ? new Date(date.getFullYear(), date.getMonth(), 1) : range[0];
  const printUntil =
    view === "month" ? new Date(date.getFullYear(), date.getMonth() + 1, 1) : range[1];
  const printOptions: PrintOptions = {
    view: view === "year" ? "month" : view,
    from: printFirst,
    until: printUntil,
    weekStartsOn: settings.weekStartsOn,
    allDay: true,
    timed: true,
    miniCalendar: false,
    keys: true,
    blackAndWhite: false,
    textSize: "medium",
  };
  const printShown = () =>
    printCalendar(
      occurrencesOf(
        printCalendars.map(({ id }) => id).filter((id) => !hidden.includes(id)),
        printFirst,
        printUntil,
      ).filter((entry) => matches(entry, words)),
      printCalendars.filter(({ id }) => !hidden.includes(id)),
      printOptions,
    );
  const fileMenu = (
    <>
      <MenuItem disabled={loading} keyEquivalent="command+n" onClick={addEvent}>
        New Event
      </MenuItem>
      <MenuItem disabled={loading} keyEquivalent="option+command+n" onClick={openQuickEvent}>
        Quick Event…
      </MenuItem>
      <MenuItem disabled={loading} onClick={() => setNaming({ id: null, name: "Untitled" })}>
        New Calendar
      </MenuItem>
      <MenuItem
        disabled={loading}
        keyEquivalent="shift+command+n"
        onClick={() => setNaming({ id: null, name: "Untitled Group", group: true })}
      >
        New Calendar Group
      </MenuItem>
      <MenuItem
        disabled={loading || !served}
        keyEquivalent="option+command+s"
        onClick={() => setSubscribing("")}
      >
        New Calendar Subscription…
      </MenuItem>
      <MenuSeparator />
      {fileItems(listedCalendar(calendar))}
      <MenuItem
        disabled={loading || !selectedEntry}
        title={loading ? CALENDAR_LOADING : selectedEntry ? undefined : EXPORT_EVENT_UNAVAILABLE}
        onClick={() => selectedEntry && files.exportEvent(selectedEntry)}
      >
        Export Event…
      </MenuItem>
      {served ? (
        <MenuItem
          disabled={loading || !selectedEntry}
          title={loading ? CALENDAR_LOADING : selectedEntry ? undefined : SAVE_EVENT_UNAVAILABLE}
          onClick={() => selectedEntry && files.saveEvent(selectedEntry)}
        >
          Save Event to Drive…
        </MenuItem>
      ) : null}
      <Submenu>
        <SubmenuTrigger disabled={loading}>Export</SubmenuTrigger>
        <SubmenuPopup aria-label="Export">
          <MenuItem onClick={files.exportArchive}>Calendar Archive…</MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem disabled={loading} onClick={printShown}>
        Export as PDF…
      </MenuItem>
      <MenuItem disabled={loading} keyEquivalent="command+p" onClick={() => setPrinting(true)}>
        Print…
      </MenuItem>
    </>
  );
  useDesktopAppMenu("calendar", "File", fileMenu, titleBar);
  useDesktopAppMenu(
    "calendar",
    "Dock",
    <MenuItem disabled={loading} onClick={addEvent}>
      New Event
    </MenuItem>,
    titleBar,
  );
  useDesktopAppMenu(
    "calendar",
    "Calendar",
    <MenuItem
      onClick={() => {
        requestPane("internet-accounts");
        requestDesktopEffects([{ open: "system-preferences" }]);
      }}
    >
      Accounts…
    </MenuItem>,
    titleBar,
  );
  useMainWindowItem(
    "calendar",
    "Calendar",
    titleBar,
    <>
      <MenuItem disabled title={NO_AVAILABILITY} data-reason={NO_AVAILABILITY}>
        Availability Panel
      </MenuItem>
      <MenuItem keyEquivalent="option+command+a" onClick={() => setAddressPanel(!addressPanel)}>
        {addressPanel ? "Hide Address Panel" : "Address Panel"}
      </MenuItem>
    </>,
  );

  // The menu bar's View and Edit menus while this window is in front, with their keys.
  const stepBy = (by: 1 | -1) => goTo(step(date, view, by, settings));
  const weekWheel = useWeekWheel({
    enabled: view === "week" && !words,
    stopOnToday: settings.scrollBy === "week-stop-on-today",
    landsOnToday: (by) =>
      sameDay(weekStart(step(date, "week", by, settings), settings), weekStart(now, settings)),
    step: stepBy,
  });
  const refreshCalendars = () => {
    reloadServerDocuments("calendar");
    void subscribed.refresh().then((why) => {
      if (why) setReport({ message: "A subscribed calendar was not refreshed.", detail: why });
    });
  };
  /** Opens an event: in its popover, or with Open events in separate windows in the Inspector. */
  const openDetails = (element: HTMLElement) => {
    setFirstField(null);
    if (separateEvents) setInspector(true);
    else setAnchor(element);
  };
  const mailable = selectedEntry?.invitees?.length ? selectedEntry : undefined;
  const mailRefusal = !served ? NOT_ON_DESKTOP : mailable ? undefined : NOBODY_TO_MAIL;
  const mapsRefusal = !served
    ? NOT_ON_DESKTOP
    : selectedEntry?.location?.trim()
      ? undefined
      : NO_LOCATION;
  /** One message for each person invited, since Mail's request names one address. */
  const mailEvent = () => {
    for (const to of mailable?.invitees ?? []) {
      askToReach({ app: "mail", to, name: to, subject: mailable?.title });
    }
  };
  const inviteRefusal = !invites.canInvite
    ? "Inviting people needs an account on this desktop."
    : !selectedEntry || several || !ownIds.includes(selectedEntry.calendar)
      ? "Select an event of your own to invite someone."
      : undefined;
  /** Shows `day` when the view does not: a command given on the mini month's day. */
  const reveal = (day: Date) => {
    if (day < range[0] || day >= range[1]) goTo(day);
  };
  const deletable = (entry: CalendarEntry) =>
    entry.calendar !== INVITATIONS &&
    entry.calendar !== BIRTHDAYS &&
    !isWorkedOutHoliday(entry) &&
    !subscribed.has(entry.calendar);
  const canDelete = several
    ? selectedEntries.some(deletable)
    : selectedEntry !== undefined && deletable(selectedEntry);
  const deleteSelected = () => {
    if (several) removeSeveral(selectedEntries.filter(deletable));
    else if (selectedEntry && canDelete) remove(selectedEntry);
  };
  const copySelected = () => {
    const entries = several ? selectedEntries : selectedEntry ? [selectedEntry] : [];
    if (entries.length === 0) return;
    setCopied(entries.filter((entry) => entry.calendar !== BIRTHDAYS).map(copyOf));
    void copyText(entries.map((entry) => entry.title).join("\n"));
  };
  const cutSelected = () => {
    if (!canDelete) return;
    copySelected();
    deleteSelected();
  };
  /** Copies of `copies` `days` later, each at its own time of day, as events of their own. */
  const placeCopies = (copies: readonly CalendarEntry[], days: number) => {
    if (copies.length === 0 || noRoom(copies.length)) return;
    const made = copies.map((copy) => ({
      ...copy,
      ...draggedTimes(copy, "move", days, 0),
      id: newEventId(),
      calendar: ownIds.includes(copy.calendar) ? copy.calendar : targetCalendar(),
    }));
    remember();
    setEvents([...events, ...made]);
    setHidden(hidden.filter((item) => !made.some((copy) => copy.calendar === item)));
    selectIds(made.map(({ id }) => id));
  };
  /** What was copied on `day`: the earliest of them there, the others as far from it as they were. */
  const pasteOn = (day: Date) => {
    const first = Math.min(...copied.map((copy) => dayAt(copy.start).getTime()));
    placeCopies(copied, Math.round((dayAt(day).getTime() - first) / 864e5));
  };
  const copyable = several
    ? selectedEntries.some((entry) => entry.calendar !== BIRTHDAYS)
    : selectedEntry !== undefined && selectedEntry.calendar !== BIRTHDAYS;
  const duplicateSelected = () => {
    const entries = several ? selectedEntries : selectedEntry ? [selectedEntry] : [];
    placeCopies(entries.filter((entry) => entry.calendar !== BIRTHDAYS).map(copyOf), 0);
  };
  const editSelected = () => {
    if (several) return;
    const block = blockOf(selected);
    if (!block) return;
    openDetails(block);
  };
  useDesktopAppMenu(
    "calendar",
    "View",
    <>
      <MenuRadioGroup value={view} onValueChange={(next) => goTo(date, next as CalendarView)}>
        {VIEW_KEYS.map(([id, name, key]) => (
          <MenuRadioItem key={id} value={id} keyEquivalent={key}>
            {name}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+right" onClick={() => stepBy(1)}>
        Next
      </MenuItem>
      <MenuItem keyEquivalent="command+left" onClick={() => stepBy(-1)}>
        Previous
      </MenuItem>
      <MenuItem keyEquivalent="command+t" onClick={() => goTo(now)}>
        Go to Today
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+t" onClick={() => setGoingToDate(date)}>
        Go to Date…
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => setListShown(!listShown)}>
        {listShown ? "Hide Calendar List" : "Show Calendar List"}
      </MenuItem>
      {served ? (
        <MenuCheckboxItem checked={showDeclined} onCheckedChange={setShowDeclined}>
          Show Declined Invitations
        </MenuCheckboxItem>
      ) : null}
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Show Alternate Calendar</SubmenuTrigger>
        <SubmenuPopup aria-label="Show Alternate Calendar">
          <MenuRadioGroup
            value={alternateShown ? alternate : "off"}
            onValueChange={(next) => {
              setAlternateShown(next !== "off");
              if (next !== "off") setAlternate(next as AlternateCalendar);
            }}
          >
            <MenuRadioItem value="off">None</MenuRadioItem>
            {ALTERNATE_CALENDARS.map(({ id, name }) => (
              <MenuRadioItem key={id} value={id}>
                {name}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem disabled={!served} keyEquivalent="command+r" onClick={refreshCalendars}>
        Refresh Calendars
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={textStep >= MOST_TEXT_STEP}
        keyEquivalent="command+="
        onClick={() => stepText(1)}
      >
        Make Text Bigger
      </MenuItem>
      <MenuItem
        disabled={textStep <= LEAST_TEXT_STEP}
        keyEquivalent="command+-"
        onClick={() => stepText(-1)}
      >
        Make Text Smaller
      </MenuItem>
      <MenuSeparator />
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "calendar",
    "Edit",
    <>
      <MenuItem disabled={!history.undo.length} keyEquivalent="command+z" onClick={undoLast}>
        Undo
      </MenuItem>
      <MenuItem disabled={!history.redo.length} keyEquivalent="shift+command+z" onClick={redoLast}>
        Redo
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!canDelete} keyEquivalent="command+x" onClick={cutSelected}>
        Cut
      </MenuItem>
      <MenuItem
        disabled={!selectedEntry && !several}
        keyEquivalent="command+c"
        onClick={copySelected}
      >
        Copy
      </MenuItem>
      <MenuItem disabled={!copied.length} keyEquivalent="command+v" onClick={() => pasteOn(date)}>
        Paste
      </MenuItem>
      <MenuItem disabled={!copyable} keyEquivalent="command+d" onClick={duplicateSelected}>
        Duplicate
      </MenuItem>
      <MenuItem disabled={!canDelete} onClick={deleteSelected}>
        Delete
      </MenuItem>
      <MenuItem disabled={shown.length === 0} keyEquivalent="command+a" onClick={selectAllShown}>
        Select All
      </MenuItem>
      <MenuItem
        disabled={!selectedEntry || several}
        keyEquivalent="command+e"
        onClick={editSelected}
      >
        Edit Event
      </MenuItem>
      <MenuItem keyEquivalent="option+command+i" onClick={() => setInspector(!inspector)}>
        {inspector ? "Hide Inspector" : "Show Inspector"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+f" onClick={() => searchInput.current?.focus()}>
        Find
      </MenuItem>
      {textTools.items}
    </>,
    titleBar,
  );
  useWindowKeys(titleBar, (windowProps.state ?? "key") === "key", [
    { equivalent: "command+n", run: () => !loading && addEvent() },
    { equivalent: "command+=", run: () => stepText(1) },
    { equivalent: "command+-", run: () => stepText(-1) },
    { equivalent: "option+command+n", run: () => !loading && openQuickEvent() },
    {
      equivalent: "shift+command+n",
      run: () => !loading && setNaming({ id: null, name: "Untitled Group", group: true }),
    },
    { equivalent: "option+command+s", run: () => !loading && served && setSubscribing("") },
    { equivalent: "option+command+i", run: () => setInspector(!inspector) },
    { equivalent: "option+command+a", run: () => setAddressPanel(!addressPanel) },
    { equivalent: "command+p", run: () => !loading && setPrinting(true) },
    { equivalent: "command+r", run: () => served && refreshCalendars() },
    ...VIEW_KEYS.map(([id, , equivalent]) => ({
      equivalent,
      run: () => goTo(date, id),
    })),
    { equivalent: "command+right", run: () => stepBy(1), notInText: true },
    { equivalent: "command+left", run: () => stepBy(-1), notInText: true },
    { equivalent: "command+t", run: () => goTo(now) },
    { equivalent: "shift+command+t", run: () => setGoingToDate(date) },
    { equivalent: "command+e", run: editSelected },
    { equivalent: "command+f", run: () => searchInput.current?.focus() },
    { equivalent: "command+z", run: undoLast, notInText: true },
    { equivalent: "shift+command+z", run: redoLast, notInText: true },
    { equivalent: "command+x", run: cutSelected, notInText: true },
    { equivalent: "command+c", run: copySelected, notInText: true },
    { equivalent: "command+v", run: () => pasteOn(date), notInText: true },
    { equivalent: "command+d", run: duplicateSelected, notInText: true },
    { equivalent: "command+a", run: selectAllShown, notInText: true },
  ]);

  /**
   * An arrow key moves what is selected: a quarter of an hour up or down and a day to either side in
   * the week and day views, a week up or down and a day to either side in the month. The view follows
   * it out of the days it shows.
   */
  const nudgeSelected = (key: string): boolean => {
    const moving = (several ? selectedEntries : selectedEntry ? [selectedEntry] : []).filter(
      canDragEntry,
    );
    const [first] = moving;
    if (!first || view === "year") return false;
    const across = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
    const down = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
    const days = across + (view === "month" ? down * 7 : 0);
    const minutes = view === "month" ? 0 : down * SNAP_MINUTES;
    const placed = draggedTimes(first, "move", days, minutes);
    const movesAny = moving.some(
      (entry) =>
        draggedTimes(entry, "move", days, minutes).start.getTime() !== entry.start.getTime(),
    );
    if (!movesAny) return true;
    refocus.current = true;
    if (several) moveSeveral(moving, days, minutes);
    else dropMoved(first, placed);
    if (placed.start < range[0] || placed.start >= range[1]) goTo(placed.start);
    return true;
  };
  /** Tab goes to the next event of the view in time, Shift-Tab to the one before; off the ends, on. */
  const tabToEvent = (from: string, back: boolean): boolean => {
    const order = [...shown].sort(
      (a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id),
    );
    const next = order[order.findIndex((entry) => entry.id === from) + (back ? -1 : 1)];
    if (!next) return false;
    setAnchor(null);
    setSelected(next.id);
    refocus.current = true;
    return true;
  };

  // A secondary click on an event selects it for its menu; elsewhere the menu is the day's, at the
  // hour under the pointer in the week and day grids.
  const openViewMenu = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as Element;
    const block = target.closest<HTMLElement>("[data-event-id]");
    if (block) {
      const id = block.dataset.eventId ?? null;
      // A press on one of several selected keeps them, for the menu's Delete.
      if (id === null || !alsoSelected.includes(id)) selectEvent(id);
      setGridMenuAt(null);
      return;
    }
    setGridMenuAt(placeAt(event) ?? { day: date, hour: null });
  };
  // A double click on the empty week grid makes an event there; on a day of the month or the
  // all-day row, likewise. A press on a control of the view is the control's.
  const newEventOnGrid = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as Element;
    if (target.closest("button, input, [role='button']") || loading) return;
    const place = placeAt(event);
    if (!place) return;
    if (target.closest(".mac-calendar-week-grid-all-day")) {
      createEvent(dayAt(place.day), dayAt(place.day, 1), true);
      return;
    }
    newEventAt(place);
  };
  /** The day under the pointer, and the hour in the week and day grids; `null` off the grids. */
  const placeAt = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as Element;
    const cell = target.closest<HTMLElement>("[data-day], .mac-calendar-mini-month-day");
    const written = cell?.dataset.day ?? cell?.dataset.date;
    if (written) {
      return {
        day: dayOfKey(written),
        hour: null,
        heading: cell?.dataset.date !== undefined,
      };
    }
    const first = view === "week" ? weekStart(date, settings) : date;
    const heading = target.closest(".mac-calendar-week-grid-day");
    if (heading) {
      const headings = [...(body.current?.querySelectorAll(".mac-calendar-week-grid-day") ?? [])];
      return { day: dayAt(first, headings.indexOf(heading)), hour: null, heading: true };
    }
    const column = target.closest<HTMLElement>(".mac-calendar-week-grid-column");
    const columns = [...(body.current?.querySelectorAll(".mac-calendar-week-grid-column") ?? [])];
    if (column) {
      const hour = Math.floor((event.clientY - column.getBoundingClientRect().top) / hourHeight);
      return { day: dayAt(first, columns.indexOf(column)), hour };
    }
    const allDay = target.closest<HTMLElement>(
      ".mac-calendar-week-grid-all-day .mac-calendar-week-grid-cell",
    );
    const cells = [
      ...(body.current?.querySelectorAll(
        ".mac-calendar-week-grid-all-day .mac-calendar-week-grid-cell",
      ) ?? []),
    ];
    return allDay ? { day: dayAt(first, cells.indexOf(allDay)), hour: null } : null;
  };
  const newEventAt = ({ day, hour }: { day: Date; hour: number | null }) => {
    reveal(day);
    const start = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      hour ?? settings.dayStartsAt + 1,
    );
    createEvent(start, new Date(start.getTime() + 36e5));
  };
  /** The rows of a day's contextual menu; on a day's heading or a mini month's day, Show Day too. */
  const dayMenuRows = (place: { day: Date; hour: number | null; heading?: boolean }) => (
    <>
      <MenuItem onClick={() => newEventAt(place)}>New Event</MenuItem>
      <MenuItem
        onClick={() => {
          reveal(place.day);
          createEvent(dayAt(place.day), dayAt(place.day, 1), true);
        }}
      >
        New All-Day Event
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!copied.length} onClick={() => pasteOn(place.day)}>
        Paste
      </MenuItem>
      {place.heading ? (
        <>
          <MenuSeparator />
          <MenuItem onClick={() => goTo(place.day, "day")}>Show Day</MenuItem>
        </>
      ) : null}
    </>
  );

  const navigation = (
    <SegmentedControl
      aria-label="Go to"
      trackingMode="momentary"
      variant="separated"
      distribution="fit"
      className="mac-calendar-navigation"
    >
      <Segment
        aria-label={`Previous ${UNITS[view]}`}
        style={{ width: 23.5 }}
        onClick={() => stepBy(-1)}
      >
        <SystemImage name="go-back" scale={CHEVRON_SCALE} className="mac-calendar-chevron" />
      </Segment>
      <Segment style={{ width: 65, marginInline: -1.5 }} onClick={() => goTo(now)}>
        Today
      </Segment>
      <Segment aria-label={`Next ${UNITS[view]}`} style={{ width: 23 }} onClick={() => stepBy(1)}>
        <SystemImage name="go-forward" scale={CHEVRON_SCALE} className="mac-calendar-chevron" />
      </Segment>
    </SegmentedControl>
  );

  const grid = (days: number, start: Date) => (
    <CalendarWeekGrid
      className="mac-calendar-view"
      {...gridDrag.gridProps}
      onPointerDown={(event) => {
        gridDrag.gridProps.onPointerDown(event);
        gridCreate.onPointerDown(event);
      }}
      start={start}
      days={days}
      now={clockNow}
      events={withTravelBlocks(drawn)}
      value={selected}
      alsoSelected={alsoSelected}
      onValueChange={(id) => {
        setSelected(id);
        // Return selects an event and then opens its popover, in one update: that popover stays.
        setAnchor((current) => (current?.dataset.eventId === id ? current : null));
      }}
      onEventAction={(_, element) => openDetails(element)}
      hourHeight={hourHeight}
      defaultScrollHour={settings.dayStartsAt - 21.5 / hourHeight}
      accessory={navigation}
    />
  );

  // The month and the year have no reference capture: the year is composed of the mini month.
  const selectEvent = (id: string | null) => {
    setSelected(id);
    setAnchor((current) => (current?.dataset.eventId === id ? current : null));
  };

  /** What the popover, the day's details and the Inspector show of an event. */
  const detailsOf = (entry: CalendarEntry, field: EventField | null) => {
    const own = entry.series ?? entry.id;
    if (entry.calendar === INVITATIONS) {
      const id = own.replace(/^invitation-/, "");
      const invitation = invites.invitations.find((each) => each.id === id);
      return invitation ? (
        <InvitationDetails
          key={id}
          invitation={invitation}
          entry={entry}
          onRespond={(accept) => invites.respond(id, accept)}
        />
      ) : null;
    }
    if (entry.calendar === BIRTHDAYS) return <BirthdayDetails entry={entry} />;
    if (isWorkedOutHoliday(entry)) return <SubscribedDetails entry={entry} note={HOLIDAY_NOTE} />;
    if (subscribed.has(entry.calendar)) return <SubscribedDetails entry={entry} />;
    return (
      <EventDetails
        key={own}
        entry={onWindowClock(entry, windowZone)}
        calendars={listed}
        colorOf={colorOf}
        onChange={(fields) => change(entry, fromPopover(entry, fields, windowZone))}
        initialField={field}
        timeZoneSupport={settings.timeZoneSupport === true}
        windowZone={windowZone}
        canAttach={served}
        onShowLocation={served ? askMapsSearch : undefined}
        invitees={
          served && invites.canInvite
            ? {
                answers: invites.answers[own],
                ownName: invites.me,
                invitedElsewhere: events.filter((each) => each.invitees?.length && each.id !== own)
                  .length,
                lookup: lookupInvitee,
                people: contactPeople,
              }
            : undefined
        }
      />
    );
  };
  const selectedDetails = several ? (
    <Label color="secondary" className="mac-calendar-note">
      {selectedEntries.length} Events Selected
    </Label>
  ) : selectedEntry ? (
    detailsOf(selectedEntry, null)
  ) : null;

  const heading = (
    <div className="mac-calendar-heading">
      <h2 className="mac-calendar-heading-title">
        {view === "month" ? <b>{monthName.format(date)}</b> : null} {date.getFullYear()}
      </h2>
      {navigation}
    </div>
  );

  // A row of the calendar list; a calendar of the person's own can be dragged onto a group.
  const calendarRow = (item: CalendarInfo) => (
    <SidebarItem
      key={item.id}
      value={item.id}
      label={item.name}
      data-calendar={item.id}
      style={{ marginBlockEnd: 0, gap: 7 }}
      draggable={ownIds.includes(item.id) || undefined}
      onDragStart={(event) => {
        event.dataTransfer.setData(CALENDAR_DRAG, item.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      // Dropped on another of the person's calendars, it goes before it, and into its group.
      onDragOver={(event) => {
        if (ownIds.includes(item.id) && event.dataTransfer.types.includes(CALENDAR_DRAG)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onDrop={(event) => {
        const dragged = event.dataTransfer.getData(CALENDAR_DRAG);
        if (!dragged || !ownIds.includes(item.id)) return;
        event.preventDefault();
        event.stopPropagation();
        setOwn(moveCalendarBefore(own, dragged, item.id));
        if (keptGroups.length > 0) {
          const into = shownGroups.find((group) => group.calendars.includes(item.id))?.id ?? null;
          setGroups(moveCalendarToGroup(keptGroups, dragged, into));
        }
      }}
      icon={
        <span
          data-accent="custom"
          className="mac-calendar-check"
          style={
            {
              "--mac-accent-light": item.color,
              "--mac-accent-dark": item.color,
            } as CSSProperties
          }
        >
          <Checkbox
            aria-label={`Show ${item.name}`}
            checked={!hidden.includes(item.id)}
            onCheckedChange={(checked) => {
              setAnchor(null);
              setHidden(checked ? hidden.filter((id) => id !== item.id) : [...hidden, item.id]);
            }}
          />
        </span>
      }
      accessory={item.subscribed ? <SubscriptionGlyph /> : undefined}
    />
  );

  return (
    <Window
      aria-label="Calendar"
      data-calendar-text={textStep === 0 ? undefined : textStep}
      width={width}
      height={height}
      {...textTools.handlers}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "," && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onOpenPreferences?.();
          return;
        }
        // Delete or Backspace deletes the selected event, unless a field takes the key.
        if ((event.key === "Delete" || event.key === "Backspace") && !typing(event.target)) {
          if (several) {
            event.preventDefault();
            deleteSelected();
            return;
          }
          const entry = shown.find((item) => item.id === selected);
          // An invitation is answered in its popover, not deleted; a birthday belongs to Contacts, and a
          // subscribed event to its site.
          if (entry && deletable(entry)) {
            event.preventDefault();
            remove(entry);
          }
        }
        // The arrows and Tab are the view's while the keyboard is on one of its events, or on the
        // hours: a menu, a field or the mini month has its own use for them.
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        const target = event.target instanceof Element ? event.target : null;
        const block = target?.closest<HTMLElement>("[data-event-id]");
        const inView =
          target && body.current?.contains(target) && !typing(target)
            ? (block ?? target.closest(".mac-calendar-week-grid-scroll"))
            : null;
        if (!inView) return;
        if (event.key === "Tab") {
          if (block?.dataset.eventId && tabToEvent(block.dataset.eventId, event.shiftKey)) {
            event.preventDefault();
          }
        } else if (
          !event.shiftKey &&
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) &&
          nudgeSelected(event.key)
        ) {
          event.preventDefault();
        }
      }}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        variant="title-hidden"
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <Toolbar aria-label="Toolbar" className="mac-calendar-toolbar" inert={loading || undefined}>
          <div className="mac-calendar-toolbar-group">
            <ToolbarButton
              aria-expanded={listShown}
              style={{ width: 75 }}
              onClick={() => setListShown(!listShown)}
            >
              Calendars
            </ToolbarButton>
            <ToolbarButton
              ref={setPlus}
              aria-label="New Event"
              style={{ width: 38 }}
              // Held, it offers Quick Event; a click makes an event at the next full hour.
              onPointerDown={(down) => {
                if (down.button !== 0) return;
                heldPlus.current = false;
                holdingPlus.current = setTimeout(() => {
                  heldPlus.current = true;
                  openQuickEvent();
                }, QUICK_EVENT_HOLD);
              }}
              onPointerUp={() => holdingPlus.current && clearTimeout(holdingPlus.current)}
              onPointerLeave={() => holdingPlus.current && clearTimeout(holdingPlus.current)}
              onClick={() => {
                if (!heldPlus.current) addEvent();
                heldPlus.current = false;
              }}
            >
              <SystemImage name="add" className="mac-calendar-plus" />
            </ToolbarButton>
          </div>
          <ToolbarSegmentedControl
            aria-label="View"
            value={[view]}
            onValueChange={(next) => {
              const chosen = VIEWS.find((item) => item.id === next[0]);
              if (chosen) goTo(date, chosen.id);
            }}
          >
            {VIEWS.map((item) => (
              <ToolbarSegment
                key={item.id}
                value={item.id}
                style={{ width: item.width, padding: 0 }}
              >
                {item.title}
              </ToolbarSegment>
            ))}
          </ToolbarSegmentedControl>
          <div className="mac-calendar-toolbar-group" data-side="trailing">
            {settings.timeZoneSupport ? (
              <PopUpButton<string>
                size="small"
                aria-label="Time zone of the window"
                value={windowZone ?? localZone()}
                onValueChange={(zone) => {
                  if (!zone) return;
                  setKeptZone(zone === localZone() ? null : zone);
                  setAnchor(null);
                }}
              >
                {[...new Set([localZone(), ...ZONES])].map((zone) => (
                  <PopUpButtonItem key={zone} value={zone}>
                    {zoneName(zone)}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            ) : null}
            <ToolbarSearchField
              inputRef={searchInput}
              value={query}
              onValueChange={(next) => {
                setQuery(next);
                setAnchor(null);
              }}
              style={{ flex: "0 1 200px", minWidth: 0 }}
            />
          </div>
        </Toolbar>
      </TitleBar>
      <WindowBody
        ref={body}
        // A click with a modifier adds to the selection or takes from it; a plain one leaves one.
        onClickCapture={(click) => {
          const block = (click.target as Element).closest<HTMLElement>("[data-event-id]");
          if (!click.metaKey && !click.ctrlKey && !click.shiftKey) {
            setExtras(NO_EXTRAS);
            return;
          }
          if (!block?.dataset.eventId) return;
          click.preventDefault();
          click.stopPropagation();
          toggleSelected(block.dataset.eventId);
        }}
        background="content"
        className="mac-calendar-body"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files") && attachableAt(event.target as Element)) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          const entry = attachableAt(event.target as Element);
          if (!entry || event.dataTransfer.files.length === 0) return;
          event.preventDefault();
          void attachFiles(entry, [...event.dataTransfer.files]);
        }}
        inert={loading || undefined}
        aria-busy={loading || undefined}
        // Nothing of the week is drawn until the read that holds the person's first day settles.
        style={served && loading ? { visibility: "hidden" } : undefined}
      >
        <SplitView className="mac-calendar-split">
          {listShown ? (
            <SplitViewPane size={165} className="mac-calendar-sidebar-pane">
              <ContextualMenu>
                <ContextualMenuTrigger
                  className="mac-calendar-sidebar-menu"
                  onContextMenu={(event) => {
                    const row = (event.target as Element).closest<HTMLElement>(
                      "[data-calendar], [data-calendar-group]",
                    );
                    setMenuTarget(row?.dataset.calendar ?? null);
                    setMenuGroup(row?.dataset.calendarGroup ?? null);
                    const day = (event.target as Element).closest<HTMLElement>("[data-date]");
                    setMenuDay(day?.dataset.date ? dayOfKey(day.dataset.date) : null);
                  }}
                >
                  <Sidebar
                    aria-label="Calendars"
                    material="opaque"
                    className="mac-calendar-sidebar"
                    value={calendar}
                    onValueChange={(value) => {
                      if (!shownGroups.some((group) => group.id === value)) setCalendar(value);
                    }}
                    // A press on a calendar's checkbox shows or hides it and leaves the selection alone.
                    onMouseDown={(event) => {
                      if ((event.target as Element).closest("[role='checkbox']"))
                        event.preventDefault();
                    }}
                    footer={
                      <CalendarMiniMonth
                        value={null}
                        onValueChange={(day) => goTo(day)}
                        month={miniMonth}
                        onMonthChange={setMiniMonth}
                        today={now}
                        weekStartsOn={settings.weekStartsOn}
                      />
                    }
                  >
                    {(["iCloud", "Other"] as const).map((group, index) => (
                      // Calendar's list is tighter than a Finder sidebar: its first header is 3 pt
                      // shorter, the next 2 pt, and its 24 pt rows touch.
                      <SidebarSection
                        key={group}
                        title={group}
                        style={{ marginTop: index ? -2 : -3 }}
                      >
                        {group === "iCloud"
                          ? shownGroups.map((each) => {
                              const members = listed.filter((item) =>
                                each.calendars.includes(item.id),
                              );
                              const shown = groupShown(each, hidden);
                              return (
                                <SidebarItem
                                  key={each.id}
                                  value={each.id}
                                  label={each.name}
                                  data-calendar-group={each.id}
                                  style={{ marginBlockEnd: 0, gap: 7 }}
                                  expanded={each.closed !== true}
                                  onExpandedChange={(open) =>
                                    setGroups(
                                      keptGroups.map((one) =>
                                        one.id === each.id
                                          ? { ...one, closed: open ? undefined : true }
                                          : one,
                                      ),
                                    )
                                  }
                                  onDragOver={(event) => {
                                    if (event.dataTransfer.types.includes(CALENDAR_DRAG)) {
                                      event.preventDefault();
                                      event.stopPropagation();
                                    }
                                  }}
                                  onDrop={(event) => {
                                    const dragged = event.dataTransfer.getData(CALENDAR_DRAG);
                                    if (!dragged) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setGroups(moveCalendarToGroup(keptGroups, dragged, each.id));
                                  }}
                                  icon={
                                    <span className="mac-calendar-check">
                                      <Checkbox
                                        aria-label={`Show ${each.name}`}
                                        disabled={members.length === 0}
                                        checked={shown === "all"}
                                        indeterminate={shown === "some"}
                                        onCheckedChange={() => {
                                          setAnchor(null);
                                          const ids = each.calendars;
                                          setHidden(
                                            shown === "none"
                                              ? hidden.filter((id) => !ids.includes(id))
                                              : [...new Set([...hidden, ...ids])],
                                          );
                                        }}
                                      />
                                    </span>
                                  }
                                >
                                  {members.length > 0 ? members.map(calendarRow) : undefined}
                                </SidebarItem>
                              );
                            })
                          : null}
                        {listed
                          .filter(
                            (item) =>
                              item.group === group &&
                              !shownGroups.some((each) => each.calendars.includes(item.id)),
                          )
                          .map(calendarRow)}
                      </SidebarSection>
                    ))}
                  </Sidebar>
                </ContextualMenuTrigger>
                <ContextualMenuPopup aria-label="Calendar commands">
                  {menuDay ? (
                    dayMenuRows({ day: menuDay, hour: null, heading: true })
                  ) : (
                    <>
                      <MenuItem onClick={() => setNaming({ id: null, name: "Untitled" })}>
                        New Calendar
                      </MenuItem>
                      <MenuItem
                        onClick={() => setNaming({ id: null, name: "Untitled Group", group: true })}
                      >
                        New Calendar Group
                      </MenuItem>
                      <MenuItem disabled={!served} onClick={() => setSubscribing("")}>
                        New Calendar Subscription…
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        disabled={!targetOwn && !targetSubscription && !targetGroup}
                        onClick={() => {
                          if (targetGroup) {
                            setNaming({ id: targetGroup.id, name: targetGroup.name, group: true });
                            return;
                          }
                          const named = targetOwn ?? targetSubscription;
                          if (named) setNaming({ id: named.id, name: named.name });
                        }}
                      >
                        Rename…
                      </MenuItem>
                      <Submenu>
                        <SubmenuTrigger disabled={!targetOwn && !targetSubscription}>
                          Color
                        </SubmenuTrigger>
                        <SubmenuPopup>
                          <MenuRadioGroup
                            value={(targetOwn ?? targetSubscription)?.color ?? ""}
                            onValueChange={(color) => {
                              if (targetOwn) recolor(targetOwn.id, color as CalendarColor);
                              else if (targetSubscription) {
                                subscribed.recolor(targetSubscription.id, color as CalendarColor);
                              }
                            }}
                          >
                            {CALENDAR_COLORS.map((item) => (
                              <MenuRadioItem key={item.id} value={item.id}>
                                <span className="mac-calendar-color-item">
                                  <ColorChip color={item.value} />
                                  {item.name}
                                </span>
                              </MenuRadioItem>
                            ))}
                          </MenuRadioGroup>
                        </SubmenuPopup>
                      </Submenu>
                      <Submenu>
                        <SubmenuTrigger disabled={!targetOwn || shownGroups.length === 0}>
                          Move to Group
                        </SubmenuTrigger>
                        <SubmenuPopup>
                          <MenuRadioGroup
                            value={
                              shownGroups.find((group) =>
                                group.calendars.includes(targetOwn?.id ?? ""),
                              )?.id ?? "none"
                            }
                            onValueChange={(into) => {
                              if (targetOwn) {
                                setGroups(
                                  moveCalendarToGroup(
                                    keptGroups,
                                    targetOwn.id,
                                    into === "none" ? null : (into as string),
                                  ),
                                );
                              }
                            }}
                          >
                            <MenuRadioItem value="none">No Group</MenuRadioItem>
                            {shownGroups.map((group) => (
                              <MenuRadioItem key={group.id} value={group.id}>
                                {group.name}
                              </MenuRadioItem>
                            ))}
                          </MenuRadioGroup>
                        </SubmenuPopup>
                      </Submenu>
                      <MenuItem
                        disabled={
                          (!targetOwn || own.length < 2) && !targetSubscription && !targetGroup
                        }
                        onClick={() => {
                          if (targetGroup) {
                            setGroups(keptGroups.filter((group) => group.id !== targetGroup.id));
                            return;
                          }
                          if (targetSubscription) subscribed.remove(targetSubscription.id);
                          else if (targetOwn) setRemoving(targetOwn);
                        }}
                      >
                        {targetSubscription
                          ? "Unsubscribe"
                          : targetGroup
                            ? "Delete Group"
                            : "Delete"}
                      </MenuItem>
                      <MenuSeparator />
                      {fileItems(listedCalendar(menuTarget ?? calendar))}
                      {invites.invitations.length ? (
                        <>
                          <MenuSeparator />
                          <MenuCheckboxItem
                            checked={showDeclined}
                            onCheckedChange={setShowDeclined}
                          >
                            Show Declined Invitations
                          </MenuCheckboxItem>
                        </>
                      ) : null}
                    </>
                  )}
                </ContextualMenuPopup>
              </ContextualMenu>
            </SplitViewPane>
          ) : null}
          {listShown ? <SplitViewDivider disabled /> : null}
          <SplitViewPane
            className="mac-calendar-main"
            // The hours outside the day of Preferences are shaded. A desktop's: the captures show none.
            data-off-hours={served ? "" : undefined}
            style={
              served
                ? ({
                    "--mac-calendar-day-from": settings.dayStartsAt,
                    "--mac-calendar-day-to": settings.dayEndsAt,
                  } as CSSProperties)
                : undefined
            }
          >
            <ContextualMenu>
              <ContextualMenuTrigger
                className="mac-calendar-view-menu"
                onContextMenu={openViewMenu}
                onDoubleClick={newEventOnGrid}
                onWheel={weekWheel}
              >
                {words ? (
                  <div className="mac-calendar-results">
                    {results.length ? (
                      <ListView
                        aria-label="Search results"
                        className="mac-calendar-results-list"
                        count={results.length}
                        rowHeight={40}
                        separator="inset"
                        getRowId={(index) => results[index]?.entry.id ?? index}
                        getRowLabel={(index) => results[index]?.entry.title ?? ""}
                        onRowAction={(index) => {
                          const found = results[index];
                          if (!found) return;
                          goTo(found.at, "day");
                          setSelected(
                            found.entry.repeat
                              ? occurrenceId(found.entry.id, found.at)
                              : found.entry.id,
                          );
                        }}
                        renderRow={(index) => {
                          const found = results[index];
                          return found ? (
                            <>
                              <ListViewRowTitle>{found.entry.title}</ListViewRowTitle>
                              <ListViewRowDetail lead={resultDate.format(found.at)}>
                                {found.entry.location ??
                                  listed.find((item) => item.id === found.entry.calendar)?.name ??
                                  ""}
                              </ListViewRowDetail>
                            </>
                          ) : null;
                        }}
                      />
                    ) : (
                      <Label color="secondary" className="mac-calendar-results-empty">
                        No Results
                      </Label>
                    )}
                  </div>
                ) : null}
                {view === "week" ? grid(settings.daysPerWeek, weekStart(date, settings)) : null}
                {view === "day" ? (
                  <div className="mac-calendar-day">
                    {grid(1, date)}
                    <aside
                      className="mac-calendar-day-detail"
                      aria-label="Details"
                      inert={opened !== undefined || undefined}
                    >
                      {selectedDetails ?? (
                        <>
                          <h3 className="mac-calendar-day-detail-title">{dayName.format(date)}</h3>
                          {eventsOnDay(shownOnClock, date).map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              className="mac-calendar-day-detail-event"
                              aria-label={`Show ${entry.title}`}
                              style={
                                {
                                  "--mac-calendar-day-detail-color": entry.color,
                                } as CSSProperties
                              }
                              onClick={() => selectEvent(entry.id)}
                            >
                              <span className="mac-calendar-day-detail-event-title">
                                {entry.title}
                              </span>
                              {entry.allDay ? "all-day" : timeName.format(entry.start)}
                            </button>
                          ))}
                          {eventsOnDay(shownOnClock, date).length === 0 ? (
                            <Label color="secondary" className="mac-calendar-note">
                              No Events
                            </Label>
                          ) : null}
                        </>
                      )}
                    </aside>
                  </div>
                ) : null}
                {view === "month" ? (
                  <CalendarMonthGrid
                    month={date}
                    events={drawn}
                    now={clockNow}
                    weekStartsOn={settings.weekStartsOn}
                    selected={selected}
                    alsoSelected={alsoSelected}
                    onSelect={selectEvent}
                    onEventAction={openDetails}
                    onDayClick={(day) => setDate(day)}
                    onDayOpen={(day) => goTo(day, "day")}
                    onPointerDown={monthDrag.onPointerDown}
                    alternateOf={alternateOf}
                    weekNumberOf={weekNumberOf}
                  >
                    {heading}
                  </CalendarMonthGrid>
                ) : null}
                {view === "year" ? (
                  <div className="mac-calendar-view">
                    {heading}
                    <div className="mac-calendar-year">
                      {Array.from({ length: 12 }, (_, month) => (
                        <CalendarMiniMonth
                          // biome-ignore lint/suspicious/noArrayIndexKey: the twelve months of a year
                          key={month}
                          className="mac-calendar-year-month"
                          navigation={false}
                          value={null}
                          onValueChange={(day) => goTo(day, "day")}
                          month={new Date(date.getFullYear(), month, 1)}
                          today={now}
                          weekStartsOn={settings.weekStartsOn}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </ContextualMenuTrigger>
              <ContextualMenuPopup aria-label="Event commands">
                {gridMenuAt ? (
                  dayMenuRows(gridMenuAt)
                ) : (
                  <>
                    <MenuItem disabled={several} onClick={editSelected}>
                      Get Info
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem disabled={!canDelete} onClick={cutSelected}>
                      Cut
                    </MenuItem>
                    <MenuItem onClick={copySelected}>Copy</MenuItem>
                    <MenuItem disabled={!copyable} onClick={duplicateSelected}>
                      Duplicate
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem disabled={!canDelete} onClick={deleteSelected}>
                      Delete
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      disabled={mailRefusal !== undefined}
                      title={mailRefusal}
                      data-reason={mailRefusal}
                      onClick={mailEvent}
                    >
                      Mail Event
                    </MenuItem>
                    <MenuItem
                      disabled={mapsRefusal !== undefined}
                      title={mapsRefusal}
                      data-reason={mapsRefusal}
                      onClick={() => askMapsSearch(selectedEntry?.location ?? "")}
                    >
                      Show in Maps
                    </MenuItem>
                    <Submenu>
                      <SubmenuTrigger>Share</SubmenuTrigger>
                      <SubmenuPopup aria-label="Share">
                        <LinkShareItems
                          plain
                          url={selectedEntry?.url ?? ""}
                          title={selectedEntry?.title ?? ""}
                          from="calendar"
                        />
                      </SubmenuPopup>
                    </Submenu>
                    <Submenu>
                      <SubmenuTrigger>Share Event</SubmenuTrigger>
                      <SubmenuPopup aria-label="Share Event">
                        <FileShareItems
                          items={selectedEntry ? [files.eventFile(selectedEntry)] : []}
                          from="calendar"
                        />
                      </SubmenuPopup>
                    </Submenu>
                  </>
                )}
              </ContextualMenuPopup>
            </ContextualMenu>
          </SplitViewPane>
        </SplitView>
      </WindowBody>
      {inspector ? (
        <InspectorPanel
          aria-label="Inspector"
          title="Inspector"
          width={289}
          className="mac-calendar-inspector"
          style={{ translate: `${inspectorAt.x}px ${inspectorAt.y}px` }}
          inert={opened !== undefined || loading || undefined}
          onClose={() => setInspector(false)}
          onDragRegionPointerDown={(down) => {
            const from = { x: down.clientX - inspectorAt.x, y: down.clientY - inspectorAt.y };
            const move = (moved: PointerEvent) =>
              setInspectorAt({ x: moved.clientX - from.x, y: moved.clientY - from.y });
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          {loading ? (
            <Label color="secondary" className="mac-calendar-note">
              {CALENDAR_LOADING}
            </Label>
          ) : (
            (selectedDetails ?? (
              <Label color="secondary" className="mac-calendar-note">
                No Event Selected
              </Label>
            ))
          )}
        </InspectorPanel>
      ) : null}
      {addressPanel ? (
        <AddressPanel
          className="mac-calendar-floating-panel"
          people={contactPeople}
          invited={selectedEntry?.invitees ?? []}
          refusal={inviteRefusal}
          onClose={() => setAddressPanel(false)}
          onInvite={(person) => {
            if (selectedEntry) {
              change(selectedEntry, {
                invitees: [...(selectedEntry.invitees ?? []), person.to],
              });
            }
          }}
        />
      ) : null}
      {textTools.panels}
      {printing ? (
        <CalendarPrintSheet
          anchor={titleBar}
          initial={printOptions}
          calendars={printCalendars}
          shownCalendars={printCalendars.map(({ id }) => id).filter((id) => !hidden.includes(id))}
          entriesFor={occurrencesOf}
          onClose={() => setPrinting(false)}
        />
      ) : null}
      <Popover
        open={quickLine !== null}
        onOpenChange={(open) => {
          if (!open) setQuickLine(null);
        }}
      >
        <PopoverPopup anchor={plus} aria-label="Quick Event" className="mac-calendar-quick-event">
          <TextField
            aria-label="Quick Event"
            placeholder="Create Quick Event"
            value={quickLine ?? ""}
            onValueChange={setQuickLine}
            onKeyDown={(key) => {
              if (key.key === "Enter") {
                key.preventDefault();
                makeQuickEvent();
              }
            }}
            autoFocus
          />
        </PopoverPopup>
      </Popover>
      <Popover
        // Closed while the saved events load, so no change is made in it that they would replace.
        open={!loading && opened !== undefined}
        onOpenChange={(open, details) => {
          // A menu of the menu bar or a text panel works on what the popover holds: it stays, whether
          // the press or the keyboard went there.
          const went = details?.event as
            | (Event & { relatedTarget?: EventTarget | null })
            | undefined;
          const pressed = went?.relatedTarget ?? went?.target;
          if (
            !open &&
            pressed instanceof Element &&
            pressed.closest('[role="menubar"], [role="menu"], .mac-calendar-floating-panel')
          ) {
            return;
          }
          if (!open) setAnchor(null);
        }}
      >
        <PopoverPopup
          ref={popup}
          // The popover itself takes the focus, as in Calendar, not its first control.
          initialFocus={popup}
          side="right"
          // Half a point down, where AppKit's rounding puts the capture's popovers.
          alignOffset={0.5}
          anchor={anchor}
          className="mac-calendar-popover"
          aria-label={opened?.title}
          style={{ ["--mac-popover-padding" as string]: "0px" }}
          {...popoverProps}
        >
          {opened ? detailsOf(opened, firstField) : null}
        </PopoverPopup>
      </Popover>
      <Sheet open={goingToDate !== null} onOpenChange={(open) => !open && setGoingToDate(null)}>
        <SheetPopup anchor={titleBar} width={320}>
          <SheetTitle>Go to Date</SheetTitle>
          {goingToDate ? (
            <DatePicker
              aria-label="Date"
              elements="yearMonthDay"
              value={goingToDate}
              onValueChange={(next) => next && setGoingToDate(next)}
            />
          ) : null}
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <SheetClose render={<DefaultButton />} onClick={() => goingToDate && goTo(goingToDate)}>
              Show
            </SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
      <Sheet open={subscribing !== null} onOpenChange={(open) => !open && setSubscribing(null)}>
        <SheetPopup anchor={titleBar} width={420}>
          <SheetTitle>Enter the URL of the calendar you want to subscribe to.</SheetTitle>
          <TextField
            aria-label="Calendar URL"
            placeholder="webcal://example.com/calendar.ics"
            value={subscribing ?? ""}
            onValueChange={setSubscribing}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                subscribe();
              }
            }}
            autoFocus
          />
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <DefaultButton onClick={subscribe}>Subscribe</DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>
      <Sheet open={naming !== null} onOpenChange={(open) => !open && setNaming(null)}>
        <SheetPopup anchor={titleBar} width={320}>
          <SheetTitle>
            {naming?.group
              ? naming.id
                ? "Rename Group"
                : "New Calendar Group"
              : naming?.id
                ? "Rename Calendar"
                : "New Calendar"}
          </SheetTitle>
          <TextField
            aria-label="Calendar name"
            value={naming?.name ?? ""}
            onValueChange={(name) =>
              setNaming((current) => (current ? { ...current, name } : current))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveCalendarName();
              }
            }}
            autoFocus
          />
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <DefaultButton onClick={saveCalendarName}>OK</DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>
      <Alert open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to delete the calendar {"\u201c"}
            {removing?.name}
            {"\u201d"}?
          </AlertMessage>
          <AlertInformativeText>All of its events will be deleted.</AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => removing && removeCalendar(removing)}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        {/* Its three titles need more than an alert's 420 points, or the last is cut off. */}
        <AlertPopup style={{ width: 620 }}>
          <AlertMessage>
            Do you want to delete all future occurrences of this event, or only the selected
            occurrence?
          </AlertMessage>
          <AlertButtons
            leading={
              <AlertClose onClick={() => deleting && removeOccurrences(deleting, true)}>
                Delete All Future Events
              </AlertClose>
            }
          >
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => deleting && removeOccurrences(deleting, false)}
            >
              Delete Only This Event
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={pendingMove !== null} onOpenChange={(open) => !open && setPendingMove(null)}>
        <AlertPopup style={{ width: 480 }}>
          <AlertMessage>
            Do you want to change only this occurrence of the event, or all of its occurrences?
          </AlertMessage>
          <AlertInformativeText>
            {"\u201c"}
            {pendingMove?.entry.title}
            {"\u201d"} repeats. Changing all of them moves every occurrence the same way.
          </AlertInformativeText>
          <AlertButtons
            leading={
              <AlertClose
                onClick={() =>
                  pendingMove &&
                  change(pendingMove.entry, { start: pendingMove.start, end: pendingMove.end })
                }
              >
                All Events
              </AlertClose>
            }
          >
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => pendingMove && moveOccurrence(pendingMove)}
            >
              Only This Event
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      {files.elements}
      <Alert open={report !== null} onOpenChange={(open) => !open && setReport(null)}>
        <AlertPopup>
          <AlertMessage>{report?.message}</AlertMessage>
          {report?.detail ? <AlertInformativeText>{report.detail}</AlertInformativeText> : null}
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      {dueEventAlerts.length > 0
        ? createPortal(
            <div className="mac-calendar-alerts" ref={setAlertsLayer}>
              {dueEventAlerts.map((alert) => (
                <NotificationAlert
                  key={alert.key}
                  data-event-alert={alert.key}
                  title={alert.title}
                  subtitle={alert.location}
                  actions={
                    <>
                      <NotificationAlertClose>Close</NotificationAlertClose>
                      <Menu>
                        <MenuTrigger render={<NotificationAlertAction />}>Snooze</MenuTrigger>
                        <MenuPopup container={alertsLayer} aria-label="Snooze for">
                          {SNOOZE_CHOICES.map((choice) => (
                            <MenuItem
                              key={choice.minutes}
                              onClick={() => snoozeAlert(alert, choice.minutes)}
                            >
                              {choice.name}
                            </MenuItem>
                          ))}
                        </MenuPopup>
                      </Menu>
                    </>
                  }
                  onDismiss={() => closeAlert(alert)}
                >
                  {alertWhen(alert, now.getTime())}
                </NotificationAlert>
              ))}
            </div>,
            // `document` here is the window's own (its events and calendars).
            globalThis.document.body,
          )
        : null}
    </Window>
  );
}
