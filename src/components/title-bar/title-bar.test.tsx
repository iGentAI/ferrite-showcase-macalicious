import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { TitleBar } from "./index";

describe("TitleBar", () => {
  it("renders the standard layout with its title", () => {
    render(<TitleBar title="Untitled" data-testid="bar" />);
    const bar = screen.getByTestId("bar");
    expect(bar).toHaveClass("mac-title-bar");
    expect(bar).toHaveAttribute("data-variant", "standard");
    expect(bar).toHaveAttribute("data-divider", "content");
    expect(bar).toHaveAttribute("data-window-drag-region");
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it.each(["standard", "unified", "title-hidden", "utility"] as const)(
    "reflects the %s variant, also for the toolbar inside",
    (variant) => {
      render(<TitleBar variant={variant} data-testid="bar" />);
      const bar = screen.getByTestId("bar");
      expect(bar).toHaveAttribute("data-variant", variant);
      expect(bar).toHaveAttribute("data-title-bar", variant);
    },
  );

  it.each(["bar", "line"] as const)("reflects the %s divider", (divider) => {
    render(<TitleBar divider={divider} data-testid="bar" />);
    expect(screen.getByTestId("bar")).toHaveAttribute("data-divider", divider);
  });

  it("is opaque and follows the page's appearance unless told otherwise", () => {
    render(<TitleBar data-testid="bar" />);
    const bar = screen.getByTestId("bar");
    expect(bar).toHaveAttribute("data-material", "opaque");
    expect(bar).not.toHaveAttribute("data-appearance");
  });

  it("keeps the appearance a caller gives an opaque bar", () => {
    render(<TitleBar data-appearance="dark" data-testid="bar" />);
    expect(screen.getByTestId("bar")).toHaveAttribute("data-appearance", "dark");
  });

  it.each([
    ["light", "standard"],
    ["light", "unified"],
    ["light", "title-hidden"],
    ["light", "utility"],
    ["dark", "standard"],
    ["dark", "unified"],
    ["dark", "title-hidden"],
    ["dark", "utility"],
  ] as const)("is dark when translucent in a %s page, in the %s layout", (appearance, variant) => {
    render(
      <div data-appearance={appearance}>
        <TitleBar material="translucent" variant={variant} data-testid="bar" />
      </div>,
    );
    const bar = screen.getByTestId("bar");
    expect(bar).toHaveAttribute("data-material", "translucent");
    expect(bar).toHaveAttribute("data-appearance", "dark");
    expect(bar).toHaveAttribute("data-variant", variant);
    expect(bar).toHaveAttribute("data-title-bar", variant);
  });

  it("stays dark when translucent, whatever appearance the caller gives", () => {
    render(<TitleBar material="translucent" data-appearance="light" data-testid="bar" />);
    expect(screen.getByTestId("bar")).toHaveAttribute("data-appearance", "dark");
  });

  it("renders controls, a decorative icon and children", () => {
    render(
      <TitleBar
        title="Notes.txt"
        icon={<svg data-testid="icon" />}
        controls={<button type="button">Close</button>}
      >
        <button type="button">Share</button>
      </TitleBar>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("reports a primary press on the bar itself as the start of a drag", () => {
    const onDrag = vi.fn();
    const onPointerDown = vi.fn();
    render(
      <TitleBar
        title="Untitled"
        data-testid="bar"
        onDragRegionPointerDown={onDrag}
        onPointerDown={onPointerDown}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId("bar"), { button: 0 });
    fireEvent.pointerDown(screen.getByText("Untitled"), { button: 0 });
    expect(onDrag).toHaveBeenCalledTimes(2);
    expect(onPointerDown).toHaveBeenCalledTimes(2);

    fireEvent.pointerDown(screen.getByTestId("bar"), { button: 2 });
    expect(onDrag).toHaveBeenCalledTimes(2);
  });

  it("does not start a drag from a control inside it or from an opted-out element", () => {
    const onDrag = vi.fn();
    const onDoubleClick = vi.fn();
    render(
      <TitleBar
        controls={<button type="button">Close</button>}
        onDragRegionPointerDown={onDrag}
        onDragRegionDoubleClick={onDoubleClick}
      >
        <input aria-label="Search" />
        <span data-window-no-drag="">Handle</span>
      </TitleBar>,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Close" }), { button: 0 });
    fireEvent.pointerDown(screen.getByRole("textbox", { name: "Search" }), { button: 0 });
    fireEvent.pointerDown(screen.getByText("Handle"), { button: 0 });
    fireEvent.doubleClick(screen.getByRole("button", { name: "Close" }));
    expect(onDrag).not.toHaveBeenCalled();
    expect(onDoubleClick).not.toHaveBeenCalled();
  });

  it("reports a double-click on the bar itself", () => {
    const onZoom = vi.fn();
    render(<TitleBar title="Untitled" data-testid="bar" onDragRegionDoubleClick={onZoom} />);
    fireEvent.doubleClick(screen.getByTestId("bar"));
    expect(onZoom).toHaveBeenCalledTimes(1);
  });

  it("lets the caller's own handlers cancel a drag and a double-click", () => {
    const onDrag = vi.fn();
    const onZoom = vi.fn();
    render(
      <TitleBar
        data-testid="bar"
        onPointerDown={(event) => event.preventDefault()}
        onDoubleClick={(event) => event.preventDefault()}
        onDragRegionPointerDown={onDrag}
        onDragRegionDoubleClick={onZoom}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId("bar"), { button: 0 });
    fireEvent.doubleClick(screen.getByTestId("bar"));
    expect(onDrag).not.toHaveBeenCalled();
    expect(onZoom).not.toHaveBeenCalled();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<TitleBar ref={ref} className="extra" id="bar" />);
    expect(ref.current).toHaveClass("mac-title-bar", "extra");
    expect(ref.current).toHaveAttribute("id", "bar");
  });
});
