import { CardGrid, CardGridCard } from "macalicious/card-grid";
import type { CSSProperties } from "react";

/**
 * Visual comparison target: the episode card of Podcasts' "Up Next" shelf, a 252 pt square
 * artwork with a caption, a title, three lines of description and a duration.
 *
 * Reference crop (2x pixels) x=688 y=412 w=600 h=776, i.e. 300 x 388 pt, with the artwork at
 * 13, 14. The artwork is a flat stand-in and is masked in the comparisons, as is the text,
 * which is neutral here and shorter than the capture's.
 */
export default function VisualEpisode() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 300,
        height: 388,
        padding: "14px 0 0 13px",
        background: "light-dark(#ffffff, #1e1e1e)",
      }}
    >
      <CardGrid
        aria-label="Up Next"
        layout="shelf"
        minCardWidth={252}
        style={{ width: 252, "--mac-card-grid-margin": "0px" } as CSSProperties}
      >
        <CardGridCard
          variant="episode"
          caption="New · Sunday"
          title="Episode Twelve"
          subtitle="In this episode the hosts go through listener mail, look again at two older subjects and talk about what is new this month and what is next"
          footnote="1h 46m"
          artwork={<span style={{ background: "var(--mac-color-system-gray)" }} />}
        />
      </CardGrid>
    </div>
  );
}
