import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { DRAFT_MOVE_UNAVAILABLE, Mail } from "./mail";
import type { MailMessage } from "./mail-data";
import { inTurn } from "./mail-live";

const base = {
  from: "Martin",
  to: ["Robin Vega"],
  date: "10/23/26",
  received: "October 23, 2026 at 8:00 AM",
  body: "Meet at the pier.",
};
const MESSAGES: MailMessage[] = [
  { ...base, id: "a", mailbox: "inbox", subject: "First", time: 3, unread: true },
  { ...base, id: "b", mailbox: "inbox", subject: "Second", time: 2, unread: true },
  { ...base, id: "c", mailbox: "inbox", subject: "Third", time: 1 },
  { ...base, id: "t", mailbox: "trash", subject: "Gone", time: 0 },
];

function Menus() {
  return (
    <MenuBar aria-label="Menus">
      {["File", "Edit", "View", "Mailbox", "Message"].map((title) => (
        <OneMenu key={title} title={title} />
      ))}
    </MenuBar>
  );
}
function OneMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("mail", title);
  return <MenuBarMenu title={title}>{items}</MenuBarMenu>;
}

describe("a Redirect whose text is still being read", () => {
  it("leaves alone a New Message window opened meanwhile", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let answer: (body: string) => void = () => {};
    render(
      <>
        <Menus />
        <Mail
          messages={[]}
          defaultMessage={null}
          heldMessages={MESSAGES}
          resolveBody={() => new Promise((resolve) => (answer = resolve))}
        />
      </>,
    );
    await user.click(within(row("First")).getByText("First"));
    await user.click(screen.getByRole("menuitem", { name: "Message" }));
    await user.click(await screen.findByRole("menuitem", { name: /^Redirect/ }));
    await user.click(screen.getByRole("button", { name: "New Message" }));
    const subject = screen.getByLabelText("Subject:");
    await user.type(subject, "Mine");
    answer("Late text");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((screen.getByLabelText("Subject:") as HTMLInputElement).value).toBe("Mine");
    expect(screen.queryByText("Late text")).toBeNull();
  });
});

const row = (subject: string) =>
  within(screen.getByRole("listbox", { name: "Messages" })).getByRole("option", {
    name: new RegExp(subject),
  });
const list = () => screen.getByRole("listbox", { name: "Messages" });
const selectTwo = () => {
  fireEvent.mouseDown(within(row("First")).getByText("First"));
  fireEvent.mouseUp(within(row("First")).getByText("First"));
  fireEvent.mouseDown(within(row("Second")).getByText("Second"), { ctrlKey: true });
  fireEvent.mouseUp(within(row("Second")).getByText("Second"), { ctrlKey: true });
};
const setup = () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <>
      <Menus />
      <Mail messages={MESSAGES} defaultMessage={null} />
    </>,
  );
  return user;
};
const openMenu = (user: ReturnType<typeof setup>, title: string) =>
  user.click(screen.getByRole("menuitem", { name: title }));

describe("several messages selected", () => {
  it("says how many, reads none of them, and dims Reply", () => {
    setup();
    fireEvent.mouseDown(within(row("Second")).getByText("Second"));
    fireEvent.mouseDown(within(row("Third")).getByText("Third"), { ctrlKey: true });
    expect(screen.getByText("2 Messages Selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toHaveAttribute("aria-disabled", "true");
    // The press on Second alone read it; First was never selected, so it is unread still.
    expect(within(row("First")).getByLabelText("Unread")).toBeInTheDocument();
  });

  it("moves them together, and Undo brings them back", async () => {
    const user = setup();
    selectTwo();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.queryByRole("option", { name: /First/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Second/ })).not.toBeInTheDocument();
    fireEvent.keyDown(list(), { key: "z", ctrlKey: true });
    expect(row("First")).toBeInTheDocument();
    expect(row("Second")).toBeInTheDocument();
  });

  it("keeps the selection for a drag when a selected row is pressed, and selects it alone on release", () => {
    setup();
    selectTwo();
    const second = within(row("Second")).getByText("Second");
    fireEvent.mouseDown(second);
    expect(screen.getByText("2 Messages Selected")).toBeInTheDocument();
    fireEvent.mouseUp(second);
    expect(screen.queryByText("2 Messages Selected")).not.toBeInTheDocument();
  });

  it("moves what is dragged onto a mailbox", () => {
    setup();
    selectTwo();
    const data = new Map<string, string>();
    const dataTransfer = {
      types: ["application/x-macalicious-mail"],
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
    };
    fireEvent.dragStart(row("First"), { dataTransfer });
    expect(JSON.parse(data.get("application/x-macalicious-mail") ?? "[]")).toEqual(["a", "b"]);
    const trash = within(screen.getByRole("tree", { name: "Mailboxes" })).getByRole("treeitem", {
      name: /^Trash/,
    });
    fireEvent.dragOver(trash, { dataTransfer });
    expect(trash).toHaveAttribute("data-drop-target");
    fireEvent.drop(trash, { dataTransfer });
    expect(trash).not.toHaveAttribute("data-drop-target");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});

describe("the menu bar's commands", () => {
  it("marks messages unread from the Message menu, and its key takes it back", async () => {
    const user = setup();
    fireEvent.mouseDown(within(row("Third")).getByText("Third"));
    await openMenu(user, "Message");
    await user.hover(await screen.findByRole("menuitem", { name: "Mark" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^As Unread/ }));
    expect(within(row("Third")).getByLabelText("Unread")).toBeInTheDocument();
    fireEvent.keyDown(list(), { key: "u", ctrlKey: true, shiftKey: true });
    expect(within(row("Third")).queryByLabelText("Unread")).not.toBeInTheDocument();
  });

  it("goes to a mailbox with its key, and leaves a text field's Select All to the field", () => {
    setup();
    fireEvent.keyDown(list(), { key: "2", ctrlKey: true });
    const window = screen.getByRole("region", { name: "Sent (0 messages)" });
    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    const search = screen.getByRole("searchbox");
    fireEvent.keyDown(search, { key: "a", ctrlKey: true });
    expect(screen.queryByText("3 Messages Selected")).not.toBeInTheDocument();
    fireEvent.keyDown(list(), { key: "a", ctrlKey: true });
    expect(screen.getByText("3 Messages Selected")).toBeInTheDocument();
  });

  it("asks before Erase Deleted Items, and erases only on Erase", async () => {
    const user = setup();
    await openMenu(user, "Mailbox");
    await user.click(await screen.findByRole("menuitem", { name: /Erase Deleted Items/ }));
    const alert = await screen.findByRole("alertdialog");
    await user.click(within(alert).getByRole("button", { name: "Cancel" }));
    const tree = screen.getByRole("tree", { name: "Mailboxes" });
    expect(within(tree).getByRole("treeitem", { name: /^Trash/ })).toBeInTheDocument();
    await openMenu(user, "Mailbox");
    await user.click(await screen.findByRole("menuitem", { name: /Erase Deleted Items/ }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Erase" }),
    );
    await waitFor(() =>
      expect(within(tree).queryByRole("treeitem", { name: /^Trash/ })).not.toBeInTheDocument(),
    );
  });

  it("orders the list from View > Sort By", async () => {
    const user = setup();
    const subjects = () =>
      screen
        .getAllByRole("option")
        .map((option) => option.querySelector(".mac-mail-row-subject")?.textContent);
    expect(subjects()).toEqual(["First", "Second", "Third"]);
    await openMenu(user, "View");
    await user.hover(await screen.findByRole("menuitem", { name: "Sort By" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Ascending" }));
    expect(subjects()).toEqual(["Third", "Second", "First"]);
  });
});

describe("the contextual menus", () => {
  it("selects the row pressed and acts on it", async () => {
    const user = setup();
    fireEvent.contextMenu(row("Third"));
    expect(await screen.findByRole("menu", { name: "Message commands" })).toBeInTheDocument();
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(screen.queryByRole("option", { name: /Third/ })).not.toBeInTheDocument();
  });

  it("marks a mailbox's messages read from its row", async () => {
    const user = setup();
    const inbox = within(screen.getByRole("tree", { name: "Mailboxes" })).getByRole("treeitem", {
      name: /^Inbox/,
    });
    expect(inbox).toHaveTextContent("Inbox2");
    fireEvent.contextMenu(inbox);
    await user.click(await screen.findByRole("menuitem", { name: "Mark All Messages as Read" }));
    expect(inbox).toHaveTextContent(/^Inbox$/);
  });
});

describe("the keys", () => {
  it("says Copy failed when the browser has no clipboard", async () => {
    render(<Mail messages={MESSAGES} defaultMessage="c" />);
    delete (navigator as { clipboard?: unknown }).clipboard;
    fireEvent.keyDown(list(), { key: "c", ctrlKey: true });
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("could not be copied");
  });

  it("moves all of a selection or none: a draft among them dims Archive and says why", () => {
    const draft: MailMessage = { ...base, id: "d", mailbox: "drafts", subject: "Pier", time: 9 };
    const inbox: MailMessage = { ...base, id: "e", mailbox: "inbox", subject: "Pier too", time: 8 };
    render(<Mail messages={[draft, inbox]} defaultMessage={null} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pier" } });
    fireEvent.mouseDown(within(row("Pier too")).getByText("Pier too"));
    const first = screen.getAllByRole("option")[0] as HTMLElement;
    fireEvent.mouseDown(first.querySelector(".mac-mail-row-subject") as Element, { ctrlKey: true });
    expect(screen.getByRole("button", { name: "Archive" })).toHaveAttribute(
      "title",
      DRAFT_MOVE_UNAVAILABLE,
    );
  });

  it("never has more than six requests under way, however they interleave", async () => {
    let running = 0;
    let most = 0;
    const ends: (() => void)[] = [];
    const request = () =>
      new Promise<void>((resolve) => {
        running += 1;
        most = Math.max(most, running);
        ends.push(() => {
          running -= 1;
          resolve();
        });
      });
    const all = Array.from({ length: 8 }, () => inTurn(request));
    await Promise.resolve();
    expect(running).toBe(6);
    // One ends, and a new request arrives before the waiter it woke has run.
    ends.shift()?.();
    all.push(inTurn(request));
    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
    expect(most).toBe(6);
    while (ends.length > 0) {
      ends.shift()?.();
      for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
    }
    await Promise.all(all);
    expect(most).toBe(6);
  });

  it("leaves a selected Trash message alone when Shift-Command-Delete asks first", async () => {
    const onErase = vi.fn();
    render(
      <Mail
        messages={[]}
        defaultMailbox="trash"
        defaultMessage={null}
        heldMessages={MESSAGES}
        onErase={onErase}
      />,
    );
    fireEvent.mouseDown(within(row("Gone")).getByText("Gone"));
    fireEvent.keyDown(list(), { key: "Backspace", ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(onErase).not.toHaveBeenCalled();
  });

  it("sends from a New Message window's own key on a page", async () => {
    render(<Mail messages={MESSAGES} defaultMessage={null} />);
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));
    const compose = await screen.findByRole("region", { name: "New Message" });
    const to = within(compose).getByLabelText("To:");
    fireEvent.change(to, { target: { value: "Ada Moreno" } });
    fireEvent.keyDown(to, { key: "Enter" });
    fireEvent.keyDown(within(compose).getByLabelText("Subject:"), {
      key: "d",
      ctrlKey: true,
      shiftKey: true,
    });
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "New Message" })).not.toBeInTheDocument(),
    );
    fireEvent.keyDown(list(), { key: "2", ctrlKey: true });
    expect(screen.getByRole("region", { name: "Sent (1 message)" })).toBeInTheDocument();
  });

  it("offers Send Again, not Send, while the viewer is key with a New Message window behind it", async () => {
    const user = setup();
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));
    await screen.findByRole("region", { name: "New Message" });
    await openMenu(user, "Message");
    expect(await screen.findByRole("menuitem", { name: /^Send\b(?! Again)/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Get Mail" }));
    await openMenu(user, "Message");
    expect(await screen.findByRole("menuitem", { name: /^Send Again/ })).toBeInTheDocument();
  });

  it("copies the selected messages with Command-C", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.mouseDown(within(row("Third")).getByText("Third"));
    fireEvent.keyDown(list(), { key: "c", ctrlKey: true });
    expect(writeText).not.toHaveBeenCalledWith("");
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Martin\nThird\n\nMeet at the pier."),
    );
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  it("cuts the selected messages to the Trash, by the Edit item and by Command-X, and Undo brings them back", async () => {
    const user = setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.mouseDown(within(row("Third")).getByText("Third"));
    await openMenu(user, "Edit");
    await user.click(await screen.findByRole("menuitem", { name: /^Cut/ }));
    await waitFor(() => expect(screen.queryByRole("option", { name: /Third/ })).toBeNull());
    expect(writeText).toHaveBeenCalledExactlyOnceWith("Martin\nThird\n\nMeet at the pier.");
    await openMenu(user, "Edit");
    await user.click(await screen.findByRole("menuitem", { name: /^Undo Delete/ }));
    await waitFor(() => expect(row("Third")).toBeInTheDocument());
    fireEvent.mouseDown(within(row("Second")).getByText("Second"));
    fireEvent.keyDown(list(), { key: "x", ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole("option", { name: /Second/ })).toBeNull());
    expect(writeText).toHaveBeenLastCalledWith("Martin\nSecond\n\nMeet at the pier.");
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  it("keeps a message Cut could not put on the clipboard, and says so", async () => {
    const user = setup();
    const writeText = vi.fn().mockRejectedValue(new Error("refused"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.mouseDown(within(row("Third")).getByText("Third"));
    await openMenu(user, "Edit");
    await user.click(await screen.findByRole("menuitem", { name: /^Cut/ }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("could not be copied");
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(row("Third")).toBeInTheDocument();
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  it("dims the viewer's Paste, and says why", async () => {
    const user = setup();
    await openMenu(user, "Edit");
    const paste = await screen.findByRole("menuitem", { name: /^Paste/ });
    expect(paste).toHaveAttribute("aria-disabled", "true");
    expect(paste).toHaveAttribute("title", "Mail pastes into a message you are writing.");
  });

  it("copies the whole text of held messages, and nothing when one cannot be read", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const resolveBody = vi.fn(async (message: MailMessage) =>
      message.id === "c" ? null : `whole ${message.subject}`,
    );
    render(
      <Mail
        messages={[]}
        defaultMessage={null}
        heldMessages={MESSAGES}
        resolveBody={resolveBody}
      />,
    );
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    selectTwo();
    fireEvent.keyDown(list(), { key: "c", ctrlKey: true });
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "Martin\nFirst\n\nwhole First\n\nMartin\nSecond\n\nwhole Second",
      ),
    );
    writeText.mockClear();
    fireEvent.mouseDown(within(row("Third")).getByText("Third"));
    fireEvent.keyDown(list(), { key: "c", ctrlKey: true });
    await waitFor(() => expect(resolveBody).toHaveBeenCalledTimes(3));
    await new Promise((resolve) => setTimeout(resolve));
    expect(writeText).not.toHaveBeenCalled();
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "The messages could not be copied.",
    );
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  it("offers no erasing of held messages whose owner cannot erase", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <Menus />
        <Mail messages={[]} defaultMessage={null} heldMessages={MESSAGES} />
      </>,
    );
    await openMenu(user, "Mailbox");
    expect(await screen.findByRole("menuitem", { name: /Erase Deleted Items/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");
    fireEvent.keyDown(list(), { key: "Backspace", ctrlKey: true, shiftKey: true });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

it("reports each message's change to the owner of held messages", () => {
  const onMessageChange = vi.fn();
  render(
    <Mail
      messages={[]}
      defaultMessage={null}
      heldMessages={MESSAGES}
      onMessageChange={onMessageChange}
    />,
  );
  selectTwo();
  fireEvent.click(screen.getByRole("button", { name: "Junk" }));
  expect(onMessageChange).toHaveBeenCalledWith("a", { mailbox: "junk" });
  expect(onMessageChange).toHaveBeenCalledWith("b", { mailbox: "junk" });
});
