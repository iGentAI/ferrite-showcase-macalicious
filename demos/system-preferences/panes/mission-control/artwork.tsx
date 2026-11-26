/*
 * Stand-in for the pane's picture: an original drawing of a dark display with three coloured
 * windows, on the 46 x 39.5 pt box of Apple's icon.
 */
export function MissionControlArtwork() {
  return (
    <svg width="46" height="39.5" viewBox="0 0 46 39.5" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="45" height="38.5" rx="2.5" fill="#141414" stroke="#3d3d3d" />
      <rect x="6" y="6" width="18" height="12" fill="#e8943a" />
      <rect x="6" y="6" width="18" height="3" fill="#f3c98a" />
      <rect x="7" y="21" width="16" height="12" fill="#3b8fe0" />
      <rect x="7" y="21" width="16" height="3" fill="#9cc8f2" />
      <rect x="26" y="12" width="14" height="18" fill="#3dbb4c" />
      <rect x="26" y="12" width="14" height="3" fill="#9be0a2" />
    </svg>
  );
}
