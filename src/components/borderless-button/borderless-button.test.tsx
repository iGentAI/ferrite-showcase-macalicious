import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BorderlessButton } from "./index";

describe("BorderlessButton", () => {
  it("is a button named by its title, in the inherited colour by default", () => {
    render(<BorderlessButton>Details</BorderlessButton>);
    const button = screen.getByRole("button", { name: "Details" });
    expect(button).toHaveClass("mac-borderless-button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-color", "inherit");
  });

  it("reflects the link colour", () => {
    render(<BorderlessButton color="link">Details</BorderlessButton>);
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("data-color", "link");
  });

  it("is activated by a click and by Space and Return", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BorderlessButton onClick={onClick}>Show Less</BorderlessButton>);
    await user.click(screen.getByRole("button", { name: "Show Less" }));
    await user.keyboard(" ");
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is reached with Tab", async () => {
    const user = userEvent.setup();
    render(<BorderlessButton>Details</BorderlessButton>);
    await user.tab();
    expect(screen.getByRole("button", { name: "Details" })).toHaveFocus();
  });

  it("carries the state of what it discloses", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [open, setOpen] = useState(false);
      return (
        <BorderlessButton aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Details"}
        </BorderlessButton>
      );
    }
    render(<Owner />);
    const button = screen.getByRole("button", { name: "Details" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <BorderlessButton disabled onClick={onClick}>
        Details
      </BorderlessButton>,
    );
    const button = screen.getByRole("button", { name: "Details" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("passes props, className and ref to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <BorderlessButton ref={ref} className="mine" id="b1">
        Details
      </BorderlessButton>,
    );
    const button = screen.getByRole("button", { name: "Details" });
    expect(ref.current).toBe(button);
    expect(button).toHaveClass("mac-borderless-button", "mine");
    expect(button).toHaveAttribute("id", "b1");
  });
});
