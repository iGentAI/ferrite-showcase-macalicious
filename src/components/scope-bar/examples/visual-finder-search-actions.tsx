import { ScopeBar, ScopeBarAction, ScopeBarActions } from "macalicious/scope-bar";

/**
 * Visual comparison target: the trailing end of the scope bar of the Finder Search window,
 * with Save and +.
 *
 * Reference crop (2x pixels) w=400 h=64, i.e. 200 x 32 pt, at x=1968 y=186 in the light
 * screenshot and x=1622 y=186 in the dark one. Both crops end one point before the window's
 * edge (the dark window's inner border is there), so the bar runs one point past the frame.
 * Save is pinned to its measured 42 pt.
 */
export default function VisualFinderSearchActions() {
  return (
    <div style={{ width: 200, height: 32, overflow: "hidden" }}>
      <ScopeBar style={{ width: 400, marginLeft: -199 }}>
        <ScopeBarActions>
          <ScopeBarAction style={{ width: 42 }}>Save</ScopeBarAction>
          <ScopeBarAction glyph="plus" aria-label="Add search criterion" />
        </ScopeBarActions>
      </ScopeBar>
    </div>
  );
}
