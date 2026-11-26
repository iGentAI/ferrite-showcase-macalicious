import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutlineView, type OutlineViewItem, type OutlineViewProps } from "./index";

interface Node extends OutlineViewItem {
  name: string;
}

const items: Node[] = [
  {
    id: "hardware",
    name: "Hardware",
    children: [
      { id: "audio", name: "Audio" },
      { id: "usb", name: "USB", children: [{ id: "hub", name: "Hub" }] },
    ],
  },
  { id: "network", name: "Network", children: [{ id: "wifi", name: "Wi-Fi", dimmed: true }] },
  { id: "software", name: "Software" },
];

function Outline(props: Partial<OutlineViewProps<Node>>) {
  return (
    <OutlineView
      aria-label="Report"
      items={items}
      renderCell={(item) => item.name}
      getItemLabel={(item) => item.name}
      {...props}
    />
  );
}

const tree = () => screen.getByRole("treegrid", { name: "Report" });
const row = (name: string) => screen.getByRole("row", { name });
const names = () => screen.getAllByRole("row").map((element) => element.textContent);
const selected = () =>
  screen
    .getAllByRole("row")
    .filter((element) => element.getAttribute("aria-selected") === "true")
    .map((element) => element.textContent);
const triangle = (name: string) => row(name).querySelector("button") as HTMLButtonElement;

// Thirty items in 20 pt rows, for `revealedItem`. Item 20 holds "Inside".
const long: Node[] = Array.from({ length: 30 }, (_, index) =>
  index === 20
    ? { id: "item-20", name: "Item 20", children: [{ id: "inside", name: "Inside" }] }
    : { id: `item-${index}`, name: `Item ${index}` },
);
/** The scrolling element. */
const view = () => within(tree()).getByRole("rowgroup");
/** The test environment lays nothing out: the scrolling element is given a height of 100 pt. */
const layOut = () => vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
/** And the header, the only element whose `offsetHeight` the outline reads, its height. */
const layOutHeader = (height: number) =>
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(height);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OutlineView", () => {
  it("renders the top-level items collapsed, as a treegrid without a header", () => {
    render(<Outline />);
    expect(tree()).toHaveClass("mac-table-view", "mac-outline-view");
    expect(tree()).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("columnheader")).toBeNull();
    expect(names()).toEqual(["Hardware", "Network", "Software"]);
    expect(row("Hardware")).toHaveAttribute("aria-level", "1");
    expect(row("Hardware")).toHaveAttribute("aria-expanded", "false");
    // A leaf has no expanded state and no triangle, only its slot.
    expect(row("Software")).not.toHaveAttribute("aria-expanded");
    expect(triangle("Software")).toBeNull();
    expect(row("Software").querySelector(".mac-outline-view-triangle")).not.toBeNull();
  });

  it("shows the children of expanded items, one level deeper and indented", () => {
    render(<Outline defaultExpanded={["hardware", "usb"]} indentation={20} />);
    expect(names()).toEqual(["Hardware", "Audio", "USB", "Hub", "Network", "Software"]);
    expect(row("Hardware")).toHaveAttribute("aria-expanded", "true");
    expect(row("Audio")).toHaveAttribute("aria-level", "2");
    expect(row("Hub")).toHaveAttribute("aria-level", "3");
    const indent = (name: string) =>
      row(name).querySelector<HTMLElement>(".mac-outline-view-cell")?.style.paddingInlineStart;
    expect(indent("Hardware")).toBe("0px");
    expect(indent("Audio")).toBe("20px");
    expect(indent("Hub")).toBe("40px");
  });

  it("expands and collapses with the triangle, without selecting the row", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(<Outline onExpandedChange={onExpandedChange} />);
    await user.click(triangle("Hardware"));
    expect(onExpandedChange).toHaveBeenLastCalledWith(["hardware"]);
    expect(names()).toEqual(["Hardware", "Audio", "USB", "Network", "Software"]);
    expect(selected()).toEqual([]);
    await user.click(triangle("Hardware"));
    expect(onExpandedChange).toHaveBeenLastCalledWith([]);
    expect(names()).toEqual(["Hardware", "Network", "Software"]);
  });

  it("carries on from a row whose triangle collapsed the current row out of sight", async () => {
    const user = userEvent.setup();
    render(<Outline defaultExpanded={["hardware"]} defaultValue={["audio"]} />);
    await user.click(triangle("Hardware"));
    expect(names()).toEqual(["Hardware", "Network", "Software"]);
    expect(tree()).toHaveAttribute("aria-activedescendant", row("Hardware").id);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["Network"]);
  });

  it("carries on from the nearest visible ancestor when the owner collapses the outline", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [expanded, setExpanded] = useState<OutlineViewProps<Node>["expanded"]>([
        "hardware",
        "usb",
      ]);
      return (
        <>
          <Outline expanded={expanded} onExpandedChange={setExpanded} />
          <button type="button" onClick={() => setExpanded([])}>
            Collapse all
          </button>
        </>
      );
    }
    render(<Owner />);
    await user.click(row("Hub"));
    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    tree().focus();
    expect(tree()).toHaveAttribute("aria-activedescendant", row("Hardware").id);
    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["Network"]);
  });

  it("keeps the focus in the outline when a triangle is pressed", () => {
    render(<Outline />);
    // The press is cancelled, so the hidden button does not take the focus.
    expect(fireEvent.mouseDown(triangle("Hardware"))).toBe(false);
    expect(tree()).toHaveFocus();
    expect(selected()).toEqual([]);
  });

  it("leaves a press of another mouse button on a triangle alone", () => {
    render(<Outline />);
    expect(fireEvent.mouseDown(triangle("Hardware"), { button: 2 })).toBe(true);
    expect(tree()).not.toHaveFocus();
  });

  it("expands every level with an Option-click, and collapses every level again", async () => {
    const user = userEvent.setup();
    render(<Outline />);
    await user.keyboard("{Alt>}");
    await user.click(triangle("Hardware"));
    expect(names()).toEqual(["Hardware", "Audio", "USB", "Hub", "Network", "Software"]);
    await user.click(triangle("Hardware"));
    await user.keyboard("{/Alt}");
    await user.click(triangle("Hardware"));
    // USB was collapsed along with its parent.
    expect(names()).toEqual(["Hardware", "Audio", "USB", "Network", "Software"]);
  });

  it("keeps the triangle out of the tab order and hidden from assistive technology", () => {
    render(<Outline />);
    expect(triangle("Hardware")).toHaveAttribute("tabindex", "-1");
    expect(triangle("Hardware")).toHaveAttribute("aria-hidden", "true");
    expect(within(row("Hardware")).queryByRole("button")).toBeNull();
  });

  it("expands with Right Arrow, then moves to the first child", async () => {
    const user = userEvent.setup();
    render(<Outline />);
    await user.click(row("Hardware"));
    await user.keyboard("{ArrowRight}");
    expect(row("Hardware")).toHaveAttribute("aria-expanded", "true");
    expect(selected()).toEqual(["Hardware"]);
    await user.keyboard("{ArrowRight}");
    expect(selected()).toEqual(["Audio"]);
    // Right Arrow on a leaf does nothing.
    await user.keyboard("{ArrowRight}");
    expect(selected()).toEqual(["Audio"]);
  });

  it("collapses with Left Arrow, or moves to the parent", async () => {
    const user = userEvent.setup();
    render(<Outline defaultExpanded={["hardware", "usb"]} />);
    await user.click(row("Hub"));
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toEqual(["USB"]);
    await user.keyboard("{ArrowLeft}");
    expect(row("USB")).toHaveAttribute("aria-expanded", "false");
    expect(selected()).toEqual(["USB"]);
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toEqual(["Hardware"]);
    await user.keyboard("{ArrowLeft}");
    expect(names()).toEqual(["Hardware", "Network", "Software"]);
    // Left Arrow on a collapsed top-level item does nothing.
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toEqual(["Hardware"]);
  });

  it("expands and collapses every level with Option and the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Outline />);
    await user.click(row("Hardware"));
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(names()).toEqual(["Hardware", "Audio", "USB", "Hub", "Network", "Software"]);
    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}{ArrowRight}");
    expect(names()).toEqual(["Hardware", "Audio", "USB", "Network", "Software"]);
  });

  it("moves through the visible rows with Up and Down, and by typing", async () => {
    const user = userEvent.setup();
    render(<Outline defaultExpanded={["hardware"]} />);
    await user.tab();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    // Hub is not visible: after USB comes Network.
    expect(selected()).toEqual(["Network"]);
    await user.keyboard("so");
    expect(selected()).toEqual(["Software"]);
  });

  it("selects a range and toggles rows across levels with multiple selection", async () => {
    const user = userEvent.setup();
    render(<Outline selectionMode="multiple" defaultExpanded={["hardware", "usb"]} />);
    expect(tree()).toHaveAttribute("aria-multiselectable", "true");
    await user.click(row("Audio"));
    // A Shift range runs over the visible rows, whatever their level.
    await user.keyboard("{Shift>}");
    await user.click(row("Network"));
    await user.keyboard("{/Shift}");
    expect(selected()).toEqual(["Audio", "USB", "Hub", "Network"]);
    // Command takes a row out and adds one.
    await user.keyboard("{Meta>}");
    await user.click(row("Hub"));
    await user.click(row("Software"));
    await user.keyboard("{/Meta}");
    expect(selected()).toEqual(["Audio", "USB", "Network", "Software"]);
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(selected()).toEqual(["Network", "Software"]);
  });

  it("runs a range over the rows that are visible after a collapse", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Outline
        selectionMode="multiple"
        defaultExpanded={["hardware", "usb"]}
        onValueChange={onValueChange}
      />,
    );
    await user.click(row("Audio"));
    await user.click(triangle("USB"));
    expect(names()).toEqual(["Hardware", "Audio", "USB", "Network", "Software"]);
    await user.keyboard("{Shift>}");
    await user.click(row("Network"));
    await user.keyboard("{/Shift}");
    // Hub is hidden under USB: it is not in the range.
    expect(onValueChange).toHaveBeenLastCalledWith(["audio", "usb", "network"]);
    expect(selected()).toEqual(["Audio", "USB", "Network"]);
  });

  it("selects by item id and reports the selection", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Outline
        defaultExpanded={["hardware"]}
        defaultValue={["audio"]}
        onValueChange={onValueChange}
      />,
    );
    expect(selected()).toEqual(["Audio"]);
    await user.click(row("USB"));
    expect(onValueChange).toHaveBeenLastCalledWith(["usb"]);
  });

  it("leaves a controlled expansion to its owner", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [open, setOpen] = useState<readonly (string | number)[]>([]);
      // The owner never lets Network be expanded.
      return (
        <Outline
          expanded={open}
          onExpandedChange={(next) => setOpen(next.filter((id) => id !== "network"))}
        />
      );
    }
    render(<Controlled />);
    await user.click(triangle("Network"));
    expect(names()).toEqual(["Hardware", "Network", "Software"]);
    await user.click(triangle("Hardware"));
    expect(names()).toEqual(["Hardware", "Audio", "USB", "Network", "Software"]);
  });

  it("calls onItemAction with the item for a double click and for Return", async () => {
    const user = userEvent.setup();
    const onItemAction = vi.fn();
    render(<Outline onItemAction={onItemAction} />);
    await user.dblClick(row("Software"));
    expect(onItemAction).toHaveBeenLastCalledWith(items[2]);
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onItemAction).toHaveBeenLastCalledWith(items[1]);
    // A double click on a triangle toggles twice and is not an action.
    await user.dblClick(triangle("Hardware"));
    expect(onItemAction).toHaveBeenCalledTimes(2);
  });

  it("marks dimmed rows", () => {
    render(<Outline defaultExpanded={["network"]} />);
    expect(row("Wi-Fi")).toHaveClass("mac-table-view-row", "mac-outline-view-row-dimmed");
    expect(row("Network")).not.toHaveClass("mac-outline-view-row-dimmed");
  });

  it("shows a header and further columns when given columns", () => {
    render(
      <Outline
        columns={[
          { id: "name", title: "Name", width: 120 },
          { id: "id", title: "Identifier" },
        ]}
        renderCell={(item, column) => (column.id === "name" ? item.name : String(item.id))}
      />,
    );
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Name",
      "Identifier",
    ]);
    const cells = within(screen.getByRole("row", { name: "Hardware hardware" })).getAllByRole(
      "gridcell",
    );
    // Only the first column carries the triangle.
    expect(cells[0]?.querySelector("button")).not.toBeNull();
    expect(cells[1]?.querySelector(".mac-outline-view-triangle")).toBeNull();
  });

  it("forwards ref, className, style and table props to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Outline
        ref={ref}
        className="extra"
        id="outline"
        style={{ height: 200 }}
        size="mini"
        alternatingRows
      />,
    );
    expect(ref.current).toBe(tree());
    expect(tree()).toHaveClass("mac-outline-view", "extra");
    expect(tree()).toHaveAttribute("id", "outline");
    expect(tree().style.height).toBe("200px");
    expect(tree()).toHaveAttribute("data-size", "mini");
    expect(tree()).toHaveAttribute("data-alternating");
  });

  it("gives a callback ref the root once, and takes it back when the outline goes", () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(<Outline ref={ref} />);
    rerender(<Outline ref={ref} revealedItem="software" />);
    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenLastCalledWith(tree());
    unmount();
    expect(ref).toHaveBeenCalledTimes(2);
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it("scrolls just far enough to show the row of revealedItem, at first and when the id changes", () => {
    layOut();
    const { rerender } = render(<Outline items={long} rowHeight={20} revealedItem="item-12" />);
    // Row 12 ends at 260 pt: it is the last row of a view that is 100 pt high.
    expect(view().scrollTop).toBe(160);
    rerender(<Outline items={long} rowHeight={20} revealedItem="item-14" />);
    expect(view().scrollTop).toBe(200);
    // A row above the view becomes its first row.
    rerender(<Outline items={long} rowHeight={20} revealedItem="item-3" />);
    expect(view().scrollTop).toBe(60);
    // Rows 3 to 7 are in view: revealing one of them scrolls nothing.
    rerender(<Outline items={long} rowHeight={20} revealedItem="item-7" />);
    expect(view().scrollTop).toBe(60);
    rerender(<Outline items={long} rowHeight={20} revealedItem="item-5" />);
    expect(view().scrollTop).toBe(60);
  });

  it("reveals a row below the header, with the table view's default row height", () => {
    layOut();
    layOutHeader(24);
    const columns = [{ id: "name", title: "Name" }];
    const { rerender } = render(<Outline items={long} columns={columns} revealedItem="item-12" />);
    // 19 pt rows under a 24 pt header: row 12 ends 271 pt from the top of the content.
    expect(view().scrollTop).toBe(171);
    // Under the header, which stays at the top of the view: the row's own offset.
    rerender(<Outline items={long} columns={columns} revealedItem="item-3" />);
    expect(view().scrollTop).toBe(57);
  });

  it("reveals a row below a header of another height, such as one with a line above it", () => {
    layOut();
    // A table header with a top border is 25 pt: the row must not end 1 pt under the view.
    const header = layOutHeader(25);
    const columns = [{ id: "name", title: "Name" }];
    const { rerender } = render(<Outline items={long} columns={columns} revealedItem="item-12" />);
    expect(view().scrollTop).toBe(172);
    // The height is read from the header each time a row is revealed, not kept.
    header.mockReturnValue(40);
    rerender(<Outline items={long} columns={columns} revealedItem="item-14" />);
    expect(view().scrollTop).toBe(14 * 19 + 19 + 40 - 100);
    // Without a header there is nothing to read, and nothing is added.
    rerender(<Outline items={long} rowHeight={20} revealedItem="item-20" />);
    expect(view().scrollTop).toBe(20 * 20 + 20 - 100);
  });

  it("scrolls when revealedItem changes, and not on any other render", () => {
    const height = layOut();
    const { rerender } = render(<Outline items={long} rowHeight={20} revealedItem="item-12" />);
    expect(view().scrollTop).toBe(160);
    // The user scrolls away: the outline does not bring the row back.
    view().scrollTop = 0;
    const reads = height.mock.calls.length;
    rerender(<Outline items={long} rowHeight={20} revealedItem="item-12" size="small" />);
    expect(view().scrollTop).toBe(0);
    // Nor does a render that reveals nothing new read the layout.
    expect(height.mock.calls.length).toBe(reads);
    // The same item is revealed again once the prop has been cleared.
    rerender(<Outline items={long} rowHeight={20} />);
    expect(view().scrollTop).toBe(0);
    rerender(<Outline items={long} rowHeight={20} revealedItem="item-12" />);
    expect(view().scrollTop).toBe(160);
  });

  it("leaves the focus, the selection and the expansion alone when it reveals a row", async () => {
    const user = userEvent.setup();
    layOut();
    const onValueChange = vi.fn();
    const onExpandedChange = vi.fn();
    const outline = (revealedItem?: string) => (
      <>
        <button type="button">Elsewhere</button>
        <Outline
          items={long}
          rowHeight={20}
          defaultValue={["item-1"]}
          onValueChange={onValueChange}
          onExpandedChange={onExpandedChange}
          revealedItem={revealedItem}
        />
      </>
    );
    const { rerender } = render(outline());
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    const active = tree().getAttribute("aria-activedescendant");
    rerender(outline("item-25"));
    expect(view().scrollTop).toBe(420);
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
    expect(selected()).toEqual(["Item 1"]);
    expect(tree().getAttribute("aria-activedescendant")).toBe(active);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onExpandedChange).not.toHaveBeenCalled();

    // With the focus in the outline it stays on the outline, and the selection where it is.
    await user.click(row("Item 1"));
    onValueChange.mockClear();
    rerender(outline("item-28"));
    expect(view().scrollTop).toBe(480);
    expect(tree()).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("scrolls nothing and expands nothing for an item inside a collapsed parent", () => {
    layOut();
    const onExpandedChange = vi.fn();
    const outline = (props: Partial<OutlineViewProps<Node>>) => (
      <Outline items={long} rowHeight={20} onExpandedChange={onExpandedChange} {...props} />
    );
    const { rerender } = render(outline({ expanded: [], revealedItem: "inside" }));
    expect(view().scrollTop).toBe(0);
    expect(onExpandedChange).not.toHaveBeenCalled();
    expect(row("Item 0")).toBeInTheDocument();
    // Expanding the parent later is not a new request: the id has not changed.
    rerender(outline({ expanded: ["item-20"], revealedItem: "inside" }));
    expect(view().scrollTop).toBe(0);
    // An id that no item has scrolls nothing either.
    rerender(outline({ expanded: ["item-20"], revealedItem: "nowhere" }));
    expect(view().scrollTop).toBe(0);
    expect(onExpandedChange).not.toHaveBeenCalled();
  });

  it("reveals an item whose ancestors are expanded in the same update, or already are", () => {
    layOut();
    const { rerender, unmount } = render(<Outline items={long} rowHeight={20} expanded={[]} />);
    rerender(<Outline items={long} rowHeight={20} expanded={["item-20"]} revealedItem="inside" />);
    // "Inside" is row 21, which ends at 440 pt.
    expect(view().scrollTop).toBe(340);
    unmount();
    // The outline's own expansion: the item has a row when the outline is first shown.
    render(
      <Outline items={long} rowHeight={20} defaultExpanded={["item-20"]} revealedItem="inside" />,
    );
    expect(view().scrollTop).toBe(340);
  });
});
