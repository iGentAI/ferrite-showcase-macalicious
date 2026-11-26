"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRender } from "@base-ui/react/use-render";
import {
  Children,
  type CSSProperties,
  createContext,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  use,
  useRef,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import { PageControl } from "../page-control";
import "./launchpad.tokens.css";
import "./launchpad.css";

// The actions of the Launchpad an item is in: an item closes it when it is chosen.
const ActionsContext = createContext<RefObject<Dialog.Root.Actions | null> | null>(null);

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 0, ArrowUp: 0 };

export interface LaunchpadProps extends Omit<Dialog.Popup.Props, "children"> {
  /** Whether Launchpad is shown. Use with `onOpenChange` for controlled use. */
  open?: boolean;
  /**
   * Whether Launchpad is shown at first, when uncontrolled.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called when Launchpad opens or closes: Escape, a click on the background, a chosen item,
   * or a press outside it. The second argument is Base UI's event details.
   */
  onOpenChange?: Dialog.Root.Props["onOpenChange"];
  /**
   * The element Launchpad is rendered into: the desktop, which must be positioned
   * (`position: relative`). Launchpad blurs what that element shows behind it. Pass the
   * element or a ref to it; while it is `null` nothing is rendered. Without it Launchpad is
   * rendered into the document body.
   */
  container?: Dialog.Portal.Props["container"];
  /** The text in the search field. Use with `onSearchChange` for controlled use. */
  search?: string;
  /**
   * The text in the search field at first, when uncontrolled.
   * @default ""
   */
  defaultSearch?: string;
  /** Called with the new text when the user types in the search field. */
  onSearchChange?: (search: string) => void;
  /** Index of the page shown, from 0. Use with `onPageChange` for controlled use. */
  page?: number;
  /**
   * Index of the page shown at first, when uncontrolled.
   * @default 0
   */
  defaultPage?: number;
  /** Called with the new page index when a page dot changes the page. */
  onPageChange?: (page: number) => void;
  /**
   * Columns of the grid. Catalina chooses the grid by screen size; 7 by 5 is a 1680 by 1050
   * point screen.
   * @default 7
   */
  columns?: number;
  /**
   * Rows of the grid. A page holds `columns` times `rows` items.
   * @default 5
   */
  rows?: number;
  /**
   * Placeholder and accessible name of the search field.
   * @default "Search"
   */
  searchLabel?: string;
  /**
   * Accessible name of the background, which closes Launchpad when it is clicked.
   * @default "Close Launchpad"
   */
  closeLabel?: string;
  /**
   * The items, in order: `LaunchpadItem` elements, and `LaunchpadFolder` elements for
   * folders. Any element with a string `label` prop takes part in the search.
   */
  children?: ReactNode;
}

/** Launchpad: every app as a grid of icons over the blurred, dimmed desktop, with a search field. */
export function Launchpad({
  open,
  defaultOpen,
  onOpenChange,
  container,
  search: searchProp,
  defaultSearch = "",
  onSearchChange,
  page: pageProp,
  defaultPage = 0,
  onPageChange,
  columns = 7,
  rows = 5,
  searchLabel = "Search",
  closeLabel = "Close Launchpad",
  className,
  children,
  onKeyDown,
  ...props
}: LaunchpadProps) {
  const actions = useRef<Dialog.Root.Actions>(null);
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useControlled(searchProp, defaultSearch, onSearchChange);
  const [page, setPage] = useControlled(pageProp, defaultPage, onPageChange);

  const query = search.trim().toLowerCase();
  const all = Children.toArray(children);
  const perPage = Math.max(1, columns * rows);
  const pages = Math.ceil(all.length / perPage);
  const current = Math.min(Math.max(page, 0), Math.max(pages - 1, 0));
  // A search shows every match on one page; otherwise only the current page is rendered.
  const shown = query
    ? all.filter(
        (child) =>
          isValidElement<{ label?: unknown }>(child) &&
          String(child.props.label ?? "")
            .toLowerCase()
            .includes(query),
      )
    : all.slice(current * perPage, (current + 1) * perPage);

  // Keys the items do not take themselves (they move among each other): from the background
  // or the search field into the grid, back up to the field, and typing from anywhere.
  const handleKeyDown: Dialog.Popup.Props["onKeyDown"] = (event) => {
    onKeyDown?.(event);
    const field = input.current;
    const target = event.target as HTMLElement;
    // A folder's popup is a React child, not a DOM child: its keys are its own.
    if (event.defaultPrevented || !field || !event.currentTarget.contains(target)) return;
    const first = event.currentTarget.querySelector<HTMLElement>(".mac-launchpad-item");
    const inGrid = target.closest(".mac-launchpad-grid");
    const { key } = event;
    if (key === "ArrowUp" && inGrid) field.focus();
    else if (key === "ArrowDown" && !inGrid) first?.focus();
    else if (key === "Enter" && target === field) first?.click();
    else if (
      key.length === 1 &&
      key !== " " &&
      target !== field &&
      !event.metaKey &&
      !event.ctrlKey
    )
      // The field takes the character that is being typed.
      return field.focus();
    else return;
    event.preventDefault();
  };

  return (
    <Dialog.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      actionsRef={actions}
      modal="trap-focus"
    >
      <Dialog.Portal container={container}>
        <Dialog.Popup
          aria-label="Launchpad"
          // The surface takes the focus: nothing looks focused, and typing starts a search.
          initialFocus={() => input.current?.closest<HTMLElement>(".mac-launchpad")}
          {...props}
          className={withClassName("mac-launchpad", className)}
          onKeyDown={handleKeyDown}
        >
          <Dialog.Close className="mac-launchpad-dismiss" aria-label={closeLabel} tabIndex={-1} />
          <label className="mac-launchpad-search">
            <input
              ref={input}
              className="mac-launchpad-search-input"
              type="search"
              aria-label={searchLabel}
              placeholder=" "
              autoComplete="off"
              spellCheck={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="mac-launchpad-search-hint" aria-hidden="true">
              <svg
                className="mac-launchpad-search-glyph"
                viewBox="0 0 11.5 11.5"
                aria-hidden="true"
              >
                <path d="M7.5 7.5l3.4 3.4M8.5 4.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
              </svg>
              <span className="mac-launchpad-search-placeholder">{searchLabel}</span>
            </span>
          </label>
          <ActionsContext value={actions}>
            <div
              className="mac-launchpad-grid"
              data-columns={columns}
              style={{ "--_columns": columns, "--_rows": rows } as CSSProperties}
            >
              {shown}
            </div>
          </ActionsContext>
          {!query && pages > 1 && (
            <PageControl
              className="mac-launchpad-pages"
              variant="overlay"
              aria-label="Pages"
              count={pages}
              page={current}
              onPageChange={setPage}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface LaunchpadItemProps extends useRender.ComponentProps<"button"> {
  /** The name shown under the icon. It is also what the search field matches. */
  label: string;
  /**
   * Whether choosing the item closes the Launchpad it is in, as launching an app does. A
   * click handler that calls `preventDefault()` keeps it open too.
   * @default true
   */
  closeOnClick?: boolean;
  /** The icon: an image or element that fills its box, 112 by 112 points at full size. */
  children?: ReactNode;
}

/** One app in Launchpad: an icon with its name under it. A button; `onClick` launches the app. */
export function LaunchpadItem({
  label,
  closeOnClick = true,
  className,
  render,
  ref,
  children,
  onClick,
  onKeyDown,
  ...props
}: LaunchpadItemProps) {
  const actions = use(ActionsContext);
  return useRender({
    defaultTagName: "button",
    render,
    ref,
    props: {
      type: "button",
      ...props,
      className: cn("mac-launchpad-item", className),
      onClick(event: MouseEvent<HTMLButtonElement>) {
        onClick?.(event);
        if (closeOnClick && !event.defaultPrevented) actions?.current?.close();
      },
      // Arrow keys move among the items of one grid, whose element says how many columns
      // it has. A key that leads nowhere is left for the grid's owner.
      onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        onKeyDown?.(event);
        const grid = event.currentTarget.parentElement;
        const step = STEPS[event.key];
        if (!grid || step === undefined || event.defaultPrevented) return;
        const columns = Number(grid.dataset.columns) || 1;
        const items = Array.from(grid.children) as HTMLElement[];
        const next =
          items[
            items.indexOf(event.currentTarget) +
              (step || (event.key === "ArrowDown" ? columns : -columns))
          ];
        if (next) {
          event.preventDefault();
          next.focus();
        }
      },
      children: (
        <>
          <span className="mac-launchpad-item-icon">{children}</span>
          <span className="mac-launchpad-item-label">{label}</span>
        </>
      ),
    },
  });
}
