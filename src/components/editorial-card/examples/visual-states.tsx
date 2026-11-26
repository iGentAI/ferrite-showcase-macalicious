import { EditorialCard } from "macalicious/editorial-card";

/**
 * Fixture for what no screenshot shows: a panel that is a button, 300 x 230 pt at the top
 * left of a 320 x 250 pt box in the page colour of the App Store, with white artwork. The
 * disc is 170 pt wide, 15 pt from the card's right edge and 30 pt from its top. The title is
 * filled as tall as its line, to show that a button does not centre it: the line starts
 * 29.25 pt below the card's top.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 320,
        height: 250,
        padding: 10,
        background: "light-dark(#ffffff, #1e1f22)",
      }}
    >
      <EditorialCard
        id="card"
        render={<button type="button" />}
        aria-label="Open"
        title={<span style={{ background: "#ff00ff", color: "#ff00ff" }}>Open</span>}
        artwork={<span style={{ background: "#ffffff" }} />}
      />
    </div>
  );
}
