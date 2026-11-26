import { AccountHeader } from "macalicious/account-header";
import { PreferencePaneIcon, PreferencePaneIconArtwork } from "macalicious/preference-pane-icon";

/** An account picture drawn for this example: any 64 pt image or inline SVG works. */
function Picture() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false">
      <path d="M0 0h64v64H0z" fill="#3f8f5f" />
      <path d="M-4 50c14-18 26 8 40-12s22-6 34-18v48H-4z" fill="#2c6b46" />
      <circle cx="44" cy="18" r="8" fill="#f3d36b" />
    </svg>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * The header as System Preferences lays it out, 668 pt wide, with two destinations aligned to
 * the last two columns of the pane grid. Picture and artwork are drawn for this example.
 */
export default function SystemPreferences() {
  return (
    <div style={{ width: 668, background: "var(--mac-color-window-background)" }}>
      <AccountHeader name="Ada Appleseed" subtitle="Account, Cloud" avatar={<Picture />}>
        <PreferencePaneIcon title="Account">
          <PreferencePaneIconArtwork tint="gray">
            <Glyph d="M12 12a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM5 19c0-6 14-6 14 0" />
          </PreferencePaneIconArtwork>
        </PreferencePaneIcon>
        <PreferencePaneIcon title={"Family\nSharing"}>
          <PreferencePaneIconArtwork tint="white">
            <Glyph d="M8 11a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5zM3.500 18c0-5 9-5 9 0M16.500 12a2 2 0 1 0 0-4M15 14c3 0 5 1 5 4" />
          </PreferencePaneIconArtwork>
        </PreferencePaneIcon>
      </AccountHeader>
    </div>
  );
}
