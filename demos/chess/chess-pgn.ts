import {
  CHESS_VARIANTS,
  type ChessGame,
  type ChessMove,
  type ChessPieceKind,
  type ChessPromotion,
  type ChessSide,
  type ChessVariant,
  createGame,
  drop,
  gameStatus,
  isInCheck,
  legalMoves,
  play,
} from "./chess-game";

/*
 * Portable Game Notation, the text format Chess saves and opens: a game's players and result, and
 * its moves in standard algebraic notation. The rules of `chess-game.ts` read and write it, so a
 * game opened from a file holds only legal moves.
 */

const PIECE_LETTER = { king: "K", queen: "Q", rook: "R", bishop: "B", knight: "N" } as const;
const DROP_LETTER: Readonly<Record<ChessPieceKind, string>> = { ...PIECE_LETTER, pawn: "P" };
const LETTER_PROMOTION: Readonly<Record<string, ChessPromotion>> = {
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
};
/** The longest file Open reads. */
export const MAX_PGN_BYTES = 1_000_000;

/** One move of a game, as `play` takes it, or a piece dropped (with an empty `from`). */
export interface PgnMove {
  from: string;
  to: string;
  promotion?: ChessPromotion;
  drop?: ChessPieceKind;
}

/** `move`, legal in `game`, in standard algebraic notation: "e4", "Nbd7", "exd8=Q+", "O-O#", "N@f3". */
export function moveInNotation(game: ChessGame, move: ChessMove): string {
  let text: string;
  if (move.drop) {
    text = `${DROP_LETTER[move.drop]}@${move.to}`;
  } else if (move.castle) {
    text = move.castle === "kingside" ? "O-O" : "O-O-O";
  } else if (move.piece.kind === "pawn") {
    text = `${move.captured ? `${move.from[0]}x` : ""}${move.to}`;
    if (move.promotion) text += `=${PIECE_LETTER[move.promotion]}`;
  } else {
    const rivals = legalMoves(game).filter(
      (each) =>
        each.to === move.to &&
        each.piece.kind === move.piece.kind &&
        each.from !== move.from &&
        !each.drop,
    );
    let from = "";
    if (rivals.length > 0) {
      if (rivals.every((each) => each.from[0] !== move.from[0])) from = move.from[0] ?? "";
      else if (rivals.every((each) => each.from[1] !== move.from[1])) from = move.from[1] ?? "";
      else from = move.from;
    }
    text = `${PIECE_LETTER[move.piece.kind]}${from}${move.captured ? "x" : ""}${move.to}`;
  }
  const after = move.drop
    ? drop(game, move.drop, move.to)
    : play(game, move.from, move.to, move.promotion ?? undefined);
  if (after && gameStatus(after).state === "checkmate") return `${text}#`;
  return after && isInCheck(after) ? `${text}+` : text;
}

/** The moves of a game, each in notation, from the start. Stops at a move the rules refuse. */
export function notationOf(moves: readonly PgnMove[], variant: ChessVariant = "regular"): string[] {
  let game = createGame(variant);
  const written: string[] = [];
  for (const { from, to, promotion, drop: dropped } of moves) {
    const move = dropped
      ? legalMoves(game).find((each) => each.drop === dropped && each.to === to)
      : legalMoves(game, from).find(
          (each) =>
            each.to === to &&
            (each.promotion === null || each.promotion === (promotion ?? "queen")),
        );
    const next = move && (dropped ? drop(game, dropped, to) : play(game, from, to, promotion));
    if (!move || !next) break;
    written.push(moveInNotation(game, move));
    game = next;
  }
  return written;
}

/** A tag's value as PGN writes it. */
const quoted = (text: string) => text.replace(/[\\"]/g, "\\$&").replace(/[\r\n]+/g, " ");

/** A game as a PGN file. */
export function writePgn(game: {
  white: string;
  black: string;
  moves: readonly PgnMove[];
  result: string;
  date: Date;
  variant?: ChessVariant;
}): string {
  const day = game.date.toISOString().slice(0, 10).replaceAll("-", ".");
  const variant = game.variant ?? "regular";
  const tags = [
    ["Event", "Casual Game"],
    ["Site", "Chess"],
    ["Date", day],
    ["Round", "-"],
    ["White", game.white],
    ["Black", game.black],
    ["Result", game.result],
    ...(variant === "regular"
      ? []
      : [["Variant", CHESS_VARIANTS.find(({ id }) => id === variant)?.name]]),
  ].map(([name, value]) => `[${name} "${quoted(value ?? "")}"]`);
  const tokens = notationOf(game.moves, variant).map((san, at) =>
    at % 2 === 0 ? `${at / 2 + 1}. ${san}` : san,
  );
  const lines: string[] = [];
  let line = "";
  for (const token of [...tokens, game.result]) {
    if (line && line.length + token.length + 1 > 79) {
      lines.push(line);
      line = token;
    } else line = line ? `${line} ${token}` : token;
  }
  lines.push(line);
  return `${tags.join("\n")}\n\n${lines.join("\n")}\n`;
}

/** The result of a game for its PGN tag: who won, a draw, or `*` while it is unfinished. */
export function pgnResult(game: ChessGame, winner?: ChessSide): string {
  const status = gameStatus(game);
  const won = status.state === "checkmate" || status.state === "won" ? status.winner : winner;
  if (won) return won === "white" ? "1-0" : "0-1";
  return status.state === "draw" ? "1/2-1/2" : "*";
}

const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);

/**
 * The first game of a PGN file, as PGN's lexical elements: its tags, and the moves of its main line
 * with the result that ends them. Comments, variations (however nested), annotation glyphs and move
 * numbers may touch a move or each other, and are not moves. A tag after the moves began is the next
 * game's, which ends this one.
 */
function firstGame(text: string) {
  const tags = new Map<string, string>();
  const tokens: string[] = [];
  let ending: string | undefined;
  let depth = 0;
  let began = false;
  const tagAt = /\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]/y;
  const symbolAt = /[^\s{}();$[\]]+/y;
  const lineEnd = (from: number) => {
    const end = text.indexOf("\n", from);
    return end < 0 ? text.length : end;
  };
  for (let at = 0; at < text.length && ending === undefined; ) {
    const char = text[at] ?? "";
    if (/\s/.test(char)) at += 1;
    else if (char === "{") {
      const end = text.indexOf("}", at);
      at = end < 0 ? text.length : end + 1;
    } else if (char === ";" || (char === "%" && (at === 0 || text[at - 1] === "\n"))) {
      at = lineEnd(at);
    } else if (char === "(") {
      depth += 1;
      at += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
      at += 1;
    } else if (depth > 0) at += 1;
    else if (char === "[") {
      if (began) break;
      tagAt.lastIndex = at;
      const found = tagAt.exec(text);
      if (found) {
        tags.set(found[1] ?? "", (found[2] ?? "").replace(/\\(.)/g, "$1"));
        at += found[0].length;
      } else at += 1;
    } else if (char === "$") {
      at += 1;
      while (/\d/.test(text[at] ?? "")) at += 1;
    } else {
      symbolAt.lastIndex = at;
      const symbol = symbolAt.exec(text)?.[0];
      if (!symbol) {
        at += 1;
        continue;
      }
      at += symbol.length;
      began = true;
      if (RESULTS.has(symbol)) {
        ending = symbol;
        continue;
      }
      const move = symbol.replace(/^\d+\.+/, "").replace(/^\.+/, "");
      if (move !== "" && !/^\d+$/.test(move)) tokens.push(move);
    }
  }
  return { tags, tokens, ending };
}

const bare = (san: string) => san.replace(/[+#!?]+$/g, "").replace(/0/g, "O");

/**
 * The first game of a PGN file, or why it cannot be read. Only a game from the standard starting
 * position is read: a `FEN` tag names another, which `play` could not replay on a server's game.
 */
export function readPgn(text: string):
  | {
      white?: string;
      black?: string;
      moves: PgnMove[];
      result: string;
      variant?: ChessVariant;
    }
  | { problem: string } {
  const { tags, tokens, ending } = firstGame(text);
  if (tags.has("FEN") || tags.get("SetUp") === "1") {
    return { problem: "This game starts from a set-up position, which Chess cannot open." };
  }
  const named = tags.get("Variant");
  const variant = named
    ? CHESS_VARIANTS.find(({ name }) => name.toLowerCase() === named.toLowerCase())?.id
    : "regular";
  if (!variant) return { problem: `Chess does not play the variant “${named?.slice(0, 40)}”.` };
  const moves: PgnMove[] = [];
  let game = createGame(variant);
  for (const token of tokens) {
    const wanted = bare(token);
    const promotion = LETTER_PROMOTION[/=([QRBN])$/.exec(wanted)?.[1] ?? ""];
    const move = legalMoves(game).find((each) => bare(moveInNotation(game, each)) === wanted);
    const next =
      move &&
      (move.drop ? drop(game, move.drop, move.to) : play(game, move.from, move.to, promotion));
    if (!move || !next) {
      const number = Math.floor(moves.length / 2) + 1;
      return { problem: `Move ${number} (“${token.slice(0, 20)}”) is not a legal move here.` };
    }
    moves.push({
      from: move.from,
      to: move.to,
      ...(promotion ? { promotion } : {}),
      ...(move.drop ? { drop: move.drop } : {}),
    });
    game = next;
  }
  if (moves.length === 0) return { problem: "This file holds no moves." };
  const stated = tags.get("Result");
  return {
    white: tags.get("White"),
    black: tags.get("Black"),
    moves,
    ...(variant === "regular" ? {} : { variant }),
    result: ending ?? (stated && RESULTS.has(stated) ? stated : "*"),
  };
}

/** A name safe to save a file under, its extension kept however long the players' names are. */
export const pgnFileName = (white: string, black: string) =>
  `${`${white} vs ${black}`
    .replace(/[/\\:\p{Cc}]/gu, " ")
    .slice(0, 120)
    .trim()}.pgn`;

export const isPgn = (name: string) => /\.pgn$/i.test(name);
