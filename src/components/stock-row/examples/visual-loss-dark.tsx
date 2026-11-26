import { StockList, StockRow } from "macalicious/stock-row";

// The reference's line, traced column by column and corrected against the rendering: its
// height above the bottom of the sparkline's box, in points, every quarter point from the
// box's left edge to 24 pt.
const SESSION = `
15.05 13.84 12.63 11.41 9.57 7.73 7.77 7.81 8.68 9.55 10.07 10.6 10.21 9.82 9.24 8.66 8.43
8.19 7.54 6.9 6.28 5.66 5.93 6.19 7.25 8.31 8.65 8.99 8.64 8.3 7.96 7.63 7.47 7.32 7.31 7.31
7.44 7.57 7.84 8.11 8.89 9.68 9.99 10.3 10.29 10.28 10.11 9.93 9.96 9.99 10.69 11.39 12.13
12.87 12.77 12.66 12.11 11.55 11.36 11.17 11.55 11.93 12.3 12.67 12.74 12.81 12.63 12.45
12.19 11.93 11.46 10.98 10.18 9.37 8.52 7.67 8.71 9.75 10.63 11.5 11.53 11.55 11.86 12.16
12.16 12.17 12.31 12.45 13.18 13.91 14.04 14.18 14.09 13.99 13.88 13.77 13.66`
  .trim()
  .split(/\s+/)
  .map(Number);

/**
 * Visual comparison target: the seventh row of the Stocks watchlist in Dark Aqua, a loss 44%
 * of the way through the session, with the previous close above everything the line reaches.
 *
 * Reference crop (2x pixels) x=114 y=906 w=656 h=96, that is 328 x 48 pt of the sidebar
 * (#2c2d2f). The row's top is at y=905.36 in the screenshot (six rows of 48.2 pt below the
 * first), so the list is shifted up by 0.32 pt, with a transform: a margin would be snapped to
 * the device pixel. The series is the screenshot's own line, traced, and `domain` maps a value
 * straight to a height in the box; the previous close lies 0.09 pt above the highest of them.
 * The line ends 24 pt along the 54.67 pt box.
 */
export default function VisualLossDark() {
  return (
    <div
      style={{
        width: 328,
        height: 48,
        overflow: "hidden",
        background: "light-dark(#e7e8e9, #2c2d2f)",
      }}
    >
      <StockList
        aria-label="Watchlist"
        style={{ width: 330, marginLeft: -1, transform: "translateY(-0.32px)" }}
      >
        <StockRow
          symbol="GE"
          name="General Electric Company"
          price="8.63"
          change="-0.08"
          direction="loss"
          data={SESSION}
          previousClose={25.34}
          domain={[0.75, 25.25]}
          progress={24 / 54.67}
        />
      </StockList>
    </div>
  );
}
