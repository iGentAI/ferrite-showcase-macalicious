"use client";

import { observeResize } from "macalicious/lib/observe-resize";
import {
  ManagedWindow,
  type ManagedWindowRenderProps,
  useManagedWindow,
} from "macalicious/managed-window";
import { useWindowManagerStore, type WindowFrame } from "macalicious/window-manager";
import { createContext, type PointerEvent, use, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { whenMenusClosed } from "../notes/notes-menus";
import { type DesktopSecondaryWindowProps, secondaryWindowId } from "./desktop-apps";
import { useOwnPreferencesRaised } from "./desktop-preferences";

/** What a secondary window needs to know of the application that opens it. */
export interface DesktopWindowHost {
  /** The application's id: the window is one of its windows. */
  app: string;
  /** The element windows are positioned in: the window manager's. */
  stage: () => Element | null;
  /** Where a window of a size opens on the desktop. */
  place: (
    size: { width: number; height: number },
    flexible: boolean,
    least?: { width: number; height: number },
  ) => Partial<WindowFrame>;
  /** Opens an application of the desktop, or brings it to the front: the App Store's Open. */
  launch?: (id: string) => void;
}

/** The application a window is rendered for. `null` outside an application of the desktop. */
export const DesktopWindowHostContext = createContext<DesktopWindowHost | null>(null);

/**
 * Names the managed window it is rendered in for the Window menu, the Dock and Mission Control, when
 * that name follows what the window shows rather than being its application's.
 */
export function DesktopWindowName({ title }: { title: string }) {
  const store = useWindowManagerStore();
  const { id } = useManagedWindow();
  useEffect(() => store.patch(id, { title }), [store, id, title]);
  return null;
}

/** What takes a press in a window's bar itself: its controls and toolbar items. */
const CONTROL = "button, a, input, select, textarea, [role='tab'], [role='button']";

/** The id of an application's hosted Preferences among its further windows. */
const PREFERENCES = "preferences";

/**
 * A further window of an application, as a window of the desktop: what an application whose
 * descriptor says `windows` is given as `DesktopWindow`. The application renders it where it
 * would render the window itself, for as long as the window is open, and keeps the window's
 * state; the desktop places, moves, orders and focuses it. It is rendered into the window
 * manager's element, not into the window that asked for it.
 */
export function DesktopSecondaryWindow({
  id,
  title,
  defaultSize,
  minSize,
  resizable: wanted = true,
  zoomButton,
  panel,
  fitsContent = false,
  dragRegion,
  isPreferences = false,
  onClose,
  render,
}: DesktopSecondaryWindowProps) {
  const host = use(DesktopWindowHostContext);
  if (!host) throw new Error("A DesktopWindow is rendered by an application of the desktop.");
  if (id === PREFERENCES) {
    throw new Error(
      `A DesktopWindow cannot have the id "${PREFERENCES}": it is the id of hosted Preferences.`,
    );
  }
  // A window that follows its content's height is not resized by hand: what it shows would
  // otherwise set the frame again for every frame of the resize.
  const resizable = wanted && !fitsContent;
  const store = useWindowManagerStore();
  const windowId = secondaryWindowId(host.app, id);
  // Read once, when the window opens: where it stands from then on is the manager's.
  const [frame] = useState(() => host.place(defaultSize, resizable, minSize));
  const stage = host.stage();
  useOwnPreferencesRaised(isPreferences ? host.app : null, () => store.focus(windowId));

  // A window that is as tall as what it shows: the frame follows the window's height.
  useLayoutEffect(() => {
    const frames = fitsContent ? (stage?.querySelectorAll("[data-window-id]") ?? []) : [];
    const element = [...frames].find(
      (candidate) => candidate.getAttribute("data-window-id") === windowId,
    )?.firstElementChild;
    if (!(element instanceof HTMLElement)) return;
    return observeResize(element, () => {
      const current = store.get(windowId)?.frame;
      const height = element.offsetHeight;
      if (current && height > 0 && current.height !== height) {
        store.patch(windowId, { frame: { ...current, height } });
      }
    });
  }, [store, stage, windowId, fitsContent]);

  // Opened from a menu in the window that asked for it (Finder's Action menu): as it closes, the
  // menu gives the keyboard back to its button, which would raise that window over this one.
  useEffect(() => {
    const document = stage?.ownerDocument;
    if (document?.querySelector('[role="menu"]')) {
      whenMenusClosed(document, () => store.focus(windowId));
    }
  }, [store, stage, windowId]);

  if (!stage) return null;
  const hosted = (props: ManagedWindowRenderProps): ManagedWindowRenderProps => ({
    ...props,
    ...(fitsContent ? { height: undefined, style: { ...props.style, height: "auto" } } : null),
    ...(dragRegion
      ? {
          onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
            props.onPointerDown?.(event);
            const target = event.target as Element;
            if (
              event.currentTarget.contains(target) &&
              target.closest(dragRegion) &&
              !target.closest(CONTROL)
            ) {
              props.onDragRegionPointerDown(event);
            }
          },
        }
      : null),
  });
  return createPortal(
    <ManagedWindow
      id={windowId}
      app={host.app}
      title={title}
      resizable={resizable}
      zoomButton={zoomButton}
      panel={panel}
      minWidth={minSize?.width}
      minHeight={minSize?.height}
      defaultFrame={frame}
      // A close (its button, File > Close Window, Command-W) asks the application, which closes
      // the window by no longer rendering it: Mail keeps a New Message window open while its
      // message is being sent.
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      render={(props) => render(hosted(props))}
    />,
    stage,
  );
}
