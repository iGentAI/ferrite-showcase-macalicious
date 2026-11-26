import {
  PreferencesToolbar,
  PreferencesToolbarItem,
  PreferencesToolbarPanel,
  PreferencesToolbarRoot,
} from "macalicious/preferences-toolbar";
import { TitleBar } from "macalicious/title-bar";

/** Stand-in artwork: Catalina's pane icons are Apple's and are not part of the library. */
function PaneIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="6" fill={color} />
      <circle cx="16" cy="16" r="6" fill="#ffffff" fillOpacity="0.85" />
    </svg>
  );
}

export default function Basic() {
  return (
    <PreferencesToolbarRoot defaultValue="general" style={{ width: 383 }}>
      <TitleBar variant="unified" title="Preferences">
        <PreferencesToolbar aria-label="Preferences">
          <PreferencesToolbarItem value="general" icon={<PaneIcon color="#8e8e93" />}>
            General
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="playback" icon={<PaneIcon color="#af52de" />}>
            Playback
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="advanced" icon={<PaneIcon color="#636366" />}>
            Advanced
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      </TitleBar>
      <PreferencesToolbarPanel value="general" style={{ padding: 20 }}>
        General settings
      </PreferencesToolbarPanel>
      <PreferencesToolbarPanel value="playback" style={{ padding: 20 }}>
        Playback settings
      </PreferencesToolbarPanel>
      <PreferencesToolbarPanel value="advanced" style={{ padding: 20 }}>
        Advanced settings
      </PreferencesToolbarPanel>
    </PreferencesToolbarRoot>
  );
}
