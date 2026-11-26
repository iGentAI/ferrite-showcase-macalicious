import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuickLookPanel, QuickLookPanelButton } from "./index";

describe("QuickLookPanel", () => {
  it("is a key dialog named by its title, with the preview inside", () => {
    render(
      <QuickLookPanel title="Wave.jpg" data-testid="panel">
        <img alt="A wave" src="data:," />
      </QuickLookPanel>,
    );
    const panel = screen.getByRole("dialog", { name: "Wave.jpg" });
    expect(panel).toBe(screen.getByTestId("panel"));
    expect(panel).toHaveClass("mac-quick-look-panel", "mac-window-shadow");
    expect(panel).toHaveAttribute("data-window-state", "key");
    expect(panel).not.toHaveAttribute("aria-modal");
    expect(screen.getByRole("img", { name: "A wave" }).parentElement).toHaveClass(
      "mac-quick-look-panel-preview",
    );
  });

  it("reflects the window state and takes width and height", () => {
    render(<QuickLookPanel title="Wave.jpg" state="main" width={520} height={300} />);
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveAttribute("data-window-state", "main");
    expect(panel).toHaveStyle({ width: "520px", height: "300px" });
  });

  it("keeps an aria-label given to it instead of pointing at the title", () => {
    render(<QuickLookPanel title="Wave.jpg" aria-label="Quick Look" />);
    expect(screen.getByRole("dialog", { name: "Quick Look" })).not.toHaveAttribute(
      "aria-labelledby",
    );
  });

  it("reports Close and Full Screen from its two buttons", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onFullScreen = vi.fn();
    render(<QuickLookPanel title="Wave.jpg" onClose={onClose} onFullScreen={onFullScreen} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Enter Full Screen" }));
    expect(onFullScreen).toHaveBeenCalledTimes(1);
  });

  it("activates its buttons from the keyboard", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onFullScreen = vi.fn();
    render(<QuickLookPanel title="Wave.jpg" onClose={onClose} onFullScreen={onFullScreen} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onFullScreen).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(onFullScreen).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape pressed inside it, unless a handler prevented it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<QuickLookPanel title="Wave.jpg" onClose={onClose} />);
    await user.tab();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <QuickLookPanel
        title="Wave.jpg"
        onClose={onClose}
        onKeyDown={(event) => event.preventDefault()}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("marks the Escape it handles, so a dialog around it does not close as well", () => {
    const outer = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: stands for an enclosing dialog.
      <div onKeyDown={(event) => event.defaultPrevented || outer()}>
        <QuickLookPanel title="Wave.jpg" onClose={() => {}} />
        <QuickLookPanel title="Other.jpg" />
      </div>,
    );
    // fireEvent returns false when the event's default action was prevented.
    expect(
      fireEvent.keyDown(screen.getByRole("dialog", { name: "Wave.jpg" }), { key: "Escape" }),
    ).toBe(false);
    expect(outer).not.toHaveBeenCalled();
    // Without onClose the panel handles nothing, and the key is the enclosing dialog's.
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Other.jpg" }), { key: "Escape" });
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it("renders a zero given as tools or actions", () => {
    render(<QuickLookPanel title="Wave.jpg" tools={0} actions={0} data-testid="panel" />);
    const bar = screen.getByTestId("panel").querySelector(".mac-quick-look-panel-bar");
    expect(bar).toHaveAttribute("data-tools");
    expect(bar?.querySelector(".mac-quick-look-panel-tools")).toHaveTextContent("0");
    expect(bar?.querySelector(".mac-quick-look-panel-actions")).toHaveTextContent("0");
    expect(screen.queryByRole("button", { name: "Enter Full Screen" })).not.toBeInTheDocument();
  });

  it("cuts a title that does not fit with an ellipsis", () => {
    // jsdom lays nothing out, so the rule itself is read: the visual comparison long-title
    // shows that the title's box stays between the discs and the actions.
    const css = readFileSync(path.join(import.meta.dirname, "quick-look-panel.css"), "utf8");
    const rule = /\.mac-quick-look-panel-title \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/text-overflow: ellipsis;/);
    expect(rule).toMatch(/overflow: hidden;/);
    expect(rule).toMatch(/white-space: nowrap;/);
    expect(rule).toMatch(/min-width: 0;/);
  });

  it("shows its actions at the trailing edge of the bar", () => {
    render(
      <QuickLookPanel
        title="Wave.jpg"
        actions={<QuickLookPanelButton>Open with Preview</QuickLookPanelButton>}
      />,
    );
    expect(screen.getByRole("button", { name: "Open with Preview" }).parentElement).toHaveClass(
      "mac-quick-look-panel-actions",
    );
  });

  it("shows tools in place of the title, hides Full Screen and keeps its name", () => {
    render(
      <QuickLookPanel
        title="Wave.jpg"
        tools={<div role="toolbar" aria-label="Markup" />}
        data-testid="panel"
      />,
    );
    expect(screen.getByRole("dialog", { name: "Wave.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Markup" }).parentElement).toHaveClass(
      "mac-quick-look-panel-tools",
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter Full Screen" })).not.toBeInTheDocument();
    expect(screen.getByTestId("panel").querySelector(".mac-quick-look-panel-bar")).toHaveAttribute(
      "data-tools",
    );
  });

  it("forwards ref, className, style and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<QuickLookPanel ref={ref} className="extra" id="ql" style={{ top: 10 }} title="A" />);
    expect(ref.current).toHaveClass("mac-quick-look-panel", "extra");
    expect(ref.current).toHaveAttribute("id", "ql");
    expect(ref.current).toHaveStyle({ top: "10px" });
  });
});

describe("QuickLookPanelButton", () => {
  it("is a button that reports clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<QuickLookPanelButton onClick={onClick}>Done</QuickLookPanelButton>);
    const button = screen.getByRole("button", { name: "Done" });
    expect(button).toHaveClass("mac-quick-look-panel-button");
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <QuickLookPanelButton disabled onClick={onClick}>
        Done
      </QuickLookPanelButton>,
    );
    const button = screen.getByRole("button", { name: "Done" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(<QuickLookPanelButton ref={ref} className="extra" id="share" aria-label="Share" />);
    expect(ref.current).toHaveClass("mac-quick-look-panel-button", "extra");
    expect(ref.current).toHaveAttribute("id", "share");
  });
});
