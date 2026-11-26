"use client";

import { DefaultButton } from "macalicious/default-button";
import { Dialog, DialogActions, DialogPopup, type DialogPopupProps } from "macalicious/dialog";
import { Label } from "macalicious/label";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { ToolbarSpace } from "macalicious/toolbar";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";
import { type DragEvent, Fragment, type ReactNode, useId } from "react";
import "./finder-toolbar-customize.css";

/**
 * Finder's toolbar as the person arranges it: what it holds and in what order, kept per account, and
 * the sheet that changes it. The glyphs of the items Finder does not show at first are original
 * drawings, since no reference screenshot shows them.
 */

export const TOOLBAR_LABELS = {
  back: "Back/Forward",
  path: "Path",
  views: "View",
  group: "Group",
  action: "Action",
  eject: "Eject",
  burn: "Burn",
  space: "Space",
  flexible: "Flexible Space",
  "new-folder": "New Folder",
  delete: "Delete",
  connect: "Connect",
  "get-info": "Get Info",
  "quick-look": "Quick Look",
  share: "Share",
  tags: "Edit Tags",
  search: "Search",
} as const;

export type ToolbarItemId = keyof typeof TOOLBAR_LABELS;

/** A drag's data type for an item of the toolbar: the item's name from the palette, or its place. */
const TOOLBAR_DRAG = "application/x-macalicious-toolbar-item";

const ALL_ITEMS = Object.keys(TOOLBAR_LABELS) as ToolbarItemId[];

/** As the screenshots show it. */
export const DEFAULT_TOOLBAR: readonly ToolbarItemId[] = [
  "back",
  "views",
  "group",
  "action",
  "share",
  "tags",
  "flexible",
  "search",
];

export type ToolbarMode = "icon-only" | "icon-and-label" | "label-only";

const MODES: readonly (readonly [ToolbarMode, string])[] = [
  ["icon-only", "Icon Only"],
  ["icon-and-label", "Icon and Text"],
  ["label-only", "Text Only"],
];

const repeats = (id: ToolbarItemId) => id === "space" || id === "flexible";

/** The items in a stored value, each once but for the spaces; what is not an item is left out. */
export function readToolbarItems(stored: unknown): readonly ToolbarItemId[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  const seen = new Set<unknown>();
  return stored.filter((id): id is ToolbarItemId => {
    if (!ALL_ITEMS.includes(id) || (seen.has(id) && !repeats(id))) return false;
    seen.add(id);
    return true;
  });
}

export const readToolbarMode = (stored: unknown): ToolbarMode | undefined =>
  MODES.some(([mode]) => mode === stored) ? (stored as ToolbarMode) : undefined;

/** An item put in the toolbar: at the end, ahead of a flexible space and the search field that close it. */
export function withItem(items: readonly ToolbarItemId[], id: ToolbarItemId) {
  if (items.includes(id) && !repeats(id)) return items;
  let at = items.length;
  while (at > 0 && (items[at - 1] === "search" || items[at - 1] === "flexible")) at -= 1;
  return [...items.slice(0, at), id, ...items.slice(at)];
}

export const withoutItemAt = (items: readonly ToolbarItemId[], at: number) =>
  items.filter((_, index) => index !== at);

/** The item at `from` moved to stand at `to`. */
export function withItemMoved(items: readonly ToolbarItemId[], from: number, to: number) {
  const moved = items[from];
  if (moved === undefined || from === to) return items;
  const rest = withoutItemAt(items, from);
  return [...rest.slice(0, to), moved, ...rest.slice(to)];
}

/** What a drag let go on the place `at` leaves: an item from the palette goes in, one in the row stands there. */
export function withDropped(items: readonly ToolbarItemId[], dragged: string, at: number) {
  if (/^\d+$/.test(dragged)) return withItemMoved(items, Number(dragged), at);
  const id = ALL_ITEMS.find((item) => item === dragged);
  if (!id || (items.includes(id) && !repeats(id))) return items;
  return [...items.slice(0, at), id, ...items.slice(at)];
}

/** A drop on the toolbar itself: the item goes in the gap the pointer is nearest. */
export function toolbarDropProps(
  items: readonly ToolbarItemId[],
  onItemsChange: (items: readonly ToolbarItemId[]) => void,
) {
  return {
    onDragOver(event: DragEvent<HTMLElement>) {
      if (event.dataTransfer.types.includes(TOOLBAR_DRAG)) event.preventDefault();
    },
    onDrop(event: DragEvent<HTMLElement>) {
      const dragged = event.dataTransfer.getData(TOOLBAR_DRAG);
      if (!dragged) return;
      event.preventDefault();
      const places = [...event.currentTarget.querySelectorAll("[data-toolbar-at]")];
      const after = places.findIndex((place) => {
        const { left, width } = place.getBoundingClientRect();
        return left + width / 2 > event.clientX;
      });
      const gap = after < 0 ? items.length : after;
      const from = /^\d+$/.test(dragged) ? Number(dragged) : items.length;
      onItemsChange(withDropped(items, dragged, from < gap ? gap - 1 : gap));
    },
  };
}

const glyph = (d: string) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeLinejoin="round" />
  </svg>
);

export const TOOLBAR_GLYPHS = {
  path: glyph("M1.5 3.5h4l1.5 2h7.5v8h-13zM4 9.5h8"),
  eject: glyph("M8 3 2.5 9.5h11zM2.5 12.5h11"),
  burn: glyph("M8 14.5a5 5 0 0 0 5-5C13 6 9 5 8.5 1.5 6 3 3 6 3 9.5a5 5 0 0 0 5 5z"),
  "new-folder": glyph("M1.5 3.5h4l1.5 2h7.5v8h-13zM8 7.5v4M6 9.5h4"),
  delete: glyph("M3 4.5h10M6 4.5v-2h4v2M4 4.5l1 10h6l1-10"),
  connect: glyph("M2.5 3.5h11v4h-11zM2.5 9.5h11v4h-11zM5 5.5h.5M5 11.5h.5"),
  "get-info": glyph("M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 7v4.5M8 4.5v1"),
  "quick-look": glyph(
    "M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  ),
} as const;

/**
 * The toolbar's items in the person's order, each with its label when the mode shows one. While
 * `arranging`, as the sheet is open, each is a thing to drag and not a control to press.
 */
export function toolbarItems(
  items: readonly ToolbarItemId[],
  mode: ToolbarMode,
  nodes: Partial<Record<ToolbarItemId, ReactNode>>,
  /** What keeps the view buttons over the window's list: the sidebar's width, after Back and Forward. */
  sidebarSpace: ReactNode,
  arranging = false,
) {
  return items.map((id, at) => {
    const key = `${id}:${at}`;
    const arranged = (item: ReactNode) =>
      arranging ? (
        <span
          key={key}
          draggable
          role="img"
          aria-label={`${TOOLBAR_LABELS[id]} item`}
          className="mac-finder-toolbar-arranged"
          data-flexible={id === "flexible" ? "" : undefined}
          data-toolbar-at={at}
          // The title bar moves the window from a press on anything but a control.
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event) => event.dataTransfer.setData(TOOLBAR_DRAG, String(at))}
        >
          {item}
        </span>
      ) : (
        item
      );
    if (id === "flexible") return arranged(<ToolbarSpace key={key} />);
    if (id === "space") return arranged(<ToolbarSpace key={key} width={16} />);
    const node = nodes[id];
    return arranged(
      <Fragment key={key}>
        {mode === "icon-only" ? (
          node
        ) : (
          <ToolbarLabelledItem className="mac-finder-labelled" label={TOOLBAR_LABELS[id]}>
            {node as never}
          </ToolbarLabelledItem>
        )}
        {id === "back" ? sidebarSpace : null}
      </Fragment>,
    );
  });
}

interface FinderCustomizeToolbarProps
  extends Pick<DialogPopupProps, "container" | "style" | "finalFocus"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly ToolbarItemId[];
  onItemsChange: (items: readonly ToolbarItemId[]) => void;
  mode: ToolbarMode;
  onModeChange: (mode: ToolbarMode) => void;
}

/** The toolbar's own context menu: how its items show, and the sheet. */
export function FinderToolbarMenuRows({
  mode,
  onModeChange,
  onCustomize,
}: {
  mode: ToolbarMode;
  onModeChange: (mode: ToolbarMode) => void;
  onCustomize: () => void;
}) {
  return (
    <>
      <MenuRadioGroup value={mode} onValueChange={(next) => onModeChange(next as ToolbarMode)}>
        <MenuRadioItem value="icon-and-label">Icon and Text</MenuRadioItem>
        <MenuRadioItem value="icon-only">Icon Only</MenuRadioItem>
        <MenuRadioItem value="label-only">Text Only</MenuRadioItem>
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuItem onClick={onCustomize}>Customize Toolbar…</MenuItem>
    </>
  );
}

/** View > Customize Toolbar…: changes show in the toolbar at once, as on a Mac, and the toolbar takes drops while it is open. */
export function FinderCustomizeToolbar({
  open,
  onOpenChange,
  items,
  onItemsChange,
  mode,
  onModeChange,
  container,
  style,
  finalFocus,
}: FinderCustomizeToolbarProps) {
  const id = useId();
  const dropAt = (event: DragEvent<HTMLElement>, at: number) => {
    event.preventDefault();
    onItemsChange(withDropped(items, event.dataTransfer.getData(TOOLBAR_DRAG), at));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPopup
        title="Customize Toolbar"
        width={560}
        container={container}
        style={style}
        finalFocus={finalFocus}
      >
        <Label>Drag your favorite items into the toolbar… or click one to add it.</Label>
        <div className="mac-finder-customize-palette">
          {ALL_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              draggable
              className="mac-finder-customize-item"
              disabled={items.includes(item) && !repeats(item)}
              onDragStart={(event) => event.dataTransfer.setData(TOOLBAR_DRAG, item)}
              onClick={() => onItemsChange(withItem(items, item))}
            >
              {TOOLBAR_LABELS[item]}
            </button>
          ))}
        </div>
        <Label id={`${id}-now`} textStyle="small">
          In the toolbar: drag to reorder, or use the arrow keys; Delete takes an item out.
        </Label>
        <ul
          aria-labelledby={`${id}-now`}
          className="mac-finder-customize-now"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropAt(event, items.length)}
        >
          {items.map((item, at) => (
            <li
              // The spaces repeat: each is known by which of them it is.
              key={`${item}:${items.slice(0, at).filter((each) => each === item).length}`}
              draggable
              className="mac-finder-customize-item"
              data-toolbar-item={item}
              onDragStart={(event) => event.dataTransfer.setData(TOOLBAR_DRAG, String(at))}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.stopPropagation();
                dropAt(event, at);
              }}
            >
              <button
                type="button"
                className="mac-finder-customize-remove"
                aria-label={`Move ${TOOLBAR_LABELS[item]}`}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" && at > 0) {
                    onItemsChange(withItemMoved(items, at, at - 1));
                  } else if (event.key === "ArrowRight" && at < items.length - 1) {
                    onItemsChange(withItemMoved(items, at, at + 1));
                  } else if (event.key === "Delete" || event.key === "Backspace") {
                    onItemsChange(withoutItemAt(items, at));
                  } else return;
                  event.preventDefault();
                }}
              >
                {TOOLBAR_LABELS[item]}
              </button>
              <button
                type="button"
                className="mac-finder-customize-remove"
                aria-label={`Remove ${TOOLBAR_LABELS[item]}`}
                onClick={() => onItemsChange(withoutItemAt(items, at))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mac-finder-customize-foot">
          <Label id={`${id}-show`}>Show:</Label>
          <PopUpButton
            aria-labelledby={`${id}-show`}
            value={mode}
            onValueChange={(next) => onModeChange(next as ToolbarMode)}
          >
            {MODES.map(([value, label]) => (
              <PopUpButtonItem key={value} value={value}>
                {label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
          <PushButton onClick={() => onItemsChange(DEFAULT_TOOLBAR)}>Use Default Set</PushButton>
        </div>
        <DialogActions>
          <DefaultButton onClick={() => onOpenChange(false)}>Done</DefaultButton>
        </DialogActions>
      </DialogPopup>
    </Dialog>
  );
}
