import type { ReactNode } from "react";
import type { ActivityMonitorIcon } from "./activity-monitor-data";

/*
 * Stand-in drawings. Activity Monitor shows each application's own icon, which is Apple's or
 * a third party's artwork; these are plain original marks that only keep the kinds apart. The
 * toolbar's glyphs are the library's system images.
 */
const DRAWINGS: Record<Exclude<ActivityMonitorIcon, "none">, ReactNode> = {
  document: (
    <>
      <path className="mac-activity-monitor-icon-paper" d="M3.5 1.5h6l3 3v10h-9z" />
      <path className="mac-activity-monitor-icon-fold" d="M9.5 1.5v3h3" />
    </>
  ),
  application: (
    <>
      <path className="mac-activity-monitor-icon-paper" d="M2.5 3.5l8-2 3 11-8 2z" />
      <path className="mac-activity-monitor-icon-fold" d="M6 11.5l2.5-6 2.5 5M7 9.5h3.3" />
    </>
  ),
  monitor: (
    <>
      <rect className="mac-activity-monitor-icon-ink" x="1" y="2" width="14" height="12" rx="1" />
      <path className="mac-activity-monitor-icon-trace" d="M2.5 9h3l1-3 1.5 5 1.5-4 .8 2h3.2" />
    </>
  ),
  console: (
    <>
      <rect className="mac-activity-monitor-icon-ink" x="1" y="2.5" width="14" height="11" rx="1" />
      <path className="mac-activity-monitor-icon-trace" d="M3 5h1m1 0h1m1 0h1" />
    </>
  ),
  files: (
    <>
      <rect
        className="mac-activity-monitor-icon-files"
        x="1.5"
        y="2"
        width="13"
        height="12"
        rx="2"
      />
      <path className="mac-activity-monitor-icon-mark" d="M8 2.5v11M4.5 6v1.5M11.5 6v1.5" />
    </>
  ),
  search: (
    <>
      <circle className="mac-activity-monitor-icon-disc" cx="8" cy="8" r="7" />
      <path
        className="mac-activity-monitor-icon-mark"
        d="M9.6 7a2.6 2.6 0 1 1-5.2 0a2.6 2.6 0 1 1 5.2 0zM9 9l2.6 2.6"
      />
    </>
  ),
};

/** The 16 pt icon column of the Process Name cell. A process without an icon keeps the space. */
export function ProcessIcon({ kind }: { kind: ActivityMonitorIcon }) {
  return (
    <span className="mac-activity-monitor-icon">
      {kind === "none" ? null : (
        <svg
          className="mac-activity-monitor-icon-drawing"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          {DRAWINGS[kind]}
        </svg>
      )}
    </span>
  );
}
