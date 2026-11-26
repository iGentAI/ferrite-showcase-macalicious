import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Desktop } from "../desktop";
import { DesktopIcon } from "./index";

describe("DesktopIcon", () => {
  it("is a button named by its label, with decorative artwork", () => {
    render(<DesktopIcon icon={<svg data-testid="art" />}>Macintosh SSD</DesktopIcon>);
    const icon = screen.getByRole("button", { name: "Macintosh SSD" });
    expect(icon).toHaveClass("mac-desktop-icon");
    expect(icon).toHaveAttribute("type", "button");
    expect(icon).toHaveAttribute("aria-pressed", "false");
    expect(icon).not.toHaveAttribute("data-selected");
    expect(icon).not.toHaveAttribute("data-dimmed");
    expect(screen.getByTestId("art").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("toggles its own selection on a click when it is not on a desktop", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    render(
      <DesktopIcon icon={null} onSelectedChange={onSelectedChange}>
        Notes
      </DesktopIcon>,
    );
    const icon = screen.getByRole("button");
    await user.click(icon);
    expect(icon).toHaveAttribute("aria-pressed", "true");
    expect(icon).toHaveAttribute("data-selected");
    expect(onSelectedChange).toHaveBeenLastCalledWith(true);
    await user.click(icon);
    expect(icon).toHaveAttribute("aria-pressed", "false");
    expect(onSelectedChange).toHaveBeenLastCalledWith(false);
  });

  it("toggles with Space", async () => {
    const user = userEvent.setup();
    render(<DesktopIcon icon={null}>Notes</DesktopIcon>);
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("starts selected with defaultSelected", () => {
    render(
      <DesktopIcon icon={null} defaultSelected>
        Notes
      </DesktopIcon>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("leaves a controlled selection to its owner", async () => {
    const user = userEvent.setup();
    const onSelectedChange = vi.fn();
    render(
      <DesktopIcon icon={null} selected={false} onSelectedChange={onSelectedChange}>
        Notes
      </DesktopIcon>,
    );
    await user.click(screen.getByRole("button"));
    expect(onSelectedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("is identified on a desktop by its label, or by value when given", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Desktop onValueChange={onValueChange}>
        <DesktopIcon icon={null}>Plan.pdf</DesktopIcon>
        <DesktopIcon icon={null} value="file-2">
          <em>Song</em>.m4a
        </DesktopIcon>
      </Desktop>,
    );
    await user.click(screen.getByRole("button", { name: "Plan.pdf" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["Plan.pdf"]);
    await user.click(screen.getByRole("button", { name: "Song.m4a" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["file-2"]);
  });

  it("takes its selection from the desktop, whatever its own props say", () => {
    render(
      <Desktop value={["Plan.pdf"]}>
        <DesktopIcon icon={null} selected={false}>
          Plan.pdf
        </DesktopIcon>
      </Desktop>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("opens on a double click", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <DesktopIcon icon={null} onOpen={onOpen}>
        Notes
      </DesktopIcon>,
    );
    await user.dblClick(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("opens with Return, Command-O and Command-Down, without changing the selection", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <DesktopIcon icon={null} onOpen={onOpen}>
        Notes
      </DesktopIcon>,
    );
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
    await user.keyboard("{Meta>}o{/Meta}");
    expect(onOpen).toHaveBeenCalledTimes(2);
    await user.keyboard("{Meta>}{ArrowDown}{/Meta}");
    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("does not open when the application's handler prevented the event", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <DesktopIcon
        icon={null}
        onOpen={onOpen}
        onDoubleClick={(event) => event.preventDefault()}
        onKeyDown={(event) => event.preventDefault()}
      >
        Notes
      </DesktopIcon>,
    );
    await user.dblClick(screen.getByRole("button"));
    await user.keyboard("{Enter}");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("marks dimmed artwork", () => {
    render(
      <DesktopIcon icon={null} dimmed>
        Hidden
      </DesktopIcon>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-dimmed");
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <DesktopIcon icon={null} disabled onOpen={onOpen}>
        Notes
      </DesktopIcon>,
    );
    const icon = screen.getByRole("button");
    await user.dblClick(icon);
    expect(icon).toBeDisabled();
    expect(icon).toHaveAttribute("aria-pressed", "false");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("forwards ref, className, style and other attributes", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <DesktopIcon ref={ref} icon={null} className="volume" style={{ margin: 4 }} id="ssd">
        Macintosh SSD
      </DesktopIcon>,
    );
    const icon = screen.getByRole("button");
    expect(ref.current).toBe(icon);
    expect(icon).toHaveClass("mac-desktop-icon", "volume");
    expect(icon).toHaveStyle({ margin: "4px" });
    expect(icon).toHaveAttribute("id", "ssd");
  });
});
