"use client";

import { useRender } from "@base-ui/react/use-render";
import type { ReactNode, Ref } from "react";
import { cn } from "../../lib/cn";
import "./editorial-card.tokens.css";
import "./editorial-card.css";

export interface EditorialCardProps
  extends Omit<useRender.ComponentProps<"div">, "title" | "children" | "ref"> {
  /**
   * `"panel"` is the App Store's editorial card: a tinted panel with its text at the leading
   * edge and round artwork at the trailing edge. `"hero"` is the banner at the top of a store
   * page: the artwork fills the card and the text lies over its leading top corner.
   * @default "panel"
   */
  variant?: "panel" | "hero";
  /**
   * Draws a hero as TV does: larger corners, a hairline edge and a drop shadow, in TV's
   * proportions. The App Store's hero is flat. Has no effect on a panel.
   * @default false
   */
  raised?: boolean;
  /** A short line above the title, set in small capitals: `Collection`, `Get Started`. */
  eyebrow?: ReactNode;
  /** The headline. */
  title?: ReactNode;
  /**
   * Makes the title a heading of this level for assistive technology (`role="heading"` with
   * `aria-level`). Leave it out when the card is a button, whose content is read as its name.
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** The text under the title: one or two sentences. */
  children?: ReactNode;
  /**
   * The picture: an `<img>`, an image view or anything drawn. A panel clips it to a circle, a
   * hero to the card; give an `<img>` `width: 100%`, `height: 100%` and `object-fit: cover`.
   * The library ships no artwork.
   */
  artwork?: ReactNode;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A feature of a store page (App Store, TV): an editorial panel, or the hero banner above the
 * sections. `CardGrid` holds the smaller cards under them.
 *
 * No AppKit class draws it and Base UI has no primitive, so it is a styled `<div>`, which is
 * not interactive. Base UI's `render` prop makes the whole card a link or a button:
 * `render={<a href="…" />}` or `render={<button type="button" />}`. Other props, `ref`
 * included, go to that element. A card without a `title` needs an `aria-label` when it is a
 * link or a button.
 */
export function EditorialCard({
  variant = "panel",
  raised = false,
  eyebrow,
  title,
  headingLevel,
  artwork,
  className,
  render,
  ref,
  children,
  ...props
}: EditorialCardProps) {
  // Spans throughout: the card may be rendered as a link or a button. The spaces between
  // them keep the words apart in the card's accessible name.
  const line = (part: string, content: ReactNode, level?: number) =>
    content != null && content !== false ? (
      <>
        <span
          className={`mac-editorial-card-${part}`}
          {...(level ? { role: "heading", "aria-level": level } : null)}
        >
          {content}
        </span>{" "}
      </>
    ) : null;
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      "data-variant": variant,
      "data-raised": raised && variant === "hero" ? "" : undefined,
      ...props,
      className: cn("mac-editorial-card", className),
      children: (
        <>
          <span className="mac-editorial-card-text">
            {line("eyebrow", eyebrow)}
            {line("title", title, headingLevel)}
            {line("body", children)}
          </span>
          {line("artwork", artwork)}
        </>
      ),
    },
  });
}
