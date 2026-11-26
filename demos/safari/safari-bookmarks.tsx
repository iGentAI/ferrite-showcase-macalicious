"use client";

import { DefaultButton } from "macalicious/default-button";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useState } from "react";

/** The longest name a bookmark takes here: the stored document's limit. */
const NAME_LENGTH = 200;

/** Which of Safari's lists a link is in. */
export type SafariLinkList = "favorites" | "bookmarks" | "reading-list";

/** A link a menu was opened on. */
export interface SafariLinkTarget {
  list: SafariLinkList;
  url: string;
  /** Its name as shown: two links may share an address. */
  title: string;
  /** The bookmark folder it is in. */
  folder?: string;
}

/** Where the Add Bookmark sheet puts a page: a list, or the name of a folder. */
export type SafariBookmarkPlace =
  | { kind: "favorites" }
  | { kind: "bookmarks" }
  | { kind: "folder"; title: string };

/** `name`, or `name 2` and so on when a folder already has it, cut to fit the stored limit. */
export function freeFolderName(name: string, taken: readonly string[]): string {
  if (!taken.includes(name)) return name;
  for (let count = 2; ; count += 1) {
    const end = ` ${count}`;
    const free = `${name.slice(0, NAME_LENGTH - end.length).trimEnd()}${end}`;
    if (!taken.includes(free)) return free;
  }
}

/** `list` with the first link at `from` moved to stand before the one at `to`. */
export function movedLink<T>(list: readonly T[], from: number, to: number): T[] {
  const moved = list[from];
  if (moved === undefined || from === to) return [...list];
  const rest = list.filter((_, index) => index !== from);
  rest.splice(from < to ? to - 1 : to, 0, moved);
  return rest;
}

/** The sheet that names a bookmark again, or a new folder. */
export function SafariRenameSheet({
  anchor,
  name,
  heading = "Rename Bookmark",
  label = "Bookmark name",
  action = "Rename",
  onRename,
  onCancel,
}: {
  anchor: Element | null;
  name: string;
  heading?: string;
  label?: string;
  action?: string;
  onRename: (name: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(name);
  const title = text.trim();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={360}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (title) onRename(title);
          }}
        >
          <SheetTitle>{heading}</SheetTitle>
          <TextField
            aria-label={label}
            autoFocus
            maxLength={NAME_LENGTH}
            value={text}
            onChange={(event) => setText(event.target.value)}
            style={{ width: "100%", marginBlock: 12 }}
          />
          <SheetActions>
            <SheetClose render={<PushButton />}>Cancel</SheetClose>
            <DefaultButton type="submit" disabled={!title}>
              {action}
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}

/** Add Bookmark: where the page goes and what it is called. */
export function SafariAddBookmarkSheet({
  anchor,
  name,
  folders,
  onAdd,
  onCancel,
}: {
  anchor: Element | null;
  name: string;
  folders: readonly string[];
  onAdd: (place: SafariBookmarkPlace, name: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(name);
  const [place, setPlace] = useState("favorites");
  const title = text.trim();
  const chosen = (): SafariBookmarkPlace =>
    place === "favorites" || place === "bookmarks"
      ? { kind: place }
      : { kind: "folder", title: place.slice("folder:".length) };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={420}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (title) onAdd(chosen(), title);
          }}
        >
          <SheetTitle>Add this page to:</SheetTitle>
          <div className="mac-safari-add-bookmark">
            <PopUpButton<string>
              aria-label="Add this page to"
              value={place}
              onValueChange={(next) => {
                if (next) setPlace(next);
              }}
            >
              <PopUpButtonItem value="favorites">Favorites</PopUpButtonItem>
              <PopUpButtonItem value="bookmarks">Bookmarks</PopUpButtonItem>
              {folders.map((folder) => (
                <PopUpButtonItem key={folder} value={`folder:${folder}`}>
                  {folder}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
            <TextField
              aria-label="Bookmark name"
              autoFocus
              maxLength={NAME_LENGTH}
              value={text}
              onChange={(event) => setText(event.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <SheetActions>
            <SheetClose render={<PushButton />}>Cancel</SheetClose>
            <DefaultButton type="submit" disabled={!title}>
              Add
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
