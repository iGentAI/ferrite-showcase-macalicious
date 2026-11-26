import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import "./status-dot.tokens.css";
import "./status-dot.css";

export interface StatusDotProps extends ComponentProps<"span"> {
  /**
   * What the dot reports, named after AppKit's status images: `"available"` is green
   * (NSStatusAvailable), `"partially-available"` yellow, `"unavailable"` red and `"none"` grey.
   * @default "none"
   */
  status?: "available" | "partially-available" | "unavailable" | "none";
  /**
   * Diameter: `"regular"` is the 10 pt dot of list rows and status lines, `"small"` the 6 pt
   * dot of a row's subtitle.
   * @default "regular"
   */
  size?: "regular" | "small";
}

/**
 * A status dot (NSImageView showing NSStatusAvailable and its siblings): a small coloured disc
 * that reports the state of a service or device.
 *
 * The dot is decorative unless it is named: with `aria-label` or `aria-labelledby` it becomes
 * an image, otherwise it is hidden from assistive technology and the text beside it carries
 * the state.
 */
export function StatusDot({
  status = "none",
  size = "regular",
  className,
  ...props
}: StatusDotProps) {
  const named = props["aria-label"] != null || props["aria-labelledby"] != null;
  return (
    <span
      role={named ? "img" : undefined}
      aria-hidden={named ? undefined : true}
      data-status={status}
      data-size={size}
      className={cn("mac-status-dot", className)}
      {...props}
    />
  );
}
