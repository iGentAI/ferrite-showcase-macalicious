import { ScrollView } from "macalicious/scroll-view";

/**
 * Visual comparison target: the upper end of the overlay knob of Preview's document view,
 * over the flat menu-bar band of the desktop picture it shows. Reference crops (2x pixels):
 * 10-15-Catalina-Light-Preview.png x=1876 y=188 w=34 h=42 (band #bfe0f3) and
 * 10-15-Catalina-Dark-Preview.png x=2622 y=188 w=34 h=42 (band #171d2f), i.e. 17 x 21 pt
 * ending at the content's trailing edge. The content starts 1 pt above the crop and the knob,
 * 2 pt inside the track, starts 1 pt into it; the knob is longer than the crop.
 *
 * The knob style is the appearance's default: dark in the Aqua window, light in the Dark Aqua
 * one. `data-force` shows the knob without scrolling. The band colour is the picture's, so it
 * is set here and not taken from a token.
 */
export default function VisualPreviewKnob() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 17,
        height: 21,
        background: "light-dark(#bfe0f3, #171d2f)",
      }}
    >
      <ScrollView
        data-force="scrolling"
        style={{ position: "absolute", top: -1, left: 0, width: 17, height: 200 }}
      >
        <div style={{ height: (200 * 196) / 150 }} />
      </ScrollView>
    </div>
  );
}
