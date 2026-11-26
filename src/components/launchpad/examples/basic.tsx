import { Launchpad, LaunchpadItem } from "macalicious/launchpad";
import { PushButton } from "macalicious/push-button";
import { type CSSProperties, useState } from "react";

const APPS = [
  { name: "Notes", color: "yellow" },
  { name: "Reminders", color: "orange" },
  { name: "Calendar", color: "red" },
  { name: "Contacts", color: "brown" },
  { name: "Maps", color: "green" },
  { name: "Photos", color: "pink" },
  { name: "Music", color: "purple" },
  { name: "Books", color: "teal" },
];

// The desktop Launchpad covers: a positioned element with something to blur.
const desktop = {
  position: "relative",
  width: "100%",
  height: 360,
  padding: 20,
  boxSizing: "border-box",
  overflow: "hidden",
  background:
    "linear-gradient(160deg, var(--mac-color-system-teal), var(--mac-color-system-indigo))",
  "--mac-launchpad-inset-bottom": "0px",
} as CSSProperties;

/** A stand-in app icon: a rounded square in a system colour. Use your own artwork. */
function Icon({ color }: { color: string }) {
  return (
    <span
      style={{
        width: "86%",
        height: "86%",
        borderRadius: "22%",
        background: `var(--mac-color-system-${color})`,
      }}
    />
  );
}

export default function Basic() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [launched, setLaunched] = useState("Nothing launched yet.");

  return (
    <div ref={setElement} style={desktop}>
      <PushButton onClick={() => setOpen(true)}>Show Launchpad</PushButton>
      <p style={{ color: "white" }}>{launched}</p>
      <Launchpad open={open} onOpenChange={setOpen} container={element} columns={4} rows={2}>
        {APPS.map((app) => (
          <LaunchpadItem
            key={app.name}
            label={app.name}
            onClick={() => setLaunched(`Launched ${app.name}.`)}
          >
            <Icon color={app.color} />
          </LaunchpadItem>
        ))}
      </Launchpad>
    </div>
  );
}
