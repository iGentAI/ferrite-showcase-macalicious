import { LaunchpadItem } from "macalicious/launchpad";
import { LaunchpadFolder } from "macalicious/launchpad-folder";
import { type CSSProperties, useState } from "react";

const APPS = [
  { name: "Terminal", color: "gray" },
  { name: "Console", color: "yellow" },
  { name: "Grapher", color: "green" },
  { name: "Screenshot", color: "blue" },
  { name: "Disk Utility", color: "red" },
];

// The desktop the open folder covers: a positioned element.
const desktop = {
  position: "relative",
  display: "grid",
  placeItems: "center",
  width: "100%",
  height: 380,
  overflow: "hidden",
  background:
    "linear-gradient(160deg, var(--mac-color-system-teal), var(--mac-color-system-indigo))",
} as CSSProperties;

/**
 * A folder on its own. Click the tile to open it; choosing an app, Escape or a click beside
 * the panel closes it. The icons are stand-ins: rounded squares in system colours.
 */
export default function Basic() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [launched, setLaunched] = useState("Nothing launched yet.");

  return (
    <div ref={setElement} style={desktop}>
      <div style={{ width: 112, color: "white", textAlign: "center" }}>
        <LaunchpadFolder label="Other" container={element} columns={3}>
          {APPS.map((app) => (
            <LaunchpadItem
              key={app.name}
              label={app.name}
              onClick={() => setLaunched(`Launched ${app.name}.`)}
            >
              <span
                style={{
                  width: "86%",
                  height: "86%",
                  borderRadius: "22%",
                  background: `var(--mac-color-system-${app.color})`,
                }}
              />
            </LaunchpadItem>
          ))}
        </LaunchpadFolder>
        <p>{launched}</p>
      </div>
    </div>
  );
}
