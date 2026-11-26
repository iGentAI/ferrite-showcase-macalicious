"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { DisclosureTriangle } from "macalicious/disclosure-triangle";
import { EmptyState } from "macalicious/empty-state";
import { windowDragRegion } from "macalicious/lib/window-drag-region";
import {
  ListView,
  ListViewRowDetail,
  ListViewRowLeading,
  ListViewRowTrailing,
} from "macalicious/list-view";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import {
  NotificationAlert,
  NotificationAlertAction,
  NotificationAlertClose,
} from "macalicious/notification-alert";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { Sidebar, SidebarFooter, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SidebarBadge } from "macalicious/sidebar-badge";
import { SmartListTile, SmartListTileGrid } from "macalicious/smart-list-tile";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import {
  type ComponentType,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

/** What reminders being dragged carry: their ids, as JSON. */
const REMINDERS_DRAG = "application/x-macalicious-reminders";
/** What a list or a group being dragged in the sidebar carries: `{kind, id}`, as JSON. */
const SIDEBAR_DRAG = "application/x-macalicious-reminders-sidebar";

import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { filesOfDrag, useDesktopDrop } from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { useMainWindowItem } from "../desktop/desktop-main-window";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import {
  changeDesktopValue,
  desktopValues,
  desktopValuesLoaded,
  subscribeDesktopValues,
  useDesktopValue,
} from "../desktop/desktop-personal";
import { onSharedLink, takeSharedLinks } from "../desktop/desktop-share-link";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { isPicture } from "../preview/preview-export";
import { requestPane } from "../system-preferences/pane-request";
import { printDocument } from "../textedit/textedit-drive";
import { GroupGlyph, ListGlyph, PictureGlyph, SmartListGlyph } from "./reminders-artwork";
import {
  carriesReminderText,
  copyReminders,
  remindersFromDrop,
  remindersToPaste,
} from "./reminders-clipboard";
import {
  countOf,
  dayOf,
  defaultLists as initialLists,
  defaultReminders as initialReminders,
  inSource,
  LIST_COLORS,
  MAX_TITLE,
  matches,
  PRIORITY_MARKS,
  type Reminder,
  type ReminderColor,
  type ReminderGroup,
  type ReminderList,
  type ReminderSort,
  SMART_LISTS,
  sortReminders,
} from "./reminders-data";
import {
  addDays,
  changeReminder,
  completeReminder,
  dateOf,
  dueLabel,
  inViewerZone,
  localZone,
  parseEntry,
  timeOf,
} from "./reminders-dates";
import {
  attachPicture,
  copyReminderDetails,
  forgetGoneDetails,
  reminderPictures,
  useDetailsVersion,
} from "./reminders-details";
import { remindersFromIcs, remindersToIcs } from "./reminders-ics";
import { ReminderInfo } from "./reminders-info";
import {
  closedAlert,
  REMINDERS_SHARED_ALERTS,
  REMINDERS_TODAY_NOTIFICATION,
  REMINDERS_VIEW,
  readClosedAlerts,
  readRemindersView,
  readTodayNotification,
  remindersPrintLines,
  sharedAlerts,
  TODAY_ALERT,
  TODAY_NOTIFICATION_OFF,
  todayAlert,
} from "./reminders-kept";
import { ReminderListInfo } from "./reminders-list-info";
import { RemindersListWindow } from "./reminders-list-window";
import { closeLocationAlert, type LocationAlert, useLocationAlerts } from "./reminders-location";
import { mergeReminders } from "./reminders-merge";
import { REMINDERS_DEFAULT_LIST, readDefaultList } from "./reminders-preferences";
import { ReminderShare } from "./reminders-share";
import {
  addPerson,
  isSharedKey,
  leaveList,
  reminderOfOpenItem,
  removePerson,
  type SharedList,
  saveShared,
  sharedReminderId,
  sharedReminderKey,
  shareList,
  stopSharing,
  useSharedAdoptionKey,
  useSharedLists,
} from "./reminders-shared";
import { onSharedText, takeSharedTexts } from "./reminders-shared-text";
import {
  alertOf,
  type ReminderAlert,
  recordIdTag,
  refreshReminders,
  remindersReadable,
  type SavedReminders,
  saveReminders,
  settleReminders,
  storedAs,
  syncEnabled,
  tellAlertsShown,
  useAlertHost,
  useReminderAlerts,
  useRemindersAdoptionKey,
  useShownReminders,
  useUnsaved,
} from "./reminders-sync";
import { useReminderFieldTyping, useRemindersTextTools } from "./reminders-text-tools";
import {
  canIndent,
  type DropPlace,
  dropGroup,
  dropList,
  dropPlaceAt,
  dropReminders,
  freshName,
  indentReminders,
  moveToList,
  outdentReminders,
  outlineRows,
  type ReminderRow,
  scheduledRows,
  settleGroups,
  sidebarEntries,
  standBefore,
  withSubReminders,
} from "./reminders-tree";
import {
  NO_HISTORY,
  type RemindersState,
  recordChange,
  sameState,
  travelTo,
  type UndoHistory,
} from "./reminders-undo";
import "./reminders.tokens.css";
import "./reminders.css";

/** Why View > Show Info is dimmed while no reminder is selected. */
export const SHOW_INFO_UNAVAILABLE = "Select a reminder to show its info.";

/*
 * The lists of Reminders depart from the standard source list (reference/spec/apps/
 * reminders.md): rows of 36 pt with a 22 pt disc 20 pt from the edge and the label 9 pt after
 * it, the header's text and the footer's glyph 16 pt from the edge. The sidebar's rows are
 * 24 pt with an 18 pt icon box 18 pt from the edge, so the demo sets these through the parts'
 * `style`, and insets the header's text inside the title it passes.
 */
const LIST_ROW: CSSProperties = {
  height: 36,
  marginBlockEnd: 0,
  gap: 11,
  paddingInline: "22px 10.5px",
};
/* The selected list's count is darker than the others', where the sidebar badge's own colour
   for a selected row (Notes') is lighter. */
const LISTS: CSSProperties = {
  "--mac-sidebar-header-inset": "4px",
  "--mac-sidebar-badge-text-selected": "var(--mac-reminders-count-selected)",
} as CSSProperties;
/* Reminders' search field is 21 pt high, two points less than the sidebar field's 23 (y 105
   to 146 at 2x in both captures). The gap under it in reminders.css keeps the tiles in place. */
const SEARCH = { "--mac-search-field-height": "21px" } as CSSProperties;
const LISTS_TITLE: CSSProperties = { paddingInlineStart: 6 };
const FOOTER: CSSProperties = { paddingInline: 16, paddingBlockEnd: 2 };
/* The measured colours of this window, through the two components' documented hooks. */
const SPLIT = {
  "--mac-split-view-divider-color": "var(--mac-reminders-divider)",
} as CSSProperties;
const LIST = {
  "--mac-list-view-selected-background": "var(--mac-reminders-row-selected)",
} as CSSProperties;

const NOTHING: ReadonlySet<string> = new Set();
const NO_ALERTS: readonly ReminderAlert[] = [];
const NO_SHARED: readonly SharedList[] = [];
const NO_GROUPS: readonly ReminderGroup[] = [];
/** A list inside a group: its row's disc stands one step further in. */
const NESTED_ROW: CSSProperties = { ...LIST_ROW, paddingInline: "46px 10.5px" };
const UNSAVED_SHARE = "Your changes could not be saved, so the list was not shared. Try again.";
/** The longest address a reminder keeps (`MAX_URL_CHARS` in the module). */
const MAX_URL = 2048;

const HIDDEN = { display: "none" } as const;
const NO_CLOSED: Readonly<Record<string, number>> = {};
/** Why File > Share List… is dimmed. */
export const SHARE_UNAVAILABLE = "Sign in to share a list with other accounts.";
/** The reminders of shared lists, as a window keeps them: by keys of their own. */
const remindersOfShared = (lists: readonly SharedList[]): Reminder[] =>
  lists.flatMap((list) =>
    list.reminders.map((reminder) => ({
      ...reminder,
      id: sharedReminderKey(list.id, reminder.id),
      ...(reminder.parentId ? { parentId: sharedReminderKey(list.id, reminder.parentId) } : {}),
    })),
  );

/** Whether two lists of reminders differ, reminder by reminder. */
const changed = (a: readonly Reminder[], b: readonly Reminder[]) =>
  a.length !== b.length || a.some((reminder, index) => reminder !== b[index]);

/** The person's own reminders of a window's, the shared lists' left out. */
const ownOf = (reminders: readonly Reminder[]) =>
  reminders.filter((reminder) => !isSharedKey(reminder.id));

/** What the window does to share lists: each resolves to why it could not, or `null`. */
export interface ShareActions {
  /** The person's own account name. */
  me?: string;
  /** Shares the person's own list `list` with the account named `name`. */
  share: (list: string, name: string) => Promise<string | null>;
  /** The owner adds the account named `name` to shared list `list`. */
  add: (list: string, name: string) => Promise<string | null>;
  /** The owner takes the account named `name` off shared list `list`. */
  remove: (list: string, name: string) => Promise<string | null>;
  /** The person leaves shared list `list`. */
  leave: (list: string) => Promise<string | null>;
  /** The owner stops sharing list `list`, which goes back to their own lists. */
  stop: (list: string) => Promise<string | null>;
}
/** How often the reminders are read again while an alert names one the page does not hold. */
const UNKNOWN_RETRY = 2000;
/** How often a row's due minute is compared with the clock, to turn it red once past. */
const MINUTE_CHECK = 30_000;
/*
 * [provisional] The line under a reminder's title that says when it is due makes its row 18 pt
 * taller, a 13 pt line with the list view's detail margins. No reference capture shows one.
 */
/** The list's height of a heading of Scheduled: [provisional] no reference capture shows one. */
const DAY_HEADING = 30;
const DUE_LINE = 18;

/** A reminder of `rows` by its id. */
const rowOf = (rows: readonly Reminder[], id: string) => rows.find((each) => each.id === id);

/** The info mark a press or a click happened on, if any. */
const markOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest("[data-reminder-info]") : null;

/** Now, on the day `today`: what a new reminder's "tomorrow" or "at 9" counts from. */
const nowOn = (today: string) => dateOf(today, timeOf(new Date()));

export interface RemindersProps extends Omit<WindowProps, "children"> {
  /**
   * The lists the window starts with.
   * @default the three lists of `defaultLists`
   */
  defaultLists?: readonly ReminderList[];
  /**
   * The groups of lists the window starts with.
   * @default none
   */
  defaultGroups?: readonly ReminderGroup[];
  /**
   * The reminders the window starts with. Nothing is stored: they last as long as the
   * component is mounted.
   * @default the eighteen reminders of `defaultReminders`
   */
  defaultReminders?: readonly Reminder[];
  /**
   * What is shown at first: the `id` of a list, or of a smart list (`"today"`,
   * `"scheduled"`, `"all"`, `"flagged"`).
   * @default "imac-colors"
   */
  defaultSource?: string;
  /** Called with the `id` of the list or smart list the user chooses. */
  onSourceChange?: (source: string) => void;
  /**
   * The day that counts as today for the Today smart list, as `YYYY-MM-DD`.
   * @default the current day, in local time
   */
  today?: string;
  /**
   * The surface of the sidebar and of the info popover: the vibrant materials, for a window
   * over a desktop, or the same surfaces as captured over a neutral window.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /** Called when the close button is activated. */
  onClose?: WindowControlsProps["onClose"];
  /** Called when the minimize button is activated. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** Called when the zoom button is activated. */
  onZoom?: WindowControlsProps["onZoom"];
  /** What the zoom button does, as on `WindowControls`. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** Disable the minimize button. */
  minimizeDisabled?: boolean;
  /** Disable the zoom button. */
  zoomDisabled?: boolean;
  /** Further props for the `WindowControls`. */
  controlsProps?: WindowControlsProps;
  /**
   * Called when the primary pointer button goes down on the strip over the sidebar's search
   * field or over the list's title, not on a control in them. Reminders has no title bar:
   * these are its drag region, and a window manager starts moving the window here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  /** Called when the drag region is double-clicked: macOS zooms or minimizes the window. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
  /** Given by a desktop: renders a list in a window of its own. */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
}

/**
 * Reminders, as in macOS 10.15 Catalina: a sidebar with the window controls, a search field,
 * the four smart-list tiles and the user's lists, and beside it the chosen list with its
 * title, its count and its reminders, each with a round checkmark.
 *
 * The root is the library's `Window` and takes every one of its props, so a page or a window
 * manager places it (`style`, `width`, `height`, `ref`), tells it whether it is key (`state`)
 * and hears its window controls and its drag region through the callbacks. Nothing is stored
 * beyond the component's life.
 *
 * Served by the macalicious-desktop Ferrite application, it starts from the lists and
 * reminders the browser session saved there and saves them as they change, so they survive a
 * reload; while it is open, a reminder that falls due (at its due minute, or 9:00 on its day
 * without one, by the platform's clock) shows an alert under the menu bar until it is completed
 * or closed; and a signed-in person's lists can be shared with other accounts (Share List… in
 * a list's contextual menu), listed under Shared.
 */
export function Reminders(props: RemindersProps) {
  const enabled = syncEnabled();
  const shown = useShownReminders();
  const unsaved = useUnsaved();
  // Alerts are shown only over the session's own reminders: when they could not be read, the
  // window shows the sample ones, and completing an alert would change nothing that is saved.
  const { alerts: fired, dismiss } = useReminderAlerts(
    enabled && shown !== undefined && remindersReadable(),
  );
  // The page's alerts are drawn once, by the first Reminders window open.
  const host = useAlertHost();
  // An alert of a reminder this page does not know yet (another tab made it) is not shown, and so
  // cannot be completed or dismissed here, until the stored reminders are read again.
  const known = new Set(shown?.data?.reminders.map((reminder) => reminder.id));
  const alerts = fired.filter((alert) => known.has(alert.id));
  const unknown = fired
    .filter((alert) => !known.has(alert.id))
    .map((alert) => alert.id)
    .join(" ");
  // Read again until the reminder is known: a read is skipped while a change of this page waits,
  // and may fail.
  useEffect(() => {
    if (!unknown || !host) return;
    void refreshReminders();
    const timer = setInterval(() => void refreshReminders(), UNKNOWN_RETRY);
    return () => clearInterval(timer);
  }, [unknown, host]);
  // What this window draws it keeps out of Notification Center.
  const drawn = host ? alerts : NO_ALERTS;
  const drawnKeys = drawn.map((alert) => `${alert.id}@${alert.at}`).join(" ");
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again when the alerts drawn change.
  useEffect(() => tellAlertsShown(drawn), [drawnKeys]);
  // This window, as the origin of the changes it saves: it already shows them.
  const [origin] = useState(() => ({}));
  const save = useCallback((data: SavedReminders) => saveReminders(data, origin), [origin]);
  const adoption = useRemindersAdoptionKey(shown, origin);
  // The window takes in each document of the person's own it did not make by merging it
  // (`adoption`), keeping its own state. It is built again only when it is given no document at
  // all (nothing stored, or the stored one could not be read), and starts over then.
  const reset = useRef({ adoption, count: 0 });
  if (reset.current.adoption !== adoption) {
    reset.current = { adoption, count: reset.current.count + (shown?.data ? 0 : 1) };
  }
  // The lists shared with other accounts, read once the person's own are (and only when they
  // could be: sharing moves one of them).
  const shared = useSharedLists(enabled && shown !== undefined && remindersReadable());
  const sharedAdoption = useSharedAdoptionKey(shared, origin);
  const changeShared = useCallback(
    (list: ReminderList, reminders: Reminder[]) => saveShared(list, reminders, origin),
    [origin],
  );
  // The list or smart list last chosen here: a window built again from a document it adopts
  // opens on it, and on a list it has just shared.
  const lastSource = useRef<string | undefined>(undefined);
  const { onSourceChange } = props;
  const chooseSource = useCallback(
    (next: string) => {
      lastSource.current = next;
      onSourceChange?.(next);
    },
    [onSourceChange],
  );
  const sharing = useMemo<ShareActions | undefined>(
    () =>
      shared.canShare
        ? {
            me: shared.me,
            // Sharing moves the list the server holds: the page's changes to it are saved first.
            share: async (list, name) =>
              (await settleReminders())
                ? shareList(list, name, (id) => {
                    lastSource.current = id;
                  })
                : UNSAVED_SHARE,
            add: addPerson,
            remove: removePerson,
            leave: leaveList,
            stop: stopSharing,
          }
        : undefined,
    [shared.canShare, shared.me],
  );
  if (!enabled) return <RemindersView {...props} />;
  // The window stays empty for the moment the session's reminders are read.
  if (shown === undefined) {
    const { width = 768, height = 624, state = "key", style, className, ref } = props;
    return (
      <Window
        aria-label="Reminders"
        aria-busy
        state={state}
        width={width}
        height={height}
        style={style}
        ref={ref}
        className={className ? `mac-reminders ${className}` : "mac-reminders"}
      />
    );
  }
  return (
    <RemindersView
      {...props}
      keepsView
      // Another window's or browser's change, or the stored reminders read again, is merged into
      // the window (`adoption`): its changes not stored yet are made again on it, and a reminder
      // being typed, the open popover and what is shown stay. Only when no document is given is
      // the window built again. Shared lists another member or window changed are taken in the
      // same way (`sharedAdoption`).
      key={reset.current.count}
      adoption={adoption}
      // The page's copy is this window's own save, and it is stored: the window's baseline moves
      // to it. A copy the server sent (after a 409, say) is never taken for that; the effect
      // confirms that the page holds and has stored exactly what the window sent (`isStored`).
      stored={!unsaved && shown.origin === origin}
      isStored={storedAs}
      defaultSource={lastSource.current ?? props.defaultSource}
      onSourceChange={chooseSource}
      // The close button shows the dot of a document with unsaved changes while the reminders
      // the window shows, its own or a shared list's, are not the stored ones.
      controlsProps={{
        ...props.controlsProps,
        edited: unsaved || shared.unsaved || props.controlsProps?.edited,
      }}
      defaultLists={shown.data?.lists ?? props.defaultLists}
      defaultGroups={shown.data?.groups ?? (shown.data ? NO_GROUPS : props.defaultGroups)}
      defaultReminders={shown.data?.reminders ?? props.defaultReminders}
      onDataChange={save}
      sharedLists={shared.lists}
      sharedAdoption={sharedAdoption}
      onSharedChange={changeShared}
      sharing={sharing}
      alerts={drawn}
      alertHost={host}
      onAlertDismiss={dismiss}
    />
  );
}

export interface RemindersViewProps extends RemindersProps {
  /** Called with the lists and the reminders after every change to either. */
  onDataChange?: (data: SavedReminders) => void;
  /**
   * Changes each time the window is given a document of the person's own that it did not make
   * (`defaultLists` and `defaultReminders` then hold it): the window takes it in, its own changes
   * since the document it last took in made again on it (`mergeReminders`), and keeps a reminder
   * being typed, its open popovers and what it shows.
   */
  adoption?: string;
  /**
   * Whether the page's copy of the person's own document is this window's own last save and is
   * stored. Then that document is what the window's later changes are told from.
   */
  stored?: boolean;
  /**
   * Whether the page holds and has stored exactly `data`, the document as the window last sent
   * it: read from the synced document rather than from the render, which can come between two of
   * its changes. Without it, `stored` is taken at its word.
   */
  isStored?: (data: SavedReminders) => boolean;
  /** Reminders that fell due: each is shown as an alert under the menu bar. */
  alerts?: readonly ReminderAlert[];
  /**
   * Whether this window draws the page's alerts: it also watches for those no server arms, of
   * shared lists and the Today notification.
   */
  alertHost?: boolean;
  /** Called when an alert is completed or closed. */
  onAlertDismiss?: (alert: ReminderAlert) => void;
  /** The shared lists the person is on: listed under Shared, their reminders in the smart lists. */
  sharedLists?: readonly SharedList[];
  /**
   * Changes each time `sharedLists` brings lists the window did not change itself: their
   * reminders replace the window's copies of them, and nothing else of the window changes.
   */
  sharedAdoption?: number;
  /** Called with a shared list and its reminders after every change to them. */
  onSharedChange?: (list: ReminderList, reminders: Reminder[]) => void;
  /** What sharing does; without it the lists have no contextual menu. */
  sharing?: ShareActions;
  /** Keep the list shown, the sort and Show Completed with the person's desktop settings. */
  keepsView?: boolean;
}

export function RemindersView({
  defaultLists = initialLists,
  defaultGroups = NO_GROUPS,
  defaultReminders = initialReminders,
  defaultSource = "imac-colors",
  onSourceChange,
  keepsView = false,
  today: todayProp,
  material = "translucent",
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  DesktopWindow,
  onDataChange,
  adoption,
  stored = false,
  isStored,
  alerts = NO_ALERTS,
  alertHost = false,
  onAlertDismiss,
  sharedLists = NO_SHARED,
  sharedAdoption,
  onSharedChange,
  sharing,
  state = "key",
  width = 768,
  height = 624,
  className,
  ...props
}: RemindersViewProps) {
  const [lists, setLists] = useState(defaultLists);
  const [groups, setGroups] = useState(defaultGroups);
  // The person's own reminders, then those of the shared lists, known by keys of their own.
  const [reminders, setReminders] = useState<readonly Reminder[]>(() => [
    ...defaultReminders,
    ...remindersOfShared(sharedLists),
  ]);
  // What a request that took its time reads on coming back.
  const latest = useRef({ lists, sharedLists, reminders });
  latest.current = { lists, sharedLists, reminders };
  // Every change goes to `onDataChange` (the person's own lists) or `onSharedChange` (a shared
  // list's), but not the state the window opened with, which it was given (React may run this
  // effect twice on mount): saving it would change nothing, or, when nothing is stored, send the
  // starting reminders in place of an edit.
  const sent = useRef({ lists, groups, reminders });
  useEffect(() => {
    const before = sent.current;
    if (lists === before.lists && groups === before.groups && reminders === before.reminders) {
      return;
    }
    sent.current = { lists, groups, reminders };
    if (
      lists !== before.lists ||
      groups !== before.groups ||
      changed(ownOf(reminders), ownOf(before.reminders))
    ) {
      onDataChange?.({
        lists: [...lists],
        ...(groups.length > 0 ? { groups: [...groups] } : {}),
        reminders: ownOf(reminders),
      });
    }
    for (const list of sharedLists) {
      const of = (all: readonly Reminder[]) =>
        all.filter((reminder) => isSharedKey(reminder.id) && reminder.listId === list.id);
      const now = of(reminders);
      if (!changed(now, of(before.reminders))) continue;
      onSharedChange?.(
        list,
        now.map((reminder) => ({
          ...reminder,
          id: sharedReminderId(reminder.id),
          ...(reminder.parentId ? { parentId: sharedReminderId(reminder.parentId) } : {}),
        })),
      );
    }
  }, [lists, groups, reminders, sharedLists, onDataChange, onSharedChange]);
  const sharedRows = useMemo(
    () => sharedLists.map(({ id, name, color }): ReminderList => ({ id, name, color })),
    [sharedLists],
  );
  // A list both shared and among the person's own (a Stop Sharing cut short left it in both
  // places) shows once, as the shared list; its own copy stays saved as it is.
  const sharedIds = useMemo(() => new Set(sharedLists.map((each) => each.id)), [sharedLists]);
  const ownLists = useMemo(
    () => lists.filter((item) => !sharedIds.has(item.id)),
    [lists, sharedIds],
  );
  const visible = useMemo(
    () =>
      reminders
        .filter((reminder) => isSharedKey(reminder.id) || !sharedIds.has(reminder.listId))
        // On this browser's clocks: a reminder due at a minute in another zone is listed, counted
        // and edited at that moment here. Its alert's instant is the same.
        .map((reminder) => inViewerZone(reminder)),
    [reminders, sharedIds],
  );
  const allLists = useMemo(() => [...ownLists, ...sharedRows], [ownLists, sharedRows]);
  // A list that is not there (the session deleted it) is not opened: the first list is.
  const [source, setSource] = useState(() =>
    SMART_LISTS.some((item) => item.id === defaultSource) ||
    defaultLists.some((item) => item.id === defaultSource) ||
    defaultGroups.some((item) => item.id === defaultSource) ||
    sharedRows.some((item) => item.id === defaultSource)
      ? defaultSource
      : (defaultLists[0]?.id ?? sharedRows[0]?.id ?? defaultSource),
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const searchInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // Reminders that stay in view although the view's rule no longer holds them: the ones
  // completed or added while it is shown. They leave when another view is chosen.
  const [kept, setKept] = useState(NOTHING);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [importProblem, setImportProblem] = useState<string | null>(null);
  // The reminder whose info popover is open, and the mark in its row that the popover points at.
  const [info, setInfo] = useState<{ id: string; anchor: Element | null } | null>(null);
  // The list a contextual menu is on, and the list whose Share popover is open, each with its row.
  const [menuList, setMenuList] = useState<{ id: string; anchor: Element | null } | null>(null);
  const [sharingList, setSharingList] = useState<{ id: string; anchor: Element | null } | null>(
    null,
  );
  // The list whose Info popover (name and colour) is open, and the list a Delete asks about.
  const [listInfo, setListInfo] = useState<{ id: string; anchor: Element | null } | null>(null);
  const [removingList, setRemovingList] = useState<ReminderList | null>(null);
  // View > Show Completed: completed reminders stay in the views, where a click on their circle
  // makes them to do again.
  const [showCompleted, setShowCompleted] = useState(false);
  // View > Sort By.
  const [sort, setSort] = useState<ReminderSort>("manual");
  // The list the person left the window on, until it is shown or they choose another.
  const [savedSource, setSavedSource] = useState<string | null>(null);
  const listChosen = useRef(false);
  // The reminders and groups whose rows under them are hidden.
  const [collapsed, setCollapsed] = useState(NOTHING);
  const setExpanded = useCallback((id: string, expanded: boolean) => {
    setCollapsed((now) => {
      const next = new Set(now);
      if (expanded) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  // A group whose name is being typed, and what a drag over the sidebar or a row would do.
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [removingGroup, setRemovingGroup] = useState<ReminderGroup | null>(null);
  const [menuGroup, setMenuGroup] = useState<ReminderGroup | null>(null);
  const [sidebarDrop, setSidebarDrop] = useState<{ id: string; place: DropPlace } | null>(null);
  const [rowDrop, setRowDrop] = useState<{ id: string; place: DropPlace } | null>(null);
  const sidebarDragged = useRef<{ kind: "list" | "group"; id: string } | null>(null);
  // The sidebar's header: what makes this window the one the menu bar's items act on.
  const [top, setTop] = useState<HTMLDivElement | null>(null);
  const [ownToday, setOwnToday] = useState(() => dayOf(new Date()));
  const today = todayProp ?? ownToday;
  // A window left open over midnight moves on to the new day, unless the day is given. The
  // day is read again whenever the window starts keeping it itself: a given day that is taken
  // away later may have hidden a midnight.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new day sets the timer for the next
  useEffect(() => {
    if (todayProp !== undefined) return;
    const now = new Date();
    setOwnToday(dayOf(now));
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(
      () => setOwnToday(dayOf(new Date())),
      midnight.getTime() - now.getTime() + 1000,
    );
    return () => clearTimeout(timer);
  }, [todayProp, ownToday]);
  // The minute now, which a row due today at a minute compares with to turn red once past. It
  // is kept up to date only while such a row exists.
  const [nowMinute, setNowMinute] = useState(() => timeOf(new Date()));
  const timedToday = visible.some(
    (reminder) => reminder.due === today && reminder.dueTime !== undefined && !reminder.completed,
  );
  useEffect(() => {
    if (!timedToday) return;
    const tick = () => setNowMinute(timeOf(new Date()));
    tick();
    const timer = setInterval(tick, MINUTE_CHECK);
    return () => clearInterval(timer);
  }, [timedToday]);
  const serial = useRef(0);
  // An id that nothing in `taken` has: the reminders and lists given at first may use any.
  // File > Open List in New Window: the lists in windows of their own, while the page lives.
  const [listWindows, setListWindows] = useState<readonly string[]>([]);
  const [listWindowAsked, setListWindowAsked] = useState<{ id: string; serial: number } | null>(
    null,
  );
  const openListWindow = (id: string) => {
    if (!lists.some((item) => item.id === id)) return;
    setListWindows((open) => (open.includes(id) ? open : [...open, id]));
    setListWindowAsked((asked) => ({ id, serial: (asked?.serial ?? 0) + 1 }));
  };
  const fresh = (prefix: string, taken: (id: string) => boolean) => {
    let id: string;
    do {
      serial.current += 1;
      id = `${prefix}-${recordIdTag()}${serial.current}`;
    } while (taken(id));
    return id;
  };
  // The reminder whose field is open, known to the field's handlers at once: leaving the
  // field by a key also takes the focus from it, and that must not end the edit twice.
  const open = useRef<string | null>(null);
  // The open field. It takes the keyboard focus when it appears; the callback is stable, so
  // that happens once each time the field is rendered. The list view renders only the rows in
  // view, so a field scrolled far away is gone without having lost the focus: what was typed
  // is therefore kept here, not in the field, and `null` means nothing was typed.
  const draft = useRef<string | null>(null);
  const mountField = useCallback((input: HTMLInputElement | null) => {
    input?.focus();
  }, []);
  const list = useRef<HTMLDivElement>(null);
  // The window's document as of the last change that can be undone: no reminder still being typed.
  const clean = useRef<RemindersState>({ lists, groups, reminders });
  // Shared lists another member or window changed replace the window's copies of their
  // reminders; the person's own reminders, a reminder being typed and what is selected stay.
  // Taking them in is no change of this window's to save. Worked out from the reminders this
  // render committed, outside a state updater, which React may call more than once.
  const adopted = useRef(sharedAdoption);
  useEffect(() => {
    if (adopted.current === sharedAdoption) return;
    adopted.current = sharedAdoption;
    const incoming = remindersOfShared(sharedLists);
    // A reminder being typed in a shared list stays though the lists read do not have it yet
    // (one just added): ending the edit saves it with its list, as any change.
    const typing = reminders.find(
      (reminder) =>
        reminder.id === open.current &&
        isSharedKey(reminder.id) &&
        !incoming.some((item) => item.id === reminder.id) &&
        sharedLists.some((each) => each.id === reminder.listId),
    );
    const taken = [...ownOf(reminders), ...incoming];
    sent.current = { lists: sent.current.lists, groups: sent.current.groups, reminders: taken };
    clean.current = { lists, groups, reminders: taken };
    setReminders(typing ? [...taken, typing] : taken);
    // A shared list the person is no longer on is not left open: their first list is, or the
    // first shared list still there, or All.
    setSource((current) =>
      SMART_LISTS.some((item) => item.id === current) ||
      groups.some((item) => item.id === current) ||
      lists.some((item) => item.id === current) ||
      sharedLists.some((item) => item.id === current)
        ? current
        : (lists[0]?.id ?? sharedLists[0]?.id ?? "all"),
    );
  }, [sharedAdoption, sharedLists, lists, groups, reminders]);
  // The person's own document as the window last took it in (or was built from): what its
  // changes not stored yet are told from when another document comes in.
  const base = useRef({
    lists: [...defaultLists],
    groups: [...defaultGroups],
    reminders: [...defaultReminders],
  });
  const takenIn = useRef(adoption);
  useEffect(() => {
    if (takenIn.current === adoption) return;
    takenIn.current = adoption;
    const theirs = {
      lists: [...defaultLists],
      groups: [...defaultGroups],
      reminders: [...defaultReminders],
    };
    const own = mergeReminders(
      base.current,
      { lists: [...lists], groups: [...groups], reminders: ownOf(reminders) },
      theirs,
    );
    base.current = theirs;
    const shared = reminders.filter((reminder) => isSharedKey(reminder.id));
    // Taking the document in is no change of the window's: only what of its own it keeps on it
    // differs from it, and that is saved.
    sent.current = {
      lists: theirs.lists,
      groups: theirs.groups,
      reminders: [...theirs.reminders, ...shared],
    };
    clean.current = {
      lists: own.lists,
      groups: own.groups,
      reminders: [...own.reminders, ...shared].filter((reminder) => reminder.title !== ""),
    };
    setLists(own.lists);
    setGroups(own.groups);
    setReminders([...own.reminders, ...shared]);
    const present = new Set([...own.reminders, ...shared].map((reminder) => reminder.id));
    // A reminder being typed whose list went elsewhere goes with it, and its field.
    if (open.current !== null && !present.has(open.current)) {
      open.current = null;
      setEditing(null);
    }
    setInfo((now) => (now && present.has(now.id) ? now : null));
    setSelected((now) => (now !== null && present.has(now) ? now : null));
    setKept((now) => {
      const next = new Set([...now].filter((id) => present.has(id)));
      return next.size === now.size ? now : next;
    });
    setListInfo((now) => (now && own.lists.some((item) => item.id === now.id) ? now : null));
    setSource((current) =>
      SMART_LISTS.some((item) => item.id === current) ||
      own.groups.some((item) => item.id === current) ||
      own.lists.some((item) => item.id === current) ||
      sharedLists.some((item) => item.id === current)
        ? current
        : (own.lists[0]?.id ?? sharedLists[0]?.id ?? "all"),
    );
  }, [
    adoption,
    defaultLists,
    defaultGroups,
    defaultReminders,
    lists,
    groups,
    reminders,
    sharedLists,
  ]);
  // Once the document the window last sent is stored as its own, it is the baseline: a change
  // saved here is no longer the window's own over a newer one made elsewhere.
  useEffect(() => {
    if (!stored || takenIn.current !== adoption) return;
    const mine = {
      lists: [...sent.current.lists],
      groups: [...sent.current.groups],
      reminders: ownOf(sent.current.reminders),
    };
    if (isStored?.(mine) === false) return;
    base.current = mine;
  }, [stored, adoption, isStored]);
  // Set when a reminder is added: its row is at the end, and is brought into view.
  const added = useRef(false);
  useLayoutEffect(() => {
    if (!added.current) return;
    added.current = false;
    const view = list.current?.querySelector('[role="listbox"]');
    if (view) view.scrollTop = view.scrollHeight;
  });

  const searching = query.trim() !== "";
  const current = allLists.find((item) => item.id === source);
  const smart = SMART_LISTS.find((item) => item.id === source);
  const shownGroup = groups.find((item) => item.id === source);
  const shownGroupLists = useMemo(
    () =>
      shownGroup
        ? new Set(ownLists.filter((item) => item.groupId === shownGroup.id).map((item) => item.id))
        : null,
    [shownGroup, ownLists],
  );

  const listed = useMemo(
    () =>
      sortReminders(
        visible.filter(
          (reminder) =>
            kept.has(reminder.id) ||
            ((showCompleted || !reminder.completed) &&
              (searching
                ? matches(reminder, query)
                : shownGroupLists
                  ? shownGroupLists.has(reminder.listId)
                  : inSource(reminder, source, today))),
        ),
        sort,
      ),
    [visible, kept, showCompleted, searching, query, source, today, sort, shownGroupLists],
  );
  // A search lists what it found as it is; Scheduled by day, in Manual order by the minute on it;
  // anything else as an outline. Scheduled has its days instead of an outline, as a day's reminder
  // and its parent may be days apart.
  const scheduledView = !searching && source === "scheduled";
  const layout = useMemo<readonly ReminderRow[]>(
    () =>
      searching
        ? listed.map((reminder) => ({
            kind: "reminder",
            reminder,
            depth: 0,
            children: 0,
            collapsed: false,
          }))
        : scheduledView
          ? scheduledRows(sort === "manual" ? sortReminders(listed, "due") : listed, today)
          : outlineRows(listed, collapsed),
    [listed, searching, scheduledView, sort, today, collapsed],
  );
  const rows = useMemo(
    () => layout.flatMap((row) => (row.kind === "reminder" ? [row.reminder] : [])),
    [layout],
  );
  const reminderAt = (index: number) => {
    const row = layout[index];
    return row?.kind === "reminder" ? row.reminder : undefined;
  };

  const show = (next: string) => {
    listChosen.current = true;
    setSavedSource(null);
    flush();
    setInfo(null);
    setEditing(null);
    setSelected(null);
    setKept(NOTHING);
    setQuery("");
    // A reminder that was being added and has no text yet is dropped, as on Escape.
    setReminders((now) => now.filter((reminder) => reminder.title !== ""));
    if (next !== source) {
      setSource(next);
      onSourceChange?.(next);
    }
  };

  const search = (text: string) => {
    flush();
    setInfo(null);
    setEditing(null);
    setSelected(null);
    setKept(NOTHING);
    setReminders((now) => now.filter((reminder) => reminder.title !== ""));
    setQuery(text);
  };

  const toggle = useCallback((id: string) => {
    // A reminder that repeats moves to its next occurrence and stays to do. Completing either kind
    // completes its sub-reminders.
    setReminders((now) => {
      const parent = now.find((reminder) => reminder.id === id);
      const closes = parent && !parent.completed;
      return now.map((reminder) =>
        reminder.id === id
          ? reminder.completed
            ? { ...reminder, completed: false }
            : completeReminder(reminder)
          : closes && reminder.parentId === id && !reminder.completed
            ? { ...reminder, completed: true }
            : reminder,
      );
    });
    setKept((now) => new Set(now).add(id));
  }, []);

  const remove = useCallback((id: string) => {
    // A reminder that is removed while its field is open takes the edit with it.
    if (open.current === id) {
      open.current = null;
      setEditing(null);
    }
    setReminders((now) => now.filter((reminder) => reminder.id !== id && reminder.parentId !== id));
    setSelected((now) => (now === id ? null : now));
    setInfo((now) => (now?.id === id ? null : now));
  }, []);

  const edit = useCallback((id: string) => {
    open.current = id;
    draft.current = null;
    setEditing(id);
    setSelected(id);
  }, []);

  // Ends an edit: the text becomes the title, and a reminder left without text is removed. A new
  // reminder's text may say when it is due ("Call Martin tomorrow at 3pm"): that part sets its
  // due day and minute and leaves the title.
  const commit = useCallback(
    (id: string, text: string) => {
      if (open.current !== id) return;
      open.current = null;
      setEditing(null);
      const title = text.trim();
      if (title === "") remove(id);
      else
        setReminders((now) =>
          now.map((reminder) => {
            if (reminder.id !== id) return reminder;
            const entry = reminder.title === "" ? parseEntry(title, nowOn(today)) : { title };
            // A day and minute typed are this browser's: the reminder is in its zone.
            return entry.due
              ? {
                  ...reminder,
                  title: entry.title,
                  due: entry.due,
                  dueTime: entry.dueTime,
                  timeZone: localZone(),
                }
              : { ...reminder, title };
          }),
        );
    },
    [remove, today],
  );

  // Gives an edit up: the title stays, and a reminder that never had one is removed.
  const cancel = useCallback((id: string) => {
    if (open.current !== id) return;
    open.current = null;
    setEditing(null);
    setReminders((now) => now.filter((reminder) => reminder.id !== id || reminder.title !== ""));
  }, []);

  // Keeps the text of the open field before the view changes under it: a press on a list, a
  // tile or the plus acts before the field loses the focus, which is what would keep it. A
  // field in which nothing was typed is closed as by Escape.
  const flush = () => {
    const id = open.current;
    if (id === null) return;
    if (draft.current === null) cancel(id);
    else commit(id, draft.current);
  };

  // A new reminder goes to the list that is shown, and from a group to its first list, while it has
  // one, or from a smart list to the first list there is; in Flagged it is flagged, and in Today and Scheduled it is due today, so that it
  // belongs to the view. A search is cleared first: the reminder goes where it would have gone
  // before the search.
  const defaultListId = useDesktopValue(REMINDERS_DEFAULT_LIST, readDefaultList, "");
  const target =
    current ??
    (shownGroupLists
      ? ownLists.find((item) => shownGroupLists.has(item.id))
      : (ownLists.find((item) => item.id === defaultListId) ?? ownLists[0] ?? sharedRows[0]));
  const add = () => {
    if (!target) return;
    flush();
    // In a shared list it is known by a key of its own.
    const shared = sharedLists.some((each) => each.id === target.id);
    const keyOf = (candidate: string) =>
      shared ? sharedReminderKey(target.id, candidate) : candidate;
    const id = keyOf(
      fresh("new", (candidate) => reminders.some((item) => item.id === keyOf(candidate))),
    );
    const dueToday = source === "today" || source === "scheduled";
    const reminder: Reminder = {
      id,
      listId: target.id,
      title: "",
      createdAt: Date.now(),
      flagged: source === "flagged" ? true : undefined,
      due: dueToday ? today : undefined,
      timeZone: dueToday ? localZone() : undefined,
    };
    setQuery("");
    setReminders((now) => [...now.filter((item) => item.title !== ""), reminder]);
    setKept((now) => new Set(searching ? [] : now).add(id));
    added.current = true;
    edit(id);
  };

  // A link shared with Reminders (Share > Reminders in Safari, News and Stocks,
  // desktop-share-link.tsx): a reminder of its own in the list shown (from a smart list, the first
  // of the person's lists), titled with the link's title (its address when it has none), with the
  // address in its URL field, selected and saved as any other. Links shared while Reminders was
  // closed are taken as its window opens: on the desktop, once the person's reminders are read.
  const takeLinks = useRef<
    (
      links: readonly { title: string; url?: string; notes?: string }[],
      into?: { id: string },
    ) => void
  >(() => {});
  takeLinks.current = (links, into = target) => {
    if (!into || links.length === 0) return;
    flush();
    const shared = sharedLists.some((each) => each.id === into.id);
    const keyOf = (candidate: string) =>
      shared ? sharedReminderKey(into.id, candidate) : candidate;
    const taken = new Set(reminders.map((item) => item.id));
    const made = links.map((link): Reminder => {
      const id = keyOf(fresh("link", (candidate) => taken.has(keyOf(candidate))));
      taken.add(id);
      return {
        id,
        listId: into.id,
        createdAt: Date.now(),
        title: [...(link.title.trim() || link.url || "")].slice(0, MAX_TITLE).join(""),
        // An address longer than a reminder keeps is left out, rather than the reminder refused.
        ...(link.url && link.url.length <= MAX_URL ? { url: link.url } : {}),
        ...(link.notes ? { notes: link.notes } : {}),
      };
    });
    setQuery("");
    setReminders((now) => [...now.filter((item) => item.title !== ""), ...made]);
    setKept((now) => {
      const next = new Set(now);
      for (const each of made) next.add(each.id);
      return next;
    });
    setSelected(made.at(-1)?.id ?? null);
    added.current = true;
  };
  useEffect(() => {
    takeLinks.current(takeSharedLinks("reminders"));
    return onSharedLink("reminders", (link) => takeLinks.current([link]));
  }, []);
  useEffect(() => {
    takeLinks.current(takeSharedTexts());
    return onSharedText((shared) => takeLinks.current([shared]));
  }, []);

  const addList = () => {
    const taken = new Set(lists.map((item) => item.name));
    let name = "New List";
    for (let number = 2; taken.has(name); number++) name = `New List ${number}`;
    const id = fresh("list", (candidate) => lists.some((item) => item.id === candidate));
    setLists((now) => [
      ...now,
      { id, name, color: LIST_COLORS[now.length % LIST_COLORS.length] ?? "blue" },
    ]);
    show(id);
  };

  // Show Info's OK: the list's new name and colour, saved with the person's lists.
  const changeList = (id: string, change: { name: string; color: ReminderColor }) => {
    setLists((now) => now.map((item) => (item.id === id ? { ...item, ...change } : item)));
  };

  // File > New Group: a group with no lists yet, its name ready to be typed over.
  const addGroup = () => {
    flush();
    const id = fresh(
      "group",
      (candidate) =>
        groups.some((item) => item.id === candidate) || lists.some((item) => item.id === candidate),
    );
    const name = freshName(
      "New Group",
      groups.map((item) => item.name),
    );
    setGroups((now) => [...now, { id, name }]);
    setRenamingGroup(id);
  };

  const renameGroup = (id: string, text: string) => {
    setRenamingGroup((now) => (now === id ? null : now));
    const name = text.trim();
    if (name === "") return;
    setGroups((now) =>
      now.map((item) => (item.id === id && item.name !== name ? { ...item, name } : item)),
    );
  };

  // The group goes; with `lists` its lists go too, their reminders with them, as Delete of a list.
  const removeGroup = (id: string, withLists: boolean) => {
    flush();
    const going = ownLists.filter((item) => item.groupId === id).map((item) => item.id);
    const left = groups.filter((item) => item.id !== id);
    setGroups(left);
    if (withLists) {
      setInfo(null);
      setListInfo(null);
      setSelected(null);
      setKept(NOTHING);
      setLists((now) => now.filter((item) => !going.includes(item.id)));
      setReminders((now) =>
        now.filter((reminder) => isSharedKey(reminder.id) || !going.includes(reminder.listId)),
      );
    } else {
      setLists((now) => settleGroups(now, left));
    }
    if (source === id || (withLists && going.includes(source))) {
      const next =
        ownLists.find((item) => !withLists || !going.includes(item.id))?.id ??
        sharedRows[0]?.id ??
        "all";
      setSource(next);
      onSourceChange?.(next);
    }
  };

  // Delete, once confirmed: the list goes, and every reminder in it. The window moves to the
  // first list left (or the first shared list, or All) when it was showing the list.
  const deleteList = (id: string) => {
    flush();
    setInfo(null);
    setListInfo(null);
    setSelected(null);
    setKept(NOTHING);
    setLists((now) => now.filter((item) => item.id !== id));
    setReminders((now) =>
      now.filter((reminder) => isSharedKey(reminder.id) || reminder.listId !== id),
    );
    if (source === id) {
      const next = ownLists.find((item) => item.id !== id)?.id ?? sharedRows[0]?.id ?? "all";
      setSource(next);
      onSourceChange?.(next);
    }
  };

  const colors = useMemo(() => new Map(allLists.map((item) => [item.id, item])), [allLists]);
  // Rows from several lists say which list each is from.
  const mixed = searching || smart !== undefined || shownGroup !== undefined;
  const shown = info ? rows.find((reminder) => reminder.id === info.id) : undefined;
  const shownId = shown?.id;

  // The field's spelling and Substitutions, and the first picture of each row's reminder.
  const typing = useReminderFieldTyping();
  const detailsVersion = useDetailsVersion();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a change of the kept values asks again
  const firstPicture = useCallback((id: string) => reminderPictures(id)[0], [detailsVersion]);
  const renderRow = useCallback(
    (index: number) => {
      const row = layout[index];
      if (!row) return null;
      if (row.kind === "day") return <h2 className="mac-reminders-day">{row.label}</h2>;
      const { reminder, depth, children } = row;
      const owner = colors.get(reminder.listId);
      const marks = PRIORITY_MARKS[reminder.priority ?? "none"];
      const due = dueLabel(reminder, today, nowMinute);
      const title = (
        <span className="mac-reminders-text" data-completed={reminder.completed ? "" : undefined}>
          {reminder.title}
        </span>
      );
      return (
        <>
          {rowDrop?.id === reminder.id ? (
            <span className="mac-reminders-drop" data-place={rowDrop.place} />
          ) : null}
          <ListViewRowLeading className="mac-reminders-leading" data-depth={depth}>
            {children > 0 ? (
              <DisclosureTriangle
                className="mac-reminders-disclosure"
                aria-label={`Sub-reminders of ${reminder.title}`}
                tabIndex={-1}
                expanded={!row.collapsed}
                onExpandedChange={(expanded) => setExpanded(reminder.id, expanded)}
              />
            ) : null}
            <span
              className="mac-reminders-circle"
              data-reminder-toggle={reminder.id}
              data-color={owner?.color}
              data-completed={reminder.completed ? "" : undefined}
            />
          </ListViewRowLeading>
          {editing === reminder.id ? (
            <TextField
              bezel="none"
              className="mac-reminders-field"
              aria-label="Title"
              // What was typed before the row was scrolled out of view and back, if anything.
              defaultValue={draft.current ?? reminder.title}
              inputRef={mountField}
              spellCheck={typing.spellCheck}
              onInput={typing.onInput}
              onValueChange={(text) => {
                draft.current = text;
              }}
              onBlur={(event) => commit(reminder.id, event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit(reminder.id, event.currentTarget.value);
                else if (event.key === "Escape") cancel(reminder.id);
                else return;
                event.preventDefault();
                event.stopPropagation();
                list.current
                  ?.querySelector<HTMLElement>('[role="listbox"]')
                  ?.focus({ preventScroll: true });
              }}
            />
          ) : marks ? (
            <span className="mac-reminders-line">
              <span className="mac-reminders-priority" data-color={owner?.color} aria-hidden="true">
                {marks}
              </span>
              {title}
            </span>
          ) : (
            title
          )}
          {reminder.completed ? <span className="mac-reminders-hidden">, completed</span> : null}
          {marks ? (
            <span className="mac-reminders-hidden">, {reminder.priority} priority</span>
          ) : null}
          {due ? (
            <ListViewRowDetail
              className="mac-reminders-due"
              data-overdue={due.overdue && !reminder.completed ? "" : undefined}
            >
              {due.text}
            </ListViewRowDetail>
          ) : null}
          {reminder.images ? (
            <span className="mac-reminders-thumbnail" aria-hidden="true">
              {firstPicture(reminder.id) ? (
                <img className="mac-reminders-picture" src={firstPicture(reminder.id)} alt="" />
              ) : (
                <PictureGlyph />
              )}
            </span>
          ) : null}
          <ListViewRowTrailing className="mac-reminders-trailing">
            {mixed && owner ? <span className="mac-reminders-origin">{owner.name}</span> : null}
            {children > 0 ? (
              <span className="mac-reminders-origin">
                {children}
                <span className="mac-reminders-hidden"> sub-reminders</span>
              </span>
            ) : null}
            <span
              className="mac-reminders-info-mark"
              data-reminder-info={reminder.id}
              data-open={shownId === reminder.id ? "" : undefined}
            >
              <SystemImage name="info-outline" />
            </span>
          </ListViewRowTrailing>
        </>
      );
    },
    [
      layout,
      colors,
      editing,
      mixed,
      shownId,
      commit,
      cancel,
      mountField,
      today,
      nowMinute,
      rowDrop,
      setExpanded,
      typing,
      firstPicture,
    ],
  );
  // A reminder with pictures shows the first under its title, in a row 36 pt taller; one with a
  // due day says when under its title, in a row DUE_LINE taller.
  const rowHeight = useCallback(
    (index: number) => {
      const row = layout[index];
      if (row?.kind === "day") return DAY_HEADING;
      const reminder = row?.reminder;
      return (reminder?.images ? 70 : 34) + (reminder?.due ? DUE_LINE : 0);
    },
    [layout],
  );
  const getRowId = useCallback(
    (index: number) => {
      const row = layout[index];
      return row?.kind === "day" ? row.id : (row?.reminder.id ?? index);
    },
    [layout],
  );
  const getRowLabel = useCallback(
    (index: number) => {
      const row = layout[index];
      return row?.kind === "day" ? "" : (row?.reminder.title ?? "");
    },
    [layout],
  );
  const isRowHeading = useCallback((index: number) => layout[index]?.kind === "day", [layout]);

  // Reminders has no title bar: the sidebar's header and the strip over the list's title
  // move the window.
  const dragRegion = windowDragRegion<HTMLDivElement>(
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
  );

  const title = searching
    ? `Results for “${query.trim()}”`
    : (current?.name ?? smart?.name ?? shownGroup?.name ?? "");
  const tint = searching ? "gray" : (current?.color ?? smart?.color ?? "gray");
  const groupCount = (id: string) =>
    ownLists
      .filter((item) => item.groupId === id)
      .reduce((sum, item) => sum + countOf(visible, item.id, today), 0);
  const count = searching
    ? rows.filter((reminder) => !reminder.completed).length
    : shownGroup
      ? groupCount(shownGroup.id)
      : countOf(visible, source, today);

  const menuShared = menuList ? sharedLists.find((each) => each.id === menuList.id) : undefined;
  // A list of the person's own, as the contextual menu's Show Info and Delete act on it.
  const menuOwn = menuList ? ownLists.find((each) => each.id === menuList.id) : undefined;
  const infoList = listInfo ? ownLists.find((each) => each.id === listInfo.id) : undefined;
  const removingCount = removingList
    ? reminders.filter(
        (reminder) => reminder.listId === removingList.id && !isSharedKey(reminder.id),
      ).length
    : 0;
  const sharedOpen = sharingList
    ? sharedLists.find((each) => each.id === sharingList.id)
    : undefined;
  const ownOpen = sharingList ? lists.find((each) => each.id === sharingList.id) : undefined;

  // Show Info (View menu, Command-I): the selected reminder's info, beside its row's mark.
  const selectedRow = selected === null ? undefined : rows.find((item) => item.id === selected);
  const showSelectedInfo = () => {
    if (!selectedRow) return;
    const marks = list.current?.querySelectorAll("[data-reminder-info]") ?? [];
    const mark = [...marks].find(
      (item) => item.getAttribute("data-reminder-info") === selectedRow.id,
    );
    setInfo({ id: selectedRow.id, anchor: mark ?? list.current });
  };
  // On the desktop, the menu bar's File and View menus act on this window while it is in front.
  const printViewRef = useRef<() => void>(() => {});
  const importInput = useRef<HTMLInputElement>(null);
  const exportable = current ? reminders.filter((each) => each.listId === current.id) : rows;
  const exportReminders = () => {
    const held = exportable;
    const name = current?.name ?? "Reminders";
    const url = URL.createObjectURL(
      new Blob([remindersToIcs(name, held)], { type: "text/calendar" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/[\\/:*?"<>|]+/g, "-")}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importReminders = async (file: File) => {
    if (!target) return;
    const read = remindersFromIcs(await file.text());
    const fits = read.filter(({ url }) => !url || url.length <= MAX_URL);
    if (fits.length === 0) {
      setImportProblem(`There are no reminders in \u201c${file.name}\u201d.`);
      return;
    }
    flush();
    const shared = sharedLists.some((each) => each.id === target.id);
    const keyOf = (candidate: string) =>
      shared ? sharedReminderKey(target.id, candidate) : candidate;
    const taken = new Set(reminders.map((item) => item.id));
    const made = fits.map((each): Reminder => {
      const id = keyOf(fresh("imported", (candidate) => taken.has(keyOf(candidate))));
      taken.add(id);
      return {
        ...each,
        id,
        listId: target.id,
        createdAt: Date.now(),
        title: [...each.title].slice(0, MAX_TITLE).join(""),
      };
    });
    setReminders((now) => [...now.filter((item) => item.title !== ""), ...made]);
  };
  useDesktopAppMenu(
    "reminders",
    "Dock",
    <MenuItem disabled={!target} onClick={add}>
      New Reminder
    </MenuItem>,
  );
  useDesktopAppMenu(
    "reminders",
    "File",
    <>
      <MenuItem disabled={!target} keyEquivalent="command+n" onClick={add}>
        New Reminder
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+n" onClick={addList}>
        New List
      </MenuItem>
      <MenuItem onClick={addGroup}>New Group</MenuItem>
      <MenuItem
        disabled={!sharing || !current}
        title={sharing ? undefined : SHARE_UNAVAILABLE}
        onClick={() => {
          if (!current) return;
          flush();
          setInfo(null);
          const within = list.current?.closest(".mac-reminders") ?? document;
          const anchor =
            [...within.querySelectorAll("[data-reminders-list]")].find(
              (row) => row.getAttribute("data-reminders-list") === current.id,
            ) ?? null;
          setSharingList({ id: current.id, anchor });
        }}
      >
        {sharedLists.some((each) => each.id === source && !each.owned)
          ? "Show People…"
          : "Share List…"}
      </MenuItem>
      {DesktopWindow ? (
        <MenuItem
          disabled={!lists.some((item) => item.id === source)}
          onClick={() => openListWindow(source)}
        >
          Open List in New Window
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem disabled={!target} onClick={() => importInput.current?.click()}>
        Import…
      </MenuItem>
      <MenuItem disabled={exportable.length === 0} onClick={exportReminders}>
        Export “{current?.name ?? "Reminders"}”…
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => printViewRef.current()}>Export as PDF…</MenuItem>
      <MenuItem keyEquivalent="command+p" onClick={() => printViewRef.current()}>
        Print…
      </MenuItem>
    </>,
    top,
  );
  useMainWindowItem("reminders", "Reminders", top);
  useDesktopAppMenu(
    "reminders",
    "Reminders",
    <MenuItem
      onClick={() => {
        requestPane("internet-accounts");
        requestDesktopEffects([{ open: "system-preferences" }]);
      }}
    >
      Accounts…
    </MenuItem>,
    top,
  );
  // A change of the selected reminders from the menu bar or their contextual menu, saved as any
  // other. `selected` is the row the commands read from; `picked`, the rest of a selection of
  // several, which counts while it holds `selected`.
  const selection =
    selected === null
      ? []
      : (picked.includes(selected) ? picked : [selected]).filter((id) =>
          rows.some((reminder) => reminder.id === id),
        );
  const patchSelected = (fields: Partial<Reminder>) => {
    setReminders((now) =>
      now.map((reminder) =>
        selection.includes(reminder.id) ? { ...reminder, ...fields } : reminder,
      ),
    );
  };
  const moveSelectedTo = (to: string) => () => {
    setReminders((now) => moveToList(now, selection, to));
  };
  const flagSelected = () => {
    if (selectedRow) patchSelected({ flagged: selectedRow.flagged ? undefined : true });
  };
  // What the command says, for all of them: the row it reads from decides, and a reminder already so
  // stays so.
  const toggleSelected = () => {
    const completing = !selectedRow?.completed;
    const parents = new Set(selection);
    for (const id of selection) {
      const reminder = rows.find((each) => each.id === id);
      // A parent being completed takes its sub-reminders along.
      if (completing && reminder?.parentId && parents.has(reminder.parentId)) continue;
      if (reminder && Boolean(reminder.completed) !== completing) toggle(id);
    }
  };
  const deleteSelected = () => {
    if (!selectedRow) return;
    const going = new Set(selection);
    const at = rows.findIndex((reminder) => reminder.id === selectedRow.id);
    const next =
      rows.slice(at + 1).find((reminder) => !going.has(reminder.id)) ??
      rows.slice(0, at).findLast((reminder) => !going.has(reminder.id));
    for (const id of selection) remove(id);
    setSelected(next?.id ?? null);
  };
  const selectAll = () => {
    const last = rows.at(-1);
    setPicked(rows.map((reminder) => reminder.id));
    setSelected(last?.id ?? null);
  };
  // Only the person's own reminders move between the person's own lists: a shared list's are known
  // by keys of that list.
  const canMove = selection.every((id) =>
    ownLists.some((item) => item.id === rows.find((reminder) => reminder.id === id)?.listId),
  );
  const find = () => searchInput.current?.focus();
  // Edit > Indent and Outdent: an outline only where the rows are one, not in a search or by day.
  const outlined = !searching && !scheduledView;
  const shownIds = rows.map((reminder) => reminder.id);
  const indentable = outlined && canIndent(reminders, selection, shownIds);
  const outdentable = outlined && selection.some((id) => rowOf(rows, id)?.parentId);
  const indent = () => {
    if (!indentable) return;
    const next = indentReminders(reminders, selection, shownIds);
    setReminders(next);
    // The new parent shows what went under it.
    for (const id of selection) {
      const parent = next.find((reminder) => reminder.id === id)?.parentId;
      if (parent && collapsed.has(parent)) setExpanded(parent, true);
    }
  };
  const outdent = () => {
    if (outdentable) setReminders((now) => outdentReminders(now, selection));
  };
  // Undo and Redo: what the window changed, in its order, whichever window took in what since.
  const [history, setHistory] = useState<UndoHistory>(NO_HISTORY);
  // Typing in one showing of a reminder's info is one step of Undo; showing it again starts another.
  const infoRun = useRef({ of: info, count: 0 });
  if (infoRun.current.of !== info) infoRun.current = { of: info, count: infoRun.current.count + 1 };
  const infoKey = useRef<string | undefined>(undefined);
  infoKey.current = info ? `${info.id}#${infoRun.current.count}` : undefined;
  useEffect(() => {
    // A reminder being typed is no change yet: the change is made once it has a title.
    if (reminders.some((reminder) => reminder.title === "")) return;
    const now: RemindersState = { lists, groups, reminders };
    const before = clean.current;
    if (sameState(before, now)) return;
    clean.current = now;
    setHistory((was) => recordChange(was, before, now, infoKey.current));
  }, [lists, groups, reminders]);
  const travel = (back: boolean) => {
    // Text being typed is the latest change: Undo takes that, and Redo finds nothing to redo after it.
    if (open.current !== null && draft.current !== null) {
      if (back) cancel(open.current);
      else commit(open.current, draft.current);
      return;
    }
    const step = (back ? history.past : history.future).at(-1);
    if (!step) return;
    flush();
    const now = {
      lists,
      groups,
      reminders: reminders.filter((reminder) => reminder.title !== ""),
    };
    const travelled = back
      ? travelTo(step.after, step.before, now)
      : travelTo(step.before, step.after, now);
    // A shared list left since then takes its reminders with it: they could not be saved.
    const next = {
      ...travelled,
      reminders: travelled.reminders.filter(
        (reminder) =>
          !isSharedKey(reminder.id) || sharedLists.some((each) => each.id === reminder.listId),
      ),
    };
    clean.current = next;
    setHistory({
      past: back ? history.past.slice(0, -1) : [...history.past, step],
      future: back ? [...history.future, step] : history.future.slice(0, -1),
    });
    setInfo(null);
    setLists(next.lists);
    setGroups(next.groups);
    setReminders(next.reminders);
    // What came back stays in view though its view's rule would not hold it, as a change does.
    setKept((was) => {
      const out = new Set(was);
      for (const reminder of next.reminders) {
        if (!now.reminders.includes(reminder)) out.add(reminder.id);
      }
      return out;
    });
    const known =
      SMART_LISTS.some((item) => item.id === source) ||
      next.lists.some((item) => item.id === source) ||
      next.groups.some((item) => item.id === source) ||
      sharedRows.some((item) => item.id === source);
    if (!known) {
      const other = next.lists[0]?.id ?? sharedRows[0]?.id ?? "all";
      setSource(other);
      onSourceChange?.(other);
    }
  };
  // Copy holds a parent with its sub-reminders. The selection is own reminders or a shared list's.
  const copySelected = () => {
    if (selection.length === 0) return;
    const ids = withSubReminders(reminders, selection);
    const taken = reminders.filter((reminder) => ids.includes(reminder.id));
    copyReminders([...taken].sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0)));
  };
  const cutSelected = () => {
    copySelected();
    deleteSelected();
  };
  // Paste makes new reminders in the list a new one would go to, after the selected row and what is
  // under it, in the way a new one is made to belong to the view.
  const paste = async () => {
    const into = target;
    if (!into) return;
    const copies = await remindersToPaste();
    if (copies.length === 0) return;
    // The clipboard took its time: the list may have gone, or stopped being shared.
    const now = latest.current;
    const inShared = now.sharedLists.some((each) => each.id === into.id);
    if (!inShared && !now.lists.some((each) => each.id === into.id)) return;
    flush();
    const keyOf = (candidate: string) =>
      inShared ? sharedReminderKey(into.id, candidate) : candidate;
    const ids = new Map<string, string>();
    const taken = new Set(now.reminders.map((item) => item.id));
    for (const copy of copies) {
      const id = keyOf(fresh("new", (candidate) => taken.has(keyOf(candidate))));
      taken.add(id);
      ids.set(copy.id, id);
      copyReminderDetails(copy.id, id);
    }
    const dueToday = source === "today" || source === "scheduled";
    const made = copies.map((copy): Reminder => {
      const { id, parentId, ...rest } = copy;
      const parent = parentId ? ids.get(parentId) : undefined;
      return {
        ...rest,
        id: ids.get(id) as string,
        listId: into.id,
        createdAt: Date.now(),
        ...(parent ? { parentId: parent } : {}),
        ...(source === "flagged" ? { flagged: true } : {}),
        ...(dueToday && !copy.due ? { due: today, timeZone: localZone() } : {}),
      };
    });
    const after = selectedRow?.listId === into.id ? selectedRow : undefined;
    setQuery("");
    setReminders((now) => {
      const clear = now.filter((item) => item.title !== "");
      const anchor = after?.parentId ?? after?.id;
      const at = anchor
        ? clear.findLastIndex((item) => item.id === anchor || item.parentId === anchor) + 1
        : clear.length;
      return [...clear.slice(0, at), ...made, ...clear.slice(at)];
    });
    setKept((now) => {
      const next = new Set(now);
      for (const each of made) next.add(each.id);
      return next;
    });
    setPicked(made.map((each) => each.id));
    setSelected(made.at(-1)?.id ?? null);
  };
  // Reminders dragged out of the list onto one of the person's own lists; a shared list's reminders
  // are known by keys of that list and stay where they are.
  const [hoverList, setHoverList] = useState<string | null>(null);
  const dragReminders = (event: DragEvent<HTMLElement>) => {
    const row = (event.target as Element).closest<HTMLElement>("[data-index]");
    const reminder = row ? reminderAt(Number(row.dataset.index)) : undefined;
    if (!reminder) return;
    const ids = selection.includes(reminder.id) ? selection : [reminder.id];
    const dragged = rows.filter((each) => ids.includes(each.id));
    if (!dragged.every((each) => ownLists.some((item) => item.id === each.listId))) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(REMINDERS_DRAG, JSON.stringify(ids));
    event.dataTransfer.setData("text/plain", dragged.map((each) => each.title).join("\n"));
  };
  // A drop on a row of the list in Manual order: at the row's top or bottom edge those dragged go
  // over or under it, and on the rest of it they become its sub-reminders. A smart list and a search
  // show no one list's order, and another sort has its own.
  const canReorder = sort === "manual" && !smart && !shownGroup && !searching;
  const dropAt = (event: DragEvent<HTMLElement>) => {
    const row = (event.target as Element).closest<HTMLElement>("[data-index]");
    const on = row ? reminderAt(Number(row.dataset.index)) : undefined;
    if (!row || !on) return null;
    const box = row.getBoundingClientRect();
    return { id: on.id, place: dropPlaceAt(event.clientY - box.top, box.height) };
  };
  // A picture dragged in from outside goes on the reminder it is dropped on.
  const attachPictures = async (id: string, files: readonly File[]) => {
    let added = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const problem = await attachPicture(id, file);
      if (problem) {
        setImportProblem(problem);
        break;
      }
      added += 1;
    }
    if (added === 0) return;
    setReminders((now) =>
      now.map((each) => (each.id === id ? { ...each, images: (each.images ?? 0) + added } : each)),
    );
  };
  // The same from Finder, whose drag follows the pointer and carries no browser drag data.
  const pictureDrop = useDesktopDrop({
    accepts: (item) => item.kind === "file" && isPicture(item),
    refusal: () => "A reminder takes pictures.",
    sayRefusal: setImportProblem,
    onDrop: async (items, drag) => {
      const hit = drag.at && document.elementFromPoint(drag.at.x, drag.at.y);
      const row = hit?.closest<HTMLElement>("[data-index]");
      const on = row ? reminderAt(Number(row.dataset.index)) : undefined;
      if (on) await attachPictures(on.id, await filesOfDrag(items));
    },
  });
  const reorderOver = (event: DragEvent<HTMLElement>) => {
    if ([...event.dataTransfer.types].includes("Files")) {
      const at = dropAt(event);
      if (!at) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setRowDrop((now) =>
        now?.id === at.id && now.place === "into" ? now : { id: at.id, place: "into" },
      );
      return;
    }
    if (!canReorder || ![...event.dataTransfer.types].includes(REMINDERS_DRAG)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const at = dropAt(event);
    setRowDrop((now) => (now?.id === at?.id && now?.place === at?.place ? now : at));
  };
  const reorderDrop = (event: DragEvent<HTMLElement>) => {
    setRowDrop(null);
    if ([...event.dataTransfer.types].includes("Files")) {
      const at = dropAt(event);
      if (!at) return;
      event.preventDefault();
      void attachPictures(at.id, [...event.dataTransfer.files]);
      return;
    }
    const raw = event.dataTransfer.getData(REMINDERS_DRAG);
    if (!canReorder || !raw) return;
    event.preventDefault();
    const ids = JSON.parse(raw) as string[];
    const at = dropAt(event);
    setReminders((now) => dropReminders(now, ids, at?.id, at?.place ?? "after"));
    if (at?.place === "into") setExpanded(at.id, true);
  };
  const dropOnList = (to: string) => ({
    "data-drop-target": hoverList === to ? "" : undefined,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const types = [...event.dataTransfer.types];
      if (types.includes(REMINDERS_DRAG)) {
        event.dataTransfer.dropEffect = "move";
      } else if (carriesReminderText(types)) {
        // Mail's drag allows only a move; the message stays in its mailbox all the same.
        event.dataTransfer.dropEffect =
          event.dataTransfer.effectAllowed === "move" ? "move" : "copy";
      } else return;
      event.preventDefault();
      setHoverList(to);
    },
    onDragLeave: () => setHoverList((now) => (now === to ? null : now)),
    onDrop: (event: DragEvent<HTMLElement>) => {
      setHoverList(null);
      const raw = event.dataTransfer.getData(REMINDERS_DRAG);
      if (!raw) {
        if (!carriesReminderText([...event.dataTransfer.types])) return;
        event.preventDefault();
        takeLinks.current(remindersFromDrop(event.dataTransfer), { id: to });
        return;
      }
      event.preventDefault();
      const ids = JSON.parse(raw) as string[];
      setReminders((now) => moveToList(now, ids, to));
    },
  });
  // Lists and groups dragged within My Lists. A list goes beside a row, or into a group at the
  // middle of its row; a group goes beside a row, its lists with it. Over the blank under the rows,
  // either goes last.
  const dragInSidebar = (kind: "list" | "group", id: string) => ({
    draggable: renamingGroup !== id,
    onDragStart: (event: DragEvent<HTMLElement>) => {
      sidebarDragged.current = { kind, id };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(SIDEBAR_DRAG, id);
    },
    onDragEnd: () => {
      sidebarDragged.current = null;
      setSidebarDrop(null);
    },
  });
  const sidebarDropOn = (rowKind: "list" | "group", id: string, inGroup?: string) => {
    const placeOf = (event: DragEvent<HTMLElement>): DropPlace | null => {
      const dragged = sidebarDragged.current;
      if (!dragged || dragged.id === id || (dragged.kind === "group" && inGroup === dragged.id)) {
        return null;
      }
      const box = event.currentTarget.getBoundingClientRect();
      const offset = event.clientY - box.top;
      const place = dropPlaceAt(offset, box.height);
      return place !== "into" || (rowKind === "group" && dragged.kind === "list")
        ? place
        : offset < box.height / 2
          ? "before"
          : "after";
    };
    return {
      "data-drop-edge": sidebarDrop?.id === id ? sidebarDrop.place : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (![...event.dataTransfer.types].includes(SIDEBAR_DRAG)) return;
        event.stopPropagation();
        const place = placeOf(event);
        if (!place) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setSidebarDrop((now) => (now?.id === id && now.place === place ? now : { id, place }));
      },
      onDragLeave: () => setSidebarDrop((now) => (now?.id === id ? null : now)),
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (![...event.dataTransfer.types].includes(SIDEBAR_DRAG)) return;
        event.stopPropagation();
        const place = placeOf(event);
        setSidebarDrop(null);
        if (!place) return;
        event.preventDefault();
        dropInSidebar(id, place);
      },
    };
  };
  const dropInSidebar = (on: string | undefined, place: DropPlace) => {
    const dragged = sidebarDragged.current;
    if (!dragged) return;
    if (dragged.kind === "list") {
      const next = dropList(lists, dragged.id, on, place, groups);
      setLists(next);
      setGroups((now) => standBefore(now, next, on, place, dragged.id));
    } else {
      const next = dropGroup(
        lists,
        groups,
        dragged.id,
        on,
        place === "before" ? "before" : "after",
      );
      setLists(next.lists);
      setGroups(next.groups);
    }
  };
  // Spotlight asks to see one of the reminders it found: its list, with it selected, when it is
  // known. A shared list's notification asks to see that list.
  const [askedReminder, setAskedReminder] = useState<{ id: string } | null>(null);
  const refreshedRequest = useRef<typeof askedReminder>(null);
  const waitingToSave = useUnsaved();
  useOpenItemRequests("reminders", ({ id }) => {
    const reminder = reminderOfOpenItem(id);
    setAskedReminder(reminder === null ? null : { id: reminder });
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the request or the reminders arriving ask this again
  useEffect(() => {
    if (!askedReminder) return;
    if (sharedLists.some((list) => list.id === askedReminder.id)) {
      setAskedReminder(null);
      show(askedReminder.id);
      return;
    }
    const found = reminders.find((reminder) => reminder.id === askedReminder.id);
    if (!found) {
      // Siri or another browser may have created it since this page read its document.
      // Wait for our own save before one guarded read, retaining the requested selection.
      // A genuinely missing id must not start a polling loop.
      if (keepsView && !waitingToSave && refreshedRequest.current !== askedReminder) {
        refreshedRequest.current = askedReminder;
        void refreshReminders();
      }
      return;
    }
    setAskedReminder(null);
    show(found.listId);
    if (found.completed) setShowCompleted(true);
    if (found.parentId) setExpanded(found.parentId, true);
    setSelected(found.id);
  }, [askedReminder, reminders, sharedLists, keepsView, waitingToSave]);
  const printView = () => {
    const name =
      SMART_LISTS.find((item) => item.id === source)?.name ??
      [...ownLists, ...sharedLists].find((item) => item.id === source)?.name ??
      "Reminders";
    printDocument({ name, plain: false, lines: remindersPrintLines(name, rows) });
  };
  printViewRef.current = printView;
  // The window opens as the person left it, once their values are known; each change is kept.
  const valuesLoaded = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!keepsView || !valuesLoaded || restored) return;
    const view = readRemindersView(desktopValues()[REMINDERS_VIEW]);
    if (view) {
      setSort(view.sort);
      setShowCompleted((now) => now || view.showCompleted);
      if (view.sidebarHidden) setSidebarHidden(true);
      if (view.collapsed) setCollapsed(new Set(view.collapsed));
      // A list asked for already (Spotlight's, as the window opened) stands over the one left.
      if (!listChosen.current) setSavedSource(view.source);
    }
    // Only over reminders that were read: a window showing the samples knows none of the person's.
    if (remindersReadable()) {
      forgetGoneDetails(new Set(defaultReminders.map((reminder) => reminder.id)));
    }
    setRestored(true);
  }, [keepsView, valuesLoaded, restored, defaultReminders]);
  // A shared list arrives after the person's own: the list left is shown when it is there, and until
  // then what is kept stays that list, unless the person chooses another.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the lists arriving ask this again
  useEffect(() => {
    if (!savedSource || askedReminder) return;
    const known =
      SMART_LISTS.some((item) => item.id === savedSource) ||
      groups.some((item) => item.id === savedSource) ||
      [...ownLists, ...sharedLists].some((item) => item.id === savedSource);
    if (known) show(savedSource);
  }, [savedSource, askedReminder, ownLists, sharedLists, groups]);
  useEffect(() => {
    if (!restored) return;
    const view = {
      source: savedSource ?? source,
      sort,
      showCompleted,
      ...(sidebarHidden ? { sidebarHidden: true } : {}),
      ...(collapsed.size > 0 ? { collapsed: [...collapsed] } : {}),
    };
    if (JSON.stringify(desktopValues()[REMINDERS_VIEW]) !== JSON.stringify(view)) {
      changeDesktopValue(REMINDERS_VIEW, view);
    }
  }, [restored, savedSource, source, sort, showCompleted, collapsed, sidebarHidden]);
  // The alerts no server arms: a shared list's, and the Today notification.
  const [alertNow, setAlertNow] = useState(() => Date.now());
  useEffect(() => {
    if (!alertHost) return;
    const tick = () => setAlertNow(Date.now());
    tick();
    const timer = setInterval(tick, MINUTE_CHECK);
    return () => clearInterval(timer);
  }, [alertHost]);
  const closedShared = useDesktopValue(REMINDERS_SHARED_ALERTS, readClosedAlerts, NO_CLOSED);
  const todaySetting = useDesktopValue(
    REMINDERS_TODAY_NOTIFICATION,
    readTodayNotification,
    TODAY_NOTIFICATION_OFF,
  );
  const todayNotice = alertHost
    ? todayAlert(
        todaySetting,
        visible.filter(
          (reminder) =>
            reminder.title !== "" && !reminder.completed && inSource(reminder, "today", today),
        ),
        today,
        timeOf(new Date(alertNow)),
        alertNow,
      )
    : undefined;
  const locationAlerts = useLocationAlerts(reminders, alertHost);
  const shownAlerts: (ReminderAlert | LocationAlert)[] = alertHost
    ? [
        ...alerts,
        ...sharedAlerts(
          reminders.filter((reminder) => isSharedKey(reminder.id)),
          closedShared,
          alertNow,
        ),
        ...(todayNotice ? [todayNotice] : []),
        ...locationAlerts,
      ]
    : [...alerts];
  const closeAlert = (alert: ReminderAlert | LocationAlert) => {
    if ("place" in alert) closeLocationAlert(alert);
    else if (alert.id === TODAY_ALERT) {
      changeDesktopValue(REMINDERS_TODAY_NOTIFICATION, { ...todaySetting, closedOn: today });
    } else if (isSharedKey(alert.id)) {
      changeDesktopValue(REMINDERS_SHARED_ALERTS, closedAlert(closedShared, alert.id, alert.at));
    } else onAlertDismiss?.(alert);
  };
  const textTools = useRemindersTextTools({
    reminder: selectedRow,
    spoken: rows
      .filter((reminder) => selection.includes(reminder.id))
      .map((reminder) => reminder.title)
      .join("\n"),
    hidden: state === "inactive",
    onChange: (id, change) => {
      if (change.title.trim() === "") return;
      setReminders((now) =>
        now.map((reminder) => (reminder.id === id ? { ...reminder, ...change } : reminder)),
      );
    },
  });
  const reminderCommands = (
    <>
      <MenuItem disabled={!selectedRow} onClick={toggleSelected}>
        {selectedRow?.completed ? "Mark as Not Completed" : "Mark as Completed"}
      </MenuItem>
      <MenuItem disabled={!selectedRow} keyEquivalent="shift+command+f" onClick={flagSelected}>
        {selectedRow?.flagged ? "Remove Flag" : "Flag"}
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={!selectedRow}>Priority</SubmenuTrigger>
        <SubmenuPopup>
          {(["none", "low", "medium", "high"] as const).map((priority) => (
            <MenuItem
              key={priority}
              onClick={() =>
                patchSelected({ priority: priority === "none" ? undefined : priority })
              }
            >
              {priority[0]?.toUpperCase()}
              {priority.slice(1)}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={!selectedRow}>Add Date</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem onClick={() => patchSelected({ due: today, timeZone: localZone() })}>
            Today
          </MenuItem>
          <MenuItem
            onClick={() => patchSelected({ due: addDays(today, 1), timeZone: localZone() })}
          >
            Tomorrow
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={!selectedRow || !canMove}>Move to List</SubmenuTrigger>
        <SubmenuPopup>
          {ownLists.map((item) => (
            <MenuItem key={item.id} onClick={moveSelectedTo(item.id)}>
              {item.name}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
    </>
  );
  const editCommands = (
    <>
      <MenuItem disabled={!selectedRow} keyEquivalent="command+x" onClick={cutSelected}>
        Cut
      </MenuItem>
      <MenuItem disabled={!selectedRow} keyEquivalent="command+c" onClick={copySelected}>
        Copy
      </MenuItem>
      <MenuItem disabled={!target} keyEquivalent="command+v" onClick={() => void paste()}>
        Paste
      </MenuItem>
    </>
  );
  const outlineCommands = (
    <>
      <MenuItem disabled={!indentable} keyEquivalent="command+]" onClick={indent}>
        Indent
      </MenuItem>
      <MenuItem disabled={!outdentable} keyEquivalent="command+[" onClick={outdent}>
        Outdent
      </MenuItem>
    </>
  );
  useDesktopAppMenu(
    "reminders",
    "Edit",
    <>
      <MenuItem
        disabled={history.past.length === 0 && editing === null}
        keyEquivalent="command+z"
        onClick={() => travel(true)}
      >
        Undo
      </MenuItem>
      <MenuItem
        disabled={history.future.length === 0}
        keyEquivalent="shift+command+z"
        onClick={() => travel(false)}
      >
        Redo
      </MenuItem>
      <MenuSeparator />
      {editCommands}
      <MenuItem disabled={!selectedRow} onClick={deleteSelected}>
        Delete
      </MenuItem>
      <MenuItem disabled={rows.length === 0} keyEquivalent="command+a" onClick={selectAll}>
        Select All
      </MenuItem>
      <MenuSeparator />
      {outlineCommands}
      <MenuSeparator />
      {reminderCommands}
      <MenuSeparator />
      <MenuItem keyEquivalent="command+f" onClick={find}>
        Find
      </MenuItem>
      {textTools.items}
    </>,
    top,
  );
  useWindowKeys(top, state === "key", [
    { equivalent: "control+command+s", run: () => setSidebarHidden((now) => !now) },
    { equivalent: "command+p", run: printView },
    ...(target ? [{ equivalent: "command+n", run: add }] : []),
    { equivalent: "shift+command+n", run: addList },
    { equivalent: "command+f", run: find },
    { equivalent: "shift+command+f", run: flagSelected },
    { equivalent: "command+a", run: selectAll, notInText: true },
    { equivalent: "command+z", run: () => travel(true), notInText: true },
    { equivalent: "shift+command+z", run: () => travel(false), notInText: true },
    { equivalent: "command+x", run: cutSelected, notInText: true },
    { equivalent: "command+c", run: copySelected, notInText: true },
    { equivalent: "command+v", run: () => void paste(), notInText: true },
    { equivalent: "command+]", run: indent, notInText: true },
    { equivalent: "command+[", run: outdent, notInText: true },
    ...SMART_LISTS.map((item, index) => ({
      equivalent: `command+${index + 1}`,
      run: () => show(item.id),
    })),
  ]);
  useDesktopAppMenu(
    "reminders",
    "View",
    <>
      <MenuCheckboxItem checked={showCompleted} onCheckedChange={setShowCompleted}>
        Show Completed
      </MenuCheckboxItem>
      <MenuItem
        disabled={!selectedRow}
        title={selectedRow ? undefined : SHOW_INFO_UNAVAILABLE}
        keyEquivalent="⌘I"
        onClick={showSelectedInfo}
      >
        Show Info
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="control+command+s" onClick={() => setSidebarHidden((now) => !now)}>
        {sidebarHidden ? "Show Sidebar" : "Hide Sidebar"}
      </MenuItem>
      <MenuSeparator />
      {SMART_LISTS.map((item, index) => (
        <MenuItem
          key={item.id}
          keyEquivalent={`command+${index + 1}`}
          onClick={() => show(item.id)}
        >
          {item.name}
        </MenuItem>
      ))}
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Sort By</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup value={sort} onValueChange={(value) => setSort(value as ReminderSort)}>
            <MenuRadioItem value="manual">Manual</MenuRadioItem>
            <MenuRadioItem value="due">Due Date</MenuRadioItem>
            <MenuRadioItem value="created">Creation Date</MenuRadioItem>
            <MenuRadioItem value="priority">Priority</MenuRadioItem>
            <MenuRadioItem value="title">Title</MenuRadioItem>
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
    </>,
    top,
  );

  const ownListRow = (item: ReminderList, inGroup?: string) => {
    const reminderDrop = dropOnList(item.id);
    const listDrop = sidebarDropOn("list", item.id, inGroup);
    return (
      <SidebarItem
        key={item.id}
        value={item.id}
        label={item.name}
        style={inGroup ? NESTED_ROW : LIST_ROW}
        data-reminders-list={item.id}
        onDoubleClick={DesktopWindow ? () => openListWindow(item.id) : undefined}
        data-drop-target={reminderDrop["data-drop-target"]}
        data-drop-edge={listDrop["data-drop-edge"]}
        {...dragInSidebar("list", item.id)}
        onDragOver={(event) => {
          reminderDrop.onDragOver(event);
          listDrop.onDragOver(event);
        }}
        onDragLeave={() => {
          reminderDrop.onDragLeave();
          listDrop.onDragLeave();
        }}
        onDrop={(event) => {
          reminderDrop.onDrop(event);
          listDrop.onDrop(event);
        }}
        icon={
          <span className="mac-reminders-disc" data-color={item.color}>
            <ListGlyph />
          </span>
        }
        accessory={
          <SidebarBadge variant="plain" selected={!searching && source === item.id}>
            {countOf(visible, item.id, today)}
          </SidebarBadge>
        }
      />
    );
  };

  const sidebar = (
    <Sidebar
      aria-label="Lists"
      className="mac-reminders-sidebar"
      material={material}
      style={LISTS}
      value={searching || smart ? null : source}
      onValueChange={show}
      onDragOver={(event) => {
        if (!sidebarDragged.current) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (!sidebarDragged.current) return;
        event.preventDefault();
        setSidebarDrop(null);
        dropInSidebar(undefined, "after");
      }}
      // A press on the list already shown is a choice too, though it changes nothing shown.
      onMouseDownCapture={(event) => {
        if (!(event.target as Element).closest("[data-value]")) return;
        listChosen.current = true;
        setSavedSource(null);
      }}
      // Over the lists, and staying there while they scroll: the sidebar's own header.
      header={
        <div className="mac-reminders-top" ref={setTop} {...dragRegion}>
          <WindowControls
            className="mac-reminders-controls"
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
            {...controlsProps}
          />
          <SearchField
            variant="sidebar"
            className="mac-reminders-search"
            style={SEARCH}
            value={query}
            inputRef={searchInput}
            onValueChange={(next) => search(next)}
          />
          <SmartListTileGrid aria-label="Smart Lists">
            {SMART_LISTS.map((item) => (
              <SmartListTile
                key={item.id}
                data-color={item.color}
                // The colour that `data-color` sets on the tile (reminders.css).
                tint="var(--_tint)"
                icon={<SmartListGlyph list={item.id} />}
                count={countOf(visible, item.id, today)}
                pressed={!searching && source === item.id}
                onClick={() => show(item.id)}
              >
                {item.name}
              </SmartListTile>
            ))}
          </SmartListTileGrid>
        </div>
      }
      footer={
        <SidebarFooter filled style={FOOTER} onClick={addList}>
          Add List
        </SidebarFooter>
      }
    >
      <SidebarSection title={<span style={LISTS_TITLE}>My Lists</span>}>
        {sidebarEntries(ownLists, groups).map((entry) =>
          entry.kind === "list" ? (
            ownListRow(entry.list)
          ) : (
            <SidebarItem
              key={entry.group.id}
              value={entry.group.id}
              label={
                renamingGroup === entry.group.id ? (
                  <TextField
                    bezel="none"
                    className="mac-reminders-field"
                    aria-label="Group Name"
                    defaultValue={entry.group.name}
                    inputRef={(input) => {
                      if (input && document.activeElement !== input) {
                        input.focus();
                        input.select();
                      }
                    }}
                    onBlur={(event) => renameGroup(entry.group.id, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        renameGroup(entry.group.id, event.currentTarget.value);
                      } else if (event.key === "Escape") {
                        event.currentTarget.value = entry.group.name;
                        setRenamingGroup(null);
                      }
                    }}
                  />
                ) : (
                  entry.group.name
                )
              }
              style={LIST_ROW}
              data-reminders-group={entry.group.id}
              expanded={!collapsed.has(entry.group.id)}
              onExpandedChange={(expanded) => setExpanded(entry.group.id, expanded)}
              icon={
                <span className="mac-reminders-group-glyph">
                  <GroupGlyph />
                </span>
              }
              accessory={
                <SidebarBadge variant="plain" selected={!searching && source === entry.group.id}>
                  {groupCount(entry.group.id)}
                </SidebarBadge>
              }
              {...dragInSidebar("group", entry.group.id)}
              {...sidebarDropOn("group", entry.group.id)}
            >
              {entry.lists.map((item) => ownListRow(item, entry.group.id))}
            </SidebarItem>
          ),
        )}
      </SidebarSection>
      {sharedLists.length > 0 ? (
        <SidebarSection title={<span style={LISTS_TITLE}>Shared</span>}>
          {sharedLists.map((item) => (
            <SidebarItem
              key={item.id}
              value={item.id}
              label={item.name}
              style={LIST_ROW}
              data-reminders-list={item.id}
              icon={
                <span className="mac-reminders-disc" data-color={item.color}>
                  <ListGlyph />
                </span>
              }
              accessory={
                <span className="mac-reminders-shared-accessory">
                  <span className="mac-reminders-owner">
                    {item.owned ? "Shared by Me" : item.owner.fullName}
                  </span>
                  <SidebarBadge variant="plain" selected={!searching && source === item.id}>
                    {countOf(visible, item.id, today)}
                  </SidebarBadge>
                </span>
              }
            />
          ))}
        </SidebarSection>
      ) : null}
    </Sidebar>
  );

  return (
    <Window
      aria-label="Reminders"
      state={state}
      width={width}
      height={height}
      className={className ? `mac-reminders ${className}` : "mac-reminders"}
      // No title bar draws the highlight rows along the top edge, so the window does: the
      // captures' top line is lighter than the sides (#f7f7f7 over #ececec on the sidebar in
      // Aqua, #777879 over #676768 in Dark Aqua).
      topHighlight
      {...props}
    >
      <SplitView className="mac-reminders-split" style={SPLIT}>
        <SplitViewPane
          defaultSize={280}
          minSize={220}
          maxSize={400}
          className="mac-reminders-sidebar-pane"
          style={sidebarHidden ? HIDDEN : undefined}
        >
          {
            // A secondary click on a list offers its Info, Delete and, for a signed-in person,
            // Share List… (or who it is shared with); on a group, its own commands; on the
            // sidebar's blank, New List and New Group.
            <ContextualMenu>
              <ContextualMenuTrigger
                className="mac-reminders-lists-menu"
                onContextMenu={(event) => {
                  const target = event.target instanceof Element ? event.target : null;
                  // The search field keeps its own menu.
                  if (target?.closest("input, textarea, [contenteditable='true']")) {
                    event.preventBaseUIHandler();
                    return;
                  }
                  const row =
                    target?.closest("[data-reminders-list], [data-reminders-group]") ?? null;
                  const id = row?.getAttribute("data-reminders-list");
                  setMenuList(id ? { id, anchor: row } : null);
                  const groupId = row?.getAttribute("data-reminders-group");
                  setMenuGroup(groups.find((item) => item.id === groupId) ?? null);
                }}
              >
                {sidebar}
              </ContextualMenuTrigger>
              <ContextualMenuPopup aria-label="List commands">
                {menuGroup ? (
                  <>
                    <MenuItem onClick={() => setRenamingGroup(menuGroup.id)}>Rename</MenuItem>
                    <MenuItem onClick={() => removeGroup(menuGroup.id, false)}>Ungroup</MenuItem>
                    <MenuItem onClick={() => setRemovingGroup(menuGroup)}>Delete</MenuItem>
                    <MenuSeparator />
                  </>
                ) : null}
                {!menuList ? (
                  <>
                    <MenuItem onClick={addList}>New List</MenuItem>
                    <MenuItem onClick={addGroup}>New Group</MenuItem>
                  </>
                ) : menuShared ? null : (
                  <>
                    {DesktopWindow ? (
                      <MenuItem disabled={!menuOwn} onClick={() => openListWindow(menuList.id)}>
                        Open List in New Window
                      </MenuItem>
                    ) : null}
                    <MenuItem
                      disabled={!menuOwn}
                      onClick={() => {
                        flush();
                        setInfo(null);
                        setListInfo(menuList);
                      }}
                    >
                      Show Info
                    </MenuItem>
                    <MenuItem
                      disabled={!menuOwn}
                      onClick={() => {
                        if (menuOwn) setRemovingList(menuOwn);
                      }}
                    >
                      Delete
                    </MenuItem>
                  </>
                )}
                {sharing && menuList ? (
                  <>
                    {menuShared ? null : <MenuSeparator />}
                    <MenuItem
                      onClick={() => {
                        setInfo(null);
                        setSharingList(menuList);
                      }}
                    >
                      {menuShared && !menuShared.owned ? "Show People…" : "Share List…"}
                    </MenuItem>
                  </>
                ) : null}
              </ContextualMenuPopup>
            </ContextualMenu>
          }
        </SplitViewPane>
        <SplitViewDivider
          aria-label="Resize the sidebar"
          style={sidebarHidden ? HIDDEN : undefined}
        />
        <SplitViewPane className="mac-reminders-pane">
          <div className="mac-reminders-header" data-color={tint} {...dragRegion}>
            <PushButton
              className="mac-reminders-add"
              aria-label="New Reminder"
              disabled={!target}
              onClick={add}
            >
              <SystemImage name="add" className="mac-reminders-plus" />
            </PushButton>
            <h2 className="mac-reminders-title">{title}</h2>
            <span className="mac-reminders-count">
              {count}
              <span className="mac-reminders-hidden"> to do</span>
            </span>
          </div>
          {rows.length === 0 ? (
            <EmptyState role={searching ? "status" : undefined} className="mac-reminders-empty">
              {searching ? "No Results" : "No Reminders"}
            </EmptyState>
          ) : (
            <ContextualMenu>
              <ContextualMenuTrigger
                ref={pictureDrop}
                className="mac-reminders-lists-menu"
                onDragStart={dragReminders}
                onDragOver={reorderOver}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setRowDrop(null);
                  }
                }}
                onDrop={reorderDrop}
                onContextMenu={(event) => {
                  // The row under the pointer joins the commands: selected, unless it already is.
                  const row = (event.target as Element).closest('[role="option"]');
                  const id = row
                    ?.querySelector("[data-reminder-info]")
                    ?.getAttribute("data-reminder-info");
                  if (id && !selection.includes(id)) {
                    setPicked([]);
                    setSelected(id);
                  }
                }}
              >
                <ListView
                  ref={list}
                  className="mac-reminders-list"
                  style={LIST}
                  aria-label={title}
                  count={layout.length}
                  rowHeight={rowHeight}
                  separator="inset"
                  separatorInset={50}
                  renderRow={renderRow}
                  getRowId={getRowId}
                  getRowLabel={getRowLabel}
                  isRowHeading={isRowHeading}
                  selectionMode="multiple"
                  rowDraggable={editing === null}
                  value={selection}
                  onValueChange={(next) => {
                    // A Shift range or Command-A names the headings' ids too. Only a heading's id
                    // has a colon: `is_id` in the server's module refuses one in a reminder's id
                    // (letters, digits, - and _), and a shared key adds only a slash.
                    const ids = next.filter(
                      (id): id is string => typeof id === "string" && !id.startsWith("day:"),
                    );
                    setPicked(ids);
                    setSelected((now) =>
                      now !== null && ids.includes(now) ? now : (ids.at(-1) ?? null),
                    );
                  }}
                  onRowAction={(index) => {
                    const reminder = reminderAt(index);
                    // Return on the reminder whose field is already open, out of view, changes
                    // nothing: opening it again would drop what was typed.
                    if (!reminder || open.current === reminder.id) return;
                    // Another reminder's field may be open out of view, where it cannot lose the
                    // focus: what was typed in it is kept before this one opens.
                    flush();
                    edit(reminder.id);
                  }}
                  onMouseDown={(event: MouseEvent<HTMLElement>) => {
                    // The circle completes its reminder; the press does not select the row.
                    const id =
                      event.button === 0 && event.target instanceof Element
                        ? event.target
                            .closest("[data-reminder-toggle]")
                            ?.getAttribute("data-reminder-toggle")
                        : null;
                    if (!id) return;
                    event.preventDefault();
                    toggle(id);
                  }}
                  onClick={(event: MouseEvent<HTMLElement>) => {
                    // The mark at the end of a row shows the reminder's info, and hides it again.
                    const mark = markOf(event.target);
                    const id = mark?.getAttribute("data-reminder-info");
                    if (mark && id)
                      setInfo((now) => (now?.id === id ? null : { id, anchor: mark }));
                  }}
                  onDoubleClick={(event: MouseEvent<HTMLElement>) => {
                    // A double click on a mark or a circle is two clicks on it, not an edit.
                    if (
                      markOf(event.target) ||
                      (event.target instanceof Element &&
                        event.target.closest("[data-reminder-toggle]"))
                    )
                      event.preventDefault();
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                    // Keys pressed in a reminder's field are the field's.
                    if (event.target !== event.currentTarget || selected === null) return;
                    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
                      // Show Info, as in the View menu: beside the mark of the selected row.
                      const marks = event.currentTarget.querySelectorAll("[data-reminder-info]");
                      const mark = [...marks].find(
                        (item) => item.getAttribute("data-reminder-info") === selected,
                      );
                      setInfo({ id: selected, anchor: mark ?? event.currentTarget });
                      event.preventDefault();
                      return;
                    }
                    if (event.metaKey || event.ctrlKey || event.altKey) return;
                    const selectedOutline = layout.find(
                      (row) => row.kind === "reminder" && row.reminder.id === selected,
                    );
                    if (
                      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
                      selectedOutline?.kind === "reminder" &&
                      selectedOutline.children > 0
                    ) {
                      setExpanded(selected, event.key === "ArrowRight");
                      event.preventDefault();
                      return;
                    }
                    if (event.key === " ") toggleSelected();
                    else if (event.key === "Backspace" || event.key === "Delete") deleteSelected();
                    else return;
                    event.preventDefault();
                  }}
                />
              </ContextualMenuTrigger>
              <ContextualMenuPopup aria-label="Reminder commands">
                {editCommands}
                <MenuSeparator />
                {outlineCommands}
                <MenuSeparator />
                {reminderCommands}
                <MenuSeparator />
                <MenuItem disabled={!selectedRow} onClick={showSelectedInfo}>
                  Show Info
                </MenuItem>
                <MenuItem disabled={!selectedRow} onClick={deleteSelected}>
                  Delete
                </MenuItem>
              </ContextualMenuPopup>
            </ContextualMenu>
          )}
        </SplitViewPane>
      </SplitView>
      {shown && info ? (
        <ReminderInfo
          key={shown.id}
          reminder={shown}
          anchor={info.anchor}
          today={today}
          inDesktop={DesktopWindow !== undefined}
          material={material}
          onChange={(change) => {
            const id = shown.id;
            // A change of when it is due is made as this browser shows it, in its zone.
            setReminders((now) =>
              now.map((reminder) =>
                reminder.id === id ? changeReminder(reminder, change) : reminder,
              ),
            );
            // A change must not take the reminder out of the view its popover points into.
            setKept((now) => (now.has(id) ? now : new Set(now).add(id)));
          }}
          onClose={(event) => {
            // A press on a mark is that mark's: its click shows another reminder or hides this.
            if (!markOf(event?.target ?? null)) setInfo(null);
          }}
        />
      ) : null}
      {listInfo && infoList ? (
        <ReminderListInfo
          key={infoList.id}
          list={infoList}
          anchor={listInfo.anchor}
          material={material}
          onSave={(change) => changeList(infoList.id, change)}
          onClose={() => setListInfo(null)}
        />
      ) : null}
      <input
        ref={importInput}
        type="file"
        accept=".ics,text/calendar"
        hidden
        aria-label="Reminders file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void importReminders(file);
        }}
      />
      <Alert open={importProblem !== null} onOpenChange={(open) => !open && setImportProblem(null)}>
        <AlertPopup>
          <AlertMessage>{importProblem}</AlertMessage>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={removingList !== null} onOpenChange={(open) => !open && setRemovingList(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to delete the list {"\u201c"}
            {removingList?.name}
            {"\u201d"}?
          </AlertMessage>
          <AlertInformativeText>
            {removingCount === 0
              ? "It has no reminders."
              : removingCount === 1
                ? "Its reminder will be deleted."
                : `All ${removingCount} of its reminders will be deleted.`}
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => removingList && deleteList(removingList.id)}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={removingGroup !== null} onOpenChange={(open) => !open && setRemovingGroup(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to delete the group {"\u201c"}
            {removingGroup?.name}
            {"\u201d"}?
          </AlertMessage>
          <AlertInformativeText>
            The lists in it and their reminders will be deleted too. To keep them, choose Ungroup.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => removingGroup && removeGroup(removingGroup.id, true)}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      {sharing && sharingList && (sharedOpen || ownOpen) ? (
        <ReminderShare
          key={sharingList.id}
          listName={sharedOpen?.name ?? ownOpen?.name ?? ""}
          owner={sharedOpen?.owner}
          members={sharedOpen?.members}
          owned={sharedOpen ? sharedOpen.owned : true}
          me={sharing.me}
          anchor={sharingList.anchor}
          material={material}
          onAdd={(name) =>
            sharedOpen ? sharing.add(sharedOpen.id, name) : sharing.share(sharingList.id, name)
          }
          onRemove={(name) =>
            sharedOpen
              ? name === sharing.me
                ? sharing.leave(sharedOpen.id)
                : sharing.remove(sharedOpen.id, name)
              : Promise.resolve(null)
          }
          onStop={sharedOpen ? () => sharing.stop(sharedOpen.id) : undefined}
          onClose={() => setSharingList(null)}
        />
      ) : null}
      {shownAlerts.length > 0
        ? createPortal(
            <div className="mac-reminders-alerts">
              {shownAlerts.map((alert) => (
                <NotificationAlert
                  key={
                    alert.id === TODAY_ALERT
                      ? alert.id
                      : `${alert.id}@${alert.at}${"place" in alert ? "@place" : ""}`
                  }
                  title="Reminders"
                  actions={
                    <>
                      <NotificationAlertClose>Close</NotificationAlertClose>
                      <NotificationAlertAction
                        onClick={() => {
                          if (alert.id === TODAY_ALERT) {
                            show("today");
                          } else {
                            // A reminder that repeats moves to its next day and stays to do. Only
                            // the occurrence this alert is of: one already completed or moved on
                            // (its circle was clicked while the alert showed) is left as it is.
                            setReminders((now) =>
                              now.map((reminder) =>
                                reminder.id === alert.id &&
                                ("place" in alert || alertOf(reminder) === alert.at)
                                  ? completeReminder(reminder)
                                  : reminder,
                              ),
                            );
                          }
                          closeAlert(alert);
                        }}
                      >
                        {alert.id === TODAY_ALERT ? "Show" : "Complete"}
                      </NotificationAlertAction>
                    </>
                  }
                  onDismiss={() => closeAlert(alert)}
                >
                  {alert.title}
                </NotificationAlert>
              ))}
            </div>,
            document.body,
          )
        : null}
      {textTools.panels}
      {DesktopWindow
        ? listWindows.flatMap((id) => {
            const item = lists.find((each) => each.id === id);
            if (!item) return [];
            return [
              <DesktopWindow
                key={id}
                id={`list-${id}`}
                title={item.name}
                defaultSize={{ width: 420, height: 480 }}
                minSize={{ width: 320, height: 240 }}
                onClose={() => setListWindows((open) => open.filter((each) => each !== id))}
                render={({
                  onClose: close,
                  onMinimize: minimize,
                  onZoom: zoom,
                  zoomRole: role,
                  minimizeDisabled: noMinimize,
                  zoomDisabled: noZoom,
                  onDragRegionPointerDown: move,
                  onDragRegionDoubleClick: zoomFromBar,
                  ...windowProps
                }) => (
                  <RemindersListWindow
                    {...windowProps}
                    list={item}
                    reminders={reminders.filter((each) => each.listId === id)}
                    onToggleReminder={toggle}
                    onRename={(reminder, typed) => {
                      const title = [...typed].slice(0, MAX_TITLE).join("");
                      setReminders((now) =>
                        now.map((each) => (each.id === reminder ? { ...each, title } : each)),
                      );
                    }}
                    onAdd={(typed) => {
                      const title = [...typed].slice(0, MAX_TITLE).join("");
                      const made = fresh("new", (candidate) =>
                        reminders.some((each) => each.id === candidate),
                      );
                      setReminders((now) => [
                        ...now,
                        { id: made, listId: id, title, createdAt: Date.now() },
                      ]);
                    }}
                    controlsProps={{
                      onClose: close,
                      onMinimize: minimize,
                      onZoom: zoom,
                      zoomRole: role,
                      minimizeDisabled: noMinimize,
                      zoomDisabled: noZoom,
                    }}
                    onDragRegionPointerDown={move}
                    onDragRegionDoubleClick={zoomFromBar}
                  />
                )}
              />,
            ];
          })
        : null}
      {DesktopWindow && listWindowAsked ? (
        <BringForward
          key={listWindowAsked.serial}
          windowId={`reminders:list-${listWindowAsked.id}`}
        />
      ) : null}
    </Window>
  );
}

/** Brings a window the desktop hosts forward once, when it is rendered. */
function BringForward({ windowId }: { windowId: string }) {
  const store = useWindowManagerStore();
  useEffect(() => store.commands.focus(windowId), [store, windowId]);
  return null;
}
