"use client";

import { Checkbox } from "macalicious/checkbox";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { Slider } from "macalicious/slider";
import { SystemImage } from "macalicious/system-image";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ADJUSTMENTS,
  type Adjust,
  aspectFits,
  autoAdjust,
  bandOf,
  beforeChannelCurves,
  type Crop,
  type CropHandle,
  CURVE_GAP,
  type CurvePick,
  cropToAspect,
  type Drawable,
  dragCrop,
  type Edit,
  FILTERS,
  flipEdit,
  histogramOf,
  horizonAngle,
  type Levels,
  MAX_CURVE_POINTS,
  MAX_EDIT_SPOTS,
  MAX_EDIT_STROKES,
  type MarkStroke,
  meanOf,
  NO_ADJUST,
  NO_EDIT,
  neutralBalance,
  pointOnOriginal,
  renderEdit,
  SELECTIVE_BANDS,
  type SelectiveBand,
  type SelectiveShifts,
  type Spot,
  sampleEdit,
  skinBalance,
  skinPixels,
  TONE_CHANNELS,
  type ToneChannel,
  thinStroke,
  turnedSize,
  turnLeft,
  withBandShift,
  withChannelTone,
  withCurvePick,
} from "./photos-edit";

/**
 * The tools of the Adjust pane that act on the picture: Retouch or Red-eye, an eyedropper, which
 * reads the picture where it is clicked and is put down again, or Markup's pen.
 */
export type SpotTool =
  | { kind: Spot["kind"]; radius: number }
  | { kind: "pick"; name: string; take: (point: { x: number; y: number }) => void }
  | { kind: "draw"; color: string; width: number };

/** The furthest the editor's stage zooms in. */
export const MAX_EDIT_ZOOM = 4;

/** A scale after a pinch, which a browser reports as a wheel event with the Control key. */
export const pinchedScale = (scale: number, deltaY: number, max: number) =>
  Math.min(max, Math.max(1, scale * Math.exp(-deltaY * 0.01)));

/** Markup's colours, as the Mac's standard swatches. */
const MARK_COLORS: readonly { id: string; name: string }[] = [
  { id: "#ff3b30", name: "Red" },
  { id: "#ffcc00", name: "Yellow" },
  { id: "#34c759", name: "Green" },
  { id: "#007aff", name: "Blue" },
  { id: "#000000", name: "Black" },
  { id: "#ffffff", name: "White" },
];
const MARK_WIDTH = 0.006;

/** What a new Levels starts from: changes nothing. */
const PLAIN_LEVELS: Levels = { black: 0, gamma: 1, white: 1 };

/** All three colours together, or one alone. */
type ChannelChoice = ToneChannel | "rgb";
const CHANNEL_NAMES: Readonly<Record<ChannelChoice, string>> = {
  rgb: "RGB",
  red: "Red",
  green: "Green",
  blue: "Blue",
};

const toneOf = (draft: Edit, channel: ChannelChoice) =>
  channel === "rgb"
    ? { levels: draft.levels, curve: draft.curve }
    : (draft.channels?.[channel] ?? { levels: null, curve: [] });

function withTone(
  draft: Edit,
  channel: ChannelChoice,
  change: { levels?: Levels | null; curve?: Edit["curve"] },
): Edit {
  if (channel === "rgb") return { ...draft, ...change };
  return {
    ...draft,
    channels: withChannelTone(draft.channels, channel, { ...toneOf(draft, channel), ...change }),
  };
}

/** The draft with Levels, or Curves, of all three colours and of each alone taken off. */
function withoutTones(draft: Edit, part: "levels" | "curve"): Edit {
  const empty = part === "levels" ? { levels: null } : { curve: [] };
  let next: Edit = { ...draft, ...empty };
  for (const channel of TONE_CHANNELS) next = withTone(next, channel, empty);
  return next;
}

/** The draft with what `from` held of Levels, or Curves, put back. */
function withTonesOf(draft: Edit, from: Edit, part: "levels" | "curve"): Edit {
  const taken = (channel: ChannelChoice) =>
    part === "levels"
      ? { levels: toneOf(from, channel).levels }
      : { curve: toneOf(from, channel).curve };
  let next: Edit = withTone(draft, "rgb", taken("rgb"));
  for (const channel of TONE_CHANNELS) next = withTone(next, channel, taken(channel));
  return next;
}

const tonesHeld = (draft: Edit, part: "levels" | "curve") =>
  (["rgb", ...TONE_CHANNELS] as const).some((channel) =>
    part === "levels"
      ? toneOf(draft, channel).levels !== null
      : toneOf(draft, channel).curve.length > 0,
  );

/** What each tool's tick has taken off, to put back; the panel owns it so Reset Adjustments can forget it. */
interface HeldTools {
  retouch?: readonly Spot[];
  "red-eye"?: readonly Spot[];
  markup?: readonly MarkStroke[];
  whiteBalance?: Pick<Adjust, "warmth" | "tint">;
  levels?: Edit;
  curve?: Edit;
  selective?: SelectiveShifts;
}

/** A tool's tick: off while it holds nothing, with what it held kept to put back. */
function tickOf<T>(
  held: T | undefined,
  keep: (held: T | undefined) => void,
  holds: boolean,
  take: () => T,
  clear: () => void,
  restore: (held: T) => void,
) {
  const off = held !== undefined && !holds;
  return {
    off,
    held: off ? held : undefined,
    toggle: (on: boolean) => {
      if (on) {
        if (held !== undefined) restore(held);
        keep(undefined);
      } else {
        keep(take());
        clear();
      }
    },
  };
}

// Overlapping spots draw in order, across tools and across ticks, so each spot keeps a number
// from the first time a tick sees the list, in the list's order.
const SPOT_ORDER = new WeakMap<Spot, number>();
let nextSpotOrder = 0;
const numberSpots = (spots: readonly Spot[]) => {
  for (const spot of spots) {
    if (!SPOT_ORDER.has(spot)) SPOT_ORDER.set(spot, nextSpotOrder++);
  }
};
const inSpotOrder = (spots: readonly Spot[]) =>
  [...spots].sort((a, b) => (SPOT_ORDER.get(a) ?? 0) - (SPOT_ORDER.get(b) ?? 0));

/**
 * An eyedropper: `toggle` picks it up, and a click on the picture puts it down and calls `take` as
 * it is on that render, so it works on the draft as it is then. It is put down with the pane.
 */
function useEyedropper(
  name: string,
  { tool, onToolChange }: Pick<EditPanelProps, "tool" | "onToolChange">,
  take: (point: { x: number; y: number }) => void,
) {
  const on = tool?.kind === "pick" && tool.name === name;
  const latest = useRef(take);
  latest.current = take;
  const putDown = useRef<(() => void) | null>(null);
  putDown.current = on ? () => onToolChange?.(null) : null;
  useEffect(() => () => putDown.current?.(), []);
  return {
    on,
    toggle: () =>
      onToolChange?.(
        on
          ? null
          : {
              kind: "pick",
              name,
              take: (point) => {
                onToolChange?.(null);
                latest.current(point);
              },
            },
      ),
  };
}

/** The button that picks up an eyedropper; pressed while it is held. */
function EyedropperButton({
  label,
  dropper,
  children,
}: {
  label: string;
  dropper: { on: boolean; toggle: () => void };
  children?: string;
}) {
  return (
    <PushButton
      size="small"
      aria-label={label}
      title={label}
      aria-pressed={dropper.on}
      onClick={dropper.toggle}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <path d="M9.8.9a1.2 1.2 0 0 1 1.7 1.7L9.7 4.4l.6.6-.9.9-.6-.6-4.9 4.9-2 .6-.7-.7.6-2 4.9-4.9-.6-.6.9-.9.6.6zM6.9 3.9 2.7 8.1l-.3 1.5 1.5-.3 4.2-4.2z" />
      </svg>
      {children ? ` ${children}` : null}
    </PushButton>
  );
}

/** Selective Color: a swatch per range of hues, its eyedropper, and Hue, Saturation and Luminance. */
function SelectiveSection({
  source,
  draft,
  onDraftChange,
  tool,
  onToolChange,
  held,
  keep,
}: Pick<EditPanelProps, "source" | "draft" | "onDraftChange" | "tool" | "onToolChange"> & {
  held: SelectiveShifts | undefined;
  keep: (held: SelectiveShifts | undefined) => void;
}) {
  const [band, setBand] = useState<SelectiveBand>("red");
  const [note, setNote] = useState<string | null>(null);
  const dropper = useEyedropper(
    "Click a colour to choose its range",
    { tool, onToolChange },
    ({ x, y }) => {
      const sample = sampleEdit(source, { ...draft, selective: undefined }, x, y, STAGE_SIDE);
      if (!sample) return;
      const found = bandOf(...meanOf(sample));
      if (found) setBand(found);
      setNote(found ? null : "That point is gray, so it has no colour range.");
    },
  );
  const group = useId();
  const shift = draft.selective?.[band] ?? { hue: 0, saturation: 0, luminance: 0 };
  const ticked = tickOf<SelectiveShifts>(
    held,
    keep,
    draft.selective !== undefined,
    () => draft.selective ?? {},
    () => onDraftChange({ ...draft, selective: undefined }),
    (kept) => onDraftChange({ ...draft, selective: kept }),
  );
  const rows = [
    { key: "hue", name: "Hue" },
    { key: "saturation", name: "Saturation" },
    { key: "luminance", name: "Luminance" },
  ] as const;
  return (
    <section className="mac-photos-edit-section" aria-label="Selective Color">
      <h3 className="mac-photos-edit-heading">
        <Checkbox
          size="small"
          checked={!ticked.off}
          disabled={draft.selective === undefined && !ticked.off}
          onCheckedChange={(next) => ticked.toggle(next === true)}
        >
          Selective Color
        </Checkbox>
      </h3>
      <fieldset className="mac-photos-hues" aria-label="Color range">
        {SELECTIVE_BANDS.map((each) => (
          <input
            key={each.id}
            type="radio"
            name={group}
            checked={band === each.id}
            aria-label={each.name}
            title={each.name}
            className="mac-photos-hue"
            data-band={each.id}
            onChange={() => setBand(each.id)}
          />
        ))}
      </fieldset>
      <div className="mac-photos-edit-actions">
        <EyedropperButton label="Selective Color eyedropper" dropper={dropper} />
      </div>
      {note ? (
        <Label role="status" textStyle="small" color="secondary">
          {note}
        </Label>
      ) : null}
      {rows.map((row) => (
        <div key={row.key} className="mac-photos-adjust-row">
          <Label textStyle="small" className="mac-photos-adjust-name">
            {row.name}
          </Label>
          <Label textStyle="small" color="secondary" className="mac-photos-adjust-value">
            {shift[row.key].toFixed(2)}
          </Label>
          <Slider
            aria-label={`Selective Color ${row.name}`}
            size="small"
            className="mac-photos-adjust-slider"
            min={-1}
            max={1}
            step={0.01}
            value={shift[row.key]}
            onValueChange={(value) =>
              onDraftChange({
                ...draft,
                selective: withBandShift(draft.selective, band, {
                  ...shift,
                  [row.key]: value as number,
                }),
              })
            }
          />
        </div>
      ))}
    </section>
  );
}

/** The panes of the editor, as its segmented control names them. */
export type EditTab = "adjust" | "filters" | "crop";

export const EDIT_TABS: readonly { id: EditTab; name: string }[] = [
  { id: "adjust", name: "Adjust" },
  { id: "filters", name: "Filters" },
  { id: "crop", name: "Crop" },
];

/** The shapes the Crop pane keeps a crop to. */
export const ASPECTS = [
  { id: "free", name: "Freeform", ratio: null },
  { id: "original", name: "Original", ratio: null },
  { id: "square", name: "Square", ratio: 1 },
  { id: "16:9", name: "16:9", ratio: 16 / 9 },
  { id: "4:3", name: "4:3", ratio: 4 / 3 },
  { id: "3:2", name: "3:2", ratio: 3 / 2 },
  { id: "5:4", name: "5:4", ratio: 5 / 4 },
  { id: "7:5", name: "7:5", ratio: 7 / 5 },
  { id: "4:5", name: "8:10", ratio: 4 / 5 },
] as const;

export type AspectId = (typeof ASPECTS)[number]["id"];

/** The longer side the stage draws its preview at, in pixels. */
const STAGE_SIDE = 1400;
/** The side of a filter's preview in the Filters pane, in pixels. */
const FILTER_PREVIEW_SIDE = 96;
/** How far an arrow key moves a crop handle, as a fraction of the frame. */
const NUDGE = 0.01;
/** A new Retouch or Red-eye spot's radius, as a fraction of the longer side. */
const SPOT_RADIUS = 0.02;

/** The width-over-height of an aspect in pixels of the frame, or `null` for freeform. */
export function aspectRatio(
  aspect: AspectId,
  frame: { width: number; height: number },
): number | null {
  if (aspect === "original") return frame.width / frame.height;
  return ASPECTS.find((each) => each.id === aspect)?.ratio ?? null;
}

const WHOLE: Crop = { x: 0, y: 0, width: 1, height: 1 };

const HANDLES: readonly { handle: Exclude<CropHandle, "move">; name: string }[] = [
  { handle: "nw", name: "Top left corner of the crop" },
  { handle: "ne", name: "Top right corner of the crop" },
  { handle: "sw", name: "Bottom left corner of the crop" },
  { handle: "se", name: "Bottom right corner of the crop" },
  { handle: "n", name: "Top edge of the crop" },
  { handle: "e", name: "Right edge of the crop" },
  { handle: "s", name: "Bottom edge of the crop" },
  { handle: "w", name: "Left edge of the crop" },
];

export interface EditStageProps {
  /** The original, scaled down for editing. */
  source: Drawable;
  draft: Edit;
  tab: EditTab;
  /** The crop's shape in pixels of the frame, or `null` for freeform. */
  ratio: number | null;
  onCropChange: (crop: Crop) => void;
  /** The Retouch or Red-eye tool, which takes a click on the picture. */
  tool?: SpotTool | null;
  /** A click with the tool, already placed on the original. */
  onSpot?: (spot: Spot) => void;
  /** A line drawn with Markup's pen, already placed on the original. */
  onStroke?: (stroke: MarkStroke) => void;
  /** How far in the stage is zoomed, from 1 (fitted) to `MAX_EDIT_ZOOM`, cut to the stage. */
  zoom?: number;
  /** A pinch asks for another zoom. */
  onZoomChange?: (zoom: number) => void;
}

/**
 * The picture being edited: the draft drawn from the original, whole in the Crop pane with the
 * crop over it, its corners dragged with the pointer or moved with the arrow keys.
 */
export function EditStage({
  source,
  draft,
  tab,
  ratio,
  onCropChange,
  tool = null,
  onSpot,
  onStroke,
  zoom = 1,
  onZoomChange,
}: EditStageProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState<{
    points: readonly (readonly [number, number])[];
    color: string;
    side: number;
  } | null>(null);
  const cropping = tab === "crop";
  const panning = zoom > 1 && !cropping && !(tool && tab === "adjust");
  const frame = turnedSize(source.width, source.height, draft);
  const crop = draft.crop ?? WHOLE;
  const shape = cropping
    ? frame.width / frame.height
    : (frame.width * crop.width) / (frame.height * crop.height);
  // The frame's shape as fractions, which a drag keeps the crop to.
  const fractionRatio = ratio === null ? null : (ratio * frame.height) / frame.width;

  useEffect(() => {
    const shown = canvas.current;
    if (!shown) return;
    const frameId = requestAnimationFrame(() => {
      const drawn = renderEdit(source, draft, STAGE_SIDE, { crop: !cropping });
      shown.width = drawn.width;
      shown.height = drawn.height;
      shown.getContext("2d")?.drawImage(drawn, 0, 0);
    });
    return () => cancelAnimationFrame(frameId);
  }, [source, draft, cropping]);

  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const pinch = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      onZoomChange?.(pinchedScale(zoom, event.deltaY, MAX_EDIT_ZOOM));
    };
    element.addEventListener("wheel", pinch, { passive: false });
    return () => element.removeEventListener("wheel", pinch);
  }, [zoom, onZoomChange]);

  /** Drags the zoomed picture, no further than its edge reaching the stage's. */
  const startPan = (event: PointerEvent<HTMLElement>) => {
    const frameElement = stage.current;
    if (!frameElement || event.button !== 0) return;
    const [x0, y0] = [event.clientX, event.clientY];
    const start = pan;
    const reach = (zoom - 1) / 2;
    const hold = (value: number, side: number) =>
      Math.min(side * reach, Math.max(-side * reach, value));
    const move = (next: globalThis.PointerEvent) =>
      setPan({
        x: hold(start.x + next.clientX - x0, frameElement.offsetWidth),
        y: hold(start.y + next.clientY - y0, frameElement.offsetHeight),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** A line with Markup's pen: shown as it is drawn, and placed on the original when let go. */
  const startStroke =
    (pen: { color: string; width: number }) => (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const target = event.currentTarget;
      target.setPointerCapture?.(event.pointerId);
      const box = target.getBoundingClientRect();
      const side = pen.width * Math.max(box.width, box.height);
      const points: [number, number][] = [];
      const add = ({ clientX, clientY }: { clientX: number; clientY: number }) => {
        points.push([(clientX - box.left) / box.width, (clientY - box.top) / box.height]);
        setDrawing({ points: [...points], color: pen.color, side });
      };
      add(event);
      const end = () => {
        target.removeEventListener("pointermove", add);
        target.removeEventListener("pointerup", end);
        target.removeEventListener("pointercancel", end);
        setDrawing(null);
        const placed = points
          .map(([across, down]) =>
            pointOnOriginal(draft, source.width, source.height, across, down),
          )
          .filter(({ x, y }) => x >= 0 && x <= 1 && y >= 0 && y <= 1)
          .map(({ x, y }) => [x, y] as const);
        if (placed.length > 0) {
          onStroke?.({ color: pen.color, width: pen.width, points: thinStroke(placed) });
        }
      };
      target.addEventListener("pointermove", add);
      target.addEventListener("pointerup", end);
      target.addEventListener("pointercancel", end);
    };

  const drag = (handle: CropHandle) => (event: PointerEvent<HTMLElement>) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    const start = { ...crop };
    const [x0, y0] = [event.clientX, event.clientY];
    const move = (next: globalThis.PointerEvent) => {
      onCropChange(
        dragCrop(
          start,
          handle,
          (next.clientX - x0) / box.width,
          (next.clientY - y0) / box.height,
          fractionRatio,
        ),
      );
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  };

  const nudge = (handle: CropHandle) => (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? NUDGE * 10 : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const by = moves[event.key];
    if (!by) return;
    event.preventDefault();
    onCropChange(dragCrop(crop, handle, by[0], by[1], fractionRatio));
  };

  return (
    <div
      ref={area}
      className="mac-photos-edit-stage"
      data-zoomed={zoom > 1 ? "" : undefined}
      data-panning={panning ? "" : undefined}
      onPointerDown={panning ? startPan : undefined}
    >
      <div
        ref={stage}
        className="mac-photos-edit-frame"
        style={
          {
            "--mac-photos-aspect": shape,
            transform: zoom === 1 ? undefined : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          } as CSSProperties
        }
      >
        <canvas
          ref={canvas}
          className="mac-photos-edit-canvas"
          aria-label="The photo being edited"
        />
        {tool?.kind === "draw" && tab === "adjust" ? (
          <button
            type="button"
            className="mac-photos-spot-layer"
            aria-label="Draw on the photo"
            onPointerDown={startStroke(tool)}
          />
        ) : tool && tab === "adjust" ? (
          <button
            type="button"
            className="mac-photos-spot-layer"
            aria-label={
              tool.kind === "pick"
                ? tool.name
                : tool.kind === "red-eye"
                  ? "Click an eye to fix"
                  : "Click a spot to retouch"
            }
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const across = (event.clientX - box.left) / box.width;
              const down = (event.clientY - box.top) / box.height;
              if (tool.kind === "pick") {
                tool.take({ x: across, y: down });
                return;
              }
              if (tool.kind === "draw") return;
              const { x, y } = pointOnOriginal(draft, source.width, source.height, across, down);
              if (x < 0 || x > 1 || y < 0 || y > 1) return;
              onSpot?.({ x, y, radius: tool.radius, kind: tool.kind });
            }}
          />
        ) : null}
        {drawing ? (
          <svg
            className="mac-photos-mark-preview"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points={drawing.points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={drawing.color}
              strokeWidth={drawing.side}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
        {cropping ? (
          <fieldset
            className="mac-photos-crop"
            aria-label="Crop"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
            }}
          >
            <button
              type="button"
              className="mac-photos-crop-area"
              aria-label="Move the crop"
              onPointerDown={drag("move")}
              onKeyDown={nudge("move")}
            />
            {HANDLES.filter(({ handle }) => ratio === null || handle.length === 2).map(
              ({ handle, name }) => (
                <button
                  key={handle}
                  type="button"
                  className="mac-photos-crop-handle"
                  data-corner={handle}
                  aria-label={name}
                  onPointerDown={drag(handle)}
                  onKeyDown={nudge(handle)}
                />
              ),
            )}
          </fieldset>
        ) : null}
      </div>
    </div>
  );
}

export interface EditPanelProps {
  tab: EditTab;
  source: Drawable;
  draft: Edit;
  onDraftChange: (edit: Edit) => void;
  aspect: AspectId;
  onAspectChange: (aspect: AspectId) => void;
  tool?: SpotTool | null;
  onToolChange?: (tool: SpotTool | null) => void;
}

const percent = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)}`;

/** The inspector beside the stage: the Adjust, Filters or Crop pane. */
export function EditPanel({
  tab,
  source,
  draft,
  onDraftChange,
  aspect,
  onAspectChange,
  tool = null,
  onToolChange,
}: EditPanelProps) {
  return (
    <ScrollView className="mac-photos-edit-panel">
      {tab === "adjust" ? (
        <AdjustPane
          source={source}
          draft={draft}
          onDraftChange={onDraftChange}
          tool={tool}
          onToolChange={onToolChange}
        />
      ) : tab === "filters" ? (
        <FiltersPane source={source} draft={draft} onDraftChange={onDraftChange} />
      ) : (
        <CropPane
          source={source}
          draft={draft}
          onDraftChange={onDraftChange}
          aspect={aspect}
          onAspectChange={onAspectChange}
        />
      )}
    </ScrollView>
  );
}

function AdjustPane({
  source,
  draft,
  onDraftChange,
  tool,
  onToolChange,
}: Pick<EditPanelProps, "source" | "draft" | "onDraftChange" | "tool" | "onToolChange">) {
  const auto = () => {
    const sample = renderEdit(source, { ...NO_EDIT, rotate: 0 }, 256);
    const context = sample.getContext("2d");
    if (!context) return;
    const pixels = context.getImageData(0, 0, sample.width, sample.height);
    setParked({});
    onDraftChange({ ...draft, adjust: autoAdjust(pixels) });
  };
  // The sections ticked off, with what their sliders held, which a tick puts back.
  const [parked, setParked] = useState<Partial<Record<string, Partial<Adjust>>>>({});
  const [held, setHeld] = useState<HeldTools>({});
  const keep =
    <K extends keyof HeldTools>(tool: K) =>
    (value: HeldTools[K]) =>
      setHeld((now) => ({ ...now, [tool]: value }));
  const keysOf = (section: string) =>
    ADJUSTMENTS.filter((each) => each.section === section).map((each) => each.key);
  // Off while its sliders still hold nothing: an Undo that brings a value back turns it on.
  const isOff = (section: string) =>
    parked[section] !== undefined && keysOf(section).every((key) => draft.adjust[key] === 0);
  const tick = (section: string, on: boolean) => {
    if (on) {
      const held = parked[section];
      setParked(({ [section]: _, ...rest }) => rest);
      if (held) onDraftChange({ ...draft, adjust: { ...draft.adjust, ...held } });
      return;
    }
    const keys = keysOf(section);
    setParked((now) => ({
      ...now,
      [section]: Object.fromEntries(keys.map((key) => [key, draft.adjust[key]])),
    }));
    onDraftChange({
      ...draft,
      adjust: { ...draft.adjust, ...Object.fromEntries(keys.map((key) => [key, 0])) },
    });
  };
  return (
    <div className="mac-photos-edit-pane">
      <div className="mac-photos-edit-actions">
        <PushButton size="small" onClick={auto}>
          Auto Enhance
        </PushButton>
        <PushButton
          size="small"
          disabled={
            Object.values(draft.adjust).every((value) => value === 0) &&
            draft.levels === null &&
            draft.curve.length === 0 &&
            !draft.channels &&
            !draft.selective &&
            draft.spots.length === 0 &&
            !draft.marks?.length &&
            Object.keys(parked).length === 0 &&
            Object.values(held).every((tool) => tool === undefined)
          }
          onClick={() => {
            setParked({});
            setHeld({});
            onDraftChange({
              ...draft,
              adjust: NO_ADJUST,
              levels: null,
              curve: [],
              channels: undefined,
              selective: undefined,
              spots: [],
              marks: undefined,
            });
          }}
        >
          Reset Adjustments
        </PushButton>
      </div>
      <SpotSection
        kind="retouch"
        title="Retouch"
        held={held.retouch}
        keep={keep("retouch")}
        draft={draft}
        onDraftChange={onDraftChange}
        tool={tool ?? null}
        onToolChange={onToolChange}
      />
      <SpotSection
        kind="red-eye"
        title="Red-eye"
        held={held["red-eye"]}
        keep={keep("red-eye")}
        draft={draft}
        onDraftChange={onDraftChange}
        tool={tool ?? null}
        onToolChange={onToolChange}
      />
      <LevelsSection
        source={source}
        draft={draft}
        onDraftChange={onDraftChange}
        held={held.levels}
        keep={keep("levels")}
      />
      <CurveSection
        source={source}
        draft={draft}
        onDraftChange={onDraftChange}
        tool={tool}
        onToolChange={onToolChange}
        held={held.curve}
        keep={keep("curve")}
      />
      <SelectiveSection
        source={source}
        draft={draft}
        onDraftChange={onDraftChange}
        tool={tool}
        onToolChange={onToolChange}
        held={held.selective}
        keep={keep("selective")}
      />
      <WhiteBalanceSection
        source={source}
        draft={draft}
        onDraftChange={onDraftChange}
        tool={tool}
        onToolChange={onToolChange}
        held={held.whiteBalance}
        keep={keep("whiteBalance")}
      />
      <MarkupSection
        draft={draft}
        onDraftChange={onDraftChange}
        tool={tool ?? null}
        onToolChange={onToolChange}
        held={held.markup}
        keep={keep("markup")}
      />
      {(
        [
          "Light",
          "Color",
          "Black & White",
          "Definition",
          "Sharpen",
          "Noise Reduction",
          "Vignette",
        ] as const
      ).map((section) => (
        <section key={section} className="mac-photos-edit-section" aria-label={section}>
          <h3 className="mac-photos-edit-heading">
            <Checkbox
              size="small"
              checked={!isOff(section)}
              onCheckedChange={(next) => tick(section, next === true)}
            >
              {section}
            </Checkbox>
          </h3>
          {ADJUSTMENTS.filter((each) => each.section === section).map(({ key, name }) => (
            <div key={key} className="mac-photos-adjust-row">
              <Label textStyle="small" className="mac-photos-adjust-name">
                {name}
              </Label>
              <Label textStyle="small" color="secondary" className="mac-photos-adjust-value">
                {percent(draft.adjust[key])}
              </Label>
              <Slider
                aria-label={name}
                size="small"
                disabled={isOff(section)}
                className="mac-photos-adjust-slider"
                min={-1}
                max={1}
                step={0.01}
                value={draft.adjust[key]}
                onValueChange={(value) =>
                  onDraftChange({ ...draft, adjust: { ...draft.adjust, [key]: value as number } })
                }
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** Retouch or Red-eye: the tool's button, its size, and taking its spots back off. */
function SpotSection({
  kind,
  title,
  held,
  keep,
  draft,
  onDraftChange,
  tool,
  onToolChange,
}: {
  kind: Spot["kind"];
  title: string;
  held: readonly Spot[] | undefined;
  keep: (held: readonly Spot[] | undefined) => void;
  draft: Edit;
  onDraftChange: (edit: Edit) => void;
  tool: SpotTool | null;
  onToolChange?: (tool: SpotTool | null) => void;
}) {
  const on = tool?.kind === kind;
  const count = draft.spots.filter((spot) => spot.kind === kind).length;
  const radius = on ? tool.radius : SPOT_RADIUS;
  const ticked = tickOf<readonly Spot[]>(
    held,
    keep,
    count > 0,
    () => {
      numberSpots(draft.spots);
      return draft.spots.filter((spot) => spot.kind === kind);
    },
    () => onDraftChange({ ...draft, spots: draft.spots.filter((spot) => spot.kind !== kind) }),
    (spots) => {
      numberSpots(draft.spots);
      onDraftChange({ ...draft, spots: inSpotOrder([...draft.spots, ...spots]) });
    },
  );
  const noRoom = (ticked.held?.length ?? 0) + draft.spots.length > MAX_EDIT_SPOTS;
  return (
    <section className="mac-photos-edit-section" aria-label={title}>
      <h3 className="mac-photos-edit-heading">
        <Checkbox
          size="small"
          checked={!ticked.off}
          disabled={(count === 0 && !ticked.off) || noRoom}
          title={noRoom ? `A photo holds at most ${MAX_EDIT_SPOTS} spots` : undefined}
          onCheckedChange={(next) => ticked.toggle(next === true)}
        >
          {title}
        </Checkbox>
      </h3>
      <div className="mac-photos-edit-actions">
        <PushButton
          size="small"
          aria-pressed={on}
          disabled={!on && draft.spots.length >= MAX_EDIT_SPOTS}
          onClick={() => onToolChange?.(on ? null : { kind, radius: SPOT_RADIUS })}
        >
          {on ? `Stop ${title}` : title}
        </PushButton>
        <PushButton
          size="small"
          aria-label={`Reset ${title}`}
          disabled={count === 0}
          onClick={() =>
            onDraftChange({
              ...draft,
              spots: draft.spots.filter((spot) => spot.kind !== kind),
            })
          }
        >
          {`Reset (${count})`}
        </PushButton>
      </div>
      {on ? (
        <div className="mac-photos-adjust-row">
          <Label textStyle="small" className="mac-photos-adjust-name">
            Size
          </Label>
          <Label textStyle="small" color="secondary" className="mac-photos-adjust-value">
            {`${Math.round(radius * 1000) / 10}%`}
          </Label>
          <Slider
            aria-label={`${title} size`}
            size="small"
            className="mac-photos-adjust-slider"
            min={0.005}
            max={0.1}
            step={0.005}
            value={radius}
            onValueChange={(value) => onToolChange?.({ kind, radius: value as number })}
          />
        </div>
      ) : null}
    </section>
  );
}

/** The pop-up that chooses what Levels or Curves work on. */
function ChannelPopUp({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ChannelChoice;
  onChange: (next: ChannelChoice) => void;
}) {
  return (
    <PopUpButton<ChannelChoice>
      size="small"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
    >
      {(["rgb", ...TONE_CHANNELS] as const).map((each) => (
        <PopUpButtonItem key={each} value={each}>
          {CHANNEL_NAMES[each]}
        </PopUpButtonItem>
      ))}
    </PopUpButton>
  );
}

/** How many pixels hold each value of the chosen colour, as the picture is before its Levels. */
function Histogram({
  source,
  draft,
  channel,
}: {
  source: Drawable;
  draft: Edit;
  channel: ChannelChoice;
}) {
  const shape = useMemo(() => {
    const sample = renderEdit(source, withoutTones(draft, "levels"), 256);
    const context = sample.getContext("2d");
    if (!context) return "";
    const counts = histogramOf(context.getImageData(0, 0, sample.width, sample.height), channel);
    // The tallest few values are often the picture's clipped ends: the scale ignores all but one.
    const tallest = [...counts].sort((a, b) => b - a)[2] || 1;
    return Array.from(
      counts,
      (count, value) => `${value},${100 - Math.min(100, (count / tallest) * 100)}`,
    ).join(" ");
  }, [source, draft, channel]);
  return (
    <svg
      className="mac-photos-histogram"
      data-channel={channel}
      viewBox="0 0 255 100"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Histogram of ${CHANNEL_NAMES[channel]}`}
    >
      {shape ? <polygon points={`0,100 ${shape} 255,100`} fill="currentColor" /> : null}
    </svg>
  );
}

/** Levels: a histogram and three sliders, for all colours or one; as they were, the edit keeps none. */
function LevelsSection({
  source,
  draft,
  onDraftChange,
  held,
  keep,
}: Pick<EditPanelProps, "source" | "draft" | "onDraftChange"> & {
  held: Edit | undefined;
  keep: (held: Edit | undefined) => void;
}) {
  const [channel, setChannel] = useState<ChannelChoice>("rgb");
  const levels = toneOf(draft, channel).levels ?? PLAIN_LEVELS;
  const set = (change: Partial<Levels>) => {
    const next = { ...levels, ...change };
    const plain = next.black === 0 && next.gamma === 1 && next.white === 1;
    onDraftChange(withTone(draft, channel, { levels: plain ? null : next }));
  };
  const ticked = tickOf<Edit>(
    held,
    keep,
    tonesHeld(draft, "levels"),
    () => draft,
    () => onDraftChange(withoutTones(draft, "levels")),
    (held) => onDraftChange(withTonesOf(draft, held, "levels")),
  );
  const rows = [
    {
      name: "Black",
      value: levels.black,
      min: 0,
      max: Math.max(0, levels.white - 0.01),
      step: 0.01,
      take: (black: number) => set({ black }),
    },
    {
      name: "Midtones",
      value: levels.gamma,
      min: 0.2,
      max: 3,
      step: 0.01,
      take: (gamma: number) => set({ gamma }),
    },
    {
      name: "White",
      value: levels.white,
      min: Math.min(1, levels.black + 0.01),
      max: 1,
      step: 0.01,
      take: (white: number) => set({ white }),
    },
  ];
  return (
    <section className="mac-photos-edit-section" aria-label="Levels">
      <h3 className="mac-photos-edit-heading">
        <Checkbox
          size="small"
          checked={!ticked.off}
          disabled={!tonesHeld(draft, "levels") && !ticked.off}
          onCheckedChange={(next) => ticked.toggle(next === true)}
        >
          Levels
        </Checkbox>
      </h3>
      <ChannelPopUp label="Levels channel" value={channel} onChange={setChannel} />
      <Histogram source={source} draft={draft} channel={channel} />
      {rows.map((row) => (
        <div key={row.name} className="mac-photos-adjust-row">
          <Label textStyle="small" className="mac-photos-adjust-name">
            {row.name}
          </Label>
          <Label textStyle="small" color="secondary" className="mac-photos-adjust-value">
            {row.value.toFixed(2)}
          </Label>
          <Slider
            aria-label={`Levels ${row.name}`}
            size="small"
            className="mac-photos-adjust-slider"
            min={row.min}
            max={row.max}
            step={row.step}
            value={row.value}
            onValueChange={(value) => row.take(value as number)}
          />
        </div>
      ))}
    </section>
  );
}

/**
 * Markup: a pen that draws on the picture, with a colour and a thickness. What it draws is kept with
 * the edit, on the original, so it turns and crops with the picture.
 */
function MarkupSection({
  draft,
  onDraftChange,
  tool,
  onToolChange,
  held,
  keep,
}: {
  draft: Edit;
  onDraftChange: (edit: Edit) => void;
  tool: SpotTool | null;
  onToolChange?: (tool: SpotTool | null) => void;
  held: readonly MarkStroke[] | undefined;
  keep: (held: readonly MarkStroke[] | undefined) => void;
}) {
  const [pen, setPen] = useState({ color: MARK_COLORS[0]?.id ?? "#ff3b30", width: MARK_WIDTH });
  const on = tool?.kind === "draw";
  const marks = draft.marks ?? [];
  const full = marks.length >= MAX_EDIT_STROKES;
  const choose = (next: typeof pen) => {
    setPen(next);
    if (on) onToolChange?.({ kind: "draw", ...next });
  };
  const ticked = tickOf<readonly MarkStroke[]>(
    held,
    keep,
    marks.length > 0,
    () => marks,
    () => onDraftChange({ ...draft, marks: undefined }),
    (restored) => onDraftChange({ ...draft, marks: restored }),
  );
  return (
    <section className="mac-photos-edit-section" aria-label="Markup">
      <h3 className="mac-photos-edit-heading">
        <Checkbox
          size="small"
          checked={!ticked.off}
          disabled={marks.length === 0 && !ticked.off}
          onCheckedChange={(next) => ticked.toggle(next === true)}
        >
          Markup
        </Checkbox>
      </h3>
      <div className="mac-photos-edit-actions">
        <PushButton
          size="small"
          aria-pressed={on}
          disabled={!on && full}
          title={full ? `A photo holds at most ${MAX_EDIT_STROKES} drawn lines` : undefined}
          onClick={() => onToolChange?.(on ? null : { kind: "draw", ...pen })}
        >
          {on ? "Stop Drawing" : "Draw"}
        </PushButton>
        <PushButton
          size="small"
          disabled={marks.length === 0}
          onClick={() => {
            const left = marks.slice(0, -1);
            onDraftChange({ ...draft, marks: left.length > 0 ? left : undefined });
          }}
        >
          Remove Last
        </PushButton>
      </div>
      <div className="mac-photos-adjust-row">
        <Label textStyle="small" className="mac-photos-adjust-name">
          Color
        </Label>
        <PopUpButton<string>
          aria-label="Markup color"
          size="small"
          value={pen.color}
          onValueChange={(value) => {
            if (value) choose({ ...pen, color: value });
          }}
        >
          {MARK_COLORS.map((each) => (
            <PopUpButtonItem key={each.id} value={each.id}>
              {each.name}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </div>
      <div className="mac-photos-adjust-row">
        <Label textStyle="small" className="mac-photos-adjust-name">
          Thickness
        </Label>
        <Slider
          aria-label="Markup thickness"
          size="small"
          className="mac-photos-adjust-slider"
          min={0.002}
          max={0.03}
          step={0.001}
          value={pen.width}
          onValueChange={(value) => choose({ ...pen, width: value as number })}
        />
      </div>
    </section>
  );
}

/** White Balance's pop-up, as on a Mac. */
const BALANCE_MODES = [
  { id: "neutral", name: "Neutral Gray" },
  { id: "skin", name: "Skin Tone" },
  { id: "temperature", name: "Temperature/Tint" },
] as const;
type BalanceMode = (typeof BALANCE_MODES)[number]["id"];

/**
 * White Balance: Neutral Gray and Skin Tone set Warmth and Tint, from the whole picture with Auto or
 * from one point with their eyedropper; Temperature/Tint sets them by hand.
 */
function WhiteBalanceSection({
  source,
  draft,
  onDraftChange,
  tool,
  onToolChange,
  held,
  keep,
}: Pick<EditPanelProps, "source" | "draft" | "onDraftChange" | "tool" | "onToolChange"> & {
  held: Pick<Adjust, "warmth" | "tint"> | undefined;
  keep: (held: Pick<Adjust, "warmth" | "tint"> | undefined) => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [mode, setMode] = useState<BalanceMode>("neutral");
  const { warmth, tint } = draft.adjust;
  const unbalanced = { ...draft, adjust: { ...draft.adjust, warmth: 0, tint: 0 } };
  const balance = (result: Pick<Adjust, "warmth" | "tint">) => {
    setNote(null);
    onDraftChange({ ...draft, adjust: { ...draft.adjust, ...result } });
  };
  const ticked = tickOf<Pick<Adjust, "warmth" | "tint">>(
    held,
    keep,
    warmth !== 0 || tint !== 0,
    () => ({ warmth, tint }),
    () => balance({ warmth: 0, tint: 0 }),
    balance,
  );
  const whole = () => {
    const sample = renderEdit(source, unbalanced, 256);
    return sample.getContext("2d")?.getImageData(0, 0, sample.width, sample.height) ?? null;
  };
  const fromPoint =
    (from: typeof neutralBalance) =>
    ({ x, y }: { x: number; y: number }) => {
      const sample = sampleEdit(source, unbalanced, x, y, STAGE_SIDE);
      if (sample) balance(from(sample));
    };
  const neutralDropper = useEyedropper(
    "Click something that should be gray",
    { tool, onToolChange },
    fromPoint(neutralBalance),
  );
  const skinDropper = useEyedropper(
    "Click a person's skin",
    { tool, onToolChange },
    fromPoint(skinBalance),
  );
  return (
    <section className="mac-photos-edit-section" aria-label="White Balance">
      <h3 className="mac-photos-edit-heading">
        <Checkbox
          size="small"
          checked={!ticked.off}
          disabled={warmth === 0 && tint === 0 && !ticked.off}
          onCheckedChange={(next) => ticked.toggle(next === true)}
        >
          White Balance
        </Checkbox>
      </h3>
      <PopUpButton<BalanceMode>
        aria-label="White Balance mode"
        size="small"
        value={mode}
        onValueChange={(value) => {
          if (!value) return;
          setMode(value);
          setNote(null);
          if (tool?.kind === "pick") onToolChange?.(null);
        }}
      >
        {BALANCE_MODES.map((each) => (
          <PopUpButtonItem key={each.id} value={each.id}>
            {each.name}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
      {mode === "neutral" ? (
        <div className="mac-photos-edit-actions">
          <PushButton
            size="small"
            onClick={() => {
              const pixels = whole();
              if (pixels) balance(neutralBalance(pixels));
            }}
          >
            Auto
          </PushButton>
          <EyedropperButton label="Neutral Gray eyedropper" dropper={neutralDropper} />
        </div>
      ) : mode === "skin" ? (
        <div className="mac-photos-edit-actions">
          <PushButton
            size="small"
            onClick={() => {
              const pixels = whole();
              const skin = pixels && skinPixels(pixels);
              if (skin) balance(skinBalance(skin));
              else setNote("This picture has no skin colours to go by.");
            }}
          >
            Auto
          </PushButton>
          <EyedropperButton label="Skin Tone eyedropper" dropper={skinDropper} />
        </div>
      ) : (
        (
          [
            { key: "warmth", name: "Temperature", label: "Temperature" },
            { key: "tint", name: "Tint", label: "White Balance Tint" },
          ] as const
        ).map(({ key, name, label }) => (
          <div key={key} className="mac-photos-adjust-row">
            <Label textStyle="small" className="mac-photos-adjust-name">
              {name}
            </Label>
            <Label textStyle="small" color="secondary" className="mac-photos-adjust-value">
              {percent(draft.adjust[key])}
            </Label>
            <Slider
              aria-label={label}
              size="small"
              className="mac-photos-adjust-slider"
              min={-1}
              max={1}
              step={0.01}
              value={draft.adjust[key]}
              onValueChange={(value) =>
                onDraftChange({ ...draft, adjust: { ...draft.adjust, [key]: value as number } })
              }
            />
          </div>
        ))
      )}
      {note ? (
        <Label role="status" textStyle="small" color="secondary">
          {note}
        </Label>
      ) : null}
    </section>
  );
}

/** The colours' own curves, drawn over the graph of all three. */
const CURVE_OVERLAYS: readonly { channel: ToneChannel; stroke: string }[] = [
  { channel: "red", stroke: "var(--mac-color-system-red)" },
  { channel: "green", stroke: "var(--mac-color-system-green)" },
  { channel: "blue", stroke: "var(--mac-color-system-blue)" },
];

/** A curve's points with the line's ends where the points leave them. */
const curveLine = (points: readonly (readonly [number, number])[]) => [
  ...(points[0] && points[0][0] > 0 ? [[0, 0]] : []),
  ...(points.length === 0 ? [[0, 0]] : points),
  ...((points[points.length - 1]?.[0] ?? 0) < 1 ? [[1, 1]] : []),
];

const polylineOf = (line: readonly (readonly number[])[]) =>
  line.map(([x, y]) => `${x},${1 - (y ?? 0)}`).join(" ");

/**
 * Curves: for all colours or one, a click on the graph adds a point; a point is dragged, moved with
 * the arrow keys, or removed by a double click or Delete. The black, gray and white eyedroppers set
 * points from a pixel of the picture: on the chosen colour's curve, or with RGB on each colour's.
 */
function CurveSection({
  source,
  draft,
  onDraftChange,
  tool,
  onToolChange,
  held,
  keep,
}: Pick<EditPanelProps, "source" | "draft" | "onDraftChange" | "tool" | "onToolChange"> & {
  held: Edit | undefined;
  keep: (held: Edit | undefined) => void;
}) {
  const graph = useRef<HTMLDivElement>(null);
  const [channel, setChannel] = useState<ChannelChoice>("rgb");
  const points = toneOf(draft, channel).curve;
  const setPoints = (next: readonly (readonly [number, number])[]) =>
    onDraftChange(withTone(draft, channel, { curve: next }));
  const dropperOf =
    (pick: CurvePick) =>
    ({ x, y }: { x: number; y: number }) => {
      const sample = sampleEdit(source, beforeChannelCurves(draft), x, y, STAGE_SIDE);
      if (sample) onDraftChange(withCurvePick(draft, channel, pick, meanOf(sample)));
    };
  const blackDropper = useEyedropper(
    "Click what should be black",
    { tool, onToolChange },
    dropperOf("black"),
  );
  const grayDropper = useEyedropper(
    "Click what should be gray",
    { tool, onToolChange },
    dropperOf("gray"),
  );
  const whiteDropper = useEyedropper(
    "Click what should be white",
    { tool, onToolChange },
    dropperOf("white"),
  );
  const ticked = tickOf<Edit>(
    held,
    keep,
    tonesHeld(draft, "curve"),
    () => draft,
    () => onDraftChange(withoutTones(draft, "curve")),
    (held) => onDraftChange(withTonesOf(draft, held, "curve")),
  );
  const at = (clientX: number, clientY: number): [number, number] => {
    const box = graph.current?.getBoundingClientRect();
    if (!box) return [0, 0];
    const within = (value: number) => Math.min(1, Math.max(0, value));
    return [within((clientX - box.left) / box.width), within(1 - (clientY - box.top) / box.height)];
  };
  /** The list with point `index` moved, kept between its neighbours. */
  const moved = (index: number, x: number, y: number) => {
    const low = (points[index - 1]?.[0] ?? -CURVE_GAP) + CURVE_GAP;
    const high = (points[index + 1]?.[0] ?? 1 + CURVE_GAP) - CURVE_GAP;
    const place: [number, number] = [Math.min(high, Math.max(low, x)), y];
    return points.map((point, each) => (each === index ? place : point));
  };
  const line = curveLine(points);
  /** The middle of the widest stretch of the line between two points. */
  const widestGap = (): [number, number] => {
    let best: [number, number] = [0.5, 0.5];
    let width = -1;
    for (let at = 1; at < line.length; at += 1) {
      const [x0 = 0, y0 = 0] = line[at - 1] ?? [];
      const [x1 = 1, y1 = 1] = line[at] ?? [];
      if (x1 - x0 > width) {
        width = x1 - x0;
        best = [(x0 + x1) / 2, (y0 + y1) / 2];
      }
    }
    return best;
  };
  return (
    <section className="mac-photos-edit-section" aria-label="Curves">
      <h3 className="mac-photos-edit-heading">
        <Checkbox
          size="small"
          checked={!ticked.off}
          disabled={!tonesHeld(draft, "curve") && !ticked.off}
          onCheckedChange={(next) => ticked.toggle(next === true)}
        >
          Curves
        </Checkbox>
      </h3>
      <ChannelPopUp label="Curves channel" value={channel} onChange={setChannel} />
      <div className="mac-photos-edit-actions">
        <EyedropperButton label="Curves black eyedropper" dropper={blackDropper}>
          Black
        </EyedropperButton>
        <EyedropperButton label="Curves gray eyedropper" dropper={grayDropper}>
          Gray
        </EyedropperButton>
        <EyedropperButton label="Curves white eyedropper" dropper={whiteDropper}>
          White
        </EyedropperButton>
      </div>
      <div ref={graph} className="mac-photos-curve" data-channel={channel}>
        <button
          type="button"
          className="mac-photos-curve-area"
          aria-label="Add a curve point"
          disabled={points.length >= MAX_CURVE_POINTS}
          onClick={(event) => {
            // From the keyboard there is no pointer: the point goes in the widest gap, on the line.
            const [x, y] = event.detail === 0 ? widestGap() : at(event.clientX, event.clientY);
            if (points.some((point) => Math.abs(point[0] - x) < CURVE_GAP)) return;
            setPoints([...points, [x, y] as const].sort((a, b) => a[0] - b[0]));
          }}
        />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          {channel === "rgb"
            ? CURVE_OVERLAYS.flatMap(({ channel: colour, stroke }) => {
                const own = draft.channels?.[colour]?.curve ?? [];
                return own.length === 0
                  ? []
                  : [
                      <polyline
                        key={colour}
                        points={polylineOf(curveLine(own))}
                        fill="none"
                        stroke={stroke}
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />,
                    ];
              })
            : null}
          <polyline
            points={polylineOf(line)}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map(([x, y], index) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: a point keeps its place in the list while it is dragged, and has no other identity
            key={index}
            type="button"
            className="mac-photos-curve-point"
            aria-label={`Curve point ${index + 1}: in ${x.toFixed(2)}, out ${y.toFixed(2)}`}
            style={{ left: `${x * 100}%`, bottom: `${y * 100}%` }}
            onDoubleClick={() => setPoints(points.filter((_, each) => each !== index))}
            onKeyDown={(event) => {
              const steps: Record<string, [number, number]> = {
                ArrowLeft: [-0.01, 0],
                ArrowRight: [0.01, 0],
                ArrowUp: [0, 0.01],
                ArrowDown: [0, -0.01],
              };
              const step = steps[event.key];
              if (step) {
                event.preventDefault();
                setPoints(moved(index, x + step[0], Math.min(1, Math.max(0, y + step[1]))));
              } else if (event.key === "Delete" || event.key === "Backspace") {
                event.preventDefault();
                setPoints(points.filter((_, each) => each !== index));
              }
            }}
            onPointerDown={(event: PointerEvent<HTMLElement>) => {
              event.preventDefault();
              const target = event.currentTarget;
              target.setPointerCapture?.(event.pointerId);
              const move = (next: globalThis.PointerEvent) => {
                const [nx, ny] = at(next.clientX, next.clientY);
                setPoints(moved(index, nx, ny));
              };
              const end = () => {
                target.removeEventListener("pointermove", move);
                target.removeEventListener("pointerup", end);
                target.removeEventListener("pointercancel", end);
              };
              target.addEventListener("pointermove", move);
              target.addEventListener("pointerup", end);
              target.addEventListener("pointercancel", end);
            }}
          />
        ))}
      </div>
      <PushButton
        size="small"
        disabled={channel === "rgb" ? !tonesHeld(draft, "curve") : points.length === 0}
        onClick={() =>
          onDraftChange(
            channel === "rgb"
              ? withoutTones(draft, "curve")
              : withTone(draft, channel, { curve: [] }),
          )
        }
      >
        Reset Curve
      </PushButton>
    </section>
  );
}

function FiltersPane({
  source,
  draft,
  onDraftChange,
}: Pick<EditPanelProps, "source" | "draft" | "onDraftChange">) {
  // Each filter's look on a small copy of the photo as it is turned and cropped now, with the
  // adjustments and the filter applied together in one pass, as the stage applies them (an
  // adjusted copy kept between the two would clip its channels first and look different).
  const geometry = useMemo(
    () => ({
      ...NO_EDIT,
      rotate: draft.rotate,
      flip: draft.flip,
      straighten: draft.straighten,
      vertical: draft.vertical,
      horizontal: draft.horizontal,
      crop: draft.crop,
      spots: draft.spots,
    }),
    [
      draft.rotate,
      draft.flip,
      draft.straighten,
      draft.vertical,
      draft.horizontal,
      draft.crop,
      draft.spots,
    ],
  );
  const previews = useMemo(() => {
    const small = renderEdit(source, geometry, FILTER_PREVIEW_SIDE * 2);
    const drawable = { image: small, width: small.width, height: small.height };
    return new Map(
      FILTERS.map((filter) => [
        filter.id,
        renderEdit(
          drawable,
          {
            ...NO_EDIT,
            adjust: draft.adjust,
            filter: filter.id,
            levels: draft.levels,
            curve: draft.curve,
            channels: draft.channels,
            selective: draft.selective,
          },
          FILTER_PREVIEW_SIDE,
        ).toDataURL("image/jpeg", 0.8),
      ]),
    );
  }, [source, geometry, draft.adjust, draft.levels, draft.curve, draft.channels, draft.selective]);
  // A radio group: one tab stop, the chosen filter; the arrow keys choose the next or previous
  // one and move the keyboard to it.
  const group = useRef<HTMLDivElement>(null);
  const choose = (at: number) => {
    const next = FILTERS[(at + FILTERS.length) % FILTERS.length];
    if (!next) return;
    onDraftChange({ ...draft, filter: next.id });
    requestAnimationFrame(() =>
      group.current?.querySelector<HTMLElement>(`[data-filter="${next.id}"]`)?.focus(),
    );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = FILTERS.findIndex((filter) => filter.id === draft.filter);
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    if (event.key === "Home") choose(0);
    else if (event.key === "End") choose(FILTERS.length - 1);
    else if (moves[event.key] !== undefined) choose(at + (moves[event.key] ?? 0));
    else return;
    event.preventDefault();
  };
  return (
    <div className="mac-photos-edit-pane">
      <div
        ref={group}
        className="mac-photos-filters"
        role="radiogroup"
        aria-label="Filters"
        onKeyDown={onKeyDown}
      >
        {FILTERS.map((filter) => (
          <ImageButton
            key={filter.id}
            role="radio"
            aria-checked={draft.filter === filter.id}
            tabIndex={draft.filter === filter.id ? 0 : -1}
            className="mac-photos-filter-choice"
            data-filter={filter.id}
            data-selected={draft.filter === filter.id ? "" : undefined}
            label={filter.name}
            onClick={() => onDraftChange({ ...draft, filter: filter.id })}
          >
            <img src={previews.get(filter.id)} alt="" className="mac-photos-filter-preview" />
          </ImageButton>
        ))}
      </div>
    </div>
  );
}

function CropPane({
  source,
  draft,
  onDraftChange,
  aspect,
  onAspectChange,
}: Omit<EditPanelProps, "tab">) {
  const [note, setNote] = useState<string | null>(null);
  /** Auto: the angle that levels the horizon found in the picture's own pixels. */
  const autoStraighten = () => {
    const sample = renderEdit(source, { ...NO_EDIT, rotate: draft.rotate, flip: draft.flip }, 512);
    const pixels = sample.getContext("2d")?.getImageData(0, 0, sample.width, sample.height);
    const angle = pixels ? horizonAngle(pixels) : null;
    if (angle === null) {
      setNote("No horizon was found in this picture. Use Straighten and the crop handles.");
      return;
    }
    setNote(angle === 0 ? "The horizon is already level." : null);
    onDraftChange({ ...draft, straighten: angle });
  };
  const chooseAspect = (next: AspectId) => {
    const frame = turnedSize(source.width, source.height, draft);
    const ratio = aspectRatio(next, frame);
    // A shape this frame cannot hold at the least crop size (a square of a very wide panorama)
    // is not taken: the crop stays freeform.
    if (ratio !== null && !aspectFits(ratio, frame.width, frame.height)) {
      onAspectChange("free");
      return;
    }
    onAspectChange(next);
    onDraftChange({ ...draft, crop: cropToAspect(draft.crop, ratio, frame.width, frame.height) });
  };
  return (
    <div className="mac-photos-edit-pane">
      <section className="mac-photos-edit-section" aria-label="Straighten">
        <h3 className="mac-photos-edit-heading">Straighten</h3>
        <div className="mac-photos-adjust-row">
          <Label textStyle="small" className="mac-photos-adjust-name">
            Angle
          </Label>
          <Label textStyle="small" color="secondary" className="mac-photos-adjust-value">
            {`${draft.straighten.toFixed(1)}°`}
          </Label>
          <Slider
            aria-label="Straighten"
            size="small"
            className="mac-photos-adjust-slider"
            min={-45}
            max={45}
            step={0.5}
            value={draft.straighten}
            onValueChange={(value) => onDraftChange({ ...draft, straighten: value as number })}
          />
        </div>
        {(
          [
            { key: "vertical", name: "Vertical" },
            { key: "horizontal", name: "Horizontal" },
          ] as const
        ).map(({ key, name }) => (
          <div key={key} className="mac-photos-adjust-row">
            <Label textStyle="small" className="mac-photos-adjust-name">
              {name}
            </Label>
            <Label textStyle="small" color="secondary" className="mac-photos-adjust-value">
              {percent(draft[key] ?? 0)}
            </Label>
            <Slider
              aria-label={name}
              size="small"
              className="mac-photos-adjust-slider"
              min={-1}
              max={1}
              step={0.01}
              value={draft[key] ?? 0}
              onValueChange={(value) => onDraftChange({ ...draft, [key]: value as number })}
            />
          </div>
        ))}
      </section>
      <section className="mac-photos-edit-section" aria-label="Aspect">
        <h3 className="mac-photos-edit-heading">Aspect</h3>
        <PopUpButton<AspectId>
          aria-label="Aspect"
          size="small"
          value={aspect}
          onValueChange={(value) => {
            if (value) chooseAspect(value);
          }}
        >
          {ASPECTS.map((each) => (
            <PopUpButtonItem key={each.id} value={each.id}>
              {each.name}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </section>
      <div className="mac-photos-edit-actions">
        <PushButton
          size="small"
          onClick={() => {
            // A turned crop no longer has the chosen shape (16:9 becomes 9:16): it is free.
            if (aspect !== "free") onAspectChange("free");
            onDraftChange(turnLeft(draft));
          }}
        >
          <SystemImage name="rotate-left" /> Rotate
        </PushButton>
        <PushButton size="small" onClick={() => onDraftChange(flipEdit(draft))}>
          Flip
        </PushButton>
        <PushButton size="small" onClick={autoStraighten}>
          Auto
        </PushButton>
        <PushButton
          size="small"
          disabled={
            draft.crop === null &&
            draft.straighten === 0 &&
            !draft.vertical &&
            !draft.horizontal &&
            draft.rotate === 0 &&
            !draft.flip
          }
          onClick={() => {
            onAspectChange("free");
            onDraftChange({
              ...draft,
              crop: null,
              straighten: 0,
              vertical: undefined,
              horizontal: undefined,
              rotate: 0,
              flip: false,
            });
          }}
        >
          Reset
        </PushButton>
      </div>
      {note ? (
        <Label role="status" textStyle="small" color="secondary">
          {note}
        </Label>
      ) : null}
    </div>
  );
}
