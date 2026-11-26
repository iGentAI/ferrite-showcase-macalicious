import { NowPlayingLcd } from "macalicious/now-playing-lcd";

/**
 * Visual comparison target: the idle display in Music's playback bar.
 * Reference crop (2x pixels) x=1100 y=80 w=816 h=100, i.e. 408 x 50 pt; the 400 pt panel
 * starts 4 pt from the left and 2.5 pt down. Behind it is the bar's gradient, which runs over
 * the bar's 54 pt and starts 2 pt above the crop. The idle mark is left out: the capture shows
 * the Apple logo there, which the library does not draw.
 */
export default function VisualMusicIdle() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 408,
        height: 50,
        padding: "2.5px 4px 0",
        background:
          "linear-gradient(light-dark(#ffffff, #2b2d2f), light-dark(#fafafa, #252729) 50%, light-dark(#f4f4f4, #1e2022)) 0 -2px / 100% 54px no-repeat",
      }}
    >
      <NowPlayingLcd />
    </div>
  );
}
