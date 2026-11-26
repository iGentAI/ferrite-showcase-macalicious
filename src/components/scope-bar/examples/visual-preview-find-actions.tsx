import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActionGroup,
  ScopeBarActions,
} from "macalicious/scope-bar";

/**
 * Visual comparison target: the trailing end of Preview's find bar, with the disabled
 * previous and next buttons and Done.
 *
 * Reference crop (2x pixels) x=2196 y=186 w=208 h=62 of the light screenshot, i.e.
 * 104 x 31 pt. The crop ends one point before the window's edge, so the bar runs one point
 * past the frame. Done is pinned to its measured 42 pt.
 */
export default function VisualPreviewFindActions() {
  return (
    <div style={{ width: 104, height: 31, overflow: "hidden" }}>
      <ScopeBar surface="toolbar" style={{ width: 300, marginLeft: -195 }}>
        <ScopeBarActions>
          <ScopeBarActionGroup aria-label="Matches">
            <ScopeBarAction glyph="previous" aria-label="Previous match" disabled />
            <ScopeBarAction glyph="next" aria-label="Next match" disabled />
          </ScopeBarActionGroup>
          <ScopeBarAction style={{ width: 42 }}>Done</ScopeBarAction>
        </ScopeBarActions>
      </ScopeBar>
    </div>
  );
}
