"use client";

import {
  type ComponentProps,
  type KeyboardEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "./calendar-mini-month.tokens.css";
import "./calendar-mini-month.css";

export interface CalendarMiniMonthProps extends Omit<ComponentProps<"div">, "defaultValue"> {
  /** The selected day (controlled); `null` for none. Its time of day is ignored. */
  value?: Date | null;
  /**
   * The day selected at first (uncontrolled).
   * @default null
   */
  defaultValue?: Date | null;
  /** Called with the day the user chooses. */
  onValueChange?: (value: Date) => void;
  /** The month shown (controlled): any date in it. */
  month?: Date;
  /**
   * The month shown at first (uncontrolled): any date in it.
   * @default the month of the selected day, else of `today`, else the current month
   */
  defaultMonth?: Date;
  /** Called with the first day of the month the user goes to. */
  onMonthChange?: (month: Date) => void;
  /** Today: its number is drawn in the red disc. Without it no day is marked. */
  today?: Date;
  /**
   * The day a week starts on: 0 for Sunday to 6 for Saturday.
   * @default 0
   */
  weekStartsOn?: number;
  /**
   * The locale of the title and the weekday initials.
   * @default "en-US"
   */
  locale?: string;
  /**
   * Whether the chevrons that step through the months are shown. Without them the month is
   * changed from outside (`month`), and still by the keyboard and by choosing a day of a
   * neighbouring month.
   * @default true
   */
  navigation?: boolean;
  /**
   * The accessible name of the button that shows the month before.
   * @default "Previous month"
   */
  previousLabel?: string;
  /**
   * The accessible name of the button that shows the month after.
   * @default "Next month"
   */
  nextLabel?: string;
}

const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

const at = (date: Date, add = 0) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + add);

const key = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const same = (a: Date, b?: Date | null) => !!b && key(a) === key(b);

const chevron = (path: string) => (
  <svg width="6" height="10" viewBox="0 0 6 10" aria-hidden="true">
    <path d={path} fill="none" stroke="currentColor" strokeWidth="1.25" />
  </svg>
);

/**
 * The small month calendar at the foot of Calendar's sidebar: the month and year between two
 * chevrons, the initials of the weekdays and six weeks of days, with today in a red disc and
 * the days of the neighbouring months dimmed. Choosing a day selects it; Calendar then shows
 * that day.
 *
 * Base UI has no primitive for it. It is a grid of buttons: the arrow keys move between days and
 * into the months beside, Page Up and Page Down change the month, Home and End go to the ends of
 * the week. This is Calendar's own drawing, not the graphical date picker of AppKit.
 */
export function CalendarMiniMonth({
  value,
  defaultValue = null,
  onValueChange,
  month,
  defaultMonth,
  onMonthChange,
  today,
  weekStartsOn = 0,
  locale = "en-US",
  navigation = true,
  previousLabel = "Previous month",
  nextLabel = "Next month",
  className,
  ...props
}: CalendarMiniMonthProps) {
  const titleId = useId();
  const grid = useRef<HTMLDivElement>(null);
  const focusNext = useRef("");
  const [ownValue, setOwnValue] = useState(defaultValue);
  const selected = value === undefined ? ownValue : value;
  const [ownMonth, setOwnMonth] = useState(
    () => defaultMonth ?? value ?? defaultValue ?? today ?? new Date(),
  );
  // The day the keyboard was on last: the grid's tab stop while it is shown.
  const [active, setActive] = useState("");
  const shown = month ?? ownMonth;
  const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
  const dates = Array.from({ length: 42 }, (_, index) =>
    at(first, index - ((first.getDay() - weekStartsOn + 7) % 7)),
  );
  const inMonth = (date: Date) =>
    date.getMonth() === first.getMonth() && date.getFullYear() === first.getFullYear();
  // The one day in the tab order: the day the focus was on last, else the selected day, else
  // today, else the first of the month.
  const tabStop = dates.some((date) => key(date) === active)
    ? active
    : key([selected, today].find((date) => date && inMonth(date)) ?? first);

  const find = (date: Date) =>
    grid.current?.querySelector<HTMLElement>(`[data-date="${key(date)}"]`);

  // After a key or a click has asked for a day of another month, that day takes the focus once
  // its month is shown: at the next render, or later when the month's owner follows later.
  useLayoutEffect(() => {
    if (!focusNext.current) return;
    const day = grid.current?.querySelector<HTMLElement>(
      `[data-date="${focusNext.current}"]:not([data-outside])`,
    );
    if (!day) return;
    day.focus();
    focusNext.current = "";
  });

  const show = (date: Date) => {
    const next = new Date(date.getFullYear(), date.getMonth(), 1);
    if (next.getTime() === first.getTime()) return;
    if (month === undefined) setOwnMonth(next);
    onMonthChange?.(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = dates.findIndex(
      (date) => key(date) === (event.target as HTMLElement).dataset.date,
    );
    const from = dates[index];
    if (!from || event.metaKey || event.ctrlKey || event.altKey) return;
    const page = event.key === "PageUp" ? -1 : event.key === "PageDown" ? 1 : 0;
    let to: Date | undefined;
    if (STEPS[event.key]) to = at(from, STEPS[event.key]);
    else if (event.key === "Home") to = dates[index - (index % 7)];
    else if (event.key === "End") to = dates[index - (index % 7) + 6];
    else if (page) {
      // The same day of the next month, or its last day when it is shorter.
      const last = new Date(from.getFullYear(), from.getMonth() + page + 1, 0);
      to = new Date(last.getFullYear(), last.getMonth(), Math.min(from.getDate(), last.getDate()));
    }
    if (!to) return;
    event.preventDefault();
    // A day that is shown takes the focus at once; Page Up and Page Down always change the
    // month, unless they lead from a neighbouring month's day into the month shown.
    const day = !page || inMonth(to) ? find(to) : null;
    // A request that the month's owner has not followed ends with the next key or click.
    focusNext.current = day ? "" : key(to);
    if (day) day.focus();
    else show(to);
  };

  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const initial = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const full = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
  const weekend = (date: Date) => (date.getDay() % 6 ? undefined : "");

  return (
    <div
      className={className ? `mac-calendar-mini-month ${className}` : "mac-calendar-mini-month"}
      {...props}
    >
      <div className="mac-calendar-mini-month-header">
        {navigation ? (
          <button
            type="button"
            className="mac-calendar-mini-month-step"
            aria-label={previousLabel}
            onClick={() => show(at(first, -1))}
          >
            {chevron("M4.75.75 1 5l3.75 4.25")}
          </button>
        ) : null}
        <div id={titleId} className="mac-calendar-mini-month-title" aria-live="polite">
          {title.format(first)}
        </div>
        {navigation ? (
          <button
            type="button"
            className="mac-calendar-mini-month-step"
            aria-label={nextLabel}
            onClick={() => show(at(first, 31))}
          >
            {chevron("M1.25.75 5 5 1.25 9.25")}
          </button>
        ) : null}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: a grid of buttons with its own keys, not a table of data */}
      <div
        ref={grid}
        role="grid"
        aria-labelledby={titleId}
        className="mac-calendar-mini-month-grid"
        onKeyDown={onKeyDown}
        onFocus={(event) => setActive((event.target as HTMLElement).dataset.date ?? active)}
      >
        {/* biome-ignore lint/a11y/useFocusableInteractive: a row of headers takes no focus */}
        {/* biome-ignore lint/a11y/useSemanticElements: see the grid */}
        <div role="row" className="mac-calendar-mini-month-row">
          {dates.slice(0, 7).map((date) => (
            // biome-ignore lint/a11y/useSemanticElements: see the grid
            // biome-ignore lint/a11y/useFocusableInteractive: a header takes no focus
            <div
              key={date.getDay()}
              role="columnheader"
              aria-label={weekday.format(date)}
              className="mac-calendar-mini-month-weekday"
              data-weekend={weekend(date)}
            >
              {initial.format(date)}
            </div>
          ))}
        </div>
        {[0, 7, 14, 21, 28, 35].map((week) => (
          // biome-ignore lint/a11y/useSemanticElements: see the grid
          // biome-ignore lint/a11y/useFocusableInteractive: the days in the row take the focus
          <div key={week} role="row" className="mac-calendar-mini-month-row">
            {dates.slice(week, week + 7).map((date) => (
              // biome-ignore lint/a11y/useSemanticElements: see the grid
              // biome-ignore lint/a11y/useFocusableInteractive: the button inside takes the focus
              <div key={key(date)} role="gridcell" aria-selected={same(date, selected)}>
                <button
                  type="button"
                  tabIndex={key(date) === tabStop ? 0 : -1}
                  className="mac-calendar-mini-month-day"
                  data-date={key(date)}
                  data-outside={inMonth(date) ? undefined : ""}
                  data-weekend={weekend(date)}
                  data-today={same(date, today) ? "" : undefined}
                  data-selected={same(date, selected) ? "" : undefined}
                  aria-current={same(date, today) ? "date" : undefined}
                  aria-label={full.format(date)}
                  onClick={() => {
                    if (value === undefined) setOwnValue(date);
                    onValueChange?.(date);
                    // A day of a neighbouring month keeps the focus when its month is shown.
                    focusNext.current = inMonth(date) ? "" : key(date);
                    show(date);
                  }}
                >
                  {date.getDate()}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
