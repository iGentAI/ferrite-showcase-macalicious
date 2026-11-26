import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const assets = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../demos/chess/vendor/reckless",
);
const model = Buffer.concat(
  readdirSync(assets)
    .filter((s) => /^network-\d+\.gz$/.test(s))
    // By part number: network-10 comes after network-9, not after network-1.
    .sort((a, b) => Number.parseInt(a.slice(8), 10) - Number.parseInt(b.slice(8), 10))
    .map((s) => gunzipSync(readFileSync(resolve(assets, s)))),
);
const module = await WebAssembly.compile(readFileSync(resolve(assets, "reckless.wasm")));
// Recorded from unmodified native Reckless 0.9.0 at depth 10 with the same model.
// Exact node counts detect numerical or move-generation changes in the WASM port.
const positions = [
  ["startpos", "e2e4", "cp 47", 21673],
  ["startpos moves e2e4", "c7c5", "cp -52", 34897],
  ["startpos moves e2e4 e7e5 g1f3 b8c6 f1c4 g8f6", "f3g5", "cp 30", 30888],
  ["fen r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4", "h5f7", "mate 1", 434],
  ["fen rnb1kbnr/pppp1ppp/8/4p3/3q4/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 3", "f3d4", "cp 532", 43506],
  [
    "fen r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    "d5e6",
    "cp -228",
    156591,
  ],
  ["fen 8/8/8/4k3/8/8/Q7/4K3 w - - 0 1", "a2h2", "cp 526", 35717],
  ["fen 8/1P6/8/8/8/4k3/8/4K3 w - - 0 1", "b7b8q", "cp 513", 9509],
  ["fen 4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e1f2", "cp 0", 1537],
];
for (const [position, best, score, nodes] of positions) {
  let engine;
  let output = "";
  const instance = await WebAssembly.instantiate(module, {
    host: {
      now: () => performance.now(),
      output: (ptr, len) => {
        output += new TextDecoder().decode(new Uint8Array(engine.memory.buffer, ptr, len));
      },
    },
  });
  engine = instance.exports;
  assert.equal(model.length, engine.model_size());
  new Uint8Array(engine.memory.buffer, engine.model_ptr(), model.length).set(model);
  engine.initialize();
  function command(text) {
    const bytes = new TextEncoder().encode(text);
    new Uint8Array(engine.memory.buffer, engine.input_ptr(), bytes.length).set(bytes);
    return engine.command(bytes.length);
  }
  assert.equal(command(`position ${position}`), 1);
  assert.equal(command("go depth 10"), 1);
  assert.equal(output.match(/bestmove (\w+)/)?.[1], best, position);
  assert.equal([...output.matchAll(/score ((?:cp|mate) -?\d+)/g)].at(-1)?.[1], score, position);
  assert.equal(Number([...output.matchAll(/ nodes (\d+)/g)].at(-1)?.[1]), nodes, position);
  assert.equal(command("position startpos moves e2e5"), 0, "Reject illegal history");
}
console.log("Nine WASM positions match native Reckless: best move, score and searched nodes.");
