import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  InspectorPanel,
  InspectorPanelHeader,
  InspectorPanelItem,
  InspectorPanelList,
  InspectorPanelSection,
} from "./index";

const header = (name: string) => screen.getByRole("button", { name });

describe("InspectorPanel", () => {
  it("is a key window named by its title, 265 points wide, with its content in the body", () => {
    render(
      <InspectorPanel title="Report.pdf Info" data-testid="panel">
        Content
      </InspectorPanel>,
    );
    const panel = screen.getByRole("region", { name: "Report.pdf Info" });
    expect(panel).toBe(screen.getByTestId("panel"));
    expect(panel).toHaveClass("mac-window", "mac-inspector-panel");
    expect(panel).toHaveAttribute("data-window-state", "key");
    expect(panel).toHaveStyle({ width: "265px" });
    expect(screen.getByText("Content")).toHaveClass("mac-inspector-panel-body");
  });

  it("passes state, width and height to the window", () => {
    render(<InspectorPanel title="Info" state="inactive" width={300} height={400} />);
    const panel = screen.getByRole("region", { name: "Info" });
    expect(panel).toHaveAttribute("data-window-state", "inactive");
    expect(panel).toHaveStyle({ width: "300px", height: "400px" });
  });

  it("has the three window controls and reports Close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<InspectorPanel title="Info" onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows given controls, or none for null", () => {
    const { rerender } = render(
      <InspectorPanel title="Info" controls={<button type="button">Custom</button>} />,
    );
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    rerender(<InspectorPanel title="Info" controls={null} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("reports a press on its title bar, and not one on a window control, for a window manager", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <InspectorPanel
        title="Info"
        data-testid="panel"
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const close = screen.getByRole("button", { name: "Close" });
    await user.pointer([{ keys: "[MouseLeft>]", target: close }, { keys: "[/MouseLeft]" }]);
    await user.dblClick(close);
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    expect(onDragRegionDoubleClick).not.toHaveBeenCalled();
    const bar = screen
      .getByTestId("panel")
      .querySelector("[data-window-drag-region]") as HTMLElement;
    await user.pointer([{ keys: "[MouseLeft>]", target: bar }, { keys: "[/MouseLeft]" }]);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("shows the proxy icon before the title, hidden from assistive technology", () => {
    render(<InspectorPanel title="Info" icon={<svg data-testid="proxy" />} />);
    expect(screen.getByTestId("proxy").closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("forwards ref, className and native attributes to the frame", () => {
    const ref = createRef<HTMLDivElement>();
    render(<InspectorPanel ref={ref} className="extra" id="info" aria-label="Info" />);
    expect(ref.current).toHaveClass("mac-inspector-panel", "extra");
    expect(ref.current).toHaveAttribute("id", "info");
  });
});

describe("InspectorPanelHeader", () => {
  it("shows the name, the detail and the secondary line, and hides the icon", () => {
    render(
      <InspectorPanelHeader
        data-testid="header"
        icon={<svg data-testid="icon" />}
        title="Report.pdf"
        detail="2.4 MB"
        subtitle="Modified: Today"
      >
        <input aria-label="Tags" />
      </InspectorPanelHeader>,
    );
    const root = screen.getByTestId("header");
    expect(root).toHaveClass("mac-inspector-panel-header");
    expect(screen.getByText("Report.pdf")).toHaveClass("mac-inspector-panel-header-title");
    expect(screen.getByText("2.4 MB")).toHaveClass("mac-inspector-panel-header-detail");
    expect(screen.getByText("Modified: Today")).toHaveClass("mac-inspector-panel-header-subtitle");
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(root).toContainElement(screen.getByRole("textbox", { name: "Tags" }));
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<InspectorPanelHeader ref={ref} className="extra" id="header" title="A" />);
    expect(ref.current).toHaveClass("mac-inspector-panel-header", "extra");
    expect(ref.current).toHaveAttribute("id", "header");
  });
});

describe("InspectorPanelSection", () => {
  it("is collapsed by default: a header button and no content in the DOM", () => {
    render(<InspectorPanelSection title="Comments:">The comments</InspectorPanelSection>);
    expect(header("Comments:")).toHaveAttribute("aria-expanded", "false");
    expect(header("Comments:")).toHaveClass("mac-inspector-panel-section-header");
    expect(screen.queryByText("The comments")).not.toBeInTheDocument();
  });

  it("expands and collapses on click and reports the change (uncontrolled)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <InspectorPanelSection title="General:" onOpenChange={onOpenChange}>
        The details
      </InspectorPanelSection>,
    );
    await user.click(header("General:"));
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(header("General:")).toHaveAttribute("aria-expanded", "true");
    expect(header("General:")).toHaveAttribute("data-panel-open");
    expect(screen.getByText("The details")).toBeVisible();
    expect(header("General:")).toHaveAttribute("aria-controls", screen.getByText("The details").id);
    await user.click(header("General:"));
    expect(onOpenChange.mock.calls[1]?.[0]).toBe(false);
    expect(header("General:")).toHaveAttribute("aria-expanded", "false");
  });

  it("starts expanded with defaultOpen", () => {
    render(
      <InspectorPanelSection title="General:" defaultOpen>
        The details
      </InspectorPanelSection>,
    );
    expect(header("General:")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("The details")).toHaveClass("mac-inspector-panel-section-content");
  });

  it("follows a controlled open state", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function Controlled({ follow }: { follow: boolean }) {
      const [open, setOpen] = useState(false);
      return (
        <InspectorPanelSection
          title="General:"
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            if (follow) setOpen(next);
          }}
        >
          The details
        </InspectorPanelSection>
      );
    }
    const { rerender } = render(<Controlled follow={false} />);
    await user.click(header("General:"));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(header("General:")).toHaveAttribute("aria-expanded", "false");
    rerender(<Controlled follow />);
    await user.click(header("General:"));
    expect(header("General:")).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles with Space and Return, expands with Right Arrow and collapses with Left Arrow", async () => {
    const user = userEvent.setup();
    render(<InspectorPanelSection title="General:">The details</InspectorPanelSection>);
    await user.tab();
    expect(header("General:")).toHaveFocus();
    await user.keyboard(" ");
    expect(header("General:")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Enter}");
    expect(header("General:")).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowLeft}");
    expect(header("General:")).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowRight}");
    expect(header("General:")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowRight}");
    expect(header("General:")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowLeft}");
    expect(header("General:")).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the arrow key it handles from scrolling, and leaves the others alone", () => {
    render(<InspectorPanelSection title="General:">The details</InspectorPanelSection>);
    // fireEvent returns false when the event's default action was prevented.
    expect(fireEvent.keyDown(header("General:"), { key: "ArrowLeft" })).toBe(true);
    expect(header("General:")).toHaveAttribute("aria-expanded", "false");
    expect(fireEvent.keyDown(header("General:"), { key: "ArrowRight" })).toBe(false);
    expect(header("General:")).toHaveAttribute("aria-expanded", "true");
    expect(fireEvent.keyDown(header("General:"), { key: "ArrowDown" })).toBe(true);
    expect(header("General:")).toHaveAttribute("aria-expanded", "true");
  });

  it("leaves an arrow key alone that a handler before it has prevented", () => {
    const onOpenChange = vi.fn();
    render(
      <div onKeyDownCapture={(event) => event.preventDefault()}>
        <InspectorPanelSection title="General:" onOpenChange={onOpenChange}>
          The details
        </InspectorPanelSection>
      </div>,
    );
    fireEvent.keyDown(header("General:"), { key: "ArrowRight" });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(header("General:")).toHaveAttribute("aria-expanded", "false");
  });

  it("cannot be toggled when disabled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <InspectorPanelSection title="Preview:" disabled onOpenChange={onOpenChange}>
        The preview
      </InspectorPanelSection>,
    );
    await user.click(header("Preview:"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(header("Preview:")).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps collapsed content in the DOM with keepMounted", () => {
    render(
      <InspectorPanelSection title="Comments:" keepMounted>
        The comments
      </InspectorPanelSection>,
    );
    expect(screen.getByText("The comments")).not.toBeVisible();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<InspectorPanelSection ref={ref} className="extra" id="section" title="General:" />);
    expect(ref.current).toHaveClass("mac-inspector-panel-section", "extra");
    expect(ref.current).toHaveAttribute("id", "section");
  });
});

describe("InspectorPanelList", () => {
  it("is a description list of terms and their values", () => {
    render(
      <InspectorPanelList data-testid="list">
        <InspectorPanelItem label="Kind:">PDF document</InspectorPanelItem>
        <InspectorPanelItem label="Pages:">81</InspectorPanelItem>
      </InspectorPanelList>,
    );
    expect(screen.getByTestId("list").tagName).toBe("DL");
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Kind:",
      "Pages:",
    ]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "PDF document",
      "81",
    ]);
  });

  it("forwards ref, className and native attributes on the list and its items", () => {
    const list = createRef<HTMLDListElement>();
    const item = createRef<HTMLDivElement>();
    render(
      <InspectorPanelList ref={list} className="l" id="list">
        <InspectorPanelItem ref={item} className="i" id="item" label="Kind:">
          PDF
        </InspectorPanelItem>
      </InspectorPanelList>,
    );
    expect(list.current).toHaveClass("mac-inspector-panel-list", "l");
    expect(list.current).toHaveAttribute("id", "list");
    expect(item.current).toHaveClass("mac-inspector-panel-item", "i");
    expect(item.current).toHaveAttribute("id", "item");
  });
});
