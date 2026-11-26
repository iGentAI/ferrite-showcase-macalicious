import { describe, expect, it, vi } from "vitest";
import { type AccountGame, describeEnding, describeSummary, latestOnly } from "./chess-account";
import { chooseMove, evaluate } from "./chess-engine";
import type { ThinkReply, ThinkRequest } from "./chess-engine.worker";
import { type ChessGame, createGame, gameStatus, parseFen, play } from "./chess-game";
import { hintIdea } from "./chess-hint";
import { createThinker } from "./chess-thinker";

/* The computer opponent of the desktop's Ferrite application (chess-account.tsx), its worker,
   and the window's sentences. */

describe("the computer opponent", () => {
  it("plays a legal move at every level from the start", () => {
    for (const level of [1, 2, 3, 4] as const) {
      const move = chooseMove(createGame(), level, { random: () => 0.5 });
      expect(move, `level ${level}`).not.toBeNull();
      expect(play(createGame(), move?.from ?? "", move?.to ?? "", move?.promotion)).not.toBeNull();
    }
  });

  it("varies sound replies to e4 across rematches at every level", () => {
    const game = play(createGame(), "e2", "e4");
    if (!game) throw new Error("e4 must be legal");
    for (const level of [1, 2, 3, 4] as const) {
      const replies = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const move = chooseMove(game, level, { random: () => (i + 0.5) / 20 });
        replies.add(`${move?.from}${move?.to}`);
      }
      expect([...replies].sort()).toEqual(["c7c5", "c7c6", "e7e5", "e7e6"]);
    }
  });

  it.each(["Q", "R"])(
    "converts a winning king and %s ending instead of repeating",
    (piece) => {
      let game = parseFen(`8/8/8/4k3/8/8/${piece}7/4K3 w - - 0 1`);
      for (let ply = 0; ply < 80 && gameStatus(game).state === "playing"; ply++) {
        const move = chooseMove(game, 4);
        const next: ChessGame | null = move?.from ? play(game, move.from, move.to) : null;
        if (!next) throw new Error("Strong must choose a legal move");
        game = next;
      }
      expect(gameStatus(game)).toEqual({ state: "checkmate", winner: "white" });
    },
    60_000,
  );

  it("sees the pawn recapture before trading its queen for a rook at beginner level", () => {
    const game = parseFen("6k1/8/4p3/3r4/8/8/8/3Q2K1 w - - 0 1");
    for (const random of [0, 0.25, 0.5, 0.75, 0.99]) {
      const move = chooseMove(game, 1, { random: () => random });
      expect(move).not.toBeNull();
      expect(move).not.toEqual({ from: "d1", to: "d5" });
    }
  });

  it("sees the Italian defence and gives the bishop's threat as the first clue", () => {
    const game = parseFen("r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4");
    const move = chooseMove(game, 3);
    expect(move).toEqual({ from: "d7", to: "d5" });
    if (!move) throw new Error("the position is playable");
    expect(hintIdea(game, move)).toContain("bishop's diagonal to your pawn on f7");
  });

  it("gives checkmate when it can, from level 2", () => {
    // White to move: Qxf7 is mate (the scholar's mate).
    const game = parseFen("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4");
    const move = chooseMove(game, 2, { random: () => 0 });
    expect(move).toEqual({ from: "h5", to: "f7" });
    const after = play(game, "h5", "f7");
    expect(after && gameStatus(after).state).toBe("checkmate");
  });

  it("takes a queen left hanging, from level 3", () => {
    // Black's queen on d4 is defended only by a pawn: White's knight on f3 takes it.
    const game = parseFen("rnb1kbnr/pppp1ppp/8/4p3/3q4/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 3");
    expect(chooseMove(game, 3, { random: () => 0 })).toEqual({ from: "f3", to: "d4" });
    // The strongest levels never let chance pick a move whose score was only a bound.
    for (const draw of [0, 0.5, 0.99]) {
      expect(chooseMove(game, 3, { random: () => draw })).toEqual({ from: "f3", to: "d4" });
    }
  });

  it("has no move in a game that is over", () => {
    const mated = parseFen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
    expect(chooseMove(mated, 2)).toBeNull();
  });

  it("scores the starting position as even, from either side", () => {
    expect(evaluate(createGame())).toBe(0);
  });

  it("stops at its deadline, even within its first round, and still plays a legal move", () => {
    // A clock that moves 5 ms each time it is read: the deadline passes after a few reads.
    let now = 0;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => {
      now += 5;
      return now;
    });
    try {
      const game = parseFen("rnbqkbnr/pppppppp/8/8/8/7P/PPPPPPP1/RNBQKBNR b KQkq - 0 1");
      const move = chooseMove(game, 4, { random: () => 0, budgetMs: 12 });
      expect(play(game, move?.from ?? "", move?.to ?? "", move?.promotion)).not.toBeNull();
      // It gave up within its first round, long before a search four plies deep.
      expect(clock.mock.calls.length).toBeGreaterThan(1);
      expect(clock.mock.calls.length).toBeLessThan(10);
    } finally {
      clock.mockRestore();
    }
  });
});

/** A stand-in for the engine's worker: it records what it is asked and answers when told. */
class FakeWorker {
  static made: FakeWorker[] = [];
  asked: ThinkRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<ThinkReply | string>) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeWorker.made.push(this);
  }
  postMessage(request: ThinkRequest) {
    this.asked.push(request);
  }
  terminate() {
    this.terminated = true;
  }
  answer(reply: ThinkReply) {
    if (!this.terminated) this.onmessage?.({ data: reply } as MessageEvent<ThinkReply>);
  }
}

describe("the computer's search in a worker", () => {
  const make = () => new FakeWorker() as unknown as Worker;

  it("sends ordinary games to Reckless and reads a knight promotion", async () => {
    FakeWorker.made = [];
    const thinker = createThinker(make);
    const result = thinker.think([{ from: "e2", to: "e4" }], 4);
    const [worker] = FakeWorker.made as [FakeWorker];
    expect(worker.asked).toContain("position startpos moves e2e4");
    expect(worker.asked).toContain("go movetime 500");
    worker.onmessage?.(new MessageEvent("message", { data: "bestmove b2b1n" }));
    await expect(result).resolves.toEqual({ from: "b2", to: "b1", promotion: "knight" });
  });

  it("varies only exact opening scores, never an unfinished search bound", async () => {
    FakeWorker.made = [];
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    try {
      const thinker = createThinker(make);
      const result = thinker.think([{ from: "e2", to: "e4" }], 4);
      const worker = FakeWorker.made[0];
      if (!worker) throw new Error("Missing worker");
      for (const data of [
        "info depth 12 multipv 1 score cp -30 nodes 1000 pv c7c5",
        "info depth 12 multipv 2 score cp -35 nodes 1000 pv e7e5",
        "info depth 12 multipv 3 score cp 200 lowerbound nodes 1000 pv d7d5",
        "bestmove c7c5",
      ])
        worker.onmessage?.(new MessageEvent("message", { data }));
      await expect(result).resolves.toEqual({ from: "e7", to: "e5" });
      const mate = thinker.think([], 4);
      for (const data of [
        "info depth 10 multipv 1 score mate 1 nodes 1000 pv h5f7",
        "info depth 10 multipv 2 score cp 200 nodes 1000 pv h5h7",
        "bestmove h5f7",
      ])
        worker.onmessage?.(new MessageEvent("message", { data }));
      await expect(mate).resolves.toEqual({ from: "h5", to: "f7" });
      thinker.stop();
    } finally {
      random.mockRestore();
    }
  });

  it("loads on opening Chess and retains the ready engine between completed moves", async () => {
    FakeWorker.made = [];
    const thinker = createThinker(make);
    expect(FakeWorker.made).toHaveLength(0);
    thinker.prepare();
    const [worker] = FakeWorker.made;
    if (!worker) throw new Error("The opponent should preload");
    const first = thinker.think([{ from: "e2", to: "e4" }], 4);
    worker.onmessage?.(new MessageEvent("message", { data: "bestmove c7c5" }));
    await expect(first).resolves.toEqual({ from: "c7", to: "c5" });
    thinker.cancel();
    expect(worker.terminated).toBe(false);
    const next = thinker.think([], 4);
    expect(FakeWorker.made).toHaveLength(1);
    thinker.cancel();
    await expect(next).resolves.toBeUndefined();
    expect(worker.terminated).toBe(true);
    thinker.prepare();
    expect(FakeWorker.made).toHaveLength(2);
    thinker.stop();
    expect(FakeWorker.made[1]?.terminated).toBe(true);
  });

  it("answers with the worker's move for the position asked", async () => {
    FakeWorker.made = [];
    const thinker = createThinker(make);
    const move = thinker.think([{ from: "e2", to: "e4" }], 2, undefined, "crazyhouse");
    const [worker] = FakeWorker.made as [FakeWorker];
    expect(worker.asked).toEqual([
      { id: 1, plies: [{ from: "e2", to: "e4" }], level: 2, variant: "crazyhouse" },
    ]);
    worker.answer({ id: 1, move: { from: "e7", to: "e5" } });
    await expect(move).resolves.toEqual({ from: "e7", to: "e5" });
  });

  it("drops a search the game has left: its worker ends and its move never arrives", async () => {
    FakeWorker.made = [];
    const thinker = createThinker(make);
    const first = thinker.think([], 4, undefined, "crazyhouse");
    const second = thinker.think([{ from: "d2", to: "d4" }], 4, undefined, "crazyhouse");
    await expect(first).resolves.toBeUndefined();
    const [old, fresh] = FakeWorker.made as [FakeWorker, FakeWorker];
    expect(old.terminated).toBe(true);
    // A late answer of the old search is not taken for the new one.
    old.answer({ id: 1, move: { from: "e2", to: "e4" } });
    fresh.answer({ id: 1, move: { from: "a2", to: "a3" } });
    fresh.answer({ id: 2, move: { from: "d7", to: "d5" } });
    await expect(second).resolves.toEqual({ from: "d7", to: "d5" });
  });

  it("gives no answer once stopped, and no move when the worker fails", async () => {
    FakeWorker.made = [];
    const thinker = createThinker(make);
    const stopped = thinker.think([], 1);
    thinker.stop();
    await expect(stopped).resolves.toBeUndefined();
    const failing = thinker.think([], 1);
    FakeWorker.made.at(-1)?.onerror?.();
    await expect(failing).resolves.toBeNull();
  });

  it("gives no move, and leaves no worker, when one cannot be made or asked", async () => {
    const refused = createThinker(() => {
      throw new Error("refused by the page's security rules");
    });
    await expect(refused.think([], 1)).resolves.toBeNull();

    FakeWorker.made = [];
    const dead = createThinker(() => {
      const worker = new FakeWorker();
      worker.postMessage = () => {
        throw new Error("cannot be cloned");
      };
      return worker as unknown as Worker;
    });
    await expect(dead.think([], 1)).resolves.toBeNull();
    expect(FakeWorker.made.at(-1)?.terminated).toBe(true);
    // And the next search is not answered as the last one was: it starts afresh.
    const next = dead.think([], 1);
    await expect(next).resolves.toBeNull();
    expect(FakeWorker.made).toHaveLength(2);
  });
});

const base: AccountGame = {
  number: 1,
  plies: [],
  white: "a",
  black: "b",
  white_name: "Chris",
  black_name: "Martin",
};

describe("a game's ending and its line in the list", () => {
  it("names who resigned, who declined and who withdrew", () => {
    expect(
      describeEnding({ ...base, ended: { reason: "resigned", winner: "black", at_ms: 1 } }),
    ).toBe("Chris resigned. Martin wins.");
    const invite = { from: "chris", to: "martin", by: "a" };
    expect(
      describeEnding({
        ...base,
        invite: { ...invite, state: "declined" },
        ended: { reason: "declined", at_ms: 1 },
      }),
    ).toBe("martin declined the invitation.");
    expect(
      describeEnding({
        ...base,
        invite: { ...invite, state: "withdrawn" },
        ended: { reason: "withdrawn", at_ms: 1 },
      }),
    ).toBe("chris withdrew the invitation.");
    expect(describeEnding(base)).toBeUndefined();
  });

  it("says whose move it is, or how the game came out", () => {
    const line = {
      id: "g",
      opponent: "Martin",
      side: "white" as const,
      computer: null,
      invite: null,
      status: "playing" as const,
      winner: null,
      reason: null,
      plies: 4,
      turn: "white" as const,
      created_ms: 0,
    };
    expect(describeSummary(line)).toBe("Martin · your move · 4 plies");
    expect(describeSummary({ ...line, turn: "black" })).toBe("Martin · their move · 4 plies");
    expect(describeSummary({ ...line, status: "over", winner: "white" })).toBe(
      "Martin · you won · 4 plies",
    );
    expect(describeSummary({ ...line, status: "over", winner: null })).toBe(
      "Martin · drawn · 4 plies",
    );
    expect(describeSummary({ ...line, status: "over", reason: "declined" })).toBe(
      "Martin · declined",
    );
    expect(describeSummary({ id: "x", status: "unreadable" })).toBe(
      "A game the server cannot read",
    );
  });

  it("tells an invitation sent from one received, by the person's own public id", () => {
    const invited = {
      id: "g",
      opponent: "Martin Example",
      side: "white" as const,
      invite: { from: "chris", to: "martin", by: "u-chris", state: "pending" as const },
      status: "invited" as const,
      plies: 0,
    };
    expect(describeSummary(invited, "u-chris")).toBe("Martin Example · waiting for an answer");
    expect(describeSummary({ ...invited, opponent: "Chris Carter" }, "u-martin")).toBe(
      "Chris Carter · invitation",
    );
  });
});

describe("replies out of order", () => {
  it("takes only a reply newer than every reply already taken", () => {
    const gate = latestOnly();
    const older = gate.begin();
    const newer = gate.begin();
    // The newer list comes back first; the older one, arriving after, is not shown.
    expect(gate.accept(newer)).toBe(true);
    expect(gate.accept(older)).toBe(false);
    expect(gate.accept(gate.begin())).toBe(true);
  });
});
