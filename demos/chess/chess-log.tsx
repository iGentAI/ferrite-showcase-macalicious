"use client";

import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import { type MouseEvent, type PointerEvent, useEffect, useRef } from "react";

/** The gap between the log and the stage's edge, in points. */
const EDGE = 12;

/**
 * The Game Log window: every move of the game shown, in notation, a pair to a line. Choosing a move
 * shows the board at that move.
 */
export function ChessGameLog({
  moves,
  at,
  onChoose,
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
  /** The moves in notation, from the first. */
  moves: readonly string[];
  /** How many of them the board shows. */
  at: number;
  onChoose: (count: number) => void;
}) {
  const shown = useRef<HTMLButtonElement>(null);
  // Opened at the stage's right edge, where it covers least of the board, with the game keeping the
  // keyboard. Once per mount of the window.
  const root = useRef<HTMLDivElement>(null);
  const store = useWindowManagerStore();
  useEffect(() => {
    const host = root.current?.parentElement;
    const id = host?.getAttribute("data-window-id");
    const own = id ? store.get(id) : undefined;
    const app = store.get("chess");
    const stage = host?.closest(".mac-window-manager")?.clientWidth;
    if (!id || !own || !app || !stage) return;
    const x = Math.max(0, stage - own.frame.width - EDGE);
    store.patch(id, { frame: { ...own.frame, x, y: app.frame.y } });
  }, [store]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new position brings its move into view
  useEffect(() => {
    shown.current?.scrollIntoView?.({ block: "nearest" });
  }, [at]);
  const lines = Array.from({ length: Math.ceil(moves.length / 2) }, (_, line) => line);
  const move = (index: number) => {
    const text = moves[index];
    if (text === undefined) return <span />;
    return (
      <button
        type="button"
        ref={at === index + 1 ? shown : undefined}
        className="mac-chess-log-move"
        aria-current={at === index + 1 ? "true" : undefined}
        onClick={() => onChoose(index + 1)}
      >
        {text}
      </button>
    );
  };
  return (
    <Window ref={root} aria-label="Game Log" className="mac-chess-log" {...windowProps}>
      <TitleBar
        title="Game Log"
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
      <WindowBody className="mac-chess-log-body">
        {moves.length === 0 ? (
          <p className="mac-chess-log-empty">No moves yet.</p>
        ) : (
          <ol className="mac-chess-log-lines" aria-label="Moves">
            {lines.map((line) => (
              <li key={line} className="mac-chess-log-line">
                <span className="mac-chess-log-number">{line + 1}.</span>
                {move(line * 2)}
                {move(line * 2 + 1)}
              </li>
            ))}
          </ol>
        )}
      </WindowBody>
    </Window>
  );
}
