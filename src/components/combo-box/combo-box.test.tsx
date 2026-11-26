import { render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ComboBox, ComboBoxItem, type ComboBoxProps, ComboBoxSeparator } from "./index";

function Sizes(props: ComboBoxProps) {
  return (
    <ComboBox aria-label="Size" {...props}>
      <ComboBoxItem>Small</ComboBoxItem>
      <ComboBoxItem>Medium</ComboBoxItem>
      <ComboBoxSeparator />
      <ComboBoxItem value="Extra Large">XL</ComboBoxItem>
    </ComboBox>
  );
}

const field = () => screen.getByRole<HTMLInputElement>("combobox", { name: "Size" });
const button = () => screen.getByRole("button", { name: "Show choices" });
// Base UI opens and closes the list in the animation frame after the press.
const pressButton = async (user: UserEvent) => {
  await user.click(button());
  return screen.findByRole("listbox");
};
const listIsClosed = () =>
  waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

describe("ComboBox", () => {
  it("renders a text input with the combobox role and a button, closed", () => {
    render(<Sizes />);
    expect(field().tagName).toBe("INPUT");
    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(button().tagName).toBe("BUTTON");
    expect(button()).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("draws the text field's bezel at the regular size by default", () => {
    const { container } = render(<Sizes />);
    const root = container.firstElementChild;
    expect(root).toHaveClass("mac-combo-box", "mac-text-field");
    expect(root).toHaveAttribute("data-size", "regular");
    expect(root).not.toHaveAttribute("data-disabled");
  });

  it("reflects size on the root and on the list", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sizes size="small" />);
    expect(container.firstElementChild).toHaveAttribute("data-size", "small");
    await pressButton(user);
    expect(document.querySelector(".mac-menu")).toHaveAttribute("data-size", "small");
  });

  it("accepts any typed text", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Sizes onValueChange={onValueChange} />);
    await user.type(field(), "Huge");
    expect(field()).toHaveValue("Huge");
    expect(onValueChange).toHaveBeenLastCalledWith("Huge", expect.anything());
  });

  it("does not open the list because of typing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Sizes onOpenChange={onOpenChange} />);
    await user.type(field(), "Me");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("opens the list with the button, as a menu surface with one row per item", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sizes />);
    const list = await pressButton(user);

    expect(container.firstElementChild).toHaveAttribute("data-popup-open");
    expect(field()).toHaveAttribute("aria-expanded", "true");
    expect(field()).toHaveFocus();
    expect(list.closest(".mac-menu")).not.toBeNull();
    expect(list.closest(".mac-menu-positioner")).not.toBeNull();
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Small", "Medium", "XL"]);
    expect(options[0]).toHaveClass("mac-menu-item");
    expect(list.querySelector(".mac-menu-item-separator")).not.toBeNull();
  });

  it("closes the list with the button", async () => {
    const user = userEvent.setup();
    render(<Sizes />);
    // Found before the list opens: while it is open Base UI hides everything but the field
    // and the list from assistive technology, the button included.
    const toggle = button();
    await pressButton(user);
    await user.click(toggle);
    await listIsClosed();
  });

  it("opens the list with Down Arrow in the field", async () => {
    const user = userEvent.setup();
    render(<Sizes />);
    await user.click(field());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("fills the field with the item chosen with the pointer, and closes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Sizes defaultValue="Tiny" onValueChange={onValueChange} />);
    await pressButton(user);
    await user.click(screen.getByRole("option", { name: "Medium" }));

    expect(field()).toHaveValue("Medium");
    expect(onValueChange).toHaveBeenLastCalledWith("Medium", expect.anything());
    await listIsClosed();
  });

  it("fills the field with an item's value when it differs from its title", async () => {
    const user = userEvent.setup();
    render(<Sizes />);
    await pressButton(user);
    await user.click(screen.getByRole("option", { name: "XL" }));
    expect(field()).toHaveValue("Extra Large");
  });

  it("fills the field with an item whose title is a number", async () => {
    const user = userEvent.setup();
    render(
      <ComboBox aria-label="Size">
        <ComboBoxItem>{12}</ComboBoxItem>
      </ComboBox>,
    );
    await pressButton(user);
    await user.click(screen.getByRole("option", { name: "12" }));
    expect(field()).toHaveValue("12");
  });

  it("chooses with the arrow keys and Return", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Sizes onValueChange={onValueChange} />);
    await user.click(field());
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "Medium" })).toHaveAttribute("data-highlighted");
    // AppKit's combo box: the highlighted item is already in the field.
    expect(field()).toHaveValue("Medium");

    await user.keyboard("{Enter}");
    expect(field()).toHaveValue("Medium");
    expect(onValueChange).toHaveBeenLastCalledWith("Medium", expect.anything());
    await listIsClosed();
  });

  it('keeps the typed text while moving through the list with mode="none"', async () => {
    const user = userEvent.setup();
    render(<Sizes mode="none" />);
    await user.type(field(), "Hu");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "Small" })).toHaveAttribute("data-highlighted");
    expect(field()).toHaveValue("Hu");
  });

  it("closes the list with Escape and returns to the typed text", async () => {
    const user = userEvent.setup();
    render(<Sizes />);
    await user.type(field(), "Hu");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(field()).toHaveValue("Small");

    await user.keyboard("{Escape}");
    await listIsClosed();
    expect(field()).toHaveValue("Hu");
  });

  it('opens while typing and shows only the matching items with items and mode="list"', async () => {
    const user = userEvent.setup();
    render(
      <ComboBox aria-label="Size" mode="list" items={["Small", "Medium", "Large"]}>
        {(item) => <ComboBoxItem key={item}>{item}</ComboBoxItem>}
      </ComboBox>,
    );
    await user.type(field(), "m");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Small",
      "Medium",
    ]);
  });

  it("matches and fills with itemToStringValue when the items are objects", async () => {
    const user = userEvent.setup();
    const servers = [
      { host: "time.apple.com", region: "Americas" },
      { host: "time.euro.apple.com", region: "Europe" },
    ];
    render(
      <ComboBox
        aria-label="Size"
        mode="list"
        items={servers}
        itemToStringValue={(server) => server.host}
      >
        {(server) => (
          <ComboBoxItem key={server.host} value={server}>
            {server.region}
          </ComboBoxItem>
        )}
      </ComboBox>,
    );
    await user.type(field(), "euro");
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Europe"]);
    await user.click(options[0] as HTMLElement);
    expect(field()).toHaveValue("time.euro.apple.com");
  });

  it("does nothing while disabled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { container } = render(<Sizes disabled onOpenChange={onOpenChange} />);
    expect(field()).toBeDisabled();
    expect(button()).toBeDisabled();
    expect(container.firstElementChild).toHaveAttribute("data-disabled");

    await user.click(button());
    await user.type(field(), "x");
    expect(field()).toHaveValue("");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not change read-only text, from the keyboard or from the list", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sizes readOnly defaultValue="Small" />);
    expect(field()).toHaveAttribute("readonly");
    expect(container.firstElementChild).toHaveAttribute("data-readonly");
    await user.type(field(), "x");
    expect(field()).toHaveValue("Small");
    await pressButton(user);
    await user.click(screen.getByRole("option", { name: "Medium" }));
    expect(field()).toHaveValue("Small");
  });

  it("shows a controlled value and reports changes without applying them", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Sizes value="Small" onValueChange={onValueChange} />);
    await user.type(field(), "!");
    expect(onValueChange).toHaveBeenLastCalledWith("Small!", expect.anything());
    expect(field()).toHaveValue("Small");
  });

  it("follows a controlled value", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState("Small");
      return <Sizes value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);
    await pressButton(user);
    await user.click(screen.getByRole("option", { name: "Medium" }));
    expect(field()).toHaveValue("Medium");
  });

  it("shows a controlled list and reports that it should close", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Sizes open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(field());
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("starts from defaultValue and defaultOpen", () => {
    render(<Sizes defaultValue="Medium" defaultOpen />);
    expect(field()).toHaveValue("Medium");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("submits its text under name", () => {
    render(
      <form data-testid="form">
        <Sizes name="size" defaultValue="Huge" />
      </form>,
    );
    const data = new FormData(screen.getByTestId<HTMLFormElement>("form"));
    expect(data.get("size")).toBe("Huge");
  });

  it("gives ref the root element and inputRef the input", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    const { container } = render(<Sizes ref={ref} inputRef={inputRef} />);
    expect(ref.current).toBe(container.firstElementChild);
    expect(inputRef.current).toBe(field());
  });

  it("merges className and style on the root", () => {
    const { container } = render(<Sizes className="extra" style={{ width: 240 }} />);
    const root = container.firstElementChild;
    expect(root).toHaveClass("mac-combo-box", "mac-text-field", "extra");
    expect(root).toHaveStyle({ width: "240px" });
  });

  it("passes other props to the input", () => {
    render(<Sizes id="size" placeholder="Any size" data-testid="input" spellCheck={false} />);
    expect(field()).toBe(screen.getByTestId("input"));
    expect(field()).toHaveAttribute("id", "size");
    expect(field()).toHaveAttribute("placeholder", "Any size");
    expect(field()).toHaveAttribute("spellcheck", "false");
  });

  it("names the button with buttonLabel", () => {
    render(<Sizes buttonLabel="Sizes" />);
    expect(screen.getByRole("button", { name: "Sizes" })).toBeInTheDocument();
  });

  it("keeps the button out of the tab order", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Sizes />
        <button type="button">Next</button>
      </>,
    );
    await user.tab();
    expect(field()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });
});

describe("ComboBoxItem", () => {
  it("keeps its menu item class when className is a string or a state function", () => {
    render(
      <ComboBox aria-label="Size" defaultOpen>
        <ComboBoxItem className="extra">Small</ComboBoxItem>
        <ComboBoxItem disabled className={(state) => (state.disabled ? "is-off" : "is-on")}>
          Medium
        </ComboBoxItem>
      </ComboBox>,
    );
    expect(screen.getByRole("option", { name: "Small" })).toHaveClass("mac-menu-item", "extra");
    expect(screen.getByRole("option", { name: "Medium" })).toHaveClass("mac-menu-item", "is-off");
  });

  it("cannot be chosen while disabled", async () => {
    const user = userEvent.setup();
    render(
      <ComboBox aria-label="Size" defaultOpen>
        <ComboBoxItem disabled>Small</ComboBoxItem>
      </ComboBox>,
    );
    const item = screen.getByRole("option", { name: "Small" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    await user.click(item);
    expect(field()).toHaveValue("");
  });

  it("forwards ref and props", () => {
    const ref = createRef<HTMLDivElement>();
    const separator = createRef<HTMLDivElement>();
    render(
      <ComboBox aria-label="Size" defaultOpen>
        <ComboBoxItem ref={ref} data-testid="item">
          Small
        </ComboBoxItem>
        <ComboBoxSeparator ref={separator} className="extra" data-testid="separator" />
      </ComboBox>,
    );
    expect(ref.current).toBe(screen.getByTestId("item"));
    expect(separator.current).toBe(screen.getByTestId("separator"));
    expect(separator.current).toHaveClass("mac-menu-item-separator", "extra");
  });
});
