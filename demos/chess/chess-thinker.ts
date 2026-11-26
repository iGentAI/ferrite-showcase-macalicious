import type { EngineLevel, EngineMove } from "./chess-engine";
import type { ThinkPly, ThinkReply, ThinkRequest } from "./chess-engine.worker";
import type { ChessVariant } from "./chess-game";
import { searchReckless } from "./chess-reckless";

/*
 * The computer's thinking for the Chess window on the desktop's Ferrite application: each
 * search runs in a Web Worker, so the page never stops answering
 * while the computer looks for its move. One search runs at a time. A new one, or `stop`,
 * ends the search under way by ending its worker, and the answer it would have given is never
 * delivered: a move found for a position the game has left is dropped, not played.
 */
export interface Thinker {
  /**
   * The computer's move after `plies` at `level`; `null` when there is none (the game is over)
   * or the worker failed; `undefined` when the search was superseded or stopped, which is no
   * answer at all.
   */
  think(
    plies: readonly ThinkPly[],
    level: EngineLevel,
    budgetMs?: number,
    variant?: ChessVariant,
  ): Promise<EngineMove | null | undefined>;
  /** Load the regular opponent when the Chess window opens. */
  prepare(): void;
  /** Cancel an unfinished search, retaining an idle worker and its cache. */
  cancel(): void;
  /** End the search under way, if any, and the worker with it. */
  stop(): void;
}

/** Standard chess uses Reckless WASM. The variant worker knows the other rules. */
const makeWorker = (regular: boolean) =>
  regular
    ? new Worker(new URL("./chess-reckless.worker.ts", import.meta.url), { type: "module" })
    : new Worker(new URL("./chess-engine.worker.ts", import.meta.url), { type: "module" });

export function createThinker(make: (regular: boolean) => Worker = makeWorker): Thinker {
  let worker: Worker | null = null;
  let regularWorker = false;
  let asked = 0;
  let pending: { id: number; resolve: (move: EngineMove | null | undefined) => void } | null = null;

  const settle = (id: number, move: EngineMove | null | undefined) => {
    if (pending?.id !== id) return;
    const { resolve } = pending;
    pending = null;
    resolve(move);
  };

  const stop = () => {
    worker?.terminate();
    worker = null;
    if (pending) settle(pending.id, undefined);
  };

  const ensureWorker = (regular: boolean) => {
    if (worker) return;
    regularWorker = regular;
    const own = make(regular);
    worker = own;
    own.onmessage = (event: MessageEvent<ThinkReply | string>) => {
      if (typeof event.data !== "string") settle(event.data.id, event.data.move);
    };
    const fail = () => {
      if (worker !== own) return;
      worker = null;
      own.terminate();
      if (pending) settle(pending.id, null);
    };
    own.addEventListener?.("message", (event: MessageEvent<unknown>) => {
      if (event.data === "engineerror") fail();
    });
    own.onerror = fail;
  };

  const prepare = () => {
    if (make === makeWorker && typeof Worker === "undefined") return;
    try {
      ensureWorker(true);
    } catch {
      stop();
    }
  };
  const cancel = () => {
    if (pending) stop();
  };

  const think = (
    plies: readonly ThinkPly[],
    level: EngineLevel,
    budgetMs?: number,
    variant?: ChessVariant,
  ) => {
    // A search under way is for a position that is no longer asked about.
    const regular = (variant ?? "regular") === "regular";
    if (pending || regular !== regularWorker) stop();
    const id = ++asked;
    if (make === makeWorker && typeof Worker === "undefined") {
      // No workers here (a test's DOM without them): no move, rather than a search that would
      // hold this thread. Every browser the desktop supports has module workers.
      return Promise.resolve(null);
    }
    return new Promise<EngineMove | null | undefined>((resolve) => {
      pending = { id, resolve };
      try {
        ensureWorker(regular);
        if (!worker) throw new Error("Chess worker unavailable");
        if (regular) {
          searchReckless(worker, plies, level, budgetMs, (move) => settle(id, move));
          return;
        }
        const request: ThinkRequest = {
          id,
          plies: [...plies],
          level,
          ...(budgetMs === undefined ? {} : { budgetMs }),
          ...(variant === undefined ? {} : { variant }),
        };
        worker.postMessage(request);
      } catch {
        // A worker the page's security rules or its resources refuse, or one that cannot take the
        // request: no move, and no worker left behind for the next search to reuse.
        worker?.terminate();
        worker = null;
        settle(id, null);
      }
    });
  };

  return { think, stop, prepare, cancel };
}
