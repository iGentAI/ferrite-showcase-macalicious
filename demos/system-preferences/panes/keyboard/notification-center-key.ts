/** Keyboard > Shortcuts' Show Notification Center: `–` for none, or a function key. */
export const NOTIFICATION_CENTER_KEY = "keyboard.showNotificationCenter";

export const NO_SHORTCUT = "–";

export const readShortcutChoice = (stored: unknown): string | undefined =>
  typeof stored === "string" ? stored : undefined;
