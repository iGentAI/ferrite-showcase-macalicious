import { useEffect, useRef, useState } from "react";
import { abandon, CANNOT_LISTEN, type Recognition, recognition } from "../desktop/desktop-speech";
import {
  type ChessGame,
  type ChessMove,
  type ChessPieceKind,
  type ChessPromotion,
  legalMoves,
} from "./chess-game";

/** A command that is not a move, for the window's owner to carry out. */
export type SpokenCommand = "takeBack" | "lastMove" | "hint" | "rotate" | "newGame";

export type HeardCommand =
  | { kind: "move"; from: string; to: string; promotion?: ChessPromotion }
  | { kind: "drop"; piece: ChessPieceKind; to: string }
  | { kind: "command"; command: SpokenCommand }
  | { kind: "refused"; reason: string };

/** What the status line says while Chess listens. */
export const SPEAKABLE_HINT =
  "Say a move, such as “pawn e2 to e4”, “knight to f3”, “e takes d5” or “castle kingside”, or “take back move”, “show last move”, “show hint”, “rotate board” or “new game”.";

const COMMANDS: readonly (readonly [RegExp, SpokenCommand])[] = [
  [/\b(take ?back|undo)\b/, "takeBack"],
  [/\blast move\b/, "lastMove"],
  [/\b(hint|suggest\w*)\b/, "hint"],
  [/\brotate\b/, "rotate"],
  [/\bnew game\b/, "newGame"],
];

const SPOKEN_PIECES: Readonly<Record<string, ChessPieceKind>> = {
  pawn: "pawn",
  knight: "knight",
  night: "knight",
  bishop: "bishop",
  rook: "rook",
  rock: "rook",
  queen: "queen",
  king: "king",
};

const SPOKEN_FILES: Readonly<Record<string, string>> = {
  bee: "b",
  be: "b",
  see: "c",
  sea: "c",
  dee: "d",
  gee: "g",
  aitch: "h",
};

const SPOKEN_RANKS: Readonly<Record<string, string>> = {
  one: "1",
  won: "1",
  two: "2",
  too: "2",
  to: "2",
  three: "3",
  tree: "3",
  four: "4",
  for: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  ate: "8",
};

const SQUARE_SPOKEN = new RegExp(
  `(?<![a-z])(${[...Object.keys(SPOKEN_FILES), ..."abcdefgh"].join("|")})\\s*(?:([1-8])(?![0-9])|(${Object.keys(SPOKEN_RANKS).join("|")})(?![a-z]))`,
  "g",
);

/** The words as they were said, with each spoken square written as a square. */
const squaresWritten = (words: string) =>
  words
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(
      SQUARE_SPOKEN,
      (_, file: string, digit?: string, rank?: string) =>
        ` ${SPOKEN_FILES[file] ?? file}${digit ?? SPOKEN_RANKS[rank ?? ""]} `,
    );

const distinct = (moves: readonly ChessMove[]) => [
  ...new Map(moves.map((move) => [`${move.from}${move.to}`, move])).values(),
];

/** One sentence heard, as what it asks of this game; `null` when it asks nothing Chess knows. */
export function readSpoken(words: string, game: ChessGame): HeardCommand | null {
  const said = squaresWritten(words);
  for (const [phrase, command] of COMMANDS) {
    if (phrase.test(said)) return { kind: "command", command };
  }

  const moves = legalMoves(game);
  if (/\bcastl/.test(said)) {
    const side = /\b(king|short)/.test(said)
      ? "kingside"
      : /\b(queen|long)/.test(said)
        ? "queenside"
        : null;
    const castles = moves.filter((move) => move.castle && (!side || move.castle === side));
    const only = castles.length === 1 ? castles[0] : undefined;
    if (only) return { kind: "move", from: only.from, to: only.to };
    return {
      kind: "refused",
      reason: castles.length > 1 ? "Say which way to castle." : "Castling is not legal now.",
    };
  }

  const squares = [...said.matchAll(/(?<![a-z0-9])[a-h][1-8](?![0-9])/g)].map((each) => each[0]);
  const to = squares[squares.length - 1];
  if (!to) return null;
  const from = squares.length > 1 ? squares[squares.length - 2] : undefined;

  const lastSquareAt = said.lastIndexOf(to);
  const named = (text: string) => {
    const word = /\b(pawn|knight|night|bishop|rook|rock|queen|king)\b/.exec(text)?.[1];
    return word ? SPOKEN_PIECES[word] : undefined;
  };
  const piece = named(said.slice(0, lastSquareAt));
  const after = named(said.slice(lastSquareAt + to.length));

  if (/\bdrop/.test(said)) {
    const dropped = piece ?? after;
    if (dropped && moves.some((move) => move.drop === dropped && move.to === to)) {
      return { kind: "drop", piece: dropped, to };
    }
    return { kind: "refused", reason: `That cannot be dropped on ${to}.` };
  }

  const file = /(?<![a-z0-9])([a-h])\s+(?:takes\s+)?(?=[a-h][1-8])/.exec(said)?.[1];
  const fits = distinct(
    moves.filter(
      (move) =>
        !move.drop &&
        move.to === to &&
        (from
          ? move.from === from
          : file
            ? move.from.startsWith(file)
            : move.piece.kind === (piece ?? "pawn")) &&
        (!piece || move.piece.kind === piece),
    ),
  );
  const move = fits.length === 1 ? fits[0] : undefined;
  if (move) {
    const promotion =
      after && after !== "king" && after !== "pawn" && move.promotion !== null ? after : undefined;
    return {
      kind: "move",
      from: move.from,
      to,
      ...(promotion ? { promotion } : {}),
    };
  }
  return {
    kind: "refused",
    reason:
      fits.length > 1
        ? `Which one: ${fits.map((each) => each.from).join(" or ")}?`
        : `That is not a legal move: “${words.trim()}”.`,
  };
}

/** The first thing Chess can act on among what the recognizer thinks it heard. */
export function readHeard(alternatives: readonly string[], game: ChessGame): HeardCommand | null {
  const read = alternatives.map((words) => readSpoken(words, game));
  return read.find((each) => each && each.kind !== "refused") ?? read.find(Boolean) ?? null;
}

const NO_RECOGNIZER = "This browser has no speech recognizer.";
const NO_HEARING =
  "Chess can’t hear you: the microphone or the browser’s speech service is not available.";

/**
 * Listens while `on`, through the browser's recognizer, and hands over each thing said as the
 * recognizer's guesses, best first. A recognizer ends by itself after a silence, so it is started
 * again; one that cannot hear at all is left stopped, and `trouble` says so.
 */
export function useSpokenCommands(
  on: boolean,
  onHeard: (alternatives: readonly string[]) => void,
): { listening: boolean; trouble?: string } {
  const [listening, setListening] = useState(false);
  const [trouble, setTrouble] = useState<string | undefined>(undefined);
  const latest = useRef(onHeard);
  latest.current = onHeard;

  useEffect(() => {
    if (!on) return;
    let current: Recognition | null = null;
    let again: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      const heard = recognition();
      current = heard;
      if (!heard) {
        setTrouble(NO_RECOGNIZER);
        return;
      }
      let taken = 0;
      let deaf = false;
      heard.lang = "en-US";
      heard.continuous = true;
      heard.interimResults = false;
      (heard as Recognition & { maxAlternatives: number }).maxAlternatives = 5;
      heard.onresult = ({ results }) => {
        for (; taken < results.length; taken++) {
          const result = results[taken];
          if (!result || result.isFinal === false) break;
          latest.current(Array.from(result, (each) => each.transcript));
        }
      };
      heard.onerror = ({ error }) => {
        if (!error || !CANNOT_LISTEN.has(error)) return;
        deaf = true;
        setTrouble(NO_HEARING);
        setListening(false);
      };
      heard.onend = () => {
        if (!deaf) again = setTimeout(start, 300);
      };
      try {
        heard.start();
        setListening(true);
      } catch {
        setTrouble(NO_HEARING);
      }
    };
    start();
    return () => {
      clearTimeout(again);
      if (current) abandon(current);
      setListening(false);
      setTrouble(undefined);
    };
  }, [on]);

  return { listening, trouble };
}
