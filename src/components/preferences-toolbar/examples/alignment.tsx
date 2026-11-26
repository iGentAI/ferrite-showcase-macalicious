import {
  PreferencesToolbar,
  PreferencesToolbarItem,
  PreferencesToolbarRoot,
} from "macalicious/preferences-toolbar";
import { TitleBar } from "macalicious/title-bar";

function PaneIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="6" fill={color} />
    </svg>
  );
}

/** Items centred as a group, as in the Music and TV preferences. */
export default function Alignment() {
  return (
    <PreferencesToolbarRoot defaultValue="general" style={{ width: 420 }}>
      <TitleBar variant="unified" title="General">
        <PreferencesToolbar aria-label="Preferences" alignment="center">
          <PreferencesToolbarItem value="general" icon={<PaneIcon color="#8e8e93" />}>
            General
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="playback" icon={<PaneIcon color="#ff9500" />}>
            Playback
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="files" icon={<PaneIcon color="#34c759" />}>
            Files
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="restrictions" icon={<PaneIcon color="#ff3b30" />}>
            Restrictions
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      </TitleBar>
    </PreferencesToolbarRoot>
  );
}
