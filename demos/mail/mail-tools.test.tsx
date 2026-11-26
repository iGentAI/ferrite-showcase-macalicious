import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { Mail } from "./mail";
import { MailCompose } from "./mail-compose";
import type { MailMessage } from "./mail-data";
import { checkConnection } from "./mail-live";
import { MailActivityWindow, MailDoctorWindow, MailRecipientsWindow } from "./mail-tool-windows";
import {
  accountOf,
  appendedText,
  completeAddress,
  previousRecipients,
  quotationHtml,
  quotationText,
} from "./mail-tools";

const base = {
  from: "Martin",
  fromAddress: "Martin Ng <martin@macalicious>",
  to: ["Robin Vega"],
  date: "10/23/26",
  received: "October 23, 2026 at 8:00 AM",
  body: "Meet at the pier.",
};
const MESSAGES: MailMessage[] = [
  { ...base, id: "a", mailbox: "inbox", subject: "First", time: 3 },
  {
    ...base,
    id: "s1",
    mailbox: "sent",
    subject: "Older",
    time: 1,
    toAddresses: ["Ana Ruiz <ana@macalicious>", "Bo <bo@macalicious>"],
    cc: ["Cy <cy@macalicious>"],
  },
  {
    ...base,
    id: "s2",
    mailbox: "sent",
    subject: "Newer",
    time: 2,
    toAddresses: ["Ana Ruiz <ana@macalicious>"],
  },
];

function Menus({ titles }: { titles: readonly string[] }) {
  return (
    <MenuBar aria-label="Menus">
      {titles.map((title) => (
        <OneMenu key={title} title={title} />
      ))}
    </MenuBar>
  );
}
function OneMenu({ title }: { title: string }) {
  const items = useDesktopAppMenuItems("mail", title);
  return <MenuBarMenu title={title}>{items}</MenuBarMenu>;
}
const openMenu = async (user: ReturnType<typeof userEvent.setup>, title: string) =>
  user.click(screen.getByRole("menuitem", { name: title }));

afterEach(() => vi.unstubAllGlobals());

describe("Previous Recipients", () => {
  it("lists whoever Sent is addressed to, the most recent first, without those removed", () => {
    const listed = previousRecipients(MESSAGES, ["bo@macalicious"]);
    expect(listed.map(({ address, last }) => [address, last])).toEqual([
      ["ana@macalicious", 2],
      ["cy@macalicious", 1],
    ]);
  });

  it("writes to, adds and removes the person chosen, and narrows by what is searched", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onNewMessage = vi.fn();
    const onRemove = vi.fn();
    const onAddContact = vi.fn();
    render(
      <MailRecipientsWindow
        recipients={previousRecipients(MESSAGES, [])}
        onNewMessage={onNewMessage}
        canAddContact={() => true}
        onAddContact={onAddContact}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByRole("button", { name: "Remove From List" })).toBeDisabled();
    await user.click(screen.getByText("Ana Ruiz <ana@macalicious>"));
    await user.click(screen.getByRole("button", { name: "New Message" }));
    expect(onNewMessage.mock.calls[0]?.[0].written).toBe("Ana Ruiz <ana@macalicious>");
    await user.click(screen.getByRole("button", { name: "Remove From List" }));
    expect(onRemove.mock.calls[0]?.[0].address).toBe("ana@macalicious");
    await user.click(screen.getByRole("button", { name: "Add to Contacts" }));
    expect(onAddContact.mock.calls[0]?.[0].address).toBe("ana@macalicious");
    await user.type(screen.getByRole("searchbox", { name: "Search recipients" }), "cy@");
    expect(screen.queryByText("Ana Ruiz <ana@macalicious>")).toBeNull();
    expect(screen.getByText("Cy <cy@macalicious>")).toBeTruthy();
  });
});

describe("Activity", () => {
  it("says what Mail is doing, and when it last looked", () => {
    const { rerender } = render(
      <MailActivityWindow checking={false} sending={false} lastChecked={null} />,
    );
    expect(screen.getByText("Not checked since Mail opened")).toBeTruthy();
    expect(screen.getByText("No messages being sent")).toBeTruthy();
    rerender(<MailActivityWindow checking sending lastChecked={null} />);
    expect(screen.getByText("Checking for new mail…")).toBeTruthy();
    expect(screen.getByText("Sending a message…")).toBeTruthy();
    rerender(
      <MailActivityWindow
        checking={false}
        sending={false}
        lastChecked={new Date(2026, 9, 23, 15, 45).getTime()}
      />,
    );
    expect(screen.getByText("Last checked at 3:45 PM")).toBeTruthy();
  });
});

describe("Connection Doctor", () => {
  it("shows the server's answer, and asks again on Check Again", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const check = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, detail: "no answer." })
      .mockResolvedValueOnce({ ok: true, detail: "answered in 3 ms." });
    render(<MailDoctorWindow check={check} />);
    expect(await screen.findByText("This desktop’s mail server: no answer.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Check Again" }));
    expect(await screen.findByText("This desktop’s mail server: answered in 3 ms.")).toBeTruthy();
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("reads the answer of the Mail API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ name: "chris" })),
    );
    const report = await checkConnection();
    expect(report.ok).toBe(true);
    expect(report.detail).toMatch(/^answered in \d+ ms, signed in as chris\.$/);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );
    expect((await checkConnection()).ok).toBe(false);
  });
});

describe("Quotation and completion", () => {
  it("quotes each line, escaped, and leaves a line to go on under it", () => {
    expect(quotationHtml("a <b>\n\nc")).toBe(
      "<div><br></div><blockquote><div>a &lt;b&gt;</div><div><br></div><div>c</div></blockquote><div><br></div>",
    );
    expect(quotationText("a\nb")).toBe("> a\n> b\n");
  });
  it("completes to a contact it begins before one it only holds", () => {
    const contacts = ["Ana <zed@macalicious>", "Zed <z@macalicious>"];
    expect(completeAddress("zed", contacts)).toBe("Zed <z@macalicious>");
    expect(completeAddress("ANA", contacts)).toBe("Ana <zed@macalicious>");
    expect(completeAddress(" ", contacts)).toBeUndefined();
    expect(completeAddress("nobody", contacts)).toBeUndefined();
  });
  it("knows an account's card from what a token holds", () => {
    expect(accountOf("Ana Ruiz <ana@macalicious>")).toEqual({ name: "ana", fullName: "Ana Ruiz" });
    expect(accountOf("ana@macalicious")).toEqual({ name: "ana", fullName: "ana" });
    expect(accountOf("ana@example.com")).toBeNull();
  });
  it("appends each message with who, what and when", () => {
    expect(appendedText([MESSAGES[0] as MailMessage], ["Whole text"])).toBe(
      "From: Martin Ng <martin@macalicious>\nSubject: First\nDate: October 23, 2026 at 8:00 AM\n\nWhole text",
    );
  });
});

describe("the viewer's new rows", () => {
  const setup = async (titles: readonly string[], props = {}) => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <Menus titles={titles} />
        <Mail messages={MESSAGES} defaultMessage="a" {...props} />
      </>,
    );
    return user;
  };

  it("blocks a sender, shows it on their message, and takes it back", async () => {
    const user = await setup(["Message"]);
    await openMenu(user, "Message");
    await user.click(await screen.findByRole("menuitem", { name: "Block Contact" }));
    expect(await screen.findByText("This message is from a sender you blocked.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Unblock" }));
    expect(screen.queryByText("This message is from a sender you blocked.")).toBeNull();
  });

  it("hides and shows the toolbar", async () => {
    const user = await setup(["View"]);
    expect(screen.getByRole("toolbar", { name: "Mail toolbar" })).toBeTruthy();
    await openMenu(user, "View");
    await user.click(await screen.findByRole("menuitem", { name: "Hide Toolbar" }));
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Mail toolbar" })).toBeNull());
    await openMenu(user, "View");
    await user.click(await screen.findByRole("menuitem", { name: "Show Toolbar" }));
    expect(await screen.findByRole("toolbar", { name: "Mail toolbar" })).toBeTruthy();
  });

  it("reads the mail again for Synchronize and for Rebuild, Rebuild through its own command", async () => {
    const onGetMail = vi.fn();
    const onRebuild = vi.fn();
    const user = await setup(["Mailbox"], { onGetMail, onRebuild });
    await openMenu(user, "Mailbox");
    await user.click(await screen.findByRole("menuitem", { name: "Synchronize All Accounts" }));
    await waitFor(() => expect(onGetMail).toHaveBeenCalledTimes(1));
    expect(onRebuild).not.toHaveBeenCalled();
    await openMenu(user, "Mailbox");
    await user.click(await screen.findByRole("menuitem", { name: "Rebuild" }));
    await waitFor(() => expect(onRebuild).toHaveBeenCalledTimes(1));
    expect(onGetMail).toHaveBeenCalledTimes(1);
  });

  it("dims what this desktop cannot do, each with its reason", async () => {
    const user = await setup(["Message", "Window", "File"]);
    await openMenu(user, "Message");
    const remove = await screen.findByRole("menuitem", { name: "Remove Attachments" });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAttribute(
      "title",
      "Select a message with attachments, other than a draft.",
    );
    fireEvent.keyDown(remove, { key: "Escape" });
    await openMenu(user, "File");
    const save = await screen.findByRole("menuitem", { name: "Save Attachments…" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAttribute("title", "Select a message with attachments.");
  });
});

describe("the message text's menu", () => {
  it("looks up nothing without a selection, and offers the link under the pointer", async () => {
    render(<Mail messages={MESSAGES} defaultMessage="a" />);
    const text = screen.getByRole("article", { name: "First" });
    fireEvent.contextMenu(within(text).getByText("Meet at the pier."));
    const lookUp = await screen.findByRole("menuitem", { name: "Look Up" });
    expect(lookUp).toHaveAttribute("aria-disabled", "true");
    expect(lookUp).toHaveAttribute("title", "Select a word to look it up.");
    expect(screen.queryByRole("menuitem", { name: "Open Link" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Select All" })).toBeTruthy();
  });
});

describe("New Message's new rows", () => {
  const compose = (props = {}) => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <Menus titles={["Edit"]} />
        <MailCompose
          contacts={["Ana Ruiz <ana@macalicious>"]}
          defaultDraft={{
            to: ["Ana Ruiz <ana@macalicious>"],
            cc: [],
            subject: "Hi",
            body: "Hello",
          }}
          {...props}
        />
      </>,
    );
    return user;
  };

  it("has the editors' rows and Mail's own in Edit", async () => {
    const user = compose();
    await openMenu(user, "Edit");
    for (const name of [
      "Paste and Match Style",
      "Paste as Quotation",
      "Append Selected Messages",
      "Attachments",
      "Complete Address",
      "Spelling and Grammar",
      "Substitutions",
      "Transformations",
      "Speech",
    ]) {
      expect(await screen.findByRole("menuitem", { name })).toBeTruthy();
    }
  });

  it("completes an address the field holds unfinished, and dims with nothing to complete", async () => {
    const user = compose({ defaultDraft: { to: [], cc: [], subject: "", body: "" } });
    await openMenu(user, "Edit");
    expect(await screen.findByRole("menuitem", { name: "Complete Address" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");
    await user.type(screen.getByLabelText("To:"), "ana");
    await openMenu(user, "Edit");
    await user.click(await screen.findByRole("menuitem", { name: "Complete Address" }));
    expect(await screen.findByRole("option", { name: /Ana Ruiz <ana@macalicious>/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /^ana/ })).toBeNull();
  });

  it("appends the selected messages' text at the end of the message", async () => {
    const user = compose({ appendSelected: async () => "From: Martin\n\nThe text" });
    await user.click(screen.getByRole("textbox", { name: "Message" }));
    await openMenu(user, "Edit");
    await user.click(await screen.findByRole("menuitem", { name: "Append Selected Messages" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Message" }).textContent).toContain("The text"),
    );
    expect(screen.getByRole("textbox", { name: "Message" }).textContent).toMatch(/^Hello/);
  });

  it("copies, edits and offers a card from a recipient's token menu", async () => {
    const writeText = vi.fn(async () => {});
    const onAddAddress = vi.fn();
    const user = compose({ onAddAddress });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const menuOfToken = async () => {
      const token = await screen.findByRole("option", { name: /Ana Ruiz/ });
      await user.click(token.querySelector(".mac-token-field-token-menu") as Element);
    };
    await menuOfToken();
    await user.click(await screen.findByRole("menuitem", { name: "Copy Address" }));
    expect(writeText).toHaveBeenCalledWith("Ana Ruiz <ana@macalicious>");
    await menuOfToken();
    await user.click(await screen.findByRole("menuitem", { name: "Add to Contacts" }));
    expect(onAddAddress).toHaveBeenCalledWith("Ana Ruiz <ana@macalicious>");
    await menuOfToken();
    await user.click(await screen.findByRole("menuitem", { name: "Edit Address" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "To:" })).toHaveValue(
        "Ana Ruiz <ana@macalicious>",
      ),
    );
  });

  it("turns the format bar's list button into a list", async () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    const user = compose();
    await user.click(screen.getByRole("button", { name: "Show Format Bar" }));
    await user.click(await screen.findByRole("button", { name: "Bulleted list" }));
    expect(execCommand).toHaveBeenCalledWith("insertUnorderedList", false);
  });
});
