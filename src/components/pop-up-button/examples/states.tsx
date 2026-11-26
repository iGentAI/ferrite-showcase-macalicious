import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import type { ComponentProps } from "react";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Size({ label, ...props }: { label: string } & ComponentProps<typeof PopUpButton>) {
  return (
    <PopUpButton defaultValue="medium" aria-label={label} style={{ width: 110 }} {...props}>
      <PopUpButtonItem value="small">Small</PopUpButtonItem>
      <PopUpButtonItem value="medium">Medium</PopUpButtonItem>
      <PopUpButtonItem value="large">Large</PopUpButtonItem>
    </PopUpButton>
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
        <Size label="Normal" />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <Size label="Pressed" data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <Size label="Keyboard focus" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <Size label="Disabled" disabled />
      </div>
      <div style={cell}>
        <span style={caption}>No bezel</span>
        <Size label="No bezel" bordered={false} />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <Size label="Inactive window" />
      </div>
    </div>
  );
}
