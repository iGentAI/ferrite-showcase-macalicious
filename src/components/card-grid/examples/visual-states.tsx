import { CardGrid, CardGridCard } from "macalicious/card-grid";
import type { CSSProperties } from "react";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, a window that
 * is not key). `card-grid.visual.json` puts it into each state with real input and checks the
 * pixels it expects.
 *
 * 356 x 106 pt on TV's page colour: two landscape cards that are buttons, 160 x 90 pt each,
 * 20 pt apart, with 8 pt of page on every side so that the focus ring is inside the capture.
 * The first card's artwork is x 8 to 168, the second's x 188 to 348, both y 8 to 98. The
 * artwork is white, as the edges of the measured card are.
 */
export default function VisualStates() {
  return (
    <div style={{ width: 356, padding: "8px 0", background: "light-dark(#ffffff, #1e2022)" }}>
      <CardGrid
        aria-label="Shows"
        columns={2}
        style={{ paddingBottom: 0, "--mac-card-grid-margin": "8px" } as CSSProperties}
      >
        <CardGridCard
          id="first"
          aria-label="Show One"
          render={<button type="button" />}
          artwork={<span style={{ background: "#ffffff" }} />}
        />
        <CardGridCard
          id="second"
          aria-label="Show Two"
          render={<button type="button" />}
          artwork={<span style={{ background: "#ffffff" }} />}
        />
      </CardGrid>
    </div>
  );
}
