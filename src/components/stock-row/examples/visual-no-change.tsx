import { StockList, StockRow } from "macalicious/stock-row";

/**
 * Fixture for a session without a change, which no screenshot shows: one row, 330 x 49 pt on
 * the sidebar's colour, with a flat session and a previous close above it. The sparkline's box
 * is 54.67 x 26 pt from x 194, 13 pt below the row's top; in a domain of 0 to 26 the session's
 * line is centred 26.5 pt below the row's top and the previous close 19.5 pt below it (the
 * box keeps 0.75 pt at its top and foot for the line's width).
 */
export default function VisualNoChange() {
  return (
    <div style={{ width: 330, height: 49, background: "light-dark(#e7e8e9, #2c2d2f)" }}>
      <StockList aria-label="Watchlist">
        <StockRow
          symbol="ACME"
          name="Acme Corporation"
          price="12.50"
          change="0.00"
          direction="none"
          data={[12.5, 12.5, 12.5, 12.5]}
          previousClose={19.9}
          domain={[0, 26]}
        />
      </StockList>
    </div>
  );
}
