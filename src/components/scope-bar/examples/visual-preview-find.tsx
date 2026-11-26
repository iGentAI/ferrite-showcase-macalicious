import { ScopeBar, ScopeBarButton, ScopeBarGroup, ScopeBarLabel } from "macalicious/scope-bar";

/**
 * Visual comparison target: the leading end of Preview's find bar.
 *
 * Reference crop (2x pixels) x=114 y=186 w=520 h=62, i.e. 260 x 31 pt. The bar starts at the
 * window's edge, one point left of the crop (the dark window's inner border is there). The
 * widths pin each part to its measured box: the label 9 to 59.5 pt from the window's edge,
 * "Search Rank" 61.5 to 161 pt, the pill 163 to 257 pt.
 *
 * In the dark screenshot the bar is lit by the page behind the window from 135 pt on, which is
 * not reproduced, so the dark comparison captures `#over-sidebar` only: the first 134 pt.
 */
export default function VisualPreviewFind() {
  return (
    <div style={{ position: "relative", width: 260, height: 31, overflow: "hidden" }}>
      <ScopeBar surface="toolbar" style={{ width: 600, marginLeft: -1 }}>
        <ScopeBarLabel style={{ width: 50.5 }}>Sort by:</ScopeBarLabel>
        <ScopeBarGroup aria-label="Sort by" defaultValue="page">
          <ScopeBarButton value="rank" style={{ width: 99.5 }}>
            Search Rank
          </ScopeBarButton>
          <ScopeBarButton value="page" style={{ width: 94 }}>
            Page Order
          </ScopeBarButton>
        </ScopeBarGroup>
      </ScopeBar>
      <div
        id="over-sidebar"
        style={{ position: "absolute", inset: "0 auto 0 0", width: 134, pointerEvents: "none" }}
      />
    </div>
  );
}
