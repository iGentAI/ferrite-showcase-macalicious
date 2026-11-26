"use client";

import { observeResize } from "macalicious/lib/observe-resize";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { WindowControls } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import { type ComponentType, useEffect, useLayoutEffect, useRef } from "react";
import type { DesktopPreferences, DesktopPreferencesProps } from "./desktop-apps";

/** What takes a press in a preferences window's title bar itself: its toolbar and controls. */
const CONTROL = "button, a, input, select, textarea, [role='tab'], [role='button']";

const RAISE_OWN_PREFERENCES = "macalicious:raise-own-preferences";

/** The Preferences command, for an application whose own Preferences window is already open. */
export function raiseOwnPreferences(app: string): void {
  window.dispatchEvent(new CustomEvent(RAISE_OWN_PREFERENCES, { detail: app }));
}

/**
 * For an application that renders its Preferences itself: `raise` brings them in front of its
 * other windows each time `raiseOwnPreferences` names `app`. With `null` it hears nothing.
 */
export function useOwnPreferencesRaised(app: string | null, raise: () => void): void {
  const latest = useRef(raise);
  latest.current = raise;
  useEffect(() => {
    if (app === null) return;
    const hear = (event: Event) => {
      if ((event as CustomEvent<string>).detail === app) latest.current();
    };
    window.addEventListener(RAISE_OWN_PREFERENCES, hear);
    return () => window.removeEventListener(RAISE_OWN_PREFERENCES, hear);
  }, [app]);
}

export interface HostedPreferencesProps {
  /** The id of the managed window the preferences are rendered in. */
  id: string;
  /** The application's Preferences window: its root is the library's `PreferencesWindow`. */
  component: DesktopPreferences["component"];
  /** What a managed window's `render` form is called with. */
  windowProps: ManagedWindowRenderProps;
  /** The settings the application's windows share, for a descriptor that `sharesSettings`. */
  shared?: { settings: unknown; onSettingsChange: (settings: unknown) => void };
}

/**
 * An application's Preferences window as a window of the desktop. A `PreferencesWindow` has
 * its own title bar and its own controls, and is as tall as the pane it shows, so this hands
 * it what a managed window supplies in the form it takes them: the close and minimize commands
 * as its `controls`, a press on its title bar as the start of a move, and its own height, which
 * the window's frame then follows.
 */
export function HostedPreferences({ id, component, windowProps, shared }: HostedPreferencesProps) {
  // Either kind of Preferences window: the one that shares settings is given them in `shared`.
  const Preferences = component as ComponentType<DesktopPreferencesProps>;
  const store = useWindowManagerStore();
  const root = useRef<HTMLDivElement>(null);
  const { state, onClose, onMinimize, minimizeDisabled, zoomRole, onDragRegionPointerDown } =
    windowProps;

  // The frame is as tall as the window: the pane that is shown decides, and the preferences
  // window animates between panes itself.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    return observeResize(element, () => {
      const frame = store.get(id)?.frame;
      const height = element.offsetHeight;
      if (frame && height > 0 && frame.height !== height) {
        store.patch(id, { frame: { ...frame, height } });
      }
    });
  }, [store, id]);

  return (
    <Preferences
      ref={root}
      state={state}
      tabIndex={-1}
      width="100%"
      style={{ height: "auto" }}
      onClose={onClose}
      controls={
        <WindowControls
          onClose={onClose}
          onMinimize={onMinimize}
          minimizeDisabled={minimizeDisabled}
          zoomRole={zoomRole}
          zoomDisabled
        />
      }
      onPointerDown={(event) => {
        const target = event.target as Element;
        if (
          event.currentTarget.contains(target) &&
          target.closest("[data-window-drag-region]") &&
          !target.closest(CONTROL)
        ) {
          onDragRegionPointerDown(event);
        }
      }}
      {...shared}
    />
  );
}
