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
 * Visual comparison target: Podcasts' playback bar with nothing loaded (the light capture):
 * plain skip arrows, disabled, and an idle display. Reference crop (2x pixels) x=634 y=76
 * w=1752 h=110, i.e. 876 x 55 pt, laid out as in `visual-podcasts-bar`. The display's marks are
 * left out: the capture shows Apple's there.
 */
export default function VisualPodcastsIdleBar() {
  return (
    <div style={{ position: "relative", width: 876, height: 55, overflow: "hidden" }}>
      <MediaAppChrome
        variant="podcasts"
        sidebarWidth={260}
        style={{ position: "absolute", left: -261, width: 1137, height: 55 }}
      >
        <MediaAppChromeBar aria-label="Playback controls">
          <MediaAppChromeTransport>
            <MediaAppChromeButton glyph="skip-back" aria-label="Back 15 seconds" disabled />
            <MediaAppChromeButton glyph="play" aria-label="Play" />
            <MediaAppChromeButton glyph="skip-forward" aria-label="Forward 30 seconds" disabled />
          </MediaAppChromeTransport>
          <MediaAppChromeDisplay>
            <NowPlayingLcd variant="podcasts" placeholder={null} />
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
