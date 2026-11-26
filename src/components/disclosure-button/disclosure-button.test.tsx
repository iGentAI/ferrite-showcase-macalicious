import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DisclosureButton } from "./index";

describe("DisclosureButton", () => {
  it("renders a collapsed native button at regular size", () => {
    render(<DisclosureButton aria-label="Details" />);
    const button = screen.getByRole("button", { name: "Details" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveClass("mac-disclosure-button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("data-expanded");
    expect(button).toHaveAttribute("data-size", "regular");
  });

  it("toggles when uncontrolled, with the pointer, Space and Enter", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(<DisclosureButton aria-label="Details" onExpandedChange={onExpandedChange} />);
    const button = screen.getByRole("button");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("data-expanded");
    expect(onExpandedChange).toHaveBeenLastCalledWith(true);

    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);

    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(onExpandedChange).toHaveBeenCalledTimes(3);
  });

  it("starts expanded with defaultExpanded", () => {
    render(<DisclosureButton aria-label="Details" defaultExpanded />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("shows only the state it is given when controlled", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(
      <DisclosureButton
        aria-label="Details"
        expanded={false}
        onExpandedChange={onExpandedChange}
      />,
    );
    const button = screen.getByRole("button");
    await user.click(button);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("follows a controlling parent", async () => {
    const user = userEvent.setup();
    function Parent() {
      const [expanded, setExpanded] = useState(true);
      return (
        <DisclosureButton aria-label="Details" expanded={expanded} onExpandedChange={setExpanded} />
      );
    }
    render(<Parent />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("does not toggle when the click handler prevents the default", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(
      <DisclosureButton
        aria-label="Details"
        onClick={(event) => event.preventDefault()}
        onExpandedChange={onExpandedChange}
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(onExpandedChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("does not toggle and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(<DisclosureButton aria-label="Details" disabled onExpandedChange={onExpandedChange} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await user.click(button);
    await user.tab();
    expect(onExpandedChange).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("reflects the size and forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <DisclosureButton
        ref={ref}
        size="small"
        className="extra"
        aria-label="Details"
        aria-controls="panel"
      />,
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveClass("mac-disclosure-button", "extra");
    expect(ref.current).toHaveAttribute("data-size", "small");
    expect(ref.current).toHaveAttribute("aria-controls", "panel");
  });
});
