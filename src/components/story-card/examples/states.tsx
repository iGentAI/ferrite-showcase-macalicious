import { StoryCard } from "macalicious/story-card";

const art = (
  <span
    style={{
      background:
        "linear-gradient(160deg, var(--mac-color-system-purple), var(--mac-color-system-pink))",
    }}
  />
);

const small = { width: 170 };

/**
 * The states of a lead story that is a button, at a smaller width. Pressed and focused are
 * transient, so this gallery pins them with the `data-force` preview attribute; in an
 * application they come from :active and :focus-visible.
 */
export default function States() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 22, padding: 4 }}>
      <StoryCard render={<button type="button" />} title="Normal" artwork={art} style={small} />
      <StoryCard
        render={<button type="button" />}
        data-force="pressed"
        title="Pressed"
        artwork={art}
        style={small}
      />
      <StoryCard
        render={<button type="button" />}
        data-force="focus"
        title="Keyboard focus"
        artwork={art}
        style={small}
      />
      <StoryCard
        render={<button type="button" disabled />}
        title="Disabled"
        artwork={art}
        style={small}
      />
      <div data-window-state="inactive">
        <StoryCard
          render={<button type="button" />}
          data-force="focus"
          title="Focus, window not key"
          artwork={art}
          style={small}
        />
      </div>
      <StoryCard title="Video" video artwork={art} style={small} />
    </div>
  );
}
