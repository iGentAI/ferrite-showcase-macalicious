"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { ImageView } from "macalicious/image-view";
import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { Separator } from "macalicious/separator";
import { Sidebar, SidebarItem } from "macalicious/sidebar";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  use,
  useMemo,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { requestHelp } from "../desktop/desktop-help";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import {
  availableSize,
  COLUMNS,
  categorySize,
  defaultAvailable,
  defaultCapacity,
  defaultCategories,
  defaultSort,
  deleteFile,
  filesSize,
  formatDate,
  formatSize,
  isSelectable,
  listCategories,
  RECOMMENDATIONS,
  RECOMMENDATIONS_ID,
  resolveSelection,
  type StorageCategory,
  type StorageFile,
  type StorageRecommendation,
  type StorageRecommendationId,
  type StorageSort,
  sortFiles,
  windowTitle,
} from "./storage-management-data";
import { CompletedMark, SidebarGlyph } from "./storage-management-icons";
import "./storage-management.tokens.css";
import "./storage-management.css";

export interface StorageManagementProps extends Omit<WindowProps, "children"> {
  /**
   * The categories of the sidebar, each with its size and the files it lists. Those that are
   * not `selectable` are dimmed and listed last. A later change of the prop is followed; the
   * files deleted in the window stay deleted.
   * @default defaultCategories
   */
  categories?: readonly StorageCategory[];
  /**
   * The disk's name: the start of the window's title.
   * @default "Macintosh SSD"
   */
  diskName?: string;
  /**
   * The disk's capacity in bytes.
   * @default defaultCapacity
   */
  capacity?: number;
  /**
   * The free space in bytes, before anything is deleted in the window.
   * @default defaultAvailable
   */
  available?: number;
  /**
   * The window's title in place of the disk's name and space, for a host that reports something
   * other than a disk.
   */
  title?: string;
  /**
   * The rows of the Recommendations pane.
   * @default RECOMMENDATIONS
   */
  recommendations?: readonly StorageRecommendation[];
  /**
   * Id of the selected row of the sidebar (controlled): `"recommendations"` or a category's
   * id. An id that names no row that can be opened shows Recommendations.
   */
  selectedId?: string;
  /**
   * Id of the row selected at first (uncontrolled).
   * @default "recommendations"
   */
  defaultSelectedId?: string;
  /** Called with the id of the row chosen in the sidebar or opened by Review Files. */
  onSelectedIdChange?: (id: string) => void;
  /**
   * The surface of the sidebar: vibrant over a desktop, or opaque on a plain page.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /** Called with the id of a recommendation when its button is chosen. */
  onRecommendation?: (id: StorageRecommendationId) => void;
  /** Called with a file and the id of its category when Delete… removes it. */
  onDelete?: (file: StorageFile, categoryId: string) => void;
  /**
   * Called with the files Delete… removes, all at once, in place of one `onDelete` for each: for a
   * host that asks first about all of them.
   */
  onDeleteSelection?: (files: readonly StorageFile[], categoryId: string) => void;
  /**
   * Called with a file and the id of its category when Show in Finder is chosen. Without it the
   * category's bar has no Show in Finder button.
   */
  onReveal?: (file: StorageFile, categoryId: string) => void;
  /**
   * Whether Show in Finder can show `file`.
   * @default () => true
   */
  revealable?: (file: StorageFile) => boolean;
  /**
   * The order of a category's files (controlled); without it the window keeps its own, starting
   * with the largest file.
   */
  sort?: StorageSort;
  /** Called with the order chosen in a table's heading. */
  onSortChange?: (sort: StorageSort) => void;
  /**
   * Called with a file when Quick Look or the Space bar asks for it. Without it the table's menu
   * has no Quick Look row.
   */
  onQuickLook?: (file: StorageFile) => void;
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

/* The sidebar's documented hooks, set to what the captures measure: 28 pt rows that touch,
   20 pt glyphs, and the name 6 pt after its glyph. */
const SIDEBAR = {
  "--mac-sidebar-row-height": "28px",
  "--mac-sidebar-row-spacing": "0px",
  "--mac-sidebar-icon-size": "20px",
  "--mac-sidebar-label-gap": "6px",
} as CSSProperties;

/* The buttons of the Recommendations pane are 127 pt wide, whatever their title: a 128 pt
   box, as a button's bezel is drawn half a point inside its box. The longest title is a little
   wider in the fallback font, so the padding is reduced to keep it whole. */
const ACTION: CSSProperties = { width: 128, paddingInline: 6 };

/** One recommendation: stand-in artwork, title and text, and its button or "Completed". */
function Recommendation({
  recommendation,
  completed,
  disabled,
  onAction,
}: {
  recommendation: StorageRecommendation;
  completed: boolean;
  disabled: boolean;
  onAction: () => void;
}) {
  return (
    <li className="mac-storage-management-recommendation">
      <div className="mac-storage-management-recommendation-row">
        <ImageView width={44} height={44} className="mac-storage-management-artwork" />
        <div className="mac-storage-management-recommendation-text">
          <h2 className="mac-storage-management-recommendation-title">
            <Label textStyle="emphasized">{recommendation.title}</Label>
          </h2>
          <Label
            textStyle="callout"
            render={<p />}
            className="mac-storage-management-recommendation-description"
          >
            {recommendation.description}
          </Label>
        </div>
        {completed ? (
          <div className="mac-storage-management-completed" role="status">
            <CompletedMark />
            <Label>Completed</Label>
          </div>
        ) : recommendation.action !== undefined ? (
          <PushButton
            className="mac-storage-management-action"
            style={ACTION}
            disabled={disabled}
            title={disabled ? "There are no files to review." : undefined}
            onClick={onAction}
          >
            {recommendation.action}
          </PushButton>
        ) : null}
      </div>
      <Separator aria-hidden="true" className="mac-storage-management-recommendation-rule" />
    </li>
  );
}

/** A category's files: a sortable table over the bar with the count and the Delete… button. */
function Category({
  category,
  sort,
  onSortChange,
  selectedFiles,
  onSelectedFilesChange,
  onDelete,
  onReveal,
  revealable,
  onQuickLook,
}: {
  category: StorageCategory;
  sort: StorageSort;
  onSortChange: (sort: StorageSort) => void;
  selectedFiles: readonly string[];
  onSelectedFilesChange: (ids: readonly string[]) => void;
  onDelete: (files: readonly StorageFile[]) => void;
  onReveal?: (file: StorageFile) => void;
  revealable?: (file: StorageFile) => boolean;
  onQuickLook?: (file: StorageFile) => void;
}) {
  const columns = useMemo(
    () =>
      COLUMNS.map(
        (column): TableViewColumn => ({
          ...column,
          minWidth: "width" in column ? undefined : 160,
          sortable: true,
        }),
      ),
    [],
  );
  const files = useMemo(() => sortFiles(category.files ?? [], sort), [category.files, sort]);
  const selected = files.filter((file) => selectedFiles.includes(file.id));
  const one = selected.length === 1 ? selected[0] : undefined;
  const canReveal = Boolean(one && onReveal && (revealable ? revealable(one) : true));
  const reveal = () => {
    if (one && canReveal) onReveal?.(one);
  };
  const erase = () => {
    if (selected.length > 0 && !category.readOnly) onDelete(selected);
  };
  const lookable = category.readOnly ? undefined : onQuickLook;
  const canLook = Boolean(one && lookable && (revealable ? revealable(one) : true));
  const look = () => {
    if (one && canLook) lookable?.(one);
  };
  const listed = filesSize(files);
  return (
    <section aria-label={category.name} className="mac-storage-management-category">
      {category.description ? (
        <Label
          textStyle="small"
          color="secondary"
          render={<p />}
          className="mac-storage-management-category-description"
        >
          {category.description}
        </Label>
      ) : null}
      <div className="mac-storage-management-files">
        {files.length === 0 ? (
          <EmptyState>No Files</EmptyState>
        ) : (
          <ContextualMenu>
            <ContextualMenuTrigger
              className="mac-storage-management-table-frame"
              onContextMenuCapture={(event: MouseEvent<HTMLElement>) => {
                // A secondary click on a row that is not selected selects that row alone.
                const id = (event.target as Element)
                  .closest("[role='row']")
                  ?.querySelector("[data-file-row]")
                  ?.getAttribute("data-file-row");
                if (id && !selectedFiles.includes(id)) onSelectedFilesChange([id]);
              }}
              onKeyDownCapture={(event: KeyboardEvent<HTMLElement>) => {
                // Before the table, whose Space would toggle the selected row off.
                if (event.key === " " && canLook) {
                  event.preventDefault();
                  event.stopPropagation();
                  look();
                }
              }}
              onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                if (event.key === "Backspace" || event.key === "Delete") {
                  event.preventDefault();
                  erase();
                }
              }}
            >
              <TableView
                aria-label={`${category.name} files`}
                className="mac-storage-management-table"
                columns={columns}
                rowCount={files.length}
                alternatingRows
                selectionMode="multiple"
                getRowId={(row) => files[row]?.id ?? row}
                getRowLabel={(row) => files[row]?.name ?? ""}
                value={selected.map((file) => file.id)}
                onValueChange={(value) =>
                  onSelectedFilesChange(value.filter((id): id is string => typeof id === "string"))
                }
                sort={sort}
                onSortChange={onSortChange}
                renderCell={(row, column) => {
                  const file = files[row];
                  if (!file) return null;
                  if (column.id === "size") return formatSize(file.size);
                  if (column.id === "lastAccessed") return formatDate(file.lastAccessed);
                  return column.id === "kind" ? (
                    file.kind
                  ) : (
                    <span data-file-row={file.id}>{file.name}</span>
                  );
                }}
              />
            </ContextualMenuTrigger>
            <ContextualMenuPopup>
              {lookable ? (
                <MenuItem disabled={!canLook} onClick={look}>
                  Quick Look
                </MenuItem>
              ) : null}
              {onReveal && !category.readOnly ? (
                <MenuItem disabled={!canReveal} onClick={reveal}>
                  Show in Finder
                </MenuItem>
              ) : null}
              {category.readOnly ? null : (
                <MenuItem disabled={selected.length === 0} onClick={erase}>
                  Delete…
                </MenuItem>
              )}
            </ContextualMenuPopup>
          </ContextualMenu>
        )}
      </div>
      <div className="mac-storage-management-category-bar">
        <Label textStyle="small" color="secondary" role="status" truncate>
          {one
            ? `${one.name}, ${formatSize(one.size)}`
            : selected.length > 1
              ? `${selected.length} items selected, ${formatSize(filesSize(selected))}`
              : `${files.length} ${files.length === 1 ? "item" : "items"}, ${formatSize(listed)}`}
        </Label>
        {onReveal && !category.readOnly ? (
          <PushButton disabled={!canReveal} onClick={reveal}>
            Show in Finder
          </PushButton>
        ) : null}
        {category.readOnly ? null : (
          <PushButton disabled={selected.length === 0} onClick={erase}>
            Delete…
          </PushButton>
        )}
      </div>
    </section>
  );
}

/**
 * The Storage Management window of macOS 10.15: a sidebar with Recommendations, the
 * categories with their sizes and the dimmed rows that cannot be opened, beside the four
 * recommendations or the files of the selected category. A recommendation's button carries it
 * out, and Review Files opens Documents; Delete… removes the selected file, and the category's
 * size and the free space of the title follow. The files are invented, the icons are plain
 * stand-ins, and nothing on the machine is read or changed.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function StorageManagement({
  categories = defaultCategories,
  diskName = "Macintosh SSD",
  capacity = defaultCapacity,
  available = defaultAvailable,
  title,
  recommendations = RECOMMENDATIONS,
  selectedId,
  defaultSelectedId = RECOMMENDATIONS_ID,
  onSelectedIdChange,
  material = "translucent",
  onRecommendation,
  onDelete,
  onDeleteSelection,
  onReveal,
  revealable,
  sort: sortGiven,
  onSortChange,
  onQuickLook,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 801,
  height = 532,
  className,
  ...windowProps
}: StorageManagementProps) {
  const [ownId, setOwnId] = useState(defaultSelectedId);
  // The files deleted in the window, by category: what is shown is the host's categories
  // without them, so a later change of `categories` is followed. Maps, because a category's
  // id is any string: "constructor" is one.
  const [deleted, setDeleted] = useState<ReadonlyMap<string, readonly string[]>>(new Map());
  const [completed, setCompleted] = useState<readonly StorageRecommendationId[]>([]);
  const [ownSort, setOwnSort] = useState<StorageSort>(defaultSort);
  const sort = sortGiven ?? ownSort;
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const launch = use(DesktopWindowHostContext)?.launch;
  // Each category keeps its own selected files while another row is shown.
  const [selectedFiles, setSelectedFiles] = useState<ReadonlyMap<string, readonly string[]>>(
    new Map(),
  );

  // A recommendation that has gone is done with: when it comes back (a Trash emptied and filled
  // again) its button is back too.
  const stillCompleted = completed.filter((id) => recommendations.some((item) => item.id === id));
  if (stillCompleted.length !== completed.length) setCompleted(stillCompleted);

  const given = useMemo(() => listCategories(categories), [categories]);
  const current = useMemo(
    () => given.map((category) => (deleted.get(category.id) ?? []).reduce(deleteFile, category)),
    [given, deleted],
  );
  const opened = current.filter(isSelectable);
  const fixed = current.filter((category) => !isSelectable(category));
  // The window always shows a row: an id that names none that can be opened, at first or
  // after `categories` changed, stands for Recommendations.
  const selected = resolveSelection(current, selectedId ?? ownId);
  const category = opened.find((candidate) => candidate.id === selected);

  const select = (id: string | null | undefined) => {
    const next = resolveSelection(current, id);
    if (next === selected) return;
    setOwnId(next);
    onSelectedIdChange?.(next);
  };

  // Review Files opens the category its recommendation names, or else the first one that
  // can be opened; with none, its button is disabled.
  const reviewed = (recommendation: StorageRecommendation) =>
    opened.find((candidate) => candidate.id === recommendation.reviews)?.id ?? opened[0]?.id;

  const size = (entry: StorageCategory) => (
    <span className="mac-storage-management-size">{formatSize(categorySize(entry))}</span>
  );

  const chosen = category ? (selectedFiles.get(category.id) ?? []) : [];
  const shownFiles = category?.files ?? [];
  const chosenFiles = shownFiles.filter((file) => chosen.includes(file.id));
  const deleteFiles = (files: readonly StorageFile[]) => {
    if (!category) return;
    setDeleted((all) =>
      new Map(all).set(category.id, [
        ...(all.get(category.id) ?? []),
        ...files.map((file) => file.id),
      ]),
    );
    setSelectedFiles((all) => new Map(all).set(category.id, []));
    if (onDeleteSelection) onDeleteSelection(files, category.id);
    else for (const file of files) onDelete?.(file, category.id);
  };
  const canDelete = chosenFiles.length > 0 && !category?.readOnly;
  const editMenu = (
    <>
      <MenuItem
        keyEquivalent="command+a"
        disabled={shownFiles.length === 0}
        onClick={() => {
          if (category)
            setSelectedFiles((all) =>
              new Map(all).set(
                category.id,
                shownFiles.map((file) => file.id),
              ),
            );
        }}
      >
        Select All
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!canDelete} onClick={() => deleteFiles(chosenFiles)}>
        Delete…
      </MenuItem>
    </>
  );
  useDesktopAppMenu("storage-management", "Edit", editMenu, titleBar);
  const helpMenu = useMemo(
    () =>
      launch ? (
        <MenuItem onClick={() => requestHelp("Storage Management")}>
          Storage Management Help
        </MenuItem>
      ) : null,
    [launch],
  );
  useDesktopAppMenu("storage-management", "Help", helpMenu, titleBar);

  return (
    <Window
      width={width}
      height={height}
      className={cn("mac-storage-management", className)}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        title={
          title ??
          windowTitle(diskName, availableSize(available, capacity, given, current), capacity)
        }
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
      />
      <WindowBody background="content" className="mac-storage-management-body">
        <SplitView className="mac-storage-management-split">
          <SplitViewPane size={200}>
            <Sidebar
              aria-label="Categories"
              material={material}
              className="mac-storage-management-sidebar"
              style={SIDEBAR}
              value={selected}
              onValueChange={select}
            >
              <SidebarItem
                value={RECOMMENDATIONS_ID}
                label="Recommendations"
                icon={<SidebarGlyph shape="disc" />}
                className="mac-storage-management-row"
              />
              <Separator aria-hidden="true" className="mac-storage-management-rule" />
              {opened.map((entry) => (
                <SidebarItem
                  key={entry.id}
                  value={entry.id}
                  label={entry.name}
                  icon={<SidebarGlyph shape="square" />}
                  accessory={size(entry)}
                  className="mac-storage-management-row"
                />
              ))}
              {fixed.length > 0 ? (
                <Separator aria-hidden="true" className="mac-storage-management-rule" />
              ) : null}
              {fixed.map((entry) => (
                <SidebarItem
                  key={entry.id}
                  value={entry.id}
                  label={entry.name}
                  icon={<SidebarGlyph shape="square" />}
                  accessory={size(entry)}
                  disabled
                  title={entry.description}
                  className="mac-storage-management-row"
                />
              ))}
            </Sidebar>
          </SplitViewPane>
          <SplitViewDivider disabled />
          <SplitViewPane className="mac-storage-management-content">
            {category ? (
              <Category
                key={category.id}
                category={category}
                sort={sort}
                onSortChange={(next) => {
                  setOwnSort(next);
                  onSortChange?.(next);
                }}
                selectedFiles={selectedFiles.get(category.id) ?? []}
                onSelectedFilesChange={(ids) =>
                  setSelectedFiles((all) => new Map(all).set(category.id, ids))
                }
                onReveal={onReveal ? (file) => onReveal(file, category.id) : undefined}
                revealable={revealable}
                onQuickLook={onQuickLook}
                onDelete={deleteFiles}
              />
            ) : (
              <ScrollView className="mac-storage-management-scroll">
                <ul className="mac-storage-management-recommendations" aria-label="Recommendations">
                  {recommendations.map((recommendation) => {
                    const reviews = recommendation.reviews !== undefined;
                    return (
                      <Recommendation
                        key={recommendation.id}
                        recommendation={recommendation}
                        completed={completed.includes(recommendation.id)}
                        disabled={reviews && reviewed(recommendation) === undefined}
                        onAction={() => {
                          if (reviews) select(reviewed(recommendation));
                          else if (!recommendation.stays)
                            setCompleted((all) => [...all, recommendation.id]);
                          onRecommendation?.(recommendation.id);
                        }}
                      />
                    );
                  })}
                </ul>
              </ScrollView>
            )}
          </SplitViewPane>
        </SplitView>
      </WindowBody>
    </Window>
  );
}
