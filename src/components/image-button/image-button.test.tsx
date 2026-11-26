import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ImageButton } from "./index";

describe("ImageButton", () => {
  it("renders a native button around its image", () => {
    render(
      <ImageButton aria-label="General">
        <svg data-testid="image" aria-hidden="true" />
      </ImageButton>,
    );
    const button = screen.getByRole("button", { name: "General" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("mac-image-button");
    expect(button).toContainElement(screen.getByTestId("image"));
  });

  it("reflects the layout, icon by default", () => {
    render(
      <>
        <ImageButton aria-label="General">
          <svg aria-hidden="true" />
        </ImageButton>
        <ImageButton layout="row">Add Other Account…</ImageButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "General" })).toHaveAttribute("data-layout", "icon");
    expect(screen.getByRole("button", { name: "Add Other Account…" })).toHaveAttribute(
      "data-layout",
      "row",
    );
  });

  it("is named by its label, shown under the image", () => {
    render(
      <ImageButton label="Desktop & Screen Saver">
        <svg aria-hidden="true" />
      </ImageButton>,
    );
    const button = screen.getByRole("button", { name: "Desktop & Screen Saver" });
    expect(button).toHaveTextContent("Desktop & Screen Saver");
  });

  it("shows only its label when it has no image, so the focus ring has the label to surround", () => {
    render(<ImageButton label="Add Other Account…" />);
    const button = screen.getByRole("button", { name: "Add Other Account…" });
    expect(button.children).toHaveLength(1);
    expect(button.firstElementChild).toHaveClass("mac-image-button-label");
  });

  it("leaves the image box empty, for the stylesheet to drop, when its children render nothing", () => {
    render(<ImageButton label="Other">{[null]}</ImageButton>);
    const button = screen.getByRole("button", { name: "Other" });
    expect(button.querySelector(".mac-image-button-image")).toBeEmptyDOMElement();
    render(<ImageButton label="Flag">{false}</ImageButton>);
    expect(screen.getByRole("button", { name: "Flag" }).children).toHaveLength(1);
  });

  it("draws no image box for a child that is true, as for one that is false", () => {
    render(<ImageButton label="Shown">{true}</ImageButton>);
    const button = screen.getByRole("button", { name: "Shown" });
    expect(button.querySelector(".mac-image-button-image")).toBeNull();
    expect(button.firstElementChild).toHaveClass("mac-image-button-label");
  });

  it("is named by the image's alternative text when it has no label", () => {
    render(
      <ImageButton>
        <img alt="iCloud" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" />
      </ImageButton>,
    );
    expect(screen.getByRole("button", { name: "iCloud" })).toBeInTheDocument();
  });

  it("activates with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ImageButton label="General" onClick={onClick}>
        <svg aria-hidden="true" />
      </ImageButton>,
    );
    await user.click(screen.getByRole("button"));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is activated by a click on its label", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ImageButton label="General" onClick={onClick}>
        <svg aria-hidden="true" />
      </ImageButton>,
    );
    await user.click(screen.getByText("General"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores activation and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ImageButton label="General" disabled onClick={onClick}>
        <svg aria-hidden="true" />
      </ImageButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-disabled");
    await user.click(button);
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("reports a toggle's state with aria-pressed", () => {
    render(
      <ImageButton label="Mute" aria-pressed>
        <svg aria-hidden="true" />
      </ImageButton>,
    );
    expect(screen.getByRole("button", { name: "Mute", pressed: true })).toBeInTheDocument();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLElement>();
    render(
      <ImageButton ref={ref} id="general" className="extra" label="General">
        <svg aria-hidden="true" />
      </ImageButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveClass("mac-image-button", "extra");
    expect(ref.current).toHaveAttribute("id", "general");
  });
});
