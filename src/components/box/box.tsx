"use client";

import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "../../lib/cn";
import { Label } from "../label";
import "./box.tokens.css";
import "./box.css";

export interface BoxProps extends Omit<ComponentProps<"div">, "title"> {
  /**
   * Title of the box, in sentence case and without a trailing colon. It names the group for
   * assistive technology. Leave it out for an untitled box.
   */
  title?: ReactNode;
  /**
   * Where the title sits (NSBox.titlePosition).
   * @default "above"
   */
  titlePosition?: "above" | "below";
  /**
   * `"group"` is the standard box: the window background tinted by about 4%, with a hairline
   * border. `"content"` is the opaque content well (white in Aqua) with a 1 pt border and
   * square corners that System Preferences uses for a pane's main list or chart. `"well"` is
   * the rounded well of Activity Monitor's summary: an opaque fill (white in Aqua, lighter
   * than the window in Dark Aqua) with a 1 pt border and 4.5 pt corners.
   * @default "group"
   */
  variant?: "group" | "content" | "well";
  /**
   * Which edges are drawn. `"all"` is a rounded box; `"horizontal"` is a full-bleed band with
   * only a top and a bottom edge; `"leading"` is a detail region that fills the rest of a
   * window, with only its leading edge.
   * @default "all"
   */
  edges?: "all" | "horizontal" | "leading";
}

/**
 * A box (NSBox): a bordered, lightly tinted surface that groups related controls, with an
 * optional title.
 *
 * The root is a `group` named by the title. `className`, `style` and other attributes go to
 * the root; the children are rendered inside the surface, whose padding is
 * `--mac-box-padding`.
 */
export function Box({
  title,
  titlePosition = "above",
  variant = "group",
  edges = "all",
  className,
  children,
  ...props
}: BoxProps) {
  const titleId = useId();
  const hasTitle = title != null && title !== false;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot place its legend below the box or outside the border
    <div
      role="group"
      aria-labelledby={hasTitle ? titleId : undefined}
      data-variant={variant}
      data-edges={edges}
      data-title-position={hasTitle ? titlePosition : undefined}
      className={cn("mac-box", className)}
      {...props}
    >
      {hasTitle && (
        <Label id={titleId} className="mac-box-title">
          {title}
        </Label>
      )}
      <div className="mac-box-content">{children}</div>
    </div>
  );
}
