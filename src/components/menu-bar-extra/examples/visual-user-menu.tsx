import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuBarExtraMenu, MenuBarExtras } from "macalicious/menu-bar-extra";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { type ReactNode, useState } from "react";

/**
 * The desktop picture behind this corner of the screen as a grid of the colours of the
 * Desktop screenshots: one row of five colours, left to right, for the bar (the row just
 * under it) and for each band of the crop below, in Aqua and in Dark Aqua. A stand-in for the
 * picture, which is Apple's and is not shipped.
 */
const tops = [0, 23, 47, 71, 95, 119, 143, 165];
const light = [
  "6898c2 6e9dc4 7da4c6 97b1ca a9bbcd",
  "6d9fcb 72a3cd 85accf 9cb7d2 aac0d5",
  "afccea bcd3ec bbd3ed b0ceeb a5cbeb",
  "8fbee7 94c1e8 96c3ea 96c4ea 96c5eb",
  "8fbfe8 93c1e9 9ec8ec a4cbec a4cbec",
  "9ac6eb a5cbec a3cbec 9ac9ed 9bcaee",
  "a7ccec 9fc9ec 99c8ed 9dcaed a0cdee",
];
const dark = [
  "042145 032043 031f42 031d3f 021c3e",
  "042246 032044 031f42 031d40 021c3e",
  "062348 052247 032145 031f42 031d40",
  "08264c 07254b 062348 032145 031f42",
  "0a2a50 08284e 07264b 062349 052246",
  "0e2f56 0b2b52 09294f 07264c 062449",
  "13345b 0f3057 0c2c52 09294f 07264c",
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
 * A row of the fast user switching menu, which is the application's own composition: 34 pt
 * high, a 32 pt round picture at x 24 and the name at x 65. The pictures are stand-ins.
 */
function User({ name, current = false }: { name: string; current?: boolean }): ReactNode {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 9, marginInlineStart: 3 }}>
      {current && (
        <span
          style={{
            position: "absolute",
            insetInlineStart: 5,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "currentColor",
          }}
        />
      )}
      <span
        style={{
          width: 32,
          height: 32,
          marginBlock: 1,
          borderRadius: "50%",
          background: "var(--mac-color-system-yellow)",
        }}
      />
      {name}
    </span>
  );
}

/**
 * The fast user switching menu of the Fast-User-Switching-Menu screenshots: crop 2656,0 of
 * 490 x 330 px. The 64 pt user cell ends at x 240; its 235 pt menu hangs under it, aligned
 * with the cell's trailing edge because it would not fit the screen otherwise. The
 * neighbouring cells are empty. The comparison clicks the cell and hovers the first user.
 */
export default function VisualUserMenu() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const popup = { container: stage, collisionPadding: 0 };
  const empty = (label: string, width: number) => (
    <MenuBarExtraMenu title="" aria-label={label} titleProps={cell(width)} popup={popup}>
      <MenuItem>{label}</MenuItem>
    </MenuBarExtraMenu>
  );
  return (
    <div ref={setStage} style={{ position: "relative", width: 245, height: 165 }}>
      {picture}
      {/* The bar is cut to the crop here, so that the stage does not confine the menu. */}
      <div style={{ position: "absolute", inset: "0 0 auto", height: 23, overflow: "hidden" }}>
        <MenuBar
          style={{ position: "absolute", insetInlineEnd: -31, width: 640 }}
          extras={
            <MenuBarExtras>
              {empty("AirPlay", 33)}
              {empty("Battery", 36)}
              {empty("Clock", 107)}
              <MenuBarExtraMenu
                title="Stephen"
                titleProps={cell(64, "user")}
                popup={{ ...popup, align: "end", style: { width: 235 } }}
              >
                <MenuItem data-testid="other">
                  <User name="mhackett" />
                </MenuItem>
                <MenuItem disabled>
                  <User name="Stephen" current />
                </MenuItem>
                <MenuSeparator />
                <MenuItem>Login Window…</MenuItem>
                <MenuSeparator />
                <MenuItem>Users &amp; Groups Preferences…</MenuItem>
              </MenuBarExtraMenu>
              {empty("Spotlight", 36)}
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
