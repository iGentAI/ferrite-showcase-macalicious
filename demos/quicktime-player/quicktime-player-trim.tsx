"use client";

import { DefaultButton } from "macalicious/default-button";
import { HudWindow, HudWindowText } from "macalicious/hud-window";
import { PushButton } from "macalicious/push-button";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from "react";
import { timeText } from "./quicktime-player-recording-files";

/** The arrow keys' step, in seconds. */
const KEY_STEP = 1;
/** The shortest stretch trimming leaves, in seconds. */
export const LEAST_LENGTH = 0.5;

export interface QuickTimeTrimBarProps {
  /** The movie's length, in seconds. */
  length: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  onTrim: () => void;
  onCancel: () => void;
}

/**
 * Edit > Trim: the movie's length with two yellow handles. Dragging or the arrow keys move them,
 * Return trims and Escape cancels.
 */
export function QuickTimeTrimBar({
  length,
  start,
  end,
  onChange,
  onTrim,
  onCancel,
}: QuickTimeTrimBarProps) {
  const track = useRef<HTMLDivElement>(null);
  const startHandle = useRef<HTMLDivElement>(null);
  // The keyboard comes here, so that I, O, Return and Escape work after the menu's row.
  useEffect(() => startHandle.current?.focus(), []);
  const place = (handle: "start" | "end", seconds: number) => {
    if (handle === "start") {
      onChange(Math.max(0, Math.min(seconds, end - LEAST_LENGTH)), end);
    } else {
      onChange(start, Math.min(length, Math.max(seconds, start + LEAST_LENGTH)));
    }
  };
  const handleProps = (handle: "start" | "end") => {
    const value = handle === "start" ? start : end;
    return {
      role: "slider",
      tabIndex: 0,
      "aria-label": handle === "start" ? "Trim start" : "Trim end",
      "aria-valuemin": 0,
      "aria-valuemax": Math.round(length),
      "aria-valuenow": Math.round(value),
      "aria-valuetext": timeText(value),
      className: "mac-quicktime-player-trim-handle",
      "data-handle": handle,
      style: { insetInlineStart: `${(value / length) * 100}%` },
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const box = track.current?.getBoundingClientRect();
        if (!box || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        place(handle, ((event.clientX - box.left) / box.width) * length);
      },
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") place(handle, value - KEY_STEP);
        else if (event.key === "ArrowRight") place(handle, value + KEY_STEP);
        else return;
        event.preventDefault();
        event.stopPropagation();
      },
    };
  };
  return (
    <HudWindow
      aria-label="Trim"
      className="mac-quicktime-player-trim"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          if (event.target instanceof HTMLElement && event.target.closest("button")) return;
          onTrim();
        } else if (event.key === "Escape") onCancel();
        else return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="mac-quicktime-player-trim-row">
        <HudWindowText>{timeText(start)}</HudWindowText>
        <div ref={track} className="mac-quicktime-player-trim-track">
          <div
            className="mac-quicktime-player-trim-kept"
            style={{
              insetInlineStart: `${(start / length) * 100}%`,
              insetInlineEnd: `${100 - (end / length) * 100}%`,
            }}
          />
          <div ref={startHandle} {...handleProps("start")} />
          <div {...handleProps("end")} />
        </div>
        <HudWindowText>{timeText(end)}</HudWindowText>
        <PushButton size="small" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton size="small" onClick={onTrim}>
          Trim
        </DefaultButton>
      </div>
    </HudWindow>
  );
}
