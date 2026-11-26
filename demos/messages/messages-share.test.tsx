import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { shareLink, takeSharedLinks } from "../desktop/desktop-share-link";
import { Messages } from "./messages";
import {
  MESSAGES_SHARED_FILES,
  MessagesLive,
  readSharedFiles,
  sharedMessageText,
  useSharedFiles,
  useSharedMessage,
} from "./messages-live";

/*
 * Share > Messages (Safari, News and Stocks: `desktop-share-link.tsx`): a shared link starts a new
 * message holding it, for the person to address and send. Nothing is sent by itself.
 */

const PAGE = "https://en.wikipedia.org/wiki/MacOS_Catalina";

afterEach(() => {
  takeSharedLinks("messages");
});

describe("files shared with Messages", () => {
  const file = (id: string) => ({ id, name: "report.txt", kind: "file" as const });
  const person = "Martin";

  it("go only with the message they started, in that message's own list", async () => {
    const user = userEvent.setup();
    const onStartConversation = vi.fn(async () => "started");
    const first = { key: 1, items: [file("a"), file("b")] };
    const view = render(
      <Messages
        defaultConversations={[]}
        extraConversations={[]}
        composeFiles={[first]}
        onStartConversation={onStartConversation}
      />,
    );
    const list = screen.getByRole("list", { name: "Files to send" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    await user.click(
      within(list).getAllByRole("button", { name: "Remove report.txt" })[1] as HTMLElement,
    );
    await user.type(screen.getByRole("textbox", { name: "To" }), person);
    await user.click(screen.getByRole("textbox", { name: "Message" }));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onStartConversation).toHaveBeenCalledTimes(1));
    const call = onStartConversation.mock.calls[0] as unknown as [
      string,
      { text: string },
      string,
      { id: string }[],
    ];
    expect(call[0]).toBe(person);
    expect(call[1].text).toBe("");
    expect(call[3].map(({ id }) => id)).toEqual(["a"]);
    view.rerender(
      <Messages
        defaultConversations={[]}
        extraConversations={[]}
        composeFiles={[first, { key: 2, items: [file("c")] }]}
        onStartConversation={onStartConversation}
      />,
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Remove report.txt" })).toHaveLength(1),
    );
  });

  it("sends nothing for a message with neither words nor files", async () => {
    const user = userEvent.setup();
    const onStartConversation = vi.fn(async () => "started");
    render(
      <Messages
        defaultConversations={[]}
        extraConversations={[]}
        composeFiles={[{ key: 1, items: [file("a")] }]}
        onStartConversation={onStartConversation}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove report.txt" }));
    await user.type(screen.getByRole("textbox", { name: "To" }), person);
    await user.click(screen.getByRole("textbox", { name: "Message" }));
    await user.keyboard("{Enter}");
    expect(onStartConversation).not.toHaveBeenCalled();
  });
});

describe("files kept for new messages", () => {
  const report = { id: "a", name: "report.txt", kind: "file" as const, size: 3 };
  afterEach(() => changeDesktopValue(MESSAGES_SHARED_FILES, undefined));

  it("reads only what names a file", () => {
    expect(readSharedFiles("no")).toBeUndefined();
    expect(readSharedFiles([{ id: "a", name: "report.txt", size: 3 }, { id: 1 }, null])).toEqual([
      report,
    ]);
  });

  it("start one message after a reload, and leave the settings when it has none", () => {
    changeDesktopValue(MESSAGES_SHARED_FILES, [report]);
    const { result } = renderHook(() => useSharedFiles());
    expect(result.current.shares).toEqual([{ key: 1, items: [report] }]);
    act(() => result.current.keep([report]));
    expect(result.current.shares).toHaveLength(1);
    act(() => result.current.keep([]));
    expect(desktopValues()[MESSAGES_SHARED_FILES]).toEqual([]);
  });

  it("are not erased by a window that has carried nothing yet", () => {
    const { result } = renderHook(() => useSharedFiles());
    act(() => result.current.keep([]));
    expect(desktopValues()[MESSAGES_SHARED_FILES]).toBeUndefined();
  });

  it("are told to the owner of the window, and go when the message does", async () => {
    const user = userEvent.setup();
    const heard = vi.fn();
    render(
      <Messages
        defaultConversations={[]}
        extraConversations={[]}
        composeFiles={[{ key: 1, items: [report] }]}
        onDraftFilesChange={heard}
      />,
    );
    expect(heard).toHaveBeenLastCalledWith([report]);
    await user.click(screen.getByRole("button", { name: "Remove report.txt" }));
    expect(heard).toHaveBeenLastCalledWith([]);
  });
});

describe("a link shared with Messages", () => {
  it("is the text of a new message: its title, then its address", () => {
    expect(sharedMessageText({ url: PAGE, title: "macOS Catalina" })).toBe(
      `macOS Catalina ${PAGE}`,
    );
    expect(sharedMessageText({ url: PAGE, title: "  " })).toBe(PAGE);
    expect(sharedMessageText({ url: PAGE, title: PAGE })).toBe(PAGE);
    // A headline with a line break is one line.
    expect(sharedMessageText({ url: PAGE, title: "Barclays boss … backs\nHealey  – live " })).toBe(
      `Barclays boss … backs Healey – live ${PAGE}`,
    );
  });

  it("is taken when Messages opens, and heard while it is open", () => {
    act(() => {
      shareLink("messages", PAGE, "Catalina", "safari");
    });
    const { result } = renderHook(() => useSharedMessage());
    expect(result.current).toEqual({ key: 1, text: `Catalina ${PAGE}` });
    expect(takeSharedLinks("messages"), "taken, not kept as well").toEqual([]);
    act(() => {
      shareLink("messages", "https://www.npr.org/2", "NPR", "news");
    });
    expect(result.current).toEqual({ key: 2, text: "NPR https://www.npr.org/2" });
  });

  it("starts a new message with the link, the To field taking the keyboard, and sends it once addressed", async () => {
    const user = userEvent.setup();
    const sent = vi.fn();
    const view = render(
      <Messages composeText={{ key: 1, text: `Catalina ${PAGE}` }} onSend={sent} />,
    );
    const message = () => screen.getByRole("textbox", { name: "Message" });
    expect(message()).toHaveValue(`Catalina ${PAGE}`);
    const to = screen.getByRole("textbox", { name: "To" });
    expect(to).toHaveFocus();
    expect(sent).not.toHaveBeenCalled();
    await user.type(to, "Anna{Enter}");
    expect(message()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(sent).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ text: `Catalina ${PAGE}` }),
    );
    expect(message()).toHaveValue("");
    // The same key starts nothing again; a new one starts another message.
    view.rerender(<Messages composeText={{ key: 1, text: "again" }} onSend={sent} />);
    expect(message()).toHaveValue("");
    view.rerender(
      <Messages composeText={{ key: 2, text: "https://www.npr.org/2" }} onSend={sent} />,
    );
    expect(message()).toHaveValue("https://www.npr.org/2");
    expect(screen.getByRole("textbox", { name: "To" })).toHaveValue("");
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it("starts a message to someone else beside a draft to another, which keeps its text", async () => {
    const user = userEvent.setup();
    const view = render(<Messages composeTo={{ key: 1, to: "alice" }} />);
    const to = () => screen.getByRole("textbox", { name: "To" }) as HTMLInputElement;
    const message = () => screen.getByRole("textbox", { name: "Message" }) as HTMLInputElement;
    expect(to().value).toBe("alice");
    await user.type(message(), "for alice");

    view.rerender(<Messages composeTo={{ key: 2, to: "bob" }} />);
    expect(to().value).toBe("bob");
    expect(message().value).toBe("");

    const row = screen
      .getAllByRole("option")
      .find((each) => each.textContent?.includes("alice")) as HTMLElement;
    await user.click(row);
    expect(to().value).toBe("alice");
    expect(message().value).toBe("for alice");
  });

  it("reaches the Messages window the desktop opens, which starts the message and takes the link once", () => {
    act(() => {
      shareLink("messages", PAGE, "Catalina", "stocks");
    });
    render(<MessagesLive />);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(`Catalina ${PAGE}`);
    expect(takeSharedLinks("messages")).toEqual([]);
  });
});
