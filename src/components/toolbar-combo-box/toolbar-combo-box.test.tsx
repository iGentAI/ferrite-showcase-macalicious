import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ComboBoxItem, ComboBoxSeparator } from "../combo-box";
import { Toolbar } from "../toolbar";
import { ToolbarButton } from "../toolbar-button";
import { ToolbarComboBox, type ToolbarComboBoxProps } from "./index";

function FontSize(props: ToolbarComboBoxProps) {
  return (
    <ToolbarComboBox aria-label="Font size" defaultValue="12" {...props}>
      <ComboBoxItem>9</ComboBoxItem>
      <ComboBoxItem>12</ComboBoxItem>
      <ComboBoxSeparator />
      <ComboBoxItem value="288">Poster</ComboBoxItem>
    </ToolbarComboBox>
  );
}

const field = () => screen.getByRole<HTMLInputElement>("combobox", { name: "Font size" });
const button = () => screen.getByRole("button", { name: "Show choices" });
const listIsClosed = () =>
  waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

describe("ToolbarComboBox", () => {
  it("is a text input with the combobox role and a button, in the toolbar bezel", () => {
    const { container } = render(<FontSize />);
    const root = container.firstElementChild;
    expect(root).toHaveClass("mac-toolbar-combo-box");
    expect(root).toHaveAttribute("data-size", "regular");
    expect(root).toContainElement(field());
    expect(root).toContainElement(button());
    expect(field().tagName).toBe("INPUT");
    expect(field()).toHaveValue("12");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(button()).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("reflects the small size on the root and on the list", async () => {
    const user = userEvent.setup();
    const { container } = render(<FontSize size="small" />);
    expect(container.firstElementChild).toHaveAttribute("data-size", "small");
    await user.click(button());
    await screen.findByRole("listbox");
    expect(document.querySelector(".mac-menu")).toHaveAttribute("data-size", "small");
  });

  it("accepts any typed text and does not open the list because of typing", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<FontSize defaultValue="" onValueChange={onValueChange} onOpenChange={onOpenChange} />);
    await user.type(field(), "13");
    expect(field()).toHaveValue("13");
    expect(onValueChange).toHaveBeenLastCalledWith("13", expect.anything());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("opens the combo box's list with the button and fills the field with the chosen item", async () => {
    const user = userEvent.setup();
    const { container } = render(<FontSize />);
    await user.click(button());
    const list = await screen.findByRole("listbox");

    expect(container.firstElementChild).toHaveAttribute("data-popup-open");
    expect(field()).toHaveFocus();
    expect(list.closest(".mac-menu")).toHaveClass("mac-combo-box-menu");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "9",
      "12",
      "Poster",
    ]);

    await user.click(screen.getByRole("option", { name: "Poster" }));
    expect(field()).toHaveValue("288");
    await listIsClosed();
  });

  it("chooses with Down Arrow and Return, and returns to the typed text with Escape", async () => {
    const user = userEvent.setup();
    render(<FontSize defaultValue="" />);
    await user.type(field(), "7");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "9" })).toHaveAttribute("data-highlighted");
    expect(field()).toHaveValue("9");
    await user.keyboard("{Escape}");
    await listIsClosed();
    expect(field()).toHaveValue("7");

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");
    expect(field()).toHaveValue("12");
    await listIsClosed();
  });

  it("does nothing while disabled", async () => {
    const user = userEvent.setup();
    const { container } = render(<FontSize disabled />);
    expect(container.firstElementChild).toHaveAttribute("data-disabled");
    expect(field()).toBeDisabled();
    expect(button()).toBeDisabled();
    await user.click(button());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("gives className, style and ref to the root, inputRef and the rest to the input", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <FontSize
        ref={ref}
        inputRef={inputRef}
        className="size"
        style={{ width: 70 }}
        id="font-size"
        placeholder="Size"
      />,
    );
    expect(ref.current).toHaveClass("mac-toolbar-combo-box", "size");
    expect(ref.current).toHaveStyle({ width: "70px" });
    expect(inputRef.current).toBe(field());
    expect(field()).toHaveAttribute("id", "font-size");
    expect(field()).toHaveAttribute("placeholder", "Size");
  });

  it("joins the arrow-key navigation of a toolbar and still opens its list there", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Format">
        <ToolbarButton>Before</ToolbarButton>
        <FontSize />
        <ToolbarButton>After</ToolbarButton>
      </Toolbar>,
    );
    const before = screen.getByRole("button", { name: "Before" });

    // The toolbar is one tab stop; the arrow keys walk its items, the field included.
    await user.tab();
    expect(before).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(field()).toHaveFocus();

    // Inside the text the arrow keys move the insertion point, not the focus.
    await user.keyboard("{End}{ArrowLeft}3");
    expect(field()).toHaveFocus();
    expect(field()).toHaveValue("132");

    // Down Arrow is the combo box's: it opens the list and the focus stays in the field.
    await user.keyboard("{ArrowDown}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(field()).toHaveFocus();
    await user.keyboard("{Escape}");
    await listIsClosed();

    // At the start of the text Left Arrow leaves the field for the item before it.
    await user.keyboard("{Home}{ArrowLeft}");
    expect(before).toHaveFocus();
  });
});
