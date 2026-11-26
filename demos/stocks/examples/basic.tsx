import { Stocks } from "../stocks";

/**
 * Stocks with the watchlist and the news of the reference screenshot. Click a symbol for its
 * chart and figures, a badge to change what every badge shows, and Business News or the Back
 * button to return to the stories. The window takes the width the page gives it, up to the
 * captured 1148 pt; the margins leave room for its shadow.
 */
export default function Basic() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        overflowX: "auto",
        padding: "31px 48px 67px",
      }}
    >
      <Stocks width="100%" style={{ minWidth: 700, maxWidth: 1148 }} />
    </div>
  );
}
