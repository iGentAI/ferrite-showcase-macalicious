import { CardGrid, CardGridCard } from "macalicious/card-grid";
import type { CSSProperties } from "react";

/**
 * Visual comparison target: the top-left corner of the third card of TV's "What to Watch"
 * shelf, whose artwork is white at its edges in both captures, so the white box here stands
 * for it. The card is 288.5 x 162.5 pt at 1426, 246 (2x pixels) in the capture, 20 pt from
 * its neighbours.
 *
 * Reference crop x=1396 y=226 w=80 h=80, i.e. 40 x 40 pt, with the card's corner 15 pt and
 * 10 pt in: the gap with the shadows of this card and of the one before it, the hairline edge
 * and the corner.
 */
export default function VisualCornerTop() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 40,
        height: 40,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <CardGrid
        aria-label="What to Watch"
        layout="shelf"
        minCardWidth={288.5}
        style={
          {
            position: "absolute",
            left: 15 - 617,
            top: 10,
            width: 1214,
            "--mac-card-grid-margin": "0px",
          } as CSSProperties
        }
      >
        {["One", "Two", "Three", "Four"].map((name) => (
          <CardGridCard
            key={name}
            render={<a href="#what-to-watch" />}
            aria-label={`Show ${name}`}
            artwork={<span style={{ background: "#ffffff" }} />}
          />
        ))}
      </CardGrid>
    </div>
  );
}
