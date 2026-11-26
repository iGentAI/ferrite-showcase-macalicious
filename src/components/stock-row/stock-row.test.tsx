import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { StockList, StockRow, type StockRowProps } from "./index";

const APPLE: StockRowProps = {
  symbol: "AAPL",
  name: "Apple Inc.",
  price: "220.82",
  change: "+1.86",
  direction: "gain",
};

/** The points of the sparkline's line as [x, y] pairs, in points of its 54.67 x 26 box. */
function linePoints(chart: HTMLElement) {
  const points = chart.querySelector(".mac-stock-row-sparkline-line")?.getAttribute("points");
  return (points ?? "").split(" ").map((pair) => pair.split(",").map(Number));
}

function closeHeight(chart: HTMLElement) {
  return Number(chart.querySelector(".mac-stock-row-sparkline-close")?.getAttribute("y1"));
}

describe("StockList", () => {
  it("is a named list of rows", () => {
    render(
      <StockList aria-label="Watchlist">
        <StockRow {...APPLE} />
        <StockRow {...APPLE} symbol="GE" name="General Electric Company" />
      </StockList>,
    );
    const list = screen.getByRole("list", { name: "Watchlist" });
    expect(list).toHaveClass("mac-stock-row-list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("moves focus between the rows' buttons with the arrow keys, Home and End", async () => {
    const user = userEvent.setup();
    render(
      <StockList aria-label="Watchlist">
        <StockRow {...APPLE} symbol="A" onSelect={() => {}} onBadgeClick={() => {}} />
        <StockRow {...APPLE} symbol="B" onSelect={() => {}} />
        <StockRow {...APPLE} symbol="C" onSelect={() => {}} />
      </StockList>,
    );
    const row = (symbol: string) => screen.getByRole("button", { name: new RegExp(`^${symbol} `) });
    await user.tab();
    expect(row("A")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(row("B")).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(row("C")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(row("A")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(row("A")).toHaveFocus();
    await user.keyboard("{End}");
    expect(row("C")).toHaveFocus();
  });

  it("leaves the arrow keys alone on a badge, and Tab reaches every button in order", async () => {
    const user = userEvent.setup();
    render(
      <StockList aria-label="Watchlist">
        <StockRow {...APPLE} symbol="A" onSelect={() => {}} onBadgeClick={() => {}} />
        <StockRow {...APPLE} symbol="B" onSelect={() => {}} />
      </StockList>,
    );
    await user.tab();
    await user.tab();
    const badge = screen.getByRole("button", { name: "+1.86" });
    expect(badge).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(badge).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /^B / })).toHaveFocus();
  });

  it("lets its owner take a key first: a prevented key does not move the focus", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
    render(
      <StockList aria-label="Watchlist" onKeyDown={onKeyDown}>
        <StockRow {...APPLE} symbol="A" onSelect={() => {}} />
        <StockRow {...APPLE} symbol="B" onSelect={() => {}} />
      </StockList>,
    );
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /^A / })).toHaveFocus();
  });

  it("forwards ref, className, style and other attributes to the list", () => {
    const ref = createRef<HTMLDivElement>();
    render(<StockList ref={ref} className="mine" style={{ width: 330 }} id="list" data-a="1" />);
    expect(ref.current).toHaveRole("list");
    expect(ref.current).toHaveClass("mac-stock-row-list", "mine");
    expect(ref.current).toHaveStyle({ width: "330px" });
    expect(ref.current).toHaveAttribute("id", "list");
    expect(ref.current).toHaveAttribute("data-a", "1");
  });
});

describe("StockRow", () => {
  it("is a list item that reads symbol, name, price and change, with nothing to operate", () => {
    render(
      <StockList>
        <StockRow {...APPLE} />
      </StockList>,
    );
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("AAPL Apple Inc. 220.82 +1.86");
    expect(row).toHaveAttribute("data-direction", "gain");
    expect(row).not.toHaveAttribute("data-selected");
    expect(row).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("draws the sparkline as an image named after the trend, or by chartLabel", () => {
    render(
      <StockList>
        <StockRow {...APPLE} data={[1, 2]} />
        <StockRow {...APPLE} direction="loss" data={[2, 1]} />
        <StockRow {...APPLE} data={[1, 2]} chartLabel="Kurs steigt" />
      </StockList>,
    );
    const [gain, loss, named] = screen.getAllByRole("listitem");
    expect(within(gain as HTMLElement).getByRole("img", { name: "Trending up" })).toBeVisible();
    expect(within(loss as HTMLElement).getByRole("img", { name: "Trending down" })).toBeVisible();
    expect(within(named as HTMLElement).getByRole("img", { name: "Kurs steigt" })).toBeVisible();
    expect(loss).toHaveAttribute("data-direction", "loss");
  });

  it("draws no sparkline for fewer than two prices", () => {
    render(
      <StockList>
        <StockRow {...APPLE} data={[220.82]} previousClose={218.96} />
      </StockList>,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("spreads the prices over the box: lowest at the bottom, highest at the top", () => {
    render(
      <StockList>
        <StockRow {...APPLE} data={[10, 30, 20]} />
      </StockList>,
    );
    const points = linePoints(screen.getByRole("img"));
    expect(points.map(([, y]) => y)).toEqual([25.25, 0.75, 13]);
    expect(points[0]?.[0]).toBe(0);
    expect(points[2]?.[0]).toBe(54.67);
  });

  it("extends the range to the previous close and draws it across the box", () => {
    render(
      <StockList>
        <StockRow {...APPLE} data={[20, 30]} previousClose={10} />
      </StockList>,
    );
    const chart = screen.getByRole("img");
    expect(linePoints(chart)).toEqual([
      [0, 13],
      [54.67, 0.75],
    ]);
    expect(closeHeight(chart)).toBe(25.25);
    expect(chart.querySelector(".mac-stock-row-sparkline-close")).toHaveAttribute("x2", "54.67");
  });

  it("stops the line at the share of the session that has passed, clamped to 0..1", () => {
    render(
      <StockList>
        <StockRow {...APPLE} data={[1, 2]} progress={0.25} />
        <StockRow {...APPLE} data={[1, 2]} progress={4} />
        <StockRow {...APPLE} data={[1, 2]} progress={-1} />
      </StockList>,
    );
    const [quarter, over, under] = screen.getAllByRole("img");
    expect(linePoints(quarter as HTMLElement).map(([x]) => x)).toEqual([0, 13.67]);
    expect(linePoints(over as HTMLElement).map(([x]) => x)).toEqual([0, 54.67]);
    expect(linePoints(under as HTMLElement).map(([x]) => x)).toEqual([0, 0]);
  });

  it("maps the given domain to the box instead of the data's own range", () => {
    render(
      <StockList>
        <StockRow {...APPLE} data={[20, 30]} previousClose={25} domain={[0, 40]} />
      </StockList>,
    );
    const chart = screen.getByRole("img");
    expect(linePoints(chart).map(([, y]) => y)).toEqual([13, 6.88]);
    expect(closeHeight(chart)).toBe(9.94);
  });

  it("draws a session of any length: its range is not found by spreading the prices", () => {
    const data = Array.from({ length: 300_000 }, (_, index) => index % 1000);
    render(
      <StockList>
        <StockRow {...APPLE} data={data} />
      </StockList>,
    );
    const points = screen
      .getByRole("img")
      .querySelector(".mac-stock-row-sparkline-line")
      ?.getAttribute("points");
    expect(points?.startsWith("0,25.25 ")).toBe(true);
    expect(points?.endsWith("54.67,0.75")).toBe(true);
  });

  it("draws a session without movement as a level line in the middle", () => {
    render(
      <StockList>
        <StockRow {...APPLE} data={[5, 5, 5]} />
      </StockList>,
    );
    expect(linePoints(screen.getByRole("img")).map(([, y]) => y)).toEqual([13, 13, 13]);
  });

  it("becomes a button with onSelect, activated by click, Return and Space", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <StockList>
        <StockRow {...APPLE} data={[1, 2]} onSelect={onSelect} />
      </StockList>,
    );
    const button = screen.getByRole("button", { name: "AAPL Apple Inc. Trending up 220.82 +1.86" });
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(button).not.toHaveAttribute("aria-current");
  });

  it("marks the selected row as current: on its button, or on the item when it has none", () => {
    render(
      <StockList>
        <StockRow {...APPLE} symbol="A" selected onSelect={() => {}} />
        <StockRow {...APPLE} symbol="B" selected />
      </StockList>,
    );
    const [withButton, plain] = screen.getAllByRole("listitem");
    expect(withButton).toHaveAttribute("data-selected");
    expect(withButton).not.toHaveAttribute("aria-current");
    expect(within(withButton as HTMLElement).getByRole("button")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(plain).toHaveAttribute("data-selected");
    expect(plain).toHaveAttribute("aria-current", "true");
  });

  it("makes the badge a button of its own with onBadgeClick, apart from the row's", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onBadgeClick = vi.fn();
    render(
      <StockList>
        <StockRow {...APPLE} onSelect={onSelect} onBadgeClick={onBadgeClick} />
      </StockList>,
    );
    const badge = screen.getByRole("button", { name: "+1.86" });
    expect(screen.getByRole("button", { name: "AAPL Apple Inc. 220.82" })).not.toContainElement(
      badge,
    );
    await user.click(badge);
    badge.focus();
    await user.keyboard("{Enter}");
    expect(onBadgeClick).toHaveBeenCalledTimes(2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("names the badge button with badgeLabel", () => {
    render(
      <StockList>
        <StockRow {...APPLE} onBadgeClick={() => {}} badgeLabel="+1.86, show percent change" />
      </StockList>,
    );
    expect(screen.getByRole("button", { name: "+1.86, show percent change" })).toHaveTextContent(
      "+1.86",
    );
  });

  it("marks a ticker without a quote, and names its sparkline accordingly", () => {
    render(
      <StockList>
        <StockRow {...APPLE} price="--" change="--" direction="none" data={[1, 1, 1]} />
      </StockList>,
    );
    expect(screen.getByRole("listitem")).toHaveAttribute("data-direction", "none");
    expect(screen.getByRole("img", { name: "No change" })).toBeInTheDocument();
  });

  it("forwards ref, className, style and other attributes to the list item", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <StockList>
        <StockRow
          {...APPLE}
          ref={ref}
          className="mine"
          style={{ width: 400 }}
          id="aapl"
          data-ticker="AAPL"
        />
      </StockList>,
    );
    expect(ref.current).toHaveRole("listitem");
    expect(ref.current).toHaveClass("mac-stock-row", "mine");
    expect(ref.current).toHaveStyle({ width: "400px" });
    expect(ref.current).toHaveAttribute("id", "aapl");
    expect(ref.current).toHaveAttribute("data-ticker", "AAPL");
  });

  it("renders another element through the render prop", () => {
    render(
      <StockList>
        <StockRow {...APPLE} render={<article />} data-testid="row" />
      </StockList>,
    );
    const row = screen.getByTestId("row");
    expect(row.tagName).toBe("ARTICLE");
    expect(row).toHaveRole("listitem");
    expect(row).toHaveClass("mac-stock-row");
    expect(row).toHaveTextContent("AAPL");
  });
});
