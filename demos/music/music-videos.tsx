"use client";

import { EmptyState } from "macalicious/empty-state";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { useEffect, useState } from "react";
import { type Drive, type DriveEntry, readFile, useDrive } from "../desktop/desktop-files";
import { inMusicFolder } from "./music-organize";

const VIDEO_NAME = /\.(mp4|m4v|mov|webm|ogv)$/i;

const COLUMNS: TableViewColumn[] = [
  { id: "name", title: "Name" },
  { id: "size", title: "Size", width: 90, align: "right" },
];

/** The video files in the Music folder of the drive, by name, the Trash left out. */
export function musicVideos(drive: Drive): DriveEntry[] {
  return drive.entries
    .filter(
      (entry) =>
        entry.kind === "file" &&
        (entry.type?.startsWith("video/") || VIDEO_NAME.test(entry.name)) &&
        inMusicFolder(drive, entry),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

const megabytes = (bytes: number | undefined) => `${((bytes ?? 0) / 1_000_000).toFixed(1)} MB`;

/**
 * Sidebar, Music Videos: the video files in the Music folder of the drive, played in the pane. The
 * sound of a song stops first, as the two would play over each other.
 */
export function MusicVideos({ onStart }: { onStart: () => void }) {
  const drive = useDrive();
  const videos = drive ? musicVideos(drive) : [];
  const [playing, setPlaying] = useState<{ name: string; url: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!playing) return undefined;
    return () => URL.revokeObjectURL(playing.url);
  }, [playing]);
  const play = async (entry: DriveEntry) => {
    setProblem(null);
    onStart();
    try {
      const blob = await readFile(entry.id);
      setPlaying({ name: entry.name, url: URL.createObjectURL(blob) });
    } catch (error) {
      setProblem(
        `“${entry.name}” could not be read: ${error instanceof Error ? error.message : error}`,
      );
    }
  };
  if (videos.length === 0) {
    return (
      <EmptyState className="mac-music-main">
        <div className="mac-music-desktop-empty">
          <div>No Music Videos</div>
          <div className="mac-music-desktop-facts">
            Videos in the Music folder of your drive are listed here.
          </div>
        </div>
      </EmptyState>
    );
  }
  return (
    <div className="mac-music-main mac-music-desktop-list">
      {playing ? (
        // biome-ignore lint/a11y/useMediaCaption: a person's own video file comes with no captions.
        <video
          className="mac-music-video"
          aria-label={playing.name}
          src={playing.url}
          controls
          autoPlay
          onPlay={onStart}
        />
      ) : null}
      {problem ? <p role="alert">{problem}</p> : null}
      <TableView
        aria-label="Music Videos"
        columns={COLUMNS}
        rowCount={videos.length}
        rowHeight={24}
        alternatingRows
        getRowId={(row) => videos[row]?.id ?? row}
        getRowLabel={(row) => videos[row]?.name ?? ""}
        renderCell={(row, column) => {
          const entry = videos[row];
          if (!entry) return null;
          return column.id === "name" ? entry.name : megabytes(entry.size);
        }}
        onRowAction={(row) => {
          const entry = videos[row];
          if (entry) void play(entry);
        }}
        style={{ flex: 1, minHeight: 0 }}
      />
    </div>
  );
}
