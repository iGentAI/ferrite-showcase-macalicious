import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Calendar, type CalendarProps } from "./calendar";
import { type CalendarEntry, defaultSettings, describe as describeEvent } from "./calendar-data";

const open = (props: CalendarProps = {}) => {
  const user = userEvent.setup();
  render(<Calendar {...props} />);
  return user;
};

const view = (name: string) =>
  within(screen.getByRole("group", { name: "View" })).getByRole("button", { name });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
/** A button of the previous, Today and next control in the view's title row. */
const go = (name: string) =>
  within(screen.getByRole("group", { name: "Go to" })).getByRole("button", { name });
const event = (name: RegExp) => screen.getByRole("button", { name });
const missing = (name: RegExp) => screen.queryByRole("button", { name });
const heading = () => screen.getByRole("heading", { level: 2 }).textContent?.trim();
/** The day names over the week grid's columns. */
const days = () =>
  [...document.querySelectorAll(".mac-calendar-week-grid-day")].map((day) => day.textContent);
const WEEK = ["Sun 29", "Mon 30", "Tue 1", "Wed 2", "Thu 3", "Fri 4", "Sat 5"];

describe("Calendar", () => {
  it("opens on the week of the capture, with today marked and the calendars listed", () => {
    open();
    expect(screen.getByRole("region", { name: "Calendar" })).toHaveClass("mac-window");
    expect(view("Week")).toHaveAttribute("aria-pressed", "true");
    expect(heading()).toBe("October 2019");
    expect(days()).toEqual(WEEK);
    expect(screen.getByText("Thu", { exact: false })).toHaveAttribute("aria-current", "date");
    expect(screen.getByText("3:38 PM")).toBeInTheDocument();
    const list = screen.getByRole("tree", { name: "Calendars" });
    expect(
      within(list)
        .getAllByRole("treeitem")
        .map((row) => row.textContent),
    ).toEqual(["Home", "Work", "US Holidays", "Siri Suggestions"]);
    expect(within(list).getByRole("treeitem", { name: /Work/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches between the day, week, month and year views", async () => {
    const onViewChange = vi.fn();
    const user = open({ onViewChange });
    await user.click(view("Day"));
    expect(view("Day")).toHaveAttribute("aria-pressed", "true");
    expect(days()).toEqual(["Thu 3"]);
    expect(onViewChange).toHaveBeenLastCalledWith("day");

    await user.click(view("Month"));
    expect(days()).toEqual([]);
    expect(heading()).toBe("October 2019");
    expect(event(/^Make Catalina Screenshots, /)).toBeInTheDocument();
    expect(event(/^Halloween, /)).toBeInTheDocument();

    await user.click(view("Year"));
    expect(heading()).toBe("2019");
    expect(screen.getByRole("grid", { name: "January 2019" })).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "December 2019" })).toBeInTheDocument();
    expect(onViewChange).toHaveBeenLastCalledWith("year");

    await user.click(view("Week"));
    expect(days()).toEqual(WEEK);
  });

  it("leaves a controlled view to its owner", async () => {
    const onViewChange = vi.fn();
    const user = open({ view: "week", onViewChange });
    await user.click(view("Day"));
    expect(onViewChange).toHaveBeenCalledWith("day");
    expect(days()).toEqual(WEEK);
  });

  it("steps by the unit of the view, and Today returns", async () => {
    const user = open();
    await user.click(go("Next week"));
    expect(days()).toEqual(["Sun 6", "Mon 7", "Tue 8", "Wed 9", "Thu 10", "Fri 11", "Sat 12"]);
    expect(screen.queryByText("3:38 PM")).not.toBeInTheDocument();
    await user.click(go("Previous week"));
    await user.click(go("Previous week"));
    expect(days()[0]).toBe("Sun 22");
    expect(heading()).toBe("September 2019");
    await user.click(go("Today"));
    expect(days()).toEqual(WEEK);

    await user.click(view("Day"));
    await user.click(go("Next day"));
    expect(days()).toEqual(["Fri 4"]);

    await user.click(view("Month"));
    await user.click(go("Next month"));
    expect(heading()).toBe("November 2019");
    expect(screen.getByText("Thanksgiving")).toBeInTheDocument();

    await user.click(view("Year"));
    await user.click(go("Previous year"));
    expect(heading()).toBe("2018");
    await user.click(go("Today"));
    expect(heading()).toBe("2019");
  });

  it("goes to the week of a day chosen in the mini month", async () => {
    const user = open();
    await user.click(button("Wednesday, October 16, 2019"));
    expect(days()[0]).toBe("Sun 13");
    expect(event(/^Columbus Day/)).toBeInTheDocument();
  });

  it("goes to the day view of a day chosen in the year view", async () => {
    const user = open({ defaultView: "year" });
    await user.click(
      within(screen.getByRole("grid", { name: "December 2019" })).getByRole("button", {
        name: "Wednesday, December 25, 2019",
      }),
    );
    expect(view("Day")).toHaveAttribute("aria-pressed", "true");
    expect(days()).toEqual(["Wed 25"]);
    expect(event(/^Christmas/)).toBeInTheDocument();
  });

  it("selects an event on a click and clears the selection on the empty grid", async () => {
    const user = open();
    const block = event(/^Make Catalina Screenshots/);
    expect(block).toHaveAttribute("aria-pressed", "false");
    await user.click(block);
    expect(block).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("group", { name: "October 2019" }));
    expect(block).toHaveAttribute("aria-pressed", "false");
  });

  it("opens an event's popover on a double click and closes it on Escape", async () => {
    const user = open();
    await user.dblClick(event(/^Make Catalina Screenshots/));
    const popover = await screen.findByRole("dialog", { name: "Make Catalina Screenshots" });
    expect(within(popover).getByText(/Oct 3, 2019\s+2 PM to 4:45 PM/)).toBeInTheDocument();
    expect(within(popover).getByText("Add Location")).toBeInTheDocument();
    expect(within(popover).getByRole("button", { name: "Calendar: Work" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(event(/^Make Catalina Screenshots/)).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the popover with Return, and for an all-day event without times", async () => {
    const user = open();
    event(/^Rosh Hashanah/).focus();
    await user.keyboard("{Enter}");
    const popover = await screen.findByRole("dialog", { name: "Rosh Hashanah" });
    expect(within(popover).getByText(/Sep 30, 2019\s+all-day/)).toBeInTheDocument();
  });

  it("names the other day of an event that reaches one, in the popover's words", () => {
    const entry = (start: Date, end: Date, allDay?: boolean): CalendarEntry => ({
      id: "x",
      title: "X",
      calendar: "work",
      start,
      end,
      allDay,
    });
    const at = (day: number, hours = 0) => new Date(2019, 9, day, hours);
    expect(describeEvent(entry(at(3, 14), at(3, 16)))).toBe("Oct 3, 2019  2 PM to 4 PM");
    expect(describeEvent(entry(at(3, 22), at(4)))).toBe("Oct 3, 2019  10 PM to 12 AM");
    expect(describeEvent(entry(at(3, 23), at(4, 1)))).toBe(
      "Oct 3, 2019  11 PM to Oct 4, 2019  1 AM",
    );
    expect(describeEvent(entry(at(3), at(4), true))).toBe("Oct 3, 2019  all-day");
    expect(describeEvent(entry(at(3), at(6), true))).toBe("Oct 3, 2019 to Oct 5, 2019  all-day");
  });

  it("opens with the popover of the selected event when asked to, and closes it on navigation", async () => {
    const user = open({ defaultSelectedEvent: "screenshots", defaultPopoverOpen: true });
    expect(await screen.findByRole("dialog", { name: "Make Catalina Screenshots" })).toBeVisible();
    await user.click(go("Next week"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("hides the events of a calendar that is unchecked, and keeps the selected calendar", async () => {
    const user = open();
    const home = screen.getByRole("treeitem", { name: /Home/ });
    await user.click(home);
    expect(home).toHaveAttribute("aria-selected", "true");
    const work = screen.getByRole("checkbox", { name: "Show Work" });
    expect(work).toBeChecked();
    await user.click(work);
    expect(work).not.toBeChecked();
    expect(home).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("treeitem", { name: /Work/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(missing(/^Make Catalina Screenshots/)).not.toBeInTheDocument();
    expect(event(/^Rosh Hashanah/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Show US Holidays" }));
    expect(missing(/^Rosh Hashanah/)).not.toBeInTheDocument();
    await user.click(work);
    expect(event(/^Make Catalina Screenshots/)).toBeInTheDocument();
  });

  it("adds a new event to the selected calendar, an hour after now, and selects it", async () => {
    const user = open();
    await user.click(screen.getByRole("treeitem", { name: /Home/ }));
    await user.click(button("New Event"));
    const added = event(/^New Event, Thursday, October 3, 2019, 4 PM – 5 PM$/);
    expect(added).toHaveAttribute("aria-pressed", "true");
    expect(added.style.getPropertyValue("--mac-calendar-week-grid-event-color")).toBe(
      "var(--mac-calendar-cyan)",
    );
    await user.click(button("New Event"));
    expect(screen.getAllByRole("button", { name: /^New Event,/ })).toHaveLength(2);
  });

  it("gives a new event an id of its own, the next hour also late at night, and a listed calendar", async () => {
    const taken: CalendarEntry = {
      id: "new-1",
      title: "Taken",
      start: new Date(2019, 9, 3, 9),
      end: new Date(2019, 9, 3, 10),
      calendar: "home",
    };
    const user = open({
      events: [taken],
      now: new Date(2019, 9, 3, 23, 20),
      defaultView: "day",
      // New events go to Birthdays, which the preferences do not show: Home takes them.
      settings: { ...defaultSettings, defaultCalendar: "birthdays" },
    });
    await user.click(button("New Event"));
    // Midnight is the next day's: the day view of the 3rd does not show it.
    expect(missing(/^New Event,/)).not.toBeInTheDocument();
    expect(event(/^Taken/)).toHaveAttribute("aria-pressed", "false");
    await user.click(go("Next day"));
    const added = event(/^New Event, Friday, October 4, 2019, 12 AM – 1 AM$/);
    expect(added).toHaveAttribute("aria-pressed", "true");
    expect(added.style.getPropertyValue("--mac-calendar-week-grid-event-color")).toBe(
      "var(--mac-calendar-cyan)",
    );
  });

  it("shows a Birthdays event only while the preferences show that calendar", () => {
    const birthday: CalendarEntry = {
      id: "birthday",
      title: "A Birthday",
      start: new Date(2019, 9, 2),
      end: new Date(2019, 9, 3),
      allDay: true,
      calendar: "birthdays",
    };
    const { rerender } = render(<Calendar events={[birthday]} />);
    expect(missing(/^A Birthday/)).not.toBeInTheDocument();
    rerender(
      <Calendar events={[birthday]} settings={{ ...defaultSettings, showBirthdays: true }} />,
    );
    expect(event(/^A Birthday/)).toBeInTheDocument();
  });

  it("draws an event in each day of the month it reaches, including the days around the month", async () => {
    const user = open({
      events: [
        {
          id: "trip",
          title: "Trip",
          start: new Date(2019, 8, 28),
          end: new Date(2019, 9, 2),
          allDay: true,
          calendar: "home",
        },
        {
          id: "august",
          title: "August Only",
          start: new Date(2019, 7, 30),
          end: new Date(2019, 7, 31),
          allDay: true,
          calendar: "home",
        },
      ],
    });
    await user.click(view("Month"));
    const cells = [...document.querySelectorAll<HTMLElement>("[data-day]")];
    expect(
      cells.filter((cell) => cell.textContent?.includes("Trip")).map((cell) => cell.dataset.day),
    ).toEqual(["2019-09-29", "2019-09-30", "2019-10-01"]);
    expect(missing(/^August Only/)).not.toBeInTheDocument();
  });

  it("closes the popover when its event is no longer shown", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Calendar />);
    event(/^Rosh Hashanah/).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Rosh Hashanah" })).toBeVisible();
    rerender(<Calendar settings={{ ...defaultSettings, showHolidays: false }} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows only the events that the search field matches", async () => {
    const user = open();
    await user.type(screen.getByRole("searchbox"), "rosh");
    expect(event(/^Rosh Hashanah/)).toBeInTheDocument();
    expect(missing(/^Make Catalina Screenshots/)).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox"));
    expect(event(/^Make Catalina Screenshots/)).toBeInTheDocument();
  });

  it("hides and shows the list of calendars with the Calendars button", async () => {
    const user = open();
    const toggle = button("Calendars");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tree", { name: "Calendars" })).not.toBeInTheDocument();
    expect(days()).toEqual(WEEK);
    await user.click(toggle);
    expect(screen.getByRole("tree", { name: "Calendars" })).toBeInTheDocument();
  });

  it("follows the preferences: days per week, first day, hours and the two calendars", () => {
    const { rerender } = render(
      <Calendar settings={{ ...defaultSettings, daysPerWeek: 5, weekStartsOn: 1 }} />,
    );
    expect(days()).toEqual(["Mon 30", "Tue 1", "Wed 2", "Thu 3", "Fri 4"]);
    expect(screen.getAllByRole("columnheader")[0]).toHaveAccessibleName("Monday");

    rerender(<Calendar settings={{ ...defaultSettings, weekStartsOn: 1 }} />);
    expect(days()[0]).toBe("Mon 30");
    expect(days()).toHaveLength(7);

    rerender(
      <Calendar settings={{ ...defaultSettings, showHolidays: false, showBirthdays: true }} />,
    );
    expect(missing(/^Rosh Hashanah/)).not.toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: /US Holidays/ })).not.toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /Birthdays/ })).toBeInTheDocument();

    // Twelve hours fill 472 pt; eight make each hour half as tall again.
    const block = event(/^Make Catalina Screenshots/);
    const twelve = Number.parseFloat(block.style.height);
    rerender(<Calendar settings={{ ...defaultSettings, hoursShown: 8 }} />);
    expect(Number.parseFloat(event(/^Make Catalina Screenshots/).style.height)).toBeGreaterThan(
      twelve * 1.4,
    );
  });

  it("reports Command-comma as the Preferences command", async () => {
    const onOpenPreferences = vi.fn();
    const user = open({ onOpenPreferences });
    button("Calendars").focus();
    await user.keyboard(",");
    expect(onOpenPreferences).not.toHaveBeenCalled();
    await user.keyboard("{Meta>},{/Meta}");
    expect(onOpenPreferences).toHaveBeenCalledTimes(1);
  });

  it("is a window a manager can host: state, size, controls and drag region", async () => {
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const user = open({
      state: "inactive",
      width: 900,
      height: 500,
      style: { left: 40 },
      onClose,
      onMinimize,
      onZoom,
      onDragRegionPointerDown,
    });
    const frame = screen.getByRole("region", { name: "Calendar" });
    expect(frame).toHaveAttribute("data-window-state", "inactive");
    expect(frame).toHaveStyle({ width: "900px", height: "500px", left: "40px" });
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button(/Zoom|Full Screen/));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    await user.pointer({
      keys: "[MouseLeft]",
      target: screen.getByRole("toolbar", { name: "Toolbar" }),
    });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
  });
});
