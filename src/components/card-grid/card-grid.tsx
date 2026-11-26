"use client";

import { useRender } from "@base-ui/react/use-render";
import {
  Children,
  type ComponentProps,
  type CSSProperties,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useId,
} from "react";
import { cn } from "../../lib/cn";
import "./card-grid.tokens.css";
import "./card-grid.css";

export interface CardGridProps extends Omit<ComponentProps<"section">, "title"> {
  /**
   * The section's title, at the leading edge of the header. It is rendered as a heading and
   * names the section. Without a title and an action there is no header.
   */
  title?: ReactNode;
  /**
   * What goes at the trailing edge of the header, on the title's baseline: normally a
   * `CardGridAction` titled `See All`.
   */
  action?: ReactNode;
  /**
   * `"grid"` wraps the cards onto as many rows as they need. `"shelf"` keeps them on one row
   * that scrolls sideways under the section's margins.
   * @default "grid"
   */
  layout?: "grid" | "shelf";
  /**
   * A fixed number of columns: in a grid the cards share the width, in a shelf that many
   * cards are in view at once. Without it a grid fits as many columns of at least
   * `minCardWidth` as the width allows, and the cards of a shelf are `minCardWidth` wide.
   */
  columns?: number;
  /**
   * Narrowest a card may be, as a number of points or a CSS length. Sets
   * `--mac-card-grid-min-card-width`, which is 168 pt when nothing sets it.
   */
  minCardWidth?: number | string;
  /**
   * Distance between cards, as a number of points or a CSS length. Sets
   * `--mac-card-grid-gap`, which is 20 pt when nothing sets it.
   */
  gap?: number | string;
  /**
   * Draws the 1 pt line that divides this section from the one above it.
   * @default false
   */
  separator?: boolean;
  /**
   * Level of the title's heading element, `<h2>` by default.
   * @default 2
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

const length = (value: number | string | undefined) =>
  typeof value === "number" ? `${value}px` : value;

/**
 * Keys of a focused shelf: the left and right arrow keys scroll by one card, Home and End to
 * either end. The browser's own arrow-key scrolling moves less than the snap distance and
 * snaps back. Keys pressed inside a card are the card's.
 */
function scrollShelf(event: KeyboardEvent<HTMLDivElement>) {
  const list = event.currentTarget;
  if (event.target !== list || event.altKey || event.ctrlKey || event.metaKey) return;
  const forward = getComputedStyle(list).direction === "rtl" ? -1 : 1;
  if (event.key === "Home" || event.key === "End") {
    list.scrollTo({ left: event.key === "End" ? forward * list.scrollWidth : 0 });
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const card = list.firstElementChild?.getBoundingClientRect().width ?? 0;
    const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0;
    list.scrollBy({ left: (event.key === "ArrowRight" ? 1 : -1) * (card + gap) });
  } else return;
  event.preventDefault();
}

/**
 * One section of a store or media page (the collection views of TV, Music, Podcasts and the
 * App Store): a header with a title and an optional action, then its cards in a wrapping grid
 * or on a shelf that scrolls sideways.
 *
 * Renders a `<section>` named by its title. The cards are a list: each child is wrapped in a
 * list item, so pass the cards as direct children (an array is fine, a fragment counts as one
 * item). Other props, `ref` included, go to the section.
 */
export function CardGrid({
  title,
  action,
  layout = "grid",
  columns,
  minCardWidth,
  gap,
  separator = false,
  headingLevel = 2,
  className,
  style,
  children,
  "aria-labelledby": labelledBy,
  ...props
}: CardGridProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const titled = title != null && title !== false;
  return (
    <section
      aria-labelledby={labelledBy ?? (titled ? id : undefined)}
      data-separator={separator ? "" : undefined}
      {...props}
      className={cn("mac-card-grid", className)}
      style={
        {
          "--mac-card-grid-columns": columns,
          "--mac-card-grid-min-card-width": length(minCardWidth),
          "--mac-card-grid-gap": length(gap),
          ...style,
        } as CSSProperties
      }
    >
      {(titled || action) && (
        <div className="mac-card-grid-header">
          {titled && (
            <Heading id={id} className="mac-card-grid-title">
              {title}
            </Heading>
          )}
          {action}
        </div>
      )}
      {/* A shelf is a scroll container: it takes keyboard focus and scrolls with the arrow
          keys, also when its cards are static, and it is named after the section. */}
      {/* biome-ignore lint/a11y/useSemanticElements: a <ul> would restrict the cards to <li> children; the roles give the same list without it */}
      <div
        role="list"
        className="mac-card-grid-list"
        data-layout={layout}
        data-columns={columns}
        tabIndex={layout === "shelf" ? 0 : undefined}
        onKeyDown={layout === "shelf" ? scrollShelf : undefined}
        aria-labelledby={layout === "shelf" ? (labelledBy ?? (titled ? id : undefined)) : undefined}
        aria-label={layout === "shelf" ? props["aria-label"] : undefined}
      >
        {Children.toArray(children).map((child, index) => (
          // biome-ignore lint/a11y/useSemanticElements: see the list above
          <div
            role="listitem"
            className="mac-card-grid-item"
            key={isValidElement(child) ? child.key : index}
          >
            {child}
          </div>
        ))}
      </div>
    </section>
  );
}

export interface CardGridActionProps extends Omit<useRender.ComponentProps<"a">, "ref"> {
  /** Address the action opens. Without it, render a button instead (see `render`). */
  href?: string;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * The action of a section's header, such as `See All`: text in the store's link blue.
 *
 * Renders an `<a>`; give it `href`. For an action that is not a navigation, render a button
 * with Base UI's `render` prop: `render={<button type="button" />}`.
 */
export function CardGridAction({ className, render, ref, ...props }: CardGridActionProps) {
  return useRender({
    defaultTagName: "a",
    render,
    ref,
    props: { ...props, className: cn("mac-card-grid-action", className) },
  });
}

export interface CardGridCardProps
  extends Omit<useRender.ComponentProps<"div">, "title" | "children" | "ref"> {
  /**
   * The measured card families. `"landscape"` is TV's 16:9 artwork card (11 pt corners, hairline
   * edge, shadow). `"square"` is Music's album cell (4 pt corners, two 13 pt lines).
   * `"episode"` is Podcasts' card (3 pt corners, soft shadow, caption above the title, a
   * description of up to three lines, a footnote). `"lockup"` is the App Store's row: a 50 pt
   * icon, title and subtitle beside it, an accessory at the trailing edge and a line below.
   * @default "landscape"
   */
  variant?: "landscape" | "square" | "episode" | "lockup";
  /**
   * The picture: an `<img>`, an image view or anything drawn. It fills the artwork box and is
   * clipped to its corners; give an `<img>` `width: 100%`, `height: 100%` and
   * `object-fit: cover`. The library ships no artwork.
   */
  artwork?: ReactNode;
  /** First line of text: the name of the item. */
  title?: ReactNode;
  /** Second line, in the secondary text colour: an artist, a tagline, a description. */
  subtitle?: ReactNode;
  /** A short line above the title, set in small capitals (`New · Sunday`). */
  caption?: ReactNode;
  /** A last line under the subtitle, such as a duration. */
  footnote?: ReactNode;
  /**
   * A control at the trailing edge of a lockup, centred on its icon: the offer button. Only
   * the `"lockup"` variant places it. Do not render a lockup that has one as a link or a
   * button; make its title the link instead.
   */
  accessory?: ReactNode;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * One card of a `CardGrid`: an artwork box and the lines of text that belong to it.
 *
 * Renders a `<div>`, which is not interactive. Base UI's `render` prop makes the whole card a
 * link or a button: `render={<a href="…" />}` or `render={<button type="button" />}`. Other
 * props, `ref` included, go to that element. A card without a `title` needs an `aria-label`
 * when it is a link or a button. With `aria-disabled="true"` the card stays in the tab order,
 * looks disabled and ignores activation: a click on it or in it does nothing, and neither do
 * Enter and Space pressed on it. What is inside the card is not disabled with it.
 */
export function CardGridCard({
  variant = "landscape",
  artwork,
  title,
  subtitle,
  caption,
  footnote,
  accessory,
  className,
  render,
  ref,
  ...props
}: CardGridCardProps) {
  // Spans throughout: the card may be rendered as a link or a button.
  const line = (part: string, content: ReactNode) =>
    content != null && content !== false ? (
      <span className={`mac-card-grid-card-${part}`}>{content}</span>
    ) : null;
  const text = [
    line("caption", caption),
    line("title", title),
    line("subtitle", subtitle),
    line("footnote", footnote),
  ];
  // Activation of a card with `aria-disabled`: a click on it or in it, Enter or Space pressed
  // on it. Stopped in the capture phase and read from the element, so that it holds on
  // whatever element the card is rendered as, and also when `aria-disabled` or the handler is
  // given on the `render` element. Nothing else is kept from what is inside the card.
  type Activation = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
  const guard = (own?: (event: never) => void) => (event: Activation) => {
    const card = event.currentTarget;
    const key = "key" in event ? event.key : null;
    if (
      card.getAttribute("aria-disabled") === "true" &&
      (key === null || (event.target === card && (key === "Enter" || key === " ")))
    ) {
      if (key === null) event.preventDefault();
      event.stopPropagation();
    } else own?.(event as never);
  };
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      "data-variant": variant,
      ...props,
      onClickCapture: guard(props.onClickCapture),
      onKeyDownCapture: guard(props.onKeyDownCapture),
      onKeyUpCapture: guard(props.onKeyUpCapture),
      className: cn("mac-card-grid-card", className),
      children: (
        <>
          <span className="mac-card-grid-card-artwork">{artwork}</span>
          {text.some(Boolean) && (
            <span className="mac-card-grid-card-text">
              {text[0]}
              {text[1]}
              {text[2]}
              {text[3]}
            </span>
          )}
          {line("accessory", accessory)}
        </>
      ),
    },
  });
}
