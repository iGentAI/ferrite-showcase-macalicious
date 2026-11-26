import { SmartListTile, SmartListTileGrid } from "macalicious/smart-list-tile";
import { useState } from "react";

/** A stand-in glyph on the disc's 24 pt grid: a clock face. Not Apple's artwork. */
function Clock() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="5.75" />
        <path d="M12 8.5V12h2.75" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

const LISTS = [
  { id: "today", name: "Today", count: 2, tint: undefined },
  { id: "scheduled", name: "Scheduled", count: 5, tint: "var(--mac-color-system-orange)" },
] as const;

/** Two smart lists; the one that is shown takes its colour. */
export default function Basic() {
  const [shown, setShown] = useState<string>("today");
  return (
    <SmartListTileGrid aria-label="Smart Lists" style={{ width: 248 }}>
      {LISTS.map((list) => (
        <SmartListTile
          key={list.id}
          icon={<Clock />}
          count={list.count}
          tint={list.tint}
          pressed={shown === list.id}
          onPressedChange={(pressed) => {
            if (pressed) setShown(list.id);
          }}
        >
          {list.name}
        </SmartListTile>
      ))}
    </SmartListTileGrid>
  );
}
