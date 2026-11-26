import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ColumnView, type ColumnViewItem, ColumnViewPanel, type ColumnViewProps } from "./index";

/**
 * jsdom has no layout: scrolling a row into view, the horizontal scroll to the newest column,
 * dragging with pointer capture and right-to-left are exercised in Chromium by
 * visual/output/b7/browser/column-view.mjs, and the looks by column-view.visual.json.
 */
const tree: Record<string, ColumnViewItem[]> = {
  root: [
    { id: "apps", label: "Applications", hasChildren: true },
    { id: "docs", label: "Documents", hasChildren: true },
    { id: "note", label: "Note.txt" },
    { id: "empty", label: "Empty", hasChildren: true },
  ],
  apps: [
    { id: "mail", label: "Mail" },
    { id: "maps", label: "Maps" },
    { id: "notes", label: "Notes" },
  ],
  docs: [
    { id: "letters", label: "Letters", hasChildren: true },
    { id: "budget", label: "Budget" },
  ],
  letters: [{ id: "draft", label: "Draft" }],
  empty: [],
};
const getChildren = (id: string | number | null) => tree[id ?? "root"];

function View(props: Partial<ColumnViewProps>) {
  return <ColumnView aria-label="Files" getChildren={getChildren} {...props} />;
}

// Base UI's scroll area measures in a microtask after it mounts.
async function show(props: Partial<ColumnViewProps> = {}) {
  const result = render(<View {...props} />);
  await act(async () => {});
  return result;
}

const columns = () => screen.getAllByRole("listbox");
const column = (name: string) => screen.getByRole("listbox", { name });
const option = (name: string) => screen.getByRole("option", { name });
const selected = () =>
  columns().map(
    (list) => within(list).queryByRole("option", { selected: true })?.textContent ?? null,
  );

describe("ColumnView", () => {
  it("renders the root column as a listbox in a named group", async () => {
    await show();
    const group = screen.getByRole("group", { name: "Files" });
    expect(group).toHaveClass("mac-column-view");
    expect(columns()).toHaveLength(1);
    expect(column("Files")).toHaveAttribute("tabindex", "0");
    const options = screen.getAllByRole("option");
    expect(options.map((row) => row.textContent)).toEqual([
      "Applications",
      "Documents",
      "Note.txt",
      "Empty",
    ]);
    expect(options[0]).toHaveAttribute("aria-setsize", "4");
    expect(options[1]).toHaveAttribute("aria-posinset", "2");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    // Containers carry the triangle; leaves do not.
    expect(options[0]).toHaveAttribute("data-children");
    expect(options[2]).not.toHaveAttribute("data-children");
  });

  it("shows one column per level of the default path, each named after its parent", async () => {
    await show({ defaultPath: ["docs", "letters"] });
    expect(columns().map((list) => list.getAttribute("aria-label"))).toEqual([
      "Files",
      "Documents",
      "Letters",
    ]);
    expect(selected()).toEqual(["Documents", "Letters", null]);
    // One tab stop: the column of the last item on the path.
    expect(columns().map((list) => list.tabIndex)).toEqual([-1, 0, -1]);
    expect(column("Documents")).toHaveAttribute("aria-activedescendant", option("Letters").id);
  });

  it("opens a container's column on click and reports the path", async () => {
    const user = userEvent.setup();
    const onPathChange = vi.fn();
    await show({ onPathChange });
    await user.click(option("Documents"));
    expect(onPathChange).toHaveBeenLastCalledWith(["docs"]);
    expect(selected()).toEqual(["Documents", null]);
    expect(column("Files")).toHaveFocus();
    await user.click(option("Letters"));
    expect(onPathChange).toHaveBeenLastCalledWith(["docs", "letters"]);
    expect(column("Documents")).toHaveFocus();
    // A click in an earlier column cuts the path there.
    await user.click(option("Applications"));
    expect(onPathChange).toHaveBeenLastCalledWith(["apps"]);
    expect(columns().map((list) => list.getAttribute("aria-label"))).toEqual([
      "Files",
      "Applications",
    ]);
  });

  it("shows an empty column for a container without items", async () => {
    const user = userEvent.setup();
    await show();
    await user.click(option("Empty"));
    expect(within(column("Empty")).queryAllByRole("option")).toHaveLength(0);
  });

  it("clears a column's selection on a click under its rows", async () => {
    const onPathChange = vi.fn();
    await show({ defaultPath: ["docs", "budget"], onPathChange });
    fireEvent.mouseDown(column("Documents"));
    expect(onPathChange).toHaveBeenLastCalledWith(["docs"]);
    expect(selected()).toEqual(["Documents", null]);
    fireEvent.mouseDown(column("Files"));
    expect(onPathChange).toHaveBeenLastCalledWith([]);
    expect(columns()).toHaveLength(1);
  });

  it("ignores other mouse buttons", async () => {
    const onPathChange = vi.fn();
    await show({ onPathChange });
    fireEvent.mouseDown(option("Documents"), { button: 2 });
    expect(onPathChange).not.toHaveBeenCalled();
  });

  it("is controlled by path", async () => {
    const user = userEvent.setup();
    const onPathChange = vi.fn();
    const { rerender } = await show({ path: ["apps"], onPathChange });
    await user.click(option("Documents"));
    expect(onPathChange).toHaveBeenCalledWith(["docs"]);
    expect(selected()).toEqual(["Applications", null]);
    rerender(<View path={["docs", "budget"]} onPathChange={onPathChange} />);
    expect(selected()).toEqual(["Documents", "Budget"]);
  });

  it("shows the preview column for a leaf, and none without renderPreview", async () => {
    const user = userEvent.setup();
    const renderPreview = vi.fn((item: ColumnViewItem) => <p>About {item.label}</p>);
    const { unmount } = await show({ renderPreview });
    expect(screen.queryByText(/About/)).not.toBeInTheDocument();
    await user.click(option("Note.txt"));
    await act(async () => {});
    expect(screen.getByText("About Note.txt")).toBeInTheDocument();
    expect(renderPreview).toHaveBeenLastCalledWith(tree.root?.[2]);
    // A container shows its children instead.
    await user.click(option("Documents"));
    expect(screen.queryByText(/About/)).not.toBeInTheDocument();
    unmount();
    const { container } = await show({ defaultPath: ["note"] });
    expect(container.querySelector(".mac-column-view-preview")).toBeNull();
  });

  it("shows the preview for a container that has nothing to list", async () => {
    await show({
      getChildren: (id) => (id === null ? tree.root : null),
      defaultPath: ["apps"],
      renderPreview: (item) => <p>{item.label} is not connected</p>,
    });
    await act(async () => {});
    expect(columns()).toHaveLength(1);
    expect(screen.getByText("Applications is not connected")).toBeInTheDocument();
  });

  it("moves within a column with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    const onPathChange = vi.fn();
    await show({ onPathChange });
    await user.tab();
    expect(column("Files")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["Applications", null]);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(selected()).toEqual(["Note.txt"]);
    await user.keyboard("{ArrowUp}");
    expect(onPathChange).toHaveBeenLastCalledWith(["docs"]);
    await user.keyboard("{End}");
    expect(selected()).toEqual(["Empty", null]);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["Empty", null]);
    await user.keyboard("{Home}");
    expect(selected()).toEqual(["Applications", null]);
    expect(column("Files")).toHaveFocus();
  });

  it("enters the child column with Right Arrow and returns with Left Arrow", async () => {
    const user = userEvent.setup();
    const onPathChange = vi.fn();
    await show({ defaultPath: ["docs"], onPathChange });
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onPathChange).toHaveBeenLastCalledWith(["docs", "letters"]);
    expect(column("Documents")).toHaveFocus();
    expect(columns().map((list) => list.tabIndex)).toEqual([-1, 0, -1]);
    await user.keyboard("{ArrowRight}");
    expect(selected()).toEqual(["Documents", "Letters", "Draft"]);
    expect(column("Letters")).toHaveFocus();
    // A leaf has no column to enter.
    await user.keyboard("{ArrowRight}");
    expect(onPathChange).toHaveBeenLastCalledWith(["docs", "letters", "draft"]);
    await user.keyboard("{ArrowLeft}");
    expect(onPathChange).toHaveBeenLastCalledWith(["docs", "letters"]);
    expect(column("Documents")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toEqual(["Documents", null]);
    expect(column("Files")).toHaveFocus();
    // The root has no parent.
    await user.keyboard("{ArrowLeft}");
    expect(onPathChange).toHaveBeenLastCalledWith(["docs"]);
  });

  it("does not enter an empty column", async () => {
    const user = userEvent.setup();
    await show({ defaultPath: ["empty"] });
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(column("Files")).toHaveFocus();
    expect(selected()).toEqual(["Empty", null]);
  });

  it("selects by typing, within the focused column", async () => {
    const user = userEvent.setup();
    await show({ defaultPath: ["apps", "mail"] });
    await user.tab();
    expect(column("Applications")).toHaveFocus();
    await user.keyboard("no");
    expect(selected()).toEqual(["Applications", "Notes"]);
    await user.keyboard("{ArrowLeft}");
    await user.keyboard("d");
    expect(selected()).toEqual(["Documents", null]);
  });

  it("calls onItemAction on Return and on a double click", async () => {
    const user = userEvent.setup();
    const onItemAction = vi.fn();
    await show({ defaultPath: ["docs", "budget"], onItemAction });
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onItemAction).toHaveBeenLastCalledWith(tree.docs?.[1]);
    await user.dblClick(option("Note.txt"));
    expect(onItemAction).toHaveBeenLastCalledWith(tree.root?.[2]);
    expect(onItemAction).toHaveBeenCalledTimes(2);
  });

  it("renders only the rows in view of a long column", async () => {
    const many = Array.from({ length: 5000 }, (_, index) => ({
      id: index,
      label: `Item ${index}`,
    }));
    const user = userEvent.setup();
    const onPathChange = vi.fn();
    await show({ getChildren: () => many, onPathChange });
    // Without layout the first 40 rows are rendered.
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(40);
    expect(options[0]).toHaveAttribute("aria-setsize", "5000");
    await user.tab();
    await user.keyboard("{End}");
    expect(onPathChange).toHaveBeenLastCalledWith([4999]);
    // The row is brought into view: 4999 rows of 18 pt above it.
    expect(column("Files").scrollTop).toBe(4999 * 18);
  });

  it("gives columns the default width or their own", async () => {
    const { container } = await show({
      defaultPath: ["docs", "budget"],
      columnWidth: 180,
      defaultColumnWidths: [120],
      renderPreview: () => "Preview",
    });
    const widths = [
      ...container.querySelectorAll<HTMLElement>(
        ".mac-column-view-column, .mac-column-view-preview",
      ),
    ].map((element) => element.style.width);
    expect(widths).toEqual(["120px", "180px", "180px"]);
    expect(container.querySelectorAll(".mac-column-view-divider")).toHaveLength(3);
  });

  it("resizes a column while its divider is dragged", async () => {
    const onColumnWidthsChange = vi.fn();
    const { container } = await show({ defaultPath: ["docs"], onColumnWidthsChange });
    const divider = container.querySelectorAll(".mac-column-view-divider")[1] as HTMLElement;
    fireEvent.pointerDown(divider, { button: 0, buttons: 1, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(divider, { buttons: 1, clientX: 430, pointerId: 1 });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith([204, 234]);
    expect((divider.previousElementSibling as HTMLElement).style.width).toBe("234px");
    // Not under 60 pt.
    fireEvent.pointerMove(divider, { buttons: 1, clientX: 100, pointerId: 1 });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith([204, 60]);
    // Once the button is up, moving does nothing.
    fireEvent.pointerMove(divider, { buttons: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(divider, { buttons: 1, clientX: 500, pointerId: 1 });
    expect(onColumnWidthsChange).toHaveBeenCalledTimes(2);
  });

  it("lets only the pointer that started a drag of a divider move it", async () => {
    const onColumnWidthsChange = vi.fn();
    const { container } = await show({ defaultPath: ["docs"], onColumnWidthsChange });
    const divider = container.querySelectorAll(".mac-column-view-divider")[1] as HTMLElement;
    fireEvent.pointerDown(divider, { button: 0, buttons: 1, clientX: 400, pointerId: 1 });
    // A second touch moves nothing, and its press on a row does not end the drag.
    fireEvent.pointerMove(divider, { buttons: 1, clientX: 480, pointerId: 2 });
    fireEvent.pointerMove(divider, { buttons: 0, clientX: 480, pointerId: 2 });
    fireEvent.pointerDown(option("Budget"), { button: 0, buttons: 1, clientX: 300, pointerId: 2 });
    expect(onColumnWidthsChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(divider, { buttons: 1, clientX: 430, pointerId: 1 });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith([204, 234]);
    // The dragging pointer's own next press anywhere ends a drag whose release was not seen.
    fireEvent.pointerDown(option("Budget"), { button: 0, buttons: 1, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(divider, { buttons: 1, clientX: 500, pointerId: 1 });
    expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
  });

  it("keeps a divider's drag from a second pointer until the first lets go", async () => {
    const onColumnWidthsChange = vi.fn();
    const { container } = await show({ defaultPath: ["docs"], onColumnWidthsChange });
    const [first, second] = container.querySelectorAll<HTMLElement>(".mac-column-view-divider");
    if (!first || !second) throw new Error("two dividers expected");
    fireEvent.pointerDown(second, { button: 0, buttons: 1, clientX: 400, pointerId: 1 });
    // A second touch on another divider starts nothing and does not take the drag over.
    fireEvent.pointerDown(first, { button: 0, buttons: 1, clientX: 200, pointerId: 2 });
    fireEvent.pointerMove(first, { buttons: 1, clientX: 260, pointerId: 2 });
    expect(onColumnWidthsChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(second, { buttons: 1, clientX: 430, pointerId: 1 });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith([204, 234]);
    // The divider loses the first pointer when it is released: the second can drag now.
    fireEvent.lostPointerCapture(second, { pointerId: 2 });
    fireEvent.pointerDown(first, { button: 0, buttons: 1, clientX: 200, pointerId: 2 });
    fireEvent.pointerMove(first, { buttons: 1, clientX: 260, pointerId: 2 });
    expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
    fireEvent.lostPointerCapture(second, { pointerId: 1 });
    fireEvent.pointerDown(first, { button: 0, buttons: 1, clientX: 200, pointerId: 2 });
    fireEvent.pointerMove(first, { buttons: 1, clientX: 260, pointerId: 2 });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith([264, 234]);
  });

  it("tells an item with a number for an id from one with the same digits as text", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const items: ColumnViewItem[] = [
      { id: 1, label: "Number" },
      { id: "1", label: "Text" },
    ];
    await show({ getChildren: (id) => (id == null ? items : null) });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("gives a parent with a number for an id its own column, apart from one with the same digits as text", async () => {
    const child = (): ColumnViewItem[] => [
      { id: "x", label: "X", icon: <input aria-label="Note" /> },
    ];
    const lists: Record<string, ColumnViewItem[]> = { number: child(), string: child() };
    const root: ColumnViewItem[] = [
      { id: 1, label: "Number", hasChildren: true },
      { id: "1", label: "Text", hasChildren: true },
    ];
    const getChildren = (id: string | number | null) => (id == null ? root : lists[typeof id]);
    const { rerender } = await show({ getChildren, path: [1] });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "kept" } });
    rerender(<View getChildren={getChildren} path={["1"]} />);
    expect(screen.getByLabelText("Note")).toHaveValue("");
  });

  it("brings the selected row back into view when the keyboard focus arrives", async () => {
    const user = userEvent.setup();
    const many: ColumnViewItem[] = Array.from({ length: 500 }, (_, index) => ({
      id: index,
      label: `Item ${index}`,
    }));
    await show({ getChildren: (id) => (id == null ? many : null), defaultPath: [400] });
    // jsdom has no layout, so a row goes to the top of its column: rows are 18 pt.
    expect(column("Files").scrollTop).toBe(400 * 18);
    column("Files").scrollTop = 0;
    await user.tab();
    expect(column("Files")).toHaveFocus();
    expect(column("Files").scrollTop).toBe(400 * 18);
  });

  it("leaves a press on the label of a control inside an item to the control", async () => {
    const onPathChange = vi.fn();
    const items: ColumnViewItem[] = [
      {
        id: 1,
        label: "One",
        icon: (
          <label>
            Mark
            <input type="checkbox" />
          </label>
        ),
      },
    ];
    await show({ getChildren: (id) => (id == null ? items : null), onPathChange });
    fireEvent.mouseDown(screen.getByText("Mark"));
    fireEvent.doubleClick(screen.getByText("Mark"));
    expect(onPathChange).not.toHaveBeenCalled();
  });

  it("leaves editable text inside an item alone, and treats text marked not editable as the item", async () => {
    const onPathChange = vi.fn();
    const onItemAction = vi.fn();
    const items: ColumnViewItem[] = [
      {
        id: 1,
        label: "One",
        icon: (
          <span contentEditable suppressContentEditableWarning>
            Note
          </span>
        ),
      },
      { id: 2, label: "Two", icon: <span contentEditable={false}>Fixed</span> },
    ];
    await show({ getChildren: (id) => (id == null ? items : null), onPathChange, onItemAction });
    expect(screen.getByText("Fixed")).toHaveAttribute("contenteditable", "false");
    fireEvent.mouseDown(screen.getByText("Note"));
    fireEvent.doubleClick(screen.getByText("Note"));
    expect(fireEvent.keyDown(screen.getByText("Note"), { key: "ArrowDown" })).toBe(true);
    expect(onPathChange).not.toHaveBeenCalled();
    expect(onItemAction).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByText("Fixed"));
    fireEvent.doubleClick(screen.getByText("Fixed"));
    expect(onPathChange).toHaveBeenLastCalledWith([2]);
    expect(onItemAction).toHaveBeenCalledWith(items[1]);
    // A key that reaches the column from such text is the column's.
    expect(fireEvent.keyDown(screen.getByText("Fixed"), { key: "ArrowUp" })).toBe(false);
    expect(onPathChange).toHaveBeenLastCalledWith([1]);
  });

  it("lets the caller cancel a move of a divider that is dragged", async () => {
    const onColumnWidthsChange = vi.fn();
    const { container } = await show({
      defaultPath: ["docs"],
      onColumnWidthsChange,
      onPointerMove: (event) => event.preventDefault(),
    });
    const divider = container.querySelectorAll(".mac-column-view-divider")[1] as HTMLElement;
    fireEvent.pointerDown(divider, { button: 0, buttons: 1, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(divider, { buttons: 1, clientX: 430, pointerId: 1 });
    expect(onColumnWidthsChange).not.toHaveBeenCalled();
  });

  it("keeps an item's own state with it when a column is reordered", async () => {
    const user = userEvent.setup();
    const first: ColumnViewItem[] = ["One", "Two", "Three"].map((label) => ({
      id: label,
      label,
      icon: <input aria-label={`Note on ${label}`} />,
    }));
    function Owner() {
      const [items, setItems] = useState(first);
      return (
        <>
          <View getChildren={(id) => (id == null ? items : null)} />
          <button type="button" onClick={() => setItems([...items].reverse())}>
            Reverse
          </button>
        </>
      );
    }
    render(<Owner />);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("Note on One"), { target: { value: "mine" } });
    await user.click(screen.getByRole("button", { name: "Reverse" }));
    expect(screen.getByLabelText("Note on One")).toHaveValue("mine");
    expect(screen.getByLabelText("Note on Three")).toHaveValue("");
  });

  it.each([
    ["ArrowDown", "apps"],
    ["ArrowUp", "apps"],
    ["Home", "apps"],
    ["End", "empty"],
  ])("with nothing selected, %s selects %s", async (key, id) => {
    const user = userEvent.setup();
    const onPathChange = vi.fn();
    await show({ onPathChange });
    await user.tab();
    await user.keyboard(`{${key}}`);
    expect(onPathChange).toHaveBeenLastCalledWith([id]);
  });

  it("does nothing with keys in a column that has no items", async () => {
    const user = userEvent.setup();
    const onPathChange = vi.fn();
    const onItemAction = vi.fn();
    await show({ getChildren: () => [], onPathChange, onItemAction });
    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowUp}{Home}{End}a{Enter}{ArrowRight}{ArrowLeft}");
    expect(onPathChange).not.toHaveBeenCalled();
    expect(onItemAction).not.toHaveBeenCalled();
  });

  it("resizes the focused column with Option and the arrow keys", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [widths, setWidths] = useState([100, 100]);
      return (
        <View
          defaultPath={["docs", "budget"]}
          columnWidths={widths}
          onColumnWidthsChange={setWidths}
        />
      );
    }
    const { container } = render(<Controlled />);
    await act(async () => {});
    await user.tab();
    await user.keyboard("{Alt>}{ArrowRight}{ArrowRight}{/Alt}");
    const width = () =>
      [...container.querySelectorAll<HTMLElement>(".mac-column-view-column")].map(
        (element) => element.style.width,
      );
    expect(width()).toEqual(["100px", "120px"]);
    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(width()).toEqual(["100px", "110px"]);
    // The selection did not move.
    expect(selected()).toEqual(["Documents", "Budget"]);
  });

  it("runs the caller's handlers first and lets them cancel a key", async () => {
    const user = userEvent.setup();
    const onPathChange = vi.fn();
    const onKeyDown = vi.fn((event: { key: string; preventDefault: () => void }) => {
      if (event.key === "ArrowDown") event.preventDefault();
    });
    await show({ onPathChange, onKeyDown });
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(onKeyDown).toHaveBeenCalled();
    expect(onPathChange).not.toHaveBeenCalled();
    await user.keyboard("{End}");
    expect(onPathChange).toHaveBeenLastCalledWith(["empty"]);
  });

  it("leaves keys typed inside the preview alone", async () => {
    const user = userEvent.setup();
    const onPathChange = vi.fn();
    await show({
      defaultPath: ["note"],
      onPathChange,
      renderPreview: () => <input aria-label="Comment" />,
    });
    await act(async () => {});
    await user.click(screen.getByRole("textbox", { name: "Comment" }));
    await user.keyboard("a{ArrowDown}");
    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveValue("a");
    expect(onPathChange).not.toHaveBeenCalled();
  });

  it("forwards ref, className and other props to the root", async () => {
    const ref = createRef<HTMLDivElement>();
    await show({ ref, className: "mine", id: "browser", "aria-label": "Browser" });
    const root = screen.getByRole("group", { name: "Browser" });
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-column-view", "mine");
    expect(root).toHaveAttribute("id", "browser");
    // The first column carries the view's name.
    expect(column("Browser")).toBeInTheDocument();
  });

  it("renders icons in their slot", async () => {
    await show({
      getChildren: () => [{ id: 1, label: "With icon", icon: <svg data-testid="icon" /> }],
    });
    expect(screen.getByTestId("icon").parentElement).toHaveClass("mac-column-view-icon");
    expect(option("With icon")).toBeInTheDocument();
  });

  it("leaves presses and keys in a control inside an item to the control", async () => {
    const onPathChange = vi.fn();
    const onItemAction = vi.fn();
    const items: ColumnViewItem[] = [
      { id: 1, label: "One", icon: <input aria-label="Mark" id="mark" /> },
      { id: 2, label: "Two" },
    ];
    await show({ getChildren: (id) => (id == null ? items : null), onPathChange, onItemAction });
    const input = screen.getByRole("textbox", { name: "Mark" });
    fireEvent.mouseDown(input);
    fireEvent.doubleClick(input);
    input.focus();
    expect(fireEvent.keyDown(input, { key: "ArrowDown" })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "t" })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
    expect(onPathChange).not.toHaveBeenCalled();
    expect(onItemAction).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
    // The row around the control still answers.
    fireEvent.mouseDown(screen.getAllByRole("option")[0] as HTMLElement);
    expect(onPathChange).toHaveBeenLastCalledWith([1]);
  });
});

describe("ColumnViewPanel", () => {
  it("renders a div with the panel class and forwards props", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ColumnViewPanel ref={ref} className="mine" data-testid="panel">
        Castle
      </ColumnViewPanel>,
    );
    const panel = screen.getByTestId("panel");
    expect(panel).toHaveClass("mac-column-view-panel", "mine");
    expect(panel).toHaveTextContent("Castle");
    expect(ref.current).toBe(panel);
  });
});
