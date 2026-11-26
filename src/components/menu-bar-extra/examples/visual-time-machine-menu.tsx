import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuBarExtraMenu, MenuBarExtras } from "macalicious/menu-bar-extra";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { useState } from "react";

/**
 * The desktop picture behind this corner of the screen as a grid of the colours of the
 * Desktop screenshots: one row of five colours, left to right, for the bar (the row just
 * under it) and for each band of the crop below, in Aqua and in Dark Aqua. A stand-in for the
 * picture, which is Apple's and is not shipped.
 */
const tops = [0, 23, 45, 67, 89, 111, 133, 154];
const light = [
  "6396c0 6797c2 6e9dc4 7da5c6 99b2ca",
  "689cc7 6c9ec9 71a2cb 86acce 9fb9d2",
  "8fbbe4 a7c7e7 b6cfea b7d0eb b0cdea",
  "9dc3e8 90bee6 9ec5ea 9dc6eb 95c3ea",
  "90bfe7 8fbee8 92c1e9 96c4eb 9cc8ec",
  "8abee8 96c3ea adceec a7cded a5cced",
  "93c2ea a3caec 9dc9ec 97c6ec 9ac9ee",
];
const dark = [
  "052246 042145 032043 031e41 031c3f",
  "052247 042145 032043 031e41 031c3f",
  "072449 062348 052246 032044 032043",
  "08284d 08264b 072449 052247 032043",
  "0b2b51 09294f 07274d 07244a 042146",
  "0f2f56 0d2d53 0a2a50 08274d 062449",
  "13345c 103159 0c2d54 0a2a50 07274d",
];
// One element for each band: a single background of all of them is more than the test
// environment's CSS parser takes.
const picture = light.map((row, band) => {
  const night = (dark[band] as string).split(" ");
  const stops = row
    .split(" ")
    .map((day, column) => `light-dark(#${day}, #${night[column]}) ${column * 25}%`);
  const top = tops[band] as number;
  const height = (tops[band + 1] as number) - top;
  const background = `linear-gradient(to right, ${stops})`;
  return (
    <div key={top} style={{ position: "absolute", insetInline: 0, top, height, background }} />
  );
});

const cell = (width: number, testid?: string) =>
  ({ "data-testid": testid, style: { width, justifyContent: "center", padding: 0 } }) as object;

/**
 * The Time Machine status menu of the Time-Machine-Menu screenshots: a 544 x 308 px crop from
 * 10 px left of the open extra (x 2508 in Aqua, 2524 in Dark Aqua, where the clock is wider).
 * The 40 pt cell starts at x 5; its 262 pt menu hangs under it, aligned with its leading edge.
 * The images are stand-ins of the size of Apple's, and the neighbouring cells are empty. The
 * comparison clicks the cell and hovers "Enter Time Machine".
 */
export default function VisualTimeMachineMenu() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const popup = { container: stage, collisionPadding: 0 };
  const empty = (label: string, width: number) => (
    <MenuBarExtraMenu title="" aria-label={label} titleProps={cell(width)} popup={popup}>
      <MenuItem>{label}</MenuItem>
    </MenuBarExtraMenu>
  );
  return (
    <div ref={setStage} style={{ position: "relative", width: 272, height: 154 }}>
      {picture}
      {/* The bar is cut to the crop here, so that the stage does not confine the menu. */}
      <div style={{ position: "absolute", inset: "0 0 auto", height: 23, overflow: "hidden" }}>
        <MenuBar
          style={{ position: "absolute", insetInlineStart: -326, width: 640 }}
          extras={
            <MenuBarExtras>
              <MenuBarExtraMenu
                aria-label="Time Machine"
                titleProps={cell(40, "time-machine")}
                popup={{ ...popup, style: { width: 262 } }}
                title={
                  <svg
                    width="18.5"
                    height="16"
                    viewBox="0 0 18.5 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="9.25" cy="8" r="7" stroke="currentColor" />
                    <path d="M9.25 4v4l3 2" stroke="currentColor" />
                  </svg>
                }
              >
                <MenuItem disabled>Latest Backup to “Time Machine”:</MenuItem>
                <MenuItem disabled>Today, 3:34 PM</MenuItem>
                <MenuSeparator />
                <MenuItem>Back Up Now</MenuItem>
                <MenuItem data-testid="enter">Enter Time Machine</MenuItem>
                <MenuSeparator />
                <MenuItem>Open Time Machine Preferences…</MenuItem>
              </MenuBarExtraMenu>
              {empty("Wi-Fi", 29)}
              {empty("AirPlay", 33)}
              {empty("Battery", 36)}
              {empty("Clock", 107)}
              {empty("User", 64)}
            </MenuBarExtras>
          }
        >
          <MenuBarMenu title="Finder" application popup={popup}>
            <MenuItem>About Finder</MenuItem>
          </MenuBarMenu>
        </MenuBar>
      </div>
    </div>
  );
}
