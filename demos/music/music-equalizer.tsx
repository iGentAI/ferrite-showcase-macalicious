"use client";

import { Checkbox } from "macalicious/checkbox";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Slider } from "macalicious/slider";
import { TitleBar } from "macalicious/title-bar";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { type PointerEvent, useRef, useState } from "react";
import { EQ_BANDS, EQ_PRESETS, EQ_RANGE, type EqualizerState } from "./music-audio";

export const EQUALIZER_SIZE = { width: 420, height: 268 } as const;

const bandLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}K` : String(hz));

export interface EqualizerWindowProps extends Omit<WindowProps, "children" | "title" | "onChange"> {
  /** Where it opens, against its container. */
  origin: { left: number; top: number };
  value: EqualizerState;
  onChange: (next: EqualizerState) => void;
  onClose: () => void;
}

/** Window > Equalizer: on or off, a preset, the preamp and ten bands, moved by its title bar. */
export function EqualizerWindow({
  origin,
  value,
  onChange,
  onClose,
  onPointerDown: onWindowPointerDown,
  style,
  ...props
}: EqualizerWindowProps) {
  const [place, setPlace] = useState(origin);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    onWindowPointerDown?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target as Element;
    if (!target.closest(".mac-title-bar") || target.closest("button")) return;
    drag.current = { x: event.clientX, y: event.clientY, ...place };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const band = (label: string, gain: number, change: (gain: number) => void) => (
    <div key={label} className="mac-music-eq-band">
      <Slider
        className="mac-music-eq-slider"
        aria-label={label}
        orientation="vertical"
        size="small"
        min={-EQ_RANGE}
        max={EQ_RANGE}
        step={0.5}
        value={gain}
        onValueChange={(next) => change(next as number)}
      />
      <span aria-hidden="true">{label}</span>
    </div>
  );
  return (
    <Window
      aria-label="Equalizer"
      width={EQUALIZER_SIZE.width}
      height={EQUALIZER_SIZE.height}
      style={{ ...style, position: "absolute", left: place.left, top: place.top }}
      {...props}
      onPointerDown={onPointerDown}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start) return;
        setPlace({
          left: start.left + event.clientX - start.x,
          top: Math.max(0, start.top + event.clientY - start.y),
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <TitleBar
        title="Equalizer"
        controls={<WindowControls onClose={onClose} minimizeDisabled zoomDisabled />}
      />
      <div className="mac-music-eq">
        <div className="mac-music-eq-top">
          <Checkbox checked={value.on} onCheckedChange={(on) => onChange({ ...value, on })}>
            On
          </Checkbox>
          <PopUpButton<string>
            aria-label="Preset"
            value={value.preset ?? "Manual"}
            onValueChange={(preset) => {
              const gains = preset ? EQ_PRESETS[preset] : undefined;
              if (preset && gains) onChange({ ...value, preset, gains, on: true });
            }}
          >
            {value.preset === null ? (
              <PopUpButtonItem value="Manual">Manual</PopUpButtonItem>
            ) : null}
            {Object.keys(EQ_PRESETS).map((name) => (
              <PopUpButtonItem key={name} value={name}>
                {name}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </div>
        <div className="mac-music-eq-bands">
          {band("Preamp", value.preamp, (preamp) => onChange({ ...value, preamp }))}
          {EQ_BANDS.map((hz, index) =>
            band(bandLabel(hz), value.gains[index] ?? 0, (gain) =>
              onChange({
                ...value,
                preset: null,
                gains: value.gains.map((old, at) => (at === index ? gain : old)),
              }),
            ),
          )}
        </div>
      </div>
    </Window>
  );
}
