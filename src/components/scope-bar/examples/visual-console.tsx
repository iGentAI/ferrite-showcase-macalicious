import { ScopeBar, ScopeBarButton, ScopeBarGroup } from "macalicious/scope-bar";

/**
 * Visual comparison target: the leading end of Console's scope bar, the small bar on the
 * toolbar surface.
 *
 * Reference crop (2x pixels) x=112 y=212 w=600 h=46, i.e. 300 x 23 pt from the window's edge:
 * 22 pt of fill and the two bottom rows. Console's sidebar button takes the first 31 pt after
 * the bar's 9 pt inset; it is an image button with a stand-in glyph, so a spacer holds its
 * place and the comparisons mask it. The widths pin each scope to its measured box: the pill
 * 40 to 123 pt from the window's edge, "Errors and Faults" 125 to 227 pt.
 */
export default function VisualConsole() {
  return (
    <ScopeBar surface="toolbar" size="small" style={{ width: 300 }}>
      <span style={{ flex: "none", width: 31 }} />
      <ScopeBarGroup aria-label="Show" defaultValue="all">
        <ScopeBarButton value="all" style={{ width: 83 }}>
          All Messages
        </ScopeBarButton>
        <ScopeBarButton value="errors" style={{ width: 102 }}>
          Errors and Faults
        </ScopeBarButton>
      </ScopeBarGroup>
    </ScopeBar>
  );
}
