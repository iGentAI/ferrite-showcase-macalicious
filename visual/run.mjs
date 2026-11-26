#!/usr/bin/env node
// Visual comparison runner. See visual/README.md.
//
//   npm run visual                         every comparison, at 1x and 2x
//   npm run visual -- push-button          only specs or comparisons whose id contains the text
//   npm run visual -- --scale 2            one device scale
//   npm run visual -- --browser webkit     chromium (default), chrome, webkit or firefox
//   npm run visual -- --no-budget          report only; never fail on a budget
//   npm run visual -- --out <dir>          write the output somewhere else
//
// For each comparison it renders the example in a real browser, captures it, and either
// compares the capture with a crop of a reference screenshot (actual / expected / diff images
// and two scores) or, for a state no screenshot shows, checks the pixels the comparison
// expects. A report is written to visual/output/.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createServer } from "vite";
import {
  checkExpectedPixels,
  compareImages,
  compositeSheet,
  loadReferenceCrop,
  PIXEL_THRESHOLD,
} from "./lib/compare.mjs";
import { prepareOutputDir } from "./lib/output.mjs";
import { repoRoot } from "./lib/paths.mjs";
import { writeReport } from "./lib/report.mjs";
import {
  filterCouldSelectFolder,
  highestBudget,
  slackVerdict,
  validateVisualSpec,
} from "./lib/spec.mjs";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scale: { type: "string", default: "1,2" },
    browser: { type: "string", default: "chromium" },
    "no-budget": { type: "boolean", default: false },
    out: { type: "string", default: path.join(repoRoot, "visual/output") },
  },
});

const scales = options.scale.split(",").map(Number);
if (scales.length === 0 || scales.some((scale) => scale !== 1 && scale !== 2)) {
  console.error(`--scale takes 1, 2 or 1,2 (got "${options.scale}")`);
  process.exit(2);
}
const filter = positionals[0];
const outDir = path.resolve(options.out);

/** Files that are not JSON: an error for a folder that was asked for, a note for the others. */
const unreadable = [];
const skippedUnreadable = [];

/**
 * Find <folder>/<folder>.visual.json under src/components and demos, and the harness's own
 * checks under visual/checks: fixtures that prove, in the browser, what the runner promises
 * (see visual/checks/harness).
 */
async function findSpecs() {
  const specs = [];
  for (const base of ["src/components", "demos", "visual/checks"]) {
    let entries = [];
    try {
      entries = await readdir(path.join(repoRoot, base), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const dir = path.join(base, entry.name);
      const files = (await readdir(path.join(repoRoot, dir))).filter((f) =>
        f.endsWith(".visual.json"),
      );
      for (const file of files) {
        let json;
        try {
          json = JSON.parse(await readFile(path.join(repoRoot, dir, file), "utf8"));
        } catch (error) {
          // Another folder's unfinished file must not stop the comparisons that were asked for.
          const message = `${path.join(dir, file)}: invalid JSON: ${error.message}`;
          const asked = filterCouldSelectFolder(filter, entry.name);
          (asked ? unreadable : skippedUnreadable).push(message);
          continue;
        }
        specs.push({ folder: entry.name, dir, file: path.join(dir, file), json });
      }
    }
  }
  return specs;
}

/**
 * Take the pointer out of the window, so that nothing in the example is hovered. A pointer that
 * has never moved rests at the page origin, which is the example's top left corner, and
 * Chromium draws whatever the example puts there hovered once the page has laid out.
 *
 * It is moved to a point left of and above the page rather than to a corner of the window: a
 * capture can be larger than the window (a comparison with `expect` and no declared size does
 * not size it, and the browser captures an element beyond the window's edge), and then every
 * point of the window is inside the capture. No capture reaches a negative coordinate.
 * Actions run afterwards and move the pointer where they say.
 */
async function parkPointer(page) {
  await page.mouse.move(-1, -1);
}

/**
 * Wait until the page has drawn what the last input caused: a popup that is positioned a frame
 * after it opens, a font or an image that the new state asked for. The harness page defines the
 * wait (visual/harness/main.tsx), the same one it runs before it reports the example ready.
 */
async function settle(page, id) {
  const problem = await page.evaluate(() => window.__visualSettle());
  if (problem) throw new Error(`${id}: ${problem}`);
}

async function runActions(page, actions = []) {
  for (const action of actions) {
    if (action.hover) await page.hover(action.hover);
    else if (action.click) await page.click(action.click);
    else if (action.press) {
      await page.hover(action.press);
      await page.mouse.down();
    } else if (action.tab) {
      for (let i = 0; i < action.tab; i++) await page.keyboard.press("Tab");
    } else if (action.key) await page.keyboard.press(action.key);
  }
}

// Only the specs that are about to run are validated, so that one folder's unfinished file
// does not stop another folder's comparisons; `npm run lint` validates every file.
const matches = (spec, comparison) =>
  !filter || `${spec.folder}/${comparison?.name ?? ""}`.includes(filter);
const jobs = [];
const specs = await findSpecs();
const invalid = [...unreadable];
if (skippedUnreadable.length > 0) {
  console.error(
    `Not searched for "${filter}" because they are not valid JSON (npm run lint reports them):\n`,
  );
  for (const message of skippedUnreadable) console.error(`  ${message}`);
  console.error("");
}
for (const spec of specs) {
  const comparisons = Array.isArray(spec.json?.comparisons) ? spec.json.comparisons : [];
  const selected = comparisons.filter((comparison) => matches(spec, comparison));
  if (filter && selected.length === 0 && !spec.folder.includes(filter)) continue;
  const errors = validateVisualSpec(spec.json);
  if (errors.length > 0) {
    invalid.push(...errors.map((error) => `${spec.file}: ${error}`));
    continue;
  }
  for (const comparison of selected) {
    jobs.push({ spec, comparison, id: `${spec.folder}/${comparison.name}` });
  }
}

// A file that breaks the rules cannot be run, and makes the run fail: a comparison that
// cannot fail must not look like one that passed. The valid files still run, so that one
// folder's unfinished file does not hide the scores of the others.
if (invalid.length > 0) {
  console.error(`Invalid visual comparison files (${invalid.length}); these were not run:\n`);
  for (const error of invalid) console.error(`  ${error}`);
  console.error("\nThe fields are described in docs/content/visual-comparison.mdx.\n");
  if (jobs.length === 0) process.exit(2);
}

if (jobs.length === 0) {
  console.error(
    filter ? `No visual comparison matches "${filter}".` : "No *.visual.json files found.",
  );
  process.exit(filter ? 1 : 0);
}

await prepareOutputDir(
  outDir,
  jobs.map((job) => job.spec.folder),
);

const playwright = await import("playwright");
/**
 * `--browser chrome` is Google Chrome stable: Chromium's browser type through Playwright's `chrome`
 * channel (`npx playwright install chrome`), launched with every Chromium switch below. The
 * documented calibration gate stays Chromium.
 */
const family = options.browser === "chrome" ? "chromium" : options.browser;
const channel = options.browser === "chrome" ? "chrome" : undefined;
const browserType = ["chromium", "firefox", "webkit"].includes(family)
  ? playwright[family]
  : undefined;
if (!browserType) throw new Error(`Unknown browser "${options.browser}"`);

const server = await createServer({
  configFile: path.join(repoRoot, "visual/vite.config.ts"),
  server: { port: 0, host: "127.0.0.1", strictPort: false },
});
await server.listen();
const address = server.httpServer?.address();
const baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 5173}`;

// The window must hold the largest example (plus room for shadows that spill out of its box).
const cssSize = ({ comparison }) => {
  if (!comparison.reference) {
    const size = comparison.expect.size;
    return [size?.width ?? 0, size?.height ?? 0];
  }
  const s = comparison.reference.scale ?? 2;
  return [comparison.reference.crop.width / s, comparison.reference.crop.height / s];
};
const windowWidth = Math.max(800, ...jobs.map((job) => Math.ceil(cssSize(job)[0]) + 100));
const windowHeight = Math.max(600, ...jobs.map((job) => Math.ceil(cssSize(job)[1]) + 100));

/**
 * Chromium is launched once per device scale with a real --force-device-scale-factor.
 * Playwright's per-context deviceScaleFactor is an emulation: layout still snaps to a 1x grid,
 * so a 0.5px hairline is laid out as a full CSS pixel and every bezel comes out one device
 * pixel too thick and offset. A forced scale factor behaves like a real Retina display.
 * WebKit and Firefox have no such switch and fall back to the emulation. Chrome takes Chromium's.
 */
async function launch(scale) {
  if (family !== "chromium") return browserType.launch();
  return browserType.launch({
    channel,
    args: [
      `--force-device-scale-factor=${scale}`,
      `--window-size=${windowWidth},${windowHeight}`,
      // sRGB output to match the ICC-converted references; greyscale text antialiasing and no
      // hinting, as on macOS 10.14 and later.
      "--force-color-profile=srgb",
      "--disable-lcd-text",
      "--font-render-hinting=none",
    ],
  });
}

const contextOptions = (scale) =>
  family === "chromium"
    ? { viewport: null }
    : { deviceScaleFactor: scale, viewport: { width: windowWidth, height: windowHeight } };

/** An image's path in the report: relative to it, with forward slashes on every platform. */
const relativeImage = (file) => path.relative(outDir, file).split(path.sep).join("/");

const results = [];
let failed = invalid.length > 0;
let browserVersion = "";

try {
  for (const scale of scales) {
    let browser;
    try {
      browser = await launch(scale);
    } catch (error) {
      console.error(
        `Could not launch ${options.browser}. Install it once with: npm run visual:install\n`,
      );
      throw error;
    }
    browserVersion = browser.version();
    try {
      for (const { spec, comparison, id } of jobs) {
        const dir = path.join(outDir, spec.folder);
        await mkdir(dir, { recursive: true });

        const context = await browser.newContext({
          ...contextOptions(scale),
          colorScheme: comparison.appearance,
          reducedMotion: "reduce",
          forcedColors: comparison.forcedColors ? "active" : "none",
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(String(error)));
        page.on("console", (message) => {
          if (message.type() === "error") pageErrors.push(message.text());
        });

        const params = new URLSearchParams({
          example: `${spec.dir}/examples/${comparison.example}.tsx`,
          appearance: comparison.appearance,
        });
        if (comparison.accent) params.set("accent", comparison.accent);
        if (comparison.highlight) params.set("highlight", comparison.highlight);
        if (comparison.windowState && comparison.windowState !== "key")
          params.set("windowState", comparison.windowState);

        await page.goto(`${baseUrl}/?${params}`);
        await page.waitForSelector("html[data-ready], html[data-error]", { timeout: 30_000 });
        const error = await page.getAttribute("html", "data-error");
        if (error) throw new Error(`${id}: ${error}`);
        const dpr = await page.evaluate(() => window.devicePixelRatio);
        if (dpr !== scale)
          throw new Error(`${id}: expected devicePixelRatio ${scale}, browser reports ${dpr}`);
        await parkPointer(page);
        await runActions(page, comparison.actions);
        await settle(page, id);

        const actualPng = await page
          .locator(comparison.selector ?? "#visual-root")
          .first()
          .screenshot({
            animations: "disabled",
            caret: "hide",
            scale: "device",
          });
        await context.close();
        if (pageErrors.length)
          throw new Error(`${id}: page reported errors:\n${pageErrors.join("\n")}`);

        const stem = path.join(dir, `${comparison.name}@${scale}x`);
        const common = {
          id,
          spec: spec.file,
          name: comparison.name,
          description: comparison.description,
          appearance: comparison.appearance,
          scale,
        };

        // A state no screenshot shows: check the pixels the comparison expects.
        if (comparison.expect) {
          const result = await checkExpectedPixels(actualPng, comparison.expect, scale);
          await writeFile(`${stem}.actual.png`, result.actualPng);
          // Nothing checked is not a pass (the file's validation refuses such an expectation).
          const pass =
            !result.sizeMismatch && result.failedPixels === 0 && result.pixels.length > 0;
          if (!pass) failed = true;
          results.push({
            ...common,
            kind: "expect",
            actualSize: result.actualSize,
            expectedSize: result.expectedSize,
            sizeMismatch: result.sizeMismatch,
            pixels: result.pixels,
            failedPixels: result.failedPixels,
            pass,
            images: { actual: relativeImage(`${stem}.actual.png`) },
          });
          continue;
        }

        const { reference } = comparison;
        const refScale = reference.scale ?? 2;
        const expected = await loadReferenceCrop(reference, scale);
        const result = await compareImages(actualPng, expected, {
          masks: comparison.masks,
          scale,
          threshold: comparison.threshold ?? PIXEL_THRESHOLD,
        });

        await writeFile(`${stem}.actual.png`, result.actualPng);
        await writeFile(`${stem}.expected.png`, result.expectedPng);
        await writeFile(`${stem}.diff.png`, result.diffPng);
        await writeFile(`${stem}.compare.png`, await compositeSheet(result, scale));

        // Two gates. The mismatch fraction ignores differences under the per-pixel threshold,
        // so a whole surface that is a few levels off scores 0%; the delta budget gates that.
        const budget = comparison.budget[`${scale}x`];
        const deltaBudget = comparison.deltaBudget[`${scale}x`];
        const gated = !options["no-budget"];
        const overBudget = gated && result.mismatch > budget;
        const overDelta = gated && result.meanDelta > deltaBudget;
        // A third gate, on the budget itself: at 2x it may not sit further above the score than
        // the accepted slack, or a change of shape the size of that gap would pass unnoticed.
        // It fails the calibration run and is printed in every other (slackVerdict).
        const { slack, fails: slackBudget } = slackVerdict({
          budget,
          score: result.mismatch,
          scale,
          gated,
          browser: options.browser,
          platform: process.platform,
        });
        const pass = !result.sizeMismatch && !overBudget && !overDelta && !slackBudget;
        if (!pass) failed = true;

        results.push({
          ...common,
          kind: "reference",
          reference: reference.file,
          crop: reference.crop,
          resampledReference: scale !== refScale,
          width: result.width,
          height: result.height,
          actualSize: result.actualSize,
          expectedSize: result.expectedSize,
          sizeMismatch: result.sizeMismatch,
          threshold: result.threshold,
          mismatch: result.mismatch,
          mismatchedPixels: result.mismatchedPixels,
          comparedPixels: result.comparedPixels,
          meanDelta: result.meanDelta,
          budget,
          deltaBudget,
          gated,
          overBudget,
          overDelta,
          slack,
          slackBudget,
          highestBudget: scale === 2 ? highestBudget(result.mismatch) : undefined,
          pass,
          images: Object.fromEntries(
            ["actual", "expected", "diff", "compare"].map((kind) => [
              kind,
              relativeImage(`${stem}.${kind}.png`),
            ]),
          ),
        });
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}

results.sort((a, b) => a.id.localeCompare(b.id, "en") || a.scale - b.scale);
await writeReport(outDir, results, { browser: options.browser, version: browserVersion });

const pct = (n) => `${(n * 100).toFixed(2)}%`;
const sizes = (r) =>
  ` actual ${r.actualSize.width}x${r.actualSize.height} vs expected ${r.expectedSize.width}x${r.expectedSize.height}`;
console.log(`\nVisual comparisons (${options.browser} ${browserVersion})\n`);
for (const r of results) {
  // With --no-budget nothing is gated, so nothing is reported as passing.
  const status = (
    r.sizeMismatch
      ? "SIZE"
      : r.overBudget || r.overDelta
        ? "FAIL"
        : r.slackBudget
          ? "SLACK"
          : !r.pass
            ? "FAIL"
            : r.kind === "reference" && !r.gated
              ? "info"
              : "ok"
  ).padEnd(5);
  const label = `${r.id}@${r.scale}x`.padEnd(48);
  if (r.kind === "expect") {
    console.log(
      `${status}  ${label} ${r.pixels.length - r.failedPixels}/${r.pixels.length} expected pixels${r.sizeMismatch ? sizes(r) : ""}`,
    );
    for (const pixel of r.pixels.filter((p) => !p.pass)) {
      console.log(
        `        at ${pixel.x},${pixel.y}: ${pixel.actual ?? "outside the capture"}, expected ${pixel.color} ±${pixel.tolerance} (${pixel.note})`,
      );
    }
    continue;
  }
  console.log(
    `${status}  ${label} mismatch ${pct(r.mismatch).padStart(7)} (budget ${pct(r.budget)})  mean Δ ${r.meanDelta.toFixed(2)}/255 (budget ${r.deltaBudget.toFixed(2)})${r.sizeMismatch ? sizes(r) : ""}`,
  );
  if (r.slack && r.gated) {
    // A slack budget passed validation, so it is within its tier's cap, and the highest accepted
    // budget is below it: the figure printed here can be copied in without meeting a cap. The
    // line names the file, the comparison and both values, so it can be acted on by itself.
    console.log(
      `        ${r.spec}, comparison "${r.name}": budget["2x"] is ${r.budget} (${pct(r.budget)}), more than the accepted slack above the score ${pct(r.mismatch)}. Lower it to at most ${r.highestBudget}; change nothing else${r.slackBudget ? "" : " (not enforced: budgets are set from Chromium on Linux)"}`,
    );
  }
}
const slackCount = results.filter((r) => r.slackBudget).length;
if (slackCount > 0) {
  console.log(
    `\n${slackCount} comparison(s) have a 2x budget too far above the score to notice a change of shape (SLACK): the run fails. For each one, lower budget["2x"] in the named *.visual.json file to at most the value printed with it (a fraction, as the file holds it; about 0.0005 above the score leaves room on both sides). Do not raise a budget, add a mask or change the drawing to pass this rule. See "Budgets" in docs/content/visual-comparison.mdx.`,
  );
}
if (options["no-budget"]) {
  console.log("\n--no-budget: scores are reported, budgets are not enforced.");
}
if (invalid.length > 0) {
  console.log(
    `\n${invalid.length} problem(s) in visual comparison files listed above: those files were not run, and the run fails.`,
  );
}
console.log(
  `\nReport: ${path.join(outDir, "report.html")}\n        ${path.join(outDir, "report.json")}`,
);
process.exit(failed ? 1 : 0);
