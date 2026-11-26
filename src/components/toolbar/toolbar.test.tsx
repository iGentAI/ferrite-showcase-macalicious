import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToolbarButton } from "../toolbar-button";
import { ToolbarSearchField } from "../toolbar-search-field";
import { Toolbar, ToolbarSpace } from "./index";

describe("Toolbar", () => {
  it("renders a named toolbar in icon-only mode", () => {
    render(<Toolbar aria-label="Finder toolbar" />);
    const toolbar = screen.getByRole("toolbar", { name: "Finder toolbar" });
    expect(toolbar).toHaveClass("mac-toolbar");
    expect(toolbar).toHaveAttribute("data-display-mode", "icon-only");
    expect(toolbar).toHaveAttribute("aria-orientation", "horizontal");
  });

  it.each(["icon-only", "icon-and-label", "label-only"] as const)(
    "reflects the %s display mode",
    (displayMode) => {
      render(<Toolbar aria-label="Tools" displayMode={displayMode} />);
      expect(screen.getByRole("toolbar")).toHaveAttribute("data-display-mode", displayMode);
    },
  );

  it("is one tab stop, with arrow keys between its items", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Toolbar aria-label="Tools">
          <ToolbarButton>Back</ToolbarButton>
          <ToolbarSpace />
          <ToolbarButton>Share</ToolbarButton>
          <ToolbarButton>Tags</ToolbarButton>
        </Toolbar>
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Share" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Tags" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Tags" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Share" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("selects a field's text on keyboard focus and leaves the caret where it is clicked", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(
      <Toolbar aria-label="Tools" onFocus={onFocus}>
        <ToolbarButton>Back</ToolbarButton>
        <ToolbarSearchField defaultValue="File" />
      </Toolbar>,
    );
    const field = screen.getByRole<HTMLInputElement>("searchbox");
    const selection = () => [field.selectionStart, field.selectionEnd];

    // From another item of the same toolbar, so the press also blurs that item first.
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(field);
    expect(field).toHaveFocus();
    expect(selection()).toEqual([4, 4]);
    expect(onFocus).toHaveBeenCalledTimes(2);

    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(field).toHaveFocus();
    expect(selection()).toEqual([0, 4]);
  });

  it("leaves the caret where a field is tapped: a touch's focus follows its pointerup", () => {
    render(
      <Toolbar aria-label="Tools">
        <ToolbarSearchField defaultValue="File" />
      </Toolbar>,
    );
    const field = screen.getByRole<HTMLInputElement>("searchbox");
    field.setSelectionRange(2, 2);

    // The order Chromium dispatches for a tap: both pointer events, then the compatibility
    // mouse events, with the focus between mousedown and mouseup.
    fireEvent.pointerDown(field, { pointerId: 2, pointerType: "touch" });
    fireEvent.pointerUp(field, { pointerId: 2, pointerType: "touch" });
    fireEvent.mouseDown(field);
    fireEvent.focus(field);
    fireEvent.mouseUp(field);
    fireEvent.click(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 2]);
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Toolbar ref={ref} aria-label="Tools" className="extra" id="tools" />);
    expect(ref.current).toBe(screen.getByRole("toolbar"));
    expect(ref.current).toHaveClass("mac-toolbar", "extra");
    expect(ref.current).toHaveAttribute("id", "tools");
  });
});

describe("ToolbarSpace", () => {
  it("is flexible by default and hidden from assistive technology", () => {
    render(<ToolbarSpace data-testid="space" />);
    const space = screen.getByTestId("space");
    expect(space).toHaveClass("mac-toolbar-space");
    expect(space).toHaveAttribute("data-flexible");
    expect(space).toHaveAttribute("aria-hidden", "true");
  });

  it("takes a fixed width", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ToolbarSpace ref={ref} width={32} className="extra" />);
    expect(ref.current).not.toHaveAttribute("data-flexible");
    expect(ref.current).toHaveStyle({ width: "32px" });
    expect(ref.current).toHaveClass("mac-toolbar-space", "extra");
  });
});
