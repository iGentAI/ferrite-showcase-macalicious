import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type CalendarEntry, dayAt, sameDay } from "./calendar-data";
import { draggedTimes, droppedOnCalendar, type Times } from "./calendar-drag";

/** The days a month's grid shows: whole weeks from the one that holds the first of the month. */
export function monthGridDays(month: Date, weekStartsOn: number): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const start = dayAt(first, -lead);
  return Array.from({ length: Math.ceil((lead + length) / 7) * 7 }, (_, at) => dayAt(start, at));
}

/** The events that fall on `day`, all-day ones first, then by start. An end is exclusive. */
export function eventsOnDay<Entry extends Pick<CalendarEntry, "start" | "end" | "allDay">>(
  events: readonly Entry[],
  day: Date,
): Entry[] {
  const next = dayAt(day, 1);
  return events
    .filter((entry) => entry.start < next && (entry.end > day || entry.start >= day))
    .sort(
      (a, b) =>
        Number(b.allDay === true) - Number(a.allDay === true) ||
        a.start.getTime() - b.start.getTime(),
    );
}

/**
 * The events a day draws when it has room for `fits` rows: when they do not all fit, one row goes
 * to "more", and may leave none for events. Those drawn keep their places when one is selected; a
 * selected event that would be hidden takes the last row, since its popover needs its block.
 */
export function rowsOfDay<Entry extends { id: string }>(
  onDay: readonly Entry[],
  fits: number,
  selected: string | null,
): Entry[] {
  if (onDay.length <= fits) return [...onDay];
  const drawn = onDay.slice(0, fits - 1);
  const chosen = onDay.find((entry) => entry.id === selected);
  if (drawn.length && chosen && !drawn.includes(chosen)) drawn[drawn.length - 1] = chosen;
  return drawn;
}

/** How far, in points, the pointer moves before a press becomes a drag. */
const THRESHOLD = 4;

export interface MonthDrag extends Times {
  id: string;
}

interface MonthDragOptions {
  entryOf: (id: string) => CalendarEntry | undefined;
  canDrag: (entry: CalendarEntry) => boolean;
  onDrop: (entry: CalendarEntry, times: Times) => void;
  onDropOnCalendar?: (entry: CalendarEntry, calendar: string) => void;
  onDropOutside?: (entry: CalendarEntry, at: { clientX: number; clientY: number }) => boolean;
}

/**
 * Dragging an event from one day of the month's grid to another: it keeps its time of day. Nothing
 * changes until the pointer is let go, and Escape gives the drag up. `drag` is the drag under way,
 * which the window draws in place of the event.
 */
export function useMonthDrag(options: MonthDragOptions) {
  const latest = useRef(options);
  latest.current = options;
  const [drag, setDrag] = useState<MonthDrag | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !event.isPrimary || event.pointerType === "touch") return;
    stop.current?.();
    const block = event.target instanceof Element ? event.target.closest("[data-event-id]") : null;
    if (!(block instanceof HTMLElement)) return;
    const entry = latest.current.entryOf(block.dataset.eventId ?? "");
    if (!entry || !latest.current.canDrag(entry)) return;
    const rows = event.currentTarget.querySelector(".mac-calendar-month-rows");
    if (!rows) return;
    const area = rows.getBoundingClientRect();
    const weeks = rows.childElementCount / 7;
    const cellAt = (x: number, y: number) => {
      const column = Math.floor(((x - area.left) / area.width) * 7);
      const row = Math.floor(((y - area.top) / area.height) * weeks);
      return Math.max(0, Math.min(weeks - 1, row)) * 7 + Math.max(0, Math.min(6, column));
    };
    const origin = {
      x: event.clientX,
      y: event.clientY,
      cell: cellAt(event.clientX, event.clientY),
    };
    const pointer = event.pointerId;
    let started = false;
    let lastDays = 0;
    const move = (moved: PointerEvent) => {
      if (moved.pointerId !== pointer) return;
      if (!started) {
        if (Math.hypot(moved.clientX - origin.x, moved.clientY - origin.y) < THRESHOLD) return;
        started = true;
      }
      moved.preventDefault();
      const days = cellAt(moved.clientX, moved.clientY) - origin.cell;
      if (days === lastDays) return;
      lastDays = days;
      setDrag({ id: entry.id, ...draggedTimes(entry, "move", days, 0) });
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
      const days = cellAt(drop.clientX, drop.clientY) - origin.cell;
      if (days) latest.current.onDrop(entry, draggedTimes(entry, "move", days, 0));
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

  return { drag, onPointerDown };
}

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short" });
const fullDay = new Intl.DateTimeFormat("en-US", { dateStyle: "full" });
const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

const pad = (value: number) => String(value).padStart(2, "0");
const dayKey = (day: Date) =>
  `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

export interface CalendarMonthGridProps<Entry> {
  month: Date;
  events: readonly Entry[];
  now: Date;
  weekStartsOn: number;
  selected: string | null;
  /** Other events drawn as selected too. */
  alsoSelected?: readonly string[];
  onSelect: (id: string | null) => void;
  /** A double click or Return on an event: its element, for the popover. */
  onEventAction: (element: HTMLElement) => void;
  /** A click on a day of the month. */
  onDayClick: (day: Date) => void;
  /** A double click or Return on a day's number, or its "more" row: that day's own view. */
  onDayOpen: (day: Date) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  /** A day of the month's grid in the alternate calendar, while one shows. */
  alternateOf?: (day: Date) => string;
  /** The number of the week a day is in, while week numbers show. */
  weekNumberOf?: (day: Date) => number;
  children: React.ReactNode;
}

type MonthEntry = CalendarEntry & { color?: string };

/** The month's grid: whole weeks, each day with the events that fall on it. */
export function CalendarMonthGrid<Entry extends MonthEntry>({
  month,
  events,
  now,
  weekStartsOn,
  selected,
  alsoSelected,
  onSelect,
  onEventAction,
  onDayClick,
  onDayOpen,
  onPointerDown,
  alternateOf,
  weekNumberOf,
  children,
}: CalendarMonthGridProps<Entry>) {
  const days = monthGridDays(month, weekStartsOn);
  const root = useRef<HTMLDivElement>(null);
  // How many rows a day has room for, as the window is sized.
  const [fits, setFits] = useState(4);
  const measure = () => {
    const cell = root.current?.querySelector(".mac-calendar-month-cell");
    if (!cell?.clientHeight || !root.current) return;
    const style = getComputedStyle(root.current);
    const number = Number.parseFloat(style.getPropertyValue("--mac-calendar-month-day-height"));
    const row = Number.parseFloat(style.getPropertyValue("--mac-calendar-month-event-height"));
    if (number && row) setFits(Math.max(1, Math.floor((cell.clientHeight - number) / row)));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: a month of another number of weeks changes the cells' height.
  useLayoutEffect(measure, [days.length]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: measure reads only the element.
  useEffect(() => {
    if (!root.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mac-calendar-view mac-calendar-month" ref={root} onPointerDown={onPointerDown}>
      {children}
      <div className="mac-calendar-month-weekdays" aria-hidden="true">
        {days.slice(0, 7).map((day) => (
          <div key={day.getTime()}>{weekday.format(day)}</div>
        ))}
      </div>
      <div className="mac-calendar-month-rows">
        {days.map((day, at) => {
          const inMonth = day.getMonth() === month.getMonth();
          const today = sameDay(day, now);
          const onDay = eventsOnDay(events, day);
          const drawn = rowsOfDay(onDay, fits, selected);
          const overflow = drawn.length < onDay.length;
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut for the day number and events, which are buttons.
            // biome-ignore lint/a11y/useKeyWithClickEvents: see above.
            <div
              key={day.getTime()}
              className="mac-calendar-month-cell"
              data-day={dayKey(day)}
              data-weekend={day.getDay() % 6 ? undefined : ""}
              data-other-month={inMonth ? undefined : ""}
              onClick={(click) => {
                if (click.target instanceof Element && click.target.closest("[data-event-id]"))
                  return;
                onSelect(null);
                if (inMonth) onDayClick(day);
              }}
            >
              <div className="mac-calendar-month-day">
                {weekNumberOf && at % 7 === 0 ? (
                  <span className="mac-calendar-month-week-number">{`Week ${weekNumberOf(day)}`}</span>
                ) : null}
                {alternateOf ? (
                  <span className="mac-calendar-month-alternate">{alternateOf(day)}</span>
                ) : null}
                <button
                  type="button"
                  className="mac-calendar-month-number"
                  data-today={today ? "" : undefined}
                  aria-label={fullDay.format(day)}
                  aria-current={today ? "date" : undefined}
                  onDoubleClick={() => onDayOpen(day)}
                  onKeyDown={(key) => {
                    if (key.key !== "Enter") return;
                    key.preventDefault();
                    onDayOpen(day);
                  }}
                >
                  {day.getDate() === 1 ? `${shortMonth.format(day)} 1` : day.getDate()}
                </button>
              </div>
              {drawn.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="mac-calendar-month-event"
                  data-event-id={entry.id}
                  data-all-day={entry.allDay ? "" : undefined}
                  aria-pressed={entry.id === selected || alsoSelected?.includes(entry.id) === true}
                  aria-label={`${entry.title}, ${fullDay.format(entry.start)}${
                    entry.allDay ? "" : `, ${time.format(entry.start)}`
                  }`}
                  style={{ "--mac-calendar-month-event-color": entry.color } as CSSProperties}
                  onClick={() => onSelect(entry.id)}
                  onDoubleClick={(click) => onEventAction(click.currentTarget)}
                  onKeyDown={(key) => {
                    if (key.key !== "Enter" || key.defaultPrevented) return;
                    key.preventDefault();
                    onSelect(entry.id);
                    onEventAction(key.currentTarget);
                  }}
                >
                  <span className="mac-calendar-month-event-title">{entry.title}</span>
                  {entry.allDay ? null : (
                    <span className="mac-calendar-month-event-time">
                      {time.format(entry.start)}
                    </span>
                  )}
                </button>
              ))}
              {overflow ? (
                <button
                  type="button"
                  className="mac-calendar-month-more"
                  onClick={() => onDayOpen(day)}
                >
                  {onDay.length - drawn.length} more…
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
