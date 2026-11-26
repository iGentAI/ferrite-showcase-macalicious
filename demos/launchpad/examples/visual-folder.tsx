import { ReferenceLaunchpad } from "../launchpad-visual";

/**
 * The backdrop behind the folder's name, top to bottom of the patch: the capture's colours
 * down the column of the title, every 10 to 40 pt from 60 pt to 310 pt of the screen. Above
 * the panel (which starts at 231 pt) they are read beside the title; under it they are solved
 * from the panel's pixels and the library's fill, 51% of #f5f5f5.
 */
const TITLE_COLUMN = [
  [0, "#3271a4", "#0c2a53"],
  [40, "#3a74a3", "#0f2d56"],
  [60, "#41749c", "#132f57"],
  [80, "#4b7090", "#162f53"],
  [100, "#566876", "#182e4b"],
  [110, "#5b636a", "#1a2c47"],
  [120, "#5f5e59", "#1b2942"],
  [130, "#62594f", "#1c283e"],
  [140, "#625645", "#1c2639"],
  [160, "#62523a", "#1c2332"],
  [170, "#614f36", "#1c2330"],
  [175, "#5e4e33", "#1b212f"],
  [190, "#5c4c2f", "#1b212f"],
  [205, "#58482b", "#1b212e"],
  [220, "#504327", "#1b212d"],
  [250, "#4d4121", "#1c212b"],
] as const;

/**
 * Visual comparison target: the folder "Other" open on the 1680 by 1050 pt screen, as the
 * Launchpad-Folder captures show it, in both appearances (the colours are `light-dark()`).
 *
 * Three parts of the screen are compared, each a `data-crop` box. Crops in 2x pixels of the
 * captures, and what each shows:
 *
 *   panel-top-left      244,432,140,120     the panel's corner at 137,231 pt
 *   panel-bottom-right  2700,1380,440,280   its opposite corner at 1543,804 pt
 *   title               1560,360,240,140    the folder's name above the panel, and the
 *                                           panel's top edge under it
 *
 * No crop holds an application: the third row of the panel ends after three of them.
 *
 * The open folder blurs what is behind it by 40 pt, and the library gives no way to take that
 * off, so each backdrop reaches 120 pt beyond its crop (three times the radius), and what the
 * comparison sees is the measured backdrop blurred once more. The two corners' backdrops are
 * the ones the library's own comparisons measured: a vertical run beside the panel, continued
 * under it.
 */
export default function VisualFolder() {
  return (
    <ReferenceLaunchpad
      defaultFolder="other"
      patches={[
        {
          crop: "panel-top-left",
          rect: [122, 216, 70, 60],
          margin: 120,
          background:
            "linear-gradient(light-dark(#5683a7, #25456d) 120px, light-dark(#6287a4, #315075) 180px)",
        },
        {
          crop: "panel-bottom-right",
          rect: [1350, 690, 220, 140],
          margin: 120,
          background:
            "linear-gradient(light-dark(#244566, #122743) 120px, light-dark(#133551, #0e2037) 260px)",
        },
        {
          crop: "title",
          rect: [780, 180, 120, 70],
          margin: 120,
          background: `linear-gradient(${TITLE_COLUMN.map(
            ([at, light, dark]) => `light-dark(${light}, ${dark}) ${at}px`,
          ).join(", ")})`,
        },
      ]}
    />
  );
}
