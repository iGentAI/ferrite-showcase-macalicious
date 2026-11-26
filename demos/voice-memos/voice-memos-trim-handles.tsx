"use client";

import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useRef } from "react";
import { OVERVIEW_SPAN } from "./voice-memos";
import type { TrimRange } from "./voice-memos-audio";
import { formatTimer } from "./voice-memos-data";

const ARROW_SECONDS = 0.01;
const LARGE_SECONDS = 1;

export interface VoiceMemosTrimHandlesProps {
  /** The stretch between the handles, in seconds. */
  range: TrimRange;
  /** The recording's length, in seconds. */
  duration: number;
  /** Called with where the person moves the start handle. */
  onStartChange: (value: number) => void;
  /** Called with where the person moves the end handle. */
  onEndChange: (value: number) => void;
}

/**
 * The yellow handles over the overview's strip, which mark the stretch that Trim keeps and Delete
 * removes. Time maps to the strip as the overview's own: a short recording takes its leading part.
 */
export function VoiceMemosTrimHandles({
  range,
  duration,
  onStartChange,
  onEndChange,
}: VoiceMemosTrimHandlesProps) {
  const strip = useRef<HTMLDivElement>(null);
  const whole = Math.max(duration, OVERVIEW_SPAN);
  const share = (seconds: number) => `${((seconds / whole) * 100).toFixed(4)}%`;

  const handle = (
    label: string,
    side: "start" | "end",
    value: number,
    move: (value: number) => void,
  ): ReactNode => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={value}
      aria-valuetext={formatTimer(value)}
      data-side={side}
      className="mac-voice-memos-trim-handle"
      style={{ left: share(value) }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        if (event.button) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
        const box = strip.current?.getBoundingClientRect();
        if (!box?.width || !event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
        move(Math.min(duration, Math.max(0, ((event.clientX - box.left) / box.width) * whole)));
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? LARGE_SECONDS : ARROW_SECONDS;
        const next: Record<string, number> = {
          ArrowLeft: value - step,
          ArrowDown: value - step,
          ArrowRight: value + step,
          ArrowUp: value + step,
          PageUp: value + LARGE_SECONDS,
          PageDown: value - LARGE_SECONDS,
          Home: 0,
          End: duration,
        };
        const to = next[event.key];
        if (to === undefined) return;
        event.preventDefault();
        move(Math.min(duration, Math.max(0, to)));
      }}
    />
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring form semantics to two handles
    <div
      ref={strip}
      role="group"
      aria-label="Trim"
      className="mac-voice-memos-trim"
      data-appearance="dark"
    >
      <div
        className="mac-voice-memos-trim-outside"
        style={{ left: 0, width: share(range.start) }}
      />
      <div
        className="mac-voice-memos-trim-kept"
        style={{ left: share(range.start), width: share(range.end - range.start) }}
      />
      <div
        className="mac-voice-memos-trim-outside"
        style={{ left: share(range.end), width: share(duration - range.end) }}
      />
      {handle("Trim start", "start", range.start, onStartChange)}
      {handle("Trim end", "end", range.end, onEndChange)}
    </div>
  );
}

export interface VoiceMemosTrimActionsProps {
  /** Nothing to do yet: the handles hold the whole recording. */
  holdsWhole: boolean;
  /** No change has been made since the trim began. */
  unchanged: boolean;
  disabled: boolean;
  onRevert: () => void;
  onDelete: () => void;
  onTrim: () => void;
  /** The timer between them. */
  children: ReactNode;
}

/** The row under the overview while trimming: Revert, the timer, and Delete and Trim. */
export function VoiceMemosTrimActions({
  holdsWhole,
  unchanged,
  disabled,
  onRevert,
  onDelete,
  onTrim,
  children,
}: VoiceMemosTrimActionsProps) {
  return (
    <div className="mac-voice-memos-trim-row">
      <div className="mac-voice-memos-trim-actions">
        <button
          type="button"
          className="mac-voice-memos-trim-action"
          disabled={disabled || unchanged}
          onClick={onRevert}
        >
          Revert
        </button>
      </div>
      {children}
      <div className="mac-voice-memos-trim-actions" data-side="end">
        <button
          type="button"
          className="mac-voice-memos-trim-action"
          aria-label="Delete Selection"
          disabled={disabled || holdsWhole}
          onClick={onDelete}
        >
          Delete
        </button>
        <button
          type="button"
          className="mac-voice-memos-trim-action"
          data-tone="yellow"
          aria-label="Trim to Selection"
          disabled={disabled || holdsWhole}
          onClick={onTrim}
        >
          Trim
        </button>
      </div>
    </div>
  );
}
