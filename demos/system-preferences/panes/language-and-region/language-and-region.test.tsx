import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";
import { dayAndMonth, formatExamples, REGIONS, servedRegion } from "./formats";

const frame = (name: string) => screen.getByRole("region", { name });

describe("Language & Region pane", () => {
  it("opens on General at its frame size in the captured state", () => {
    render(<SystemPreferences defaultPane="language-and-region" />);
    expect(frame("Language & Region")).toHaveStyle({ width: "668px", height: "517px" });
    expect(screen.getByRole("combobox", { name: "Region:" })).toHaveTextContent("United States");
    expect(screen.getByRole("combobox", { name: "First day of week:" })).toHaveTextContent(
      "Sunday",
    );
    expect(screen.getByRole("combobox", { name: "Calendar:" })).toHaveTextContent("Gregorian");
    expect(screen.getByRole("combobox", { name: "Temperature:" })).toHaveTextContent(
      "°F — Fahrenheit",
    );
    expect(screen.getByRole("checkbox", { name: "24-Hour Time" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Remove the selected language" })).toBeDisabled();
    expect(screen.getByText("Thursday, October 3, 2019 at 10:43:31 AM CDT")).toBeVisible();
    expect(screen.getByText("10/3/19, 10:43 AM")).toBeVisible();
  });

  it("writes the examples the way the region and the time format do", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="language-and-region" />);
    await user.click(screen.getByRole("checkbox", { name: "24-Hour Time" }));
    expect(screen.getByText("Thursday, October 3, 2019 at 10:43:31 CDT")).toBeVisible();

    const region = screen.getByRole("combobox", { name: "Region:" });
    await user.click(region);
    await user.click(await screen.findByRole("option", { name: "United Kingdom" }));
    expect(region).toHaveTextContent("United Kingdom");
    expect(screen.getByText("Thursday, 3 October 2019 at 10:43:31 CDT")).toBeVisible();
    expect(screen.getByText("03/10/2019, 10:43")).toBeVisible();
    expect(screen.getByText("£4,567.89")).toBeVisible();
  });

  it("formats an afternoon and the dark capture's morning", () => {
    const [unitedStates] = REGIONS;
    if (!unitedStates) throw new Error("no regions");
    expect(formatExamples("2019-10-04T10:24:27", unitedStates, false)).toEqual({
      full: "Friday, October 4, 2019 at 10:24:27 AM CDT",
      short: "10/4/19, 10:24 AM",
      number: "1,234.56",
      currency: "$4,567.89",
    });
    expect(formatExamples("2019-12-25T15:04:05", unitedStates, false).short).toBe(
      "12/25/19, 3:04 PM",
    );
    expect(formatExamples("2019-12-25T00:04:05", unitedStates, true).short).toBe("12/25/19, 00:04");
  });

  it("writes the dates of another calendar, region by region", () => {
    const [unitedStates] = REGIONS;
    if (!unitedStates) throw new Error("no regions");
    const hebrew = formatExamples("2019-10-03T10:43:31", unitedStates, false, "CDT", "Hebrew");
    expect(hebrew.full).toBe("Thursday, 4 Tishri 5780 at 10:43:31 AM CDT");
    expect(hebrew.short).toBe("4 Tishri 5780, 10:43 AM");
    const october3 = new Date(2019, 9, 3);
    expect(dayAndMonth(october3, "united-states", "Gregorian")).toBe("October 3");
    expect(dayAndMonth(october3, "united-kingdom", "Gregorian")).toBe("3 October");
    expect(dayAndMonth(october3, "united-states", "Hebrew")).toBe("4 Tishri");
  });

  it("takes a region never chosen from the browser's language, where the list has it", () => {
    expect(servedRegion(undefined, "en-GB").id).toBe("united-kingdom");
    expect(servedRegion(undefined, "de-DE").id).toBe("united-states");
    expect(servedRegion("canada", "en-GB").id).toBe("canada");
  });

  it("selects the language, and says that Apps is not part of the demo", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="language-and-region" />);
    const list = screen.getByRole("listbox", { name: "Preferred languages:" });
    const english = within(list).getByRole("option", { name: /English/ });
    expect(english).toHaveAttribute("aria-selected", "false");
    await user.click(within(list).getByText("English"));
    expect(english).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "Apps" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "The Apps tab is not part of this demo.",
    );
  });

  it("opens the Keyboard pane from Keyboard Preferences", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="language-and-region" />);
    await user.click(screen.getByRole("button", { name: "Keyboard Preferences…" }));
    expect(frame("Keyboard")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(frame("Language & Region")).toHaveStyle({ height: "517px" });
  });
});

describePaneControls("language-and-region");
