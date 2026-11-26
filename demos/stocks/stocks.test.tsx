import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { app, stocksApp } from "./app";
import { Stocks } from "./stocks";
import { darkMarket, formatPrice, history, lightMarket, statistics } from "./stocks-data";
import { DesktopStocks } from "./stocks-desktop";

/** A quote of the market the demo opens on. */
function quoteOf(symbol: string) {
  const found = lightMarket.quotes.find((candidate) => candidate.symbol === symbol);
  if (!found) throw new Error(`No quote for ${symbol}`);
  return found;
}

const frame = () => screen.getByRole("region", { name: "Stocks" });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
/** The large title of the pane: "Top Stories", or the symbol that is shown. */
const title = () => screen.getByRole("heading", { level: 2 });
/** The row of a symbol: the button that holds its symbol, name, sparkline and price. */
const row = (symbol: string) => button(new RegExp(`^${symbol} `));
/** The symbols the watchlist lists, in order. */
const symbols = () =>
  within(screen.getByRole("list", { name: "Symbols" }))
    .getAllByRole("listitem")
    .map((item) => item.querySelector(".mac-stock-row-symbol")?.textContent);
/** What the badges say, in order. */
const badges = () =>
  Array.from(frame().querySelectorAll(".mac-stock-row-badge"), (badge) => badge.textContent);
const headlines = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
const search = () => screen.getByRole("searchbox", { name: "Search" });
const chart = () => screen.getByRole("img", { name: /^[A-Z&\- ]+, (today|past)/i });
/** The toolbar row: the window's drag region. */
const bar = () => frame().querySelector("[data-window-drag-region]") as HTMLElement;
/** The view beside the sidebar. */
const pane = () => within(title().closest(".mac-stocks-pane") as HTMLElement);
/** A toolbar button that cannot be used stays in the toolbar's arrow-key order. */
const unavailable = (name: string) => button(name).getAttribute("aria-disabled") === "true";

describe("Stocks", () => {
  it("opens on the business news of the reference capture, at its size", () => {
    render(<Stocks />);
    expect(frame()).toHaveClass("mac-window", "mac-stocks");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveStyle({ width: "1148px", height: "803px" });

    expect(symbols()).toEqual([
      "Dow Jones",
      "S&P 500",
      "AAPL",
      "BA",
      "BRK-B",
      "DIS",
      "GE",
      "HD",
      "NKE",
      "SBUX",
    ]);
    expect(row("Dow Jones")).toHaveTextContent("Dow Jones Industrial Average");
    expect(row("Dow Jones")).toHaveTextContent("26,201.04");
    expect(badges().slice(0, 6)).toEqual(["+122.42", "+23.02", "+1.86", "+4.71", "+1.88", "-0.99"]);
    // Only Disney is down: its row is the red one.
    const down = Array.from(frame().querySelectorAll('[data-direction="loss"]'));
    expect(down).toHaveLength(1);
    expect(down[0]).toContainElement(row("DIS"));

    expect(button(/^Business News/)).toHaveAttribute("aria-current", "page");
    expect(title()).toHaveTextContent(/^Top Stories$/);
    expect(headlines()).toEqual(lightMarket.stories.map((story) => story.headline));
    // Nothing to go back from and nothing to share while the news is shown.
    expect(unavailable("Back")).toBe(true);
    expect(unavailable("Share")).toBe(true);
  });

  it("shows a symbol's price, chart and figures when its row is chosen", async () => {
    const user = userEvent.setup();
    render(<Stocks />);

    await user.click(row("AAPL"));
    expect(title()).toHaveTextContent(/^AAPL$/);
    expect(row("AAPL")).toHaveAttribute("aria-current", "true");
    expect(button(/^Business News/)).not.toHaveAttribute("aria-current");
    expect(pane().getByText("Apple Inc.")).toBeInTheDocument();
    expect(pane().getByText("220.82")).toBeInTheDocument();
    expect(pane().getByText("+1.86 (+0.85%)")).toBeInTheDocument();
    expect(chart()).toHaveAccessibleName("AAPL, today: from 218.96 to 220.82, +0.85%");
    const figures = Object.fromEntries(
      Array.from(frame().querySelectorAll(".mac-stocks-figure"), (figure) => [
        figure.querySelector("dt")?.textContent,
        figure.querySelector("dd")?.textContent,
      ]),
    );
    expect(figures).toEqual(Object.fromEntries(statistics(quoteOf("AAPL"))));
    expect(figures["Mkt Cap"]).toBe("997.9B");
    // The story about the symbol leads its news.
    expect(headlines()[1]).toBe("Stocks rise on hopes the Fed will cut rates again");

    // Another row replaces it: a symbol that is down, in the red.
    await user.click(row("DIS"));
    expect(title()).toHaveTextContent(/^DIS$/);
    expect(row("AAPL")).not.toHaveAttribute("aria-current");
    expect(pane().queryByText("220.82")).toBeNull();
    expect(pane().getByText("128.15")).toBeInTheDocument();
    const change = screen.getByText("-0.99 (-0.77%)");
    expect(change.closest("[data-direction]")).toHaveAttribute("data-direction", "loss");
    expect(chart().closest("[data-direction]")).toHaveAttribute("data-direction", "loss");
    expect(screen.getByText("230.9B")).toBeInTheDocument();
    expect(screen.queryByText("997.9B")).toBeNull();
  });

  it("returns to the news from the Back button and from the Business News cell", async () => {
    const user = userEvent.setup();
    render(<Stocks />);

    await user.click(row("GE"));
    expect(unavailable("Back")).toBe(false);
    await user.click(button("Back"));
    expect(title()).toHaveTextContent(/^Top Stories$/);
    expect(button(/^Business News/)).toHaveAttribute("aria-current", "page");
    expect(unavailable("Back")).toBe(true);

    await user.click(row("GE"));
    await user.click(button(/^Business News/));
    expect(title()).toHaveTextContent(/^Top Stories$/);
    expect(row("GE")).not.toHaveAttribute("aria-current");
  });

  it("draws the range that is chosen", async () => {
    const user = userEvent.setup();
    render(<Stocks />);
    await user.click(row("HD"));

    const ranges = () =>
      within(screen.getByRole("group", { name: "Range" }))
        .getAllByRole("button")
        .map((range) => [range.textContent, range.getAttribute("aria-pressed")]);
    expect(ranges().filter(([, pressed]) => pressed === "true")).toEqual([["1D", "true"]]);
    const day = chart().querySelector("polyline")?.getAttribute("points");

    await user.click(button("1Y"));
    expect(ranges().filter(([, pressed]) => pressed === "true")).toEqual([["1Y", "true"]]);
    const year = history(quoteOf("HD"), "1Y");
    expect(chart()).toHaveAccessibleName(
      new RegExp(`^HD, past year: from ${formatPrice(year[0] ?? 0)} to 226.81,`),
    );
    const points = chart().querySelector("polyline")?.getAttribute("points");
    expect(points).not.toBe(day);
    expect(points?.split(" ")).toHaveLength(year.length);
    expect(screen.getByText("Apr")).toBeInTheDocument();

    // The range is the app's, not the symbol's: the next symbol opens on it.
    await user.click(row("NKE"));
    expect(chart()).toHaveAccessibleName(/^NKE, past year:/);
  });

  it("changes what every badge shows when one is clicked", async () => {
    const user = userEvent.setup();
    render(<Stocks />);

    await user.click(button("+1.86, show percent change"));
    expect(badges().slice(0, 3)).toEqual(["+0.47%", "+0.80%", "+0.85%"]);
    expect(badges()[5]).toBe("-0.77%");

    await user.click(button("+0.85%, show market cap"));
    // An index has no market capitalisation and keeps its percentage.
    expect(badges().slice(0, 3)).toEqual(["+0.47%", "+0.80%", "997.9B"]);

    await user.click(button("997.9B, show price change"));
    expect(badges().slice(0, 3)).toEqual(["+122.42", "+23.02", "+1.86"]);
    // A badge is not the row: the news is still shown.
    expect(title()).toHaveTextContent(/^Top Stories$/);
  });

  it("filters the watchlist by symbol and by name", async () => {
    const user = userEvent.setup();
    render(<Stocks />);

    await user.type(search(), "b");
    expect(symbols()).toEqual(["BA", "BRK-B", "SBUX"]);
    await user.clear(search());
    await user.type(search(), "home");
    expect(symbols()).toEqual(["HD"]);

    // The row that is shown stays shown when the search hides its row.
    await user.click(row("HD"));
    await user.clear(search());
    await user.type(search(), "zzz");
    expect(screen.queryByRole("list", { name: "Symbols" })).toBeNull();
    expect(screen.getByText("No Results")).toBeInTheDocument();
    expect(title()).toHaveTextContent(/^HD$/);

    // Escape empties the field, as in every search field of the library.
    await user.keyboard("{Escape}");
    expect(search()).toHaveValue("");
    expect(symbols()).toHaveLength(10);
    expect(row("HD")).toHaveAttribute("aria-current", "true");
  });

  it("moves between the rows with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Stocks />);
    row("Dow Jones").focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(row("AAPL")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(title()).toHaveTextContent(/^AAPL$/);
  });

  it("shares the symbol that is shown from a menu", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    try {
      render(<Stocks />);
      await user.click(row("SBUX"));
      await user.click(button("Share"));
      await user.click(await screen.findByRole("menuitem", { name: "Copy Price" }));
      expect(writeText).toHaveBeenCalledWith("SBUX 84.67");
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("lists a symbol's alerts it is given, and offers the form only with onAddAlert", async () => {
    const user = userEvent.setup();
    const first = lightMarket.quotes[0]?.symbol ?? "";
    const open = async () => {
      const row = screen
        .getAllByRole("button")
        .find((button) => button.textContent?.startsWith(first));
      await user.click(row as HTMLElement);
    };
    const alerts = [{ id: "a1", symbol: first, above: 100 }];
    const { unmount } = render(<Stocks market={lightMarket} alerts={alerts} />);
    await open();
    // Read-only: the alert is listed, with no form to add one.
    expect(await screen.findByText("Above 100.00")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add Alert" })).toBeNull();
    unmount();
    // With onAddAlert, the form is offered too.
    render(<Stocks market={lightMarket} alerts={alerts} onAddAlert={vi.fn()} />);
    await open();
    expect(await screen.findByText("Above 100.00")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add Alert" })).toBeInTheDocument();
  });

  it("shows the market it is given", () => {
    const { rerender } = render(<Stocks market={darkMarket} />);
    expect(row("Dow Jones")).toHaveTextContent("26,428.87");
    expect(badges()[6]).toBe("-0.08");
    expect(headlines()).toEqual(darkMarket.stories.map((story) => story.headline));
    // The lead of this feed has its text beside the picture, with a summary.
    const lead = screen.getAllByRole("article")[0] as HTMLElement;
    expect(lead).toHaveAttribute("data-layout", "beside");
    expect(lead).toHaveTextContent("Stocks rise Friday after a September jobs report");

    rerender(<Stocks market={lightMarket} />);
    expect(screen.getAllByRole("article")[0]).toHaveAttribute("data-layout", "lead");
    expect(screen.queryByText(/^Stocks rise Friday/)).toBeNull();
  });

  it("shows a symbol whose session has not begun", async () => {
    const user = userEvent.setup();
    const quiet = { ...quoteOf("AAPL"), session: [] };
    render(<Stocks market={{ ...lightMarket, quotes: [quiet] }} />);
    await user.click(row("AAPL"));
    expect(title()).toHaveTextContent(/^AAPL$/);
    // With no prices of the day, the last price stands for its open, high and low.
    const day = Array.from(
      frame().querySelectorAll(".mac-stocks-figure dd"),
      (dd) => dd.textContent,
    );
    expect(day.slice(0, 3)).toEqual(["220.82", "220.82", "220.82"]);
    expect(chart().querySelector("polyline")).toHaveAttribute("points", "");
  });

  it("passes window props to its root", () => {
    const ref = createRef<HTMLDivElement>();
    const onPointerDown = vi.fn();
    render(
      <Stocks
        ref={ref}
        state="inactive"
        width="100%"
        height={500}
        className="mine"
        style={{ left: 10 }}
        id="stocks"
        onPointerDown={onPointerDown}
      />,
    );
    const root = frame();
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-window", "mac-stocks", "mine");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveAttribute("id", "stocks");
    expect(root).toHaveStyle({ width: "100%", height: "500px", left: "10px" });
    fireEvent.pointerDown(root);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("hands the window controls their props", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = render(
      <Stocks onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} zoomRole="zoom" />,
    );
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    // The window controls' props are not attributes of the window.
    expect(frame()).not.toHaveAttribute("zoomrole");

    rerender(<Stocks minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
    expect(button("Close")).toBeEnabled();
  });

  it("reports a press and a double click on the toolbar row, its drag region", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Stocks
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(bar()).toContainElement(button("Share"));

    fireEvent.pointerDown(bar(), { button: 2 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar(), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // The toolbar's controls and the content are not part of the drag region.
    fireEvent.pointerDown(button("Back"), { button: 0 });
    fireEvent.pointerDown(title(), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(bar());
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(stocksApp);
    expect(app).toMatchObject({
      id: "stocks",
      name: "Stocks",
      component: DesktopStocks,
      defaultSize: { width: 1148, height: 803 },
      minSize: { width: 700, height: 420 },
      resizable: true,
    });
    expect(app.menus).toEqual(["Stocks", "File", "Edit", "View", "Window", "Help"]);

    render(
      <WindowManager style={{ height: 900 }}>
        <ManagedWindow
          id={app.id}
          title={app.name}
          resizable={app.resizable}
          minWidth={app.minSize.width}
          minHeight={app.minSize.height}
          defaultFrame={{ x: 20, y: 30, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    const host = frame().parentElement as HTMLElement;
    expect(host).toHaveAttribute("data-window-id", "stocks");
    expect(host).toHaveStyle({ width: "1148px", height: "803px" });
    // The manager sizes the wrapper; the window fills it.
    expect(frame()).toHaveStyle({ width: "100%", height: "100%" });
    expect(frame()).toHaveAttribute("data-window-state", "key");

    // The manager moves the window by its toolbar row.
    const before = host.style.transform;
    fireEvent.pointerDown(bar(), { button: 0, pointerId: 1, clientX: 300, clientY: 50 });
    fireEvent.pointerMove(bar(), { pointerId: 1, clientX: 340, clientY: 80 });
    fireEvent.pointerUp(bar(), { pointerId: 1, clientX: 340, clientY: 80 });
    expect(host.style.transform).not.toBe(before);

    // The app still works in there.
    await user.click(row("BA"));
    expect(title()).toHaveTextContent(/^BA$/);

    await user.click(button("Close"));
    expect(screen.queryByRole("region", { name: "Stocks" })).toBeNull();
  });
});
