import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreferencesContext } from "./pane";
import { downtimeAt, readDowntime } from "./panes/screen-time/screen-time-rules";
import { ServedScreenTime } from "./panes/screen-time/served-screen-time";

vi.mock("../desktop/desktop-screen-time", async (original) => {
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return {
    ...(await original<typeof import("../desktop/desktop-screen-time")>()),
    useScreenTimeUsage: () => ({ [day]: { calculator: 1_800, chess: 120 } }),
  };
});
vi.mock("../desktop/desktop-apps", () => ({
  discoveredApps: [
    { id: "finder", name: "Finder" },
    { id: "system-preferences", name: "System Preferences" },
    { id: "calculator", name: "Calculator" },
    { id: "chess", name: "Chess" },
    { id: "messages", name: "Messages" },
  ],
}));

/** The page in a window's settings, whose values are what goes to the server. */
function renderPage(values = new Map<string, unknown>()) {
  render(
    <div className="mac-window">
      <PreferencesContext.Provider
        value={{ values, themeTarget: undefined, showPane: () => {} } as never}
      >
        <ServedScreenTime />
      </PreferencesContext.Provider>
    </div>,
  );
  return values;
}

const section = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(
    within(screen.getByRole("listbox", { name: "Screen Time" })).getByRole("option", { name }),
  );

afterEach(() => vi.useRealTimers());

describe("Screen Time's sections on the served desktop", () => {
  it("lists the eight sections of the pane, opening on App Usage", async () => {
    renderPage();
    expect(
      within(screen.getByRole("listbox", { name: "Screen Time" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "App Usage",
      "Notifications",
      "Pickups",
      "Downtime",
      "App Limits",
      "Always Allowed",
      "Content & Privacy",
      "Options",
    ]);
    expect(await screen.findByText("Calculator:")).toBeInTheDocument();
  });

  it("Downtime turns on, keeps its schedule, and says what it does not do", async () => {
    const user = userEvent.setup();
    const values = renderPage();
    await section(user, "Downtime");
    expect(screen.getByText(/does not close or block an application/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("button", { name: "Turn On" }));
    expect(values.get("screen-time.downtime")).toMatchObject({
      on: true,
      from: "22:00",
      to: "07:00",
    });
    expect(screen.getByText("Now:")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Custom" }));
    expect(values.get("screen-time.downtime")).toMatchObject({ on: true, custom: true });
    await user.click(screen.getByRole("checkbox", { name: "Sunday" }));
    const kept = values.get("screen-time.downtime") as { days: { on: boolean }[] };
    expect(kept.days.map((day) => day.on)).toEqual([false, true, true, true, true, true, true]);
    expect(
      within(screen.getByRole("group", { name: "Sunday from" })).getAllByRole("spinbutton")[0],
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("Downtime's time follows an arrow key in its field", async () => {
    const user = userEvent.setup();
    const values = renderPage(new Map([["screen-time.downtime", { on: true }]]));
    await section(user, "Downtime");
    const from = screen.getByRole("group", { name: "From" });
    const hour = within(from).getByRole("spinbutton", { name: "Hour" });
    await user.click(hour);
    await user.keyboard("{ArrowUp}");
    expect(values.get("screen-time.downtime")).toMatchObject({ from: "23:00", to: "07:00" });
  });

  it("App Limits adds a limit, shows today's use of it, edits and removes it", async () => {
    const user = userEvent.setup();
    const values = renderPage();
    await section(user, "App Limits");
    expect(screen.getByRole("button", { name: "Add a limit" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Turn On" }));
    await user.click(screen.getByRole("button", { name: "Add a limit" }));
    const sheet = await screen.findByRole("dialog", { name: "Add Limit" });
    expect(within(sheet).queryByRole("checkbox", { name: "Finder" })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Done" })).toBeDisabled();
    await user.click(within(sheet).getByRole("checkbox", { name: "Calculator" }));
    const minutes = within(sheet).getByRole("textbox", { name: "Minutes a day" });
    await user.clear(minutes);
    await user.type(minutes, "45");
    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(values.get("screen-time.appLimits")).toMatchObject({
      on: true,
      block: true,
      limits: [{ apps: ["calculator"], minutes: 45, on: true }],
    });
    expect(screen.getByText("30 min of 45 min today")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit limit for Calculator" }));
    const edit = await screen.findByRole("dialog", { name: "Edit Limit" });
    const again = within(edit).getByRole("textbox", { name: "Minutes a day" });
    await user.clear(again);
    await user.type(again, "20");
    await user.click(within(edit).getByRole("button", { name: "Done" }));
    expect(screen.getByText("20 min used today: limit reached")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove limit for Calculator" }));
    expect(values.get("screen-time.appLimits")).toMatchObject({ limits: [] });
    expect(screen.getByText("No limits")).toBeInTheDocument();
  });

  it("Always Allowed starts with Catalina's and keeps a change", async () => {
    const user = userEvent.setup();
    const values = renderPage();
    await section(user, "Always Allowed");
    const list = await screen.findByRole("list", { name: "Allowed applications" });
    expect(within(list).getByRole("checkbox", { name: "Messages" })).toBeChecked();
    expect(within(list).getByRole("checkbox", { name: "Chess" })).not.toBeChecked();
    expect(within(list).queryByRole("checkbox", { name: "System Preferences" })).toBeNull();
    await user.click(within(list).getByRole("checkbox", { name: "Chess" }));
    expect(values.get("screen-time.alwaysAllowed")).toEqual([
      "messages",
      "facetime",
      "maps",
      "chess",
    ]);
  });

  it("Content & Privacy keeps its choices once it is on", async () => {
    const user = userEvent.setup();
    const values = renderPage();
    await section(user, "Content & Privacy");
    expect(screen.getByRole("checkbox", { name: "Adding friends in Game Center" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Turn On" }));
    await user.click(screen.getByRole("radio", { name: "Limit Adult Websites" }));
    await user.click(screen.getByRole("tab", { name: "Apps" }));
    await user.click(screen.getByRole("checkbox", { name: "Camera" }));
    expect(values.get("screen-time.contentPrivacy")).toEqual({
      on: true,
      web: "limit-adult",
      denied: ["Camera"],
    });
    expect(screen.getByText(/Safari and the stores here do not filter/)).toBeInTheDocument();
  });

  it("Pickups and Options say what a page cannot do", async () => {
    const user = userEvent.setup();
    const values = renderPage();
    await section(user, "Pickups");
    expect(screen.getByText(/cannot see how often you pick up a device/)).toBeInTheDocument();
    await section(user, "Options");
    await user.click(screen.getByRole("checkbox", { name: "Count Screen Time on this desktop" }));
    expect(values.get("screen-time.enabled")).toBe(false);
    const share = screen.getByRole("checkbox", { name: "Share across devices" });
    expect(share).toHaveAttribute("aria-disabled", "true");
    expect(share.closest("[title]")?.getAttribute("title")).toBe(
      "Sharing across devices needs an Apple ID, and this desktop has none.",
    );
  });
});

describe("Downtime's schedule at a moment", () => {
  const nights = readDowntime({ on: true, from: "22:00", to: "07:00" });

  it("runs over midnight", () => {
    expect(downtimeAt(nights, new Date(2026, 10, 3, 23, 0))).toEqual({
      active: true,
      until: new Date(2026, 10, 4, 7, 0),
    });
    expect(downtimeAt(nights, new Date(2026, 10, 4, 6, 59))).toEqual({
      active: true,
      until: new Date(2026, 10, 4, 7, 0),
    });
  });

  it("names the next start when outside it", () => {
    expect(downtimeAt(nights, new Date(2026, 10, 4, 7, 0))).toEqual({
      active: false,
      next: new Date(2026, 10, 4, 22, 0),
    });
  });

  it("follows a custom day, and finds nothing when every day is off", () => {
    const days = Array.from({ length: 7 }, () => ({ on: false, from: "09:00", to: "10:00" }));
    expect(downtimeAt(readDowntime({ custom: true, days }), new Date(2026, 10, 4, 9, 30))).toEqual({
      active: false,
      next: null,
    });
    const wednesday = days.map((day, index) => (index === 3 ? { ...day, on: true } : day));
    expect(
      downtimeAt(readDowntime({ custom: true, days: wednesday }), new Date(2026, 10, 4, 9, 30)),
    ).toEqual({ active: true, until: new Date(2026, 10, 4, 10, 0) });
  });
});
