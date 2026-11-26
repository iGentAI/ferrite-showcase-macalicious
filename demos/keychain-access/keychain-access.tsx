"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { Label } from "macalicious/label";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { SystemImage } from "macalicious/system-image";
import {
  TableView,
  TableViewCellText,
  type TableViewColumn,
  type TableViewProps,
} from "macalicious/table-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { beginDesktopDrag, registerDropTarget } from "../desktop/desktop-drag";
import {
  arrange,
  CATEGORIES,
  COLUMNS,
  cellText,
  DEFAULT_SORT,
  DEFAULT_TODAY,
  defaultItems,
  describe,
  KEYCHAINS,
  type KeychainAccessCategory,
  type KeychainAccessItem,
  type KeychainAccessKeychain,
  type KeychainAccessSort,
} from "./keychain-access-data";
import { CategoryIcon, ItemIcon, KeychainIcon } from "./keychain-access-icons";
import "./keychain-access.tokens.css";
import "./keychain-access.css";

type Selection = NonNullable<TableViewProps["value"]>;

/** What the window keeps of how it is laid out: choices and sizes, never anything of an item. */
export interface KeychainAccessLayout {
  keychain?: string;
  category?: KeychainAccessCategory;
  sort?: KeychainAccessSort;
  widths?: Readonly<Record<string, number>>;
  sourcesWidth?: number;
  keychainsHeight?: number;
  sourcesHidden?: boolean;
  statusHidden?: boolean;
}

export interface KeychainAccessProps extends Omit<WindowProps, "children"> {
  /**
   * The items of every keychain. The window lists those of the selected keychain and
   * category.
   * @default defaultItems
   */
  items?: readonly KeychainAccessItem[];
  /**
   * The day the dates are counted from, as `YYYY-MM-DD`: an item changed on it reads
   * "Today", one changed the day before "Yesterday".
   * @default "2019-10-07"
   */
  today?: string;
  /**
   * The `id` of the keychain selected at first.
   * @default "login"
   */
  defaultKeychain?: string;
  /**
   * The category selected at first.
   * @default "all"
   */
  defaultCategory?: KeychainAccessCategory;
  /** The `id` of the item selected at first. */
  defaultSelectedItemId?: string;
  /** The keychains of the upper list. @default KEYCHAINS */
  keychains?: readonly KeychainAccessKeychain[];
  /** Which of them are locked. Without it, “login” is, when `locked` says so. */
  lockedKeychains?: ReadonlySet<string>;
  /** Called when items are dragged onto a keychain of the list, with their ids. */
  onMoveItems?: (ids: readonly string[], keychain: string) => void;
  /**
   * Called with the selected keychain when the "+" button is chosen. A host asks for the new
   * item and passes it back in `items`; the window does not create one itself.
   */
  onAdd?: (keychain: KeychainAccessKeychain) => void;
  /**
   * Called with the selected item when Info is chosen, and with a row's item when it is
   * double-clicked or Return is pressed on it. A host shows the item's details.
   */
  onInspect?: (item: KeychainAccessItem) => void;
  /** Called with the listed items that are selected, whenever they change. */
  onSelectionChange?: (items: readonly KeychainAccessItem[]) => void;
  /** Called with the selected items when Delete is pressed in the table. */
  onDeleteItems?: (items: readonly KeychainAccessItem[]) => void;
  /** The items of a row's contextual menu, which act on the selection. */
  itemMenu?: ReactNode;
  /** The items of a keychain row's contextual menu; a right click selects the row first. */
  keychainMenu?: (keychain: KeychainAccessKeychain) => ReactNode;
  /** Receives the command that selects every listed item, for a host's Select All. */
  selectAllRef?: Ref<() => void>;
  /** The window's body, for a host that takes drops on the window. */
  bodyRef?: Ref<HTMLDivElement>;
  /** The search field, for a host's Find. */
  searchRef?: Ref<HTMLInputElement>;
  /** The title bar, for a host that needs an element of the window. */
  titleBarRef?: Ref<HTMLDivElement>;
  /** The layout a host keeps; what it leaves out stays the window's own. */
  layout?: KeychainAccessLayout;
  /** Called with what changed of the layout. */
  onLayoutChange?: (change: KeychainAccessLayout) => void;
  /**
   * The line under the table for the keychain shown and how many items it lists. Without it the
   * window has no status bar, as in the captures.
   */
  statusText?: (keychain: KeychainAccessKeychain, count: number) => string;
  /** Whether the login keychain is locked: its row's padlock, and the toolbar's when it has one. */
  locked?: boolean;
  /** Gives the toolbar a padlock that locks or unlocks the login keychain. */
  onToggleLock?: () => void;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/* The two buttons' fills are 24 pt wide, a point less than a toolbar button's least width.
   They are laid out by their bezels (`frame="bezel"`), as Keychain Access has them: from the
   toolbar's own 8 pt inset and with its 8 pt gap in both appearances, which puts the fills
   half a point later in Aqua, behind the hairline border. The search field's fill ends 7 pt
   before the window's trailing edge (measured). */
const TOOLBAR: CSSProperties = { paddingInlineEnd: 7 };
const BUTTON: CSSProperties = { width: 24, minWidth: 24, padding: 0 };
const SEARCH: CSSProperties = { flex: "0 1 186px", width: 186 };
/* The split views' documented hook for the colour of their line: the divider beside the left
   column, and the line over the Category title, which is the divider between the lists. */
const SPLIT = {
  ["--mac-split-view-divider-color" as string]: "var(--mac-keychain-access-divider)",
} as CSSProperties;
const SOURCES = {
  ["--mac-split-view-divider-color" as string]: "var(--mac-keychain-access-rule)",
} as CSSProperties;

/* The item table's header is not under a toolbar: it has the line over it. Its titles start
   3.5 pt from the column's edge, 1.5 pt before a table header's own (measured), and may end
   2 pt before the next column's separator: "Keychain" then fits its 56 pt column, as
   captured. The inset is the table header's hook. */
const ITEMS_HEADER = { topBorder: true };
const ITEMS = {
  ["--mac-table-header-title-inset" as string]: "3.5px 2px",
} as CSSProperties;

/* A drag of items between keychains: only the list of keychains takes it. */
export const KEYCHAIN_ITEM_DRAG = "application/x-macalicious-keychain-item";

/* A pane title is the heading of its list's only column, centred. */
const KEYCHAIN_COLUMNS: TableViewColumn[] = [
  { id: "name", title: "Keychains", headerAlign: "center" },
];
const CATEGORY_COLUMNS: TableViewColumn[] = [
  { id: "name", title: "Category", headerAlign: "center" },
];

/**
 * The Keychain Access window of macOS 10.15: a toolbar without a title, the list of
 * keychains over the list of categories, and beside them the summary of the selected item
 * above the sortable table of the items the two lists choose. The keychains and their items
 * are invented and hold no secret.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function KeychainAccess({
  items = defaultItems,
  keychains = KEYCHAINS,
  lockedKeychains,
  onMoveItems,
  today = DEFAULT_TODAY,
  defaultKeychain = "login",
  defaultCategory = "all",
  defaultSelectedItemId,
  onAdd,
  onInspect,
  onSelectionChange,
  onDeleteItems,
  itemMenu,
  keychainMenu,
  selectAllRef,
  bodyRef,
  searchRef,
  titleBarRef,
  layout,
  onLayoutChange,
  statusText,
  locked = false,
  onToggleLock,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 877,
  height = 593,
  ...windowProps
}: KeychainAccessProps) {
  // A `defaultKeychain` that names no keychain stands for the first, so that the lists, the
  // table and "+" all speak of the same one.
  const [ownKeychainId, setOwnKeychainId] = useState(() =>
    keychains.some((candidate) => candidate.id === defaultKeychain)
      ? defaultKeychain
      : (keychains[0]?.id ?? defaultKeychain),
  );
  const [ownCategory, setOwnCategory] = useState(defaultCategory);
  const [query, setQuery] = useState("");
  const [ownSort, setOwnSort] = useState<KeychainAccessSort>(DEFAULT_SORT);
  const [selection, setSelection] = useState<Selection>(
    defaultSelectedItemId === undefined ? [] : [defaultSelectedItemId],
  );
  const [ownWidths, setOwnWidths] = useState<Readonly<Record<string, number>>>({});
  // The left column is 174 pt wide, and its upper list ends 276.5 pt under the toolbar.
  const [ownSourcesWidth, setOwnSourcesWidth] = useState(174);
  const [ownKeychainsHeight, setOwnKeychainsHeight] = useState(276.5);
  const keychainId = layout?.keychain ?? ownKeychainId;
  const category = layout?.category ?? ownCategory;
  const sort = layout?.sort ?? ownSort;
  const widths = layout?.widths ?? ownWidths;
  const sourcesWidth = layout?.sourcesWidth ?? ownSourcesWidth;
  const keychainsHeight = layout?.keychainsHeight ?? ownKeychainsHeight;
  const setKeychainId = (keychain: string) => {
    setOwnKeychainId(keychain);
    onLayoutChange?.({ keychain });
  };
  const setCategory = (next: KeychainAccessCategory) => {
    setOwnCategory(next);
    onLayoutChange?.({ category: next });
  };
  const setSort = (next: KeychainAccessSort) => {
    setOwnSort(next);
    onLayoutChange?.({ sort: next });
  };
  const setSourcesWidth = (next: number) => {
    setOwnSourcesWidth(next);
    onLayoutChange?.({ sourcesWidth: next });
  };
  const setKeychainsHeight = (next: number) => {
    setOwnKeychainsHeight(next);
    onLayoutChange?.({ keychainsHeight: next });
  };

  const keychain = keychains.find((candidate) => candidate.id === keychainId) ?? keychains[0];
  const columns = useMemo(
    () =>
      COLUMNS.map(
        (column): TableViewColumn => ({
          id: column.id,
          title: column.title,
          width: column.width === undefined ? undefined : (widths[column.id] ?? column.width),
          minWidth: column.width === undefined ? 56 : 40,
          sortable: true,
        }),
      ),
    [widths],
  );
  const rows = useMemo(
    () => arrange(items, { keychain: keychainId, category, query, sort }),
    [items, keychainId, category, query, sort],
  );
  // Among the listed rows: while a search, a keychain or a category hides a selected item, it is
  // not acted on, and the selection is back when the item is. The summary and Info speak of one
  // item, so with several selected the summary is empty and Info is unavailable.
  const selectedRows = useMemo(() => {
    const ids = new Set(selection);
    return rows.filter((item) => ids.has(item.id));
  }, [rows, selection]);
  const selected = selectedRows.length === 1 ? selectedRows[0] : undefined;
  const selectionNow = useRef(selection);
  selectionNow.current = selection;
  const moveNow = useRef(onMoveItems);
  moveNow.current = onMoveItems;
  const [keychainsFrame, setKeychainsFrame] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!keychainsFrame) return undefined;
    return registerDropTarget({
      element: keychainsFrame,
      landing: (hit, drag) => {
        const row = hit.closest("[role='row'][data-item-id]");
        const target = row?.getAttribute("data-item-id");
        const move = moveNow.current;
        if (!row || !target || !move || drag.items[0]?.type !== KEYCHAIN_ITEM_DRAG)
          return undefined;
        return {
          element: row,
          drop: () =>
            move(
              drag.items.map((item) => item.id),
              target,
            ),
        };
      },
    });
  }, [keychainsFrame]);
  useEffect(() => onSelectionChange?.(selectedRows), [onSelectionChange, selectedRows]);
  useImperativeHandle(selectAllRef, () => () => setSelection(rows.map((item) => item.id)), [rows]);

  const table = (
    <TableView
      aria-label="Items"
      className="mac-keychain-access-items"
      style={ITEMS}
      headerProps={ITEMS_HEADER}
      columns={columns}
      rowCount={rows.length}
      rowHeight={18}
      size="mini"
      alternatingRows
      selectionMode="multiple"
      getRowId={(row) => rows[row]?.id ?? ""}
      getRowLabel={(row) => rows[row]?.name ?? ""}
      value={selection}
      onValueChange={setSelection}
      getRowProps={(row) => {
        const id = rows[row]?.id;
        if (!onMoveItems || id === undefined) return undefined;
        return {
          onPointerDown: (down: PointerEvent<HTMLDivElement>) => {
            if (down.button !== 0) return;
            beginDesktopDrag(down.nativeEvent, {
              from: "keychain-access",
              items: () => {
                const chosen = selectionNow.current;
                const ids = chosen.includes(id) ? chosen : [id];
                return rows
                  .filter((item) => ids.includes(item.id))
                  .map((item) => ({
                    id: item.id,
                    name: item.name,
                    kind: "file" as const,
                    type: KEYCHAIN_ITEM_DRAG,
                  }));
              },
            });
          },
        };
      }}
      sort={sort}
      onSortChange={setSort}
      onColumnResize={(column, next) => {
        const change = { ...widths, [column]: next };
        setOwnWidths(change);
        onLayoutChange?.({ widths: change });
      }}
      onRowAction={(row) => {
        const item = rows[row];
        if (item) onInspect?.(item);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        if (selectedRows.length === 0 || !onDeleteItems) return;
        event.preventDefault();
        onDeleteItems(selectedRows);
      }}
      renderCell={(row, column) => {
        const item = rows[row];
        if (!item) return null;
        if (column.id === "keychain") {
          return keychains.find((each) => each.id === item.keychain)?.name ?? item.keychain;
        }
        if (column.id !== "name") return cellText(item, column.id, today);
        return (
          <span className="mac-keychain-access-name" data-keychain-item={item.id}>
            <span className="mac-keychain-access-name-icon">
              <ItemIcon kind={item.kind} />
            </span>
            {/* A long name loses its middle, as Keychain Access shows it. */}
            <TableViewCellText lineBreakMode="truncating-middle">{item.name}</TableViewCellText>
          </span>
        );
      }}
    />
  );

  const keychainsTable = (
    <TableView
      aria-label="Keychains"
      className="mac-keychain-access-keychains"
      columns={KEYCHAIN_COLUMNS}
      rowCount={keychains.length}
      rowHeight={20}
      size="small"
      getRowId={(row) => keychains[row]?.id ?? ""}
      getRowLabel={(row) => keychains[row]?.name ?? ""}
      value={[keychainId]}
      onValueChange={(next) => {
        if (typeof next[0] === "string") setKeychainId(next[0]);
      }}
      renderCell={(row) => {
        const entry = keychains[row];
        const shut = lockedKeychains
          ? lockedKeychains.has(entry?.id ?? "")
          : locked && entry?.id === "login";
        return entry ? (
          <span className="mac-keychain-access-source" data-keychain={entry.id}>
            <KeychainIcon icon={shut ? "locked" : entry.icon} />
            <span
              className="mac-keychain-access-source-name"
              data-default={entry.default ? "" : undefined}
            >
              {entry.name}
            </span>
          </span>
        ) : null;
      }}
    />
  );

  return (
    <Window aria-label="Keychain Access" width={width} height={height} {...windowProps}>
      <TitleBar
        ref={titleBarRef}
        variant="title-hidden"
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <Toolbar aria-label="Toolbar" style={TOOLBAR}>
          {onToggleLock ? (
            <ToolbarButton
              aria-label={
                locked
                  ? `Unlock the “${keychain?.name ?? "login"}” keychain`
                  : `Lock the “${keychain?.name ?? "login"}” keychain`
              }
              frame="bezel"
              onClick={onToggleLock}
              style={BUTTON}
            >
              <KeychainIcon icon={locked ? "locked" : "unlocked"} />
            </ToolbarButton>
          ) : null}
          <ToolbarButton
            aria-label="New Keychain Item"
            frame="bezel"
            onClick={() => {
              if (keychain) onAdd?.(keychain);
            }}
            style={BUTTON}
          >
            <SystemImage name="add" />
          </ToolbarButton>
          <ToolbarButton
            aria-label="Info"
            frame="bezel"
            disabled={!selected}
            onClick={() => {
              if (selected) onInspect?.(selected);
            }}
            style={BUTTON}
          >
            <SystemImage name="info-outline" />
          </ToolbarButton>
          <ToolbarSpace />
          <ToolbarSearchField
            inputRef={searchRef}
            value={query}
            onValueChange={setQuery}
            style={SEARCH}
          />
        </Toolbar>
      </TitleBar>
      <WindowBody ref={bodyRef} background="content" className="mac-keychain-access-body">
        <SplitView className="mac-keychain-access-split" style={SPLIT}>
          <SplitViewPane
            hidden={layout?.sourcesHidden}
            size={sourcesWidth}
            onSizeChange={setSourcesWidth}
            minSize={120}
            maxSize={320}
          >
            <SplitView
              orientation="vertical"
              className="mac-keychain-access-sources"
              style={SOURCES}
            >
              <SplitViewPane size={keychainsHeight} onSizeChange={setKeychainsHeight} minSize={63}>
                <div ref={setKeychainsFrame} className="mac-keychain-access-keychains-drop">
                  {keychainMenu && keychain ? (
                    <ContextualMenu>
                      <ContextualMenuTrigger
                        className="mac-keychain-access-keychains-frame"
                        onContextMenuCapture={(event: MouseEvent<HTMLElement>) => {
                          const id = (event.target as Element)
                            .closest("[role='row']")
                            ?.querySelector("[data-keychain]")
                            ?.getAttribute("data-keychain");
                          if (id) setKeychainId(id);
                        }}
                      >
                        {keychainsTable}
                      </ContextualMenuTrigger>
                      <ContextualMenuPopup>{keychainMenu(keychain)}</ContextualMenuPopup>
                    </ContextualMenu>
                  ) : (
                    keychainsTable
                  )}
                </div>
              </SplitViewPane>
              <SplitViewDivider aria-label="Resize the keychain list" />
              <SplitViewPane minSize={64}>
                <TableView
                  aria-label="Category"
                  className="mac-keychain-access-categories"
                  columns={CATEGORY_COLUMNS}
                  rowCount={CATEGORIES.length}
                  rowHeight={20}
                  size="small"
                  getRowId={(row) => CATEGORIES[row]?.id ?? ""}
                  getRowLabel={(row) => CATEGORIES[row]?.name ?? ""}
                  value={[category]}
                  onValueChange={(next) => {
                    const chosen = CATEGORIES.find((entry) => entry.id === next[0]);
                    if (chosen) setCategory(chosen.id);
                  }}
                  renderCell={(row) => {
                    const entry = CATEGORIES[row];
                    return entry ? (
                      <span className="mac-keychain-access-source">
                        <CategoryIcon category={entry.id} />
                        <span className="mac-keychain-access-source-name">{entry.name}</span>
                      </span>
                    ) : null;
                  }}
                />
              </SplitViewPane>
            </SplitView>
          </SplitViewPane>
          <SplitViewDivider
            hidden={layout?.sourcesHidden}
            aria-label="Resize the keychain and category lists"
          />
          <SplitViewPane minSize={300} className="mac-keychain-access-main">
            {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics; this is a named group of static text */}
            <div role="group" aria-label="Selected item" className="mac-keychain-access-summary">
              {selected ? (
                <>
                  <span className="mac-keychain-access-summary-icon">
                    <ItemIcon kind={selected.kind} size={64} />
                  </span>
                  <div className="mac-keychain-access-summary-text">
                    <Label
                      textStyle="emphasized"
                      truncate
                      className="mac-keychain-access-summary-name"
                    >
                      {selected.name}
                    </Label>
                    <Label
                      textStyle="small"
                      render={<dl />}
                      className="mac-keychain-access-summary-lines"
                    >
                      {describe(selected, today).map((line) => (
                        <div key={line.label} className="mac-keychain-access-summary-line">
                          <dt className="mac-keychain-access-summary-label">{line.label}</dt>
                          <dd className="mac-keychain-access-summary-value">{line.value}</dd>
                        </div>
                      ))}
                    </Label>
                  </div>
                </>
              ) : null}
            </div>
            {itemMenu ? (
              <ContextualMenu>
                <ContextualMenuTrigger
                  className="mac-keychain-access-items-frame"
                  onContextMenuCapture={(event: MouseEvent<HTMLElement>) => {
                    const id = (event.target as Element)
                      .closest("[role='row']")
                      ?.querySelector("[data-keychain-item]")
                      ?.getAttribute("data-keychain-item");
                    if (id && !selection.includes(id)) setSelection([id]);
                  }}
                >
                  {table}
                </ContextualMenuTrigger>
                <ContextualMenuPopup>{itemMenu}</ContextualMenuPopup>
              </ContextualMenu>
            ) : (
              table
            )}
            {statusText && keychain && !layout?.statusHidden ? (
              <Label textStyle="small" role="status" className="mac-keychain-access-status">
                {statusText(keychain, rows.length)}
              </Label>
            ) : null}
          </SplitViewPane>
        </SplitView>
      </WindowBody>
    </Window>
  );
}
