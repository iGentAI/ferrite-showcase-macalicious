import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { HudWindow, HudWindowButton, HudWindowSlider, HudWindowText } from "./index";

describe("HudWindow", () => {
  it("is a group in Dark Aqua, a key panel without a title bar by default", () => {
    const { container } = render(<HudWindow aria-label="Adjust">Content</HudWindow>);
    const hud = screen.getByRole("group", { name: "Adjust" });
    expect(hud).toHaveClass("mac-hud-window");
    expect(hud).toHaveAttribute("data-appearance", "dark");
    expect(hud).toHaveAttribute("data-variant", "panel");
    expect(hud).toHaveAttribute("data-window-state", "key");
    expect(hud).not.toHaveAttribute("data-title-bar");
    expect(container.querySelector(".mac-hud-window-title-bar")).toBeNull();
    expect(container.querySelector(".mac-hud-window-body")).toHaveTextContent("Content");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is named by its title, which draws the title bar", () => {
    render(<HudWindow title="Adjust Color">Content</HudWindow>);
    const hud = screen.getByRole("group", { name: "Adjust Color" });
    expect(hud).toHaveAttribute("data-title-bar");
    // A title alone brings no close button.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reflects the variant and the window state", () => {
    render(<HudWindow aria-label="Playback" variant="controller" state="inactive" />);
    const hud = screen.getByRole("group", { name: "Playback" });
    expect(hud).toHaveAttribute("data-variant", "controller");
    expect(hud).toHaveAttribute("data-window-state", "inactive");
  });

  it("has a close button when onClose is given, activated by click, Return and Space", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HudWindow title="Adjust" onClose={onClose} />);
    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveAttribute("type", "button");

    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("draws the title bar for a close button alone, and names the button as told", () => {
    render(<HudWindow aria-label="Adjust" onClose={() => {}} closeLabel="Hide Adjustments" />);
    expect(screen.getByRole("group", { name: "Adjust" })).toHaveAttribute("data-title-bar");
    expect(screen.getByRole("button", { name: "Hide Adjustments" })).toBeInTheDocument();
  });

  it("has no title bar as a controller: a title only names it and onClose draws nothing", () => {
    render(<HudWindow variant="controller" title="Playback" onClose={() => {}} />);
    const hud = screen.getByRole("group", { name: "Playback" });
    expect(hud).not.toHaveAttribute("data-title-bar");
    expect(screen.queryByText("Playback")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reaches the close button first, then the content, with Tab", async () => {
    const user = userEvent.setup();
    render(
      <HudWindow title="Adjust" onClose={() => {}}>
        <HudWindowButton>Reset</HudWindowButton>
      </HudWindow>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Reset" })).toHaveFocus();
  });

  it("accepts another role, a ref, a className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <HudWindow
        ref={ref}
        role="toolbar"
        aria-label="Playback"
        className="extra"
        id="hud"
        data-movie="1"
      />,
    );
    const toolbar = screen.getByRole("toolbar", { name: "Playback" });
    expect(ref.current).toBe(toolbar);
    expect(toolbar).toHaveClass("mac-hud-window", "extra");
    expect(toolbar).toHaveAttribute("id", "hud");
    expect(toolbar).toHaveAttribute("data-movie", "1");
  });
});

describe("HudWindowButton", () => {
  it("is a button that acts on click, Return and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HudWindowButton aria-label="Play" onClick={onClick} />);
    const play = screen.getByRole("button", { name: "Play" });
    expect(play).toHaveClass("mac-hud-window-button");
    expect(play).toHaveAttribute("type", "button");

    await user.click(play);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HudWindowButton aria-label="Play" disabled onClick={onClick} />);
    const play = screen.getByRole("button", { name: "Play" });
    expect(play).toBeDisabled();
    await user.click(play);
    expect(onClick).not.toHaveBeenCalled();
    await user.tab();
    expect(play).not.toHaveFocus();
  });

  it("forwards ref and attributes and keeps its class with a string or a state function", () => {
    const ref = createRef<HTMLElement>();
    const { rerender } = render(
      <HudWindowButton ref={ref} className="extra" id="play" aria-label="Play" />,
    );
    const play = screen.getByRole("button", { name: "Play" });
    expect(ref.current).toBe(play);
    expect(play).toHaveClass("mac-hud-window-button", "extra");
    expect(play).toHaveAttribute("id", "play");

    rerender(
      <HudWindowButton
        aria-label="Play"
        disabled
        className={(state) => (state.disabled ? "is-off" : "is-on")}
      />,
    );
    expect(screen.getByRole("button")).toHaveClass("mac-hud-window-button", "is-off");
  });
});

describe("HudWindowText", () => {
  it("is a span that forwards ref, className and attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <HudWindowText ref={ref} className="extra" id="time">
        00:03:16:12
      </HudWindowText>,
    );
    const text = screen.getByText("00:03:16:12");
    expect(ref.current).toBe(text);
    expect(text.tagName).toBe("SPAN");
    expect(text).toHaveClass("mac-hud-window-text", "extra");
    expect(text).toHaveAttribute("id", "time");
  });
});

describe("HudWindowSlider", () => {
  it("is a slider named by its label, a knob unless told otherwise", () => {
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(
      <HudWindowSlider ref={ref} aria-label="Volume" defaultValue={70} className="extra" />,
    );
    const input = screen.getByRole("slider", { name: "Volume" });
    expect(input).toHaveValue("70");
    expect(ref.current).toHaveClass("mac-hud-window-slider", "extra");
    expect(ref.current).toHaveAttribute("data-variant", "knob");
    expect(ref.current).toContainElement(input);

    rerender(<HudWindowSlider ref={ref} variant="scrubber" aria-label="Timeline" />);
    expect(ref.current).toHaveAttribute("data-variant", "scrubber");
  });

  it("moves with the arrow keys, Page Up, Page Down, Home and End", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<HudWindowSlider aria-label="Volume" defaultValue={40} onValueChange={onValueChange} />);
    const input = screen.getByRole("slider");
    await user.tab();
    expect(input).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(input).toHaveValue("41");
    expect(onValueChange).toHaveBeenLastCalledWith(41, expect.anything());
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(input).toHaveValue("39");
    await user.keyboard("{PageUp}");
    expect(input).toHaveValue("49");
    await user.keyboard("{PageDown}");
    expect(input).toHaveValue("39");
    await user.keyboard("{End}");
    expect(input).toHaveValue("100");
    await user.keyboard("{Home}");
    expect(input).toHaveValue("0");
  });

  it("honours min, max and step, and reads its value as the text it is given", async () => {
    const user = userEvent.setup();
    render(
      <HudWindowSlider
        variant="scrubber"
        aria-label="Timeline"
        aria-valuetext="00:03:16"
        max={769}
        step={5}
        defaultValue={195}
      />,
    );
    const input = screen.getByRole("slider", { name: "Timeline" });
    expect(input).toHaveAttribute("aria-valuetext", "00:03:16");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(input).toHaveValue("200");
    await user.keyboard("{End}");
    expect(input).toHaveValue("769");
  });

  it("ignores the keyboard and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <HudWindowSlider
        aria-label="Volume"
        disabled
        defaultValue={40}
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole("slider");
    expect(input).toBeDisabled();
    expect(container.firstElementChild).toHaveAttribute("data-disabled");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(input).not.toHaveFocus();
    expect(input).toHaveValue("40");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
