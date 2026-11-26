import { AppSwitcher, AppSwitcherItem } from "macalicious/app-switcher";
import type { CSSProperties } from "react";

/**
 * Visual comparison target: the panel with three applications, the first selected, as in the
 * Command-Tab captures.
 *
 * Reference crop x=1240 y=864 w=880 h=372 (440 x 186 pt): the panel exactly. It has no border
 * and no shadow, and what is outside its corners is the window behind it.
 *
 * That window is System Preferences, and the panel's colour is what its material makes of the
 * panes under it. The System-Preferences-0 captures show the same window uncovered, so the
 * backdrop here is measured, not guessed: the band the panes are on, and for every pane a flat
 * tile of its icon's mean colour and a bar of its label's. They are stand-ins, not drawings of
 * the icons, and are seen only through the blur. The window sits 24 pt further left and 7 pt
 * higher under the panel in the Dark Aqua capture.
 *
 * The three application icons are Apple artwork: the tiles here are neutral, and the
 * comparison masks them.
 */
export default function VisualPanel() {
  return (
    <div
      style={{
        position: "relative",
        width: 440,
        height: 186,
        overflow: "hidden",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      {/* The System Preferences window: its top-left corner is the origin of the numbers. */}
      <div
        style={{
          position: "absolute",
          left: "calc(-127px - 24px * var(--mac-appearance-dark))",
          top: "calc(-198px - 7px * var(--mac-appearance-dark))",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 187,
            width: 780,
            height: 192,
            borderBlock: "1px solid light-dark(#d5d5d5, #434445)",
            background: "light-dark(#e5e5e5, #353637)",
          }}
        />
        {PANES.map((row, r) =>
          row.map((color, c) => (
            <div key={color}>
              <div
                style={{
                  position: "absolute",
                  left: 165.75 + 82 * c,
                  top: r ? 298 : 207.5,
                  width: 37,
                  height: r ? 37 : 38,
                  background: color,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 159.25 + 82 * c,
                  top: r ? 344 : 253,
                  width: 50,
                  height: 12.5,
                  background: "light-dark(#cacaca, #545556)",
                }}
              />
            </div>
          )),
        )}
      </div>
      {/* The box is the panel: no margin is kept clear at its sides. */}
      <AppSwitcher
        open
        value="terminal"
        style={{ "--mac-app-switcher-margin": "0px" } as CSSProperties}
      >
        {["Terminal", "System Preferences", "Finder"].map((name) => (
          <AppSwitcherItem
            key={name}
            value={name.toLowerCase()}
            icon={<div style={{ scale: "0.84", borderRadius: 28, background: "#8e8e93" }} />}
          >
            {name}
          </AppSwitcherItem>
        ))}
      </AppSwitcher>
    </div>
  );
}

// Mean colour of each pane's icon box in the System-Preferences-0 captures, the second to the
// seventh pane of the first two rows: 74 x 76 px boxes at y=415 and 74 x 74 px at y=596, on a
// pitch of 164 px from x=332.
const PANES = [
  [
    "light-dark(#7aafec, #6ca1de)",
    "light-dark(#4b4e51, #303336)",
    "light-dark(#5a6a5c, #3f4f41)",
    "light-dark(#9695b3, #696886)",
    "light-dark(#5cb1ed, #2f84c0)",
    "light-dark(#75baeb, #3b7fb1)",
  ],
  [
    "light-dark(#c5c0a4, #a29d82)",
    "light-dark(#ebced5, #c5a9b0)",
    "light-dark(#b1b9bb, #848c8e)",
    "light-dark(#68b7f0, #3b8ac3)",
    "light-dark(#8887ca, #5f5ea1)",
    "light-dark(#c5cfd1, #a0aaac)",
  ],
];
