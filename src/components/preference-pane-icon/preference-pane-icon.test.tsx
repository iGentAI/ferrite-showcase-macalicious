import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PreferencePaneIcon, PreferencePaneIconArtwork, PreferencePaneIconGrid } from "./index";

describe("PreferencePaneIcon", () => {
  it("is a native button named by its title, with the artwork inside", () => {
    render(
      <PreferencePaneIcon title="General">
        <svg data-testid="art" aria-hidden="true" />
      </PreferencePaneIcon>,
    );
    const button = screen.getByRole("button", { name: "General" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("mac-image-button", "mac-preference-pane-icon");
    expect(button).toContainElement(screen.getByTestId("art"));
  });

  it("keeps a written line break in the title and still has a one-line name", () => {
    render(<PreferencePaneIcon title={"Desktop &\nScreen Saver"} />);
    const button = screen.getByRole("button", { name: /^Desktop &\s+Screen Saver$/ });
    expect(button.textContent).toBe("Desktop &\nScreen Saver");
  });

  it("shows only the title when it has no artwork", () => {
    render(<PreferencePaneIcon title="Sidecar">{false}</PreferencePaneIcon>);
    const button = screen.getByRole("button", { name: "Sidecar" });
    expect(button.children).toHaveLength(1);
  });

  it("opens its pane on click, Return and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<PreferencePaneIcon title="Dock" onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Dock" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is momentary: it carries no pressed or selected state", async () => {
    const user = userEvent.setup();
    render(<PreferencePaneIcon title="Dock" />);
    const button = screen.getByRole("button", { name: "Dock" });
    await user.click(button);
    expect(button).not.toHaveAttribute("aria-pressed");
    expect(button).not.toHaveAttribute("aria-selected");
    expect(button).not.toHaveAttribute("aria-checked");
  });

  it("does nothing and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <PreferencePaneIcon title="Sidecar" disabled onClick={onClick} />
        <PreferencePaneIcon title="Displays" />
      </>,
    );
    const disabled = screen.getByRole("button", { name: "Sidecar" });
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(onClick).not.toHaveBeenCalled();
    await user.tab();
    expect(screen.getByRole("button", { name: "Displays" })).toHaveFocus();
  });

  it("forwards ref, className, style and other attributes to the button", () => {
    const ref = createRef<HTMLElement>();
    render(
      <PreferencePaneIcon
        ref={ref}
        title="Sound"
        className="pane"
        style={{ margin: 4 }}
        data-pane="sound"
      />,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Sound" }));
    expect(ref.current).toHaveClass("mac-preference-pane-icon", "pane");
    expect(ref.current).toHaveStyle({ margin: "4px" });
    expect(ref.current).toHaveAttribute("data-pane", "sound");
  });

  it("renders another element through render", () => {
    render(
      <PreferencePaneIcon title="Network" nativeButton={false} render={<a href="#network" />} />,
    );
    const link = screen.getByRole("button", { name: "Network" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveClass("mac-preference-pane-icon");
  });
});

describe("PreferencePaneIconGrid", () => {
  it("is a plain container that tabs through its panes in reading order", async () => {
    const user = userEvent.setup();
    render(
      <PreferencePaneIconGrid data-testid="grid">
        <PreferencePaneIcon title="General" />
        <PreferencePaneIcon title="Dock" />
      </PreferencePaneIconGrid>,
    );
    const grid = screen.getByTestId("grid");
    expect(grid).toHaveClass("mac-preference-pane-icon-grid");
    expect(grid).not.toHaveAttribute("role");
    expect(grid.style.getPropertyValue("--_columns")).toBe("8");
    await user.tab();
    expect(screen.getByRole("button", { name: "General" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Dock" })).toHaveFocus();
  });

  it("takes the number of columns, and forwards ref, className and style", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <PreferencePaneIconGrid ref={ref} columns={4} className="panes" style={{ margin: 2 }} />,
    );
    expect(ref.current).toHaveClass("mac-preference-pane-icon-grid", "panes");
    expect(ref.current?.style.getPropertyValue("--_columns")).toBe("4");
    expect(ref.current).toHaveStyle({ margin: "2px" });
  });
});

describe("PreferencePaneIconArtwork", () => {
  it("is a decorative grey tile by default", () => {
    render(<PreferencePaneIconArtwork data-testid="art" />);
    const art = screen.getByTestId("art");
    expect(art).toHaveClass("mac-preference-pane-icon-artwork");
    expect(art).toHaveAttribute("aria-hidden", "true");
    expect(art).toHaveAttribute("data-shape", "tile");
    expect(art).toHaveAttribute("data-tint", "gray");
  });

  it("reflects shape and tint, holds a glyph and forwards ref and className", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <PreferencePaneIconArtwork ref={ref} shape="circle" tint="blue" className="art">
        <svg data-testid="glyph" />
      </PreferencePaneIconArtwork>,
    );
    expect(ref.current).toHaveAttribute("data-shape", "circle");
    expect(ref.current).toHaveAttribute("data-tint", "blue");
    expect(ref.current).toHaveClass("mac-preference-pane-icon-artwork", "art");
    expect(ref.current).toContainElement(screen.getByTestId("glyph"));
  });

  it("does not add to the name of the button it sits in", () => {
    render(
      <PreferencePaneIcon title="Sound">
        <PreferencePaneIconArtwork>
          <svg>
            <title>speaker</title>
          </svg>
        </PreferencePaneIconArtwork>
      </PreferencePaneIcon>,
    );
    expect(screen.getByRole("button", { name: "Sound" })).toBeInTheDocument();
  });
});
