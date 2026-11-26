"use client";

import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { attachRef } from "../../lib/attach-ref";
import { cn } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import "./app-switcher.tokens.css";
import "./app-switcher.css";

const AppSwitcherContext = createContext<{
  id: string;
  value: string | undefined;
  select: (value: string) => void;
  choose: (value: string) => void;
} | null>(null);

// The id of an item's element, which the switcher names in aria-activedescendant.
const optionId = (id: string, value: string) => `${id}-${value.replace(/\s/g, "_")}`;

export interface AppSwitcherProps extends Omit<ComponentProps<"div">, "defaultValue"> {
  /** Whether the switcher is shown, controlled. */
  open?: boolean;
  /**
   * Whether the switcher is shown at first.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called with `false` when an application is chosen, when Escape is pressed and when
   * keyboard focus leaves the switcher.
   */
  onOpenChange?: (open: boolean) => void;
  /** The `value` of the selected item, controlled. */
  value?: string;
  /**
   * The item selected each time the switcher opens. Without it that is the second item, the
   * application used before the present one, or the only item.
   */
  defaultValue?: string;
  /**
   * Called with an item's `value` when the selection moves to it: by a key, by the pointer,
   * and when the switcher opens and makes its first selection.
   */
  onValueChange?: (value: string) => void;
  /**
   * Called with the selected item's `value` when it is chosen with Return, Space or a click.
   * The switcher closes; this is the place to bring that application to the front.
   */
  onChoose?: (value: string) => void;
}

/**
 * The Command-Tab switcher: a translucent panel in the middle of the positioned element it is
 * in, with one `AppSwitcherItem` per running application and the name of the selected one
 * under its icon. It takes the keyboard focus while it is open and gives it back when it
 * closes. Tab and the arrow keys move the selection, Return or Space chooses, Escape closes.
 */
export function AppSwitcher({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  value: valueProp,
  defaultValue,
  onValueChange,
  onChoose,
  ref,
  className,
  onKeyDown,
  onBlur,
  ...props
}: AppSwitcherProps) {
  const id = useId();
  const [open, setOpen] = useControlled(openProp, defaultOpen, onOpenChange);
  const [value, setValue] = useControlled<string | undefined>(valueProp, undefined, (next) => {
    if (next !== undefined) onValueChange?.(next);
  });
  const root = useRef<HTMLDivElement | null>(null);
  // True while the switcher moves the focus itself or hands over to `onChoose`: focus that
  // leaves it then is not the visitor leaving.
  const quiet = useRef(false);

  const setRoot = useCallback(
    (element: HTMLDivElement) => {
      root.current = element;
      const release = attachRef(ref, element);
      return () => {
        root.current = null;
        release();
      };
    },
    [ref],
  );

  // Opening: select the first item and take the keyboard focus. Closing: give the focus back
  // to where it was, unless it has moved on to something else in the meantime.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the switcher opens or closes
  useLayoutEffect(() => {
    const element = root.current;
    if (!open || !element) return;
    if (valueProp === undefined) {
      const options = element.querySelectorAll<HTMLElement>('[role="option"]');
      const first = defaultValue ?? (options[1] ?? options[0])?.dataset.value;
      if (first !== undefined && first !== value) setValue(first);
    }
    const previous = document.activeElement;
    element.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      if (
        previous instanceof HTMLElement &&
        (!active || active === document.body || element.contains(active))
      ) {
        quiet.current = true;
        previous.focus({ preventScroll: true });
        quiet.current = false;
      }
    };
  }, [open]);

  const choose = useCallback(
    (chosen: string) => {
      quiet.current = true;
      setOpen(false);
      onChoose?.(chosen);
      quiet.current = false;
    },
    [setOpen, onChoose],
  );
  const context = useMemo(
    () => ({ id, value, select: setValue, choose }),
    [id, value, setValue, choose],
  );

  return open ? (
    <AppSwitcherContext value={context}>
      <div
        role="listbox"
        aria-orientation="horizontal"
        aria-label="Applications"
        aria-activedescendant={value === undefined ? undefined : optionId(id, value)}
        tabIndex={0}
        {...props}
        ref={setRoot}
        className={cn("mac-app-switcher", className)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          const { key } = event;
          const options = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')];
          const last = options.length - 1;
          const index = options.findIndex((option) => option.dataset.value === value);
          // 1 where the next item is on the right, -1 in a right-to-left page.
          const forward = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
          let step = 0;
          let to = -1;
          if (key === "Tab") step = event.shiftKey ? -1 : 1;
          else if (key === "ArrowRight") step = forward;
          else if (key === "ArrowLeft") step = -forward;
          else if (key === "Home") to = 0;
          else if (key === "End") to = last;
          else if (key === "Enter" || key === " ") {
            if (value !== undefined && index >= 0) choose(value);
          } else if (key === "Escape") setOpen(false);
          else return;
          event.preventDefault();
          // Past either end the selection comes round to the other.
          if (step) to = index < 0 ? (step > 0 ? 0 : last) : (index + step + last + 1) % (last + 1);
          const next = options[to]?.dataset.value;
          if (next !== undefined && next !== value) setValue(next);
        }}
        onBlur={(event) => {
          onBlur?.(event);
          if (!quiet.current && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      />
    </AppSwitcherContext>
  ) : null;
}

export interface AppSwitcherItemProps extends Omit<ComponentProps<"div">, "id"> {
  /**
   * What identifies the application: `onValueChange` and `onChoose` are called with it. It is
   * also part of the element's `id`, which the switcher sets.
   */
  value: string;
  /**
   * The application's icon: an image or a drawing of your own, which is stretched to the tile,
   * 128 points wide unless the row has to shrink to fit.
   */
  icon?: ReactNode;
}

/**
 * One application in the switcher: its icon, and its name as children. The name is the
 * option's accessible name and is shown only under the selected item. Moving the pointer over
 * the item selects it and a click chooses it.
 */
export function AppSwitcherItem({
  value,
  icon,
  className,
  children,
  onPointerMove,
  onClick,
  ...props
}: AppSwitcherItemProps) {
  const context = use(AppSwitcherContext);
  const selected = context?.value === value;
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: the listbox keeps the focus and names the selected option in aria-activedescendant
    // biome-ignore lint/a11y/useKeyWithClickEvents: Return and Space are handled by the listbox, which has the focus
    <div
      role="option"
      aria-selected={selected}
      data-selected={selected ? "" : undefined}
      {...props}
      id={context ? optionId(context.id, value) : undefined}
      data-value={value}
      className={cn("mac-app-switcher-item", className)}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!selected && !event.defaultPrevented) context?.select(value);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context?.choose(value);
      }}
    >
      <span className="mac-app-switcher-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mac-app-switcher-name">{children}</span>
    </div>
  );
}
