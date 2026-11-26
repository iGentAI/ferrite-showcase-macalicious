import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../toolbar";
import { ToolbarButton } from "./index";

describe("ToolbarButton", () => {
  it("renders a native button that is not a toggle", () => {
    render(<ToolbarButton>Done</ToolbarButton>);
    const button = screen.getByRole("button", { name: "Done" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveClass("mac-toolbar-button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("aria-pressed");
  });

  it("activates with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ToolbarButton onClick={onClick}>Done</ToolbarButton>);
    await user.click(screen.getByRole("button"));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("ignores activation when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ToolbarButton disabled onClick={onClick}>
        Share
      </ToolbarButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps its own state as an uncontrolled toggle", async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(
      <ToolbarButton defaultPressed={false} onPressedChange={onPressedChange}>
        Reader
      </ToolbarButton>,
    );
    const button = screen.getByRole("button", { name: "Reader" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-pressed");
    expect(onPressedChange.mock.lastCall?.[0]).toBe(true);
  });

  it("follows the pressed prop as a controlled toggle", async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    const { rerender } = render(
      <ToolbarButton pressed onPressedChange={onPressedChange}>
        Reader
      </ToolbarButton>,
    );
    const button = screen.getByRole("button");
    await user.click(button);
    expect(onPressedChange.mock.lastCall?.[0]).toBe(false);
    expect(button).toHaveAttribute("aria-pressed", "true");

    rerender(
      <ToolbarButton pressed={false} onPressedChange={onPressedChange}>
        Reader
      </ToolbarButton>,
    );
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("joins the arrow-key navigation of a toolbar, also as a toggle", async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(
      <Toolbar aria-label="Tools">
        <ToolbarButton>Back</ToolbarButton>
        <ToolbarButton defaultPressed={false} onPressedChange={onPressedChange}>
          Sidebar
        </ToolbarButton>
      </Toolbar>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    const sidebar = screen.getByRole("button", { name: "Sidebar" });
    expect(sidebar).toHaveFocus();
    expect(sidebar).toHaveClass("mac-toolbar-button");
    await user.keyboard(" ");
    expect(sidebar).toHaveAttribute("aria-pressed", "true");
    expect(onPressedChange.mock.lastCall?.[0]).toBe(true);
  });

  it("keeps disabled buttons, momentary and toggle, in the arrow-key order without acting", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onPressedChange = vi.fn();
    render(
      <Toolbar aria-label="Tools">
        <ToolbarButton>Back</ToolbarButton>
        <ToolbarButton disabled onClick={onClick}>
          Share
        </ToolbarButton>
        <ToolbarButton disabled defaultPressed={false} onPressedChange={onPressedChange}>
          Sidebar
        </ToolbarButton>
        <ToolbarButton>Info</ToolbarButton>
      </Toolbar>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    const share = screen.getByRole("button", { name: "Share" });
    expect(share).toHaveFocus();
    expect(share).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).not.toHaveBeenCalled();

    await user.keyboard("{ArrowRight}");
    const sidebar = screen.getByRole("button", { name: "Sidebar" });
    expect(sidebar).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(sidebar).toHaveAttribute("aria-pressed", "false");
    expect(onPressedChange).not.toHaveBeenCalled();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Info" })).toHaveFocus();
  });

  it.each(["in a toolbar", "on its own"])(
    "stays a toggle when the caller renders its element, %s",
    async (where) => {
      const user = userEvent.setup();
      const onPressedChange = vi.fn();
      const button = (
        <ToolbarButton
          defaultPressed={false}
          onPressedChange={onPressedChange}
          render={<button type="button" data-custom="yes" />}
        >
          Sidebar
        </ToolbarButton>
      );
      render(where === "in a toolbar" ? <Toolbar aria-label="Tools">{button}</Toolbar> : button);

      const sidebar = screen.getByRole("button", { name: "Sidebar" });
      expect(sidebar).toHaveAttribute("data-custom", "yes");
      expect(sidebar).toHaveClass("mac-toolbar-button");
      expect(sidebar).toHaveAttribute("aria-pressed", "false");

      await user.click(sidebar);
      expect(sidebar).toHaveAttribute("aria-pressed", "true");
      expect(sidebar).toHaveAttribute("data-pressed");
      expect(onPressedChange.mock.lastCall?.[0]).toBe(true);
    },
  );

  it("renders the caller's element when it is not a toggle, also in a toolbar", () => {
    render(
      <Toolbar aria-label="Tools">
        <ToolbarButton render={<button type="button" data-custom="yes" />}>Back</ToolbarButton>
      </Toolbar>,
    );
    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toHaveAttribute("data-custom", "yes");
    expect(back).toHaveClass("mac-toolbar-button");
    expect(back).not.toHaveAttribute("aria-pressed");
  });

  it("keeps its class when className is a string or a state function", () => {
    const { rerender } = render(<ToolbarButton className="extra">A</ToolbarButton>);
    expect(screen.getByRole("button")).toHaveClass("mac-toolbar-button", "extra");
    rerender(
      <ToolbarButton disabled className={(state) => (state.disabled ? "is-off" : "is-on")}>
        A
      </ToolbarButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("mac-toolbar-button", "is-off");
  });

  it("forwards ref and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <ToolbarButton ref={ref} id="share" aria-label="Share">
        <svg aria-hidden="true" />
      </ToolbarButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Share" }));
    expect(ref.current).toHaveAttribute("id", "share");
  });

  it("marks a tinted toggle and a bezel frame, and leaves a plain button unmarked", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ToolbarButton>Plain</ToolbarButton>
        <ToolbarButton pressedStyle="tint" defaultPressed={false} frame="bezel">
          Info
        </ToolbarButton>
      </>,
    );
    const plain = screen.getByRole("button", { name: "Plain" });
    expect(plain).not.toHaveAttribute("data-pressed-style");
    expect(plain).not.toHaveAttribute("data-frame");

    // The stylesheet draws the tint from these two attributes and Base UI's data-pressed.
    const info = screen.getByRole("button", { name: "Info" });
    expect(info).toHaveAttribute("data-pressed-style", "tint");
    expect(info).toHaveAttribute("data-frame", "bezel");
    expect(info).not.toHaveAttribute("data-pressed");
    await user.click(info);
    expect(info).toHaveAttribute("aria-pressed", "true");
    expect(info).toHaveAttribute("data-pressed");
  });
});
