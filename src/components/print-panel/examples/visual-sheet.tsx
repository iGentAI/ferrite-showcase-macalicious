import { Checkbox } from "macalicious/checkbox";
import { MenuItem } from "macalicious/menu-item";
import { PrintPanel } from "macalicious/print-panel";

/* The two buttons whose width sets the place of another (PDF, the second of the bottom row,
   and Hide Details, the third) have their measured width: text is set in a fallback font off
   Apple platforms. */
const WIDTHS = `
  .mac-print-panel-actions > :nth-child(2) { width: 58px; }
  .mac-print-panel-actions > :nth-child(3) { width: 102px; }
`;

/* Behind the left of the sheet is sky. The material turns from the sky's colour to its own
   grey by the distance from the sheet's left edge: the share of grey, read along the rows
   y=12 and y=350 of both captures. The sky gets darker towards the bottom. */
const GREY = "light-dark(#efefef, #2d2d2d)";
const SKY: [x: number, share: number][] = [
  [67.5, 0],
  [89, 0.05],
  [110.5, 0.14],
  [132, 0.35],
  [153.5, 0.63],
  [175, 0.87],
  [196.5, 0.95],
  [218, 1],
];
const sky = (left: number, top: string, bottom: string) =>
  `linear-gradient(to right, ${SKY.map(
    ([x, share]) => `rgb(from ${GREY} r g b / ${share}) ${x - left}px`,
  ).join(", ")}), linear-gradient(${top}, ${bottom})`;

/* Behind the right of the sheet is rock: the colours read along one row of each capture, by
   the distance from the region's left edge. */
const rock = (...stops: [x: number, light: string, dark: string][]) =>
  `linear-gradient(to right, ${stops
    .map(([x, light, dark]) => `light-dark(${light}, ${dark}) ${x}px`)
    .join(", ")})`;

/* One region of the sheet: where it is (points from the sheet's top-left corner) and what
   is behind the sheet's material there, as measured in the two captures. */
const REGIONS: [name: string, x: number, y: number, w: number, h: number, background: string][] = [
  [
    "preview",
    44,
    8,
    262,
    344,
    sky(44, "light-dark(#c1d5e7, #334966)", "light-dark(#b0c3d7, #2c435d)"),
  ],
  [
    "printer",
    372,
    12,
    308,
    29,
    rock(
      [128, "#eeeeee", "#313132"],
      [158, "#eeeded", "#313132"],
      [188, "#ececeb", "#303132"],
      [218, "#e9e7e3", "#2f3133"],
      [248, "#e4dbcf", "#2e2f35"],
      [278, "#e0d4c2", "#2c2f37"],
      [308, "#e1d4bf", "#2b2f38"],
    ),
  ],
  [
    "options",
    336,
    186,
    296,
    122,
    rock(
      [216, "#efefef", "#2d2d2d"],
      [229, "#eeeded", "#2d2d2e"],
      [242, "#ececea", "#2e2e2f"],
      [255, "#eae9e7", "#2d2e30"],
      [268, "#e8e7e0", "#2e2f32"],
      [281, "#e6e2d8", "#2f2f33"],
      [294, "#e2dcd0", "#2e3035"],
    ),
  ],
  [
    "actions-leading",
    8,
    350,
    224,
    60,
    sky(8, "light-dark(#afc3d7, #2c425d)", "light-dark(#aec1d6, #2a3f5a)"),
  ],
  [
    "actions-trailing",
    572,
    350,
    176,
    60,
    rock(
      [4, "#ecebea", "#2d2d2e"],
      [21, "#e8e7e4", "#2d2d2f"],
      [38, "#e1ded7", "#2d2d30"],
      [55, "#d9d5cb", "#2b2d30"],
      [72, "#d2cec3", "#2a2c30"],
      [89, "#cec9be", "#292c30"],
      [106, "#ccc7bb", "#292b2f"],
      [123, "#cac5ba", "#292a2f"],
      [140, "#c8c4b9", "#282a2f"],
      [157, "#c6c2b9", "#292b2e"],
      [174, "#c4c0b9", "#282b2f"],
    ),
  ],
];

/**
 * Visual comparison target: the Print sheet of TextEdit, the detailed form. Reference crop
 * (2x pixels) of the whole sheet: x=141 y=204 w=1512 h=838 in the light capture, x=55 y=174 in
 * the dark one, i.e. 756 x 419 pt; the panel is the sheet's content, inside its 20 pt margins.
 *
 * In the captures the Presets menu is open over the middle of the form, and the sheet's
 * material shows the desktop picture behind it, blurred: sky at the left, rock at the right.
 * So the comparisons take five regions that the menu does not cover, each a `data-visual`
 * element captured with `selector`, and each paints the colours measured behind the sheet at
 * that spot. The material itself is the sheet's, not the panel's.
 *
 * The two buttons whose width sets the place of another (PDF, Hide Details) have their
 * measured width, and the pane's two checkboxes stand in a box of the measured 186 pt.
 */
export default function VisualSheet() {
  return (
    <div
      style={{
        position: "relative",
        isolation: "isolate",
        boxSizing: "border-box",
        width: 756,
        height: 419,
        padding: 20,
        background: GREY,
      }}
    >
      <style>{WIDTHS}</style>
      {REGIONS.map(([name, left, top, width, height, background]) => (
        <div
          key={name}
          data-visual={name}
          style={{ position: "absolute", zIndex: -1, left, top, width, height, background }}
        />
      ))}
      <PrintPanel
        defaultDetailed
        printers={[{ value: "brother", label: "Brother HL-2270DW series" }]}
        presets={[{ value: "default", label: "Default Settings" }]}
        paperSizes={[{ value: "letter", label: "US Letter", description: "8.50 by 11.00 inches" }]}
        panes={[
          {
            value: "app",
            label: "TextEdit",
            content: (
              <div style={{ display: "grid", gap: 6, width: 186, whiteSpace: "nowrap" }}>
                <Checkbox>Print header and footer</Checkbox>
                <Checkbox defaultChecked>Rewrap contents to fit page</Checkbox>
              </div>
            ),
          },
        ]}
        preview={
          <p style={{ margin: "26px 29px", font: "5px / 6px Helvetica, Arial, sans-serif" }}>
            Here’s to the crazy ones...
          </p>
        }
        pdfMenu={<MenuItem>Save as PDF…</MenuItem>}
      />
    </div>
  );
}
