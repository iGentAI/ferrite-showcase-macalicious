import { HomekitTile, HomekitTileGrid } from "macalicious/homekit-tile";
import { type ReactNode, useState } from "react";

function Speaker() {
  return (
    <svg
      viewBox="0 0 19 24"
      width="19"
      height="24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 5.5C0 2 4 0 9.5 0S19 2 19 5.5v13C19 22 15 24 9.5 24S0 22 0 18.5z" />
    </svg>
  );
}

function Muted() {
  return (
    <svg viewBox="0 0 9 9" width="9" height="9" aria-hidden="true" focusable="false">
      <path
        d="M1.5 1.5l6 6M4.5 1v3.5M3 6.5h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A speaker that keeps its own state, and writes it on the tile's last line. */
function SpeakerTile(props: { room: string; name: string; playing?: boolean; badge?: ReactNode }) {
  const [playing, setPlaying] = useState(props.playing ?? false);
  return (
    <HomekitTile
      room={props.room}
      name={props.name}
      status={playing ? "Playing" : "Paused"}
      icon={<Speaker />}
      badge={props.badge}
      tint="#34aadc"
      active={playing}
      onActiveChange={setPlaying}
    />
  );
}

/**
 * An inactive and an active tile, a tile with a badge on its glyph, a name too long for its
 * line, and an accessory that does not respond.
 */
export default function States() {
  return (
    <div style={{ padding: 16, background: "linear-gradient(135deg, #014a5e, #017a97)" }}>
      <HomekitTileGrid aria-label="Speakers">
        <SpeakerTile room="Kitchen" name="HomePod" />
        <SpeakerTile room="Kitchen" name="Radio" playing />
        <SpeakerTile room="Studio" name="HomePod" badge={<Muted />} />
        <SpeakerTile room="Master" name="Bedroom HomePod" />
        <HomekitTile
          room="Garage"
          name="Speaker"
          status="No Response"
          icon={<Speaker />}
          disabled
        />
      </HomekitTileGrid>
    </div>
  );
}
