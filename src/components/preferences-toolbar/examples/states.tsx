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

function Bar({ label }: { label: string }) {
  return (
    <PreferencesToolbarRoot defaultValue="selected" style={{ width: 300 }}>
      <TitleBar variant="unified" title={label}>
        <PreferencesToolbar aria-label={label}>
          <PreferencesToolbarItem value="selected" icon={<PaneIcon color="#007aff" />}>
            Selected
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="item" icon={<PaneIcon color="#34c759" />}>
            Item
          </PreferencesToolbarItem>
          <PreferencesToolbarItem
            value="pressed"
            data-force="pressed"
            icon={<PaneIcon color="#ff9500" />}
          >
            Pressed
          </PreferencesToolbarItem>
          <PreferencesToolbarItem
            value="focus"
            data-force="focus"
            icon={<PaneIcon color="#af52de" />}
          >
            Focused
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="disabled" disabled icon={<PaneIcon color="#ff3b30" />}>
            Disabled
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      </TitleBar>
    </PreferencesToolbarRoot>
  );
}

/** Item states in a key window and in an inactive one. */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Bar label="Key window" />
      <div data-window-state="inactive">
        <Bar label="Inactive window" />
      </div>
    </div>
  );
}
