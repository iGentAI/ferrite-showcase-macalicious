"use client";

import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  applyView,
  drawMarks,
  fromView,
  type Mark,
  type Point,
  type Rect,
  toView,
  type View,
} from "./preview-markup";
import type { PdfField, PdfLink } from "./preview-pdf";
import { foundBoxes, type ShownBox } from "./preview-text";

/**
 * One page of the document in Preview's window: the page itself on one canvas, the colour of its
 * highlights multiplied over that on a second, its text and what is found in it, and the rest of
 * the markup on a canvas over them, which takes the pointer while the markup bar is shown. A page
 * is drawn only once it comes near the view, and drawn again when its size or turn changes.
 */

/** The most device pixels one canvas holds: past it, a page is drawn at a lower resolution. */
const MAX_PIXELS = 16_000_000;

/** Device pixels a CSS pixel for a canvas of `width` × `height` CSS pixels. */
export function pixelRatioFor(width: number, height: number): number {
  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const area = Math.max(1, width * height);
  // No lower floor: a floor would let a large enough page pass the pixel budget.
  return Math.min(ratio, Math.sqrt(MAX_PIXELS / area));
}

/** A press, move or release on a page, in page space and in view space. */
export interface PagePointer {
  page: number;
  point: Point;
  viewPoint: Point;
  event: ReactPointerEvent<HTMLCanvasElement>;
}

export interface PreviewPageProps {
  /** The page's number, from 1. */
  number: number;
  /** Its size on the screen, in CSS pixels. */
  width: number;
  height: number;
  /** The page's own size: the picture's pixels, or the PDF page's points. */
  source: { width: number; height: number };
  view: View;
  marks: readonly Mark[];
  /** A mark being drawn. */
  draft?: Mark | null;
  /** A crop being chosen, in page space. */
  selection?: Rect | null;
  /** The outline of an elliptical or lasso selection, in page space, in place of its box. */
  selectionOutline?: readonly Point[] | null;
  /** The links on the page, when it has been asked for and they take the pointer. */
  links?: () => Promise<readonly PdfLink[]>;
  onFollowLink?: (link: PdfLink) => void;
  /** The form fields on the page, and what filling one does. */
  fields?: () => Promise<readonly PdfField[]>;
  onFieldChange?: (field: PdfField, value: string | boolean) => void;
  /** The marks chosen with the selection tool. */
  selected?: string | readonly string[] | null;
  /** Draws the page on `canvas`, `width` CSS pixels wide at `ratio` device pixels each. */
  drawPage: (
    canvas: HTMLCanvasElement,
    width: number,
    ratio: number,
  ) => Promise<unknown> | undefined;
  /** Lays the page's text over `container`, for a PDF: selectable while the marks are not. */
  layOutText?: (container: HTMLElement, width: number) => Promise<unknown> | undefined;
  /** The text being searched for: every place it stands on the page is coloured. */
  found?: string;
  /** Changes whenever the page must be drawn again (another document, turn or crop). */
  drawKey: string;
  /** Whether the markup canvas takes the pointer. */
  interactive: boolean;
  /** The cursor over the page while it does. */
  cursor?: string;
  onPagePointerDown?: (pointer: PagePointer) => void;
  onPagePointerMove?: (pointer: PagePointer) => void;
  onPagePointerUp?: (pointer: PagePointer) => void;
  onPageDoubleClick?: (pointer: Omit<PagePointer, "event">) => void;
  /** Called when a draw failed, with its reason. */
  onDrawError?: (error: unknown) => void;
  /** Placed over the page: the text being typed. */
  children?: ReactNode;
}

/**
 * A PDF's form fields over their places on the page. The page's own canvas draws what they hold, so a
 * field covers it, and what is typed stands in the field until it is drawn with the page.
 */
function PageFields({
  fields,
  view,
  onChange,
}: {
  fields: readonly PdfField[];
  view: View;
  onChange?: (field: PdfField, value: string | boolean) => void;
}) {
  const [held, setHeld] = useState<ReadonlyMap<string, string | boolean>>(new Map());
  const heldValue = (field: PdfField) => held.get(field.id) ?? field.value;
  const change = (field: PdfField, value: string | boolean) => {
    setHeld((now) => {
      const next = new Map(now);
      for (const other of field.group) next.set(other, false);
      next.set(field.id, value);
      return next;
    });
    onChange?.(field, value);
  };
  return (
    <>
      {fields.map((field) => {
        const a = toView([field.x, field.y], view);
        const b = toView([field.x + field.w, field.y + field.h], view);
        const place = {
          left: `${Math.min(a[0], b[0]) * 100}%`,
          top: `${Math.min(a[1], b[1]) * 100}%`,
          width: `${Math.abs(a[0] - b[0]) * 100}%`,
          height: `${Math.abs(a[1] - b[1]) * 100}%`,
        };
        const common = {
          "aria-label": field.name,
          className: "mac-preview-app-field",
          disabled: field.readOnly,
          style: place,
        };
        if (field.kind === "checkbox" || field.kind === "radio") {
          return (
            <input
              key={field.id}
              {...common}
              type={field.kind}
              checked={heldValue(field) === true}
              onChange={(event) => change(field, event.currentTarget.checked)}
            />
          );
        }
        if (field.kind === "choice") {
          return (
            <select
              key={field.id}
              {...common}
              value={String(heldValue(field))}
              onChange={(event) => change(field, event.currentTarget.value)}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        }
        return field.multiline ? (
          <textarea
            key={field.id}
            {...common}
            value={String(heldValue(field))}
            onChange={(event) => change(field, event.currentTarget.value)}
          />
        ) : (
          <input
            key={field.id}
            {...common}
            type="text"
            value={String(heldValue(field))}
            onChange={(event) => change(field, event.currentTarget.value)}
          />
        );
      })}
    </>
  );
}

export function PreviewPage({
  number,
  width,
  height,
  source,
  view,
  marks,
  draft,
  selection,
  selectionOutline,
  links,
  onFollowLink,
  fields,
  onFieldChange,
  selected,
  drawPage,
  layOutText,
  found,
  drawKey,
  interactive,
  cursor,
  onPagePointerDown,
  onPagePointerMove,
  onPagePointerUp,
  onPageDoubleClick,
  onDrawError,
  children,
}: PreviewPageProps) {
  const leaf = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const tint = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  // How many times the text has been laid out, for what is found in it.
  const [laidOut, setLaidOut] = useState(0);
  const [hits, setHits] = useState<ShownBox[]>([]);
  const [pageLinks, setLinks] = useState<readonly PdfLink[]>([]);
  const [pageFields, setFields] = useState<readonly PdfField[]>([]);
  // How many times the page's canvas has been drawn, for the loupes that magnify it.
  const [baseDrawn, setBaseDrawn] = useState(0);
  const hasLoupe = useRef(false);
  hasLoupe.current = marks.some((mark) => mark.kind === "loupe");
  // The draw last asked of the page canvas: a draw is asked again only when this changes.
  const drawn = useRef("");

  useEffect(() => {
    const element = leaf.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setNear(entry.isIntersecting);
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ratio = pixelRatioFor(width, height);
  const key = `${drawKey}|${Math.round(width)}|${ratio}`;
  useEffect(() => {
    const canvas = base.current;
    if (!canvas || !near || drawn.current === key) return;
    // Drawn after a short pause, so a zoom that goes on draws once at the size it ends at; the
    // canvas shows the last drawing, stretched, meanwhile.
    const timer = setTimeout(
      () => {
        drawn.current = key;
        const done = drawPage(canvas, width, ratio);
        if (hasLoupe.current) {
          void Promise.resolve(done).then(
            () => setBaseDrawn((times) => times + 1),
            () => {},
          );
        }
        done?.catch?.((error: unknown) => {
          if (drawn.current === key) drawn.current = "";
          onDrawError?.(error);
        });
      },
      drawn.current === "" ? 0 : 120,
    );
    return () => clearTimeout(timer);
  }, [key, near, drawPage, width, ratio, onDrawError]);

  // The text is laid out after a short pause, as the page is drawn, so a zoom that goes on does it
  // once. Text that cannot be read costs nothing but selecting it: the page is still drawn.
  const textKey = `${drawKey}|${Math.round(width)}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `textKey` is a page drawn anew, whose text is laid out again.
  useEffect(() => {
    const container = text.current;
    if (!container || !near || !layOutText) return;
    const timer = setTimeout(() => {
      layOutText(container, width)
        ?.then(() => setLaidOut((times) => times + 1))
        .catch?.((error: unknown) => {
          console.warn(`Preview could not lay out the text of page ${number} (${error})`);
        });
    }, 120);
    return () => clearTimeout(timer);
  }, [textKey, near, layOutText, width, number]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `laidOut` is new text to look in.
  useEffect(() => {
    const layer = text.current;
    const page = leaf.current;
    setHits(layer && page && found ? foundBoxes(layer, page, found) : []);
  }, [found, laidOut]);

  useEffect(() => {
    if (!near || !links) {
      setLinks([]);
      return;
    }
    let live = true;
    links().then(
      (read) => {
        if (live) setLinks(read);
      },
      (error: unknown) => {
        console.warn(`Preview could not read the links of page ${number} (${error})`);
      },
    );
    return () => {
      live = false;
    };
  }, [near, links, number]);

  useEffect(() => {
    if (!near || !fields) {
      setFields([]);
      return;
    }
    let live = true;
    fields().then(
      (read) => {
        if (live) setFields(read);
      },
      (error: unknown) => {
        console.warn(`Preview could not read the form fields of page ${number} (${error})`);
      },
    );
    return () => {
      live = false;
    };
  }, [near, fields, number]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `baseDrawn` is a new page for a loupe to magnify.
  useEffect(() => {
    const canvas = overlay.current;
    if (!canvas || !near) return;
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    const pixelHeight = Math.max(1, Math.round(height * ratio));
    const paint = (target: HTMLCanvasElement, items: readonly Mark[]) => {
      if (target.width !== pixelWidth) target.width = pixelWidth;
      if (target.height !== pixelHeight) target.height = pixelHeight;
      const context = target.getContext("2d");
      if (!context) return null;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      context.save();
      applyView(context, source.width, source.height, view, {
        width: pixelWidth,
        height: pixelHeight,
      });
      drawMarks(context, items, source.width, source.height, selected, base.current);
      context.restore();
      return context;
    };
    if (tint.current) {
      paint(
        tint.current,
        marks.filter((mark) => mark.kind === "highlight"),
      );
    }
    const others = marks.filter((mark) => mark.kind !== "highlight");
    const context = paint(canvas, draft ? [...others, draft] : others);
    if (!context) return;
    if (selection) {
      const a = toView([selection.x, selection.y], view);
      const b = toView([selection.x + selection.w, selection.y + selection.h], view);
      const x = Math.min(a[0], b[0]) * pixelWidth;
      const y = Math.min(a[1], b[1]) * pixelHeight;
      const w = Math.abs(a[0] - b[0]) * pixelWidth;
      const h = Math.abs(a[1] - b[1]) * pixelHeight;
      const outline = () => {
        if (!selectionOutline) {
          context.rect(x, y, w, h);
          return;
        }
        for (const point of selectionOutline) {
          const [u, v] = toView(point as Point, view);
          context.lineTo(u * pixelWidth, v * pixelHeight);
        }
        context.closePath();
      };
      // Outside the crop is dimmed, as Preview's rectangular selection does.
      context.fillStyle = "rgba(0, 0, 0, 0.35)";
      context.beginPath();
      context.rect(0, 0, pixelWidth, pixelHeight);
      outline();
      context.fill("evenodd");
      context.setLineDash([6 * ratio, 4 * ratio]);
      context.lineWidth = ratio;
      context.strokeStyle = "#ffffff";
      context.beginPath();
      outline();
      context.stroke();
    }
  }, [
    near,
    width,
    height,
    ratio,
    source.width,
    source.height,
    view,
    marks,
    draft,
    selection,
    selectionOutline,
    selected,
    baseDrawn,
  ]);

  const pointer = (
    event: ReactPointerEvent<HTMLCanvasElement>,
    handler: ((pointer: PagePointer) => void) | undefined,
  ) => {
    if (!handler) return;
    const box = event.currentTarget.getBoundingClientRect();
    const viewPoint: Point = [
      (event.clientX - box.left) / Math.max(box.width, 1),
      (event.clientY - box.top) / Math.max(box.height, 1),
    ];
    handler({ page: number, point: fromView(viewPoint, view), viewPoint, event });
  };

  return (
    <div
      ref={leaf}
      className="mac-preview-app-page"
      data-page={number}
      role="img"
      aria-label={`Page ${number}`}
      style={{ width, height }}
    >
      <canvas ref={base} className="mac-preview-app-page-canvas" />
      <canvas ref={tint} className="mac-preview-app-page-tint" />
      {hits.map((hit) => (
        <span
          key={`${hit.left},${hit.top},${hit.right}`}
          className="mac-preview-app-page-found"
          style={{
            left: `${hit.left * 100}%`,
            top: `${hit.top * 100}%`,
            width: `${(hit.right - hit.left) * 100}%`,
            height: `${(hit.bottom - hit.top) * 100}%`,
          }}
        />
      ))}
      {layOutText ? <div ref={text} className="mac-preview-app-page-text" /> : null}
      <canvas
        ref={overlay}
        className="mac-preview-app-page-marks"
        data-interactive={interactive ? "" : undefined}
        style={interactive && cursor ? { cursor } : undefined}
        onPointerDown={(event) => {
          if (!interactive || event.button !== 0) return;
          // The press draws; it does not move the focus to the document behind the page, which
          // would take it from a text being typed.
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          pointer(event, onPagePointerDown);
        }}
        onPointerMove={(event) => {
          if (interactive) pointer(event, onPagePointerMove);
        }}
        onPointerUp={(event) => {
          if (!interactive) return;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          pointer(event, onPagePointerUp);
        }}
        onDoubleClick={(event) => {
          if (!interactive || !onPageDoubleClick) return;
          const box = event.currentTarget.getBoundingClientRect();
          const viewPoint: Point = [
            (event.clientX - box.left) / Math.max(box.width, 1),
            (event.clientY - box.top) / Math.max(box.height, 1),
          ];
          onPageDoubleClick({ page: number, point: fromView(viewPoint, view), viewPoint });
        }}
      />
      {children}
      {interactive
        ? null
        : pageLinks.map((link) => {
            const a = toView([link.x, link.y], view);
            const b = toView([link.x + link.w, link.y + link.h], view);
            return (
              <button
                key={`${link.x},${link.y},${link.w}`}
                type="button"
                className="mac-preview-app-link"
                aria-label={link.url ? `Link to ${link.url}` : `Link to page ${link.page}`}
                title={link.url}
                style={{
                  left: `${Math.min(a[0], b[0]) * 100}%`,
                  top: `${Math.min(a[1], b[1]) * 100}%`,
                  width: `${Math.abs(a[0] - b[0]) * 100}%`,
                  height: `${Math.abs(a[1] - b[1]) * 100}%`,
                }}
                onClick={() => onFollowLink?.(link)}
              />
            );
          })}
      {interactive ? null : <PageFields fields={pageFields} view={view} onChange={onFieldChange} />}
    </div>
  );
}
