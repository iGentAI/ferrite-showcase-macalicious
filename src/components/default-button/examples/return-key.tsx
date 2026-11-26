import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

/**
 * Return in the text field activates the default button, because both are inside the same
 * dialog, and Escape activates Cancel, which has the Escape key equivalent. Return on the
 * Cancel button activates Cancel, as it does in AppKit with full keyboard access.
 */
export default function ReturnKey() {
  const [result, setResult] = useState("Type a folder and press Return or Escape.");
  return (
    <div
      role="dialog"
      aria-label="Go to the folder"
      style={{ display: "grid", gap: 12, width: 300, font: "var(--mac-font-body)" }}
    >
      <label style={{ display: "grid", gap: 6 }}>
        Go to the folder:
        <input defaultValue="/Library" />
      </label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <PushButton keyEquivalent="escape" onClick={() => setResult("Cancelled.")}>
          Cancel
        </PushButton>
        <DefaultButton onClick={() => setResult("Went to the folder.")}>Go</DefaultButton>
      </div>
      <output style={{ color: "var(--mac-color-label-secondary)" }}>{result}</output>
    </div>
  );
}
