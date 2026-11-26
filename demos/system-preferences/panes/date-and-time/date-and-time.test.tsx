import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";

const group = (name: string) => screen.getByRole("group", { name });
const element = (picker: string, name: string) =>
  within(group(picker)).getByRole("spinbutton", { name });
const automatic = () => screen.getByRole("checkbox", { name: "Set date and time automatically:" });

describe("Date & Time pane, its settings as the controls show them", () => {
  // A zone that skips 2:00 to 3:00 on 10 March 2019; Node reads TZ again when it changes.
  const zone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });
  afterAll(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  it("shows a time the day's clock skips as set, and keeps it when the date changes", async () => {
    const user = userEvent.setup();
    render(
      <SystemPreferences
        defaultPane="date-and-time"
        defaultSettings={{
          "date-and-time.locked": false,
          "date-and-time.automatic": false,
          "date-and-time.date": Date.UTC(2019, 2, 10) / 86_400_000,
          "date-and-time.time": 2 * 3600 + 30 * 60,
        }}
      />,
    );
    expect(element("Time", "Hour")).toHaveAttribute("aria-valuetext", "2");
    expect(element("Time", "Minute")).toHaveAttribute("aria-valuetext", "30");
    element("Date", "Day").focus();
    await user.keyboard("{ArrowDown}");
    expect(element("Date", "Day")).toHaveAttribute("aria-valuetext", "9");
    expect(element("Time", "Hour")).toHaveAttribute("aria-valuetext", "2");
    expect(element("Time", "Minute")).toHaveAttribute("aria-valuetext", "30");
  });

  it("keeps a year below 100 in its own century", async () => {
    const user = userEvent.setup();
    const year50 = new Date(0);
    year50.setUTCFullYear(50, 5, 15);
    render(
      <SystemPreferences
        defaultPane="date-and-time"
        defaultSettings={{
          "date-and-time.locked": false,
          "date-and-time.automatic": false,
          "date-and-time.date": year50.getTime() / 86_400_000,
        }}
      />,
    );
    expect(element("Date", "Year")).toHaveAttribute("aria-valuenow", "50");
    element("Date", "Day").focus();
    await user.keyboard("{ArrowUp}");
    expect(element("Date", "Year")).toHaveAttribute("aria-valuenow", "50");
    expect(element("Date", "Day")).toHaveAttribute("aria-valuenow", "16");
  });
});

describe("Date & Time pane", () => {
  it("shows the captured date and time in the library's date pickers, disabled while locked", () => {
    render(<SystemPreferences defaultPane="date-and-time" />);
    expect(element("Date", "Month")).toHaveAttribute("aria-valuetext", "10");
    expect(element("Date", "Day")).toHaveAttribute("aria-valuetext", "3");
    expect(element("Date", "Year")).toHaveAttribute("aria-valuetext", "2019");
    expect(element("Time", "Hour")).toHaveAttribute("aria-valuetext", "10");
    expect(element("Time", "Minute")).toHaveAttribute("aria-valuetext", "56");
    expect(element("Time", "Second")).toHaveAttribute("aria-valuetext", "59");
    expect(element("Date", "Day")).toHaveAttribute("aria-disabled", "true");
    expect(within(group("Calendar")).getByRole("button", { name: "Today" })).toBeDisabled();
    // The clock shows the time; its name is the time of day.
    expect(screen.getByRole("img", { name: "10:56:59" })).toBeInTheDocument();

    const server = screen.getByRole("combobox", { name: "Time server" });
    expect(server).toHaveValue("Apple Americas/U.S. (time.apple.com.)");
    expect(server).toBeDisabled();
  });

  it("unlocked, sets the time server while automatic and the date by hand when not", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="date-and-time" />);
    await user.click(screen.getByRole("button", { name: /lock/i }));

    const server = screen.getByRole("combobox", { name: "Time server" });
    expect(server).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Show choices" }));
    await user.click(
      await screen.findByRole("option", { name: "Apple Europe (time.euro.apple.com.)" }),
    );
    expect(server).toHaveValue("Apple Europe (time.euro.apple.com.)");

    await user.click(automatic());
    expect(server).toBeDisabled();
    const day = element("Date", "Day");
    expect(day).not.toHaveAttribute("aria-disabled");
    day.focus();
    await user.keyboard("{ArrowUp}");
    expect(element("Date", "Day")).toHaveAttribute("aria-valuetext", "4");
    // The calendar shows the same date: the 4th is its selected day.
    expect(within(group("Calendar")).getByRole("gridcell", { selected: true })).toHaveTextContent(
      "4",
    );

    element("Time", "Minute").focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("img", { name: "10:55:59" })).toBeInTheDocument();
  });
});
