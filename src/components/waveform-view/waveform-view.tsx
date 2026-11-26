"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { useRender } from "@base-ui/react/use-render";
import {
  type CSSProperties,
  createContext,
  type PointerEvent,
  type Ref,
  use,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useControlled } from "../../lib/use-controlled";
import "./waveform-view.tokens.css";
import "./waveform-view.css";

interface WaveformContextValue {
  samples: readonly number[];
  duration: number;
  value: number;
  setValue: (value: number) => void;
  step: number;
  largeStep: number;
  disabled: boolean;
  formatTime: (seconds: number) => string;
}

const WaveformContext = createContext<WaveformContextValue | null>(null);

function useWaveform(part: string): WaveformContextValue {
  const context = use(WaveformContext);
  if (!context) throw new Error(`${part} must be rendered inside a WaveformView.`);
  return context;
}

// Minutes and seconds: 00:03. (Line comments on the helpers here: the build keeps doc blocks,
// and they count towards the size budget.)
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Joined here, without the shared helper, to keep the component inside its size budget.
const cn = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base);

// The loudest sample between two fractions of the recording.
function peak(samples: readonly number[], from: number, to: number): number {
  const first = clamp(Math.floor(from * samples.length), 0, samples.length - 1);
  const last = clamp(Math.ceil(to * samples.length), first + 1, samples.length);
  let max = 0;
  for (let i = first; i < last; i++) {
    const sample = Math.abs(samples[i] as number);
    if (sample > max) max = sample;
  }
  return Math.min(1, max);
}

// The SVG path of bars `first` to `last` of `count`: bar i stands at `x + i * pitch`, centred
// on `axis`, `full` points tall for an amplitude of 1 and at least 1.5.
function barsPath(
  samples: readonly number[],
  count: number,
  first: number,
  last: number,
  x: number,
  pitch: number,
  axis: number,
  full: number,
): string {
  let d = "";
  for (let i = first; samples.length > 0 && i < last; i++) {
    const tall = Math.max(1.5, peak(samples, i / count, (i + 1) / count) * full);
    d += `M${(x + i * pitch).toFixed(2)} ${(axis - tall / 2).toFixed(2)}v${tall.toFixed(2)}`;
  }
  return d;
}

export interface WaveformViewProps
  extends Omit<useRender.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /**
   * The recording's amplitude envelope: numbers from 0 (silence) to 1 (full scale), evenly
   * spaced over `duration`. Each bar shows the loudest sample of its stretch of time, so any
   * resolution works; 20 samples a second is as fine as the detailed view draws.
   */
  samples: readonly number[];
  /** Length of the recording in seconds, at most 1e6 (a longer one is shown as that long). */
  duration: number;
  /** The position in seconds, from 0 to `duration`. Controlled; see `defaultValue`. */
  value?: number;
  /**
   * The position in seconds the view starts at, when `value` is not given.
   * @default 0
   */
  defaultValue?: number;
  /** Called with the new position in seconds when the user seeks. */
  onValueChange?: (value: number) => void;
  /**
   * Seconds an arrow key moves the position.
   * @default 0.25
   */
  step?: number;
  /**
   * Seconds Page Up, Page Down or an arrow key with Shift moves the position.
   * @default 1
   */
  largeStep?: number;
  /**
   * Shows the recording without letting the position be changed.
   * @default false
   */
  disabled?: boolean;
  /**
   * Writes a time in seconds for the ruler, the overview's labels and the slider's value text,
   * which is the position.
   * @default minutes and seconds, `00:03`
   */
  formatTime?: (seconds: number) => string;
}

/** The waveform of Voice Memos: holds the recording and the position for the two views. */
export function WaveformView({
  samples,
  duration,
  value: controlled,
  defaultValue = 0,
  onValueChange,
  step = 0.25,
  largeStep = 1,
  disabled = false,
  formatTime = clock,
  className,
  render,
  ref,
  children,
  ...props
}: WaveformViewProps) {
  // A duration beyond 1e6 s (eleven days) counts as that: the loops below count in whole
  // seconds and bars, which larger numbers cannot do.
  const length = Number.isFinite(duration) && duration > 0 ? Math.min(duration, 1e6) : 0;
  const [raw, setValue] = useControlled(controlled, defaultValue, onValueChange);
  const context = {
    samples,
    duration: length,
    value: clamp(raw || 0, 0, length),
    setValue,
    step,
    largeStep,
    disabled,
    formatTime,
  };
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "group",
      "data-disabled": disabled ? "" : undefined,
      ...props,
      className: cn("mac-waveform-view", className),
      children: <WaveformContext value={context}>{children}</WaveformContext>,
    },
  });
}

// A bar every 4.15 pt around an axis 121.65 pt down (measured), 200 pt for an amplitude of 1
// (provisional). 924 pt are drawn either side of the playhead and nothing further out.
const BAR_PITCH = 4.15;
const REACH = 924;

export interface WaveformViewDetailProps extends Omit<useRender.ComponentProps<"div">, "children"> {
  /**
   * Points of width per second of audio, from 1 to 10000. Voice Memos draws 77.
   * @default 77
   */
  scale?: number;
}

/**
 * The detailed waveform, a picture that scrolls under a fixed playhead and can be dragged. It
 * draws 924 pt either side of the playhead, so it is at most 1848 pt wide.
 */
export function WaveformViewDetail({
  scale: givenScale = 77,
  className,
  render,
  ref,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  ...props
}: WaveformViewDetailProps) {
  const { samples, duration, value, setValue, disabled, formatTime } =
    useWaveform("WaveformViewDetail");
  const scale = clamp(givenScale || 77, 1, 1e4);
  const drag = useRef<[number, number, number]>(undefined);
  useEffect(() => {
    if (disabled) drag.current = undefined;
  }, [disabled]);
  // Ends the drag of the pointer an event is about, after the owner's handler for that event.
  const end =
    (own?: (event: PointerEvent<HTMLDivElement>) => void) =>
    (event: PointerEvent<HTMLDivElement>) => {
      own?.(event);
      if (drag.current?.[0] === event.pointerId) drag.current = undefined;
    };

  // The stretch that is drawn moves in steps of 308 pt (four seconds at 77 pt a second), not
  // on every frame, so it is 2156 pt wide at any scale.
  const bucket = 308 / scale;
  const start = Math.floor(value / bucket) * bucket;
  const from = Math.max(0, start - REACH / scale);
  const to = start + bucket + REACH / scale;

  const bars = useMemo(() => {
    const count = Math.ceil((duration * scale - 0.75) / BAR_PITCH);
    const first = Math.max(0, Math.floor((from * scale) / BAR_PITCH) - 1);
    const last = Math.min(count, Math.ceil((to * scale) / BAR_PITCH) + 1);
    return barsPath(samples, count, first, last, 0.75 - from * scale, BAR_PITCH, 121.65, 200);
  }, [samples, duration, scale, from, to]);

  const labels = [];
  for (let second = Math.ceil(from); second <= to; second++) {
    labels.push(
      <span
        key={second}
        className="mac-waveform-view-ruler-label"
        style={{ left: (second - from) * scale }}
      >
        {formatTime(second)}
      </span>,
    );
  }

  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "img",
      "aria-label": "Waveform",
      ...props,
      className: cn("mac-waveform-view-detail", className),
      style: {
        "--_s": scale,
        "--_x": `${((from - value) * scale).toFixed(2)}px`,
        "--_zero": `${(-value * scale).toFixed(2)}px`,
        ...style,
      } as CSSProperties,
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        onPointerDown?.(event);
        if (event.defaultPrevented || disabled || event.button || drag.current) return;
        drag.current = [event.pointerId, event.clientX, value];
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        onPointerMove?.(event);
        const start = drag.current;
        if (!event.defaultPrevented && !disabled && start?.[0] === event.pointerId) {
          setValue(clamp(start[2] - (event.clientX - start[1]) / scale, 0, duration));
        }
      },
      onPointerUp: end(onPointerUp),
      onPointerCancel: end(onPointerCancel),
      onLostPointerCapture: end(onLostPointerCapture),
      children: (
        <>
          <div className="mac-waveform-view-panel">
            <svg
              className="mac-waveform-view-bars"
              width={(to - from) * scale}
              height="243.5"
              aria-hidden="true"
            >
              <path d={bars} />
            </svg>
          </div>
          <div className="mac-waveform-view-ruler">
            <div className="mac-waveform-view-ticks" />
            <div className="mac-waveform-view-ruler-labels">{labels}</div>
          </div>
          <div className="mac-waveform-view-playhead" />
        </>
      ),
    },
  });
}

// Measured: 310 bars in the 723 pt strip, placed by share of its width.
const OVERVIEW_BARS = 310;

// The stylesheet centres the thumb with margins, not Base UI's translation.
const HANDLE_STYLE: CSSProperties = { translate: "none" };

export interface WaveformViewOverviewProps
  extends Omit<
    BaseSlider.Root.Props<number>,
    | "ref"
    | "children"
    | "className"
    | "value"
    | "defaultValue"
    | "onValueChange"
    | "min"
    | "max"
    | "step"
    | "largeStep"
    | "orientation"
    | "disabled"
    | "thumbAlignment"
    | "thumbCollisionBehavior"
    | "minStepsBetweenValues"
  > {
  /**
   * Seconds that the strip's whole width stands for, when that is more than the recording: the
   * waveform and the handle's travel then take the leading part of the strip. Voice Memos shows
   * a short recording this way. By default, and whenever it is less than `duration` or not
   * finite, the strip is the whole recording.
   */
  span?: number;
  /**
   * Accessible name of the slider.
   * @default "Recording position"
   */
  "aria-label"?: string;
  /** Id of the element that names the slider, in place of `aria-label`. */
  "aria-labelledby"?: string;
  /** Class names for the root element. */
  className?: string;
  /** Ref to the `<input type="range">` inside the handle. */
  inputRef?: Ref<HTMLInputElement>;
  /** Ref to the root element. */
  ref?: Ref<HTMLDivElement>;
}

/** The overview: the whole recording in a strip, and the view's slider (Base UI's Slider). */
export function WaveformViewOverview({
  span,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  inputRef,
  className,
  ...props
}: WaveformViewOverviewProps) {
  const { samples, duration, value, setValue, step, largeStep, disabled, formatTime } =
    useWaveform("WaveformViewOverview");
  const share = span && span > duration && span < 1 / 0 ? duration / span : 1;

  const bars = useMemo(() => {
    const count = duration > 0 ? Math.round(OVERVIEW_BARS * share) : 0;
    return barsPath(samples, count, 0, count, 0.5, 1, 22.05, 32);
  }, [samples, share, duration]);

  // Time runs from left to right in every writing direction, as the waveform does. An empty
  // recording is a disabled slider from 0 to 1: Base UI wants `max` above `min`.
  return (
    <DirectionProvider direction="ltr">
      <BaseSlider.Root
        className={cn("mac-waveform-view-overview", className)}
        aria-labelledby={ariaLabelledBy}
        {...props}
        value={value}
        onValueChange={(next) => setValue(next as number)}
        min={0}
        max={duration || 1}
        step={step}
        largeStep={largeStep}
        disabled={disabled || duration <= 0}
      >
        <div className="mac-waveform-view-strip">
          <svg
            className="mac-waveform-view-overview-bars"
            viewBox={`0 0 ${OVERVIEW_BARS} 44.1`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={bars} vectorEffect="non-scaling-stroke" />
          </svg>
          <BaseSlider.Control
            className="mac-waveform-view-control"
            style={{ width: `${(share * 100).toFixed(4)}%` }}
          >
            <BaseSlider.Track className="mac-waveform-view-track">
              <BaseSlider.Thumb
                className="mac-waveform-view-handle"
                style={HANDLE_STYLE}
                aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? "Recording position")}
                aria-labelledby={ariaLabelledBy}
                getAriaValueText={(_formatted, current) => formatTime(current)}
                inputRef={inputRef}
              />
            </BaseSlider.Track>
          </BaseSlider.Control>
        </div>
        <div className="mac-waveform-view-overview-labels" aria-hidden="true">
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </BaseSlider.Root>
    </DirectionProvider>
  );
}
