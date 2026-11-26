import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";
import type { ComponentProps } from "react";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Pdf(props: ComponentProps<typeof PullDownButton>) {
  return (
    <PullDownButton title="PDF" {...props}>
      <MenuItem>Open in Preview</MenuItem>
      <MenuItem>Save as PDF</MenuItem>
      <MenuSeparator />
      <MenuItem>Send in Mail</MenuItem>
    </PullDownButton>
  );
}

/**
 * Every state side by side. Pressed and focused are transient, so this gallery pins them with
 * the `data-force` preview attribute; in an application they come from :active, the open menu
 * and :focus-visible.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <Pdf />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed or open</span>
        <Pdf data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <Pdf data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <Pdf disabled />
      </div>
      <div style={cell}>
        <span style={caption}>No bezel</span>
        <Pdf bordered={false} size="small" title="Sort by Date" />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <Pdf />
      </div>
    </div>
  );
}
