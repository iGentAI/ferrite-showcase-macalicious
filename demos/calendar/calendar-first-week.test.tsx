import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";
import { CAPTURE_NOW, type CalendarSettings, defaultSettings } from "./calendar-data";
import { CALENDAR_SETTINGS_URL } from "./calendar-server";

/*
 * On the desktop served by Ferrite, Calendar's first week is laid out from the person's stored
 * first day from its first drawn frame: the events' read answers the preferences beside the
 * events, and nothing of the window's body is drawn until that read settles. A file of its own,
 * so that the page-wide document channels and first-request gate start fresh.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const MONDAY: CalendarSettings = { ...defaultSettings, weekStartsOn: 1 };

describe("Calendar's first week on the desktop", () => {
  it("is drawn from the stored first day, which the events' read answers, never from Sunday first", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer = () => {};
    const fetch = vi.fn((url: string) =>
      // The preferences' own document has nothing stored: the first day comes from the events' read.
      String(url).startsWith(CALENDAR_SETTINGS_URL)
        ? Promise.resolve({ ok: true, status: 200, json: async () => ({ settings: null, rev: 0 }) })
        : new Promise((resolve) => {
            answer = () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ events: null, rev: 0, settings: MONDAY }),
              });
          }),
    );
    vi.stubGlobal("fetch", fetch);
    const { container } = render(<Calendar now={CAPTURE_NOW} />);
    const body = container.querySelector<HTMLElement>(".mac-calendar-body");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    // Until the read is answered, nothing of the week is drawn.
    expect(body?.style.visibility).toBe("hidden");
    answer();
    await waitFor(() => expect(body).not.toHaveAttribute("inert"));
    expect(body?.style.visibility).not.toBe("hidden");
    // Thursday 3 October 2019: its week begins on Monday 30 September.
    const first = container.querySelector(".mac-calendar-week-grid-day");
    expect(first?.textContent).toMatch(/^\s*Mon/);
    expect(first?.textContent).toContain("30");
  });

  it("draws its body at once off the desktop, as the documentation shows it", () => {
    const { container } = render(<Calendar now={CAPTURE_NOW} />);
    const body = container.querySelector<HTMLElement>(".mac-calendar-body");
    expect(body?.style.visibility).toBe("");
    expect(container.querySelector(".mac-calendar-week-grid-day")?.textContent).toMatch(/^\s*Sun/);
  });
});
