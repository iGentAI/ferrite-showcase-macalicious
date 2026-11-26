import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dictation } from "./index";

/** The level the capsule is drawn with: the custom property the component sets. */
const levelOf = (panel: HTMLElement) =>
  panel.querySelector<HTMLElement>(".mac-dictation-level")?.style.getPropertyValue("--_level");

describe("Dictation", () => {
  it("renders a group named Dictation with a status and a Done button", () => {
    render(<Dictation />);
    const panel = screen.getByRole("group", { name: "Dictation" });
    expect(panel).toHaveClass("mac-dictation");
    expect(panel).toHaveAttribute("data-pointer", "right");
    expect(levelOf(panel)).toBe("0");

    const status = screen.getByRole("status");
    expect(status).toContainElement(screen.getByRole("img", { name: "Listening" }));

    const done = screen.getByRole("button", { name: "Done" });
    expect(done.tagName).toBe("BUTTON");
    expect(done).toHaveAttribute("type", "button");
    expect(panel).toContainElement(done);
  });

  it("draws the level it is given and clamps it to 0..1", () => {
    const { rerender } = render(<Dictation level={0.4} />);
    const panel = screen.getByRole("group");
    expect(levelOf(panel)).toBe("0.4");

    rerender(<Dictation level={3} />);
    expect(levelOf(panel)).toBe("1");

    rerender(<Dictation level={-1} />);
    expect(levelOf(panel)).toBe("0");

    rerender(<Dictation level={Number.NaN} />);
    expect(levelOf(panel)).toBe("0");
  });

  it("reflects the pointer edge as a data attribute", () => {
    const { rerender } = render(<Dictation pointer="left" />);
    const panel = screen.getByRole("group");
    expect(panel).toHaveAttribute("data-pointer", "left");

    rerender(<Dictation pointer="none" />);
    expect(panel).toHaveAttribute("data-pointer", "none");
  });

  it("calls onDone for a click, Return and Space on the button", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<Dictation onDone={onDone} />);

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledTimes(1);

    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onDone).toHaveBeenCalledTimes(3);
  });

  it("reaches the button with Tab and cancels with Escape from inside the panel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onDone = vi.fn();
    render(<Dictation onCancel={onCancel} onDone={onDone} />);

    await user.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();

    await user.tab();
    expect(screen.getByRole("button", { name: "Done" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("leaves Escape to a handler that prevents its default", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
    render(<Dictation onCancel={onCancel} onKeyDown={onKeyDown} />);

    await user.tab();
    await user.keyboard("{Escape}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("takes its texts from doneLabel, statusLabel and aria-label", () => {
    render(<Dictation doneLabel="Fertig" statusLabel="Hört zu" aria-label="Diktat" />);
    expect(screen.getByRole("group", { name: "Diktat" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Hört zu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fertig" })).toBeInTheDocument();
  });

  it("can be named by another element instead", () => {
    render(
      <>
        <h2 id="heading">Speak now</h2>
        <Dictation aria-labelledby="heading" />
      </>,
    );
    const panel = screen.getByRole("group", { name: "Speak now" });
    expect(panel).not.toHaveAttribute("aria-label");
  });

  it("forwards ref, className, style and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Dictation ref={ref} className="extra" id="panel" style={{ margin: 4 }} />);
    expect(ref.current).toBe(screen.getByRole("group"));
    expect(ref.current).toHaveClass("mac-dictation", "extra");
    expect(ref.current).toHaveAttribute("id", "panel");
    expect(ref.current?.style.margin).toBe("4px");
  });
});
