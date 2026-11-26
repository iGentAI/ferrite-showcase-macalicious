/** A window open on the desktop page. */
export interface DesktopWindowEntry {
  /** The window's id on the desktop: the app's id, or `<app>:<window>` for a further window. */
  id: string;
  app: string;
  title: string;
  minimized: boolean;
}

/**
 * The desktop's windows, read from the managed windows' documented hooks (`data-window-id`,
 * `data-minimized`) and each window's accessible name: its `aria-label`, or the title bar that names it.
 */
export function scanWindows(root: ParentNode = document): DesktopWindowEntry[] {
  return [...root.querySelectorAll<HTMLElement>("[data-window-id]")].map((element) => {
    const id = element.getAttribute("data-window-id") ?? "";
    const frame = element.querySelector('[role="region"]');
    const labelledBy = frame?.getAttribute("aria-labelledby");
    const bar = labelledBy ? element.ownerDocument.getElementById(labelledBy) : null;
    return {
      id,
      app: id.split(":")[0] ?? id,
      title: frame?.getAttribute("aria-label") ?? bar?.textContent?.trim() ?? "",
      minimized: element.hasAttribute("data-minimized"),
    };
  });
}
