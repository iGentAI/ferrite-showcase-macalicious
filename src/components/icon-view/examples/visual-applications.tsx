import { IconView } from "macalicious/icon-view";

const apps = [
  "App Store",
  "Automator",
  "Books",
  "Calculator",
  "Calendar",
  "Chess",
  "Contacts",
  "Dictionary",
  "FaceTime",
  "Find My",
  "Font Book",
  "Home",
  "Image Capture",
  "Launchpad",
  "Mail",
  "Maps",
  "Messages",
  "Mission Control",
  "Music",
  "News",
  "Notes",
  "Photo Booth",
  "Photos",
  "Podcasts",
  "Preview",
  "QuickTime Player",
  "Reminders",
  "Safari",
  "Siri",
  "Stickies",
  "Stocks",
  "System Preferences",
  "TextEdit",
  "Time Machine",
  "TV",
  "Utilities",
  "Voice Memos",
];

// Stand-in artwork for the applications' icons: a rounded tile, 56 pt in the 64 pt box.
const renderIcon = (index: number) => (
  <svg viewBox="0 0 64 64" width="64" height="64" style={{ color: `hsl(${index * 47} 50% 58%)` }}>
    <title>Application</title>
    <rect x="4" y="4" width="56" height="56" rx="13" fill="currentColor" />
  </svg>
);

/**
 * Visual comparison target: the icon view of Finder's Applications window,
 * 10-15-Catalina-Light-Applications.png (crop x=442 y=186 w=1830 h=1390, 2x pixels: the
 * 915 pt wide content less its last 6 pt, where the window's corners are) and
 * 10-15-Catalina-Dark-Applications.png (x=442 y=186 w=1900 h=1344: 950 pt wide). Both show 37
 * applications in eight columns, 113 pt apart in the narrower window and 117 pt in the wider.
 * The example takes the size of the crop of its appearance. The icons are stand-ins, and
 * masked in the comparison. The last point of the Dark Aqua crop is the window's edge
 * highlight, which lies over the view; the example paints it.
 */
export default function VisualApplications() {
  return (
    <IconView
      aria-label="Applications"
      count={apps.length}
      renderIcon={renderIcon}
      getItemLabel={(index) => apps[index] ?? ""}
      style={{
        width: "calc(915px + 35px * var(--mac-appearance-dark))",
        height: "calc(695px - 23px * var(--mac-appearance-dark))",
        background: "light-dark(#ffffff, #1e2022)",
        boxShadow: "inset -1px 0 light-dark(transparent, #4b4d4e)",
      }}
    />
  );
}
