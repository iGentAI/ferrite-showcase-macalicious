import {
  MediaAppChrome,
  MediaAppChromeBar,
  MediaAppChromeButton,
  MediaAppChromeControls,
  MediaAppChromeDisplay,
  MediaAppChromePane,
  MediaAppChromeSidebar,
  MediaAppChromeTransport,
  MediaAppChromeVolume,
} from "macalicious/media-app-chrome";
import { NowPlayingLcd } from "macalicious/now-playing-lcd";
import { SearchField } from "macalicious/search-field";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/** The Podcasts variant with an episode loaded: skip buttons, a flat bar, a 260 pt sidebar. */
export default function Podcasts() {
  return (
    <Window width={900} height={300} aria-label="Podcast player">
      <MediaAppChrome variant="podcasts" sidebarWidth={260}>
        <MediaAppChromeSidebar
          material="opaque"
          controls={<WindowControls />}
          search={<SearchField variant="sidebar" />}
        >
          <Sidebar aria-label="Podcasts" material="opaque" defaultValue="listen-now">
            <SidebarSection title="Podcasts">
              <SidebarItem value="listen-now" label="Listen Now" />
              <SidebarItem value="browse" label="Browse" />
            </SidebarSection>
            <SidebarSection title="Library">
              <SidebarItem value="shows" label="Shows" />
              <SidebarItem value="episodes" label="Episodes" />
            </SidebarSection>
          </Sidebar>
        </MediaAppChromeSidebar>
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
              title="Episode 12: Field Notes"
              subtitle="The Placeholder Show — October 3, 2019"
              elapsed={62}
              duration={3600}
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
        <MediaAppChromePane style={{ padding: 40 }}>Listen Now</MediaAppChromePane>
      </MediaAppChrome>
    </Window>
  );
}
