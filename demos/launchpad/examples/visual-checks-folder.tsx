import { CatalinaLaunchpad } from "../launchpad";

/**
 * State check target: the whole 1680 by 1050 pt screen with the folder "Other" open, over a
 * flat mid grey, #808080, in place of the demo's picture. As in `visual-checks`, every layer
 * can then be computed from the library's tokens: Launchpad's scrim gives #545454, the open
 * folder's own dimming #4d4d4d, and the panel's fill over that #a3a3a3. The checks look for
 * the panel's four edges and the first placeholder where the Launchpad-Folder captures have
 * them, and for the Dock's absence.
 */
export default function VisualChecksFolder() {
  return (
    <CatalinaLaunchpad
      defaultOpen
      defaultFolder="other"
      picture={<div style={{ background: "#808080" }} />}
      style={{ width: 1680, height: 1050 }}
    />
  );
}
