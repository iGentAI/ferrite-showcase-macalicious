import { StoryCard } from "macalicious/story-card";

const STORIES = [
  {
    publisher: "Harbour Post",
    title: "Ferry service returns to the old pier after a decade away",
    from: "blue",
    to: "indigo",
  },
  {
    publisher: "Field Notes",
    title: "A quiet year for the valley's orchards ends with a record harvest of late apples",
    from: "orange",
    to: "red",
  },
];

/**
 * Top stories as News lays them out: two lead stories, one of them a video, and secondary
 * stories under them, all links. The 22 pt between cards is the measured gap.
 */
export default function TopStories() {
  return (
    <div style={{ display: "grid", gap: 22, width: 540, maxWidth: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 22 }}>
        {STORIES.map((story, index) => (
          <StoryCard
            key={story.publisher}
            render={<a href="#story" />}
            headingLevel={3}
            publisher={story.publisher}
            title={index === 1 ? `Video: ${story.title}` : story.title}
            time="1h ago"
            video={index === 1}
            artwork={
              <span
                style={{
                  background: `linear-gradient(160deg, var(--mac-color-system-${story.from}), var(--mac-color-system-${story.to}))`,
                }}
              />
            }
          />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 22 }}>
        {STORIES.map((story) => (
          <StoryCard
            key={story.publisher}
            variant="secondary"
            render={<a href="#story" />}
            headingLevel={3}
            publisher={story.publisher}
            title={story.title}
            time="3h ago"
            artwork={
              <span
                style={{
                  background: `linear-gradient(160deg, var(--mac-color-system-${story.to}), var(--mac-color-system-${story.from}))`,
                }}
              />
            }
          />
        ))}
      </div>
    </div>
  );
}
