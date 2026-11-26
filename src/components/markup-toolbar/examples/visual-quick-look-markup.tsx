import {
  MarkupToolbar,
  MarkupToolbarSeparator,
  MarkupToolbarTool,
} from "macalicious/markup-toolbar";
import { QuickLookPanel } from "macalicious/quick-look-panel";

/* Tool widths in points, so that the two separators stand where the capture has them (286
   and 474 pt from the panel's left edge). The glyphs are Apple artwork and are left out. */
const FIRST: [label: string, width: number, menu?: boolean][] = [
  ["Sketch", 30],
  ["Draw", 42],
  ["Shapes", 48, true],
  ["Text", 38],
  ["Highlight", 38],
  ["Sign", 46, true],
];
const SECOND: [label: string, width: number][] = [
  ["Shape Style", 44],
  ["Border Colour", 44],
  ["Fill Colour", 44],
  ["Text Style", 39],
];

/**
 * Visual comparison target: the leading 600 pt of Quick Look's bar in Markup mode: the close
 * disc, the tools and the two separators. Reference crop (2x pixels) w=1200 h=76 from the
 * panel's top-left corner: x=1480 y=90 in the light capture, x=964 y=118 in the dark one.
 *
 * The panel floats over the desktop picture, so the bar's colour is the picture's, blurred and
 * tinted. The example paints, behind the panel, the flat colour that gives the colour
 * measured in the middle of this stretch of the bar. Every glyph is masked.
 */
export default function VisualQuickLookMarkup() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 600,
        height: 38,
        background: "light-dark(#6a9ac0, #212c40)",
      }}
    >
      <QuickLookPanel
        title="10-9.jpg"
        width={892}
        height={547}
        style={{ position: "absolute", top: 0, left: 0 }}
        tools={
          <MarkupToolbar aria-label="Markup">
            {FIRST.map(([label, width, menu]) => (
              <MarkupToolbarTool
                key={label}
                aria-label={label}
                menu={menu}
                selected={label === "Sketch" ? true : undefined}
                style={{ width, padding: 0 }}
              />
            ))}
            <MarkupToolbarSeparator />
            {SECOND.map(([label, width]) => (
              <MarkupToolbarTool
                key={label}
                aria-label={label}
                menu
                style={{ width, padding: 0 }}
              />
            ))}
            <MarkupToolbarSeparator />
            <MarkupToolbarTool aria-label="Rotate Left" style={{ width: 30, padding: 0 }} />
            <MarkupToolbarTool aria-label="Crop" style={{ width: 36, padding: 0 }} />
          </MarkupToolbar>
        }
      />
    </div>
  );
}
