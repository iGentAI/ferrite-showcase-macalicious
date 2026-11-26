"use client";

import { useManagedWindow } from "macalicious/managed-window";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { useWindowManagerStore } from "macalicious/window-manager";
import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";
import { type ReactNode, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  changeDesktopValue,
  desktopValues,
  subscribeDesktopValues,
} from "../desktop/desktop-personal";
import {
  groupOf,
  joinTabs,
  leaveTabs,
  mergeTabs,
  NO_TABS,
  readTabs,
} from "../textedit/textedit-tab-groups";
import {
  answerTabKey,
  DocumentTabOverview,
  type DocumentTabs,
  DocumentTabViewItems,
  DocumentTabWindowItems,
  useDocumentTabs,
} from "../textedit/textedit-tabs";

/** The desktop value that holds which of Mail's windows are tabs of one another. */
export const MAIL_TABS = "mail.tabs";
const OPTIONS = { app: "mail", setting: MAIL_TABS };

/** Why Show Tab Bar and Show All Tabs are dimmed. */
export const NO_VIEWER_TABS =
  "The message viewer stays a window of its own: a message window or a New Message window takes tabs.";

/** The end of a window's id that says what it holds, the viewer it belongs to coming before it. */
const TABBED_WINDOW = /(?:compose-\d+|message-.+)$/;
const isTabbedWindow = (id: string) => id.startsWith("mail:") && TABBED_WINDOW.test(id);

/** The tabs of the key window when that is a message or a New Message window: what the menus act on. */
let keyTabs: DocumentTabs | null = null;
const listeners = new Set<() => void>();
const setKeyTabs = (tabs: DocumentTabs | null) => {
  if (keyTabs === tabs) return;
  keyTabs = tabs;
  for (const listener of listeners) listener();
};
const subscribeKeyTabs = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const useKeyTabs = () =>
  useSyncExternalStore(
    subscribeKeyTabs,
    () => keyTabs,
    () => null,
  );

/** The window that asked with + for a New Message window, which joins it as it opens. */
let newTabOwner: string | null = null;

const readRecord = () => readTabs(desktopValues()[MAIL_TABS]) ?? NO_TABS;

/**
 * Gives a message or New Message window its tabs. Lives inside the managed window; `children` places
 * `bar` under its title bar and spreads `rootProps` on its root. A viewer has one New Message window,
 * named by `composeSlot` while it is open: + opens it, or brings it into these tabs.
 */
export function MailTabbedWindow({
  state,
  composeSlot,
  onNewMessage,
  children,
}: {
  state: string | undefined;
  composeSlot: number | null;
  onNewMessage: () => void;
  children: (tabs: { bar: ReactNode; rootProps: DocumentTabs["rootProps"] }) => ReactNode;
}) {
  const { id } = useManagedWindow();
  const store = useWindowManagerStore();
  const opened = useDocumentTabs(OPTIONS);
  const composeId =
    composeSlot === null ? null : id.replace(TABBED_WINDOW, `compose-${composeSlot}`);
  const inGroup = useSyncExternalStore(
    subscribeDesktopValues,
    () => groupOf(readTabs(desktopValues()[MAIL_TABS]) ?? NO_TABS, id)?.ids.join("\n") ?? id,
    () => id,
  );
  const others = useSyncExternalStore(
    store.subscribe,
    () =>
      store
        .list()
        .some((window) => isTabbedWindow(window.id) && !inGroup.split("\n").includes(window.id)),
    () => false,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: for the window as it opens
  useEffect(() => {
    const owner = newTabOwner;
    if (!owner || owner === id) return;
    newTabOwner = null;
    const frame = store.get(owner)?.frame;
    if (!frame) return;
    store.patch(id, { frame });
    changeDesktopValue(MAIL_TABS, joinTabs(readRecord(), owner, id));
  }, []);

  const tabs = useMemo<DocumentTabs>(
    () => ({
      ...opened,
      canMerge: others,
      newTab: () => {
        if (composeId && store.get(composeId)) {
          const frame = store.get(id)?.frame;
          if (frame) store.patch(composeId, { frame });
          changeDesktopValue(
            MAIL_TABS,
            joinTabs(leaveTabs(readRecord(), composeId), id, composeId),
          );
          store.focus(composeId);
          return;
        }
        newTabOwner = id;
        onNewMessage();
      },
      mergeAll: () => {
        const ids = store
          .list()
          .map((window) => window.id)
          .filter(isTabbedWindow)
          .sort();
        changeDesktopValue(MAIL_TABS, mergeTabs(readRecord(), ids, id));
      },
    }),
    [opened, others, composeId, store, id, onNewMessage],
  );

  const isKey = state === "key";
  useEffect(() => {
    if (isKey) setKeyTabs(tabs);
  }, [isKey, tabs]);
  useEffect(() => {
    if (!isKey) return;
    return () => setKeyTabs(null);
  }, [isKey]);
  useEffect(() => {
    if (!isKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (!answerTabKey(tabs, event)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isKey, tabs]);

  const composeIsHere = composeId !== null && tabs.tabs.some((tab) => tab.id === composeId);
  const bar = (
    <>
      {tabs.barShown ? (
        <WindowTabBar
          aria-label="Tabs"
          value={tabs.selected}
          onValueChange={(value) => tabs.select(String(value))}
          onNewTab={composeIsHere ? undefined : tabs.newTab}
        >
          {tabs.tabs.map((tab) => (
            <WindowTab
              key={tab.id}
              value={tab.id}
              onClose={tabs.tabs.length > 1 ? () => tabs.closeTab(tab.id) : undefined}
            >
              {tab.title}
            </WindowTab>
          ))}
        </WindowTabBar>
      ) : null}
      <DocumentTabOverview tabs={tabs} />
    </>
  );
  return children({ bar, rootProps: tabs.rootProps });
}

/** View's rows for tabs: those of the key window, or dimmed while that is the viewer. */
export function MailTabViewItems() {
  const tabs = useKeyTabs();
  if (tabs) return <DocumentTabViewItems tabs={tabs} />;
  return (
    <>
      <MenuSeparator />
      <MenuItem disabled title={NO_VIEWER_TABS} data-reason={NO_VIEWER_TABS}>
        Show Tab Bar
      </MenuItem>
      <MenuItem disabled title={NO_VIEWER_TABS} data-reason={NO_VIEWER_TABS}>
        Show All Tabs
      </MenuItem>
    </>
  );
}

/** Window's rows for tabs, while the key window has them. */
export function MailTabWindowItems() {
  const tabs = useKeyTabs();
  if (!tabs) return null;
  return (
    <>
      <MenuSeparator />
      <DocumentTabWindowItems tabs={tabs} />
    </>
  );
}
