import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { Mail } from "./mail";
import { MailCompose } from "./mail-compose";
import type { MailMessage } from "./mail-data";
import { MailMessageWindow } from "./mail-message-window";
import { photoFile, recentPhotos } from "./mail-photo-browser";
import { MailAccountPane, MailBlockedPane } from "./mail-preference-panes";
import { listFontStyle, MailPreferences, SERVED_SETTING_REASONS } from "./mail-preferences";
import {
  checkEvery,
  checksByChoice,
  inMailboxOrder,
  movedBefore,
  readMailRoles,
} from "./mail-saved";
import { readMailStationery, STATIONERY_TOO_LARGE, withStationery } from "./mail-stationery";
import { readHiddenTools } from "./mail-toolbar-sheet";

const base = {
  from: "Martin",
  fromAddress: "Martin Ng <martin@macalicious>",
  to: ["Robin Vega"],
  date: "10/23/26",
  received: "October 23, 2026 at 8:00 AM",
  body: "Meet at the pier.",
};
const FIRST: MailMessage = {
  ...base,
  id: "a",
  mailbox: "inbox",
  subject: "First",
  time: 3,
  attachmentCount: 2,
};
const MESSAGES: MailMessage[] = [
  FIRST,
  { ...base, id: "b", mailbox: "inbox", subject: "Second", time: 2 },
];
const TRIPS = { id: "box-aaaaaaaaaaaaaaaa" as const, name: "Trips" };
const BILLS = { id: "box-bbbbbbbbbbbbbbbb" as const, name: "Bills" };
const BOXES = [TRIPS, BILLS];

function OneMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("mail", title);
  return <MenuBarMenu title={title}>{items}</MenuBarMenu>;
}
const Menus = () => (
  <MenuBar aria-label="Menus">
    {["File", "View", "Mailbox", "Message"].map((title) => (
      <OneMenu key={title} title={title} />
    ))}
  </MenuBar>
);
const row = (subject: string) =>
  within(screen.getByRole("listbox", { name: "Messages" })).getByRole("option", {
    name: new RegExp(subject),
  });
const choose = async (user: ReturnType<typeof userEvent.setup>, menu: string, name: RegExp) => {
  await user.click(screen.getByRole("menuitem", { name: menu }));
  await user.click(await screen.findByRole("menuitem", { name }));
};

describe("Message > Remove Attachments", () => {
  it("asks, then hands over the messages selected, and is dimmed on one with no files", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const remove = vi.fn();
    render(
      <>
        <Menus />
        <Mail
          messages={[]}
          defaultMessage={null}
          heldMessages={MESSAGES}
          onRemoveAttachments={remove}
        />
      </>,
    );
    await user.click(within(row("Second")).getByText("Second"));
    await user.click(screen.getByRole("menuitem", { name: "Message" }));
    expect(await screen.findByRole("menuitem", { name: /^Remove Attachments/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");
    await user.click(within(row("First")).getByText("First"));
    await choose(user, "Message", /^Remove Attachments/);
    expect(remove).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    expect(remove.mock.calls[0]?.[0].map((each: MailMessage) => each.id)).toEqual(["a"]);
  });
});

describe("View > Customize Toolbar", () => {
  it("takes an item out of the toolbar at once, and Use Default Set brings it back", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <Menus />
        <Mail />
      </>,
    );
    const mute = () => screen.getByRole("button", { name: "Mute", hidden: true });
    expect(mute()).not.toHaveAttribute("data-mail-tool");
    await choose(user, "View", /^Customize Toolbar/);
    await user.click(await screen.findByRole("checkbox", { name: "Mute" }));
    expect(mute()).toHaveAttribute("data-mail-tool", "hidden");
    await user.click(screen.getByRole("button", { name: "Use Default Set" }));
    expect(mute()).not.toHaveAttribute("data-mail-tool");
  });

  it("reads what was kept, and leaves out what Mail did not write", () => {
    expect(readHiddenTools(["mute", "nonsense", 3])).toEqual(["mute"]);
    expect(readHiddenTools(undefined)).toEqual([]);
  });
});

describe("Mailbox > Use This Mailbox For", () => {
  it("sends Archive to the mailbox chosen, on a mailbox you made", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const change = vi.fn();
    render(
      <>
        <Menus />
        <Mail
          messages={[]}
          defaultMessage={null}
          heldMessages={[
            ...MESSAGES,
            { ...base, id: "t", mailbox: TRIPS.id, subject: "Ferry", time: 1 },
          ]}
          heldMailboxes={BOXES}
          defaultMailbox={TRIPS.id}
          onMessageChange={change}
        />
      </>,
    );
    await user.click(screen.getByRole("menuitem", { name: "Mailbox" }));
    await user.click(await screen.findByRole("menuitem", { name: "Use This Mailbox For" }));
    expect(await screen.findByRole("menuitem", { name: "Drafts" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const archive = await screen.findByRole("menuitemcheckbox", { name: "Archive" });
    archive.focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("treeitem", { name: /^Inbox/ }));
    await user.click(within(row("Second")).getByText("Second"));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(change).toHaveBeenCalledWith("b", { mailbox: TRIPS.id });
  });

  it("takes what is deleted to the mailbox standing in for the Trash, and erases through the Trash", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const change = vi.fn();
    const erased = vi.fn();
    const messages = [
      ...MESSAGES,
      { ...base, id: "t", mailbox: TRIPS.id, subject: "Ferry", time: 1 },
    ];
    render(
      <>
        <Menus />
        <Mail
          messages={[]}
          defaultMessage={null}
          heldMessages={messages}
          heldMailboxes={BOXES}
          defaultMailbox={TRIPS.id}
          onMessageChange={change}
          onErase={erased}
        />
      </>,
    );
    await user.click(screen.getByRole("menuitem", { name: "Mailbox" }));
    await user.click(await screen.findByRole("menuitem", { name: "Use This Mailbox For" }));
    const trash = await screen.findByRole("menuitemcheckbox", { name: "Trash" });
    trash.focus();
    await user.keyboard("{Enter}");
    await user.click(within(row("Ferry")).getByText("Ferry"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(change).toHaveBeenCalledWith("t", { mailbox: "trash" });
    expect(erased).toHaveBeenCalledWith("t");
    await user.click(screen.getByRole("treeitem", { name: /^Inbox/ }));
    await user.click(within(row("Second")).getByText("Second"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(change).toHaveBeenCalledWith("b", { mailbox: TRIPS.id });
  });

  it("keeps only what can be a mailbox of the person's", () => {
    expect(readMailRoles({ archive: "box-1", junk: "inbox", sent: "box-2", trash: 3 })).toEqual({
      archive: "box-1",
      sent: "box-2",
    });
    expect(readMailRoles(null)).toEqual({});
  });
});

describe("File > Import Mailboxes", () => {
  it("hands the file's messages over under the file's name, and says how many", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const imported = vi.fn(async () => ({ made: 1, refused: 0 }));
    render(
      <Mail
        messages={[]}
        defaultMessage={null}
        heldMessages={MESSAGES}
        onImportMailbox={imported}
      />,
    );
    const file = new File(
      ["From a@b.c Thu Jan  2 03:04:05 2020\nSubject: Old\n\nHello\n"],
      "Trips.mbox",
    );
    await user.upload(screen.getByLabelText("Mailbox file to import"), file);
    await waitFor(() => expect(imported).toHaveBeenCalled());
    const [name, messages] = imported.mock.calls[0] as unknown as [string, { subject: string }[]];
    expect(name).toBe("Trips");
    expect(messages.map(({ subject }) => subject)).toEqual(["Old"]);
    expect(await screen.findByText("Imported 1 message into “Trips”.")).toBeInTheDocument();
  });

  it("says so when the file holds no messages, and imports nothing", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const imported = vi.fn(async () => ({ made: 0, refused: 0 }));
    render(
      <Mail
        messages={[]}
        defaultMessage={null}
        heldMessages={MESSAGES}
        onImportMailbox={imported}
      />,
    );
    await user.upload(
      screen.getByLabelText("Mailbox file to import"),
      new File(["notes"], "notes.mbox"),
    );
    expect(await screen.findByText("Mail found no messages in “notes.mbox”.")).toBeInTheDocument();
    expect(imported).not.toHaveBeenCalled();
  });
});

describe("the mailboxes' order", () => {
  it("lands a mailbox before the one it is dropped on, and lists a new one last", () => {
    expect(movedBefore(BOXES, BILLS.id, TRIPS.id)).toEqual([BILLS.id, TRIPS.id]);
    expect(inMailboxOrder(BOXES, [BILLS.id]).map(({ name }) => name)).toEqual(["Bills", "Trips"]);
  });
});

describe("Check for new messages", () => {
  it("looks by the clock for the timed choices only, and leaves deliveries alone unless Automatic", () => {
    expect(checkEvery({ check: "Every 5 minutes" })).toBe(300_000);
    expect(checkEvery({ check: "Manually" })).toBeNull();
    expect(checkEvery({ check: "Automatically" })).toBeNull();
    expect(checksByChoice({ check: "Manually" })).toBe(true);
    expect(checksByChoice({ check: "Automatically" })).toBe(false);
    expect(checksByChoice({})).toBe(false);
  });
});

describe("Preferences", () => {
  it("dims what a served desktop cannot do and says why, and acts on the rest", () => {
    render(<MailPreferences defaultValue="general" settingReasons={SERVED_SETTING_REASONS} />);
    const send = screen.getByRole("checkbox", { name: "Encrypted Messages" });
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send.closest("[title]") ?? send).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: "Automatically try sending later if outgoing server is unavailable",
      }),
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("checkbox", { name: "Add invitations to Calendar automatically" }),
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: "Downloads folder:" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("checkbox", { name: "Archive or delete muted messages" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("Accounts names the person's own account", () => {
    render(<MailAccountPane me="Robin Vega <robin@macalicious>" />);
    expect(screen.getByText("Robin Vega")).toBeInTheDocument();
    expect(screen.getByText("robin@macalicious")).toBeInTheDocument();
  });

  it("Junk Mail lists who is blocked, and takes one off", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const change = vi.fn();
    render(
      <MailBlockedPane
        blocked={[{ address: "ada@macalicious", name: "Ada" }]}
        toTrash={false}
        onChange={change}
        onToTrashChange={() => {}}
      />,
    );
    await user.click(screen.getByRole("option", { name: /Ada \(ada@macalicious\)/ }));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(change).toHaveBeenCalledWith([]);
  });

  it("Fonts & Colors sets the message list's font only once one is chosen", () => {
    expect(listFontStyle({})).toBeUndefined();
    expect(
      (listFontStyle({ listFont: "Georgia", listSize: "11" }) as Record<string, string>)[
        "--mac-mail-list-font"
      ],
    ).toMatch(/^11px .*Georgia/);
  });
});

describe("stationery", () => {
  const draft = { to: [], cc: [], subject: "Trip", body: "Hi", html: "<div>Hi</div>" };

  it("keeps a message under a name, replacing one of that name", () => {
    const kept = withStationery([], "Trip", draft);
    expect(kept).toEqual([{ name: "Trip", subject: "Trip", html: "<div>Hi</div>" }]);
    expect(withStationery(kept ?? [], "Trip", { ...draft, html: "<b>2</b>" })).toEqual([
      { name: "Trip", subject: "Trip", html: "<b>2</b>" },
    ]);
    expect(readMailStationery([{ name: "x" }, ...(kept ?? [])])).toEqual(kept);
  });

  it("refuses what the setting cannot hold, and the alert says so", () => {
    expect(withStationery([], "Long", { ...draft, html: "x".repeat(5_000) })).toBeNull();
    expect(STATIONERY_TOO_LARGE).toMatch(/4 KB/);
  });

  it("goes before what the message holds, and fills an empty subject", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <MailCompose
        defaultDraft={{ to: [], cc: [], subject: "", body: "Mine" }}
        stationery={[{ name: "Trip", subject: "To the island", html: "<div>Dear all</div>" }]}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Stationery" }));
    await user.click(await screen.findByRole("option", { name: "Trip" }));
    expect(screen.getByLabelText<HTMLInputElement>("Subject:").value).toBe("To the island");
    const message = document.querySelector(".mac-mail-compose-message");
    expect(message?.textContent).toBe("Dear allMine");
  });
});

describe("a person in a message's Details", () => {
  it("is a token with a menu, in the line as it reads", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <MailMessageWindow
        message={{ ...FIRST, to: ["Robin", "Jo"], toAddresses: ["r@macalicious", "j@macalicious"] }}
        canReply
        onReply={() => {}}
        onDelete={() => {}}
        onNewMessage={() => {}}
        onPrint={() => {}}
        onRedirect={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("article")).toHaveTextContent("To: Robin, Jo");
    fireEvent.contextMenu(screen.getByText("Jo"));
    expect(await screen.findByRole("menuitem", { name: "New Email" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy Address" })).toBeInTheDocument();
  });
});

describe("the Photo Browser", () => {
  const photo = {
    id: "p",
    file: "f1",
    name: "IMG_1",
    title: null,
    mime: "image/jpeg",
    bytes: 10,
    taken_ms: 5,
    deleted_ms: null,
    hidden: false,
  } as unknown as Parameters<typeof photoFile>[0];

  it("offers the newest pictures, not movies, hidden or deleted ones", () => {
    const older = { ...photo, id: "o", taken_ms: 1 };
    const movie = { ...photo, id: "m", mime: "video/mp4" };
    const gone = { ...photo, id: "g", deleted_ms: 1 };
    const hidden = { ...photo, id: "h", hidden: true };
    expect(recentPhotos([older, movie, gone, hidden, photo]).map(({ id }) => id)).toEqual([
      "p",
      "o",
    ]);
  });

  it("gives a message the drive's file, under a name with its extension", () => {
    expect(photoFile(photo)).toEqual({
      id: "f1",
      name: "IMG_1.jpg",
      kind: "file",
      type: "image/jpeg",
      size: 10,
    });
  });
});
