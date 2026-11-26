"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type Ref, useState } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./disclosure-button.css";

export interface DisclosureButtonProps extends Omit<BaseButton.Props, "ref" | "children"> {
  /** Whether the content it controls is shown (controlled). The chevron points up when true. */
  expanded?: boolean;
  /**
   * Whether the content is shown at first (uncontrolled).
   * @default false
   */
  defaultExpanded?: boolean;
  /** Called with the new state when the button is activated. */
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A Catalina disclosure button (NSButton with the rounded-disclosure bezel style): a small square
 * button with a chevron that expands and collapses the view it belongs to, like the one beside
 * the Save As field of a Save dialog.
 *
 * Built on Base UI's Button. It sets `aria-expanded`; give it an `aria-label` and point
 * `aria-controls` at the element it shows and hides.
 */
export function DisclosureButton({
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  size = "regular",
  className,
  onClick,
  ...props
}: DisclosureButtonProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const isExpanded = expanded ?? uncontrolled;

  return (
    <BaseButton
      aria-expanded={isExpanded}
      data-expanded={isExpanded ? "" : undefined}
      data-size={size}
      className={withClassName("mac-disclosure-button", className)}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setUncontrolled(!isExpanded);
        onExpandedChange?.(!isExpanded);
      }}
    >
      {/* Drawn for this library: the spec's chevron, M 7 8.5 L 10 11.5 L 13 8.5 in a 20 pt
          square, flipped by CSS when expanded. */}
      <svg
        className="mac-disclosure-button-chevron"
        viewBox="0 0 20 20"
        width="20"
        height="20"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M7 8.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </BaseButton>
  );
}
