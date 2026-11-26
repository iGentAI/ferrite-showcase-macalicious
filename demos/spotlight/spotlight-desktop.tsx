"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { Spotlight, SpotlightGroup, SpotlightResult } from "macalicious/spotlight";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ratesSourceText } from "../calculator/calculator-rates";
import type { DesktopApp } from "../desktop/desktop-apps";
import { AppTile } from "../desktop/desktop-artwork";
import { beginDesktopDrag } from "../desktop/desktop-drag";
import { entryOf, useDrive } from "../desktop/desktop-files";
import { requestHelp } from "../desktop/desktop-help";
import { openItem } from "../desktop/desktop-open-item";
import { openUrl } from "../desktop/desktop-open-url";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { askToReach } from "../desktop/desktop-reach";
import { servedByDesktopApp, sessionFetch, withDeadline } from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { followDrag } from "../desktop/desktop-spaces-bar";
import { kindOf, useDriveFile } from "../finder/finder-drive";
import { appForFile, openerName, requestOpenFile, showInFinder } from "../finder/finder-open";
import { families } from "../font-book/font-book-data";
import { type HelpTopic, topics as helpTopics } from "../help-viewer/help-viewer-data";
import { TILE_SIZE, tileUrl, toWorld } from "../maps/maps-geo";
import { askMapsSearch } from "../maps/maps-open";
import { dayName, degrees, sourceText, type WeatherAnswer } from "../maps/maps-weather";
import { webAddressFor } from "../safari/safari-web";
import { ACCOUNT_PANES, GRID_BANDS } from "../system-preferences/catalogue";
import { requestPane } from "../system-preferences/pane-request";
import { spotlightExcluded, spotlightPrivacy } from "../system-preferences/setting-effects";
import { type Conversion, convert, evaluate, formatNumber } from "./spotlight-calc";
import { useCurrencyAnswer } from "./spotlight-currency";
import { dragItemOf } from "./spotlight-drag";
import {
  boundHeight,
  boundPlace,
  HOME_PLACE,
  heightInRoom,
  LEAST_HEIGHT,
  readSpotlightPlace,
  SPOTLIGHT_PLACE,
  type SpotlightPlace,
} from "./spotlight-place";
import {
  isDeveloperFile,
  topHitOf,
  useNewsSuggestions,
  useStockSuggestion,
  useWeatherSuggestion,
} from "./spotlight-suggestions";

/** The search route of the desktop's Spotlight module (`ferrite-apps/desktop/src/apps/spotlight`). */
const SPOTLIGHT_SEARCH_URL = "/api/spotlight/search";
/** Dictionary's look-up route; `history=0` keeps Spotlight's look-ups out of Dictionary's History. */
const DICTIONARY_ENTRY_URL = "/api/dictionary/entry";

/** How long Spotlight waits after the last key before it asks the server. */
/** The longest query and the most words the server's search takes. */
const MAX_QUERY_CHARS = 200;
const MAX_WORDS = 8;
const SEARCH_PAUSE_MS = 200;
/** How often to ask while the index reads: enough for its 100 text files at a dozen per search. */
const MOST_ASKS = 12;

/** The kinds of result the server finds, in the order Spotlight lists them, with their labels. */
const DATA_KINDS = [
  ["contacts", "Contacts"],
  ["mail", "Mail Messages"],
  ["messages", "Messages"],
  ["facetime", "FaceTime"],
  ["events", "Events"],
  ["reminders", "Reminders"],
  ["notes", "Notes"],
  ["stickies", "Stickies"],
  ["documents", "Documents"],
  ["files", "Files"],
  ["web", "Bookmarks & History"],
  ["music", "Music"],
  ["photos", "Photos"],
  ["books", "Books"],
  ["podcasts", "Podcasts"],
  ["tv", "TV"],
  ["news", "Saved Stories"],
  ["stocks", "Watchlist"],
  ["places", "Places"],
  ["scenes", "Home Scenes"],
  ["devices", "Devices"],
  ["games", "Chess Games"],
] as const;

export type DataKind = (typeof DATA_KINDS)[number][0];

/** One item the server found in the person's data. */
export interface DataResult {
  kind: DataKind;
  /** The application that keeps the item, which Spotlight opens. */
  app: string;
  /** The item's id in its document (a web page's address). */
  id: string;
  title: string;
  detail: string;
  /** An instant in epoch milliseconds: an event's start, a photo's day, a visit, a change. */
  at?: number;
  /** A contact's phone numbers and addresses, for its card. */
  lines?: readonly string[];
  /** The account a one-to-one conversation is with. */
  to?: string;
  /** Where a kept place is, for its map. */
  lat?: number;
  lon?: number;
}

/** What the server found for one query. */
export interface DataSearch {
  query: string;
  results: readonly DataResult[];
  /** Some kind had more results than the server lists. */
  truncated: boolean;
  /** Some text files of the drive are still being read for the index. */
  indexing: boolean;
  /** Text files past the index's limit, whose words no search reads; their names are searched. */
  unsearchedFiles: number;
  /** How many of the person's newest Mail messages the server searched. */
  searchedMail: number;
  /**
   * Older Mail messages were not searched: the server reads the newest 200, and about 1 MB of
   * their headers at most (`MAIL_HEADERS`, `MAIL_SCAN_BYTES` in its module).
   */
  unsearchedMail: boolean;
}

const KINDS = new Set<string>(DATA_KINDS.map(([kind]) => kind));

/** Which of System Preferences' Search Results categories each kind of result belongs to. */
const KIND_CATEGORY: Readonly<Record<DataKind, string>> = {
  contacts: "Contacts",
  mail: "Mail & Messages",
  messages: "Mail & Messages",
  facetime: "Contacts",
  books: "Documents",
  events: "Events & Reminders",
  reminders: "Events & Reminders",
  notes: "Documents",
  stickies: "Documents",
  documents: "Documents",
  files: "Documents",
  podcasts: "Music",
  tv: "Movies",
  news: "Documents",
  stocks: "Other",
  places: "Other",
  scenes: "Other",
  devices: "Other",
  games: "Other",
  web: "Bookmarks & History",
  music: "Music",
  photos: "Images",
};

const isResult = (value: unknown): value is DataResult => {
  const result = value as Record<string, unknown> | null;
  return (
    typeof result === "object" &&
    result !== null &&
    typeof result.kind === "string" &&
    KINDS.has(result.kind) &&
    typeof result.app === "string" &&
    typeof result.id === "string" &&
    typeof result.title === "string" &&
    typeof result.detail === "string" &&
    (result.at === undefined || (typeof result.at === "number" && Number.isFinite(result.at))) &&
    (result.lines === undefined ||
      (Array.isArray(result.lines) && result.lines.every((line) => typeof line === "string"))) &&
    (result.to === undefined || typeof result.to === "string") &&
    (result.lat === undefined || typeof result.lat === "number") &&
    (result.lon === undefined || typeof result.lon === "number")
  );
};

/** The search of a reply, or `undefined` when it is not the module's. */
export function searchFromServer(reply: unknown): DataSearch | undefined {
  const body = reply as Record<string, unknown> | null;
  if (
    typeof body !== "object" ||
    body === null ||
    typeof body.query !== "string" ||
    !Array.isArray(body.results)
  )
    return undefined;
  return {
    query: body.query,
    results: body.results.filter(isResult),
    truncated: body.truncated === true,
    indexing: body.indexing === true,
    unsearchedFiles:
      Number.isSafeInteger(body.unsearched_files) && (body.unsearched_files as number) > 0
        ? (body.unsearched_files as number)
        : 0,
    searchedMail:
      Number.isSafeInteger(body.searched_mail) && (body.searched_mail as number) >= 0
        ? (body.searched_mail as number)
        : 0,
    unsearchedMail: body.unsearched_mail === true,
  };
}

/**
 * What Spotlight says under its results when the server left older Mail messages unsearched, or
 * `undefined` when it searched them all.
 */
export function mailNote(
  found: Pick<DataSearch, "searchedMail" | "unsearchedMail">,
): string | undefined {
  if (!found.unsearchedMail) return undefined;
  if (found.searchedMail === 0) return "Mail: no messages were searched.";
  return found.searchedMail === 1
    ? "Mail: only your newest message was searched."
    : `Mail: only your newest ${found.searchedMail} messages were searched.`;
}

/**
 * What Spotlight says under its results when it did not look at everything: older Mail left
 * unsearched, text files whose words no search reads, or the index still reading.
 */
export function searchNote(
  found: Pick<DataSearch, "searchedMail" | "unsearchedMail" | "unsearchedFiles" | "indexing">,
): string | undefined {
  const notes = [
    mailNote(found),
    found.unsearchedFiles > 0
      ? `Files: the words of ${found.unsearchedFiles} text ${found.unsearchedFiles === 1 ? "file were" : "files were"} not searched, only the names.`
      : undefined,
    found.indexing ? "Files: still reading your text files." : undefined,
  ].filter(Boolean);
  return notes.length > 0 ? notes.join(" ") : undefined;
}

/** The value of a data result in Spotlight's list: unique beside the applications' ids. */
const resultValue = (result: DataResult) => `${result.kind}:${result.id}`;

/** The results grouped by kind, in the order of `DATA_KINDS`, without empty groups. */
export function groupResults(
  results: readonly DataResult[],
): { kind: string; label: string; results: DataResult[] }[] {
  return DATA_KINDS.flatMap<{ kind: string; label: string; results: DataResult[] }>(
    ([kind, label]) => {
      const inside = results.filter((result) => result.kind === kind);
      if (kind !== "files") return [{ kind, label, results: inside }];
      // Files by what they are, as a Mac lists them; the rest under Files.
      const named = FILE_KINDS.map(([fileKind, fileLabel]) => ({
        kind: fileKind,
        label: fileLabel,
        results: inside.filter((result) => fileKindOf(result.title) === fileKind),
      }));
      const taken = new Set(named.flatMap((group) => group.results));
      const presentations = {
        kind: "presentation",
        label: "Presentations",
        results: inside.filter((result) => !taken.has(result) && PRESENTATION.test(result.title)),
      };
      for (const result of presentations.results) taken.add(result);
      const developer = {
        kind: "developer",
        label: "Developer",
        results: inside.filter((result) => !taken.has(result) && isDeveloperFile(result.title)),
      };
      for (const result of developer.results) taken.add(result);
      return [
        { kind, label, results: inside.filter((result) => !taken.has(result)) },
        ...named,
        presentations,
        developer,
      ];
    },
  ).filter((group) => group.results.length > 0);
}

const fileKindOf = (name: string) => kindOf({ kind: "file", name, type: "" });

/** The kinds of file that have a group of their own. */
const FILE_KINDS = [
  ["image", "Images"],
  ["pdf", "PDF Documents"],
  ["movie", "Movies"],
  ["audio", "Music Files"],
] as const;

/** Presentations by their name: the drive has no kind for them. */
const PRESENTATION = /\.(?:key|odp|pps|ppsx|ppt|pptx)$/i;

/** A result's instant as the preview writes it, in the browser's own time zone. */
export function instantText(result: Pick<DataResult, "kind" | "at">): string | undefined {
  if (result.at === undefined) return undefined;
  const date = new Date(result.at);
  if (result.kind === "events") {
    return date.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });
  }
  const prefix =
    result.kind === "photos"
      ? "Taken "
      : result.kind === "web"
        ? "Visited "
        : result.kind === "mail"
          ? "Received "
          : result.kind === "news"
            ? "Published "
            : result.kind === "games"
              ? "Started "
              : result.kind === "messages"
                ? "Sent "
                : result.kind === "facetime"
                  ? "Called "
                  : result.kind === "books"
                    ? "Added "
                    : "Modified ";
  return `${prefix}${date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`;
}

/**
 * What the server finds for `query` in the person's data, when the desktop is served by the
 * `macalicious-desktop` Ferrite application: asked `SEARCH_PAUSE_MS` after the last change, and
 * only results for the current text are returned (an older query's late reply is dropped). While
 * the index is still reading text files, the same text is asked again a moment later. Every
 * other build asks nothing and finds nothing.
 */
function useDataSearch(query: string): DataSearch | null {
  const [found, setFound] = useState<DataSearch | null>(null);
  const text = query.trim();
  useEffect(() => {
    // The server refuses a longer query (`MAX_QUERY_CHARS`, `MAX_WORDS` in its module).
    const tooLong = text.length > MAX_QUERY_CHARS || text.split(/\s+/).length > MAX_WORDS;
    if (!servedByDesktopApp() || text === "" || tooLong) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const ask = (asked: number) => {
      withDeadline(async (signal) => {
        const response = await sessionFetch(
          `${SPOTLIGHT_SEARCH_URL}?q=${encodeURIComponent(text)}`,
          { credentials: "same-origin", headers: { accept: "application/json" }, signal },
        );
        return response.ok ? searchFromServer(await response.json()) : undefined;
      })
        .catch(() => undefined)
        .then((read) => {
          if (!live || !read) return;
          setFound(read);
          // The index reads a few text files per search: ask again for the rest.
          if (read.indexing && asked + 1 < MOST_ASKS) timer = setTimeout(() => ask(asked + 1), 800);
        });
    };
    timer = setTimeout(() => ask(0), SEARCH_PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text]);
  return found && found.query === text ? found : null;
}

/** A definition Dictionary gives for one word. */
export interface Definition {
  word: string;
  part: string;
  text: string;
}

/** The first definition of a Dictionary entry reply, or `undefined`. */
export function definitionFromServer(reply: unknown): Definition | undefined {
  const body = reply as {
    word?: unknown;
    found?: unknown;
    dictionary?: { parts?: { part?: unknown; senses?: { text?: unknown }[] }[] } | null;
  } | null;
  if (body?.found !== true || typeof body.word !== "string") return undefined;
  for (const part of body.dictionary?.parts ?? []) {
    const sense = part.senses?.find((candidate) => typeof candidate.text === "string");
    if (sense && typeof sense.text === "string" && sense.text.trim() !== "") {
      return {
        word: body.word,
        part: typeof part.part === "string" ? part.part : "",
        text: sense.text.trim(),
      };
    }
  }
  return undefined;
}

/** Whether Spotlight looks a query up in Dictionary: one word of letters, three or more. */
const definable = (text: string) => /^\p{L}[\p{L}'-]{2,39}$/u.test(text.trim());

/** Dictionary's first definition of `word`, when it has one. */
export async function definitionOf(word: string): Promise<Definition | undefined> {
  return withDeadline(async (signal) => {
    const response = await sessionFetch(
      `${DICTIONARY_ENTRY_URL}?word=${encodeURIComponent(word)}&history=0`,
      { credentials: "same-origin", headers: { accept: "application/json" }, signal },
    );
    return response.ok ? definitionFromServer(await response.json()) : undefined;
  });
}

/**
 * Dictionary's first definition of a one-word query, asked a moment after typing pauses, when the
 * desktop's Ferrite application serves the page. A Dictionary that is not there (404) or cannot
 * answer gives nothing.
 */
function useDefinition(query: string, enabled: boolean): Definition | null {
  const [found, setFound] = useState<Definition | null>(null);
  const word = query.trim();
  useEffect(() => {
    if (!enabled || !servedByDesktopApp() || !definable(word)) return;
    let live = true;
    const timer = setTimeout(() => {
      definitionOf(word)
        .catch(() => undefined)
        .then((read) => {
          if (live && read) setFound(read);
        });
    }, SEARCH_PAUSE_MS * 2);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [word, enabled]);
  return found && found.word.toLowerCase() === word.toLowerCase() ? found : null;
}

export interface SpotlightSearchPanelProps {
  /** The applications of the desktop: Spotlight searches their names. */
  apps: readonly DesktopApp[];
  /** Open an application, or bring it to the front. */
  launch: (id: string) => void;
  onClose: () => void;
  /**
   * What was being searched for when Spotlight last closed without opening anything: it comes back
   * for a minute. The desktop holds it, so it ends with the person's desktop.
   */
  keptQuery?: RefObject<SpotlightKeptQuery>;
}

export interface SpotlightKeptQuery {
  query: string;
  at: number;
}

const CALC_VALUE = "calculator:result";

/** What Spotlight says when it has no reading to show. */
function weatherSentence(weather: Exclude<WeatherAnswer, { kind: "read" }>): string {
  if (weather.kind === "no-place") {
    return "Name a place, or choose one in the Weather widget in Notification Center.";
  }
  return weather.kind === "not-found"
    ? `No place is called “${weather.name}”.`
    : `The weather isn’t available. ${weather.problem}`;
}

const CONVERT_VALUE = "conversion:result";
const FONT_VALUE = "font:";
const STOCK_VALUE = "stocks:quote";
const WEATHER_VALUE = "weather:reading";
const NEWS_VALUE = "news:";
const MAPS_VALUE = "maps:search";
const MOST_FONTS = 5;
const matchingFonts = (text: string) =>
  families.filter((family) => family.name.toLowerCase().includes(text)).slice(0, MOST_FONTS);
const DEFINE_VALUE = "dictionary:definition";
const HELP_VALUE = "help:";
const MOST_HELP = 5;
/** Help's topics by their titles, whichever guide they are in. */
const matchingHelp = (text: string): readonly HelpTopic[] =>
  helpTopics.filter((topic) => topic.title.toLowerCase().includes(text)).slice(0, MOST_HELP);
/** How close the map of a kept place stands: its streets. */
const MAP_ZOOM = 15;
const WEB_VALUE = "web:search";
const SHOW_ALL_VALUE = "finder:show-all";
const PANE_VALUE = "pane:";
const KEPT_MS = 60_000;
const EVERY_PANE = [...ACCOUNT_PANES, ...GRID_BANDS.flat()];

const copy = (text: string) => {
  void copyText(text);
};

/** A file's own picture or words in the preview. */
function FileContents({ result }: { result: DataResult }) {
  const kind = fileKindOf(result.title);
  const shows = kind === "image" || kind === "document";
  const file = useDriveFile(result.id, kind, shows);
  if (!shows || !file || file instanceof Error) return null;
  if (kind === "image") {
    return (
      <img className="mac-desktop-shell-spotlight-picture" src={file.url} alt={result.title} />
    );
  }
  return file.text ? (
    <pre className="mac-desktop-shell-spotlight-words">{file.text.slice(0, 600)}</pre>
  ) : null;
}

/** The map tile around a kept place, with a mark where it is. */
export function PlaceMap({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const [failed, setFailed] = useState(false);
  const { x, y } = toWorld({ lat, lon }, MAP_ZOOM);
  if (failed) return null;
  return (
    <div
      className="mac-desktop-shell-spotlight-map"
      style={{ position: "relative", width: TILE_SIZE, height: TILE_SIZE, overflow: "hidden" }}
    >
      <img
        src={tileUrl(MAP_ZOOM, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE))}
        alt={`Map of ${name}`}
        width={TILE_SIZE}
        height={TILE_SIZE}
        onError={() => setFailed(true)}
      />
      <i
        aria-hidden="true"
        style={{
          position: "absolute",
          left: x % TILE_SIZE,
          top: y % TILE_SIZE,
          width: 12,
          height: 12,
          margin: -6,
          borderRadius: "50%",
          background: "var(--mac-color-system-red)",
        }}
      />
    </div>
  );
}

/**
 * Spotlight over the desktop: sums and unit conversions worked out as they are typed, the
 * applications whose names hold what is typed, and, when the desktop is served by the
 * `macalicious-desktop` Ferrite application, the person's own things (Contacts, Calendar,
 * Reminders, Notes, Stickies, TextEdit, the drive's files and their words, Safari's bookmarks and
 * history, Music, Photos, their Messages conversations, FaceTime's recent calls and Books), Help's
 * topics, a Dictionary definition and a web search that opens in Safari.
 * The first result is selected, so Return opens it. A press beside the window closes it.
 */
/** Where a window opens by itself in its layer: where it stands, less how far it has been moved. */
function homeOf(frame: HTMLElement, room: DOMRect) {
  const box = frame.getBoundingClientRect();
  const [x = 0, y = 0] = frame.style.translate.split(" ").map(Number.parseFloat);
  return { left: box.left - room.left - x, top: box.top - room.top - y, width: box.width };
}

/** How much room stays under the window's bottom edge, to take hold of it again. */
const EDGE_ROOM = 12;

/** The most its results can stand under a top edge this far down the screen, clear of the Dock. */
function roomUnder(frame: Element, top: number) {
  const room = frame.closest(".mac-desktop-shell-spotlight");
  const dock = room?.parentElement?.querySelector(".mac-desktop-shell-dock");
  const floor = Math.min(
    room?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
    dock?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
  );
  return floor - top - EDGE_ROOM;
}

/** The furthest down a move can take the window: its results can still be as short as they go, clear of the Dock. */
function lowestPlace(frame: HTMLElement, room: DOMRect, home: { top: number }) {
  const field = frame.querySelector(".mac-spotlight-field")?.getBoundingClientRect().height ?? 0;
  return roomUnder(frame, room.top + home.top + field) - LEAST_HEIGHT;
}

export function SpotlightSearchPanel({
  apps,
  launch,
  onClose,
  keptQuery,
}: SpotlightSearchPanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(() =>
    keptQuery && Date.now() - keptQuery.current.at < KEPT_MS ? keptQuery.current.query : "",
  );
  const [picked, setPicked] = useState<string | null>(null);
  // An address Safari would refuse, which a bookmark can hold: shown in place of the preview until
  // the query changes.
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const latestQuery = useRef(query);
  latestQuery.current = query;
  const [keptPlace, setKeptPlace] = useDesktopSetting(
    SPOTLIGHT_PLACE,
    readSpotlightPlace,
    HOME_PLACE,
  );
  // While it moves; kept once it is let go, and a cancelled drag leaves it where it was.
  const [movingPlace, setMovingPlace] = useState<SpotlightPlace | null>(null);
  // Where a place kept on a larger screen stands on this one. The kept place is left as it was.
  const [fittedPlace, setFittedPlace] = useState<SpotlightPlace | null>(null);
  const place = movingPlace ?? fittedPlace ?? keptPlace;
  const frameRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fitFrame = () => {
      const frame = frameRef.current;
      const room = frame?.parentElement?.getBoundingClientRect();
      if (!frame || !room?.width) return;
      const home = homeOf(frame, room);
      const next = boundPlace(keptPlace, home, room, lowestPlace(frame, room, home));
      const field =
        frame.querySelector(".mac-spotlight-field")?.getBoundingClientRect().height ?? 0;
      const height = heightInRoom(
        keptPlace.height,
        roomUnder(frame, room.top + home.top + next.y + field),
      );
      setFittedPlace(
        next.x === keptPlace.x && next.y === keptPlace.y && height === keptPlace.height
          ? null
          : { ...next, height },
      );
    };
    fitFrame();
    window.addEventListener("resize", fitFrame);
    return () => window.removeEventListener("resize", fitFrame);
  }, [keptPlace]);
  const follow = (
    down: PointerEvent<HTMLElement>,
    placeAt: (dx: number, dy: number) => SpotlightPlace,
    keep: (shown: SpotlightPlace) => SpotlightPlace = (shown) => shown,
  ) => {
    down.preventDefault();
    const at = ({ clientX, clientY }: { clientX: number; clientY: number }) =>
      placeAt(clientX - down.clientX, clientY - down.clientY);
    followDrag(
      down,
      (move) => setMovingPlace(at(move)),
      (up, started) => {
        setMovingPlace(null);
        if (up && started) setKeptPlace(keep(at(up)));
        input.current?.focus();
      },
    );
  };
  /** A press on the field moves the window, except in text there is to select. */
  const moveFrom = (down: PointerEvent<HTMLElement>) => {
    const target = down.target as Element;
    if (down.button !== 0 || !target.closest(".mac-spotlight-field")) return;
    if (target.closest("input") && latestQuery.current !== "") return;
    const frame = down.currentTarget.parentElement;
    const room = frame?.parentElement?.getBoundingClientRect();
    if (!frame || !room) return;
    const home = homeOf(frame, room);
    const from = place;
    const lowest = lowestPlace(frame, room, home);
    follow(
      down,
      (dx, dy) => boundPlace({ ...from, x: from.x + dx, y: from.y + dy }, home, room, lowest),
      ({ x, y }) => ({ ...keptPlace, x, y }),
    );
  };
  const resizeFrom = (down: PointerEvent<HTMLElement>) => {
    if (down.button !== 0) return;
    const body =
      down.currentTarget.parentElement?.querySelector<HTMLElement>(".mac-spotlight-body");
    if (!body) return;
    const from = body.offsetHeight;
    const most = roomUnder(down.currentTarget, body.getBoundingClientRect().top);
    follow(
      down,
      (_, dy) => ({ ...place, height: boundHeight(from + dy, most) }),
      ({ height }) => ({ ...keptPlace, height }),
    );
  };
  const chose = useRef(false);
  useEffect(
    () => () => {
      if (keptQuery) {
        keptQuery.current = { query: chose.current ? "" : latestQuery.current, at: Date.now() };
      }
    },
    [keptQuery],
  );
  const leave = () => {
    chose.current = true;
    onClose();
  };

  const trimmed = query.trim();
  const text = trimmed.toLowerCase();
  const excluded = spotlightExcluded();
  const on = (category: string) => !excluded.includes(category);
  const sum = on("Calculator") ? evaluate(trimmed) : undefined;
  const units: Conversion | undefined =
    sum === undefined && on("Conversion") ? convert(trimmed) : undefined;
  const money = useCurrencyAnswer(
    trimmed,
    servedByDesktopApp() && on("Conversion") && sum === undefined && !units,
  );
  const conversion = units ?? (money?.kind === "converted" ? money.conversion : undefined);
  const worked = sum !== undefined || conversion !== undefined;
  const found =
    text && on("Applications") ? apps.filter((app) => app.name.toLowerCase().includes(text)) : [];
  const panes =
    text && on("System Preferences")
      ? EVERY_PANE.filter((pane) => pane.name.toLowerCase().includes(text))
      : [];
  // A query that reads as a sum (a phone number, a date) still finds the person's things.
  const data = useDataSearch(query);
  const definition = useDefinition(query, !worked && on("Definition"));
  const privacy = spotlightPrivacy();
  const drive = useDrive(privacy.length > 0);
  // A folder of Privacy keeps its files out, at any depth.
  const keptOut = (id: string) => {
    // Until the drive has been read, nothing shows that a folder may be keeping out.
    if (privacy.length > 0 && !drive) return true;
    for (let at = drive ? entryOf(drive, id) : undefined; at && drive; ) {
      if (privacy.includes(at.id)) return true;
      at = at.parent ? entryOf(drive, at.parent) : undefined;
    }
    return false;
  };
  const groups = groupResults(
    (data?.results ?? []).filter(
      (result) =>
        on(KIND_CATEGORY[result.kind]) && !(result.kind === "files" && keptOut(result.id)),
    ),
  );
  const dataResults = groups.flatMap((group) => group.results);
  const fonts = text && on("Fonts") ? matchingFonts(text) : [];
  const help = text.length > 1 && on("Other") ? matchingHelp(text) : [];
  const served = servedByDesktopApp();
  const webSearch = served && trimmed !== "" && !worked;
  const suggesting = served && on("Siri Suggestions");
  const stock = useStockSuggestion(trimmed, suggesting);
  const weather = useWeatherSuggestion(trimmed, suggesting && !worked);
  const news = useNewsSuggestions(
    trimmed,
    suggesting && !worked && apps.some((app) => app.id === "news"),
  );
  const mapsSearch = webSearch && suggesting;
  const showAll = served && dataResults.some((result) => result.kind === "files");
  const appName = (id: string) => apps.find((app) => app.id === id)?.name ?? id;

  const listed = [
    ...found.map((app) => ({ value: app.id, title: app.name })),
    ...panes.map((pane) => ({ value: PANE_VALUE + pane.id, title: pane.name })),
    ...dataResults.map((result) => ({ value: resultValue(result), title: result.title })),
    ...fonts.map((font) => ({ value: FONT_VALUE + font.id, title: font.name })),
  ];
  const top = topHitOf(text, listed);

  // Every value in the order listed: the first is selected until another is chosen.
  const values = [
    ...(sum !== undefined ? [CALC_VALUE] : []),
    ...(conversion || money ? [CONVERT_VALUE] : []),
    ...(top ? [top] : []),
    ...listed.map(({ value }) => value).filter((value) => value !== top),
    ...help.map((topic) => HELP_VALUE + topic.id),
    ...(definition ? [DEFINE_VALUE] : []),
    ...(stock ? [STOCK_VALUE] : []),
    ...(weather ? [WEATHER_VALUE] : []),
    ...news.map((story) => NEWS_VALUE + story.id),
    ...(webSearch ? [WEB_VALUE] : []),
    ...(mapsSearch ? [MAPS_VALUE] : []),
    ...(showAll ? [SHOW_ALL_VALUE] : []),
  ];
  const selectedValue = picked !== null && values.includes(picked) ? picked : (values[0] ?? null);
  const selectedApp = found.find((app) => app.id === selectedValue);
  const selectedPane = panes.find((pane) => PANE_VALUE + pane.id === selectedValue);
  const selectedData = dataResults.find((result) => resultValue(result) === selectedValue);
  const selectedFont = fonts.find((font) => FONT_VALUE + font.id === selectedValue);
  const selectedStory = news.find((story) => NEWS_VALUE + story.id === selectedValue);
  const selectedHelp = help.find((topic) => HELP_VALUE + topic.id === selectedValue);
  const sumText = sum === undefined ? "" : formatNumber(sum);

  // A Safari window takes the address itself (`desktop-open-url.ts`): as a new tab of the one open,
  // or as the tab a new one opens with. Safari says if it is full.
  const toSafari = (address: string) => {
    if (openUrl(address, "spotlight") === null) {
      setFailure("Safari can’t open this address.");
      return;
    }
    leave();
  };

  const open = (value: string, { reveal }: { reveal: boolean }) => {
    if (value === CALC_VALUE) {
      copy(sumText);
      launch("calculator");
    } else if (value === CONVERT_VALUE) {
      if (conversion) copy(formatNumber(conversion.result));
    } else if (value === DEFINE_VALUE) {
      if (definition) {
        openItem({ app: "dictionary", id: definition.word, title: definition.word });
      }
      launch("dictionary");
    } else if (value === SHOW_ALL_VALUE) {
      showInFinder({ show: "find", query: trimmed });
    } else if (value === MAPS_VALUE) {
      askMapsSearch(trimmed);
      launch("maps");
    } else if (value === STOCK_VALUE) {
      launch("stocks");
    } else if (value === WEATHER_VALUE) {
      if (weather?.kind === "read") {
        const { name, country } = weather.place;
        askMapsSearch(country ? `${name}, ${country}` : name);
        launch("maps");
      } else return;
    } else if (value.startsWith(NEWS_VALUE)) {
      const link = news.find((story) => NEWS_VALUE + story.id === value)?.link;
      if (link) {
        toSafari(link);
        return;
      }
      launch("news");
    } else if (value.startsWith(HELP_VALUE)) {
      requestHelp(help.find((topic) => HELP_VALUE + topic.id === value)?.title ?? trimmed);
    } else if (value.startsWith(FONT_VALUE)) {
      const id = value.slice(FONT_VALUE.length);
      openItem({ app: "font-book", id, title: id });
      launch("font-book");
    } else if (value === WEB_VALUE) {
      toSafari(webAddressFor(trimmed));
      return;
    } else if (value.startsWith(PANE_VALUE)) {
      requestPane(value.slice(PANE_VALUE.length));
      launch("system-preferences");
    } else {
      const result = dataResults.find((candidate) => resultValue(candidate) === value);
      if (result?.kind === "web") {
        toSafari(result.id);
        return;
      }
      if (result?.kind === "messages" && result.to) {
        askToReach({ app: "messages", to: result.to, name: result.title });
      } else if (result?.kind === "files") {
        // A document opens in the application that works with it; anything else, or any file with
        // Command held, shows in Finder, selected.
        const app = reveal ? "finder" : (appForFile({ name: result.title }) ?? "finder");
        requestOpenFile({ app, id: result.id, name: result.title });
        launch(app);
      } else if (result) {
        openItem({ app: result.app, id: result.id, title: result.title });
        launch(result.app);
      } else if (reveal) {
        const app = apps.find((candidate) => candidate.id === value);
        requestOpenFile({
          app: "finder",
          id: "",
          name: app?.name ?? value,
          place: "/Applications",
        });
        launch("finder");
      } else {
        launch(value);
      }
    }
    leave();
  };

  // Command-I and -C act on what is selected, Command-L and -B on what was typed, as on a Mac.
  // Command-C with text selected in the field is the field's.
  const onKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (matchesMenuKeyEquivalent(event, "command+i") && selectedData?.kind === "files") {
      event.preventDefault();
      showInFinder({ id: selectedData.id, show: "info" });
      leave();
    } else if (matchesMenuKeyEquivalent(event, "command+l") && trimmed) {
      event.preventDefault();
      openItem({ app: "dictionary", id: trimmed, title: trimmed });
      launch("dictionary");
      leave();
    } else if (matchesMenuKeyEquivalent(event, "command+b") && trimmed) {
      event.preventDefault();
      toSafari(webAddressFor(trimmed));
    } else if (matchesMenuKeyEquivalent(event, "command+c")) {
      const field = input.current;
      if (field && field.selectionStart !== field.selectionEnd) return;
      const text =
        selectedValue === CALC_VALUE
          ? sumText
          : conversion && selectedValue === CONVERT_VALUE
            ? formatNumber(conversion.result)
            : (selectedApp?.name ??
              selectedPane?.name ??
              selectedData?.title ??
              selectedHelp?.title);
      if (!text) return;
      event.preventDefault();
      copy(text);
    }
  };

  const preview = (() => {
    if (failure) {
      return (
        <div className="mac-desktop-shell-spotlight-preview" role="alert">
          <span>
            <AppTile id="safari" name={appName("safari")} />
          </span>
          <strong>Not Opened in Safari</strong>
          <p>{failure}</p>
        </div>
      );
    }
    if (selectedValue === CALC_VALUE) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="calculator" name="Calculator" />
          </span>
          <strong>{sumText}</strong>
          <p>{trimmed} =</p>
          <p>Return copies the result and opens Calculator</p>
        </div>
      );
    }
    if (selectedValue === CONVERT_VALUE && conversion) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <strong>{conversion.answer}</strong>
          <p>{conversion.text}</p>
          {money?.kind === "converted" ? <p>{ratesSourceText(money.rates)}</p> : null}
          {money?.kind === "converted" && money.rates.stale ? (
            <p>These are not the latest rates. {money.rates.stale}</p>
          ) : null}
          <p>Return copies the result</p>
        </div>
      );
    }
    if (selectedValue === CONVERT_VALUE && money?.kind === "failed") {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <strong>Exchange rates aren’t available</strong>
          <p>{money.problem}</p>
        </div>
      );
    }
    if (selectedValue === WEATHER_VALUE && weather) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          {weather.kind === "read" ? (
            <>
              <strong>{`${weather.place.name} ${degrees(weather.forecast.temperature_c)}`}</strong>
              <p>{weather.forecast.condition}</p>
              {weather.forecast.days.slice(0, 4).map((day) => (
                <p key={day.date}>
                  {`${dayName(day.date)}: ${degrees(day.high_c)} / ${degrees(day.low_c)}, ${day.condition}`}
                </p>
              ))}
              <p>{sourceText(weather.forecast)}</p>
              <p>Opens in {appName("maps")}</p>
            </>
          ) : (
            <>
              <strong>Weather</strong>
              <p>{weatherSentence(weather)}</p>
            </>
          )}
        </div>
      );
    }
    if (selectedValue === DEFINE_VALUE && definition) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="dictionary" name={appName("dictionary")} />
          </span>
          <strong>{definition.word}</strong>
          {definition.part ? <p>{definition.part}</p> : null}
          <p>{definition.text}</p>
          <p>Opens in Dictionary</p>
        </div>
      );
    }
    if (selectedValue === WEB_VALUE) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="safari" name={appName("safari")} />
          </span>
          <strong>Search the Web</strong>
          <p>“{trimmed}” opens in a new Safari tab</p>
        </div>
      );
    }
    if (selectedValue === MAPS_VALUE) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="maps" name={appName("maps")} />
          </span>
          <strong>Search Maps</strong>
          <p>“{trimmed}” opens as a search in Maps</p>
        </div>
      );
    }
    if (selectedValue === STOCK_VALUE && stock) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="stocks" name={appName("stocks")} />
          </span>
          <strong>{stock.symbol}</strong>
          <p>
            {stock.price.toFixed(2)}, {stock.change < 0 ? "down" : "up"}{" "}
            {Math.abs(stock.change).toFixed(2)}
          </p>
          <p>Opens in {appName("stocks")}</p>
        </div>
      );
    }
    if (selectedStory) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="news" name={appName("news")} />
          </span>
          <strong>{selectedStory.title}</strong>
          <p>{selectedStory.publisher}</p>
          <p>
            {selectedStory.link ? "Opens at the publisher in Safari" : `Opens ${appName("news")}`}
          </p>
        </div>
      );
    }
    if (selectedFont) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="font-book" name={appName("font-book")} />
          </span>
          <strong style={{ fontFamily: selectedFont.stack }}>{selectedFont.name}</strong>
          <p>Opens in {appName("font-book")}</p>
        </div>
      );
    }
    if (selectedValue === SHOW_ALL_VALUE) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="finder" name="Finder" />
          </span>
          <strong>Show All in Finder</strong>
          <p>“{trimmed}” opens as a search in a Finder window</p>
        </div>
      );
    }
    if (selectedApp) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id={selectedApp.id} name={selectedApp.name} />
          </span>
          <strong>{selectedApp.name}</strong>
        </div>
      );
    }
    if (selectedPane) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="system-preferences" name={appName("system-preferences")} />
          </span>
          <strong>{selectedPane.name}</strong>
          <p>Opens in System Preferences</p>
        </div>
      );
    }
    if (selectedHelp) {
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id="help-viewer" name={appName("help-viewer")} />
          </span>
          <strong>{selectedHelp.title}</strong>
          <p>{selectedHelp.summary}</p>
          <p>{selectedHelp.source}</p>
          <p>Opens in {appName("help-viewer")}</p>
        </div>
      );
    }
    if (selectedData) {
      const when = instantText(selectedData);
      const fileApp =
        selectedData.kind === "files" ? appForFile({ name: selectedData.title }) : undefined;
      const opener =
        selectedData.kind === "files"
          ? fileApp
            ? `Opens in ${openerName(fileApp)}`
            : "Shows in Finder"
          : `Opens in ${appName(selectedData.app)}`;
      return (
        <div className="mac-desktop-shell-spotlight-preview">
          <span>
            <AppTile id={selectedData.app} name={appName(selectedData.app)} />
          </span>
          <strong>{selectedData.title}</strong>
          {selectedData.kind === "files" ? (
            <FileContents key={selectedData.id} result={selectedData} />
          ) : null}
          {selectedData.lat !== undefined && selectedData.lon !== undefined ? (
            <PlaceMap
              key={selectedData.id}
              lat={selectedData.lat}
              lon={selectedData.lon}
              name={selectedData.title}
            />
          ) : null}
          {when ? <p>{when}</p> : null}
          {selectedData.lines && selectedData.lines.length > 0 ? (
            selectedData.lines.map((line) => <p key={line}>{line}</p>)
          ) : selectedData.detail ? (
            <p>{selectedData.detail}</p>
          ) : null}
          <p>{opener}</p>
        </div>
      );
    }
    return null;
  })();

  const completion =
    selectedApp?.name ??
    selectedPane?.name ??
    selectedData?.title ??
    selectedFont?.name ??
    selectedHelp?.title ??
    (selectedValue === DEFINE_VALUE ? definition?.word : undefined);

  const appRow = (app: DesktopApp) => (
    <SpotlightResult key={app.id} value={app.id} icon={<AppTile id={app.id} name={app.name} />}>
      {app.name}
    </SpotlightResult>
  );
  const paneRow = (pane: (typeof EVERY_PANE)[number]) => (
    <SpotlightResult
      key={pane.id}
      value={PANE_VALUE + pane.id}
      icon={<AppTile id="system-preferences" name={appName("system-preferences")} />}
    >
      {pane.name}
    </SpotlightResult>
  );
  const dataRow = (result: DataResult) => {
    const dragged = dragItemOf(result);
    return (
      <SpotlightResult
        key={resultValue(result)}
        value={resultValue(result)}
        icon={<AppTile id={result.app} name={appName(result.app)} />}
        onPointerDown={
          dragged
            ? (event) => {
                if (event.button !== 0) return;
                beginDesktopDrag(event.nativeEvent, {
                  from: "spotlight",
                  items: () => [dragged],
                  // Out of the way of what it is dragged to.
                  onStart: leave,
                });
              }
            : undefined
        }
      >
        {result.title}
      </SpotlightResult>
    );
  };
  const fontRow = (font: (typeof fonts)[number]) => (
    <SpotlightResult
      key={font.id}
      value={FONT_VALUE + font.id}
      icon={<AppTile id="font-book" name={appName("font-book")} />}
    >
      {font.name}
    </SpotlightResult>
  );
  const topApp = found.find((app) => app.id === top);
  const topPane = panes.find((pane) => PANE_VALUE + pane.id === top);
  const topData = dataResults.find((result) => resultValue(result) === top);
  const topFont = fonts.find((font) => FONT_VALUE + font.id === top);
  const restApps = found.filter((app) => app !== topApp);
  const restPanes = panes.filter((pane) => pane !== topPane);
  const restFonts = fonts.filter((font) => font !== topFont);

  return (
    <div
      className="mac-desktop-shell-spotlight"
      onKeyDownCapture={onKeys}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={frameRef}
        className="mac-desktop-shell-spotlight-frame"
        style={{ translate: `${place.x}px ${place.y}px` }}
        // A press on the results or the preview leaves the keyboard with the field, or Escape and the
        // arrows would go nowhere; text selected in the preview stays selected.
        onPointerUp={() => {
          if (document.getSelection()?.isCollapsed !== false) input.current?.focus();
        }}
      >
        <Spotlight
          style={
            place.height === undefined
              ? undefined
              : ({ "--mac-spotlight-body-height": `${place.height}px` } as CSSProperties)
          }
          onPointerDown={moveFrom}
          inputRef={input}
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setPicked(null);
            setFailure(null);
          }}
          selectedValue={selectedValue}
          onSelectedValueChange={setPicked}
          onOpenResult={open}
          onClose={onClose}
          completion={completion}
          preview={preview}
          note={data ? searchNote(data) : undefined}
        >
          {sum !== undefined ? (
            <SpotlightGroup label="Calculator">
              <SpotlightResult
                value={CALC_VALUE}
                icon={<AppTile id="calculator" name="Calculator" />}
              >
                {`= ${sumText}`}
              </SpotlightResult>
            </SpotlightGroup>
          ) : null}
          {conversion ? (
            <SpotlightGroup label="Conversion">
              <SpotlightResult value={CONVERT_VALUE}>{`= ${conversion.answer}`}</SpotlightResult>
            </SpotlightGroup>
          ) : money?.kind === "failed" ? (
            <SpotlightGroup label="Conversion">
              <SpotlightResult value={CONVERT_VALUE}>
                Exchange rates aren’t available
              </SpotlightResult>
            </SpotlightGroup>
          ) : null}
          {top ? (
            <SpotlightGroup label="Top Hit">
              {topApp ? appRow(topApp) : null}
              {topPane ? paneRow(topPane) : null}
              {topData ? dataRow(topData) : null}
              {topFont ? fontRow(topFont) : null}
            </SpotlightGroup>
          ) : null}
          {restApps.length > 0 ? (
            <SpotlightGroup label="Applications">{restApps.map(appRow)}</SpotlightGroup>
          ) : null}
          {restPanes.length > 0 ? (
            <SpotlightGroup label="System Preferences">{restPanes.map(paneRow)}</SpotlightGroup>
          ) : null}
          {groups.flatMap((group) => {
            const rest = group.results.filter((result) => result !== topData);
            return rest.length > 0
              ? [
                  <SpotlightGroup key={group.kind} label={group.label}>
                    {rest.map(dataRow)}
                  </SpotlightGroup>,
                ]
              : [];
          })}
          {restFonts.length > 0 ? (
            <SpotlightGroup label="Fonts">{restFonts.map(fontRow)}</SpotlightGroup>
          ) : null}
          {help.length > 0 ? (
            <SpotlightGroup label="Help">
              {help.map((topic) => (
                <SpotlightResult
                  key={topic.id}
                  value={HELP_VALUE + topic.id}
                  icon={<AppTile id="help-viewer" name={appName("help-viewer")} />}
                >
                  {topic.title}
                </SpotlightResult>
              ))}
            </SpotlightGroup>
          ) : null}
          {definition ? (
            <SpotlightGroup label="Definition">
              <SpotlightResult
                value={DEFINE_VALUE}
                icon={<AppTile id="dictionary" name={appName("dictionary")} />}
              >
                {`${definition.word} — ${definition.text}`}
              </SpotlightResult>
            </SpotlightGroup>
          ) : null}
          {stock ? (
            <SpotlightGroup label="Stocks">
              <SpotlightResult
                value={STOCK_VALUE}
                icon={<AppTile id="stocks" name={appName("stocks")} />}
              >
                {`${stock.symbol} ${stock.price.toFixed(2)}`}
              </SpotlightResult>
            </SpotlightGroup>
          ) : null}
          {weather ? (
            <SpotlightGroup label="Weather">
              <SpotlightResult value={WEATHER_VALUE}>
                {weather.kind === "read"
                  ? `${weather.place.name} ${degrees(weather.forecast.temperature_c)}, ${weather.forecast.condition}`
                  : weatherSentence(weather)}
              </SpotlightResult>
            </SpotlightGroup>
          ) : null}
          {news.length > 0 ? (
            <SpotlightGroup label="News">
              {news.map((story) => (
                <SpotlightResult
                  key={story.id}
                  value={NEWS_VALUE + story.id}
                  icon={<AppTile id="news" name={appName("news")} />}
                >
                  {story.title}
                </SpotlightResult>
              ))}
            </SpotlightGroup>
          ) : null}
          {webSearch ? (
            <SpotlightGroup label="Search the Web">
              <SpotlightResult
                value={WEB_VALUE}
                icon={<AppTile id="safari" name={appName("safari")} />}
              >
                {`Search the Web for “${trimmed}”`}
              </SpotlightResult>
            </SpotlightGroup>
          ) : null}
          {mapsSearch ? (
            <SpotlightGroup label="Maps">
              <SpotlightResult
                value={MAPS_VALUE}
                icon={<AppTile id="maps" name={appName("maps")} />}
              >
                {`Search Maps for “${trimmed}”`}
              </SpotlightResult>
            </SpotlightGroup>
          ) : null}
          {showAll ? (
            <SpotlightGroup label="Finder">
              <SpotlightResult value={SHOW_ALL_VALUE} icon={<AppTile id="finder" name="Finder" />}>
                Show All in Finder…
              </SpotlightResult>
            </SpotlightGroup>
          ) : null}
        </Spotlight>
        <div
          className="mac-desktop-shell-spotlight-resize"
          aria-hidden="true"
          onPointerDown={resizeFrom}
        />
      </div>
    </div>
  );
}
