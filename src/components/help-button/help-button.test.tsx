import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { HelpButton } from "./index";

describe("HelpButton", () => {
  it("renders a button named Help that draws on the round button", () => {
    render(<HelpButton />);
    const button = screen.getByRole("button", { name: "Help" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveClass("mac-round-button", "mac-help-button");
    expect(button).toHaveAttribute("data-size", "regular");
  });

  it("takes another accessible name", () => {
    render(<HelpButton label="Aide" />);
    expect(screen.getByRole("button", { name: "Aide" })).toBeInTheDocument();
  });

  it("hides its question mark from assistive technology", () => {
    render(<HelpButton />);
    const glyph = screen.getByRole("button").querySelector("svg");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it("activates with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HelpButton onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HelpButton disabled onClick={onClick} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await user.click(button);
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(<HelpButton ref={ref} id="help" className="extra" aria-describedby="hint" />);
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveClass("mac-help-button", "extra");
    expect(ref.current).toHaveAttribute("id", "help");
    expect(ref.current).toHaveAttribute("aria-describedby", "hint");
  });
});
