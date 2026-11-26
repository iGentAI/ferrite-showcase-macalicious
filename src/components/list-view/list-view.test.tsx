import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ListView,
  type ListViewProps,
  ListViewRowDetail,
  ListViewRowLeading,
  ListViewRowTitle,
  ListViewRowTrailing,
} from "./index";

const fruit = ["Apple", "Banana", "Blueberry", "Cherry", "Date", "Elderberry"];
const renderFruit = (index: number) => fruit[index];
const labelOf = (index: number) => fruit[index] ?? "";

/**
 * jsdom has no layout, so the list is never measured: it renders its first 40 rows, a page
 * is one row, and scrolling is checked through `scrollTop` alone. Real scrolling, focus and
 * the 10,000 row case are exercised in Chromium by visual/output/b7/browser/list-view.mjs.
 */
function Fruit(props: Partial<ListViewProps>) {
  return (
    <ListView
      aria-label="Fruit"
      count={fruit.length}
      renderRow={renderFruit}
      getRowLabel={labelOf}
      {...props}
    />
  );
}

const list = () => screen.getByRole("listbox", { name: "Fruit" });
const option = (name: string) => screen.getByRole("option", { name });
const selection = () =>
  screen.getAllByRole("option", { selected: true }).map((element) => element.textContent);

describe("ListView", () => {
  it("renders a listbox of options that know their position", () => {
    render(<Fruit data-testid="root" />);
    const root = screen.getByTestId("root");
    expect(root).toHaveClass("mac-list-view", "mac-scroll-view");
    expect(root).toHaveAttribute("data-separator", "none");
    expect(root).toHaveAttribute("data-emphasis", "focus");
    expect(root).toContainElement(list());
    expect(list()).toHaveAttribute("tabindex", "0");
    expect(list()).not.toHaveAttribute("aria-multiselectable");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(6);
    expect(options[2]).toHaveTextContent("Blueberry");
    expect(options[2]).toHaveAttribute("aria-posinset", "3");
    expect(options[2]).toHaveAttribute("aria-setsize", "6");
    expect(options[2]).toHaveAttribute("aria-selected", "false");
  });

  describe("isRowHeading", () => {
    const food = ["Fruit heading", "Apple", "Banana", "Veg heading", "Carrot"];
    const isHeading = (index: number) => index === 0 || index === 3;
    const Food = (props: Partial<ListViewProps>) => (
      <ListView
        aria-label="Fruit"
        count={food.length}
        renderRow={(index) => (isHeading(index) ? <h2>{food[index]}</h2> : food[index])}
        getRowId={(index) => food[index] ?? index}
        getRowLabel={(index) => (isHeading(index) ? "" : (food[index] ?? ""))}
        isRowHeading={isHeading}
        {...props}
      />
    );
    const ids = (spy: { mock: { lastCall?: unknown[] } }) => spy.mock.lastCall?.[0];

    it("reads a heading as a heading, and counts only the options", () => {
      render(<Food />);
      expect(screen.getByRole("heading", { name: "Veg heading", level: 2 })).toBeInTheDocument();
      const options = screen.getAllByRole("option");
      expect(options.map((each) => each.textContent)).toEqual(["Apple", "Banana", "Carrot"]);
      expect(options.map((each) => each.getAttribute("aria-posinset"))).toEqual(["1", "2", "3"]);
      expect(options.map((each) => each.getAttribute("aria-setsize"))).toEqual(["3", "3", "3"]);
      const row = screen.getByText("Veg heading").closest(".mac-list-view-row");
      expect(row).toHaveAttribute("role", "none");
      expect(row).not.toHaveAttribute("aria-selected");
      expect(row).not.toHaveAttribute("aria-setsize");
    });

    it("passes over a heading with the arrow keys, both ways, and at the ends", () => {
      const change = vi.fn();
      render(<Food defaultValue={["Banana"]} onValueChange={change} />);
      fireEvent.keyDown(list(), { key: "ArrowDown" });
      expect(ids(change)).toEqual(["Carrot"]);
      fireEvent.keyDown(list(), { key: "ArrowUp" });
      expect(ids(change)).toEqual(["Banana"]);
      fireEvent.keyDown(list(), { key: "Home" });
      expect(ids(change)).toEqual(["Apple"]);
      fireEvent.keyDown(list(), { key: "ArrowUp" });
      expect(ids(change)).toEqual(["Apple"]);
      fireEvent.keyDown(list(), { key: "End" });
      expect(ids(change)).toEqual(["Carrot"]);
    });

    it("selects no heading by a press or by typing", () => {
      const change = vi.fn();
      render(<Food selectionMode="multiple" onValueChange={change} />);
      fireEvent.mouseDown(screen.getByText("Veg heading"));
      expect(change).not.toHaveBeenCalled();
      fireEvent.keyDown(list(), { key: "v", timeStamp: 5000 });
      expect(change).not.toHaveBeenCalled();
    });

    it("calls no row action on a heading", () => {
      const action = vi.fn();
      render(<Food onRowAction={action} />);
      fireEvent.doubleClick(screen.getByText("Veg heading"));
      expect(action).not.toHaveBeenCalled();
      fireEvent.doubleClick(option("Carrot"));
      expect(action).toHaveBeenCalledWith(4);
    });
  });

  it("passes row height, separator and inset to the styles", () => {
    render(
      <Fruit
        data-testid="root"
        rowHeight={34}
        separator="inset"
        separatorInset={50}
        emphasis="always"
      />,
    );
    expect(screen.getByTestId("root")).toHaveAttribute("data-emphasis", "always");
    expect(screen.getByTestId("root")).toHaveAttribute("data-separator", "inset");
    expect(screen.getByTestId("root")).toHaveAttribute("data-empty-rows", "none");
    const rows = option("Apple").parentElement as HTMLElement;
    expect(rows.style.getPropertyValue("--_height")).toBe("34px");
    expect(list().style.getPropertyValue("--_inset")).toBe("50px");
    expect(rows.style.height).toBe("204px");
  });

  it("draws empty rows below the last row, as tall as the rows, only when asked", () => {
    const { rerender } = render(<Fruit data-testid="root" rowHeight={64} emptyRows="separator" />);
    expect(screen.getByTestId("root")).toHaveAttribute("data-empty-rows", "separator");
    // They start where the six rows end and repeat every row height.
    expect(list().style.getPropertyValue("--_end")).toBe("384px");
    expect(list().style.getPropertyValue("--_period")).toBe("64px");
    // They are drawn, not rendered: no option or element is added for them.
    expect(screen.getAllByRole("option")).toHaveLength(6);
    expect((option("Apple").parentElement as HTMLElement).style.height).toBe("384px");

    // Rows of different heights: an empty row is as tall as the last row.
    const heights = [34, 70, 34, 34, 34, 56];
    rerender(
      <Fruit data-testid="root" rowHeight={(index) => heights[index] ?? 0} emptyRows="separator" />,
    );
    expect(list().style.getPropertyValue("--_end")).toBe("262px");
    expect(list().style.getPropertyValue("--_period")).toBe("56px");

    // An empty list is all empty rows, from the top.
    rerender(<Fruit data-testid="root" count={0} rowHeight={64} emptyRows="separator" />);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(list().style.getPropertyValue("--_end")).toBe("0px");
    expect(list().style.getPropertyValue("--_period")).toBe("64px");
  });

  it("gives each row the height a function gives it and places the rows by their offsets", () => {
    const heights = [34, 70, 34, 34, 34, 34];
    render(<Fruit data-testid="root" rowHeight={(index) => heights[index] ?? 0} />);
    const rows = option("Apple").parentElement as HTMLElement;
    expect(rows.style.getPropertyValue("--_height")).toBe("");
    expect(rows.style.height).toBe("240px");
    expect(rows.style.paddingTop).toBe("0px");
    expect(option("Banana").style.getPropertyValue("--_height")).toBe("70px");
    expect(option("Cherry").style.getPropertyValue("--_height")).toBe("34px");
  });

  it("scrolls a row of its own height into view and pages by what the view holds", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(110);
    const heights = [34, 70, 34, 34, 34, 34];
    render(<Fruit defaultValue={[0]} rowHeight={(index) => heights[index] ?? 0} />);
    await user.tab();
    await user.keyboard("{End}");
    // The last row ends at 240, the view is 110 tall.
    expect(list().scrollTop).toBe(130);
    await user.keyboard("{Home}");
    expect(list().scrollTop).toBe(0);
    // From Apple (0..34) a view of 110 reaches into Blueberry (104..138): a page is the rows
    // before it, less one. Up from Cherry (138..172) it reaches back into Banana (34..104).
    await user.keyboard("{PageDown}");
    expect(selection()).toEqual(["Banana"]);
    await user.keyboard("{ArrowDown}{ArrowDown}{PageUp}");
    expect(selection()).toEqual(["Blueberry"]);
  });

  it("renders only a window of a long list", () => {
    const renderRow = vi.fn((index: number) => `Row ${index}`);
    render(<ListView aria-label="Long" count={10000} renderRow={renderRow} />);
    expect(screen.getAllByRole("option")).toHaveLength(40);
    expect(renderRow).toHaveBeenCalledTimes(40);
    expect(screen.getByRole("option", { name: "Row 0" })).toHaveAttribute("aria-setsize", "10000");
    const rows = screen.getByRole("option", { name: "Row 0" }).parentElement as HTMLElement;
    expect(rows.style.height).toBe("240000px");
  });

  it("selects the clicked row and reports its id", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Fruit defaultValue={[0]} onValueChange={onValueChange} />);
    expect(selection()).toEqual(["Apple"]);
    await user.click(option("Cherry"));
    expect(selection()).toEqual(["Cherry"]);
    expect(onValueChange).toHaveBeenLastCalledWith([3]);
    expect(list()).toHaveFocus();
    expect(list()).toHaveAttribute("aria-activedescendant", option("Cherry").id);
  });

  it("selects by the ids getRowId gives", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Fruit
        getRowId={(index) => `id-${fruit[index]}`}
        defaultValue={["id-Date"]}
        onValueChange={onValueChange}
      />,
    );
    expect(selection()).toEqual(["Date"]);
    await user.click(option("Banana"));
    expect(onValueChange).toHaveBeenLastCalledWith(["id-Banana"]);
  });

  it("leaves a controlled selection to its owner", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<Fruit value={[1]} onValueChange={onValueChange} />);
    await user.click(option("Date"));
    expect(onValueChange).toHaveBeenLastCalledWith([4]);
    expect(selection()).toEqual(["Banana"]);
    rerender(<Fruit value={[4]} onValueChange={onValueChange} />);
    expect(selection()).toEqual(["Date"]);
  });

  it("ignores Command and Shift in single selection", () => {
    render(<Fruit defaultValue={[0]} />);
    fireEvent.mouseDown(option("Cherry"), { metaKey: true });
    expect(selection()).toEqual(["Cherry"]);
    fireEvent.mouseDown(option("Date"), { shiftKey: true });
    expect(selection()).toEqual(["Date"]);
  });

  it("toggles with Command-click and extends with Shift-click in multiple selection", () => {
    const onValueChange = vi.fn();
    render(<Fruit selectionMode="multiple" defaultValue={[1]} onValueChange={onValueChange} />);
    expect(list()).toHaveAttribute("aria-multiselectable", "true");
    fireEvent.mouseDown(option("Date"), { metaKey: true });
    expect(selection()).toEqual(["Banana", "Date"]);
    expect(onValueChange).toHaveBeenLastCalledWith([1, 4]);
    fireEvent.mouseDown(option("Banana"), { metaKey: true });
    expect(selection()).toEqual(["Date"]);
    fireEvent.mouseDown(option("Apple"));
    fireEvent.mouseDown(option("Cherry"), { shiftKey: true });
    expect(selection()).toEqual(["Apple", "Banana", "Blueberry", "Cherry"]);
    expect(onValueChange).toHaveBeenLastCalledWith([0, 1, 2, 3]);
  });

  it("extends a Shift-click from the row selected at first", () => {
    render(<Fruit selectionMode="multiple" defaultValue={[3]} />);
    fireEvent.mouseDown(option("Banana"), { shiftKey: true });
    expect(selection()).toEqual(["Banana", "Blueberry", "Cherry"]);
  });

  it("does not select with the secondary mouse button", () => {
    render(<Fruit defaultValue={[0]} />);
    fireEvent.mouseDown(option("Cherry"), { button: 2 });
    expect(selection()).toEqual(["Apple"]);
  });

  it("selects nothing with selectionMode none", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onRowAction = vi.fn();
    render(<Fruit selectionMode="none" onValueChange={onValueChange} onRowAction={onRowAction} />);
    await user.dblClick(option("Cherry"));
    await user.keyboard("{ArrowDown}b");
    expect(screen.queryAllByRole("option", { selected: true })).toHaveLength(0);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onRowAction).toHaveBeenCalledWith(3);
  });

  it("shows no row as selected with selectionMode none, whatever the value names", () => {
    const { rerender } = render(<Fruit selectionMode="none" defaultValue={[1]} />);
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
    rerender(<Fruit selectionMode="single" defaultValue={[1]} />);
    expect(selection()).toEqual(["Banana"]);
  });

  it("moves the selection with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Fruit defaultValue={[1]} onValueChange={onValueChange} />);
    await user.tab();
    expect(list()).toHaveFocus();
    expect(list()).toHaveAttribute("aria-activedescendant", option("Banana").id);
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Blueberry"]);
    expect(list()).toHaveAttribute("aria-activedescendant", option("Blueberry").id);
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(selection()).toEqual(["Apple"]);
    await user.keyboard("{End}");
    expect(selection()).toEqual(["Elderberry"]);
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Elderberry"]);
    await user.keyboard("{Home}");
    expect(selection()).toEqual(["Apple"]);
    expect(onValueChange).toHaveBeenLastCalledWith([0]);
  });

  it("starts at the first row with Down Arrow and at the last with Up Arrow when nothing is selected", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Fruit />);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Apple"]);
    unmount();
    render(<Fruit />);
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect(selection()).toEqual(["Elderberry"]);
  });

  it("moves by a page with Page Down and Page Up", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(96);
    render(<Fruit defaultValue={[0]} />);
    await user.tab();
    // 96 pt show four 24 pt rows: a page moves three.
    await user.keyboard("{PageDown}");
    expect(selection()).toEqual(["Cherry"]);
    await user.keyboard("{PageDown}");
    expect(selection()).toEqual(["Elderberry"]);
    await user.keyboard("{PageUp}");
    expect(selection()).toEqual(["Blueberry"]);
  });

  it("extends the selection with Shift and the arrow keys in multiple selection", async () => {
    const user = userEvent.setup();
    render(<Fruit selectionMode="multiple" defaultValue={[2]} />);
    await user.tab();
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    expect(selection()).toEqual(["Blueberry", "Cherry", "Date"]);
    await user.keyboard("{Shift>}{ArrowUp}{ArrowUp}{ArrowUp}{/Shift}");
    expect(selection()).toEqual(["Banana", "Blueberry"]);
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Blueberry"]);
  });

  it("moves the current row with Control and toggles it with Control-Space", async () => {
    const user = userEvent.setup();
    render(<Fruit selectionMode="multiple" defaultValue={[0]} />);
    await user.tab();
    await user.keyboard("{Control>}{ArrowDown}{ArrowDown}{/Control}");
    expect(selection()).toEqual(["Apple"]);
    expect(list()).toHaveAttribute("aria-activedescendant", option("Blueberry").id);
    await user.keyboard("{Control>} {/Control}");
    expect(selection()).toEqual(["Apple", "Blueberry"]);
    await user.keyboard("{Control>} {/Control}");
    expect(selection()).toEqual(["Apple"]);
    // The row taken out of the selection is still the one the keys move from.
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Cherry"]);
  });

  it("lets the caller's handlers cancel selection, the row action and keys", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    const onKeyDown = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <Fruit
        defaultValue={[0]}
        onRowAction={onRowAction}
        onMouseDown={(event) => event.preventDefault()}
        onDoubleClick={(event) => event.preventDefault()}
        onKeyDown={onKeyDown}
      />,
    );
    await user.dblClick(option("Banana"));
    list().focus();
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Apple"]);
    expect(onRowAction).not.toHaveBeenCalled();
    // Called for the key once, not a second time as the event bubbles to the root.
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("selects every row with Command-A in multiple selection only", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { unmount } = render(<Fruit selectionMode="multiple" onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard("{Meta>}a{/Meta}");
    expect(onValueChange).toHaveBeenLastCalledWith([0, 1, 2, 3, 4, 5]);
    expect(selection()).toHaveLength(6);
    unmount();
    render(<Fruit defaultValue={[3]} />);
    await user.tab();
    await user.keyboard("{Meta>}a{/Meta}");
    expect(selection()).toEqual(["Cherry"]);
  });

  it("selects by typing the start of a label", async () => {
    const user = userEvent.setup();
    render(<Fruit defaultValue={[0]} />);
    await user.tab();
    await user.keyboard("ch");
    expect(selection()).toEqual(["Cherry"]);
  });

  it("steps through the rows that start with a repeated letter", async () => {
    const user = userEvent.setup();
    render(<Fruit defaultValue={[0]} />);
    await user.tab();
    await user.keyboard("b");
    expect(selection()).toEqual(["Banana"]);
    await user.keyboard("b");
    expect(selection()).toEqual(["Blueberry"]);
    await user.keyboard("b");
    expect(selection()).toEqual(["Banana"]);
  });

  it("does not type-select without getRowLabel", async () => {
    const user = userEvent.setup();
    render(<Fruit getRowLabel={undefined} defaultValue={[0]} />);
    await user.tab();
    await user.keyboard("c");
    expect(selection()).toEqual(["Apple"]);
  });

  it("calls onRowAction on a double click and on Return for the current row", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(<Fruit defaultValue={[4]} onRowAction={onRowAction} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onRowAction).toHaveBeenLastCalledWith(4);
    await user.dblClick(option("Banana"));
    expect(onRowAction).toHaveBeenLastCalledWith(1);
    expect(onRowAction).toHaveBeenCalledTimes(2);
  });

  it("leaves presses and keys in a control inside a row to the control", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <Fruit
        onRowAction={onRowAction}
        renderRow={(index) => <button type="button">Open {fruit[index]}</button>}
      />,
    );
    const button = screen.getByRole("button", { name: "Open Banana" });
    await user.dblClick(button);
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
    expect(onRowAction).not.toHaveBeenCalled();
    button.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
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
    await user.click(option("Banana"));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    expect(selection()).toEqual(["Date"]);
    list().focus();
    expect(list()).toHaveAttribute("aria-activedescendant", option("Date").id);
    await user.keyboard("{ArrowDown}");
    expect(selection()).toEqual(["Elderberry"]);
  });

  it("keeps the current row and a range's start by id when the rows are reordered or the selection is set from outside", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [order, setOrder] = useState(fruit);
      const [value, setValue] = useState<(string | number)[]>([]);
      return (
        <>
          <ListView
            aria-label="Fruit"
            selectionMode="multiple"
            count={order.length}
            renderRow={(index) => order[index]}
            getRowId={(index) => order[index] ?? index}
            value={value}
            onValueChange={setValue}
          />
          <button type="button" onClick={() => setOrder([...order].reverse())}>
            Reverse
          </button>
          <button type="button" onClick={() => setValue(["Date"])}>
            Jump
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(option("Banana"));
    // Elderberry, Date, Cherry, Blueberry, Banana, Apple: the selection array is the same.
    await user.click(screen.getByRole("button", { name: "Reverse" }));
    list().focus();
    expect(list()).toHaveAttribute("aria-activedescendant", option("Banana").id);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(selection()).toEqual(["Banana", "Apple"]);
    // A range after an outside selection starts at it, not at the row clicked before.
    await user.click(screen.getByRole("button", { name: "Jump" }));
    list().focus();
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(selection()).toEqual(["Date", "Cherry"]);
  });

  it("starts a Shift range at an outside selection after Control has moved the current row", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<(string | number)[]>([]);
      return (
        <>
          <Fruit selectionMode="multiple" value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue([1])}>
            Jump
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(option("Elderberry"));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    list().focus();
    await user.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(selection()).toEqual(["Banana"]);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    // From Banana, not from the row clicked before the selection was set from outside.
    expect(selection()).toEqual(["Banana", "Blueberry", "Cherry"]);
  });

  it("keeps a row's own state with its item when the rows are reordered", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [order, setOrder] = useState(fruit);
      return (
        <>
          <ListView
            aria-label="Fruit"
            count={order.length}
            renderRow={(index) => <input aria-label={`Note on ${order[index]}`} />}
            getRowId={(index) => order[index] ?? index}
          />
          <button type="button" onClick={() => setOrder([...order].reverse())}>
            Reverse
          </button>
        </>
      );
    }
    render(<Owner />);
    fireEvent.change(screen.getByLabelText("Note on Apple"), { target: { value: "ripe" } });
    await user.click(screen.getByRole("button", { name: "Reverse" }));
    expect(screen.getByLabelText("Note on Apple")).toHaveValue("ripe");
    expect(screen.getByLabelText("Note on Elderberry")).toHaveValue("");
  });

  it.each([
    ["ArrowDown", "Apple"],
    ["ArrowUp", "Elderberry"],
    ["Home", "Apple"],
    ["End", "Elderberry"],
    // jsdom has no layout, so a page is one row.
    ["PageDown", "Apple"],
    ["PageUp", "Apple"],
  ])("with nothing selected, %s selects %s", async (key, name) => {
    const user = userEvent.setup();
    render(<Fruit />);
    await user.tab();
    await user.keyboard(`{${key}}`);
    expect(selection()).toEqual([name]);
  });

  it("does nothing with keys when it has no rows", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onRowAction = vi.fn();
    render(<Fruit count={0} onValueChange={onValueChange} onRowAction={onRowAction} />);
    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}{PageDown}{PageUp}a{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onRowAction).not.toHaveBeenCalled();
  });

  it("keeps its one row selected under every movement key", async () => {
    const user = userEvent.setup();
    render(<Fruit count={1} />);
    await user.tab();
    for (const key of ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home"]) {
      await user.keyboard(`{${key}}`);
      expect(selection()).toEqual(["Apple"]);
    }
  });

  it("names no row as active after the selection is cleared from outside", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<(string | number)[]>([]);
      return (
        <>
          <Fruit value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue([])}>
            Clear
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(option("Banana"));
    expect(list()).toHaveAttribute("aria-activedescendant", option("Banana").id);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(list()).not.toHaveAttribute("aria-activedescendant");
  });

  it("scrolls the row it moves to into view", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(48);
    render(<Fruit defaultValue={[0]} />);
    await user.tab();
    await user.keyboard("{End}");
    // Six 24 pt rows in a 48 pt view: the last row's bottom is at 144.
    expect(list().scrollTop).toBe(96);
    await user.keyboard("{ArrowUp}");
    expect(list().scrollTop).toBe(96);
    await user.keyboard("{Home}");
    expect(list().scrollTop).toBe(0);
  });

  it("re-renders only the rows whose selection changed", async () => {
    const user = userEvent.setup();
    const renderRow = vi.fn(renderFruit);
    render(<Fruit renderRow={renderRow} defaultValue={[0]} />);
    expect(renderRow).toHaveBeenCalledTimes(6);
    renderRow.mockClear();
    await user.click(option("Cherry"));
    expect(renderRow.mock.calls.map(([index]) => index).sort()).toEqual([0, 3]);
  });

  it("names the listbox with aria-labelledby", () => {
    render(
      <>
        <h2 id="heading">Baskets</h2>
        <ListView aria-labelledby="heading" count={2} renderRow={renderFruit} />
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
    expect(ref.current).toHaveClass("mac-list-view", "extra");
    expect(ref.current).toHaveAttribute("id", "fruit");
    expect(ref.current).toHaveAttribute("data-scroller-style", "legacy");
    expect(ref.current?.style.height).toBe("120px");
  });
});

describe("ListView row parts", () => {
  it("render their content with their class and forward props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ListView
        aria-label="Notes"
        count={1}
        rowHeight={56}
        renderRow={() => (
          <>
            <ListViewRowLeading data-testid="leading">o</ListViewRowLeading>
            <ListViewRowTitle ref={ref} className="extra" id="title">
              Shopping
            </ListViewRowTitle>
            <ListViewRowDetail data-testid="detail" lead="3:55 PM">
              Milk
            </ListViewRowDetail>
            <ListViewRowDetail data-testid="plain">Bread</ListViewRowDetail>
            <ListViewRowTrailing data-testid="trailing">x</ListViewRowTrailing>
          </>
        )}
      />,
    );
    expect(ref.current).toHaveClass("mac-list-view-row-title", "extra");
    expect(ref.current).toHaveAttribute("id", "title");
    expect(screen.getByTestId("leading")).toHaveClass("mac-list-view-row-leading");
    expect(screen.getByTestId("trailing")).toHaveClass("mac-list-view-row-trailing");
    const detail = screen.getByTestId("detail");
    expect(detail).toHaveClass("mac-list-view-row-detail");
    expect(detail).toHaveTextContent("3:55 PMMilk");
    expect(detail.querySelector(".mac-list-view-row-detail-lead")).toHaveTextContent("3:55 PM");
    expect(screen.getByTestId("plain").querySelector(".mac-list-view-row-detail-lead")).toBeNull();
  });
});

// A row out of view is not rendered, so the listbox cannot name it: the current row is
// brought into view when the keyboard focus arrives and when it changes under the focus.
describe("ListView, a current row out of view", () => {
  const long = (props: Partial<ListViewProps>) => (
    <ListView aria-label="Fruit" count={10000} renderRow={(index) => `Row ${index}`} {...props} />
  );

  it("scrolls to the selected row when the keyboard focus arrives", async () => {
    const user = userEvent.setup();
    render(long({ defaultValue: [500] }));
    expect(list().scrollTop).toBe(0);
    await user.tab();
    expect(list()).toHaveFocus();
    expect(list().scrollTop).toBe(500 * 24);
  });

  it("renders the row it scrolled to and names it at once", async () => {
    const user = userEvent.setup();
    // Stand-in for layout: a 120 pt view shows five 24 pt rows.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(120);
    render(long({ defaultValue: [500] }));
    expect(list().querySelector('[data-index="500"]')).toBeNull();
    expect(list()).not.toHaveAttribute("aria-activedescendant");
    await user.tab();
    // The row is the last one in view: its bottom is at the view's bottom.
    expect(list().scrollTop).toBe(501 * 24 - 120);
    const current = list().querySelector<HTMLElement>('[data-index="500"]');
    expect(current).toHaveAttribute("aria-selected", "true");
    expect(list()).toHaveAttribute("aria-activedescendant", current?.id);
  });

  it("follows a selection set from outside while it has the focus, and not without it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(long({ value: [1] }));
    rerender(long({ value: [300] }));
    expect(list().scrollTop).toBe(0);
    await user.tab();
    list().scrollTop = 0;
    rerender(long({ value: [700] }));
    expect(list().scrollTop).toBe(700 * 24);
  });

  it("keeps the current row in view when the row height changes under the focus", async () => {
    const user = userEvent.setup();
    const { rerender } = render(long({ defaultValue: [500] }));
    await user.tab();
    rerender(long({ defaultValue: [500], rowHeight: 34 }));
    expect(list().scrollTop).toBe(500 * 34);
  });

  it("leaves a press on the label of a control inside a row to the control", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <Fruit
        selectionMode="multiple"
        defaultValue={[0, 1]}
        onRowAction={onRowAction}
        renderRow={(index) => (
          <label>
            <input type="checkbox" />
            Keep {fruit[index]}
          </label>
        )}
      />,
    );
    await user.dblClick(screen.getByText("Keep Cherry"));
    expect(screen.getAllByRole("option", { selected: true })).toHaveLength(2);
    expect(onRowAction).not.toHaveBeenCalled();
  });

  it("leaves editable text inside a row alone, and treats text marked not editable as the row", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <Fruit
        onRowAction={onRowAction}
        renderRow={(index) => (
          <span contentEditable={index === 1} suppressContentEditableWarning>
            Edit {fruit[index]}
          </span>
        )}
      />,
    );
    expect(screen.getByText("Edit Cherry")).toHaveAttribute("contenteditable", "false");
    await user.dblClick(screen.getByText("Edit Banana"));
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
    expect(onRowAction).not.toHaveBeenCalled();
    await user.dblClick(screen.getByText("Edit Cherry"));
    expect(selection()).toEqual(["Edit Cherry"]);
    expect(onRowAction).toHaveBeenCalledWith(3);
  });

  it("tells a row with a number for an id from one with the same digits as text", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Fruit count={2} getRowId={(index) => (index ? "1" : 1)} defaultValue={["1"]} />);
    expect(selection()).toEqual(["Banana"]);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("stays where it is when nothing is selected", async () => {
    const user = userEvent.setup();
    render(long({}));
    list().scrollTop = 120;
    await user.tab();
    expect(list().scrollTop).toBe(120);
  });
});
