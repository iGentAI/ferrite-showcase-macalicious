import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { tomorrowFromServer, tomorrowText } from "./desktop-notifications";
import { TodayCalculator, TodayEditList, zoneClock } from "./desktop-today-widgets";

describe("zoneClock", () => {
  it("reads a zone's wall clock", () => {
    const clock = zoneClock(Date.UTC(2026, 9, 12, 22, 30), "Asia/Tokyo");
    expect(clock.hours).toBe(7);
    expect(clock.minutes).toBe(30);
  });

  it("says how it stands to the browser's clock, from a browser in UTC", () => {
    const at = new Date(2026, 9, 12, 22, 30).getTime();
    const offset = new Date(at).getTimezoneOffset();
    const utc = at - offset * 60_000;
    expect(zoneClock(utc, Intl.DateTimeFormat().resolvedOptions().timeZone).note).toBe("Today");
  });
});

describe("Tomorrow", () => {
  const at = new Date(2026, 9, 12, 15).getTime();
  const event = (id: string, day: number, hour: number) => ({
    id,
    title: id,
    start: new Date(2026, 9, day, hour).getTime(),
    end: new Date(2026, 9, day, hour + 1).getTime(),
  });

  it("takes only the events that start tomorrow, earliest first", () => {
    const reply = {
      events: [
        event("later", 13, 17),
        event("today", 12, 18),
        event("first", 13, 9),
        event("far", 14, 9),
      ],
    };
    expect(tomorrowFromServer(reply, at).map((each) => each.id)).toEqual(["first", "later"]);
  });

  it("says what there is", () => {
    expect(tomorrowText([])).toBe("You have no events scheduled for tomorrow.");
    const reply = { events: [event("Dentist", 13, 9), event("Lunch", 13, 12)] };
    expect(tomorrowText(tomorrowFromServer(reply, at))).toBe(
      "You have 2 events tomorrow. The first is “Dentist”, at 9:00 AM.",
    );
  });
});

describe("TodayCalculator", () => {
  it("works sums out on the application's arithmetic", async () => {
    const user = userEvent.setup();
    render(<TodayCalculator />);
    await user.click(screen.getByRole("button", { name: "7" }));
    await user.click(screen.getByRole("button", { name: "Multiply" }));
    await user.click(screen.getByRole("button", { name: "6" }));
    await user.click(screen.getByRole("button", { name: "Equals" }));
    expect(screen.getByRole("status").textContent).toBe("42");
    await user.click(screen.getByRole("button", { name: "C" }));
    expect(screen.getByRole("status").textContent).toBe("0");
  });
});

describe("TodayEditList", () => {
  const widgets = [
    { id: "calendar", name: "Calendar", on: true },
    { id: "stocks", name: "Stocks", on: true },
  ] as never;

  it("moves a widget with Option-Up and takes one away with its button", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const onRemove = vi.fn();
    render(
      <TodayEditList
        widgets={widgets}
        cardOf={(widget) => <button type="button">{`inside ${widget.name}`}</button>}
        onMove={onMove}
        onRemove={onRemove}
      />,
    );
    screen.getByRole("button", { name: "Remove Stocks" }).focus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(onMove).toHaveBeenCalledWith("stocks", 0);
    screen.getByRole("button", { name: "Remove Calendar" }).focus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(onMove).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Remove Calendar" }));
    expect(onRemove).toHaveBeenCalledWith("calendar");
  });
});
