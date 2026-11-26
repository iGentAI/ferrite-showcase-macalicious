import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarSearchField, ToolbarSearchFieldToken } from "macalicious/toolbar-search-field";

/**
 * Visual comparison target: the focused search field of the Finder window during a search by
 * name, Dark Aqua, holding the token “Name: Aqua” and the clear button.
 *
 * Reference crop 660 x 56 px (330 x 28 pt) at x=1356 y=120 of Dark-Finder-Search, around the
 * 323 pt field: 3 pt to the left of and above its fill, which the focus ring takes. The token
 * runs from x 1414 to 1577 (criterion 41 pt, 1 pt, value 40 pt) and the caret is at x 1584.
 * The comparison focuses the field with a real click. The token's text is masked in the tight
 * comparison because it is set in the fallback font off Apple platforms; for the same reason
 * the two texts are given the widths they have in the capture, 25 and 29 pt.
 */
const text = (width: number) =>
  ({ display: "inline-block", width, overflow: "hidden", whiteSpace: "nowrap" }) as const;

export default function VisualTokenDark() {
  return (
    <div style={{ position: "relative", width: 330, height: 28, overflow: "hidden" }}>
      <TitleBar
        variant="unified"
        style={{ position: "absolute", right: -4, top: -22, width: 926, height: 55 }}
      >
        <Toolbar aria-label="Toolbar">
          <ToolbarSpace />
          <ToolbarSearchField
            tokens={
              <ToolbarSearchFieldToken criterion={<span style={text(25)}>Name</span>}>
                <span style={text(29)}>Aqua</span>
              </ToolbarSearchFieldToken>
            }
            style={{ width: 323 }}
          />
        </Toolbar>
      </TitleBar>
    </div>
  );
}
