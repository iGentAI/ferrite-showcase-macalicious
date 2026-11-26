import {
  CatalystChrome,
  CatalystSidebar,
  CatalystSidebarGroup,
  CatalystSidebarItem,
} from "macalicious/catalyst-chrome";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useState } from "react";

/** An app-icon shaped tile drawn for this example; any 18.5 pt image works. */
function Tile({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 37 37" width="18.5" height="18.5" aria-hidden="true" focusable="false">
      <rect width="37" height="37" rx="8" fill={color} />
      <path
        d="M11 12h15M11 18.500h15M11 25h9"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const GROUPS = [
  { title: "Reader", items: ["Today", "Saved Stories", "History"], color: "#e0445c" },
  { title: "Following", items: ["Top Stories", "Science"], color: "#6a5acd" },
];

/**
 * A news reader in the layout of a Catalyst app: back and sidebar buttons, the centred title,
 * share and search, a sidebar of two groups and the content. Selecting a row changes the
 * content; the sidebar button hides the sidebar.
 */
export default function Reader() {
  const [shown, setShown] = useState("Today");
  const [sidebar, setSidebar] = useState(true);
  return (
    <Window width={640} height={320}>
      <CatalystChrome
        title="Reader"
        controls={<WindowControls />}
        toolbar={
          <Toolbar aria-label="Reader toolbar">
            <ToolbarButton aria-label="Back" disabled style={{ width: 39 }}>
              <Glyph d="M10 1.500 4.500 7l5.500 5.500" />
            </ToolbarButton>
            <ToolbarButton
              aria-label={sidebar ? "Hide Sidebar" : "Show Sidebar"}
              style={{ width: 39 }}
              onClick={() => setSidebar(!sidebar)}
            >
              <Glyph d="M1.500 1.500h13v11h-13zM6 1.500v11M3 4h1.500M3 6h1.500" />
            </ToolbarButton>
            <ToolbarSpace />
            <ToolbarButton aria-label="Share" style={{ width: 39 }}>
              <Glyph d="M5.500 5h-2v8h9V5h-2M8 8.500v-8m-2.500 2.500L8 .500 10.500 3" />
            </ToolbarButton>
            <ToolbarSearchField style={{ width: 161 }} />
          </Toolbar>
        }
        sidebar={
          sidebar ? (
            <CatalystSidebar aria-label="Channels">
              {GROUPS.map((group) => (
                <CatalystSidebarGroup key={group.title} title={group.title}>
                  {group.items.map((item) => (
                    <CatalystSidebarItem
                      key={item}
                      icon={<Tile color={group.color} />}
                      selected={item === shown}
                      onClick={() => setShown(item)}
                    >
                      {item}
                    </CatalystSidebarItem>
                  ))}
                </CatalystSidebarGroup>
              ))}
            </CatalystSidebar>
          ) : null
        }
      >
        <div style={{ padding: "20px 24px" }}>
          <h2 style={{ margin: 0, font: "var(--mac-catalyst-chrome-font-large-title)" }}>
            {shown}
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              color: "var(--mac-color-label-secondary)",
              font: "var(--mac-catalyst-chrome-font-body)",
            }}
          >
            Content type is the iOS text styles at 77%.
          </p>
        </div>
      </CatalystChrome>
    </Window>
  );
}
