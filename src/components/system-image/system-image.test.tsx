import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { SYSTEM_IMAGE_NAMES, SystemImage } from "./index";

describe("SystemImage", () => {
  it("draws the named image at its own size, hidden from assistive technology", () => {
    render(<SystemImage name="add" data-testid="image" />);
    const image = screen.getByTestId("image");
    expect(image.tagName.toLowerCase()).toBe("svg");
    expect(image).toHaveClass("mac-system-image");
    expect(image).toHaveAttribute("data-name", "add");
    expect(image).toHaveAttribute("width", "11");
    expect(image).toHaveAttribute("height", "11");
    expect(image).toHaveAttribute("viewBox", "0 0 11 11");
    expect(image).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("is an image with a name when it is given one", () => {
    render(<SystemImage name="share" aria-label="Share" />);
    const image = screen.getByRole("img", { name: "Share" });
    expect(image).not.toHaveAttribute("aria-hidden");
  });

  it("scales its size and keeps the drawing's own coordinates", () => {
    render(<SystemImage name="go-back" scale={2} data-testid="image" />);
    const image = screen.getByTestId("image");
    expect(image).toHaveAttribute("width", "14");
    expect(image).toHaveAttribute("height", "24");
    expect(image).toHaveAttribute("viewBox", "0 0 7 12");
  });

  it("has a drawing for every name it lists", () => {
    expect(SYSTEM_IMAGE_NAMES.length).toBeGreaterThan(0);
    for (const name of SYSTEM_IMAGE_NAMES) {
      const { container, unmount } = render(<SystemImage name={name} />);
      const image = container.querySelector("svg");
      expect(image, name).toHaveAttribute("data-name", name);
      expect(image?.childElementCount, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it("draws info-outline as a 16 pt ring with a 1 pt stroke around the letter", () => {
    render(<SystemImage name="info-outline" data-testid="image" />);
    const image = screen.getByTestId("image");
    expect(image).toHaveAttribute("viewBox", "0 0 16 16");
    expect(image).toHaveAttribute("width", "16");
    expect(image).toHaveAttribute("height", "16");
    const [ring, dot] = image.querySelectorAll("circle");
    expect(ring).toHaveAttribute("r", "7.5");
    expect(ring).toHaveAttribute("fill", "none");
    expect(ring).toHaveAttribute("stroke", "currentColor");
    expect(ring).not.toHaveAttribute("stroke-width");
    expect(dot).toHaveAttribute("r", "1");
    expect(image.querySelector("path")).toBeInTheDocument();
  });

  it("draws tag on its 17 x 10 pt box with a body, an outline and a dot", () => {
    render(<SystemImage name="tag" data-testid="image" />);
    const image = screen.getByTestId("image");
    expect(image).toHaveAttribute("viewBox", "0 0 17 10");
    expect(image).toHaveAttribute("width", "17");
    expect(image).toHaveAttribute("height", "10");
    const [body, outline, dot] = image.querySelectorAll("path");
    // The body is the outline with the dot cut out of it, filled only in Dark Aqua.
    expect(body).toHaveClass("mac-system-image-body");
    expect(body).toHaveAttribute("fill-rule", "evenodd");
    expect(body?.getAttribute("d")).toBe(`${outline?.getAttribute("d")}${dot?.getAttribute("d")}`);
    expect(outline).toHaveAttribute("fill", "none");
    expect(outline).toHaveAttribute("stroke", "currentColor");
    expect(outline).toHaveAttribute("stroke-linejoin", "round");
    expect(dot).toHaveClass("mac-system-image-dot");
  });

  it("draws rotate-left on its 16 pt box: a page, an arrowhead and an arc", () => {
    render(<SystemImage name="rotate-left" data-testid="image" />);
    const image = screen.getByTestId("image");
    expect(image).toHaveAttribute("viewBox", "0 0 16 16");
    expect(image).toHaveAttribute("width", "16");
    expect(image).toHaveAttribute("height", "16");
    const page = image.querySelector("rect");
    expect(page).toHaveClass("mac-system-image-body");
    expect(page).toHaveAttribute("stroke", "currentColor");
    expect(page).toHaveAttribute("width", "9");
    expect(page).toHaveAttribute("height", "7");
    const [arrowhead, arc] = image.querySelectorAll("path");
    expect(arrowhead).not.toHaveAttribute("fill");
    expect(arc).toHaveAttribute("fill", "none");
    expect(arc).toHaveAttribute("stroke", "currentColor");
  });

  it("draws the letter of info again over its hole for a tinted toolbar toggle", () => {
    render(<SystemImage name="info" data-testid="image" />);
    const [disc, mark] = screen.getByTestId("image").querySelectorAll("path");
    expect(disc).toHaveAttribute("fill-rule", "evenodd");
    expect(mark).toHaveClass("mac-system-image-mark");
    expect(disc?.getAttribute("d")).toContain(String(mark?.getAttribute("d")));
  });

  it("forwards ref, className, style and native attributes", () => {
    const ref = createRef<SVGSVGElement>();
    render(
      <SystemImage ref={ref} name="info" className="extra" id="about" style={{ margin: 2 }} />,
    );
    expect(ref.current).toHaveClass("mac-system-image", "extra");
    expect(ref.current).toHaveAttribute("id", "about");
    expect(ref.current).toHaveStyle({ margin: "2px" });
  });
});
