import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MenuItem, MenuSeparator } from "../menu-item";
import { Menu, MenuPopup, type MenuPopupProps, MenuTrigger } from "./index";

function FileMenu({
  onOpen = () => {},
  onClose = () => {},
  popup,
}: {
  onOpen?: () => void;
  onClose?: () => void;
  popup?: MenuPopupProps;
}) {
  return (
    <Menu>
      <MenuTrigger>File</MenuTrigger>
      <MenuPopup {...popup}>
        <MenuItem onClick={onOpen}>Open</MenuItem>
        <MenuItem disabled>Open Recent</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={onClose}>Close Window</MenuItem>
        <MenuItem>Save</MenuItem>
      </MenuPopup>
    </Menu>
  );
}

const highlighted = () => document.querySelector("[data-highlighted]");

describe("Menu", () => {
  it("is not in the document until its trigger opens it", async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    const trigger = screen.getByRole("button", { name: "File" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger);
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("mac-menu");
    expect(menu).not.toHaveAttribute("data-attached");
    expect(menu).not.toHaveAttribute("data-size");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
  });

  it("chooses an item with the pointer and closes", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<FileMenu onOpen={onOpen} />);
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("moves with the arrow keys, skipping disabled items and separators, and chooses with Return", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FileMenu onClose={onClose} />);
    screen.getByRole("button", { name: "File" }).focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("menu");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Open"));

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Close Window"));
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Save"));
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Close Window"));

    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("selects by typing the start of a title, passing over disabled items", async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await user.click(screen.getByRole("button", { name: "File" }));
    await screen.findByRole("menu");
    await user.keyboard("s");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Save"));
    // "Open" and the disabled "Open Recent" both start with O: only the first can be reached.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await user.keyboard("o");
    await waitFor(() => expect(highlighted()).toHaveTextContent(/^Open$/));
    await user.keyboard("o");
    await waitFor(() => expect(highlighted()).toHaveTextContent(/^Open$/));
  });

  it("does not choose, focus or highlight a disabled item", async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    await user.click(screen.getByRole("button", { name: "File" }));
    const item = await screen.findByRole("menuitem", { name: "Open Recent" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("data-disabled");
    expect(item).toHaveClass("mac-menu-item");
    await user.click(item);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(item).not.toHaveAttribute("data-highlighted");
    expect(item).not.toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<FileMenu />);
    const trigger = screen.getByRole("button", { name: "File" });
    await user.click(trigger);
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("can be controlled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Menu
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <MenuTrigger>Edit</MenuTrigger>
          <MenuPopup>
            <MenuItem>Undo</MenuItem>
          </MenuPopup>
        </Menu>
      );
    }
    render(<Controlled />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(true));
    await user.click(await screen.findByRole("menuitem", { name: "Undo" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
  });

  it("renders the trigger as another element", () => {
    render(
      <Menu>
        <MenuTrigger render={<button type="button" className="my-button" />}>View</MenuTrigger>
        <MenuPopup>
          <MenuItem>As Icons</MenuItem>
        </MenuPopup>
      </Menu>,
    );
    expect(screen.getByRole("button", { name: "View" })).toHaveClass("my-button");
  });
});

describe("MenuPopup", () => {
  it("reflects attached and size, and forwards ref, className and attributes", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    render(
      <FileMenu
        popup={{ attached: true, size: "small", ref, className: "extra", id: "file-menu" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "File" }));
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveAttribute("data-attached");
    expect(menu).toHaveAttribute("data-size", "small");
    expect(menu).toHaveClass("mac-menu", "extra");
    expect(menu).toHaveAttribute("id", "file-menu");
    expect(ref.current).toBe(menu);
  });

  it("keeps Base UI's function form of className", async () => {
    const user = userEvent.setup();
    render(<FileMenu popup={{ className: (state) => (state.open ? "is-open" : "is-closed") }} />);
    await user.click(screen.getByRole("button", { name: "File" }));
    expect(await screen.findByRole("menu")).toHaveClass("mac-menu", "is-open");
  });

  it("renders into the given container", async () => {
    const user = userEvent.setup();
    const container = document.createElement("div");
    document.body.append(container);
    render(<FileMenu popup={{ container }} />);
    await user.click(screen.getByRole("button", { name: "File" }));
    expect(container).toContainElement(await screen.findByRole("menu"));
    container.remove();
  });
});
