"use client";

import { DefaultButton } from "macalicious/default-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetPopup,
  type SheetPopupProps,
  SheetTitle,
} from "macalicious/sheet";
import { Slider } from "macalicious/slider";
import { type PointerEvent as ReactPointerEvent, useEffect, useState } from "react";
import { type PictureCrop, pictureFromBlob } from "./contacts-picture";

/** The side of the square the picture is framed in, in points. */
const FRAME = 180;
const MOST_ZOOM = 4;

/**
 * Choosing how a picture sits on its card: Zoom enlarges it and a drag moves it in the square. Save
 * makes the card's picture from `source`, the file it came from while this window has it.
 */
export function ContactPictureEditor({
  source,
  anchor,
  onSave,
  onCancel,
}: {
  source: Blob;
  anchor?: SheetPopupProps["anchor"];
  /** Called with the picture made, a JPEG `data:` URL. */
  onSave: (url: string) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState<PictureCrop>({ zoom: 1, x: 0.5, y: 0.5 });
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const made = URL.createObjectURL(source);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [source]);
  const scale = size ? (FRAME * crop.zoom) / Math.min(size.width, size.height) : 1;
  const shownWidth = size ? size.width * scale : FRAME;
  const shownHeight = size ? size.height * scale : FRAME;
  const drag = (down: ReactPointerEvent<HTMLElement>) => {
    if (!size) return;
    down.preventDefault();
    const from = { x: down.clientX, y: down.clientY, crop };
    const spare = { x: shownWidth - FRAME, y: shownHeight - FRAME };
    const along = (moved: number, slack: number, before: number) =>
      slack > 0 ? Math.max(0, Math.min(1, before - moved / slack)) : before;
    const move = (event: PointerEvent) =>
      setCrop({
        zoom: from.crop.zoom,
        x: along(event.clientX - from.x, spare.x, from.crop.x),
        y: along(event.clientY - from.y, spare.y, from.crop.y),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <Sheet open onOpenChange={(open) => open || onCancel()}>
      <SheetPopup anchor={anchor} width={260}>
        <SheetTitle>Edit Picture</SheetTitle>
        <div
          aria-label="Picture frame"
          className="mac-contacts-picture-frame"
          role="img"
          style={{ width: FRAME, height: FRAME }}
          onPointerDown={drag}
        >
          {url ? (
            <img
              alt=""
              src={url}
              draggable={false}
              onLoad={(event) =>
                setSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              style={{
                width: shownWidth,
                height: shownHeight,
                translate: `${-(shownWidth - FRAME) * crop.x}px ${-(shownHeight - FRAME) * crop.y}px`,
              }}
            />
          ) : null}
        </div>
        <Slider
          aria-label="Zoom"
          size="small"
          min={1}
          max={MOST_ZOOM}
          step={0.05}
          value={crop.zoom}
          onValueChange={(zoom) => setCrop({ ...crop, zoom: zoom as number })}
        />
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton
            disabled={!size}
            onClick={() => {
              void pictureFromBlob(source, undefined, undefined, crop).then(onSave, onCancel);
            }}
          >
            Save
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
