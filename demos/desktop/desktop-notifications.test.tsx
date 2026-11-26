import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopApp } from "./desktop-apps";
import {
  allowLiveStream,
  changesFromState,
  changesNotMadeHere,
  DND_HOLD_MS,
  itemsFromState,
  SERVER_CHANGE_EVENT,
} from "./desktop-live";
import {
  BANNER_MS,
  DesktopNotificationBanners,
  DesktopNotificationCenter,
  deliveredText,
  dueRemindersFromServer,
  eventTimeText,
  localDay,
  quotesFromServer,
  soundsItself,
  upNextFromServer,
} from "./desktop-notifications";
import { takeOpenItemRequests } from "./desktop-open-item";
import {
  appWritesSettled,
  appWritesUnderWay,
  CHANGE_HEADER,
  REQUEST_DEADLINE_MS,
  serverDocument,
  sessionFetch,
  setDesktopSession,
} from "./desktop-server";

/** Stands in for the browser's `EventSource`: the test sends the stream's events. */
class FakeEventSource {
  static all: FakeEventSource[] = [];
  readonly listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.all.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }
  static open(): FakeEventSource {
    const open = FakeEventSource.all.filter((source) => !source.closed);
    const last = open.at(-1);
    if (!last) throw new Error("no open stream");
    return last;
  }
}

const APPS = [
  { id: "reminders", name: "Reminders" },
  { id: "messages", name: "Messages" },
  { id: "finder", name: "Finder" },
  { id: "calendar", name: "Calendar" },
  { id: "stocks", name: "Stocks" },
] as unknown as DesktopApp[];

/** 2026-10-12 15:00 UTC. */
const NOW = 1_791_817_200_000;
const now = () => NOW;

const MESSAGE = {
  seq: 2,
  at_ms: NOW - 60_000,
  app: "messages",
  id: "desktop#4",
  title: "Lena",
  body: "Lunch at one?",
};
const DOWNLOAD = {
  seq: 1,
  at_ms: NOW - 300_000,
  app: "finder",
  id: "page-1",
  title: "Download Finished",
  body: "report.pdf",
  dismiss: "/downloads/1/seen",
};
const ALERT = {
  seq: 3,
  at_ms: NOW,
  app: "reminders",
  id: "rent@5",
  title: "Pay rent",
  alert: true,
  dismiss: "/alerts/rent/dismiss",
  actions: [{ label: "Snooze", post: "/alerts/rent/snooze" }],
};

/** A `state` frame; versions only grow, as the server's do. */
let version = 0;
const state = (items: unknown[], extra: Record<string, unknown> = {}) => {
  version += 1;
  return { version, state: { items, dnd: false, changes: {}, ...extra } };
};

interface Sent {
  url: string;
  method: string;
  body: unknown;
}

/** A served desktop's server: the ticket route, Today's routes, and every write recorded. */
function serve(replies: Record<string, unknown> = {}, ticketStatus = 201) {
  const sent: Sent[] = [];
  /** Writes answered 500, as `METHOD url`; a test adds and removes them. */
  const failing = new Set<string>();
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url.startsWith("/api/session/ticket")) {
      return new Response(JSON.stringify({ ticket: "a".repeat(64), tag: "mine" }), {
        status: ticketStatus,
      });
    }
    if (method !== "GET") {
      sent.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response("{}", { status: failing.has(`${method} ${url}`) ? 500 : 200 });
    }
    const all: Record<string, unknown> = {
      "/api/apps": {
        apps: ["calendar", "reminders", "stocks"].map((name) => ({ name })),
      },
      "/api/calendar/events": { events: null },
      "/api/reminders/data": { data: null },
      "/api/stocks/watchlist": { symbols: null },
      ...replies,
    };
    const path = url.split("?")[0] ?? url;
    return new Response(JSON.stringify(all[path] ?? { error: "not found" }), {
      status: path in all ? 200 : 404,
    });
  });
  vi.stubGlobal("fetch", fetch);
  return { sent, fetch, failing };
}

beforeEach(() => {
  FakeEventSource.all = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the person's live notifications", () => {
  it("reads only notifications it can show, newest first", () => {
    expect(
      itemsFromState({
        items: [
          DOWNLOAD,
          MESSAGE,
          { ...MESSAGE, seq: 9, app: "Bad App" },
          { ...MESSAGE, seq: 8, title: "" },
          { ...DOWNLOAD, seq: 7, dismiss: "/../session/sign-out" },
          null,
        ],
      }).map((item) => [item.seq, item.dismiss]),
    ).toEqual([
      [7, undefined],
      [2, undefined],
      [1, "/downloads/1/seen"],
    ]);
    expect(itemsFromState(null)).toEqual([]);
  });

  it("reads the change counts, and counts the changes this page did not make", () => {
    expect(
      changesFromState({
        changes: { notes: { n: 2, by: "other" }, stickies: { n: 1, by: "mine" }, x: { n: "1" } },
      }),
    ).toEqual(
      new Map([
        ["notes", { n: 2, by: "other", since: 0 }],
        ["stickies", { n: 1, by: "mine", since: 0 }],
      ]),
    );
    expect(
      changesFromState({ changes: { notes: { n: 2, by: "a", since: 7 } } }).get("notes"),
    ).toEqual({ n: 2, by: "a", since: 7 });
    // Changes 2 to 4, of which this page made 2 and 4; 1 and 5 are outside them.
    expect(changesNotMadeHere(1, 4, new Set([1, 2, 4, 5]))).toEqual([3]);
    expect(changesNotMadeHere(1, 4, new Set([2, 3, 4]))).toEqual([]);
    expect(changesNotMadeHere(1, 4, undefined)).toEqual([2, 3, 4]);
    expect(changesNotMadeHere(4, 4, new Set())).toEqual([]);
    // Past the limit only one more is told, however long the range.
    expect(changesNotMadeHere(0, 1_000_000, new Set([1]), 2)).toEqual([2, 3, 4]);
  });

  it("fills the Today widgets from the person's own data", () => {
    const hour = 3_600_000;
    const events = {
      events: [
        { id: "done", title: "Over", start: NOW - 2 * hour, end: NOW - hour, calendar: "home" },
        { id: "b", title: "Later", start: NOW + 2 * hour, end: NOW + 3 * hour, calendar: "home" },
        { id: "a", title: "Lunch", start: NOW + hour, end: NOW + 2 * hour, calendar: "work" },
        { id: "far", title: "Next week", start: NOW + 7 * 24 * hour, end: NOW + 7 * 25 * hour },
      ],
    };
    expect(upNextFromServer(events, NOW).map((event) => event.id)).toEqual(["a", "b"]);
    expect(upNextFromServer({ events: null }, NOW)).toEqual([]);
    const today = localDay(NOW);
    const reminders = {
      data: {
        reminders: [
          { id: "1", title: "Today", due: today },
          { id: "2", title: "Old", due: "2020-01-01" },
          { id: "3", title: "Done", due: today, completed: true },
          { id: "4", title: "Future", due: "2999-01-01" },
          { id: "5", title: "Undated" },
        ],
      },
    };
    expect(dueRemindersFromServer(reminders, NOW)).toEqual([
      { id: "2", title: "Old", due: "2020-01-01", overdue: true },
      { id: "1", title: "Today", due: today, overdue: false },
    ]);
    expect(
      quotesFromServer({ quotes: [{ symbol: "AAPL", price: 1.5, change: -0.2 }, { symbol: 3 }] }),
    ).toEqual([{ symbol: "AAPL", price: 1.5, change: -0.2 }]);
    expect(
      eventTimeText({ id: "x", title: "x", start: NOW, end: NOW + hour, allDay: true }, NOW),
    ).toBe("All-day");
    expect(deliveredText(NOW - 5 * 60_000, NOW)).toBe("5m ago");
  });
});

describe("Notification Center on the desktop", () => {
  it("lists what the stream delivers, clears it and turns on Do Not Disturb", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { sent } = serve({
      "/api/calendar/events": {
        events: [{ id: "e", title: "Standup", start: NOW + 600_000, end: NOW + 1_200_000 }],
      },
      "/api/reminders/data": {
        data: { reminders: [{ id: "r", title: "Water plants", due: localDay(NOW) }] },
      },
      "/api/stocks/watchlist": { symbols: ["AAPL"] },
      "/api/stocks/quotes": { quotes: [{ symbol: "AAPL", price: 231.5, change: 1.25 }] },
    });
    const launch = vi.fn();
    const onClose = vi.fn();
    render(<DesktopNotificationCenter apps={APPS} launch={launch} onClose={onClose} now={now} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    expect(FakeEventSource.open().url).toBe(`/live/me?ticket=${"a".repeat(64)}`);
    act(() => FakeEventSource.open().emit("state", state([MESSAGE, DOWNLOAD])));

    const panel = screen.getByRole("complementary", { name: "Notification Center" });
    await waitFor(() => expect(panel).toHaveTextContent("You have 2 notifications."));
    await waitFor(() =>
      expect(within(panel).getByRole("region", { name: "Calendar" })).toHaveTextContent("Standup"),
    );
    expect(within(panel).getByRole("region", { name: "Reminders" })).toHaveTextContent(
      "Water plants",
    );
    await waitFor(() =>
      expect(within(panel).getByRole("region", { name: "Stocks" })).toHaveTextContent("+1.25"),
    );
    expect(panel).toHaveTextContent("The next thing on your calendar is “Standup”");

    await user.click(within(panel).getByRole("switch", { name: "Do Not Disturb" }));
    await waitFor(() =>
      expect(sent).toContainEqual({
        url: "/api/notification-center/dnd",
        method: "PUT",
        body: { on: true },
      }),
    );

    await user.click(within(panel).getByRole("tab", { name: "Notifications" }));
    const finder = within(panel).getByRole("region", { name: "Finder" });
    expect(finder).toHaveTextContent("Download Finished");
    await user.click(within(finder).getByRole("button", { name: "Clear Finder" }));
    await waitFor(() =>
      expect(sent.map((s) => `${s.method} ${s.url}`)).toEqual(
        expect.arrayContaining([
          "POST /api/finder/downloads/1/seen",
          "DELETE /api/notification-center/inbox?app=finder",
        ]),
      ),
    );
    expect(within(panel).queryByRole("region", { name: "Finder" })).toBeNull();

    await user.click(within(panel).getByRole("button", { name: /Lunch at one\?/ }));
    expect(launch).toHaveBeenCalledWith("messages");
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(sent.map((s) => `${s.method} ${s.url}`)).toContain(
        "DELETE /api/notification-center/inbox/2",
      ),
    );
  });

  it("keeps a clear and Do Not Disturb until the server confirms, and undoes them when it fails", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { failing } = serve();
    render(<DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([MESSAGE, DOWNLOAD])));
    const panel = screen.getByRole("complementary", { name: "Notification Center" });
    await user.click(within(panel).getByRole("tab", { name: "Notifications" }));

    // Cleared: a state read before the clear reached the server does not bring it back.
    await user.click(within(panel).getByRole("button", { name: "Clear Finder" }));
    act(() => FakeEventSource.open().emit("state", state([MESSAGE, DOWNLOAD])));
    expect(within(panel).queryByRole("region", { name: "Finder" })).toBeNull();
    act(() => FakeEventSource.open().emit("state", state([MESSAGE])));
    expect(within(panel).queryByRole("region", { name: "Finder" })).toBeNull();

    // A clear the server refuses comes back on the screen.
    failing.add("DELETE /api/notification-center/inbox?app=messages");
    await user.click(within(panel).getByRole("button", { name: "Clear Messages" }));
    await waitFor(() =>
      expect(within(panel).getByRole("region", { name: "Messages" })).toBeInTheDocument(),
    );

    // Do Not Disturb the server refuses goes back off.
    failing.add("PUT /api/notification-center/dnd");
    await user.click(within(panel).getByRole("tab", { name: "Today" }));
    const toggle = within(panel).getByRole("switch", { name: "Do Not Disturb" });
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
  });

  it("keeps an alert's actions in Notification Center, and says when one did not work", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { sent, failing } = serve();
    render(<DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([ALERT, MESSAGE])));
    const panel = screen.getByRole("complementary", { name: "Notification Center" });
    await user.click(within(panel).getByRole("tab", { name: "Notifications" }));
    const reminders = () => within(panel).getByRole("region", { name: "Reminders" });
    failing.add("POST /api/reminders/alerts/rent/snooze");
    // While the action is under way the alert is off the list; it comes back when it fails.
    await user.click(within(reminders()).getByRole("button", { name: "Snooze" }));
    expect(await within(panel).findByText("Snooze did not work. Try again.")).toBeInTheDocument();
    failing.clear();
    await user.click(within(reminders()).getByRole("button", { name: "Snooze" }));
    await waitFor(() =>
      expect(sent.map((s) => `${s.method} ${s.url}`)).toContain(
        "DELETE /api/notification-center/inbox/3",
      ),
    );
    // A notification with no actions has none here.
    const messages = within(panel).getByRole("region", { name: "Messages" });
    expect(within(messages).queryByRole("button", { name: "Snooze" })).toBeNull();
  });

  it("still sends a newer Do Not Disturb when an earlier write fails", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const served = serve().fetch;
    const bodies: unknown[] = [];
    let fail: () => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if ((init?.method ?? "GET") !== "PUT") return served(url, init);
        bodies.push(JSON.parse(String(init?.body)));
        if (bodies.length > 1) return Promise.resolve(new Response("{}", { status: 200 }));
        return new Promise<Response>((resolve) => {
          fail = () => resolve(new Response("{}", { status: 500 }));
        });
      }),
    );
    render(<DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    const toggle = screen.getByRole("switch", { name: "Do Not Disturb" });
    await user.click(toggle);
    await user.click(toggle);
    // The first write fails after the second value was asked for: that value is still sent.
    await act(async () => {
      fail();
    });
    await waitFor(() => expect(bodies).toEqual([{ on: true }, { on: false }]));
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
  });

  it("reads a Today widget again when its app changes in another browser", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const events = { events: [] as unknown[] };
    serve({ "/api/calendar/events": events });
    render(<DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />);
    const panel = screen.getByRole("complementary", { name: "Notification Center" });
    await waitFor(() =>
      expect(within(panel).getByRole("region", { name: "Calendar" })).toHaveTextContent(
        "No events today or tomorrow",
      ),
    );
    events.events = [{ id: "e", title: "Retro", start: NOW + 600_000, end: NOW + 1_200_000 }];
    act(() => {
      window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "calendar" } }));
    });
    await waitFor(() =>
      expect(within(panel).getByRole("region", { name: "Calendar" })).toHaveTextContent("Retro"),
    );
  });

  it("asks for a new ticket when the stream ends, and nothing more for a changed session", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve();
    const view = render(
      <DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />,
    );
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("ended"));
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(2));
    expect(FakeEventSource.all[0]?.closed).toBe(true);
    view.unmount();
    expect(FakeEventSource.all.every((source) => source.closed)).toBe(true);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const changed = serve({}, 409);
    render(<DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />);
    const tickets = () =>
      changed.fetch.mock.calls.filter(([url]) => String(url).startsWith("/api/session/ticket"));
    await waitFor(() => expect(tickets()).toHaveLength(1));
    // Well past any retry: no second ticket, no stream.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(tickets()).toHaveLength(1);
    expect(FakeEventSource.all).toHaveLength(2);
  });

  it("clears the previous person's notifications when the next ticket is refused", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    serve();
    render(<DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([MESSAGE])));
    const panel = screen.getByRole("complementary", { name: "Notification Center" });
    await user.click(within(panel).getByRole("tab", { name: "Notifications" }));
    expect(within(panel).getByRole("region", { name: "Messages" })).toBeInTheDocument();
    // The session changed in another tab: the stream ends, and its next ticket is refused.
    serve({}, 409);
    act(() => FakeEventSource.open().emit("ended"));
    await waitFor(() =>
      expect(within(panel).queryByRole("region", { name: "Messages" })).toBeNull(),
    );
  });

  it("shows the date and no notifications, and asks nothing, when not served", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />);
    expect(screen.getByText(/served by its Ferrite application/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(FakeEventSource.all).toHaveLength(0);
  });
});

describe("answering a message on its banner", () => {
  const openFrom = async (...items: unknown[]) => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const served = serve();
    const launch = vi.fn();
    render(<DesktopNotificationBanners apps={APPS} launch={launch} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    act(() => FakeEventSource.open().emit("state", state(items)));
    return { launch, served };
  };
  const pressOn = (element: Element) => {
    fireEvent.pointerDown(element, { button: 0, clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(document, { button: 0, clientX: 5, clientY: 5, pointerId: 1 });
  };

  it("pressing an alert's body opens its item", async () => {
    const { launch } = await openFrom(ALERT);
    pressOn(screen.getByText("Pay rent"));
    expect(launch).toHaveBeenCalledWith("reminders");
    expect(takeOpenItemRequests("reminders")).toEqual([
      { app: "reminders", id: "rent@5", title: "Pay rent" },
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("an alert's buttons, and the choices of its Options menu, do only their own work", async () => {
    const { launch, served } = await openFrom({
      ...ALERT,
      actions: [
        { label: "Snooze", post: "/alerts/rent/snooze" },
        { label: "Later", post: "/alerts/rent/later" },
      ],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Options" }));
    await user.click(await screen.findByRole("menuitem", { name: "Later" }));
    await waitFor(() =>
      expect(served.sent.map((each) => each.url)).toContain("/api/reminders/alerts/rent/later"),
    );
    expect(launch).not.toHaveBeenCalled();
    expect(takeOpenItemRequests("reminders")).toEqual([]);
  });
});

describe("answering a message on its banner", () => {
  const URL = "/api/messages/conversations/desktop/messages";
  const start = async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const served = serve();
    render(<DesktopNotificationBanners apps={APPS} launch={vi.fn()} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    return served;
  };
  const posts = (sent: Sent[]) => sent.filter(({ url }) => url === URL);

  it("keeps the words it sent: read only after a failure, and sent again the same", async () => {
    const user = userEvent.setup();
    const { sent, failing } = await start();
    act(() => FakeEventSource.open().emit("state", state([MESSAGE])));
    await user.click(screen.getByRole("button", { name: "Reply" }));
    const field = screen.getByRole("textbox", { name: "Reply to Lena" });
    await user.type(field, "Yes");
    failing.add(`POST ${URL}`);
    await user.keyboard("{Enter}");
    await screen.findByText(/Not sent, or not heard back/);
    expect(posts(sent).map(({ body }) => body)).toEqual([{ text: "Yes" }]);
    expect(field).toHaveAttribute("readonly");
    await user.type(field, " please");
    failing.clear();
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(posts(sent).map(({ body }) => body)).toEqual([{ text: "Yes" }, { text: "Yes" }]);
    expect(sent.at(-1)).toMatchObject({ method: "DELETE" });
  });

  it("does not send on the Enter that accepts a composition", async () => {
    const user = userEvent.setup();
    const { sent } = await start();
    act(() => FakeEventSource.open().emit("state", state([MESSAGE])));
    await user.click(screen.getByRole("button", { name: "Reply" }));
    const field = screen.getByRole("textbox", { name: "Reply to Lena" });
    await user.type(field, "Yes");
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(posts(sent)).toEqual([]);
  });

  it("cannot be left or replaced while its answer is awaited", async () => {
    const user = userEvent.setup();
    await start();
    let answer: (reply: Response) => void = () => {};
    const served = globalThis.fetch;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
      url === URL
        ? new Promise<Response>((resolve) => {
            answer = resolve;
          })
        : served(url, init),
    );
    const other = { ...MESSAGE, seq: 7, id: "other#5", title: "Ben", body: "Tea?" };
    act(() => FakeEventSource.open().emit("state", state([other, MESSAGE])));
    const lena = screen.getByRole("status", { name: "Lena" });
    const ben = screen.getByRole("status", { name: "Ben" });
    await user.click(within(lena).getByRole("button", { name: "Reply" }));
    const field = screen.getByRole("textbox", { name: "Reply to Lena" });
    await user.type(field, "Yes{Enter}");
    expect(within(lena).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(within(ben).getByRole("button", { name: "Reply" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(field).toBeInTheDocument();
    await act(async () => {
      answer(new Response("{}", { status: 500 }));
      await Promise.resolve();
    });
    await screen.findByText(/Not sent, or not heard back/);
    expect(field).toHaveValue("Yes");
    expect(within(ben).getByRole("button", { name: "Reply" })).toBeEnabled();
  });
});

describe("banners and alerts", () => {
  it("brings in what is delivered now, lets banners slide away and keeps alerts until acted on", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { sent, failing } = serve();
    const launch = vi.fn();
    render(<DesktopNotificationBanners apps={APPS} launch={launch} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    // Delivered before the page opened: no banner.
    act(() => FakeEventSource.open().emit("state", state([DOWNLOAD])));
    expect(screen.queryByRole("status")).toBeNull();

    act(() => FakeEventSource.open().emit("state", state([MESSAGE, DOWNLOAD])));
    const banner = screen.getByRole("status", { name: "Lena" });
    expect(banner).toHaveTextContent("Lunch at one?");
    act(() => {
      vi.advanceTimersByTime(BANNER_MS);
    });
    expect(screen.queryByRole("status", { name: "Lena" })).toBeNull();

    act(() => FakeEventSource.open().emit("state", state([ALERT, MESSAGE, DOWNLOAD])));
    let alert = screen.getByRole("alert", { name: "Pay rent" });
    act(() => {
      vi.advanceTimersByTime(BANNER_MS * 3);
    });
    expect(screen.getByRole("alert", { name: "Pay rent" })).toBe(alert);
    // Snooze the app could not carry out: the alert comes back and stays in the inbox.
    failing.add("POST /api/reminders/alerts/rent/snooze");
    await user.click(within(alert).getByRole("button", { name: "Snooze" }));
    alert = await screen.findByRole("alert", { name: "Pay rent" });
    expect(sent.map((s) => `${s.method} ${s.url}`)).toEqual([
      "POST /api/reminders/alerts/rent/snooze",
    ]);
    failing.clear();
    sent.length = 0;
    await user.click(within(alert).getByRole("button", { name: "Snooze" }));
    await waitFor(() =>
      expect(sent.map((s) => `${s.method} ${s.url}`)).toEqual([
        "POST /api/reminders/alerts/rent/snooze",
        "DELETE /api/notification-center/inbox/3",
      ]),
    );
    expect(screen.queryByRole("alert")).toBeNull();

    // Two actions: Close and an Options pull-down that lists both.
    const both = {
      ...ALERT,
      seq: 5,
      title: "Water plants",
      actions: [
        { label: "Mark as Completed", post: "/alerts/water/complete" },
        { label: "Snooze", post: "/alerts/water/snooze" },
      ],
    };
    act(() => FakeEventSource.open().emit("state", state([both, ALERT, MESSAGE, DOWNLOAD])));
    const pull = screen.getByRole("alert", { name: "Water plants" });
    expect(within(pull).getByRole("button", { name: "Close" })).toBeInTheDocument();
    await user.click(within(pull).getByRole("button", { name: "Options" }));
    await user.click(await screen.findByRole("menuitem", { name: "Mark as Completed" }));
    await waitFor(() =>
      expect(sent.map((s) => `${s.method} ${s.url}`)).toContain(
        "POST /api/reminders/alerts/water/complete",
      ),
    );
    expect(screen.queryByRole("alert", { name: "Water plants" })).toBeNull();

    // With Do Not Disturb on, nothing comes in.
    const later = { ...MESSAGE, seq: 6, title: "Quiet" };
    act(() => FakeEventSource.open().emit("state", state([later], { dnd: true })));
    expect(screen.queryByRole("status", { name: "Quiet" })).toBeNull();
  });

  it("takes banners off the screen while the lock screen covers the desktop", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve();
    const { unmount } = render(<DesktopNotificationBanners apps={APPS} launch={vi.fn()} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    act(() => FakeEventSource.open().emit("state", state([ALERT])));
    expect(screen.getByRole("alert", { name: "Pay rent" })).toBeInTheDocument();
    try {
      act(() => allowLiveStream(false));
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      // Unmounted first, so that showing the desktop again opens no stream after this test.
      unmount();
      allowLiveStream(true);
    }
  });

  it("takes banners off the screen when the next ticket is refused", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve();
    render(<DesktopNotificationBanners apps={APPS} launch={vi.fn()} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    act(() => FakeEventSource.open().emit("state", state([ALERT])));
    expect(screen.getByRole("alert", { name: "Pay rent" })).toBeInTheDocument();
    // The session changed in another tab: the stream ends and its next ticket is refused.
    serve({}, 409);
    act(() => FakeEventSource.open().emit("ended"));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("takes an alert cleared in another browser off the screen, and reloads changed apps", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve();
    const changed: string[] = [];
    const listener = (event: Event) => changed.push((event as CustomEvent).detail.app);
    window.addEventListener(SERVER_CHANGE_EVENT, listener);
    try {
      render(<DesktopNotificationBanners apps={APPS} launch={vi.fn()} />);
      await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
      act(() => FakeEventSource.open().emit("state", state([])));
      act(() => FakeEventSource.open().emit("state", state([ALERT])));
      expect(screen.getByRole("alert", { name: "Pay rent" })).toBeInTheDocument();
      act(() =>
        FakeEventSource.open().emit(
          "state",
          state([], { changes: { notes: { n: 1, by: "other" }, stickies: { n: 1, by: "mine" } } }),
        ),
      );
      expect(screen.queryByRole("alert")).toBeNull();
      // Stickies changed in this browser, but not by this page nor a tab that told it: loaded too.
      expect(changed).toEqual(["notes", "stickies"]);
    } finally {
      window.removeEventListener(SERVER_CHANGE_EVENT, listener);
    }
  });

  it("loads again what a new page already holds when its first state counts changes", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve();
    // A session no earlier stream of this module heard: the page's first state.
    setDesktopSession("first-state");
    const changed: string[] = [];
    const listener = (event: Event) => changed.push((event as CustomEvent).detail.app);
    window.addEventListener(SERVER_CHANGE_EVENT, listener);
    try {
      render(<DesktopNotificationBanners apps={APPS} launch={vi.fn()} />);
      await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
      const counted = { changes: { notes: { n: 4, by: "other" } } };
      act(() => FakeEventSource.open().emit("state", state([], counted)));
      expect(changed).toEqual(["notes"]);
      // The same counts again: nothing more to load.
      act(() => FakeEventSource.open().emit("state", state([], counted)));
      expect(changed).toEqual(["notes"]);
    } finally {
      window.removeEventListener(SERVER_CHANGE_EVENT, listener);
      setDesktopSession(null);
    }
  });

  it("brings a closed alert back when the clear fails, and a stalled reply fails at its deadline", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { failing } = serve();
    render(<DesktopNotificationBanners apps={APPS} launch={vi.fn()} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    act(() => FakeEventSource.open().emit("state", state([ALERT])));
    failing.add("DELETE /api/notification-center/inbox/3");
    await user.click(
      within(screen.getByRole("alert", { name: "Pay rent" })).getByRole("button", {
        name: "Close",
      }),
    );
    expect(await screen.findByRole("alert", { name: "Pay rent" })).toBeInTheDocument();

    // A reply whose body never ends: the clear fails at the deadline and the alert comes back.
    const stalled = vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "DELETE") {
        return new Response(new ReadableStream({ start() {} }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", stalled);
    await user.click(
      within(screen.getByRole("alert", { name: "Pay rent" })).getByRole("button", {
        name: "Close",
      }),
    );
    expect(screen.queryByRole("alert", { name: "Pay rent" })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS + 1_000);
    });
    expect(await screen.findByRole("alert", { name: "Pay rent" })).toBeInTheDocument();
  });

  it("keeps an alert waiting behind newer banners and shows it when they slide away", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve();
    render(<DesktopNotificationBanners apps={APPS} launch={vi.fn()} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    act(() => FakeEventSource.open().emit("state", state([ALERT])));
    const newer = [6, 5, 4].map((seq) => ({
      ...MESSAGE,
      seq,
      id: `desktop#${seq}`,
      title: `Message ${seq}`,
    }));
    act(() => FakeEventSource.open().emit("state", state([...newer, ALERT])));
    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(screen.queryByRole("alert", { name: "Pay rent" })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(BANNER_MS);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("alert", { name: "Pay rent" })).toBeInTheDocument();
  });

  it("brings a failed alert back only while Notification Center is closed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const served = serve().fetch;
    let fail: () => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) =>
        (url.split("?")[0] ?? url).endsWith("/snooze")
          ? new Promise<Response>((resolve) => {
              fail = () => resolve(new Response("{}", { status: 500 }));
            })
          : served(url, init),
      ),
    );
    const launch = vi.fn();
    const { rerender } = render(<DesktopNotificationBanners apps={APPS} launch={launch} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    act(() => FakeEventSource.open().emit("state", state([ALERT])));
    await user.click(
      within(screen.getByRole("alert", { name: "Pay rent" })).getByRole("button", {
        name: "Snooze",
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    // Notification Center opens while the action is pending; then the action fails.
    rerender(<DesktopNotificationBanners apps={APPS} launch={launch} covered />);
    await act(async () => {
      fail();
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends Do Not Disturb one write at a time, the newest value last", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup();
    const { sent } = serve();
    render(<DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    const toggle = screen.getByRole("switch", { name: "Do Not Disturb" });
    await user.click(toggle);
    await user.click(toggle);
    await user.click(toggle);
    await waitFor(() => {
      const bodies = sent.filter((s) => s.url.startsWith("/api/notification-center/dnd"));
      expect(bodies.at(-1)?.body).toEqual({ on: true });
    });
    // Never more than one write under way, so they arrive in the order sent.
    const values = sent
      .filter((s) => s.url.startsWith("/api/notification-center/dnd"))
      .map((s) => (s.body as { on: boolean }).on);
    expect(values[0]).toBe(true);
    expect(values.length).toBeLessThanOrEqual(3);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("lets a newer Do Not Disturb from another browser win over this page's confirmed write", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serve();
    render(<DesktopNotificationCenter apps={APPS} launch={vi.fn()} onClose={vi.fn()} now={now} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    act(() => FakeEventSource.open().emit("state", state([])));
    const toggle = screen.getByRole("switch", { name: "Do Not Disturb" });
    await user.click(toggle);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    // Confirmed, but another browser turned it off again before any state showed it on.
    act(() => FakeEventSource.open().emit("state", state([], { dnd: false })));
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DND_HOLD_MS);
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    // From then on the server's value is shown as it comes.
    act(() => FakeEventSource.open().emit("state", state([], { dnd: true })));
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("reloads an app's data here when another tab of this browser wrote to it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    serve();
    const changed: string[] = [];
    const listener = (event: Event) => changed.push((event as CustomEvent).detail.app);
    window.addEventListener(SERVER_CHANGE_EVENT, listener);
    // Another tab of the same session (no session named in either, as in these tests).
    const otherTab = new BroadcastChannel("macalicious-writes");
    try {
      render(<DesktopNotificationBanners apps={APPS} launch={vi.fn()} />);
      await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
      otherTab.postMessage({ app: "notes", session: null });
      otherTab.postMessage({ app: "stickies", session: "someone-else" });
      await waitFor(() => expect(changed).toEqual(["notes"]));
    } finally {
      otherTab.close();
      window.removeEventListener(SERVER_CHANGE_EVENT, listener);
    }
  });
});

describe("live reloads of the person's documents", () => {
  const TABS = "/api/safari/tabs";

  /**
   * A served desktop holding Safari's tabs: each read of them is counted (a read after the first
   * is a reload by the live stream), and each write waits until the test answers it, with the
   * change number its reply names.
   */
  function serveTabs() {
    let reads = 0;
    const replies: ((change: number | null) => void)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const path = url.split("?")[0] ?? url;
        if (path === "/api/session/ticket") {
          return new Response(JSON.stringify({ ticket: "a".repeat(64), tag: "mine" }), {
            status: 201,
          });
        }
        if (path === TABS && method === "GET") {
          reads += 1;
          return new Response(JSON.stringify({ tabs: null, rev: 0 }), { status: 200 });
        }
        if (path === TABS) {
          return new Promise<Response>((resolve) =>
            replies.push((change) =>
              resolve(
                new Response("{}", {
                  status: 200,
                  headers: change === null ? {} : { [CHANGE_HEADER]: String(change) },
                }),
              ),
            ),
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }),
    );
    return {
      reads: () => reads,
      /** Start a write of this page; `answer` gives it its reply. */
      write: async () => {
        const before = replies.length;
        const written = sessionFetch(TABS, { method: "PUT", body: "{}" });
        // Microtasks only, so that this also works under fake timers.
        for (let tries = 0; tries < 100 && replies.length === before; tries += 1) {
          await Promise.resolve();
        }
        expect(replies.length).toBe(before + 1);
        const reply = replies[before] as (change: number | null) => void;
        return {
          answer: async (change: number | null) => {
            reply(change);
            await written;
            await flush();
          },
        };
      },
    };
  }

  /** Microtasks only, so that this also works under fake timers. */
  const flush = async () => {
    for (let tries = 0; tries < 50; tries += 1) await Promise.resolve();
  };
  /** Let a BroadcastChannel message arrive (it comes on the event loop). */
  const delivered = () => new Promise((resolve) => setTimeout(resolve, 50));
  const counts = (n: number, by: string, since = 0) =>
    state([], { changes: { safari: { n, by, since } } });

  /**
   * The desktop's stream held and Safari's tabs loaded once; `first` is the page's first state
   * (none counted, unless a test needs it to count something).
   */
  async function start(session: string, first = state([])) {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    setDesktopSession(session);
    const server = serveTabs();
    render(<DesktopNotificationBanners apps={APPS} launch={vi.fn()} />);
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(1));
    await serverDocument(TABS).load();
    return {
      ...server,
      /** The first state, after anything the test did before it. */
      heard: () => act(() => FakeEventSource.open().emit("state", first)),
    };
  }

  /** `start` with its first state heard at once. */
  async function started(session: string) {
    const server = await start(session);
    server.heard();
    expect(server.reads()).toBe(1);
    return server;
  }

  afterEach(() => setDesktopSession(null));

  it("loads nothing again for changes this page made, however many come between two states", async () => {
    const server = await started("own-writes");
    for (const change of [1, 2, 3]) await (await server.write()).answer(change);
    act(() => FakeEventSource.open().emit("state", counts(3, "mine")));
    await flush();
    expect(server.reads()).toBe(1);
    // Another browser's change after them is loaded.
    act(() => FakeEventSource.open().emit("state", counts(4, "other")));
    await waitFor(() => expect(server.reads()).toBe(2));
    // A write whose reply named no number is not known for this page's.
    await (await server.write()).answer(null);
    act(() => FakeEventSource.open().emit("state", counts(5, "mine")));
    await waitFor(() => expect(server.reads()).toBe(3));
  });

  it("loads another tab's change once, whether the tab or the stream tells of it first", async () => {
    const server = await started("other-tab");
    const tab = new BroadcastChannel("macalicious-writes");
    try {
      tab.postMessage({ app: "safari", session: "other-tab", change: 1 });
      await waitFor(() => expect(server.reads()).toBe(2));
      act(() => FakeEventSource.open().emit("state", counts(1, "mine")));
      await flush();
      expect(server.reads()).toBe(2);
      // The stream first: its count loads it, and the tab's word of it, coming after, does not.
      act(() => FakeEventSource.open().emit("state", counts(2, "mine")));
      await waitFor(() => expect(server.reads()).toBe(3));
      tab.postMessage({ app: "safari", session: "other-tab", change: 2 });
      await delivered();
      expect(server.reads()).toBe(3);
    } finally {
      tab.close();
    }
  });

  it("waits for its own write's reply before it takes a change counted meanwhile for another's", async () => {
    const server = await started("under-way");
    // The stream counts the write before its reply has come: it is this page's.
    const first = await server.write();
    act(() => FakeEventSource.open().emit("state", counts(1, "mine")));
    await flush();
    expect(server.reads()).toBe(1);
    await first.answer(1);
    expect(server.reads()).toBe(1);
    // Another browser's change and then this page's, counted before its reply: with one write
    // under way, two changes cannot both be the page's, so the app is loaded at once.
    const second = await server.write();
    act(() => FakeEventSource.open().emit("state", counts(3, "mine")));
    await waitFor(() => expect(server.reads()).toBe(2));
    await second.answer(3);
    expect(server.reads()).toBe(2);
    // One change beside one write under way waits; the reply names another, so it is loaded.
    const third = await server.write();
    act(() => FakeEventSource.open().emit("state", counts(4, "other")));
    await flush();
    expect(server.reads()).toBe(2);
    await third.answer(5);
    await waitFor(() => expect(server.reads()).toBe(3));
  });

  it("loads another browser's change when a reply names a change the first state counted", async () => {
    // The write's change is counted in the page's first state, which loads every app it counts.
    const server = await start("first-state-reply", counts(1, "mine"));
    const write = await server.write();
    server.heard();
    await waitFor(() => expect(server.reads()).toBe(2));
    // Another browser's change while the write still has no reply: it waits for the reply.
    act(() => FakeEventSource.open().emit("state", counts(2, "other")));
    await flush();
    expect(server.reads()).toBe(2);
    // The reply names the first state's change, not the waiting one, which is then loaded.
    await write.answer(1);
    await waitFor(() => expect(server.reads()).toBe(3));
  });

  it("loads another browser's change when a slow reply comes after an earlier wait ran out", async () => {
    const server = await started("slow-reply");
    const slow = await server.write();
    vi.useFakeTimers();
    // The slow write's own change waits for its reply, which does not come by the deadline.
    act(() => FakeEventSource.open().emit("state", counts(1, "mine")));
    await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS);
    expect(server.reads()).toBe(2);
    // Another browser's change beside a second write; then the slow reply names the old one.
    const next = await server.write();
    act(() => FakeEventSource.open().emit("state", counts(2, "other")));
    await flush();
    expect(server.reads()).toBe(2);
    await slow.answer(1);
    expect(server.reads()).toBe(2);
    await next.answer(3);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.reads()).toBe(3);
  });

  it("loads another browser's change when a background tab tells late of one already loaded", async () => {
    const server = await started("late-tab");
    const tab = new BroadcastChannel("macalicious-writes");
    try {
      // The tab's change, counted before the tab tells of it: loaded at once.
      act(() => FakeEventSource.open().emit("state", counts(1, "mine")));
      await waitFor(() => expect(server.reads()).toBe(2));
      // Another browser's change beside this page's write; then the tab's word of change 1.
      const write = await server.write();
      act(() => FakeEventSource.open().emit("state", counts(2, "other")));
      await flush();
      tab.postMessage({ app: "safari", session: "late-tab", change: 1 });
      await delivered();
      expect(server.reads()).toBe(2);
      await write.answer(3);
      await waitFor(() => expect(server.reads()).toBe(3));
    } finally {
      tab.close();
    }
  });

  it("loads the app when its count starts again, lower or from a new beginning", async () => {
    const server = await started("restart");
    act(() => FakeEventSource.open().emit("state", counts(3, "other", 100)));
    await waitFor(() => expect(server.reads()).toBe(2));
    // Lower than before: the count started again.
    act(() => FakeEventSource.open().emit("state", counts(1, "other", 200)));
    await waitFor(() => expect(server.reads()).toBe(3));
    // Climbed back past where it was between two states: its beginning tells.
    act(() => FakeEventSource.open().emit("state", counts(4, "other", 300)));
    await waitFor(() => expect(server.reads()).toBe(4));
    // Gone, then back: nothing to load for the going, and the new count loads.
    act(() => FakeEventSource.open().emit("state", state([])));
    await flush();
    expect(server.reads()).toBe(4);
    act(() => FakeEventSource.open().emit("state", counts(1, "other", 400)));
    await waitFor(() => expect(server.reads()).toBe(5));
  });

  it("loads another browser's change as soon as the writes under way when it was counted reply", async () => {
    const server = await started("overlapping");
    const first = await server.write();
    // Another browser's change beside the first write: it waits for that write's reply.
    act(() => FakeEventSource.open().emit("state", counts(1, "other")));
    await flush();
    // A second write, and the first write's change counted before its reply.
    const second = await server.write();
    act(() => FakeEventSource.open().emit("state", counts(2, "mine")));
    await flush();
    expect(server.reads()).toBe(1);
    // The first write's reply: change 1 is not its, and the second write does not hold it.
    await first.answer(2);
    await waitFor(() => expect(server.reads()).toBe(2));
    await second.answer(3);
    expect(server.reads()).toBe(2);
  });

  it("loads the app when a count begins again past a number this page made", async () => {
    const server = await started("since");
    act(() => FakeEventSource.open().emit("state", counts(3, "other", 100)));
    await waitFor(() => expect(server.reads()).toBe(2));
    // The page's write is change 4 of a count that began again; the stream then counts to 4.
    await (await server.write()).answer(4);
    act(() => FakeEventSource.open().emit("state", counts(4, "mine", 300)));
    await waitFor(() => expect(server.reads()).toBe(3));
  });

  it("counts a write under way for the session it was sent for only", async () => {
    const server = await started("writer");
    const write = await server.write();
    expect(appWritesUnderWay("safari")).toBe(1);
    setDesktopSession("someone-else");
    expect(appWritesUnderWay("safari")).toBe(0);
    expect(appWritesSettled("safari")).toBeNull();
    setDesktopSession("writer");
    await write.answer(1);
    expect(appWritesUnderWay("safari")).toBe(0);
  });

  it("loads a change it could not place once a reply has not come by the request deadline", async () => {
    const server = await started("no-reply");
    await server.write();
    vi.useFakeTimers();
    act(() => FakeEventSource.open().emit("state", counts(1, "other")));
    await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS - 1);
    expect(server.reads()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.reads()).toBe(2);
  });
});

describe("who sounds for a new message", () => {
  it("is Mail while a window of it is open, and the desktop otherwise and for any other app", () => {
    const root = document.createElement("div");
    expect(soundsItself("mail", root)).toBe(false);
    root.innerHTML = '<div data-window-id="mail"></div>';
    expect(soundsItself("mail", root)).toBe(true);
    expect(soundsItself("messages", root)).toBe(false);
  });
});
