import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Placard, PlacardButton, PlacardLabel } from "./index";

describe("Placard", () => {
  it("is a group of the regular size that holds its controls", () => {
    render(
      <Placard aria-label="View">
        <PlacardButton>100%</PlacardButton>
        <PlacardLabel>Page 3 of 12</PlacardLabel>
      </Placard>,
    );
    const placard = screen.getByRole("group", { name: "View" });
    expect(placard).toHaveClass("mac-placard");
    expect(placard).toHaveAttribute("data-size", "regular");
    expect(placard).toContainElement(screen.getByRole("button", { name: "100%" }));
    expect(placard).toHaveTextContent("Page 3 of 12");
  });

  it("reflects the size", () => {
    render(<Placard aria-label="View" size="small" />);
    expect(screen.getByRole("group", { name: "View" })).toHaveAttribute("data-size", "small");
  });

  it("accepts another role, a ref, a className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Placard ref={ref} role="toolbar" aria-label="View" className="extra" id="view" />);
    const toolbar = screen.getByRole("toolbar", { name: "View" });
    expect(ref.current).toBe(toolbar);
    expect(toolbar).toHaveClass("mac-placard", "extra");
    expect(toolbar).toHaveAttribute("id", "view");
  });
});

describe("PlacardButton", () => {
  it("is a button that acts on click, Return and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<PlacardButton onClick={onClick}>Fit</PlacardButton>);
    const button = screen.getByRole("button", { name: "Fit" });
    expect(button).toHaveClass("mac-placard-button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("data-pop-up");

    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("marks a pop-up button, whose indicator is not part of its name", () => {
    render(<PlacardButton popUp>100%</PlacardButton>);
    const button = screen.getByRole("button", { name: "100%" });
    expect(button).toHaveAttribute("data-pop-up");
  });

  it("reaches each button of a placard with Tab, in order", async () => {
    const user = userEvent.setup();
    render(
      <Placard aria-label="Pages">
        <PlacardButton aria-label="Previous Page" />
        <PlacardButton aria-label="Next Page" />
      </Placard>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Previous Page" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Next Page" })).toHaveFocus();
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PlacardButton disabled onClick={onClick}>
        Fit
      </PlacardButton>,
    );
    const button = screen.getByRole("button", { name: "Fit" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    await user.tab();
    expect(button).not.toHaveFocus();
  });

  it("forwards ref and attributes and keeps its class with a string or a state function", () => {
    const ref = createRef<HTMLElement>();
    const { rerender } = render(
      <PlacardButton ref={ref} className="extra" id="fit" aria-haspopup="menu">
        Fit
      </PlacardButton>,
    );
    const button = screen.getByRole("button", { name: "Fit" });
    expect(ref.current).toBe(button);
    expect(button).toHaveClass("mac-placard-button", "extra");
    expect(button).toHaveAttribute("id", "fit");
    expect(button).toHaveAttribute("aria-haspopup", "menu");

    rerender(
      <PlacardButton disabled className={(state) => (state.disabled ? "is-off" : "is-on")}>
        Fit
      </PlacardButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("mac-placard-button", "is-off");
  });
});

describe("PlacardLabel", () => {
  it("is a span that forwards ref, className and attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <PlacardLabel ref={ref} className="extra" id="count">
        Page 3 of 12
      </PlacardLabel>,
    );
    const label = screen.getByText("Page 3 of 12");
    expect(ref.current).toBe(label);
    expect(label.tagName).toBe("SPAN");
    expect(label).toHaveClass("mac-placard-label", "extra");
    expect(label).toHaveAttribute("id", "count");
  });
});
