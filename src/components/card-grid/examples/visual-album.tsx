import { CardGrid, CardGridCard } from "macalicious/card-grid";
import type { CSSProperties } from "react";

/**
 * Visual comparison target: the album cell of Music's Albums view, a 168 pt square cover with
 * two lines of text.
 *
 * Reference crop (2x pixels) x=612 y=246 w=376 h=450, i.e. 188 x 225 pt, with the cover at
 * 10, 10. The cover in the capture is near black at its edges (#1c1c1c), so the flat box here
 * stands for it there; its middle is masked in the comparisons.
 */
export default function VisualAlbum() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 188,
        height: 225,
        padding: 10,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <CardGrid
        aria-label="Albums"
        style={{ width: 168, "--mac-card-grid-margin": "0px" } as CSSProperties}
      >
        <CardGridCard
          variant="square"
          title="Album One"
          subtitle="Artist"
          artwork={<span style={{ background: "#1c1c1c" }} />}
        />
      </CardGrid>
    </div>
  );
}
