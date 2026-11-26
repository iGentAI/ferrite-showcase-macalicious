"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { useManagedWindow } from "macalicious/managed-window";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { useWindowManagerStore, type WindowManagerStore } from "macalicious/window-manager";
import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import {
  changeDesktopValue,
  desktopValues,
  subscribeDesktopValues,
} from "../desktop/desktop-personal";
import { DESKTOP_WINDOWS } from "../desktop/desktop-restore";
import { whenMenusClosed } from "../notes/notes-menus";
import {
  groupOf,
  joinTabs,
  leaveTabs,
  mergeTabs,
  NO_TABS,
  neighbourTab,
  pruneTabs,
  readTabs,
  selectTab,
  type TabGroup,
  type TabsRecord,
} from "./textedit-tab-groups";
import "./textedit-tabs.css";

/** The application a window's tabs belong to, and what it asks the desktop for a new tab with. */
export interface DocumentTabsOptions {
  app: string;
  /** The desktop value that holds the groups. */
  setting: string;
  /** `opening` of the `newWindow` effect, when the application has one. */
  opening?: unknown;
}

/** One window's view of its tabs. */
export interface DocumentTabs {
  /** The tabs of its group, itself alone when it has none. */
  tabs: readonly { id: string; title: string }[];
  selected: string;
  barShown: boolean;
  /** Show All Tabs is covering the window. */
  overview: boolean;
  /** The window has another that Merge All Windows would take. */
  canMerge: boolean;
  /** Spread on the window's root. */
  rootProps: { "data-document-tab-hidden"?: "" };
  select: (id: string) => void;
  step: (by: 1 | -1) => void;
  newTab: () => void;
  closeTab: (id: string) => void;
  toggleBar: () => void;
  toggleOverview: () => void;
  moveToNewWindow: () => void;
  mergeAll: () => void;
}

const NEXT_TAB = "control+tab";
const PREVIOUS_TAB = "control+shift+tab";
/** How far a tab moved to a window of its own stands from the tabs it left. */
const MOVED_OFFSET = 24;

const read = (setting: string): TabsRecord => readTabs(desktopValues()[setting]) ?? NO_TABS;
const write = (setting: string, next: TabsRecord, was: TabsRecord) => {
  if (next !== was) changeDesktopValue(setting, next);
};

/** The keys of the tab rows, for a window that answers keys itself: true when `event` ran one. */
export function answerTabKey(tabs: DocumentTabs, event: KeyboardEvent): boolean {
  if (tabs.tabs.length < 2) return false;
  if (matchesMenuKeyEquivalent(event, NEXT_TAB)) tabs.step(1);
  else if (matchesMenuKeyEquivalent(event, PREVIOUS_TAB)) tabs.step(-1);
  else return false;
  return true;
}

/** A window of the application that holds a document, not its Library or its Preferences. */
const isDocument = (id: string, app: string) =>
  id === app || (id.startsWith(`${app}:`) && /^\d+$/.test(id.slice(app.length + 1)));

/** The windows a group's tabs share: the frame, zoom and full screen of the one in front. */
function shareFrame(store: WindowManagerStore, from: string, to: string) {
  const source = store.get(from);
  if (!source || !store.get(to)) return;
  const { frame, zoomed, fullScreen } = source;
  const target = store.get(to);
  if (
    target &&
    target.zoomed === zoomed &&
    target.fullScreen === fullScreen &&
    target.frame.x === frame.x &&
    target.frame.y === frame.y &&
    target.frame.width === frame.width &&
    target.frame.height === frame.height
  ) {
    return;
  }
  store.patch(to, { frame, zoomed, fullScreen });
}

/**
 * Keeps the groups true to the windows. A tab made key by a command (the Window menu, the Dock, the
 * window closed before it) is selected. A tab made key with no such command, as the desktop bringing
 * its windows back in any order, gives way to the selected one. The others follow the selected one's
 * frame.
 */
function settleGroup(store: WindowManagerStore, setting: string, group: TabGroup) {
  if (!store.get(group.selected)) return;
  const key = group.ids.find((id) => store.get(id)?.state === "key");
  let selected = group.selected;
  if (key && key !== selected) {
    if (store.focusRequest(key) === 0) {
      store.focus(selected);
      return;
    }
    shareFrame(store, selected, key);
    const was = read(setting);
    write(setting, selectTab(was, key), was);
    selected = key;
  }
  for (const id of group.ids) if (id !== selected) shareFrame(store, selected, id);
}

/** A new tab asked for, which the next window of the application to open takes up. */
const newTabOwner = new Map<string, string>();
const prunedSettings = new Set<string>();

/** On the desktop: the tabs of the managed window it is called in. */
export function useDocumentTabs({ app, setting, opening }: DocumentTabsOptions): DocumentTabs {
  const store = useWindowManagerStore();
  const { id } = useManagedWindow();
  const record = useSyncExternalStore(
    subscribeDesktopValues,
    () => desktopValues()[setting],
    () => undefined,
  );
  const tabsRecord = useMemo(() => readTabs(record) ?? NO_TABS, [record]);
  const group = groupOf(tabsRecord, id);
  // Only what shows: every window is not to render again each time one moves.
  const shown = useSyncExternalStore(
    store.subscribe,
    () =>
      JSON.stringify({
        tabs: (group?.ids ?? [id]).flatMap((each) => {
          const window = store.get(each);
          return window ? [{ id: each, title: window.title }] : [];
        }),
        others: store
          .list()
          .some(
            (window) =>
              window.app === app &&
              isDocument(window.id, app) &&
              !group?.ids.includes(window.id) &&
              window.id !== id,
          ),
        ready: group ? store.get(group.selected) !== undefined : false,
      }),
    () => "",
  );
  const { tabs, others, ready } = useMemo(
    () =>
      (shown ? JSON.parse(shown) : { tabs: [], others: false, ready: false }) as {
        tabs: { id: string; title: string }[];
        others: boolean;
        ready: boolean;
      },
    [shown],
  );
  const [overview, setOverview] = useState(false);

  // Once a page, what windows gone without closing left behind; then a window asked for as a tab joins.
  // biome-ignore lint/correctness/useExhaustiveDependencies: for the window as it opens
  useEffect(() => {
    const was = read(setting);
    let next = was;
    const saved = desktopValues()[DESKTOP_WINDOWS];
    if (!prunedSettings.has(setting) && Array.isArray(saved)) {
      prunedSettings.add(setting);
      next = pruneTabs(
        next,
        new Set([
          ...saved.map((window: { id?: unknown }) => String(window?.id)),
          ...store.list().map((window) => window.id),
        ]),
      );
    }
    const owner = newTabOwner.get(setting);
    if (owner && owner !== id) {
      newTabOwner.delete(setting);
      shareFrame(store, owner, id);
      next = joinTabs(next, owner, id);
    }
    write(setting, next, was);
  }, []);

  useEffect(() => {
    let waiting = false;
    // After the command has run to its end: a focus changes the order first and asks for the keyboard after.
    const settle = () => {
      if (waiting) return;
      waiting = true;
      queueMicrotask(() => {
        waiting = false;
        const mine = groupOf(read(setting), id);
        if (mine) settleGroup(store, setting, mine);
      });
    };
    settle();
    const stopValues = subscribeDesktopValues(settle);
    const stopWindows = store.subscribe(settle);
    return () => {
      stopValues();
      stopWindows();
    };
  }, [store, setting, id]);

  // The window that closes hands the frame on: its neighbour already stands on it.
  useEffect(
    () => () => {
      const was = read(setting);
      const leaving = groupOf(was, id);
      const next = leaveTabs(was, id);
      write(setting, next, was);
      if (leaving?.selected === id) {
        const after = groupOf(next, leaving.ids.find((each) => each !== id) ?? "");
        const heir = after?.selected ?? leaving.ids.find((each) => each !== id);
        if (heir) store.focus(heir);
      }
    },
    [store, setting, id],
  );

  const hidden = group !== undefined && ready && group.selected !== id;

  // The window's frame, with its handles and shadow, is the manager's element, not one a window renders.
  useLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(id)}"]`);
    if (shell) shell.style.visibility = hidden ? "hidden" : "";
  }, [hidden, id]);

  // A tab that comes to the front takes the keyboard, in its text when it has one.
  const wasHidden = useRef(hidden);
  useEffect(() => {
    const came = wasHidden.current && !hidden;
    wasHidden.current = hidden;
    if (!came || store.get(id)?.state !== "key") return;
    whenMenusClosed(document, () => {
      const shell = document.querySelector(`[data-window-id="${CSS.escape(id)}"]`);
      const text = shell?.querySelector<HTMLElement>('[contenteditable="true"], textarea');
      (text ?? (shell?.firstElementChild as HTMLElement | null))?.focus({ preventScroll: true });
    });
  }, [hidden, store, id]);

  const live = useRef({ group, tabs });
  live.current = { group, tabs };
  return useMemo(() => {
    const select = (target: string) => {
      const was = read(setting);
      const current = groupOf(was, target);
      if (!current) return;
      setOverview(false);
      shareFrame(store, current.selected, target);
      write(setting, selectTab(was, target), was);
      store.focus(target);
    };
    return {
      tabs,
      selected: group?.selected ?? id,
      barShown: group !== undefined || tabsRecord.bars.includes(id),
      overview,
      canMerge: others,
      rootProps: hidden ? { "data-document-tab-hidden": "" as const } : {},
      select,
      step: (by) => {
        const current = live.current.group;
        if (current) select(neighbourTab(current, by));
      },
      newTab: () => {
        newTabOwner.set(setting, id);
        requestDesktopEffects([
          { newWindow: app, ...(opening === undefined ? undefined : { opening }) },
        ]);
      },
      closeTab: (target) => {
        select(target);
        document
          .querySelector<HTMLElement>(
            `[data-window-id="${CSS.escape(target)}"] [aria-label="Close"]`,
          )
          ?.click();
      },
      toggleBar: () => {
        const was = read(setting);
        const bars = was.bars.includes(id)
          ? was.bars.filter((each) => each !== id)
          : [...was.bars, id];
        write(setting, { ...was, bars }, was);
      },
      toggleOverview: () => setOverview((now) => !now),
      moveToNewWindow: () => {
        const was = read(setting);
        const current = groupOf(was, id);
        if (!current) return;
        const frame = store.get(id)?.frame;
        write(setting, leaveTabs(was, id), was);
        if (frame) {
          store.patch(id, {
            frame: { ...frame, x: frame.x + MOVED_OFFSET, y: frame.y + MOVED_OFFSET },
          });
        }
        store.focus(id);
      },
      mergeAll: () => {
        const was = read(setting);
        const ids = store
          .list()
          .filter((window) => window.app === app && isDocument(window.id, app))
          .map((window) => window.id)
          .sort();
        write(
          setting,
          mergeTabs(was, ids, ids.find((each) => store.get(each)?.state === "key") ?? id),
          was,
        );
      },
    };
  }, [tabs, group, tabsRecord, overview, others, hidden, store, setting, id, app, opening]);
}

/** The window's tab bar, when it shows one. */
export function DocumentTabBar({ tabs }: { tabs: DocumentTabs }) {
  if (!tabs.barShown) return null;
  return (
    <WindowTabBar
      aria-label="Tabs"
      value={tabs.selected}
      onValueChange={(value) => tabs.select(String(value))}
      onNewTab={tabs.newTab}
    >
      {tabs.tabs.map(({ id, title }) => (
        <WindowTab
          key={id}
          value={id}
          onClose={tabs.tabs.length > 1 ? () => tabs.closeTab(id) : undefined}
        >
          {title}
        </WindowTab>
      ))}
    </WindowTabBar>
  );
}

/** A picture of the window `id` as it stands: a copy of what it shows that takes no input. */
function TabPicture({ id }: { id: string }) {
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.querySelector(`[data-window-id="${CSS.escape(id)}"]`)?.firstElementChild;
    const place = holder.current;
    if (!(root instanceof HTMLElement) || !place) return;
    const copy = root.cloneNode(true) as HTMLElement;
    copy.removeAttribute("data-document-tab-hidden");
    copy.removeAttribute("id");
    copy.querySelector(".mac-textedit-tabs-overview")?.remove();
    const { offsetWidth, offsetHeight } = root;
    copy.style.width = `${offsetWidth}px`;
    copy.style.height = `${offsetHeight}px`;
    copy.style.transform = `scale(${place.clientWidth / Math.max(offsetWidth, 1)})`;
    place.replaceChildren(copy);
    return () => place.replaceChildren();
  }, [id]);
  return <div ref={holder} className="mac-textedit-tabs-picture" aria-hidden inert />;
}

/** View > Show All Tabs: every tab as a picture; choosing one brings it to the front. */
export function DocumentTabOverview({ tabs }: { tabs: DocumentTabs }) {
  const first = useRef<HTMLElement>(null);
  useEffect(() => {
    if (tabs.overview) first.current?.focus({ preventScroll: true });
  }, [tabs.overview]);
  if (!tabs.overview) return null;
  return (
    <section
      ref={first}
      className="mac-textedit-tabs-overview"
      aria-label="All Tabs"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        tabs.toggleOverview();
      }}
    >
      {tabs.tabs.map(({ id, title }) => (
        <button
          key={id}
          type="button"
          className="mac-textedit-tabs-card"
          aria-current={id === tabs.selected}
          onClick={() => {
            if (id === tabs.selected) tabs.toggleOverview();
            else tabs.select(id);
          }}
        >
          <TabPicture id={id} />
          {title}
        </button>
      ))}
    </section>
  );
}

/** View's rows for tabs. */
export function DocumentTabViewItems({ tabs }: { tabs: DocumentTabs }) {
  const several = tabs.tabs.length > 1;
  return (
    <>
      <MenuSeparator />
      <MenuItem disabled={several} onClick={tabs.toggleBar}>
        {tabs.barShown ? "Hide Tab Bar" : "Show Tab Bar"}
      </MenuItem>
      <MenuItem onClick={tabs.toggleOverview}>
        {tabs.overview ? "Exit Tab Overview" : "Show All Tabs"}
      </MenuItem>
    </>
  );
}

/** Window's rows for tabs. */
export function DocumentTabWindowItems({ tabs }: { tabs: DocumentTabs }) {
  const several = tabs.tabs.length > 1;
  return (
    <>
      <MenuItem disabled={!several} keyEquivalent={PREVIOUS_TAB} onClick={() => tabs.step(-1)}>
        Show Previous Tab
      </MenuItem>
      <MenuItem disabled={!several} keyEquivalent={NEXT_TAB} onClick={() => tabs.step(1)}>
        Show Next Tab
      </MenuItem>
      <MenuItem disabled={!several} onClick={tabs.moveToNewWindow}>
        Move Tab to New Window
      </MenuItem>
      <MenuItem disabled={!tabs.canMerge} onClick={tabs.mergeAll}>
        Merge All Windows
      </MenuItem>
    </>
  );
}
