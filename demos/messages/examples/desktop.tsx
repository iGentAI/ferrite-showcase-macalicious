import { ManagedWindow, type ManagedWindowRenderProps } from "macalicious/managed-window";
import { useWindowManager, useWindowManagerStore, WindowManager } from "macalicious/window-manager";
import { useEffect, useRef, useState } from "react";
import { messagesApp } from "../app";
import { DEFAULT_SETTINGS, type MessagesSettings } from "../messages-data";

const { component: App, preferences } = messagesApp;

const PREFERENCES_ID = "messages-preferences";

interface HostedPreferencesProps extends ManagedWindowRenderProps {
  settings: MessagesSettings;
  onSettingsChange: (settings: MessagesSettings) => void;
}

/**
 * The Preferences window in its managed window. It is as tall as its pane, so the height the
 * manager hands over is not used: it is given its own height (`height="auto"`, where a
 * managed window would stretch it to its frame), and the manager's frame is given the height
 * the window has, when it opens, when the other pane is chosen and at each step of the change
 * between them.
 */
function HostedPreferences({ width: _width, height: _height, ...props }: HostedPreferencesProps) {
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
  return (
    <preferences.component
      {...props}
      ref={root}
      width={preferences.defaultSize.width}
      height="auto"
    />
  );
}

/** The app's two windows, with the settings they share. */
function Windows() {
  const manager = useWindowManager();
  const [settings, setSettings] = useState<MessagesSettings>(DEFAULT_SETTINGS);
  const [preferencesOpen, setPreferencesOpen] = useState(true);
  return (
    <>
      <ManagedWindow
        id={messagesApp.id}
        app={messagesApp.id}
        title={messagesApp.name}
        minWidth={messagesApp.minSize.width}
        minHeight={messagesApp.minSize.height}
        defaultFrame={{ x: 190, y: 16, ...messagesApp.defaultSize }}
        render={(props) => (
          <App
            {...props}
            material="opaque"
            settings={settings}
            // The Preferences are the desktop's to open: Command-comma asks for them here.
            preferencesOpen={false}
            onPreferencesOpenChange={(open) => {
              if (!open) return;
              if (preferencesOpen) manager.focus(PREFERENCES_ID);
              else setPreferencesOpen(true);
            }}
          />
        )}
      />
      <ManagedWindow
        id={PREFERENCES_ID}
        app={messagesApp.id}
        title="Messages Preferences"
        resizable={false}
        zoomButton="zoom"
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        defaultFrame={{ x: 24, y: 150, ...preferences.defaultSize }}
        render={(props) => (
          <HostedPreferences {...props} settings={settings} onSettingsChange={setSettings} />
        )}
      />
    </>
  );
}

/**
 * Both windows on a desktop, from the descriptor a desktop page reads: the window manager
 * moves, orders and focuses them. The Preferences window sizes itself to its pane, so it is
 * hosted as a window that cannot be resized, and its frame follows its height. Command-comma
 * in the Messages window opens it again once it is closed.
 */
export default function Desktop() {
  return (
    <WindowManager style={{ width: 960, maxWidth: "100%", height: 620 }}>
      <Windows />
    </WindowManager>
  );
}
