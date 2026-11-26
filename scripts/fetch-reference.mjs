#!/usr/bin/env node
// Download the reference screenshots listed in reference/manifest.json into
// reference/screenshots/. The images belong to 512 Pixels and are not part of this repository;
// the manifest records each file's source URL, size and SHA-256, and every download is checked
// against it. Files already present with the right hash are skipped.
//
//   npm run reference:fetch                 every screenshot (about 1 GB)
//   npm run reference:fetch -- Finder-Go    only files whose name contains a given text
//   npm run reference:fetch -- --check      verify what is on disk, download nothing
//
//   --timeout <seconds>    how long one attempt may take, response body included (default 120;
//                          from 0.001 to 86400)
//   --reference <dir>      the folder that holds manifest.json (default: reference/ here)
//
// One screenshot that cannot be read or downloaded is reported and counted; the run goes on
// with the others and ends with the summary and exit status 1.
//
// Every path in the manifest must name a file inside reference/screenshots/. A manifest with a
// path that leads anywhere else is refused whole, before anything is read or downloaded (exit
// status 1), so that an entry such as "screenshots/../../package.json" cannot replace a file
// of the repository.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONCURRENCY = 4;
const ATTEMPTS = 3;

let parsed;
try {
  parsed = parseArgs({
    options: {
      check: { type: "boolean", default: false },
      timeout: { type: "string", default: "120" },
      reference: { type: "string" },
    },
    allowPositionals: true,
  });
} catch (error) {
  console.error(`${error.message}\nOptions: --check, --timeout <seconds>, --reference <dir>`);
  process.exit(2);
}
const checkOnly = parsed.values.check;
// Whole milliseconds, within what a timer accepts: anything else would fail every download
// instead of being refused here.
const timeoutMs = Math.round(Number(parsed.values.timeout) * 1000);
if (!(timeoutMs >= 1 && timeoutMs <= 86_400_000)) {
  console.error(
    `--timeout takes a number of seconds from 0.001 to 86400, not "${parsed.values.timeout}"`,
  );
  process.exit(2);
}
const timeoutSeconds = timeoutMs / 1000;
const reference = path.resolve(parsed.values.reference ?? path.join(root, "reference"));
const filters = parsed.positionals.map((text) => text.toLowerCase());

const manifest = JSON.parse(await readFile(path.join(reference, "manifest.json"), "utf8"));

// Checked for the whole manifest, not only for the files asked for: the manifest is wrong
// whichever of its files this run would have touched.
const screenshotsFolder = path.join(reference, "screenshots");
const outside = manifest.screenshots.filter((shot) => {
  // Relative to the reference folder only: an absolute path is refused even when it happens to
  // lead into this checkout's screenshots/, since it would lead elsewhere in any other.
  if (typeof shot.path !== "string" || path.isAbsolute(shot.path)) return true;
  const inside = path.relative(screenshotsFolder, path.resolve(reference, shot.path));
  return (
    inside === "" ||
    inside === ".." ||
    inside.startsWith(`..${path.sep}`) ||
    path.isAbsolute(inside)
  );
});
if (outside.length > 0) {
  for (const shot of outside) {
    console.error(
      `refused: ${JSON.stringify(shot.filename)} has the path ${JSON.stringify(shot.path)}, which is not a file inside screenshots/`,
    );
  }
  console.error(
    `${outside.length} of ${manifest.screenshots.length} paths in the manifest lead outside ${screenshotsFolder}. Nothing was read or downloaded.`,
  );
  process.exit(1);
}
const wanted = manifest.screenshots.filter(
  (shot) =>
    filters.length === 0 || filters.some((text) => shot.filename.toLowerCase().includes(text)),
);
if (wanted.length === 0) {
  console.error(`No screenshot in the manifest matches: ${filters.join(", ")}`);
  process.exit(1);
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

/**
 * "present" when the file on disk matches the manifest, else "missing" or "corrupt". Anything
 * else that stops the file from being read (a directory in its place, no permission) is an
 * error for the caller to count.
 */
async function state(shot) {
  let buffer;
  try {
    buffer = await readFile(path.join(reference, shot.path));
  } catch (error) {
    if (error.code === "ENOENT") return "missing";
    throw error;
  }
  return sha256(buffer) === shot.sha256 ? "present" : "corrupt";
}

async function download(shot) {
  const file = path.join(reference, shot.path);
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    // A name of this attempt's own: another run that downloads the same file at the same time
    // writes elsewhere, and neither can truncate or rename the other's file.
    const temporary = `${file}.${process.pid}-${randomUUID()}.part`;
    try {
      // The signal covers the whole attempt: the response and the reading of its body.
      const response = await fetch(shot.source_url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (sha256(buffer) !== shot.sha256) {
        throw new Error("SHA-256 differs from the manifest");
      }
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(temporary, buffer);
      await rename(temporary, file);
      return;
    } catch (error) {
      lastError =
        error.name === "TimeoutError"
          ? new Error(`no complete response within ${timeoutSeconds} s`)
          : error;
      try {
        await rm(temporary, { force: true });
      } catch (cleanup) {
        // Said at once and for each attempt: a later attempt may succeed, or fail for another
        // reason, and the file this one left would never be named.
        console.error(
          `left behind: ${path.relative(reference, temporary)} could not be removed (${cleanup.message})`,
        );
      }
    }
  }
  throw lastError;
}

const counts = { present: 0, downloaded: 0, missing: 0, corrupt: 0, failed: 0 };
const queue = [...wanted];

async function worker() {
  for (let shot = queue.shift(); shot; shot = queue.shift()) {
    try {
      const found = await state(shot);
      if (found === "present") {
        counts.present++;
      } else if (checkOnly) {
        counts[found]++;
        console.log(`${found}: ${shot.filename}`);
      } else {
        await download(shot);
        counts.downloaded++;
        console.log(`downloaded: ${shot.filename}`);
      }
    } catch (error) {
      counts.failed++;
      console.error(`failed: ${shot.filename} (${shot.source_url}): ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const summary = checkOnly
  ? `${counts.present} present, ${counts.missing} missing, ${counts.corrupt} corrupt, ${counts.failed} failed`
  : `${counts.present} already present, ${counts.downloaded} downloaded, ${counts.failed} failed`;
console.log(`${wanted.length} screenshots: ${summary}. Source: ${manifest.source_page}`);
process.exit(counts.missing + counts.corrupt + counts.failed > 0 ? 1 : 0);
