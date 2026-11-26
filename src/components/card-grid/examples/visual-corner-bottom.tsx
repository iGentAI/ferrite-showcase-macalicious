import { CardGrid, CardGridCard } from "macalicious/card-grid";
import type { CSSProperties } from "react";

/**
 * Visual comparison target: the bottom-right corner of the third card of TV's "What to Watch"
 * shelf (see visual-corner-top), with the shadow below it and the gap to the fourth card.
 *
 * Reference crop x=1964 y=532 w=78 h=80, i.e. 39 x 40 pt, with the card's corner 19.5 pt in
 * from the crop's left and top; the crop ends where the fourth card begins.
 */
export default function VisualCornerBottom() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 39,
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
            left: 19.5 - 288.5 - 617,
            top: 19.5 - 162.5,
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
