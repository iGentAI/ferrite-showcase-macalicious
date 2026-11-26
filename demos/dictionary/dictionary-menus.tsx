"use client";

import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { openUrl } from "../desktop/desktop-open-url";
import { ServicesItems } from "../desktop/desktop-services";
import type { TextFind } from "../notes/notes-find";
import { whenMenusClosed } from "../notes/notes-menus";

/**
 * What may be looked up, tidied as the module tidies it: 1 to 80 letters, digits, spaces,
 * hyphens, apostrophes and full stops, single-spaced; `undefined` for anything else.
 */
export function lookUpWord(typed: string): string | undefined {
  const word = typed.split(/\s+/).filter(Boolean).join(" ");
  return word.length > 0 && [...word].length <= 80 && /^[\p{L}\p{N} '’.-]+$/u.test(word)
    ? word
    : undefined;
}

/**
 * Prints a copy of the entry from a frame of its own, which may run nothing. The frame stays a
 * minute, since the print dialog holds it, and is off screen rather than `display: none`, which
 * some browsers print as an empty page.
 */
export function printEntry(article: Element, word: string) {
  const document = article.ownerDocument;
  document.querySelector("iframe[data-dictionary-print]")?.remove();
  const page = document.implementation.createHTMLDocument(word);
  const copy = page.importNode(article, true);
  for (const button of copy.querySelectorAll("button")) button.remove();
  page.body.style.fontFamily = getComputedStyle(article).fontFamily;
  page.body.append(copy);
  const frame = document.createElement("iframe");
  frame.dataset.dictionaryPrint = word;
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0";
  frame.srcdoc = page.documentElement.outerHTML;
  frame.onload = () => frame.contentWindow?.print();
  document.body.append(frame);
  setTimeout(() => frame.remove(), 60_000);
}

/** Why a row a web page's dictionary cannot carry out is dimmed. */
export const NO_TABS =
  "Dictionary opens a new window for another search: the desktop has tabs for Finder and Safari alone.";
const NO_FOLDER =
  "The entries come from sources on the web, so there is no folder of dictionaries.";
const NO_PAGE_SETUP = "The browser's print dialog sets the page.";
const NO_CHECKING =
  "The search field takes a word to look up and an entry cannot be changed, so there is no text here to check or correct.";

function DimmedRow({
  title,
  reason,
  keyEquivalent,
}: {
  title: string;
  reason: string;
  keyEquivalent?: string;
}) {
  return (
    <MenuItem disabled title={reason} keyEquivalent={keyEquivalent}>
      {title}
    </MenuItem>
  );
}

/** Where the window's text selection is, and what it holds. */
interface WindowSelection {
  place: "field" | "entry";
  text: string;
}
const NOTHING: WindowSelection = { place: "field", text: "" };

const hasSpeech = () => typeof speechSynthesis !== "undefined";
/** Reads `text` aloud through the browser, in place of what was being read. */
function startSpeaking(text: string) {
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

/** What Start Speaking reads: `selected`, or else what the entry holds now, or else the whole entry. */
function textToSpeak(page: HTMLElement | null, selected?: string) {
  const held = document.getSelection();
  const live = held?.anchorNode && page?.contains(held.anchorNode) ? held.toString() : "";
  const article = page?.querySelector("article");
  return (selected ?? live).trim() || (article?.innerText ?? article?.textContent ?? "");
}

/**
 * Speech's two rows, in the Edit menu and in the entry's context menu. `selected` is what the entry
 * held when the menu opened: focusing a menu moves the page's selection out of the entry in WebKit.
 */
export function SpeechSubmenu({
  page,
  selected,
}: {
  page: RefObject<HTMLElement | null>;
  selected?: string;
}) {
  return (
    <Submenu>
      <SubmenuTrigger>Speech</SubmenuTrigger>
      <SubmenuPopup>
        <MenuItem
          disabled={!hasSpeech()}
          onClick={() => startSpeaking(textToSpeak(page.current, selected))}
        >
          Start Speaking
        </MenuItem>
        <MenuItem disabled={!hasSpeech()} onClick={() => speechSynthesis.cancel()}>
          Stop Speaking
        </MenuItem>
      </SubmenuPopup>
    </Submenu>
  );
}

/**
 * The whole word at a point of `within`'s text, as the click on it would mean it; `undefined` over
 * no word, or where the browser cannot say which text is at the point.
 */
export function wordAtPoint(within: Element, x: number, y: number): string | undefined {
  const { ownerDocument: page } = within;
  // Firefox has only the second; a browser with both gives the same place.
  const range = page.caretRangeFromPoint?.(x, y);
  const position = range ? null : page.caretPositionFromPoint?.(x, y);
  const node = range?.startContainer ?? position?.offsetNode;
  const offset = range?.startOffset ?? position?.offset ?? 0;
  if (!node || node.nodeType !== Node.TEXT_NODE || !within.contains(node)) return undefined;
  const text = node.textContent ?? "";
  const before = /[\p{L}\p{M}'’-]*$/u.exec(text.slice(0, offset))?.[0] ?? "";
  const after = /^[\p{L}\p{M}'’-]*/u.exec(text.slice(offset))?.[0] ?? "";
  return lookUpWord(`${before}${after}`.replace(/^['’-]+|['’-]+$/g, ""));
}

/**
 * The menu of a secondary click on the entry: Look Up and Search with Google on the selection,
 * Copy and Speech. Google's results open in a new tab of Safari.
 */
export function EntryContextItems({
  page,
  from = "dictionary",
  onLookUp,
  onCopy,
}: {
  page: RefObject<HTMLElement | null>;
  /** The application asking Safari for the search. */
  from?: string;
  onLookUp: (word: string) => void;
  onCopy: () => void;
}) {
  // The popup is made anew for each click, with the selection the click left.
  const [selected] = useState(() => {
    const held = document.getSelection();
    return held?.anchorNode && page.current?.contains(held.anchorNode)
      ? held.toString().trim()
      : "";
  });
  const wanted = lookUpWord(selected);
  return (
    <>
      <MenuItem
        disabled={wanted === undefined}
        onClick={() => {
          if (wanted) onLookUp(wanted);
        }}
      >
        {wanted ? `Look Up “${wanted}”` : "Look Up"}
      </MenuItem>
      <MenuItem
        disabled={selected === ""}
        onClick={() =>
          openUrl(`https://www.google.com/search?q=${encodeURIComponent(selected)}`, from)
        }
      >
        Search with Google
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={selected === ""} onClick={onCopy}>
        Copy
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Services</SubmenuTrigger>
        <SubmenuPopup>
          <ServicesItems from={from} none={<MenuItem disabled>No Services Apply</MenuItem>} />
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <SpeechSubmenu page={page} selected={selected} />
    </>
  );
}

const inField = (input: HTMLInputElement): WindowSelection => ({
  place: "field",
  text: input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0),
});
const keeping = (next: WindowSelection) => (now: WindowSelection) =>
  now.place === next.place && now.text === next.text ? now : next;

export interface DictionaryMenusOptions {
  /** Whether the window is the key window: only then do the keys act. */
  isKey: boolean;
  /** An element of the window: a use of the window makes these its application's menus. */
  within: Element | null;
  /** The search field. */
  field: RefObject<HTMLInputElement | null>;
  /** The entry's scrolling page. */
  page: RefObject<HTMLDivElement | null>;
  /** The headword shown; its change ends a selection in the entry. */
  word: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  canMakeBigger: boolean;
  canMakeSmaller: boolean;
  /** Steps through the window's history. */
  go: (step: number) => void;
  /** Changes the text size by a number of sizes. */
  resize: (step: number) => void;
  /** Starts a new search for a word. */
  lookUp: (word: string) => void;
  /** The find bar over the entry. */
  find: TextFind;
}

/**
 * Dictionary's rows in the desktop's menu bar and their keys: File > Print, the Edit commands on
 * the field that last had the keyboard or the entry (whichever last held the selection), Find in
 * the entry, Speech, View's text sizes, Go's history. Undo, Redo, Cut, Paste and Delete act on a
 * field only: the entry cannot change.
 */
export function useDictionaryMenus(options: DictionaryMenusOptions) {
  const {
    isKey,
    within,
    field,
    page,
    word,
    canGoBack,
    canGoForward,
    canMakeBigger,
    canMakeSmaller,
  } = options;
  const [selection, setSelection] = useState(NOTHING);
  const [pasteRefused, setPasteRefused] = useState(
    () => typeof navigator === "undefined" || typeof navigator.clipboard?.readText !== "function",
  );
  const entryRange = useRef<Range | null>(null);
  // The field the keyboard was last in: the search field, or the find bar's.
  const lastField = useRef<HTMLInputElement | null>(null);
  const currentField = () => (lastField.current?.isConnected ? lastField.current : field.current);

  const [lastWord, setLastWord] = useState(word);
  if (word !== lastWord) {
    setLastWord(word);
    setSelection(NOTHING);
  }

  useEffect(() => {
    const read = () => {
      const input = field.current;
      const entry = page.current;
      if (!input || !entry) return;
      const { activeElement } = document;
      if (
        activeElement instanceof HTMLInputElement &&
        input.closest(".mac-window")?.contains(activeElement)
      ) {
        lastField.current = activeElement;
        setSelection(keeping(inField(activeElement)));
        return;
      }
      const held = document.getSelection();
      if (held?.anchorNode && entry.contains(held.anchorNode)) {
        entryRange.current = held.rangeCount > 0 ? held.getRangeAt(0).cloneRange() : null;
        setSelection(keeping({ place: "entry", text: held.toString() }));
      } else if (input.closest(".mac-window")?.contains(activeElement)) {
        // The keyboard went elsewhere in the window, or is in the entry with nothing selected. With
        // the keyboard outside the window, a menu is open and what the window had selected stands.
        setSelection(
          keeping(entry.contains(activeElement) ? { place: "entry", text: "" } : NOTHING),
        );
      }
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [field, page]);

  const article = () => page.current?.querySelector("article") ?? null;
  /**
   * Gives the field the keyboard after a menu, and reads its selection: the browser tells of a
   * change made while the menu held the keyboard only after that, as a change outside the window.
   */
  const giveField = () => {
    const input = currentField();
    if (!input) return;
    input.focus();
    setSelection(keeping(inField(input)));
  };
  const selectEntryRange = () => {
    const held = document.getSelection();
    if (!held || !entryRange.current) return;
    held.removeAllRanges();
    held.addRange(entryRange.current);
  };
  const selectEntry = () => {
    const shown = article();
    if (!shown) return;
    const range = document.createRange();
    range.selectNodeContents(shown);
    entryRange.current = range;
    selectEntryRange();
  };
  const commands = {
    go: options.go,
    resize: options.resize,
    lookUp: options.lookUp,
    find: options.find,
    /** Shows the find bar and gives it the keyboard, which a closing menu would take back. */
    openFind: () => {
      options.find.open();
      whenMenusClosed(document, () => {
        options.find.fieldRef.current?.focus();
        options.find.fieldRef.current?.select();
      });
    },
    print: () => {
      const shown = article();
      if (shown) printEntry(shown, word ?? "Dictionary");
    },
    /** Runs a browser command on the field, and gives it the keyboard back after the menu. */
    onField: (command: "undo" | "redo" | "cut" | "copy" | "delete") => {
      const input = currentField();
      if (!input) return;
      input.focus();
      document.execCommand(command);
      whenMenusClosed(document, giveField);
    },
    copyEntry: () => {
      selectEntryRange();
      document.execCommand("copy");
      whenMenusClosed(document, selectEntryRange);
    },
    /** The clipboard is asked for in the click, as browsers require. */
    paste: () => {
      const input = currentField();
      if (!input) return;
      navigator.clipboard.readText().then(
        (text) => {
          // `whenMenusClosed` gives the keyboard back twice; the clipboard goes in once.
          let inserted = false;
          whenMenusClosed(document, () => {
            input.focus();
            if (!inserted) {
              inserted = true;
              document.execCommand("insertText", false, text);
            }
            giveField();
          });
        },
        () => setPasteRefused(true),
      );
    },
    selectAll: (place: WindowSelection["place"]) => {
      const select =
        place === "entry"
          ? selectEntry
          : () => {
              const input = currentField();
              input?.focus();
              input?.select();
              giveField();
            };
      select();
      whenMenusClosed(document, select);
    },
  };
  const run = useRef(commands);
  run.current = commands;

  useEffect(() => {
    if (!isKey) return;
    const bigger = () => run.current.resize(1);
    return onMenuKeyEquivalents(window, {
      "command+[": () => run.current.go(-1),
      "command+]": () => run.current.go(1),
      "command+p": () => run.current.print(),
      "command+=": bigger,
      "shift+command+=": bigger,
      "command+-": () => run.current.resize(-1),
      "command+f": () => run.current.find.open(),
      "command+g": () => run.current.find.move(false),
      "shift+command+g": () => run.current.find.move(true),
      "command+e": () => run.current.find.fromSelection(),
      "command+j": () => run.current.find.jump(),
    });
  }, [isKey]);
  // Command-A in the entry selects the entry; the browser would select the whole desktop.
  useEffect(() => {
    const entry = page.current;
    if (!entry) return;
    return onMenuKeyEquivalents(entry, { "command+a": () => run.current.selectAll("entry") });
  }, [page]);

  const goMenu = useMemo(
    () => (
      <>
        <MenuItem
          keyEquivalent="command+["
          disabled={!canGoBack}
          onClick={() => run.current.go(-1)}
        >
          Back
        </MenuItem>
        <MenuItem
          keyEquivalent="command+]"
          disabled={!canGoForward}
          onClick={() => run.current.go(1)}
        >
          Forward
        </MenuItem>
      </>
    ),
    [canGoBack, canGoForward],
  );
  useDesktopAppMenu("dictionary", "Go", goMenu, within);

  const viewMenu = useMemo(
    () => (
      <>
        <DimmedRow title="Show Tab Bar" reason={NO_TABS} />
        <DimmedRow title="Show All Tabs" reason={NO_TABS} />
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command++"
          disabled={!canMakeBigger}
          onClick={() => run.current.resize(1)}
        >
          Make Text Bigger
        </MenuItem>
        <MenuItem
          keyEquivalent="command+-"
          disabled={!canMakeSmaller}
          onClick={() => run.current.resize(-1)}
        >
          Make Text Smaller
        </MenuItem>
        <MenuSeparator />
      </>
    ),
    [canMakeBigger, canMakeSmaller],
  );
  useDesktopAppMenu("dictionary", "View", viewMenu, within);

  const fileMenu = useMemo(
    () => (
      <>
        <DimmedRow title="New Tab" reason={NO_TABS} keyEquivalent="command+t" />
        <DimmedRow title="Open Dictionaries Folder" reason={NO_FOLDER} />
        <DimmedRow title="Page Setup…" reason={NO_PAGE_SETUP} keyEquivalent="shift+command+p" />
        <MenuItem keyEquivalent="command+p" onClick={() => run.current.print()}>
          Print…
        </MenuItem>
        <MenuSeparator />
      </>
    ),
    [],
  );
  useDesktopAppMenu("dictionary", "File", fileMenu, within);

  const { place, text } = selection;
  const fieldHolds = place === "field";
  const selected = text !== "";
  const wanted = lookUpWord(text);
  const editMenu = useMemo(
    () => (
      <>
        <MenuItem
          keyEquivalent="command+z"
          disabled={!fieldHolds}
          onClick={() => run.current.onField("undo")}
        >
          Undo
        </MenuItem>
        <MenuItem
          keyEquivalent="shift+command+z"
          disabled={!fieldHolds}
          onClick={() => run.current.onField("redo")}
        >
          Redo
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+x"
          disabled={!fieldHolds || !selected}
          onClick={() => run.current.onField("cut")}
        >
          Cut
        </MenuItem>
        <MenuItem
          keyEquivalent="command+c"
          disabled={!selected}
          onClick={() => (fieldHolds ? run.current.onField("copy") : run.current.copyEntry())}
        >
          Copy
        </MenuItem>
        <MenuItem
          keyEquivalent="command+v"
          disabled={!fieldHolds || pasteRefused}
          onClick={() => run.current.paste()}
        >
          Paste
        </MenuItem>
        {fieldHolds && pasteRefused ? (
          <MenuItem disabled>
            This browser keeps the clipboard from menus: the key still pastes
          </MenuItem>
        ) : null}
        <MenuItem disabled={!fieldHolds || !selected} onClick={() => run.current.onField("delete")}>
          Delete
        </MenuItem>
        <MenuItem keyEquivalent="command+a" onClick={() => run.current.selectAll(place)}>
          Select All
        </MenuItem>
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Find</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem keyEquivalent="command+f" onClick={() => run.current.openFind()}>
              Find…
            </MenuItem>
            <MenuItem keyEquivalent="command+g" onClick={() => run.current.find.move(false)}>
              Find Next
            </MenuItem>
            <MenuItem keyEquivalent="shift+command+g" onClick={() => run.current.find.move(true)}>
              Find Previous
            </MenuItem>
            <MenuItem keyEquivalent="command+e" onClick={() => run.current.find.fromSelection()}>
              Use Selection for Find
            </MenuItem>
            <MenuItem keyEquivalent="command+j" onClick={() => run.current.find.jump()}>
              Jump to Selection
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuItem
          disabled={wanted === undefined}
          onClick={() => {
            if (wanted) run.current.lookUp(wanted);
          }}
        >
          {wanted ? `Look Up “${wanted}”` : "Look Up"}
        </MenuItem>
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Spelling and Grammar</SubmenuTrigger>
          <SubmenuPopup aria-label="Spelling and Grammar">
            <DimmedRow
              title="Show Spelling and Grammar"
              reason={NO_CHECKING}
              keyEquivalent="shift+command+;"
            />
            <DimmedRow title="Check Document Now" reason={NO_CHECKING} keyEquivalent="command+;" />
          </SubmenuPopup>
        </Submenu>
        <Submenu>
          <SubmenuTrigger>Substitutions</SubmenuTrigger>
          <SubmenuPopup aria-label="Substitutions">
            <DimmedRow title="Show Substitutions" reason={NO_CHECKING} />
            <DimmedRow title="Smart Quotes" reason={NO_CHECKING} />
          </SubmenuPopup>
        </Submenu>
        <SpeechSubmenu page={page} selected={place === "entry" ? text : ""} />
      </>
    ),
    [fieldHolds, place, selected, text, wanted, pasteRefused, page],
  );
  useDesktopAppMenu("dictionary", "Edit", editMenu, within);

  return { copyEntry: () => run.current.copyEntry() };
}
