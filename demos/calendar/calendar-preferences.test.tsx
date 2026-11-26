import { render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { takeHelpRequest } from "../desktop/desktop-help";
import { changeDesktopValue } from "../desktop/desktop-personal";
import { type CalendarSettings, defaultSettings } from "./calendar-data";
import { CalendarPreferences } from "./calendar-preferences";
import { CALENDAR_SETTINGS_URL } from "./calendar-server";

/** The window, by its title: the name of the pane shown. */
const frame = (title: string) => screen.getByRole("region", { name: title });
const popUp = (name: string) => screen.getByRole("combobox", { name });
const checkbox = (name: string) => screen.getByRole("checkbox", { name });
/** Whether a control is dimmed: disabled natively, for assistive technology, or by Base UI. */
const dimmed = (element: HTMLElement) =>
  element.hasAttribute("disabled") ||
  element.getAttribute("aria-disabled") === "true" ||
  element.hasAttribute("data-disabled");

async function choose(user: UserEvent, name: string, item: string) {
  await user.click(popUp(name));
  await user.click(await screen.findByRole("option", { name: item }));
}

describe("the General pane", () => {
  afterEach(() => changeDesktopValue("calendar.alternateShown", undefined));
  it("opens with the settings of the capture", () => {
    render(<CalendarPreferences />);
    expect(frame("General")).toHaveAttribute("data-window-state", "key");
    expect(frame("General").style.width).toBe("537px");
    expect(popUp("Default calendar app:")).toHaveTextContent("Calendar");
    expect(popUp("Days per week:")).toHaveTextContent("7");
    expect(popUp("Start week on:")).toHaveTextContent("Sunday");
    expect(popUp("Scroll in week view by:")).toHaveTextContent(/^Week$/);
    expect(popUp("Day starts at:")).toHaveTextContent("8:00 AM");
    expect(popUp("Day ends at:")).toHaveTextContent("6:00 PM");
    expect(popUp("Show:")).toHaveTextContent("12");
    expect(popUp("Show:")).toHaveAccessibleDescription("hours at a time");
    expect(popUp("Default Calendar:")).toHaveTextContent("Selected calendar");
    expect(checkbox("Show Birthdays calendar")).not.toBeChecked();
    expect(checkbox("Show Holidays calendar")).toBeChecked();
    expect(checkbox("Show alternate calendar:")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument();
  });

  it.each<[popUp: string, item: string, changed: Partial<CalendarSettings>]>([
    ["Days per week:", "5", { daysPerWeek: 5 }],
    ["Start week on:", "Monday", { weekStartsOn: 1 }],
    ["Scroll in week view by:", "Week, Stop on Today", { scrollBy: "week-stop-on-today" }],
    ["Day starts at:", "6:00 AM", { dayStartsAt: 6 }],
    ["Day ends at:", "9:00 PM", { dayEndsAt: 21 }],
    ["Show:", "8", { hoursShown: 8 }],
    ["Default Calendar:", "Work", { defaultCalendar: "work" }],
  ])("%s changes its setting to the item chosen (%s) and shows it", async (name, item, changed) => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<CalendarPreferences onSettingsChange={onSettingsChange} />);
    await choose(user, name, item);
    expect(onSettingsChange).toHaveBeenCalledExactlyOnceWith({ ...defaultSettings, ...changed });
    expect(popUp(name)).toHaveTextContent(item);
  });

  it("starts from the settings given, and keeps one change when the next is made", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(
      <CalendarPreferences
        defaultSettings={{ ...defaultSettings, weekStartsOn: 6, hoursShown: 24 }}
        onSettingsChange={onSettingsChange}
      />,
    );
    expect(popUp("Start week on:")).toHaveTextContent("Saturday");
    expect(popUp("Show:")).toHaveTextContent("24");
    await choose(user, "Days per week:", "5");
    await user.click(checkbox("Show Birthdays calendar"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...defaultSettings,
      weekStartsOn: 6,
      hoursShown: 24,
      daysPerWeek: 5,
      showBirthdays: true,
    });
  });

  it("follows controlled settings and leaves a change to its owner", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    const settings: CalendarSettings = { ...defaultSettings, daysPerWeek: 5, showBirthdays: true };
    const { rerender } = render(
      <CalendarPreferences settings={settings} onSettingsChange={onSettingsChange} />,
    );
    expect(popUp("Days per week:")).toHaveTextContent("5");

    await choose(user, "Days per week:", "7");
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...settings, daysPerWeek: 7 });
    expect(popUp("Days per week:")).toHaveTextContent("5");

    await user.click(checkbox("Show Birthdays calendar"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...settings, showBirthdays: false });
    expect(checkbox("Show Birthdays calendar")).toBeChecked();

    rerender(
      <CalendarPreferences
        settings={{ ...settings, daysPerWeek: 7, showBirthdays: false }}
        onSettingsChange={onSettingsChange}
      />,
    );
    expect(popUp("Days per week:")).toHaveTextContent("7");
    expect(checkbox("Show Birthdays calendar")).not.toBeChecked();
  });

  it("turns the Birthdays and Holidays calendars on and off with their checkboxes", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<CalendarPreferences onSettingsChange={onSettingsChange} />);

    await user.click(checkbox("Show Birthdays calendar"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...defaultSettings, showBirthdays: true });
    expect(checkbox("Show Birthdays calendar")).toBeChecked();

    await user.click(checkbox("Show Holidays calendar"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...defaultSettings,
      showBirthdays: true,
      showHolidays: false,
    });
    expect(checkbox("Show Holidays calendar")).not.toBeChecked();
  });

  it("offers the alternate calendars only while their checkbox is on", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<CalendarPreferences onSettingsChange={onSettingsChange} />);
    expect(popUp("Alternate calendar")).toBeDisabled();
    expect(popUp("Alternate calendar")).toHaveTextContent("Chinese");

    await user.click(checkbox("Show alternate calendar:"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...defaultSettings,
      showAlternateCalendar: true,
    });
    expect(popUp("Alternate calendar")).toBeEnabled();
    expect(dimmed(screen.getByRole("button", { name: "Help" }))).toBe(false);
  });

  it("does not let the day start after it ends, or end before it starts", async () => {
    const user = userEvent.setup();
    render(<CalendarPreferences />);
    await user.click(popUp("Day starts at:"));
    expect(await screen.findByRole("option", { name: "5:00 PM" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("option", { name: "6:00 PM" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");

    await user.click(popUp("Day ends at:"));
    expect(await screen.findByRole("option", { name: "8:00 AM" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("option", { name: "9:00 AM" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("the window", () => {
  it("shows the pane of the toolbar item chosen, and takes its name as title", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<CalendarPreferences onValueChange={onValueChange} />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["General", "Accounts", "Alerts", "Advanced"]);

    await user.click(screen.getByRole("tab", { name: "Accounts" }));
    expect(frame("Accounts")).toHaveTextContent(
      "Other calendar accounts (iCloud, Google, Exchange) cannot be added.",
    );
    expect(screen.queryByRole("combobox", { name: "Days per week:" })).not.toBeInTheDocument();
    expect(onValueChange.mock.lastCall?.[0]).toBe("accounts");

    await user.click(screen.getByRole("tab", { name: "Alerts" }));
    expect(frame("Alerts")).toContainElement(popUp("All Day Events:"));

    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    expect(frame("Advanced")).toContainElement(checkbox("Show week numbers"));

    await user.click(screen.getByRole("tab", { name: "General" }));
    expect(frame("General")).toContainElement(popUp("Days per week:"));
  });

  it("keeps the default alerts in the settings, and dims what this Calendar cannot honour", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<CalendarPreferences onSettingsChange={onSettingsChange} />);
    await user.click(screen.getByRole("tab", { name: "Alerts" }));
    await user.click(popUp("Events:"));
    await user.click(await screen.findByRole("option", { name: "15 minutes before" }));
    expect(onSettingsChange.mock.lastCall?.[0].defaultAlert).toBe(15);
    await user.click(popUp("All Day Events:"));
    await user.click(await screen.findByRole("option", { name: "1 day before (9 AM)" }));
    expect(onSettingsChange.mock.lastCall?.[0].defaultAllDayAlert).toBe(900);
    await user.click(popUp("Events:"));
    await user.click(await screen.findByRole("option", { name: "None" }));
    expect(onSettingsChange.mock.lastCall?.[0].defaultAlert).toBeUndefined();
    expect(dimmed(checkbox("Time to Leave"))).toBe(true);
    expect(frame("Alerts")).toHaveTextContent("Time to Leave needs the time of the trip");
    expect(popUp("Account:")).toHaveTextContent("On This Desktop");

    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    expect(dimmed(checkbox("Turn on time zone support"))).toBe(false);
    expect(dimmed(checkbox("Ask before sending changes to events"))).toBe(true);
    expect(checkbox("Ask before sending changes to events")).toHaveAccessibleDescription(
      /a change reaches the people invited as soon as it is saved/,
    );
    await user.click(checkbox("Show week numbers"));
    expect(checkbox("Show week numbers")).toBeChecked();
    await user.click(checkbox("Show week numbers"));
    expect(checkbox("Show week numbers")).not.toBeChecked();
    expect(checkbox("Show events in year view")).toBeChecked();
    expect(dimmed(checkbox("Open events in separate windows"))).toBe(false);
  });

  it("keeps time zone support in the settings", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<CalendarPreferences onSettingsChange={onSettingsChange} />);
    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    await user.click(checkbox("Turn on time zone support"));
    expect(onSettingsChange.mock.lastCall?.[0].timeZoneSupport).toBe(true);
  });

  it("keeps what was set while another pane is shown", async () => {
    const user = userEvent.setup();
    render(<CalendarPreferences />);
    await choose(user, "Show:", "18");
    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    await user.click(screen.getByRole("tab", { name: "General" }));
    expect(popUp("Show:")).toHaveTextContent("18");
  });

  it("passes the window's props on: the pane, the state, the size and the close command", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CalendarPreferences
        defaultValue="advanced"
        state="inactive"
        width={600}
        onClose={onClose}
      />,
    );
    expect(frame("Advanced")).toHaveAttribute("data-window-state", "inactive");
    expect(frame("Advanced").style.width).toBe("600px");
    expect(screen.getByRole("tab", { name: "Advanced" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("on the Ferrite desktop", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const STORED: CalendarSettings = { ...defaultSettings, weekStartsOn: 1, hoursShown: 8 };

  /** Calendar's module, answering the person's stored preferences and taking saves. */
  function serve(settings: CalendarSettings | null) {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? { ok: true, status: 200, json: async () => ({ ...JSON.parse(String(init.body)) }) }
        : { ok: true, status: 200, json: async () => ({ settings, rev: 1 }) },
    );
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }
  const puts = (fetch: ReturnType<typeof serve>) =>
    fetch.mock.calls
      .filter(([, init]) => init?.method === "PUT")
      .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) }));

  it("shows the person's stored preferences, tells its owner, and saves a change to them", async () => {
    const fetch = serve(STORED);
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<CalendarPreferences onSettingsChange={onSettingsChange} />);
    await waitFor(() => expect(popUp("Start week on:")).toHaveTextContent("Monday"));
    expect(popUp("Show:")).toHaveTextContent("8");
    expect(String(fetch.mock.calls[0]?.[0])).toContain(CALENDAR_SETTINGS_URL);
    expect(onSettingsChange).toHaveBeenLastCalledWith(STORED);
    expect(puts(fetch), "taking in the stored preferences is no change to save").toEqual([]);

    await choose(user, "Days per week:", "5");
    await waitFor(() => expect(puts(fetch)).toHaveLength(1));
    expect(puts(fetch)[0]?.url).toContain(CALENDAR_SETTINGS_URL);
    expect(puts(fetch)[0]?.body).toMatchObject({ settings: { ...STORED, daysPerWeek: 5 }, rev: 1 });
  });

  it("keeps the starting preferences, and saves nothing, while the person has none stored", async () => {
    const fetch = serve(null);
    render(<CalendarPreferences />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(popUp("Start week on:")).toHaveTextContent("Sunday");
    expect(puts(fetch)).toEqual([]);
  });

  it("acts on the alternate calendar and asks Help Viewer for Calendar's help", async () => {
    serve(null);
    const user = userEvent.setup();
    const asked = vi.fn();
    window.addEventListener("macalicious:help-request", asked);
    render(<CalendarPreferences />);
    await waitFor(() => expect(checkbox("Show alternate calendar:").closest("[inert]")).toBeNull());
    await user.click(checkbox("Show alternate calendar:"));
    expect(popUp("Alternate calendar")).toBeEnabled();
    await user.click(checkbox("Show alternate calendar:"));
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(asked).toHaveBeenCalledTimes(1);
    expect(takeHelpRequest()).toBe("Calendar");
    window.removeEventListener("macalicious:help-request", asked);
  });
});
