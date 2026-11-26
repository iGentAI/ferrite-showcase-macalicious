"use client";

import { type ComponentProps, type MouseEvent, type ReactNode, useId, useRef } from "react";
import { cn } from "../../lib/cn";
import { Checkbox, type CheckboxProps } from "../checkbox";
import "./gesture-option-row.tokens.css";
import "./gesture-option-row.css";

export interface GestureOptionRowProps
  extends Omit<ComponentProps<"div">, "title" | "children" | "onChange"> {
  /** The gesture's name, on the first line. It names the checkbox; clicking it toggles it. */
  title: ReactNode;
  /**
   * The second line: a short description of the gesture, or a control that chooses how it is
   * made, such as a borderless pull-down button. Text here becomes the checkbox's description.
   */
  detail?: ReactNode;
  /**
   * Draws the pointed callout behind the row, which marks the gesture the preview beside the
   * list is showing. It is independent of `checked`.
   * @default false
   */
  highlighted?: boolean;
  /** Whether the gesture is on (controlled). */
  checked?: boolean;
  /** Whether the gesture is on at first (uncontrolled). */
  defaultChecked?: boolean;
  /** Called when the user turns the gesture on or off. */
  onCheckedChange?: CheckboxProps["onCheckedChange"];
  /**
   * Disables the checkbox and dims the row's text. A control in `detail` is disabled by its
   * own prop.
   * @default false
   */
  disabled?: boolean;
  /** Name of the checkbox when the row is part of a form. */
  name?: string;
  /** Value submitted with the form while the checkbox is on. */
  value?: string;
}

/**
 * One gesture of the Mouse and Trackpad panes: a checkbox centred against two lines, the
 * gesture's name over a description or a choice, and, on the row whose gesture the preview
 * shows, a callout that points at the preview.
 *
 * AppKit has no class for it. The checkbox is the library's `Checkbox` (Base UI's Checkbox);
 * the row is a plain `<div>`, which takes the remaining props, so `onPointerEnter` and
 * `onFocus` are where to move the highlight.
 */
export function GestureOptionRow({
  title,
  detail,
  highlighted = false,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  name,
  value,
  className,
  ...props
}: GestureOptionRowProps) {
  const id = useId();
  const checkbox = useRef<HTMLElement>(null);
  const hasDetail = detail != null && detail !== false;
  // The title acts as the checkbox's label: a click on it toggles the checkbox and leaves
  // focus there, as a click on the checkbox does.
  const toggle = (event: MouseEvent) => {
    if (disabled) return;
    // The click goes on from the checkbox: the row's own onClick must hear one click, not two.
    event.stopPropagation();
    checkbox.current?.focus();
    checkbox.current?.click();
  };
  return (
    <div
      data-highlighted={highlighted ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      {...props}
      className={cn("mac-gesture-option-row", className)}
    >
      <Checkbox
        ref={checkbox}
        className="mac-gesture-option-row-checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        name={name}
        value={value}
        aria-labelledby={`${id}t`}
        aria-describedby={hasDetail ? `${id}d` : undefined}
      />
      <div className="mac-gesture-option-row-text">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the title acts as the checkbox's label; the checkbox itself is the keyboard target */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: as above, Space on the checkbox does the same */}
        <span className="mac-gesture-option-row-title" id={`${id}t`} onClick={toggle}>
          {title}
        </span>
        {hasDetail ? (
          <span className="mac-gesture-option-row-detail" id={`${id}d`}>
            {detail}
          </span>
        ) : null}
      </div>
    </div>
  );
}
