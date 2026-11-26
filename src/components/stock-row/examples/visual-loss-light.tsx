import { StockList, StockRow } from "macalicious/stock-row";

// The reference's line, traced column by column and corrected against the rendering: its
// height above the bottom of the sparkline's box, in points, every quarter point from the
// box's left edge to 54.5 pt.
const SESSION = `
17.58 18.12 18.66 19.21 19.8 20.39 20.95 21.51 21.85 22.19 21.34 20.5 20.05 19.61 18.69
17.76 16.39 15.02 13.73 12.45 11.66 10.88 10.75 10.62 10.62 10.62 10.79 10.95 11.31 11.67
11.82 11.98 12.69 13.4 13.82 14.25 15 15.75 16.18 16.61 16.74 16.88 16.72 16.56 16.66 16.77
17.05 17.34 17.98 18.63 19.12 19.6 20.32 21.04 21.29 21.54 21.68 21.83 21.24 20.66 19.98
19.3 19.02 18.75 17.98 17.2 16.72 16.24 15.88 15.53 14.82 14.11 13.91 13.71 13.3 12.89 12.45
12 11.79 11.57 12.21 12.85 13.27 13.68 14.02 14.37 14.56 14.76 14.75 14.75 14.78 14.8 14.75
14.7 14.69 14.68 14.64 14.6 14.52 14.43 14.38 14.33 14.29 14.25 14.21 14.17 14.17 14.17
14.21 14.26 14.38 14.5 14.61 14.71 14.91 15.12 15.41 15.7 15.68 15.65 15.32 14.98 14.71
14.43 14.5 14.57 14.59 14.6 14.63 14.67 14.67 14.67 14.68 14.68 14.83 14.98 15.18 15.37
15.86 16.35 16.59 16.82 17.23 17.65 17.87 18.09 18.09 18.1 17.79 17.47 17.3 17.14 17.09
17.04 16.97 16.9 16.79 16.67 16.68 16.68 16.54 16.39 16.3 16.21 16.13 16.05 15.95 15.85
15.82 15.8 15.84 15.88 16.05 16.21 16.16 16.12 15.92 15.72 15.62 15.52 15.43 15.33 15.27
15.2 15.19 15.18 15.14 15.11 15.11 15.11 15.01 14.91 14.84 14.76 14.53 14.3 14.22 14.14
14.17 14.2 14.23 14.26 14.28 14.3 14.29 14.29 14.18 14.06 13.94 13.81 13.19 12.56 12.03 11.5
11.82 12.13 12.62 13.1 13.58`
  .trim()
  .split(/\s+/)
  .map(Number);

/**
 * Visual comparison target: the sixth row of the Stocks watchlist in Aqua, a loss with a full
 * session.
 *
 * Reference crop (2x pixels) x=114 y=810 w=656 h=96, that is 328 x 48 pt of the sidebar
 * (#e7e8e9); the row's top-left corner is at 112,809 in the screenshot, so the list is shifted
 * by 1 pt and 0.5 pt as in visual-gain-light. The series is the screenshot's own line, traced,
 * and `domain` maps a value straight to a height in the box. The line ends 54.5 pt along the
 * 54.67 pt box.
 */
export default function VisualLossLight() {
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
          symbol="DIS"
          name="The Walt Disney Company"
          price="128.15"
          change="-0.99"
          direction="loss"
          data={SESSION}
          previousClose={23.82}
          domain={[0.75, 25.25]}
          progress={54.5 / 54.67}
        />
      </StockList>
    </div>
  );
}
