"use client";

import {
  type ComponentProps,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
} from "react";
import { cn } from "../../lib/cn";
import "./toolbar-labelled-item.tokens.css";
import "./toolbar-labelled-item.css";

type Nameable = { "aria-label"?: string; "aria-labelledby"?: string };

export interface ToolbarLabelledItemProps extends ComponentProps<"div"> {
  /** The item's label, shown under the control in the toolbar's icon-and-label mode. */
  label: ReactNode;
  /**
   * Draw the label dimmed. A label dims by itself when its control is disabled; set this for a
   * control that reports that differently.
   * @default false
   */
  disabled?: boolean;
  /** One toolbar control: a button, a segmented control or a pull-down button. */
  children: ReactNode;
}

/**
 * A toolbar item with its label (NSToolbarItem.label): one toolbar control with an 11 pt label
 * centred beneath it.
 *
 * The label is the control's accessible name: unless the control has an `aria-label` or
 * `aria-labelledby` of its own, it is given `aria-labelledby` pointing at the label, so it is
 * named in every display mode of the toolbar, also when the label is not displayed. The label
 * is not a second focus stop.
 */
export function ToolbarLabelledItem({
  label,
  disabled = false,
  className,
  children,
  ...props
}: ToolbarLabelledItemProps) {
  const labelId = useId();
  let control = children;
  if (isValidElement(children)) {
    const child = children as ReactElement<Nameable>;
    if (!child.props["aria-label"] && !child.props["aria-labelledby"]) {
      control = cloneElement(child, { "aria-labelledby": labelId });
    }
  }

  return (
    <div
      data-disabled={disabled ? "" : undefined}
      className={cn("mac-toolbar-labelled-item", className)}
      {...props}
    >
      {control}
      <span id={labelId} className="mac-toolbar-labelled-item-label">
        {label}
      </span>
    </div>
  );
}
