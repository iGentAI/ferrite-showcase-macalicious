"use client";

import { SectionHeader, SectionHeaderAction } from "macalicious/section-header";
import { useState } from "react";

const files = ["Aqua and Bondi.pdf", "OS X Mavericks.png", "OS X Yosemite.png", "OS X Lion.png"];

/**
 * Both variants in a grouped list: the first header pinned as a band, the next one plain, with
 * an action that shows or hides the rest of its group.
 */
export default function Variants() {
  const [all, setAll] = useState(false);
  const shown = all ? files : files.slice(0, 2);
  return (
    <div
      style={{
        width: 420,
        background: "var(--mac-color-control-background)",
        font: "var(--mac-font-body)",
        color: "var(--mac-color-label)",
      }}
    >
      <SectionHeader variant="pinned" titleId="section-header-folders">
        Folders
      </SectionHeader>
      <ul
        aria-labelledby="section-header-folders"
        style={{ margin: 0, padding: "8px 12px 12px", listStyle: "none" }}
      >
        <li>OS X</li>
      </ul>
      <SectionHeader
        titleId="section-header-documents"
        accessory={
          <SectionHeaderAction aria-expanded={all} onClick={() => setAll((value) => !value)}>
            {all ? "Show Less" : `Show All (${files.length})`}
          </SectionHeaderAction>
        }
      >
        Documents
      </SectionHeader>
      <ul
        aria-labelledby="section-header-documents"
        style={{ margin: 0, padding: "8px 12px 12px", listStyle: "none" }}
      >
        {shown.map((file) => (
          <li key={file}>{file}</li>
        ))}
      </ul>
    </div>
  );
}
