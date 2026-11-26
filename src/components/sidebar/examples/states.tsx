import { Sidebar, SidebarItem, type SidebarProps, SidebarSection } from "macalicious/sidebar";
import { SidebarBadge } from "macalicious/sidebar-badge";
import { useState } from "react";

const caption = {
  margin: "0 0 6px",
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * One sidebar. The badge is told its row's state: selected while Inbox is, and emphasised
 * while the selection is drawn in the accent colour, which is when the list has the keyboard
 * focus (`look="focus"` pins that, as `data-force` does) in a window that is not inactive.
 */
function Mailboxes({ look, ...props }: SidebarProps & { look?: "focus" | "inactive" }) {
  const [value, setValue] = useState("inbox");
  const [focused, setFocused] = useState(false);
  return (
    <Sidebar
      aria-label="Mailboxes"
      material="opaque"
      value={value}
      onValueChange={setValue}
      onFocus={(event) => setFocused(event.target.closest(".mac-sidebar-scroll") !== null)}
      onBlur={() => setFocused(false)}
      data-force={look === "focus" ? "focus" : undefined}
      style={{ width: 150 }}
      {...props}
    >
      <SidebarSection title="Mailboxes">
        <SidebarItem
          value="inbox"
          label="Inbox"
          accessory={
            <SidebarBadge
              selected={value === "inbox"}
              emphasized={look !== "inactive" && (look === "focus" || focused)}
            >
              3
            </SidebarBadge>
          }
        />
        <SidebarItem value="sent" label="Sent" />
        <SidebarItem value="junk" label="Junk" disabled />
      </SidebarSection>
    </Sidebar>
  );
}

/**
 * The selection in its three looks, and a disabled row. `data-force` pins the look of a
 * sidebar that holds the keyboard focus; the last one is in an inactive window.
 */
export default function States() {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div>
        <p style={caption}>Selected</p>
        <Mailboxes />
      </div>
      <div>
        <p style={caption}>Selected, with the focus</p>
        <Mailboxes look="focus" />
      </div>
      <div data-window-state="inactive">
        <p style={caption}>Inactive window</p>
        <Mailboxes look="inactive" />
      </div>
    </div>
  );
}
