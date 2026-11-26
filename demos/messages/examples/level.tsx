import type { CSSProperties } from "react";
import { Messages } from "../messages";

/**
 * The window at a level its owner wrote with a custom property of the window's own, with its
 * Preferences open: they are one level over the window, and one under it once the window is
 * pressed.
 */
export default function Level() {
  const style = {
    "--window-level": 40,
    zIndex: "var(--window-level)",
    maxWidth: 730,
  } as CSSProperties;
  return (
    <div style={{ position: "relative", display: "grid", justifyItems: "start" }}>
      <Messages material="opaque" width="100%" height={520} style={style} defaultPreferencesOpen />
    </div>
  );
}
