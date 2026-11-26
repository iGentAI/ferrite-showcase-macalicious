import { AccountHeader } from "macalicious/account-header";
import { PreferencePaneIcon } from "macalicious/preference-pane-icon";

function Block({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 8 8" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M0 0h8v8H0z" fill="#6aa6d8" />
    </svg>
  );
}

/**
 * Visual comparison target: the account header of System Preferences, whole.
 *
 * Reference crop (2x pixels) x=112 y=152 w=1336 h=224, that is 668 x 112 pt: the 111 pt band
 * (#ececec in Aqua, #2f3031 in Dark Aqua) and its 1 pt separator. The avatar is the circle at
 * 25,23 (64 pt); the name's capitals start at y 32 and the subtitle's at y 54.5; the Apple ID
 * and Family Sharing artwork is 37 pt at x 520 and 602, y 19.5, each over its caption. The
 * picture and the artwork are stand-in blocks, masked in every comparison.
 */
export default function VisualSystemPreferences() {
  return (
    <div style={{ width: 668, height: 112, background: "light-dark(#ececec, #2f3031)" }}>
      <AccountHeader
        name="Stephen Hackett"
        subtitle="Apple ID, iCloud"
        avatar={<Block size={64} />}
      >
        <PreferencePaneIcon title="Apple ID">
          <Block size={37} />
        </PreferencePaneIcon>
        <PreferencePaneIcon title={"Family\nSharing"}>
          <Block size={37} />
        </PreferencePaneIcon>
      </AccountHeader>
    </div>
  );
}
