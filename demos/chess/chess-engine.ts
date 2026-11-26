/*
 * The computer opponent of the Chess demo on Ferrite: a small engine that runs in the person's
 * own browser and chooses the computer's moves in a game against it. The server only checks
 * them by the rules, as it checks every move.
 *
 * It is a plain alpha-beta search over `chess-game.ts`'s own move generator, with material and
 * piece-square values, captures searched first, and a level that sets how deep it looks and how
 * much it lets chance pick among moves of nearly equal worth:
 *
 * | level | looks ahead  | spread |
 * | 1     | one ply      | wide: often a weaker move |
 * | 2     | two plies    | a little |
 * | 3     | three plies  | none |
 * | 4     | four plies   | none |
 *
 * Each search stops by its deadline and plays the best move of the deepest search it finished,
 * so a slow device plays a little weaker rather than freezing the window.
 */

import {
  CHESS_SQUARES,
  type ChessGame,
  type ChessPieceKind,
  type ChessPosition,
  type ChessPromotion,
  type ChessSearchMove,
  deadPosition,
  gameStatus,
  losingWins,
  repetitionKey,
  searchInCheck,
  searchMoves,
  searchPlay,
  searchWon,
} from "./chess-game";
import { openingMove } from "./chess-openings";

/** A move the engine chose: squares as the board names them. */
export interface EngineMove {
  /** The square it leaves; a piece dropped from the hand leaves none. */
  from?: string;
  to: string;
  promotion?: ChessPromotion;
  drop?: ChessPieceKind;
}

/** The levels the computer plays at. */
export const ENGINE_LEVELS = [1, 2, 3, 4] as const;
export type EngineLevel = (typeof ENGINE_LEVELS)[number];

const VALUE: Readonly<Record<ChessPieceKind, number>> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0,
};

/* Piece-square bonuses from White's side, a1 first; Black reads them mirrored. */
// biome-ignore format: a table reads best as a board
const PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10,-20,-20, 10, 10,  5,
   5, -5,-10,  0,  0,-10, -5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5,  5, 10, 25, 25, 10,  5,  5,
  10, 10, 20, 30, 30, 20, 10, 10,
  50, 50, 50, 50, 50, 50, 50, 50,
   0,  0,  0,  0,  0,  0,  0,  0,
];
// biome-ignore format: a table reads best as a board
const KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];
// biome-ignore format: a table reads best as a board
const BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];
// biome-ignore format: a table reads best as a board
const KING = [
   20, 30, 10,  0,  0, 10, 30, 20,
   20, 20,  0,  0,  0,  0, 20, 20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
];
const TABLES: Partial<Record<ChessPieceKind, readonly number[]>> = {
  pawn: PAWN,
  knight: KNIGHT,
  bishop: BISHOP,
  king: KING,
};

const PHASE: Readonly<Record<ChessPieceKind, number>> = {
  pawn: 0,
  knight: 1,
  bishop: 1,
  rook: 2,
  queen: 4,
  king: 0,
};
const MATE = 1_000_000;

/**
 * The position's worth for the side to move, in hundredths of a pawn. In Losers and Suicide a
 * piece is worth what it costs to keep, so material counts against its side; in Crazyhouse a piece
 * in hand counts nearly as much as one on the board.
 */
export function evaluate(position: ChessPosition): number {
  let score = 0;
  let phase = 0;
  const kings = { white: -1, black: -1 };
  const material = { white: 0, black: 0 };
  for (let index = 0; index < 64; index++) {
    const piece = position.board[index];
    if (!piece) continue;
    const square = piece.side === "white" ? index : (7 - Math.floor(index / 8)) * 8 + (index % 8);
    if (piece.kind === "king") kings[piece.side] = index;
    else material[piece.side] += VALUE[piece.kind];
    phase += PHASE[piece.kind];
    const worth = VALUE[piece.kind] + (TABLES[piece.kind]?.[square] ?? 0);
    score += piece.side === position.turn ? worth : -worth;
  }
  if (losingWins(position)) return -score;
  if (position.variant === "regular" && phase < 24) {
    for (const side of ["white", "black"] as const) {
      const king = kings[side];
      const file = king % 8;
      const rank = Math.floor(king / 8);
      const homeBonus = KING[(side === "white" ? rank : 7 - rank) * 8 + file] ?? 0;
      const centre = 7 - Math.abs(file - 3.5) - Math.abs(rank - 3.5);
      let bonus = ((24 - phase) / 24) * (8 * centre - homeBonus);
      const other = side === "white" ? "black" : "white";
      if (material[side] === 0 && material[other] >= VALUE.rook) {
        const distance = Math.max(
          Math.abs(file - (kings[other] % 8)),
          Math.abs(rank - Math.floor(kings[other] / 8)),
        );
        // The bare king wants room and distance. The winning king wants the opposite.
        bonus += 36 * Math.min(file, 7 - file, rank, 7 - rank) + 16 * distance;
      }
      score += position.turn === side ? bonus : -bonus;
    }
  }
  for (const side of ["white", "black"] as const) {
    for (const kind of position.hands[side]) {
      score += (side === position.turn ? 1 : -1) * Math.round(VALUE[kind] * 0.8);
    }
  }
  return score;
}

/** Captures first, the most valuable victim first, then promotions: a good order for cut-offs. */
function ordered(position: ChessPosition, moves: ChessSearchMove[]): ChessSearchMove[] {
  const weight = (move: ChessSearchMove) => {
    const victim = move.taken === null ? null : position.board[move.taken];
    const mover = position.board[move.from];
    return (
      (victim ? 10 * VALUE[victim.kind] - (mover ? VALUE[mover.kind] : 0) : 0) +
      (move.promotion === "queen" ? 800 : 0)
    );
  };
  return [...moves].sort((a, b) => weight(b) - weight(a));
}

class OutOfTime extends Error {}

/** A clock that only moves forward, for the search's deadline. */
const clock = () => performance.now();

function search(
  position: ChessPosition,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  deadline: number,
  counts: Map<string, number>,
  recapture: number | null,
): number {
  // Before any work on the node, its move generation included, so a slow device never runs
  // long past the deadline.
  if (clock() > deadline) throw new OutOfTime();
  if (searchWon(position)) return MATE - ply;
  const moves = searchMoves(position);
  if (moves.length === 0) {
    if (losingWins(position)) return MATE - ply;
    return searchInCheck(position) ? -MATE + ply : 0;
  }
  if (position.variant === "regular" && (deadPosition(position) || position.halfmoveClock >= 150))
    return 0;
  // A regular position cannot repeat until four reversible half-moves have passed.
  const track = position.variant === "regular" && (depth > 0 || position.halfmoveClock >= 4);
  const key = track ? repetitionKey(position) : null;
  const previous = key ? (counts.get(key) ?? 0) : 0;
  if (previous >= 4) return 0;
  const claim = position.variant === "regular" && (previous >= 2 || position.halfmoveClock >= 100);
  let best = claim ? 0 : -Infinity;
  let candidates = moves;
  if (depth <= 0) {
    const score = Math.max(best, evaluate(position));
    // Extend an exchange through recaptures on its square. A side in check must evade
    // before it can stand pat. Keep the extension and the whole search bounded.
    if (position.variant !== "regular" || depth <= -4 || recapture === null) return score;
    if (!searchInCheck(position)) {
      best = score;
      if (best >= beta) return best;
      candidates = moves.filter((move) => move.taken === recapture);
    }
  }
  if (best >= beta) return best;
  alpha = Math.max(alpha, best);
  if (key) counts.set(key, previous + 1);
  for (const move of ordered(position, candidates)) {
    const score = -search(
      searchPlay(position, move),
      depth - 1,
      -beta,
      -alpha,
      ply + 1,
      deadline,
      counts,
      move.taken === null ? null : move.to,
    );
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  if (key) {
    if (previous) counts.set(key, previous);
    else counts.delete(key);
  }
  return best;
}

const DEPTH: Readonly<Record<EngineLevel, number>> = { 1: 1, 2: 2, 3: 3, 4: 4 };
const SPREAD: Readonly<Record<EngineLevel, number>> = { 1: 120, 2: 25, 3: 0, 4: 0 };

/**
 * The move the computer plays in `game` at `level`, or `null` when the game is over. `random`
 * (0 to 1, `Math.random` by default) picks among moves within the level's spread of the best;
 * the search gives up deepening after `budgetMs`.
 */
export function chooseMove(
  game: ChessGame,
  level: EngineLevel,
  { random = Math.random, budgetMs = 1_500 }: { random?: () => number; budgetMs?: number } = {},
): EngineMove | null {
  if (gameStatus(game).state !== "playing") return null;
  const book = openingMove(game, random);
  if (book) return book;
  const counts = new Map<string, number>();
  for (const key of game.positions) counts.set(key, (counts.get(key) ?? 0) + 1);
  const spread = level === 1 && game.variant === "regular" ? 65 : SPREAD[level];
  const moves = ordered(game, searchMoves(game));
  if (moves.length === 0) return null;
  const deadline = clock() + budgetMs;
  let scored = moves.map((move) => ({ move, score: 0 }));
  // With no spread only the best move is played: the one that first reached the best score in
  // the deepest round finished. Every other move's score there may be only a bound.
  let best = moves[0];
  for (let depth = 1; depth <= DEPTH[level]; depth++) {
    try {
      // With no spread only the best move matters, so a move that cannot beat the best so far
      // is cut off early (its score is then only a bound, never above the best).
      let floor = -Infinity;
      let leader = moves[0];
      const round = moves.map((move) => {
        if (clock() > deadline) throw new OutOfTime();
        const alpha = spread === 0 ? floor : -Infinity;
        const score = -search(
          searchPlay(game, move),
          depth - 1,
          -Infinity,
          -alpha,
          1,
          deadline,
          counts,
          move.taken === null ? null : move.to,
        );
        if (score > floor) {
          floor = score;
          leader = move;
        }
        return { move, score };
      });
      scored = round;
      best = leader;
    } catch (error) {
      if (error instanceof OutOfTime) break;
      throw error;
    }
  }
  const top = Math.max(...scored.map((each) => each.score));
  const near =
    spread === 0 && best
      ? [{ move: best, score: top }]
      : scored.filter((each) => each.score >= top - spread);
  const pick = near[Math.min(near.length - 1, Math.floor(random() * near.length))] ?? scored[0];
  if (!pick) return null;
  const { from, to, promotion, drop } = pick.move;
  return {
    ...(drop ? {} : { from: CHESS_SQUARES[from] ?? "" }),
    to: CHESS_SQUARES[to] ?? "",
    ...(promotion ? { promotion } : {}),
    ...(drop ? { drop } : {}),
  };
}
