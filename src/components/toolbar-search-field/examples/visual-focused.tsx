import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";

/**
 * Visual comparison target: the focused search field of the Help Viewer panel, with text and
 * the clear button. The comparison focuses the field with a real click, which leaves the caret
 * after the text as in the capture.
 *
 * Reference crop x=1126 y=64 w=672 h=68 (336 x 34 pt) around the 323 pt field and its 3 pt
 * focus ring, 6 pt to the left of and above the fill. The panel's bar is the 49 pt utility
 * bar and the field ends 8 pt from the panel's right edge. The typed text is masked.
 */
export default function VisualFocused() {
  return (
    <div style={{ position: "relative", width: 336, height: 34, overflow: "hidden" }}>
      <TitleBar
        variant="utility"
        style={{ position: "absolute", right: -1, top: -13, width: 877, height: 49 }}
      >
        <Toolbar aria-label="Toolbar">
          <ToolbarSpace />
          <ToolbarSearchField defaultValue="File" style={{ width: 323 }} />
        </Toolbar>
      </TitleBar>
    </div>
  );
}
