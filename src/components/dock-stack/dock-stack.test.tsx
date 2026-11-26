import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dock, DockItem } from "../dock";
import { DockStack, DockStackItem, DockStackMore } from "./index";

/** A Dock with an application and a stack of two files and the element that opens the folder. */
function Example(props: Partial<Parameters<typeof DockStack>[0]>) {
  return (
    <Dock>
      <DockItem label="Files" />
      <DockStack label="Downloads" {...props}>
        <DockStackMore>Open in Finder</DockStackMore>
        <DockStackItem>Dunes.jpg</DockStackItem>
        <DockStackItem>Harbour.jpg</DockStackItem>
      </DockStack>
    </Dock>
  );
}

const tile = () => screen.getByRole("button", { name: "Downloads" });
const entry = (name: string) => screen.getByRole("menuitem", { name });

describe("DockStack", () => {
  it("is a Dock tile that announces a menu, and keeps the menu out of the document until it opens", () => {
    render(<Example />);
    expect(tile()).toHaveClass("mac-dock-item", "mac-dock-stack");
    expect(tile()).toHaveAttribute("aria-haspopup", "menu");
    expect(tile()).toHaveAttribute("aria-expanded", "false");
    expect(tile()).not.toHaveAttribute("data-popup-open");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByText("Dunes.jpg")).toBeNull();
  });

  it("springs its contents out when clicked, as a menu of items in the fan view", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(tile());
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveClass("mac-dock-stack-popup");
    expect(menu).toHaveAttribute("data-view", "fan");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Open in Finder",
      "Dunes.jpg",
      "Harbour.jpg",
    ]);
    expect(tile()).toHaveAttribute("aria-expanded", "true");
    expect(tile()).toHaveAttribute("data-popup-open");
  });

  it("closes when clicked again", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(tile());
    await screen.findByRole("menu");
    await user.click(tile());
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(tile()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens from the keyboard with Up, on the item nearest the Dock, and moves with the arrows", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(tile()).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(entry("Harbour.jpg")).toHaveFocus());
    expect(entry("Harbour.jpg")).toHaveAttribute("data-highlighted");
    await user.keyboard("{ArrowUp}");
    expect(entry("Dunes.jpg")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(entry("Open in Finder")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(entry("Dunes.jpg")).toHaveFocus();
  });

  it("opens with Return and with Space, on the first item", async () => {
    const user = userEvent.setup();
    render(<Example />);
    tile().focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(entry("Open in Finder")).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await user.keyboard(" ");
    await waitFor(() => expect(entry("Open in Finder")).toHaveFocus());
  });

  it("opens with Down too, on the first item, and finds an item by its first letters", async () => {
    const user = userEvent.setup();
    render(<Example />);
    tile().focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(entry("Open in Finder")).toHaveFocus());
    await user.keyboard("ha");
    expect(entry("Harbour.jpg")).toHaveFocus();
  });

  it("lets Up and Down move past it in a Dock on a side, where Return opens it", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(
      <Dock position="left">
        <DockItem label="Files" />
        <DockStack label="Downloads" onKeyDown={onKeyDown}>
          <DockStackItem>Dunes.jpg</DockStackItem>
        </DockStack>
        <DockItem label="Bin" />
      </Dock>,
    );
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(tile()).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Bin" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("button", { name: "Files" })).toHaveFocus();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onKeyDown).toHaveBeenCalledTimes(2);

    await user.keyboard("{ArrowDown}{Enter}");
    expect(await screen.findByRole("menuitem", { name: "Dunes.jpg" })).toBeInTheDocument();
  });

  it("shows the view it is given", async () => {
    const { rerender } = render(<Example view="grid" defaultOpen />);
    expect(await screen.findByRole("menu")).toHaveAttribute("data-view", "grid");
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    rerender(<Example view="list" defaultOpen />);
    expect(screen.getByRole("menu")).toHaveAttribute("data-view", "list");
  });

  it("closes with Escape and gives the focus back to the tile", async () => {
    const user = userEvent.setup();
    render(<Example />);
    tile().focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(tile()).toHaveFocus();
  });

  it("closes when the focus leaves with Tab, and with a press elsewhere", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Example />
        <p>Desktop</p>
      </>,
    );
    tile().focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(entry("Open in Finder")).toHaveFocus());
    await user.tab();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(tile()).toHaveFocus();

    await user.click(tile());
    await screen.findByRole("menu");
    await user.click(screen.getByText("Desktop"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("keeps the keys pressed in the open stack from the Dock", async () => {
    const user = userEvent.setup();
    render(<Example />);
    tile().focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(entry("Open in Finder")).toHaveFocus());
    await user.keyboard("{End}");
    expect(entry("Harbour.jpg")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(entry("Open in Finder")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Files", hidden: true })).not.toHaveFocus();
  });

  it("opens an item with a click or Return, and closes", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <Dock>
        <DockStack label="Downloads">
          <DockStackItem onClick={() => onOpen("dunes")}>Dunes.jpg</DockStackItem>
          <DockStackItem onClick={() => onOpen("harbour")}>Harbour.jpg</DockStackItem>
        </DockStack>
      </Dock>,
    );
    await user.click(tile());
    await user.click(await screen.findByRole("menuitem", { name: "Dunes.jpg" }));
    expect(onOpen).toHaveBeenLastCalledWith("dunes");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    tile().focus();
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(entry("Harbour.jpg")).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenLastCalledWith("harbour");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("does not open a disabled item", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Dock>
        <DockStack label="Downloads" defaultOpen>
          <DockStackItem disabled onClick={onClick}>
            Dunes.jpg
          </DockStackItem>
        </DockStack>
      </Dock>,
    );
    const item = await screen.findByRole("menuitem", { name: "Dunes.jpg" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("data-disabled");
    await user.click(item);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("starts open with defaultOpen and reports every change", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen onOpenChange={onOpenChange} />);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    await user.click(tile());
    // A press opens on the next frame, once the focus has settled on the tile.
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(2));
    expect(onOpenChange.mock.calls[1]?.[0]).toBe(true);
  });

  it("is controlled with open: it asks to change and waits for the answer", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Example open={false} onOpenChange={onOpenChange} />);
    await user.click(tile());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(1));
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();

    rerender(<Example open onOpenChange={onOpenChange} />);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("follows a parent's state", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <output>{open ? "open" : "closed"}</output>
          <Example open={open} onOpenChange={setOpen} />
        </>
      );
    }
    render(<Controlled />);
    await user.click(tile());
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent("open");
  });

  it("passes the tile's props on: icon, running, ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <Dock>
        <DockStack
          ref={ref}
          label="Downloads"
          icon={<span data-testid="icon" />}
          running
          id="downloads"
          className="extra"
          data-folder="downloads"
        />
      </Dock>,
    );
    expect(ref.current).toBe(tile());
    expect(ref.current).toHaveClass("mac-dock-item", "mac-dock-stack", "extra");
    expect(ref.current).toHaveAttribute("id", "downloads");
    expect(ref.current).toHaveAttribute("data-folder", "downloads");
    expect(ref.current).toHaveAttribute("data-running");
    expect(tile()).toHaveAccessibleDescription("running");
    expect(tile()).toContainElement(screen.getByTestId("icon"));
  });

  it("joins the Dock's arrow keys, and works outside a Dock too", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Example />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Files" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tile()).toHaveFocus();
    unmount();

    render(
      <DockStack label="Downloads">
        <DockStackItem>Dunes.jpg</DockStackItem>
      </DockStack>,
    );
    await user.click(tile());
    expect(await screen.findByRole("menuitem", { name: "Dunes.jpg" })).toBeInTheDocument();
  });
});

describe("DockStackItem", () => {
  it("is a menu item named by its text, with its icon hidden from assistive technology", async () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Dock>
        <DockStack label="Downloads" defaultOpen>
          <DockStackItem
            ref={ref}
            icon={<span data-testid="thumbnail" />}
            id="dunes"
            className="extra"
            data-kind="image"
          >
            Dunes.jpg
          </DockStackItem>
        </DockStack>
      </Dock>,
    );
    const item = await screen.findByRole("menuitem", { name: "Dunes.jpg" });
    expect(ref.current).toBe(item);
    expect(item).toHaveClass("mac-dock-stack-item", "extra");
    expect(item).toHaveAttribute("id", "dunes");
    expect(item).toHaveAttribute("data-kind", "image");
    expect(item).not.toHaveAttribute("data-more");
    expect(screen.getByTestId("thumbnail").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});

describe("DockStackMore", () => {
  it("is the menu item that opens the folder, with a decorative arrow", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <Dock>
        <DockStack label="Downloads" defaultOpen>
          <DockStackMore ref={ref} className="extra" id="more" onClick={onClick}>
            7 More in Finder
          </DockStackMore>
          <DockStackItem>Dunes.jpg</DockStackItem>
        </DockStack>
      </Dock>,
    );
    const more = await screen.findByRole("menuitem", { name: "7 More in Finder" });
    expect(ref.current).toBe(more);
    expect(more).toHaveClass("mac-dock-stack-item", "extra");
    expect(more).toHaveAttribute("id", "more");
    expect(more).toHaveAttribute("data-more");
    expect(more.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    await user.click(more);
    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});
