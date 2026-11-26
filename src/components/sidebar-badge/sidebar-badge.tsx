import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import "./sidebar-badge.tokens.css";
import "./sidebar-badge.css";

export interface SidebarBadgeProps extends ComponentProps<"span"> {
  /**
   * `"pill"` is the filled capsule with knocked-out digits (Mail's unread count, an NSButton
   * with the inline bezel); `"plain"` is a bare right-aligned number (Notes, Reminders).
   * @default "pill"
   */
  variant?: "pill" | "plain";
  /**
   * Set when the row that holds the badge is selected.
   * @default false
   */
  selected?: boolean;
  /**
   * Set, together with `selected`, when the row's selection is drawn in the accent colour (a
   * list with keyboard focus). The badge falls back to the unemphasised look when the window
   * is not key.
   * @default false
   */
  emphasized?: boolean;
}

/**
 * The count at the trailing edge of a sidebar or list row: unread messages, drafts, items in a
 * list.
 *
 * It is plain text for assistive technology and is not interactive. Put it inside the row so
 * that the count is part of the row's accessible name, or give the row an `aria-label` that
 * says what is counted (“Drafts, 1 item”).
 */
export function SidebarBadge({
  variant = "pill",
  selected = false,
  emphasized = false,
  className,
  ...props
}: SidebarBadgeProps) {
  return (
    <span
      data-variant={variant}
      data-selected={selected ? "" : undefined}
      data-emphasized={selected && emphasized ? "" : undefined}
      className={cn("mac-sidebar-badge", className)}
      {...props}
    />
  );
}
