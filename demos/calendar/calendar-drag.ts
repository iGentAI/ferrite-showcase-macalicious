import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { type CalendarEntry, sameDay } from "./calendar-data";
import { daysSpanned } from "./calendar-recurrence";

/*
 * Dragging events in the week and day grid (the library's `CalendarWeekGrid`, whose root takes
 * the pointer handlers): an event moves where it is dragged, to another day and time, and its top
 * or bottom edge changes when it starts or ends. Times move in steps of 15 minutes; an all-day
 * event moves by whole days in the all-day row. Nothing changes until the pointer is let go, and
 * Escape gives the drag up. A press that does not move is a click: it selects the event, and a
 * double click opens its popover, where its dates can also be typed.
 */

/** What a drag changes: the whole event, or when it starts or ends. */
export type DragMode = "move" | "start" | "end";

/** Times move in steps of this many minutes, and an event lasts at least one. */
export const SNAP_MINUTES = 15;
/** How far, in points, the pointer moves before a press becomes a drag. */
const THRESHOLD = 4;
/** How close, in points, to an event's top or bottom edge a press changes that time. */
const EDGE = 5;
const MINUTE = 60_000;

/** An event's start and end. */
export interface Times {
  start: Date;
  end: Date;
}

/** `date` moved by `days` days and `minutes` minutes on the wall clock. */
const shifted = (date: Date, days: number, minutes: number) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes() + minutes,
    date.getSeconds(),
    date.getMilliseconds(),
  );

/**
 * The times a drag gives `entry`: moved by `dayDelta` days and `minuteDelta` minutes (an all-day
 * event by days only, keeping its number of days), or with its start or end alone moved by
 * `minuteDelta`, never closer than `SNAP_MINUTES` to the other.
 */
export function draggedTimes(
  entry: Pick<CalendarEntry, "start" | "end" | "allDay">,
  mode: DragMode,
  dayDelta: number,
  minuteDelta: number,
): Times {
  const { start, end } = entry;
  if (entry.allDay) {
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayDelta);
    return {
      start: from,
      end: new Date(from.getFullYear(), from.getMonth(), from.getDate() + daysSpanned(start, end)),
    };
  }
  const least = SNAP_MINUTES * MINUTE;
  if (mode === "move") {
    const from = shifted(start, dayDelta, minuteDelta);
    return { start: from, end: new Date(from.getTime() + (end.getTime() - start.getTime())) };
  }
  if (mode === "end") {
    const to = shifted(end, 0, minuteDelta);
    return {
      start,
      end: to.getTime() - start.getTime() < least ? new Date(start.getTime() + least) : to,
    };
  }
  const from = shifted(start, 0, minuteDelta);
  return {
    start: end.getTime() - from.getTime() < least ? new Date(end.getTime() - least) : from,
    end,
  };
}

/** What a drag let go at `to` did to `entry`: its days and minutes moved on the wall clock. */
export function dragShift(entry: Times, to: Times): { days: number; minutes: number } {
  return {
    days: Math.round((dayOf(to.start) - dayOf(entry.start)) / 864e5),
    minutes: minuteOf(to.start) - minuteOf(entry.start),
  };
}

/**
 * Whether `to` moves `entry` whole, rather than changing how long it lasts: whether a move gives it
 * those times, so an all-day event keeps its days though one of them has 23 or 25 hours.
 */
export function movesWhole(entry: Pick<CalendarEntry, "start" | "end" | "allDay">, to: Times) {
  const { days, minutes } = dragShift(entry, to);
  const moved = draggedTimes(entry, "move", days, minutes);
  return moved.start.getTime() === to.start.getTime() && moved.end.getTime() === to.end.getTime();
}

const dayOf = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const minuteOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

/** What a press at `y` on `block`, the element of `entry`, would drag. */
export function dragModeAt(
  block: Element,
  entry: Pick<CalendarEntry, "start" | "end" | "allDay">,
  y: number,
): DragMode {
  // An all-day event moves by days; one that reaches another day moves whole.
  if (entry.allDay || !sameDay(entry.start, new Date(entry.end.getTime() - 1))) return "move";
  const rect = block.getBoundingClientRect();
  // A short event keeps room to be moved between its edges.
  const edge = Math.min(EDGE, rect.height / 3);
  if (y >= rect.bottom - edge) return "end";
  if (y <= rect.top + edge) return "start";
  return "move";
}

/** The drag under way: the event's `id` in the grid and the times it would have. */
export interface GridDrag extends Times {
  id: string;
  mode: DragMode;
}

export interface GridDragOptions {
  /** Height of one hour in the grid, in points. */
  hourHeight: number;
  /** The event (or occurrence) the grid shows with this `id`. */
  entryOf: (id: string) => CalendarEntry | undefined;
  /** Whether `entry` can be dragged: one of the person's own calendars' events. */
  canDrag: (entry: CalendarEntry) => boolean;
  /** Called when a drag that changed the event's times is let go. */
  onDrop: (entry: CalendarEntry, times: Times) => void;
  /** Called when the event is let go over a calendar in the list; its times stay. */
  onDropOnCalendar?: (entry: CalendarEntry, calendar: string) => void;
  /** Offers the event, let go at this point, to what stands there outside the window. */
  onDropOutside?: (entry: CalendarEntry, at: { clientX: number; clientY: number }) => boolean;
}

/** Whether a drag ended over a calendar in the list; `onDrop`, when so, is told which. */
export function droppedOnCalendar(
  at: { clientX: number; clientY: number },
  entry: CalendarEntry,
  onDrop: ((entry: CalendarEntry, calendar: string) => void) | undefined,
): boolean {
  const row = document
    .elementFromPoint(at.clientX, at.clientY)
    ?.closest<HTMLElement>("[data-calendar]");
  const calendar = row?.dataset.calendar;
  if (!calendar || !onDrop) return false;
  onDrop(entry, calendar);
  return true;
}

const blockOf = (target: EventTarget | null, root: Element) => {
  const block = target instanceof Element ? target.closest("[data-event-id]") : null;
  return block instanceof HTMLElement && root.contains(block) ? block : null;
};

/**
 * A drag on the empty hours of a `CalendarWeekGrid` makes an event over the times it covers, in the
 * day it began in: `creating` is the span so far, which the window draws, and `onCreate` is called
 * when it is let go. A press that does not move stays a click, so a double click still makes one.
 */
export function useGridCreate(options: {
  hourHeight: number;
  enabled: boolean;
  /** The day of the column at `index`. */
  dayOf: (index: number) => Date;
  onCreate: (times: Times) => void;
}) {
  const latest = useRef(options);
  latest.current = options;
  const [creating, setCreating] = useState<Times | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !event.isPrimary || event.pointerType === "touch") return;
    if (!latest.current.enabled || !(event.target instanceof Element)) return;
    if (event.target.closest("[data-event-id], button")) return;
    const column = event.target.closest<HTMLElement>(".mac-calendar-week-grid-column");
    if (!column) return;
    stop.current?.();
    const root = event.currentTarget;
    const columns = [...root.querySelectorAll(".mac-calendar-week-grid-column")];
    const day = latest.current.dayOf(columns.indexOf(column));
    // The column's top moves as the hours scroll, so it is read again at every step.
    const minuteAt = (y: number) => {
      const pixels = y - column.getBoundingClientRect().top;
      const minutes = (pixels / latest.current.hourHeight) * 60;
      return Math.max(0, Math.min(1440, Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES));
    };
    const at = (minute: number) =>
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute);
    const pointer = event.pointerId;
    const origin = { y: event.clientY, minute: minuteAt(event.clientY) };
    let started = false;
    const timesAt = (y: number): Times => {
      const minute = minuteAt(y);
      const first = Math.min(origin.minute, minute);
      const last = Math.max(origin.minute, minute);
      const from = Math.min(first, 1440 - SNAP_MINUTES);
      return { start: at(from), end: at(Math.max(last, from + SNAP_MINUTES)) };
    };
    const move = (moved: PointerEvent) => {
      if (moved.pointerId !== pointer) return;
      if (!started && Math.abs(moved.clientY - origin.y) < THRESHOLD) return;
      started = true;
      moved.preventDefault();
      setCreating(timesAt(moved.clientY));
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      stop.current = null;
      setCreating(null);
    };
    const up = (released: PointerEvent) => {
      if (released.pointerId !== pointer) return;
      cleanup();
      if (!started) return;
      // The click that ends a drag is no click on the grid: it would clear the selection.
      const swallow = (click: Event) => {
        click.stopPropagation();
        click.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      latest.current.onCreate(timesAt(released.clientY));
    };
    const cancel = (cancelled: PointerEvent) => {
      if (cancelled.pointerId === pointer) cleanup();
    };
    const key = (pressed: KeyboardEvent) => {
      if (!started || pressed.key !== "Escape") return;
      pressed.preventDefault();
      pressed.stopPropagation();
      cleanup();
    };
    stop.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
  };

  return { creating, onPointerDown };
}

/**
 * Dragging the events of a `CalendarWeekGrid`: `gridProps` go on the grid (its root takes them),
 * and `drag` is the drag under way, which the window draws in place of the event.
 */
export function useGridDrag(options: GridDragOptions) {
  const latest = useRef(options);
  latest.current = options;
  const [drag, setDrag] = useState<GridDrag | null>(null);
  // Ends the drag under way: its listeners go.
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  // Over an edge that changes a time, the pointer says so (calendar.css).
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (stop.current || event.buttons) return;
    const root = event.currentTarget;
    const block = blockOf(event.target, root);
    const entry = block ? latest.current.entryOf(block.dataset.eventId ?? "") : undefined;
    const edge =
      block !== null &&
      entry !== undefined &&
      latest.current.canDrag(entry) &&
      dragModeAt(block, entry, event.clientY) !== "move";
    root.toggleAttribute("data-resize-edge", edge);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    // The primary button of a mouse or a pen; a touch scrolls the grid.
    if (event.button !== 0 || !event.isPrimary || event.pointerType === "touch") return;
    stop.current?.();
    const root = event.currentTarget;
    const block = blockOf(event.target, root);
    if (!block) return;
    const id = block.dataset.eventId ?? "";
    const entry = latest.current.entryOf(id);
    if (!entry || !latest.current.canDrag(entry)) return;
    const mode = dragModeAt(block, entry, event.clientY);
    const allDay = entry.allDay === true;
    // The days' columns as they stand when the drag starts: the hours', or the all-day row's.
    const columns = [
      ...root.querySelectorAll<HTMLElement>(
        allDay
          ? ".mac-calendar-week-grid-all-day .mac-calendar-week-grid-cell"
          : ".mac-calendar-week-grid-column",
      ),
    ].map((column) => column.getBoundingClientRect());
    const columnAt = (x: number) => {
      const at = columns.findIndex((rect) => x < rect.right);
      return at < 0 ? Math.max(columns.length - 1, 0) : at;
    };
    // The hours scroll: a drag counts what they scrolled under the pointer too.
    const hours = root.querySelector<HTMLElement>('[role="group"]');
    const scroll = () => hours?.scrollTop ?? 0;
    const origin = {
      x: event.clientX,
      y: event.clientY,
      scroll: scroll(),
      column: columnAt(event.clientX),
    };
    const pointer = event.pointerId;
    let started = false;
    let last: GridDrag | null = null;
    const timesAt = (x: number, y: number) => {
      const days = mode === "move" ? columnAt(x) - origin.column : 0;
      const pixels = y - origin.y + (scroll() - origin.scroll);
      const minutes = allDay
        ? 0
        : Math.round((pixels / latest.current.hourHeight) * (60 / SNAP_MINUTES)) * SNAP_MINUTES;
      return draggedTimes(entry, mode, days, minutes);
    };
    const move = (moved: PointerEvent) => {
      if (moved.pointerId !== pointer) return;
      if (!started) {
        if (Math.hypot(moved.clientX - origin.x, moved.clientY - origin.y) < THRESHOLD) return;
        started = true;
        root.setAttribute("data-dragging", mode);
      }
      moved.preventDefault();
      const times = timesAt(moved.clientX, moved.clientY);
      if (
        last?.start.getTime() === times.start.getTime() &&
        last.end.getTime() === times.end.getTime()
      )
        return;
      last = { id, mode, ...times };
      setDrag(last);
    };
    const finish = (drop: PointerEvent | null) => {
      cleanup();
      if (!started) return;
      // The click that ends a drag is no click on the grid: it would clear the selection.
      const swallow = (click: Event) => {
        click.stopPropagation();
        click.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      setDrag(null);
      if (!drop) return;
      if (latest.current.onDropOutside?.(entry, drop)) return;
      if (droppedOnCalendar(drop, entry, latest.current.onDropOnCalendar)) return;
      const times = timesAt(drop.clientX, drop.clientY);
      if (
        times.start.getTime() === entry.start.getTime() &&
        times.end.getTime() === entry.end.getTime()
      )
        return;
      latest.current.onDrop(entry, times);
    };
    const up = (released: PointerEvent) => {
      if (released.pointerId === pointer) finish(released);
    };
    const cancel = (cancelled: PointerEvent) => {
      if (cancelled.pointerId === pointer) finish(null);
    };
    const key = (pressed: KeyboardEvent) => {
      if (!started || pressed.key !== "Escape") return;
      pressed.preventDefault();
      pressed.stopPropagation();
      finish(null);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      root.removeAttribute("data-dragging");
      stop.current = null;
    };
    stop.current = () => {
      cleanup();
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
  };

  return { drag, gridProps: { onPointerDown, onPointerMove } };
}
