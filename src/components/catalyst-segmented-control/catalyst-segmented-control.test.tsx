import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { CatalystSegment, CatalystSegmentedControl } from "./index";

function Lists(props: Parameters<typeof CatalystSegmentedControl>[0]) {
  return (
    <CatalystSegmentedControl aria-label="List" {...props}>
      <CatalystSegment value="people">People</CatalystSegment>
      <CatalystSegment value="devices">Devices</CatalystSegment>
      <CatalystSegment value="items" disabled>
        Items
      </CatalystSegment>
    </CatalystSegmentedControl>
  );
}

describe("CatalystSegmentedControl", () => {
  it("is a radio group of its segments, with the default one checked", () => {
    render(<Lists defaultValue="people" />);
    const group = screen.getByRole("radiogroup", { name: "List" });
    expect(group).toHaveClass("mac-catalyst-segmented-control");
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["People", "Devices", "Items"]);
    expect(screen.getByRole("radio", { name: "People" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "People" })).toHaveAttribute("data-checked");
    expect(screen.getByRole("radio", { name: "Devices" })).not.toBeChecked();
    for (const radio of radios) {
      expect(radio).toHaveClass("mac-catalyst-segmented-control-segment");
      expect(radio.parentElement).toHaveClass("mac-catalyst-segmented-control-slot");
    }
  });

  it("selects a segment on click and reports the value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Lists defaultValue="people" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("radio", { name: "Devices" }));
    expect(screen.getByRole("radio", { name: "Devices" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "People" })).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("devices");
  });

  it("is one tab stop, and the arrow keys move the selection past nothing that is disabled", async () => {
    const user = userEvent.setup();
    render(<Lists defaultValue="people" />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "People" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Devices" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Devices" })).toBeChecked();
    // Items is disabled: the next arrow wraps to People without visiting it.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "People" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "People" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Items" })).not.toBeChecked();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Devices" })).toBeChecked();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("does not select a disabled segment", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Lists defaultValue="people" onValueChange={onValueChange} />);
    const items = screen.getByRole("radio", { name: "Items" });
    expect(items).toHaveAttribute("data-disabled");
    await user.click(items);
    expect(items).not.toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("follows a controlled value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Lists value="people" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("radio", { name: "Devices" }));
    expect(onValueChange.mock.calls[0]?.[0]).toBe("devices");
    expect(screen.getByRole("radio", { name: "People" })).toBeChecked();
    rerender(<Lists value="devices" onValueChange={onValueChange} />);
    expect(screen.getByRole("radio", { name: "Devices" })).toBeChecked();
  });

  it("disables every segment when the control is disabled", () => {
    render(<Lists defaultValue="people" disabled />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("forwards refs, class names, styles and other attributes", () => {
    const group = createRef<HTMLDivElement>();
    const segment = createRef<HTMLSpanElement>();
    render(
      <CatalystSegmentedControl
        ref={group}
        aria-label="List"
        className="extra"
        style={{ width: 200 }}
        data-kind="switch"
        defaultValue="a"
      >
        <CatalystSegment ref={segment} value="a" className="first" data-segment="a">
          A
        </CatalystSegment>
      </CatalystSegmentedControl>,
    );
    expect(group.current).toHaveClass("mac-catalyst-segmented-control", "extra");
    expect(group.current).toHaveStyle({ width: "200px" });
    expect(group.current).toHaveAttribute("data-kind", "switch");
    expect(segment.current).toHaveClass("mac-catalyst-segmented-control-segment", "first");
    expect(segment.current).toHaveAttribute("data-segment", "a");
    expect(segment.current).toBe(screen.getByRole("radio", { name: "A" }));
  });
});
