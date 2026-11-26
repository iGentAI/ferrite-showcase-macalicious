import { StockList, StockRow } from "macalicious/stock-row";

/** A line of text with a fill as tall as its line, so that a pixel can tell where the line is. */
function Line({ height, color, children }: { height: number; color: string; children: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 60,
        height,
        verticalAlign: "top",
        background: color,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Fixture for the text's position in a row that is a button: a plain row over a row with
 * `onSelect`, with the same lines. 330 x 97 pt; in both rows the symbol's line is 17 pt tall
 * from 7.5 pt below the row's top and the name's 15 pt tall from 25.5 pt, each filled from
 * x 12.3 to 72.3.
 */
export default function VisualAlignment() {
  const lines = {
    symbol: (
      <Line height={17} color="#ff00ff">
        A
      </Line>
    ),
    name: (
      <Line height={15} color="#00ffff">
        B
      </Line>
    ),
    price: "220.82",
    change: "+1.86",
    direction: "gain",
  } as const;
  return (
    <div style={{ width: 330, height: 97, background: "#ffffff", color: "#000000" }}>
      <StockList aria-label="Watchlist">
        <StockRow {...lines} />
        <StockRow {...lines} onSelect={() => {}} />
      </StockList>
    </div>
  );
}
