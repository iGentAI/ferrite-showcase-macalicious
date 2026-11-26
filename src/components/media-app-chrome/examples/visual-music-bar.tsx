import {
  MediaAppChrome,
  MediaAppChromeBar,
  MediaAppChromeButton,
  MediaAppChromeControls,
  MediaAppChromeDisplay,
  MediaAppChromeTransport,
  MediaAppChromeVolume,
} from "macalicious/media-app-chrome";
import { NowPlayingLcd } from "macalicious/now-playing-lcd";

/**
 * Visual comparison target: Music's playback bar with nothing loaded.
 * Reference crop (2x pixels) x=554 y=76 w=1998 h=110, i.e. 999 x 55 pt: the bar from the pane's
 * first point to the window's right edge. The chrome is laid out at the window's 1220 pt and
 * shifted left by the 220 pt sidebar and the 1 pt divider. The display's idle mark is left
 * out: the capture shows the Apple logo there, which the library does not draw.
 */
export default function VisualMusicBar() {
  return (
    <div style={{ position: "relative", width: 999, height: 55, overflow: "hidden" }}>
      <MediaAppChrome style={{ position: "absolute", left: -221, width: 1220, height: 55 }}>
        <MediaAppChromeBar aria-label="Playback controls">
          <MediaAppChromeTransport>
            <MediaAppChromeButton glyph="previous" aria-label="Previous" disabled />
            <MediaAppChromeButton glyph="play" aria-label="Play" />
            <MediaAppChromeButton glyph="next" aria-label="Next" disabled />
          </MediaAppChromeTransport>
          <MediaAppChromeDisplay>
            <NowPlayingLcd />
          </MediaAppChromeDisplay>
          <MediaAppChromeControls>
            <MediaAppChromeVolume defaultValue={100}>
              <MediaAppChromeButton glyph="output" aria-label="Audio output" />
            </MediaAppChromeVolume>
            <MediaAppChromeButton glyph="lyrics" aria-label="Lyrics" />
            <MediaAppChromeButton glyph="up-next" aria-label="Up Next" />
          </MediaAppChromeControls>
        </MediaAppChromeBar>
      </MediaAppChrome>
    </div>
  );
}
