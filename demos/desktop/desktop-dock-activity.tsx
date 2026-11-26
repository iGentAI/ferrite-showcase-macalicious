"use client";

import { useState } from "react";
import { useMainThread } from "../activity-monitor/activity-monitor-page";

/**
 * Activity Monitor's Dock icon when View > Dock Icon asks for a live graph. What it draws is the one
 * load a web page can read, how busy its own main thread is, which Activity Monitor's CPU view also
 * shows; it is measured only while the icon shows.
 */

export const ACTIVITY_DOCK_ICON = "activity-monitor.dockIcon";

export type ActivityDockMode = "app" | "cpu" | "history";

export const readActivityDockMode = (stored: unknown): ActivityDockMode | undefined =>
  stored === "app" || stored === "cpu" || stored === "history" ? stored : undefined;

/** The seconds CPU History shows, one column each; CPU Usage's meter has as many segments. */
const COLUMNS = 16;
const SEGMENTS = 10;

/** The seconds to draw from the newest `busy` readings: oldest first, always `COLUMNS` long. */
export function historyColumns(readings: readonly number[]): readonly number[] {
  const last = readings.slice(-COLUMNS);
  return [...Array.from({ length: COLUMNS - last.length }, () => 0), ...last];
}

/** How many of a meter's segments a reading lights: at least one while there is any load. */
export const litSegments = (busy: number) =>
  busy <= 0 ? 0 : Math.max(1, Math.min(SEGMENTS, Math.round((busy / 100) * SEGMENTS)));

export function ActivityDockIcon({ mode }: { mode: Exclude<ActivityDockMode, "app"> }) {
  const [readings, setReadings] = useState<readonly number[]>([]);
  useMainThread((busy) => setReadings((all) => [...all.slice(-(COLUMNS - 1)), busy]));
  const now = readings.at(-1) ?? 0;
  return (
    <svg
      className="mac-desktop-shell-activity-icon"
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Main thread ${Math.round(now)}% busy`}
      data-mode={mode}
      data-readings={readings.length}
    >
      <rect
        className="mac-desktop-shell-activity-tile"
        x="4"
        y="4"
        width="56"
        height="56"
        rx="10"
      />
      {mode === "cpu"
        ? Array.from({ length: SEGMENTS }, (_, at) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: the meter's segments never move.
              key={at}
              className="mac-desktop-shell-activity-bar"
              data-lit={at < litSegments(now) ? "" : undefined}
              x="14"
              y={52 - at * 4.2}
              width="36"
              height="3"
            />
          ))
        : historyColumns(readings).flatMap((busy, at) => [
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: a column is its place in the graph.
              key={`${at}-whole`}
              className="mac-desktop-shell-activity-bar"
              x={9 + at * 2.9}
              y="9"
              width="2.4"
              height="46"
            />,
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: a column is its place in the graph.
              key={`${at}-load`}
              className="mac-desktop-shell-activity-bar"
              data-lit=""
              x={9 + at * 2.9}
              y={55 - (busy / 100) * 46}
              width="2.4"
              height={(busy / 100) * 46}
            />,
          ])}
    </svg>
  );
}
