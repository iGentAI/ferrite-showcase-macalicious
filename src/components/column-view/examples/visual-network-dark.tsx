import { ColumnView, type ColumnViewItem, ColumnViewPanel } from "macalicious/column-view";
import { PushButton } from "macalicious/push-button";
import type { CSSProperties } from "react";

// Stand-in for Finder's device pictures (Apple artwork); masked in the comparison.
const device = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M1.5 3h13v8h-13zM5 13.5h6" fill="none" stroke="currentColor" opacity="0.6" />
  </svg>
);

const devices: ColumnViewItem[] = ["Castle", "ismhpro", "merribook"].map((label) => ({
  id: label,
  label,
  icon: device,
  hasChildren: true,
}));
// A server that is not connected has nothing to list: its column is the connection panel.
const getChildren = (id: string | number | null) => (id === null ? devices : null);

/**
 * Visual comparison target: Finder's Network window in column view as the Dark Aqua
 * screenshot has it, which differs from the Aqua one: three devices with the first selected,
 * and two 204 pt columns. Reference crop (2x pixels) x=378 y=186 w=1730 h=400, i.e.
 * 865 x 200 pt. The background is the column colour measured in that window, which the
 * desktop picture tints. The device pictures, the texts and the panel's content are
 * stand-ins and masked.
 */
export default function VisualNetworkDark() {
  return (
    <ColumnView
      aria-label="Network"
      data-force="focus"
      getChildren={getChildren}
      defaultPath={["Castle"]}
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
          width: 865,
          height: 200,
          "--mac-column-view-background": "var(--mac-color-control-background-tinted)",
        } as CSSProperties
      }
    />
  );
}
