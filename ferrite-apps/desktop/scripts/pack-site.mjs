#!/usr/bin/env node
// Build the Macalicious desktop page and pack it into src/site_assets.rs and
// src/site_assets/part_<n>.rs, the module the application seeds into its
// `site` blob at boot.
//
//   node scripts/pack-site.mjs              # vite build, then pack
//   node scripts/pack-site.mjs --from <dir> # pack an existing build
//
// A Ferrite application cannot read files at build time (the gate refuses
// build.rs, include_bytes! and include_str!), so the built files have to
// arrive as Rust source. Each file becomes one base64 string literal; the
// module also names a build id (the SHA-256 of every path and its bytes) so
// a process that finds the same build already published skips the upload.
// A deploy stores each source file as one record of at most 16 MiB, so the
// literals are spread over part files of at most MAX_PART_BYTES each, and
// src/site_assets.rs lists them in order. The output is about 95 MB and is
// ignored by git: run this script before `cargo build`, `ferrite test`,
// `ferrite dev` or `ferrite deploy`.
//
// Compression is part of the build. A file of a compressible type also gets a
// brotli and a gzip copy when that copy is at least MIN_SAVING smaller, and
// the app answers each browser with the best copy its Accept-Encoding takes
// (src/site_serve.rs). The app serves the site through its own api route, one
// reply per file, and a reply holds at most about 4 MiB (MAX_REPLY_BYTES). A
// file over that as it is must have a gzip copy within it, which every
// browser accepts; the app sends such a file only compressed (the page's main
// script, 5.5 MB, is 1.6 MB in gzip and 1.2 MB in brotli). Splitting the
// script instead reordered the page's stylesheet, and its cascade with it.

import "./sync-test-manifest.mjs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync, constants as zlib } from "node:zlib";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appDir, "../..");
const outFile = path.join(appDir, "src/site_assets.rs");
const partDir = path.join(appDir, "src/site_assets");
// One blob object holds at most 16 MiB; stay well inside it.
const MAX_FILE_BYTES = 15 * 1024 * 1024;
// A deploy refuses any source file over its 16 MiB record limit.
const MAX_PART_BYTES = 14 * 1024 * 1024;
// The most one file may hold: the app answers it in one api reply, which the
// platform caps at about 4 MiB. Keep MAX_REPLY_BYTES in src/site_serve.rs equal.
const MAX_REPLY_BYTES = 3.5 * 1024 * 1024;
// The types worth compressing; the rest (images, fonts, models, archives) are
// compressed already or barely shrink.
const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|wasm|map|txt)$/;
// A compressed copy is kept only when it saves at least this share.
const MIN_SAVING = 0.1;

const args = process.argv.slice(2);
const fromAt = args.indexOf("--from");
let siteDir;
if (fromAt >= 0) {
  siteDir = path.resolve(process.cwd(), args[fromAt + 1] ?? "");
} else {
  siteDir = path.join(appDir, "dist/site");
  const vite = path.join(repoRoot, "node_modules/.bin/vite");
  const build = spawnSync(
    vite,
    ["build", "--config", "docs/desktop/vite.config.ts", "--outDir", siteDir, "--emptyOutDir"],
    // VITE_MACALICIOUS_API tells the demos they are served by this app, so they call their
    // /api/<app>/ modules; the static documentation build leaves it unset and never does.
    { cwd: repoRoot, stdio: "inherit", env: { ...process.env, VITE_MACALICIOUS_API: "1" } },
  );
  if (build.status !== 0) {
    console.error(`the desktop build failed (exit ${build.status ?? build.signal})`);
    process.exit(1);
  }
}

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

// Compact only the generated deployment, preserving source artwork and every
// asset. Renaming changed bytes keeps the shared blob's immutable-key contract.
if (args.includes("--compact-assets")) {
  const { default: sharp } = await import("sharp");
  const replacements = new Map();
  const renamed = (rel, bytes) => {
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
    const next = rel.replace(/-[A-Za-z0-9_-]{8}(\.[^.]+)$/, `-${hash}$1`);
    writeFileSync(path.join(siteDir, rel), bytes);
    if (next !== rel) renameSync(path.join(siteDir, rel), path.join(siteDir, next));
    replacements.set(path.basename(rel), path.basename(next));
  };
  // 1024 px and quality 55: Preview's pdf.js worker (1.3 MB) took the packed
  // submission past the platform's 16 MiB record limit at 1280 px and 60.
  for (const rel of walk(siteDir).filter((name) => name.endsWith(".webp"))) {
    const original = readFileSync(path.join(siteDir, rel));
    const compact = await sharp(original)
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 55, effort: 4 })
      .toBuffer();
    if (compact.length < original.length) renamed(rel, compact);
  }
  // Scripts and stylesheets then point at the new image names. Their new names
  // are fixed before any file is rewritten, so every reference (a dynamic
  // import of a later chunk, an import cycle) gets the final name whatever
  // the order. A name derives from the file's Vite name, which hashes its
  // original bytes, and from the image replacements, which decide every
  // rewrite: the same name always holds the same bytes.
  const imageDigest = createHash("sha256")
    .update(JSON.stringify([...replacements].sort()))
    .digest("hex");
  const rewritten = walk(siteDir).filter((name) => /\.(css|js)$/.test(name));
  const nextName = new Map();
  for (const rel of rewritten) {
    const hash = createHash("sha256")
      .update(`${path.basename(rel)}\0${imageDigest}`)
      .digest("hex")
      .slice(0, 8);
    const next = rel.replace(/-[A-Za-z0-9_-]{8}(\.[^.]+)$/, `-${hash}$1`);
    nextName.set(rel, next);
    replacements.set(path.basename(rel), path.basename(next));
  }
  for (const rel of [...rewritten, ...walk(siteDir).filter((name) => name.endsWith(".html"))]) {
    let text = readFileSync(path.join(siteDir, rel), "utf8");
    for (const [previous, next] of replacements) text = text.replaceAll(previous, next);
    writeFileSync(path.join(siteDir, rel), text);
    const next = nextName.get(rel);
    if (next && next !== rel) renameSync(path.join(siteDir, rel), path.join(siteDir, next));
  }
  console.log(`compact deployment assets: ${replacements.size} immutable names updated`);
}

const files = walk(siteDir).sort();
if (!files.includes("index.html")) {
  console.error(`${siteDir} has no index.html; is it a desktop build?`);
  process.exit(1);
}

const digest = createHash("sha256");
let total = 0;
const compressed = { br: 0, gzip: 0 };
const parts = [[]];
let partBytes = 0;
const names = [];
for (const rel of files) {
  if (!/^[A-Za-z0-9._\-/]+$/.test(rel)) {
    console.error(
      `refusing ${rel}: only letters, digits, '.', '_', '-' and '/' make safe blob keys`,
    );
    process.exit(1);
  }
  // Builds share one blob; only index.html may keep its name across builds
  // (see src/site.rs). Vite names every other file `<name>-<8-char hash>.<ext>`.
  if (rel !== "index.html" && !/-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/.test(rel)) {
    console.error(`refusing ${rel}: every file but index.html needs a content hash in its name`);
    process.exit(1);
  }
  // The compressed copies are stored beside the file as `<path>.br` and
  // `<path>.gz`, which must not be files of the build themselves.
  if (/\.br$/.test(rel) || (rel.endsWith(".gz") && COMPRESSIBLE.test(rel.slice(0, -3)))) {
    console.error(`refusing ${rel}: the name of a compressed copy is reserved`);
    process.exit(1);
  }
  const full = path.join(siteDir, rel);
  const size = statSync(full).size;
  if (size > MAX_FILE_BYTES) {
    console.error(`refusing ${rel}: ${size} bytes is over the ${MAX_FILE_BYTES}-byte blob limit`);
    process.exit(1);
  }
  const bytes = readFileSync(full);
  digest.update(`${rel}\0${bytes.length}\0`);
  digest.update(bytes);
  total += bytes.length;
  const copies = { br: null, gzip: null };
  if (COMPRESSIBLE.test(rel)) {
    const keep = (copy) => (copy.length <= bytes.length * (1 - MIN_SAVING) ? copy : null);
    copies.br = keep(
      brotliCompressSync(bytes, {
        params: {
          [zlib.BROTLI_PARAM_QUALITY]: zlib.BROTLI_MAX_QUALITY,
          [zlib.BROTLI_PARAM_MODE]: rel.endsWith(".wasm")
            ? zlib.BROTLI_MODE_GENERIC
            : zlib.BROTLI_MODE_TEXT,
          [zlib.BROTLI_PARAM_SIZE_HINT]: bytes.length,
        },
      }),
    );
    copies.gzip = keep(gzipSync(bytes, { level: 9 }));
  }
  if (size > MAX_REPLY_BYTES && !(copies.gzip && copies.gzip.length <= MAX_REPLY_BYTES)) {
    console.error(
      `refusing ${rel}: ${size} bytes is over the ${MAX_REPLY_BYTES}-byte reply limit and has no gzip copy within it; split it into parts`,
    );
    process.exit(1);
  }
  for (const [coding, copy] of Object.entries(copies)) {
    if (!copy) continue;
    if (copy.length > MAX_REPLY_BYTES) {
      console.error(
        `refusing ${rel}: its ${coding} copy is over the ${MAX_REPLY_BYTES}-byte reply limit`,
      );
      process.exit(1);
    }
    digest.update(`${coding}\0${copy.length}\0`);
    digest.update(copy);
    compressed[coding] += copy.length;
  }
  const literal = (copy) => (copy ? `Some("${copy.toString("base64")}")` : "None");
  const name = `F${names.length}`;
  const entry = `pub const ${name}: SiteFile = SiteFile {\n    path: "${rel}",\n    base64: "${bytes.toString("base64")}",\n    br: ${literal(copies.br)},\n    gzip: ${literal(copies.gzip)},\n};\n`;
  if (entry.length > MAX_PART_BYTES) {
    console.error(`refusing ${rel}: its literal is over the ${MAX_PART_BYTES}-byte part limit`);
    process.exit(1);
  }
  if (partBytes + entry.length > MAX_PART_BYTES) {
    parts.push([]);
    partBytes = 0;
  }
  parts.at(-1).push(entry);
  partBytes += entry.length;
  names.push(`part_${parts.length - 1}::${name}`);
}
const buildId = `sha256:${digest.digest("hex")}`;

const header = "// @generated by scripts/pack-site.mjs. Do not edit; regenerate it.";
rmSync(partDir, { recursive: true, force: true });
mkdirSync(partDir);
parts.forEach((entries, n) => {
  writeFileSync(
    path.join(partDir, `part_${n}.rs`),
    [header, "", "use crate::site::SiteFile;", "", ...entries].join("\n"),
  );
});
writeFileSync(
  outFile,
  [
    header,
    `// ${files.length} files, ${total} bytes, from the Macalicious desktop build.`,
    "",
    ...parts.map((_, n) => `mod part_${n};`),
    "",
    "use crate::site::SiteBundle;",
    "",
    "pub static SITE: SiteBundle = SiteBundle {",
    `    build_id: "${buildId}",`,
    "    files: &[",
    ...names.map((name) => `        ${name},`),
    "    ],",
    "};",
    "",
  ].join("\n"),
);
console.log(
  `packed ${files.length} files (${(total / 1048576).toFixed(1)} MiB, with ${(compressed.br / 1048576).toFixed(1)} MiB of brotli and ${(compressed.gzip / 1048576).toFixed(1)} MiB of gzip copies) into ${path.relative(appDir, outFile)} and ${parts.length} part(s), build ${buildId.slice(0, 19)}`,
);
