import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { openItem } from "../desktop/desktop-open-item";
import { app, mailApp } from "./app";
import { Mail } from "./mail";
import { MailCompose } from "./mail-compose";
import type { MailDraft } from "./mail-data";
import { MailLive } from "./mail-live";
import { MailPreferences } from "./mail-preferences";
import { messageText } from "./mail-text";

const viewer = () => screen.getByRole("region", { name: /messages?\)|Searching/ });
const mailbox = (name: string) =>
  within(screen.getByRole("tree", { name: "Mailboxes" })).getByRole("treeitem", {
    name: new RegExp(`^${name}`),
  });
const messages = () =>
  within(screen.getByRole("listbox", { name: "Messages" }))
    .getAllByRole("option")
    .map((row) => row.querySelector(".mac-mail-row-name")?.textContent);
const message = (sender: string) =>
  within(screen.getByRole("listbox", { name: "Messages" })).getByRole("option", {
    name: new RegExp(sender),
  });
const button = (name: string) => screen.getByRole("button", { name });
/** A toolbar button that is disabled stays reachable, so it is marked with `aria-disabled`. */
const unavailable = (name: string) => button(name).getAttribute("aria-disabled") === "true";
const compose = () => screen.getByRole("region", { name: "New Message" });
const messageView = () => screen.getByRole("textbox", { name: "Message" });

/**
 * Select `word` in the message, or put the insertion point `at` characters into it, as the
 * mouse would: jsdom announces no change of the selection by itself.
 */
const select = (word: string, at?: number) => {
  const root = messageView();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = walker.nextNode() as Text | null;
  while (text && !(text.nodeValue ?? "").includes(word)) text = walker.nextNode() as Text | null;
  if (!text) throw new Error(`no "${word}" in the message`);
  const start = (text.nodeValue ?? "").indexOf(word);
  root.focus();
  const range = document.createRange();
  range.setStart(text, start + (at ?? 0));
  if (at === undefined) range.setEnd(text, start + word.length);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent(document, new Event("selectionchange"));
};

describe("the viewer window", () => {
  it("is a library window that takes the window's props and names itself after the mailbox", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Mail ref={ref} state="main" className="mine" data-kind="app" width={900} height={500} />,
    );
    const root = viewer();
    expect(root).toBe(ref.current);
    expect(root).toHaveAccessibleName("Inbox (4 messages)");
    expect(root).toHaveClass("mac-window", "mac-mail", "mine");
    expect(root).toHaveAttribute("data-window-state", "main");
    expect(root).toHaveAttribute("data-kind", "app");
    expect(root).toHaveStyle({ width: "900px", height: "500px" });
  });

  it("hands the window controls' and the drag region's callbacks to those parts", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDrag = vi.fn();
    const onDoubleClick = vi.fn();
    render(
      <Mail
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        zoomRole="zoom"
        onDragRegionPointerDown={onDrag}
        onDragRegionDoubleClick={onDoubleClick}
      />,
    );
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);

    const title = screen.getByText("Inbox (4 messages)");
    fireEvent.pointerDown(title, { button: 0 });
    fireEvent.doubleClick(title);
    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a toolbar control is the control's, not a drag.
    fireEvent.pointerDown(button("Get Mail"), { button: 0 });
    expect(onDrag).toHaveBeenCalledTimes(1);
  });

  it("disables the minimize and zoom buttons when the manager says so", () => {
    render(<Mail minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
  });
});

describe("mailboxes", () => {
  it("shows the message a notification names, in its mailbox, with it selected", async () => {
    render(<Mail />);
    act(() => openItem({ app: "mail", id: "message-sent-binoculars", title: "Ada" }));
    await waitFor(() => expect(mailbox("Sent")).toHaveAttribute("aria-selected", "true"));
    const [row] = within(screen.getByRole("listbox", { name: "Messages" })).getAllByRole("option");
    expect(row).toHaveAttribute("aria-selected", "true");
  });
  it("shows the selected mailbox's messages, from the sidebar and from the Favorites bar", async () => {
    const user = userEvent.setup();
    const onMailboxChange = vi.fn();
    render(<Mail onMailboxChange={onMailboxChange} />);
    expect(mailbox("Inbox")).toHaveAttribute("aria-selected", "true");
    expect(messages()).toEqual([
      "Harbor Ferry Company",
      "The Lighthouse Bookshop",
      "Ines Lindqvist",
      "Otis Brandt",
    ]);

    await user.click(mailbox("Drafts"));
    expect(onMailboxChange).toHaveBeenLastCalledWith("drafts");
    expect(viewer()).toHaveAccessibleName("Drafts (1 message)");
    expect(messages()).toEqual(["Robin Vega"]);
    expect(screen.getByRole("radio", { name: "Drafts (1)" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Sent" }));
    expect(onMailboxChange).toHaveBeenLastCalledWith("sent");
    expect(mailbox("Sent")).toHaveAttribute("aria-selected", "true");
    expect(viewer()).toHaveAccessibleName("Sent (1 message)");
  });

  it("badges the Inbox with its unread messages and Drafts with its drafts", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    expect(mailbox("Inbox")).toHaveTextContent("Inbox2");
    expect(mailbox("Drafts")).toHaveTextContent("Drafts1");
    expect(mailbox("Sent")).toHaveTextContent(/^Sent$/);
    // Selecting an unread message reads it.
    await user.click(message("The Lighthouse Bookshop"));
    expect(mailbox("Inbox")).toHaveTextContent("Inbox1");
  });

  it("reads the message that is shown at first, named or the mailbox's most recent", () => {
    const { unmount } = render(<Mail defaultMessage="bookshop" />);
    expect(message("The Lighthouse Bookshop")).toHaveAttribute("aria-selected", "true");
    expect(
      within(message("The Lighthouse Bookshop")).queryByRole("img", { name: "Unread" }),
    ).toBeNull();
    expect(
      within(message("Ines Lindqvist")).getByRole("img", { name: "Unread" }),
    ).toBeInTheDocument();
    expect(mailbox("Inbox")).toHaveTextContent("Inbox1");
    unmount();

    const unread = {
      mailbox: "inbox" as const,
      to: ["Robin Vega"],
      subject: "Lunch",
      date: "9/1/19",
      received: "September 1, 2019 at 9:00 AM",
      body: "Thursday?",
      unread: true,
    };
    render(
      <Mail
        messages={[
          { ...unread, id: "old", from: "Ada Moreno", time: 1 },
          { ...unread, id: "new", from: "Felix Okafor", time: 2 },
        ]}
      />,
    );
    expect(message("Felix Okafor")).toHaveAttribute("aria-selected", "true");
    expect(mailbox("Inbox")).toHaveTextContent("Inbox1");
  });

  it("lists the Trash only while it holds a message, and hides the list from the Favorites bar", async () => {
    const user = userEvent.setup();
    render(
      <Mail
        messages={[
          {
            id: "one",
            mailbox: "inbox",
            from: "Ada Moreno",
            to: ["Robin Vega"],
            subject: "Lunch",
            date: "9/1/19",
            received: "September 1, 2019 at 9:00 AM",
            time: 1,
            body: "Thursday?",
          },
        ]}
      />,
    );
    const tree = screen.getByRole("tree", { name: "Mailboxes" });
    expect(within(tree).queryByRole("treeitem", { name: /^Trash/ })).toBeNull();
    await user.click(button("Delete"));
    expect(within(tree).getByRole("treeitem", { name: /^Trash/ })).toBeInTheDocument();
    expect(viewer()).toHaveAccessibleName("Inbox (0 messages)");
    expect(screen.getByRole("status")).toHaveTextContent("No Messages");

    const toggle = button("Mailboxes");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(tree.closest(".mac-split-view-pane")).toHaveAttribute("data-collapsed");
  });
});

describe("messages", () => {
  it("shows the selected message, with its recipients behind Details", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    // The most recent message of the first mailbox is selected at first.
    expect(message("Harbor Ferry Company")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("article", { name: "Your crossing to the island is confirmed" }),
    ).toHaveTextContent("Boarding closes ten minutes before departure");

    await user.click(message("Ines Lindqvist"));
    const article = screen.getByRole("article");
    expect(article).toHaveAccessibleName("Saturday: north trail or the lighthouse loop?");
    expect(article).not.toHaveTextContent("To: Robin Vega, Jonas Petit");
    await user.click(within(article).getByRole("button", { name: "Details" }));
    expect(article).toHaveTextContent("To: Robin Vega, Jonas Petit");
  });

  it("moves through the list with the arrow keys and deletes with the Delete key", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    await user.click(message("Harbor Ferry Company"));
    await user.keyboard("{ArrowDown}");
    expect(message("The Lighthouse Bookshop")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Delete}");
    expect(messages()).toEqual(["Harbor Ferry Company", "Ines Lindqvist", "Otis Brandt"]);
    // The message that took its place is selected.
    expect(message("Ines Lindqvist")).toHaveAttribute("aria-selected", "true");
    expect(mailbox("Trash")).toBeInTheDocument();
  });

  it("has no message commands without a selection", async () => {
    const user = userEvent.setup();
    render(<Mail defaultMessage={null} />);
    expect(screen.getByText("No Message Selected")).toBeInTheDocument();
    for (const name of ["Archive", "Delete", "Junk", "Reply", "Reply All", "Forward", "Mute"]) {
      expect(unavailable(name)).toBe(true);
    }
    await user.click(message("Otis Brandt"));
    expect(unavailable("Delete")).toBe(false);
  });

  it("flags, mutes, files as junk and moves the selected message", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    const row = () => message("Harbor Ferry Company");

    await user.click(button("Flag"));
    expect(within(row()).getByRole("img", { name: "Red flag" })).toBeInTheDocument();
    await user.click(button("Flag Color"));
    await user.click(await screen.findByRole("menuitem", { name: "Green" }));
    expect(within(row()).getByRole("img", { name: "Green flag" })).toBeInTheDocument();
    await user.click(button("Clear Flag"));
    expect(within(row()).queryByRole("img", { name: /flag/ })).toBeNull();

    await user.click(button("Mute"));
    expect(within(row()).getByRole("img", { name: "Muted" })).toBeInTheDocument();
    expect(button("Mute")).toHaveAttribute("aria-pressed", "true");

    await user.click(button("Move to…"));
    await user.click(await screen.findByRole("menuitem", { name: "Archive" }));
    expect(messages()).not.toContain("Harbor Ferry Company");
    expect(mailbox("Archive")).toBeInTheDocument();

    // The next message was selected in its place; Junk files that one.
    await user.click(button("Junk"));
    expect(messages()).toEqual(["Ines Lindqvist", "Otis Brandt"]);
    await user.click(mailbox("Junk"));
    expect(messages()).toEqual(["The Lighthouse Bookshop"]);
  });

  it("sorts the list and filters it to the unread messages", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    await user.click(button("Sort by Date"));
    await user.click(await screen.findByRole("menuitemradio", { name: "From" }));
    expect(button("Sort by From")).toBeInTheDocument();
    expect(messages()).toEqual([
      "Harbor Ferry Company",
      "Ines Lindqvist",
      "Otis Brandt",
      "The Lighthouse Bookshop",
    ]);

    const filter = button("Filter: Unread");
    await user.click(filter);
    expect(filter).toHaveAttribute("aria-pressed", "true");
    expect(messages()).toEqual(["Ines Lindqvist", "The Lighthouse Bookshop"]);

    // A message selected under the filter is read by that, and stays until another is.
    await user.click(message("Ines Lindqvist"));
    expect(screen.getByRole("article")).toHaveAccessibleName(
      "Saturday: north trail or the lighthouse loop?",
    );
    expect(messages()).toEqual(["Ines Lindqvist", "The Lighthouse Bookshop"]);
    await user.click(message("The Lighthouse Bookshop"));
    expect(messages()).toEqual(["The Lighthouse Bookshop"]);
    expect(screen.getByRole("article")).toHaveAccessibleName("The atlas you ordered has arrived");
  });
});

describe("search", () => {
  it("finds messages in all mailboxes by sender, subject and text", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "print");
    // One in the Inbox (text) and one in Drafts (subject).
    expect(messages()).toEqual(["Robin Vega", "Otis Brandt"]);
    expect(viewer()).toHaveAccessibleName("Searching “All Mailboxes” (Found 2 matches)");
    expect(mailbox("Inbox")).toHaveAttribute("aria-selected", "false");

    await user.clear(field);
    await user.type(field, "zeppelin");
    expect(screen.getByRole("status")).toHaveTextContent("No Results");

    await user.click(button("Clear"));
    expect(viewer()).toHaveAccessibleName("Inbox (4 messages)");
    expect(messages()).toHaveLength(4);
  });

  it("leaves the Trash out when the General preference says so", async () => {
    const user = userEvent.setup();
    render(<Mail defaultPreferencesOpen />);
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "tide");
    expect(messages()).toEqual(["Mara Castellanos"]);

    await user.click(screen.getByRole("checkbox", { name: "Trash" }));
    expect(screen.getByRole("status")).toHaveTextContent("No Results");
  });

  it("respects the unread filter, whichever of the two is set first", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    const field = screen.getByRole("searchbox", { name: "Search" });
    // "island" is in a read message (the ferry's) and in an unread one (Ines's).
    await user.type(field, "island");
    expect(messages()).toEqual(["Harbor Ferry Company", "Ines Lindqvist"]);
    await user.click(button("Filter: Unread"));
    expect(messages()).toEqual(["Ines Lindqvist"]);
    expect(viewer()).toHaveAccessibleName("Searching “All Mailboxes” (Found 1 match)");

    // A search typed while the filter is on is filtered too.
    await user.clear(field);
    await user.type(field, "ordered");
    expect(messages()).toEqual(["The Lighthouse Bookshop"]);
    await user.clear(field);
    await user.type(field, "photos");
    expect(screen.getByRole("status")).toHaveTextContent("No Results");

    await user.click(button("Filter: Unread"));
    expect(messages()).toEqual(["Otis Brandt"]);
  });
});

describe("the New Message window", () => {
  it("opens as the key window over an inactive viewer, and gives the viewer back the key state when closed", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    expect(viewer()).toHaveAttribute("data-window-state", "key");
    await user.click(button("New Message"));
    expect(compose()).toHaveAttribute("data-window-state", "key");
    expect(viewer()).toHaveAttribute("data-window-state", "inactive");
    expect(viewer()).not.toContainElement(compose());
    expect(screen.getByRole("combobox", { name: "To:" })).toHaveFocus();

    // A press on the viewer makes it key again; a press on the new message takes it back.
    await user.click(screen.getByText("Inbox (4 messages)"));
    expect(viewer()).toHaveAttribute("data-window-state", "key");
    expect(compose()).toHaveAttribute("data-window-state", "inactive");
    await user.click(screen.getByRole("textbox", { name: "Subject:" }));
    expect(compose()).toHaveAttribute("data-window-state", "key");

    await user.click(within(compose()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "New Message" })).toBeNull();
    expect(viewer()).toHaveAttribute("data-window-state", "key");
  });

  it("turns typed names into recipient tokens and sends the message to the Sent mailbox", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    await user.click(button("New Message"));
    const send = within(compose()).getByRole("button", { name: "Send" });
    expect(send).toHaveAttribute("aria-disabled", "true");

    await user.keyboard("Ada Moreno,");
    const recipients = within(compose()).getByRole("listbox", { name: "To recipients" });
    expect(within(recipients).getByRole("option", { name: /Ada Moreno/ })).toBeInTheDocument();
    // A name from the address book completes.
    await user.keyboard("Fel{ArrowDown}{Enter}");
    expect(within(recipients).getAllByRole("option")).toHaveLength(2);
    expect(within(recipients).getByRole("option", { name: /Felix Okafor/ })).toBeInTheDocument();
    // Backspace in the empty text selects the last token, and again removes it.
    await user.keyboard("{Backspace}{Backspace}");
    expect(within(recipients).getAllByRole("option")).toHaveLength(1);

    await user.type(screen.getByRole("textbox", { name: "Subject:" }), "Lunch on Thursday");
    expect(screen.getByRole("region", { name: "Lunch on Thursday" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Noon at the pier?");
    expect(send).not.toHaveAttribute("aria-disabled", "true");
    await user.click(send);

    expect(screen.queryByRole("region", { name: "Lunch on Thursday" })).toBeNull();
    await user.click(mailbox("Sent"));
    expect(viewer()).toHaveAccessibleName("Sent (2 messages)");
    await user.click(message("Lunch on Thursday"));
    const article = screen.getByRole("article", { name: "Lunch on Thursday" });
    expect(article).toHaveTextContent("Noon at the pier?");
    await user.click(within(article).getByRole("button", { name: "Details" }));
    expect(article).toHaveTextContent("To: Ada Moreno");
  });

  it("addresses a reply to one's own message written only in Bcc to its first Bcc", async () => {
    const user = userEvent.setup();
    render(
      <Mail
        me="Robin <robin@macalicious>"
        defaultMailbox="sent"
        defaultMessage={null}
        messages={[
          {
            id: "unseen",
            mailbox: "sent",
            from: "Robin",
            fromAddress: "Robin <robin@macalicious>",
            to: [],
            toAddresses: [],
            bcc: ["Ada <ada@macalicious>"],
            subject: "Quietly",
            date: "",
            received: "",
            time: 1,
            body: "",
          },
        ]}
      />,
    );
    await user.click(message("Robin"));
    await user.click(button("Reply"));
    const reply = screen.getByRole("region", { name: "Re: Quietly" });
    expect(within(reply).getByRole("listbox", { name: "To recipients" })).toHaveTextContent(
      "ada@macalicious",
    );
  });

  it("addresses a reply to a Reply-To, even one naming the person replying", async () => {
    const user = userEvent.setup();
    render(
      <Mail
        me="Robin <robin@macalicious>"
        defaultMessage={null}
        messages={[
          {
            id: "asked",
            mailbox: "inbox",
            from: "Ines",
            fromAddress: "Ines <ines@macalicious>",
            to: ["Jonas"],
            toAddresses: ["Jonas <jonas@macalicious>"],
            cc: ["Robin <robin@macalicious>"],
            replyTo: "robin@macalicious",
            subject: "Ask me",
            date: "",
            received: "",
            time: 1,
            body: "",
          },
        ]}
      />,
    );
    await user.click(message("Ines"));
    await user.click(button("Reply"));
    const reply = screen.getByRole("region", { name: "Re: Ask me" });
    const to = within(reply).getByRole("listbox", { name: "To recipients" });
    expect(to).toHaveTextContent("robin@macalicious");
    expect(to).not.toHaveTextContent("Jonas");
  });

  it("addresses a reply to the sender and a reply to all to the other recipients too", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    await user.click(message("Ines Lindqvist"));
    await user.click(button("Reply All"));
    const reply = screen.getByRole("region", {
      name: "Re: Saturday: north trail or the lighthouse loop?",
    });
    const to = within(reply).getByRole("listbox", { name: "To recipients" });
    const cc = within(reply).getByRole("listbox", { name: "Cc recipients" });
    expect(to).toHaveTextContent("Ines Lindqvist");
    expect(cc).toHaveTextContent("Jonas Petit");
    // The message is quoted into the editor, line by line.
    const text = within(reply).getByRole("textbox", { name: "Message" });
    expect(text).toHaveTextContent("Ines Lindqvist wrote:");
    expect(messageText(text)).toMatch(
      /^\n\nOn September 26, 2019.*wrote:\n\nHi both,\n\nIf the first/,
    );

    // Forward replaces the window with a new one without recipients.
    await user.click(screen.getByText("Inbox (4 messages)"));
    await user.click(button("Forward"));
    const forward = screen.getByRole("region", {
      name: "Fwd: Saturday: north trail or the lighthouse loop?",
    });
    expect(within(forward).queryAllByRole("option")).toHaveLength(0);
  });

  it("answers a message of one's own to its first recipient and copies the others once", async () => {
    const user = userEvent.setup();
    render(<Mail defaultMailbox="sent" />);
    await user.click(button("Reply All"));
    const reply = screen.getByRole("region", { name: /^Re: Saturday/ });
    const names = (label: string) =>
      within(within(reply).getByRole("listbox", { name: label }))
        .getAllByRole("option")
        .map((token) => token.textContent);
    expect(names("To recipients")).toEqual(["Ines Lindqvist"]);
    expect(names("Cc recipients")).toEqual(["Jonas Petit"]);
  });

  it("follows the viewer when its owner moves it", () => {
    // jsdom lays nothing out: the viewer's frame is read from the position its owner gives it.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const x = this.classList.contains("mac-mail") ? Number.parseFloat(this.style.left) : 0;
      const y = this.classList.contains("mac-mail") ? Number.parseFloat(this.style.top) : 0;
      return new DOMRect(x, y, 0, 0);
    });
    const draft = { to: [], cc: [], subject: "", body: "" };
    const at = (left: number, top: number) => (
      <Mail defaultDraft={draft} style={{ position: "absolute", left, top }} />
    );
    const { rerender } = render(at(40, 30));
    expect(compose()).toHaveStyle({ position: "absolute", left: "265px", top: "175px" });
    rerender(at(300, 100));
    expect(compose()).toHaveStyle({ left: "525px", top: "245px" });
  });

  it("opens with a draft when given one, as in the reference screenshots", () => {
    render(
      <Mail
        defaultDraft={{
          to: ["Stephen Hackett"],
          cc: [],
          subject: "Hello from macOS Catalina!",
          body: "",
        }}
      />,
    );
    const draft = screen.getByRole("region", { name: "Hello from macOS Catalina!" });
    expect(draft).toHaveAttribute("data-window-state", "key");
    expect(viewer()).toHaveAttribute("data-window-state", "inactive");
    expect(within(draft).getByRole("option", { name: /Stephen Hackett/ })).toBeInTheDocument();
    // The keyboard is not taken from the page for a window that was not asked for.
    expect(document.body).toHaveFocus();
  });

  it("stays behind the app's state: every window of an inactive app is inactive", () => {
    render(<Mail state="inactive" defaultDraft={{ to: [], cc: [], subject: "", body: "" }} />);
    expect(compose()).toHaveAttribute("data-window-state", "inactive");
    expect(viewer()).toHaveAttribute("data-window-state", "inactive");
  });
});

describe("MailCompose", () => {
  it("hands the message to onSend, its text as plain text with its line breaks, and the close button to onClose", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const onClose = vi.fn();
    render(
      <MailCompose
        defaultDraft={{
          to: ["Ada Moreno"],
          cc: ["Felix Okafor"],
          subject: "Tides",
          body: "Low at six.\n\nHigh at noon.",
        }}
        onSend={onSend}
        onClose={onClose}
        data-testid="compose"
      />,
    );
    expect(screen.getByTestId("compose")).toHaveClass("mac-window", "mac-mail-compose");
    await user.click(button("Send"));
    expect(onSend).toHaveBeenCalledWith({
      to: ["Ada Moreno"],
      cc: ["Felix Okafor"],
      subject: "Tides",
      body: "Low at six.\n\nHigh at noon.",
      html: "<div>Low at six.</div><div><br></div><div>High at noon.</div>",
    });
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves and removes a recipient from its token's menu", async () => {
    const user = userEvent.setup();
    render(<MailCompose defaultDraft={{ to: ["Ada Moreno"], cc: [], subject: "", body: "" }} />);
    const to = screen.getByRole("listbox", { name: "To recipients" });
    // A field without tokens has no list of them.
    expect(screen.queryByRole("listbox", { name: "Cc recipients" })).toBeNull();

    // Space on a selected token asks for its menu.
    await user.click(within(to).getByRole("option", { name: /Ada Moreno/ }));
    await user.keyboard(" ");
    await user.click(await screen.findByRole("menuitem", { name: "Move to Cc Field" }));
    expect(screen.queryByRole("listbox", { name: "To recipients" })).toBeNull();
    const cc = screen.getByRole("listbox", { name: "Cc recipients" });
    expect(within(cc).getByRole("option", { name: /Ada Moreno/ })).toBeInTheDocument();

    await user.click(within(cc).getByRole("option", { name: /Ada Moreno/ }));
    await user.keyboard(" ");
    await user.click(await screen.findByRole("menuitem", { name: "Remove Ada Moreno" }));
    expect(screen.queryByRole("listbox", { name: "Cc recipients" })).toBeNull();
    expect(button("Send")).toHaveAttribute("aria-disabled", "true");
  });

  it("hides the Cc field from the header fields menu", async () => {
    const user = userEvent.setup();
    render(<MailCompose />);
    expect(screen.getByRole("combobox", { name: "Cc:" })).toBeInTheDocument();
    await user.click(button("Header Fields"));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Cc Address Field" }));
    expect(screen.queryByRole("combobox", { name: "Cc:" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "To:" })).toBeInTheDocument();
  });

  it("puts an emoji from the Emoji menu where the insertion point is", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <MailCompose
        defaultDraft={{
          to: ["Ada Moreno"],
          cc: [],
          subject: "",
          body: "Low at six.\nHigh at noon.",
        }}
        onSend={onSend}
      />,
    );
    select("Low at", 6);
    await user.click(button("Emoji"));
    await user.click(await screen.findByRole("menuitem", { name: /Thumbs Up/ }));
    expect(messageText(messageView())).toBe("Low at👍 six.\nHigh at noon.");
    // Again at an insertion point on the second line.
    select("High", 4);
    await user.click(button("Emoji"));
    await user.click(await screen.findByRole("menuitem", { name: /Party Popper/ }));
    expect(messageText(messageView())).toBe("Low at👍 six.\nHigh🎉 at noon.");
    await user.click(button("Send"));
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Low at👍 six.\nHigh🎉 at noon." }),
    );
  });

  it("puts an emoji at the end of an empty message's only line", async () => {
    const user = userEvent.setup();
    render(<MailCompose />);
    await user.click(button("Emoji"));
    await user.click(await screen.findByRole("menuitem", { name: /Thumbs Up/ }));
    expect(messageView()).toHaveTextContent("👍");
    expect(messageText(messageView())).toBe("👍");
  });

  it("keeps a Cc field that holds a recipient, and sends to a message that has only those", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <MailCompose
        defaultDraft={{ to: [], cc: ["Felix Okafor"], subject: "", body: "" }}
        onSend={onSend}
      />,
    );
    await user.click(button("Header Fields"));
    const item = await screen.findByRole("menuitemcheckbox", { name: "Cc Address Field" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("combobox", { name: "Cc:" })).toBeInTheDocument();

    await user.click(button("Send"));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ to: [], cc: ["Felix Okafor"] }));
  });
});

/*
 * Styling the message. jsdom does not edit `contenteditable` content and has no editing
 * commands (`document.execCommand`): the tests install a stand-in that records each command,
 * its value and whether the selection was in the message when it ran, as TextEdit's tests do.
 * What the browser then does to the text, and the computed font, are read in the browsers
 * (mail.browser.test.tsx). Command is the Control key off Apple platforms, which is what jsdom
 * reports.
 */
describe("styling the message", () => {
  const DRAFT = { to: [], cc: [], subject: "Tides", body: "Low at six.\nHigh at noon." };
  const command = (key: string, shiftKey = false) =>
    fireEvent.keyDown(messageView(), { key, ctrlKey: true, shiftKey });
  const bar = () => screen.getByRole("toolbar", { name: "Format" });
  const pressed = (name: string) => within(bar()).getByRole("button", { name });
  const popUp = (name: string) => within(bar()).getByRole("combobox", { name });

  function recordCommands() {
    const commands: [string, string | undefined, boolean][] = [];
    document.execCommand = (name: string, _ui?: boolean, value?: string) => {
      if (name !== "styleWithCSS") {
        const anchor = document.getSelection()?.anchorNode ?? null;
        commands.push([name, value, anchor !== null && messageView().contains(anchor)]);
      }
      return true;
    };
    return commands;
  }

  async function choose(user: ReturnType<typeof userEvent.setup>, name: string, option: string) {
    await user.click(popUp(name));
    await user.click(await screen.findByRole("option", { name: option }));
    await waitFor(() => expect(screen.queryByRole("option", { name: option })).toBeNull());
  }

  /**
   * The window, with the message font set on the message itself: jsdom loads no stylesheet, so
   * this stands in for mail.tokens.css, and text without a font of its own reads Helvetica 12
   * as in a browser.
   */
  const renderCompose = (draft: MailDraft = DRAFT) => {
    const result = render(<MailCompose defaultDraft={draft} />);
    Object.assign(messageView().style, {
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSize: "12px",
    });
    return result;
  };

  afterEach(() => {
    delete (document as Partial<Document>).execCommand;
  });

  it("sets the message in a rich text view and shows the format bar from the Aa button", async () => {
    const user = userEvent.setup();
    render(<MailCompose defaultDraft={DRAFT} />);
    // A rich text view, holding the draft's lines; its font is Mail's message font,
    // Helvetica 12 (mail.tokens.css), which the browser tests read back.
    expect(messageView()).toHaveAttribute("contenteditable", "true");
    expect(messageView()).toHaveAttribute("data-rich");
    expect(messageView()).toHaveClass("mac-mail-compose-message");
    expect([...messageView().children].map((line) => line.textContent)).toEqual([
      "Low at six.",
      "High at noon.",
    ]);

    // Hidden at first, as in the reference screenshots.
    const toggle = button("Show Format Bar");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("toolbar", { name: "Format" })).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(popUp("Font family")).toHaveTextContent("Helvetica");
    expect(popUp("Font size")).toHaveTextContent("12");
    expect(within(bar()).getByLabelText("Text color")).toHaveValue("#000000");
    for (const name of ["Bold", "Italic", "Underline", "Strikethrough"]) {
      expect(pressed(name)).toHaveAttribute("aria-pressed", "false");
    }
    expect(pressed("Align left")).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(screen.queryByRole("toolbar", { name: "Format" })).toBeNull();
  });

  it("styles the selection from the format bar", async () => {
    const user = userEvent.setup();
    const commands = recordCommands();
    renderCompose();
    await user.click(button("Show Format Bar"));
    select("Low");
    await user.click(pressed("Bold"));
    await user.click(pressed("Strikethrough"));
    await choose(user, "Font family", "Georgia");
    await choose(user, "Font size", "18");
    fireEvent.change(within(bar()).getByLabelText("Text color"), { target: { value: "#ff0000" } });
    await user.click(pressed("Center"));
    // Every command ran with the selection back in the message, not on the control used.
    expect(commands).toEqual([
      ["bold", undefined, true],
      ["strikeThrough", undefined, true],
      ["fontName", "Georgia, serif", true],
      // Any size: the browser's largest, which the shared helper then sets to 18 pt.
      ["fontSize", "7", true],
      ["foreColor", "#ff0000", true],
      ["justifyCenter", undefined, true],
    ]);
  });

  it("runs the keys of Format > Font and Format > Text on the selection, and not in a header field", () => {
    const commands = recordCommands();
    renderCompose();
    select("Low");
    command("b");
    command("i");
    command("u");
    // Bigger and Smaller (Command-plus, typed with or without Shift, and Command-minus).
    command("=");
    command("+", true);
    command("-");
    command("|", true);
    command("}", true);
    command("{", true);
    expect(commands).toEqual([
      ["bold", undefined, true],
      ["italic", undefined, true],
      ["underline", undefined, true],
      ["fontSize", "7", true],
      ["fontSize", "7", true],
      ["fontSize", "7", true],
      ["justifyCenter", undefined, true],
      ["justifyRight", undefined, true],
      ["justifyLeft", undefined, true],
    ]);
    // The Subject field's text has no styles: Command-B is left to it.
    const subject = screen.getByRole("textbox", { name: "Subject:" });
    expect(fireEvent.keyDown(subject, { key: "b", ctrlKey: true })).toBe(true);
    expect(commands).toHaveLength(9);
  });

  it("shows the format where the insertion point is, read from the text", async () => {
    const user = userEvent.setup();
    renderCompose({
      ...DRAFT,
      html:
        "<div>Plain words</div>" +
        '<div style="text-align: center"><u><s><span style="font-weight: bold; font-style: italic; font-family: Georgia, serif; font-size: 18px; color: #ff0000">Styled words</span></s></u></div>' +
        '<div><img src="x" onerror="alert(1)">Unsafe</div>',
    });
    // The draft's styled text, without what formatting does not write.
    expect(messageView().querySelector("img")).toBeNull();
    expect(messageText(messageView())).toBe("Plain words\nStyled words\nUnsafe");

    await user.click(button("Show Format Bar"));
    select("Styled", 2);
    for (const name of ["Bold", "Italic", "Underline", "Strikethrough", "Center"]) {
      expect(pressed(name)).toHaveAttribute("aria-pressed", "true");
    }
    expect(popUp("Font family")).toHaveTextContent("Georgia");
    expect(popUp("Font size")).toHaveTextContent("18");
    expect(within(bar()).getByLabelText("Text color")).toHaveValue("#ff0000");

    // The first character of a selection decides, as in AppKit.
    select("Plain words");
    for (const name of ["Bold", "Italic", "Underline", "Strikethrough", "Center"]) {
      expect(pressed(name)).toHaveAttribute("aria-pressed", "false");
    }
    expect(pressed("Align left")).toHaveAttribute("aria-pressed", "true");
    expect(popUp("Font family")).toHaveTextContent("Helvetica");
    expect(popUp("Font size")).toHaveTextContent("12");
  });

  it("opens the Fonts panel with Command-T, applies what is chosen there, and closes it with Command-T or its close button", async () => {
    const user = userEvent.setup();
    const commands = recordCommands();
    renderCompose();
    select("Low");
    command("t");
    const fonts = screen.getByRole("region", { name: "Fonts" });
    const row = (list: string, name: string) =>
      [
        ...within(fonts)
          .getByRole("listbox", { name: list })
          .querySelectorAll<HTMLElement>("[role=option]"),
      ].find((option) => option.textContent === name) as HTMLElement;
    // The panel shows the format where the insertion point is: Helvetica 12.
    expect(row("Family", "Helvetica")).toHaveAttribute("aria-selected", "true");
    expect(row("Size", "12")).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(row("Family", "Futura"));
    fireEvent.mouseDown(row("Size", "24"));
    fireEvent.change(within(fonts).getByLabelText("Text color"), { target: { value: "#0000ff" } });
    await user.click(within(fonts).getByRole("combobox", { name: "Text underline" }));
    await user.click(await screen.findByRole("option", { name: "Single" }));
    expect(commands).toEqual([
      ["fontName", "Futura, 'Century Gothic', sans-serif", true],
      ["fontSize", "7", true],
      ["foreColor", "#0000ff", true],
      ["underline", undefined, true],
    ]);

    // Command-T again closes it, also from inside the panel, which floats outside the window.
    expect(screen.getByRole("region", { name: "Tides" })).not.toContainElement(fonts);
    fireEvent.keyDown(within(fonts).getByRole("listbox", { name: "Family" }), {
      key: "t",
      ctrlKey: true,
    });
    expect(screen.queryByRole("region", { name: "Fonts" })).toBeNull();
    command("t");
    await user.click(
      within(screen.getByRole("region", { name: "Fonts" })).getByRole("button", { name: "Close" }),
    );
    expect(screen.queryByRole("region", { name: "Fonts" })).toBeNull();
  });

  it("opens the Colors panel with Shift-Command-C, colours the selection, and closes it with the key or its close button", async () => {
    const user = userEvent.setup();
    const commands = recordCommands();
    renderCompose();
    select("Low");
    command("C", true);
    const colors = screen.getByRole("region", { name: "Colors" });
    await user.click(within(colors).getByRole("tab", { name: "Color Palettes" }));
    await user.click(within(colors).getByRole("radio", { name: "Orange" }));
    expect(commands.at(-1)?.[0]).toBe("foreColor");
    expect(commands.at(-1)?.[2]).toBe(true);
    command("C", true);
    expect(screen.queryByRole("region", { name: "Colors" })).toBeNull();
    command("C", true);
    await user.click(
      within(screen.getByRole("region", { name: "Colors" })).getByRole("button", {
        name: "Close",
      }),
    );
    expect(screen.queryByRole("region", { name: "Colors" })).toBeNull();
  });

  it("puts Font and Text in the desktop's Format menu, checked at the insertion point and dimmed while sending", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    function FormatMenu() {
      const items = useDesktopAppMenuItems("mail", "Format");
      return (
        <MenuBar aria-label="Menus">
          <MenuBarMenu title="Format">{items}</MenuBarMenu>
        </MenuBar>
      );
    }
    const commands = recordCommands();
    const styled = {
      ...DRAFT,
      html: '<div style="text-align: right"><b>Low</b> at six.</div><div>High at noon.</div>',
    };
    const { rerender } = render(
      <>
        <FormatMenu />
        <MailCompose defaultDraft={styled} />
      </>,
    );
    select("Low", 1);
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Font" }));
    // Bold is checked where the insertion point is, Italic is not.
    expect(await screen.findByRole("menuitemcheckbox", { name: /^Bold/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemcheckbox", { name: /^Italic/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /^Italic/ }));
    expect(commands).toContainEqual(["italic", undefined, true]);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    // Format > Text: the paragraph's alignment is checked, and another one runs on it.
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Text" }));
    expect(await screen.findByRole("menuitemradio", { name: /^Align Right/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Center/ }));
    expect(commands).toContainEqual(["justifyCenter", undefined, true]);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    // While the message is being sent, or held after a send of unknown outcome, every item is
    // dimmed and runs nothing.
    for (const frozen of [{ sending: true }, { held: true }]) {
      rerender(
        <>
          <FormatMenu />
          <MailCompose defaultDraft={styled} {...frozen} />
        </>,
      );
      const ran = commands.length;
      await user.click(screen.getByRole("menuitem", { name: "Format" }));
      await user.hover(await screen.findByRole("menuitem", { name: "Font" }));
      const bold = await screen.findByRole("menuitemcheckbox", { name: /^Bold/ });
      expect(bold).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(bold);
      expect(commands).toHaveLength(ran);
      // The menu's title closes it again.
      await user.click(screen.getByRole("menuitem", { name: "Format" }));
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    }
  });

  it("gives the desktop's Format menu nothing of Mail's while the viewer is the window last used", async () => {
    function Items() {
      const items = useDesktopAppMenuItems("mail", "Format");
      return <output aria-label="Format items">{items === undefined ? "none" : "some"}</output>;
    }
    render(
      <>
        <Items />
        <Mail />
      </>,
    );
    const items = () => screen.getByRole("status", { name: "Format items" });
    expect(items()).toHaveTextContent("none");
    fireEvent.click(button("New Message"));
    await waitFor(() => expect(items()).toHaveTextContent("some"));
    // A press in the viewer's title bar makes it the window last used: no Format items; a press
    // in the New Message window's gives them back.
    fireEvent.pointerDown(within(viewer()).getByRole("button", { name: "Get Mail" }));
    await waitFor(() => expect(items()).toHaveTextContent("none"));
    fireEvent.pointerDown(within(compose()).getByRole("button", { name: "Show Format Bar" }));
    await waitFor(() => expect(items()).toHaveTextContent("some"));
  });
});

describe("Preferences", () => {
  it("opens with Command-comma as a window of its own and closes with its close button", async () => {
    const user = userEvent.setup();
    const onPreferencesOpenChange = vi.fn();
    render(<Mail onPreferencesOpenChange={onPreferencesOpenChange} />);
    expect(screen.queryByRole("region", { name: "General" })).toBeNull();

    await user.click(message("Harbor Ferry Company"));
    await user.keyboard("{Meta>},{/Meta}");
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(true);
    const preferences = screen.getByRole("region", { name: "General" });
    expect(preferences).toHaveAttribute("data-window-state", "key");
    expect(viewer()).toHaveAttribute("data-window-state", "inactive");

    await user.click(within(preferences).getByRole("button", { name: "Close" }));
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("region", { name: "General" })).toBeNull();
    expect(viewer()).toHaveAttribute("data-window-state", "key");
  });

  it("stands over the viewer until the viewer is pressed, and leaves it no level once closed", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    await user.click(message("Harbor Ferry Company"));
    await user.keyboard("{Meta>},{/Meta}");
    const preferences = screen.getByRole("region", { name: "General" });
    expect(viewer().style.zIndex).toBe("1");
    expect(preferences.style.zIndex).toBe("2");

    fireEvent.pointerDown(viewer());
    expect(viewer().style.zIndex).toBe("1");
    expect(preferences.style.zIndex).toBe("0");

    await user.click(within(preferences).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "General" })).toBeNull();
    expect(viewer().style.zIndex).toBe("");
  });

  it("opens with Command-comma from the New Message window too", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    await user.click(button("New Message"));
    expect(screen.getByRole("combobox", { name: "To:" })).toHaveFocus();
    await user.keyboard("{Control>},{/Control}");
    expect(screen.getByRole("region", { name: "General" })).toHaveAttribute(
      "data-window-state",
      "key",
    );
    expect(compose()).toHaveAttribute("data-window-state", "inactive");
  });

  it("follows the owner when the owner controls it", () => {
    const { rerender } = render(<Mail preferencesOpen={false} />);
    expect(screen.queryByRole("region", { name: "General" })).toBeNull();
    rerender(<Mail preferencesOpen />);
    // Opened by its owner, a menu bar's command say, it comes to the front like any other.
    expect(screen.getByRole("region", { name: "General" })).toHaveAttribute(
      "data-window-state",
      "key",
    );
    expect(viewer()).toHaveAttribute("data-window-state", "inactive");
  });

  it("switches panes from its toolbar, with the mouse and the arrow keys, and retitles the window", async () => {
    const user = userEvent.setup();
    render(<MailPreferences animated={false} />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual([
      "General",
      "Accounts",
      "Junk Mail",
      "Fonts & Colors",
      "Viewing",
      "Composing",
      "Signatures",
      "Rules",
    ]);
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Default email reader:");

    await user.click(screen.getByRole("tab", { name: "Junk Mail" }));
    expect(screen.getByRole("region", { name: "Junk Mail" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Enable junk mail filtering");
    expect(screen.getByRole("tabpanel")).not.toHaveTextContent("Default email reader:");

    // The arrow keys move through the toolbar; Return shows the item's pane.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Fonts & Colors" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("tab", { name: "Fonts & Colors" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Color quoted text");
  });

  it("reports every change of a setting, and holds them itself or follows its owner", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<MailPreferences animated={false} onSettingsChange={onSettingsChange} />);
    const junk = screen.getByRole("checkbox", { name: "Junk" });
    expect(junk).not.toBeChecked();
    await user.click(junk);
    expect(junk).toBeChecked();
    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchJunk: true, searchTrash: true }),
    );

    await user.click(screen.getByRole("combobox", { name: "Check for new messages:" }));
    await user.click(await screen.findByRole("option", { name: "Every hour" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ check: "Every hour", searchJunk: true }),
    );
    expect(screen.getByRole("combobox", { name: "Check for new messages:" })).toHaveTextContent(
      "Every hour",
    );
  });

  it("orders the message list as the Viewing pane says", async () => {
    const user = userEvent.setup();
    render(<Mail defaultPreferencesOpen />);
    expect(messages()[0]).toBe("Harbor Ferry Company");
    await user.click(screen.getByRole("tab", { name: "Viewing" }));
    await user.click(screen.getByRole("checkbox", { name: "Show most recent message at the top" }));
    expect(messages()).toEqual([
      "Otis Brandt",
      "Ines Lindqvist",
      "The Lighthouse Bookshop",
      "Harbor Ferry Company",
    ]);
  });
});

describe("the descriptor", () => {
  it("tells a desktop page how to list and host the app", () => {
    expect(app).toBe(mailApp);
    expect(app.id).toBe("mail");
    expect(app.name).toBe("Mail");
    expect(app.component).toBe(MailLive);
    expect(app.defaultSize).toEqual({ width: 1061, height: 711 });
    expect(app.menus[0]).toBe("Mail");
    expect(app.menus).toContain("Mailbox");
  });
});
