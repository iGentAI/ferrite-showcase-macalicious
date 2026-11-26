"use client";

import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetDescription, SheetPopup, SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useState } from "react";

/** What a close would end: the tab or the window, and the commands running in it, if any. */
export interface PendingClose {
  what: "tab" | "window";
  running: readonly string[];
  close: () => void;
}

/** Asks before a close ends what runs, as the profile's Ask before closing says. */
export function TerminateSheet({
  pending,
  anchor,
  onDone,
}: {
  pending: PendingClose | null;
  anchor: HTMLElement | null;
  onDone: () => void;
}) {
  const what = pending?.what ?? "window";
  return (
    <Sheet open={pending !== null} onOpenChange={(next) => next || onDone()}>
      <SheetPopup anchor={anchor ?? undefined} width={420} aria-label="Close">
        <SheetTitle>
          {pending?.running.length
            ? `Do you want to terminate running processes in this ${what}?`
            : `Do you want to close this ${what}?`}
        </SheetTitle>
        {pending?.running.length ? (
          <SheetDescription>
            {`Closing this ${what} will terminate the running processes: ${pending.running.join(", ")}.`}
          </SheetDescription>
        ) : null}
        <SheetActions>
          <PushButton onClick={onDone}>Cancel</PushButton>
          <DefaultButton
            onClick={() => {
              pending?.close();
              onDone();
            }}
          >
            {pending?.running.length ? "Terminate" : "Close"}
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** Help > Search man Page Index: asks for a word, whose list opens in a window of its own. */
export function SearchManSheet({
  open,
  anchor,
  onSearch,
  onClose,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  onSearch: (word: string) => void;
  onClose: () => void;
}) {
  const [word, setWord] = useState("");
  return (
    <Sheet open={open} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor ?? undefined} width={360} aria-label="Search man Page Index">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!word.trim()) return;
            onSearch(word.trim());
            onClose();
          }}
        >
          <SheetTitle>Search man Page Index</SheetTitle>
          <div className="mac-terminal-sheet-rows">
            <TextField
              aria-label="Word to search for"
              autoFocus
              value={word}
              onChange={(event) => setWord(event.currentTarget.value)}
            />
          </div>
          <SheetActions>
            <PushButton onClick={onClose}>Cancel</PushButton>
            <DefaultButton type="submit" disabled={!word.trim()}>
              Search
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
