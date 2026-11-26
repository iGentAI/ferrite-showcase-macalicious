import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { GalleryView, type GalleryViewProps } from "./index";

/**
 * jsdom has no layout: the strip's scrolling to the selected thumbnail in a sized viewport,
 * the number of thumbnails rendered and right-to-left are exercised in Chromium by
 * visual/output/b7/browser/gallery-view.mjs, and the looks by gallery-view.visual.json.
 */
const names = ["Aurora", "Bay", "Canyon", "Dunes", "Estuary"];
const label = (index: number) => names[index] ?? "";
const preview = (index: number) => <img alt="" data-testid="preview" data-index={index} />;
const thumbnail = (index: number) => <span data-testid={`thumb-${index}`} />;

function View(props: Partial<GalleryViewProps>) {
  return (
    <GalleryView
      aria-label="Pictures"
      count={names.length}
      getItemLabel={label}
      renderPreview={preview}
      renderThumbnail={thumbnail}
      {...props}
    />
  );
}

// Base UI's scroll area measures in a microtask after it mounts.
async function show(props: Partial<GalleryViewProps> = {}) {
  const result = render(<View {...props} />);
  await act(async () => {});
  return result;
}

const strip = () => screen.getByRole("listbox", { name: "Pictures" });
const option = (name: string) => screen.getByRole("option", { name });
const selected = () => screen.queryByRole("option", { selected: true })?.getAttribute("aria-label");

describe("GalleryView", () => {
  it("sizes its thumbnails and lays the strip out at their pitch", async () => {
    await show({ thumbnailSize: 70 });
    const root = screen.getByRole("group", { name: "Pictures" });
    expect(root.style.getPropertyValue("--_thumbnail")).toBe("70px");
    const items = root.querySelector<HTMLElement>(".mac-gallery-view-items");
    expect(items?.style.width).toBe(`${names.length * 78 + 8}px`);
  });

  it("renders a horizontal listbox of named thumbnails in a named group", async () => {
    await show();
    expect(screen.getByRole("group", { name: "Pictures" })).toHaveClass("mac-gallery-view");
    expect(strip()).toHaveAttribute("aria-orientation", "horizontal");
    expect(strip()).toHaveAttribute("tabindex", "0");
    const options = screen.getAllByRole("option");
    expect(options.map((item) => item.getAttribute("aria-label"))).toEqual(names);
    expect(options[0]).toHaveAttribute("aria-setsize", "5");
    expect(options[2]).toHaveAttribute("aria-posinset", "3");
    expect(options[1]).toContainElement(screen.getByTestId("thumb-1"));
    // Nothing is selected, so there is no preview.
    expect(selected()).toBeUndefined();
    expect(screen.queryByTestId("preview")).not.toBeInTheDocument();
  });

  it("shows the preview of the selected item, named after it and controlled by the strip", async () => {
    await show({ defaultValue: [2] });
    expect(selected()).toBe("Canyon");
    const stage = screen.getByRole("figure", { name: "Canyon" });
    expect(stage).toContainElement(screen.getByTestId("preview"));
    expect(screen.getByTestId("preview")).toHaveAttribute("data-index", "2");
    expect(strip()).toHaveAttribute("aria-controls", stage.id);
    expect(strip()).toHaveAttribute("aria-activedescendant", option("Canyon").id);
  });

  it("selects on click and reports an array of one id", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    await show({ onValueChange });
    await user.click(option("Dunes"));
    expect(onValueChange).toHaveBeenLastCalledWith([3]);
    expect(selected()).toBe("Dunes");
    expect(screen.getByRole("figure", { name: "Dunes" })).toBeInTheDocument();
    expect(strip()).toHaveFocus();
    // The other mouse buttons do not select.
    fireEvent.mouseDown(option("Bay"), { button: 2 });
    expect(selected()).toBe("Dunes");
  });

  it("selects by the ids getItemId gives", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    await show({
      getItemId: (index) => `id-${index}`,
      defaultValue: ["id-1"],
      onValueChange,
    });
    expect(selected()).toBe("Bay");
    await user.click(option("Estuary"));
    expect(onValueChange).toHaveBeenLastCalledWith(["id-4"]);
  });

  it("is controlled by value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = await show({ value: [0], onValueChange });
    await user.click(option("Bay"));
    expect(onValueChange).toHaveBeenCalledWith([1]);
    expect(selected()).toBe("Aurora");
    rerender(<View value={[4]} onValueChange={onValueChange} />);
    expect(selected()).toBe("Estuary");
    rerender(<View value={[]} onValueChange={onValueChange} />);
    expect(selected()).toBeUndefined();
  });

  it("moves the selection with Left and Right Arrow, Home and End", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    await show({ defaultValue: [1], onValueChange });
    await user.tab();
    expect(strip()).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe("Canyon");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(selected()).toBe("Aurora");
    // It stops at the ends.
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe("Aurora");
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith([4]);
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe("Estuary");
    await user.keyboard("{Home}");
    expect(selected()).toBe("Aurora");
  });

  it("starts at the first item when nothing is selected", async () => {
    const user = userEvent.setup();
    await show();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe("Aurora");
  });

  it("selects by typing the start of a name", async () => {
    const user = userEvent.setup();
    await show({ defaultValue: [0] });
    await user.tab();
    await user.keyboard("du");
    expect(selected()).toBe("Dunes");
  });

  it("calls onItemAction on Return and on a double click", async () => {
    const user = userEvent.setup();
    const onItemAction = vi.fn();
    await show({ defaultValue: [1], onItemAction });
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onItemAction).toHaveBeenLastCalledWith(1);
    await user.dblClick(option("Estuary"));
    expect(onItemAction).toHaveBeenLastCalledWith(4);
    expect(onItemAction).toHaveBeenCalledTimes(2);
  });

  it("renders only the thumbnails in view and scrolls to the selected one", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    await show({
      count: 5000,
      getItemLabel: (index) => `Picture ${index}`,
      onValueChange,
    });
    // Without layout the first 40 are rendered.
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(40);
    expect(options[0]).toHaveAttribute("aria-setsize", "5000");
    await user.tab();
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith([4999]);
    // 4999 thumbnails at a 62 pt pitch before it.
    expect(strip().scrollLeft).toBe(4999 * 62);
    expect(screen.getByRole("figure", { name: "Picture 4999" })).toBeInTheDocument();
  });

  it("renders the inspector pane only when given", async () => {
    const { container, rerender } = await show();
    expect(container.querySelector(".mac-gallery-view-inspector")).toBeNull();
    rerender(<View inspector={<p>Details</p>} />);
    expect(screen.getByText("Details").parentElement).toHaveClass("mac-gallery-view-inspector");
  });

  it("leaves keys typed in the inspector alone", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    await show({ defaultValue: [0], onValueChange, inspector: <input aria-label="Tags" /> });
    await user.click(screen.getByRole("textbox", { name: "Tags" }));
    await user.keyboard("b{ArrowRight}{End}");
    expect(screen.getByRole("textbox", { name: "Tags" })).toHaveValue("b");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("runs the caller's handlers first and lets them cancel a key", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    await show({
      defaultValue: [0],
      onValueChange,
      onKeyDown: (event) => {
        if (event.key === "End") event.preventDefault();
      },
    });
    await user.tab();
    await user.keyboard("{End}");
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith([1]);
  });

  it("works as a controlled view of changing items", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<(string | number)[]>([0]);
      return (
        <>
          <View value={value} onValueChange={setValue} />
          <output>{String(value[0])}</output>
        </>
      );
    }
    render(<Controlled />);
    await act(async () => {});
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("2");
    expect(selected()).toBe("Canyon");
  });

  it("keeps a thumbnail's own state with its item when the items are reordered", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [order, setOrder] = useState(names);
      return (
        <>
          <View
            getItemLabel={(index) => order[index] ?? ""}
            getItemId={(index) => order[index] ?? index}
            renderThumbnail={(index) => <input aria-label={`Note on ${order[index]}`} />}
          />
          <button type="button" onClick={() => setOrder([...order].reverse())}>
            Reverse
          </button>
        </>
      );
    }
    render(<Owner />);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("Note on Aurora"), { target: { value: "mine" } });
    await user.click(screen.getByRole("button", { name: "Reverse" }));
    expect(screen.getByLabelText("Note on Aurora")).toHaveValue("mine");
    expect(screen.getByLabelText("Note on Estuary")).toHaveValue("");
  });

  it.each([
    ["ArrowRight", "Aurora"],
    ["ArrowLeft", "Aurora"],
    ["Home", "Aurora"],
    ["End", "Estuary"],
  ])("with nothing selected, %s selects %s", async (key, name) => {
    const user = userEvent.setup();
    await show();
    await user.tab();
    await user.keyboard(`{${key}}`);
    expect(selected()).toBe(name);
  });

  it("does nothing with keys when it has no items, and keeps its one item selected", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = await show({ count: 0, onValueChange });
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowLeft}{Home}{End}a{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(<View count={1} />);
    for (const key of ["ArrowRight", "ArrowLeft", "End", "Home"]) {
      await user.keyboard(`{${key}}`);
      expect(selected()).toBe("Aurora");
    }
  });

  it("forwards ref, className and other props to the root", async () => {
    const ref = createRef<HTMLDivElement>();
    await show({
      ref,
      className: "mine",
      id: "gallery",
      "data-kind": "photos",
    } as Partial<GalleryViewProps>);
    const root = screen.getByRole("group", { name: "Pictures" });
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-gallery-view", "mine");
    expect(root).toHaveAttribute("id", "gallery");
    expect(root).toHaveAttribute("data-kind", "photos");
  });

  it("brings the selected thumbnail back into view when the keyboard focus arrives", async () => {
    const user = userEvent.setup();
    await show({ count: 500, getItemLabel: (index) => `Picture ${index}`, defaultValue: [300] });
    // jsdom has no layout, so the thumbnail goes to the start of the strip.
    const shown = strip().scrollLeft;
    expect(shown).toBeGreaterThan(0);
    strip().scrollLeft = 0;
    await user.tab();
    expect(strip()).toHaveFocus();
    expect(strip().scrollLeft).toBe(shown);
  });

  it("leaves a press on the label of a control inside a thumbnail to the control", async () => {
    const onValueChange = vi.fn();
    const onItemAction = vi.fn();
    await show({
      onValueChange,
      onItemAction,
      renderThumbnail: (index) => (
        <label>
          Keep {index}
          <input type="checkbox" />
        </label>
      ),
    });
    fireEvent.mouseDown(screen.getByText("Keep 1"));
    fireEvent.doubleClick(screen.getByText("Keep 1"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onItemAction).not.toHaveBeenCalled();
  });

  it("leaves editable text inside a thumbnail alone, and treats text marked not editable as the thumbnail", async () => {
    const onValueChange = vi.fn();
    const onItemAction = vi.fn();
    await show({
      onValueChange,
      onItemAction,
      renderThumbnail: (index) => (
        <span contentEditable={index === 1} suppressContentEditableWarning>
          Note {index}
        </span>
      ),
    });
    expect(screen.getByText("Note 2")).toHaveAttribute("contenteditable", "false");
    fireEvent.mouseDown(screen.getByText("Note 1"));
    fireEvent.doubleClick(screen.getByText("Note 1"));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onItemAction).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByText("Note 2"));
    fireEvent.doubleClick(screen.getByText("Note 2"));
    expect(selected()).toBe("Canyon");
    expect(onItemAction).toHaveBeenCalledTimes(1);
  });

  it("tells an item with a number for an id from one with the same digits as text", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await show({ count: 2, getItemId: (index) => (index ? "1" : 1), defaultValue: ["1"] });
    expect(selected()).toBe("Bay");
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("follows the selected item when the items are reordered behind the same functions", async () => {
    const order = [0, 1, 2, 3, 4];
    const getItemId = (index: number) => names[order[index] ?? 0] ?? "";
    const getItemLabel = (index: number) => names[order[index] ?? 0] ?? "";
    const props = { getItemId, getItemLabel, value: ["Bay"] };
    const { rerender } = await show(props);
    expect(selected()).toBe("Bay");
    expect(option("Bay")).toHaveAttribute("aria-posinset", "2");
    order.reverse();
    rerender(<View {...props} />);
    expect(selected()).toBe("Bay");
    expect(option("Bay")).toHaveAttribute("aria-posinset", "4");
    expect(screen.getByRole("figure", { name: "Bay" })).toBeInTheDocument();
    expect(screen.getByTestId("preview")).toHaveAttribute("data-index", "3");
  });
});
