"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChessPieceShape } from "./chess-artwork";
import { ChessScene, type ChessSceneHandle } from "./chess-board3d";
import {
  CHESS_FILES,
  CHESS_RANKS,
  CHESS_SQUARES,
  type ChessGame,
  type ChessMoveRecord,
  type ChessPieceKind,
  type ChessPromotion,
  claimDraw,
  createGame,
  describeMove,
  describeSquare,
  describeStatus,
  drawClaim,
  drop,
  gameStatus,
  gameTitle,
  isPromotion,
  legalMoves,
  pieceAt,
  play,
  squareIndex,
} from "./chess-game";
import { type ChessCamera, DEFAULT_CAMERA } from "./chess-scene";
import { readHeard, SPEAKABLE_HINT, type SpokenCommand, useSpokenCommands } from "./chess-voice";
import "./chess.tokens.css";
import "./chess.css";

export interface ChessProps extends Omit<WindowProps, "children" | "title"> {
  /**
   * The name of the player with the white pieces: the first name in the window's title.
   * @default "Player One"
   */
  white?: string;
  /**
   * The name of the player with the black pieces: the second name in the window's title.
   * Both sides are moved in this window, unless the owner holds the game (`game`) and plays one
   * side itself, as the desktop's Ferrite application does for the computer.
   * @default "Player Two"
   */
  black?: string;
  /**
   * The game the window opens with: `createGame()` for the starting position, or a position
   * read with `parseFen`. Read when the window opens; a later change is not followed. New
   * Game always starts from the starting position.
   * @default createGame()
   */
  defaultGame?: ChessGame;
  /**
   * The game, when the owner holds it: the window shows this game, and a move, New Game and
   * Claim Draw are only reported through `onMove`, `onNewGame` and `onClaimDraw`, for the owner
   * to apply. Two windows served with a server play one game this way (`chess-live.tsx`).
   * Without it the window keeps its own game, starting from `defaultGame`.
   */
  game?: ChessGame;
  /** Called after every move with the move and the game as it stands after it. */
  onMove?: (move: ChessMoveRecord, game: ChessGame) => void;
  /** Called when the New Game button starts a game. */
  onNewGame?: () => void;
  /** Called when the Claim Draw button draws the game, with the game as it stands after it. */
  onClaimDraw?: (game: ChessGame) => void;
  /**
   * Frame width: a number of points, or any CSS length. The board follows the window's size.
   * @default 971
   */
  width?: WindowProps["width"];
  /**
   * Frame height: a number of points, or any CSS length.
   * @default 702
   */
  height?: WindowProps["height"];
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /**
   * A sentence the status bar shows instead of how the game stands, such as a problem with a
   * game the window shares with another.
   */
  notice?: string;
  /**
   * Asked before a move, a claimed draw or a new game is made: a sentence saying why it is
   * refused, or `undefined` to let it happen. A refused action changes nothing, calls no
   * callback and is announced with that sentence. Two windows served with a server use it
   * while a move is on its way and on the other player's turn (`chess-live.tsx`).
   * @default every action is allowed
   */
  refuse?: (action: "move" | "draw" | "new") => string | undefined;
  /**
   * Further buttons for the bar, between how the game stands and Claim Draw: the desktop's
   * Ferrite application puts its Games, Accept, Resign and replay buttons here.
   * @default undefined
   */
  actions?: ReactNode;
  /**
   * The New Game button's title.
   * @default "New Game"
   */
  newGameLabel?: string;
  /**
   * Whether the New Game button is disabled, such as while the owner is already starting a game.
   * @default false
   */
  newGameDisabled?: boolean;
  /**
   * Called instead of starting a game when the New Game button is clicked: for an owner that
   * asks how the next game should be played (a sheet) before starting it. Without it the
   * button starts a game at once.
   * @default undefined
   */
  onNewGameRequest?: () => void;
  /**
   * Further sheets of the window, given the title bar they hang from: the owner renders each
   * `Sheet` with `SheetPopup anchor={titleBar}`.
   * @default undefined
   */
  sheets?: (titleBar: HTMLDivElement | null) => ReactNode;
  /**
   * Two squares to point out for a moment, such as the last move or a hint.
   * @default undefined
   */
  pointed?: { from?: string; to?: string } | null;
  /**
   * The items of the board's contextual menu.
   * @default undefined
   */
  boardMenu?: ReactNode;
  /** Whether the board shows Black at the bottom, as View > Rotate Board leaves it. */
  rotated?: boolean;
  /**
   * How the board is drawn: flat from above, or in perspective with turned pieces (needs WebGL).
   * Squares, moves, keys and marks are the same in both.
   * @default "flat"
   */
  boardView?: "flat" | "3d";
  /**
   * How the 3D board is seen; a drag on its frame or the backdrop moves it.
   * @default { tilt: 28, spin: 0 }
   */
  camera?: ChessCamera;
  /** Called with where a drag leaves the camera. */
  onCameraChange?: (camera: ChessCamera) => void;
  /**
   * Whether moves and commands are taken by voice, through the browser's speech recognizer, while
   * the window is the key window.
   * @default false
   */
  listen?: boolean;
  /**
   * Carries out a spoken command that is not a move. It returns a sentence saying why it cannot
   * be done now, or `undefined`. Without it only moves can be spoken.
   * @default undefined
   */
  onSpokenCommand?: (command: SpokenCommand) => string | undefined;
}

/** The buttons of the promotion sheet, in their order: the default button, the queen, is last. */
const CHOICES: readonly { kind: ChessPromotion; label: string }[] = [
  { kind: "knight", label: "Knight" },
  { kind: "bishop", label: "Bishop" },
  { kind: "rook", label: "Rook" },
];

/** The ranks as the board shows them, with White at the bottom: the eighth first. */
const RANKS_FROM_TOP = [7, 6, 5, 4, 3, 2, 1, 0] as const;

/** The arrows clockwise: on a board turned by quarters, each goes where an earlier one would. */
const ARROWS = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];

/** How far the pointer goes, in points, before a press on a piece becomes a drag. */
const DRAG_SLOP = 4;

/** How long the status line shows its answer to what was said. */
const SPOKEN_REPLY_MS = 8000;

/** "White pawn on e2": a piece and its square, to start a sentence. */
const named = (game: ChessGame, square: string) => {
  const piece = pieceAt(game, square);
  if (!piece) return square;
  return `${piece.side === "white" ? "White" : "Black"} ${piece.kind} on ${square}`;
};

/** The board inside its contextual menu, when it has one. */
function BoardMenu({ items, children }: { items: ReactNode; children: ReactNode }) {
  if (!items) return children;
  return (
    <ContextualMenu>
      <ContextualMenuTrigger className="mac-chess-board-menu">{children}</ContextualMenuTrigger>
      <ContextualMenuPopup aria-label="Board">{items}</ContextualMenuPopup>
    </ContextualMenu>
  );
}

/**
 * The Chess window of macOS 10.15: a titled window whose whole content is the board. The
 * title follows the game as the application's does.
 *
 * A piece is picked and moved with the pointer or the keyboard, by the complete rules of chess
 * (`chess-game.ts`). The board is flat, or with `boardView="3d"` in perspective with turned pieces,
 * all original shapes and none of the application's artwork. Both sides are moved here. There is
 * no computer opponent.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function Chess({
  white = "Player One",
  black = "Player Two",
  defaultGame,
  game: heldGame,
  onMove,
  onNewGame,
  onClaimDraw,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  notice,
  refuse,
  actions,
  newGameLabel = "New Game",
  newGameDisabled = false,
  onNewGameRequest,
  sheets,
  pointed,
  boardMenu,
  rotated = false,
  boardView = "flat",
  camera = DEFAULT_CAMERA,
  onCameraChange,
  listen = false,
  onSpokenCommand,
  state = "key",
  width = 971,
  height = 702,
  className,
  ...windowProps
}: ChessProps) {
  const [ownGame, setGame] = useState<ChessGame>(() => defaultGame ?? createGame());
  const game = heldGame ?? ownGame;
  const ranksShown = rotated ? [...RANKS_FROM_TOP].reverse() : RANKS_FROM_TOP;
  const filesShown = rotated ? [...CHESS_FILES].reverse() : CHESS_FILES;
  // The square of the piece that is picked up, and the one square of the board that is a tab
  // stop: the arrow keys move it.
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState("e2");
  // What assistive technology is told: the last move, or why nothing moved.
  const [announcement, setAnnouncement] = useState("");
  // The promotion sheet hangs from the title bar. `promoting` is kept while it slides away.
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [promoting, setPromoting] = useState<{ from: string; to: string } | null>(null);
  // The kind of piece picked up from the hand of the side to move, in Crazyhouse.
  const [dropping, setDropping] = useState<ChessPieceKind | null>(null);
  const [asking, setAsking] = useState(false);
  const promoted = useRef(false);
  const cursorSquare = useRef<HTMLDivElement | null>(null);
  // A press on the board, until it ends or turns out to be a drag: `lifted` is the piece in the
  // air, with where the pointer is over the grid. A drag ends in a click, which is not a move.
  const press = useRef<{ from: string; x: number; y: number; id: number } | null>(null);
  const [lifted, setLifted] = useState<{ from: string; x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const threeD = boardView === "3d";
  const scene = useRef<ChessSceneHandle | null>(null);
  const droppedOn = useRef<string | null>(null);
  // The status line's answer to what was last said, until the next move.
  const [spokenReply, setSpokenReply] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a move ends the reply
  useEffect(() => setSpokenReply(null), [game.moves.length]);
  useEffect(() => {
    if (spokenReply === null) return;
    const fading = setTimeout(() => setSpokenReply(null), SPOKEN_REPLY_MS);
    return () => clearTimeout(fading);
  }, [spokenReply]);

  const status = gameStatus(game);
  const claimable = drawClaim(game);
  const targets = dropping
    ? legalMoves(game).filter((move) => move.drop === dropping)
    : selected
      ? legalMoves(game, selected)
      : [];
  const lastMove = game.moves[game.moves.length - 1];
  const liftedPiece = lifted ? pieceAt(game, lifted.from) : null;
  // The king that is attacked, if one is: the side to move's.
  const attackedKing =
    status.state === "checkmate" || (status.state === "playing" && status.check)
      ? CHESS_SQUARES.find((square) => {
          const piece = pieceAt(game, square);
          return piece?.kind === "king" && piece.side === game.turn;
        })
      : undefined;

  /** Whether `action` may happen; when it may not, the reason is announced and the piece put down. */
  const allowed = (action: "move" | "draw" | "new") => {
    const reason = refuse?.(action);
    if (reason === undefined) return true;
    setSelected(null);
    setAnnouncement(reason);
    return false;
  };

  /** Move the piece on `from` to `to`, which is one of its moves; a pawn asks what to become. */
  const place = (from: string, to: string) => {
    if (isPromotion(game, from, to)) {
      promoted.current = false;
      setPromoting({ from, to });
      setAsking(true);
    } else commit(from, to);
  };

  const commit = (from: string, to: string, promotion?: ChessPromotion) => {
    if (!allowed("move")) return;
    const next = play(game, from, to, promotion);
    const move = next?.moves[next.moves.length - 1];
    if (!next || !move) return;
    setGame(next);
    setSelected(null);
    setCursor(to);
    setAnnouncement(`${describeMove(move)} ${describeStatus(next)}`);
    onMove?.(move, next);
  };

  /** Drop the piece picked up from the hand on `to`. */
  const commitDrop = (kind: ChessPieceKind, to: string) => {
    if (!allowed("move")) return;
    const next = drop(game, kind, to);
    const move = next?.moves[next.moves.length - 1];
    if (!next || !move) return;
    setGame(next);
    setDropping(null);
    setCursor(to);
    setAnnouncement(`${describeMove(move)} ${describeStatus(next)}`);
    onMove?.(move, next);
  };

  /** A click on a square, or Return or the space bar on it. */
  const activate = (square: string) => {
    if (status.state !== "playing") {
      setAnnouncement(`${describeStatus(game)} Choose New Game to play again.`);
      return;
    }
    if (dropping) {
      if (targets.some((move) => move.to === square)) commitDrop(dropping, square);
      else setAnnouncement(`A ${dropping} cannot be dropped on ${square}.`);
      setDropping(null);
      return;
    }
    const piece = pieceAt(game, square);
    const own = piece?.side === game.turn;
    if (selected === square) {
      setSelected(null);
      setAnnouncement(`${named(game, square)} put down.`);
    } else if (selected && targets.some((move) => move.to === square)) {
      place(selected, square);
    } else if (own) {
      const moves = [...new Set(legalMoves(game, square).map((move) => move.to))].sort();
      setSelected(square);
      setAnnouncement(
        moves.length > 0
          ? `${named(game, square)} picked up. It can move to ${moves.join(", ")}.`
          : `${named(game, square)} picked up. It has no legal move.`,
      );
    } else if (selected) {
      setAnnouncement(`${named(game, selected)} cannot move to ${square}.`);
    } else {
      const mover = game.turn === "white" ? "White" : "Black";
      setAnnouncement(piece ? `It is ${mover}'s move.` : `No piece on ${square}.`);
    }
  };

  const startNewGame = () => {
    if (!allowed("new")) return;
    setGame(createGame(game.variant));
    setSelected(null);
    setCursor("e2");
    setAnnouncement("New game. White to move.");
    onNewGame?.();
  };

  const claim = () => {
    if (!allowed("draw")) return;
    const drawn = claimDraw(game);
    if (!drawn) return;
    setGame(drawn);
    setSelected(null);
    setAnnouncement(describeStatus(drawn));
    onClaimDraw?.(drawn);
  };

  const promote = (kind: ChessPromotion) => {
    if (!promoting) return;
    promoted.current = true;
    commit(promoting.from, promoting.to, kind);
  };

  const onHeard = (alternatives: readonly string[]) => {
    const heard = readHeard(alternatives, game);
    const words = alternatives[0]?.trim() ?? "";
    const reply = (sentence: string) => {
      setSpokenReply(sentence);
      setAnnouncement(sentence);
    };
    if (!heard) return reply(`Chess did not understand “${words}”. ${SPEAKABLE_HINT}`);
    if (heard.kind === "refused") return reply(heard.reason);
    if (heard.kind === "command") {
      const refused = onSpokenCommand
        ? onSpokenCommand(heard.command)
        : "That command is not available on this board.";
      if (refused) return reply(refused);
      setSpokenReply(null);
      return;
    }
    if (status.state !== "playing") return reply(`${describeStatus(game)} Choose New Game.`);
    const refused = refuse?.("move");
    if (refused !== undefined) return reply(refused);
    setSpokenReply(null);
    if (heard.kind === "drop") return commitDrop(heard.piece, heard.to);
    if (heard.promotion) return commit(heard.from, heard.to, heard.promotion);
    place(heard.from, heard.to);
  };
  const hearing = useSpokenCommands(listen && state === "key" && !asking, onHeard);

  const onBoardPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // A second finger, or a second pointer, leaves the press under way alone.
    if (!event.isPrimary || (press.current && press.current.id !== event.pointerId)) return;
    dragged.current = false;
    const square = (event.target as HTMLElement).closest<HTMLElement>("[data-square]")?.dataset
      .square;
    press.current =
      event.button === 0 && square
        ? { from: square, x: event.clientX, y: event.clientY, id: event.pointerId }
        : null;
  };

  const onBoardPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = press.current;
    if (!start || start.id !== event.pointerId) return;
    // The button came up outside the board, where nothing heard it.
    if (event.buttons === 0) {
      press.current = null;
      return;
    }
    if (!lifted) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_SLOP) return;
      // Only a piece that may move now lifts; any other press stays what it was, a click at most.
      if (
        status.state !== "playing" ||
        pieceAt(game, start.from)?.side !== game.turn ||
        !allowed("move")
      ) {
        press.current = null;
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      dragged.current = true;
      setSelected(start.from);
    }
    if (threeD && scene.current) {
      setLifted({ from: start.from, ...scene.current.toGrid(event.clientX, event.clientY) });
      return;
    }
    const grid = event.currentTarget.getBoundingClientRect();
    setLifted({ from: start.from, x: event.clientX - grid.left, y: event.clientY - grid.top });
  };

  const onBoardPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (press.current?.id !== event.pointerId) return;
    press.current = null;
    if (!lifted) return;
    setLifted(null);
    const { from } = lifted;
    const over = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-square]")?.dataset.square;
    if (over && legalMoves(game, from).some((move) => move.to === over)) {
      droppedOn.current = over;
      place(from, over);
    } else {
      setSelected(null);
      setAnnouncement(`${named(game, from)} stays where it is.`);
    }
  };

  const onBoardPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (press.current?.id !== event.pointerId) return;
    press.current = null;
    if (!lifted) return;
    setLifted(null);
    setSelected(null);
  };

  const onBoardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    // The window is held while the promotion sheet is up. A key can still reach the board
    // before the opening sheet takes focus; Escape is then the sheet's (it cancels), and
    // must not also put the pawn down, which would leave nothing to promote.
    if (asking) return;
    const square = (event.target as HTMLElement).dataset.square;
    if (!square) return;
    const index = squareIndex(square);
    const file = index % 8;
    let to: number | undefined;
    // The arrows go as the squares stand on the screen.
    const quarters = (rotated ? 2 : 0) + (threeD ? Math.round(camera.spin / 90) : 0);
    const arrow = ARROWS.indexOf(event.key);
    const key = arrow < 0 ? event.key : ARROWS[(arrow + 4 - (quarters % 4)) % 4];
    switch (key) {
      case "ArrowUp":
        to = index < 56 ? index + 8 : undefined;
        break;
      case "ArrowDown":
        to = index > 7 ? index - 8 : undefined;
        break;
      case "ArrowLeft":
        to = file > 0 ? index - 1 : undefined;
        break;
      case "ArrowRight":
        to = file < 7 ? index + 1 : undefined;
        break;
      case "Home":
        to = index - file;
        break;
      case "End":
        to = index - file + 7;
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        activate(square);
        return;
      case "Escape":
        if (!selected) return;
        event.preventDefault();
        setSelected(null);
        setAnnouncement(`${named(game, selected)} put down.`);
        return;
      default:
        return;
    }
    // An arrow key at the edge of the board stays there, and does not scroll the page.
    event.preventDefault();
    const next = to === undefined ? undefined : CHESS_SQUARES[to];
    if (!next) return;
    setCursor(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-square="${next}"]`)?.focus();
  };

  return (
    <Window
      // While the sheet waits for an answer it is the key window, and this one is main.
      state={asking && state === "key" ? "main" : state}
      width={width}
      height={height}
      className={cn("mac-chess", className)}
      data-board-view={threeD ? "3d" : undefined}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        // Three spaces before the parenthesis, as Chess writes it; the span keeps them.
        title={
          <span className="mac-chess-title">{`${white} - ${black}   (${gameTitle(game)})`}</span>
        }
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            closeDisabled={asking}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      {/* The view is dark in Aqua and in Dark Aqua alike, as the application's is, so the
          controls on it are drawn in Dark Aqua. */}
      <div className="mac-chess-view" data-appearance="dark" inert={asking}>
        <div className="mac-chess-stage">
          <div className="mac-chess-board">
            <div className="mac-chess-ranks" aria-hidden="true">
              {ranksShown.map((rank) => (
                <span key={rank}>{CHESS_RANKS[rank]}</span>
              ))}
            </div>
            <BoardMenu items={boardMenu}>
              {/* biome-ignore lint/a11y/useSemanticElements: a grid of squares with its own keys, not a table of data */}
              <div
                role="grid"
                aria-label="Chessboard"
                className="mac-chess-squares"
                onKeyDown={onBoardKeyDown}
                onPointerDown={onBoardPointerDown}
                onPointerMove={onBoardPointerMove}
                onPointerUp={onBoardPointerUp}
                onPointerCancel={onBoardPointerCancel}
                onClickCapture={(event) => {
                  if (!dragged.current) return;
                  dragged.current = false;
                  event.stopPropagation();
                }}
                onFocus={(event) => {
                  const square = (event.target as HTMLElement).dataset.square;
                  if (square) setCursor(square);
                }}
              >
                {ranksShown.map((rank) => (
                  // biome-ignore lint/a11y/useSemanticElements: see the grid
                  // biome-ignore lint/a11y/useFocusableInteractive: the squares in the row take the focus
                  <div key={rank} role="row" className="mac-chess-rank">
                    {filesShown.map((letter) => {
                      const file = CHESS_FILES.indexOf(letter);
                      const square = `${letter}${rank + 1}`;
                      const piece = game.board[rank * 8 + file];
                      const target = targets.find((move) => move.to === square);
                      return (
                        // biome-ignore lint/a11y/useSemanticElements: see the grid
                        // biome-ignore lint/a11y/useKeyWithClickEvents: the grid handles the keys
                        <div
                          key={square}
                          ref={square === cursor ? cursorSquare : undefined}
                          role="gridcell"
                          tabIndex={square === cursor ? 0 : -1}
                          aria-label={describeSquare(game, square)}
                          aria-selected={square === selected}
                          className="mac-chess-square"
                          data-square={square}
                          data-shade={(file + rank) % 2 === 0 ? "dark" : "light"}
                          data-selected={square === selected ? "" : undefined}
                          data-target={target ? (target.captured ? "capture" : "move") : undefined}
                          data-last={
                            lastMove && (lastMove.from === square || lastMove.to === square)
                              ? ""
                              : undefined
                          }
                          data-check={square === attackedKing ? "" : undefined}
                          data-lifted={square === lifted?.from ? "" : undefined}
                          data-pointed={
                            square === pointed?.from || square === pointed?.to ? "" : undefined
                          }
                          onClick={() => activate(square)}
                        >
                          {piece && !threeD ? (
                            <ChessPieceShape kind={piece.kind} side={piece.side} />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {liftedPiece && lifted ? (
                  <div
                    className="mac-chess-lifted"
                    aria-hidden="true"
                    style={{ left: lifted.x, top: lifted.y }}
                  >
                    {threeD ? null : (
                      <ChessPieceShape kind={liftedPiece.kind} side={liftedPiece.side} />
                    )}
                  </div>
                ) : null}
              </div>
            </BoardMenu>
            <div className="mac-chess-files" aria-hidden="true">
              {filesShown.map((letter) => (
                <span key={letter}>{letter}</span>
              ))}
            </div>
          </div>
          {threeD ? (
            <ChessScene
              ref={scene}
              game={game}
              rotated={rotated}
              lifted={lifted}
              camera={camera}
              onCamera={onCameraChange}
              dropped={droppedOn}
            />
          ) : null}
        </div>
        {game.variant === "crazyhouse" ? (
          <div className="mac-chess-hands">
            {(["white", "black"] as const).map((side) => (
              // biome-ignore lint/a11y/useSemanticElements: a row of buttons, named as one
              <div
                key={side}
                role="group"
                aria-label={`${side === "white" ? "White" : "Black"}'s hand`}
                className="mac-chess-hand"
              >
                {[...new Set(game.hands[side])].map((kind) => {
                  const count = game.hands[side].filter((each) => each === kind).length;
                  return (
                    <button
                      key={kind}
                      type="button"
                      className="mac-chess-hand-piece"
                      aria-label={`Drop ${side} ${kind}, ${count} in hand`}
                      aria-pressed={side === game.turn && dropping === kind}
                      disabled={side !== game.turn || status.state !== "playing"}
                      onClick={() => {
                        setSelected(null);
                        setDropping(dropping === kind ? null : kind);
                        setAnnouncement(
                          dropping === kind
                            ? `The ${kind} is put back.`
                            : `The ${kind} is picked up. Choose an empty square.`,
                        );
                      }}
                    >
                      <ChessPieceShape kind={kind} side={side} />
                      {count > 1 ? <span>{count}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mac-chess-bar">
          <Label className="mac-chess-status" truncate>
            {hearing.trouble ?? spokenReply ?? notice ?? describeStatus(game)}
          </Label>
          {hearing.listening ? (
            <Label className="mac-chess-listening" title={SPEAKABLE_HINT}>
              Listening
            </Label>
          ) : null}
          {/* Threefold repetition and fifty moves are draws a player claims, not ones the
              game declares: the button is enabled while the side to move has a claim. */}
          {actions}
          <PushButton disabled={claimable === null} onClick={claim}>
            Claim Draw
          </PushButton>
          <PushButton
            disabled={newGameDisabled}
            onClick={() => {
              // A refused new game is refused whichever way it starts: here, or by asking first.
              if (onNewGameRequest) {
                if (allowed("new")) onNewGameRequest();
              } else {
                startNewGame();
              }
            }}
          >
            {newGameLabel}
          </PushButton>
        </div>
        <span role="status" className="mac-chess-announcement">
          {announcement}
        </span>
      </div>
      <Sheet
        open={asking}
        onOpenChange={(open) => {
          if (open) return;
          setAsking(false);
          if (!promoted.current && promoting) {
            setAnnouncement(`${named(game, promoting.from)} stays where it is.`);
          }
        }}
      >
        <SheetPopup anchor={titleBar} width={460} finalFocus={cursorSquare}>
          <SheetTitle>What should the pawn on {promoting?.to} become?</SheetTitle>
          <SheetDescription>
            A pawn that reaches the far side of the board is replaced by a queen, a rook, a bishop
            or a knight of its colour.
          </SheetDescription>
          <SheetActions leading={<SheetClose>Cancel</SheetClose>}>
            {CHOICES.map((choice) => (
              <SheetClose key={choice.kind} onClick={() => promote(choice.kind)}>
                {choice.label}
              </SheetClose>
            ))}
            <SheetClose render={<DefaultButton />} onClick={() => promote("queen")}>
              Queen
            </SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
      {sheets?.(titleBar)}
    </Window>
  );
}
