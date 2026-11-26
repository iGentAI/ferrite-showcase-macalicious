import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { StorePillButton } from "./index";

describe("StorePillButton", () => {
  it("renders a native button that does not submit forms, tinted by default", () => {
    render(<StorePillButton>Get</StorePillButton>);
    const button = screen.getByRole("button", { name: "Get" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("mac-store-pill-button");
    expect(button).toHaveAttribute("data-variant", "tinted");
    expect(button).not.toHaveAttribute("data-progress");
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("reflects the variant as a data attribute", () => {
    render(<StorePillButton variant="filled">Install</StorePillButton>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "filled");
  });

  it("keeps the caption out of the name and gives it as the description", () => {
    render(<StorePillButton caption="In-App Purchases">Get</StorePillButton>);
    const button = screen.getByRole("button", { name: "Get" });
    expect(button).toHaveAccessibleDescription("In-App Purchases");
  });

  it("adds the caption to a description the consumer already references", () => {
    render(
      <>
        <StorePillButton caption="In-App Purchases" aria-describedby="app">
          $14.99
        </StorePillButton>
        <span id="app">Overflow</span>
      </>,
    );
    const button = screen.getByRole("button", { name: "$14.99" });
    expect(button).toHaveAccessibleDescription("Overflow In-App Purchases");
  });

  it("activates with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StorePillButton onClick={onClick}>Get</StorePillButton>);

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is reachable with Tab", async () => {
    const user = userEvent.setup();
    render(<StorePillButton>Get</StorePillButton>);
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <StorePillButton disabled onClick={onClick}>
        Get
      </StorePillButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");

    await user.click(button);
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("stays focusable but inert with focusableWhenDisabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <StorePillButton disabled focusableWhenDisabled onClick={onClick}>
        Get
      </StorePillButton>,
    );
    const button = screen.getByRole("button");
    await user.tab();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays a named, working button while it shows progress", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <StorePillButton progress={0.4} onClick={onClick}>
        Stop
      </StorePillButton>,
    );
    const button = screen.getByRole("button", { name: "Stop" });
    expect(button).toHaveAttribute("data-progress");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // Zero is progress too; without the prop the capsule is back.
    rerender(<StorePillButton progress={0}>Stop</StorePillButton>);
    expect(button).toHaveAttribute("data-progress");
    rerender(<StorePillButton>Open</StorePillButton>);
    expect(screen.getByRole("button", { name: "Open" })).not.toHaveAttribute("data-progress");
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { rerender } = render(<StorePillButton className="extra">Get</StorePillButton>);
    expect(screen.getByRole("button")).toHaveClass("mac-store-pill-button", "extra");

    rerender(
      <StorePillButton disabled className={(state) => (state.disabled ? "is-off" : "is-on")}>
        Get
      </StorePillButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("mac-store-pill-button", "is-off");
  });

  it("forwards ref and native attributes to the element", () => {
    const ref = createRef<HTMLElement>();
    render(
      <StorePillButton ref={ref} id="offer" aria-label="Get, Tile Garden">
        Get
      </StorePillButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Get, Tile Garden" }));
    expect(ref.current).toHaveAttribute("id", "offer");
  });

  it("can render another element through Base UI's render prop", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <StorePillButton render={<div />} nativeButton={false} onClick={onClick}>
        Open
      </StorePillButton>,
    );
    const button = screen.getByRole("button", { name: "Open" });
    expect(button.tagName).toBe("DIV");
    expect(button).toHaveClass("mac-store-pill-button");
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
