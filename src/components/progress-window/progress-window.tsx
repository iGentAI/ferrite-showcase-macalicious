"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type ComponentProps, type MouseEvent, type ReactNode, type Ref, useId } from "react";
import { cn } from "../../lib/cn";
import { ProgressBar } from "../progress-bar";
import { TitleBar, type TitleBarProps } from "../title-bar";
import { Window, type WindowProps } from "../window";
import "./progress-window.tokens.css";
import "./progress-window.css";

export interface ProgressWindowProps extends WindowProps {
  /**
   * The close, minimize and zoom buttons: a `WindowControls` element. Finder disables close
   * and zoom (`closeDisabled`, `zoomDisabled`): the window closes itself when the work is done.
   */
  controls?: ReactNode;
  /**
   * Frame width: a number of points, or any CSS length.
   * @default 399
   */
  width?: number | string;
  /**
   * The window's accessible name. The window shows no title, so this is its only name; an
   * `aria-labelledby` replaces it.
   * @default "Progress"
   */
  "aria-label"?: string;
  /**
   * Called when the primary pointer button goes down on the strip that holds the window
   * controls, not on a control. A window manager starts moving the window here.
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when that strip is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/**
 * The progress window of a long file operation, as Finder shows while it copies: a window with
 * no title and a transparent title bar, holding one `ProgressWindowItem` per operation.
 *
 * It is a `Window` and takes its props (`state`, `height`, `style`, `ref`); like it, the
 * progress window is presentational and does not open, move or close itself.
 */
export function ProgressWindow({
  controls,
  width = 399,
  "aria-label": ariaLabel = "Progress",
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  className,
  children,
  ...props
}: ProgressWindowProps) {
  return (
    <Window
      width={width}
      aria-label={props["aria-labelledby"] === undefined ? ariaLabel : undefined}
      className={cn("mac-progress-window", className)}
      {...props}
    >
      <TitleBar
        className="mac-progress-window-header"
        controls={controls}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      {children}
    </Window>
  );
}

export interface ProgressWindowItemProps extends Omit<ComponentProps<"div">, "title"> {
  /** The icon of what is being worked on, drawn in a 32 pt canvas. Decorative. */
  icon?: ReactNode;
  /**
   * What is happening, on one line of 11 pt text: `Copying “Report.pdf” to “Desktop”`. It names
   * the progress bar. A string truncates at its end; wrap a file name in `ProgressWindowName`
   * to truncate that name in the middle instead.
   */
  title: ReactNode;
  /**
   * How far the work is and how long it will take, in 9 pt secondary text: `192.9 MB of 6 GB,
   * about 3 minutes`. It is the progress bar's value text.
   */
  status?: ReactNode;
  /**
   * Progress from 0 to 100. `null` shows the indeterminate bar, for work whose length is not
   * known yet ("Preparing to copy…").
   * @default null
   */
  value?: number | null;
  /**
   * Called when the stop button is activated. The button is only shown when this is given.
   */
  onStop?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Accessible name of the stop button.
   * @default "Stop"
   */
  stopLabel?: string;
  /** Ref to the row element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * One operation in a `ProgressWindow`: icon, title, progress bar with a stop button, and a
 * status line. Several items stack, separated by a line.
 *
 * The row is a group named by its title. The bar is the library's `ProgressBar`, labelled by
 * the title, with the status as its value text.
 */
export function ProgressWindowItem({
  icon,
  title,
  status,
  value = null,
  onStop,
  stopLabel = "Stop",
  className,
  ...props
}: ProgressWindowItemProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const statusId = `${id}-status`;
  const hasStatus = status !== undefined && status !== null && status !== false;
  const statusText = typeof status === "string" ? status : undefined;

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics; this is one row of status.
    <div
      role="group"
      aria-labelledby={titleId}
      className={cn("mac-progress-window-item", className)}
      {...props}
    >
      {icon ? (
        <span className="mac-progress-window-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="mac-progress-window-title" id={titleId}>
        {typeof title === "string" ? (
          <span className="mac-progress-window-title-text">{title}</span>
        ) : (
          title
        )}
      </div>
      <ProgressBar
        className="mac-progress-window-bar"
        value={value}
        aria-labelledby={titleId}
        // A status that is plain text is the bar's value text; anything else describes it.
        aria-describedby={hasStatus && statusText === undefined ? statusId : undefined}
        getAriaValueText={statusText === undefined ? undefined : () => statusText}
      />
      {onStop ? (
        <BaseButton
          className="mac-progress-window-stop"
          aria-label={stopLabel}
          aria-describedby={titleId}
          onClick={onStop}
        >
          {/* An original drawing on a 14 pt grid: a disc with an x cut out of it. */}
          <svg className="mac-progress-window-stop-glyph" viewBox="0 0 14 14" aria-hidden="true">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M7 .08a6.92 6.92 0 1 0 0 13.84A6.92 6.92 0 0 0 7 .08zm0 7.98 2.475 2.475 1.06-1.06L8.06 7l2.475-2.475-1.06-1.06L7 5.94 4.525 3.465l-1.06 1.06L5.94 7 3.465 9.475l1.06 1.06z"
            />
          </svg>
        </BaseButton>
      ) : null}
      {hasStatus ? (
        <div className="mac-progress-window-status" id={statusId}>
          {status}
        </div>
      ) : null}
    </div>
  );
}

export interface ProgressWindowNameProps extends Omit<ComponentProps<"span">, "children"> {
  /** The whole name. It stays in the document in full, so it is read and copied in full. */
  children: string;
  /**
   * How many characters at the end of the name always stay visible, so that the extension can
   * be read.
   * @default 12
   */
  tail?: number;
}

/**
 * A file name that truncates in the middle, as AppKit does in a progress window's title: the
 * start of the name gives way with an ellipsis and its last characters always stay. It is done
 * in CSS, with the name split into two spans, so nothing is measured in script.
 */
export function ProgressWindowName({
  tail = 12,
  className,
  children,
  ...props
}: ProgressWindowNameProps) {
  // By grapheme, so that a combining mark or a joined emoji is never cut in two; by code
  // point where the browser has no segmenter.
  const characters =
    typeof Intl.Segmenter === "function"
      ? Array.from(new Intl.Segmenter().segment(children), (part) => part.segment)
      : Array.from(children);
  const cut = Math.max(0, characters.length - Math.max(0, tail));
  return (
    <span className={cn("mac-progress-window-name", className)} {...props}>
      <span className="mac-progress-window-name-start">{characters.slice(0, cut).join("")}</span>
      <span className="mac-progress-window-name-end">{characters.slice(cut).join("")}</span>
    </span>
  );
}
