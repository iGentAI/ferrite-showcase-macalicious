import { ColumnView } from "macalicious/column-view";
import { SavePanel } from "macalicious/save-panel";
import type { CSSProperties } from "react";

// A stand-in folder icon, drawn here.
const folder = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M1 3h5l1.5 1.5H15V13H1z" fill="currentColor" opacity="0.5" />
  </svg>
);
const none = () => null;

/**
 * Visual comparison target: the browser of the expanded Save panel, which is the Open panel's.
 * No screenshot shows a Save panel, so its toolbar is compared with the toolbar of TextEdit's
 * Open panel at the same width, 914 pt (10-15-Catalina-Light-Finder-Open.png and
 * 10-15-Catalina-Dark-Finder-Open.png, crop x=112 y=76 w=1828 h=86): the panel has no margin
 * here, so the browser spans the 914 pt. The capture's first row and its corners belong to the
 * Open panel's window frame and are masked.
 */
export default function VisualExpanded() {
  return (
    <div
      style={
        {
          width: 914,
          padding: "20px 0",
          background: "var(--mac-color-window-background)",
          "--mac-save-panel-bleed": "0px",
          "--mac-save-panel-browser-height": "160px",
        } as CSSProperties
      }
    >
      <SavePanel
        defaultExpanded
        locations={[{ value: "documents", label: "Documents", icon: folder }]}
        location="documents"
        onNewFolder={() => {}}
        browser={{
          canGoBack: true,
          onNewFolder: () => {},
          children: <ColumnView aria-label="Documents" getChildren={none} />,
        }}
      />
    </div>
  );
}
