/*
 * Stand-in picture of a tablet used as a second display: an original drawing on the 217 x 158 pt
 * frame of the pane, in place of Apple's artwork. The strip of controls beside the screen and
 * the row of keys along it follow the pane's settings.
 */

import { useId } from "react";

/** The area inside the tablet's rim that the screen, the sidebar and the Touch Bar share. */
const INNER = { x: 9, y: 9.5, width: 199, height: 138 };
const SIDEBAR_WIDTH = 12;
const TOUCH_BAR_HEIGHT = 10;

export interface TabletArtworkProps {
  /** Side of the screen the sidebar is on, or `null` while it is hidden. */
  sidebar: "left" | "right" | null;
  /** Edge of the screen the Touch Bar is on, or `null` while it is hidden. */
  touchBar: "bottom" | "top" | null;
}

/** The picture of the tablet the pane configures. Decorative. */
export function TabletArtwork({ sidebar, touchBar }: TabletArtworkProps) {
  const screen = useId();
  const left = INNER.x + (sidebar === "left" ? SIDEBAR_WIDTH : 0);
  const top = INNER.y + (touchBar === "top" ? TOUCH_BAR_HEIGHT : 0);
  const width = INNER.width - (sidebar ? SIDEBAR_WIDTH : 0);
  const height = INNER.height - (touchBar ? TOUCH_BAR_HEIGHT : 0);
  const sidebarX = sidebar === "left" ? INNER.x : INNER.x + INNER.width - SIDEBAR_WIDTH;
  const touchBarY = touchBar === "top" ? INNER.y : INNER.y + INNER.height - TOUCH_BAR_HEIGHT;

  return (
    <svg width="217" height="158" viewBox="0 0 217 158" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={screen} x1="0.75" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#3f4697" />
          <stop offset="0.4" stopColor="#7f7fd0" />
          <stop offset="0.75" stopColor="#d9a8de" />
          <stop offset="1" stopColor="#ffc9d2" />
        </linearGradient>
      </defs>
      {/* Rim and body */}
      <rect x="0.5" y="0.5" width="216" height="157" rx="8" fill="#000000" stroke="#8e8e93" />
      <rect {...INNER} fill="#161617" />
      <rect x={left} y={top} width={width} height={height} rx="1.5" fill={`url(#${screen})`} />
      {sidebar ? (
        <g fill="#8e8e93">
          {[8.5, 17.5, 113.5, 122.5].map((y) => (
            <rect key={y} x={sidebarX + 4} y={INNER.y + y} width="4" height="3" />
          ))}
          {[56, 65, 74, 83].map((y) => (
            <circle key={y} cx={sidebarX + 6} cy={INNER.y + y} r="2" />
          ))}
        </g>
      ) : null}
      {touchBar ? (
        <g fill="#48484a">
          {[
            [23, 12],
            [37, 12],
            [51, 12],
            [66, 36],
            [103, 36],
            [140, 36],
            [179, 12],
            [193, 12],
          ].map(([x, keyWidth]) => (
            <rect key={x} x={x} y={touchBarY + 2.5} width={keyWidth} height="5" rx="0.5" />
          ))}
        </g>
      ) : null}
      <rect x="82.5" y="146.5" width="52" height="1" fill="#8e8e93" />
    </svg>
  );
}
