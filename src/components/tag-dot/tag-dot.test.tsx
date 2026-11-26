import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { TagDot, TagDotGroup } from "./index";

describe("TagDot", () => {
  it("is a decorative, colourless, regular dot by default", () => {
    render(<TagDot data-testid="dot" />);
    const dot = screen.getByTestId("dot");
    expect(dot).toHaveClass("mac-tag-dot");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).not.toHaveAttribute("role");
    expect(dot).toHaveAttribute("data-color", "none");
    expect(dot).toHaveAttribute("data-size", "regular");
    expect(dot).not.toHaveAttribute("data-emphasized");
    expect(dot).not.toHaveAttribute("tabindex");
  });

  it("reflects colour, size and emphasis as data attributes", () => {
    render(<TagDot data-testid="dot" color="purple" size="small" emphasized />);
    const dot = screen.getByTestId("dot");
    expect(dot).toHaveAttribute("data-color", "purple");
    expect(dot).toHaveAttribute("data-size", "small");
    expect(dot).toHaveAttribute("data-emphasized");
  });

  it("becomes an image when it is given a name", () => {
    render(<TagDot color="blue" aria-label="Blue tag" />);
    const dot = screen.getByRole("img", { name: "Blue tag" });
    expect(dot).not.toHaveAttribute("aria-hidden");
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<TagDot ref={ref} className="extra" id="dot" />);
    expect(ref.current).toHaveClass("mac-tag-dot", "extra");
    expect(ref.current).toHaveAttribute("id", "dot");
  });
});

describe("TagDotGroup", () => {
  it("wraps its dots in document order and forwards ref, className and attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <TagDotGroup ref={ref} className="extra" role="img" aria-label="Red and blue tags">
        <TagDot color="red" data-testid="first" />
        <TagDot color="blue" data-testid="second" />
      </TagDotGroup>,
    );
    const group = screen.getByRole("img", { name: "Red and blue tags" });
    expect(group).toBe(ref.current);
    expect(group).toHaveClass("mac-tag-dot-group", "extra");
    expect(group.firstElementChild).toBe(screen.getByTestId("first"));
    expect(group.lastElementChild).toBe(screen.getByTestId("second"));
  });
});
