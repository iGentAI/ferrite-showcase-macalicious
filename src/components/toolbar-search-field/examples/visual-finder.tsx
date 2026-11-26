import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";

/**
 * Visual comparison target: the empty search field of the key Finder window.
 *
 * Reference crop 660 x 56 px (330 x 28 pt) around the 323 pt field, 3 pt to its left and 3 pt
 * above its fill: x=1296 y=120 in the light capture, x=1442 in the dark one, whose window is
 * wider. The field ends 8 pt from the window's right edge. In the light capture the placeholder
 * starts 27 pt from the fill's edge, set here with the text-inset hook; `visual-finder-dark`
 * passes the 23 pt of the dark capture. The placeholder is masked in the
 * tight comparison because it is set in the fallback font off Apple platforms.
 */
export default function VisualFinder({ textInset = 27 }) {
  return (
    <div style={{ position: "relative", width: 330, height: 28, overflow: "hidden" }}>
      <TitleBar
        variant="unified"
        style={{ position: "absolute", right: -4, top: -22, width: 926, height: 55 }}
      >
        <Toolbar aria-label="Toolbar">
          <ToolbarSpace />
          <ToolbarSearchField
            style={{
              width: 323,
              ["--mac-toolbar-search-field-text-inset" as string]: `${textInset}px`,
            }}
          />
        </Toolbar>
      </TitleBar>
    </div>
  );
}
