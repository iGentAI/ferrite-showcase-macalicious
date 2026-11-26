// Reckless speaks UCI over messages in its WebAssembly worker.
import type { EngineLevel, EngineMove } from "./chess-engine";
import type { ThinkPly } from "./chess-engine.worker";
import type { ChessPromotion } from "./chess-game";

const LETTER = { knight: "n", bishop: "b", rook: "r", queen: "q" } as const;
const PROMOTION: Readonly<Record<string, ChessPromotion>> = {
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
};
const THINK_MS: Record<EngineLevel, number> = { 1: 100, 2: 200, 3: 350, 4: 500 };

export function searchReckless(
  worker: Worker,
  plies: readonly ThinkPly[],
  level: EngineLevel,
  budget: number | undefined,
  done: (move: EngineMove | null) => void,
) {
  const history: string[] = [];
  for (const ply of plies) {
    if (
      !ply.from ||
      !ply.to ||
      ply.draw ||
      ply.drop ||
      !/^[a-h][1-8]$/.test(ply.from) ||
      !/^[a-h][1-8]$/.test(ply.to)
    ) {
      done(null);
      return;
    }
    history.push(ply.from + ply.to + (ply.promotion ? LETTER[ply.promotion] : ""));
  }
  const opening = history.length < 8;
  let choices: { move: string; score: number; index: number }[] = [];
  worker.onmessage = ({ data }: MessageEvent<string>) => {
    if (opening && data.startsWith("info depth")) {
      const pv = / multipv (\d+) score (cp|mate) (-?\d+) .* pv (\S+)/.exec(data);
      if (pv) {
        if (pv[1] === "1") choices = [];
        if (pv[2] === "cp" && !/\b(?:upperbound|lowerbound)\b/.test(data)) {
          choices.push({ move: pv[4] ?? "", score: Number(pv[3]), index: Number(pv[1]) });
        }
      }
      return;
    }
    if (!data.startsWith("bestmove ")) return;
    let best = data.split(/\s+/)[1];
    const first = choices[0];
    if (first?.index === 1 && first.move === best) {
      // Vary only among opening moves the engine rates within a quarter pawn of its best.
      const close = choices.filter((choice) => choice.score >= first.score - 25);
      best = close[Math.floor(Math.random() * close.length)]?.move ?? best;
    }
    const parsed = /^([a-h][1-8])([a-h][1-8])([nbrq])?$/.exec(best ?? "");
    if (!parsed?.[1] || !parsed[2]) return done(null);
    done({
      from: parsed[1],
      to: parsed[2],
      ...(parsed[3] ? { promotion: PROMOTION[parsed[3]] } : {}),
    });
  };
  worker.postMessage(`setoption name MultiPV value ${opening ? 3 : 1}`);
  worker.postMessage(`position startpos moves ${history.join(" ")}`);
  worker.postMessage(`go movetime ${budget ?? THINK_MS[level]}`);
}
