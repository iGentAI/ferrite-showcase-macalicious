"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TextField } from "macalicious/text-field";
import {
  type ComponentType,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { fileItemsOfDrag, useDesktopDrop } from "../desktop/desktop-drag";
import { EditRows } from "../desktop/desktop-edit-rows";
import {
  ensureDrive,
  readFile,
  SPECIAL_FOLDER_IDS,
  specialFolder,
  uploadFile,
} from "../desktop/desktop-files";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import { onAddressRequest, takeAddressRequests } from "../desktop/desktop-reach";
import { sessionFetch } from "../desktop/desktop-server";
import { DriveOpenPanel } from "../finder/finder-file-dialogs";
import { onOpenFileRequest, takeOpenFileRequests } from "../finder/finder-open";
import { Chess, type ChessProps } from "./chess";
import { ChessClocks, CLOCK_CHOICES, type GameClock } from "./chess-clocks";
import type { EngineLevel, EngineMove } from "./chess-engine";
import {
  CHESS_VARIANTS,
  type ChessSide,
  type ChessVariant,
  describeMove,
  gameStatus,
} from "./chess-game";
import { chosenAfter, chosenByArrow, type GamesChosen, NOTHING_CHOSEN } from "./chess-games-choice";
import { hintIdea } from "./chess-hint";
import { ATTEMPT_MS, isSharedGame, type Ply, post, replay, type SharedGame } from "./chess-live";
import { ChessGameLog } from "./chess-log";
import {
  isPgn,
  MAX_PGN_BYTES,
  notationOf,
  pgnFileName,
  pgnResult,
  readPgn,
  writePgn,
} from "./chess-pgn";
import { LEVEL_NAMES, readLevel, useChessPreferences, useSpokenMoves } from "./chess-preferences";
import { printGame } from "./chess-print";
import { type RecentFile, readRecentFiles, withRecentFile } from "./chess-recent";
import { createThinker } from "./chess-thinker";
import type { SpokenCommand } from "./chess-voice";

/*
 * The signed-in person's own Chess games, on the desktop's Ferrite application
 * (`ferrite-apps/desktop/src/apps/chess`). The server is the only record of every game: the
 * window shows a move once the server has it, and keeps nothing of its own but which game it
 * shows and how far back the person is looking.
 *
 * - New Game… asks how to play: against the computer at one of four levels, or against another
 *   account, by its account name, who is invited and plays once they accept.
 * - Games… lists the person's games, newest first, and the invitations waiting for them, with
 *   Accept and Decline.
 * - The other player's moves and answers arrive through the person's own live stream: the
 *   server counts a change in their Chess (`SERVER_CHANGE_EVENT`), and the window reads its list
 *   and the game it shows again. No feed names a game between players.
 * - Against the computer, the computer's moves are chosen in a Web Worker
 *   (`chess-thinker.ts`), so the desktop goes on answering while it thinks, and sent like any
 *   other move. A move found for a position the game has since left is dropped.
 * - Back and Forward step through the moves of the game shown; Resign gives it up.
 *
 * The window opens on the newest game still being played, or on a fresh board where White’s
 * first move starts a standard game against the computer.
 */

/** A game between accounts or against the computer, as the server keeps it. */
export interface AccountGame extends SharedGame {
  white_name?: string;
  black_name?: string;
  computer?: { side: ChessSide; level: number };
  invite?: {
    from: string;
    to: string;
    by: string;
    state: "pending" | "accepted" | "declined" | "withdrawn";
  };
  created_ms?: number;
  ended?: {
    reason: "resigned" | "declined" | "withdrawn" | "time";
    winner?: ChessSide;
    at_ms: number;
  };
  clock?: GameClock;
  variant?: ChessVariant;
}

/** One line of the person's list of games. */
export interface GameSummary {
  id: string;
  status: "invited" | "playing" | "over" | "unreadable";
  opponent?: string | null;
  side?: ChessSide | null;
  computer?: { side: ChessSide; level: number } | null;
  invite?: AccountGame["invite"] | null;
  winner?: ChessSide | null;
  reason?: string | null;
  plies?: number;
  turn?: ChessSide;
  created_ms?: number;
  variant?: ChessVariant;
}

interface Mine {
  games: GameSummary[];
  invitations: GameSummary[];
}

interface Me {
  author: string;
  name?: string;
  full_name?: string;
}

/** How long Show Last Move and Show Hint keep pointing at a move. */
const POINTED_MS = 4_000;

/** The strength of a hint, whatever the computer's level in the game. */
const HINT_LEVEL: EngineLevel = 3;

/** How long Force Computer Move lets the computer look, in milliseconds. */
const FORCED_BUDGET_MS = 100;

const COMPUTER_ONLY = "Only in a game against the computer that is being played.";
const NO_TAKE_BACK = "Only in a game against the computer, once you have moved.";
const NO_SAVE = "Your games keep themselves on this desktop. Save As… writes a copy as a file.";
const NO_RECENT = "No saved game has been opened yet.";
const NOTHING_TO_EDIT = "Click in a text field, or select text in the Game Log, first.";
const NO_RECENT_FILES: readonly RecentFile[] = [];
const NOTHING_TO_SAVE = "This game has no moves to save yet.";
const FROM_FILE = "This game is from a file. Choose New Game or Games… to play.";

/** A game opened from a file, which the window shows and plays none of. */
interface OpenedGame {
  name: string;
  white: string;
  black: string;
  plies: Ply[];
  /** The result the file states. */
  result: string;
  variant: ChessVariant;
  /** How many of its moves the board shows. */
  at: number;
}

/** How long the computer waits before it looks for a move, so its reply does not jump in. */
const COMPUTER_PAUSE_MS = 100;

const other = (side: ChessSide): ChessSide => (side === "white" ? "black" : "white");
const sideOfPly = (ply: number): ChessSide => (ply % 2 === 0 ? "white" : "black");
const sideName = (side: ChessSide) => (side === "white" ? "White" : "Black");

/** How a game that ended away from the board ended, in a sentence; `undefined` otherwise. */
export function describeEnding(game: AccountGame): string | undefined {
  const { ended } = game;
  if (!ended) return undefined;
  const name = (side: ChessSide) =>
    (side === "white" ? game.white_name : game.black_name) ?? sideName(side);
  switch (ended.reason) {
    case "declined":
      return `${game.invite?.to ?? "The other player"} declined the invitation.`;
    case "withdrawn":
      return `${game.invite?.from ?? "The other player"} withdrew the invitation.`;
    case "resigned":
      return ended.winner
        ? `${name(other(ended.winner))} resigned. ${name(ended.winner)} wins.`
        : "A player resigned.";
    case "time":
      return ended.winner
        ? `${name(other(ended.winner))} ran out of time. ${name(ended.winner)} wins.`
        : "A player ran out of time.";
  }
}

/** A game's kept moves, as PGN writes them: no claimed draw. */
const movesOfPlies = (plies: readonly Ply[]) =>
  plies.flatMap((ply) =>
    ply.to && (ply.from || ply.drop) ? [{ ...ply, from: ply.from ?? "", to: ply.to }] : [],
  );

/** The variant's name after a game's description, unless it is regular chess. */
const variantNote = (variant?: ChessVariant) => {
  const named = CHESS_VARIANTS.find(({ id }) => id === variant && id !== "regular");
  return named ? ` · ${named.name}` : "";
};

/**
 * How a game in the list stands, in a few words, for the person whose list it is: `author` is
 * their public id, which tells an invitation they sent from one sent to them.
 */
export function describeSummary(game: GameSummary, author?: string): string {
  return describeStanding(game, author) + variantNote(game.variant);
}

function describeStanding(game: GameSummary, author?: string): string {
  if (game.status === "unreadable") return "A game the server cannot read";
  const opponent = game.opponent ?? "Unknown";
  const plies = game.plies ?? 0;
  if (game.status === "invited") {
    const sent = author !== undefined && game.invite?.by === author;
    return sent ? `${opponent} · waiting for an answer` : `${opponent} · invitation`;
  }
  if (game.status === "playing") {
    const yours = game.side === game.turn || !!game.computer;
    return `${opponent} · ${yours ? "your move" : "their move"} · ${plies} plies`;
  }
  if (game.reason === "declined" || game.reason === "withdrawn") {
    return `${opponent} · ${game.reason}`;
  }
  const result = !game.winner ? "drawn" : game.winner === game.side ? "you won" : "you lost";
  return `${opponent} · ${result} · ${plies} plies`;
}

/**
 * A gate for replies that may come back out of order: `begin` numbers a request, and `accept`
 * says whether its reply is newer than every reply already taken (and takes it).
 */
export function latestOnly() {
  let begun = 0;
  let taken = 0;
  return {
    begin: () => ++begun,
    accept: (ticket: number) => {
      if (ticket <= taken) return false;
      taken = ticket;
      return true;
    },
  };
}

/** GET `url` as JSON: the parsed body of a reply below 300, or `null`. */
async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await sessionFetch(url, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(ATTEMPT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** A game as the server has it; `"gone"` when it answers that there is none for this person, and
 * `null` when it could not be asked, which is worth asking again. */
async function getGame(id: string): Promise<{ version: number; state: unknown } | "gone" | null> {
  try {
    const response = await sessionFetch(`/api/chess/games/${id}`, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(ATTEMPT_MS),
    });
    if (response.status === 404) return "gone";
    if (!response.ok) return null;
    return (await response.json()) as { version: number; state: unknown };
  } catch {
    return null;
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AccountChess({
  white,
  black,
  onMove,
  onNewGame,
  onClaimDraw,
  DesktopWindow,
  preferencesOpen = false,
  onPreferencesOpenChange,
  state: windowState = "key",
  ...props
}: ChessProps & {
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
  preferencesOpen?: boolean;
  onPreferencesOpenChange?: (open: boolean) => void;
}) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const [me, setMe] = useState<Me | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const mineRef = useRef<Mine | null>(null);
  // The game shown, kept beside the state so a reply handler sees a change before a render.
  const [gameId, setGameId] = useState<string | null>(null);
  const currentId = useRef<string | null>(null);
  // Every choice of game (from Games, New Game, an accepted invitation) counts here, so a
  // choice made while an older one is still on its way wins.
  const selection = useRef(0);
  const [shared, setShared] = useState<{ id: string; version: number; game: AccountGame } | null>(
    null,
  );
  // The game the server could not read, while it is the one shown.
  const [unreadable, setUnreadable] = useState<string | null>(null);
  // The game that could not be asked for just now, while it is being asked for again.
  const [unreachable, setUnreachable] = useState<string | null>(null);
  const latest = useRef({ id: "", version: -1 });
  const [review, setReview] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"new" | "games" | null>(null);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [opened, setOpened] = useState<OpenedGame | null>(null);
  const [picking, setPicking] = useState(false);
  const [logOpen, setLogOpen] = useDesktopSetting("chess.gameLog", readBoolean, false);
  // The games with a write on its way: one at a time per game, since each depends on the last.
  const inFlight = useRef(new Set<string>());
  const [inFlightIds, setInFlightIds] = useState<ReadonlySet<string>>(() => new Set());

  const current = shared && shared.id === gameId ? shared.game : null;
  const busy = gameId !== null && inFlightIds.has(gameId);

  const show = (id: string | null, fromStart = false) => {
    currentId.current = id;
    setGameId(id);
    setReview(fromStart ? 0 : null);
    setMessage(undefined);
    setOpened(null);
  };

  // A game of the person's asked for from Spotlight or a notification, while the window was closed
  // or is open. A notification of a move or an ending says `<game>-<what>`; a game's id is hex.
  useOpenItemRequests("chess", ({ id }) => {
    selection.current += 1;
    show(id.split("-")[0] ?? id);
    setSheet(null);
  });

  /** Take a game the server sent for `id`, unless another game is shown or it is older. */
  const take = (id: string, version: number, state: unknown) => {
    if (id !== currentId.current || typeof version !== "number") return;
    if (latest.current.id === id && version < latest.current.version) return;
    latest.current = { id, version };
    if (!isSharedGame(state)) {
      setUnreadable(id);
      return;
    }
    setUnreadable(null);
    setShared({ id, version, game: state as AccountGame });
  };

  /** Read the game `id` again (when it is still the one shown). */
  const load = async (id: string) => {
    const body = await getJson<{ version: number; state: unknown }>(`/api/chess/games/${id}`);
    if (body && alive.current) take(id, body.version, body.state);
  };

  // The list as the newest reply says: an older reply that arrives after it is not taken, and
  // whoever asked is given the newest list taken.
  const lists = useRef(latestOnly());
  const refresh = async (): Promise<Mine | null> => {
    const ticket = lists.current.begin();
    const body = await getJson<Mine>("/api/chess/mine");
    if (!alive.current) return null;
    if (body && lists.current.accept(ticket)) {
      mineRef.current = body;
      setMine(body);
    }
    return body ? mineRef.current : null;
  };

  // Who this is, asked until answered; then the list, until it answers, and the newest game
  // still being played, unless the person has chosen something meanwhile.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the window opens
  useEffect(() => {
    let stopped = false;
    void (async () => {
      for (let attempt = 0; !stopped; attempt++) {
        const body = await getJson<Me>("/api/chess/me");
        if (stopped) return;
        if (body) {
          setMe(body);
          break;
        }
        await pause(Math.min(4_000, 250 * 2 ** attempt));
      }
      const ticket = selection.current;
      for (let attempt = 0; !stopped; attempt++) {
        const list = await refresh();
        if (stopped) return;
        if (list) {
          const playing = list.games.find((game) => game.status === "playing");
          if (playing && selection.current === ticket && currentId.current === null) {
            show(playing.id);
          }
          return;
        }
        await pause(Math.min(4_000, 500 * 2 ** attempt));
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  // A game shown is read when it is chosen, and again whenever the server says the person's
  // Chess changed (a move or an answer of the other player, or this person's in another
  // browser), and when the page comes back into view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of game reloads it
  useEffect(() => {
    setUnreadable(null);
    setUnreachable(null);
    if (!gameId) return undefined;
    let stopped = false;
    void (async () => {
      for (let attempt = 0; !stopped; attempt++) {
        const body = await getGame(gameId);
        if (stopped || !alive.current) return;
        if (body === "gone") {
          show(null);
          setMessage("This game is no longer on the server.");
          return;
        }
        if (body) {
          setUnreachable(null);
          take(gameId, body.version, body.state);
          return;
        }
        setUnreachable(gameId);
        await pause(Math.min(4_000, 500 * 2 ** attempt));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [gameId]);
  const handler = useRef(() => {});
  handler.current = () => {
    void refresh();
    if (currentId.current) void load(currentId.current);
  };
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ app?: string }>).detail?.app === "chess") handler.current();
    };
    const visible = () => {
      if (document.visibilityState === "visible") handler.current();
    };
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener(SERVER_CHANGE_EVENT, changed);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  /** Send one write for the game `id`; whatever the server answers, its game is the one shown. */
  const send = async (id: string, url: string, body: unknown) => {
    inFlight.current.add(id);
    setInFlightIds(new Set(inFlight.current));
    try {
      const reply = await post(url, body, () => alive.current);
      if (!reply || !alive.current) return reply;
      const answer = reply.body as { version?: number; state?: unknown; error?: string } | null;
      if (answer?.state !== undefined && typeof answer.version === "number") {
        take(id, answer.version, answer.state);
      } else {
        await load(id);
      }
      // A refusal is said only while its own game is the one shown.
      if (reply.status >= 400 && answer?.error && currentId.current === id) {
        setMessage(answer.error);
      }
      return reply;
    } finally {
      inFlight.current.delete(id);
      if (alive.current) setInFlightIds(new Set(inFlight.current));
    }
  };

  const variant = current?.variant ?? "regular";
  const shownVariant = opened?.variant ?? variant;
  const { game, refused } = useMemo(
    () => replay(current?.plies ?? [], current?.variant),
    [current],
  );
  const plies = current?.plies.length ?? 0;
  const shownGame = useMemo(
    () =>
      opened
        ? replay(opened.plies.slice(0, opened.at), opened.variant).game
        : review === null
          ? game
          : replay(current?.plies.slice(0, review) ?? [], current?.variant).game,
    [game, review, current, opened],
  );
  const board = gameStatus(game).state;
  const pending = current?.invite?.state === "pending" && !current.ended;
  const over = !!current?.ended || board !== "playing" || refused !== null;
  const turn = sideOfPly(plies);
  const computer = current?.computer ?? null;
  const mySide: ChessSide | null =
    !current || !me
      ? null
      : computer
        ? other(computer.side)
        : current.white === me.author
          ? "white"
          : current.black === me.author
            ? "black"
            : null;
  const inviter = !!current?.invite && current.invite.by === me?.author;
  const opponentName =
    mySide === "white" ? current?.black_name : mySide === "black" ? current?.white_name : undefined;

  const submit = (ply: Omit<Ply, "author">) => {
    const id = currentId.current;
    if (!current || !me || !id || id !== gameId || inFlight.current.has(id)) return;
    setMessage(undefined);
    void send(id, `/api/chess/games/${id}/plies`, {
      number: current.number,
      ply: current.plies.length,
      ...ply,
    });
  };

  // The computer's move: looked for in a worker once its turn comes, and sent as a ply only if
  // the game is still where it was when the search began. The search is stopped as soon as the
  // position, the game shown or the window goes.
  const thinker = useRef(createThinker());
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const position = current && gameId ? `${gameId}:${current.number}:${plies}` : null;
  const positionRef = useRef(position);
  positionRef.current = position;
  const computerTurn = !!computer && !over && !busy && turn === computer.side && !pending;
  const level = (computer?.level ?? 1) as EngineLevel;
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the position, not on every render
  useEffect(() => {
    if (!computerTurn || !position || !current) return;
    const asked = position;
    const timer = setTimeout(() => {
      void thinker.current.think(current.plies, level, undefined, variant).then((move) => {
        // A search stopped or superseded is no answer: the position has moved on, or the
        // window waits for a write of its own (a resignation, say).
        if (move === undefined || !alive.current || positionRef.current !== asked) return;
        if (move) submitRef.current(move);
        else setMessage("The computer could not choose a move. Choose Resign or New Game.");
      });
    }, COMPUTER_PAUSE_MS);
    return () => {
      clearTimeout(timer);
      thinker.current.cancel();
    };
  }, [computerTurn, position, level]);
  useEffect(() => {
    thinker.current.prepare();
    return () => thinker.current.stop();
  }, []);

  // What Show Last Move and Show Hint point out, with the sentence the status line says for it.
  const [pointed, setPointed] = useState<{ from?: string; to?: string; text: string } | null>(null);
  const [hint, setHint] = useState<EngineMove | null>(null);
  const hinter = useRef(createThinker());
  useEffect(() => {
    if (!pointed?.to) return;
    const timer = setTimeout(() => setPointed(null), POINTED_MS);
    return () => clearTimeout(timer);
  }, [pointed]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a move or a step ends what is pointed out
  useEffect(() => {
    hinter.current.stop();
    setPointed(null);
    setHint(null);
  }, [position, review, opened, current?.ended?.at_ms]);
  useEffect(() => () => hinter.current.stop(), []);

  const showLastMove = () => {
    const last = shownGame.moves[shownGame.moves.length - 1];
    if (last)
      setPointed({ from: last.from, to: last.to, text: `Last move: ${describeMove(last)}` });
  };

  const showHint = () => {
    if (!current) return;
    if (hint) {
      const text = hint.drop
        ? `Drop a ${hint.drop} on ${hint.to}.`
        : `${hint.from} to ${hint.to}${hint.promotion ? `, promoting to ${hint.promotion}` : ""}.`;
      setPointed({ from: hint.from, to: hint.to, text: `Hint: ${text}` });
      return;
    }
    const asked = position;
    setPointed({ text: "Looking for a hint…" });
    void hinter.current.think(current.plies, HINT_LEVEL, undefined, variant).then((move) => {
      if (move === undefined || !alive.current || positionRef.current !== asked) return;
      setHint(move);
      setPointed({
        text: move
          ? `Hint: ${hintIdea(game, move)} Choose Show Suggested Move to see it.`
          : "The computer has no hint for this position.",
      });
    });
  };

  const forceComputerMove = () => {
    if (!current || !computerTurn) return;
    const asked = position;
    void thinker.current.think(current.plies, level, FORCED_BUDGET_MS, variant).then((move) => {
      if (move === undefined || !alive.current || positionRef.current !== asked) return;
      if (move) submitRef.current(move);
      else setMessage("The computer could not choose a move. Choose Resign or New Game.");
    });
  };

  // The person's last move goes, with the computer's answer when it has given one.
  const takeBackTo =
    computer && plies > 0 ? (sideOfPly(plies - 1) === computer.side ? plies - 2 : plies - 1) : -1;
  const canTakeBack =
    takeBackTo >= 0 && !opened && review === null && !busy && !current?.ended && !pending;
  const takeBack = () => {
    const id = currentId.current;
    if (!canTakeBack || !current || !id || id !== gameId || inFlight.current.has(id)) return;
    setMessage(undefined);
    void send(id, `/api/chess/games/${id}/takeback`, {
      number: current.number,
      to: takeBackTo,
      version: latest.current.version,
    });
  };

  // New Game's choices.
  const [opponent, setOpponent] = useState<"computer" | "person">("computer");
  const [clockChoice, setClockChoice] = useState<string>("none");
  const [variantChoice, setVariantChoice] = useState<ChessVariant>("regular");
  const preferences = useChessPreferences({
    DesktopWindow,
    open: preferencesOpen,
    onOpenChange: onPreferencesOpenChange,
    speaks: true,
  });
  const [recentFiles, setRecentFiles] = useDesktopSetting(
    "chess.recentFiles",
    readRecentFiles,
    NO_RECENT_FILES,
  );
  const recentFilesNow = useRef(recentFiles);
  recentFilesNow.current = recentFiles;
  const rotatedNow = useRef(false);
  const levelChoice = String(preferences.level);
  const setLevelChoice = (value: string) => {
    const chosen = readLevel(Number(value));
    if (chosen) preferences.setLevel(chosen);
  };
  const [playAs, setPlayAs] = useState<string>("white");
  const [invitedName, setInvitedName] = useState("");
  const [sheetError, setSheetError] = useState<string | undefined>(undefined);
  const [starting, setStarting] = useState(false);
  // The key of the last request New Game sent, kept with what it asked for while its outcome is
  // unknown, so asking again for the same game resends it rather than makes a second one.
  const startKey = useRef<{ asked: string; key: string } | null>(null);

  const start = async (openingMove?: Pick<Ply, "from" | "to">) => {
    if (starting || !me) return;
    const name = invitedName.trim();
    const againstComputer = !!openingMove || opponent === "computer";
    if (!againstComputer && name === "") {
      setSheetError("Type the account name of the person to invite.");
      return;
    }
    // This choice supersedes any earlier one still on its way.
    const ticket = ++selection.current;
    setStarting(true);
    setSheetError(undefined);
    try {
      const side = playAs === "black" ? "black" : playAs === "random" ? "random" : "white";
      const url = againstComputer ? "/api/chess/games" : "/api/chess/invitations";
      const timed = clockChoice === "none" ? {} : { clock_minutes: Number(clockChoice) };
      const ruled = variantChoice === "regular" ? {} : { variant: variantChoice };
      const request = openingMove
        ? { computer: { side: "black", level: preferences.level } }
        : againstComputer
          ? {
              computer: {
                side: other(side === "black" ? "black" : "white"),
                level: Number(levelChoice),
              },
              ...timed,
              ...ruled,
            }
          : { to: name, side, ...timed, ...ruled };
      // One key for the whole request, resent with every retry, so a lost reply never makes a
      // second game; and the same key again for the same request asked again after no answer.
      const asked = JSON.stringify([url, request]);
      if (startKey.current?.asked !== asked) {
        startKey.current = { asked, key: crypto.randomUUID() };
      }
      const reply = await post(url, request, () => alive.current, {
        "idempotency-key": startKey.current.key,
      });
      if (!alive.current) return;
      // Answered: the next request is a new one.
      if (reply) startKey.current = null;
      const body = reply?.body as {
        id?: string;
        version?: number;
        state?: unknown;
        error?: string;
      } | null;
      if ((reply?.status !== 201 && reply?.status !== 200) || !body?.id) {
        const reportError = openingMove ? setMessage : setSheetError;
        reportError(
          body?.error ??
            (againstComputer
              ? "The game could not be started."
              : "The invitation could not be sent."),
        );
        return;
      }
      if (selection.current === ticket) {
        show(body.id);
        if (typeof body.version === "number") take(body.id, body.version, body.state);
        setSheet((now) => (now === "new" ? null : now));
        if (openingMove && isSharedGame(body.state) && body.state.plies.length === 0) {
          await send(body.id, `/api/chess/games/${body.id}/plies`, {
            number: body.state.number,
            ply: 0,
            ...openingMove,
          });
        }
      }
      if (!againstComputer) setInvitedName("");
      // The game is the server's now: the owner hears of it.
      onNewGame?.();
      void refresh();
    } finally {
      if (alive.current) setStarting(false);
    }
  };

  /** Accept, decline or withdraw an invitation, or resign the game `id`. */
  const settle = async (id: string, verb: "accept" | "decline" | "resign") => {
    if (inFlight.current.has(id)) return;
    const ticket = verb === "accept" ? ++selection.current : selection.current;
    const reply = await send(id, `/api/chess/games/${id}/${verb}`, {});
    if (!alive.current) return;
    if (reply && reply.status < 300 && verb === "accept" && selection.current === ticket) {
      if (currentId.current !== id) show(id);
      setSheet((now) => (now === "games" ? null : now));
    }
    void refresh();
  };

  const refuse = (action: "move" | "draw" | "new"): string | undefined => {
    if (!me) return "Still connecting to the server. Try again in a moment.";
    if (action === "new") return undefined;
    if (opened) return FROM_FILE;
    if (!gameId) {
      if (!mine) return "Loading your games…";
      if (starting) return "Starting the game…";
      return action === "move" ? undefined : "No game is open.";
    }
    if (unreadable === gameId)
      return "The server cannot read this game. Choose Games to remove it.";
    if (!current) return "Still connecting to the server. Try again in a moment.";
    if (busy) return "Waiting for the server to record the last move.";
    if (review !== null)
      return "You are looking back over the game. Choose Forward to its last move to play.";
    if (pending) {
      return inviter
        ? `Waiting for ${opponentName ?? "the other player"} to accept the invitation.`
        : "Accept the invitation to start playing.";
    }
    if (current.ended) return "This game is over. Choose New Game to play again.";
    if (computer && turn === computer.side) return "The computer is thinking.";
    const seat = turn === "white" ? current.white : current.black;
    if (seat !== me.author) return "It is the other player's move.";
    return undefined;
  };

  const notice = (() => {
    if (message) return message;
    if (pointed) return pointed.text;
    if (opened) return `${opened.name}: move ${opened.at} of ${opened.plies.length}.`;
    if (!gameId) {
      if (!mine) return "Loading your games…";
      if (starting) return "Starting the game…";
      return "Move a white piece to play the computer, or choose New Game for more options.";
    }
    if (unreadable === gameId)
      return "The server cannot read this game. Choose Games to remove it.";
    if (!current)
      return unreachable === gameId
        ? "The game could not be read. Trying again…"
        : "Opening the game…";
    if (refused !== null) return `This game holds a move the rules refuse (move ${refused + 1}).`;
    if (review !== null) return `Move ${review} of ${plies}. Choose Forward to see the next.`;
    if (current.ended) return describeEnding(current);
    if (pending) {
      return inviter
        ? `Waiting for ${opponentName ?? "the other player"} to accept the invitation.`
        : `${opponentName ?? "Someone"} invited you to play. Accept or Decline.`;
    }
    if (computer && turn === computer.side && board === "playing")
      return "The computer is thinking…";
    return undefined;
  })();

  const invitations = mine?.invitations.length ?? 0;
  const step = (to: number) => {
    if (opened) setOpened({ ...opened, at: Math.min(opened.plies.length, Math.max(0, to)) });
    else setReview(to >= plies ? null : Math.max(0, to));
  };
  const at = opened ? opened.at : (review ?? plies);
  const atEnd = opened ? opened.at >= opened.plies.length : review === null;
  const playing = !opened && !!current && !over && !pending && mySide !== null;

  // The moves of the game shown, for the Game Log and for a file.
  const shownPlies = opened?.plies ?? current?.plies ?? [];
  const movesShown = useMemo(() => movesOfPlies(shownPlies), [shownPlies]);
  const notation = useMemo(() => notationOf(movesShown, shownVariant), [movesShown, shownVariant]);
  useSpokenMoves(opened?.name ?? gameId ?? null, notation, preferences.speakMoves);
  const whiteName = opened?.white ?? current?.white_name ?? white ?? "White";
  const blackName = opened?.black ?? current?.black_name ?? black ?? "Black";

  /** Saves a game in the person's Downloads folder, under a free name; the name it got. */
  const savePgn = async (
    names: { white: string; black: string },
    moves: ReturnType<typeof movesOfPlies>,
    result: ReturnType<typeof pgnResult>,
    variantPlayed: ChessVariant,
  ) => {
    const text = writePgn({ ...names, moves, result, date: new Date(), variant: variantPlayed });
    const drive = await ensureDrive();
    const folder = specialFolder(drive, "Downloads")?.id ?? SPECIAL_FOLDER_IDS.Downloads;
    const entry = await uploadFile(new Blob([text], { type: "application/x-chess-pgn" }), folder, {
      name: pgnFileName(names.white, names.black),
      existing: "rename",
    });
    return entry.name;
  };

  /** Saves the game shown in the person's Downloads folder, under a free name. */
  const saveAs = async () => {
    try {
      const name = await savePgn(
        { white: whiteName, black: blackName },
        movesShown,
        opened
          ? opened.result
          : pgnResult(replay(shownPlies, shownVariant).game, current?.ended?.winner),
        shownVariant,
      );
      if (alive.current) setMessage(`Saved as “${name}” in Downloads.`);
    } catch (error) {
      if (alive.current) {
        setMessage(
          `The game could not be saved: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  };

  // The Games sheet: the games chosen, what the last command there said, and whether it is asking
  // before it deletes them.
  const [chosen, setChosen] = useState<GamesChosen>(NOTHING_CHOSEN);
  const [gamesNote, setGamesNote] = useState<string | undefined>();
  const [deleting, setDeleting] = useState(false);
  const listedGames = mine?.games ?? [];
  const listedOrder = listedGames.map((each) => each.id);
  const chosenGames = listedGames.filter((each) => chosen.ids.includes(each.id));

  const openListed = (each: GameSummary) => {
    selection.current += 1;
    show(each.id, each.status === "over" && (each.plies ?? 0) > 0);
    setSheet(null);
  };

  /** Saves a listed game in Downloads, as the Games sheet's Export. */
  const exportListed = async (each: GameSummary) => {
    setGamesNote(undefined);
    try {
      const body = await getJson<{ state: unknown }>(`/api/chess/games/${each.id}`);
      if (!body || !isSharedGame(body.state)) throw new Error("The server did not give the game.");
      const game = body.state as AccountGame;
      const name = await savePgn(
        { white: game.white_name ?? "White", black: game.black_name ?? "Black" },
        movesOfPlies(game.plies),
        pgnResult(replay(game.plies, game.variant).game, game.ended?.winner),
        game.variant ?? "regular",
      );
      if (alive.current) setGamesNote(`Saved as “${name}” in Downloads.`);
    } catch (error) {
      if (alive.current) {
        setGamesNote(
          `The game could not be saved: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  };

  /** Takes the chosen games off the list, one request each, and says what would not go. */
  const deleteChosen = async () => {
    setDeleting(false);
    setGamesNote(undefined);
    const refused: string[] = [];
    for (const each of chosenGames) {
      // A game that is sure to go stops being shown first, so nothing reads it once it has gone.
      const goes = !!each.computer || each.status === "over" || each.status === "unreadable";
      if (goes && currentId.current === each.id) show(null);
      const reply = await post(`/api/chess/games/${each.id}/remove`, {}, () => alive.current);
      if (!alive.current) return;
      if (reply?.status !== 200) refused.push(each.id);
    }
    setChosen({ ids: refused, anchor: refused[0] ?? null });
    if (refused.length > 0) {
      setGamesNote(
        refused.length === 1
          ? "This game is still being played. Resign or decline it first."
          : `${refused.length} games are still being played. Resign or decline them first.`,
      );
    }
    void refresh();
  };

  const onGamesKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if ((event.target as Element).closest("button")) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setChosen((now) => chosenByArrow(now, listedOrder, event.key === "ArrowDown" ? 1 : -1));
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setChosen({ ids: listedOrder, anchor: listedOrder[0] ?? null });
    } else if ((event.key === "Backspace" || event.key === "Delete") && chosen.ids.length > 0) {
      event.preventDefault();
      setDeleting(true);
    } else if (event.key === "Enter" && chosenGames.length === 1) {
      event.preventDefault();
      openListed(chosenGames[0] as GameSummary);
    }
  };

  /** Shows a saved game from the person's drive, or says why it cannot be read. A choice of game
   * made while the file is read, another file's included, wins. */
  const openFile = async (entry: { id: string; name: string; size?: number }) => {
    const ticket = ++selection.current;
    if (entry.size !== undefined && entry.size > MAX_PGN_BYTES) {
      setMessage(`“${entry.name}” is too large to be a saved game.`);
      return;
    }
    try {
      const read = readPgn(await (await readFile(entry.id)).text());
      if (!alive.current || selection.current !== ticket) return;
      if ("problem" in read) {
        setMessage(`“${entry.name}” cannot be opened. ${read.problem}`);
        return;
      }
      setMessage(undefined);
      setReview(null);
      setOpened({
        name: entry.name,
        white: read.white ?? "White",
        black: read.black ?? "Black",
        plies: read.moves.map((move) => ({ ...move, author: "" })),
        result: read.result,
        variant: read.variant ?? "regular",
        at: read.moves.length,
      });
      setRecentFiles(withRecentFile(recentFilesNow.current, entry));
    } catch (error) {
      if (alive.current && selection.current === ticket) {
        setMessage(
          `“${entry.name}” could not be read: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  };
  const openFileNow = useRef(openFile);
  openFileNow.current = openFile;
  // A saved game opened from Finder, while the window was closed or is open.
  useEffect(() => {
    for (const request of takeOpenFileRequests("chess")) void openFileNow.current(request);
    return onOpenFileRequest("chess", (request) => void openFileNow.current(request));
  }, []);
  // A saved game dragged from Finder.
  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item) => item.kind !== "file" || isPgn(item.name),
    onDrop: (items) => {
      const [file] = fileItemsOfDrag(items).filter((item) => isPgn(item.name));
      if (file) void openFileNow.current(file);
    },
    sayRefusal: setMessage,
    refusal: () => "Chess opens saved games, as .pgn files.",
  });
  const newGame = () => {
    setSheetError(undefined);
    setSheet("new");
  };
  // Invite to Chess… from Messages or a Contacts card: New Game with the person's account filled in.
  const inviteAsked = useRef((_to: string) => {});
  inviteAsked.current = (to) => {
    setOpponent("person");
    setInvitedName(to);
    newGame();
  };
  useEffect(() => {
    for (const { to } of takeAddressRequests("chess")) inviteAsked.current(to);
    return onAddressRequest("chess", ({ to }) => inviteAsked.current(to));
  }, []);
  const games = () => {
    setChosen(NOTHING_CHOSEN);
    setGamesNote(undefined);
    setDeleting(false);
    void refresh();
    setSheet("games");
  };

  // The menu bar's Game and Moves menus: the commands this window's buttons carry out, enabled
  // when they are (desktop-app-menus.ts). The rows change only with what they show; the commands
  // are read when one is chosen, so a render alone does not republish the menus.
  const chessCommands = useRef({
    newGame,
    games,
    settle,
    step,
    showLastMove,
    showHint,
    forceComputerMove,
    takeBack,
    saveAs,
    open: () => setPicking(true),
    openRecent: (file: RecentFile) => void openFileNow.current(file),
    print: () =>
      printGame({
        white: whiteName,
        black: blackName,
        game: shownGame,
        moves: notation,
        rotated: rotatedNow.current,
      }),
    setLogOpen,
    closeWindow: () => (props.onClose as (() => void) | undefined)?.(),
  });
  chessCommands.current = {
    newGame,
    games,
    settle,
    step,
    showLastMove,
    showHint,
    forceComputerMove,
    takeBack,
    saveAs,
    open: () => setPicking(true),
    openRecent: (file: RecentFile) => void openFileNow.current(file),
    print: () =>
      printGame({
        white: whiteName,
        black: blackName,
        game: shownGame,
        moves: notation,
        rotated: rotatedNow.current,
      }),
    setLogOpen,
    closeWindow: () => (props.onClose as (() => void) | undefined)?.(),
  };
  const canSave = movesShown.length > 0;
  const canResign = !!(playing && gameId) && !busy;
  const canShowLast = shownGame.moves.length > 0;
  const live = playing && !!computer && review === null && !busy;
  const canHint = live && turn !== computer?.side;
  const canForce = live && turn === computer?.side;
  const gameMenu = useMemo(
    () => (
      <>
        <MenuItem
          keyEquivalent="command+n"
          disabled={starting}
          onClick={() => chessCommands.current.newGame()}
        >
          New Game…
        </MenuItem>
        <MenuItem onClick={() => chessCommands.current.games()}>
          {invitations > 0 ? `Games (${invitations})…` : "Games…"}
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+o" onClick={() => chessCommands.current.open()}>
          Open…
        </MenuItem>
        <Submenu>
          <SubmenuTrigger>Open Recent</SubmenuTrigger>
          <SubmenuPopup>
            {recentFiles.map((file) => (
              <MenuItem key={file.id} onClick={() => chessCommands.current.openRecent(file)}>
                {file.name}
              </MenuItem>
            ))}
            {recentFiles.length > 0 ? <MenuSeparator /> : null}
            <MenuItem
              disabled={recentFiles.length === 0}
              title={recentFiles.length === 0 ? NO_RECENT : undefined}
              onClick={() => setRecentFiles(NO_RECENT_FILES)}
            >
              Clear Menu
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+s" disabled title={NO_SAVE}>
          Save
        </MenuItem>
        <MenuItem
          keyEquivalent="shift+command+s"
          disabled={!canSave}
          title={canSave ? undefined : NOTHING_TO_SAVE}
          onClick={() => void chessCommands.current.saveAs()}
        >
          Save As…
        </MenuItem>
        <MenuItem keyEquivalent="command+p" onClick={() => chessCommands.current.print()}>
          Print…
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={!canResign}
          onClick={() => gameId && void chessCommands.current.settle(gameId, "resign")}
        >
          Resign
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+w" onClick={() => chessCommands.current.closeWindow()}>
          Close Window
        </MenuItem>
      </>
    ),
    [starting, invitations, canResign, gameId, canSave, recentFiles, setRecentFiles],
  );
  useDesktopAppMenu("chess", "Game", gameMenu);
  useDesktopAppMenu("chess", "Edit", <EditRows nothing={NOTHING_TO_EDIT} say={setMessage} />);
  const windowMenu = useMemo(
    () =>
      DesktopWindow ? (
        <MenuCheckboxItem
          checked={logOpen}
          onCheckedChange={(open) => chessCommands.current.setLogOpen(open)}
        >
          Game Log
        </MenuCheckboxItem>
      ) : null,
    [logOpen, DesktopWindow],
  );
  useDesktopAppMenu("chess", "Window", windowMenu);
  const rows = useMemo(
    () => ({
      takeBack: (
        <MenuItem
          keyEquivalent="command+z"
          disabled={!canTakeBack}
          title={canTakeBack ? undefined : NO_TAKE_BACK}
          onClick={() => chessCommands.current.takeBack()}
        >
          Take Back Move
        </MenuItem>
      ),
      last: (
        <MenuItem
          keyEquivalent="command+l"
          disabled={!canShowLast}
          onClick={() => chessCommands.current.showLastMove()}
        >
          Show Last Move
        </MenuItem>
      ),
      hint: (
        <MenuItem
          disabled={!canHint}
          title={computer ? undefined : COMPUTER_ONLY}
          onClick={() => chessCommands.current.showHint()}
        >
          {hint ? "Show Suggested Move" : "Show Hint"}
        </MenuItem>
      ),
      force: (
        <MenuItem
          disabled={!canForce}
          title={computer ? undefined : COMPUTER_ONLY}
          onClick={() => chessCommands.current.forceComputerMove()}
        >
          Force Computer Move
        </MenuItem>
      ),
    }),
    [canShowLast, canHint, canForce, canTakeBack, computer, hint],
  );
  const movesMenu = useMemo(
    () => (
      <>
        {rows.takeBack}
        {rows.last}
        {rows.hint}
        {rows.force}
        <MenuSeparator />
        <MenuItem disabled={at === 0} onClick={() => chessCommands.current.step(at - 1)}>
          Previous Move
        </MenuItem>
        <MenuItem disabled={atEnd} onClick={() => chessCommands.current.step(at + 1)}>
          Next Move
        </MenuItem>
      </>
    ),
    [at, atEnd, rows],
  );
  useDesktopAppMenu("chess", "Moves", movesMenu);
  const dockMenu = useMemo(
    () => (
      <>
        <MenuItem onClick={() => chessCommands.current.newGame()}>New Game…</MenuItem>
        <MenuItem onClick={() => chessCommands.current.games()}>
          {invitations > 0 ? `Games (${invitations})…` : "Games…"}
        </MenuItem>
      </>
    ),
    [invitations],
  );
  useDesktopAppMenu("chess", "Dock", dockMenu);
  const [rotated, setRotated] = useDesktopSetting("chess.rotated", readBoolean, false);
  const viewMenu = useMemo(
    () => (
      <MenuItem keyEquivalent="command+r" onClick={() => setRotated(!rotated)}>
        Rotate Board
      </MenuItem>
    ),
    [rotated, setRotated],
  );
  useDesktopAppMenu("chess", "View", viewMenu);
  const facing = rotated !== (preferences.sideDown && mySide === "black");
  rotatedNow.current = facing;

  /** The keys of the menus, which work while the window has the keyboard and no sheet is up. */
  const menuKeys = [
    { key: "command+n", enabled: !starting, run: newGame },
    { key: "command+l", enabled: canShowLast, run: showLastMove },
    { key: "command+r", enabled: true, run: () => setRotated(!rotated) },
    { key: "command+z", enabled: canTakeBack, run: takeBack },
    { key: "command+o", enabled: true, run: () => setPicking(true) },
    { key: "command+s", enabled: false, run: () => {} },
    { key: "shift+command+s", enabled: canSave, run: () => void saveAs() },
    { key: "command+p", enabled: true, run: () => chessCommands.current.print() },
  ];
  /** What each spoken command does, or why it cannot be done now. */
  const spokenCommands: Readonly<Record<SpokenCommand, readonly [boolean, () => void, string]>> = {
    takeBack: [canTakeBack, takeBack, NO_TAKE_BACK],
    lastMove: [canShowLast, showLastMove, "No move has been played yet."],
    hint: [canHint, showHint, COMPUTER_ONLY],
    rotate: [true, () => setRotated(!rotated), ""],
    newGame: [!starting, newGame, "A new game is already starting."],
  };
  const onWindowKeyDown: ChessProps["onKeyDown"] = (event) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || event.repeat) return;
    if ((event.target as Element).closest("[role='dialog']")) return;
    const command = menuKeys.find((each) => matchesMenuKeyEquivalent(event.nativeEvent, each.key));
    if (!command) return;
    // The key is the command's even while it is dimmed, as in a Mac's menu bar.
    event.preventDefault();
    if (command.enabled) command.run();
  };

  return (
    <>
      <Chess
        {...props}
        ref={dropRef}
        onKeyDown={onWindowKeyDown}
        // Rotate Board turns the board from the way Preferences have it face.
        rotated={facing}
        {...preferences.look}
        onSpokenCommand={(command) => {
          const [can, run, reason] = spokenCommands[command];
          if (!can) return reason;
          run();
          return undefined;
        }}
        pointed={pointed}
        boardMenu={
          <>
            {rows.hint}
            {rows.last}
            {rows.takeBack}
            <MenuSeparator />
            <MenuItem onClick={() => setRotated(!rotated)}>Rotate Board</MenuItem>
          </>
        }
        state={sheet && windowState === "key" ? "main" : windowState}
        white={opened?.white ?? current?.white_name ?? white}
        black={opened?.black ?? current?.black_name ?? black}
        game={shownGame}
        notice={notice}
        refuse={(action) => props.refuse?.(action) ?? refuse(action)}
        newGameLabel="New Game…"
        newGameDisabled={starting}
        onNewGameRequest={newGame}
        onMove={(move, next) => {
          onMove?.(move, next);
          if (!gameId) {
            void start({ from: move.from, to: move.to });
            return;
          }
          submit({
            ...(move.drop ? { drop: move.drop } : { from: move.from }),
            to: move.to,
            promotion: move.promotion ?? undefined,
          });
        }}
        onClaimDraw={(next) => {
          onClaimDraw?.(next);
          submit({ draw: true });
        }}
        actions={
          <>
            {current?.clock && !opened ? (
              <ChessClocks
                clock={current.clock}
                running={!over && !pending ? turn : null}
                whiteName={current.white_name ?? "White"}
                blackName={current.black_name ?? "Black"}
                onExpired={() => {
                  if (gameId && !inFlight.current.has(gameId)) {
                    void send(gameId, `/api/chess/games/${gameId}/flag`, {});
                  }
                }}
              />
            ) : null}
            <PushButton aria-label="Previous move" disabled={at === 0} onClick={() => step(at - 1)}>
              Back
            </PushButton>
            <PushButton aria-label="Next move" disabled={atEnd} onClick={() => step(at + 1)}>
              Forward
            </PushButton>
            {!opened && pending && gameId && !inviter ? (
              <>
                <PushButton disabled={busy} onClick={() => void settle(gameId, "decline")}>
                  Decline
                </PushButton>
                <PushButton disabled={busy} onClick={() => void settle(gameId, "accept")}>
                  Accept
                </PushButton>
              </>
            ) : null}
            {!opened && pending && gameId && inviter ? (
              <PushButton disabled={busy} onClick={() => void settle(gameId, "decline")}>
                Withdraw
              </PushButton>
            ) : null}
            {playing && gameId ? (
              <PushButton disabled={busy} onClick={() => void settle(gameId, "resign")}>
                Resign
              </PushButton>
            ) : null}
            <PushButton onClick={games}>
              {invitations > 0 ? `Games (${invitations})…` : "Games…"}
            </PushButton>
          </>
        }
        sheets={(titleBar) => (
          <>
            <Sheet open={sheet === "new"} onOpenChange={(open) => !open && setSheet(null)}>
              <SheetPopup anchor={titleBar} width={460}>
                <SheetTitle>New Game</SheetTitle>
                <SheetDescription>
                  Play the computer, or invite someone with an account on this desktop.
                </SheetDescription>
                <div className="mac-chess-form">
                  <Label className="mac-chess-form-label">Opponent:</Label>
                  <PopUpButton
                    aria-label="Opponent"
                    value={opponent}
                    onValueChange={(value) => value && setOpponent(value as "computer" | "person")}
                  >
                    <PopUpButtonItem value="computer">Computer</PopUpButtonItem>
                    <PopUpButtonItem value="person">Another person</PopUpButtonItem>
                  </PopUpButton>
                  {opponent === "computer" ? (
                    <>
                      <Label className="mac-chess-form-label">Strength:</Label>
                      <PopUpButton
                        aria-label="Strength"
                        value={levelChoice}
                        onValueChange={(value) => value && setLevelChoice(value)}
                      >
                        {([1, 2, 3, 4] as const).map((each) => (
                          <PopUpButtonItem key={each} value={String(each)}>
                            {LEVEL_NAMES[each]}
                          </PopUpButtonItem>
                        ))}
                      </PopUpButton>
                    </>
                  ) : (
                    <>
                      <Label className="mac-chess-form-label">Account name:</Label>
                      <TextField
                        aria-label="Account name"
                        placeholder="martin"
                        autoComplete="off"
                        spellCheck={false}
                        value={invitedName}
                        onValueChange={(next) => setInvitedName(next)}
                      />
                    </>
                  )}
                  <Label className="mac-chess-form-label">Play as:</Label>
                  <PopUpButton
                    aria-label="Play as"
                    value={playAs}
                    onValueChange={(value) => value && setPlayAs(value)}
                  >
                    <PopUpButtonItem value="white">White</PopUpButtonItem>
                    <PopUpButtonItem value="black">Black</PopUpButtonItem>
                    {opponent === "person" ? (
                      <PopUpButtonItem value="random">Either, by chance</PopUpButtonItem>
                    ) : null}
                  </PopUpButton>
                  <Label className="mac-chess-form-label">Variant:</Label>
                  <PopUpButton
                    aria-label="Variant"
                    value={variantChoice}
                    onValueChange={(value) => value && setVariantChoice(value as ChessVariant)}
                  >
                    {CHESS_VARIANTS.map(({ id, name: variantName }) => (
                      <PopUpButtonItem key={id} value={id}>
                        {variantName}
                      </PopUpButtonItem>
                    ))}
                  </PopUpButton>
                  <Label className="mac-chess-form-label">Clock:</Label>
                  <PopUpButton
                    aria-label="Clock"
                    value={clockChoice}
                    onValueChange={(value) => value && setClockChoice(value)}
                  >
                    <PopUpButtonItem value="none">No clock</PopUpButtonItem>
                    {CLOCK_CHOICES.map((minutes) => (
                      <PopUpButtonItem key={minutes} value={String(minutes)}>
                        {minutes === 1 ? "1 minute each" : `${minutes} minutes each`}
                      </PopUpButtonItem>
                    ))}
                  </PopUpButton>
                </div>
                {sheetError ? (
                  <p role="alert" className="mac-chess-form-error">
                    {sheetError}
                  </p>
                ) : null}
                <SheetActions>
                  <SheetClose>Cancel</SheetClose>
                  <DefaultButton disabled={starting || !me} onClick={() => void start()}>
                    {opponent === "computer" ? "Start Game" : "Send Invitation"}
                  </DefaultButton>
                </SheetActions>
              </SheetPopup>
            </Sheet>
            <Sheet open={sheet === "games"} onOpenChange={(open) => !open && setSheet(null)}>
              <SheetPopup anchor={titleBar} width={520}>
                <SheetTitle>Games</SheetTitle>
                <SheetDescription>
                  Your games on this desktop, newest first, and the invitations waiting for you.
                </SheetDescription>
                <ul
                  className="mac-chess-games"
                  aria-label="Your games"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: the list takes the arrows, Delete and Select All
                  tabIndex={0}
                  onKeyDown={onGamesKeyDown}
                >
                  {(mine?.invitations ?? []).map((invite) => (
                    <li key={`i-${invite.id}`} className="mac-chess-game-row" data-invitation="">
                      <Label className="mac-chess-game-text" truncate>
                        {`${invite.opponent ?? "Someone"} invites you to play ${invite.side ? sideName(invite.side) : ""}`.trim()}
                      </Label>
                      <PushButton onClick={() => void settle(invite.id, "decline")}>
                        Decline
                      </PushButton>
                      <PushButton onClick={() => void settle(invite.id, "accept")}>
                        Accept
                      </PushButton>
                    </li>
                  ))}
                  {listedGames.map((each) => {
                    const isChosen = chosen.ids.includes(each.id);
                    const row = (
                      // biome-ignore lint/a11y/useKeyWithClickEvents: the list takes the keys for its rows
                      <li
                        className="mac-chess-game-row"
                        data-current={each.id === gameId ? "" : undefined}
                        data-chosen={isChosen ? "" : undefined}
                        aria-current={isChosen ? "true" : undefined}
                        onClick={(event) => {
                          if ((event.target as Element).closest("button")) return;
                          const add = event.metaKey || event.ctrlKey;
                          const range = event.shiftKey;
                          setChosen((now) =>
                            chosenAfter(now, listedOrder, each.id, { add, range }),
                          );
                        }}
                        onDoubleClick={(event) => {
                          if ((event.target as Element).closest("button")) return;
                          if (each.status !== "unreadable") openListed(each);
                        }}
                        onContextMenu={() => {
                          if (!isChosen) setChosen(chosenAfter(chosen, listedOrder, each.id));
                        }}
                      >
                        <Label className="mac-chess-game-text" truncate>
                          {describeSummary(each, me?.author)}
                        </Label>
                        {each.status === "unreadable" ? (
                          <PushButton
                            onClick={() => {
                              setChosen(chosenAfter(chosen, listedOrder, each.id));
                              setDeleting(true);
                            }}
                          >
                            Remove
                          </PushButton>
                        ) : (
                          <PushButton
                            aria-label={`${each.status === "over" ? "Replay" : "Open"} ${describeSummary(each, me?.author)}`}
                            onClick={() => openListed(each)}
                          >
                            {each.status === "over" ? "Replay" : "Open"}
                          </PushButton>
                        )}
                      </li>
                    );
                    return (
                      <ContextualMenu key={each.id}>
                        <ContextualMenuTrigger render={row} />
                        <ContextualMenuPopup aria-label="Game">
                          <MenuItem
                            disabled={each.status === "unreadable"}
                            onClick={() => openListed(each)}
                          >
                            {each.status === "over" ? "Replay" : "Open"}
                          </MenuItem>
                          <MenuItem
                            disabled={each.status === "unreadable"}
                            onClick={() => void exportListed(each)}
                          >
                            Export…
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem onClick={() => setDeleting(true)}>
                            {isChosen && chosen.ids.length > 1
                              ? `Delete ${chosen.ids.length} Games…`
                              : "Delete…"}
                          </MenuItem>
                        </ContextualMenuPopup>
                      </ContextualMenu>
                    );
                  })}
                  {mine && mine.games.length + mine.invitations.length === 0 ? (
                    <li className="mac-chess-game-row">
                      <Label className="mac-chess-game-text">No games yet.</Label>
                    </li>
                  ) : null}
                </ul>
                {gamesNote ? (
                  <p role="status" className="mac-chess-games-note">
                    {gamesNote}
                  </p>
                ) : null}
                {deleting && chosen.ids.length > 0 ? (
                  <SheetActions>
                    <Label className="mac-chess-games-actions">
                      {chosen.ids.length === 1
                        ? "Delete this game? This cannot be undone."
                        : `Delete ${chosen.ids.length} games? This cannot be undone.`}
                    </Label>
                    <PushButton onClick={() => setDeleting(false)}>Keep</PushButton>
                    <DefaultButton onClick={() => void deleteChosen()}>Delete</DefaultButton>
                  </SheetActions>
                ) : (
                  <SheetActions>
                    <PushButton
                      disabled={chosen.ids.length === 0}
                      onClick={() => setDeleting(true)}
                    >
                      Delete…
                    </PushButton>
                    <SheetClose render={<DefaultButton />}>Done</SheetClose>
                  </SheetActions>
                )}
              </SheetPopup>
            </Sheet>
          </>
        )}
      />
      {picking
        ? createPortal(
            <div className="mac-chess-panel-layer">
              <DriveOpenPanel
                accept={(entry) => isPgn(entry.name)}
                onOpen={(entry) => {
                  setPicking(false);
                  void openFile(entry);
                }}
                onCancel={() => setPicking(false)}
              />
            </div>,
            document.body,
          )
        : null}
      {preferences.window}
      {DesktopWindow && logOpen ? (
        <DesktopWindow
          id="game-log"
          title="Game Log"
          defaultSize={{ width: 240, height: 360 }}
          minSize={{ width: 180, height: 160 }}
          zoomButton="zoom"
          panel
          onClose={() => setLogOpen(false)}
          render={(windowProps) => (
            <ChessGameLog {...windowProps} moves={notation} at={at} onChoose={step} />
          )}
        />
      ) : null}
    </>
  );
}
