"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { ColumnView, type ColumnViewItem, ColumnViewPanel } from "macalicious/column-view";
import { GalleryView } from "macalicious/gallery-view";
import { IconView } from "macalicious/icon-view";
import { ImageButton } from "macalicious/image-button";
import { observeResize } from "macalicious/lib/observe-resize";
import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";
import { PushButton } from "macalicious/push-button";
import { SystemImage } from "macalicious/system-image";
import type { TableViewColumn } from "macalicious/table-view";
import { TagDot } from "macalicious/tag-dot";
import { TokenField } from "macalicious/token-field";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { requestPane } from "../system-preferences/pane-request";
import { ItemIcon, pictureBackground } from "./finder-artwork";
import {
  displayName,
  type FinderEntry,
  type FinderNode,
  type FinderSort,
  formatDate,
  formatSize,
  isContainer,
  kindText,
  listing,
  relativeDate,
  resolve,
  sizeOf,
  tagColor,
} from "./finder-data";
import { useDriveFile } from "./finder-drive";
import type { FinderGroup } from "./finder-groups";

/** What every view of a folder is given. */
export interface FinderViewProps {
  /** The accessible name of the view: the name of the place it shows. */
  label: string;
  /** The items shown, in order. */
  entries: readonly FinderEntry[];
  /** Paths of the selected items. */
  selection: readonly string[];
  onSelectionChange: (selection: string[]) => void;
  /** Called for a double click on an item, or Return while it is selected. */
  onOpen: (entry: FinderEntry) => void;
}

/**
 * Finder's canvas is the control background tinted by the desktop behind the window. The
 * column and gallery views take their background from a variable of their own.
 */
const TINTED = "var(--mac-color-control-background-tinted)";
const COLUMNS_STYLE = { "--mac-column-view-background": TINTED } as CSSProperties;
const GALLERY_STYLE = { "--mac-gallery-view-background": TINTED } as CSSProperties;

/** The small dot before the name of a tagged item. */
function tagDot(node: FinderNode | undefined) {
  const color = node && tagColor(node);
  return color && color !== "none" ? <TagDot color={color} size="small" /> : null;
}

/**
 * Distance between two rows of icons. The screenshots give two points, 116 pt for 64 pt icons
 * and 226 pt for 160 pt icons; sizes between them lie on the line through both.
 */
export const iconRowHeight = (iconSize: number) => Math.round(42.67 + 1.1458 * iconSize);

/** The line Show item info adds to a row of icons, in points. */
const ITEM_INFO_LINE = 14;

/** A list's row that heads a section of a grouped folder, by the section's name. */
const GROUP_ROW = "group:";
const isGroupRow = (id: string | number) => String(id).startsWith(GROUP_ROW);
/** A list's row for an item already listed in an earlier section. */
const ALSO_ROW = "also:";

/** The item a rendered row stands for, by the row's id: `undefined` for a section's heading. */
export function itemOfRow(id: string): string | undefined {
  if (isGroupRow(id)) return undefined;
  if (!id.startsWith(ALSO_ROW)) return id;
  // `also:<encoded section>/<path>`: an encoded name holds no slash.
  return id.slice(id.indexOf("/", ALSO_ROW.length) + 1);
}

/** The text of a view's items at `size` points, through the font token the view reads. */
const sizedText = (token: string, size: number | undefined): CSSProperties | undefined =>
  size === undefined
    ? undefined
    : ({
        [token]: `400 ${size}px / ${size + 4}px var(--mac-font-family-system)`,
      } as CSSProperties);

/** The line View Options' Show item info adds under a name. */
export function itemInfo(node: FinderNode): string | undefined {
  if (node.children) {
    const count = node.children.filter((child) => !child.hidden).length;
    return count === 1 ? "1 item" : `${count} items`;
  }
  if (node.dimensions) return node.dimensions.replace("×", " × ");
  return node.size === undefined ? undefined : formatSize(node.size);
}

export interface IconsViewProps extends FinderViewProps {
  /** Side of the icons in points. */
  iconSize: number;
  /** Points added to the width of a cell: View Options' Grid spacing. */
  grid?: number;
  /** The size of the names in points. */
  textSize?: number;
  /** A colour for the background, instead of the window's. */
  background?: string;
  /** View Options' Show item info. */
  showInfo?: boolean;
  /** View Options' Show icon preview. @default true */
  iconPreview?: boolean;
  /** The items in sections, for Use Groups. */
  groups?: readonly FinderGroup[];
}

/** Icon view: a grid of icons with their names, or a heading and a grid per section. */
export function IconsView({ groups, ...props }: IconsViewProps) {
  return groups ? <GroupedIcons {...props} groups={groups} /> : <IconGrid {...props} />;
}

/**
 * Sections of icons: each is one row, which scrolls sideways as a Mac's does, until Show All wraps it. Every item stays
 * in its grid either way, so what is selected is always there to scroll to.
 */
function GroupedIcons({
  groups,
  selection,
  onSelectionChange,
  iconSize,
  grid = 0,
  background,
  ...props
}: IconsViewProps & { groups: readonly FinderGroup[] }) {
  const place = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [shownWhole, setShownWhole] = useState<readonly string[]>([]);
  // A modifier held for the press or key that changes the selection: it adds to the other sections'.
  const adding = useRef(false);
  useEffect(() => {
    const element = place.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    return observeResize(element, measure);
  }, []);
  const cell = Math.max(103, iconSize + 17) + grid;
  const across = Math.max(1, Math.floor(width / cell));
  const row = iconRowHeight(iconSize) + (props.showInfo ? ITEM_INFO_LINE : 0);
  const held = (event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => {
    adding.current = event.metaKey || event.ctrlKey || event.shiftKey;
  };
  return (
    <div
      ref={place}
      className="mac-finder-view mac-finder-groups"
      style={
        background && background !== "white"
          ? ({ "--mac-icon-view-background": background, background } as CSSProperties)
          : undefined
      }
      onMouseDownCapture={held}
      onKeyDownCapture={held}
    >
      {groups.map(({ label, entries }) => {
        const whole = shownWhole.includes(label);
        const wraps = whole || entries.length <= across;
        const rows = wraps ? Math.ceil(entries.length / across) : 1;
        const paths = new Set(entries.map((entry) => entry.path));
        return (
          <section key={label} className="mac-finder-group" aria-label={label}>
            <header className="mac-finder-group-head">
              <h3 className="mac-finder-group-title">{label}</h3>
              {entries.length > across ? (
                <BorderlessButton
                  onClick={() =>
                    setShownWhole((names) =>
                      whole ? names.filter((name) => name !== label) : [...names, label],
                    )
                  }
                >
                  {whole ? "Show Less" : `Show All (${entries.length})`}
                </BorderlessButton>
              ) : null}
            </header>
            <div className="mac-finder-group-row">
              <IconGrid
                {...props}
                label={label}
                entries={entries}
                iconSize={iconSize}
                grid={grid}
                background={background}
                style={{
                  height: rows * row,
                  flex: "none",
                  width: wraps ? undefined : entries.length * cell,
                }}
                selection={selection.filter((path) => paths.has(path))}
                onSelectionChange={(next) =>
                  onSelectionChange(
                    adding.current
                      ? [...selection.filter((path) => !paths.has(path)), ...next]
                      : next,
                  )
                }
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** One grid of icons with their names. */
function IconGrid({
  label,
  entries,
  selection,
  onSelectionChange,
  onOpen,
  iconSize,
  grid = 0,
  textSize,
  background,
  showInfo = false,
  iconPreview = true,
  style,
}: Omit<IconsViewProps, "groups"> & { style?: CSSProperties }) {
  return (
    <IconView
      aria-label={label}
      className="mac-finder-view"
      style={
        {
          ...sizedText("--mac-font-icon-label-wrapped", textSize),
          ...(background && background !== "white"
            ? { "--mac-icon-view-background": background }
            : null),
          ...style,
        } as CSSProperties
      }
      count={entries.length}
      iconSize={iconSize}
      cellWidth={Math.max(103, iconSize + 17) + grid}
      rowHeight={iconRowHeight(iconSize) + (showInfo ? ITEM_INFO_LINE : 0)}
      renderIcon={(index) => {
        const node = entries[index]?.node;
        return node ? <ItemIcon node={node} size={iconSize} preview={iconPreview} /> : null;
      }}
      getItemDetail={
        showInfo
          ? (index) => {
              const node = entries[index]?.node;
              return node ? itemInfo(node) : undefined;
            }
          : undefined
      }
      renderTag={(index) => tagDot(entries[index]?.node)}
      getItemLabel={(index) => {
        const node = entries[index]?.node;
        return node ? displayName(node) : "";
      }}
      getItemId={(index) => entries[index]?.path ?? index}
      value={selection as string[]}
      onValueChange={(value) => onSelectionChange(value as string[])}
      onItemAction={(index) => {
        const entry = entries[index];
        if (entry) onOpen(entry);
      }}
    />
  );
}

interface Row extends OutlineViewItem {
  id: string;
  entry: FinderEntry;
}

const NAME_COLUMN: TableViewColumn = {
  id: "name",
  title: "Name",
  width: 280,
  minWidth: 120,
  sortable: true,
};

/** The columns a list can show after Name, in the order it shows them. */
export const LIST_COLUMNS: readonly TableViewColumn[] = [
  { id: "modified", title: "Date Modified", width: 180, minWidth: 80, sortable: true },
  { id: "created", title: "Date Created", width: 180, minWidth: 80, sortable: true },
  { id: "opened", title: "Date Last Opened", width: 180, minWidth: 80, sortable: true },
  { id: "size", title: "Size", width: 80, minWidth: 50, align: "right", sortable: true },
  { id: "kind", title: "Kind", width: 160, minWidth: 80, sortable: true },
  { id: "tags", title: "Tags", width: 120, minWidth: 60, sortable: true },
  { id: "comments", title: "Comments", width: 180, minWidth: 60, sortable: true },
];

/** The columns a list shows until the person chooses others. */
export const DEFAULT_LIST_COLUMNS: readonly string[] = ["modified", "size", "kind"];

export interface ListingViewProps extends FinderViewProps {
  /** The tree, to list what is inside a folder the user expands. */
  root: FinderNode;
  sort: FinderSort;
  onSortChange: (sort: FinderSort) => void;
  /** Paths of the expanded folders. */
  expanded: readonly string[];
  onExpandedChange: (expanded: string[]) => void;
  /**
   * A list of items gathered from all over the tree (search results, Recents, a tag): its
   * folders do not expand, so that no item is listed twice.
   */
  flat: boolean;
  /** The columns shown after Name. */
  columns?: readonly string[];
  /** Side of the icons in points. */
  iconSize?: number;
  textSize?: number;
  /** Show Today and Yesterday in place of those dates. */
  relativeDates?: boolean;
  /** Show a folder's size: what it holds, all the way down. */
  allSizes?: boolean;
  /** The items in sections, for Use Groups: a heading row, then the section's items. */
  groups?: readonly FinderGroup[];
}

/** List view: one row per item with its date, size and kind; a folder expands in place. */
export function ListingView({
  label,
  entries,
  selection,
  onSelectionChange,
  onOpen,
  root,
  sort,
  onSortChange,
  expanded,
  onExpandedChange,
  flat,
  columns = DEFAULT_LIST_COLUMNS,
  iconSize = 16,
  textSize,
  relativeDates = false,
  allSizes = false,
  groups,
}: ListingViewProps) {
  const toggling = useRef(false);
  const shownColumns = useMemo(() => {
    const shown = LIST_COLUMNS.filter((column) => columns.includes(column.id));
    // The last column fills what is left, as Kind does by default.
    return [NAME_COLUMN, ...shown].map((column, index, all) =>
      index === all.length - 1 && index > 0 ? { ...column, width: undefined } : column,
    );
  }, [columns]);
  const dated = (stamp: string | undefined) =>
    relativeDates ? relativeDate(stamp, new Date()) : formatDate(stamp);
  const items = useMemo(() => {
    const row = (entry: FinderEntry): Row => ({
      id: entry.path,
      entry,
      children:
        !flat && isContainer(entry.node) ? listing(root, entry.path, sort).map(row) : undefined,
    });
    if (groups) {
      // As on a Mac, a grouped list's folders do not expand, and its sections do not fold: a heading row, then its
      // items. An item in several sections (two tags) has a row in each, under an id of its own after the first.
      const seen = new Set<string>();
      return groups.flatMap(({ label: name, entries: inside }): Row[] => [
        {
          id: GROUP_ROW + name,
          entry: { path: GROUP_ROW + name, node: { name, kind: "folder" as const } },
        },
        ...inside.map((entry) => {
          const id = seen.has(entry.path)
            ? `${ALSO_ROW}${encodeURIComponent(name)}/${entry.path}`
            : entry.path;
          seen.add(entry.path);
          return { id, entry };
        }),
      ]);
    }
    return entries.map(row);
  }, [entries, root, sort, flat, groups]);
  const alsoRows = useMemo(() => {
    const paths = new Map<string, string>();
    for (const { id, entry } of items) {
      if (id.startsWith(ALSO_ROW)) paths.set(id, entry.path);
    }
    return paths;
  }, [items]);
  const shownSelection = useMemo(
    () => [
      ...selection,
      ...[...alsoRows].filter(([, path]) => selection.includes(path)).map(([id]) => id),
    ],
    [selection, alsoRows],
  );

  return (
    <OutlineView<Row>
      aria-label={label}
      className="mac-finder-view"
      style={sizedText("--mac-font-body", textSize)}
      items={items}
      columns={shownColumns}
      rowHeight={iconSize > 16 ? iconSize + 3 : undefined}
      alternatingRows
      selectionMode="multiple"
      sort={sort}
      onSortChange={onSortChange}
      expanded={expanded}
      onExpandedChange={(next) => onExpandedChange(next.map(String))}
      getItemLabel={(item) => displayName(item.entry.node)}
      renderCell={(item, column) => {
        const { node } = item.entry;
        if (isGroupRow(item.id)) {
          return column.id === "name" ? (
            <span className="mac-finder-group-title">{node.name}</span>
          ) : null;
        }
        switch (column.id) {
          case "name":
            return (
              <span className="mac-finder-name">
                <ItemIcon node={node} size={iconSize} />
                <span className="mac-finder-name-text">{displayName(node)}</span>
                {tagDot(node)}
              </span>
            );
          case "modified":
            return dated(node.modified);
          case "created":
            return dated(node.created);
          case "opened":
            return dated(node.opened);
          case "size":
            return formatSize(allSizes && isContainer(node) ? sizeOf(node) : node.size);
          case "tags":
            return (node.tags ?? []).join(", ");
          case "comments":
            return node.comment ?? "";
          default:
            return kindText(node);
        }
      }}
      value={shownSelection}
      onMouseDownCapture={(event) => {
        toggling.current = event.metaKey || event.ctrlKey;
      }}
      onKeyDownCapture={(event) => {
        toggling.current = event.metaKey || event.ctrlKey;
      }}
      onValueChange={(value) => {
        const pathOf = (id: string) => alsoRows.get(id) ?? id;
        const next = new Set(value.map(String).filter((id) => !isGroupRow(id)));
        // Toggling one of an item's rows off takes the item, and so its other rows, off.
        const off = toggling.current
          ? new Set(shownSelection.filter((id) => !next.has(id)).map(pathOf))
          : new Set<string>();
        onSelectionChange([...new Set([...next].map(pathOf))].filter((path) => !off.has(path)));
      }}
      onItemAction={(item) => {
        if (!isGroupRow(item.id)) onOpen(item.entry);
      }}
    />
  );
}

export interface ColumnsViewProps extends Omit<FinderViewProps, "selection" | "onSelectionChange"> {
  root: FinderNode;
  sort: FinderSort;
  /** The path of the selected item of each column. */
  columns: readonly string[];
  /** What is selected: several items of the last column, or its one item. */
  selection: readonly string[];
  /** `several` is what is selected when it is more than the last of `columns`. */
  onColumnsChange: (columns: string[], several?: readonly string[]) => void;
  /** Called by a server's Connect As button with the server's path. */
  onConnect: (path: string) => void;
  /** Called by a server's Share Screen button; without it the button is disabled. */
  onShareScreen?: (path: string) => void;
  textSize?: number;
  /** Whether items show their icons. */
  showIcons?: boolean;
  /** Whether the last column shows the selected item. */
  showPreview?: boolean;
}

/** Column view: a column per folder along the selected path, then a preview of the item. */
export function ColumnsView({
  label,
  entries,
  onOpen,
  root,
  sort,
  columns,
  selection,
  onColumnsChange,
  onConnect,
  onShareScreen,
  textSize,
  showIcons = true,
  showPreview = true,
}: ColumnsViewProps) {
  const getChildren = useCallback(
    (parent: string | number | null): ColumnViewItem[] | null => {
      // A server that is not connected lists nothing: its column is the connection panel.
      if (parent !== null && !resolve(root, String(parent))?.children) return null;
      const inside = parent === null ? entries : listing(root, String(parent), sort);
      return inside.map(({ path, node }) => ({
        id: path,
        label: node.name,
        icon: showIcons ? <ItemIcon node={node} size={16} /> : undefined,
        hasChildren: isContainer(node) || node.kind === "server",
      }));
    },
    [entries, root, sort, showIcons],
  );

  // Several items selected: the path stops at the column they stand in, and nothing opens from them.
  const several = selection.length > 1;
  const holder = columns.slice(0, -1);
  const pathOfRow = (target: EventTarget) =>
    (target as Element).closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
  return (
    <ColumnView
      aria-label={label}
      className="mac-finder-view"
      style={{ ...COLUMNS_STYLE, ...sizedText("--mac-font-body", textSize) }}
      getChildren={getChildren}
      path={(several ? holder : columns) as string[]}
      selection={several ? selection : undefined}
      onPathChange={(path) => onColumnsChange(path.map(String))}
      onMouseDown={(event) => {
        const row = pathOfRow(event.target);
        if (event.button !== 0 || row === undefined) return;
        if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
          // A press on one of several may be the start of dragging them: the click settles it.
          if (several && selection.includes(row)) event.preventDefault();
          return;
        }
        // The column the row stands in, and the item the selection there goes from.
        const inColumn = (depth: number) =>
          (getChildren(depth === 0 ? null : (columns[depth - 1] as string)) ?? []).map(({ id }) =>
            String(id),
          );
        const depth = columns.findIndex((_, at) => inColumn(at).includes(row));
        const at = depth < 0 ? columns.length : depth;
        const beside = inColumn(at);
        const anchor = columns[at];
        // With nothing selected in its column, the row is simply the first selected.
        if (anchor === undefined || !beside.includes(row)) return;
        event.preventDefault();
        const upTo = columns.slice(0, at);
        const here = selection.filter((path) => beside.includes(path));
        const before = here.length > 0 ? here : [anchor];
        const [from, to] = [beside.indexOf(anchor), beside.indexOf(row)].sort((a, b) => a - b);
        const next = event.shiftKey
          ? [...new Set([...before, ...beside.slice(from, (to as number) + 1)])]
          : before.includes(row)
            ? before.filter((path) => path !== row)
            : [...before, row];
        const stands = next.includes(row) ? row : next.at(-1);
        onColumnsChange(
          stands === undefined ? upTo : [...upTo, stands],
          next.length === 1 ? undefined : next,
        );
      }}
      onClick={(event) => {
        const row = pathOfRow(event.target);
        if (
          several &&
          row !== undefined &&
          selection.includes(row) &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          onColumnsChange([...holder, row]);
        }
      }}
      defaultColumnWidths={[204, 252]}
      onItemAction={(item) => {
        const node = resolve(root, String(item.id));
        if (node) onOpen({ path: String(item.id), node });
      }}
      renderPreview={(item) => {
        const path = String(item.id);
        const node = resolve(root, path);
        if (!node) return null;
        if (!showPreview && node.kind !== "server") return null;
        if (node.kind === "server") {
          return (
            <ColumnViewPanel className="mac-finder-server-panel">
              <div className="mac-finder-server">
                <ItemIcon node={node} size={48} />
                <strong className="mac-finder-server-name">{node.name}</strong>
                <span className="mac-finder-detail">Not Connected</span>
                <PushButton
                  size="small"
                  className="mac-finder-server-button"
                  onClick={() => onConnect(path)}
                >
                  Connect As...
                </PushButton>
                <PushButton
                  size="small"
                  className="mac-finder-server-button"
                  disabled={!onShareScreen}
                  onClick={() => onShareScreen?.(path)}
                >
                  Share Screen...
                </PushButton>
              </div>
            </ColumnViewPanel>
          );
        }
        return (
          <ColumnViewPanel>
            <div className="mac-finder-file">
              <ItemIcon node={node} size={128} />
              <strong className="mac-finder-file-name">{displayName(node)}</strong>
              <span className="mac-finder-detail">
                {kindText(node)} - {formatSize(node.size)}
              </span>
              <span className="mac-finder-detail">Modified {formatDate(node.modified)}</span>
            </div>
          </ColumnViewPanel>
        );
      }}
    />
  );
}

/** A picture as large as its place allows, turned by Rotate Left. */
function pictureStyle(node: FinderNode): CSSProperties {
  return {
    width: "100%",
    aspectRatio: node.dimensions === "2560×1920" ? "4 / 3" : "16 / 9",
    background: pictureBackground(node.name),
    rotate: `${(node.rotation ?? 0) * -90}deg`,
  };
}

/** The gallery's picture: a drive file's own, once read, or the stand-in of the in-memory tree. */
function ShownPicture({ node }: { node: FinderNode }) {
  const file = useDriveFile(node.id, node.kind, node.id !== undefined, String(node.revision ?? ""));
  const style = pictureStyle(node);
  if (file && !(file instanceof Error)) {
    return (
      <div
        style={{
          ...style,
          aspectRatio: undefined,
          height: "100%",
          background: `center / contain no-repeat url("${file.url}")`,
        }}
      />
    );
  }
  return <div style={style} />;
}

export interface GalleryProps extends FinderViewProps {
  /** Called by the Preview pane's Rotate Left with the picture's path. */
  onRotate: (path: string) => void;
  /** Called with an item's path and its new tags when the Preview pane's field changes them. */
  onTagsChange: (path: string, tags: string[]) => void;
  /** Whether the Preview pane shows beside the picture. */
  showPreview?: boolean;
  /** View Options' Thumbnail size, in points. @default 54 */
  thumbnail?: number;
  /** The Preview pane's Markup, where the window has Quick Look to do it in. */
  onMarkup?: () => void;
}
/** Gallery view: a large preview over a strip of thumbnails, with the Preview pane beside. */
export function Gallery({
  label,
  entries,
  selection,
  onSelectionChange,
  onOpen,
  onRotate,
  onTagsChange,
  showPreview = true,
  thumbnail = 54,
  onMarkup,
}: GalleryProps) {
  const shown = entries.find((entry) => entry.path === selection[0]);
  return (
    <GalleryView
      aria-label={label}
      className="mac-finder-view"
      style={GALLERY_STYLE}
      thumbnailSize={thumbnail}
      count={entries.length}
      getItemId={(index) => entries[index]?.path ?? index}
      getItemLabel={(index) => {
        const node = entries[index]?.node;
        return node ? displayName(node) : "";
      }}
      renderPreview={(index) => {
        const node = entries[index]?.node;
        if (!node) return null;
        return node.kind === "image" ? (
          <ShownPicture node={node} />
        ) : (
          <ItemIcon node={node} size={256} />
        );
      }}
      renderThumbnail={(index) => {
        const node = entries[index]?.node;
        return node ? (
          <ItemIcon node={node} size={node.kind === "image" ? thumbnail - 6 : thumbnail - 14} />
        ) : null;
      }}
      value={shown ? [shown.path] : []}
      onValueChange={(value) => onSelectionChange(value.map(String))}
      onItemAction={(index) => {
        const entry = entries[index];
        if (entry) onOpen(entry);
      }}
      inspector={
        showPreview && shown ? (
          <PreviewPane
            entry={shown}
            onRotate={onRotate}
            onTagsChange={onTagsChange}
            onMarkup={onMarkup}
          />
        ) : undefined
      }
    />
  );
}

/** Finder's Preview pane: the item's name, kind and size, its dates, tags and Quick Actions. */
function PreviewPane({
  entry,
  onRotate,
  onTagsChange,
  onMarkup,
}: {
  entry: FinderEntry;
  onRotate: (path: string) => void;
  onTagsChange: (path: string, tags: string[]) => void;
  onMarkup?: () => void;
}) {
  const { node, path } = entry;
  const facts: [string, string][] = [
    ["Created", formatDate(node.modified, "long")],
    ["Modified", formatDate(node.modified, "long")],
  ];
  if (node.kind === "image") {
    facts.push(["Last opened", formatDate(node.opened ?? node.modified, "short")]);
    facts.push(["Dimensions", node.dimensions ?? "--"]);
    facts.push(["Resolution", "240×240"]);
  }
  return (
    <section className="mac-finder-preview" aria-label="Preview">
      <header className="mac-finder-preview-header">
        <ItemIcon node={node} size={44} />
        <div>
          <div className="mac-finder-preview-name">{displayName(node)}</div>
          <div className="mac-finder-detail">
            {kindText(node)}
            {node.size === undefined ? "" : ` - ${formatSize(node.size)}`}
          </div>
        </div>
      </header>
      <h3 className="mac-finder-preview-heading">Information</h3>
      <dl className="mac-finder-preview-facts">
        {facts.map(([name, value]) => (
          <div key={name} className="mac-finder-preview-fact">
            <dt className="mac-finder-detail">{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mac-finder-preview-heading">Tags</h3>
      <TokenField
        aria-label="Tags"
        className="mac-finder-preview-tags"
        bordered={false}
        placeholder={node.tags?.length ? undefined : "Add Tags..."}
        value={node.tags ?? []}
        onValueChange={(tags) => onTagsChange(path, tags)}
      />
      {node.kind === "image" && (
        <div className="mac-finder-preview-actions">
          <ImageButton label="Rotate Left" onClick={() => onRotate(path)}>
            <SystemImage name="rotate-left" />
          </ImageButton>
          {onMarkup ? <BorderlessButton onClick={onMarkup}>Markup</BorderlessButton> : null}
          <BorderlessButton
            onClick={() => {
              requestPane("extensions");
              requestDesktopEffects([{ open: "system-preferences" }]);
            }}
          >
            More…
          </BorderlessButton>
        </div>
      )}
    </section>
  );
}
