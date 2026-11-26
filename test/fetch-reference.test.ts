// @vitest-environment node
import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `npm run reference:fetch` (scripts/fetch-reference.mjs), run as a contributor runs it, against
 * a manifest and a server made here. One screenshot that cannot be read or downloaded must not
 * stop the run, a download that stalls must end, two runs must not share a temporary file,
 * nothing temporary may be left behind, and nothing may be written outside screenshots/.
 */
const script = path.resolve(import.meta.dirname, "../scripts/fetch-reference.mjs");

const images: Record<string, Buffer> = {
  "one.png": Buffer.from("the first image"),
  "two.png": Buffer.from("the second image"),
  "three.png": Buffer.from("the third image"),
};
const sha256 = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");

let reference: string;
let server: Server;
let children: Set<ChildProcess>;
/** Every name the server was asked for, in order. */
let requested: string[];
/** Names the server starts to answer and never finishes. */
let stalled: Set<string>;
/** Called by the server for each request it is about to answer in full. */
let beforeAnswer: (name: string) => void;
/** When set, the first two requests for a name are answered together, once both are here. */
let paired: Map<string, ServerResponse[]> | undefined;

beforeEach(async () => {
  reference = mkdtempSync(path.join(tmpdir(), "macalicious-reference-"));
  children = new Set();
  requested = [];
  stalled = new Set();
  beforeAnswer = () => {};
  paired = undefined;
  server = createServer((request, response) => {
    const name = (request.url ?? "").slice(1);
    requested.push(name);
    const image = images[name];
    const answer = (to: ServerResponse) =>
      to.writeHead(200, { "content-length": image?.length }).end(image);
    if (!image) {
      response.writeHead(404).end();
    } else if (stalled.has(name)) {
      // The headers and a part of the body, and then nothing more.
      response.writeHead(200, { "content-length": image.length });
      response.write(image.subarray(0, 4));
    } else if (paired && (paired.get(name)?.length ?? 0) < 2) {
      const waiting = [...(paired.get(name) ?? []), response];
      paired.set(name, waiting);
      if (waiting.length === 2) for (const held of waiting) answer(held);
    } else {
      beforeAnswer(name);
      answer(response);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  writeFileSync(
    path.join(reference, "manifest.json"),
    JSON.stringify({
      source_page: "https://example.test/library",
      screenshots: Object.entries(images).map(([filename, image]) => ({
        filename,
        path: `screenshots/${filename}`,
        source_url: `http://127.0.0.1:${port}/${filename}`,
        sha256: sha256(image),
      })),
    }),
  );
});

afterEach(async () => {
  // A script that is still running (a test gave up on it) must not outlive its server.
  for (const child of children) child.kill("SIGKILL");
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  rmSync(reference, { recursive: true, force: true });
});

/**
 * Run the script without blocking this process, which is also the server it downloads from.
 * A run that does not end within ten seconds is stopped and reported with `status` null.
 * `nodeArgs` are options for node itself, before the script.
 */
function run(...args: string[]) {
  return runWith([], ...args);
}
function runWith(nodeArgs: string[], ...args: string[]) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [...nodeArgs, script, "--reference", reference, ...args]);
    children.add(child);
    const deadline = setTimeout(() => child.kill("SIGKILL"), 10_000);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      clearTimeout(deadline);
      children.delete(child);
      resolve({ status, stdout, stderr });
    });
  });
}
const screenshots = () => readdirSync(path.join(reference, "screenshots")).sort();

/**
 * Options for node that load `source` as a module before the script. Used to stand in for
 * the file system where a test needs to see, or to fail, one of its operations.
 */
function loadedFirst(source: string) {
  const file = path.join(reference, "loaded-first.mjs");
  writeFileSync(
    file,
    `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
${source}
syncBuiltinESMExports();
`,
  );
  return ["--import", pathToFileURL(file).href];
}

describe("reference:fetch", () => {
  it("downloads what the manifest lists, checks it, and leaves no temporary file", async () => {
    const first = await run();
    expect(first.stdout).toContain("3 screenshots: 0 already present, 3 downloaded, 0 failed.");
    expect(first.status).toBe(0);
    expect(screenshots()).toEqual(["one.png", "three.png", "two.png"]);
    expect(readFileSync(path.join(reference, "screenshots/two.png"))).toEqual(images["two.png"]);

    const second = await run();
    expect(second.stdout).toContain("3 already present, 0 downloaded, 0 failed.");
    expect(second.status).toBe(0);
  });

  it("gives two runs that download the same file at the same time a temporary file each", async () => {
    // The server answers the two runs' requests for a file together, so both hold the same
    // download at once. Each run writes down every file it moves into place: where it was,
    // and where it went.
    const moves = path.join(reference, "moves.log");
    const recorded = loadedFirst(`const rename = fs.promises.rename;
fs.promises.rename = (from, to) => {
  fs.appendFileSync(${JSON.stringify(moves)}, JSON.stringify([String(from), String(to)]) + "\\n");
  return rename(from, to);
};`);
    const folder = path.join(reference, "screenshots");
    paired = new Map();

    const [first, second] = await Promise.all([runWith(recorded), runWith(recorded)]);
    expect(first.stderr + second.stderr).toBe("");
    expect([first.status, second.status]).toEqual([0, 0]);
    expect(first.stdout).toContain("3 downloaded");
    expect(second.stdout).toContain("3 downloaded");
    expect(screenshots()).toEqual(["one.png", "three.png", "two.png"]);
    const moved = readFileSync(moves, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as [from: string, to: string]);
    for (const [name, image] of Object.entries(images)) {
      const file = path.join(folder, name);
      expect(readFileSync(file)).toEqual(image);
      // Each run moved its download into place once, from a file that was its own.
      const from = moved.filter(([, to]) => to === file).map(([source]) => source);
      expect(from).toHaveLength(2);
      expect(from[0]).not.toBe(from[1]);
      expect(from).not.toContain(file);
    }
  });

  it("goes on after a screenshot that cannot be read, and still prints the summary", async () => {
    // A directory where a screenshot belongs: reading it is an error, not a missing file.
    mkdirSync(path.join(reference, "screenshots/one.png"), { recursive: true });
    const fetched = await run();
    expect(fetched.stderr).toMatch(/^failed: one\.png \(http:.*\): .*EISDIR/m);
    expect(fetched.stdout).toContain("3 screenshots: 0 already present, 2 downloaded, 1 failed.");
    expect(fetched.status).toBe(1);

    const checked = await run("--check");
    expect(checked.stderr).toMatch(/^failed: one\.png /m);
    expect(checked.stdout).toContain("3 screenshots: 2 present, 0 missing, 0 corrupt, 1 failed.");
    expect(checked.status).toBe(1);
  });

  it("removes its temporary file when the download cannot be put in place", async () => {
    // The file is missing when the script looks, and a directory has taken its place by the
    // time the download is written: the temporary file exists, and the rename fails.
    beforeAnswer = (name) => {
      if (name === "one.png") {
        mkdirSync(path.join(reference, "screenshots/one.png"), { recursive: true });
      }
    };
    const result = await run();
    expect(result.stderr).toMatch(/^failed: one\.png /m);
    expect(result.stdout).toContain("3 screenshots: 0 already present, 2 downloaded, 1 failed.");
    expect(result.status).toBe(1);
    // The directory, the two downloads, and no .part file from any of the three attempts.
    expect(screenshots()).toEqual(["one.png", "three.png", "two.png"]);
    expect(readdirSync(path.join(reference, "screenshots/one.png"))).toEqual([]);
  });

  it("names every temporary file it could not remove, whatever the later attempts do", async () => {
    // The download cannot be put in place (a directory has taken the file's place), and the
    // temporary file of each of the three attempts cannot be removed either.
    beforeAnswer = (name) => {
      if (name === "one.png") {
        mkdirSync(path.join(reference, "screenshots/one.png"), { recursive: true });
      }
    };
    const stuck = loadedFirst(`const rm = fs.promises.rm;
fs.promises.rm = (file, options) =>
  String(file).endsWith(".part") ? Promise.reject(new Error("not permitted")) : rm(file, options);`);
    const result = await runWith(stuck);
    const left = [...result.stderr.matchAll(/^left behind: (\S+) could not be removed/gm)].map(
      (match) => match[1],
    );
    expect(new Set(left).size).toBe(3);
    // Each is a file that is really there, named from the reference folder.
    expect(left.map((file) => path.basename(file ?? "")).sort()).toEqual(
      screenshots().filter((name) => name.endsWith(".part")),
    );
    expect(result.stderr).toMatch(/^failed: one\.png /m);
    expect(result.stdout).toContain("3 screenshots: 0 already present, 2 downloaded, 1 failed.");
    expect(result.status).toBe(1);
  });

  it("gives up on a download whose body never arrives, and goes on with the others", async () => {
    stalled.add("two.png");
    const result = await run("--timeout", "0.3");
    expect(result.stderr).toMatch(/^failed: two\.png .*no complete response within 0\.3 s/m);
    expect(result.stdout).toContain("3 screenshots: 0 already present, 2 downloaded, 1 failed.");
    expect(result.status).toBe(1);
    expect(screenshots()).toEqual(["one.png", "three.png"]);
  }, 20_000);

  it("refuses a download that does not match the manifest", async () => {
    const manifestFile = path.join(reference, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    manifest.screenshots[0].sha256 = sha256(Buffer.from("another image"));
    writeFileSync(manifestFile, JSON.stringify(manifest));
    const result = await run("one");
    expect(result.stderr).toMatch(/^failed: one\.png .*SHA-256 differs from the manifest/m);
    expect(result.stdout).toContain("1 screenshots: 0 already present, 0 downloaded, 1 failed.");
    expect(result.status).toBe(1);
    expect(() => screenshots()).toThrow(/ENOENT/);
  });

  it.each([
    "screenshots/../victim.txt",
    "victim.txt",
    "../victim.txt",
    "screenshots/sub/../../victim.txt",
    "screenshots",
    "screenshots/",
    "elsewhere/one.png",
    path.join(tmpdir(), "macalicious-reference-absolute.png"),
    42,
  ])(
    "refuses a manifest whose path %j is not a file inside screenshots/, before it downloads anything",
    async (bad) => {
      // The second of three entries is the bad one, and its download would match its hash: the
      // only thing between it and the file it names is the check of the path.
      const victim = path.join(reference, "victim.txt");
      writeFileSync(victim, "a file of the repository");
      const manifestFile = path.join(reference, "manifest.json");
      const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
      manifest.screenshots[1].path = bad;
      writeFileSync(manifestFile, JSON.stringify(manifest));

      // Asking only for another file changes nothing: the manifest is refused whole.
      for (const args of [[], ["--check"], ["one"]]) {
        const result = await run(...args);
        expect(result.stderr).toContain(
          `refused: "two.png" has the path ${JSON.stringify(bad)}, which is not a file inside screenshots/`,
        );
        expect(result.stderr).toContain("1 of 3 paths in the manifest lead outside");
        expect(result.stdout).toBe("");
        expect(result.status).toBe(1);
      }
      expect(requested).toEqual([]);
      expect(readFileSync(victim, "utf8")).toBe("a file of the repository");
      expect(readdirSync(reference).sort()).toEqual(["manifest.json", "victim.txt"]);
    },
  );

  it("refuses an absolute path, even one that leads into this folder's screenshots/", async () => {
    const manifestFile = path.join(reference, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    const absolute = path.join(reference, "screenshots", "two.png");
    manifest.screenshots[1].path = absolute;
    writeFileSync(manifestFile, JSON.stringify(manifest));
    const result = await run();
    expect(result.stderr).toContain(
      `refused: "two.png" has the path ${JSON.stringify(absolute)}, which is not a file inside screenshots/`,
    );
    expect(result.stdout).toBe("");
    expect(result.status).toBe(1);
    expect(requested).toEqual([]);
    expect(readdirSync(reference)).toEqual(["manifest.json"]);
  });

  it("takes a path in a folder of screenshots/, and a name that only begins with two dots", async () => {
    const manifestFile = path.join(reference, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    manifest.screenshots[0].path = "screenshots/light/one.png";
    manifest.screenshots[1].path = "screenshots/..two.png";
    manifest.screenshots[2].path = "./screenshots/dark/../three.png";
    writeFileSync(manifestFile, JSON.stringify(manifest));
    const result = await run();
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("3 screenshots: 0 already present, 3 downloaded, 0 failed.");
    expect(result.status).toBe(0);
    expect(screenshots()).toEqual(["..two.png", "light", "three.png"]);
    expect(readdirSync(path.join(reference, "screenshots/light"))).toEqual(["one.png"]);
  });

  it("refuses an option it does not know", async () => {
    const unknown = await run("--chek");
    expect(unknown.stderr).toContain("Options: --check, --timeout <seconds>, --reference <dir>");
    expect(unknown.status).toBe(2);
  });

  it.each(["soon", "0", "-1", "0.0001", "Infinity", "1e9"])(
    "refuses --timeout %s before it downloads anything",
    async (value) => {
      const result = await run(`--timeout=${value}`);
      expect(result.stderr).toContain(
        `--timeout takes a number of seconds from 0.001 to 86400, not "${value}"`,
      );
      expect(result.stdout).toBe("");
      expect(result.status).toBe(2);
    },
  );

  it("takes a timeout that is not a whole number of milliseconds", async () => {
    const result = await run("--timeout", "1.0005");
    expect(result.stdout).toContain("3 downloaded, 0 failed.");
    expect(result.status).toBe(0);
  });
});
