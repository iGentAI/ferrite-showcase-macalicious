"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type ComponentProps, type CSSProperties, type ReactNode, useId } from "react";
import { cn } from "../../lib/cn";
import "./dictation.tokens.css";
import "./dictation.css";

// The outline of the panel in points: the 84 x 95 body with corners of 5, and on its right
// edge the pointer, 12 deep, with concave joins and a rounded tip 48 below the top.
const TOP = "M5 0h74a5 5 0 0 1 5 5";
const POINTER =
  "v29.2c0 2 .8 3.25 2.2 4.6l8.4 7.41q2.6 1.74 0 3.48L86.2 57.1c-1.4 1.35-2.2 2.55-2.2 4.55v28.35";
const REST = "a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5z";

export interface DictationProps extends ComponentProps<"div"> {
  /**
   * Input level of the microphone, from 0 to 1: how far the capsule is filled from the
   * bottom. Values outside the range are clamped.
   * @default 0
   */
  level?: number;
  /**
   * The edge that carries the pointer, which faces the window being dictated into. `"none"`
   * draws the panel without one.
   * @default "right"
   */
  pointer?: "right" | "left" | "none";
  /** Called by the Done button: a click, or Return or Space while it has the focus. */
  onDone?: () => void;
  /** Called by Escape while the keyboard focus is in the panel. */
  onCancel?: () => void;
  /**
   * Title of the button that ends dictation.
   * @default "Done"
   */
  doneLabel?: ReactNode;
  /**
   * What the microphone tells assistive technology: the text of the panel's status.
   * @default "Listening"
   */
  statusLabel?: string;
}

/**
 * The Dictation feedback panel: a small translucent panel with a microphone whose capsule
 * fills with the input level, a Done button under it, and a pointer toward the window that
 * receives the text.
 *
 * It recognises no speech: the level arrives through `level` and the application ends
 * dictation in `onDone` and `onCancel`. The root is a `group` named "Dictation" (set
 * `aria-label` to change the name); `className`, `style`, `ref` and other attributes go to
 * it. The button is Base UI's Button.
 */
export function Dictation({
  level = 0,
  pointer = "right",
  onDone,
  onCancel,
  doneLabel = "Done",
  statusLabel = "Listening",
  className,
  onKeyDown,
  "aria-label": ariaLabel,
  ...props
}: DictationProps) {
  const id = useId();
  const shape = TOP + (pointer === "none" ? "v85" : POINTER) + REST;
  const fill = Math.min(Math.max(level, 0), 1) || 0;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and its own layout
    <div
      role="group"
      aria-label={ariaLabel ?? (props["aria-labelledby"] ? undefined : "Dictation")}
      data-pointer={pointer}
      className={cn("mac-dictation", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Escape" && !event.defaultPrevented) onCancel?.();
      }}
      {...props}
    >
      {/* The edge follows the pointer: a hairline outside the outline and a rim inside it. */}
      <svg className="mac-dictation-outline" viewBox="0 0 96 95" aria-hidden="true">
        <clipPath id={`${id}o`}>
          <path clipRule="evenodd" d={`M-2-2h100v99H-2z${shape}`} />
        </clipPath>
        <clipPath id={`${id}i`}>
          <path d={shape} />
        </clipPath>
        <path className="mac-dictation-hairline" clipPath={`url(#${id}o)`} d={shape} />
        <path className="mac-dictation-rim" clipPath={`url(#${id}i)`} d={shape} />
      </svg>
      <div role="status" className="mac-dictation-status">
        <span role="img" aria-label={statusLabel} className="mac-dictation-microphone">
          <span className="mac-dictation-capsule">
            <span className="mac-dictation-level" style={{ "--_level": fill } as CSSProperties} />
          </span>
          <svg className="mac-dictation-stand" viewBox="0 0 25 29" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2.45"
              d="M1.225 0v8.35a11.275 11.275 0 0 0 22.55 0V0"
            />
            <path fill="currentColor" d="M11.1 20h2.9v6.5h6V29H5v-2.5h6.1z" />
          </svg>
        </span>
      </div>
      <BaseButton className="mac-dictation-done" onClick={onDone}>
        {doneLabel}
      </BaseButton>
    </div>
  );
}
