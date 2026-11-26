import { NowPlayingLcd } from "macalicious/now-playing-lcd";

/**
 * Visual comparison target: the idle display in Podcasts' playback bar.
 * Reference crop (2x pixels) x=1110 y=80 w=716 h=100, i.e. 358 x 50 pt; the 351 pt panel
 * starts 3.5 pt from the left and 2.5 pt down, on the flat bar. The well is left empty of a
 * glyph: the capture shows the Apple Podcasts mark there, which the library does not draw.
 */
export default function VisualPodcastsIdle() {
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
      <NowPlayingLcd variant="podcasts" placeholder={null} />
    </div>
  );
}
