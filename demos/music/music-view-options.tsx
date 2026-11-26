"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import type { TableViewSort } from "macalicious/table-view";
import { OPTIONAL_COLUMNS, SORTABLE_COLUMNS } from "./music-library-views";

/** View Options (Command-J): the columns of a song list, and what it is sorted by. */
export function MusicViewOptions({
  anchor,
  columns,
  sort,
  onColumns,
  onSort,
  onClose,
}: {
  anchor: Element | null;
  columns: readonly string[];
  sort: TableViewSort;
  onColumns: (columns: readonly string[]) => void;
  onSort: (sort: TableViewSort) => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetPopup anchor={anchor} width={320} aria-label="View Options">
        <SheetTitle>View Options</SheetTitle>
        <div className="mac-music-view-options">
          <div className="mac-music-smart-row">
            <span>Sort By</span>
            <PopUpButton<string>
              aria-label="Sort By"
              value={sort.column}
              onValueChange={(column) => {
                if (column) onSort({ ...sort, column });
              }}
            >
              {SORTABLE_COLUMNS.map(({ id, title }) => (
                <PopUpButtonItem key={id} value={id}>
                  {title}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
            <PopUpButton<TableViewSort["direction"]>
              aria-label="Sort Order"
              value={sort.direction}
              onValueChange={(direction) => {
                if (direction) onSort({ ...sort, direction });
              }}
            >
              <PopUpButtonItem value="ascending">Ascending</PopUpButtonItem>
              <PopUpButtonItem value="descending">Descending</PopUpButtonItem>
            </PopUpButton>
          </div>
          <span>Show Columns</span>
          {OPTIONAL_COLUMNS.map(({ id, title }) => (
            <Checkbox
              key={id}
              checked={columns.includes(id)}
              onCheckedChange={(shown) =>
                onColumns(shown ? [...columns, id] : columns.filter((column) => column !== id))
              }
            >
              {title}
            </Checkbox>
          ))}
        </div>
        <SheetActions>
          <SheetClose render={<DefaultButton />}>Done</SheetClose>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
