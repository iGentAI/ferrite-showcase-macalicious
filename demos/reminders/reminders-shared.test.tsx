import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reminderOfOpenItem, replayed, sharedListOf } from "./reminders-shared";

/*
 * Lists shared between accounts, on a desktop served by the Ferrite application: a stub of its
 * Reminders routes stands for the server. Each test loads the modules afresh, since the page's
 * copies of the documents live as long as the page.
 */

const TRIP = "sh-0123456789abcdef01234567";
const ANNA = { name: "anna", full_name: "Anna Berg" };
const CHRIS = { name: "chris", full_name: "Chris Carter" };

const trip = (owned: boolean, reminders: unknown[]) => ({
  id: TRIP,
  rev: 4,
  name: "Trip",
  color: "purple",
  owner: owned ? CHRIS : ANNA,
  members: owned ? [ANNA] : [CHRIS],
  owned,
  reminders,
});

const PASSPORT = { id: "passport", listId: TRIP, title: "Passport" };
const OWN = {
  lists: [
    { id: "groceries", name: "Groceries", color: "green" },
    { id: "work", name: "Work", color: "blue" },
  ],
  // The same id as a reminder of the shared list: each list's ids are its own.
  reminders: [{ id: "passport", listId: "groceries", title: "Milk" }],
};

interface Served {
  own: typeof OWN;
  shared: ReturnType<typeof trip>[];
}

type Put = (body: { base: number; data: { reminders: unknown[] } }) => Response | undefined;

/**
 * The Reminders routes for Chris, from `served`, which a test may change between reads. `put`,
 * when it answers, answers a save of the shared list in place of the stored one.
 */
function serve(served: Served, put?: Put, beforeRead?: () => Promise<void> | undefined) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url === "/api/reminders/data" && method === "GET") {
      return json(200, { data: served.own, rev: 1 });
    }
    if (url === "/api/reminders/data") return json(200, { rev: 2 });
    if (url === "/api/reminders/alerts") return json(200, { alerts: [] });
    if (url === "/api/reminders/shared" && method === "GET") {
      await beforeRead?.();
      return json(200, { lists: served.shared, can_share: true, me: "chris" });
    }
    if (url === "/api/reminders/shared" && method === "POST") {
      // The list moves out of Chris's own lists into a shared one.
      served.own = {
        lists: served.own.lists.filter((list) => list.id !== body.list),
        reminders: served.own.reminders.filter((each) => each.listId !== body.list),
      };
      served.shared = [trip(true, [])];
      return json(201, { id: TRIP, rev: 2 });
    }
    if (url === `/api/reminders/shared/${TRIP}` && method === "PUT") {
      const answered = put?.(body);
      if (answered) return answered;
      const [first] = served.shared;
      if (first) served.shared = [{ ...first, rev: first.rev + 1, reminders: body.data.reminders }];
      return json(200, { rev: (first?.rev ?? 0) + 1 });
    }
    if (url === `/api/reminders/shared/${TRIP}/leave`) {
      served.shared = [];
      return json(200, { left: true });
    }
    return json(404, { error: "not found" });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const calls = (fetch: ReturnType<typeof serve>, method: string, url: string) =>
  fetch.mock.calls.filter(([to, init]) => to === url && (init?.method ?? "GET") === method);
const bodyOf = (call: unknown[] | undefined) =>
  JSON.parse(String((call?.[1] as RequestInit | undefined)?.body));
const titles = () =>
  screen
    .queryAllByRole("option")
    .map((row) => row.querySelector(".mac-reminders-text")?.textContent ?? "");
const sidebarRow = (name: string) => {
  const found = screen.getAllByRole("treeitem").find((item) => item.textContent?.startsWith(name));
  if (!found) throw new Error(`no list ${name}`);
  return found;
};

describe("the item a request to open Reminders names", () => {
  it("is the shared list of a notification, the reminder of an alert, or the id itself", () => {
    expect(reminderOfOpenItem(`share-${TRIP}`)).toBe(TRIP);
    expect(reminderOfOpenItem(`share-${TRIP}-4`)).toBe(TRIP);
    expect(reminderOfOpenItem(`left-${TRIP}-4`)).toBe(TRIP);
    expect(reminderOfOpenItem(`unshare-${TRIP}-4`)).toBeNull();
    expect(reminderOfOpenItem("alert:rent@1700000000000")).toBe("rent");
    expect(reminderOfOpenItem("rent")).toBe("rent");
  });

  it("opens the shared list a notification tells of", async () => {
    await open({ own: OWN, shared: [trip(false, [PASSPORT])] });
    await waitFor(() => expect(sidebarRow("Trip")).toBeVisible());
    const { openItem } = await import("../desktop/desktop-open-item");
    act(() => openItem({ app: "reminders", id: `left-${TRIP}-5`, title: "Trip" }));
    await waitFor(() => expect(titles()).toEqual(["Passport"]));
    expect(sidebarRow("Trip")).toHaveAttribute("aria-selected", "true");
  });
});

async function open(served: Served, put?: Put, beforeRead?: () => Promise<void> | undefined) {
  vi.resetModules();
  const fetch = serve(served, put, beforeRead);
  const { Reminders } = await import("./reminders");
  render(<Reminders defaultSource="groceries" today="2019-10-02" />);
  await waitFor(() => expect(titles()).toEqual(["Milk"]));
  return fetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("a shared list as the server sends it", () => {
  it("is read whole, or not at all", () => {
    expect(sharedListOf(trip(false, [PASSPORT]))).toEqual({
      id: TRIP,
      rev: 4,
      name: "Trip",
      color: "purple",
      owner: { name: "anna", fullName: "Anna Berg" },
      members: [{ name: "chris", fullName: "Chris Carter" }],
      owned: false,
      reminders: [PASSPORT],
    });
    expect(sharedListOf({ ...trip(false, []), id: "groceries" })).toBeNull();
    expect(sharedListOf({ ...trip(false, []), color: "plaid" })).toBeNull();
    expect(sharedListOf({ ...trip(false, []), owner: { name: "anna" } })).toBeNull();
    // A reminder of another list, or one id used twice, is no shared list's.
    expect(sharedListOf(trip(false, [{ ...PASSPORT, listId: "groceries" }]))).toBeNull();
    expect(sharedListOf(trip(false, [PASSPORT, PASSPORT]))).toBeNull();
  });
});

describe("a refused save made again", () => {
  it("replays the person's changes, reminder by reminder, over the list as it now is", () => {
    const milk = { id: "milk", listId: TRIP, title: "Milk" };
    const visa = { id: "visa", listId: TRIP, title: "Visa" };
    const base = [PASSPORT, milk];
    // Here: Passport completed, Milk removed, Tickets added. There: Visa added, Milk renamed.
    const mine = [
      { ...PASSPORT, completed: true },
      { id: "tickets", listId: TRIP, title: "Tickets" },
    ];
    const theirs = [PASSPORT, { ...milk, title: "Oat milk" }, visa];
    expect(replayed(base, mine, theirs)).toEqual([
      { ...PASSPORT, completed: true },
      visa,
      { id: "tickets", listId: TRIP, title: "Tickets" },
    ]);
    // Nothing changed here: theirs as it is.
    expect(replayed(base, base, theirs)).toEqual(theirs);
  });
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const toggle = (title: string) =>
  screen
    .getAllByRole("option")
    .find((row) => row.textContent?.includes(title))
    ?.querySelector("[data-reminder-toggle]") as HTMLElement;

describe("shared lists in the Reminders window", () => {
  it("lists a shared list under Shared and saves a change to it as that list's", async () => {
    const user = userEvent.setup();
    const fetch = await open({ own: OWN, shared: [trip(false, [PASSPORT])] });
    await waitFor(() => expect(sidebarRow("Trip")).toHaveTextContent("Anna Berg"));
    expect(screen.getByText("Shared")).toBeVisible();
    await user.click(sidebarRow("Trip"));
    expect(titles()).toEqual(["Passport"]);
    await user.click(
      screen.getAllByRole("option")[0]?.querySelector("[data-reminder-toggle]") as HTMLElement,
    );
    await waitFor(() =>
      expect(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)).toHaveLength(1),
    );
    const sent = bodyOf(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)[0]);
    expect(sent).toEqual({
      base: 4,
      data: {
        lists: [{ id: TRIP, name: "Trip", color: "purple" }],
        reminders: [{ ...PASSPORT, completed: true }],
      },
    });
    // The person's own document is not saved for a change to a shared list.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(calls(fetch, "PUT", "/api/reminders/data")).toHaveLength(0);
  });

  it("shares one of the person's own lists by account name", async () => {
    const user = userEvent.setup();
    const fetch = await open({ own: OWN, shared: [] });
    fireEvent.contextMenu(sidebarRow("Groceries"), { clientX: 10, clientY: 10 });
    await user.click(await screen.findByRole("menuitem", { name: "Share List…" }));
    const popover = await screen.findByRole("dialog");
    await user.type(within(popover).getByRole("textbox"), "anna");
    await user.click(within(popover).getByRole("button", { name: "Share" }));
    await waitFor(() => expect(calls(fetch, "POST", "/api/reminders/shared")).toHaveLength(1));
    expect(bodyOf(calls(fetch, "POST", "/api/reminders/shared")[0])).toEqual({
      list: "groceries",
      people: ["anna"],
    });
    // The list is read again as a shared one, and is no longer among the person's own.
    await waitFor(() => expect(sidebarRow("Trip")).toHaveTextContent("Shared by Me"));
    expect(
      screen.queryAllByRole("treeitem").some((item) => item.textContent?.startsWith("Groceries")),
    ).toBe(false);
  });

  it("adds a reminder to a shared list under an id of its own, and lets the person leave", async () => {
    const user = userEvent.setup();
    const fetch = await open({ own: OWN, shared: [trip(false, [])] });
    await waitFor(() => expect(sidebarRow("Trip")).toBeVisible());
    await user.click(sidebarRow("Trip"));
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Tickets{Enter}");
    await waitFor(() =>
      expect(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)).toHaveLength(1),
    );
    const [added] = bodyOf(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)[0]).data.reminders;
    expect(added).toMatchObject({ listId: TRIP, title: "Tickets" });
    expect(added.id).not.toContain("/");

    fireEvent.contextMenu(sidebarRow("Trip"), { clientX: 10, clientY: 10 });
    await user.click(await screen.findByRole("menuitem", { name: "Show People…" }));
    const popover = await screen.findByRole("dialog");
    expect(within(popover).getByText("Anna Berg")).toBeVisible();
    // Only the owner adds people.
    expect(within(popover).queryByRole("textbox")).toBeNull();
    await user.click(within(popover).getByRole("button", { name: "Leave this list" }));
    await waitFor(() =>
      expect(calls(fetch, "POST", `/api/reminders/shared/${TRIP}/leave`)).toHaveLength(1),
    );
    await waitFor(() =>
      expect(
        screen.queryAllByRole("treeitem").some((item) => item.textContent?.startsWith("Trip")),
      ).toBe(false),
    );
  });

  it("makes a save that someone else's got in before again, on the list as it now is", async () => {
    const user = userEvent.setup();
    const served: Served = { own: OWN, shared: [trip(false, [PASSPORT])] };
    const visa = { id: "visa", listId: TRIP, title: "Visa" };
    let refused = false;
    const fetch = await open(served, (body) => {
      if (refused) return undefined;
      // Anna saved first: the list now has Visa too, at revision 5.
      refused = true;
      served.shared = [{ ...trip(false, [PASSPORT, visa]), rev: 5 }];
      expect(body.base).toBe(4);
      return json(409, { error: "the list has changed since that revision", rev: 5 });
    });
    await waitFor(() => expect(sidebarRow("Trip")).toBeVisible());
    await user.click(sidebarRow("Trip"));
    await user.click(toggle("Passport"));
    await waitFor(() =>
      expect(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)).toHaveLength(2),
    );
    const again = bodyOf(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)[1]);
    expect(again.base).toBe(5);
    expect(again.data.reminders).toEqual([{ ...PASSPORT, completed: true }, visa]);
    // The window shows Anna's reminder beside the change.
    await waitFor(() => expect(titles()).toContain("Visa"));
  });

  it("keeps a change the application refuses, and sends the next one on it", async () => {
    const user = userEvent.setup();
    const served: Served = { own: OWN, shared: [trip(false, [PASSPORT])] };
    let refuse = true;
    const fetch = await open(served, () => {
      if (!refuse) return undefined;
      refuse = false;
      return json(400, { error: "a reminder's notes are too long" });
    });
    await waitFor(() => expect(sidebarRow("Trip")).toBeVisible());
    await user.click(sidebarRow("Trip"));
    const reads = calls(fetch, "GET", "/api/reminders/shared").length;
    await user.click(toggle("Passport"));
    await waitFor(() =>
      expect(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)).toHaveLength(1),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Not thrown away for the stored list: the change stays, and the lists are not read again.
    expect(calls(fetch, "GET", "/api/reminders/shared")).toHaveLength(reads);
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Tickets{Enter}");
    // The next save carries the change kept from the refused one, on the same revision.
    const puts = () => calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`);
    await waitFor(() =>
      expect(
        puts().some((call) =>
          bodyOf(call).data.reminders.some((each: { title: string }) => each.title === "Tickets"),
        ),
      ).toBe(true),
    );
    const next = bodyOf(puts()[1]);
    expect(next.base).toBe(4);
    expect(next.data.reminders[0]).toEqual({ ...PASSPORT, completed: true });
  });

  it("sends a change made during a save once that save is answered, on its revision", async () => {
    const user = userEvent.setup();
    const served: Served = { own: OWN, shared: [trip(false, [PASSPORT])] };
    let release: (() => void) | undefined;
    let first = true;
    const fetch = await open(served, (body) => {
      if (!first) return undefined;
      first = false;
      // The first save is answered only when the test says so.
      return new Promise<Response>((resolve) => {
        release = () => {
          served.shared = [{ ...trip(false, body.data.reminders), rev: 5 }];
          resolve(json(200, { rev: 5 }));
        };
      }) as unknown as Response;
    });
    await waitFor(() => expect(sidebarRow("Trip")).toBeVisible());
    await user.click(sidebarRow("Trip"));
    await user.click(toggle("Passport"));
    await waitFor(() => expect(release).toBeDefined());
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Tickets{Enter}");
    await new Promise((resolve) => setTimeout(resolve, 100));
    // One save at a time.
    expect(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)).toHaveLength(1);
    release?.();
    await waitFor(() =>
      expect(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)).toHaveLength(2),
    );
    const next = bodyOf(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)[1]);
    expect(next.base).toBe(5);
    expect(next.data.reminders.map((each: { title: string }) => each.title)).toEqual([
      "Passport",
      "Tickets",
    ]);
  });

  it("takes in another member's change without losing a reminder being typed", async () => {
    const user = userEvent.setup();
    const served: Served = { own: OWN, shared: [trip(false, [PASSPORT])] };
    await open(served);
    await waitFor(() => expect(sidebarRow("Trip")).toBeVisible());
    await user.click(sidebarRow("Trip"));
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Tick");
    // Anna adds Visa, and the page hears of it.
    served.shared = [
      { ...trip(false, [PASSPORT, { id: "visa", listId: TRIP, title: "Visa" }]), rev: 5 },
    ];
    window.dispatchEvent(
      new CustomEvent("macalicious:server-change", { detail: { app: "reminders" } }),
    );
    await waitFor(() => expect(titles()).toContain("Visa"));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Tick");
  });

  it("replays a change made while a refused save's list is read again, with the first", async () => {
    const user = userEvent.setup();
    const served: Served = { own: OWN, shared: [trip(false, [PASSPORT])] };
    const visa = { id: "visa", listId: TRIP, title: "Visa" };
    let refused = false;
    let hold: Promise<void> | undefined;
    let release: (() => void) | undefined;
    const fetch = await open(
      served,
      () => {
        if (refused) return undefined;
        refused = true;
        served.shared = [{ ...trip(false, [PASSPORT, visa]), rev: 5 }];
        // The read that follows the refusal is answered only when the test says so.
        hold = new Promise((resolve) => {
          release = resolve;
        });
        return json(409, { error: "the list has changed since that revision", rev: 5 });
      },
      () => hold,
    );
    await waitFor(() => expect(sidebarRow("Trip")).toBeVisible());
    await user.click(sidebarRow("Trip"));
    await user.click(toggle("Passport"));
    await waitFor(() => expect(release).toBeDefined());
    // While the list is read again, another change: a new reminder.
    await user.click(screen.getByRole("button", { name: "New Reminder" }));
    await user.keyboard("Tickets{Enter}");
    await new Promise((resolve) => setTimeout(resolve, 50));
    release?.();
    await waitFor(() =>
      expect(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)).toHaveLength(2),
    );
    const again = bodyOf(calls(fetch, "PUT", `/api/reminders/shared/${TRIP}`)[1]);
    expect(again.base).toBe(5);
    const titles = again.data.reminders.map((each: { title: string }) => each.title);
    expect(titles).toEqual(["Passport", "Visa", "Tickets"]);
    expect(again.data.reminders[0]).toEqual({ ...PASSPORT, completed: true });
  });
});
