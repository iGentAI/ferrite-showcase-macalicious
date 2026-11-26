import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, createRef, type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DefaultButton } from "../default-button";
import { TextField } from "../text-field";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "./index";

interface ExampleProps extends ComponentProps<typeof Sheet> {
  popup?: Partial<ComponentProps<typeof SheetPopup>>;
  onSave?: () => void;
  children?: ReactNode;
}

/** A window's title bar, a control outside the sheet, and a sheet with the usual parts. */
function Example({ popup, onSave, children, ...root }: ExampleProps) {
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <div ref={setBar}>Untitled</div>
      <button type="button">Outside</button>
      <Sheet {...root}>
        <SheetTrigger>Export…</SheetTrigger>
        <SheetPopup anchor={bar} {...popup}>
          <SheetTitle>Export the document?</SheetTitle>
          <SheetDescription>It is saved as a PDF.</SheetDescription>
          {children}
          <SheetActions leading={<SheetClose>Delete</SheetClose>}>
            <SheetClose>Cancel</SheetClose>
            <SheetClose render={<DefaultButton />} onClick={onSave}>
              Save
            </SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </>
  );
}

const sheet = () => screen.getByRole("dialog");
const gone = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

/**
 * A control of the page behind the sheet. While a sheet is open the rest of the page is hidden
 * from assistive technology, so it is not found by its role.
 */
const outside = () => screen.getByText("Outside");

describe("Sheet", () => {
  it("is not in the document until it opens", async () => {
    const user = userEvent.setup();
    render(<Example />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export…" }));
    expect(sheet()).toHaveClass("mac-sheet");
  });

  it("is a modal dialog named by its title and described by its description", () => {
    render(<Example defaultOpen />);
    expect(sheet()).toHaveAttribute("aria-modal", "true");
    expect(sheet()).toHaveAccessibleName("Export the document?");
    expect(sheet()).toHaveAccessibleDescription("It is saved as a PDF.");
    expect(screen.getByText("Export the document?")).toHaveClass("mac-sheet-title");
    expect(screen.getByText("It is saved as a PDF.")).toHaveClass("mac-sheet-description");
  });

  it("takes the focus itself when it holds nothing to type in", async () => {
    render(<Example defaultOpen />);
    await waitFor(() => expect(sheet()).toHaveFocus());
  });

  it("gives the focus to its first text field, passing over what cannot take it", async () => {
    render(
      <Example defaultOpen>
        <input type="checkbox" aria-label="Two-sided" />
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
        <TextField aria-label="Name" defaultValue="Untitled" />
      </Example>,
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus());
  });

  it("prefers the element marked data-autofocus, unless it is disabled", async () => {
    const { unmount } = render(
      <Example defaultOpen>
        <TextField aria-label="Name" />
        <button type="button" data-autofocus>
          Choose…
        </button>
      </Example>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose…" })).toHaveFocus());
    unmount();

    render(
      <Example defaultOpen>
        <TextField aria-label="Name" />
        <button type="button" data-autofocus disabled>
          Choose…
        </button>
      </Example>,
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus());
  });

  it("gives the focus to initialFocus when it is set", async () => {
    const cancel = createRef<HTMLButtonElement>();
    function Initial() {
      return (
        <Sheet defaultOpen>
          <SheetPopup anchor={null} aria-label="Export" initialFocus={cancel}>
            <TextField aria-label="Name" />
            <SheetActions>
              <SheetClose ref={cancel}>Cancel</SheetClose>
            </SheetActions>
          </SheetPopup>
        </Sheet>
      );
    }
    render(<Initial />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("closes on Escape and reports it", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen onOpenChange={onOpenChange} />);
    await waitFor(() => expect(sheet()).toHaveFocus());
    await user.keyboard("{Escape}");
    await gone();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it("stays open when something outside is clicked, and does not report it", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen onOpenChange={onOpenChange} />);
    await user.click(outside());
    expect(sheet()).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes on a click outside when dismissible", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Example defaultOpen dismissible onOpenChange={onOpenChange} />);
    await user.click(outside());
    await gone();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it("closes from its buttons, which are push buttons", async () => {
    const user = userEvent.setup();
    render(<Example defaultOpen />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveClass("mac-push-button");
    expect(cancel).toHaveAttribute("data-variant", "standard");
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("data-variant", "primary");
    await user.click(cancel);
    await gone();
  });

  it("activates the default button on Return, from the sheet and from a text field", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { unmount } = render(<Example defaultOpen onSave={onSave} />);
    await waitFor(() => expect(sheet()).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledTimes(1);
    await gone();
    unmount();

    render(
      <Example defaultOpen onSave={onSave}>
        <TextField aria-label="Name" />
      </Example>,
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledTimes(2);
    await gone();
  });

  it("follows a controlled open prop", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Example open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    expect(sheet()).toBeInTheDocument();
    rerender(<Example open={false} onOpenChange={onOpenChange} />);
    await gone();
  });

  it("returns the focus to its trigger when it closes", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Export…" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await gone();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps Tab and Shift+Tab inside, reaching every button", async () => {
    const user = userEvent.setup();
    render(<Example defaultOpen />);
    await waitFor(() => expect(sheet()).toHaveFocus());
    for (const shift of [false, true]) {
      const visited = new Set<string | null | undefined>();
      for (let press = 0; press < 5; press++) {
        await user.tab({ shift });
        // Past the last button the focus wraps round; it never reaches the window behind.
        await waitFor(() =>
          expect(sheet()).toContainElement(document.activeElement as HTMLElement),
        );
        visited.add(document.activeElement?.textContent);
      }
      expect(visited).toEqual(new Set(["Delete", "Cancel", "Save"]));
    }
  });

  it("sets its width on the positioner, and merges className, style, ref and other props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Example
        defaultOpen
        popup={{
          width: 360,
          className: "mine",
          style: { height: 200 },
          ref,
          id: "export-sheet",
        }}
      />,
    );
    expect(ref.current).toBe(sheet());
    expect(sheet()).toHaveClass("mac-sheet", "mine");
    expect(sheet()).toHaveStyle({ height: "200px" });
    expect(sheet()).toHaveAttribute("id", "export-sheet");
    expect(sheet().parentElement?.style.getPropertyValue("--mac-sheet-width")).toBe("360px");
  });

  it("takes a width as any CSS length", () => {
    render(<Example defaultOpen popup={{ width: "30rem" }} />);
    expect(sheet().parentElement?.style.getPropertyValue("--mac-sheet-width")).toBe("30rem");
  });

  it("stays modal whatever it is given", () => {
    // @ts-expect-error a sheet is never non-modal
    render(<Example defaultOpen modal={false} />);
    expect(sheet()).toHaveAttribute("aria-modal", "true");
    // Modal means the rest of the page is hidden from assistive technology.
    expect(screen.queryByRole("button", { name: "Outside" })).not.toBeInTheDocument();
  });

  it("renders into a container", () => {
    const container = document.createElement("div");
    document.body.append(container);
    try {
      render(<Example defaultOpen popup={{ container }} />);
      expect(container).toContainElement(sheet());
    } finally {
      container.remove();
    }
  });
});

describe("SheetActions", () => {
  it("puts leading controls first and the dismissing buttons in the trailing group", () => {
    render(<Example defaultOpen />);
    const row = screen.getByRole("button", { name: "Cancel" }).closest(".mac-sheet-actions");
    expect(row).not.toBeNull();
    const names = within(row as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(names).toEqual(["Delete", "Cancel", "Save"]);
    expect(screen.getByRole("button", { name: "Delete" }).parentElement).toHaveClass(
      "mac-sheet-actions-leading",
    );
    expect(screen.getByRole("button", { name: "Save" }).parentElement).toHaveClass(
      "mac-sheet-actions-trailing",
    );
  });

  it("renders no leading group without leading controls, and forwards its props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SheetActions ref={ref} className="mine" data-testid="row">
        <button type="button">OK</button>
      </SheetActions>,
    );
    const row = screen.getByTestId("row");
    expect(ref.current).toBe(row);
    expect(row).toHaveClass("mac-sheet-actions", "mine");
    expect(row.children).toHaveLength(1);
  });
});
