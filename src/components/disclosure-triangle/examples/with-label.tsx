import { DisclosureTriangle } from "macalicious/disclosure-triangle";
import { useId, useState } from "react";

/** A labelled triangle in a dialog: the label is part of the click target and names it. */
export default function WithLabel() {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div style={{ display: "grid", gap: 6, width: 260, font: "var(--mac-font-body)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <DisclosureTriangle
          expanded={expanded}
          onExpandedChange={setExpanded}
          aria-controls={`${id}-options`}
          aria-labelledby={`${id}-label`}
        />
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the label repeats the triangle's click for the pointer; the triangle is the control */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users use the triangle itself */}
        <span id={`${id}-label`} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide advanced options" : "Show advanced options"}
        </span>
      </div>
      <div
        id={`${id}-options`}
        hidden={!expanded}
        style={{ paddingLeft: 17, color: "var(--mac-color-label-secondary)" }}
      >
        The advanced options appear here.
      </div>
    </div>
  );
}
