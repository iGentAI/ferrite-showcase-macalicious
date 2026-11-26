import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { WindowControls, WindowControlsButton } from "./index";

describe("WindowControls", () => {
  it("renders a named group of the three buttons", () => {
    render(<WindowControls />);
    const group = screen.getByRole("group", { name: "Window controls" });
    expect(group).toHaveClass("mac-window-controls");
    expect(group).toHaveAttribute("data-size", "regular");
    const names = within(group)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual(["Close", "Minimize", "Enter Full Screen"]);
  });

  it.each([
    ["full-screen", "Enter Full Screen"],
    ["zoom", "Zoom"],
    ["exit-full-screen", "Exit Full Screen"],
  ] as const)("names the zoom button for the %s role", (zoomRole, name) => {
    render(<WindowControls zoomRole={zoomRole} />);
    expect(screen.getByRole("button", { name })).toHaveAttribute("data-kind", "zoom");
  });

  it("accepts other labels", () => {
    render(
      <WindowControls closeLabel="Schließen" minimizeLabel="Im Dock ablegen" zoomLabel="Zoomen" />,
    );
    expect(screen.getByRole("button", { name: "Schließen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Im Dock ablegen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoomen" })).toBeInTheDocument();
  });

  const CONTROLS = [
    ["Close", "onClose", "closeDisabled"],
    ["Minimize", "onMinimize", "minimizeDisabled"],
    ["Enter Full Screen", "onZoom", "zoomDisabled"],
  ] as const;

  it.each(CONTROLS)("activates %s by pointer, Return and Space", async (name, handler) => {
    const user = userEvent.setup();
    const handlers = { onClose: vi.fn(), onMinimize: vi.fn(), onZoom: vi.fn() };
    render(<WindowControls {...handlers} />);
    const button = screen.getByRole("button", { name });

    await user.click(button);
    expect(handlers[handler]).toHaveBeenCalledTimes(1);
    button.focus();
    await user.keyboard("{Enter}");
    expect(handlers[handler]).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(handlers[handler]).toHaveBeenCalledTimes(3);

    for (const [, other] of CONTROLS) {
      if (other !== handler) expect(handlers[other]).not.toHaveBeenCalled();
    }
  });

  it.each(CONTROLS)("disables %s alone and ignores its activation", async (name, handler, prop) => {
    const user = userEvent.setup();
    const handlers = { onClose: vi.fn(), onMinimize: vi.fn(), onZoom: vi.fn() };
    render(<WindowControls {...handlers} {...{ [prop]: true }} />);
    const button = screen.getByRole("button", { name });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");
    for (const [other] of CONTROLS) {
      if (other !== name) expect(screen.getByRole("button", { name: other })).toBeEnabled();
    }

    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(handlers[handler]).not.toHaveBeenCalled();
  });

  it("marks an edited document on the close button", () => {
    const { rerender } = render(<WindowControls />);
    const close = screen.getByRole("button", { name: "Close" });
    expect(close).not.toHaveAttribute("data-edited");
    rerender(<WindowControls edited />);
    expect(close).toHaveAttribute("data-edited");
  });

  it("reflects the small size", () => {
    render(<WindowControls size="small" />);
    expect(screen.getByRole("group")).toHaveAttribute("data-size", "small");
  });

  it("renders a custom set of buttons given as children", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <WindowControls>
        <WindowControlsButton kind="close" aria-label="Close panel" onClick={onClose} />
      </WindowControls>,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("names each button of a custom set after what it does, unless it is given a name", () => {
    render(
      <WindowControls>
        <WindowControlsButton kind="close" />
        <WindowControlsButton kind="minimize" />
        <WindowControlsButton kind="zoom" zoomRole="zoom" aria-label="Fill Screen" />
      </WindowControls>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("data-kind", "close");
    expect(screen.getByRole("button", { name: "Minimize" })).toHaveAttribute(
      "data-kind",
      "minimize",
    );
    expect(screen.getByRole("button", { name: "Fill Screen" })).toHaveAttribute(
      "data-kind",
      "zoom",
    );
    expect(screen.queryByRole("button", { name: "Zoom" })).not.toBeInTheDocument();
  });

  it.each([
    ["full-screen", "Enter Full Screen"],
    ["zoom", "Zoom"],
    ["exit-full-screen", "Exit Full Screen"],
  ] as const)('names an unlabelled zoom button with zoomRole %s "%s"', (zoomRole, name) => {
    render(
      <WindowControls>
        <WindowControlsButton kind="zoom" zoomRole={zoomRole} />
      </WindowControls>,
    );
    expect(screen.getByRole("button", { name })).toHaveAttribute("data-kind", "zoom");
  });

  it('names an unlabelled zoom button "Enter Full Screen" when no zoomRole is given', () => {
    render(
      <WindowControls>
        <WindowControlsButton kind="zoom" />
      </WindowControls>,
    );
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeInTheDocument();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    const buttonRef = createRef<HTMLElement>();
    render(
      <WindowControls ref={ref} className="extra" id="controls" aria-label="Fenster">
        <WindowControlsButton ref={buttonRef} kind="zoom" aria-label="Zoom" className="mine" />
      </WindowControls>,
    );
    expect(ref.current).toBe(screen.getByRole("group", { name: "Fenster" }));
    expect(ref.current).toHaveClass("mac-window-controls", "extra");
    expect(ref.current).toHaveAttribute("id", "controls");
    expect(buttonRef.current).toHaveClass("mac-window-controls-button", "mine");
  });
});
