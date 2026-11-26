import { describe, expect, it } from "vitest";
import { calendarTileDate, overdueRemindersIn, unreadMailIn } from "./desktop-dock-life";

const NOON_6_NOV = new Date(2026, 10, 6, 12).getTime();

describe("Mail's Dock count", () => {
  const TODAY = new Date(2026, 10, 6, 9).getTime();
  const YESTERDAY = new Date(2026, 10, 5, 20).getTime();
  const MESSAGES = [
    { mailbox: "inbox", unread: true, at_ms: TODAY },
    { mailbox: "inbox", unread: true, at_ms: YESTERDAY },
    { mailbox: "inbox", unread: false, at_ms: TODAY },
    { mailbox: "box-work", unread: true, at_ms: TODAY },
    { mailbox: "archive", unread: true, at_ms: YESTERDAY },
    { mailbox: "sent", unread: true, at_ms: TODAY },
    { mailbox: "drafts", unread: true, at_ms: TODAY },
    { mailbox: "junk", unread: true, at_ms: TODAY },
    { mailbox: "trash", unread: true, at_ms: TODAY },
  ];

  it("counts the Inbox's unread messages", () => {
    expect(unreadMailIn(MESSAGES, "Inbox Only", NOON_6_NOV)).toBe(2);
  });

  it("counts today's only under Today", () => {
    expect(unreadMailIn(MESSAGES, "Today", NOON_6_NOV)).toBe(1);
  });

  it("counts every mailbox a person reads under All Mailboxes", () => {
    expect(unreadMailIn(MESSAGES, "All Mailboxes", NOON_6_NOV)).toBe(4);
  });
});

describe("Calendar's tile", () => {
  it("says the day it is", () => {
    expect(calendarTileDate(NOON_6_NOV)).toEqual({ month: "NOV", day: "6" });
    expect(calendarTileDate(new Date(2027, 0, 31, 23, 59).getTime())).toEqual({
      month: "JAN",
      day: "31",
    });
  });
});

describe("the Dock's count of overdue reminders", () => {
  it("counts what is not completed and due before today", () => {
    const reply = {
      data: {
        reminders: [
          { id: "a", title: "late", due: "2026-11-05" },
          { id: "b", title: "much later", due: "2025-01-01" },
          { id: "c", title: "done", due: "2026-11-05", completed: true },
          { id: "d", title: "today", due: "2026-11-06" },
          { id: "e", title: "tomorrow", due: "2026-11-07" },
          { id: "f", title: "undated" },
          { id: "g", title: "strange date", due: "soon" },
        ],
      },
    };
    expect(overdueRemindersIn(reply, NOON_6_NOV)).toBe(2);
  });

  it("counts nothing in a reply it cannot read", () => {
    expect(overdueRemindersIn(null, NOON_6_NOV)).toBe(0);
    expect(overdueRemindersIn({ data: null }, NOON_6_NOV)).toBe(0);
    expect(overdueRemindersIn({ data: { reminders: "none" } }, NOON_6_NOV)).toBe(0);
  });
});
