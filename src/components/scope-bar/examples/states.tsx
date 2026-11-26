import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
} from "macalicious/scope-bar";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const cell = { display: "grid", gap: 6 } as const;

function Bar({
  surface,
  force,
  disabled,
}: {
  surface?: "plain" | "toolbar";
  force?: string;
  disabled?: boolean;
}) {
  return (
    <ScopeBar surface={surface} style={{ width: 290 }}>
      <ScopeBarGroup aria-label="Search" defaultValue="on" disabled={disabled}>
        <ScopeBarButton value="off" data-force={force}>
          This Mac
        </ScopeBarButton>
        <ScopeBarButton value="on">Documents</ScopeBarButton>
      </ScopeBarGroup>
      <ScopeBarActions>
        <ScopeBarAction data-force={force} disabled={disabled}>
          Save
        </ScopeBarAction>
        <ScopeBarAction glyph="plus" aria-label="Add search criterion" disabled={disabled} />
      </ScopeBarActions>
    </ScopeBar>
  );
}

/**
 * Every state side by side. Hover, pressed and focused are transient, so this gallery pins
 * them on the first scope and on Save with the `data-force` preview attribute.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(2, max-content)", gap: "14px 24px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal: one scope off, one on</span>
        <Bar />
      </div>
      <div style={cell}>
        <span style={caption}>Toolbar surface</span>
        <Bar surface="toolbar" />
      </div>
      <div style={cell}>
        <span style={caption}>Pointer over the scope that is off</span>
        <Bar force="hover" />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <Bar force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <Bar force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <Bar disabled />
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <Bar />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window, toolbar surface</span>
        <Bar surface="toolbar" />
      </div>
    </div>
  );
}
