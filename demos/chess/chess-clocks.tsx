"use client";

import { useEffect, useRef, useState } from "react";
import type { ChessSide } from "./chess-game";

/** A game's clocks as the server keeps them (`ferrite-apps/desktop/src/apps/chess/mod.rs`). */
export interface GameClock {
  white_ms: number;
  black_ms: number;
  /** When the running clock last started, epoch ms; 0 until an invitation is accepted. */
  since_ms: number;
}

/** How often the display moves, and how often a clock at zero asks the server again. */
const TICK_MS = 200;
const ASK_AGAIN_MS = 2_000;

/** The minutes New Game offers. */
export const CLOCK_CHOICES = [1, 5, 10, 30] as const;

/** What `side` has left at `now`, while `running` is the side whose clock runs (or nobody's). */
export function clockLeft(
  clock: GameClock,
  side: ChessSide,
  running: ChessSide | null,
  now: number,
): number {
  const had = side === "white" ? clock.white_ms : clock.black_ms;
  if (side !== running || clock.since_ms === 0) return had;
  return Math.max(0, had - Math.max(0, now - clock.since_ms));
}

/** Time on a clock, minutes and seconds, a second counted as soon as it starts: "4:59", "0:00". */
export function formatClock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The two clocks of a game. The server judges time; `onExpired` asks it to end the game once the
 * display shows the running clock at zero, and asks again while it stays there, as the two
 * machines' clocks may differ.
 */
export function ChessClocks({
  clock,
  running,
  whiteName,
  blackName,
  onExpired,
}: {
  clock: GameClock;
  /** The side whose clock runs, or `null` while none does. */
  running: ChessSide | null;
  whiteName: string;
  blackName: string;
  onExpired: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [running]);
  const gone =
    running !== null && clock.since_ms !== 0 && clockLeft(clock, running, running, now) === 0;
  const asked = useRef(onExpired);
  asked.current = onExpired;
  useEffect(() => {
    if (!gone) return undefined;
    asked.current();
    const timer = setInterval(() => asked.current(), ASK_AGAIN_MS);
    return () => clearInterval(timer);
  }, [gone]);
  const face = (side: ChessSide, name: string) => {
    const left = clockLeft(clock, side, running, now);
    return (
      <output
        className="mac-chess-clock"
        aria-label={`${name}'s clock`}
        data-running={side === running ? "" : undefined}
        data-low={left < 30_000 ? "" : undefined}
      >
        {formatClock(left)}
      </output>
    );
  };
  return (
    <div className="mac-chess-clocks">
      {face("white", whiteName)}
      {face("black", blackName)}
    </div>
  );
}
