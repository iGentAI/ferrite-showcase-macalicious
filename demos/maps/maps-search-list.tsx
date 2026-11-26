"use client";

import { useEffect, useRef } from "react";
import type { ServedPlace } from "./maps-server";

/** A row under the search field: a place, and the line under its name. */
export interface SearchListRow {
  place: ServedPlace;
  detail: string;
}

/** The list's width, and its distance from the map's trailing edge, which puts it under the field. */
const LIST_WIDTH = 320;
const LIST_INSET_END = 55;
/** The most room kept around pins framed on the map. */
const FRAME_MARGIN = 48;

const listWidth = (mapWidth: number) => Math.min(LIST_WIDTH, mapWidth / 2);

/**
 * What framing results on a map of `mapWidth` by `mapHeight` asks for: the size to fit them in, and
 * how far left of the map's middle that part's own middle lies. A narrow map gives the list half of
 * itself and keeps a smaller margin, so that some of it is always left beside the list.
 */
export function frameBesideList(mapWidth: number, mapHeight: number) {
  const taken = listWidth(mapWidth) + LIST_INSET_END;
  const beside = Math.max(mapWidth - taken, 0);
  return {
    width: beside - 2 * Math.min(FRAME_MARGIN, beside / 6),
    height: mapHeight - 2 * Math.min(FRAME_MARGIN, mapHeight / 6),
    offset: taken / 2,
  };
}

export interface MapsSearchListProps {
  id: string;
  label: string;
  rows: readonly SearchListRow[];
  /** The row the arrow keys are on, or -1. */
  chosen: number;
  /** The id of the place whose card is shown. */
  shownId: string | undefined;
  /** The map's width, which the list leaves room in. */
  mapWidth: number;
  onOpen: (place: ServedPlace) => void;
}

/** The id of a row, for the field's `aria-activedescendant`. */
export const searchListRowId = (listId: string, index: number) => `${listId}-${index}`;

/** The list under the search field. The field keeps the keyboard: a press here does not take it. */
export function MapsSearchList({
  id,
  label,
  rows,
  chosen,
  shownId,
  mapWidth,
  onOpen,
}: MapsSearchListProps) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const view = list.current;
    const row = view?.children[chosen];
    if (!view || !(row instanceof HTMLElement)) return;
    if (row.offsetTop < view.scrollTop) view.scrollTop = row.offsetTop;
    const below = row.offsetTop + row.offsetHeight - view.clientHeight;
    if (below > view.scrollTop) view.scrollTop = below;
  }, [chosen]);
  return (
    <div
      ref={list}
      id={id}
      className="mac-maps-search-list"
      role="listbox"
      aria-label={label}
      style={{ width: listWidth(mapWidth), insetInlineEnd: LIST_INSET_END }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {rows.map(({ place, detail }, index) => (
        <div
          key={place.id}
          id={searchListRowId(id, index)}
          role="option"
          tabIndex={-1}
          aria-selected={index === chosen || place.id === shownId}
          data-chosen={index === chosen ? "" : undefined}
          className="mac-maps-search-row"
          onClick={() => onOpen(place)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpen(place);
          }}
        >
          <span className="mac-maps-search-row-name">{place.name}</span>
          {detail ? <span className="mac-maps-search-row-detail">{detail}</span> : null}
        </div>
      ))}
    </div>
  );
}
