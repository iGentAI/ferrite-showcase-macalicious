import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup } from "macalicious/menu";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { landingAt } from "../desktop/desktop-drag";
import { openItem } from "../desktop/desktop-open-item";
import { changeDesktopValue } from "../desktop/desktop-personal";
import {
  Calendar,
  type CalendarProps,
  HOLIDAY_NOTE,
  NOBODY_TO_MAIL,
  NOT_ON_DESKTOP,
} from "./calendar";
import { archiveFileName, archiveText, readArchive } from "./calendar-archive";
import { CAPTURE_NOW, type CalendarEntry, defaultSettings } from "./calendar-data";
import { restoreArchive } from "./calendar-files";
import { moveCalendarBefore } from "./calendar-groups";
import { holidaysBeside, holidaysOf } from "./calendar-holidays";
import { eventsToIcs, parseIcs } from "./calendar-ics";
import { alternateDate, weekNumber } from "./calendar-options";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  // A served window keeps its view for the account: each test opens on its own week.
  localStorage.clear();
  for (const key of ["alternateShown", "weekNumbers", "yearEvents", "separateEvents"]) {
    changeDesktopValue(`calendar.${key}`, undefined);
  }
});

const DAY_NAME = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d+/;
const days = () =>
  [...document.querySelectorAll(".mac-calendar-week-grid-day")].map(
    (day) => DAY_NAME.exec(day.textContent ?? "")?.[0],
  );
const open = (props: CalendarProps = {}) => {
  const user = userEvent.setup();
  render(<Calendar {...props} />);
  return user;
};
const SCREENSHOTS = "Make Catalina Screenshots";
const block = (title: string) =>
  [...document.querySelectorAll<HTMLElement>("[data-event-id]")].find((each) =>
    each.textContent?.includes(title),
  ) as HTMLElement;
const reply = (status: number, body: unknown) => ({
  ok: status < 300,
  status,
  headers: new Headers(),
  json: async () => body,
});
function serve(
  events: unknown[],
  inbox: unknown = { invitations: [], can_invite: true, me: "chris" },
) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/api/calendar/events" && method === "PUT") {
        return reply(200, { ...JSON.parse(String(init?.body)), rev: 2 });
      }
      if (url === "/api/calendar/events") return reply(200, { events, rev: 1 });
      if (url === "/api/calendar/inbox") return reply(200, inbox);
      if (url === "/api/calendar/sent") return reply(200, { events: {} });
      return reply(404, { error: "not found" });
    }),
  );
}
const settled = () =>
  waitFor(() => expect(document.querySelector(".mac-calendar-body")).not.toHaveAttribute("inert"));

describe("alternate calendars and week numbers", () => {
  it("writes a date in each calendar", () => {
    const day = new Date(2019, 9, 3);
    expect(alternateDate(day, "hebrew")).toBe("4 Tishri");
    expect(alternateDate(day, "islamic")).toBe("Safar 3");
    expect(alternateDate(day, "chinese")).toBe("初五");
    expect(alternateDate(new Date(2019, 8, 29), "chinese")).toBe("九月");
  });

  it("numbers weeks from the one that holds January 1", () => {
    expect(weekNumber(new Date(2019, 0, 1), 0)).toBe(1);
    expect(weekNumber(new Date(2019, 0, 6), 0)).toBe(2);
    expect(weekNumber(new Date(2019, 9, 3), 0)).toBe(40);
    expect(weekNumber(new Date(2019, 11, 31), 0)).toBe(1);
  });

  it("shows the alternate calendar in the month's days and on the week's headings", async () => {
    changeDesktopValue("calendar.alternateCalendar", "hebrew");
    open({ settings: { ...defaultSettings, showAlternateCalendar: true }, defaultView: "month" });
    expect(
      within(document.querySelector('[data-day="2019-10-03"]') as HTMLElement).getByText(
        "4 Tishri",
      ),
    ).toBeInTheDocument();
  });

  it("marks the week's headings and title", () => {
    changeDesktopValue("calendar.alternateCalendar", "hebrew");
    changeDesktopValue("calendar.weekNumbers", true);
    open({ settings: { ...defaultSettings, showAlternateCalendar: true } });
    const thursday = document.querySelectorAll<HTMLElement>(".mac-calendar-week-grid-day")[4];
    expect(thursday?.dataset.alternate).toBe("4 Tishri");
    expect(
      document.querySelector<HTMLElement>(".mac-calendar-week-grid-title")?.dataset.weekNumber,
    ).toBe("Week 40");
  });

  it("numbers the month's weeks in their first column while asked", () => {
    changeDesktopValue("calendar.weekNumbers", true);
    open({ defaultView: "month" });
    expect(
      within(document.querySelector('[data-day="2019-09-29"]') as HTMLElement).getByText("Week 40"),
    ).toBeInTheDocument();
  });

  it("leaves the year view's days unshaded when Show events in year view is off", () => {
    open({ defaultView: "year" });
    expect(document.querySelector("[data-density]")).not.toBeNull();
    changeDesktopValue("calendar.yearEvents", false);
    return waitFor(() => expect(document.querySelector("[data-density]")).toBeNull());
  });
});

describe("Scroll in week view by", () => {
  const next = () => screen.getByRole("button", { name: "Next week" });
  it("steps a day at a time, the date shown first", async () => {
    const user = open({ settings: { ...defaultSettings, scrollBy: "day" } });
    expect(days()[0]).toBe("Thu 3");
    await user.click(next());
    expect(days()).toEqual(["Fri 4", "Sat 5", "Sun 6", "Mon 7", "Tue 8", "Wed 9", "Thu 10"]);
  });

  it("steps a week by default, and with a sideways scroll", () => {
    open();
    expect(days()[0]).toBe("Sun 29");
    const grid = document.querySelector(".mac-calendar-view-menu") as HTMLElement;
    fireEvent.wheel(grid, { deltaX: 40 });
    expect(days()[0]).toBe("Sun 29");
    fireEvent.wheel(grid, { deltaX: 40 });
    expect(days()[0]).toBe("Sun 6");
    fireEvent.wheel(grid, { deltaY: 400 });
    expect(days()[0]).toBe("Sun 6");
  });

  it("ends a sideways scroll on today's week with Stop on Today", () => {
    open({
      settings: { ...defaultSettings, scrollBy: "week-stop-on-today" },
      defaultDate: new Date(2019, 8, 20),
    });
    expect(days()[0]).toBe("Sun 15");
    const grid = document.querySelector(".mac-calendar-view-menu") as HTMLElement;
    for (let at = 0; at < 8; at++) fireEvent.wheel(grid, { deltaX: 100 });
    expect(days()[0]).toBe("Sun 29");
  });
});

describe("holidays", () => {
  it("works each one out for any year", () => {
    const on = (year: number, title: string) =>
      holidaysOf(year)
        .find((each) => each.title === title)
        ?.start.toDateString();
    expect(on(2026, "Labor Day")).toBe("Mon Sep 07 2026");
    expect(on(2026, "Thanksgiving")).toBe("Thu Nov 26 2026");
    expect(on(2026, "Memorial Day")).toBe("Mon May 25 2026");
    expect(on(2019, "Rosh Hashanah")).toBe("Mon Sep 30 2019");
    expect(on(2019, "Yom Kippur")).toBe("Wed Oct 09 2019");
    expect(on(2026, "Rosh Hashanah")).toBe("Sat Sep 12 2026");
  });

  it("adds none a calendar already holds on that day", () => {
    const stored: CalendarEntry = {
      id: "labor-day",
      title: "Labor Day",
      start: new Date(2026, 8, 7),
      end: new Date(2026, 8, 8),
      allDay: true,
      calendar: "holidays",
    };
    expect(holidaysBeside([stored], [2026]).map((each) => each.title)).not.toContain("Labor Day");
  });

  it("shows them on a served desktop, as details nobody can change", async () => {
    serve([]);
    const user = open({ now: new Date(2026, 8, 7, 9), defaultDate: new Date(2026, 8, 7) });
    await settled();
    await user.dblClick(block("Labor Day"));
    expect(await screen.findByText(HOLIDAY_NOTE)).toBeInTheDocument();
    fireEvent.contextMenu(block("Labor Day"));
    expect(await screen.findByRole("menuitem", { name: "Delete" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("the calendar archive", () => {
  const lunch: CalendarEntry = {
    id: "lunch",
    title: "Lunch",
    start: new Date(2026, 2, 3, 12),
    end: new Date(2026, 2, 3, 13),
    calendar: "kids",
    alert: 15,
  };
  const made = () => {
    let count = 0;
    return () => `made-${++count}`;
  };

  it("names its file by the day", () => {
    expect(archiveFileName(new Date(2026, 2, 3))).toBe("Calendar Archive 2026-03-03.icbu");
  });

  it("brings every calendar back, with its colour, its events and their alerts", () => {
    const text = archiveText([lunch], [{ id: "kids", name: "Kids", color: "green" }]);
    const archive = readArchive(text);
    expect(archive).not.toBeNull();
    const restored = restoreArchive([], [], archive ?? [], made());
    if ("refused" in restored) throw new Error(restored.refused.message);
    expect(restored.own).toEqual([{ id: "made-1", name: "Kids", color: "green" }]);
    expect(restored.added).toBe(1);
    expect(restored.events[0]).toMatchObject({
      id: "lunch",
      title: "Lunch",
      calendar: "made-1",
      alert: 15,
    });
  });

  it("adds to the calendar of that name and adds nothing a second time", () => {
    const own = [{ id: "home", name: "Kids", color: "blue" as const }];
    const archive = readArchive(
      archiveText([lunch], [{ id: "kids", name: "Kids", color: "green" }]),
    );
    const once = restoreArchive([], own, archive ?? [], made());
    if ("refused" in once) throw new Error(once.refused.message);
    expect(once.own).toEqual(own);
    expect(once.events[0]?.calendar).toBe("home");
    const twice = restoreArchive(once.events, once.own, archive ?? [], made());
    if ("refused" in twice) throw new Error(twice.refused.message);
    expect(twice.added).toBe(0);
    expect(twice.present).toBe(1);
  });

  it("does not take an iCalendar file or other JSON for one", () => {
    expect(readArchive("BEGIN:VCALENDAR")).toBeNull();
    expect(readArchive('{"format":"other"}')).toBeNull();
  });
});

describe("what an export holds", () => {
  const full: CalendarEntry = {
    id: "review",
    title: "Review",
    start: new Date(Date.UTC(2026, 2, 3, 12)),
    end: new Date(Date.UTC(2026, 2, 3, 13)),
    calendar: "work",
    alert: 30,
    showAs: "free",
    travelTime: 45,
    invitees: ["anna"],
    attachments: [{ id: "f1", name: "Plan.pdf", type: "application/pdf", size: 10 }],
  };

  it("writes alarms, attendees, attachments, availability and travel", () => {
    const text = eventsToIcs([full], { now: new Date(Date.UTC(2026, 0, 1)) }).replaceAll(
      "\r\n ",
      "",
    );
    expect(text).toContain("UID:review@macalicious");
    expect(text).toContain(
      "BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Review\r\nTRIGGER:-PT30M",
    );
    expect(text).toContain('ATTENDEE;CN="anna":urn:macalicious:account:anna');
    expect(text).toContain('ATTACH;FMTTYPE=application/pdf;FILENAME="Plan.pdf":');
    expect(text).toContain("/api/calendar/attachments/f1");
    expect(text).toContain("TRANSP:TRANSPARENT");
    expect(text).toContain("X-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT45M");
  });

  it("reads back all but the people invited, whom an import never invites", () => {
    const [read] = parseIcs(eventsToIcs([full])).events;
    expect(read).toMatchObject({ alert: 30, showAs: "free", travelTime: 45 });
    expect(read).not.toHaveProperty("invitees");
  });

  it("reads an alarm after the start as Calendar counts it, and refuses one out of range", () => {
    const ics = (trigger: string) =>
      `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART;VALUE=DATE:20260303\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:${trigger}\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    expect(parseIcs(ics("PT9H")).events[0]?.alert).toBe(-540);
    expect(parseIcs(ics("-P60D")).events[0]?.alert).toBeUndefined();
  });
});

describe("the sidebar", () => {
  it("puts a dragged calendar before the one it is dropped on", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveCalendarBefore(list, "c", "a").map(({ id }) => id)).toEqual(["c", "a", "b"]);
    expect(moveCalendarBefore(list, "a", "c").map(({ id }) => id)).toEqual(["b", "a", "c"]);
    expect(moveCalendarBefore(list, "a", "a")).toBe(list);
    expect(moveCalendarBefore(list, "gone", "a")).toBe(list);
  });

  it("reorders the list by a drag of a row", () => {
    open();
    const row = (name: string) =>
      document.querySelector(`[data-calendar="${name}"]`) as HTMLElement;
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
      get types() {
        return [...data.keys()];
      },
      effectAllowed: "",
    };
    fireEvent.dragStart(row("work"), { dataTransfer });
    fireEvent.dragOver(row("home"), { dataTransfer });
    fireEvent.drop(row("home"), { dataTransfer });
    const names = within(screen.getByRole("tree", { name: "Calendars" }))
      .getAllByRole("treeitem")
      .map((each) => each.textContent);
    expect(names.slice(0, 2)).toEqual(["Work", "Home"]);
  });

  it("offers a mini month's day its own menu", async () => {
    const user = open();
    const day = document.querySelector('.mac-calendar-sidebar [data-date="2019-10-17"]') as Element;
    fireEvent.contextMenu(day);
    await user.click(await screen.findByRole("menuitem", { name: "Show Day" }));
    expect(screen.getByRole("heading", { name: /October 2019/ })).toBeInTheDocument();
    expect(days()).toEqual(["Thu 17"]);
  });

  it("makes an event on a mini month's day and shows it", async () => {
    const user = open();
    const day = document.querySelector('.mac-calendar-sidebar [data-date="2019-10-17"]') as Element;
    fireEvent.contextMenu(day);
    await user.click(await screen.findByRole("menuitem", { name: "New All-Day Event" }));
    expect(days()[0]).toBe("Sun 13");
    expect(block("New Event")).toBeInTheDocument();
  });

  it("offers a day's heading in the week its own day", async () => {
    const user = open();
    fireEvent.contextMenu(
      document.querySelectorAll(".mac-calendar-week-grid-day")[2] as HTMLElement,
    );
    await user.click(await screen.findByRole("menuitem", { name: "Show Day" }));
    expect(days()).toEqual(["Tue 1"]);
  });
});

describe("an event's menu", () => {
  it("dims Mail Event and Show in Maps off the desktop, saying why", async () => {
    open();
    fireEvent.contextMenu(block(SCREENSHOTS));
    const mail = await screen.findByRole("menuitem", { name: "Mail Event" });
    expect(mail).toHaveAttribute("aria-disabled", "true");
    expect(mail).toHaveAttribute("title", NOT_ON_DESKTOP);
  });

  it("mails each person invited, about the event", async () => {
    const LUNCH = {
      id: "lunch",
      title: "Lunch",
      start: new Date(2019, 9, 2, 12).getTime(),
      end: new Date(2019, 9, 2, 13).getTime(),
      calendar: "work",
      invitees: ["anna"],
      location: "Cafe Luna",
    };
    serve([LUNCH]);
    const asked: unknown[] = [];
    const hear = (event: Event) => asked.push((event as CustomEvent).detail);
    window.addEventListener("macalicious:address-request", hear);
    const searched: unknown[] = [];
    const heard = (event: Event) => searched.push((event as CustomEvent).detail);
    window.addEventListener("macalicious:maps-search", heard);
    const user = open({ now: CAPTURE_NOW });
    await settled();
    fireEvent.contextMenu(block("Lunch"));
    await user.click(await screen.findByRole("menuitem", { name: "Mail Event" }));
    expect(asked).toEqual([{ app: "mail", to: "anna", name: "anna", subject: "Lunch" }]);
    fireEvent.contextMenu(block("Lunch"));
    await user.click(await screen.findByRole("menuitem", { name: "Show in Maps" }));
    expect(searched).toEqual(["Cafe Luna"]);
    window.removeEventListener("macalicious:address-request", hear);
    window.removeEventListener("macalicious:maps-search", heard);
  });

  it("dims Mail Event on an event nobody is invited to", async () => {
    serve([
      {
        id: "solo",
        title: "Solo",
        start: new Date(2019, 9, 2, 12).getTime(),
        end: new Date(2019, 9, 2, 13).getTime(),
        calendar: "work",
      },
    ]);
    open({ now: CAPTURE_NOW });
    await settled();
    fireEvent.contextMenu(block("Solo"));
    expect(await screen.findByRole("menuitem", { name: "Mail Event" })).toHaveAttribute(
      "title",
      NOBODY_TO_MAIL,
    );
  });

  it("shows the event's details in the Inspector with Open events in separate windows", async () => {
    changeDesktopValue("calendar.separateEvents", true);
    const user = open();
    await user.dblClick(block(SCREENSHOTS));
    expect(await screen.findByRole("region", { name: "Inspector" })).toBeInTheDocument();
    expect(document.querySelector(".mac-calendar-popover")).toBeNull();
  });
});

describe("files on an event's block", () => {
  const LUNCH = {
    id: "lunch",
    title: "Lunch",
    start: new Date(2019, 9, 2, 12).getTime(),
    end: new Date(2019, 9, 2, 13).getTime(),
    calendar: "work",
  };
  it("lands on the block of an event of the person's own, and leaves an .ics to the window", async () => {
    serve([LUNCH]);
    open({ now: CAPTURE_NOW });
    await settled();
    const picture = { id: "a", name: "a.png", kind: "file" as const, type: "image/png" };
    const on = block("Lunch");
    expect(landingAt(on, { from: "finder", items: [picture] } as never)?.element).toBe(on);
    const ics = { id: "b", name: "b.ics", kind: "file" as const };
    expect(landingAt(on, { from: "finder", items: [ics] } as never)?.element).not.toBe(on);
  });
});

describe("Spotlight's event", () => {
  it("goes to the event's day and selects it, however far that is", async () => {
    serve([
      {
        id: "far",
        title: "Far Away",
        start: new Date(2021, 4, 12, 9).getTime(),
        end: new Date(2021, 4, 12, 10).getTime(),
        calendar: "work",
      },
    ]);
    open({ now: CAPTURE_NOW });
    await settled();
    expect(block("Far Away")).toBeUndefined();
    openItem({ app: "calendar", id: "far", title: "Far Away" });
    await waitFor(() => expect(block("Far Away")).toHaveAttribute("aria-pressed", "true"));
    expect(days()[0]).toBe("Sun 9");
  });
});

describe("the Edit menu's text tools", () => {
  function EditMenu() {
    const items = useDesktopAppMenuItems("calendar", "Edit");
    return (
      <Menu open>
        <MenuPopup>{items}</MenuPopup>
      </Menu>
    );
  }

  it("speaks the selected event when no notes field has the keyboard", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Calendar defaultSelectedEvent="screenshots" />);
    render(<EditMenu />);
    await user.click(await screen.findByRole("menuitem", { name: "Speech" }));
    const start = await screen.findByRole("menuitem", { name: "Start Speaking" });
    expect(start).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(start);
    expect(speak.mock.calls[0]?.[0].text).toContain(SCREENSHOTS);
  });

  it("keeps the popover, and so its notes, while the menu bar is used", async () => {
    const user = userEvent.setup();
    render(
      <>
        <div role="menubar">Edit</div>
        <div>Elsewhere</div>
        <Calendar defaultSelectedEvent="screenshots" defaultPopoverOpen />
      </>,
    );
    await screen.findByRole("button", { name: /Add Notes/ });
    await user.click(screen.getByRole("menubar"));
    expect(screen.getByRole("button", { name: /Add Notes/ })).toBeInTheDocument();
    await user.click(screen.getByText("Elsewhere"));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Add Notes/ })).not.toBeInTheDocument(),
    );
  });

  it("asks the browser for a curly quote as one is typed in an event's notes", async () => {
    const insert = vi.fn(() => true);
    document.execCommand = insert as typeof document.execCommand;
    const user = open({ defaultSelectedEvent: "screenshots", defaultPopoverOpen: true });
    await user.click(await screen.findByRole("button", { name: /Add Notes/ }));
    const notes = await screen.findByRole("textbox", { name: /Notes/ });
    await user.type(notes, 'say "');
    expect(insert).toHaveBeenCalledWith("insertText", false, "“");
    Reflect.deleteProperty(document, "execCommand");
    render(<EditMenu />);
    expect(
      await screen.findByRole("menuitem", { name: "Spelling and Grammar" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("an accepted invitation's alert", () => {
  const start = CAPTURE_NOW.getTime() + 5 * 60_000;
  const inbox = (status: string) => ({
    invitations: [
      {
        id: "0123456789abcdef0123456789abcdef",
        version: 1,
        organizer: { name: "m", full_name: "M K" },
        event: { title: "Design Review", start, end: start + 36e5 },
        status,
        invitees: [],
      },
    ],
    can_invite: true,
    me: "chris",
  });
  const settings = { ...defaultSettings, defaultAlert: 15 };

  it("shows with the default alert once accepted", async () => {
    serve([], inbox("accepted"));
    open({ now: CAPTURE_NOW, settings });
    expect(
      await screen.findByText("Design Review", { selector: "[data-event-alert] *" }),
    ).toBeInTheDocument();
  });

  it("does not show while it is unanswered", async () => {
    serve([], inbox("pending"));
    open({ now: CAPTURE_NOW, settings });
    await settled();
    await screen.findAllByText("Design Review");
    expect(document.querySelector("[data-event-alert]")).toBeNull();
  });
});
