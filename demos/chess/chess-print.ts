import {
  CHESS_FILES,
  CHESS_RANKS,
  type ChessGame,
  type ChessPieceKind,
  pieceAt,
} from "./chess-game";

const GLYPHS: Readonly<Record<ChessPieceKind, string>> = {
  king: "♚",
  queen: "♛",
  rook: "♜",
  bishop: "♝",
  knight: "♞",
  pawn: "♟",
};

const escaped = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (each) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[each] as string,
  );

/** What Game > Print puts on paper. */
export interface PrintedGame {
  white: string;
  black: string;
  /** The position shown. */
  game: ChessGame;
  /** Every move, in notation, from the first. */
  moves: readonly string[];
  /** Whether Black is at the bottom, as the window shows it. */
  rotated: boolean;
}

/** The page: the players, the board as the window faces it, and the moves in pairs. Paper is white, whatever the appearance. */
export function printedPage({ white, black, game, moves, rotated }: PrintedGame): string {
  const ranks = rotated ? CHESS_RANKS : [...CHESS_RANKS].reverse();
  const files = rotated ? [...CHESS_FILES].reverse() : CHESS_FILES;
  const rows = ranks.map((rank) => {
    const cells = files.map((file) => {
      const square = `${file}${rank}`;
      const piece = pieceAt(game, square);
      const dark = (CHESS_FILES.indexOf(file) + Number(rank)) % 2 === 1;
      const shade = dark ? ' class="dark"' : "";
      if (!piece) return `<td${shade}></td>`;
      const glyph = GLYPHS[piece.kind];
      return `<td${shade} data-square="${square}"><span class="${piece.side}">${glyph}</span></td>`;
    });
    return `<tr><th>${rank}</th>${cells.join("")}</tr>`;
  });
  const labels = files.map((file) => `<th>${file}</th>`).join("");
  const lines = Array.from({ length: Math.ceil(moves.length / 2) }, (_, line) => {
    const pair = moves.slice(line * 2, line * 2 + 2).map(escaped);
    return `<li>${pair.join(" ")}</li>`;
  });
  return `<!doctype html><html><head><style>
body { font: 12pt sans-serif; color: #000; background: #fff; }
table { border-collapse: collapse; margin: 12pt 0; }
td { width: 36pt; height: 36pt; border: 0.5pt solid #000; text-align: center; font-size: 26pt; line-height: 1; }
th { font-weight: normal; font-size: 9pt; padding: 2pt 4pt; }
td.dark { background: #ccc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.white { color: #fff; -webkit-text-stroke: 0.75pt #000; }
.black { color: #000; }
ol { column-count: 3; padding-left: 24pt; }
</style></head><body><h1>${escaped(white)} v ${escaped(black)}</h1><table><tbody>${rows.join("")}<tr><th></th>${labels}</tr></tbody></table><ol>${lines.join("")}</ol></body></html>`;
}

/**
 * Prints the page through the browser's print dialog, from a frame of its own that holds it alone.
 * The frame goes when printing has ended, or when the next game is printed.
 */
export function printGame(game: PrintedGame, host: Document = document): void {
  for (const earlier of host.querySelectorAll("iframe[data-chess-print]")) earlier.remove();
  const frame = host.createElement("iframe");
  frame.setAttribute("data-chess-print", "");
  frame.setAttribute("sandbox", "allow-modals allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  frame.srcdoc = printedPage(game);
  frame.addEventListener(
    "load",
    () => {
      const view = frame.contentWindow;
      view?.addEventListener("afterprint", () => frame.remove(), { once: true });
      view?.focus();
      view?.print();
    },
    { once: true },
  );
  host.body.append(frame);
}
