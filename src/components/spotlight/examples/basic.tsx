import { Spotlight, SpotlightGroup, SpotlightResult } from "macalicious/spotlight";
import { useState } from "react";

const groups = [
  { label: "Definition", results: ["macOS"] },
  { label: "Folders", results: ["OS X", "OS X Installers"] },
  { label: "Documents", results: ["catalina.md", "page.txt", "OS X calendars.txt"] },
];

/** A sheet of paper, standing in for a document's icon. */
const page = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M3.5 1.5h6l3 3v10h-9z" fill="#ffffff" stroke="#9a9a9a" />
  </svg>
);

/**
 * The Spotlight window with results in three categories. The application does the searching:
 * here the results are fixed and the preview names the selected one.
 */
export default function Basic() {
  const [selected, setSelected] = useState<string | null>("macOS");
  return (
    <div style={{ padding: 24, background: "light-dark(#8f8a7c, #1c2733)" }}>
      <Spotlight
        defaultValue="OS X"
        completion="macOS"
        selectedValue={selected}
        onSelectedValueChange={setSelected}
        preview={<p style={{ margin: 0, padding: "32px 36px", fontSize: 24 }}>{selected}</p>}
        style={{ "--mac-spotlight-body-height": "236px" } as React.CSSProperties}
      >
        {groups.map((group) => (
          <SpotlightGroup key={group.label} label={group.label}>
            {group.results.map((result) => (
              <SpotlightResult key={result} value={result} icon={page}>
                {result}
              </SpotlightResult>
            ))}
          </SpotlightGroup>
        ))}
      </Spotlight>
    </div>
  );
}
