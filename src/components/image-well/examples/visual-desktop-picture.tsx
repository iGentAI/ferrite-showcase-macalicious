import { ImageWell } from "macalicious/image-well";

// Original stand-in for the desktop picture, 119 x 74 pt like the thumbnail in the screenshot.
// The comparison masks this area: the screenshot holds Apple's wallpaper there.
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="119" height="74" viewBox="0 0 119 74"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#27356b"/><stop offset="1" stop-color="#d98a6a"/></linearGradient></defs><path fill="url(#s)" d="M0 0h119v74H0z"/><circle cx="86" cy="30" r="9" fill="#ffe2a8"/><path fill="#1c2340" d="m0 52 28-18 22 16 20-12 49 22v14H0z"/><path fill="#101528" d="m0 62 40-12 38 14 41-10v20H0z"/></svg>',
)}`;

/**
 * Visual comparison target: the desktop picture well of the Desktop & Screen Saver preference
 * pane.
 *
 * Reference crop (2x pixels) x=201 y=250 w=300 h=200, that is 150 x 100 pt. The ring's outer
 * edge runs x 211 to 486 and y 264 to 439: a 138 x 88 pt well, 5 pt from the crop's left edge
 * and 7 pt from its top. (The crop starts on an odd pixel so that the well's edges fall on
 * whole points.) The image is 119 x 74 pt, 5 pt inside the ring above and below.
 */
export default function VisualDesktopPicture() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 150,
        height: 100,
        padding: "7px 0 0 5px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <ImageWell
        aria-label="Desktop picture"
        src={PICTURE}
        style={{ display: "flex", width: 138, height: 88 }}
      />
    </div>
  );
}
