"use client";

import { useManagedWindow } from "macalicious/managed-window";
import { useWindowManagerStore } from "macalicious/window-manager";
import { useLayoutEffect } from "react";

/** Window > Always on Top, while rendered: the manager's floating layer, over every ordinary window. */
export function AlwaysOnTop() {
  const store = useWindowManagerStore();
  const { id } = useManagedWindow();
  useLayoutEffect(() => {
    store.patch(id, { panel: true });
    return () => store.patch(id, { panel: false });
  }, [store, id]);
  return null;
}

/** Video > Use Portrait and Use Landscape: the window's frame, its long side upright or lying down. */
export function WindowOrientation({ portrait }: { portrait: boolean }) {
  const store = useWindowManagerStore();
  const { id } = useManagedWindow();
  useLayoutEffect(() => {
    const frame = store.get(id)?.frame;
    if (frame?.width === undefined || frame.height === undefined) return;
    const long = Math.max(frame.width, frame.height);
    const short = Math.min(frame.width, frame.height);
    store.patch(id, {
      frame: { ...frame, width: portrait ? short : long, height: portrait ? long : short },
      zoomed: false,
    });
  }, [store, id, portrait]);
  return null;
}
