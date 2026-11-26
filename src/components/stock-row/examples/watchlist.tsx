import { StockList, StockRow } from "macalicious/stock-row";
import { useState } from "react";

const STOCKS = [
  {
    symbol: "Dow Jones",
    name: "Dow Jones Industrial Average",
    price: "26,201.04",
    change: "+122.42",
    percent: "+0.47%",
    previousClose: 26078.62,
    data: [26040, 25950, 25760, 25890, 26030, 26010, 26080, 26130, 26170, 26190, 26180, 26201],
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: "220.82",
    change: "+1.86",
    percent: "+0.85%",
    previousClose: 218.96,
    data: [218.9, 219.4, 218.6, 219.8, 220.3, 219.9, 220.6, 221.1, 220.5, 220.82],
  },
  {
    symbol: "DIS",
    name: "The Walt Disney Company",
    price: "128.15",
    change: "-0.99",
    percent: "-0.77%",
    previousClose: 129.14,
    data: [129.0, 128.2, 127.6, 128.4, 128.9, 128.1, 127.9, 128.3, 128.2, 128.0, 128.15],
  },
];

export default function Watchlist() {
  const [selected, setSelected] = useState("AAPL");
  const [percent, setPercent] = useState(false);
  return (
    <StockList aria-label="Watchlist" style={{ width: 330 }}>
      {STOCKS.map((stock) => (
        <StockRow
          key={stock.symbol}
          symbol={stock.symbol}
          name={stock.name}
          price={stock.price}
          change={percent ? stock.percent : stock.change}
          direction={stock.change.startsWith("-") ? "loss" : "gain"}
          data={stock.data}
          previousClose={stock.previousClose}
          selected={selected === stock.symbol}
          onSelect={() => setSelected(stock.symbol)}
          onBadgeClick={() => setPercent(!percent)}
          badgeLabel={`${percent ? stock.percent : stock.change}, show ${percent ? "price" : "percent"} change`}
        />
      ))}
    </StockList>
  );
}
