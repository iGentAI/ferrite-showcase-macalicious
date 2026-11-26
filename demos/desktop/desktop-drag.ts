import { useCallback, useRef } from "react";
import { childrenOf, currentDrive, type DriveKind, readFile } from "./desktop-files";

/**
 * Dragging the person's drive items across the desktop: from Finder or the desktop's icons into
 * another application, onto the Dock, or between Finder windows. A drag follows the pointer
 * itself (`beginDesktopDrag`), because the library's views take the pointer and the keys and a
 * browser's own drag has no shared image or refusal. Whatever is under the pointer decides what
 * happens: a window or a part of one registers as a target (`useDesktopDrop` for a simple one,
 * `registerDropTarget` for one with rows of its own), and the innermost target that answers is
 * the one that takes the drop.
 */

import { LAUNCHPAD_APP_DRAG } from "./desktop-launchpad-folders";

/** Why an application dragged from Launchpad does not land anywhere but the Dock. */
export const APPLICATION_NOT_HERE = "An application from Launchpad only goes in the Dock.";

/** Whether the drag holds an application out of Launchpad, which has no file on the drive to copy. */
export function draggingApplication(items: readonly DesktopDragItem[]): boolean {
  return items.some((item) => item.type === LAUNCHPAD_APP_DRAG);
}

/** A drive item being dragged. A drive file's bytes are read with `filesOfDrag`. */
export interface DesktopDragItem {
  id: string;
  name: string;
  kind: DriveKind;
  /** The file's media type, when the drive has one. */
  type?: string;
  /** Bytes. */
  size?: number;
  /**
   * Reads the file when it is not on the drive, as a Mail attachment is not: `id` then names no drive
   * item, and whatever takes the drop keeps a copy of these bytes.
   */
  bytes?: () => Promise<Blob>;
}

/** A drag under way. */
export interface DesktopDrag {
  /** The application the items come from: its demo folder, `"finder"`, or `"desktop"`. */
  from: string;
  items: readonly DesktopDragItem[];
  /** Whether Option is held: the items are to be copied. */
  copy: boolean;
  /** Moves the items to the Trash, when the source offers it. */
  trash?: () => void;
  /** Where the pointer is, in the page's coordinates. */
  at?: { x: number; y: number };
}

/** What a drop at some point would do. */
export interface DropLanding {
  /** The element shown as the target while the pointer is over it. */
  element: Element;
  /** Why the drop cannot happen here, in a sentence for the person; `drop` is then not called. */
  refusal?: string;
  /** Whether the items stay where they are: the pointer shows a copy. */
  copies?: boolean;
  /** Carries the drop out. */
  drop: () => void;
  /** Says `refusal` to the person when the items are let go. */
  sayRefusal?: (refusal: string) => void;
  /** Opens what is under the pointer once the drag has rested on it: a spring-loaded folder. */
  springs?: () => void;
}

/** An element that can take drops. */
export interface DesktopDropTarget {
  element: Element;
  /**
   * What a drop on `hit`, an element inside `element`, would do; `undefined` passes it to the
   * target around this one.
   */
  landing: (hit: Element, drag: DesktopDrag) => DropLanding | undefined;
}

const targets = new Map<Element, DesktopDropTarget>();

/** Registers a drop target; answers the function that removes it. */
export function registerDropTarget(target: DesktopDropTarget): () => void {
  targets.set(target.element, target);
  return () => {
    if (targets.get(target.element) === target) targets.delete(target.element);
  };
}

/** The landing of a drop on `hit`: the innermost target around it that answers. */
export function landingAt(hit: Element | null, drag: DesktopDrag): DropLanding | undefined {
  for (let element = hit; element; element = element.parentElement) {
    const landing = targets.get(element)?.landing(hit as Element, drag);
    if (landing) return landing;
  }
  return undefined;
}

/** How far the pointer moves before a press becomes a drag, in points. */
const DRAG_THRESHOLD = 6;

/** How long a drag rests on a spring-loaded folder before it opens, in milliseconds. */
const SPRING_MS = 700;

/** Where the drag image stands from the pointer, in points. */
const IMAGE_OFFSET = 8;

/** What a press can start dragging. */
export interface DesktopDragSource {
  from: string;
  /** The items, asked for when the pointer has moved far enough. */
  items: () => readonly DesktopDragItem[];
  /** The press became a drag of nothing: no item here can be dragged. */
  onNothing?: () => void;
  /** The press became a drag of `items`. */
  onStart?: (items: readonly DesktopDragItem[]) => void;
  /** The artwork of the drag image, copied: the icon of the item that was pressed. */
  icon?: Element | null;
  /** Moves the items `ids` to the Trash: only a source that may do so offers it. */
  trash?: (ids: string[]) => void;
}

function dragImage(items: readonly DesktopDragItem[], icon: Element | null | undefined) {
  const image = document.createElement("div");
  image.className = "mac-desktop-drag";
  image.setAttribute("aria-hidden", "true");
  if (icon) {
    const art = document.createElement("span");
    art.className = "mac-desktop-drag-icon";
    art.append(icon.cloneNode(true));
    image.append(art);
  }
  const name = document.createElement("span");
  name.className = "mac-desktop-drag-name";
  name.textContent = items[0]?.name ?? "";
  image.append(name);
  if (items.length > 1) {
    const count = document.createElement("span");
    count.className = "mac-desktop-drag-count";
    count.textContent = String(items.length);
    image.append(count);
  }
  return image;
}

/**
 * Follows the pointer from the press `down`. A press that moves `DRAG_THRESHOLD` points is a drag
 * of the source's items, which ends when the pointer is let go; Escape and losing the browser's
 * focus cancel it. A press that does not move does nothing, so it stays a click.
 */
export function beginDesktopDrag(down: PointerEvent, source: DesktopDragSource): void {
  const page = document.documentElement;
  let items: readonly DesktopDragItem[] = [];
  let started = false;
  let image: HTMLElement | null = null;
  let marked: Element | null = null;
  let resting: Element | null = null;
  let spring: ReturnType<typeof setTimeout> | undefined;

  /** Starts over the wait on `found`'s element, unless the drag is already resting on it. */
  const restOn = (found: DropLanding | undefined) => {
    const element = found?.springs && !found.refusal ? found.element : null;
    if (element === resting) return;
    resting = element;
    clearTimeout(spring);
    if (!element) return;
    spring = setTimeout(() => found?.springs?.(), SPRING_MS);
  };

  const mark = (element: Element | null, accepted: boolean) => {
    if (marked !== element) marked?.removeAttribute("data-desktop-drop");
    marked = element;
    element?.setAttribute("data-desktop-drop", accepted ? "accept" : "refuse");
  };
  const landing = (event: PointerEvent) =>
    landingAt(document.elementFromPoint(event.clientX, event.clientY), {
      from: source.from,
      items,
      copy: event.altKey,
      trash: source.trash ? () => source.trash?.(items.map((item) => item.id)) : undefined,
      at: { x: event.clientX, y: event.clientY },
    });

  // WebKit moves the focus into editable text the pointer crosses, and a window takes the focus as a
  // reason to come forward: the stack would change under the drag. A manager never hears of it.
  let held: Element | null = null;
  const keepFocus = (event: FocusEvent) => {
    event.stopImmediatePropagation();
    if (event.target === held) return;
    if (held instanceof HTMLElement) held.focus({ preventScroll: true });
    // What cannot take the focus back, the page's body above all, leaves it nowhere.
    if (document.activeElement === event.target && event.target instanceof HTMLElement) {
      event.target.blur();
    }
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    if (!started) {
      if (Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < DRAG_THRESHOLD)
        return;
      started = true;
      items = source.items();
      page.dataset.desktopDragging = "";
      held = document.activeElement;
      window.addEventListener("focusin", keepFocus, true);
      if (items.length > 0) {
        source.onStart?.(items);
        image = dragImage(items, source.icon);
        document.body.append(image);
      }
    }
    image?.style.setProperty("translate", `${event.clientX + IMAGE_OFFSET}px ${event.clientY}px`);
    const found = items.length > 0 ? landing(event) : undefined;
    mark(found?.element ?? null, !found?.refusal);
    restOn(found);
    page.style.cursor = found?.refusal ? "no-drop" : found?.copies ? "copy" : "grabbing";
  };
  const finish = () => {
    clearTimeout(spring);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", finish, true);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("blur", finish);
    window.removeEventListener("focusin", keepFocus, true);
    mark(null, true);
    image?.remove();
    delete page.dataset.desktopDragging;
    page.style.removeProperty("cursor");
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    finish();
    if (!started) return;
    if (items.length === 0) {
      source.onNothing?.();
      return;
    }
    const found = landing(event);
    if (!found) return;
    if (found.refusal) found.sayRefusal?.(found.refusal);
    else found.drop();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !started) return;
    event.preventDefault();
    event.stopPropagation();
    finish();
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", finish, true);
  window.addEventListener("keydown", key, true);
  window.addEventListener("blur", finish);
}

/** What an application takes on a drop. */
export interface DesktopDropOptions {
  /** Whether it takes this item. An item it does not take stays where it is. */
  accepts: (item: DesktopDragItem) => boolean;
  /** The items it took. Use `filesOfDrag` for their bytes. */
  onDrop: (items: DesktopDragItem[], drag: DesktopDrag) => void;
  /** Says why a drop of nothing it takes was refused. */
  sayRefusal?: (refusal: string) => void;
  /** The sentence for that refusal, given the dragged items. */
  refusal?: (items: readonly DesktopDragItem[]) => string;
  /** Whether it takes drops now. @default true */
  enabled?: boolean;
}

const defaultRefusal = (items: readonly DesktopDragItem[]) =>
  items.length === 1
    ? `“${items[0]?.name}” can’t be added here.`
    : "These items can’t be added here.";

/**
 * Makes an element a drop target for the desktop's drags: pass the answer as its `ref`. The
 * element is shown as the target while the pointer is over it.
 *
 * ```tsx
 * const dropRef = useDesktopDrop({
 *   accepts: (item) => isPicture(item),
 *   onDrop: async (items) => importFiles(await filesOfDrag(items)),
 * });
 * return <div ref={dropRef}>…</div>;
 * ```
 */
export function useDesktopDrop<E extends Element = HTMLElement>(
  options: DesktopDropOptions,
): (element: E | null) => (() => void) | undefined {
  const latest = useRef(options);
  latest.current = options;
  return useCallback((element: E | null) => {
    if (!element) return undefined;
    return registerDropTarget({
      element,
      landing: (_hit, drag) => {
        const { accepts, onDrop, sayRefusal, refusal, enabled = true } = latest.current;
        if (!enabled) return undefined;
        if (draggingApplication(drag.items)) {
          return {
            element,
            refusal: APPLICATION_NOT_HERE,
            sayRefusal,
            drop: () => {},
          };
        }
        const taken = drag.items.filter(accepts);
        return {
          element,
          copies: true,
          refusal: taken.length > 0 ? undefined : (refusal ?? defaultRefusal)(drag.items),
          sayRefusal,
          drop: () => onDrop([...taken], drag),
        };
      },
    });
  }, []);
}

/**
 * The dragged items with each folder replaced by the files inside it, at any depth, as they are
 * on the drive now. A folder is read from the page's copy of the drive.
 */
export function fileItemsOfDrag(items: readonly DesktopDragItem[]): DesktopDragItem[] {
  const drive = currentDrive();
  const files: DesktopDragItem[] = [];
  const add = (item: DesktopDragItem) => {
    if (item.kind === "file") {
      files.push(item);
      return;
    }
    if (drive) for (const child of childrenOf(drive, item.id)) add(child);
  };
  for (const item of items) add(item);
  return files;
}

/** The bytes of the dragged files, and of the files in the dragged folders, as `File`s. */
export async function filesOfDrag(
  items: readonly DesktopDragItem[],
  signal?: AbortSignal,
): Promise<File[]> {
  const files: File[] = [];
  for (const item of fileItemsOfDrag(items)) {
    const blob = await (item.bytes ? item.bytes() : readFile(item.id, { signal }));
    files.push(new File([blob], item.name, { type: item.type || blob.type }));
  }
  return files;
}
