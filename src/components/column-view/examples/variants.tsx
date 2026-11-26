import { ColumnView, type ColumnViewItem } from "macalicious/column-view";
import type { ReactNode } from "react";

const folders: Record<string, ColumnViewItem[]> = {
  root: [
    { id: "desktop", label: "Desktop", hasChildren: true },
    { id: "documents", label: "Documents", hasChildren: true },
    { id: "downloads", label: "Downloads", hasChildren: true },
  ],
  documents: [
    { id: "invoices", label: "Invoices", hasChildren: true },
    { id: "letters", label: "Letters", hasChildren: true },
  ],
  letters: [{ id: "draft", label: "Draft" }],
};
const getChildren = (id: string | number | null) => folders[id ?? "root"];

function Case({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={{ font: "var(--mac-font-control-small)", color: "var(--mac-color-label)" }}>
        {title}
      </span>
      {children}
    </div>
  );
}

const size = { width: 330, maxWidth: "100%", height: 80 };

/**
 * The selection in the column that holds the keyboard, in the columns before it, and in a
 * window that is not key. `data-force` pins the focused look here; an application never sets it.
 */
export default function Variants() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Case title="Keyboard in the second column: accent there, grey in the first">
        <ColumnView
          aria-label="Focused"
          data-force="focus"
          getChildren={getChildren}
          defaultPath={["documents", "letters"]}
          columnWidth={110}
          style={size}
        />
      </Case>
      <Case title="Keyboard elsewhere: every selection grey">
        <ColumnView
          aria-label="Not focused"
          getChildren={getChildren}
          defaultPath={["documents", "letters"]}
          columnWidth={110}
          style={size}
        />
      </Case>
      <Case title="Window that is not key">
        <div data-window-state="inactive">
          <ColumnView
            aria-label="Inactive window"
            data-force="focus"
            getChildren={getChildren}
            defaultPath={["documents", "letters"]}
            columnWidth={110}
            style={size}
          />
        </div>
      </Case>
    </div>
  );
}
