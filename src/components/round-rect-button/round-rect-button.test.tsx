import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { RoundRectButton } from "./index";

describe("RoundRectButton", () => {
  it("renders a button with its class and title", () => {
    render(<RoundRectButton>Connect As…</RoundRectButton>);
    const button = screen.getByRole("button", { name: "Connect As…" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveClass("mac-round-rect-button");
    expect(button).toHaveAttribute("type", "button");
  });

  it("is pressed with the pointer, Return and Space", async () => {
    const onClick = vi.fn();
    render(<RoundRectButton onClick={onClick}>Share Screen…</RoundRectButton>);
    const button = screen.getByRole("button");
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does nothing and is marked while disabled", async () => {
    const onClick = vi.fn();
    render(
      <RoundRectButton disabled onClick={onClick}>
        Save
      </RoundRectButton>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays in the tab order when focusable while disabled", async () => {
    render(
      <RoundRectButton disabled focusableWhenDisabled>
        Save
      </RoundRectButton>,
    );
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps its class with a string or a state function", () => {
    const { rerender } = render(<RoundRectButton className="extra">Save</RoundRectButton>);
    expect(screen.getByRole("button")).toHaveClass("mac-round-rect-button", "extra");
    rerender(<RoundRectButton className={() => "from-state"}>Save</RoundRectButton>);
    expect(screen.getByRole("button")).toHaveClass("mac-round-rect-button", "from-state");
  });

  it("forwards ref and native attributes, and renders another element", () => {
    const ref = createRef<HTMLElement>();
    const { rerender } = render(
      <RoundRectButton ref={ref} id="connect" aria-describedby="hint">
        Connect As…
      </RoundRectButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveAttribute("id", "connect");
    expect(ref.current).toHaveAttribute("aria-describedby", "hint");
    rerender(
      <RoundRectButton nativeButton={false} render={<a href="#servers" />}>
        Browse…
      </RoundRectButton>,
    );
    expect(screen.getByText("Browse…").tagName).toBe("A");
    expect(screen.getByText("Browse…")).toHaveClass("mac-round-rect-button");
  });
});
