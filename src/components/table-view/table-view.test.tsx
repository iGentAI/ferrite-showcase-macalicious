import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  TableView,
  TableViewCellText,
  type TableViewColumn,
  type TableViewProps,
  type TableViewSort,
} from "./index";

/*
 * jsdom has no layout, so the view is never measured and the first 40 rows are rendered.
 * Scrolling, the rendered range with 10,000 rows, keeping the selected row in view and
 * dragging a column edge are exercised in Chromium by visual/output/b7/browser/table-view.mjs,
 * and the selection colours by the `expect` comparisons of table-view.visual.json.
 */
const names = ["Activity Monitor", "cfprefsd", "Finder", "loginwindow", "sharingd"];
const columns: TableViewColumn[] = [
  { id: "name", title: "Process Name", width: 200, sortable: true },
  { id: "cpu", title: "% CPU", align: "right" },
];

function Table(props: Partial<TableViewProps>) {
  return (
    <TableView
      aria-label="Processes"
      columns={columns}
      rowCount={names.length}
      getRowId={(row) => names[row] ?? row}
      getRowLabel={(row) => names[row] ?? ""}
      renderCell={(row, column) => (column.id === "name" ? names[row] : row)}
      {...props}
    />
  );
}

const grid = () => screen.getByRole("grid", { name: "Processes" });
const row = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}`) });
const selected = () =>
  screen
    .getAllByRole("row")
    .filter((element) => element.getAttribute("aria-selected") === "true")
    .map((element) => element.firstElementChild?.textContent);

describe("TableView", () => {
  it("renders a grid with a header row and a row of cells per item", () => {
    render(<Table />);
    expect(grid()).toHaveClass("mac-table-view");
    expect(grid()).toHaveAttribute("aria-rowcount", "6");
    expect(grid()).toHaveAttribute("aria-colcount", "2");
    expect(grid()).toHaveAttribute("tabindex", "0");
    expect(grid()).toHaveAttribute("data-size", "regular");
    expect(grid()).not.toHaveAttribute("data-alternating");
    expect(grid()).not.toHaveAttribute("aria-multiselectable");
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Process Name",
      "% CPU",
    ]);
    expect(screen.getAllByRole("row")).toHaveLength(6);
    const finder = row("Finder");
    expect(finder).toHaveAttribute("aria-rowindex", "4");
    expect(finder).toHaveAttribute("aria-selected", "false");
    const cells = within(finder).getAllByRole("gridcell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["Finder", "2"]);
    expect(cells[0]?.style.width).toBe("200px");
    expect(cells[1]).toHaveAttribute("data-align", "right");
  });

  it("aligns a heading as its cells, or on its own with headerAlign", () => {
    render(
      <Table
        columns={[
          { id: "name", title: "Process Name", width: 200, headerAlign: "center" },
          { id: "cpu", title: "% CPU", width: 60, align: "right", headerAlign: "center" },
          { id: "pid", title: "PID", width: 60, align: "right" },
          { id: "user", title: "User", align: "center", headerAlign: "left" },
        ]}
      />,
    );
    const aligned = (cells: HTMLElement[]) => cells.map((cell) => cell.getAttribute("data-align"));
    expect(aligned(screen.getAllByRole("columnheader"))).toEqual([
      "center",
      "center",
      "right",
      "left",
    ]);
    // The cells keep the column's own alignment: none is left.
    expect(aligned(within(row("Finder")).getAllByRole("gridcell"))).toEqual([
      null,
      "right",
      "right",
      "center",
    ]);
  });

  it("reflects size, stripes and the header choice", () => {
    render(<Table size="small" alternatingRows header="none" rowHeight={18} />);
    expect(grid()).toHaveAttribute("data-size", "small");
    expect(grid()).toHaveAttribute("data-alternating");
    expect(screen.queryByRole("columnheader")).toBeNull();
    expect(grid()).toHaveAttribute("aria-rowcount", "5");
    expect(row("Activity Monitor")).toHaveAttribute("aria-rowindex", "1");
    expect(grid().querySelector<HTMLElement>(".mac-table-view-body")?.style.height).toBe("90px");
  });

  it("renders only a window of a long table", () => {
    const renderCell = vi.fn((index: number) => `Row ${index}`);
    render(
      <TableView
        aria-label="Processes"
        columns={[{ id: "only" }]}
        rowCount={10000}
        renderCell={renderCell}
        rowHeight={20}
      />,
    );
    // The header row and the first forty rows, in order: no layout, so no measured range.
    const rows = [...grid().querySelectorAll<HTMLElement>("[data-row]")];
    expect(rows).toHaveLength(40);
    expect(rows.map((element) => element.dataset.row)).toEqual(
      Array.from({ length: 40 }, (_, index) => `${index}`),
    );
    expect(rows[39]).toHaveTextContent("Row 39");
    expect(screen.getAllByRole("row")).toHaveLength(41);
    expect(renderCell).toHaveBeenCalledWith(0, { id: "only" });
    expect(renderCell.mock.calls.length).toBeLessThanOrEqual(80);
    expect(grid()).toHaveAttribute("aria-rowcount", "10001");
    expect(grid().querySelector<HTMLElement>(".mac-table-view-body")?.style.height).toBe(
      "200000px",
    );
  });

  it("selects the clicked row and takes the keyboard focus", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Table onValueChange={onValueChange} />);
    await user.click(row("Finder"));
    expect(selected()).toEqual(["Finder"]);
    expect(onValueChange).toHaveBeenLastCalledWith(["Finder"]);
    expect(grid()).toHaveFocus();
    expect(grid()).toHaveAttribute("aria-activedescendant", row("Finder").id);
    await user.click(row("sharingd"));
    expect(selected()).toEqual(["sharingd"]);
  });

  // The grid is focused from script, which browsers take for focus from the keyboard
  // (jsdom has no focus ring to look at: click-light and click-dark of
  // table-view.visual.json check it in Chromium).
  it("marks focus that a press gave it, until the focus arrives another way", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(
      <>
        <Table onFocus={onFocus} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(grid()).toHaveFocus();
    expect(grid()).not.toHaveAttribute("data-pointer-focus");
    await user.click(row("Finder"));
    expect(grid()).toHaveFocus();
    expect(grid()).toHaveAttribute("data-pointer-focus", "");
    await user.keyboard("{ArrowDown}");
    expect(grid()).toHaveAttribute("data-pointer-focus", "");
    // A press that gives the focus is marked too, and the caller still hears of the focus.
    await user.click(screen.getByRole("button", { name: "After" }));
    onFocus.mockClear();
    await user.click(row("cfprefsd"));
    expect(grid()).toHaveFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(grid()).toHaveAttribute("data-pointer-focus", "");
    await user.click(screen.getByRole("button", { name: "After" }));
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(grid()).toHaveFocus();
    expect(grid()).not.toHaveAttribute("data-pointer-focus");
  });

  it("starts from defaultValue and selects by index without getRowId", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Table getRowId={undefined} defaultValue={[1]} onValueChange={onValueChange} />);
    expect(selected()).toEqual(["cfprefsd"]);
    await user.click(row("loginwindow"));
    expect(onValueChange).toHaveBeenLastCalledWith([3]);
  });

  it("moves the selection with the arrow keys, Home, End and the page keys", async () => {
    const user = userEvent.setup();
    render(<Table />);
    // The grid is the first tab stop; its sortable headings follow it.
    await user.tab();
    expect(grid()).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["Activity Monitor"]);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(selected()).toEqual(["Finder"]);
    await user.keyboard("{ArrowUp}");
    expect(selected()).toEqual(["cfprefsd"]);
    await user.keyboard("{End}");
    expect(selected()).toEqual(["sharingd"]);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["sharingd"]);
    await user.keyboard("{Home}");
    expect(selected()).toEqual(["Activity Monitor"]);
    await user.keyboard("{ArrowUp}");
    expect(selected()).toEqual(["Activity Monitor"]);
    await user.keyboard("{PageDown}");
    expect(selected()).toEqual(["cfprefsd"]);
    await user.keyboard("{PageUp}");
    expect(selected()).toEqual(["Activity Monitor"]);
  });

  it("moves to the first row with Page Up from a row less than a page down", async () => {
    const user = userEvent.setup();
    // jsdom has no layout, so a page is one row; the current row is the first one.
    render(<Table selectionMode="multiple" defaultValue={["cfprefsd", "Activity Monitor"]} />);
    await user.tab();
    await user.keyboard("{PageUp}");
    expect(selected()).toEqual(["Activity Monitor"]);
  });

  it("moves by a page of several rows, and stops at the first row", async () => {
    const user = userEvent.setup();
    // Stand-in for layout: 100 pt less the 24 pt header shows four 19 pt rows, a page of three.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
    render(<Table defaultValue={["sharingd"]} />);
    await user.tab();
    await user.keyboard("{PageUp}");
    expect(selected()).toEqual(["cfprefsd"]);
    // One row from the top is less than a page: Page Up goes to the first row.
    await user.keyboard("{PageUp}");
    expect(selected()).toEqual(["Activity Monitor"]);
    await user.keyboard("{PageDown}");
    expect(selected()).toEqual(["loginwindow"]);
    await user.keyboard("{PageDown}");
    expect(selected()).toEqual(["sharingd"]);
  });

  it.each([
    ["ArrowDown", "Activity Monitor"],
    ["ArrowUp", "sharingd"],
    ["Home", "Activity Monitor"],
    ["End", "sharingd"],
    ["PageDown", "Activity Monitor"],
    ["PageUp", "Activity Monitor"],
  ])("with nothing selected, %s selects %s", async (key, name) => {
    const user = userEvent.setup();
    render(<Table />);
    await user.tab();
    await user.keyboard(`{${key}}`);
    expect(selected()).toEqual([name]);
  });

  it("does nothing with keys when it has no rows", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onRowAction = vi.fn();
    render(<Table rowCount={0} onValueChange={onValueChange} onRowAction={onRowAction} />);
    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}{PageDown}{PageUp}a{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onRowAction).not.toHaveBeenCalled();
  });

  it("keeps its one row selected under every movement key", async () => {
    const user = userEvent.setup();
    render(<Table rowCount={1} />);
    await user.tab();
    for (const key of ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home"]) {
      await user.keyboard(`{${key}}`);
      expect(selected()).toEqual(["Activity Monitor"]);
    }
  });

  it("starts at the last row when Up Arrow is the first key", async () => {
    const user = userEvent.setup();
    render(<Table header="none" />);
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect(selected()).toEqual(["sharingd"]);
  });

  it("selects by typing the start of a row's label", async () => {
    const user = userEvent.setup();
    render(<Table header="none" />);
    await user.tab();
    await user.keyboard("lo");
    expect(selected()).toEqual(["loginwindow"]);
  });

  it("toggles with Command and extends with Shift when several rows can be selected", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Table selectionMode="multiple" onValueChange={onValueChange} />);
    expect(grid()).toHaveAttribute("aria-multiselectable", "true");
    await user.click(row("cfprefsd"));
    await user.keyboard("{Meta>}");
    await user.click(row("loginwindow"));
    expect(selected()).toEqual(["cfprefsd", "loginwindow"]);
    await user.click(row("cfprefsd"));
    expect(selected()).toEqual(["loginwindow"]);
    await user.keyboard("{/Meta}{Shift>}");
    await user.click(row("sharingd"));
    await user.keyboard("{/Shift}");
    // The range runs from the last row clicked without Shift.
    expect(selected()).toEqual(["cfprefsd", "Finder", "loginwindow", "sharingd"]);
    await user.click(row("Finder"));
    await user.keyboard("{Shift>}{ArrowUp}{ArrowUp}{/Shift}");
    expect(selected()).toEqual(["Activity Monitor", "cfprefsd", "Finder"]);
    await user.keyboard("{Meta>}a{/Meta}");
    expect(onValueChange).toHaveBeenLastCalledWith(names);
  });

  it("moves the current row with Control and toggles it with Control-Space", async () => {
    const user = userEvent.setup();
    render(<Table selectionMode="multiple" defaultValue={["cfprefsd"]} />);
    await user.tab();
    await user.keyboard("{Control>}{ArrowDown}{ArrowDown}{/Control}");
    expect(selected()).toEqual(["cfprefsd"]);
    expect(grid()).toHaveAttribute("aria-activedescendant", row("loginwindow").id);
    await user.keyboard("{Control>} {/Control}");
    expect(selected()).toEqual(["cfprefsd", "loginwindow"]);
    await user.keyboard("{Control>} {/Control}");
    expect(selected()).toEqual(["cfprefsd"]);
  });

  it("follows a selection that is set from outside", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<TableViewProps["value"]>([]);
      return (
        <>
          <Table value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue(["sharingd"])}>
            Jump
          </button>
          <button type="button" onClick={() => setValue([])}>
            Clear
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(row("cfprefsd"));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    grid().focus();
    expect(grid()).toHaveAttribute("aria-activedescendant", row("sharingd").id);
    await user.keyboard("{ArrowUp}");
    expect(selected()).toEqual(["loginwindow"]);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(grid()).not.toHaveAttribute("aria-activedescendant");
  });

  it("starts a Shift range at a selection that was set from outside", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<TableViewProps["value"]>([]);
      return (
        <>
          <Table selectionMode="multiple" value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue(["Finder"])}>
            Jump
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(row("Activity Monitor"));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    grid().focus();
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(selected()).toEqual(["Finder", "loginwindow"]);
  });

  it("starts a Shift range at an outside selection after Control has moved the current row", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [value, setValue] = useState<TableViewProps["value"]>([]);
      return (
        <>
          <Table selectionMode="multiple" value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue(["Finder"])}>
            Jump
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(row("Activity Monitor"));
    await user.click(screen.getByRole("button", { name: "Jump" }));
    grid().focus();
    await user.keyboard("{Control>}{ArrowDown}{/Control}");
    expect(selected()).toEqual(["Finder"]);
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    // From Finder, not from the row clicked before the selection was set from outside.
    expect(selected()).toEqual(["Finder"]);
  });

  it("extends with Shift from the row that is selected at first", async () => {
    const user = userEvent.setup();
    render(<Table selectionMode="multiple" defaultValue={["cfprefsd"]} />);
    await user.tab();
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(selected()).toEqual(["cfprefsd", "Finder"]);
  });

  it("does not start a range at a row that is no longer there", async () => {
    const user = userEvent.setup();
    const getRowId = vi.fn((index: number) => names[index] ?? index);
    const { rerender } = render(<Table selectionMode="multiple" getRowId={getRowId} />);
    await user.click(row("sharingd"));
    rerender(<Table selectionMode="multiple" getRowId={getRowId} rowCount={2} />);
    getRowId.mockClear();
    await user.keyboard("{Shift>}");
    await user.click(row("Activity Monitor"));
    await user.keyboard("{/Shift}");
    expect(selected()).toEqual(["Activity Monitor"]);
    expect(getRowId.mock.calls.every(([index]) => index < 2)).toBe(true);
  });

  it("renders the rows a smaller row height brings into view, without a scroll", () => {
    const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    const long = { rowCount: 1000, getRowId: undefined, getRowLabel: undefined };
    const { rerender } = render(<Table {...long} rowHeight={20} />);
    const before = screen.getAllByRole("row").length;
    rerender(<Table {...long} rowHeight={5} />);
    expect(screen.getAllByRole("row").length).toBeGreaterThan(before);
    height.mockRestore();
  });

  it("does not extend or toggle in single selection", async () => {
    const user = userEvent.setup();
    render(<Table />);
    await user.click(row("cfprefsd"));
    await user.keyboard("{Shift>}");
    await user.click(row("loginwindow"));
    expect(selected()).toEqual(["loginwindow"]);
    // Command neither adds another row nor takes the selected one out.
    await user.keyboard("{/Shift}{Meta>}");
    await user.click(row("Finder"));
    expect(selected()).toEqual(["Finder"]);
    await user.click(row("Finder"));
    expect(selected()).toEqual(["Finder"]);
  });

  it("selects nothing with selectionMode none, and still calls the row action", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onRowAction = vi.fn();
    render(<Table selectionMode="none" onValueChange={onValueChange} onRowAction={onRowAction} />);
    await user.click(row("Finder"));
    expect(row("Finder")).not.toHaveAttribute("aria-selected");
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onRowAction).toHaveBeenLastCalledWith(2);
  });

  it("calls onRowAction for a double click and for Return", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(<Table onRowAction={onRowAction} />);
    await user.dblClick(row("loginwindow"));
    expect(onRowAction).toHaveBeenLastCalledWith(3);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onRowAction).toHaveBeenLastCalledWith(4);
    expect(onRowAction).toHaveBeenCalledTimes(2);
  });

  // A table partly out of its window's view would otherwise be scrolled by the first press of a
  // double click, and the second press would land on another row.
  it("takes the focus from a press without scrolling the table into view", () => {
    render(<Table />);
    const focus = vi.spyOn(grid(), "focus");
    fireEvent.mouseDown(row("Finder"), { button: 0 });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("leaves a controlled selection to its owner", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<readonly (string | number)[]>(["Finder"]);
      // The owner never lets the first row be selected.
      return (
        <Table
          value={value}
          onValueChange={(next) => setValue(next.filter((id) => id !== names[0]))}
        />
      );
    }
    render(<Controlled />);
    expect(selected()).toEqual(["Finder"]);
    await user.click(row("cfprefsd"));
    expect(selected()).toEqual(["cfprefsd"]);
    await user.click(row("Activity Monitor"));
    expect(selected()).toEqual([]);
  });

  it("asks for a sort when a sortable heading is clicked, and shows the indicator", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const sort: TableViewSort = { column: "name", direction: "ascending" };
    const { rerender } = render(<Table onSortChange={onSortChange} />);
    const heading = screen.getByRole("button", { name: "Process Name" });
    expect(screen.queryByRole("button", { name: "% CPU" })).toBeNull();
    await user.click(heading);
    expect(onSortChange).toHaveBeenLastCalledWith(sort);
    // A click on a heading is not a click on a row.
    expect(selected()).toEqual([]);
    rerender(<Table sort={sort} onSortChange={onSortChange} />);
    expect(screen.getByRole("columnheader", { name: "Process Name" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await user.click(heading);
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "descending" });
  });

  it("keeps keys pressed on a heading away from the rows", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(<Table defaultValue={["Finder"]} onRowAction={onRowAction} />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Process Name" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(selected()).toEqual(["Finder"]);
    expect(onRowAction).not.toHaveBeenCalled();
  });

  it("moves a column through the table, its rows' cells following the heading", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const place = [...(this.parentElement?.children ?? [])].indexOf(this);
      const moved = Number.parseFloat(this.style.transform.slice("translateX(".length)) || 0;
      const left = place * 100 + moved;
      return { width: 100, left, x: left, right: left + 100 } as DOMRect;
    });
    function Moving() {
      const [order, setOrder] = useState(columns);
      return (
        <Table
          columns={order}
          headerProps={{
            onColumnMove: (id, before) => {
              const moved = order.find((column) => column.id === id) as TableViewColumn;
              const rest = order.filter((column) => column.id !== id);
              const place = before === null ? rest.length : rest.findIndex((c) => c.id === before);
              setOrder([...rest.slice(0, place), moved, ...rest.slice(place)]);
            },
          }}
        />
      );
    }
    render(<Moving />);
    const heading = screen.getByRole("columnheader", { name: "Process Name" });
    fireEvent.pointerDown(heading, { pointerId: 1, button: 0, clientX: 0 });
    fireEvent.pointerMove(heading, { pointerId: 1, buttons: 1, clientX: 170 });
    fireEvent.pointerUp(heading, { pointerId: 1, clientX: 170 });
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "% CPU",
      "Process Name",
    ]);
    const cells = within(row("2")).getAllByRole("gridcell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["2", "Finder"]);
    vi.restoreAllMocks();
  });

  it("reports column resizes for columns that have a width", () => {
    const onColumnResize = vi.fn();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 200,
    } as DOMRect);
    render(<Table onColumnResize={onColumnResize} />);
    const [name, cpu] = screen.getAllByRole("columnheader");
    expect(cpu?.querySelector(".mac-table-header-resizer")).toBeNull();
    fireEvent.keyDown(name as HTMLElement, { key: "ArrowRight", altKey: true });
    expect(onColumnResize).toHaveBeenLastCalledWith("name", 210);
  });

  it("adds getRowProps to each row, keeping the row's own class", () => {
    render(
      <Table
        getRowProps={(index) => ({
          "aria-level": index + 1,
          title: names[index],
          className: "mine",
        })}
      />,
    );
    expect(row("Finder")).toHaveAttribute("aria-level", "3");
    expect(row("Finder")).toHaveAttribute("title", "Finder");
    expect(row("Finder")).toHaveClass("mac-table-view-row", "mine");
  });

  it("keeps the current row by id when the rows are reordered", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Table header="none" />);
    await user.click(row("cfprefsd"));
    // The same rows in reverse order: cfprefsd goes from second to fourth. It stays the
    // current row, and Down goes to the row that is now below it.
    const reversed = [...names].reverse();
    rerender(
      <Table
        header="none"
        getRowId={(index) => reversed[index] ?? index}
        getRowLabel={(index) => reversed[index] ?? ""}
        renderCell={(index, column) => (column.id === "name" ? reversed[index] : index)}
      />,
    );
    expect(selected()).toEqual(["cfprefsd"]);
    expect(row("cfprefsd")).toHaveAttribute("data-row", "3");
    expect(grid()).toHaveAttribute("aria-activedescendant", row("cfprefsd").id);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["Activity Monitor"]);
  });

  it("lets onRowKeyDown move the selection or keep a key", async () => {
    const user = userEvent.setup();
    const onRowKeyDown = vi.fn((index: number, event: { key: string; preventDefault(): void }) => {
      if (event.key === "ArrowRight") return index + 2;
      if (event.key === "ArrowDown") event.preventDefault();
      return undefined;
    });
    render(<Table header="none" defaultValue={["cfprefsd"]} onRowKeyDown={onRowKeyDown} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onRowKeyDown).toHaveBeenCalledWith(1, expect.objectContaining({ key: "ArrowRight" }));
    expect(selected()).toEqual(["loginwindow"]);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["loginwindow"]);
    await user.keyboard("{ArrowUp}");
    expect(selected()).toEqual(["Finder"]);
  });

  it("does not treat a double click on a control in a cell as a row action", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <Table
        header="none"
        onRowAction={onRowAction}
        renderCell={(index, column) =>
          column.id === "name" ? <button type="button">Open {names[index]}</button> : null
        }
      />,
    );
    await user.dblClick(screen.getByRole("button", { name: "Open Finder" }));
    expect(onRowAction).not.toHaveBeenCalled();
    expect(selected()).toEqual([]);
  });

  it("lets the caller's handlers cancel selection and keys", async () => {
    const user = userEvent.setup();
    render(
      <Table
        header="none"
        onMouseDown={(event) => event.preventDefault()}
        onKeyDown={(event) => event.preventDefault()}
      />,
    );
    await user.click(row("Finder"));
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual([]);
  });

  it("forwards ref, className, style and attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Table ref={ref} className="extra" id="table" style={{ height: 200 }} />);
    expect(ref.current).toBe(grid());
    expect(grid()).toHaveClass("mac-table-view", "extra");
    expect(grid()).toHaveAttribute("id", "table");
    expect(grid().style.height).toBe("200px");
  });
});

// A row out of view is not rendered, so the grid cannot name it: the current row is brought
// into view when the keyboard focus arrives and when it changes under the focus.
describe("TableView, a current row out of view", () => {
  const long = (props: Partial<TableViewProps>) => (
    <TableView
      aria-label="Processes"
      columns={columns}
      rowCount={10000}
      renderCell={(row) => `Row ${row}`}
      {...props}
    />
  );
  const body = () => grid().firstElementChild as HTMLElement;

  it("scrolls to the selected row when the keyboard focus arrives", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(long({ defaultValue: [500], onFocus }));
    expect(body().scrollTop).toBe(0);
    await user.tab();
    expect(grid()).toHaveFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    // jsdom has no layout, so the row goes to the top of the scrolling element.
    expect(body().scrollTop).toBe(500 * 19);
  });

  it("renders the row it scrolled to and names it at once", async () => {
    const user = userEvent.setup();
    // Stand-in for layout: a 119 pt view shows five 19 pt rows under the 24 pt header.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(119);
    render(long({ defaultValue: [500] }));
    expect(grid().querySelector('[data-row="500"]')).toBeNull();
    expect(grid()).not.toHaveAttribute("aria-activedescendant");
    await user.tab();
    // The row is the last one in view: its bottom is at the view's bottom.
    expect(body().scrollTop).toBe(500 * 19 + 19 + 24 - 119);
    const current = grid().querySelector<HTMLElement>('[data-row="500"]');
    expect(current).toHaveAttribute("aria-selected", "true");
    expect(grid()).toHaveAttribute("aria-activedescendant", current?.id);
  });

  it("keeps the current row in view when the row height changes under the focus", async () => {
    const user = userEvent.setup();
    const { rerender } = render(long({ defaultValue: [500] }));
    await user.tab();
    rerender(long({ defaultValue: [500], rowHeight: 30 }));
    expect(body().scrollTop).toBe(500 * 30);
  });

  it("leaves a press on the label of a control inside a cell to the control", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <Table
        defaultValue={["Finder"]}
        onRowAction={onRowAction}
        renderCell={(row, column) =>
          column.id === "name" ? (
            <label>
              <input type="checkbox" />
              Watch {names[row]}
            </label>
          ) : (
            row
          )
        }
      />,
    );
    await user.dblClick(screen.getByText("Watch cfprefsd"));
    expect(selected()).toEqual(["Watch Finder"]);
    expect(onRowAction).not.toHaveBeenCalled();
  });

  it("leaves a press on editable text inside a cell to the text", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <Table
        defaultValue={["Finder"]}
        onRowAction={onRowAction}
        renderCell={(row, column) =>
          column.id === "name" ? (
            <span contentEditable suppressContentEditableWarning>
              Edit {names[row]}
            </span>
          ) : (
            row
          )
        }
      />,
    );
    // The press is not cancelled, so the caret can go where it was pressed.
    expect(fireEvent.mouseDown(screen.getByText("Edit cfprefsd"))).toBe(true);
    await user.dblClick(screen.getByText("Edit cfprefsd"));
    expect(selected()).toEqual(["Edit Finder"]);
    expect(onRowAction).not.toHaveBeenCalled();
  });

  it("treats text inside a cell that is marked not editable as the row", async () => {
    const user = userEvent.setup();
    const onRowAction = vi.fn();
    render(
      <Table
        defaultValue={["Finder"]}
        onRowAction={onRowAction}
        renderCell={(row, column) =>
          column.id === "name" ? <span contentEditable={false}>Fixed {names[row]}</span> : row
        }
      />,
    );
    expect(screen.getByText("Fixed cfprefsd")).toHaveAttribute("contenteditable", "false");
    await user.dblClick(screen.getByText("Fixed cfprefsd"));
    expect(selected()).toEqual(["Fixed cfprefsd"]);
    expect(onRowAction).toHaveBeenCalledTimes(1);
  });

  it("tells a row with a number for an id from one with the same digits as text", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Table rowCount={2} getRowId={(row) => (row ? "1" : 1)} defaultValue={["1"]} />);
    expect(selected()).toEqual(["cfprefsd"]);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("names the active row by its own id, whatever getRowProps gives", async () => {
    const user = userEvent.setup();
    render(<Table getRowProps={(row) => ({ id: `mine-${row}`, title: `Row ${row}` })} />);
    await user.click(row("Finder"));
    expect(row("Finder")).toHaveAttribute("title", "Row 2");
    expect(grid()).toHaveAttribute("aria-activedescendant", row("Finder").id);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["loginwindow"]);
  });

  it("follows a selection set from outside while it has the focus, and not without it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(long({ value: [1] }));
    rerender(long({ value: [300] }));
    expect(body().scrollTop).toBe(0);
    await user.tab();
    body().scrollTop = 0;
    rerender(long({ value: [700] }));
    expect(body().scrollTop).toBe(700 * 19);
  });

  it("keeps the selected row under a header that has a top border", async () => {
    const user = userEvent.setup();
    const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(215);
    render(long({ defaultValue: [500], headerProps: { topBorder: true } }));
    await user.tab();
    // The row's lower edge at the view's: 25 pt of header, and not 24, are counted.
    expect(body().scrollTop).toBe(500 * 19 + 19 + 25 - 215);
    height.mockRestore();
  });
});

describe("TableView, its header and its scrolling element", () => {
  const header = () => screen.getAllByRole("row")[0] as HTMLElement;

  it("draws the translucent header", () => {
    render(<Table header="translucent" />);
    expect(header()).toHaveClass("mac-table-header", "mac-table-view-header");
    expect(header()).toHaveAttribute("data-variant", "translucent");
    expect(grid()).toHaveAttribute("aria-rowcount", "6");
  });

  it("passes headerProps to the header it renders, and keeps its own class and variant", () => {
    render(
      <Table
        header="plain"
        headerProps={{
          topBorder: true,
          id: "head",
          style: { opacity: 0.5 },
          "aria-label": "Columns",
        }}
      />,
    );
    expect(header()).toHaveAttribute("data-top-border");
    expect(header()).toHaveAttribute("data-variant", "plain");
    expect(header()).toHaveClass("mac-table-view-header");
    expect(header()).toHaveAttribute("id", "head");
    expect(header()).toHaveAttribute("aria-label", "Columns");
    expect(header().style.opacity).toBe("0.5");
    // The headings are still the columns'.
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Process Name",
      "% CPU",
    ]);
  });

  it("has no top border on its header by default", () => {
    render(<Table />);
    expect(header()).not.toHaveAttribute("data-top-border");
    expect(header()).toHaveAttribute("data-variant", "standard");
  });

  it("gives the scrolling element to viewportRef, an object or a function", () => {
    const ref = createRef<HTMLDivElement>();
    const { unmount } = render(<Table viewportRef={ref} />);
    const viewport = within(grid()).getByRole("rowgroup");
    expect(ref.current).toBe(viewport);
    // It is the element the rows scroll in: the parent of what scrolls, and the grid's child.
    expect(ref.current).toBe(grid().querySelector(".mac-table-view-content")?.parentElement);
    expect(ref.current?.parentElement).toBe(grid());
    unmount();
    expect(ref.current).toBeNull();

    const seen: (HTMLDivElement | null)[] = [];
    const second = render(<Table viewportRef={(element) => void seen.push(element)} />);
    expect(seen).toEqual([within(grid()).getByRole("rowgroup")]);
    second.unmount();
    expect(seen[1]).toBeNull();
  });

  it("scrolls with the element viewportRef gives, and renders the rows there", () => {
    const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
    const ref = createRef<HTMLDivElement>();
    render(
      <TableView
        aria-label="Processes"
        columns={[{ id: "only" }]}
        rowCount={10000}
        renderCell={(index) => `Row ${index}`}
        rowHeight={20}
        viewportRef={ref}
      />,
    );
    expect(screen.queryByText("Row 5000")).toBeNull();
    const viewport = ref.current as HTMLDivElement;
    viewport.scrollTop = 5000 * 20;
    fireEvent.scroll(viewport);
    expect(screen.getByText("Row 5000")).toBeInTheDocument();
    expect(screen.queryByText("Row 0")).toBeNull();
    height.mockRestore();
  });

  it("leaves the grid's own ref on the root", () => {
    const root = createRef<HTMLDivElement>();
    const viewport = createRef<HTMLDivElement>();
    render(<Table ref={root} viewportRef={viewport} />);
    expect(root.current).toBe(grid());
    expect(viewport.current).not.toBe(root.current);
  });
});

describe("TableViewCellText", () => {
  const long = "com.apple.account.AppleAccount.cloudkit-token";
  const parts = (element: HTMLElement) => [...element.children].map((part) => part.textContent);

  it("is one line that is cut at its end by default", () => {
    render(<TableViewCellText data-testid="text">{long}</TableViewCellText>);
    const text = screen.getByTestId("text");
    expect(text.tagName).toBe("SPAN");
    expect(text).toHaveClass("mac-table-view-cell-text");
    expect(text).not.toHaveAttribute("data-line-break-mode");
    expect(text).toHaveTextContent(long);
    // All of it is in the part that shrinks behind the ellipsis.
    expect(parts(text)).toEqual([long, ""]);
  });

  it("keeps the last 17 characters of a long text that is cut in its middle", () => {
    render(
      <TableViewCellText lineBreakMode="truncating-middle" data-testid="text">
        {long}
      </TableViewCellText>,
    );
    const text = screen.getByTestId("text");
    expect(text).toHaveAttribute("data-line-break-mode", "truncating-middle");
    expect(parts(text)).toEqual(["com.apple.account.AppleAccou", "nt.cloudkit-token"]);
    // The whole text stays in the document, in order.
    expect(text.textContent).toBe(long);
  });

  it("keeps no more than half of a short text, and the spaces at the cut", () => {
    render(
      <>
        <TableViewCellText lineBreakMode="truncating-middle" data-testid="even">
          BeaconStore.db
        </TableViewCellText>
        <TableViewCellText lineBreakMode="truncating-middle" data-testid="odd">
          New Folder
        </TableViewCellText>
        <TableViewCellText lineBreakMode="truncating-middle" data-testid="one">
          A
        </TableViewCellText>
        <TableViewCellText lineBreakMode="truncating-middle" data-testid="none">
          {""}
        </TableViewCellText>
      </>,
    );
    expect(parts(screen.getByTestId("even"))).toEqual(["BeaconS", "tore.db"]);
    expect(parts(screen.getByTestId("odd"))).toEqual(["New F", "older"]);
    expect(screen.getByTestId("odd").textContent).toBe("New Folder");
    // Half of one character is none: all of it can shrink behind the ellipsis.
    expect(parts(screen.getByTestId("one"))).toEqual(["A", ""]);
    expect(parts(screen.getByTestId("none"))).toEqual(["", ""]);
  });

  it("cuts between characters, never inside one that takes two code units", () => {
    const emoji = "\u{1F600}";
    const boundary = `${"a".repeat(20)}${emoji}${"b".repeat(16)}`;
    render(
      <>
        <TableViewCellText lineBreakMode="truncating-middle" data-testid="single">
          {emoji}
        </TableViewCellText>
        <TableViewCellText lineBreakMode="truncating-middle" data-testid="short">
          {`ab${emoji}cd`}
        </TableViewCellText>
        <TableViewCellText lineBreakMode="truncating-middle" data-testid="long">
          {boundary}
        </TableViewCellText>
        <TableViewCellText data-testid="tail">{`ab${emoji}`}</TableViewCellText>
      </>,
    );
    // One character, although it is two code units: none of it is kept apart.
    expect(parts(screen.getByTestId("single"))).toEqual([emoji, ""]);
    // Five characters keep two; counted in code units the cut would fall inside the emoji.
    expect(parts(screen.getByTestId("short"))).toEqual([`ab${emoji}`, "cd"]);
    // The seventeenth character from the end is the emoji, whole.
    expect(parts(screen.getByTestId("long"))).toEqual([
      "a".repeat(20),
      `${emoji}${"b".repeat(16)}`,
    ]);
    expect(screen.getByTestId("long").textContent).toBe(boundary);
    expect(parts(screen.getByTestId("tail"))).toEqual([`ab${emoji}`, ""]);
  });

  it("says truncating-tail when it is asked for", () => {
    render(
      <TableViewCellText lineBreakMode="truncating-tail" data-testid="text">
        {long}
      </TableViewCellText>,
    );
    expect(screen.getByTestId("text")).toHaveAttribute("data-line-break-mode", "truncating-tail");
    expect(parts(screen.getByTestId("text"))).toEqual([long, ""]);
  });

  it("forwards ref, className, style and attributes", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <TableViewCellText ref={ref} className="extra" id="name" title={long} style={{ width: 80 }}>
        {long}
      </TableViewCellText>,
    );
    expect(ref.current).toHaveClass("mac-table-view-cell-text", "extra");
    expect(ref.current).toHaveAttribute("id", "name");
    expect(ref.current).toHaveAttribute("title", long);
    expect(ref.current?.style.width).toBe("80px");
  });

  it("is the text of its cell in a table, beside an icon", () => {
    render(
      <Table
        renderCell={(index, column) =>
          column.id === "name" ? (
            <span style={{ display: "flex" }}>
              <svg aria-hidden="true" width="16" height="16" />
              <TableViewCellText lineBreakMode="truncating-middle">
                {names[index] ?? ""}
              </TableViewCellText>
            </span>
          ) : (
            index
          )
        }
      />,
    );
    // The cell holds the whole text, in order.
    const first = screen.getAllByRole("row")[1] as HTMLElement;
    expect(within(first).getAllByRole("gridcell")[0]?.textContent).toBe("Activity Monitor");
    expect(first.querySelector(".mac-table-view-cell-text")).toHaveAttribute(
      "data-line-break-mode",
      "truncating-middle",
    );
  });
});
