"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { Label } from "macalicious/label";
import { ListView } from "macalicious/list-view";
import { MenuItem } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { ScopeBar, ScopeBarButton, ScopeBarGroup } from "macalicious/scope-bar";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { WebView } from "macalicious/web-view";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  Fragment,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { keepText, useKeptTextValue } from "../desktop/desktop-kept-text";
import { readSize, useKeptValue } from "../desktop/desktop-kept-value";
import { openUrl } from "../desktop/desktop-open-url";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { FindBar, useTextFind } from "../notes/notes-find";
import {
  type DictionaryEntry,
  type DictionaryScope,
  type DictionarySense,
  type DictionarySource,
  type DictionaryThesaurus,
  defaultEntries,
  SCOPES,
  search,
} from "./dictionary-data";
import { EntryContextItems, NO_TABS, useDictionaryMenus, wordAtPoint } from "./dictionary-menus";
import {
  DEFAULT_SOURCES,
  DEFAULT_TEXT_SIZE,
  readSources,
  readTextSize,
  SOURCES_KEY,
  shownSources,
  TEXT_SIZE_KEY,
  TEXT_SIZES,
} from "./dictionary-settings";
import "./dictionary.tokens.css";
import "./dictionary.css";

export interface DictionaryProps extends Omit<WindowProps, "children"> {
  /**
   * The vocabulary that is searched.
   * @default defaultEntries
   */
  entries?: readonly DictionaryEntry[];
  /**
   * The text in the search field when the window opens.
   * @default "computer"
   */
  defaultQuery?: string;
  /**
   * The source selected in the scope bar when the window opens.
   * @default "dictionary"
   */
  defaultScope?: DictionaryScope;
  /**
   * Called with the headword whose entry is shown, when it changes, and `null` when none is;
   * also when the shown word is chosen in the list. `chosen` is true for a word chosen in the
   * list, false for one shown because of what was typed.
   */
  onLookUp?: (word: string | null, chosen: boolean) => void;
  /** Called with the text of the search field whenever it changes. */
  onQueryChange?: (query: string) => void;
  /**
   * A word Look Up names while the window is open. Each new `n` starts a new search for `word`
   * as a step of the window's history (Back returns to the search before it); the scope, the
   * text size and the rest of the window's state are kept.
   */
  lookUpRequest?: { word: string; n: number };
  /**
   * The words the list shows while the search field is empty, newest first: the person's
   * recent look-ups. An entry of `entries` with the same headword is shown for each.
   * @default []
   */
  recent?: readonly string[];
  /** Called by the word list's Clear Recents; without it the list has no menu. */
  onForgetRecents?: () => void;
  /** Called by the word list's Remove from Recents with the word under the pointer. */
  onForgetRecent?: (word: string) => void;
  /** A line above the entry about the window's own state, such as a look-up that was not saved. */
  notice?: string | null;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/**
 * One step of the history: what was searched for and the headword that was shown. `typed`
 * marks a step that typing made, which more typing changes in place; choosing a word in the
 * list adds a step.
 */
interface Visit {
  query: string;
  word: string | null;
  typed: boolean;
}

/** The window's history: its steps, and the one shown. */
interface History {
  visits: Visit[];
  at: number;
}

const NO_WORDS: readonly string[] = [];

const LIST_WIDTH = 183;
const MIN_LIST_WIDTH = 120;
const MAX_LIST_WIDTH = 320;
/** How many steps of the history are kept across a reload, around the one shown. */
const KEPT_STEPS = 15;
const KEPT_QUERY = 200;

const readScope = (stored: unknown) => SCOPES.find((scope) => scope.id === stored)?.id;
const readListWidth = (stored: unknown) => {
  const width = readSize(stored);
  return width === undefined
    ? undefined
    : Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, width));
};
const readVisit = (stored: unknown): stored is Visit => {
  if (typeof stored !== "object" || stored === null) return false;
  const { query, word, typed } = stored as Partial<Visit>;
  return (
    typeof query === "string" &&
    (word === null || typeof word === "string") &&
    typeof typed === "boolean"
  );
};
const readHistory = (stored: unknown): History | undefined => {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { visits, at } = stored as Partial<History>;
  return Array.isArray(visits) &&
    visits.length > 0 &&
    visits.every(readVisit) &&
    typeof at === "number" &&
    visits[at] !== undefined
    ? { visits, at }
    : undefined;
};
const parseHistory = (text: string): History | undefined => {
  try {
    return readHistory(JSON.parse(text));
  } catch {
    return undefined;
  }
};

/**
 * Keeps the steps around the one shown, always small enough for a kept text: no entry's word is
 * longer than 80 characters, so a longer search can match none and comes back cut to
 * `KEPT_QUERY` characters.
 */
function keepHistory({ visits, at }: History) {
  const from = Math.max(0, Math.min(at - Math.floor(KEPT_STEPS / 2), visits.length - KEPT_STEPS));
  const steps = visits
    .slice(from, from + KEPT_STEPS)
    .map((visit) => ({ ...visit, query: [...visit.query].slice(0, KEPT_QUERY).join("") }));
  keepText("dictionary.history", JSON.stringify({ visits: steps, at: at - from }));
}

/* The library's hooks, set to the colours measured in the captures (dictionary.tokens.css). */
const SPLIT_STYLE = {
  "--mac-split-view-divider-color": "var(--mac-dictionary-divider)",
} as CSSProperties;
const WORDS_STYLE = {
  "--mac-list-view-selected-background": "var(--mac-dictionary-selection)",
} as CSSProperties;

/** An original drawing: the chevron of the Back and Forward buttons. */
function Chevron({ forward = false }: { forward?: boolean }) {
  return (
    <svg width="9" height="13" viewBox="0 0 9 13" aria-hidden="true">
      <path
        d={forward ? "M2 1.5l5 5-5 5" : "M7 1.5l-5 5 5 5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A list of senses, numbered when there are several, with their examples and narrower senses. */
function Senses({ senses }: { senses: readonly DictionarySense[] }) {
  return (
    <ol className="mac-dictionary-senses" data-numbered={senses.length > 1 ? "" : undefined}>
      {senses.map((sense) => (
        <li key={sense.text} className="mac-dictionary-sense">
          {sense.text}
          {sense.examples?.map((example) => (
            <span key={example} className="mac-dictionary-example">
              {example}
            </span>
          ))}
          {sense.subsenses ? (
            <ul className="mac-dictionary-subsenses">
              {sense.subsenses.map((subsense) => (
                <li key={subsense} className="mac-dictionary-subsense">
                  {subsense}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Words of an entry, parted by commas: each is looked up when clicked. */
function WordLinks({
  words,
  onLookUp,
}: {
  words: readonly string[];
  onLookUp: (word: string) => void;
}) {
  return words.map((word, at) => (
    <Fragment key={word}>
      {at > 0 ? ", " : null}
      <button type="button" className="mac-dictionary-word-link" onClick={() => onLookUp(word)}>
        {word}
      </button>
    </Fragment>
  ));
}

/** One part of speech of the thesaurus: its example, synonyms and antonyms. */
function Synonyms({
  group,
  onLookUp,
}: {
  group: DictionaryThesaurus;
  onLookUp: (word: string) => void;
}) {
  return (
    <>
      <p className="mac-dictionary-part">{group.part}</p>
      {group.synonyms.length > 0 ? (
        <p className="mac-dictionary-sense">
          {group.example ? (
            <>
              <i>{group.example}</i>:{" "}
            </>
          ) : null}
          <WordLinks words={group.synonyms} onLookUp={onLookUp} />.
        </p>
      ) : null}
      {group.antonyms && group.antonyms.length > 0 ? (
        <p className="mac-dictionary-sense">
          ANTONYMS <WordLinks words={group.antonyms} onLookUp={onLookUp} />.
        </p>
      ) : null}
    </>
  );
}

/** Plays a recording of the word through the page's audio. */
function Listen({ audio, word }: { audio: string; word: string }) {
  return (
    <PushButton
      size="mini"
      className="mac-dictionary-listen"
      aria-label={`Listen to ${word}`}
      onClick={() => {
        void new Audio(audio).play().catch(() => {});
      }}
    >
      Listen
    </PushButton>
  );
}

/**
 * A link out of an entry: on the served desktop it opens in Safari, and elsewhere as a link does.
 */
function followLink(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (!servedByDesktopApp()) return;
  event.preventDefault();
  openUrl(event.currentTarget.href, "dictionary");
}

/** The article on one headword: a section for every source the scope shows. */
/** How long a click on a word waits for the second click of a double click. */
const DOUBLE_CLICK_MS = 250;

function Article({
  entry,
  scope,
  sources: allSources,
  onLookUp,
}: {
  entry: DictionaryEntry;
  scope: DictionaryScope;
  sources: readonly { id: DictionarySource; title: string }[];
  onLookUp: (word: string) => void;
}) {
  const sources = allSources.filter(
    (source) => (scope === "all" || scope === source.id) && entry[source.id] !== undefined,
  );
  return (
    <article className="mac-dictionary-article">
      {sources.map((source) => (
        <section key={source.id} className="mac-dictionary-source" data-source={source.id}>
          {/* Under "All" every source is announced by its name; one source needs none. */}
          {scope === "all" ? <h2 className="mac-dictionary-source-title">{source.title}</h2> : null}
          {source.id === "dictionary" && entry.dictionary ? (
            <>
              <h3 className="mac-dictionary-headword">
                {entry.dictionary.syllables}
                {entry.dictionary.pronunciation ? (
                  <span className="mac-dictionary-pronunciation">
                    {" "}
                    | {entry.dictionary.pronunciation} |
                  </span>
                ) : null}
                {entry.dictionary.audio ? (
                  <Listen audio={entry.dictionary.audio} word={entry.word} />
                ) : null}
              </h3>
              <p className="mac-dictionary-part">{entry.dictionary.part}</p>
              <Senses senses={entry.dictionary.senses} />
              {entry.dictionary.more?.map((more) => (
                <div key={more.part}>
                  <p className="mac-dictionary-part">{more.part}</p>
                  <Senses senses={more.senses} />
                </div>
              ))}
            </>
          ) : null}
          {source.id === "thesaurus" && entry.thesaurus ? (
            <>
              <h3 className="mac-dictionary-headword">{entry.word}</h3>
              {[entry.thesaurus, ...(entry.thesaurus.more ?? [])].map((group) => (
                <Synonyms key={group.part} group={group} onLookUp={onLookUp} />
              ))}
            </>
          ) : null}
          {source.id === "apple" && entry.apple ? (
            <>
              <h3 className="mac-dictionary-headword">{entry.word}</h3>
              <p className="mac-dictionary-sense">{entry.apple}</p>
            </>
          ) : null}
          {source.id === "wikipedia" && entry.wikipedia ? (
            <>
              <h3 className="mac-dictionary-headword">{entry.word}</h3>
              <p className="mac-dictionary-sense">{entry.wikipedia}</p>
              {entry.wikipediaUrl ? (
                <p className="mac-dictionary-sense">
                  <Label
                    render={
                      <a
                        href={entry.wikipediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={followLink}
                      />
                    }
                    color="link"
                  >
                    Read More on Wikipedia
                  </Label>
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ))}
      {entry.credits && entry.credits.length > 0 && sources.length > 0 ? (
        <footer className="mac-dictionary-credits">
          {entry.credits.map((credit) => (
            <Label
              key={credit.href}
              render={
                <a href={credit.href} target="_blank" rel="noreferrer" onClick={followLink} />
              }
              color="link"
              textStyle="small"
              className="mac-dictionary-credit"
            >
              {credit.text}
            </Label>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

/** Whether an entry has a section to show in a scope. */
const hasSection = (
  entry: DictionaryEntry,
  scope: DictionaryScope,
  sources: readonly { id: DictionarySource }[],
) =>
  sources.some(
    (source) => (scope === "all" || scope === source.id) && entry[source.id] !== undefined,
  );

/**
 * The Dictionary window of macOS 10.15: a toolbar with Back and Forward, the two text size
 * buttons and the search field, a scope bar of sources, the list of headwords that start with
 * what was typed, and the entry of the selected one. By default the vocabulary is a few dozen
 * words of the demo's own and nothing is looked up anywhere; the desktop's Ferrite application
 * gives it real entries (`dictionary-desktop.tsx`).
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function Dictionary({
  entries = defaultEntries,
  defaultQuery = "computer",
  defaultScope = "dictionary",
  onLookUp,
  onQueryChange,
  lookUpRequest,
  recent = NO_WORDS,
  onForgetRecents,
  onForgetRecent,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  notice,
  width = 690,
  height = 650,
  ...windowProps
}: DictionaryProps) {
  const [chosenScope, setScope] = useKeptValue<DictionaryScope>(
    "dictionary.scope",
    readScope,
    defaultScope,
  );
  // The scope bar and an entry show the sources Preferences turned on, in its order. A scope whose
  // source was turned off gives way to All until it is turned on again.
  const sources = shownSources(useDesktopValue(SOURCES_KEY, readSources, DEFAULT_SOURCES));
  const scope =
    chosenScope === "all" || sources.some((source) => source.id === chosenScope)
      ? chosenScope
      : "all";
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [history, setHistory] = useState<History>(() => ({
    visits: [
      {
        query: defaultQuery,
        word: search(entries, defaultQuery, defaultScope)[0]?.word ?? null,
        typed: true,
      },
    ],
    at: 0,
  }));
  // The text size is one setting of all the windows and Preferences; a window outside the desktop
  // holds its own.
  const storedSize = useDesktopValue<number | undefined>(TEXT_SIZE_KEY, readTextSize, undefined);
  const [ownSize, setOwnSize] = useState(DEFAULT_TEXT_SIZE);
  const textSize = storedSize ?? ownSize;
  const setTextSize = (next: number) => {
    setOwnSize(next);
    if (servedByDesktopApp() || storedSize !== undefined) changeDesktopValue(TEXT_SIZE_KEY, next);
  };
  const [listWidth, setListWidth] = useKeptValue("dictionary.listWidth", readListWidth, LIST_WIDTH);
  const resize = (step: number) =>
    setTextSize(Math.min(TEXT_SIZES.length - 1, Math.max(0, textSize + step)));

  // The history comes back as the window was left, into a window that has not searched yet; a word
  // Look Up opened the window on stands. The latest steps go back at each change.
  const keptHistory = useKeptTextValue("dictionary.history");
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || keptHistory === undefined || !servedByDesktopApp()) return;
    const stored = parseHistory(keptHistory);
    if (!stored) return;
    restored.current = true;
    setHistory((now) => (now.visits.length === 1 && now.visits[0]?.query === "" ? stored : now));
  }, [keptHistory]);
  // A window that opens on nothing has nothing to keep yet; one that Look Up opened on a word does.
  const savedHistory = useRef<History | null>(null);
  useEffect(() => {
    if (history === savedHistory.current || !servedByDesktopApp()) return;
    const opening = savedHistory.current === null;
    savedHistory.current = history;
    if (!opening || history.visits[history.at]?.query !== "") keepHistory(history);
  }, [history]);

  const visit = history.visits[history.at] as Visit;
  const searching = visit.query.trim() !== "";
  const results = useMemo(
    () =>
      searching
        ? search(entries, visit.query, scope)
        : recent.map((word) => entries.find((entry) => entry.word === word) ?? { word }),
    [entries, visit.query, scope, searching, recent],
  );
  // What was typed, when an entry has exactly that headword; else the word of the visit while
  // the scope lists it, and else the first one found.
  const typedWord = visit.typed ? visit.query.split(/\s+/).filter(Boolean).join(" ") : "";
  const shown =
    (typedWord ? results.find((entry) => entry.word === typedWord) : undefined) ??
    results.find((entry) => entry.word === visit.word) ??
    results[0];

  // The host hears of the shown word when it changes, not of the one the window opens on.
  const current = shown?.word ?? null;
  // A step that recorded no word (a search of the recent look-ups, or a search made before its
  // entries arrived) records the word it shows as soon as it shows one, so Back to it shows that
  // word again whatever the lists hold by then.
  useEffect(() => {
    if (visit.word !== null || current === null) return;
    setHistory(({ visits, at }) =>
      visits[at]?.word === null
        ? { visits: visits.map((step, i) => (i === at ? { ...step, word: current } : step)), at }
        : { visits, at },
    );
  }, [visit.word, current]);
  const report = useRef(onLookUp);
  report.current = onLookUp;
  const reported = useRef(current);
  useEffect(() => {
    if (reported.current === current) return;
    reported.current = current;
    report.current?.(current, !visit.typed);
  }, [current, visit.typed]);

  // And of the search field's text whenever it changes.
  const tell = useRef(onQueryChange);
  tell.current = onQueryChange;
  const told = useRef(visit.query);
  useEffect(() => {
    if (told.current === visit.query) return;
    told.current = visit.query;
    tell.current?.(visit.query);
  }, [visit.query]);

  const type = (query: string) =>
    setHistory(({ visits, at }) => {
      const word = search(entries, query, scope)[0]?.word ?? null;
      const next = { query, word, typed: true };
      // Typing goes on in the step that typing began, and the steps ahead of it are dropped:
      // they belong to the search that is being replaced. After a choice in the list, typing
      // begins a step.
      return visits[at]?.typed
        ? { visits: [...visits.slice(0, at), next], at }
        : { visits: [...visits.slice(0, at + 1), next], at: at + 1 };
    });
  // Choosing a word makes a step, Back returns from it. A choice of the word a typed search
  // already shows is a step too: it commits that search, so the next search is a step of its
  // own. Choosing the word a chosen step already shows changes nothing.
  const choose = (word: string) => {
    // A choice of the word already shown is a look-up of it all the same: the host hears of it.
    if (word === current) report.current?.(word, true);
    setHistory(({ visits, at }) =>
      visits[at]?.word === word && !visits[at]?.typed
        ? { visits, at }
        : {
            visits: [...visits.slice(0, at + 1), { query: visit.query, word, typed: false }],
            at: at + 1,
          },
    );
  };
  const searchFor = useCallback(
    (query: string) => {
      const word = search(entries, query, scope)[0]?.word ?? null;
      setHistory(({ visits, at }) => ({
        visits: [...visits.slice(0, at + 1), { query, word, typed: true }],
        at: at + 1,
      }));
    },
    [entries, scope],
  );
  const wordClick = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(wordClick.current), []);
  // A Look Up request the window has not taken yet starts a new search step.
  const takenRequest = useRef(lookUpRequest?.n);
  useEffect(() => {
    if (!lookUpRequest || takenRequest.current === lookUpRequest.n) return;
    takenRequest.current = lookUpRequest.n;
    searchFor(lookUpRequest.word);
  }, [lookUpRequest, searchFor]);
  const go = (step: number) =>
    setHistory(({ visits, at }) => ({
      visits,
      at: Math.min(visits.length - 1, Math.max(0, at + step)),
    }));
  const field = useRef<HTMLInputElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const find = useTextFind(
    () => page.current?.querySelector("article"),
    `${current}\n${scope}\n${shown?.status}`,
  );
  const menus = useDictionaryMenus({
    isKey: windowProps.state === "key",
    within: titleBar,
    field,
    page,
    word: current,
    canGoBack: history.at > 0,
    canGoForward: history.at < history.visits.length - 1,
    canMakeBigger: textSize < TEXT_SIZES.length - 1,
    canMakeSmaller: textSize > 0,
    go,
    resize,
    lookUp: searchFor,
    find,
  });

  const renderRow = useCallback(
    (index: number) => <span className="mac-dictionary-word">{results[index]?.word}</span>,
    [results],
  );
  const title = searching ? `Dictionary (${results.length} found)` : "Dictionary";
  const [menuWord, setMenuWord] = useState<string | null>(null);
  const wordList = (
    <ListView
      aria-label="Words"
      className="mac-dictionary-words"
      style={WORDS_STYLE}
      count={results.length}
      rowHeight={28}
      separatorInset={24}
      renderRow={renderRow}
      getRowId={(index) => results[index]?.word ?? ""}
      getRowLabel={(index) => results[index]?.word ?? ""}
      value={shown ? [shown.word] : []}
      onValueChange={(value) => {
        if (typeof value[0] === "string") choose(value[0]);
      }}
    />
  );

  return (
    <Window width={width} height={height} {...windowProps}>
      <TitleBar
        ref={setTitleBar}
        variant="unified"
        divider="line"
        title={title}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <Toolbar aria-label="Toolbar" className="mac-dictionary-toolbar">
          <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="History">
            <ToolbarSegment aria-label="Back" disabled={history.at === 0} onClick={() => go(-1)}>
              <Chevron />
            </ToolbarSegment>
            <ToolbarSegment
              aria-label="Forward"
              disabled={history.at >= history.visits.length - 1}
              onClick={() => go(1)}
            >
              <Chevron forward />
            </ToolbarSegment>
          </ToolbarSegmentedControl>
          <ToolbarSegmentedControl
            variant="navigation"
            tracking="momentary"
            aria-label="Text size"
            className="mac-dictionary-text-size"
          >
            <ToolbarSegment
              aria-label="Decrease text size"
              disabled={textSize === 0}
              onClick={() => resize(-1)}
            >
              <span className="mac-dictionary-letter" data-size="small" aria-hidden="true">
                A
              </span>
            </ToolbarSegment>
            <ToolbarSegment
              aria-label="Increase text size"
              disabled={textSize === TEXT_SIZES.length - 1}
              onClick={() => resize(1)}
            >
              <span className="mac-dictionary-letter" data-size="large" aria-hidden="true">
                A
              </span>
            </ToolbarSegment>
          </ToolbarSegmentedControl>
          <ToolbarSearchField
            inputRef={field}
            value={visit.query}
            onValueChange={type}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="mac-dictionary-search"
          />
        </Toolbar>
      </TitleBar>
      <ScopeBar surface="toolbar" size="small" className="mac-dictionary-scope-bar">
        <ScopeBarGroup
          aria-label="Source"
          value={scope}
          onValueChange={(value) => setScope(value as DictionaryScope)}
        >
          {[{ id: "all" as const, title: "All" }, ...sources].map((item) => (
            <ScopeBarButton key={item.id} value={item.id} className="mac-dictionary-scope">
              {item.title}
            </ScopeBarButton>
          ))}
        </ScopeBarGroup>
      </ScopeBar>
      <WindowBody background="content" className="mac-dictionary-body">
        <SplitView className="mac-dictionary-split" style={SPLIT_STYLE}>
          <SplitViewPane
            size={listWidth}
            onSizeChange={setListWidth}
            minSize={MIN_LIST_WIDTH}
            maxSize={MAX_LIST_WIDTH}
            className="mac-dictionary-sidebar"
          >
            {onForgetRecents ? (
              <ContextualMenu>
                <ContextualMenuTrigger
                  className="mac-dictionary-words-area"
                  onContextMenu={(event) => {
                    const row =
                      event.target instanceof Element
                        ? event.target.closest('[role="option"], [role="row"]')
                        : null;
                    setMenuWord(row?.textContent?.trim() ?? null);
                  }}
                >
                  {wordList}
                </ContextualMenuTrigger>
                <ContextualMenuPopup aria-label="Word list commands">
                  <MenuItem disabled title={NO_TABS}>
                    Open in New Tab
                  </MenuItem>
                  <MenuItem
                    disabled={
                      !onForgetRecent ||
                      menuWord === null ||
                      !recent.includes(menuWord) ||
                      searching
                    }
                    onClick={() => {
                      if (menuWord !== null) onForgetRecent?.(menuWord);
                    }}
                  >
                    Remove from Recents
                  </MenuItem>
                  <MenuItem disabled={recent.length === 0} onClick={onForgetRecents}>
                    Clear Recents
                  </MenuItem>
                </ContextualMenuPopup>
              </ContextualMenu>
            ) : (
              wordList
            )}
          </SplitViewPane>
          <SplitViewDivider aria-label="Resize the word list" />
          <SplitViewPane className="mac-dictionary-entry-pane">
            <FindBar find={find} />
            <ContextualMenu>
              <ContextualMenuTrigger
                className="mac-dictionary-entry-area"
                onClick={(event) => {
                  // A word in the entry is a link to its own entry. The wait lets a double click
                  // select the word instead, and a drag that selected text is no click on a word.
                  clearTimeout(wordClick.current);
                  if (event.detail > 1 || !(event.target instanceof Element)) return;
                  const article = event.target.closest(".mac-dictionary-article");
                  if (!article || event.target.closest("a, button")) return;
                  if (document.getSelection()?.isCollapsed === false) return;
                  const word = wordAtPoint(article, event.clientX, event.clientY);
                  if (!word || word === shown?.word) return;
                  wordClick.current = setTimeout(() => searchFor(word), DOUBLE_CLICK_MS);
                }}
              >
                <WebView
                  ref={page}
                  title={shown ? `Entry for ${shown.word}` : "Entry"}
                  className="mac-dictionary-entry"
                  style={{ "--mac-dictionary-text-scale": TEXT_SIZES[textSize] } as CSSProperties}
                >
                  {notice ? (
                    <Label role="status" render={<p />} textStyle="small" color="secondary">
                      {notice}
                    </Label>
                  ) : null}
                  {shown && hasSection(shown, scope, sources) ? (
                    <Article entry={shown} scope={scope} sources={sources} onLookUp={searchFor} />
                  ) : shown?.status ? (
                    <EmptyState role="status">{shown.status}</EmptyState>
                  ) : searching ? (
                    <EmptyState role="status">No entries found</EmptyState>
                  ) : null}
                </WebView>
              </ContextualMenuTrigger>
              <ContextualMenuPopup aria-label="Entry commands">
                <EntryContextItems page={page} onLookUp={searchFor} onCopy={menus.copyEntry} />
              </ContextualMenuPopup>
            </ContextualMenu>
          </SplitViewPane>
        </SplitView>
      </WindowBody>
    </Window>
  );
}
