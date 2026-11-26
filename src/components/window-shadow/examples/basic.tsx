import { WindowShadow } from "macalicious/window-shadow";

export default function Basic() {
  return (
    <div style={{ padding: "24px 48px 64px" }}>
      <WindowShadow
        style={{
          width: 240,
          height: 120,
          display: "grid",
          placeItems: "center",
          background: "var(--mac-color-window-background)",
        }}
      >
        A floating surface
      </WindowShadow>
    </div>
  );
}
