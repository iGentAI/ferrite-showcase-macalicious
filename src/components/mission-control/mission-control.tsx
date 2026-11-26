"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRender } from "@base-ui/react/use-render";
import {
  Children,
  type CSSProperties,
  createContext,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  use,
  useRef,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import "./mission-control.tokens.css";
import "./mission-control.css";

/** Where a window is on the desktop and how large it is, in points. */
export interface MissionControlFrame {
  /** Distance of the window's left edge from the desktop's left edge. */
  x: number;
  /** Distance of the window's top edge from the desktop's top edge. */
  y: number;
  /** Width of the window. */
  width: number;
  /** Height of the window. */
  height: number;
}

// The actions of the Mission Control a space or a window is in: choosing one closes it.
const ActionsContext = createContext<RefObject<Dialog.Root.Actions | null> | null>(null);

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

// Space between two window thumbnails, in the windows' own points.
const GAP = 12;
const NO_FRAME: MissionControlFrame = { x: 0, y: 0, width: 480, height: 320 };

const middle = (frame: MissionControlFrame, vertical?: boolean) =>
  vertical ? frame.y + frame.height / 2 : frame.x + frame.width / 2;

type WindowElement = ReactElement<{ frame?: MissionControlFrame }>;

// A window's place in the layout: `x` from the middle of its row, `y` from the top.
interface Slot {
  child: WindowElement;
  frame: MissionControlFrame;
  x: number;
  y: number;
}

// Windows side by side in `rows` rows, none over another: from top to bottom by their middles
// they are dealt into the rows, each row runs from left to right by their middles, and within
// a row every window keeps its height on the desktop. The slots come back in reading order.
function arrange(windows: WindowElement[], rows: number) {
  const perRow = Math.ceil(windows.length / rows);
  const order = windows
    .map((child): Slot => ({ child, frame: child.props.frame ?? NO_FRAME, x: 0, y: 0 }))
    .sort((a, b) => middle(a.frame, true) - middle(b.frame, true));
  const slots: Slot[] = [];
  let width = 0;
  let top = 0;
  for (let start = 0; start < order.length; start += perRow) {
    const row = order
      .slice(start, start + perRow)
      .sort((a, b) => middle(a.frame) - middle(b.frame));
    const rowTop = Math.min(...row.map((slot) => slot.frame.y));
    let left = 0;
    let height = 0;
    for (const slot of row) {
      slot.x = left;
      slot.y = top + slot.frame.y - rowTop;
      left += slot.frame.width + GAP;
      height = Math.max(height, slot.y - top + slot.frame.height);
    }
    left -= GAP;
    for (const slot of row) slot.x -= left / 2;
    slots.push(...row);
    width = Math.max(width, left);
    top += height + GAP;
  }
  return { slots, width, height: top - GAP };
}

// How large the thumbnails come out in an area twice as wide as high, which is about what a
// 16 by 10 desktop leaves under the Spaces bar and above the Dock.
const shown = (layout: { width: number; height: number }) =>
  Math.min(2 / layout.width, 1 / layout.height);

/** The window thumbnails, laid out. Rendered only while Mission Control is open. */
function Windows({ label, children }: { label: string; children: ReactNode }) {
  const windows = Children.toArray(children).filter((child): child is WindowElement =>
    isValidElement(child),
  );
  if (!windows.length) return null;
  let layout = arrange(windows, 1);
  for (let rows = 2; rows <= windows.length; rows++) {
    const next = arrange(windows, rows);
    if (shown(next) > shown(layout)) layout = next;
  }
  const { width, height } = layout;
  const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form's fieldset
    <div
      className="mac-mission-control-windows"
      role="group"
      aria-label={label}
      style={{ "--_w": width, "--_h": height } as CSSProperties}
    >
      {layout.slots.map(({ child, frame, x, y }) => (
        <div
          key={child.key}
          className="mac-mission-control-slot"
          style={{
            left: percent(x + width / 2, width),
            top: percent(y, height),
            width: percent(frame.width, width),
            height: percent(frame.height, height),
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

export interface MissionControlProps extends Omit<Dialog.Popup.Props, "children"> {
  /** Whether Mission Control is shown. Use with `onOpenChange` for controlled use. */
  open?: boolean;
  /**
   * Whether Mission Control is shown at first, when uncontrolled.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called when Mission Control opens or closes: Escape, a click on the desktop, a chosen
   * window or space, or a press outside it. The second argument is Base UI's event details.
   */
  onOpenChange?: Dialog.Root.Props["onOpenChange"];
  /**
   * The element Mission Control is rendered into: the desktop, which must be positioned
   * (`position: relative`); a `WindowManager` is. Pass the element or a ref to it; while it
   * is `null` nothing is rendered. Without it Mission Control is rendered into the document
   * body.
   */
  container?: Dialog.Portal.Props["container"];
  /**
   * The Spaces bar's content: `MissionControlSpace` elements, in order. Without spaces and
   * without `onAddSpace` there is no bar.
   */
  spaces?: ReactNode;
  /** Called when the add button is pressed. The button is shown only with this handler. */
  onAddSpace?: () => void;
  /**
   * Accessible name of the add button.
   * @default "Add Desktop"
   */
  addLabel?: string;
  /**
   * Accessible name of the Spaces bar.
   * @default "Spaces"
   */
  spacesLabel?: string;
  /**
   * Accessible name of the group of window thumbnails.
   * @default "Windows"
   */
  windowsLabel?: string;
  /**
   * Accessible name of the desktop behind the thumbnails, which closes Mission Control when
   * it is clicked.
   * @default "Close Mission Control"
   */
  closeLabel?: string;
  /**
   * The windows: `MissionControlWindow` elements. Their `frame` props decide the layout, so
   * an element of your own that wraps one must have a `frame` prop too.
   */
  children?: ReactNode;
}

/** Mission Control: the Spaces bar and a thumbnail of every open window, over the desktop. */
export function MissionControl({
  open,
  defaultOpen,
  onOpenChange,
  container,
  spaces,
  onAddSpace,
  addLabel = "Add Desktop",
  spacesLabel = "Spaces",
  windowsLabel = "Windows",
  closeLabel = "Close Mission Control",
  className,
  children,
  onKeyDown,
  ...props
}: MissionControlProps) {
  const actions = useRef<Dialog.Root.Actions>(null);
  const area = useRef<HTMLDivElement>(null);

  // The arrow keys move along the thumbnails, or along the bar while the focus is in it;
  // from the bar, and from the freshly opened overview, Arrow Down leads to the first window.
  const handleKeyDown: Dialog.Popup.Props["onKeyDown"] = (event) => {
    onKeyDown?.(event);
    const step = STEPS[event.key];
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || !step || !event.currentTarget.contains(target)) return;
    const inBar = event.key !== "ArrowDown" && target.closest(".mac-mission-control-bar");
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        inBar ? ".mac-mission-control-bar button" : ".mac-mission-control-window",
      ),
    );
    const at = items.indexOf(target);
    const next = items[at < 0 ? 0 : at + step];
    if (next) {
      event.preventDefault();
      next.focus();
    }
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
          aria-label="Mission Control"
          // The surface takes the focus: no thumbnail looks chosen until a key is pressed.
          initialFocus={() => area.current?.parentElement}
          {...props}
          className={withClassName("mac-mission-control", className)}
          onKeyDown={handleKeyDown}
        >
          <Dialog.Close
            className="mac-mission-control-dismiss"
            aria-label={closeLabel}
            tabIndex={-1}
          />
          <ActionsContext value={actions}>
            {(spaces || onAddSpace) && (
              // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form's fieldset
              <div className="mac-mission-control-bar" role="group" aria-label={spacesLabel}>
                {spaces}
                {onAddSpace && (
                  <button
                    type="button"
                    className="mac-mission-control-add"
                    aria-label={addLabel}
                    onClick={onAddSpace}
                  >
                    <svg
                      className="mac-mission-control-add-glyph"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M10 0v20M0 10h20" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            <div ref={area} className="mac-mission-control-area">
              <Windows label={windowsLabel}>{children}</Windows>
            </div>
          </ActionsContext>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// A click on a space or a window: the handler it was given, then Mission Control closes.
function useChoose(
  onClick: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined,
  closeOnClick: boolean,
) {
  const actions = use(ActionsContext);
  return (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (closeOnClick && !event.defaultPrevented) actions?.current?.close();
  };
}

export interface MissionControlSpaceProps extends useRender.ComponentProps<"button"> {
  /** The space's name under its thumbnail, such as "Desktop 1". It names the button. */
  label: string;
  /**
   * Whether this is the space on screen: it is ringed, and announced as the current one.
   * @default false
   */
  current?: boolean;
  /**
   * Whether choosing the space closes the Mission Control it is in, as switching to a space
   * does. A click handler that calls `preventDefault()` keeps it open too.
   * @default true
   */
  closeOnClick?: boolean;
  /**
   * The thumbnail: a picture or drawing of the space that fills its box, 144 by 90 points at
   * full size. It is decoration: hidden from assistive technology and not interactive.
   */
  children?: ReactNode;
}

/** One space in the Spaces bar: a thumbnail with its name. A button; `onClick` switches to it. */
export function MissionControlSpace({
  label,
  current = false,
  closeOnClick = true,
  className,
  render,
  ref,
  children,
  onClick,
  ...props
}: MissionControlSpaceProps) {
  return useRender({
    defaultTagName: "button",
    render,
    ref,
    props: {
      type: "button",
      "aria-current": current || undefined,
      "data-current": current ? "" : undefined,
      ...props,
      className: cn("mac-mission-control-space", className),
      onClick: useChoose(onClick, closeOnClick),
      children: (
        <>
          <span className="mac-mission-control-space-thumbnail">
            <span className="mac-mission-control-space-picture" aria-hidden="true" inert>
              {children}
            </span>
          </span>
          <span className="mac-mission-control-space-label">{label}</span>
        </>
      ),
    },
  });
}

export interface MissionControlWindowProps
  extends Omit<useRender.ComponentProps<"button">, "title"> {
  /** The window's title, shown with its icon under the pointer or the focus. It names the button. */
  title: string;
  /**
   * The window's frame on the desktop, in points. Mission Control lays the thumbnails out
   * from the frames of all its windows, and scales the content from this size.
   */
  frame: MissionControlFrame;
  /** The application's icon, shown before the title: an image or element 24 points square. */
  icon?: ReactNode;
  /**
   * Whether choosing the window closes the Mission Control it is in. A click handler that
   * calls `preventDefault()` keeps it open too.
   * @default true
   */
  closeOnClick?: boolean;
  /**
   * What the thumbnail shows: a picture of the window, or the window's own elements rendered
   * again. It is laid out at the frame's size and scaled down. It is decoration: hidden from
   * assistive technology and not interactive.
   */
  children?: ReactNode;
}

/**
 * One window in Mission Control: a scaled thumbnail under a button named by the window's
 * title; `onClick` brings the window forward. For use inside `MissionControl`.
 */
export function MissionControlWindow({
  title,
  frame,
  icon,
  closeOnClick = true,
  className,
  render,
  ref,
  children,
  onClick,
  ...props
}: MissionControlWindowProps) {
  const button = useRender({
    defaultTagName: "button",
    render,
    ref,
    props: {
      type: "button",
      ...props,
      className: cn("mac-mission-control-window", className),
      onClick: useChoose(onClick, closeOnClick),
      children: (
        <span className="mac-mission-control-window-caption">
          {icon && (
            <span className="mac-mission-control-window-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span className="mac-mission-control-window-title">{title}</span>
        </span>
      ),
    },
  });
  return (
    <>
      <div
        className="mac-mission-control-window-content"
        style={{ width: frame.width, height: frame.height }}
        aria-hidden="true"
        inert
      >
        {children}
      </div>
      {button}
    </>
  );
}
