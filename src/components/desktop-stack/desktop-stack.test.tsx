import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Desktop } from "../desktop";
import { DesktopIcon } from "../desktop-icon";
import { DesktopStack, type DesktopStackProps } from "./index";

function Images(props: Partial<DesktopStackProps>) {
  return (
    <DesktopStack
      label="Images"
      thumbnail={<img src="data:," alt="" data-testid="front" />}
      {...props}
    >
      <DesktopIcon icon={null}>Coast.jpg</DesktopIcon>
      <DesktopIcon icon={null}>Dunes.jpg</DesktopIcon>
    </DesktopStack>
  );
}

const stack = () => screen.getByRole("button", { name: "Images" });

describe("DesktopStack", () => {
  it("is a collapsed button named by its label, showing the thumbnail and not its files", () => {
    render(<Images />);
    expect(stack()).toHaveClass("mac-desktop-icon", "mac-desktop-stack");
    expect(stack()).toHaveAttribute("aria-expanded", "false");
    expect(stack()).not.toHaveAttribute("aria-pressed");
    expect(stack()).not.toHaveAttribute("data-open");
    expect(screen.getByTestId("front")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Coast.jpg" })).toBeNull();
  });

  it("expands on a click: its files follow it and the placeholder replaces the pile", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Images onOpenChange={onOpenChange} />);
    await user.click(stack());
    expect(stack()).toHaveAttribute("aria-expanded", "true");
    expect(stack()).toHaveAttribute("data-open");
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByTestId("front")).toBeNull();
    const names = screen.getAllByRole("button").map((button) => button.textContent);
    expect(names).toEqual(["Images", "Coast.jpg", "Dunes.jpg"]);
    await user.click(stack());
    expect(stack()).toHaveAttribute("aria-expanded", "false");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("button", { name: "Dunes.jpg" })).toBeNull();
  });

  it("expands and collapses with Return and Space", async () => {
    const user = userEvent.setup();
    render(<Images />);
    await user.tab();
    expect(stack()).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(stack()).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(stack()).toHaveAttribute("aria-expanded", "false");
  });

  it("starts expanded with defaultOpen", () => {
    render(<Images defaultOpen />);
    expect(stack()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Coast.jpg" })).toBeInTheDocument();
  });

  it("leaves a controlled state to its owner", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Images open={false} onOpenChange={onOpenChange} />);
    await user.click(stack());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(stack()).toHaveAttribute("aria-expanded", "false");
  });

  it("does not expand when the application's click handler prevented it", async () => {
    const user = userEvent.setup();
    render(<Images onClick={(event) => event.preventDefault()} />);
    await user.click(stack());
    expect(stack()).toHaveAttribute("aria-expanded", "false");
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    render(<Images disabled />);
    await user.click(stack());
    expect(stack()).toBeDisabled();
    expect(stack()).toHaveAttribute("aria-expanded", "false");
  });

  it("takes its place in a desktop's grid: the arrow keys reach its files", async () => {
    const user = userEvent.setup();
    render(
      <Desktop>
        <DesktopIcon icon={null}>Macintosh SSD</DesktopIcon>
        <Images defaultOpen />
        <DesktopIcon icon={null}>Plan.pdf</DesktopIcon>
      </Desktop>,
    );
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(stack()).toHaveFocus();
    expect(stack()).toHaveAttribute("data-selected");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("button", { name: "Dunes.jpg" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Plan.pdf" })).toHaveFocus();
  });

  it("forwards ref, className, style and other attributes to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Images ref={ref} className="pile" style={{ margin: 4 }} id="images" />);
    expect(ref.current).toBe(stack());
    expect(stack()).toHaveClass("mac-desktop-stack", "pile");
    expect(stack()).toHaveStyle({ margin: "4px" });
    expect(stack()).toHaveAttribute("id", "images");
  });
});
