import { TodayWidget } from "macalicious/today-widget";

/**
 * Visual check target: a widget with a header band and 30 pt of empty content, on the flat
 * colour of the Notification Center panel over the sky of the default desktop picture. No
 * capture shows a header band over a backdrop that one tint reproduces (see the page), so the
 * comparison checks the pixels of the band and the body against the card's tokens.
 */
export default function VisualHeader() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 332,
        height: 67,
        padding: 5,
        background: "light-dark(#b7def8, #162e4e)",
      }}
    >
      <TodayWidget title="Stocks">
        <div style={{ height: 30 }} />
      </TodayWidget>
    </div>
  );
}
