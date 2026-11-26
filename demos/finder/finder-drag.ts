/**
 * What Finder decides about a drop: the desktop's drag (`demos/desktop/desktop-drag.ts`) follows
 * the pointer, and every Finder window is a drop target for it. A drop lands on a folder in a
 * view, a place in the sidebar, or the background of a window, which is its folder shown.
 */

/** Where a drop lands in a Finder window. A file is no folder: a drop on it is refused. */
export interface DropTarget {
  /** The path of the item or folder under the pointer. */
  path: string;
  /** Its name, for the message that says why a drop is refused. */
  name: string;
  /** Whether it is a folder that can take the dragged items. */
  folder: boolean;
  /** The element shown as the target while the pointer is over it. */
  element: Element;
  /** Opens the folder when a drag rests on it. */
  spring?: () => void;
}

/** A dragged item: its path and name. */
export interface Dragged {
  path: string;
  name: string;
}

/**
 * Why the dragged items cannot go into `target`, or `undefined` when they can: a file is not a
 * folder, and an item cannot go into itself or into a folder inside it.
 */
export function refusalFor(
  dragged: readonly Dragged[],
  target: Pick<DropTarget, "path" | "name" | "folder">,
): string | undefined {
  if (!target.folder) return `“${target.name}” isn’t a folder.`;
  const into = dragged.find(
    ({ path }) => target.path === path || target.path.startsWith(`${path}/`),
  );
  if (into) return `“${into.name}” can’t be moved into itself or a folder inside it.`;
  return undefined;
}
