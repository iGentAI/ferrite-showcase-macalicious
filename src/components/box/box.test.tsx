import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Box } from "./index";

describe("Box", () => {
  it("renders an untitled group around its children by default", () => {
    render(<Box>Content</Box>);
    const box = screen.getByRole("group");
    expect(box).toHaveClass("mac-box");
    expect(box).toHaveAttribute("data-variant", "group");
    expect(box).toHaveAttribute("data-edges", "all");
    expect(box).not.toHaveAttribute("aria-labelledby");
    expect(box).not.toHaveAttribute("data-title-position");
    expect(box).not.toHaveAttribute("tabindex");
    expect(box).toHaveTextContent("Content");
  });

  it("is named by its title", () => {
    render(<Box title="Interface information">Content</Box>);
    const box = screen.getByRole("group", { name: "Interface information" });
    expect(box).toHaveAttribute("data-title-position", "above");
    // The title comes before the content, for reading order as well as for layout.
    expect(box.firstElementChild).toHaveTextContent("Interface information");
    expect(box.lastElementChild).toHaveTextContent("Content");
  });

  it("gives each box its own title id", () => {
    render(
      <>
        <Box title="First">A</Box>
        <Box title="Second">B</Box>
      </>,
    );
    const first = screen.getByRole("group", { name: "First" });
    const second = screen.getByRole("group", { name: "Second" });
    expect(first.getAttribute("aria-labelledby")).not.toBe(second.getAttribute("aria-labelledby"));
  });

  it("reflects title position, variant and edges as data attributes", () => {
    render(
      <Box title="Usage" titlePosition="below" variant="content" edges="horizontal">
        Content
      </Box>,
    );
    const box = screen.getByRole("group", { name: "Usage" });
    expect(box).toHaveAttribute("data-title-position", "below");
    expect(box).toHaveAttribute("data-variant", "content");
    expect(box).toHaveAttribute("data-edges", "horizontal");
  });

  it("offers the rounded well as a variant", () => {
    render(
      <Box variant="well" aria-label="CPU load">
        Content
      </Box>,
    );
    const box = screen.getByRole("group", { name: "CPU load" });
    expect(box).toHaveAttribute("data-variant", "well");
    expect(box).toHaveAttribute("data-edges", "all");
  });

  it("can be named with aria-label instead of a visible title", () => {
    render(<Box aria-label="Output devices">Content</Box>);
    expect(screen.getByRole("group", { name: "Output devices" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Box ref={ref} className="extra" id="box" style={{ width: 300 }}>
        Content
      </Box>,
    );
    expect(ref.current).toBe(screen.getByRole("group"));
    expect(ref.current).toHaveClass("mac-box", "extra");
    expect(ref.current).toHaveAttribute("id", "box");
    expect(ref.current?.style.width).toBe("300px");
  });
});
