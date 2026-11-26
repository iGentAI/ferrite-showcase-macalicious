"use client";

import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ScrollView } from "../scroll-view";
import "./calendar-week-grid.tokens.css";
import "./calendar-week-grid.css";

/** One event of a `CalendarWeekGrid`. */
export interface CalendarWeekGridEvent {
  /** Identifies the event in the grid's `value`. */
  id: string;
  /** The event's name. */
  title: string;
  /** When it starts, in local time. */
  start: Date;
  /** When it ends, in local time; an event that ends at midnight does not reach the next day. */
  end: Date;
  /** An all-day event is drawn in the all-day row, across the days from `start` to `end`. */
  allDay?: boolean;
  /** The colour of its calendar: any CSS colour. Without it the grid's default colour. */
  color?: string;
}

export interface CalendarWeekGridProps extends Omit<ComponentProps<"div">, "defaultValue"> {
  /** The first day shown; its time of day is ignored. */
  start: Date;
  /**
   * How many days are shown, one column each: 7 for a week, 1 for a day.
   * @default 7
   */
  days?: number;
  /**
   * The events. Those outside the days shown are left out.
   * @default []
   */
  events?: readonly CalendarWeekGridEvent[];
  /**
   * The current time. Its day's number is drawn in the red disc, and the red current-time line
   * crosses the grid while that day is shown. The grid runs no clock: pass a new date to move
   * the line.
   */
  now?: Date;
  /** The `id` of the selected event (controlled); `null` for none. */
  value?: string | null;
  /** The `id`s of other events drawn as selected too, with `value` the one its keys act on. */
  alsoSelected?: readonly string[];
  /**
   * The `id` of the event selected at first (uncontrolled).
   * @default null
   */
  defaultValue?: string | null;
  /** Called with the `id` of the event the user selects, or `null` when the selection is cleared. */
  onValueChange?: (value: string | null) => void;
  /**
   * Called when an event is double-clicked or Return is pressed on it, with the event and its
   * element. Calendar shows the event's popover then: the element is its anchor.
   */
  onEventAction?: (event: CalendarWeekGridEvent, element: HTMLElement) => void;
  /**
   * Height of one hour, in points.
   * @default 40
   */
  hourHeight?: number;
  /**
   * The hour at the top edge of the grid when it is first shown and whenever this value or
   * `hourHeight` changes; fractions are allowed.
   * @default 8
   */
  defaultScrollHour?: number;
  /** Content at the trailing end of the title row: Calendar's previous, Today and next control. */
  accessory?: ReactNode;
  /**
   * The locale of the month, the year and the weekday names.
   * @default "en-US"
   */
  locale?: string;
  /**
   * Formats a time of day: the gutter's hours, an event's start and the current time.
   * @default 12-hour clock: "8 AM", "4:45 PM"
   */
  formatTime?: (date: Date) => string;
  /**
   * The label of the all-day row.
   * @default "all-day"
   */
  allDayLabel?: ReactNode;
  /**
   * The gutter's label for 12 o'clock, in place of the formatted time. Pass `null` to format it
   * like the other hours.
   * @default "Noon"
   */
  noonLabel?: ReactNode;
}

interface Segment {
  event: CalendarWeekGridEvent;
  from: number;
  to: number;
  lane?: number;
  of?: number;
}

const midnight = (date: Date, add = 0) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + add);

const minutes = (date: Date) => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

// "2 PM", "4:45 PM": the space is a plain one, whatever the engine's data has there.
const clock = (date: Date) =>
  date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(":00", "")
    .replace(/\s/, " ");

// Events that overlap share the column's width: each takes one lane of its cluster.
function pack(segments: Segment[] = []) {
  segments.sort((a, b) => a.from - b.from || b.to - a.to);
  let cluster: Segment[] = [];
  let ends: number[] = [];
  let until = 0;
  for (const segment of segments) {
    if (segment.from >= until) {
      cluster = [];
      ends = [];
    }
    let lane = ends.findIndex((end) => end <= segment.from);
    if (lane < 0) lane = ends.length;
    ends[lane] = segment.to;
    segment.lane = lane;
    cluster.push(segment);
    until = Math.max(until, segment.to);
    for (const member of cluster) member.of = ends.length;
  }
  return segments;
}

/** Calendar's week view: a column per day over the scrolling hours, with the events. */
export function CalendarWeekGrid({
  start,
  days = 7,
  events = [],
  now,
  value,
  alsoSelected,
  defaultValue = null,
  onValueChange,
  onEventAction,
  hourHeight = 40,
  defaultScrollHour = 8,
  accessory,
  locale = "en-US",
  formatTime = clock,
  allDayLabel = "all-day",
  noonLabel = "Noon",
  className,
  style,
  ...props
}: CalendarWeekGridProps) {
  const titleId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const [own, setOwn] = useState(defaultValue);
  const selected = value === undefined ? own : value;

  const first = midnight(start);
  const dates = Array.from({ length: days }, (_, index) => midnight(first, index));
  // Rounded: a day is 23 or 25 hours long where the clocks change.
  const dayOf = (date: Date) => Math.round((midnight(date).getTime() - first.getTime()) / 864e5);
  // Half points: AppKit puts the lines on device pixels of a 2x display.
  const y = (minute: number) => Math.round((minute / 30) * hourHeight) / 2;

  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = Math.round(defaultScrollHour * hourHeight);
  }, [defaultScrollHour, hourHeight]);

  const select = (id: string | null) => {
    if (id === selected) return;
    if (value === undefined) setOwn(id);
    onValueChange?.(id);
  };
  // A click beside the events, in the hours or in the all-day row, clears the selection.
  const clear = (event: { target: EventTarget }) => {
    if (!(event.target as Element).closest(".mac-calendar-week-grid-event")) select(null);
  };

  const timed: Segment[][] = dates.map(() => []);
  const allDay: Segment[] = [];
  for (const event of events) {
    const from = dayOf(event.start);
    const to = dayOf(new Date(Math.max(event.end.getTime() - 1, event.start.getTime())));
    const lo = Math.max(from, 0);
    const hi = Math.min(to, days - 1);
    if (lo > hi) continue;
    if (event.allDay) allDay.push({ event, from: lo, to: hi });
    else
      for (let day = lo; day <= hi; day++)
        timed[day]?.push({
          event,
          from: day === from ? minutes(event.start) : 0,
          // Midnight ends the day before, unless the event is over when it starts.
          to:
            day < to || (event.end > event.start && !minutes(event.end))
              ? 1440
              : minutes(event.end),
        });
  }

  const today = now ? dayOf(now) : -1;
  // Negative while the current time is not shown.
  const nowTop = now && today >= 0 && today < days ? y(minutes(now)) : -99;
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options);
  const month = format({ month: "long" });
  const weekday = format({ weekday: "short" });
  const fullDay = format({ dateStyle: "full" });
  const middle = dates[days >> 1] ?? first;

  const block = (event: CalendarWeekGridEvent, position: CSSProperties) => {
    const act = (action: { currentTarget: HTMLElement }) =>
      onEventAction?.(event, action.currentTarget);
    return (
      <button
        key={event.id}
        type="button"
        className="mac-calendar-week-grid-event"
        data-event-id={event.id}
        aria-pressed={event.id === selected || alsoSelected?.includes(event.id) === true}
        aria-label={`${event.title}, ${fullDay.format(event.start)}${
          event.allDay ? "" : `, ${formatTime(event.start)} – ${formatTime(event.end)}`
        }`}
        style={
          { "--mac-calendar-week-grid-event-color": event.color, ...position } as CSSProperties
        }
        onClick={() => select(event.id)}
        onDoubleClick={act}
        // Return selects the event and acts on it. The click a browser makes of Return is
        // cancelled: it would come after the action, outside the popover the action opened,
        // and dismiss it.
        onKeyDown={(action) => {
          if (action.key !== "Enter" || action.defaultPrevented) return;
          action.preventDefault();
          select(event.id);
          act(action);
        }}
      >
        {event.allDay ? null : (
          <span className="mac-calendar-week-grid-event-time">{formatTime(event.start)}</span>
        )}
        {event.title}
      </button>
    );
  };

  const weekend = (date: Date) => (date.getDay() % 6 ? undefined : "");

  return (
    <div
      className={className ? `mac-calendar-week-grid ${className}` : "mac-calendar-week-grid"}
      style={{ "--_days": days, "--_height": `${24 * hourHeight}px`, ...style } as CSSProperties}
      {...props}
    >
      <div className="mac-calendar-week-grid-header">
        <h2 id={titleId} className="mac-calendar-week-grid-title">
          <span className="mac-calendar-week-grid-month">{month.format(middle)}</span>{" "}
          {middle.getFullYear()}
        </h2>
        {accessory}
      </div>
      <div className="mac-calendar-week-grid-days">
        {dates.map((date, index) => (
          <div
            key={date.getTime()}
            className="mac-calendar-week-grid-day"
            data-weekend={weekend(date)}
            aria-current={index === today ? "date" : undefined}
          >
            {weekday.format(date)}{" "}
            <span className="mac-calendar-week-grid-day-number">{date.getDate()}</span>
          </div>
        ))}
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut; the selection is also cleared by selecting another event */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: see above */}
      <div className="mac-calendar-week-grid-all-day" onClick={clear}>
        <div className="mac-calendar-week-grid-cells">
          {dates.map((date) => (
            <div
              key={date.getTime()}
              className="mac-calendar-week-grid-cell"
              data-weekend={weekend(date)}
            />
          ))}
        </div>
        <div className="mac-calendar-week-grid-all-day-label">{allDayLabel}</div>
        {allDay.map(({ event, from, to }) =>
          block(event, { gridColumn: `${from + 2} / ${to + 3}` }),
        )}
      </div>
      <ScrollView
        className="mac-calendar-week-grid-scroll"
        viewportProps={{
          ref: viewport,
          role: "group",
          tabIndex: 0,
          "aria-labelledby": titleId,
          onClick: clear,
        }}
      >
        <div className="mac-calendar-week-grid-body">
          {dates.map((date, index) => (
            <div
              key={date.getTime()}
              className="mac-calendar-week-grid-column"
              data-weekend={weekend(date)}
            >
              {pack(timed[index]).map(({ event, from, to, lane = 0, of = 1 }) =>
                block(event, {
                  top: y(from) + 2,
                  height: Math.max(y(to - from) - 2, 0),
                  insetInlineStart: `${(lane / of) * 100}%`,
                  width: `${100 / of}%`,
                }),
              )}
              {index === today && nowTop >= 0 ? (
                <div className="mac-calendar-week-grid-now-dot" style={{ top: nowTop }} />
              ) : null}
            </div>
          ))}
          <div className="mac-calendar-week-grid-hours">
            {Array.from({ length: 23 }, (_, index) => {
              const hour = index + 1;
              const top = y(hour * 60);
              return (
                <div key={hour} className="mac-calendar-week-grid-hour" style={{ top }}>
                  {/* The current time's label takes the place of an hour's that it would touch. */}
                  {Math.abs(nowTop - top) < 13
                    ? null
                    : (hour === 12 && noonLabel) || formatTime(new Date(2001, 0, 1, hour))}
                </div>
              );
            })}
            {now && nowTop >= 0 ? (
              <div className="mac-calendar-week-grid-now" style={{ top: nowTop }}>
                {formatTime(now)}
              </div>
            ) : null}
          </div>
        </div>
      </ScrollView>
    </div>
  );
}
