import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { MenuPopupContext } from "../menu";
import { MenuItem, MenuSeparator } from "../menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "../submenu";
import {
  ContextualMenu,
  ContextualMenuPopup,
  type ContextualMenuPopupProps,
  ContextualMenuTrigger,
} from "./index";

function Desktop({
  onInfo = () => {},
  disabled = false,
  popup,
}: {
  onInfo?: () => void;
  disabled?: boolean;
  popup?: ContextualMenuPopupProps;
}) {
  return (
    <ContextualMenu disabled={disabled}>
      <ContextualMenuTrigger data-testid="area">Desktop</ContextualMenuTrigger>
      <ContextualMenuPopup {...popup}>
        <MenuItem>New Folder</MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+i" onClick={onInfo}>
          Get Info
        </MenuItem>
        <MenuItem disabled>Paste Item</MenuItem>
        <MenuItem>Clean Up</MenuItem>
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

const secondaryClick = () =>
  fireEvent.contextMenu(screen.getByTestId("area"), { clientX: 40, clientY: 30 });

describe("ContextualMenu", () => {
  it("opens on a secondary click in its area, in place of the browser's menu", async () => {
    render(<Desktop />);
    const area = screen.getByTestId("area");
    expect(area).toHaveClass("mac-contextual-menu-trigger");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // fireEvent returns false when the event's default action was prevented.
    expect(secondaryClick()).toBe(false);
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("mac-menu", "mac-contextual-menu");
    expect(menu).not.toHaveAttribute("data-attached");
    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
  });

  it("chooses an item and closes", async () => {
    const user = userEvent.setup();
    const onInfo = vi.fn();
    render(<Desktop onInfo={onInfo} />);
    secondaryClick();
    await user.click(await screen.findByRole("menuitem", { name: "Get Info" }));
    expect(onInfo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("moves with the arrow keys past disabled items and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<Desktop />);
    secondaryClick();
    await screen.findByRole("menu");
    const highlighted = () => document.querySelector("[data-highlighted]");
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("New Folder"));
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Clean Up"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("keeps the key equivalent for assistive technology", async () => {
    render(<Desktop />);
    secondaryClick();
    // The glyphs are hidden by the stylesheet, which acts on this attribute of the menu.
    expect(await screen.findByRole("menu")).toHaveAttribute("data-key-equivalents", "hidden");
    expect(screen.getByRole("menuitem", { name: "Get Info" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+I",
    );
  });

  it("hides the key equivalents of its submenus too", async () => {
    render(
      <ContextualMenu>
        <ContextualMenuTrigger data-testid="area">Desktop</ContextualMenuTrigger>
        <ContextualMenuPopup>
          <Submenu defaultOpen>
            <SubmenuTrigger>Sort By</SubmenuTrigger>
            <SubmenuPopup>
              <MenuItem keyEquivalent="control+command+1">Name</MenuItem>
            </SubmenuPopup>
          </Submenu>
        </ContextualMenuPopup>
      </ContextualMenu>,
    );
    secondaryClick();
    const submenu = (await screen.findByRole("menuitem", { name: "Name" })).closest("[role=menu]");
    expect(submenu).toHaveClass("mac-submenu");
    expect(submenu).not.toHaveClass("mac-contextual-menu");
    expect(submenu).toHaveAttribute("data-key-equivalents", "hidden");
    expect(submenu?.parentElement).not.toHaveAttribute("data-appearance");
  });

  it("keeps what a provider around it decided, for itself and for its submenus", async () => {
    render(
      <MenuPopupContext value={{ appearance: "dark" }}>
        <ContextualMenu>
          <ContextualMenuTrigger data-testid="area">Desktop</ContextualMenuTrigger>
          <ContextualMenuPopup aria-label="Desktop">
            <Submenu defaultOpen>
              <SubmenuTrigger>Sort By</SubmenuTrigger>
              <SubmenuPopup>
                <MenuItem keyEquivalent="command+1">Name</MenuItem>
              </SubmenuPopup>
            </Submenu>
          </ContextualMenuPopup>
        </ContextualMenu>
      </MenuPopupContext>,
    );
    secondaryClick();
    const submenu = (await screen.findByRole("menuitem", { name: "Name" })).closest("[role=menu]");
    const menu = screen.getByRole("menu", { name: "Desktop" });
    expect(submenu).not.toBe(menu);
    for (const popup of [menu, submenu]) {
      expect(popup?.parentElement).toHaveAttribute("data-appearance", "dark");
      expect(popup).toHaveAttribute("data-key-equivalents", "hidden");
    }
  });

  it("does not open while disabled", () => {
    render(<Desktop disabled />);
    secondaryClick();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("forwards ref, className and attributes to the popup", async () => {
    const ref = createRef<HTMLDivElement>();
    render(<Desktop popup={{ ref, className: "extra", "aria-label": "Desktop" }} />);
    secondaryClick();
    const menu = await screen.findByRole("menu", { name: "Desktop" });
    expect(ref.current).toBe(menu);
    expect(menu).toHaveClass("mac-menu", "mac-contextual-menu", "extra");
  });
});
