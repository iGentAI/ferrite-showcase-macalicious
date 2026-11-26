import { describe, expect, it } from "vitest";
import type { Reminder } from "./reminders-data";
import { remindersFromIcs, remindersToIcs } from "./reminders-ics";

const REMINDERS: readonly Reminder[] = [
  {
    id: "a",
    listId: "l",
    title: "Pay, the; rent",
    notes: "two\nlines",
    url: "https://example.com/",
    due: "2031-03-05",
    dueTime: "09:30",
    priority: "high",
  },
  { id: "b", listId: "l", title: "Milk", due: "2031-03-06", completed: true, priority: "low" },
  { id: "c", listId: "l", title: "Plain" },
];

describe("reminders as iCalendar", () => {
  it("reads back what it writes", () => {
    const read = remindersFromIcs(remindersToIcs("Home", REMINDERS));
    expect(read).toEqual([
      {
        title: "Pay, the; rent",
        notes: "two\nlines",
        url: "https://example.com/",
        due: "2031-03-05",
        dueTime: "09:30",
        priority: "high",
      },
      { title: "Milk", due: "2031-03-06", completed: true, priority: "low" },
      { title: "Plain" },
    ]);
  });

  it("stamps every reminder, and reads no field of an alarm inside one", () => {
    expect(remindersToIcs("Home", REMINDERS).match(/^DTSTAMP:\d{8}T\d{6}Z\r$/gm)).toHaveLength(3);
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTODO",
      "SUMMARY:Mine",
      "DESCRIPTION:My notes",
      "BEGIN:VALARM",
      "SUMMARY:The alarm",
      "DESCRIPTION:Its words",
      "END:VALARM",
      "PRIORITY:1",
      "END:VTODO",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(remindersFromIcs(text)).toEqual([
      { title: "Mine", notes: "My notes", priority: "high" },
    ]);
  });

  it("reads a time in UTC or a named zone as that moment on the person's clocks", () => {
    const todo = (due: string) =>
      `BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nSUMMARY:T\r\n${due}\r\nEND:VTODO\r\nEND:VCALENDAR\r\n`;
    expect(remindersFromIcs(todo("DUE:20310305T023000Z"), "America/New_York")).toEqual([
      { title: "T", due: "2031-03-04", dueTime: "21:30" },
    ]);
    expect(
      remindersFromIcs(todo("DUE;TZID=Europe/Paris:20310305T100000"), "America/New_York"),
    ).toEqual([{ title: "T", due: "2031-03-05", dueTime: "04:00" }]);
    expect(remindersFromIcs(todo("DUE:20310305T100000"), "America/New_York")).toEqual([
      { title: "T", due: "2031-03-05", dueTime: "10:00" },
    ]);
  });

  it("leaves out a VTODO with no title and a day that does not exist", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTODO",
      "DUE;VALUE=DATE:20310305",
      "END:VTODO",
      "BEGIN:VTODO",
      "SUMMARY:Kept",
      "DUE;VALUE=DATE:20310230",
      "END:VTODO",
      "BEGIN:VEVENT",
      "SUMMARY:Not a reminder",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(remindersFromIcs(text)).toEqual([{ title: "Kept" }]);
  });
});
