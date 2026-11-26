import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, createRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DefaultButton } from "../default-button";
import {
  Alert,
  AlertAccessory,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
  AlertTrigger,
} from "./index";

interface ExampleProps extends ComponentProps<typeof Alert> {
  popup?: Partial<ComponentProps<typeof AlertPopup>>;
  onErase?: () => void;
  children?: ReactNode;
}

function Example({ popup, onErase, children, ...root }: ExampleProps) {
  return (
    <>
      <button type="button">Outside</button>
      <Alert {...root}>
        <AlertTrigger>Empty Trash…</AlertTrigger>
        <AlertPopup {...popup}>
          <AlertMessage>Erase the items in the Trash?</AlertMessage>
          <AlertInformativeText>You can’t undo this action.</AlertInformativeText>
          {children}
          <AlertButtons leading={<AlertClose>Help</AlertClose>}>
            <AlertClose>Cancel</AlertClose>
            <AlertClose render={<DefaultButton />} onClick={onErase}>
              Erase
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </>
  );
}

const alert = () => screen.getByRole("alertdialog");
const gone = () => waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

describe("Alert", () => {
  it("is not in the document until it opens", async () => {
    const user = userEvent.setup();
    render(<Example />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Empty Trash…" }));
    expect(alert()).toHaveClass("mac-window", "mac-alert");
  });

  it("is an alert dialog named by its message and described by its informative text", () => {
    render(<Example defaultOpen />);
    expect(alert()).toHaveAccessibleName("Erase the items in the Trash?");
    expect(alert()).toHaveAccessibleDescription("You can’t undo this action.");
    expect(alert()).toHaveAttribute("data-style", "warning");
    expect(alert()).toHaveAttribute("data-size", "regular");
    expect(alert()).toHaveAttribute("data-window-state", "key");
    expect(screen.getByText("Erase the items in the Trash?")).toHaveClass("mac-alert-message");
    expect(screen.getByText("You can’t undo this action.")).toHaveClass(
      "mac-alert-informative-text",
    );
  });

  it("takes the focus itself, so that no button is pressed by accident", async () => {
    render(<Example defaultOpen />);
    await waitFor(() => expect(alert()).toHaveFocus());
  });

  it("gives the focus to the element marked data-autofocus, if it can take it", async () => {
    const { unmount } = render(
      <Example defaultOpen>
        <button type="button" data-autofocus>
          Details
        </button>
      </Example>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Details" })).toHaveFocus());
    unmount();

    render(
      <Example defaultOpen>
        <button type="button" data-autofocus disabled>
          Details
        </button>
        <div data-autofocus>Not focusable</div>
        <button type="button" data-autofocus style={{ visibility: "hidden" }}>
          Hidden
        </button>
        <div style={{ display: "none" }}>
          <button type="button" data-autofocus>
            Not rendered
          </button>
        </div>
        <div inert>
          <button type="button" data-autofocus>
            Inert
          </button>
        </div>
        <details>
          <summary>More</summary>
          <button type="button" data-autofocus>
            In closed details
          </button>
        </details>
      </Example>,
    );
    await waitFor(() => expect(alert()).toHaveFocus());
  });

  it("passes over a marked element the browser reports as not rendered", async () => {
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
          </div>
          <button type="button" data-autofocus>
            Details
          </button>
        </Example>,
      );
      await waitFor(() => expect(screen.getByRole("button", { name: "Details" })).toHaveFocus());
      expect(rendered).toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "checkVisibility");
    }
  });

  it("turns a top given in style into the variable its height limit is computed from", () => {
    const { unmount } = render(<Example defaultOpen popup={{ style: { top: 120, left: 8 } }} />);
    expect(alert().style.getPropertyValue("--mac-alert-top")).toBe("120px");
    expect(alert().style.top).toBe("");
    expect(alert().style.left).toBe("8px");
    unmount();

    render(<Example defaultOpen popup={{ style: () => ({ top: "10vh" }) }} />);
    expect(alert().style.getPropertyValue("--mac-alert-top")).toBe("10vh");
    expect(alert().style.top).toBe("");
  });

  it("closes on Escape and reports it", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen onOpenChange={onOpenChange} />);
    await waitFor(() => expect(alert()).toHaveFocus());
    await user.keyboard("{Escape}");
    await gone();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it("stays open when something outside is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen onOpenChange={onOpenChange} />);
    await user.click(screen.getByText("Outside"));
    expect(alert()).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes from its buttons, which are push buttons", async () => {
    const user = userEvent.setup();
    render(<Example defaultOpen />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveClass("mac-push-button");
    expect(cancel).toHaveAttribute("data-size", "regular");
    expect(screen.getByRole("button", { name: "Erase" })).toHaveAttribute(
      "data-variant",
      "primary",
    );
    await user.click(cancel);
    await gone();
  });

  it("activates the default button on Return", async () => {
    const user = userEvent.setup();
    const onErase = vi.fn();
    render(<Example defaultOpen onErase={onErase} />);
    await waitFor(() => expect(alert()).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onErase).toHaveBeenCalledTimes(1);
    await gone();
  });

  it("follows a controlled open prop", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Example open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    expect(alert()).toBeInTheDocument();
    rerender(<Example open={false} onOpenChange={onOpenChange} />);
    await gone();
  });

  it("returns the focus to its trigger when it closes", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Empty Trash…" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await gone();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps Tab and Shift+Tab inside, reaching every button", async () => {
    const user = userEvent.setup();
    render(<Example defaultOpen />);
    await waitFor(() => expect(alert()).toHaveFocus());
    for (const shift of [false, true]) {
      const visited = new Set<string | null | undefined>();
      for (let press = 0; press < 5; press++) {
        await user.tab({ shift });
        // Past the last button the focus wraps round; it never reaches the page behind.
        await waitFor(() =>
          expect(alert()).toContainElement(document.activeElement as HTMLElement),
        );
        visited.add(document.activeElement?.textContent);
      }
      expect(visited).toEqual(new Set(["Help", "Cancel", "Erase"]));
    }
  });

  it("shows its icon as decoration, badged when the alert is critical", () => {
    const { unmount } = render(
      <Example defaultOpen popup={{ icon: <svg data-testid="icon" /> }} />,
    );
    const icon = screen.getByTestId("icon").parentElement as HTMLElement;
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon.querySelector(".mac-alert-badge")).toBeNull();
    unmount();

    render(
      <Example defaultOpen popup={{ icon: <svg data-testid="icon" />, alertStyle: "critical" }} />,
    );
    expect(alert()).toHaveAttribute("data-style", "critical");
    expect(
      screen.getByTestId("icon").parentElement?.querySelector(".mac-alert-badge"),
    ).not.toBeNull();
  });

  it("draws the compact kind with small buttons and its window controls", () => {
    render(
      <Example
        defaultOpen
        popup={{ size: "small", controls: <button type="button">Minimize</button> }}
      />,
    );
    expect(alert()).toHaveAttribute("data-size", "small");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("data-size", "small");
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument();
  });

  it("reports a press on its title bar for a window manager", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(<Example defaultOpen popup={{ onDragRegionPointerDown, onDragRegionDoubleClick }} />);
    const bar = alert().querySelector("[data-window-drag-region]") as HTMLElement;
    expect(bar).toHaveClass("mac-title-bar");
    await user.pointer([{ keys: "[MouseLeft>]", target: bar }, { keys: "[/MouseLeft]" }]);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // The body of a regular alert is not a drag region.
    onDragRegionPointerDown.mockClear();
    await user.pointer([
      { keys: "[MouseLeft>]", target: screen.getByText("Erase the items in the Trash?") },
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
    const bar = alert().querySelector("[data-window-drag-region]") as HTMLElement;
    expect(bar).toHaveClass("mac-title-bar");

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

  it("reports a press on the body of the compact kind, which has no title bar, and not one on a button", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Example
        defaultOpen
        popup={{ size: "small", onDragRegionPointerDown, onDragRegionDoubleClick }}
      >
        <button type="button">Details</button>
      </Example>,
    );
    const button = screen.getByRole("button", { name: "Details" });
    await user.pointer([{ keys: "[MouseLeft>]", target: button }, { keys: "[/MouseLeft]" }]);
    await user.dblClick(button);
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    expect(onDragRegionDoubleClick).not.toHaveBeenCalled();
    const message = screen.getByText("Erase the items in the Trash?");
    expect(message.closest("[data-window-drag-region]")).toHaveClass("mac-alert-body");
    await user.pointer([{ keys: "[MouseLeft>]", target: message }, { keys: "[/MouseLeft]" }]);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    await user.dblClick(message);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("marks no drag region on the compact kind when no window manager asks", () => {
    render(<Example defaultOpen popup={{ size: "small" }} />);
    expect(alert().querySelector("[data-window-drag-region]")).toBeNull();
  });

  it("sets its width, and merges className, style, ref and other props on the window", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Example
        defaultOpen
        popup={{ width: 500, className: "mine", style: { left: 40 }, ref, id: "erase" }}
      />,
    );
    expect(ref.current).toBe(alert());
    expect(alert()).toHaveClass("mac-alert", "mine");
    expect(alert()).toHaveStyle({ width: "500px", left: "40px" });
    expect(alert()).toHaveAttribute("id", "erase");
  });

  it("renders into a container", () => {
    const container = document.createElement("div");
    document.body.append(container);
    try {
      render(<Example defaultOpen popup={{ container }} />);
      expect(container).toContainElement(alert());
    } finally {
      container.remove();
    }
  });
});

describe("AlertButtons and AlertAccessory", () => {
  it("puts leading controls first and the answers in the trailing group", () => {
    render(<Example defaultOpen />);
    const row = screen.getByRole("button", { name: "Cancel" }).closest(".mac-alert-buttons");
    const names = within(row as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(names).toEqual(["Help", "Cancel", "Erase"]);
    expect(screen.getByRole("button", { name: "Help" }).parentElement).toHaveClass(
      "mac-alert-buttons-leading",
    );
    expect(screen.getByRole("button", { name: "Erase" }).parentElement).toHaveClass(
      "mac-alert-buttons-trailing",
    );
  });

  it("forward their props", () => {
    const row = createRef<HTMLDivElement>();
    const accessory = createRef<HTMLDivElement>();
    render(
      <>
        <AlertAccessory ref={accessory} className="mine" data-testid="accessory" />
        <AlertButtons ref={row} className="mine" data-testid="row">
          <button type="button">OK</button>
        </AlertButtons>
      </>,
    );
    expect(accessory.current).toBe(screen.getByTestId("accessory"));
    expect(accessory.current).toHaveClass("mac-alert-accessory", "mine");
    expect(row.current).toBe(screen.getByTestId("row"));
    expect(row.current).toHaveClass("mac-alert-buttons", "mine");
    expect(row.current?.children).toHaveLength(1);
  });
});
