import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";

const shows = [
  ["Show One", "var(--mac-color-system-indigo)"],
  ["Show Two", "var(--mac-color-system-orange)"],
  ["Show Three", "var(--mac-color-system-teal)"],
  ["Show Four", "var(--mac-color-system-pink)"],
  ["Show Five", "var(--mac-color-system-green)"],
  ["Show Six", "var(--mac-color-system-purple)"],
];

/**
 * A shelf of landscape cards that are links, three in view; the rest scroll in from the side.
 * The cards show no text, as in TV, so each link is named with `aria-label`.
 */
export default function Shelf() {
  return (
    <CardGrid
      title="What to Watch"
      action={<CardGridAction href="#what-to-watch">See All</CardGridAction>}
      layout="shelf"
      columns={3}
      style={{ width: 640, maxWidth: "100%" }}
    >
      {shows.map(([name, color]) => (
        <CardGridCard
          key={name}
          render={<a href="#what-to-watch" />}
          aria-label={name}
          artwork={
            <span
              style={{ background: `linear-gradient(160deg, ${color}, var(--mac-color-label))` }}
            />
          }
        />
      ))}
    </CardGrid>
  );
}
