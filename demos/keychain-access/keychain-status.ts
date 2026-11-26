"use client";

import { useSyncExternalStore } from "react";

/** Whether the menu bar shows the keychain's menu, in the desktop's settings. */
export const KEYCHAIN_MENU_BAR_STATUS = "keychain-access.statusInMenuBar";

/** How to lock the keychain, held only while a window has it unlocked: the key is that window's. */
export type KeychainUnlocked = { lock: () => void };

let unlocked: KeychainUnlocked | null = null;
const listeners = new Set<() => void>();

/** Called by the window that holds the key, with `null` once it no longer does. */
export function reportKeychainUnlocked(next: KeychainUnlocked | null): void {
  unlocked = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** What the menu bar reads: the keychain is locked unless a window holds its key. */
export function useKeychainUnlocked(): KeychainUnlocked | null {
  return useSyncExternalStore(
    subscribe,
    () => unlocked,
    () => null,
  );
}
