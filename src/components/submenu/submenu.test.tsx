import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Menu, MenuPopup, MenuTrigger } from "../menu";
import { MenuItem } from "../menu-item";
import { Submenu, SubmenuPopup, type SubmenuPopupProps, SubmenuTrigger } from "./index";

function AppleMenu({
  onClear = () => {},
  disabled = false,
  rootDisabled = false,
  popup,
}: {
  onClear?: () => void;
  disabled?: boolean;
  rootDisabled?: boolean;
  popup?: SubmenuPopupProps;
}) {
  return (
    <Menu defaultOpen>
      <MenuTrigger>Apple</MenuTrigger>
      <MenuPopup>
        <MenuItem>About This Mac</MenuItem>
        <Submenu disabled={rootDisabled}>
          <SubmenuTrigger disabled={disabled}>Recent Items</SubmenuTrigger>
          <SubmenuPopup {...popup}>
            <MenuItem>Calculator</MenuItem>
            <MenuItem onClick={onClear}>Clear Menu</MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuItem>Sleep</MenuItem>
      </MenuPopup>
    </Menu>
  );
}

const parent = () => screen.getByRole("menuitem", { name: "Recent Items" });

describe("Submenu", () => {
  it("marks its parent item and stays out of the document until opened", async () => {
    render(<AppleMenu />);
    await screen.findAllByRole("menu");
    expect(parent()).toHaveClass("mac-menu-item", "mac-submenu-trigger");
    expect(parent()).toHaveAttribute("aria-haspopup", "menu");
    expect(parent()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.queryByRole("menuitem", { name: "Clear Menu" })).not.toBeInTheDocument();
  });

  it("opens with Right Arrow, moving into the submenu, and closes with Left Arrow", async () => {
    const user = userEvent.setup();
    render(<AppleMenu />);
    await screen.findAllByRole("menu");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(parent()).toHaveAttribute("data-highlighted"));

    await user.keyboard("{ArrowRight}");
    const first = await screen.findByRole("menuitem", { name: "Calculator" });
    await waitFor(() => expect(first).toHaveAttribute("data-highlighted"));
    expect(parent()).toHaveAttribute("aria-expanded", "true");
    expect(parent()).toHaveAttribute("data-popup-open");
    const submenu = first.closest('[role="menu"]');
    expect(submenu).toHaveClass("mac-menu", "mac-submenu");
    expect(submenu).not.toHaveAttribute("data-attached");

    await user.keyboard("{ArrowLeft}");
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "Calculator" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await waitFor(() => expect(parent()).toHaveFocus());
  });

  it("opens when the pointer rests on the parent item", async () => {
    const user = userEvent.setup();
    render(<AppleMenu />);
    await screen.findAllByRole("menu");
    await user.hover(parent());
    expect(await screen.findByRole("menuitem", { name: "Clear Menu" })).toBeInTheDocument();
  });

  it("closes the whole menu when a submenu item is chosen", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<AppleMenu onClear={onClear} />);
    await screen.findAllByRole("menu");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(parent()).toHaveAttribute("data-highlighted"));
    await user.keyboard("{ArrowRight}");
    const first = await screen.findByRole("menuitem", { name: "Calculator" });
    await waitFor(() => expect(first).toHaveAttribute("data-highlighted"));
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Clear Menu" })).toHaveAttribute(
        "data-highlighted",
      ),
    );
    await user.keyboard("{Enter}");
    expect(onClear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it.each([
    ["its own disabled prop", { disabled: true }],
    ["a disabled Submenu", { rootDisabled: true }],
  ])(
    "does not open from a parent item disabled by %s, which the arrow keys pass over",
    async (_, props) => {
      const user = userEvent.setup();
      render(<AppleMenu {...props} />);
      await screen.findAllByRole("menu");
      expect(parent()).toHaveAttribute("aria-disabled", "true");
      expect(parent()).toHaveAttribute("aria-haspopup", "menu");
      expect(parent()).toHaveClass("mac-menu-item", "mac-submenu-trigger");
      await user.click(parent());
      expect(screen.queryByRole("menuitem", { name: "Clear Menu" })).not.toBeInTheDocument();
      await user.keyboard("{ArrowDown}{ArrowDown}");
      await waitFor(() =>
        expect(screen.getByRole("menuitem", { name: "Sleep" })).toHaveAttribute("data-highlighted"),
      );
    },
  );

  it("forwards ref, className and attributes to the submenu", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    render(<AppleMenu popup={{ ref, className: "extra", id: "recent", size: "small" }} />);
    await screen.findAllByRole("menu");
    await user.click(parent());
    const item = await screen.findByRole("menuitem", { name: "Calculator" });
    const submenu = item.closest('[role="menu"]');
    expect(ref.current).toBe(submenu);
    expect(submenu).toHaveClass("mac-menu", "mac-submenu", "extra");
    expect(submenu).toHaveAttribute("id", "recent");
    expect(submenu).toHaveAttribute("data-size", "small");
  });
});
