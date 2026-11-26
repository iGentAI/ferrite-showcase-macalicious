import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";

/**
 * Visual comparison target: TV's first shelf, "What to Watch", from the toolbar's lower edge
 * to 19 pt below the cards, across the window inside its 1 pt frame.
 *
 * Reference crop (2x pixels) x=114 y=150 w=2584 h=460, i.e. 1292 x 230 pt. The section has the
 * window's width, 1294 pt, and starts 1 pt left of the crop; its 40 pt margins leave 1214 pt,
 * which four cards and three 20 pt gaps fill (288.5 x 162.5 pt each). The header is 48 pt:
 * the cards begin at y 48 and end at y 210.5. The artwork is a flat stand-in and is masked in
 * the comparisons.
 */
export default function VisualShelfHeader() {
  return (
    <div
      style={{
        overflow: "hidden",
        width: 1292,
        height: 230,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <CardGrid
        title="What to Watch"
        action={<CardGridAction href="#what-to-watch">See All</CardGridAction>}
        layout="shelf"
        columns={4}
        style={{ width: 1294, marginLeft: -1 }}
      >
        {["One", "Two", "Three", "Four"].map((name) => (
          <CardGridCard
            key={name}
            render={<a href="#what-to-watch" />}
            aria-label={`Show ${name}`}
            artwork={<span style={{ background: "var(--mac-color-system-gray)" }} />}
          />
        ))}
      </CardGrid>
    </div>
  );
}
