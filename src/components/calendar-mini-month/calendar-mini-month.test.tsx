import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CalendarMiniMonth, type CalendarMiniMonthProps } from "./index";

function October(props: Partial<CalendarMiniMonthProps>) {
  return (
    <CalendarMiniMonth
      defaultMonth={new Date(2019, 9, 20)}
      today={new Date(2019, 9, 3, 15, 38)}
      {...props}
    />
  );
}

const day = (name: string) => screen.getByRole("button", { name });
const title = () => screen.getByRole("grid").getAttribute("aria-labelledby") as string;
const shown = () => document.getElementById(title())?.textContent;
const numbers = () =>
  within(screen.getByRole("grid"))
    .getAllByRole("button")
    .map((button) => button.textContent);

describe("CalendarMiniMonth", () => {
  it("shows six weeks around the month, named by its title, with the other months' days marked", () => {
    render(<October />);
    expect(screen.getByRole("grid", { name: "October 2019" })).toBeInTheDocument();
    const days = numbers();
    expect(days).toHaveLength(42);
    expect(days.slice(0, 3)).toEqual(["29", "30", "1"]);
    expect(days.slice(-9)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(day("Monday, September 30, 2019")).toHaveAttribute("data-outside");
    expect(day("Tuesday, October 1, 2019")).not.toHaveAttribute("data-outside");
    expect(day("Friday, November 1, 2019")).toHaveAttribute("data-outside");
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      ..."SMTWTFS",
    ]);
    expect(screen.getByRole("columnheader", { name: "Wednesday" })).toBeInTheDocument();
  });

  it("marks today, whatever its time of day, and only today", () => {
    render(<October />);
    expect(day("Thursday, October 3, 2019")).toHaveAttribute("aria-current", "date");
    expect(screen.getByRole("grid").querySelectorAll("[aria-current]")).toHaveLength(1);
  });

  it("starts the weeks on weekStartsOn", () => {
    render(<October weekStartsOn={1} />);
    expect(screen.getAllByRole("columnheader")[0]).toHaveAccessibleName("Monday");
    expect(numbers().slice(0, 2)).toEqual(["30", "1"]);
  });

  it("names the month, the weekdays and the days in the locale", () => {
    render(<October locale="fr-FR" />);
    expect(shown()).toBe("octobre 2019");
    expect(screen.getByRole("columnheader", { name: "mercredi" })).toBeInTheDocument();
    expect(day("jeudi 3 octobre 2019")).toBeInTheDocument();
  });

  it("steps through the months with the chevrons, across a year's end", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    render(<October defaultMonth={new Date(2019, 11, 31)} onMonthChange={onMonthChange} />);
    await user.click(day("Next month"));
    expect(shown()).toBe("January 2020");
    expect(onMonthChange).toHaveBeenLastCalledWith(new Date(2020, 0, 1));
    await user.click(day("Previous month"));
    await user.click(day("Previous month"));
    expect(shown()).toBe("November 2019");
    expect(onMonthChange).toHaveBeenCalledTimes(3);
  });

  it("leaves a controlled month to its owner", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    render(
      <October
        month={new Date(2019, 9, 1)}
        onMonthChange={onMonthChange}
        previousLabel="Mois précédent"
        nextLabel="Mois suivant"
      />,
    );
    await user.click(day("Mois suivant"));
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2019, 10, 1));
    expect(shown()).toBe("October 2019");
    expect(day("Mois précédent")).toBeInTheDocument();
  });

  it("has no chevrons without navigation, and still follows a chosen day's month", async () => {
    const user = userEvent.setup();
    render(<October navigation={false} />);
    expect(screen.queryByRole("button", { name: "Next month" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous month" })).not.toBeInTheDocument();
    await user.click(day("Monday, September 30, 2019"));
    expect(shown()).toBe("September 2019");
  });

  it("selects the day that is chosen and reports it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<October onValueChange={onValueChange} />);
    const chosen = day("Wednesday, October 16, 2019");
    expect(chosen.parentElement).toHaveAttribute("aria-selected", "false");
    await user.click(chosen);
    expect(chosen.parentElement).toHaveAttribute("aria-selected", "true");
    expect(chosen).toHaveAttribute("data-selected");
    expect(onValueChange).toHaveBeenCalledWith(new Date(2019, 9, 16));
    expect(screen.getAllByRole("gridcell", { selected: true })).toHaveLength(1);
  });

  it("shows the month of a chosen day that lies outside the month", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    render(<October onMonthChange={onMonthChange} />);
    await user.click(day("Saturday, November 9, 2019"));
    expect(shown()).toBe("November 2019");
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2019, 10, 1));
    expect(day("Saturday, November 9, 2019").parentElement).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("follows a controlled value and opens on its month", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<CalendarMiniMonth value={new Date(2020, 1, 29, 9)} onValueChange={onValueChange} />);
    expect(shown()).toBe("February 2020");
    const leap = day("Saturday, February 29, 2020");
    expect(leap.parentElement).toHaveAttribute("aria-selected", "true");
    await user.click(day("Sunday, February 2, 2020"));
    expect(onValueChange).toHaveBeenCalledWith(new Date(2020, 1, 2));
    expect(leap.parentElement).toHaveAttribute("aria-selected", "true");
  });

  it("keeps one day in the tab order: the selected day, else today, else the first", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<October />);
    const stops = () =>
      within(screen.getByRole("grid"))
        .getAllByRole("button")
        .filter((button) => button.tabIndex === 0)
        .map((button) => button.getAttribute("aria-label"));
    expect(stops()).toEqual(["Thursday, October 3, 2019"]);
    rerender(<October value={new Date(2019, 9, 16)} />);
    expect(stops()).toEqual(["Wednesday, October 16, 2019"]);
    rerender(<October value={null} today={undefined} />);
    expect(stops()).toEqual(["Tuesday, October 1, 2019"]);

    await user.tab();
    expect(day("Previous month")).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(day("Tuesday, October 1, 2019")).toHaveFocus();
  });

  it("moves between days with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    render(<October />);
    day("Thursday, October 3, 2019").focus();
    await user.keyboard("{ArrowRight}");
    expect(day("Friday, October 4, 2019")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(day("Friday, October 11, 2019")).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(day("Wednesday, October 9, 2019")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(day("Wednesday, October 2, 2019")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(day("Sunday, September 29, 2019")).toHaveFocus();
    await user.keyboard("{End}");
    expect(day("Saturday, October 5, 2019")).toHaveFocus();
    expect(shown()).toBe("October 2019");
  });

  it("goes to the month beside when a key leaves the weeks shown, keeping the focus", async () => {
    const user = userEvent.setup();
    render(<October />);
    day("Sunday, September 29, 2019").focus();
    await user.keyboard("{ArrowUp}");
    expect(shown()).toBe("September 2019");
    expect(day("Sunday, September 22, 2019")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(day("Sunday, September 22, 2019").parentElement).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("changes the month with Page Up and Page Down, on the same day or the month's last", async () => {
    const user = userEvent.setup();
    render(<October />);
    day("Thursday, October 31, 2019").focus();
    await user.keyboard("{PageDown}");
    expect(shown()).toBe("November 2019");
    expect(day("Saturday, November 30, 2019")).toHaveFocus();
    await user.keyboard("{PageUp}{PageUp}");
    expect(shown()).toBe("September 2019");
    expect(day("Monday, September 30, 2019")).toHaveFocus();
  });

  it("keeps the focus on a neighbouring month's day when a key chooses it or pages from it", async () => {
    const user = userEvent.setup();
    render(<October />);
    // Page Down from September's last day leads into the month that is already shown.
    day("Monday, September 30, 2019").focus();
    await user.keyboard("{PageDown}");
    expect(shown()).toBe("October 2019");
    expect(day("Wednesday, October 30, 2019")).toHaveFocus();

    day("Monday, September 30, 2019").focus();
    await user.keyboard("{Enter}");
    expect(shown()).toBe("September 2019");
    expect(day("Monday, September 30, 2019")).toHaveFocus();
    expect(day("Monday, September 30, 2019").parentElement).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keeps the focus on a chosen neighbouring day when the month's owner follows later", async () => {
    const user = userEvent.setup();
    let follow = () => {};
    function Deferred() {
      const [month, setMonth] = useState(new Date(2019, 9, 1));
      return <October month={month} onMonthChange={(next) => (follow = () => setMonth(next))} />;
    }
    render(<Deferred />);
    day("Monday, September 30, 2019").focus();
    await user.keyboard("{Enter}");
    // The day is selected, which renders the grid again, and October is still shown.
    expect(shown()).toBe("October 2019");
    expect(day("Monday, September 30, 2019").parentElement).toHaveAttribute(
      "aria-selected",
      "true",
    );
    act(() => follow());
    expect(shown()).toBe("September 2019");
    expect(day("Monday, September 30, 2019")).toHaveFocus();
  });

  it("moves the tab stop with the focus, so Shift+Tab leaves the grid", async () => {
    const user = userEvent.setup();
    render(<October />);
    day("Thursday, October 3, 2019").focus();
    await user.keyboard("{ArrowRight}");
    expect(day("Friday, October 4, 2019")).toHaveAttribute("tabindex", "0");
    expect(day("Thursday, October 3, 2019")).toHaveAttribute("tabindex", "-1");
    await user.tab({ shift: true });
    expect(day("Next month")).toHaveFocus();
    await user.tab();
    expect(day("Friday, October 4, 2019")).toHaveFocus();
  });

  it("forwards ref, className and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<October ref={ref} className="extra" id="mini" />);
    expect(ref.current).toHaveClass("mac-calendar-mini-month", "extra");
    expect(ref.current).toHaveAttribute("id", "mini");
  });
});
