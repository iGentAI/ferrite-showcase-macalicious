import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { ToolbarSegment, ToolbarSegmentedControl } from "../toolbar-segmented-control";
import { ToolbarLabelledItem } from "./index";

describe("ToolbarLabelledItem", () => {
  it("shows the label and names the control with it", () => {
    render(
      <ToolbarLabelledItem label="First Aid" data-testid="item">
        <button type="button">
          <svg aria-hidden="true" />
        </button>
      </ToolbarLabelledItem>,
    );
    expect(screen.getByTestId("item")).toHaveClass("mac-toolbar-labelled-item");
    expect(screen.getByText("First Aid")).toHaveClass("mac-toolbar-labelled-item-label");
    expect(screen.getByRole("button", { name: "First Aid" })).toBeInTheDocument();
  });

  it("leaves a control that names itself alone", () => {
    render(
      <ToolbarLabelledItem label="Volume">
        <button type="button" aria-label="Add Volume" />
      </ToolbarLabelledItem>,
    );
    const button = screen.getByRole("button", { name: "Add Volume" });
    expect(button).not.toHaveAttribute("aria-labelledby");
  });

  it("leaves a control that is named by another element alone", () => {
    render(
      <>
        <span id="elsewhere">Add Volume</span>
        <ToolbarLabelledItem label="Volume">
          <button type="button" aria-labelledby="elsewhere" />
        </ToolbarLabelledItem>
      </>,
    );
    expect(screen.getByRole("button", { name: "Add Volume" })).toHaveAttribute(
      "aria-labelledby",
      "elsewhere",
    );
  });

  it("names a segmented control, the group, with the label", () => {
    render(
      <ToolbarLabelledItem label="View">
        <ToolbarSegmentedControl defaultValue={["icons"]}>
          <ToolbarSegment value="icons">Icons</ToolbarSegment>
          <ToolbarSegment value="list">List</ToolbarSegment>
        </ToolbarSegmentedControl>
      </ToolbarLabelledItem>,
    );
    const group = screen.getByRole("group", { name: "View" });
    expect(group).toHaveClass("mac-toolbar-segmented-control");
    expect(screen.getByRole("button", { name: "Icons" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List" })).toBeInTheDocument();
  });

  it("adds no focus stop of its own", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ToolbarLabelledItem label="Erase">
          <button type="button" />
        </ToolbarLabelledItem>
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Erase" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("reflects disabled", () => {
    const { rerender } = render(
      <ToolbarLabelledItem label="Restore" data-testid="item">
        <button type="button" />
      </ToolbarLabelledItem>,
    );
    const item = screen.getByTestId("item");
    expect(item).not.toHaveAttribute("data-disabled");
    rerender(
      <ToolbarLabelledItem label="Restore" data-testid="item" disabled>
        <button type="button" />
      </ToolbarLabelledItem>,
    );
    expect(item).toHaveAttribute("data-disabled");
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ToolbarLabelledItem ref={ref} label="Info" className="extra" id="info">
        <button type="button" />
      </ToolbarLabelledItem>,
    );
    expect(ref.current).toHaveClass("mac-toolbar-labelled-item", "extra");
    expect(ref.current).toHaveAttribute("id", "info");
  });
});
