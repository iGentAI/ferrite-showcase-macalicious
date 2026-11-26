import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SidebarBadge } from "macalicious/sidebar-badge";

/** Stand-in glyphs drawn for this example, not Mail's icons. */
function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 18 18"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * Visual comparison target: the mailbox list of Mail, whose window is behind the compose
 * window in 10-15-Catalina-Light-Mail.png (window edge at x=52, list from y=196) and
 * 10-15-Catalina-Dark-Mail.png (x=40, y=194). The pane is 200 pt wide; the crops (light
 * x=54 y=196, dark x=42 y=194, w=398 h=204, i.e. 199 x 102 pt) leave out its first point and
 * end with the third row. The comparison runs with the window inactive.
 *
 * Mail draws the content of its rows 1 pt higher than Finder and Disk Utility do, which the
 * sidebar follows: the rows get 2 pt of bottom padding here to reproduce it.
 */
const raised = { paddingBlockEnd: 2 };

export default function VisualInactive() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 199, height: 102 }}>
      <Sidebar
        aria-label="Mailboxes"
        material="opaque"
        value="inbox"
        style={{ position: "absolute", left: -1, width: 200, height: 160 }}
      >
        <SidebarSection title="Mailboxes">
          <SidebarItem
            value="inbox"
            label="Inbox"
            style={raised}
            icon={<Glyph d="M1.5 9l3-5h9l3 5v5h-15zM1.5 9h4.5l1 2h4l1-2h4.5" />}
          />
          <SidebarItem
            value="drafts"
            label="Drafts"
            style={raised}
            icon={<Glyph d="M4 2h7l3 3v11H4zM11 2v3h3" />}
            accessory={<SidebarBadge>1</SidebarBadge>}
          />
          <SidebarItem
            value="sent"
            label="Sent"
            style={raised}
            icon={<Glyph d="M2 9l14-6l-5 13l-3-5z" />}
          />
        </SidebarSection>
        <SidebarSection title="Smart Mailboxes" />
      </Sidebar>
    </div>
  );
}
