import type { MouseEvent, PointerEvent } from "react";

// The drag region of a window: the surface a press moves the window by and a double-click zooms
// it by. A `TitleBar` is one already. A window without a title bar (App Store, Reminders,
// Messages, Music) has other surfaces that do the same: the strip over its sidebar, a pane's
// header, the playback bar. Spread these props on each of them:
//
//   <div className="top" {...windowDragRegion(onDragRegionPointerDown, onDragRegionDoubleClick)}>
//     <WindowControls />
//   </div>
//
// The two callbacks are a window manager's, the ones a `TitleBar` takes under the same names.
// They are called for the surface itself, not for a control on it, and the first only for the
// primary button. A handler that cancels the event (`preventDefault()`) before it reaches the
// surface keeps the window where it is: one on a control inside, or one the window listens with
// in the capture phase. The element carries `data-window-drag-region`, as a title bar does, and
// a title bar applies the same test to its own surface.

/** The ARIA roles of controls: an element with one takes a press itself. */
const ROLES = [
  "button",
  "checkbox",
  "combobox",
  "grid",
  "link",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "scrollbar",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "tree",
  "treegrid",
  "treeitem",
];

/**
 * What takes a press itself, so does not move the window: a control, by element or by role, a
 * label (a press on it goes to its control), editable text and a media element with controls.
 * `data-window-no-drag` opts any other element out.
 */
const INTERACTIVE = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "option",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[data-window-no-drag]",
  ...ROLES.map((role) => `[role~='${role}']`),
].join();

/**
 * Whether an event's target is a drag region's own surface, not a control on it. False for no
 * target and for a target that is not in an element (the window, a document). The test reads
 * `nodeType`, not `instanceof`, so an element of another document or frame is judged the same.
 */
export function isWindowDragRegion(target: EventTarget | null): boolean {
  const node = target as Node | null;
  const element = node?.nodeType === 3 ? node.parentElement : node;
  return element?.nodeType === 1 && (element as Element).closest(INTERACTIVE) === null;
}

/** The props that make an element a drag region of its window. */
export function windowDragRegion<T extends HTMLElement = HTMLElement>(
  onDragRegionPointerDown?: (event: PointerEvent<T>) => void,
  onDragRegionDoubleClick?: (event: MouseEvent<T>) => void,
) {
  return {
    "data-window-drag-region": "",
    onPointerDown: (event: PointerEvent<T>) => {
      if (!event.defaultPrevented && event.button === 0 && isWindowDragRegion(event.target))
        onDragRegionPointerDown?.(event);
    },
    onDoubleClick: (event: MouseEvent<T>) => {
      if (!event.defaultPrevented && isWindowDragRegion(event.target))
        onDragRegionDoubleClick?.(event);
    },
  };
}
