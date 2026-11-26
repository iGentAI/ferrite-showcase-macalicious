import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, "../../demos/chess/vendor/reckless");
const target = resolve(root, "target");
mkdirSync(out, { recursive: true });
const rustc = execFileSync("rustup", ["which", "rustc"], { encoding: "utf8" }).trim();
execFileSync("rustup", ["run", "stable", "cargo", "build", "--release", "--locked"], {
  cwd: root,
  env: { ...process.env, RUSTC: rustc, CARGO_TARGET_DIR: target },
  stdio: "inherit",
});
writeFileSync(
  resolve(out, "reckless.wasm"),
  readFileSync(resolve(target, "wasm32-unknown-unknown/release/reckless_web.wasm")),
);
const netPath = process.env.RECKLESS_NETWORK;
const network = netPath
  ? readFileSync(netPath)
  : Buffer.from(
      await (
        await fetch(
          "https://github.com/codedeliveryservice/RecklessNetworks/releases/download/networks/v54-5478683c.nnue",
        )
      ).arrayBuffer(),
    );
const digest = createHash("sha256").update(network).digest("hex");
if (digest !== "5478683cb1bababde29ae8f29468a99846726548fc6a0ed54cac40ab6d38efbf")
  throw new Error("Unexpected Reckless neural network");
// 4 MiB of network per part compresses to about 3 MB: within one reply of the Ferrite app
// that serves the desktop (ferrite-apps/desktop/scripts/pack-site.mjs, MAX_REPLY_BYTES).
const PART_BYTES = 4 * 1024 * 1024;
const imports = [];
const parts = [];
for (let offset = 0, i = 0; offset < network.length; offset += PART_BYTES, i++) {
  const bytes = network.subarray(offset, offset + PART_BYTES);
  writeFileSync(resolve(out, `network-${i}.gz`), gzipSync(bytes, { level: 9 }));
  imports.push(`import part${i} from "./network-${i}.gz?url";`);
  parts.push(
    `{ url: part${i}, offset: ${offset}, size: ${bytes.length}, sha256: "${createHash("sha256").update(bytes).digest("hex")}" }`,
  );
}
writeFileSync(
  resolve(out, "assets.ts"),
  `${imports.join("\n")}\nexport const networkParts = [${parts.join(",\n")}];\n`,
);
const browser = resolve(root, "browser");
mkdirSync(browser, { recursive: true });
for (const name of ["chess-reckless.worker.ts", "chess-reckless.ts"]) {
  writeFileSync(resolve(browser, name), readFileSync(resolve(root, "../../demos/chess", name)));
}
execFileSync(
  "tar",
  ["-czf", resolve(out, "reckless-source.tar.gz"), "--exclude=target", "--exclude=.DS_Store", "."],
  { cwd: root },
);
writeFileSync(resolve(out, "LICENSE.txt"), readFileSync(resolve(root, "LICENSE")));
console.log(`Reckless WASM and ${parts.length} compressed network parts written.`);
