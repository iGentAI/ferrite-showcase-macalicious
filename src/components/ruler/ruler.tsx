"use client";

import { type ComponentProps, type CSSProperties, useEffect, useRef, useState } from "react";
import { observeResize } from "../../lib/observe-resize";
import "./ruler.tokens.css";
import "./ruler.css";

export interface RulerMarker {
  /** A tab stop, named by its alignment, or one of the paragraph's three indents. */
  type:
    | "left"
    | "center"
    | "right"
    | "decimal"
    | "first-line-indent"
    | "head-indent"
    | "tail-indent";
  /** Distance from the ruler's origin, in points. */
  position: number;
  /** Accessible name of a draggable marker. By default it is made from the type. */
  label?: string;
}

// Per unit: points between numbered ticks, what a numbered tick counts, points between the
// smallest ticks, abbreviation. Inches halve three times (measured); the others follow the
// step cycles NSRulerView registers for them.
const UNITS = {
  inches: [72, 1, 9, "in"],
  centimeters: [28.3465, 1, 14.17325, "cm"],
  points: [100, 100, 12.5, "pt"],
  picas: [120, 10, 15, "pc"],
} as const;

// Slider keys: ticks to move by.
const KEYS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  End: Infinity,
  Home: -Infinity,
};

const indexOf = (event: { target: EventTarget }) =>
  Number((event.target as HTMLElement).dataset.index);

export interface RulerProps extends ComponentProps<"div"> {
  /**
   * Measurement units (NSRulerView.measurementUnits). An inch is 72 pt.
   * @default "inches"
   */
  units?: "inches" | "centimeters" | "points" | "picas";
  /**
   * Where 0 is, in points from the ruler's left edge: the text container's left padding.
   * @default 5
   */
  origin?: number;
  /** Tab stops and indents, with their positions in points from the origin. */
  markers?: RulerMarker[];
  /**
   * Called with the new array when a marker is dragged or moved with the arrow keys. With
   * it the markers are sliders; without it the ruler is decorative and `aria-hidden`.
   */
  onMarkersChange?: (markers: RulerMarker[]) => void;
  /**
   * The magnification of the text view the ruler stands over: the ruler is drawn at it, and a
   * dragged marker moves with the pointer, so that its marks stay over the text.
   * @default 1
   */
  zoom?: number;
}

/**
 * The horizontal ruler of a text view (NSRulerView): 32 pt high, with ticks, numbers and
 * markers for tab stops and indents. It fills the width it is given.
 */
export function Ruler({
  units = "inches",
  origin = 5,
  markers,
  onMarkersChange,
  zoom = 1,
  className,
  style,
  onPointerDown,
  onPointerMove,
  onLostPointerCapture,
  onKeyDown,
  ...props
}: RulerProps) {
  const [major, count, step, unit] = UNITS[units];
  const numbers = useRef<HTMLDivElement>(null);
  // The ruler's width: a guess until it is measured. It gives how many numbers fit and the
  // last tick a marker can be on.
  const [width, setWidth] = useState(1200);
  const length = Math.ceil((width - origin) / major);
  const end = Math.max(Math.floor((width - origin) / step), 0) * step;
  useEffect(() => {
    const element = numbers.current;
    return element ? observeResize(element, () => setWidth(element.clientWidth)) : undefined;
  }, []);

  // The marker being dragged, the pointer's distance from the ruler's origin to it, and
  // which pointer drags it: only that pointer moves the marker or ends the drag.
  const drag = useRef<[index: number, offset: number, pointer: number] | null>(null);
  // Move a marker to the tick nearest `to`, within the ruler.
  const move = (index: number, to: number, ruler: HTMLElement) => {
    const last = Math.max(Math.floor((ruler.clientWidth - origin) / step), 0);
    const position = Math.min(Math.max(Math.round(to / step), 0), last) * step;
    if (markers && position !== markers[index]?.position)
      onMarkersChange?.(markers.map((item, i) => (i === index ? { ...item, position } : item)));
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: one delegated handler for the markers, which are the interactive elements
    <div
      role={onMarkersChange ? "group" : undefined}
      aria-hidden={onMarkersChange ? undefined : true}
      data-units={units}
      className={className ? `mac-ruler ${className}` : "mac-ruler"}
      style={
        {
          "--_origin": `${origin}px`,
          "--_major": `${major}px`,
          ...(zoom === 1 ? undefined : { zoom }),
          ...style,
        } as CSSProperties
      }
      onPointerDown={(event) => {
        onPointerDown?.(event);
        const index = indexOf(event);
        const marker = markers?.[index];
        if (!marker || !onMarkersChange || drag.current || event.button || event.defaultPrevented)
          return;
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        drag.current = [index, event.clientX / zoom - marker.position, event.pointerId];
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (drag.current?.[2] === event.pointerId && !event.defaultPrevented)
          move(drag.current[0], event.clientX / zoom - drag.current[1], event.currentTarget);
      }}
      // The marker loses the pointer when it is released or cancelled, and when something
      // else takes it: the drag is over.
      onLostPointerCapture={(event) => {
        onLostPointerCapture?.(event);
        if (drag.current?.[2] === event.pointerId) drag.current = null;
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        const index = indexOf(event);
        const marker = markers?.[index];
        const ticks = KEYS[event.key];
        if (!marker || !ticks || event.defaultPrevented) return;
        event.preventDefault();
        move(index, marker.position + ticks * step, event.currentTarget);
      }}
      {...props}
    >
      <div ref={numbers} aria-hidden="true" className="mac-ruler-numbers">
        {Array.from({ length }, (_, n) => n * count).map((value) => (
          <span
            key={value}
            className="mac-ruler-number"
            style={{ left: origin + (value / count) * major + 3 }}
          >
            {value}
          </span>
        ))}
      </div>
      {markers?.map((marker, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a marker's identity is its place in the array
          key={index}
          data-index={index}
          data-type={marker.type}
          className="mac-ruler-marker"
          style={{ left: origin + marker.position }}
          {...(onMarkersChange && {
            role: "slider",
            tabIndex: 0,
            "aria-label":
              marker.label ??
              marker.type.replace(/-/g, " ") + (marker.type.endsWith("indent") ? "" : " tab stop"),
            "aria-valuenow": marker.position,
            "aria-valuemin": 0,
            "aria-valuemax": end,
            "aria-valuetext": `${+((marker.position * count) / major).toFixed(2)} ${unit}`,
          })}
        />
      ))}
    </div>
  );
}
