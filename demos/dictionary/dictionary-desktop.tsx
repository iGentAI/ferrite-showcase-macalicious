import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DESKTOP_EFFECTS_EVENT } from "../desktop/desktop-effects";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { desktopValues, useDesktopSetting } from "../desktop/desktop-personal";
import {
  currentDesktopSession,
  servedByDesktopApp,
  sessionFetch,
  withDeadline,
} from "../desktop/desktop-server";
import { wikipediaLink } from "../maps/maps-server";
import { Dictionary, type DictionaryProps } from "./dictionary";
import { appleTermsFor, withAppleTerm } from "./dictionary-apple";
import type {
  DictionaryArticle,
  DictionaryCredit,
  DictionaryEntry,
  DictionarySense,
  DictionaryThesaurus,
} from "./dictionary-data";
import { selectionBox, showLookUpPopover } from "./dictionary-look-up";
import { lookUpWord } from "./dictionary-menus";
import { ACCENT_KEY, DEFAULT_ACCENT, inAccent, readAccent } from "./dictionary-settings";

/** The routes of the desktop's Dictionary module (`ferrite-apps/desktop/src/apps/dictionary`). */
export const SUGGEST_URL = "/api/dictionary/suggest";
export const ENTRY_URL = "/api/dictionary/entry";
export const HISTORY_URL = "/api/dictionary/history";

/** The window event by which Look Up names a word to an open Dictionary window. */
export const LOOK_UP_EVENT = "macalicious:look-up";

/** How long typing rests before the word list, and then the shown word, are asked for. */
export const SUGGEST_PAUSE_MS = 250;
export const LOOK_UP_PAUSE_MS = 450;

/** What the window says of a word while it is being looked up, and when nothing knows it. */
export const LOOKING_UP = "Looking up…";
export const NOT_FOUND = "No entries found";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

export { lookUpWord };

const senseOf = (value: unknown): DictionarySense | undefined => {
  if (!isRecord(value) || !text(value.text)) return undefined;
  const examples = strings(value.examples);
  return { text: value.text as string, ...(examples.length > 0 ? { examples } : {}) };
};

const partOf = (value: unknown) => {
  if (!isRecord(value) || !text(value.part) || !Array.isArray(value.senses)) return undefined;
  const senses = value.senses.map(senseOf).filter((sense) => sense !== undefined);
  return senses.length > 0 ? { part: value.part as string, senses } : undefined;
};

const groupOf = (value: unknown): DictionaryThesaurus | undefined => {
  if (!isRecord(value) || !text(value.part)) return undefined;
  const synonyms = strings(value.synonyms);
  const antonyms = strings(value.antonyms);
  if (synonyms.length === 0 && antonyms.length === 0) return undefined;
  return { part: value.part as string, synonyms, ...(antonyms.length > 0 ? { antonyms } : {}) };
};

/**
 * The window's entry for a word from the module's answer, or `undefined` when the answer is not
 * the module's. A word no source knows becomes an entry that says so.
 */
/** What the server read of each accent, with only `https` recordings. */
const accentsOf = (accents: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(accents).flatMap(([accent, said]) => {
      if (!isRecord(said)) return [];
      const pronunciation = text(said.pronunciation);
      const audio = text(said.audio);
      return [
        [
          accent,
          {
            ...(pronunciation ? { pronunciation } : {}),
            ...(audio?.startsWith("https://") ? { audio } : {}),
          },
        ],
      ];
    }),
  );

export function entryFromServer(reply: unknown): DictionaryEntry | undefined {
  if (!isRecord(reply) || !text(reply.word) || typeof reply.found !== "boolean") return undefined;
  const word = reply.word as string;
  const entry: {
    word: string;
    dictionary?: DictionaryArticle;
    thesaurus?: DictionaryThesaurus;
    wikipedia?: string;
    wikipediaUrl?: string;
    credits?: DictionaryCredit[];
    status?: string;
  } = { word };
  const dictionary = reply.dictionary;
  if (isRecord(dictionary) && Array.isArray(dictionary.parts)) {
    const [first, ...more] = dictionary.parts.map(partOf).filter((part) => part !== undefined);
    if (first) {
      entry.dictionary = {
        syllables: word,
        part: first.part,
        senses: first.senses,
        ...(text(dictionary.pronunciation)
          ? { pronunciation: dictionary.pronunciation as string }
          : {}),
        ...(text(dictionary.audio)?.startsWith("https://")
          ? { audio: dictionary.audio as string }
          : {}),
        ...(isRecord(dictionary.accents) ? { accents: accentsOf(dictionary.accents) } : {}),
        ...(more.length > 0 ? { more } : {}),
      };
    }
  }
  if (Array.isArray(reply.thesaurus)) {
    const [first, ...more] = reply.thesaurus.map(groupOf).filter((group) => group !== undefined);
    if (first) entry.thesaurus = more.length > 0 ? { ...first, more } : first;
  }
  const wikipedia = reply.wikipedia;
  if (isRecord(wikipedia) && text(wikipedia.extract)) {
    entry.wikipedia = wikipedia.extract as string;
    const link = wikipediaLink(wikipedia.url);
    if (link) entry.wikipediaUrl = link;
  }
  if (Array.isArray(reply.credits)) {
    const credits = reply.credits.filter(
      (credit): credit is DictionaryCredit =>
        isRecord(credit) && !!text(credit.text) && !!text(credit.href)?.startsWith("https://"),
    );
    if (credits.length > 0) entry.credits = credits;
  }
  if (!entry.dictionary && !entry.thesaurus && !entry.wikipedia) {
    entry.status =
      strings(reply.failed).length > 0
        ? "Some of the dictionary's sources could not be reached. Try again in a moment."
        : NOT_FOUND;
  }
  return entry;
}

/** The words of a suggestion answer; empty when it is not one. */
export function suggestionsFromServer(reply: unknown): string[] {
  return isRecord(reply) ? strings(reply.words).filter((word) => lookUpWord(word) === word) : [];
}

/** The words of the person's history, newest first; empty before the first or when unreadable. */
export function historyFromServer(reply: unknown): string[] {
  if (!isRecord(reply) || !Array.isArray(reply.history)) return [];
  return reply.history
    .map((past) => (isRecord(past) ? text(past.word) : undefined))
    .filter((word): word is string => word !== undefined);
}

async function getJson(url: string): Promise<unknown> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

/** A word's entry for the Look Up popover: kept in the person's recents, as a look-up is. */
const readEntry = async (word: string) =>
  entryFromServer(await getJson(`${ENTRY_URL}?word=${encodeURIComponent(word)}`));

/** The `autocomplete` tokens of fields whose text is a secret or a credential. */
const SECRET_FIELDS = /password|one-time-code|cc-|webauthn/i;

/**
 * Whether Look Up may read a field's selection: a text area, or an input of type text or search,
 * that is not marked as holding a password, a one-time code, a card or another credential. A
 * password field, and any other input type, never is.
 */
export function lookUpReadable(field: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (SECRET_FIELDS.test(field.autocomplete ?? "") || SECRET_FIELDS.test(field.name ?? ""))
    return false;
  if (field instanceof HTMLTextAreaElement) return true;
  return field.type === "text" || field.type === "search";
}

/**
 * The text selected on the page: in the text field or text area that has the keyboard, or else
 * in the document. Empty when nothing is selected, and always empty while the keyboard is in a
 * password or other credential field (`lookUpReadable`), whose text is never sent anywhere.
 */
export function selectedText(doc: Document = document): string {
  const active = doc.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    if (!lookUpReadable(active)) return "";
    const { selectionStart: start, selectionEnd: end, value } = active;
    if (start !== null && end !== null && end > start) return value.slice(start, end);
  }
  return doc.getSelection()?.toString() ?? "";
}

/** The word Look Up asked for before a Dictionary window was there to take it. */
let pending: string | null = null;

/** The look-ups every window has asked the module for and has no answer to yet. */
const lookUpsOnTheirWay = new Set<Promise<void>>();
/** How many times the person has begun Clear Recents, and how many of those are not done. */
let clearsStarted = 0;
let clearsUnderWay = 0;

/** The window event that tells every Dictionary window the person's recents are gone. */
const RECENTS_CLEARED_EVENT = "macalicious:dictionary-recents-cleared";
/** The window event that tells every Dictionary window one word left the person's recents. */
const RECENT_REMOVED_EVENT = "macalicious:dictionary-recent-removed";

/** Takes the word Look Up left for the next Dictionary window, if any. */
export function takePendingLookUp(): string | null {
  const word = pending;
  pending = null;
  return word;
}

/**
 * Look Up: shows `word` in Dictionary. An open window takes it at once; otherwise the desktop opens
 * one (`desktop-effects.ts`), which takes it as it starts.
 */
export function lookUp(word: string, target: Window = window): boolean {
  const wanted = lookUpWord(word);
  if (!wanted) return false;
  pending = wanted;
  target.dispatchEvent(
    new CustomEvent(LOOK_UP_EVENT, { cancelable: true, detail: { word: wanted } }),
  );
  target.dispatchEvent(
    new CustomEvent(DESKTOP_EFFECTS_EVENT, { detail: [{ open: "dictionary" }] }),
  );
  return true;
}

/** Whether a key press is Look Up's: Control-Command-D, as on a Mac, or Control-Option-D. */
export const isLookUpKey = (
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "code">,
) => event.ctrlKey && (event.metaKey || event.altKey) && event.code === "KeyD";

/** The word a `dict://word` link names, or `undefined` for any other address. */
export function wordOfDictLink(href: string): string | undefined {
  const named = /^dict:(?:\/\/)?(.*)$/i.exec(href.trim())?.[1];
  if (named === undefined) return undefined;
  try {
    return lookUpWord(decodeURIComponent(named).replace(/\/$/, ""));
  } catch {
    return undefined;
  }
}

/**
 * Starts Look Up for the whole desktop (the descriptor's `onDesktopStart`): Control-Command-D
 * (or Control-Option-D, where the system keeps Command) with text selected in any window shows its
 * definition over the selection, on the desktop that can look it up, with Open in Dictionary under
 * it; elsewhere it shows the word in Dictionary. A click on a `dict://word` link in any window
 * shows it in Dictionary. Returns the cleanup.
 */
export function startLookUp(target: Window = window): () => void {
  const press = (event: KeyboardEvent) => {
    if (!isLookUpKey(event)) return;
    const selected = selectedText(target.document);
    const word = lookUpWord(selected);
    if (word && servedByDesktopApp()) {
      event.preventDefault();
      showLookUpPopover({
        word,
        over: selectionBox(target.document),
        read: async (asked) => {
          const entry = await readEntry(asked);
          return (
            entry && inAccent(entry, readAccent(desktopValues()[ACCENT_KEY]) ?? DEFAULT_ACCENT)
          );
        },
        open: (chosen) => lookUp(chosen, target),
      });
    } else if (lookUp(selected, target)) event.preventDefault();
  };
  const click = (event: MouseEvent) => {
    const link =
      event.target instanceof Element ? event.target.closest('a[href^="dict:" i]') : null;
    const word = link ? wordOfDictLink(link.getAttribute("href") ?? "") : undefined;
    if (word && lookUp(word, target)) event.preventDefault();
  };
  target.addEventListener("keydown", press, true);
  target.document.addEventListener("click", click, true);
  return () => {
    target.removeEventListener("keydown", press, true);
    target.document.removeEventListener("click", click, true);
  };
}

/** A word Look Up names while the window is open; `n` counts them so the same word counts again.
 * `onEach` hears every one as it comes, even several in one step, which the state alone keeps
 * only the last of. */
function useLookUps(initial: string | null, onEach?: (word: string) => void) {
  const [asked, setAsked] = useState({ word: initial, n: 0 });
  const each = useRef(onEach);
  each.current = onEach;
  useEffect(() => {
    const take = (event: Event) => {
      const word = (event as CustomEvent<{ word?: unknown }>).detail?.word;
      if (typeof word !== "string" || event.defaultPrevented) return;
      // This window takes it, so it is not left for another, and no other window takes it too.
      event.preventDefault();
      takePendingLookUp();
      each.current?.(word);
      setAsked((current) => ({ word, n: current.n + 1 }));
    };
    window.addEventListener(LOOK_UP_EVENT, take);
    return () => window.removeEventListener(LOOK_UP_EVENT, take);
  }, []);
  return asked;
}

/** The request `Dictionary` takes for a Look Up that came while the window was open. */
function useLookUpRequest(asked: { word: string | null; n: number }) {
  return useMemo(
    () => (asked.n > 0 && asked.word !== null ? { word: asked.word, n: asked.n } : undefined),
    [asked],
  );
}

function ServedDictionary({
  defaultQuery = "",
  onLookUp,
  onQueryChange,
  ...props
}: DictionaryProps) {
  const [start] = useState(() => takePendingLookUp());
  // The word of the last Look Up, asked for as it came: the window then shows it, and that is
  // not asked for a second time.
  const lookedUp = useRef<string | null>(null);
  const fetchNow = useRef<(word: string) => void>(() => {});
  const asked = useLookUps(start, (word) => {
    const wanted = lookUpWord(word);
    if (!wanted) return;
    lookedUp.current = wanted;
    // A typed word still waiting for typing to rest is dropped: this Look Up came after it.
    show(null);
    fetchNow.current(wanted);
  });
  // The word Spotlight defined: looked up like any other.
  useOpenItemRequests("dictionary", ({ id }) => lookUp(id));
  const request = useLookUpRequest(asked);
  const [opening] = useState(() => asked.word ?? defaultQuery);
  const [query, setQuery] = useState(opening);
  // The word whose entry to ask for, and how many times a word has been asked for: asking again
  // for the same word (Look Up after a failure says to try again) is a new request. A word
  // chosen in the list is asked for at once; one shown because of typing waits for typing to
  // rest, and a newer one replaces it.
  const [shown, setShown] = useState({ word: lookUpWord(opening) ?? null, n: 0, now: false });
  const show = useCallback(
    (word: string | null, now = false) => setShown((current) => ({ word, n: current.n + 1, now })),
    [],
  );
  const [suggested, setSuggested] = useState<string[]>([]);
  // Keyed by headword in a Map: "constructor" or "toString" are words like any other, never an
  // inherited property of an object.
  const [articles, setArticles] = useState<ReadonlyMap<string, DictionaryEntry>>(() => new Map());
  const [recentLookUps, setRecentLookUps] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [storedHistory, setStoredHistory] = useState<string[]>([]);
  // Numbers this window's look-ups in the order they were started, and each word's latest.
  const lookUps = useRef(0);
  // The start number of the newest look-up of each word that has answered.
  const answeredStart = useRef(new Map<string, number>());
  // The recent look-ups: this window's kept look-ups, the latest started first, then the stored
  // history (which is older than any of them). Answers that arrive out of order, and a history
  // that arrives late, change nothing in that order.
  const recent = useMemo(() => {
    const own = [...recentLookUps].sort((a, b) => b[1] - a[1]).map(([word]) => word);
    return [...own, ...storedHistory.filter((word) => !recentLookUps.has(word))].slice(0, 50);
  }, [recentLookUps, storedHistory]);
  // Why the latest look-up is missing from the recent look-ups, when the module could not keep
  // it; only the newest look-up that answered says so.
  const [historyProblem, setHistoryProblem] = useState<string | null>(null);
  const problemStart = useRef(0);
  /**
   * Clear Recents: the person's look-ups go from the module, and then from every window's list. A
   * look-up asked for before the clear would come back into the history behind it, so those already
   * on their way, in any window, are heard out first, and any asked for from now until the clear is
   * done, or still waiting for typing to rest, leave the history alone.
   */
  const forgetRecents = useCallback(() => {
    setHistoryProblem(null);
    clearsStarted += 1;
    clearsUnderWay += 1;
    const session = currentDesktopSession();
    Promise.allSettled(lookUpsOnTheirWay)
      .then(() =>
        sessionFetch(HISTORY_URL, { method: "DELETE", credentials: "same-origin" }, session),
      )
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        window.dispatchEvent(new CustomEvent(RECENTS_CLEARED_EVENT));
      })
      .catch(() =>
        setHistoryProblem("Your recent look-ups could not be cleared. Try again in a moment."),
      )
      .finally(() => {
        clearsUnderWay -= 1;
      });
  }, []);

  /** Remove from Recents: one word goes from the module, then from every window's list. */
  const forgetRecent = useCallback((word: string) => {
    setHistoryProblem(null);
    const session = currentDesktopSession();
    Promise.allSettled(lookUpsOnTheirWay)
      .then(() =>
        sessionFetch(
          `${HISTORY_URL}?word=${encodeURIComponent(word)}`,
          { method: "DELETE", credentials: "same-origin" },
          session,
        ),
      )
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        window.dispatchEvent(new CustomEvent(RECENT_REMOVED_EVENT, { detail: { word } }));
      })
      .catch(() =>
        setHistoryProblem(`“${word}” could not be removed from Recents. Try again in a moment.`),
      );
  }, []);

  useEffect(() => {
    const clear = () => {
      setStoredHistory([]);
      setRecentLookUps(new Map());
    };
    const removed = (event: Event) => {
      const { word } = (event as CustomEvent<{ word: string }>).detail;
      setStoredHistory((current) => current.filter((each) => each !== word));
      setRecentLookUps((current) => {
        const next = new Map(current);
        next.delete(word);
        return next;
      });
    };
    window.addEventListener(RECENTS_CLEARED_EVENT, clear);
    window.addEventListener(RECENT_REMOVED_EVENT, removed);
    return () => {
      window.removeEventListener(RECENTS_CLEARED_EVENT, clear);
      window.removeEventListener(RECENT_REMOVED_EVENT, removed);
    };
  }, []);

  // A word Look Up names starts a new search in the window (it was asked for as it came).
  useEffect(() => {
    if (asked.n === 0) return;
    setQuery(asked.word ?? "");
  }, [asked]);

  // The person's recent look-ups, listed while the search field is empty.
  useEffect(() => {
    let live = true;
    getJson(HISTORY_URL)
      .then((reply) => {
        if (live) setStoredHistory(historyFromServer(reply));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // The word list for what is typed, once typing rests.
  useEffect(() => {
    const prefix = lookUpWord(query);
    if (!prefix) {
      setSuggested([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      getJson(`${SUGGEST_URL}?prefix=${encodeURIComponent(prefix)}`)
        .then((reply) => {
          if (live) setSuggested(suggestionsFromServer(reply));
        })
        .catch(() => {});
    }, SUGGEST_PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  // The shown word's entry, once the choice rests. Every request for a word asks the module
  // again, even while an earlier one for it is on its way (the module answers a complete entry
  // from its shared cache, without asking any source), so the person's history records each
  // look-up in the order it was started and a source missing from an earlier answer can still
  // come. An entry already shown stays while it is asked for again; a failure gives way to
  // "Looking up".
  const fetchEntry = useCallback((word: string, leaveHistory = false) => {
    const quiet = leaveHistory || clearsUnderWay > 0;
    lookUps.current += 1;
    const started = lookUps.current;
    setArticles((current) => {
      const before = current.get(word);
      if (before?.status === undefined || before.status === NOT_FOUND) return current;
      const rest = new Map(current);
      rest.delete(word);
      return rest;
    });
    const asked = getJson(
      `${ENTRY_URL}?word=${encodeURIComponent(word)}${quiet ? "&history=0" : ""}`,
    )
      .then((reply) => {
        const entry = entryFromServer(reply);
        if (!entry) throw new Error("unreadable");
        // The recent list holds what the module kept in the person's history: only a look-up it
        // says it kept (`remembered: true`) is listed, at the place its start gives it, even when
        // a newer look-up of the word has answered first.
        const remembered = isRecord(reply) ? reply.remembered : undefined;
        if (!quiet && entry.status === undefined && remembered === true) {
          setRecentLookUps((current) =>
            (current.get(word) ?? 0) >= started ? current : new Map(current).set(word, started),
          );
        }
        // An older look-up of the word that answers after a newer one does not replace it.
        if ((answeredStart.current.get(word) ?? 0) > started) return;
        answeredStart.current.set(word, started);
        setArticles((current) => new Map(current).set(word, entry));
        // Only the newest look-up that answered says whether it was kept.
        if (started >= problemStart.current) {
          problemStart.current = started;
          setHistoryProblem(
            !quiet && entry.status === undefined && remembered !== true
              ? `“${word}” was looked up but not kept in your recent look-ups. It is kept the next time it is looked up.`
              : null,
          );
        }
      })
      .catch(() => {
        if ((answeredStart.current.get(word) ?? 0) > started) return;
        answeredStart.current.set(word, started);
        // The newest answer is a failure, shown in the entry; an older look-up's warning goes.
        if (started >= problemStart.current) {
          problemStart.current = started;
          setHistoryProblem(null);
        }
        setArticles((current) =>
          new Map(current).set(word, {
            word,
            status: "The dictionary could not be reached. Try again in a moment.",
          }),
        );
      })
      .finally(() => lookUpsOnTheirWay.delete(asked));
    if (!quiet) lookUpsOnTheirWay.add(asked);
  }, []);
  fetchNow.current = fetchEntry;
  useEffect(() => {
    const word = shown.word;
    if (!word) return;
    if (shown.now) {
      fetchEntry(word);
      return;
    }
    const armed = clearsStarted;
    const armedDuringClear = clearsUnderWay > 0;
    const timer = setTimeout(
      () => fetchEntry(word, armedDuringClear || clearsStarted !== armed),
      LOOK_UP_PAUSE_MS,
    );
    return () => clearTimeout(timer);
  }, [shown, fetchEntry]);

  const typed = lookUpWord(query);
  const [accent] = useDesktopSetting(ACCENT_KEY, readAccent, DEFAULT_ACCENT);
  const entries = useMemo(() => {
    const words = new Set<string>([...suggested, ...recent, ...articles.keys()]);
    if (typed) words.add(typed);
    for (const term of appleTermsFor(typed)) words.add(term);
    return [...words].map((word) => {
      const article = articles.get(word);
      return withAppleTerm(article ? inAccent(article, accent) : { word, status: LOOKING_UP });
    });
  }, [suggested, recent, articles, typed, accent]);

  return (
    <Dictionary
      {...props}
      entries={entries}
      recent={recent}
      onForgetRecents={forgetRecents}
      onForgetRecent={forgetRecent}
      notice={historyProblem}
      defaultQuery={opening}
      lookUpRequest={request}
      onQueryChange={(next) => {
        // Typing away from the word Look Up named makes it a word like any other again.
        if (lookUpWord(next) !== lookedUp.current) lookedUp.current = null;
        setQuery(next);
        onQueryChange?.(next);
      }}
      onLookUp={(word, chosen) => {
        // The word Look Up named was asked for as it came; a word chosen in the list is asked
        // for at once, one shown because of typing once typing rests.
        if (chosen || word === null || word !== lookedUp.current) show(word, chosen);
        onLookUp?.(word, chosen);
      }}
    />
  );
}

/** The demo window outside the Ferrite app, opening on the word Look Up named, if any. */
function StaticDictionary(props: DictionaryProps) {
  const [start] = useState(() => takePendingLookUp());
  const asked = useLookUps(start);
  const request = useLookUpRequest(asked);
  const [opening] = useState(() => start ?? props.defaultQuery);
  return <Dictionary {...props} defaultQuery={opening} lookUpRequest={request} />;
}

/**
 * Dictionary as the desktop shows it. When the `macalicious-desktop` Ferrite application serves
 * the desktop, what is typed is looked up in public sources through the application: the word
 * list comes from Datamuse's suggestions, and the entry of the shown word from Wiktionary (its
 * senses and examples), the Free Dictionary API (its pronunciation and a recording), Datamuse (the
 * thesaurus) and Wikipedia (the encyclopedia), each credited under the entry. The list shows the
 * person's recent look-ups while the field is empty. Every other build shows the demo's own
 * vocabulary, as `Dictionary` does. In both, Look Up (Control-Command-D) shows the selected text.
 */
export function DesktopDictionary(props: DictionaryProps) {
  return servedByDesktopApp() ? <ServedDictionary {...props} /> : <StaticDictionary {...props} />;
}
