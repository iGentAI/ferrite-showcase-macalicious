/*
 * The rules of chess as pure functions over plain objects: the Chess demo's model. A game is
 * a position (the board, whose turn it is, the castling rights, the en passant square and the
 * two move counters) with the moves that led to it. Nothing here knows about React, and no
 * function changes its argument: `play` returns a new game.
 *
 * Squares are named as in algebraic notation, a file letter and a rank digit: "e2". The board
 * is an array of 64 squares in the order a1, b1, ... h1, a2, ... h8.
 *
 * A game plays one of Catalina Chess's four variants:
 * - regular chess;
 * - Crazyhouse: a piece taken joins the taker's hand, and may be dropped on an empty square
 *   instead of a move. A promoted piece that is taken goes to the hand as a pawn. A pawn is never
 *   dropped on the first or last rank.
 * - Losers: a capture must be made when one can be. The side that has lost every piece but its
 *   king, or that is checkmated or stalemated, wins.
 * - Suicide: a capture must be made when one can be, the king is a piece like the others and may
 *   be taken, there is no check and no castling. The side that has no pieces or no move wins.
 */

/** The rules a game is played by. */
export type ChessVariant = "regular" | "crazyhouse" | "losers" | "suicide";

/** The variants, as New Game names them, regular chess first. */
export const CHESS_VARIANTS: readonly { id: ChessVariant; name: string }[] = [
  { id: "regular", name: "Regular" },
  { id: "crazyhouse", name: "Crazyhouse" },
  { id: "losers", name: "Losers" },
  { id: "suicide", name: "Suicide" },
];

/** One of the two players. White moves first. */
export type ChessSide = "white" | "black";

/** The six kinds of piece. */
export type ChessPieceKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

/** What a pawn that reaches the last rank can become. */
export type ChessPromotion = "queen" | "rook" | "bishop" | "knight";

/** A piece on the board. */
export interface ChessPiece {
  /** Whose piece it is. */
  readonly side: ChessSide;
  /** What it is. */
  readonly kind: ChessPieceKind;
}

/** Which castling moves have not been ruled out by a move of the king or of a rook. */
export interface ChessCastling {
  /** White may still castle with the rook on h1. */
  readonly whiteKingside: boolean;
  /** White may still castle with the rook on a1. */
  readonly whiteQueenside: boolean;
  /** Black may still castle with the rook on h8. */
  readonly blackKingside: boolean;
  /** Black may still castle with the rook on a8. */
  readonly blackQueenside: boolean;
}

/** A move, described in full so that it can be shown and announced without the position. */
export interface ChessMove {
  /** The square the piece leaves. */
  readonly from: string;
  /** The square it arrives on. In castling these are the king's squares. */
  readonly to: string;
  /** The piece that moves, as it was before the move: a promoting pawn is a pawn. */
  readonly piece: ChessPiece;
  /** The piece taken, or `null`. */
  readonly captured: ChessPiece | null;
  /** The square the taken piece stood on: `to`, except in a capture en passant. */
  readonly capturedOn: string | null;
  /** Whether a pawn takes the pawn that has just passed it. */
  readonly enPassant: boolean;
  /** The side the king castles to, or `null` for every other move. */
  readonly castle: "kingside" | "queenside" | null;
  /** What a pawn that reaches the last rank becomes, or `null`. */
  readonly promotion: ChessPromotion | null;
  /** In Crazyhouse, the kind of piece dropped from the hand. `from` is then empty. */
  readonly drop?: ChessPieceKind;
}

/** How a game stands. */
export type ChessStatus =
  | {
      /** The side to move has a legal move. */
      readonly state: "playing";
      /** Whether its king is attacked. */
      readonly check: boolean;
    }
  | {
      /** The side to move is in check and has no legal move. */
      readonly state: "checkmate";
      /** The side that gave it. */
      readonly winner: ChessSide;
    }
  | {
      /** A Losers or Suicide game is over: the side to move has lost what it set out to lose. */
      readonly state: "won";
      readonly winner: ChessSide;
      /** Whether it has no pieces left to lose, or no move left to make. */
      readonly reason: "no-pieces" | "no-moves";
    }
  | {
      /** Nobody wins. */
      readonly state: "draw";
      /** Why. See `ChessDrawReason`. */
      readonly reason: ChessDrawReason;
    };

/**
 * Why a game is drawn. Four end it by themselves: `"stalemate"`, the side to move has no legal
 * move and is not in check; `"insufficient-material"`, a dead position that `gameStatus`
 * recognises (its comment lists which); `"seventy-five-moves"`, seventy-five moves by each side
 * without a capture or a pawn move; `"fivefold-repetition"`, the same position for the fifth
 * time. Two are draws only when the side to move claims them with `claimDraw`:
 * `"fifty-moves"`, fifty moves by each side without a capture or a pawn move, and
 * `"repetition"`, the same position for the third time.
 */
export type ChessDrawReason =
  | "stalemate"
  | "insufficient-material"
  | "seventy-five-moves"
  | "fivefold-repetition"
  | "fifty-moves"
  | "repetition";

/** A draw the side to move may claim: see `drawClaim`. */
export type ChessDrawClaim = "fifty-moves" | "repetition";

/** A move that was played, with how the game stood after it. */
export interface ChessMoveRecord extends ChessMove {
  /** The state of the game once the move was made. */
  readonly status: ChessStatus;
}

/** A game: the position on the board and how it was reached. */
export interface ChessGame {
  /** The rules it is played by. */
  readonly variant: ChessVariant;
  /** What each side may drop, in Crazyhouse: the pieces it has taken, oldest first. */
  readonly hands: ChessHands;
  /** The squares of the pieces that were promoted, which in Crazyhouse go back to a hand as pawns. */
  readonly promoted: readonly number[];
  /** The 64 squares in the order a1, b1, ... h8; `null` is an empty square. */
  readonly board: readonly (ChessPiece | null)[];
  /** The side to move. */
  readonly turn: ChessSide;
  /** The castling moves that are still possible. */
  readonly castling: ChessCastling;
  /** The square a pawn has just passed over with a double step, or `null`. */
  readonly enPassant: string | null;
  /** Half-moves since the last capture or pawn move, for the fifty-move rule. */
  readonly halfmoveClock: number;
  /** The number of the move about to be played: 1 at the start, one more after Black moves. */
  readonly fullmoveNumber: number;
  /** The moves played in this game, oldest first. */
  readonly moves: readonly ChessMoveRecord[];
  /**
   * A key for every position the game has been in, the current one last. Two keys are equal
   * when the positions are the same for the rule of repetition: the same pieces on the same
   * squares, the same side to move, the same castling rights and the same capture en passant
   * open to it. The key holds an en passant square only when such a capture is legal.
   */
  readonly positions: readonly string[];
  /** The draw the side to move claimed in this position with `claimDraw`, or `null`. */
  readonly claimed: ChessDrawClaim | null;
}

/** The pieces each side holds in hand, in Crazyhouse. */
export interface ChessHands {
  readonly white: readonly ChessPieceKind[];
  readonly black: readonly ChessPieceKind[];
}

/** What the rules need of a game: the position without its history. */
type Position = Pick<
  ChessGame,
  | "variant"
  | "hands"
  | "promoted"
  | "board"
  | "turn"
  | "castling"
  | "enPassant"
  | "halfmoveClock"
  | "fullmoveNumber"
>;

/** A move in board indices, before it is known to leave the mover's king safe. */
interface Candidate {
  /** The square it leaves; -1 for a piece dropped from the hand. */
  from: number;
  to: number;
  /** The index of the piece taken, which is not `to` in a capture en passant. */
  taken: number | null;
  castle: "kingside" | "queenside" | null;
  promotion: ChessPromotion | null;
  drop?: ChessPieceKind;
}

const FILES = "abcdefgh";

/** The eight files, from White's left. */
export const CHESS_FILES: readonly string[] = [...FILES];

/** The eight ranks, from White's side of the board. */
export const CHESS_RANKS: readonly string[] = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** The names of the 64 squares in the order of `ChessGame.board`. */
export const CHESS_SQUARES: readonly string[] = Array.from(
  { length: 64 },
  (_, index) => `${FILES.charAt(index % 8)}${Math.floor(index / 8) + 1}`,
);

/** The pieces a pawn can become, the queen first. */
export const CHESS_PROMOTIONS: readonly ChessPromotion[] = ["queen", "rook", "bishop", "knight"];

/** The position every game starts from, in Forsyth-Edwards Notation. */
export const CHESS_START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const LETTERS: Readonly<Record<string, ChessPieceKind>> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};

const KNIGHT_STEPS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;
const DIAGONALS = [
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 1],
] as const;
const STRAIGHTS = [
  [1, 0],
  [0, -1],
  [-1, 0],
  [0, 1],
] as const;
const EVERY_WAY = [...DIAGONALS, ...STRAIGHTS] as const;

const fileOf = (index: number) => index % 8;
const rankOf = (index: number) => Math.floor(index / 8);
const nameOf = (index: number) => CHESS_SQUARES[index] ?? "";
const opposite = (side: ChessSide): ChessSide => (side === "white" ? "black" : "white");
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The index in `ChessGame.board` of a square such as "e2". Throws for anything else. */
export function squareIndex(square: string): number {
  const file = square.length === 2 ? FILES.indexOf(square.charAt(0)) : -1;
  const rank = "12345678".indexOf(square.charAt(1));
  if (file < 0 || rank < 0) throw new RangeError(`Not a square of the board: "${square}"`);
  return rank * 8 + file;
}

/** The square a number of files and ranks away, or `null` when that is off the board. */
function step(from: number, files: number, ranks: number): number | null {
  const file = fileOf(from) + files;
  const rank = rankOf(from) + ranks;
  return file >= 0 && file < 8 && rank >= 0 && rank < 8 ? rank * 8 + file : null;
}

/** Whether a piece of `by` attacks the square: could take a piece standing on it. */
function attacked(board: Position["board"], target: number, by: ChessSide): boolean {
  const holds = (index: number | null, ...kinds: ChessPieceKind[]) => {
    const piece = index === null ? null : board[index];
    return !!piece && piece.side === by && kinds.includes(piece.kind);
  };
  // A pawn takes diagonally forward, so an attacking pawn stands one rank behind the target.
  const behind = by === "white" ? -1 : 1;
  if (holds(step(target, -1, behind), "pawn") || holds(step(target, 1, behind), "pawn")) {
    return true;
  }
  for (const [files, ranks] of KNIGHT_STEPS) {
    if (holds(step(target, files, ranks), "knight")) return true;
  }
  for (const [files, ranks] of EVERY_WAY) {
    if (holds(step(target, files, ranks), "king")) return true;
  }
  const along = (ways: readonly (readonly [number, number])[], ...kinds: ChessPieceKind[]) => {
    for (const [files, ranks] of ways) {
      let square = step(target, files, ranks);
      while (square !== null) {
        if (board[square]) {
          if (holds(square, ...kinds)) return true;
          break;
        }
        square = step(square, files, ranks);
      }
    }
    return false;
  };
  return along(DIAGONALS, "bishop", "queen") || along(STRAIGHTS, "rook", "queen");
}

/** Where a side's king stands, or -1 on a board without one. */
function kingOf(board: Position["board"], side: ChessSide): number {
  return board.findIndex((piece) => piece?.kind === "king" && piece.side === side);
}

/**
 * Every move the piece on `from` could make by the way it moves, whether or not the move
 * leaves its own king attacked: `legal` filters those out.
 */
function candidates(position: Position, from: number): Candidate[] {
  const { board } = position;
  const piece = board[from];
  if (!piece) return [];
  const { side } = piece;
  // In Suicide the king is a piece like the others, so it can be taken.
  const kingsTaken = position.variant === "suicide";
  const found: Candidate[] = [];
  const add = (to: number, taken: number | null, more: Partial<Candidate> = {}) => {
    found.push({ from, to, taken, castle: null, promotion: null, ...more });
  };
  // A knight and a king go one step each way; a bishop, a rook and a queen go on until they
  // meet a piece, and take it if it is the other side's.
  const travel = (ways: readonly (readonly [number, number])[], far: boolean) => {
    for (const [files, ranks] of ways) {
      let to = step(from, files, ranks);
      while (to !== null) {
        const there = board[to];
        // A king is never taken: a position given with a king left attacked does not make
        // its capture a move.
        if (there?.side === side || (there?.kind === "king" && !kingsTaken)) break;
        add(to, there ? to : null);
        if (there || !far) break;
        to = step(to, files, ranks);
      }
    }
  };

  switch (piece.kind) {
    case "knight":
      travel(KNIGHT_STEPS, false);
      break;
    case "bishop":
      travel(DIAGONALS, true);
      break;
    case "rook":
      travel(STRAIGHTS, true);
      break;
    case "queen":
      travel(EVERY_WAY, true);
      break;
    case "king": {
      travel(EVERY_WAY, false);
      // Castling: the king and that rook have not moved, nothing stands between them, and the
      // king is not in check, does not pass over an attacked square and does not land on one.
      const rank = side === "white" ? 0 : 7;
      const at = (file: number) => rank * 8 + file;
      if (from !== at(4) || kingsTaken) break;
      const enemy = opposite(side);
      const empty = (...files: number[]) => files.every((file) => !board[at(file)]);
      const safe = (...files: number[]) => files.every((file) => !attacked(board, at(file), enemy));
      const rookOn = (file: number) => {
        const rook = board[at(file)];
        return rook?.kind === "rook" && rook.side === side;
      };
      const { castling } = position;
      const kingside = side === "white" ? castling.whiteKingside : castling.blackKingside;
      const queenside = side === "white" ? castling.whiteQueenside : castling.blackQueenside;
      if (kingside && rookOn(7) && empty(5, 6) && safe(4, 5, 6)) {
        add(at(6), null, { castle: "kingside" });
      }
      if (queenside && rookOn(0) && empty(1, 2, 3) && safe(4, 3, 2)) {
        add(at(2), null, { castle: "queenside" });
      }
      break;
    }
    case "pawn": {
      const forward = side === "white" ? 1 : -1;
      const home = side === "white" ? 1 : 6;
      const last = side === "white" ? 7 : 0;
      // A pawn that arrives on the last rank is replaced: one move for each replacement.
      const arrive = (to: number, taken: number | null) => {
        if (rankOf(to) !== last) add(to, taken);
        else for (const promotion of CHESS_PROMOTIONS) add(to, taken, { promotion });
      };
      const one = step(from, 0, forward);
      if (one !== null && !board[one]) {
        arrive(one, null);
        const two = step(one, 0, forward);
        if (rankOf(from) === home && two !== null && !board[two]) arrive(two, null);
      }
      // En passant is open only to a pawn on its fifth rank, beside the pawn that passed.
      const fifth = side === "white" ? 4 : 3;
      const passed =
        position.enPassant === null || rankOf(from) !== fifth
          ? null
          : squareIndex(position.enPassant);
      for (const files of [-1, 1]) {
        const to = step(from, files, forward);
        if (to === null) continue;
        const there = board[to];
        if (there) {
          if (there.side !== side && (there.kind !== "king" || kingsTaken)) arrive(to, to);
        } else if (to === passed) {
          // En passant: the pawn that passed stands beside this one, behind the empty square.
          const beside = step(to, 0, -forward);
          const pawn = beside === null ? null : board[beside];
          if (pawn?.kind === "pawn" && pawn.side !== side) arrive(to, beside);
        }
      }
      break;
    }
  }
  return found;
}

/** The position after a move, which is taken to be one of `candidates`. */
function apply(position: Position, move: Candidate): Position {
  if (move.drop) return applyDrop(position, move, move.drop);
  const board = [...position.board];
  const piece = board[move.from] as ChessPiece;
  const { side } = piece;
  const taken = move.taken === null ? null : (board[move.taken] ?? null);
  board[move.from] = null;
  if (move.taken !== null) board[move.taken] = null;
  board[move.to] = move.promotion ? { side, kind: move.promotion } : piece;
  if (move.castle) {
    // The rook jumps over the king: from h to f, or from a to d.
    const rank = rankOf(move.from) * 8;
    const [corner, beside] = move.castle === "kingside" ? [7, 5] : [0, 3];
    board[rank + beside] = board[rank + corner] ?? null;
    board[rank + corner] = null;
  }

  // A right to castle goes when the king moves, when its rook moves and when its rook is
  // taken: the last two are a move from or to that rook's corner.
  const touches = (square: number) => move.from === square || move.to === square;
  const king = piece.kind === "king";
  const castling: ChessCastling = {
    whiteKingside: position.castling.whiteKingside && !(king && side === "white") && !touches(7),
    whiteQueenside: position.castling.whiteQueenside && !(king && side === "white") && !touches(0),
    blackKingside: position.castling.blackKingside && !(king && side === "black") && !touches(63),
    blackQueenside: position.castling.blackQueenside && !(king && side === "black") && !touches(56),
  };

  const pawn = piece.kind === "pawn";
  const doubleStep = pawn && Math.abs(move.to - move.from) === 16;
  // A counter that has reached the largest number that can be counted with stays there: a
  // position played on from one given at that number is still one `toFen` can write and
  // `parseFen` can read.
  const count = (next: number) => Math.min(next, Number.MAX_SAFE_INTEGER);
  const house = position.variant === "crazyhouse";
  const wasPromoted = move.taken !== null && position.promoted.includes(move.taken);
  return {
    variant: position.variant,
    hands:
      house && taken
        ? {
            ...position.hands,
            [side]: [...position.hands[side], wasPromoted ? "pawn" : taken.kind],
          }
        : position.hands,
    promoted: house
      ? [
          ...position.promoted.filter((square) => square !== move.taken && square !== move.from),
          ...(move.promotion || position.promoted.includes(move.from) ? [move.to] : []),
        ]
      : position.promoted,
    board,
    turn: opposite(side),
    castling,
    enPassant: doubleStep ? nameOf((move.from + move.to) / 2) : null,
    halfmoveClock: pawn || move.taken !== null ? 0 : count(position.halfmoveClock + 1),
    fullmoveNumber: count(position.fullmoveNumber + (side === "black" ? 1 : 0)),
  };
}

/** The position after a piece is dropped from the hand of the side to move. */
function applyDrop(position: Position, move: Candidate, kind: ChessPieceKind): Position {
  const side = position.turn;
  const board = [...position.board];
  board[move.to] = { side, kind };
  const hand = [...position.hands[side]];
  hand.splice(hand.indexOf(kind), 1);
  return {
    ...position,
    hands: { ...position.hands, [side]: hand },
    board,
    turn: opposite(side),
    enPassant: null,
    halfmoveClock:
      kind === "pawn" ? 0 : Math.min(position.halfmoveClock + 1, Number.MAX_SAFE_INTEGER),
    fullmoveNumber: Math.min(
      position.fullmoveNumber + (side === "black" ? 1 : 0),
      Number.MAX_SAFE_INTEGER,
    ),
  };
}

/** Whether a capture must be made when one can be. */
const capturesCompulsory = (position: Position) =>
  position.variant === "losers" || position.variant === "suicide";

/** The pieces the side to move may drop, each with every empty square it may go on. */
function dropMoves(position: Position): Candidate[] {
  if (position.variant !== "crazyhouse") return [];
  const kinds = [...new Set(position.hands[position.turn])];
  const found: Candidate[] = [];
  for (const drop of kinds) {
    for (let to = 0; to < 64; to++) {
      if (position.board[to] || (drop === "pawn" && (rankOf(to) === 0 || rankOf(to) === 7))) {
        continue;
      }
      found.push({ from: -1, to, taken: null, castle: null, promotion: null, drop });
    }
  }
  return found;
}

/**
 * The moves the side to move may make, from one square or from all: none leaves its king attacked,
 * except in Suicide, which has no check. Where captures are compulsory, the moves of a piece that
 * takes nothing are not among them while any piece of its side can take. Drops come with the
 * moves of all squares only.
 */
function legal(position: Position, only?: number): Candidate[] {
  if (capturesCompulsory(position)) {
    const all = boardMoves(position);
    const captures = all.filter((move) => move.taken !== null);
    const allowed = captures.length > 0 ? captures : all;
    return only === undefined ? allowed : allowed.filter((move) => move.from === only);
  }
  const found = boardMoves(position, only);
  return only === undefined ? [...found, ...safeDrops(position)] : found;
}

function safeDrops(position: Position): Candidate[] {
  return dropMoves(position).filter((move) => {
    const next = apply(position, move);
    const king = kingOf(next.board, position.turn);
    return king < 0 || !attacked(next.board, king, next.turn);
  });
}

/** The moves of the pieces on the board, before captures are made compulsory. */
function boardMoves(position: Position, only?: number): Candidate[] {
  const { board, turn } = position;
  const found: Candidate[] = [];
  const noCheck = position.variant === "suicide";
  for (let from = only ?? 0; from < (only === undefined ? 64 : only + 1); from++) {
    if (board[from]?.side !== turn) continue;
    for (const move of candidates(position, from)) {
      if (noCheck) {
        found.push(move);
        continue;
      }
      const next = apply(position, move);
      const king = kingOf(next.board, turn);
      if (king < 0 || !attacked(next.board, king, next.turn)) found.push(move);
    }
  }
  return found;
}

/**
 * A position without its history: what a search (`chess-engine.ts`) looks at. `ChessGame` is
 * one, with its moves and repetitions besides.
 */
export type ChessPosition = Position;

/** A legal move in board indices, as a search walks them: see `searchMoves`. */
export interface ChessSearchMove {
  readonly from: number;
  readonly to: number;
  /** The index of the piece taken, which is not `to` in a capture en passant, or `null`. */
  readonly taken: number | null;
  readonly promotion: ChessPromotion | null;
  readonly drop?: ChessPieceKind;
}

/**
 * For a search: the legal moves of the side to move, without the bookkeeping `legalMoves` and
 * `play` do for a game (descriptions, statuses, repetitions), which a search of thousands of
 * positions cannot afford.
 */
export function searchMoves(position: ChessPosition): ChessSearchMove[] {
  return legal(position);
}

/** For a search: the position after one of `searchMoves`. */
export function searchPlay(position: ChessPosition, move: ChessSearchMove): ChessPosition {
  return apply(position, { castle: null, ...move } as Candidate);
}

/** For a search: whether the side to move is in check. */
export function searchInCheck(position: ChessPosition): boolean {
  if (position.variant === "suicide") return false;
  const king = kingOf(position.board, position.turn);
  return king >= 0 && attacked(position.board, king, opposite(position.turn));
}

/** For a search: whether having nothing left to play with, or no move, is winning. */
export const losingWins = capturesCompulsory;

/** Whether the side to move has lost everything it set out to lose: Losers and Suicide only. */
function nothingLeft(position: Position): boolean {
  const left = position.board.filter((piece) => piece?.side === position.turn);
  if (position.variant === "suicide") return left.length === 0;
  return position.variant === "losers" && left.every((piece) => piece?.kind === "king");
}

/** For a search: whether the side to move has won by what it has lost. */
export const searchWon = nothingLeft;

function describe(position: Position, move: Candidate): ChessMove {
  if (move.drop) {
    return {
      from: "",
      to: nameOf(move.to),
      piece: { side: position.turn, kind: move.drop },
      captured: null,
      capturedOn: null,
      enPassant: false,
      castle: null,
      promotion: null,
      drop: move.drop,
    };
  }
  const captured = move.taken === null ? null : (position.board[move.taken] ?? null);
  return {
    from: nameOf(move.from),
    to: nameOf(move.to),
    piece: position.board[move.from] as ChessPiece,
    captured,
    capturedOn: move.taken === null ? null : nameOf(move.taken),
    enPassant: move.taken !== null && move.taken !== move.to,
    castle: move.castle,
    promotion: move.promotion,
  };
}

/** The board's field of a Forsyth-Edwards position, with `~` after each square of `marked`. */
function placementOf(position: Position, marked: readonly number[] = []): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const index = rank * 8 + file;
      const piece = position.board[index];
      if (!piece) {
        empty++;
        continue;
      }
      const letter = piece.kind === "knight" ? "n" : piece.kind.charAt(0);
      row += (empty || "") + (piece.side === "white" ? letter.toUpperCase() : letter);
      if (marked.includes(index)) row += "~";
      empty = 0;
    }
    rows.push(row + (empty || ""));
  }
  return rows.join("/");
}

/** A side's hand as letters, in order. */
const handLetters = (position: Position, side: ChessSide) =>
  position.hands[side]
    .map((kind) => (kind === "knight" ? "n" : kind.charAt(0)))
    .sort()
    .join("");

/**
 * The first four fields of a position's Forsyth-Edwards Notation, with the en passant square
 * it is given: the position's own, or the one that counts for a repetition.
 */
function positionKey(position: Position, enPassant: string | null = position.enPassant): string {
  const { castling } = position;
  const rights =
    (castling.whiteKingside ? "K" : "") +
    (castling.whiteQueenside ? "Q" : "") +
    (castling.blackKingside ? "k" : "") +
    (castling.blackQueenside ? "q" : "");
  const held =
    position.variant === "crazyhouse"
      ? ` ${handLetters(position, "white").toUpperCase()}/${handLetters(position, "black")} ${[
          ...position.promoted,
        ]
          .sort((a, b) => a - b)
          .join(",")}`
      : "";
  return `${placementOf(position)} ${position.turn.charAt(0)} ${rights || "-"} ${enPassant ?? "-"}${held}`;
}

/**
 * What a repetition repeats: the position's key with its en passant square only when the
 * side to move can really take en passant there. A pawn's double step leaves a square behind
 * it in every case, but two positions differ by it only if the capture is a legal move: not
 * when no pawn stands beside the one that passed, and not when the pawn that does is pinned.
 */
export function repetitionKey(position: Position): string {
  const open =
    position.enPassant !== null &&
    legal(position).some((move) => move.taken !== null && move.taken !== move.to);
  return positionKey(position, open ? position.enPassant : null);
}

/**
 * Whether neither side has the pieces to give checkmate: the kings alone, a king and one
 * bishop or knight against a king, or kings with bishops that all stand on squares of one
 * colour.
 */
function insufficientMaterial(board: Position["board"]): boolean {
  const others: number[] = [];
  for (let index = 0; index < 64; index++) {
    const kind = board[index]?.kind;
    if (kind && kind !== "king") {
      if (kind !== "bishop" && kind !== "knight") return false;
      others.push(index);
    }
  }
  if (others.length <= 1) return true;
  const shade = (index: number) => (fileOf(index) + rankOf(index)) % 2;
  return others.every(
    (index) => board[index]?.kind === "bishop" && shade(index) === shade(others[0] ?? 0),
  );
}

/**
 * Whether the pawns lock the board for good: only kings and pawns stand on it; every pawn is
 * blocked by a pawn of the other side straight in front of it; no pawn can take now; and
 * neither king can ever reach a pawn it could take. A king may never step onto a square a
 * pawn of the other side attacks, the pawns never move, and so nothing on the board can ever
 * change but where the kings stand: no capture, no promotion and no check is possible, and
 * the position is dead. Each king's reach is found by walking from it over the squares it may
 * enter (not its own pawns, not a square an enemy pawn attacks); the other king is ignored,
 * which can only make the reach larger, so a position is never called dead wrongly.
 */
function pawnLocked(position: Position): boolean {
  const { board } = position;
  let pawns = 0;
  for (let index = 0; index < 64; index++) {
    const piece = board[index];
    if (!piece || piece.kind === "king") continue;
    if (piece.kind !== "pawn") return false;
    pawns++;
    const ahead = step(index, 0, piece.side === "white" ? 1 : -1);
    const blocker = ahead === null ? null : board[ahead];
    if (blocker?.kind !== "pawn" || blocker.side === piece.side) return false;
  }
  if (pawns === 0) return false;
  // No capture now: en passant included.
  if (legal(position).some((move) => move.taken !== null)) return false;
  if (
    legal({ ...position, turn: opposite(position.turn), enPassant: null }).some(
      (move) => move.taken !== null,
    )
  ) {
    return false;
  }
  const pawnAttacks = (target: number, by: ChessSide) => {
    const behind = by === "white" ? -1 : 1;
    return [step(target, -1, behind), step(target, 1, behind)].some((index) => {
      const piece = index === null ? null : board[index];
      return piece?.kind === "pawn" && piece.side === by;
    });
  };
  for (const side of ["white", "black"] as const) {
    const start = kingOf(board, side);
    if (start < 0) return false;
    const enemy = opposite(side);
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      const from = queue.pop() as number;
      for (const [files, ranks] of EVERY_WAY) {
        const to = step(from, files, ranks);
        if (to === null || seen.has(to)) continue;
        const there = board[to];
        if (there?.kind === "pawn" && there.side === side) continue;
        if (pawnAttacks(to, enemy)) continue;
        // An enemy pawn the king could take: something can still change.
        if (there?.kind === "pawn") return false;
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return true;
}

/**
 * The dead positions `gameStatus` recognises: those of `insufficientMaterial` and those of
 * `pawnLocked`. Other dead positions exist (a bishop shut in behind locked pawns, for one) and
 * are not recognised; such a game goes on until a rule that counts ends it.
 */
export function deadPosition(position: Position): boolean {
  // A piece in hand, or a king that can be taken or that wants to be, can still change the game.
  if (position.variant !== "regular") return false;
  return insufficientMaterial(position.board) || pawnLocked(position);
}

/**
 * Reads a position in Forsyth-Edwards Notation, the usual way to write one down:
 * `"4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"`. Only the first field, the pieces, is required; the
 * others default to White to move, no castling, no en passant square, and move 1. Throws a
 * `SyntaxError` for text that is not a position, for more than six fields, for a board
 * without exactly one king of each side, for an en passant square on a rank the side to move
 * cannot take on (the sixth for White, the third for Black), or for a move counter too large
 * to count with.
 *
 * `variant` is the game the position belongs to, which the notation does not say. Crazyhouse
 * positions are written as usual for that game: the hands in brackets after the board, white's in
 * capitals (`.../RNBQKBNR[Pn] w ...`), and `~` after a promoted piece. Suicide needs no kings,
 * since they can be taken, and has no castling, whatever the rights say.
 */
export function parseFen(fen: string, variant: ChessVariant = "regular"): ChessGame {
  const fields = fen.trim().split(/\s+/);
  const [written = "", turn = "w", rights = "-", passed = "-", half = "0", full = "1"] = fields;
  const wrong = (what: string) => new SyntaxError(`Not a chess position (${what}): "${fen}"`);
  if (fields.length > 6) throw wrong("at most six fields");
  const house = variant === "crazyhouse";
  const [, placement = written, held = ""] =
    (house && written.match(/^([^[]*)\[([A-Za-z]*)\]$/)) || [];
  const hands: Record<ChessSide, ChessPieceKind[]> = { white: [], black: [] };
  for (const letter of held) {
    const kind = LETTERS[letter.toLowerCase()];
    if (!kind || kind === "king") throw wrong("the pieces in hand");
    hands[letter === letter.toLowerCase() ? "black" : "white"].push(kind);
  }
  const promoted: number[] = [];
  const rows = placement.split("/");
  if (rows.length !== 8) throw wrong("the board needs eight ranks");
  const board: (ChessPiece | null)[] = Array.from({ length: 64 }, () => null);
  rows.forEach((row, fromTop) => {
    let file = 0;
    for (const letter of row) {
      if (/[1-8]/.test(letter)) {
        file += Number(letter);
        continue;
      }
      if (letter === "~") {
        const square = (7 - fromTop) * 8 + file - 1;
        if (!house || file === 0 || !board[square]) throw wrong(`rank ${8 - fromTop}`);
        promoted.push(square);
        continue;
      }
      const kind = LETTERS[letter.toLowerCase()];
      if (!kind || file > 7) throw wrong(`rank ${8 - fromTop}`);
      board[(7 - fromTop) * 8 + file] = {
        side: letter === letter.toLowerCase() ? "black" : "white",
        kind,
      };
      file++;
    }
    if (file !== 8) throw wrong(`rank ${8 - fromTop}`);
  });
  for (const side of ["white", "black"] as const) {
    const kings = board.filter((piece) => piece?.kind === "king" && piece.side === side);
    if (variant !== "suicide" && kings.length !== 1) throw wrong(`one ${side} king`);
  }
  if (turn !== "w" && turn !== "b") throw wrong("the side to move");
  if (!/^(-|K?Q?k?q?)$/.test(rights) || rights === "") throw wrong("the castling rights");
  if (!/^(-|[a-h][36])$/.test(passed)) throw wrong("the en passant square");
  // A double step leaves its square on the third rank for White's pawn, which Black may take,
  // and on the sixth for Black's, which White may take.
  if (passed !== "-" && passed.charAt(1) !== (turn === "w" ? "6" : "3")) {
    throw wrong("the en passant square");
  }
  if (!/^\d+$/.test(half) || !/^[1-9]\d*$/.test(full)) throw wrong("the move counters");
  // A counter of too many digits is not a number that can be counted on: it would read as
  // infinity or lose its last digits, and could not be written back.
  if (!Number.isSafeInteger(Number(half)) || !Number.isSafeInteger(Number(full))) {
    throw wrong("the move counters");
  }
  const position: Position = {
    variant,
    hands,
    promoted,
    board,
    turn: turn === "w" ? "white" : "black",
    castling: {
      whiteKingside: variant !== "suicide" && rights.includes("K"),
      whiteQueenside: variant !== "suicide" && rights.includes("Q"),
      blackKingside: variant !== "suicide" && rights.includes("k"),
      blackQueenside: variant !== "suicide" && rights.includes("q"),
    },
    enPassant: passed === "-" ? null : passed,
    halfmoveClock: Number(half),
    fullmoveNumber: Number(full),
  };
  return { ...position, moves: [], positions: [repetitionKey(position)], claimed: null };
}

/**
 * The position of a game in Forsyth-Edwards Notation. `parseFen`, told the game's variant, reads it
 * back.
 */
export function toFen(game: ChessGame): string {
  const house = game.variant === "crazyhouse";
  const hands = house
    ? `[${handLetters(game, "white").toUpperCase()}${handLetters(game, "black")}]`
    : "";
  const rest = positionKey({ ...game, variant: "regular" })
    .split(" ")
    .slice(1)
    .join(" ");
  return `${placementOf(game, house ? game.promoted : [])}${hands} ${rest} ${game.halfmoveClock} ${game.fullmoveNumber}`;
}

/** A new game: the pieces on their starting squares, White to move. */
export function createGame(variant: ChessVariant = "regular"): ChessGame {
  return parseFen(CHESS_START, variant);
}

/** The piece on a square, or `null`. */
export function pieceAt(game: ChessGame, square: string): ChessPiece | null {
  return game.board[squareIndex(square)] ?? null;
}

/** Whether a piece of `by` attacks the square. */
export function isAttacked(game: ChessGame, square: string, by: ChessSide): boolean {
  return attacked(game.board, squareIndex(square), by);
}

/** Whether a side's king is attacked; the side to move, unless another is named. */
export function isInCheck(game: ChessGame, side: ChessSide = game.turn): boolean {
  if (game.variant === "suicide") return false;
  const king = kingOf(game.board, side);
  return king >= 0 && attacked(game.board, king, opposite(side));
}

/**
 * The legal moves of the side to move: from one square when `from` is given, else from every
 * square. A move that would leave the mover's own king in check is not among them. A pawn
 * that reaches the last rank has four moves to the same square, one for each piece it can
 * become. A game that is drawn by a rule still lists the moves the pieces could make; `play`
 * refuses them.
 */
export function legalMoves(game: ChessGame, from?: string): ChessMove[] {
  const only = from === undefined ? undefined : squareIndex(from);
  return legal(game, only).map((move) => describe(game, move));
}

/** Whether moving from one square to another is a legal move that promotes a pawn. */
export function isPromotion(game: ChessGame, from: string, to: string): boolean {
  const target = squareIndex(to);
  return legal(game, squareIndex(from)).some(
    (move) => move.to === target && move.promotion !== null,
  );
}

/** How many times the game has been in its current position, this time included. */
function occurrences(game: ChessGame): number {
  const now = game.positions[game.positions.length - 1];
  return game.positions.filter((key) => key === now).length;
}

/**
 * How the game stands: still being played (and whether the side to move is in check), won by
 * checkmate, or drawn. Four draws end the game by themselves: stalemate; a dead position of
 * the kinds `deadPosition` recognises, which are the kings with at most one bishop or knight,
 * kings with bishops all on squares of one colour, and a board locked by pawns that no king can
 * ever take (see `pawnLocked`); seventy-five moves by each side without a capture or a pawn
 * move; and the fifth occurrence of a position. Fifty such moves and the third occurrence of a
 * position end the game only when the side to move claims the draw with `claimDraw`.
 */
export function gameStatus(game: ChessGame): ChessStatus {
  if (nothingLeft(game)) return { state: "won", winner: game.turn, reason: "no-pieces" };
  const check = isInCheck(game);
  if (legal(game).length === 0) {
    if (capturesCompulsory(game)) return { state: "won", winner: game.turn, reason: "no-moves" };
    return check
      ? { state: "checkmate", winner: opposite(game.turn) }
      : { state: "draw", reason: "stalemate" };
  }
  if (deadPosition(game)) return { state: "draw", reason: "insufficient-material" };
  if (game.halfmoveClock >= 150) return { state: "draw", reason: "seventy-five-moves" };
  if (occurrences(game) >= 5) return { state: "draw", reason: "fivefold-repetition" };
  if (game.claimed) return { state: "draw", reason: game.claimed };
  return { state: "playing", check };
}

/**
 * The draw the side to move may claim now, or `null`: `"repetition"` when the position stands
 * for the third time (or more), `"fifty-moves"` when fifty moves by each side have passed
 * without a capture or a pawn move. Only a game still being played has a claim. A claim is
 * made in the position itself, for either rule: claiming on a move that would bring the
 * repetition about, or that would complete the fifty moves (FIDE Laws 9.2.1 and 9.3.1, where a
 * player names the intended move to the arbiter), is not offered. Making that move does not
 * give the mover the claim either: the position it leaves is the other player's to claim in.
 */
export function drawClaim(game: ChessGame): ChessDrawClaim | null {
  if (gameStatus(game).state !== "playing") return null;
  if (occurrences(game) >= 3) return "repetition";
  if (game.halfmoveClock >= 100) return "fifty-moves";
  return null;
}

/**
 * Claims the draw `drawClaim` names and returns the game drawn, or `null` when the side to
 * move has no claim. The game is not changed otherwise: the moves and the position stay.
 */
export function claimDraw(game: ChessGame): ChessGame | null {
  const claim = drawClaim(game);
  return claim ? { ...game, claimed: claim } : null;
}

/**
 * Plays a move and returns the game after it, or `null` when the move is not legal: no piece
 * of the side to move stands on `from`, the piece does not move that way, the move would
 * leave the mover's king in check, or the game is over. `promotion` is read only when a pawn
 * reaches the last rank.
 */
export function play(
  game: ChessGame,
  from: string,
  to: string,
  promotion: ChessPromotion = "queen",
): ChessGame | null {
  if (gameStatus(game).state !== "playing") return null;
  const target = squareIndex(to);
  const moves = legal(game, squareIndex(from)).filter((move) => move.to === target);
  const move =
    moves.find((each) => each.promotion === null) ??
    moves.find((each) => each.promotion === promotion);
  if (!move) return null;
  const position = apply(game, move);
  return afterMove(game, move, position);
}

/**
 * Drops a piece from the hand of the side to move and returns the game after it, or `null` when
 * the drop is not legal: not Crazyhouse, the piece is not in hand, the square is taken, a pawn on
 * the first or last rank, a king left in check, or the game is over.
 */
export function drop(game: ChessGame, kind: ChessPieceKind, to: string): ChessGame | null {
  if (gameStatus(game).state !== "playing") return null;
  const target = squareIndex(to);
  const move = legal(game).find((each) => each.drop === kind && each.to === target);
  return move ? afterMove(game, move, apply(game, move)) : null;
}

function afterMove(game: ChessGame, move: Candidate, position: Position): ChessGame {
  const after: ChessGame = {
    ...position,
    moves: game.moves,
    positions: [...game.positions, repetitionKey(position)],
    claimed: null,
  };
  return {
    ...after,
    moves: [...game.moves, { ...describe(game, move), status: gameStatus(after) }],
  };
}

/**
 * The game's state as Chess writes it in the title of its window, between the parentheses:
 * "New Game" until a move is made, then "White to Move" or "Black to Move", and at the end
 * "White wins", "Black wins" or "Draw".
 */
export function gameTitle(game: ChessGame): string {
  const status = gameStatus(game);
  if (status.state === "checkmate" || status.state === "won") {
    return `${capitalize(status.winner)} wins`;
  }
  if (status.state === "draw") return "Draw";
  if (game.moves.length === 0) return "New Game";
  return `${capitalize(game.turn)} to Move`;
}

/** How the game stands, as a sentence: "Check. Black to move.", "Checkmate. White wins." */
export function describeStatus(game: ChessGame): string {
  const status = gameStatus(game);
  if (status.state === "checkmate") return `Checkmate. ${capitalize(status.winner)} wins.`;
  if (status.state === "won") {
    return status.reason === "no-pieces"
      ? `${capitalize(status.winner)} has lost all it could and wins.`
      : `${capitalize(status.winner)} has no move left and wins.`;
  }
  if (status.state === "draw") {
    switch (status.reason) {
      case "stalemate":
        return `Stalemate: ${capitalize(game.turn)} has no legal move. The game is a draw.`;
      case "insufficient-material":
        return "Neither side can give checkmate. The game is a draw.";
      case "seventy-five-moves":
        return "Seventy-five moves without a capture or a pawn move. The game is a draw.";
      case "fivefold-repetition":
        return "The same position for the fifth time. The game is a draw.";
      case "fifty-moves":
        return `${capitalize(game.turn)} claimed a draw: fifty moves without a capture or a pawn move.`;
      case "repetition":
        return `${capitalize(game.turn)} claimed a draw: the same position for the third time.`;
    }
  }
  const claim = drawClaim(game);
  const may = claim ? ` ${capitalize(game.turn)} may claim a draw.` : "";
  return `${status.check ? "Check. " : ""}${capitalize(game.turn)} to move.${may}`;
}

/** A move in words: "White pawn e2 to e4.", "Black knight f6 takes white pawn on e4." */
export function describeMove(move: ChessMove): string {
  const mover = capitalize(move.piece.side);
  if (move.drop) return `${mover} drops a ${move.drop} on ${move.to}.`;
  if (move.castle) return `${mover} castles ${move.castle}.`;
  let text = `${mover} ${move.piece.kind} ${move.from} `;
  text += move.captured
    ? `takes ${move.captured.side} ${move.captured.kind} on ${move.capturedOn}`
    : `to ${move.to}`;
  if (move.enPassant) text += ` en passant, and stands on ${move.to}`;
  if (move.promotion) text += ` and becomes a ${move.promotion}`;
  return `${text}.`;
}

/** A square with what stands on it, as its name for assistive technology: "e2, white pawn". */
export function describeSquare(game: ChessGame, square: string): string {
  const piece = pieceAt(game, square);
  return piece ? `${square}, ${piece.side} ${piece.kind}` : square;
}
