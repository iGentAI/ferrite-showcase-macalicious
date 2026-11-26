import { AccountHeader } from "macalicious/account-header";

/**
 * Fixture for what no screenshot shows: the header without a picture and without
 * destinations. 240 x 112 pt on the window background; the silhouette's disc is the 64 pt
 * circle at 25,23, its head the 24 pt circle at 45,36.
 */
export default function VisualPlaceholder() {
  return (
    <div style={{ width: 240, background: "var(--mac-color-window-background)" }}>
      <AccountHeader name="Guest" />
    </div>
  );
}
