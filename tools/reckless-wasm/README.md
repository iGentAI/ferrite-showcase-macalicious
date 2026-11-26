# Reckless for Macalicious Chess

This is a standalone browser port of Reckless 0.9.0, upstream commit
`0e92358f5acd66e5ac77b1bf558202e47c515435`:
https://github.com/codedeliveryservice/Reckless/tree/0e92358f5acd66e5ac77b1bf558202e47c515435

Copyright belongs to the upstream contributors. Reckless and this port are
licensed under AGPL-3.0; see LICENSE. Port changes were made on November 7, 2026.
The Chess app's existing About window links to an archive of this source.

## Browser changes

The search, evaluation, board rules and neural-network weights are unchanged.
The native stdin/thread-pool driver is replaced by a small synchronous UCI bridge
in `src/lib.rs`. A dedicated Web Worker owns the instance. The browser supplies
`performance.now()` and receives UCI output through two WASM imports. Hash-table
clearing is sequential; there are no OS threads, Syzygy files, NUMA bindings,
SharedArrayBuffer requirements or server-side searches. The build enables WASM
SIMD128 and reserves a 16 MiB stack for upstream's large initialization values.

`src/nnue.rs` reserves the model's aligned memory and exports its address/size.
The worker fills it exactly once, verifies each part's SHA-256, then calls
`initialize`. Never search before loading the complete model. Memory and exports
belong to one worker; terminating it cancels a search and releases that instance.

The full upstream network is 63,266,880 bytes. It is compressed losslessly into
parts of 4 MiB each (about 3 MB compressed), each small enough for one reply of the Ferrite
app that serves the desktop. The desktop fetches no engine assets until
Chess opens. The worker caches the WASM and model parts, keeps an idle engine alive
between turns, and does not need a network connection for already cached assets.
The normal strongest search budget is 500 ms, plus a 100 ms UI pause. During the
first eight plies, MultiPV chooses among moves within 25 centipawns of the best;
later play uses the engine's strongest single line. No engine selector is exposed.

## Build

Install Rust with rustup and run `rustup target add wasm32-unknown-unknown`.
From this directory, `cargo build --release --locked` builds the standalone WASM
module using `.cargo/config.toml`. No Cargo dependencies are required. The module
exports `memory`, `model_ptr`, `model_size`, `input_ptr`, `initialize`, and
`command`. Commands are UTF-8, at most 65,536 bytes, written to `input_ptr` before
calling `command(length)`. The return is 1 on success and 0 on invalid input.
Supported commands: `uci`, `isready`, `ucinewgame`, `position startpos|fen … moves …`,
`setoption name MultiPV value 1|2|3`, `go depth N`, `go movetime N`, and `eval`.

In the Macalicious checkout, `node tools/reckless-wasm/build.mjs` also downloads
and verifies the pinned upstream network, writes deployable assets, and packages
this source archive. `RECKLESS_NETWORK=/path/to/v54-5478683c.nnue` reuses a local
copy. Ordinary frontend builds use the checked-in generated assets and do not
require Rust or an external download. `node tools/reckless-wasm/test.mjs` checks
nine deterministic positions against recorded native Reckless results.

Model: https://github.com/codedeliveryservice/RecklessNetworks/releases/download/networks/v54-5478683c.nnue

Browser integration source: `demos/chess/chess-reckless.worker.ts` handles loading,
verification, caching and UCI message delivery; `chess-reckless.ts` adapts games and
budgets. Those two source files are also included in this archive's `browser/`
directory. No desktop account information or credentials are included.
