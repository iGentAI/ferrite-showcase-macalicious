import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../toolbar";
import { ToolbarSegment, ToolbarSegmentedControl } from "./index";

function View(props: Partial<React.ComponentProps<typeof ToolbarSegmentedControl>>) {
  return (
    <ToolbarSegmentedControl aria-label="View" {...props}>
      <ToolbarSegment value="icons">Icons</ToolbarSegment>
      <ToolbarSegment value="list">List</ToolbarSegment>
      <ToolbarSegment value="columns">Columns</ToolbarSegment>
    </ToolbarSegmentedControl>
  );
}

const pressed = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent);

describe("ToolbarSegmentedControl", () => {
  it("renders a named group of toggle buttons, joined and select-one by default", () => {
    render(<View defaultValue={["list"]} />);
    const group = screen.getByRole("group", { name: "View" });
    expect(group).toHaveClass("mac-toolbar-segmented-control");
    expect(group).toHaveAttribute("data-variant", "joined");
    expect(group).toHaveAttribute("data-tracking", "select-one");
    expect(within(group).getAllByRole("button")).toHaveLength(3);
    expect(pressed()).toEqual(["List"]);
    expect(screen.getByRole("button", { name: "List" })).toHaveClass(
      "mac-toolbar-segmented-control-segment",
    );
  });

  it("selects one segment at a time and never none", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<View defaultValue={["list"]} onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    expect(pressed()).toEqual(["Columns"]);
    expect(onValueChange.mock.lastCall?.[0]).toEqual(["columns"]);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    expect(pressed()).toEqual(["Columns"]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("toggles segments independently with select-any", async () => {
    const user = userEvent.setup();
    render(<View tracking="select-any" defaultValue={["icons"]} />);
    await user.click(screen.getByRole("button", { name: "Columns" }));
    expect(pressed()).toEqual(["Icons", "Columns"]);
    await user.click(screen.getByRole("button", { name: "Icons" }));
    await user.click(screen.getByRole("button", { name: "Columns" }));
    expect(pressed()).toEqual([]);
  });

  it("follows the value prop when controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<View value={["icons"]} onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "List" }));
    expect(onValueChange.mock.lastCall?.[0]).toEqual(["list"]);
    expect(pressed()).toEqual(["Icons"]);
    rerender(<View value={["list"]} onValueChange={onValueChange} />);
    expect(pressed()).toEqual(["List"]);
  });

  it("is one tab stop with arrow keys between segments", async () => {
    const user = userEvent.setup();
    render(
      <>
        <View defaultValue={["icons"]} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Icons" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "List" })).toHaveFocus();
    await user.keyboard(" ");
    expect(pressed()).toEqual(["List"]);
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("acts as plain buttons in momentary tracking", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onForward = vi.fn();
    render(
      <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="History">
        <ToolbarSegment onClick={onBack}>Back</ToolbarSegment>
        <ToolbarSegment onClick={onForward} disabled>
          Forward
        </ToolbarSegment>
      </ToolbarSegmentedControl>,
    );
    const group = screen.getByRole("group", { name: "History" });
    expect(group).toHaveAttribute("data-variant", "navigation");
    const back = screen.getByRole("button", { name: "Back" });
    expect(back).not.toHaveAttribute("aria-pressed");
    await user.click(back);
    await user.click(screen.getByRole("button", { name: "Forward" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onForward).not.toHaveBeenCalled();
    expect(back).not.toHaveAttribute("aria-pressed");
  });

  it("is one tab stop with arrow keys in momentary tracking, on its own", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ToolbarSegmentedControl tracking="momentary" aria-label="Zoom">
          <ToolbarSegment>Zoom Out</ToolbarSegment>
          <ToolbarSegment>Actual Size</ToolbarSegment>
          <ToolbarSegment>Zoom In</ToolbarSegment>
        </ToolbarSegmentedControl>
        <button type="button">After</button>
      </>,
    );
    expect(screen.getByRole("group", { name: "Zoom" })).not.toHaveAttribute("aria-orientation");
    await user.tab();
    expect(screen.getByRole("button", { name: "Zoom Out" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "Zoom In" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("disables every segment when the control is disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onClick = vi.fn();
    const { unmount } = render(
      <View disabled defaultValue={["icons"]} onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("button", { name: "List" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(pressed()).toEqual(["Icons"]);
    unmount();

    render(
      <ToolbarSegmentedControl tracking="momentary" disabled aria-label="Zoom">
        <ToolbarSegment onClick={onClick}>Zoom In</ToolbarSegment>
      </ToolbarSegmentedControl>,
    );
    await user.click(screen.getByRole("button", { name: "Zoom In" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(["select-one", "select-any"] as const)(
    "joins the arrow-key navigation of a toolbar after a momentary control, with %s",
    async (tracking) => {
      const user = userEvent.setup();
      const onBack = vi.fn();
      render(
        <Toolbar aria-label="Tools">
          <ToolbarSegmentedControl tracking="momentary" aria-label="History">
            <ToolbarSegment onClick={onBack}>Back</ToolbarSegment>
          </ToolbarSegmentedControl>
          <View tracking={tracking} defaultValue={["icons"]} />
          <button type="button">After</button>
        </Toolbar>,
      );
      await user.tab();
      expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onBack).toHaveBeenCalledTimes(1);
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(screen.getByRole("button", { name: "List" })).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(pressed()).toEqual(tracking === "select-one" ? ["List"] : ["Icons", "List"]);
      await user.keyboard("{ArrowLeft}{ArrowLeft}");
      expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
    },
  );

  it("disables selecting segments in a disabled toolbar", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Toolbar aria-label="Tools" disabled>
        <View defaultValue={["icons"]} onValueChange={onValueChange} />
      </Toolbar>,
    );
    await user.click(screen.getByRole("button", { name: "List" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(pressed()).toEqual(["Icons"]);
  });

  it("forwards refs, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    const segmentRef = createRef<HTMLButtonElement>();
    render(
      <ToolbarSegmentedControl ref={ref} className="extra" id="view" aria-label="View">
        <ToolbarSegment ref={segmentRef} value="icons" className="mine" data-kind="icons">
          Icons
        </ToolbarSegment>
      </ToolbarSegmentedControl>,
    );
    expect(ref.current).toBe(screen.getByRole("group"));
    expect(ref.current).toHaveClass("mac-toolbar-segmented-control", "extra");
    expect(ref.current).toHaveAttribute("id", "view");
    expect(segmentRef.current).toHaveClass("mac-toolbar-segmented-control-segment", "mine");
    expect(segmentRef.current).toHaveAttribute("data-kind", "icons");
  });
});
