import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serverDocument } from "../desktop/desktop-server";
import { CALENDAR_LOADING, Calendar } from "./calendar";
import { CAPTURE_NOW, defaultEvents } from "./calendar-data";
import {
  CALENDAR_EVENTS_URL,
  documentFromServer,
  documentToServer,
  eventsToServer,
} from "./calendar-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const DENTIST = {
  id: "new-1",
  title: "Dentist",
  start: new Date(2019, 9, 2, 9).getTime(),
  end: new Date(2019, 9, 2, 10).getTime(),
  calendar: "home",
};

/** A Ferrite application that answers the load with `reply` (or fails) and accepts saves. */
function serve(reply: unknown, ok = true) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "PUT"
      ? { ok: true, json: async () => JSON.parse(String(init.body)) }
      : { ok, json: async () => reply },
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const saves = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }));

const event = (name: RegExp) => screen.queryByRole("button", { name });

/** The window's toolbar and body, which are inert while the first load is under way. */
const content = () => [
  screen.getByRole("toolbar", { name: "Toolbar" }),
  document.querySelector(".mac-calendar-body") as HTMLElement,
];

const settled = () =>
  waitFor(() => {
    for (const element of content()) expect(element).not.toHaveAttribute("inert");
  });

describe("Calendar's document on the desktop's Ferrite application", () => {
  it("sends the calendars and every event field", () => {
    const body = documentToServer(
      [
        {
          id: "standup",
          title: "Standup",
          start: new Date(2019, 9, 1, 9, 30),
          end: new Date(2019, 9, 1, 9, 45),
          calendar: "work",
          location: "Room 4",
          notes: "  ",
          repeat: { freq: "daily", count: 4 },
        },
      ],
      [{ id: "work", name: "Work", color: "purple" }],
    );
    expect(body).toEqual({
      calendars: [{ id: "work", name: "Work", color: "purple" }],
      events: [
        {
          id: "standup",
          title: "Standup",
          start: new Date(2019, 9, 1, 9, 30).getTime(),
          end: new Date(2019, 9, 1, 9, 45).getTime(),
          calendar: "work",
          location: "Room 4",
          repeat: { freq: "daily", count: 4 },
          // A timed repeat repeats in a zone of its own: this browser's (vitest's UTC), as it had none.
          timeZone: "UTC",
        },
      ],
    });
  });

  it("reads calendars and events, and refuses a document with anything else in them", () => {
    expect(
      documentFromServer({
        events: null,
        calendars: [{ id: "a", name: "A", color: "green" }],
      }),
    ).toEqual({ calendars: [{ id: "a", name: "A", color: "green" }] });
    expect(documentFromServer({ events: [] })).toEqual({ events: [] });
    for (const calendars of [
      [
        { id: "a", name: "A", color: "green" },
        { id: "b", name: "B", color: "teal" },
      ],
      [{ id: "a", name: "A", color: "green" }, null],
      [],
      "Home",
    ]) {
      expect(documentFromServer({ events: [], calendars }), JSON.stringify(calendars)).toBeNull();
    }
    // A field the window does not know, as an older document may hold, is left behind; the
    // invitees are kept, by account name.
    const [read] =
      documentFromServer({
        events: [{ ...DENTIST, someLaterField: 10, invitees: ["martin"] }],
      })?.events ?? [];
    expect(read).toEqual({
      id: DENTIST.id,
      title: DENTIST.title,
      start: new Date(DENTIST.start),
      end: new Date(DENTIST.end),
      calendar: DENTIST.calendar,
      invitees: ["martin"],
    });
    expect(documentToServer(read ? [read] : [], []).events[0]?.invitees).toEqual(["martin"]);
    // Invitees that are not names make the document one the window cannot read.
    expect(
      documentFromServer({ events: [{ ...DENTIST, invitees: [{ name: "martin" }] }] }),
    ).toBeNull();
  });
});

describe("Calendar on the desktop's Ferrite application", () => {
  it("turns an event into the module's form and back", () => {
    const sent = eventsToServer(defaultEvents);
    expect(sent.events[0]).toEqual({
      id: "labor-day",
      title: "Labor Day",
      start: new Date(2019, 8, 2).getTime(),
      end: new Date(2019, 8, 3).getTime(),
      allDay: true,
      calendar: "holidays",
      timeZone: "UTC",
    });
    expect(documentFromServer(JSON.parse(JSON.stringify(sent)))?.events).toEqual(defaultEvents);
    expect(documentFromServer({ events: null })).toEqual({});
    expect(documentFromServer({ events: [{ id: 1 }] })).toBeNull();
    // Times outside what a JavaScript Date holds would become Invalid Dates.
    for (const bad of [
      { ...DENTIST, start: 1e100 },
      { ...DENTIST, end: Number.NaN },
      { ...DENTIST, end: -8.65e15 },
    ]) {
      expect(documentFromServer({ events: [bad, DENTIST] })).toBeNull();
    }
  });

  it("refuses a document with an event whose all-day flag is not a boolean", () => {
    for (const allDay of ["yes", 1, null]) {
      expect(documentFromServer({ events: [{ ...DENTIST, allDay }] })).toBeNull();
    }
    expect(
      documentFromServer({
        events: [
          { ...DENTIST, id: "d", allDay: true },
          { ...DENTIST, id: "e", allDay: false },
        ],
      })?.events?.map((entry) => [entry.id, entry.allDay ?? false]),
    ).toEqual([
      ["d", true],
      ["e", false],
    ]);
  });

  it("keeps an event's popover closed until the saved events have loaded", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetch);
    render(<Calendar now={CAPTURE_NOW} defaultSelectedEvent="screenshots" defaultPopoverOpen />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    answer({ ok: true, json: async () => ({ events: null, rev: 0 }) });
    expect(await screen.findByRole("dialog", { name: "Make Catalina Screenshots" })).toBeVisible();
  });

  it("keeps the Inspector from editing until the saved events have loaded", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetch);
    render(<Calendar now={CAPTURE_NOW} defaultSelectedEvent="screenshots" />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.keyDown(screen.getByRole("region", { name: "Calendar" }), {
      key: "i",
      code: "KeyI",
      altKey: true,
      ctrlKey: true,
    });
    const inspector = await screen.findByRole("region", { name: "Inspector" });
    expect(inspector).toHaveTextContent(CALENDAR_LOADING);
    expect(inspector).not.toHaveTextContent("Make Catalina Screenshots");
    expect(within(inspector).queryByRole("textbox")).not.toBeInTheDocument();
    answer({ ok: true, json: async () => ({ events: null, rev: 0 }) });
    await settled();
    expect(inspector).toHaveTextContent("Make Catalina Screenshots");
    expect(inspector).not.toHaveTextContent(CALENDAR_LOADING);
  });

  it("asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<Calendar />);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps its content inert until the saved events have loaded", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetch);
    render(<Calendar now={CAPTURE_NOW} />);
    for (const element of content()) expect(element).toHaveAttribute("inert");
    expect(content()[1]).toHaveAttribute("aria-busy", "true");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    answer({ ok: true, json: async () => ({ events: [DENTIST] }) });
    await settled();
    expect(event(/Dentist/)).toBeInTheDocument();
  });

  it("shows the session's saved events and saves a new one", async () => {
    const user = userEvent.setup();
    const fetch = serve({ events: [DENTIST] });
    render(<Calendar now={CAPTURE_NOW} />);
    await waitFor(() => expect(event(/Dentist/)).toBeInTheDocument());
    await settled();
    expect(event(/Make Catalina Screenshots/)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/calendar/events", expect.anything());
    // Showing what was loaded saves nothing.
    expect(saves(fetch)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "New Event" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(1));
    const [save] = saves(fetch);
    expect(save?.url).toBe("/api/calendar/events");
    expect(save?.body.events.map((entry: { title: string }) => entry.title)).toEqual([
      "Dentist",
      "New Event",
    ]);
    // The new event did not take the id of the saved one.
    expect(save?.body.events[1].id).toBe("new-2");
  });

  it("keeps its starting events for a session that saved none, and saves them with a change", async () => {
    const user = userEvent.setup();
    const fetch = serve({ events: null });
    render(<Calendar now={CAPTURE_NOW} />);
    await settled();
    expect(fetch).toHaveBeenCalled();
    expect(event(/Make Catalina Screenshots/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New Event" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(1));
    expect(saves(fetch)[0]?.body.events).toHaveLength(defaultEvents.length + 1);
  });

  it("saves nothing when the saved events could not be read, and stays usable", async () => {
    const user = userEvent.setup();
    const fetch = serve({ error: "storage failed" }, false);
    render(<Calendar now={CAPTURE_NOW} />);
    await settled();
    expect(fetch).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "New Event" }));
    expect(event(/^New Event, /)).toBeInTheDocument();
    // A save would be given to the document's channel by now: wait until it has none to send.
    await serverDocument(CALENDAR_EVENTS_URL).idle();
    expect(saves(fetch)).toEqual([]);
  });

  it("saves nothing over a stored document whose events it cannot read", async () => {
    // The same steps with a document it can read, last, show Dentist and save the new event: the
    // checks can tell a document taken in from one left alone.
    const readable = { events: [DENTIST] };
    for (const reply of [
      { events: "Dentist" },
      { events: { 0: DENTIST } },
      { rev: 3 },
      // One event it cannot read, beside one it can.
      { events: [DENTIST, { ...DENTIST, id: "x", start: "tomorrow" }] },
      // No calendar at all, or one it cannot read.
      { events: [DENTIST], calendars: [] },
      { events: [DENTIST], calendars: [{ id: "home", name: "Home", color: "teal" }] },
      readable,
    ]) {
      const user = userEvent.setup();
      const fetch = serve(reply);
      // On the day of the capture, whose week holds Dentist (2 October 2019).
      const { unmount } = render(<Calendar now={CAPTURE_NOW} />);
      await settled();
      expect(fetch).toHaveBeenCalled();
      if (reply === readable) {
        expect(event(/Dentist/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "New Event" }));
        await waitFor(() => expect(saves(fetch)).toHaveLength(1));
        unmount();
        continue;
      }
      // Nothing of the stored document is shown: the window keeps its starting events.
      expect(event(/Dentist/), JSON.stringify(reply)).not.toBeInTheDocument();
      expect(event(/Make Catalina Screenshots/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "New Event" }));
      expect(event(/^New Event, /)).toBeInTheDocument();
      await serverDocument(CALENDAR_EVENTS_URL).idle();
      expect(saves(fetch), JSON.stringify(reply)).toEqual([]);
      unmount();
    }
  });
});
