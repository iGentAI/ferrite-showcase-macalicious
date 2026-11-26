/*
 * The computer's search, off the page's main thread: `chess-thinker.ts` starts this worker and
 * sends it the plies of a game and a level; it replays them with `chess-game.ts` and answers
 * with the move `chess-engine.ts` chooses. A search takes up to its budget (1.5 s at the most
 * by default), during which the page, the clocks and the rest of the desktop go on answering.
 */

import { chooseMove, type EngineLevel, type EngineMove } from "./chess-engine";
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

/** One ply as the server keeps it: a move, or a claimed draw. */
export interface ThinkPly {
  from?: string;
  to?: string;
  promotion?: ChessPromotion;
  drop?: ChessPieceKind;
  draw?: boolean;
}

/** What the page asks: the game so far, and how strongly to play. */
export interface ThinkRequest {
  id: number;
  plies: readonly ThinkPly[];
  level: EngineLevel;
  budgetMs?: number;
  variant?: ChessVariant;
}

/** The answer: the move, or `null` when the game is over or its plies do not replay. */
export interface ThinkReply {
  id: number;
  move: EngineMove | null;
}

function replayed(plies: readonly ThinkPly[], variant: ChessVariant): ChessGame | null {
  let game: ChessGame | null = createGame(variant);
  for (const ply of plies) {
    if (!game) return null;
    try {
      game = ply.draw
        ? claimDraw(game)
        : ply.drop
          ? drop(game, ply.drop, ply.to ?? "")
          : play(game, ply.from ?? "", ply.to ?? "", ply.promotion);
    } catch {
      return null;
    }
  }
  return game;
}

// The worker's global scope, typed as much as this file uses of it (the project's types are the
// page's, not a worker's).
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ThinkRequest>) => void) | null;
  postMessage(reply: ThinkReply): void;
};

scope.onmessage = (event) => {
  const { id, plies, level, budgetMs, variant = "regular" } = event.data;
  const game = replayed(plies, variant);
  const move = game ? chooseMove(game, level, budgetMs === undefined ? {} : { budgetMs }) : null;
  scope.postMessage({ id, move });
};
