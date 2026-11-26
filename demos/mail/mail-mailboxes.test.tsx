import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Mail, type MailProps } from "./mail";
import type { MailMessage, OwnMailbox } from "./mail-data";

const TRIPS: OwnMailbox = { id: "box-0123456789abcdef", name: "Trips" };
const MESSAGE: MailMessage = {
  id: "a",
  mailbox: "box-0123456789abcdef",
  from: "Martin",
  to: ["Robin Vega"],
  subject: "Ferry",
  date: "10/23/26",
  received: "October 23, 2026 at 8:00 AM",
  time: 1,
  body: "Noon.",
};

const tree = () => screen.getByRole("tree", { name: "Mailboxes" });
const mailbox = (name: string) =>
  within(tree()).getByRole("treeitem", { name: new RegExp(`^${name}`) });
const rowMenu = async (name: string) => {
  fireEvent.contextMenu(mailbox(name));
  return screen.findByRole("menu", { name: "Mailbox commands" });
};
const dimmed = (menu: HTMLElement, name: RegExp) =>
  within(menu).getByRole("menuitem", { name }).getAttribute("aria-disabled") === "true";
const held = (props: Partial<MailProps>) =>
  render(
    <Mail
      messages={[]}
      defaultMessage={null}
      heldMessages={[MESSAGE]}
      heldMailboxes={[TRIPS]}
      {...props}
    />,
  );

describe("a mailbox the person made, over held messages", () => {
  it.each([
    ["create", { onCreateMailbox: vi.fn() }, [false, true, true]],
    ["rename", { onRenameMailbox: vi.fn() }, [true, false, true]],
    ["delete", { onDeleteMailbox: vi.fn() }, [true, true, false]],
  ] as const)("offers only what its owner can do: %s", async (_, props, expected) => {
    held(props);
    const menu = await rowMenu("Trips");
    expect([
      dimmed(menu, /^New Mailbox/),
      dimmed(menu, /^Rename Mailbox/),
      dimmed(menu, /^Delete Mailbox/),
    ]).toEqual(expected);
  });

  it("dims Rename and Delete on a mailbox every person has", async () => {
    held({ onRenameMailbox: vi.fn(), onDeleteMailbox: vi.fn() });
    const menu = await rowMenu("Inbox");
    expect(dimmed(menu, /^Rename Mailbox/)).toBe(true);
    expect(dimmed(menu, /^Delete Mailbox/)).toBe(true);
  });

  it("shows the owner's refusal and stays open, and closes once it is done", async () => {
    const onRenameMailbox = vi
      .fn()
      .mockResolvedValueOnce("Mail could not rename the mailbox.")
      .mockResolvedValueOnce(null);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    held({ onRenameMailbox });
    await user.click(
      within(await rowMenu("Trips")).getByRole("menuitem", { name: /^Rename Mailbox/ }),
    );
    const alert = await screen.findByRole("alertdialog");
    const field = within(alert).getByRole("textbox", { name: "Name" });
    expect(field).toHaveValue("Trips");
    await user.clear(field);
    await user.type(field, "Holidays{Enter}");
    expect(await within(alert).findByRole("alert")).toHaveTextContent(
      "Mail could not rename the mailbox.",
    );
    await user.click(within(alert).getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onRenameMailbox).toHaveBeenLastCalledWith(TRIPS.id, "Holidays");
  });

  it("refuses a name Mail has without asking the owner", async () => {
    const onCreateMailbox = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    held({ onCreateMailbox });
    await user.click(
      within(await rowMenu("Inbox")).getByRole("menuitem", { name: /^New Mailbox/ }),
    );
    const alert = await screen.findByRole("alertdialog");
    await user.type(within(alert).getByRole("textbox", { name: "Name" }), "trips{Enter}");
    expect(await within(alert).findByRole("alert")).toHaveTextContent(
      "Mail already has a mailbox named",
    );
    expect(onCreateMailbox).not.toHaveBeenCalled();
  });

  it("leaves a mailbox that is no longer listed for the Inbox", async () => {
    const props = { messages: [], defaultMessage: null, heldMessages: [MESSAGE] };
    const { rerender } = render(
      <Mail {...props} heldMailboxes={[TRIPS]} defaultMailbox={TRIPS.id} />,
    );
    expect(mailbox("Trips")).toHaveAttribute("aria-selected", "true");
    rerender(<Mail {...props} heldMailboxes={[]} defaultMailbox={TRIPS.id} />);
    await waitFor(() => expect(mailbox("Inbox")).toHaveAttribute("aria-selected", "true"));
  });
});

describe("a mailbox the person made, over the demo's own messages", () => {
  it("is made, takes messages and gives them to the Trash when deleted", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Mail messages={[{ ...MESSAGE, mailbox: "inbox" }]} defaultMessage="a" />);
    await user.click(
      within(await rowMenu("Inbox")).getByRole("menuitem", { name: /^New Mailbox/ }),
    );
    const alert = await screen.findByRole("alertdialog");
    await user.type(within(alert).getByRole("textbox", { name: "Name" }), "Trips{Enter}");
    await waitFor(() => expect(mailbox("Trips")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Move to/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Trips" }));
    await user.click(mailbox("Trips"));
    expect(
      within(screen.getByRole("listbox", { name: "Messages" })).getByText("Ferry"),
    ).toBeVisible();

    await user.click(
      within(await rowMenu("Trips")).getByRole("menuitem", { name: /^Delete Mailbox/ }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(mailbox("Inbox")).toHaveAttribute("aria-selected", "true"));
    expect(within(tree()).queryByRole("treeitem", { name: /^Trips/ })).not.toBeInTheDocument();
    await user.click(mailbox("Trash"));
    const listed = () => within(screen.getByRole("listbox", { name: "Messages" }));
    expect(listed().getByText("Ferry")).toBeVisible();

    // The move into the mailbox can no longer be undone: the message stays where it is listed.
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Messages" }), {
      key: "z",
      ctrlKey: true,
    });
    expect(listed().getByText("Ferry")).toBeVisible();
  });
});
