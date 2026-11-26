import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import "./new-item-dot.tokens.css";
import "./new-item-dot.css";

export interface NewItemDotProps extends ComponentProps<"span"> {
  /**
   * Whether the dot is drawn. A hidden dot keeps its place in the layout, so the rows of a
   * list stay aligned when only some of them are new.
   * @default true
   */
  visible?: boolean;
}

/**
 * The small blue dot that marks a new or unseen item in a list (the Extensions pane of System
 * Preferences shows one).
 *
 * The dot is decorative unless it is named: with `aria-label` or `aria-labelledby` it becomes
 * an image, otherwise it is hidden from assistive technology and the item's own text must say
 * that it is new.
 */
export function NewItemDot({ visible = true, className, ...props }: NewItemDotProps) {
  const named = visible && (props["aria-label"] != null || props["aria-labelledby"] != null);
  return (
    <span
      role={named ? "img" : undefined}
      aria-hidden={named ? undefined : true}
      data-visible={visible ? "" : undefined}
      className={cn("mac-new-item-dot", className)}
      {...props}
    />
  );
}
