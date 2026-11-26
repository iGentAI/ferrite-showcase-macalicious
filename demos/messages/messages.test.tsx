import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushButton } from "macalicious/push-button";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { discoveredApps, isDesktopApp } from "../desktop/desktop-apps";
import { app, messagesApp } from "./app";
import Desktop from "./examples/desktop";
import { Messages } from "./messages";
import {
  abandon,
  DEFAULT_NOW,
  DEFAULT_SETTINGS,
  isStamp,
  listTime,
  type MessagesConversation,
  matches,
  presentOf,
  stampOf,
  textSizeStep,
  transcriptTime,
} from "./messages-data";
import {
  LIVE,
  MessagesLive,
  MessagesPreferencesLive,
  roomMessagesOf,
  useLiveClock,
} from "./messages-live";
import { MessagesPreferences } from "./messages-preferences";

/**
 * jsdom has no layout, so the list view renders its first rows and nothing scrolls; the
 * popover is placed by Base UI without measurements. Geometry is checked by the visual
 * comparisons in Chromium.
 */
const frame = () => screen.getByRole("region", { name: "Messages" });
const list = () => screen.getByRole("listbox", { name: "Conversations" });
const rows = () => within(list()).getAllByRole("option");
const part = (row: HTMLElement, name: string) =>
  row.querySelector(`.mac-messages-row-${name}`)?.textContent ?? "";
const names = () => rows().map((item) => part(item, "name"));
const row = (name: string) => {
  const found = rows().find((item) => part(item, "name") === name);
  if (!found) throw new Error(`no conversation with ${name}`);
  return found;
};
const transcript = () => screen.getByRole("log");
/** The transcript's items in order: the header's lines, each bubble's text, the status. */
const items = () =>
  within(transcript())
    .getAllByRole("listitem")
    .map((item) => item.textContent);
const field = () => screen.getByRole("textbox", { name: "Message" });
const to = () => screen.getByRole("textbox", { name: "To" });
const search = () => screen.getByRole("searchbox", { name: "Search" });
const button = (name: string) => screen.getByRole("button", { name });
const preferences = () => screen.queryByRole("region", { name: "General" });

const message = (id: string, from: "me" | "them", text: string, at: string) => ({
  id,
  from,
  text,
  at,
});

describe("the window", () => {
  it("is a library window that takes the window's props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Messages ref={ref} state="main" className="mine" data-kind="app" width={900} height={500} />,
    );
    expect(frame()).toBe(ref.current);
    expect(frame()).toHaveClass("mac-window", "mac-messages", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "main");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame()).toHaveStyle({ width: "900px", height: "500px" });
  });

  it("lists the conversations with the one last heard from first, and shows that one", () => {
    render(<Messages />);
    expect(names()).toEqual([
      "Ines Lindqvist",
      "Otis Brandt",
      "Mara Okafor",
      "Tomas Reyes",
      "Harbor Ferry",
    ]);
    expect(rows().map((item) => part(item, "time"))).toEqual([
      "3:27 PM",
      "Yesterday",
      "Friday",
      "9/28/19",
      "9/20/19",
    ]);
    expect(part(row("Ines Lindqvist"), "snippet")).toBe("New macOS, who dis?");
    expect(row("Ines Lindqvist")).toHaveAttribute("aria-selected", "true");
    expect(transcript()).toHaveAccessibleName("Conversation with Ines Lindqvist");
    expect(items()).toEqual([
      "iMessage with Ines Lindqvist Today, 3:26 PM",
      "You Can you believe another year has gone by?!",
      "Delivered",
      "Ines Lindqvist New macOS, who dis?",
    ]);
    expect(field()).toHaveAttribute("placeholder", "iMessage");
    expect(field()).toHaveValue("");
    expect(preferences()).toBeNull();
  });

  it("starts with the conversations, the selection and the present it is given", () => {
    const conversations: MessagesConversation[] = [
      {
        id: "a",
        name: "Ada",
        messages: [{ id: "a-1", from: "them", text: "Lunch?", at: "2024-03-01T12:00" }],
      },
      {
        id: "b",
        name: "Bo",
        service: "sms",
        messages: [{ id: "b-1", from: "me", text: "On my way", at: "2024-03-02T08:30" }],
      },
    ];
    render(
      <Messages
        defaultConversations={conversations}
        defaultConversation="a"
        now="2024-03-02T09:00"
      />,
    );
    // Bo was heard from last and is listed first; Ada is the one shown.
    expect(names()).toEqual(["Bo", "Ada"]);
    expect(part(row("Bo"), "time")).toBe("8:30 AM");
    expect(part(row("Ada"), "time")).toBe("Yesterday");
    expect(row("Ada")).toHaveAttribute("aria-selected", "true");
    expect(items()).toEqual(["iMessage with Ada Yesterday, 12:00 PM", "Ada Lunch?"]);
  });

  it("shows no conversation when it is told to start with none", () => {
    render(<Messages defaultConversation={null} />);
    expect(screen.queryByRole("option", { selected: true })).toBeNull();
    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.getByText("No Conversation Selected")).toBeInTheDocument();
    expect(field()).toBeDisabled();
  });

  it("hands the window controls' and the drag regions' callbacks to those parts", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDrag = vi.fn();
    const onDoubleClick = vi.fn();
    render(
      <Messages
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

    // Messages has no title bar: the strip over the list and the bar over the transcript
    // are what a window is moved by.
    const strip = frame().querySelector(".mac-messages-top") as Element;
    const bar = screen.getByText("To:");
    fireEvent.pointerDown(strip, { button: 0 });
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    expect(onDrag).toHaveBeenCalledTimes(2);
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a control in them is the control's, and so is the secondary button's.
    fireEvent.pointerDown(button("Compose new message"), { button: 0 });
    fireEvent.pointerDown(screen.getByRole("searchbox"), { button: 0 });
    fireEvent.pointerDown(strip, { button: 2 });
    expect(onDrag).toHaveBeenCalledTimes(2);
  });

  it("disables the minimize and zoom buttons when the manager says so", () => {
    render(<Messages minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
  });
});

describe("conversations", () => {
  it("shows the transcript of the conversation that is selected, and sends what is typed into it on Return", async () => {
    const user = userEvent.setup();
    const onConversationChange = vi.fn();
    const onSend = vi.fn();
    render(<Messages onConversationChange={onConversationChange} onSend={onSend} />);

    await user.click(row("Otis Brandt"));
    expect(onConversationChange).toHaveBeenCalledExactlyOnceWith("otis");
    expect(row("Otis Brandt")).toHaveAttribute("aria-selected", "true");
    expect(row("Ines Lindqvist")).toHaveAttribute("aria-selected", "false");
    expect(transcript()).toHaveAccessibleName("Conversation with Otis Brandt");
    expect(items()).toEqual([
      "iMessage with Otis Brandt Yesterday, 6:02 PM",
      "Otis Brandt Are we still on for the ferry on Saturday?",
      "You Yes! The 8:40 crossing. I booked two seats.",
      "You Bring a jacket, the deck is windy.",
      "Delivered",
      "Otis Brandt Perfect. I'll bring the coffee.",
    ]);

    await user.click(field());
    await user.keyboard("See you at the pier{Enter}");

    // The message is the conversation's last bubble, a sent one, under the time of a new
    // day, and the status is under it.
    expect(items().slice(-4)).toEqual([
      "Otis Brandt Perfect. I'll bring the coffee.",
      "Today, 3:27 PM",
      "You See you at the pier",
      "Delivered",
    ]);
    expect(within(transcript()).getAllByText("Delivered")).toHaveLength(1);
    const bubble = within(transcript()).getByText("See you at the pier");
    expect(bubble).toHaveAttribute("data-direction", "sent");
    // Its row says so, with the time it was sent, at the top of the list; the field is empty.
    expect(part(row("Otis Brandt"), "snippet")).toBe("See you at the pier");
    expect(part(row("Otis Brandt"), "time")).toBe("3:27 PM");
    expect(names().slice(0, 2)).toEqual(["Otis Brandt", "Ines Lindqvist"]);
    expect(row("Otis Brandt")).toHaveAttribute("aria-selected", "true");
    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    expect(onSend).toHaveBeenCalledExactlyOnceWith(
      "otis",
      expect.objectContaining({ from: "me", text: "See you at the pier", at: "2019-10-07T15:27" }),
    );

    // Another conversation is as it was.
    expect(part(row("Ines Lindqvist"), "snippet")).toBe("New macOS, who dis?");
    await user.click(row("Ines Lindqvist"));
    expect(items()).toEqual([
      "iMessage with Ines Lindqvist Today, 3:26 PM",
      "You Can you believe another year has gone by?!",
      "Delivered",
      "Ines Lindqvist New macOS, who dis?",
    ]);
  });

  it("does not send a message that is empty or only spaces", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Messages onSend={onSend} />);
    const before = items();
    await user.click(field());
    await user.keyboard("{Enter}");
    await user.keyboard("   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(items()).toEqual(before);
    expect(part(row("Ines Lindqvist"), "snippet")).toBe("New macOS, who dis?");
  });

  it("sends a message without the spaces around it", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    await user.click(field());
    await user.keyboard("  Happy new year  {Enter}");
    expect(items().slice(-2)).toEqual(["You Happy new year", "Delivered"]);
  });

  it("keeps what is typed and not sent with its conversation", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    await user.click(field());
    await user.keyboard("Not yet");
    await user.click(row("Mara Okafor"));
    expect(field()).toHaveValue("");
    await user.click(row("Ines Lindqvist"));
    expect(field()).toHaveValue("Not yet");
  });

  it("sends a text message, not an iMessage, in a conversation that goes by text", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    await user.click(row("Harbor Ferry"));
    expect(field()).toHaveAttribute("placeholder", "Text Message");
    expect(items()[0]).toBe("Text Message with Harbor Ferry Sep 20, 2019, 7:00 AM");
    await user.click(field());
    await user.keyboard("One more seat, please{Enter}");
    expect(within(transcript()).getByText("One more seat, please")).toHaveAttribute(
      "data-service",
      "sms",
    );
  });

  it("moves the selection with the arrow keys, and Return goes to the message field", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    await user.click(row("Ines Lindqvist"));
    await user.keyboard("{ArrowDown}");
    expect(row("Otis Brandt")).toHaveAttribute("aria-selected", "true");
    expect(transcript()).toHaveAccessibleName("Conversation with Otis Brandt");
    await user.keyboard("{Enter}");
    expect(field()).toHaveFocus();
  });

  it("marks a conversation that Details sets to Do Not Disturb", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    expect(within(row("Ines Lindqvist")).queryByRole("img")).toBeNull();
    await user.click(button("Details"));
    await user.click(await screen.findByRole("checkbox", { name: "Do Not Disturb" }));
    expect(
      within(row("Ines Lindqvist")).getByRole("img", { name: "Do Not Disturb" }),
    ).toBeInTheDocument();
    expect(within(row("Otis Brandt")).queryByRole("img")).toBeNull();
  });
});

describe("what it is given", () => {
  it("is a window without conversations, in which the compose button starts the first", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Messages defaultConversations={[]} onSend={onSend} />);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByText("No Conversations")).toBeInTheDocument();
    expect(screen.getByText("No Conversation Selected")).toBeInTheDocument();
    expect(screen.queryByRole("log")).toBeNull();
    expect(field()).toBeDisabled();
    expect(button("Emoji")).toBeDisabled();

    await user.click(button("Compose new message"));
    expect(names()).toEqual(["New Message"]);
    await user.keyboard("Noor{Enter}First one{Enter}");
    expect(names()).toEqual(["Noor"]);
    expect(items()).toEqual(["iMessage with Noor Today, 3:27 PM", "You First one", "Delivered"]);
    expect(onSend).toHaveBeenCalledExactlyOnceWith(
      "new-1",
      expect.objectContaining({ text: "First one" }),
    );
  });

  it("lists a conversation without messages after the others, and sends its first", async () => {
    const user = userEvent.setup();
    render(
      <Messages
        defaultConversations={[
          { id: "z", name: "Zed", messages: [] },
          {
            id: "a",
            name: "Ada",
            messages: [message("a-1", "them", "Lunch?", "2019-10-07T12:00")],
          },
        ]}
      />,
    );
    expect(names()).toEqual(["Ada", "Zed"]);
    expect(part(row("Zed"), "time")).toBe("");
    expect(part(row("Zed"), "snippet")).toBe("");

    await user.click(row("Zed"));
    expect(transcript()).toHaveAccessibleName("Conversation with Zed");
    expect(within(transcript()).queryAllByRole("listitem")).toHaveLength(0);
    // It has a recipient: there is none to type.
    expect(screen.queryByRole("textbox", { name: "To" })).toBeNull();
    await user.click(field());
    await user.keyboard("Hello Zed{Enter}");
    expect(items()).toEqual(["iMessage with Zed Today, 3:27 PM", "You Hello Zed", "Delivered"]);
    expect(names()).toEqual(["Zed", "Ada"]);
    expect(part(row("Zed"), "snippet")).toBe("Hello Zed");
  });

  it("lets the recipient of a conversation given without one be typed, and sends nothing before", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <Messages defaultConversations={[{ id: "n", name: "", messages: [] }]} onSend={onSend} />,
    );
    expect(names()).toEqual(["New Message"]);
    expect(row("New Message")).toHaveAttribute("aria-selected", "true");
    expect(transcript()).toHaveAccessibleName("New conversation");
    // The field is there, and did not take the keyboard from the page.
    expect(to()).toHaveValue("");
    expect(to()).not.toHaveFocus();
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();

    await user.click(field());
    await user.keyboard("Anyone?{Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(within(transcript()).queryAllByRole("listitem")).toHaveLength(0);
    expect(field()).toHaveValue("Anyone?");
    expect(to()).toHaveFocus();

    // The field stays while the name is typed, letter by letter.
    await user.keyboard("Pia{Enter}");
    expect(field()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledExactlyOnceWith(
      "n",
      expect.objectContaining({ text: "Anyone?" }),
    );
    expect(items()).toEqual(["iMessage with Pia Today, 3:27 PM", "You Anyone?", "Delivered"]);
    expect(screen.queryByRole("textbox", { name: "To" })).toBeNull();
    expect(button("Details")).toBeInTheDocument();
  });

  it("shows the conversation last heard from when the one it is told to show is unknown", () => {
    render(<Messages defaultConversation="nobody" />);
    expect(row("Ines Lindqvist")).toHaveAttribute("aria-selected", "true");
    expect(transcript()).toHaveAccessibleName("Conversation with Ines Lindqvist");
    expect(field()).toBeEnabled();
  });

  it.each(["soon", "", "2019-10-07", "2019-02-30T10:00", "2019-10-07T24:00"])(
    "takes a present of %j, which is not a stamp, as the default one",
    async (now) => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<Messages now={now} onSend={onSend} />);
      expect(part(row("Ines Lindqvist"), "time")).toBe("3:27 PM");
      expect(part(row("Otis Brandt"), "time")).toBe("Yesterday");
      expect(items()[0]).toBe("iMessage with Ines Lindqvist Today, 3:26 PM");
      await user.click(field());
      await user.keyboard("Now{Enter}");
      expect(onSend).toHaveBeenCalledExactlyOnceWith(
        "ines",
        expect.objectContaining({ at: DEFAULT_NOW }),
      );
      expect(part(row("Ines Lindqvist"), "time")).toBe("3:27 PM");
    },
  );

  it("stamps what is sent with the minute of a present that has seconds", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Messages now="2019-10-08T09:05:41" onSend={onSend} />);
    expect(part(row("Ines Lindqvist"), "time")).toBe("Yesterday");
    await user.click(field());
    await user.keyboard("Morning{Enter}");
    expect(onSend).toHaveBeenCalledExactlyOnceWith(
      "ines",
      expect.objectContaining({ at: "2019-10-08T09:05" }),
    );
    expect(part(row("Ines Lindqvist"), "time")).toBe("9:05 AM");
  });

  it("keeps the first of two conversations with one id, and lists a message without a stamp last", () => {
    render(
      <Messages
        defaultConversations={[
          { id: "a", name: "Ada", messages: [message("1", "them", "One", "2019-10-01T10:00")] },
          {
            id: "a",
            name: "Ada again",
            messages: [message("1", "them", "Two", "2019-10-02T10:00")],
          },
          { id: "b", name: "Bo", messages: [message("1", "them", "When?", "whenever")] },
        ]}
      />,
    );
    expect(names()).toEqual(["Ada", "Bo"]);
    expect(part(row("Bo"), "time")).toBe("1/1/70");
    expect(items()).toEqual(["iMessage with Ada Tuesday, 10:00 AM", "Ada One"]);
  });

  it("shows both of two messages that were given one id", () => {
    render(
      <Messages
        defaultConversations={[
          {
            id: "a",
            name: "Ada",
            messages: [
              message("same", "them", "One", "2019-10-07T10:00"),
              message("same", "me", "Two", "2019-10-07T10:01"),
              message("same", "me", "Three", "2019-10-07T10:02"),
            ],
          },
        ]}
      />,
    );
    // Each is shown once, and the status is under the last one sent alone.
    expect(items()).toEqual([
      "iMessage with Ada Today, 10:00 AM",
      "Ada One",
      "You Two",
      "You Three",
      "Delivered",
    ]);
  });

  it("gives every message its own key, also when an id looks like another's second", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Messages
        defaultConversations={[
          {
            id: "a",
            name: "Ada",
            messages: [
              message("a", "them", "One", "2019-10-07T10:00"),
              message("a", "them", "Two", "2019-10-07T10:01"),
              message("a#2", "them", "Three", "2019-10-07T10:02"),
              message('["a",2]', "them", "Four", "2019-10-07T10:03"),
            ],
          },
        ]}
      />,
    );
    expect(items()).toEqual([
      "iMessage with Ada Today, 10:00 AM",
      "Ada One",
      "Ada Two",
      "Ada Three",
      "Ada Four",
    ]);
    // React reports two children with one key through console.error.
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "keeps what is typed for a conversation whose id is %s, and sends it",
    async (id) => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      // An id the picture table inherits (constructor, toString…) names no picture: React would
      // report a function given as an <img> src through console.error.
      const error = vi.spyOn(console, "error");
      render(
        <Messages
          onSend={onSend}
          defaultConversations={[
            { id, name: "Ada", messages: [message("1", "them", "One", "2019-10-07T10:00")] },
            { id: "b", name: "Bo", messages: [message("1", "them", "Two", "2019-10-06T10:00")] },
          ]}
        />,
      );
      // Nothing is typed yet: the field is empty, and Return sends nothing.
      expect(field()).toHaveValue("");
      await user.click(field());
      await user.keyboard("{Enter}");
      expect(onSend).not.toHaveBeenCalled();
      // What is typed stays with this conversation while another is shown.
      await user.keyboard("Hello");
      await user.click(row("Bo"));
      expect(field()).toHaveValue("");
      await user.click(row("Ada"));
      expect(field()).toHaveValue("Hello");
      await user.click(button("Emoji"));
      expect(field()).toHaveValue("Hello\u{1F600}");
      await user.keyboard("{Enter}");
      expect(onSend).toHaveBeenCalledExactlyOnceWith(
        id,
        expect.objectContaining({ text: "Hello\u{1F600}", from: "me" }),
      );
      expect(items().slice(-2)).toEqual(["You Hello\u{1F600}", "Delivered"]);
      expect(field()).toHaveValue("");
      expect(error).not.toHaveBeenCalled();
    },
  );
});

describe("search", () => {
  it("takes the text as it is typed: a bracket, a star and a full stop are themselves", () => {
    render(
      <Messages
        defaultConversations={[
          {
            id: "i",
            name: "Ipek",
            messages: [message("i-1", "them", "Total: $5.00 (a+b)*c? [ok]", "2019-10-07T10:00")],
          },
          {
            id: "b",
            name: "Bo",
            messages: [message("b-1", "them", "See you", "2019-10-06T10:00")],
          },
        ]}
      />,
    );
    const find = (text: string) => fireEvent.change(search(), { target: { value: text } });
    for (const text of ["(a+b)*c?", "$5.00", "[ok]", "(", "+"]) {
      find(text);
      expect(names()).toEqual(["Ipek"]);
    }
    // As a pattern a full stop would find every conversation, and ".*" too.
    find(".");
    expect(names()).toEqual(["Ipek"]);
    for (const text of [".*", "\\", "[a-z]", "^See", "you$"]) {
      find(text);
      expect(screen.getByRole("status")).toHaveTextContent("No Results");
    }
  });

  it("finds a name whatever its case and accents, also a letter whose lowercase is longer", () => {
    // U+0130, a dotted capital I: its lowercase form is two characters.
    const dotted = "\u0130pek \u00d6z";
    expect(dotted.toLowerCase()).toHaveLength(dotted.length + 1);
    render(
      <Messages
        defaultConversations={[
          {
            id: "i",
            name: dotted,
            messages: [
              message("i-1", "them", "D\u0130KKAT: caf\u00e9 at nine", "2019-10-07T10:00"),
            ],
          },
          {
            id: "b",
            name: "Bo",
            messages: [message("b-1", "them", "See you", "2019-10-06T10:00")],
          },
        ]}
      />,
    );
    const find = (text: string) => fireEvent.change(search(), { target: { value: text } });
    for (const text of [
      "ipek",
      "IPEK",
      "\u0130PEK",
      "ipek oz",
      "pek \u00f6",
      "dikkat",
      "cafe",
      "CAF\u00c9",
    ]) {
      find(text);
      expect(names()).toEqual([dotted]);
    }
    // The row shows the name as it was given, whole.
    expect(part(row(dotted), "name")).toBe(dotted);
    find("bo");
    expect(names()).toEqual(["Bo"]);
  });

  it("sends into the conversation that is shown, also while the search leaves it out of the list", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Messages onSend={onSend} />);
    await user.type(search(), "mara");
    expect(names()).toEqual(["Mara Okafor"]);
    expect(transcript()).toHaveAccessibleName("Conversation with Ines Lindqvist");

    await user.click(field());
    await user.keyboard("Still here{Enter}");
    expect(onSend).toHaveBeenCalledExactlyOnceWith(
      "ines",
      expect.objectContaining({ text: "Still here" }),
    );
    expect(transcript()).toHaveAccessibleName("Conversation with Ines Lindqvist");
    expect(items().slice(-2)).toEqual(["You Still here", "Delivered"]);
    expect(field()).toHaveValue("");
    // The search is as it was: the conversation written to is still not among its results.
    expect(search()).toHaveValue("mara");
    expect(names()).toEqual(["Mara Okafor"]);
    expect(part(row("Mara Okafor"), "snippet")).toBe(
      "Then I won't say a word about the lighthouse.",
    );

    await user.clear(search());
    expect(names()[0]).toBe("Ines Lindqvist");
    expect(part(row("Ines Lindqvist"), "snippet")).toBe("Still here");
    await user.click(row("Mara Okafor"));
    expect(items()).not.toContain("You Still here");
  });

  it("lists the conversation written to once the message holds the text searched for", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    await user.type(search(), "lighthouse");
    expect(names()).toEqual(["Mara Okafor"]);
    await user.click(field());
    await user.keyboard("Meet me at the lighthouse{Enter}");
    expect(names()).toEqual(["Ines Lindqvist", "Mara Okafor"]);
    expect(row("Ines Lindqvist")).toHaveAttribute("aria-selected", "true");
  });

  it("lists the conversations whose name or messages hold the text", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    const search = screen.getByRole("searchbox", { name: "Search" });
    await user.type(search, "ferry");
    // One by its name, one by a message.
    expect(names()).toEqual(["Otis Brandt", "Harbor Ferry"]);
    await user.clear(search);
    await user.type(search, "MARA");
    expect(names()).toEqual(["Mara Okafor"]);
    // The conversation that is shown stays shown.
    expect(transcript()).toHaveAccessibleName("Conversation with Ines Lindqvist");

    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("No Results");

    await user.clear(search);
    expect(names()).toHaveLength(5);
  });
});

describe("the compose button", () => {
  it("takes a conversation that is given up out of the list and forgets what was typed into it", () => {
    const kept = { id: "otis" };
    const left = abandon(
      {
        conversations: [{ id: "new-1" }, kept],
        unnamed: new Set(["new-1", "n"]),
        texts: new Map([
          ["new-1", "Half a thought"],
          ["otis", "Later"],
        ]),
      },
      "new-1",
    );
    expect(left.conversations).toEqual([kept]);
    expect([...left.unnamed]).toEqual(["n"]);
    // Nothing is kept for a conversation that can never be shown again.
    expect([...left.texts]).toEqual([["otis", "Later"]]);
  });
  it("starts a conversation whose recipient is typed first", async () => {
    const user = userEvent.setup();
    const onConversationChange = vi.fn();
    render(<Messages onConversationChange={onConversationChange} />);
    await user.click(button("Compose new message"));

    expect(names()[0]).toBe("New Message");
    expect(names()).toHaveLength(6);
    expect(row("New Message")).toHaveAttribute("aria-selected", "true");
    expect(onConversationChange).toHaveBeenCalledTimes(1);
    const to = screen.getByRole("textbox", { name: "To" });
    expect(to).toHaveFocus();
    expect(within(transcript()).queryAllByRole("listitem")).toHaveLength(0);
    // There is nothing to see in Details until there is someone to write to.
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();

    // Return in the recipient's field goes on to the message.
    await user.keyboard("Noor Halvorsen{Enter}");
    expect(names()[0]).toBe("Noor Halvorsen");
    expect(field()).toHaveFocus();
    await user.keyboard("Hello from the ferry{Enter}");

    expect(items()).toEqual([
      "iMessage with Noor Halvorsen Today, 3:27 PM",
      "You Hello from the ferry",
      "Delivered",
    ]);
    expect(part(row("Noor Halvorsen"), "snippet")).toBe("Hello from the ferry");
    // Once written to, the conversation is like any other: its recipient is settled.
    expect(screen.queryByRole("textbox", { name: "To" })).toBeNull();
    expect(button("Details")).toBeInTheDocument();
    await user.click(row("Otis Brandt"));
    expect(names()).toHaveLength(6);
  });

  it("does not send to nobody: Return in the message goes back to the recipient", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<Messages onSend={onSend} />);
    await user.click(button("Compose new message"));
    await user.click(field());
    await user.keyboard("Anyone there?{Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(field()).toHaveValue("Anyone there?");
    expect(screen.getByRole("textbox", { name: "To" })).toHaveFocus();
  });

  it("gives up a conversation that was never written to when another is chosen", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    await user.click(button("Compose new message"));
    // Pressed again, it is still the one new conversation.
    await user.click(button("Compose new message"));
    expect(names()).toHaveLength(6);
    await user.click(row("Tomas Reyes"));
    expect(names()).toEqual([
      "Ines Lindqvist",
      "Otis Brandt",
      "Mara Okafor",
      "Tomas Reyes",
      "Harbor Ferry",
    ]);
    expect(transcript()).toHaveAccessibleName("Conversation with Tomas Reyes");
  });

  it("drops what was typed into a conversation that is given up", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    await user.click(button("Compose new message"));
    await user.click(field());
    await user.keyboard("Half a thought");
    expect(field()).toHaveValue("Half a thought");
    // Another conversation is chosen: the new one goes, and its text is not this one's.
    await user.click(row("Tomas Reyes"));
    expect(names()).toHaveLength(5);
    expect(field()).toHaveValue("");
    // The next new conversation starts with nothing typed.
    await user.click(button("Compose new message"));
    expect(names()[0]).toBe("New Message");
    expect(names()).toHaveLength(6);
    expect(field()).toHaveValue("");
  });

  it("ends a search, so that the new conversation is listed", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    await user.type(screen.getByRole("searchbox"), "mara");
    await user.click(button("Compose new message"));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(names()).toHaveLength(6);
  });
});

describe("Preferences", () => {
  it("opens with Command-comma as a window of its own and closes with its close button", async () => {
    const user = userEvent.setup();
    const onPreferencesOpenChange = vi.fn();
    render(<Messages onPreferencesOpenChange={onPreferencesOpenChange} />);
    expect(preferences()).toBeNull();

    await user.click(field());
    await user.keyboard("{Meta>},{/Meta}");
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(true);
    expect(preferences()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");

    // A press on either window brings that one to the front.
    await user.click(row("Otis Brandt"));
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(preferences()).toHaveAttribute("data-window-state", "inactive");
    await user.click(screen.getByRole("tab", { name: "General" }));
    expect(preferences()).toHaveAttribute("data-window-state", "key");

    await user.click(within(preferences() as HTMLElement).getByRole("button", { name: "Close" }));
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(false);
    expect(preferences()).toBeNull();
    expect(frame()).toHaveAttribute("data-window-state", "key");
  });

  it("opens with Control-comma too, also from the Preferences window", async () => {
    const user = userEvent.setup();
    const onPreferencesOpenChange = vi.fn();
    render(<Messages defaultPreferencesOpen onPreferencesOpenChange={onPreferencesOpenChange} />);
    await user.click(row("Otis Brandt"));
    expect(preferences()).toHaveAttribute("data-window-state", "inactive");
    await user.keyboard("{Control>},{/Control}");
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(true);
    expect(preferences()).toHaveAttribute("data-window-state", "key");
  });

  it("follows the owner when the owner controls it", async () => {
    const user = userEvent.setup();
    const onPreferencesOpenChange = vi.fn();
    const { rerender } = render(
      <Messages preferencesOpen={false} onPreferencesOpenChange={onPreferencesOpenChange} />,
    );
    expect(preferences()).toBeNull();
    rerender(<Messages preferencesOpen onPreferencesOpenChange={onPreferencesOpenChange} />);
    // Opened by its owner, a menu bar's command say, it comes to the front like any other.
    expect(preferences()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    // Its close button asks the owner, who has the last word.
    await user.click(within(preferences() as HTMLElement).getByRole("button", { name: "Close" }));
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(false);
    expect(preferences()).not.toBeNull();
  });

  it("stays behind the other application's windows when the app is not in front", () => {
    render(<Messages state="inactive" defaultPreferencesOpen />);
    expect(preferences()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
  });

  it("stacks its two windows by which is in front", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    // Alone, the window has no level of its own.
    expect(frame().style.zIndex).toBe("");
    await user.click(field());
    await user.keyboard("{Meta>},{/Meta}");
    const order = () => [
      Number(frame().style.zIndex),
      Number((preferences() as HTMLElement).style.zIndex),
    ];
    // The Preferences open in front: one level over the window.
    expect(order()).toEqual([1, 2]);
    expect(preferences()).toHaveAttribute("data-front");
    expect(frame()).not.toHaveAttribute("data-front");
    // A press on the window brings it over the Preferences, which stay open under it.
    await user.click(row("Otis Brandt"));
    expect(order()).toEqual([1, 0]);
    expect(frame()).toHaveAttribute("data-front");
    expect(preferences()).not.toHaveAttribute("data-front");
    // And a press on the Preferences brings them back.
    await user.click(screen.getByRole("tab", { name: "General" }));
    expect(order()).toEqual([1, 2]);
    await user.click(within(preferences() as HTMLElement).getByRole("button", { name: "Close" }));
    expect(frame().style.zIndex).toBe("");
  });

  it("stacks the Preferences around the level its owner gave the window", async () => {
    const user = userEvent.setup();
    render(<Messages defaultPreferencesOpen style={{ zIndex: 7 }} />);
    expect(frame().style.zIndex).toBe("7");
    expect((preferences() as HTMLElement).style.zIndex).toBe("8");
    await user.click(row("Otis Brandt"));
    expect(frame().style.zIndex).toBe("7");
    expect((preferences() as HTMLElement).style.zIndex).toBe("6");
  });

  it.each([
    ["100", "101", "99"],
    ["var(--level)", "calc(var(--level) + 1)", "calc(var(--level) - 1)"],
  ])("keeps a level of %s and stacks the Preferences around it", async (level, over, under) => {
    const user = userEvent.setup();
    render(<Messages defaultPreferencesOpen style={{ zIndex: level }} />);
    // The owner's level is the window's, as given, and not replaced by one of the demo's.
    expect(frame().style.zIndex).toBe(level);
    expect((preferences() as HTMLElement).style.zIndex).toBe(over);
    await user.click(row("Otis Brandt"));
    expect(frame().style.zIndex).toBe(level);
    expect((preferences() as HTMLElement).style.zIndex).toBe(under);
  });

  it.each(["auto", "inherit", "initial", "unset", "revert"])(
    "counts a level of %s as none given",
    async (keyword) => {
      const user = userEvent.setup();
      render(<Messages defaultPreferencesOpen style={{ zIndex: keyword }} />);
      expect(frame().style.zIndex).toBe("1");
      expect((preferences() as HTMLElement).style.zIndex).toBe("2");
      await user.click(row("Otis Brandt"));
      expect(frame().style.zIndex).toBe("1");
      expect((preferences() as HTMLElement).style.zIndex).toBe("0");
    },
  );

  it("is rendered into the container it is given, where the window says", () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      <Messages
        defaultPreferencesOpen
        windowsContainer={container}
        preferencesOffset={{ x: 12, y: 34 }}
      />,
    );
    const window = preferences() as HTMLElement;
    expect(container).toContainElement(window);
    // jsdom lays nothing out: both windows are at the origin, so the offset is the place.
    expect(window).toHaveStyle({ position: "absolute", left: "12px", top: "34px" });
    container.remove();
  });

  it("sets the transcript's text to the size its Text size slider is on", async () => {
    const user = userEvent.setup();
    render(<Messages defaultPreferencesOpen />);
    const bubble = () => within(transcript()).getByText("New macOS, who dis?");
    // The captured step leaves the bubbles their own 13 pt.
    expect(bubble().style.fontSize).toBe("");
    const slider = screen.getByRole("slider", { name: "Text size" });
    expect(slider).toHaveValue("3");
    slider.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(slider).toHaveValue("5");
    expect(bubble()).toHaveStyle({ fontSize: "15px" });
    await user.keyboard("{Home}");
    expect(bubble()).toHaveStyle({ fontSize: "10px" });
  });

  it.each([
    [99, "16px"],
    [-4, "10px"],
    [4.4, "14px"],
    [Number.NaN, ""],
    [Number.POSITIVE_INFINITY, ""],
  ])("takes a Text size of %d as a step of the slider", (textSize, fontSize) => {
    render(<Messages defaultSettings={{ ...DEFAULT_SETTINGS, textSize }} />);
    expect(within(transcript()).getByText("New macOS, who dis?").style.fontSize).toBe(fontSize);
  });

  it("leaves the bubble as the library draws it: the size is on the text inside", () => {
    render(<Messages defaultSettings={{ ...DEFAULT_SETTINGS, textSize: 6 }} />);
    const text = within(transcript()).getByText("New macOS, who dis?");
    expect(text).toHaveClass("mac-messages-text");
    const bubble = text.closest(".mac-message-bubble") as HTMLElement;
    expect(bubble).not.toBe(text);
    expect(bubble.getAttribute("style")).toBeNull();
  });

  it("follows the settings its owner holds, and reports what its Preferences change", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(
      <Messages
        defaultPreferencesOpen
        settings={{ ...DEFAULT_SETTINGS, textSize: 5 }}
        onSettingsChange={onSettingsChange}
      />,
    );
    const text = () => within(transcript()).getByText("New macOS, who dis?");
    expect(text()).toHaveStyle({ fontSize: "15px" });
    const slider = screen.getByRole("slider", { name: "Text size" });
    expect(slider).toHaveValue("5");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, textSize: 6 });
    // The owner did not take the change.
    expect(text()).toHaveStyle({ fontSize: "15px" });
  });

  it("shows a choice that is not among its pop-up button's, after them", async () => {
    const user = userEvent.setup();
    render(
      <MessagesPreferences
        animated={false}
        defaultSettings={{ ...DEFAULT_SETTINGS, keep: "Two Weeks" }}
      />,
    );
    const keep = screen.getByRole("combobox", { name: "Keep messages:" });
    expect(keep).toHaveTextContent("Two Weeks");
    await user.click(keep);
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Forever",
      "One Year",
      "30 Days",
      "Two Weeks",
    ]);
  });

  it("switches panes from its toolbar and retitles the window", async () => {
    const user = userEvent.setup();
    render(<MessagesPreferences animated={false} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "General",
      "iMessage",
    ]);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Keep messages:");
    await user.click(screen.getByRole("tab", { name: "iMessage" }));
    expect(screen.getByRole("region", { name: "iMessage" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Enable Messages in iCloud");
    expect(screen.getByRole("tabpanel")).not.toHaveTextContent("Keep messages:");
  });

  it("shows the captured settings, reports every change and holds them itself", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(<MessagesPreferences animated={false} onSettingsChange={onSettingsChange} />);
    const checked = (name: string) => screen.getByRole("checkbox", { name });
    expect(checked("Save history when conversations are closed")).not.toBeChecked();
    expect(checked("Notify me about messages from unknown contacts")).toBeChecked();
    expect(checked("Notify me when my name is mentioned")).not.toBeChecked();
    expect(checked("Play sound effects")).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Keep messages:" })).toHaveTextContent("Forever");
    expect(screen.getByRole("combobox", { name: "Save received files to:" })).toHaveTextContent(
      "Downloads",
    );

    await user.click(checked("Play sound effects"));
    expect(checked("Play sound effects")).not.toBeChecked();
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, playSounds: false });

    await user.click(screen.getByRole("combobox", { name: "Keep messages:" }));
    await user.click(await screen.findByRole("option", { name: "One Year" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SETTINGS,
      playSounds: false,
      keep: "One Year",
    });
    expect(screen.getByRole("combobox", { name: "Keep messages:" })).toHaveTextContent("One Year");
  });

  it("shows the settings its owner holds", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    render(
      <MessagesPreferences
        animated={false}
        settings={{ ...DEFAULT_SETTINGS, saveHistory: true }}
        onSettingsChange={onSettingsChange}
      />,
    );
    const history = screen.getByRole("checkbox", {
      name: "Save history when conversations are closed",
    });
    expect(history).toBeChecked();
    await user.click(history);
    expect(onSettingsChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, saveHistory: false });
    // The owner did not take the change.
    expect(history).toBeChecked();
  });
});

describe("times", () => {
  it("writes a row's time as the hour, Yesterday, the weekday or the date", () => {
    const now = "2019-10-07T15:27";
    expect(listTime("2019-10-07T00:05", now)).toBe("12:05 AM");
    expect(listTime("2019-10-07T12:00", now)).toBe("12:00 PM");
    expect(listTime("2019-10-06T23:59", now)).toBe("Yesterday");
    expect(listTime("2019-10-05T10:00", now)).toBe("Saturday");
    expect(listTime("2019-10-01T10:00", now)).toBe("Tuesday");
    expect(listTime("2019-09-30T10:00", now)).toBe("9/30/19");
    // Across a month's and a year's end the day before is still yesterday.
    expect(listTime("2019-12-31T22:00", "2020-01-01T08:00")).toBe("Yesterday");
    expect(listTime("2020-02-29T22:00", "2020-03-01T08:00")).toBe("Yesterday");
  });

  it("writes a transcript's time with its day", () => {
    const now = "2019-10-07T15:27";
    expect(transcriptTime("2019-10-07T15:26", now)).toBe("Today, 3:26 PM");
    expect(transcriptTime("2019-10-06T15:26", now)).toBe("Yesterday, 3:26 PM");
    expect(transcriptTime("2019-10-04T09:12", now)).toBe("Friday, 9:12 AM");
    expect(transcriptTime("2019-09-28T20:15", now)).toBe("Sep 28, 2019, 8:15 PM");
  });

  it("stamps a date in its local time", () => {
    expect(stampOf(new Date(2024, 0, 5, 9, 7))).toBe("2024-01-05T09:07");
  });

  it("knows a stamp from other text, and a present from none", () => {
    expect(isStamp("2019-10-07T15:27")).toBe(true);
    expect(isStamp("2020-02-29T00:00")).toBe(true);
    expect(isStamp("2019-10-07T15:27:30.250Z")).toBe(true);
    for (const text of [
      "",
      "now",
      "2019-10-07",
      "2019-02-29T10:00",
      "2019-13-01T10:00",
      "2019-10-07T24:00",
      "2019-10-07T10:60",
      " 2019-10-07T15:27",
    ]) {
      expect(isStamp(text)).toBe(false);
    }
    expect(presentOf("2021-06-01T08:00:59")).toBe("2021-06-01T08:00");
    expect(presentOf("yesterday")).toBe(DEFAULT_NOW);
    // A year is the year written, in the first century too: year 0 is a leap year and year 1
    // is not, and the day after the last of year 99 is the first of year 100.
    expect(isStamp("0000-02-29T10:00")).toBe(true);
    expect(isStamp("0001-02-29T10:00")).toBe(false);
    expect(isStamp("0099-12-31T23:59")).toBe(true);
    expect(listTime("0099-12-31T23:59", "0100-01-01T00:01")).toBe("Yesterday");
    expect(transcriptTime("0050-03-01T09:00", "0050-03-01T10:00")).toBe("Today, 9:00 AM");
    expect(transcriptTime("0050-02-28T09:00", "0050-03-01T10:00")).toBe("Yesterday, 9:00 AM");
    // Text that is not a stamp is the oldest moment there is, not a time read out of its digits.
    expect(listTime("at 9", "2019-10-07T15:27")).toBe("1/1/70");
    expect(transcriptTime("at 9", "2019-10-07T15:27")).toBe("Jan 1, 1970, 12:00 AM");
  });

  it("takes a number as the nearest step of the Text size slider", () => {
    expect(
      [0, 3, 6, 2.5, 2.4, -1, 7, Number.NaN, Number.NEGATIVE_INFINITY].map(textSizeStep),
    ).toEqual([0, 3, 6, 3, 2, 0, 6, 3, 3]);
  });

  it("matches the text searched for as text, without regard to case or accents", () => {
    const ada: MessagesConversation = {
      id: "a",
      name: "\u0130da L\u00f6f",
      messages: [message("1", "them", "Is 2+2 (really) 4.0?", "2019-10-07T10:00")],
    };
    for (const text of [
      "",
      "  ",
      "ida",
      "IDA",
      "\u0130",
      "lof",
      "L\u00d6F",
      "2+2",
      "(really)",
      "4.0?",
      " 4.0 ",
    ]) {
      expect(matches(ada, text)).toBe(true);
    }
    for (const text of ["4x0", ".*", "2+3", "idaa", "[0-9]"]) {
      expect(matches(ada, text)).toBe(false);
    }
  });

  it("puts a time over the messages that follow a long silence", async () => {
    const user = userEvent.setup();
    render(<Messages />);
    await user.click(row("Mara Okafor"));
    // The third message came more than an hour after the second.
    expect(items()).toEqual([
      "iMessage with Mara Okafor Friday, 9:12 AM",
      "Mara Okafor Did you finish the book?",
      "You Two chapters to go. No spoilers!",
      "Delivered",
      "Friday, 12:41 PM",
      "Mara Okafor Then I won't say a word about the lighthouse.",
    ]);
  });
});

describe("the descriptor", () => {
  const region = (name: string) => screen.getByRole("region", { name });

  it("is one the desktop can host, and the desktop finds it", () => {
    expect(app).toBe(messagesApp);
    expect(isDesktopApp(app)).toBe(true);
    expect(app.component).toBe(MessagesLive);
    expect(discoveredApps.find((found) => found.id === "messages")).toMatchObject({
      name: "Messages",
      defaultSize: { width: 730, height: 520 },
      menus: ["Messages", "File", "Edit", "View", "Buddies", "Window", "Help"],
    });
  });

  it("names its Preferences window, with the frame it opens at", () => {
    expect(app.preferences).toEqual({
      component: MessagesPreferencesLive,
      defaultSize: { width: 540, height: 309 },
      sharesSettings: true,
    });
  });

  it("has its Preferences hosted by a window manager, beside the window, as a desktop renders them", async () => {
    const user = userEvent.setup();
    render(<Desktop />);
    // Each is the manager's window: the one opened last is in front, at the descriptor's frame.
    const wrapper = region("General").parentElement as HTMLElement;
    expect(wrapper).toHaveAttribute("data-window-id", "messages-preferences");
    expect(wrapper.style.width).toBe("540px");
    expect(wrapper.style.height).toBe("309px");
    expect(region("Messages").parentElement).toHaveAttribute("data-window-id", "messages");
    expect(region("General")).toHaveAttribute("data-window-state", "key");
    expect(region("Messages")).not.toHaveAttribute("data-window-state", "key");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "General",
      "iMessage",
    ]);
    // Its zoom button is disabled and its minimize button is not, as in Messages.
    const controls = within(region("General"));
    expect(controls.getByRole("button", { name: "Minimize" })).toBeEnabled();
    expect(controls.getByRole("button", { name: "Enter Full Screen" })).toBeDisabled();

    // The windows share their settings: the slider sets the transcript's text.
    const text = () => within(transcript()).getByText("New macOS, who dis?");
    expect(text().style.fontSize).toBe("");
    screen.getByRole("slider", { name: "Text size" }).focus();
    await user.keyboard("{End}");
    expect(text()).toHaveStyle({ fontSize: "16px" });

    // A press on a window makes it the key one.
    await user.click(row("Otis Brandt"));
    expect(region("Messages")).toHaveAttribute("data-window-state", "key");
    expect(region("General")).not.toHaveAttribute("data-window-state", "key");
    // Command-comma in the Messages window brings the hosted Preferences to the front, and
    // does not open a second window beside it.
    await user.keyboard("{Meta>},{/Meta}");
    expect(screen.getAllByRole("region", { name: "General" })).toHaveLength(1);
    expect(region("General")).toHaveAttribute("data-window-state", "key");

    // Closed by its close button, it is opened again by the command, with the settings.
    await user.click(within(region("General")).getByRole("button", { name: "Close" }));
    expect(preferences()).toBeNull();
    await user.click(field());
    await user.keyboard("{Meta>},{/Meta}");
    expect(region("General").parentElement).toHaveAttribute(
      "data-window-id",
      "messages-preferences",
    );
    expect(screen.getByRole("slider", { name: "Text size" })).toHaveValue("6");
  });

  it("gives the manager's frame the height the Preferences window has", () => {
    // jsdom has no layout and no ResizeObserver: both are stood in for here.
    const observed: [Element, (entries: unknown[]) => void][] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private notify: (entries: unknown[]) => void) {}
        observe(element: Element) {
          observed.push([element, this.notify]);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      render(<Desktop />);
      const wrapper = region("General").parentElement as HTMLElement;
      expect(wrapper.style.height).toBe("309px");
      const watchers = observed.filter(([element]) => element === region("General"));
      expect(watchers.length).toBeGreaterThan(0);
      Object.defineProperty(region("General"), "offsetHeight", { configurable: true, value: 268 });
      act(() => {
        for (const [, notify] of watchers) notify([]);
      });
      expect(wrapper.style.height).toBe("268px");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("moves the hosted Preferences window by its bar, not by a toolbar item", () => {
    render(<Desktop />);
    const wrapper = region("General").parentElement as HTMLElement;
    const before = wrapper.style.transform;
    const drag = (from: Element) => {
      fireEvent.pointerDown(from, { button: 0, pointerId: 1, clientX: 300, clientY: 100 });
      fireEvent.pointerMove(region("General"), { pointerId: 1, clientX: 340, clientY: 130 });
      fireEvent.pointerUp(region("General"), { pointerId: 1, clientX: 340, clientY: 130 });
    };
    drag(screen.getByRole("tab", { name: "iMessage" }));
    expect(wrapper.style.transform).toBe(before);
    drag(screen.getByRole("tablist", { name: "Messages preferences" }));
    expect(wrapper.style.transform).not.toBe(before);
  });

  it("hands the Preferences window's bar and minimize button to its host, opened on its own too", async () => {
    const user = userEvent.setup();
    const onMinimize = vi.fn();
    const onDrag = vi.fn();
    const onDoubleClick = vi.fn();
    render(
      <MessagesPreferences
        animated={false}
        onMinimize={onMinimize}
        onDragRegionPointerDown={onDrag}
        onDragRegionDoubleClick={onDoubleClick}
        onZoom={() => {}}
        zoomRole="zoom"
        zoomDisabled={false}
      />,
    );
    await user.click(button("Minimize"));
    expect(onMinimize).toHaveBeenCalledTimes(1);
    // A preferences window does not zoom, whatever its host says.
    expect(button("Enter Full Screen")).toBeDisabled();
    const bar = screen.getByRole("tablist", { name: "Messages preferences" });
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    fireEvent.pointerDown(bar, { button: 2 });
    fireEvent.pointerDown(screen.getByRole("tab", { name: "General" }), { button: 0 });
    fireEvent.pointerDown(button("Close"), { button: 0 });
    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
    expect(region("General")).not.toHaveAttribute("zoomrole");
  });
});

describe("held messages", () => {
  const shared: MessagesConversation = { id: "room", name: "Room", messages: [] };

  it("shows the owner's messages and leaves a sent one for the owner to add", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const held = new Map([["room", [message("r1", "them", "Hello from afar", DEFAULT_NOW)]]]);
    const { rerender } = render(
      <Messages defaultConversations={[shared]} heldMessages={held} onSend={onSend} />,
    );
    expect(transcript()).toHaveTextContent("Hello from afar");
    await user.type(field(), "Hi back{Enter}");
    expect(onSend).toHaveBeenCalledWith("room", expect.objectContaining({ text: "Hi back" }));
    // Not added by the window: the owner adds it.
    expect(transcript()).not.toHaveTextContent("Hi back");
    expect(field()).toHaveValue("");
    rerender(
      <Messages
        defaultConversations={[shared]}
        heldMessages={
          new Map([
            [
              "room",
              [
                message("r1", "them", "Hello from afar", DEFAULT_NOW),
                message("r2", "me", "Hi back", DEFAULT_NOW),
              ],
            ],
          ])
        }
        onSend={onSend}
      />,
    );
    expect(transcript()).toHaveTextContent("Hi back");
  });

  it("keeps adding sent messages itself to the conversations it is not given", async () => {
    const user = userEvent.setup();
    const own: MessagesConversation = { id: "own", name: "Own", messages: [] };
    render(
      <Messages
        defaultConversations={[own, shared]}
        defaultConversation="own"
        heldMessages={new Map([["room", []]])}
      />,
    );
    await user.type(field(), "Kept here{Enter}");
    expect(transcript()).toHaveTextContent("Kept here");
  });

  it("says Not Delivered under a refused message, keeps Delivered on the last that arrived, and offers Try Again", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const refused = { ...message("r2", "me", "Lost?", DEFAULT_NOW), undelivered: true };
    render(
      <Messages
        defaultConversations={[shared]}
        heldMessages={new Map([["room", [message("r1", "me", "Arrived", DEFAULT_NOW), refused]]])}
        onRetry={onRetry}
      />,
    );
    // The text stays in the transcript, with the failure under it.
    expect(items().slice(-4)).toEqual([
      "You Arrived",
      "Delivered",
      "You Lost?",
      "Not Delivered Try Again",
    ]);
    await user.click(button("Try Again"));
    expect(onRetry).toHaveBeenCalledWith(
      "room",
      expect.objectContaining({ id: "r2", text: "Lost?" }),
    );
  });

  it("keeps Delivered under the last confirmed message while a newer one is on its way", () => {
    const waiting = { ...message("r2", "me", "On its way", DEFAULT_NOW), pending: true };
    render(
      <Messages
        defaultConversations={[shared]}
        heldMessages={new Map([["room", [message("r1", "me", "Arrived", DEFAULT_NOW), waiting]]])}
      />,
    );
    expect(items().slice(-3)).toEqual(["You Arrived", "Delivered", "You On its way"]);
  });

  it("ends the transcript with the notice its owner gives for the conversation", async () => {
    const reload = vi.fn();
    render(
      <Messages
        defaultConversations={[shared]}
        heldMessages={new Map([["room", [message("r1", "me", "Arrived", DEFAULT_NOW)]]])}
        notices={
          new Map([
            [
              "room",
              <>
                The server cannot read this conversation.{" "}
                <PushButton onClick={reload}>Reload</PushButton>
              </>,
            ],
          ])
        }
      />,
    );
    expect(items().at(-1)).toBe("The server cannot read this conversation. Reload");
    await userEvent.setup().click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reads a feed state without a messages array as a room that cannot be read", () => {
    const stored = { seq: 1, author: "a", name: "Ann", text: "hi", at_ms: 0 };
    expect(roomMessagesOf({ messages: [stored] })).toEqual([stored]);
    expect(roomMessagesOf({ messages: [] })).toEqual([]);
    for (const marker of [{ unreadable: true }, { messages: "x" }, {}, null, undefined, 3]) {
      expect(roomMessagesOf(marker)).toBeNull();
    }
  });

  it("moves a held conversation to the top when a newer message arrives in it", () => {
    const own: MessagesConversation = {
      id: "own",
      name: "Own",
      messages: [message("o1", "them", "Earlier", "2019-10-07T09:00")],
    };
    const { rerender } = render(
      <Messages defaultConversations={[own, shared]} heldMessages={new Map([["room", []]])} />,
    );
    expect(names()).toEqual(["Own", "Room"]);
    rerender(
      <Messages
        defaultConversations={[own, shared]}
        heldMessages={new Map([["room", [message("r1", "them", "Later", DEFAULT_NOW)]]])}
      />,
    );
    expect(names()).toEqual(["Room", "Own"]);
  });

  it("is the plain window, asking no server, when the page is not served with one", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    expect(LIVE).toBe(false);
    render(<MessagesLive />);
    expect(names()).not.toContain("Ferrite Room");
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("gives two quick sends to a held conversation ids of their own", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <Messages
        defaultConversations={[{ id: "room", name: "Room", messages: [] }]}
        heldMessages={new Map([["room", []]])}
        onSend={onSend}
      />,
    );
    await user.click(field());
    await user.keyboard("One{Enter}Two{Enter}");
    const ids = onSend.mock.calls.map((call) => (call[1] as { id: string }).id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("keeps the live present current while idle, across midnight, unless now is given", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2019, 9, 7, 23, 58, 30));
      const { result, rerender } = renderHook(({ now }) => useLiveClock(now), {
        initialProps: { now: undefined as string | undefined },
      });
      expect(result.current).toBe("2019-10-07T23:58");
      act(() => vi.advanceTimersByTime(2 * 60_000));
      expect(result.current).toBe("2019-10-08T00:00");
      rerender({ now: "2019-10-07T15:27" });
      act(() => vi.advanceTimersByTime(5 * 60_000));
      expect(result.current).toBe("2019-10-07T15:27");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Messages desktop text size shortcut", () => {
  it("restores Normal Size with Command-0 while the Messages window is key", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    render(
      <div data-window-id="messages">
        <Messages defaultSettings={{ ...DEFAULT_SETTINGS, textSize: 2 }} />
      </div>,
    );
    const bubble = () => within(transcript()).getByText("New macOS, who dis?");
    expect(bubble()).toHaveStyle({ fontSize: "12px" });
    fireEvent.keyDown(field(), { key: "0", metaKey: true });
    expect(bubble().style.fontSize).toBe("");
  });
});
