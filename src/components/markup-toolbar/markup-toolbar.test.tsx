import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  MarkupToolbar,
  MarkupToolbarSeparator,
  MarkupToolbarSwatch,
  MarkupToolbarTool,
} from "./index";

function Tools(props: { onSketch?: () => void; onCrop?: () => void }) {
  return (
    <MarkupToolbar aria-label="Markup">
      <MarkupToolbarTool aria-label="Sketch" selected onClick={props.onSketch} />
      <MarkupToolbarTool aria-label="Draw" selected={false} />
      <MarkupToolbarTool aria-label="Shapes" menu />
      <MarkupToolbarSeparator data-testid="separator" />
      <MarkupToolbarTool aria-label="Rotate Left" disabled />
      <MarkupToolbarTool aria-label="Crop" onClick={props.onCrop} />
    </MarkupToolbar>
  );
}

const tool = (name: string) => screen.getByRole("button", { name });

describe("MarkupToolbar", () => {
  it("is a labelled toolbar of buttons with a separator", () => {
    render(<Tools />);
    expect(screen.getByRole("toolbar", { name: "Markup" })).toHaveClass("mac-markup-toolbar");
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(tool("Crop")).toHaveClass("mac-markup-toolbar-tool");
    expect(screen.getByRole("separator")).toBe(screen.getByTestId("separator"));
    expect(screen.getByRole("separator")).toHaveClass("mac-markup-toolbar-separator");
  });

  it("marks the active drawing tool, and only tools that are modes say pressed or not", () => {
    render(<Tools />);
    expect(tool("Sketch")).toHaveAttribute("aria-pressed", "true");
    expect(tool("Sketch")).toHaveAttribute("data-selected");
    expect(tool("Draw")).toHaveAttribute("aria-pressed", "false");
    expect(tool("Draw")).not.toHaveAttribute("data-selected");
    expect(tool("Crop")).not.toHaveAttribute("aria-pressed");
  });

  it("draws a chevron on a tool that opens choices and says it has a popup", () => {
    render(<Tools />);
    expect(tool("Shapes")).toHaveAttribute("aria-haspopup", "menu");
    expect(tool("Shapes").querySelector(".mac-markup-toolbar-tool-chevron")).not.toBeNull();
    expect(tool("Crop")).not.toHaveAttribute("aria-haspopup");
    expect(tool("Crop").querySelector(".mac-markup-toolbar-tool-chevron")).toBeNull();
  });

  it("activates a tool with a click, Return and Space", async () => {
    const user = userEvent.setup();
    const onSketch = vi.fn();
    render(<Tools onSketch={onSketch} />);
    await user.click(tool("Sketch"));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onSketch).toHaveBeenCalledTimes(3);
  });

  it("is one tab stop; the arrow keys move between its tools", async () => {
    const user = userEvent.setup();
    const onCrop = vi.fn();
    render(
      <>
        <Tools onCrop={onCrop} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(tool("Sketch")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tool("Draw")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tool("Sketch")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("is a horizontal toolbar: Up and Down Arrow do not move between its tools", async () => {
    const user = userEvent.setup();
    render(<Tools />);
    expect(screen.getByRole("toolbar")).not.toHaveAttribute("aria-orientation", "vertical");
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(tool("Sketch")).toHaveFocus();
  });

  it("does not activate a disabled tool", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <MarkupToolbar aria-label="Markup">
        <MarkupToolbarTool aria-label="Crop" disabled onClick={onClick} />
      </MarkupToolbar>,
    );
    expect(tool("Crop")).toHaveAttribute("data-disabled");
    await user.click(tool("Crop"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards ref, className and native attributes on the toolbar, a tool and a separator", () => {
    const bar = createRef<HTMLDivElement>();
    const button = createRef<HTMLButtonElement>();
    const line = createRef<HTMLDivElement>();
    render(
      <MarkupToolbar ref={bar} className="b" id="bar" aria-label="Markup">
        <MarkupToolbarTool ref={button} className="t" id="tool" aria-label="Crop" />
        <MarkupToolbarSeparator ref={line} className="s" id="line" />
      </MarkupToolbar>,
    );
    expect(bar.current).toHaveClass("mac-markup-toolbar", "b");
    expect(bar.current).toHaveAttribute("id", "bar");
    expect(button.current).toHaveClass("mac-markup-toolbar-tool", "t");
    expect(button.current).toHaveAttribute("id", "tool");
    expect(line.current).toHaveClass("mac-markup-toolbar-separator", "s");
    expect(line.current).toHaveAttribute("id", "line");
  });
});

describe("MarkupToolbarSwatch", () => {
  it("shows a colour as a filled square by default, hidden from assistive technology", () => {
    render(<MarkupToolbarSwatch data-testid="swatch" color="rgb(255, 149, 0)" />);
    const swatch = screen.getByTestId("swatch");
    expect(swatch).toHaveClass("mac-markup-toolbar-swatch");
    expect(swatch).toHaveAttribute("aria-hidden", "true");
    expect(swatch).toHaveAttribute("data-variant", "fill");
    expect(swatch).not.toHaveAttribute("data-none");
    expect(swatch).toHaveStyle({ color: "rgb(255, 149, 0)" });
  });

  it("shows 'none' without a colour, and reflects the border variant", () => {
    render(<MarkupToolbarSwatch data-testid="swatch" variant="border" />);
    const swatch = screen.getByTestId("swatch");
    expect(swatch).toHaveAttribute("data-none");
    expect(swatch).toHaveAttribute("data-variant", "border");
  });

  it("forwards ref, className, style and native attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <MarkupToolbarSwatch ref={ref} className="extra" id="swatch" style={{ opacity: 0.5 }} />,
    );
    expect(ref.current).toHaveClass("mac-markup-toolbar-swatch", "extra");
    expect(ref.current).toHaveAttribute("id", "swatch");
    expect(ref.current).toHaveStyle({ opacity: "0.5" });
  });
});
