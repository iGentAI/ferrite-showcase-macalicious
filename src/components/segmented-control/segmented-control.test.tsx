import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Segment, SegmentedControl, type SegmentedControlProps } from "./index";

function View(props: SegmentedControlProps) {
  return (
    <SegmentedControl aria-label="View" {...props}>
      <Segment value="icons">Icons</Segment>
      <Segment value="list">List</Segment>
      <Segment value="columns">Columns</Segment>
    </SegmentedControl>
  );
}

const segment = (name: string) => screen.getByRole("button", { name });

describe("SegmentedControl", () => {
  it("renders a named group of buttons with the default attributes", () => {
    render(<View />);
    const group = screen.getByRole("group", { name: "View" });
    expect(group).toHaveClass("mac-segmented-control");
    expect(group).toHaveAttribute("data-tracking-mode", "select-one");
    expect(group).toHaveAttribute("data-variant", "rounded");
    expect(group).toHaveAttribute("data-size", "regular");
    expect(group).toHaveAttribute("data-distribution", "fill-equally");

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveClass("mac-segmented-control-segment");
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("reflects variant, size, distribution and tracking mode as data attributes", () => {
    render(<View variant="separated" size="mini" distribution="fit" trackingMode="select-any" />);
    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("data-variant", "separated");
    expect(group).toHaveAttribute("data-size", "mini");
    expect(group).toHaveAttribute("data-distribution", "fit");
    expect(group).toHaveAttribute("data-tracking-mode", "select-any");
  });

  describe("select one", () => {
    it("selects the clicked segment and deselects the previous one", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<View defaultValue={["icons"]} onValueChange={onValueChange} />);
      expect(segment("Icons")).toHaveAttribute("aria-pressed", "true");
      expect(segment("Icons")).toHaveAttribute("data-pressed");

      await user.click(segment("List"));
      expect(segment("List")).toHaveAttribute("aria-pressed", "true");
      expect(segment("Icons")).toHaveAttribute("aria-pressed", "false");
      expect(segment("Icons")).not.toHaveAttribute("data-pressed");
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenLastCalledWith(["list"], expect.anything());
    });

    it("keeps the selection when the selected segment is clicked again", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<View defaultValue={["list"]} onValueChange={onValueChange} />);

      await user.click(segment("List"));
      expect(segment("List")).toHaveAttribute("aria-pressed", "true");
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("starts with nothing selected when no value is given", async () => {
      const user = userEvent.setup();
      render(<View />);
      expect(screen.queryByRole("button", { pressed: true })).toBeNull();
      await user.click(segment("Columns"));
      expect(screen.getByRole("button", { pressed: true })).toBe(segment("Columns"));
    });

    it("stays as its `value` prop says when controlled", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const { rerender } = render(<View value={["icons"]} onValueChange={onValueChange} />);

      await user.click(segment("Columns"));
      expect(onValueChange).toHaveBeenLastCalledWith(["columns"], expect.anything());
      expect(segment("Icons")).toHaveAttribute("aria-pressed", "true");
      expect(segment("Columns")).toHaveAttribute("aria-pressed", "false");

      rerender(<View value={["columns"]} onValueChange={onValueChange} />);
      expect(segment("Columns")).toHaveAttribute("aria-pressed", "true");
      expect(segment("Icons")).toHaveAttribute("aria-pressed", "false");
    });

    it("follows state held by a parent", async () => {
      const user = userEvent.setup();
      function Parent() {
        const [value, setValue] = useState(["icons"]);
        return <View value={value} onValueChange={setValue} />;
      }
      render(<Parent />);
      await user.click(segment("List"));
      expect(screen.getByRole("button", { pressed: true })).toBe(segment("List"));
    });
  });

  describe("select any", () => {
    it("toggles every segment on its own", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <View trackingMode="select-any" defaultValue={["icons"]} onValueChange={onValueChange} />,
      );

      await user.click(segment("Columns"));
      expect(segment("Icons")).toHaveAttribute("aria-pressed", "true");
      expect(segment("Columns")).toHaveAttribute("aria-pressed", "true");
      expect(onValueChange).toHaveBeenLastCalledWith(["icons", "columns"], expect.anything());

      await user.click(segment("Icons"));
      await user.click(segment("Columns"));
      expect(screen.queryByRole("button", { pressed: true })).toBeNull();
      expect(onValueChange).toHaveBeenLastCalledWith([], expect.anything());
    });

    it("is also chosen by Base UI's `multiple`", async () => {
      const user = userEvent.setup();
      render(<View multiple defaultValue={["icons"]} />);
      expect(screen.getByRole("group")).toHaveAttribute("data-tracking-mode", "select-any");
      await user.click(segment("List"));
      expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
    });
  });

  describe("momentary", () => {
    it("renders plain buttons that report clicks and never stay selected", async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();
      const onValueChange = vi.fn();
      render(
        <SegmentedControl
          aria-label="Folders"
          trackingMode="momentary"
          onValueChange={onValueChange}
        >
          <Segment aria-label="Add" onClick={onAdd}>
            +
          </Segment>
          <Segment aria-label="Remove">-</Segment>
        </SegmentedControl>,
      );
      const add = segment("Add");
      expect(add).not.toHaveAttribute("aria-pressed");

      await user.click(add);
      await user.click(add);
      expect(onAdd).toHaveBeenCalledTimes(2);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(add).not.toHaveAttribute("aria-pressed");
      expect(add).not.toHaveAttribute("data-pressed");
    });

    it("selects nothing even when it is given a value", () => {
      render(
        <SegmentedControl aria-label="Folders" trackingMode="momentary" defaultValue={["add"]}>
          <Segment value="add">Add</Segment>
          <Segment value="remove">Remove</Segment>
        </SegmentedControl>,
      );
      expect(segment("Add")).not.toHaveAttribute("data-pressed");
    });
  });

  describe("keyboard", () => {
    it("is one Tab stop; the arrow keys move between segments and wrap around", async () => {
      const user = userEvent.setup();
      render(
        <>
          <View defaultValue={["icons"]} />
          <button type="button">After</button>
        </>,
      );

      await user.tab();
      expect(segment("Icons")).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(segment("List")).toHaveFocus();
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(segment("Icons")).toHaveFocus();
      await user.keyboard("{ArrowLeft}");
      expect(segment("Columns")).toHaveFocus();
      await user.keyboard("{Home}");
      expect(segment("Icons")).toHaveFocus();
      await user.keyboard("{End}");
      expect(segment("Columns")).toHaveFocus();

      // Moving focus does not select.
      expect(screen.getByRole("button", { pressed: true })).toBe(segment("Icons"));

      await user.tab();
      expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    });

    it("stops at the ends with loopFocus={false}", async () => {
      const user = userEvent.setup();
      render(<View loopFocus={false} />);
      await user.tab();
      await user.keyboard("{ArrowLeft}");
      expect(segment("Icons")).toHaveFocus();
    });

    it("selects the focused segment with Space and with Return", async () => {
      const user = userEvent.setup();
      render(<View defaultValue={["icons"]} />);

      await user.tab();
      await user.keyboard("{ArrowRight} ");
      expect(screen.getByRole("button", { pressed: true })).toBe(segment("List"));
      await user.keyboard("{ArrowRight}{Enter}");
      expect(screen.getByRole("button", { pressed: true })).toBe(segment("Columns"));
    });

    it("activates a momentary segment with Space and with Return", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <SegmentedControl aria-label="Folders" trackingMode="momentary">
          <Segment onClick={onClick}>Add</Segment>
          <Segment>Remove</Segment>
        </SegmentedControl>,
      );
      await user.tab();
      await user.keyboard(" {Enter}");
      expect(onClick).toHaveBeenCalledTimes(2);
    });
  });

  describe("disabled", () => {
    it("disables every segment of a disabled control", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<View disabled defaultValue={["icons"]} onValueChange={onValueChange} />);
      expect(screen.getByRole("group")).toHaveAttribute("data-disabled");
      for (const button of screen.getAllByRole("button")) {
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("data-disabled");
      }

      await user.click(segment("List"));
      await user.tab();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(segment("Icons")).toHaveAttribute("aria-pressed", "true");
      expect(document.body).toHaveFocus();
    });

    it("skips a disabled segment with the pointer and with the arrow keys", async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <SegmentedControl aria-label="View" defaultValue={["icons"]} onValueChange={onValueChange}>
          <Segment value="icons">Icons</Segment>
          <Segment value="list" disabled>
            List
          </Segment>
          <Segment value="columns">Columns</Segment>
        </SegmentedControl>,
      );
      expect(segment("List")).toBeDisabled();
      expect(segment("Columns")).toBeEnabled();

      await user.click(segment("List"));
      expect(onValueChange).not.toHaveBeenCalled();

      await user.tab();
      await user.keyboard("{ArrowRight}");
      expect(segment("Columns")).toHaveFocus();
    });
  });

  it("keeps its own classes when className is a string or a state function", () => {
    render(
      <SegmentedControl
        aria-label="View"
        disabled
        className={(state) => (state.disabled ? "is-off" : "is-on")}
        defaultValue={["icons"]}
      >
        <Segment value="icons" className="extra">
          Icons
        </Segment>
        <Segment value="list" className={(state) => (state.pressed ? "is-selected" : "is-idle")}>
          List
        </Segment>
      </SegmentedControl>,
    );
    expect(screen.getByRole("group")).toHaveClass("mac-segmented-control", "is-off");
    expect(segment("Icons")).toHaveClass("mac-segmented-control-segment", "extra");
    expect(segment("List")).toHaveClass("mac-segmented-control-segment", "is-idle");
  });

  it("forwards refs, style and native attributes to the group and to a segment", () => {
    const groupRef = createRef<HTMLDivElement>();
    const segmentRef = createRef<HTMLButtonElement>();
    render(
      <SegmentedControl
        ref={groupRef}
        aria-label="View"
        id="view"
        data-testid="view"
        style={{ width: 240 }}
      >
        <Segment
          ref={segmentRef}
          value="icons"
          id="icons"
          aria-describedby="hint"
          style={{ width: 80 }}
        >
          Icons
        </Segment>
      </SegmentedControl>,
    );
    expect(groupRef.current).toBe(screen.getByRole("group"));
    expect(groupRef.current).toHaveAttribute("id", "view");
    expect(groupRef.current).toHaveAttribute("data-testid", "view");
    expect(groupRef.current).toHaveStyle({ width: "240px" });
    expect(segmentRef.current).toBe(segment("Icons"));
    expect(segmentRef.current).toHaveAttribute("id", "icons");
    expect(segmentRef.current).toHaveAttribute("aria-describedby", "hint");
    expect(segmentRef.current).toHaveStyle({ width: "80px" });
  });

  it("takes its name from aria-labelledby and names an icon segment with aria-label", () => {
    render(
      <>
        <span id="label">Alignment</span>
        <SegmentedControl aria-labelledby="label">
          <Segment value="left" aria-label="Align left">
            <svg aria-hidden="true" width="11" height="11" />
          </Segment>
        </SegmentedControl>
      </>,
    );
    expect(screen.getByRole("group", { name: "Alignment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Align left" })).toBeInTheDocument();
  });

  it("can render a segment as another element through Base UI's render prop", async () => {
    const user = userEvent.setup();
    render(
      <SegmentedControl aria-label="View">
        <Segment value="icons" render={<span />} nativeButton={false}>
          Icons
        </Segment>
      </SegmentedControl>,
    );
    const icons = segment("Icons");
    expect(icons.tagName).toBe("SPAN");
    expect(icons).toHaveClass("mac-segmented-control-segment");
    await user.click(icons);
    expect(icons).toHaveAttribute("aria-pressed", "true");
  });
});
