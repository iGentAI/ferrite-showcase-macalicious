"use client";

import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { useEffect, useMemo, useRef } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { EditRows } from "../desktop/desktop-edit-rows";

const NO_REDEEM = "Nothing here costs money, so there is no code to redeem.";
const SIGNED_OUT = "You are not signed in.";
const NO_FIELD = "Click in the search field first.";

interface Command {
  title: string;
  key?: string;
  enabled: boolean;
  /** Why it is dimmed, where that takes saying. */
  reason?: string;
  run: () => void;
}

function row(command: Command) {
  return (
    <MenuItem
      disabled={!command.enabled}
      title={command.enabled ? undefined : command.reason}
      keyEquivalent={command.key}
      onClick={command.enabled ? command.run : undefined}
    >
      {command.title}
    </MenuItem>
  );
}

/** What the window hands its menus. */
export interface AppStoreMenusProps {
  /** An element of the window, which makes it the application's last used. */
  within: Element | null;
  /** Whether the window is the key window, which takes the key equivalents. */
  isKey: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Whether the Updates page is shown: Command-R then checks for updates. */
  onUpdates: boolean;
  signedIn: boolean;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  focusSearch: () => void;
  openAccount: () => void;
  signOut: () => void;
  showUpdates: () => void;
  checkForUpdates: () => void;
  /** Tells the person what a command could not do. */
  say: (message: string) => void;
}

/**
 * The store's own items in the desktop's menu bar, while its window is the application's last used
 * (`desktop-app-menus.ts`), and their key equivalents, while it is the key window.
 */
export function useAppStoreMenus(props: AppStoreMenusProps) {
  const latest = useRef(props);
  latest.current = props;
  const { within, isKey, canGoBack, canGoForward, onUpdates, signedIn } = props;
  const commands = useMemo(
    () => ({
      find: {
        title: "Find",
        key: "command+f",
        enabled: true,
        run: () => latest.current.focusSearch(),
      },
      back: {
        title: "Back",
        key: "command+[",
        enabled: canGoBack,
        run: () => latest.current.goBack(),
      },
      forward: {
        title: "Forward",
        key: "command+]",
        enabled: canGoForward,
        run: () => latest.current.goForward(),
      },
      reload: {
        title: "Reload Page",
        key: onUpdates ? undefined : "command+r",
        enabled: true,
        run: () => latest.current.reload(),
      },
      search: {
        title: "Search",
        enabled: true,
        run: () => latest.current.focusSearch(),
      },
      account: {
        title: signedIn ? "View My Account" : "Sign In",
        enabled: true,
        run: () => latest.current.openAccount(),
      },
      signOut: {
        title: "Sign Out",
        enabled: signedIn,
        reason: SIGNED_OUT,
        run: () => latest.current.signOut(),
      },
      updates: {
        title: "Show Updates",
        enabled: true,
        run: () => latest.current.showUpdates(),
      },
      check: {
        title: "Check for Updates",
        key: onUpdates ? "command+r" : undefined,
        enabled: true,
        run: () => latest.current.checkForUpdates(),
      },
      purchased: {
        title: "Purchased",
        enabled: true,
        run: () => latest.current.openAccount(),
      },
    }),
    [canGoBack, canGoForward, onUpdates, signedIn],
  );
  const storeMenu = useMemo(
    () => (
      <>
        {row(commands.back)}
        {row(commands.forward)}
        {row(commands.reload)}
        {row(commands.search)}
        <MenuSeparator />
        {row(commands.account)}
        {row(commands.signOut)}
        <MenuSeparator />
        {row(commands.updates)}
        {row(commands.check)}
        <MenuSeparator />
        <MenuItem disabled title={NO_REDEEM}>
          Redeem…
        </MenuItem>
        {row(commands.purchased)}
      </>
    ),
    [commands],
  );
  const editMenu = useMemo(
    () => (
      <>
        <EditRows nothing={NO_FIELD} say={(message) => latest.current.say(message)} />
        <MenuSeparator />
        {row(commands.find)}
      </>
    ),
    [commands],
  );
  useDesktopAppMenu("app-store", "Store", storeMenu, within);
  useDesktopAppMenu("app-store", "Edit", editMenu, within);
  useEffect(() => {
    if (!isKey) return;
    const bindings: Record<string, () => void> = {};
    for (const command of Object.values(commands) as Command[]) {
      // The key is the command's even while it is dimmed, as in a Mac's menu bar.
      if (command.key) bindings[command.key] = command.enabled ? command.run : () => {};
    }
    return onMenuKeyEquivalents(window, bindings);
  }, [isKey, commands]);
}
