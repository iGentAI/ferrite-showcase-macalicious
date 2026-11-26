import { PageControl } from "macalicious/page-control";

/**
 * The overlay variant is drawn in white for use over a picture or a dark, blurred backdrop,
 * as in Launchpad. It looks the same in both appearances.
 */
export default function Overlay() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        width: 240,
        height: 60,
        borderRadius: 6,
        background: "linear-gradient(135deg, #1d3a5c, #121c2b)",
      }}
    >
      <PageControl variant="overlay" count={4} aria-label="Launchpad pages" />
    </div>
  );
}
