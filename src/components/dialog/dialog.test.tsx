import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, createRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DefaultButton } from "../default-button";
import { TextField } from "../text-field";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogTrigger,
} from "./index";

interface ExampleProps extends ComponentProps<typeof Dialog> {
  popup?: Partial<ComponentProps<typeof DialogPopup>>;
  onGo?: () => void;
  children?: ReactNode;
}

function Example({ popup, onGo, children, ...root }: ExampleProps) {
  return (
    <>
      <button type="button">Outside</button>
      <Dialog {...root}>
        <DialogTrigger>Go to Folder…</DialogTrigger>
        <DialogPopup title="Go to Folder" {...popup}>
          <DialogDescription>Type the path of a folder.</DialogDescription>
          {children}
          <DialogActions leading={<DialogClose>Help</DialogClose>}>
            <DialogClose>Cancel</DialogClose>
            <DialogClose render={<DefaultButton />} onClick={onGo}>
              Go
            </DialogClose>
          </DialogActions>
        </DialogPopup>
      </Dialog>
    </>
  );
}

const dialog = () => screen.getByRole("dialog");
const gone = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

describe("Dialog", () => {
  it("is not in the document until it opens", async () => {
    const user = userEvent.setup();
    render(<Example />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to Folder…" }));
    expect(dialog()).toHaveClass("mac-window", "mac-dialog");
  });

  it("is a key window named by its title and described by its description", () => {
    render(<Example defaultOpen />);
    expect(dialog()).toHaveAccessibleName("Go to Folder");
    expect(dialog()).toHaveAccessibleDescription("Type the path of a folder.");
    expect(dialog()).toHaveAttribute("data-window-state", "key");
    expect(screen.getByText("Type the path of a folder.")).toHaveClass("mac-dialog-description");
  });

  it("takes an aria-label when it has no title", () => {
    render(<Example defaultOpen popup={{ title: undefined, "aria-label": "Go" }} />);
    expect(dialog()).toHaveAccessibleName("Go");
  });

  it("shows window controls in its title bar when given them", () => {
    render(<Example defaultOpen popup={{ controls: <button type="button">Close</button> }} />);
    expect(within(dialog()).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("is drawn in the window state it is given, for a modeless dialog that is not key", () => {
    render(<Example defaultOpen modal={false} popup={{ state: "inactive" }} />);
    expect(dialog()).toHaveAttribute("data-window-state", "inactive");
  });

  it("reports a press on its title bar, and not one on a window control, for a window manager", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Example
        defaultOpen
        popup={{
          controls: <button type="button">Close</button>,
          onDragRegionPointerDown,
          onDragRegionDoubleClick,
        }}
      />,
    );
    const close = within(dialog()).getByRole("button", { name: "Close" });
    await user.pointer([{ keys: "[MouseLeft>]", target: close }, { keys: "[/MouseLeft]" }]);
    await user.dblClick(close);
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    expect(onDragRegionDoubleClick).not.toHaveBeenCalled();
    const bar = dialog().querySelector("[data-window-drag-region]") as HTMLElement;
    await user.pointer([{ keys: "[MouseLeft>]", target: bar }, { keys: "[/MouseLeft]" }]);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // The body is not a drag region: a press there is the content's.
    onDragRegionPointerDown.mockClear();
    await user.pointer([
      { keys: "[MouseLeft>]", target: screen.getByText("Type the path of a folder.") },
      { keys: "[/MouseLeft]" },
    ]);
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
  });

  it("lets a handler on the window cancel a press or a double click on its title bar", () => {
    const order: string[] = [];
    let cancel = true;
    render(
      <Example
        defaultOpen
        popup={{
          onPointerDownCapture: (event) => {
            order.push("window");
            if (cancel) event.preventDefault();
          },
          onDoubleClickCapture: (event) => {
            order.push("window");
            if (cancel) event.preventDefault();
          },
          onDragRegionPointerDown: () => order.push("bar"),
          onDragRegionDoubleClick: () => order.push("bar"),
        }}
      />,
    );
    const bar = dialog().querySelector("[data-window-drag-region]") as HTMLElement;

    // Cancelled by the window: neither the press nor the double click is reported.
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    expect(order).toEqual(["window", "window"]);

    // Not cancelled: the window hears each first, then the title bar reports it.
    cancel = false;
    order.length = 0;
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    expect(order).toEqual(["window", "bar", "window", "bar"]);
  });

  it("takes the focus itself when it holds nothing to type in", async () => {
    render(<Example defaultOpen />);
    await waitFor(() => expect(dialog()).toHaveFocus());
  });

  it("gives the focus to its first text field, passing over what cannot take it", async () => {
    render(
      <Example defaultOpen>
        <input type="checkbox" aria-label="Remember" />
        <input type="text" aria-label="Disabled" disabled />
        <fieldset disabled>
          <input type="text" aria-label="In a disabled group" />
        </fieldset>
        <div data-autofocus>Not focusable</div>
        <button type="button" data-autofocus style={{ visibility: "hidden" }}>
          Hidden
        </button>
        <div style={{ display: "none" }}>
          <input type="text" aria-label="Not rendered" />
        </div>
        <div style={{ visibility: "hidden" }}>
          <input type="text" aria-label="Invisible" />
        </div>
        <div inert>
          <input type="text" aria-label="Inert" />
        </div>
        <details>
          <summary>More</summary>
          <input type="text" aria-label="In closed details" />
        </details>
        <TextField aria-label="Folder" />
      </Example>,
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Folder" })).toHaveFocus());
  });

  it("passes over what the browser reports as not rendered", async () => {
    // What checkVisibility answers for content-visibility: hidden, which jsdom does not lay out.
    const rendered = vi.fn(function (this: Element) {
      return !this.closest("[data-skipped]");
    });
    Object.defineProperty(HTMLElement.prototype, "checkVisibility", {
      configurable: true,
      value: rendered,
    });
    try {
      render(
        <Example defaultOpen>
          <div data-skipped>
            <button type="button" data-autofocus>
              Skipped
            </button>
            <input type="text" aria-label="Skipped field" />
          </div>
          <TextField aria-label="Folder" />
        </Example>,
      );
      await waitFor(() => expect(screen.getByRole("textbox", { name: "Folder" })).toHaveFocus());
      expect(rendered).toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "checkVisibility");
    }
  });

  it("turns a top given in style into the variable its height limit is computed from", () => {
    const { unmount } = render(<Example defaultOpen popup={{ style: { top: 120, left: 8 } }} />);
    expect(dialog().style.getPropertyValue("--mac-dialog-top")).toBe("120px");
    expect(dialog().style.top).toBe("");
    expect(dialog().style.left).toBe("8px");
    unmount();

    render(<Example defaultOpen popup={{ style: () => ({ top: "10vh" }) }} />);
    expect(dialog().style.getPropertyValue("--mac-dialog-top")).toBe("10vh");
    expect(dialog().style.top).toBe("");
  });

  it("prefers the element marked data-autofocus, and initialFocus over both", async () => {
    const { unmount } = render(
      <Example defaultOpen>
        <TextField aria-label="Folder" />
        <button type="button" data-autofocus>
          Browse…
        </button>
      </Example>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Browse…" })).toHaveFocus());
    unmount();

    const field = createRef<HTMLInputElement>();
    render(
      <Example defaultOpen popup={{ initialFocus: field }}>
        <TextField aria-label="Server" />
        <input aria-label="Folder" ref={field} />
      </Example>,
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Folder" })).toHaveFocus());
  });

  it("closes on Escape and reports it", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen onOpenChange={onOpenChange} />);
    await waitFor(() => expect(dialog()).toHaveFocus());
    await user.keyboard("{Escape}");
    await gone();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it("stays open when something outside is clicked", async () => {
    const user = userEvent.setup();
    render(<Example defaultOpen modal={false} />);
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(dialog()).toBeInTheDocument();
  });

  it("closes on a click outside when pointer dismissal is allowed", async () => {
    const user = userEvent.setup();
    render(<Example defaultOpen modal={false} disablePointerDismissal={false} />);
    await user.click(screen.getByRole("button", { name: "Outside" }));
    await gone();
  });

  it("hides the page from assistive technology while modal, and not as a modeless panel", () => {
    const { unmount } = render(<Example defaultOpen />);
    expect(screen.queryByRole("button", { name: "Outside" })).not.toBeInTheDocument();
    unmount();
    render(<Example defaultOpen modal={false} />);
    expect(screen.getByRole("button", { name: "Outside" })).toBeInTheDocument();
  });

  it("closes from its buttons, which are push buttons", async () => {
    const user = userEvent.setup();
    render(<Example defaultOpen />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveClass("mac-push-button");
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("data-variant", "primary");
    await user.click(cancel);
    await gone();
  });

  it("activates the default button on Return from a text field", async () => {
    const user = userEvent.setup();
    const onGo = vi.fn();
    render(
      <Example defaultOpen onGo={onGo}>
        <TextField aria-label="Folder" />
      </Example>,
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Folder" })).toHaveFocus());
    await user.keyboard("~/Documents{Enter}");
    expect(onGo).toHaveBeenCalledTimes(1);
    await gone();
  });

  it("follows a controlled open prop", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Example open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    expect(dialog()).toBeInTheDocument();
    rerender(<Example open={false} onOpenChange={onOpenChange} />);
    await gone();
  });

  it("returns the focus to its trigger when it closes", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Go to Folder…" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await gone();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps Tab and Shift+Tab inside while modal, reaching every button", async () => {
    const user = userEvent.setup();
    render(<Example defaultOpen />);
    await waitFor(() => expect(dialog()).toHaveFocus());
    for (const shift of [false, true]) {
      const visited = new Set<string | null | undefined>();
      for (let press = 0; press < 5; press++) {
        await user.tab({ shift });
        // Past the last button the focus wraps round; it never reaches the page behind.
        await waitFor(() =>
          expect(dialog()).toContainElement(document.activeElement as HTMLElement),
        );
        visited.add(document.activeElement?.textContent);
      }
      expect(visited).toEqual(new Set(["Help", "Cancel", "Go"]));
    }
  });

  it("sets its width, and merges className, style, ref and other props on the window", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Example
        defaultOpen
        popup={{ width: 429, className: "mine", style: { left: 40 }, ref, id: "go" }}
      />,
    );
    expect(ref.current).toBe(dialog());
    expect(dialog()).toHaveClass("mac-dialog", "mine");
    expect(dialog()).toHaveStyle({ width: "429px", left: "40px" });
    expect(dialog()).toHaveAttribute("id", "go");
  });

  it("renders into a container", () => {
    const container = document.createElement("div");
    document.body.append(container);
    try {
      render(<Example defaultOpen popup={{ container }} />);
      expect(container).toContainElement(dialog());
    } finally {
      container.remove();
    }
  });
});

describe("DialogActions", () => {
  it("puts leading controls first and the dismissing buttons in the trailing group", () => {
    render(<Example defaultOpen />);
    const row = screen.getByRole("button", { name: "Cancel" }).closest(".mac-dialog-actions");
    const names = within(row as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(names).toEqual(["Help", "Cancel", "Go"]);
    expect(row).not.toHaveAttribute("data-divider");
  });

  it("marks the divider, and forwards its props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <DialogActions divider ref={ref} className="mine" data-testid="row">
        <button type="button">OK</button>
      </DialogActions>,
    );
    const row = screen.getByTestId("row");
    expect(ref.current).toBe(row);
    expect(row).toHaveClass("mac-dialog-actions", "mine");
    expect(row).toHaveAttribute("data-divider");
    expect(row.children).toHaveLength(1);
  });
});
