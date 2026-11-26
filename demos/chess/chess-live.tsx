"use client";

import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { sessionFetch } from "../desktop/desktop-server";
import { Chess, type ChessProps } from "./chess";
import { AccountChess } from "./chess-account";
import {
  type ChessGame,
  type ChessPieceKind,
  type ChessPromotion,
  type ChessVariant,
  claimDraw,
  createGame,
  drop,
  play,
} from "./chess-game";
import { useChessPreferences } from "./chess-preferences";

/**
 * Chess between people, when the desktop is served by its Ferrite application
 * (`ferrite-apps/desktop`, which builds the page with `VITE_MACALICIOUS_API=1`). Everywhere
 * else, the documentation site included, it is the plain `Chess` window and asks no server
 * anything.
 *
 * Without `?game=` in the page's address the window plays the signed-in person's own games
 * (`chess-account.tsx`): against the computer, or against another account they invite, with a
 * list of their games and a replay of each.
 *
 * With `?game=<id>` it plays that open board instead, held by the server
 * (`/api/chess/games/<game>`), which anyone naming it can join. The first browser to move a side
 * plays it from then on; the
 * other side is the next browser's. A move is shown at once and sent as the game's next ply,
 * resent until the server answers; the ply's number makes a resend harmless. When the server
 * refuses a ply (the other browser moved first, or the side is not this browser's) the window
 * takes the server's game. Every window hears the game through the live feed
 * (`/live/chess/<game>`, server-sent events), whose every event carries the whole game, and
 * replays its plies with the rules of `chess-game.ts`. A feed that falls silent (its server
 * process restarted) is opened again.
 */
export const LIVE = import.meta.env.VITE_MACALICIOUS_API === "1";

/**
 * The open board this page plays: `?game=<id>` in the page's address (1 to 40 lowercase
 * letters, digits or `-`), so separate pairs of players or test runs can each have their own,
 * or `null` for the person's own games.
 */
export function openBoardOf(search: string): string | null {
  const game = new URLSearchParams(search).get("game");
  return game && /^[a-z0-9-]{1,40}$/.test(game) ? game : null;
}

/** One ply as the server keeps it: a move, or a claimed draw. */
export interface Ply {
  from?: string;
  to?: string;
  promotion?: ChessPromotion;
  /** In Crazyhouse, the kind of piece dropped on `to`. */
  drop?: ChessPieceKind;
  draw?: boolean;
  author: string;
  /** When the server added it (epoch ms), in games played since it records it. */
  at_ms?: number;
}

/** The game as the server keeps it. */
export interface SharedGame {
  number: number;
  plies: Ply[];
  white: string | null;
  black: string | null;
}

/** A feed that has said nothing for this long, pings included, is opened again. */
export const SILENCE_MS = 12_000;

/** The longest one request may take, its answer's body included, before it counts as failed. */
export const ATTEMPT_MS = 10_000;

/**
 * POST `body` as JSON, resent until the server answers below 500 (429 excepted) with a JSON
 * body; its status and body. Each attempt, the body included, fails after `ATTEMPT_MS`, so a
 * stalled request is sent again rather than waited on. Gives up, answering null, once `alive`
 * says the window is gone.
 */
export async function post(
  url: string,
  body: unknown,
  alive: () => boolean,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: unknown } | null> {
  for (let attempt = 0; alive(); attempt++) {
    try {
      const response = await sessionFetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ATTEMPT_MS),
      });
      if (response.status < 500 && response.status !== 429) {
        const answer: unknown = await response.json();
        return { status: response.status, body: answer };
      }
    } catch {
      // Not sent, not answered, an unreadable answer, or too slow: send it again.
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(4_000, 250 * 2 ** attempt)));
  }
  return null;
}

/**
 * The game the plies make from the starting position, and the number of the first ply the
 * rules refuse (`null` when there is none): the game stops before it. The server refuses such
 * a ply, so only a game stored before it checked the rules can hold one.
 */
export function replay(
  plies: readonly Ply[],
  variant: ChessVariant = "regular",
): { game: ChessGame; refused: number | null } {
  let game = createGame(variant);
  for (const [index, ply] of plies.entries()) {
    let next: ChessGame | null = null;
    try {
      next = ply.draw
        ? claimDraw(game)
        : ply.drop
          ? drop(game, ply.drop, ply.to ?? "")
          : play(game, ply.from ?? "", ply.to ?? "", ply.promotion);
    } catch {
      // A square that is no square: refused like an illegal move.
      next = null;
    }
    if (!next) return { game, refused: index };
    game = next;
  }
  return { game, refused: null };
}

const SQUARE = /^[a-h][1-8]$/;

const PROMOTIONS: readonly unknown[] = ["queen", "rook", "bishop", "knight"];
const DROPS: readonly unknown[] = ["queen", "rook", "bishop", "knight", "pawn"];
const isSeat = (value: unknown) => value === null || typeof value === "string";

/**
 * Whether `ply` is one ply as the server keeps it: who played it, and either a move (`from` and
 * `to`, with a promotion or none) or a claimed draw (`draw: true` and nothing of a move).
 */
function isPly(ply: unknown): ply is Ply {
  if (!ply || typeof ply !== "object" || Array.isArray(ply)) return false;
  const {
    from,
    to,
    promotion,
    draw,
    drop: dropped,
    author,
    at_ms,
  } = ply as Record<string, unknown>;
  if (typeof author !== "string") return false;
  if (at_ms !== undefined && !Number.isSafeInteger(at_ms)) return false;
  if (draw === true) return from === undefined && to === undefined && promotion === undefined;
  if (dropped !== undefined) {
    return (
      DROPS.includes(dropped) &&
      from === undefined &&
      promotion === undefined &&
      typeof to === "string" &&
      SQUARE.test(to)
    );
  }
  return (
    (draw === undefined || draw === false) &&
    typeof from === "string" &&
    SQUARE.test(from) &&
    typeof to === "string" &&
    SQUARE.test(to) &&
    (promotion === undefined || PROMOTIONS.includes(promotion))
  );
}

/**
 * Whether a feed or reply state is a game, as the server keeps it: a game number, both seats
 * (a session, or `null` while free) and every ply well formed. The server sends
 * `{"unreadable": true}`, without plies, for a stored game it cannot read; anything else that
 * is not a game is taken the same way, so the window never replays or seats what it cannot read.
 */
export function isSharedGame(state: unknown): state is SharedGame {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  const { number, plies, white, black } = state as Record<string, unknown>;
  return (
    Number.isSafeInteger(number) &&
    (number as number) >= 0 &&
    isSeat(white) &&
    isSeat(black) &&
    Array.isArray(plies) &&
    plies.every(isPly)
  );
}

/**
 * The Chess window of the desktop: `Chess`, playing the person's own games, or the open board
 * the page's address names, when the page is served by the desktop's Ferrite application. It
 * takes every prop of `Chess`.
 */
export function ChessLive(props: ChessLiveProps) {
  const [board] = useState(() => (LIVE ? openBoardOf(window.location.search) : null));
  if (!LIVE) return <PlainChess {...props} />;
  if (board === null) return <AccountChess {...props} />;
  return <SharedChess {...props} gameId={board} />;
}

type ChessLiveProps = ChessProps & {
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
  preferencesOpen?: boolean;
  onPreferencesOpenChange?: (open: boolean) => void;
};

/** `Chess` with no server: both sides are played in this window, and no computer plays. */
function PlainChess({
  DesktopWindow,
  preferencesOpen,
  onPreferencesOpenChange,
  ...props
}: ChessLiveProps) {
  const preferences = useChessPreferences({
    DesktopWindow,
    open: preferencesOpen,
    onOpenChange: onPreferencesOpenChange,
    noComputer: true,
    noSide: true,
  });
  return (
    <>
      <Chess {...props} {...preferences.look} />
      {preferences.window}
    </>
  );
}

const UNREADABLE = "The server cannot read this game. Choose New Game to start it again.";
const PRIVATE = "This game belongs to its two players. Open it from Chess's Games list.";

function SharedChess({
  white,
  black,
  onMove,
  onNewGame,
  onClaimDraw,
  gameId,
  DesktopWindow,
  preferencesOpen,
  onPreferencesOpenChange,
  ...props
}: ChessLiveProps & { gameId: string }) {
  const preferences = useChessPreferences({
    DesktopWindow,
    open: preferencesOpen,
    onOpenChange: onPreferencesOpenChange,
    noComputer: true,
  });
  const [author, setAuthor] = useState<string | null>(null);
  const API = `/api/chess/games/${gameId}`;
  // The newest game known, with the store version it was read at: an older one that arrives
  // late is ignored.
  const [shared, setShared] = useState<{ version: number; game: SharedGame } | null>(null);
  // Set while the server cannot read the stored game, or while the address names a game that
  // belongs to its players, which no open board shows: the status bar says so.
  const [blocked, setBlocked] = useState<"unreadable" | "private" | null>(null);
  const latest = useRef(-1);
  const take = (version: number, game: unknown) => {
    if (version < latest.current) return;
    latest.current = version;
    // A state that is not a game is the server's marker for one it cannot read, or for one
    // it does not show here.
    if (!isSharedGame(game)) {
      setBlocked(
        (game as { private?: unknown } | null)?.private === true ? "private" : "unreadable",
      );
      return;
    }
    setBlocked(null);
    setShared({ version, game });
  };

  useEffect(() => {
    let stopped = false;
    const ask = async (attempt: number): Promise<void> => {
      try {
        const response = await sessionFetch("/api/chess/me", {
          credentials: "same-origin",
          signal: AbortSignal.timeout(ATTEMPT_MS),
        });
        if (response.ok) {
          const body = (await response.json()) as { author: string };
          if (!stopped) setAuthor(body.author);
          return;
        }
      } catch {
        // Asked again below.
      }
      if (stopped) return;
      await new Promise((resolve) => setTimeout(resolve, Math.min(4_000, 250 * 2 ** attempt)));
      return ask(attempt + 1);
    };
    void ask(0);
    return () => {
      stopped = true;
    };
  }, []);

  const handler = useRef(take);
  handler.current = take;
  useEffect(() => {
    let source: EventSource | null = null;
    let heard = Date.now();
    const open = () => {
      source?.close();
      heard = Date.now();
      source = new EventSource(`/live/chess/${gameId}`);
      source.addEventListener("state", (event) => {
        heard = Date.now();
        const frame = JSON.parse((event as MessageEvent<string>).data) as {
          version: number;
          state: SharedGame;
        };
        handler.current(frame.version, frame.state);
      });
      source.addEventListener("ping", () => {
        heard = Date.now();
      });
    };
    open();
    const watchdog = setInterval(() => {
      if (Date.now() - heard > SILENCE_MS) open();
    }, 1_000);
    return () => {
      clearInterval(watchdog);
      source?.close();
    };
  }, [gameId]);

  // What the window shows: the server's game, or a write of this window's on its way to it.
  // One write is in flight at a time, since each depends on the game the last one made: while
  // one is, the board and New Game keep the game shown and do nothing.
  const [optimistic, setOptimistic] = useState<SharedGame | null>(null);
  const writing = useRef(false);
  // `writing` for rendering: the window refuses actions while a write is on its way.
  const [busy, setBusy] = useState(false);
  // False once the window is gone: its writes stop being retried.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const current = optimistic ?? shared?.game ?? null;
  const { game, refused } = useMemo(() => replay(current?.plies ?? []), [current]);

  /** Send the one write in flight; whatever the server answers, its game is the one shown. */
  const send = async (url: string, body: unknown, shown: SharedGame) => {
    writing.current = true;
    setBusy(true);
    setOptimistic(shown);
    try {
      const reply = await post(url, body, () => alive.current);
      if (!reply) return;
      const answer = reply.body as { version?: number; state?: SharedGame } | null;
      if (answer?.state && typeof answer.version === "number") {
        take(answer.version, answer.state);
      } else {
        // A refusal without the game (403): read it.
        const response = await sessionFetch(API, {
          credentials: "same-origin",
          signal: AbortSignal.timeout(ATTEMPT_MS),
        }).catch(() => null);
        const fresh = (await response?.json().catch(() => null)) as {
          version: number;
          state: SharedGame;
        } | null;
        if (fresh) take(fresh.version, fresh.state);
      }
    } finally {
      writing.current = false;
      if (alive.current) {
        setBusy(false);
        setOptimistic(null);
      }
    }
  };

  const submit = (ply: Omit<Ply, "author">) => {
    if (!current || !author || writing.current) return;
    const index = current.plies.length;
    // The side to move is the other browser's: the board keeps the server's game.
    const white = index % 2 === 0;
    const seat = white ? current.white : current.black;
    if (seat !== null && seat !== author) return;
    // Moving a free side takes it, as the server will record.
    const shown: SharedGame = {
      ...current,
      white: white ? author : current.white,
      black: white ? current.black : author,
      plies: [...current.plies, { ...ply, author }],
    };
    void send(`${API}/plies`, { number: current.number, ply: index, ...ply }, shown);
  };

  /**
   * Why the window cannot take `action` now, or `undefined` when it can: asked by `Chess`
   * before it makes, announces or reports a move, a draw or a new game.
   */
  const refuse = (action: "move" | "draw" | "new"): string | undefined => {
    if (!author) return "Still connecting to the server. Try again in a moment.";
    if (busy || writing.current) return "Waiting for the server to record the last change.";
    // New Game starts a game the server cannot read again (`reset`), so a board whose first
    // state was unreadable can still recover.
    if (action === "new") return blocked === "private" ? PRIVATE : undefined;
    // The game shown is the last one read: a move on it could not be the next ply of the game
    // the server holds now.
    if (blocked === "unreadable") return UNREADABLE;
    if (blocked === "private") return PRIVATE;
    if (!current) return "Still connecting to the server. Try again in a moment.";
    const white = current.plies.length % 2 === 0;
    const seat = white ? current.white : current.black;
    if (seat !== null && seat !== author) return "It is the other player's move.";
    return undefined;
  };

  const name = (seat: string | null | undefined, fallback: string | undefined) =>
    seat == null ? fallback : seat === author ? "You" : "Opponent";

  const playsBlack = current?.black === author && current?.white !== author;

  return (
    <>
      <Chess
        {...props}
        {...preferences.look}
        rotated={Boolean(props.rotated) !== (preferences.sideDown && playsBlack)}
        white={name(current?.white, white)}
        black={name(current?.black, black)}
        game={game}
        notice={
          blocked === "unreadable"
            ? UNREADABLE
            : blocked === "private"
              ? PRIVATE
              : refused === null
                ? undefined
                : `This game holds a move the rules refuse (move ${refused + 1}). Choose New Game to play again.`
        }
        refuse={(action) => props.refuse?.(action) ?? refuse(action)}
        onMove={(move, next) => {
          onMove?.(move, next);
          submit({ from: move.from, to: move.to, promotion: move.promotion ?? undefined });
        }}
        onClaimDraw={(next) => {
          onClaimDraw?.(next);
          submit({ draw: true });
        }}
        onNewGame={() => {
          onNewGame?.();
          if (writing.current) return;
          if (blocked === "unreadable") {
            void send(`${API}/reset`, {}, { number: 1, plies: [], white: null, black: null });
            return;
          }
          if (!current) return;
          void send(
            `${API}/new`,
            { number: current.number },
            { number: current.number + 1, plies: [], white: null, black: null },
          );
        }}
      />
      {preferences.window}
    </>
  );
}
