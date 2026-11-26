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
 * Visual comparison target: Podcasts' playback bar with an episode loaded (the dark capture).
 * Reference crop (2x pixels) x=634 y=76 w=1752 h=110, i.e. 876 x 55 pt: the bar from the pane's
 * first point to the window's right edge. The chrome is laid out at the window's 1137 pt and
 * shifted left by the 260 pt sidebar and the 1 pt divider. The strings are the ones in the
 * capture; the artwork is a neutral block.
 */
export default function VisualPodcastsBar() {
  return (
    <div style={{ position: "relative", width: 876, height: 55, overflow: "hidden" }}>
      <MediaAppChrome
        variant="podcasts"
        sidebarWidth={260}
        style={{ position: "absolute", left: -261, width: 1137, height: 55 }}
      >
        <MediaAppChromeBar aria-label="Playback controls">
          <MediaAppChromeTransport>
            <MediaAppChromeButton glyph="skip-back" seconds={15} aria-label="Back 15 seconds" />
            <MediaAppChromeButton glyph="play" aria-label="Play" />
            <MediaAppChromeButton
              glyph="skip-forward"
              seconds={30}
              aria-label="Forward 30 seconds"
            />
          </MediaAppChromeTransport>
          <MediaAppChromeDisplay>
            <NowPlayingLcd
              variant="podcasts"
              title="I Saw Your Face on the Internet"
              subtitle="Mac Power Users — September 29, 2019"
              artwork={<div style={{ width: "100%", height: "100%", background: "#808080" }} />}
              elapsed={62}
              duration={6360}
            />
          </MediaAppChromeDisplay>
          <MediaAppChromeControls>
            <MediaAppChromeVolume defaultValue={100}>
              <MediaAppChromeButton glyph="output" aria-label="Audio output" />
            </MediaAppChromeVolume>
            <MediaAppChromeButton glyph="info" aria-label="Episode notes" />
            <MediaAppChromeButton glyph="up-next" aria-label="Up Next" />
          </MediaAppChromeControls>
        </MediaAppChromeBar>
      </MediaAppChrome>
    </div>
  );
}
