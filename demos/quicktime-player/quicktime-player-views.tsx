"use client";

import { ColumnView, type ColumnViewItem, ColumnViewPanel } from "macalicious/column-view";
import { GalleryView } from "macalicious/gallery-view";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { formatSize } from "../finder/finder-data";
import { modifiedText } from "./quicktime-player-facts";

/** One row of the Open window: a movie, or a folder to go into. */
export interface OpenRow {
  id: string;
  name: string;
  size?: number;
  modified?: number;
  folder?: boolean;
}

/** The largest movie a preview reads whole, in bytes; a larger one shows its icon. */
const MOST_PREVIEWED = 256 * 1024 * 1024;

interface MoviePictureProps {
  row: OpenRow;
  /** Reads the file for its picture; without it, or for a folder, the icon shows. */
  preview?: (id: string) => Promise<Blob>;
  icon: ReactNode;
}

/** The movie's first picture, from its own bytes; its icon for sound alone or what cannot be read. */
function MoviePicture({ row, preview, icon }: MoviePictureProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [noPicture, setNoPicture] = useState(false);
  useEffect(() => {
    setUrl(null);
    setNoPicture(false);
    if (!preview || row.folder || (row.size ?? 0) > MOST_PREVIEWED) return;
    let live = true;
    let made: string | null = null;
    preview(row.id).then(
      (blob) => {
        if (!live) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      },
      () => setNoPicture(true),
    );
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [row.id, row.folder, row.size, preview]);
  if (!url || noPicture) return <span className="mac-quicktime-player-preview-icon">{icon}</span>;
  return (
    <video
      className="mac-quicktime-player-preview-video"
      aria-label={`Preview of ${row.name}`}
      src={`${url}#t=0.1`}
      muted
      preload="metadata"
      onLoadedMetadata={(event) => setNoPicture(event.currentTarget.videoWidth === 0)}
      onError={() => setNoPicture(true)}
    />
  );
}

/** A file's picture and what the drive says of it: Column view's preview, Gallery view's stage. */
function MoviePreview(props: MoviePictureProps) {
  const { row } = props;
  return (
    <div className="mac-quicktime-player-preview">
      <MoviePicture {...props} />
      <strong>{row.name}</strong>
      <dl>
        <dt>Size</dt>
        <dd>{row.folder ? "--" : formatSize(row.size)}</dd>
        <dt>Modified</dt>
        <dd>{modifiedText(row.modified)}</dd>
      </dl>
    </div>
  );
}

const itemOf = (row: OpenRow, icon: (row: OpenRow) => ReactNode): ColumnViewItem => ({
  id: row.id,
  label: row.name,
  icon: icon(row),
  hasChildren: row.folder === true,
});

export interface MovieColumnsProps {
  label: string;
  rows: readonly OpenRow[];
  /** What a folder holds, as the window lists it. */
  contents?: (folder: string) => Promise<OpenRow[]>;
  preview?: (id: string) => Promise<Blob>;
  iconOf: (row: OpenRow) => ReactNode;
  /** Called with the movie selected, or `null` for none: it may be in a folder further along. */
  onChoose: (row: OpenRow | null) => void;
  onOpen: (row: OpenRow) => void;
}

/** The Open window as Columns: a column for each folder gone into, and the movie's preview. */
export function MovieColumns({
  label,
  rows,
  contents,
  preview,
  iconOf,
  onChoose,
  onOpen,
}: MovieColumnsProps) {
  const [path, setPath] = useState<(string | number)[]>([]);
  const [held, setHeld] = useState<Readonly<Record<string, readonly OpenRow[]>>>({});
  // The same array for the same folder every time, so that a column only renders when it changes.
  const first = useMemo(() => rows.map((row) => itemOf(row, iconOf)), [rows, iconOf]);
  const inside = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(held).map(([id, each]) => [id, each.map((row) => itemOf(row, iconOf))]),
      ),
    [held, iconOf],
  );
  const find = (id: string | number | undefined) =>
    [...rows, ...Object.values(held).flat()].find((row) => row.id === id);
  return (
    <ColumnView
      aria-label={label}
      className="mac-quicktime-player-open-columns"
      getChildren={useCallback(
        (parent: string | number | null) => (parent === null ? first : inside[String(parent)]),
        [first, inside],
      )}
      path={path}
      onPathChange={(next) => {
        setPath(next);
        const row = find(next[next.length - 1]);
        onChoose(row && !row.folder ? row : null);
        if (row?.folder && !held[row.id]) {
          void contents?.(row.id).then(
            (list) => setHeld((now) => ({ ...now, [row.id]: list })),
            () => setHeld((now) => ({ ...now, [row.id]: [] })),
          );
        }
      }}
      renderPreview={(item) => {
        const row = find(item.id);
        return row ? (
          <ColumnViewPanel>
            <MoviePreview row={row} preview={preview} icon={iconOf(row)} />
          </ColumnViewPanel>
        ) : null;
      }}
      onItemAction={(item) => {
        const row = find(item.id);
        if (row && !row.folder) onOpen(row);
      }}
    />
  );
}

export interface MovieGalleryProps {
  label: string;
  rows: readonly OpenRow[];
  preview?: (id: string) => Promise<Blob>;
  iconOf: (row: OpenRow) => ReactNode;
  value: (string | number)[];
  onValueChange: (value: (string | number)[]) => void;
  onItemAction: (index: number) => void;
}

/** The Open window as Gallery: the selected movie's picture over a strip of them all. */
export function MovieGallery({
  label,
  rows,
  preview,
  iconOf,
  value,
  onValueChange,
  onItemAction,
}: MovieGalleryProps) {
  return (
    <GalleryView
      aria-label={label}
      className="mac-quicktime-player-open-gallery"
      count={rows.length}
      getItemId={(index) => rows[index]?.id ?? index}
      getItemLabel={(index) => rows[index]?.name ?? ""}
      renderThumbnail={(index) => {
        const row = rows[index];
        return row ? iconOf(row) : null;
      }}
      renderPreview={(index) => {
        const row = rows[index];
        return row ? <MoviePreview row={row} preview={preview} icon={iconOf(row)} /> : null;
      }}
      value={value}
      onValueChange={onValueChange}
      onItemAction={onItemAction}
    />
  );
}
