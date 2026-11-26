import { VoiceMemosApp } from "./voice-memos-app";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const voiceMemosApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "voice-memos",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Voice Memos",
  /**
   * The app as a window: on the desktop served by Ferrite it records, plays and keeps the
   * person's recordings on their drive (`VoiceMemosApp`); elsewhere it is the demo of the
   * reference captures, `VoiceMemos`.
   */
  component: VoiceMemosApp,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 789, height: 630 },
  /**
   * The smallest frame that holds the waveform, the overview, the timer and the bottom bar
   * with its two pills and the transport between them.
   */
  minSize: { width: 560, height: 600 },
  /** The window can be resized: the waveform keeps its scale and the playhead stays centred. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Voice Memos", "File", "Edit", "View", "Window", "Help"],
  /**
   * The window renders its Preferences itself: a desktop opens them with `preferencesOpen` and
   * hears of Command-comma and of their closing in `onPreferencesOpenChange`.
   */
  preferences: "own",
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = voiceMemosApp;

export type { VoiceMemosProps } from "./voice-memos";
export { VoiceMemosApp, type VoiceMemosAppProps } from "./voice-memos-app";
export type { VoiceMemoFile, VoiceMemosDrive } from "./voice-memos-drive";
