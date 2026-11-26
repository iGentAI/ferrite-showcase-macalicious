import { Menu } from "@base-ui/react/menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { GradientButton, GradientButtonFiller, GradientButtonGroup } from "./index";

describe("GradientButton", () => {
  it("renders a native button named by its label", () => {
    render(<GradientButton glyph="add" aria-label="Add" />);
    const button = screen.getByRole("button", { name: "Add" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("mac-gradient-button");
  });

  it("draws one of the standard glyphs, hidden from assistive technology", () => {
    const { rerender } = render(<GradientButton glyph="add" aria-label="Add" />);
    const glyph = () => screen.getByRole("button").querySelector("svg");
    expect(glyph()).toHaveAttribute("aria-hidden", "true");
    const add = glyph()?.innerHTML;
    rerender(<GradientButton glyph="remove" aria-label="Remove" />);
    expect(glyph()?.innerHTML).not.toBe(add);
    rerender(<GradientButton aria-label="Empty" />);
    expect(glyph()).toBeNull();
  });

  it("shows its children instead of the glyph", () => {
    render(
      <GradientButton glyph="add" aria-label="Share">
        <span data-testid="icon" />
      </GradientButton>,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button").querySelector("svg")).toBeNull();
  });

  it("activates with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<GradientButton glyph="add" aria-label="Add" onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<GradientButton glyph="remove" aria-label="Remove" disabled onClick={onClick} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");
    await user.click(button);
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("reports a toggle's state with aria-pressed", () => {
    render(<GradientButton glyph="add" aria-label="Pin" aria-pressed />);
    expect(screen.getByRole("button", { name: "Pin", pressed: true })).toBeInTheDocument();
  });

  it("works as the trigger of a Base UI menu", async () => {
    const user = userEvent.setup();
    render(
      <Menu.Root>
        <Menu.Trigger render={<GradientButton glyph="action" aria-label="Actions" />} />
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Duplicate</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveClass("mac-gradient-button");
    await user.click(trigger);
    expect(await screen.findByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(<GradientButton ref={ref} id="add" className="extra" glyph="add" aria-label="Add" />);
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveClass("mac-gradient-button", "extra");
    expect(ref.current).toHaveAttribute("id", "add");
  });
});

describe("GradientButtonGroup", () => {
  it("groups its buttons under one name, in tab order", async () => {
    const user = userEvent.setup();
    render(
      <GradientButtonGroup aria-label="Accounts" className="extra">
        <GradientButton glyph="add" aria-label="Add" />
        <GradientButton glyph="remove" aria-label="Remove" />
        <GradientButtonFiller data-testid="filler" />
      </GradientButtonGroup>,
    );
    const group = screen.getByRole("group", { name: "Accounts" });
    expect(group).toHaveClass("mac-gradient-button-group", "extra");
    expect(group).toHaveAttribute("data-variant", "standard");
    await user.tab();
    expect(screen.getByRole("button", { name: "Add" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Remove" })).toHaveFocus();
  });

  it("reflects the variant as a data attribute", () => {
    render(
      <GradientButtonGroup aria-label="Services" variant="network">
        <GradientButton glyph="add" aria-label="Add" />
      </GradientButtonGroup>,
    );
    expect(screen.getByRole("group", { name: "Services" })).toHaveAttribute(
      "data-variant",
      "network",
    );
  });

  it("hides the filler cell from assistive technology", () => {
    render(
      <GradientButtonGroup>
        <GradientButtonFiller data-testid="filler" className="extra" />
      </GradientButtonGroup>,
    );
    const filler = screen.getByTestId("filler");
    expect(filler).toHaveAttribute("aria-hidden", "true");
    expect(filler).toHaveClass("mac-gradient-button-filler", "extra");
  });
});
