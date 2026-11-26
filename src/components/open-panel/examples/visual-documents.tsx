import { ColumnView, type ColumnViewItem, ColumnViewPanel } from "macalicious/column-view";
import { OpenPanel } from "macalicious/open-panel";
import { PushButton } from "macalicious/push-button";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { TagDot } from "macalicious/tag-dot";
import type { CSSProperties } from "react";

/** Stand-in glyphs drawn for this example: outlines in the row's tint, not Apple's icons. */
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

const tray = "M2 10l2-7h10l2 7v5H2zM2 10h4l1 2h4l1-2h4";
const letter = "M4 15L9 3l5 12M2 11h14";
const screen = "M2 3h14v10H2zM6 16h6";
const page = "M4 2h7l3 3v11H4zM11 2v3h3";
const arrow = "M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15zM9 5v7M6 9.5l3 3l3-3";
const cloud = "M5 14a3.5 3.5 0 0 1 0-7a4.5 4.5 0 0 1 8.5 1a3 3 0 0 1-.5 6z";
const drive = "M4 2h10l1 9v4H3v-4zM3 11h12";
const globe =
  "M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15zM1.5 9h15M9 1.5c-5 5-5 10 0 15c5-5 5-10 0-15";

const folder = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M1 3h5l1.5 1.5H15V13H1z" fill="currentColor" opacity="0.5" />
  </svg>
);
const file = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M3.5 1.5h6l3 3v10h-9z" fill="none" stroke="currentColor" opacity="0.6" />
  </svg>
);

const files: ColumnViewItem[] = [
  { id: "512", label: "512 Pixels", icon: file },
  { id: "aqua", label: "Aqua and Bondi.pdf", icon: file },
  { id: "review", label: "Aqua_and_Bo…review.ibooks", icon: file },
  { id: "stacks", label: "For Desktop Stacks", icon: folder, hasChildren: true },
  { id: "guide", label: "iPhone Field Guide.ibooks", icon: file },
];
const getChildren = (id: string | number | null) => (id === null ? files : null);

const secondary: CSSProperties = {
  font: "var(--mac-font-control-small)",
  color: "var(--mac-color-label-secondary)",
};
const row: CSSProperties = {
  ...secondary,
  display: "flex",
  justifyContent: "space-between",
  height: 20,
  alignItems: "center",
};

/** The preview column, as Finder draws it: the application's content, not the panel's. */
function Preview({ item }: { item: ColumnViewItem }) {
  return (
    <ColumnViewPanel style={{ alignItems: "stretch", padding: "20px 20px 0" }}>
      <div
        style={{
          boxSizing: "border-box",
          height: 254,
          padding: "4px 7px",
          border: "1px solid var(--mac-color-separator)",
          background: "var(--mac-color-control-background)",
          color: "var(--mac-color-label)",
          font: "12px Helvetica, Arial, sans-serif",
          textAlign: "start",
        }}
      >
        Here’s to the crazy ones...
      </div>
      <strong style={{ marginTop: 26, font: "700 17px/22px var(--mac-font-family-system)" }}>
        {item.label}
      </strong>
      <span style={secondary}>Rich Text Document - 264 bytes</span>
      <strong style={{ marginTop: 16 }}>Information</strong>
      <div style={row}>
        <span>Created</span>
        <span>Tuesday, May 15, 2018 at 3:55 PM</span>
      </div>
      <div style={row}>
        <span>Modified</span>
        <span>Monday, May 28, 2018 at 3:12 PM</span>
      </div>
      <div style={row}>
        <span>Last opened</span>
        <span>Today, 10:51 AM</span>
      </div>
    </ColumnViewPanel>
  );
}

/**
 * Visual comparison target: TextEdit's Open panel on the Documents folder, 914 x 615 pt, with
 * a file selected. Reference crop (2x pixels) of the whole panel: x=112 y=76 w=1828 h=1230 in
 * 10-15-Catalina-Light-Finder-Open.png and 10-15-Catalina-Dark-Finder-Open.png.
 *
 * The comparisons take regions of it: the toolbar (the top 43 pt), the bottom bar (the last
 * 42 pt), and the header band with the start of the file column. Glyphs and icons are
 * stand-ins and text is set in the fallback font off Apple platforms; both are masked in the
 * drawing comparisons. `dark` adds the "Macintosh HD" row that the Dark Aqua capture has.
 */
export default function VisualDocuments({ dark = false }) {
  return (
    <div style={{ position: "relative", width: 914, height: 615 }}>
      <OpenPanel
        width={914}
        height={615}
        style={{ position: "absolute", inset: 0 }}
        locations={[{ value: "documents", label: "Documents", icon: folder }]}
        location="documents"
        canGoBack
        onNewFolder={() => {}}
        header="Shared Folder"
        leading={
          <>
            <PushButton style={{ width: 121 }}>New Document</PushButton>
            <PushButton style={{ width: 84 }}>Options</PushButton>
          </>
        }
        sidebar={
          <Sidebar
            aria-label="Places"
            value="documents"
            material="opaque"
            style={{ height: "100%" }}
          >
            <SidebarSection title="Favorites">
              <SidebarItem value="recents" label="Recents" icon={<Glyph d={tray} />} />
              <SidebarItem value="applications" label="Applications" icon={<Glyph d={letter} />} />
              <SidebarItem value="desktop" label="Desktop" icon={<Glyph d={screen} />} />
              <SidebarItem value="documents" label="Documents" icon={<Glyph d={page} />} />
              <SidebarItem value="downloads" label="Downloads" icon={<Glyph d={arrow} />} />
            </SidebarSection>
            <SidebarSection title="iCloud">
              <SidebarItem value="textedit" label="TextEdit" icon={<Glyph d={letter} />} />
              <SidebarItem value="icloud" label="iCloud Drive" icon={<Glyph d={cloud} />} />
            </SidebarSection>
            <SidebarSection title="Locations">
              {dark ? (
                <SidebarItem value="hd" label="Macintosh HD" icon={<Glyph d={drive} />} />
              ) : null}
              <SidebarItem value="backup" label="Time Machine" icon={<Glyph d={drive} />} />
              <SidebarItem value="computer" label="ismhpro" icon={<Glyph d={screen} />} />
              <SidebarItem value="network" label="Network" icon={<Glyph d={globe} />} />
            </SidebarSection>
            <SidebarSection title="Tags">
              <SidebarItem value="blue" label="Blue" icon={<TagDot color="blue" />} />
              <SidebarItem value="work" label="Work" icon={<TagDot />} />
              <SidebarItem value="orange" label="Orange" icon={<TagDot color="orange" />} />
              <SidebarItem value="gray" label="Gray" icon={<TagDot color="gray" />} />
              <SidebarItem value="green" label="Green" icon={<TagDot color="green" />} />
              <SidebarItem value="home" label="Home" icon={<TagDot />} />
            </SidebarSection>
          </Sidebar>
        }
      >
        <ColumnView
          aria-label="Documents"
          data-force="focus"
          getChildren={getChildren}
          defaultPath={["512"]}
          defaultColumnWidths={[204, 540]}
          renderPreview={(item) => <Preview item={item} />}
        />
      </OpenPanel>
      <div data-visual="toolbar" style={{ position: "absolute", inset: "0 0 auto", height: 43 }} />
      <div data-visual="bar" style={{ position: "absolute", inset: "auto 0 0", height: 42 }} />
      <div
        data-visual="browser"
        style={{ position: "absolute", top: 43, left: 0, width: 361, height: 68 }}
      />
    </div>
  );
}
