import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker, DatePickerCalendar, DatePickerClock } from "./index";

// Every date here is built from local-time parts and read back through local-time getters,
// and none falls on a daylight-saving change, so the tests do not depend on the time zone.
// The texts are fixed too: the order of the elements, the month names and the weekday names
// are the component's own, not the locale's.
const OCTOBER_3 = new Date(2019, 9, 3, 10, 56, 59);

const FIGURE_SPACE = "\u2007";
const NO_BREAK_SPACE = "\u00a0";

const element = (name: string) => screen.getByRole("spinbutton", { name });
const up = () => screen.getByRole("button", { name: "Increment" });
const down = () => screen.getByRole("button", { name: "Decrement" });
/** The day `number` of the month the calendar shows, not its namesake in a neighbouring month. */
const day = (number: number) => {
  const found = screen
    .getAllByRole("gridcell", { name: String(number) })
    .find((cell) => !cell.hasAttribute("data-outside"));
  if (!found) throw new Error(`no day ${number} in the month shown`);
  return found;
};
const selectedDay = () => screen.getByRole("gridcell", { selected: true });

afterEach(() => {
  vi.useRealTimers();
});

describe("DatePicker", () => {
  it("renders a group of elements with their values, bounds and names", () => {
    render(<DatePicker aria-label="Due" defaultValue={OCTOBER_3} />);
    const group = screen.getByRole("group", { name: "Due" });
    expect(group).toHaveClass("mac-date-picker");
    expect(group).toHaveAttribute("data-size", "regular");
    expect(group).not.toHaveAttribute("data-disabled");

    expect(
      screen.getAllByRole("spinbutton").map((item) => item.getAttribute("aria-label")),
    ).toEqual(["Month", "Day", "Year", "Hour", "Minute", "Second", "AM/PM"]);
    expect(element("Month")).toHaveAttribute("aria-valuenow", "10");
    expect(element("Month")).toHaveAttribute("aria-valuemin", "1");
    expect(element("Month")).toHaveAttribute("aria-valuemax", "12");
    expect(element("Day")).toHaveAttribute("aria-valuenow", "3");
    expect(element("Day")).toHaveAttribute("aria-valuemax", "31");
    expect(element("Day")).toHaveAttribute("aria-valuetext", "3");
    expect(element("Year")).toHaveAttribute("aria-valuenow", "2019");
    expect(element("Hour")).toHaveAttribute("aria-valuenow", "10");
    expect(element("Hour")).toHaveAttribute("aria-valuemax", "12");
    expect(element("Minute")).toHaveAttribute("aria-valuenow", "56");
    expect(element("Second")).toHaveAttribute("aria-valuenow", "59");
    expect(element("AM/PM")).toHaveAttribute("aria-valuenow", "0");
    expect(element("AM/PM")).toHaveAttribute("aria-valuetext", "AM");
  });

  it("sets the text as AppKit does: United States order, a figure space before one digit", () => {
    render(<DatePicker aria-label="Due" defaultValue={OCTOBER_3} />);
    expect(element("Month").parentElement?.textContent).toBe(
      `10/${FIGURE_SPACE}3/2019${NO_BREAK_SPACE}10:56:59${NO_BREAK_SPACE}AM`,
    );
  });

  it("pads minutes and seconds with a zero and says PM after noon", () => {
    render(<DatePicker aria-label="Due" defaultValue={new Date(2019, 0, 5, 21, 4, 7)} />);
    expect(element("Month").parentElement?.textContent).toBe(
      `${FIGURE_SPACE}1/${FIGURE_SPACE}5/2019${NO_BREAK_SPACE}${FIGURE_SPACE}9:04:07${NO_BREAK_SPACE}PM`,
    );
    expect(element("AM/PM")).toHaveAttribute("aria-valuetext", "PM");
  });

  it("shows the elements that `elements` names", () => {
    const { rerender } = render(<DatePicker aria-label="Due" elements="hourMinute" />);
    const names = () =>
      screen.getAllByRole("spinbutton").map((item) => item.getAttribute("aria-label"));
    expect(names()).toEqual(["Hour", "Minute", "AM/PM"]);
    rerender(<DatePicker aria-label="Due" elements="yearMonth" />);
    expect(names()).toEqual(["Month", "Year"]);
    rerender(<DatePicker aria-label="Due" elements="yearMonthDay hourMinute" />);
    expect(names()).toEqual(["Month", "Day", "Year", "Hour", "Minute", "AM/PM"]);
  });

  it("starts at 1 January 2001, midnight, without a value: the same on every render", () => {
    render(<DatePicker aria-label="Due" />);
    expect(element("Month").parentElement?.textContent).toBe(
      `${FIGURE_SPACE}1/${FIGURE_SPACE}1/2001${NO_BREAK_SPACE}12:00:00${NO_BREAK_SPACE}AM`,
    );
  });

  it("steps the focused element with Up and Down, wrapping inside the element", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePicker
        aria-label="Due"
        defaultValue={new Date(2019, 11, 31, 11, 59, 0)}
        onValueChange={onValueChange}
      />,
    );

    element("Month").focus();
    await user.keyboard("{ArrowUp}");
    // December wraps to January of the same year, and the 31st stays.
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 0, 31, 11, 59, 0));
    expect(element("Month")).toHaveAttribute("aria-valuenow", "1");
    expect(element("Year")).toHaveAttribute("aria-valuenow", "2019");

    await user.keyboard("{ArrowUp}");
    // February has no 31st: the day is held back to its last.
    expect(element("Month")).toHaveAttribute("aria-valuenow", "2");
    expect(element("Day")).toHaveAttribute("aria-valuenow", "28");
    expect(element("Day")).toHaveAttribute("aria-valuemax", "28");

    element("Day").focus();
    await user.keyboard("{ArrowUp}");
    expect(element("Day")).toHaveAttribute("aria-valuenow", "1");
    await user.keyboard("{ArrowDown}");
    expect(element("Day")).toHaveAttribute("aria-valuenow", "28");

    element("Minute").focus();
    await user.keyboard("{ArrowUp}");
    expect(element("Minute")).toHaveAttribute("aria-valuenow", "0");
    expect(element("Hour")).toHaveAttribute("aria-valuenow", "11");

    element("Hour").focus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    // 11, 12, 1: the hour wraps on its own and the half of the day stays.
    expect(element("Hour")).toHaveAttribute("aria-valuenow", "1");
    expect(element("AM/PM")).toHaveAttribute("aria-valuetext", "AM");

    element("AM/PM").focus();
    await user.keyboard("{ArrowDown}");
    expect(element("AM/PM")).toHaveAttribute("aria-valuetext", "PM");
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 1, 28, 13, 0, 0));
  });

  it("shows midnight and noon as 12 and keeps the half of the day while the hour changes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePicker
        aria-label="Due"
        elements="hourMinute"
        defaultValue={new Date(2019, 9, 3, 0, 30)}
        onValueChange={onValueChange}
      />,
    );
    expect(element("Hour")).toHaveAttribute("aria-valuenow", "12");
    expect(element("AM/PM")).toHaveAttribute("aria-valuetext", "AM");

    element("Hour").focus();
    await user.keyboard("{ArrowDown}");
    // 12 AM steps down to 11 AM, not to 11 PM of the day before.
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 3, 11, 30));
    await user.keyboard("12");
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 3, 0, 30));

    element("AM/PM").focus();
    await user.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 3, 12, 30));
    expect(element("Hour")).toHaveAttribute("aria-valuenow", "12");
    expect(element("AM/PM")).toHaveAttribute("aria-valuetext", "PM");
  });

  it("moves between elements with Left, Right and Tab", async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Due" elements="yearMonthDay" defaultValue={OCTOBER_3} />);

    await user.tab();
    expect(element("Month")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(element("Day")).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    // Right on the last element stays there.
    expect(element("Year")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(element("Day")).toHaveFocus();
    await user.tab();
    expect(element("Year")).toHaveFocus();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(element("Month")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(element("Month")).toHaveFocus();
  });

  it("takes typed digits, and moves on when the element is complete", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker aria-label="Due" defaultValue={OCTOBER_3} onValueChange={onValueChange} />);

    element("Month").focus();
    await user.keyboard("1");
    // 1 could still become 10, 11 or 12: the month keeps the keyboard.
    expect(element("Month")).toHaveAttribute("aria-valuenow", "1");
    expect(element("Month")).toHaveFocus();
    await user.keyboard("2");
    expect(element("Month")).toHaveAttribute("aria-valuenow", "12");
    expect(element("Day")).toHaveFocus();

    await user.keyboard("4");
    // No day starts with 4 and has two digits: the year takes over.
    expect(element("Day")).toHaveAttribute("aria-valuenow", "4");
    expect(element("Year")).toHaveFocus();

    await user.keyboard("2021");
    expect(element("Year")).toHaveAttribute("aria-valuenow", "2021");
    expect(element("Hour")).toHaveFocus();

    await user.keyboard("07");
    // A leading zero is held until the next digit.
    expect(element("Hour")).toHaveAttribute("aria-valuenow", "7");
    expect(element("Minute")).toHaveFocus();

    await user.keyboard("05");
    expect(element("Minute")).toHaveAttribute("aria-valuenow", "5");
    expect(element("Minute")).toHaveFocus();
    await user.keyboard("{ArrowRight}9");
    expect(element("Second")).toHaveAttribute("aria-valuenow", "9");
    expect(element("AM/PM")).toHaveFocus();

    await user.keyboard("p");
    expect(element("AM/PM")).toHaveAttribute("aria-valuetext", "PM");
    await user.keyboard("3");
    // Digits mean nothing to AM and PM.
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2021, 11, 4, 19, 5, 9));
    await user.keyboard("A");
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2021, 11, 4, 7, 5, 9));
  });

  it("starts a typed value again after the element is left and entered", async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Due" elements="yearMonthDay" defaultValue={OCTOBER_3} />);

    element("Month").focus();
    await user.keyboard("1{ArrowRight}{ArrowLeft}2");
    // 2 replaces the month; it does not join the 1 typed before the element was left.
    expect(element("Month")).toHaveAttribute("aria-valuenow", "2");
    expect(element("Day")).toHaveFocus();
    await user.keyboard("31");
    // February 2019 has 28 days.
    expect(element("Day")).toHaveAttribute("aria-valuenow", "28");
  });

  it("leaves keys held with Command, Control or Option to the page", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker aria-label="Due" defaultValue={OCTOBER_3} onValueChange={onValueChange} />);
    element("Month").focus();
    await user.keyboard("{Meta>}1{/Meta}{Control>}{ArrowUp}{/Control}{Alt>}{ArrowRight}{/Alt}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(element("Month")).toHaveFocus();
  });

  it("steps the first element from the stepper while none is selected, and selects it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePicker
        aria-label="Due"
        elements="yearMonthDay"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
      />,
    );

    await user.click(up());
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 10, 3, 10, 56, 59));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(element("Month")).toHaveFocus();
    await user.click(down());
    await user.click(down());
    expect(element("Month")).toHaveAttribute("aria-valuenow", "9");
  });

  it("steps the selected element from the stepper and gives it the keyboard back", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DatePicker aria-label="Due" elements="yearMonthDay" defaultValue={OCTOBER_3} />
        <button type="button">Elsewhere</button>
      </>,
    );

    await user.click(element("Year"));
    expect(element("Year")).toHaveFocus();
    await user.click(up());
    expect(element("Year")).toHaveAttribute("aria-valuenow", "2020");
    expect(element("Year")).toHaveFocus();

    // The element selected last stays the stepper's, also after the focus went elsewhere.
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    await user.click(down());
    expect(element("Year")).toHaveAttribute("aria-valuenow", "2019");
    expect(element("Year")).toHaveFocus();
  });

  it("steps the first element again after `elements` removed the selected one", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const picker = (elements: "yearMonthDay hourMinute" | "yearMonthDay") => (
      <DatePicker
        aria-label="Due"
        elements={elements}
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
      />
    );
    const { rerender } = render(picker("yearMonthDay hourMinute"));

    await user.click(element("Hour"));
    rerender(picker("yearMonthDay"));
    await user.click(up());
    // Not the hour, which is no longer shown: the month, the first element.
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 10, 3, 10, 56, 59));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(element("Month")).toHaveFocus();

    // An element that stays through the change stays selected.
    await user.click(element("Day"));
    rerender(picker("yearMonthDay hourMinute"));
    await user.click(up());
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 10, 4, 10, 56, 59));
    expect(element("Day")).toHaveFocus();
  });

  it("starts a typed value again after an arrow key stepped the element", async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Due" elements="yearMonthDay" defaultValue={OCTOBER_3} />);

    element("Month").focus();
    await user.keyboard("1");
    expect(element("Month")).toHaveAttribute("aria-valuenow", "1");
    await user.keyboard("{ArrowUp}");
    expect(element("Month")).toHaveAttribute("aria-valuenow", "2");
    // The 2 does not join the 1 typed before the step: February, not December.
    await user.keyboard("2");
    expect(element("Month")).toHaveAttribute("aria-valuenow", "2");
    expect(element("Day")).toHaveFocus();
  });

  it("ignores the keys of an element that was focused when the picker became disabled", () => {
    const onValueChange = vi.fn();
    const picker = (disabled: boolean) => (
      <DatePicker
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    );
    const { rerender } = render(picker(false));

    element("Day").focus();
    fireEvent.keyDown(element("Day"), { key: "ArrowUp" });
    expect(onValueChange).toHaveBeenCalledTimes(1);

    rerender(picker(true));
    // The keys reach the element whether or not the browser has taken the focus from it.
    fireEvent.keyDown(element("Day"), { key: "ArrowUp" });
    fireEvent.keyDown(element("Day"), { key: "ArrowDown" });
    fireEvent.keyDown(element("Day"), { key: "7" });
    fireEvent.keyDown(element("AM/PM"), { key: "p" });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(element("Day")).toHaveAttribute("aria-valuenow", "4");
    expect(element("AM/PM")).toHaveAttribute("aria-valuetext", "AM");
  });

  it("keeps the stepper out of the tab order and exposes its two buttons", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DatePicker aria-label="Due" elements="yearMonth" defaultValue={OCTOBER_3} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.tab();
    expect(element("Year")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    // Only the elements are spin buttons: the stepper has no value of its own.
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
    expect(up()).toBeInTheDocument();
    expect(down()).toBeInTheDocument();
  });

  it("is the field alone without a stepper", () => {
    render(<DatePicker aria-label="Due" stepper={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(7);
  });

  it("keeps the date inside min and max", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const min = new Date(2019, 9, 2);
    const max = new Date(2019, 9, 20, 12, 0, 0);
    render(
      <DatePicker
        aria-label="Due"
        defaultValue={OCTOBER_3}
        min={min}
        max={max}
        onValueChange={onValueChange}
      />,
    );

    element("Day").focus();
    await user.keyboard("{ArrowDown}");
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 2, 10, 56, 59));
    await user.keyboard("{ArrowDown}");
    // 1 October is before the minimum: the minimum itself is the result.
    expect(onValueChange).toHaveBeenLastCalledWith(min);
    expect(element("Day")).toHaveAttribute("aria-valuenow", "2");

    element("Year").focus();
    await user.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(max);
    expect(element("Year")).toHaveAttribute("aria-valuenow", "2019");
    expect(element("Day")).toHaveAttribute("aria-valuenow", "20");
    expect(element("Hour")).toHaveAttribute("aria-valuenow", "12");
  });

  it("does nothing while disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePicker
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
        disabled
      />,
    );

    expect(screen.getByRole("group", { name: "Due" })).toHaveAttribute("data-disabled");
    for (const item of screen.getAllByRole("spinbutton")) {
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item).not.toHaveAttribute("tabindex");
    }
    expect(up()).toBeDisabled();
    expect(down()).toBeDisabled();

    await user.tab();
    expect(document.body).toHaveFocus();
    await user.click(element("Month"));
    await user.keyboard("{ArrowUp}5");
    await user.click(up());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(element("Month")).toHaveAttribute("aria-valuenow", "10");
  });

  it("is controlled by value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <DatePicker aria-label="Due" value={OCTOBER_3} onValueChange={onValueChange} />,
    );

    element("Day").focus();
    await user.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 4, 10, 56, 59));
    // The parent has not taken the change: the picker shows what it is given.
    expect(element("Day")).toHaveAttribute("aria-valuenow", "3");

    rerender(
      <DatePicker aria-label="Due" value={new Date(2020, 0, 1)} onValueChange={onValueChange} />,
    );
    expect(element("Year")).toHaveAttribute("aria-valuenow", "2020");
    expect(element("Month")).toHaveAttribute("aria-valuenow", "1");
  });

  it("follows a parent that keeps the value", async () => {
    const user = userEvent.setup();
    function Due() {
      const [value, setValue] = useState(OCTOBER_3);
      return (
        <>
          <DatePicker aria-label="Due" value={value} onValueChange={setValue} />
          <output>{value.getDate()}</output>
        </>
      );
    }
    render(<Due />);
    await user.click(element("Day"));
    await user.click(up());
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("status")).toHaveTextContent("5");
    expect(element("Day")).toHaveAttribute("aria-valuenow", "5");
  });

  it("reflects size on the group, the field and the stepper", () => {
    render(<DatePicker aria-label="Due" size="mini" />);
    expect(screen.getByRole("group", { name: "Due" })).toHaveAttribute("data-size", "mini");
    expect(element("Month").parentElement).toHaveAttribute("data-size", "mini");
    expect(up().parentElement).toHaveAttribute("data-size", "mini");
  });

  it("merges className, forwards the ref and passes other props to the group", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onKeyDown = vi.fn();
    render(
      <DatePicker
        ref={ref}
        id="due"
        className="wide"
        style={{ width: 200 }}
        data-testid="picker"
        aria-describedby="hint"
        onKeyDown={onKeyDown}
        defaultValue={OCTOBER_3}
      />,
    );
    const group = screen.getByTestId("picker");
    expect(ref.current).toBe(group);
    expect(group).toHaveClass("mac-date-picker", "wide");
    expect(group).toHaveAttribute("id", "due");
    expect(group).toHaveAttribute("aria-describedby", "hint");
    expect(group).toHaveStyle({ width: "200px" });

    element("Month").focus();
    await user.keyboard("{ArrowUp}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});

describe("DatePickerCalendar", () => {
  it("renders the month of its date as a grid named after it", () => {
    render(<DatePickerCalendar aria-label="Due" defaultValue={OCTOBER_3} />);
    const group = screen.getByRole("group", { name: "Due" });
    expect(group).toHaveClass("mac-date-picker-calendar");
    expect(group).not.toHaveAttribute("data-disabled");

    const grid = screen.getByRole("grid", { name: "Oct 2019" });
    expect(within(grid).getAllByRole("row")).toHaveLength(7);
    const headers = within(grid).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Su",
      "Mo",
      "Tu",
      "We",
      "Th",
      "Fr",
      "Sa",
    ]);
    expect(headers[4]).toHaveAccessibleName("Thursday");

    // Six weeks, from Sunday 29 September to Saturday 9 November.
    const cells = within(grid).getAllByRole("gridcell");
    expect(cells).toHaveLength(42);
    expect(cells.map((cell) => cell.textContent).join(" ")).toBe(
      "29 30 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 1 2 3 4 5 6 7 8 9",
    );
    expect(cells.filter((cell) => cell.hasAttribute("data-outside"))).toHaveLength(11);
    expect(cells[0]).toHaveAttribute("data-outside");
    expect(cells[2]).not.toHaveAttribute("data-outside");
  });

  it("marks the selected day and makes it the grid's one tab stop", () => {
    render(<DatePickerCalendar aria-label="Due" defaultValue={OCTOBER_3} />);
    expect(selectedDay()).toBe(day(3));
    expect(day(3)).toHaveAttribute("tabindex", "0");
    const others = screen.getAllByRole("gridcell").filter((cell) => cell !== day(3));
    for (const cell of others) {
      expect(cell).toHaveAttribute("tabindex", "-1");
      expect(cell).toHaveAttribute("aria-selected", "false");
    }
  });

  it("starts at 1 January 2001 without a value", () => {
    render(<DatePickerCalendar aria-label="Due" />);
    expect(screen.getByRole("grid", { name: "Jan 2001" })).toBeInTheDocument();
    expect(selectedDay()).toBe(day(1));
  });

  it("selects a clicked day and keeps the time of day", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
      />,
    );

    await user.click(day(17));
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 17, 10, 56, 59));
    expect(selectedDay()).toBe(day(17));
    expect(day(17)).toHaveFocus();

    // A day of the next month: the calendar turns to it.
    const november = screen
      .getAllByRole("gridcell", { name: "8" })
      .find((cell) => cell.hasAttribute("data-outside"));
    await user.click(november as HTMLElement);
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 10, 8, 10, 56, 59));
    expect(screen.getByRole("grid", { name: "Nov 2019" })).toBeInTheDocument();
    expect(selectedDay()).toBe(day(8));
  });

  it("moves the selection by a day or a week with the arrow keys, and the focus with it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
      />,
    );

    day(3).focus();
    await user.keyboard("{ArrowRight}");
    expect(selectedDay()).toBe(day(4));
    expect(day(4)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(selectedDay()).toBe(day(11));
    expect(day(11)).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(selectedDay()).toBe(day(9));
    await user.keyboard("{ArrowUp}");
    expect(selectedDay()).toBe(day(2));
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 2, 10, 56, 59));

    // Past the first of the month: the calendar turns to September.
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("grid", { name: "Sep 2019" })).toBeInTheDocument();
    expect(selectedDay()).toBe(day(25));
    expect(day(25)).toHaveFocus();
  });

  it("moves the selection by a month with Page Up and Page Down", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={new Date(2019, 11, 31, 9, 0)}
        onValueChange={onValueChange}
      />,
    );

    day(31).focus();
    await user.keyboard("{PageDown}");
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2020, 0, 31, 9, 0));
    expect(screen.getByRole("grid", { name: "Jan 2020" })).toBeInTheDocument();
    expect(day(31)).toHaveFocus();

    await user.keyboard("{PageDown}");
    // February 2020 ends on the 29th.
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2020, 1, 29, 9, 0));
    expect(selectedDay()).toBe(day(29));

    await user.keyboard("{PageUp}{PageUp}{PageUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 10, 29, 9, 0));
    expect(screen.getByRole("grid", { name: "Nov 2019" })).toBeInTheDocument();
    expect(day(29)).toHaveFocus();
  });

  it("leaves other keys alone", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
      />,
    );
    day(3).focus();
    await user.keyboard("a{Escape}{Home}");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("turns the month with the buttons, keeping the day", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 10, 3, 10, 56, 59));
    expect(screen.getByRole("grid", { name: "Nov 2019" })).toBeInTheDocument();
    expect(selectedDay()).toBe(day(3));

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 8, 3, 10, 56, 59));
    expect(screen.getByRole("grid", { name: "Sep 2019" })).toBeInTheDocument();
  });

  it("selects today with the middle button, reading the clock only then", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2020, 1, 29, 8, 15, 0));
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
      />,
    );
    // Rendering did not look at the clock.
    expect(screen.getByRole("grid", { name: "Oct 2019" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2020, 1, 29, 8, 15, 0));
    expect(screen.getByRole("grid", { name: "Feb 2020" })).toBeInTheDocument();
    expect(selectedDay()).toBe(day(29));
  });

  it("does not offer the days outside min and max", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={OCTOBER_3}
        min={new Date(2019, 9, 2)}
        max={new Date(2019, 9, 20, 12, 0)}
        onValueChange={onValueChange}
      />,
    );

    expect(day(1)).toHaveAttribute("aria-disabled", "true");
    expect(day(1)).not.toHaveAttribute("tabindex");
    expect(day(2)).not.toHaveAttribute("aria-disabled");
    expect(day(20)).not.toHaveAttribute("aria-disabled");
    expect(day(21)).toHaveAttribute("aria-disabled", "true");

    await user.click(day(1));
    await user.click(day(25));
    expect(onValueChange).not.toHaveBeenCalled();

    await user.click(day(20));
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 20, 10, 56, 59));
    await user.keyboard("{ArrowRight}");
    // The 21st at 10:56 is after the maximum: the maximum itself is the result.
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 20, 12, 0));
    expect(selectedDay()).toBe(day(20));
  });

  it("does nothing while disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
        disabled
      />,
    );

    expect(screen.getByRole("group", { name: "Due" })).toHaveAttribute("data-disabled");
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    for (const cell of screen.getAllByRole("gridcell")) {
      expect(cell).toHaveAttribute("aria-disabled", "true");
      expect(cell).not.toHaveAttribute("tabindex");
    }
    // The selection is still shown.
    expect(selectedDay()).toBe(day(3));

    await user.tab();
    expect(document.body).toHaveFocus();
    await user.click(day(17));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("ignores the keys of a day that was focused when the calendar became disabled", () => {
    const onValueChange = vi.fn();
    const calendar = (disabled: boolean) => (
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    );
    const { rerender } = render(calendar(false));

    selectedDay().focus();
    fireEvent.keyDown(selectedDay(), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(selectedDay()).toBe(day(4));

    rerender(calendar(true));
    // The keys reach the day whether or not the browser has taken the focus from it.
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown"]) {
      fireEvent.keyDown(selectedDay(), { key });
    }
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(selectedDay()).toBe(day(4));
  });

  it("puts the buttons, then the selected day, in the tab order", async () => {
    const user = userEvent.setup();
    render(<DatePickerCalendar aria-label="Due" defaultValue={OCTOBER_3} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Previous month" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Today" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Next month" })).toHaveFocus();
    await user.tab();
    expect(day(3)).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("moves the focus to the selected day when a click on a day of another month turns the month", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DatePickerCalendar
        aria-label="Due"
        defaultValue={OCTOBER_3}
        onValueChange={onValueChange}
      />,
    );

    // 8 November is in the last week of October's grid.
    const november8 = screen
      .getAllByRole("gridcell", { name: "8" })
      .find((cell) => cell.hasAttribute("data-outside"));
    if (!november8) throw new Error("no 8 November in the grid");
    await user.click(november8);
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 10, 8, 10, 56, 59));
    expect(screen.getByRole("grid", { name: "Nov 2019" })).toBeInTheDocument();
    // The cell that was clicked now shows another day; the focus is on the selected one.
    expect(selectedDay()).toBe(day(8));
    expect(selectedDay()).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(selectedDay()).toBe(day(9));
    expect(selectedDay()).toHaveFocus();
  });

  it("does not take the focus back for a key whose change the parent did not accept", async () => {
    const user = userEvent.setup();
    const calendar = (value: Date) => (
      <>
        <DatePickerCalendar aria-label="Due" value={value} />
        <button type="button">Elsewhere</button>
      </>
    );
    const { rerender } = render(calendar(OCTOBER_3));

    selectedDay().focus();
    await user.keyboard("{ArrowRight}");
    // The parent keeps its value: the selection and the focus stay.
    expect(selectedDay()).toBe(day(3));
    expect(selectedDay()).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    rerender(calendar(new Date(2019, 9, 9)));
    expect(selectedDay()).toBe(day(9));
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });

  it("keeps the focus on the selected day when the parent does not accept a clicked day", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePickerCalendar aria-label="Due" value={OCTOBER_3} onValueChange={onValueChange} />);

    await user.click(day(17));
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 17, 10, 56, 59));
    // The parent keeps 3 October: that day has the focus, not the one that was clicked.
    expect(selectedDay()).toBe(day(3));
    expect(selectedDay()).toHaveFocus();

    // The keys go on from the day that has the focus.
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 4, 10, 56, 59));
    expect(selectedDay()).toHaveFocus();
  });

  it("does not take the focus when the value changes from outside", () => {
    const { rerender } = render(<DatePickerCalendar aria-label="Due" value={OCTOBER_3} />);
    rerender(<DatePickerCalendar aria-label="Due" value={new Date(2019, 9, 9)} />);
    expect(selectedDay()).toBe(day(9));
    expect(document.body).toHaveFocus();
  });

  it("is controlled by value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <DatePickerCalendar aria-label="Due" value={OCTOBER_3} onValueChange={onValueChange} />,
    );

    await user.click(day(17));
    expect(onValueChange).toHaveBeenLastCalledWith(new Date(2019, 9, 17, 10, 56, 59));
    expect(selectedDay()).toBe(day(3));

    rerender(
      <DatePickerCalendar
        aria-label="Due"
        value={new Date(2020, 1, 29)}
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByRole("grid", { name: "Feb 2020" })).toBeInTheDocument();
    expect(selectedDay()).toBe(day(29));
  });

  it("merges className, forwards the ref and passes other props to the group", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <DatePickerCalendar
        ref={ref}
        id="due"
        className="mine"
        style={{ margin: 4 }}
        data-testid="calendar"
        defaultValue={OCTOBER_3}
      />,
    );
    const group = screen.getByTestId("calendar");
    expect(ref.current).toBe(group);
    expect(group).toHaveClass("mac-date-picker-calendar", "mine");
    expect(group).toHaveAttribute("id", "due");
    expect(group).toHaveStyle({ margin: "4px" });
  });
});

describe("DatePickerClock", () => {
  it("is an image named after its time, with twelve numerals and the half of the day", () => {
    render(<DatePickerClock value={OCTOBER_3} />);
    const clock = screen.getByRole("img", { name: "10:56:59" });
    expect(clock).toHaveClass("mac-date-picker-clock");
    expect(clock).toHaveTextContent("1 2 3 4 5 6 7 8 9 10 11 12 AM".replaceAll(" ", ""));
  });

  it("names another time, and says PM after noon", () => {
    const { rerender } = render(<DatePickerClock value={OCTOBER_3} />);
    rerender(<DatePickerClock value={new Date(2019, 9, 3, 22, 30, 38)} />);
    expect(screen.getByRole("img", { name: "22:30:38" })).toHaveTextContent(/PM$/);
  });

  it("shows midnight without a value", () => {
    render(<DatePickerClock />);
    expect(screen.getByRole("img", { name: "00:00:00" })).toHaveTextContent(/AM$/);
  });

  it("merges className and style, forwards the ref and passes other props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <DatePickerClock
        ref={ref}
        id="clock"
        className="mine"
        style={{ margin: 4 }}
        aria-label="Cupertino time"
        value={OCTOBER_3}
      />,
    );
    const clock = screen.getByRole("img", { name: "Cupertino time" });
    expect(ref.current).toBe(clock);
    expect(clock).toHaveClass("mac-date-picker-clock", "mine");
    expect(clock).toHaveAttribute("id", "clock");
    expect(clock).toHaveStyle({ margin: "4px" });
  });
});
