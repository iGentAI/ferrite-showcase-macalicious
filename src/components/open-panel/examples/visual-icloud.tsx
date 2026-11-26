import { ColumnView, type ColumnViewItem } from "macalicious/column-view";
import { OpenPanel } from "macalicious/open-panel";
import { PushButton } from "macalicious/push-button";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";

// Stand-in icons, drawn here; not Apple's.
const cloud = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      d="M4.5 12a3 3 0 0 1 0-6 4 4 0 0 1 7.5 1 2.5 2.5 0 0 1-.5 5z"
      fill="currentColor"
      opacity="0.5"
    />
  </svg>
);
const folder = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M1 3h5l1.5 1.5H15V13H1z" fill="currentColor" opacity="0.5" />
  </svg>
);

const none: ColumnViewItem[] = [];
const one: ColumnViewItem[] = [
  { id: "textedit", label: "TextEdit", icon: folder, hasChildren: true },
];

/**
 * Visual comparison target: TextEdit's Open panel on iCloud Drive with nothing selected, so
 * the default button is disabled. The Aqua capture is smaller, 799 x 448 pt, and its folder is
 * empty (10-15-Catalina-Light-Finder-Open-iCloud.png, crop x=112 y=76 w=1598 h=896); the Dark
 * Aqua one is 914 x 615 pt and holds one folder (10-15-Catalina-Dark-Finder-Open-iCloud.png,
 * crop x=112 y=76 w=1828 h=1230), which `dark` selects.
 *
 * The comparisons take the toolbar (the top 43 pt), where the controls keep their sizes and
 * the location button stays centred, and the bottom bar (the last 42 pt).
 */
export default function VisualIcloud({ dark = false }) {
  const width = dark ? 914 : 799;
  const height = dark ? 615 : 448;
  return (
    <div style={{ position: "relative", width, height }}>
      <OpenPanel
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0 }}
        locations={[{ value: "icloud", label: "iCloud Drive", icon: cloud }]}
        location="icloud"
        canGoBack
        onNewFolder={() => {}}
        openDisabled
        leading={
          <>
            <PushButton style={{ width: 121 }}>New Document</PushButton>
            <PushButton style={{ width: 84 }}>Options</PushButton>
          </>
        }
        sidebar={
          <Sidebar aria-label="Places" value="icloud" material="opaque" style={{ height: "100%" }}>
            <SidebarSection title="Favorites">
              <SidebarItem value="recents" label="Recents" />
              <SidebarItem value="documents" label="Documents" />
            </SidebarSection>
            <SidebarSection title="iCloud">
              <SidebarItem value="textedit" label="TextEdit" />
              <SidebarItem value="icloud" label="iCloud Drive" />
            </SidebarSection>
          </Sidebar>
        }
      >
        <ColumnView
          aria-label="iCloud Drive"
          getChildren={(id) => (id === null ? (dark ? one : none) : null)}
          defaultColumnWidths={[204]}
        />
      </OpenPanel>
      <div data-visual="toolbar" style={{ position: "absolute", inset: "0 0 auto", height: 43 }} />
      <div data-visual="bar" style={{ position: "absolute", inset: "auto 0 0", height: 42 }} />
    </div>
  );
}
