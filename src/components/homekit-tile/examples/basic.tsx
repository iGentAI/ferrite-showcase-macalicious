import { HomekitTile, HomekitTileGrid } from "macalicious/homekit-tile";
import { type ReactNode, useState } from "react";

function Bulb() {
  return (
    <svg
      viewBox="0 0 17 24"
      width="17"
      height="24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8.5 0a8.5 8.5 0 0 0-5 15.4c.9.7 1.5 1.6 1.5 2.6h7c0-1 .6-1.9 1.5-2.6A8.5 8.5 0 0 0 8.5 0z" />
      <path d="M5.2 19.5h6.6v1.4H5.2zm.6 2.4h5.4L10 24H7z" opacity="0.55" />
    </svg>
  );
}

function Outlet() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fillRule="evenodd"
        d="M2 0h20a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm6.5 8v8h2V8zm5 0v8h2V8z"
      />
    </svg>
  );
}

/** An accessory that keeps its own state, and writes it on the tile's last line. */
function Accessory(props: { room: string; name: string; icon: ReactNode; on?: boolean }) {
  const [on, setOn] = useState(props.on ?? false);
  return (
    <HomekitTile
      room={props.room}
      name={props.name}
      status={on ? "On" : "Off"}
      icon={props.icon}
      active={on}
      onActiveChange={setOn}
    />
  );
}

export default function Basic() {
  return (
    <div style={{ padding: 16, background: "linear-gradient(135deg, #014a5e, #017a97)" }}>
      <HomekitTileGrid aria-label="Favorite Accessories">
        <Accessory room="Front" name="Light" icon={<Bulb />} />
        <Accessory room="Front" name="Turtle" icon={<Outlet />} />
        <Accessory room="Master" name="Corner Light" icon={<Bulb />} on />
      </HomekitTileGrid>
    </div>
  );
}
