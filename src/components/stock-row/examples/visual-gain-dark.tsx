import { StockList, StockRow } from "macalicious/stock-row";

// The reference's line, traced column by column and corrected against the rendering: its
// height above the bottom of the sparkline's box, in points, every quarter point from the
// box's left edge to 24 pt.
const SESSION = `
6.45 6.78 7.11 7.44 7.87 8.3 8.58 8.86 8.84 8.83 9.2 9.57 9.92 10.27 11.18 12.1 12.29 12.48
11.89 11.31 10.73 10.15 10.3 10.45 10.84 11.22 11.44 11.66 11.29 10.92 10.63 10.35 10.13 9.9
9.66 9.42 9.17 8.92 8.93 8.95 8.95 8.95 9.04 9.12 9.32 9.52 9.64 9.76 9.96 10.16 10.19 10.21
10.33 10.45 10.68 10.92 11 11.09 11.37 11.64 11.85 12.05 12.22 12.39 12.64 12.88 13.02 13.15
13.65 14.15 14.16 14.16 14.21 14.25 14.25 14.25 14.16 14.07 13.85 13.63 13.62 13.61 13.66
13.72 13.85 13.98 13.87 13.75 13.65 13.55 13.47 13.39 13.39 13.39 13.41 13.43 13.45`
  .trim()
  .split(/\s+/)
  .map(Number);

/**
 * Visual comparison target: the first row of the Stocks watchlist in Dark Aqua, a gain 44% of
 * the way through the session, so the line stops there and the dashed previous close runs on.
 *
 * Reference crop (2x pixels) x=114 y=328 w=656 h=96, that is 328 x 48 pt of the sidebar
 * (#2c2d2f); the row's top-left corner is at 112,327, as in visual-gain-light. The series is
 * the screenshot's own line, traced, and `domain` maps a value straight to a height in the
 * box. The line ends 24 pt along the 54.67 pt box.
 */
export default function VisualGainDark() {
  return (
    <div
      style={{
        width: 328,
        height: 48,
        overflow: "hidden",
        background: "light-dark(#e7e8e9, #2c2d2f)",
      }}
    >
      <StockList aria-label="Watchlist" style={{ width: 330, margin: "-0.5px 0 0 -1px" }}>
        <StockRow
          symbol="Dow Jones"
          name="Dow Jones Industrial Average"
          price="26,428.87"
          change="+227.83"
          direction="gain"
          data={SESSION}
          previousClose={1.87}
          domain={[0.75, 25.25]}
          progress={24 / 54.67}
        />
      </StockList>
    </div>
  );
}
