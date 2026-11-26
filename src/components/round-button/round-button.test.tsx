import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { RoundButton } from "./index";

describe("RoundButton", () => {
  it("renders a native button named by its label, at regular size", () => {
    render(<RoundButton aria-label="Add">+</RoundButton>);
    const button = screen.getByRole("button", { name: "Add" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("mac-round-button");
    expect(button).toHaveAttribute("data-size", "regular");
  });

  it("reflects the control size", () => {
    render(
      <RoundButton size="mini" aria-label="Add">
        +
      </RoundButton>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "mini");
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "bezel");
  });

  it("reflects the destructive variant and still presses and disables", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <RoundButton variant="destructive" size="mini" aria-label="Remove phone" onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: "Remove phone" });
    expect(button).toHaveAttribute("data-variant", "destructive");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <RoundButton
        variant="destructive"
        size="mini"
        aria-label="Remove phone"
        onClick={onClick}
        disabled
      />,
    );
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("activates with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <RoundButton aria-label="Add" onClick={onClick}>
        +
      </RoundButton>,
    );
    await user.click(screen.getByRole("button"));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is reachable with Tab", async () => {
    const user = userEvent.setup();
    render(<RoundButton aria-label="Add">+</RoundButton>);
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <RoundButton aria-label="Add" disabled onClick={onClick}>
        +
      </RoundButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");
    await user.click(button);
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { rerender } = render(
      <RoundButton aria-label="Add" className="extra">
        +
      </RoundButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("mac-round-button", "extra");
    rerender(
      <RoundButton
        aria-label="Add"
        disabled
        className={(state) => (state.disabled ? "is-off" : "is-on")}
      >
        +
      </RoundButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("mac-round-button", "is-off");
  });

  it("forwards ref and native attributes to the element", () => {
    const ref = createRef<HTMLElement>();
    render(
      <RoundButton ref={ref} id="add" aria-label="Add" aria-describedby="hint">
        +
      </RoundButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveAttribute("id", "add");
    expect(ref.current).toHaveAttribute("aria-describedby", "hint");
  });
});
