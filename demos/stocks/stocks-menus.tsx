"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { EditRows } from "../desktop/desktop-edit-rows";
import { RANGES, type StockRange } from "./stocks-data";

const RANGE_TITLES: Record<StockRange, string> = {
  "1D": "1 Day",
  "1W": "1 Week",
  "1M": "1 Month",
  "3M": "3 Months",
  "6M": "6 Months",
  "1Y": "1 Year",
  "2Y": "2 Years",
};

const NO_RANGE = "Choose a symbol to set its chart's range.";
const NOTHING_TO_EDIT = "Click in the search field, or select text in a story, first.";
const ONE_WINDOW = "Stocks has one window, which shows the whole watchlist.";

interface Command {
  title: string;
  key?: string;
  enabled: boolean;
  /** Why it is dimmed, when it is. */
  reason?: string;
  run: () => void;
  /** A key a text field keeps for itself while it has the keyboard. */
  text?: boolean;
}

/** What the window hands its menus. */
export interface StocksMenusProps {
  /** An element of the window, which makes it the application's last used. */
  within: Element | null;
  canGoBack: boolean;
  goBack: () => void;
  /** Asks for the quotes and the news again; `undefined` when there is nothing to ask. */
  refresh?: () => void;
  /** The chart's range, and setting it; `canSetRange` while a symbol is shown. */
  range: StockRange;
  canSetRange: boolean;
  setRange: (range: StockRange) => void;
  /** How many rows are selected, which Delete would remove. */
  selected: number;
  /** Removes the rows selected; `undefined` when the watchlist cannot be changed. */
  removeSelected?: () => void;
  /** How many rows are listed, which Select All would select. */
  listed: number;
  selectAll: () => void;
  find: () => void;
  sidebarShown: boolean;
  toggleSidebar: () => void;
  /** Whether the watchlist can be edited, and whether it is being. */
  editable: boolean;
  editing: boolean;
  toggleEditing: () => void;
  /** Tells the person what an Edit row could not do. */
  say: (message: string) => void;
}

function dimmed(title: string, reason: string, key?: string) {
  return (
    <MenuItem key={title} disabled title={reason} keyEquivalent={key}>
      {title}
    </MenuItem>
  );
}

/**
 * Stocks's own items in the desktop's menu bar, while its window is the application's last used
 * (`desktop-app-menus.ts`), and the key equivalents they show. Answers the function the window's key
 * handler calls: whether a `keydown` is a command's; a command that is dimmed keeps its key, as in a
 * Mac's menu bar, and a key held down does not run it again.
 */
export function useStocksMenus(props: StocksMenusProps) {
  const { within, range, canSetRange } = props;
  const rangeCommands = RANGES.map(
    (each, index): Command => ({
      title: RANGE_TITLES[each],
      key: `command+${index + 1}`,
      enabled: canSetRange,
      run: () => props.setRange(each),
    }),
  );
  const commands = {
    delete: {
      title: "Delete",
      key: "delete",
      enabled: props.removeSelected !== undefined && props.selected > 0,
      reason: props.removeSelected
        ? "No symbol is selected."
        : "The sample watchlist cannot be changed.",
      run: () => props.removeSelected?.(),
      text: true,
    },
    selectAll: {
      title: "Select All",
      key: "command+a",
      enabled: props.listed > 0,
      reason: "The watchlist lists no symbols.",
      run: props.selectAll,
      text: true,
    },
    find: { title: "Find", key: "command+f", enabled: true, run: props.find },
    sidebar: {
      title: props.sidebarShown ? "Hide Sidebar" : "Show Sidebar",
      key: "option+command+s",
      enabled: true,
      run: props.toggleSidebar,
    },
    back: {
      title: "Back",
      key: "command+[",
      enabled: props.canGoBack,
      reason: "Business News is already shown.",
      run: props.goBack,
    },
    refresh: {
      title: "Refresh",
      key: "command+r",
      enabled: props.refresh !== undefined,
      reason: "The sample market has nothing to ask for again.",
      run: () => props.refresh?.(),
    },
  } satisfies Record<string, Command>;

  const row = (command: Command) => (
    <MenuItem
      key={command.title}
      keyEquivalent={command.key}
      disabled={!command.enabled}
      title={command.enabled ? undefined : command.reason}
      onClick={command.run}
    >
      {command.title}
    </MenuItem>
  );

  useDesktopAppMenu(
    "stocks",
    "Dock",
    <MenuItem disabled={!commands.refresh.enabled} onClick={commands.refresh.run}>
      {commands.refresh.title}
    </MenuItem>,
    within,
  );
  useDesktopAppMenu("stocks", "File", dimmed("New Window", ONE_WINDOW, "command+n"), within);
  useDesktopAppMenu(
    "stocks",
    "Edit",
    <>
      <EditRows
        nothing={NOTHING_TO_EDIT}
        selectAll={{
          enabled: commands.selectAll.enabled,
          title: commands.selectAll.reason,
          run: commands.selectAll.run,
        }}
        say={props.say}
        afterPaste={row(commands.delete)}
      />
      <MenuSeparator />
      {row(commands.find)}
      {props.editable ? (
        <>
          <MenuSeparator />
          <MenuItem onClick={props.toggleEditing}>
            {props.editing ? "Done Editing" : "Edit Watchlist"}
          </MenuItem>
        </>
      ) : null}
    </>,
    within,
  );
  useDesktopAppMenu(
    "stocks",
    "View",
    <>
      {row(commands.sidebar)}
      <MenuSeparator />
      {row(commands.back)}
      {row(commands.refresh)}
      <MenuSeparator />
      <MenuRadioGroup
        value={range}
        onValueChange={(value) => {
          const chosen = RANGES.find((each) => each === value);
          if (chosen) props.setRange(chosen);
        }}
      >
        {RANGES.map((each, index) => (
          <MenuRadioItem
            key={each}
            value={each}
            keyEquivalent={`command+${index + 1}`}
            disabled={!canSetRange}
            title={canSetRange ? undefined : NO_RANGE}
          >
            {RANGE_TITLES[each]}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
      <MenuSeparator />
    </>,
    within,
  );

  return (event: KeyboardEvent, typing: boolean): boolean => {
    const command = [...Object.values(commands), ...rangeCommands].find(
      (each: Command) => each.key && matchesMenuKeyEquivalent(event, each.key),
    ) as Command | undefined;
    if (!command || (typing && command.text)) return false;
    if (command.enabled && !event.repeat) command.run();
    return true;
  };
}

/**
 * Gives `find`'s element the keyboard once it is there and no menu is open, within a few frames: a
 * menu keeps the keyboard until it closes. A field's text is selected, as Find leaves it.
 */
export function takeKeyboard(find: () => HTMLElement | null | undefined) {
  let frames = 0;
  const take = () => {
    const element = find();
    if (element && !document.querySelector('[role="menu"][data-open]')) {
      element.focus();
      if (element instanceof HTMLInputElement) element.select();
    }
    if (document.activeElement !== element && ++frames < 30) requestAnimationFrame(take);
  };
  take();
}
