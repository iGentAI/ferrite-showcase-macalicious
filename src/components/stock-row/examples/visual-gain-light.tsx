import { StockList, StockRow } from "macalicious/stock-row";

// The reference's line, traced column by column and corrected against the rendering: its
// height above the bottom of the sparkline's box, in points, every quarter point from the
// box's left edge to 54.5 pt. The trough at 5.5 pt runs below the box in the screenshot and
// is cut off there; the values under 0.75 continue its two sides to where they meet.
const SESSION = `
9.81 9.8 9.79 9.79 9.79 9.78 10.14 10.5 10.08 9.66 9.38 9.1 9.46 9.81 8.22 6.64 5.68 4.72
3.71 2.7 1.67 0.63 0.25 -0.13 0.49 1.1 1.72 2.34 2.92 3.5 4.24 4.98 5.33 5.68 6.04 6.39 6.67
6.95 7.02 7.08 6.91 6.74 6.58 6.42 6.19 5.95 6.33 6.72 7.17 7.62 8.31 9.01 9.41 9.82 10.31
10.8 11.29 11.77 12.52 13.28 12.82 12.36 12.17 11.98 11.79 11.6 11.41 11.22 11.03 10.83
10.64 10.45 10.2 9.95 9.91 9.88 9.97 10.06 10.06 10.06 10.1 10.13 10.23 10.33 10.54 10.76
10.97 11.18 11.46 11.74 11.71 11.67 11.8 11.93 12.04 12.15 12.25 12.36 12.46 12.57 12.68
12.79 12.89 13 13.1 13.2 13.38 13.55 13.68 13.8 13.91 14.03 14.11 14.2 14.27 14.33 14.41
14.5 14.46 14.42 14.2 13.98 13.79 13.6 13.57 13.55 13.55 13.55 13.57 13.59 13.64 13.69 13.8
13.91 14.01 14.11 14.29 14.47 14.69 14.9 15.09 15.28 15.43 15.57 15.86 16.15 16.13 16.11
15.96 15.81 15.77 15.73 15.54 15.34 15.18 15.01 14.86 14.71 14.84 14.97 15.18 15.38 15.52
15.66 15.66 15.66 15.67 15.68 15.68 15.67 15.54 15.42 15.27 15.12 15.13 15.13 15.25 15.36
15.52 15.69 15.63 15.57 15.38 15.18 14.99 14.8 14.82 14.84 14.95 15.05 15.1 15.15 14.98
14.81 14.77 14.73 14.5 14.27 14.14 14.02 13.91 13.81 13.82 13.82 14.02 14.21 14.43 14.65
14.62 14.58 14.21 13.84 13.7 13.55 13.89 14.23 14.98 15.74 16.5`
  .trim()
  .split(/\s+/)
  .map(Number);

/**
 * Visual comparison target: the first row of the Stocks watchlist in Aqua, a gain with a full
 * session.
 *
 * Reference crop (2x pixels) x=114 y=328 w=656 h=96, that is 328 x 48 pt of the sidebar
 * (#e7e8e9). The row's top-left corner is at 112,327 in the screenshot: the crop leaves out
 * the window's edge at the left, the line of the cell above at the top and the sidebar's
 * divider at the right, so the list is shifted by 1 pt and 0.5 pt.
 *
 * The sparkline's data cannot be known. The series is the screenshot's own line, traced, and
 * `domain` maps a value straight to a height in the 26 pt box (0.75 pt is kept clear at the
 * top and bottom). The line ends 54.5 pt along the 54.67 pt box.
 */
export default function VisualGainLight() {
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
          price="26,201.04"
          change="+122.42"
          direction="gain"
          data={SESSION}
          previousClose={11.91}
          domain={[0.75, 25.25]}
          progress={54.5 / 54.67}
        />
      </StockList>
    </div>
  );
}
