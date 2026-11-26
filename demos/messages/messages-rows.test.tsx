import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Messages } from "./messages";
import type { MessagesConversation } from "./messages-data";
import { clipboardPicture, NO_FACETIME } from "./messages-menus";

const word = (id: string, text: string) => ({
  id,
  from: "them" as const,
  text,
  at: "2019-10-07T15:00",
});
const ONE: MessagesConversation[] = [
  {
    id: "a",
    name: "Ada",
    messages: [word("a1", "first words"), word("a2", "second words"), word("a3", "third words")],
  },
];
const bubble = (text: string) =>
  [...document.querySelectorAll<HTMLElement>("[data-message-index]")].find((each) =>
    each.textContent?.includes(text),
  ) as HTMLElement;
const marked = () =>
  [...document.querySelectorAll("[data-marked]")].map((each) => each.textContent);

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("several messages", () => {
  it("Command-click selects and lets go of a message; a plain click lets go of all", () => {
    render(<Messages defaultConversations={ONE} />);
    fireEvent.click(bubble("first words"), { metaKey: true });
    fireEvent.click(bubble("third words"), { ctrlKey: true });
    expect(marked()).toEqual([
      expect.stringContaining("first words"),
      expect.stringContaining("third words"),
    ]);
    fireEvent.click(bubble("first words"), { metaKey: true });
    expect(marked()).toEqual([expect.stringContaining("third words")]);
    fireEvent.click(bubble("second words"));
    expect(marked()).toEqual([]);
  });

  it("Delete asks about those selected and takes them, each from the owner", async () => {
    const onDeleteMessage = vi.fn(async () => true);
    render(<Messages defaultConversations={ONE} onDeleteMessage={onDeleteMessage} />);
    fireEvent.click(bubble("first words"), { metaKey: true });
    fireEvent.click(bubble("second words"), { metaKey: true });
    fireEvent.keyDown(bubble("second words"), { key: "Backspace" });
    await screen.findByText("Are you sure you want to delete these 2 messages?");
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(onDeleteMessage).toHaveBeenCalledTimes(2));
    expect(onDeleteMessage.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      ONE[0]?.messages[0],
      ONE[0]?.messages[1],
    ]);
    expect(marked()).toEqual([]);
  });

  it("a right click on one of them offers Delete 2 Messages…, and Copy takes both", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<Messages defaultConversations={ONE} />);
    fireEvent.click(bubble("first words"), { metaKey: true });
    fireEvent.click(bubble("second words"), { metaKey: true });
    fireEvent.contextMenu(bubble("first words"));
    const menu = await screen.findByRole("menu", { name: "Message commands" });
    within(menu).getByRole("menuitem", { name: "Delete 2 Messages…" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("first words\nsecond words");
  });

  it("a message not among those selected is deleted alone", async () => {
    render(<Messages defaultConversations={ONE} />);
    fireEvent.click(bubble("first words"), { metaKey: true });
    fireEvent.contextMenu(bubble("third words"));
    const menu = await screen.findByRole("menu", { name: "Message commands" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete…" }));
    await screen.findByText("Are you sure you want to delete this message?");
  });
});

describe("a double click on a bubble", () => {
  it("opens the bubble's menu with the owner's tapbacks, for that message", async () => {
    const renderMessageMenu = vi.fn((_: string, message: { text: string }) => (
      <span>{`Tapback for ${message.text}`}</span>
    ));
    render(<Messages defaultConversations={ONE} renderMessageMenu={renderMessageMenu} />);
    fireEvent.doubleClick(bubble("second words"));
    const menu = await screen.findByRole("menu", { name: "Message commands" });
    within(menu).getByText("Tapback for second words");
  });
});

describe("the message field's menu", () => {
  it("offers the editing commands and the text tools on a right click", async () => {
    render(<Messages defaultConversations={ONE} />);
    fireEvent.contextMenu(screen.getByRole("textbox", { name: "Message" }));
    const menu = await screen.findByRole("menu", { name: "Message field commands" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Cut",
      "Copy",
      "Paste",
      "Select All",
      "Spelling and Grammar",
      "Substitutions",
      "Speech",
    ]);
  });

  it("opens the Spelling panel on the field's text, finding its unknown word", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Messages defaultConversations={ONE} />);
    const field = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
    await user.type(field, "hello wrlod");
    fireEvent.keyDown(field, { key: ":", code: "Semicolon", ctrlKey: true, shiftKey: true });
    const panel = await screen.findByRole("dialog", { name: "Spelling and Grammar" });
    await within(panel).findByText("Not in the dictionary: “wrlod”");
    expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe("wrlod");
  });
});

describe("Details", () => {
  const details = async (props: Partial<Parameters<typeof Messages>[0]>) => {
    render(<Messages defaultConversations={ONE} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    return screen.findByRole("dialog");
  };

  it("dims FaceTime, saying why, where there is no one person to call", async () => {
    const popup = await details({ faceTimeWith: () => null });
    for (const name of ["FaceTime Video", "FaceTime Audio"]) {
      const button = within(popup).getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("title")).toBe(NO_FACETIME);
    }
  });

  it("Send My Current Location sends the position into the conversation, leaving the field", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (done: (position: unknown) => void) =>
          done({ coords: { latitude: 1, longitude: 2 } }),
      },
    });
    const onSend = vi.fn();
    const heldMessages = new Map([["a", ONE[0]?.messages ?? []]]);
    const popup = await details({ onSend, heldMessages });
    const field = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "typed" } });
    fireEvent.click(within(popup).getByRole("button", { name: "Send My Current Location" }));
    expect(onSend).toHaveBeenCalledTimes(1);
    const [id, message] = onSend.mock.calls[0] as [string, { text: string }];
    expect(id).toBe("a");
    expect(message.text).toBe("My current location: https://maps.apple.com/?ll=1.00000,2.00000");
    expect(field.value).toBe("typed");
    Reflect.deleteProperty(navigator, "geolocation");
  });
});

describe("what is dragged into a new message", () => {
  const compose = () => {
    render(
      <Messages
        defaultConversations={ONE}
        recipientSuggestions={["Ann Lee (ann)", "Bo Ray (bo)"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Compose new message" }));
  };
  const carrying = (data: Record<string, string>) => ({
    dataTransfer: { getData: (type: string) => data[type] ?? "" },
  });

  it("contacts into To go in with their accounts", () => {
    compose();
    const to = screen.getByRole("textbox", { name: "To" }) as HTMLInputElement;
    fireEvent.drop(to, carrying({ "text/plain": "Ann Lee\nBo Ray" }));
    expect(to.value).toBe("Ann Lee (ann), Bo Ray (bo)");
  });

  it("a bookmark's address into the field goes after what is typed", () => {
    compose();
    const field = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "look" } });
    fireEvent.drop(field, carrying({ "text/uri-list": "https://example.com/" }));
    expect(field.value).toBe("look https://example.com/");
  });

  it("text with its own words is left to the browser", () => {
    compose();
    const field = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
    const handled = !fireEvent.drop(
      field,
      carrying({ "text/uri-list": "https://example.com/", "text/plain": "Example" }),
    );
    expect(handled).toBe(false);
    expect(field.value).toBe("");
  });
});

describe("Edit > Paste with a picture on the clipboard", () => {
  const clipboard = (items: { types: string[]; getType?: () => Promise<Blob> }[]) =>
    ({ read: async () => items }) as unknown as Clipboard;

  it("takes the picture as a file", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const file = await clipboardPicture(
      clipboard([{ types: ["image/png"], getType: async () => blob }]),
    );
    expect(file?.name).toBe("Pasted Image.png");
    expect(file?.type).toBe("image/png");
    expect(file?.size).toBe(1);
  });

  it("leaves text with a picture as text, and answers nothing without `read`", async () => {
    expect(await clipboardPicture(clipboard([{ types: ["text/plain", "image/png"] }]))).toBeNull();
    expect(await clipboardPicture({} as Clipboard)).toBeNull();
  });
});
