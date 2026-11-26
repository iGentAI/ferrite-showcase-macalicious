import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { Separator } from "macalicious/separator";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

/** Height of the window's title bar: blueprint coordinates are measured from the frame's top. */
const CHROME_HEIGHT = 38;

export interface PaneFormProps extends ComponentProps<"div"> {
  /**
   * Where the right-aligned labels end, in points from the pane's left edge. The controls
   * start 12 pt after it.
   * @default 238
   */
  labelWidth?: number;
  /**
   * Space between the label column and the controls, in points.
   * @default 12
   */
  gap?: number;
  /**
   * Where the positioned element the form is in sits in the window frame, when that element is
   * not the pane itself: for a form in the panel of a tab view, the tab view's top-left corner.
   * The form's rows keep taking window coordinates.
   */
  origin?: { x: number; y: number };
}

/**
 * The frame of a pane laid out as a form: it fills the pane and positions `PaneRow`s,
 * `PaneRule`s and anything else by their distance from the window's top-left corner, the
 * coordinates the blueprints give.
 */
export function PaneForm({ labelWidth, gap, origin, className, style, ...props }: PaneFormProps) {
  const placed: CSSProperties | undefined = origin && {
    inset: "auto",
    top: CHROME_HEIGHT - origin.y,
    left: -origin.x,
    width: 668,
    // No height: the rows are placed, and the form must not cover what is under it.
    height: 0,
  };
  return (
    <div
      className={cn("mac-system-preferences-form", className)}
      style={
        {
          ...(labelWidth === undefined ? undefined : { "--_label-width": `${labelWidth}px` }),
          ...(gap === undefined ? undefined : { "--_gap": `${gap}px` }),
          ...placed,
          ...style,
        } as CSSProperties
      }
      {...props}
    />
  );
}

export interface PaneRowProps extends Omit<ComponentProps<"div">, "children"> {
  /** Top edge of the row's controls, in points from the top of the window frame. */
  y: number;
  /** The label in the right-aligned label column, ending with a colon as in Catalina. */
  label?: ReactNode;
  /** An id for the label element, to name the control with `aria-labelledby`. */
  labelId?: string;
  /**
   * How far the label's line box starts below the controls' top edge: 2 for a 20 pt pop-up
   * button, 0 for a radio button, checkbox or swatch.
   * @default 0
   */
  labelOffset?: number;
  /** The controls of the row, laid out in a line. */
  children?: ReactNode;
}

/** One row of a `PaneForm`: an optional label and the controls beside it. */
export function PaneRow({
  y,
  label,
  labelId,
  labelOffset = 0,
  className,
  style,
  children,
  ...props
}: PaneRowProps) {
  return (
    <div
      className={cn("mac-system-preferences-row", className)}
      style={{ top: y - CHROME_HEIGHT, ...style }}
      {...props}
    >
      {label == null ? null : (
        <Label
          id={labelId}
          align="end"
          className="mac-system-preferences-row-label"
          style={{ marginTop: labelOffset }}
        >
          {label}
        </Label>
      )}
      <div className="mac-system-preferences-row-content">{children}</div>
    </div>
  );
}

/** A separator across the pane, 20 pt from each side, `y` points from the top of the frame. */
export function PaneRule({ y }: { y: number }) {
  return (
    <Separator
      aria-hidden="true"
      className="mac-system-preferences-rule"
      style={{ top: y - CHROME_HEIGHT }}
    />
  );
}

export interface PaneAtProps extends ComponentProps<"div"> {
  /** Left edge in points from the frame's left edge. */
  x: number;
  /** Top edge in points from the top of the window frame. */
  y: number;
  /** Width in points; the content's own width without it. */
  width?: number;
}

/** Anything placed at a measured point of the pane: a control, a caption, a picture. */
export function PaneAt({ x, y, width, className, style, ...props }: PaneAtProps) {
  return (
    <div
      className={cn("mac-system-preferences-at", className)}
      style={{ top: y - CHROME_HEIGHT, left: x, width, ...style }}
      {...props}
    />
  );
}

export interface PaneFooterProps extends ComponentProps<"div"> {
  /** Left edge in points from the frame's left edge. Give `x` or `right`. */
  x?: number;
  /** Distance of the right edge from the frame's right edge, in points. */
  right?: number;
  /** Top edge in points from the top of the window frame. */
  y: number;
}

/** A group of footer controls (help button, lock button) at a measured place in the pane. */
export function PaneFooter({ x, right, y, className, style, ...props }: PaneFooterProps) {
  return (
    <div
      className={cn("mac-system-preferences-footer", className)}
      style={{ top: y - CHROME_HEIGHT, left: x, right, ...style }}
      {...props}
    />
  );
}
