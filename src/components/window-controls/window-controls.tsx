"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps, MouseEvent, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./window-controls.tokens.css";
import "./window-controls.css";

type ZoomRole = "full-screen" | "zoom" | "exit-full-screen";

const ZOOM_LABELS: Record<ZoomRole, string> = {
  "full-screen": "Enter Full Screen",
  zoom: "Zoom",
  "exit-full-screen": "Exit Full Screen",
};

const LABELS = { close: "Close", minimize: "Minimize" } as const;

/* Glyphs on a 12 pt grid, original drawings to the geometry measured in Full-Screen-App. */
const GLYPHS = {
  close: <path d="M3.3 3.3l5.4 5.4m0-5.4L3.3 8.7" stroke="currentColor" strokeWidth="1.1" />,
  minimize: <path d="M2 6h8" stroke="currentColor" strokeWidth="1.3" />,
  "full-screen": <path d="M4 3h5v5zM3 4v5h5z" fill="currentColor" />,
  "exit-full-screen": <path d="M6 1.5V6h4.5zM1.5 6H6v4.5z" fill="currentColor" />,
  zoom: <path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.3" />,
  edited: <circle cx="6" cy="6" r="2" fill="currentColor" />,
} as const;

export interface WindowControlsButtonProps extends Omit<BaseButton.Props, "ref"> {
  /** Which of the three buttons this is. */
  kind: "close" | "minimize" | "zoom";
  /**
   * What the zoom button does, which picks its hover glyph: enter full screen (the default of
   * a window that supports it), zoom (the plus shown with Option held, or in windows without
   * full screen) or leave full screen. Only read when `kind` is `"zoom"`.
   * @default "full-screen"
   */
  zoomRole?: "full-screen" | "zoom" | "exit-full-screen";
  /**
   * The document has unsaved changes: a dot in the close button while the pointer is away.
   * Only read when `kind` is `"close"`.
   * @default false
   */
  edited?: boolean;
  /** Ref to the rendered button. */
  ref?: Ref<HTMLElement>;
}

/**
 * One window control, named after what it does ("Close", "Minimize", or the zoom role) unless
 * it is given an `aria-label`. `WindowControls` renders the usual three; use this part directly
 * only for a different set, inside a `WindowControls` given as its children.
 */
export function WindowControlsButton({
  kind,
  zoomRole = "full-screen",
  edited = false,
  className,
  ...props
}: WindowControlsButtonProps) {
  const glyph = kind === "zoom" ? zoomRole : kind;
  return (
    <BaseButton
      data-kind={kind}
      aria-label={kind === "zoom" ? ZOOM_LABELS[zoomRole] : LABELS[kind]}
      data-edited={kind === "close" && edited ? "" : undefined}
      className={withClassName("mac-window-controls-button", className)}
      {...props}
    >
      <svg className="mac-window-controls-glyph" viewBox="0 0 12 12" aria-hidden="true">
        {GLYPHS[glyph]}
      </svg>
      {kind === "close" && edited ? (
        <svg className="mac-window-controls-dot" viewBox="0 0 12 12" aria-hidden="true">
          {GLYPHS.edited}
        </svg>
      ) : null}
    </BaseButton>
  );
}

export interface WindowControlsProps extends ComponentProps<"div"> {
  /**
   * `"regular"` is the 12 pt buttons of a window; `"small"` the 11 pt buttons of a utility
   * panel.
   * @default "regular"
   */
  size?: "regular" | "small";
  /**
   * What the zoom button does, which picks its hover glyph and its default label.
   * @default "full-screen"
   */
  zoomRole?: "full-screen" | "zoom" | "exit-full-screen";
  /** Called when the close button is activated. */
  onClose?: (event: MouseEvent<HTMLElement>) => void;
  /** Called when the minimize button is activated. */
  onMinimize?: (event: MouseEvent<HTMLElement>) => void;
  /** Called when the zoom button is activated. */
  onZoom?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Disable the close button.
   * @default false
   */
  closeDisabled?: boolean;
  /**
   * Disable the minimize button, as in a full-screen window.
   * @default false
   */
  minimizeDisabled?: boolean;
  /**
   * Disable the zoom button, as in a window that cannot be resized.
   * @default false
   */
  zoomDisabled?: boolean;
  /**
   * Why the zoom button is dimmed, shown as its tooltip and its accessible description. Only read while
   * `zoomDisabled`. Without it the button says "This window has a fixed size", unless the group has a `title` of its
   * own (a panel's reason for its dimmed buttons), which then stands for all three.
   */
  zoomDisabledReason?: string;
  /**
   * The document has unsaved changes: a dot in the close button.
   * @default false
   */
  edited?: boolean;
  /**
   * Accessible name of the close button.
   * @default "Close"
   */
  closeLabel?: string;
  /**
   * Accessible name of the minimize button.
   * @default "Minimize"
   */
  minimizeLabel?: string;
  /** Accessible name of the zoom button. Defaults to a name that matches `zoomRole`. */
  zoomLabel?: string;
}

/**
 * The close, minimize and zoom buttons of a window ("traffic lights").
 *
 * Coloured in the key window and grey in a main or inactive one, which they read from
 * `data-window-state` on the window. Their glyphs appear on all three while the pointer is over
 * the group or one of them has keyboard focus. With the graphite accent (`data-accent="graphite"`
 * on the group or any ancestor) all three are grey.
 *
 * The buttons only report activation; closing, minimizing and zooming are the window
 * manager's. Pass children to replace the three buttons with your own `WindowControlsButton`s.
 */
export function WindowControls({
  size = "regular",
  zoomRole = "full-screen",
  onClose,
  onMinimize,
  onZoom,
  closeDisabled = false,
  minimizeDisabled = false,
  zoomDisabled = false,
  zoomDisabledReason,
  edited = false,
  closeLabel = "Close",
  minimizeLabel = "Minimize",
  zoomLabel,
  title,
  className,
  children,
  ...props
}: WindowControlsProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics; these are three window buttons.
    <div
      role="group"
      aria-label="Window controls"
      data-size={size}
      title={title}
      className={cn("mac-window-controls", className)}
      {...props}
    >
      {children ?? (
        <>
          <WindowControlsButton
            kind="close"
            edited={edited}
            aria-label={closeLabel}
            disabled={closeDisabled}
            onClick={onClose}
          />
          <WindowControlsButton
            kind="minimize"
            aria-label={minimizeLabel}
            disabled={minimizeDisabled}
            onClick={onMinimize}
          />
          <WindowControlsButton
            kind="zoom"
            zoomRole={zoomRole}
            aria-label={zoomLabel ?? ZOOM_LABELS[zoomRole]}
            disabled={zoomDisabled}
            title={
              zoomDisabled
                ? (zoomDisabledReason ?? (title ? undefined : "This window has a fixed size"))
                : undefined
            }
            onClick={onZoom}
          />
        </>
      )}
    </div>
  );
}
