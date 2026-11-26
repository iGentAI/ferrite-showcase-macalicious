import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuPopupContext } from "../menu";
import { MenuItem, MenuSeparator } from "../menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "../submenu";
import {
  DockMenu,
  DockMenuPopup,
  type DockMenuPopupProps,
  type DockMenuProps,
  DockMenuTrigger,
} from "./index";

function Notes({
  onLaunch = () => {},
  onQuit = () => {},
  popup,
  ...menu
}: {
  onLaunch?: () => void;
  onQuit?: () => void;
  popup?: DockMenuPopupProps;
} & DockMenuProps) {
  return (
    <DockMenu {...menu}>
      <DockMenuTrigger aria-label="Notes" onClick={onLaunch} />
      <DockMenuPopup {...popup}>
        <MenuItem keyEquivalent="command+n">New Note</MenuItem>
        <MenuSeparator />
        <MenuItem>Hide</MenuItem>
        <MenuItem onClick={onQuit}>Quit</MenuItem>
      </DockMenuPopup>
    </DockMenu>
  );
}

const item = () => screen.getByRole("button", { name: "Notes" });

describe("DockMenu", () => {
  afterEach(() => vi.useRealTimers());

  it("leaves a click to the Dock item and opens on a secondary click", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn();
    const onOpenChange = vi.fn();
    render(<Notes onLaunch={onLaunch} onOpenChange={onOpenChange} />);
    expect(item()).toHaveAttribute("aria-haspopup", "menu");
    expect(item()).toHaveAttribute("aria-expanded", "false");

    await user.click(item());
    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // fireEvent returns false when the event's default action was prevented.
    expect(fireEvent.contextMenu(item())).toBe(false);
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("mac-menu", "mac-dock-menu");
    expect(item()).toHaveAttribute("aria-expanded", "true");
    expect(item()).toHaveAttribute("data-popup-open");
    expect(onOpenChange.mock.calls).toEqual([[true, undefined]]);
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  it("is dark in both appearances unless told to follow the page", async () => {
    const { unmount } = render(<Notes defaultOpen />);
    const positioner = (await screen.findByRole("menu")).parentElement;
    expect(positioner).toHaveClass("mac-menu-positioner", "mac-dock-menu-positioner");
    expect(positioner).toHaveAttribute("data-appearance", "dark");
    expect(positioner?.querySelector(".mac-dock-menu-pointer")).toBeInTheDocument();
    unmount();

    render(<Notes defaultOpen popup={{ appearance: "inherit" }} />);
    expect((await screen.findByRole("menu")).parentElement).not.toHaveAttribute("data-appearance");
  });

  it("opens when the item is pressed and held, and that press is not a click", async () => {
    vi.useFakeTimers();
    const onLaunch = vi.fn();
    render(<Notes onLaunch={onLaunch} />);
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerUp(item());
    fireEvent.click(item());
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("does not open when the press ends or leaves the item early", () => {
    vi.useFakeTimers();
    const onLaunch = vi.fn();
    render(<Notes onLaunch={onLaunch} />);
    fireEvent.pointerDown(item(), { button: 0 });
    fireEvent.pointerUp(item());
    fireEvent.click(item());
    fireEvent.pointerDown(item(), { button: 0 });
    fireEvent.pointerLeave(item());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onLaunch).toHaveBeenCalledTimes(1);
  });

  it("does not end a press that opened the menu in a click, even if the menu has closed", async () => {
    vi.useFakeTimers();
    const onLaunch = vi.fn();
    const { rerender } = render(<Notes open={false} onLaunch={onLaunch} />);
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    // The owner opens the menu as asked, and closes it again before the press is released.
    rerender(<Notes open onLaunch={onLaunch} />);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    rerender(<Notes open={false} onLaunch={onLaunch} />);
    fireEvent.pointerUp(item());
    fireEvent.click(item());
    expect(onLaunch).not.toHaveBeenCalled();
    // The next press is a new one.
    fireEvent.pointerDown(item(), { button: 0 });
    fireEvent.pointerUp(item());
    fireEvent.click(item());
    expect(onLaunch).toHaveBeenCalledTimes(1);
  });

  it("leaves the release click alone when a controlled owner declines to open the menu", () => {
    vi.useFakeTimers();
    const onLaunch = vi.fn();
    const onOpenChange = vi.fn();
    render(<Notes open={false} onOpenChange={onOpenChange} onLaunch={onLaunch} />);
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onOpenChange.mock.calls).toEqual([[true, undefined]]);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.pointerUp(item());
    fireEvent.click(item());
    expect(onLaunch).toHaveBeenCalledTimes(1);
  });

  it("does not open from a Dock item that is itself disabled", () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    render(
      <DockMenu onOpenChange={onOpenChange}>
        <DockMenuTrigger aria-label="Notes" disabled />
        <DockMenuPopup>
          <MenuItem>Quit</MenuItem>
        </DockMenuPopup>
      </DockMenu>,
    );
    // The browser's own menu is left alone: the event is not prevented.
    expect(fireEvent.contextMenu(item())).toBe(true);
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("does not begin a held press on a disabled Dock item that is enabled meanwhile", () => {
    vi.useFakeTimers();
    const Item = ({ disabled }: { disabled: boolean }) => (
      <DockMenu>
        <DockMenuTrigger aria-label="Notes" disabled={disabled} />
        <DockMenuPopup>
          <MenuItem>Quit</MenuItem>
        </DockMenuPopup>
      </DockMenu>
    );
    const { rerender } = render(<Item disabled />);
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<Item disabled={false} />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // A press that begins on the enabled item opens the menu.
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("does not begin a held press on the item of a disabled Dock menu that is enabled meanwhile", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Notes disabled />);
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<Notes />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // A press that begins on the enabled item opens the menu.
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("does not withhold a later click after a press that opened the menu was cancelled", () => {
    vi.useFakeTimers();
    const onLaunch = vi.fn();
    const { rerender } = render(<Notes open={false} onLaunch={onLaunch} />);
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    rerender(<Notes open onLaunch={onLaunch} />);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerCancel(item());
    rerender(<Notes open={false} onLaunch={onLaunch} />);
    // Return on the item: a click that no pointer began.
    fireEvent.click(item());
    expect(onLaunch).toHaveBeenCalledTimes(1);
  });

  it("with appearance inherit keeps what a provider around it decided, submenus included", async () => {
    render(
      <MenuPopupContext value={{ appearance: "dark" }}>
        <DockMenu defaultOpen>
          <DockMenuTrigger aria-label="Notes" />
          <DockMenuPopup appearance="inherit">
            <Submenu defaultOpen>
              <SubmenuTrigger>Options</SubmenuTrigger>
              <SubmenuPopup>
                <MenuItem keyEquivalent="command+k">Keep in Dock</MenuItem>
              </SubmenuPopup>
            </Submenu>
          </DockMenuPopup>
        </DockMenu>
      </MenuPopupContext>,
    );
    const submenu = (await screen.findByRole("menuitem", { name: "Keep in Dock" })).closest(
      "[role=menu]",
    );
    const menu = document.querySelector(".mac-dock-menu");
    expect(menu).toHaveAttribute("role", "menu");
    expect(submenu).not.toBe(menu);
    for (const popup of [menu, submenu]) {
      expect(popup?.parentElement).toHaveAttribute("data-appearance", "dark");
      expect(popup).toHaveAttribute("data-key-equivalents", "hidden");
    }
  });

  it("does not open when it is disabled while the item is being pressed", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Notes />);
    fireEvent.pointerDown(item(), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<Notes disabled />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // A disabled Dock menu disables its item, as Base UI's trigger does.
    expect(item()).toBeDisabled();
  });

  it.each([
    ["dark", "dark"],
    ["inherit", null],
  ] as const)(
    "gives its submenus its %s appearance and hides their key equivalents",
    async (appearance, attribute) => {
      const user = userEvent.setup();
      render(
        <DockMenu>
          <DockMenuTrigger aria-label="Notes" />
          <DockMenuPopup appearance={appearance}>
            <Submenu>
              <SubmenuTrigger>Options</SubmenuTrigger>
              <SubmenuPopup>
                <MenuItem keyEquivalent="command+k">Keep in Dock</MenuItem>
              </SubmenuPopup>
            </Submenu>
          </DockMenuPopup>
        </DockMenu>,
      );
      item().focus();
      await user.keyboard("{ArrowUp}");
      await screen.findByRole("menu");
      await user.keyboard("{ArrowDown}");
      await waitFor(() =>
        expect(screen.getByRole("menuitem", { name: "Options" })).toHaveAttribute(
          "data-highlighted",
        ),
      );
      await user.keyboard("{ArrowRight}");
      const submenu = (await screen.findByRole("menuitem", { name: "Keep in Dock" })).closest(
        "[role=menu]",
      );
      expect(submenu).toHaveClass("mac-submenu");
      expect(submenu).not.toHaveClass("mac-dock-menu");
      expect(submenu).toHaveAttribute("data-key-equivalents", "hidden");
      // The submenu is in a portal of its own, not inside the Dock menu's element.
      expect(submenu?.closest(".mac-dock-menu-positioner")).toBeNull();
      if (attribute) expect(submenu?.parentElement).toHaveAttribute("data-appearance", attribute);
      else expect(submenu?.parentElement).not.toHaveAttribute("data-appearance");
    },
  );

  it("opens with Up Arrow, moves with the arrow keys and returns focus on Escape", async () => {
    const user = userEvent.setup();
    render(<Notes />);
    item().focus();
    await user.keyboard("{ArrowUp}");
    await screen.findByRole("menu");
    const highlighted = () => document.querySelector("[data-highlighted]");
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("New Note"));
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Hide"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(item()).toHaveFocus());
  });

  it("chooses an item, closes and reports it", async () => {
    const user = userEvent.setup();
    const onQuit = vi.fn();
    const onOpenChange = vi.fn();
    render(<Notes defaultOpen onQuit={onQuit} onOpenChange={onOpenChange} />);
    await user.click(await screen.findByRole("menuitem", { name: "Quit" }));
    expect(onQuit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
    expect(item()).toHaveAttribute("aria-expanded", "false");
  });

  it("can be controlled, and does not open while disabled", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Notes open={false} onOpenChange={onOpenChange} />);
    fireEvent.contextMenu(item());
    expect(onOpenChange.mock.calls).toEqual([[true, undefined]]);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    rerender(<Notes open onOpenChange={onOpenChange} />);
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    onOpenChange.mockClear();
    rerender(<Notes open={false} disabled onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    fireEvent.contextMenu(item());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("renders the Dock item as another element and forwards the popup's ref and class", async () => {
    const ref = createRef<HTMLDivElement>();
    const iconRef = createRef<HTMLButtonElement>();
    render(
      <DockMenu defaultOpen>
        <DockMenuTrigger
          ref={iconRef}
          render={<a href="#notes" />}
          nativeButton={false}
          data-testid="icon"
        >
          Notes
        </DockMenuTrigger>
        <DockMenuPopup ref={ref} className="extra">
          <MenuItem>Quit</MenuItem>
        </DockMenuPopup>
      </DockMenu>,
    );
    const icon = screen.getByTestId("icon");
    expect(icon.tagName).toBe("A");
    expect(iconRef.current).toBe(icon);
    expect(icon).not.toHaveAttribute("type");
    expect(icon).toHaveAttribute("aria-haspopup", "menu");
    const menu = await screen.findByRole("menu");
    expect(ref.current).toBe(menu);
    expect(menu).toHaveClass("mac-menu", "mac-dock-menu", "extra");
  });
});
