import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CalendarEntry } from "./calendar-data";
import {
  escapeText,
  eventsToIcs,
  fold,
  type IcsEvent,
  icsFileName,
  parseIcs,
  parseLine,
  readDuration,
  transitions,
  unescapeText,
  unfold,
} from "./calendar-ics";
import { occurrences } from "./calendar-recurrence";

/** Run the tests of a block in the time zone `zone`, the browser's own as the reader sees it. */
function inZone(zone: string) {
  let before: string | undefined;
  beforeAll(() => {
    before = process.env.TZ;
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  });
}

const ics = (...lines: string[]) => `${lines.join("\r\n")}\r\n`;
const calendar = (...lines: string[]) =>
  ics("BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//EN", ...lines, "END:VCALENDAR");
const utc = (...parts: [number, number, number, number?, number?, number?]) =>
  new Date(Date.UTC(parts[0], parts[1], parts[2], parts[3] ?? 0, parts[4] ?? 0, parts[5] ?? 0));

describe("content lines", () => {
  it("unfolds a line that continues with a space or a tab, in CRLF or LF files", () => {
    expect(unfold("\uFEFFSUMMARY:One\r\n  two\r\n\t three\r\nLOCATION:Here\n\nEND:VEVENT")).toEqual(
      ["SUMMARY:One two three", "LOCATION:Here", "END:VEVENT"],
    );
  });

  it("reads parameters, quoted ones with colons and semicolons, and the value after them", () => {
    expect(parseLine('DTSTART;TZID="America/New_York";X-A="a:b;c":19970902T090000')).toEqual({
      name: "DTSTART",
      params: { TZID: "America/New_York", "X-A": "a:b;c" },
      value: "19970902T090000",
    });
    expect(parseLine("summary:Lunch: at noon")).toEqual({
      name: "SUMMARY",
      params: {},
      value: "Lunch: at noon",
    });
    expect(parseLine("no colon here")).toBeNull();
    expect(parseLine(":value")).toBeNull();
    expect(parseLine("BAD NAME:x")).toBeNull();
  });

  it("escapes and unescapes text", () => {
    const text = "Lunch, then; coffee\\tea\nand cake";
    expect(escapeText(text)).toBe("Lunch\\, then\\; coffee\\\\tea\\nand cake");
    expect(unescapeText(escapeText(text))).toBe(text);
    expect(unescapeText("one\\Ntwo\\:three")).toBe("one\ntwo\\:three");
  });

  it("folds at 75 octets without splitting a character", () => {
    const line = `SUMMARY:${"é".repeat(60)}${"x".repeat(50)}`;
    const folded = fold(line);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(2);
    for (const part of physical)
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    for (const part of physical.slice(1)) expect(part.startsWith(" ")).toBe(true);
    expect(unfold(folded)).toEqual([line]);
    expect(fold("SHORT:line")).toBe("SHORT:line");
  });

  it("reads durations", () => {
    expect(readDuration("PT1H30M")).toBe(5_400_000);
    expect(readDuration("P1DT12H")).toBe(129_600_000);
    expect(readDuration("P2W")).toBe(1_209_600_000);
    expect(readDuration("-PT15M")).toBe(-900_000);
    expect(readDuration("P")).toBeNull();
    expect(readDuration("1H")).toBeNull();
  });
});

describe("reading an iCalendar file", () => {
  inZone("America/New_York");

  it("reads RFC 5545's conference: UTC times, a folded and escaped description", () => {
    const read = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "DTSTAMP:19960704T120000Z",
        "UID:uid1@example.com",
        "ORGANIZER:mailto:jsmith@example.com",
        "DTSTART:19960918T143000Z",
        "DTEND:19960920T220000Z",
        "STATUS:CONFIRMED",
        "CATEGORIES:CONFERENCE",
        "SUMMARY:Networld+Interop Conference",
        "DESCRIPTION:Networld+Interop Conference",
        "  and Exhibit\\nAtlanta World Congress Center\\n",
        " Atlanta\\, Georgia",
        "END:VEVENT",
      ),
    );
    expect(read).toEqual({
      events: [
        {
          uid: "uid1@example.com",
          title: "Networld+Interop Conference",
          start: utc(1996, 8, 18, 14, 30),
          end: utc(1996, 8, 20, 22),
          notes:
            "Networld+Interop Conference and Exhibit\nAtlanta World Congress Center\nAtlanta, Georgia",
        },
      ],
      skipped: 0,
      simplified: 0,
      crowded: 0,
      shortened: 0,
      unknownZones: [],
    });
  });

  it("reads a time in a named zone, either side of a change of the clocks", () => {
    const { events } = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:a",
        "DTSTART;TZID=America/New_York:19970902T090000",
        "DTEND;TZID=America/New_York:19970902T100000",
        "SUMMARY:Before",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:b",
        'DTSTART;TZID="Europe/Paris":19971102T090000',
        "DURATION:PT45M",
        "SUMMARY:After",
        "END:VEVENT",
      ),
    );
    expect(events.map((event) => [event.start, event.end])).toEqual([
      [utc(1997, 8, 2, 13), utc(1997, 8, 2, 14)],
      // Paris is an hour ahead of UTC once its summer time has ended.
      [utc(1997, 10, 2, 8), utc(1997, 10, 2, 8, 45)],
    ]);
  });

  it("finds a zone by the end of a long TZID, and by its VTIMEZONE's X-LIC-LOCATION", () => {
    const { events, unknownZones } = parseIcs(
      calendar(
        "BEGIN:VTIMEZONE",
        "TZID:Berlin (own)",
        "X-LIC-LOCATION:Europe/Berlin",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        "UID:a",
        "DTSTART;TZID=/mozilla.org/20050126_1/Europe/London:20191002T090000",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:b",
        "DTSTART;TZID=Berlin (own):20191002T090000",
        "END:VEVENT",
      ),
    );
    expect(events.map((event) => event.start)).toEqual([utc(2019, 9, 2, 8), utc(2019, 9, 2, 7)]);
    // An event with a time and no end is a moment.
    expect(events[0]?.end).toEqual(events[0]?.start);
    expect(unknownZones).toEqual([]);
  });

  it("works out a zone from the VTIMEZONE's rules, as Outlook writes them", () => {
    const { events } = parseIcs(
      calendar(
        "BEGIN:VTIMEZONE",
        "TZID:Pacific Standard Time",
        "BEGIN:STANDARD",
        "DTSTART:16010101T020000",
        "TZOFFSETFROM:-0700",
        "TZOFFSETTO:-0800",
        "RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=1SU;BYMONTH=11",
        "END:STANDARD",
        "BEGIN:DAYLIGHT",
        "DTSTART:16010101T020000",
        "TZOFFSETFROM:-0800",
        "TZOFFSETTO:-0700",
        "RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=2SU;BYMONTH=3",
        "END:DAYLIGHT",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        "UID:summer",
        'DTSTART;TZID="Pacific Standard Time":20191002T090000',
        'DTEND;TZID="Pacific Standard Time":20191002T093000',
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:winter",
        'DTSTART;TZID="Pacific Standard Time":20191215T090000',
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:spring",
        // The day the clocks went forward, after they did.
        'DTSTART;TZID="Pacific Standard Time":20190310T090000',
        "END:VEVENT",
        "BEGIN:VTIMEZONE",
        "TZID:Last Sunday",
        "BEGIN:STANDARD",
        "DTSTART:19701025T030000",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "END:STANDARD",
        "BEGIN:DAYLIGHT",
        "DTSTART:19700329T020000",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0200",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "END:DAYLIGHT",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        "UID:october",
        // 26 October 2019 is the Saturday before the last Sunday: still summer time.
        "DTSTART;TZID=Last Sunday:20191026T120000",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:november",
        "DTSTART;TZID=Last Sunday:20191028T120000",
        "END:VEVENT",
      ),
    );
    expect(Object.fromEntries(events.map((event) => [event.uid, event.start]))).toEqual({
      summer: utc(2019, 9, 2, 16),
      winter: utc(2019, 11, 15, 17),
      spring: utc(2019, 2, 10, 16),
      october: utc(2019, 9, 26, 10),
      november: utc(2019, 9, 28, 11),
    });
    expect(events[0]?.end).toEqual(utc(2019, 9, 2, 16, 30));
  });

  it("reads a zone it cannot find, and a floating time, as local time, and says which zone", () => {
    const read = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:a",
        "DTSTART;TZID=Mars/Olympus Mons:20191002T090000",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:b",
        "DTSTART:20191002T090000",
        "DTEND:20191002T103000",
        "END:VEVENT",
      ),
    );
    expect(read.events.map((event) => [event.start, event.end])).toEqual([
      [new Date(2019, 9, 2, 9), new Date(2019, 9, 2, 9)],
      [new Date(2019, 9, 2, 9), new Date(2019, 9, 2, 10, 30)],
    ]);
    expect(read.unknownZones).toEqual(["Mars/Olympus Mons"]);
  });

  it("reads dates as all-day events, lasting to DTEND, their DURATION or one day", () => {
    const { events } = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:halloween",
        "DTSTART;VALUE=DATE:20191031",
        "DTEND;VALUE=DATE:20191101",
        "SUMMARY:Halloween",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:trip",
        "DTSTART;VALUE=DATE:20191102",
        "DURATION:P3D",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:day",
        "DTSTART:20191110",
        "END:VEVENT",
      ),
    );
    expect(events.map((event) => [event.title, event.allDay, event.start, event.end])).toEqual([
      ["Halloween", true, new Date(2019, 9, 31), new Date(2019, 10, 1)],
      // An untitled event is a new one, as Calendar names it.
      ["New Event", true, new Date(2019, 10, 2), new Date(2019, 10, 5)],
      ["New Event", true, new Date(2019, 10, 10), new Date(2019, 10, 11)],
    ]);
  });

  it("reads the repeats Calendar keeps, and makes the others single events", () => {
    const vevent = (uid: string, start: string, ...lines: string[]) => [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;TZID=America/New_York:${start}`,
      ...lines,
      "END:VEVENT",
    ];
    const read = parseIcs(
      calendar(
        ...vevent("weekly", "19970902T090000", "RRULE:FREQ=WEEKLY;COUNT=10"),
        ...vevent(
          "tue-thu",
          "19970902T090000",
          "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;UNTIL=19971224T000000Z;WKST=SU",
          "EXDATE;TZID=America/New_York:19970916T090000,19970918T090000",
        ),
        ...vevent("weekdays", "19970902T090000", "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR"),
        ...vevent("monthly", "19970905T090000", "RRULE:FREQ=MONTHLY;BYMONTHDAY=5;COUNT=12"),
        ...vevent("birthday", "19971031T090000", "RRULE:FREQ=YEARLY;BYMONTH=10"),
        ...vevent("every-3-days", "19970902T090000", "RRULE:FREQ=DAILY;INTERVAL=3"),
        // What Calendar has no repeat for.
        ...vevent("second-tuesday", "19970909T090000", "RRULE:FREQ=MONTHLY;BYDAY=2TU"),
        ...vevent("last-day", "19970930T090000", "RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO"),
        ...vevent("march", "19971031T090000", "RRULE:FREQ=YEARLY;BYMONTH=3"),
        ...vevent("long", "19970902T090000", "RRULE:FREQ=DAILY;COUNT=1000"),
        ...vevent("both", "19970902T090000", "RRULE:FREQ=DAILY;COUNT=3;UNTIL=19971224T000000Z"),
        ...vevent("extra", "19970902T090000", "RRULE:FREQ=DAILY", "RDATE:19970910T090000"),
        // Weeks from Monday or from Sunday hold Tuesday and Thursday alike.
        ...vevent(
          "monday-weeks",
          "19970902T090000",
          "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;WKST=MO",
        ),
        // Without WKST weeks begin on Monday (RFC 5545): Sunday then ends the start's week.
        ...vevent("sunday-monday", "19970908T090000", "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO"),
      ),
    );
    const repeats = Object.fromEntries(read.events.map((event) => [event.uid, event.repeat]));
    expect(repeats).toEqual({
      weekly: { freq: "weekly", count: 10 },
      "tue-thu": { freq: "weekly", interval: 2, days: [2, 4], until: utc(1997, 11, 24).getTime() },
      weekdays: { freq: "weekly", days: [1, 2, 3, 4, 5] },
      monthly: { freq: "monthly", count: 12 },
      birthday: { freq: "yearly" },
      "every-3-days": { freq: "daily", interval: 3 },
      "second-tuesday": undefined,
      "last-day": undefined,
      march: undefined,
      long: undefined,
      both: undefined,
      extra: undefined,
      "monday-weeks": { freq: "weekly", interval: 2, days: [2, 4] },
      "sunday-monday": undefined,
    });
    expect(read.simplified).toBe(7);
    expect(read.events.find((event) => event.uid === "tue-thu")?.exdates).toEqual([
      utc(1997, 8, 16, 13).getTime(),
      utc(1997, 8, 18, 13).getTime(),
    ]);
  });

  it("ends an all-day repeat with the last moment of its UNTIL date", () => {
    const { events } = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:a",
        "DTSTART;VALUE=DATE:20191001",
        "RRULE:FREQ=DAILY;UNTIL=20191005",
        "EXDATE;VALUE=DATE:20191003",
        "END:VEVENT",
      ),
    );
    expect(events[0]?.repeat).toEqual({
      freq: "daily",
      until: new Date(2019, 9, 6).getTime() - 1,
    });
    expect(events[0]?.exdates).toEqual([new Date(2019, 9, 3).getTime()]);
  });

  it("removes a changed or cancelled occurrence from its series and keeps the change", () => {
    const read = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:standup",
        "DTSTART;TZID=America/New_York:19970902T090000",
        "DTEND;TZID=America/New_York:19970902T091500",
        "RRULE:FREQ=WEEKLY",
        "SUMMARY:Standup",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:standup",
        "RECURRENCE-ID;TZID=America/New_York:19970909T090000",
        "DTSTART;TZID=America/New_York:19970909T100000",
        "DTEND;TZID=America/New_York:19970909T101500",
        "SUMMARY:Standup (later)",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:standup",
        "RECURRENCE-ID;TZID=America/New_York:19970916T090000",
        "DTSTART;TZID=America/New_York:19970916T090000",
        "STATUS:CANCELLED",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:gone",
        "DTSTART:19970902T090000Z",
        "STATUS:CANCELLED",
        "END:VEVENT",
      ),
    );
    expect(read.events.map((event) => [event.uid, event.title])).toEqual([
      ["standup", "Standup"],
      ["standup@America/New_York:19970909T090000", "Standup (later)"],
    ]);
    expect(read.events[0]?.exdates).toEqual([
      utc(1997, 8, 9, 13).getTime(),
      utc(1997, 8, 16, 13).getTime(),
    ]);
    // The cancelled event is left out; the cancelled occurrence is its series' removed one.
    expect(read.skipped).toBe(1);
  });

  it("keeps the event's own texts, not those of its alarm, and cuts what is too long", () => {
    const read = parseIcs(
      calendar(
        "X-WR-CALNAME:Team\\, shared",
        "BEGIN:VEVENT",
        "UID:a",
        "DTSTART:20191002T130000Z",
        `SUMMARY:${"x".repeat(250)}`,
        "LOCATION:Room 4\\; east wing",
        "URL:https://example.com/a,b",
        "DESCRIPTION:The event's own",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:The alarm's",
        "TRIGGER:-PT15M",
        "END:VALARM",
        "X-UNKNOWN;X-P=1:kept out",
        "ATTACH:https://example.com/file",
        "END:VEVENT",
      ),
    );
    expect(read.name).toBe("Team, shared");
    const [event] = read.events;
    expect(event?.title).toBe("x".repeat(200));
    expect(event?.location).toBe("Room 4; east wing");
    expect(event?.url).toBe("https://example.com/a,b");
    expect(event?.notes).toBe("The event's own");
    expect(read.shortened).toBe(1);
  });

  it("keeps a repeat's days in the zone it is written in, wherever the browser is", () => {
    const { events } = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:utc",
        // Tuesday 01:00 UTC is Monday 9 PM in New York.
        "DTSTART:20191008T010000Z",
        "RRULE:FREQ=weekly;BYDAY=TU",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:tokyo",
        // Tuesday 9 AM in Tokyo is Monday 8 PM in New York.
        "DTSTART;TZID=Asia/Tokyo:20191008T090000",
        "RRULE:FREQ=WEEKLY;BYDAY=TU,TH",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:mid-month",
        "DTSTART:20191015T010000Z",
        "RRULE:FREQ=MONTHLY",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:first",
        // The 1st at 01:00 UTC is the last day of the month before in New York.
        "DTSTART:20191001T010000Z",
        "RRULE:FREQ=MONTHLY",
        "END:VEVENT",
      ),
    );
    const repeats = Object.fromEntries(events.map((event) => [event.uid, event.repeat]));
    expect(repeats).toEqual({
      utc: { freq: "weekly", days: [2] },
      tokyo: { freq: "weekly", days: [2, 4] },
      "mid-month": { freq: "monthly" },
      first: { freq: "monthly" },
    });
    // Tuesdays and Thursdays at 9 AM in Tokyo: Monday and Wednesday at 8 PM in New York.
    const tokyo = events.find((event) => event.uid === "tokyo") as IcsEvent;
    const entry = { ...tokyo, id: "tokyo", calendar: "home" } as CalendarEntry;
    expect(tokyo.timeZone).toBe("Asia/Tokyo");
    expect(
      occurrences(entry, new Date(2019, 9, 7), new Date(2019, 9, 14)).map((each) => each.start),
    ).toEqual([new Date(2019, 9, 7, 20), new Date(2019, 9, 9, 20)]);
  });

  it("moves a weekly rule's days with a start in a zone only the file defines", () => {
    const { events } = parseIcs(
      calendar(
        "BEGIN:VTIMEZONE",
        "TZID:Far East",
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        "TZOFFSETFROM:+0900",
        "TZOFFSETTO:+0900",
        "END:STANDARD",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        "UID:far",
        "DTSTART;TZID=Far East:20191008T090000",
        "RRULE:FREQ=WEEKLY;BYDAY=TU,TH",
        "END:VEVENT",
      ),
    );
    expect(events[0]?.timeZone).toBeUndefined();
    expect(events[0]?.repeat).toEqual({ freq: "weekly", days: [1, 3] });
  });

  it("says a fortnightly rule on another day than its start, whose weeks differ, was simplified", () => {
    const read = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:sunday",
        // Its weeks begin on Monday: the first Saturday is 13 days on, not 6 as on Sunday's weeks.
        "DTSTART:20191006T090000",
        "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SA;WKST=MO",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:same-weeks",
        "DTSTART:20191006T090000",
        "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SA;WKST=SU",
        "END:VEVENT",
      ),
    );
    expect(read.events.map((event) => event.repeat)).toEqual([
      undefined,
      { freq: "weekly", interval: 2, days: [6] },
    ]);
    expect(read.simplified).toBe(1);
  });

  it("removes the occurrence a date or a changed occurrence names, on the event's own clock", () => {
    const { events } = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:tokyo",
        "DTSTART;TZID=Asia/Tokyo:20191008T090000",
        "RRULE:FREQ=WEEKLY",
        "EXDATE;VALUE=DATE:20191015",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:london",
        // 4 AM in New York in winter; 5 AM while only New York keeps summer time.
        "DTSTART;TZID=Europe/London:20190305T090000",
        "RRULE:FREQ=WEEKLY",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:london",
        "RECURRENCE-ID;TZID=Europe/London:20190319T090000",
        "DTSTART;TZID=Europe/London:20190319T110000",
        "SUMMARY:Moved",
        "END:VEVENT",
      ),
    );
    const byUid = Object.fromEntries(events.map((event) => [event.uid, event]));
    // The 15th at 9 AM in Tokyo: the 14th at 8 PM in New York.
    expect(byUid.tokyo?.exdates).toEqual([new Date(2019, 9, 14, 20).getTime()]);
    expect(byUid.london?.exdates).toEqual([new Date(2019, 2, 19, 5).getTime()]);
    expect(events.map((event) => event.title)).toContain("Moved");
  });

  it("reads the rules RFC 5545 gives the other meaning to as single events", () => {
    const read = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:every-fifth",
        // Yearly on the 5th, with no month: the 5th of every month.
        "DTSTART:20191005T090000",
        "RRULE:FREQ=YEARLY;BYMONTHDAY=5",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:ended",
        "DTSTART:20191005T090000",
        "RRULE:FREQ=DAILY;UNTIL=20191001T000000Z",
        "END:VEVENT",
      ),
    );
    expect(read.events.map((event) => event.repeat)).toEqual([undefined, undefined]);
    expect(read.simplified).toBe(2);
  });

  it("reads a time the clocks skip with the offset before, and one they repeat as the first", () => {
    const { events } = parseIcs(
      calendar(
        ...[
          ["gap", "Europe/Berlin", "20190331T023000"],
          ["twice", "Europe/Berlin", "20191027T023000"],
          ["gap-west", "America/New_York", "20190310T023000"],
          ["twice-west", "America/New_York", "20191103T013000"],
        ].flatMap(([uid, zone, time]) => [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTART;TZID=${zone}:${time}`,
          "END:VEVENT",
        ]),
      ),
    );
    expect(Object.fromEntries(events.map((event) => [event.uid, event.start]))).toEqual({
      gap: utc(2019, 2, 31, 1, 30),
      twice: utc(2019, 9, 27, 0, 30),
      "gap-west": utc(2019, 2, 10, 7, 30),
      "twice-west": utc(2019, 10, 3, 5, 30),
    });
  });

  it("removes the occurrence a removed date of another zone names", () => {
    const { events } = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:london",
        // 9 AM in London: 4 AM in New York in winter, 5 AM while only New York keeps summer time.
        "DTSTART;TZID=Europe/London:20190305T090000",
        "RRULE:FREQ=WEEKLY",
        "EXDATE;TZID=Europe/London:20190312T090000",
        "END:VEVENT",
      ),
    );
    expect(events[0]?.start).toEqual(new Date(2019, 2, 5, 4));
    expect(events[0]?.exdates).toEqual([new Date(2019, 2, 12, 5).getTime()]);
  });

  it("reads a file nested past any calendar, or with a huge zone name, at once", () => {
    const deep = Array.from({ length: 5000 }, () => "BEGIN:X");
    const up = Array.from({ length: 5000 }, () => "END:X");
    const zone = "a/".repeat(100_000);
    const begun = Date.now();
    const read = parseIcs(
      calendar(
        ...deep,
        ...up,
        "BEGIN:VEVENT",
        "UID:after",
        `DTSTART;TZID=${zone}:20191002T090000`,
        `DTEND;TZID=${zone}:20191002T100000`,
        "END:VEVENT",
      ),
    );
    expect(Date.now() - begun).toBeLessThan(2000);
    expect(read.events.map((event) => event.uid)).toEqual(["after"]);
    expect(read.unknownZones).toHaveLength(1);
    expect(read.unknownZones[0]?.length).toBe(60);
  });

  it("counts a repeat with more removed occurrences than Calendar keeps, once", () => {
    const days = Array.from({ length: 210 }, (_, n) => {
      const day = new Date(Date.UTC(2020, 0, 1 + n));
      return `${day.getUTCFullYear()}${String(day.getUTCMonth() + 1).padStart(2, "0")}${String(day.getUTCDate()).padStart(2, "0")}`;
    });
    const read = parseIcs(
      calendar(
        "BEGIN:VEVENT",
        "UID:daily",
        "DTSTART;VALUE=DATE:20200101",
        "RRULE:FREQ=DAILY",
        `EXDATE;VALUE=DATE:${days.join(",")}`,
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:daily",
        "RECURRENCE-ID;VALUE=DATE:20201001",
        "DTSTART;VALUE=DATE:20201001",
        "STATUS:CANCELLED",
        "END:VEVENT",
      ),
    );
    expect(read.events[0]?.exdates).toHaveLength(200);
    expect(read.events[0]?.repeat).toEqual({ freq: "daily" });
    expect([read.crowded, read.simplified]).toEqual([1, 0]);
  });

  it("keeps two events of a file under one UID as two", () => {
    const read = parseIcs(
      calendar(
        ...["A", "B"].flatMap((title) => [
          "BEGIN:VEVENT",
          "UID:same",
          "DTSTART:20191002T090000Z",
          `SUMMARY:${title}`,
          "END:VEVENT",
        ]),
      ),
    );
    expect(read.events.map((event) => [event.uid, event.title])).toEqual([
      ["same", "A"],
      ["same#2", "B"],
    ]);
    // A UID that already ends in a number, and one VCALENDAR after another, change nothing.
    const event = (uid: string, title: string) => [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      "DTSTART:20191002T090000Z",
      `SUMMARY:${title}`,
      "END:VEVENT",
    ];
    const both = parseIcs(
      calendar(...event("same#2", "C"), ...event("same", "A")) + calendar(...event("same", "B")),
    );
    const uids = both.events.map((each) => each.uid);
    expect(new Set(uids).size).toBe(3);
    expect(both.events.map((each) => each.title)).toEqual(["C", "A", "B"]);
  });

  it("knows an event without a UID by what it is", () => {
    const file = (title: string) =>
      calendar("BEGIN:VEVENT", "DTSTART:20191002T090000Z", `SUMMARY:${title}`, "END:VEVENT");
    const [a] = parseIcs(file("A")).events;
    expect(parseIcs(file("A")).events[0]?.uid).toBe(a?.uid);
    expect(parseIcs(file("B")).events[0]?.uid).not.toBe(a?.uid);
  });

  it("passes over what it cannot read and never throws", () => {
    const read = parseIcs(
      calendar(
        "garbage without a colon",
        "BEGIN:VEVENT",
        "UID:no-start",
        "SUMMARY:No start",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:bad-date",
        "DTSTART:20190230T090000",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:not-a-date",
        "DTSTART:tomorrow",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:too-long",
        "DTSTART;VALUE=DATE:20190101",
        "DTEND;VALUE=DATE:20500101",
        "END:VEVENT",
        "BEGIN:VTODO",
        "UID:todo",
        "DTSTART:20191002T090000",
        "END:VTODO",
        "BEGIN:VEVENT",
        "UID:ok",
        "DTSTART:20191002T090000Z",
        "DTEND:20191002T080000Z",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:unfinished",
        "DTSTART:20191003T090000Z",
      ),
    );
    expect(read.events.map((event) => event.uid)).toEqual(["ok", "unfinished"]);
    // An end before the start is the start.
    expect(read.events[0]?.end).toEqual(read.events[0]?.start);
    expect(read.skipped).toBe(4);
    for (const junk of [
      "",
      "BEGIN:VCALENDAR",
      "\u0000\u0001\u0002",
      "END:VEVENT\r\nEND:VCALENDAR",
    ]) {
      expect(parseIcs(junk).events).toEqual([]);
    }
    expect(parseIcs("not a calendar at all").events).toEqual([]);
  });
});

/** Events of every kind Calendar keeps, for writing and reading back. */
function sample(): CalendarEntry[] {
  return [
    {
      id: "dentist",
      title: "Dentist, then lunch",
      start: new Date(2019, 9, 2, 9),
      end: new Date(2019, 9, 2, 10),
      calendar: "home",
      location: "Main St.; Suite 4",
      notes: "Bring the forms\nand the card \\ both",
      url: "https://example.com/visit?a=1,2",
    },
    {
      id: "trip",
      title: "Trip",
      start: new Date(2019, 9, 31),
      end: new Date(2019, 10, 3),
      allDay: true,
      calendar: "home",
    },
    {
      id: "standup",
      title: "Standup",
      start: new Date(2019, 9, 1, 9, 30),
      end: new Date(2019, 9, 1, 9, 45),
      calendar: "work",
      repeat: { freq: "weekly", days: [2, 4], count: 10 },
      exdates: [new Date(2019, 9, 3, 9, 30).getTime(), new Date(2019, 10, 5, 9, 30).getTime()],
    },
    {
      id: "rent",
      title: "Rent",
      start: new Date(2019, 0, 31, 8),
      end: new Date(2019, 0, 31, 8, 30),
      calendar: "home",
      repeat: { freq: "monthly", until: new Date(2020, 5, 30, 8).getTime() },
    },
    {
      id: "walk",
      title: "Walk",
      start: new Date(2019, 2, 9, 7),
      end: new Date(2019, 2, 9, 8),
      calendar: "home",
      repeat: { freq: "daily", interval: 3 },
    },
    {
      id: "birthday",
      title: "Birthday",
      start: new Date(2019, 3, 12),
      end: new Date(2019, 3, 13),
      allDay: true,
      calendar: "home",
      repeat: { freq: "yearly", until: new Date(2030, 3, 13).getTime() - 1 },
      exdates: [new Date(2021, 3, 12).getTime()],
    },
  ];
}

/** What a written event is read back as. */
const asRead = (event: CalendarEntry) => {
  const { id, calendar: _calendar, ...rest } = event;
  return { uid: `${id}@macalicious`, ...rest };
};

/** The browser's name for its zone, as a timed repeat is written in it. */
const writtenZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** `events` as read back: each timed repeat with the zone `name` it was written in, if any. */
const zoned = (events: CalendarEntry[], name: string | undefined) =>
  events
    .map(asRead)
    .map((event) => (name && event.repeat && !event.allDay ? { ...event, timeZone: name } : event));

describe("writing an iCalendar file", () => {
  inZone("America/New_York");
  // Made in the test, once the zone is set.
  const now = () => new Date(2019, 9, 3, 15, 38);

  it("writes a timed event in UTC and an all-day one with dates, escaped and in CRLF lines", () => {
    const [dentist, trip] = sample();
    expect(
      eventsToIcs([dentist as CalendarEntry, trip as CalendarEntry], { name: "Home", now: now() }),
    ).toBe(
      ics(
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Macalicious//Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Home",
        "BEGIN:VEVENT",
        "UID:dentist@macalicious",
        "DTSTAMP:20191003T193800Z",
        "DTSTART:20191002T130000Z",
        "DTEND:20191002T140000Z",
        "SUMMARY:Dentist\\, then lunch",
        "LOCATION:Main St.\\; Suite 4",
        "DESCRIPTION:Bring the forms\\nand the card \\\\ both",
        "URL:https://example.com/visit?a=1,2",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:trip@macalicious",
        "DTSTAMP:20191003T193800Z",
        "DTSTART;VALUE=DATE:20191031",
        "DTEND;VALUE=DATE:20191103",
        "SUMMARY:Trip",
        "END:VEVENT",
        "END:VCALENDAR",
      ),
    );
  });

  it("writes a timed repeat in the browser's zone, with the zone's changes in a VTIMEZONE", () => {
    const standup = sample()[2] as CalendarEntry;
    const text = eventsToIcs([standup], { now: now() });
    const lines = unfold(text);
    expect(lines).toContain("TZID:America/New_York");
    expect(lines).toContain("DTSTART;TZID=America/New_York:20191001T093000");
    expect(lines).toContain("DTEND;TZID=America/New_York:20191001T094500");
    expect(lines).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=10;WKST=SU");
    expect(lines).toContain("EXDATE;TZID=America/New_York:20191003T093000,20191105T093000");
    // The first change of the years written: summer time from 2 AM on 10 March 2019.
    // The zone's changes as its rules, open-ended: the second Sunday of March and the first
    // of November, from 2019.
    const daylight = lines.indexOf("BEGIN:DAYLIGHT");
    expect(lines.slice(daylight, daylight + 3)).toEqual([
      "BEGIN:DAYLIGHT",
      "DTSTART:20190310T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    ]);
    expect(lines).toContain("RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU");
    expect(lines).toContain("TZOFFSETFROM:-0500");
    expect(lines).toContain("TZOFFSETTO:-0400");
    for (const line of text.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("finds the changes of the browser's clocks to the minute", () => {
    expect(transitions(2019, 2019)).toEqual([
      { at: utc(2019, 2, 10, 7).getTime(), from: -5 * 3_600_000, to: -4 * 3_600_000 },
      { at: utc(2019, 10, 3, 6).getTime(), from: -4 * 3_600_000, to: -5 * 3_600_000 },
    ]);
  });

  it("names the file after the calendar, without what a file name cannot hold", () => {
    expect(icsFileName("Work")).toBe("Work.ics");
    expect(icsFileName('A/B: "C"?')).toBe("AB C.ics");
    expect(icsFileName("  ")).toBe("Calendar.ics");
  });

  it("leaves out an event it cannot write in four digits of year", () => {
    const far: CalendarEntry = {
      id: "far",
      title: "Far",
      start: new Date(12000, 0, 1),
      end: new Date(12000, 0, 2),
      allDay: true,
      calendar: "home",
    };
    expect(eventsToIcs([far], { now: now() })).not.toContain("BEGIN:VEVENT");
  });

  it("keeps a URL to one line", () => {
    const [dentist] = sample();
    const text = eventsToIcs(
      [{ ...(dentist as CalendarEntry), url: "https://a.example/\r\nX-EVIL:1" }],
      {
        now: now(),
      },
    );
    expect(unfold(text)).toContain("URL:https://a.example/X-EVIL:1");
    expect(unfold(text).some((line) => line.startsWith("X-EVIL"))).toBe(false);
  });
});

describe.each(["America/New_York", "Europe/London", "Asia/Kolkata", "Asia/Jerusalem", "UTC"])(
  "reading back what was written, in %s",
  (zone) => {
    inZone(zone);

    it("reads every event as it was, a timed repeat with the zone it was written in", () => {
      const events = sample();
      const read = parseIcs(eventsToIcs(events, { name: "Mine", now: new Date(2019, 9, 3) }));
      expect(read.name).toBe("Mine");
      expect(read.skipped + read.simplified + read.shortened).toBe(0);
      expect(read.unknownZones).toEqual([]);
      expect(read.events).toEqual(zoned(events, zone === "UTC" ? "UTC" : writtenZone()));
    });

    it("reads the repeats' times back through its own VTIMEZONE alone", () => {
      // The zone renamed to one no browser knows: the reader has only the VTIMEZONE to go by.
      const written = eventsToIcs(sample(), { now: new Date(2019, 9, 3) });
      // UTC has no zone's name to write: its repeats are in UTC, with no VTIMEZONE.
      expect(written.includes("BEGIN:VTIMEZONE")).toBe(zone !== "UTC");
      // The zone as written: the browser's own name for it (\"Asia/Calcutta\" for Kolkata).
      const text = written
        .replaceAll(`TZID=${writtenZone()}`, "TZID=Our Own")
        .replace(`TZID:${writtenZone()}`, "TZID:Our Own");
      const read = parseIcs(text);
      expect(read.unknownZones).toEqual([]);
      // A zone known only by its VTIMEZONE has no name to keep; UTC's repeats are in UTC.
      expect(read.events).toEqual(zoned(sample(), zone === "UTC" ? "UTC" : undefined));
    });

    it("writes a VTIMEZONE that holds for years before and after the repeats it was written for", () => {
      const old: CalendarEntry = {
        id: "old",
        title: "Old",
        start: new Date(1980, 0, 7, 9),
        end: new Date(1980, 0, 7, 10),
        calendar: "home",
        repeat: { freq: "weekly" },
      };
      const written = eventsToIcs([old], { now: new Date(2019, 9, 3) })
        .replaceAll(`TZID=${zone}`, "TZID=Our Own")
        .replace(`TZID:${zone}`, "TZID:Our Own");
      // Moments of 1990, 2019 and 2045, read through the written VTIMEZONE alone.
      const moments = [
        [1990, 6, 1],
        [1990, 11, 1],
        [2019, 6, 1],
        [2045, 0, 15],
        [2045, 6, 15],
        // Jerusalem's summer time begins on 24 March 2028, not the last Friday of March.
        [2028, 2, 27],
      ] as const;
      const events = moments.map(
        ([y, m, d], n) =>
          `BEGIN:VEVENT\r\nUID:m${n}\r\nDTSTART;TZID=Our Own:${y}${String(m + 1).padStart(2, "0")}${String(d).padStart(2, "0")}T090000\r\nEND:VEVENT`,
      );
      const read = parseIcs(
        written.replace("END:VCALENDAR", `${events.join("\r\n")}\r\nEND:VCALENDAR`),
      );
      // In UTC no VTIMEZONE is written: the renamed zone is unknown, and read as UTC itself.
      expect(read.events.slice(1).map((event) => event.start)).toEqual(
        moments.map(([y, m, d]) => new Date(y, m, d, 9)),
      );
    });
  },
);
