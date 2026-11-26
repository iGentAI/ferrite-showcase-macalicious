import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type DocumentMerge, mergeDocuments, sameDocument } from "./document-merge";

/**
 * What a demo needs to keep its data on the server when the desktop is served by the
 * `macalicious-desktop` Ferrite application (`ferrite-apps/desktop`), which gives each demo a
 * module under `/api/<demo>/` with storage per browser session.
 *
 * The application's build (`ferrite-apps/desktop/scripts/pack-site.mjs`) sets
 * `VITE_MACALICIOUS_API=1`. Every other build (the documentation, `npm run desktop:build`,
 * the tests) leaves it unset, so a demo there never requests `/api/` and works exactly as
 * before. When it is set, a demo still keeps working if a request fails: it keeps what it
 * shows and stops saving until a load has succeeded.
 */
export function servedByDesktopApp(): boolean {
  // Read when called, not when the module loads, so that a test can stub it.
  return import.meta.env.VITE_MACALICIOUS_API === "1";
}

/** A save the server did not store, even after its retry. */
export interface SaveFailure {
  url: string;
  reason: string;
  /** The server's own words for a save it refused, when its reply gave them (`{"error"}`). */
  detail?: string;
}

const failureListeners = new Set<(failure: SaveFailure) => void>();

/** Hear about every save that failed after its retry. Returns the unsubscribe. */
export function onSaveFailure(listener: (failure: SaveFailure) => void): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

/**
 * Tell the page of a save that failed: the console, and every `onSaveFailure` listener. For a
 * document an app saves through a client of its own (Reminders' shared lists).
 */
export function reportFailure(failure: SaveFailure) {
  console.error(
    failure.reason === CHANGED_ELSEWHERE
      ? `Macalicious did not keep a change to ${failure.url}: ${failure.reason}.`
      : `Macalicious could not save ${failure.url} (${failure.reason}); the next change sends the whole document again.`,
  );
  for (const listener of failureListeners) {
    // One listener that throws neither silences the others nor fails the save or load.
    try {
      listener(failure);
    } catch (error) {
      console.error(error);
    }
  }
}

/**
 * One document on the server, as this page reads and writes it. The server owns the
 * document's revision: a `GET` answers it beside the document, every `PUT` sends back the
 * revision it is based on, and the server stores the body only if that is still its revision,
 * answering the next one (`ferrite-apps/desktop/src/apps/document.rs`).
 */
export interface ServerDocument {
  /** `GET` the document, after every save already given: the parsed reply, or `undefined`.
   * Every other window watching the document is given what the load read (`from` names the
   * loading window), so that no window keeps, and later saves, an older copy. */
  load: (from?: object) => Promise<unknown>;
  /** Save `body` (the whole document) with the revision this page last had. `from` names the
   * window that saves it (its `watch` key): every other window watching the document is given
   * the body. A body equal to the last one given is no change, and is neither saved nor given. */
  save: (body: object, from?: object) => void;
  /**
   * Hear every body given to the document from now on, except those `key` saves itself: how two
   * windows of one document stay one document, so that neither saves a copy without the other's
   * changes. Returns the cleanup.
   */
  watch: (key: object, listener: (body: object, seq: number) => void) => () => void;
  /** The number of the last body told to watching windows (`watch`'s `seq`) when the last load
   * by `key` sent its request: the reply holds every body told up to it, so only a body told
   * with a higher number can be newer than that load's reply. */
  loadedAt: (key: object) => number;
  /** Resolves once no load or save of this document is waiting or in flight. */
  idle: () => Promise<void>;
  /** The revision this page last had from the server: 0 before it has had one. */
  revision: () => number;
}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

/** The server session a `GET` reply names (a hash of the cookie, not the cookie), if any. */
const sessionOf = (reply: unknown): string | null => {
  const session = (reply as { session?: unknown } | null)?.session;
  return typeof session === "string" && session.length > 0 ? session : null;
};

/**
 * The page's first `/api/` request, while its reply is awaited. The server gives a browser its
 * session cookie on the first request that carries none, and every request sent without one
 * starts a session of its own: a fresh browser whose page sent its documents' loads all at once
 * would get as many sessions as loads, whichever cookie arrived last would win, and the documents
 * would name different sessions, which ends the page's session and loads the page again. So the
 * page's first request goes alone, and every other waits for its reply, which carries the cookie.
 */
let firstRequest: Promise<void> | null = null;
/** Whether a reply has come back, so that the browser holds the session's cookie. */
let sessionCookieSet = false;
/** How long the page's next request waits for the first one's reply before it is sent alone in
 * its place. */
const FIRST_REPLY_WAIT_MS = 10_000;

/**
 * The server session (the hash of its cookie, never the cookie) that this page's desktop was
 * loaded for, when the page signs people in (`desktop-accounts.tsx`). Every request of the
 * desktop's apps names it in the `desktop_session` query parameter, and the server answers one
 * that names another session (another tab signed in, out or as someone else since) with 409 and
 * the current person, so a stale page never reads or writes the next person's data: its
 * documents see another session named and load the page again.
 */
let desktopSession: string | null = null;
let desktopSessionNamed = false;
let desktopSessionGeneration = 0;
const desktopSessionListeners = new Set<() => void>();
/** The query parameter that names it (`PAGE_SESSION_PARAM` in `ferrite-apps/desktop/src/lib.rs`). */
export const DESKTOP_SESSION_PARAM = "desktop_session";

/** Name the session this page's desktop is for (`null`: none, the default). */
export function setDesktopSession(session: string | null): void {
  const changed = session !== desktopSession;
  desktopSession = session;
  if (session) desktopSessionNamed = true;
  if (changed) {
    desktopSessionGeneration += 1;
    for (const listener of desktopSessionListeners) listener();
  }
}

/**
 * Hear each change of the session the page names. It can come during a render
 * (`desktop-accounts.tsx`), so a listener that changes what is shown waits for that to end.
 */
export function onDesktopSessionChange(listener: () => void): () => void {
  desktopSessionListeners.add(listener);
  return () => desktopSessionListeners.delete(listener);
}

/** Whether this page signs people in: it has named a session, whether or not it does now. */
export function desktopSessionWasNamed(): boolean {
  return desktopSessionNamed;
}

/** The session this page's desktop is for, as `setDesktopSession` named it. */
export function currentDesktopSession(): string | null {
  return desktopSession;
}

/** `url` naming `session`, for an app's request under `/api/`. */
function withDesktopSession(url: string, session: string | null): string {
  if (!session || !url.startsWith("/api/") || url.startsWith("/api/session")) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}${DESKTOP_SESSION_PARAM}=${encodeURIComponent(session)}`;
}

/**
 * `fetch` for the desktop's `/api/`: the page's first request is sent at once, and every other
 * one after that request has been answered, so that a fresh browser has one session, not one per
 * request. Until a reply has shown the session exists, requests never go out together: a first
 * request that fails without a reply, is answered with a server failure (5xx, which may come
 * from before any session was made), or has had no reply after `FIRST_REPLY_WAIT_MS`, hands its
 * place to the next request, which is then sent alone in the same way. A first request that has
 * had no reply in time is cancelled before its place is handed on: were it answered later, its
 * cookie would replace the session its successor started. When the page names its session
 * (`setDesktopSession`), every app request carries it, or `session` when the work the request
 * belongs to began for another one (`UploadOptions.session`). A write to an app that succeeds is told
 * to `onAppWrite` listeners, here and in the browser's other tabs of the same session, with the
 * change number its reply names; until it has its reply it is under way (`appWritesSettled`).
 */
export function sessionFetch(
  url: string,
  init?: RequestInit,
  session: string | null = desktopSession,
): Promise<Response> {
  const generation = desktopSessionGeneration;
  const request = gatedFetch(withDesktopSession(url, session), init, generation, session !== null);
  const app = writtenApp(url, init);
  if (app) {
    const settled = writeStarted(session, app);
    request.then(
      (response) => {
        try {
          if (response.ok) announceWrite(app, changeOf(response), session);
        } finally {
          settled();
        }
      },
      () => settled(),
    );
  }
  return request;
}

/**
 * The reply header in which the application names the number a write was given in the person's
 * change counts (`touched` in `ferrite-apps/desktop/src/apps/notification_center/mod.rs`).
 */
export const CHANGE_HEADER = "x-macalicious-change";

/** The change number a write's reply names, or `null`. */
function changeOf(response: Response): number | null {
  // A reply stood in for by a test may have no headers.
  const named = Number(response.headers?.get(CHANGE_HEADER) ?? Number.NaN);
  return Number.isSafeInteger(named) && named > 0 ? named : null;
}

/**
 * This page's writes that have had no reply yet, by session and app: each its own promise of the
 * moment it has one (after its `onAppWrite` listeners have heard it).
 */
const writesUnderWay = new Map<string, Set<Promise<void>>>();

const underWayKey = (session: string | null, app: string) => `${session ?? ""}\n${app}`;

/** Note a write of `session` to `app` under way; returns the call that ends it. */
function writeStarted(session: string | null, app: string): () => void {
  const key = underWayKey(session, app);
  let end = () => {};
  const settled = new Promise<void>((resolve) => {
    end = resolve;
  });
  const writes = writesUnderWay.get(key) ?? new Set();
  writes.add(settled);
  writesUnderWay.set(key, writes);
  return () => {
    writes.delete(settled);
    if (writes.size === 0 && writesUnderWay.get(key) === writes) writesUnderWay.delete(key);
    end();
  };
}

/** How many of this page's writes to `app`, for the page's session now, have had no reply yet. */
export function appWritesUnderWay(app: string): number {
  return writesUnderWay.get(underWayKey(desktopSession, app))?.size ?? 0;
}

/**
 * When this page has writes to `app` for its session now that have had no reply yet, a promise of
 * the moment each of those has one (after its `onAppWrite` listeners have heard it), whatever
 * writes start after; otherwise `null`.
 */
export function appWritesSettled(app: string): Promise<void> | null {
  const writes = writesUnderWay.get(underWayKey(desktopSession, app));
  return writes && writes.size > 0 ? Promise.all([...writes]).then(() => {}) : null;
}

/** The app a request changes (`/api/<app>/…`, not a read), or `null`. */
function writtenApp(url: string, init?: RequestInit): string | null {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return null;
  const app = /^\/api\/([a-z0-9-]+)\//.exec(url)?.[1];
  // The router's own routes, and Notification Center, whose changes the person's stream carries.
  if (!app || app === "session" || app === "apps" || app === "notification-center") return null;
  return app;
}

/** The channel on which the browser's tabs tell each other of their writes. */
const WRITES_CHANNEL = "macalicious-writes";
let writesChannel: BroadcastChannel | null | undefined;
/** Hears a write to `app` that succeeded: `here` when this page made it, the change number its
 * reply named, if any, and the session it was made for. */
export type AppWriteListener = (
  app: string,
  here: boolean,
  change: number | null,
  session: string | null,
) => void;
const writeListeners = new Set<AppWriteListener>();

function tellWrite(app: string, here: boolean, change: number | null, session: string | null) {
  for (const listener of writeListeners) {
    try {
      listener(app, here, change, session);
    } catch (error) {
      console.error(error);
    }
  }
}

function writes(): BroadcastChannel | null {
  if (writesChannel !== undefined) return writesChannel;
  try {
    writesChannel =
      typeof BroadcastChannel === "function" ? new BroadcastChannel(WRITES_CHANNEL) : null;
  } catch {
    writesChannel = null;
  }
  // Outside a browser (the tests' Node), the channel must not keep the process alive.
  (writesChannel as { unref?: () => void } | null)?.unref?.();
  if (writesChannel) {
    writesChannel.onmessage = (
      event: MessageEvent<{ app?: unknown; session?: unknown; change?: unknown }>,
    ) => {
      const { app, session, change } = event.data ?? {};
      const named = typeof change === "number" && Number.isSafeInteger(change) ? change : null;
      // Only a tab showing the same person's desktop: another session is someone else's.
      if (typeof app === "string" && session === desktopSession) {
        tellWrite(app, false, named, desktopSession);
      }
    };
  }
  return writesChannel;
}

function announceWrite(app: string, change: number | null, session: string | null) {
  tellWrite(app, true, change, session);
  try {
    writes()?.postMessage({ app, session, change });
  } catch {
    // A closed channel: the other tabs hear of it from the server's change counts instead.
  }
}

/**
 * Hear every write to an app that succeeded: `here` when this page made it, otherwise another
 * tab of this browser showing the same session's desktop (the person's change counts on the live
 * stream cannot tell two tabs of one browser apart), with the change number its reply named.
 * Returns the unsubscribe.
 */
export function onAppWrite(listener: AppWriteListener): () => void {
  writes();
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

/** Keep a restored desktop from sending every app's reads at once. One place is
 * reserved for writes so a busy set of reads cannot hold up a person's change. */
const API_IN_FLIGHT = 4;
const API_READS_IN_FLIGHT = 3;
type WaitingRequest = { read: boolean; start: () => void };
const waitingRequests: WaitingRequest[] = [];
let activeRequests = 0;
let activeReads = 0;

function drainRequests(): void {
  while (activeRequests < API_IN_FLIGHT) {
    const index = waitingRequests.findIndex(
      (request) => !request.read || activeReads < API_READS_IN_FLIGHT,
    );
    if (index < 0) return;
    const request = waitingRequests[index];
    if (!request) return;
    waitingRequests.splice(index, 1);
    activeRequests += 1;
    if (request.read) activeReads += 1;
    request.start();
  }
}

function limitedFetch(
  url: string,
  init: RequestInit | undefined,
  generation: number,
  boundSession: boolean,
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const read = method === "GET" || method === "HEAD";
  const pathname = url.split("?", 1)[0] ?? url;
  // Identity changes and unload writes must not wait behind app loads. Streams
  // and non-API requests are not workers on the desktop's request queue.
  const identityChanges = new Set([
    "/api/session/sign-up",
    "/api/session/sign-in",
    "/api/session/guest",
    "/api/session/sign-out",
    "/api/session/lock",
    "/api/session/unlock",
    "/api/session/password",
    "/api/session/adopt",
  ]);
  if (!url.startsWith("/api/") || (!read && identityChanges.has(pathname)) || init?.keepalive) {
    return fetch(url, init);
  }
  return new Promise<Response>((resolve, reject) => {
    const signal = init?.signal;
    const aborted = () =>
      reject(signal?.reason ?? new DOMException("Request aborted", "AbortError"));
    if (signal?.aborted) {
      aborted();
      return;
    }
    const entry: WaitingRequest = {
      read,
      start: () => {
        signal?.removeEventListener("abort", cancel);
        const release = () => {
          activeRequests -= 1;
          if (read) activeReads -= 1;
          drainRequests();
        };
        if ((!read || boundSession) && generation !== desktopSessionGeneration) {
          reject(new DOMException("The desktop session changed", "AbortError"));
          release();
          return;
        }
        try {
          fetch(url, init).then(resolve, reject).finally(release);
        } catch (error) {
          reject(error);
          release();
        }
      },
    };
    const cancel = () => {
      const index = waitingRequests.indexOf(entry);
      if (index >= 0) waitingRequests.splice(index, 1);
      aborted();
      drainRequests();
    };
    waitingRequests.push(entry);
    signal?.addEventListener("abort", cancel, { once: true });
    drainRequests();
  });
}

function gatedFetch(
  url: string,
  init: RequestInit | undefined,
  generation: number,
  boundSession: boolean,
): Promise<Response> {
  if (sessionCookieSet) return limitedFetch(url, init, generation, boundSession);
  if (firstRequest) {
    const first = firstRequest;
    const signal = init?.signal;
    return new Promise<Response>((resolve, reject) => {
      const cancel = () =>
        reject(signal?.reason ?? new DOMException("Request aborted", "AbortError"));
      if (signal?.aborted) {
        cancel();
        return;
      }
      signal?.addEventListener("abort", cancel, { once: true });
      first.then(() => {
        signal?.removeEventListener("abort", cancel);
        if (!signal?.aborted) gatedFetch(url, init, generation, boundSession).then(resolve, reject);
      });
    });
  }
  // A signal of its own, so that a reply too late to wait on can be cancelled; the caller's
  // signal still cancels it (forwarded by hand: WebKit never ends a request cancelled through
  // `AbortSignal.any`).
  const cancel = new AbortController();
  const callerSignal = init?.signal;
  const forward = () => cancel.abort(callerSignal?.reason);
  if (callerSignal?.aborted) forward();
  else callerSignal?.addEventListener("abort", forward, { once: true });
  const request = fetch(url, { ...init, signal: cancel.signal });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let answered = false;
  const settled = new Promise<void>((resolve) => {
    // Too slow to wait on: it is cancelled, and the next request goes alone in its place, never
    // all of them at once.
    timer = setTimeout(() => {
      if (answered) return;
      cancel.abort(new DOMException("no reply in time", "TimeoutError"));
      resolve();
    }, FIRST_REPLY_WAIT_MS);
    request.then(
      (response) => {
        answered = true;
        if (!(response.status >= 500)) sessionCookieSet = true;
        resolve();
      },
      () => {
        answered = true;
        resolve();
      },
    );
  });
  const gate: Promise<void> = settled.then(() => {
    clearTimeout(timer);
    // The caller's signal stays forwarded: it may still cancel the reading of the reply's body.
    if (firstRequest === gate) firstRequest = null;
  });
  firstRequest = gate;
  return request;
}

/** How long one request to the desktop's `/api/`, with the reading of its reply, may take. */
export const REQUEST_DEADLINE_MS = 15_000;

/** The longest save sent `keepalive`: at three bytes a character, a few may be in flight at once. */
const KEEPALIVE_CHARS = 8_192;

/** Where a document kept over a reload leaves its unsaved body, in the tab's session storage. */
const LEFT_PREFIX = "macalicious.left.";

/**
 * Runs `request` with a signal that is aborted after `ms`, and settles by then whatever `request`
 * does: at the deadline the signal is aborted and the returned promise rejects with a
 * `TimeoutError`, even if `request` never settles (it waits in the first-request gate, or does not
 * heed its signal). A request that hangs, or whose reply's body never finishes, so fails like one
 * that could not be sent, and the caller's own recovery (a retry, the next poll) runs instead of
 * waiting for good. Pass the signal to `sessionFetch` and read the reply inside `request`.
 */
export function withDeadline<T>(
  request: (signal: AbortSignal) => Promise<T>,
  ms: number = REQUEST_DEADLINE_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const reason = new DOMException("no reply in time", "TimeoutError");
      controller.abort(reason);
      reject(reason);
    }, ms);
  });
  const attempt = (async () => request(controller.signal))();
  return Promise.race([attempt, expired]).finally(() => clearTimeout(timer));
}

/**
 * The server session the page's documents named, and whether it has ended. The session is the
 * cookie's, shared by every document of every demo. When a load of any document names another
 * one (the cookie was replaced or expired), everything the page holds belongs to the old
 * session: from then on no document of the page saves anything or takes any reply, and the page
 * is loaded again (`onSessionEnd`), so that every window starts from the new session's
 * documents.
 */
let pageSession: string | null = null;
let sessionEnded = false;
let sessionEndHandler: (() => void) | null = null;
// What each document of the page drops when the session ends: the bodies of the old session it
// had not yet saved.
const dropOnSessionEnd = new Set<() => void>();

/** The `sessionStorage` key holding when this tab last reloaded for a new session. */
export const SESSION_RELOAD_KEY = "macalicious-session-reload";
/** The least time between two reloads for a new session in one tab. */
const RELOAD_GUARD_MS = 60_000;
// A navigation can remain pending while old requests finish (or another tab sends news).
let sessionReloadPending = false;

/** A new deliberate account action may retry navigation canceled by a beforeunload prompt. */
export function beginAccountAction(): void {
  sessionReloadPending = false;
}

/**
 * Load the page again for a new server session, at most once a minute in a tab: a browser that
 * keeps no cookie names a new session on every request, and must not reload forever. Without
 * session storage, which keeps that guard, it does not reload at all. Returns whether it
 * reloaded; when it did not, the page stays as it is and saves nothing more. A
 * confirmed account change may navigate even after a recent reload or with storage blocked;
 * the per-document guard still prevents a late stale-session reply from navigating twice.
 */
export function reloadForNewSession(
  reload: () => void = () => window.location.reload(),
  now: number = Date.now(),
  reason: "session-ended" | "account-change" = "session-ended",
): boolean {
  if (sessionReloadPending) return false;
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  let last = Number.NaN;
  try {
    last = Number(storage?.getItem(SESSION_RELOAD_KEY) ?? Number.NaN);
  } catch {
    storage = null;
  }
  if (
    reason === "session-ended" &&
    Number.isFinite(last) &&
    now - last >= 0 &&
    now - last < RELOAD_GUARD_MS
  ) {
    console.error(
      "Macalicious's server session changed again right after a reload; the page saves nothing more. Load it again to continue.",
    );
    return false;
  }
  // Without storage, implicit session refusals must not loop. Confirmed account changes
  // retain their previous ability to leave the old desktop even when storage is blocked.
  try {
    if (!storage) throw new Error("no session storage");
    storage.setItem(SESSION_RELOAD_KEY, String(now));
  } catch {
    if (reason === "session-ended") {
      console.error(
        "Macalicious's server session changed; the page saves nothing more. Load it again to continue.",
      );
      return false;
    }
  }
  sessionReloadPending = true;
  reload();
  return true;
}

/**
 * Handle the end of the page's server session in place of loading the page again (the
 * default), for instance to tell the person first. Returns the cleanup.
 */
export function onSessionEnd(handler: () => void): () => void {
  sessionEndHandler = handler;
  return () => {
    if (sessionEndHandler === handler) sessionEndHandler = null;
  };
}

/**
 * Whether a reply to a request outside the documents (the Today widgets, the live stream's
 * ticket) belongs to the page's server session. A 409 saying the page's session has ended or
 * changed (`session_ended`, `session_changed`, or the session named, from `src/lib.rs`), or a
 * reply naming another session than the page's, ends the page's session, as a document's load
 * does, and is refused: nothing of it is shown.
 */
export function replyOfPageSession(status: number, body: unknown): boolean {
  if (sessionEnded) return false;
  const refusal = body as { session_ended?: unknown; session_changed?: unknown } | null;
  const named = sessionOf(body);
  const refused =
    status === 409 &&
    (refusal?.session_ended === true || refusal?.session_changed === true || named !== null);
  if (refused || (status < 300 && named && pageSession && named !== pageSession)) {
    endSession();
    return false;
  }
  return true;
}

function endSession() {
  if (sessionEnded) return;
  sessionEnded = true;
  for (const drop of dropOnSessionEnd) drop();
  dropOnSessionEnd.clear();
  try {
    if (sessionEndHandler) sessionEndHandler();
    else reloadForNewSession();
  } catch (error) {
    console.error(error);
  }
}

/** Fields of a reply that carry the transport, not the document: its revision and session. */
const TRANSPORT = new Set(["rev", "session"]);

/**
 * Whether a `GET` reply holds `body`, as JSON: the same document, field for field, apart from
 * the transport fields. Each body is the whole document, so a field the reply has and the body
 * lacks is a field the body removes. An absent field counts as `null`, which is how the server
 * answers a part never saved.
 */
function holds(reply: unknown, body: object): boolean {
  const stored = (reply ?? {}) as Record<string, unknown>;
  const own = body as Record<string, unknown>;
  const same = (key: string) =>
    TRANSPORT.has(key) || JSON.stringify(stored[key] ?? null) === JSON.stringify(own[key] ?? null);
  return Object.keys(own).every(same) && Object.keys(stored).every(same);
}

/** The transport fields of a reply, without its document. */
function transportOf(reply: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(reply).filter(([key]) => TRANSPORT.has(key)));
}

/**
 * The document a reply holds, without its transport fields and the `error` a 409 adds, or `null`
 * when it holds none (a refusal that carries only a revision).
 */
function documentOf(reply: unknown): Record<string, unknown> | null {
  if (reply === null || typeof reply !== "object" || Array.isArray(reply)) return null;
  const fields = Object.entries(reply).filter(([key]) => !TRANSPORT.has(key) && key !== "error");
  return fields.length > 0 ? Object.fromEntries(fields) : null;
}

/** Why a change was not kept: the document had changed elsewhere, and the merge kept nothing of it. */
export const CHANGED_ELSEWHERE = "it was changed elsewhere first, and that version is kept";

/**
 * Whether every value `body` changed from `was` is `theirs`' value too: a change the server's copy
 * already holds (another window made the same one), which was kept, not lost. Plain objects are
 * compared value by value; anything else whole. Only a change some value of which the server's
 * copy lacks is reported as not kept (`CHANGED_ELSEWHERE`).
 */
export function changeHeld(was: unknown, body: unknown, theirs: unknown): boolean {
  if (sameDocument(body, was)) return true;
  const plain = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  if (plain(body) && plain(theirs)) {
    const before = plain(was) ? was : {};
    for (const key of new Set([...Object.keys(body), ...Object.keys(before)])) {
      if (!changeHeld(before[key], body[key], theirs[key])) return false;
    }
    return true;
  }
  return sameDocument(body, theirs);
}

/** The header that names a save to the server, and the one a document's reply names its writes in
 * (`WRITE_HEADER`, `WRITES_HEADER` in `ferrite-apps/desktop/src/module.rs`). */
export const WRITE_HEADER = "x-macalicious-write";
export const WRITES_HEADER = "x-macalicious-writes";
/** The reply header naming whose data a page that named itself reached (`PERSON_HEADER` there). */
export const PERSON_HEADER = "x-macalicious-person";
/** How many writes a document names (`WRITES_KEPT` in `ferrite-apps/desktop/src/apps/document.rs`). */
const WRITES_KEPT = 16;
/** A tag for this page, so that the saves of two pages never share an id. */
const WRITE_PAGE =
  typeof crypto !== "undefined" && "getRandomValues" in crypto
    ? [...crypto.getRandomValues(new Uint8Array(8))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    : Math.random().toString(36).slice(2);
let writesNamed = 0;
/** A new id for a save. */
export const nextWriteId = () => {
  writesNamed += 1;
  return `${WRITE_PAGE}-${writesNamed}`;
};
/** The header a read carries, which asks the server to name the writes the document holds. */
export const NAMES_ITSELF = { [WRITE_HEADER]: WRITE_PAGE };

/** The writes a reply says its document holds, and the revision after which that list is complete;
 * `null` from a route that keeps no such list. */
export function writesOf(response: Response): { from: number; ids: Set<string> } | null {
  // A reply stood in for by a test may have no headers.
  const named = /^(\d+):(.*)$/.exec(response.headers?.get(WRITES_HEADER) ?? "");
  return named ? { from: Number(named[1]), ids: new Set(named[2]?.split(",")) } : null;
}

/** How many conflicts in a row one change meets before it waits for the next load or change. */
const MAX_CONFLICTS = 4;
/** How many bodies whose outcome is not known the channel remembers. */
const MAX_UNSURE = 8;
/** The refusals of a body as it is, after which a merge gives way to the server's copy. */
const REFUSED_AS_IS = new Set([400, 413, 422]);

export interface ServerDocumentOptions {
  /**
   * Keeps a body not yet stored when the page goes, in the tab's session storage, for the same
   * session's next page in that tab. For a document that holds no private words: settings.
   */
  keptOverReload?: boolean;
  /**
   * How the page's unsaved change meets a document that changed on the server since the page
   * last had it (a 409). `mergeDocuments` by default: the person's change is applied to the
   * server's copy (`document-merge.ts`).
   */
  merge?: DocumentMerge;
}

/**
 * Returns the page's channel to the document at `url`. Loads and saves run one at a time, in
 * the order given, so a load given after a save reads what that save stored; a body given
 * while another waits replaces it, as each body is the whole document.
 *
 * The channel keeps the document as the server last held it to the page's knowledge (`base`,
 * from the last load or stored save). A save answered 409 (the document changed elsewhere:
 * another tab, another browser, or a forget there) never sends the page's copy over the
 * server's. The page's newest body is merged onto the copy the refusal carries (read again when
 * it carries none) by `options.merge`, which applies the person's change to it
 * (`document-merge.ts`): nothing forgotten or deleted elsewhere comes back. Every window watching
 * the document is shown the result, and it is sent on the refusal's revision. When nothing of
 * the change is left, nothing is sent, and the change is reported to `onSaveFailure` listeners
 * as not kept (`CHANGED_ELSEWHERE`). A merged body the server refuses as it is (another 4xx)
 * gives way to the server's copy, which the windows are shown.
 *
 * A server failure (5xx) or a failed request is retried once, unless a newer body has been given
 * meanwhile. A save that still fails is logged and reported to `onSaveFailure` listeners, never
 * dropped silently; its body stays the page's newest unsaved one, which the next change replaces
 * and the next load of the document (a window opened again, or another browser's change heard)
 * merges onto what it reads and saves again. Nothing outlives the page, unless
 * `options.keptOverReload` says so: a body not yet stored when the page goes away is lost.
 *
 * Each `GET` names the server session. When a load of any document on the page names another
 * one, the page's session has ended (`onSessionEnd`): every document drops the bodies it had not
 * saved, stops saving and ignores every reply still to come, so nothing of the old session is
 * shown in, or saved into, the new one; then the page is loaded again. Nothing is reset in place.
 *
 * Only a body given by `save` (a change the person made) is ever sent, or its merge onto the
 * server's newer copy: a load sends nothing, apart from the page's own body whose save failed,
 * which it merges and gives again.
 */
export function createServerDocument(
  url: string,
  options: ServerDocumentOptions = {},
): ServerDocument {
  const merge = options.merge ?? mergeDocuments;
  let rev = 0;
  // The document as the server holds it under `rev`, as far as the page knows: what the person's
  // unsaved change is a change of.
  let base: object | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task);
    tail = result.catch(() => {});
    return result;
  };
  // Server revisions only grow, so a late reply never takes this page's revision back.
  const adopt = (reply: unknown) => {
    const next = (reply as { rev?: unknown } | null)?.rev;
    if (typeof next === "number" && Number.isSafeInteger(next) && next > rev) rev = next;
  };
  /**
   * A body as given: `gen` counts the bodies given, so the newest is `gen === given`. `merged`
   * marks a body made by merging the page's change onto the server's copy, and `conflicts`
   * counts the refusals in a row that led to it.
   */
  type Entry = { body: object; gen: number; merged: boolean; conflicts: number; write: string };
  let given = 0;
  let waiting: Entry | null = null;
  let queued = false;
  // The newest body given that the server is not yet known to hold: it outlives a save that
  // failed, so the next load merges it onto what it reads and saves it again.
  let pending: Entry | null = null;
  const stored = (entry: Entry) => {
    if (pending && entry.gen >= pending.gen) pending = null;
  };
  // Bodies sent whose outcome is not known (no answer by the deadline, a network error, a server
  // failure), newest last: the server may hold one of them after all, and a later change of the
  // person's is then a change of that body, not of `base`.
  let unsure: { body: object; write: string }[] = [];
  const sentUnsure = ({ body, write }: Entry) => {
    unsure = [...unsure.filter((kept) => kept.write !== write), { body, write }].slice(-MAX_UNSURE);
  };
  // The writes the last reply holding the server's copy said it holds.
  let heard: ReturnType<typeof writesOf> = null;
  /**
   * What the person's newest change was made on, given `current`, a reply holding the server's
   * copy, read before its revision is taken: the page's own body when the server holds it (`own`),
   * or holds it under what others wrote since, as the writes it names say; and otherwise `base`,
   * so that a body that never arrived is merged and sent again. `heldOn` is what a change is
   * compared with to say whether the server's copy kept it.
   *
   * The writes do not say when the server keeps no such list (a route of its own, or a reply of
   * an earlier build), when its list is complete only from after this page's revision (the document
   * was written by a build that kept none, which may have stored the page's body), or when it may
   * have forgotten the write among as many as were made since. Then the
   * revision is all there is: one write since `base` that left another copy was someone else's;
   * after two or more the page's body may be one of them, changed on top elsewhere, and it is taken
   * as stored, so that nothing deleted on top of it comes back, and the person is told when the
   * server's copy does not hold the change, since it may never have arrived.
   */
  const madeOn = (current: object): { was: object | null; own: boolean; heldOn: object | null } => {
    const theirs = documentOf(current) ?? {};
    const sent = [...unsure].reverse();
    const writes = heard;
    unsure = [];
    heard = null;
    const own = sent.find(({ body }) => sameDocument(body, theirs));
    if (own) return { was: own.body, own: true, heldOn: own.body };
    const next = (current as { rev?: unknown }).rev;
    if (writes && rev >= writes.from && (typeof next !== "number" || next - rev <= WRITES_KEPT)) {
      const stored = sent.find(({ write }) => writes.ids.has(write));
      const was = stored ? stored.body : base;
      return { was, own: false, heldOn: was };
    }
    const maybeUnder = typeof next === "number" ? next >= rev + 2 : !sameDocument(theirs, base);
    const newest = sent[0]?.body;
    return { was: maybeUnder && newest ? newest : base, own: false, heldOn: base };
  };
  dropOnSessionEnd.add(() => {
    pending = null;
    waiting = null;
  });
  // The windows watching the document, by key, and the last body given, as JSON.
  const watchers = new Map<object, (body: object, seq: number) => void>();
  // Numbers every body told, in order.
  let told = 0;
  const loadMarks = new WeakMap<object, number>();
  let lastGiven: string | null = null;
  // What the last load read, until a body is given: a window shown it saves nothing back.
  let lastLoaded: unknown = null;
  // What the caller that watches nothing last had of the document (one that loads and saves
  // without naming a window: System Preferences' settings, Music's playback): what its last load
  // returned, or the body it last gave since. It is told nothing that changes the document, so its next
  // body is a change of that, applied to the document as the page holds it now. `droppedOn` is the
  // copy on which a change of it was last reported as not kept, so that it is told once.
  let unwatched: object | null = null;
  let droppedOn: object | null = null;
  const tell = (text: string, except?: object) => {
    told += 1;
    deliver(text, told, except);
  };
  const deliver = (text: string, seq: number, except?: object) => {
    for (const [key, listener] of watchers) {
      if (key === except) continue;
      try {
        listener(JSON.parse(text) as object, seq);
      } catch (error) {
        console.error(error);
      }
    }
  };
  const give = (
    body: object,
    from?: object,
    how: { merged?: boolean; conflicts?: number; send?: boolean } = {},
  ): Entry => {
    given += 1;
    // A snapshot: a caller that changes its object later changes neither this body nor its
    // retry.
    const text = JSON.stringify(body);
    lastGiven = text;
    lastLoaded = null;
    const entry = {
      body: JSON.parse(text) as object,
      gen: given,
      merged: how.merged ?? false,
      conflicts: how.conflicts ?? 0,
      write: nextWriteId(),
    };
    pending = entry;
    if (how.send ?? true) queue(entry);
    // A window saves from an effect, where a listener's `flushSync` could not render. A body given
    // since is the whole document, and replaces this one for every window.
    told += 1;
    const seq = told;
    queueMicrotask(() => {
      if (seq === told) deliver(text, seq, from);
    });
    return entry;
  };
  const pump = async () => {
    queued = false;
    const entry = waiting;
    waiting = null;
    if (entry) await put(entry);
  };
  const queue = (entry: Entry) => {
    waiting = entry;
    if (queued) return;
    queued = true;
    void enqueue(pump);
  };
  /** The page's change `body`, made on `was`, merged onto the server's copy `theirs`. */
  const mergeChange = (was: object | null, body: object, theirs: object): object => {
    try {
      return merge(was, body, theirs);
    } catch (error) {
      // A merge that fails keeps the server's copy: nothing is sent over it.
      console.error(error);
      return theirs;
    }
  };

  /**
   * The server holds `current` (a reply: the document with its revision), newer than the page's
   * base: the page's newest body not yet stored is merged onto it and given in its place, to be
   * sent on its revision, or dropped when nothing of it is left. `entry` is the save refused.
   */
  function rebase(current: object, entry: Entry) {
    const theirs = documentOf(current) ?? {};
    // The server may hold a body of this page's whose answer never came: then that is what the
    // person's newest change was made on, and the refusal is no change made elsewhere.
    const before = base;
    const { was, own, heldOn } = madeOn(current);
    adopt(current);
    base = theirs;
    // The person's newest change: one given while this save was under way, or this save's.
    const newest = waiting ?? (entry.gen === given ? entry : pending);
    if (!newest) return;
    const result = mergeChange(was, newest.body, theirs);
    if (sameDocument(result, theirs)) {
      // Nothing of the change is left: the server's copy is what every window shows.
      waiting = null;
      stored(newest);
      if (sameDocument(newest.body, theirs)) return;
      if (!own && !sameDocument(newest.body, before) && !changeHeld(heldOn, newest.body, theirs)) {
        reportFailure({ url, reason: CHANGED_ELSEWHERE });
      }
      const shown = { ...transportOf(current), ...theirs };
      lastGiven = null;
      lastLoaded = shown;
      tell(JSON.stringify(shown));
      return;
    }
    const conflicts = entry.conflicts + 1;
    // Refused again and again: the document keeps changing elsewhere. The merge is kept as the
    // page's unsaved body, which the next load or change sends.
    const send = conflicts < MAX_CONFLICTS;
    waiting = null;
    give(result, undefined, { merged: true, conflicts, send });
    if (!send) reportFailure({ url, reason: "the document kept changing elsewhere" });
  }

  /**
   * One `GET` of the document: its reply when it is one this page can read, or `undefined`. A
   * reply naming another session than the page's ends the page's session.
   */
  async function read(): Promise<Record<string, unknown> | undefined> {
    // A load the server never finishes, its body included, fails at its deadline, so the
    // document's queue moves on.
    const answer = await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        credentials: "same-origin",
        headers: { accept: "application/json", ...NAMES_ITSELF },
        signal,
      });
      if (response.ok) {
        heard = writesOf(response);
        return { body: (await response.json()) as unknown };
      }
      // A page left on a session that has ended or changed is answered 409, saying so
      // (`session_ended`) or naming the session now (`session`, in `src/lib.rs`).
      if (response.status === 409) {
        return { refused: (await response.json().catch(() => null)) as unknown };
      }
      return undefined;
    });
    if (answer === undefined || sessionEnded) return undefined;
    if ("refused" in answer) {
      const refused = answer.refused as {
        session_ended?: unknown;
        session_changed?: unknown;
      } | null;
      if (
        refused?.session_ended === true ||
        refused?.session_changed === true ||
        sessionOf(refused) !== null
      )
        endSession();
      return undefined;
    }
    const reply = answer.body;
    // Every document is a JSON object. Any other reply, though answered 200, is not one this
    // page can read: the load has failed, and nothing is saved over the server's copy.
    if (reply === null || typeof reply !== "object" || Array.isArray(reply)) return undefined;
    // Another session than the page's (the cookie was replaced): the page's session has ended,
    // and this reply is not shown in it.
    const named = sessionOf(reply);
    if (named && pageSession && named !== pageSession) {
      endSession();
      return undefined;
    }
    if (named) pageSession = named;
    return reply as Record<string, unknown>;
  }

  // `keepalive` lets a save outlive the page, so a reload right after a change keeps it. Browsers
  // refuse such a request past 64 KiB in flight, so only a short body asks, and only on its first
  // send.
  const send = (entry: Entry, signal: AbortSignal, attempt: number): Promise<Response> => {
    const body = JSON.stringify(
      // The session the page loaded under: the server refuses a save from a replaced one.
      pageSession ? { ...entry.body, rev, session: pageSession } : { ...entry.body, rev },
    );
    return sessionFetch(url, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json", [WRITE_HEADER]: entry.write },
      body,
      keepalive: attempt === 0 && body.length < KEEPALIVE_CHARS,
      signal,
    });
  };

  async function put(entry: Entry) {
    let reason = "";
    let detail: string | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      // A newer body has been given since: this one is superseded, and sending it again,
      // whatever failed, could only undo the newer one.
      if (attempt > 0 && entry.gen !== given) return;
      // The page's session has ended: nothing more is saved, and no reply is taken.
      if (sessionEnded) return;
      detail = undefined;
      try {
        // A save the server never answers fails at its deadline and is sent again like one that
        // could not be sent. A reply whose body never finishes is read as no body.
        const { response, reply } = await withDeadline(async (signal) => {
          const response = await send(entry, signal, attempt);
          return { response, reply: await readJson(response) };
        });
        if (sessionEnded) return;
        // The server answers for another session than the page's (the cookie was replaced), or
        // says the page's session has just ended (`session_ended`, a 409 from `src/lib.rs`): the
        // page's session has ended, and nothing of this reply is taken.
        const named = sessionOf(reply);
        const flags = reply as { session_ended?: unknown; session_changed?: unknown } | null;
        const ended = flags?.session_ended === true || flags?.session_changed === true;
        if (ended || (named && pageSession && named !== pageSession)) {
          endSession();
          return;
        }
        if (response.ok) {
          adopt(reply);
          // What the server stores under the new revision is the body sent.
          base = entry.body;
          unsure = [];
          stored(entry);
          return;
        }
        if (response.status === 409) {
          // The document changed elsewhere. The refusal carries the server's copy; one that
          // does not is read.
          heard = writesOf(response);
          const current = documentOf(reply)
            ? (reply as object)
            : await read().catch(() => undefined);
          if (sessionEnded) return;
          if (!current) {
            reason = "the document changed elsewhere and could not be read";
            break;
          }
          rebase(current, entry);
          return;
        }
        reason = `HTTP ${response.status}`;
        // The server's words for a refusal, not for a failure of its own.
        const said = response.status < 500 ? (reply as { error?: unknown } | null)?.error : null;
        detail = typeof said === "string" && said ? said : undefined;
        // A refused body (400) is refused again; only a server failure is worth a retry.
        if (response.status < 500) {
          // A merge the server refuses as it is (a list grown past its limit, an item naming one
          // removed elsewhere) gives way to the server's copy, unless the person changed it since.
          // Any other refusal (a locked screen) keeps it as the page's unsaved body.
          if (entry.merged && entry.gen === given && base && REFUSED_AS_IS.has(response.status)) {
            stored(entry);
            lastGiven = null;
            lastLoaded = base;
            tell(JSON.stringify(base));
          }
          break;
        }
        // A server failure may come after the body was stored.
        sentUnsure(entry);
      } catch (error) {
        // No answer: the body may have been stored all the same.
        sentUnsure(entry);
        reason = error instanceof Error ? error.message : String(error);
      }
    }
    reportFailure(detail ? { url, reason, detail } : { url, reason });
  }

  // The page is going with a body not yet stored: the same tab's next page takes it up in its first
  // load, which merges it onto what the server holds. Only for the same session, and never kept once read.
  if (options.keptOverReload && typeof window !== "undefined") {
    // A page going into the browser's page cache is not gone: it carries on with its save if it comes back.
    window.addEventListener("pagehide", (event) => {
      if (event.persisted || !pending || sessionEnded) return;
      try {
        sessionStorage.setItem(
          `${LEFT_PREFIX}${url}`,
          JSON.stringify({ session: pageSession, body: pending.body, base }),
        );
      } catch {
        // No room for it: the body goes with the page, as any other document's does.
      }
    });
  }
  let leftTaken = !options.keptOverReload;
  /**
   * The body the last page of this tab left, when `reply` is for the session that left it. A body
   * this page has given since is newer and is the one kept; storage that cannot be read, or a record
   * that is not one, leaves nothing.
   */
  const takeLeft = (reply: unknown) => {
    if (leftTaken) return;
    leftTaken = true;
    const key = `${LEFT_PREFIX}${url}`;
    let left: unknown = null;
    try {
      const text = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
      left = text === null ? null : JSON.parse(text);
    } catch {
      return;
    }
    const isDocument = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    if (!isDocument(left) || !isDocument(left.body) || left.session !== sessionOf(reply)) return;
    if (given > 0) return;
    base = isDocument(left.base) ? left.base : null;
    given += 1;
    pending = {
      body: left.body,
      gen: given,
      merged: false,
      conflicts: 0,
      write: nextWriteId(),
    };
  };

  return {
    load: (from) =>
      enqueue(async () => {
        // A load reads what every save given before it stored.
        if (waiting) await pump();
        if (sessionEnded) return undefined;
        // Every body told so far was given before this request, or read by a load before it:
        // the reply holds it, or something newer.
        const mark = told;
        try {
          const reply = await read();
          if (reply === undefined || sessionEnded) return undefined;
          takeLeft(reply);
          const theirs = documentOf(reply) ?? {};
          const before = base;
          const { was, own: ownStored, heldOn } = madeOn(reply);
          adopt(reply);
          base = theirs;
          // The server may hold another body than the last one given here (another tab saved):
          // after a load, no body counts as one already given, and what the server holds is
          // no change to save.
          lastGiven = null;
          lastLoaded = reply;
          // This page's newest body, whose save failed: unless the server holds it already, it
          // is merged onto what the server holds, shown and saved again.
          const own = pending;
          if (own) {
            const held = sameDocument(theirs, own.body);
            const result = held ? theirs : mergeChange(was, own.body, theirs);
            if (sameDocument(result, theirs)) {
              // Nothing to send: neither it nor a change given while this load was under way,
              // which `own` is or includes.
              stored(own);
              waiting = null;
              if (
                !held &&
                !ownStored &&
                !sameDocument(own.body, before) &&
                !changeHeld(heldOn, own.body, theirs)
              ) {
                reportFailure({ url, reason: CHANGED_ELSEWHERE });
              }
            } else {
              // `give` tells every watching window, the loading one included.
              const entry = give(result, undefined, { merged: true });
              if (from) loadMarks.set(from, mark);
              // The body is the whole document: none of the stored one's fields remain.
              if (from === undefined) unwatched = entry.body;
              return { ...transportOf(reply), ...entry.body };
            }
          }
          // Every other window shows what the server holds now, as the loading one will.
          tell(JSON.stringify(reply), from);
          if (from) loadMarks.set(from, mark);
          if (from === undefined) unwatched = theirs;
          return reply;
        } catch {
          return undefined;
        }
      }),
    save: (body, from) => {
      if (sessionEnded) return;
      // Equal to the last body given: a window showing what another gave, saving it back.
      if (JSON.stringify(body) === lastGiven) return;
      // What the last load read, with nothing given since: a window showing it, saving it back.
      if (lastGiven === null && lastLoaded !== null && holds(lastLoaded, body)) return;
      if (from !== undefined) {
        give(body, from);
        return;
      }
      // A caller that watches nothing: its body is a change of what it last had, which may no
      // longer be what the page holds (a load it did not make read another browser's change, or
      // a conflict merged its last body).
      // Until it has loaded, what it had is not known, and its body is saved as it is.
      const seen = unwatched;
      if (seen === null) {
        give(body);
        return;
      }
      const now = pending?.body ?? base;
      unwatched = JSON.parse(JSON.stringify(body)) as object;
      if (now === null || sameDocument(seen, now)) {
        give(body);
        return;
      }
      const result = mergeChange(seen, body, now);
      if (!sameDocument(result, now)) {
        give(result, undefined, { merged: true });
        return;
      }
      // Nothing of the change is left (the document was forgotten elsewhere): nothing is sent.
      if (!sameDocument(body, seen) && droppedOn !== now && !changeHeld(seen, body, now)) {
        droppedOn = now;
        reportFailure({ url, reason: CHANGED_ELSEWHERE });
      }
    },
    watch: (key, listener) => {
      watchers.set(key, listener);
      return () => {
        if (watchers.get(key) === listener) watchers.delete(key);
      };
    },
    idle: async () => {
      for (;;) {
        const current = tail;
        await current;
        if (current === tail) return;
      }
    },
    loadedAt: (key) => loadMarks.get(key) ?? 0,
    revision: () => rev,
  };
}

/** The page's one channel per document, shared by every window that keeps it. */
// Names the loads `reloadServerDocuments` makes: no caller of the document asked for them.
const RELOADED = {};
const documents = new Map<string, ServerDocument>();

/**
 * The page's channel to the document at `url`. Every window of a demo, and a window opened
 * again after one was closed, loads and saves through the same one, so its loads and saves
 * never overlap and it always holds the revision the server last answered. `options` apply when
 * the page first asks for the document, which makes its one channel.
 */
export function serverDocument(url: string, options?: ServerDocumentOptions): ServerDocument {
  let channel = documents.get(url);
  if (!channel) {
    channel = createServerDocument(url, options);
    documents.set(url, channel);
  }
  return channel;
}

/**
 * Load again every document of the app `app` (`/api/<app>/…`) this page holds: the person changed
 * it in another browser (`desktop-live.ts`). Each load runs after the saves already given, and
 * every window of the document is shown what it read, as when a window opens.
 */
export function reloadServerDocuments(app: string): void {
  const prefix = `/api/${app}/`;
  for (const [url, channel] of documents) {
    if (url.startsWith(prefix)) void channel.load(RELOADED);
  }
  for (const [url, reload] of otherReloads) {
    if (url.startsWith(prefix)) reload();
  }
}

/**
 * The reloads of the documents this page keeps without `serverDocument` (the synced documents of
 * Notes, Reminders and Stickies, `synced-document.ts`), by address: `reloadServerDocuments`
 * runs them too, so a change made in another tab or browser reaches those windows as well.
 */
const otherReloads = new Map<string, () => void>();

/**
 * Have `reloadServerDocuments` read the document at `url` again with `reload`, for a document the
 * page keeps without `serverDocument`. One reload per address; returns the undo.
 */
export function onReloadServerDocument(url: string, reload: () => void): () => void {
  otherReloads.set(url, reload);
  return () => {
    if (otherReloads.get(url) === reload) otherReloads.delete(url);
  };
}

export interface ServerStateOptions<T> {
  /** The document's address: `/api/<demo>/<document>`. */
  url: string;
  /** Whether to load and save at all: normally `servedByDesktopApp()`. */
  enabled: boolean;
  /** The state to keep: saved after every change that follows a successful load. */
  value: T;
  /** Called with what a successful `GET` answered, with every body another window of the
   * document gives, and with what a save that met a newer copy elsewhere became (the person's
   * change merged onto that copy, or the copy itself); the demo adopts what it can use.
   * Returning `false` from the first load says the document could not be read: nothing is then
   * saved over it, as after a failed load. */
  onLoad: (stored: unknown) => unknown;
  /** The `PUT` body for a value: the whole document, without its revision. */
  toBody: (value: T) => object;
  /** How a change meets a newer copy saved elsewhere (`ServerDocumentOptions`); read when the
   * page first asks for the document. */
  merge?: DocumentMerge;
}

/**
 * Keeps one piece of a demo's state on the server: loads it when the component mounts, then
 * saves it whenever it changes. Nothing is saved before the load has succeeded, so a server
 * that could not be read is never overwritten with the demo's starting data.
 *
 * Returns whether the first load is still under way. The demo makes its content inert while
 * it is (`inert={pending || undefined}`), so that no change can be made that the load would
 * then replace. A load that fails, or whose document `onLoad` cannot read, ends the wait too:
 * the demo works on what it shows and saves nothing, as without the server.
 */
export function useServerState<T>(options: ServerStateOptions<T>): boolean {
  const { url, enabled, value, merge } = options;
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: a channel keeps the merge of the document it was made for, the one named in the render that made it
  const channel = useMemo(() => serverDocument(url, { merge }), [url]);
  // The channel whose load succeeded, and the one whose load answered, in this lifecycle of
  // `channel` and `enabled`: a new address, or turning saving on again, starts over.
  const [loadedFor, setLoadedFor] = useState<ServerDocument | null>(null);
  const [settledFor, setSettledFor] = useState<ServerDocument | null>(null);
  const loaded = enabled && loadedFor === channel;
  // The channel whose first loaded render has been seen: that render is no change to save.
  const shown = useRef<ServerDocument | null>(null);
  // This window, to the channel: its own saves are not given back to it.
  const key = useRef({});
  // The channel whose load succeeded, read by the watcher outside rendering.
  const loadedRef = useRef<ServerDocument | null>(null);
  // The newest body another window gave while this one's load was under way, with its number:
  // shown once the load has succeeded if it was told after that load read the server.
  const missed = useRef<{ body: object; seq: number } | null>(null);
  // Counts the bodies other windows gave that this window applied. The render that shows one is
  // no change to save, whatever form the demo gives it (it may drop fields or normalise
  // values), so the save effect skips the render in which the count moved.
  const [applied, setApplied] = useState(0);
  const appliedSeen = useRef(0);

  // Another window of the document gave a body, or another window's load read one: show it, as
  // a load would. It is rendered now, with the demo's own updates in `onLoad`, so that it never
  // shares a render with a change the person makes next, which would then not be saved.
  useEffect(
    () =>
      channel.watch(key.current, (body, seq) => {
        if (loadedRef.current === channel) {
          flushSync(() => {
            setApplied((count) => count + 1);
            latest.current.onLoad(body);
          });
        } else missed.current = { body, seq };
      }),
    [channel],
  );

  useEffect(() => {
    setLoadedFor(null);
    setSettledFor(null);
    shown.current = null;
    loadedRef.current = null;
    missed.current = null;
    if (!enabled) return;
    let live = true;
    void channel.load(key.current).then((stored) => {
      if (!live) return;
      // A reply the demo cannot read is no load: nothing is saved over it.
      if (stored !== undefined && latest.current.onLoad(stored) !== false) {
        const newer = missed.current;
        missed.current = null;
        // Only a body told after this load sent its request can be newer than its reply.
        if (newer && newer.seq > channel.loadedAt(key.current)) latest.current.onLoad(newer.body);
        loadedRef.current = channel;
        setLoadedFor(channel);
      }
      setSettledFor(channel);
    });
    return () => {
      live = false;
    };
  }, [channel, enabled]);

  useEffect(() => {
    if (!loaded) return;
    // A render showing what another window gave is no change of this window's.
    if (appliedSeen.current !== applied) {
      appliedSeen.current = applied;
      if (shown.current === channel) return;
    }
    if (shown.current !== channel) {
      shown.current = channel;
      return;
    }
    channel.save(latest.current.toBody(value), key.current);
  }, [loaded, value, channel, applied]);

  return enabled && settledFor !== channel;
}
