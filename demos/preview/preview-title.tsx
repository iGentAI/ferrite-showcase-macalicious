"use client";

import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Popover, PopoverPopup, PopoverTrigger } from "macalicious/popover";
import { TextField } from "macalicious/text-field";
import { useEffect, useState } from "react";
import type { DriveEntry } from "../desktop/desktop-files";
import type { PreviewFolder } from "./preview-drive";

/**
 * The chevron a document's title shows under the pointer, and the title's pop-over: its name, which
 * Return or leaving the field changes, and the folder it is in.
 */
export function TitleMenu({
  entry,
  list,
  onRename,
  onMove,
}: {
  entry: DriveEntry;
  list: () => Promise<PreviewFolder[]>;
  onRename: (name: string) => void;
  onMove: (folder: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(entry.name);
  const [folders, setFolders] = useState<PreviewFolder[]>([]);
  useEffect(() => {
    if (!open) return;
    setName(entry.name);
    let live = true;
    list().then(
      (found) => {
        if (live) setFolders(found);
      },
      () => {
        if (live) setFolders([]);
      },
    );
    return () => {
      live = false;
    };
  }, [open, entry.name, list]);
  const commit = () => {
    const next = name.trim();
    if (next !== "" && next !== entry.name && !next.includes("/")) onRename(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="mac-preview-app-title-chevron" aria-label="Title Menu">
        <svg aria-hidden="true" viewBox="0 0 8 5" width="8" height="5">
          <path d="M.5.5 4 4 7.5.5" fill="none" stroke="currentColor" />
        </svg>
      </PopoverTrigger>
      <PopoverPopup aria-label="Title Menu" className="mac-preview-app-title-popover">
        <Label>Name:</Label>
        <TextField
          aria-label="Name"
          value={name}
          onValueChange={setName}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit();
            setOpen(false);
          }}
        />
        <Label>Where:</Label>
        <PopUpButton
          aria-label="Where"
          value={entry.parent ?? ""}
          onValueChange={(value) => {
            if (value && value !== entry.parent) onMove(String(value));
          }}
        >
          {folders.map((folder) => (
            <PopUpButtonItem key={folder.id} value={folder.id}>
              {folder.path}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </PopoverPopup>
    </Popover>
  );
}
