import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PushButton } from "../push-button";
import { ShareMenu, ShareMenuItem, type ShareMenuProps } from "./index";

const icon = <svg data-testid="icon" aria-hidden="true" />;
const closed = () => waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
const highlighted = () => document.querySelector("[data-highlighted]");

function Share({ onMail = () => {}, ...props }: { onMail?: () => void } & Partial<ShareMenuProps>) {
  return (
    <ShareMenu {...props}>
      <ShareMenuItem image={icon} onClick={onMail}>
        Mail
      </ShareMenuItem>
      <ShareMenuItem>Messages</ShareMenuItem>
      <ShareMenuItem disabled>AirDrop</ShareMenuItem>
    </ShareMenu>
  );
}

const button = () => screen.getByRole("button", { name: "Share" });

describe("ShareMenu", () => {
  it("is a toolbar button named Share that has a menu", () => {
    render(<Share />);
    expect(button().tagName).toBe("BUTTON");
    expect(button()).toHaveClass("mac-toolbar-button", "mac-share-menu");
    expect(button()).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the library's menu with the services and their icons", async () => {
    const user = userEvent.setup();
    render(<Share />);
    await user.click(button());
    expect(await screen.findByRole("menu")).toHaveClass("mac-menu");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Mail", "Messages", "AirDrop"]);
    for (const item of items) expect(item).toHaveClass("mac-menu-item", "mac-share-menu-item");
    expect(items[0]).toContainElement(screen.getByTestId("icon"));
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("shares with the chosen service and closes", async () => {
    const user = userEvent.setup();
    const onMail = vi.fn();
    render(<Share onMail={onMail} />);
    await user.click(button());
    await user.click(await screen.findByRole("menuitem", { name: "Mail" }));
    expect(onMail).toHaveBeenCalledTimes(1);
    await closed();
  });

  it("ends with a separator and More… when onMore is given", async () => {
    const user = userEvent.setup();
    const onMore = vi.fn();
    render(<Share onMore={onMore} />);
    await user.click(button());
    await screen.findByRole("menu");
    expect(screen.getByRole("separator")).toBeInTheDocument();
    const items = screen.getAllByRole("menuitem");
    expect(items.at(-1)).toHaveTextContent("More…");
    await user.click(items.at(-1) as HTMLElement);
    expect(onMore).toHaveBeenCalledTimes(1);
    await closed();
  });

  it("titles the last item with moreLabel", async () => {
    const user = userEvent.setup();
    render(<Share onMore={() => {}} moreLabel="Extensions…" />);
    await user.click(button());
    expect(await screen.findByRole("menuitem", { name: "Extensions…" })).toBeInTheDocument();
  });

  it("opens and chooses from the keyboard, and returns the focus to the button", async () => {
    const user = userEvent.setup();
    const onMail = vi.fn();
    render(<Share onMail={onMail} />);
    await user.tab();
    expect(button()).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("menu");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Mail"));
    // The highlight is set before the focus has left the button: Return belongs to the item
    // only once the item has the focus, as it does for a person a frame later.
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Mail" })).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onMail).toHaveBeenCalledTimes(1);
    await closed();
    await waitFor(() => expect(button()).toHaveFocus());
  });

  it("passes over a disabled service with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Share />);
    await user.click(button());
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Mail"));
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Messages"));
    // AirDrop is disabled: Down Arrow wraps to the first service instead.
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Mail"));
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Share />);
    await user.click(button());
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    await closed();
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Share disabled onOpenChange={onOpenChange} />);
    expect(button()).toBeDisabled();
    await user.click(button());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("can be opened by its owner and reports closing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Share open onOpenChange={onOpenChange} />);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
  });

  it("takes another control as its trigger, with that control's own name", async () => {
    const user = userEvent.setup();
    render(<Share trigger={<PushButton>Share…</PushButton>} />);
    const own = screen.getByRole("button", { name: "Share…" });
    expect(own).toHaveClass("mac-push-button", "mac-share-menu");
    // Only the menu's own Share button is marked as such: its open bezel is not for this one.
    expect(own).not.toHaveClass("mac-share-menu-button");
    await user.click(own);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  it("marks its own Share button, for the bezel it keeps while the menu is open", async () => {
    const user = userEvent.setup();
    render(<Share />);
    const button = screen.getByRole("button", { name: "Share" });
    expect(button).toHaveClass("mac-toolbar-button", "mac-share-menu", "mac-share-menu-button");
    await user.click(button);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(button).toHaveAttribute("data-popup-open");
  });

  it("passes ref, className, style and other props to the button, and popupProps to the menu", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLElement>();
    render(
      <Share
        ref={ref}
        id="share"
        className="extra"
        aria-label="Share page"
        data-x="1"
        popupProps={{ className: "wide", "aria-label": "Services" }}
      />,
    );
    const named = screen.getByRole("button", { name: "Share page" });
    expect(ref.current).toBe(named);
    expect(named).toHaveClass("mac-share-menu", "extra");
    expect(named).toHaveAttribute("id", "share");
    expect(named).toHaveAttribute("data-x", "1");
    await user.click(named);
    expect(await screen.findByRole("menu")).toHaveClass("mac-menu", "wide");
  });
});
