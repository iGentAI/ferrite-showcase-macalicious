import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type CSSProperties, createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "../toolbar";
import { ToolbarButton } from "../toolbar-button";
import { Window } from "../window";
import { WindowControls } from "../window-controls";
import {
  CatalystChrome,
  CatalystSidebar,
  CatalystSidebarGroup,
  CatalystSidebarItem,
} from "./index";

function News(props: Partial<Parameters<typeof CatalystChrome>[0]>) {
  return (
    <Window>
      <CatalystChrome
        title="News"
        controls={<WindowControls />}
        toolbar={
          <Toolbar aria-label="News toolbar">
            <ToolbarButton aria-label="Back">‹</ToolbarButton>
          </Toolbar>
        }
        sidebar={
          <CatalystSidebar aria-label="Channels">
            <CatalystSidebarGroup title="Apple News">
              <CatalystSidebarItem selected>Today</CatalystSidebarItem>
              <CatalystSidebarItem>History</CatalystSidebarItem>
            </CatalystSidebarGroup>
            <CatalystSidebarGroup title="Following">
              <CatalystSidebarItem>Science</CatalystSidebarItem>
            </CatalystSidebarGroup>
          </CatalystSidebar>
        }
        {...props}
      >
        <p>Top Stories</p>
      </CatalystChrome>
    </Window>
  );
}

describe("CatalystChrome", () => {
  it("names its window by the title and holds the toolbar, the sidebar and the content", () => {
    render(<News data-testid="chrome" />);
    const region = screen.getByRole("region", { name: "News" });
    expect(within(region).getByRole("toolbar", { name: "News toolbar" })).toBeInTheDocument();
    expect(within(region).getByRole("navigation", { name: "Channels" })).toBeInTheDocument();
    expect(within(region).getByText("Top Stories")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /close/i })).toBeInTheDocument();
    expect(screen.getByTestId("chrome")).toHaveClass("mac-catalyst-chrome");
  });

  it("takes the whole width for the content without a sidebar", () => {
    render(<News sidebar={undefined} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByText("Top Stories")).toBeInTheDocument();
  });

  it("marks content that runs under the toolbar", () => {
    const { rerender } = render(<News data-testid="chrome" />);
    expect(screen.getByTestId("chrome")).not.toHaveAttribute("data-under-toolbar");
    rerender(<News data-testid="chrome" underToolbar />);
    expect(screen.getByTestId("chrome")).toHaveAttribute("data-under-toolbar");
  });

  it("reports a press and a double click on the toolbar's surface, not on its buttons", async () => {
    const user = userEvent.setup();
    const onDown = vi.fn();
    const onDouble = vi.fn();
    render(<News onDragRegionPointerDown={onDown} onDragRegionDoubleClick={onDouble} />);
    const bar = screen.getByText("News").closest(".mac-catalyst-chrome-bar") as HTMLElement;
    fireEvent.pointerDown(screen.getByRole("button", { name: "Back" }), { button: 0 });
    expect(onDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar, { button: 0 });
    expect(onDown).toHaveBeenCalledTimes(1);
    await user.dblClick(bar);
    expect(onDouble).toHaveBeenCalledTimes(1);
  });

  it("draws no toolbar row when asked, and keeps the window controls in a strip that is the drag region", async () => {
    const user = userEvent.setup();
    const onDown = vi.fn();
    const onDouble = vi.fn();
    render(
      <Window aria-label="Find My">
        <CatalystChrome
          data-testid="chrome"
          bar="none"
          title="Not drawn"
          controls={<WindowControls />}
          sidebar={<CatalystSidebar aria-label="People" divider="plain" />}
          onDragRegionPointerDown={onDown}
          onDragRegionDoubleClick={onDouble}
        />
      </Window>,
    );
    const chrome = screen.getByTestId("chrome");
    expect(chrome).toHaveAttribute("data-bar", "none");
    expect(chrome.querySelector(".mac-catalyst-chrome-bar")).toBeNull();
    expect(screen.queryByText("Not drawn")).not.toBeInTheDocument();
    const close = screen.getByRole("button", { name: /close/i });
    const strip = close.closest(".mac-catalyst-chrome-strip") as HTMLElement;
    expect(strip).toHaveAttribute("data-window-drag-region");
    fireEvent.pointerDown(close, { button: 0 });
    fireEvent.pointerDown(strip, { button: 2 });
    expect(onDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(strip, { button: 0 });
    expect(onDown).toHaveBeenCalledTimes(1);
    await user.dblClick(strip);
    expect(onDouble).toHaveBeenCalledTimes(1);
  });

  it("lets a Window handler cancel a press and a double click on the strip, and on the toolbar row", async () => {
    const user = userEvent.setup();
    const onDown = vi.fn();
    const onDouble = vi.fn();
    const veto = (event: { preventDefault(): void }) => event.preventDefault();
    const { rerender } = render(
      <Window aria-label="Find My" onPointerDownCapture={veto} onDoubleClickCapture={veto}>
        <CatalystChrome
          bar="none"
          controls={<WindowControls />}
          onDragRegionPointerDown={onDown}
          onDragRegionDoubleClick={onDouble}
        />
      </Window>,
    );
    const strip = screen
      .getByRole("button", { name: /close/i })
      .closest(".mac-catalyst-chrome-strip") as HTMLElement;
    fireEvent.pointerDown(strip, { button: 0 });
    await user.dblClick(strip);
    expect(onDown).not.toHaveBeenCalled();
    expect(onDouble).not.toHaveBeenCalled();

    // The same window without the veto: the strip moves and zooms it again.
    rerender(
      <Window aria-label="Find My">
        <CatalystChrome
          bar="none"
          controls={<WindowControls />}
          onDragRegionPointerDown={onDown}
          onDragRegionDoubleClick={onDouble}
        />
      </Window>,
    );
    fireEvent.pointerDown(strip, { button: 0 });
    await user.dblClick(strip);
    expect(onDown).toHaveBeenCalled();
    expect(onDouble).toHaveBeenCalledTimes(1);

    // The toolbar row is a title bar, which keeps the same veto.
    onDown.mockClear();
    onDouble.mockClear();
    rerender(
      <Window onPointerDownCapture={veto} onDoubleClickCapture={veto}>
        <CatalystChrome
          title="News"
          controls={<WindowControls />}
          onDragRegionPointerDown={onDown}
          onDragRegionDoubleClick={onDouble}
        />
      </Window>,
    );
    const bar = screen.getByText("News").closest(".mac-catalyst-chrome-bar") as HTMLElement;
    fireEvent.pointerDown(bar, { button: 0 });
    await user.dblClick(bar);
    expect(onDown).not.toHaveBeenCalled();
    expect(onDouble).not.toHaveBeenCalled();
  });

  it("says which bar it draws", () => {
    render(<News data-testid="chrome" />);
    expect(screen.getByTestId("chrome")).toHaveAttribute("data-bar", "toolbar");
  });

  it("tells the toolbar how wide the sidebar's column is, unless the style says", () => {
    const { rerender } = render(<News data-testid="chrome" />);
    const chrome = screen.getByTestId("chrome");
    expect(chrome).toHaveStyle({ "--mac-catalyst-chrome-sidebar-width": "227px" });
    rerender(
      <News
        data-testid="chrome"
        sidebar={<CatalystSidebar aria-label="Watchlist" width={330} />}
      />,
    );
    expect(chrome).toHaveStyle({ "--mac-catalyst-chrome-sidebar-width": "330px" });
    const own = { "--mac-catalyst-chrome-sidebar-width": "calc(50% - 10px)" } as CSSProperties;
    rerender(
      <News
        data-testid="chrome"
        sidebar={<CatalystSidebar aria-label="Watchlist" width={330} style={own} />}
      />,
    );
    expect(chrome).toHaveStyle({ "--mac-catalyst-chrome-sidebar-width": "calc(50% - 10px)" });
    rerender(<News data-testid="chrome" sidebar={undefined} />);
    expect(chrome.style.getPropertyValue("--mac-catalyst-chrome-sidebar-width")).toBe("");
    const wrapped = { "--mac-catalyst-chrome-sidebar-width": "280px" } as CSSProperties;
    rerender(<News data-testid="chrome" sidebar={<nav aria-label="Own" />} style={wrapped} />);
    expect(chrome).toHaveStyle({ "--mac-catalyst-chrome-sidebar-width": "280px" });
  });

  it("forwards ref, className, style and other attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<News ref={ref} className="news" style={{ minHeight: 300 }} id="news" />);
    expect(ref.current).toHaveClass("mac-catalyst-chrome", "news");
    expect(ref.current).toHaveStyle({ minHeight: "300px" });
    expect(ref.current).toHaveAttribute("id", "news");
  });
});

describe("CatalystSidebar", () => {
  it("groups its rows under their headers", () => {
    render(<News />);
    const first = screen.getByRole("group", { name: "Apple News" });
    expect(within(first).getAllByRole("button")).toHaveLength(2);
    const second = screen.getByRole("group", { name: "Following" });
    expect(within(second).getByRole("button", { name: "Science" })).toBeInTheDocument();
  });

  it("marks only the selected row as current", () => {
    render(<News />);
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "History" })).not.toHaveAttribute("aria-current");
  });

  it("activates a row by click, Return and Space, in Tab order", async () => {
    const user = userEvent.setup();
    const onToday = vi.fn();
    const onSaved = vi.fn();
    render(
      <CatalystSidebar aria-label="Channels">
        <CatalystSidebarItem onClick={onToday}>Today</CatalystSidebarItem>
        <CatalystSidebarItem onClick={onSaved}>Saved</CatalystSidebarItem>
      </CatalystSidebar>,
    );
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(onToday).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(screen.getByRole("button", { name: "Saved" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onSaved).toHaveBeenCalledTimes(2);
  });

  it("keeps the icon out of the row's name", () => {
    render(
      <CatalystSidebarItem icon={<svg aria-label="logo" role="img" />}>
        Business
      </CatalystSidebarItem>,
    );
    expect(screen.getByRole("button", { name: "Business" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a row as a link when asked, without a button type", () => {
    render(
      <CatalystSidebarItem render={<a href="/today" />} selected>
        Today
      </CatalystSidebarItem>,
    );
    const link = screen.getByRole("link", { name: "Today" });
    expect(link).toHaveAttribute("href", "/today");
    expect(link).not.toHaveAttribute("type");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("never submits a form it stands in, as a button of any kind", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    // The buttons below have no type on purpose: the row has to supply it.
    render(
      <form onSubmit={onSubmit}>
        <CatalystSidebarItem>Plain</CatalystSidebarItem>
        {/* biome-ignore lint/a11y/useButtonType: the case under test */}
        <CatalystSidebarItem render={<button />}>Element</CatalystSidebarItem>
        <CatalystSidebarItem render={(props) => <button {...props} />}>
          Function
        </CatalystSidebarItem>
        <CatalystSidebarItem render={<button type="submit" />}>Submit</CatalystSidebarItem>
        {/* biome-ignore lint/a11y/useButtonType: the case under test */}
        <CatalystSidebarItem type="submit" render={<button />}>
          Typed row
        </CatalystSidebarItem>
      </form>,
    );
    for (const name of ["Plain", "Element", "Function"]) {
      const row = screen.getByRole("button", { name });
      expect(row).toHaveAttribute("type", "button");
      await user.click(row);
    }
    expect(onSubmit).not.toHaveBeenCalled();
    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toHaveAttribute("type", "submit");
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const typed = screen.getByRole("button", { name: "Typed row" });
    expect(typed).toHaveAttribute("type", "submit");
    await user.click(typed);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("sets the column's width, 227 pt unless given", () => {
    render(
      <>
        <CatalystSidebar aria-label="News" />
        <CatalystSidebar aria-label="Stocks" width={330} />
      </>,
    );
    expect(screen.getByRole("navigation", { name: "News" })).toHaveStyle({
      "--mac-catalyst-chrome-sidebar-width": "227px",
    });
    expect(screen.getByRole("navigation", { name: "Stocks" })).toHaveStyle({
      "--mac-catalyst-chrome-sidebar-width": "330px",
    });
  });

  it("ends the column with a line unless asked for the shade or the plain line", () => {
    render(
      <>
        <CatalystSidebar aria-label="News" />
        <CatalystSidebar aria-label="Stocks" divider="shade" />
        <CatalystSidebar aria-label="Find My" divider="plain" />
      </>,
    );
    expect(screen.getByRole("navigation", { name: "Find My" })).toHaveAttribute(
      "data-divider",
      "plain",
    );
    expect(screen.getByRole("navigation", { name: "News" })).toHaveAttribute(
      "data-divider",
      "line",
    );
    expect(screen.getByRole("navigation", { name: "Stocks" })).toHaveAttribute(
      "data-divider",
      "shade",
    );
  });

  it("forwards ref, className and attributes on the sidebar, a group and a row", () => {
    const nav = createRef<HTMLElement>();
    const group = createRef<HTMLDivElement>();
    const row = createRef<HTMLButtonElement>();
    render(
      <CatalystSidebar ref={nav} aria-label="Channels" className="channels" data-kind="list">
        <CatalystSidebarGroup ref={group} title="Following" className="following" id="following">
          <CatalystSidebarItem ref={row} className="science" data-channel="science">
            Science
          </CatalystSidebarItem>
        </CatalystSidebarGroup>
      </CatalystSidebar>,
    );
    expect(nav.current).toHaveClass("mac-catalyst-chrome-sidebar", "channels");
    expect(nav.current).toHaveAttribute("data-kind", "list");
    expect(group.current).toHaveClass("mac-catalyst-chrome-sidebar-group", "following");
    expect(group.current).toHaveAttribute("id", "following");
    expect(row.current).toHaveClass("mac-catalyst-chrome-sidebar-item", "science");
    expect(row.current).toHaveAttribute("data-channel", "science");
    expect(row.current).toHaveAttribute("type", "button");
  });
});
