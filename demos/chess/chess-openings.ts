import type { EngineMove } from "./chess-engine";
import { CHESS_START, type ChessGame } from "./chess-game";

// Each line contributes its weight to its next move while the game follows it.
const LINES = [
  [4, "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6"],
  [3, "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6"],
  [2, "e2e4 e7e5 g1f3 g8f6 f3e5 d7d6"],
  [4, "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6"],
  [2, "e2e4 e7e6 d2d4 d7d5 b1c3 g8f6"],
  [2, "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4"],
  [4, "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6"],
  [2, "d2d4 d7d5 g1f3 g8f6 c1f4 e7e6"],
  [4, "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7"],
  [2, "c2c4 e7e5 b1c3 g8f6 g1f3 b8c6"],
  [1, "g1f3 d7d5 d2d4 g8f6 c2c4 e7e6"],
] as const;

const lines = LINES.map(([weight, line]) => ({ weight, moves: line.split(" ") }));
const start = CHESS_START.split(" ").slice(0, 4).join(" ");

export function openingMove(game: ChessGame, random: () => number): EngineMove | null {
  if (game.variant !== "regular" || game.positions[0] !== start || game.moves.length >= 8)
    return null;
  const choices = lines.filter(
    ({ moves }) =>
      moves.length > game.moves.length &&
      game.moves.every((move, i) => move.from + move.to === moves[i]),
  );
  if (!choices.length) return null;
  let ticket = random() * choices.reduce((sum, line) => sum + line.weight, 0);
  for (const line of choices) {
    ticket -= line.weight;
    const move = line.moves[game.moves.length];
    if (ticket < 0 && move) return { from: move.slice(0, 2), to: move.slice(2) };
  }
  return null;
}
