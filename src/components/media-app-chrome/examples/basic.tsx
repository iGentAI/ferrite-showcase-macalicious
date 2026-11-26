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
import { useState } from "react";

/** A music player's window: press play, drag the volume, pick a row in the sidebar. */
export default function Basic() {
  const [playing, setPlaying] = useState(false);
  const [section, setSection] = useState("albums");
  return (
    <Window width={860} height={320} aria-label="Player">
      <MediaAppChrome>
        <MediaAppChromeSidebar
          material="opaque"
          controls={<WindowControls />}
          search={<SearchField variant="sidebar" />}
        >
          <Sidebar
            aria-label="Library"
            material="opaque"
            value={section}
            onValueChange={setSection}
          >
            <SidebarSection title="Library">
              <SidebarItem value="recent" label="Recently Added" />
              <SidebarItem value="artists" label="Artists" />
              <SidebarItem value="albums" label="Albums" />
              <SidebarItem value="songs" label="Songs" />
            </SidebarSection>
          </Sidebar>
        </MediaAppChromeSidebar>
        <MediaAppChromeBar aria-label="Playback controls">
          <MediaAppChromeTransport>
            <MediaAppChromeButton glyph="previous" aria-label="Previous" disabled={!playing} />
            <MediaAppChromeButton
              glyph={playing ? "pause" : "play"}
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => setPlaying(!playing)}
            />
            <MediaAppChromeButton glyph="next" aria-label="Next" disabled={!playing} />
          </MediaAppChromeTransport>
          <MediaAppChromeDisplay>
            {playing ? (
              <NowPlayingLcd
                title="Morning Walk"
                subtitle="The Placeholders — First Album"
                elapsed={62}
                duration={215}
              />
            ) : (
              <NowPlayingLcd />
            )}
          </MediaAppChromeDisplay>
          <MediaAppChromeControls>
            <MediaAppChromeVolume defaultValue={70}>
              <MediaAppChromeButton glyph="output" aria-label="Audio output" />
            </MediaAppChromeVolume>
            <MediaAppChromeButton glyph="lyrics" aria-label="Lyrics" />
            <MediaAppChromeButton glyph="up-next" aria-label="Up Next" />
          </MediaAppChromeControls>
        </MediaAppChromeBar>
        <MediaAppChromePane style={{ padding: "40px 39px" }}>
          {section === "albums" ? "Albums" : "Nothing here yet"}
        </MediaAppChromePane>
      </MediaAppChrome>
    </Window>
  );
}
