import { Desktop } from "macalicious/desktop";
import { DesktopIcon } from "macalicious/desktop-icon";

/** A stand-in for a volume's artwork: Apple's icons are not part of the library. */
function Drive() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <rect x="6" y="14" width="52" height="36" rx="6" fill="#d9dde2" stroke="#8a9099" />
      <circle cx="48" cy="41" r="2.5" fill="#57c038" />
    </svg>
  );
}

export default function Basic() {
  return (
    <Desktop style={{ width: "100%", height: 260 }}>
      <DesktopIcon icon={<Drive />}>Macintosh SSD</DesktopIcon>
      <DesktopIcon icon={<Drive />}>Time Machine</DesktopIcon>
    </Desktop>
  );
}
