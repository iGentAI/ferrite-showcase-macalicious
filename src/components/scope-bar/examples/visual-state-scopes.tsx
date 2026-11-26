import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
} from "macalicious/scope-bar";

/**
 * Fixture for the states no reference screenshot shows (pointer over a scope, keyboard focus,
 * a window that is not key). `scope-bar.visual.json` puts it into each state with real input
 * and checks the pixels it expects.
 *
 * 320 x 32 pt. The scope that is off is x 7 to 77, the one that is on x 79 to 159, both
 * y 8 to 24; Save is x 250 to 290, + x 292 to 310.
 */
export default function VisualStateScopes() {
  return (
    <ScopeBar style={{ width: 320 }}>
      <ScopeBarGroup aria-label="Kind" defaultValue="on">
        <ScopeBarButton id="off" value="off" style={{ width: 70 }}>
          Any
        </ScopeBarButton>
        <ScopeBarButton id="on" value="on" style={{ width: 80 }}>
          PDF
        </ScopeBarButton>
      </ScopeBarGroup>
      <ScopeBarActions>
        <ScopeBarAction id="save" style={{ width: 40 }}>
          Save
        </ScopeBarAction>
        <ScopeBarAction glyph="plus" aria-label="Add search criterion" />
      </ScopeBarActions>
    </ScopeBar>
  );
}
