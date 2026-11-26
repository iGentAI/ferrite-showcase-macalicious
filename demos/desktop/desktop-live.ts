import {
  appWritesSettled,
  appWritesUnderWay,
  currentDesktopSession,
  onAppWrite,
  REQUEST_DEADLINE_MS,
  reloadServerDocuments,
  replyOfPageSession,
  sessionFetch,
  withDeadline,
} from "./desktop-server";

/**
 * The person's own live updates, when the desktop is served by its Ferrite application: one
 * connection per page to the personal stream (`/live/me`, `ferrite-apps/desktop/src/live.rs`),
 * shared by the banners and Notification Center.
 *
 * A stream open carries no cookie the server can read, so the page first asks for a ticket
 * (`POST /api/session/ticket`, naming the session the desktop was loaded for, so a page left over
 * from another person gets none) and opens the stream with it. The ticket is good once: every
 * reconnect asks for a new one. Each `state` event holds everything: the inbox (newest first), Do
 * Not Disturb, and how many changes the person made in each app and from which browser. When an
 * app's count moves by a change this page did not make, the documents of that app this page holds
 * are loaded again and `SERVER_CHANGE_EVENT` is dispatched, so every window of every browser of
 * the person shows the change. The reply to each of the page's writes names the number its change
 * was given (`CHANGE_HEADER`), and so do the browser's other tabs, which tell of their writes
 * themselves (`onAppWrite`): those changes are already shown here.
 */

/** A button of an alert besides Close. */
export interface InboxAction {
  label: string;
  /** A path under `/api/<app>` to POST to, or none for a button that opens the app. */
  post?: string;
}

/** One delivered notification (`Item` in `notification_center/mod.rs`). */
export interface InboxItem {
  seq: number;
  at_ms: number;
  app: string;
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  alert?: boolean;
  dismiss?: string;
  actions?: readonly InboxAction[];
}

export interface LiveState {
  /** Whether a `state` event has arrived since the page started listening. */
  ready: boolean;
  /** The person's notifications, newest first. */
  items: readonly InboxItem[];
  /** Do Not Disturb. */
  dnd: boolean;
  /** Whether the stream is open and heard from. */
  connected: boolean;
}

/**
 * Dispatched on `window` with `{ app }` when the person's data in `app` changed: in another browser
 * (the live stream), in another tab of this browser, or by a write of this page.
 */
export const SERVER_CHANGE_EVENT = "macalicious:server-change";
/** The ticket route (the router's, `src/lib.rs`). */
export const TICKET_URL = "/api/session/ticket";
export const INBOX_URL = "/api/notification-center/inbox";
export const DND_URL = "/api/notification-center/dnd";
/** Silence after which the stream is opened again: the server pings every 5 seconds. */
export const SILENCE_MS = 16_000;
/** The longest wait between two attempts to connect. */
const MAX_BACKOFF_MS = 30_000;

const APP_NAME = /^[a-z0-9-]{1,40}$/;
// No percent-escapes: no spelling of a path may leave the app's routes (as the server checks).
const PATH = /^\/[A-Za-z0-9/_.~@-]{0,199}$/;

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;
const path = (value: unknown): string | undefined => {
  const candidate = text(value);
  return candidate && PATH.test(candidate) && !candidate.includes("..") ? candidate : undefined;
};

/** The notifications of a `state`, as far as they can be shown; any other entry is dropped. */
export function itemsFromState(state: unknown): InboxItem[] {
  const items = (state as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: InboxItem[] = [];
  for (const entry of items) {
    const value = entry as Record<string, unknown> | null;
    if (typeof value !== "object" || value === null) continue;
    const app = text(value.app);
    const title = text(value.title);
    const id = text(value.id);
    if (!isCount(value.seq) || !isCount(value.at_ms) || !app || !APP_NAME.test(app)) continue;
    if (!title || !id) continue;
    const actions = Array.isArray(value.actions)
      ? value.actions.flatMap((action): InboxAction[] => {
          const label = text((action as Record<string, unknown> | null)?.label);
          if (!label) return [];
          const post = path((action as Record<string, unknown>).post);
          return [post ? { label, post } : { label }];
        })
      : [];
    out.push({
      seq: value.seq,
      at_ms: value.at_ms,
      app,
      id,
      title,
      subtitle: text(value.subtitle),
      body: text(value.body),
      alert: value.alert === true,
      dismiss: path(value.dismiss),
      actions,
    });
  }
  return out.sort((a, b) => b.seq - a.seq);
}

/** One app's change count: how many, the browser of the last, and when the count began. */
export interface ChangeCount {
  n: number;
  by: string;
  /** 0 for a count the server kept before it recorded this. */
  since: number;
}

/** The change counts of a `state`: `{ app: { n, by, since } }`. */
export function changesFromState(state: unknown): Map<string, ChangeCount> {
  const changes = (state as { changes?: unknown } | null)?.changes;
  const out = new Map<string, ChangeCount>();
  if (typeof changes !== "object" || changes === null) return out;
  for (const [app, change] of Object.entries(changes as Record<string, unknown>)) {
    const value = change as { n?: unknown; by?: unknown; since?: unknown } | null;
    if (APP_NAME.test(app) && isCount(value?.n) && typeof value?.by === "string") {
      out.set(app, { n: value.n, by: value.by, since: isCount(value.since) ? value.since : 0 });
    }
  }
  return out;
}

/**
 * The numbers of an app's changes counted after `before`, up to `after`, that are not among
 * `known` (the changes this page made, or another tab of this browser told it of), at most
 * `limit + 1` of them: past `limit` the caller only needs to know there are more.
 */
export function changesNotMadeHere(
  before: number,
  after: number,
  known: ReadonlySet<number> | undefined,
  limit = Number.POSITIVE_INFINITY,
): number[] {
  const out: number[] = [];
  for (let n = before + 1; n <= after && out.length <= limit; n += 1) {
    if (!known?.has(n)) out.push(n);
  }
  return out;
}

/** The most change numbers kept for an app before the stream has passed them. */
const MAX_KNOWN_CHANGES = 500;

const EMPTY: LiveState = { ready: false, items: [], dnd: false, connected: false };

let state: LiveState = EMPTY;
const listeners = new Set<() => void>();
let users = 0;
let stopCurrent: (() => void) | null = null;
let stopWrites: (() => void) | null = null;
/** Whether the desktop is showing (not covered by the login window or the lock screen). */
let allowed = true;
/** What the server last sent, before this page's own writes still under way are applied. */
let snapshot: { items: InboxItem[]; dnd: boolean } | null = null;
/**
 * Notifications this page is clearing, by number, and whether the server has said yes: they stay
 * off the screen until a state without them arrives (a state read before the clear may still
 * hold them), and come back if the clear failed.
 */
const clearing = new Map<number, { confirmed: boolean }>();
/**
 * Do Not Disturb as this page last set it, until a state agrees, the write fails, or (once the
 * server has said yes) [`DND_HOLD_MS`] pass: a newer value another browser set may be the only
 * one the stream ever carries, and it wins.
 */
let settingDnd: { on: boolean; confirmed: boolean } | null = null;
/**
 * How long a Do Not Disturb write the server confirmed is still shown by hand when no state
 * agrees. The stream reads the server every 250 ms, so by then it has carried the write, or a
 * newer change made elsewhere.
 */
export const DND_HOLD_MS = 2_000;
let dndHold: ReturnType<typeof setTimeout> | null = null;
/**
 * The change counts the page last heard, for the session they belong to: kept while the stream
 * is closed (the lock screen), so that what changed elsewhere meanwhile is loaded again when it
 * opens.
 */
let heardCounts: {
  session: string | null;
  counts: Map<string, ChangeCount>;
} | null = null;

/**
 * Changes of one app the stream counted that this page holds no number for, while writes of its
 * own to the app had no reply yet: each may be one of those writes', whose reply names it.
 */
interface Unplaced {
  numbers: Set<number>;
  /** The request deadline from the first of them: no change waits longer. */
  deadline: ReturnType<typeof setTimeout>;
}

/**
 * For the session they belong to: the change numbers, by app, of the writes this page made or
 * another tab of this browser told it of, that the counts heard have not yet passed; and the
 * changes, by app, still to be placed (`Unplaced`).
 */
let madeHere: {
  session: string | null;
  known: Map<string, Set<number>>;
  unplaced: Map<string, Unplaced>;
} = { session: null, known: new Map(), unplaced: new Map() };

/** `madeHere`, for the page's session now. */
function made() {
  const session = currentDesktopSession();
  if (madeHere.session !== session) madeHere = { session, known: new Map(), unplaced: new Map() };
  return madeHere;
}

/** Publish the last state the server sent, with this page's writes under way applied. */
function show() {
  if (!snapshot) return;
  setState({
    items: snapshot.items.filter((item) => !clearing.has(item.seq)),
    dnd: settingDnd ? settingDnd.on : snapshot.dnd,
  });
}

/** A state from the server: writes it shows done are no longer applied by hand. */
function takeSnapshot(items: InboxItem[], dnd: boolean) {
  snapshot = { items, dnd };
  for (const [seq, write] of clearing) {
    if (write.confirmed && !items.some((item) => item.seq === seq)) clearing.delete(seq);
  }
  if (settingDnd?.confirmed && settingDnd.on === dnd) settingDnd = null;
  setState({ ready: true, connected: true });
  show();
}

function setState(next: Partial<LiveState>) {
  state = { ...state, ...next };
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error(error);
    }
  }
}

/** The state now (for `useSyncExternalStore`). */
export function liveState(): LiveState {
  return state;
}

/** Hear every change of the state. Returns the unsubscribe. */
export function subscribeLive(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tell the page that `app`'s data changed; documents held here are loaded again unless `here`. */
function changed(app: string, here: boolean) {
  if (!here) reloadServerDocuments(app);
  window.dispatchEvent(new CustomEvent(SERVER_CHANGE_EVENT, { detail: { app } }));
}

/**
 * A write of this page, or of another tab of this browser, for `session`: its change is shown
 * here. Another tab's change is loaded, unless the stream counted it already and it was loaded
 * then (`reloadServerDocuments` loads every document again each time it is called).
 */
function wrote(app: string, here: boolean, change: number | null, session: string | null) {
  // A write for a session this page no longer shows says nothing of this one's.
  if (session !== currentDesktopSession()) return;
  if (change === null) {
    changed(app, here);
    return;
  }
  const { known, unplaced } = made();
  const heard = heardCounts?.session === madeHere.session ? heardCounts.counts.get(app)?.n : 0;
  const waiting = unplaced.get(app);
  if (waiting?.numbers.delete(change)) {
    // A change the stream counted while waiting for this reply: placed now.
    changed(app, here);
  } else if (change > (heard ?? 0)) {
    const numbers = known.get(app) ?? new Set<number>();
    numbers.add(change);
    // Too many for a stream that hears nothing: the oldest go, and their changes, should the
    // stream count them, only load the app once more.
    if (numbers.size > MAX_KNOWN_CHANGES) numbers.delete(Math.min(...numbers));
    known.set(app, numbers);
    changed(app, here);
  } else {
    // Counted already and not waiting: the stream loaded the app for it then.
    changed(app, true);
  }
}

/**
 * Forget the changes of `app` still to be placed, and with `numbers` the numbers kept for its
 * count too; whether changes were still to be placed.
 */
function forget(app: string, numbers: boolean): boolean {
  const { known, unplaced } = made();
  if (numbers) known.delete(app);
  const waiting = unplaced.get(app);
  if (!waiting) return false;
  clearTimeout(waiting.deadline);
  unplaced.delete(app);
  return waiting.numbers.size > 0;
}

/**
 * The stream counted changes of `app` from `before` to `after`: load the app again for any this
 * page did not make. A change it holds no number for while its own writes to the app have no
 * reply may be one of theirs, so it waits for those replies (`Unplaced`); when more such changes
 * wait than writes are under way, one cannot be the page's, and the app is loaded at once.
 */
function counted(app: string, before: number, after: number) {
  const { known, unplaced } = made();
  const numbers = known.get(app);
  const underWay = appWritesUnderWay(app);
  const waiting = unplaced.get(app);
  const others = changesNotMadeHere(before, after, numbers, underWay);
  for (const n of numbers ?? []) if (n <= after) numbers?.delete(n);
  if (numbers?.size === 0) known.delete(app);
  if (others.length === 0) return;
  const settled = appWritesSettled(app);
  if (!settled || others.length + (waiting?.numbers.size ?? 0) > underWay) {
    // Loaded now: that covers every change counted so far, the waiting ones too. The numbers
    // of the page's writes the counts have not reached yet stay.
    forget(app, false);
    changed(app, false);
    return;
  }
  const entry: Unplaced = waiting ?? {
    numbers: new Set(),
    deadline: setTimeout(() => place(app, entry), REQUEST_DEADLINE_MS),
  };
  for (const n of others) entry.numbers.add(n);
  unplaced.set(app, entry);
  // These changes wait only for the writes under way now: a write sent later cannot name a
  // change already counted. Loading the app for one of them covers the others waiting too.
  void settled.then(() => {
    if (madeHere.unplaced.get(app) === entry && others.some((n) => entry.numbers.has(n))) {
      place(app, entry);
    }
  });
}

/** Decide `entry`'s changes: the app is loaded for any that no reply has named. */
function place(app: string, entry: Unplaced) {
  // Superseded: loaded meanwhile, forgotten, or another session's.
  if (madeHere.unplaced.get(app) !== entry) return;
  clearTimeout(entry.deadline);
  madeHere.unplaced.delete(app);
  if (entry.numbers.size > 0) changed(app, false);
}

/**
 * Keep the personal stream open while at least one caller holds it. Returns the release; the
 * stream closes when the last caller has released it. While it is held, a write in another tab
 * of this browser (same session) reloads that app's documents here too. Writes made while
 * nothing holds it are not noted, on purpose: the counts heard next take their changes for
 * another's and load the app once more, which costs a load and never hides a change.
 */
export function holdLiveStream(): () => void {
  users += 1;
  if (users === 1) {
    if (allowed) stopCurrent = connect();
    stopWrites = onAppWrite(wrote);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users === 0) {
      stopCurrent?.();
      stopCurrent = null;
      stopWrites?.();
      stopWrites = null;
      state = EMPTY;
      snapshot = null;
      clearing.clear();
      settingDnd = null;
      if (dndHold) clearTimeout(dndHold);
      dndHold = null;
      dndWanted = null;
    }
  };
}

/** Whether the desktop is showing now, as `allowLiveStream` was last told. */
export function liveAllowed(): boolean {
  return allowed;
}

/**
 * Whether the desktop is showing (`desktop-accounts.tsx`): while the login window or the lock
 * screen covers it the stream is closed, and asks for no ticket the locked session would refuse;
 * it opens again when the desktop shows.
 */
export function allowLiveStream(on: boolean): void {
  if (on === allowed) return;
  allowed = on;
  // Banners leave the screen while the desktop is covered (`liveAllowed`).
  setState({});
  if (users === 0) return;
  if (on && !stopCurrent) stopCurrent = connect();
  if (!on) {
    stopCurrent?.();
    stopCurrent = null;
    setState({ connected: false });
  }
}

/** The ticket route, naming the session the page's desktop is for. */
function ticketUrl(): string {
  const session = currentDesktopSession();
  return session ? `${TICKET_URL}?desktop_session=${encodeURIComponent(session)}` : TICKET_URL;
}

/** Connect, and keep connecting, until the returned stop is called. */
function connect(): () => void {
  let stopped = false;
  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let failures = 0;
  // What changed elsewhere while the stream was closed is told when it opens again.
  const session = currentDesktopSession();
  let counts = heardCounts?.session === session ? heardCounts.counts : null;

  const close = () => {
    source?.close();
    source = null;
    clearInterval(watchdog);
  };
  const again = (delay: number) => {
    close();
    if (stopped) return;
    clearTimeout(retry);
    retry = setTimeout(() => void open(), delay);
  };
  const backoff = () => {
    if (stopped) return;
    failures += 1;
    setState({ connected: false });
    again(Math.min(MAX_BACKOFF_MS, 500 * 2 ** Math.min(failures, 6)));
  };

  const take = (data: string) => {
    // Each event holds everything; its version only tells a change apart, so the newest event
    // is taken as it comes.
    const next = (JSON.parse(data) as { state?: unknown }).state as { dnd?: unknown } | null;
    const changes = changesFromState(next);
    if (counts) {
      for (const [app, change] of changes) {
        const was = counts.get(app);
        const before = was?.n ?? 0;
        // A count that started again (counts expire unused, and one that cannot be read starts
        // over): its numbers name other changes than the old ones, and what changed since is not
        // known, so the app is loaded.
        if (was && (change.since !== was.since || change.n < before)) {
          forget(app, true);
          changed(app, false);
        } else if (change.n > before) counted(app, before, change.n);
      }
      // A count gone (expired, or unreadable): nothing it numbered stays, and a change still to
      // be placed is loaded.
      for (const app of counts.keys()) {
        if (!changes.has(app) && forget(app, true)) changed(app, false);
      }
    } else {
      // The page's first state: a document it loaded before the stream connected may predate a
      // change counted here, which is not known to be newer or older. Each app's documents held
      // here are loaded once more (none are loaded for an app the page holds nothing of).
      for (const app of changes.keys()) changed(app, false);
    }
    counts = changes;
    heardCounts = { session, counts: changes };
    takeSnapshot(itemsFromState(next), next?.dnd === true);
  };

  async function open() {
    if (stopped) return;
    let ticket: string;
    try {
      const reply = await withDeadline(async (signal) => {
        const response = await sessionFetch(ticketUrl(), {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: "{}",
          signal,
        });
        return {
          status: response.status,
          body: (await response.json().catch(() => null)) as unknown,
        };
      });
      if (stopped) return;
      // 409: the page was loaded for a session that has changed. Nothing of the previous person
      // stays on screen, the page's session ends (it loads again, `replyOfPageSession`), and
      // nothing more is asked of the next person.
      if (reply.status === 409) {
        stopped = true;
        snapshot = null;
        clearing.clear();
        settingDnd = null;
        dndWanted = null;
        setState({ ready: false, items: [], dnd: false, connected: false });
        replyOfPageSession(reply.status, reply.body);
        return;
      }
      const body = reply.body as { ticket?: unknown } | null;
      if (reply.status !== 201 || typeof body?.ticket !== "string") return backoff();
      ticket = body.ticket;
    } catch {
      return backoff();
    }
    if (stopped) return;
    const stream = new EventSource(`/live/me?ticket=${encodeURIComponent(ticket)}`);
    source = stream;
    let heard = Date.now();
    stream.addEventListener("state", (event) => {
      heard = Date.now();
      failures = 0;
      try {
        take((event as MessageEvent<string>).data);
      } catch (error) {
        console.error(error);
      }
    });
    stream.addEventListener("ping", () => {
      heard = Date.now();
    });
    // The subscription reached its lifetime, or its session changed: a new ticket, at once.
    stream.addEventListener("ended", () => again(0));
    // A ticket refused, or the server busy: try again later.
    stream.addEventListener("refused", backoff);
    stream.addEventListener("busy", backoff);
    // `EventSource` would reconnect with the spent ticket; reconnect with a new one instead.
    stream.addEventListener("error", () => {
      if (source === stream) backoff();
    });
    watchdog = setInterval(() => {
      if (Date.now() - heard > SILENCE_MS) backoff();
    }, 1_000);
  }

  void open();
  return () => {
    stopped = true;
    clearTimeout(retry);
    close();
  };
}

async function send(
  url: string,
  method: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<boolean> {
  try {
    // The reply is read to the end within the deadline: a body that stalls fails the write like
    // no reply at all, and a cancelled body would show as an aborted request.
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        method,
        credentials: "same-origin",
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      const text = await response.text();
      let reply: unknown = null;
      try {
        reply = text ? JSON.parse(text) : null;
      } catch {
        reply = null;
      }
      // A clear, an action or Do Not Disturb refused because the page's session changed or ended
      // ends the page (it loads again), as a refused ticket does.
      if (!replyOfPageSession(response.status, reply)) return false;
      return response.ok;
    });
  } catch {
    return false;
  }
}

/**
 * Clear the notifications `seqs` with the request `write`: they leave the screen at once, stay
 * off it until a state from the server no longer holds them, and come back if the write fails.
 * Resolves with whether it succeeded.
 */
async function clearWith(seqs: readonly number[], write: () => Promise<boolean>): Promise<boolean> {
  for (const seq of seqs) clearing.set(seq, { confirmed: false });
  show();
  const ok = await write();
  for (const seq of seqs) {
    if (ok) {
      const pending = clearing.get(seq);
      if (pending) pending.confirmed = true;
      // Already gone from the last state: nothing left to wait for.
      if (!snapshot?.items.some((item) => item.seq === seq)) clearing.delete(seq);
    } else clearing.delete(seq);
  }
  show();
  return ok;
}

/** Tell each item's app it was dismissed, where it asked to be told. */
function tellDismissed(items: readonly InboxItem[]) {
  for (const item of items) {
    if (item.dismiss) void send(`/api/${item.app}${item.dismiss}`, "POST", {});
  }
}

/**
 * Clear one notification: the app hears it was dismissed, and it leaves every browser. When the
 * server cannot be reached it comes back on the screen. Whether it was cleared.
 */
export function clearItem(item: InboxItem): Promise<boolean> {
  tellDismissed([item]);
  return clearWith([item.seq], () => send(`${INBOX_URL}/${item.seq}`, "DELETE"));
}

/** Clear an app's group, or with no app every notification, as `clearItem` does one. */
export function clearItems(app?: string): Promise<boolean> {
  const gone = state.items.filter((item) => app === undefined || item.app === app);
  tellDismissed(gone);
  return clearWith(
    gone.map((item) => item.seq),
    () =>
      send(app === undefined ? INBOX_URL : `${INBOX_URL}?app=${encodeURIComponent(app)}`, "DELETE"),
  );
}

/** A notification opened: it leaves the inbox (its app is opened by the caller). */
export function openedItem(item: InboxItem): Promise<boolean> {
  return clearWith([item.seq], () => send(`${INBOX_URL}/${item.seq}`, "DELETE"));
}

/** The conversation a notification from Messages can be answered in, when it says. */
export const replyConversation = ({ app, id }: Pick<InboxItem, "app" | "id">) =>
  app === "messages" ? /^(.+)#\d+$/.exec(id)?.[1] : undefined;

/**
 * Answers a notification from Messages where it is, and clears it. `key` stays the same when the
 * person tries again, so that a reply the server did store is not stored twice.
 */
export async function replyToMessage(item: InboxItem, text: string, key: string): Promise<boolean> {
  const conversation = replyConversation(item);
  if (conversation === undefined) return false;
  const url = `/api/messages/conversations/${encodeURIComponent(conversation)}/messages`;
  if (!(await send(url, "POST", { text }, key))) return false;
  return clearItem(item);
}

/**
 * An alert's action pressed: its route is told first, and only once it has said yes does the
 * notification leave the inbox; when the action fails, the notification stays (it comes back on
 * the screen), so the person can try again. Whether both succeeded.
 */
export function runAction(item: InboxItem, action: InboxAction): Promise<boolean> {
  return clearWith([item.seq], async () => {
    if (action.post && !(await send(`/api/${item.app}${action.post}`, "POST", {}))) return false;
    return send(`${INBOX_URL}/${item.seq}`, "DELETE");
  });
}

/** The Do Not Disturb value still to be sent, and whether a write of it is under way. */
let dndWanted: boolean | null = null;
let dndSending = false;

/**
 * Turn Do Not Disturb on or off, for every browser of the person. The switch shows the new value
 * at once. Writes go one at a time and only the newest value still to be sent is sent next, so an
 * older one never lands after a newer one; when a write fails, the switch goes back to what the
 * server holds.
 */
export function setDoNotDisturb(on: boolean): void {
  dndWanted = on;
  settingDnd = { on, confirmed: false };
  show();
  if (!dndSending) void sendDnd();
}

async function sendDnd() {
  dndSending = true;
  let ok = true;
  while (dndWanted !== null) {
    const on = dndWanted;
    dndWanted = null;
    ok = await send(DND_URL, "PUT", { on });
    // A newer value asked for meanwhile is still sent; only the newest one failing undoes it.
    if (!ok && dndWanted === null) break;
  }
  dndSending = false;
  if (settingDnd) {
    if (ok && snapshot?.dnd !== settingDnd.on) {
      settingDnd.confirmed = true;
      const held = settingDnd;
      if (dndHold) clearTimeout(dndHold);
      dndHold = setTimeout(() => {
        dndHold = null;
        if (settingDnd !== held) return;
        settingDnd = null;
        show();
      }, DND_HOLD_MS);
    } else settingDnd = null;
  }
  show();
}
