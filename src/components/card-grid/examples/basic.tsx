import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";

const albums = [
  ["Album One", "First Artist", "var(--mac-color-system-teal)"],
  ["Album Two", "Second Artist", "var(--mac-color-system-orange)"],
  ["Album Three", "Third Artist", "var(--mac-color-system-indigo)"],
  ["Album Four", "Fourth Artist", "var(--mac-color-system-green)"],
];

/** A grid of square cards. The artwork is a gradient drawn here: the library ships none. */
export default function Basic() {
  return (
    <CardGrid
      title="Recently Added"
      action={<CardGridAction href="#recently-added">See All</CardGridAction>}
      style={{ width: 520, maxWidth: "100%" }}
    >
      {albums.map(([title, artist, color]) => (
        <CardGridCard
          key={title}
          variant="square"
          title={title}
          subtitle={artist}
          artwork={
            <span
              style={{
                background: `linear-gradient(135deg, ${color}, var(--mac-color-system-gray))`,
              }}
            />
          }
        />
      ))}
    </CardGrid>
  );
}
