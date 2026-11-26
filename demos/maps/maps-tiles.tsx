"use client";

import {
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clampZoom,
  type LatLon,
  MAX_ZOOM,
  type MapView,
  MIN_ZOOM,
  metersPerPixel,
  type Pixel,
  panBy,
  project,
  TILE_SIZE,
  turned,
  turnedVector,
  unproject,
  visibleTiles,
  zoomAbout,
} from "./maps-geo";
import "./maps.tokens.css";
import "./maps-tiles.css";

/** Where the tiles' attribution leads, as OpenStreetMap's licence asks. */
export const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";

/** What an owner's overlay is given: where points are drawn on the map, and its size. */
export interface MapLayer {
  /** Where a point is drawn, in pixels from the map's top-left corner. */
  project: (point: LatLon) => Pixel;
  width: number;
  height: number;
}

export interface TileMapProps extends Omit<ComponentProps<"div">, "children"> {
  /**
   * A class for the tiles' attribution link, so that a host can place it (Find My moves it below its
   * chrome's strip). The link keeps `mac-maps-tiles-attribution`.
   */
  attributionClassName?: string;
  /** What the map shows: its middle and zoom level (2 to 19). */
  view: MapView;
  /** Called with the view a drag, the wheel, a double-click or the keyboard asks for. */
  onViewChange: (view: MapView) => void;
  /**
   * The direction that is up on the map, in degrees clockwise from north. The tiles turn; pins and
   * the location, placed by the layer's `project`, stay upright where they belong.
   * @default 0
   */
  heading?: number;
  /** The map's accessible name. */
  label: string;
  /** The browser's location, drawn as the blue dot with its accuracy; `null` for none. */
  location?: (LatLon & { accuracy_m?: number }) | null;
  /** Called with the point under the pointer when the map's context menu is asked for. */
  onDropPin?: (point: LatLon) => void;
  /** Called when a drag starts moving the map. */
  onPanStart?: () => void;
  /** Called with the map's size whenever it changes. */
  onSizeChange?: (size: { width: number; height: number }) => void;
  /** What lies over the map (pins, markers), placed with the layer's `project`. */
  children?: (layer: MapLayer) => ReactNode;
}

/**
 * A callback ref that sets `own` and the owner's `owner` ref (an object, a callback, or a
 * callback that returns its cleanup, as React 19 allows) to the same element.
 */
function useMergedRef<T>(own: RefObject<T | null>, owner: Ref<T> | undefined) {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback(
    (element: T | null) => {
      own.current = element;
      if (typeof owner === "function") {
        if (element) {
          const done = owner(element);
          cleanup.current = typeof done === "function" ? done : null;
        } else if (cleanup.current) {
          cleanup.current();
          cleanup.current = null;
        } else {
          owner(null);
        }
      } else if (owner) {
        owner.current = element;
      }
    },
    [own, owner],
  );
}

/** The size of an element, kept up to date while a `ResizeObserver` is available. */
function useSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      // The layout size, which a window's transform does not change.
      const width = element.offsetWidth || element.getBoundingClientRect().width;
      const height = element.offsetHeight || element.getBoundingClientRect().height;
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Whether the page is hidden: a hidden page loads no tiles. */
function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

/** The pixels of the wheel that make one zoom level: about one notch of a mouse wheel. */
const WHEEL_STEP = 80;
/** How far the arrow keys move the map, in pixels. */
const KEY_STEP = 100;
/** How far the pointer must move before a press becomes a drag. */
const DRAG_SLOP = 3;

/**
 * The real map: OpenStreetMap's standard tiles, loaded by the browser as images for the part of
 * the world in view and no more, with the current location and the owner's overlay
 * over them, and the attribution the tiles' licence asks for. Drag to move it; the wheel, a
 * double-click (Shift for out) and the plus and minus keys zoom about the pointer or the middle;
 * the arrow keys move it; the context menu drops a pin. The owner keeps the view.
 */
export function TileMap({
  view,
  onViewChange,
  heading = 0,
  label,
  location = null,
  onDropPin,
  onPanStart,
  onSizeChange,
  children,
  className,
  attributionClassName,
  onPointerDown: ownerPointerDown,
  onPointerMove: ownerPointerMove,
  onPointerUp: ownerPointerUp,
  onPointerCancel: ownerPointerCancel,
  onLostPointerCapture: ownerLostPointerCapture,
  onDoubleClick: ownerDoubleClick,
  onContextMenu: ownerContextMenu,
  onKeyDown: ownerKeyDown,
  ref: ownerRef,
  ...props
}: TileMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The owner's own ref, if it passes one, is set too: it never replaces the map's, which the
  // map measures itself and its pointer with.
  const setRef = useMergedRef(ref, ownerRef);
  const { width, height } = useSize(ref);
  const hidden = usePageHidden();
  const [dragging, setDragging] = useState(false);
  /**
   * The drag under way: its pointer, where the pointer was when the map last moved with it (or
   * pressed, before it has), and the last view the drag asked for with the `view` it was asked
   * from. Each move pans from the newest view: the owner's, once it has taken the drag's or been
   * changed by anything else (the wheel, the keyboard, the zoom buttons), or else the drag's own
   * last one, so moves that come before the owner answers are never lost.
   */
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
    asked: { view: MapView; from: MapView } | null;
  } | null>(null);
  const latest = useRef({ view, onViewChange, width, height, heading });
  useEffect(() => {
    latest.current = { view, onViewChange, width, height, heading };
  });
  useEffect(() => {
    if (width > 0 && height > 0) onSizeChange?.({ width, height });
  }, [width, height, onSizeChange]);

  const zoom = clampZoom(view.zoom);
  // A turned map is drawn on a square as wide as the view's diagonal, which covers it at any angle.
  const side = heading === 0 ? 0 : Math.ceil(Math.hypot(width, height));
  const tiles = useMemo(
    () =>
      hidden
        ? []
        : side > 0
          ? visibleTiles({ center: view.center, zoom }, side, side)
          : visibleTiles({ center: view.center, zoom }, width, height),
    [hidden, view.center, zoom, width, height, side],
  );
  const layer: MapLayer = useMemo(
    () => ({
      project: (point) =>
        turned(
          project(point, { center: view.center, zoom }, width, height),
          -heading,
          width,
          height,
        ),
      width,
      height,
    }),
    [view.center, zoom, width, height, heading],
  );

  /** The pointer's place on the map, in its own pixels, north up. */
  const pixelOf = (clientX: number, clientY: number): Pixel => {
    const element = ref.current;
    if (!element) return { x: width / 2, y: height / 2 };
    const rect = element.getBoundingClientRect();
    const scaleX = rect.width > 0 ? width / rect.width : 1;
    const scaleY = rect.height > 0 ? height / rect.height : 1;
    return turned(
      { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY },
      heading,
      width,
      height,
    );
  };

  // The wheel is heard natively, so that it can be kept from scrolling the page.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let total = 0;
    let rest: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      total += event.deltaY * unit;
      clearTimeout(rest);
      rest = setTimeout(() => {
        total = 0;
      }, 250);
      if (Math.abs(total) < WHEEL_STEP) return;
      const step = total < 0 ? 1 : -1;
      total = 0;
      const now = latest.current;
      const rect = element.getBoundingClientRect();
      const pixel = turned(
        {
          x: (event.clientX - rect.left) * (rect.width > 0 ? now.width / rect.width : 1),
          y: (event.clientY - rect.top) * (rect.height > 0 ? now.height / rect.height : 1),
        },
        now.heading,
        now.width,
        now.height,
      );
      const next = zoomAbout(now.view, now.view.zoom + step, pixel, now.width, now.height);
      if (next.zoom !== clampZoom(now.view.zoom)) now.onViewChange(next);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      clearTimeout(rest);
      element.removeEventListener("wheel", onWheel);
    };
  }, []);

  /** Whether an event began on something of the overlay that takes its own clicks. */
  const onControl = (target: EventTarget) =>
    target instanceof Element && target.closest("button, a, input, [data-map-control]") !== null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // One drag at a time: a second finger or button pressed during a drag is not a new one.
    if (drag.current || event.button !== 0 || onControl(event.target)) return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      asked: null,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - current.x) * (rect.width > 0 ? width / rect.width : 1);
    const dy = (event.clientY - current.y) * (rect.height > 0 ? height / rect.height : 1);
    if (!current.moved) {
      if (Math.hypot(dx, dy) < DRAG_SLOP) return;
      current.moved = true;
      setDragging(true);
      onPanStart?.();
    }
    const base = current.asked && current.asked.from === view ? current.asked.view : view;
    const moved = turnedVector({ x: dx, y: dy }, heading);
    const next = panBy({ center: base.center, zoom: clampZoom(base.zoom) }, moved.x, moved.y);
    current.x = event.clientX;
    current.y = event.clientY;
    current.asked = { view: next, from: view };
    onViewChange(next);
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (onControl(event.target)) return;
    const step = event.shiftKey ? -1 : 1;
    onViewChange(
      zoomAbout(
        { center: view.center, zoom },
        zoom + step,
        pixelOf(event.clientX, event.clientY),
        width,
        height,
      ),
    );
  };
  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!onDropPin || onControl(event.target)) return;
    event.preventDefault();
    onDropPin(
      unproject(
        pixelOf(event.clientX, event.clientY),
        { center: view.center, zoom },
        width,
        height,
      ),
    );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const here = { center: view.center, zoom };
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const moved = turnedVector({ x: move[0], y: move[1] }, heading);
      onViewChange(panBy(here, moved.x, moved.y));
    } else if ((event.key === "+" || event.key === "=") && zoom < MAX_ZOOM) {
      event.preventDefault();
      onViewChange({ center: view.center, zoom: zoom + 1 });
    } else if ((event.key === "-" || event.key === "_") && zoom > MIN_ZOOM) {
      event.preventDefault();
      onViewChange({ center: view.center, zoom: zoom - 1 });
    }
  };

  const here = location && width > 0 ? layer.project(location) : null;
  const halo =
    location && here && location.accuracy_m
      ? Math.min(2_000, location.accuracy_m / metersPerPixel(location.lat, zoom))
      : 0;

  return (
    <div
      ref={setRef}
      role="application"
      aria-roledescription="map"
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the map is moved and zoomed from the keyboard
      tabIndex={0}
      data-zoom={zoom}
      data-dragging={dragging ? "" : undefined}
      className={className ? `mac-maps-tiles ${className}` : "mac-maps-tiles"}
      {...props}
      // The owner's handlers run first; one that calls preventDefault() keeps the map's own from
      // acting. Ending a drag always runs, so the pointer is never left captured.
      onPointerDown={(event) => {
        ownerPointerDown?.(event);
        if (!event.defaultPrevented) onPointerDown(event);
      }}
      onPointerMove={(event) => {
        ownerPointerMove?.(event);
        if (!event.defaultPrevented) onPointerMove(event);
      }}
      onPointerUp={(event) => {
        ownerPointerUp?.(event);
        endDrag(event);
      }}
      onPointerCancel={(event) => {
        ownerPointerCancel?.(event);
        endDrag(event);
      }}
      // A pointer whose capture was taken away ends its drag too, so no drag is left open to
      // refuse the next press.
      onLostPointerCapture={(event) => {
        ownerLostPointerCapture?.(event);
        endDrag(event);
      }}
      onDoubleClick={(event) => {
        ownerDoubleClick?.(event);
        if (!event.defaultPrevented) onDoubleClick(event);
      }}
      onContextMenu={(event) => {
        ownerContextMenu?.(event);
        if (!event.defaultPrevented) onContextMenu(event);
      }}
      onKeyDown={(event) => {
        ownerKeyDown?.(event);
        if (!event.defaultPrevented) onKeyDown(event);
      }}
    >
      <div
        className="mac-maps-tiles-layer"
        aria-hidden="true"
        data-heading={heading === 0 ? undefined : heading}
        style={
          side > 0
            ? {
                inset: "auto",
                left: (width - side) / 2,
                top: (height - side) / 2,
                width: side,
                height: side,
                transform: `rotate(${-heading}deg)`,
              }
            : undefined
        }
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            className="mac-maps-tiles-tile"
            src={tile.url}
            alt=""
            width={TILE_SIZE}
            height={TILE_SIZE}
            draggable={false}
            decoding="async"
            data-tile={`${tile.z}/${tile.x}/${tile.y}`}
            style={{ left: tile.left, top: tile.top }}
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
        ))}
      </div>
      {here ? (
        <span className="mac-maps-tiles-location" style={{ left: here.x, top: here.y }}>
          {halo > 8 ? (
            <span
              className="mac-maps-tiles-accuracy"
              style={{ width: 2 * halo, height: 2 * halo }}
            />
          ) : null}
          <span className="mac-maps-tiles-dot" />
        </span>
      ) : null}
      {width > 0 ? children?.(layer) : null}
      <a
        className={
          attributionClassName
            ? `mac-maps-tiles-attribution ${attributionClassName}`
            : "mac-maps-tiles-attribution"
        }
        href={OSM_COPYRIGHT}
        target="_blank"
        rel="noreferrer"
        data-map-control=""
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}
