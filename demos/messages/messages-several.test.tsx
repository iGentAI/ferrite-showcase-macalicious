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
import { Messages } from "./messages";
import { useAccountConversations } from "./messages-accounts";
import type { MessagesConversation } from "./messages-data";
import { readConversationReceipts, readMessagesView } from "./messages-saved";

const word = (id: string, text: string) => ({
  id,
  from: "them" as const,
  text,
  at: "2019-10-07T15:00",
});
const THREE: MessagesConversation[] = [
  { id: "a", name: "Ada", messages: [word("a1", "from ada")] },
  { id: "b", name: "Bea", messages: [word("b1", "from bea"), word("b2", "again bea")] },
  { id: "c", name: "Cy", messages: [word("c1", "from cy")] },
];
const rows = () => screen.getAllByRole("option").map((row) => row.textContent ?? "");
const row = (name: string) =>
  screen.getAllByRole("option").find((each) => each.textContent?.includes(name)) as HTMLElement;
const confirm = async (name: string) => {
  const alert = await screen.findByRole("alertdialog");
  fireEvent.click(within(alert).getByRole("button", { name }));
};

describe("several conversations", () => {
  it("Command-click selects a second row, and Delete asks about both and takes both", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Messages defaultConversations={THREE} defaultConversation="a" />);
    await user.keyboard("{Meta>}");
    await user.click(row("Bea"));
    await user.keyboard("{/Meta}");
    expect(screen.getAllByRole("option", { selected: true })).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Conversations" }), { key: "Backspace" });
    expect(
      await screen.findByText("Are you sure you want to delete these 2 conversations?"),
    ).toBeTruthy();
    await confirm("Delete");
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toContain("Cy");
  });

  it("Delete takes the one marked row a search leaves, not the one shown behind it", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Messages defaultConversations={THREE} defaultConversation="a" />);
    await user.keyboard("{Meta>}");
    await user.click(row("Bea"));
    await user.keyboard("{/Meta}");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Bea" } });
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Conversations" }), { key: "Backspace" });
    expect(await screen.findByText(/delete this conversation with Bea/)).toBeTruthy();
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Cy" } });
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Conversations" }), { key: "Backspace" });
    await new Promise((settle) => setTimeout(settle, 50));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Delete does not take the conversation a search hides, while no row is highlighted", async () => {
    render(<Messages defaultConversations={THREE} defaultConversation="a" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Bea" } });
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryAllByRole("option", { selected: true })).toHaveLength(0);
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Conversations" }), { key: "Backspace" });
    await new Promise((settle) => setTimeout(settle, 50));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Conversations" }), { key: "Backspace" });
    expect(await screen.findByText(/delete this conversation with Ada/)).toBeTruthy();
  });

  it("the mark on a row deletes that row, whichever is shown, after asking", async () => {
    render(<Messages defaultConversations={THREE} defaultConversation="a" />);
    fireEvent.click(row("Cy").querySelector(".mac-messages-row-delete") as Element);
    expect(await screen.findByText(/delete this conversation with Cy/)).toBeTruthy();
    await confirm("Delete");
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows().join()).not.toContain("Cy");
    expect(screen.getAllByRole("option", { selected: true })[0]?.textContent).toContain("Ada");
  });
});

describe("the served window", () => {
  const ID = `c-${"a1".repeat(16)}`;
  const person = (name: string) => ({ name, full_name: name.toUpperCase() });
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const server = (group: boolean) =>
    vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://desktop.test").pathname;
      const members = [person("chris"), person("martin")];
      if (path === "/api/messages/conversations") {
        return Promise.resolve(
          json({ conversations: [{ id: ID, members, group, unread: 0, at_ms: 1 }] }),
        );
      }
      if (path === `/api/messages/conversations/${ID}`) {
        return Promise.resolve(
          json({
            state: { members, messages: [], read: {}, typing: {}, pages: 1, older: null, last: 0 },
          }),
        );
      }
      if (path === "/api/messages/me") return Promise.resolve(json({ name: "chris" }));
      if (path === "/api/messages/blocked") {
        return Promise.resolve(json({ blocked: [{ name: "martin" }] }));
      }
      return Promise.resolve(json({ people: [], ok: true }));
    });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const noticeOf = (hook: { current: ReturnType<typeof useAccountConversations> }) => {
    const view = render(<div>{hook.current.notices.get(ID)}</div>);
    const text = view.container.textContent ?? "";
    view.unmount();
    return text;
  };

  it("says the other person is blocked in a conversation between two", async () => {
    vi.stubGlobal("fetch", server(false));
    const { result } = renderHook(() => useAccountConversations(true, true));
    act(() => result.current.onConversationChange(ID));
    await waitFor(() => expect(noticeOf(result)).toContain("You have blocked MARTIN"));
  });

  it("does not say so in a group left down to two", async () => {
    vi.stubGlobal("fetch", server(true));
    const { result } = renderHook(() => useAccountConversations(true, true));
    act(() => result.current.onConversationChange(ID));
    await act(() => new Promise((settle) => setTimeout(settle, 100)));
    expect(noticeOf(result)).not.toContain("You have blocked");
    expect(result.current.props.blockedPerson?.(ID)).toBeNull();
  });

  it("the Emoji button calls the palette a host passes in", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal("fetch", server(false));
    vi.stubGlobal(
      "EventSource",
      class {
        addEventListener() {}
        close() {}
      },
    );
    vi.resetModules();
    const { MessagesLive } = await import("./messages-live");
    const onEmojiPalette = vi.fn();
    render(<MessagesLive onEmojiPalette={onEmojiPalette} />);
    const emoji = await screen.findByRole("button", { name: "Emoji" });
    await waitFor(() => expect(emoji).not.toHaveProperty("disabled", true));
    fireEvent.click(emoji);
    expect(onEmojiPalette).toHaveBeenCalledTimes(1);
  });
});

describe("the bubble's menu", () => {
  it("Delete… takes the one message, after asking", async () => {
    render(<Messages defaultConversations={THREE} defaultConversation="b" />);
    fireEvent.contextMenu(screen.getByText("from bea"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete…" }));
    await confirm("Delete");
    await waitFor(() => expect(screen.queryByText("from bea")).toBeNull());
    expect(screen.getAllByText("again bea").length).toBeGreaterThan(0);
  });

  it("is not offered where the owner says no", async () => {
    render(
      <Messages
        defaultConversations={THREE}
        defaultConversation="b"
        canDeleteMessage={() => false}
      />,
    );
    fireEvent.contextMenu(screen.getByText("from bea"));
    await screen.findByRole("menuitem", { name: "Copy" });
    expect(screen.queryByRole("menuitem", { name: "Delete…" })).toBeNull();
  });
});

describe("the message field", () => {
  // A browser's own insertion is proved in messages-field-block-journey, which reads the two lines
  // back from the server; jsdom has no execCommand.
  it("Option-Return sends nothing; Return sends", async () => {
    document.execCommand = (() => true) as typeof document.execCommand;
    const sent: string[] = [];
    render(
      <Messages
        defaultConversations={THREE}
        defaultConversation="a"
        heldMessages={new Map([["a", THREE[0]?.messages ?? []]])}
        onSend={(_, message) => sent.push(message.text)}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(field, { target: { value: "one" } });
    fireEvent.keyDown(field, { key: "Enter", altKey: true });
    expect(sent).toEqual([]);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(sent).toEqual(["one"]);
  });
});

describe("what is kept", () => {
  it("reads the View menu's choices, and refuses what the window did not write", () => {
    expect(readMessagesView({ listHidden: true, senders: "unknown" })).toEqual({
      listHidden: true,
      senders: "unknown",
    });
    expect(readMessagesView({ listHidden: true, senders: "everyone" })).toBeUndefined();
    expect(readMessagesView(null)).toBeUndefined();
  });

  it("reads each conversation's receipts, leaving out anything else", () => {
    expect(readConversationReceipts({ a: false, b: "yes" })).toEqual({ a: false });
    expect(readConversationReceipts("a")).toBeUndefined();
  });
});
