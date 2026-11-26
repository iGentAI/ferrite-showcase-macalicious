import { Spotlight, SpotlightGroup, SpotlightResult } from "macalicious/spotlight";

/**
 * Visual comparison target: the top-left 200 x 98 pt of the Spotlight window in Aqua, the
 * start of the field, the first category band and the selected top hit. Reference crop (2x
 * pixels) x=1000 y=420 w=400 h=196 of the light Spotlight capture, which is taken over the
 * desktop picture.
 *
 * The window blurs the picture, which is not reproduced: the gradients behind it are the
 * colours that, under the window's material, give the colours measured along the top of the
 * field, its bottom and the category band (blue-grey sky at the top left, warm rock further
 * right and below).
 */
export default function VisualTopLight() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 200,
        height: 98,
        background:
          "linear-gradient(to right, #93a3b2 12.5%, #8a9398 37.5%, #7b7a78 62.5%, #746c5d 87.5%) top / 100% 25px no-repeat, linear-gradient(to right, #7b7f80 12.5%, #71716d 37.5%, #6a6659 62.5%, #6c6347 87.5%) 0 25px / 100% 37px no-repeat, linear-gradient(to right, #6e6e69 12.5%, #686658 37.5%, #645b46 62.5%, #655a35 87.5%)",
      }}
    >
      <Spotlight
        defaultValue="OS X"
        completion="macOS"
        defaultSelectedValue="macOS"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
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
