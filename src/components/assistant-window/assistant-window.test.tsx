import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DefaultButton } from "../default-button";
import { PushButton } from "../push-button";
import {
  AssistantWindow,
  AssistantWindowActions,
  AssistantWindowContent,
  AssistantWindowHeading,
  AssistantWindowText,
} from "./index";

function Assistant(props: Partial<ComponentProps<typeof AssistantWindow>>) {
  return (
    <AssistantWindow title="Boot Camp Assistant" data-testid="window" {...props}>
      <AssistantWindowHeading id="step">Introduction</AssistantWindowHeading>
      <AssistantWindowText aria-labelledby="step">
        <p>First paragraph.</p>
        <p>Second paragraph.</p>
      </AssistantWindowText>
      <AssistantWindowActions leading={<PushButton>Open Help</PushButton>}>
        <PushButton>Continue</PushButton>
      </AssistantWindowActions>
    </AssistantWindow>
  );
}

const frame = () => screen.getByRole("region", { name: "Boot Camp Assistant" });

describe("AssistantWindow", () => {
  it("is a key window named by its title, 783 by 548 pt", () => {
    render(<Assistant />);
    expect(frame()).toBe(screen.getByTestId("window"));
    expect(frame()).toHaveClass("mac-window", "mac-assistant-window");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveStyle({ width: "783px", height: "548px" });
  });

  it("takes another size and state", () => {
    render(<Assistant width={600} height="60%" state="inactive" />);
    expect(frame()).toHaveStyle({ width: "600px", height: "60%" });
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
  });

  it("has the three window controls with zoom disabled, and reports the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Assistant onClose={onClose} />);
    expect(screen.getByRole("button", { name: /zoom/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports a press on its title bar, and not one on a window control, for a window manager", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Assistant
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const close = screen.getByRole("button", { name: /close/i });
    await user.pointer([{ keys: "[MouseLeft>]", target: close }, { keys: "[/MouseLeft]" }]);
    await user.dblClick(close);
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    expect(onDragRegionDoubleClick).not.toHaveBeenCalled();
    const bar = frame().querySelector("[data-window-drag-region]") as HTMLElement;
    await user.pointer([{ keys: "[MouseLeft>]", target: bar }, { keys: "[/MouseLeft]" }]);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("shows the controls it is given, or none", () => {
    const { rerender } = render(<Assistant controls={<button type="button">Shut</button>} />);
    expect(screen.getByRole("button", { name: "Shut" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /zoom/i })).not.toBeInTheDocument();
    rerender(<Assistant controls={null} />);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Open Help",
      "Continue",
    ]);
  });

  it("keeps its artwork out of the accessibility tree, beside the step", () => {
    render(<Assistant artwork={<img src="diamonds.png" alt="Diamonds" />} />);
    const column = frame().querySelector(".mac-assistant-window-artwork") as HTMLElement;
    expect(column).toHaveAttribute("aria-hidden", "true");
    expect(column.querySelector("img")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(column.nextElementSibling).toHaveClass("mac-assistant-window-step");
  });

  it("reports Escape pressed inside it, unless something inside used the key", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <AssistantWindow title="Boot Camp Assistant" onCancel={onCancel} onKeyDown={onKeyDown}>
        <PushButton>Continue</PushButton>
        <input
          aria-label="Name"
          onKeyDown={(event) => {
            if (event.key === "Escape") event.preventDefault();
          }}
        />
      </AssistantWindow>,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalled();
    await user.keyboard("a");
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("textbox", { name: "Name" }));
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("activates the default button inside with Return, from the text box", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <AssistantWindow title="Boot Camp Assistant" controls={null}>
        <AssistantWindowText aria-label="Introduction">
          <p>Text.</p>
        </AssistantWindowText>
        <AssistantWindowActions>
          <DefaultButton onClick={onContinue}>Continue</DefaultButton>
        </AssistantWindowActions>
      </AssistantWindow>,
    );
    await user.tab();
    expect(screen.getByRole("group", { name: "Introduction" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("shows the step it is given and says its name when it changes", async () => {
    const user = userEvent.setup();
    function Steps() {
      const [step, setStep] = useState(0);
      return (
        <AssistantWindow title="Boot Camp Assistant" onCancel={() => setStep(0)}>
          <AssistantWindowHeading>
            {step === 0 ? "Introduction" : "Select Tasks"}
          </AssistantWindowHeading>
          <AssistantWindowContent>{step === 0 ? "Welcome" : "Tasks"}</AssistantWindowContent>
          <AssistantWindowActions>
            {step > 0 ? <PushButton onClick={() => setStep(0)}>Go Back</PushButton> : null}
            <PushButton onClick={() => setStep(1)}>Continue</PushButton>
          </AssistantWindowActions>
        </AssistantWindow>
      );
    }
    render(<Steps />);
    const heading = screen.getByRole("heading", { level: 1, name: "Introduction" });
    expect(heading).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button", { name: "Go Back" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    // The same element, so that the live region announces the change.
    expect(heading).toHaveTextContent("Select Tasks");
    expect(screen.getByText("Tasks")).toHaveClass("mac-assistant-window-content");

    await user.click(screen.getByRole("button", { name: "Go Back" }));
    expect(heading).toHaveTextContent("Introduction");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.keyboard("{Escape}");
    expect(heading).toHaveTextContent("Introduction");
  });

  it("merges className and style and forwards ref and other props", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Assistant ref={ref} className="mine" style={{ left: 10 }} id="assistant" />);
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-assistant-window", "mine");
    expect(frame()).toHaveStyle({ left: "10px", width: "783px" });
    expect(frame()).toHaveAttribute("id", "assistant");
  });
});

describe("AssistantWindowText", () => {
  it("is a tab stop named by the heading, holding its paragraphs", async () => {
    const user = userEvent.setup();
    render(<Assistant controls={null} />);
    const text = screen.getByText("First paragraph.").parentElement as HTMLElement;
    expect(text).toHaveClass("mac-assistant-window-text");
    expect(text).toHaveAttribute("aria-labelledby", "step");
    expect(screen.getByRole("group", { name: "Introduction" })).toBe(text);
    expect(within(text).getByText("Second paragraph.").tagName).toBe("P");
    await user.tab();
    expect(text).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Open Help" })).toHaveFocus();
  });

  it("forwards ref, className and attributes, and can leave the tab order", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <AssistantWindowText ref={ref} className="extra" id="text" tabIndex={-1}>
        Text
      </AssistantWindowText>,
    );
    expect(ref.current).toHaveClass("mac-assistant-window-text", "extra");
    expect(ref.current).toHaveAttribute("id", "text");
    expect(ref.current).toHaveAttribute("tabindex", "-1");
  });
});

describe("AssistantWindowActions", () => {
  it("puts the leading controls before the navigation buttons", () => {
    render(
      <AssistantWindowActions data-testid="row" leading={<PushButton>Open Help</PushButton>}>
        <PushButton>Go Back</PushButton>
        <PushButton>Continue</PushButton>
      </AssistantWindowActions>,
    );
    const row = screen.getByTestId("row");
    expect(row).toHaveClass("mac-assistant-window-actions");
    expect(
      within(row)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Open Help", "Go Back", "Continue"]);
    expect(row.firstElementChild).toHaveClass("mac-assistant-window-actions-leading");
    expect(row.lastElementChild).toHaveClass("mac-assistant-window-actions-trailing");
  });

  it("has no leading group when it is given none", () => {
    render(
      <AssistantWindowActions data-testid="row">
        <PushButton>Continue</PushButton>
      </AssistantWindowActions>,
    );
    expect(screen.getByTestId("row").children).toHaveLength(1);
  });
});
