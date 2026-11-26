"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { LoginWindow, LoginWindowButton } from "macalicious/login-window";
import {
  NotificationAlert,
  NotificationAlertAction,
  NotificationAlertClose,
} from "macalicious/notification-alert";
import { PushButton } from "macalicious/push-button";
import { SecureTextField } from "macalicious/secure-text-field";
import { TextField } from "macalicious/text-field";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { forgetSnapshots } from "../mail/mail-outbox";
import { registerLockScreen } from "../system-preferences/panes/desktop-and-screen-saver/screen-saver";
import { useLockMessage } from "../system-preferences/panes/security-and-privacy/served-security";
import darkPicture from "./art/catalina-dark.webp";
import { CatalinaDesktop, type CatalinaDesktopProps } from "./desktop";
import {
  ACCOUNT_PICTURE_KEY,
  browserPictureOf,
  loginByName,
  readAccountPicture,
  rememberAccountPicture,
} from "./desktop-account-picture";
import { allowLiveStream } from "./desktop-live";
import { desktopValuesLoaded, subscribeDesktopValues, useDesktopValue } from "./desktop-personal";
import { forgetLoginItems } from "./desktop-restore";
import {
  beginAccountAction,
  DESKTOP_SESSION_PARAM,
  reloadForNewSession,
  sessionFetch,
  setDesktopSession,
  withDeadline,
} from "./desktop-server";

/**
 * Sign-in for the desktop served by its Ferrite application (`ferrite-apps/desktop`, whose
 * `src/accounts/` keeps the accounts): Catalina's login window in front of the desktop, Lock
 * Screen, Log Out and fast user switching. Each person who signs in gets a desktop of their own:
 * the server keys every app's data to the account. Guest User needs no account, and its data is
 * deleted when it logs out or after 24 hours.
 *
 * The server ends the browser's session and issues a new cookie on every sign-in and sign-out.
 * A desktop that has loaded one person's documents is therefore never handed to another: when
 * the person changes after the desktop was shown, the page loads again. A second tab's sign-in
 * reaches this page only when it next asks, by its session news, a read of the session or a refused
 * request. Until then every app request still names the session it was loaded for, and the server
 * refuses it with a 409, so an upload from this page never reaches the next person's drive.
 */

/** The `GET /api/session` reply. */
export interface SessionInfo {
  session: string;
  account: { name: string; full_name: string; guest: boolean } | null;
  locked: boolean;
  /** Whether this browser's earlier data can be moved into the account (asked once). */
  adopt: boolean;
  /** Whether that move was answered already and was cut short: it carries on without asking. */
  adopt_resume?: boolean;
  /**
   * Set when this browser held nothing at the sign-in: a request it sent before then may still
   * write, so the session is read again after this many milliseconds, and the move is offered
   * then if there is anything to move.
   */
  adopt_check_in_ms?: number;
  signup: "open" | "invite" | "closed";
  sign_in_ready: boolean;
}

/** An account used in this browser, as the login window lists it. */
export interface RecentAccount {
  name: string;
  fullName: string;
}

/** The `localStorage` key of the accounts used in this browser: names only, never a secret. */
export const RECENT_ACCOUNTS_KEY = "macalicious-accounts";
const MAX_RECENT = 8;

const isSessionInfo = (value: unknown): value is SessionInfo => {
  const info = value as Partial<SessionInfo> | null;
  return typeof info === "object" && info !== null && typeof info.session === "string";
};

/** The accounts used in this browser, most recent first. */
export function recentAccounts(): RecentAccount[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_ACCOUNTS_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (entry): entry is RecentAccount =>
        typeof entry?.name === "string" && typeof entry?.fullName === "string",
    );
  } catch {
    return [];
  }
}

/** Put `account` first in the list of accounts used in this browser. */
export function rememberAccount(account: RecentAccount) {
  const list = [account, ...recentAccounts().filter((entry) => entry.name !== account.name)];
  try {
    window.localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Without storage the login window lists no accounts; Other… still signs in.
  }
}

/** Read the session again: set by the page, called when the server refuses a stale change. */
let onSessionChanged: (() => void) | null = null;

/**
 * One request to `/api/session`: its status and its JSON body. A change (`body` given) names
 * `shown`, the session the screen sending it was showing (`SessionInfo.session`), and the server
 * refuses it when the browser's session has changed since (another tab signed in, out or as
 * someone else), so a stale screen never locks, signs out or answers for the person now signed in.
 *
 * The request and the reading of its reply settle by `REQUEST_DEADLINE_MS` (`withDeadline`): one
 * the server never finishes rejects, and its caller shows its retryable error ("Try again")
 * instead of leaving the login window, the lock screen or the move of earlier data busy.
 */
async function sessionRequest(
  path: string,
  body?: object,
  shown?: string,
): Promise<{ status: number; reply: Record<string, unknown> | null }> {
  const named = body && shown ? `?${DESKTOP_SESSION_PARAM}=${encodeURIComponent(shown)}` : "";
  const { status, reply } = await withDeadline(async (signal) => {
    const response = await sessionFetch(`/api/session${path}${named}`, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: body
        ? { "content-type": "application/json", accept: "application/json" }
        : { accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    let reply: Record<string, unknown> | null = null;
    try {
      reply = (await response.json()) as Record<string, unknown>;
    } catch {
      reply = null;
    }
    return { status: response.status, reply };
  });
  if (status === 409 && reply?.session_changed === true) onSessionChanged?.();
  return { status, reply };
}

const errorOf = (reply: Record<string, unknown> | null, fallback: string) =>
  typeof reply?.error === "string" ? reply.error : fallback;

/**
 * The name each lock attempt's cookie starts with (`LOCK_REQUESTED_COOKIE` in
 * `ferrite-apps/desktop/src/session.rs`): while the browser carries any such cookie, no app
 * answers. Each Lock Screen sets `mac_lock_<attempt>` the moment it is chosen. A lock that
 * succeeds deletes its own cookie, and only its own, so no attempt ever touches another's;
 * otherwise the cookie expires after 20 seconds, past the lock request's deadline.
 */
export const LOCK_REQUESTED_COOKIE = "mac_lock";

/** Set a lock cookie of this attempt's own, and return the attempt's name for it. */
function lockRequested(): string {
  const attempt = `${LOCK_REQUESTED_COOKIE}_${Math.random().toString(36).slice(2)}`;
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not in every engine the desktop runs in (Firefox), and this cookie must be set before the lock request is sent
  document.cookie = `${attempt}=1; Path=/; Max-Age=20; SameSite=Lax`;
  return attempt;
}

/** Delete `attempt`'s lock cookie, and no other. */
function lockSettled(attempt: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: as in `lockRequested`
  document.cookie = `${attempt}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** The picture behind the login window. */
const backdrop: CSSProperties = {
  background: `center / cover no-repeat url("${darkPicture}")`,
};

const OTHER = "__other";
const CREATE = "__create";
const GUEST = "__guest";

type Form = "other" | "create";

interface LoginScreenProps {
  info: SessionInfo;
  /** The account chosen when the screen opens. */
  initial: string | null;
  /** Called with the reply of a sign-in, sign-up or Guest User. */
  onSignedIn: (info: SessionInfo) => void;
  /** Back to the desktop, when the screen was opened over a signed-in session. */
  onCancel?: () => void;
}

/** An account's picture for the login window: filling its circle, and saying nothing a name does not. */
const pictureOf = (account: string) => {
  const picture = browserPictureOf(account);
  return picture ? (
    <img src={picture} alt="" width={93} height={93} style={{ objectFit: "cover" }} />
  ) : undefined;
};

/** The login window: the accounts used in this browser, Other…, Create Account… and Guest User. */
function LoginScreen({ info, initial, onSignedIn, onCancel }: LoginScreenProps) {
  // Name and password lists no account, but the one a person is switching to.
  const [recent] = useState(() =>
    recentAccounts().filter((entry) => !loginByName() || entry.name === initial),
  );
  const [chosen, setChosen] = useState<string | null>(
    initial && recent.some((entry) => entry.name === initial) ? initial : null,
  );
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [hint, setHint] = useState<string>(
    info.sign_in_ready ? "" : "Sign-in is not set up on this server yet.",
  );

  const send = async (path: string, body: object) => {
    beginAccountAction();
    setBusy(true);
    setInvalid(false);
    setHint("");
    try {
      const { status, reply } = await sessionRequest(path, body, info.session);
      if (status < 300 && isSessionInfo(reply)) {
        if (reply.account && !reply.account.guest) {
          rememberAccount({ name: reply.account.name, fullName: reply.account.full_name });
        }
        onSignedIn(reply);
        return true;
      }
      setInvalid(status === 401);
      setHint(errorOf(reply, "The desktop could not sign you in. Try again."));
    } catch {
      setHint("The desktop could not reach its server. Try again.");
    } finally {
      setBusy(false);
    }
    return false;
  };

  const users = [
    ...recent.map((entry) => ({
      value: entry.name,
      name: entry.fullName,
      picture: pictureOf(entry.name),
    })),
    { value: OTHER, name: "Other…" },
    ...(info.signup === "closed" ? [] : [{ value: CREATE, name: "Create Account…" }]),
    { value: GUEST, name: "Guest User" },
  ];

  const cancel = onCancel ? (
    <LoginWindowButton glyph="cancel" onClick={onCancel}>
      Cancel
    </LoginWindowButton>
  ) : undefined;

  if (form) {
    return (
      <AccountForm
        kind={form}
        signup={info.signup}
        busy={busy}
        hint={hint}
        onBack={() => {
          setForm(null);
          setHint("");
        }}
        onSubmit={(fields) => void send(form === "create" ? "/sign-up" : "/sign-in", fields)}
        onMismatch={() => setHint("The passwords do not match.")}
      />
    );
  }

  return (
    <LoginWindow
      className="mac-desktop-login"
      style={backdrop}
      users={users}
      value={chosen}
      onValueChange={(value) => {
        setHint("");
        setInvalid(false);
        if (value === GUEST) void send("/guest", {});
        else if (value === OTHER) setForm("other");
        else if (value === CREATE) setForm("create");
        else setChosen(value);
      }}
      onSubmit={(password, user) => void send("/sign-in", { name: user, password })}
      onCancel={onCancel}
      invalid={invalid}
      busy={busy}
      hint={hint || undefined}
      actions={cancel}
    />
  );
}

interface AccountFormProps {
  kind: Form;
  signup: SessionInfo["signup"];
  busy: boolean;
  hint: string;
  onBack: () => void;
  onSubmit: (fields: Record<string, string>) => void;
  onMismatch: () => void;
}

/** Other… (an account name and its password) and Create Account…, over the login picture. */
function AccountForm({ kind, signup, busy, hint, onBack, onSubmit, onMismatch }: AccountFormProps) {
  const id = useId();
  const create = kind === "create";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "");
    if (create && field("password") !== field("verify")) return onMismatch();
    const fields: Record<string, string> = { name: field("name"), password: field("password") };
    if (create) fields.full_name = field("full_name");
    if (create && signup === "invite") fields.invite = field("invite");
    onSubmit(fields);
  };
  const row = (name: string, label: string, input: ReactNode) => (
    <div className="mac-desktop-login-row">
      <label htmlFor={`${id}-${name}`}>{label}</label>
      {input}
    </div>
  );
  return (
    <div
      data-appearance="dark"
      className="mac-desktop-login mac-desktop-login-panel"
      style={backdrop}
    >
      <form
        className="mac-desktop-login-form"
        aria-label={create ? "Create Account" : "Log In"}
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === "Escape") onBack();
        }}
      >
        <h1 className="mac-desktop-login-title">{create ? "Create Account" : "Other…"}</h1>
        {create &&
          row(
            "full_name",
            "Full Name:",
            <TextField
              id={`${id}-full_name`}
              name="full_name"
              autoComplete="name"
              required
              autoFocus
            />,
          )}
        {row(
          "name",
          "Account Name:",
          <TextField
            id={`${id}-name`}
            name="name"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus={!create}
          />,
        )}
        {row(
          "password",
          "Password:",
          <SecureTextField
            id={`${id}-password`}
            name="password"
            autoComplete={create ? "new-password" : "current-password"}
            required
          />,
        )}
        {create &&
          row(
            "verify",
            "Verify:",
            <SecureTextField
              id={`${id}-verify`}
              name="verify"
              autoComplete="new-password"
              required
            />,
          )}
        {create &&
          signup === "invite" &&
          row(
            "invite",
            "Invitation Code:",
            <TextField id={`${id}-invite`} name="invite" required />,
          )}
        <p className="mac-desktop-login-hint" role="status">
          {hint}
        </p>
        <div className="mac-desktop-login-buttons">
          <PushButton onClick={onBack} disabled={busy}>
            Cancel
          </PushButton>
          <DefaultButton type="submit" disabled={busy}>
            {create ? "Create Account" : "Log In"}
          </DefaultButton>
        </div>
      </form>
    </div>
  );
}

/** The lock screen: the signed-in person's password, nothing of their desktop. */
function LockScreen({
  info,
  begin,
  onUnlocked,
  onSwitch,
}: {
  info: SessionInfo;
  /** Take a ticket for a change about to be sent (`AccountsDesktop`'s sequence). */
  begin: () => number;
  onUnlocked: (info: SessionInfo, ticket: number) => void;
  onSwitch: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [hint, setHint] = useState("");
  const account = info.account;
  const lockMessage = useLockMessage(account?.name ?? "");
  if (!account) return null;
  return (
    <LoginWindow
      className="mac-desktop-login"
      style={backdrop}
      users={[{ value: account.name, name: account.full_name, picture: pictureOf(account.name) }]}
      busy={busy}
      invalid={invalid}
      hint={hint || lockMessage || undefined}
      onSubmit={async (password) => {
        setBusy(true);
        setInvalid(false);
        setHint("");
        try {
          const ticket = begin();
          const { status, reply } = await sessionRequest("/unlock", { password }, info.session);
          if (status === 200 && isSessionInfo(reply)) return onUnlocked(reply, ticket);
          setInvalid(status === 401);
          setHint(errorOf(reply, "The screen could not be unlocked. Try again."));
        } catch {
          setHint("The desktop could not reach its server. Try again.");
        } finally {
          setBusy(false);
        }
      }}
      actions={
        <LoginWindowButton glyph="cancel" onClick={onSwitch}>
          Switch User
        </LoginWindowButton>
      }
    />
  );
}

/** The channel on which a browser's tabs tell one another that its session changed. */
export const CHANNEL = "macalicious-session";

/** What a tab announces on `CHANNEL`: the session changed, and which page says so. */
export interface SessionNews {
  kind: "changed";
  /** The announcing page (`PAGE`), so that its own listener passes the news by. */
  from: string;
}

/** This page's mark on the news it announces. */
const PAGE = `page-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

/** Tell this browser's other tabs that the session changed: they ask the server again. */
export function announce() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ kind: "changed", from: PAGE } satisfies SessionNews);
  channel.close();
}

/**
 * Calls `onNews` when another tab of this browser announces that the session changed, and returns
 * how to stop listening. A BroadcastChannel delivers a message to every other channel object of
 * its name, in the sending document too, so the page's own announcements reach its own listener:
 * they are passed by, since the page has acted on its own change already. Answered, they read the
 * session again, and after Log Out, or a sign-in over a desktop that was shown, that read found the
 * session changed and loaded the page a second time, cutting short the load the change itself had
 * started. News from a tab of an earlier build (the bare string "changed") is answered.
 */
export function listenForSessionNews(onNews: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const news = event.data as Partial<SessionNews> | null;
    if (typeof news === "object" && news !== null && news.from === PAGE) return;
    onNews();
  };
  return () => channel.close();
}

/**
 * The one-time question: keep this browser's earlier data in the account? A move answered
 * already and cut short (`resume`) carries on with that answer, without asking again. Every step
 * names `session`, the session the prompt was opened for, and the steps stop when the prompt
 * closes, so an answer never reaches a session another tab has switched to.
 */
function AdoptPrompt({
  onDone,
  session,
  resume = false,
}: {
  onDone: (info: SessionInfo) => void;
  session: string;
  resume?: boolean;
}) {
  const [moving, setMoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);
  const answer = async (keep: boolean) => {
    setMoving(true);
    setFailed(false);
    try {
      // The server moves a bounded number of keys per request, and finishes only once no
      // request the browser sent before signing in can still write (`wait_ms`); ask until
      // it is done.
      for (let step = 0; step < 200 && open.current; step += 1) {
        const { status, reply } = await sessionRequest("/adopt", { keep }, session);
        if (!open.current) return;
        // Done, or answered already from another browser (409, nothing moved here).
        if (isSessionInfo(reply) && reply.done === true) return onDone(reply);
        if (status !== 200 || !isSessionInfo(reply)) break;
        const wait = (reply as { wait_ms?: unknown }).wait_ms;
        if (typeof wait === "number" && wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 15_000)));
        }
      }
    } catch {
      // Reported below.
    }
    if (!open.current) return;
    setMoving(false);
    setFailed(true);
  };
  // The server keeps the earlier answer; the request's own is not used.
  const started = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the prompt opens on a move to carry on
  useEffect(() => {
    if (!resume || started.current) return;
    started.current = true;
    void answer(true);
  }, [resume]);
  const informative = failed
    ? "They could not all be moved. Try again."
    : resume
      ? "Finishing the move of this browser's earlier data into your account."
      : "This browser was used before you signed in. Its data can move into your account once.";
  return (
    <div className="mac-desktop-login" style={backdrop}>
      <Alert open>
        <AlertPopup>
          <AlertMessage>
            Keep the notes, files and settings from this browser in your account?
          </AlertMessage>
          <AlertInformativeText>{informative}</AlertInformativeText>
          <AlertButtons>
            <AlertClose disabled={moving} onClick={() => void answer(false)}>
              Don’t Keep
            </AlertClose>
            <AlertClose
              render={<DefaultButton />}
              disabled={moving}
              onClick={() => void answer(true)}
            >
              Keep
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </div>
  );
}

/**
 * The desktop behind its login window. Until someone signs in (or chooses Guest User) only the
 * login window shows; then the person's own desktop, with Lock Screen, Log Out and fast user
 * switching in its menus.
 */
export function AccountsDesktop(props: CatalinaDesktopProps) {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [failed, setFailed] = useState(false);
  // Lock Screen or Log Out the server did not carry out, and how to try it again.
  const [accountError, setAccountError] = useState<{ title: string; retry: () => void } | null>(
    null,
  );
  // The login window over a signed-in session (fast user switching), with the account chosen.
  const [switching, setSwitching] = useState<{ name: string | null } | null>(null);
  // Whether the person's desktop has been shown on this page. It then stays mounted, hidden and
  // out of reach, behind the lock screen and the switching login window, so unlocking or
  // cancelling finds its windows as they were; another person gets a freshly loaded page.
  const [mounted, setMounted] = useState(false);
  // The latest of both, for the handlers of other tabs' news.
  const latest = useRef({ info, mounted });
  latest.current = { info, mounted };
  // Counts this page's session reads and changes, so that a read sent before a lock or unlock
  // here, and answered after it, is not taken over the newer state.
  const sequence = useRef(0);
  // The lock attempt (its cookie's name) this tab has sent and the server has not settled: while
  // it is on its way, a read of the session that still says unlocked does not uncover the desktop.
  const lockPending = useRef<string | null>(null);
  // Security & Privacy's Require password locks through this; it does nothing but for a person
  // with a password, on whom the render below sets it.
  const lockForSaver = useRef<() => void>(() => {});
  lockForSaver.current = () => {};
  useEffect(() => registerLockScreen(() => lockForSaver.current()), []);

  /** The session as the server has it now, after this or another tab changed it. */
  const refresh = useCallback(() => {
    sequence.current += 1;
    const mine = sequence.current;
    sessionRequest("")
      .then(({ reply }) => {
        if (mine !== sequence.current) return;
        // No session read yet (this refresh superseded the first read): its failure is the
        // page's, which says so, instead of a blank screen.
        if (!isSessionInfo(reply)) {
          if (!latest.current.info) setFailed(true);
          return;
        }
        const { info: shown, mounted: wasShown } = latest.current;
        // Another tab signed in, out or as someone else: this page's desktop is not theirs.
        if (shown && reply.session !== shown.session && wasShown) {
          reloadForNewSession(undefined, undefined, "account-change");
          return;
        }
        // A session the server has locked needs no error about a lock or log out that failed.
        if (reply.locked) setAccountError(null);
        setInfo(lockPending.current && !reply.locked ? { ...reply, locked: true } : reply);
      })
      // Cut short (the page is loading again, or offline): the next focus asks again, and a page
      // with no session read yet says it could not reach the server.
      .catch(() => {
        if (mine === sequence.current && !latest.current.info) setFailed(true);
      });
  }, []);

  useEffect(() => {
    let live = true;
    sequence.current += 1;
    const mine = sequence.current;
    // The first read of the session. While another tab's sign-in or sign-out is a moment old the
    // server refuses the cookie this page still sent (409): ask again shortly, with the new one.
    const load = async () => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { status, reply } = await sessionRequest("");
        if (!live || mine !== sequence.current) return;
        if (isSessionInfo(reply)) return setInfo(reply);
        if (status !== 409) break;
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      if (live && mine === sequence.current) setFailed(true);
    };
    load().catch(() => live && setFailed(true));
    // Tabs of one browser share its cookie, so they share its session: each tells the others
    // when it signs in, out, locks or unlocks, and a tab coming back to the front asks again.
    // A page's own news is not answered (`listenForSessionNews`).
    const stopListening = listenForSessionNews(refresh);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      stopListening();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const account = info?.account ?? null;
  const ready = Boolean(account && info && !info.locked && !info.adopt && !switching);
  // Before the browser paints the lock screen or the login window: the person's live updates
  // stop, and their banners leave in the same frame (desktop-live.ts, `liveAllowed`).
  useLayoutEffect(() => {
    if (ready) setMounted(true);
    // The person's live updates flow only while their desktop shows (desktop-live.ts).
    allowLiveStream(ready);
  }, [ready]);
  // The account's picture, for this browser's login window, once its settings have been read.
  const picture = useDesktopValue<string | undefined>(
    ACCOUNT_PICTURE_KEY,
    readAccountPicture,
    undefined,
  );
  const pictured = account && !account.guest ? account.name : null;
  const settingsRead = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  useEffect(() => {
    if (pictured && settingsRead) rememberAccountPicture(pictured, picture);
  }, [pictured, settingsRead, picture]);
  // No one is signed in: whoever signs in here next is logging in, and their login items open.
  const signedOut = info !== null && account === null;
  useEffect(() => {
    if (!signedOut) return;
    forgetLoginItems();
    void forgetSnapshots();
  }, [signedOut]);
  // A browser that held nothing at the sign-in is looked at again once nothing it sent before
  // can still be writing; the move is offered then if anything arrived.
  const checkIn = info?.adopt_check_in_ms;
  useEffect(() => {
    if (typeof checkIn !== "number") return;
    const timer = setTimeout(refresh, Math.min(checkIn, 15_000) + 250);
    return () => clearTimeout(timer);
  }, [checkIn, refresh]);

  /** The person behind the page changed: show their desktop, on a fresh page if one was shown. */
  const changed = (next: SessionInfo) => {
    // Any read still on its way was sent before this change: it is not taken.
    sequence.current += 1;
    announce();
    if (mounted) {
      reloadForNewSession(undefined, undefined, "account-change");
      return;
    }
    setSwitching(null);
    setInfo(next);
  };

  /**
   * A ticket for a lock or unlock this tab is about to send: anything read or sent before it is
   * not taken over its reply, and its reply is not taken over anything read or sent after it.
   */
  const begin = () => {
    sequence.current += 1;
    return sequence.current;
  };

  /** This tab locked or unlocked the shared session, with the ticket taken when it was sent. */
  const lockChanged = (next: SessionInfo, ticket: number) => {
    // Something newer was read or sent meanwhile (another tab locked, this one unlocked): this
    // reply may be older than it, so the session is read again instead.
    if (ticket !== sequence.current) {
      refresh();
      return;
    }
    // Any read still on its way was sent before this change: it is not taken.
    sequence.current += 1;
    announce();
    setInfo(next);
  };

  if (!info) {
    return (
      <div className="mac-desktop-login mac-desktop-login-panel" style={backdrop}>
        {failed ? (
          <p className="mac-desktop-login-hint" role="alert">
            The desktop could not reach its server. Reload the page to try again.
          </p>
        ) : null}
      </div>
    );
  }

  let cover: ReactNode = null;
  if (!account || switching) {
    cover = (
      <LoginScreen
        info={info}
        initial={switching?.name ?? null}
        onSignedIn={changed}
        onCancel={switching ? () => setSwitching(null) : undefined}
      />
    );
  } else if (info.locked) {
    cover = (
      <LockScreen
        info={info}
        begin={begin}
        onUnlocked={lockChanged}
        onSwitch={() => setSwitching({ name: null })}
      />
    );
  } else if (info.adopt) {
    cover = (
      <AdoptPrompt
        key={info.session}
        onDone={changed}
        session={info.session}
        resume={info.adopt_resume === true}
      />
    );
  }

  // Every app request of this page names its session (desktop-server.ts), set before the
  // desktop's windows first ask for anything; every session change names the session its
  // screen shows.
  setDesktopSession(account ? info.session : null);
  onSessionChanged = refresh;
  const shown = info.session;
  // Lock Screen shows the lock screen at once; the server is told after. From that moment the
  // browser carries the lock cookie, so the server refuses every app read (423), even one that
  // reaches it before the lock does, and the lock screen stays whatever a read of the session
  // says until the lock request settles (`lockPending`). Lock Screen or Log Out the server did
  // not carry out (refused, failed or timed out) shows an alert to try again, over the lock
  // screen too, and the session is read again (`refresh`): whatever the server says, locked or
  // not, is shown; when it cannot be read, the lock screen stays.
  const lockScreen = () => {
    setAccountError(null);
    const ticket = begin();
    const attempt = lockRequested();
    lockPending.current = attempt;
    setInfo((current) => (current ? { ...current, locked: true } : current));
    const settled = () => {
      if (lockPending.current === attempt) lockPending.current = null;
    };
    const failed = () => {
      settled();
      setAccountError({ title: "The screen could not be locked.", retry: lockScreen });
      refresh();
    };
    sessionRequest("/lock", {}, shown)
      .then(({ status, reply }) => {
        if (status === 200 && isSessionInfo(reply)) {
          // The session is locked on the server now: this attempt's cookie has done its work.
          // Another attempt's cookie, or one left after a failure, is left alone.
          lockSettled(attempt);
          settled();
          lockChanged(reply, ticket);
        } else failed();
      })
      .catch(failed);
  };
  if (account && !account.guest) lockForSaver.current = lockScreen;
  const logOut = () => {
    beginAccountAction();
    setAccountError(null);
    const failed = () => {
      setAccountError({ title: "You could not be logged out.", retry: logOut });
      refresh();
    };
    sessionRequest("/sign-out", {}, shown)
      .then(({ status }) => {
        if (status !== 200) return failed();
        announce();
        reloadForNewSession(undefined, undefined, "account-change");
      })
      .catch(failed);
  };
  const desktop =
    account && (mounted || ready) ? (
      <div
        className="mac-desktop-login-behind"
        data-covered={ready ? undefined : ""}
        inert={!ready}
      >
        <CatalinaDesktop
          {...props}
          userName={account.full_name}
          account={{
            lockScreen: account.guest ? undefined : lockScreen,
            logOut,
            others: recentAccounts()
              .filter((entry) => entry.name !== account.name)
              .map((entry) => ({ name: entry.name, fullName: entry.fullName })),
            switchTo: (name) => setSwitching({ name }),
          }}
          // One person's desktop per session: it is never handed to another.
          key={info.session}
        />
      </div>
    ) : null;

  const alert = accountError ? (
    <div className="mac-desktop-shell-banners">
      <NotificationAlert
        role="alert"
        title={accountError.title}
        subtitle="The desktop could not reach its server. Try again."
        onDismiss={() => setAccountError(null)}
        actions={
          <>
            <NotificationAlertClose>Close</NotificationAlertClose>
            <NotificationAlertAction onClick={() => accountError.retry()}>
              Try Again
            </NotificationAlertAction>
          </>
        }
      />
    </div>
  ) : null;

  return (
    <>
      {desktop}
      {cover ? (
        desktop ? (
          <div className="mac-desktop-login-cover">
            {cover}
            {alert}
          </div>
        ) : (
          <>
            {cover}
            {alert}
          </>
        )
      ) : (
        alert
      )}
    </>
  );
}
