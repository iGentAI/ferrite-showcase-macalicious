import { TodayWidget } from "macalicious/today-widget";

const stocks = [
  { symbol: "DOW J", price: "26,439.08", change: "+ 0.91%" },
  { symbol: "S&P 500", price: "2,937.76", change: "+ 0.93%" },
  { symbol: "AAPL", price: "226.09", change: "+ 2.39%" },
];

/**
 * A widget with a header and content of its own: rows of a symbol, a price and a change. The
 * card is translucent, so it stands on a backdrop here, as it stands on Notification Center.
 */
export default function Basic() {
  return (
    <div style={{ padding: 11, background: "light-dark(#b5ddf8, #152c4a)" }}>
      <TodayWidget
        title="Stocks"
        icon={
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
            <rect width="14" height="14" rx="3" fill="#1c1c1e" />
            <path d="M2 9.5 5 6.5 7.5 8.5 12 4" fill="none" stroke="#ffffff" strokeWidth="1.2" />
          </svg>
        }
      >
        <ul style={{ margin: 0, padding: "4px 17px 8px 18px", listStyle: "none" }}>
          {stocks.map((stock, index) => (
            <li
              key={stock.symbol}
              style={{
                display: "flex",
                height: 35,
                alignItems: "center",
                gap: 12,
                borderTop: index ? "1px solid var(--mac-today-widget-divider)" : undefined,
              }}
            >
              <strong style={{ flex: 1, fontWeight: 600 }}>{stock.symbol}</strong>
              <span style={{ color: "var(--mac-today-widget-text-secondary)" }}>{stock.price}</span>
              <span
                style={{
                  width: 61,
                  borderRadius: 2,
                  background: "#1e8a35",
                  color: "#ffffff",
                  fontWeight: 700,
                  lineHeight: "22px",
                  textAlign: "center",
                }}
              >
                {stock.change}
              </span>
            </li>
          ))}
        </ul>
      </TodayWidget>
    </div>
  );
}
