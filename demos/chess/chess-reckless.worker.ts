import { networkParts } from "./vendor/reckless/assets";
import wasmUrl from "./vendor/reckless/reckless.wasm?url";

interface Engine {
  memory: WebAssembly.Memory;
  model_ptr: () => number;
  model_size: () => number;
  input_ptr: () => number;
  initialize: () => void;
  command: (length: number) => number;
}
function engineExports(exports: WebAssembly.Exports): Engine {
  const { memory, model_ptr, model_size, input_ptr, initialize, command } = exports;
  if (
    !(memory instanceof WebAssembly.Memory) ||
    typeof model_ptr !== "function" ||
    typeof model_size !== "function" ||
    typeof input_ptr !== "function" ||
    typeof initialize !== "function" ||
    typeof command !== "function"
  ) {
    throw new Error("Invalid Reckless module");
  }
  const number = (value: unknown): number => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new Error("Invalid Reckless result");
    }
    return value;
  };
  return {
    memory,
    model_ptr: () => number(model_ptr()),
    model_size: () => number(model_size()),
    input_ptr: () => number(input_ptr()),
    initialize: () => {
      initialize();
    },
    command: (length) => number(command(length)),
  };
}

const ASSET_URLS = new Set([wasmUrl, ...networkParts.map((part) => part.url)]);
function fetchAsset(url: string): Promise<Response> {
  if (!ASSET_URLS.has(url)) throw new Error("Unknown chess asset");
  return fetch(url, { credentials: "omit", signal: AbortSignal.timeout(30_000) });
}

async function cached(url: string): Promise<Response> {
  let cache: Cache | undefined;
  try {
    cache = await caches.open("macalicious-reckless-v1");
    const saved = await cache.match(url);
    if (saved) return saved;
  } catch {
    /* Storage is optional in private browsing. */
  }
  const response = await fetchAsset(url);
  if (!response.ok) throw new Error(`Could not load the chess engine (${response.status})`);
  if (cache) await cache.put(url, response.clone()).catch(() => {});
  return response;
}

async function initialize(): Promise<Engine> {
  let engine: Engine;
  let output = "";
  const decoder = new TextDecoder();
  const wasm = await cached(wasmUrl);
  const { instance } = await WebAssembly.instantiate(await wasm.arrayBuffer(), {
    host: {
      now: () => performance.now(),
      output: (ptr: number, length: number) => {
        output += decoder.decode(new Uint8Array(engine.memory.buffer, ptr, length));
        let end = output.indexOf("\n");
        while (end >= 0) {
          postMessage(output.slice(0, end));
          output = output.slice(end + 1);
          end = output.indexOf("\n");
        }
      },
    },
  });
  engine = engineExports(instance.exports);
  const total = networkParts.reduce((size, part) => size + part.size, 0);
  if (engine.model_size() !== total) throw new Error("Wrong Reckless network size");
  // Two downloads at a time keep startup memory bounded on phones.
  const queue = [...networkParts];
  async function loadParts() {
    for (let part = queue.shift(); part; part = queue.shift()) {
      const response = await cached(part.url);
      const body = await response.arrayBuffer();
      // A server may send a `.gz` file with `Content-Encoding: gzip`, as Vite's dev server does, and
      // the browser then hands it over already unpacked.
      const bytes =
        body.byteLength === part.size
          ? body
          : await new Response(
              new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip")),
            ).arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (bytes.byteLength !== part.size || hash !== part.sha256) {
        try {
          await (await caches.open("macalicious-reckless-v1")).delete(part.url);
        } catch {
          /* No persistent cache. */
        }
        throw new Error("Invalid Reckless network");
      }
      new Uint8Array(engine.memory.buffer, engine.model_ptr() + part.offset, part.size).set(
        new Uint8Array(bytes),
      );
    }
  }
  await Promise.all([loadParts(), loadParts()]);
  engine.initialize();
  postMessage("readyok");
  return engine;
}

const ready = initialize();
// A startup failure also reaches the owner when it only prewarmed the engine.
void ready.catch(() => postMessage("engineerror"));
let queue = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<unknown>) => {
  if (typeof data !== "string") return;
  queue = queue
    .then(async () => {
      const engine = await ready;
      const bytes = new TextEncoder().encode(data);
      if (bytes.length > 65536) throw new Error("Chess history is too long");
      new Uint8Array(engine.memory.buffer, engine.input_ptr(), bytes.length).set(bytes);
      if (!engine.command(bytes.length)) throw new Error("Invalid chess position");
    })
    .catch(() => postMessage("engineerror"));
};
