import { AppSwitcher, AppSwitcherItem } from "macalicious/app-switcher";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

/** A neutral tile where an application's icon goes. */
function Tile({ color }: { color: string }) {
  return <div style={{ scale: "0.84", borderRadius: 28, background: color }} />;
}

export default function Basic() {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("notes");
  return (
    // A stand-in for the screen: the switcher is centred in it and blurs what is behind.
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 260,
        padding: 20,
        boxSizing: "border-box",
        background: "linear-gradient(135deg, #8fb8d8, #f1d3b0)",
        font: "var(--mac-font-body)",
      }}
    >
      <PushButton onClick={() => setOpen(true)}>Switch Application</PushButton>
      <p style={{ color: "#1d1d1f" }}>In front: {front}</p>
      <AppSwitcher open={open} onOpenChange={setOpen} onChoose={setFront}>
        <AppSwitcherItem value="notes" icon={<Tile color="#e9c46a" />}>
          Notes
        </AppSwitcherItem>
        <AppSwitcherItem value="mail" icon={<Tile color="#4a90d9" />}>
          Mail
        </AppSwitcherItem>
        <AppSwitcherItem value="terminal" icon={<Tile color="#3a3a3c" />}>
          Terminal
        </AppSwitcherItem>
      </AppSwitcher>
    </div>
  );
}
