// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Ajv from "ajv";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { averageBlocks, compareImages } from "../visual/lib/compare.mjs";
import { writeReport } from "../visual/lib/report.mjs";
import {
  budgetSlack,
  filterCouldSelectFolder,
  highestBudget,
  isCalibrationRun,
  isSlackBudget,
  maskedFraction,
  slackVerdict,
  validateVisualSpec,
} from "../visual/lib/spec.mjs";

describe("filterCouldSelectFolder", () => {
  // A file that is not JSON stops a run only when its folder was asked for.
  it.each([
    [undefined, "checkbox", true],
    ["push-button", "push-button", true],
    ["button", "push-button", true],
    ["push-button", "checkbox", false],
    ["push-button/dialog-buttons-light", "push-button", true],
    ["button/dialog", "push-button", true],
    ["push-button/dialog-buttons-light", "checkbox", false],
    ["push/dialog", "push-button", false],
  ])("filter %s, folder %s: %s", (filter, folder, expected) => {
    expect(filterCouldSelectFolder(filter, folder)).toBe(expected);
  });
});

/**
 * The rules that make a visual comparison able to fail (visual/lib/spec.mjs), applied by the
 * runner and by lint. Each case below once passed both with the bezel deleted.
 */
const reference = {
  file: "shot.png",
  crop: { x: 0, y: 0, width: 200, height: 40 },
};
const budgets = { budget: { "1x": 0.05, "2x": 0.01 }, deltaBudget: { "1x": 4, "2x": 1 } };
const comparison = (appearance: string, extra: Record<string, unknown> = {}) => ({
  name: `row-${appearance}`,
  example: "visual-row",
  appearance,
  reference,
  ...budgets,
  ...extra,
});
const spec = (light: Record<string, unknown> = {}, more: unknown[] = []) => ({
  comparisons: [comparison("light", light), comparison("dark"), ...more],
});

describe("validateVisualSpec", () => {
  it("accepts a comparison per appearance with both budgets", () => {
    expect(validateVisualSpec(spec())).toEqual([]);
  });

  it.each([
    ["no budget", { budget: undefined }, /"budget" is required/],
    ["no deltaBudget", { deltaBudget: undefined }, /"deltaBudget" is required/],
    ["a misspelt key", { budget: undefined, budgets: budgets.budget }, /unknown key "budgets"/],
    ["a budget for one scale only", { budget: { "1x": 0.05 } }, /budget\["2x"\] is required/],
    ["a budget nothing can exceed", { budget: { "1x": 1, "2x": 1 } }, /above the highest accepted/],
    ["a budget of the wrong type", { deltaBudget: { "1x": "4", "2x": 1 } }, /must be a number/],
    [
      "masks over the whole crop",
      { masks: [{ x: 0, y: 0, width: 100, height: 20 }] },
      /masks cover 100% of the crop/,
    ],
    [
      // 75% of the area, but rounded to device pixels it is the crop's only column at 1x.
      "a mask that rounds up to every pixel",
      {
        reference: { ...reference, crop: { x: 0, y: 0, width: 2, height: 2 } },
        masks: [{ x: 0, y: 0, width: 0.75, height: 1 }],
      },
      /masks cover 100% of the crop's pixels at 1x/,
    ],
    ["an unknown action", { actions: [{ doubleClick: "button" }] }, /exactly one of hover/],
    ["an unknown window state", { windowState: "active" }, /windowState must be/],
    ["a threshold that hides everything", { threshold: 0.9 }, /threshold must be/],
    [
      "a crop that is not a multiple of the scale",
      { reference: { ...reference, crop: { x: 0, y: 0, width: 201, height: 40 } } },
      /not a multiple of the reference scale/,
    ],
    ["a reference path", { reference: { ...reference, file: "../shot.png" } }, /not a path/],
  ])("rejects %s", (_, change, message) => {
    const errors = validateVisualSpec(spec(change));
    expect(errors.join("\n")).toMatch(message);
  });

  it("accepts a loose budget only beside a tight comparison of the same crop", () => {
    const loose = { budget: { "1x": 0.25, "2x": 0.2 }, deltaBudget: { "1x": 16, "2x": 20 } };
    expect(validateVisualSpec(spec(loose)).join("\n")).toMatch(/above the tight tier/);
    const masked = comparison("light", {
      name: "row-light-masked",
      masks: [{ x: 10, y: 5, width: 40, height: 10 }],
    });
    expect(validateVisualSpec(spec(loose, [masked]))).toEqual([]);
    // A tight comparison of another crop does not count.
    const elsewhere = comparison("light", {
      name: "other-light",
      reference: { ...reference, crop: { x: 10, y: 0, width: 200, height: 40 } },
    });
    expect(validateVisualSpec(spec(loose, [elsewhere])).join("\n")).toMatch(/tight tier/);
  });

  it("counts a tight comparison as the companion only when it masks all the loose one masks, and more", () => {
    // The hole this closes: the comparison of the drawing, text masked, raises its budget to
    // the loose cap and names the unmasked comparison of the same crop as its excuse.
    const text = { x: 10, y: 5, width: 40, height: 10 };
    const drawing = comparison("light", {
      name: "row-light-bezel",
      masks: [text],
      budget: { "1x": 0.25, "2x": 0.3 },
    });
    const errors = validateVisualSpec(spec({}, [drawing])).join("\n");
    expect(errors).toMatch(/comparison "row-light-bezel": its budgets are above the tight tier/);
    expect(errors).toMatch(/masks the text/);
    // The same masks on both score the same pixels: neither is the other's companion.
    const loose = { budget: { "1x": 0.25, "2x": 0.2 }, deltaBudget: { "1x": 16, "2x": 20 } };
    const twin = comparison("light", { name: "row-light-twin", masks: [text] });
    expect(validateVisualSpec(spec({ ...loose, masks: [text] }, [twin])).join("\n")).toMatch(
      /tight tier/,
    );
    // A companion that masks more than a partly masked loose comparison counts.
    const more = comparison("light", {
      name: "row-light-more",
      masks: [text, { x: 60, y: 5, width: 30, height: 10 }],
    });
    expect(validateVisualSpec(spec({ ...loose, masks: [text] }, [more]))).toEqual([]);
    // A larger mask somewhere else does not: the loose comparison's text is masked, the
    // companion masks part of the drawing instead, and that part would be gated by nothing.
    const elsewhere = comparison("light", {
      name: "row-light-elsewhere",
      masks: [{ x: 60, y: 2, width: 38, height: 16 }],
    });
    expect(validateVisualSpec(spec({ ...loose, masks: [text] }, [elsewhere])).join("\n")).toMatch(
      /comparison "row-light": its budgets are above the tight tier/,
    );
    // Nor does one that overlaps the loose comparison's mask without containing it.
    const overlapping = comparison("light", {
      name: "row-light-overlapping",
      masks: [{ x: 20, y: 5, width: 60, height: 10 }],
    });
    expect(validateVisualSpec(spec({ ...loose, masks: [text] }, [overlapping])).join("\n")).toMatch(
      /tight tier/,
    );
    // The same pixels written as two rectangles are the same masks, plus one more.
    const split = comparison("light", {
      name: "row-light-split",
      masks: [
        { x: 10, y: 5, width: 20, height: 10 },
        { x: 30, y: 5, width: 20, height: 10 },
        { x: 60, y: 5, width: 30, height: 10 },
      ],
    });
    expect(validateVisualSpec(spec({ ...loose, masks: [text] }, [split]))).toEqual([]);
  });

  it.each([
    ["a reference scale of 0", { ...reference, scale: 0 }],
    ["a negative reference scale", { ...reference, scale: -2 }],
    ["a reference scale that is not a number", { ...reference, scale: "2" }],
    ["an empty crop", { ...reference, crop: { x: 0, y: 0, width: 0, height: 0 } }],
    ["a crop no screenshot holds", { ...reference, crop: { x: 0, y: 0, width: 4e9, height: 4e9 } }],
    ["a crop of infinite size", { ...reference, crop: { x: 0, y: 0, width: 1e308, height: 40 } }],
  ])("reports %s on a loose comparison and its companion instead of failing", (_, malformed) => {
    const loose = { budget: { "1x": 0.25, "2x": 0.2 }, deltaBudget: { "1x": 16, "2x": 20 } };
    const masked = comparison("light", {
      name: "row-light-masked",
      masks: [{ x: 10, y: 5, width: 40, height: 10 }],
      reference: malformed,
    });
    const errors = validateVisualSpec(spec({ ...loose, reference: malformed }, [masked]));
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([
    ["another interaction state", { actions: [{ press: "button" }] }],
    ["another captured element", { selector: ".mac-push-button" }],
    ["another highlight", { highlight: "purple" }],
    ["another accent", { accent: "purple" }],
    ["another window state", { windowState: "inactive" }],
    ["another reference scale", { reference: { ...reference, scale: 1 } }],
    ["another matte", { reference: { ...reference, matte: "#000000" } }],
  ])("does not count a tight comparison of %s as the companion", (_, change) => {
    const loose = { budget: { "1x": 0.25, "2x": 0.2 }, deltaBudget: { "1x": 16, "2x": 20 } };
    const other = comparison("light", {
      name: "other-light",
      masks: [{ x: 10, y: 5, width: 40, height: 10 }],
      ...change,
    });
    expect(validateVisualSpec(spec(loose, [other])).join("\n")).toMatch(/tight tier/);
    // Written-out defaults are the same subject as none.
    const same = comparison("light", {
      name: "same-light",
      masks: [{ x: 10, y: 5, width: 40, height: 10 }],
      accent: "blue",
      windowState: "key",
      selector: "#visual-root",
      actions: [],
      // The crop's keys in another order are the same crop.
      reference: {
        file: reference.file,
        crop: { height: 40, width: 200, y: 0, x: 0 },
        scale: 2,
        matte: "#FFFFFF",
      },
    });
    expect(validateVisualSpec(spec(loose, [same]))).toEqual([]);
  });

  it("requires a screenshot comparison in each appearance, or a stated reason", () => {
    const lightOnly = { comparisons: [comparison("light")] };
    expect(validateVisualSpec(lightOnly).join("\n")).toMatch(/in the dark appearance/);
    expect(
      validateVisualSpec({ ...lightOnly, noReference: { dark: "No dark capture shows it." } }),
    ).toEqual([]);
    expect(validateVisualSpec({ comparisons: [] }).join("\n")).toMatch(/light appearance/);
    expect(validateVisualSpec({ comparisons: [], pending: "Scaffolded." })).toEqual([]);
    expect(validateVisualSpec({ comparisons: [], pending: " " }).join("\n")).toMatch(/pending/);
  });

  it("checks an expectation of pixels instead of a reference", () => {
    const state = {
      name: "pressed-light",
      example: "visual-row",
      appearance: "light",
      actions: [{ press: "button" }],
      expect: {
        size: { width: 100, height: 20 },
        pixels: [{ x: 4, y: 10, color: "#3d88fd", tolerance: 3, note: "measured middle stop" }],
      },
    };
    expect(validateVisualSpec(spec({}, [state]))).toEqual([]);
    const bad = (change: Record<string, unknown>) =>
      validateVisualSpec(spec({}, [{ ...state, ...change }])).join("\n");
    expect(bad({ reference })).toMatch(/not both/);
    expect(bad({ budget: budgets.budget })).toMatch(/belongs to a comparison with a reference/);
    expect(bad({ expect: { pixels: [] } })).toMatch(/at least one pixel/);
    expect(bad({ expect: { pixels: [{ x: 4, y: 10, color: "blue", note: "n" }] } })).toMatch(
      /#rrggbb/,
    );
    expect(bad({ expect: { pixels: [{ x: 4, y: 10, color: "#000000" }] } })).toMatch(
      /note is required/,
    );
    expect(
      bad({ expect: { pixels: [{ x: 4, y: 10, color: "#000000", tolerance: 64, note: "n" }] } }),
    ).toMatch(/tolerance must be/);
    // Pixels for one device scale only leave the other run with nothing to check.
    const hairline = { x: 4, y: 10, color: "#000000", note: "hairline", scale: 2 };
    expect(bad({ expect: { pixels: [hairline] } })).toMatch(/no expected pixel is checked at 1x/);
    expect(bad({ expect: { pixels: [hairline, { ...hairline, scale: 1 }] } })).toBe("");
    // Expectations alone do not replace the comparison with a screenshot.
    expect(validateVisualSpec({ comparisons: [state] }).join("\n")).toMatch(/light appearance/);
  });

  it("takes forcedColors as a boolean, and only with an expectation", () => {
    const state = {
      name: "forced-light",
      example: "visual-row",
      appearance: "light",
      forcedColors: true,
      expect: { pixels: [{ x: 4, y: 10, color: "#000000", note: "ButtonText" }] },
    };
    expect(validateVisualSpec(spec({}, [state]))).toEqual([]);
    expect(validateVisualSpec(spec({}, [{ ...state, forcedColors: false }]))).toEqual([]);
    expect(validateVisualSpec(spec({}, [{ ...state, forcedColors: "active" }])).join("\n")).toMatch(
      /forcedColors must be true or false/,
    );
    // No Catalina screenshot shows forced colours.
    expect(validateVisualSpec(spec({ forcedColors: true })).join("\n")).toMatch(
      /forcedColors goes with "expect"/,
    );
    expect(validateVisualSpec(spec({ forcedColors: false }))).toEqual([]);
  });

  it("rejects duplicate names and unknown top-level keys", () => {
    const errors = validateVisualSpec({
      comparison: [],
      comparisons: [comparison("light"), comparison("light"), comparison("dark")],
    }).join("\n");
    expect(errors).toMatch(/duplicate name/);
    expect(errors).toMatch(/unknown key "comparison"/);
  });
});

/**
 * visual/checks holds the harness's own checks, which `npm run visual` runs in the browser.
 * Lint looks at component and demo folders only, so their files are validated here.
 */
describe("the harness's own checks", () => {
  const checks = path.resolve(import.meta.dirname, "../visual/checks");

  it.each(readdirSync(checks))("%s has a valid visual file whose examples exist", (folder) => {
    const file = path.join(checks, folder, `${folder}.visual.json`);
    const json = JSON.parse(readFileSync(file, "utf8"));
    expect(validateVisualSpec(json)).toEqual([]);
    expect(json.comparisons.length).toBeGreaterThan(0);
    for (const comparison of json.comparisons) {
      expect(existsSync(path.join(checks, folder, "examples", `${comparison.example}.tsx`))).toBe(
        true,
      );
    }
  });
});

describe("the slack of a 2x budget over its score", () => {
  it("is a tenth of a point, or three tenths of the score when that is more", () => {
    expect(budgetSlack(0)).toBe(0.001);
    expect(budgetSlack(0.0008)).toBe(0.001);
    expect(budgetSlack(0.0165)).toBeCloseTo(0.00495);
    expect(budgetSlack(0.0908)).toBeCloseTo(0.02724);
  });

  it.each([
    // The budgets of the push button's bezels, 0.05 points above their scores.
    [0.0007, 0.0002, false],
    [0.0013, 0.0008, false],
    // Exactly the slack is accepted.
    [0.001, 0, false],
    [0.0018, 0.0008, false],
    // A flat 0.30 points above a perfect score: a 1 px change of a radius passes under it.
    [0.003, 0, true],
    [0.004, 0.0001, true],
    // The reviewed hole: the bezel's budget raised from 0.07% to 30%.
    [0.3, 0.0002, true],
    // Text in the fallback font: three tenths of the score.
    [0.055, 0.0435, false],
    [0.02145, 0.0165, false],
    [0.0225, 0.0165, true],
  ])("budget %f over a score of %f is slack: %s", (budget, score, slack) => {
    expect(isSlackBudget(budget, score)).toBe(slack);
  });

  it.each([0, 0.0002, 0.000754, 0.0008, 0.0165, 0.0435, 0.0908, 0.123456789])(
    "the highest budget printed for a score of %f passes the rule when it is copied in",
    (score) => {
      const printed = highestBudget(score);
      expect(isSlackBudget(printed, score)).toBe(false);
      // Rounded down, by less than a millionth, and written as a fraction.
      expect(score + budgetSlack(score) - printed).toBeGreaterThanOrEqual(0);
      expect(score + budgetSlack(score) - printed).toBeLessThan(1e-6);
      expect(String(printed)).toMatch(/^0(\.\d{1,6})?$/);
    },
  );

  // The reviewed hole of the bezel: a budget of 30% over a score of 0.02%.
  const loose = { budget: 0.3, score: 0.0002, scale: 2, gated: true };

  it("fails a slack 2x budget in the calibration run, Chromium on Linux", () => {
    expect(isCalibrationRun("chromium", "linux")).toBe(true);
    expect(slackVerdict({ ...loose, browser: "chromium", platform: "linux" })).toEqual({
      slack: true,
      fails: true,
    });
  });

  it.each([
    ["firefox", "linux"],
    ["webkit", "linux"],
    ["chromium", "darwin"],
    ["webkit", "darwin"],
    ["chromium", "win32"],
  ])("reports the same budget in %s on %s without failing the run", (browser, platform) => {
    expect(isCalibrationRun(browser, platform)).toBe(false);
    expect(slackVerdict({ ...loose, browser, platform })).toEqual({ slack: true, fails: false });
  });

  it("says nothing of a budget within the slack, of 1x, or of a run without budgets", () => {
    const run = { browser: "chromium", platform: "linux" };
    expect(slackVerdict({ ...loose, ...run, budget: 0.0012 })).toEqual({
      slack: false,
      fails: false,
    });
    expect(slackVerdict({ ...loose, ...run, scale: 1 })).toEqual({ slack: false, fails: false });
    // --no-budget: the excess is still known, and nothing fails.
    expect(slackVerdict({ ...loose, ...run, gated: false })).toEqual({ slack: true, fails: false });
  });

  // The runner prints the highest budget only for a budget the rule calls slack. That budget
  // passed validation, so it is within its tier's cap, and the printed one is below it:
  // copying it in can only lower a budget, never lift it over a cap.
  it.each([
    [0.1, 0],
    [0.1, 0.0002],
    [0.1, 0.0755],
    [0.3, 0.09],
    [0.3, 0.2299],
    [0.0225, 0.0165],
    [0.003, 0],
  ])(
    "the highest budget printed for a slack budget of %f over a score of %f is below that budget",
    (budget, score) => {
      expect(isSlackBudget(budget, score)).toBe(true);
      expect(highestBudget(score)).toBeLessThan(budget);
      expect(highestBudget(score)).toBeGreaterThanOrEqual(score);
    },
  );
});

/**
 * visual/visual.schema.json is what an editor applies while a file is written; the runner and
 * lint apply visual/lib/spec.mjs. A file the editor accepts and the run refuses is a trap, so
 * every rule a schema can say is checked here against both.
 */
describe("visual.schema.json", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const schema = JSON.parse(readFileSync(path.join(root, "visual/visual.schema.json"), "utf8"));
  const accepts = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const state = {
    name: "focus-light",
    example: "visual-row",
    appearance: "light",
    expect: { pixels: [{ x: 4, y: 10, color: "#82abf1", note: "spec: focus-ring" }] },
  };

  it.each([
    ["a comparison per appearance", spec()],
    ["an expectation of pixels", spec({}, [state])],
    ["forced colours with an expectation", spec({}, [{ ...state, forcedColors: true }])],
    ["forcedColors: false with a reference", spec({ forcedColors: false })],
    [
      "masks and a threshold",
      spec({ masks: [{ x: 1, y: 1, width: 5, height: 5 }], threshold: 0.05 }),
    ],
  ])("accepts %s, as the validator does", (_, file) => {
    expect(validateVisualSpec(file)).toEqual([]);
    expect(accepts(file), JSON.stringify(accepts.errors)).toBe(true);
  });

  it.each([
    // No screenshot shows forced colours: the editor used to accept this and the run refuse it.
    ["forced colours with a reference", spec({ forcedColors: true })],
    ["forcedColors that is not a boolean", spec({}, [{ ...state, forcedColors: "active" }])],
    ["no budget", spec({ budget: undefined })],
    ["no deltaBudget", spec({ deltaBudget: undefined })],
    ["a misspelt key", spec({ budgets: budgets.budget })],
    ["a budget for one scale only", spec({ budget: { "1x": 0.05 } })],
    ["a budget nothing can exceed", spec({ budget: { "1x": 1, "2x": 1 } })],
    ["a budget of the wrong type", spec({ deltaBudget: { "1x": "4", "2x": 1 } })],
    ["an unknown action", spec({ actions: [{ doubleClick: "button" }] })],
    ["an unknown window state", spec({ windowState: "active" })],
    ["a threshold that hides everything", spec({ threshold: 0.9 })],
    ["a reference path", spec({ reference: { ...reference, file: "../shot.png" } })],
    ["a reference and an expectation", spec({ expect: state.expect })],
    ["neither a reference nor an expectation", spec({}, [{ ...state, expect: undefined }])],
    ["a budget on an expectation", spec({}, [{ ...state, ...budgets }])],
    ["an expectation without pixels", spec({}, [{ ...state, expect: { pixels: [] } }])],
    ["a name that is not kebab-case", spec({ name: "Row Light" })],
    ["an unknown top-level key", { ...spec(), comparison: [] }],
  ])("rejects %s, as the validator does", (_, file) => {
    // JSON has no undefined: a key set to it is a key left out.
    const written = JSON.parse(JSON.stringify(file));
    expect(validateVisualSpec(written)).not.toEqual([]);
    expect(accepts(written)).toBe(false);
  });

  const files = ["src/components", "demos", "visual/checks"].flatMap((base) =>
    existsSync(path.join(root, base))
      ? readdirSync(path.join(root, base))
          .map((folder) => path.join(base, folder, `${folder}.visual.json`))
          .filter((file) => existsSync(path.join(root, file)))
      : [],
  );

  it.each(files)("accepts %s", (file) => {
    const json = JSON.parse(readFileSync(path.join(root, file), "utf8"));
    expect(accepts(json), JSON.stringify(accepts.errors)).toBe(true);
  });
});

describe("compareImages", () => {
  const solid = (width: number, height: number, rgb: [number, number, number]) => ({
    width,
    height,
    data: Buffer.from(Array.from({ length: width * height }, () => [...rgb, 255]).flat()),
  });
  const png = (raw: { data: Buffer; width: number; height: number }) =>
    sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .png()
      .toBuffer();
  const pixels = async (image: Buffer) =>
    (await sharp(image).ensureAlpha().raw().toBuffer()).toString("hex");

  it("leaves the reference and the written images as they are, whatever the masks", async () => {
    const expected = solid(4, 2, [10, 20, 30]);
    const before = Buffer.from(expected.data);
    const actual = solid(4, 2, [200, 20, 30]);
    const result = await compareImages(await png(actual), expected, {
      masks: [{ x: 0, y: 0, width: 2, height: 2 }],
      scale: 1,
    });
    // The masks used to be painted into the caller's buffer and into the images written out.
    expect(expected.data.equals(before)).toBe(true);
    expect(await pixels(result.actualPng)).toBe(actual.data.toString("hex"));
    expect(await pixels(result.expectedPng)).toBe(before.toString("hex"));
    // Half the pixels are masked and out of the score; every other one differs.
    expect(result.comparedPixels).toBe(4);
    expect(result.mismatch).toBe(1);
    // The diff shows where the masks are.
    const diff = await sharp(result.diffPng).ensureAlpha().raw().toBuffer();
    expect([...diff.subarray(0, 4)]).toEqual([255, 0, 255, 255]);
    expect([...diff.subarray(8, 12)]).not.toEqual([255, 0, 255, 255]);
    // A second comparison with the same reference scores the same.
    const again = await compareImages(await png(actual), expected, { scale: 1 });
    expect(again.comparedPixels).toBe(8);
    expect(again.mismatch).toBe(1);
  });
});

describe("the report", () => {
  it("writes image paths as URLs and text as text", async () => {
    const out = mkdtempSync(path.join(tmpdir(), "macalicious-report-"));
    try {
      await writeReport(
        out,
        [
          {
            id: "it's/<b>",
            kind: "expect",
            scale: 2,
            appearance: "light",
            description: "a 'quoted' & <tagged> description",
            pass: true,
            pixels: [],
            failedPixels: 0,
            images: { actual: "folder #1\\100% done?@2x.actual.png" },
          },
        ],
        { browser: "chromium", version: "1" },
      );
      const html = readFileSync(path.join(out, "report.html"), "utf8");
      expect(html).toContain('src="folder%20%231/100%25%20done%3F%402x.actual.png"');
      expect(html).toContain("it&#39;s/&lt;b&gt;");
      expect(html).toContain("a &#39;quoted&#39; &amp; &lt;tagged&gt; description");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("maskedFraction", () => {
  it("counts overlapping masks once and clips them to the crop", () => {
    const masks = [
      { x: 0, y: 0, width: 50, height: 20 },
      { x: 25, y: 0, width: 50, height: 20 },
      { x: 90, y: 10, width: 100, height: 100 },
    ];
    // 75 x 20 plus 10 x 10 of a 100 x 20 crop.
    expect(maskedFraction(masks, 100, 20)).toBeCloseTo((75 * 20 + 10 * 10) / 2000);
  });
});

describe("averageBlocks", () => {
  const image = (width: number, height: number, grey: number[]) => ({
    width,
    height,
    data: Buffer.from(grey.flatMap((value) => [value, value, value, 255])),
  });
  const greys = (raw: { data: Buffer }) => [...raw.data].filter((_, index) => index % 4 === 0);

  it("turns each 2 x 2 block into its mean", () => {
    // A white block between black ones stays white; a one-pixel hairline becomes half.
    const row = [0, 0, 255, 255, 0, 255, 0, 0];
    const half = averageBlocks(image(8, 2, [...row, ...row]), 2);
    expect(half.width).toBe(4);
    expect(half.height).toBe(1);
    expect(greys(half)).toEqual([0, 255, 128, 0]);
  });

  it("refuses a size that is not a multiple of the factor", () => {
    expect(() => averageBlocks(image(3, 2, [0, 0, 0, 0, 0, 0]), 2)).toThrow(/not a multiple/);
  });
});
