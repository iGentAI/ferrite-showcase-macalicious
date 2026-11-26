import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";
import { CAPTURE_NOW, type CalendarEntry, defaultOwnCalendars } from "./calendar-data";
import {
  importEvents,
  importedId,
  importReport,
  isIcsFile,
  MAX_DOCUMENT_BYTES,
  MAX_EVENTS,
} from "./calendar-files";
import { type IcsImport, parseIcs } from "./calendar-ics";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ics = (...events: string[][]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Test//EN",
    "X-WR-CALNAME:Team",
    ...events.flat(),
    "END:VCALENDAR",
    "",
  ].join("\r\n");

const vevent = (uid: string, title: string, start: string, end: string, ...rest: string[]) => [
  "BEGIN:VEVENT",
  `UID:${uid}`,
  `DTSTART:${start}`,
  `DTEND:${end}`,
  `SUMMARY:${title}`,
  ...rest,
  "END:VEVENT",
];

/** Two events in the week of the capture, 1 and 2 October 2019, in local time. */
const TWO = ics(
  vevent("review@team", "Design Review", "20191001T140000", "20191001T150000"),
  vevent(
    "sync@team",
    "Team Sync",
    "20191002T100000",
    "20191002T103000",
    "RRULE:FREQ=MONTHLY;BYDAY=1WE",
  ),
);

const read = (text: string): IcsImport => parseIcs(text);
const makeId = () => "cal-new";

describe("adding the events of a file", () => {
  it("gives each event an id from its UID, so a second import adds nothing", () => {
    expect(importedId("review@team")).toBe(importedId("review@team"));
    expect(importedId("review@team")).not.toBe(importedId("sync@team"));
    expect(importedId("review@team")).toMatch(/^ics-[0-9a-f]{16}$/);
    // What Calendar exported comes back under its own id.
    expect(importedId("standup@macalicious")).toBe("standup");
    expect(importedId("a/b@macalicious")).toMatch(/^ics-/);
    const first = importEvents([], defaultOwnCalendars, read(TWO), { calendar: "work" }, makeId);
    if ("refused" in first) throw new Error(first.refused.message);
    expect(first.added).toBe(2);
    expect(first.events.map((event) => [event.title, event.calendar])).toEqual([
      ["Design Review", "work"],
      ["Team Sync", "work"],
    ]);
    const again = importEvents(first.events, first.own, read(TWO), { calendar: "home" }, makeId);
    if ("refused" in again) throw new Error(again.refused.message);
    expect([again.added, again.present, again.events.length]).toEqual([0, 2, 2]);
  });

  it("makes a new calendar for them, in a colour no calendar has yet", () => {
    const result = importEvents(
      [],
      defaultOwnCalendars,
      read(TWO),
      { newCalendar: "Team" },
      makeId,
    );
    if ("refused" in result) throw new Error(result.refused.message);
    expect(result.calendar).toBe("cal-new");
    expect(result.own.at(-1)).toEqual({ id: "cal-new", name: "Team", color: "red" });
    expect(result.events.every((event) => event.calendar === "cal-new")).toBe(true);
  });

  it("names a new calendar at most 64 characters long, as the module keeps them", () => {
    const result = importEvents(
      [],
      defaultOwnCalendars,
      read(TWO),
      { newCalendar: `  ${"Rotations ".repeat(10)}` },
      makeId,
    );
    if ("refused" in result) throw new Error(result.refused.message);
    const name = result.own.at(-1)?.name ?? "";
    expect([...name].length).toBeLessThanOrEqual(64);
    expect(name.startsWith("Rotations Rotations")).toBe(true);
    expect(name).toBe(name.trim());
  });

  it("refuses events past Calendar's limits, and changes nothing", () => {
    const many: CalendarEntry[] = Array.from({ length: MAX_EVENTS - 1 }, (_, n) => ({
      id: `e-${n}`,
      title: "x",
      start: new Date(2019, 9, 1),
      end: new Date(2019, 9, 1),
      calendar: "home",
    }));
    const full = importEvents(many, defaultOwnCalendars, read(TWO), { calendar: "home" }, makeId);
    expect("refused" in full && full.refused.message).toBe("There is no room for the 2 events.");
    const long = ics(
      ...Array.from({ length: 40 }, (_, n) =>
        vevent(
          `long-${n}`,
          "Long",
          "20191001T090000",
          "20191001T100000",
          `DESCRIPTION:${"x".repeat(4999)}`,
        ),
      ),
    );
    expect(40 * 4999).toBeGreaterThan(MAX_DOCUMENT_BYTES);
    const big = importEvents([], defaultOwnCalendars, read(long), { calendar: "home" }, makeId);
    expect("refused" in big && big.refused.message).toBe("The events are too long to keep.");
    const calendars = Array.from({ length: 50 }, (_, n) => ({
      id: `c-${n}`,
      name: `C ${n}`,
      color: "red" as const,
    }));
    const crowded = importEvents([], calendars, read(TWO), { newCalendar: "Team" }, makeId);
    expect("refused" in crowded && crowded.refused.message).toBe(
      "There is no room for another calendar.",
    );
  });

  it("says what was imported and what was changed or left out", () => {
    const file = read(
      ics(
        vevent("a", "A", "20191001T090000", "20191001T100000", "RRULE:FREQ=MONTHLY;BYDAY=2TU"),
        vevent("b", "y".repeat(300), "20191001T090000", "20191001T100000"),
        ["BEGIN:VEVENT", "UID:c", "SUMMARY:No start", "END:VEVENT"],
        ["BEGIN:VEVENT", "UID:d", "DTSTART;TZID=Nowhere/Here:20191001T090000", "END:VEVENT"],
      ),
    );
    expect(importReport(file, { added: 2, present: 1 }, "team.ics")).toEqual({
      message: "2 events were imported.",
      detail:
        "1 event of “team.ics” was already in Calendar. 1 event repeats in a way Calendar does not keep, and was imported as a single event. 1 event had a title, notes or address longer than Calendar keeps, which was cut short. 1 event of the file could not be read or was cancelled, and was left out. Times in “Nowhere/Here” were read as your own time zone’s.",
    });
    expect(importReport(read(TWO), { added: 1, present: 0 }, "x.ics")).toEqual({
      message: "1 event was imported.",
      detail:
        "1 event repeats in a way Calendar does not keep, and was imported as a single event.",
    });
  });

  it("knows an iCalendar file by its type or its name", () => {
    expect(isIcsFile({ name: "team.ics" })).toBe(true);
    expect(isIcsFile({ name: "TEAM.ICS" })).toBe(true);
    expect(isIcsFile({ name: "export", type: "text/calendar" })).toBe(true);
    expect(isIcsFile({ name: "cards.vcf", type: "text/vcard" })).toBe(false);
  });
});

describe("Import and Export in the Calendar window", () => {
  const list = () => screen.getByRole("tree", { name: "Calendars" });
  const menu = async (user: ReturnType<typeof userEvent.setup>, row: RegExp, item: string) => {
    fireEvent.contextMenu(within(list()).getByRole("treeitem", { name: row }));
    await user.click(await screen.findByRole("menuitem", { name: item }));
  };
  const event = (name: RegExp) => screen.queryByRole("button", { name });
  /** Read the report the window shows, close it, and wait until the window is in use again. */
  const dismiss = async (user: ReturnType<typeof userEvent.setup>, message: string) => {
    const report = await screen.findByRole("alertdialog");
    expect(within(report).getByText(message)).toBeVisible();
    await user.click(within(report).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  };

  it("imports a picked file into the calendar chosen in its sheet", async () => {
    const user = userEvent.setup();
    render(<Calendar now={CAPTURE_NOW} />);
    await menu(user, /Work/, "Import…");
    const field = screen.getByLabelText("iCalendar file") as HTMLInputElement;
    await user.upload(field, new File([TWO], "team.ics", { type: "text/calendar" }));
    const sheet = await screen.findByRole("dialog", { name: "Import Events" });
    expect(within(sheet).getByText(/Add the 2 events of “team.ics” to a calendar/)).toBeVisible();
    // The calendar chosen at first is the one the list's menu was opened on; Home is chosen.
    expect(within(sheet).getByRole("combobox", { name: "Add to:" })).toHaveTextContent("Work");
    await user.click(within(sheet).getByRole("combobox", { name: "Add to:" }));
    await user.click(await screen.findByRole("option", { name: "Home" }));
    await user.click(within(sheet).getByRole("button", { name: "Import" }));
    await dismiss(user, "2 events were imported.");
    // Both are in the week of the capture, the second as a single event.
    expect(event(/^Design Review, /)).toBeInTheDocument();
    expect(event(/^Team Sync, /)).toBeInTheDocument();

    // A second import of the same file adds nothing.
    await menu(user, /Home/, "Import…");
    await user.upload(field, new File([TWO], "team.ics", { type: "text/calendar" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Import Events" })).getByRole("button", {
        name: "Import",
      }),
    );
    await dismiss(user, "0 events were imported.");
    expect(screen.getAllByRole("button", { name: /^Design Review, / })).toHaveLength(1);
  });

  it("imports into a new calendar named after the file's", async () => {
    const user = userEvent.setup();
    render(<Calendar now={CAPTURE_NOW} />);
    await menu(user, /Work/, "Import…");
    await user.upload(
      screen.getByLabelText("iCalendar file") as HTMLInputElement,
      new File([TWO], "team.ics", { type: "text/calendar" }),
    );
    const sheet = await screen.findByRole("dialog", { name: "Import Events" });
    await user.click(within(sheet).getByRole("combobox", { name: "Add to:" }));
    await user.click(await screen.findByRole("option", { name: "New Calendar “Team”" }));
    await user.click(within(sheet).getByRole("button", { name: "Import" }));
    await dismiss(user, "2 events were imported.");
    await waitFor(() =>
      expect(
        within(list())
          .getAllByRole("treeitem")
          .map((row) => row.textContent),
      ).toEqual(["Home", "Work", "Team", "US Holidays", "Siri Suggestions"]),
    );
  });

  it("says when a file is not one, or holds no events", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Calendar now={CAPTURE_NOW} />);
    const field = () => screen.getByLabelText("iCalendar file") as HTMLInputElement;
    await user.upload(field(), new File(["BEGIN:VCARD"], "cards.vcf", { type: "text/vcard" }));
    expect(await screen.findByText("“cards.vcf” is not an iCalendar file.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "OK" }));
    await user.upload(field(), new File([ics()], "empty.ics", { type: "text/calendar" }));
    expect(await screen.findByText("No events were found in “empty.ics”.")).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Import Events" })).not.toBeInTheDocument();
  });

  it("imports an exported calendar again as the events it already has", async () => {
    const user = userEvent.setup();
    const made: Blob[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        made.push(blob);
        return "blob:calendar";
      },
      revokeObjectURL: () => {},
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<Calendar now={CAPTURE_NOW} />);
    await menu(user, /Work/, "Export “Work”…");
    const exported = await made[0]?.text();
    await menu(user, /Work/, "Import…");
    await user.upload(
      screen.getByLabelText("iCalendar file") as HTMLInputElement,
      new File([exported ?? ""], "Work.ics", { type: "text/calendar" }),
    );
    const sheet = await screen.findByRole("dialog", { name: "Import Events" });
    await user.click(within(sheet).getByRole("button", { name: "Import" }));
    await dismiss(user, "0 events were imported.");
    expect(screen.getAllByRole("button", { name: /^Make Catalina Screenshots, / })).toHaveLength(1);
    click.mockRestore();
  });

  it("exports a calendar as a download of its events", async () => {
    const user = userEvent.setup();
    const made: Blob[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        made.push(blob);
        return "blob:calendar";
      },
      revokeObjectURL: () => {},
    });
    const clicks: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    render(<Calendar now={CAPTURE_NOW} />);
    await menu(user, /Work/, "Export “Work”…");
    expect(clicks).toEqual(["Work.ics"]);
    const text = await made[0]?.text();
    expect(made[0]?.type).toBe("text/calendar");
    expect(text).toContain("X-WR-CALNAME:Work\r\n");
    expect(text).toContain("SUMMARY:Make Catalina Screenshots\r\n");
    // Only Work's events: no holiday.
    expect(text).not.toContain("Labor Day");
    // What was exported reads back as the same events.
    expect(parseIcs(text ?? "").events.map((event) => event.title)).toEqual([
      "Make Catalina Screenshots",
    ]);
    click.mockRestore();
  });
});
