"use client";

import { useRender } from "@base-ui/react/use-render";
import type { ReactNode, Ref } from "react";
import { cn } from "../../lib/cn";
import "./book-cover.tokens.css";
import "./book-cover.css";

export interface BookCoverProps extends Omit<useRender.ComponentProps<"div">, "children" | "ref"> {
  /**
   * The cover's picture: an `<img>` or anything drawn. It is stretched over the cell and an
   * `<img>` is cropped to it (`object-fit: cover`). The library ships no artwork.
   */
  children?: ReactNode;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A book in the Books library: the cover's picture with square corners and a soft shadow on
 * the page, 145.5 x 190 pt unless the variables say otherwise.
 *
 * Books draws it itself (a collection view item) and Base UI has no primitive, so it is a
 * styled `<div>`, which is not interactive. Base UI's `render` prop makes the cover a link or
 * a button: `render={<a href="…" />}` or `render={<button type="button" />}`. Other props,
 * `ref` included, go to that element. Name it with `aria-label`, or with the picture's `alt`.
 */
export function BookCover({ className, render, ref, ...props }: BookCoverProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: { ...props, className: cn("mac-book-cover", className) },
  });
}
