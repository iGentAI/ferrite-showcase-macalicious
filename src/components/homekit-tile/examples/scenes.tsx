import { HomekitTile, HomekitTileGrid } from "macalicious/homekit-tile";
import { useState } from "react";

function House() {
  return (
    <svg
      viewBox="0 0 20 18"
      width="20"
      height="18"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 0 0 8.4h2.6V18h14.8V8.4H20L16.6 5.5V1.6h-2.4v1.9z" />
    </svg>
  );
}

const SCENES = ["Good Morning", "Movie Time", "Good Night"];

/**
 * Scene tiles run a scene when clicked and do not toggle: the application marks the scene that
 * is in effect. Here the last scene that was run is the active one.
 */
export default function Scenes() {
  const [current, setCurrent] = useState("Movie Time");
  return (
    <div style={{ padding: 16, background: "linear-gradient(135deg, #014a5e, #017a97)" }}>
      <HomekitTileGrid aria-label="Favorite Scenes" style={{ maxWidth: 440 }}>
        {SCENES.map((scene) => (
          <HomekitTile
            key={scene}
            kind="scene"
            name={scene}
            icon={<House />}
            tint="#f7951f"
            active={current === scene}
            onClick={() => setCurrent(scene)}
          />
        ))}
      </HomekitTileGrid>
    </div>
  );
}
