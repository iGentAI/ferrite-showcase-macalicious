import { ColumnView, type ColumnViewItem } from "macalicious/column-view";
import { SavePanel } from "macalicious/save-panel";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { type CSSProperties, useState } from "react";

// Stand-in icons, drawn here: a folder and a document.
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

const folders: Record<string, ColumnViewItem[]> = {
  documents: [
    { id: "letters", label: "Letters", icon: folder, hasChildren: true },
    { id: "notes", label: "Notes.rtf", icon: file },
  ],
  desktop: [{ id: "todo", label: "To Do.txt", icon: file }],
  letters: [{ id: "draft", label: "Draft.rtf", icon: file }],
};
const places = [
  { value: "documents", label: "Documents", icon: folder },
  { value: "desktop", label: "Desktop", icon: folder },
];

/**
 * The expanded form in a window of its own: the disclosure button beside the name shows and
 * hides the browser the Save panel shares with the Open panel.
 */
export default function Expanded() {
  const [place, setPlace] = useState("documents");
  const [result, setResult] = useState("Not saved yet.");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <Window role="dialog" width={600} style={{ maxWidth: "100%" }}>
        <TitleBar title="Save" />
        <WindowBody style={{ padding: 20 }}>
          <SavePanel
            aria-label="Save the document"
            defaultName="Letter.rtf"
            defaultExpanded
            locations={places}
            location={place}
            onLocationChange={setPlace}
            onNewFolder={() => setResult("New Folder asked for.")}
            onCancel={() => setResult("Cancelled.")}
            onSave={({ name, location }) => setResult(`Saved ${name} in ${location}.`)}
            style={{ "--mac-save-panel-browser-height": "220px" } as CSSProperties}
            browser={{
              sidebarWidth: 130,
              sidebar: (
                <Sidebar
                  aria-label="Places"
                  material="opaque"
                  value={place}
                  onValueChange={setPlace}
                  style={{ height: "100%" }}
                >
                  <SidebarSection title="Favorites">
                    <SidebarItem value="documents" label="Documents" />
                    <SidebarItem value="desktop" label="Desktop" />
                  </SidebarSection>
                </Sidebar>
              ),
              children: (
                // A new place starts a new browser: the path of the old one means nothing in it.
                <ColumnView
                  key={place}
                  aria-label="Files"
                  getChildren={(id) => folders[id ?? place]}
                  columnWidth={150}
                />
              ),
            }}
          />
        </WindowBody>
      </Window>
      <output style={{ font: "var(--mac-font-body)", color: "var(--mac-color-label-secondary)" }}>
        {result}
      </output>
    </div>
  );
}
