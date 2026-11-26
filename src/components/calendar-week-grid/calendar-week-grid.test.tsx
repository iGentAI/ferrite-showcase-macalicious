import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { CalendarWeekGrid, type CalendarWeekGridEvent, type CalendarWeekGridProps } from "./index";

const screenshots: CalendarWeekGridEvent = {
  id: "screenshots",
  title: "Make Catalina Screenshots",
  start: new Date(2019, 9, 3, 14),
  end: new Date(2019, 9, 3, 16, 45),
  color: "purple",
};
const holiday: CalendarWeekGridEvent = {
  id: "holiday",
  title: "Rosh Hashanah",
  start: new Date(2019, 8, 30),
  end: new Date(2019, 9, 1),
  allDay: true,
};

function Week(props: Partial<CalendarWeekGridProps>) {
  return (
    <CalendarWeekGrid
      data-testid="grid"
      start={new Date(2019, 8, 29, 17)}
      events={[screenshots, holiday]}
      {...props}
    />
  );
}

const event = (name: RegExp) => screen.getByRole("button", { name });
const texts = (selector: string) =>
  [...screen.getByTestId("grid").querySelectorAll(selector)].map((element) => element.textContent);

describe("CalendarWeekGrid", () => {
  it("shows the days from the start, titled with the month and year of the middle one", () => {
    render(<Week />);
    expect(screen.getByRole("heading", { name: "October 2019" })).toBeInTheDocument();
    expect(texts(".mac-calendar-week-grid-day")).toEqual([
      "Sun 29",
      "Mon 30",
      "Tue 1",
      "Wed 2",
      "Thu 3",
      "Fri 4",
      "Sat 5",
    ]);
    expect(screen.getByText("Sat", { exact: false })).toHaveAttribute("data-weekend");
    expect(screen.getByText("Mon", { exact: false })).not.toHaveAttribute("data-weekend");
  });

  it("shows as many days as asked for, and names them in the locale", () => {
    render(<Week days={2} locale="de-DE" start={new Date(2019, 9, 3)} />);
    expect(texts(".mac-calendar-week-grid-day")).toEqual(["Do 3", "Fr 4"]);
    expect(screen.getByRole("heading", { name: "Oktober 2019" })).toBeInTheDocument();
  });

  it("names an event with its title, day and times, and an all-day event without times", () => {
    render(<Week />);
    expect(
      event(/^Make Catalina Screenshots, Thursday, October 3, 2019, 2 PM – 4:45 PM$/),
    ).toHaveTextContent("2 PMMake Catalina Screenshots");
    const allDay = event(/^Rosh Hashanah, Monday, September 30, 2019$/);
    expect(allDay).toHaveTextContent(/^Rosh Hashanah$/);
    expect(allDay.parentElement).toContainElement(screen.getByText("all-day"));
  });

  it("places an event by its times and the hour height, in its day's column", () => {
    render(<Week hourHeight={50} />);
    const block = event(/Make Catalina/);
    // 2 PM is 700 pt down; the block starts 2 pt under the hour's line and is 2 pt shorter.
    expect(block).toHaveStyle({ top: "702px", height: "135.5px", width: "100%" });
    const columns = [
      ...screen.getByTestId("grid").querySelectorAll(".mac-calendar-week-grid-column"),
    ];
    expect(columns.indexOf(block.parentElement as Element)).toBe(4);
    expect(event(/Rosh Hashanah/)).toHaveStyle({ gridColumn: "3 / 4" });
  });

  it("gives overlapping events a lane each and leaves the others their full width", () => {
    const at = (id: string, from: number, to: number): CalendarWeekGridEvent => ({
      id,
      title: id,
      start: new Date(2019, 9, 1, from),
      end: new Date(2019, 9, 1, to),
    });
    render(<Week events={[at("first", 9, 11), at("second", 10, 12), at("alone", 13, 14)]} />);
    expect(event(/^first/)).toHaveStyle({ insetInlineStart: "0%", width: "50%" });
    expect(event(/^second/)).toHaveStyle({ insetInlineStart: "50%", width: "50%" });
    expect(event(/^alone/)).toHaveStyle({ insetInlineStart: "0%", width: "100%" });
  });

  it("leaves out events outside the days shown and splits one that crosses midnight", () => {
    const late: CalendarWeekGridEvent = {
      id: "late",
      title: "Late shift",
      start: new Date(2019, 9, 5, 22),
      end: new Date(2019, 9, 6, 2),
    };
    const night: CalendarWeekGridEvent = {
      id: "night",
      title: "Night train",
      start: new Date(2019, 9, 1, 23),
      end: new Date(2019, 9, 2, 1),
    };
    const next = { ...screenshots, id: "next", title: "Next week", start: new Date(2019, 9, 7) };
    render(<Week events={[late, night, { ...next, end: new Date(2019, 9, 7, 1) }]} />);
    expect(screen.queryByRole("button", { name: /Next week/ })).not.toBeInTheDocument();
    // Saturday is the last day shown: only the part before midnight is there.
    expect(screen.getAllByRole("button", { name: /Late shift/ })).toHaveLength(1);
    const parts = screen.getAllByRole("button", { name: /Night train/ });
    const columns = [
      ...screen.getByTestId("grid").querySelectorAll(".mac-calendar-week-grid-column"),
    ];
    expect(parts.map((part) => columns.indexOf(part.parentElement as Element))).toEqual([2, 3]);
    expect(parts[1]).toHaveStyle({ top: "2px", height: "38px" });
  });

  it("selects an event on click and clears the selection on a click in the empty grid", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Week onValueChange={onValueChange} />);
    const block = event(/Make Catalina/);
    expect(block).toHaveAttribute("aria-pressed", "false");
    await user.click(block);
    expect(block).toHaveAttribute("aria-pressed", "true");
    expect(onValueChange).toHaveBeenLastCalledWith("screenshots");
    await user.click(event(/Rosh Hashanah/));
    expect(block).toHaveAttribute("aria-pressed", "false");
    expect(event(/Rosh Hashanah/)).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("group", { name: "October 2019" }));
    expect(event(/Rosh Hashanah/)).toHaveAttribute("aria-pressed", "false");
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(onValueChange).toHaveBeenCalledTimes(3);
  });

  it("clears the selection on a click beside the events of the all-day row", async () => {
    const user = userEvent.setup();
    render(<Week defaultValue="holiday" />);
    await user.click(screen.getByText("all-day"));
    expect(event(/Rosh Hashanah/)).toHaveAttribute("aria-pressed", "false");
  });

  it("draws an event that is over when it starts as a point in time, also at midnight", () => {
    const at = (id: string, hour: number): CalendarWeekGridEvent => ({
      id,
      title: id,
      start: new Date(2019, 9, 1, hour),
      end: new Date(2019, 9, 1, hour),
    });
    render(<Week events={[at("midnight", 0), at("noon", 12)]} />);
    expect(event(/^midnight/)).toHaveStyle({ top: "2px", height: "0px" });
    expect(event(/^noon/)).toHaveStyle({ top: "482px", height: "0px" });
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("starts with defaultValue selected, and follows value when it is controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Week defaultValue="holiday" />);
    expect(event(/Rosh Hashanah/)).toHaveAttribute("aria-pressed", "true");
    rerender(<Week value="screenshots" onValueChange={onValueChange} />);
    expect(event(/Make Catalina/)).toHaveAttribute("aria-pressed", "true");
    await user.click(event(/Rosh Hashanah/));
    expect(onValueChange).toHaveBeenCalledWith("holiday");
    expect(event(/Make Catalina/)).toHaveAttribute("aria-pressed", "true");
    await user.click(event(/Make Catalina/));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("reports a double click and Return as the event's action; Space only selects", async () => {
    const user = userEvent.setup();
    const onEventAction = vi.fn();
    render(<Week onEventAction={onEventAction} />);
    const block = event(/Make Catalina/);
    await user.dblClick(block);
    expect(onEventAction).toHaveBeenCalledTimes(1);
    expect(onEventAction).toHaveBeenLastCalledWith(screenshots, block);

    const other = event(/Rosh Hashanah/);
    other.focus();
    await user.keyboard(" ");
    expect(other).toHaveAttribute("aria-pressed", "true");
    expect(onEventAction).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    expect(onEventAction).toHaveBeenLastCalledWith(holiday, other);
    expect(onEventAction).toHaveBeenCalledTimes(2);
  });

  it("puts every event and the grid in the tab order", async () => {
    const user = userEvent.setup();
    render(<Week />);
    await user.tab();
    expect(event(/Rosh Hashanah/)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("group", { name: "October 2019" })).toHaveFocus();
    await user.tab();
    expect(event(/Make Catalina/)).toHaveFocus();
  });

  it("marks today, draws the current time and drops the hour its label would touch", () => {
    render(<Week now={new Date(2019, 9, 4, 10, 57)} />);
    expect(screen.getByText("Fri", { exact: false })).toHaveAttribute("aria-current", "date");
    expect(screen.getByText("Thu", { exact: false })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("10:57 AM")).toHaveClass("mac-calendar-week-grid-now");
    const hours = texts(".mac-calendar-week-grid-hour");
    expect(hours).toContain("10 AM");
    expect(hours).not.toContain("11 AM");
    expect(hours).toContain("Noon");
  });

  it("draws no current time while today is not among the days", () => {
    render(<Week now={new Date(2019, 9, 9, 10, 57)} />);
    expect(screen.queryByText("10:57 AM")).not.toBeInTheDocument();
    expect(screen.getByTestId("grid").querySelector("[aria-current]")).toBeNull();
    expect(texts(".mac-calendar-week-grid-hour").filter(Boolean)).toHaveLength(23);
  });

  it("formats times with formatTime and takes the labels of noon and the all-day row", () => {
    render(
      <Week
        formatTime={(date) => `${date.getHours()}h${date.getMinutes() || ""}`}
        noonLabel={null}
        allDayLabel="ganztägig"
        now={new Date(2019, 9, 1, 7, 20)}
      />,
    );
    const hours = texts(".mac-calendar-week-grid-hour");
    expect(hours.slice(10, 13)).toEqual(["11h", "12h", "13h"]);
    expect(screen.getByText("7h20")).toBeInTheDocument();
    expect(within(event(/Make Catalina/)).getByText("14h")).toBeInTheDocument();
    expect(event(/Make Catalina/)).toHaveAccessibleName(/14h – 16h45$/);
    expect(screen.getByText("ganztägig")).toBeInTheDocument();
  });

  it("scrolls to defaultScrollHour, and again when it or the hour height changes", () => {
    const { rerender } = render(<Week />);
    const viewport = screen.getByRole("group", { name: "October 2019" });
    expect(viewport.scrollTop).toBe(320);
    viewport.scrollTop = 0;
    rerender(<Week events={[]} />);
    expect(viewport.scrollTop).toBe(0);
    rerender(<Week defaultScrollHour={6.5} hourHeight={30} />);
    expect(viewport.scrollTop).toBe(195);
  });

  it("puts the accessory in the title row and an event's colour on its block", () => {
    render(<Week accessory={<button type="button">Today</button>} />);
    expect(screen.getByRole("button", { name: "Today" }).parentElement).toBe(
      screen.getByRole("heading").parentElement,
    );
    expect(
      event(/Make Catalina/).style.getPropertyValue("--mac-calendar-week-grid-event-color"),
    ).toBe("purple");
    expect(
      event(/Rosh Hashanah/).style.getPropertyValue("--mac-calendar-week-grid-event-color"),
    ).toBe("");
  });

  it("forwards ref, className, style and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Week ref={ref} className="extra" id="week" style={{ height: 400 }} />);
    expect(ref.current).toHaveClass("mac-calendar-week-grid", "extra");
    expect(ref.current).toHaveAttribute("id", "week");
    expect(ref.current).toHaveStyle({ height: "400px" });
  });
});
