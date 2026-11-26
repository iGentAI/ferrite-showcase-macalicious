import { Podcasts } from "../podcasts";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Dark-Podcasts.png, 1249 x 876 pt, with
 * the window at (56, 38) over a white matte. The capture shows the Up Next episode loaded and
 * paused at its start: the display names it, the skip buttons show 15 and 30, and the card's
 * caption says how much is left.
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1249,
        height: 876,
        background: "var(--mac-podcasts-visual-matte)",
      }}
    >
      <Podcasts
        material="opaque"
        defaultEpisode="signal-path-12"
        style={{ position: "absolute", left: 56, top: 38 }}
      />
    </div>
  );
}
