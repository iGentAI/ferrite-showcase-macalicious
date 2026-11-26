/**
 * Original stand-ins for artwork that is Apple's and is not shipped: the mark of the Apple menu
 * and the icon of a volume on the desktop.
 */

/** The mark of the Apple menu: a plain ellipse with the mark's ink box, 12.5 x 15.5 pt. */
export function AppleMenuMark() {
  return (
    <svg width="15" height="20" viewBox="0 0 15 20" fill="currentColor" aria-hidden="true">
      <ellipse cx="7.25" cy="8.75" rx="6.25" ry="7.75" />
    </svg>
  );
}

/** A volume: a grey box with an activity light. */
export function VolumeIcon() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <rect x="6" y="14" width="52" height="36" rx="6" fill="#d9dde2" stroke="#8a9099" />
      <path d="M12 40h40" stroke="#b4bac2" />
      <circle cx="48" cy="45" r="2" fill="#57c038" />
    </svg>
  );
}
