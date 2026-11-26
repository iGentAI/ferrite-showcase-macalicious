import { PodcastsPreferences } from "../podcasts-preferences";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Podcasts-Preferences.png and its
 * Dark Aqua twin, 495 x 288 pt, with the 383 x 176 pt window at (56, 38) over a white matte.
 */
export default function VisualPreferences() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 495,
        height: 288,
        background: "var(--mac-podcasts-visual-matte)",
      }}
    >
      <PodcastsPreferences animated={false} style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
