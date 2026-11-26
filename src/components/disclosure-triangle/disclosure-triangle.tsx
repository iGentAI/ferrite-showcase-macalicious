"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { type Ref, useState } from "react";
import { withClassName } from "../../lib/cn";
import "./disclosure-triangle.css";

export interface DisclosureTriangleProps extends Omit<BaseButton.Props, "ref" | "children"> {
  /** Whether the content it controls is shown (controlled). The triangle points down when true. */
  expanded?: boolean;
  /**
   * Whether the content is shown at first (uncontrolled).
   * @default false
   */
  defaultExpanded?: boolean;
  /** Called with the new state when the triangle is activated. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A Catalina disclosure triangle (NSButton with the disclosure bezel style): points right while
 * its content is hidden and down while it is shown.
 *
 * Built on Base UI's Button. It sets `aria-expanded`; name it with `aria-label` or
 * `aria-labelledby` and point `aria-controls` at the content it shows and hides.
 */
export function DisclosureTriangle({
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  className,
  onClick,
  ...props
}: DisclosureTriangleProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const isExpanded = expanded ?? uncontrolled;

  return (
    <BaseButton
      aria-expanded={isExpanded}
      data-expanded={isExpanded ? "" : undefined}
      className={withClassName("mac-disclosure-triangle", className)}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setUncontrolled(!isExpanded);
        onExpandedChange?.(!isExpanded);
      }}
    >
      {/* The measured collapsed triangle, 7.5 x 9 pt, in AppKit's 13 pt frame. CSS turns it a
          quarter turn when expanded, which gives the measured 9 x 7.5 pt box. */}
      <svg
        className="mac-disclosure-triangle-glyph"
        viewBox="0 0 13 13"
        width="13"
        height="13"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M3 2l7.5 4.5L3 11z" fill="currentColor" />
      </svg>
    </BaseButton>
  );
}
