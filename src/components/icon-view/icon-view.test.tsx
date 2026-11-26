import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IconView, type IconViewProps } from "./index";

const names = [
  "Apple",
  "Banana",
  "Blueberry",
  "Cherry",
  "Date",
  "Elderberry",
  "Fig",
  "Grape",
  "Kiwi",
  "Lemon",
];
const labelOf = (index: number) => names[index] ?? "";
const renderIcon = (_index: number) => <svg aria-hidden="true" />;

/**
 * jsdom has no layout. Stand-in: every element is 460 pt wide, which fits four 103 pt cells
 * with 8 pt gaps, so the ten items are laid out as
 *
 *   Apple   Banana      Blueberry  Cherry
 *   Date    Elderberry  Fig        Grape
 *   Kiwi    Lemon
 *
 * The view is never measured for height, so it renders its first 40 rows. Real layout,
 * scrolling, the pointer targets and 5,000 items are exercised in Chromium by
 * visual/output/b7/browser/icon-view.mjs.
 */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(460);
});

function Fruit(props: Partial<IconViewProps>) {
  return (
    <IconView
      aria-label="Fruit"
      count={names.length}
      renderIcon={renderIcon}
      getItemLabel={labelOf}
      {...props}
    />
  );
}

const view = () => screen.getByRole("listbox", { name: "Fruit" });
const item = (name: string) => screen.getByRole("option", { name });
const icon = (name: string) => item(name).querySelector(".mac-icon-view-icon") as HTMLElement;
const grid = () => item("Apple").parentElement as HTMLElement;
const selection = () =>
  screen.queryAllByRole("option", { selected: true }).map((element) => element.textContent);

describe("IconView", () => {
  it("renders a multi-selectable listbox of named options that know their position", () => {
    render(<Fruit data-testid="root" />);
    const root = screen.getByTestId("root");
    expect(root).toHaveClass("mac-icon-view", "mac-scroll-view");
    expect(root).toContainElement(view());
    expect(view()).toHaveAttribute("tabindex", "0");
    expect(view()).toHaveAttribute("aria-multiselectable", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(10);
    expect(options[2]).toHaveAccessibleName("Blueberry");
    expect(options[2]).toHaveAttribute("aria-posinset", "3");
    expect(options[2]).toHaveAttribute("aria-setsize", "10");
    expect(options[2]).toHaveAttribute("aria-selected", "false");
    // The artwork is decoration: the label names the item.
    expect(icon("Blueberry")).toHaveAttribute("aria-hidden", "true");
  });

  it("sizes the cells from the icon size and fits the columns to the width", () => {
    const { rerender } = render(<Fruit />);
    expect(grid().style.getPropertyValue("--_icon")).toBe("64px");
    expect(grid().style.getPropertyValue("--_cell")).toBe("103px");
    expect(grid().style.getPropertyValue("--_row")).toBe("116px");
    expect(grid().style.getPropertyValue("--_columns")).toBe("4");
    // 460 pt less four 103 pt cells leave 48 pt for five gaps.
    expect(grid().style.getPropertyValue("--_gap")).toBe("9px");
    // Ten items in four columns are three rows.
    expect(grid().style.height).toBe("348px");
    rerender(<Fruit iconSize={160} />);
    expect(grid().style.getPropertyValue("--_icon")).toBe("160px");
    expect(grid().style.getPropertyValue("--_cell")).toBe("177px");
    expect(grid().style.getPropertyValue("--_row")).toBe("212px");
    // 460 pt fit two 177 pt cells.
    expect(grid().style.getPropertyValue("--_columns")).toBe("2");
    expect(grid().style.height).toBe("1060px");
    rerender(<Fruit iconSize={32} cellWidth={80} rowHeight={90} />);
    expect(grid().style.getPropertyValue("--_cell")).toBe("80px");
    expect(grid().style.getPropertyValue("--_row")).toBe("90px");
    expect(grid().style.getPropertyValue("--_columns")).toBe("5");
  });

  it("renders a tag before the name of the items that have one", () => {
    render(<Fruit renderTag={(index) => (index === 1 ? <i data-testid="dot" /> : null)} />);
    const tag = screen.getByTestId("dot").parentElement as HTMLElement;
    expect(tag).toHaveClass("mac-icon-view-tag");
    expect(item("Banana")).toContainElement(tag);
    expect(tag.nextElementSibling).toHaveTextContent("Banana");
    expect(document.querySelectorAll(".mac-icon-view-tag")).toHaveLength(1);
  });

  it("renders only a window of a long list of items", () => {
    const render5000 = vi.fn(renderIcon);
    render(
      <IconView
        aria-label="Many"
        count={5000}
        renderIcon={render5000}
        getItemLabel={(index) => `Item ${index}`}
      />,
    );
    // Forty unmeasured rows of four.
    expect(screen.getAllByRole("option")).toHaveLength(160);
    expect(render5000).toHaveBeenCalledTimes(160);
    expect(screen.getByRole("option", { name: "Item 0" })).toHaveAttribute("aria-setsize", "5000");
  });

  it("selects the clicked item and reports its id", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Fruit defaultValue={[0]} onValueChange={onValueChange} />);
    expect(selection()).toEqual(["Apple"]);
    await user.click(icon("Cherry"));
    expect(selection()).toEqual(["Cherry"]);
    expect(onValueChange).toHaveBeenLastCalledWith([3]);
    expect(view()).toHaveFocus();
    expect(view()).toHaveAttribute("aria-activedescendant", item("Cherry").id);
  });

  it("selects by the ids getItemId gives", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Fruit
        getItemId={(index) => `id-${names[index]}`}
        defaultValue={["id-Date"]}
        onValueChange={onValueChange}
      />,
    );
    expect(selection()).toEqual(["Date"]);
    await user.click(icon("Banana"));
    expect(onValueChange).toHaveBeenLastCalledWith(["id-Banana"]);
  });

  it("toggles with Command-click and extends with Shift-click", () => {
    const onValueChange = vi.fn();
    render(<Fruit defaultValue={[1]} onValueChange={onValueChange} />);
    fireEvent.mouseDown(icon("Date"), { metaKey: true });
    expect(selection()).toEqual(["Banana", "Date"]);
    expect(onValueChange).toHaveBeenLastCalledWith([1, 4]);
    fireEvent.mouseDown(icon("Banana"), { metaKey: true });
    expect(selection()).toEqual(["Date"]);
    fireEvent.mouseDown(icon("Apple"));
    fireEvent.mouseDown(icon("Cherry"), { shiftKey: true });
    expect(selection()).toEqual(["Apple", "Banana", "Blueberry", "Cherry"]);
  });

  it("deselects on a click on the background, unless Command or Shift is held", () => {
    const onValueChange = vi.fn();
    render(<Fruit defaultValue={[1, 2]} onValueChange={onValueChange} />);
    fireEvent.mouseDown(grid(), { metaKey: true });
    fireEvent.mouseDown(grid(), { shiftKey: true });
    fireEvent.mouseDown(grid(), { button: 2 });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.mouseDown(grid());
    expect(selection()).toEqual([]);
    expect(onValueChange).toHaveBeenLastCalledWith([]);
    // Nothing is selected: another click reports nothing.
    fireEvent.mouseDown(grid());
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("selects one item at a time with selectionMode single", () => {
    render(<Fruit selectionMode="single" defaultValue={[0]} />);
    expect(view()).not.toHaveAttribute("aria-multiselectable");
    fireEvent.mouseDown(icon("Cherry"), { metaKey: true });
    expect(selection()).toEqual(["Cherry"]);
    fireEvent.mouseDown(icon("Date"), { shiftKey: true });
    expect(selection()).toEqual(["Date"]);
  });

  it("selects nothing with selectionMode none", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onItemAction = vi.fn();
    render(
      <Fruit selectionMode="none" onValueChange={onValueChange} onItemAction={onItemAction} />,
    );
    await user.dblClick(icon("Cherry"));
    await user.keyboard("{ArrowRight}b");
    expect(selection()).toEqual([]);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onItemAction).toHaveBeenCalledWith(3);
  });

  it("shows no item as selected with selectionMode none, whatever the value names", () => {
    const { rerender } = render(<Fruit selectionMode="none" defaultValue={[1]} />);
    expect(selection()).toEqual([]);
    rerender(<Fruit selectionMode="single" defaultValue={[1]} />);
    expect(selection()).toEqual(["Banana"]);
  });

  it("leaves a controlled selection to its owner", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Fruit value={[1]} onValueChange={onValueChange} />);
    await user.click(icon("Date"));
    expect(onValueChange).toHaveBeenLastCalledWith([4]);
    expect(selection()).toEqual(["Banana"]);
    rerender(<Fruit value={[4]} onValueChange={onValueChange} />);
    expect(selection()).toEqual(["Date"]);
  });

  it("moves the selection in two dimensions with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Fruit defaultValue={[1]} />);
    await user.tab();
    expect(view()).toHaveFocus();
    expect(view()).toHaveAttribute("aria-activedescendant", item("Banana").id);
    await user.keyboard("{ArrowRight}");
    expect(selection()).toEqual(["Blueberry"]);
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Fig"]);
    expect(view()).toHaveAttribute("aria-activedescendant", item("Fig").id);
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    // Left Arrow at the start of a row goes on to the end of the row above.
    expect(selection()).toEqual(["Cherry"]);
    await user.keyboard("{ArrowUp}");
    // No row above: the selection stays.
    expect(selection()).toEqual(["Cherry"]);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    // Nothing below Grape in the short last row: the last item.
    expect(selection()).toEqual(["Lemon"]);
    await user.keyboard("{ArrowDown}{ArrowRight}");
    expect(selection()).toEqual(["Lemon"]);
    await user.keyboard("{ArrowUp}");
    expect(selection()).toEqual(["Elderberry"]);
  });

  it("goes to the first and last item with Home and End", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Fruit defaultValue={[5]} onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard("{End}");
    expect(selection()).toEqual(["Lemon"]);
    await user.keyboard("{Home}");
    expect(selection()).toEqual(["Apple"]);
    expect(onValueChange).toHaveBeenLastCalledWith([0]);
  });

  it("starts at the first item going forward and at the last going back when nothing is selected", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Fruit />);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Apple"]);
    unmount();
    render(<Fruit />);
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(selection()).toEqual(["Lemon"]);
  });

  it("extends the selection with Shift and the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Fruit defaultValue={[1]} />);
    await user.tab();
    await user.keyboard("{Shift>}{ArrowRight}{ArrowDown}{/Shift}");
    expect(selection()).toEqual(["Banana", "Blueberry", "Cherry", "Date", "Elderberry", "Fig"]);
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(selection()).toEqual(["Banana", "Blueberry"]);
    await user.keyboard("{ArrowLeft}");
    expect(selection()).toEqual(["Banana"]);
  });

  it("moves the current item with Control and toggles it with Control-Space", async () => {
    const user = userEvent.setup();
    render(<Fruit defaultValue={[0]} />);
    await user.tab();
    await user.keyboard("{Control>}{ArrowRight}{ArrowDown}{/Control}");
    expect(selection()).toEqual(["Apple"]);
    expect(view()).toHaveAttribute("aria-activedescendant", item("Elderberry").id);
    await user.keyboard("{Control>} {/Control}");
    expect(selection()).toEqual(["Apple", "Elderberry"]);
    await user.keyboard("{Control>} {/Control}");
    expect(selection()).toEqual(["Apple"]);
    // The item taken out of the selection is still the one the keys move from.
    await user.keyboard("{ArrowRight}");
    expect(selection()).toEqual(["Fig"]);
  });

  it("lets the caller's handlers cancel selection, the item action and keys", async () => {
    const user = userEvent.setup();
    const onItemAction = vi.fn();
    const onKeyDown = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <Fruit
        defaultValue={[0]}
        onItemAction={onItemAction}
        onMouseDown={(event) => event.preventDefault()}
        onDoubleClick={(event) => event.preventDefault()}
        onKeyDown={onKeyDown}
      />,
    );
    await user.dblClick(icon("Banana"));
    view().focus();
    await user.keyboard("{ArrowRight}");
    expect(selection()).toEqual(["Apple"]);
    expect(onItemAction).not.toHaveBeenCalled();
    // Called for the key once, not a second time as the event bubbles to the root.
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("selects every item with Command-A, in multiple selection only", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { unmount } = render(<Fruit onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard("{Meta>}a{/Meta}");
    expect(onValueChange).toHaveBeenLastCalledWith([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(selection()).toHaveLength(10);
    // Shift-Command-A is the application's Deselect All, not another Select All.
    unmount();
    render(<Fruit selectionMode="single" defaultValue={[3]} />);
    await user.tab();
    await user.keyboard("{Meta>}a{/Meta}");
    expect(selection()).toEqual(["Cherry"]);
  });

  it("selects by typing the start of a name, and steps on a repeated letter", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Fruit defaultValue={[0]} />);
    await user.tab();
    await user.keyboard("ki");
    expect(selection()).toEqual(["Kiwi"]);
    unmount();
    render(<Fruit defaultValue={[0]} />);
    await user.tab();
    await user.keyboard("b");
    expect(selection()).toEqual(["Banana"]);
    await user.keyboard("b");
    expect(selection()).toEqual(["Blueberry"]);
  });

  it("calls onItemAction on a double click, Return and Command-Down Arrow", async () => {
    const user = userEvent.setup();
    const onItemAction = vi.fn();
    render(<Fruit defaultValue={[4]} onItemAction={onItemAction} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onItemAction).toHaveBeenLastCalledWith(4);
    await user.keyboard("{Meta>}{ArrowDown}{/Meta}");
    expect(onItemAction).toHaveBeenCalledTimes(2);
    // Command-Down opens; it does not move the selection.
    expect(selection()).toEqual(["Date"]);
    await user.dblClick(icon("Banana"));
    expect(onItemAction).toHaveBeenLastCalledWith(1);
    expect(onItemAction).toHaveBeenCalledTimes(3);
  });

  it("follows a selection that was changed from outside", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<(string | number)[]>([0]);
      return (
        <>
          <Fruit value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue([4])}>
            Jump
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(icon("Banana"));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    expect(selection()).toEqual(["Date"]);
    view().focus();
    expect(view()).toHaveAttribute("aria-activedescendant", item("Date").id);
    await user.keyboard("{ArrowRight}");
    expect(selection()).toEqual(["Elderberry"]);
  });

  it("starts a Shift range at a selection that was set from outside", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<(string | number)[]>([]);
      return (
        <>
          <Fruit value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue([4])}>
            Jump
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(icon("Apple"));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    view().focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(selection()).toEqual(["Date", "Elderberry"]);
  });

  it("starts a Shift range at an outside selection after Control has moved the current item", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<(string | number)[]>([]);
      return (
        <>
          <Fruit value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue([1])}>
            Jump
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(icon("Elderberry"));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    view().focus();
    await user.keyboard("{Control>}{ArrowRight}{/Control}");
    expect(selection()).toEqual(["Banana"]);
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    // From Banana, not from the item clicked before the selection was set from outside.
    expect(selection()).toEqual(["Banana", "Blueberry", "Cherry"]);
  });

  it("keeps an item's own state with it when the items are reordered", async () => {
    const user = userEvent.setup();
    const mounts = vi.fn();
    let serial = 0;
    // Artwork with state of its own: a number it takes when it is built. Being built, or
    // being given another item's name, is recorded: neither may happen to an item that only
    // moved.
    function Mark({ name }: { name: string }) {
      const [own] = useState(() => ++serial);
      useEffect(() => mounts(name), [name]);
      return <svg data-testid={`mark-${name}`} data-own={own} />;
    }
    function Owner() {
      const [order, setOrder] = useState(names);
      return (
        <>
          <IconView
            aria-label="Fruit"
            count={order.length}
            renderIcon={(index) => <Mark name={order[index] ?? ""} />}
            getItemLabel={(index) => order[index] ?? ""}
            getItemId={(index) => order[index] ?? index}
          />
          <button type="button" onClick={() => setOrder([...order].reverse())}>
            Reverse
          </button>
        </>
      );
    }
    render(<Owner />);
    const own = (name: string) => screen.getByTestId(`mark-${name}`).getAttribute("data-own");
    const before = names.map(own);
    expect(new Set(before).size).toBe(names.length);
    expect(mounts).toHaveBeenCalledTimes(names.length);
    await user.click(screen.getByRole("button", { name: "Reverse" }));
    // Each number went with its item, and no item was built again or given another's name.
    expect(screen.getAllByRole("option")[0]).toHaveAccessibleName("Lemon");
    expect(names.map(own)).toEqual(before);
    expect(mounts).toHaveBeenCalledTimes(names.length);
  });

  it.each([
    ["ArrowRight", "Apple"],
    ["ArrowLeft", "Lemon"],
    ["ArrowDown", "Apple"],
    ["ArrowUp", "Lemon"],
    ["Home", "Apple"],
    ["End", "Lemon"],
  ])("with nothing selected, %s selects %s", async (key, name) => {
    const user = userEvent.setup();
    render(<Fruit />);
    await user.tab();
    await user.keyboard(`{${key}}`);
    expect(selection()).toEqual([name]);
  });

  it("goes to the first and last item with Home and End in a view of one full row", async () => {
    const user = userEvent.setup();
    // Four items in four columns: a row is as long as the list.
    render(<Fruit count={4} defaultValue={[2]} />);
    await user.tab();
    await user.keyboard("{Home}");
    expect(selection()).toEqual(["Apple"]);
    await user.keyboard("{End}");
    expect(selection()).toEqual(["Cherry"]);
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Cherry"]);
  });

  it("does nothing with keys when it has no items", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Fruit count={0} onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard("{ArrowDown}{Home}{End}a{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("scrolls the row of the item it moves to into view", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(116);
    render(<Fruit defaultValue={[0]} />);
    await user.tab();
    await user.keyboard("{End}");
    // Three 116 pt rows in a view one row tall: the last row starts at 232.
    expect(view().scrollTop).toBe(232);
    await user.keyboard("{ArrowUp}");
    expect(view().scrollTop).toBe(116);
    await user.keyboard("{Home}");
    expect(view().scrollTop).toBe(0);
  });

  it("re-renders only the items whose selection changed", async () => {
    const user = userEvent.setup();
    const render10 = vi.fn(renderIcon);
    render(<Fruit renderIcon={render10} defaultValue={[0]} />);
    expect(render10).toHaveBeenCalledTimes(10);
    render10.mockClear();
    await user.click(icon("Cherry"));
    expect(render10.mock.calls.map(([index]) => index).sort()).toEqual([0, 3]);
  });

  it("names the listbox with aria-labelledby", () => {
    render(
      <>
        <h2 id="heading">Baskets</h2>
        <IconView
          aria-labelledby="heading"
          count={2}
          renderIcon={renderIcon}
          getItemLabel={labelOf}
        />
      </>,
    );
    expect(screen.getByRole("listbox", { name: "Baskets" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and other props to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Fruit
        ref={ref}
        className="extra"
        id="fruit"
        style={{ height: 120 }}
        scrollerStyle="legacy"
      />,
    );
    expect(ref.current).toHaveClass("mac-icon-view", "extra");
    expect(ref.current).toHaveAttribute("id", "fruit");
    expect(ref.current).toHaveAttribute("data-scroller-style", "legacy");
    expect(ref.current?.style.height).toBe("120px");
  });
});

// An item out of view is not rendered, so the listbox cannot name it: the current item is
// brought into view when the keyboard focus arrives and when it changes under the focus.
describe("IconView, a current item out of view", () => {
  const many = (props: Partial<IconViewProps>) => (
    <IconView
      aria-label="Fruit"
      count={5000}
      renderIcon={renderIcon}
      getItemLabel={(index) => `Item ${index}`}
      {...props}
    />
  );

  it("scrolls to the selected item's row when the keyboard focus arrives", async () => {
    const user = userEvent.setup();
    render(many({ defaultValue: [2001] }));
    expect(view().scrollTop).toBe(0);
    await user.tab();
    expect(view()).toHaveFocus();
    // Four columns, rows of 116 pt: item 2001 is in row 500.
    expect(view().scrollTop).toBe(500 * 116);
  });

  it("keeps the current item in view when the row height changes under the focus", async () => {
    const user = userEvent.setup();
    const { rerender } = render(many({ defaultValue: [2001] }));
    await user.tab();
    rerender(many({ defaultValue: [2001], rowHeight: 100 }));
    expect(view().scrollTop).toBe(500 * 100);
  });

  it("leaves a press on a label inside an item to the label", () => {
    const onItemAction = vi.fn();
    render(
      <Fruit
        defaultValue={[0, 1]}
        onItemAction={onItemAction}
        renderIcon={(index) => (
          <label>
            Tag {index}
            <input type="checkbox" />
          </label>
        )}
      />,
    );
    fireEvent.mouseDown(screen.getByText("Tag 3"));
    fireEvent.doubleClick(screen.getByText("Tag 3"));
    expect(selection()).toHaveLength(2);
    expect(onItemAction).not.toHaveBeenCalled();
  });

  it("leaves editable text inside an item alone, and treats text marked not editable as the item", () => {
    const onItemAction = vi.fn();
    render(
      <Fruit
        onItemAction={onItemAction}
        renderIcon={(index) => (
          <span contentEditable={index === 1} suppressContentEditableWarning>
            Note {index}
          </span>
        )}
      />,
    );
    expect(screen.getByText("Note 3")).toHaveAttribute("contenteditable", "false");
    // The press on editable text is not cancelled, so the caret can go where it was pressed.
    expect(fireEvent.mouseDown(screen.getByText("Note 1"))).toBe(true);
    fireEvent.doubleClick(screen.getByText("Note 1"));
    expect(selection()).toEqual([]);
    expect(onItemAction).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByText("Note 3"));
    fireEvent.doubleClick(screen.getByText("Note 3"));
    expect(item("Cherry")).toHaveAttribute("aria-selected", "true");
    expect(onItemAction).toHaveBeenCalledWith(3);
  });

  it("tells an item with a number for an id from one with the same digits as text", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Fruit count={2} getItemId={(index) => (index ? "1" : 1)} defaultValue={["1"]} />);
    expect(selection()).toEqual(["Banana"]);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("follows a selection set from outside while it has the focus, and not without it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(many({ value: [1] }));
    rerender(many({ value: [1200] }));
    expect(view().scrollTop).toBe(0);
    await user.tab();
    view().scrollTop = 0;
    rerender(many({ value: [2800] }));
    expect(view().scrollTop).toBe(700 * 116);
  });
});
