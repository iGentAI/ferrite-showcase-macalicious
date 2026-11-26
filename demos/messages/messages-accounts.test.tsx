import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { Messages } from "./messages";
import {
  bySeq,
  type ConvState,
  isAccountConversation,
  recipientsOf,
  statusOf,
  titleOf,
  toMessage,
  useAccountConversations,
} from "./messages-accounts";
import { type MessagesConversation, splitRecipients } from "./messages-data";

// Conversations between accounts on the desktop served by Ferrite (`messages-accounts.tsx`) and
// the hooks of the Messages window they use. The server is exercised by
// `ferrite-apps/desktop/tests/messages.rs` and the browser journey
// `ferrite-apps/desktop/e2e/messages-journey.mjs`; here the window is given conversations
// directly.

const person = (name: string) => ({ name, full_name: name.toUpperCase() });
const state = (change: Partial<ConvState> = {}): ConvState => ({
  members: [person("chris"), person("martin")],
  messages: [],
  read: {},
  typing: {},
  pages: 0,
  last: 0,
  ...change,
});

describe("account conversations", () => {
  it("tells account conversations from the shared room", () => {
    expect(isAccountConversation(`c-${"a1".repeat(16)}`)).toBe(true);
    expect(isAccountConversation("ferrite-room")).toBe(false);
    expect(isAccountConversation("c-short")).toBe(false);
  });

  it("merges older messages with the newest by number, each once and in order", () => {
    const message = (seq: number, text = `m${seq}`) => ({
      seq,
      author: "martin",
      name: "Martin",
      text,
      at_ms: seq,
    });
    // A page loaded twice, overlapping the document: every number once, the later copy kept.
    const merged = bySeq([message(2), message(1), message(2), message(3), message(2, "tapped")]);
    expect(merged.map((each) => each.seq)).toEqual([1, 2, 3]);
    expect(merged[1]?.text).toBe("tapped");
  });

  it("names a conversation by its group name or the other members", () => {
    expect(titleOf(state(), "chris")).toBe("MARTIN");
    expect(
      titleOf(state({ members: [person("chris"), person("martin"), person("ann")] }), "chris"),
    ).toBe("MARTIN, ANN");
    expect(titleOf(state({ title: "Island trip" }), "chris")).toBe("Island trip");
  });

  it("reads account names as the To field and the contacts write them", () => {
    expect(recipientsOf("martin, Ann Lee (ann), bob@macalicious, ")).toEqual([
      "martin",
      "ann",
      "bob",
    ]);
    expect(recipientsOf("  ")).toEqual([]);
    // A contact whose name holds a comma is offered quoted, and stays one person.
    expect(recipientsOf('"Lee, Ann" (ann), martin')).toEqual(["ann", "martin"]);
    expect(splitRecipients('"Lee, Ann" (ann), Bob <bob@macalicious>, ,')).toEqual([
      '"Lee, Ann" (ann)',
      "Bob <bob@macalicious>",
    ]);
  });

  it("says Read once every other member shows they read, and who in a group", () => {
    expect(statusOf(state(), "chris", 1)).toBe("Delivered");
    expect(statusOf(state({ read: { martin: 1 } }), "chris", 1)).toBe("Read");
    expect(statusOf(state({ read: { martin: 0 } }), "chris", 1)).toBe("Delivered");
    const group = state({
      members: [person("chris"), person("martin"), person("ann")],
      read: { martin: 2 },
    });
    expect(statusOf(group, "chris", 2)).toBe("Read by MARTIN");
  });

  it("shows the writer's name over a group member's messages only", () => {
    const message = { seq: 3, author: "martin", name: "Martin Klein", text: "hi", at_ms: 0 };
    expect(toMessage(message, "chris", true)).toMatchObject({
      id: "c3",
      from: "them",
      sender: "Martin Klein",
    });
    expect(toMessage(message, "chris", false).sender).toBeUndefined();
    expect(toMessage(message, "martin", true)).toMatchObject({ from: "me", sender: undefined });
  });
});

const account: MessagesConversation = {
  id: `c-${"b2".repeat(16)}`,
  name: "Martin Klein",
  unread: true,
  messages: [
    { id: "c1", from: "me", text: "Ferry at 8:40?", at: "2026-10-14T18:00", status: "Read" },
    { id: "c2", from: "them", text: "Yes", at: "2026-10-14T18:01", sender: "Martin Klein" },
  ],
};

describe("the Messages window with conversations its owner holds", () => {
  it("offers Leave this Conversation in a group's Details and shows no conversation once left", async () => {
    const group: MessagesConversation = {
      id: `c-${"f6".repeat(16)}`,
      name: "Island trip",
      messages: [{ id: "c1", from: "them", text: "Sunday?", at: "2019-10-07T15:00" }],
    };
    const pair: MessagesConversation = {
      id: `c-${"a7".repeat(16)}`,
      name: "Martin Klein",
      messages: [{ id: "c1", from: "them", text: "Hi", at: "2019-10-07T14:00" }],
    };
    let answer = false;
    const onLeave = vi.fn(async (_id: string) => answer);
    render(
      <Messages
        defaultConversations={[]}
        extraConversations={[group, pair]}
        defaultConversation={pair.id}
        canLeaveConversation={(id) => id === group.id}
        onLeaveConversation={onLeave}
      />,
    );
    // A conversation of two offers no Leave.
    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Do Not Disturb")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Leave this Conversation" })).toBeNull();
    await userEvent.keyboard("{Escape}");

    const row = within(screen.getByRole("listbox", { name: "Conversations" }))
      .getAllByRole("option")
      .find(
        (option) => option.querySelector(".mac-messages-row-name")?.textContent === "Island trip",
      );
    if (!row) throw new Error("no row named Island trip");
    await userEvent.click(row);
    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    const leave = () => screen.getByRole("button", { name: "Leave this Conversation" });
    // Refused: the conversation stays shown, and Leave can be chosen again.
    await userEvent.click(leave());
    await waitFor(() => expect(onLeave).toHaveBeenCalledWith(group.id));
    await waitFor(() => expect(leave()).toHaveProperty("disabled", false));
    expect(screen.getByRole("log", { name: "Conversation with Island trip" })).toBeTruthy();
    // Left: no conversation is shown.
    answer = true;
    await userEvent.click(leave());
    await waitFor(() => expect(screen.getByText("No Conversation Selected")).toBeTruthy());
    expect(onLeave).toHaveBeenCalledTimes(2);
  });

  it("lists them with an unread dot and shows their status, sender and extras", async () => {
    render(
      <Messages
        defaultConversations={[]}
        extraConversations={[account]}
        defaultConversation={null}
        renderMessageExtras={(id, message) => <span data-testid={`extra-${id}-${message.id}`} />}
        transcriptStart={new Map([[account.id, "Load Earlier Messages"]])}
      />,
    );
    const row = within(screen.getByRole("listbox", { name: "Conversations" }))
      .getAllByRole("option")
      .find(
        (option) => option.querySelector(".mac-messages-row-name")?.textContent === "Martin Klein",
      );
    if (!row) throw new Error("no row named Martin Klein");
    expect(within(row).getByLabelText("Unread")).toBeTruthy();
    await userEvent.click(row);
    const log = screen.getByRole("log");
    expect(within(log).getByText("Read")).toBeTruthy();
    expect(within(log).getAllByText("Martin Klein").length).toBeGreaterThan(0);
    expect(log.querySelector(".mac-messages-sender")?.textContent).toBe("Martin Klein");
    expect(within(log).getByText("Load Earlier Messages")).toBeTruthy();
    expect(screen.getByTestId(`extra-${account.id}-c2`)).toBeTruthy();
  });

  it("reports a message to a held conversation instead of adding it, and typing as it is typed", async () => {
    const onSend = vi.fn();
    const onTyping = vi.fn();
    render(
      <Messages
        defaultConversations={[]}
        extraConversations={[account]}
        defaultConversation={account.id}
        onSend={onSend}
        onTyping={onTyping}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(field, "See you{Enter}");
    expect(onTyping).toHaveBeenCalledWith(account.id);
    expect(onSend).toHaveBeenCalledWith(account.id, expect.objectContaining({ text: "See you" }));
    // The owner had not added it: the transcript still ends with Martin's message.
    expect(within(screen.getByRole("log")).queryByText("See you")).toBeNull();
  });

  it("hands a new conversation's first message to the owner and shows the conversation it answers", async () => {
    let settle: (id: string | null) => void = () => {};
    const onStartConversation = vi.fn(
      (_recipients: string, _message: unknown, _draft: string) =>
        new Promise<string | null>((resolve) => {
          settle = resolve;
        }),
    );
    const { rerender } = render(
      <Messages
        defaultConversations={[]}
        extraConversations={[]}
        onStartConversation={onStartConversation}
        recipientSuggestions={["Martin Klein (martin)", "Ann Lee (ann)"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Compose new message" }));
    const to = screen.getByRole("textbox", { name: "To" });
    await userEvent.type(to, "mar");
    // The contacts that match are offered; choosing one fills it in.
    await userEvent.click(
      within(screen.getByRole("group", { name: "Contacts" })).getByText("Martin Klein (martin)"),
    );
    expect((to as HTMLInputElement).value).toBe("Martin Klein (martin)");
    const field = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(field, "Hello{Enter}");
    expect(onStartConversation).toHaveBeenCalledWith(
      "Martin Klein (martin)",
      expect.objectContaining({ text: "Hello" }),
      expect.any(String),
      [],
    );
    // While the owner starts it, the draft keeps its text, takes no edit and is not sent twice.
    expect((field as HTMLInputElement).value).toBe("Hello");
    expect((field as HTMLInputElement).readOnly).toBe(true);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onStartConversation).toHaveBeenCalledTimes(1);
    // Refused: the new conversation keeps its text, and can be edited and sent again.
    settle(null);
    await waitFor(() => expect((field as HTMLInputElement).readOnly).toBe(false));
    expect((field as HTMLInputElement).value).toBe("Hello");
    await userEvent.type(field, "{Enter}");
    expect(onStartConversation).toHaveBeenCalledTimes(2);
    rerender(
      <Messages
        defaultConversations={[]}
        extraConversations={[account]}
        onStartConversation={onStartConversation}
      />,
    );
    settle(account.id);
    await waitFor(() =>
      expect(screen.getByRole("log", { name: "Conversation with Martin Klein" })).toBeTruthy(),
    );
    expect(screen.queryByRole("option", { name: "New Message" })).toBeNull();
  });
});

describe("the person's conversations, read from the server", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves a group through the server, and keeps it with the refusal when the server says no", async () => {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    const group = {
      id: `c-${"d4".repeat(16)}`,
      title: "Island trip",
      members: [person("chris"), person("martin"), person("ann")],
      last: null,
      unread: 0,
      at_ms: 2,
    };
    const direct = {
      id: `c-${"e5".repeat(16)}`,
      members: [person("chris"), person("martin")],
      last: null,
      unread: 0,
      at_ms: 1,
    };
    let leaveStatus = 409;
    let left = false;
    const leaves: string[] = [];
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://desktop.test").pathname;
      if (path === "/api/messages/conversations") {
        return Promise.resolve(json({ conversations: left ? [direct] : [group, direct] }));
      }
      if (path.endsWith("/leave")) {
        leaves.push(`${init?.method} ${path}`);
        if (leaveStatus === 200) left = true;
        return Promise.resolve(
          leaveStatus === 200
            ? json({ left: true })
            : json({ error: "Leaving is not possible now." }, leaveStatus),
        );
      }
      if (path === "/api/messages/me") return Promise.resolve(json({ name: "chris" }));
      return Promise.resolve(json({ people: [] }));
    });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAccountConversations(true, true));
    await waitFor(() =>
      expect(result.current.props.extraConversations?.map((each) => each.id)).toEqual([
        group.id,
        direct.id,
      ]),
    );
    // Only a group can be left.
    expect(result.current.props.canLeaveConversation?.(group.id)).toBe(true);
    expect(result.current.props.canLeaveConversation?.(direct.id)).toBe(false);
    expect(result.current.props.canLeaveConversation?.("ferrite-room")).toBe(false);
    const leave = async (id: string) => {
      const command = result.current.props.onLeaveConversation;
      if (!command) throw new Error("no Leave command");
      let answer: boolean | undefined;
      await act(async () => {
        answer = await command(id);
      });
      return answer;
    };
    expect(await leave(direct.id)).toBe(false);
    expect(leaves).toEqual([]);

    // Refused: the group stays, and the refusal shows under it.
    expect(await leave(group.id)).toBe(false);
    expect(leaves).toEqual([`POST /api/messages/conversations/${group.id}/leave`]);
    expect(result.current.props.extraConversations?.map((each) => each.id)).toContain(group.id);
    const notice = render(<div>{result.current.notices.get(group.id)}</div>);
    expect(within(notice.container).getByRole("alert").textContent).toBe(
      "Leaving is not possible now.",
    );
    notice.unmount();

    // Left: it goes from the list, and the refusal with it.
    leaveStatus = 200;
    expect(await leave(group.id)).toBe(true);
    await waitFor(() =>
      expect(result.current.props.extraConversations?.map((each) => each.id)).toEqual([direct.id]),
    );
    expect(result.current.notices.has(group.id)).toBe(false);
  });

  it("reads the list once at a time: a refresh while a read runs is skipped, not restarted", async () => {
    const lists: ((response: Response) => void)[] = [];
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://desktop.test").pathname;
      if (path === "/api/messages/conversations") {
        return new Promise<Response>((resolve) => lists.push(resolve));
      }
      if (path === "/api/messages/me") return Promise.resolve(json({ name: "chris" }));
      return Promise.resolve(json({ people: [] }));
    });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAccountConversations(true, true));
    await waitFor(() => expect(lists).toHaveLength(1));
    // Focus while the first read is unanswered: nothing new is asked, and nothing is cancelled.
    fireEvent.focus(window);
    fireEvent.focus(window);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(lists).toHaveLength(1);
    const summary = {
      id: `c-${"c3".repeat(16)}`,
      members: [person("chris"), person("martin")],
      last: null,
      unread: 0,
      at_ms: 1,
    };
    lists[0]?.(json({ conversations: [summary] }));
    await waitFor(() =>
      expect(result.current.props.extraConversations?.map((each) => each.id)).toEqual([summary.id]),
    );
    // Once it is answered, the next refresh reads again.
    fireEvent.focus(window);
    await waitFor(() => expect(lists).toHaveLength(2));
  });

  it("reads a conversation once at a time, also when it is left and opened again, and on a change", async () => {
    const id = `c-${"d4".repeat(16)}`;
    const reads: ((response: Response) => void)[] = [];
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    const conversation = (text: string, last: number) => ({
      version: last,
      state: state({
        id,
        last,
        messages: [{ seq: last, author: "martin", name: "MARTIN", text, at_ms: 1 }],
      }),
    });
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://desktop.test").pathname;
      if (path === `/api/messages/conversations/${id}`) {
        return new Promise<Response>((resolve) => reads.push(resolve));
      }
      if (path === "/api/messages/me") return Promise.resolve(json({ name: "chris" }));
      if (path === "/api/messages/conversations") {
        return Promise.resolve(json({ conversations: [] }));
      }
      return Promise.resolve(json({ people: [] }));
    });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAccountConversations(true, true));
    act(() => result.current.onConversationChange(id));
    await waitFor(() => expect(reads).toHaveLength(1));
    // Away and back, and changes heard, while the first read is unanswered: no second read
    // starts beside it, so no older answer can land after a newer one.
    act(() => result.current.onConversationChange(null));
    act(() => result.current.onConversationChange(id));
    window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "messages" } }));
    window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "messages" } }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reads).toHaveLength(1);
    // Answered: the change heard meanwhile, which that answer may predate, is read once after it.
    reads[0]?.(json(conversation("first", 1)));
    await waitFor(() => expect(reads).toHaveLength(2));
    reads[1]?.(json(conversation("second", 2)));
    await waitFor(() =>
      expect(result.current.held.get(id)?.map((m) => m.text)).toEqual(["second"]),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reads).toHaveLength(2);
    // Another app's change reads nothing; a change of Messages reads it again.
    window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "notes" } }));
    window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "messages" } }));
    await waitFor(() => expect(reads).toHaveLength(3));
  });

  it("reads the list for a burst of changes once, and not again within a few seconds", async () => {
    let lists = 0;
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://desktop.test").pathname;
      if (path === "/api/messages/conversations") {
        lists += 1;
        return Promise.resolve(json({ conversations: [] }));
      }
      if (path === "/api/messages/me") return Promise.resolve(json({ name: "chris" }));
      return Promise.resolve(json({ people: [] }));
    });
    vi.stubGlobal("fetch", fetch);
    renderHook(() => useAccountConversations(true, true));
    await waitFor(() => expect(lists).toBe(1));
    const change = () =>
      window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app: "messages" } }));
    // Typing, a read receipt and a message heard together: one read of the list.
    change();
    change();
    change();
    await waitFor(() => expect(lists).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lists).toBe(2);
    // Another change soon after waits for its turn rather than read the list again at once,
    // and is read when it comes: the last change of a burst is never left unread.
    change();
    change();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(lists).toBe(2);
    await waitFor(() => expect(lists).toBe(3), { timeout: 7_000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lists).toBe(3);
  }, 15_000);

  it("keeps a conversation's start key while an answer cannot be read, and shows sends before it loads", async () => {
    const id = `c-${"e5".repeat(16)}`;
    const other = `c-${"f6".repeat(16)}`;
    const keys: (string | null)[] = [];
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://desktop.test").pathname;
      if (path === "/api/messages/conversations" && init?.method === "POST") {
        keys.push(new Headers(init.headers).get("idempotency-key"));
        // The first answer is a 201 whose body cannot be read; the second names the conversation.
        return Promise.resolve(
          keys.length === 1
            ? new Response("not json", { status: 201 })
            : json({ version: 1, state: state({ id }) }, 200),
        );
      }
      if (path === `/api/messages/conversations/${other}/messages`) {
        return Promise.resolve(json({ error: "refused" }, 400));
      }
      // The other conversation's transcript never arrives.
      if (path === `/api/messages/conversations/${other}`) return new Promise<Response>(() => {});
      if (path === "/api/messages/me") return Promise.resolve(json({ name: "chris" }));
      if (path === "/api/messages/conversations") {
        const last = { seq: 1, author: "martin", name: "MARTIN", text: "Earlier", at_ms: 1 };
        return Promise.resolve(
          json({
            conversations: [
              {
                id: other,
                members: [person("chris"), person("martin")],
                last,
                unread: 0,
                at_ms: 1,
              },
            ],
          }),
        );
      }
      return Promise.resolve(json({ people: [] }));
    });
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAccountConversations(true, true));
    const start = result.current.props.onStartConversation;
    if (!start) throw new Error("no start");
    const message = { id: "m1", from: "me" as const, text: "Hi", at: "" };
    expect(await start("martin", message, "draft-1")).toBeNull();
    expect(await start("martin", message, "draft-1")).toBe(id);
    expect(keys[1]).toBe(keys[0]);
    // A listed conversation opened before its transcript has loaded: a message sent to it shows
    // after the list's last one, and so does its failure, with Try Again.
    await waitFor(() =>
      expect(result.current.props.extraConversations?.map((each) => each.id)).toContain(other),
    );
    result.current.onConversationChange(other);
    await waitFor(() => expect(result.current.held.has(other)).toBe(false));
    result.current.send(other, { id: "m2", from: "me", text: "Still there?", at: "" });
    await waitFor(() =>
      expect(result.current.held.get(other)?.map((m) => [m.text, m.undelivered])).toEqual([
        ["Earlier", undefined],
        ["Still there?", true],
      ]),
    );
  });
});
