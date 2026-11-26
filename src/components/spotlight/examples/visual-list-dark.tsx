import { Spotlight, SpotlightGroup, SpotlightResult } from "macalicious/spotlight";

const developer = [
  "com_apple_MobileAsset_DictionaryServices_dictionaryOSX.xml",
  "com_apple_MobileAsset_DictionaryServices_dictionaryOSX.plist",
  "version.xml",
  "license.html",
  "license.rtf",
];

/**
 * Visual comparison target: the top-left 300 x 250 pt of the Spotlight window in Dark Aqua,
 * the field, two category bands, the selected first result, the line between the list and the
 * preview and the start of a text preview with a background of its own. Reference crop (2x
 * pixels) x=112 y=76 w=600 h=500 of the dark Spotlight capture, a window capture with nothing
 * behind the window: the material is its opaque base there, and the backdrop here is that
 * colour.
 */
export default function VisualListDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 300,
        height: 250,
        background: "#2b2c2d",
      }}
    >
      <Spotlight
        defaultValue="OS X"
        completion={developer[0]}
        defaultSelectedValue={developer[0]}
        preview={<div style={{ height: "100%", background: "#1e1e1e" }} />}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <SpotlightGroup label="Developer">
          {developer.map((name) => (
            <SpotlightResult key={name} value={name}>
              {name}
            </SpotlightResult>
          ))}
        </SpotlightGroup>
        <SpotlightGroup label="Definition">
          <SpotlightResult value="macOS">macOS</SpotlightResult>
        </SpotlightGroup>
        <SpotlightGroup label="Images">
          <SpotlightResult value="image">OS X Versions.psd</SpotlightResult>
        </SpotlightGroup>
      </Spotlight>
    </div>
  );
}
