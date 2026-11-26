"use client";

import { type ComponentProps, type KeyboardEvent, type ReactNode, useMemo, useRef } from "react";
import { cn } from "../../lib/cn";
import { DesktopContext } from "../../lib/desktop-context";
import { type TypeSelectState, typeSelect } from "../../lib/type-select";
import { useControlled } from "../../lib/use-controlled";
import "./desktop.tokens.css";
import "./desktop.css";

const NONE: readonly string[] = [];

export interface DesktopProps extends Omit<ComponentProps<"div">, "defaultValue" | "onChange"> {
  /**
   * The desktop picture: an image or any element, stretched over the whole desktop behind the
   * icons. Decorative. Without one the desktop shows a plain gradient of its own.
   */
  picture?: ReactNode;
  /** The values of the selected icons, when you control the selection. */
  value?: readonly string[];
  /**
   * The values of the icons that start selected, when you do not control the selection.
   * @default []
   */
  defaultValue?: readonly string[];
  /** Called with the new selection when a click or the keyboard changes it. */
  onValueChange?: (value: readonly string[]) => void;
}

/**
 * The bottom layer of the screen: the desktop picture and Finder's grid of icons, filled from
 * the top of the trailing edge downward. Its children are `DesktopIcon`s and `DesktopStack`s.
 */
export function Desktop({
  picture,
  value,
  defaultValue = NONE,
  onValueChange,
  className,
  children,
  onPointerDown,
  onKeyDown,
  ...props
}: DesktopProps) {
  const [selected, setSelected] = useControlled(value, defaultValue, onValueChange);
  const typed = useRef<TypeSelectState>({ text: "", time: 0 });

  const context = useMemo(
    () => ({
      selected,
      select: (item: string, extend: boolean) =>
        setSelected(
          !extend
            ? [item]
            : selected.includes(item)
              ? selected.filter((other) => other !== item)
              : [...selected, item],
        ),
    }),
    [selected, setSelected],
  );

  // Arrow keys move through the grid as it is laid out, Home and End go to its ends, and
  // typing goes to the item whose name starts with what was typed. Each moves the keyboard
  // focus and, as in Finder, the selection with it.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    // Only this desktop's own icons take part, and only a key pressed on one of them: a key
    // pressed in a window or a Dock on the desktop is theirs.
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        ":scope > .mac-desktop-icon:not(:disabled)",
      ),
    ];
    const at = items.indexOf(event.target as HTMLElement);
    if (at < 0) return;
    const { key } = event;
    let next: HTMLElement | undefined;
    if (key === "ArrowDown") next = items[at + 1];
    else if (key === "ArrowUp") next = items[at - 1];
    else if (key === "Home") next = items[0];
    else if (key === "End") next = items.at(-1);
    else if (key === "ArrowLeft" || key === "ArrowRight") {
      // The nearest item of the same row in that direction: read from the layout, once.
      const from = items[at]?.getBoundingClientRect();
      let best = Number.POSITIVE_INFINITY;
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        const distance =
          key === "ArrowLeft" ? (from?.left ?? 0) - rect.left : rect.left - (from?.left ?? 0);
        if (from && rect.top === from.top && distance > 0 && distance < best) {
          best = distance;
          next = item;
        }
      }
    } else {
      const label = (index: number) => items[index]?.textContent ?? "";
      next = items[typeSelect(typed.current, event, items.length, label, at)];
      if (!next) return;
    }
    event.preventDefault();
    if (!next) return;
    next.focus();
    setSelected([next.dataset.value ?? ""]);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring form semantics; this is the group of items on the desktop.
    <div
      role="group"
      aria-label="Desktop"
      className={cn("mac-desktop", className)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        // A press of the primary button on the picture, not on an item, deselects everything.
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          event.target === event.currentTarget &&
          selected.length > 0
        )
          setSelected(NONE);
      }}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {picture ? (
        <div className="mac-desktop-picture" aria-hidden="true">
          {picture}
        </div>
      ) : null}
      <DesktopContext value={context}>{children}</DesktopContext>
    </div>
  );
}
