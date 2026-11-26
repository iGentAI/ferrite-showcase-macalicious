"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampZoom,
  fromWorld,
  type LatLon,
  MAX_ZOOM,
  type MapView,
  MIN_ZOOM,
  toWorld,
} from "../maps/maps-geo";
import { TileMap } from "../maps/maps-tiles";
import type { LibraryPhoto, PhotoLocation } from "./photos-library";
import { photoCount, thumbKey, titleOf } from "./photos-served-data";

/** How close two pins may stand, in pixels, before they become one. */
const PIN_SPACING = 64;
/** The margin a fitted map keeps around its pins, in pixels. */
const FIT_MARGIN = 72;
/** The closest a fitted map comes: a whole town rather than one street. */
const FIT_MAX_ZOOM = 13;
/** The Info map's zoom on a placed photo. */
const LOCATION_ZOOM = 10;

type Located = LibraryPhoto & { location: PhotoLocation };

const isLocated = (photo: LibraryPhoto): photo is Located => photo.location !== null;

/** Photos taken close together at one zoom level, shown as one pin. */
export interface PlaceCluster {
  /** The first photo's id: the pin stays itself while the map moves. */
  key: string;
  at: LatLon;
  photos: LibraryPhoto[];
}

/** The pins of a zoom level: each photo joins the first pin within `PIN_SPACING`, in list order. */
export function clusterPlaces(photos: readonly LibraryPhoto[], zoom: number): PlaceCluster[] {
  const level = clampZoom(zoom);
  const pins: { x: number; y: number; cluster: PlaceCluster }[] = [];
  for (const photo of photos) {
    if (!isLocated(photo)) continue;
    const { x, y } = toWorld(photo.location, level);
    const near = pins.find((pin) => Math.hypot(pin.x - x, pin.y - y) < PIN_SPACING);
    if (near) near.cluster.photos.push(photo);
    else {
      const { lat, lon } = photo.location;
      pins.push({ x, y, cluster: { key: photo.id, at: { lat, lon }, photos: [photo] } });
    }
  }
  return pins.map((pin) => pin.cluster);
}

/** The closest view of `width` by `height` pixels that shows every located photo. */
export function fitPlaces(photos: readonly LibraryPhoto[], width: number, height: number): MapView {
  const points = photos.filter(isLocated).map((photo) => photo.location);
  if (points.length === 0) return { center: { lat: 20, lon: 0 }, zoom: MIN_ZOOM };
  for (let zoom = Math.min(FIT_MAX_ZOOM, MAX_ZOOM); ; zoom -= 1) {
    const world = points.map((point) => toWorld(point, zoom));
    const xs = world.map((pixel) => pixel.x);
    const ys = world.map((pixel) => pixel.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const fits = right - left <= width - 2 * FIT_MARGIN && bottom - top <= height - 2 * FIT_MARGIN;
    if (fits || zoom === MIN_ZOOM) {
      return { center: fromWorld({ x: (left + right) / 2, y: (top + bottom) / 2 }, zoom), zoom };
    }
  }
}

/**
 * The Info window's small map: where the photo is, and Control-click (the map's context menu) places
 * it. It follows the photo it is given.
 */
export function LocationMap({
  location,
  onPlace,
}: {
  location: PhotoLocation | null;
  onPlace: (point: LatLon) => void;
}) {
  const placed = location ? { lat: location.lat, lon: location.lon } : null;
  const [view, setView] = useState<MapView>({
    center: placed ?? { lat: 20, lon: 0 },
    zoom: placed ? LOCATION_ZOOM : MIN_ZOOM,
  });
  const lat = location?.lat;
  const lon = location?.lon;
  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    setView((old) => ({ center: { lat, lon }, zoom: Math.max(old.zoom, LOCATION_ZOOM) }));
  }, [lat, lon]);
  return (
    <div className="mac-photos-info-map">
      <TileMap label="Location map" view={view} onViewChange={setView} onDropPin={onPlace}>
        {(layer) => {
          if (!placed) return null;
          const at = layer.project(placed);
          return <span className="mac-photos-info-pin" style={{ left: at.x, top: at.y }} />;
        }}
      </TileMap>
    </div>
  );
}

interface PlacesMapProps {
  /** The photos to place; those with no location are left out. */
  photos: readonly LibraryPhoto[];
  /** Thumbnails by `thumbKey`. */
  urls: ReadonlyMap<string, string>;
  /** A pin was chosen: the photos it stands for. */
  onChoose: (photos: readonly LibraryPhoto[]) => void;
}

/**
 * The Places row's map: the desktop's OpenStreetMap tiles with a pin per place, drawn as the place's
 * first photo with a count when it stands for several. Pins merge as the map zooms out.
 */
export function PlacesMap({ photos, urls, onChoose }: PlacesMapProps) {
  const [view, setView] = useState<MapView>({ center: { lat: 20, lon: 0 }, zoom: MIN_ZOOM });
  const fitted = useRef(false);
  const latest = useRef(photos);
  latest.current = photos;
  const fit = useCallback((size: { width: number; height: number }) => {
    if (fitted.current) return;
    fitted.current = true;
    setView(fitPlaces(latest.current, size.width, size.height));
  }, []);
  const clusters = useMemo(() => clusterPlaces(photos, view.zoom), [photos, view.zoom]);
  return (
    <div className="mac-photos-places">
      <TileMap label="Map of photos" view={view} onViewChange={setView} onSizeChange={fit}>
        {(layer) =>
          clusters.map((cluster) => {
            const first = cluster.photos[0];
            if (!first) return null;
            const at = layer.project(cluster.at);
            const url = urls.get(thumbKey(first));
            const count = cluster.photos.length;
            const name = first.location?.name;
            return (
              <button
                key={cluster.key}
                type="button"
                className="mac-photos-place"
                style={{ left: at.x, top: at.y }}
                aria-label={`${name ?? titleOf(first)}, ${photoCount(count)}`}
                onClick={() => onChoose(cluster.photos)}
              >
                {url ? <img src={url} alt="" draggable={false} /> : null}
                {count > 1 ? <span className="mac-photos-place-count">{count}</span> : null}
              </button>
            );
          })
        }
      </TileMap>
    </div>
  );
}
