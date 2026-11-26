import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { NewItemDot } from "./index";

describe("NewItemDot", () => {
  it("is visible and decorative by default", () => {
    render(<NewItemDot data-testid="dot" />);
    const dot = screen.getByTestId("dot");
    expect(dot).toHaveClass("mac-new-item-dot");
    expect(dot).toHaveAttribute("data-visible");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).not.toHaveAttribute("role");
    expect(dot).not.toHaveAttribute("tabindex");
  });

  it("becomes an image when it is given a name", () => {
    render(<NewItemDot aria-label="New" />);
    expect(screen.getByRole("img", { name: "New" })).not.toHaveAttribute("aria-hidden");
  });

  it("keeps its element but leaves the accessibility tree when not visible", () => {
    render(<NewItemDot data-testid="dot" visible={false} aria-label="New" />);
    const dot = screen.getByTestId("dot");
    expect(dot).not.toHaveAttribute("data-visible");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<NewItemDot ref={ref} className="extra" id="dot" />);
    expect(ref.current).toHaveClass("mac-new-item-dot", "extra");
    expect(ref.current).toHaveAttribute("id", "dot");
  });
});
