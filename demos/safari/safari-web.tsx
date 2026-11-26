import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import {
  WebView,
  WebViewError,
  WebViewFavorite,
  WebViewFavorites,
  WebViewProgress,
  WebViewReader,
  WebViewReaderTitle,
} from "macalicious/web-view";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type DriveEntry,
  DriveError,
  ensureDrive,
  readFile,
  SPECIAL_FOLDER_IDS,
  specialFolder,
  uploadFile,
} from "../desktop/desktop-files";
import { currentDesktopSession, sessionFetch, withDeadline } from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { showDownloadInFinder, useNoteDownload } from "./safari-downloads";
import { LINK_TITLE_TYPE } from "./safari-drop";
import { filePageOf, filePageText, isLocalId, localFileOf } from "./safari-files";
import { SafariFavoriteArtwork, type SafariSite } from "./safari-pages";
import { EMPTY_PAGE } from "./safari-settings";

/*
 * Safari on the Ferrite desktop app (`ferrite-apps/desktop/src/apps/safari`): real pages.
 *
 * A Ferrite application reaches the network only through destinations it declares in advance,
 * so a page opens in one of two ways:
 *
 * - a page of a listed site (Wikipedia, news, developer documentation, search) is fetched by
 *   the server, made safe there with its pictures and stylesheets put in, and shown in a
 *   sandboxed `srcdoc` frame that makes no request of its own and whose links come back to
 *   Safari, with Reader when it has an article;
 * - any other page is neither fetched nor framed: Safari says it opens outside Safari on
 *   Ferrite and offers to open it in a real tab of the visitor's browser.
 *
 * The frame is never given `allow-same-origin`, so nothing in it can script the desktop or
 * read its session cookie. These functions are used only when the desktop app serves the page
 * (`servedByDesktopApp()`); every other build keeps the demo's own placeholder pages.
 */

/** The address of Safari's History page in a tab. */
export const HISTORY_PAGE = "safari:history";
/** The address of Bookmarks > Edit Bookmarks. */
export const BOOKMARKS_PAGE = "safari:bookmarks";

/** How long Safari waits for a page from the server: over the module's own 6.5 s budget. */
export const PAGE_DEADLINE_MS = 9_000;

/** The `sandbox` of a server-fetched page: its own relay script and GET forms, nothing else. */
export const FETCHED_SANDBOX = "allow-scripts allow-forms allow-modals";

export interface WebFolder {
  title: string;
  links: readonly WebLink[];
}

export interface WebLink {
  title: string;
  url: string;
}

export interface WebSaved extends WebLink {
  added: number;
  read: boolean;
}

export interface WebVisit extends WebLink {
  at: number;
  count: number;
}

export interface ReaderBlock {
  kind: "h" | "p" | "pre";
  text: string;
}

export interface WebPage {
  url: string;
  title: string;
  html: string;
  status: number;
  reader: readonly ReaderBlock[] | null;
}

export interface WebFailure {
  kind: string;
  host: string | null;
  url: string;
  message: string;
}

/** What a tab holds for the address it shows. */
export type WebState =
  | { status: "loading"; address: string }
  | { status: "ready"; address: string; page: WebPage }
  | { status: "outside"; address: string; url: string; checked: boolean }
  | { status: "failed"; address: string; failure: WebFailure }
  | { status: "stopped"; address: string };

/** Whether an address is a web page rather than the demo's own (`.example`) or Safari's. */
export function isWebAddress(address: string): boolean {
  if (address === "" || address === HISTORY_PAGE || address === BOOKMARKS_PAGE) return false;
  if (address === EMPTY_PAGE) return false;
  try {
    const url = new URL(address);
    const host = url.hostname.replace(/\.$/, "");
    return !(/^https?:$/.test(url.protocol) && (host === "example" || host.endsWith(".example")));
  } catch {
    return true;
  }
}

/** Where words typed in the address field go: Wikipedia's search. */
export const SEARCH = "https://en.wikipedia.org/w/index.php?fulltext=1&ns0=1&search=";

/** The search for words, whatever they look like. */
export const searchAddress = (words: string) =>
  `${SEARCH}${encodeURIComponent(words.trim()).replace(/%20/g, "+")}`;

/**
 * What the address field's text means on the web: an address as typed (a missing scheme is
 * https), normalised as the browser's URL parser writes it (`normalisedAddress`), or a search
 * for the words. A number with a dot ("1.5", "3.14") is a search, as in other browsers; four
 * dotted numbers are an address.
 */
export function webAddressFor(text: string): string {
  const typed = text.trim();
  if (typed === "") return "";
  if (/^[a-z][\w+.-]*:\/\//i.test(typed)) return normalisedAddress(typed);
  if (/^(javascript|data|file|about|blob|mailto|tel|view-source|vbscript):/i.test(typed))
    return typed;
  const search = searchAddress(typed);
  if (/^\d+(\.\d+)+$/.test(typed) && !/^\d+\.\d+\.\d+\.\d+$/.test(typed)) return search;
  const hostLike = /^(\[[\da-f:.]+\]|[^\s/?#]+\.[^\s/?#]+|localhost)(:\d+)?([/?#]\S*)?$/i;
  if (!/\s/.test(typed) && hostLike.test(typed)) return normalisedAddress(`https://${typed}`);
  return search;
}

/**
 * An http(s) address as the browser's URL parser writes it: the host in lower case, an
 * international name in its ASCII form (`münchen.de` is `xn--mnchen-3ya.de`, which is what the
 * server and DNS take), unsafe characters percent-encoded, and a path of at least `/`. Any other
 * scheme, and text the parser refuses, is left as typed: the server then refuses it with its
 * reason (Safari's error page).
 */
export function normalisedAddress(address: string): string {
  try {
    const url = new URL(address);
    return (url.protocol === "http:" || url.protocol === "https:") && plainHost(url)
      ? url.href
      : address;
  } catch {
    return address;
  }
}

/**
 * Whether a parsed address's host is one a server can look up: a name of letters, digits, hyphens
 * and dots (an international one already in its ASCII form; a fully qualified name may end in
 * the root's dot, `example.org.`, which the server keeps and opens), or an IP address. Some
 * engines' URL parsers turn a space or another character a host cannot hold into a `%` escape
 * rather than refusing the address (`http://exa mple.com` becomes `http://exa%20mple.com/`):
 * such an address is not a web address the server would keep or open.
 */
function plainHost(url: URL): boolean {
  return /^([a-z0-9-]+\.)*[a-z0-9-]+\.?$|^\[[0-9a-f:.]+\]$/i.test(url.hostname);
}

/** Whether a host is loopback, private, link-local or local-only, as the browser would reach it. */
export function privateHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !host.includes(":")) return true;
  if (
    /(^|\.)(localhost|local|internal|lan|home|home\.arpa|corp|intranet|private|localdomain)$/.test(
      host,
    )
  )
    return true;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (host.includes(":")) {
    // The URL parser writes IPv6 in its shortest form: loopback, unspecified, mapped IPv4,
    // unique local, link-local and multicast all start in one of these ways.
    return /^(::1?$|::ffff:|f[cd]|fe[89ab]|ff)/.test(host);
  }
  return false;
}

/**
 * Why Safari should not offer an address in a browser tab, or `null` when it may. Only public
 * http(s) pages of another site than the desktop's own are offered.
 */
export function outsideRefusal(
  address: string,
  own: string = window.location.origin,
): WebFailure | null {
  const refuse = (kind: string, host: string | null, message: string): WebFailure => ({
    kind,
    host,
    url: address,
    message,
  });
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return refuse("invalid", null, "the address is not valid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return refuse("scheme", null, `addresses starting with "${url.protocol}" are not opened`);
  if (url.username || url.password) return refuse("credentials", url.hostname, "");
  if (privateHost(url.hostname)) return refuse("private", url.hostname, "");
  if (url.host === new URL(own).host) return refuse("own", url.hostname, "");
  return null;
}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const failureOf = (address: string, kind: string, message: string): WebFailure => {
  let host: string | null = null;
  try {
    host = new URL(address).hostname;
  } catch {
    host = null;
  }
  return { kind, host, url: address, message };
};

/**
 * Ask the server for a page: what the tab then holds. A page off the list is offered in a
 * browser tab when it may be; a request that fails or takes too long is a failure page.
 */
export async function openWebPage(
  address: string,
  signal: AbortSignal,
  isPrivate = false,
): Promise<WebState> {
  try {
    const reply = await withDeadline(async (deadline) => {
      // The request ends at the deadline or when the tab stops it (Stop, another address),
      // forwarded by hand: WebKit never ends a request cancelled through `AbortSignal.any`.
      const both = new AbortController();
      const forward = () => both.abort();
      if (deadline.aborted || signal.aborted) forward();
      deadline.addEventListener("abort", forward, { once: true });
      signal.addEventListener("abort", forward, { once: true });
      const response = await sessionFetch(
        `/api/safari/page?url=${encodeURIComponent(address)}${isPrivate ? "&private=1" : ""}`,
        {
          credentials: "same-origin",
          headers: { accept: "application/json" },
          signal: both.signal,
        },
      );
      return {
        status: response.status,
        body: (await readJson(response)) as Record<string, unknown> | null,
        // Whether the server kept the visit in the history, or had no time to (`skipped`).
        history: response.headers.get("x-safari-history"),
      };
    }, PAGE_DEADLINE_MS);
    const body = reply.body;
    if (reply.status === 504) {
      return { status: "failed", address, failure: failureOf(address, "timeout", "") };
    }
    if (!body || typeof body !== "object") {
      return {
        status: "failed",
        address,
        failure: failureOf(address, "unreachable", `HTTP ${reply.status}`),
      };
    }
    if (body.ok === true && typeof body.html === "string") {
      const page: WebPage = {
        url: String(body.url ?? address),
        title: String(body.title ?? ""),
        html: body.html,
        status: Number(body.status ?? 200),
        reader: Array.isArray(body.reader) ? (body.reader as ReaderBlock[]) : null,
      };
      // A visit the server had no time to keep is kept from here, so History has every page.
      if (reply.history === "skipped") void rememberOutside(page.url, page.title);
      return { status: "ready", address, page };
    }
    const failure: WebFailure = {
      kind: String(body.kind ?? "unreachable"),
      host: typeof body.host === "string" ? body.host : null,
      url: address,
      message: String(body.message ?? body.error ?? ""),
    };
    if (failure.kind === "not-listed") {
      // Off the server's list: offered in a tab of the visitor's own browser, unless it may not.
      // The server looked its name up first; `checked: false` says it could not in time.
      const refused = outsideRefusal(address);
      if (refused === null)
        return {
          status: "outside",
          address,
          url: new URL(address).href,
          checked: body.checked !== false,
        };
      return { status: "failed", address, failure: refused };
    }
    return { status: "failed", address, failure };
  } catch (error) {
    if (signal.aborted) return { status: "stopped", address };
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return {
      status: "failed",
      address,
      failure: failureOf(address, timedOut ? "timeout" : "unreachable", String(error)),
    };
  }
}

/**
 * A person's own HTML file, made safe by the server as a fetched page is and shown the same way: on
 * the drive by its id, or held since it was chosen from this computer.
 */
export async function openFilePage(address: string, signal: AbortSignal): Promise<WebState> {
  const { id, name } = filePageOf(address);
  const shown = filePageText(address);
  try {
    const local = localFileOf(id);
    if (!local && isLocalId(id)) throw new Error("The file is no longer held.");
    const html = await (local ?? (await readFile(id, { signal }))).text();
    const response = await sessionFetch("/api/safari/file-page", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ html }),
      signal,
    });
    const body = (await readJson(response)) as Record<string, unknown> | null;
    if (body?.ok === true && typeof body.html === "string") {
      const page: WebPage = {
        url: address,
        title: String(body.title ?? "") || name,
        html: body.html,
        status: 200,
        reader: Array.isArray(body.reader) ? (body.reader as ReaderBlock[]) : null,
      };
      return { status: "ready", address, page };
    }
    return {
      status: "failed",
      address,
      failure: { ...failureOf(shown, String(body?.kind ?? "unreachable"), ""), host: name },
    };
  } catch (error) {
    if (signal.aborted) return { status: "stopped", address };
    return {
      status: "failed",
      address,
      failure: { ...failureOf(shown, "unreachable", String(error)), host: name },
    };
  }
}

/** What the search engine suggests for the words: none when it cannot be asked. */
export async function loadSuggestions(words: string, signal: AbortSignal): Promise<string[]> {
  try {
    const response = await sessionFetch(`/api/safari/suggest?q=${encodeURIComponent(words)}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    const body = (await readJson(response)) as { suggestions?: unknown } | null;
    return Array.isArray(body?.suggestions)
      ? body.suggestions.filter((title): title is string => typeof title === "string")
      : [];
  } catch {
    return [];
  }
}

/** Whether typed text is worth asking the search engine about: words, not an address. */
export const asksForSuggestions = (typed: string) => {
  const words = typed.trim();
  return words.length >= 2 && !/[/:@]|\.\S/.test(words);
};

/** Add a page to the history that the server did not keep itself: one opened in a browser tab
 * (the server never saw it), or a fetched page whose reply had no time left to keep it. */
export function rememberOutside(url: string, title: string): Promise<void> {
  return sessionFetch("/api/safari/history", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, title }),
  }).then(
    () => {},
    () => {},
  );
}

/** The links of a stored list that are links: a title and an address, both text. */
export function readLinks(list: readonly unknown[]): WebLink[] {
  return list.flatMap((item) => {
    const link = item as { title?: unknown; url?: unknown } | null;
    return typeof link?.title === "string" && typeof link.url === "string"
      ? [{ title: link.title, url: link.url }]
      : [];
  });
}

/** The folders of a stored list that are folders: a name and links. */
export function readFolders(list: readonly unknown[]): WebFolder[] {
  return list.flatMap((item) => {
    const folder = item as { title?: unknown; links?: unknown } | null;
    return typeof folder?.title === "string" && Array.isArray(folder.links)
      ? [{ title: folder.title, links: readLinks(folder.links) }]
      : [];
  });
}

/** The Reading List items of a stored list that are items. */
export function readSaved(list: readonly unknown[]): WebSaved[] {
  return list.flatMap((item) => {
    const saved = item as {
      title?: unknown;
      url?: unknown;
      added?: unknown;
      read?: unknown;
    } | null;
    return typeof saved?.title === "string" && typeof saved.url === "string"
      ? [
          {
            title: saved.title,
            url: saved.url,
            added: typeof saved.added === "number" ? saved.added : 0,
            read: saved.read === true,
          },
        ]
      : [];
  });
}

/** The address a tab is kept under: its page's, or `""` (the start page) for Safari's own
 * pages and for anything the server would not keep (no http(s), no plain host, a user name or
 * password, too long): one address the server refuses makes it refuse the whole tabs document,
 * and the window's tabs would then stop being kept. */
export function keptAddress(address: string): string {
  if (!/^https?:\/\/\S+$/i.test(address) || address.length > 4096) return "";
  try {
    const url = new URL(address);
    // The server's policy refuses an authority holding an `@` (`policy::parse`: Credentials).
    if (url.username !== "" || url.password !== "" || /^https?:\/\/[^/?#]*@/i.test(address))
      return "";
    return plainHost(url) ? address : "";
  } catch {
    return "";
  }
}

/**
 * The tabs with the one `id` names moved to place `to` (counted among the others, clamped to the
 * ends): what dragging a tab along the tab bar does. The same list when `id` is not there or the
 * tab does not move.
 */
export function moveTab<T extends { id: string }>(
  tabs: readonly T[],
  id: string,
  to: number,
): readonly T[] {
  const from = tabs.findIndex((tab) => tab.id === id);
  if (from < 0) return tabs;
  const rest = tabs.filter((tab) => tab.id !== id);
  const at = Math.max(0, Math.min(rest.length, Math.round(to)));
  if (at === from) return tabs;
  return [...rest.slice(0, at), tabs[from] as T, ...rest.slice(at)];
}

/** What a tab needs for {@link adoptKeptTabs}: its identity and what it shows. */
export interface KeptTab {
  id: string;
  history: readonly string[];
  index: number;
}

/** How much of a tab's Back and Forward is kept: the server's `MAX_TAB_PAGES`, and what one page may take. */
const KEPT_PAGES = 20;
const KEPT_AHEAD = 5;
const KEPT_PAGE_LENGTH = 512;

/** What a tab's kept Back and Forward hold: `pages[index]` is the address it is kept under. */
export interface KeptPages {
  pages: readonly string[];
  index: number;
}

/**
 * The Back and Forward a tab keeps across a reload: the pages nearest the one it shows, leaving out
 * those too long to be worth the room. Safari's own pages are kept as the start page.
 */
export function keptPages(history: readonly string[], index: number): KeptPages {
  const ahead = Math.min(KEPT_AHEAD, history.length - index - 1);
  const from = Math.max(0, index + ahead + 1 - KEPT_PAGES);
  const fits = (page: string, at: number) => at === index || page.length <= KEPT_PAGE_LENGTH;
  const near = history.map((page, at) => ({ page, at })).slice(from, index + ahead + 1);
  const kept = near.filter(({ page, at }) => fits(page, at));
  return {
    pages: kept.map(({ page }) => keptAddress(page)),
    index: kept.findIndex(({ at }) => at === index),
  };
}

/** The kept Back and Forward in a tabs document, or none where they do not fit what it says. */
export function readKeptPages(value: unknown): KeptPages | null {
  const { pages, index } = (value ?? {}) as { pages?: unknown; index?: unknown };
  if (!Array.isArray(pages) || typeof index !== "number") return null;
  if (!pages.every((page) => typeof page === "string") || pages[index] === undefined) return null;
  return { pages, index };
}

/**
 * The tabs a window shows once its kept tabs have been read (`kept`, with the tab in front at
 * `front`), when Safari opens. A tab that already shows the address kept at its place stays
 * exactly as it is, the same object, with its page, Back and Forward history and Reader, and only
 * a place whose address differs gets a new tab from `fresh`. `null` when nothing differs, so the
 * window renders nothing new. (An open window does not adopt the tabs again when the desktop
 * reloads Safari's documents in the background: see `safari.tsx`.)
 */
export function adoptKeptTabs<T extends KeptTab>(
  current: readonly T[],
  activeId: string,
  kept: readonly string[],
  front: number,
  fresh: (address: string) => T,
): { tabs: T[]; activeId: string } | null {
  if (kept.length === 0) return null;
  const shows = (tab: T | undefined, address: string) =>
    tab !== undefined && keptAddress(tab.history[tab.index] ?? "") === address;
  const tabs = kept.map((address, at) =>
    shows(current[at], address) ? (current[at] as T) : fresh(address),
  );
  const at = Number.isInteger(front) ? Math.min(Math.max(0, front), tabs.length - 1) : 0;
  const inFront = (tabs[at] as T).id;
  const same = tabs.length === current.length && tabs.every((tab, at) => tab === current[at]);
  if (same && inFront === activeId) return null;
  return { tabs, activeId: inFront };
}

/** The session's history, newest first; with `query`, the visits holding every word. */
export async function loadHistory(query = ""): Promise<WebVisit[] | null> {
  try {
    return await withDeadline(async (signal) => {
      const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const response = await sessionFetch(`/api/safari/history${q}`, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
      });
      if (!response.ok) return null;
      const body = (await readJson(response)) as { history?: WebVisit[] | null } | null;
      return Array.isArray(body?.history) ? body.history : [];
    });
  } catch {
    return null;
  }
}

/** Forget the whole history. */
export async function clearHistory(): Promise<boolean> {
  try {
    const response = await sessionFetch("/api/safari/history", {
      method: "DELETE",
      credentials: "same-origin",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Forget these pages, or every page opened since a time: what the row menu and the sheet ask. */
export async function forgetHistory(what: { urls?: readonly string[]; since?: number }) {
  try {
    const response = await sessionFetch("/api/safari/history/forget", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(what),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** The ranges of Clear History. */
export const CLEAR_RANGES = [
  { id: "hour", label: "the last hour" },
  { id: "today", label: "today" },
  { id: "two-days", label: "today and yesterday" },
  { id: "all", label: "all history" },
] as const;
export type ClearRange = (typeof CLEAR_RANGES)[number]["id"];

/** When a range starts, in milliseconds, or `null` for all history. */
export function clearRangeStart(range: ClearRange, now: number): number | null {
  if (range === "all") return null;
  if (range === "hour") return now - 3_600_000;
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  if (range === "two-days") day.setDate(day.getDate() - 1);
  return day.getTime();
}

/** The sites the server fetches, as the Favorites a new session starts with. */
export async function loadSites(): Promise<WebLink[] | null> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch("/api/safari/sites", {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
      });
      if (!response.ok) return null;
      const body = (await readJson(response)) as {
        sites?: { title: string; url: string }[];
      } | null;
      return (body?.sites ?? []).map((site) => ({ title: site.title, url: site.url }));
    });
  } catch {
    return null;
  }
}

/** A favourite's tile as Safari draws a site without a touch icon: its initial on a colour. */
export function siteFor(link: WebLink): SafariSite {
  let host = link.url;
  try {
    host = new URL(link.url).hostname;
  } catch {
    host = link.url;
  }
  let sum = 0;
  for (const character of host) sum += character.charCodeAt(0);
  const name = link.title || host;
  return { host, name, title: name, tint: (sum % 6) + 1, heading: name, paragraphs: [] };
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** The title a tab shows for what it holds. */
export function webTitle(state: WebState | undefined, address: string): string {
  if (!state || state.status === "loading" || state.status === "stopped") return hostOf(address);
  if (state.status === "ready") return state.page.title || hostOf(state.page.url);
  if (state.status === "outside") return hostOf(state.url);
  return "Failed to open page";
}

/** The headline and explanation of a failure page, in Safari's words where it has them. */
export function failureText(failure: WebFailure): { title: string; body: string } {
  const host = failure.host ?? failure.url;
  const cant = "Safari Can’t Open the Page";
  switch (failure.kind) {
    case "not-found":
      return {
        title: "Safari Can’t Find the Server",
        body: `Safari can’t open the page “${failure.url}” because Safari can’t find the server “${host}”.`,
      };
    case "timeout":
      return {
        title: cant,
        body: `Safari can’t open the page “${failure.url}” because the server where this page is located isn’t responding.`,
      };
    case "too-large":
      return {
        title: cant,
        body: `Safari can’t open the page “${failure.url}” because it is larger than the 1 MB a Ferrite application can fetch.`,
      };
    case "scheme": {
      const scheme = failure.url.split(":")[0] ?? "";
      return {
        title: cant,
        body: `Safari can’t open “${failure.url}” because macOS doesn’t recognize Internet addresses starting with “${scheme}:”.`,
      };
    }
    case "private":
      return {
        title: cant,
        body: `Safari can’t open the page “${failure.url}” because “${host}” is on a private or local network, which this Safari does not reach.`,
      };
    case "own":
      return {
        title: cant,
        body: `Safari can’t open the page “${failure.url}” inside the desktop it is part of.`,
      };
    case "credentials":
      return {
        title: cant,
        body: `Safari can’t open the page “${failure.url}” because addresses with a user name or password are not opened.`,
      };
    case "port":
      return {
        title: cant,
        body: `Safari can’t open the page “${failure.url}” because only the standard web port is reached.`,
      };
    case "redirect":
      return {
        title: cant,
        body: `Safari can’t open the page “${failure.url}” because the site sent it to another address without naming it.`,
      };
    case "unsupported":
      return { title: cant, body: `Safari can’t show “${failure.url}”: it is not a web page.` };
    case "invalid":
      return {
        title: cant,
        body: `Safari can’t open “${failure.url}” because it is not a valid address.`,
      };
    default:
      return {
        title: cant,
        body: `Safari can’t open the page “${failure.url}” because the server “${host}” could not be reached.`,
      };
  }
}

/** A page of a listed site, made safe by the server, in its sandboxed frame. */
export function SafariFetchedPage({
  page,
  loading,
  frameRef,
  onFrameLoad,
}: {
  page: WebPage;
  loading: boolean;
  frameRef: Ref<HTMLIFrameElement>;
  /** The page in its frame is ready to hear the window (its zoom). */
  onFrameLoad?: () => void;
}) {
  return (
    <WebView
      src="about:blank"
      title={page.title || page.url}
      sandbox={FETCHED_SANDBOX}
      frameProps={{ srcDoc: page.html, ref: frameRef, onLoad: onFrameLoad }}
      className="mac-safari-view mac-safari-web"
      // The frame is transparent: the view's canvas is the page's ground.
      style={
        {
          "--mac-web-view-background": "var(--mac-safari-web-page-background)",
        } as CSSProperties
      }
      data-page-url={page.url}
    >
      {loading ? <WebViewProgress value={null} aria-label="Loading page" /> : null}
    </WebView>
  );
}

/**
 * A page off the server's list: Safari on Ferrite does not open it itself, and says so, with a
 * button that opens it in a new tab of the visitor's own browser (`onOpened` follows). It says
 * why honestly: whether a site allows being shown inside another page is something a Ferrite
 * application cannot see, so Safari never claims that a particular site refused. `checked`
 * false: the server could not look the name up in time.
 */
export function SafariOutsidePage({
  url,
  checked = true,
  onOpened,
}: {
  url: string;
  checked?: boolean;
  onOpened?: () => void;
}) {
  const host = hostOf(url);
  return (
    <WebView title={host} className="mac-safari-view mac-safari-outside" data-page-url={url}>
      <WebViewError title="This Page Opens Outside Safari" data-kind="outside">
        <p className="mac-safari-outside-text">
          Safari on Ferrite opens pages only from the sites it lists. You can open “{host}” in a new
          tab of your own browser instead.
        </p>
        <p className="mac-safari-outside-text">
          Safari can’t tell whether another site allows being shown inside a page like this one:
          sites refuse it with headers a Ferrite application cannot read, so Safari never shows one
          inside the desktop.
          {checked
            ? null
            : " Safari could not check this address first, so the tab may not find it."}
        </p>
        <p className="mac-safari-outside-actions">
          <PushButton
            variant="primary"
            onClick={() => {
              window.open(url, "_blank", "noopener,noreferrer");
              onOpened?.();
            }}
          >
            Open in New Browser Tab
          </PushButton>
        </p>
      </WebViewError>
    </WebView>
  );
}

/** The failure page of a tab. A file of a listed site ("not a web page") can be downloaded
 * into the person's Downloads folder from it. */
export function SafariFailurePage({ failure }: { failure: WebFailure }) {
  const text = failureText(failure);
  return (
    <WebView title="Failed to open page" className="mac-safari-view">
      <WebViewError title={text.title} data-kind={failure.kind}>
        {failure.kind === "unsupported" ? (
          <>
            <p className="mac-safari-outside-text">{text.body}</p>
            <SafariDownload url={failure.url} />
          </>
        ) : (
          text.body
        )}
      </WebViewError>
    </WebView>
  );
}

/** What a download into the Downloads folder came to. */
export type DownloadResult = { ok: true; entry: DriveEntry } | { ok: false; message: string };

/**
 * Saves bytes under a name into the person's Downloads folder, under a free name
 * (`existing: "rename"`). A refusal comes back as a sentence to show.
 */
export async function saveToDownloads(
  file: Blob,
  name: string,
  signal?: AbortSignal,
  session: string | null = currentDesktopSession(),
): Promise<DownloadResult> {
  try {
    const drive = await ensureDrive(signal);
    const folder = specialFolder(drive, "Downloads")?.id ?? SPECIAL_FOLDER_IDS.Downloads;
    const entry = await uploadFile(file, folder, { name, existing: "rename", signal, session });
    return { ok: true, entry };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof DriveError && error.message
          ? error.message
          : "The file could not be saved to your Downloads folder.",
    };
  }
}

/**
 * Downloads the file at `address` (a listed site's, at most the 1 MB a Ferrite application can
 * fetch) into the person's Downloads folder on their drive: the server fetches it
 * (`/api/safari/file`) and the window uploads it through the drive's own route, under a free
 * name (`existing: "rename"`). Every refusal comes back as a sentence to show: the server's
 * (too large, not listed, unreachable) or the drive's (full, too many files).
 */
export async function downloadToDownloads(
  address: string,
  signal?: AbortSignal,
): Promise<DownloadResult> {
  const session = currentDesktopSession();
  let body: Record<string, unknown> | null;
  try {
    const reply = await withDeadline(async (deadline) => {
      const response = await sessionFetch(`/api/safari/file?url=${encodeURIComponent(address)}`, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: deadline,
      });
      return {
        status: response.status,
        body: (await readJson(response)) as Record<string, unknown> | null,
      };
    }, PAGE_DEADLINE_MS);
    if (reply.status === 504) {
      return { ok: false, message: failureText(failureOf(address, "timeout", "")).body };
    }
    body = reply.body;
  } catch {
    return { ok: false, message: "Safari could not reach the server to download the file." };
  }
  if (body?.ok !== true || typeof body.data !== "string") {
    const kind = String(body?.kind ?? "unreachable");
    return { ok: false, message: failureText(failureOf(address, kind, "")).body };
  }
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(atob(body.data), (character) => character.charCodeAt(0));
  } catch {
    return { ok: false, message: "The server's copy of the file could not be read." };
  }
  const type = typeof body.type === "string" ? body.type : "application/octet-stream";
  const name = typeof body.name === "string" && body.name ? body.name : "download";
  return saveToDownloads(new Blob([bytes], { type }), name, signal, session);
}

/**
 * The Download block of a file's page: Download to Downloads Folder, then where the file went,
 * with Show in Finder (Finder opens on the Downloads folder with the file selected), or why it
 * could not be saved, with Try Again.
 */
function SafariDownload({ url }: { url: string }) {
  type State =
    | { step: "idle" }
    | { step: "busy" }
    | { step: "done"; entry: DriveEntry }
    | { step: "failed"; message: string };
  const [state, setState] = useState<State>({ step: "idle" });
  const live = useRef(true);
  const noteDownload = useNoteDownload();
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const run = () => {
    setState({ step: "busy" });
    void downloadToDownloads(url).then((result) => {
      if (result.ok) {
        noteDownload({ id: result.entry.id, name: result.entry.name, url, at: Date.now() });
      }
      if (!live.current) return;
      setState(
        result.ok
          ? { step: "done", entry: result.entry }
          : { step: "failed", message: result.message },
      );
    });
  };
  if (state.step === "done") {
    const { entry } = state;
    return (
      <div className="mac-safari-download" role="status">
        <p className="mac-safari-outside-text">“{entry.name}” is in your Downloads folder.</p>
        <p className="mac-safari-outside-actions">
          <PushButton onClick={() => showDownloadInFinder(entry)}>Show in Finder</PushButton>
        </p>
      </div>
    );
  }
  return (
    <div className="mac-safari-download">
      <p className="mac-safari-outside-text">
        {state.step === "failed"
          ? state.message
          : "You can download it to your Downloads folder: files of up to 1 MB, the most a Ferrite application can fetch."}
      </p>
      <p className="mac-safari-outside-actions">
        <PushButton variant="primary" disabled={state.step === "busy"} onClick={run}>
          {state.step === "busy"
            ? "Downloading…"
            : state.step === "failed"
              ? "Try Again"
              : "Download to Downloads Folder"}
        </PushButton>
      </p>
    </div>
  );
}

const readerThemeStyle = (theme: string) =>
  ({
    "--mac-web-view-reader-canvas": `var(--mac-safari-reader-${theme}-canvas)`,
    "--mac-web-view-reader-paper": `var(--mac-safari-reader-${theme}-paper)`,
    "--mac-web-view-reader-text": `var(--mac-safari-reader-${theme}-text)`,
  }) as CSSProperties;

const READER_THEME_STYLES: Readonly<Record<string, CSSProperties>> = {
  sepia: readerThemeStyle("sepia"),
  gray: readerThemeStyle("gray"),
  night: readerThemeStyle("night"),
};

/** Reader for a page the server fetched. */
export function SafariWebReader({
  page,
  fontSize,
  fontFamily,
  theme,
}: {
  page: WebPage;
  fontSize: number;
  fontFamily?: string;
  theme?: string;
}) {
  const blocks = page.reader ?? [];
  const [first, ...rest] = blocks;
  const titled = first?.kind === "h";
  return (
    <WebView
      surface="reader"
      title={`Reader: ${page.title}`}
      className="mac-safari-view"
      data-reader-theme={theme}
      style={theme ? READER_THEME_STYLES[theme] : undefined}
    >
      <WebViewReader style={{ fontSize, fontFamily }}>
        <WebViewReaderTitle>{titled ? first.text : page.title}</WebViewReaderTitle>
        {(titled ? rest : blocks).map((block, index) =>
          block.kind === "h" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: the article's blocks, in order.
            <h2 key={index} className="mac-safari-reader-heading">
              {block.text}
            </h2>
          ) : block.kind === "pre" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above.
            <pre key={index} className="mac-safari-reader-code">
              {block.text}
            </pre>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above.
            <p key={index} className="mac-safari-reader-paragraph">
              {block.text}
            </p>
          ),
        )}
      </WebViewReader>
    </WebView>
  );
}

/** The data type of a favourite dragged along the bar. */
const FAVORITE_DRAG = "application/x-macalicious-safari-favorite";

/** The Favorites bar under the toolbar: one button per favourite. */
export function SafariFavoritesBar({
  favorites,
  onOpen,
  onMove,
}: {
  favorites: readonly WebLink[];
  onOpen: (url: string, newTab: boolean) => void;
  /** A favourite dragged along the bar, to stand before the one at `to`. */
  onMove?: (from: number, to: number) => void;
}) {
  return (
    <nav
      className="mac-safari-favorites-bar"
      aria-label="Favorites bar"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(FAVORITE_DRAG)) event.preventDefault();
      }}
      onDrop={(event) => {
        const from = Number(event.dataTransfer.getData(FAVORITE_DRAG));
        if (!event.dataTransfer.types.includes(FAVORITE_DRAG) || !Number.isInteger(from)) return;
        event.preventDefault();
        const over = (event.target as Element).closest<HTMLElement>("[data-favorite-at]");
        onMove?.(from, over ? Number(over.dataset.favoriteAt) : favorites.length);
      }}
    >
      {favorites.map((link, index) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: two favourites may share an address.
          key={index}
          type="button"
          className="mac-safari-favorites-bar-item"
          title={link.url}
          draggable={onMove !== undefined}
          data-favorite-at={index}
          data-link-url={link.url}
          data-link-title={link.title || link.url}
          onDragStart={(event) => event.dataTransfer.setData(FAVORITE_DRAG, String(index))}
          onClick={(event) => onOpen(link.url, event.metaKey)}
        >
          {link.title || hostOf(link.url)}
        </button>
      ))}
    </nav>
  );
}

/** The start page: Favorites, Frequently Visited and the Reading List. */
export function SafariWebStart({
  favorites,
  favoritesList = "favorites",
  frequent,
  readingList,
  onOpen,
  onShowHistory,
}: {
  favorites: readonly WebLink[];
  /** Which list the Favorites shelf shows, for its tiles' menu: Preferences > Favorites shows. */
  favoritesList?: "favorites" | "bookmarks";
  frequent: readonly WebVisit[];
  readingList: readonly WebSaved[];
  onOpen: (url: string) => void;
  onShowHistory: () => void;
}) {
  const tile = (
    link: WebLink,
    index: number,
    list?: "favorites" | "bookmarks" | "reading-list",
  ) => (
    <WebViewFavorite
      key={index}
      href={link.url}
      label={link.title || hostOf(link.url)}
      data-link-url={list ? link.url : undefined}
      data-link-title={list ? link.title || link.url : undefined}
      data-link-list={list}
      onDragStart={(event) =>
        event.dataTransfer.setData(LINK_TITLE_TYPE, link.title || hostOf(link.url))
      }
      onClick={(event) => {
        event.preventDefault();
        onOpen(link.url);
      }}
    >
      <SafariFavoriteArtwork site={siteFor(link)} artwork={false} />
    </WebViewFavorite>
  );
  const unread = readingList.filter((item) => !item.read).slice(0, 6);
  return (
    <WebView surface="start" title="Start Page" className="mac-safari-view">
      <WebViewFavorites heading="Favorites">
        {favorites.map((link, index) => tile(link, index, favoritesList))}
      </WebViewFavorites>
      {frequent.length > 0 ? (
        <WebViewFavorites heading="Frequently Visited">
          {frequent.map((link, index) => tile(link, index))}
        </WebViewFavorites>
      ) : null}
      {unread.length > 0 ? (
        <WebViewFavorites heading="Reading List">
          {unread.map((link, index) => tile(link, index, "reading-list"))}
        </WebViewFavorites>
      ) : null}
      <p className="mac-safari-start-history">
        <PushButton size="small" onClick={onShowHistory}>
          Show All History
        </PushButton>
      </p>
    </WebView>
  );
}

/** The most visited pages, for Frequently Visited: at most `limit`, most visits first. */
export function frequentlyVisited(history: readonly WebVisit[], limit = 6): WebVisit[] {
  return [...history]
    .filter((visit) => visit.count > 1)
    .sort((a, b) => b.count - a.count || b.at - a.at)
    .slice(0, limit);
}

/** The day a visit belongs to, as History heads it. */
export function dayOf(at: number, now: number): string {
  const day = (time: number) => new Date(time).toDateString();
  if (day(at) === day(now)) return "Today";
  if (day(at) === day(now - 86_400_000)) return "Yesterday";
  return new Date(at).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** The visits under their days, newest day first, as the History page and menu head them. */
export function visitsByDay(
  visits: readonly WebVisit[],
  now: number,
): { day: string; visits: WebVisit[] }[] {
  const groups: { day: string; visits: WebVisit[] }[] = [];
  for (const visit of visits) {
    const day = dayOf(visit.at, now);
    const last = groups.at(-1);
    if (last && last.day === day) last.visits.push(visit);
    else groups.push({ day, visits: [visit] });
  }
  return groups;
}

/** Safari's History page: every visit by day, searchable. A click opens a row; Command-click and
 * Shift-click select rows, which Delete forgets; a row has a menu. Clear History asks the window. */
export function SafariHistoryPage({
  onOpen,
  onOpenInNewTab,
  onClear,
  onForgotten,
  reading,
}: {
  onOpen: (url: string) => void;
  onOpenInNewTab?: (url: string) => void;
  onClear?: () => void;
  onForgotten?: () => void;
  /** Changed when the history changed under the page: it reads it again. */
  reading?: number;
}) {
  const [query, setQuery] = useState("");
  const [visits, setVisits] = useState<WebVisit[] | null | undefined>(undefined);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  const anchorUrl = useRef<string | null>(null);
  const forget = (urls: readonly string[]) => {
    if (urls.length === 0) return;
    void forgetHistory({ urls }).then((done) => {
      if (!done) return;
      setVisits((now) => now?.filter((visit) => !urls.includes(visit.url)) ?? now);
      setSelected((now) => now.filter((url) => !urls.includes(url)));
      onForgotten?.();
    });
  };
  const press = (event: ReactMouseEvent, url: string) => {
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) {
      anchorUrl.current = url;
      setSelected((now) => (now.includes(url) ? now.filter((one) => one !== url) : [...now, url]));
    } else if (event.shiftKey) {
      const order = (visits ?? []).map((visit) => visit.url);
      const from = order.indexOf(anchorUrl.current ?? url);
      const to = order.indexOf(url);
      setSelected(order.slice(Math.min(from, to), Math.max(from, to) + 1));
    } else {
      onOpen(url);
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reading` is what asks to read again.
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () => {
        void loadHistory(query).then((found) => {
          if (live) setVisits(found);
        });
      },
      query ? 200 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, reading]);
  const groups = visitsByDay(visits ?? [], Date.now());
  let body: ReactNode;
  if (visits === undefined) body = <p className="mac-safari-history-note">Loading…</p>;
  else if (visits === null)
    body = <p className="mac-safari-history-note">History could not be read.</p>;
  else if (visits.length === 0)
    body = <p className="mac-safari-history-note">{query ? "No Results" : "No History"}</p>;
  else
    body = groups.map((group) => (
      <section key={group.day} className="mac-safari-history-day" aria-label={group.day}>
        <h2 className="mac-safari-history-heading">{group.day}</h2>
        <ul className="mac-safari-history-list">
          {group.visits.map((visit) => (
            <li key={visit.url}>
              <a
                href={visit.url}
                className="mac-safari-history-row"
                data-history-url={visit.url}
                aria-current={selected.includes(visit.url) || undefined}
                data-selected={selected.includes(visit.url) ? "" : undefined}
                onClick={(event) => press(event, visit.url)}
              >
                <span className="mac-safari-history-title">{visit.title || visit.url}</span>
                <span className="mac-safari-history-url">{hostOf(visit.url)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    ));
  const targets = (url: string) => (selected.includes(url) ? selected : [url]);
  return (
    <WebView title="History" className="mac-safari-view mac-safari-history">
      <div className="mac-safari-history-bar">
        <h1 className="mac-safari-history-title-bar">History</h1>
        <PushButton size="small" disabled={!visits || visits.length === 0} onClick={onClear}>
          Clear History…
        </PushButton>
        <SearchField
          placeholder="Search History"
          aria-label="Search History"
          className="mac-safari-history-search"
          value={query}
          onValueChange={(value) => setQuery(String(value))}
        />
      </div>
      <ContextualMenu>
        <ContextualMenuTrigger
          className="mac-safari-history-body"
          tabIndex={0}
          onContextMenu={(event) => {
            const row = (event.target as Element).closest<HTMLElement>("[data-history-url]");
            setMenuUrl(row?.dataset.historyUrl ?? null);
          }}
          onKeyDown={(event) => {
            if ((event.key === "Backspace" || event.key === "Delete") && selected.length > 0) {
              event.preventDefault();
              forget(selected);
            }
          }}
        >
          {body}
        </ContextualMenuTrigger>
        <ContextualMenuPopup aria-label="History">
          {menuUrl ? (
            <>
              <MenuItem onClick={() => onOpen(menuUrl)}>Open</MenuItem>
              {onOpenInNewTab ? (
                <MenuItem onClick={() => onOpenInNewTab(menuUrl)}>Open in New Tab</MenuItem>
              ) : null}
              <MenuSeparator />
              <MenuItem onClick={() => void copyText(menuUrl)}>Copy Link</MenuItem>
              <MenuSeparator />
              <MenuItem onClick={() => forget(targets(menuUrl))}>
                {targets(menuUrl).length > 1 ? `Delete ${targets(menuUrl).length} Pages` : "Delete"}
              </MenuItem>
            </>
          ) : (
            <MenuItem disabled>No Page Selected</MenuItem>
          )}
        </ContextualMenuPopup>
      </ContextualMenu>
    </WebView>
  );
}

/** Clear History: how far back, then the pages opened since then are forgotten. */
export function SafariClearHistorySheet({
  anchor,
  onClear,
  onCancel,
}: {
  anchor: Element | null;
  onClear: (range: ClearRange) => void;
  onCancel: () => void;
}) {
  const [range, setRange] = useState<ClearRange>("all");
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={420} aria-label="Clear History">
        <SheetTitle>Clearing history removes the record of the pages you visited.</SheetTitle>
        <div className="mac-safari-clear-range">
          <span>Clear:</span>
          <PopUpButton<ClearRange>
            aria-label="Clear"
            value={range}
            onValueChange={(next) => {
              if (next) setRange(next);
            }}
          >
            {CLEAR_RANGES.map(({ id, label }) => (
              <PopUpButtonItem key={id} value={id}>
                {label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </div>
        <SheetActions>
          <SheetClose render={<PushButton />}>Cancel</SheetClose>
          <DefaultButton onClick={() => onClear(range)}>Clear History</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
