import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TableHeader,
  TableHeaderCell,
  type TableHeaderCellProps,
  type TableHeaderColumn,
  type TableHeaderProps,
} from "./index";

/**
 * jsdom has no layout: a heading is as wide as its inline `width` (100 pt without one). The
 * resize handle is dragged with a real pointer, and the focus ring and pressed fill are
 * checked, in Chromium by table-header.visual.json and visual/output/b7/browser/table-view.mjs.
 */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const width = Number.parseFloat(this.style.width) || 100;
    return { width, height: 23, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0 } as DOMRect;
  });
});

function Header(props: TableHeaderCellProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: the header is tested as ARIA rows on divs, as it ships
    <div role="table" aria-label="Files">
      <TableHeader data-testid="header">
        <TableHeaderCell {...props}>Name</TableHeaderCell>
        <TableHeaderCell>Kind</TableHeaderCell>
      </TableHeader>
    </div>
  );
}

const name = () => screen.getByRole("columnheader", { name: "Name" });
const resizer = () => name().querySelector(".mac-table-header-resizer") as HTMLElement;

describe("TableHeader", () => {
  describe("moving a column", () => {
    const COLUMNS: TableHeaderColumn[] = [
      { id: "a", title: "A", width: 100, sortable: true },
      { id: "b", title: "B", width: 100, sortable: true },
      { id: "c", title: "C", width: 100 },
    ];
    const setup = () => {
      const onColumnMove = vi.fn();
      const onSortChange = vi.fn();
      render(
        // biome-ignore lint/a11y/useSemanticElements: see Header
        <div role="table">
          <TableHeader columns={COLUMNS} onColumnMove={onColumnMove} onSortChange={onSortChange} />
        </div>,
      );
      return { onColumnMove, onSortChange };
    };
    const heading = (name: string) => screen.getByRole("columnheader", { name });
    /** The cells stand side by side, 100 pt each, the dragged one where its transform puts it. */
    const layOut = () => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
        this: HTMLElement,
      ) {
        const place = [...(this.parentElement?.children ?? [])].indexOf(this);
        const moved = Number.parseFloat(this.style.transform.slice("translateX(".length)) || 0;
        const left = place * 100 + moved;
        return { width: 100, left, x: left, right: left + 100 } as DOMRect;
      });
    };
    const drag = (cell: HTMLElement, to: number) => {
      fireEvent.pointerDown(cell, { pointerId: 1, button: 0, clientX: 0 });
      fireEvent.pointerMove(cell, { pointerId: 1, buttons: 1, clientX: to });
      fireEvent.pointerUp(cell, { pointerId: 1, clientX: to });
    };

    it("goes before the heading it is dropped ahead of", () => {
      const { onColumnMove } = setup();
      layOut();
      drag(heading("A"), 170);
      expect(onColumnMove).toHaveBeenCalledWith("a", "c");
      expect(heading("A")).not.toHaveAttribute("data-moving");
      expect(heading("A").style.transform).toBe("");
    });

    it("goes last past every heading", () => {
      const { onColumnMove } = setup();
      layOut();
      drag(heading("A"), 260);
      expect(onColumnMove).toHaveBeenCalledWith("a", null);
    });

    it("stays when it is let go in its own place, and a short press still sorts", async () => {
      const { onColumnMove, onSortChange } = setup();
      layOut();
      drag(heading("B"), 20);
      expect(onColumnMove).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "B" }));
      expect(onSortChange).toHaveBeenCalledWith({ column: "b", direction: "ascending" });
    });

    it("is not left under way by a release away from the headings", () => {
      const { onColumnMove } = setup();
      layOut();
      fireEvent.pointerDown(heading("A"), { pointerId: 1, button: 0, clientX: 0 });
      fireEvent.pointerUp(document.body, { pointerId: 1, clientX: 2 });
      drag(heading("B"), -170);
      expect(onColumnMove).toHaveBeenCalledWith("b", "a");
    });

    it("moves only the heading pressed, when a fast first move lands on another", () => {
      const { onColumnMove } = setup();
      layOut();
      fireEvent.pointerDown(heading("A"), { pointerId: 1, button: 0, clientX: 0 });
      fireEvent.pointerMove(heading("C"), { pointerId: 1, buttons: 1, clientX: 170 });
      expect(heading("A")).toHaveAttribute("data-moving");
      expect(heading("C")).not.toHaveAttribute("data-moving");
      fireEvent.pointerUp(heading("C"), { pointerId: 1, clientX: 170 });
      expect(onColumnMove).toHaveBeenCalledWith("a", "c");
    });

    const pressAndMove = () => {
      fireEvent.pointerDown(heading("A"), { pointerId: 1, button: 0, clientX: 0 });
      fireEvent.pointerMove(heading("A"), { pointerId: 1, buttons: 1, clientX: 170 });
      expect(heading("A")).toHaveAttribute("data-moving");
    };
    const putBack = () => {
      expect(heading("A")).not.toHaveAttribute("data-moving");
      expect(heading("A").style.transform).toBe("");
    };

    it("goes back when the window loses the pointer, and the next drag works", () => {
      const { onColumnMove } = setup();
      layOut();
      pressAndMove();
      fireEvent.blur(window);
      putBack();
      expect(onColumnMove).not.toHaveBeenCalled();
      drag(heading("B"), -170);
      expect(onColumnMove).toHaveBeenCalledWith("b", "a");
    });

    it("goes back when a later move shows the button was let go outside the browser", () => {
      const { onColumnMove } = setup();
      layOut();
      pressAndMove();
      fireEvent.pointerMove(document.body, { pointerId: 1, buttons: 0, clientX: 180 });
      putBack();
      expect(onColumnMove).not.toHaveBeenCalled();
      drag(heading("B"), -170);
      expect(onColumnMove).toHaveBeenCalledWith("b", "a");
    });

    it("goes back when the pointer capture is lost", () => {
      const { onColumnMove } = setup();
      layOut();
      pressAndMove();
      fireEvent.lostPointerCapture(heading("A"), { pointerId: 1 });
      putBack();
      expect(onColumnMove).not.toHaveBeenCalled();
    });

    it("keeps going when the capture a touch began on the heading's button passes to the heading", () => {
      const { onColumnMove } = setup();
      layOut();
      pressAndMove();
      fireEvent.lostPointerCapture(screen.getByRole("button", { name: "A" }), { pointerId: 1 });
      expect(heading("A")).toHaveAttribute("data-moving");
      fireEvent.pointerUp(heading("A"), { pointerId: 1, clientX: 170 });
      expect(onColumnMove).toHaveBeenCalledWith("a", "c");
    });

    it("goes back when moving is turned off, and drags again once it is on", () => {
      const onColumnMove = vi.fn();
      const table = (move?: typeof onColumnMove) => (
        // biome-ignore lint/a11y/useSemanticElements: see Header
        <div role="table">
          <TableHeader columns={COLUMNS} onColumnMove={move} />
        </div>
      );
      const { rerender } = render(table(onColumnMove));
      layOut();
      pressAndMove();
      rerender(table());
      putBack();
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 170 });
      expect(onColumnMove).not.toHaveBeenCalled();
      rerender(table(onColumnMove));
      drag(heading("B"), -170);
      expect(onColumnMove).toHaveBeenCalledWith("b", "a");
    });

    it("acts at its end on the columns and the callback current then", () => {
      const first = vi.fn();
      const second = vi.fn();
      const table = (columns: TableHeaderColumn[], move: typeof first) => (
        // biome-ignore lint/a11y/useSemanticElements: see Header
        <div role="table">
          <TableHeader columns={columns} onColumnMove={move} />
        </div>
      );
      const { rerender } = render(table(COLUMNS, first));
      layOut();
      pressAndMove();
      // C has swapped places with B while the drag goes on: A now lands before B.
      const swapped = [COLUMNS[0], COLUMNS[2], COLUMNS[1]] as TableHeaderColumn[];
      rerender(table(swapped, second));
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 170 });
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith("a", "b");
    });

    it("captures the pointer only once the heading moves, so a click still reaches its button", () => {
      setup();
      layOut();
      const capture = vi.fn();
      heading("A").setPointerCapture = capture;
      fireEvent.pointerDown(heading("A"), { pointerId: 1, button: 0, clientX: 0 });
      fireEvent.pointerMove(heading("A"), { pointerId: 1, buttons: 1, clientX: 2 });
      expect(capture).not.toHaveBeenCalled();
      fireEvent.pointerMove(heading("A"), { pointerId: 1, buttons: 1, clientX: 20 });
      expect(capture).toHaveBeenCalledWith(1);
      fireEvent.pointerUp(heading("A"), { pointerId: 1, clientX: 20 });
    });

    it("hears nothing more once the table is gone", () => {
      const onColumnMove = vi.fn();
      const { unmount } = render(
        // biome-ignore lint/a11y/useSemanticElements: see Header
        <div role="table">
          <TableHeader columns={COLUMNS} onColumnMove={onColumnMove} />
        </div>,
      );
      layOut();
      pressAndMove();
      unmount();
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 170 });
      expect(onColumnMove).not.toHaveBeenCalled();
    });

    it("does not sort with the click that ends a drag", () => {
      const { onSortChange } = setup();
      layOut();
      drag(heading("A"), 170);
      fireEvent.click(screen.getByRole("button", { name: "A" }));
      expect(onSortChange).not.toHaveBeenCalled();
    });

    it("moves with Option-Shift-Arrow, and not past the ends", () => {
      const { onColumnMove } = setup();
      fireEvent.keyDown(heading("B"), { key: "ArrowLeft", altKey: true, shiftKey: true });
      expect(onColumnMove).toHaveBeenLastCalledWith("b", "a");
      fireEvent.keyDown(heading("B"), { key: "ArrowRight", altKey: true, shiftKey: true });
      expect(onColumnMove).toHaveBeenLastCalledWith("b", null);
      onColumnMove.mockClear();
      fireEvent.keyDown(heading("A"), { key: "ArrowLeft", altKey: true, shiftKey: true });
      fireEvent.keyDown(heading("C"), { key: "ArrowRight", altKey: true, shiftKey: true });
      expect(onColumnMove).not.toHaveBeenCalled();
    });

    it("makes a heading that neither sorts nor resizes a tab stop", () => {
      setup();
      expect(heading("C")).toHaveAttribute("tabindex", "0");
      expect(heading("A")).not.toHaveAttribute("tabindex");
    });
  });
  it("renders a row of column headers", () => {
    render(<Header />);
    const header = screen.getByTestId("header");
    expect(header).toHaveAttribute("role", "row");
    expect(header).toHaveClass("mac-table-header");
    expect(header).toHaveAttribute("data-variant", "standard");
    expect(header).not.toHaveAttribute("data-top-border");
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Name",
      "Kind",
    ]);
  });

  it("reflects variant and top border", () => {
    render(
      // biome-ignore lint/a11y/useSemanticElements: see Header
      <div role="table">
        <TableHeader variant="plain" topBorder data-testid="header" />
      </div>,
    );
    expect(screen.getByTestId("header")).toHaveAttribute("data-variant", "plain");
    expect(screen.getByTestId("header")).toHaveAttribute("data-top-border");
  });

  it("forwards ref, className, style and attributes on the row", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      // biome-ignore lint/a11y/useSemanticElements: see Header
      <div role="table">
        <TableHeader ref={ref} className="extra" id="header" style={{ width: 300 }} />
      </div>,
    );
    expect(ref.current).toHaveClass("mac-table-header", "extra");
    expect(ref.current).toHaveAttribute("id", "header");
    expect(ref.current?.style.width).toBe("300px");
  });

  it("reflects the translucent variant", () => {
    render(
      // biome-ignore lint/a11y/useSemanticElements: see Header
      <div role="table">
        <TableHeader variant="translucent" data-testid="header" />
      </div>,
    );
    expect(screen.getByTestId("header")).toHaveAttribute("data-variant", "translucent");
  });
});

describe("TableHeader with columns", () => {
  const columns: TableHeaderColumn[] = [
    { id: "name", title: "Name", width: 200, minWidth: 80, maxWidth: 300, sortable: true },
    { id: "kind", title: "Kind", width: 120, align: "right", headerAlign: "center" },
    { id: "size", title: "Size", align: "right", sortable: true },
  ];
  const List = (props: Partial<TableHeaderProps>) => (
    // biome-ignore lint/a11y/useSemanticElements: see Header
    <div role="table" aria-label="Files">
      <TableHeader columns={columns} {...props} />
    </div>
  );
  const heading = (title: string) => screen.getByRole("columnheader", { name: title });

  it("draws a heading per column, in place of its children", () => {
    render(
      <List>
        <TableHeaderCell>Ignored</TableHeaderCell>
      </List>,
    );
    const cells = screen.getAllByRole("columnheader");
    expect(cells.map((cell) => cell.textContent)).toEqual(["Name", "Kind", "Size"]);
    expect(cells.map((cell) => cell.style.width)).toEqual(["200px", "120px", ""]);
    // A heading is aligned as its column, or on its own with headerAlign.
    expect(cells.map((cell) => cell.getAttribute("data-align"))).toEqual([
      "left",
      "center",
      "right",
    ]);
    // Only a sortable heading is a button, and none is sorted or resizable yet.
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Name",
      "Size",
    ]);
    expect(cells.map((cell) => cell.getAttribute("aria-sort"))).toEqual(["none", null, "none"]);
    expect(document.querySelector(".mac-table-header-resizer")).toBeNull();
  });

  it("shows the sorted column and reports the next order of a heading that is clicked", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const { rerender } = render(
      <List sort={{ column: "name", direction: "ascending" }} onSortChange={onSortChange} />,
    );
    expect(heading("Name")).toHaveAttribute("aria-sort", "ascending");
    expect(heading("Size")).toHaveAttribute("aria-sort", "none");
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "descending" });
    await user.click(screen.getByRole("button", { name: "Size" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "size", direction: "ascending" });

    rerender(
      <List sort={{ column: "name", direction: "descending" }} onSortChange={onSortChange} />,
    );
    expect(heading("Name")).toHaveAttribute("aria-sort", "descending");
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "ascending" });
  });

  it("resizes the columns that have a width, within their limits", async () => {
    const user = userEvent.setup();
    const onColumnResize = vi.fn();
    render(<List onColumnResize={onColumnResize} />);
    // Name and Kind have a width and so a handle; Size shares what is left.
    expect(document.querySelectorAll(".mac-table-header-resizer")).toHaveLength(2);
    expect(heading("Size").querySelector(".mac-table-header-resizer")).toBeNull();
    screen.getByRole("button", { name: "Name" }).focus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onColumnResize).toHaveBeenLastCalledWith("name", 210);
    heading("Kind").focus();
    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(onColumnResize).toHaveBeenLastCalledWith("kind", 110);
  });

  it("keeps its children when it has no columns", () => {
    render(<Header />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });
});

describe("TableHeaderCell", () => {
  it("is a plain heading by default: left-aligned, not sorted, not focusable", () => {
    render(<Header />);
    expect(name()).toHaveClass("mac-table-header-cell");
    expect(name()).toHaveAttribute("data-align", "left");
    expect(name()).not.toHaveAttribute("aria-sort");
    expect(name()).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("button")).toBeNull();
    expect(name().querySelector(".mac-table-header-indicator")).toBeNull();
    expect(resizer()).toBeNull();
  });

  it("reflects the alignment", () => {
    render(<Header align="center" />);
    expect(name()).toHaveAttribute("data-align", "center");
  });

  it("sets a width that does not flex", () => {
    render(<Header width={120} style={{ color: "red" }} />);
    expect(name().style.width).toBe("120px");
    expect(name().style.flex).toBe("0 0 auto");
    expect(name().style.color).toBe("red");
  });

  it("makes a sortable heading a button that calls onSort on click, Return and Space", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(<Header onSort={onSort} />);
    expect(name()).toHaveAttribute("aria-sort", "none");
    const button = screen.getByRole("button", { name: "Name" });
    await user.click(button);
    expect(onSort).toHaveBeenCalledTimes(1);
    await user.tab();
    await user.tab({ shift: true });
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onSort).toHaveBeenCalledTimes(3);
  });

  it("announces the sort direction and draws the indicator", () => {
    const { rerender } = render(<Header sortDirection="ascending" onSort={() => {}} />);
    expect(name()).toHaveAttribute("aria-sort", "ascending");
    const indicator = name().querySelector(".mac-table-header-indicator");
    expect(indicator).toHaveAttribute("data-direction", "ascending");
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    rerender(<Header sortDirection="descending" />);
    expect(name()).toHaveAttribute("aria-sort", "descending");
    expect(name().querySelector(".mac-table-header-indicator")).toHaveAttribute(
      "data-direction",
      "descending",
    );
    // The indicator is not part of the heading's name.
    expect(name()).toHaveAccessibleName("Name");
  });

  it("resizes while its trailing edge is dragged, within the limits", () => {
    const onResize = vi.fn();
    render(<Header width={100} minWidth={60} maxWidth={150} onResize={onResize} />);
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 100, pointerId: 1 });
    expect(resizer()).toHaveAttribute("data-dragging");
    fireEvent.pointerMove(resizer(), { clientX: 125, pointerId: 1 });
    fireEvent.pointerMove(resizer(), { clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(resizer(), { clientX: 10, pointerId: 1 });
    fireEvent.lostPointerCapture(resizer(), { pointerId: 1 });
    expect(resizer()).not.toHaveAttribute("data-dragging");
    fireEvent.pointerMove(resizer(), { clientX: 130, pointerId: 1 });
    expect(onResize.mock.calls.map(([width]) => width)).toEqual([125, 150, 60]);
  });

  it("does not report a drag that leaves the width unchanged, or another mouse button", () => {
    const onResize = vi.fn();
    render(<Header width={100} onResize={onResize} />);
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(resizer(), { clientX: 100, pointerId: 1 });
    fireEvent.lostPointerCapture(resizer(), { pointerId: 1 });
    fireEvent.pointerDown(resizer(), { button: 2, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(resizer(), { clientX: 140, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it("leaves a press or a move that an ancestor cancelled on the way down alone", () => {
    const onResize = vi.fn();
    const { rerender } = render(
      <div onPointerDownCapture={(event) => event.preventDefault()}>
        <Header width={100} onResize={onResize} />
      </div>,
    );
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 100, pointerId: 1 });
    expect(resizer()).not.toHaveAttribute("data-dragging");
    fireEvent.pointerMove(resizer(), { clientX: 130, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
    rerender(
      <div onPointerMoveCapture={(event) => event.preventDefault()}>
        <Header width={100} onResize={onResize} />
      </div>,
    );
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 100, pointerId: 1 });
    expect(resizer()).toHaveAttribute("data-dragging");
    fireEvent.pointerMove(resizer(), { clientX: 130, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it("resizes with Option-Arrow on the focused sort button", async () => {
    const user = userEvent.setup();
    const onResize = vi.fn();
    render(<Header width={100} minWidth={95} onSort={() => {}} onResize={onResize} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Name" })).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onResize).toHaveBeenLastCalledWith(110);
    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(onResize).toHaveBeenLastCalledWith(95);
    // Without Option the arrows are left alone.
    await user.keyboard("{ArrowRight}");
    expect(onResize).toHaveBeenCalledTimes(2);
  });

  it("makes a heading that can only be resized the tab stop for that", async () => {
    const user = userEvent.setup();
    const onResize = vi.fn();
    render(<Header width={100} onResize={onResize} />);
    expect(name()).toHaveAttribute("tabindex", "0");
    await user.tab();
    expect(name()).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(onResize).toHaveBeenLastCalledWith(110);
  });

  it("lets the caller's onKeyDown cancel the keyboard resize", () => {
    const onResize = vi.fn();
    render(
      <Header width={100} onResize={onResize} onKeyDown={(event) => event.preventDefault()} />,
    );
    fireEvent.keyDown(name(), { key: "ArrowRight", altKey: true });
    expect(onResize).not.toHaveBeenCalled();
  });

  it("forwards ref, className and attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Header ref={ref} className="extra" id="name" />);
    expect(ref.current).toBe(name());
    expect(name()).toHaveClass("mac-table-header-cell", "extra");
    expect(name()).toHaveAttribute("id", "name");
  });

  it("lets the caller's own pointer handlers cancel a drag of the edge", () => {
    const onResize = vi.fn();
    const onPointerDown = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const { unmount } = render(
      <Header width={100} onResize={onResize} onPointerDown={onPointerDown} />,
    );
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 100, pointerId: 1 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(resizer()).not.toHaveAttribute("data-dragging");
    fireEvent.pointerMove(resizer(), { clientX: 130, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
    unmount();
    const onPointerMove = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(<Header width={100} onResize={onResize} onPointerMove={onPointerMove} />);
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 100, pointerId: 1 });
    expect(resizer()).toHaveAttribute("data-dragging");
    fireEvent.pointerMove(resizer(), { clientX: 130, pointerId: 1 });
    expect(onPointerMove).toHaveBeenCalledTimes(1);
    expect(onResize).not.toHaveBeenCalled();
  });

  it("lets only the pointer that started a drag of the edge move it or end it", () => {
    const onResize = vi.fn();
    render(<Header width={100} onResize={onResize} />);
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(resizer(), { clientX: 160, pointerId: 2 });
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 160, pointerId: 2 });
    fireEvent.lostPointerCapture(resizer(), { pointerId: 2 });
    expect(onResize).not.toHaveBeenCalled();
    expect(resizer()).toHaveAttribute("data-dragging");
    fireEvent.pointerMove(resizer(), { clientX: 125, pointerId: 1 });
    expect(onResize).toHaveBeenLastCalledWith(125);
    fireEvent.lostPointerCapture(resizer(), { pointerId: 1 });
    expect(resizer()).not.toHaveAttribute("data-dragging");
  });

  it("forgets a drag whose handle went away with onResize", () => {
    const onResize = vi.fn();
    const { rerender } = render(<Header width={100} onResize={onResize} />);
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 100, pointerId: 1 });
    rerender(<Header width={100} />);
    rerender(<Header width={100} onResize={onResize} />);
    // Another pointer can drag the new handle: the old drag is not still under way.
    fireEvent.pointerDown(resizer(), { button: 0, clientX: 100, pointerId: 2 });
    expect(resizer()).toHaveAttribute("data-dragging");
    fireEvent.pointerMove(resizer(), { clientX: 130, pointerId: 2 });
    expect(onResize).toHaveBeenLastCalledWith(130);
  });

  it("starts no drag from a press on the heading itself", () => {
    const onResize = vi.fn();
    render(<Header width={100} onResize={onResize} />);
    fireEvent.pointerDown(name(), { button: 0, clientX: 50, pointerId: 1 });
    fireEvent.pointerMove(name(), { clientX: 90, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
  });
});
