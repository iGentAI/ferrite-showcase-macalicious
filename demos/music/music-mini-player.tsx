"use client";

import {
  MediaAppChromeBar,
  MediaAppChromeButton,
  MediaAppChromeDisplay,
  MediaAppChromeTransport,
} from "macalicious/media-app-chrome";
import { NowPlayingLcd } from "macalicious/now-playing-lcd";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { type PointerEvent, type ReactNode, useRef, useState } from "react";

/** The MiniPlayer's frame, in points. */
export const MINI_PLAYER_SIZE = { width: 480, height: 56 } as const;

export interface MiniPlayerProps extends Omit<WindowProps, "children" | "title"> {
  /** Where it opens, against its container. */
  origin: { left: number; top: number };
  title?: string;
  subtitle?: string;
  artwork?: ReactNode;
  playing: boolean;
  elapsed: number;
  duration: number;
  hasSong: boolean;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onClose: () => void;
}

/**
 * Music's MiniPlayer (Window > MiniPlayer): a small window with the transport and the
 * now-playing display, kept in front, that plays on whatever the Music window shows. It is
 * moved by its bar, outside the controls.
 */
export function MiniPlayer({
  origin,
  title,
  subtitle,
  artwork,
  playing,
  elapsed,
  duration,
  hasSong,
  onToggle,
  onPrevious,
  onNext,
  onSeek,
  onClose,
  onPointerDown: onWindowPointerDown,
  onPointerMove: onWindowPointerMove,
  onPointerUp: onWindowPointerUp,
  onPointerCancel: onWindowPointerCancel,
  style,
  ...props
}: MiniPlayerProps) {
  const [place, setPlace] = useState(origin);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  // A press on the window goes to the host's handler first (a window manager raising it), and
  // a host that cancels it (`preventDefault`) keeps the MiniPlayer from moving.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    onWindowPointerDown?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target as Element;
    if (!target.closest(".mac-music-desktop-mini")) return;
    if (target.closest("button, [data-window-no-drag], input")) return;
    drag.current = { x: event.clientX, y: event.clientY, ...place };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  // Every pointer event goes to the host's handler first, as the press does; a host that
  // cancels a move (`preventDefault`) holds the MiniPlayer where it is, and the end of a press
  // always ends the drag.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    onWindowPointerMove?.(event);
    const start = drag.current;
    if (!start || event.defaultPrevented) return;
    setPlace({
      left: start.left + event.clientX - start.x,
      top: Math.max(0, start.top + event.clientY - start.y),
    });
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    onWindowPointerUp?.(event);
    drag.current = null;
  };
  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    onWindowPointerCancel?.(event);
    drag.current = null;
  };
  return (
    <Window
      aria-label="MiniPlayer"
      width={MINI_PLAYER_SIZE.width}
      height={MINI_PLAYER_SIZE.height}
      style={{ ...style, position: "absolute", left: place.left, top: place.top }}
      {...props}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <MediaAppChromeBar aria-label="MiniPlayer controls" className="mac-music-desktop-mini">
        <MediaAppChromeTransport>
          <WindowControls onClose={onClose} minimizeDisabled zoomDisabled />
          <MediaAppChromeButton
            glyph="previous"
            aria-label="Previous"
            disabled={!hasSong}
            onClick={onPrevious}
          />
          <MediaAppChromeButton
            glyph={playing ? "pause" : "play"}
            aria-label={playing ? "Pause" : "Play"}
            disabled={!hasSong}
            onClick={onToggle}
          />
          <MediaAppChromeButton
            glyph="next"
            aria-label="Next"
            disabled={!hasSong}
            onClick={onNext}
          />
        </MediaAppChromeTransport>
        <MediaAppChromeDisplay>
          {hasSong ? (
            <NowPlayingLcd
              data-window-no-drag=""
              title={title}
              subtitle={subtitle}
              artwork={artwork}
              elapsed={elapsed}
              duration={duration}
              onSeek={onSeek}
            />
          ) : (
            <NowPlayingLcd />
          )}
        </MediaAppChromeDisplay>
      </MediaAppChromeBar>
    </Window>
  );
}
