import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CalendarEntry } from "./calendar-data";
import {
  describeRepeat,
  movedExdates,
  movedSeries,
  nextOccurrence,
  occurrenceId,
  occurrences,
  seriesOf,
  seriesStartFor,
  shiftLocal,
} from "./calendar-recurrence";

const standup = (
  repeat: CalendarEntry["repeat"],
  extra: Partial<CalendarEntry> = {},
): CalendarEntry => ({
  id: "standup",
  title: "Standup",
  // Tuesday 1 October 2019, 9:30 to 9:45, local time.
  start: new Date(2019, 9, 1, 9, 30),
  end: new Date(2019, 9, 1, 9, 45),
  calendar: "work",
  repeat,
  ...extra,
});

const starts = (entries: CalendarEntry[]) => entries.map((entry) => entry.start.toDateString());

describe("repeating events", () => {
  it("lists a single event once, while it reaches into the range", () => {
    const single = standup(undefined);
    expect(occurrences(single, new Date(2019, 9, 1), new Date(2019, 9, 2))).toEqual([single]);
    expect(occurrences(single, new Date(2019, 9, 2), new Date(2019, 9, 3))).toEqual([]);
  });

  it("repeats daily, keeping the time of day across a change of daylight saving time", () => {
    // Thirty days from 20 October cross the end of daylight saving time in Europe and America.
    const daily = {
      ...standup({ freq: "daily" }),
      start: new Date(2019, 9, 20, 9, 30),
      end: new Date(2019, 9, 20, 9, 45),
    };
    const month = occurrences(daily, new Date(2019, 9, 20), new Date(2019, 10, 19));
    expect(month).toHaveLength(30);
    expect(
      new Set(month.map((entry) => `${entry.start.getHours()}:${entry.start.getMinutes()}`)),
    ).toEqual(new Set(["9:30"]));
    expect(
      month.every((entry) => entry.end.getTime() - entry.start.getTime() === 15 * 60_000),
    ).toBe(true);
    expect(month[0]?.id).toBe(occurrenceId("standup", month[0]?.start ?? 0));
    expect(month[0]?.series).toBe("standup");
    expect(seriesOf(month[3]?.id ?? "")).toBe("standup");
  });

  it("repeats weekly on the chosen days, every so many weeks", () => {
    const twiceWeekly = standup({ freq: "weekly", days: [4, 2] });
    expect(starts(occurrences(twiceWeekly, new Date(2019, 9, 1), new Date(2019, 9, 15)))).toEqual([
      "Tue Oct 01 2019",
      "Thu Oct 03 2019",
      "Tue Oct 08 2019",
      "Thu Oct 10 2019",
    ]);
    const fortnightly = standup({ freq: "weekly", interval: 2 });
    expect(starts(occurrences(fortnightly, new Date(2019, 9, 1), new Date(2019, 10, 1)))).toEqual([
      "Tue Oct 01 2019",
      "Tue Oct 15 2019",
      "Tue Oct 29 2019",
    ]);
  });

  it("skips months without the day and years without 29 February", () => {
    const monthly = {
      ...standup({ freq: "monthly" }),
      start: new Date(2019, 0, 31, 9),
      end: new Date(2019, 0, 31, 10),
    };
    expect(starts(occurrences(monthly, new Date(2019, 0, 1), new Date(2019, 5, 1)))).toEqual([
      "Thu Jan 31 2019",
      "Sun Mar 31 2019",
      "Fri May 31 2019",
    ]);
    const leap = {
      ...standup({ freq: "yearly" }),
      start: new Date(2020, 1, 29, 9),
      end: new Date(2020, 1, 29, 10),
    };
    expect(starts(occurrences(leap, new Date(2020, 0, 1), new Date(2029, 0, 1)))).toEqual([
      "Sat Feb 29 2020",
      "Thu Feb 29 2024",
      "Tue Feb 29 2028",
    ]);
  });

  it("ends after a count or at a date, and leaves out removed occurrences", () => {
    const counted = standup(
      { freq: "daily", count: 3 },
      { exdates: [new Date(2019, 9, 2, 9, 30).getTime()] },
    );
    // The removed one still counts, as in iCalendar.
    expect(starts(occurrences(counted, new Date(2019, 9, 1), new Date(2019, 10, 1)))).toEqual([
      "Tue Oct 01 2019",
      "Thu Oct 03 2019",
    ]);
    const until = standup({ freq: "daily", until: new Date(2019, 9, 2, 23, 59).getTime() });
    expect(occurrences(until, new Date(2019, 9, 1), new Date(2019, 10, 1))).toHaveLength(2);
  });

  it("keeps an all-day event whole days long", () => {
    const birthday: CalendarEntry = {
      id: "bday",
      title: "Birthday",
      start: new Date(2019, 2, 30),
      end: new Date(2019, 2, 31),
      allDay: true,
      calendar: "home",
      repeat: { freq: "yearly" },
    };
    const [next] = occurrences(birthday, new Date(2020, 0, 1), new Date(2021, 0, 1));
    expect(next?.start).toEqual(new Date(2020, 2, 30));
    expect(next?.end).toEqual(new Date(2020, 2, 31));
  });

  it("finds the next occurrence for the search results", () => {
    const weekly = standup({ freq: "weekly" });
    expect(nextOccurrence(weekly, new Date(2019, 9, 9).getTime())).toEqual(
      new Date(2019, 9, 15, 9, 30),
    );
    const ended = standup({ freq: "weekly", count: 2 });
    expect(nextOccurrence(ended, new Date(2020, 0, 1).getTime())).toEqual(
      new Date(2019, 9, 8, 9, 30),
    );
    // Ended at a date long ago: its last occurrence, not its first.
    const until = standup({ freq: "daily", until: new Date(2019, 9, 10, 23, 59).getTime() });
    expect(nextOccurrence(until, new Date(2021, 0, 1).getTime())).toEqual(
      new Date(2019, 9, 10, 9, 30),
    );
  });

  it("finds the occurrences of a long event that began before the days shown", () => {
    // Every day, each a week long: on 20 October the ones begun from the 13th still last.
    const long = standup({ freq: "daily" }, { end: new Date(2019, 9, 8, 9, 30) });
    const day = occurrences(long, new Date(2019, 9, 20), new Date(2019, 9, 21));
    expect(starts(day)).toEqual([
      "Sun Oct 13 2019",
      "Mon Oct 14 2019",
      "Tue Oct 15 2019",
      "Wed Oct 16 2019",
      "Thu Oct 17 2019",
      "Fri Oct 18 2019",
      "Sat Oct 19 2019",
      "Sun Oct 20 2019",
    ]);
  });

  it("keeps a removed occurrence removed when the series moves", () => {
    const daily = standup({ freq: "daily" }, { exdates: [new Date(2019, 9, 3, 9, 30).getTime()] });
    const later = {
      ...daily,
      start: new Date(2019, 9, 1, 10),
      end: new Date(2019, 9, 1, 10, 15),
    };
    const moved = { ...later, exdates: movedExdates(daily, later) ?? undefined };
    expect(moved.exdates).toEqual([new Date(2019, 9, 3, 10).getTime()]);
    expect(starts(occurrences(moved, new Date(2019, 9, 1), new Date(2019, 9, 5)))).toEqual([
      "Tue Oct 01 2019",
      "Wed Oct 02 2019",
      "Fri Oct 04 2019",
    ]);
    // A weekly series moved a day on: its second occurrence stays the one removed.
    const weekly = standup(
      { freq: "weekly" },
      { exdates: [new Date(2019, 9, 8, 9, 30).getTime()] },
    );
    const wednesday = {
      ...weekly,
      start: new Date(2019, 9, 2, 9, 30),
      end: new Date(2019, 9, 2, 9, 45),
    };
    expect(movedExdates(weekly, wednesday)).toEqual([new Date(2019, 9, 9, 9, 30).getTime()]);
    expect(movedExdates(standup({ freq: "daily" }), later)).toBeUndefined();
  });

  it("refuses to move a series with a removed occurrence it cannot place", () => {
    // Removed far past the dates looked at: more than 20,000 days on.
    const far = new Date(2026, 0, 1 + 20_005, 9).getTime();
    const daily: CalendarEntry = {
      id: "walk",
      title: "Walk",
      start: new Date(2026, 0, 1, 9),
      end: new Date(2026, 0, 1, 10),
      calendar: "home",
      repeat: { freq: "daily" },
      exdates: [far],
    };
    const to = new Date(2026, 0, 4, 9);
    expect(
      movedSeries(daily, daily, new Date(2026, 0, 3, 9), to, new Date(2026, 0, 4, 10)),
    ).toBeNull();
    // A series ended by its count has no place for a removed occurrence past its new end.
    const counted = {
      ...daily,
      repeat: { freq: "daily" as const, count: 5 },
      exdates: [new Date(2026, 0, 5, 9).getTime()],
    };
    expect(movedExdates(counted, { ...counted, repeat: { freq: "daily", count: 3 } })).toBeNull();
    // A removed date among the dates looked at that is no occurrence removes nothing: the move
    // is made, one day on, and the stray date is left out.
    const stray = { ...daily, exdates: [new Date(2026, 0, 3, 7).getTime()] };
    const moved = movedSeries(stray, stray, new Date(2026, 0, 3, 9), to, new Date(2026, 0, 4, 10));
    expect(moved).not.toBeNull();
    expect(moved?.start).toEqual(new Date(2026, 0, 2, 9));
    expect(moved?.end).toEqual(new Date(2026, 0, 2, 10));
    expect(moved && "exdates" in moved).toBe(false);
  });

  it("describes a repeat as the popover writes it", () => {
    expect(describeRepeat({ freq: "weekly" })).toBe("Every Week");
    expect(describeRepeat({ freq: "weekly", interval: 2, days: [4, 2] })).toBe(
      "Every 2 Weeks on Tue, Thu",
    );
    expect(describeRepeat({ freq: "daily", count: 5 })).toBe("Every Day, 5 times");
    expect(describeRepeat({ freq: "yearly", until: new Date(2025, 0, 2).getTime() })).toBe(
      "Every Year, until Jan 2, 2025",
    );
  });
});

describe("moving one occurrence of a monthly or yearly series", () => {
  const series = (freq: "monthly" | "yearly", start: Date): CalendarEntry => ({
    id: "rent",
    title: "Rent",
    start,
    end: new Date(start.getTime() + 36e5),
    calendar: "home",
    repeat: { freq },
  });

  it("moves the start as many months back as the occurrence is from it", () => {
    const rent = series("monthly", new Date(2026, 0, 30, 9));
    // The April 30 occurrence moved to May 1: the series starts on February 1.
    const start = seriesStartFor(rent, new Date(2026, 3, 30, 9), new Date(2026, 4, 1, 9));
    expect(start).toEqual(new Date(2026, 1, 1, 9));
    const moved = {
      ...rent,
      start: start as Date,
      end: new Date((start as Date).getTime() + 36e5),
    };
    const days = occurrences(moved, new Date(2026, 0, 1), new Date(2026, 5, 1)).map((entry) =>
      entry.start.getDate(),
    );
    expect(days).toEqual([1, 1, 1, 1]);
    expect(occurrences(moved, new Date(2026, 4, 1), new Date(2026, 4, 2))).toHaveLength(1);
  });

  it("refuses a day no start can reach", () => {
    // From a March 15 occurrence of a January series, April 30 needs a February 30.
    const fifteenth = series("monthly", new Date(2026, 0, 15, 9));
    expect(
      seriesStartFor(fifteenth, new Date(2026, 2, 15, 9), new Date(2026, 3, 30, 9)),
    ).toBeNull();
    // Two years after a 2025 start, February 29 2028 needs a February 29 2026.
    const yearly = series("yearly", new Date(2025, 1, 28, 9));
    expect(seriesStartFor(yearly, new Date(2027, 1, 28, 9), new Date(2028, 1, 29, 9))).toBeNull();
    expect(seriesStartFor(yearly, new Date(2027, 1, 28, 9), new Date(2027, 2, 1, 9))).toEqual(
      new Date(2025, 2, 1, 9),
    );
  });

  it("refuses a move that would leave a counted series without that occurrence", () => {
    // January 30, (no February 30,) March 30 and April 30: three occurrences.
    const counted = {
      ...series("monthly", new Date(2026, 0, 30, 9)),
      repeat: { freq: "monthly" as const, count: 3 },
    };
    // From February 1 the three are February, March and April 1: no May 1.
    expect(seriesStartFor(counted, new Date(2026, 3, 30, 9), new Date(2026, 4, 1, 9))).toBeNull();
    // March 30 moved to March 31: January 31, March 31 and May 31, still three.
    expect(seriesStartFor(counted, new Date(2026, 2, 30, 9), new Date(2026, 2, 31, 9))).toEqual(
      new Date(2026, 0, 31, 9),
    );
  });

  it("moves from the series' own start, whatever dates the edit carries", () => {
    // The window passes the edited fields, whose start is already the occurrence's new one.
    const daily: CalendarEntry = {
      id: "walk",
      title: "Walk",
      start: new Date(2026, 9, 1, 9),
      end: new Date(2026, 9, 1, 10),
      calendar: "home",
      repeat: { freq: "daily" },
    };
    const to = new Date(2026, 9, 9, 9);
    const edited = { ...daily, start: to, end: new Date(2026, 9, 9, 10) };
    const moved = movedSeries(daily, edited, new Date(2026, 9, 8, 9), to, edited.end);
    expect(moved?.start).toEqual(new Date(2026, 9, 2, 9));
    expect(moved?.end).toEqual(new Date(2026, 9, 2, 10));
    const monthly = { ...daily, repeat: { freq: "monthly" as const } };
    const back = new Date(2026, 11, 2, 9);
    expect(
      movedSeries(
        monthly,
        { ...monthly, start: back, end: new Date(2026, 11, 2, 10) },
        new Date(2026, 11, 1, 9),
        back,
        new Date(2026, 11, 2, 10),
      )?.start,
    ).toEqual(new Date(2026, 9, 2, 9));
  });

  it("refuses a move whose occurrence a removed one would take the place of", () => {
    // May 30 removed: the fourth occurrence. Moving April 30 to May 1 starts the series on
    // February 1, where the fourth occurrence, the removed one, is May 1 itself.
    const rent = {
      ...series("monthly", new Date(2026, 0, 30, 9)),
      exdates: [new Date(2026, 4, 30, 9).getTime()],
    };
    const to = (day: Date) => movedSeries(rent, rent, new Date(2026, 3, 30, 9), day, day);
    expect(to(new Date(2026, 4, 1, 9))).toBeNull();
    // From March 30 to March 31 instead: the series starts January 31, and its fourth
    // occurrence, July 31 (no April or June 31), stays removed.
    const moved = movedSeries(
      rent,
      rent,
      new Date(2026, 2, 30, 9),
      new Date(2026, 2, 31, 9),
      new Date(2026, 2, 31, 10),
    );
    expect(moved?.start).toEqual(new Date(2026, 0, 31, 9));
    expect(moved?.exdates).toEqual([new Date(2026, 6, 31, 9).getTime()]);
  });
});

describe("repeating events across a change of the clocks in London", () => {
  // In a fixed time zone, so that the change of 27 October 2019 (BST to GMT) is really crossed.
  const zone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/London";
  });
  afterAll(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  it("keeps a daily event at 9:30 on both sides of the change", () => {
    expect(new Date(2019, 6, 1).getTimezoneOffset()).toBe(-60);
    const daily = {
      ...standup({ freq: "daily" }),
      start: new Date(2019, 9, 25, 9, 30),
      end: new Date(2019, 9, 25, 9, 45),
    };
    const week = occurrences(daily, new Date(2019, 9, 25), new Date(2019, 10, 1));
    expect(week).toHaveLength(7);
    expect(week.map((entry) => entry.start.getTimezoneOffset())).toEqual([-60, -60, 0, 0, 0, 0, 0]);
    expect(week.map((entry) => entry.start.getUTCHours())).toEqual([8, 8, 9, 9, 9, 9, 9]);
    expect(new Set(week.map((entry) => entry.start.getHours()))).toEqual(new Set([9]));
  });

  it("refuses to move a daily series to a start the clocks skip", () => {
    // 31 March 2019 has no 1:30 in London; a series starting the day before at 1:30 whose
    // April 1 occurrence moves to April 2, 1:30, would need it.
    const early = {
      ...standup({ freq: "daily" }),
      start: new Date(2019, 2, 30, 1, 30),
      end: new Date(2019, 2, 30, 2),
    };
    expect(
      seriesStartFor(early, new Date(2019, 3, 1, 1, 30), new Date(2019, 3, 2, 1, 30)),
    ).toBeNull();
    expect(seriesStartFor(early, new Date(2019, 3, 1, 1, 30), new Date(2019, 3, 1, 10))).toEqual(
      new Date(2019, 2, 30, 10),
    );
  });

  it("leaves out an occurrence at a time the clocks skip, without counting it", () => {
    // On 31 March 2019 London's clocks go from 1:00 to 2:00: there is no 1:30 that day.
    const early = {
      ...standup({ freq: "daily", count: 3 }),
      start: new Date(2019, 2, 30, 1, 30),
      end: new Date(2019, 2, 30, 2),
    };
    const days = occurrences(early, new Date(2019, 2, 29), new Date(2019, 3, 5));
    expect(days.map((entry) => [entry.start.getDate(), entry.start.getHours()])).toEqual([
      [30, 1],
      [1, 1],
      [2, 1],
    ]);
  });

  it("moves a series by calendar days and clock time, not by elapsed time", () => {
    // An occurrence moved from Saturday 26 October 9:30 (BST) to Monday 28 October 9:30
    // (GMT) is 49 hours later; the series start moves two days on, still at 9:30.
    const moved = shiftLocal(
      new Date(2019, 9, 20, 9, 30),
      new Date(2019, 9, 26, 9, 30),
      new Date(2019, 9, 28, 9, 30),
    );
    expect(moved).toEqual(new Date(2019, 9, 22, 9, 30));
    // And an hour later on the clock is an hour later at the series start too.
    expect(
      shiftLocal(
        new Date(2019, 9, 20, 9, 30),
        new Date(2019, 9, 26, 9, 30),
        new Date(2019, 9, 28, 10, 30),
      ),
    ).toEqual(new Date(2019, 9, 22, 10, 30));
  });

  it("keeps an all-day event one day long over the change", () => {
    const day: CalendarEntry = {
      id: "clocks",
      title: "Clocks go back",
      start: new Date(2019, 9, 20),
      end: new Date(2019, 9, 21),
      allDay: true,
      calendar: "home",
      repeat: { freq: "weekly" },
    };
    const [sunday] = occurrences(day, new Date(2019, 9, 27), new Date(2019, 9, 28));
    expect(sunday?.start).toEqual(new Date(2019, 9, 27));
    expect(sunday?.end).toEqual(new Date(2019, 9, 28));
    expect((sunday?.end.getTime() ?? 0) - (sunday?.start.getTime() ?? 0)).toBe(25 * 3_600_000);
  });
});
