"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { type PointerEvent, useEffect, useRef, useState } from "react";

/** A part of a picture, as fractions of it. */
export interface ScreenArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** The box between two points of a picture, its sides at least `least` of it, inside it. */
export function areaBetween(
  from: readonly [number, number],
  to: readonly [number, number],
  least = 0.02,
): ScreenArea | null {
  const x = clamp(Math.min(from[0], to[0]));
  const y = clamp(Math.min(from[1], to[1]));
  const w = clamp(Math.max(from[0], to[0])) - x;
  const h = clamp(Math.max(from[1], to[1])) - y;
  return w >= least && h >= least ? { x, y, w, h } : null;
}

/** The pixels of `area` on a picture `width` × `height`, in even numbers as video encoders want. */
export function areaPixels(area: ScreenArea, width: number, height: number) {
  const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
  return {
    x: Math.round(area.x * width),
    y: Math.round(area.y * height),
    width: even(area.w * width),
    height: even(area.h * height),
  };
}

/**
 * A video track of `area` of what `display` shows: its frames drawn on a canvas, by a timer, since
 * the browser pauses animation frames for a page behind another. `stop` ends the drawing.
 */
export async function croppedTrack(
  display: MediaStream,
  area: ScreenArea,
): Promise<{ track: MediaStreamTrack; stop: () => void }> {
  const video = document.createElement("video");
  video.muted = true;
  video.srcObject = display;
  await video.play();
  const part = areaPixels(area, video.videoWidth, video.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = part.width;
  canvas.height = part.height;
  const context = canvas.getContext("2d");
  const draw = () =>
    context?.drawImage(
      video,
      part.x,
      part.y,
      part.width,
      part.height,
      0,
      0,
      part.width,
      part.height,
    );
  draw();
  const ticking = setInterval(draw, 1000 / 30);
  const track = canvas.captureStream(30).getVideoTracks()[0];
  if (!track) {
    clearInterval(ticking);
    throw new Error("This browser cannot record part of a screen.");
  }
  return {
    track,
    stop: () => {
      clearInterval(ticking);
      video.srcObject = null;
    },
  };
}

/** What the browser's picker chose, live, with a box to drag over the part to record. */
export function QuickTimeScreenArea({
  stream,
  onChoose,
  onCancel,
}: {
  stream: MediaStream;
  onChoose: (area: ScreenArea) => void;
  onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [from, setFrom] = useState<readonly [number, number] | null>(null);
  const [area, setArea] = useState<ScreenArea | null>(null);
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);
  const point = (event: PointerEvent<HTMLElement>): [number, number] => {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      (event.clientX - box.left) / Math.max(box.width, 1),
      (event.clientY - box.top) / Math.max(box.height, 1),
    ];
  };
  return (
    <div className="mac-quicktime-player-area">
      <Label className="mac-quicktime-player-area-hint">
        Drag over the picture to choose what to record.
      </Label>
      <div
        role="application"
        aria-label="Part of the screen to record"
        className="mac-quicktime-player-area-picture"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setFrom(point(event));
          setArea(null);
        }}
        onPointerMove={(event) => {
          if (from) setArea(areaBetween(from, point(event)));
        }}
        onPointerUp={(event) => {
          if (from) setArea(areaBetween(from, point(event)));
          setFrom(null);
        }}
      >
        <video ref={video} autoPlay muted playsInline />
        {area ? (
          <span
            className="mac-quicktime-player-area-box"
            style={{
              left: `${area.x * 100}%`,
              top: `${area.y * 100}%`,
              width: `${area.w * 100}%`,
              height: `${area.h * 100}%`,
            }}
          />
        ) : null}
      </div>
      <div className="mac-quicktime-player-area-buttons">
        <PushButton onClick={onCancel}>Cancel</PushButton>
        <DefaultButton disabled={!area} onClick={() => area && onChoose(area)}>
          Record Selection
        </DefaultButton>
      </div>
    </div>
  );
}
