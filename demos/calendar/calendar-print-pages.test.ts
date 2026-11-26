import { expect, it, describe as suite } from "vitest";
import type { CalendarEntry } from "./calendar-data";
import { type PrintOptions, printHtml, printSpan } from "./calendar-print";

const entry = (title: string, more: Partial<CalendarEntry> = {}): CalendarEntry =>
  ({
    id: title,
    title,
    calendar: "home",
    start: new Date(2026, 10, 3, 9),
    end: new Date(2026, 10, 3, 10),
    ...more,
  }) as CalendarEntry;

const options = (more: Partial<PrintOptions>): PrintOptions => ({
  view: "week",
  from: new Date(2026, 10, 1),
  until: new Date(2026, 10, 8),
  weekStartsOn: 0,
  allDay: true,
  timed: true,
  miniCalendar: false,
  keys: false,
  blackAndWhite: false,
  textSize: "medium",
  ...more,
});

const HOME = [{ id: "home", name: "Home", color: "blue" }];

suite("the pages File > Print draws", () => {
  it("draws a week as a grid with the event at its hour", () => {
    const html = printHtml([entry("Standup")], HOME, options({}));
    expect(html).toContain("Sun 1");
    expect(html).toContain("Sat 7");
    expect(html).toContain("top:198pt;height:22pt;left:0%;width:100%");
    expect(html).toContain("9:00 AM Standup");
    expect(html).toContain("--c:blue");
  });

  it("draws a page for each month, whole", () => {
    const html = printHtml(
      [entry("Standup")],
      HOME,
      options({
        view: "month",
        from: new Date(2026, 10, 1),
        until: new Date(2027, 0, 1),
      }),
    );
    expect(html.match(/<section class="cal">/g)).toHaveLength(2);
    expect(html).toContain("<h1>November 2026</h1>");
    expect(html).toContain("<h1>December 2026</h1>");
  });

  it("keeps out what its options leave out", () => {
    const events = [
      entry("Timed"),
      entry("Fair", { allDay: true, start: new Date(2026, 10, 3), end: new Date(2026, 10, 4) }),
    ];
    const noTimed = printHtml(events, HOME, options({ timed: false }));
    expect(noTimed).toContain("Fair");
    expect(noTimed).not.toContain("Timed");
    const noAllDay = printHtml(events, HOME, options({ allDay: false }));
    expect(noAllDay).toContain("Timed");
    expect(noAllDay).not.toContain("Fair");
  });

  it("adds the calendar keys and mini calendar when asked, and prints black and white", () => {
    const plain = printHtml([entry("A")], HOME, options({}));
    expect(plain).not.toContain('class="cal-key"');
    expect(plain).not.toContain("<caption>");
    const full = printHtml(
      [entry("A")],
      HOME,
      options({ keys: true, miniCalendar: true, blackAndWhite: true, textSize: "big" }),
    );
    expect(full).toContain('class="cal-key" style="--c:#fff">Home</span>');
    expect(full).toContain("<caption>November 2026</caption>");
    expect(full).toContain('class="cal-plain" style="font-size:14pt"');
  });

  it("lists a day's events with where and what, and escapes them", () => {
    const html = printHtml(
      [entry("<Pier>", { location: "Dock & 4", notes: "rope" })],
      HOME,
      options({ view: "list" }),
    );
    expect(html).toContain("&lt;Pier&gt;");
    expect(html).toContain("Dock &amp; 4");
    expect(html).toContain("rope");
    expect(html).toContain("<h2>Tuesday, November 3, 2026</h2>");
  });

  it("puts overlapping events side by side", () => {
    const html = printHtml(
      [
        entry("One"),
        entry("Two", {
          start: new Date(2026, 10, 3, 9, 30),
          end: new Date(2026, 10, 3, 11),
        }),
      ],
      HOME,
      options({}),
    );
    expect(html).toContain("left:0%;width:50%");
    expect(html).toContain("left:50%;width:50%");
  });
});

suite("the days a print covers", () => {
  const wed = new Date(2026, 10, 4);
  it("takes whole weeks", () => {
    expect(printSpan("week", wed, new Date(2026, 10, 12), 0)).toEqual([
      new Date(2026, 10, 1),
      new Date(2026, 10, 15),
    ]);
  });
  it("takes whole months", () => {
    expect(printSpan("month", wed, wed, 0)).toEqual([new Date(2026, 10, 1), new Date(2026, 11, 1)]);
  });
  it("never ends before it starts", () => {
    expect(printSpan("day", wed, new Date(2026, 9, 1), 0)).toEqual([wed, new Date(2026, 10, 5)]);
  });
});
