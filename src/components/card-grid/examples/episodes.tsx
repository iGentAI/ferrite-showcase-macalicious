import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";

const episodes = [
  ["New · Sunday", "Episode Twelve", "1h 46m", "var(--mac-color-system-green)"],
  ["Thursday", "Episode Eleven", "58m", "var(--mac-color-system-purple)"],
];

/** Episode cards as in Podcasts: a caption, a title, a description and a duration. */
export default function Episodes() {
  return (
    <CardGrid
      title="Up Next"
      action={<CardGridAction href="#up-next">See All</CardGridAction>}
      layout="shelf"
      minCardWidth={252}
      separator
      style={{ width: 640, maxWidth: "100%" }}
    >
      {episodes.map(([caption, title, duration, color]) => (
        <CardGridCard
          key={title}
          variant="episode"
          caption={caption}
          title={title}
          subtitle="In this episode the hosts go through listener mail, look again at two older subjects and talk about what is new this month."
          footnote={duration}
          artwork={
            <span
              style={{ background: `linear-gradient(135deg, ${color}, var(--mac-color-label))` }}
            />
          }
        />
      ))}
    </CardGrid>
  );
}
