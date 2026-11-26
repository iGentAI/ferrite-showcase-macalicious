import { SmartListTile, SmartListTileGrid } from "macalicious/smart-list-tile";

/** A stand-in glyph on the disc's 24 pt grid: a flag on its pole. Not Apple's artwork. */
function Flag() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <rect x="7.5" y="6" width="1.5" height="12" rx="0.75" />
        <path d="M9.75 6.75h7.1c.35 0 .53.42.29.67L15.4 9.6l1.74 2.18c.24.25.06.67-.29.67h-7.1Z" />
      </g>
    </svg>
  );
}

/**
 * A tile at rest, the tile whose list is shown, a pressed tile, a tile with keyboard focus, a
 * name too long for its line, and a disabled tile.
 */
export default function States() {
  return (
    <SmartListTileGrid aria-label="States" style={{ width: 248 }}>
      <SmartListTile icon={<Flag />} count={3} tint="var(--mac-color-system-red)">
        At rest
      </SmartListTile>
      <SmartListTile icon={<Flag />} count={3} tint="var(--mac-color-system-red)" defaultPressed>
        Shown
      </SmartListTile>
      <SmartListTile
        icon={<Flag />}
        count={3}
        tint="var(--mac-color-system-red)"
        data-force="pressed"
      >
        Pressed
      </SmartListTile>
      <SmartListTile
        icon={<Flag />}
        count={3}
        tint="var(--mac-color-system-red)"
        data-force="focus"
      >
        Focus
      </SmartListTile>
      <SmartListTile icon={<Flag />} count={128} tint="var(--mac-color-system-red)">
        A name too long for its line
      </SmartListTile>
      <SmartListTile icon={<Flag />} count={0} tint="var(--mac-color-system-red)" disabled>
        Disabled
      </SmartListTile>
    </SmartListTileGrid>
  );
}
