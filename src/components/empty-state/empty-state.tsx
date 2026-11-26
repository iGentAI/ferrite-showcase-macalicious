"use client";

import { useRender } from "@base-ui/react/use-render";
import { cn } from "../../lib/cn";
import "./empty-state.tokens.css";
import "./empty-state.css";

export interface EmptyStateProps extends useRender.ComponentProps<"div"> {
  /**
   * `"plain"` is large secondary text with no background (“No Selection”). `"capsule"` sets
   * the text in a grey capsule, as Automator's empty workflow area does.
   * @default "plain"
   */
  variant?: "plain" | "capsule";
}

/**
 * Placeholder text for a content area that has nothing to show: what the area is for, or what
 * to do to fill it.
 *
 * It fills its parent and centres its text both ways, so put it in the empty pane itself.
 * Renders a `<div>`; Base UI's `render` prop renders another element. It is static text: give
 * it `role="status"` when it appears as the result of an action, such as an empty search.
 */
export function EmptyState({
  variant = "plain",
  className,
  render,
  ref,
  children,
  ...props
}: EmptyStateProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      "data-variant": variant,
      ...props,
      className: cn("mac-empty-state", className),
      children: <span className="mac-empty-state-text">{children}</span>,
    },
  });
}
