"use client";

import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import type { ComponentType, MouseEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import { offersSpeechRecognition } from "../desktop/desktop-speech";
import type { EngineLevel } from "./chess-engine";
import { type ChessCamera, canDrawScene, DEFAULT_CAMERA, readCamera } from "./chess-scene";
import { canSpeak, speak, spokenMove } from "./chess-speech";

/** The board's colours, by the name the Preferences give them. */
export const BOARD_STYLES = { slate: "Slate", green: "Green", blue: "Blue", sand: "Sand" } as const;
export type BoardStyle = keyof typeof BOARD_STYLES;

/** The pieces' colours, by the name the Preferences give them. */
export const PIECE_STYLES = { plain: "Black and White", warm: "Ivory and Umber" } as const;
export type PieceStyle = keyof typeof PIECE_STYLES;

/** The ways the board is drawn, by the name the Preferences give them. */
export const BOARD_VIEWS = { "3d": "3D", flat: "Flat" } as const;
export type BoardView = keyof typeof BOARD_VIEWS;

export const readBoardStyle = (stored: unknown): BoardStyle | undefined =>
  typeof stored === "string" && stored in BOARD_STYLES ? (stored as BoardStyle) : undefined;
export const readPieceStyle = (stored: unknown): PieceStyle | undefined =>
  typeof stored === "string" && stored in PIECE_STYLES ? (stored as PieceStyle) : undefined;
export const readBoardView = (stored: unknown): BoardView | undefined =>
  typeof stored === "string" && stored in BOARD_VIEWS ? (stored as BoardView) : undefined;
export const readLevel = (stored: unknown): EngineLevel | undefined =>
  stored === 1 || stored === 2 || stored === 3 || stored === 4 ? stored : undefined;

/** The computer's levels, as New Game and the Preferences name them. */
export const LEVEL_NAMES: Readonly<Record<EngineLevel, string>> = {
  1: "Level 1 (beginner)",
  2: "Level 2 (casual)",
  3: "Level 3 (club)",
  4: "Level 4 (strong)",
};

const NO_SPEECH = "This browser cannot speak: the moves are shown in the Game Log.";
const NO_SPOKEN_BOARD = "Moves are spoken in your own games, not on this board.";
const NO_COMPUTER = "This board is played by people: the computer plays in your own games.";
const NO_SIDE = "This board has no side of yours: both sides are played in this window.";
const NO_3D =
  "This browser cannot draw in 3D (no WebGL on graphics hardware): the board stays flat.";
const NO_LISTENING = "This browser has no speech recognizer: moves are made on the board.";
const LISTENING_NOTE =
  "Chess listens through the browser’s speech recognizer, which may send the sound to its vendor. It listens only while this window is in front.";

const NEVER_CHANGES = () => () => {};

/** Chess > Preferences: how the board looks, the computer's usual strength, and which way it faces. */
export function ChessPreferences({
  boardStyle,
  onBoardStyle,
  pieceStyle,
  onPieceStyle,
  level,
  levels,
  onLevel,
  sideDown,
  onSideDown,
  speakMoves,
  onSpeakMoves,
  noSpeech,
  boardView,
  onBoardView,
  no3d,
  speakCommands,
  onSpeakCommands,
  noListening,
  noComputer = false,
  noSide = false,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  ...windowProps
}: Omit<WindowProps, "children"> & {
  onClose?: WindowControlsProps["onClose"];
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
  boardStyle: BoardStyle;
  onBoardStyle: (style: BoardStyle) => void;
  pieceStyle: PieceStyle;
  onPieceStyle: (style: PieceStyle) => void;
  level: EngineLevel;
  levels: Readonly<Record<EngineLevel, string>>;
  onLevel: (level: EngineLevel) => void;
  /** Whether a game played as Black shows Black at the bottom. */
  sideDown: boolean;
  onSideDown: (on: boolean) => void;
  /** Whether each new move is said aloud. */
  speakMoves: boolean;
  onSpeakMoves: (on: boolean) => void;
  /** Why moves cannot be spoken here, which dims the checkbox. */
  noSpeech?: string;
  /** Whether the board is drawn in 3D or flat. */
  boardView: BoardView;
  onBoardView: (view: BoardView) => void;
  /** Why the board cannot be drawn in 3D here, which dims the choice. */
  no3d?: string;
  /** Whether Chess takes moves and commands by voice. */
  speakCommands: boolean;
  onSpeakCommands: (on: boolean) => void;
  /** Why Chess cannot listen here, which dims the checkbox. */
  noListening?: string;
  /** The board shown has no computer playing, so its strength is dimmed. */
  noComputer?: boolean;
  /** The board shown has no side of the person's, so which way it faces is dimmed. */
  noSide?: boolean;
}) {
  return (
    <Window aria-label="Chess Preferences" {...windowProps}>
      <TitleBar
        title="Chess Preferences"
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody className="mac-chess-preferences">
        <div className="mac-chess-form">
          <Label className="mac-chess-form-label">View:</Label>
          <PopUpButton
            aria-label="View"
            disabled={Boolean(no3d)}
            title={no3d}
            value={no3d ? "flat" : boardView}
            onValueChange={(value) => {
              const view = readBoardView(value);
              if (view) onBoardView(view);
            }}
          >
            {Object.entries(BOARD_VIEWS).map(([id, name]) => (
              <PopUpButtonItem key={id} value={id}>
                {name}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
          <Label className="mac-chess-form-label">Board:</Label>
          <PopUpButton
            aria-label="Board"
            value={boardStyle}
            onValueChange={(value) => {
              const style = readBoardStyle(value);
              if (style) onBoardStyle(style);
            }}
          >
            {Object.entries(BOARD_STYLES).map(([id, name]) => (
              <PopUpButtonItem key={id} value={id}>
                {name}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
          <Label className="mac-chess-form-label">Pieces:</Label>
          <PopUpButton
            aria-label="Pieces"
            value={pieceStyle}
            onValueChange={(value) => {
              const style = readPieceStyle(value);
              if (style) onPieceStyle(style);
            }}
          >
            {Object.entries(PIECE_STYLES).map(([id, name]) => (
              <PopUpButtonItem key={id} value={id}>
                {name}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
          <Label className="mac-chess-form-label">Computer plays at:</Label>
          <PopUpButton
            aria-label="Computer plays at"
            disabled={noComputer}
            title={noComputer ? NO_COMPUTER : undefined}
            value={String(level)}
            onValueChange={(value) => {
              const chosen = readLevel(Number(value));
              if (chosen) onLevel(chosen);
            }}
          >
            {([1, 2, 3, 4] as const).map((each) => (
              <PopUpButtonItem key={each} value={String(each)}>
                {levels[each]}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
          <span />
          <Checkbox
            checked={sideDown}
            disabled={noSide}
            title={noSide ? NO_SIDE : undefined}
            onCheckedChange={(on) => onSideDown(on)}
          >
            Show my side at the bottom
          </Checkbox>
          <span />
          <Checkbox
            checked={speakMoves && !noSpeech}
            disabled={Boolean(noSpeech)}
            title={noSpeech}
            onCheckedChange={(on) => onSpeakMoves(on)}
          >
            Speak moves
          </Checkbox>
          <span />
          <Checkbox
            checked={speakCommands && !noListening}
            disabled={Boolean(noListening)}
            title={noListening ?? LISTENING_NOTE}
            onCheckedChange={(on) => onSpeakCommands(on)}
          >
            Listen for Spoken Commands
          </Checkbox>
        </div>
      </WindowBody>
    </Window>
  );
}

let drawableHere: boolean | undefined;
const canDrawOnce = () => {
  drawableHere ??= canDrawScene();
  return drawableHere;
};

/** Says each move added to the game on the board; a game newly shown says nothing. */
export function useSpokenMoves(game: string | null, moves: readonly string[], on: boolean): void {
  const said = useRef({ game, count: moves.length });
  useEffect(() => {
    const before = said.current;
    said.current = { game, count: moves.length };
    const last = moves[moves.length - 1];
    if (on && last && before.game === game && moves.length > before.count) {
      speak(spokenMove(last));
    }
  }, [game, moves, on]);
}

/**
 * The kept preferences and the window that changes them, for each way Chess is played: `look` goes
 * on the `Chess` window, and `window` is rendered beside it.
 */
export function useChessPreferences({
  DesktopWindow,
  open = false,
  onOpenChange,
  noComputer,
  noSide,
  speaks = false,
}: {
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  noComputer?: boolean;
  noSide?: boolean;
  /** Whether this board says its moves, with `useSpokenMoves`. */
  speaks?: boolean;
}): {
  look: {
    "data-board-style"?: BoardStyle;
    "data-piece-style"?: PieceStyle;
    boardView: BoardView;
    camera: ChessCamera;
    onCameraChange: (camera: ChessCamera) => void;
    listen: boolean;
  };
  level: EngineLevel;
  setLevel: (level: EngineLevel) => void;
  sideDown: boolean;
  speakMoves: boolean;
  window: ReactNode;
} {
  const [boardStyle, setBoardStyle] = useDesktopSetting<BoardStyle>(
    "chess.boardStyle",
    readBoardStyle,
    "slate",
  );
  const [pieceStyle, setPieceStyle] = useDesktopSetting<PieceStyle>(
    "chess.pieceStyle",
    readPieceStyle,
    "plain",
  );
  const [level, setLevel] = useDesktopSetting<EngineLevel>("chess.level", readLevel, 4);
  const [sideDown, setSideDown] = useDesktopSetting("chess.sideDown", readBoolean, false);
  const [speakMoves, setSpeakMoves] = useDesktopSetting("chess.speakMoves", readBoolean, false);
  const noSpeech = !speaks ? NO_SPOKEN_BOARD : canSpeak() ? undefined : NO_SPEECH;
  const [chosenView, setBoardView] = useDesktopSetting<BoardView>(
    "chess.boardView",
    readBoardView,
    "3d",
  );
  const [camera, setCamera] = useDesktopSetting("chess.camera", readCamera, DEFAULT_CAMERA);
  const [speakCommands, setSpeakCommands] = useDesktopSetting(
    "chess.speakCommands",
    readBoolean,
    false,
  );
  const drawable = useSyncExternalStore(NEVER_CHANGES, canDrawOnce, () => false);
  const noListening = offersSpeechRecognition() ? undefined : NO_LISTENING;
  return {
    look: {
      "data-board-style": boardStyle === "slate" ? undefined : boardStyle,
      "data-piece-style": pieceStyle === "plain" ? undefined : pieceStyle,
      boardView: drawable ? chosenView : "flat",
      camera,
      onCameraChange: setCamera,
      listen: speakCommands && !noListening,
    },
    level,
    setLevel,
    sideDown,
    speakMoves,
    window:
      DesktopWindow && open ? (
        <DesktopWindow
          id="own-preferences"
          isPreferences
          title="Chess Preferences"
          defaultSize={{ width: 420, height: 270 }}
          minSize={{ width: 420, height: 270 }}
          zoomButton="zoom"
          onClose={() => onOpenChange?.(false)}
          render={(windowProps) => (
            <ChessPreferences
              {...windowProps}
              boardStyle={boardStyle}
              onBoardStyle={setBoardStyle}
              pieceStyle={pieceStyle}
              onPieceStyle={setPieceStyle}
              level={level}
              levels={LEVEL_NAMES}
              onLevel={setLevel}
              sideDown={sideDown}
              onSideDown={setSideDown}
              speakMoves={speakMoves}
              onSpeakMoves={setSpeakMoves}
              noSpeech={noSpeech}
              boardView={chosenView}
              onBoardView={setBoardView}
              no3d={drawable ? undefined : NO_3D}
              speakCommands={speakCommands}
              onSpeakCommands={setSpeakCommands}
              noListening={noListening}
              noComputer={noComputer}
              noSide={noSide}
            />
          )}
        />
      ) : null,
  };
}
