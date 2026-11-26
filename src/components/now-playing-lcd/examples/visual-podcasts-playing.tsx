import { NowPlayingLcd } from "macalicious/now-playing-lcd";

/**
 * Visual comparison target: Podcasts' display with an episode loaded.
 * Reference crop (2x pixels) x=1110 y=80 w=716 h=100, i.e. 358 x 50 pt; the 351 pt panel
 * starts 3.5 pt from the left and 2.5 pt down. The strings are the ones in the capture; the
 * artwork is a neutral block, because the capture shows the show's own artwork there.
 */
export default function VisualPodcastsPlaying() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 358,
        height: 50,
        padding: "2.5px 3.5px 0",
        background: "light-dark(#ffffff, #1e1e1e)",
      }}
    >
      <NowPlayingLcd
        variant="podcasts"
        title="I Saw Your Face on the Internet"
        subtitle="Mac Power Users — September 29, 2019"
        artwork={<div style={{ width: "100%", height: "100%", background: "#808080" }} />}
        elapsed={62}
        duration={6360}
      />
    </div>
  );
}
