import { CardGrid, CardGridCard } from "macalicious/card-grid";
import type { CSSProperties } from "react";

/* The words are filled with their own colour, so each line of text is a bar a pixel can find. */
const bar = (color: string, text: string) => (
  <span style={{ background: color, color }}>{text}</span>
);

/**
 * Fixture for a lockup whose title needs two lines, as "Total War: THREE KINGDOMS" does in
 * the App Store capture: one 301 pt column, 138 pt tall, on the store's page colour. The
 * first row's title takes two lines and its subtitle the one that is left; the second row has
 * a short title and its subtitle two lines. Both rows stay 69 pt. Titles are magenta bars and
 * subtitles cyan ones.
 */
export default function VisualLockupWrap() {
  return (
    <div style={{ width: 301, height: 138, background: "light-dark(#ffffff, #1e1f22)" }}>
      <CardGrid
        aria-label="Lockups"
        columns={1}
        style={
          { "--mac-card-grid-margin": "0px", "--mac-card-grid-row-gap": "0px" } as CSSProperties
        }
      >
        <CardGridCard
          id="long"
          variant="lockup"
          title={bar("#ff00ff", "A Title Long Enough to Need a Second Line of Its Own")}
          subtitle={bar(
            "#00ffff",
            "A subtitle that would take two lines if the title had left it two",
          )}
          artwork={<span style={{ background: "var(--mac-color-system-gray)" }} />}
        />
        <CardGridCard
          id="short"
          variant="lockup"
          title={bar("#ff00ff", "Short")}
          subtitle={bar(
            "#00ffff",
            "A subtitle that takes two lines because the title needs only one of the three",
          )}
          artwork={<span style={{ background: "var(--mac-color-system-gray)" }} />}
        />
      </CardGrid>
    </div>
  );
}
