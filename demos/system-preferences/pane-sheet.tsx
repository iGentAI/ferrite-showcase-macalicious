"use client";

import { Sheet, SheetPopup, SheetTitle } from "macalicious/sheet";
import type { KeyboardEvent, ReactNode } from "react";

/** The height of the window's title bar, from which its sheets hang. */
const TITLE_BAR = 38;

/** Tab goes round the sheet's controls: in a browser it otherwise leaves past the last one. */
function keepTabInside(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const controls = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      'input:not(:disabled), button:not(:disabled), [tabindex="0"]:not([aria-disabled="true"])',
    ),
  ];
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) return;
  const edge = event.shiftKey ? first : last;
  if (document.activeElement !== edge) return;
  event.preventDefault();
  (event.shiftKey ? last : first).focus();
}

/** A sheet of the window `frame`, which holds the keyboard and the pointer until it is answered. */
export function PaneSheet({
  frame,
  title,
  width = 460,
  onClose,
  children,
}: {
  frame: Element;
  title: string;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleBar = {
    getBoundingClientRect: () => {
      const { x, y, width: wide } = frame.getBoundingClientRect();
      return new DOMRect(x, y, wide, TITLE_BAR);
    },
  };
  return (
    <Sheet open modal onOpenChange={(open) => open || onClose()}>
      <SheetPopup anchor={titleBar} width={width} onKeyDown={keepTabInside}>
        <SheetTitle>{title}</SheetTitle>
        {children}
      </SheetPopup>
    </Sheet>
  );
}
