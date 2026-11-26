import { StockList, StockRow } from "macalicious/stock-row";

/**
 * Fixture for a ticker without a quote, which no screenshot shows: one row, 330 x 49 pt on the
 * sidebar's colour. The badge is 58.5 x 17.65 pt at x 259.5, 25.85 pt below the row's top, and
 * its text is at its right end.
 */
export default function VisualNoQuote() {
  return (
    <div style={{ width: 330, height: 49, background: "light-dark(#e7e8e9, #2c2d2f)" }}>
      <StockList aria-label="Watchlist">
        <StockRow symbol="ACME" name="Acme Corporation" price="--" change="--" direction="none" />
      </StockList>
    </div>
  );
}
