import { ScopeBar, ScopeBarButton, ScopeBarGroup, ScopeBarLabel } from "macalicious/scope-bar";

/**
 * Visual comparison target: the leading end of the scope bar of the Finder Search window.
 *
 * Reference crop (2x pixels) x=442 y=186 w=560 h=64, i.e. 280 x 32 pt, in both appearances;
 * the bar starts at the sidebar divider, the left edge of the crop. The widths pin each part
 * to its measured box, because the text is set in a fallback font off Apple platforms: the
 * label 7 to 52.5 pt, "This Mac" 59.5 to 128.5 pt, the pill 130.5 to 249.5 pt.
 */
export default function VisualFinderSearch() {
  return (
    <div style={{ width: 280, height: 32, overflow: "hidden" }}>
      <ScopeBar style={{ width: 600 }}>
        <ScopeBarLabel style={{ width: 45.5 }}>Search:</ScopeBarLabel>
        <ScopeBarGroup aria-label="Search" defaultValue="disk">
          <ScopeBarButton value="mac" style={{ width: 69 }}>
            This Mac
          </ScopeBarButton>
          <ScopeBarButton value="disk" style={{ width: 119 }}>
            “Macintosh SSD”
          </ScopeBarButton>
        </ScopeBarGroup>
      </ScopeBar>
    </div>
  );
}
