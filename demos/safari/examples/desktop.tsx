import { ManagedWindow, type ManagedWindowRenderProps } from "macalicious/managed-window";
import { useWindowManagerStore, WindowManager } from "macalicious/window-manager";
import { useEffect, useRef } from "react";
import { safariApp } from "../app";

const { component: Browser, preferences } = safariApp;

const PREFERENCES_ID = "safari-preferences";

/**
 * The preferences window in its managed window. It is as tall as its pane, so the height the
 * manager hands over is not used, and the manager's frame is given the height the window has:
 * when it opens, when another pane is chosen and at each step of the change between two panes.
 */
function HostedPreferences({ width: _width, height: _height, ...props }: ManagedWindowRenderProps) {
  const store = useWindowManagerStore();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const frame = store.get(PREFERENCES_ID)?.frame;
      const height = element.offsetHeight;
      if (frame && height > 0 && frame.height !== height) {
        store.patch(PREFERENCES_ID, { frame: { ...frame, height } });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [store]);
  return <preferences.component {...props} ref={root} width={preferences.defaultSize.width} />;
}

/**
 * Both windows on a desktop, from the descriptor a desktop page reads: the window manager
 * moves, resizes, orders and focuses them. The preferences window sizes itself to its pane,
 * so it is hosted as a window that cannot be resized, and its frame follows its height.
 */
export default function Desktop() {
  return (
    <WindowManager style={{ width: 960, maxWidth: "100%", height: 620 }}>
      <ManagedWindow
        id="safari"
        app={safariApp.id}
        title={safariApp.name}
        minWidth={safariApp.minSize.width}
        minHeight={safariApp.minSize.height}
        defaultFrame={{ x: 24, y: 20, width: 880, height: 540 }}
        render={(props) => <Browser {...props} />}
      />
      <ManagedWindow
        id={PREFERENCES_ID}
        app={safariApp.id}
        title="Safari Preferences"
        resizable={false}
        zoomButton="zoom"
        defaultFrame={{ x: 150, y: 90, ...preferences.defaultSize }}
        render={(props) => <HostedPreferences {...props} />}
      />
    </WindowManager>
  );
}
