import { Desktop } from "macalicious/desktop";
import { DesktopIcon } from "macalicious/desktop-icon";
import { useState } from "react";

const FILES = ["Budget.numbers", "Holiday.jpg", "Letter.rtf", "Notes.txt", "Plan.pdf", "Song.m4a"];

function Page() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <path d="M14 4h26l10 10v46H14z" fill="#ffffff" stroke="#a0a4aa" />
      <path d="M22 26h20M22 34h20M22 42h14" stroke="#c2c6cc" strokeWidth="2" />
    </svg>
  );
}

/**
 * A controlled selection, a picture of your own and room left for a menu bar. Click an icon,
 * Command-click to add one, use the arrow keys or type a name; double-click or Return opens.
 */
export default function Selection() {
  const [selected, setSelected] = useState<readonly string[]>(["Holiday.jpg"]);
  const [opened, setOpened] = useState("nothing yet");
  return (
    <Desktop
      value={selected}
      onValueChange={setSelected}
      picture={<div style={{ background: "linear-gradient(160deg, #5b7c99, #24364b)" }} />}
      style={{ height: 300, "--mac-desktop-inset-top": "22px" } as React.CSSProperties}
    >
      {FILES.map((name) => (
        <DesktopIcon key={name} icon={<Page />} onOpen={() => setOpened(name)}>
          {name}
        </DesktopIcon>
      ))}
      <output style={{ position: "absolute", left: 12, bottom: 8, color: "white" }}>
        Selected: {selected.join(", ") || "none"}. Opened: {opened}.
      </output>
    </Desktop>
  );
}
