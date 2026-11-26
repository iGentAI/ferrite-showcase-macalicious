import { ColumnView, type ColumnViewItem, ColumnViewPanel } from "macalicious/column-view";
import { PushButton } from "macalicious/push-button";
import type { CSSProperties } from "react";

// Stand-in for Finder's device pictures (Apple artwork); masked in the comparison.
const device = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M1.5 3h13v8h-13zM5 13.5h6" fill="none" stroke="currentColor" opacity="0.6" />
  </svg>
);

const devices: ColumnViewItem[] = ["brn30055c475bce", "Castle", "ismhpro", "merribook"].map(
  (label) => ({ id: label, label, icon: device, hasChildren: true }),
);
// A server that is not connected has nothing to list: its column is the connection panel.
const getChildren = (id: string | number | null) => (id === null ? devices : null);

/**
 * Visual comparison target: Finder's Network window in column view, Aqua. Reference crop
 * (2x pixels) x=444 y=186 w=1520 h=400, i.e. 760 x 200 pt: the 203.5 pt device column with
 * "Castle" selected, its divider, the 252 pt connection panel, its divider and the empty
 * rest. The device pictures, the texts and the panel's content (its buttons have a bezel
 * this library does not draw) are stand-ins and masked.
 */
export default function VisualNetwork() {
  return (
    <ColumnView
      aria-label="Network"
      data-force="focus"
      getChildren={getChildren}
      defaultPath={["Castle"]}
      defaultColumnWidths={[203.5, 252]}
      renderPreview={(item) => (
        <ColumnViewPanel style={{ height: 172, paddingTop: 34 }}>
          <div style={{ width: 48, height: 24, background: "var(--mac-color-label-tertiary)" }} />
          <strong style={{ marginTop: 21 }}>{item.label}</strong>
          <span
            style={{
              marginTop: 3,
              font: "var(--mac-font-control-small)",
              color: "var(--mac-color-label-secondary)",
            }}
          >
            Not Connected
          </span>
          <PushButton size="small" style={{ width: 114, marginTop: 7 }}>
            Connect As...
          </PushButton>
          <PushButton size="small" style={{ width: 114, marginTop: 8 }}>
            Share Screen...
          </PushButton>
        </ColumnViewPanel>
      )}
      style={
        {
          width: 760,
          height: 200,
          "--mac-column-view-background": "var(--mac-color-control-background-tinted)",
        } as CSSProperties
      }
    />
  );
}
