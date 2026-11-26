import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { WindowBanner, WindowBannerAction } from "./index";

describe("WindowBanner", () => {
  it("is a note that shows its text and no trailing box", () => {
    const { container } = render(<WindowBanner>Shared Folder</WindowBanner>);
    const banner = screen.getByRole("note");
    expect(banner).toHaveClass("mac-window-banner");
    expect(container.querySelector(".mac-window-banner-text")).toHaveTextContent("Shared Folder");
    expect(container.querySelector(".mac-window-banner-trailing")).toBeNull();
  });

  it("puts trailing content after the text", () => {
    const { container } = render(
      <WindowBanner trailing={<WindowBannerAction>Connect As…</WindowBannerAction>}>
        Shared Folder
      </WindowBanner>,
    );
    expect(container.querySelector(".mac-window-banner-trailing")).toContainElement(
      screen.getByRole("button", { name: "Connect As…" }),
    );
  });

  it("accepts another role, a ref, a className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <WindowBanner ref={ref} role="status" className="extra" id="banner">
        Shared Folder
      </WindowBanner>,
    );
    const banner = screen.getByRole("status");
    expect(ref.current).toBe(banner);
    expect(banner).toHaveClass("mac-window-banner", "extra");
    expect(banner).toHaveAttribute("id", "banner");
  });
});

describe("WindowBannerAction", () => {
  it("is a button that acts on click, Return and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<WindowBannerAction onClick={onClick}>Connect As…</WindowBannerAction>);
    const action = screen.getByRole("button", { name: "Connect As…" });
    expect(action).toHaveClass("mac-window-banner-action");
    expect(action).toHaveAttribute("type", "button");

    await user.click(action);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <WindowBannerAction disabled onClick={onClick}>
        Connect As…
      </WindowBannerAction>,
    );
    const action = screen.getByRole("button", { name: "Connect As…" });
    await user.click(action);
    expect(onClick).not.toHaveBeenCalled();
    await user.tab();
    expect(action).not.toHaveFocus();
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { rerender } = render(<WindowBannerAction className="extra">A</WindowBannerAction>);
    expect(screen.getByRole("button")).toHaveClass("mac-window-banner-action", "extra");

    rerender(
      <WindowBannerAction disabled className={(state) => (state.disabled ? "is-off" : "is-on")}>
        A
      </WindowBannerAction>,
    );
    expect(screen.getByRole("button")).toHaveClass("mac-window-banner-action", "is-off");
  });
});
