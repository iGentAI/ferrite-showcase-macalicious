"use client";

import { useRender } from "@base-ui/react/use-render";
import type { ReactNode, Ref } from "react";
import { cn } from "../../lib/cn";
import "./story-card.tokens.css";
import "./story-card.css";

export interface StoryCardProps
  extends Omit<useRender.ComponentProps<"div">, "title" | "children" | "ref"> {
  /**
   * `"lead"` is a top story of News: a large picture with the publisher, the headline and the
   * story's age under it. `"secondary"` is the smaller story under those: the text at the
   * leading edge and a square thumbnail at the trailing edge.
   * @default "lead"
   */
  variant?: "lead" | "secondary";
  /**
   * The picture: an `<img>` or anything drawn. It is cropped to the card's picture box
   * (`object-fit: cover`). The library ships no artwork.
   */
  artwork?: ReactNode;
  /**
   * The publisher: its logo, as an `<img>` or an `<svg>` with a text alternative, or its name
   * as text, which is set in small bold capitals.
   */
  publisher?: ReactNode;
  /** The headline, on at most three lines. */
  title?: ReactNode;
  /**
   * Makes the headline a heading of this level for assistive technology (`role="heading"`
   * with `aria-level`). Leave it out when the card is a button, whose content is read as its
   * name.
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** The story's age, under the headline: `1h ago`. */
  time?: ReactNode;
  /**
   * Marks a video story: a round play badge over the middle of the picture. The badge is a
   * drawing only; say in the headline or in an `aria-label` that the story is a video.
   * @default false
   */
  video?: boolean;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A story in News: its picture, the publisher, the headline and the story's age.
 *
 * News draws it itself (a collection view cell through Mac Catalyst) and Base UI has no
 * primitive, so it is a styled `<div>`, which is not interactive. Base UI's `render` prop
 * makes the whole card a link or a button: `render={<a href="…" />}` or
 * `render={<button type="button" />}`. Other props, `ref` included, go to that element.
 */
export function StoryCard({
  variant = "lead",
  artwork,
  publisher,
  title,
  headingLevel,
  time,
  video = false,
  className,
  render,
  ref,
  ...props
}: StoryCardProps) {
  // Spans throughout: the card may be rendered as a link or a button. The spaces between
  // them keep the words apart in the card's accessible name.
  const line = (part: string, content: ReactNode, level?: number) =>
    content != null && content !== false ? (
      <>
        <span
          className={`mac-story-card-${part}`}
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
      "data-video": video ? "" : undefined,
      ...props,
      className: cn("mac-story-card", className),
      children: (
        <>
          <span className="mac-story-card-text">
            {line("publisher", publisher)}
            {line("title", title, headingLevel)}
            {line("time", time)}
          </span>
          {line("artwork", artwork)}
        </>
      ),
    },
  });
}
