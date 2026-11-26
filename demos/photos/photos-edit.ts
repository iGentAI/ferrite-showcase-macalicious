/*
 * Photos' edits: the recipe an edit is, and how a canvas renders it from the original. The
 * recipe is what the library keeps (`ferrite-apps/desktop/src/apps/photos`): quarter turns, a
 * flip, straightening, a crop, light and colour adjustments and a filter. Nothing here changes
 * an original; every render starts from it again, so Revert to Original always works.
 *
 * The adjustments and filters are computed on the pixels (`adjustPixels`), not with a canvas
 * filter, which WebKit does not draw: a photo looks the same in every engine.
 */

/** A crop, as fractions of the turned and straightened picture. */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The light and colour sliders, each from -1 to 1; 0 changes nothing. */
export interface Adjust {
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  warmth: number;
  tint: number;
  brilliance: number;
  black_point: number;
  vibrance: number;
  cast: number;
  definition: number;
  sharpen: number;
  noise: number;
  vignette: number;
  mono: number;
}

/** The filters of the Filters pane, by id, in its order (the module's `FILTERS`). */
export const FILTERS = [
  { id: "none", name: "Original" },
  { id: "vivid", name: "Vivid" },
  { id: "vivid-warm", name: "Vivid Warm" },
  { id: "vivid-cool", name: "Vivid Cool" },
  { id: "dramatic", name: "Dramatic" },
  { id: "dramatic-warm", name: "Dramatic Warm" },
  { id: "dramatic-cool", name: "Dramatic Cool" },
  { id: "mono", name: "Mono" },
  { id: "silvertone", name: "Silvertone" },
  { id: "noir", name: "Noir" },
] as const;

export type FilterId = (typeof FILTERS)[number]["id"];

/** An edit: what the library keeps of one, and what a render draws. */
export interface Edit {
  /** Quarter turns to the left, 0 to 3. */
  rotate: number;
  /** Mirrored left to right, after the turns. */
  flip: boolean;
  /** Degrees to straighten by, -45 to 45; the picture is enlarged so no corner shows. */
  straighten: number;
  /**
   * Perspective, each from -1 to 1, drawn on the turned picture before it is straightened:
   * above 0 Vertical narrows the top and Horizontal narrows the right.
   */
  vertical?: number;
  horizontal?: number;
  crop: Crop | null;
  adjust: Adjust;
  filter: FilterId;
  /** Levels: what becomes black and white, and the midtones' gamma. */
  levels: Levels | null;
  /** Curves: points `[in, out]` from 0 to 1, by rising `in`. */
  curve: readonly (readonly [number, number])[];
  /** Levels and Curves of one colour alone, applied after those of all three. */
  channels?: ChannelTones;
  /** Selective Color: shifts to a range of hues, applied last. */
  selective?: SelectiveShifts;
  /** Retouch and Red-eye: circles on the original, before any turn. */
  spots: readonly Spot[];
  /** Markup's drawn lines, absent when there are none. */
  marks?: readonly MarkStroke[];
  /** The drive file an outside editor saved, which this recipe is drawn on instead of the original. */
  external?: string;
}

/** The hue ranges Selective Color works on, each centred on its hue in degrees. */
export const SELECTIVE_BANDS = [
  { id: "red", name: "Red", hue: 0 },
  { id: "yellow", name: "Yellow", hue: 60 },
  { id: "green", name: "Green", hue: 120 },
  { id: "cyan", name: "Cyan", hue: 180 },
  { id: "blue", name: "Blue", hue: 240 },
  { id: "magenta", name: "Magenta", hue: 300 },
] as const;

export type SelectiveBand = (typeof SELECTIVE_BANDS)[number]["id"];

/** What Selective Color does to one range of hues, each from -1 to 1. */
export interface BandShift {
  hue: number;
  saturation: number;
  luminance: number;
}

export type SelectiveShifts = Partial<Record<SelectiveBand, BandShift>>;

/** The shifts with `band` set to `shift`, or left out when it does nothing; none is no shifts. */
export function withBandShift(
  shifts: SelectiveShifts | undefined,
  band: SelectiveBand,
  shift: BandShift,
): SelectiveShifts | undefined {
  const { [band]: _, ...rest } = shifts ?? {};
  const still = shift.hue !== 0 || shift.saturation !== 0 || shift.luminance !== 0;
  const next: SelectiveShifts = still ? { ...rest, [band]: shift } : rest;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** How far a band's hue reaches each way, in degrees; a pixel between two bands takes from both. */
const BAND_REACH = 60;
/** Degrees the hue moves at a shift of 1. */
const BAND_HUE = 30;
/** Lightness the luminance moves at a shift of 1. */
const BAND_LUMINANCE = 0.25;
/** Below this saturation a pixel counts as gray, and is left less and less alone above it. */
const BAND_GRAY = 0.25;

/** A colour's hue in degrees, and its saturation and lightness from 0 to 1; channels from 0 to 1. */
function hslOf(r: number, g: number, b: number) {
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const chroma = high - low;
  const light = (high + low) / 2;
  if (chroma === 0) return { hue: 0, sat: 0, light };
  const sector =
    high === r
      ? ((g - b) / chroma + 6) % 6
      : high === g
        ? (b - r) / chroma + 2
        : (r - g) / chroma + 4;
  return { hue: sector * 60, sat: chroma / (1 - Math.abs(2 * light - 1) || 1), light };
}

/** Below this saturation a colour has no hue worth naming, for the Selective Color eyedropper. */
const BAND_NO_HUE = 0.08;

/** The range of hues nearest a colour (channels from 0 to 1), or `null` for what is all but gray. */
export function bandOf(r: number, g: number, b: number): SelectiveBand | null {
  const { hue, sat } = hslOf(r, g, b);
  if (sat < BAND_NO_HUE) return null;
  const apart = (centre: number) => Math.abs(((hue - centre + 540) % 360) - 180);
  let nearest: (typeof SELECTIVE_BANDS)[number] = SELECTIVE_BANDS[0];
  for (const band of SELECTIVE_BANDS) {
    if (apart(band.hue) < apart(nearest.hue)) nearest = band;
  }
  return nearest.id;
}

/** Selective Color: each pixel moves by the bands its hue is in; grays stay as they are. */
export function selectPixels(pixels: Pixels, shifts: SelectiveShifts): void {
  const bands = SELECTIVE_BANDS.flatMap((band) => {
    const shift = shifts[band.id];
    return shift ? [{ hue: band.hue, shift }] : [];
  });
  if (bands.length === 0) return;
  const { data } = pixels;
  for (let at = 0; at < data.length; at += 4) {
    const r = (data[at] ?? 0) / 255;
    const g = (data[at + 1] ?? 0) / 255;
    const b = (data[at + 2] ?? 0) / 255;
    if (r === g && g === b) continue;
    const { hue, sat, light } = hslOf(r, g, b);
    const colourful = Math.min(1, sat / BAND_GRAY);
    let toHue = hue;
    let toSat = sat;
    let toLight = light;
    let moved = false;
    for (const { hue: centre, shift } of bands) {
      const apart = Math.abs(((hue - centre + 540) % 360) - 180);
      const weight = Math.max(0, 1 - apart / BAND_REACH) * colourful;
      if (weight === 0) continue;
      moved = true;
      toHue += weight * shift.hue * BAND_HUE;
      toSat *= 1 + weight * shift.saturation;
      toLight += weight * shift.luminance * BAND_LUMINANCE;
    }
    if (!moved) continue;
    const s = clamp(toSat, 0, 1);
    const l = clamp(toLight, 0, 1);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const part = ((toHue % 360) + 360) % 360;
    const x = c * (1 - Math.abs(((part / 60) % 2) - 1));
    const base = l - c / 2;
    const [nr, ng, nb] =
      part < 60
        ? [c, x, 0]
        : part < 120
          ? [x, c, 0]
          : part < 180
            ? [0, c, x]
            : part < 240
              ? [0, x, c]
              : part < 300
                ? [x, 0, c]
                : [c, 0, x];
    data[at] = Math.round((nr + base) * 255);
    data[at + 1] = Math.round((ng + base) * 255);
    data[at + 2] = Math.round((nb + base) * 255);
  }
}

function selectiveFromServer(value: unknown): { selective?: SelectiveShifts } {
  if (!value || typeof value !== "object") return {};
  const given = value as Record<string, Partial<BandShift> | undefined>;
  const shiftOf = (shift: unknown) => clamp(typeof shift === "number" ? shift : 0, -1, 1);
  let selective: SelectiveShifts | undefined;
  for (const { id } of SELECTIVE_BANDS) {
    const shift = given[id];
    if (shift) {
      selective = withBandShift(selective, id, {
        hue: shiftOf(shift.hue),
        saturation: shiftOf(shift.saturation),
        luminance: shiftOf(shift.luminance),
      });
    }
  }
  return selective ? { selective } : {};
}

/** An edit's Levels. */
export interface Levels {
  black: number;
  gamma: number;
  white: number;
}

/** A colour Levels and Curves can work on alone. */
export type ToneChannel = "red" | "green" | "blue";
export const TONE_CHANNELS: readonly ToneChannel[] = ["red", "green", "blue"];

/** One colour's own Levels and Curve. */
export interface ChannelTone {
  levels: Levels | null;
  curve: readonly (readonly [number, number])[];
}

/** The colours with Levels or a Curve of their own. */
export type ChannelTones = Partial<Record<ToneChannel, ChannelTone>>;

/** `tones` with one colour's changed; a colour left with nothing is dropped, and so are no colours. */
export function withChannelTone(
  tones: ChannelTones | undefined,
  channel: ToneChannel,
  tone: ChannelTone,
): ChannelTones | undefined {
  const { [channel]: _before, ...others } = tones ?? {};
  const next: ChannelTones =
    tone.levels === null && tone.curve.length === 0 ? others : { ...others, [channel]: tone };
  return Object.keys(next).length > 0 ? next : undefined;
}

/** A retouched circle, as fractions of the original: of its width, its height, its longer side. */
export interface Spot {
  x: number;
  y: number;
  radius: number;
  kind: "retouch" | "red-eye";
}

/**
 * A line drawn with Markup, on the original before any turn: `points` are `[x, y]` as fractions of
 * its width and height, `width` a fraction of its longer side, `color` as `#rrggbb`.
 */
export interface MarkStroke {
  color: string;
  width: number;
  points: readonly (readonly [number, number])[];
}

/** The most points of a curve, spots and strokes of an edit, and points of a stroke (the module's limits). */
export const MAX_CURVE_POINTS = 8;
export const MAX_EDIT_SPOTS = 32;
export const MAX_EDIT_STROKES = 12;
export const MAX_STROKE_POINTS = 32;

/** A drawn line cut down to what an edit keeps: evenly spaced points, both ends among them. */
export function thinStroke(points: readonly (readonly [number, number])[]): [number, number][] {
  const rounded = (at: number): [number, number] => {
    const [x, y] = points[at] ?? [0, 0];
    return [Math.round(x * 10_000) / 10_000, Math.round(y * 10_000) / 10_000];
  };
  if (points.length <= MAX_STROKE_POINTS) return points.map((_, at) => rounded(at));
  const step = (points.length - 1) / (MAX_STROKE_POINTS - 1);
  return Array.from({ length: MAX_STROKE_POINTS }, (_, at) => rounded(Math.round(at * step)));
}

/** The sliders of the Adjust pane, in order, by section. */
export const ADJUSTMENTS: readonly {
  section:
    | "Light"
    | "Color"
    | "Black & White"
    | "Definition"
    | "Sharpen"
    | "Noise Reduction"
    | "Vignette";
  key: keyof Adjust;
  name: string;
}[] = [
  { section: "Light", key: "brilliance", name: "Brilliance" },
  { section: "Light", key: "exposure", name: "Exposure" },
  { section: "Light", key: "highlights", name: "Highlights" },
  { section: "Light", key: "shadows", name: "Shadows" },
  { section: "Light", key: "brightness", name: "Brightness" },
  { section: "Light", key: "contrast", name: "Contrast" },
  { section: "Light", key: "black_point", name: "Black Point" },
  { section: "Color", key: "saturation", name: "Saturation" },
  { section: "Color", key: "vibrance", name: "Vibrance" },
  { section: "Color", key: "cast", name: "Cast" },
  { section: "Color", key: "warmth", name: "Warmth" },
  { section: "Color", key: "tint", name: "Tint" },
  { section: "Black & White", key: "mono", name: "Intensity" },
  { section: "Definition", key: "definition", name: "Intensity" },
  { section: "Sharpen", key: "sharpen", name: "Intensity" },
  { section: "Noise Reduction", key: "noise", name: "Amount" },
  { section: "Vignette", key: "vignette", name: "Strength" },
];

export const NO_ADJUST: Adjust = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  warmth: 0,
  tint: 0,
  brilliance: 0,
  black_point: 0,
  vibrance: 0,
  cast: 0,
  definition: 0,
  sharpen: 0,
  noise: 0,
  vignette: 0,
  mono: 0,
};

/** The edit that changes nothing. */
export const NO_EDIT: Edit = {
  rotate: 0,
  flip: false,
  straighten: 0,
  crop: null,
  adjust: NO_ADJUST,
  filter: "none",
  levels: null,
  curve: [],
  spots: [],
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? value : 0));

const wholeCrop = (crop: Crop | null) =>
  !crop || (crop.x <= 1e-6 && crop.y <= 1e-6 && crop.width >= 1 - 1e-6 && crop.height >= 1 - 1e-6);

/** Whether an edit changes nothing, and so is no edit. */
export function isIdentity(edit: Edit): boolean {
  return (
    edit.rotate % 4 === 0 &&
    !edit.flip &&
    edit.straighten === 0 &&
    !edit.vertical &&
    !edit.horizontal &&
    wholeCrop(edit.crop) &&
    Object.values(edit.adjust).every((value) => value === 0) &&
    edit.filter === "none" &&
    edit.levels === null &&
    edit.curve.length === 0 &&
    !edit.channels &&
    !edit.selective &&
    edit.spots.length === 0 &&
    !edit.marks?.length &&
    !edit.external
  );
}

/** The recipe of an edit alone, without the file it stands on. */
export function withoutFile(edit: Edit): Edit {
  const { external: _file, ...recipe } = edit;
  return recipe;
}

const isFilter = (value: unknown): value is FilterId =>
  FILTERS.some((filter) => filter.id === value);

/** An edit as the server answered it, made whole, or `null` for none or one it cannot read. */
export function editFromServer(value: unknown): Edit | null {
  if (!value || typeof value !== "object") return null;
  const given = value as Record<string, unknown>;
  const number = (raw: unknown) => (typeof raw === "number" && Number.isFinite(raw) ? raw : 0);
  const adjustGiven = (given.adjust ?? {}) as Record<string, unknown>;
  const adjust = { ...NO_ADJUST };
  for (const key of Object.keys(NO_ADJUST) as (keyof Adjust)[]) {
    adjust[key] = clamp(number(adjustGiven[key]), -1, 1);
  }
  const cropGiven = given.crop as Record<string, unknown> | null | undefined;
  const crop =
    cropGiven && typeof cropGiven === "object"
      ? normalizeCrop({
          x: number(cropGiven.x),
          y: number(cropGiven.y),
          width: number(cropGiven.width),
          height: number(cropGiven.height),
        })
      : null;
  return {
    rotate: ((Math.trunc(number(given.rotate)) % 4) + 4) % 4,
    flip: given.flip === true,
    straighten: clamp(number(given.straighten), -45, 45),
    ...(number(given.vertical) ? { vertical: clamp(number(given.vertical), -1, 1) } : {}),
    ...(number(given.horizontal) ? { horizontal: clamp(number(given.horizontal), -1, 1) } : {}),
    crop,
    adjust,
    filter: isFilter(given.filter) ? given.filter : "none",
    levels: levelsFromServer(given.levels),
    curve: curveFromServer(given.curve),
    ...channelsFromServer(given.channels),
    ...selectiveFromServer(given.selective),
    spots: Array.isArray(given.spots)
      ? given.spots.flatMap((spot: Record<string, unknown>): Spot[] =>
          spot && (spot.kind === "retouch" || spot.kind === "red-eye")
            ? [
                {
                  x: number(spot.x),
                  y: number(spot.y),
                  radius: number(spot.radius),
                  kind: spot.kind,
                },
              ]
            : [],
        )
      : [],
    ...marksFromServer(given.marks),
    ...(typeof given.external === "string" && given.external ? { external: given.external } : {}),
  };
}

function marksFromServer(value: unknown): { marks?: MarkStroke[] } {
  if (!Array.isArray(value)) return {};
  const marks = value.flatMap((stroke: Partial<MarkStroke> | null): MarkStroke[] => {
    if (!stroke || typeof stroke.color !== "string" || !/^#[0-9a-f]{6}$/i.test(stroke.color)) {
      return [];
    }
    const points = Array.isArray(stroke.points)
      ? stroke.points.filter(
          (point): point is [number, number] =>
            Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]),
        )
      : [];
    return points.length > 0 && typeof stroke.width === "number" && stroke.width > 0
      ? [{ color: stroke.color, width: stroke.width, points }]
      : [];
  });
  return marks.length > 0 ? { marks } : {};
}

function curveFromServer(value: unknown): [number, number][] {
  const finite = (raw: unknown) => (typeof raw === "number" && Number.isFinite(raw) ? raw : 0);
  return Array.isArray(value)
    ? value.flatMap((point): [number, number][] =>
        Array.isArray(point) ? [[finite(point[0]), finite(point[1])]] : [],
      )
    : [];
}

function channelsFromServer(value: unknown): { channels?: ChannelTones } {
  if (!value || typeof value !== "object") return {};
  const given = value as Record<string, { levels?: unknown; curve?: unknown } | undefined>;
  let channels: ChannelTones | undefined;
  for (const channel of TONE_CHANNELS) {
    const tone = given[channel];
    if (tone) {
      channels = withChannelTone(channels, channel, {
        levels: levelsFromServer(tone.levels),
        curve: curveFromServer(tone.curve),
      });
    }
  }
  return channels ? { channels } : {};
}

function levelsFromServer(value: unknown): Levels | null {
  if (!value || typeof value !== "object") return null;
  const { black, gamma, white } = value as Record<string, unknown>;
  return typeof black === "number" && typeof gamma === "number" && typeof white === "number"
    ? { black, gamma, white }
    : null;
}

/** The least side of a crop, as a fraction. */
export const MIN_CROP = 0.02;

/** A crop kept inside the picture and at least `MIN_CROP` on each side. */
export function normalizeCrop(crop: Crop): Crop {
  const width = clamp(crop.width, MIN_CROP, 1);
  const height = clamp(crop.height, MIN_CROP, 1);
  return {
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
}

/**
 * Whether a crop of `aspect` (width over height, in pixels of a frame of `frameWidth` by
 * `frameHeight`) can have both sides at least `MIN_CROP` inside the frame. A square of a very wide
 * panorama cannot: Photos then keeps the crop freeform, as a saved crop keeps both sides at least
 * `MIN_CROP` (`normalizeCrop`, and the module's check).
 */
export function aspectFits(aspect: number, frameWidth: number, frameHeight: number): boolean {
  const ratio = (aspect * frameHeight) / frameWidth;
  return ratio >= MIN_CROP && ratio <= 1 / MIN_CROP;
}

/**
 * The largest crop of `aspect` (width over height, in pixels of a frame of `frameWidth` by
 * `frameHeight`) centred on `crop`'s centre and inside the frame: what choosing an aspect ratio
 * in the Crop pane does. `null` keeps the crop as it is (freeform), and so does an aspect the
 * frame cannot hold at the least size (`aspectFits`).
 */
export function cropToAspect(
  crop: Crop | null,
  aspect: number | null,
  frameWidth: number,
  frameHeight: number,
): Crop | null {
  if (aspect === null || !(aspect > 0)) return crop;
  if (!aspectFits(aspect, frameWidth, frameHeight)) return crop;
  const current = crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const centreX = current.x + current.width / 2;
  const centreY = current.y + current.height / 2;
  // As fractions of the frame: width / height in fractions is aspect * frameHeight / frameWidth.
  const ratio = (aspect * frameHeight) / frameWidth;
  let width = current.width;
  let height = width / ratio;
  if (height > current.height) {
    height = current.height;
    width = height * ratio;
  }
  const fitted = { width: Math.min(width, 1), height: Math.min(height, 1) };
  // Both sides grow together until the smaller is at least MIN_CROP, so the shape stays the one
  // chosen; `aspectFits` holds, so the grown crop fits the frame.
  const up = Math.max(1, MIN_CROP / fitted.width, MIN_CROP / fitted.height);
  const down = Math.min(1, 1 / (fitted.width * up), 1 / (fitted.height * up));
  const scaled = { width: fitted.width * up * down, height: fitted.height * up * down };
  return {
    x: clamp(centreX - scaled.width / 2, 0, 1 - scaled.width),
    y: clamp(centreY - scaled.height / 2, 0, 1 - scaled.height),
    ...scaled,
  };
}

/** Which part of a crop a drag moves: the whole rectangle, one corner or one edge. */
export type CropHandle = "move" | "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";

/**
 * The crop after dragging `handle` of `start` by `dx` and `dy` (fractions of the frame). A
 * corner keeps the opposite corner where it is, and an edge the other three sides; with `ratio`
 * (width over height, in fractions of the frame) a corner keeps the crop to that shape. An edge
 * cannot, so a stage that holds a shape shows no edge handles. The result stays inside the frame.
 */
export function dragCrop(
  start: Crop,
  handle: CropHandle,
  dx: number,
  dy: number,
  ratio: number | null = null,
): Crop {
  if (handle === "move") {
    return {
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    };
  }
  if (handle === "e") return dragCrop(start, "se", dx, 0);
  if (handle === "s") return dragCrop(start, "se", 0, dy);
  if (handle === "w") return dragCrop(start, "sw", dx, 0);
  if (handle === "n") return dragCrop(start, "ne", 0, dy);
  const west = handle === "nw" || handle === "sw";
  const north = handle === "nw" || handle === "ne";
  // The corner that stays, and the room there is from it to the frame's edges.
  const anchorX = west ? start.x + start.width : start.x;
  const anchorY = north ? start.y + start.height : start.y;
  const roomX = west ? anchorX : 1 - anchorX;
  const roomY = north ? anchorY : 1 - anchorY;
  let width = clamp(start.width + (west ? -dx : dx), MIN_CROP, roomX);
  let height = clamp(start.height + (north ? -dy : dy), MIN_CROP, roomY);
  if (ratio !== null && ratio > 0) {
    // Follow the larger of the two moves, then scale the shape, both sides together, into the
    // room and up to the least size. A shape that cannot be both is not changed.
    if (Math.abs(dx) >= Math.abs(dy)) height = width / ratio;
    else width = height * ratio;
    const down = Math.min(1, roomX / width, roomY / height);
    width *= down;
    height *= down;
    const up = Math.max(1, MIN_CROP / width, MIN_CROP / height);
    width *= up;
    height *= up;
    if (width > roomX + 1e-9 || height > roomY + 1e-9) return start;
  }
  return {
    x: west ? anchorX - width : anchorX,
    y: north ? anchorY - height : anchorY,
    width,
    height,
  };
}

/** A crop of the frame turned a quarter to the left, as a crop of the turned frame. */
export function turnCropLeft(crop: Crop | null): Crop | null {
  if (!crop) return null;
  return { x: crop.y, y: 1 - crop.x - crop.width, width: crop.height, height: crop.width };
}

/** A crop of the frame mirrored left to right. */
export function flipCrop(crop: Crop | null): Crop | null {
  if (!crop) return null;
  return { ...crop, x: 1 - crop.x - crop.width };
}

/**
 * The edit turned a quarter to the left once more, as it looks, its crop turned with it. The
 * flip is drawn after the turns, so a flipped picture turns left by turning its source right.
 * Perspective is drawn on the turned picture, so it turns too: the old right is the new top, the
 * old bottom the new right.
 */
export function turnLeft(edit: Edit): Edit {
  const step = edit.flip ? 3 : 1;
  return {
    ...edit,
    rotate: (edit.rotate + step) % 4,
    crop: turnCropLeft(edit.crop),
    ...(edit.vertical || edit.horizontal
      ? { vertical: edit.horizontal ?? 0, horizontal: 0 - (edit.vertical ?? 0) }
      : {}),
  };
}

/**
 * The edit mirrored left to right, as it looks. The mirror is drawn before the straightening
 * (renderEdit), and mirroring a turn reverses it, so the angle and Horizontal change sign; the crop
 * is mirrored with the picture.
 */
export function flipEdit(edit: Edit): Edit {
  return {
    ...edit,
    flip: !edit.flip,
    straighten: edit.straighten === 0 ? 0 : -edit.straighten,
    ...(edit.horizontal ? { horizontal: -edit.horizontal } : {}),
    crop: flipCrop(edit.crop),
  };
}

/** The frame an edit draws into before its crop: the turned picture's sides. */
export function turnedSize(width: number, height: number, edit: Pick<Edit, "rotate">) {
  return edit.rotate % 2 ? { width: height, height: width } : { width, height };
}

/**
 * How much a frame of `width` by `height` turned by `degrees` is enlarged so that it still
 * covers the frame: straightening shows no empty corner.
 */
export function straightenScale(width: number, height: number, degrees: number): number {
  const angle = (Math.abs(degrees) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return Math.max((width * cos + height * sin) / width, (width * sin + height * cos) / height);
}

/** How much of a picture's side Perspective at 1 takes from the far edge. */
const PERSPECTIVE_REACH = 0.35;

/** Perspective as a projection from the frame to the picture, fitted so no corner shows empty. */
function perspectiveOf(vertical: number, horizontal: number) {
  const down = vertical * PERSPECTIVE_REACH;
  const across = horizontal * PERSPECTIVE_REACH;
  let fit = 1;
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      fit = Math.max(fit, 1 / (1 + down * y - across * x));
    }
  }
  return { down, across, fit };
}

/**
 * Which point of the turned picture Perspective shows at a point of the frame, both as `x` and `y`
 * from -1 to 1 about the centre. The whole frame comes from inside the picture.
 */
export function perspectiveSource(
  x: number,
  y: number,
  vertical: number,
  horizontal: number,
): [number, number] {
  const { down, across, fit } = perspectiveOf(vertical, horizontal);
  const depth = (1 + down * y - across * x) * fit;
  return [x / depth, y / depth];
}

/** Draws `from` into `to`, a picture of the same size, with Perspective, read between pixels. */
export function warpPixels(from: Pixels, to: Pixels, vertical: number, horizontal: number): void {
  const { width, height } = from;
  const { down, across, fit } = perspectiveOf(vertical, horizontal);
  const source = from.data;
  const target = to.data;
  for (let row = 0; row < height; row += 1) {
    const y = ((row + 0.5) / height) * 2 - 1;
    for (let column = 0; column < width; column += 1) {
      const x = ((column + 0.5) / width) * 2 - 1;
      const depth = (1 + down * y - across * x) * fit;
      const fromX = clamp(((x / depth + 1) / 2) * width - 0.5, 0, width - 1);
      const fromY = clamp(((y / depth + 1) / 2) * height - 0.5, 0, height - 1);
      const left = Math.floor(fromX);
      const top = Math.floor(fromY);
      const right = Math.min(width - 1, left + 1);
      const bottom = Math.min(height - 1, top + 1);
      const partX = fromX - left;
      const partY = fromY - top;
      const at = (row * width + column) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const pixel = (px: number, py: number) => source[(py * width + px) * 4 + channel] ?? 0;
        const upper = pixel(left, top) * (1 - partX) + pixel(right, top) * partX;
        const lower = pixel(left, bottom) * (1 - partX) + pixel(right, bottom) * partX;
        target[at + channel] = upper * (1 - partY) + lower * partY;
      }
    }
  }
}

/** The pixel size an edit of a `width` by `height` picture comes out at, before any scaling. */
export function editedSize(width: number, height: number, edit: Edit) {
  const frame = turnedSize(width, height, edit);
  const crop = edit.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  return {
    width: Math.max(1, Math.round(frame.width * crop.width)),
    height: Math.max(1, Math.round(frame.height * crop.height)),
  };
}

/** A sample of a canvas's pixels: RGBA bytes, row by row. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const smoothstep = (low: number, high: number, x: number) => {
  const t = clamp((x - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

/** What a filter does: a saturation factor, a contrast factor, a lift, and a warmth shift. */
interface FilterLook {
  saturation: number;
  contrast: number;
  lift: number;
  warmth: number;
  mono: boolean;
  coolTint?: number;
}

const LOOKS: Record<FilterId, FilterLook | null> = {
  none: null,
  vivid: { saturation: 1.35, contrast: 1.1, lift: 0, warmth: 0, mono: false },
  "vivid-warm": { saturation: 1.3, contrast: 1.1, lift: 0, warmth: 0.07, mono: false },
  "vivid-cool": { saturation: 1.3, contrast: 1.1, lift: 0, warmth: -0.07, mono: false },
  dramatic: { saturation: 0.85, contrast: 1.35, lift: -0.03, warmth: 0, mono: false },
  "dramatic-warm": { saturation: 0.9, contrast: 1.35, lift: -0.03, warmth: 0.07, mono: false },
  "dramatic-cool": { saturation: 0.9, contrast: 1.35, lift: -0.03, warmth: -0.07, mono: false },
  mono: { saturation: 0, contrast: 1, lift: 0, warmth: 0, mono: true },
  silvertone: { saturation: 0, contrast: 0.9, lift: 0.05, warmth: 0, mono: true, coolTint: 0.02 },
  noir: { saturation: 0, contrast: 1.6, lift: -0.04, warmth: 0, mono: true },
};

/**
 * Applies an edit's adjustments and filter to pixels, in place: exposure, brightness,
 * highlights, shadows, contrast, saturation, warmth and tint, then the filter's look. The alpha
 * channel is kept.
 */
export function adjustPixels(pixels: Pixels, adjust: Adjust, filter: FilterId): void {
  const look = LOOKS[filter];
  const identity = Object.values(adjust).every((value) => value === 0) && !look;
  if (identity) return;
  const gain = 2 ** (adjust.exposure * 1.5);
  const lift = adjust.brightness * 0.2;
  const contrast = 1 + adjust.contrast * 0.8;
  const saturation = 1 + adjust.saturation;
  const warmth = adjust.warmth * 0.1 + adjust.cast * 0.06;
  const tint = adjust.tint * 0.08;
  const blackPoint = adjust.black_point * 0.15;
  const { data } = pixels;
  // Sharpen, Definition and Noise Reduction need a pixel's neighbours; they act on the picture
  // before anything else, from a copy of it.
  if (adjust.sharpen !== 0 || adjust.definition !== 0 || adjust.noise !== 0) {
    detail(pixels, adjust);
  }
  const { width, height } = pixels;
  for (let at = 0; at < data.length; at += 4) {
    let r = (data[at] ?? 0) / 255;
    let g = (data[at + 1] ?? 0) / 255;
    let b = (data[at + 2] ?? 0) / 255;
    if (adjust.brilliance !== 0) {
      // Lifts the shadows and tames the highlights together, keeping the picture's overall light.
      const level = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const shift = adjust.brilliance * 0.25 * (0.5 - level) * (1 - Math.abs(2 * level - 1));
      r += shift;
      g += shift;
      b += shift;
    }
    r = r * gain + lift;
    g = g * gain + lift;
    b = b * gain + lift;
    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (adjust.highlights !== 0 || adjust.shadows !== 0) {
      const shift =
        adjust.highlights * 0.3 * smoothstep(0.5, 1, luma) +
        adjust.shadows * 0.3 * (1 - smoothstep(0, 0.5, luma));
      r += shift;
      g += shift;
      b += shift;
    }
    if (blackPoint !== 0) {
      const scale = 1 / (1 - blackPoint);
      r = (r - blackPoint) * scale;
      g = (g - blackPoint) * scale;
      b = (b - blackPoint) * scale;
    }
    r = (r - 0.5) * contrast + 0.5;
    g = (g - 0.5) * contrast + 0.5;
    b = (b - 0.5) * contrast + 0.5;
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let colour = saturation;
    if (adjust.vibrance !== 0) {
      // Vibrance favours the colours that are still muted.
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      colour *= 1 + adjust.vibrance * (1 - clamp(chroma, 0, 1));
    }
    colour *= 1 - Math.max(0, adjust.mono);
    r = luma + (r - luma) * colour + warmth;
    g = luma + (g - luma) * colour - tint;
    b = luma + (b - luma) * colour - warmth;
    if (adjust.vignette !== 0 && width > 0 && height > 0) {
      const x = (((at / 4) % width) / width) * 2 - 1;
      const y = (Math.floor(at / 4 / width) / height) * 2 - 1;
      const edge = 1 - adjust.vignette * 0.6 * smoothstep(0.4, 1.4, x * x + y * y);
      r *= edge;
      g *= edge;
      b *= edge;
    }
    if (look) {
      luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (look.mono) {
        r = g = b = luma;
      } else {
        r = luma + (r - luma) * look.saturation;
        g = luma + (g - luma) * look.saturation;
        b = luma + (b - luma) * look.saturation;
      }
      r = (r - 0.5) * look.contrast + 0.5 + look.lift + look.warmth;
      g = (g - 0.5) * look.contrast + 0.5 + look.lift;
      b = (b - 0.5) * look.contrast + 0.5 + look.lift - look.warmth + (look.coolTint ?? 0);
    }
    data[at] = r * 255;
    data[at + 1] = g * 255;
    data[at + 2] = b * 255;
  }
}

/**
 * Sharpen, Definition and Noise Reduction: each pixel against the mean of its neighbours (a 3 by 3
 * box). Sharpen and Definition push a pixel away from that mean; Noise Reduction pulls it towards it.
 */
function detail({ data, width, height }: Pixels, adjust: Adjust): void {
  if (width < 3 || height < 3) return;
  const source = data.slice();
  const amount = adjust.sharpen * 1.2 + adjust.definition * 0.5 - Math.max(0, adjust.noise) * 0.9;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            sum += source[((y + dy) * width + x + dx) * 4 + channel] ?? 0;
          }
        }
        const here = source[at + channel] ?? 0;
        data[at + channel] = here + (here - sum / 9) * amount;
      }
    }
  }
}

/**
 * What Auto Enhance sets, from a sample of the picture's pixels: exposure that brings the mean
 * brightness towards the middle, contrast that widens a flat picture, and a little saturation.
 */
/**
 * White Balance's Neutral Gray: the Warmth and Tint that bring the picture's average to gray, from
 * pixels with no warmth or tint applied. `adjustPixels` adds warmth to red and takes it from blue,
 * and takes tint from green.
 */
export function neutralBalance(pixels: Pixels): Pick<Adjust, "warmth" | "tint"> {
  const [r, g, b] = meanOf(pixels);
  return {
    warmth: clamp((b - r) / 0.2, -1, 1),
    tint: clamp((g - (r + b) / 2) / 0.08, -1, 1),
  };
}

/** The mean colour of pixels, each channel from 0 to 1; black for no pixels. */
export function meanOf({ data }: Pixels): [number, number, number] {
  let [red, green, blue] = [0, 0, 0];
  const count = data.length / 4;
  if (count === 0) return [0, 0, 0];
  for (let at = 0; at < data.length; at += 4) {
    red += data[at] ?? 0;
    green += data[at + 1] ?? 0;
    blue += data[at + 2] ?? 0;
  }
  return [red / count / 255, green / count / 255, blue / count / 255];
}

/**
 * The skin colour White Balance's Skin Tone aims for, as multiples of a colour's mean: rgb(225, 180,
 * 150), a mid complexion in daylight. Red less blue, and green below the middle of the two.
 */
const SKIN_RED_BLUE = 0.405;
const SKIN_GREEN_DIP = 0.041;

/**
 * White Balance's Skin Tone: the Warmth and Tint that bring the pixels' average to the colour of
 * skin at its own brightness, from pixels with no warmth or tint applied.
 */
export function skinBalance(pixels: Pixels): Pick<Adjust, "warmth" | "tint"> {
  const [r, g, b] = meanOf(pixels);
  const mean = (r + g + b) / 3;
  return {
    warmth: clamp((mean * SKIN_RED_BLUE - (r - b)) / 0.2, -1, 1),
    tint: clamp((g - (r + b) / 2 + mean * SKIN_GREEN_DIP) / 0.08, -1, 1),
  };
}

/** The pixels whose hue, saturation and lightness could be skin, or `null` under 1% of the picture. */
export function skinPixels({ data }: Pixels): Pixels | null {
  const kept: number[] = [];
  for (let at = 0; at < data.length; at += 4) {
    const [r, g, b] = [data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0];
    const { hue, sat, light } = hslOf(r / 255, g / 255, b / 255);
    if (hue >= 5 && hue <= 50 && sat >= 0.15 && sat <= 0.8 && light >= 0.2 && light <= 0.85) {
      kept.push(r, g, b, 255);
    }
  }
  if (kept.length === 0 || kept.length * 100 < data.length) return null;
  return { data: Uint8ClampedArray.from(kept), width: kept.length / 4, height: 1 };
}

/** A black, gray or white eyedropper of Curves. */
export type CurvePick = "black" | "gray" | "white";

/** The least distance between two points of a curve, on its input. */
export const CURVE_GAP = 0.02;

/**
 * A curve with a point set by an eyedropper: `value` goes to `target`. Points the new one would
 * cross are dropped: below a black point, above a white one, and any within a hair of it. A full
 * curve gives up the point nearest it.
 */
export function curveWithPick(
  curve: readonly (readonly [number, number])[],
  pick: CurvePick,
  value: number,
  target: number,
): (readonly [number, number])[] {
  const x = Math.round(clamp(value, 0, 1) * 1000) / 1000;
  const y = Math.round(clamp(target, 0, 1) * 1000) / 1000;
  const kept = curve.filter(
    ([at]) =>
      Math.abs(at - x) >= CURVE_GAP && (pick !== "black" || at > x) && (pick !== "white" || at < x),
  );
  if (kept.length === 0 && Math.abs(x - y) < 1 / 255) return [];
  if (kept.length >= MAX_CURVE_POINTS) {
    const nearest = kept.reduce(
      (best, [at], index) =>
        Math.abs(at - x) < Math.abs((kept[best]?.[0] ?? 2) - x) ? index : best,
      0,
    );
    kept.splice(nearest, 1);
  }
  return [...kept, [x, y] as const].sort((a, b) => a[0] - b[0]);
}

/** The edit without the colours' own curves or Selective Color: what those curves are fed. */
export function beforeChannelCurves(edit: Edit): Edit {
  let channels = edit.channels;
  for (const channel of TONE_CHANNELS) {
    const own = channels?.[channel];
    if (own) channels = withChannelTone(channels, channel, { levels: own.levels, curve: [] });
  }
  return { ...edit, channels, selective: undefined };
}

/**
 * The edit after a Curves eyedropper on a pixel of colour `sample` (each channel from 0 to 1, as
 * `beforeChannelCurves` draws it). Black and white send each colour's value to its end; gray sends
 * it to the pixel's mean, so the pixel comes out gray. It works on one colour's curve when one is
 * chosen, and on all three colours' own curves otherwise.
 */
export function withCurvePick(
  edit: Edit,
  choice: ToneChannel | "rgb",
  pick: CurvePick,
  sample: readonly [number, number, number],
): Edit {
  const [r, g, b] = sample;
  const target = pick === "black" ? 0 : pick === "white" ? 1 : (r + g + b) / 3;
  const values: Record<ToneChannel, number> = { red: r, green: g, blue: b };
  let channels = edit.channels;
  for (const channel of choice === "rgb" ? TONE_CHANNELS : [choice]) {
    const own = channels?.[channel];
    channels = withChannelTone(channels, channel, {
      levels: own?.levels ?? null,
      curve: curveWithPick(own?.curve ?? [], pick, values[channel], target),
    });
  }
  return { ...edit, channels };
}

export function autoAdjust(pixels: Pixels): Adjust {
  const { data } = pixels;
  // Every 16th pixel is enough to judge a picture.
  const sample = new Uint8ClampedArray(Math.ceil(data.length / 64) * 4);
  let count = 0;
  for (let at = 0; at < data.length; at += 64) {
    sample.set([data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0, 255], count * 4);
    count += 1;
  }
  if (count === 0) return NO_ADJUST;
  const lumaOf = (pixel: Uint8ClampedArray, at: number) =>
    (0.2126 * (pixel[at] ?? 0) + 0.7152 * (pixel[at + 1] ?? 0) + 0.0722 * (pixel[at + 2] ?? 0)) /
    255;
  let sum = 0;
  let squares = 0;
  for (let at = 0; at < sample.length; at += 4) {
    const luma = lumaOf(sample, at);
    sum += luma;
    squares += luma * luma;
  }
  const mean = sum / count;
  const spread = Math.sqrt(Math.max(0, squares / count - mean * mean));
  const round = (value: number) => Math.round(clamp(value, -1, 1) * 100) / 100;
  const exposure = round((0.5 - mean) * 1.4);
  let contrast = round((0.22 - spread) * 2);
  // The mean brightness of the sample as an adjustment draws it, clipping included.
  const rendered = (adjust: Adjust) => {
    const copy = sample.slice();
    adjustPixels({ data: copy, width: count, height: 1 }, adjust, "none");
    let total = 0;
    for (let at = 0; at < copy.length; at += 4) total += lumaOf(copy, at);
    return total / count;
  };
  // Contrast pivots at middle grey (`adjustPixels`): it can push the mean back out and undo the
  // exposure (a dark picture would end darker). On the sample as drawn, it may take back at most
  // half of what the exposure moved; it is lowered until it does.
  if (exposure !== 0 && contrast > 0) {
    const base = { ...NO_ADJUST, exposure, saturation: 0.1 };
    const half = (mean + rendered(base)) / 2;
    const keeps = (value: number) => {
      const shown = rendered({ ...base, contrast: value });
      return exposure > 0 ? shown >= half : shown <= half;
    };
    while (contrast > 0 && !keeps(contrast)) contrast = Math.round((contrast - 0.01) * 100) / 100;
  }
  return {
    ...NO_ADJUST,
    exposure,
    contrast,
    saturation: 0.1,
  };
}

/** A picture a canvas can draw, with its own pixel size. */
export interface Drawable {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/**
 * Where a point of the shown picture lies on the original: `x` and `y` as fractions of what
 * `renderEdit` draws, undoing its crop, straightening, flip and turns in turn. A spot is kept on
 * the original, so it stays on what it marks however the picture is turned afterwards.
 */
export function pointOnOriginal(
  edit: Edit,
  width: number,
  height: number,
  x: number,
  y: number,
): { x: number; y: number } {
  const frame = turnedSize(width, height, edit);
  const area = edit.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  let px = (area.x + x * area.width) * frame.width - frame.width / 2;
  let py = (area.y + y * area.height) * frame.height - frame.height / 2;
  const turn = (angle: number) => {
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    [px, py] = [px * cos - py * sin, px * sin + py * cos];
  };
  if (edit.straighten) {
    turn((-edit.straighten * Math.PI) / 180);
    const enlarge = straightenScale(frame.width, frame.height, edit.straighten);
    px /= enlarge;
    py /= enlarge;
  }
  if (edit.vertical || edit.horizontal) {
    const [sourceX, sourceY] = perspectiveSource(
      px / (frame.width / 2),
      py / (frame.height / 2),
      edit.vertical ?? 0,
      edit.horizontal ?? 0,
    );
    px = sourceX * (frame.width / 2);
    py = sourceY * (frame.height / 2);
  }
  if (edit.flip) px = -px;
  turn(((edit.rotate % 4) * Math.PI) / 2);
  return { x: px / width + 0.5, y: py / height + 0.5 };
}

/**
 * Applies spots to pixels, in place. Red-eye takes the red out of what is mainly red. Retouch fills
 * the circle from the four points of its rim level with each pixel, nearest counting most; those
 * lie just outside the circle, so a pixel filled earlier is never read.
 */
export function applySpots(pixels: Pixels, spots: readonly Spot[]): void {
  const { data, width, height } = pixels;
  const side = Math.max(width, height);
  const sample = (x: number, y: number, channel: number) =>
    data[
      4 *
        (Math.min(height - 1, Math.max(0, Math.round(y))) * width +
          Math.min(width - 1, Math.max(0, Math.round(x)))) +
        channel
    ] ?? 0;
  for (const spot of spots) {
    const radius = Math.max(1, spot.radius * side);
    const cx = spot.x * width;
    const cy = spot.y * height;
    const top = Math.max(0, Math.floor(cy - radius));
    const bottom = Math.min(height - 1, Math.ceil(cy + radius));
    const left = Math.max(0, Math.floor(cx - radius));
    const right = Math.min(width - 1, Math.ceil(cx + radius));
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
        const at = 4 * (y * width + x);
        if (spot.kind === "red-eye") {
          const g = data[at + 1] ?? 0;
          const b = data[at + 2] ?? 0;
          if ((data[at] ?? 0) > 1.4 * Math.max(g, b)) data[at] = (g + b) / 2;
          continue;
        }
        const across = Math.sqrt(radius * radius - dy * dy) + 1.5;
        const along = Math.sqrt(radius * radius - dx * dx) + 1.5;
        const rim: readonly (readonly [number, number])[] = [
          [cx - across, y],
          [cx + across, y],
          [x, cy - along],
          [x, cy + along],
        ];
        for (let channel = 0; channel < 3; channel += 1) {
          let total = 0;
          let weights = 0;
          for (const [rx, ry] of rim) {
            const weight = 1 / (1 + Math.hypot(rx - x, ry - y));
            total += sample(rx, ry, channel) * weight;
            weights += weight;
          }
          data[at + channel] = total / weights;
        }
      }
    }
  }
}

/** How many pixels hold each of the 256 values: of the colour, or of the luminance of all three. */
export function histogramOf(pixels: ImageData, channel: ToneChannel | "rgb"): Uint32Array {
  const counts = new Uint32Array(256);
  const { data } = pixels;
  for (let at = 0; at < data.length; at += 4) {
    const r = data[at] ?? 0;
    const g = data[at + 1] ?? 0;
    const b = data[at + 2] ?? 0;
    const value =
      channel === "red"
        ? r
        : channel === "green"
          ? g
          : channel === "blue"
            ? b
            : Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

/**
 * What Levels and Curves make of each of the 256 values of a channel: Levels first, then the curve
 * drawn straight between its points and through its ends (0, 0) and (1, 1) unless points replace them.
 */
export function toneTable(
  levels: Levels | null,
  curve: readonly (readonly [number, number])[],
): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256);
  const points: readonly (readonly [number, number])[] = [
    ...(curve[0] && curve[0][0] > 0 ? ([[0, 0]] as const) : []),
    ...curve,
    ...((curve[curve.length - 1]?.[0] ?? 0) < 1 ? ([[1, 1]] as const) : []),
  ];
  for (let value = 0; value < 256; value += 1) {
    let tone = value / 255;
    if (levels) {
      const spread = levels.white - levels.black;
      tone = clamp((tone - levels.black) / (spread > 0 ? spread : 1), 0, 1) ** (1 / levels.gamma);
    }
    if (curve.length > 0) {
      const after = points.findIndex(([x]) => x >= tone);
      const end = points[Math.max(after, 1)];
      const start = points[Math.max(after, 1) - 1];
      if (start && end) {
        const span = end[0] - start[0];
        tone = span > 0 ? start[1] + ((tone - start[0]) / span) * (end[1] - start[1]) : end[1];
      }
    }
    table[value] = Math.round(clamp(tone, 0, 1) * 255);
  }
  return table;
}

/** Markup's lines on a canvas of the original's size, each point joined to the next by a curve. */
function drawStrokes(
  context: CanvasRenderingContext2D,
  strokes: readonly MarkStroke[],
  width: number,
  height: number,
): void {
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    const at = stroke.points.map(([x, y]) => [x * width, y * height] as const);
    const first = at[0];
    if (!first) continue;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width * Math.max(width, height);
    context.beginPath();
    context.moveTo(first[0], first[1]);
    for (const [index, point] of at.entries()) {
      const next = at[index + 1];
      if (next) {
        context.quadraticCurveTo(
          point[0],
          point[1],
          (point[0] + next[0]) / 2,
          (point[1] + next[1]) / 2,
        );
      } else context.lineTo(point[0], point[1]);
    }
    context.stroke();
  }
}

// The original with its spots and marks, for each original, kept while they stay the same lists:
// moving a slider redraws the picture and need not redo them.
const spotted = new WeakMap<
  Drawable["image"] & object,
  { spots: readonly Spot[]; marks: readonly MarkStroke[] | undefined; image: HTMLCanvasElement }
>();

function withSpots(source: Drawable, edit: Edit, doc: Document): Drawable["image"] {
  const { spots, marks } = edit;
  if (spots.length === 0 && !marks?.length) return source.image;
  const kept = spotted.get(source.image);
  if (kept?.spots === spots && kept.marks === marks) return kept.image;
  const image = doc.createElement("canvas");
  image.width = source.width;
  image.height = source.height;
  const context = image.getContext("2d", { willReadFrequently: true });
  if (!context) return source.image;
  context.drawImage(source.image, 0, 0, source.width, source.height);
  if (spots.length > 0) {
    const pixels = context.getImageData(0, 0, source.width, source.height);
    applySpots(pixels, spots);
    context.putImageData(pixels, 0, 0);
  }
  if (marks) drawStrokes(context, marks, source.width, source.height);
  spotted.set(source.image, { spots, marks, image });
  return image;
}

/** The longest side a picture is enlarged to by Perspective, in pixels. */
const MAX_WARP_SIDE = 4096;

/**
 * The original with its spots, turns and flip, then Perspective, at `scale`. A small crop asks for the
 * whole frame at the crop's scale, above the original's own size, and warping reads and writes every
 * pixel of it twice, so a scale above 1 stops at `MAX_WARP_SIDE`; the original's own size is always
 * allowed, so that an export keeps its detail.
 */
function perspectiveFrame(
  source: Drawable,
  edit: Edit,
  wanted: number,
  doc: Document,
): HTMLCanvasElement {
  const frame = turnedSize(source.width, source.height, edit);
  const scale = Math.min(wanted, Math.max(1, MAX_WARP_SIDE / Math.max(frame.width, frame.height)));
  const canvas = doc.createElement("canvas");
  canvas.width = Math.max(1, Math.round(frame.width * scale));
  canvas.height = Math.max(1, Math.round(frame.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  context.imageSmoothingQuality = "high";
  context.scale(canvas.width / frame.width, canvas.height / frame.height);
  context.translate(frame.width / 2, frame.height / 2);
  drawTurned(context, source, edit, doc);
  const from = context.getImageData(0, 0, canvas.width, canvas.height);
  const to = context.createImageData(canvas.width, canvas.height);
  warpPixels(from, to, edit.vertical ?? 0, edit.horizontal ?? 0);
  context.putImageData(to, 0, 0);
  return canvas;
}

/** Draws the original with its spots, flipped and turned, about the context's origin. */
function drawTurned(
  context: CanvasRenderingContext2D,
  source: Drawable,
  edit: Edit,
  doc: Document,
): void {
  if (edit.flip) context.scale(-1, 1);
  context.rotate((-(edit.rotate % 4) * Math.PI) / 2);
  context.drawImage(
    withSpots(source, edit, doc),
    -source.width / 2,
    -source.height / 2,
    source.width,
    source.height,
  );
}

/** The steepest tilt Auto corrects, in degrees: anything steeper is a slope in the scene. */
const MAX_HORIZON_TILT = 15;
/** How far across the picture a line must run to be taken for the horizon. */
const HORIZON_SPAN = 0.4;
/** The least difference of brightness, from the edge filter, that counts as an edge. */
const MIN_EDGE = 60;

/**
 * The degrees of straightening that level the picture's horizon, from its pixels alone: the angle
 * most of its long, nearly level edges share, at the steps the Straighten slider takes. `null` when
 * no edge runs far enough across the picture to go by.
 */
export function horizonAngle({ data, width, height }: Pixels): number | null {
  const bright = new Float32Array(width * height);
  for (let at = 0; at < bright.length; at++) {
    bright[at] =
      0.299 * (data[at * 4] ?? 0) +
      0.587 * (data[at * 4 + 1] ?? 0) +
      0.114 * (data[at * 4 + 2] ?? 0);
  }
  const value = (x: number, y: number) => bright[y * width + x] ?? 0;
  const binCount = MAX_HORIZON_TILT * 4 + 1;
  const weights = new Float64Array(binCount);
  const angles = new Float64Array(binCount);
  const columns = Array.from({ length: binCount }, () => new Uint8Array(width));
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx =
        value(x + 1, y - 1) +
        2 * value(x + 1, y) +
        value(x + 1, y + 1) -
        value(x - 1, y - 1) -
        2 * value(x - 1, y) -
        value(x - 1, y + 1);
      const gy =
        value(x - 1, y + 1) +
        2 * value(x, y + 1) +
        value(x + 1, y + 1) -
        value(x - 1, y - 1) -
        2 * value(x, y - 1) -
        value(x + 1, y - 1);
      const strength = Math.hypot(gx, gy);
      if (strength < MIN_EDGE || gy === 0) continue;
      const tilt = (Math.atan(-gx / gy) * 180) / Math.PI;
      if (Math.abs(tilt) > MAX_HORIZON_TILT) continue;
      const bin = Math.round((tilt + MAX_HORIZON_TILT) * 2);
      weights[bin] = (weights[bin] ?? 0) + strength;
      angles[bin] = (angles[bin] ?? 0) + strength * tilt;
      const seen = columns[bin];
      if (seen) seen[x] = 1;
    }
  }
  let peak = 0;
  const around = (bin: number) =>
    (weights[bin - 1] ?? 0) + (weights[bin] ?? 0) + (weights[bin + 1] ?? 0);
  for (let bin = 1; bin < binCount; bin++) if (around(bin) > around(peak)) peak = bin;
  if (around(peak) === 0) return null;
  let across = 0;
  for (let x = 0; x < width; x++) {
    if ([peak - 1, peak, peak + 1].some((bin) => columns[bin]?.[x] === 1)) across++;
  }
  if (across < width * HORIZON_SPAN) return null;
  const tilt =
    ((angles[peak - 1] ?? 0) + (angles[peak] ?? 0) + (angles[peak + 1] ?? 0)) / around(peak);
  return Math.round(-tilt * 2) / 2 || 0;
}

/**
 * The few pixels around a point of what an edit draws, `x` and `y` as fractions of it: what an
 * eyedropper reads, a little wider than one pixel so that one speck of noise does not decide it.
 */
export function sampleEdit(
  source: Drawable,
  edit: Edit,
  x: number,
  y: number,
  maxSide: number,
): ImageData | null {
  const drawn = renderEdit(source, edit, maxSide);
  const context = drawn.getContext("2d");
  if (!context) return null;
  const width = Math.min(3, drawn.width);
  const height = Math.min(3, drawn.height);
  const left = clamp(Math.floor(x * drawn.width) - 1, 0, drawn.width - width);
  const top = clamp(Math.floor(y * drawn.height) - 1, 0, drawn.height - height);
  return context.getImageData(left, top, width, height);
}

/**
 * Draws an edit of `source` into a new canvas whose longer side is at most `maxSide`: the spots on
 * the original, the turns, the flip, Perspective and the straightening about the centre, the crop,
 * then the adjustments, the filter, Levels and Curves on the pixels. `crop: false` draws the whole
 * frame, as the Crop pane shows it.
 */
export function renderEdit(
  source: Drawable,
  edit: Edit,
  maxSide: number,
  options: { crop?: boolean; document?: Document } = {},
): HTMLCanvasElement {
  const doc = options.document ?? document;
  const frame = turnedSize(source.width, source.height, edit);
  const crop = options.crop === false ? { x: 0, y: 0, width: 1, height: 1 } : (edit.crop ?? null);
  const area = crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const fullWidth = frame.width * area.width;
  const fullHeight = frame.height * area.height;
  const scale = Math.min(1, maxSide / Math.max(fullWidth, fullHeight));
  const canvas = doc.createElement("canvas");
  canvas.width = Math.max(1, Math.round(fullWidth * scale));
  canvas.height = Math.max(1, Math.round(fullHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  context.imageSmoothingQuality = "high";
  context.scale(scale, scale);
  context.translate(-area.x * frame.width, -area.y * frame.height);
  context.translate(frame.width / 2, frame.height / 2);
  if (edit.straighten) {
    context.rotate((edit.straighten * Math.PI) / 180);
    const enlarge = straightenScale(frame.width, frame.height, edit.straighten);
    context.scale(enlarge, enlarge);
  }
  if (edit.vertical || edit.horizontal) {
    context.drawImage(
      perspectiveFrame(source, edit, scale, doc),
      -frame.width / 2,
      -frame.height / 2,
      frame.width,
      frame.height,
    );
  } else {
    drawTurned(context, source, edit, doc);
  }
  const adjusted =
    !Object.values(edit.adjust).every((value) => value === 0) || edit.filter !== "none";
  const toned = edit.levels !== null || edit.curve.length > 0 || edit.channels !== undefined;
  if (adjusted || toned || edit.selective) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    if (adjusted) adjustPixels(pixels, edit.adjust, edit.filter);
    if (toned) {
      const table = toneTable(edit.levels, edit.curve);
      const tableOf = (channel: ToneChannel) => {
        const own = edit.channels?.[channel];
        return own ? toneTable(own.levels, own.curve) : null;
      };
      const red = tableOf("red");
      const green = tableOf("green");
      const blue = tableOf("blue");
      const { data } = pixels;
      for (let at = 0; at < data.length; at += 4) {
        const r = table[data[at] ?? 0] ?? 0;
        const g = table[data[at + 1] ?? 0] ?? 0;
        const b = table[data[at + 2] ?? 0] ?? 0;
        data[at] = red ? (red[r] ?? 0) : r;
        data[at + 1] = green ? (green[g] ?? 0) : g;
        data[at + 2] = blue ? (blue[b] ?? 0) : b;
      }
    }
    if (edit.selective) selectPixels(pixels, edit.selective);
    context.putImageData(pixels, 0, 0);
  }
  return canvas;
}

/**
 * Encodes a canvas as a JPEG at each quality in turn and resolves with the first that is at
 * most `maxBytes`, or `null` when none is (or the browser encodes none).
 */
export async function encodeJpeg(
  canvas: HTMLCanvasElement,
  maxBytes: number,
  qualities: readonly number[] = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4],
): Promise<Blob | null> {
  for (const quality of qualities) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= maxBytes) return blob;
  }
  return null;
}
