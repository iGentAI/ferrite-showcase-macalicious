import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  PopUpButton,
  PopUpButtonBezel,
  PopUpButtonItem,
  type PopUpButtonProps,
  PopUpButtonSeparator,
} from "./index";

function IconSize(props: PopUpButtonProps) {
  return (
    <PopUpButton aria-label="Sidebar icon size" defaultValue="medium" {...props}>
      <PopUpButtonItem value="small">Small</PopUpButtonItem>
      <PopUpButtonItem value="medium">Medium</PopUpButtonItem>
      <PopUpButtonSeparator />
      <PopUpButtonItem value="large">Large</PopUpButtonItem>
      <PopUpButtonItem value="huge" disabled>
        Huge
      </PopUpButtonItem>
    </PopUpButton>
  );
}

const button = () => screen.getByRole("combobox", { name: "Sidebar icon size" });
const highlighted = () => document.querySelector("[data-highlighted]");
const closed = () => waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

describe("PopUpButton", () => {
  it("is a button that shows the selected item's title, before its menu was ever opened", () => {
    render(<IconSize />);
    expect(button().tagName).toBe("BUTTON");
    expect(button()).toHaveAttribute("type", "button");
    expect(button()).toHaveClass("mac-pop-up-button");
    expect(button()).toHaveTextContent("Medium");
    expect(button()).toHaveAttribute("aria-haspopup", "listbox");
    expect(button()).toHaveAttribute("data-size", "regular");
    expect(button()).toHaveAttribute("data-arrows", "double");
    expect(button()).not.toHaveAttribute("data-bordered");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("draws the single down chevron when asked", () => {
    render(<IconSize arrows="down" />);
    expect(button()).toHaveAttribute("data-arrows", "down");
    expect(button()).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("shows the placeholder while nothing is selected", () => {
    render(<IconSize defaultValue={null} placeholder="Choose…" />);
    expect(button()).toHaveTextContent("Choose…");
  });

  it("reflects size and bordered as data attributes", () => {
    render(<IconSize size="small" bordered={false} />);
    expect(button()).toHaveAttribute("data-size", "small");
    expect(button()).toHaveAttribute("data-bordered", "false");
  });

  it("opens the library's menu on a click, in the font of its size, with the selected item marked", async () => {
    const user = userEvent.setup();
    render(<IconSize size="small" />);
    await user.click(button());
    const menu = await screen.findByRole("listbox");
    expect(menu).toHaveClass("mac-menu", "mac-pop-up-button-menu");
    expect(menu).toHaveAttribute("data-size", "small");
    expect(menu.parentElement).toHaveClass("mac-menu-positioner");
    expect(button()).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(4);
    for (const option of options) expect(option).toHaveClass("mac-menu-item");
    expect(screen.getByRole("option", { name: "Medium" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Medium" })).toHaveAttribute("data-selected");
    expect(screen.getByRole("option", { name: "Small" })).not.toHaveAttribute("data-selected");
    expect(menu.querySelector(".mac-menu-item-separator")).toBeInTheDocument();
  });

  it("chooses an item with the pointer: the title changes and the menu closes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<IconSize onValueChange={onValueChange} />);
    await user.click(button());
    await user.click(await screen.findByRole("option", { name: "Large" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("large", expect.anything());
    await closed();
    expect(button()).toHaveTextContent("Large");
  });

  it("opens with the keyboard, moves with the arrow keys and chooses with Return", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<IconSize onValueChange={onValueChange} />);
    await user.tab();
    expect(button()).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("listbox");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Medium"));
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Large"));
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Small"));
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("small", expect.anything());
    await closed();
    expect(button()).toHaveTextContent("Small");
  });

  it("opens with Space", async () => {
    const user = userEvent.setup();
    render(<IconSize />);
    button().focus();
    await user.keyboard(" ");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("selects by typing the start of a title", async () => {
    const user = userEvent.setup();
    render(<IconSize />);
    await user.click(button());
    await screen.findByRole("listbox");
    await user.keyboard("l");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Large"));
  });

  it("keeps a disabled item out of reach of a choice from the keyboard", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<IconSize defaultValue="large" onValueChange={onValueChange} />);
    button().focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("listbox");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Large"));
    // Base UI lets the arrow keys stop on a disabled option; Return there chooses nothing.
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(highlighted()).toHaveTextContent("Huge"));
    expect(highlighted()).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(button()).toHaveTextContent("Large");
  });

  it("returns the focus to the button when the menu closes", async () => {
    const user = userEvent.setup();
    render(<IconSize />);
    await user.click(button());
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    await closed();
    await waitFor(() => expect(button()).toHaveFocus());
  });

  it("opens but keeps its value when read-only", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<IconSize readOnly onValueChange={onValueChange} />);
    await user.click(button());
    await user.click(await screen.findByRole("option", { name: "Large" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(button()).toHaveTextContent("Medium");
  });

  it("closes on Escape without changing the value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<IconSize onValueChange={onValueChange} />);
    await user.click(button());
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    await closed();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(button()).toHaveTextContent("Medium");
  });

  it("does not choose a disabled item", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<IconSize onValueChange={onValueChange} />);
    await user.click(button());
    const huge = await screen.findByRole("option", { name: "Huge" });
    expect(huge).toHaveAttribute("aria-disabled", "true");
    await user.click(huge);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<IconSize disabled onOpenChange={onOpenChange} />);
    expect(button()).toBeDisabled();
    expect(button()).toHaveAttribute("data-disabled");
    await user.click(button());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows only the value it is given when controlled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <IconSize defaultValue={undefined} value="small" onValueChange={onValueChange} />,
    );
    await user.click(button());
    await user.click(await screen.findByRole("option", { name: "Large" }));
    expect(onValueChange).toHaveBeenCalledWith("large", expect.anything());
    await closed();
    expect(button()).toHaveTextContent("Small");
    rerender(<IconSize defaultValue={undefined} value="large" onValueChange={onValueChange} />);
    expect(button()).toHaveTextContent("Large");
  });

  it("can be opened and closed by its owner", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [open, setOpen] = useState(true);
      return <IconSize open={open} onOpenChange={setOpen} />;
    }
    render(<Owner />);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await closed();
  });

  it("shows the selected item's image in the button", () => {
    render(
      <PopUpButton aria-label="Browser" defaultValue="safari">
        <PopUpButtonItem value="safari" image={<svg data-testid="icon" aria-hidden="true" />}>
          Safari
        </PopUpButtonItem>
      </PopUpButton>,
    );
    const browser = screen.getByRole("combobox", { name: "Browser" });
    expect(browser).toContainElement(screen.getByTestId("icon"));
    expect(browser).toHaveTextContent("Safari");
  });

  it("lays the menu's title over the button's title, not over its image", () => {
    render(
      <PopUpButton aria-label="Browser" defaultValue="safari">
        <PopUpButtonItem value="safari" image={<svg data-testid="icon" aria-hidden="true" />}>
          Safari
        </PopUpButtonItem>
      </PopUpButton>,
    );
    // Base UI aligns an item's text with the last Select.Value: it must hold the title alone.
    const image = screen.getByTestId("icon").closest(".mac-pop-up-button-image");
    const title = screen.getByText("Safari");
    expect(title).not.toContainElement(screen.getByTestId("icon"));
    expect(image?.parentElement?.nextElementSibling).toBe(title);
  });

  it("keeps a `render` of the caller's as the button", () => {
    render(
      <IconSize
        render={<button type="button" data-testid="own" className="own-bezel" />}
        className="extra"
      />,
    );
    expect(button()).toBe(screen.getByTestId("own"));
    expect(button()).toHaveClass("own-bezel", "extra");
    expect(button()).toHaveTextContent("Medium");
  });

  it("submits its value with a form under its name", () => {
    const { container } = render(
      <form>
        <IconSize name="size" />
      </form>,
    );
    expect(new FormData(container.querySelector("form") as HTMLFormElement).get("size")).toBe(
      "medium",
    );
  });

  it("passes ref, className, style and other props to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconSize ref={ref} id="size" className="extra" style={{ width: 150 }} data-x="1" />);
    expect(ref.current).toBe(button());
    expect(button()).toHaveClass("mac-pop-up-button", "extra");
    expect(button()).toHaveAttribute("id", "size");
    expect(button()).toHaveAttribute("data-x", "1");
    expect(button()).toHaveStyle({ width: "150px" });
  });
});

describe("PopUpButtonBezel", () => {
  it("is a plain button with the pop-up button's look that opens nothing", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PopUpButtonBezel arrows="down" size="mini" className="extra" onClick={onClick}>
        Format
      </PopUpButtonBezel>,
    );
    const bezel = screen.getByRole("button", { name: "Format" });
    expect(bezel).toHaveClass("mac-pop-up-button", "extra");
    expect(bezel).toHaveAttribute("data-arrows", "down");
    expect(bezel).toHaveAttribute("data-size", "mini");
    expect(bezel).not.toHaveAttribute("aria-haspopup");
    await user.click(bezel);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled with the real attribute", () => {
    render(<PopUpButtonBezel disabled>Format</PopUpButtonBezel>);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("data-disabled");
  });
});
