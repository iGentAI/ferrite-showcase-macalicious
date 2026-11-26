"use client";

import { useEffect, useRef, useState } from "react";
import { facesOfThumb, notLookedAt } from "./photos-faces";
import { keepFaces, type LibraryPhoto, type PhotoFace } from "./photos-library";
import { thumbKey } from "./photos-served-data";

const whenIdle = (work: () => void) => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(work, { timeout: 5_000 });
  else setTimeout(work, 200);
};

/**
 * Looks at the photos nobody has looked at yet, one picture each time the page is idle, from the
 * thumbnails already here, and keeps what it finds on the server. Answers whether it is looking now,
 * and whether the detector could not run: that stops it until the window opens again.
 */
export function useFaceScan(
  ready: boolean,
  photos: readonly LibraryPhoto[],
  blobOf: (key: string) => Blob | undefined,
  /** Changes as thumbnails arrive. */
  urls: unknown,
  onFound: (id: string, editedMs: number | null, faces: PhotoFace[]) => void,
) {
  const [looking, setLooking] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const tried = useRef(new Set<string>());
  const running = useRef(false);
  const live = useRef(true);
  const latest = useRef({ photos, onFound });
  latest.current = { photos, onFound };
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `urls` changes as thumbnails arrive
  useEffect(() => {
    if (!ready || unavailable || running.current || typeof createImageBitmap === "undefined") {
      return;
    }
    const next = () =>
      notLookedAt(latest.current.photos).find(
        (photo) => !tried.current.has(thumbKey(photo)) && blobOf(thumbKey(photo)),
      );
    const stop = () => {
      running.current = false;
      if (live.current) setLooking(false);
    };
    const step = () => {
      const photo = live.current ? next() : undefined;
      if (!photo) {
        stop();
        return;
      }
      const key = thumbKey(photo);
      tried.current.add(key);
      whenIdle(async () => {
        let faces: Awaited<ReturnType<typeof facesOfThumb>>;
        try {
          faces = live.current ? await facesOfThumb(blobOf(key) as Blob) : null;
        } catch (error) {
          console.warn(`Photos could not look for faces (${error})`);
          if (live.current) setUnavailable(true);
          stop();
          return;
        }
        if (faces && live.current) {
          try {
            const kept = await keepFaces([{ id: photo.id, edited_ms: photo.edited_ms, faces }]);
            for (const each of kept) {
              if (live.current) latest.current.onFound(each.id, photo.edited_ms, each.faces);
            }
          } catch (error) {
            console.warn(`Photos could not keep the faces it found (${error})`);
          }
        }
        step();
      });
    };
    if (!next()) return;
    running.current = true;
    setLooking(true);
    step();
  }, [ready, unavailable, photos, urls, blobOf]);
  return { looking, unavailable };
}
