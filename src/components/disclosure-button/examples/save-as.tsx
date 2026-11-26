import { DisclosureButton } from "macalicious/disclosure-button";
import { useId, useState } from "react";

/**
 * The arrangement of a Save dialog: the button sits 8 pt to the right of the field it belongs
 * to and expands the view below. The field is a plain input here.
 */
export default function SaveAs() {
  const [expanded, setExpanded] = useState(false);
  const details = useId();
  return (
    <div style={{ display: "grid", gap: 12, width: 300, font: "var(--mac-font-body)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label htmlFor={`${details}-name`}>Save As:</label>
        <input id={`${details}-name`} defaultValue="Untitled" style={{ flex: 1, minWidth: 0 }} />
        <DisclosureButton
          expanded={expanded}
          onExpandedChange={setExpanded}
          aria-controls={details}
          aria-label="Show the file browser"
        />
      </div>
      <div id={details} hidden={!expanded} style={{ color: "var(--mac-color-label-secondary)" }}>
        The file browser appears here.
      </div>
    </div>
  );
}
