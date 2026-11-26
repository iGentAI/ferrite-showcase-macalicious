import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { LockButton } from "./index";

describe("LockButton", () => {
  it("renders a locked native button named by its status text", () => {
    render(<LockButton />);
    const button = screen.getByRole("button", { name: "Click the lock to make changes." });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveClass("mac-lock-button");
    expect(button).toHaveAttribute("data-state", "locked");
    expect(button).toHaveAttribute("data-size", "regular");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("reports the unlocked state and changes its text", () => {
    render(<LockButton state="unlocked" />);
    const button = screen.getByRole("button", {
      name: "Click the lock to prevent further changes.",
      pressed: true,
    });
    expect(button).toHaveAttribute("data-state", "unlocked");
  });

  it("is busy while authenticating", () => {
    render(<LockButton state="authenticating" />);
    const button = screen.getByRole("button", { name: "Authenticating…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("takes its own status text", () => {
    render(<LockButton>Cliquez sur le cadenas pour modifier.</LockButton>);
    expect(
      screen.getByRole("button", { name: "Cliquez sur le cadenas pour modifier." }),
    ).toBeInTheDocument();
  });

  it("keeps its name at the small size and hides the padlock from assistive technology", () => {
    render(<LockButton size="small" />);
    const button = screen.getByRole("button", { name: "Click the lock to make changes." });
    expect(button).toHaveAttribute("data-size", "small");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("does not change state by itself: the application answers the click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<LockButton onClick={onClick} />);
    const button = screen.getByRole("button");
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(button).toHaveAttribute("data-state", "locked");
  });

  it("follows the state its parent gives it", async () => {
    const user = userEvent.setup();
    function Pane() {
      const [unlocked, setUnlocked] = useState(false);
      return (
        <LockButton
          state={unlocked ? "unlocked" : "locked"}
          onClick={() => setUnlocked(!unlocked)}
        />
      );
    }
    render(<Pane />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { pressed: true })).toHaveAttribute("data-state", "unlocked");
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { pressed: false })).toHaveAttribute("data-state", "locked");
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<LockButton disabled onClick={onClick} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await user.click(button);
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(<LockButton ref={ref} id="lock" className="extra" aria-describedby="hint" />);
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveClass("mac-lock-button", "extra");
    expect(ref.current).toHaveAttribute("id", "lock");
    expect(ref.current).toHaveAttribute("aria-describedby", "hint");
  });
});
