"use client";

import { type ComponentProps, type ReactNode, use } from "react";
import { cn } from "../../lib/cn";
import { DesktopContext } from "../../lib/desktop-context";
import { useControlled } from "../../lib/use-controlled";
import "./desktop-icon.tokens.css";
import "./desktop-icon.css";

export interface DesktopIconProps extends Omit<ComponentProps<"button">, "value"> {
  /**
   * The artwork: an image, an SVG or any element, drawn in the 64 pt tile above the label.
   * Decorative; the label names the item.
   */
  icon: ReactNode;
  /**
   * What identifies the item in the selection of the `Desktop` it is on. Defaults to the label
   * when the label is plain text.
   */
  value?: string;
  /** Whether the item is selected, when you control it. On a `Desktop` the desktop decides. */
  selected?: boolean;
  /**
   * Whether the item starts selected, when you do not control it.
   * @default false
   */
  defaultSelected?: boolean;
  /** Called when a click or the keyboard changes the selection of an item that is not on a `Desktop`. */
  onSelectedChange?: (selected: boolean) => void;
  /** Called when the item is opened: a double click, Return, Command-O or Command-Down. */
  onOpen?: () => void;
  /**
   * Draws the artwork at half strength, as Finder does for a hidden or cut item.
   * @default false
   */
  dimmed?: boolean;
}

/** A volume, file or folder on the desktop: a 64 pt icon with its name below it. */
export function DesktopIcon({
  icon,
  value,
  selected,
  defaultSelected = false,
  onSelectedChange,
  onOpen,
  dimmed = false,
  className,
  children,
  onClick,
  onDoubleClick,
  onKeyDown,
  ...props
}: DesktopIconProps) {
  const desktop = use(DesktopContext);
  const id = value ?? (typeof children === "string" ? children : "");
  const [own, setOwn] = useControlled(selected, defaultSelected, onSelectedChange);
  const isSelected = desktop ? desktop.selected.includes(id) : own;

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      data-value={id}
      data-selected={isSelected ? "" : undefined}
      data-dimmed={dimmed ? "" : undefined}
      className={cn("mac-desktop-icon", className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        // On a desktop a click selects this item alone, and Command or Shift adds or removes
        // it, as does Space (a click from the keyboard, which has no click count); on its own
        // the item is a toggle.
        if (desktop)
          desktop.select(
            id,
            event.metaKey || event.ctrlKey || event.shiftKey || event.detail === 0,
          );
        else setOwn(!isSelected);
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        if (!event.defaultPrevented) onOpen?.();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || !onOpen) return;
        const command = event.metaKey || event.ctrlKey;
        if (
          (event.key === "Enter" && !command) ||
          (command && (event.key === "o" || event.key === "ArrowDown"))
        ) {
          // Return would also click the button; opening is all it does here.
          event.preventDefault();
          onOpen();
        }
      }}
      {...props}
    >
      <span className="mac-desktop-icon-image" aria-hidden="true">
        {icon}
      </span>
      <span className="mac-desktop-icon-label">
        <span className="mac-desktop-icon-text">{children}</span>
      </span>
    </button>
  );
}
