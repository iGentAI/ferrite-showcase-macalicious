import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectDesktopValues,
  desktopValues,
  forgetDesktopValues,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { Mail } from "./mail";
import type { OwnMailbox } from "./mail-data";
import { MAIL_VIEW, readMailSettings, readMailView } from "./mail-saved";

const VIEW = {
  mailbox: "sent",
  sort: "subject",
  ascending: null,
  filterOn: false,
  filters: ["unread"],
  favorites: false,
  sidebar: 0,
  list: 343,
};
const TRIPS: OwnMailbox = { id: "box-0123456789abcdef", name: "Trips" };

const session = (values: Record<string, unknown>) => {
  const write = vi.fn();
  receiveDesktopValues(values);
  stop = connectDesktopValues(write);
  return write;
};
let stop = () => {};
afterEach(() => {
  stop();
  stop = () => {};
  forgetDesktopValues();
});

describe("what Mail keeps for a person", () => {
  it("opens as the person left it", () => {
    session({ [MAIL_VIEW]: VIEW });
    render(<Mail keepsView />);
    expect(screen.getByText(/^Sent \(/)).toBeTruthy();
    expect(screen.getByText("Sort by Subject")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mailboxes" })).toBeNull();
  });

  it("goes back to a mailbox of the person's own once the list of them arrives", () => {
    session({ [MAIL_VIEW]: { ...VIEW, mailbox: TRIPS.id } });
    const props = { messages: [], defaultMessage: null, heldMessages: [], keepsView: true };
    const { rerender } = render(<Mail {...props} heldMailboxes={[]} />);
    expect(screen.getByText(/^Inbox \(/)).toBeTruthy();
    rerender(<Mail {...props} heldMailboxes={[TRIPS]} />);
    expect(screen.getByText(/^Trips \(/)).toBeTruthy();
  });

  it("saves nothing before the person's values are known", async () => {
    const user = userEvent.setup();
    render(<Mail keepsView />);
    await user.click(screen.getByRole("radio", { name: "Sent" }));
    expect(desktopValues()).toEqual({});
  });

  it("saves a change once", async () => {
    const user = userEvent.setup();
    const write = session({});
    render(<Mail keepsView />);
    await user.click(screen.getByRole("radio", { name: "Sent" }));
    await waitFor(() =>
      expect(write).toHaveBeenCalledWith(
        MAIL_VIEW,
        expect.objectContaining({ mailbox: "sent", sort: "date" }),
      ),
    );
    const views = write.mock.calls.filter(([key]) => key === MAIL_VIEW);
    expect(views.filter(([, view]) => view.mailbox === "sent")).toHaveLength(1);
  });

  it("keeps nothing unless its host asks", async () => {
    const write = session({ [MAIL_VIEW]: VIEW });
    render(<Mail />);
    expect(screen.getByText(/^Inbox \(/)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(write).not.toHaveBeenCalled();
  });

  it("refuses what Mail did not write", () => {
    expect(readMailView({ ...VIEW, sort: "size" })).toBeUndefined();
    expect(readMailView({ ...VIEW, sidebar: 9000 })).toBeUndefined();
    expect(readMailView(VIEW)).toEqual({ ...VIEW, conversations: false });
    expect(readMailView({ ...VIEW, conversations: true })?.conversations).toBe(true);
    expect(readMailSettings({ a: 1 })).toBeUndefined();
    expect(readMailSettings({ a: true, b: "c" })).toEqual({ a: true, b: "c" });
  });
});
