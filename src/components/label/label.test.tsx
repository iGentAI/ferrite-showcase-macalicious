import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Label } from "./index";

describe("Label", () => {
  it("renders a span with the default text style, colour and alignment", () => {
    render(<Label>Status:</Label>);
    const label = screen.getByText("Status:");
    expect(label.tagName).toBe("SPAN");
    expect(label).toHaveClass("mac-label");
    expect(label).toHaveAttribute("data-text-style", "body");
    expect(label).toHaveAttribute("data-color", "primary");
    expect(label).toHaveAttribute("data-align", "start");
    expect(label).not.toHaveAttribute("data-disabled");
    expect(label).not.toHaveAttribute("data-selectable");
    expect(label).not.toHaveAttribute("data-truncate");
  });

  it("reflects every visual prop as a data attribute", () => {
    render(
      <Label textStyle="small-emphasized" color="tertiary" align="end" disabled selectable truncate>
        Location:
      </Label>,
    );
    const label = screen.getByText("Location:");
    expect(label).toHaveAttribute("data-text-style", "small-emphasized");
    expect(label).toHaveAttribute("data-color", "tertiary");
    expect(label).toHaveAttribute("data-align", "end");
    expect(label).toHaveAttribute("data-disabled");
    expect(label).toHaveAttribute("data-selectable");
    expect(label).toHaveAttribute("data-truncate");
  });

  it("offers the 12 pt callout style", () => {
    render(<Label textStyle="callout">Threads:</Label>);
    expect(screen.getByText("Threads:")).toHaveAttribute("data-text-style", "callout");
  });

  it("is not focusable and has no role of its own", async () => {
    const user = userEvent.setup();
    render(<Label>Connected</Label>);
    await user.tab();
    expect(screen.getByText("Connected")).not.toHaveFocus();
    expect(screen.getByText("Connected")).not.toHaveAttribute("role");
  });

  it("names a control when rendered as a label element", async () => {
    const user = userEvent.setup();
    render(
      <>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: associated through htmlFor */}
        <Label render={<label htmlFor="name" />}>Computer Name:</Label>
        <input id="name" />
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Computer Name:" });
    const label = screen.getByText("Computer Name:");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveClass("mac-label");
    await user.click(label);
    expect(input).toHaveFocus();
  });

  it("is a real link, reachable with Tab and activated with Enter, when rendered as an anchor", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <Label color="link" textStyle="small" render={<a href="#details" />} onClick={onClick}>
        Details…
      </Label>,
    );
    const link = screen.getByRole("link", { name: "Details…" });
    expect(link).toHaveAttribute("href", "#details");
    expect(link).toHaveAttribute("data-color", "link");
    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("accepts a render function", () => {
    render(<Label render={(props) => <p {...props} />}>Paragraph</Label>);
    const paragraph = screen.getByText("Paragraph");
    expect(paragraph.tagName).toBe("P");
    expect(paragraph).toHaveClass("mac-label");
  });

  it("merges className and forwards ref, style and native attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <Label ref={ref} className="extra" id="status" style={{ width: 80 }} aria-live="polite">
        Idle
      </Label>,
    );
    expect(ref.current).toBe(screen.getByText("Idle"));
    expect(ref.current).toHaveClass("mac-label", "extra");
    expect(ref.current).toHaveAttribute("id", "status");
    expect(ref.current).toHaveAttribute("aria-live", "polite");
    expect(ref.current).toHaveStyle({ width: "80px" });
  });

  it("keeps the class of the rendered element", () => {
    render(<Label render={<p className="paragraph" />}>Copy</Label>);
    expect(screen.getByText("Copy")).toHaveClass("mac-label", "paragraph");
  });
});
