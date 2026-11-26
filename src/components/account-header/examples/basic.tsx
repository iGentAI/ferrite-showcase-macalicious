import { AccountHeader } from "macalicious/account-header";
import { PreferencePaneIcon, PreferencePaneIconArtwork } from "macalicious/preference-pane-icon";

export default function Basic() {
  return (
    <div style={{ width: 480, background: "var(--mac-color-window-background)" }}>
      <AccountHeader name="Ada Appleseed" subtitle="Account, Cloud">
        <PreferencePaneIcon title="Account">
          <PreferencePaneIconArtwork tint="gray" />
        </PreferencePaneIcon>
      </AccountHeader>
    </div>
  );
}
