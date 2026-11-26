import { StockList, StockRow } from "macalicious/stock-row";

/**
 * Fixture for what no screenshot shows: a selected row over a row whose badge is a button.
 * 330 x 97 pt on the sidebar's colour; the rows are 48.2 pt tall, the badges 58.5 x 17.65 pt
 * at x 259.5, 25.85 pt below each row's top. Neither row has a sparkline, so the middle of
 * each row is clear.
 */
export default function VisualStates() {
  return (
    <div style={{ width: 330, height: 97, background: "light-dark(#e7e8e9, #2c2d2f)" }}>
      <StockList aria-label="Watchlist">
        <StockRow
          symbol="AAPL"
          name="Apple Inc."
          price="220.82"
          change="+1.86"
          direction="gain"
          selected
          onSelect={() => {}}
        />
        <StockRow
          symbol="GE"
          name="General Electric Company"
          price="8.63"
          change="-0.08"
          direction="loss"
          onBadgeClick={() => {}}
        />
      </StockList>
    </div>
  );
}
