import { type CalendarEntry, dayAt, describe } from "./calendar-data";
import { eventsOnDay, monthGridDays } from "./calendar-month-grid";

/** What File > Print gives the browser: the events of the days shown, soonest first, with their details. */
export function agendaLines(
  shown: readonly CalendarEntry[],
  from: Date,
  until: Date,
): readonly string[] {
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });
  const last = new Date(until.getTime() - 1);
  const heading =
    day.format(from) === day.format(last)
      ? day.format(from)
      : `${day.format(from)} to ${day.format(last)}`;
  const ordered = [...shown].sort((a, b) => a.start.getTime() - b.start.getTime());
  if (ordered.length === 0) return [heading, "", "No events."];
  return [
    heading,
    ...ordered.flatMap((entry) => [
      "",
      entry.title,
      describe(entry),
      ...(entry.location ? [entry.location] : []),
      ...(entry.notes ? entry.notes.split("\n") : []),
    ]),
  ];
}

/** What File > Print draws. */
export type PrintView = "day" | "week" | "month" | "list";
export type PrintSize = "small" | "medium" | "big";

export interface PrintOptions {
  view: PrintView;
  /** The first day printed. */
  from: Date;
  /** The day after the last one printed. */
  until: Date;
  weekStartsOn: number;
  allDay: boolean;
  timed: boolean;
  miniCalendar: boolean;
  keys: boolean;
  blackAndWhite: boolean;
  textSize: PrintSize;
}

export interface PrintCalendar {
  id: string;
  name: string;
  color?: string;
}

const midnight = (at: Date) => new Date(at.getFullYear(), at.getMonth(), at.getDate());
const daysBetween = (from: Date, until: Date) =>
  Math.round((until.getTime() - from.getTime()) / 86_400_000);
const weekOf = (at: Date, weekStartsOn: number) =>
  dayAt(midnight(at), -((at.getDay() - weekStartsOn + 7) % 7));

/**
 * The days a view prints for the dates chosen, whole weeks for a week and whole months for a month:
 * the first, and the day after the last.
 */
export function printSpan(
  view: PrintView,
  starts: Date,
  ends: Date,
  weekStartsOn: number,
): [Date, Date] {
  const start = midnight(starts);
  const last = midnight(ends) < start ? start : midnight(ends);
  if (view === "week") {
    const first = weekOf(start, weekStartsOn);
    return [first, dayAt(first, Math.ceil((daysBetween(first, last) + 1) / 7) * 7)];
  }
  if (view === "month") {
    return [
      new Date(start.getFullYear(), start.getMonth(), 1),
      new Date(last.getFullYear(), last.getMonth() + 1, 1),
    ];
  }
  return [start, dayAt(last, 1)];
}

const HOUR_POINTS = 22;
const TEXT_SIZES: Record<PrintSize, number> = { small: 9, medium: 11, big: 14 };

const escaped = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STYLE =
  ".cal{break-after:page;white-space:normal}.cal:last-child{break-after:auto}" +
  ".cal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:8px}" +
  ".cal h1{margin:0;font-size:1.6em;font-weight:600}" +
  ".cal-keys{margin:4px 0 8px;display:flex;flex-wrap:wrap;gap:4px 12px}" +
  ".cal-key::before{content:'';display:inline-block;width:.7em;height:.7em;margin-right:4px;background:var(--c);border:1px solid #000}" +
  ".cal-mini{width:auto;font-size:.7em;text-align:center}.cal-mini td{border:0;padding:0 3px}" +
  ".cal-event{overflow:hidden;font-size:.9em}" +
  ".cal-color .cal-event{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:var(--c);color:#fff}" +
  ".cal-plain .cal-event{border:1px solid #000;color:#000;background:#fff}" +
  ".cal-month td{height:6em}.cal-day-name{font-weight:600}" +
  ".cal-days{display:flex}.cal-hours{width:3.5em;flex:none}.cal-hour{box-sizing:border-box;border-top:1px solid #999;font-size:.8em}" +
  ".cal-column{position:relative;flex:1 1 0;min-width:0;border-left:1px solid #999}" +
  ".cal-line{position:absolute;inset-inline:0;border-top:1px solid #ccc}" +
  ".cal-column .cal-event{position:absolute;box-sizing:border-box;padding:0 2px}" +
  ".cal-names{display:flex;margin-left:3.5em}.cal-names>div{flex:1 1 0;min-width:0;padding:0 2px;border-left:1px solid #999}" +
  ".cal-list p{margin:0 0 .5em}";

const dayName = (at: Date, style: Intl.DateTimeFormatOptions) =>
  at.toLocaleDateString("en-US", style);
const timeName = (at: Date) =>
  at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Lanes for events that overlap, so that each stays legible: each event's lane and how many. */
function lanes(
  entries: readonly CalendarEntry[],
): Map<CalendarEntry, { lane: number; of: number }> {
  const placed = new Map<CalendarEntry, { lane: number; of: number }>();
  const ordered = [...entries].sort((a, b) => a.start.getTime() - b.start.getTime());
  let cluster: CalendarEntry[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    const ends: number[] = [];
    for (const entry of cluster) {
      const free = ends.findIndex((end) => end <= entry.start.getTime());
      const lane = free === -1 ? ends.length : free;
      ends[lane] = entry.end.getTime();
      placed.set(entry, { lane, of: 1 });
    }
    for (const entry of cluster) {
      const found = placed.get(entry);
      if (found) found.of = ends.length;
    }
    cluster = [];
  };
  for (const entry of ordered) {
    if (entry.start.getTime() >= clusterEnd) {
      close();
      clusterEnd = -Infinity;
    }
    cluster.push(entry);
    clusterEnd = Math.max(clusterEnd, entry.end.getTime());
  }
  close();
  return placed;
}

/**
 * The pages of File > Print, as HTML for the print frame: a page for each day, week or month, or one
 * list. Calendars' colours are CSS colour names, which the frame reads without the window's tokens.
 */
export function printHtml(
  shown: readonly CalendarEntry[],
  calendars: readonly PrintCalendar[],
  options: PrintOptions,
): string {
  const { view, from, until, weekStartsOn, textSize } = options;
  const colorOf = (entry: CalendarEntry) => {
    const named = calendars.find(({ id }) => id === entry.calendar)?.color;
    return named && /^[a-z]+$/.test(named) ? named : "gray";
  };
  const kept = shown.filter((entry) => (entry.allDay ? options.allDay : options.timed));
  const on = (day: Date) => eventsOnDay(kept, day);
  const block = (entry: CalendarEntry, label: string, style = "") =>
    `<div class="cal-event" style="--c:${colorOf(entry)};${style}">${escaped(label)}</div>`;
  const labelOf = (entry: CalendarEntry) =>
    entry.allDay ? entry.title : `${timeName(entry.start)} ${entry.title}`;
  const keys =
    options.keys && calendars.length > 0
      ? `<div class="cal-keys">${calendars
          .map(
            (calendar) =>
              `<span class="cal-key" style="--c:${
                options.blackAndWhite
                  ? "#fff"
                  : /^[a-z]+$/.test(calendar.color ?? "")
                    ? calendar.color
                    : "gray"
              }">${escaped(calendar.name)}</span>`,
          )
          .join("")}</div>`
      : "";
  const mini = (at: Date) => {
    if (!options.miniCalendar) return "";
    const days = monthGridDays(at, weekStartsOn);
    const weeks = Array.from({ length: days.length / 7 }, (_, row) =>
      days.slice(row * 7, row * 7 + 7),
    );
    const rows = weeks.map(
      (week) =>
        `<tr>${week
          .map((day) => `<td>${day.getMonth() === at.getMonth() ? day.getDate() : ""}</td>`)
          .join("")}</tr>`,
    );
    return `<table class="cal-mini" data-border="0"><caption>${escaped(dayName(at, { month: "long", year: "numeric" }))}</caption>${rows.join("")}</table>`;
  };
  const page = (heading: string, content: string) =>
    `<section class="cal"><div class="cal-head"><h1>${escaped(heading)}</h1>${mini(from)}</div>${keys}${content}</section>`;

  const hoursGrid = (days: readonly Date[]) => {
    const names = days.map((day) => {
      const allDay = on(day).filter((entry) => entry.allDay);
      return `<div><div class="cal-day-name">${escaped(`${dayName(day, { weekday: "short" })} ${day.getDate()}`)}</div>${allDay
        .map((entry) => block(entry, entry.title))
        .join("")}</div>`;
    });
    const hours = Array.from(
      { length: 24 },
      (_, hour) =>
        `<div class="cal-hour" style="height:${HOUR_POINTS}pt">${escaped(timeName(new Date(2000, 0, 1, hour)).replace(":00", ""))}</div>`,
    ).join("");
    const lines = Array.from(
      { length: 24 },
      (_, hour) => `<div class="cal-line" style="top:${hour * HOUR_POINTS}pt"></div>`,
    ).join("");
    const columns = days.map((day) => {
      const next = dayAt(day, 1);
      const timed = on(day).filter((entry) => !entry.allDay);
      const placed = lanes(timed);
      const blocks = timed.map((entry) => {
        const start = entry.start < day ? day : entry.start;
        const end = entry.end > next ? next : entry.end;
        const top = ((start.getTime() - day.getTime()) / 3_600_000) * HOUR_POINTS;
        const height = Math.max(
          ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_POINTS,
          HOUR_POINTS / 2,
        );
        const { lane, of } = placed.get(entry) ?? { lane: 0, of: 1 };
        return block(
          entry,
          labelOf(entry),
          `top:${top}pt;height:${height}pt;left:${(lane / of) * 100}%;width:${100 / of}%`,
        );
      });
      return `<div class="cal-column" style="height:${24 * HOUR_POINTS}pt">${lines}${blocks.join("")}</div>`;
    });
    return `<div class="cal-names">${names.join("")}</div><div class="cal-days"><div class="cal-hours">${hours}</div>${columns.join("")}</div>`;
  };

  const pages: string[] = [];
  if (view === "list") {
    const days = Array.from({ length: daysBetween(from, until) }, (_, at) => dayAt(from, at));
    const items = days.flatMap((day) => {
      const events = on(day);
      if (events.length === 0) return [];
      return [
        `<h2>${escaped(dayName(day, { dateStyle: "full" }))}</h2>`,
        ...events.map(
          (entry) =>
            `<p>${block(entry, labelOf(entry))}${entry.location ? `${escaped(entry.location)}<br>` : ""}${entry.notes ? escaped(entry.notes) : ""}</p>`,
        ),
      ];
    });
    pages.push(
      page(
        agendaLines([], from, until)[0] ?? "",
        `<div class="cal-list">${items.join("") || "<p>No events.</p>"}</div>`,
      ),
    );
  } else if (view === "month") {
    for (
      let month = new Date(from.getFullYear(), from.getMonth(), 1);
      month < until;
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    ) {
      const days = monthGridDays(month, weekStartsOn);
      const head = days
        .slice(0, 7)
        .map(
          (day) => `<td class="cal-day-name">${escaped(dayName(day, { weekday: "short" }))}</td>`,
        )
        .join("");
      const rows = Array.from({ length: days.length / 7 }, (_, row) =>
        days
          .slice(row * 7, row * 7 + 7)
          .map(
            (day) =>
              `<td><div>${day.getDate()}</div>${on(day)
                .map((entry) => block(entry, labelOf(entry)))
                .join("")}</td>`,
          )
          .join(""),
      );
      pages.push(
        page(
          dayName(month, { month: "long", year: "numeric" }),
          `<table class="cal-month"><tr>${head}</tr>${rows.map((row) => `<tr>${row}</tr>`).join("")}</table>`,
        ),
      );
    }
  } else {
    const step = view === "week" ? 7 : 1;
    for (let first = from; first < until; first = dayAt(first, step)) {
      const days = Array.from({ length: step }, (_, at) => dayAt(first, at));
      const heading =
        view === "week"
          ? (agendaLines([], first, dayAt(first, 7))[0] ?? "")
          : dayName(first, { dateStyle: "full" });
      pages.push(page(heading, hoursGrid(days)));
    }
  }
  const look = options.blackAndWhite ? "cal-plain" : "cal-color";
  return `<style>${STYLE}</style><div class="${look}" style="font-size:${TEXT_SIZES[textSize]}pt">${pages.join("")}</div>`;
}
