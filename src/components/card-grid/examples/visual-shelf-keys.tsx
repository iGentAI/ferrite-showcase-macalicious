import { CardGrid, CardGridCard } from "macalicious/card-grid";
import type { CSSProperties } from "react";

const colours = ["#c00000", "#00a000", "#0000c0", "#808080"];

/**
 * Fixture for keyboard scrolling of a shelf whose cards are static. `card-grid.visual.json`
 * moves keyboard focus to the shelf with Tab and scrolls it with the right arrow key.
 *
 * 300 x 120 pt on white: four 120 pt square cards, 20 pt apart, behind 20 pt margins, so the
 * row is 580 pt long. At rest the first card (red) is x 20 to 140; one card further the second
 * (green) is there and the third (blue) is x 160 to 280.
 */
export default function VisualShelfKeys() {
  return (
    <div style={{ width: 300, background: "#ffffff" }}>
      <CardGrid
        aria-label="Colours"
        layout="shelf"
        minCardWidth={120}
        style={{ paddingBottom: 0, "--mac-card-grid-margin": "20px" } as CSSProperties}
      >
        {colours.map((colour) => (
          <CardGridCard
            key={colour}
            variant="square"
            artwork={<span role="img" aria-label={colour} style={{ background: colour }} />}
          />
        ))}
      </CardGrid>
    </div>
  );
}
