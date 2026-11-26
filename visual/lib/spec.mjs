// Validation of <folder>.visual.json, shared by the runner (visual/run.mjs) and the convention
// check (scripts/check-conventions.mjs). The rules are the ones in visual/visual.schema.json
// plus the ones a JSON schema cannot say; keep the two files in step.
//
// The point of most rules is that a comparison must be able to fail: it has a budget for every
// scale, the budget is not so large that anything passes, a misspelt key is an error rather
// than a silently missing gate, and masks cannot cover the whole picture.

export const SCALES = ["1x", "2x"];
export const WINDOW_STATES = ["key", "main", "inactive"];
export const ACCENTS = ["blue", "purple", "pink", "red", "orange", "yellow", "green", "graphite"];
export const ACTIONS = {
  hover: "string",
  press: "string",
  click: "string",
  tab: "count",
  key: "string",
};

/**
 * Budgets come in two tiers.
 *
 * Tight: what a comparison of the drawing itself must meet. A score above these is not a match
 * that needs a budget; it is a component that is not finished. 1x is looser because its
 * reference is the 2x screenshot averaged down, which cannot reproduce a hairline.
 *
 * Loose: the most any comparison may declare. Text set in the fallback font, off Apple
 * platforms, scores up to about 25% however good the component is, so a comparison that
 * includes text may go above the tight tier, but only next to a companion that scores the same
 * example against the same crop within the tight tier with the text masked (it masks everything
 * the loose one masks, and more). That way every crop is gated tightly by something.
 */
export const BUDGET_CAP = { "1x": 0.25, "2x": 0.1 };
export const DELTA_BUDGET_CAP = { "1x": 16, "2x": 8 };
export const LOOSE_BUDGET_CAP = { "1x": 0.3, "2x": 0.3 };
export const LOOSE_DELTA_BUDGET_CAP = { "1x": 32, "2x": 32 };
/**
 * How far a 2x mismatch budget may sit above the score it gates: a tenth of a percentage
 * point, or three tenths of the score when that is more (text in the fallback font scores a
 * few per cent and moves with the font's rendering; its drawing is gated by the companion that
 * masks the text). A 1 px change of a control's corner radius
 * moves the score of its bezel by 0.2 to 0.5 points, so a budget inside the slack notices it
 * and a budget a flat 0.3 points above a score of 0 does not. The caps above bound a budget
 * without knowing the score; the runner knows it, and applies this at 2x. There is no such
 * rule at 1x: its reference is an average of the 2x screenshot and its scores are several per
 * cent whatever the drawing, so the 1x run gates colour and layout, not corner geometry.
 */
export const BUDGET_SLACK = { points: 0.001, share: 0.3 };
export const budgetSlack = (score) => Math.max(BUDGET_SLACK.points, score * BUDGET_SLACK.share);
/**
 * The highest budget["2x"] the slack rule accepts for a score, as it is written in a
 * *.visual.json file: a fraction, rounded down, so that copying it in passes the rule.
 */
export const highestBudget = (score) => Math.floor((score + budgetSlack(score)) * 1e6) / 1e6;
/** Whether a 2x budget is further above the measured score than the accepted slack. */
export const isSlackBudget = (budget, score) => budget - score > budgetSlack(score) + 1e-9;
/**
 * The calibration run: Chromium on Linux, where text is set in the fallback font. Budgets are
 * set from its scores. Another engine or platform scores the same drawing differently (the
 * push button's 2x bezels score 0.00 to 0.08% in Chromium and 2 to 5% in Firefox on the same
 * machine; text in San Francisco scores below its fallback-font budget), and a file holds one
 * budget, so only here can a budget be held to its score.
 */
export const isCalibrationRun = (browser, platform) =>
  browser === "chromium" && platform === "linux";
/**
 * What the slack rule says of one result: `slack`, the 2x budget is further above this run's
 * score than the accepted slack, which every gated run prints; and `fails`, that fails the
 * run, which it does in the calibration run only. A score above its budget fails in every
 * engine as before; this rule adds a failure and takes none away.
 */
export function slackVerdict({ budget, score, scale, gated, browser, platform }) {
  const slack = scale === 2 && isSlackBudget(budget, score);
  return { slack, fails: slack && gated && isCalibrationRun(browser, platform) };
}
/** Per-pixel colour distance (pixelmatch, 0..1) above which a pixel counts as mismatched. */
export const DEFAULT_THRESHOLD = 0.1;
export const THRESHOLD_RANGE = [0.01, 0.1];
/**
 * Masks hide text set in a fallback font, not the control. A crop that is nearly all text may
 * be nearly all masked, but something must be left to compare.
 */
export const MAX_MASKED_FRACTION = 0.75;
/** Largest per-channel tolerance of an expected pixel, in 8-bit levels. */
export const MAX_PIXEL_TOLERANCE = 8;
export const DEFAULT_PIXEL_TOLERANCE = 2;

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

function unknownKeys(object, allowed, where, errors) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      errors.push(`${where}: unknown key "${key}" (allowed: ${allowed.join(", ")})`);
    }
  }
}

function checkRect(rect, where, errors, { integers }) {
  if (!isObject(rect)) return errors.push(`${where} must be an object with x, y, width, height`);
  unknownKeys(rect, ["x", "y", "width", "height"], where, errors);
  for (const key of ["x", "y", "width", "height"]) {
    const value = rect[key];
    const minimum = key === "x" || key === "y" ? 0 : integers ? 1 : Number.MIN_VALUE;
    if (!isNumber(value) || value < minimum || (integers && !Number.isInteger(value))) {
      errors.push(
        `${where}.${key} must be ${integers ? "an integer" : "a number"} of at least ${minimum === Number.MIN_VALUE ? "more than 0" : minimum}`,
      );
    }
  }
}

/** Budgets for both scales, each a number within [0, cap]. */
function checkBudget(value, key, cap, where, errors) {
  if (!isObject(value)) {
    return errors.push(
      `${where}: "${key}" is required, with a value for 1x and 2x; without it the comparison cannot fail`,
    );
  }
  unknownKeys(value, SCALES, `${where}.${key}`, errors);
  for (const scale of SCALES) {
    const budget = value[scale];
    if (!isNumber(budget) || budget < 0) {
      errors.push(`${where}: ${key}["${scale}"] is required and must be a number of at least 0`);
    } else if (budget > cap[scale]) {
      errors.push(
        `${where}: ${key}["${scale}"] is ${budget}, above the highest accepted budget ${cap[scale]}; a score that needs it is not a match`,
      );
    }
  }
}

function checkReference(comparison, where, errors) {
  const { reference } = comparison;
  if (!isObject(reference)) return errors.push(`${where}: "reference" must be an object`);
  unknownKeys(reference, ["file", "crop", "scale", "matte"], `${where}.reference`, errors);
  if (typeof reference.file !== "string" || reference.file === "") {
    errors.push(`${where}: reference.file is required`);
  } else if (/[\\/]|^\.\.?$/.test(reference.file)) {
    errors.push(`${where}: reference.file is a file name in reference/screenshots/, not a path`);
  }
  const scale = reference.scale ?? 2;
  if (scale !== 1 && scale !== 2) errors.push(`${where}: reference.scale must be 1 or 2`);
  if (reference.matte !== undefined && !HEX.test(reference.matte)) {
    errors.push(`${where}: reference.matte must be a colour written as #rrggbb`);
  }
  const before = errors.length;
  checkRect(reference.crop, `${where}: reference.crop`, errors, { integers: true });
  const cropIsValid = errors.length === before;
  if (cropIsValid && (reference.crop.width % scale || reference.crop.height % scale)) {
    errors.push(
      `${where}: crop ${reference.crop.width}x${reference.crop.height} is not a multiple of the reference scale ${scale}`,
    );
  }

  checkBudget(comparison.budget, "budget", LOOSE_BUDGET_CAP, where, errors);
  checkBudget(comparison.deltaBudget, "deltaBudget", LOOSE_DELTA_BUDGET_CAP, where, errors);

  if (comparison.threshold !== undefined) {
    const [low, high] = THRESHOLD_RANGE;
    if (
      !isNumber(comparison.threshold) ||
      comparison.threshold < low ||
      comparison.threshold > high
    ) {
      errors.push(`${where}: threshold must be a number from ${low} to ${high}`);
    }
  }

  if (comparison.masks !== undefined) {
    if (!Array.isArray(comparison.masks)) return errors.push(`${where}: masks must be an array`);
    const beforeMasks = errors.length;
    comparison.masks.forEach((mask, index) => {
      checkRect(mask, `${where}: masks[${index}]`, errors, { integers: false });
    });
    if (cropIsValid && errors.length === beforeMasks) {
      // Measured as the runner applies them: rounded to device pixels, at each device scale.
      // A mask of 0.75 points on a crop one point wide is 75% of the area and every pixel of it.
      for (const deviceScale of [1, 2]) {
        const fraction = rasterMaskedFraction(
          comparison.masks,
          reference.crop.width / scale,
          reference.crop.height / scale,
          deviceScale,
        );
        if (fraction > MAX_MASKED_FRACTION) {
          errors.push(
            `${where}: masks cover ${(fraction * 100).toFixed(0)}% of the crop's pixels at ${deviceScale}x; at most ${MAX_MASKED_FRACTION * 100}% may be left out of the score`,
          );
          break;
        }
      }
    }
  }
}

/**
 * Whether a run filtered by `filter` asks for the comparisons of `folder`, for a visual file
 * whose comparison names cannot be read because it is not JSON. The runner matches the filter
 * against "<folder>/<comparison name>": with a slash in it, the text before the slash has to
 * end the folder name; without one, the folder is asked for when its name holds the filter.
 * A folder that is not asked for must not stop the run with its unfinished file.
 */
export function filterCouldSelectFolder(filter, folder) {
  if (!filter) return true;
  const slash = filter.indexOf("/");
  return slash === -1 ? folder.includes(filter) : folder.endsWith(filter.slice(0, slash));
}

/** Whether both budgets of a reference comparison are within the tight tier at both scales. */
function isTight(comparison) {
  return SCALES.every(
    (scale) =>
      isNumber(comparison.budget?.[scale]) &&
      comparison.budget[scale] <= BUDGET_CAP[scale] &&
      isNumber(comparison.deltaBudget?.[scale]) &&
      comparison.deltaBudget[scale] <= DELTA_BUDGET_CAP[scale],
  );
}

/**
 * Everything that decides which pixels are captured and what they are compared with, defaults
 * written out. Two comparisons are of the same subject only when all of it is equal; masks,
 * threshold and budgets are what may differ between a loose comparison and its tight companion.
 */
const cropOf = (reference) =>
  isObject(reference?.crop)
    ? [reference.crop.x, reference.crop.y, reference.crop.width, reference.crop.height]
    : null;

const subjectOf = (comparison) =>
  JSON.stringify([
    comparison.example,
    comparison.appearance,
    comparison.accent ?? "blue",
    comparison.highlight ?? null,
    comparison.windowState ?? "key",
    comparison.selector ?? "#visual-root",
    comparison.actions ?? [],
    comparison.forcedColors ?? false,
    comparison.reference?.file,
    cropOf(comparison.reference),
    comparison.reference?.scale ?? 2,
    (comparison.reference?.matte ?? "#ffffff").toLowerCase(),
  ]);

const sameSubject = (a, b) => subjectOf(a) === subjectOf(b);

/**
 * The most device pixels a crop is rasterised to for the companion check. A reference screenshot
 * is at most 5120 x 2880; a crop that claims more than this is malformed, and is reported by the
 * crop's own checks, not by an allocation that fails.
 */
const MAX_RASTER_PIXELS = 64_000_000;

/**
 * The 2x device pixels of a reference comparison's crop that its masks leave out of the score,
 * as one byte per pixel, rasterised as the runner applies them. Nothing is masked when the
 * comparison has no usable masks; null when its crop or scale cannot be read as a raster.
 */
function maskedPixels(comparison) {
  const { masks, reference } = comparison;
  if (!cropOf(reference)?.every(isNumber)) return null;
  const scale = reference.scale ?? 2;
  if (!isNumber(scale) || !(scale > 0)) return null;
  const width = Math.round((reference.crop.width / scale) * 2);
  const height = Math.round((reference.crop.height / scale) * 2);
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_RASTER_PIXELS
  ) {
    return null;
  }
  const pixels = new Uint8Array(width * height);
  const usable =
    Array.isArray(masks) &&
    masks.every(
      (mask) => isObject(mask) && ["x", "y", "width", "height"].every((key) => isNumber(mask[key])),
    );
  if (!usable) return pixels;
  for (const mask of masks) {
    const [x0, y0, x1, y1] = maskPixels(mask, 2);
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
      pixels.fill(1, y * width + Math.max(0, x0), y * width + Math.max(0, Math.min(width, x1)));
    }
  }
  return pixels;
}

/**
 * Whether `companion` leaves out every pixel that `comparison` leaves out, and more. Masking a
 * larger area somewhere else does not count: the pixels the loose comparison scores loosely and
 * the companion masks would be gated tightly by nothing.
 */
function masksMoreThan(companion, comparison) {
  const more = maskedPixels(companion);
  const fewer = maskedPixels(comparison);
  if (!more || !fewer || more.length !== fewer.length) return false;
  let extra = false;
  for (let i = 0; i < more.length; i++) {
    if (fewer[i] && !more[i]) return false;
    if (more[i] && !fewer[i]) extra = true;
  }
  return extra;
}

/**
 * A comparison above the tight tier needs a tight companion on the same example and crop that
 * masks everything it masks, and more. The loose tier exists for text in the fallback font, so
 * the companion is the comparison that leaves the text out; a tight comparison that masks no
 * more than the loose one scores the same pixels, and would let a masked comparison of the
 * drawing raise its own budget to the loose cap with the unmasked one as its excuse.
 */
function checkTiers(comparisons, errors) {
  const references = comparisons.filter(
    (comparison) => isObject(comparison) && isObject(comparison.reference),
  );
  for (const comparison of references) {
    if (!isObject(comparison.budget) || !isObject(comparison.deltaBudget)) continue;
    if (isTight(comparison)) continue;
    const companion = references.some(
      (other) =>
        other !== comparison &&
        sameSubject(other, comparison) &&
        isTight(other) &&
        masksMoreThan(other, comparison),
    );
    if (!companion) {
      errors.push(
        `comparison "${comparison.name}": its budgets are above the tight tier (budget ${BUDGET_CAP["1x"]} at 1x and ${BUDGET_CAP["2x"]} at 2x, deltaBudget ${DELTA_BUDGET_CAP["1x"]} and ${DELTA_BUDGET_CAP["2x"]}); that is accepted only for text in the fallback font, next to a comparison of the same example and crop that masks the text (everything this one masks, and more) and is within it`,
      );
    }
  }
}

/** Fraction of a width x height area (in points) covered by the union of the masks. */
export function maskedFraction(masks, width, height) {
  // Coordinate compression: exact for overlapping rectangles, and the lists are tiny.
  const clamp = (value, max) => Math.min(Math.max(value, 0), max);
  const rects = masks.map((mask) => ({
    x0: clamp(mask.x, width),
    x1: clamp(mask.x + mask.width, width),
    y0: clamp(mask.y, height),
    y1: clamp(mask.y + mask.height, height),
  }));
  const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.y0, r.y1]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < ys.length; j++) {
      const covered = rects.some(
        (r) => r.x0 <= xs[i] && r.x1 >= xs[i + 1] && r.y0 <= ys[j] && r.y1 >= ys[j + 1],
      );
      if (covered) area += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
    }
  }
  return width > 0 && height > 0 ? area / (width * height) : 1;
}

/**
 * The device pixels a mask given in points covers at `scale` device pixels per point, as
 * [x0, y0, x1, y1] with the far edges exclusive. The runner masks exactly these pixels.
 */
export function maskPixels(mask, scale) {
  return [
    Math.round(mask.x * scale),
    Math.round(mask.y * scale),
    Math.round((mask.x + mask.width) * scale),
    Math.round((mask.y + mask.height) * scale),
  ];
}

/** Fraction of the device pixels of a width x height crop (in points) that the masks cover. */
export function rasterMaskedFraction(masks, width, height, scale) {
  const rects = masks.map((mask) => {
    const [x0, y0, x1, y1] = maskPixels(mask, scale);
    return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
  });
  return maskedFraction(rects, Math.round(width * scale), Math.round(height * scale));
}

function checkExpect(comparison, where, errors) {
  const { expect } = comparison;
  if (!isObject(expect)) return errors.push(`${where}: "expect" must be an object`);
  unknownKeys(expect, ["size", "pixels"], `${where}.expect`, errors);
  for (const key of ["budget", "deltaBudget", "masks", "threshold"]) {
    if (comparison[key] !== undefined) {
      errors.push(`${where}: "${key}" belongs to a comparison with a reference, not to "expect"`);
    }
  }
  if (expect.size !== undefined) {
    if (!isObject(expect.size)) errors.push(`${where}: expect.size must be { width, height }`);
    else {
      unknownKeys(expect.size, ["width", "height"], `${where}.expect.size`, errors);
      for (const key of ["width", "height"]) {
        if (!isNumber(expect.size[key]) || expect.size[key] <= 0) {
          errors.push(`${where}: expect.size.${key} must be a number of points above 0`);
        }
      }
    }
  }
  if (!Array.isArray(expect.pixels) || expect.pixels.length === 0) {
    return errors.push(`${where}: expect.pixels must list at least one pixel`);
  }
  // A pixel with a scale is checked at that scale only. If every pixel has the same one, the
  // run at the other scale would check nothing and pass whatever was captured.
  for (const scale of [1, 2]) {
    const applies = expect.pixels.some(
      (pixel) => isObject(pixel) && (pixel.scale === undefined || pixel.scale === scale),
    );
    if (!applies) {
      errors.push(
        `${where}: no expected pixel is checked at ${scale}x (every pixel has "scale": ${scale === 1 ? 2 : 1}), so that run could not fail; add a pixel without "scale" or one for ${scale}x`,
      );
    }
  }
  expect.pixels.forEach((pixel, index) => {
    const at = `${where}: expect.pixels[${index}]`;
    if (!isObject(pixel)) {
      errors.push(`${at} must be an object`);
      return;
    }
    unknownKeys(pixel, ["x", "y", "color", "tolerance", "scale", "note"], at, errors);
    if (pixel.scale !== undefined && pixel.scale !== 1 && pixel.scale !== 2) {
      errors.push(`${at}.scale must be 1 or 2: the one device scale the pixel is checked at`);
    }
    for (const key of ["x", "y"]) {
      if (!isNumber(pixel[key]) || pixel[key] < 0) {
        errors.push(`${at}.${key} must be a number of points of at least 0`);
      }
    }
    if (typeof pixel.color !== "string" || !HEX.test(pixel.color)) {
      errors.push(`${at}.color must be written as #rrggbb`);
    }
    if (
      pixel.tolerance !== undefined &&
      (!Number.isInteger(pixel.tolerance) ||
        pixel.tolerance < 0 ||
        pixel.tolerance > MAX_PIXEL_TOLERANCE)
    ) {
      errors.push(`${at}.tolerance must be an integer from 0 to ${MAX_PIXEL_TOLERANCE}`);
    }
    if (typeof pixel.note !== "string" || pixel.note.trim() === "") {
      errors.push(`${at}.note is required: say where the expected colour comes from`);
    }
  });
}

const COMPARISON_KEYS = [
  "name",
  "description",
  "example",
  "appearance",
  "accent",
  "highlight",
  "windowState",
  "selector",
  "actions",
  "forcedColors",
  "reference",
  "expect",
  "masks",
  "threshold",
  "budget",
  "deltaBudget",
];

function checkComparison(comparison, index, errors) {
  if (!isObject(comparison)) return errors.push(`comparisons[${index}] must be an object`);
  const where = `comparison "${typeof comparison.name === "string" ? comparison.name : `#${index}`}"`;
  unknownKeys(comparison, COMPARISON_KEYS, where, errors);

  if (typeof comparison.name !== "string" || !KEBAB.test(comparison.name)) {
    errors.push(`${where}: name is required and must be kebab-case`);
  }
  if (comparison.description !== undefined && typeof comparison.description !== "string") {
    errors.push(`${where}: description must be a string`);
  }
  if (typeof comparison.example !== "string" || !KEBAB.test(comparison.example)) {
    errors.push(`${where}: example is required: a file name in examples/, without extension`);
  }
  if (comparison.appearance !== "light" && comparison.appearance !== "dark") {
    errors.push(`${where}: appearance must be "light" or "dark"`);
  }
  for (const key of ["accent", "highlight"]) {
    if (comparison[key] !== undefined && !ACCENTS.includes(comparison[key])) {
      errors.push(`${where}: ${key} must be one of ${ACCENTS.join(", ")}`);
    }
  }
  if (comparison.windowState !== undefined && !WINDOW_STATES.includes(comparison.windowState)) {
    errors.push(`${where}: windowState must be "key", "main" or "inactive"`);
  }
  if (
    comparison.selector !== undefined &&
    (typeof comparison.selector !== "string" || comparison.selector === "")
  ) {
    errors.push(`${where}: selector must be a non-empty string`);
  }
  if (comparison.actions !== undefined) {
    if (!Array.isArray(comparison.actions)) errors.push(`${where}: actions must be an array`);
    else {
      comparison.actions.forEach((action, i) => {
        const keys = isObject(action) ? Object.keys(action) : [];
        const [kind] = keys;
        if (keys.length !== 1 || !Object.hasOwn(ACTIONS, kind)) {
          errors.push(
            `${where}: actions[${i}] must have exactly one of ${Object.keys(ACTIONS).join(", ")}`,
          );
          return;
        }
        const value = action[kind];
        const valid =
          ACTIONS[kind] === "count"
            ? Number.isInteger(value) && value >= 1
            : typeof value === "string" && value !== "";
        if (!valid) {
          errors.push(
            `${where}: actions[${i}].${kind} must be ${ACTIONS[kind] === "count" ? "an integer of at least 1" : "a non-empty string"}`,
          );
        }
      });
    }
  }

  if (comparison.forcedColors !== undefined) {
    if (typeof comparison.forcedColors !== "boolean") {
      errors.push(`${where}: forcedColors must be true or false`);
    } else if (comparison.forcedColors && comparison.reference !== undefined) {
      // No Catalina screenshot was taken in a forced-colours mode.
      errors.push(
        `${where}: forcedColors goes with "expect", not with "reference": no screenshot shows forced colours`,
      );
    }
  }

  const hasReference = comparison.reference !== undefined;
  const hasExpect = comparison.expect !== undefined;
  if (hasReference === hasExpect) {
    errors.push(
      `${where}: give either "reference" (a crop of a screenshot) or "expect" (pixels of a state no screenshot shows), not ${hasReference ? "both" : "neither"}`,
    );
  } else if (hasReference) checkReference(comparison, where, errors);
  else checkExpect(comparison, where, errors);
}

/**
 * Every problem in one parsed <folder>.visual.json, as a list of messages; empty when valid.
 * It does not look at the file system: whether the example and the screenshot exist is checked
 * by the callers, which know where they are.
 */
export function validateVisualSpec(spec) {
  const errors = [];
  if (!isObject(spec)) return ['the file must hold an object with a "comparisons" array'];
  unknownKeys(spec, ["$schema", "comparisons", "pending", "noReference"], "file", errors);
  if (!Array.isArray(spec.comparisons)) {
    errors.push('"comparisons" is required and must be an array');
    return errors;
  }
  if (
    spec.pending !== undefined &&
    (typeof spec.pending !== "string" || spec.pending.trim() === "")
  ) {
    errors.push('"pending" must say, in a sentence, why there is no comparison yet');
  }

  const names = new Set();
  spec.comparisons.forEach((comparison, index) => {
    checkComparison(comparison, index, errors);
    if (isObject(comparison) && typeof comparison.name === "string") {
      if (names.has(comparison.name))
        errors.push(`comparison "${comparison.name}": duplicate name`);
      names.add(comparison.name);
    }
  });

  checkTiers(spec.comparisons, errors);

  const noReference = spec.noReference ?? {};
  if (!isObject(noReference)) errors.push('"noReference" must be an object');
  else {
    unknownKeys(noReference, ["light", "dark"], "noReference", errors);
    for (const [appearance, reason] of Object.entries(noReference)) {
      if (typeof reason !== "string" || reason.trim() === "") {
        errors.push(`noReference.${appearance} must say why no screenshot can be used`);
      }
    }
    if (typeof noReference.light === "string" && typeof noReference.dark === "string") {
      errors.push(
        'noReference names both appearances; a folder with no comparison at all uses "pending"',
      );
    }
  }

  // A finished folder is compared with a screenshot in each appearance. "pending" is the
  // explicit, visible way to say that it is not finished, and "noReference" that the
  // screenshots do not show the control in one appearance.
  if (spec.pending === undefined) {
    for (const appearance of ["light", "dark"]) {
      const covered = spec.comparisons.some(
        (comparison) =>
          isObject(comparison) &&
          comparison.appearance === appearance &&
          comparison.reference !== undefined,
      );
      const excused = isObject(noReference) && typeof noReference[appearance] === "string";
      if (covered && excused) {
        errors.push(
          `noReference.${appearance} is set, but a comparison uses a ${appearance} screenshot; remove one of the two`,
        );
      }
      if (!covered && !excused) {
        errors.push(
          `no comparison with a reference screenshot in the ${appearance} appearance; add one, set "noReference": { "${appearance}": "<why>" } if no screenshot shows the control, or set "pending" while the folder is unfinished`,
        );
      }
    }
  } else if (spec.comparisons.length > 0 && isObject(noReference) && spec.noReference) {
    errors.push('"pending" and "noReference" do not go together');
  }
  return errors;
}
