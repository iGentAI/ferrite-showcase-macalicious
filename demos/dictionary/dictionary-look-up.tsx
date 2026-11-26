"use client";

import { Popover, PopoverPopup, PopoverTitle } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DictionaryEntry } from "./dictionary-data";

/** The rest of a Look Up that shows over the selection: what the page gives it. */
export interface LookUpPopoverOptions {
  word: string;
  /** Where the selection is on the page. */
  over: DOMRect;
  /** Answers the word's entry, as the window would show it. */
  read: (word: string) => Promise<DictionaryEntry | undefined>;
  /** Open in Dictionary. */
  open: (word: string) => void;
}

/** How many senses the popover shows before Open in Dictionary. */
const SENSES = 3;

function LookUpPopover({
  word,
  over,
  read,
  open,
  close,
}: LookUpPopoverOptions & { close: () => void }) {
  const [entry, setEntry] = useState<DictionaryEntry | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    read(word)
      .then((found) => {
        if (live) setEntry(found ?? null);
      })
      .catch(() => {
        if (live) setEntry(null);
      });
    return () => {
      live = false;
    };
  }, [word, read]);
  const article = entry?.dictionary;
  return (
    <Popover open onOpenChange={(next) => next || close()}>
      <PopoverPopup
        anchor={{ getBoundingClientRect: () => over }}
        side="bottom"
        className="mac-dictionary-look-up"
        aria-label={`Look Up ${word}`}
      >
        <PopoverTitle className="mac-dictionary-look-up-word">{word}</PopoverTitle>
        {entry === undefined ? (
          <p role="status">Looking up…</p>
        ) : entry === null ? (
          <p role="status">The dictionary could not be reached. Try again in a moment.</p>
        ) : article ? (
          <>
            <p className="mac-dictionary-look-up-part">
              {article.pronunciation ? `${article.pronunciation} ` : ""}
              <i>{article.part}</i>
            </p>
            <ol className="mac-dictionary-look-up-senses">
              {article.senses.slice(0, SENSES).map((sense) => (
                <li key={sense.text}>{sense.text}</li>
              ))}
            </ol>
          </>
        ) : entry.wikipedia ? (
          <p>{entry.wikipedia}</p>
        ) : (
          <p role="status">{entry.status ?? "No entries found"}</p>
        )}
        <PushButton
          size="small"
          onClick={() => {
            close();
            open(word);
          }}
        >
          Open in Dictionary
        </PushButton>
      </PopoverPopup>
    </Popover>
  );
}

let shown: { root: Root; holder: HTMLElement } | null = null;

const closeLookUp = () => {
  shown?.root.unmount();
  shown?.holder.remove();
  shown = null;
};

/** Shows the word's definition over the selection, in place of the one shown before. */
export function showLookUpPopover(options: LookUpPopoverOptions): void {
  closeLookUp();
  const holder = document.createElement("div");
  document.body.append(holder);
  const root = createRoot(holder);
  shown = { root, holder };
  root.render(<LookUpPopover {...options} close={closeLookUp} />);
}

/** Where the text selected in `doc` is: the selection's own box, or the field that holds it. */
export function selectionBox(doc: Document): DOMRect {
  const active = doc.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    return active.getBoundingClientRect();
  }
  const selection = doc.getSelection();
  const box = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
  return box && box.width + box.height > 0
    ? box
    : new DOMRect(doc.documentElement.clientWidth / 2, 200, 0, 0);
}
