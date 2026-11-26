import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import "./tag-dot.tokens.css";
import "./tag-dot.css";

export interface TagDotProps extends ComponentProps<"span"> {
  /**
   * The Finder tag colour. `"none"` is a tag without a colour, drawn as a hollow grey ring;
   * `"all"` is the two overlapping rings of the sidebar's “All Tags…” row.
   * @default "none"
   */
  color?: "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "gray" | "none" | "all";
  /**
   * `"regular"` is the 12 pt ringed disc of a sidebar or menu row; `"small"` is the flat 10 pt
   * dot that precedes a file name.
   * @default "regular"
   */
  size?: "regular" | "small";
  /**
   * Set on a dot inside an emphasised (accent-coloured) selected row: the dot gains a white
   * ring so that it stays visible. The ring is dropped when the window is not key, as the
   * selection then loses its accent.
   * @default false
   */
  emphasized?: boolean;
}

/**
 * A Finder tag dot: the coloured disc that identifies a tag in a sidebar, a menu or a file
 * name.
 *
 * The dot is decorative unless it is named: with `aria-label` or `aria-labelledby` it becomes
 * an image, otherwise it is hidden from assistive technology and the tag name beside it carries
 * the meaning.
 */
export function TagDot({
  color = "none",
  size = "regular",
  emphasized = false,
  className,
  ...props
}: TagDotProps) {
  const named = props["aria-label"] != null || props["aria-labelledby"] != null;
  return (
    <span
      role={named ? "img" : undefined}
      aria-hidden={named ? undefined : true}
      data-color={color}
      data-size={size}
      data-emphasized={emphasized ? "" : undefined}
      className={cn("mac-tag-dot", className)}
      {...props}
    />
  );
}

export interface TagDotGroupProps extends ComponentProps<"span"> {}

/**
 * The dots of an item that carries several tags: each dot overlaps the one before it by half,
 * the last one in front. Finder shows at most three.
 */
export function TagDotGroup({ className, ...props }: TagDotGroupProps) {
  return <span className={cn("mac-tag-dot-group", className)} {...props} />;
}
