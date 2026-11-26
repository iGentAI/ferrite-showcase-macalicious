import { ColumnView, type ColumnViewItem } from "macalicious/column-view";
import { OpenPanel } from "macalicious/open-panel";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { useState } from "react";

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

// The files the panel shows come from the application: here, two folders held in memory.
const folders: Record<string, ColumnViewItem[]> = {
  documents: [
    { id: "letters", label: "Letters", icon: folder, hasChildren: true },
    { id: "notes", label: "Notes.rtf", icon: file },
    { id: "budget", label: "Budget.rtf", icon: file },
  ],
  desktop: [{ id: "todo", label: "To Do.txt", icon: file }],
  letters: [{ id: "draft", label: "Draft.rtf", icon: file }],
};

/** Choose a file and press Return, or press Escape to cancel. */
export default function Basic() {
  const [place, setPlace] = useState("documents");
  const [path, setPath] = useState<(string | number)[]>([]);
  const [result, setResult] = useState("Nothing opened yet.");
  const selected = path.at(-1);
  const isFile = selected !== undefined && !(selected in folders);
  const go = (next: string) => {
    setPlace(next);
    setPath([]);
  };
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <OpenPanel
        width={560}
        height={320}
        style={{ maxWidth: "100%" }}
        locations={[
          { value: "documents", label: "Documents", icon: folder },
          { value: "desktop", label: "Desktop", icon: folder },
        ]}
        location={place}
        onLocationChange={go}
        openDisabled={!isFile}
        onOpen={() => setResult(`Opened ${selected}.`)}
        onCancel={() => setResult("Cancelled.")}
        sidebarWidth={130}
        sidebar={
          <Sidebar
            aria-label="Places"
            material="opaque"
            value={place}
            onValueChange={go}
            style={{ height: "100%" }}
          >
            <SidebarSection title="Favorites">
              <SidebarItem value="documents" label="Documents" />
              <SidebarItem value="desktop" label="Desktop" />
            </SidebarSection>
          </Sidebar>
        }
      >
        <ColumnView
          aria-label="Files"
          getChildren={(id) => folders[id ?? place]}
          path={path}
          onPathChange={setPath}
          columnWidth={150}
        />
      </OpenPanel>
      <output style={{ font: "var(--mac-font-body)", color: "var(--mac-color-label-secondary)" }}>
        {result}
      </output>
    </div>
  );
}
