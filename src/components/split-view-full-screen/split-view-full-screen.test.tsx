import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type KeyboardEvent, type PointerEvent, useState } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SplitViewFullScreen,
  SplitViewFullScreenDivider,
  type SplitViewFullScreenProps,
  SplitViewFullScreenTile,
} from "./index";

/*
 * jsdom has no layout: the Space is given a width of 1012 points and the divider its 12, so
 * that the two tiles share 1000 points and a pointer distance of 10 points is 1% of the
 * width. Real geometry is covered by split-view-full-screen.visual.json.
 */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 1012,
        bottom: 600,
        width: 1012,
        height: 600,
      }) as DOMRect,
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(12);
});

function Example(props: SplitViewFullScreenProps) {
  return (
    <SplitViewFullScreen data-testid="root" {...props}>
      <SplitViewFullScreenTile side="leading" aria-label="Notes">
        <button type="button">New Note</button>
      </SplitViewFullScreenTile>
      <SplitViewFullScreenDivider />
      <SplitViewFullScreenTile side="trailing" aria-label="Browser">
        <button type="button">Reload</button>
      </SplitViewFullScreenTile>
    </SplitViewFullScreen>
  );
}

const root = () => screen.getByTestId("root");
const divider = () => screen.getByRole("separator");
const tile = (name: string) => screen.getByRole("region", { name });
const share = () => root().style.getPropertyValue("--_split");

describe("SplitViewFullScreen", () => {
  it("renders two full-screen windows and a divider between them", () => {
    render(<Example />);
    expect(root()).toHaveClass("mac-split-view-full-screen");
    expect(root()).toHaveAttribute("data-active", "leading");
    expect(share()).toBe("0.5");
    for (const name of ["Notes", "Browser"]) {
      expect(tile(name)).toHaveClass("mac-split-view-full-screen-tile");
      expect(tile(name)).toHaveAttribute("data-full-screen");
    }
    expect(tile("Notes")).toHaveAttribute("data-side", "leading");
    expect(tile("Browser")).toHaveAttribute("data-side", "trailing");
    expect(tile("Notes").compareDocumentPosition(divider())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(divider().compareDocumentPosition(tile("Browser"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("makes the active tile's window key and the other one inactive", () => {
    render(<Example defaultActive="trailing" />);
    expect(root()).toHaveAttribute("data-active", "trailing");
    expect(tile("Notes")).toHaveAttribute("data-window-state", "inactive");
    expect(tile("Browser")).toHaveAttribute("data-window-state", "key");
  });

  it("activates a tile that is pressed", () => {
    const onActiveChange = vi.fn();
    render(<Example onActiveChange={onActiveChange} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Reload" }));
    expect(onActiveChange).toHaveBeenCalledExactlyOnceWith("trailing");
    expect(tile("Browser")).toHaveAttribute("data-window-state", "key");
    expect(tile("Notes")).toHaveAttribute("data-window-state", "inactive");
    // A press in the tile that is already active reports nothing.
    fireEvent.pointerDown(tile("Browser"));
    expect(onActiveChange).toHaveBeenCalledTimes(1);
  });

  it("activates a tile when keyboard focus moves into it", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    expect(screen.getByRole("button", { name: "New Note" })).toHaveFocus();
    expect(root()).toHaveAttribute("data-active", "leading");
    await user.tab();
    expect(divider()).toHaveFocus();
    expect(root()).toHaveAttribute("data-active", "leading");
    await user.tab();
    expect(screen.getByRole("button", { name: "Reload" })).toHaveFocus();
    expect(root()).toHaveAttribute("data-active", "trailing");
  });

  it("leaves a controlled active tile to its owner", () => {
    const onActiveChange = vi.fn();
    render(<Example active="leading" onActiveChange={onActiveChange} />);
    fireEvent.pointerDown(tile("Browser"));
    expect(onActiveChange).toHaveBeenCalledWith("trailing");
    expect(root()).toHaveAttribute("data-active", "leading");
    expect(tile("Browser")).toHaveAttribute("data-window-state", "inactive");
  });

  it("exposes the divider as a labelled separator with the share in percent", () => {
    render(<Example defaultSplit={0.44} min={0.3} max={0.7} />);
    expect(divider()).toHaveAccessibleName("Resize tiles");
    expect(divider()).toHaveAttribute("aria-orientation", "vertical");
    expect(divider()).toHaveAttribute("aria-valuenow", "44");
    expect(divider()).toHaveAttribute("aria-valuemin", "30");
    expect(divider()).toHaveAttribute("aria-valuemax", "70");
    expect(divider()).toHaveAttribute("tabindex", "0");
    expect(divider()).toHaveAttribute("aria-controls", tile("Notes").id);
    expect(tile("Notes").id).not.toBe("");
  });

  it("moves the divider with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    const onSplitChange = vi.fn();
    render(<Example onSplitChange={onSplitChange} />);
    divider().focus();
    await user.keyboard("{ArrowRight}");
    expect(share()).toBe("0.51");
    expect(divider()).toHaveAttribute("aria-valuenow", "51");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(share()).toBe("0.49");
    await user.keyboard("{Home}");
    expect(share()).toBe("0.25");
    await user.keyboard("{ArrowLeft}");
    expect(share()).toBe("0.25");
    await user.keyboard("{End}");
    expect(share()).toBe("0.75");
    await user.keyboard("{ArrowRight}");
    expect(share()).toBe("0.75");
    // A key at a limit changes nothing and reports nothing.
    expect(onSplitChange.mock.calls.map(([value]) => value)).toEqual([0.51, 0.5, 0.49, 0.25, 0.75]);
  });

  it("names a leading tile's own id in markup rendered on the server, and one further down once mounted", () => {
    const html = renderToString(
      <SplitViewFullScreen>
        <SplitViewFullScreenTile side="leading" aria-label="Notes" id="notes" />
        <SplitViewFullScreenDivider />
        <SplitViewFullScreenTile side="trailing" aria-label="Browser" />
      </SplitViewFullScreen>,
    );
    expect(html).toContain('aria-controls="notes"');
    expect(html).toContain('id="notes"');
    // A tile inside another component is not among the children: it reports its id.
    function Notes() {
      return <SplitViewFullScreenTile side="leading" aria-label="Notes" id="wrapped" />;
    }
    render(
      <SplitViewFullScreen>
        <Notes />
        <SplitViewFullScreenDivider />
        <SplitViewFullScreenTile side="trailing" aria-label="Browser" />
      </SplitViewFullScreen>,
    );
    expect(divider()).toHaveAttribute("aria-controls", "wrapped");
    expect(tile("Notes")).toHaveAttribute("id", "wrapped");
  });

  it("keeps a share that was given outside the limits within them", () => {
    const { rerender } = render(<Example min={0.6} />);
    expect(divider()).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByTestId("root").style.getPropertyValue("--_split")).toBe("0.6");
    rerender(<Example split={0.9} />);
    expect(divider()).toHaveAttribute("aria-valuenow", "75");
  });

  it("takes the size of a key step from step", async () => {
    const user = userEvent.setup();
    render(
      <SplitViewFullScreen data-testid="root">
        <SplitViewFullScreenTile side="leading" aria-label="Notes" />
        <SplitViewFullScreenDivider step={0.1} />
        <SplitViewFullScreenTile side="trailing" aria-label="Browser" />
      </SplitViewFullScreen>,
    );
    divider().focus();
    await user.keyboard("{ArrowRight}");
    expect(share()).toBe("0.6");
  });

  it("mirrors the arrow keys in a right-to-left page", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl" style={{ direction: "rtl" }}>
        <Example />
      </div>,
    );
    divider().focus();
    await user.keyboard("{ArrowRight}");
    expect(share()).toBe("0.49");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(share()).toBe("0.51");
  });

  it("leaves a controlled split to its owner", async () => {
    const user = userEvent.setup();
    const onSplitChange = vi.fn();
    render(<Example split={0.4} onSplitChange={onSplitChange} />);
    divider().focus();
    await user.keyboard("{ArrowRight}");
    expect(onSplitChange).toHaveBeenCalledExactlyOnceWith(0.41);
    expect(share()).toBe("0.4");
    expect(divider()).toHaveAttribute("aria-valuenow", "40");
  });

  it("follows a controlled split", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [split, setSplit] = useState(0.4);
      return <Example split={split} onSplitChange={setSplit} />;
    }
    render(<Controlled />);
    divider().focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(share()).toBe("0.42");
  });

  it("follows the pointer while the divider is dragged and reports once on release", () => {
    const onSplitChange = vi.fn();
    render(<Example onSplitChange={onSplitChange} />);
    fireEvent.pointerDown(divider(), { button: 0, clientX: 500, pointerId: 1 });
    expect(root()).toHaveAttribute("data-dragging");
    fireEvent.pointerMove(divider(), { clientX: 600, pointerId: 1 });
    expect(root().style.getPropertyValue("--_drag")).toBe("0.6");
    fireEvent.pointerMove(divider(), { clientX: 2000, pointerId: 1 });
    expect(root().style.getPropertyValue("--_drag")).toBe("0.75");
    fireEvent.pointerMove(divider(), { clientX: 440, pointerId: 1 });
    expect(root().style.getPropertyValue("--_drag")).toBe("0.44");
    // Nothing has reached React yet.
    expect(onSplitChange).not.toHaveBeenCalled();
    expect(share()).toBe("0.5");
    fireEvent.pointerUp(divider(), { pointerId: 1 });
    expect(onSplitChange).toHaveBeenCalledExactlyOnceWith(0.44);
    expect(share()).toBe("0.44");
    expect(root().style.getPropertyValue("--_drag")).toBe("");
    expect(root()).not.toHaveAttribute("data-dragging");
    // The release is not reported twice, and the pointer no longer moves anything.
    fireEvent.lostPointerCapture(divider(), { pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 700, pointerId: 1 });
    expect(onSplitChange).toHaveBeenCalledTimes(1);
    expect(root().style.getPropertyValue("--_drag")).toBe("");
  });

  it("ends a drag when the pointer is cancelled or taken away", () => {
    const onSplitChange = vi.fn();
    render(<Example onSplitChange={onSplitChange} />);
    fireEvent.pointerDown(divider(), { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 520, pointerId: 1 });
    fireEvent.pointerCancel(divider(), { pointerId: 1 });
    expect(root()).not.toHaveAttribute("data-dragging");
    expect(share()).toBe("0.52");
    fireEvent.pointerDown(divider(), { button: 0, clientX: 520, pointerId: 2 });
    fireEvent.pointerMove(divider(), { clientX: 500, pointerId: 2 });
    fireEvent.lostPointerCapture(divider(), { pointerId: 2 });
    expect(root()).not.toHaveAttribute("data-dragging");
    expect(share()).toBe("0.5");
    expect(onSplitChange.mock.calls.map(([value]) => value)).toEqual([0.52, 0.5]);
  });

  it("reports nothing for a press that does not move the divider", () => {
    const onSplitChange = vi.fn();
    render(<Example onSplitChange={onSplitChange} />);
    fireEvent.pointerDown(divider(), { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerUp(divider(), { pointerId: 1 });
    expect(onSplitChange).not.toHaveBeenCalled();
  });

  it("lets only the pointer that started a drag move it or end it", () => {
    render(<Example />);
    fireEvent.pointerDown(divider(), { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 700, pointerId: 2 });
    expect(root().style.getPropertyValue("--_drag")).toBe("");
    fireEvent.pointerDown(divider(), { button: 0, clientX: 700, pointerId: 2 });
    fireEvent.pointerUp(divider(), { pointerId: 2 });
    expect(root()).toHaveAttribute("data-dragging");
    fireEvent.pointerMove(divider(), { clientX: 530, pointerId: 1 });
    expect(root().style.getPropertyValue("--_drag")).toBe("0.53");
    fireEvent.pointerUp(divider(), { pointerId: 1 });
    expect(share()).toBe("0.53");
  });

  it("ignores other mouse buttons", () => {
    render(<Example />);
    fireEvent.pointerDown(divider(), { button: 2, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 600, pointerId: 1 });
    expect(root()).not.toHaveAttribute("data-dragging");
    expect(root().style.getPropertyValue("--_drag")).toBe("");
  });

  it("mirrors a drag in a right-to-left page", () => {
    render(
      <div style={{ direction: "rtl" }}>
        <Example />
      </div>,
    );
    fireEvent.pointerDown(divider(), { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 600, pointerId: 1 });
    fireEvent.pointerUp(divider(), { pointerId: 1 });
    expect(share()).toBe("0.4");
  });

  it("leaves a controlled split where its owner has it after a drag", () => {
    const onSplitChange = vi.fn();
    render(<Example split={0.5} onSplitChange={onSplitChange} />);
    fireEvent.pointerDown(divider(), { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 600, pointerId: 1 });
    fireEvent.pointerUp(divider(), { pointerId: 1 });
    expect(onSplitChange).toHaveBeenCalledExactlyOnceWith(0.6);
    expect(share()).toBe("0.5");
    expect(root().style.getPropertyValue("--_drag")).toBe("");
  });

  it("makes the tiles equal on a double click of the divider", async () => {
    const user = userEvent.setup();
    render(<Example defaultSplit={0.3} />);
    await user.dblClick(divider());
    expect(share()).toBe("0.5");
  });

  it("calls the caller's handlers first and stops when they prevent the default", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
    const onPointerDown = vi.fn((event: PointerEvent) => event.preventDefault());
    render(
      <SplitViewFullScreen data-testid="root">
        <SplitViewFullScreenTile side="leading" aria-label="Notes" />
        <SplitViewFullScreenDivider onKeyDown={onKeyDown} onPointerDown={onPointerDown} />
        <SplitViewFullScreenTile side="trailing" aria-label="Browser" />
      </SplitViewFullScreen>,
    );
    divider().focus();
    await user.keyboard("{ArrowRight}");
    expect(onKeyDown).toHaveBeenCalled();
    expect(share()).toBe("0.5");
    fireEvent.pointerDown(divider(), { button: 0, clientX: 500, pointerId: 1 });
    expect(onPointerDown).toHaveBeenCalled();
    expect(root()).not.toHaveAttribute("data-dragging");
  });

  it("forwards ref, className, style and other attributes on every part", () => {
    const rootRef = createRef<HTMLDivElement>();
    const tileRef = createRef<HTMLDivElement>();
    const dividerRef = createRef<HTMLDivElement>();
    const onPointerDown = vi.fn();
    render(
      <SplitViewFullScreen ref={rootRef} className="space" style={{ height: 300 }} id="space">
        <SplitViewFullScreenTile
          ref={tileRef}
          side="leading"
          className="notes"
          aria-label="Notes"
          id="notes"
          onPointerDown={onPointerDown}
        />
        <SplitViewFullScreenDivider
          ref={dividerRef}
          className="gutter"
          aria-label="Resize Notes"
          data-test="divider"
        />
        <SplitViewFullScreenTile side="trailing" aria-label="Browser" />
      </SplitViewFullScreen>,
    );
    expect(rootRef.current).toHaveClass("mac-split-view-full-screen", "space");
    expect(rootRef.current).toHaveStyle({ height: "300px" });
    expect(rootRef.current).toHaveAttribute("id", "space");
    expect(tileRef.current).toHaveClass("mac-window", "mac-split-view-full-screen-tile", "notes");
    expect(tileRef.current).toHaveAttribute("id", "notes");
    expect(dividerRef.current).toHaveClass("mac-split-view-full-screen-divider", "gutter");
    expect(dividerRef.current).toHaveAccessibleName("Resize Notes");
    // The divider names the leading tile by the id that tile was given.
    expect(dividerRef.current).toHaveAttribute("aria-controls", "notes");
    expect(dividerRef.current).toHaveAttribute("data-test", "divider");
    if (tileRef.current) fireEvent.pointerDown(tileRef.current);
    expect(onPointerDown).toHaveBeenCalled();
  });

  it("renders a tile on its own as a key window", () => {
    render(<SplitViewFullScreenTile side="trailing" aria-label="Alone" />);
    expect(tile("Alone")).toHaveAttribute("data-window-state", "key");
  });
});
