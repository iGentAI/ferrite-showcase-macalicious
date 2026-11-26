import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PANES } from "./panes";
import { dynamicRangeFact } from "./served-pages";
import { SystemPreferences } from "./system-preferences";

describe("This Screen's High dynamic range", () => {
  const answering = (query: string | null) => (asked: string) => ({
    matches: asked === query,
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["(dynamic-range: high)", "Yes"],
    ["(dynamic-range: standard)", "No"],
    [null, "Not reported by this browser"],
  ])("answers to %s with %s", (query, fact) => {
    vi.stubGlobal("matchMedia", answering(query));
    expect(dynamicRangeFact()).toBe(fact);
  });

  it("is not reported by a browser without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(dynamicRangeFact()).toBe("Not reported by this browser");
  });
});

vi.mock("./storage", async (original) => ({
  ...(await original<typeof import("./storage")>()),
  useServerSettings: () => false,
}));

afterEach(() => vi.unstubAllEnvs());

/** What the captures show of a Mac, which a served page must never say of this one. */
const CAPTURED_FACTS: readonly (readonly [pane: string, words: RegExp])[] = [
  ["network", /192\.168\.7\.167|Thunderbolt Bridge|Turn Wi-Fi Off/],
  ["bluetooth", /Magic Mouse|Alexs-MacBook-Pro|Turn Bluetooth Off/],
  ["printers-and-scanners", /LP-2270DW/],
  ["time-machine", /787\.8 MB|49\.7 GB|Oldest backup/],
  ["startup-disk", /Macintosh SSD/],
  ["software-update", /Catalina Beta|Developer Seed/],
  ["apple-id", /Alex|4\.81|MacBook Pro/],
  ["users-and-groups", /Alex Morgan/],
  ["date-and-time", /2019|time\.apple\.com/],
  ["displays", /Retina|Default for display|Scaled/],
  ["sharing", /alexmorgan|\.local/],
  ["energy-saver", /Battery is charged/],
  ["screen-time", /\dh \d+m/],
];

describe("on the served desktop a pane says what is true of it", () => {
  it.each(CAPTURED_FACTS)("%s shows none of the captured Mac's facts", (id, words) => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const { container } = render(<SystemPreferences defaultPane={id} />);
    const pane = container.querySelector<HTMLElement>(`[data-pane="${id}"]`);
    expect(pane?.textContent).not.toBe("");
    expect(pane?.textContent).not.toMatch(words);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("never names the captured person in the account header, whatever the session answers", () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no session")));
    const { container } = render(<SystemPreferences />);
    expect(container.textContent).not.toMatch(/Alex Morgan|Apple ID, iCloud/);
    expect(container.textContent).toMatch(/Account of this desktop/);
    vi.unstubAllGlobals();
  });

  it("takes the window to the height of the page, and keeps the demo elsewhere", () => {
    const sizes: number[] = [];
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const { unmount } = render(
      <SystemPreferences
        defaultPane="family-sharing"
        onFrameSizeChange={(size) => sizes.push(size.height)}
      />,
    );
    expect(sizes.at(-1)).toBe(PANES.get("family-sharing")?.served?.height);
    unmount();
    vi.unstubAllEnvs();
    const { container } = render(<SystemPreferences defaultPane="network" />);
    expect(
      within(
        container.querySelector<HTMLElement>('[data-pane="network"]') as HTMLElement,
      ).getByText("Turn Wi-Fi Off"),
    ).toBeVisible();
  });

  it("reads the computer's real clock in Date & Time", () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.useFakeTimers({ now: new Date(2026, 10, 3, 9, 5, 7) });
    try {
      render(<SystemPreferences defaultPane="date-and-time" />);
      expect(screen.getByText("Tuesday, November 3, 2026")).toBeVisible();
      expect(screen.getByText("9:05:07 AM")).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });
});
