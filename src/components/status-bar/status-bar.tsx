import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import "./status-bar.tokens.css";
import "./status-bar.css";

export interface StatusBarProps extends ComponentProps<"div"> {
  /**
   * Which bottom bar to draw.
   *
   * - `"information"`: Finder's status bar, 23 pt, small centred text (item count, free
   *   space). Provisional: no reference screenshot shows it.
   * - `"gradient"`: a 21 pt command strip on a gradient, as at the bottom of Automator.
   * - `"flat"`: a 23 pt flat command strip under a hairline, as in Script Editor.
   * - `"breadcrumb"`: a 21 pt flat strip with a 12 pt label, as in System Information.
   * @default "information"
   */
  variant?: "information" | "gradient" | "flat" | "breadcrumb";
  /** Content at the leading edge: the buttons of a command strip, or an icon and a breadcrumb. */
  leading?: ReactNode;
  /** Content at the trailing edge, such as Finder's icon-size slider. */
  trailing?: ReactNode;
}

/**
 * The bar at the bottom of a window, below the body. `children` are centred in the bar; in the
 * `"information"` variant they are a live region (`role="status"`, `aria-live="polite"`), so a
 * changed item count is announced.
 */
export function StatusBar({
  variant = "information",
  leading,
  trailing,
  className,
  children,
  ...props
}: StatusBarProps) {
  const live = variant === "information";
  return (
    <div data-variant={variant} className={cn("mac-status-bar", className)} {...props}>
      {leading != null && leading !== false ? (
        <div className="mac-status-bar-leading">{leading}</div>
      ) : null}
      <div
        className="mac-status-bar-center"
        role={live ? "status" : undefined}
        aria-live={live ? "polite" : undefined}
      >
        {children}
      </div>
      {trailing != null && trailing !== false ? (
        <div className="mac-status-bar-trailing">{trailing}</div>
      ) : null}
    </div>
  );
}
