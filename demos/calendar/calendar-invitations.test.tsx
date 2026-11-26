import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";
import { CAPTURE_NOW } from "./calendar-data";
import { inboxFromServer, sentFromServer, sentPending } from "./calendar-invitations";
import { webLink } from "./calendar-invitees";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ID = "0123456789abcdef0123456789abcdef";
const LUNCH = {
  id: "lunch",
  title: "Lunch",
  start: new Date(2019, 9, 2, 12).getTime(),
  end: new Date(2019, 9, 2, 13).getTime(),
  calendar: "work",
  invitees: ["anna"],
};
const REVIEW = {
  id: ID,
  version: 3,
  organizer: { name: "martin", full_name: "Martin Kay" },
  event: {
    title: "Design Review",
    start: new Date(2019, 9, 1, 15).getTime(),
    end: new Date(2019, 9, 1, 16).getTime(),
    location: "Room 4",
  },
  status: "pending",
  invitees: [
    { name: "chris", full_name: "Chris Carter", status: "pending" },
    { name: "anna", full_name: "Anna Berg", status: "accepted" },
  ],
};

const reply = (status: number, body: unknown) => ({
  ok: status < 300,
  status,
  headers: new Headers(),
  json: async () => body,
});

/**
 * The Ferrite desktop for Chris: his document, his inbox, his invitations' answers. With `moved`,
 * the event's time changed after Chris read it: an answer to version 3 is refused once.
 */
function serve(
  inbox: unknown = { invitations: [REVIEW], can_invite: true, me: "chris" },
  { moved = false } = {},
) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  // Chris's answer, as the server keeps it, and the version his inbox shows.
  let status = "pending";
  let version = 3;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url === "/api/calendar/events" && method === "PUT") {
      return reply(200, { ...JSON.parse(String(init?.body)), rev: 2 });
    }
    if (url === "/api/calendar/events") return reply(200, { events: [LUNCH], rev: 1 });
    if (url === "/api/calendar/inbox") {
      const held = inbox as { invitations: (typeof REVIEW)[] };
      return reply(200, {
        ...held,
        invitations: held.invitations.map((each) => ({ ...each, status, version })),
      });
    }
    if (url === "/api/calendar/sent") {
      return reply(200, {
        events: { lunch: [{ name: "anna", full_name: "Anna Berg", status: "accepted" }] },
      });
    }
    if (url === `/api/calendar/inbox/${ID}/${version}/accept`) {
      if (moved) {
        moved = false;
        version = 4;
        return reply(409, { error: "The event changed since.", version });
      }
      status = "accepted";
      return reply(200, { ...REVIEW, status, version });
    }
    if (url === "/api/calendar/people/ben")
      return reply(200, { name: "ben", full_name: "Ben Cole" });
    if (url.startsWith("/api/calendar/people/")) {
      return reply(404, { error: "No one has that name." });
    }
    return reply(404, { error: "not found" });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const calls = (fetch: ReturnType<typeof serve>, method: string, url: string) =>
  fetch.mock.calls.filter(([to, init]) => to === url && (init?.method ?? "GET") === method);
const event = (name: RegExp) => screen.queryByRole("button", { name });
const settled = () =>
  waitFor(() => expect(document.querySelector(".mac-calendar-body")).not.toHaveAttribute("inert"));

describe("reading the server's invitations", () => {
  it("reads the answers and the inbox, and leaves out what is not one", () => {
    expect(
      sentFromServer({ events: { a: [{ name: "x", full_name: "X", status: "declined" }] } }),
    ).toEqual({ a: [{ name: "x", fullName: "X", status: "declined" }] });
    expect(sentFromServer({ events: { a: [{ name: "x", status: "maybe" }] } })).toBeNull();
    expect(sentFromServer([])).toBeNull();
    expect(sentPending({ events: {}, pending: true })).toBe(true);
    expect(sentPending({ events: {} })).toBe(false);
    const inbox = inboxFromServer({
      invitations: [REVIEW, { ...REVIEW, id: "../../x" }, { ...REVIEW, event: { title: 1 } }],
      can_invite: true,
      me: "chris",
    });
    expect(inbox?.invitations.map((each) => each.id)).toEqual([ID]);
    expect(inbox?.invitations[0]?.event).toEqual({
      id: `invitation-${ID}`,
      title: "Design Review",
      start: new Date(REVIEW.event.start),
      end: new Date(REVIEW.event.end),
      location: "Room 4",
      calendar: "invitations",
    });
    expect(inbox?.canInvite).toBe(true);
    expect(inbox?.me).toBe("chris");
    expect(inboxFromServer({ invitations: "none" })).toBeNull();
    // An invitation without the version an answer names is not one.
    const { version: _, ...unversioned } = REVIEW;
    expect(inboxFromServer({ invitations: [unversioned] })?.invitations).toEqual([]);
  });

  it("leaves out an inbox entry with no event, and keeps the rest", () => {
    expect(
      inboxFromServer({
        invitations: [
          { id: "a".repeat(32), version: 1, status: "pending", invitees: [], event: null },
        ],
      })?.invitations,
    ).toEqual([]);
  });

  it("offers only web addresses another account wrote as links", () => {
    expect(webLink("https://example.com/a")).toBe("https://example.com/a");
    expect(webLink("http://example.com")).toBe("http://example.com");
    expect(webLink("javascript:alert(1)")).toBeUndefined();
    expect(webLink("data:text/html,hi")).toBeUndefined();
    expect(webLink("not a url")).toBeUndefined();
    expect(webLink(undefined)).toBeUndefined();
  });
});

describe("invitations in the Calendar window", () => {
  it("shows an invitation in the Invitations calendar and answers it from its popover", async () => {
    const user = userEvent.setup();
    const fetch = serve();
    render(<Calendar now={CAPTURE_NOW} />);
    await settled();
    const list = screen.getByRole("tree", { name: "Calendars" });
    await waitFor(() =>
      expect(within(list).getByRole("treeitem", { name: /Invitations/ })).toBeVisible(),
    );
    await user.dblClick(
      (await screen.findByRole("button", { name: /^Design Review, / })) as HTMLElement,
    );
    const popover = await screen.findByRole("dialog", { name: "Design Review" });
    expect(within(popover).getByText("Organizer: Martin Kay")).toBeVisible();
    expect(within(popover).getByText("Anna Berg")).toBeVisible();
    await user.click(within(popover).getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(calls(fetch, "POST", `/api/calendar/inbox/${ID}/3/accept`)).toHaveLength(1),
    );
    await waitFor(() =>
      expect(within(popover).getByRole("button", { name: "Accept" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    // An invitation is never saved in the person's own document, nor deleted with Delete.
    await user.keyboard("{Escape}");
    await user.click(event(/^Design Review, /) as HTMLElement);
    await user.keyboard("{Delete}");
    expect(event(/^Design Review, /)).toBeInTheDocument();
    for (const [, init] of calls(fetch, "PUT", "/api/calendar/events")) {
      expect(String(init?.body)).not.toContain("Design Review");
    }
  });

  it("refuses an answer to a version the organizer has since moved, and shows it again", async () => {
    const user = userEvent.setup();
    const fetch = serve(undefined, { moved: true });
    render(<Calendar now={CAPTURE_NOW} />);
    await settled();
    await user.dblClick(
      (await screen.findByRole("button", { name: /^Design Review, / })) as HTMLElement,
    );
    const popover = await screen.findByRole("dialog", { name: "Design Review" });
    await user.click(within(popover).getByRole("button", { name: "Accept" }));
    expect(await within(popover).findByRole("alert")).toHaveTextContent(
      "The event changed since you looked.",
    );
    // The inbox is read again, with the new version, which the next answer names.
    await waitFor(() =>
      expect(calls(fetch, "GET", "/api/calendar/inbox").length).toBeGreaterThan(1),
    );
    await user.click(within(popover).getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(calls(fetch, "POST", `/api/calendar/inbox/${ID}/4/accept`)).toHaveLength(1),
    );
  });

  it("invites an account by its name from the event's popover, with each one's answer", async () => {
    const user = userEvent.setup();
    const fetch = serve();
    render(<Calendar now={CAPTURE_NOW} />);
    await settled();
    await user.dblClick((await screen.findByRole("button", { name: /^Lunch, / })) as HTMLElement);
    const popover = await screen.findByRole("dialog", { name: "Lunch" });
    const row = await within(popover).findByRole("button", { name: "Invitees" });
    await waitFor(() => expect(row).toHaveTextContent("Anna BergAccepted"));
    await user.click(row);
    const field = within(popover).getByRole("textbox", { name: "Invitee" });
    for (const [name, message] of [
      ["zed", "No one on this desktop has the account name “zed”."],
      ["chris", "You organize this event: invite someone else."],
      ["Anna", "“anna” is invited already."],
    ]) {
      await user.clear(field);
      await user.type(field, `${name}{Enter}`);
      expect(await within(popover).findByRole("alert")).toHaveTextContent(message as string);
    }
    await user.clear(field);
    await user.type(field, "ben{Enter}");
    await waitFor(() => {
      const [, init] = calls(fetch, "PUT", "/api/calendar/events").at(-1) ?? [];
      expect(JSON.parse(String(init?.body)).events[0].invitees).toEqual(["anna", "ben"]);
    });
    expect(within(popover).getByText("Ben Cole")).toBeVisible();
    await user.click(within(popover).getByRole("button", { name: "Remove Anna Berg" }));
    await waitFor(() => {
      const [, init] = calls(fetch, "PUT", "/api/calendar/events").at(-1) ?? [];
      expect(JSON.parse(String(init?.body)).events[0].invitees).toEqual(["ben"]);
    });
  });

  it("offers no invitations to a browser nobody signed in to, nor off the desktop", async () => {
    const user = userEvent.setup();
    serve({ invitations: [], can_invite: false, me: null });
    const { unmount } = render(<Calendar now={CAPTURE_NOW} />);
    await settled();
    await user.dblClick((await screen.findByRole("button", { name: /^Lunch, / })) as HTMLElement);
    const popover = await screen.findByRole("dialog", { name: "Lunch" });
    expect(within(popover).getByText("Add Invitees")).not.toHaveAttribute("role");
    expect(screen.queryByRole("treeitem", { name: /Invitations/ })).not.toBeInTheDocument();
    unmount();
    vi.unstubAllEnvs();
    render(<Calendar now={CAPTURE_NOW} defaultSelectedEvent="screenshots" defaultPopoverOpen />);
    const captured = await screen.findByRole("dialog", { name: "Make Catalina Screenshots" });
    expect(within(captured).getByText("Add Invitees")).not.toHaveAttribute("role");
  });
});
