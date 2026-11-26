import { PreferencePaneIcon, PreferencePaneIconArtwork } from "macalicious/preference-pane-icon";

/** Normal, pressed, keyboard focus and disabled; the last one in a window that is not key. */
export default function States() {
  return (
    <div style={{ display: "flex" }}>
      <PreferencePaneIcon title="Normal">
        <PreferencePaneIconArtwork tint="blue" />
      </PreferencePaneIcon>
      <PreferencePaneIcon title="Pressed" data-force="pressed">
        <PreferencePaneIconArtwork tint="blue" />
      </PreferencePaneIcon>
      <PreferencePaneIcon title="Focused" data-force="focus">
        <PreferencePaneIconArtwork tint="blue" />
      </PreferencePaneIcon>
      <PreferencePaneIcon title="Disabled" disabled>
        <PreferencePaneIconArtwork tint="blue" />
      </PreferencePaneIcon>
      <div data-window-state="inactive">
        <PreferencePaneIcon title={"Inactive\nwindow"} data-force="focus">
          <PreferencePaneIconArtwork tint="blue" />
        </PreferencePaneIcon>
      </div>
    </div>
  );
}
