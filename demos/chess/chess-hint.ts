import type { EngineMove } from "./chess-engine";
import {
  CHESS_SQUARES,
  type ChessGame,
  type ChessMove,
  drop,
  isAttacked,
  play,
  squareIndex,
} from "./chess-game";

/** What the suggested move puts between an enemy slider and one of our pieces. */
function screenedPiece(game: ChessGame, move: ChessMove): string | null {
  if (move.captured) return null;
  const to = squareIndex(move.to);
  const first = (dx: number, dy: number) => {
    let x = (to % 8) + dx;
    let y = Math.floor(to / 8) + dy;
    while (x >= 0 && x < 8 && y >= 0 && y < 8) {
      const i = 8 * y + x;
      const piece = game.board[i];
      if (piece) return { ...piece, square: CHESS_SQUARES[i] };
      x += dx;
      y += dy;
    }
    return null;
  };
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      if (!dx && !dy) continue;
      const enemy = first(dx, dy);
      const diagonal = dx !== 0 && dy !== 0;
      if (
        !enemy ||
        enemy.side === game.turn ||
        (enemy.kind !== "queen" && enemy.kind !== (diagonal ? "bishop" : "rook"))
      )
        continue;
      const ours = first(-dx, -dy);
      if (ours?.side === game.turn && ours.square !== move.from) {
        return `Can you block the ${enemy.kind}'s ${diagonal ? "diagonal" : dx ? "rank" : "file"} to your ${ours.kind} on ${ours.square}?`;
      }
    }
  }
  return null;
}

export function hintIdea(game: ChessGame, suggestion: EngineMove): string {
  const next = suggestion.drop
    ? drop(game, suggestion.drop, suggestion.to)
    : suggestion.from
      ? play(game, suggestion.from, suggestion.to, suggestion.promotion)
      : null;
  const move = next?.moves.at(-1);
  if (!next || !move) return "Which of your pieces could you improve?";
  if (move.status.state === "checkmate")
    return "There is a checkmate in one. Which check leaves the king no escape?";
  if (game.variant === "suicide" || game.variant === "losers") {
    return move.captured
      ? "You have to capture. Which capture helps you give up your remaining pieces?"
      : "Can you offer a piece your opponent will have to take?";
  }
  if (move.promotion) return "One of your pawns can promote. Which new piece would help most?";
  if (move.castle) return "Can you shelter your king and bring a rook into play in one move?";
  if (move.drop) return `Where could the ${move.drop} in your hand enter the game?`;
  if (move.captured && game.moves.at(-1)?.captured && game.moves.at(-1)?.to === move.capturedOn)
    return "Can you take back the piece that just moved?";
  if (move.captured)
    return `Look for a capture of the opposing ${move.captured.kind}. What could take back?`;
  const screen = screenedPiece(game, move);
  if (screen) return screen;
  if (move.status.state === "playing" && move.status.check)
    return "Look for a check. What replies would the king have?";
  if (isAttacked(game, move.from, next.turn) && !isAttacked(next, move.to, next.turn))
    return `Your ${move.piece.kind} is under attack. Where can it move safely?`;
  if (move.piece.kind === "king" && game.board.filter(Boolean).length <= 6)
    return "Your king can help finish this ending. Where can it take space away from the other king?";
  if (
    (move.piece.kind === "bishop" || move.piece.kind === "knight") &&
    move.from[1] === (game.turn === "white" ? "1" : "8")
  )
    return `Which square would bring your ${move.piece.kind} off the back rank?`;
  if (move.piece.kind === "pawn" && ["d4", "e4", "d5", "e5"].includes(move.to))
    return "Can one of your pawns occupy the centre?";
  return `Look at your ${move.piece.kind}'s options. What would it attack or defend from a different square?`;
}
