"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { WebView } from "macalicious/web-view";
import { type DragEvent, type KeyboardEvent, type MouseEvent, useRef, useState } from "react";
import { copyText } from "../desktop/desktop-share-link";
import { freeFolderName, SafariRenameSheet } from "./safari-bookmarks";
import {
  linksAt,
  movedRows,
  type SafariLibrary,
  type SafariRow,
  withFolderRenamed,
  withLinksAt,
  withoutFolder,
  withoutRows,
} from "./safari-bookmarks-model";
import { hostOf } from "./safari-web";

/** The type a row of this page is dragged with, so that nothing else drops here. */
const ROWS_TYPE = "application/x-macalicious-safari-bookmarks";

const idOf = (row: SafariRow) => `${row.place}\n${row.index}`;
const rowOf = (id: string): SafariRow => {
  const cut = id.lastIndexOf("\n");
  return { place: id.slice(0, cut), index: Number(id.slice(cut + 1)) };
};
const titleOfPlace = (place: string) =>
  place === "favorites" ? "Favorites" : place === "bookmarks" ? "Bookmarks" : place.slice(7);

/** Bookmarks > Edit Bookmarks: every list and folder on one page, to tidy. */
export function SafariBookmarksPage({
  library,
  anchor,
  onChange,
  onOpen,
  onOpenInNewTab,
}: {
  library: SafariLibrary;
  anchor: Element | null;
  onChange: (next: SafariLibrary) => void;
  onOpen: (url: string) => void;
  onOpenInNewTab: (url: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [menuRow, setMenuRow] = useState<string | null>(null);
  const [menuFolder, setMenuFolder] = useState<string | null>(null);
  const [renamingRow, setRenamingRow] = useState<SafariRow | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const anchorRow = useRef<string | null>(null);
  const dragged = useRef<readonly string[]>([]);

  const places = [
    "favorites",
    "bookmarks",
    ...library.folders.map((folder) => `folder:${folder.title}`),
  ];
  const needle = query.trim().toLowerCase();
  const shownRows = (place: string) =>
    linksAt(library, place).flatMap((link, index) =>
      !needle || `${link.title} ${link.url}`.toLowerCase().includes(needle)
        ? [{ link, row: { place, index } }]
        : [],
    );
  const order = places.flatMap((place) => shownRows(place).map(({ row }) => idOf(row)));
  const change = (next: SafariLibrary) => {
    setSelected([]);
    onChange(next);
  };
  const targets = (id: string) => (selected.includes(id) ? selected : [id]);
  const press = (event: MouseEvent, id: string) => {
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) {
      anchorRow.current = id;
      setSelected((now) => (now.includes(id) ? now.filter((one) => one !== id) : [...now, id]));
    } else if (event.shiftKey) {
      const from = order.indexOf(anchorRow.current ?? id);
      const to = order.indexOf(id);
      setSelected(order.slice(Math.min(from, to), Math.max(from, to) + 1));
    } else {
      anchorRow.current = id;
      setSelected([id]);
    }
  };
  const linkOf = (id: string) => {
    const row = rowOf(id);
    return linksAt(library, row.place)[row.index];
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.target as Element).closest("input")) return;
    if ((event.key === "Backspace" || event.key === "Delete") && selected.length > 0) {
      event.preventDefault();
      change(withoutRows(library, selected.map(rowOf)));
    }
    if (event.key === "Enter" && selected.length === 1) {
      const link = linkOf(selected[0] as string);
      if (link) onOpen(link.url);
    }
  };
  const onDragStart = (event: DragEvent, id: string) => {
    dragged.current = targets(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/uri-list", linkOf(id)?.url ?? "");
    event.dataTransfer.setData(ROWS_TYPE, "");
  };
  const onDrop = (event: DragEvent, place: string) => {
    if (!event.dataTransfer.types.includes(ROWS_TYPE)) return;
    event.preventDefault();
    if (dragged.current.length > 0) change(movedRows(library, dragged.current.map(rowOf), place));
    dragged.current = [];
  };
  const folderSize = deletingFolder ? linksAt(library, `folder:${deletingFolder}`).length : 0;

  return (
    <WebView title="Bookmarks" className="mac-safari-view mac-safari-history">
      <div className="mac-safari-history-bar">
        <h1 className="mac-safari-history-title-bar">Bookmarks</h1>
        <SearchField
          placeholder="Search Bookmarks"
          aria-label="Search Bookmarks"
          className="mac-safari-history-search"
          value={query}
          onValueChange={(value) => setQuery(String(value))}
        />
      </div>
      <ContextualMenu>
        <ContextualMenuTrigger
          className="mac-safari-history-body"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onContextMenu={(event) => {
            const target = event.target as Element;
            setMenuRow(
              target.closest<HTMLElement>("[data-bookmark-row]")?.dataset.bookmarkRow ?? null,
            );
            setMenuFolder(
              target.closest<HTMLElement>("[data-bookmark-folder]")?.dataset.bookmarkFolder ?? null,
            );
          }}
        >
          {order.length === 0 && needle ? (
            <p className="mac-safari-history-note">No Results</p>
          ) : null}
          {places.map((place) => {
            const rows = shownRows(place);
            if (needle && rows.length === 0) return null;
            const title = titleOfPlace(place);
            return (
              <section
                key={place}
                className="mac-safari-history-day"
                aria-label={title}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes(ROWS_TYPE)) event.preventDefault();
                }}
                onDrop={(event) => onDrop(event, place)}
              >
                <h2
                  className="mac-safari-history-heading"
                  data-bookmark-folder={place.startsWith("folder:") ? title : undefined}
                >
                  {title}
                </h2>
                {rows.length === 0 ? <p className="mac-safari-history-note">No Bookmarks</p> : null}
                <ul className="mac-safari-history-list">
                  {rows.map(({ link, row }) => {
                    const id = idOf(row);
                    return (
                      <li key={id}>
                        <a
                          href={link.url}
                          draggable
                          className="mac-safari-history-row"
                          data-bookmark-row={id}
                          aria-current={selected.includes(id) || undefined}
                          data-selected={selected.includes(id) ? "" : undefined}
                          onClick={(event) => press(event, id)}
                          onDoubleClick={() => onOpen(link.url)}
                          onDragStart={(event) => onDragStart(event, id)}
                          onDragEnd={() => {
                            dragged.current = [];
                          }}
                        >
                          <span className="mac-safari-history-title">{link.title || link.url}</span>
                          <span className="mac-safari-history-url">{hostOf(link.url)}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </ContextualMenuTrigger>
        <ContextualMenuPopup aria-label="Bookmarks">
          {menuRow ? (
            <>
              <MenuItem
                onClick={() => {
                  const link = linkOf(menuRow);
                  if (link) onOpen(link.url);
                }}
              >
                Open
              </MenuItem>
              <MenuItem
                onClick={() => {
                  for (const id of targets(menuRow)) {
                    const link = linkOf(id);
                    if (link) onOpenInNewTab(link.url);
                  }
                }}
              >
                {targets(menuRow).length > 1
                  ? `Open ${targets(menuRow).length} Pages in New Tabs`
                  : "Open in New Tab"}
              </MenuItem>
              <MenuSeparator />
              <MenuItem onClick={() => void copyText(linkOf(menuRow)?.url ?? "")}>
                Copy Link
              </MenuItem>
              <MenuItem
                disabled={targets(menuRow).length > 1}
                onClick={() => setRenamingRow(rowOf(menuRow))}
              >
                Rename…
              </MenuItem>
              <Submenu>
                <SubmenuTrigger>Move To</SubmenuTrigger>
                <SubmenuPopup>
                  {places.map((place) => (
                    <MenuItem
                      key={place}
                      disabled={targets(menuRow).every((id) => rowOf(id).place === place)}
                      onClick={() => change(movedRows(library, targets(menuRow).map(rowOf), place))}
                    >
                      {titleOfPlace(place)}
                    </MenuItem>
                  ))}
                </SubmenuPopup>
              </Submenu>
              <MenuSeparator />
              <MenuItem onClick={() => change(withoutRows(library, targets(menuRow).map(rowOf)))}>
                {targets(menuRow).length > 1
                  ? `Delete ${targets(menuRow).length} Bookmarks`
                  : "Delete"}
              </MenuItem>
            </>
          ) : menuFolder ? (
            <>
              <MenuItem
                disabled={linksAt(library, `folder:${menuFolder}`).length === 0}
                onClick={() => {
                  for (const link of linksAt(library, `folder:${menuFolder}`)) {
                    onOpenInNewTab(link.url);
                  }
                }}
              >
                Open in New Tabs
              </MenuItem>
              <MenuSeparator />
              <MenuItem onClick={() => setRenamingFolder(menuFolder)}>Rename…</MenuItem>
              <MenuItem onClick={() => setDeletingFolder(menuFolder)}>Delete Folder…</MenuItem>
            </>
          ) : (
            <MenuItem disabled>No Bookmark Selected</MenuItem>
          )}
        </ContextualMenuPopup>
      </ContextualMenu>
      {renamingRow ? (
        <SafariRenameSheet
          anchor={anchor}
          name={linksAt(library, renamingRow.place)[renamingRow.index]?.title ?? ""}
          onCancel={() => setRenamingRow(null)}
          onRename={(title) => {
            const next = linksAt(library, renamingRow.place).map((link, index) =>
              index === renamingRow.index ? { ...link, title } : link,
            );
            change(withLinksAt(library, renamingRow.place, next));
            setRenamingRow(null);
          }}
        />
      ) : null}
      {renamingFolder !== null ? (
        <SafariRenameSheet
          anchor={anchor}
          name={renamingFolder}
          heading="Rename Bookmark Folder"
          label="Folder name"
          onCancel={() => setRenamingFolder(null)}
          onRename={(title) => {
            const others = library.folders
              .map((folder) => folder.title)
              .filter((one) => one !== renamingFolder);
            change(withFolderRenamed(library, renamingFolder, freeFolderName(title, others)));
            setRenamingFolder(null);
          }}
        />
      ) : null}
      {deletingFolder !== null ? (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setDeletingFolder(null);
          }}
        >
          <SheetPopup anchor={anchor} width={420}>
            <SheetTitle>
              {folderSize > 0
                ? `Delete “${deletingFolder}” and the ${folderSize === 1 ? "bookmark" : `${folderSize} bookmarks`} in it?`
                : `Delete “${deletingFolder}”?`}
            </SheetTitle>
            <SheetActions>
              <SheetClose render={<PushButton />}>Cancel</SheetClose>
              <DefaultButton
                onClick={() => {
                  change(withoutFolder(library, deletingFolder));
                  setDeletingFolder(null);
                }}
              >
                Delete
              </DefaultButton>
            </SheetActions>
          </SheetPopup>
        </Sheet>
      ) : null}
    </WebView>
  );
}
