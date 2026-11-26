import { StockList, StockRow } from "macalicious/stock-row";

export default function Basic() {
  return (
    <StockList aria-label="Watchlist" style={{ width: 330 }}>
      <StockRow
        symbol="AAPL"
        name="Apple Inc."
        price="220.82"
        change="+1.86"
        direction="gain"
        data={[218.9, 219.4, 218.6, 219.8, 220.3, 219.9, 220.6, 221.1, 220.5, 220.82]}
        previousClose={218.96}
      />
    </StockList>
  );
}
