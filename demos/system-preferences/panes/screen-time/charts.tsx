import { Label } from "macalicious/label";
import type { ReactNode } from "react";
import { PaneAt } from "../../form";
import type { Bar, Category, Day } from "./usage";

/** The colour of each part of a bar: a system colour, or a tint of the text for the rest. */
export const CATEGORY_FILL: Record<Category, string> = {
  usage: "var(--mac-color-label-tertiary)",
  productivity: "var(--mac-color-system-blue)",
  other: "var(--mac-color-system-orange)",
  creativity: "var(--mac-color-system-teal)",
};

const GRID = "var(--mac-color-grid)";

/** Left edge of both plots, and the left edge of their first dotted line. */
const LEFT = 212.5;
const WIDTH = 393;

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const HOURS = ["12 AM", "6 AM", "12 PM", "6 PM"];

/**
 * The parts of the bars of one plot, stacked up from `axis`, the top edge of its last line.
 * The top of a bar is rounded.
 */
function Bars({ bars, axis }: { bars: readonly Bar[]; axis: number }) {
  return bars.flatMap((bar) => {
    let bottom = axis + 0.5;
    return bar.parts.map(([category, height], index) => {
      bottom -= height;
      const { x, width } = bar;
      const radius = index === bar.parts.length - 1 ? Math.min(2, height) : 0;
      return (
        <path
          key={`${x}-${category}`}
          d={`M${x} ${bottom + height}V${bottom + radius}a${radius} ${radius} 0 0 1 ${radius}-${radius}h${width - 2 * radius}a${radius} ${radius} 0 0 1 ${radius} ${radius}V${bottom + height}z`}
          style={{ fill: CATEGORY_FILL[category] }}
        />
      );
    });
  });
}

/** Lines across a plot, 1 pt each, from `top` down at a pitch. */
function Lines({ top, pitch }: { top: number; pitch: number }) {
  return [0, 1, 2, 3, 4].map((index) => (
    <rect
      key={index}
      x={LEFT}
      y={top + index * pitch}
      width={WIDTH}
      height="1"
      style={{ fill: GRID }}
    />
  ));
}

/** Dotted lines down a plot: 3 pt on, 1 pt off, from 2 pt under its top line to `bottom`. */
function Dotted({
  count,
  pitch,
  top,
  bottom,
}: {
  count: number;
  pitch: number;
  top: number;
  bottom: number;
}) {
  return Array.from({ length: count }, (_, index) => {
    const x = LEFT + 0.5 + index * pitch;
    return (
      <line
        key={x}
        x1={x}
        x2={x}
        y1={top + 2}
        y2={bottom}
        strokeDasharray="3 1"
        style={{ stroke: GRID }}
      />
    );
  });
}

/** A label of an axis: 10 pt text whose first glyph is at `x` and whose baseline is at `y`. */
function Tick({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <PaneAt x={x - 0.5} y={y - 10}>
      <Label textStyle="mini" color="secondary">
        {children}
      </Label>
    </PaneAt>
  );
}

/**
 * The two plots of a day: the week it is in, with the average as a dashed line, and its hours.
 * Lines and bars are one drawing in the coordinates of the window frame; the labels of the
 * axes are labels placed beside it. The drawing is decorative: the total, the legend and the
 * table say what it shows.
 */
export function Charts({ day }: { day: Day }) {
  return (
    <>
      <PaneAt x={212} y={140}>
        <svg
          width="394"
          height="153"
          viewBox="212 140 394 153"
          aria-hidden="true"
          focusable="false"
        >
          <g shapeRendering="crispEdges">
            <Dotted count={8} pitch={56} top={141} bottom={222} />
            <Lines top={141} pitch={16} />
            <Dotted count={5} pitch={98} top={231} bottom={292} />
            <Lines top={231} pitch={12} />
          </g>
          <Bars bars={day.week} axis={205} />
          <line
            x1={LEFT}
            x2={LEFT + WIDTH}
            y1={day.average + 0.5}
            y2={day.average + 0.5}
            strokeDasharray="5 3"
            shapeRendering="crispEdges"
            style={{ stroke: "var(--mac-color-system-green)" }}
          />
          <Bars bars={day.hours} axis={279} />
        </svg>
      </PaneAt>

      <Tick x={607.5} y={144.5}>
        {day.scale[0]}
      </Tick>
      <Tick x={607.5} y={176.5}>
        {day.scale[1]}
      </Tick>
      <PaneAt x={607} y={day.average - 6}>
        <span className="mac-system-preferences-screen-time-average">avg</span>
      </PaneAt>
      {day.zero && (
        <Tick x={607.5} y={208.5}>
          0
        </Tick>
      )}
      {WEEKDAYS.map((weekday, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the days of a week, of which two share a letter
        <Tick key={index} x={216 + index * 56} y={215.5}>
          {weekday}
        </Tick>
      ))}

      <Tick x={607.5} y={234.5}>
        60m
      </Tick>
      <Tick x={607.5} y={258.5}>
        30m
      </Tick>
      <Tick x={607.5} y={282.5}>
        0
      </Tick>
      {HOURS.map((hour, index) => (
        <Tick key={hour} x={215.5 + index * 98} y={289.5}>
          {hour}
        </Tick>
      ))}

      {day.legend.map(([category, name, time], index) => (
        <PaneAt key={category} x={212 + index * 146} y={298}>
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            aria-hidden="true"
            focusable="false"
            style={{ marginTop: 3.5 }}
          >
            <rect width="8" height="8" rx="2" style={{ fill: CATEGORY_FILL[category] }} />
          </svg>
          <span className="mac-system-preferences-screen-time-legend">
            <Label textStyle="small" color="secondary">
              {name}
            </Label>
            <Label textStyle="small">{time}</Label>
          </span>
        </PaneAt>
      ))}
    </>
  );
}
