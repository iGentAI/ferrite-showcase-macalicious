"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";
import { cn } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import "./time-machine-browser.tokens.css";
import "./time-machine-browser.css";

/** One backup on the timeline of a `TimeMachineBrowser`. */
export interface TimeMachineBackup {
  /** What identifies the backup: the value the selection holds. Unique in the list. */
  value: string;
  /** Its date as shown between the arrows, and its name for assistive technology. */
  label: string;
  /** A day's name ("Today", "Yesterday") on a long tick above the backup: its first one. */
  mark?: string;
  /** Text beside the backup's own tick: "Now" on the last one. */
  caption?: string;
}

export interface TimeMachineBrowserProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "title"> {
  /** The backups, oldest first: the order of the timeline from top to bottom. */
  backups: TimeMachineBackup[];
  /** The `value` of the backup shown in the front window, controlled. */
  value?: string;
  /** The backup shown at first, when the browser keeps its own: the last one if left out. */
  defaultValue?: string;
  /** Called with a backup's `value` when the arrows, the timeline or the keyboard move to it. */
  onValueChange?: (value: string) => void;
  /**
   * How many windows recede behind the front one. A window stands for one older backup and
   * shows a title bar while there is one; the rest are blank.
   * @default 8
   */
  stack?: number;
  /** The front window's title, repeated on the title bars of the stack. Decorative. */
  title?: ReactNode;
  /** Called by the Cancel button and by Escape. */
  onCancel?: () => void;
  /** Called by the Restore button with the `value` of the backup shown. */
  onRestore?: (value: string) => void;
  /**
   * Whether Restore can be used: true once something that can be restored is selected in the
   * front window.
   * @default false
   */
  restorable?: boolean;
  /**
   * Title of the Cancel button.
   * @default "Cancel"
   */
  cancelLabel?: ReactNode;
  /**
   * Title of the Restore button.
   * @default "Restore"
   */
  restoreLabel?: ReactNode;
  /**
   * Accessible name of the up arrow, which moves to the backup before.
   * @default "Older backup"
   */
  olderLabel?: string;
  /**
   * Accessible name of the down arrow, which moves to the backup after.
   * @default "Newer backup"
   */
  newerLabel?: string;
  /**
   * Accessible name of the timeline.
   * @default "Backups"
   */
  timelineLabel?: string;
}

/**
 * The Time Machine browser: the front window in front of a receding stack of the same window
 * at earlier backups, the arrows and the date beside it, Cancel and Restore below it and the
 * timeline of backups on the trailing edge of the screen.
 *
 * The children are the front window, normally a `Window`; render in it what the selected
 * backup holds. Nothing is read or restored here: the backups arrive through `backups` and
 * the choices leave through the callbacks. The root is a `dialog` named "Time Machine"
 * (override it with `aria-label`) that fills its container; `className`, `style`, `ref` and
 * other attributes go to it.
 */
export function TimeMachineBrowser({
  backups,
  value,
  defaultValue,
  onValueChange,
  stack = 8,
  title,
  onCancel,
  onRestore,
  restorable = false,
  cancelLabel = "Cancel",
  restoreLabel = "Restore",
  olderLabel = "Older backup",
  newerLabel = "Newer backup",
  timelineLabel = "Backups",
  className,
  children,
  onKeyDown,
  ...props
}: TimeMachineBrowserProps) {
  const id = useId();
  const [selected, setSelected] = useControlled(
    value,
    defaultValue ?? backups[backups.length - 1]?.value ?? "",
    onValueChange,
  );
  const last = backups.length - 1;
  const index = Math.max(
    0,
    backups.findIndex((backup) => backup.value === selected),
  );
  const current = backups[index];

  // More backups than the timeline shows scroll in it: the one shown is kept in view, by the
  // timeline's own scroll position and nothing else's.
  const timeline = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the position follows the backup shown and how many there are
  useEffect(() => {
    const list = timeline.current;
    const tick = list?.children[index] as HTMLElement | undefined;
    if (!list || !tick) return;
    const end = tick.offsetTop + tick.offsetHeight - list.clientHeight;
    list.scrollTop = Math.min(Math.max(list.scrollTop, end), tick.offsetTop);
  }, [index, last]);
  const go = (to: number) => {
    const next = backups[Math.min(Math.max(to, 0), last)];
    if (next && next !== current) setSelected(next.value);
  };

  const onTimelineKeyDown = (event: KeyboardEvent) => {
    const keys: Record<string, number | undefined> = {
      ArrowUp: index - 1,
      ArrowDown: index + 1,
      Home: 0,
      End: last,
    };
    const to = keys[event.key];
    if (to === undefined) return;
    event.preventDefault();
    go(to);
  };

  const chevron = (d: string) => (
    <svg
      className="mac-time-machine-browser-label"
      viewBox="0 0 34 34"
      width="34"
      height="34"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );

  return (
    <div
      role="dialog"
      aria-label="Time Machine"
      className={cn("mac-time-machine-browser", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Escape" && !event.defaultPrevented) onCancel?.();
      }}
      {...props}
    >
      <div className="mac-time-machine-browser-window">
        <div className="mac-time-machine-browser-stack" aria-hidden="true">
          {Array.from({ length: Math.max(0, stack) }, (_, n) => {
            // The farthest window first, so that the nearer ones are painted over it.
            const depth = stack - n;
            return (
              <div
                key={depth}
                className="mac-time-machine-browser-layer"
                data-empty={depth > index ? "" : undefined}
                style={{ "--_i": depth } as CSSProperties}
              >
                {depth > index ? null : title}
              </div>
            );
          })}
        </div>
        {children}
      </div>
      <div className="mac-time-machine-browser-steps">
        <BaseButton
          aria-label={olderLabel}
          data-step="older"
          disabled={index === 0}
          focusableWhenDisabled
          className="mac-time-machine-browser-button"
          onClick={() => go(index - 1)}
        >
          {chevron("M12.5 19.5 17 15l4.5 4.5")}
        </BaseButton>
        <output className="mac-time-machine-browser-date">{current?.label}</output>
        <BaseButton
          aria-label={newerLabel}
          data-step="newer"
          disabled={index >= last}
          focusableWhenDisabled
          className="mac-time-machine-browser-button"
          onClick={() => go(index + 1)}
        >
          {chevron("M12.5 15.5 17 20l4.5-4.5")}
        </BaseButton>
      </div>
      <div className="mac-time-machine-browser-actions">
        <BaseButton className="mac-time-machine-browser-button" onClick={() => onCancel?.()}>
          <span className="mac-time-machine-browser-label">{cancelLabel}</span>
        </BaseButton>
        <BaseButton
          className="mac-time-machine-browser-button"
          disabled={!restorable}
          onClick={() => current && onRestore?.(current.value)}
        >
          <span className="mac-time-machine-browser-label">{restoreLabel}</span>
        </BaseButton>
      </div>
      <div
        ref={timeline}
        role="listbox"
        aria-label={timelineLabel}
        aria-orientation="vertical"
        aria-activedescendant={current ? `${id}-${index}` : undefined}
        tabIndex={0}
        className="mac-time-machine-browser-timeline"
        onKeyDown={onTimelineKeyDown}
      >
        {backups.map((backup, at) => (
          // biome-ignore lint/a11y/useFocusableInteractive: the timeline keeps the focus and names the selected backup with aria-activedescendant
          // biome-ignore lint/a11y/useKeyWithClickEvents: the keys are handled on the timeline, which keeps the focus
          <div
            key={backup.value}
            role="option"
            id={`${id}-${at}`}
            aria-selected={at === index}
            aria-label={backup.label}
            data-mark={backup.mark == null ? undefined : ""}
            className="mac-time-machine-browser-tick"
            onClick={() => go(at)}
          >
            {backup.mark != null && (
              <span className="mac-time-machine-browser-mark" aria-hidden="true">
                {backup.mark}
              </span>
            )}
            {backup.caption != null && (
              <span className="mac-time-machine-browser-caption" aria-hidden="true">
                {backup.caption}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
