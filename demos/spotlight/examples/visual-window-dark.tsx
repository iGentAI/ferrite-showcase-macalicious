import { CatalinaSpotlight } from "../spotlight";
import { developerItems } from "../spotlight-data";

/**
 * Visual comparison target: the whole Spotlight window of the Dark Aqua capture, searching
 * the developer's index for "OS X": the Developer group first, its first file selected and
 * that file's text in the preview.
 * Reference crop (2x pixels) x=112 y=76 w=1360 h=860, i.e. the 680 x 430 pt window of a window
 * capture, over the capture's transparent margin (matte white). The window's material is
 * opaque in Dark Aqua, so nothing behind it shows.
 */
export default function VisualWindowDark() {
  return (
    <div
      className="mac-spotlight-app-example-matte"
      style={{ position: "relative", overflow: "hidden", width: 680, height: 430 }}
    >
      <CatalinaSpotlight
        items={developerItems}
        defaultQuery="OS X"
        style={{ position: "absolute", top: 0, left: 0 }}
      />
    </div>
  );
}
