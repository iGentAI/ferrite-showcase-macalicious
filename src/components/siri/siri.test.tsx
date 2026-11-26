import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Siri, SiriCard } from "./index";

/** The waveform, which has no role: it is decoration inside the orb's button. */
const waveOf = (root: HTMLElement) => root.querySelector<HTMLElement>(".mac-siri-wave");

describe("Siri", () => {
  it("renders a dialog named Siri with a close button, the results and the orb", () => {
    render(<Siri>Answer</Siri>);
    const root = screen.getByRole("dialog", { name: "Siri" });
    expect(root).toHaveClass("mac-siri");
    expect(root).not.toHaveAttribute("data-listening");

    for (const name of ["Close", "Listen"]) {
      const button = within(root).getByRole("button", { name });
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
    }
    expect(screen.getByRole("button", { name: "Listen" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Help" })).not.toBeInTheDocument();

    const results = within(root).getByRole("group", { name: "Results" });
    expect(results).toHaveTextContent("Answer");
    expect(results).toHaveAttribute("aria-live", "polite");
    expect(waveOf(root)).toBeNull();
  });

  it("shows the prompt above the results", () => {
    render(<Siri prompt="What can I help you with?">Answer</Siri>);
    const results = screen.getByRole("group", { name: "Results" });
    expect(results.firstElementChild).toHaveTextContent("What can I help you with?");
    expect(results).toHaveTextContent("Answer");
  });

  it("replaces the orb with a waveform while listening", () => {
    const { rerender } = render(<Siri listening level={0.25} />);
    const root = screen.getByRole("dialog");
    expect(root).toHaveAttribute("data-listening");
    expect(screen.getByRole("button", { name: "Listen" })).toHaveAttribute("aria-pressed", "true");
    const wave = waveOf(root);
    expect(wave).toHaveAttribute("data-animated");
    expect(wave?.style.getPropertyValue("--_level")).toBe("0.25");

    rerender(<Siri listening level={7} animated={false} />);
    expect(waveOf(root)).not.toHaveAttribute("data-animated");
    expect(waveOf(root)?.style.getPropertyValue("--_level")).toBe("1");

    rerender(<Siri />);
    expect(waveOf(root)).toBeNull();
  });

  it("calls onListen for a click, Return and Space on the orb", async () => {
    const user = userEvent.setup();
    const onListen = vi.fn();
    render(<Siri onListen={onListen} />);

    await user.click(screen.getByRole("button", { name: "Listen" }));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onListen).toHaveBeenCalledTimes(3);
  });

  it("calls onClose from the close button and from Escape inside the window", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Siri onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("leaves Escape to a handler that prevents its default", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Siri onClose={onClose} onKeyDown={(event) => event.preventDefault()} />);

    await user.tab();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has a help button only with onHelp", async () => {
    const user = userEvent.setup();
    const onHelp = vi.fn();
    render(<Siri onHelp={onHelp} />);

    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(onHelp).toHaveBeenCalledTimes(1);
  });

  it("moves through its controls with Tab: close, results, help, orb", async () => {
    const user = userEvent.setup();
    render(<Siri onHelp={() => {}} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("group", { name: "Results" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Help" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Listen" })).toHaveFocus();
  });

  it("takes its accessible names from the label props and aria-label", () => {
    render(
      <Siri
        aria-label="Assistant"
        closeLabel="Dismiss"
        helpLabel="What can I ask?"
        listenLabel="Speak"
        resultsLabel="Answers"
        onHelp={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Assistant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What can I ask?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Speak" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Answers" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Siri ref={ref} className="extra" id="siri" style={{ height: 300 }} />);
    expect(ref.current).toBe(screen.getByRole("dialog"));
    expect(ref.current).toHaveClass("mac-siri", "extra");
    expect(ref.current).toHaveAttribute("id", "siri");
    expect(ref.current?.style.height).toBe("300px");
  });
});

describe("SiriCard", () => {
  it("renders an article named by its title, with the icon hidden from assistive technology", () => {
    render(
      <SiriCard title="Weather" icon={<svg data-testid="icon" />}>
        Sunny
      </SiriCard>,
    );
    const card = screen.getByRole("article", { name: "Weather" });
    expect(card).toHaveClass("mac-siri-card");
    expect(card).toHaveTextContent("Sunny");
    expect(screen.getByTestId("icon").closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("has no header and no name without a title", () => {
    render(<SiriCard>Sunny</SiriCard>);
    const card = screen.getByRole("article");
    expect(card).not.toHaveAttribute("aria-labelledby");
    expect(card.textContent).toBe("Sunny");
  });

  it("gives each card its own title id", () => {
    render(
      <>
        <SiriCard title="Weather">A</SiriCard>
        <SiriCard title="Calendar">B</SiriCard>
      </>,
    );
    const first = screen.getByRole("article", { name: "Weather" });
    const second = screen.getByRole("article", { name: "Calendar" });
    expect(first.getAttribute("aria-labelledby")).not.toBe(second.getAttribute("aria-labelledby"));
  });

  it("forwards ref, className, style and native attributes to the root", () => {
    const ref = createRef<HTMLElement>();
    render(
      <SiriCard ref={ref} className="extra" id="card" style={{ minHeight: 80 }}>
        Sunny
      </SiriCard>,
    );
    expect(ref.current).toBe(screen.getByRole("article"));
    expect(ref.current).toHaveClass("mac-siri-card", "extra");
    expect(ref.current).toHaveAttribute("id", "card");
    expect(ref.current?.style.minHeight).toBe("80px");
  });
});
